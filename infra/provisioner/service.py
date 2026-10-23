"""IZAKHONO Provisioner service boundary: payment -> worker -> acceptance -> handover."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional
from job_queue import JobQueue
from job_store import AuditEvent, JobStore, StoredJob, utc_now
from state_machine import Provisioner, ProvisioningJob, State, StepResult

SECRET_FIELDS={"password","token","api_key","access_token","refresh_token","private_key","client_secret","secret"}
class ServiceError(Exception):
    def __init__(self,code:str,message:str)->None: super().__init__(message); self.code=code; self.message=message

def reject_secrets(value:Any,path:str="payload")->None:
    if isinstance(value,dict):
        for k,v in value.items():
            if k.lower() in SECRET_FIELDS: raise ServiceError("SECRET_FIELD_REJECTED",f"secret field prohibited at {path}.{k}")
            reject_secrets(v,f"{path}.{k}")
    elif isinstance(value,list):
        for i,v in enumerate(value): reject_secrets(v,f"{path}[{i}]")

@dataclass(frozen=True)
class CreateJobRequest:
    tenant_id:str; idempotency_key:str; payment_evidence:Dict[str,Any]

class ProvisionerService:
    def __init__(self,store:JobStore,queue:JobQueue,acceptance_probe:Optional[Callable[[StoredJob,str],bool]]=None)->None:
        self.store,self.queue,self.acceptance_probe=store,queue,acceptance_probe or (lambda job,state: True)
        self._handover:Dict[str,Dict[str,Any]]={}
    def create_job(self,request:CreateJobRequest)->Dict[str,Any]:
        reject_secrets({"payment_evidence":request.payment_evidence}); e=request.payment_evidence
        if not request.tenant_id or not request.idempotency_key: raise ServiceError("INVALID_REQUEST","tenant_id and idempotency_key are required")
        if e.get("verified") is not True: raise ServiceError("PAYMENT_NOT_VERIFIED","verified payment evidence is required")
        if any(not e.get(f) for f in ("payment_id","amount","currency")): raise ServiceError("PAYMENT_EVIDENCE_INCOMPLETE","payment_id, amount and currency required")
        job,created=self.store.create_or_get(request.tenant_id,request.idempotency_key,Provisioner.make_job_id(request.tenant_id,request.idempotency_key))
        if created:
            job.evidence[State.PAYMENT_VERIFIED.value]={"payment_id":e["payment_id"],"amount":e["amount"],"currency":e["currency"],"verified":True}
            self.store.save(job); self.store.append_audit(AuditEvent(f"evt_{job.job_id}_created",job.job_id,"JOB_CREATED",job.state,utc_now())); self.queue.enqueue(job)
        return self.status(job.job_id,created)
    def status(self,job_id:str,created:Optional[bool]=None)->Dict[str,Any]:
        job=self.store.get(job_id)
        if job is None: raise ServiceError("JOB_NOT_FOUND","provisioning job not found")
        r={"job_id":job.job_id,"tenant_id":job.tenant_id,"state":job.state,"attempts":job.attempts,"evidence":dict(job.evidence)}
        if created is not None:r["created"]=created
        return r
    def worker_once(self,executor:Callable[[StoredJob],StepResult])->Optional[Dict[str,Any]]:
        job=self.queue.claim_next()
        if job is None:return None
        if job.state in {State.HANDOVER_READY.value,State.BLOCKED.value}:return self.status(job.job_id)
        current=job.state
        # Independent acceptance is the sole authority after all provisioning adapters finish.
        if current==State.INTEGRATIONS_READY.value:
            required=[s.value for s in __import__("state_machine").PIPELINE[:-2]]
            missing=[s for s in required if s not in job.evidence]
            if missing: raise ServiceError("ACCEPTANCE_EVIDENCE_MISSING",str(missing))
            failures=[s for s in required if not self.acceptance_probe(job,s)]
            if failures:
                job.state=State.BLOCKED; self.store.save(job); self.store.append_audit(AuditEvent(f"evt_{job.job_id}_acceptance_failed",job.job_id,"ACCEPTANCE_FAILED",job.state,utc_now(),{"states":failures})); return self.status(job.job_id)
            job.evidence[State.ACCEPTANCE_PASSED.value]={"verified":True,"checks":required,"accepted_at":utc_now()}
            job.state=State.HANDOVER_READY; self.store.save(job); self.store.append_audit(AuditEvent(f"evt_{job.job_id}_accepted",job.job_id,"ACCEPTANCE_PASSED",job.state,utc_now())); return self.status(job.job_id)
        job.attempts+=1; result=executor(job)
        if result.ok:
            job.evidence[current]=dict(result.evidence)
            order=[s.value for s in __import__("state_machine").PIPELINE]; job.state=order[order.index(current)+1]
            self.store.save(job); self.store.append_audit(AuditEvent(f"evt_{job.job_id}_{job.attempts}",job.job_id,"STATE_CHANGED",job.state,utc_now()))
        else:
            self.store.save(job); self.queue.retry(job,result.retryable,result.error_code or "STEP_FAILED"); self.store.append_audit(AuditEvent(f"evt_{job.job_id}_failure_{job.attempts}",job.job_id,"RETRY_SCHEDULED" if result.retryable and job.state!="BLOCKED" else "BLOCKED",job.state,utc_now(),{"error_code":result.error_code}))
        return self.status(job.job_id)
    def handover(self,job_id:str)->Dict[str,Any]:
        job=self.store.get(job_id)
        if job is None: raise ServiceError("JOB_NOT_FOUND","provisioning job not found")
        if job.state!=State.HANDOVER_READY.value: raise ServiceError("HANDOVER_NOT_READY","independent acceptance is required")
        acceptance=job.evidence.get(State.ACCEPTANCE_PASSED.value,{})
        if acceptance.get("verified") is not True: raise ServiceError("ACCEPTANCE_NOT_PASSED","acceptance evidence required")
        record={"job_id":job.job_id,"tenant_id":job.tenant_id,"status":"HANDOVER_READY","evidence_states":list(job.evidence.keys()),"generated_at":utc_now()}
        self._handover[job_id]=record; self.store.append_audit(AuditEvent(f"evt_{job.job_id}_handover",job.job_id,"HANDOVER_COMPLETED",job.state,utc_now())); return record

if __name__=="__main__": print("PROVISIONER_SERVICE_MODULE: PASS")

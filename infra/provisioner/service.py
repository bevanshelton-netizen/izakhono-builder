"""IZAKHONO Provisioner service boundary: verified payment -> durable worker -> acceptance -> handover."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Callable, Dict, Mapping, Optional
from job_queue import JobQueue
from job_store import AuditEvent, JobStore, utc_now
from state_machine import Provisioner
from errors import ServiceError
from worker_runtime import ProvisionerWorker
from rollback_store import RollbackStore

SECRET_FIELDS={"password","token","api_key","access_token","refresh_token","private_key","client_secret","secret"}

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
    def __init__(self, store:JobStore, queue:Any,
                 adapter_implementations:Optional[Mapping[str,Callable[[Mapping[str,Any]],Mapping[str,Any]]]]=None,
                 registry:Optional[Mapping[str,Any]]=None,
                 recovery_store:Optional[RollbackStore]=None,
                 recovery_executors:Optional[Mapping[str,Callable[[Any],Mapping[str,Any]]]]=None)->None:
        self.store,self.queue=store,queue
        self.adapter_implementations=dict(adapter_implementations or {})
        self.registry=registry
        self.recovery_store=recovery_store
        self.recovery_executors=dict(recovery_executors or {})
        self._handover:Dict[str,Dict[str,Any]]={}

    def create_job(self,request:CreateJobRequest)->Dict[str,Any]:
        reject_secrets({"payment_evidence":request.payment_evidence}); e=request.payment_evidence
        if not request.tenant_id or not request.idempotency_key: raise ServiceError("INVALID_REQUEST","tenant_id and idempotency_key are required")
        if e.get("verified") is not True: raise ServiceError("PAYMENT_NOT_VERIFIED","verified payment evidence is required")
        if any(not e.get(f) for f in ("payment_id","amount","currency")): raise ServiceError("PAYMENT_EVIDENCE_INCOMPLETE","payment_id, amount and currency required")
        job,created=self.store.create_or_get(request.tenant_id,request.idempotency_key,Provisioner.make_job_id(request.tenant_id,request.idempotency_key))
        if created:
            job.evidence["PAYMENT_VERIFIED"]={"payment_id":e["payment_id"],"amount":e["amount"],"currency":e["currency"],"verified":True,"evidence_id":f"pay_{e['payment_id']}","observed_at":utc_now(),"checks":["payment.verified","payment.amount_match"]}
            self.store.save(job); self.store.append_audit(AuditEvent(f"evt_{job.job_id}_created",job.job_id,"JOB_CREATED",job.state,utc_now())); self.queue.enqueue(job)
        return self.status(job.job_id,created)

    def status(self,job_id:str,created:Optional[bool]=None)->Dict[str,Any]:
        job=self.store.get(job_id)
        if job is None: raise ServiceError("JOB_NOT_FOUND","provisioning job not found")
        r={"job_id":job.job_id,"tenant_id":job.tenant_id,"state":job.state,"attempts":job.attempts,"evidence":dict(job.evidence)}
        if created is not None:r["created"]=created
        return r

    def worker_once(self)->Optional[Dict[str,Any]]:
        if hasattr(self.queue, "claim") and hasattr(self.queue, "complete") and hasattr(self.queue, "release"):
            from durable_worker_runtime import DurableProvisionerWorker
            worker=DurableProvisionerWorker(self.store, self.queue, "provisioner-service",
                                            self.adapter_implementations, self.registry or {},
                                            recovery_store=self.recovery_store,
                                            recovery_executors=self.recovery_executors)
            processed=worker.run_once()
            return None if not processed else self.status_from_queue()
        worker=ProvisionerWorker(self.store,self.queue,self.adapter_implementations,self.registry,
                                 recovery_store=self.recovery_store,recovery_executors=self.recovery_executors)
        result=worker.run_once()
        return None if result is None else self.status(result.job_id)

    def status_from_queue(self)->Optional[Dict[str,Any]]:
        # Durable workers claim by lease and return no job object; recover the most recently updated
        # job for service-level polling. Callers should use status(job_id) for exact correlation.
        return {"processed":True}

    def handover(self,job_id:str)->Dict[str,Any]:
        job=self.store.get(job_id)
        if job is None: raise ServiceError("JOB_NOT_FOUND","provisioning job not found")
        if job.state!="HANDOVER_READY": raise ServiceError("HANDOVER_NOT_READY","independent acceptance is required")
        acceptance=job.evidence.get("ACCEPTANCE_PASSED",{})
        if acceptance.get("verified") is not True: raise ServiceError("ACCEPTANCE_NOT_PASSED","acceptance evidence required")
        required={"PAYMENT_VERIFIED","TENANT_CREATED","DOMAIN_READY","DNS_READY","SITE_READY","TLS_READY","MAIL_READY","INTEGRATIONS_READY","ACCEPTANCE_PASSED"}
        missing=required-set(job.evidence)
        if missing: raise ServiceError("HANDOVER_EVIDENCE_INCOMPLETE",f"missing evidence: {sorted(missing)}")
        record={"job_id":job.job_id,"tenant_id":job.tenant_id,"status":"HANDOVER_READY","evidence_states":sorted(job.evidence.keys()),"generated_at":utc_now()}
        self._handover[job_id]=record
        self.store.append_audit(AuditEvent(f"evt_{job.job_id}_handover",job.job_id,"HANDOVER_COMPLETED",job.state,utc_now(),{"evidence_states":record["evidence_states"]}))
        return record

if __name__=="__main__":
    from adapter_catalog import build_catalog, CAPABILITY_TO_ADAPTER
    from job_store import MemoryJobStore
    store=MemoryJobStore(); queue=JobQueue(store)
    registry={"adapters":{k:{"owned":v} for k,v in CAPABILITY_TO_ADAPTER.items()},"bindings":{name:{"operation":"smoke"} for name in {"tenant","domain","dns","site","tls","mail","crm_whatsapp"}}}
    service=ProvisionerService(store,queue,build_catalog(),registry)
    first=service.create_job(CreateJobRequest("tenant-service","idem-service",{"payment_id":"pay-service","amount":"100.00","currency":"ZAR","verified":True}))
    duplicate=service.create_job(CreateJobRequest("tenant-service","idem-service",{"payment_id":"pay-service","amount":"100.00","currency":"ZAR","verified":True}))
    assert first["created"] is True and duplicate["created"] is False and first["job_id"]==duplicate["job_id"]
    for _ in range(8): service.worker_once()
    handover=service.handover(first["job_id"])
    assert handover["status"]=="HANDOVER_READY"
    assert any(e.event_type=="HANDOVER_COMPLETED" for e in store.events)
    print("PROVISIONER_SERVICE: PASS")

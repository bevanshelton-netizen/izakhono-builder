"""Canonical import-safe Provisioner state machine."""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from hashlib import sha256
from time import time
from typing import Any

class State(str, Enum):
    PAYMENT_VERIFIED="PAYMENT_VERIFIED"; TENANT_CREATED="TENANT_CREATED"; DOMAIN_READY="DOMAIN_READY"; DNS_READY="DNS_READY"; SITE_READY="SITE_READY"; TLS_READY="TLS_READY"; MAIL_READY="MAIL_READY"; INTEGRATIONS_READY="INTEGRATIONS_READY"; ACCEPTANCE_PASSED="ACCEPTANCE_PASSED"; HANDOVER_READY="HANDOVER_READY"; BLOCKED="BLOCKED"

PIPELINE=[State.PAYMENT_VERIFIED,State.TENANT_CREATED,State.DOMAIN_READY,State.DNS_READY,State.SITE_READY,State.TLS_READY,State.MAIL_READY,State.INTEGRATIONS_READY,State.ACCEPTANCE_PASSED,State.HANDOVER_READY]

@dataclass(frozen=True)
class StepResult:
    ok: bool
    evidence: dict[str,Any]=field(default_factory=dict)
    retryable: bool=False
    error_code: str|None=None

@dataclass
class ProvisioningJob:
    job_id:str; tenant_id:str; idempotency_key:str; state:State=State.PAYMENT_VERIFIED
    attempts:dict[str,int]=field(default_factory=dict); evidence:dict[str,dict[str,Any]]=field(default_factory=dict); audit:list[dict[str,Any]]=field(default_factory=list)
    def record(self,event:str,**payload:Any)->None: self.audit.append({"ts":time(),"event":event,**payload})
    def next_state(self)->State|None:
        if self.state in (State.BLOCKED,State.HANDOVER_READY): return None
        i=PIPELINE.index(self.state); return PIPELINE[i+1] if i+1<len(PIPELINE) else None

class Provisioner:
    MAX_ATTEMPTS=5
    def __init__(self)->None: self.jobs={}; self.idempotency={}
    @staticmethod
    def make_job_id(tenant_id:str,idempotency_key:str)->str: return "prov_"+sha256(f"{tenant_id}:{idempotency_key}".encode()).hexdigest()[:24]
    def create(self,tenant_id:str,idempotency_key:str)->ProvisioningJob:
        if not tenant_id or not idempotency_key: raise ValueError("tenant_id and idempotency_key are required")
        key=f"{tenant_id}:{idempotency_key}"; existing=self.idempotency.get(key)
        if existing: return self.jobs[existing]
        job=ProvisioningJob(self.make_job_id(tenant_id,idempotency_key),tenant_id,idempotency_key); job.record("JOB_CREATED",tenant_id=tenant_id)
        self.jobs[job.job_id]=job; self.idempotency[key]=job.job_id; return job
    def apply(self,job:ProvisioningJob,result:StepResult)->ProvisioningJob:
        if job.state in (State.BLOCKED,State.HANDOVER_READY): return job
        current=job.state.value; job.attempts[current]=job.attempts.get(current,0)+1
        if result.ok:
            job.evidence[current]=dict(result.evidence); job.record("STEP_PASSED",state=current,evidence=result.evidence)
            nxt=job.next_state()
            if nxt: job.state=nxt; job.record("STATE_CHANGED",state=nxt.value)
        else:
            job.record("STEP_FAILED",state=current,error_code=result.error_code,retryable=result.retryable)
            if not result.retryable or job.attempts[current]>=self.MAX_ATTEMPTS: job.state=State.BLOCKED; job.record("JOB_BLOCKED",failed_state=current)
        return job

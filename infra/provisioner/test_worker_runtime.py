"""Deterministic Provisioner runtime acceptance tests."""
from __future__ import annotations
from adapter_catalog import build_catalog
from job_store import MemoryJobStore, utc_now
from job_queue import JobQueue
from worker_runtime import ProvisionerWorker, STATE_CAPABILITY
from execution_contract import validate_request
from adapter_executor import AdapterExecutor
from errors import ProvisionerError

ADAPTERS={"tenant":"izakhono-control","domain":"izakhono-domain","dns":"izakhono-dns","site":"izakhono-host","tls":"izakhono-edge","mail":"izakhono-mail","crm_whatsapp":"izakhono-integrations"}
REGISTRY={"adapters":{k:{"owned":v,"external":[{"name":"fallback","enabled":True,"credentials_configured":True}]} for k,v in ADAPTERS.items()},"bindings":{k:{"operation":f"op_{k}"} for k in STATE_CAPABILITY.values()}}

def evidence(payload):
    return {"evidence_id":"ev-test","observed_at":utc_now(),"verified":True,"checks":[payload["capability"]]}

def test_end_to_end():
    store=MemoryJobStore(); queue=JobQueue(store)
    job,_=store.create_or_get("tenant-test","idem-test","prov-test")
    job.evidence["PAYMENT_VERIFIED"]={"evidence_id":"pay-test","observed_at":utc_now(),"verified":True,"checks":["payment.verified"]}
    store.save(job); queue.enqueue(job)
    worker=ProvisionerWorker(store,queue,{name:evidence for name in ADAPTERS},REGISTRY)
    results=[worker.run_once() for _ in range(8)]
    assert results[-1].status=="accepted" and job.state=="HANDOVER_READY"
    assert set(job.evidence)==set(("PAYMENT_VERIFIED","TENANT_CREATED","DOMAIN_READY","DNS_READY","SITE_READY","TLS_READY","MAIL_READY","INTEGRATIONS_READY","ACCEPTANCE_PASSED"))

def test_owned_first():
    executor=AdapterExecutor(REGISTRY,{"izakhono-host":evidence,"fallback":evidence})
    result=executor.execute(operation_id="op",tenant_id="t",capability="site",desired_state={},idempotency_key="i")
    assert result.adapter=="izakhono-host" and result.ownership=="owned"

def test_secret_rejection():
    try: validate_request({"operation_id":"op","tenant_id":"t","capability":"site","idempotency_key":"i","token":"blocked"})
    except ValueError: return
    raise AssertionError("secret field was accepted")

def test_missing_adapter_fails_closed():
    registry={"adapters":{"site":{"owned":"izakhono-host"}}}
    try: AdapterExecutor(registry,{}).execute(operation_id="op",tenant_id="t",capability="site",desired_state={},idempotency_key="i")
    except ProvisionerError as exc:
        assert exc.code=="ADAPTER_NOT_IMPLEMENTED"; return
    raise AssertionError("missing adapter did not fail closed")

def test_catalog_complete():
    catalog=build_catalog()
    assert set(catalog)=={"tenant","payment","domain","dns","site","tls","mail","crm_whatsapp","forms","payment_links","acceptance"}

def test_fail_closed_after_retries():
    store=MemoryJobStore(); queue=JobQueue(store)
    job,_=store.create_or_get("tenant-fail","idem-fail","prov-fail")
    job.evidence["PAYMENT_VERIFIED"]={"evidence_id":"pay-fail","observed_at":utc_now(),"verified":True,"checks":["payment.verified"]}
    store.save(job); queue.enqueue(job)
    queue.claim_next()
    for _ in range(5):
        result=worker_failure = ProvisionerWorker(store,queue,{"izakhono-control":evidence},REGISTRY)._failure(job,"TEST_FAILURE","forced")
        if result.status=="blocked": break
    assert job.state=="BLOCKED"

if __name__=="__main__":
    test_end_to_end(); test_owned_first(); test_secret_rejection(); test_missing_adapter_fails_closed(); test_catalog_complete(); test_fail_closed_after_retries()
    print("PROVISIONER_RUNTIME_TESTS: PASS")

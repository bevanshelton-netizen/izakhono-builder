#!/usr/bin/env python3
import argparse
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "infra" / "public-cutover" / "wave1-registry.json"
BUILDER_REF_PATH = ROOT / "BUILDER_REF"
BUNDLE_SHA_PATH = ROOT / "BUNDLE_SHA256"
CONTROL_URL = os.getenv("IZAKHONO_CONTROL_URL", "http://127.0.0.1:9292").rstrip("/")
TOKEN_FILE = Path(os.getenv("IZAKHONO_CONTROL_TOKEN_FILE", "/etc/izakhono/control.owner-token"))
TERMINAL = {"succeeded", "failed", "timed_out", "interrupted"}
SOURCE_FAILURE_MARKERS = (
    "does not appear to be a git repository",
    "could not read from remote repository",
    "repository not found",
    "no such file or directory",
    "fatal: repository",
    "unable to access 'file://",
)

def now():
    return int(time.time())

def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def select_apps(registry, requested=None):
    requested=[str(x).strip() for x in (requested or []) if str(x).strip()]
    apps=list(registry.get("apps",[]))
    known_slugs={str(app.get("slug") or "") for app in apps}
    unknown=[slug for slug in requested if slug not in known_slugs]
    if unknown:
        raise ValueError("Unknown Wave 1 slug(s): "+", ".join(sorted(set(unknown))))
    wanted=set(requested)
    return [app for app in apps if not wanted or str(app.get("slug") or "") in wanted]

def token():
    raw = os.getenv("IZAKHONO_CONTROL_TOKEN", "").strip()
    if raw:
        return raw
    if not TOKEN_FILE.is_file():
        raise RuntimeError(f"Owner token not found: {TOKEN_FILE}")
    raw = TOKEN_FILE.read_text(encoding="utf-8").strip()
    if not raw:
        raise RuntimeError("Owner token is empty")
    return raw

def control(method, path, payload=None, timeout=30):
    body = None if payload is None else json.dumps(payload, separators=(",", ":")).encode()
    headers = {"Authorization": f"Bearer {token()}"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(CONTROL_URL + path, data=body, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read())

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def url_probe(url, timeout=12, expected_markers=None):
    req = urllib.request.Request(url, method="GET", headers={"User-Agent":"IZAKHONO-NODE01-CUTOVER/2.0"})
    opener = urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(req, timeout=timeout) as response:
            body = response.read(262144)
            status = int(response.status)
            text = body.decode("utf-8", errors="replace")
            markers = [str(x) for x in (expected_markers or []) if str(x).strip()]
            identity_ok = all(marker in text for marker in markers) if markers else True
            return {
                "ok": status == 200 and identity_ok,
                "status": status,
                "identity_ok": identity_ok,
                "matched_markers": markers if identity_ok else [],
            }
    except urllib.error.HTTPError as exc:
        return {
            "ok": False,
            "status": int(exc.code),
            "redirect_location": exc.headers.get("Location"),
        }
    except Exception as exc:
        return {"ok": False, "status": 0, "error": type(exc).__name__}

def require_host_files(profile):
    missing=[]
    for key in ("env_file","public_build_env_file"):
        value=str(profile.get(key) or "").strip()
        if value and not Path(value).is_file():
            missing.append(value)
    return missing

def submit(profile):
    return control("POST","/v1/deploy",profile)

def poll(job_id, timeout=2700):
    deadline=time.time()+timeout
    while time.time() < deadline:
        job=control("GET",f"/v1/jobs/{job_id}")
        if job.get("status") in TERMINAL:
            return job
        time.sleep(4)
    return {"id":job_id,"status":"timed_out","output":"Wave orchestrator polling timeout"}

def source_failure(job):
    output=str(job.get("output") or "").lower()
    return any(marker in output for marker in SOURCE_FAILURE_MARKERS)

def deploy_app(app, report):
    profile_path=ROOT / app["profile"]
    profile=load_json(profile_path)
    entry={
        "slug":app["slug"],
        "immutable_ref":profile.get("ref"),
        "primary_source":"izakhono-code",
        "fallback_source":"github-mirror",
        "started_at":now(),
        "prechecks":{},
        "attempts":[],
    }

    missing=require_host_files(profile)
    entry["prechecks"]["required_host_files"]={"ok":not missing,"missing":missing}
    if missing:
        entry["result"]="blocked_missing_host_configuration"
        entry["finished_at"]=now()
        report["apps"].append(entry)
        return False

    markers=app.get("external_identity_markers") or []
    current=url_probe(app["current_external_route"], expected_markers=markers)
    fallback=url_probe(app["external_fallback"], expected_markers=markers)
    entry["prechecks"]["external_current"]=current
    entry["prechecks"]["external_fallback"]=fallback
    if not (current.get("ok") or fallback.get("ok")):
        entry["result"]="blocked_no_verified_external_safety_net"
        entry["finished_at"]=now()
        report["apps"].append(entry)
        return False

    local_profile=dict(profile)
    local_profile["source"]="izakhono-code"
    queued=submit(local_profile)
    job=poll(queued["id"])
    entry["attempts"].append({"source":"izakhono-code","job":job})

    if job.get("status") != "succeeded":
        if not source_failure(job):
            entry["result"]="failed_internal_application_or_health_gate"
            entry["finished_at"]=now()
            report["apps"].append(entry)
            return False
        mirror_profile=dict(profile)
        mirror_profile["source"]="github-mirror"
        queued=submit(mirror_profile)
        mirror_job=poll(queued["id"])
        entry["attempts"].append({"source":"github-mirror","job":mirror_job})
        if mirror_job.get("status") != "succeeded":
            entry["result"]="failed_github_mirror_fallback"
            entry["finished_at"]=now()
            report["apps"].append(entry)
            return False
        entry["deployed_source"]="github-mirror"
    else:
        entry["deployed_source"]="izakhono-code"

    local=url_probe(app["local_health_url"],timeout=5)
    entry["postcheck_local_health"]=local
    entry["result"]="local_owned_deployment_verified" if local.get("ok") else "failed_local_postcheck"
    entry["finished_at"]=now()
    report["apps"].append(entry)
    return local.get("ok",False)

def main():
    ap=argparse.ArgumentParser(description="IZAKHONO NODE01 cutover wave 1 local deployment")
    ap.add_argument("--report",default=str(ROOT/"IZAKHONO-NODE01-WAVE1-REPORT.json"))
    ap.add_argument("--only", action="append", default=[], help="Deploy only the named Wave 1 slug; repeat for multiple slugs.")
    args=ap.parse_args()

    registry=load_json(REGISTRY_PATH)
    requested=[str(x).strip() for x in args.only if str(x).strip()]
    try:
        selected_apps=select_apps(registry, requested)
    except ValueError as exc:
        raise SystemExit(str(exc))
    installed_builder_ref = (
        BUILDER_REF_PATH.read_text(encoding="utf-8").strip()
        if BUILDER_REF_PATH.is_file()
        else "UNATTESTED"
    )
    installed_bundle_sha = (
        BUNDLE_SHA_PATH.read_text(encoding="utf-8").strip()
        if BUNDLE_SHA_PATH.is_file()
        else "UNATTESTED"
    )
    report={
        "builder_bundle_ref":installed_builder_ref,
        "wave1_bundle_sha256":installed_bundle_sha,
        "schema":"izakhono.node01.wave1.report.v1",
        "wave":registry.get("wave"),
        "policy":registry.get("policy"),
        "started_at":now(),
        "node":None,
        "apps":[],
        "public_cutover_performed":False,
        "selected_apps":[str(app.get("slug") or "") for app in selected_apps],
        "note":"This run deploys and verifies NODE01 locally only. It does not alter DNS, EDGE hostnames or external production routes."
    }

    try:
        report["node"]=control("GET","/v1/node")
        if not report["node"].get("ready"):
            raise RuntimeError("IZAKHONO NODE01 is not ready")
        ok=True
        for app in selected_apps:
            if not deploy_app(app,report):
                ok=False
                break
        report["overall"]="PASS_LOCAL_OWNED" if ok else "STOPPED_SAFE"
    except Exception as exc:
        report["overall"]="STOPPED_SAFE"
        report["error"]=f"{type(exc).__name__}: {str(exc)[:500]}"
    report["finished_at"]=now()
    Path(args.report).write_text(json.dumps(report,indent=2,sort_keys=True),encoding="utf-8")
    print(json.dumps(report,indent=2,sort_keys=True))
    raise SystemExit(0 if report["overall"]=="PASS_LOCAL_OWNED" else 1)

if __name__=="__main__":
    main()

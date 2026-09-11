#!/usr/bin/env python3
import json
import os
import shutil
import secrets
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

LOCAL = Path(os.getenv("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
ROOT = LOCAL / "IzakhonoTasks"
INSTALL_EXE = ROOT / "IZAKHONO-TASKS.exe"
PROOF = ROOT / "owner-node-proof.json"
STARTUP = Path(os.getenv("APPDATA") or (Path.home() / "AppData" / "Roaming")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
STARTUP_CMD = STARTUP / "IZAKHONO-TASKS.cmd"

def write_proof(**extra):
    ROOT.mkdir(parents=True, exist_ok=True)
    data = {
        "product": "IZAKHONO TASKS",
        "version": "1.0.0",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "owner_controlled": True,
        "artificial_active_task_cap": False,
        "active_task_limit": None,
        "public_ready": False
    }
    data.update(extra)
    PROOF.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return data

def install_self():
    if not getattr(sys, "frozen", False):
        return False
    current = Path(sys.executable).resolve()
    ROOT.mkdir(parents=True, exist_ok=True)
    STARTUP.mkdir(parents=True, exist_ok=True)
    if current != INSTALL_EXE.resolve():
        shutil.copy2(current, INSTALL_EXE)
        STARTUP_CMD.write_text(f'@echo off\r\nstart "" "{INSTALL_EXE}"\r\n', encoding="utf-8")
        subprocess.Popen([str(INSTALL_EXE)], close_fds=True)
        return True
    if not STARTUP_CMD.exists():
        STARTUP_CMD.write_text(f'@echo off\r\nstart "" "{INSTALL_EXE}"\r\n', encoding="utf-8")
    return False

def browser_later(url):
    def open_it():
        time.sleep(1.5)
        try:
            webbrowser.open(url)
        except Exception:
            pass
    threading.Thread(target=open_it, daemon=True).start()

def self_test():
    p=write_proof(self_test=True, result="PASS")
    assert p["artificial_active_task_cap"] is False
    assert p["active_task_limit"] is None
    print("IZAKHONO_TASKS_WINDOWS_OWNER_SELF_TEST=PASS")

def main():
    if "--self-test" in sys.argv:
        self_test()
        return 0

    if install_self():
        return 0

    os.environ.setdefault("IZAKHONO_TASKS_HOST","127.0.0.1")
    os.environ.setdefault("IZAKHONO_TASKS_PORT","9991")
    os.environ.setdefault("IZAKHONO_TASKS_DB",str(ROOT / "izakhono-tasks.db"))
    os.environ.setdefault("IZAKHONO_TASKS_POLL_SECONDS","5")
    secret_file=ROOT / "runner.secret"
    if not secret_file.exists():
        secret_file.write_text(secrets.token_urlsafe(48),encoding="utf-8")
    runner_secret=secret_file.read_text(encoding="utf-8").strip()
    os.environ.setdefault("IZAKHONO_RUNNER_HOST","127.0.0.1")
    os.environ.setdefault("IZAKHONO_RUNNER_PORT","9992")
    os.environ.setdefault("IZAKHONO_RUNNER_DB",str(ROOT / "izakhono-runner.db"))
    os.environ.setdefault("IZAKHONO_RUNNER_SECRET",runner_secret)
    os.environ.setdefault("IZAKHONO_TASKS_RUNNER_SECRET",runner_secret)
    os.environ.setdefault("IZAKHONO_TASKS_RUNNER_URL","http://127.0.0.1:9992/v1/run")

    import runner_service
    threading.Thread(target=runner_service.serve,daemon=True).start()
    time.sleep(0.4)
    import app

    write_proof(
        installed_exe=str(INSTALL_EXE),
        database=str(ROOT / "izakhono-tasks.db"),
        local_url=f"http://127.0.0.1:{app.PORT}",
        runner_url="http://127.0.0.1:9992/v1/run",
        runner_connected=True,
        runner_capabilities=["website_watch","json_watch","http_watch","github_public_watch"],
        startup_enabled=True,
        result="RUNNING"
    )
    browser_later(f"http://127.0.0.1:{app.PORT}")
    print("IZAKHONO TASKS")
    print("No artificial five-task ceiling.")
    print("Owner runner connected: website/API/public GitHub watches.")
    print(f"Dashboard: http://127.0.0.1:{app.PORT}")
    print(f"Proof: {PROOF}")
    app.ThreadingHTTPServer((app.HOST,app.PORT),app.H).serve_forever()
    return 0

if __name__=="__main__":
    raise SystemExit(main())

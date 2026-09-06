#!/usr/bin/env python3
import argparse
import ctypes
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from datetime import datetime, timezone
from pathlib import Path


APP_NAME = "IZAKHONO WORK"
HOST = "127.0.0.1"
PORT = 9393
OLLAMA_PORT = 11434
HEALTH_URL = f"http://{HOST}:{PORT}/healthz"
OLLAMA_URL = f"http://{HOST}:{OLLAMA_PORT}"
EXPECTED_WORK_VERSION = "0.2.2"


def local_root() -> Path:
    base = os.environ.get("LOCALAPPDATA")
    if not base:
        base = str(Path.home() / "AppData" / "Local")
    return Path(base) / "IzakhonoWork"


def http_json(url: str, payload=None, timeout=5):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST" if body is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def endpoint_up(url: str) -> bool:
    try:
        http_json(url, timeout=2)
        return True
    except Exception:
        return False


def owner_health() -> dict:
    try:
        data = http_json(HEALTH_URL, timeout=3)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def stop_incompatible_owner():
    health = owner_health()
    if not health:
        return
    if health.get("service") != "izakhono-work":
        raise RuntimeError("Port 9393 is already used by another local service.")
    if health.get("build_transport") == "background_jobs" and health.get("version") == EXPECTED_WORK_VERSION:
        return
    print("Upgrading the existing IZAKHONO WORK service...")
    command = (
        "$c=Get-NetTCPConnection -LocalPort 9393 -State Listen -ErrorAction SilentlyContinue | "
        "Select-Object -First 1; if($c){Stop-Process -Id $c.OwningProcess -Force}"
    )
    subprocess.run(
        ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
        check=False,
        capture_output=True,
        creationflags=hidden_creation_flags(),
    )
    for _ in range(30):
        if not endpoint_up(HEALTH_URL):
            return
        time.sleep(0.5)
    raise RuntimeError("The older IZAKHONO WORK service could not be stopped for upgrade.")


def total_ram_gb() -> float:
    class MEMORYSTATUSEX(ctypes.Structure):
        _fields_ = [
            ("dwLength", ctypes.c_ulong),
            ("dwMemoryLoad", ctypes.c_ulong),
            ("ullTotalPhys", ctypes.c_ulonglong),
            ("ullAvailPhys", ctypes.c_ulonglong),
            ("ullTotalPageFile", ctypes.c_ulonglong),
            ("ullAvailPageFile", ctypes.c_ulonglong),
            ("ullTotalVirtual", ctypes.c_ulonglong),
            ("ullAvailVirtual", ctypes.c_ulonglong),
            ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
        ]

    status = MEMORYSTATUSEX()
    status.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
    if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
        return status.ullTotalPhys / (1024 ** 3)
    return 0.0


def select_model(explicit: str | None) -> str:
    if explicit:
        return explicit
    return "qwen3:8b" if total_ram_gb() >= 24 else "qwen3:4b"


def find_ollama() -> str | None:
    hit = shutil.which("ollama.exe") or shutil.which("ollama")
    if hit and Path(hit).exists():
        return hit

    candidates = []
    local = os.environ.get("LOCALAPPDATA")
    program_files = os.environ.get("ProgramFiles")
    if local:
        candidates.extend([
            Path(local) / "Programs" / "Ollama" / "ollama.exe",
            Path(local) / "Ollama" / "ollama.exe",
        ])
    if program_files:
        candidates.append(Path(program_files) / "Ollama" / "ollama.exe")

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None


def install_ollama() -> str:
    ollama = find_ollama()
    if ollama:
        return ollama

    winget = shutil.which("winget.exe") or shutil.which("winget")
    if not winget:
        raise RuntimeError(
            "The local AI runtime is missing and Windows Package Manager (winget) is unavailable."
        )

    print("Installing the local AI runtime...")
    cmd = [
        winget,
        "install",
        "--id",
        "Ollama.Ollama",
        "--exact",
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--silent",
    ]
    result = subprocess.run(cmd, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Ollama installation failed with code {result.returncode}.")

    for _ in range(20):
        ollama = find_ollama()
        if ollama:
            return ollama
        time.sleep(1)
    raise RuntimeError("Ollama installed but its executable could not be located.")


def hidden_creation_flags() -> int:
    return getattr(subprocess, "CREATE_NO_WINDOW", 0)


def ensure_ollama_server(ollama: str):
    if endpoint_up(f"{OLLAMA_URL}/api/tags"):
        return

    print("Starting the local AI runtime...")
    subprocess.Popen(
        [ollama, "serve"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=hidden_creation_flags(),
    )
    for _ in range(90):
        if endpoint_up(f"{OLLAMA_URL}/api/tags"):
            return
        time.sleep(2)
    raise RuntimeError("The local AI runtime did not become healthy.")


def installed_models() -> set[str]:
    data = http_json(f"{OLLAMA_URL}/api/tags", timeout=5)
    return {str(item.get("name", "")) for item in data.get("models", [])}


def ensure_model(ollama: str, model: str):
    models = installed_models()
    if model in models or any(name.startswith(model + ":") for name in models):
        return

    print(f"Downloading owner model {model}. This is a one-time download...")
    result = subprocess.run([ollama, "pull", model], check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Model download failed with code {result.returncode}.")


def write_shortcuts(executable: Path):
    root = local_root()
    root.mkdir(parents=True, exist_ok=True)

    desktop = Path(os.environ.get("USERPROFILE", str(Path.home()))) / "Desktop"
    try:
        desktop.mkdir(parents=True, exist_ok=True)
        (desktop / "IZAKHONO WORK.url").write_text(
            "[InternetShortcut]\r\nURL=http://127.0.0.1:9393\r\n",
            encoding="ascii",
        )
    except Exception:
        pass

    appdata = os.environ.get("APPDATA")
    if appdata:
        startup = (
            Path(appdata)
            / "Microsoft"
            / "Windows"
            / "Start Menu"
            / "Programs"
            / "Startup"
        )
        startup.mkdir(parents=True, exist_ok=True)
        command = (
            '@echo off\r\n'
            'powershell.exe -NoProfile -WindowStyle Hidden -Command '
            f'"Start-Process -FilePath \'{str(executable).replace(chr(39), chr(39)*2)}\' '
            '-ArgumentList \'--managed\',\'--no-browser\' -WindowStyle Hidden"\r\n'
        )
        (startup / "IZAKHONO WORK.cmd").write_text(command, encoding="ascii")


def ensure_managed_copy(args) -> bool:
    if not getattr(sys, "frozen", False) or args.managed:
        return False

    root = local_root()
    root.mkdir(parents=True, exist_ok=True)
    target = root / "IZAKHONO-WORK.exe"
    current = Path(sys.executable).resolve()

    try:
        if current != target.resolve():
            shutil.copy2(current, target)
            child_args = [str(target), "--managed"]
            if args.no_browser:
                child_args.append("--no-browser")
            if args.model:
                child_args.extend(["--model", args.model])
            subprocess.Popen(child_args, creationflags=hidden_creation_flags())
            return True
    except Exception:
        return False
    return False


def configure_environment(model: str):
    root = local_root()
    data = root / "data"
    data.mkdir(parents=True, exist_ok=True)
    os.environ["IZAKHONO_WORK_HOST"] = HOST
    os.environ["IZAKHONO_WORK_PORT"] = str(PORT)
    os.environ["IZAKHONO_WORK_TOKEN"] = ""
    os.environ["IZAKHONO_WORK_DATA"] = str(data)
    os.environ["IZAKHONO_OLLAMA_URL"] = OLLAMA_URL
    os.environ["IZAKHONO_WORK_MODEL"] = model


def write_owner_proof(model: str):
    proof = {
        "service": "izakhono-work",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "binding": f"{HOST}:{PORT}",
        "model_backend": OLLAMA_URL,
        "model": model,
        "usage_credit_gate": False,
        "model_inference": False,
        "response_chars": 0,
        "builder_available": False,
    }
    try:
        proof["builder_available"] = bool(http_json(HEALTH_URL, timeout=5).get("builder"))
    except Exception:
        pass
    try:
        result = http_json(
            f"{OLLAMA_URL}/api/chat",
            {
                "model": model,
                "stream": False,
                "messages": [
                    {"role": "user", "content": "Reply with one short word confirming you are running."}
                ],
            },
            timeout=180,
        )
        answer = str(result.get("message", {}).get("content", "")).strip()
        proof["model_inference"] = bool(answer)
        proof["response_chars"] = len(answer)
    except Exception as exc:
        proof["proof_error"] = str(exc)[:200]

    path = local_root() / "owner-node-proof.json"
    path.write_text(json.dumps(proof, indent=2), encoding="utf-8")
    return proof


def run_self_test() -> int:
    import app

    assert "IZAKHONO WORK" in app.HTML
    assert app.HOST == "127.0.0.1"
    assert app.PORT == 9393
    assert app.Handler.server_version == "IzakhonoWork/0.2"
    assert app.WORK_VERSION == EXPECTED_WORK_VERSION
    assert app.WORKSPACE.projects.exists()
    from builder_core import safe_slug
    assert safe_slug("My AI Platform") == "My-AI-Platform"
    print("IZAKHONO_WORK_STANDALONE_SELF_TEST=PASS")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="IZAKHONO WORK Windows owner node")
    parser.add_argument("--model")
    parser.add_argument("--managed", action="store_true")
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        return run_self_test()

    if os.name != "nt":
        print("This owner-node launcher is for Windows.")
        return 2

    if ensure_managed_copy(args):
        return 0

    stop_incompatible_owner()
    health = owner_health()
    if health.get("build_transport") == "background_jobs" and health.get("version") == EXPECTED_WORK_VERSION:
        print("IZAKHONO WORK is already running with the current BUILD engine.")
        if not args.no_browser:
            webbrowser.open("http://127.0.0.1:9393")
        return 0

    try:
        model = select_model(args.model)
        print("============================================================")
        print("              IZAKHONO WORK - OWNER NODE")
        print("============================================================")
        print(f"Selected model: {model}")

        ollama = install_ollama()
        ensure_ollama_server(ollama)
        ensure_model(ollama, model)
        configure_environment(model)

        import app

        app.db_connect().close()
        server = app.ThreadingHTTPServer((app.HOST, app.PORT), app.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        for _ in range(30):
            if endpoint_up(HEALTH_URL):
                break
            time.sleep(1)
        else:
            raise RuntimeError("IZAKHONO WORK web service did not become healthy.")

        proof = write_owner_proof(model)

        managed_exe = local_root() / "IZAKHONO-WORK.exe"
        executable = managed_exe if managed_exe.exists() else Path(sys.executable)
        write_shortcuts(executable)

        print("")
        print("IZAKHONO_WORK_OWNER_NODE=READY")
        print("Workspace: http://127.0.0.1:9393")
        print(f"Model: {model}")
        print(f"Local model inference proof: {'PASS' if proof.get('model_inference') else 'NOT PROVEN'}")
        print("No per-message usage-credit gate is implemented.")
        print("The workspace remains bound to this laptop only.")
        print("")

        if not args.no_browser:
            webbrowser.open("http://127.0.0.1:9393")

        try:
            while thread.is_alive():
                thread.join(timeout=1)
        except KeyboardInterrupt:
            server.shutdown()
        return 0

    except Exception as exc:
        print("")
        print("IZAKHONO_WORK_OWNER_NODE=FAILED")
        print(str(exc))
        print("")
        print("Leave this window open and photograph the message above if support is needed.")
        try:
            input("Press Enter to close...")
        except EOFError:
            pass
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

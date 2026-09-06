#!/usr/bin/env python3
"""Restricted local project builder for IZAKHONO WORK.

The builder gives the local model "hands" inside one owner-controlled projects
directory. It can create folders/files, inspect its own project, and run
syntax-only validation. It cannot issue arbitrary shell commands.
"""
from __future__ import annotations

import html
import json
import os
import py_compile
import re
import shutil
import subprocess
import time
import zipfile
from pathlib import Path
from typing import Callable

MAX_FILE_BYTES = 300_000
MAX_PROJECT_BYTES = 12_000_000
MAX_ACTIONS_PER_TURN = 24
DEFAULT_MAX_TURNS = 8

TEXT_EXTENSIONS = {
    ".txt", ".md", ".html", ".htm", ".css", ".js", ".mjs", ".cjs", ".json",
    ".py", ".toml", ".yaml", ".yml", ".xml", ".svg", ".sql", ".sh", ".ps1",
    ".cmd", ".bat", ".tsx", ".ts", ".jsx",
}


class BuilderError(RuntimeError):
    pass


def safe_slug(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", (value or "").strip()).strip("-.")
    if not value:
        value = "project-" + str(int(time.time()))
    return value[:80]


def _safe_relative(value: str) -> Path:
    raw = (value or "").replace("\\", "/").strip("/")
    if not raw:
        raise BuilderError("empty_path")
    p = Path(raw)
    if p.is_absolute() or ".." in p.parts:
        raise BuilderError("path_outside_project")
    if any(part in {".git", ".izakhono"} for part in p.parts):
        raise BuilderError("reserved_path")
    return p


def _read_text(path: Path) -> str:
    if path.suffix.lower() not in TEXT_EXTENSIONS:
        raise BuilderError("unsupported_text_file")
    if not path.exists() or not path.is_file():
        raise BuilderError("file_not_found")
    if path.stat().st_size > MAX_FILE_BYTES:
        raise BuilderError("file_too_large")
    return path.read_text(encoding="utf-8", errors="replace")


def _project_size(root: Path) -> int:
    total = 0
    for p in root.rglob("*"):
        if p.is_file() and ".izakhono" not in p.parts:
            try:
                total += p.stat().st_size
            except OSError:
                pass
    return total


class WorkspaceManager:
    def __init__(self, root: Path):
        self.root = Path(root).resolve()
        self.projects = self.root / "projects"
        self.projects.mkdir(parents=True, exist_ok=True)

    def project_path(self, name: str) -> Path:
        return (self.projects / safe_slug(name)).resolve()

    def ensure_project(self, name: str, spec: str = "") -> Path:
        project = self.project_path(name)
        if project.parent != self.projects.resolve():
            raise BuilderError("invalid_project")
        project.mkdir(parents=True, exist_ok=True)
        meta = project / ".izakhono"
        (meta / "checkpoints").mkdir(parents=True, exist_ok=True)
        project_file = meta / "project.json"
        if not project_file.exists():
            project_file.write_text(json.dumps({
                "name": project.name,
                "created_at": int(time.time()),
                "initial_spec": spec[:20_000],
            }, indent=2), encoding="utf-8")
        return project

    def list_projects(self) -> list[dict]:
        items = []
        for p in sorted(self.projects.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if not p.is_dir():
                continue
            files = sum(1 for f in p.rglob("*") if f.is_file() and ".izakhono" not in f.parts)
            items.append({
                "name": p.name,
                "files": files,
                "updated_at": int(p.stat().st_mtime),
                "preview": (p / "index.html").exists(),
            })
        return items[:100]

    def tree(self, name: str, limit: int = 220) -> list[dict]:
        project = self.ensure_project(name)
        rows = []
        for p in sorted(project.rglob("*")):
            rel = p.relative_to(project)
            if ".izakhono" in rel.parts:
                continue
            rows.append({
                "path": rel.as_posix(),
                "type": "dir" if p.is_dir() else "file",
                "size": p.stat().st_size if p.is_file() else None,
            })
            if len(rows) >= limit:
                break
        return rows

    def read_file(self, name: str, rel: str) -> str:
        project = self.ensure_project(name)
        return _read_text(project / _safe_relative(rel))

    def write_file(self, name: str, rel: str, content: str) -> dict:
        data = (content or "").encode("utf-8")
        if len(data) > MAX_FILE_BYTES:
            raise BuilderError("file_too_large")
        project = self.ensure_project(name)
        path = project / _safe_relative(rel)
        path.parent.mkdir(parents=True, exist_ok=True)
        projected = _project_size(project)
        old = path.stat().st_size if path.exists() else 0
        if projected - old + len(data) > MAX_PROJECT_BYTES:
            raise BuilderError("project_size_limit")
        path.write_bytes(data)
        return {"path": path.relative_to(project).as_posix(), "bytes": len(data)}

    def make_dir(self, name: str, rel: str) -> dict:
        project = self.ensure_project(name)
        path = project / _safe_relative(rel)
        path.mkdir(parents=True, exist_ok=True)
        return {"path": path.relative_to(project).as_posix()}

    def checkpoint(self, name: str, label: str = "build") -> str:
        project = self.ensure_project(name)
        stamps = project / ".izakhono" / "checkpoints"
        stamp = time.strftime("%Y%m%d-%H%M%S")
        filename = f"{stamp}-{safe_slug(label)}.zip"
        target = stamps / filename
        with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for p in project.rglob("*"):
                if p.is_file() and ".izakhono" not in p.parts:
                    zf.write(p, p.relative_to(project).as_posix())
        return filename

    def list_checkpoints(self, name: str) -> list[str]:
        project = self.ensure_project(name)
        folder = project / ".izakhono" / "checkpoints"
        return [p.name for p in sorted(folder.glob("*.zip"), reverse=True)][:40]

    def restore_checkpoint(self, name: str, checkpoint: str) -> None:
        project = self.ensure_project(name)
        cp = project / ".izakhono" / "checkpoints" / Path(checkpoint).name
        if not cp.exists():
            raise BuilderError("checkpoint_not_found")
        for p in list(project.iterdir()):
            if p.name == ".izakhono":
                continue
            if p.is_dir():
                shutil.rmtree(p)
            else:
                p.unlink()
        with zipfile.ZipFile(cp, "r") as zf:
            for member in zf.infolist():
                _safe_relative(member.filename)
                zf.extract(member, project)


def parse_model_json(text: str) -> dict:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.I)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        obj = json.loads(raw)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        try:
            obj = json.loads(raw[start:end + 1])
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass
    raise BuilderError("builder_model_returned_invalid_json")


def _static_fallback_requested(spec: str) -> bool:
    lowered = (spec or "").lower()
    return (
        "index.html" in lowered
        or (
            ("static" in lowered or "browser" in lowered)
            and any(word in lowered for word in ("webpage", "website", "page"))
        )
    )


def _fallback_static_html(spec: str, project_name: str) -> str:
    quoted = re.findall(r'["“]([^"”]{1,240})["”]', spec or "")
    headline = quoted[0] if quoted else project_name.replace("-", " ")
    requirements = quoted[:8] or [spec[:500] or "Owner-requested static page"]
    items = "\n".join(f"<li>{html.escape(item)}</li>" for item in requirements)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{html.escape(headline)}</title>
  <style>
    :root {{ color-scheme: dark; --gold:#f4c84d; --green:#60e68b; --bg:#070907; }}
    * {{ box-sizing:border-box; }}
    body {{ margin:0; min-height:100vh; display:grid; place-items:center; background:radial-gradient(circle at top,#172117,var(--bg) 58%); color:#fff; font-family:Segoe UI,Arial,sans-serif; }}
    main {{ width:min(900px,92vw); padding:48px; border:1px solid #314332; border-radius:28px; background:#0d120ed9; box-shadow:0 30px 90px #0009; }}
    .eyebrow {{ color:var(--green); font-weight:800; letter-spacing:.14em; }}
    h1 {{ margin:.35em 0; color:var(--gold); font-size:clamp(2.4rem,7vw,5.5rem); line-height:.95; }}
    p,li {{ font-size:clamp(1rem,2vw,1.2rem); line-height:1.6; }}
    ul {{ padding-left:1.2em; color:#dfe9df; }}
    .badge {{ display:inline-block; margin-top:20px; padding:10px 14px; border-radius:999px; background:#18351f; color:#9effb6; font-weight:800; }}
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">IZAKHONO WORK · OWNER NODE</div>
    <h1>{html.escape(headline)}</h1>
    <p>Built locally inside the owner-controlled IZAKHONO WORK project workspace.</p>
    <ul>{items}</ul>
    <div class="badge">LOCAL BUILD FALLBACK · VALIDATED</div>
  </main>
</body>
</html>
"""


def validate_project(project: Path) -> list[dict]:
    results = []
    node = shutil.which("node")
    for p in sorted(project.rglob("*")):
        if not p.is_file() or ".izakhono" in p.parts:
            continue
        rel = p.relative_to(project).as_posix()
        ext = p.suffix.lower()
        if ext == ".json":
            try:
                json.loads(p.read_text(encoding="utf-8"))
                results.append({"path": rel, "check": "json", "ok": True})
            except Exception as e:
                results.append({"path": rel, "check": "json", "ok": False, "error": str(e)[:300]})
        elif ext in {".html", ".htm"}:
            try:
                text = p.read_text(encoding="utf-8", errors="replace").strip().lower()
                ok = bool(text) and ("<!doctype html" in text or "<html" in text)
                results.append({"path": rel, "check": "html_structure", "ok": ok, "error": None if ok else "missing_html_document_structure"})
            except Exception as e:
                results.append({"path": rel, "check": "html_structure", "ok": False, "error": str(e)[:300]})
        elif ext == ".py":
            try:
                py_compile.compile(str(p), doraise=True)
                results.append({"path": rel, "check": "python_syntax", "ok": True})
            except Exception as e:
                results.append({"path": rel, "check": "python_syntax", "ok": False, "error": str(e)[:300]})
        elif ext in {".js", ".mjs", ".cjs"} and node:
            try:
                proc = subprocess.run(
                    [node, "--check", str(p)],
                    cwd=str(project),
                    capture_output=True,
                    text=True,
                    timeout=15,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
                results.append({
                    "path": rel,
                    "check": "javascript_syntax",
                    "ok": proc.returncode == 0,
                    "error": (proc.stderr or proc.stdout)[:500] if proc.returncode else None,
                })
            except Exception as e:
                results.append({"path": rel, "check": "javascript_syntax", "ok": False, "error": str(e)[:300]})
    return results


BUILDER_SYSTEM = """You are IZAKHONO WORK BUILDER, a local software-building agent.
You may modify ONLY the current project workspace through the action schema below.

Return exactly one JSON object and no markdown:
{
  "summary": "short progress summary",
  "done": false,
  "actions": [
    {"type":"mkdir","path":"relative/path"},
    {"type":"write_file","path":"relative/file.ext","content":"complete file content"},
    {"type":"read_file","path":"relative/file.ext"},
    {"type":"list_tree"}
  ]
}

Rules:
- Prefer complete, dependency-light projects that run on the owner laptop.
- For browser apps, prefer HTML/CSS/vanilla JS unless a framework is genuinely needed.
- For local backends, prefer Python standard library where practical.
- Never use absolute paths, .., .git or .izakhono.
- Never ask for passwords, API keys, payment credentials or secrets.
- Never claim code was tested unless validation evidence is provided.
- Build useful files, not just plans.
- Keep each turn focused; use at most 12 actions unless necessary.
- If validation errors are supplied, repair them.
- Set done=true only when the requested deliverable is materially implemented.
"""


class BuilderEngine:
    def __init__(
        self,
        workspace: WorkspaceManager,
        model_call: Callable[[list[dict]], str],
        max_turns: int = DEFAULT_MAX_TURNS,
    ):
        self.workspace = workspace
        self.model_call = model_call
        self.max_turns = max(1, min(int(max_turns), 12))

    def _execute(self, project_name: str, action: dict) -> dict:
        kind = str(action.get("type", "")).strip()
        if kind == "mkdir":
            return {"type": kind, **self.workspace.make_dir(project_name, str(action.get("path", "")))}
        if kind == "write_file":
            return {"type": kind, **self.workspace.write_file(
                project_name,
                str(action.get("path", "")),
                str(action.get("content", "")),
            )}
        if kind == "read_file":
            path = str(action.get("path", ""))
            text = self.workspace.read_file(project_name, path)
            return {"type": kind, "path": path, "content": text[:30_000]}
        if kind == "list_tree":
            return {"type": kind, "tree": self.workspace.tree(project_name)}
        raise BuilderError("unsupported_builder_action")

    def build(self, spec: str, project_name: str | None = None) -> dict:
        spec = (spec or "").strip()
        if not spec:
            raise BuilderError("build_spec_required")
        project_name = safe_slug(project_name or spec[:55])
        project = self.workspace.ensure_project(project_name, spec)
        checkpoint_before = self.workspace.checkpoint(project_name, "before-build")

        transcript = []
        last_validation = []
        summaries = []

        for turn in range(1, self.max_turns + 1):
            tree = self.workspace.tree(project_name)
            prompt = {
                "project": project_name,
                "owner_request": spec,
                "turn": turn,
                "max_turns": self.max_turns,
                "tree": tree,
                "last_action_results": transcript[-16:],
                "validation": last_validation,
                "instruction": "Create or repair the project now. Return JSON actions only.",
            }
            model_text = self.model_call([
                {"role": "system", "content": BUILDER_SYSTEM},
                {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
            ])
            plan = parse_model_json(model_text)
            summaries.append(str(plan.get("summary", ""))[:500])
            actions = plan.get("actions", [])
            if not isinstance(actions, list):
                raise BuilderError("builder_actions_not_list")

            turn_results = []
            for action in actions[:MAX_ACTIONS_PER_TURN]:
                if not isinstance(action, dict):
                    continue
                try:
                    result = self._execute(project_name, action)
                    result["ok"] = True
                except Exception as e:
                    result = {
                        "type": str(action.get("type", "")),
                        "path": str(action.get("path", "")),
                        "ok": False,
                        "error": str(e)[:300],
                    }
                turn_results.append(result)
            transcript.extend(turn_results)

            last_validation = validate_project(project)
            failures = [x for x in last_validation if not x.get("ok")]
            has_files = any(p.is_file() and ".izakhono" not in p.parts for p in project.rglob("*"))
            if bool(plan.get("done")) and has_files and not failures:
                break

        fallback_used = False
        has_files = any(
            p.is_file() and ".izakhono" not in p.parts
            for p in project.rglob("*")
        )
        if not has_files:
            if _static_fallback_requested(spec):
                fallback = _fallback_static_html(spec, project_name)
                self.workspace.write_file(project_name, "index.html", fallback)
                transcript.append({
                    "type": "write_file",
                    "path": "index.html",
                    "ok": True,
                    "fallback": True,
                })
                summaries.append("Created a deterministic local static-page fallback after the model returned no files.")
                fallback_used = True
            else:
                raise BuilderError("builder_completed_without_files")

        final_validation = validate_project(project)
        checkpoint_after = self.workspace.checkpoint(project_name, "after-build")
        failed = [x for x in final_validation if not x.get("ok")]
        files = self.workspace.tree(project_name)

        return {
            "project": project_name,
            "summary": next((s for s in reversed(summaries) if s), "Build completed."),
            "files": files,
            "validation": final_validation,
            "validation_ok": not failed,
            "preview_url": f"/preview/{project_name}/" if (project / "index.html").exists() else None,
            "checkpoint_before": checkpoint_before,
            "checkpoint_after": checkpoint_after,
            "turns": min(len(summaries), self.max_turns),
            "action_count": len(transcript),
            "fallback_used": fallback_used,
        }

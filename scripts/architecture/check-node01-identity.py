#!/usr/bin/env python3
"""Enforce the IZAKHONO NODE01 software-identity invariant."""
from __future__ import annotations
import json, re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
STANDARD=ROOT/"architecture"/"NODE01-IDENTITY-STANDARD.md"
SKIP_DIRS={".git",".next","node_modules","dist","build","coverage",".venv","venv"}
TEXT_SUFFIXES={".json",".yaml",".yml",".toml",".ini",".cfg",".conf",".env",".sh",".bash",".ps1",".cmd",".bat",".service",".md",".txt",".py",".js",".ts",".tsx",".jsx",".go",".rs",".tf"}
FORBIDDEN=[
(re.compile(r"\bNODE01\s+(?:physical\s+)?(?:server|machine|computer|laptop|hardware|VM|virtual\s+machine)\b",re.I),"NODE01 is described as physical/virtual infrastructure"),
(re.compile(r"\b(?:server|machine|computer|laptop|hardware|VM|virtual\s+machine)\s+(?:named|called|known\s+as)\s+NODE01\b",re.I),"Infrastructure is assigned NODE01 identity"),
(re.compile(r"\b(?:hostname|host_name|server_name|machine_name)\s*[:=]\s*['\"]?NODE01\b",re.I),"NODE01 is used as a hostname or infrastructure name"),
(re.compile(r"\b(?:runtime_host|physical_host|execution_host)\s*[:=]\s*['\"]?NODE01\b",re.I),"Execution locator is conflated with NODE01 identity")]
def fail(message):
 print(f"NODE01 ARCHITECTURE GATE: FAIL: {message}"); sys.exit(1)
if not STANDARD.is_file(): fail("missing architecture/NODE01-IDENTITY-STANDARD.md")
if "**NODE01 IS SOFTWARE. NODE01 IS NOT PHYSICAL INFRASTRUCTURE.**" not in STANDARD.read_text(encoding="utf-8"): fail("canonical declaration missing or altered")
errors=[]; scanned=0
for path in ROOT.rglob("*"):
 if not path.is_file() or any(part in SKIP_DIRS for part in path.parts): continue
 if path.resolve()==STANDARD.resolve() or path.suffix.lower() not in TEXT_SUFFIXES or path.stat().st_size>2_000_000: continue
 try: content=path.read_text(encoding="utf-8")
 except (UnicodeDecodeError,OSError): continue
 scanned+=1
 if path.suffix.lower()==".json":
  try: data=json.loads(content)
  except json.JSONDecodeError: data=None
  if isinstance(data,dict) and data.get("logical_node_id")=="NODE01":
   if data.get("identity_type")!="software-runtime": errors.append(f"{path.relative_to(ROOT)}: identity_type must be software-runtime")
   if data.get("runtime_host_is_separate") is not True: errors.append(f"{path.relative_to(ROOT)}: runtime_host_is_separate must be true")
   if data.get("schema")=="izakhono.runtime-binding/v1":
    host=data.get("runtime_host")
    if not isinstance(host,str) or not host.strip(): errors.append(f"{path.relative_to(ROOT)}: runtime_host must identify a separate execution environment")
    if host in {"NODE01","node01"}: errors.append(f"{path.relative_to(ROOT)}: runtime_host must never equal the NODE01 software identity")
    if data.get("live") is True and host in {"APPROVED_RUNTIME_HOST","REPLACE_WITH_VERIFIED_HOST"}: errors.append(f"{path.relative_to(ROOT)}: live binding cannot use an unapproved runtime-host placeholder")
    if data.get("live") is True and not all(data.get(k) is True for k in ("health_verified","https_verified","acceptance_verified")): errors.append(f"{path.relative_to(ROOT)}: live binding requires health, HTTPS, and acceptance verification")
 for pattern,reason in FORBIDDEN:
  for match in pattern.finditer(content): errors.append(f"{path.relative_to(ROOT)}:{content.count(chr(10),0,match.start())+1}: {reason}")
if errors:
 for error in errors: print("NODE01 ARCHITECTURE GATE: "+error)
 fail(f"{len(errors)} violation(s) found across {scanned} text files")
print(f"NODE01 ARCHITECTURE GATE: PASS — standard present; {scanned} text files scanned; no violations.")

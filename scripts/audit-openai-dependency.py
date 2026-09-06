#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
SCAN=[ROOT/"products",ROOT/"src",ROOT/"package.json",ROOT/"package-lock.json"]
FORBIDDEN=[
    "api.openai.com",
    "platform.openai.com",
    "OPENAI_API_KEY",
    "from openai import",
    "import openai",
    "\"openai\":",
    "'openai':",
]
ALLOW_TEXT_FILES={".md",".txt"}

hits=[]
for target in SCAN:
    if not target.exists():
        continue
    files=[target] if target.is_file() else [p for p in target.rglob("*") if p.is_file()]
    for path in files:
        if any(part in {".git","node_modules","dist","build"} for part in path.parts):
            continue
        try:
            text=path.read_text(encoding="utf-8")
        except Exception:
            continue
        for needle in FORBIDDEN:
            if needle.lower() in text.lower():
                hits.append((path.relative_to(ROOT),needle))

if hits:
    for path,needle in hits:
        print(f"FORBIDDEN_OPENAI_DEPENDENCY {path}: {needle}")
    sys.exit(1)

print("OPENAI_DEPENDENCY_AUDIT=PASS")

#!/usr/bin/env python3
"""Local IZAKHONO OS domain engine. No network clients, telemetry or shell dispatch."""
from __future__ import annotations

import configparser
import json
import os
import platform
import socket
import stat
import time
from pathlib import Path
from typing import Any

ALLOWED_ACTIONS = {
    "system.status",
    "apps.list",
    "privacy.status",
    "migration.preview",
    "updates.status",
    "help.topics",
}
MIGRATION_FOLDERS = ("Documents", "Pictures", "Music", "Videos", "Desktop", "Downloads")


class IzakhonoOsEngine:
    def __init__(
        self,
        home_dir: str | Path | None = None,
        applications_dirs: tuple[str | Path, ...] | None = None,
        privacy_policy_path: str | Path = "/etc/firefox-esr/distribution/policies.json",
        os_release_path: str | Path = "/etc/os-release",
        uptime_path: str | Path = "/proc/uptime",
        apt_lists_path: str | Path = "/var/lib/apt/lists",
    ) -> None:
        self.home_dir = Path(home_dir or os.environ.get("HOME", "/home/izakhono")).expanduser().resolve()
        self.applications_dirs = tuple(
            Path(p) for p in (applications_dirs or (
                "/usr/share/applications",
                str(self.home_dir / ".local/share/applications"),
            ))
        )
        self.privacy_policy_path = Path(privacy_policy_path)
        self.os_release_path = Path(os_release_path)
        self.uptime_path = Path(uptime_path)
        self.apt_lists_path = Path(apt_lists_path)

    def dispatch(self, request: Any) -> dict[str, Any]:
        if not isinstance(request, dict):
            raise ValueError("request must be a JSON object")
        action = request.get("action")
        params = request.get("params", {})
        if action not in ALLOWED_ACTIONS:
            raise ValueError("action is not allow-listed")
        if not isinstance(params, dict):
            raise ValueError("params must be a JSON object")
        handler = {
            "system.status": self.system_status,
            "apps.list": self.apps_list,
            "privacy.status": self.privacy_status,
            "migration.preview": self.migration_preview,
            "updates.status": self.updates_status,
            "help.topics": self.help_topics,
        }[action]
        return {"ok": True, "action": action, "result": handler(params)}

    def system_status(self, _params: dict[str, Any]) -> dict[str, Any]:
        release: dict[str, str] = {}
        try:
            for line in self.os_release_path.read_text(encoding="utf-8").splitlines():
                if "=" in line:
                    key, value = line.split("=", 1)
                    release[key] = value.strip().strip('"')
        except OSError:
            pass
        uptime = None
        try:
            uptime = float(self.uptime_path.read_text(encoding="ascii").split()[0])
        except (OSError, ValueError, IndexError):
            pass
        return {
            "product": "IZAKHONO OS",
            "release": release.get("PRETTY_NAME", "unknown"),
            "architecture": platform.machine(),
            "uptime_seconds": uptime,
            "control_mode": "local-only",
        }

    def apps_list(self, _params: dict[str, Any]) -> dict[str, Any]:
        apps: dict[str, dict[str, str]] = {}
        for directory in self.applications_dirs:
            if not directory.is_dir():
                continue
            for path in sorted(directory.glob("*.desktop")):
                parser = configparser.ConfigParser(interpolation=None)
                try:
                    parser.read(path, encoding="utf-8")
                    entry = parser["Desktop Entry"]
                    if entry.get("NoDisplay", "false").lower() == "true":
                        continue
                    name = entry.get("Name", "").strip()
                    if not name:
                        continue
                    apps[path.name] = {
                        "name": name,
                        "category": entry.get("Categories", "").strip(),
                    }
                except (OSError, KeyError, configparser.Error):
                    continue
        return {"items": list(apps.values()), "count": len(apps)}

    def privacy_status(self, _params: dict[str, Any]) -> dict[str, Any]:
        policy: dict[str, Any] = {}
        try:
            raw = json.loads(self.privacy_policy_path.read_text(encoding="utf-8"))
            policy = raw.get("policies", {}) if isinstance(raw, dict) else {}
        except (OSError, json.JSONDecodeError):
            pass
        telemetry_disabled = policy.get("DisableTelemetry") is True
        studies_disabled = policy.get("DisableFirefoxStudies") is True
        return {
            "behavioural_tracking": False,
            "firefox_telemetry_disabled_by_policy": telemetry_disabled,
            "firefox_studies_disabled_by_policy": studies_disabled,
            "policy_status": "verified" if telemetry_disabled and studies_disabled else "not_verified",
            "scope": "IZAKHONO-controlled defaults only; third-party websites, ISPs and independently installed apps are outside this check",
        }

    def migration_preview(self, params: dict[str, Any]) -> dict[str, Any]:
        requested = params.get("folders", list(MIGRATION_FOLDERS))
        if not isinstance(requested, list) or any(name not in MIGRATION_FOLDERS for name in requested):
            raise ValueError("only standard user folders may be previewed")
        results = []
        for name in requested:
            root = (self.home_dir / name).resolve()
            if root.parent != self.home_dir or not root.exists() or not root.is_dir() or root.is_symlink():
                results.append({"folder": name, "exists": False, "files": 0, "bytes": 0})
                continue
            count = 0
            total = 0
            stack = [root]
            while stack and count < 10000:
                current = stack.pop()
                try:
                    with os.scandir(current) as entries:
                        for entry in entries:
                            try:
                                if entry.is_symlink():
                                    continue
                                if entry.is_dir(follow_symlinks=False):
                                    stack.append(Path(entry.path))
                                elif entry.is_file(follow_symlinks=False):
                                    count += 1
                                    total += entry.stat(follow_symlinks=False).st_size
                                    if count >= 10000:
                                        break
                            except OSError:
                                continue
                except OSError:
                    continue
            results.append({"folder": name, "exists": True, "files": count, "bytes": total, "capped": count >= 10000})
        return {
            "mode": "preview-only",
            "source_files_modified": False,
            "copy_performed": False,
            "folders": results,
        }

    def updates_status(self, _params: dict[str, Any]) -> dict[str, Any]:
        exists = self.apt_lists_path.is_dir()
        return {
            "status": "not_checked",
            "local_package_index_present": exists,
            "network_access_performed": False,
            "installation_performed": False,
            "next_step": "user_initiated_update_from_the_Updates_center",
        }

    def help_topics(self, _params: dict[str, Any]) -> dict[str, Any]:
        return {
            "topics": [
                "connect_to_wifi",
                "find_my_files",
                "install_apps",
                "change_settings",
                "check_updates",
                "protect_my_privacy",
                "preview_file_migration",
                "recover_my_system",
            ]
        }

#!/usr/bin/env python3
"""Fail-closed validation for encrypted IZAKHONO MAIL backup tar archives."""
from __future__ import annotations

import sys
import tarfile
from pathlib import PurePosixPath

ALLOWED_ROOTS = {"stalwart-etc", "stalwart-data", "roundcube-db"}


def validate_archive(path: str) -> None:
    with tarfile.open(path, "r:gz") as archive:
        members = archive.getmembers()
        if not members:
            raise ValueError("empty backup archive")
        roots: set[str] = set()
        for member in members:
            name = member.name.rstrip("/")
            parts = name.split("/")
            if (not name or name.startswith("/") or "\\" in name
                    or any(part in {"", ".", ".."} for part in parts)
                    or PurePosixPath(name).is_absolute()):
                raise ValueError(f"unsafe archive path: {member.name!r}")
            if parts[0] not in ALLOWED_ROOTS:
                raise ValueError(f"unexpected archive component: {member.name!r}")
            if not (member.isdir() or member.isfile()):
                raise ValueError(f"non-regular archive entry: {member.name!r}")
            roots.add(parts[0])
        if roots != ALLOWED_ROOTS:
            raise ValueError(f"incomplete backup components: {sorted(roots)}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: validate_backup_archive.py ARCHIVE.tar.gz")
    try:
        validate_archive(sys.argv[1])
    except (OSError, tarfile.TarError, ValueError) as error:
        raise SystemExit(f"BLOCKED: {error}") from error
    print("ARCHIVE_VALIDATION: PASS")

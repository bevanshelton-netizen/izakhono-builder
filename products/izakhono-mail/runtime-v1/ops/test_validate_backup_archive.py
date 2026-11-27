#!/usr/bin/env python3
from __future__ import annotations

import io
import tarfile
import tempfile
import unittest
from pathlib import Path

from validate_backup_archive import validate_archive


class BackupArchiveValidationTests(unittest.TestCase):
    def make_archive(self, entries: list[tuple[str, bytes | None, str]]) -> str:
        temp = tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False)
        temp.close()
        with tarfile.open(temp.name, "w:gz") as archive:
            for name, data, kind in entries:
                info = tarfile.TarInfo(name)
                if kind == "dir":
                    info.type = tarfile.DIRTYPE
                    archive.addfile(info)
                elif kind == "symlink":
                    info.type = tarfile.SYMTYPE
                    info.linkname = "/etc/passwd"
                    archive.addfile(info)
                else:
                    payload = data or b""
                    info.size = len(payload)
                    archive.addfile(info, io.BytesIO(payload))
        return temp.name

    def test_accepts_complete_backup(self) -> None:
        path = self.make_archive([
            ("stalwart-etc/config.toml", b"config", "file"),
            ("stalwart-data/mail.db", b"mail", "file"),
            ("roundcube-db/roundcube.sql", b"db", "file"),
        ])
        validate_archive(path)

    def test_rejects_path_traversal(self) -> None:
        path = self.make_archive([
            ("stalwart-etc/../../etc/passwd", b"x", "file"),
            ("stalwart-data/mail.db", b"x", "file"),
            ("roundcube-db/db.sql", b"x", "file"),
        ])
        with self.assertRaisesRegex(ValueError, "unsafe archive path"):
            validate_archive(path)

    def test_rejects_unexpected_root(self) -> None:
        path = self.make_archive([
            ("stalwart-etc/config", b"x", "file"),
            ("stalwart-data/mail", b"x", "file"),
            ("roundcube-db/db", b"x", "file"),
            ("etc/shadow", b"x", "file"),
        ])
        with self.assertRaisesRegex(ValueError, "unexpected archive component"):
            validate_archive(path)

    def test_rejects_symlink(self) -> None:
        path = self.make_archive([
            ("stalwart-etc/link", None, "symlink"),
            ("stalwart-data/mail", b"x", "file"),
            ("roundcube-db/db", b"x", "file"),
        ])
        with self.assertRaisesRegex(ValueError, "non-regular archive entry"):
            validate_archive(path)

    def test_rejects_incomplete_backup(self) -> None:
        path = self.make_archive([
            ("stalwart-etc/config", b"x", "file"),
            ("stalwart-data/mail", b"x", "file"),
        ])
        with self.assertRaisesRegex(ValueError, "incomplete backup components"):
            validate_archive(path)


if __name__ == "__main__":
    unittest.main()

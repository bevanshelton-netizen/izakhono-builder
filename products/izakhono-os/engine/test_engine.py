import json
import tempfile
import unittest
from pathlib import Path

from engine import IzakhonoOsEngine


class OsEngineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.home = self.root / "home"
        self.home.mkdir()
        self.apps = self.root / "apps"
        self.apps.mkdir()
        self.policy = self.root / "policies.json"
        self.policy.write_text(json.dumps({"policies": {"DisableTelemetry": True, "DisableFirefoxStudies": True}}))
        self.release = self.root / "os-release"
        self.release.write_text('PRETTY_NAME="IZAKHONO OS Test"\n')
        self.uptime = self.root / "uptime"
        self.uptime.write_text("123.45 0.00")
        self.apt = self.root / "apt-lists"
        self.apt.mkdir()
        self.engine = IzakhonoOsEngine(
            home_dir=self.home,
            applications_dirs=(self.apps,),
            privacy_policy_path=self.policy,
            os_release_path=self.release,
            uptime_path=self.uptime,
            apt_lists_path=self.apt,
        )

    def tearDown(self):
        self.temp.cleanup()

    def test_allowlisted_system_status(self):
        result = self.engine.dispatch({"action": "system.status"})["result"]
        self.assertEqual(result["product"], "IZAKHONO OS")
        self.assertEqual(result["release"], "IZAKHONO OS Test")

    def test_privacy_status_reads_explicit_policy(self):
        result = self.engine.dispatch({"action": "privacy.status"})["result"]
        self.assertEqual(result["policy_status"], "verified")
        self.assertFalse(result["behavioural_tracking"])

    def test_apps_list_never_exposes_exec_command(self):
        (self.apps / "test.desktop").write_text(
            "[Desktop Entry]\nType=Application\nName=Safe App\nExec=unsafe-command --arg\nCategories=Utility;\n"
        )
        items = self.engine.dispatch({"action": "apps.list"})["result"]["items"]
        self.assertEqual(items[0]["name"], "Safe App")
        self.assertNotIn("exec", items[0])

    def test_migration_is_preview_only_and_does_not_follow_symlinks(self):
        docs = self.home / "Documents"
        docs.mkdir()
        (docs / "note.txt").write_text("hello")
        outside = self.root / "outside.txt"
        outside.write_text("do not follow")
        (docs / "linked.txt").symlink_to(outside)
        result = self.engine.dispatch({"action": "migration.preview", "params": {"folders": ["Documents"]}})["result"]
        self.assertFalse(result["copy_performed"])
        self.assertFalse(result["source_files_modified"])
        self.assertEqual(result["folders"][0]["files"], 1)
        self.assertEqual(outside.read_text(), "do not follow")

    def test_updates_do_not_access_network_or_install(self):
        result = self.engine.dispatch({"action": "updates.status"})["result"]
        self.assertFalse(result["network_access_performed"])
        self.assertFalse(result["installation_performed"])

    def test_arbitrary_shell_action_is_rejected(self):
        with self.assertRaises(ValueError):
            self.engine.dispatch({"action": "shell.exec", "params": {"command": "id"}})

    def test_only_standard_migration_folders_are_allowed(self):
        with self.assertRaises(ValueError):
            self.engine.dispatch({"action": "migration.preview", "params": {"folders": ["../../etc"]}})


if __name__ == "__main__":
    unittest.main()

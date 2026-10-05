#!/usr/bin/env python3
import os
import unittest

from node_fabric import FabricNode, NodeFabric


class NodeFabricTests(unittest.TestCase):
    def test_primary_is_preferred_when_healthy(self):
        fabric = NodeFabric([
            FabricNode("node01", "http://node01", "S1", role="primary"),
            FabricNode("node02", "http://node02", "S2", role="worker"),
        ])
        fabric._health = {
            "node01": {"node_id": "node01", "ok": True, "checked_at": 1},
            "node02": {"node_id": "node02", "ok": True, "checked_at": 1},
        }
        fabric.refresh = lambda: list(fabric._health.values())
        self.assertEqual(fabric.choose().node_id, "node01")

    def test_fails_over_to_secondary(self):
        fabric = NodeFabric([
            FabricNode("node01", "http://node01", "S1", role="primary"),
            FabricNode("node02", "http://node02", "S2", role="worker"),
        ])
        fabric._health = {
            "node01": {"node_id": "node01", "ok": False, "checked_at": 1},
            "node02": {"node_id": "node02", "ok": True, "checked_at": 1},
        }
        fabric.refresh = lambda: list(fabric._health.values())
        self.assertEqual(fabric.choose().node_id, "node02")

    def test_preferred_unhealthy_node_is_not_selected(self):
        fabric = NodeFabric([
            FabricNode("node01", "http://node01", "S1", role="primary"),
            FabricNode("node02", "http://node02", "S2", role="worker"),
        ])
        fabric._health = {
            "node01": {"node_id": "node01", "ok": False, "checked_at": 1},
            "node02": {"node_id": "node02", "ok": True, "checked_at": 1},
        }
        fabric.refresh = lambda: list(fabric._health.values())
        self.assertEqual(fabric.choose("node01").node_id, "node02")

    def test_no_healthy_node_is_explicit(self):
        fabric = NodeFabric([FabricNode("node01", "http://node01", "S1")])
        fabric._health = {"node01": {"node_id": "node01", "ok": False, "checked_at": 1}}
        fabric.refresh = lambda: list(fabric._health.values())
        with self.assertRaisesRegex(RuntimeError, "no_healthy_node"):
            fabric.choose()

    def test_legacy_single_node_configuration(self):
        old_url = os.environ.get("IZAKHONO_NODE_URL")
        old_id = os.environ.get("IZAKHONO_NODE_ID")
        try:
            os.environ["IZAKHONO_NODE_URL"] = "http://localhost:9191"
            os.environ["IZAKHONO_NODE_ID"] = "node01"
            node = NodeFabric._from_env()[0]
            self.assertEqual(node.node_id, "node01")
            self.assertEqual(node.url, "http://localhost:9191")
        finally:
            if old_url is None:
                os.environ.pop("IZAKHONO_NODE_URL", None)
            else:
                os.environ["IZAKHONO_NODE_URL"] = old_url
            if old_id is None:
                os.environ.pop("IZAKHONO_NODE_ID", None)
            else:
                os.environ["IZAKHONO_NODE_ID"] = old_id


if __name__ == "__main__":
    unittest.main()

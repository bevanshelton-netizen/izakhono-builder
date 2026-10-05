#!/usr/bin/env python3
"""Portable NODE pool and failover primitives for IZAKHONO CONTROL.

NODE IDs are logical roles. A physical host can assume any node ID by setting
IZAKHONO_NODE_ID at bootstrap time. This module deliberately keeps secrets in
environment variables and never serializes them into status responses.
"""
from __future__ import annotations

import json
import os
import time
import urllib.request
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class FabricNode:
    node_id: str
    url: str
    secret_env: str
    role: str = "worker"
    weight: int = 100


class NodeFabric:
    def __init__(self, nodes: list[FabricNode] | None = None, ttl: int = 45):
        self.ttl = max(5, ttl)
        self.nodes = nodes or self._from_env()
        self._health: dict[str, dict[str, Any]] = {}

    @staticmethod
    def _from_env() -> list[FabricNode]:
        raw = os.getenv("IZAKHONO_NODE_FABRIC", "")
        if raw:
            data = json.loads(raw)
            result = []
            for item in data:
                result.append(FabricNode(
                    node_id=str(item["id"]),
                    url=str(item["url"]).rstrip("/"),
                    secret_env=str(item.get("secret_env") or f"IZAKHONO_NODE_{str(item['id']).upper()}_SECRET"),
                    role=str(item.get("role", "worker")),
                    weight=int(item.get("weight", 100)),
                ))
            return result

        # Backward-compatible single-node configuration.
        url = os.getenv("IZAKHONO_NODE_URL", "http://127.0.0.1:9191").rstrip("/")
        return [FabricNode(
            node_id=os.getenv("IZAKHONO_NODE_ID", "node01"),
            url=url,
            secret_env="IZAKHONO_NODE_SECRET",
            role="primary",
        )]

    @staticmethod
    def _headers(secret: str) -> dict[str, str]:
        # Health is intentionally unauthenticated by default on the node agent.
        # A configured secret is still passed so hardened nodes may authenticate.
        return {"X-IZAKHONO-Node-Key": secret} if secret else {}

    def _probe(self, node: FabricNode) -> dict[str, Any]:
        started = time.monotonic()
        try:
            req = urllib.request.Request(
                node.url + "/v1/node", method="GET",
                headers=self._headers(os.getenv(node.secret_env, "")),
            )
            with urllib.request.urlopen(req, timeout=3) as response:
                payload = json.loads(response.read())
                if response.status != 200:
                    raise RuntimeError(f"http_{response.status}")
            return {
                "node_id": node.node_id,
                "ok": True,
                "role": node.role,
                "weight": node.weight,
                "latency_ms": round((time.monotonic() - started) * 1000, 2),
                "node": self._safe_node(payload),
                "checked_at": int(time.time()),
            }
        except Exception as exc:
            return {
                "node_id": node.node_id,
                "ok": False,
                "role": node.role,
                "weight": node.weight,
                "error": type(exc).__name__,
                "checked_at": int(time.time()),
            }

    @staticmethod
    def _safe_node(payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict):
            return {}
        allowed = ("node_id", "version", "capabilities", "environment", "status")
        return {key: payload[key] for key in allowed if key in payload}

    def refresh(self) -> list[dict[str, Any]]:
        statuses = [self._probe(node) for node in self.nodes]
        self._health = {item["node_id"]: item for item in statuses}
        return statuses

    def snapshot(self) -> dict[str, Any]:
        now = int(time.time())
        if not self._health or any(now - int(v.get("checked_at", 0)) > self.ttl for v in self._health.values()):
            self.refresh()
        return {
            "ok": any(v.get("ok") for v in self._health.values()),
            "ttl_seconds": self.ttl,
            "nodes": [self._health[n.node_id] for n in self.nodes if n.node_id in self._health],
        }

    def choose(self, preferred: str | None = None) -> FabricNode:
        self.refresh()
        healthy = [n for n in self.nodes if self._health.get(n.node_id, {}).get("ok")]
        if preferred:
            for node in healthy:
                if node.node_id == preferred:
                    return node
        if not healthy:
            raise RuntimeError("no_healthy_node")
        # Primary first, then higher weight, then stable node id.
        healthy.sort(key=lambda n: (0 if n.role == "primary" else 1, -n.weight, n.node_id))
        return healthy[0]

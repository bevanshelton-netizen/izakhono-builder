#!/usr/bin/env python3
"""Small, dependency-free Contabo compute adapter for Runtime Fabric.

The adapter owns API mechanics only. It does not decide whether a node may
receive production traffic and never treats a successful API response as
LIVE_VERIFIED evidence.
"""
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Mapping

AUTH_URL = "https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token"
API_URL = "https://api.contabo.com/v1"


@dataclass(frozen=True)
class ContaboConfig:
    client_id: str
    client_secret: str
    username: str
    password: str
    api_url: str = API_URL
    auth_url: str = AUTH_URL

    @classmethod
    def from_env(cls) -> "ContaboConfig":
        values = {
            "client_id": os.getenv("CONTABO_CLIENT_ID", ""),
            "client_secret": os.getenv("CONTABO_CLIENT_SECRET", ""),
            "username": os.getenv("CONTABO_API_USER", ""),
            "password": os.getenv("CONTABO_API_PASSWORD", ""),
        }
        missing = [key for key, value in values.items() if not value]
        if missing:
            raise ValueError("Missing Contabo credentials: " + ", ".join(missing))
        return cls(**values)


class ContaboComputeClient:
    def __init__(self, config: ContaboConfig):
        self.config = config
        self._token: str | None = None

    def _request(self, url: str, data: bytes, headers: Mapping[str, str]) -> dict:
        request = urllib.request.Request(url, data=data, headers=dict(headers), method="POST")
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read().decode("utf-8")
        return json.loads(payload)

    def authenticate(self) -> str:
        form = urllib.parse.urlencode({
            "client_id": self.config.client_id,
            "client_secret": self.config.client_secret,
            "username": self.config.username,
            "password": self.config.password,
            "grant_type": "password",
        }).encode()
        result = self._request(
            self.config.auth_url,
            form,
            {"Content-Type": "application/x-www-form-urlencoded"},
        )
        token = result.get("access_token")
        if not token:
            raise RuntimeError("Contabo authentication returned no access token")
        self._token = token
        return token

    def create_instance(self, *, image_id: str, product_id: str, region: str,
                        ssh_key_ids: list[int], display_name: str,
                        user_data: str, period: int = 1) -> dict:
        if not self._token:
            self.authenticate()
        payload = json.dumps({
            "imageId": image_id,
            "productId": product_id,
            "region": region,
            "sshKeys": ssh_key_ids,
            "displayName": display_name,
            "userData": user_data,
            "period": period,
            "defaultUser": "admin",
        }).encode()
        request = urllib.request.Request(
            f"{self.config.api_url}/compute/instances",
            data=payload,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))

    @staticmethod
    def instance_summary(response: Mapping) -> list[dict]:
        return [
            {
                "instanceId": item.get("instanceId"),
                "name": item.get("name"),
                "displayName": item.get("displayName"),
                "productId": item.get("productId"),
                "region": item.get("region"),
                "status": item.get("status"),
            }
            for item in response.get("data", [])
        ]

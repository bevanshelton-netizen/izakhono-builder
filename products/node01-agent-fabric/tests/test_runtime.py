import asyncio
import unittest

from node01.adapters import AdapterRegistry
from node01.runtime import Runtime


class HealthyAdapter:
    name = "local"

    async def health(self):
        return {"status": "healthy"}


class RuntimeTests(unittest.TestCase):
    def test_completed_task_has_receipt(self):
        async def handler(payload):
            return {"echo": payload["value"]}

        async def scenario():
            runtime = Runtime({"echo": handler})
            task_id = runtime.submit("echo", {"value": 42})
            receipt = await runtime.run_once()
            return task_id, receipt

        task_id, receipt = asyncio.run(scenario())
        self.assertEqual(receipt.task_id, task_id)
        self.assertEqual(receipt.status, "completed")
        self.assertEqual(receipt.result["echo"], 42)
        self.assertEqual(len(receipt.evidence_sha256), 64)

    def test_missing_handler_fails_closed(self):
        async def scenario():
            runtime = Runtime()
            runtime.submit("missing", {})
            return await runtime.run_once()

        receipt = asyncio.run(scenario())
        self.assertEqual(receipt.status, "failed")
        self.assertEqual(receipt.result["error"], "KeyError")

    def test_adapter_health(self):
        async def scenario():
            registry = AdapterRegistry({})
            registry.register(HealthyAdapter())
            return await registry.health()

        health = asyncio.run(scenario())
        self.assertEqual(health["local"]["status"], "healthy")


if __name__ == "__main__":
    unittest.main()

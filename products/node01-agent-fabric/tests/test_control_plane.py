import asyncio
import unittest

from node01.control_plane import Node01ControlPlane


class ControlPlaneTests(unittest.TestCase):
    def test_routes_ai_and_provision_events(self):
        async def scenario():
            cp = Node01ControlPlane()
            await cp.submit("ai.complete", {"prompt": "hello", "context": {"x": 1}})
            await cp.submit("provision.plan", {"domain": "example.invalid"})
            first = await cp.dispatch_once()
            second = await cp.dispatch_once()
            return cp, first, second

        cp, first, second = asyncio.run(scenario())
        self.assertEqual(first["result"]["mode"], "deterministic")
        self.assertEqual(second["result"]["status"], "plan_ready")
        self.assertTrue(second["result"]["owned_first"])
        self.assertEqual(len(cp.observer.events), 4)

    def test_mail_is_draft_only(self):
        async def scenario():
            cp = Node01ControlPlane()
            await cp.submit("mail.draft", {"recipient": "owner@example.invalid", "subject": "Test", "body": "Review me"})
            return await cp.dispatch_once()

        result = asyncio.run(scenario())
        self.assertEqual(result["result"]["status"], "draft")


if __name__ == "__main__":
    unittest.main()

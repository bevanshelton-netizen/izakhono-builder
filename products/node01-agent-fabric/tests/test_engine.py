import asyncio
import unittest

from node01.engine import Orchestrator
from node01.models import Risk, Task, TaskStatus
from node01.policy import Policy


class EngineTests(unittest.TestCase):
    def test_parallel_branches_complete(self):
        tasks = [
            Task("scope", "scope", "x", "product.strategy"),
            Task("a", "a", "x", "research.web", ["scope"]),
            Task("b", "b", "x", "security.audit", ["scope"]),
            Task("join", "join", "x", "review.evidence", ["a", "b"]),
        ]
        receipt = asyncio.run(Orchestrator().run("x", tasks))
        self.assertEqual(receipt.status, "completed")
        self.assertTrue(receipt.receipt_hash)
        self.assertEqual([r.status for r in receipt.tasks], [TaskStatus.COMPLETED] * 4)

    def test_destructive_is_blocked(self):
        decision = Policy().evaluate(Task("danger", "danger", "x", "review.evidence", risk=Risk.DESTRUCTIVE))
        self.assertFalse(decision.allowed)

    def test_external_requires_approval(self):
        decision = Policy().evaluate(Task("external", "external", "x", "review.evidence", risk=Risk.EXTERNAL))
        self.assertTrue(decision.allowed)
        self.assertTrue(decision.approval_required)


if __name__ == "__main__":
    unittest.main()

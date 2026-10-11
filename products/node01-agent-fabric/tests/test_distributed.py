import unittest

from node01.distributed import DistributedCoordinator, WorkerState


class DistributedTests(unittest.TestCase):
    def test_routes_capability_to_healthy_worker(self):
        coordinator = DistributedCoordinator()
        worker = coordinator.register({"research.web"}, max_concurrency=2)
        item = coordinator.submit("research.web", {"query": "sports"}, "job-1")
        claimed = coordinator.claim(worker.worker_id)
        self.assertEqual(claimed.task_id, item.task_id)
        receipt = coordinator.complete(worker.worker_id, item, {"ok": True})
        self.assertEqual(receipt.status, "completed")
        self.assertEqual(coordinator.snapshot()["workers"][worker.worker_id]["state"], WorkerState.READY.value)

    def test_duplicate_idempotency_key_is_rejected(self):
        coordinator = DistributedCoordinator()
        coordinator.submit("research.web", {"query": "x"}, "same")
        with self.assertRaises(ValueError):
            coordinator.submit("research.web", {"query": "y"}, "same")

    def test_unhealthy_worker_is_reaped(self):
        coordinator = DistributedCoordinator(heartbeat_timeout=0)
        worker = coordinator.register({"research.web"})
        stale = coordinator.reap_unhealthy()
        self.assertIn(worker.worker_id, stale)
        self.assertEqual(coordinator.snapshot()["workers"][worker.worker_id]["state"], WorkerState.OFFLINE.value)

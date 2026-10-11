from node01.recovery import RecoveryEngine, TaskState


def test_stale_worker_requeues_task():
    engine = RecoveryEngine(heartbeat_timeout=10, lease_seconds=30)
    worker = engine.register_worker({"research"})
    task = engine.submit("research", {"q": "sports"}, max_attempts=2)
    assert engine.claim(worker, task, now=100)
    engine.workers[worker].heartbeat_at = 80
    assert engine.recover(now=100) == [task]
    assert engine.tasks[task].state == TaskState.PENDING
    assert engine.tasks[task].attempts == 1


def test_failed_task_enters_dead_letter_after_limit():
    engine = RecoveryEngine()
    worker = engine.register_worker({"build"})
    task = engine.submit("build", {}, max_attempts=1)
    assert engine.claim(worker, task)
    engine.fail(worker, task, "adapter unavailable")
    assert engine.tasks[task].state == TaskState.DEAD_LETTER
    assert task in engine.dead_letters


def test_completion_requires_ownership():
    engine = RecoveryEngine()
    worker = engine.register_worker({"mail"})
    other = engine.register_worker({"mail"})
    task = engine.submit("mail", {})
    assert engine.claim(worker, task)
    try:
        engine.complete(other, task)
        assert False, "expected ownership error"
    except ValueError:
        pass

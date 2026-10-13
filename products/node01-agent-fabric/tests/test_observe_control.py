from node01.control import ControlPlane
from node01.observe import EventLedger


def test_event_ledger_records_and_summarizes():
    ledger = EventLedger()
    event = ledger.append("task.completed", "worker-1", {"task_id": "t1"}, "c1")
    assert event.correlation_id == "c1"
    assert ledger.snapshot()["by_type"]["task.completed"] == 1
    assert len(ledger.recent()) == 1


def test_control_is_fail_closed_for_replay():
    control = ControlPlane(EventLedger())
    denied = control.replay("t1")
    assert not denied.accepted
    approved = control.replay("t1", approved=True)
    assert approved.accepted


def test_pause_resume_and_drain():
    control = ControlPlane(EventLedger())
    assert control.pause().accepted
    assert control.status()["paused"]
    assert control.resume().accepted
    assert not control.status()["paused"]
    assert control.drain().accepted
    assert control.status()["draining"]

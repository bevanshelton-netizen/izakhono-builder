#!/usr/bin/env python3
from datetime import datetime, timezone
from observability import RuntimeEvent
from postgres_event_store import PostgresEventStore, CREATE_TABLE_SQL

class Cursor:
    def __init__(self, conn): self.conn = conn
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def execute(self, sql, params=None): self.conn.calls.append((sql, params)); self.conn.last_sql = sql
    def fetchall(self): return self.conn.rows

class Connection:
    def __init__(self, rows=None): self.rows = rows or []; self.calls = []; self.last_sql = ""
    def cursor(self): return Cursor(self)
    def commit(self): self.committed = True
    def close(self): self.closed = True

def main():
    conn = Connection()
    store = PostgresEventStore(lambda: conn)
    store.initialize()
    assert conn.calls[0][0] == CREATE_TABLE_SQL
    event = RuntimeEvent("dep-1", "kora-mail", "state_transition", "DEPLOYED", "node02", "activated", "2026-10-25T00:00:00+00:00", False)
    event_id = store.append(event, event_id="evt-1")
    assert event_id == "evt-1"
    sql, params = conn.calls[-1]
    assert "INSERT INTO izakhono_runtime_events" in sql
    assert params[0] == "evt-1" and params[1] == "dep-1"
    now = datetime.now(timezone.utc)
    conn.rows = [("evt-1", "dep-1", "kora-mail", "state_transition", "DEPLOYED", "node02", "activated", now, False, now)]
    events = store.for_deployment("dep-1")
    assert events[0]["event_id"] == "evt-1"
    assert events[0]["evidence"] is False
    assert "LIVE_VERIFIED" not in events[0]["state"]
    try: store.list_recent(0)
    except ValueError: pass
    else: raise AssertionError("invalid limit was accepted")
    print("POSTGRES_EVENT_STORE: PASS")

if __name__ == "__main__": main()

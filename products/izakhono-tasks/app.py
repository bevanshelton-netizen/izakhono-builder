#!/usr/bin/env python3
import hashlib
import hmac
import json
import os
import sqlite3
import threading
import time
import urllib.request
import urllib.error
import uuid
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HOST=os.getenv("IZAKHONO_TASKS_HOST","127.0.0.1")
PORT=int(os.getenv("IZAKHONO_TASKS_PORT","9991"))
TOKEN=os.getenv("IZAKHONO_TASKS_TOKEN","")
DB_PATH=Path(os.getenv("IZAKHONO_TASKS_DB","./izakhono-tasks.db"))
RUNNER_URL=os.getenv("IZAKHONO_TASKS_RUNNER_URL","").strip()
RUNNER_SECRET=os.getenv("IZAKHONO_TASKS_RUNNER_SECRET","")
POLL_SECONDS=max(1,int(os.getenv("IZAKHONO_TASKS_POLL_SECONDS","5")))
MAX_BODY=1024*1024

DB_PATH.parent.mkdir(parents=True,exist_ok=True)

SCHEMA="""
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS tasks(
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  instruction TEXT NOT NULL,
  schedule_json TEXT NOT NULL,
  task_mode TEXT NOT NULL DEFAULT 'scheduled',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  next_run_at INTEGER,
  last_run_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(enabled,next_run_at);
CREATE INDEX IF NOT EXISTS idx_tasks_entity ON tasks(entity_id,created_at);

CREATE TABLE IF NOT EXISTS runs(
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL,
  scheduled_for INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  status TEXT NOT NULL,
  output TEXT,
  error TEXT,
  notify INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_task ON runs(task_id,created_at);
CREATE INDEX IF NOT EXISTS idx_runs_entity ON runs(entity_id,created_at);
"""

def db():
    c=sqlite3.connect(DB_PATH,timeout=30)
    c.row_factory=sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    return c

with db() as c:
    c.executescript(SCHEMA)

def now_ts():
    return int(time.time())

def parse_iso(value):
    if not isinstance(value,str) or not value.strip():
        raise ValueError("at must be an ISO-8601 datetime")
    dt=datetime.fromisoformat(value.replace("Z","+00:00"))
    if dt.tzinfo is None:
        dt=dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())

def schedule_next(schedule, after=None):
    after=now_ts() if after is None else int(after)
    if not isinstance(schedule,dict):
        raise ValueError("schedule must be an object")
    kind=str(schedule.get("kind","")).lower()

    if kind=="once":
        at=parse_iso(schedule.get("at"))
        return at if at>after else None

    if kind=="interval":
        seconds=int(schedule.get("seconds",0))
        if seconds<60:
            raise ValueError("interval must be at least 60 seconds")
        return after+seconds

    if kind in ("daily","weekly"):
        clock=str(schedule.get("time",""))
        try:
            hh,mm=[int(x) for x in clock.split(":",1)]
        except Exception:
            raise ValueError("time must be HH:MM")
        if not (0<=hh<=23 and 0<=mm<=59):
            raise ValueError("invalid clock time")
        offset=int(schedule.get("timezone_offset_minutes",0))
        if offset < -840 or offset > 840:
            raise ValueError("invalid timezone offset")
        tz=timezone(timedelta(minutes=offset))
        local=datetime.fromtimestamp(after,tz)
        candidate=local.replace(hour=hh,minute=mm,second=0,microsecond=0)
        if kind=="daily":
            if candidate.timestamp()<=after:
                candidate+=timedelta(days=1)
            return int(candidate.timestamp())

        weekday=int(schedule.get("weekday",-1))
        if weekday<0 or weekday>6:
            raise ValueError("weekday must be 0..6 where Monday=0")
        delta=(weekday-candidate.weekday())%7
        candidate+=timedelta(days=delta)
        if candidate.timestamp()<=after:
            candidate+=timedelta(days=7)
        return int(candidate.timestamp())

    raise ValueError("schedule kind must be once, interval, daily or weekly")

def validate_mode(value):
    mode=str(value or "scheduled")
    if mode not in ("scheduled","condition_watch"):
        raise ValueError("task_mode must be scheduled or condition_watch")
    return mode

def task_to_dict(row):
    if not row: return None
    d=dict(row)
    d["enabled"]=bool(d["enabled"])
    d["schedule"]=json.loads(d.pop("schedule_json"))
    return d

def run_to_dict(row):
    if not row: return None
    d=dict(row)
    if d.get("notify") is not None:
        d["notify"]=bool(d["notify"])
    return d

def create_task(payload):
    entity=str(payload.get("entity_id","")).strip()
    title=str(payload.get("title","")).strip()
    instruction=str(payload.get("instruction","")).strip()
    if not entity or not title or not instruction:
        raise ValueError("entity_id, title and instruction are required")
    schedule=payload.get("schedule")
    next_run=schedule_next(schedule)
    mode=validate_mode(payload.get("task_mode"))
    tid="tsk_"+uuid.uuid4().hex
    ts=now_ts()
    with db() as c:
        c.execute("""INSERT INTO tasks
        (id,entity_id,title,instruction,schedule_json,task_mode,enabled,created_at,updated_at,next_run_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)""",
        (tid,entity,title,instruction,json.dumps(schedule,separators=(",",":")),mode,1,ts,ts,next_run))
        row=c.execute("SELECT * FROM tasks WHERE id=?",(tid,)).fetchone()
    return task_to_dict(row)

def list_tasks(entity_id):
    with db() as c:
        rows=c.execute("SELECT * FROM tasks WHERE entity_id=? ORDER BY created_at DESC",(entity_id,)).fetchall()
    return [task_to_dict(r) for r in rows]

def get_task(tid, entity_id):
    with db() as c:
        row=c.execute("SELECT * FROM tasks WHERE id=? AND entity_id=?",(tid,entity_id)).fetchone()
    return task_to_dict(row)

def set_enabled(tid, entity_id, enabled):
    with db() as c:
        row=c.execute("SELECT * FROM tasks WHERE id=? AND entity_id=?",(tid,entity_id)).fetchone()
        if not row: return None
        next_run=row["next_run_at"]
        if enabled:
            next_run=schedule_next(json.loads(row["schedule_json"]))
        c.execute("UPDATE tasks SET enabled=?,next_run_at=?,updated_at=? WHERE id=? AND entity_id=?",
                  (1 if enabled else 0,next_run,now_ts(),tid,entity_id))
        row=c.execute("SELECT * FROM tasks WHERE id=?",(tid,)).fetchone()
    return task_to_dict(row)

def delete_task(tid, entity_id):
    with db() as c:
        cur=c.execute("DELETE FROM tasks WHERE id=? AND entity_id=?",(tid,entity_id))
        return cur.rowcount>0

def list_runs(entity_id, task_id=None, limit=100):
    limit=max(1,min(int(limit),500))
    with db() as c:
        if task_id:
            rows=c.execute("""SELECT * FROM runs WHERE entity_id=? AND task_id=?
                              ORDER BY created_at DESC LIMIT ?""",(entity_id,task_id,limit)).fetchall()
        else:
            rows=c.execute("""SELECT * FROM runs WHERE entity_id=?
                              ORDER BY created_at DESC LIMIT ?""",(entity_id,limit)).fetchall()
    return [run_to_dict(r) for r in rows]

def post_runner(task, run_id, scheduled_for):
    body=json.dumps({
        "run_id":run_id,
        "task":{
            "id":task["id"],
            "entity_id":task["entity_id"],
            "title":task["title"],
            "instruction":task["instruction"],
            "task_mode":task["task_mode"]
        },
        "scheduled_for":scheduled_for
    },separators=(",",":")).encode()
    headers={"Content-Type":"application/json","X-IZAKHONO-Run-ID":run_id}
    if RUNNER_SECRET:
        stamp=str(now_ts())
        sig=hmac.new(RUNNER_SECRET.encode(),stamp.encode()+b"."+body,hashlib.sha256).hexdigest()
        headers["X-IZAKHONO-Timestamp"]=stamp
        headers["X-IZAKHONO-Signature"]=sig
    req=urllib.request.Request(RUNNER_URL,data=body,headers=headers,method="POST")
    with urllib.request.urlopen(req,timeout=60) as r:
        raw=r.read(256*1024)
        if not raw:
            return {"ok":True}
        try:
            return json.loads(raw)
        except Exception:
            return {"ok":True,"output":raw.decode("utf-8","replace")[:12000]}

def execute_due(task):
    scheduled_for=int(task["next_run_at"])
    rid="run_"+uuid.uuid4().hex
    ts=now_ts()
    with db() as c:
        c.execute("""INSERT INTO runs(id,task_id,entity_id,scheduled_for,status,created_at)
                     VALUES(?,?,?,?,?,?)""",(rid,task["id"],task["entity_id"],scheduled_for,"queued",ts))
        schedule=task["schedule"]
        next_run=schedule_next(schedule,scheduled_for)
        if schedule.get("kind")=="once":
            next_run=None
            enabled=0
        else:
            enabled=1
        c.execute("""UPDATE tasks SET last_run_at=?,next_run_at=?,enabled=?,updated_at=?
                     WHERE id=?""",(scheduled_for,next_run,enabled,ts,task["id"]))

    if not RUNNER_URL:
        return

    started=now_ts()
    with db() as c:
        c.execute("UPDATE runs SET status='running',started_at=? WHERE id=?",(started,rid))
    try:
        result=post_runner(task,rid,scheduled_for)
        output=str(result.get("output",""))[:12000]
        notify=result.get("notify")
        if notify is not None: notify=1 if bool(notify) else 0
        with db() as c:
            c.execute("""UPDATE runs SET status='succeeded',finished_at=?,output=?,notify=? WHERE id=?""",
                      (now_ts(),output,notify,rid))
    except Exception as exc:
        with db() as c:
            c.execute("""UPDATE runs SET status='failed',finished_at=?,error=? WHERE id=?""",
                      (now_ts(),str(exc)[:12000],rid))

def scheduler_loop():
    while True:
        try:
            ts=now_ts()
            with db() as c:
                rows=c.execute("""SELECT * FROM tasks
                                  WHERE enabled=1 AND next_run_at IS NOT NULL AND next_run_at<=?
                                  ORDER BY next_run_at ASC LIMIT 100""",(ts,)).fetchall()
            for row in rows:
                task=task_to_dict(row)
                threading.Thread(target=execute_due,args=(task,),daemon=True).start()
        except Exception as exc:
            print("IZAKHONO TASKS scheduler error:",exc,flush=True)
        time.sleep(POLL_SECONDS)

threading.Thread(target=scheduler_loop,daemon=True).start()

INDEX_HTML=r"""<!doctype html>
<html>
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>IZAKHONO TASKS</title>
<style>
:root{font-family:Inter,system-ui,sans-serif;color-scheme:dark}
body{margin:0;background:#080b10;color:#f4f4f4}
.wrap{max-width:1050px;margin:auto;padding:28px}
.brand{font-size:34px;font-weight:900;letter-spacing:.02em}.gold{color:#d9b65d}
.sub{color:#9ea6b2;margin:4px 0 24px}.grid{display:grid;grid-template-columns:1fr 1.3fr;gap:18px}
.card{background:#10151d;border:1px solid #252d39;border-radius:18px;padding:18px}
input,textarea,select,button{font:inherit}
input,textarea,select{width:100%;box-sizing:border-box;background:#0a0f15;color:#fff;border:1px solid #2c3543;border-radius:10px;padding:11px;margin:7px 0 12px}
textarea{min-height:110px;resize:vertical}
button{border:0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;background:#d9b65d;color:#111}
button.alt{background:#202834;color:#fff}.row{display:flex;gap:8px;flex-wrap:wrap}
.task{padding:14px 0;border-bottom:1px solid #252d39}.task:last-child{border:0}
.meta{color:#96a0ad;font-size:13px;margin-top:5px}.pill{display:inline-block;padding:3px 8px;border-radius:99px;background:#1b2530;font-size:12px}
.good{color:#70d68b}.muted{color:#8f98a6}.cap{margin-bottom:14px;padding:10px 12px;border-radius:12px;background:#111c16;border:1px solid #214c2f}
@media(max-width:760px){.grid{grid-template-columns:1fr}.brand{font-size:28px}}
</style></head>
<body><div class="wrap">
<div class="brand">IZAKHONO <span class="gold">TASKS</span></div>
<div class="sub">Owner-controlled scheduling. No artificial five-task ceiling.</div>
<div class="cap">Active task cap: <b class="good">NONE</b> · Real capacity depends on owner hardware, storage and network.</div>
<div class="grid">
<div class="card">
<h3>Create task</h3>
<label>Entity</label><input id="entity" value="izakhono-owner">
<label>Title</label><input id="title" placeholder="PayFast approval watch">
<label>Instruction</label><textarea id="instruction" placeholder="Check the current state and report only when something meaningful changes."></textarea>
<label>Mode</label><select id="mode"><option value="scheduled">Scheduled</option><option value="condition_watch">Condition watch</option></select>
<label>Schedule</label><select id="kind" onchange="scheduleFields()">
<option value="interval">Every N minutes</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="once">One time</option>
</select>
<div id="schedule-fields"></div>
<button onclick="createTask()">Create task</button>
<div id="msg" class="meta"></div>
</div>
<div class="card">
<div class="row" style="justify-content:space-between;align-items:center"><h3>My tasks</h3><button class="alt" onclick="loadTasks()">Refresh</button></div>
<div id="tasks"></div>
</div>
</div></div>
<script>
const api=async(path,opt={})=>{
  const token=localStorage.getItem('izakhonoTasksToken')||'';
  const entity=document.getElementById('entity')?.value||'izakhono-owner';
  opt.headers={...(opt.headers||{}),'Content-Type':'application/json','X-IZAKHONO-Entity-ID':entity};
  if(token) opt.headers.Authorization='Bearer '+token;
  const r=await fetch(path,opt); const j=await r.json(); if(!r.ok) throw new Error(j.error||r.statusText); return j;
};
function scheduleFields(){
 const k=kind.value, el=document.getElementById('schedule-fields');
 if(k==='interval') el.innerHTML='<label>Minutes</label><input id="minutes" type="number" min="1" value="60">';
 if(k==='daily') el.innerHTML='<label>Time</label><input id="clock" type="time" value="08:00"><label>UTC offset minutes</label><input id="offset" type="number" value="120">';
 if(k==='weekly') el.innerHTML='<label>Weekday</label><select id="weekday"><option value="0">Monday</option><option value="1">Tuesday</option><option value="2">Wednesday</option><option value="3">Thursday</option><option value="4">Friday</option><option value="5">Saturday</option><option value="6">Sunday</option></select><label>Time</label><input id="clock" type="time" value="08:00"><label>UTC offset minutes</label><input id="offset" type="number" value="120">';
 if(k==='once') el.innerHTML='<label>Date & time</label><input id="at" type="datetime-local">';
}
function scheduleValue(){
 const k=kind.value;
 if(k==='interval') return {kind:k,seconds:Number(minutes.value)*60};
 if(k==='daily') return {kind:k,time:clock.value,timezone_offset_minutes:Number(offset.value)};
 if(k==='weekly') return {kind:k,weekday:Number(weekday.value),time:clock.value,timezone_offset_minutes:Number(offset.value)};
 if(k==='once') return {kind:k,at:new Date(at.value).toISOString()};
}
async function createTask(){
 msg.textContent='';
 try{
  await api('/api/v1/tasks',{method:'POST',body:JSON.stringify({entity_id:entity.value,title:title.value,instruction:instruction.value,task_mode:mode.value,schedule:scheduleValue()})});
  title.value='';instruction.value='';msg.textContent='Task created.';loadTasks();
 }catch(e){msg.textContent=e.message}
}
function fmt(ts){return ts?new Date(ts*1000).toLocaleString():'—'}
async function loadTasks(){
 try{
  const j=await api('/api/v1/tasks');
  tasks.innerHTML=j.tasks.length?j.tasks.map(t=>`<div class="task"><b>${esc(t.title)}</b> <span class="pill">${t.enabled?'ACTIVE':'PAUSED'}</span><div class="meta">${esc(t.task_mode)} · next: ${fmt(t.next_run_at)}</div><div class="meta">${esc(t.instruction)}</div><div class="row" style="margin-top:9px"><button class="alt" onclick="toggle('${t.id}',${t.enabled})">${t.enabled?'Pause':'Resume'}</button><button class="alt" onclick="removeTask('${t.id}')">Delete</button></div></div>`).join(''):'<div class="muted">No tasks yet.</div>';
 }catch(e){tasks.innerHTML='<div class="muted">'+esc(e.message)+'</div>'}
}
async function toggle(id,enabled){await api('/api/v1/tasks/'+id+'/'+(enabled?'pause':'resume'),{method:'POST',body:'{}'});loadTasks()}
async function removeTask(id){await api('/api/v1/tasks/'+id,{method:'DELETE'});loadTasks()}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
scheduleFields();loadTasks();
</script></body></html>"""

class H(BaseHTTPRequestHandler):
    def log_message(self,*a): pass

    def sendj(self,code,obj):
        b=json.dumps(obj,separators=(",",":")).encode()
        self.send_response(code)
        self.send_header("Content-Type","application/json")
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("Content-Length",str(len(b)))
        self.end_headers(); self.wfile.write(b)

    def sendhtml(self,html):
        b=html.encode()
        self.send_response(200)
        self.send_header("Content-Type","text/html; charset=utf-8")
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("Content-Length",str(len(b)))
        self.end_headers(); self.wfile.write(b)

    def body(self):
        n=min(int(self.headers.get("Content-Length","0") or 0),MAX_BODY)
        raw=self.rfile.read(n)
        return json.loads(raw or b"{}")

    def authed(self):
        if not TOKEN:
            return True
        return hmac.compare_digest(self.headers.get("Authorization",""),"Bearer "+TOKEN)

    def entity(self):
        return self.headers.get("X-IZAKHONO-Entity-ID","").strip()

    def require(self):
        if not self.authed():
            self.sendj(401,{"error":"unauthorized"}); return False
        if not self.entity():
            self.sendj(400,{"error":"X-IZAKHONO-Entity-ID required"}); return False
        return True

    def do_GET(self):
        p=urlparse(self.path)
        if p.path=="/":
            return self.sendhtml(INDEX_HTML)
        if p.path=="/healthz":
            return self.sendj(200,{"ok":True,"service":"izakhono-tasks","version":"1.0.0"})
        if p.path=="/api/v1/capabilities":
            return self.sendj(200,{
                "ok":True,
                "active_task_limit":None,
                "artificial_task_cap":False,
                "minimum_interval_seconds":60,
                "schedule_kinds":["once","interval","daily","weekly"],
                "task_modes":["scheduled","condition_watch"],
                "runner_connected":bool(RUNNER_URL),
                "capacity_note":"Real limits are owner compute, storage and network."
            })
        if not self.require(): return
        if p.path=="/api/v1/tasks":
            return self.sendj(200,{"tasks":list_tasks(self.entity())})
        if p.path=="/api/v1/runs":
            q=parse_qs(p.query)
            tid=(q.get("task_id") or [None])[0]
            limit=(q.get("limit") or [100])[0]
            return self.sendj(200,{"runs":list_runs(self.entity(),tid,limit)})
        self.sendj(404,{"error":"not_found"})

    def do_POST(self):
        p=urlparse(self.path)
        if not self.require(): return
        if p.path=="/api/v1/tasks":
            try:
                payload=self.body()
                if str(payload.get("entity_id","")).strip()!=self.entity():
                    return self.sendj(403,{"error":"entity_mismatch"})
                return self.sendj(201,create_task(payload))
            except ValueError as e:
                return self.sendj(400,{"error":str(e)})
            except Exception:
                return self.sendj(500,{"error":"task_create_failed"})

        parts=p.path.strip("/").split("/")
        if len(parts)==5 and parts[:3]==["api","v1","tasks"] and parts[4] in ("pause","resume"):
            row=set_enabled(parts[3],self.entity(),parts[4]=="resume")
            return self.sendj(200,row) if row else self.sendj(404,{"error":"not_found"})
        self.sendj(404,{"error":"not_found"})

    def do_DELETE(self):
        p=urlparse(self.path)
        if not self.require(): return
        parts=p.path.strip("/").split("/")
        if len(parts)==4 and parts[:3]==["api","v1","tasks"]:
            return self.sendj(200,{"ok":True}) if delete_task(parts[3],self.entity()) else self.sendj(404,{"error":"not_found"})
        self.sendj(404,{"error":"not_found"})

if __name__=="__main__":
    print(f"IZAKHONO TASKS listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST,PORT),H).serve_forever()

"""Tenant-scoped survey, response, NPS and case domain; no HTTP/auth bypass."""
import hashlib, json, sqlite3, uuid
from datetime import datetime, timezone

class ExperienceError(ValueError):
    pass

def now(): return datetime.now(timezone.utc).isoformat()
def uid(prefix): return prefix + "_" + uuid.uuid4().hex

def calculate_nps(scores):
    if not scores:
        return {"score":None,"responses":0,"promoters":0,"passives":0,"detractors":0}
    if any(type(x) is not int or not 0 <= x <= 10 for x in scores):
        raise ExperienceError("nps_scores_must_be_integers_0_to_10")
    n=len(scores); p=sum(x>=9 for x in scores); d=sum(x<=6 for x in scores)
    return {"score":round((p-d)*100/n,2),"responses":n,"promoters":p,"passives":n-p-d,"detractors":d}

SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS surveys(
 id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, platform_id TEXT NOT NULL,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200), metric TEXT NOT NULL CHECK(metric IN ('NPS','CSAT','CES','CUSTOM')),
 status TEXT NOT NULL CHECK(status IN ('draft','active','paused','closed')),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(entity_id,platform_id,id));
CREATE INDEX IF NOT EXISTS surveys_scope ON surveys(entity_id,platform_id,status,updated_at);
CREATE TABLE IF NOT EXISTS questions(
 id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, platform_id TEXT NOT NULL, survey_id TEXT NOT NULL,
 position INTEGER NOT NULL CHECK(position>=0), kind TEXT NOT NULL CHECK(kind IN ('nps','rating','text','choice')),
 prompt TEXT NOT NULL CHECK(length(prompt) BETWEEN 1 AND 2000), required INTEGER NOT NULL CHECK(required IN (0,1)),
 config_json TEXT NOT NULL DEFAULT '{}',
 FOREIGN KEY(entity_id,platform_id,survey_id) REFERENCES surveys(entity_id,platform_id,id) ON DELETE CASCADE,
 UNIQUE(entity_id,platform_id,survey_id,position), UNIQUE(entity_id,platform_id,id));
CREATE TABLE IF NOT EXISTS responses(
 id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, platform_id TEXT NOT NULL, survey_id TEXT NOT NULL,
 respondent_ref TEXT, privacy_mode TEXT NOT NULL CHECK(privacy_mode IN ('anonymous','pseudonymous','identified')),
 submitted_at TEXT NOT NULL,
 FOREIGN KEY(entity_id,platform_id,survey_id) REFERENCES surveys(entity_id,platform_id,id),
 UNIQUE(entity_id,platform_id,id));
CREATE TABLE IF NOT EXISTS answers(
 id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, platform_id TEXT NOT NULL, response_id TEXT NOT NULL,
 question_id TEXT NOT NULL, answer_json TEXT NOT NULL,
 FOREIGN KEY(entity_id,platform_id,response_id) REFERENCES responses(entity_id,platform_id,id) ON DELETE CASCADE,
 FOREIGN KEY(entity_id,platform_id,question_id) REFERENCES questions(entity_id,platform_id,id),
 UNIQUE(entity_id,platform_id,response_id,question_id));
CREATE TABLE IF NOT EXISTS cases(
 id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, platform_id TEXT NOT NULL, response_id TEXT NOT NULL,
 severity TEXT NOT NULL CHECK(severity IN ('low','normal','high','urgent')),
 status TEXT NOT NULL CHECK(status IN ('open','acknowledged','in_progress','resolved','follow_up','closed','unable_to_resolve')),
 assigned_to TEXT, resolution_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 idempotency_key TEXT, request_hash TEXT,
 FOREIGN KEY(entity_id,platform_id,response_id) REFERENCES responses(entity_id,platform_id,id),
 UNIQUE(entity_id,platform_id,response_id), UNIQUE(entity_id,platform_id,id));
CREATE TABLE IF NOT EXISTS case_events(
 id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, platform_id TEXT NOT NULL, case_id TEXT NOT NULL,
 from_status TEXT, to_status TEXT NOT NULL, actor_id TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
 occurred_at TEXT NOT NULL, version INTEGER NOT NULL,
 FOREIGN KEY(entity_id,platform_id,case_id) REFERENCES cases(entity_id,platform_id,id),
 UNIQUE(entity_id,platform_id,case_id,version));
"""

class ExperienceStore:
    def __init__(self, database, *, entity_id, platform_id):
        if not entity_id or not platform_id: raise ExperienceError("verified_scope_required")
        self.database,self.entity_id,self.platform_id=str(database),entity_id,platform_id
    def connect(self):
        db=sqlite3.connect(self.database); db.row_factory=sqlite3.Row; db.execute("PRAGMA foreign_keys=ON"); return db
    def initialise(self):
        with self.connect() as db:
            db.executescript(SCHEMA)
            columns={row["name"] for row in db.execute("PRAGMA table_info(cases)")}
            if "version" not in columns: db.execute("ALTER TABLE cases ADD COLUMN version INTEGER NOT NULL DEFAULT 1")
            if "idempotency_key" not in columns: db.execute("ALTER TABLE cases ADD COLUMN idempotency_key TEXT")
            if "request_hash" not in columns: db.execute("ALTER TABLE cases ADD COLUMN request_hash TEXT")
            db.execute("CREATE UNIQUE INDEX IF NOT EXISTS cases_idempotency ON cases(entity_id,platform_id,idempotency_key) WHERE idempotency_key IS NOT NULL")
            db.execute("""CREATE TABLE IF NOT EXISTS case_events(
                id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, platform_id TEXT NOT NULL, case_id TEXT NOT NULL,
                from_status TEXT, to_status TEXT NOT NULL, actor_id TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
                occurred_at TEXT NOT NULL, version INTEGER NOT NULL,
                FOREIGN KEY(entity_id,platform_id,case_id) REFERENCES cases(entity_id,platform_id,id),
                UNIQUE(entity_id,platform_id,case_id,version))""")
            db.execute("""INSERT INTO case_events
                (id,entity_id,platform_id,case_id,from_status,to_status,actor_id,note,occurred_at,version)
                SELECT 'evt_baseline_'||id,entity_id,platform_id,id,NULL,status,'system:migration',
                       'Baseline snapshot; prior transition history unavailable',created_at,1
                FROM cases WHERE NOT EXISTS (
                    SELECT 1 FROM case_events e WHERE e.entity_id=cases.entity_id
                    AND e.platform_id=cases.platform_id AND e.case_id=cases.id)""")
    def get_survey(self, sid):
        with self.connect() as db: row=db.execute("SELECT * FROM surveys WHERE id=? AND entity_id=? AND platform_id=?",(sid,self.entity_id,self.platform_id)).fetchone()
        if row is None: raise ExperienceError("survey_not_found")
        return dict(row)
    def create_survey(self,name,*,metric,created_by,status="draft"):
        name=str(name).strip(); metric=str(metric).upper()
        if not name or len(name)>200: raise ExperienceError("invalid_survey_name")
        if metric not in {"NPS","CSAT","CES","CUSTOM"}: raise ExperienceError("invalid_metric")
        if status not in {"draft","active","paused","closed"} or not created_by: raise ExperienceError("invalid_survey_state_or_actor")
        sid,ts=uid("sur"),now()
        with self.connect() as db: db.execute("INSERT INTO surveys VALUES(?,?,?,?,?,?,?,?,?)",(sid,self.entity_id,self.platform_id,name,metric,status,created_by,ts,ts))
        return self.get_survey(sid)
    def add_question(self,sid,*,position,kind,prompt,required=True,config=None):
        if self.get_survey(sid)["status"]!="draft": raise ExperienceError("questions_editable_only_while_draft")
        if type(position) is not int or position<0: raise ExperienceError("invalid_position")
        if kind not in {"nps","rating","text","choice"}: raise ExperienceError("invalid_question_type")
        prompt=str(prompt).strip()
        if not prompt or len(prompt)>2000: raise ExperienceError("invalid_prompt")
        if kind=="nps" and self.get_survey(sid)["metric"]!="NPS": raise ExperienceError("nps_question_requires_nps_survey")
        qid=uid("qst")
        with self.connect() as db:
            db.execute("INSERT INTO questions VALUES(?,?,?,?,?,?,?,?,?)",(qid,self.entity_id,self.platform_id,sid,position,kind,prompt,int(bool(required)),json.dumps(config or {})))
            row=db.execute("SELECT * FROM questions WHERE id=? AND entity_id=? AND platform_id=?",(qid,self.entity_id,self.platform_id)).fetchone()
        return dict(row)
    def activate_survey(self,sid):
        self.get_survey(sid)
        with self.connect() as db:
            if not db.execute("SELECT 1 FROM questions WHERE survey_id=? AND entity_id=? AND platform_id=?",(sid,self.entity_id,self.platform_id)).fetchone(): raise ExperienceError("survey_requires_question")
            db.execute("UPDATE surveys SET status='active',updated_at=? WHERE id=? AND entity_id=? AND platform_id=?",(now(),sid,self.entity_id,self.platform_id))
        return self.get_survey(sid)
    def submit_response(self,sid,answers,*,respondent_ref=None,privacy_mode="anonymous"):
        if self.get_survey(sid)["status"]!="active": raise ExperienceError("survey_not_active")
        if privacy_mode not in {"anonymous","pseudonymous","identified"}: raise ExperienceError("invalid_privacy_mode")
        if (privacy_mode=="anonymous" and respondent_ref is not None) or (privacy_mode!="anonymous" and not respondent_ref): raise ExperienceError("respondent_reference_privacy_mismatch")
        if not isinstance(answers,dict) or not answers: raise ExperienceError("answers_required")
        with self.connect() as db:
            qs=db.execute("SELECT * FROM questions WHERE survey_id=? AND entity_id=? AND platform_id=?",(sid,self.entity_id,self.platform_id)).fetchall(); byid={q["id"]:q for q in qs}
            if set(answers)-set(byid): raise ExperienceError("foreign_question")
            if any(q["required"] and q["id"] not in answers for q in qs): raise ExperienceError("required_answers_missing")
            for qid,value in answers.items():
                q=byid[qid]; cfg=json.loads(q["config_json"])
                if q["kind"]=="nps" and (type(value) is not int or not 0<=value<=10): raise ExperienceError("invalid_nps_answer")
                if q["kind"]=="rating" and (type(value) is not int or not cfg.get("min",1)<=value<=cfg.get("max",5)): raise ExperienceError("invalid_rating_answer")
                if q["kind"]=="text" and (not isinstance(value,str) or len(value)>10000): raise ExperienceError("invalid_text_answer")
                if q["kind"]=="choice" and value not in cfg.get("choices",[]): raise ExperienceError("invalid_choice_answer")
            rid,ts=uid("rsp"),now()
            db.execute("INSERT INTO responses VALUES(?,?,?,?,?,?,?)",(rid,self.entity_id,self.platform_id,sid,respondent_ref if privacy_mode!="anonymous" else None,privacy_mode,ts))
            for qid,value in answers.items(): db.execute("INSERT INTO answers VALUES(?,?,?,?,?,?)",(uid("ans"),self.entity_id,self.platform_id,rid,qid,json.dumps(value,ensure_ascii=False)))
            db.commit()
        return {"id":rid,"survey_id":sid,"submitted_at":ts,"privacy_mode":privacy_mode}
    def nps_summary(self,sid):
        if self.get_survey(sid)["metric"]!="NPS": raise ExperienceError("not_nps_survey")
        with self.connect() as db:
            rows=db.execute("SELECT a.answer_json FROM answers a JOIN responses r ON r.id=a.response_id AND r.entity_id=a.entity_id AND r.platform_id=a.platform_id JOIN questions q ON q.id=a.question_id AND q.entity_id=a.entity_id AND q.platform_id=a.platform_id WHERE a.entity_id=? AND a.platform_id=? AND r.survey_id=? AND q.kind='nps'",(self.entity_id,self.platform_id,sid)).fetchall()
        return {"survey_id":sid,**calculate_nps([json.loads(x["answer_json"]) for x in rows])}
    def open_case(self,rid,*,severity="normal",assigned_to=None,actor_id="system:experience",idempotency_key=None):
        if severity not in {"low","normal","high","urgent"}: raise ExperienceError("invalid_severity")
        if not isinstance(actor_id,str) or not actor_id.strip(): raise ExperienceError("actor_required")
        if idempotency_key is not None and (not isinstance(idempotency_key,str) or not idempotency_key.strip() or len(idempotency_key)>200):
            raise ExperienceError("invalid_idempotency_key")
        request_hash=hashlib.sha256(json.dumps({"response_id":rid,"severity":severity,"assigned_to":assigned_to},sort_keys=True,separators=(",",":")).encode()).hexdigest()
        cid,ts=uid("case"),now()
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            if not db.execute("SELECT 1 FROM responses WHERE id=? AND entity_id=? AND platform_id=?",(rid,self.entity_id,self.platform_id)).fetchone():
                raise ExperienceError("response_not_found")
            if idempotency_key:
                prior=db.execute("SELECT * FROM cases WHERE entity_id=? AND platform_id=? AND idempotency_key=?",(self.entity_id,self.platform_id,idempotency_key)).fetchone()
                if prior:
                    if prior["request_hash"]!=request_hash: raise ExperienceError("idempotency_key_reused_with_different_request")
                    return dict(prior)
            db.execute("""INSERT INTO cases
                (id,entity_id,platform_id,response_id,severity,status,assigned_to,resolution_note,created_at,updated_at,version,idempotency_key,request_hash)
                VALUES(?,?,?,?,?,'open',?,'',?,?,1,?,?)""",
                (cid,self.entity_id,self.platform_id,rid,severity,assigned_to,ts,ts,idempotency_key,request_hash))
            db.execute("""INSERT INTO case_events
                (id,entity_id,platform_id,case_id,from_status,to_status,actor_id,note,occurred_at,version)
                VALUES(?,?,?,?,NULL,'open',?,'Case opened',?,1)""",
                (uid("evt"),self.entity_id,self.platform_id,cid,actor_id,ts))
            row=db.execute("SELECT * FROM cases WHERE id=? AND entity_id=? AND platform_id=?",(cid,self.entity_id,self.platform_id)).fetchone()
        return dict(row)
    def transition_case(self,cid,*,status,actor_id,resolution_note="",expected_version=None):
        transitions={"open":{"acknowledged","in_progress","closed","unable_to_resolve"},"acknowledged":{"in_progress","closed","unable_to_resolve"},"in_progress":{"resolved","unable_to_resolve"},"resolved":{"follow_up","closed","in_progress"},"follow_up":{"closed","in_progress"},"closed":set(),"unable_to_resolve":{"follow_up","closed"}}
        if not isinstance(actor_id,str) or not actor_id.strip(): raise ExperienceError("actor_required")
        if not isinstance(status,str): raise ExperienceError("invalid_case_transition")
        if not isinstance(resolution_note,str): raise ExperienceError("invalid_resolution_note")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row=db.execute("SELECT * FROM cases WHERE id=? AND entity_id=? AND platform_id=?",(cid,self.entity_id,self.platform_id)).fetchone()
            if row is None: raise ExperienceError("case_not_found")
            current_version=row["version"]
            if expected_version is not None and expected_version!=current_version: raise ExperienceError("stale_case_version")
            if status not in transitions[row["status"]]: raise ExperienceError("invalid_case_transition")
            if status=="resolved" and not resolution_note.strip(): raise ExperienceError("resolution_note_required")
            ts=now(); next_version=current_version+1
            next_note=resolution_note[:4000] if resolution_note.strip() else row["resolution_note"]
            changed=db.execute("""UPDATE cases SET status=?,resolution_note=?,updated_at=?,version=?
                WHERE id=? AND entity_id=? AND platform_id=? AND version=?""",
                (status,next_note,ts,next_version,cid,self.entity_id,self.platform_id,current_version)).rowcount
            if changed!=1: raise ExperienceError("stale_case_version")
            db.execute("""INSERT INTO case_events
                (id,entity_id,platform_id,case_id,from_status,to_status,actor_id,note,occurred_at,version)
                VALUES(?,?,?,?,?,?,?,?,?,?)""",
                (uid("evt"),self.entity_id,self.platform_id,cid,row["status"],status,actor_id,resolution_note[:4000],ts,next_version))
            updated=db.execute("SELECT * FROM cases WHERE id=? AND entity_id=? AND platform_id=?",(cid,self.entity_id,self.platform_id)).fetchone()
        return dict(updated)
    def case_history(self,cid):
        with self.connect() as db:
            if not db.execute("SELECT 1 FROM cases WHERE id=? AND entity_id=? AND platform_id=?",(cid,self.entity_id,self.platform_id)).fetchone():
                raise ExperienceError("case_not_found")
            rows=db.execute("""SELECT id,from_status,to_status,actor_id,note,occurred_at,version
                FROM case_events WHERE case_id=? AND entity_id=? AND platform_id=? ORDER BY version""",
                (cid,self.entity_id,self.platform_id)).fetchall()
        return [dict(row) for row in rows]

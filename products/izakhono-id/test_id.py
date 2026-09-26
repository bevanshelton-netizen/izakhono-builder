#!/usr/bin/env python3
import importlib.util
import json
import os
import tempfile
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

TMP=tempfile.TemporaryDirectory()
os.environ["IZAKHONO_ID_DATA"]=TMP.name
os.environ["IZAKHONO_ID_ADMIN_KEY"]="admin-test"
os.environ["IZAKHONO_ID_INTERNAL_KEY"]="internal-test"
os.environ["IZAKHONO_ID_PBKDF2_ITERATIONS"]="1000"
os.environ["IZAKHONO_ID_LOGIN_MAX_FAILURES"]="3"
os.environ["IZAKHONO_ID_LOGIN_WINDOW_SECONDS"]="60"
os.environ["IZAKHONO_ID_LOGIN_LOCK_SECONDS"]="2"
os.environ["IZAKHONO_ID_REQUIRE_EMAIL_VERIFICATION"]="true"
os.environ["IZAKHONO_ID_MFA_MASTER_KEY"]="mfa-test-master-key-32-bytes-minimum-123456"
os.environ["IZAKHONO_ID_MFA_CHALLENGE_SECONDS"]="60"
os.environ["IZAKHONO_ID_MFA_MAX_ATTEMPTS"]="3"

spec=importlib.util.spec_from_file_location("izakhono_id",Path(__file__).with_name("app.py"))
app=importlib.util.module_from_spec(spec); spec.loader.exec_module(app)

with app.db_connect() as db:
    ts=app.now_iso()
    db.execute("INSERT INTO entities(id,slug,display_name,created_at) VALUES(?,?,?,?)",
               ("ent_a","entity-a","Entity A",ts))
    db.execute("INSERT INTO entities(id,slug,display_name,created_at) VALUES(?,?,?,?)",
               ("ent_b","entity-b","Entity B",ts))
    salt,digest=app.hash_password("VeryStrongPass123!")
    db.execute("""INSERT INTO users(id,email,password_salt,password_hash,email_verified_at,created_at,updated_at)
                  VALUES(?,?,?,?,?,?,?)""",
               ("usr_1","user@example.com",salt,digest,ts,ts,ts))
    db.execute("INSERT INTO memberships(id,entity_id,user_id,role,created_at) VALUES(?,?,?,?,?)",
               ("mem_a","ent_a","usr_1","admin",ts))
    db.execute("INSERT INTO memberships(id,entity_id,user_id,role,created_at) VALUES(?,?,?,?,?)",
               ("mem_b","ent_b","usr_1","member",ts))
    mfa_salt,mfa_digest=app.hash_password("MfaStrongPass123!")
    db.execute("""INSERT INTO users(id,email,password_salt,password_hash,email_verified_at,created_at,updated_at)
                  VALUES(?,?,?,?,?,?,?)""",
               ("usr_mfa","mfa@example.com",mfa_salt,mfa_digest,ts,ts,ts))
    db.execute("INSERT INTO memberships(id,entity_id,user_id,role,created_at) VALUES(?,?,?,?,?)",
               ("mem_mfa","ent_a","usr_mfa","member",ts))
    db.commit()

    entity_a=db.execute("SELECT * FROM entities WHERE id='ent_a'").fetchone()
    entity_b=db.execute("SELECT * FROM entities WHERE id='ent_b'").fetchone()
    user=db.execute("SELECT * FROM users WHERE id='usr_1'").fetchone()
    mem_a=db.execute("SELECT * FROM memberships WHERE id='mem_a'").fetchone()
    mem_b=db.execute("SELECT * FROM memberships WHERE id='mem_b'").fetchone()

    token_a,_,_=app.issue_session(db,entity_a,user,mem_a)
    token_b,_,_=app.issue_session(db,entity_b,user,mem_b)

    session_a=app.find_session(db,token_a)
    session_b=app.find_session(db,token_b)

    assert session_a["entity_id"]=="ent_a"
    assert session_a["membership_role"]=="admin"
    assert session_b["entity_id"]=="ent_b"
    assert session_b["membership_role"]=="member"
    assert token_a != token_b
    assert app.verify_password("VeryStrongPass123!",salt,digest)
    assert not app.verify_password("wrong-password",salt,digest)

    fp=app.login_fingerprint("entity-a","user@example.com","127.0.0.1")
    allowed,retry=app.login_guard(db,fp)
    assert allowed and retry==0
    app.record_login_failure(db,fp)
    app.record_login_failure(db,fp)
    failures,locked_until=app.record_login_failure(db,fp)
    assert failures==3 and locked_until
    allowed,retry=app.login_guard(db,fp)
    assert not allowed and retry>=1
    app.clear_login_failures(db,fp)
    allowed,retry=app.login_guard(db,fp)
    assert allowed

    app.audit(db,"test.audit",entity_id="ent_a",user_id="usr_1",subject="user@example.com",detail="ok")
    db.commit()
    row=db.execute("SELECT * FROM audit_events WHERE event_type='test.audit'").fetchone()
    assert row and row["subject_hash"]==app.subject_hash("user@example.com")

server=ThreadingHTTPServer(("127.0.0.1",0),app.Handler)
thread=threading.Thread(target=server.serve_forever,daemon=True)
thread.start()
base=f"http://127.0.0.1:{server.server_address[1]}"

def request(path, method="GET", body=None, headers=None):
    data=None if body is None else json.dumps(body).encode()
    req=urllib.request.Request(base+path,data=data,method=method,headers=headers or {})
    if data is not None:
        req.add_header("content-type","application/json")
    try:
        with urllib.request.urlopen(req,timeout=5) as r:
            raw=r.read()
            return r.status, json.loads(raw.decode()) if raw else {}
    except urllib.error.HTTPError as e:
        raw=e.read()
        return e.code, json.loads(raw.decode()) if raw else {}

try:
    # Successful login and entity-scoped session.
    status,login=request("/api/v1/login","POST",{
        "entity_slug":"entity-a",
        "email":"user@example.com",
        "password":"VeryStrongPass123!",
    })
    assert status==200 and login["ok"] and login["entity"]["id"]=="ent_a"
    bearer={"authorization":"Bearer "+login["access_token"]}

    status,me=request("/api/v1/me",headers=bearer)
    assert status==200 and me["entity"]["id"]=="ent_a" and me["role"]=="admin"

    # Password change requires current password and revokes other sessions.
    status,bad_change=request("/api/v1/change-password","POST",{
        "current_password":"wrong-password",
        "new_password":"AnotherStrongPass456!",
    },headers=bearer)
    assert status==401 and bad_change["error"]=="invalid_current_password"

    status,changed=request("/api/v1/change-password","POST",{
        "current_password":"VeryStrongPass123!",
        "new_password":"AnotherStrongPass456!",
    },headers=bearer)
    assert status==200 and changed["other_sessions_revoked"] is True

    # Old password no longer works; new password does.
    status,_=request("/api/v1/login","POST",{
        "entity_slug":"entity-a",
        "email":"user@example.com",
        "password":"VeryStrongPass123!",
    })
    assert status==401

    status,new_login=request("/api/v1/login","POST",{
        "entity_slug":"entity-a",
        "email":"user@example.com",
        "password":"AnotherStrongPass456!",
    })
    assert status==200 and new_login["ok"]

    # Three bad attempts lock the same email/entity/IP fingerprint.
    with app.db_connect() as db:
        db.execute("DELETE FROM login_attempts")
        db.commit()
    for expected in (401,401,429):
        status,_=request("/api/v1/login","POST",{
            "entity_slug":"entity-b",
            "email":"user@example.com",
            "password":"not-the-password",
        })
        assert status==expected
    status,locked=request("/api/v1/login","POST",{
        "entity_slug":"entity-b",
        "email":"user@example.com",
        "password":"AnotherStrongPass456!",
    })
    assert status==429 and locked["error"]=="too_many_attempts"

    # Logout revokes the session.
    bearer2={"authorization":"Bearer "+new_login["access_token"]}
    status,out=request("/api/v1/logout","POST",{},headers=bearer2)
    assert status==200 and out["ok"]
    status,_=request("/api/v1/me",headers=bearer2)
    assert status==401

    # TOTP MFA enrollment and login challenge for a second user.
    status,mfa_login=request("/api/v1/login","POST",{
        "entity_slug":"entity-a",
        "email":"mfa@example.com",
        "password":"MfaStrongPass123!",
    })
    assert status==200 and mfa_login["ok"] and mfa_login["mfa"] is False
    mfa_bearer={"authorization":"Bearer "+mfa_login["access_token"]}

    status,enroll=request("/api/v1/mfa/enroll/start","POST",{},headers=mfa_bearer)
    assert status==200 and enroll["type"]=="totp" and enroll["secret"] and enroll["otpauth_uri"].startswith("otpauth://totp/")

    code=app.totp_code("usr_mfa")
    status,confirmed=request("/api/v1/mfa/enroll/confirm","POST",{"code":code},headers=mfa_bearer)
    assert status==200 and confirmed["mfa_enabled"] is True
    recovery_codes=confirmed["recovery_codes"]
    assert len(recovery_codes)==10

    status,mfa_required=request("/api/v1/login","POST",{
        "entity_slug":"entity-a",
        "email":"mfa@example.com",
        "password":"MfaStrongPass123!",
    })
    assert status==202 and mfa_required["mfa_required"] is True and mfa_required["challenge_token"]

    status,mfa_complete=request("/api/v1/login/mfa","POST",{
        "challenge_token":mfa_required["challenge_token"],
        "code":app.totp_code("usr_mfa"),
    })
    assert status==200 and mfa_complete["ok"] and mfa_complete["mfa"] is True

    # Recovery code is single-use and can complete a fresh MFA challenge.
    status,mfa_required2=request("/api/v1/login","POST",{
        "entity_slug":"entity-a",
        "email":"mfa@example.com",
        "password":"MfaStrongPass123!",
    })
    assert status==202
    status,recovered=request("/api/v1/login/mfa","POST",{
        "challenge_token":mfa_required2["challenge_token"],
        "recovery_code":recovery_codes[0],
    })
    assert status==200 and recovered["mfa"] is True

    status,mfa_required3=request("/api/v1/login","POST",{
        "entity_slug":"entity-a",
        "email":"mfa@example.com",
        "password":"MfaStrongPass123!",
    })
    assert status==202
    status,reused=request("/api/v1/login/mfa","POST",{
        "challenge_token":mfa_required3["challenge_token"],
        "recovery_code":recovery_codes[0],
    })
    assert status==401 and reused["error"]=="invalid_mfa_code"

    with app.db_connect() as db:
        events={r["event_type"] for r in db.execute("SELECT event_type FROM audit_events").fetchall()}
        assert "login.succeeded" in events
        assert "login.failed" in events
        assert "password.changed" in events
        assert "logout" in events
        assert "mfa.enabled" in events
        assert "login.mfa_required" in events

    print("IZAKHONO_ID_TEST=PASS")
finally:
    server.shutdown()
    server.server_close()
    TMP.cleanup()

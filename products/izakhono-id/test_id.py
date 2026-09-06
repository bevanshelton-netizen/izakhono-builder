#!/usr/bin/env python3
import importlib.util
import os
import tempfile
from pathlib import Path

TMP=tempfile.TemporaryDirectory()
os.environ["IZAKHONO_ID_DATA"]=TMP.name
os.environ["IZAKHONO_ID_ADMIN_KEY"]="admin-test"
os.environ["IZAKHONO_ID_INTERNAL_KEY"]="internal-test"
os.environ["IZAKHONO_ID_PBKDF2_ITERATIONS"]="1000"

spec=importlib.util.spec_from_file_location("izakhono_id",Path(__file__).with_name("app.py"))
app=importlib.util.module_from_spec(spec); spec.loader.exec_module(app)

with app.db_connect() as db:
    ts=app.now_iso()
    db.execute("INSERT INTO entities(id,slug,display_name,created_at) VALUES(?,?,?,?)",
               ("ent_a","entity-a","Entity A",ts))
    db.execute("INSERT INTO entities(id,slug,display_name,created_at) VALUES(?,?,?,?)",
               ("ent_b","entity-b","Entity B",ts))
    salt,digest=app.hash_password("VeryStrongPass123!")
    db.execute("INSERT INTO users(id,email,password_salt,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?)",
               ("usr_1","user@example.com",salt,digest,ts,ts))
    db.execute("INSERT INTO memberships(id,entity_id,user_id,role,created_at) VALUES(?,?,?,?,?)",
               ("mem_a","ent_a","usr_1","admin",ts))
    db.execute("INSERT INTO memberships(id,entity_id,user_id,role,created_at) VALUES(?,?,?,?,?)",
               ("mem_b","ent_b","usr_1","member",ts))
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

print("IZAKHONO_ID_TEST=PASS")
TMP.cleanup()

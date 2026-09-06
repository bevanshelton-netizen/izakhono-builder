#!/usr/bin/env python3
import hmac
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST=os.getenv("IZAKHONO_LEDGER_HOST","127.0.0.1")
PORT=int(os.getenv("IZAKHONO_LEDGER_PORT","9898"))
DATA_DIR=Path(os.getenv("IZAKHONO_LEDGER_DATA","./data"))
DB_PATH=DATA_DIR/"ledger.db"
INTERNAL_KEY=os.getenv("IZAKHONO_LEDGER_INTERNAL_KEY","")
MAX_BODY=500_000

def now_iso(): return datetime.now(timezone.utc).isoformat()
def safe_equal(a,b): return hmac.compare_digest(str(a),str(b))

def clean_slug(value,field="slug"):
    s=str(value or "").strip().lower()
    allowed=set("abcdefghijklmnopqrstuvwxyz0123456789-_")
    if not s or len(s)>80 or any(ch not in allowed for ch in s):
        raise ValueError(f"invalid_{field}")
    return s

def clean_text(value,field,maxlen=180):
    s=str(value or "").strip()
    if not s or len(s)>maxlen: raise ValueError(f"invalid_{field}")
    return s

def money_to_minor(value):
    try:
        d=Decimal(str(value))
    except InvalidOperation:
        raise ValueError("invalid_amount")
    if not d.is_finite(): raise ValueError("invalid_amount")
    minor=(d*100).quantize(Decimal("1"))
    if minor != d*100: raise ValueError("amount_must_have_max_2_decimals")
    n=int(minor)
    if n<=0 or n>10**15: raise ValueError("invalid_amount")
    return n

def db_connect():
    DATA_DIR.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(DB_PATH)
    db.row_factory=sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("""CREATE TABLE IF NOT EXISTS accounts(
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      UNIQUE(entity_id,code)
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS transactions(
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      reference TEXT NOT NULL,
      description TEXT NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      posted_at TEXT NOT NULL,
      UNIQUE(entity_id,reference)
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS postings(
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      side TEXT NOT NULL,
      amount_minor INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT,
      FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE RESTRICT
    )""")
    db.commit(); return db

def create_account(db,entity_id,code,name,account_type,currency="ZAR"):
    entity_id=clean_slug(entity_id,"entity_id")
    code=clean_slug(code,"account_code")
    name=clean_text(name,"name")
    account_type=clean_slug(account_type,"account_type")
    currency=clean_text(currency,"currency",3).upper()
    if account_type not in {"asset","liability","equity","income","expense"}:
        raise ValueError("invalid_account_type")
    account_id="acct_"+uuid.uuid4().hex
    db.execute("INSERT INTO accounts(id,entity_id,code,name,account_type,currency,created_at) VALUES(?,?,?,?,?,?,?)",
               (account_id,entity_id,code,name,account_type,currency,now_iso()))
    db.commit()
    return db.execute("SELECT * FROM accounts WHERE id=?",(account_id,)).fetchone()

def post_transaction(db,entity_id,reference,description,currency,lines):
    entity_id=clean_slug(entity_id,"entity_id")
    reference=clean_text(reference,"reference",120)
    description=clean_text(description,"description",240)
    currency=clean_text(currency or "ZAR","currency",3).upper()
    if not isinstance(lines,list) or len(lines)<2:
        raise ValueError("at_least_two_postings_required")

    debit_total=0; credit_total=0; normalized=[]
    for line in lines:
        if not isinstance(line,dict): raise ValueError("invalid_posting")
        account_code=clean_slug(line.get("account_code"),"account_code")
        side=str(line.get("side") or "").strip().lower()
        if side not in {"debit","credit"}: raise ValueError("invalid_posting_side")
        amount_minor=money_to_minor(line.get("amount"))
        account=db.execute("SELECT * FROM accounts WHERE entity_id=? AND code=? AND status='active'",
                           (entity_id,account_code)).fetchone()
        if not account: raise ValueError(f"account_not_found:{account_code}")
        if account["currency"]!=currency: raise ValueError("currency_mismatch")
        normalized.append((account,side,amount_minor))
        if side=="debit": debit_total+=amount_minor
        else: credit_total+=amount_minor

    if debit_total!=credit_total:
        raise ValueError("transaction_not_balanced")

    existing=db.execute("SELECT * FROM transactions WHERE entity_id=? AND reference=?",(entity_id,reference)).fetchone()
    if existing:
        rows=db.execute("""SELECT p.id,p.account_id,p.side,p.amount_minor,a.code AS account_code
                           FROM postings p JOIN accounts a ON a.id=p.account_id
                           WHERE p.transaction_id=? ORDER BY p.id""",(existing["id"],)).fetchall()
        return existing,rows,True

    txid="txn_"+uuid.uuid4().hex; ts=now_iso()
    try:
        db.execute("BEGIN IMMEDIATE")
        db.execute("""INSERT INTO transactions(id,entity_id,reference,description,currency,status,created_at,posted_at)
                      VALUES(?,?,?,?,?,'posted',?,?)""",(txid,entity_id,reference,description,currency,ts,ts))
        for account,side,amount_minor in normalized:
            db.execute("""INSERT INTO postings(id,transaction_id,entity_id,account_id,side,amount_minor,created_at)
                          VALUES(?,?,?,?,?,?,?)""",
                       ("pst_"+uuid.uuid4().hex,txid,entity_id,account["id"],side,amount_minor,ts))
        db.commit()
    except Exception:
        db.rollback(); raise

    tx=db.execute("SELECT * FROM transactions WHERE id=?",(txid,)).fetchone()
    rows=db.execute("""SELECT p.id,p.account_id,p.side,p.amount_minor,a.code AS account_code
                       FROM postings p JOIN accounts a ON a.id=p.account_id
                       WHERE p.transaction_id=? ORDER BY p.id""",(txid,)).fetchall()
    return tx,rows,False

def account_balance_minor(db,entity_id,code):
    entity_id=clean_slug(entity_id,"entity_id"); code=clean_slug(code,"account_code")
    account=db.execute("SELECT * FROM accounts WHERE entity_id=? AND code=?",(entity_id,code)).fetchone()
    if not account: raise ValueError("account_not_found")
    row=db.execute("""SELECT
      COALESCE(SUM(CASE WHEN p.side='debit' THEN p.amount_minor ELSE 0 END),0) debits,
      COALESCE(SUM(CASE WHEN p.side='credit' THEN p.amount_minor ELSE 0 END),0) credits
      FROM postings p WHERE p.entity_id=? AND p.account_id=?""",(entity_id,account["id"])).fetchone()
    debits=int(row["debits"]); credits=int(row["credits"])
    normal_debit=account["account_type"] in {"asset","expense"}
    balance=debits-credits if normal_debit else credits-debits
    return account,balance,debits,credits

def send_json(h,status,obj):
    body=json.dumps(obj,separators=(",",":")).encode()
    h.send_response(status); h.send_header("content-type","application/json; charset=utf-8")
    h.send_header("content-length",str(len(body))); h.send_header("cache-control","no-store")
    h.send_header("x-content-type-options","nosniff"); h.end_headers(); h.wfile.write(body)

class Handler(BaseHTTPRequestHandler):
    server_version="IzakhonoLedger/0.1"
    def log_message(self,fmt,*args): print(f"{self.client_address[0]} - {fmt % args}")
    def authorized(self):
        supplied=self.headers.get("x-izakhono-ledger-key","")
        return bool(INTERNAL_KEY and supplied and safe_equal(supplied,INTERNAL_KEY))
    def read_json(self):
        n=int(self.headers.get("content-length","0") or "0")
        if n<=0 or n>MAX_BODY: raise ValueError("invalid_body_size")
        return json.loads(self.rfile.read(n).decode())
    def do_GET(self):
        p=urlparse(self.path).path
        if p=="/healthz":
            return send_json(self,200,{"ok":True,"service":"izakhono-ledger","double_entry":True,"entity_isolation":True})
        if not self.authorized(): return send_json(self,401,{"ok":False,"error":"unauthorized"})
        if p.startswith("/api/v1/accounts/") and p.endswith("/balance"):
            parts=p.split("/")
            if len(parts)!=7: return send_json(self,404,{"ok":False,"error":"not_found"})
            entity_id=parts[4]; code=parts[5]
            try:
                with db_connect() as db: account,balance,debits,credits=account_balance_minor(db,entity_id,code)
                return send_json(self,200,{"ok":True,"entity_id":entity_id,"account":{"id":account["id"],"code":account["code"],"name":account["name"],"type":account["account_type"],"currency":account["currency"]},"balance_minor":balance,"debits_minor":debits,"credits_minor":credits})
            except ValueError as exc: return send_json(self,404,{"ok":False,"error":str(exc)})
        return send_json(self,404,{"ok":False,"error":"not_found"})
    def do_POST(self):
        p=urlparse(self.path).path
        if not self.authorized(): return send_json(self,401,{"ok":False,"error":"unauthorized"})
        try:data=self.read_json()
        except Exception:return send_json(self,400,{"ok":False,"error":"invalid_json"})
        if p=="/api/v1/accounts":
            try:
                with db_connect() as db:
                    row=create_account(db,data.get("entity_id"),data.get("code"),data.get("name"),data.get("account_type"),data.get("currency") or "ZAR")
                return send_json(self,201,{"ok":True,"account":dict(row)})
            except sqlite3.IntegrityError:return send_json(self,409,{"ok":False,"error":"account_exists"})
            except ValueError as exc:return send_json(self,422,{"ok":False,"error":str(exc)})
        if p=="/api/v1/transactions":
            try:
                with db_connect() as db:
                    tx,rows,idempotent=post_transaction(db,data.get("entity_id"),data.get("reference"),data.get("description"),data.get("currency") or "ZAR",data.get("lines"))
                return send_json(self,200 if idempotent else 201,{"ok":True,"idempotent_replay":idempotent,"transaction":dict(tx),"postings":[dict(r) for r in rows]})
            except ValueError as exc:return send_json(self,422,{"ok":False,"error":str(exc)})
        return send_json(self,404,{"ok":False,"error":"not_found"})

if __name__=="__main__":
    db_connect().close()
    print(f"IZAKHONO LEDGER listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()

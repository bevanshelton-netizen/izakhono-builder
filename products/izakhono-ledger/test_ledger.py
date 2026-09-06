#!/usr/bin/env python3
import importlib.util, os, tempfile
from pathlib import Path
TMP=tempfile.TemporaryDirectory()
os.environ["IZAKHONO_LEDGER_DATA"]=TMP.name
spec=importlib.util.spec_from_file_location("ledger",Path(__file__).with_name("app.py"))
l=importlib.util.module_from_spec(spec); spec.loader.exec_module(l)
with l.db_connect() as db:
    l.create_account(db,"entity-a","cash","Cash","asset","ZAR")
    l.create_account(db,"entity-a","sales","Sales","income","ZAR")
    l.create_account(db,"entity-b","cash","Cash","asset","ZAR")
    tx,rows,replay=l.post_transaction(db,"entity-a","INV-1","Sale","ZAR",[
        {"account_code":"cash","side":"debit","amount":"399.00"},
        {"account_code":"sales","side":"credit","amount":"399.00"}
    ])
    assert replay is False
    assert len(rows)==2
    _,bal,deb,cred=l.account_balance_minor(db,"entity-a","cash")
    assert bal==39900 and deb==39900 and cred==0
    _,bal_b,_,_=l.account_balance_minor(db,"entity-b","cash")
    assert bal_b==0
    _,_,replay2=l.post_transaction(db,"entity-a","INV-1","Sale","ZAR",[
        {"account_code":"cash","side":"debit","amount":"399.00"},
        {"account_code":"sales","side":"credit","amount":"399.00"}
    ])
    assert replay2 is True
    try:
        l.post_transaction(db,"entity-a","BAD-1","Bad","ZAR",[
            {"account_code":"cash","side":"debit","amount":"10.00"},
            {"account_code":"sales","side":"credit","amount":"9.00"}
        ])
        raise AssertionError("unbalanced transaction accepted")
    except ValueError as exc:
        assert str(exc)=="transaction_not_balanced"
print("IZAKHONO_LEDGER_TEST=PASS")
TMP.cleanup()

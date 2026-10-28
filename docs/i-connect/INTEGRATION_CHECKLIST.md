# I-CONNECT Integration Checklist

## Staging release

- [x] Dedicated GitHub staging branch exists
- [x] I-CONNECT release boundary documented
- [ ] Core MVP source integrated into staging branch
- [ ] Customer portal source integrated into staging branch
- [ ] Operations console source integrated into staging branch
- [ ] PostgreSQL schema integrated
- [ ] Docker staging environment validated
- [ ] Automated smoke test passes

## External activation gates

- [ ] Cell C / host MNO commercial agreement
- [ ] Host MNO technical/API credentials
- [ ] ICASA licensing/exemption determination
- [ ] Production RICA process and integration
- [ ] Production payment credentials
- [ ] Production security and monitoring verification
- [ ] Approved production deployment

## Rule

No item may be marked complete merely because a design, mock, contract, or simulation exists. A production item becomes green only after evidence-based verification.

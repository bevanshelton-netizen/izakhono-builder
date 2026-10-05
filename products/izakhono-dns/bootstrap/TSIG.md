# Authenticated zone transfer gate

NS1 and NS2 must not use unauthenticated AXFR/IXFR in production. The current NS1 bootstrap intentionally sets `allow-transfer { none; }` and the NS2 bootstrap documents that authenticated transfer is still required.

Before enabling a secondary in production, provision a TSIG key out-of-band and configure matching `key`/`allow-transfer`/`masters` statements on both hosts. Never commit the shared secret to Git, environment examples, CI logs, or activation receipts.

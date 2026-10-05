# DNS bootstrap validation

The bootstrap scripts are syntax-checked in GitHub Actions. Physical validation is intentionally separate.

After installing NS1 and NS2, from an independent network run:

```bash
export IZAKHONO_DNS_ZONE=example.com
export IZAKHONO_DNS_NS1=198.51.100.20
export IZAKHONO_DNS_NS2=198.51.100.21
./verify-host.sh
```

Replace the documentation-only addresses above with the actual public addresses. A successful result means the configured servers are responding as authoritative DNS servers; it does **not** by itself prove parent/registrar delegation or DNSSEC.

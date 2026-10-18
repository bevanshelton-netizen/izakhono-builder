# NODE01 Compliance Standard

NODE01 is compliant only when the deterministic `NODE-COMPLIANCE.sh` gate passes.

## Required gates

- Docker and Docker Compose operational
- Owned compose definition present and valid
- Runtime token and TLS email configured without placeholder values
- Ports 80/443 available or owned by IZAKHONO Docker services
- DNS TCP/UDP 53 available or owned by IZAKHONO Docker services
- IPv4 default route present
- IPv6 capability checked
- Outbound DNS and HTTPS available
- Persistent storage writable
- Activation privilege available
- Owned runtime health verified when the runtime is running

## Activation

From this directory:

```bash
bash NODE-COMPLIANCE.sh
bash NODE01-ACTIVATE.sh
```

The compliance gate is read-only: it does not expose secrets and does not mutate host state.

## Status rule

`NODE01 COMPLIANCE: PASSED` means the host satisfies the software/network prerequisites observable from the node. It does **not** by itself prove public reachability, DNS delegation, trusted public TLS, mail acceptance, backup/restore acceptance, or FORTRESS production acceptance. Those remain separate promotion gates.

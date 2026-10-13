# IZAKHONO DNS Authority — Production Gate

## Current state

The software/control-plane foundation is built. Public authoritative service is **not live yet** because public DNS authority requires two independently reachable servers and registrar delegation.

## Required before first delegation

1. Register/confirm an IZAKHONO-owned authority domain (example: `dns.izakhono.africa`; use the actual registered domain).
2. Provision **ns1** and **ns2** on independent networks/regions with stable public IPv4 addresses and IPv6 where available.
3. Expose UDP **and** TCP port 53.
4. Install the authoritative Knot runtime from this directory.
5. Render zones from IZAKHONO HOST and validate them with `knotc zone-check`/equivalent CI checks.
6. Verify direct SOA/NS answers from both nodes with recursion disabled.
7. Configure monitoring from independent public resolvers.
8. Configure registrar host/glue records for the authority nameservers where required.
9. Delegate `allegrovibez.com` to the IZAKHONO nameservers only after steps 1–8 pass.
10. Keep the previous DNS provider as a read-only fallback during stabilization.
11. Add DNSSEC after the unsigned delegation is stable and the DS/key-roll process is tested.

## Acceptance evidence

A domain can be marked `live` only when:

- both nameservers answer authoritatively over UDP and TCP 53;
- their SOA/NS data is consistent;
- public recursive resolvers return the expected NS records;
- the application resolves and serves valid TLS;
- the control plane stores the verification evidence and timestamp.

IANA's authoritative-server baseline requires at least two nameservers on different networks, public UDP/TCP 53 reachability, authoritative answers, consistency, and no open recursion. citeturn0search0

NIST's 2026 DNS deployment guidance also treats authoritative DNS integrity and DNSSEC as core enterprise security concerns. citeturn0search2turn0search10

# IZAKHONO Authoritative DNS Runtime

This is the first executable authoritative-DNS runtime for IZAKHONO HOST.

It deliberately runs outside serverless HTTP infrastructure because authoritative DNS requires public UDP/TCP port 53. The current fixture defaults to port 5353 for safe local testing.

## Production gate

Before this becomes public authority:

- deploy two independent nodes;
- expose UDP/TCP 53;
- load zones from the IZAKHONO HOST control plane rather than a local fixture;
- implement DNSSEC signing;
- add external resolver monitoring;
- provision stable `ns1` and `ns2` addresses;
- delegate a test domain at its registrar;
- verify A/AAAA/NS/SOA queries from independent networks.

The fixture `zones.json` is intentionally `example.invalid`; no production domain is silently delegated by this code.

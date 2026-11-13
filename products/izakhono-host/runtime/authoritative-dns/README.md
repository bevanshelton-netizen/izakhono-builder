# IZAKHONO Authoritative DNS Runtime

The authoritative DNS service is CoreDNS on public UDP/TCP port 53. A separate Node.js sync agent polls the authenticated HOST snapshot endpoint and writes validated RFC-style zone files into the shared `dns-zones` volume. CoreDNS's `auto` plugin discovers files named `db.<zone>` and reloads them.

## Runtime flow

1. HOST serves `GET /internal/dns/snapshot` using the dedicated `DNS_SYNC_TOKEN`.
2. The sync agent accepts only HTTPS endpoints (localhost is allowed for tests), sends the token as a bearer credential, and validates the complete snapshot before changing files.
3. It supports the current control-plane record contract: A, NS, CNAME, MX, TXT and SOA. It rejects malformed names, out-of-zone owners, invalid IPv4, invalid MX priorities, unsupported types and SOA serial mismatches.
4. Each zone file is written to a temporary file and atomically renamed. A managed-file manifest allows the agent to remove only zone files it previously generated.
5. CoreDNS auto-discovers the `db.<zone>` files from the shared volume. The agent never changes registrar delegation or changes a zone's HOST status.

## Local verification

Run the built-in tests with Node.js 22:

```sh
node --test sync-agent.test.mjs
```

The compose deployment requires `DNS_SYNC_URL` and `DNS_SYNC_TOKEN`. Keep the token private on HOST and the DNS node. Do not place it in browser code or customer-facing responses.

## Production gate

The current compose file describes one DNS node only. Before this becomes public authority:

- provision two independent DNS nodes in materially independent networks/regions;
- expose and verify UDP/TCP 53 on both;
- provide a private, reachable HTTPS HOST snapshot endpoint;
- confirm the CoreDNS auto plugin loads each generated zone and verify A/NS/SOA queries directly against both nodes;
- implement DNSSEC signing and key management;
- add external resolver monitoring, backups and restore drills;
- provision stable `ns1` and `ns2` addresses and glue records as required;
- delegate a test domain at its registrar and verify from independent public resolvers.

The fixture `zones.json` and `db.izakhono.local` are not used by the dynamic sync path. No production domain is silently delegated by this code.

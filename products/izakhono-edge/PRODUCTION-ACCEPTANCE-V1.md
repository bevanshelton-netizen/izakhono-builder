# IZAKHONO EDGE — Production Acceptance v1

This checklist is mandatory before calling IZAKHONO DNS or edge production-ready. NODE01 is the software runtime/orchestration layer; execution capacity and public network resources are separate dependencies.

## A. NODE01 software release and execution binding

- [ ] EDGE workloads conform to the current canonical NODE01 manifest schema.
- [ ] Workload artifacts have immutable digests and source provenance.
- [ ] Exact repository, commit, workload, environment and action scope are verified.
- [ ] FORTRESS/owner approval is valid, time-bounded and replay-resistant.
- [ ] NODE01 records workload lifecycle, health, audit and rollback evidence.
- [ ] Workloads are bound to approved execution capacity with identified ownership and administrative authority.
- [ ] Public IPs, routing and firewall policy are verified; management ports remain private.
- [ ] Backup and restore destinations are verified.
- [ ] No undocumented paid infrastructure has been provisioned.

## B. Authoritative DNS

For each DNS workload instance, from at least two independent external networks:

- [ ] Primary and secondary are distinct instances and independently placed across network/failure domains.
- [ ] UDP/53 SOA query succeeds.
- [ ] TCP/53 SOA query succeeds.
- [ ] AA flag is set.
- [ ] Recursion is disabled.
- [ ] SOA serial is consistent between primary and secondary.
- [ ] NS set is consistent and matches parent delegation.
- [ ] AXFR is denied to all unauthorized clients.
- [ ] AXFR/IXFR succeeds only for the authenticated secondary.
- [ ] Zone export matches the approved change snapshot.
- [ ] DNSSEC validation and DS chain pass before DNSSEC is marked enabled.

## C. Edge and TLS

- [ ] HTTP redirects to HTTPS.
- [ ] TLS certificate has correct hostname, chain and validity.
- [ ] Renewal is tested without manual intervention.
- [ ] Unknown hostnames cannot obtain certificates.
- [ ] Hostname routing cannot cross tenant boundaries.
- [ ] Only approved origins receive traffic.
- [ ] Origin direct access is blocked or explicitly marked transition.
- [ ] Health checks detect unhealthy origins and stop routing to them.

## D. WAF, abuse and caching

- [ ] OWASP CRS version is pinned and recorded.
- [ ] WAF runs in detection mode during baseline observation.
- [ ] Application false positives are reviewed with narrow documented exclusions.
- [ ] Block mode is tested against attack fixtures before activation.
- [ ] Rate limits cover authentication, form submission and expensive API routes.
- [ ] Emergency IP/ASN deny controls are tested.
- [ ] Cache bypasses authorization, cookies, private/no-store, admin and transactional routes.
- [ ] Purge by URL and hostname is tested.
- [ ] Cache cannot leak one tenant's content to another tenant.

## E. Observability and recovery

- [ ] DNS query telemetry and edge access logs are retained under an approved policy.
- [ ] WAF events, rate-limit events, cache hits/misses and origin latency are observable.
- [ ] Alerts cover DNS node loss, serial drift, certificate expiry, origin failure and storage pressure.
- [ ] Backups are encrypted and restore-tested.
- [ ] Registrar rollback instructions are available to the domain owner.
- [ ] Previous DNS provider remains available during the stabilization window.
- [ ] Incident and emergency lockdown procedures are rehearsed.

## F. Public migration

A domain migration proceeds one domain at a time:
1. Export the complete existing zone.
2. Compare all records, including mail, verification, CAA and security records.
3. Import into IZAKHONO and validate.
4. Test direct answers from both new authoritative nodes.
5. Lower TTLs and wait for the prior TTL window.
6. Obtain explicit approval for registrar delegation change.
7. Change delegation and glue only after the technical gates pass.
8. Verify parent and recursive resolver answers from independent networks.
9. Test web, TLS, mail delivery and all critical application paths.
10. Keep the rollback authority online until the stabilization period ends.

## Current gate result

**NOT READY FOR PUBLIC CUTOVER.**

The software architecture and repository assets are present, but public DNS endpoints, independent execution/network failure domains, registrar delegation, live TLS, WAF/cache behavior and public edge health have not been demonstrated. Repository/CI evidence is not a substitute for live production acceptance.

No public DNS or registrar changes are authorized by this checklist.

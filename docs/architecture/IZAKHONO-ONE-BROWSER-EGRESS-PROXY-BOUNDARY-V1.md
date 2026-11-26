# IZAKHONO ONE Browser Egress Proxy Boundary V1

Status: design contract only. No proxy process, firewall, Docker network, listener, DNS resolver, certificate, or host configuration is deployed by this document.

## Purpose

The browser container must have no direct Internet or DNS path. Its only network peer is an IZAKHONO-controlled egress proxy on a pre-provisioned internal Docker network. The proxy is a separate trust boundary; configuring Chromium's proxy flag is not a network security control by itself.

## Topology

- Browser runtime: disposable, non-root container with no host mounts and no published ports.
- Browser network: Docker internal network, independently inspected and attested before runtime creation.
- Egress proxy: the only permitted peer on that network; separate container identity and isolated runtime.
- Upstream: proxy-only outbound interface protected by host firewall policy. Browser traffic must never be forwarded directly.
- DNS: performed by the proxy using a controlled resolver. Browser DNS packets are denied at the network layer.

## Request policy

1. Accept only HTTP CONNECT for TCP port 443 and explicitly approved HTTPS proxy requests. Reject arbitrary ports, UDP, QUIC, SOCKS, raw IP destinations, and proxy chaining.
2. Parse and canonicalise the authority. Reject userinfo, malformed IDNs, ambiguous numeric hosts, trailing-dot tricks, zone identifiers, and invalid ports.
3. Resolve the hostname using the proxy-controlled resolver. Classify every A and AAAA result; reject the whole destination if any result is loopback, private, link-local, multicast, unspecified, reserved, IPv4-mapped private IPv6, or a cloud metadata/service endpoint.
4. Pin the selected validated IP to the actual upstream socket. Do not perform a second unconstrained DNS lookup between validation and connect.
5. Revalidate every new connection and every redirect. No automatic redirect following inside the proxy. A browser-originated new request must pass policy again.
6. Preserve TLS end-to-end for CONNECT. Do not install a trusted interception CA or inspect/decrypt user TLS in this phase.
7. Reject proxy authentication, credentials in URLs, client-supplied proxy headers, and forwarding headers that could influence upstream routing.
8. Apply bounded connect, handshake, idle and total deadlines; bounded concurrent tunnels; bounded request/header sizes; and byte quotas per session.
9. Emit structured audit metadata only: session/runtime IDs, canonical hostname, validated destination IP, port, decision, byte counts, duration, policy version and reason code. Never log cookies, authorization headers, request bodies, or TLS secrets.
10. Fail closed on resolver errors, policy lookup errors, attestation expiry, resource exhaustion, and audit subsystem failure when audit is configured as mandatory.

## Anti-bypass requirements

- Docker network is internal and has no default route to the Internet.
- Browser container has no DNS server access and no direct egress; host firewall independently enforces this.
- Only the proxy identity is attached to the browser network. Network membership and peer identity are inspected, not inferred from a network name.
- Proxy upstream egress is restricted to approved destination ports and the proxy process identity.
- Container network policy and firewall state are attested independently of the browser container's self-report.
- Chromium QUIC is disabled. UDP is blocked at the network boundary regardless of browser flags.
- Proxy hostnames resolve only on the internal Docker network and cannot be overridden by task input.

## Runtime integration contract

The Docker adapter must refuse create/start unless it receives fresh, signed host and network attestations bound to the requested runtime, network name, proxy identity and policy version. Attestations must be verified by a trusted verifier outside the browser container.

The browser runtime may report READY only after:
- the Docker daemon and seccomp prerequisites are verified;
- the image digest and container security options match the approved plan;
- the container is attached only to the inspected internal network;
- the proxy peer and anti-bypass firewall policy are verified;
- the browser process is confirmed running with the expected identity; and
- a signed isolation attestation is accepted by the supervisor.

A proxy health check alone is insufficient evidence of network isolation.

## Required tests before public browsing

- Reject localhost, RFC1918, CGNAT, link-local, multicast, reserved, metadata, IPv6 ULA/link-local and IPv4-mapped private addresses.
- Reject mixed DNS answers containing both public and prohibited addresses.
- Prove DNS rebinding resistance by confirming the connected socket uses the validated pinned IP.
- Reject redirect-to-private, cross-origin and protocol-downgrade destinations.
- Reject CONNECT to ports other than 443, UDP, QUIC and arbitrary proxy protocols.
- Verify no browser-originated DNS or direct Internet packets can leave the internal network.
- Verify the browser cannot reach any peer other than the approved proxy.
- Verify bounded resource use, deadlines, cancellation, audit redaction and fail-closed behavior.
- Run adversarial integration tests against the real NODE01 firewall and Docker network before enabling public navigation.

## Explicit non-goals

No TLS interception, cookies, authentication, real accounts, form submission, clicking, messaging, purchases, bookings, file uploads/downloads, shell access, or unrestricted browsing. This contract does not authorise installation, provisioning, deployment, paid services, or changes to NODE01.

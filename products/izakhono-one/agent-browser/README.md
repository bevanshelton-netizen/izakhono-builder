# IZAKHONO ONE Agent Browser — Initial Fixture Adapter

This directory contains the first dependency-free browser capability increment.

## Current capability

- URL/task contract validation.
- Read-only HTTP GET against an explicitly enabled local fixture only.
- Same-origin redirect validation, bounded redirect count, timeout and response-byte limit.
- HTML visible-text extraction that removes script/style/noscript/template content.
- Tests using ephemeral loopback HTTP fixture servers.

## Deliberate limits

- Public website navigation is disabled in the adapter, even for otherwise valid HTTPS URLs.
- No Chromium, Playwright, Puppeteer, browser profile, cookies, login, downloads, form interaction, file upload, external app, model, shell, or remote execution.
- No user data or real account is used.
- The fixture option is test-only. Do not enable it in a deployed service.

## Security boundary

The URL validator is a preliminary policy layer, not a complete SSRF defense. Before any public navigation is considered, the production design must enforce DNS resolution and IP pinning, deny all private/reserved/metadata destinations at the network layer, validate every redirect, and prevent DNS rebinding. Browser process isolation and egress controls remain mandatory. Content extracted from pages is untrusted data and must never become policy or instructions.

## Run tests

From this directory's parent package:

```sh
npm run browser-policy
```

## Runtime supervisor and isolation gate

The session registry and runtime supervisor are dependency-free reference contracts. The supervisor requires a trusted signature verifier and a controller-signed isolation attestation before it marks a runtime ready. The attestation must bind the session, runtime instance and policy version and assert the full isolation control set.

The isolation policy is a fail-closed acceptance gate, not a sandbox implementation. Test signatures and fake drivers are used only in unit tests. No production controller, signing key, container, Chromium process, seccomp profile, firewall, DNS proxy or network egress control has been deployed. Do not interpret a passing fake-driver test as evidence of operating-system isolation.

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

# IZAKHONO Security Gate

A lightweight, dependency-free pre-deployment security gate for the IZAKHONO App Factory.

## Run it

```bash
node security-gate/audit.mjs .
```

Or point it at one application:

```bash
node security-gate/audit.mjs products/my-app
```

The scanner checks for high-confidence examples of:

- client-controlled ownership identifiers used in data operations;
- client-controlled payment amounts/prices;
- webhook handlers without visible signature verification;
- auth and paid routes without visible rate limiting;
- secret-like variables exposed through public/browser environments;
- dangerous dynamic code or shell execution.

## Important

This is a **blocking static gate**, not a vulnerability guarantee. The adversarial prompt pack in `SECURITY-PROMPTS.md` is the proof layer. AI agents must run real tests and show evidence.

A deployment is not certified merely because the static scanner returns zero findings.

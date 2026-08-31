# FAIS Exam Prep — IZAKHONO BUILDER technical proof

This is the first independently materialized source bundle produced from the IZAKHONO BUILDER pattern.

It is intentionally a **technical proof**, not a statement that the FAIS product is commercially or regulatory ready.

## Validate

```bash
npm install
npm run validate
```

The validation gate performs a TypeScript check and a Cloudflare Wrangler deployment dry-run.

## Runtime proof

- `/` serves the generated static landing page.
- `/api/health` returns a generated health contract.
- `/api/features` returns the selected module flags.

No production credentials are committed in this proof bundle.

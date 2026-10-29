# IZAKHONO Production Deployment Check

This marker file exists to trigger the controlled production deployment workflow after CI validation.

Production deployment remains evidence-gated: credentials must be present, the Worker must build, Wrangler must deploy, and the authenticated MCP endpoint must be verified before any LIVE claim.

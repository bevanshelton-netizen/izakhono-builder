# IZAKHONO Continuous Builder MCP Bridge

Endpoint: `/mcp`

Authentication:
- `Authorization: Bearer <MCP_BRIDGE_TOKEN>` when a dedicated token is configured.
- The bridge also accepts the existing owner `ADMIN_SECRET` as a bearer token so no credential is embedded in source.

The bridge exposes controlled tools for:
- execution status
- project listing and inspection
- build-anything
- project autopilot
- generated-bundle validation
- execution evidence recording

The bridge is deliberately owner-authenticated. It never treats generated output as publicly live without deployment and acceptance evidence.

Hercules is the preferred external builder connection. The IZAKHONO execution engine remains the orchestration and audit layer.

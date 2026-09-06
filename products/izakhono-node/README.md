# IZAKHONO SERVICE PLUG

IZAKHONO Node is the group's owner-controlled deployment plug.

It now supports two deployment modes:

## Single-service mode

Existing safe deployment path for one Dockerfile / one application port.

Features:
- Git ref checkout
- image build
- canary health check
- production replacement
- rollback to previous image
- localhost binding by default
- optional public health confirmation

## Compose-service mode

For multi-process products such as ALLEGRO Radio.

Features:
- deploys an approved Docker Compose file from a repository
- environment files must remain under `/etc/izakhono/apps/`
- validates Compose configuration before start
- builds and starts the complete service stack
- requires a localhost health URL
- rolls back to the previous Git revision when the new stack fails health
- optional public URL verification

Example job:

```json
{
  "app": "allegro-radio",
  "repo": "https://github.com/bevanshelton-netizen/allegro-vibez.git",
  "ref": "main",
  "mode": "compose",
  "compose_file": "radio/owner-node/docker-compose.yml",
  "health_url": "http://127.0.0.1:8000/status-json.xsl",
  "env_file": "/etc/izakhono/apps/allegro-radio.env"
}
```

The Control service signs and submits the job to IZAKHONO Node. The node checks out the application and runs it on owner-controlled hardware.

## Security boundary

Compose health checks must point to localhost. Environment files are restricted to the IZAKHONO application secret directory. Public exposure should go through the future IZAKHONO EDGE/TLS layer rather than exposing arbitrary management ports directly.

## ALLEGRO Radio

This is the correct deployment primitive for:
- Autopilot
- Icecast listener origin
- Liquidsoap playout
- live presenter ingest
- persistent radio media/state

No Railway/Vercel-style runtime is required once a real Docker-capable IZAKHONO owner node is online and validated.

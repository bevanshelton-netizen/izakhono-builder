# IZAKHONO Owned Runtime Adapter

The production pipeline talks to one stable host contract:

`/opt/izakhono/bin/izakhono-release`

The adapter is deliberately separated from application repositories. Applications describe what they need; the runtime decides how containers, networks, ingress and rollback are implemented.

## Node contract

Each production node must provide:

- Docker Engine or an equivalent OCI runtime;
- the `izakhono-edge` network;
- persistent `/opt/izakhono` state;
- the `izakhono-release` adapter;
- access to the internal IZAKHONO control/data services;
- health monitoring and node-level backups;
- a registered GitHub Actions self-hosted runner labelled `izakhono-owned`, `linux`.

## N+3 target

The first node can be used to activate the pipeline, but it is not the final architecture. Production target is N+3 runtime capacity so that application availability is not dependent on NODE01.

The adapter must preserve the last verified release and make rollback deterministic.

## Security

The adapter is the only component allowed to translate a release receipt into runtime changes. Browser applications never receive Docker, SSH or infrastructure credentials.

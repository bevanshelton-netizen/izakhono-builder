# Super Engine owned-runtime contract

The Super Engine release path is deliberately split into candidate deployment, acceptance, and promotion.

## Exact runtime identity

The candidate artifact identity is the Docker image ID (`sha256:<64 hex>`). The release receipt must carry that exact value. A mutable tag is transport-only and must never be treated as release identity.

## Container identity

The owned runtime uses the canonical container name `izakhono-izakhono-super-engine`. This makes the running artifact directly addressable by the release adapter and prevents promotion from accidentally targeting an unrelated container.

## Network identity

The Super Engine is attached to the external `izakhono-edge` network. Public ingress is outside the application container and can be supplied by the owned IZAKHONO Edge layer. The application itself does not publish a host port as part of the release contract.

## Candidate state

Before acceptance, the deployment workflow records:

- `candidate.json` — release receipt
- `candidate.image` — exact local image reference
- `candidate.digest` — immutable image ID
- `running.digest` — immutable image ID observed from the running container

The workflow must verify that all three identities agree before acceptance.

## Promotion

The acceptance script is verification-only. It cannot write LIVE state.

The owned release adapter must then verify the candidate again and perform the only LIVE mutation. Promotion must fail closed if the running container, local image, receipt, or candidate digest disagree.

## Rollback

An existing LIVE target becomes rollback state only after its receipt, image reference, and immutable digest have all been verified. The first release records `rollback_mode=none` because no valid previous target exists.

Rollback restores the exact recorded image and receipt; it does not rebuild from source or resolve a mutable tag.

## Production evidence boundary

Repository files and CI validation establish the contract only. They do not prove that an owned Linux node, self-hosted runner, DNS, TLS ingress, or `/opt/izakhono/bin/izakhono-release` installation exists. Those remain runtime evidence requirements.

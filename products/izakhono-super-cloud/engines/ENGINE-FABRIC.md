# IZAKHONO SUPER CLOUD — ENGINE FABRIC

The engine layer turns the Super Cloud control plane into an executable cloud platform.

## Engines

1. Storage Engine — S3-compatible object storage, buckets, lifecycle and replication intent.
2. Image Engine — container image registry, image metadata, immutable digests and promotion gates.
3. Build Engine — source-to-image build jobs, build logs, artifacts and reproducibility metadata.
4. Observability Engine — health checks, metrics, logs, events and production evidence.
5. Media Engine — media ingest, transcode, packaging, origin and streaming workloads for KORA.
6. Queue Engine — durable asynchronous commands between control-plane and workers.
7. Backup Engine — backup policies, restore jobs, retention and recovery evidence.
8. Secrets Engine — secret references, rotation intent and provider abstraction; plaintext secrets never enter Git.

## Common contract

Every engine exposes health(), capabilities(), plan(command), execute(command), verify(result), and rollback(change) where applicable.

The engine layer is provider-neutral. Docker, MinIO, PostgreSQL, Valkey and future owned infrastructure are adapters, not business logic.

## Production rule

An engine may report READY only for work it has actually verified. LIVE_VERIFIED requires endpoint, health, security, backup/restore and rollback evidence from a real environment.

# IZAKHONO Super Engine Artifact Provenance

The owned-runtime release path must promote the exact container image that passed CI validation.

## Contract

1. CI builds the Super Engine image once.
2. CI smoke-tests that exact image.
3. CI exports that exact image as an immutable GitHub Actions artifact and records its SHA-256 archive checksum.
4. The owned runner downloads and verifies the artifact checksum before loading it.
5. The owned runner derives the image ID from the loaded image and records it as `release.artifact_digest`.
6. The owned runtime starts the loaded image without `--build`; the owned node therefore cannot silently rebuild a different image.
7. Acceptance validates the running candidate and public HTTPS health but does not mutate LIVE state.
8. Promotion is performed only by `/opt/izakhono/bin/izakhono-release promote`.
9. Promotion is fail-closed if the candidate artifact does not match the exact loaded image ID.

The current transport artifact is a GitHub Actions artifact used only to carry the already-tested OCI image from CI to the owned runner. It is not the production runtime or source of truth for application state. The production runtime remains the IZAKHONO-owned Linux node.

## Important distinction

The image ID is an immutable local content identifier for the exact loaded image. A future owned OCI registry can replace the Actions artifact transport while preserving this same provenance contract and digest verification model.

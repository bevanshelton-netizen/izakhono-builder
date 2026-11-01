# IZAKHONO Super Engine Artifact Provenance

The owned-runtime release path must promote the exact container image that passed CI validation.

1. CI builds the Super Engine image once and smoke-tests that exact image.
2. CI exports the tested image and checksum as an immutable workflow artifact.
3. The owned runner verifies the checksum before loading the image.
4. The loaded image ID becomes the release artifact identity.
5. The owned runtime starts the loaded image without rebuilding it.
6. Acceptance verifies health and HTTPS without mutating LIVE state.
7. Only the owned release adapter may promote candidate to LIVE.
8. Promotion fails closed if the candidate artifact does not match the loaded image ID.

The workflow artifact is transport only. Production remains the IZAKHONO-owned Linux runtime. A future owned OCI registry can replace the transport while preserving the same provenance contract.
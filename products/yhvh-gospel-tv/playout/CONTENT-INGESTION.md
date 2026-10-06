# YHVH GOSPEL TV — Content Ingestion & QC

## Objective
Move legitimate Gospel programming from submission/source into the IZAKHONO Content Vault without weakening rights, safeguarding, territory or technical controls.

## Gate
A media item is broadcast-eligible only when all are true:

1. The media file physically exists inside `YHVH_CONTENT_VAULT`.
2. The path is safe and remains inside the vault.
3. Rights are explicitly recorded as `CLEAR` with evidence.
4. The active territory is explicitly cleared.
5. Technical QC is `PASS`.
6. The content is otherwise approved by the editorial/safety workflow.

## QC checks
The technical QC engine verifies:
- file exists and is a regular file;
- safe relative path;
- supported video extension;
- non-zero file size.

Runtime media analysis (codec, duration, resolution, frame rate, audio presence, loudness and corruption) should be performed by FFprobe/FFmpeg before production broadcast approval.

## Rights rule
`FREE`, `CC`, `PUBLIC DOMAIN`, `Pexels`, `Pixabay`, or `Wikimedia Commons` source status does **not** automatically mean worldwide broadcast clearance. Preserve the source/license evidence and complete the YHVH rights review.

## Ingestion sequence
`SOURCE → RIGHTS EVIDENCE → REGISTER → COPY INTO VAULT → TECHNICAL QC → TERRITORY CLEARANCE → EDITORIAL/SAFETY REVIEW → READY → PLAYOUT`

Never reverse the sequence by putting unverified media into the live encoder.

## Test media
Engineering test files may be used to validate the pipeline, but must remain explicitly marked `TEST_ONLY` and must never be represented as Gospel programming or broadcast-cleared content.

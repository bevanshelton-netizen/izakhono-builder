# D1 → PostgreSQL migration rehearsal

This tool imports a versioned JSON export from the transitional D1 registry into the IZAKHONO PostgreSQL schema. It is deliberately **not** an automatic live migration.

## Export envelope

Create a UTF-8 JSON file with this shape (include only the tables being migrated; omitted tables are treated as empty):

```json
{
  "formatVersion": 1,
  "source": "izakhono-isbn-d1-export",
  "exportedAt": "2026-11-27T00:00:00Z",
  "tables": {
    "publishers": [],
    "imprints": [],
    "authors": [],
    "works": [],
    "work_authors": [],
    "editions": [],
    "agency_applications": [],
    "isbn_records": [],
    "legal_deposit_records": [],
    "audit_events": [],
    "agency_correspondence": []
  }
}
```

The export must contain records only. Never include database credentials, bearer tokens, environment variables or secrets. Preserve source IDs and all evidence references. Export correspondence as records; the importer never updates or deletes it.

## Export from the transitional D1 registry

The Worker now exposes a protected, allowlisted export endpoint. From a trusted administrator environment, set the base URL of the existing registry and its admin token in your shell, then download the export:

```sh
export REGISTRY_BASE_URL='https://your-existing-registry.example'
read -s ISBN_ADMIN_TOKEN
export ISBN_ADMIN_TOKEN
curl --fail --silent --show-error \
  -H "Authorization: Bearer ${ISBN_ADMIN_TOKEN}" \
  "${REGISTRY_BASE_URL}/api/export/registry.json" \
  --output ./d1-export.json
unset ISBN_ADMIN_TOKEN
```

Do not enable shell tracing while handling the token. Store the export in an access-controlled location and create an independent backup of the source database before importing. The endpoint exports only the fixed registry table allowlist; it does not export runtime environment variables or credentials. Review the file and its row counts before using it. This endpoint is protected by the same bearer-token gate as other management routes.

## Run a rehearsal (default)

From this directory, with Node.js 22 and the runtime's `pg` dependency installed:

```sh
export DATABASE_URL='postgresql://...'
node d1-export-to-postgres.mjs --input ./d1-export.json
```

The default mode validates the envelope, rejects unknown tables/columns, checks every ISBN-13 checksum and its authority/evidence fields, inserts in foreign-key order inside one transaction, then **rolls the transaction back**. This tests target constraints without committing rows.

## Commit an approved import

Only after a fresh D1 export, independent source backup, verified PostgreSQL backup, reviewed dry-run report, and explicit operator approval:

```sh
node d1-export-to-postgres.mjs --input ./d1-export.json --apply
```

`--apply` commits the complete import in one transaction. Existing primary-key or unique-key collisions fail the transaction; the tool does not silently overwrite or skip rows. On any error it rolls back. It does not drop tables, alter schema, allocate ISBNs, or contact an agency.

## Safety and release gates

- Dry-run is the default; `--apply` is an explicit opt-in.
- Target PostgreSQL schema must already be applied.
- Rows are inserted in dependency order; a failed foreign key or constraint aborts the entire transaction.
- Only allowlisted table and column names are accepted; values use PostgreSQL parameters.
- ISBNs are normalized only for spaces/hyphens and must pass ISBN-13 checksum, allocation-authority and evidence checks. Verified ISBNs require an allocation date.
- Correspondence IDs and evidence references are retained; correspondence is inserted only, never updated or deleted.
- Back up both systems and test restore/rollback independently before any real migration.
- Do not point this tool at production until the execution substrate, access policy, backup destination and costs are approved.


## Operator verification checklist (before any real import)

Run these steps on a trusted workstation or private administration host. Do not paste the bearer token, database URL, export contents or backup credentials into chat, tickets or terminal transcripts.

1. **Capture the source backup first.** Use the existing D1 platform's supported backup/export mechanism to create an independent source-database backup. Record its timestamp and retain it separately from the JSON registry export. Confirm that the backup is restorable using a disposable copy before treating it as a recovery point.
2. **Download and protect the registry export.** Follow the export procedure above. Restrict file permissions immediately:
   ```sh
   chmod 600 ./d1-export.json
   sha256sum ./d1-export.json > ./d1-export.json.sha256
   ```
   Retain the checksum with the migration evidence. Do not edit the export in place.
3. **Inspect the envelope and source counts without printing personal data.** With `jq` installed:
   ```sh
   jq -e '.formatVersion == 1 and .source == "izakhono-isbn-d1-export" and (.tables | type == "object")' ./d1-export.json >/dev/null
   jq -r '.exportedAt, (.tables | to_entries[] | "\(.key)\t\(.value | length)")' ./d1-export.json
   ```
   Confirm every expected table is present, including empty arrays, and investigate unexpected omissions or counts before continuing.
4. **Back up the PostgreSQL target independently.** Before rehearsal, verify the target identity and schema. Take a database backup to a separate access-controlled location and test restoring it to a disposable database. Never use a production destination for the first rehearsal.
5. **Run the importer in default dry-run mode.** Save the JSON summary and full error output in the restricted migration evidence directory. The expected mode is `dry-run-rolled-back`; its per-table inserted counts should match the export counts. Any validation, duplicate-key, foreign-key or constraint error is a stop condition.
6. **Reconcile the target.** Because dry-run rolls back, query each target table's row count before and after; counts must be unchanged. For a later approved apply to an empty disposable target, compare imported counts with the export counts and check foreign-key relationships, ISBN evidence references, audit history and correspondence IDs. A successful process exit alone is not reconciliation.
7. **Test recovery.** Restore the source backup and PostgreSQL backup into disposable environments and verify they are usable. Document the rollback procedure and who is authorised to execute it.
8. **Require an explicit go/no-go decision.** Only after independent backups, successful restore tests, count/relationship reconciliation and review of the dry-run report may an authorised operator run `--apply` against an explicitly identified disposable target. Production migration requires a separate approval and release plan; it is not authorised by this guide.

Keep a migration record containing: source backup identifier and timestamp, export checksum and timestamp, source table counts, target database identity, importer version/commit, dry-run output, post-run counts, restore-test result, operator and approval reference. Store the record without secrets or exported personal data.

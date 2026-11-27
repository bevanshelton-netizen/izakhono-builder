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

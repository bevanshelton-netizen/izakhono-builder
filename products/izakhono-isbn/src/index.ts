export interface Env {
  DB?: D1Database;
  ISBN_ADMIN_TOKEN?: string;
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

type Row = Record<string, unknown>;
const json = (data: Row, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const error = (code: string, status = 400) => json({ error: code }, status);
const id = () => crypto.randomUUID();

export function validIsbn13(input: string): boolean {
  const digits = input.replace(/[\s-]/g, "");
  if (!/^97[89]\d{10}$/.test(digits)) return false;
  const sum = [...digits.slice(0, 12)].reduce((n, d, i) => n + Number(d) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(digits[12]);
}
function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return '"' + s.replace(/"/g, '""') + '"';
}
async function audit(db: D1Database, actor: string, action: string, type: string, entityId: string | null, detail: Row = {}) {
  await db.prepare("INSERT INTO audit_events (id,actor,action,entity_type,entity_id,detail_json) VALUES (?,?,?,?,?,?)")
    .bind(id(), actor, action, type, entityId, JSON.stringify(detail)).run();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS ? env.ASSETS.fetch(request) : error("not_found", 404);
    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true, service: "IZAKHONO ISBN & Publishing Registry", release: "v1-foundation", databaseConfigured: Boolean(env.DB), productionReady: false });
    }
    if (!env.ISBN_ADMIN_TOKEN) return error("management_not_configured", 503);
    if (request.headers.get("authorization") !== `Bearer ${env.ISBN_ADMIN_TOKEN}`) return error("unauthorized", 401);
    if (!env.DB) return error("database_not_configured", 503);
    const db = env.DB;
    const actor = "registry-admin";

    try {
      if (request.method === "GET" && url.pathname === "/api/catalogue") {
        const result = await db.prepare(`SELECT w.id AS work_id,w.title,w.subtitle,w.language_code,e.id AS edition_id,e.edition_statement,e.format_code,e.publication_date,e.status AS edition_status,i.isbn13,i.verification_status,i.publisher_of_record FROM works w JOIN editions e ON e.work_id=w.id LEFT JOIN isbn_records i ON i.edition_id=e.id ORDER BY w.title,e.language_code,e.format_code`).all<Row>();
        return json({ items: result.results ?? [] });
      }

      if (request.method === "GET" && url.pathname === "/api/dashboard") {
        const [works, editions, allocated, pending, applications] = await Promise.all([
          db.prepare("SELECT COUNT(*) n FROM works").first<Row>(),
          db.prepare("SELECT COUNT(*) n FROM editions").first<Row>(),
          db.prepare("SELECT COUNT(*) n FROM isbn_records WHERE verification_status='verified'").first<Row>(),
          db.prepare("SELECT COUNT(*) n FROM editions WHERE status IN ('planned','submitted_to_agency')").first<Row>(),
          db.prepare("SELECT COUNT(*) n FROM agency_applications WHERE status IN ('submitted','acknowledged','information_requested')").first<Row>()
        ]);
        return json({ works: works?.n ?? 0, editions: editions?.n ?? 0, verifiedIsbns: allocated?.n ?? 0, editionsAwaitingIsbn: pending?.n ?? 0, openApplications: applications?.n ?? 0 });
      }

      if (url.pathname === "/api/work-authors") {
        if (request.method === "GET") {
          const result = await db.prepare("SELECT wa.work_id,wa.author_id,wa.contributor_role,wa.display_order,w.title AS work_title,a.display_name AS author_name,a.pen_name FROM work_authors wa JOIN works w ON w.id=wa.work_id JOIN authors a ON a.id=wa.author_id ORDER BY w.title,wa.display_order").all<Row>();
          return json({ items: result.results ?? [] });
        }
        if (request.method === "POST") {
          const body = await request.json() as Row;
          if (!body.work_id || !body.author_id) return error("work_id_and_author_id_required");
          const role = String(body.contributor_role || "author");
          if (!["author","editor","translator","illustrator","narrator","compiler","other"].includes(role)) return error("invalid_contributor_role");
          const order = Number(body.display_order ?? 1);
          if (!Number.isInteger(order) || order < 1 || order > 1000) return error("invalid_display_order");
          await db.prepare("INSERT INTO work_authors (work_id,author_id,contributor_role,display_order) VALUES (?,?,?,?)").bind(String(body.work_id),String(body.author_id),role,order).run();
          await audit(db, actor, "link_contributor", "work_author", String(body.work_id) + ":" + String(body.author_id), { role, order });
          return json({ linked: true }, 201);
        }
      }

      const resources: Record<string, { table: string; fields: string[] }> = {
        publishers: { table: "publishers", fields: ["legal_name","company_registration","country_code","physical_address","postal_address","contact_name","contact_email","contact_phone","website_url"] },
        imprints: { table: "imprints", fields: ["publisher_id","name","description","active"] },
        authors: { table: "authors", fields: ["display_name","legal_name","pen_name","email"] },
        works: { table: "works", fields: ["publisher_id","imprint_id","title","subtitle","language_code","description","subject_codes","publication_status"] },
        editions: { table: "editions", fields: ["work_id","edition_statement","format_code","language_code","publication_date","publication_place","publisher_display","page_count","duration_seconds","file_master_ref","distribution_channels","status"] },
        applications: { table: "agency_applications", fields: ["agency_name","contact_person","contact_email","submitted_at","follow_up_at","reference_number","status","titles_json","correspondence_notes","evidence_ref","next_action"] },
        isbns: { table: "isbn_records", fields: ["edition_id","isbn13","allocation_authority","allocation_date","publisher_of_record","verification_status","evidence_ref","barcode_asset_ref"] },
        "legal-deposits": { table: "legal_deposit_records", fields: ["edition_id","jurisdiction","required","due_date","submitted_at","recipient","proof_ref","status","notes"] }
      };
      const resource = url.pathname.match(/^\/api\/(publishers|imprints|authors|works|editions|applications|isbns|legal-deposits)$/);
      if (resource) {
        const key = resource[1], spec = resources[key];
        if (request.method === "GET") {
          const result = await db.prepare(`SELECT * FROM ${spec.table} ORDER BY created_at DESC LIMIT 500`).all<Row>();
          return json({ items: result.results ?? [] });
        }
        if (request.method === "POST") {
          const body = await request.json() as Row;
          const values = spec.fields.filter(f => body[f] !== undefined);
          if (!values.length) return error("no_valid_fields");
          if (key === "isbns") {
            const number = String(body.isbn13 ?? "");
            if (!validIsbn13(number)) return error("invalid_isbn13_checksum");
            if (!body.allocation_authority || !body.publisher_of_record || !body.evidence_ref) return error("allocation_authority_publisher_and_evidence_required");
            if (body.verification_status === "verified" && !body.evidence_ref) return error("verification_evidence_required");
            if (body.verification_status && !["unverified","evidence_pending","verified","disputed","withdrawn"].includes(String(body.verification_status))) return error("invalid_verification_status");
          }
          const recordId = id();
          const columns = ["id", ...values];
          const placeholders = columns.map(() => "?").join(",");
          const vals = [recordId, ...values.map(f => body[f])];
          await db.prepare(`INSERT INTO ${spec.table} (${columns.join(",")}) VALUES (${placeholders})`).bind(...vals).run();
          await audit(db, actor, "create", key, recordId, { fields: values });
          return json({ id: recordId, created: true }, 201);
        }
      }

      if (request.method === "GET" && url.pathname === "/api/export/catalogue.csv") {
        const result = await db.prepare(`SELECT w.title,w.subtitle,w.language_code,e.edition_statement,e.format_code,e.publication_date,e.status,i.isbn13,i.verification_status,i.publisher_of_record FROM works w JOIN editions e ON e.work_id=w.id LEFT JOIN isbn_records i ON i.edition_id=e.id ORDER BY w.title,e.format_code`).all<Row>();
        const fields = ["title","subtitle","language_code","edition_statement","format_code","publication_date","status","isbn13","verification_status","publisher_of_record"];
        const lines = [fields.join(","), ...(result.results ?? []).map(row => fields.map(f => csvCell(row[f])).join(","))];
        return new Response(lines.join("\\r\\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="izakhono-publishing-catalogue.csv"', "cache-control": "no-store" } });
      }
      return env.ASSETS ? env.ASSETS.fetch(request) : error("not_found", 404);
    } catch (e) {
      return json({ error: "request_failed", message: "The request could not be completed. Check the supplied fields and registry logs." }, 500);
    }
  }
};

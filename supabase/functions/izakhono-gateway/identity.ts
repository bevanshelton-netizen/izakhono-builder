import {
  isAllowedOrigin,
  productEntityAllowed,
  resolveIdentityContext,
  type IdentityContext,
} from "./identity-auth.ts";
import { createDefaultProviderRegistry, type ProviderCapability } from "./verification-providers.ts";
import { createDefaultEvidenceScanner } from "./evidence-scanner.ts";

const SUPA = Deno.env.get("SUPABASE_URL") || "";
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BUCKET = "identity-evidence";
const MAX = 10 * 1024 * 1024;
const MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const enc = new TextEncoder();
const PROVIDERS = createDefaultProviderRegistry();
const EVIDENCE_SCANNER = createDefaultEvidenceScanner();
const SCREENING_CAPABILITY: Record<string, ProviderCapability> = {
  identity_document: "document_authenticity",
  company_registry: "company_registry",
  sanctions: "sanctions",
  pep: "pep",
};

function screeningIsValid(screening: any, screeningType: string) {
  const capability = SCREENING_CAPABILITY[screeningType];
  return !!capability &&
    typeof screening.provider_code === "string" &&
    PROVIDERS.resolve(screening.provider_code, capability) !== null &&
    screening.outcome === "clear" &&
    !!screening.expires_at &&
    new Date(screening.expires_at) > new Date();
}

function responseHeaders(origin = "") {
  const h = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  if (origin) {
    h.set("access-control-allow-origin", origin);
    h.set("vary", "Origin");
  }
  return h;
}

function out(data: unknown, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders(origin),
  });
}

function bad(msg: string, status = 400, origin = "") {
  return out({ ok: false, error: msg }, status, origin);
}

function originFor(req: Request): string | null {
  const origin = req.headers.get("origin");
  const allowlist = (Deno.env.get("IDENTITY_ALLOWED_ORIGINS") || "")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
  return isAllowedOrigin(origin, allowlist) ? (origin || "") : null;
}

function headers(extra: Record<string, string> = {}) {
  return {
    "apikey": KEY,
    "authorization": "Bearer " + KEY,
    ...extra,
  };
}

async function hash(v: Uint8Array | string) {
  const view = typeof v === "string" ? enc.encode(v) : v;
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  const h = await crypto.subtle.digest("SHA-256", copy.buffer);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function db(table: string, q = "", init: RequestInit = {}) {
  if (!SUPA || !KEY) throw new Error("identity_database_not_configured");
  const h = new Headers(init.headers || {});
  h.set("apikey", KEY);
  h.set("authorization", "Bearer " + KEY);
  h.set("accept-profile", "identity");
  if (init.method && init.method !== "GET") h.set("content-profile", "identity");
  if (init.body && !h.has("content-type")) h.set("content-type", "application/json");
  const r = await fetch(SUPA + "/rest/v1/" + table + (q ? "?" + q : ""), {
    ...init,
    headers: h,
  });
  const t = await r.text();
  if (!r.ok) throw new Error("identity_db_" + r.status + ":" + t.slice(0, 180));
  return t ? JSON.parse(t) : null;
}

const txt = (v: unknown, n = 100) =>
  typeof v === "string" ? v.trim().slice(0, n) : "";

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

function caseFilter(id: string, ctx: IdentityContext) {
  return "id=eq." + encodeURIComponent(id) +
    "&entity_id=eq." + encodeURIComponent(ctx.entityId) +
    "&membership_id=eq." + encodeURIComponent(ctx.membershipId) +
    "&opened_by_user_id=eq." + encodeURIComponent(ctx.userId);
}

async function log(
  ctx: IdentityContext,
  event: string,
  subject: string | null,
  caseId: string | null,
  payload: unknown,
) {
  await db("audit_events", "", {
    method: "POST",
    headers: { "prefer": "return=minimal" },
    body: JSON.stringify({
      event_type: event,
      actor_type: "user",
      actor_ref_hash: await hash(ctx.userId),
      entity_id: ctx.entityId,
      membership_id: ctx.membershipId,
      subject_id: subject,
      case_id: caseId,
      payload_sha256: await hash(JSON.stringify(payload)),
    }),
  });
}

async function owned(id: string, ctx: IdentityContext) {
  if (!isUuid(id)) return null;
  const r = await db("verification_cases", caseFilter(id, ctx) + "&select=*");
  return r?.[0] || null;
}

async function store(path: string, file: File) {
  const url = SUPA + "/storage/v1/object/" + BUCKET + "/" +
    path.split("/").map(encodeURIComponent).join("/");
  const r = await fetch(url, {
    method: "POST",
    headers: headers({ "content-type": file.type, "x-upsert": "false" }),
    body: await file.arrayBuffer(),
  });
  if (!r.ok) throw new Error("private_upload_" + r.status);
}

function caseSummary(c: Record<string, unknown>) {
  return {
    id: c.id,
    verification_type: c.verification_type,
    product_code: c.product_code,
    country_code: c.country_code,
    status: c.status,
    risk_level: c.risk_level,
    submitted_at: c.submitted_at,
    expires_at: c.expires_at,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

export async function handleIdentity(req: Request, u: URL): Promise<Response | null> {
  const parts = u.pathname.split("/").filter(Boolean);
  const ix = parts.indexOf("identity");
  if (ix < 0) return null;

  const origin = originFor(req);
  if (origin === null) return bad("Origin is not authorised.", 403);

  if (req.method === "OPTIONS") {
    const h = new Headers({
      "access-control-allow-headers": "authorization, apikey, content-type, x-request-id",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-max-age": "86400",
      "vary": "Origin",
    });
    if (origin) h.set("access-control-allow-origin", origin);
    return new Response(null, { status: 204, headers: h });
  }

  const r = parts.slice(ix + 1);
  const method = req.method;

  if (method === "GET" && r.length === 1 && r[0] === "health") {
    return out({
      ok: true,
      service: "IZAKHONO Identity & Business Verification",
      version: "1.1.0",
      storage: SUPA && KEY ? "private" : "not_configured",
      authentication: "canonical_izakhono_id",
      canonical_identity_auth: Deno.env.get("IZAKHONO_ID_INTERNAL_URL") &&
          Deno.env.get("IZAKHONO_ID_INTERNAL_KEY") ? "configured" : "not_configured",
      product_entity_mapping: Deno.env.get("IDENTITY_PRODUCT_ENTITY_MAP") ? "configured" : "not_configured",
      evidence_scanner: EVIDENCE_SCANNER.isConfigured() ? "configured" : "not_configured",
      provider_integrations: PROVIDERS.list(),
      decision_mode: "fail_closed",
    }, 200, origin);
  }

  if (!SUPA || !KEY) return bad("Identity data service is not configured.", 503, origin);

  const auth = await resolveIdentityContext(req);
  if (!auth.ok) return bad(auth.error, auth.status, origin);
  const ctx = auth.context;

  try {
    if (method === "POST" && r.length === 1 && r[0] === "cases") {
      const b = await req.json();
      const st = txt(b.subject_type, 20);
      const vt = txt(b.verification_type, 3).toUpperCase();
      const cc = txt(b.country_code, 2).toUpperCase();
      const pc = txt(b.product_code, 50);

      if (!["individual", "business"].includes(st) ||
          !["KYC", "KYB"].includes(vt) ||
          !/^[A-Z]{2}$/.test(cc) ||
          !/^[A-Za-z0-9._-]{2,50}$/.test(pc)) {
        return bad("Invalid subject_type, verification_type, country_code or product_code.", 422, origin);
      }
      if ((st === "individual" && vt !== "KYC") ||
          (st === "business" && vt !== "KYB")) {
        return bad("KYC is for individuals; KYB is for businesses.", 422, origin);
      }

      const productMap = Deno.env.get("IDENTITY_PRODUCT_ENTITY_MAP") || "";
      if (!productMap.trim()) {
        return bad("Product-to-entity authorisation is not configured.", 503, origin);
      }
      if (!productEntityAllowed(productMap, pc, ctx.entityId)) {
        return bad("This product is not authorised for the active IZAKHONO entity.", 403, origin);
      }

      let subject: any;
      if (st === "individual") {
        const found = await db(
          "subjects",
          "canonical_user_id=eq." + encodeURIComponent(ctx.userId) +
            "&subject_type=eq.individual&select=*",
        );
        subject = found?.[0];
      } else {
        const found = await db(
          "subjects",
          "canonical_entity_id=eq." + encodeURIComponent(ctx.entityId) +
            "&subject_type=eq.business&select=*",
        );
        subject = found?.[0];
      }

      if (subject && subject.country_code !== cc) {
        return bad("The requested country does not match the existing identity record.", 409, origin);
      }

      if (!subject) {
        const subjectBody: Record<string, unknown> = {
          subject_type: st,
          country_code: cc,
          source_system: "izakhono_id",
        };
        if (st === "individual") subjectBody.canonical_user_id = ctx.userId;
        else subjectBody.canonical_entity_id = ctx.entityId;
        subject = (await db("subjects", "", {
          method: "POST",
          headers: { "prefer": "return=representation" },
          body: JSON.stringify(subjectBody),
        }))[0];
      }

      const c = (await db("verification_cases", "", {
        method: "POST",
        headers: { "prefer": "return=representation" },
        body: JSON.stringify({
          subject_id: subject.id,
          verification_type: vt,
          product_code: pc,
          country_code: cc,
          entity_id: ctx.entityId,
          membership_id: ctx.membershipId,
          opened_by_user_id: ctx.userId,
          canonical_session_id: ctx.sessionId,
          status: "draft",
        }),
      }))[0];

      await log(ctx, "case_created", subject.id, c.id, {
        verification_type: vt,
        product_code: pc,
        country_code: cc,
      });

      return out({
        ok: true,
        subject: { id: subject.id, subject_type: subject.subject_type, country_code: subject.country_code },
        case: caseSummary(c),
      }, 201, origin);
    }

    if (method === "GET" && r.length === 1 && r[0] === "cases") {
      const rows = await db(
        "verification_cases",
        "entity_id=eq." + encodeURIComponent(ctx.entityId) +
          "&membership_id=eq." + encodeURIComponent(ctx.membershipId) +
          "&opened_by_user_id=eq." + encodeURIComponent(ctx.userId) +
          "&select=id,verification_type,product_code,country_code,status,risk_level,submitted_at,expires_at,created_at,updated_at" +
          "&order=created_at.desc",
      );
      return out({ ok: true, cases: rows }, 200, origin);
    }

    if (r[0] !== "cases" || r.length < 2) return bad("Route not found.", 404, origin);

    const caseId = r[1];
    const c = await owned(caseId, ctx);
    if (!c) return bad("Verification case not found.", 404, origin);

    if (method === "GET" && r.length === 2) {
      const [ev, sc, de, rel] = await Promise.all([
        db("evidence", "case_id=eq." + encodeURIComponent(caseId) +
          "&select=id,evidence_type,status,issuer_code,issued_at,expires_on,created_at"),
        db("screenings", "case_id=eq." + encodeURIComponent(caseId) +
          "&select=id,screening_type,provider_code,outcome,checked_at,expires_at"),
        db("decisions", "case_id=eq." + encodeURIComponent(caseId) +
          "&select=id,decision,risk_score,risk_level,reason_codes,policy_version,created_at"),
        db("subject_relationships", "verification_case_id=eq." + encodeURIComponent(caseId) +
          "&select=id,relationship_type,ownership_percentage,verification_status,valid_from,valid_until"),
      ]);
      return out({
        ok: true,
        case: caseSummary(c),
        evidence: ev,
        screenings: sc,
        decisions: de,
        relationships: rel,
      }, 200, origin);
    }

    if (method === "POST" && r.length === 3 && r[2] === "evidence") {
      if (!["draft", "in_review"].includes(c.status)) {
        return bad("Evidence cannot be added to a closed case.", 409, origin);
      }
      const form = await req.formData();
      const file = form.get("file");
      const type = txt(form.get("evidence_type"), 60);
      if (!(file instanceof File) || !type) return bad("Attach a file and evidence_type.", 422, origin);
      if (file.size < 1 || file.size > MAX) return bad("Evidence must be 1 byte to 10 MB.", 413, origin);
      if (!MIME[file.type]) return bad("Only PDF, JPEG and PNG are accepted.", 415, origin);

      const bytes = new Uint8Array(await file.arrayBuffer());
      const valid = file.type === "application/pdf"
        ? new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
        : file.type === "image/png"
        ? bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
        : bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;

      if (!valid) return bad("File content does not match its declared MIME type.", 415, origin);

      const digest = await hash(bytes);
      const scan = await EVIDENCE_SCANNER.scan(bytes, digest);
      if (scan.status !== "clean") {
        await log(ctx, "evidence_scan_blocked", c.subject_id, caseId, {
          scan_status: scan.status,
          scan_code: scan.code,
          sha256: digest,
        });
        return bad(
          scan.status === "infected"
            ? "Evidence was rejected by malware scanning."
            : "Evidence scanning is unavailable or failed; upload blocked.",
          scan.status === "infected" ? 415 : 503,
          origin,
        );
      }
      const path = ctx.entityId + "/" + ctx.membershipId + "/" + caseId + "/" +
        crypto.randomUUID() + "." + MIME[file.type];

      await store(path, new File([bytes], "evidence." + MIME[file.type], { type: file.type }));
      try {
        const ev = (await db("evidence", "", {
          method: "POST",
          headers: { "prefer": "return=representation" },
          body: JSON.stringify({
            case_id: caseId,
            evidence_type: type,
            storage_bucket: BUCKET,
            storage_object_path: path,
            content_sha256: digest,
            status: "submitted",
            submitted_by_user_id: ctx.userId,
            malware_scan_status: scan.status,
            malware_scan_engine: scan.engine,
            malware_signature_version: scan.signatureVersion,
            malware_scanned_at: scan.scannedAt,
            malware_scan_sha256: scan.sha256,
            metadata: { mime_type: file.type, size_bytes: file.size },
          }),
        }))[0];
        await log(ctx, "evidence_uploaded", c.subject_id, caseId, {
          evidence_id: ev.id,
          sha256: digest,
          mime_type: file.type,
          size_bytes: file.size,
        });
        return out({
          ok: true,
          evidence: {
            id: ev.id,
            evidence_type: ev.evidence_type,
            status: ev.status,
            sha256: digest,
            malware_scan_status: ev.malware_scan_status,
          },
        }, 201, origin);
      } catch (e) {
        await fetch(
          SUPA + "/storage/v1/object/" + BUCKET + "/" +
            path.split("/").map(encodeURIComponent).join("/"),
          { method: "DELETE", headers: headers() },
        ).catch(() => {});
        throw e;
      }
    }

    if (method === "POST" && r.length === 3 && r[2] === "submit") {
      if (!["draft", "in_review"].includes(c.status)) return bad("Case is not submittable.", 409, origin);
      const ev = await db(
        "evidence",
        "case_id=eq." + encodeURIComponent(caseId) +
          "&select=id,evidence_type,status,content_sha256,malware_scan_status,malware_scan_sha256",
      );
      if (!ev.length) return bad("At least one evidence document is required.", 422, origin);
      if (ev.some((x: any) =>
        x.malware_scan_status !== "clean" ||
        !x.content_sha256 ||
        x.content_sha256 !== x.malware_scan_sha256
      )) return bad("All evidence must pass malware scanning before submission.", 422, origin);
      const needed = c.verification_type === "KYC" ? "identity_document" : "company_registration";
      if (!ev.some((x: any) => x.evidence_type === needed)) {
        return bad("Required evidence type missing: " + needed, 422, origin);
      }

      const updated = (await db("verification_cases", caseFilter(caseId, ctx), {
        method: "PATCH",
        headers: { "prefer": "return=representation" },
        body: JSON.stringify({ status: "submitted", submitted_at: new Date().toISOString() }),
      }))[0];
      if (!updated) return bad("Verification case is no longer available.", 409, origin);
      await log(ctx, "case_submitted", c.subject_id, caseId, { evidence_count: ev.length });
      return out({
        ok: true,
        case: caseSummary(updated),
        message: "Submitted for review; submission is not approval.",
      }, 200, origin);
    }

    if (method === "POST" && r.length === 3 && r[2] === "relationships") {
      if (c.verification_type !== "KYB") return bad("Relationships can only be added to KYB cases.", 409, origin);
      const b = await req.json();
      const kind = txt(b.relationship_type, 40);
      const pct = b.ownership_percentage == null ? null : Number(b.ownership_percentage);
      if (![
        "director", "beneficial_owner", "shareholder", "trustee", "partner",
        "authorised_representative", "controller",
      ].includes(kind)) return bad("Unsupported relationship_type.", 422, origin);
      if (pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
        return bad("Ownership percentage must be between 0 and 100.", 422, origin);
      }

      const person = (await db("subjects", "", {
        method: "POST",
        headers: { "prefer": "return=representation" },
        body: JSON.stringify({
          subject_type: "individual",
          country_code: c.country_code,
          source_system: "kyb_relationship",
        }),
      }))[0];

      const rel = (await db("subject_relationships", "", {
        method: "POST",
        headers: { "prefer": "return=representation" },
        body: JSON.stringify({
          verification_case_id: caseId,
          entity_subject_id: c.subject_id,
          person_subject_id: person.id,
          relationship_type: kind,
          ownership_percentage: pct,
          verification_status: "unverified",
        }),
      }))[0];

      await log(ctx, "kyb_relationship_added", c.subject_id, caseId, {
        relationship_type: kind,
        ownership_percentage: pct,
      });
      return out({
        ok: true,
        relationship: {
          id: rel.id,
          relationship_type: rel.relationship_type,
          ownership_percentage: rel.ownership_percentage,
          verification_status: rel.verification_status,
        },
        message: "Recorded as unverified; this does not satisfy KYB verification.",
      }, 201, origin);
    }

    if (method === "POST" && r.length === 3 && r[2] === "consent") {
      const b = await req.json();
      const purpose = txt(b.purpose_code, 80);
      const recipient = txt(b.recipient_product, 80);
      const basis = txt(b.legal_basis, 80);
      const notice = txt(b.notice_version, 40);
      const scopes = Array.isArray(b.scopes)
        ? b.scopes.map((x: unknown) => txt(x, 60)).filter(Boolean).slice(0, 20)
        : [];

      if (!purpose || !recipient || !basis || !notice || !scopes.length) {
        return bad("Purpose, recipient, legal basis, notice version and scopes are required.", 422, origin);
      }

      const digest = await hash(JSON.stringify({
        user_id: ctx.userId,
        entity_id: ctx.entityId,
        membership_id: ctx.membershipId,
        case_id: caseId,
        purpose,
        recipient,
        basis,
        notice,
        scopes,
        at: new Date().toISOString(),
      }));

      const grant = (await db("consent_grants", "", {
        method: "POST",
        headers: { "prefer": "return=representation" },
        body: JSON.stringify({
          subject_id: c.subject_id,
          verification_case_id: caseId,
          granted_by_user_id: ctx.userId,
          purpose_code: purpose,
          recipient_product: recipient,
          scopes,
          legal_basis: basis,
          notice_version: notice,
          consent_record_sha256: digest,
        }),
      }))[0];

      await log(ctx, "consent_granted", c.subject_id, caseId, {
        consent_id: grant.id,
        purpose,
        recipient,
        scopes,
      });
      return out({
        ok: true,
        consent: { id: grant.id, status: grant.status, granted_at: grant.granted_at },
      }, 201, origin);
    }

    if (method === "POST" && r.length === 3 && r[2] === "evaluate") {
      const [ev, sc] = await Promise.all([
        db("evidence", "case_id=eq." + encodeURIComponent(caseId) +
          "&select=id,status,evidence_type,content_sha256,malware_scan_status,malware_scan_sha256"),
        db("screenings", "case_id=eq." + encodeURIComponent(caseId) + "&select=id,screening_type,outcome,expires_at"),
      ]);

      const types = c.verification_type === "KYC"
        ? ["identity_document", "sanctions", "pep"]
        : ["company_registry", "sanctions", "pep"];
      const missing = types.filter((t) =>
        !sc.some((x: any) =>
          x.screening_type === t && screeningIsValid(x, t)
        )
      );

      const reasons: string[] = [];
      if (!ev.length) reasons.push("EVIDENCE_MISSING");
      if (ev.some((x: any) => x.status !== "validated")) reasons.push("EVIDENCE_NOT_VALIDATED");
      if (ev.some((x: any) =>
        x.malware_scan_status !== "clean" ||
        !x.content_sha256 ||
        x.content_sha256 !== x.malware_scan_sha256
      )) reasons.push("EVIDENCE_MALWARE_SCAN_MISSING_OR_HASH_MISMATCH");
      if (missing.length) reasons.push("PROVIDER_SCREENING_NOT_CONFIGURED");
      reasons.push("HUMAN_REVIEW_REQUIRED");

      const snapshot = await hash(JSON.stringify({
        case_id: caseId,
        entity_id: ctx.entityId,
        membership_id: ctx.membershipId,
        evidence: ev,
        screenings: sc,
        policy: "ZA-KYC-KYB-1.0",
      }));

      const d = (await db("decisions", "", {
        method: "POST",
        headers: { "prefer": "return=representation" },
        body: JSON.stringify({
          case_id: caseId,
          decision: "REVIEW",
          risk_score: 50,
          risk_level: "medium",
          reason_codes: reasons,
          policy_version: "ZA-KYC-KYB-1.0",
          evidence_snapshot_sha256: snapshot,
          decided_by_user_id: ctx.userId,
          decision_origin: "rules_engine",
        }),
      }))[0];

      await db("verification_cases", caseFilter(caseId, ctx), {
        method: "PATCH",
        body: JSON.stringify({ status: "in_review", risk_level: "medium" }),
      });
      await log(ctx, "case_evaluated", c.subject_id, caseId, {
        decision: "REVIEW",
        reason_codes: reasons,
        snapshot,
      });

      return out({
        ok: true,
        decision: d,
        message: "Fail-closed evaluation: manual review and authorised provider checks remain required.",
      }, 200, origin);
    }

    return bad("Route not found.", 404, origin);
  } catch (e) {
    console.error("identity_api_error", e);
    return bad("Request failed. Check server logs using the request timestamp.", 500, origin);
  }
}

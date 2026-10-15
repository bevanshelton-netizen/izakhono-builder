import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// IZAKHONO CALLBACK request intake — deploy as a Supabase Edge Function.
// Public endpoint: requires strict validation, abuse controls and explicit request/consent.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const str = (v: unknown, n = 200) => typeof v === "string" ? v.trim().slice(0, n) : "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  const length = Number(req.headers.get("content-length") || 0);
  if (length > 12000) return reply(413, { error: "Request too large" });

  let b: Record<string, unknown>;
  try { b = await req.json(); if (!b || Array.isArray(b) || typeof b !== "object") throw new Error(); }
  catch { return reply(400, { error: "Please submit a valid callback request." }); }

  // Honeypot field for basic bot filtering.
  if (str(b.website, 200)) return reply(200, { ok: true });
  const full_name = str(b.full_name, 120);
  const phone = str(b.phone, 30);
  const email = str(b.email, 254).toLowerCase();
  const interest = str(b.interest, 160);
  const tenant_slug = str(b.tenant_slug || "edu-build", 80).toLowerCase();
  const source = str(b.source || "advert", 60);
  const campaign = str(b.campaign, 120);
  const campus = str(b.campus, 120);
  const preferred_time = str(b.preferred_time, 120);
  const consent_call = b.consent_call === true;
  const consent_text = str(b.consent_text, 500);

  if (full_name.length < 2 || phone.length < 7 || interest.length < 2)
    return reply(422, { error: "Name, mobile number and enquiry are required." });
  if (email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))
    return reply(422, { error: "Please enter a valid email address." });
  if (!consent_call || consent_text.length < 20)
    return reply(422, { error: "Please confirm that you are requesting a call about this enquiry." });
  if (!/^[a-z0-9-]{2,80}$/.test(tenant_slug))
    return reply(422, { error: "Invalid business identifier." });

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply(503, { error: "Callback requests are temporarily unavailable." });

  const now = new Date().toISOString();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const salt = Deno.env.get("CALLBACK_IP_HASH_SALT");
  let ipHash: string | null = null;
  if (ip && salt) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + ip));
    ipHash = Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, "0")).join("");
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
  const response = await fetch(`${url}/rest/v1/izakhono_callback_requests`, {
    method: "POST", headers,
    body: JSON.stringify({
      tenant_slug, full_name, phone, email: email || null, interest, campus: campus || null,
      preferred_time: preferred_time || null, source, campaign: campaign || null,
      consent_call, consent_text, consent_at: now, consent_ip_hash: ipHash,
      status: preferred_time ? "scheduled" : "requested",
      outcome: "Request recorded; no telephone call has been placed yet."
    })
  });
  if (!response.ok) {
    console.error("Callback request insert failed", response.status, (await response.text()).slice(0, 300));
    return reply(503, { error: "We could not save your request. Please try again shortly." });
  }
  const rows = await response.json();
  const row = rows?.[0];
  if (row?.id) {
    await fetch(`${url}/rest/v1/izakhono_callback_audit`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ request_id: row.id, event_type: "callback_requested",
        event_detail: { tenant_slug, source, campaign: campaign || null, consent_at: now, preferred_time: preferred_time || null } })
    });
  }
  return reply(201, { ok: true, request_id: row?.id, status: row?.status || "requested",
    message: "Your callback request has been recorded. Our team will contact you at the requested time." });
});

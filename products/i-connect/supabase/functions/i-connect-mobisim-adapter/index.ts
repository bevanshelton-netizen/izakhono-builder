import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MERCHANT_ID = Deno.env.get("MOBISIM_MERCHANT_ID");
const API_KEY = Deno.env.get("MOBISIM_API_KEY");
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function mobisim(path: string, method: "GET" | "POST" = "GET", body?: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`https://partners-api.mobisim.com${path}`, {
      method,
      headers: {
        "X-Merchant-Id": MERCHANT_ID!,
        "X-Api-Key": API_KEY!,
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) {
      return { ok: false, status: response.status, message: payload?.message ?? "supplier_request_failed" };
    }
    return { ok: true, status: response.status, data: payload.data, page: payload.page, pageSize: payload.pageSize, totalCount: payload.totalCount, totalPages: payload.totalPages };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  const token = req.headers.get("x-i-connect-worker-token");
  const { data: authorized, error: authError } = await supabase.rpc("ic_verify_provisioner_worker_token", { p_token: token });
  if (authError || authorized !== true) return reply({ error: "unauthorized" }, 401);

  if (!MERCHANT_ID || !API_KEY) {
    return reply({ error: "supplier_credentials_not_configured", provider: "mobisim", production_enabled: false }, 424);
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action === "account_check") {
    const result = await mobisim("/api/Account/Me");
    return reply({ provider: "mobisim", action, ...result }, result.ok ? 200 : 502);
  }
  if (action === "catalogue") {
    const all = body?.all === true;
    const includeDetails = body?.include_details === true;
    const query = all
      ? "?all=true" + (includeDetails ? "&includeDetails=true" : "")
      : "?page=1&pageSize=50" + (includeDetails ? "&includeDetails=true" : "");
    const result = await mobisim("/api/Packages/GetPackages" + query);
    return reply({ provider: "mobisim", action, ...result }, result.ok ? 200 : 502);
  }

  if (action === "test_buy") {
    const packageId = body?.packageId;
    const email = body?.email;
    const firstName = body?.firstName;
    const lastName = body?.lastName;
    const quantity = body?.quantity ?? 1;
    if (!Number.isInteger(packageId) || Number(packageId) <= 0 ||
        typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !Number.isInteger(quantity) || Number(quantity) !== 1 ||
        (firstName !== undefined && typeof firstName !== "string") ||
        (lastName !== undefined && typeof lastName !== "string")) {
      return reply({ error: "invalid_test_buy_request", required: ["packageId (positive integer)", "email (valid email)"], allowed_quantity: 1 }, 400);
    }
    const testPayload = {
      packageId: Number(packageId),
      quantity: 1,
      email,
      ...(typeof firstName === "string" ? { firstName } : {}),
      ...(typeof lastName === "string" ? { lastName } : {}),
      sendEmail: false,
    };
    const result = await mobisim("/api/Purchase/TestBuy", "POST", testPayload);
    return reply({ provider: "mobisim", action, test_only: true, wallet_charge_expected: false, provider_contact_expected: false, ...result }, result.ok ? 200 : 502);
  }

  return reply({
    error: "unsupported_action",
    allowed_actions: ["account_check", "catalogue", "test_buy"],
    note: "Only MobiSIM TestBuy is supported for purchase testing; live Buy, top-ups, wallet changes and production provisioning remain disabled.",
  }, 400);
});

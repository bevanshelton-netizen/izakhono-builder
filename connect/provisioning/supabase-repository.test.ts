import { strict as assert } from "node:assert";
import {
  SupabaseConnectProvisioningRepository,
  createSupabaseConnectProvisioningRepositoryFromEnv,
} from "./supabase-repository";

const originalFetch = globalThis.fetch;

try {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(
      JSON.stringify([
        {
          id: "prov-1",
          order_id: "order-1",
          overall_status: "payment_confirmed",
          current_step: "payment",
          progress: 20,
          blockers: [],
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  const repo = new SupabaseConnectProvisioningRepository({
    url: "https://example.supabase.co/",
    serviceRoleKey: "server-secret",
  });

  const provisioning = await repo.getProvisioning("order-1");
  assert.equal(provisioning?.id, "prov-1");
  assert.equal(provisioning?.state.status, "payment_confirmed");
  assert.equal(calls[0]?.url, "https://example.supabase.co/rest/v1/iz_connect_provisioning?select=id,order_id,overall_status,current_step,progress,selected_provider,blockers&order_id=eq.order-1&limit=1");

  const envRepo = createSupabaseConnectProvisioningRepositoryFromEnv({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "server-secret",
  });
  assert.ok(envRepo instanceof SupabaseConnectProvisioningRepository);

  assert.throws(
    () => createSupabaseConnectProvisioningRepositoryFromEnv({}),
    /Missing server-side Supabase environment configuration/,
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log("supabase repository tests passed");

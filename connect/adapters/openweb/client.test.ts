import { strict as assert } from "node:assert";
import { createOpenWebClient } from "./client";

async function main(): Promise<void> {
  let captured: Request | undefined;
  const fakeFetch: typeof fetch = async (input, init) => {
    captured = new Request(input, init);
    return new Response(JSON.stringify({ products: [] }), {
      status: 200,
      headers: { "content-type": "application/json", "x-request-id": "test-request" },
    });
  };

  assert.throws(() => createOpenWebClient({ token: "" }), /OPENWEB_API_TOKEN/);

  const client = createOpenWebClient({ token: "server-only-test-token", fetchImpl: fakeFetch });
  const result = await client.products();

  assert.equal(result.ok, true);
  assert.ok(captured);
  assert.equal(captured!.url, "https://reseller.openweb.co.za/api/v1/products");
  assert.equal(captured!.headers.get("authorization"), "Bearer server-only-test-token");
  assert.equal(captured!.headers.get("accept"), "application/json");
  assert.equal((result as { ok: true; requestId?: string }).requestId, "test-request");

  console.log("OpenWeb client contract tests passed");
}

void main();

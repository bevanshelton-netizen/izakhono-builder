import { handleApi } from "./api";

const owner = { userId: "user-1", tenantId: "tenant-1", role: "OWNER" as const };
const otherTenant = { userId: "user-2", tenantId: "tenant-2", role: "OWNER" as const };

async function run() {
  const unauthenticated = await handleApi({ method: "POST", path: "/v1/provisioning", body: { idempotency_key: "job-api-auth", tenant_id: "tenant-1" } }, "req-auth");
  if (unauthenticated.status !== 401) throw new Error("authentication_boundary_failed");

  const created = await handleApi({ method: "POST", path: "/v1/provisioning", principal: owner, body: { idempotency_key: "job-api-1", tenant_id: "tenant-1" } }, "req-1");
  if (created.status !== 201) throw new Error("provisioning_create_failed");
  const job = created.data as { id: string };

  const duplicate = await handleApi({ method: "POST", path: "/v1/provisioning", principal: owner, body: { idempotency_key: "job-api-1", tenant_id: "tenant-1" } }, "req-2");
  if (duplicate.status !== 200) throw new Error("idempotency_failed");

  const fetched = await handleApi({ method: "GET", path: `/v1/provisioning/${job.id}`, principal: owner, body: { tenant_id: "tenant-1" } }, "req-3");
  if (fetched.status !== 200) throw new Error("job_fetch_failed");

  const crossTenant = await handleApi({ method: "GET", path: `/v1/provisioning/${job.id}`, principal: otherTenant, body: { tenant_id: "tenant-2" } }, "req-4");
  if (crossTenant.status !== 404) throw new Error("tenant_isolation_failed");

  const numbers = await handleApi({ method: "GET", path: "/v1/numbers", principal: owner, body: { tenant_id: "tenant-1", query: "0123" } }, "req-5");
  if (numbers.status !== 200 || !Array.isArray(numbers.data)) throw new Error("number_search_failed");

  console.log("communications API auth/repository test: PASS");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

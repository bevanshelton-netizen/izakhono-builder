import { handleApi } from "./api";

async function run() {
  const created = await handleApi({ method: "POST", path: "/v1/provisioning", body: { idempotency_key: "job-api-1", tenant_id: "tenant-1" } }, "req-1");
  if (created.status !== 201) throw new Error("provisioning_create_failed");

  const duplicate = await handleApi({ method: "POST", path: "/v1/provisioning", body: { idempotency_key: "job-api-1", tenant_id: "tenant-1" } }, "req-2");
  if (duplicate.status !== 200) throw new Error("idempotency_failed");

  const fetched = await handleApi({ method: "GET", path: "/v1/provisioning/job-api-1" }, "req-3");
  if (fetched.status !== 200) throw new Error("job_fetch_failed");

  const numbers = await handleApi({ method: "GET", path: "/v1/numbers", body: { query: "0123" } }, "req-4");
  if (numbers.status !== 200 || !Array.isArray(numbers.data)) throw new Error("number_search_failed");

  console.log("communications API test: PASS");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

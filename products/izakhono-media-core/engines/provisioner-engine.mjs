export const PROVISION_STEPS = [
  "payment_verified",
  "channel_created",
  "storage_allocated",
  "domain_configured",
  "dns_configured",
  "tls_configured",
  "stream_health_verified",
  "approved",
  "published"
];

export function createProvisioningJob(order) {
  if (!order || order.payment_status !== "paid") throw new Error("paid order required before provisioning");
  return {
    id: `job_${Date.now().toString(36)}`,
    order_id: String(order.id),
    status: "payment_verified",
    completed_steps: ["payment_verified"],
    next_step: "channel_created",
    approval_required: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function advanceProvisioning(job, step, metadata = {}) {
  if (!job) throw new Error("job is required");
  const target = String(step);
  const index = PROVISION_STEPS.indexOf(target);
  if (index < 0) throw new Error(`unknown provisioning step: ${target}`);
  const completed = new Set(job.completed_steps || []);
  const previous = PROVISION_STEPS[index - 1];
  if (previous && !completed.has(previous)) throw new Error(`cannot advance before ${previous}`);
  completed.add(target);
  const next = PROVISION_STEPS[index + 1] || null;
  return { ...job, status: target, completed_steps: PROVISION_STEPS.filter(x => completed.has(x)), next_step: next, metadata: { ...(job.metadata || {}), [target]: metadata }, updated_at: new Date().toISOString() };
}

export function isPublished(job) {
  return Boolean(job && job.status === "published" && (job.completed_steps || []).includes("approved"));
}

// This contract mirrors ic_initialize_provisioning_steps in Supabase.
export const PROVISIONING_STEPS = Object.freeze([
  'payment_verified',
  'account_ready',
  'domain_requested',
  'dns_configured',
  'hosting_ready',
  'ssl_verified',
  'email_configured',
  'application_deployed',
  'integrations_connected',
  'verification_complete',
  'handover_ready',
]);

export const TERMINAL_STATUSES = Object.freeze(['completed', 'failed', 'blocked']);

export const isValidStep = (step) => PROVISIONING_STEPS.includes(step);
export const isValidStatus = (status) => TERMINAL_STATUSES.includes(status);

export const nextStep = (step) => {
  const index = PROVISIONING_STEPS.indexOf(step);
  if (index < 0 || index + 1 >= PROVISIONING_STEPS.length) return null;
  return PROVISIONING_STEPS[index + 1];
};

export const isTerminalReady = (step, status) =>
  step === 'handover_ready' && status === 'completed';

// DB uniqueness is enforced by (job_id, step_key). Attempt numbers are
// provider retry telemetry and must not create duplicate provisioning jobs.
export const stepIdempotencyKey = ({ jobId, step }) =>
  `provision:${jobId}:${step}`;

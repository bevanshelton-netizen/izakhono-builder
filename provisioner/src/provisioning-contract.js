export const PROVISIONING_STEPS = Object.freeze([
  'payment_verified',
  'customer_created',
  'domain_registered_or_connected',
  'dns_configured',
  'website_provisioned',
  'ssl_activated',
  'email_created',
  'crm_created',
  'forms_connected',
  'payment_connected',
  'customer_account_created',
  'access_delivered',
  'service_ready',
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
  step === 'service_ready' && status === 'completed';

export const idempotencyKey = ({ orderId, step, attempt = 1 }) =>
  `provision:${orderId}:${step}:${attempt}`;

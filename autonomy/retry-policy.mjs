const BASE_DELAY_MS = 5 * 60 * 1000;
const MAX_DELAY_MS = 6 * 60 * 60 * 1000;

export function retryDelayMs(attempts = 1) {
  const count = Number.isFinite(Number(attempts)) ? Math.max(1, Math.floor(Number(attempts))) : 1;
  const exponent = Math.min(16, count - 1);
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * (2 ** exponent));
}

export function waitingRetryDue(task, now = Date.now()) {
  if (task?.status !== 'waiting') return true;
  const scheduled = task.retryAfter
    ? Date.parse(task.retryAfter)
    : Date.parse(task.updatedAt) + retryDelayMs(task.attempts);
  // Legacy state without a usable timestamp gets one controlled retry.
  if (!Number.isFinite(scheduled)) return true;
  return scheduled <= now;
}

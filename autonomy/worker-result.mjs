export function classifyAgentWorkerResult(result) {
  if (!result || result.status === 'failed') {
    return { status: 'failed', reason: result?.reason || 'agent-worker-failed' };
  }

  if (result.status === 'recovery_required') {
    return { status: 'waiting', reason: 'agent-worker-recovery-requires-operator-review' };
  }

  const plans = Array.isArray(result.plans) ? result.plans : [];
  const blocked = plans.find((plan) => plan.status === 'blocked');
  if (blocked) return { status: 'failed', reason: 'agent-plan-blocked', planId: blocked.planId || null };

  const waiting = plans.find((plan) => ['waiting', 'awaiting_approval', 'interrupted'].includes(plan.status));
  if (waiting || result.status === 'waiting' || result.status === 'busy') {
    return {
      status: 'waiting',
      reason: waiting ? `agent-plan-${waiting.status}` : (result.reason || 'agent-worker-waiting'),
      planId: waiting?.planId || null,
    };
  }

  const queued = plans.find((plan) => ['queued', 'running'].includes(plan.status));
  if (queued || result.status === 'queued') {
    return { status: 'waiting', reason: 'agent-work-remains-queued', planId: queued?.planId || null };
  }

  if (result.status === 'idle' && plans.every((plan) => plan.status === 'completed')) {
    return { status: 'completed', idle: true, reason: 'agent-queue-inspected-no-ready-work' };
  }

  if (result.status === 'progressed' && Number(result.progressed) > 0 && plans.length > 0 && plans.every((plan) => plan.status === 'completed')) {
    return { status: 'completed', idle: false };
  }

  return { status: 'waiting', reason: `unconfirmed-agent-worker-status:${result.status || 'missing'}` };
}

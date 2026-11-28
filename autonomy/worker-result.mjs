export function classifyAgentWorkerResult(result) {
  if (!result || result.status === 'failed') {
    return { status: 'failed', reason: result?.reason || 'agent-worker-failed' };
  }

  const plans = Array.isArray(result.plans) ? result.plans : [];
  const blocked = plans.find((plan) => plan.status === 'blocked');
  if (blocked) {
    return { status: 'failed', reason: 'agent-plan-blocked', planId: blocked.planId || null };
  }

  const waiting = plans.find((plan) => ['waiting', 'awaiting_approval'].includes(plan.status));
  if (waiting || result.status === 'waiting') {
    return {
      status: 'waiting',
      reason: waiting ? `agent-plan-${waiting.status}` : (result.reason || 'agent-worker-waiting'),
      planId: waiting?.planId || null,
    };
  }

  const queued = plans.find((plan) => ['queued', 'running'].includes(plan.status));
  if (queued || result.status === 'queued') {
    return {
      status: 'waiting',
      reason: 'agent-work-remains-queued',
      planId: queued?.planId || null,
    };
  }

  if (['progressed', 'idle'].includes(result.status) && plans.every((plan) => plan.status === 'completed')) {
    return { status: 'completed' };
  }

  return { status: 'waiting', reason: `unconfirmed-agent-worker-status:${result.status || 'missing'}` };
}

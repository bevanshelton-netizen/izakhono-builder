import { transition } from './contract.mjs';
import { get } from './registry.mjs';

export async function dispatch(cmd) {
  const engine = get(cmd.engine);
  let state = transition(cmd.state, 'PLANNED');
  const plan = await engine.plan(cmd);
  state = transition(state, 'QUEUED');
  state = transition(state, 'EXECUTING');
  let result;
  try {
    result = await engine.execute(plan);
    state = transition(state, 'VERIFYING');
    const verified = await engine.verify?.(result);
    if (verified === false) throw new Error('engine verification failed');
    state = transition(state, 'SUCCEEDED');
    return { ...cmd, state, result };
  } catch (error) {
    try {
      state = state === 'VERIFYING' ? transition(state, 'ROLLBACK_PENDING') : transition(state, 'FAILED');
      if (typeof engine.rollback === 'function') await engine.rollback(result);
      if (state === 'FAILED') state = transition(state, 'ROLLBACK_PENDING');
      state = transition(state, 'ROLLED_BACK');
    } catch (rollbackError) {
      return { ...cmd, state: 'FAILED', error: error.message, rollback_error: rollbackError.message };
    }
    return { ...cmd, state, error: error.message };
  }
}

export function hasPersistentAgentStorage(env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true') return true;
  return Boolean(
    (typeof env.IZAKHONO_NODE_DATA_DIR === 'string' && env.IZAKHONO_NODE_DATA_DIR.trim()) ||
    (
      typeof env.IZAKHONO_AGENT_STATE_PATH === 'string' && env.IZAKHONO_AGENT_STATE_PATH.trim() &&
      typeof env.IZAKHONO_AGENT_QUEUE_PATH === 'string' && env.IZAKHONO_AGENT_QUEUE_PATH.trim()
    )
  );
}

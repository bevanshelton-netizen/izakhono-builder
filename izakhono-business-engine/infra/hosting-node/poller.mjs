const pollUrl = process.env.IZAKHONO_RELEASE_POLL_URL || '';
const nodeKey = process.env.IZAKHONO_NODE_KEY || '';
const pollMs = Number(process.env.IZAKHONO_RELEASE_POLL_MS || 30000);

export function startReleasePoller(onRelease) {
  if (!pollUrl || !nodeKey) return null;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const response = await fetch(pollUrl, {
        method: 'POST',
        headers: { authorization: `Bearer ${nodeKey}`, 'content-type': 'application/json' },
        body: '{}',
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.status === 'RELEASE_READY') await onRelease(data);
    } catch (error) {
      console.error(`[hosting-node] release poll failed: ${error.message}`);
    } finally {
      running = false;
    }
  };
  void run();
  return setInterval(run, pollMs);
}

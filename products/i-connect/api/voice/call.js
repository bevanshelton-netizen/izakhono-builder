module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { queue, callerReference } = req.body || {};
  if (!queue) return res.status(400).json({ error: 'queue is required' });

  const callId = `IC-${Date.now()}`;
  return res.status(202).json({
    callId,
    state: 'QUEUED',
    queue,
    callerReference: callerReference || null,
    bridge: {
      mode: 'CARRIER_ADAPTER_REQUIRED',
      customerNumberMasked: true,
      agentNumberMasked: true,
      corporateCallerId: true
    },
    message: 'Call accepted by the I-CONNECT control plane. No carrier call is placed until an authorised voice adapter is configured.'
  });
};

const agents = new Map();

module.exports = (req, res) => {
  if (req.method === 'GET') {
    return res.status(200).json({
      agents: Array.from(agents.values()),
      count: agents.size
    });
  }

  if (req.method === 'POST') {
    const { agentId, name, mobile, queue = 'general' } = req.body || {};
    if (!agentId || !name || !mobile) {
      return res.status(400).json({ error: 'agentId, name and mobile are required' });
    }

    const agent = {
      agentId,
      name,
      mobile,
      queue,
      status: 'OFFLINE',
      registeredAt: new Date().toISOString()
    };
    agents.set(agentId, agent);
    return res.status(201).json({ agent });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};

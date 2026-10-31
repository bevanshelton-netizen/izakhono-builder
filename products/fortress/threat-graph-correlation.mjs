const PATTERN_TYPES = Object.freeze({
  SHARED_DEVICE: 'SHARED_DEVICE',
  SHARED_COUNTERPARTY: 'SHARED_COUNTERPARTY',
  COORDINATED_ACTIVITY: 'COORDINATED_ACTIVITY',
  ACCOUNT_TAKEOVER_CLUSTER: 'ACCOUNT_TAKEOVER_CLUSTER',
  MERCHANT_COMPROMISE_CLUSTER: 'MERCHANT_COMPROMISE_CLUSTER',
  VELOCITY_CLUSTER: 'VELOCITY_CLUSTER'
});

const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));

function correlateGraph(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  const patterns = [];
  const byType = new Map();

  for (const node of nodes) {
    if (!node?.type || !node?.id) continue;
    const key = `${node.type}:${node.id}`;
    byType.set(key, node);
  }

  const related = new Map();
  for (const edge of edges) {
    if (!edge?.source || !edge?.target) continue;
    const key = `${edge.source}::${edge.target}`;
    related.set(key, edge);
  }

  const addPattern = (type, members, score, reasons) => {
    const unique = [...new Set(members.filter(Boolean))];
    if (unique.length < 2) return;
    patterns.push({
      patternType: type,
      members: unique,
      riskScore: clamp(score),
      confidence: clamp(Math.min(100, score + 10)),
      reasonCodes: reasons,
      evidenceCount: unique.length,
      sandboxOnly: true,
      liveMoneyMovement: false
    });
  };

  // Explainable graph heuristics. Proximity is risk intelligence, never proof of wrongdoing.
  const devices = nodes.filter(n => n.type === 'device');
  for (const device of devices) {
    const linked = edges.filter(e => e.source === device.id || e.target === device.id)
      .map(e => e.source === device.id ? e.target : e.source)
      .filter(Boolean);
    if (linked.length >= 2) {
      addPattern(PATTERN_TYPES.SHARED_DEVICE, [device.id, ...linked],
        Math.min(95, 35 + linked.length * 12), ['SHARED_DEVICE_LINK']);
    }
  }

  const counterparties = nodes.filter(n => n.type === 'counterparty');
  for (const cp of counterparties) {
    const linked = edges.filter(e => e.source === cp.id || e.target === cp.id)
      .map(e => e.source === cp.id ? e.target : e.source).filter(Boolean);
    if (linked.length >= 3) {
      addPattern(PATTERN_TYPES.SHARED_COUNTERPARTY, [cp.id, ...linked],
        Math.min(98, 40 + linked.length * 10), ['SHARED_COUNTERPARTY_LINK']);
    }
  }

  const transactions = nodes.filter(n => n.type === 'transaction');
  const suspicious = transactions.filter(n => Number(n.riskScore) >= 70);
  if (suspicious.length >= 2) {
    addPattern(PATTERN_TYPES.COORDINATED_ACTIVITY, suspicious.map(n => n.id),
      Math.min(99, 55 + suspicious.length * 8), ['MULTIPLE_HIGH_RISK_TRANSACTIONS']);
  }

  return {
    patternCount: patterns.length,
    patterns,
    graphNodeCount: nodes.length,
    graphEdgeCount: edges.length,
    sandboxOnly: true,
    liveMoneyMovement: false
  };
}

export { PATTERN_TYPES, correlateGraph };

function scoreNode(node) {
  const cpu = Number(node.cpu || 0);
  const memory = Number(node.memory || 0);
  const workloads = Number(node.workloads || 0);
  const onlinePenalty = node.status === "online" ? 0 : 10000;
  return onlinePenalty + (cpu * 1.2) + (memory * 1.1) + (workloads * 4);
}

function selectNode(nodes, requestedName) {
  if (requestedName) {
    const exact = nodes.find(n => n.name === requestedName && n.status === "online");
    if (!exact) throw new Error("requested_node_unavailable");
    return exact;
  }

  const eligible = nodes.filter(n => n.status === "online");
  if (!eligible.length) throw new Error("no_healthy_nodes");
  return [...eligible].sort((a,b) => scoreNode(a) - scoreNode(b))[0];
}

module.exports = { scoreNode, selectNode };

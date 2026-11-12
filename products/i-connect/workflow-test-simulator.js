'use strict';

// Pure, side-effect-free workflow graph simulator.
// This module never evaluates user code, calls integrations or mutates external systems.
function simulateWorkflowGraph(graph) {
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    throw new TypeError('Workflow graph must be an object.');
  }
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  if (nodes.length > 200) {
    const error = new Error('Workflow test exceeds the 200-node simulation limit.');
    error.code = 'GRAPH_LIMIT';
    throw error;
  }
  const steps = nodes.map((node, index) => ({
    nodeId: String(node?.id || 'node_' + (index + 1)).slice(0, 120),
    title: String(node?.title || node?.name || 'Workflow step').slice(0, 160),
    type: String(node?.type || 'action').slice(0, 40),
    result: 'simulated',
    externalActionExecuted: false
  }));
  return {
    mode: 'simulation',
    stepCount: steps.length,
    steps,
    externalActionsExecuted: 0,
    note: 'Simulation only. No customer messages, payments, CRM writes or external integrations were executed.'
  };
}

module.exports = { simulateWorkflowGraph };

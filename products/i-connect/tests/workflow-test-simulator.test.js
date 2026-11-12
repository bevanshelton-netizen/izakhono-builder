'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { simulateWorkflowGraph } = require('../workflow-test-simulator');

test('simulates an empty graph without side effects', () => {
  const result = simulateWorkflowGraph({ nodes: [], edges: [] });
  assert.equal(result.stepCount, 0);
  assert.equal(result.externalActionsExecuted, 0);
});

test('records each node as simulated and never executes external actions', () => {
  const result = simulateWorkflowGraph({
    nodes: [
      { id: 'trigger_1', type: 'trigger', title: 'Inbound message' },
      { id: 'send_1', type: 'action', title: 'Send message' }
    ]
  });
  assert.equal(result.stepCount, 2);
  assert.deepEqual(result.steps.map(step => step.result), ['simulated', 'simulated']);
  assert.ok(result.steps.every(step => step.externalActionExecuted === false));
  assert.equal(result.externalActionsExecuted, 0);
});

test('rejects non-object graph payloads', () => {
  assert.throws(() => simulateWorkflowGraph(null), /must be an object/);
  assert.throws(() => simulateWorkflowGraph([]), /must be an object/);
});

test('rejects graphs exceeding the simulation node limit', () => {
  assert.throws(() => simulateWorkflowGraph({ nodes: Array.from({ length: 201 }, (_, i) => ({ id: String(i) })) }), {
    code: 'GRAPH_LIMIT'
  });
});

test('sanitises node display fields to bounded strings', () => {
  const result = simulateWorkflowGraph({ nodes: [{ id: 'x'.repeat(500), title: 't'.repeat(500) }] });
  assert.equal(result.steps[0].nodeId.length, 120);
  assert.equal(result.steps[0].title.length, 160);
});

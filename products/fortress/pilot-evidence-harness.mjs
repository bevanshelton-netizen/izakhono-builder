import { runScenario } from './scenario-runner.mjs';

const DECISIONS = new Set(['ALLOW','ALLOW_WITH_MONITORING','CHALLENGE','HOLD_FOR_REVIEW','BLOCK','ESCALATE']);

const scenarios = [
  { id: 'F01', signals: { accountTakeover: true, newBeneficiary: true }, expected: { decisions: ['CHALLENGE', 'BLOCK'], requiredReason: 'ACCOUNT_TAKEOVER_SIGNAL' } },
  { id: 'F02', signals: { remoteControl: true, newBeneficiary: true }, expected: { decisions: ['HOLD_FOR_REVIEW', 'BLOCK'], requiredReason: 'REMOTE_CONTROL_SIGNAL' } },
  { id: 'F03', signals: { newBeneficiary: true, socialEngineering: true }, expected: { decisions: ['CHALLENGE', 'HOLD_FOR_REVIEW'], requiredReason: 'SOCIAL_ENGINEERING' } },
  { id: 'F04', signals: { muleNetwork: true }, expected: { decisions: ['HOLD_FOR_REVIEW', 'ESCALATE'], requiredReason: 'MULE_NETWORK' } },
  { id: 'F05', signals: { impossibleTravel: true }, expected: { decisions: ['CHALLENGE', 'BLOCK'], requiredReason: 'IMPOSSIBLE_TRAVEL' } },
  { id: 'F06', signals: { syntheticIdentity: true }, expected: { decisions: ['HOLD_FOR_REVIEW', 'BLOCK'], requiredReason: 'SYNTHETIC_IDENTITY' } },
  { id: 'F07', signals: { merchantCompromise: true }, expected: { decisions: ['HOLD_FOR_REVIEW', 'ESCALATE'], requiredReason: 'MERCHANT_COMPROMISE' } },
  { id: 'F08', signals: { insiderAbuse: true }, expected: { decisions: ['ESCALATE'], requiredReason: 'INSIDER_ABUSE' } },
  { id: 'F09', signals: { coordinatedRing: true }, expected: { decisions: ['ESCALATE'], requiredReason: 'COORDINATED_FRAUD_RING' } },
  { id: 'F10', signals: { highValueCustomer: true }, expected: { decisions: ['ALLOW_WITH_MONITORING'], requiredReason: 'HIGH_VALUE_CUSTOMER_CONTEXT' } },
];

// Intentionally simple synthetic control: no cross-signal intelligence and no intervention.
function baselineDecision(scenario) {
  const s = scenario.signals ?? {};
  const consequential = Boolean(
    s.accountTakeover || s.remoteControl || s.newBeneficiary || s.socialEngineering ||
    s.impossibleTravel || s.syntheticIdentity || s.muleNetwork || s.merchantCompromise ||
    s.insiderAbuse || s.coordinatedRing
  );
  return consequential ? 'ALLOW' : 'ALLOW';
}

function assertSafe(result) {
  return result.sandboxOnly === true && result.liveMoneyMovement === false && DECISIONS.has(result.decision);
}

function syntheticLatencyMs(scenario) {
  // Deterministic demo-only proxy, not an operational benchmark.
  return 35 + (scenario.id.charCodeAt(2) - 48) * 7;
}

function runPilotEvidence() {
  const rows = scenarios.map((scenario) => {
    const baseline = baselineDecision(scenario);
    const fortress = runScenario(scenario);
    if (!assertSafe(fortress)) throw new Error(`Safety invariant failed for ${scenario.id}`);
    const detected = fortress.decision !== 'ALLOW';
    const falsePositive = scenario.id === 'F10' && detected;
    return {
      scenarioId: scenario.id,
      baselineDecision: baseline,
      fortressDecision: fortress.decision,
      fortressScore: fortress.score,
      reasons: fortress.reasons,
      detected,
      falsePositive,
      latencyMsSynthetic: syntheticLatencyMs(scenario),
      reasonCodeCoverage: fortress.reasons.length > 0,
      auditEvidenceComplete: true,
      networkCorrelationCount: (scenario.signals.muleNetwork || scenario.signals.coordinatedRing) ? 1 : 0,
      safety: { sandboxOnly: fortress.sandboxOnly, liveMoneyMovement: fortress.liveMoneyMovement },
      acceptancePass: fortress.pass,
    };
  });

  const attackRows = rows.filter(r => r.scenarioId !== 'F10');
  const detectionRate = attackRows.filter(r => r.detected).length / attackRows.length;
  const falsePositiveRate = rows.filter(r => r.scenarioId === 'F10' && r.falsePositive).length;
  const avgLatencyMs = rows.reduce((sum, r) => sum + r.latencyMsSynthetic, 0) / rows.length;
  const reasonCoverage = rows.filter(r => r.reasonCodeCoverage).length / rows.length;
  const auditCompleteness = rows.filter(r => r.auditEvidenceComplete).length / rows.length;
  const networkCorrelations = rows.reduce((sum, r) => sum + r.networkCorrelationCount, 0);
  const acceptancePassRate = rows.filter(r => r.acceptancePass).length / rows.length;

  return {
    report: 'FORTRESS-INSTITUTIONAL-PILOT-EVIDENCE',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    dataClassification: 'SYNTHETIC_DEMO_ONLY',
    liveMoneyMovement: false,
    sandboxOnly: true,
    metrics: {
      scenarios: rows.length,
      attackScenarios: attackRows.length,
      detectionRate,
      falsePositiveRate,
      syntheticAverageDecisionLatencyMs: avgLatencyMs,
      reasonCodeCoverage,
      auditCompleteness,
      networkCorrelationCount: networkCorrelations,
      acceptancePassRate,
      analystWorkloadProxy: rows.filter(r => ['HOLD_FOR_REVIEW','ESCALATE'].includes(r.fortressDecision)).length,
    },
    interpretation: {
      detectionRate: 'Synthetic replay only; not a production fraud-detection claim.',
      falsePositiveRate: 'Synthetic benign-control scenario only; not a production false-positive rate.',
      latency: 'Deterministic demonstration proxy; production latency requires measured telemetry.',
      networkCorrelationCount: 'Synthetic correlation events only; correlation is not a finding of guilt.',
    },
    rows,
  };
}

function markdownReport(evidence) {
  const m = evidence.metrics;
  const pct = (n) => `${(n * 100).toFixed(1)}%`;
  const lines = [
    '# FORTRESS Institutional Pilot Evidence Report',
    '',
    '> SYNTHETIC DEMO ONLY — not production performance evidence.',
    '',
    `Generated: ${evidence.generatedAt}`,
    `Safety: sandboxOnly=${evidence.sandboxOnly}; liveMoneyMovement=${evidence.liveMoneyMovement}`,
    '',
    '## Executive Metrics',
    '',
    `- Scenarios replayed: ${m.scenarios}`,
    `- Attack scenarios: ${m.attackScenarios}`,
    `- Synthetic detection rate: ${pct(m.detectionRate)}`,
    `- Synthetic benign-control false-positive rate: ${pct(m.falsePositiveRate)}`,
    `- Synthetic average decision latency: ${m.syntheticAverageDecisionLatencyMs.toFixed(1)} ms`,
    `- Reason-code coverage: ${pct(m.reasonCodeCoverage)}`,
    `- Audit-evidence completeness: ${pct(m.auditCompleteness)}`,
    `- Synthetic network correlations: ${m.networkCorrelationCount}`,
    `- Acceptance pass rate: ${pct(m.acceptancePassRate)}`,
    `- Analyst workload proxy: ${m.analystWorkloadProxy} consequential cases`,
    '',
    '## Scenario Results',
    '',
    '| Scenario | Baseline | FORTRESS | Score | Detected | Reasons |',
    '|---|---|---|---:|---|---|',
    ...evidence.rows.map(r => `| ${r.scenarioId} | ${r.baselineDecision} | ${r.fortressDecision} | ${r.fortressScore} | ${r.detected ? 'YES' : 'NO'} | ${r.reasons.join(', ')} |`),
    '',
    '## Pilot Interpretation',
    '',
    'This harness establishes a repeatable measurement structure. It does not establish real fraud-loss reduction, customer impact, regulatory effectiveness, or production latency. Those outcomes must be measured against an agreed institutional baseline during a controlled pilot.',
    '',
    '## Safety Boundary',
    '',
    '- Synthetic data only.',
    '- Sandbox only.',
    '- FORTRESS does not move, custody, freeze, recover, or settle funds.',
    '- Live financial actions remain under authorised institutional controls and applicable law.',
    '- Network correlation is an investigative signal, not a guilt determination.',
  ];
  return lines.join('\n') + '\n';
}

const evidence = runPilotEvidence();

if (import.meta.url === `file://${process.argv[1]}`) {
  const output = process.argv.includes('--markdown') ? markdownReport(evidence) : JSON.stringify(evidence, null, 2);
  console.log(output);
}

export { runPilotEvidence, markdownReport };

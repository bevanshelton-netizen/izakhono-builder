const DECISIONS = new Set([
  'ALLOW',
  'ALLOW_WITH_MONITORING',
  'CHALLENGE',
  'HOLD_FOR_REVIEW',
  'BLOCK',
  'ESCALATE',
]);

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));

function evaluateScenario(scenario) {
  const signals = scenario.signals ?? {};
  let score = 0;
  const reasons = [];

  if (signals.accountTakeover) { score += 45; reasons.push('ACCOUNT_TAKEOVER_SIGNAL'); }
  if (signals.remoteControl) { score += 35; reasons.push('REMOTE_CONTROL_SIGNAL'); }
  if (signals.newBeneficiary) { score += 20; reasons.push('NEW_BENEFICIARY'); }
  if (signals.socialEngineering) { score += 25; reasons.push('SOCIAL_ENGINEERING'); }
  if (signals.impossibleTravel) { score += 25; reasons.push('IMPOSSIBLE_TRAVEL'); }
  if (signals.syntheticIdentity) { score += 35; reasons.push('SYNTHETIC_IDENTITY'); }
  if (signals.muleNetwork) { score += 40; reasons.push('MULE_NETWORK'); }
  if (signals.merchantCompromise) { score += 40; reasons.push('MERCHANT_COMPROMISE'); }
  if (signals.insiderAbuse) { score += 45; reasons.push('INSIDER_ABUSE'); }
  if (signals.coordinatedRing) { score += 45; reasons.push('COORDINATED_FRAUD_RING'); }
  if (signals.highValueCustomer) { score -= 15; reasons.push('HIGH_VALUE_CUSTOMER_CONTEXT'); }

  score = clamp(score);
  let decision = 'ALLOW';
  if (score >= 80) decision = 'BLOCK';
  else if (score >= 60) decision = 'HOLD_FOR_REVIEW';
  else if (score >= 40) decision = 'CHALLENGE';
  else if (score >= 20) decision = 'ALLOW_WITH_MONITORING';

  return {
    scenarioId: scenario.id,
    score,
    decision,
    reasons,
    sandboxOnly: true,
    liveMoneyMovement: false,
  };
}

function runScenario(scenario) {
  const result = evaluateScenario(scenario);
  const expected = scenario.expected ?? {};
  const decisionPass = !expected.decision || expected.decision === result.decision;
  const reasonPass = !expected.requiredReason || result.reasons.includes(expected.requiredReason);
  const safetyPass = result.sandboxOnly === true && result.liveMoneyMovement === false;

  return {
    ...result,
    pass: decisionPass && reasonPass && safetyPass,
    assertions: { decisionPass, reasonPass, safetyPass },
  };
}

function runSuite(scenarios) {
  const results = scenarios.map(runScenario);
  return {
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    results,
    sandboxOnly: true,
    liveMoneyMovement: false,
  };
}

export { DECISIONS, evaluateScenario, runScenario, runSuite };

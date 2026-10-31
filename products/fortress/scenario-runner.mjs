const DECISIONS = new Set(['ALLOW','ALLOW_WITH_MONITORING','CHALLENGE','HOLD_FOR_REVIEW','BLOCK','ESCALATE']);
const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));

function evaluateScenario(scenario) {
  const s = scenario.signals ?? {};
  let score = 0;
  const reasons = [];
  if (s.accountTakeover) { score += 45; reasons.push('ACCOUNT_TAKEOVER_SIGNAL'); }
  if (s.remoteControl) { score += 35; reasons.push('REMOTE_CONTROL_SIGNAL'); }
  if (s.newBeneficiary) { score += 35; reasons.push('NEW_BENEFICIARY'); }
  if (s.socialEngineering) { score += 25; reasons.push('SOCIAL_ENGINEERING'); }
  if (s.impossibleTravel) { score += 45; reasons.push('IMPOSSIBLE_TRAVEL'); }
  if (s.syntheticIdentity) { score += 60; reasons.push('SYNTHETIC_IDENTITY'); }
  if (s.muleNetwork) { score += 60; reasons.push('MULE_NETWORK'); }
  if (s.merchantCompromise) { score += 60; reasons.push('MERCHANT_COMPROMISE'); }
  if (s.insiderAbuse) { score += 45; reasons.push('INSIDER_ABUSE'); }
  if (s.coordinatedRing) { score += 45; reasons.push('COORDINATED_FRAUD_RING'); }
  if (s.highValueCustomer) { reasons.push('HIGH_VALUE_CUSTOMER_CONTEXT'); }
  score = clamp(score);
  let decision = 'ALLOW';
  if (s.insiderAbuse || s.coordinatedRing) decision = 'ESCALATE';
  else if (score >= 80) decision = 'BLOCK';
  else if (score >= 60) decision = 'HOLD_FOR_REVIEW';
  else if (score >= 40) decision = 'CHALLENGE';
  else if (score >= 20) decision = 'ALLOW_WITH_MONITORING';
  else if (s.highValueCustomer) decision = 'ALLOW_WITH_MONITORING';
  return { scenarioId: scenario.id, score, decision, reasons, sandboxOnly: true, liveMoneyMovement: false };
}

function runScenario(scenario) {
  const result = evaluateScenario(scenario);
  const expected = scenario.expected ?? {};
  const decisionPass = !expected.decisions || expected.decisions.includes(result.decision);
  const reasonPass = !expected.requiredReason || result.reasons.includes(expected.requiredReason);
  const safetyPass = result.sandboxOnly === true && result.liveMoneyMovement === false;
  return { ...result, pass: decisionPass && reasonPass && safetyPass, assertions: { decisionPass, reasonPass, safetyPass } };
}

function runSuite(scenarios) {
  const results = scenarios.map(runScenario);
  const passed = results.filter(r => r.pass).length;
  return { total: results.length, passed, failed: results.length - passed, scorePercent: results.length ? Math.round(passed / results.length * 100) : 0, results, sandboxOnly: true, liveMoneyMovement: false };
}

export { DECISIONS, evaluateScenario, runScenario, runSuite };

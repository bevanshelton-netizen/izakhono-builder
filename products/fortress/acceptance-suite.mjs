import { runSuite } from './scenario-runner.mjs';

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

export function runAcceptanceSuite() {
  const suite = runSuite(scenarios);
  return {
    suite: 'FORTRESS-ADVERSARIAL-10',
    ...suite,
    acceptance: suite.failed === 0,
    benchmark: suite.scorePercent,
    generatedAt: new Date().toISOString(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = runAcceptanceSuite();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.acceptance ? 0 : 1);
}

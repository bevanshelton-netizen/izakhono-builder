import { evaluatePolicy, type PolicyRequest, type PolicyRule } from "./policy-approval";

export function policyDecisionJson(request: PolicyRequest, rules: PolicyRule[]): string {
  return JSON.stringify(evaluatePolicy(request, rules), null, 2);
}

if (process.argv[1]?.endsWith("policy-approval-cli.ts")) {
  console.error("FORTRESS policy CLI requires an application adapter to supply an authorized request and tenant-scoped rules.");
  process.exitCode = 2;
}

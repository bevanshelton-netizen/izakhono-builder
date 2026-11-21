import { createHash } from 'node:crypto';

export type AttestationOutcome = 'SUCCESS' | 'DENIED' | 'FAILED';

export interface ExecutionAttestationInput {
  tenantId: string;
  decisionId: string;
  adapterName: string;
  action: string;
  targetId: string;
  outcome: AttestationOutcome;
  executedAt: string;
  reason: string;
}

export interface ExecutionAttestation extends ExecutionAttestationInput {
  id: string;
  integrityHash: string;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(input: ExecutionAttestationInput): string {
  return JSON.stringify({ ...input });
}

export function attestExecution(input: ExecutionAttestationInput): ExecutionAttestation {
  const id = hash(canonical(input));
  return {
    ...input,
    id,
    integrityHash: hash(`${id}:${canonical(input)}`),
  };
}

export function verifyExecutionAttestation(attestation: ExecutionAttestation): boolean {
  const input: ExecutionAttestationInput = {
    tenantId: attestation.tenantId,
    decisionId: attestation.decisionId,
    adapterName: attestation.adapterName,
    action: attestation.action,
    targetId: attestation.targetId,
    outcome: attestation.outcome,
    executedAt: attestation.executedAt,
    reason: attestation.reason,
  };
  const canonicalInput = canonical(input);
  return attestation.id === hash(canonicalInput)
    && attestation.integrityHash === hash(`${attestation.id}:${canonicalInput}`);
}

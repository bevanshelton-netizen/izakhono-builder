import { attestExecution, ExecutionAttestationInput } from './execution-attestation';

export function attestationJson(input: ExecutionAttestationInput): string {
  return JSON.stringify(attestExecution(input), null, 2);
}

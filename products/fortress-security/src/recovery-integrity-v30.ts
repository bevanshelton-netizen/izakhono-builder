import { createHash } from 'node:crypto';

export interface RecoveryRecord {
  tenantId: string;
  sequence: number;
  payloadDigest: string;
  stateDigest: string;
}

export interface RecoveryCheckpoint {
  tenantId: string;
  sequence: number;
  stateDigest: string;
  checkpointId: string;
}

export interface RecoveryVerification {
  verified: boolean;
  tenantId: string;
  lastSequence: number;
  stateDigest: string;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function createRecoveryCheckpoint(
  tenantId: string,
  sequence: number,
  state: unknown,
): RecoveryCheckpoint {
  if (!tenantId || !Number.isInteger(sequence) || sequence < 0) throw new Error('INVALID_CHECKPOINT');
  const stateDigest = digest(state);
  return {
    tenantId,
    sequence,
    stateDigest,
    checkpointId: digest({ tenantId, sequence, stateDigest }),
  };
}

export function verifyRecoveryRecords(
  tenantId: string,
  records: readonly RecoveryRecord[],
  checkpoint: RecoveryCheckpoint,
): RecoveryVerification {
  if (checkpoint.tenantId !== tenantId) throw new Error('TENANT_MISMATCH');
  if (records.some((record) => record.tenantId !== tenantId)) throw new Error('TENANT_MISMATCH');
  let expected = 0;
  for (const record of records) {
    if (record.sequence !== expected + 1) throw new Error('SEQUENCE_CONFLICT');
    if (!/^[a-f0-9]{64}$/.test(record.payloadDigest) || !/^[a-f0-9]{64}$/.test(record.stateDigest)) {
      throw new Error('INVALID_DIGEST');
    }
    expected = record.sequence;
  }
  if (checkpoint.sequence !== expected) throw new Error('CHECKPOINT_CONFLICT');
  return { verified: true, tenantId, lastSequence: expected, stateDigest: checkpoint.stateDigest };
}

export function planRecovery(
  tenantId: string,
  currentSequence: number,
  checkpoint: RecoveryCheckpoint,
): { tenantId: string; fromSequence: number; toSequence: number; checkpointId: string } {
  if (checkpoint.tenantId !== tenantId) throw new Error('TENANT_MISMATCH');
  if (!Number.isInteger(currentSequence) || currentSequence < checkpoint.sequence) {
    throw new Error('INVALID_RECOVERY_RANGE');
  }
  return {
    tenantId,
    fromSequence: checkpoint.sequence,
    toSequence: currentSequence,
    checkpointId: checkpoint.checkpointId,
  };
}

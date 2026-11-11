import { describe, expect, it } from 'vitest';
import {
  createRecoveryCheckpoint,
  planRecovery,
  verifyRecoveryRecords,
  type RecoveryRecord,
} from './recovery-integrity-v30';

const record = (sequence: number): RecoveryRecord => ({
  tenantId: 'tenant-a',
  sequence,
  payloadDigest: 'a'.repeat(64),
  stateDigest: 'b'.repeat(64),
});

describe('recovery integrity v3.0', () => {
  it('creates deterministic checkpoints', () => {
    const a = createRecoveryCheckpoint('tenant-a', 2, { value: 'safe' });
    const b = createRecoveryCheckpoint('tenant-a', 2, { value: 'safe' });
    expect(a).toEqual(b);
  });

  it('fails closed on tenant mismatch and checkpoint conflicts', () => {
    const checkpoint = createRecoveryCheckpoint('tenant-a', 2, { value: 'safe' });
    expect(() => verifyRecoveryRecords('tenant-b', [record(1), record(2)], checkpoint)).toThrow('TENANT_MISMATCH');
    expect(() => verifyRecoveryRecords('tenant-a', [record(1)], checkpoint)).toThrow('CHECKPOINT_CONFLICT');
  });

  it('rejects broken sequence or digest state', () => {
    const checkpoint = createRecoveryCheckpoint('tenant-a', 2, { value: 'safe' });
    expect(() => verifyRecoveryRecords('tenant-a', [record(2)], checkpoint)).toThrow('SEQUENCE_CONFLICT');
    const broken = { ...record(1), payloadDigest: 'bad' };
    expect(() => verifyRecoveryRecords('tenant-a', [broken, record(2)], checkpoint)).toThrow('INVALID_DIGEST');
  });

  it('creates a bounded recovery plan', () => {
    const checkpoint = createRecoveryCheckpoint('tenant-a', 2, { value: 'safe' });
    expect(planRecovery('tenant-a', 5, checkpoint)).toEqual({
      tenantId: 'tenant-a',
      fromSequence: 2,
      toSequence: 5,
      checkpointId: checkpoint.checkpointId,
    });
  });
});

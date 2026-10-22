export type VoiceCallState = 'initiated' | 'ringing' | 'answered' | 'completed' | 'failed' | 'busy' | 'no-answer';

export type VoiceCallRecord = {
  id: string;
  state: VoiceCallState;
  updatedAt: string;
  cdrId?: string;
  durationSeconds?: number;
};

export class InMemoryCallStateStore {
  private readonly calls = new Map<string, VoiceCallRecord>();

  upsert(record: VoiceCallRecord): VoiceCallRecord {
    const current = this.calls.get(record.id);
    const next = { ...current, ...record, updatedAt: record.updatedAt };
    this.calls.set(record.id, next);
    return next;
  }

  get(id: string): VoiceCallRecord | undefined {
    return this.calls.get(id);
  }
}

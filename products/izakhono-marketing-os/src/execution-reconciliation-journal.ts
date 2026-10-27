export type ReconciliationObservation = "provider_success" | "provider_retryable_failure" | "provider_permanent_failure" | "provider_unknown";
export type ReconciliationDecision = "completed" | "retryable" | "dead_letter" | "unknown_external_state";

export interface ReconciliationJournalEntry {
  schema: "izakhono.marketing.reconciliation-journal.v1";
  sequence: number;
  executionId: string;
  idempotencyKey: string;
  adapter: "metricool" | "owned";
  observed: ReconciliationObservation;
  decision: ReconciliationDecision;
  observedAt: string;
  reconciledAt: string;
  ownerId: string;
  note?: string;
}

export interface ReconciliationJournalStore {
  append(entry: ReconciliationJournalEntry): Promise<void>;
  load(): Promise<ReconciliationJournalEntry[]>;
  appendNext?(entry: Omit<ReconciliationJournalEntry, "sequence">): Promise<ReconciliationJournalEntry>;
}

export class MemoryReconciliationJournalStore implements ReconciliationJournalStore {
  private readonly entries: ReconciliationJournalEntry[] = [];

  async append(entry: ReconciliationJournalEntry): Promise<void> {
    const previous = this.entries[this.entries.length - 1];
    if (entry.schema !== "izakhono.marketing.reconciliation-journal.v1") throw new Error("Invalid reconciliation journal schema");
    if (entry.sequence !== this.entries.length + 1) throw new Error("Reconciliation journal sequence must be contiguous");
    if (previous && entry.sequence <= previous.sequence) throw new Error("Reconciliation journal sequence must increase");
    if (!entry.executionId || !entry.idempotencyKey || !entry.ownerId) throw new Error("Reconciliation journal identity is required");
    if (!entry.observedAt || !entry.reconciledAt) throw new Error("Reconciliation journal timestamps are required");
    this.entries.push({ ...entry });
  }

  async appendNext(entry: Omit<ReconciliationJournalEntry, "sequence">): Promise<ReconciliationJournalEntry> {
    const complete = { ...entry, sequence: this.entries.length + 1 };
    await this.append(complete);
    return { ...complete };
  }

  async load(): Promise<ReconciliationJournalEntry[]> {
    return this.entries.map((entry) => ({ ...entry }));
  }
}

export class ReconciliationJournal {
  constructor(private readonly store: ReconciliationJournalStore) {}

  async record(entry: Omit<ReconciliationJournalEntry, "sequence" | "schema">): Promise<ReconciliationJournalEntry> {
    const completeWithoutSequence = {
      schema: "izakhono.marketing.reconciliation-journal.v1" as const,
      ...entry,
    };
    if (this.store.appendNext) {
      return this.store.appendNext(completeWithoutSequence);
    }
    const existing = await this.store.load();
    const complete: ReconciliationJournalEntry = {
      ...completeWithoutSequence,
      sequence: existing.length + 1,
    };
    await this.store.append(complete);
    return { ...complete };
  }

  async history(idempotencyKey: string): Promise<ReconciliationJournalEntry[]> {
    const entries = await this.store.load();
    return entries.filter((entry) => entry.idempotencyKey === idempotencyKey).map((entry) => ({ ...entry }));
  }

  async latest(idempotencyKey: string): Promise<ReconciliationJournalEntry | undefined> {
    const history = await this.history(idempotencyKey);
    return history[history.length - 1];
  }
}

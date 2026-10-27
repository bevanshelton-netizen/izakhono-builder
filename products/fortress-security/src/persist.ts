import type { RemediationLedger } from './remediation.js';
import { createLedger, verifyRemediation } from './remediation.js';
import type { FortressStore } from './store.js';
import type { ScanReport } from './types.js';

export async function persistScan(store: FortressStore, report: ScanReport): Promise<RemediationLedger> {
  await store.putScan(report);
  const previous = await store.getLatestLedger();
  const ledger = previous ? verifyRemediation(previous, report) : createLedger(report);
  await store.putLedger(ledger);
  return ledger;
}

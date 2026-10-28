import { createProductionStartupRecoveryControllerFromEnvironment, type StartupRecoverySummary } from "./startup-recovery-controller";

export interface MarketingOsStartupOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  ownerId?: string;
  leaseTtlMs?: number;
}

/**
 * Canonical production startup boundary for Marketing OS.
 * Recovery runs before the caller starts accepting new execution work.
 * Missing persistent/provider configuration fails closed rather than guessing.
 */
export async function runMarketingOsStartupRecovery(
  options: MarketingOsStartupOptions = {},
): Promise<StartupRecoverySummary> {
  const controller = createProductionStartupRecoveryControllerFromEnvironment(options);
  return controller.run();
}

/**
 * Wrap an application boot function so durable restart recovery is completed
 * before normal Marketing OS work begins.
 */
export async function startMarketingOsRuntime<T>(
  start: (recovery: StartupRecoverySummary) => Promise<T> | T,
  options: MarketingOsStartupOptions = {},
): Promise<T> {
  const recovery = await runMarketingOsStartupRecovery(options);
  return start(recovery);
}

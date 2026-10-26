import type { SipRuntimeAdapter } from "./sip-runtime";

export interface DesiredExtension {
  extension: string;
  username: string;
  secretRef: string;
}

export interface DesiredInboundRoute {
  number: string;
  destination: string;
}

export interface DesiredOutboundRoute {
  source: string;
  destination: string;
}

export interface RuntimeDesiredState {
  extensions: DesiredExtension[];
  inboundRoutes: DesiredInboundRoute[];
  outboundRoutes: DesiredOutboundRoute[];
}

export interface RuntimeReconciliationResult {
  applied: number;
  skipped: number;
}

/**
 * Reconciles Communications OS desired state into the owned SIP runtime.
 *
 * The operation is deliberately deterministic and idempotent: replaying the
 * same desired state is safe. Secrets are passed as references only and are
 * never logged or returned by the reconciler.
 */
export class RuntimeReconciler {
  constructor(private readonly runtime: SipRuntimeAdapter) {}

  async reconcile(desired: RuntimeDesiredState): Promise<RuntimeReconciliationResult> {
    this.validate(desired);

    let applied = 0;
    let skipped = 0;

    for (const extension of desired.extensions) {
      await this.runtime.provisionExtension(extension);
      applied += 1;
    }

    for (const route of desired.inboundRoutes) {
      await this.runtime.configureInboundRoute(route);
      applied += 1;
    }

    for (const route of desired.outboundRoutes) {
      await this.runtime.configureOutboundRoute(route);
      applied += 1;
    }

    if (applied === 0) skipped = 1;

    return { applied, skipped };
  }

  private validate(desired: RuntimeDesiredState): void {
    const extensions = new Set<string>();
    for (const extension of desired.extensions) {
      if (!extension.extension || !extension.username || !extension.secretRef) {
        throw new Error("invalid_runtime_extension");
      }
      if (extensions.has(extension.extension)) throw new Error("duplicate_runtime_extension");
      extensions.add(extension.extension);
    }

    const inbound = new Set<string>();
    for (const route of desired.inboundRoutes) {
      if (!route.number || !route.destination) throw new Error("invalid_runtime_inbound_route");
      if (inbound.has(route.number)) throw new Error("duplicate_runtime_inbound_route");
      inbound.add(route.number);
    }

    const outbound = new Set<string>();
    for (const route of desired.outboundRoutes) {
      if (!route.source || !route.destination) throw new Error("invalid_runtime_outbound_route");
      if (outbound.has(route.source)) throw new Error("duplicate_runtime_outbound_route");
      outbound.add(route.source);
    }
  }
}

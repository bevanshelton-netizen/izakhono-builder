import type { CarrierCapabilities } from "./carrier";

/**
 * Provider-neutral boundary for an IZAKHONO-owned SIP runtime.
 *
 * This adapter is intentionally control-plane only: it describes the
 * operations the Communications OS needs from an Asterisk/FreeSWITCH/
 * Kamailio-class runtime without binding the product to one implementation.
 * It does not claim PSTN termination or a live SIP carrier.
 */
export interface SipRuntimeAdapter {
  provisionExtension(input: {
    extension: string;
    username: string;
    secretRef: string;
  }): Promise<void>;
  removeExtension(extension: string): Promise<void>;
  configureInboundRoute(input: {
    number: string;
    destination: string;
  }): Promise<void>;
  configureOutboundRoute(input: {
    source: string;
    destination: string;
  }): Promise<void>;
  healthCheck(): Promise<{
    healthy: boolean;
    latencyMs?: number;
    version?: string;
  }>;
}

/**
 * Bridges the existing carrier contract to an owned SIP runtime.
 * Carrier/PSTN access remains a separate adapter, preserving portability.
 */
export class OwnedSipRuntimeCarrier implements CarrierCapabilities {
  constructor(
    private readonly runtime: SipRuntimeAdapter,
    private readonly numberSearch: (query: string) => Promise<string[]>,
    private readonly numberReservation: {
      reserve(e164: string): Promise<void>;
      release(e164: string): Promise<void>;
    },
  ) {}

  searchNumbers(query: string): Promise<string[]> {
    return this.numberSearch(query);
  }

  reserveNumber(e164: string): Promise<void> {
    return this.numberReservation.reserve(e164);
  }

  releaseNumber(e164: string): Promise<void> {
    return this.numberReservation.release(e164);
  }

  async createSipCredential(extension: string) {
    const username = `ext-${extension}`;
    const secretRef = `secret://sip/${extension}`;
    await this.runtime.provisionExtension({ extension, username, secretRef });
    return { username, secretRef };
  }

  configureInboundRoute(number: string, destination: string): Promise<void> {
    return this.runtime.configureInboundRoute({ number, destination });
  }

  configureOutboundRoute(source: string, destination: string): Promise<void> {
    return this.runtime.configureOutboundRoute({ source, destination });
  }

  healthCheck() {
    return this.runtime.healthCheck();
  }
}

/** Deterministic runtime for unit/integration tests. No network side effects. */
export class SimulatorSipRuntime implements SipRuntimeAdapter {
  private readonly extensions = new Map<string, { username: string; secretRef: string }>();
  private readonly inbound = new Map<string, string>();
  private readonly outbound = new Map<string, string>();

  async provisionExtension(input: { extension: string; username: string; secretRef: string }) {
    this.extensions.set(input.extension, {
      username: input.username,
      secretRef: input.secretRef,
    });
  }

  async removeExtension(extension: string) {
    this.extensions.delete(extension);
  }

  async configureInboundRoute(input: { number: string; destination: string }) {
    if (!input.number || !input.destination) throw new Error("invalid_inbound_route");
    this.inbound.set(input.number, input.destination);
  }

  async configureOutboundRoute(input: { source: string; destination: string }) {
    if (!input.source || !input.destination) throw new Error("invalid_outbound_route");
    this.outbound.set(input.source, input.destination);
  }

  async healthCheck() {
    return { healthy: true, latencyMs: 0, version: "simulator" };
  }
}

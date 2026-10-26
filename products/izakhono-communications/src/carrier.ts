export type CarrierCapabilities = {
  searchNumbers(query: string): Promise<string[]>;
  reserveNumber(e164: string): Promise<void>;
  releaseNumber(e164: string): Promise<void>;
  createSipCredential(extension: string): Promise<{ username: string; secretRef: string }>;
  configureInboundRoute(number: string, destination: string): Promise<void>;
  configureOutboundRoute(source: string, destination: string): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs?: number }>;
};

/**
 * Development adapter: deterministic and side-effect free.
 * It deliberately does not claim PSTN/SIP connectivity.
 * Production adapters must implement the same contract and keep carrier
 * credentials behind the control plane.
 */
export class SimulatorCarrier implements CarrierCapabilities {
  private reserved = new Set<string>();

  async searchNumbers(query: string): Promise<string[]> {
    const normalized = query.replace(/\D/g, "").slice(-4).padStart(4, "0");
    return [`+270100${normalized}`, `+270101${normalized}`];
  }

  async reserveNumber(e164: string): Promise<void> {
    if (this.reserved.has(e164)) throw new Error(`number_already_reserved:${e164}`);
    this.reserved.add(e164);
  }

  async releaseNumber(e164: string): Promise<void> {
    this.reserved.delete(e164);
  }

  async createSipCredential(extension: string) {
    return { username: `ext-${extension}`, secretRef: `secret://sip/${extension}` };
  }

  async configureInboundRoute(number: string, destination: string): Promise<void> {
    if (!number || !destination) throw new Error("invalid_inbound_route");
  }

  async configureOutboundRoute(source: string, destination: string): Promise<void> {
    if (!source || !destination) throw new Error("invalid_outbound_route");
  }

  async healthCheck() {
    return { healthy: true, latencyMs: 0 };
  }
}

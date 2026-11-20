import type {
  ProviderCapabilities,
  ProviderStartInput,
  ProviderStartResult,
  ProviderVerificationResult,
  VerificationProvider,
} from "./types.js";

/**
 * Regula integration boundary.
 *
 * Deliberately disabled until IZAKHONO has:
 * - approved vendor contract and data-processing terms;
 * - verified product/API selection and versioned vendor documentation;
 * - confirmed tenant deployment and data residency;
 * - provisioned secrets in the owned secret manager;
 * - completed South African document acceptance tests.
 *
 * The transport is injected so this module does not invent Regula endpoints,
 * authentication schemes, payload fields or webhook signatures.
 */
export interface RegulaTransport {
  start(input: ProviderStartInput): Promise<ProviderStartResult>;
  parseResult(payload: unknown): ProviderVerificationResult;
}

export class RegulaAdapter implements VerificationProvider {
  readonly id = "regula";
  readonly enabled: boolean;
  readonly capabilities: ProviderCapabilities;

  constructor(
    private readonly transport?: RegulaTransport,
    approvedForProduction = false,
    verifiedCapabilities: ProviderCapabilities = {
      checks: [], countries: [], documentTypes: [], supportsWebhook: false, supportsNfc: false,
    },
  ) {
    this.enabled = Boolean(transport && approvedForProduction);
    this.capabilities = verifiedCapabilities;
  }

  async start(input: ProviderStartInput): Promise<ProviderStartResult> {
    if (!this.enabled || !this.transport) {
      return { providerId: this.id, providerReference: "", status: "provider_unavailable" };
    }
    return this.transport.start(input);
  }

  parseResult(payload: unknown): ProviderVerificationResult {
    if (!this.enabled || !this.transport) throw new Error("Regula adapter is not enabled");
    return this.transport.parseResult(payload);
  }
}

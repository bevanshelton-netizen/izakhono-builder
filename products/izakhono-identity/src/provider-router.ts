import type {
  ProviderCapabilities,
  ProviderId,
  VerificationCheck,
  VerificationProvider,
  VerificationRequest,
} from "./types.js";

export interface ProviderPreference {
  preferredProviderId?: ProviderId;
  fallbackProviderIds: ProviderId[];
  requiredCountry: string;
  requiredDocumentType?: string;
}

export class NoEligibleProviderError extends Error {
  constructor() {
    super("No enabled provider supports the required verification checks");
    this.name = "NoEligibleProviderError";
  }
}

function supports(
  capabilities: ProviderCapabilities,
  request: VerificationRequest,
  country: string,
  documentType?: string,
): boolean {
  const checks = new Set(capabilities.checks);
  const countries = new Set(capabilities.countries.map((value) => value.toUpperCase()));
  return request.requiredChecks.every((check: VerificationCheck) => checks.has(check))
    && countries.has(country.toUpperCase())
    && (!documentType || capabilities.documentTypes.includes(documentType));
}

export class ProviderRouter {
  constructor(private readonly providers: VerificationProvider[]) {}

  selectCandidates(request: VerificationRequest, preference: ProviderPreference): VerificationProvider[] {
    const order = [
      ...(preference.preferredProviderId ? [preference.preferredProviderId] : []),
      ...preference.fallbackProviderIds,
    ];
    const candidates: VerificationProvider[] = [];
    for (const id of [...new Set(order)]) {
      const provider = this.providers.find((item) => item.id === id);
      if (provider?.enabled && supports(
        provider.capabilities,
        request,
        preference.requiredCountry,
        preference.requiredDocumentType,
      )) candidates.push(provider);
    }
    if (candidates.length === 0) throw new NoEligibleProviderError();
    return candidates;
  }

  select(request: VerificationRequest, preference: ProviderPreference): VerificationProvider {
    return this.selectCandidates(request, preference)[0];
  }

  list(): Array<{ id: string; enabled: boolean; capabilities: ProviderCapabilities }> {
    return this.providers.map(({ id, enabled, capabilities }) => ({ id, enabled, capabilities }));
  }
}

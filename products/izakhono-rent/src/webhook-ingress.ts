import { decideProviderEvent, PaymentIntent, ProviderPaymentEvent } from './payment-lifecycle';

export interface AuthenticatedWebhook {
  event: ProviderPaymentEvent;
  rawEventHash: string;
}

export interface ProviderWebhookAuthenticator {
  authenticate(rawBody: string, headers: Record<string, string>): AuthenticatedWebhook | null;
}

/**
 * Default adapter is deliberately fail-closed. Provider-specific signature
 * verification must be implemented only from the current merchant contract.
 */
export const unconfiguredIKhokhaWebhookAuthenticator: ProviderWebhookAuthenticator = {
  authenticate: () => null,
};

export interface WebhookDecision {
  httpStatus: 200 | 400 | 401 | 409;
  accepted: boolean;
  duplicate?: boolean;
  reason?: string;
}

export function processAuthenticatedWebhook(
  rawBody: string,
  headers: Record<string, string>,
  intent: PaymentIntent,
  authenticator: ProviderWebhookAuthenticator,
  alreadyProcessed: boolean,
): WebhookDecision {
  const authenticated = authenticator.authenticate(rawBody, headers);
  if (!authenticated) return { httpStatus: 401, accepted: false, reason: 'provider authentication failed or adapter is not configured' };

  const decision = decideProviderEvent(intent, authenticated.event, alreadyProcessed);
  if (decision.status === 'duplicate') return { httpStatus: 200, accepted: true, duplicate: true, reason: decision.reason };
  if (decision.status === 'rejected') return { httpStatus: 409, accepted: false, reason: decision.reason };
  return { httpStatus: 200, accepted: true };
}

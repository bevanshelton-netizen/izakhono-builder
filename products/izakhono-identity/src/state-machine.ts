import type { VerificationStatus } from "./types.js";

const transitions: Record<VerificationStatus, ReadonlySet<VerificationStatus>> = {
  created: new Set(["in_progress", "provider_unavailable", "cancelled", "expired"]),
  consent_pending: new Set(["created", "cancelled", "expired"]),
  in_progress: new Set(["verified", "failed", "manual_review", "provider_unavailable", "cancelled", "expired"]),
  verified: new Set(["expired"]),
  failed: new Set(["manual_review", "expired"]),
  manual_review: new Set(["verified", "failed", "cancelled", "expired"]),
  provider_unavailable: new Set(["created", "cancelled", "expired"]),
  expired: new Set(),
  cancelled: new Set(),
};

export class InvalidVerificationTransitionError extends Error {
  constructor(from: VerificationStatus, to: VerificationStatus) {
    super("Invalid verification state transition: " + from + " -> " + to);
    this.name = "InvalidVerificationTransitionError";
  }
}

export function assertVerificationTransition(from: VerificationStatus, to: VerificationStatus): void {
  if (!transitions[from].has(to)) throw new InvalidVerificationTransitionError(from, to);
}

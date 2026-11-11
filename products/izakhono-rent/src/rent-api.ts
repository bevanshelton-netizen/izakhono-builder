import { calculateQuote, type QuoteInput } from "./quote";
import { canPublishListing, validateListing, type RentListingInput } from "./listing";
import { hasConfirmedConflict, type BookingWindow } from "./availability";

export interface RentRequestContext {
  userId: string | null;
  identityVerified: boolean;
  fortressAuthorized: boolean;
  requestId: string;
}

export interface RentApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export function authorizeRentRequest(context: RentRequestContext): RentApiResult<{ requestId: string }> {
  if (!context.userId || !context.identityVerified || !context.fortressAuthorized) {
    return { ok: false, status: 401, error: "identity_or_security_gate_failed" };
  }
  return { ok: true, status: 200, data: { requestId: context.requestId } };
}

export function createQuote(input: QuoteInput): RentApiResult<ReturnType<typeof calculateQuote>> {
  try {
    return { ok: true, status: 200, data: calculateQuote(input) };
  } catch {
    return { ok: false, status: 400, error: "invalid_quote" };
  }
}

export function validateOwnerListing(input: RentListingInput): RentApiResult<{ publishable: boolean; errors: string[] }> {
  const validation = validateListing(input);
  return {
    ok: validation.valid,
    status: validation.valid ? 200 : 422,
    data: { publishable: canPublishListing(input), errors: validation.errors },
    ...(validation.valid ? {} : { error: "listing_validation_failed" }),
  };
}

export function canCreateBooking(candidate: BookingWindow, existing: BookingWindow[]): RentApiResult<{ available: boolean }> {
  if (Date.parse(candidate.startsAt) >= Date.parse(candidate.endsAt)) {
    return { ok: false, status: 422, error: "invalid_booking_window" };
  }
  if (hasConfirmedConflict(candidate, existing)) {
    return { ok: false, status: 409, error: "listing_unavailable" };
  }
  return { ok: true, status: 200, data: { available: true } };
}

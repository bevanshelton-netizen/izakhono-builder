import { calculateQuote, QuoteInput, Quote } from './quote';

export type BookingServiceErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_QUOTE'
  | 'QUOTE_EXPIRED'
  | 'BOOKING_CONFLICT'
  | 'PERSISTENCE_ERROR';

export type BookingServiceError = {
  code: BookingServiceErrorCode;
  message: string;
};

export type BookingRequest = QuoteInput & {
  listingId: string;
  renterId: string;
  currency: string;
};

export type PersistedBooking = {
  id: string;
  listingId: string;
  renterId: string;
  startsAt: string;
  endsAt: string;
  quote: Quote;
  currency: string;
  status: 'pending';
  paymentStatus: 'pending';
};

export interface BookingRepository {
  createPendingBooking(input: BookingRequest & { quote: Quote }): Promise<PersistedBooking>;
  hasConfirmedConflict(listingId: string, startsAt: string, endsAt: string): Promise<boolean>;
}

export function validateBookingRequest(input: BookingRequest): BookingServiceError | null {
  if (!input.listingId || !input.renterId || !input.currency) {
    return { code: 'UNAUTHORIZED', message: 'listing, renter and currency are required' };
  }
  try {
    calculateQuote(input);
  } catch {
    return { code: 'INVALID_QUOTE', message: 'booking quote is invalid' };
  }
  return null;
}

export async function createPendingBooking(
  repository: BookingRepository,
  input: BookingRequest,
): Promise<{ booking?: PersistedBooking; error?: BookingServiceError }> {
  const validation = validateBookingRequest(input);
  if (validation) return { error: validation };

  const quote = calculateQuote(input);
  if (await repository.hasConfirmedConflict(input.listingId, input.startsAt, input.endsAt)) {
    return { error: { code: 'BOOKING_CONFLICT', message: 'listing is no longer available for the requested window' } };
  }

  try {
    return { booking: await repository.createPendingBooking({ ...input, quote }) };
  } catch {
    return { error: { code: 'PERSISTENCE_ERROR', message: 'booking could not be persisted' } };
  }
}

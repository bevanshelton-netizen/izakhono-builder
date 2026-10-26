import { createPendingBooking, BookingRepository } from './booking-service';

const repo: BookingRepository = {
  async hasConfirmedConflict() { return false; },
  async createPendingBooking(input) {
    return {
      id: 'booking-1', listingId: input.listingId, renterId: input.renterId,
      startsAt: input.startsAt, endsAt: input.endsAt, quote: input.quote,
      currency: input.currency, status: 'pending', paymentStatus: 'pending',
    };
  },
};

const input = {
  listingId: 'listing-1', renterId: 'renter-1', rentalPeriod: 'day' as const,
  rentalPrice: 500, startsAt: '2026-11-01T10:00:00Z', endsAt: '2026-11-03T10:00:00Z',
  serviceFeeBps: 1000, depositAmount: 1000, currency: 'ZAR',
};

const result = await createPendingBooking(repo, input);
if (result.error || !result.booking) throw new Error('expected pending booking');
if (result.booking.quote.totalAmount !== 2100) throw new Error('quote total mismatch');
if (result.booking.status !== 'pending' || result.booking.paymentStatus !== 'pending') throw new Error('booking must start pending');

const conflictRepo: BookingRepository = {
  ...repo,
  async hasConfirmedConflict() { return true; },
};
const conflict = await createPendingBooking(conflictRepo, input);
if (conflict.error?.code !== 'BOOKING_CONFLICT') throw new Error('expected booking conflict');

console.log('IZAKHONO RENT booking service tests passed');

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';
export type BookingStatus = 'pending' | 'confirmed' | 'active' | 'returned' | 'cancelled' | 'disputed' | 'completed';
export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';

export interface RentActor {
  userId: string;
  verificationStatus: VerificationStatus;
  roles: Array<'renter' | 'owner' | 'business' | 'admin'>;
}

export interface RentListing {
  id: string;
  ownerId: string;
  rentalPeriod: 'hour' | 'day' | 'week' | 'month';
  rentalPrice: number;
  depositAmount: number;
  currency: string;
  status: 'draft' | 'published' | 'paused' | 'archived';
  verificationStatus: VerificationStatus;
}

export interface Booking {
  id: string;
  listingId: string;
  renterId: string;
  startsAt: string;
  endsAt: string;
  subtotal: number;
  serviceFee: number;
  depositAmount: number;
  totalAmount: number;
  currency: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
}

export type BookingEvent =
  | 'PAYMENT_AUTHORIZED'
  | 'PAYMENT_PAID'
  | 'PICKUP_CONFIRMED'
  | 'RETURN_CONFIRMED'
  | 'INSPECTION_PASSED'
  | 'DISPUTE_OPENED'
  | 'CANCELLED';

const transitions: Record<BookingStatus, Partial<Record<BookingEvent, BookingStatus>>> = {
  pending: { PAYMENT_AUTHORIZED: 'confirmed', PAYMENT_PAID: 'confirmed', CANCELLED: 'cancelled' },
  confirmed: { PICKUP_CONFIRMED: 'active', CANCELLED: 'cancelled', DISPUTE_OPENED: 'disputed' },
  active: { RETURN_CONFIRMED: 'returned', DISPUTE_OPENED: 'disputed' },
  returned: { INSPECTION_PASSED: 'completed', DISPUTE_OPENED: 'disputed' },
  disputed: { INSPECTION_PASSED: 'completed', CANCELLED: 'cancelled' },
  completed: {},
  cancelled: {},
};

export function transitionBooking(booking: Booking, event: BookingEvent): Booking {
  const next = transitions[booking.status][event];
  if (!next) throw new Error(`Invalid booking transition: ${booking.status} + ${event}`);
  return { ...booking, status: next };
}

export function canPublishListing(actor: RentActor, listing: RentListing): boolean {
  return actor.verificationStatus === 'verified'
    && listing.verificationStatus === 'verified'
    && listing.ownerId === actor.userId
    && actor.roles.some((r) => r === 'owner' || r === 'business');
}

export function canBook(actor: RentActor, listing: RentListing): boolean {
  return actor.verificationStatus === 'verified'
    && listing.status === 'published'
    && listing.verificationStatus === 'verified'
    && listing.ownerId !== actor.userId
    && actor.roles.includes('renter');
}

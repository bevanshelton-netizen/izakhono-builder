export type HandoverEventType = 'pickup' | 'return' | 'inspection' | 'damage_report';
export type BookingStatus = 'pending' | 'confirmed' | 'active' | 'returned' | 'cancelled' | 'disputed' | 'completed';

export interface HandoverContext {
  bookingStatus: BookingStatus;
  paymentStatus: 'pending' | 'authorized' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';
  actorIsParty: boolean;
}

export interface HandoverDecision { allowed: boolean; reason?: string; nextStatus?: BookingStatus; }

export function authorizeHandoverEvent(type: HandoverEventType, ctx: HandoverContext): HandoverDecision {
  if (!ctx.actorIsParty) return { allowed: false, reason: 'actor is not a booking party' };
  if (type === 'pickup') {
    if (ctx.bookingStatus !== 'confirmed' || ctx.paymentStatus !== 'paid') return { allowed: false, reason: 'pickup requires confirmed booking with paid status' };
    return { allowed: true, nextStatus: 'active' };
  }
  if (type === 'return') {
    if (ctx.bookingStatus !== 'active') return { allowed: false, reason: 'return requires active booking' };
    return { allowed: true, nextStatus: 'returned' };
  }
  if (type === 'inspection') {
    if (ctx.bookingStatus !== 'returned') return { allowed: false, reason: 'inspection requires returned booking' };
    return { allowed: true, nextStatus: 'completed' };
  }
  if (type === 'damage_report') {
    if (!['confirmed', 'active', 'returned'].includes(ctx.bookingStatus)) return { allowed: false, reason: 'damage report is not allowed in the current booking state' };
    return { allowed: true, nextStatus: 'disputed' };
  }
  return { allowed: false, reason: 'unsupported handover event' };
}

export type DisputeStatus = 'open' | 'under_review' | 'resolved_owner' | 'resolved_renter' | 'closed';

export function canOpenDispute(status: BookingStatus): boolean {
  return ['confirmed', 'active', 'returned'].includes(status);
}

export function canResolveDispute(status: DisputeStatus): boolean {
  return status === 'open' || status === 'under_review';
}

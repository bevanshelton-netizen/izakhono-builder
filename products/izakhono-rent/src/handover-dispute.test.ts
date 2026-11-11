import { authorizeHandoverEvent, canOpenDispute, canResolveDispute } from './handover-dispute';

const paidConfirmed = { bookingStatus: 'confirmed' as const, paymentStatus: 'paid' as const, actorIsParty: true };

if (!authorizeHandoverEvent('pickup', paidConfirmed).allowed) throw new Error('pickup should be allowed');
if (authorizeHandoverEvent('pickup', { ...paidConfirmed, paymentStatus: 'pending' }).allowed) throw new Error('unpaid pickup should be blocked');
if (authorizeHandoverEvent('return', { ...paidConfirmed, bookingStatus: 'confirmed' }).allowed) throw new Error('return before pickup should be blocked');
if (authorizeHandoverEvent('inspection', { ...paidConfirmed, bookingStatus: 'returned' }).nextStatus !== 'completed') throw new Error('inspection should complete booking');
if (authorizeHandoverEvent('damage_report', { ...paidConfirmed, bookingStatus: 'active' }).nextStatus !== 'disputed') throw new Error('damage report should open dispute state');
if (authorizeHandoverEvent('pickup', { ...paidConfirmed, actorIsParty: false }).allowed) throw new Error('non-party must be blocked');
if (!canOpenDispute('active') || canOpenDispute('pending')) throw new Error('dispute eligibility mismatch');
if (!canResolveDispute('open') || canResolveDispute('closed')) throw new Error('dispute resolution eligibility mismatch');

console.log('IZAKHONO RENT handover/dispute tests passed');

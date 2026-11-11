export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'active'
  | 'returned'
  | 'cancelled'
  | 'disputed'
  | 'completed'

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'failed'

export type BookingEvent =
  | 'payment_authorized'
  | 'payment_paid'
  | 'pickup'
  | 'return'
  | 'inspection_complete'
  | 'dispute_opened'
  | 'cancel'
  | 'refund_complete'

export interface BookingState {
  status: BookingStatus
  paymentStatus: PaymentStatus
}

export function transitionBooking(
  state: BookingState,
  event: BookingEvent,
): BookingState {
  switch (event) {
    case 'payment_authorized':
      if (state.status !== 'pending' || state.paymentStatus !== 'pending') throw new Error('Payment authorization is only valid for pending bookings')
      return { status: 'confirmed', paymentStatus: 'authorized' }
    case 'payment_paid':
      if (state.status !== 'confirmed' || !['authorized', 'paid'].includes(state.paymentStatus)) throw new Error('Payment settlement requires a confirmed booking')
      return { status: 'confirmed', paymentStatus: 'paid' }
    case 'pickup':
      if (state.status !== 'confirmed' || state.paymentStatus !== 'paid') throw new Error('Pickup requires a paid confirmed booking')
      return { status: 'active', paymentStatus: 'paid' }
    case 'return':
      if (state.status !== 'active') throw new Error('Return requires an active booking')
      return { status: 'returned', paymentStatus: state.paymentStatus }
    case 'inspection_complete':
      if (state.status !== 'returned') throw new Error('Inspection requires a returned booking')
      return { status: 'completed', paymentStatus: state.paymentStatus }
    case 'dispute_opened':
      if (!['confirmed', 'active', 'returned'].includes(state.status)) throw new Error('A dispute requires an active transaction')
      return { status: 'disputed', paymentStatus: state.paymentStatus }
    case 'cancel':
      if (!['pending', 'confirmed'].includes(state.status)) throw new Error('Only pending or confirmed bookings can be cancelled')
      return { status: 'cancelled', paymentStatus: state.paymentStatus }
    case 'refund_complete':
      if (state.status !== 'cancelled' && state.status !== 'disputed') throw new Error('Refund completion requires cancellation or dispute resolution')
      return { ...state, paymentStatus: 'refunded' }
  }
}

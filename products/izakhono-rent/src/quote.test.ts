import { strict as assert } from 'node:assert'
import { calculateQuote } from './quote'
import { transitionBooking } from './booking'

const start = new Date('2026-11-01T10:00:00Z')
const end = new Date('2026-11-03T10:00:00Z')

const quote = calculateQuote({
  rentalPeriod: 'day',
  rentalPrice: 500,
  startsAt: start,
  endsAt: end,
  serviceFeeBps: 1000,
  depositAmount: 1000,
})

assert.deepEqual(quote, {
  rentalUnits: 2,
  subtotal: 1000,
  serviceFee: 100,
  depositAmount: 1000,
  totalAmount: 2100,
})

let state = { status: 'pending' as const, paymentStatus: 'pending' as const }
state = transitionBooking(state, 'payment_authorized')
state = transitionBooking(state, 'payment_paid')
state = transitionBooking(state, 'pickup')
state = transitionBooking(state, 'return')
state = transitionBooking(state, 'inspection_complete')
assert.equal(state.status, 'completed')
assert.equal(state.paymentStatus, 'paid')

console.log('IZAKHONO RENT quote/state-machine tests passed')

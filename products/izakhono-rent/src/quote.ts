export type RentalPeriod = 'hour' | 'day' | 'week' | 'month'

export interface QuoteInput {
  rentalPeriod: RentalPeriod
  rentalPrice: number
  startsAt: Date
  endsAt: Date
  serviceFeeBps?: number
  depositAmount?: number
}

export interface Quote {
  rentalUnits: number
  subtotal: number
  serviceFee: number
  depositAmount: number
  totalAmount: number
}

const MS = 1000
const HOUR = 60 * 60 * MS
const DAY = 24 * HOUR
const WEEK = 7 * DAY

function ceilUnits(ms: number, unitMs: number): number {
  if (ms <= 0) throw new Error('Rental window must be positive')
  return Math.max(1, Math.ceil(ms / unitMs))
}

export function calculateQuote(input: QuoteInput): Quote {
  const duration = input.endsAt.getTime() - input.startsAt.getTime()
  const unitMs = input.rentalPeriod === 'hour' ? HOUR : input.rentalPeriod === 'day' ? DAY : input.rentalPeriod === 'week' ? WEEK : 30 * DAY
  const rentalUnits = ceilUnits(duration, unitMs)
  const subtotal = roundMoney(input.rentalPrice * rentalUnits)
  const serviceFee = roundMoney(subtotal * ((input.serviceFeeBps ?? 1000) / 10_000))
  const depositAmount = roundMoney(input.depositAmount ?? 0)
  return {
    rentalUnits,
    subtotal,
    serviceFee,
    depositAmount,
    totalAmount: roundMoney(subtotal + serviceFee + depositAmount),
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export interface AvailabilityWindow {
  listingId: string;
  startsAt: string;
  endsAt: string;
}

export interface BookingWindow {
  id?: string;
  listingId: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "confirmed" | "active" | "returned" | "cancelled" | "disputed" | "completed";
}

const ACTIVE_STATUSES = new Set(["confirmed", "active"]);

function toMs(value: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error("INVALID_DATETIME");
  return ms;
}

export function overlaps(a: BookingWindow | AvailabilityWindow, b: BookingWindow | AvailabilityWindow): boolean {
  const aStart = toMs(a.startsAt);
  const aEnd = toMs(a.endsAt);
  const bStart = toMs(b.startsAt);
  const bEnd = toMs(b.endsAt);
  if (aEnd <= aStart || bEnd <= bStart) throw new Error("INVALID_WINDOW");
  return aStart < bEnd && bStart < aEnd;
}

export function isAvailable(window: AvailabilityWindow, bookings: BookingWindow[]): boolean {
  return bookings
    .filter((booking) => booking.listingId === window.listingId && ACTIVE_STATUSES.has(booking.status))
    .every((booking) => !overlaps(window, booking));
}

export function assertAvailable(window: AvailabilityWindow, bookings: BookingWindow[]): void {
  if (!isAvailable(window, bookings)) throw new Error("LISTING_UNAVAILABLE");
}

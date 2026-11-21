export interface AvailabilityWindow {
  startsAt: string;
  endsAt: string;
}

export interface BookingWindow extends AvailabilityWindow {
  status: "pending" | "confirmed" | "active" | "returned" | "cancelled" | "disputed" | "completed";
}

export function windowsOverlap(a: AvailabilityWindow, b: AvailabilityWindow): boolean {
  const aStart = Date.parse(a.startsAt);
  const aEnd = Date.parse(a.endsAt);
  const bStart = Date.parse(b.startsAt);
  const bEnd = Date.parse(b.endsAt);
  if (![aStart, aEnd, bStart, bEnd].every(Number.isFinite)) return false;
  if (aEnd <= aStart || bEnd <= bStart) return false;
  return aStart < bEnd && bStart < aEnd;
}

export function hasConfirmedConflict(candidate: AvailabilityWindow, existing: BookingWindow[]): boolean {
  return existing.some((booking) =>
    (booking.status === "confirmed" || booking.status === "active") && windowsOverlap(candidate, booking),
  );
}

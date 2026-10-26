import { strict as assert } from "node:assert";
import { authorizeRentRequest, canCreateBooking, validateOwnerListing } from "./rent-api";

const context = authorizeRentRequest({ userId: "u1", identityVerified: true, fortressAuthorized: true, requestId: "r1" });
assert.equal(context.ok, true);

const denied = authorizeRentRequest({ userId: "u1", identityVerified: false, fortressAuthorized: true, requestId: "r2" });
assert.equal(denied.status, 401);

const listing = validateOwnerListing({
  title: "Toyota Quantum",
  description: "Verified passenger vehicle available for daily rental.",
  category: "Vehicles",
  location: "Johannesburg",
  rentalPrice: 1200,
  currency: "ZAR",
  rentalPeriod: "day",
  ownerVerified: true,
  verificationStatus: "verified",
});
assert.equal(listing.ok, true);
assert.equal(listing.data?.publishable, true);

const available = canCreateBooking(
  { startsAt: "2026-11-01T10:00:00Z", endsAt: "2026-11-03T10:00:00Z", status: "pending" },
  [],
);
assert.equal(available.ok, true);

const conflict = canCreateBooking(
  { startsAt: "2026-11-02T10:00:00Z", endsAt: "2026-11-04T10:00:00Z", status: "pending" },
  [{ startsAt: "2026-11-01T10:00:00Z", endsAt: "2026-11-03T10:00:00Z", status: "confirmed" }],
);
assert.equal(conflict.status, 409);

console.log("IZAKHONO RENT API orchestration tests passed");

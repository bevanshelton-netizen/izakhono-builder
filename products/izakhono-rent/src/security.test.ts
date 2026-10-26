import { assertPaymentAuthority, assertRentAccess } from "./security";

let rejected = false;
try {
  assertRentAccess(
    { userId: null, authenticated: false, fortressVerified: false, rateLimitRemaining: 10 },
    "book",
  );
} catch {
  rejected = true;
}
if (!rejected) throw new Error("Unauthenticated booking request must be rejected");

rejected = false;
try {
  assertPaymentAuthority({
    userId: "user-1",
    authenticated: true,
    fortressVerified: false,
    rateLimitRemaining: 10,
  });
} catch {
  rejected = true;
}
if (!rejected) throw new Error("Unverified payment request must be rejected");

assertRentAccess(
  { userId: null, authenticated: false, fortressVerified: false, rateLimitRemaining: 10 },
  "discover",
);

console.log("IZAKHONO RENT security gate tests passed");

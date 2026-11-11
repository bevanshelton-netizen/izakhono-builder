export interface RentRequestContext {
  userId: string | null;
  authenticated: boolean;
  fortressVerified: boolean;
  rateLimitRemaining: number;
}

export function assertRentAccess(
  context: RentRequestContext,
  action: "discover" | "create_listing" | "book" | "payment" | "handover" | "dispute",
): void {
  if (action === "discover") return;

  if (!context.authenticated || !context.userId) {
    throw new Error("IZAKHONO ID authentication required");
  }

  if (!context.fortressVerified) {
    throw new Error("FORTRESS verification required");
  }

  if (context.rateLimitRemaining < 1) {
    throw new Error("Request rate limit exceeded");
  }
}

export function assertPaymentAuthority(context: RentRequestContext): void {
  assertRentAccess(context, "payment");
}

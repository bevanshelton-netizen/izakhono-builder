export type PaymentEntitlementStatus = "PAID" | "REFUNDED" | "CANCELLED" | "FAILED";

export function entitlementStatusForPayment(status: PaymentEntitlementStatus): "ACTIVE" | "REVOKED" {
  return status === "PAID" ? "ACTIVE" : "REVOKED";
}

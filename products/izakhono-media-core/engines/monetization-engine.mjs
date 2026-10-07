const PLANS = {
  free: { price: 0, currency: "ZAR", interval: "month", entitlements: ["watch"] },
  starter: { price: 499, currency: "ZAR", interval: "month", entitlements: ["watch", "channel_basic"] },
  pro: { price: 1499, currency: "ZAR", interval: "month", entitlements: ["watch", "channel_basic", "channel_live", "analytics"] },
  enterprise: { price: 4999, currency: "ZAR", interval: "month", entitlements: ["watch", "channel_basic", "channel_live", "analytics", "multi_channel", "priority_support"] }
};

export function getPlan(plan = "starter") {
  const key = String(plan);
  if (!PLANS[key]) throw new Error(`unknown plan: ${key}`);
  return { id: key, ...PLANS[key] };
}

export function createOrder({ customer_id, plan = "starter", payment_reference = null } = {}) {
  if (!customer_id) throw new Error("customer_id is required");
  const selected = getPlan(plan);
  return {
    id: `ord_${Date.now().toString(36)}`,
    customer_id: String(customer_id),
    plan: selected.id,
    amount: selected.price,
    currency: selected.currency,
    interval: selected.interval,
    payment_status: payment_reference ? "pending_verification" : "unpaid",
    payment_reference: payment_reference ? String(payment_reference) : null,
    entitlement_status: "inactive",
    created_at: new Date().toISOString()
  };
}

export function verifyPayment(order, { verified = false, reference = null } = {}) {
  if (!order) throw new Error("order is required");
  if (!verified) return { ...order, payment_status: "pending_verification" };
  return { ...order, payment_status: "paid", payment_reference: String(reference || order.payment_reference || "verified"), entitlement_status: "active", paid_at: new Date().toISOString() };
}

export function hasEntitlement(order, entitlement) {
  if (!order || order.payment_status !== "paid" || order.entitlement_status !== "active") return false;
  return getPlan(order.plan).entitlements.includes(String(entitlement));
}

export async function getMerchantControlCentre(db: D1Database, merchantId: string) {
  const merchant = await db.prepare('SELECT id,name,email,status,created_at FROM pay_merchants WHERE id=?').bind(merchantId).first<any>();
  if (!merchant) return null;

  const [summary, refunds, kyb, health] = await Promise.all([
    db.prepare(`SELECT
      COUNT(*) transactions,
      COALESCE(SUM(CASE WHEN status IN ('authorised','settled') THEN amount ELSE 0 END),0) processed_volume,
      COALESCE(SUM(CASE WHEN status IN ('initiated','pending') THEN amount ELSE 0 END),0) pending_volume
      FROM pay_payment_intents WHERE merchant_id=?`).bind(merchantId).first<any>(),
    db.prepare("SELECT COUNT(*) count FROM pay_refunds r JOIN pay_payment_intents p ON p.id=r.payment_id WHERE p.merchant_id=? AND r.status='requested'").bind(merchantId).first<any>(),
    db.prepare('SELECT COUNT(*) count FROM pay_kyb_checks WHERE merchant_id=?').bind(merchantId).first<any>(),
    db.prepare('SELECT provider,status,failure_count,last_checked_at FROM pay_provider_health ORDER BY provider').all<any>(),
  ]);

  const settled = await db.prepare("SELECT COALESCE(SUM(net_amount),0) amount FROM pay_settlements WHERE merchant_id=? AND status='received'").bind(merchantId).first<any>();
  const links = await db.prepare("SELECT COUNT(*) count FROM pay_links WHERE merchant_id=? AND status='active'").bind(merchantId).first<any>();

  return {
    merchant,
    financials: {
      transactions: Number(summary?.transactions || 0),
      processedVolume: Number(summary?.processed_volume || 0),
      pendingVolume: Number(summary?.pending_volume || 0),
      settledNet: Number(settled?.amount || 0),
      activePaymentLinks: Number(links?.count || 0),
      requestedRefunds: Number(refunds?.count || 0),
    },
    compliance: { kybChecks: Number(kyb?.count || 0) },
    providers: health.results || [],
    currency: 'ZAR',
  };
}

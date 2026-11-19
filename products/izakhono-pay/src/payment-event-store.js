export async function recordPaymentEvent({ db, eventId, provider, eventType, fingerprint, intentId, payload, verified = true }) {
  try {
    await db.prepare('INSERT INTO payment_events(id,provider,fingerprint,event_type,intent_id,payload_json,verified) VALUES(?,?,?,?,?,?,?)')
      .bind(eventId, provider, fingerprint, eventType, intentId || null, JSON.stringify(payload).slice(0, 50000), verified ? 1 : 0).run();
    return true;
  } catch (insertError) {
    // A failed insert is a replay only when the exact provider/fingerprint is
    // already durable. Any other storage error must propagate for retry.
    try {
      const existing = await db.prepare('SELECT id FROM payment_events WHERE provider=? AND fingerprint=? LIMIT 1')
        .bind(provider, fingerprint).first();
      if (existing) return false;
    } catch {
      // Preserve the original insert failure; a failed lookup cannot prove replay.
    }
    throw insertError;
  }
}

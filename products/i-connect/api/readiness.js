function getReadiness(env = process.env) {
  const checks = {
    supabaseUrl: Boolean(env.I_CONNECT_SUPABASE_URL),
    supabaseAnonKey: Boolean(env.I_CONNECT_SUPABASE_ANON_KEY),
    carrierBridgeUrl: Boolean(env.I_CONNECT_CARRIER_BRIDGE_URL),
    carrierBridgeSecret: Boolean(env.I_CONNECT_CARRIER_BRIDGE_SECRET),
    paymentProvider: Boolean(env.I_CONNECT_PAYMENT_PROVIDER_SECRET)
  };
  const database = checks.supabaseUrl && checks.supabaseAnonKey;
  const carrier = checks.carrierBridgeUrl && checks.carrierBridgeSecret;
  const payments = checks.paymentProvider;
  const productionReady = database && carrier && payments;

  return {
    productionReady,
    body: {
      service: 'I-CONNECT',
      status: productionReady ? 'production_ready' : 'activation_required',
      productionReady,
      modules: {
        webApp: 'ready',
        agentApp: 'ready',
        database: database ? 'configured' : 'missing_credentials',
        carrier: carrier ? 'configured' : 'missing_credentials',
        payments: payments ? 'configured' : 'missing_credentials'
      },
      missing: Object.entries(checks).filter(([, configured]) => !configured).map(([key]) => key),
      safeguards: { pstnLive: carrier, realBilling: payments, demoFallback: true }
    }
  };
}

module.exports = { getReadiness };

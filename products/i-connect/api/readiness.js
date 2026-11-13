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
  const configurationComplete = database && carrier && payments;

  return {
    // Configuration is only one prerequisite. Live probes, supplier approval,
    // payment acceptance and explicit activation are separate mandatory gates.
    productionReady: false,
    body: {
      service: 'I-CONNECT',
      status: configurationComplete ? 'configuration_complete_activation_required' : 'activation_required',
      configurationComplete,
      productionReady: false,
      modules: {
        webApp: 'ready',
        agentApp: 'ready',
        database: database ? 'configured_unverified' : 'missing_credentials',
        carrier: carrier ? 'configured_unverified' : 'missing_credentials',
        payments: payments ? 'configured_unverified' : 'missing_credentials'
      },
      missing: Object.entries(checks).filter(([, configured]) => !configured).map(([key]) => key),
      safeguards: {
        pstnLive: false,
        realBilling: false,
        demoFallback: true,
        activationRequiresIndependentApproval: true
      }
    }
  };
}

module.exports = { getReadiness };

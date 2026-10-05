module.exports=(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'method_not_allowed'})}
  const checks={
    supabaseUrl:Boolean(process.env.I_CONNECT_SUPABASE_URL),
    supabaseAnonKey:Boolean(process.env.I_CONNECT_SUPABASE_ANON_KEY),
    carrierBridgeUrl:Boolean(process.env.I_CONNECT_CARRIER_BRIDGE_URL),
    carrierBridgeSecret:Boolean(process.env.I_CONNECT_CARRIER_BRIDGE_SECRET),
    paymentProvider:Boolean(process.env.I_CONNECT_PAYMENT_PROVIDER_SECRET)
  };
  const database=checks.supabaseUrl&&checks.supabaseAnonKey;
  const carrier=checks.carrierBridgeUrl&&checks.carrierBridgeSecret;
  const payments=checks.paymentProvider;
  const productionReady=database&&carrier&&payments;
  return res.status(productionReady?200:503).json({
    service:'I-CONNECT',
    status:productionReady?'production_ready':'activation_required',
    productionReady,
    modules:{
      webApp:'ready',
      agentApp:'ready',
      database:database?'configured':'missing_credentials',
      carrier:carrier?'configured':'missing_credentials',
      payments:payments?'configured':'missing_credentials'
    },
    missing:Object.entries(checks).filter(([,v])=>!v).map(([k])=>k),
    safeguards:{pstnLive:carrier,realBilling:payments,demoFallback:true}
  });
};
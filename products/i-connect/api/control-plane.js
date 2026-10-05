const MODULES = {
  identity: { status: 'contract-ready', persistence: 'supabase-required' },
  contactCentre: {
    status: 'data-model-ready',
    capabilities: ['queues','agents','mobile-bridge-mode','softphone-mode','call-state','masked-customer-number']
  },
  provisioning: {
    status: 'data-model-ready',
    states: ['pending','approved','running','waiting_provider','completed','failed','cancelled']
  },
  billing: {
    status: 'data-model-ready',
    capabilities: ['invoices','usage-records','ZAR-rating-foundation']
  },
  voice: {
    status: 'adapter-required',
    carrierNeutral: true,
    pstnLive: false,
    note: 'Real PSTN calling requires authorised carrier/SIP credentials and regulatory-compliant numbering.'
  },
  security: {
    status: 'hardened-contract',
    controls: ['tenant-scoped-RBAC','RLS','private-RBAC-helpers','audit-events','idempotency-keys']
  }
};

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    service: 'I-CONNECT Control Plane',
    version: '1.1',
    architecture: 'owned-first, carrier-neutral, externally reversible',
    modules: MODULES,
    productionDependencies: {
      database: 'DEDICATED_I_CONNECT_SUPABASE_PROJECT_REQUIRED',
      carrier: 'AUTHORISED_CARRIER_OR_SIP_ADAPTER_REQUIRED',
      payments: 'PAYMENT_PROVIDER_SECRET_REQUIRED'
    }
  });
};

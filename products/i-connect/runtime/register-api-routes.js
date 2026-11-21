function registerRoutes(app) {
  app.all('/api/customer-control', require('./customer-control'));
  app.all('/api/provisioning', require('./provisioning'));
  app.all('/api/handover', require('./handover'));
  app.all('/api/checkout-intent', require('./checkout-intent'));
  app.all('/api/checkout-state', require('./checkout-state'));
  app.all('/api/provider-attempt', require('./provider-attempt'));
}

module.exports = registerRoutes;

function registerRoutes(app) {
  app.all('/api/public-config', require('../api/public-config'));
  app.all('/api/catalogue', require('../api/catalogue'));
  app.all('/api/my-organizations', require('../api/my-organizations'));
  app.all('/api/onboarding', require('../api/onboarding'));
  app.all('/api/customer-control', require('../api/customer-control'));
  app.all('/api/provisioning', require('../api/provisioning'));
  app.all('/api/handover', require('../api/handover'));
  app.all('/api/checkout-intent', require('../api/checkout-intent'));
  app.all('/api/checkout-state', require('../api/checkout-state'));
  app.all('/api/provider-attempt', require('../api/provider-attempt'));
}

module.exports = registerRoutes;

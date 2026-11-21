const express = require('express');
const path = require('path');
const networkRoute = require('./api/network-route');
const { getReadiness } = require('./api/readiness');

const app = express();
app.use(express.json({ limit: '1mb' }));

const root = __dirname;
app.use('/agent', express.static(path.join(root, 'agent')));
app.use(express.static(root));

// Liveness: proves only that this process can answer HTTP requests.
// Keep this independent of supplier, database and payment activation.
app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).json({
    service: 'I-CONNECT',
    status: 'alive',
    process: 'ready',
    productionReady: false
  });
});

// Readiness: reports integration configuration without exposing secret values.
// Configuration alone is not proof of supplier approval or live commercial readiness.
app.get('/api/readiness', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const readiness = getReadiness();
  res.status(readiness.productionReady ? 200 : 503).json(readiness.body);
});

app.get('/api/runtime', (req, res) => res.json({
  service: 'I-CONNECT',
  runtime: 'IZAKHONO portable container',
  platformDependency: 'none',
  node: process.version
}));

app.all('/api/network/route', networkRoute);

// Shared authenticated customer and lifecycle APIs. These handlers are also
// Vercel-compatible, but must be mounted explicitly for the owned Express runtime.
app.all('/api/customer-control', require('./api/customer-control'));
app.all('/api/provisioning', require('./api/provisioning'));
app.all('/api/handover', require('./api/handover'));
app.all('/api/checkout-intent', require('./api/checkout-intent'));
app.all('/api/checkout-state', require('./api/checkout-state'));
app.all('/api/provider-attempt', require('./api/provider-attempt'));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`I-CONNECT listening on ${port}`));

const express = require('express');
const path = require('path');
const networkRoute = require('./api/network-route');

const app = express();
app.use(express.json({ limit: '1mb' }));

const root = __dirname;
app.use('/agent', express.static(path.join(root, 'agent')));
app.use(express.static(root));

app.get('/api/health', (req, res) => {
  // Configuration is not proof of a functioning or commercially approved dependency.
  // Report conservative readiness states until each integration has an active probe
  // and documented production approval.
  res.json({
    service: 'I-CONNECT',
    status: 'activation_required',
    productionReady: false,
    modules: {
      webApp: 'ready',
      agentApp: 'ready',
      database: 'not_verified',
      carrier: 'not_configured',
      payments: 'not_configured'
    },
    readinessNote: 'Application shell is available. Database, carrier and payment integrations require verified health checks and approval.'
  });
});

app.get('/api/runtime', (req, res) => res.json({
  service: 'I-CONNECT',
  runtime: 'IZAKHONO portable container',
  platformDependency: 'none',
  node: process.version
}));

app.all('/api/network/route', networkRoute);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`I-CONNECT listening on ${port}`));

const express = require('express');
const path = require('path');
const networkRoute = require('./api/network-route');

const app = express();
app.use(express.json({ limit: '1mb' }));

const root = __dirname;
app.use('/agent', express.static(path.join(root, 'agent')));
app.use(express.static(root));

app.get('/api/health', (req, res) => {
  const required = [
    'I_CONNECT_SUPABASE_URL',
    'I_CONNECT_SUPABASE_ANON_KEY',
    'I_CONNECT_CARRIER_BRIDGE_URL',
    'I_CONNECT_CARRIER_BRIDGE_SECRET',
    'I_CONNECT_PAYMENT_PROVIDER_SECRET'
  ];
  const configured = Object.fromEntries(required.map(k => [k, Boolean(process.env[k])]));
  const missing = required.filter(k => !configured[k]);
  res.json({
    service: 'I-CONNECT',
    status: missing.length ? 'activation_required' : 'production_ready',
    pstnLive: configured.I_CONNECT_CARRIER_BRIDGE_URL && configured.I_CONNECT_CARRIER_BRIDGE_SECRET,
    realBilling: configured.I_CONNECT_PAYMENT_PROVIDER_SECRET,
    networkRouter: 'ready',
    missing
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

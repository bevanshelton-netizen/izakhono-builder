const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));
const { createClient } = require('@supabase/supabase-js');

async function automationContext(req, res, requiredRole = false) {
  const url = process.env.I_CONNECT_SUPABASE_URL;
  const anonKey = process.env.I_CONNECT_SUPABASE_ANON_KEY;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!url || !anonKey) {
    res.status(503).json({ error: 'Cloud workflow storage is not configured on this IZAKHONO runtime.' });
    return null;
  }
  if (!token) {
    res.status(401).json({ error: 'Sign in to I-CONNECT before accessing cloud workflows.' });
    return null;
  }
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    res.status(401).json({ error: 'Your I-CONNECT session is invalid or has expired.' });
    return null;
  }
  let membershipQuery = supabase.from('ic_memberships')
    .select('organization_id, role')
    .eq('user_id', authData.user.id)
    .eq('status', 'active');
  if (req.body?.organizationId || req.query?.organizationId) {
    membershipQuery = membershipQuery.eq('organization_id', req.body?.organizationId || req.query?.organizationId);
  }
  const { data: memberships, error: membershipError } = await membershipQuery;
  if (membershipError) {
    res.status(403).json({ error: 'Could not verify your organisation membership.' });
    return null;
  }
  const membership = (memberships || []).find(m => !requiredRole || ['owner', 'admin', 'manager'].includes(m.role));
  if (!membership) {
    res.status(403).json({ error: requiredRole ? 'Owner, admin or manager access is required to save workflows.' : 'No active I-CONNECT organisation membership was found.' });
    return null;
  }
  return { supabase, user: authData.user, organizationId: membership.organization_id };
}

app.get('/api/automation/workflows', async (req, res) => {
  try {
    const ctx = await automationContext(req, res, false);
    if (!ctx) return;
    const { data: workflows, error } = await ctx.supabase.from('ic_workflows')
      .select('id, name, description, status, current_version, created_at, updated_at')
      .eq('organization_id', ctx.organizationId)
      .order('updated_at', { ascending: false });
    if (error) return res.status(400).json({ error: 'Unable to load workflows.' });
    const ids = (workflows || []).map(w => w.id);
    let versions = [];
    if (ids.length) {
      const result = await ctx.supabase.from('ic_workflow_versions')
        .select('workflow_id, version, graph, validation_state, created_at')
        .in('workflow_id', ids)
        .order('version', { ascending: false });
      if (result.error) return res.status(400).json({ error: 'Unable to load workflow versions.' });
      versions = result.data || [];
    }
    const latest = new Map();
    for (const version of versions) if (!latest.has(version.workflow_id)) latest.set(version.workflow_id, version);
    res.json({
      organizationId: ctx.organizationId,
      workflows: (workflows || []).map(w => ({ ...w, latestVersion: latest.get(w.id) || null }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Unexpected workflow service error.' });
  }
});

app.post('/api/automation/workflows', async (req, res) => {
  try {
    const ctx = await automationContext(req, res, true);
    if (!ctx) return;
    const { name, description = '', graph, workflowId = null } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || !graph || typeof graph !== 'object' || Array.isArray(graph)) {
      return res.status(400).json({ error: 'A workflow name and valid graph object are required.' });
    }
    if (Buffer.byteLength(JSON.stringify(graph), 'utf8') > 256 * 1024) {
      return res.status(413).json({ error: 'Workflow graph exceeds the 256 KB limit.' });
    }
    const { data, error } = await ctx.supabase.rpc('ic_save_workflow', {
      p_organization_id: ctx.organizationId,
      p_workflow_id: workflowId,
      p_name: name.trim(),
      p_description: String(description).slice(0, 2000),
      p_graph: graph
    });
    if (error) return res.status(400).json({ error: 'Workflow could not be saved. Check your permissions and workflow data.' });
    const saved = Array.isArray(data) ? data[0] : data;
    res.status(201).json({ saved: true, workflowId: saved.workflow_id, version: saved.workflow_version });
  } catch (error) {
    res.status(500).json({ error: 'Unexpected workflow save error.' });
  }
});


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
    missing
  });
});

app.get('/api/runtime', (req, res) => res.json({
  service: 'I-CONNECT',
  runtime: 'IZAKHONO portable container',
  platformDependency: 'none',
  node: process.version
}));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`I-CONNECT listening on ${port}`));

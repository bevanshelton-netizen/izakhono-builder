const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));
const { createClient } = require('@supabase/supabase-js');
const { simulateWorkflowGraph } = require('./workflow-test-simulator');

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
    res.status(201).json({ saved: true, organizationId: ctx.organizationId, workflowId: saved.workflow_id, version: saved.workflow_version });
  } catch (error) {
    res.status(500).json({ error: 'Unexpected workflow save error.' });
  }
});


app.post('/api/automation/workflows/:workflowId/test-run', async (req, res) => {
  try {
    const ctx = await automationContext(req, res, true);
    if (!ctx) return;
    const { idempotencyKey, input = {} } = req.body || {};
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 160) {
      return res.status(400).json({ error: 'A valid idempotency key is required.' });
    }
    if (!input || typeof input !== 'object' || Array.isArray(input) || Buffer.byteLength(JSON.stringify(input), 'utf8') > 64 * 1024) {
      return res.status(400).json({ error: 'Test input must be a JSON object under 64 KB.' });
    }
    const { data, error } = await ctx.supabase.rpc('ic_enqueue_workflow_test_run', {
      p_organization_id: ctx.organizationId,
      p_workflow_id: req.params.workflowId,
      p_idempotency_key: idempotencyKey,
      p_input: input
    });
    if (error) return res.status(400).json({ error: 'Could not queue workflow test. Confirm it is a saved draft and you have manager permissions.' });
    const run = Array.isArray(data) ? data[0] : data;
    res.status(202).json({ queued: true, runId: run.run_id, version: run.workflow_version, status: run.run_status });
  } catch (error) {
    res.status(500).json({ error: 'Unexpected workflow test queue error.' });
  }
});

app.get('/api/automation/runs', async (req, res) => {
  try {
    const ctx = await automationContext(req, res, false);
    if (!ctx) return;
    const { data, error } = await ctx.supabase.from('ic_workflow_runs')
      .select('id, workflow_id, workflow_version, trigger_type, status, attempts, output, error, created_at, started_at, finished_at')
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) return res.status(400).json({ error: 'Unable to load workflow run history.' });
    res.json({ runs: data || [] });
  } catch (error) {
    res.status(500).json({ error: 'Unexpected workflow history error.' });
  }
});

// The worker is opt-in and runs only the no-side-effect manual_test queue.
// Live channel/action execution is deliberately not implemented by this worker.
function startWorkflowTestWorker() {
  const url = process.env.I_CONNECT_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.I_CONNECT_WORKER_ENABLED !== 'true' || !url || !serviceKey) return;
  const workerClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  let busy = false;
  const workerId = 'i-connect-test-worker';
  const tick = async () => {
    if (busy) return;
    busy = true;
    let claimedRun = null;
    try {
      const { data, error } = await workerClient.rpc('ic_claim_workflow_test_run', { p_worker_id: workerId });
      if (error) throw error;
      const run = Array.isArray(data) ? data[0] : null;
      if (!run) return;
      claimedRun = run;
      let simulation;
      try {
        simulation = simulateWorkflowGraph(run.workflow_graph);
      } catch (simulationError) {
        await workerClient.rpc('ic_finish_workflow_test_run', {
          p_run_id: run.run_id,
          p_status: 'failed',
          p_output: {},
          p_error: { code: simulationError.code || 'INVALID_GRAPH', message: simulationError.message }
        });
        return;
      }
      const { error: finishError } = await workerClient.rpc('ic_finish_workflow_test_run', {
        p_run_id: run.run_id,
        p_status: 'completed',
        p_output: {
          ...simulation
        },
        p_error: {}
      });
      if (finishError) throw finishError;
    } catch (error) {
      // If a run was claimed, close it as failed rather than leaving it indefinitely running.
      if (claimedRun?.run_id) {
        try {
          await workerClient.rpc('ic_finish_workflow_test_run', {
            p_run_id: claimedRun.run_id,
            p_status: 'failed',
            p_output: {},
            p_error: { code: 'WORKER_ERROR', message: 'The workflow simulation worker could not complete this run.' }
          });
        } catch (_) { /* Keep worker logs free of untrusted payloads and secrets. */ }
      }
      console.error('I-CONNECT workflow test worker encountered an error.');
    } finally {
      busy = false;
    }
  };
  setInterval(tick, 2500);
  tick();
}


const root = __dirname;
app.use('/agent', express.static(path.join(root, 'agent')));
app.use(express.static(root));

app.get('/api/config', (req, res) => {
  const supabaseUrl = process.env.I_CONNECT_SUPABASE_URL || '';
  const anonKey = process.env.I_CONNECT_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !anonKey) {
    return res.status(503).json({ error: 'I-CONNECT authentication is not configured on this runtime.' });
  }
  res.set('Cache-Control', 'no-store');
  res.json({ supabaseUrl, anonKey });
});

app.get('/api/health', (req, res) => {
  const databaseConfigured = Boolean(process.env.I_CONNECT_SUPABASE_URL && process.env.I_CONNECT_SUPABASE_ANON_KEY);
  const carrierConfigured = Boolean(process.env.I_CONNECT_CARRIER_BRIDGE_URL && process.env.I_CONNECT_CARRIER_BRIDGE_SECRET);
  const paymentsConfigured = Boolean(process.env.I_CONNECT_PAYMENT_PROVIDER_SECRET);
  const workerConfigured = Boolean(process.env.I_CONNECT_WORKER_ENABLED === 'true' && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const modules = {
    webApp: 'ready',
    agentApp: 'ready',
    database: databaseConfigured ? 'configured_not_verified' : 'missing_credentials',
    carrier: carrierConfigured ? 'configured_not_verified' : 'missing_credentials',
    payments: paymentsConfigured ? 'configured_not_verified' : 'missing_credentials'
  };
  res.json({
    service: 'I-CONNECT',
    status: 'activation_required',
    productionReady: false,
    modules,
    workflowTestWorker: workerConfigured ? 'configured_not_verified' : 'disabled',
    note: 'Configuration presence is not a production health check. Verify database connectivity, carrier delivery, payment callbacks and end-to-end service before activation.'
  });
});

app.get('/api/runtime', (req, res) => res.json({
  service: 'I-CONNECT',
  runtime: 'IZAKHONO portable container',
  platformDependency: 'none',
  node: process.version
}));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {\n  console.log(`I-CONNECT listening on ${port}`);\n  startWorkflowTestWorker();\n});

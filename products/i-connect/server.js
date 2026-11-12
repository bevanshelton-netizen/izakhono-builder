const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb', verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
const { createClient } = require('@supabase/supabase-js');
const { isPrivateStaticPath } = require('./static-file-guard');
const { simulateWorkflowGraph } = require('./workflow-test-simulator');
const { verifyWebhookSignature, verifyWebhookChallenge, normaliseWhatsAppWebhook } = require('./whatsapp-webhook-adapter');

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
  return { supabase, user: authData.user, organizationId: membership.organization_id, role: membership.role, memberships: memberships || [] };
}

app.get('/api/automation/organizations', async (req, res) => {
  try {
    const ctx = await automationContext(req, res, false);
    if (!ctx) return;
    const organizationIds = [...new Set((ctx.memberships || []).map(item => item.organization_id))];
    if (!organizationIds.length) return res.json({ organizations: [] });
    const { data, error } = await ctx.supabase.from('ic_organizations')
      .select('id, name, slug, status')
      .in('id', organizationIds)
      .eq('status', 'active')
      .order('name');
    if (error) return res.status(400).json({ error: 'Unable to load organisation access.' });
    res.json({ organizations: (data || []).map(org => ({ ...org, role: (ctx.memberships || []).find(m => m.organization_id === org.id)?.role || 'member' })) });
  } catch (error) {
    res.status(500).json({ error: 'Unexpected organisation access error.' });
  }
});

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

// Meta WhatsApp webhook verification and durable event intake.
// This endpoint only stores signed events; it does not trigger workflows or send replies.

app.get('/api/inbox/threads', async (req, res) => {
  try {
    const ctx = await automationContext(req, res, false);
    if (!ctx) return;
    const allowedStatuses = new Set(['open', 'pending', 'waiting_customer', 'waiting_team', 'closed', 'archived']);
    const status = String(req.query.status || 'open');
    if (status !== 'all' && !allowedStatuses.has(status)) return res.status(400).json({ error: 'Unsupported inbox status filter.' });
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, Math.min(10000, Number.parseInt(req.query.offset, 10) || 0));
    let query = ctx.supabase.from('ic_inbox_threads')
      .select('id, contact_id, channel, subject, status, priority, assigned_to, queue_id, last_message_at, created_at')
      .eq('organization_id', ctx.organizationId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);
    if (status !== 'all') query = query.eq('status', status);
    if (req.query.channel) query = query.eq('channel', String(req.query.channel));
    const { data: threads, error } = await query;
    if (error) return res.status(400).json({ error: 'Unable to load inbox conversations.' });
    const contactIds = [...new Set((threads || []).map(item => item.contact_id))];
    let contacts = [];
    if (contactIds.length) {
      const result = await ctx.supabase.from('ic_contacts')
        .select('id, display_name, email, phone')
        .eq('organization_id', ctx.organizationId)
        .in('id', contactIds);
      if (result.error) return res.status(400).json({ error: 'Unable to load inbox contact details.' });
      contacts = result.data || [];
    }
    const contactMap = new Map(contacts.map(contact => [contact.id, contact]));
    res.json({ organizationId: ctx.organizationId, threads: (threads || []).map(thread => ({ ...thread, contact: contactMap.get(thread.contact_id) || null })) });
  } catch (_) {
    res.status(500).json({ error: 'Unexpected inbox list error.' });
  }
});


app.get('/api/inbox/queues', async (req, res) => {
  try {
    const ctx = await automationContext(req, res, false);
    if (!ctx) return;
    const { data, error } = await ctx.supabase.from('ic_contact_queues').select('id,name,status').eq('organization_id',ctx.organizationId).eq('status','active').order('name');
    if (error) return res.status(400).json({ error: 'Unable to load organisation queues.' });
    res.json({ queues: data || [] });
  } catch (_) { res.status(500).json({ error: 'Unexpected queue roster error.' }); }
});
app.get('/api/inbox/agents', async (req, res) => {
  try {
    const ctx = await automationContext(req, res, false);
    if (!ctx) return;
    if (!['owner','admin','manager'].includes(ctx.role)) return res.status(403).json({ error: 'Manager permissions are required to view the assignment roster.' });
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return res.status(503).json({ error: 'The organisation assignment roster is not configured on this runtime.' });
    const admin = createClient(process.env.I_CONNECT_SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: memberships, error } = await admin.from('ic_memberships').select('user_id, role').eq('organization_id', ctx.organizationId).eq('status','active').in('role',['owner','admin','manager','agent']).order('role');
    if (error) return res.status(400).json({ error: 'Unable to load the organisation assignment roster.' });
    const ids = [...new Set((memberships || []).map(row => row.user_id))];
    const { data: profiles, error: profileError } = ids.length ? await admin.from('ic_profiles').select('id, display_name').in('id',ids) : { data: [], error: null };
    if (profileError) return res.status(400).json({ error: 'Unable to load agent display names.' });
    const profileMap = new Map((profiles || []).map(profile => [profile.id, profile.display_name]));
    res.json({ agents: (memberships || []).map(row => ({ id: row.user_id, role: row.role, displayName: profileMap.get(row.user_id) || 'I-CONNECT ' + row.role })) });
  } catch (_) { res.status(500).json({ error: 'Unexpected assignment roster error.' }); }
});
app.post('/api/inbox/threads/:threadId/actions', async (req, res) => {
  try {
    const ctx = await automationContext(req, res, false);
    if (!ctx) return;
    const { action, assigneeId = null, status = null, priority = null, queueId = null } = req.body || {};
    const allowed = new Set(['claim', 'release', 'assign', 'status', 'priority', 'queue']);
    if (!allowed.has(action)) return res.status(400).json({ error: 'Unsupported inbox action.' });
    if (action === 'status' && !['open','pending','waiting_customer','waiting_team','closed','archived'].includes(status)) return res.status(400).json({ error: 'Unsupported conversation status.' });
    if (action === 'priority' && !['low','normal','high','urgent'].includes(priority)) return res.status(400).json({ error: 'Unsupported conversation priority.' });
    if (['assign', 'priority', 'queue'].includes(action) && !['owner', 'admin', 'manager'].includes(ctx.role)) {
      return res.status(403).json({ error: 'Manager permissions are required for this action.' });
    }
    const { data, error } = await ctx.supabase.rpc('ic_manage_inbox_thread', {
      p_organization_id: ctx.organizationId,
      p_thread_id: req.params.threadId,
      p_action: action,
      p_assignee_id: assigneeId,
      p_status: status,
      p_priority: priority,
      p_queue_id: queueId
    });
    if (error) return res.status(403).json({ error: 'The conversation could not be updated. Check assignment and organisation permissions.' });
    res.json({ success: true, result: data });
  } catch (_) {
    res.status(500).json({ error: 'Unexpected inbox handover error.' });
  }
});

app.post('/api/inbox/threads/:threadId/notes', async (req, res) => {
  try {
    const ctx = await automationContext(req, res, false);
    if (!ctx) return;
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    if (!body.trim() || body.length > 5000) return res.status(400).json({ error: 'Internal note must contain 1 to 5000 characters.' });
    const { data, error } = await ctx.supabase.rpc('ic_add_inbox_internal_note', { p_organization_id: ctx.organizationId, p_thread_id: req.params.threadId, p_body: body });
    if (error) return res.status(403).json({ error: 'Internal note could not be saved. Check that you are assigned to this conversation or have manager access.' });
    res.status(201).json({ saved: true, noteId: data });
  } catch (_) { res.status(500).json({ error: 'Unexpected internal note error.' }); }
});
app.get('/api/inbox/threads/:threadId/messages', async (req, res) => {
  try {
    const ctx = await automationContext(req, res, false);
    if (!ctx) return;
    const { data: thread, error: threadError } = await ctx.supabase.from('ic_inbox_threads')
      .select('id, channel, subject, status, priority, assigned_to, created_at, last_message_at')
      .eq('organization_id', ctx.organizationId)
      .eq('id', req.params.threadId)
      .maybeSingle();
    if (threadError) return res.status(400).json({ error: 'Unable to load this inbox conversation.' });
    if (!thread) return res.status(404).json({ error: 'Inbox conversation not found.' });
    const { data: messages, error } = await ctx.supabase.from('ic_inbox_messages')
      .select('id, direction, message_type, body, delivery_status, provider_timestamp, created_at')
      .eq('organization_id', ctx.organizationId)
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) return res.status(400).json({ error: 'Unable to load conversation messages.' });
    res.json({ thread, messages: messages || [] });
  } catch (_) {
    res.status(500).json({ error: 'Unexpected conversation history error.' });
  }
});

// Outbound message preparation is draft-and-approval only. No provider send path exists.
app.get('/api/outbound/drafts', async (req, res) => {
  try {
    const ctx = await automationContext(req, res, false);
    if (!ctx) return;
    if (!['owner','admin','manager','agent'].includes(ctx.role)) return res.status(403).json({ error: 'I-CONNECT membership is required.' });
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return res.status(503).json({ error: 'Outbound draft storage is not configured on this runtime.' });
    const admin = createClient(process.env.I_CONNECT_SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.from('ic_outbound_message_drafts')
      .select('id,contact_id,thread_id,connection_id,channel,purpose,message_type,body,status,created_by,reviewed_by,reviewed_at,review_note,created_at')
      .eq('organization_id',ctx.organizationId).order('created_at',{ascending:false}).limit(100);
    if (error) return res.status(400).json({ error: 'Unable to load outbound drafts.' });
    res.json({ drafts: data || [], deliveryEnabled: false });
  } catch (_) { res.status(500).json({ error: 'Unexpected outbound draft list error.' }); }
});
app.post('/api/outbound/drafts', async (req, res) => {
  try {
    const ctx = await automationContext(req, res, false);
    if (!ctx) return;
    const { contactId, threadId = null, connectionId, channel, purpose, messageType = 'text', body } = req.body || {};
    if (![contactId,connectionId,channel,purpose,messageType,body].every(value => typeof value === 'string') || !body.trim() || body.length > 10000) {
      return res.status(400).json({ error: 'Contact, active channel, purpose and a message body of 1 to 10000 characters are required.' });
    }
    const { data, error } = await ctx.supabase.rpc('ic_create_outbound_message_draft', {
      p_organization_id:ctx.organizationId,p_contact_id:contactId,p_thread_id:threadId,
      p_connection_id:connectionId,p_channel:channel,p_purpose:purpose,p_message_type:messageType,p_body:body
    });
    if (error) return res.status(403).json({ error: 'Draft could not be created. Check the active channel, contact and assignment permissions.' });
    res.status(201).json({ created:true,draftId:data,status:'pending_approval',deliveryEnabled:false });
  } catch (_) { res.status(500).json({ error: 'Unexpected outbound draft creation error.' }); }
});
app.post('/api/outbound/drafts/:draftId/review', async (req, res) => {
  try {
    const ctx = await automationContext(req, res, false);
    if (!ctx) return;
    if (!['owner','admin','manager'].includes(ctx.role)) return res.status(403).json({ error: 'Manager permissions are required to review outbound drafts.' });
    const { decision, note = '' } = req.body || {};
    if (!['approve','reject'].includes(decision) || typeof note !== 'string' || note.length > 1000) return res.status(400).json({ error: 'A valid approval decision and optional note are required.' });
    const { data, error } = await ctx.supabase.rpc('ic_review_outbound_message_draft', {
      p_organization_id:ctx.organizationId,p_draft_id:req.params.draftId,p_decision:decision,p_review_note:note
    });
    if (error) return res.status(403).json({ error: 'Draft review failed. The reviewer must be a different manager from the draft creator.' });
    res.json({ ...data, deliveryEnabled:false });
  } catch (_) { res.status(500).json({ error: 'Unexpected outbound draft review error.' }); }
});

app.get('/api/webhooks/whatsapp', (req, res) => {
  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!expectedToken || process.env.I_CONNECT_WHATSAPP_WEBHOOK_ENABLED !== 'true') {
    return res.sendStatus(404);
  }
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (!verifyWebhookChallenge(mode, token, expectedToken, challenge)) return res.sendStatus(403);
  res.type('text/plain').status(200).send(challenge);
});

app.post('/api/webhooks/whatsapp', async (req, res) => {
  if (process.env.I_CONNECT_WHATSAPP_WEBHOOK_ENABLED !== 'true') return res.sendStatus(404);
  const appSecret = process.env.META_APP_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.I_CONNECT_SUPABASE_URL;
  if (!appSecret || !serviceKey || !supabaseUrl) {
    return res.status(503).json({ error: 'WhatsApp webhook intake is not configured.' });
  }
  const signature = req.get('x-hub-signature-256') || '';
  if (!verifyWebhookSignature(req.rawBody, signature, appSecret)) {
    return res.status(401).json({ error: 'Webhook signature verification failed.' });
  }
  try {
    const events = normaliseWhatsAppWebhook(req.body);
    if (!events.length) return res.status(200).json({ accepted: 0 });
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const rows = [];
    for (const event of events) {
      if (!event.phoneNumberId) return res.status(400).json({ error: 'Webhook event is missing its WhatsApp phone number identity.' });
      const { data: connections, error: connectionError } = await serviceClient
        .from('ic_channel_connections')
        .select('id, organization_id')
        .eq('provider', 'whatsapp')
        .eq('external_account_id', event.phoneNumberId)
        .eq('status', 'active')
        .limit(2);
      if (connectionError) return res.status(503).json({ error: 'Could not resolve the WhatsApp channel connection.' });
      if (!connections || connections.length !== 1) {
        return res.status(409).json({ error: 'WhatsApp phone number is not mapped to exactly one active I-CONNECT channel connection.' });
      }
      rows.push({
        provider: 'whatsapp',
        provider_event_id: event.providerEventId,
        connection_id: connections[0].id,
        organization_id: connections[0].organization_id,
        event_type: event.eventType,
        payload: event.payload,
        signature_verified: true,
        processing_state: 'received'
      });
    }
    const { error: insertError } = await serviceClient
      .from('ic_webhook_events')
      .upsert(rows, { onConflict: 'provider,provider_event_id', ignoreDuplicates: true });
    if (insertError) return res.status(503).json({ error: 'Signed webhook events could not be persisted.' });
    return res.status(200).json({ accepted: rows.length });
  } catch (error) {
    return res.status(500).json({ error: 'WhatsApp webhook intake failed safely.' });
  }
});

// The worker is opt-in and runs only the no-side-effect manual_test queue.
// Live channel/action execution is deliberately not implemented by this worker.

function startWhatsAppInboxWorker() {
  const url = process.env.I_CONNECT_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const enabled = process.env.I_CONNECT_INBOX_PROCESSING_ENABLED === 'true';
  const policyApproved = process.env.I_CONNECT_CUSTOMER_DATA_POLICY_APPROVED === 'YES';
  if (!enabled || !policyApproved || !url || !serviceKey) return;

  const workerClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    let claimed = null;
    try {
      const { data, error } = await workerClient.rpc('ic_claim_whatsapp_inbox_event');
      if (error) throw error;
      claimed = Array.isArray(data) ? data[0] : null;
      if (!claimed) return;
      const { error: processError } = await workerClient.rpc('ic_process_whatsapp_inbox_event', {
        p_event_id: claimed.event_id
      });
      if (processError) throw processError;
    } catch (_) {
      if (claimed?.event_id) {
        const attempts = Number(claimed.attempts || 1);
        try {
          await workerClient.from('ic_webhook_events').update({
            processing_state: attempts >= 3 ? 'dead_letter' : 'retry',
            processing_started_at: null,
            last_error: 'The signed inbound event could not be normalised into the I-CONNECT inbox.'
          }).eq('id', claimed.event_id).eq('processing_state', 'processing');
        } catch (_) { /* Keep customer payloads and provider details out of worker logs. */ }
      }
      console.error('I-CONNECT WhatsApp inbox worker encountered an error.');
    } finally {
      busy = false;
    }
  };
  setInterval(tick, 3000);
  tick();
}

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
app.use((req, res, next) => {
  if (isPrivateStaticPath(req.path)) return res.sendStatus(404);
  next();
});
app.use('/agent', express.static(path.join(root, 'agent'), { dotfiles: 'deny', fallthrough: true }));
app.use(express.static(root, { dotfiles: 'deny', fallthrough: true }));

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
app.listen(port, () => {
  console.log(`I-CONNECT listening on ${port}`);
  startWorkflowTestWorker();
  startWhatsAppInboxWorker();
});

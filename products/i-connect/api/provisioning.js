const { json, rpc } = require('./_lib/supabase');

const ACTION_TO_STATE = {
  provision: 'PROVISIONING',
  activate: 'ACTIVE',
  suspend: 'SUSPENDED',
  resume: 'ACTIVE',
  terminate: 'TERMINATED',
  retry: 'PROVISIONING'
};
const VALID_STATES = new Set(['PENDING_KYC','READY','PROVISIONING','ACTIVE','SUSPENDED','TERMINATED','FAILED']);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = String(body.action || '').trim().toLowerCase();
    const serviceId = String(body.serviceId || '').trim();
    const customerId = String(body.customerId || '').trim();
    const idempotencyKey = String(req.headers['x-idempotency-key'] || body.idempotencyKey || '').trim();
    let targetState = String(body.toState || ACTION_TO_STATE[action] || '').trim().toUpperCase();

    if (!ACTION_TO_STATE[action]) return json(res, 400, { error: 'unsupported_action' });
    if (!serviceId) return json(res, 400, { error: 'service_id_required' });
    if (!idempotencyKey) return json(res, 400, { error: 'idempotency_key_required' });
    if (!VALID_STATES.has(targetState)) return json(res, 400, { error: 'invalid_target_state' });

    let provider = body.provider || null;
    let provisioningJob = null;

    if (action === 'provision' || action === 'retry') {
      if (!customerId) return json(res, 400, { error: 'customer_id_required' });
      const { createProvisioningPlan, executeProvisioning } = await import('../network/provisioning-orchestrator.mjs');
      const { carrierBridgeConfigured, provisionThroughCarrierBridge } = await import('../network/carrier-bridge-adapter.mjs');

      provisioningJob = createProvisioningPlan({
        customerId,
        serviceId,
        product: body.product || 'I-CONNECT',
        requirements: body.requirements || {},
        telemetry: body.telemetry || {},
        maxAttempts: body.maxAttempts || 2
      });
      provider = provisioningJob.primaryProviderId;

      if (carrierBridgeConfigured()) {
        provisioningJob = await executeProvisioning({
          plan: provisioningJob,
          telemetry: body.telemetry || {},
          adapter: (context) => provisionThroughCarrierBridge({ ...context, idempotencyKey })
        });
        provider = provisioningJob.activeProviderId || provider;
        if (provisioningJob.state === 'ACTIVE') targetState = 'ACTIVE';
        if (provisioningJob.state === 'FAILED') targetState = 'FAILED';
      }
    }

    return await rpc(req, res, 'ic_transition_connectivity_service', {
      p_service_id: serviceId,
      p_to_state: targetState,
      p_reason: body.reason || `customer_action:${action}`,
      p_provider: provider,
      p_external_reference: provisioningJob?.providerAttempts?.find((a) => a.ok)?.externalReference || body.externalReference || null,
      p_metadata: {
        ...(body.metadata || {}),
        idempotencyKey,
        source: 'i-connect-customer-control',
        provisioningJob
      }
    });
  } catch (e) {
    return json(res, 400, { error: e?.message || 'invalid_request' });
  }
};

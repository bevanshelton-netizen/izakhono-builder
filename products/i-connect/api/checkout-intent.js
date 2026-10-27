const { json, rpc } = require('./_lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const productCode = String(body.productCode || '').trim();
    if (!productCode) return json(res, 400, { error: 'product_code_required' });

    return await rpc(req, res, 'ic_prepare_checkout_intent', {
      p_product_code: productCode,
      p_customer_name: body.customerName ? String(body.customerName).trim() : null,
      p_customer_email: body.customerEmail ? String(body.customerEmail).trim().toLowerCase() : null,
      p_requested_slug: body.requestedSlug ? String(body.requestedSlug).trim().toLowerCase() : null,
      p_metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {}
    });
  } catch (e) {
    return json(res, 400, { error: 'invalid_request' });
  }
};

(() => {
  const nav = document.getElementById('nav');
  const system = document.getElementById('system-health');
  if (!nav || !system) return;

  const button = document.createElement('button');
  button.className = 'nav';
  button.dataset.view = 'checkout';
  button.innerHTML = '▤ <span>Start Checkout</span>';
  nav.appendChild(button);

  const token = () => window.I_CONNECT_ACCESS_TOKEN || sessionStorage.getItem('I_CONNECT_ACCESS_TOKEN') || localStorage.getItem('I_CONNECT_ACCESS_TOKEN') || '';
  const accessToken = async () => window.I_CONNECT_AUTH?.getAccessToken ? await window.I_CONNECT_AUTH.getAccessToken() : token();
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function render() {
    const existing = document.getElementById('i-connect-checkout');
    if (existing) return existing.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const wrap = document.createElement('section');
    wrap.id = 'i-connect-checkout';
    wrap.style.cssText = 'margin:0 22px 18px;padding:18px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.035)';
    wrap.innerHTML = `<div class="card-head"><div><h2>Customer Checkout</h2><span>Secure checkout → payment → provisioning</span></div></div>
      <div class="grid two" style="margin-top:14px">
        <div><label>Product code</label><input id="ic-product" value="" placeholder="Enter an active catalog product code" style="width:100%;margin-top:7px;padding:11px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.15);color:inherit"></div>
        <div><label>Customer email</label><input id="ic-email" type="email" placeholder="customer@example.com" style="width:100%;margin-top:7px;padding:11px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.15);color:inherit"></div>
      </div>
      <div class="grid two" style="margin-top:12px">
        <div><label>Customer name</label><input id="ic-name" placeholder="Customer / company name" style="width:100%;margin-top:7px;padding:11px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.15);color:inherit"></div>
        <div><label>Requested slug</label><input id="ic-slug" placeholder="customer-name" style="width:100%;margin-top:7px;padding:11px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.15);color:inherit"></div>
      </div>
      <div class="control-actions"><button class="primary" id="ic-checkout-start">Create checkout</button><span id="ic-checkout-result" class="muted" aria-live="polite"></span></div>
      <div id="ic-checkout-tracking" style="margin-top:12px" aria-live="polite"></div>`;
    system.after(wrap);

    const result = document.getElementById('ic-checkout-result');
    const tracking = document.getElementById('ic-checkout-tracking');
    let activeIntentId = null;

    async function refreshState() {
      if (!activeIntentId) return;
      const t = await accessToken();
      if (!t) {
        tracking.textContent = 'Sign in again to securely view this checkout status.';
        return;
      }
      tracking.textContent = 'Refreshing checkout status…';
      try {
        const r = await fetch('/api/checkout-state', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t },
          body: JSON.stringify({ checkoutIntentId: activeIntentId })
        });
        const payload = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(payload.error || 'checkout_state_unavailable');
        const state = payload.data || payload;
        const line = document.createElement('div');
        line.style.cssText = 'padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:10px';
        const heading = document.createElement('strong');
        heading.textContent = 'Checkout status: ' + String(state.state || 'unknown').replaceAll('_',' ');
        const message = document.createElement('p');
        message.className = 'muted';
        message.style.margin = '6px 0 0';
        message.textContent = state.message || 'Status received.';
        const refresh = document.createElement('button');
        refresh.className = 'nav';
        refresh.style.marginTop = '10px';
        refresh.textContent = 'Refresh status';
        refresh.onclick = refreshState;
        line.append(heading, message, refresh);
        tracking.replaceChildren(line);
      } catch (e) {
        tracking.textContent = 'Status unavailable: ' + e.message;
      }
    }

    document.getElementById('ic-checkout-start').onclick = async () => {
      const productCode = document.getElementById('ic-product').value.trim();
      const customerName = document.getElementById('ic-name').value.trim();
      const customerEmail = document.getElementById('ic-email').value.trim();
      if (!productCode) return result.textContent = 'Product code is required.';
      if (!customerName || !customerEmail) return result.textContent = 'Customer name and email are required.';
      const t = await accessToken();
      if (!t) return result.textContent = 'Sign in is required before creating a checkout.';
      result.textContent = 'Creating checkout intent…';
      tracking.textContent = '';
      try {
        const r = await fetch('/api/checkout-intent', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t },
          body: JSON.stringify({
            productCode,
            customerName,
            customerEmail,
            requestedSlug: document.getElementById('ic-slug').value.trim()
          })
        });
        const payload = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(payload.error || 'checkout_intent_failed');
        const intent = payload.data || payload;
        activeIntentId = intent.intent_id || intent.checkout_intent_id || null;
        result.textContent = activeIntentId
          ? 'Checkout intent created · ' + (intent.amount ?? '') + ' ' + (intent.currency ?? '')
          : 'Checkout intent created, but no intent identifier was returned.';
        if (activeIntentId) await refreshState();
      } catch (e) {
        result.textContent = 'Checkout unavailable: ' + e.message;
      }
    };
  }

  button.addEventListener('click', render);
})();

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
  const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

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
      <div class="control-actions"><button class="primary" id="ic-checkout-start">Create checkout</button><span id="ic-checkout-result" class="muted"></span></div>`;
    system.after(wrap);
    document.getElementById('ic-checkout-start').onclick = async () => {
      const result = document.getElementById('ic-checkout-result');
      const productCode = document.getElementById('ic-product').value.trim();
      if (!productCode) return result.textContent = 'Product code is required.';
      result.textContent = 'Creating checkout intent…';
      try {
        const headers = { 'content-type':'application/json' };
        const t = token(); if (t) headers.authorization = 'Bearer ' + t;
        const r = await fetch('/api/checkout-intent', { method:'POST', headers, body:JSON.stringify({
          productCode,
          customerName: document.getElementById('ic-name').value.trim(),
          customerEmail: document.getElementById('ic-email').value.trim(),
          requestedSlug: document.getElementById('ic-slug').value.trim()
        }) });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'checkout_intent_failed');
        result.textContent = 'Checkout intent created: ' + esc(JSON.stringify(data.data || data));
      } catch (e) {
        result.textContent = 'Checkout unavailable: ' + esc(e.message);
      }
    };
  }

  button.addEventListener('click', render);
})();

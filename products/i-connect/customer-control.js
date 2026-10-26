(() => {
  const nav = document.getElementById('nav');
  const app = document.getElementById('app');
  const title = document.getElementById('page-title');
  if (!nav || !app) return;

  const button = document.createElement('button');
  button.className = 'nav';
  button.dataset.view = 'customer-control';
  button.innerHTML = '◎ <span>My I-CONNECT</span>';
  nav.insertBefore(button, nav.querySelector('[data-view="connectivity"]') || null);

  const token = () => window.I_CONNECT_ACCESS_TOKEN || sessionStorage.getItem('i_connect_access_token') || localStorage.getItem('i_connect_access_token') || '';
  const organizationId = () => window.I_CONNECT_ORGANIZATION_ID || sessionStorage.getItem('i_connect_organization_id') || localStorage.getItem('i_connect_organization_id') || '';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = () => (crypto.randomUUID ? crypto.randomUUID() : `ic-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const stateClass = state => ['ACTIVE','READY'].includes(String(state).toUpperCase()) ? 'ok' : ['FAILED','TERMINATED'].includes(String(state).toUpperCase()) ? 'danger' : 'warn';

  async function api(path, options = {}) {
    const t = token();
    if (!t) throw new Error('Sign in to I-CONNECT to manage services.');
    const headers = { 'content-type': 'application/json', authorization: `Bearer ${t}`, ...(options.headers || {}) };
    const response = await fetch(path, { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.details?.message || body?.error || `Request failed (${response.status})`);
    return body.data;
  }

  function servicesFrom(data) {
    if (Array.isArray(data?.services)) return data.services;
    if (Array.isArray(data?.connectivity_services)) return data.connectivity_services;
    if (Array.isArray(data?.service)) return data.service;
    return [];
  }

  function serviceCard(service) {
    const id = service.id || service.service_id;
    const state = String(service.lifecycle_state || service.state || service.status || 'UNKNOWN').toUpperCase();
    const name = service.name || service.service_name || service.product_name || 'I-CONNECT service';
    const provider = service.provider || 'Carrier-neutral';
    if (!id) return '';
    const actions = [];
    if (state === 'READY') actions.push(['provision','Provision']);
    if (state === 'PROVISIONING') actions.push(['retry','Retry']);
    if (state === 'ACTIVE') actions.push(['suspend','Suspend']);
    if (state === 'SUSPENDED') actions.push(['resume','Resume']);
    if (!['TERMINATED'].includes(state)) actions.push(['terminate','Terminate']);
    return `<div class="card" data-service-id="${esc(id)}"><div class="card-head"><div><h2>${esc(name)}</h2><span>${esc(provider)}</span></div><span class="status ${stateClass(state)}">${esc(state)}</span></div><div class="metric-row"><span>Service ID</span><span class="muted">${esc(id)}</span></div><div class="control-actions">${actions.map(([action,label]) => `<button class="primary ic-action" data-action="${action}" data-service-id="${esc(id)}">${label}</button>`).join('')}</div></div>`;
  }

  async function render() {
    title.textContent = 'My I-CONNECT';
    app.innerHTML = `<div class="card"><div class="card-head"><div><h2>Customer Control Centre</h2><span>Authenticated service management</span></div><button class="primary" id="ic-refresh">Refresh</button></div><div id="ic-state" class="muted">Loading account...</div></div><div id="ic-services" class="grid two" style="margin-top:14px"></div>`;
    const state = document.getElementById('ic-state');
    const list = document.getElementById('ic-services');
    document.getElementById('ic-refresh').onclick = render;
    if (!token() || !organizationId()) {
      state.innerHTML = 'Authentication is required. The production UI must receive a Supabase access token and organization ID; no demo customer data is shown.';
      return;
    }
    try {
      const data = await api('/api/customer-control', { method: 'POST', body: JSON.stringify({ organizationId: organizationId() }) });
      const services = servicesFrom(data);
      state.innerHTML = `<span class="status ok">CONNECTED</span> &nbsp; Customer account loaded securely.`;
      list.innerHTML = services.length ? services.map(serviceCard).join('') : '<div class="card"><h2>No connectivity services</h2><p class="muted">No service records were returned for this organization.</p></div>';
      list.querySelectorAll('.ic-action').forEach(btn => btn.addEventListener('click', () => transition(btn)));
    } catch (error) {
      state.innerHTML = `<span class="status danger">ERROR</span> &nbsp; ${esc(error.message)}`;
    }
  }

  async function transition(buttonEl) {
    const serviceId = buttonEl.dataset.serviceId;
    const action = buttonEl.dataset.action;
    buttonEl.disabled = true;
    buttonEl.textContent = 'Working…';
    try {
      await api('/api/provisioning', { method: 'POST', headers: { 'x-idempotency-key': key() }, body: JSON.stringify({ serviceId, action, metadata: { ui: 'customer-control-centre' } }) });
      if (typeof window.notify === 'function') window.notify(`Service ${action} request accepted`);
      await render();
    } catch (error) {
      buttonEl.disabled = false;
      buttonEl.textContent = action.charAt(0).toUpperCase() + action.slice(1);
      if (typeof window.notify === 'function') window.notify(error.message);
    }
  }

  button.addEventListener('click', event => {
    event.preventDefault();
    nav.querySelectorAll('.nav').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    render();
  });
})();

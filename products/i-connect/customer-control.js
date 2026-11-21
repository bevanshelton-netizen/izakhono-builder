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
  const accessToken = async () => window.I_CONNECT_AUTH?.getAccessToken ? await window.I_CONNECT_AUTH.getAccessToken() : token();
  const organizationId = () => window.I_CONNECT_ORGANIZATION_ID || sessionStorage.getItem('i_connect_organization_id') || localStorage.getItem('i_connect_organization_id') || '';
  const setOrganizationId = id => {
    window.I_CONNECT_ORGANIZATION_ID = id;
    sessionStorage.setItem('i_connect_organization_id', id);
    localStorage.removeItem('i_connect_organization_id');
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = () => (crypto.randomUUID ? crypto.randomUUID() : `ic-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const stateClass = state => ['ACTIVE','READY'].includes(String(state).toUpperCase()) ? 'ok' : ['FAILED','TERMINATED'].includes(String(state).toUpperCase()) ? 'danger' : 'warn';

  async function api(path, options = {}) {
    const t = await accessToken();
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

  function renderOrganizationChoice(organizations, state) {
    state.innerHTML = `
      <div class="card" style="margin-top:12px">
        <h2>Select your organisation</h2>
        <p class="muted">Choose the organisation whose I-CONNECT services you want to manage.</p>
        <select id="ic-org-select" style="width:100%;padding:11px;border-radius:9px;background:#0b1020;color:inherit;border:1px solid rgba(255,255,255,.12)">
          ${organizations.map(org => `<option value="${esc(org.organizationId)}">${esc(org.name)} · ${esc(org.role)}</option>`).join('')}
        </select>
        <div class="control-actions"><button class="primary" id="ic-org-select-button">Continue</button></div>
      </div>`;
    document.getElementById('ic-org-select-button').onclick = async () => {
      const id = document.getElementById('ic-org-select').value;
      if (!id) return;
      setOrganizationId(id);
      await render();
    };
  }

  function renderOrganizationSetup(state) {
    state.innerHTML = `
      <div class="card" style="margin-top:12px">
        <h2>Create your organisation</h2>
        <p class="muted">Your I-CONNECT services and billing are managed under an organisation account.</p>
        <label for="ic-org-name">Organisation name</label>
        <input id="ic-org-name" required maxlength="160" placeholder="Company or organisation name" style="display:block;width:100%;box-sizing:border-box;margin:7px 0 12px;padding:11px;border-radius:9px;background:#0b1020;color:inherit;border:1px solid rgba(255,255,255,.12)">
        <label for="ic-org-slug">Account identifier</label>
        <input id="ic-org-slug" required maxlength="64" pattern="[a-z0-9][a-z0-9-]{1,62}[a-z0-9]" placeholder="company-name" style="display:block;width:100%;box-sizing:border-box;margin:7px 0 12px;padding:11px;border-radius:9px;background:#0b1020;color:inherit;border:1px solid rgba(255,255,255,.12)">
        <label for="ic-org-display">Your display name (optional)</label>
        <input id="ic-org-display" maxlength="160" placeholder="Your name" style="display:block;width:100%;box-sizing:border-box;margin:7px 0 12px;padding:11px;border-radius:9px;background:#0b1020;color:inherit;border:1px solid rgba(255,255,255,.12)">
        <label for="ic-org-phone">Phone (optional)</label>
        <input id="ic-org-phone" type="tel" maxlength="40" placeholder="+27…" style="display:block;width:100%;box-sizing:border-box;margin:7px 0 12px;padding:11px;border-radius:9px;background:#0b1020;color:inherit;border:1px solid rgba(255,255,255,.12)">
        <div class="control-actions"><button class="primary" id="ic-org-create">Create organisation</button><span id="ic-org-message" class="muted" aria-live="polite"></span></div>
      </div>`;
    document.getElementById('ic-org-create').onclick = async () => {
      const name = document.getElementById('ic-org-name').value.trim();
      const slug = document.getElementById('ic-org-slug').value.trim().toLowerCase();
      const displayName = document.getElementById('ic-org-display').value.trim();
      const phone = document.getElementById('ic-org-phone').value.trim();
      const message = document.getElementById('ic-org-message');
      if (name.length < 2 || !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) {
        message.textContent = 'Enter a valid organisation name and 3–64 character identifier.';
        return;
      }
      const create = document.getElementById('ic-org-create');
      create.disabled = true;
      message.textContent = 'Creating organisation…';
      try {
        const result = await api('/api/onboarding', {
          method: 'POST',
          body: JSON.stringify({ name, slug, displayName, phone })
        });
        const id = typeof result === 'string' ? result : (result?.organization_id || result?.id);
        if (!id) throw new Error('The organisation was created but no identifier was returned.');
        setOrganizationId(id);
        await render();
      } catch (error) {
        message.textContent = error.message;
        create.disabled = false;
      }
    };
  }

  async function render() {
    title.textContent = 'My I-CONNECT';
    app.innerHTML = `<div class="card"><div class="card-head"><div><h2>Customer Control Centre</h2><span>Authenticated service management</span></div><button class="primary" id="ic-refresh">Refresh</button></div><div id="ic-state" class="muted">Loading account…</div></div><div id="ic-services" class="grid two" style="margin-top:14px"></div>`;
    const state = document.getElementById('ic-state');
    const list = document.getElementById('ic-services');
    document.getElementById('ic-refresh').onclick = render;

    const access = await accessToken();
    if (!access) {
      state.textContent = 'Sign in to I-CONNECT to view or create your organisation account.';
      return;
    }

    let orgId = organizationId();
    if (!orgId) {
      try {
        const directory = await api('/api/my-organizations', { method: 'POST', body: '{}' });
        const organizations = Array.isArray(directory?.organizations) ? directory.organizations : [];
        if (organizations.length === 1) {
          setOrganizationId(organizations[0].organizationId);
          orgId = organizations[0].organizationId;
        } else if (organizations.length > 1) {
          renderOrganizationChoice(organizations, state);
          return;
        } else {
          renderOrganizationSetup(state);
          return;
        }
      } catch (error) {
        state.textContent = 'Could not load your organisation memberships: ' + error.message;
        return;
      }
    }

    try {
      const data = await api('/api/customer-control', { method: 'POST', body: JSON.stringify({ organizationId: orgId }) });
      const services = servicesFrom(data);
      state.innerHTML = `<span class="status ok">CONNECTED</span> &nbsp; Organisation account loaded securely.`;
      list.innerHTML = services.length ? services.map(serviceCard).join('') : '<div class="card"><h2>No connectivity services</h2><p class="muted">No service records were returned for this organisation.</p></div>';
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
  window.addEventListener('i-connect-auth-changed', render);
})();

(() => {
  const getAccessToken = () => {
    const session = window.I_CONNECT_SESSION || window.iConnectSession || {};
    if (session.access_token) return session.access_token;
    if (session.accessToken) return session.accessToken;
    try { return sessionStorage.getItem('i_connect_access_token') || ''; } catch { return ''; }
  };
  async function request(path, options = {}, retry = true) {
    const token = getAccessToken();
    if (!token) throw new Error('Sign in to I-CONNECT to sync this workflow to the IZAKHONO cloud.');
    const response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        ...(options.headers || {})
      }
    });
    if (response.status === 401 && retry && window.I_CONNECT_AUTH?.refresh) {
      const refreshed = await window.I_CONNECT_AUTH.refresh();
      if (refreshed) return request(path, options, false);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The IZAKHONO workflow service could not complete the request.');
    return payload;
  }
  const selectedOrganization = () => { try { return sessionStorage.getItem('i_connect_selected_org') || ''; } catch { return ''; } };
  const withOrganization = path => selectedOrganization() ? path + (path.includes('?') ? '&' : '?') + 'organizationId=' + encodeURIComponent(selectedOrganization()) : path;
  window.IConnectAutomationApi = {
    organizations: () => request('/api/automation/organizations'),
    list: () => request(withOrganization('/api/automation/workflows')),
    runs: () => request(withOrganization('/api/automation/runs')),
    testRun: (workflowId, organizationId, idempotencyKey, input = {}) => request('/api/automation/workflows/' + encodeURIComponent(workflowId) + '/test-run', {
      method: 'POST',
      body: JSON.stringify({ organizationId, idempotencyKey, input })
    }),
    save: workflow => request('/api/automation/workflows', {
      method: 'POST',
      body: JSON.stringify({ ...workflow, organizationId: workflow.organizationId || selectedOrganization() })
    })
  };
})();
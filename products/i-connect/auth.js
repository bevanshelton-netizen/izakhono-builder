(() => {
  const SESSION_KEY = 'i_connect_session';
  let config = null;
  let refreshTimer = null;
  let resolveReady;
  window.I_CONNECT_AUTH_READY = new Promise(resolve => { resolveReady = resolve; });

  const readStored = () => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  };
  const setSession = session => {
    const safe = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: session.token_type || 'bearer',
      expires_at: Date.now() + (Number(session.expires_in || 3600) * 1000),
      user: session.user || null
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(safe));
    window.I_CONNECT_SESSION = { access_token: safe.access_token, user: safe.user };
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refreshSession(), Math.max(60000, Number(session.expires_in || 3600) * 1000 - 120000));
    renderStatus();
  };
  const clearSession = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;
    sessionStorage.removeItem(SESSION_KEY);
    delete window.I_CONNECT_SESSION;
    renderStatus();
  };
  let overlay, status, message, emailInput, passwordInput, submitButton;
  function ensureUi() {
    if (overlay) return;
    const style = document.createElement('style');
    style.textContent = `
      #ic-auth-overlay{position:fixed;inset:0;z-index:99999;background:rgba(4,9,20,.88);backdrop-filter:blur(12px);display:grid;place-items:center;padding:20px}
      #ic-auth-card{width:min(420px,100%);background:#111c30;color:#f5f7fc;border:1px solid #34425e;border-radius:18px;padding:26px;box-shadow:0 24px 90px #0009;font:14px system-ui,sans-serif}
      #ic-auth-card h2{margin:0 0 8px;font-size:22px}#ic-auth-card p{color:#aab6ca;line-height:1.55;font-size:12px}
      #ic-auth-card label{display:block;color:#aab6ca;font-size:11px;margin:14px 0 6px}
      #ic-auth-card input{width:100%;padding:12px;border-radius:9px;border:1px solid #3b4b68;background:#08111f;color:#fff;box-sizing:border-box}
      #ic-auth-card button{width:100%;padding:12px;border:0;border-radius:9px;background:linear-gradient(120deg,#9b72ff,#58d6d0);color:#08101c;font-weight:800;margin-top:16px}
      #ic-auth-message{min-height:18px;color:#f5c56b;font-size:12px;margin-top:10px}
      #ic-auth-status{position:fixed;right:16px;bottom:16px;z-index:1000;border:1px solid #40506e;background:#111c30;color:#dce6f5;border-radius:99px;padding:8px 12px;font:11px system-ui,sans-serif;display:none}
      #ic-auth-status button{margin-left:10px;background:transparent;color:#58d6d0;border:0;font:inherit;font-weight:700}
    `;
    document.head.appendChild(style);
    overlay = document.createElement('div');
    overlay.id = 'ic-auth-overlay';
    overlay.innerHTML = '<form id="ic-auth-card"><div style="font-size:10px;letter-spacing:.18em;color:#58d6d0;font-weight:800;margin-bottom:14px">IZAKHONO · FORTRESS IDENTITY</div><h2>Sign in to I-CONNECT</h2><p>Use your organisation account to access protected workflows, customers and automation operations.</p><label for="ic-auth-email">Business email</label><input id="ic-auth-email" type="email" autocomplete="username" required><label for="ic-auth-password">Password</label><input id="ic-auth-password" type="password" autocomplete="current-password" required><button id="ic-auth-submit" type="submit">Sign in securely</button><div id="ic-auth-message" role="status"></div><p style="font-size:10px;margin-bottom:0">Access is controlled by your IZAKHONO organisation membership and assigned role.</p></form>';
    document.body.appendChild(overlay);
    status = document.createElement('div');
    status.id = 'ic-auth-status';
    status.innerHTML = '<span id="ic-auth-user"></span><button type="button" id="ic-auth-signout">Sign out</button>';
    document.body.appendChild(status);
    message = overlay.querySelector('#ic-auth-message');
    emailInput = overlay.querySelector('#ic-auth-email');
    passwordInput = overlay.querySelector('#ic-auth-password');
    submitButton = overlay.querySelector('#ic-auth-submit');
    overlay.querySelector('form').addEventListener('submit', signIn);
    status.querySelector('#ic-auth-signout').addEventListener('click', signOut);
  }
  function renderStatus() {
    if (!status) return;
    const session = readStored();
    const signedIn = Boolean(session?.access_token);
    status.style.display = signedIn ? 'block' : 'none';
    status.querySelector('#ic-auth-user').textContent = signedIn
      ? (session.user?.email || 'I-CONNECT user')
      : '';
    if (overlay) overlay.style.display = signedIn ? 'none' : 'grid';
  }
  async function authFetch(path, body, token) {
    return fetch(config.supabaseUrl.replace(/\/$/, '') + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.anonKey, ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body)
    });
  }
  async function signIn(event) {
    event.preventDefault();
    if (!config) return;
    submitButton.disabled = true;
    submitButton.textContent = 'Authenticating…';
    message.textContent = '';
    try {
      const response = await authFetch('/auth/v1/token?grant_type=password', {
        email: emailInput.value.trim(),
        password: passwordInput.value
      });
      const result = await response.json();
      if (!response.ok || !result.access_token) throw new Error(result.msg || result.message || 'Sign-in failed. Check your details and account status.');
      setSession(result);
      passwordInput.value = '';
      overlay.style.display = 'none';
      window.dispatchEvent(new CustomEvent('i-connect-auth-ready'));
    } catch (error) {
      message.textContent = error.message || 'Unable to sign in.';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Sign in securely';
    }
  }
  async function refreshSession() {
    const current = readStored();
    if (!config || !current?.refresh_token) { clearSession(); return false; }
    try {
      const response = await authFetch('/auth/v1/token?grant_type=refresh_token', { refresh_token: current.refresh_token });
      const result = await response.json();
      if (!response.ok || !result.access_token) throw new Error('Refresh failed');
      setSession(result);
      return true;
    } catch {
      clearSession();
      return false;
    }
  }
  async function signOut() {
    const current = readStored();
    try {
      if (config && current?.access_token) {
        await fetch(config.supabaseUrl.replace(/\/$/, '') + '/auth/v1/logout', {
          method: 'POST',
          headers: { apikey: config.anonKey, Authorization: 'Bearer ' + current.access_token }
        });
      }
    } catch { /* Clear the local session even if remote revocation is unavailable. */ }
    clearSession();
    if (overlay) overlay.style.display = 'grid';
    window.dispatchEvent(new CustomEvent('i-connect-auth-ready'));
  }
  async function init() {
    ensureUi();
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Authentication configuration unavailable.');
      config = result;
      window.I_CONNECT_AUTH = { refresh: refreshSession, signOut, getSession: readStored };
      const current = readStored();
      if (current?.access_token) {
        const userResponse = await fetch(config.supabaseUrl.replace(/\/$/, '') + '/auth/v1/user', {
          headers: { apikey: config.anonKey, Authorization: 'Bearer ' + current.access_token }
        });
        if (userResponse.ok) {
          const user = await userResponse.json();
          setSession({ ...current, user, expires_in: Math.max(60, Math.floor((current.expires_at - Date.now()) / 1000)) });
        } else {
          await refreshSession();
        }
      }
      renderStatus();
    } catch (error) {
      message.textContent = error.message || 'I-CONNECT authentication is not configured.';
      overlay.style.display = 'grid';
      submitButton.disabled = true;
    } finally {
      resolveReady();
    }
  }
  init();
})();

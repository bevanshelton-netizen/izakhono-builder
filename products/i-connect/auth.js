(() => {
  const topActions = document.querySelector('.top-actions');
  if (!topActions) return;

  const SESSION_KEY = 'i_connect_auth_session';
  let configPromise;
  let session = null;

  try {
    session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    session = null;
  }

  function store(next) {
    session = next;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    sessionStorage.setItem('I_CONNECT_ACCESS_TOKEN', next.access_token);
    sessionStorage.setItem('i_connect_access_token', next.access_token);
    window.I_CONNECT_ACCESS_TOKEN = next.access_token;
  }

  function clear() {
    session = null;
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('I_CONNECT_ACCESS_TOKEN');
    sessionStorage.removeItem('i_connect_access_token');
    window.I_CONNECT_ACCESS_TOKEN = '';
  }

  async function config() {
    if (!configPromise) {
      configPromise = fetch('/api/public-config', { cache: 'no-store' })
        .then(async response => {
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error || 'authentication_not_configured');
          return body;
        });
    }
    return configPromise;
  }

  async function authRequest(path, body, accessToken) {
    const cfg = await config();
    const headers = { 'content-type': 'application/json', apikey: cfg.supabaseAnonKey };
    if (accessToken) headers.authorization = 'Bearer ' + accessToken;
    const response = await fetch(cfg.supabaseUrl + '/auth/v1/' + path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.msg || data.message || data.error_description || data.error || 'authentication_failed');
    return data;
  }

  async function getAccessToken() {
    if (!session?.access_token) return '';
    const expiry = Number(session.expires_at || 0) * 1000;
    if (!expiry || expiry > Date.now() + 60000) return session.access_token;
    if (!session.refresh_token) {
      clear();
      return '';
    }
    try {
      const next = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
      store({ ...next, expires_at: Math.floor(Date.now() / 1000) + Number(next.expires_in || 3600) });
      return session.access_token;
    } catch {
      clear();
      return '';
    }
  }

  const button = document.createElement('button');
  button.className = 'nav';
  button.type = 'button';
  button.textContent = session?.access_token ? 'Account' : 'Sign in';
  topActions.insertBefore(button, topActions.firstChild);

  const dialog = document.createElement('dialog');
  dialog.style.cssText = 'max-width:420px;width:calc(100% - 32px);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:22px;background:#111a2e;color:#eef2ff;box-shadow:0 24px 80px rgba(0,0,0,.5)';
  dialog.innerHTML = `
    <form id="ic-auth-form" method="dialog">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div><h2 style="margin:0">I-CONNECT Account</h2><p style="opacity:.7;font-size:12px">Supabase Auth · Secure customer access</p></div>
        <button type="button" id="ic-auth-close" aria-label="Close" class="nav">✕</button>
      </div>
      <label for="ic-auth-email">Email</label>
      <input id="ic-auth-email" type="email" autocomplete="username" required style="display:block;width:100%;box-sizing:border-box;margin:7px 0 14px;padding:11px;border-radius:9px;background:#0b1020;color:inherit;border:1px solid #334155">
      <label for="ic-auth-password">Password</label>
      <input id="ic-auth-password" type="password" autocomplete="current-password" required minlength="8" style="display:block;width:100%;box-sizing:border-box;margin:7px 0 14px;padding:11px;border-radius:9px;background:#0b1020;color:inherit;border:1px solid #334155">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="submit" id="ic-auth-signin" class="primary">Sign in</button>
        <button type="button" id="ic-auth-signup" class="nav">Create account</button>
        <button type="button" id="ic-auth-signout" class="nav" style="display:none">Sign out</button>
      </div>
      <p id="ic-auth-message" role="status" aria-live="polite" style="font-size:12px;opacity:.8;margin:14px 0 0"></p>
    </form>`;
  document.body.appendChild(dialog);

  const form = dialog.querySelector('#ic-auth-form');
  const message = dialog.querySelector('#ic-auth-message');
  const signInButton = dialog.querySelector('#ic-auth-signin');
  const signUpButton = dialog.querySelector('#ic-auth-signup');
  const signOutButton = dialog.querySelector('#ic-auth-signout');
  const emailInput = dialog.querySelector('#ic-auth-email');
  const passwordInput = dialog.querySelector('#ic-auth-password');

  function updateUI() {
    const signedIn = Boolean(session?.access_token);
    button.textContent = signedIn ? 'Account · Signed in' : 'Sign in';
    signInButton.style.display = signedIn ? 'none' : '';
    signUpButton.style.display = signedIn ? 'none' : '';
    signOutButton.style.display = signedIn ? '' : 'none';
    if (signedIn) message.textContent = 'Authenticated session stored for this browser tab.';
  }

  button.addEventListener('click', () => {
    updateUI();
    dialog.showModal();
  });
  dialog.querySelector('#ic-auth-close').addEventListener('click', () => dialog.close());

  form.addEventListener('submit', async event => {
    event.preventDefault();
    message.textContent = 'Signing in…';
    signInButton.disabled = true;
    try {
      const data = await authRequest('token?grant_type=password', {
        email: emailInput.value.trim().toLowerCase(),
        password: passwordInput.value
      });
      if (!data.access_token) throw new Error('Email confirmation is required. Confirm your address, then sign in.');
      store({ ...data, expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600) });
      passwordInput.value = '';
      message.textContent = 'Signed in successfully.';
      updateUI();
      window.dispatchEvent(new CustomEvent('i-connect-auth-changed'));
    } catch (error) {
      message.textContent = error.message;
    } finally {
      signInButton.disabled = false;
    }
  });

  signUpButton.addEventListener('click', async () => {
    message.textContent = 'Creating account…';
    signUpButton.disabled = true;
    try {
      const data = await authRequest('signup', {
        email: emailInput.value.trim().toLowerCase(),
        password: passwordInput.value
      });
      if (data.access_token) {
        store({ ...data, expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600) });
        message.textContent = 'Account created and signed in.';
        updateUI();
        window.dispatchEvent(new CustomEvent('i-connect-auth-changed'));
      } else {
        message.textContent = 'Account request accepted. Check your email for confirmation, then sign in.';
      }
    } catch (error) {
      message.textContent = error.message;
    } finally {
      signUpButton.disabled = false;
    }
  });

  signOutButton.addEventListener('click', async () => {
    message.textContent = 'Signing out…';
    try {
      const accessToken = await getAccessToken();
      if (accessToken) await authRequest('logout', {}, accessToken);
    } catch {
      // Local session is cleared even if the remote logout request cannot complete.
    }
    clear();
    updateUI();
    message.textContent = 'Signed out.';
    window.dispatchEvent(new CustomEvent('i-connect-auth-changed'));
  });

  window.I_CONNECT_AUTH = { getAccessToken, signOut: clear };
  if (session?.access_token) window.I_CONNECT_ACCESS_TOKEN = session.access_token;
  updateUI();
})();

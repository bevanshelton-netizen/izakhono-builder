(() => {
  const $ = (selector) => document.querySelector(selector);
  const notice = $('#notice');
  const authPanel = $('#auth-panel');
  const accountPanel = $('#account-panel');

  function message(text, kind = 'info') {
    notice.textContent = text;
    notice.dataset.kind = kind;
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    return data;
  }

  function showAccount(customer) {
    authPanel.hidden = true;
    accountPanel.hidden = false;
    $('#welcome').textContent = 'Welcome, ' + (customer.displayName || 'reader');
    $('#account-email').textContent = customer.email || '';
    loadRequests();
    loadLibrary();
  }

  function showSignedOut() {
    authPanel.hidden = false;
    accountPanel.hidden = true;
  }

  async function refreshSession() {
    try {
      const data = await api('/api/topic-pdfs/customer/session');
      showAccount(data.customer);
    } catch {
      showSignedOut();
    }
  }

  const statusLabels = {
    requested: 'Request received',
    scoping: 'Defining the guide',
    research_required: 'Researching sources',
    drafting: 'Writing the guide',
    quality_review: 'Editorial quality review',
    specialist_review: 'Specialist review',
    ready_for_editor: 'Ready for editorial approval',
    approved: 'Approved draft — not yet for sale',
    rendering: 'Preparing editorial PDF',
    delivered: 'Delivered',
    blocked: 'Unable to fulfil as requested',
    failed: 'Processing needs attention',
  };

  function renderRequests(items) {
    const root = $('#request-list');
    root.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'You have not submitted a topic request yet.';
      root.append(empty);
      return;
    }
    for (const item of items) {
      const card = document.createElement('article');
      card.className = 'request-item';
      const title = document.createElement('strong');
      title.textContent = item.topic || 'Topic guide request';
      const status = document.createElement('span');
      status.className = 'request-status';
      status.textContent = statusLabels[item.status] || item.status;
      const meta = document.createElement('small');
      meta.textContent = [item.risk_level ? 'Review level: ' + item.risk_level : '', item.created_at ? new Date(item.created_at).toLocaleString() : ''].filter(Boolean).join(' · ');
      card.append(title, status, meta);
      if (item.pdf_ready) {
        const note = document.createElement('p');
        note.className = 'draft-note';
        note.textContent = 'A watermarked editorial draft has been prepared. It is not a saleable publication.';
        card.append(note);
      }
      root.append(card);
    }
  }

  async function loadRequests() {
    const root = $('#request-list');
    root.textContent = 'Loading your requests…';
    try {
      const data = await api('/api/topic-pdfs/requests');
      renderRequests(data.requests || []);
    } catch (error) {
      root.textContent = error.message;
    }
  }

  function renderLibrary(items) {
    const root = $('#library-list');
    root.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Purchased and published guides will appear here after a confirmed payment.';
      root.append(empty);
      return;
    }
    for (const item of items) {
      const card = document.createElement('article');
      card.className = 'library-item';
      const title = document.createElement('strong');
      title.textContent = item.title || 'Topic guide';
      const meta = document.createElement('small');
      meta.textContent = [item.language, item.version ? 'Edition ' + item.version : '', item.purchased_at ? 'Purchased ' + new Date(item.purchased_at).toLocaleDateString() : ''].filter(Boolean).join(' · ');
      const link = document.createElement('a');
      link.className = 'library-download';
      link.href = '/api/topic-pdfs/download/' + encodeURIComponent(item.slug);
      link.textContent = 'Download PDF';
      link.setAttribute('aria-label', 'Download ' + (item.title || 'topic guide') + ' PDF');
      card.append(title, meta, link);
      root.append(card);
    }
  }

  async function loadLibrary() {
    const root = $('#library-list');
    root.textContent = 'Loading your library…';
    try {
      const data = await api('/api/topic-pdfs/library');
      renderLibrary(data.items || []);
    } catch (error) {
      root.textContent = error.message;
    }
  }

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await api('/api/topic-pdfs/customer/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      showAccount(data.customer);
      event.currentTarget.reset();
      message('You are signed in securely.', 'success');
    } catch (error) { message(error.message, 'error'); }
  });

  $('#register-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await api('/api/topic-pdfs/customer/register', {
        method: 'POST',
        body: JSON.stringify({
          displayName: form.get('displayName'),
          email: form.get('email'),
          organization: form.get('organization'),
          password: form.get('password'),
        }),
      });
      event.currentTarget.reset();
      message(data.message || 'Check your email for a verification link.', 'success');
    } catch (error) { message(error.message, 'error'); }
  });

  $('#request-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      topic: form.get('topic'),
      readerOutcome: form.get('readerOutcome'),
      audience: form.get('audience'),
      language: form.get('language'),
      countryOrJurisdiction: form.get('countryOrJurisdiction'),
      depth: form.get('depth'),
      includeWorksheets: form.get('includeWorksheets') === 'on',
      includeExamples: form.get('includeExamples') === 'on',
    };
    try {
      const data = await api('/api/topic-pdfs/requests', {
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify(payload),
      });
      message(data.request?.message || 'Your topic request has been received.', 'success');
      event.currentTarget.reset();
      await loadRequests();
    } catch (error) { message(error.message, 'error'); }
  });

  $('#logout-button').addEventListener('click', async () => {
    try { await api('/api/topic-pdfs/customer/logout', { method: 'POST', body: '{}' }); } catch {}
    showSignedOut();
    message('You have signed out.', 'success');
  });

  $('#refresh-button').addEventListener('click', loadRequests);
  $('#library-refresh-button').addEventListener('click', loadLibrary);

  async function verifyFromLink() {
    const match = location.hash.match(/^#verify=([a-f0-9]{64})$/i);
    if (!match) return false;
    history.replaceState(null, '', location.pathname);
    try {
      const data = await api('/api/topic-pdfs/customer/verify', {
        method: 'POST',
        body: JSON.stringify({ token: match[1] }),
      });
      await refreshSession();
      message('Your email is verified. You are now signed in.', 'success');
    } catch (error) { message(error.message, 'error'); }
    return true;
  }

  verifyFromLink().then(verified => { if (!verified) refreshSession(); });
})();

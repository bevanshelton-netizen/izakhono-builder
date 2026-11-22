(() => {
  const nav = document.getElementById('nav');
  const app = document.getElementById('app');
  const title = document.getElementById('page-title');
  if (!nav || !app || !title) return;

  const button = document.createElement('button');
  button.className = 'nav';
  button.type = 'button';
  button.dataset.view = 'catalogue';
  button.innerHTML = '▤ <span>Service Catalogue</span>';
  nav.insertBefore(button, nav.querySelector('[data-view="connectivity"]') || null);

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };

  function activate() {
    nav.querySelectorAll('.nav').forEach(item => item.classList.toggle('active', item === button));
    title.textContent = 'I-CONNECT Service Catalogue';
    app.replaceChildren(
      element('h2', 'section-title', 'Business connectivity and digital services'),
      element('p', 'muted', 'South Africa · Provider-neutral discovery catalogue')
    );
    const notice = element('div', 'demo-notice',
      'DISCOVERY CATALOGUE — these are product definitions, not live offers. Pricing, coverage, serviceability, provider contracts and fulfilment are not yet verified. No order can be placed from this catalogue.');
    app.appendChild(notice);
    const status = element('p', 'muted', 'Loading catalogue…');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    app.appendChild(status);

    fetch('/api/catalogue', { headers: { accept: 'application/json' }, cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'catalogue_unavailable');
        return body;
      })
      .then(body => {
        if (!Array.isArray(body.products)) throw new Error('catalogue_response_invalid');
        const grid = element('div', 'grid service-grid');
        for (const product of body.products) {
          const card = element('article', 'card service');
          card.append(
            element('div', 'ico', '◇'),
            element('h3', '', product.name || 'I-CONNECT service'),
            element('p', 'muted', (product.deliveryModels || []).join(' · ') || 'Delivery model to be confirmed'),
            element('p', '', 'Pricing model: ' + (product.pricingModel || 'To be confirmed')),
            element('p', '', 'Price: Not published'),
            element('span', 'status warn', 'NOT VERIFIED')
          );
          const disclosure = element('p', 'muted', product.disclosure || 'Availability and commercial terms require verification.');
          disclosure.style.marginTop = '10px';
          card.appendChild(disclosure);
          grid.appendChild(card);
        }
        status.remove();
        app.appendChild(grid);
      })
      .catch(error => {
        status.className = 'status danger';
        status.textContent = 'Catalogue unavailable: ' + error.message;
      });
  }

  button.addEventListener('click', activate);
})();

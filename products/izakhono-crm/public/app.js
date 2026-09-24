const el = (id) => document.getElementById(id);
let registry = { platforms: [] };
let current = null;

function money(value, currency = "ZAR") {
  try { return new Intl.NumberFormat("en-ZA", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0)); }
  catch { return `${currency} ${Number(value || 0).toLocaleString("en-ZA")}`; }
}

function headers() {
  const h = { "content-type": "application/json", "x-entity-id": current.entity_id, "x-platform-id": current.platform_id };
  const token = el("token").value.trim();
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

function setNotice(message = "") {
  el("notice").textContent = message;
  el("notice").style.display = message ? "block" : "none";
}

async function loadRegistry() {
  registry = await fetch("/registry.json").then((r) => r.json());
  const select = el("platform");
  select.innerHTML = registry.platforms.map((p) => `<option value="${p.platform_id}">${p.name}</option>`).join("");
  const wanted = new URLSearchParams(location.search).get("platform");
  if (wanted && registry.platforms.some((p) => p.platform_id === wanted)) select.value = wanted;
  choosePlatform();
}

function choosePlatform() {
  current = registry.platforms.find((p) => p.platform_id === el("platform").value) || registry.platforms[0];
  el("scopeName").textContent = current?.name || "—";
  el("scopePipeline").textContent = current ? current.pipeline : "";
  refreshAll();
}

async function refreshAll() {
  if (!current) return;
  setNotice("");
  try {
    const [summary, contacts, deals, insights] = await Promise.all([
      api("/api/summary"), api("/api/contacts"), api("/api/deals"), api("/api/insights")
    ]);
    el("contactsMetric").textContent = summary.contacts;
    el("dealsMetric").textContent = summary.open_deals;
    el("pipelineMetric").textContent = money(summary.pipeline_value);
    el("wonMetric").textContent = money(summary.won_value);
    renderContacts(contacts.items);
    renderDeals(deals.items);
    renderInsights(insights);
  } catch (error) {
    setNotice(error.message + ". If this installation uses CRM_ADMIN_TOKEN, enter it in the field above.");
  }
}

function renderContacts(items) {
  el("contacts").innerHTML = items.slice(-20).reverse().map((c) => `<tr>
    <td><b>${escapeHtml(c.name || "—")}</b></td>
    <td>${escapeHtml(c.company || "—")}</td>
    <td>${escapeHtml(c.email || c.phone || "—")}</td>
    <td>${escapeHtml(c.source || "—")}</td>
  </tr>`).join("") || `<tr><td colspan="4" class="muted">No contacts yet.</td></tr>`;
}

function renderDeals(items) {
  const stages = current.stages || ["New","Qualified","Proposal","Won","Lost"];
  el("pipeline").innerHTML = stages.map((stage) => {
    const rows = items.filter((d) => d.stage === stage);
    return `<div class="column"><h4>${escapeHtml(stage)} · ${rows.length}</h4>${rows.map((d) => `<div class="deal"><b>${escapeHtml(d.title)}</b><small>${money(d.value, d.currency)}</small><div class="label" style="margin-top:6px">${escapeHtml(d.next_action || d.owner || "No next action")}</div></div>`).join("") || '<div class="muted">Empty</div>'}</div>`;
  }).join("");
}

function renderInsights(data) {
  el("insights").innerHTML = data.recommendations.map((r) => `<div class="insight">${escapeHtml(r)}</div>`).join("");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
}

el("leadForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!current) return;
  const fd = new FormData(event.currentTarget);
  const body = {
    contact: {
      name: fd.get("name"), company: fd.get("company"), email: fd.get("email"), phone: fd.get("phone"), source: "crm-admin"
    },
    create_deal: true,
    deal: {
      title: fd.get("deal_title") || `${fd.get("company") || fd.get("name") || "New"} opportunity`,
      value: Number(fd.get("value") || 0),
      currency: "ZAR",
      stage: (current.stages || ["New"])[0],
      next_action: fd.get("note"),
      source: "crm-admin"
    },
    note: fd.get("note")
  };
  try {
    await api("/api/intake", { method: "POST", body: JSON.stringify(body) });
    event.currentTarget.reset();
    await refreshAll();
  } catch (error) { setNotice(error.message); }
});

el("platform").addEventListener("change", choosePlatform);
el("refresh").addEventListener("click", refreshAll);
el("reloadDeals").addEventListener("click", refreshAll);
el("token").addEventListener("change", refreshAll);
loadRegistry().catch((error) => setNotice(error.message));

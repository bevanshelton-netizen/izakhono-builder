type D1Stmt = {
  bind(...values: unknown[]): D1Stmt;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
};
type Env = { DB: { prepare(sql: string): D1Stmt } };

const KEEP_THRESHOLD_ZAR = 100_000;

const VENTURES = [
  {
    slug: 'quotecraft-ai',
    name: 'QuoteCraft AI',
    category: 'Vertical SaaS',
    audience: 'Trades, contractors and service businesses',
    promise: 'Turn a customer request into a professional quote, scope and follow-up sequence in minutes.',
    monthly_price_zar: 499,
    hero: 'Quote faster. Win more work.',
    accent: '#F4B942',
  },
  {
    slug: 'reviewloop',
    name: 'ReviewLoop',
    category: 'Reputation SaaS',
    audience: 'Local service businesses',
    promise: 'Automatically request reviews after completed jobs and route unhappy customers into private recovery workflows.',
    monthly_price_zar: 399,
    hero: 'More happy customers. More public proof.',
    accent: '#57D3A0',
  },
  {
    slug: 'invoicepilot',
    name: 'InvoicePilot',
    category: 'FinOps SaaS',
    audience: 'Freelancers, agencies and small businesses',
    promise: 'Track unpaid invoices and send polite, escalating payment reminders without awkward manual chasing.',
    monthly_price_zar: 349,
    hero: 'Get paid without chasing people all day.',
    accent: '#79A7FF',
  },
  {
    slug: 'shiftnest',
    name: 'ShiftNest',
    category: 'Workforce SaaS',
    audience: 'Restaurants, retail, security and care teams',
    promise: 'Build rosters, fill open shifts and keep small teams aligned from one lightweight dashboard.',
    monthly_price_zar: 599,
    hero: 'Simple scheduling for teams that move.',
    accent: '#D38BFF',
  },
  {
    slug: 'bidforge',
    name: 'BidForge',
    category: 'AI Workflow SaaS',
    audience: 'SMEs responding to tenders and RFPs',
    promise: 'Organise bid requirements, evidence, deadlines and first-draft responses in one structured workspace.',
    monthly_price_zar: 899,
    hero: 'Turn bid chaos into a repeatable system.',
    accent: '#FF8B73',
  },
  {
    slug: 'stocksignal',
    name: 'StockSignal',
    category: 'Retail Ops SaaS',
    audience: 'Small retailers, wholesalers and online sellers',
    promise: 'Monitor fast-moving stock, flag reorder risk and give owners a simple daily inventory action list.',
    monthly_price_zar: 449,
    hero: 'Know what is running out before customers do.',
    accent: '#60D9E8',
  },
] as const;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function esc(input: unknown) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function ensureSchema(env: Env) {
  await env.DB.prepare(\`
    CREATE TABLE IF NOT EXISTS venture_experiments (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      audience TEXT NOT NULL,
      promise TEXT NOT NULL,
      monthly_price_zar INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'testing',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  \`).run();
  await env.DB.prepare(\`
    CREATE TABLE IF NOT EXISTS venture_leads (
      id TEXT PRIMARY KEY,
      venture_slug TEXT NOT NULL,
      name TEXT,
      email TEXT,
      phone TEXT,
      consent INTEGER NOT NULL DEFAULT 0,
      source TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  \`).run();
  await env.DB.prepare(\`
    CREATE TABLE IF NOT EXISTS venture_events (
      id TEXT PRIMARY KEY,
      venture_slug TEXT NOT NULL,
      event_type TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  \`).run();
  await env.DB.prepare(\`
    CREATE TABLE IF NOT EXISTS venture_revenue (
      id TEXT PRIMARY KEY,
      venture_slug TEXT NOT NULL,
      amount_zar REAL NOT NULL,
      occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      note TEXT
    )
  \`).run();
}

async function seed(env: Env) {
  await ensureSchema(env);
  for (const v of VENTURES) {
    await env.DB.prepare(\`
      INSERT INTO venture_experiments(slug,name,category,audience,promise,monthly_price_zar,status)
      VALUES(?,?,?,?,?,?,'testing')
      ON CONFLICT(slug) DO UPDATE SET
        name=excluded.name,
        category=excluded.category,
        audience=excluded.audience,
        promise=excluded.promise,
        monthly_price_zar=excluded.monthly_price_zar,
        updated_at=CURRENT_TIMESTAMP
    \`).bind(v.slug, v.name, v.category, v.audience, v.promise, v.monthly_price_zar).run();
  }
}

async function portfolio(env: Env) {
  await seed(env);
  const rows = await env.DB.prepare(\`
    SELECT v.*,
      (SELECT COUNT(*) FROM venture_leads l WHERE l.venture_slug=v.slug) AS leads,
      (SELECT COUNT(*) FROM venture_events e WHERE e.venture_slug=v.slug AND e.event_type='view') AS views,
      COALESCE((SELECT SUM(r.amount_zar) FROM venture_revenue r
        WHERE r.venture_slug=v.slug AND r.occurred_at >= datetime('now','-30 days')),0) AS revenue_30d
    FROM venture_experiments v
    ORDER BY revenue_30d DESC, leads DESC, name ASC
  \`).all<any>();
  return (rows.results || []).map((r: any) => ({
    ...r,
    decision: Number(r.revenue_30d || 0) >= KEEP_THRESHOLD_ZAR ? 'KEEP' : 'TEST_OR_SELL',
    keep_threshold_zar: KEEP_THRESHOLD_ZAR,
  }));
}

function shell(title: string, body: string) {
  return \`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>\${esc(title)}</title><style>
*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#071018;color:#f5f7fb}
a{color:inherit}.wrap{max-width:1120px;margin:auto;padding:28px}.nav{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:50px}
.brand{font-weight:900;letter-spacing:.08em}.muted{color:#9ca9ba}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
.card{background:#0d1823;border:1px solid #233343;border-radius:22px;padding:22px;min-height:260px;display:flex;flex-direction:column}
.tag{display:inline-flex;align-self:flex-start;padding:7px 10px;border-radius:999px;background:#162638;color:#c7d7e7;font-size:12px;font-weight:700}
h1{font-size:clamp(38px,7vw,76px);line-height:.95;max-width:900px;margin:0 0 20px}h2{font-size:28px;margin:18px 0 10px}
p{line-height:1.6}.price{font-size:30px;font-weight:900;margin-top:auto}.btn{display:inline-flex;justify-content:center;text-decoration:none;background:white;color:#06101a;padding:13px 16px;border-radius:12px;font-weight:900;border:0;cursor:pointer}
.hero{padding:40px 0 70px}.hero p{font-size:20px;max-width:720px}.form{display:grid;gap:12px;max-width:560px;margin-top:25px}
input{width:100%;padding:14px 15px;border-radius:12px;border:1px solid #304254;background:#0c1722;color:white;font:inherit}.small{font-size:12px;color:#8d9bab}
.notice{margin-top:12px;min-height:24px}.kicker{font-weight:900;letter-spacing:.14em;text-transform:uppercase;font-size:12px;margin-bottom:18px}
.metric{font-size:13px;color:#a9b8c8;margin-top:6px}
</style></head><body><div class="wrap">\${body}</div></body></html>\`;
}

async function publicIndex(env: Env) {
  const items = await portfolio(env);
  const cards = items.map((v: any) => \`
    <article class="card">
      <span class="tag">\${esc(v.category)}</span>
      <h2>\${esc(v.name)}</h2>
      <p class="muted">\${esc(v.promise)}</p>
      <div class="price">R\${Number(v.monthly_price_zar).toLocaleString('en-ZA')}<span class="muted" style="font-size:14px"> / month</span></div>
      <a class="btn" href="/venture/\${encodeURIComponent(v.slug)}" style="margin-top:16px">View founding offer</a>
    </article>\`).join('');
  return new Response(shell('IZAKHONO Venture Lab', \`
    <div class="nav"><div class="brand">IZAKHONO VENTURE LAB</div><div class="muted">Build · Test · Keep or Sell</div></div>
    <section class="hero"><div class="kicker">Live market experiments</div>
      <h1>Small software businesses built to prove demand.</h1>
      <p class="muted">We launch focused products, listen to real customers and invest harder in the ones that earn their place.</p>
    </section>
    <section class="grid">\${cards}</section>
  \`), { headers: { 'content-type':'text/html; charset=utf-8' }});
}

async function venturePage(env: Env, slug: string) {
  await seed(env);
  const v = await env.DB.prepare('SELECT * FROM venture_experiments WHERE slug=?').bind(slug).first<any>();
  if (!v) return new Response('Not found', { status:404 });
  await env.DB.prepare('INSERT INTO venture_events(id,venture_slug,event_type,detail) VALUES(?,?,?,?)')
    .bind(\`evt_\${crypto.randomUUID().replaceAll('-','')}\`, slug, 'view', 'landing').run();

  const base = VENTURES.find(x => x.slug === slug);
  const accent = base?.accent || '#F4B942';
  const hero = base?.hero || v.promise;
  return new Response(shell(v.name, \`
    <div class="nav"><a href="/ventures" class="brand" style="text-decoration:none">IZAKHONO VENTURE LAB</a><span class="tag">Founding beta</span></div>
    <section class="hero">
      <div class="kicker" style="color:\${accent}">\${esc(v.category)}</div>
      <h1>\${esc(hero)}</h1>
      <p>\${esc(v.promise)}</p>
      <p class="muted"><strong>Built for:</strong> \${esc(v.audience)}</p>
      <div class="price" style="margin:24px 0">Founding plan: R\${Number(v.monthly_price_zar).toLocaleString('en-ZA')} / month</div>
      <form id="lead" class="form">
        <input name="name" placeholder="Your name" maxlength="100">
        <input name="email" type="email" placeholder="Email address" maxlength="180">
        <input name="phone" placeholder="Phone / WhatsApp (optional)" maxlength="60">
        <label class="small"><input name="consent" type="checkbox" style="width:auto;margin-right:8px">I agree to be contacted about this beta.</label>
        <button class="btn" type="submit">Join the founding beta</button>
      </form>
      <div class="notice" id="msg"></div>
    </section>
    <script>
      const form=document.querySelector('#lead'),msg=document.querySelector('#msg');
      form.addEventListener('submit',async(e)=>{
        e.preventDefault();msg.textContent='Submitting…';
        const f=new FormData(form);
        const payload={name:f.get('name'),email:f.get('email'),phone:f.get('phone'),consent:f.get('consent')==='on',source:'venture-landing'};
        try{
          const r=await fetch('/api/venture/\${encodeURIComponent(slug)}/lead',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
          const d=await r.json(); if(!r.ok) throw new Error(d.error||'Could not submit');
          form.reset(); msg.textContent='You are on the founding list. We will contact you with access.';
        }catch(err){msg.textContent=err.message||String(err)}
      });
    </script>
  \`), { headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store' }});
}

export async function ventureFactoryRoute(
  req: Request,
  env: Env,
  url: URL,
  isOwner: () => Promise<boolean>,
): Promise<Response | null> {
  if (url.pathname === '/ventures' && req.method === 'GET') return publicIndex(env);

  const landing = url.pathname.match(/^\/venture\/([a-z0-9-]+)$/);
  if (landing && req.method === 'GET') return venturePage(env, landing[1]);

  const lead = url.pathname.match(/^\/api\/venture\/([a-z0-9-]+)\/lead$/);
  if (lead && req.method === 'POST') {
    await seed(env);
    let b: any = {};
    try { b = await req.json(); } catch { return json({ ok:false, error:'Expected JSON' },400); }
    const email = String(b.email || '').trim().slice(0,180);
    const phone = String(b.phone || '').trim().slice(0,60);
    if (!b.consent) return json({ ok:false, error:'Contact consent is required' },400);
    if (!email && !phone) return json({ ok:false, error:'Email or phone is required' },400);
    const exists = await env.DB.prepare('SELECT slug FROM venture_experiments WHERE slug=?').bind(lead[1]).first<any>();
    if (!exists) return json({ ok:false, error:'Venture not found' },404);
    await env.DB.prepare('INSERT INTO venture_leads(id,venture_slug,name,email,phone,consent,source) VALUES(?,?,?,?,?,?,?)')
      .bind(\`lead_\${crypto.randomUUID().replaceAll('-','')}\`, lead[1], String(b.name||'').trim().slice(0,100), email, phone, 1, String(b.source||'').slice(0,100)).run();
    await env.DB.prepare('INSERT INTO venture_events(id,venture_slug,event_type,detail) VALUES(?,?,?,?)')
      .bind(\`evt_\${crypto.randomUUID().replaceAll('-','')}\`, lead[1], 'lead', b.source || '').run();
    return json({ ok:true });
  }

  if (!url.pathname.startsWith('/api/venture-factory')) return null;
  if (!(await isOwner())) return json({ ok:false, error:'Unauthorized' },401);

  if (url.pathname === '/api/venture-factory' && req.method === 'GET') {
    return json({ ok:true, keep_threshold_zar:KEEP_THRESHOLD_ZAR, ventures:await portfolio(env) });
  }

  if (url.pathname === '/api/venture-factory/seed' && req.method === 'POST') {
    await seed(env);
    return json({ ok:true, count:VENTURES.length, keep_threshold_zar:KEEP_THRESHOLD_ZAR });
  }

  const revenue = url.pathname.match(/^\/api\/venture-factory\/([a-z0-9-]+)\/revenue$/);
  if (revenue && req.method === 'POST') {
    await seed(env);
    let b: any = {};
    try { b = await req.json(); } catch { return json({ ok:false, error:'Expected JSON' },400); }
    const amount = Number(b.amount_zar);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return json({ ok:false, error:'Valid positive amount_zar is required' },400);
    const row = await env.DB.prepare('SELECT slug FROM venture_experiments WHERE slug=?').bind(revenue[1]).first<any>();
    if (!row) return json({ ok:false, error:'Venture not found' },404);
    const occurred = typeof b.occurred_at === 'string' && b.occurred_at ? b.occurred_at.slice(0,32) : new Date().toISOString();
    await env.DB.prepare('INSERT INTO venture_revenue(id,venture_slug,amount_zar,occurred_at,note) VALUES(?,?,?,?,?)')
      .bind(\`rev_\${crypto.randomUUID().replaceAll('-','')}\`, revenue[1], amount, occurred, String(b.note||'').slice(0,300)).run();
    const all = await portfolio(env);
    const current = all.find((x: any) => x.slug === revenue[1]);
    return json({ ok:true, venture:current });
  }

  return json({ ok:false, error:'Not found' },404);
}

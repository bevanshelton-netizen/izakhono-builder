import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual, randomUUID } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(here, 'public');

const host = process.env.VENTURE_FACTORY_HOST || '0.0.0.0';
const port = Number(process.env.PORT || process.env.VENTURE_FACTORY_PORT || 9780);
const dataDir = process.env.VENTURE_FACTORY_DATA_DIR || path.join(here, 'data');
const plansFile = path.join(dataDir, 'plans.jsonl');
const buildsFile = path.join(dataDir, 'builds.jsonl');

const ownerKey = process.env.VENTURE_FACTORY_OWNER_KEY || '';
const publicPlanning = String(process.env.VENTURE_FACTORY_PUBLIC_PLANNING || 'false').toLowerCase() === 'true';

const superAiUrl = String(process.env.IZAKHONO_SUPER_AI_URL || 'http://host.docker.internal:9595').replace(/\/$/, '');
const superAiInternalKey = process.env.IZAKHONO_SUPER_AI_INTERNAL_KEY || '';
const superAiWorkflowKey = process.env.IZAKHONO_SUPER_AI_WORKFLOW_KEY || '';

const builderUrl = String(process.env.IZAKHONO_BUILDER_URL || '').replace(/\/$/, '');
const builderAdminKey = process.env.IZAKHONO_BUILDER_ADMIN_KEY || '';

const customerMode = String(process.env.VENTURE_FACTORY_CUSTOMER_MODE || 'false').toLowerCase() === 'true';
const idUrl = String(process.env.IZAKHONO_ID_URL || '').replace(/\/$/, '');
const idInternalKey = process.env.IZAKHONO_ID_INTERNAL_KEY || '';
const accessUrl = String(process.env.IZAKHONO_ACCESS_URL || '').replace(/\/$/, '');
const accessInternalKey = process.env.IZAKHONO_ACCESS_INTERNAL_KEY || '';
const accessEntityId = String(process.env.VENTURE_FACTORY_ACCESS_ENTITY_ID || 'izakhono-africa').trim().toLowerCase();
const accessProduct = 'venture-factory';
const payUrl = String(process.env.IZAKHONO_PAY_URL || '').replace(/\/$/, '');
const payApiKey = process.env.IZAKHONO_PAY_API_KEY || '';
const payAppSlug = String(process.env.IZAKHONO_PAY_APP_SLUG || 'venture-factory').trim().toLowerCase();
const priceMinor = Number(process.env.VENTURE_FACTORY_PRICE_MINOR || '0');
const accessPlanSlug = String(process.env.VENTURE_FACTORY_ACCESS_PLAN || 'monthly').trim().toLowerCase();
const accessPeriodDays = Number(process.env.VENTURE_FACTORY_ACCESS_PERIOD_DAYS || '30');
const publicOrigin = String(process.env.VENTURE_FACTORY_PUBLIC_ORIGIN || '').replace(/\/$/, '');

function json(res, status, body, extra = {}) {
  const raw = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(raw.length),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...extra,
  });
  res.end(raw);
}

function text(res, status, body, contentType = 'text/plain; charset=utf-8') {
  const raw = Buffer.from(body);
  res.writeHead(status, {
    'content-type': contentType,
    'content-length': String(raw.length),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  res.end(raw);
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && aa.length > 0 && timingSafeEqual(aa, bb);
}

function ownerAuthorized(req) {
  const supplied = req.headers['x-venture-factory-key'] || '';
  return Boolean(ownerKey && safeEqual(supplied, ownerKey));
}

function planningAuthorized(req) {
  return publicPlanning || ownerAuthorized(req);
}

function bearerToken(req) {
  const value = String(req.headers.authorization || '').trim();
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
}

function customerStackConfigured() {
  return Boolean(customerMode && idUrl && idInternalKey && accessUrl && accessInternalKey);
}

function paymentConfigured() {
  return Boolean(payUrl && payApiKey && payAppSlug && Number.isSafeInteger(priceMinor) && priceMinor >= 100);
}

async function requestJson(url, { method = 'GET', headers = {}, body } = {}) {
  const r = await fetch(url, {
    method,
    headers: { accept: 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error',
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data?.error || data?.error?.message || ('http_' + r.status));
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function customerContext(req) {
  if (!customerStackConfigured()) return null;
  const token = bearerToken(req);
  if (!token) return { authenticated: false, active: false, reason: 'missing_bearer_token' };

  let identity;
  try {
    identity = await requestJson(idUrl + '/api/v1/internal/introspect', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-izakhono-id-internal-key': idInternalKey,
      },
      body: { token },
    });
  } catch {
    return { authenticated: false, active: false, reason: 'identity_unavailable' };
  }

  if (!identity?.active) {
    return { authenticated: false, active: false, reason: 'invalid_session' };
  }

  let access;
  try {
    access = await requestJson(accessUrl + '/api/v1/check', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-izakhono-access-key': accessInternalKey,
      },
      body: {
        entity_id: accessEntityId,
        subject: identity.subject,
        product: accessProduct,
      },
    });
  } catch {
    return {
      authenticated: true,
      active: false,
      identity,
      reason: 'access_unavailable',
    };
  }

  return {
    authenticated: true,
    active: access?.active === true,
    identity,
    entitlement: access?.entitlement || null,
    usage_policy: access?.usage_policy || null,
    reason: access?.active === true ? 'active' : 'subscription_required',
  };
}

async function authorizePlanning(req) {
  if (ownerAuthorized(req)) return { ok: true, mode: 'owner', customer: null };
  if (publicPlanning) return { ok: true, mode: 'public', customer: null };
  if (!customerMode) return { ok: false, status: 401, error: 'unauthorized' };

  const customer = await customerContext(req);
  if (!customer?.authenticated) {
    return { ok: false, status: 401, error: customer?.reason || 'authentication_required', customer };
  }
  if (!customer.active) {
    return {
      ok: false,
      status: 402,
      error: customer.reason || 'subscription_required',
      customer,
      checkout_available: paymentConfigured(),
    };
  }
  return { ok: true, mode: 'subscriber', customer };
}

async function readJson(req, max = 1_000_000) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw new Error('body_too_large');
    chunks.push(chunk);
  }
  if (!chunks.length) throw new Error('empty_body');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function titleCase(input) {
  return String(input || '')
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .map(x => x ? x[0].toUpperCase() + x.slice(1).toLowerCase() : '')
    .join(' ');
}

function deriveCategory(idea) {
  const s = idea.toLowerCase();
  if (/(invoice|account|tax|finance|payment)/.test(s)) return 'FinOps SaaS';
  if (/(school|education|training|course|learn)/.test(s)) return 'EdTech';
  if (/(music|artist|creator|video|image|design)/.test(s)) return 'Creator AI';
  if (/(booking|appointment|schedule|calendar)/.test(s)) return 'Operations SaaS';
  if (/(market|ad|social|content|lead)/.test(s)) return 'Growth SaaS';
  return 'AI Workflow SaaS';
}

function deriveAudience(idea) {
  const s = idea.toLowerCase();
  if (/(plumb|electric|trade|contractor|repair|builder|construction)/.test(s)) return 'Trades, contractors and local service businesses';
  if (/(restaurant|food|cafe|takeaway|catering)/.test(s)) return 'Restaurants, food businesses and hospitality operators';
  if (/(school|student|teacher|education|training|course|learn)/.test(s)) return 'Education providers, learners and training organisations';
  if (/(clinic|doctor|patient|health|medical|dentist)/.test(s)) return 'Healthcare practices and service teams';
  if (/(music|artist|creator|podcast|video|content)/.test(s)) return 'Creators, artists, studios and media businesses';
  if (/(retail|shop|store|inventory|stock|ecommerce|marketplace)/.test(s)) return 'Retailers, online sellers and small commerce teams';
  return 'SMEs, independent professionals and growing service businesses';
}

function ventureName(idea) {
  const words = titleCase(idea).split(' ').filter(Boolean);
  const base = words.slice(0, 2).join('');
  return (base || 'IzakhonoVenture') + ' AI';
}

function scenario(customers, price, cpa) {
  const mrr = customers * price;
  const acquisition = customers * cpa;
  return {
    customers,
    monthly_revenue_zar: mrr,
    illustrative_acquisition_cost_zar: acquisition,
    illustrative_contribution_before_ops_zar: Math.max(0, mrr - acquisition),
  };
}

function deterministicPlan(idea, country, price, target) {
  const category = deriveCategory(idea);
  const audience = deriveAudience(idea);
  const cpa = Math.max(50, Math.round(price * 0.25));
  const customersNeeded = Math.max(1, Math.ceil(target / price));
  return {
    plan_version: 'venture-factory-engine-1.0',
    generated_at: new Date().toISOString(),
    idea,
    venture: {
      name: ventureName(idea),
      category,
      audience,
      country,
      monthly_price_zar: price,
      target_monthly_revenue_zar: target,
      customers_needed_for_target: customersNeeded,
      one_line_offer: 'A focused ' + category.toLowerCase() + ' product for ' + audience.toLowerCase() + '.',
    },
    build: {
      ai: 'IZAKHONO SUPER AI',
      builder: 'IZAKHONO BUILDER',
      crm: 'IZAKHONO CRM',
      payments: 'IZAKHONO PAY with iKhokha-first adapter where suitable',
      marketing: 'IZAKHONO CREATE + IZAKHONO ADS',
      deployment: 'IZAKHONO NODE / CONTROL primary with reversible external resilience',
    },
    revenue_simulator: {
      currency: 'ZAR',
      estimated_cpa_zar: cpa,
      scenarios: [
        scenario(25, price, cpa),
        scenario(100, price, cpa),
        scenario(300, price, cpa),
        scenario(customersNeeded, price, cpa),
      ],
      note: 'Illustrative only; replace assumptions with observed conversion, churn, payment fees, tax and operating costs.',
    },
    go_to_market: {
      channels: ['Google Ads', 'Meta Ads', 'Organic short-form content', 'Referral loop'],
      spend_rule: 'No advertising spend is launched without explicit approval and a connected advertising account.',
    },
    market_validation: {
      competitor_research: 'research-required',
      tests: [
        'Interview target customers about the painful workflow and current workaround.',
        'Launch one clear offer with one primary conversion action.',
        'Collect qualified leads or pre-orders before broad feature expansion.',
        'Measure paid conversion and cost per qualified lead before scale.',
      ],
    },
    launch_sequence: [
      'Define offer and ideal customer profile.',
      'Generate lean product and checkout.',
      'Connect CRM and payment path.',
      'Generate campaign creative and channel plan.',
      'Run controlled validation after explicit approval.',
      'Measure activation, conversion, retention and refund rate.',
      'Improve from customer evidence.',
      'Scale only after unit economics are proven.',
    ],
  };
}

function cleanString(value, max = 800) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanList(value, maxItems = 12) {
  if (!Array.isArray(value)) return [];
  return value.filter(x => typeof x === 'string').map(x => x.trim().slice(0, 500)).filter(Boolean).slice(0, maxItems);
}

function parseJsonObject(raw) {
  const t = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)); } catch {}
  }
  return null;
}

async function enrichWithSuperAI(base) {
  const configured = Boolean(superAiInternalKey && superAiWorkflowKey && superAiUrl);
  if (!configured) {
    return {
      ...base,
      intelligence: { mode: 'deterministic-fallback', reason: 'super-ai-not-configured', pricing_math_locked: true, approval_gates_locked: true },
    };
  }

  const prompt = [
    'Enrich this IZAKHONO venture plan. Return strict JSON only.',
    'Allowed keys: venture_name, one_line_offer, positioning, ideal_customer_profile, market_hypotheses, validation_questions, creative_hooks, build_priorities, risks_to_test.',
    'Do not change pricing, revenue arithmetic, payment approvals, ad-spend approvals or infrastructure policy.',
    'Do not invent competitor names, market shares or verified market facts.',
    JSON.stringify({ idea: base.idea, venture: base.venture, build: base.build, validation: base.market_validation }),
  ].join('\n');

  try {
    const r = await fetch(superAiUrl + '/api/v1/generate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-izakhono-ai-key': superAiInternalKey,
        'x-izakhono-ai-workflow-key': superAiWorkflowKey,
      },
      body: JSON.stringify({
        entity_id: 'izakhono-africa',
        product: 'venture-factory',
        access_mode: 'workflow',
        capability: 'reasoning',
        messages: [
          { role: 'system', content: 'Return strict JSON only. Preserve locked commercial and approval fields.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!r.ok) throw new Error('super_ai_http_' + r.status);
    const data = await r.json();
    const ai = parseJsonObject(data?.output?.text || data?.answer || '');
    if (!ai || typeof ai !== 'object' || Array.isArray(ai)) throw new Error('invalid_super_ai_json');

    return {
      ...base,
      venture: {
        ...base.venture,
        name: cleanString(ai.venture_name, 100) || base.venture.name,
        one_line_offer: cleanString(ai.one_line_offer, 500) || base.venture.one_line_offer,
      },
      intelligence: {
        mode: 'super-ai',
        model: cleanString(data?.model, 120) || null,
        owner_only: data?.owner_only === true,
        pricing_math_locked: true,
        approval_gates_locked: true,
      },
      super_ai_enrichment: {
        positioning: cleanString(ai.positioning),
        ideal_customer_profile: cleanString(ai.ideal_customer_profile),
        market_hypotheses: cleanList(ai.market_hypotheses),
        validation_questions: cleanList(ai.validation_questions),
        creative_hooks: cleanList(ai.creative_hooks),
        build_priorities: cleanList(ai.build_priorities),
        risks_to_test: cleanList(ai.risks_to_test),
      },
    };
  } catch (e) {
    return {
      ...base,
      intelligence: { mode: 'deterministic-fallback', reason: String(e?.message || e).slice(0, 120), pricing_math_locked: true, approval_gates_locked: true },
    };
  }
}

async function persistPlan(record) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.appendFile(plansFile, JSON.stringify(record) + '\n', 'utf8');
}

async function listPlans(limit = 50) {
  try {
    const raw = await fs.readFile(plansFile, 'utf8');
    return raw.trim().split('\n').filter(Boolean).slice(-limit).reverse().map(line => JSON.parse(line));
  } catch (e) {
    if (e?.code === 'ENOENT') return [];
    throw e;
  }
}


async function findPlan(id) {
  const plans = await listPlans(500);
  return plans.find(x => x.id === id) || null;
}

async function persistBuild(record) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.appendFile(buildsFile, JSON.stringify(record) + '\n', 'utf8');
}

async function listBuilds(limit = 50) {
  try {
    const raw = await fs.readFile(buildsFile, 'utf8');
    return raw.trim().split('\n').filter(Boolean).slice(-limit).reverse().map(line => JSON.parse(line));
  } catch (e) {
    if (e?.code === 'ENOENT') return [];
    throw e;
  }
}

function builderConfigured() {
  return Boolean(builderUrl && builderAdminKey);
}

async function builderRequest(method, pathname, body) {
  if (!builderConfigured()) throw new Error('builder_bridge_not_configured');
  const headers = {
    'accept': 'application/json',
    'x-admin-secret': builderAdminKey,
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const r = await fetch(builderUrl + pathname, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) {
    const err = new Error(data?.error || ('builder_http_' + r.status));
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52) || 'venture';
}

async function promotePlanToBuilder(planRecord) {
  const plan = planRecord?.plan;
  if (!plan?.venture) throw new Error('venture_plan_incomplete');

  const name = cleanString(plan.venture.name, 100) || 'IZAKHONO Venture';
  const category = cleanString(plan.venture.category, 60) || 'AI Workflow SaaS';
  const description = cleanString(plan.venture.one_line_offer, 600) || cleanString(plan.idea, 600);
  const modules = [
    'auth','leads','ai','payments','admin','analytics','revenue','integrations','publish','growth'
  ];

  const created = await builderRequest('POST', '/api/projects', {
    name,
    slug: slugify(name) + '-' + planRecord.id.slice(-6).toLowerCase(),
    category,
    description,
    modules,
  });

  const projectId = created?.id;
  if (!projectId) throw new Error('builder_project_id_missing');

  const planned = await builderRequest('POST', '/api/projects/' + encodeURIComponent(projectId) + '/plan');
  const generated = await builderRequest('POST', '/api/projects/' + encodeURIComponent(projectId) + '/generate');
  const validated = await builderRequest('POST', '/api/projects/' + encodeURIComponent(projectId) + '/validate-generated');

  return {
    project: {
      id: projectId,
      name,
      slug: created?.slug || null,
      category,
      status: 'validated',
    },
    stages: {
      planned: Boolean(planned?.ok ?? true),
      generated: Boolean(generated?.ok ?? true),
      validated: Boolean(validated?.validation?.passed ?? validated?.ok ?? true),
    },
    repository: validated?.internal_repository || null,
    preview: validated?.preview || null,
    public_live: false,
    next_gate: 'deployment-verification',
  };
}

async function serveStatic(req, res, url) {
  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!['/index.html', '/app.js', '/styles.css'].includes(pathname)) return false;
  const file = path.join(publicRoot, pathname);
  const body = await fs.readFile(file);
  const type = pathname.endsWith('.html') ? 'text/html; charset=utf-8' : pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8';
  res.writeHead(200, {
    'content-type': type,
    'content-length': String(body.length),
    'cache-control': pathname.endsWith('.html') ? 'no-store' : 'public, max-age=300',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  });
  res.end(body);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://venture-factory.local');

    if (req.method === 'GET' && url.pathname === '/healthz') {
      return json(res, 200, {
        ok: true,
        service: 'IZAKHONO Venture Factory',
        engine: '1.0.0',
        independently_deployable: true,
        super_ai_configured: Boolean(superAiInternalKey && superAiWorkflowKey),
        builder_bridge_configured: builderConfigured(),
        customer_mode: customerMode,
        customer_stack_configured: customerStackConfigured(),
        checkout_configured: paymentConfigured(),
        public_planning: publicPlanning,
        tracking: false,
        ad_spend_autonomous: false,
        external_account_mutation_autonomous: false,
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/plan') {
      const authorization = await authorizePlanning(req);
      if (!authorization.ok) {
        return json(res, authorization.status || 401, {
          ok: false,
          error: authorization.error || 'unauthorized',
          checkout_available: authorization.checkout_available === true,
        });
      }
      let body;
      try { body = await readJson(req); } catch { return json(res, 400, { ok: false, error: 'invalid_json' }); }

      const idea = String(body.idea || '').trim().slice(0, 2000);
      const country = String(body.country || 'South Africa').trim().slice(0, 100) || 'South Africa';
      const price = Math.round(Number(body.monthly_price_zar || 499));
      const target = Math.round(Number(body.target_monthly_revenue_zar || 100000));

      if (idea.length < 12) return json(res, 422, { ok: false, error: 'idea_too_short' });
      if (!Number.isFinite(price) || price < 50 || price > 100000) return json(res, 422, { ok: false, error: 'invalid_monthly_price_zar' });
      if (!Number.isFinite(target) || target < 1000 || target > 1000000000) return json(res, 422, { ok: false, error: 'invalid_target_monthly_revenue_zar' });

      const plan = await enrichWithSuperAI(deterministicPlan(idea, country, price, target));
      const record = {
        id: 'vf_' + randomUUID().replaceAll('-', ''),
        created_at: new Date().toISOString(),
        access_mode: authorization.mode,
        subject: authorization.customer?.identity?.subject || null,
        entity_id: authorization.customer?.identity?.entity_id || null,
        plan,
      };
      await persistPlan(record);
      return json(res, 200, { ok: true, ...record });
    }




    if (req.method === 'POST' && url.pathname === '/api/customer/login') {
      if (!customerMode || !idUrl) return json(res, 404, { ok: false, error: 'customer_mode_disabled' });
      let body;
      try { body = await readJson(req, 100_000); } catch { return json(res, 400, { ok: false, error: 'invalid_json' }); }
      const email = cleanString(body.email, 254).toLowerCase();
      const password = typeof body.password === 'string' ? body.password : '';
      const entitySlug = cleanString(body.entity_slug || 'izakhono-africa', 80).toLowerCase();
      if (!email || !password || !entitySlug) return json(res, 422, { ok: false, error: 'email_password_entity_required' });
      try {
        const login = await requestJson(idUrl + '/api/v1/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: { email, password, entity_slug: entitySlug },
        });
        return json(res, 200, {
          ok: true,
          access_token: login.access_token,
          token_type: login.token_type || 'Bearer',
          expires_at: login.expires_at || null,
          subject: login.subject || email,
          entity: login.entity || null,
          role: login.role || null,
        });
      } catch (e) {
        const status = Number(e?.status) || 502;
        return json(res, status === 401 || status === 403 || status === 422 ? status : 502, {
          ok: false,
          error: cleanString(e?.message, 160) || 'login_failed',
        });
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/customer/logout') {
      if (!customerMode || !idUrl) return json(res, 404, { ok: false, error: 'customer_mode_disabled' });
      const token = bearerToken(req);
      if (!token) return json(res, 401, { ok: false, error: 'authentication_required' });
      try {
        await requestJson(idUrl + '/api/v1/logout', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
          body: {},
        });
      } catch {}
      return json(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/api/customer/session') {
      if (!customerMode) return json(res, 404, { ok: false, error: 'customer_mode_disabled' });
      const customer = await customerContext(req);
      if (!customer?.authenticated) {
        return json(res, 401, { ok: false, error: customer?.reason || 'authentication_required' });
      }
      return json(res, 200, {
        ok: true,
        subject: customer.identity?.subject || null,
        entity_id: customer.identity?.entity_id || null,
        entity_slug: customer.identity?.entity_slug || null,
        role: customer.identity?.role || null,
        access: {
          active: customer.active,
          entitlement: customer.entitlement,
          usage_policy: customer.usage_policy,
        },
        checkout_available: paymentConfigured(),
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/customer/checkout') {
      if (!customerMode) return json(res, 404, { ok: false, error: 'customer_mode_disabled' });
      if (!paymentConfigured()) return json(res, 503, { ok: false, error: 'checkout_not_configured' });

      const customer = await customerContext(req);
      if (!customer?.authenticated) {
        return json(res, 401, { ok: false, error: customer?.reason || 'authentication_required' });
      }
      if (customer.active) {
        return json(res, 409, { ok: false, error: 'subscription_already_active', entitlement: customer.entitlement });
      }

      let body = {};
      try { body = await readJson(req); } catch { body = {}; }
      const requestedKey = String(req.headers['idempotency-key'] || body.idempotency_key || '').trim();
      if (!/^[A-Za-z0-9._:-]{8,120}$/.test(requestedKey)) {
        return json(res, 422, { ok: false, error: 'idempotency_key_required' });
      }

      const metadata = {
        access_entity_id: accessEntityId,
        access_subject: customer.identity.subject,
        access_product: accessProduct,
        access_plan: accessPlanSlug,
        access_period_days: accessPeriodDays,
      };
      const returnUrl = publicOrigin ? publicOrigin + '/?payment=return' : undefined;
      const cancelUrl = publicOrigin ? publicOrigin + '/?payment=cancel' : undefined;

      try {
        const intentData = await requestJson(payUrl + '/api/v1/intents', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-izakhono-key': payApiKey,
            'x-izakhono-app': payAppSlug,
            'idempotency-key': requestedKey,
          },
          body: {
            amount_minor: priceMinor,
            currency: 'ZAR',
            email: customer.identity.subject,
            description: 'IZAKHONO Venture Factory ' + accessPlanSlug + ' access',
            provider: 'smart',
            metadata,
            ...(returnUrl ? { return_url: returnUrl } : {}),
            ...(cancelUrl ? { cancel_url: cancelUrl } : {}),
          },
        });
        return json(res, 201, {
          ok: true,
          pending: true,
          plan: accessPlanSlug,
          amount_minor: priceMinor,
          currency: 'ZAR',
          intent: intentData.intent || null,
          note: 'Access remains locked until IZAKHONO PAY confirms payment and IZAKHONO ACCESS grants the entitlement.',
        });
      } catch (e) {
        return json(res, Number(e?.status) || 502, {
          ok: false,
          error: cleanString(e?.message, 160) || 'checkout_failed',
        });
      }
    }

    const buildMatch = url.pathname.match(/^\/api\/plans\/([^/]+)\/build$/);
    if (req.method === 'POST' && buildMatch) {
      if (!ownerAuthorized(req)) return json(res, 401, { ok: false, error: 'unauthorized' });
      if (!builderConfigured()) return json(res, 503, { ok: false, error: 'builder_bridge_not_configured' });

      const planId = decodeURIComponent(buildMatch[1]);
      const planRecord = await findPlan(planId);
      if (!planRecord) return json(res, 404, { ok: false, error: 'plan_not_found' });

      const existingBuilds = await listBuilds(500);
      const previous = existingBuilds.find(x => x.plan_id === planId && x.status === 'validated');
      if (previous) {
        return json(res, 200, {
          ok: true,
          already_built: true,
          build: previous,
          public_live: false,
        });
      }

      try {
        const promoted = await promotePlanToBuilder(planRecord);
        const record = {
          id: 'vfb_' + randomUUID().replaceAll('-', ''),
          plan_id: planId,
          created_at: new Date().toISOString(),
          status: 'validated',
          ...promoted,
        };
        await persistBuild(record);
        return json(res, 200, {
          ok: true,
          build: record,
          message: 'Plan promoted into IZAKHONO Builder and validated. Public deployment remains a separate gate.',
        });
      } catch (e) {
        const status = Number(e?.status) || 502;
        return json(res, status, {
          ok: false,
          error: cleanString(e?.message, 160) || 'builder_bridge_failed',
          public_live: false,
        });
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/builds') {
      if (!ownerAuthorized(req)) return json(res, 401, { ok: false, error: 'unauthorized' });
      const builds = await listBuilds(Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50))));
      return json(res, 200, { ok: true, builds });
    }

    if (req.method === 'GET' && url.pathname === '/api/plans') {
      if (!ownerAuthorized(req)) return json(res, 401, { ok: false, error: 'unauthorized' });
      const plans = await listPlans(Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50))));
      return json(res, 200, { ok: true, plans });
    }

    if (req.method === 'GET' && await serveStatic(req, res, url)) return;
    return json(res, 404, { ok: false, error: 'not_found' });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'venture_factory_error', detail: String(e?.message || e).slice(0, 200) });
  }
});

server.listen(port, host, () => {
  console.log('IZAKHONO_VENTURE_FACTORY=READY');
  console.log('PORT=' + port);
});

import { isIP } from 'node:net';

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  const family = isIP(host);
  if (family === 4) {
    const [a,b] = host.split('.').map(Number);
    return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  if (family === 6) return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:');
  return false;
}

export function resolveLocalModelConfig(env = process.env) {
  const url = new URL(env.IZAKHONO_LOCAL_MODEL_URL || 'http://127.0.0.1:11434/api/chat');
  const trusted = (env.IZAKHONO_MODEL_TRUSTED_HOSTS || '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('model-runtime-protocol-not-supported');
  if (!isPrivateHost(url.hostname) && !trusted.includes(url.hostname.toLowerCase())) throw new Error('model-runtime-host-not-private-or-explicitly-trusted');
  return { url: url.toString(), model: env.IZAKHONO_LOCAL_MODEL || 'qwen2.5-coder:7b' };
}

export function normalizeBrief(input, goal = 'Your project') {
  const clean = (value, max = 500) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
  const sections = Array.isArray(input.sections) ? input.sections.slice(0, 8).map((section) => ({
    heading: clean(section?.heading, 100) || 'What We Do',
    body: clean(section?.body, 900) || 'A clear, practical service designed around your needs.',
  })) : [];
  return {
    title: clean(input.title, 100) || clean(goal, 100) || 'IZAKHONO Project',
    tagline: clean(input.tagline, 180) || 'Built with purpose. Delivered with care.',
    description: clean(input.description, 700) || clean(goal, 700),
    sections: sections.length ? sections : [{ heading: 'Our Approach', body: clean(goal, 700) }],
    callToAction: clean(input.callToAction, 80) || 'Get in touch',
  };
}

export async function generateSiteBrief(goal, options = {}) {
  const env = options.env || process.env;
  const config = resolveLocalModelConfig(env);
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(env.IZAKHONO_MODEL_TIMEOUT_MS || 45000));
  try {
    const response = await fetchImpl(config.url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({
        model: config.model, stream: false, format: 'json',
        messages: [
          { role: 'system', content: 'Return only JSON with keys title, tagline, description, sections (array of objects with heading and body), callToAction. Create concise, professional website content. Do not include HTML, scripts, markdown, secrets, or unsupported factual claims.' },
          { role: 'user', content: 'Create a website content brief for this project goal: ' + String(goal).slice(0, 4000) },
        ],
      }),
    });
    if (!response.ok) throw new Error('local-model-http-' + response.status);
    const payload = await response.json();
    const content = payload.message?.content || payload.response;
    if (typeof content !== 'string') throw new Error('local-model-empty-response');
    return { brief: normalizeBrief(JSON.parse(content), goal), mode: 'local-model', model: config.model };
  } finally { clearTimeout(timeout); }
}

export function fallbackSiteBrief(goal) {
  return {
    brief: normalizeBrief({
      title: 'Your Project',
      tagline: 'A clear idea, built into a practical digital experience.',
      description: goal,
      sections: [
        { heading: 'The Opportunity', body: goal },
        { heading: 'What We Deliver', body: 'A focused digital experience with clear information, simple navigation and a direct next step.' },
        { heading: 'Built to Grow', body: 'The foundation is designed to be extended as your services, customers and operational needs grow.' },
      ],
      callToAction: 'Start a conversation',
    }, goal),
    mode: 'deterministic-fallback',
    reason: 'local-model-not-configured-or-unavailable',
  };
}

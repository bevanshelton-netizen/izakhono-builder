import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../public/', import.meta.url));
const PORT = Number(process.env.PORT || 3000);

function json(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function tutorReply(prompt = '') {
  const q = String(prompt).trim();
  if (!q) return 'Ask me a learning question and I will explain it simply.';
  const lower = q.toLowerCase();
  if (lower.includes('fraction')) return 'Fractions describe parts of a whole. For example, 1/2 means one of two equal parts. Quick check: what is 2/4 simplified?';
  if (lower.includes('algebra')) return 'Algebra uses symbols such as x for unknown values. Example: if x + 3 = 8, subtract 3 from both sides, so x = 5.';
  if (lower.includes('quiz')) return 'Mini quiz: 1) Solve x + 7 = 15. 2) Simplify 6/12. 3) Expand 2(x + 4). Send your answers for marking.';
  return `I can help with that. Start with the main idea behind “${q.slice(0, 120)}”, then we will work through one example and a short practice question.`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') return json(res, 200, { ok: true, app: 'ubuntu-ai-tutor', mode: process.env.APP_ENV || 'local' });
  if (url.pathname === '/api/config') return json(res, 200, {
    ok: true,
    payments: Boolean(process.env.PAYFAST_MERCHANT_ID),
    aiProviderConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.IZAKHONO_AI_ENDPOINT),
    persistenceConfigured: Boolean(process.env.DATABASE_URL || process.env.IZAKHONO_CORE_URL)
  });

  if (url.pathname === '/api/tutor' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let payload = {};
    try { payload = JSON.parse(body || '{}'); } catch { return json(res, 400, { ok: false, error: 'invalid_json' }); }
    const reply = await tutorReply(payload.prompt);
    return json(res, 200, { ok: true, reply, source: 'ubuntu-ai-safe-fallback' });
  }

  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = join(ROOT, path.replace(/^\/+/, ''));
  try {
    const data = await readFile(filePath);
    const type = extname(filePath) === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    res.end(data);
  } catch {
    json(res, 404, { ok: false, error: 'not_found' });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Ubuntu AI Tutor listening on ${PORT}`));

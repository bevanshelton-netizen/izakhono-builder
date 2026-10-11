import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
const readBody = req => new Promise((resolve, reject) => { let raw=''; req.on('data', c => raw += c); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } }); req.on('error', reject); });

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/health') return json(res, 200, { ok:true, service:'izakhono-creator-studio', controlPlane:'IZAKHONO PROVISIONER', deploymentModel:'owned-first', version:'1.0.0' });
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'content-type':'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(root,'index.html')));
    }
    if (req.method === 'POST' && req.url === '/api/generate') {
      const body = await readBody(req); const b = String(body.brief || '').trim();
      if (!b) return json(res, 400, { error:'An instruction or question is required.' });
      const mode = body.mode || 'campaign'; const lower = b.toLowerCase();
      if (mode === 'view') return json(res, 200, { ok:true, mode:'view', engine:'IZAKHONO CEO Command Centre', title:"IZAKHONO's View", answer:'Make IZAKHONO the operating system around the opportunity, not another isolated app. Prioritize the smallest revenue-producing workflow, connect payment + customer capture + delivery, then instrument it before adding more features.', priorities:['1. Define the business outcome and one primary customer action.','2. Build the shortest end-to-end workflow that can produce that outcome.','3. Connect owned IZAKHONO infrastructure first; keep external services replaceable.','4. Add payment, CRM/lead capture and WhatsApp where relevant.','5. Measure conversion and repurpose successful outputs automatically.'], recommendedAction:`EXECUTE: ${b}`, workflow:['decide','plan','build','connect','measure','improve'] });
      const school=/school|uniform|matric|learner/.test(lower); const lead=/lead|quote|enquir|book|contact/.test(lower); const product=/product|launch|sell|offer|store|catalogue/.test(lower);
      const title=school?'School Uniform Campaign 2027':product?'Product Launch Campaign':lead?'Lead Generation Campaign':'Brand Growth Campaign'; const cta=school?'REQUEST THE 2027 SCHOOL UNIFORM CATALOGUE':lead?'REQUEST A QUOTE ON WHATSAPP':'START YOUR CAMPAIGN TODAY'; const headline=school?'Dress the future. Order your 2027 school uniforms now.':product?'Turn your next launch into a campaign people can act on.':'Build attention. Build trust. Build the business.';
      return json(res,200,{ok:true,mode:'campaign',engine:'IZAKHONO Creator Engine v1',title,audience:school?'Schools, principals, procurement teams, parents and learners':'Prospects who value quality, African relevance and dependable delivery',headline,cta,copy:`IZAKHONO turns one clear idea into a connected commercial campaign. ${b}. Make the message clear, the offer compelling and the next action simple.`,assets:{video:`15–30s vertical ad\nOpening → benefit → proof → offer → ${cta}`,image:`Premium commercial visual direction; authentic African context; strong subject focus; mobile-first composition.`,landing:`Hero: ${headline}\nProof: quality • reliability • African relevance\nPrimary CTA: ${cta}`,whatsapp:`Greeting → qualification → need → catalogue/quote → order handoff`,social:'Hook → benefit → proof → CTA → channel variants',seo:`${title} | IZAKHONO`},workflow:['brief','plan','write','design','produce','approve','distribute','measure','repurpose'],channels:body.channels || ['Instagram','Facebook','WhatsApp','Web']});
    }
    return json(res, 404, { error:'Not found' });
  } catch (e) { return json(res, 500, { error:'Server error' }); }
});
server.listen(port, '0.0.0.0', () => console.log(`IZAKHONO Creator Studio listening on ${port}`));

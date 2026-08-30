import app from './index';

// Emergency owner recovery credential: only its SHA-256 hash is stored in source.
// The plaintext recovery key is never committed. A normal Cloudflare ADMIN_SECRET,
// when present, continues to work exactly as before.
const OWNER_RECOVERY_SHA256 = '1e5d89da2eb25493a8f0629b0537de22d5bef73c18ae83dc4b0d783b58af2dbc';
const encoder = new TextEncoder();

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

async function isRecoveryKey(value: string): Promise<boolean> {
  if (!value || value.length < 24 || value.length > 160) return false;
  return (await sha256Hex(value)) === OWNER_RECOVERY_SHA256;
}

function ownerEnv(env: any, supplied: string): any {
  return new Proxy(env, {
    get(target, prop, receiver) {
      if (prop === 'ADMIN_SECRET') return supplied;
      return Reflect.get(target, prop, receiver);
    },
  });
}

const AUTOPILOT_UI = `
<section class="section" id="autopilotProof">
  <div class="card" style="border-color:#3d745d;background:linear-gradient(135deg,#10281f,#0d1b17)">
    <div class="ey">AUTOPILOT · FIRST LIVE PROOF</div>
    <h2 style="margin-bottom:8px">FAIS Exam Prep</h2>
    <p class="muted" style="margin-top:0">Once Owner Access is unlocked, IZAKHONO BUILDER will automatically place the first revenue-facing education product into the build queue and generate its architecture plan.</p>
    <div id="autopilotMsg" class="message">Waiting for Owner Access…</div>
  </div>
</section>`;

const AUTOPILOT_SCRIPT = `<script>
(function(){
  const payload={
    name:'FAIS Exam Prep',
    slug:'fais-exam-prep',
    category:'education',
    description:'Affordable, high-quality FAIS exam preparation for individuals and companies, with structured learning, extensive question banks, exam simulations, AI explanations, progress tracking, company enrolment and secure payments.',
    modules:['auth','payments','email','admin','analytics','learning','ai']
  };
  let running=false;
  async function firstProof(){
    const msg=document.querySelector('#autopilotMsg');
    if(!msg||running)return;
    if(!state.secret){msg.className='message';msg.textContent='Waiting for Owner Access…';return;}
    running=true;msg.className='message';msg.textContent='Creating the first Builder proof…';
    try{
      let project;
      try{
        project=await api('/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      }catch(e){
        if(!String(e.message).includes('slug already exists'))throw e;
        const listing=await api('/api/projects');
        project=(listing.projects||[]).find(p=>p.slug===payload.slug);
        if(!project)throw e;
      }
      if(!project.recipe){
        const planned=await api('/api/projects/'+project.id+'/plan',{method:'POST'});
        project.recipe=planned.recipe;
      }
      msg.className='message good';msg.textContent='FAIS Exam Prep is in the build queue. First proof created.';
      loadProjects();
    }catch(e){msg.className='message bad';msg.textContent='Autopilot: '+e.message;}
    finally{running=false;}
  }
  const originalSaveSecret=saveSecret;
  saveSecret=function(){originalSaveSecret();setTimeout(firstProof,250)};
  setTimeout(firstProof,400);
})();
</script>`;

async function withAutopilotUi(response: Response): Promise<Response> {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html') || !response.ok) return response;
  let html = await response.text();
  if (!html.includes('id="autopilotProof"')) html = html.replace('</main>', AUTOPILOT_UI + '</main>');
  if (!html.includes('First proof created.')) html = html.replace('</body>', AUTOPILOT_SCRIPT + '</body>');
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(req: Request, env: any): Promise<Response> {
    const supplied = req.headers.get('x-admin-secret') || '';
    const recovered = await isRecoveryKey(supplied);
    const effectiveEnv = recovered ? ownerEnv(env, supplied) : env;
    const response = await app.fetch(req, effectiveEnv);
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return withAutopilotUi(response);
    return response;
  },
};

import { listProjects, type CreatorStorageEnv } from './project-store';

function summarize(project: any) {
  const data = project.packageData && typeof project.packageData === 'object' ? project.packageData : {};
  const workflow = data.oneWorkflow ?? {};
  const master = data.oneMaster ?? {};
  const distribution = data.oneDistribution ?? {};
  const artifacts = Array.isArray(workflow.artifacts) ? workflow.artifacts : [];
  return { projectId: project.id, workflowId: workflow.workflowId, brief: project.brief, updatedAt: project.updatedAt, workflowStatus: workflow.status ?? 'not-started', artifacts: artifacts.length, completed: artifacts.filter((a: any) => a.status === 'completed').length, failed: artifacts.filter((a: any) => a.status === 'failed').length, masterStatus: master.status ?? 'not-started', distributionStatus: distribution.status ?? 'not-started', publishReady: master.status === 'approved' && distribution.status === 'approved', publicLive: false };
}

export async function handleOneCommandCenter(request: Request, env: CreatorStorageEnv) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/one/command-center') return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'GET required' }), { status: 405 });
  const limit = Number(url.searchParams.get('limit') ?? '25');
  const projects = await listProjects(env, Number.isFinite(limit) ? limit : 25);
  return new Response(JSON.stringify({ schema: 'izakhono.one/command-center-v1', publicLive: false, projects: projects.map(summarize) }), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}

export const oneCommandCenterUiScript = `<section id="izo-one-command-center" style="margin:24px auto;max-width:1100px;padding:20px;border:1px solid #ddd;border-radius:16px;font-family:system-ui"><h2>IZAKHONO ONE Command Center</h2><p>Workflows • approvals • assets • master packages • distribution • publishing readiness</p><button id="izo-cc-refresh">Refresh</button><div id="izo-cc-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:16px"></div></section><script>(async()=>{const g=document.getElementById('izo-cc-grid');const esc=(x)=>String(x??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));async function load(){const r=await fetch('/api/one/command-center');const d=await r.json();g.innerHTML=(d.projects||[]).map(p=>'<article style="padding:14px;border:1px solid #ddd;border-radius:12px"><b>'+esc(p.brief||p.projectId)+'</b><p>Workflow: '+esc(p.workflowStatus)+'<br>Assets: '+p.completed+'/'+p.artifacts+'<br>Master: '+esc(p.masterStatus)+'<br>Distribution: '+esc(p.distributionStatus)+'<br><strong>'+(p.publishReady?'Publish ready':'Approval required')+'</strong></p></article>').join('')||'<p>No workflows yet.</p>'}document.getElementById('izo-cc-refresh').onclick=load;load()})()</script>`;

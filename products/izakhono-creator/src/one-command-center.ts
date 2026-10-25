import { listProjects, type CreatorStorageEnv } from './project-store';

function summarize(project: any) {
  const data = project.packageData && typeof project.packageData === 'object' ? project.packageData : {};
  const workflow = data.oneWorkflow ?? {};
  const master = data.oneMaster ?? {};
  const distribution = data.oneDistribution ?? {};
  const artifacts = Array.isArray(workflow.artifacts) ? workflow.artifacts : [];
  return {
    projectId: project.id,
    workflowId: workflow.workflowId,
    brief: project.brief,
    updatedAt: project.updatedAt,
    workflowStatus: workflow.status ?? 'not-started',
    artifacts: artifacts.length,
    completed: artifacts.filter((a: any) => a.status === 'completed').length,
    failed: artifacts.filter((a: any) => a.status === 'failed').length,
    approved: artifacts.filter((a: any) => a.status === 'approved').length,
    submitted: artifacts.filter((a: any) => a.status === 'submitted').length,
    planned: artifacts.filter((a: any) => a.status === 'planned').length,
    runnable: artifacts.filter((a: any) => a.status === 'planned' && a.dependsOn.every((id: string) => artifacts.some((x: any) => x.id === id && x.status === 'completed'))).map((a: any) => a.id),
    failedArtifactIds: artifacts.filter((a: any) => a.status === 'failed').map((a: any) => a.id),
    masterStatus: master.status ?? 'not-started',
    distributionStatus: distribution.status ?? 'not-started',
    publishReady: master.status === 'approved' && distribution.status === 'approved',
    publicLive: false,
  };
}

export async function handleOneCommandCenter(request: Request, env: CreatorStorageEnv) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/one/command-center') return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'GET required' }), { status: 405 });
  const limit = Number(url.searchParams.get('limit') ?? '25');
  const projects = await listProjects(env, Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 25);
  return new Response(JSON.stringify({ schema: 'izakhono.one/command-center-v2', publicLive: false, projects: projects.map(summarize) }), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}

export const oneCommandCenterUiScript = `<section id="izo-one-command-center" style="margin:24px auto;max-width:1200px;padding:20px;border:1px solid #ddd;border-radius:16px;font-family:system-ui"><h2>IZAKHONO ONE Operations Console</h2><p>Controlled workflow operations • approvals • generation • polling • master QA • distribution • delivery</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="izo-cc-refresh">Refresh</button><span id="izo-cc-status" style="padding:6px 10px;border-radius:8px;background:#f5f5f5">Ready</span></div><div id="izo-cc-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-top:16px"></div></section><script>(async()=>{const g=document.getElementById('izo-cc-grid'),s=document.getElementById('izo-cc-status');const esc=(x)=>String(x??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));const post=async(url,body)=>{s.textContent='Working…';const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({error:'Invalid response'}));if(!r.ok)throw new Error(d.error||d.reason||('HTTP '+r.status));return d};const act=async(label,fn)=>{try{await fn();s.textContent=label;await load()}catch(e){s.textContent='Blocked: '+(e?.message||e)}};async function load(){s.textContent='Refreshing…';const r=await fetch('/api/one/command-center');const d=await r.json();g.innerHTML=(d.projects||[]).map(p=>{const buttons=[];(p.runnable||[]).forEach(id=>buttons.push('<button data-a="approve" data-id="'+esc(id)+'">Approve '+esc(id)+'</button>'));(p.failedArtifactIds||[]).forEach(id=>buttons.push('<button data-a="retry" data-id="'+esc(id)+'">Retry '+esc(id)+'</button>'));if(p.approved)buttons.push('<button data-a="execute">Execute approved</button>');if(p.submitted)buttons.push('<button data-a="poll">Poll submitted</button>');if(p.completed===p.artifacts&&p.artifacts>0&&p.masterStatus!=='approved')buttons.push('<button data-a="master">Assemble / QA</button>');if(p.masterStatus==='ready')buttons.push('<button data-a="master-approve">Approve master</button>');if(p.masterStatus==='approved'&&p.distributionStatus!=='approved')buttons.push('<button data-a="distribution">Build distribution</button>');if(p.distributionStatus==='ready')buttons.push('<button data-a="distribution-approve">Approve distribution</button>');if(p.publishReady)buttons.push('<button data-a="publish">Create delivery package</button>');return '<article style="padding:16px;border:1px solid #ddd;border-radius:12px"><b>'+esc(p.brief||p.projectId)+'</b><p>Workflow: '+esc(p.workflowStatus)+'<br>Artifacts: '+p.completed+'/'+p.artifacts+' completed • '+p.approved+' approved • '+p.submitted+' submitted • '+p.failed+' failed<br>Master: '+esc(p.masterStatus)+'<br>Distribution: '+esc(p.distributionStatus)+'<br><strong>'+(p.publishReady?'Delivery ready':'Operator action required')+'</strong></p><div style="display:flex;gap:6px;flex-wrap:wrap">'+buttons.join('')+'</div></article>'}).join('')||'<p>No workflows yet.</p>';g.querySelectorAll('button').forEach(b=>b.onclick=async()=>{const a=b.dataset.a,id=b.dataset.id,w=b.closest('article')?.querySelector('b')?.textContent;const p=(d.projects||[]).find(x=>(x.brief||x.projectId)===w);if(!p)return;await act('Action complete',async()=>{if(a==='approve')return post('/api/one/workflow/'+p.workflowId+'/approve',{projectId:p.projectId,artifactId:id});if(a==='retry')return post('/api/one/workflow/'+p.workflowId+'/retry',{projectId:p.projectId,artifactId:id,confirm:true});if(a==='execute'){const target=p.runnable?.[0];if(!target)throw new Error('No runnable artifact');return post('/api/one/workflow/'+p.workflowId+'/execute',{projectId:p.projectId,artifactId:target})}if(a==='master'||a==='master-approve')return post('/api/one/workflow/'+p.workflowId+'/master',{projectId:p.projectId,...(a==='master-approve'?{approve:true}:{})});if(a==='distribution'||a==='distribution-approve')return post('/api/one/workflow/'+p.workflowId+'/distribution',{projectId:p.projectId,...(a==='distribution-approve'?{approve:true}:{})});if(a==='publish')return post('/api/one/workflow/'+p.workflowId+'/publish',{projectId:p.projectId});if(a==='poll')throw new Error('Polling requires a tracked provider job; use the asset/provider job details in the project record.');})});}document.getElementById('izo-cc-refresh').onclick=load;load()})()</script>`;

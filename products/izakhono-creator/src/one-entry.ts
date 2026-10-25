import creator from './index';
import { handleOneWorkflow } from './one-workflow-api';
import { handleOneWorkflowExecution } from './one-workflow-execution';
import { handleOneMasterAssembly } from './one-master-assembly';
import { handleOneDistribution } from './one-distribution';
import { oneWorkflowUiScript } from './one-workflow-ui';
import { publishApprovedDistribution } from './one-publish-runtime';
import { getProject } from './project-store';

type WorkerEnv = Parameters<typeof creator.fetch>[1] & { ONE_PUBLISH_WEBHOOK_URL?: string; ONE_PUBLISH_SECRET?: string };

async function handleOnePublish(request: Request, env: WorkerEnv, path: string) {
  if (request.method === 'OPTIONS') return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'api' || parts[1] !== 'one' || parts[2] !== 'workflow' || !parts[3] || parts[4] !== 'publish') return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'POST required' }), { status: 405 });
  const body = await request.json().catch(() => ({})) as { projectId?: string };
  if (!body.projectId) return new Response(JSON.stringify({ error: 'projectId is required' }), { status: 400 });
  const project = await getProject(env, body.projectId);
  if (!project) return new Response(JSON.stringify({ error: 'project not found' }), { status: 404 });
  const packageData = project.packageData && typeof project.packageData === 'object' ? project.packageData as Record<string, unknown> : {};
  const workflow = packageData.oneWorkflow as Parameters<typeof publishApprovedDistribution>[0]['workflow'] | undefined;
  const master = packageData.oneMaster as Parameters<typeof publishApprovedDistribution>[0]['master'] | undefined;
  const distribution = packageData.oneDistribution as Parameters<typeof publishApprovedDistribution>[0]['distribution'] | undefined;
  if (!workflow || workflow.workflowId !== parts[3] || !master || !distribution) return new Response(JSON.stringify({ error: 'workflow distribution package not found' }), { status: 404 });
  const results = await publishApprovedDistribution({ workflowId: workflow.workflowId, projectId: body.projectId, channel: 'download', workflow, master, distribution }, env);
  return new Response(JSON.stringify({ workflowId: workflow.workflowId, publicLive: false, results }), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if ((request.method === 'POST' || request.method === 'GET' || request.method === 'OPTIONS') && url.pathname.startsWith('/api/one/workflow')) {
      if (/^\/api\/one\/workflow\/[^/]+\/publish$/.test(url.pathname)) return handleOnePublish(request, env, url.pathname);
      if (/^\/api\/one\/workflow\/[^/]+\/distribution$/.test(url.pathname)) return handleOneDistribution(request, env, url.pathname);
      if (/^\/api\/one\/workflow\/[^/]+\/master$/.test(url.pathname)) return handleOneMasterAssembly(request, env, url.pathname);
      if (/^\/api\/one\/workflow\/[^/]+\/(approve|execute|poll)$/.test(url.pathname)) return handleOneWorkflowExecution(request, env, url.pathname);
      return handleOneWorkflow(request, env, url.pathname);
    }
    const response = await creator.fetch(request, env, ctx);
    if (request.method === 'GET' && url.pathname === '/' && response.headers.get('content-type')?.includes('text/html')) {
      const html = await response.text();
      return new Response(html.replace('</body>', oneWorkflowUiScript + '</body>'), { status: response.status, headers: response.headers });
    }
    return response;
  },
};

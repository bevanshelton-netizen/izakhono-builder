import creator from './index';
import { handleOneWorkflow } from './one-workflow-api';
import { handleOneWorkflowExecution } from './one-workflow-execution';
import { handleOneMasterAssembly } from './one-master-assembly';
import { oneWorkflowUiScript } from './one-workflow-ui';

type WorkerEnv = Parameters<typeof creator.fetch>[1];

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if ((request.method === 'POST' || request.method === 'GET' || request.method === 'OPTIONS') && url.pathname.startsWith('/api/one/workflow')) {
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

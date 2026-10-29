type BridgeEnv = any;

const TOOLS = [
  {
    name: 'izakhono_execution_status',
    description: 'Read the IZAKHONO continuous-execution contract, current builder projects, and the current external gates. Read-only.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'izakhono_list_projects',
    description: 'List current IZAKHONO Builder projects and their build status. Read-only.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'izakhono_get_project',
    description: 'Read one IZAKHONO Builder project by id or slug. Read-only.',
    inputSchema: {
      type: 'object',
      properties: { project: { type: 'string', description: 'Project id or slug.' } },
      required: ['project'],
    },
  },
  {
    name: 'izakhono_build_anything',
    description: 'Create an IZAKHONO Builder project from an owner-approved build brief and run its controlled autopilot build. Public release remains gated.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'What should be built.' },
        target: { type: 'string', enum: ['app', 'website', 'game', 'software'] },
        name: { type: 'string' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'izakhono_autopilot_project',
    description: 'Run an existing IZAKHONO Builder project through plan, generation, validation, internal repository commit and release-candidate preparation. Does not publish publicly.',
    inputSchema: {
      type: 'object',
      properties: { project: { type: 'string', description: 'Project id or slug.' } },
      required: ['project'],
    },
  },
  {
    name: 'izakhono_validate_project',
    description: 'Run generated-bundle validation for a project. Public launch claims are not implied by validation.',
    inputSchema: {
      type: 'object',
      properties: { project: { type: 'string', description: 'Project id.' } },
      required: ['project'],
    },
  },
  {
    name: 'izakhono_record_execution_evidence',
    description: 'Record concise execution evidence against a Builder project for audit continuity.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project id.' },
        event: { type: 'string', description: 'Short event name.' },
        detail: { type: 'string', description: 'Evidence detail, excluding secrets.' },
      },
      required: ['project', 'event', 'detail'],
    },
  },
];

function json(data: unknown, status = 200, headers?: HeadersInit) {
  const h = new Headers(headers);
  h.set('content-type', 'application/json; charset=utf-8');
  h.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers: h });
}

function textResult(data: unknown, isError = false) {
  return {
    content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function rpc(id: unknown, result: unknown) {
  return json({ jsonrpc: '2.0', id, result });
}

function rpcError(id: unknown, code: number, message: string, data?: unknown) {
  return json({ jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } });
}

function bearer(req: Request) {
  const value = req.headers.get('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function authorized(req: Request, env: BridgeEnv) {
  const configured = String(env.MCP_BRIDGE_TOKEN || env.ADMIN_SECRET || '').trim();
  if (!configured) return false;
  const supplied = bearer(req) || String(req.headers.get('x-admin-secret') || '').trim();
  return Boolean(supplied && supplied === configured);
}

function projectSelector(value: unknown) {
  return String(value || '').trim().slice(0, 120);
}

async function projectBySelector(env: BridgeEnv, selector: string) {
  return env.DB.prepare('SELECT * FROM builder_projects WHERE id=? OR slug=? LIMIT 1')
    .bind(selector, selector.toLowerCase()).first<any>();
}

function compact(project: any) {
  let modules: any[] = [];
  let recipe: any = null;
  try { modules = JSON.parse(project?.modules_json || '[]'); } catch {}
  try { recipe = project?.build_recipe_json ? JSON.parse(project.build_recipe_json) : null; } catch {}
  return {
    id: project?.id,
    name: project?.name,
    slug: project?.slug,
    category: project?.category,
    status: project?.status,
    modules,
    updated_at: project?.updated_at,
    release_candidate: recipe?.release_candidate || null,
    next_gate: recipe?.generated?.next_gate || recipe?.next_gate || null,
  };
}

async function internalRequest(req: Request, env: BridgeEnv, pathname: string, method: string, body?: unknown) {
  const url = new URL(req.url);
  url.pathname = pathname;
  url.search = '';
  const headers = new Headers(req.headers);
  headers.set('x-admin-secret', String(env.ADMIN_SECRET || bearer(req)));
  headers.set('content-type', 'application/json');
  return new Request(url.toString(), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

async function callRoute(route: (request: Request, env: BridgeEnv, url: URL) => Promise<Response | null>, req: Request, env: BridgeEnv, pathname: string, method: string, body?: unknown) {
  const request = await internalRequest(req, env, pathname, method, body);
  return route(request, env, new URL(request.url));
}

async function toolCall(name: string, args: any, req: Request, env: BridgeEnv): Promise<any> {
  if (name === 'izakhono_execution_status') {
    const rows = await env.DB.prepare('SELECT * FROM builder_projects ORDER BY updated_at DESC LIMIT 50').all<any>();
    return textResult({
      schema: 'izakhono.autonomy/mcp-bridge-v1',
      mode: 'continuous',
      objective: 'Execute approved IZAKHONO builds without requiring repeated NEXT prompts.',
      lifecycle: ['planning','architecture','design','development','integration','testing','security','deployment','verification','documentation','monetisation','launch','handover'],
      builder_contract: 'OBJECTIVE -> PLAN -> BUILD -> TEST -> REPAIR -> VERIFY -> PROMOTE -> NEXT TASK',
      policy: { autoAdvance: true, productionClaimsRequireEvidence: true, externalGates: ['credentials','financial_authorization','physical_infrastructure','security_exception','builder_connection'] },
      current_builder_projects: (rows.results || []).map(compact),
      current_external_gate: 'builder-connection',
      release_truth: 'A generated or validated build is not represented as publicly live until deployment and acceptance evidence exist.',
    });
  }

  if (name === 'izakhono_list_projects') {
    const rows = await env.DB.prepare('SELECT * FROM builder_projects ORDER BY updated_at DESC LIMIT 100').all<any>();
    return textResult({ ok: true, projects: (rows.results || []).map(compact) });
  }

  if (name === 'izakhono_get_project') {
    const selector = projectSelector(args?.project);
    if (!selector) return textResult({ error: 'project is required' }, true);
    const project = await projectBySelector(env, selector);
    if (!project) return textResult({ error: 'Project not found' }, true);
    const events = await env.DB.prepare('SELECT event_type,detail,created_at FROM builder_events WHERE project_id=? ORDER BY created_at DESC LIMIT 30').bind(project.id).all<any>();
    return textResult({ ok: true, project: compact(project), events: events.results || [] });
  }

  if (name === 'izakhono_record_execution_evidence') {
    const projectId = projectSelector(args?.project);
    const event = String(args?.event || '').trim().slice(0, 100);
    const detail = String(args?.detail || '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 1200);
    if (!projectId || !event || !detail) return textResult({ error: 'project, event and detail are required' }, true);
    const project = await projectBySelector(env, projectId);
    if (!project) return textResult({ error: 'Project not found' }, true);
    await env.DB.prepare('INSERT INTO builder_events(id,project_id,event_type,detail) VALUES(?,?,?,?)')
      .bind(`evt_${crypto.randomUUID().replaceAll('-', '')}`, project.id, `mcp.${event}`, detail).run();
    return textResult({ ok: true, recorded: true, project_id: project.id, event: `mcp.${event}` });
  }

  if (name === 'izakhono_build_anything') {
    const prompt = String(args?.prompt || '').trim();
    if (prompt.length < 8) return textResult({ error: 'prompt must be at least 8 characters' }, true);
    const body: any = { prompt, target: args?.target, name: args?.name };
    const route = await import('./sovereign-route-proxy').catch(() => null);
    if (!route) return textResult({ error: 'Builder route bridge unavailable' }, true);
    const response = await route.buildAnything(req, env, body);
    const data = await response.json().catch(() => ({}));
    return textResult(data, !response.ok);
  }

  if (name === 'izakhono_autopilot_project') {
    const selector = projectSelector(args?.project);
    const project = await projectBySelector(env, selector);
    if (!project) return textResult({ error: 'Project not found' }, true);
    const route = await import('./sovereign-route-proxy').catch(() => null);
    if (!route) return textResult({ error: 'Builder autopilot bridge unavailable' }, true);
    const response = await route.autopilot(req, env, project.id);
    const data = await response.json().catch(() => ({}));
    return textResult(data, !response.ok);
  }

  if (name === 'izakhono_validate_project') {
    const selector = projectSelector(args?.project);
    const project = await projectBySelector(env, selector);
    if (!project) return textResult({ error: 'Project not found' }, true);
    const request = await internalRequest(req, env, `/api/projects/${encodeURIComponent(project.id)}/validate-generated`, 'POST');
    const response = await fetch(request);
    const data = await response.json().catch(() => ({}));
    return textResult(data, !response.ok);
  }

  return textResult({ error: `Unknown tool: ${name}` }, true);
}

export async function mcpBridgeRoute(req: Request, env: BridgeEnv, url: URL): Promise<Response | null> {
  if (url.pathname !== '/mcp' && url.pathname !== '/mcp/') return null;
  if (req.method === 'OPTIONS') return json({ ok: true }, 204, { 'access-control-allow-methods': 'POST,OPTIONS', 'access-control-allow-headers': 'authorization,content-type,mcp-protocol-version' });
  if (req.method !== 'POST') return json({ error: 'MCP endpoint accepts POST only' }, 405, { allow: 'POST, OPTIONS' });
  if (!authorized(req, env)) return json({ error: 'Unauthorized MCP bridge' }, 401, { 'www-authenticate': 'Bearer' });

  let message: any;
  try { message = await req.json(); } catch { return rpcError(null, -32700, 'Parse error'); }
  const id = message?.id ?? null;
  const method = String(message?.method || '');
  const params = message?.params || {};

  if (method === 'ping') return rpc(id, {});

  if (method === 'initialize') {
    return rpc(id, {
      protocolVersion: '2025-11-25',
      capabilities: { tools: {} },
      serverInfo: { name: 'IZAKHONO Continuous Builder Bridge', version: '1.0.0' },
      instructions: 'Use the IZAKHONO Builder tools to inspect, build, validate and record evidence. Continue approved work without asking the owner for NEXT. Stop only at genuine external gates.',
    });
  }

  if (method === 'server/discover') {
    return rpc(id, {
      protocolVersion: '2026-07-28',
      capabilities: { tools: {} },
      serverInfo: { name: 'IZAKHONO Continuous Builder Bridge', version: '1.0.0' },
    });
  }

  if (method === 'tools/list') return rpc(id, { tools: TOOLS });

  if (method === 'tools/call') {
    const name = String(params?.name || '');
    const args = params?.arguments || {};
    try {
      return rpc(id, await toolCall(name, args, req, env));
    } catch (error: any) {
      return rpc(id, textResult({ error: String(error?.message || error).slice(0, 800) }, true));
    }
  }

  if (method.endsWith('initialized') || method.startsWith('notifications/')) return new Response(null, { status: 202 });
  return rpcError(id, -32601, `Method not found: ${method}`);
}

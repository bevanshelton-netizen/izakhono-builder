type BridgeEnv = any;

const TOOLS = [
  { name: 'izakhono_execution_status', description: 'Read the IZAKHONO continuous-execution contract, current Builder projects and external gates.', inputSchema: { type: 'object', properties: {} } },
  { name: 'izakhono_list_projects', description: 'List IZAKHONO Builder projects and build status.', inputSchema: { type: 'object', properties: {} } },
  { name: 'izakhono_get_project', description: 'Read one IZAKHONO Builder project by id or slug.', inputSchema: { type: 'object', properties: { project: { type: 'string' } }, required: ['project'] } },
  { name: 'izakhono_build_anything', description: 'Create an IZAKHONO Builder project from an approved brief and run its controlled build. Public release remains gated.', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, target: { type: 'string', enum: ['app','website','game','software'] }, name: { type: 'string' } }, required: ['prompt'] } },
  { name: 'izakhono_autopilot_project', description: 'Run an existing Builder project through plan, generation, validation, internal repository commit and release-candidate preparation.', inputSchema: { type: 'object', properties: { project: { type: 'string' } }, required: ['project'] } },
  { name: 'izakhono_validate_project', description: 'Run generated-bundle validation for a Builder project.', inputSchema: { type: 'object', properties: { project: { type: 'string' } }, required: ['project'] } },
  { name: 'izakhono_record_execution_evidence', description: 'Record concise execution evidence against a Builder project for audit continuity.', inputSchema: { type: 'object', properties: { project: { type: 'string' }, event: { type: 'string' }, detail: { type: 'string' } }, required: ['project','event','detail'] } },
];

function json(data: unknown, status = 200, headers?: HeadersInit) {
  const h = new Headers(headers); h.set('content-type', 'application/json; charset=utf-8'); h.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers: h });
}
function textResult(data: unknown, isError = false) { return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }], ...(isError ? { isError: true } : {}) }; }
function rpc(id: unknown, result: unknown) { return json({ jsonrpc: '2.0', id, result }); }
function rpcError(id: unknown, code: number, message: string) { return json({ jsonrpc: '2.0', id, error: { code, message } }); }
function bearer(req: Request) { const value = req.headers.get('authorization') || ''; return value.startsWith('Bearer ') ? value.slice(7).trim() : ''; }
function authorized(req: Request, env: BridgeEnv) { const configured = String(env.MCP_BRIDGE_TOKEN || env.ADMIN_SECRET || '').trim(); const supplied = bearer(req) || String(req.headers.get('x-admin-secret') || '').trim(); return Boolean(configured && supplied && supplied === configured); }
function selector(value: unknown) { return String(value || '').trim().slice(0, 120); }
async function projectBySelector(env: BridgeEnv, value: string) { return env.DB.prepare('SELECT * FROM builder_projects WHERE id=? OR slug=? LIMIT 1').bind(value, value.toLowerCase()).first<any>(); }
function compact(project: any) {
  let modules: any[] = []; let recipe: any = null;
  try { modules = JSON.parse(project?.modules_json || '[]'); } catch {}
  try { recipe = project?.build_recipe_json ? JSON.parse(project.build_recipe_json) : null; } catch {}
  return { id: project?.id, name: project?.name, slug: project?.slug, category: project?.category, status: project?.status, modules, updated_at: project?.updated_at, release_candidate: recipe?.release_candidate || null, next_gate: recipe?.generated?.next_gate || recipe?.next_gate || null };
}
async function selfFetch(req: Request, env: BridgeEnv, pathname: string, method: string, body?: unknown) {
  const url = new URL(req.url); url.pathname = pathname; url.search = '';
  const headers = new Headers(req.headers); headers.set('x-admin-secret', String(env.ADMIN_SECRET || bearer(req))); headers.set('content-type', 'application/json');
  return fetch(new Request(url.toString(), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
}

async function toolCall(name: string, args: any, req: Request, env: BridgeEnv) {
  if (name === 'izakhono_execution_status') {
    const rows = await env.DB.prepare('SELECT * FROM builder_projects ORDER BY updated_at DESC LIMIT 50').all<any>();
    return textResult({ schema: 'izakhono.autonomy/mcp-bridge-v1', mode: 'continuous', objective: 'Execute approved IZAKHONO builds without repeated NEXT prompts.', lifecycle: ['planning','architecture','design','development','integration','testing','security','deployment','verification','documentation','monetisation','launch','handover'], builder_contract: 'OBJECTIVE -> PLAN -> BUILD -> TEST -> REPAIR -> VERIFY -> PROMOTE -> NEXT TASK', policy: { autoAdvance: true, productionClaimsRequireEvidence: true, externalGates: ['credentials','financial_authorization','physical_infrastructure','security_exception','builder_connection'] }, current_builder_projects: (rows.results || []).map(compact), current_external_gate: 'builder-connection', release_truth: 'Generated or validated does not mean publicly live; deployment and acceptance evidence are required.' });
  }
  if (name === 'izakhono_list_projects') {
    const rows = await env.DB.prepare('SELECT * FROM builder_projects ORDER BY updated_at DESC LIMIT 100').all<any>();
    return textResult({ ok: true, projects: (rows.results || []).map(compact) });
  }
  if (name === 'izakhono_get_project') {
    const p = await projectBySelector(env, selector(args?.project)); if (!p) return textResult({ error: 'Project not found' }, true);
    const events = await env.DB.prepare('SELECT event_type,detail,created_at FROM builder_events WHERE project_id=? ORDER BY created_at DESC LIMIT 30').bind(p.id).all<any>();
    return textResult({ ok: true, project: compact(p), events: events.results || [] });
  }
  if (name === 'izakhono_record_execution_evidence') {
    const p = await projectBySelector(env, selector(args?.project)); const event = String(args?.event || '').trim().slice(0, 100); const detail = String(args?.detail || '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 1200);
    if (!p || !event || !detail) return textResult({ error: 'project, event and detail are required' }, true);
    await env.DB.prepare('INSERT INTO builder_events(id,project_id,event_type,detail) VALUES(?,?,?,?)').bind(`evt_${crypto.randomUUID().replaceAll('-', '')}`, p.id, `mcp.${event}`, detail).run();
    return textResult({ ok: true, recorded: true, project_id: p.id, event: `mcp.${event}` });
  }
  if (name === 'izakhono_build_anything') {
    const prompt = String(args?.prompt || '').trim(); if (prompt.length < 8) return textResult({ error: 'prompt must be at least 8 characters' }, true);
    const response = await selfFetch(req, env, '/api/build-anything', 'POST', { prompt, target: args?.target, name: args?.name });
    const data = await response.json().catch(() => ({})); return textResult(data, !response.ok);
  }
  if (name === 'izakhono_autopilot_project') {
    const p = await projectBySelector(env, selector(args?.project)); if (!p) return textResult({ error: 'Project not found' }, true);
    const response = await selfFetch(req, env, `/api/projects/${encodeURIComponent(p.id)}/autopilot`, 'POST');
    const data = await response.json().catch(() => ({})); return textResult(data, !response.ok);
  }
  if (name === 'izakhono_validate_project') {
    const p = await projectBySelector(env, selector(args?.project)); if (!p) return textResult({ error: 'Project not found' }, true);
    const response = await selfFetch(req, env, `/api/projects/${encodeURIComponent(p.id)}/validate-generated`, 'POST');
    const data = await response.json().catch(() => ({})); return textResult(data, !response.ok);
  }
  return textResult({ error: `Unknown tool: ${name}` }, true);
}

export async function mcpBridgeRoute(req: Request, env: BridgeEnv, url: URL): Promise<Response | null> {
  if (url.pathname !== '/mcp' && url.pathname !== '/mcp/') return null;
  if (req.method === 'OPTIONS') return json({ ok: true }, 204, { 'access-control-allow-methods': 'POST,OPTIONS', 'access-control-allow-headers': 'authorization,content-type,mcp-protocol-version' });
  if (req.method !== 'POST') return json({ error: 'MCP endpoint accepts POST only' }, 405, { allow: 'POST, OPTIONS' });
  if (!authorized(req, env)) return json({ error: 'Unauthorized MCP bridge' }, 401, { 'www-authenticate': 'Bearer' });
  let message: any; try { message = await req.json(); } catch { return rpcError(null, -32700, 'Parse error'); }
  const id = message?.id ?? null; const method = String(message?.method || ''); const params = message?.params || {};
  if (method === 'ping') return rpc(id, {});
  if (method === 'initialize') return rpc(id, { protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'IZAKHONO Continuous Builder Bridge', version: '1.0.0' }, instructions: 'Use the IZAKHONO Builder tools to inspect, build, validate and record evidence. Continue approved work without asking the owner for NEXT. Stop only at genuine external gates.' });
  if (method === 'server/discover') return rpc(id, { protocolVersion: '2026-07-28', capabilities: { tools: {} }, serverInfo: { name: 'IZAKHONO Continuous Builder Bridge', version: '1.0.0' } });
  if (method === 'tools/list') return rpc(id, { tools: TOOLS });
  if (method === 'tools/call') { try { return rpc(id, await toolCall(String(params?.name || ''), params?.arguments || {}, req, env)); } catch (error: any) { return rpc(id, textResult({ error: String(error?.message || error).slice(0, 800) }, true)); } }
  if (method.endsWith('initialized') || method.startsWith('notifications/')) return new Response(null, { status: 202 });
  return rpcError(id, -32601, `Method not found: ${method}`);
}

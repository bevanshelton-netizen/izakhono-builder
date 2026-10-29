import sovereign from './sovereign';
import { mcpBridgeRoute } from './mcp-bridge';

export default {
  async fetch(req: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const bridge = await mcpBridgeRoute(req, env, url);
    if (bridge) return bridge;
    return sovereign.fetch(req, env, ctx);
  },
};

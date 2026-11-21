export interface Env { ASSETS: Fetcher; APP_ENV: string; PUBLIC_LIVE: string }
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options","nosniff");
    headers.set("Referrer-Policy","strict-origin-when-cross-origin");
    headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
    headers.set("X-Frame-Options","DENY");
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};

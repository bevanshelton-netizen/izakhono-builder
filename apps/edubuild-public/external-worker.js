export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") {
      return new Response("OK\n", {
        status: 200,
        headers: {"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}
      });
    }
    if (url.pathname === "/api/status") {
      return Response.json({
        service: "edubuild-public-gateway",
        institution: "Edu-Build Institute – Shelton Campuses",
        mode: "public-information-only",
        qualification: {saqa_id:"97542",nqf_level:4,credits:131},
        tracking: false,
        analytics: false,
        learner_writes: false,
        payment_writes: false
      }, {headers: {"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
    }
    if (url.pathname.startsWith("/api/")) {
      return Response.json({error:"protected_owned_engine_required"}, {
        status:503,
        headers: {"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
      });
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options","nosniff");
    headers.set("X-Frame-Options","DENY");
    headers.set("Referrer-Policy","strict-origin-when-cross-origin");
    headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=(), payment=()");
    headers.set("Content-Security-Policy","default-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};

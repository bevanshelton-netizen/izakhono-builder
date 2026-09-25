export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return new Response("OK\n", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    }

    if (url.pathname === "/api/v1/status") {
      return Response.json({
        service: "izakhono-digital-finance",
        product: "IZAKHONO Digital Finance Academy",
        operator: "IZAKHONO AFRICA (PTY) LTD",
        engine: "external-static-resilience",
        mode: "external-resilience",
        status: "EXTERNAL ROUTE CANDIDATE",
        tracking: false,
        analytics: false,
        learner_writes: false,
        payment: {
          enabled: false,
          gateway: "iKhokha",
          state: "GATED_PENDING_VERIFIED_PRODUCT_CHECKOUT"
        },
        note: "This external bridge serves the public learning and institutional experience only. Protected workforce automation remains on the owned engine."
      }, {
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    if (
      url.pathname.startsWith("/api/v1/admin/") ||
      url.pathname === "/api/v1/automation/evaluate" ||
      url.pathname.startsWith("/api/v1/learner/")
    ) {
      return Response.json({
        error: "protected_owned_engine_required",
        message: "This external resilience route does not accept learner, administrative, assessment or payment writes."
      }, {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()");
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};

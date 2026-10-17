/**
 * Figure Cloud Worker entry point.
 *
 * This Worker serves the existing static frontend and gives clear responses
 * for backend routes whose original server implementation was not included
 * in the supplied source files. It deliberately does not fabricate account
 * tokens or pretend a game-stream session was created.
 */
function jsonResponse(status, body) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function unavailable(code, message) {
  return jsonResponse(503, {
    success: false,
    error: code,
    message
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let pathname = url.pathname;
    while (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);

    if (pathname === "/_health") {
      return jsonResponse(200, {
        ok: true,
        service: "Figure Cloud static frontend",
        accountServiceConfigured: false,
        gameSessionServiceConfigured: false,
        note: "Static assets are available. Account-token and streaming backends still need an authorized provider integration."
      });
    }

    if (pathname === "/api/auto-signup") {
      return unavailable(
        "ACCOUNT_SERVICE_NOT_CONFIGURED",
        "Automatic guest-account creation is not configured. The original source archive did not include the server-side account service. Connect a provider-supported API or an authorized backend before enabling this feature."
      );
    }

    if (pathname === "/api/login") {
      return unavailable(
        "FIGURE_CLOUD_LOGIN_NOT_CONFIGURED",
        "Figure Cloud's own login service is not configured on this deployment. Do not enter provider passwords into this form; use the official provider sign-in page instead."
      );
    }

    if (pathname === "/api/credits") {
      return unavailable(
        "ACCOUNT_SERVICE_NOT_CONFIGURED",
        "Account balance lookup requires the missing Figure Cloud account backend."
      );
    }

    if (pathname === "/play") {
      return unavailable(
        "GAME_SESSION_SERVICE_NOT_CONFIGURED",
        "The cloud-session streaming backend is not configured. Use a verified direct provider launch when available, or connect the authorized streaming backend."
      );
    }

    if (pathname.startsWith("/api/")) {
      return unavailable(
        "API_ROUTE_NOT_CONFIGURED",
        "This API route is not implemented in the supplied source files."
      );
    }

    if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return new Response(
        "Static asset binding ASSETS is missing. Check wrangler.jsonc.",
        { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    return env.ASSETS.fetch(request);
  }
};

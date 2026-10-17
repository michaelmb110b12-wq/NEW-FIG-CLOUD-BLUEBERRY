# Hostless setup: Figure Cloud backend + Scramjet/Epoxy browser

Use the existing Hostless backend project and preserve its current URL:

**https://blueberry-cloud-figure.hostless.app/**

Do not create a new Hostless app for the proxy. Do not switch the existing app's working directory to `/hostless-proxy`; the proxy is integrated into the existing backend app so the cloud API stays available.

Use branch:
https://github.com/michaelmb110b12-wq/NEW-FIG-CLOUD-BLUEBERRY/tree/hostless-cloud-integration

## Existing Hostless app settings

Keep the existing app's current repository/branch connection if it already points at this repo and branch. Its working directory should remain `/hostless-backend`.

- Working directory: `/hostless-backend`
- Build command: `npm install`
- Start command: `npm start`
- Health-check path: `/healthz`
- Node.js: 20 or newer
- Required WebSocket upgrade route for Scramjet: `/wisp/`

Deploy this branch to the **same existing Hostless app**. The expanded `hostless-backend/package.json` adds the Scramjet and Epoxy runtime packages; the backend now serves the proxy frontend and static runtime assets on the same HTTP server, while preserving its existing `/api/cloud/*` API and signaling routes.

## Test the same URL

Health check (now includes proxy status):
https://blueberry-cloud-figure.hostless.app/healthz

Auto-load Google through Scramjet + Epoxy:
https://blueberry-cloud-figure.hostless.app/?url=https%3A%2F%2Fwww.google.com%2F

Auto-load a game or other permitted URL by putting its encoded destination in the `url` query parameter. The proxy also uses `/wisp/` over WebSocket, which Hostless must allow.

## Existing backend/provider configuration

Keep the existing environment variables on the existing app:
- `STRATUS_UPSTREAM_URL`: HTTPS base URL for a compatible cloud backend you own or are authorized to use.
- `STRATUS_UPSTREAM_TOKEN`: optional upstream bearer token.
- `CORS_ORIGINS`: comma-separated allowed frontend origins.
- `UPSTREAM_TIMEOUT_MS`: defaults to `30000`.

The existing provider API bridge remains available. Proxy capability does not itself create game sessions or provide a provider-specific WebRTC streaming service. The cloud provider must still be configured and authorized.

## Figure Cloud frontend

The Figure Cloud Browser tab, game-launch fallback, RaccoonGame login tutorial, and Emailnator tutorial now target the same backend URL, `https://blueberry-cloud-figure.hostless.app/`. Known game URLs are passed with `?url=` so the new proxy page can load them automatically without opening a new browser tab.

The proxy files are stored under `hostless-proxy/`, but those files are served by the existing backend server. That folder is source assets, **not the existing Hostless app working directory**.

# Figure Cloud

This repository contains the Figure Cloud static frontend, game catalogue, and a Cloudflare Workers deployment setup.

## Cloudflare Workers deployment

The `fixes` branch includes:

- `index.html`, which redirects the Worker root URL to `main.html`.
- `worker.js`, a Cloudflare Worker entry point that serves static assets and returns explicit responses for backend routes that are not implemented.
- `wrangler.jsonc`, which configures static assets and routes `/api/*` and `/play*` through the Worker.
- `package.json`, with Wrangler local-preview and deploy commands.
- `.assetsignore`, which excludes Worker configuration files from the static asset bundle.

### Deploy through Cloudflare's Git integration

1. In Cloudflare, open **Workers & Pages** and choose **Create application**, then import a Git repository.
2. Select `michaelmb110b12-wq/NEW-FIG-CLOUD-BLUEBERRY` and choose the **`fixes` branch**.
3. Use the repository root as the project root. The Wrangler configuration is already in that directory.
4. Make sure the Worker name matches `new-fig-cloud-blueberry` in `wrangler.jsonc`, then deploy. Cloudflare Workers Builds defaults to `npx wrangler deploy` when no custom deploy command is set.

For local development with Node.js installed, run `npm install`, then `npm run dev`. To deploy from a logged-in Wrangler CLI session, run `npm run deploy`.

Once deployed, open the Worker URL. The `/_health` endpoint reports whether the static frontend is up and makes it explicit that the account and streaming services are not configured.

## Game launch behavior

The `fixes` branch adds `random/legacy-urls.js`, matching catalogue keys to verified detail-page URLs from the older working project at https://github.com/michaelmb110b12-wq/Cine-Cloud-SRC.

The game details window provides two launch choices:

- **Open normally** — use the site's normal game view on desktop or the direct provider page on mobile.
- **Open in about:blank** — open a blank tab first and load the verified provider page within it. The browser must allow pop-ups, and a provider may prevent its page from running inside an iframe; use normal mode if that happens.

Titles without a verified mapping are not assigned guessed IDs. The UI explains that the streaming backend is needed for those titles.

## Account creation and streaming limitations

The source archive supplied for this project contains front-end files but no original server implementation for account generation or streaming.

The frontend contains calls to `/api/auto-signup`, `/api/login`, `/api/credits`, and `/play?gid=...`. The Cloudflare Worker intentionally returns clear `503 Service Unavailable` responses for those routes instead of pretending that tokens or cloud sessions were created. The Figure Cloud email/password form is disabled until its own backend is configured.

Hosting this Worker makes the static website and explicit API routes available, but **does not by itself implement automatic guest-account creation or cloud-game streaming**. Those functions require a provider-supported API or another backend the site is authorized to use. The account panel links users to the official Raccoon Game login/registration page for provider accounts. Do not enter provider passwords into Figure Cloud's disabled login form.

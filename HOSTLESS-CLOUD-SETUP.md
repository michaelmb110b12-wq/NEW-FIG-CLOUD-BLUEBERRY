# Hostless setup: Figure Cloud + Scramjet/Epoxy

Use branch: hostless-cloud-integration. The main branch is not changed.

## Reuse your existing Scramjet Hostless URL

This repository includes the auto-loading Scramjet frontend in hostless-proxy/. It uses Scramjet and Epoxy transport over the app's own Wisp WebSocket endpoint. It accepts URLs like:

https://scramjet.mercurywork.shop/?url=https%3A%2F%2Fwww.google.com%2F

To keep the same URL/domain as your existing Hostless Scramjet project, update that existing Hostless project instead of creating another app. Point its repository to michaelmb110b12-wq/NEW-FIG-CLOUD-BLUEBERRY, branch to hostless-cloud-integration, and set its working directory to /hostless-proxy. The existing project URL/custom domain stays attached to that Hostless project as long as you keep the domain assignment there.

Hostless settings:
- Build command: npm install
- Start command: npm start
- Health-check path: /healthz
- Node.js: 20 or newer
- Required WebSocket upgrade route: /wisp/

After deploying, test https://scramjet.mercurywork.shop/healthz. It should return JSON with ok true, transport epoxy, and autoLoad true.

## How automatic loading works

The browser accepts a destination through the ?url= query parameter and loads that site inside its Scramjet frame automatically. Figure Cloud's known/verified game URLs and Browser tab use this URL scheme without opening a new top-level tab. Google is the browser homepage. If a game is not in the verified URL catalogue, the frontend cannot invent a URL or a provider session ID.

The proxy requires the Wisp WebSocket route to work. If /healthz works but pages do not load, verify that Hostless permits WebSocket upgrades and that /wisp/ is available.

## Existing Figure Cloud backend

The separate /hostless-backend service and its cloud-provider API bridge remain independent of this proxy app. The proxy alone does not create cloud gaming sessions or supply a provider-specific WebRTC game service. Game URLs must be valid and permitted by their providers.

## Browser tutorial

The Figure Cloud Browser tab opens Google through the proxy. Settings includes RaccoonGame Login and Emailnator panes, a tutorial-video placeholder, and a saved completion checkmark. Some sites can still block sign-in when embedded; routing through Scramjet/Epoxy may improve compatibility but does not guarantee that every site allows embedded login.
# Figure Cloud

This repository contains the static Figure Cloud front end and game catalogue.

## Why games do not launch on GitHub Pages

The catalogue is loaded from `random/gamelayout.js`, so the page can render game cards and details. Launching a session is different: `script.js` requests `/api/auto-signup` and then loads `/play?gid=...` in an iframe. These are backend routes, not files in this repository. GitHub Pages only serves static files and cannot execute those server routes, so the game session fails even though the interface looks normal.

The `fixes` branch detects the `github.io` host and explains the limitation when Play is clicked, with a link to the official [Raccoon Game](https://www.raccoongame.com/) platform. On a server-backed deployment, the original launcher is retained.

## What is required for in-page cloud gaming

To restore sessions inside this site, deploy or restore the legitimate server-side component that implements the session and streaming routes, and configure it using the provider's supported integration. Keep provider tokens and credentials on the server; do not put secrets in client-side JavaScript. GitHub Pages can continue to host the front end, but the game-session backend must run on a separate service.

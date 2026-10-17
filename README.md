# Figure Cloud

This repository contains the newer Figure Cloud interface and game catalogue.

## GitHub Pages launch compatibility

The older working project at https://github.com/michaelmb110b12-wq/Cine-Cloud-SRC loads games through their Raccoon Game detail-page URLs. The newer version changed to a session launcher that calls /api/auto-signup and /play?gid=; those are backend routes and are not provided by GitHub Pages.

The fixes branch adds random/legacy-urls.js, matching new catalogue keys to verified URLs from the older working catalogue (96 overlapping titles). GitHub Pages uses those URLs for matched games. For newer-only games, the site asks the user to open the provider platform rather than guessing an ID.

## Auto-account generation

The existing auto-account/session code remains in script.js for server-backed deployments. To use that flow, host the compatible session backend on a server-capable service and configure the front end to call it. GitHub Pages can host the front end, but cannot execute /api/auto-signup or /play itself. The legacy fallback is a compatibility path; it does not create accounts automatically.

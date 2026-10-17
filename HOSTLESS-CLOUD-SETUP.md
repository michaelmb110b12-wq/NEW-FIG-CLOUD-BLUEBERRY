# Hostless backend setup for Figure Cloud

Use this branch:
https://github.com/michaelmb110b12-wq/NEW-FIG-CLOUD-BLUEBERRY/tree/hostless-cloud-integration

## Backend app

Create a Hostless App connected to this repository and branch, with Working Directory set to `/hostless-backend`. Use auto/Nixpacks, start command `npm start`, and health-check path `/healthz`.

The server uses Hostless's injected `PORT` and binds to `0.0.0.0`. Official Hostless deployment guidance: https://docs.hostless.cloud/javascript/express

Add the optional environment variables:
- `STRATUS_UPSTREAM_URL`: HTTPS base URL for a compatible cloud backend that you own or have permission to use.
- `STRATUS_UPSTREAM_TOKEN`: optional upstream bearer token.
- `CORS_ORIGINS`: comma-separated exact origins, for example `https://michaelmb110b12-wq.github.io`. Add the origin of any custom domain. Do not include paths.
- `UPSTREAM_TIMEOUT_MS`: defaults to `30000`.

Keep this app at **one replica** while client session state is stored in memory; multiple replicas would not share cookies/session tokens.\n\nOpen your generated Hostless URL plus `/healthz`. `ok: true` means the backend is running. `providerConfigured: false` means a streaming provider has not yet been connected.

## Connect from Figure Cloud

Deploy the static site from this branch as usual. Open Settings → **Hostless Cloud Backend**, paste the Hostless app URL, and choose **Save & Test**. Choose **Load Cloud Catalog** to verify that the connected provider returns a compatible game list.

This implements configuration and catalog checks only; it is not proof of live streaming. A provider still needs to supply authorized sessions, ICE servers, and a compatible signaling/input protocol. The existing direct-link game launch remains untouched.

## MailQ

The upstream Stratus project's documented MailQ use is automated third-party account registration with disposable addresses and anti-abuse workarounds. I haven't wired that workflow into this repository. Mailbox testing for your own service can be hosted separately, but shouldn't be connected to automated third-party account creation or verification-limit evasion.

## Hostless resource note

Hostless's current overview says its Free plan includes one always-on App resource. Deploying the backend and MailQ as two separate always-on Apps may therefore require a different resource plan or another architecture: https://docs.hostless.cloud/overview

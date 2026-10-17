"use strict";
async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers. Open the HTTPS Hostless URL in a supported browser.");
  }
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

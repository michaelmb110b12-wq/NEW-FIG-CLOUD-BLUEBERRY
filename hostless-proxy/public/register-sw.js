"use strict";
const FIGURE_CLOUD_WISP_URL = "wss://scramjet-blueberry-pop-c.hostless.app/wisp";

async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers. Open the HTTPS Hostless URL in a supported browser.");
  }
  if (!window.BareMux || !window.BareMux.BareMuxConnection) {
    throw new Error("BareMux did not load. Check that /baremux/index.js is available.");
  }
  if (typeof window.$scramjetLoadController !== "function") {
    throw new Error("Scramjet did not load. Check that /scram/scramjet.all.js is available.");
  }

  // Configure Epoxy/Wisp before registering the Scramjet service worker.
  const connection = new window.BareMux.BareMuxConnection("/baremux/worker.js");
  await connection.setTransport("/epoxy/index.mjs", [{ wisp: FIGURE_CLOUD_WISP_URL }]);

  const { ScramjetController } = window.$scramjetLoadController();
  const controller = new ScramjetController({
    files: {
      all: "/scram/scramjet.all.js",
      wasm: "/scram/scramjet.wasm.wasm",
      sync: "/scram/scramjet.sync.js"
    }
  });
  await controller.init();

  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return controller;
}

window.figureCloudScramjetReady = registerSW().catch((error) => {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = "Scramjet/Wisp setup failed: " + (error && error.message ? error.message : String(error));
    status.style.color = "#ff9b9b";
  }
  throw error;
});

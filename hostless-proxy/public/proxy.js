"use strict";
const DEFAULT_HOME = "https://www.google.com/";
const form = document.getElementById("address-form");
const address = document.getElementById("address");
const statusLine = document.getElementById("status");
const stage = document.getElementById("browser-stage");
const emptyState = document.getElementById("empty-state");
let activeFrame = null;
let transportReady = false;
let controller = null;

function setStatus(message, isError = false) {
  statusLine.textContent = message;
  statusLine.style.color = isError ? "#ff9b9b" : "#aeb9ca";
}
function targetFromInput(value) {
  const input = String(value || "").trim();
  if (!input) return DEFAULT_HOME;
  try {
    const url = new URL(input);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch (_) {}
  try {
    const url = new URL("https://" + input);
    if (url.hostname.includes(".")) return url.href;
  } catch (_) {}
  return "https://www.google.com/search?q=" + encodeURIComponent(input);
}
async function prepareProxy() {
  await registerSW();
  const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
  const wispUrl = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/wisp/";
  await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
  transportReady = true;
  const { ScramjetController } = $scramjetLoadController();
  controller = new ScramjetController({
    files: {
      wasm: "/scram/scramjet.wasm.wasm",
      all: "/scram/scramjet.all.js",
      sync: "/scram/scramjet.sync.js"
    }
  });
  controller.init();
}
async function openThroughProxy(value) {
  const target = targetFromInput(value);
  address.value = target;
  if (!transportReady || !controller) await prepareProxy();
  if (activeFrame && activeFrame.frame) activeFrame.frame.remove();
  const frame = controller.createFrame();
  frame.frame.id = "sj-frame";
  frame.frame.setAttribute("allow", "autoplay; fullscreen; clipboard-read; clipboard-write; gamepad; keyboard-map");
  frame.frame.setAttribute("referrerpolicy", "no-referrer");
  stage.appendChild(frame.frame);
  if (emptyState) emptyState.style.display = "none";
  activeFrame = frame;
  setStatus("Loading through Scramjet + Epoxy: " + target);
  frame.frame.addEventListener("load", () => {
    setStatus("Proxy loaded. Some sites may still restrict embedded sign-in or certain features.");
  }, { once: true });
  frame.go(target);
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try { await openThroughProxy(address.value); }
  catch (error) { setStatus("Proxy failed to start. Confirm /wisp/ WebSocket and /healthz. " + error, true); }
});
document.getElementById("back").addEventListener("click", () => { if (activeFrame) activeFrame.back(); });
document.getElementById("forward").addEventListener("click", () => { if (activeFrame) activeFrame.forward(); });
document.getElementById("reload").addEventListener("click", () => { if (activeFrame) activeFrame.reload(); });
document.getElementById("home").addEventListener("click", () => {
  openThroughProxy(DEFAULT_HOME).catch(error => setStatus("Could not open Google: " + error, true));
});
(async function boot() {
  try {
    setStatus("Registering service worker and setting up Epoxy transport…");
    const queryUrl = new URLSearchParams(location.search).get("url");
    const firstTarget = queryUrl ? targetFromInput(queryUrl) : DEFAULT_HOME;
    address.value = firstTarget;
    await openThroughProxy(firstTarget);
  } catch (error) {
    setStatus("Proxy initialization failed: " + (error && error.message ? error.message : String(error)), true);
  }
})();

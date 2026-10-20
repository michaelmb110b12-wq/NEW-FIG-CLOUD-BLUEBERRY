"use strict";
const DEFAULT_HOME = "https://www.google.com/";
const form = document.getElementById("address-form");
const address = document.getElementById("address");
const statusLine = document.getElementById("status");

function setStatus(message, isError = false) {
  if (!statusLine) return;
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

async function openThroughScramjet(value, replace = false) {
  const target = targetFromInput(value);
  if (address) address.value = target;
  setStatus("Connecting to Scramjet using the Hostless Wisp transport…");
  try {
    const controller = await window.figureCloudScramjetReady;
    const proxiedUrl = controller.encodeUrl(target);
    setStatus("Opening " + new URL(target).hostname + " through Scramjet/Wisp…");
    if (replace) window.location.replace(proxiedUrl);
    else window.location.assign(proxiedUrl);
  } catch (error) {
    setStatus("Could not start Scramjet/Wisp: " + (error && error.message ? error.message : String(error)), true);
  }
}

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    openThroughScramjet(address ? address.value : DEFAULT_HOME);
  });
}
const back = document.getElementById("back");
const forward = document.getElementById("forward");
const reload = document.getElementById("reload");
const home = document.getElementById("home");
if (back) back.addEventListener("click", () => window.history.back());
if (forward) forward.addEventListener("click", () => window.history.forward());
if (reload) reload.addEventListener("click", () => window.location.reload());
if (home) home.addEventListener("click", () => {
  if (address) address.value = DEFAULT_HOME;
  openThroughScramjet(DEFAULT_HOME);
});

(async function boot() {
  const requested = new URLSearchParams(window.location.search).get("url");
  if (address) address.value = targetFromInput(requested || DEFAULT_HOME);
  if (requested) {
    // Game launches pass ?url=...; proxy the destination in this tab, not in an iframe.
    await openThroughScramjet(requested, true);
  } else {
    setStatus("Ready · Google.com is the starting address. Press Go to open it through Scramjet/Wisp.");
    try {
      await window.figureCloudScramjetReady;
      setStatus("Ready · Scramjet is connected to the Hostless Wisp endpoint. Google.com is the starting address.");
    } catch (_) {}
  }
})();

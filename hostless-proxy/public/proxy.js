"use strict";
const DEFAULT_HOME = "https://www.google.com/";
const SCRAMJET_APP = "https://scramjet.mercurywork.shop/";
const form = document.getElementById("address-form");
const address = document.getElementById("address");
const statusLine = document.getElementById("status");
const stage = document.getElementById("browser-stage");
const emptyState = document.getElementById("empty-state");
let proxyFrame = null;
let currentTarget = DEFAULT_HOME;

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
function openThroughProxy(value) {
  currentTarget = targetFromInput(value);
  address.value = currentTarget;

  // Use the hosted Scramjet service as the proxy. Its ?url= parameter
  // automatically opens the requested destination.
  const proxyUrl = SCRAMJET_APP + "?url=" + encodeURIComponent(currentTarget);

  if (!proxyFrame) {
    proxyFrame = document.createElement("iframe");
    proxyFrame.id = "sj-frame";
    proxyFrame.title = "Scramjet proxied website";
    proxyFrame.allow = "autoplay; fullscreen; clipboard-read; clipboard-write; gamepad";
    proxyFrame.referrerPolicy = "no-referrer";
    proxyFrame.style.cssText = "display:block;width:100%;height:100%;min-height:60vh;border:0;background:#fff;";
    stage.replaceChildren(proxyFrame);
  }
  if (emptyState) emptyState.style.display = "none";
  setStatus("Opening " + currentTarget + " through hosted Scramjet…");
  proxyFrame.onload = () => setStatus("Hosted Scramjet loaded. If the page is blank, the proxy service may block being embedded.");
  proxyFrame.onerror = () => setStatus("Could not load the hosted Scramjet service. Try opening it directly.", true);
  proxyFrame.src = proxyUrl;
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  openThroughProxy(address.value);
});
document.getElementById("back").addEventListener("click", () => {
  try { proxyFrame?.contentWindow?.history.back(); } catch (_) {}
  setStatus("Back navigation may be unavailable because the hosted proxy is on another domain.");
});
document.getElementById("forward").addEventListener("click", () => {
  try { proxyFrame?.contentWindow?.history.forward(); } catch (_) {}
  setStatus("Forward navigation may be unavailable because the hosted proxy is on another domain.");
});
document.getElementById("reload").addEventListener("click", () => openThroughProxy(currentTarget));
document.getElementById("home").addEventListener("click", () => openThroughProxy(DEFAULT_HOME));
(function boot() {
  const queryUrl = new URLSearchParams(location.search).get("url");
  openThroughProxy(queryUrl || DEFAULT_HOME);
})();

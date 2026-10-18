(() => {
  "use strict";
  const PROXY_BASE = window.FIGURE_CLOUD_SCRAMJET_BASE || "https://scramjet.mercurywork.shop/";
  const COMPLETE_KEY = "figureCloudBrowserTutorialComplete";
  const makeProxyUrl = (target) => {
    const url = new URL(PROXY_BASE);
    url.searchParams.set("url", target);
    return url.href;
  };
  const el = (tag, attrs = {}, text = "") => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text) node.textContent = text;
    return node;
  };
  function addTutorial() {
    const settings = document.querySelector("#v-set .settings-box");
    if (!settings || document.getElementById("figure-cloud-browser-tutorial")) return;
    const panel = el("section", { id: "figure-cloud-browser-tutorial", class: "fc-tutorial" });
    panel.append(
      el("h3", { class: "set-title" }, "Browser Tutorial"),
      el("p", { class: "fc-tutorial-intro" }, "RaccoonGame and Emailnator both load through Scramjet with Epoxy transport. Only use accounts and email addresses you control.")
    );
    const grid = el("div", { class: "fc-tutorial-grid" });
    const makePane = (title, target, useScramjet = true) => {
      const pane = el("section", { class: title === "RaccoonGame Login" ? "fc-tutorial-pane fc-tutorial-raccoon-pane" : "fc-tutorial-pane" });
      const top = el("div", { class: "fc-tutorial-pane-head" });
      const label = el("strong", {}, title);
      const actions = el("div", { class: "fc-tutorial-actions" });
      const reload = el("button", { type: "button", class: "fc-mini-btn" }, "Reload");
      const linkRow = el("div", { class: "fc-scramjet-linkbar" });
      linkRow.style.cssText = "display:flex;gap:8px;align-items:center;margin:8px 0;flex-wrap:wrap;";
      const linkInput = el("input", { type: "text", readonly: "readonly", "aria-label": title + " website link" });
      linkInput.style.cssText = "flex:1;min-width:140px;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--border,#444);background:var(--card,#151515);color:inherit;";
      const copy = el("button", { type: "button", class: "fc-mini-btn" }, "Copy link");
      const iframe = el("iframe", {
        class: "fc-tutorial-frame", title: title,
        allow: "autoplay; fullscreen; clipboard-read; clipboard-write",
        referrerpolicy: "no-referrer", loading: "eager"
      });
      const dest = useScramjet ? makeProxyUrl(target) : target;
      linkInput.value = target;
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(linkInput.value);
          copy.textContent = "Copied!";
          setTimeout(() => copy.textContent = "Copy link", 1400);
        } catch (_) {
          linkInput.focus(); linkInput.select();
          try { document.execCommand("copy"); copy.textContent = "Copied!"; setTimeout(() => copy.textContent = "Copy link", 1400); }
          catch (_) { copy.textContent = "Select link to copy"; }
        }
      });
      reload.addEventListener("click", () => { iframe.src = dest; });
      actions.append(reload);
      top.append(label, actions);
      linkRow.append(linkInput, copy);
      pane.append(top, linkRow, iframe);
      iframe.src = dest;
      return pane;
    };
    grid.append(
      makePane("RaccoonGame Login", "https://www.raccoongame.com/login"),
      makePane("Emailnator", "https://emailnator.com/")
    );
    panel.appendChild(grid);
    const videoSection = el("section", { class: "fc-video-section" });
    videoSection.appendChild(el("h4", {}, "Tutorial Video"));
    const video = el("div", { class: "fc-video-placeholder", role: "note", "aria-label": "Tutorial video placeholder" });
    video.append(el("span", { class: "fc-play-symbol", "aria-hidden": "true" }, "▶"), el("span", {}, "Your tutorial video will appear here"));
    videoSection.appendChild(video);
    panel.appendChild(videoSection);
    const completeRow = el("div", { class: "fc-complete-row" });
    const completeButton = el("button", { type: "button", class: "fc-complete-btn" }, "I've finished the tutorial");
    const status = el("span", { class: "fc-complete-status", role: "status", "aria-live": "polite" });
    const setComplete = (done) => {
      completeButton.textContent = done ? "✓ Tutorial completed" : "I've finished the tutorial";
      completeButton.classList.toggle("is-complete", done);
      status.textContent = done ? "✓" : "";
      status.setAttribute("aria-label", done ? "Tutorial completed" : "");
      try { localStorage.setItem(COMPLETE_KEY, done ? "yes" : "no"); } catch (_) {}
    };
    completeButton.addEventListener("click", () => setComplete(true));
    completeRow.append(completeButton, status);
    panel.appendChild(completeRow);
    let done = false;
    try { done = localStorage.getItem(COMPLETE_KEY) === "yes"; } catch (_) {}
    setComplete(done);
    settings.appendChild(panel);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addTutorial, { once: true });
  else addTutorial();
})();

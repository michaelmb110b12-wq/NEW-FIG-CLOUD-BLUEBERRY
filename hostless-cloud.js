/* Figure Cloud Hostless backend connection settings.
 * This adds an explicit connectivity/catalog check to the Settings tab.
 * It does not pretend a cloud stream is playable until the provider and player
 * protocol are configured.
 */
(() => {
  'use strict';
  const URL_KEY = 'figure_cloud_hostless_url_v1';
  const TOKEN_KEY = 'figure_cloud_hostless_session_v1';

  const el = (tag, attrs = {}, text = '') => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
      else if (key in node) node[key] = value;
      else node.setAttribute(key, value);
    }
    if (text) node.textContent = text;
    return node;
  };

  function normalizeBase(value) {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
      throw new Error('Use an HTTPS Hostless URL.');
    }
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  }

  function addPanel() {
    const settings = document.querySelector('#v-set .settings-box');
    if (!settings || document.getElementById('figure-hostless-cloud-panel')) return;

    const panel = el('section', { id: 'figure-hostless-cloud-panel' });
    panel.style.cssText = 'margin-top:34px;padding:24px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.025);';
    const heading = el('h3', { className: 'set-title' }, 'Hostless Cloud Backend');
    const description = el('p', {}, 'Connect the Hostless API used by Figure Cloud. This checks availability and lists games when an authorized compatible provider is configured.');
    description.style.cssText = 'color:var(--muted,#aaa);font-size:13px;line-height:1.6;margin:8px 0 15px;';
    const label = el('label', { htmlFor: 'figure-hostless-cloud-url' }, 'Hostless app URL');
    label.style.cssText = 'display:block;font-size:12px;margin-bottom:7px;color:var(--muted,#aaa);';
    const input = el('input', { id: 'figure-hostless-cloud-url', type: 'url', placeholder: 'https://your-app.hostless.app', autocomplete: 'url' });
    input.value = localStorage.getItem(URL_KEY) || '';
    input.style.cssText = 'display:block;width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.25);color:var(--text,#fff);padding:12px 14px;border-radius:10px;font:inherit;margin-bottom:12px;';
    const buttons = el('div');
    buttons.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    const connect = el('button', { type: 'button' }, 'Save & Test');
    const catalog = el('button', { type: 'button' }, 'Load Cloud Catalog');
    for (const button of [connect, catalog]) {
      button.style.cssText = 'border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;padding:10px 14px;border-radius:9px;cursor:pointer;font:inherit;font-size:13px;';
    }
    const status = el('p', { id: 'figure-hostless-cloud-status', role: 'status', 'aria-live': 'polite' }, 'Not connected.');
    status.style.cssText = 'font-size:13px;line-height:1.5;color:var(--muted,#aaa);margin:12px 0;';
    const list = el('div', { id: 'figure-hostless-cloud-games' });
    list.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:10px;';
    const note = el('p', {}, 'Streaming remains unavailable until this Hostless service is connected to an authorized provider and a matching streaming player.');
    note.style.cssText = 'font-size:12px;color:var(--muted,#aaa);line-height:1.5;margin-top:12px;';
    connect.addEventListener('click', async () => {
      try {
        const base = normalizeBase(input.value);
        localStorage.setItem(URL_KEY, base);
        sessionStorage.removeItem(TOKEN_KEY);
        status.textContent = 'Checking Hostless backend…';
        const response = await fetch(base + '/healthz', { cache: 'no-store' });
        const info = await response.json().catch(() => ({}));
        if (!response.ok || !info.ok) throw new Error(info.message || 'Health check failed (' + response.status + ').');
        if (!info.providerConfigured) {
          status.textContent = 'Backend is online, but no cloud provider is configured yet.';
        } else {
          status.textContent = 'Backend is online and reports a provider. Press “Load Cloud Catalog” to test the API.';
        }
        if (info.configError) status.textContent += ' Configuration: ' + info.configError;
      } catch (error) {
        status.textContent = 'Connection failed: ' + (error.message || 'Unknown error') + ' Check the URL and CORS_ORIGINS.';
      }
    });
    catalog.addEventListener('click', async () => {
      list.replaceChildren();
      try {
        const base = normalizeBase(input.value || localStorage.getItem(URL_KEY));
        localStorage.setItem(URL_KEY, base);
        let token = sessionStorage.getItem(TOKEN_KEY);
        if (!token) {
          const sessionResponse = await fetch(base + '/api/cloud/client-session', { method: 'POST', cache: 'no-store' });
          const sessionData = await sessionResponse.json().catch(() => ({}));
          if (!sessionResponse.ok || !sessionData.token) throw new Error(sessionData.message || 'Could not create browser session.');
          token = sessionData.token;
          sessionStorage.setItem(TOKEN_KEY, token);
        }
        status.textContent = 'Loading cloud catalog…';
        const response = await fetch(base + '/api/cloud/games', {
          headers: { 'X-Cine-Session': token },
          cache: 'no-store'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || data.error || 'Catalog request failed (' + response.status + ').');
        const games = Array.isArray(data) ? data : Array.isArray(data.games) ? data.games : Array.isArray(data.data) ? data.data : Array.isArray(data.data?.games) ? data.data.games : [];
        if (!games.length) {
          status.textContent = 'The backend answered, but returned no recognizable games array.';
          return;
        }
        for (const game of games) {
          const card = el('div');
          card.style.cssText = 'padding:12px;border:1px solid rgba(255,255,255,.10);border-radius:11px;background:rgba(255,255,255,.03);display:flex;align-items:center;gap:10px;min-width:0;';
          const image = el('img', { alt: '', loading: 'lazy' });
          image.src = game.image || game.img || game.cover || game.background || '';
          image.style.cssText = 'width:42px;height:52px;object-fit:cover;border-radius:6px;background:#111;flex-shrink:0;';
          const textWrap = el('div');
          textWrap.style.minWidth = '0';
          const title = el('div', {}, String(game.name || game.title || game.game_name || 'Cloud Game'));
          title.style.cssText = 'font-size:12px;font-weight:600;overflow-wrap:anywhere;';
          const key = el('div', {}, 'Key: ' + String(game.game_key || game.key || 'not supplied'));
          key.style.cssText = 'font-size:10px;color:var(--muted,#aaa);margin-top:4px;overflow-wrap:anywhere;';
          textWrap.append(title, key);
          card.append(image, textWrap);
          list.append(card);
        }
        status.textContent = 'Catalog loaded: ' + games.length + ' games. The catalog connection works; playback still needs a compatible provider/player setup.';
      } catch (error) {
        status.textContent = 'Catalog failed: ' + (error.message || 'Unknown error') + ' Confirm provider setup and CORS_ORIGINS.';
      }
    });
    buttons.append(connect, catalog);
    panel.append(heading, description, label, input, buttons, status, list, note);
    settings.append(panel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addPanel);
  else addPanel();
  const observer = new MutationObserver(addPanel);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();

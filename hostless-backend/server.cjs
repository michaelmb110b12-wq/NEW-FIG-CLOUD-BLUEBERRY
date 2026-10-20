/**
 * Figure Cloud Hostless backend bridge.
 *
 * This service forwards a small, fixed set of Stratus-compatible API routes
 * to a cloud provider you own or are explicitly authorized to use.
 *
 * It deliberately does not create disposable provider accounts, bypass
 * CAPTCHA/rate limits, or evade a provider's session limits.
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { URL } = require('node:url');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT || 3000);
const REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.UPSTREAM_TIMEOUT_MS || 30000));
const BODY_LIMIT = 1024 * 1024;
const DEFAULT_ORIGINS = 'https://michaelmb110b12-wq.github.io,http://localhost:3000,http://127.0.0.1:3000';
const ALLOWED_ORIGINS = new Set((process.env.CORS_ORIGINS || DEFAULT_ORIGINS).split(',').map(s => s.trim()).filter(Boolean));
const CLIENTS = new Map();
const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;

let proxyRuntime = null;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

async function initializeProxyRuntime() {
  const [{ server: wisp, logging }, scramjetModule, baremuxModule] = await Promise.all([
    import('@mercuryworkshop/wisp-js/server'),
    import('@mercuryworkshop/scramjet/path'),
    import('@mercuryworkshop/bare-mux/node')
  ]);
  logging.set_level(logging.NONE);
  Object.assign(wisp.options, {
    allow_udp_streams: false,
    dns_servers: ['1.1.1.1', '1.0.0.1']
  });
  return {
    wisp,
    roots: {
      public: path.resolve(__dirname, '../hostless-proxy/public'),
      scram: scramjetModule.scramjetPath,
      baremux: baremuxModule.baremuxPath,
      epoxy: path.resolve(__dirname, 'node_modules/@mercuryworkshop/epoxy-transport/dist')
    }
  };
}

function staticMount(urlPath) {
  if (urlPath === '/' || ['/browser.css','/proxy.js','/register-sw.js','/sw.js'].includes(urlPath)) {
    return { root: proxyRuntime.roots.public, relative: urlPath === '/' ? 'index.html' : urlPath.slice(1) };
  }
  for (const [prefix, key] of [['/scram/','scram'],['/baremux/','baremux'],['/epoxy/','epoxy']]) {
    if (urlPath.startsWith(prefix)) return { root: proxyRuntime.roots[key], relative: urlPath.slice(prefix.length) };
  }
  return null;
}

async function serveProxyStatic(req, res, url) {
  if (!proxyRuntime || !['GET','HEAD'].includes(req.method)) return false;
  const mount = staticMount(url.pathname);
  if (!mount) return false;
  let relative;
  try { relative = decodeURIComponent(mount.relative); }
  catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Invalid asset path');
    return true;
  }
  const root = path.resolve(mount.root);
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return true;
  }
  let stat;
  try { stat = await fs.promises.stat(target); }
  catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end('Proxy asset not found');
    return true;
  }
  if (!stat.isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end('Proxy asset not found');
    return true;
  }
  res.writeHead(200, {
    'content-type': MIME_TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream',
    'content-length': stat.size,
    'cache-control': /\.(?:html|js|mjs|css|wasm)$/i.test(target) ? 'no-cache' : 'public, max-age=3600',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-embedder-policy': 'require-corp',
    'x-content-type-options': 'nosniff'
  });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(target).on('error', () => res.destroy()).pipe(res);
  return true;
}


function configuredProvider() {
  const raw = process.env.STRATUS_UPSTREAM_URL;
  if (!raw) return null;

  let base;
  try { base = new URL(raw); }
  catch { throw new Error('STRATUS_UPSTREAM_URL must be a valid URL.'); }

  const local = ['localhost', '127.0.0.1'].includes(base.hostname);
  if (base.protocol !== 'https:' && !(local && base.protocol === 'http:')) {
    throw new Error('STRATUS_UPSTREAM_URL must use HTTPS (HTTP is allowed only for localhost).');
  }
  if (base.username || base.password || base.search || base.hash) {
    throw new Error('STRATUS_UPSTREAM_URL must not contain credentials, query parameters, or a fragment.');
  }
  base.pathname = base.pathname.replace(/\/+$/, '');
  return base;
}

function json(res, status, value) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(JSON.stringify(value));
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.has('*') || ALLOWED_ORIGINS.has(origin))) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-allow-headers', 'Content-Type, X-Cine-Session');
    res.setHeader('access-control-max-age', '600');
  }
}

function getClient(req, url) {
  const token = String(req.headers['x-cine-session'] || url.searchParams.get('session') || '');
  if (!/^[a-f0-9-]{36}$/i.test(token)) return null;
  const client = CLIENTS.get(token);
  if (!client) return null;
  client.lastSeen = Date.now();
  return { token, client };
}

function cookieHeader(client) {
  return [...client.cookies.entries()].map(([name, value]) => name + '=' + value).join('; ');
}

function saveCookies(client, response) {
  let values = [];
  if (typeof response.headers.getSetCookie === 'function') values = response.headers.getSetCookie();
  else {
    const one = response.headers.get('set-cookie');
    if (one) values = [one];
  }
  for (const raw of values) {
    const first = String(raw).split(';', 1)[0];
    const equals = first.indexOf('=');
    if (equals <= 0) continue;
    const name = first.slice(0, equals).trim();
    const value = first.slice(equals + 1).trim();
    if (/max-age=0/i.test(raw) || /expires=thu, 01 jan 1970/i.test(raw)) client.cookies.delete(name);
    else client.cookies.set(name, value);
  }
}

function signalId(value) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/stratus\/signal\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  } catch { return null; }
}

function rewriteSignalUrls(value, req, token, key = '') {
  if (Array.isArray(value)) return value.map(item => rewriteSignalUrls(item, req, token));
  if (value && typeof value === 'object') {
    const result = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      result[childKey] = rewriteSignalUrls(childValue, req, token, childKey);
    }
    return result;
  }
  if (typeof value === 'string' && /signaling/i.test(key)) {
    const id = signalId(value);
    if (id) {
      const forwardedProto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
      const scheme = forwardedProto === 'http' ? 'ws' : 'wss';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      return scheme + '://' + host + '/api/cloud/signal/' + encodeURIComponent(id) + '?session=' + encodeURIComponent(token);
    }
  }
  return value;
}

async function readJson(req) {
  let size = 0;
  const parts = [];
  for await (const part of req) {
    size += part.length;
    if (size > BODY_LIMIT) {
      const error = new Error('Request body is too large.');
      error.status = 413;
      throw error;
    }
    parts.push(part);
  }
  if (!parts.length) return {};
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch {
    const error = new Error('Request body must be valid JSON.');
    error.status = 400;
    throw error;
  }
}

async function providerRequest(path, method, body, client, req, token) {
  const base = configuredProvider();
  if (!base) {
    const error = new Error('Cloud provider is not configured. Set STRATUS_UPSTREAM_URL in Hostless to a compatible provider you are authorized to use.');
    error.status = 503;
    throw error;
  }

  const target = new URL(base.toString());
  target.pathname = base.pathname.replace(/\/$/, '') + path;

  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const cookies = cookieHeader(client);
  if (cookies) headers.cookie = cookies;
  if (process.env.STRATUS_UPSTREAM_TOKEN) {
    headers.authorization = 'Bearer ' + process.env.STRATUS_UPSTREAM_TOKEN;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(target, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      redirect: 'manual'
    });
  } catch (cause) {
    const error = new Error(cause.name === 'AbortError' ? 'Cloud provider request timed out.' : 'Could not reach the cloud provider.');
    error.status = 502;
    throw error;
  } finally {
    clearTimeout(timer);
  }

  saveCookies(client, response);
  const raw = await response.text();
  const contentType = response.headers.get('content-type') || '';
  let payload = raw;
  if (contentType.includes('application/json') || raw.startsWith('{') || raw.startsWith('[')) {
    try { payload = JSON.parse(raw); } catch {}
  }
  if (payload && typeof payload === 'object') payload = rewriteSignalUrls(payload, req, token);

  return { status: response.status, payload, contentType };
}

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'cache-control': 'no-store' });
    return res.end();
  }

  if (req.method === 'GET' && (url.pathname === '/healthz' || url.pathname === '/api/health')) {
    let providerConfigured = false;
    let configError = null;
    try { providerConfigured = Boolean(configuredProvider()); }
    catch (error) { configError = error.message; }
    return json(res, configError ? 500 : 200, {
      ok: !configError,
      service: 'figure-cloud-hostless-backend',
      providerConfigured,
      proxyConfigured: Boolean(proxyRuntime),
      transport: 'epoxy',
      autoLoad: true,
      configError
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/cloud/client-session') {
    const token = randomUUID();
    CLIENTS.set(token, { cookies: new Map(), createdAt: Date.now(), lastSeen: Date.now() });
    return json(res, 201, { ok: true, token });
  }

  const clientSession = getClient(req, url);
  if (!clientSession) {
    return json(res, 401, {
      error: 'client_session_required',
      message: 'Reconnect to create a new browser session.'
    });
  }

  let upstreamPath;
  let body;
  const method = req.method;

  if (method === 'GET' && url.pathname === '/api/cloud/games') {
    upstreamPath = '/stratus/games';
  } else if (method === 'GET' && url.pathname === '/api/cloud/status') {
    upstreamPath = '/stratus/status';
  } else if (method === 'POST' && url.pathname === '/api/cloud/session') {
    body = await readJson(req);
    if (!body || typeof body.game_key !== 'string' || !body.game_key.trim() || body.game_key.length > 256) {
      return json(res, 400, { error: 'invalid_game_key', message: 'game_key must be a non-empty string (max 256 characters).' });
    }
    upstreamPath = '/stratus/session';
  } else {
    const match = url.pathname.match(/^\/api\/cloud\/session\/([a-zA-Z0-9_-]{1,128})(?:\/(start|quit))?$/);
    if (!match) return json(res, 404, { error: 'not_found' });
    const sessionId = match[1];
    const action = match[2];
    if (action && method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
    if (!action && method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
    upstreamPath = '/stratus/session/' + encodeURIComponent(sessionId) + (action ? '/' + action : '');
    if (action) body = await readJson(req);
  }

  try {
    const result = await providerRequest(upstreamPath, method, body, clientSession.client, req, clientSession.token);
    if (typeof result.payload === 'string' && result.payload !== '') {
      res.writeHead(result.status, {
        'content-type': result.contentType || 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      });
      return res.end(result.payload);
    }
    return json(res, result.status === 204 ? 200 : result.status, result.payload === '' ? { ok: result.status < 400 } : result.payload);
  } catch (error) {
    return json(res, error.status || 502, {
      error: error.status === 503 ? 'provider_not_configured' : 'provider_error',
      message: error.message || 'Cloud provider request failed.'
    });
  }
}

const server = http.createServer((req, res) => {
  cors(req, res);
  let url;
  try { url = new URL(req.url, 'http://' + (req.headers.host || 'localhost')); }
  catch { return json(res, 400, { error: 'invalid_url' }); }

  serveProxyStatic(req, res, url).then(served => {
    if (served) return;
    if (req.method === 'OPTIONS') return handleApi(req, res, url);
    if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') {
      handleApi(req, res, url).catch(error => {
        if (!res.headersSent) json(res, error.status || 500, { error: 'request_failed', message: error.message || 'Request failed.' });
        else res.destroy();
      });
      return;
    }
    return json(res, 404, { error: 'not_found', message: 'This backend exposes API routes and the Scramjet/Epoxy browser.' });
  }).catch(() => {
    if (!res.headersSent) json(res, 500, { error: 'static_proxy_error', message: 'Could not serve browser asset.' });
    else res.destroy();
  });
  return;
});

const wss = new WebSocket.WebSocketServer({ noServer: true, maxPayload: BODY_LIMIT });
server.on('upgrade', (req, socket, head) => {
  let url;
  try { url = new URL(req.url, 'http://' + (req.headers.host || 'localhost')); }
  catch { socket.destroy(); return; }

  if (/^\/wisp\/?$/.test(url.pathname)) {
    if (proxyRuntime && proxyRuntime.wisp) return proxyRuntime.wisp.routeRequest(req, socket, head);
    socket.destroy();
    return;
  }

  const match = url.pathname.match(/^\/api\/cloud\/signal\/([a-zA-Z0-9_-]{1,128})$/);
  if (!match) {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const session = getClient(req, url);
  if (!session) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  let base;
  try { base = configuredProvider(); } catch { socket.destroy(); return; }
  if (!base) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const origin = req.headers.origin;
  if (origin && !(ALLOWED_ORIGINS.has('*') || ALLOWED_ORIGINS.has(origin))) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, browserSocket => {
    const upstream = new URL(base.toString());
    upstream.pathname = base.pathname.replace(/\/$/, '') + '/stratus/signal/' + encodeURIComponent(match[1]);
    upstream.protocol = upstream.protocol === 'https:' ? 'wss:' : 'ws:';

    const headers = {};
    const cookies = cookieHeader(session.client);
    if (cookies) headers.cookie = cookies;
    if (process.env.STRATUS_UPSTREAM_TOKEN) headers.authorization = 'Bearer ' + process.env.STRATUS_UPSTREAM_TOKEN;

    const remoteSocket = new WebSocket(upstream, { headers, perMessageDeflate: false, handshakeTimeout: 15000 });
    const pending = [];

    browserSocket.on('message', (data, binary) => {
      if (remoteSocket.readyState === WebSocket.OPEN) remoteSocket.send(data, { binary });
      else if (remoteSocket.readyState === WebSocket.CONNECTING && pending.length < 100) pending.push([data, binary]);
    });

    remoteSocket.on('open', () => {
      while (pending.length && remoteSocket.readyState === WebSocket.OPEN) {
        const [data, binary] = pending.shift();
        remoteSocket.send(data, { binary });
      }
    });

    remoteSocket.on('message', (data, binary) => {
      if (browserSocket.readyState === WebSocket.OPEN) browserSocket.send(data, { binary });
    });
    remoteSocket.on('error', () => {
      if (browserSocket.readyState === WebSocket.OPEN) browserSocket.close(1011, 'Cloud provider signaling failed');
    });
    remoteSocket.on('close', () => {
      if (browserSocket.readyState === WebSocket.OPEN) browserSocket.close();
    });
    browserSocket.on('close', () => {
      if (remoteSocket.readyState === WebSocket.OPEN || remoteSocket.readyState === WebSocket.CONNECTING) remoteSocket.close();
    });
    browserSocket.on('error', () => {
      if (remoteSocket.readyState === WebSocket.OPEN || remoteSocket.readyState === WebSocket.CONNECTING) remoteSocket.terminate();
    });
  });
});

setInterval(() => {
  const cutoff = Date.now() - SESSION_IDLE_MS;
  for (const [token, client] of CLIENTS) {
    if (client.lastSeen < cutoff) CLIENTS.delete(token);
  }
}, 60 * 60 * 1000).unref();

initializeProxyRuntime().then(runtime => {
  proxyRuntime = runtime;
  server.listen(PORT, '0.0.0.0', () => {
    console.log('Figure Cloud Hostless backend + Scramjet/Epoxy browser listening on 0.0.0.0:' + PORT);
    console.log('Provider configured: ' + Boolean(process.env.STRATUS_UPSTREAM_URL));
    console.log('Scramjet proxy assets enabled with Epoxy transport.');
  });
}).catch(error => {
  console.error('Could not initialize Scramjet/Epoxy runtime:', error);
  process.exit(1);
});

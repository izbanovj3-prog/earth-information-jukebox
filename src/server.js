// Earth Jukebox local server (no dependencies).
//
//   node src/server.js            -> http://localhost:8000
//
// - Serves the web app from src/public and the rendered playlist from assets/playlist.
// - /api/frame?url=/vis/...&w=1024  fetches a NASA SVS image server-side (SVS only allows
//   cross-origin pixel access for one partner site, so the browser cannot read the pixels
//   directly). TIFF frames are decoded + downscaled to PNG. Results are cached on disk in
//   data/raw/svs-cache so the jukebox keeps working offline once frames were seen.
// - /api/media?url=/vis/...mp4      streams an SVS video with HTTP Range support (same origin,
//   so the browser can sample frames from it into a canvas).
// - POST /api/save?name=foo.wav     saves a rendered track into assets/playlist (localhost only).
// - POST /api/bake?path=...         saves pre-analysed frames into assets/baked (localhost only),
//   which tools/build-static.js packs into the static GitHub Pages site.

'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { decodeTiffDownscaled } = require('./lib/tiff');
const { encodePng, decodePng, downscale } = require('./lib/png');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PLAYLIST_DIR = path.join(ROOT, 'assets', 'playlist');
const CACHE_DIR = path.join(ROOT, 'data', 'raw', 'svs-cache');
const BAKED_DIR = path.join(ROOT, 'assets', 'baked');
const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || '127.0.0.1';
const SVS_HOST = 'svs.gsfc.nasa.gov';
const MAX_DOWNLOAD = 80 * 1024 * 1024; // 80 MB per still frame
const MAX_SAVE = 60 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.webm': 'audio/webm', '.md': 'text/markdown; charset=utf-8', '.ico': 'image/x-icon',
};

/** Accept "/vis/..." or "https://svs.gsfc.nasa.gov/vis/..."; reject everything else. */
function svsUrl(input, exts) {
  if (!input) return null;
  let u;
  try { u = new URL(input, `https://${SVS_HOST}`); } catch { return null; }
  if (u.protocol !== 'https:' || u.hostname !== SVS_HOST) return null;
  if (!u.pathname.startsWith('/vis/') || u.pathname.includes('..')) return null;
  const ext = path.extname(u.pathname).toLowerCase();
  if (!exts.includes(ext)) return null;
  u.search = ''; u.hash = '';
  return u;
}

function download(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'EarthJukebox/1.0 (Space Apps prototype)' }, timeout: 60000 }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume();
        const next = svsUrl(new URL(res.headers.location, url).href, [path.extname(new URL(url).pathname).toLowerCase()]);
        if (!next) return reject(new Error('Redirect left NASA SVS'));
        return resolve(download(next.href, redirects - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`SVS responded ${res.statusCode}`)); }
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > MAX_DOWNLOAD) { req.destroy(new Error('Frame too large')); return; }
        chunks.push(c);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('SVS request timed out')));
    req.on('error', reject);
  });
}

const inflight = new Map();

async function getFrame(url, width) {
  const ext = path.extname(url.pathname).toLowerCase();
  const isTiff = ext === '.tif' || ext === '.tiff';
  const isPng = ext === '.png';
  const outExt = isTiff || isPng ? '.png' : ext;
  const key = crypto.createHash('sha1').update(`${url.href}|${isTiff || isPng ? width : 'orig'}`).digest('hex');
  const file = path.join(CACHE_DIR, key + outExt);

  try { return { file, ext: outExt, cached: true, data: await fsp.readFile(file) }; } catch { /* miss */ }
  if (inflight.has(key)) return inflight.get(key);

  const job = (async () => {
    const raw = await download(url.href);
    let data = raw;
    if (isTiff) data = encodePng(decodeTiffDownscaled(raw, width));
    else if (isPng) {
      // big PNG frames (e.g. 5760x3240) are shrunk server-side; small ones pass through
      const img = raw.length > 1.5e6 ? decodePng(raw) : null;
      if (img && img.width > width) data = encodePng(downscale(img, width));
    }
    await fsp.mkdir(CACHE_DIR, { recursive: true });
    await fsp.writeFile(file, data);
    return { file, ext: outExt, cached: false, data };
  })();
  inflight.set(key, job);
  try { return await job; } finally { inflight.delete(key); }
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

async function handleFrame(req, res, q) {
  const url = svsUrl(q.get('url'), ['.png', '.jpg', '.jpeg', '.tif', '.tiff']);
  if (!url) return sendJson(res, 400, { error: 'url must be an image path on svs.gsfc.nasa.gov/vis/' });
  const width = Math.max(128, Math.min(2048, Number(q.get('w')) || 1024));
  try {
    const f = await getFrame(url, width);
    res.writeHead(200, {
      'Content-Type': MIME[f.ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
      'X-Jukebox-Cache': f.cached ? 'hit' : 'miss',
    });
    res.end(f.data);
  } catch (err) {
    console.error('[frame]', url.href, err.message);
    sendJson(res, 502, { error: `Could not load frame from NASA SVS: ${err.message}` });
  }
}

function handleMedia(req, res, q) {
  const url = svsUrl(q.get('url'), ['.mp4', '.webm']);
  if (!url) return sendJson(res, 400, { error: 'url must be a video path on svs.gsfc.nasa.gov/vis/' });
  const headers = { 'User-Agent': 'EarthJukebox/1.0 (Space Apps prototype)' };
  if (req.headers.range) headers.Range = req.headers.range;
  const up = https.get(url.href, { headers, timeout: 60000 }, (upRes) => {
    const pass = {};
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
      if (upRes.headers[h]) pass[h] = upRes.headers[h];
    }
    res.writeHead(upRes.statusCode, pass);
    upRes.pipe(res);
  });
  up.on('timeout', () => up.destroy(new Error('timeout')));
  up.on('error', (err) => {
    if (!res.headersSent) sendJson(res, 502, { error: err.message });
    else res.destroy();
  });
  req.on('close', () => up.destroy());
}

async function handleSave(req, res, q) {
  const remote = req.socket.remoteAddress || '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) return sendJson(res, 403, { error: 'localhost only' });
  const name = String(q.get('name') || '');
  if (!/^[a-z0-9][a-z0-9._-]{0,80}\.(wav|webm|md|json)$/i.test(name)) return sendJson(res, 400, { error: 'bad file name' });
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_SAVE) return sendJson(res, 413, { error: 'too large' });
    chunks.push(c);
  }
  await fsp.mkdir(PLAYLIST_DIR, { recursive: true });
  await fsp.writeFile(path.join(PLAYLIST_DIR, name), Buffer.concat(chunks));
  sendJson(res, 200, { saved: `assets/playlist/${name}`, bytes: size });
}

// POST /api/bake?path=<dataset>/<file>.jpg | <dataset>.json  -> assets/baked (localhost only).
// Used by bake.html to store pre-analysed frames for the static GitHub Pages build.
async function handleBake(req, res, q) {
  const remote = req.socket.remoteAddress || '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) return sendJson(res, 403, { error: 'localhost only' });
  const rel = String(q.get('path') || '');
  if (!/^(?:[a-z]{2,20}\/)?[a-z0-9][a-z0-9._-]{0,60}\.(jpg|json)$/.test(rel) || rel.includes('..')) return sendJson(res, 400, { error: 'bad path' });
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_SAVE) return sendJson(res, 413, { error: 'too large' });
    chunks.push(c);
  }
  const file = path.join(BAKED_DIR, rel);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, Buffer.concat(chunks));
  sendJson(res, 200, { saved: `assets/baked/${rel}`, bytes: size });
}

async function serveStatic(res, baseDir, rel) {
  const file = path.normalize(path.join(baseDir, rel));
  if (!file.startsWith(baseDir)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const stat = await fsp.stat(file);
    const target = stat.isDirectory() ? path.join(file, 'index.html') : file;
    const ext = path.extname(target).toLowerCase();
    const st = await fsp.stat(target);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
    fs.createReadStream(target).pipe(res);
  } catch {
    sendJson(res, 404, { error: 'not found' });
  }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(u.pathname);
  try {
    if (p === '/api/frame' && req.method === 'GET') return await handleFrame(req, res, u.searchParams);
    if (p === '/api/media' && req.method === 'GET') return handleMedia(req, res, u.searchParams);
    if (p === '/api/save' && req.method === 'POST') return await handleSave(req, res, u.searchParams);
    if (p === '/api/bake' && req.method === 'POST') return await handleBake(req, res, u.searchParams);
    if (p.startsWith('/baked/')) return await serveStatic(res, BAKED_DIR, p.slice('/baked/'.length));
    if (p === '/api/playlist' && req.method === 'GET') {
      let files = [];
      try { files = (await fsp.readdir(PLAYLIST_DIR)).filter((f) => /\.(wav|webm)$/.test(f)); } catch { /* none yet */ }
      return sendJson(res, 200, { files });
    }
    if (p.startsWith('/playlist/')) return await serveStatic(res, PLAYLIST_DIR, p.slice('/playlist/'.length));
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'method not allowed' });
    return await serveStatic(res, PUBLIC_DIR, p === '/' ? 'index.html' : p);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { error: 'internal error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Earth Jukebox running at http://localhost:${PORT}`);
});

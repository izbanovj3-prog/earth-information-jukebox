// Serve dist/ the way GitHub Pages does: plain static files under a sub-path.
//
//   node tools/preview-static.js     -> http://localhost:8001/earth-information-jukebox/
//
// No /api routes exist here, so anything that still needs the local server shows up as a 404.

'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.resolve(__dirname, '..', 'dist');
const BASE = '/earth-information-jukebox/';
const PORT = Number(process.env.PORT) || 8001;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.wav': 'audio/wav', '.webm': 'audio/webm', '.txt': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' || p === BASE.slice(0, -1)) { res.writeHead(302, { Location: BASE }); return res.end(); }
  if (!p.startsWith(BASE)) { res.writeHead(404); return res.end('not under ' + BASE); }
  let file = path.normalize(path.join(DIST, p.slice(BASE.length)));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { console.log('404', p); res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`Static preview: http://localhost:${PORT}${BASE}`));

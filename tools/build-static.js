// Build the static site for GitHub Pages (no server needed).
//
//   node tools/build-static.js        -> dist/
//
// Copies the web app (src/public), the pre-analysed frames (assets/baked, made by
// bake.html on the local server) and the rendered playlist (assets/playlist), and marks
// index.html as static so the app loads baked frames instead of calling /api/frame.
// Live video sonification stays a local-server feature: NASA SVS only allows cross-origin
// pixel access for one partner site, so a browser on github.io cannot analyse the video.

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const SKIP = new Set(['render.html', 'bake.html']); // need the local server

function copyDir(from, to, filter = () => true) {
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (!filter(e.name, a)) continue;
    if (e.isDirectory()) n += copyDir(a, b, filter);
    else { fs.copyFileSync(a, b); n++; }
  }
  return n;
}

const baked = path.join(ROOT, 'assets', 'baked');
if (!fs.existsSync(baked)) {
  console.error('assets/baked is missing: run `npm start` and open http://localhost:8000/bake.html first.');
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
let files = copyDir(path.join(ROOT, 'src', 'public'), OUT, (name) => !SKIP.has(name));
files += copyDir(baked, path.join(OUT, 'baked'));
files += copyDir(path.join(ROOT, 'assets', 'playlist'), path.join(OUT, 'playlist'), (name) => /\.(webm|json)$/.test(name));

const index = path.join(OUT, 'index.html');
const html = fs.readFileSync(index, 'utf8');
if (!/<html lang="en">/.test(html)) throw new Error('index.html: <html lang="en"> not found');
fs.writeFileSync(index, html.replace('<html lang="en">', '<html lang="en" data-static="1">'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), ''); // serve files as they are

let bytes = 0;
(function size(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) size(p); else bytes += fs.statSync(p).size; } })(OUT);
console.log(`dist/ ready: ${files} files, ${(bytes / 1e6).toFixed(1)} MB`);

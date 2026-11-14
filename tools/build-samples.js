#!/usr/bin/env node
// Builds the small orchestral sample set used by the "Orchestra" mode.
//
//   node tools/build-samples.js
//
// Source: VS Chamber Orchestra 2 Community Edition (VSCO-2-CE), CC0-1.0 (public domain)
//   https://github.com/sgossner/VSCO-2-CE
// For each instrument we pick a handful of notes across its range, download them,
// detect the real pitch (VSCO folders use different octave conventions), mix to mono,
// resample to 32 kHz, trim, fade and peak-normalise, and write 16-bit WAVs plus a
// manifest to src/public/samples/. Raw downloads are cached in data/raw/vsco-cache.

'use strict';
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'public', 'samples');
const CACHE = path.join(ROOT, 'data', 'raw', 'vsco-cache');
const REPO = 'sgossner/VSCO-2-CE';
const BRANCH = 'master';
const SR = 32000;

// id: [folder, filename filter, max notes, max seconds, pitched]
const INSTRUMENTS = {
  violins:   { dir: 'Strings/Violin Section/susVib', match: /_v1\.wav$/, notes: 7, secs: 3.4, pitched: true },
  cellos:    { dir: 'Strings/Cello Section/susvib', match: /_v1_1\.wav$/, notes: 7, secs: 3.4, pitched: true },
  violas:    { dir: 'Strings/Viola Section/susvib', match: /_v1_1\.wav$/, notes: 6, secs: 3.4, pitched: true },
  pizz:      { dir: 'Strings/Violin Section/Pizz', match: /_v2_rr1\.wav$/, notes: 6, secs: 1.2, pitched: true },
  harp:      { dir: 'Strings/Harp', match: /_mf\.wav$/, notes: 9, secs: 2.6, pitched: true },
  bass:      { dir: 'Strings/Solo Contrabass/Pizz', match: /_v1_rr1\.wav$/, notes: 7, secs: 1.6, pitched: true },
  horns:     { dir: 'Brass/F Horn/sus', match: /_v2_1\.wav$/, notes: 7, secs: 3.2, pitched: true },
  trumpet:   { dir: 'Brass/Trumpet/stac', match: /_v2_rr1\.wav$/, notes: 6, secs: 0.9, pitched: true },
  flute:     { dir: 'Woodwinds/Flute/susvib', match: /_v1_1\.wav$/, notes: 8, secs: 3.0, pitched: true },
  clarinet:  { dir: 'Woodwinds/Clarinet/susLong', match: /_v2_rr1_sum\.wav$/, notes: 7, secs: 3.2, pitched: true },
  glock:     { dir: 'Percussion/Glock', match: /\.wav$/, notes: 6, secs: 2.4, pitched: true },
  marimba:   { dir: 'Percussion/Marimba', match: /\.wav$/, notes: 7, secs: 1.6, pitched: true },
  piano:     { dir: 'Keys/Upright Nr1', match: /_mf_RR1\.wav$/, notes: 7, secs: 3.0, pitched: true },
  timpani:   { dir: 'Percussion/Timpani', match: /_Hit_v3_rr1_Sum\.wav$/, notes: 5, secs: 2.6, pitched: true },
  kick:      { files: ['VSCO 1 Percussion/drums/bass/bdrum_f_1.wav', 'VSCO 1 Percussion/drums/bass/bdrum_mp_1.wav'], secs: 1.4 },
  snare:     { files: ['VSCO 1 Percussion/drums/snare/drum1/snare1_mp_1.wav', 'VSCO 1 Percussion/drums/snare/drum1/snare1_f_1.wav'], secs: 0.8 },
  shaker:    { files: ['VSCO 1 Percussion/varWood/Camo\'s Shaker/shake1.wav', 'VSCO 1 Percussion/varWood/Camo\'s Shaker/shake3.wav'], secs: 0.5 },
  cymbal:    { files: ['VSCO 1 Percussion/varMetal/Cymbals/susp/susp_hit_softmall_roll2_cresc.wav', 'VSCO 1 Percussion/varMetal/Cymbals/susp/susp_hit_softmall_mp.wav'], secs: 4.5 },
  triangle:  { files: ['VSCO 1 Percussion/varMetal/triangle/1/triangle1_hit_mp.wav'], secs: 2.2 },
};

// ---------- helpers ----------
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'EarthJukebox-sample-builder' } }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) { res.resume(); return resolve(get(res.headers.location)); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`${res.statusCode} ${url}`)); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}
async function fetchCached(p) {
  const file = path.join(CACHE, p.replace(/[\\/:*?"<>|']/g, '_'));
  try { return await fsp.readFile(file); } catch { /* miss */ }
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${p.split('/').map(encodeURIComponent).join('/')}`;
  const buf = await get(url);
  await fsp.mkdir(CACHE, { recursive: true });
  await fsp.writeFile(file, buf);
  return buf;
}

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteFromName(name) {
  const m = /(?:^|_)([A-G])(#?)(-?\d)(?=_|\.|$)/.exec(name);
  if (!m) return null;
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] ? 1 : 0); // scientific: C4 = 60
}

/** Decode PCM (16/24/32-bit int, 32-bit float) WAV to mono Float32. */
function decodeWav(buf) {
  if (buf.toString('latin1', 0, 4) !== 'RIFF') throw new Error('not RIFF');
  let p = 12, fmt = null, data = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString('latin1', p, p + 4);
    const len = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { tag: buf.readUInt16LE(p + 8), ch: buf.readUInt16LE(p + 10), sr: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
    else if (id === 'data') data = buf.subarray(p + 8, p + 8 + len);
    p += 8 + len + (len & 1);
  }
  if (!fmt || !data) throw new Error('bad wav');
  const tag = fmt.tag === 0xfffe ? (fmt.bits === 32 ? 3 : 1) : fmt.tag;
  const bps = fmt.bits / 8, frames = Math.floor(data.length / (bps * fmt.ch));
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < fmt.ch; c++) {
      const o = (i * fmt.ch + c) * bps;
      let v;
      if (tag === 3) v = data.readFloatLE(o);
      else if (bps === 2) v = data.readInt16LE(o) / 32768;
      else if (bps === 3) v = (data.readIntLE(o, 3)) / 8388608;
      else if (bps === 4) v = data.readInt32LE(o) / 2147483648;
      else v = (data[o] - 128) / 128;
      s += v;
    }
    out[i] = s / fmt.ch;
  }
  return { sr: fmt.sr, x: out };
}

/** Low-pass (2x biquad) then linear resample. */
function resample(x, from, to) {
  if (from === to) return x;
  const fc = Math.min(0.45 * to, 15000), w = (2 * Math.PI * fc) / from, q = Math.SQRT1_2;
  const al = Math.sin(w) / (2 * q), cw = Math.cos(w);
  const b0 = (1 - cw) / 2, b1 = 1 - cw, b2 = (1 - cw) / 2, a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
  let y = x;
  for (let pass = 0; pass < 2; pass++) {
    const z = new Float32Array(y.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const v = (b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = y[i]; y2 = y1; y1 = v; z[i] = v;
    }
    y = z;
  }
  const n = Math.floor((y.length * to) / from), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = (i * from) / to, i0 = Math.floor(t), f = t - i0;
    out[i] = y[i0] * (1 - f) + (y[i0 + 1] || 0) * f;
  }
  return out;
}

/** YIN pitch estimate (Hz) over a window starting at `start`. */
function yin(x, sr, start) {
  const W = Math.min(4096, x.length - start - 2048);
  if (W < 1024) return 0;
  const maxLag = Math.min(2048, Math.floor(sr / 30)), minLag = Math.floor(sr / 2500);
  const d = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const v = x[start + i] - x[start + i + lag]; s += v * v; }
    d[lag] = s;
  }
  let run = 0;
  for (let lag = 1; lag <= maxLag; lag++) { run += d[lag]; d[lag] = run ? (d[lag] * lag) / run : 1; }
  for (let lag = minLag; lag < maxLag; lag++) {
    if (d[lag] < 0.15) {
      while (lag + 1 < maxLag && d[lag + 1] < d[lag]) lag++;
      return sr / lag;
    }
  }
  let best = minLag;
  for (let lag = minLag; lag < maxLag; lag++) if (d[lag] < d[best]) best = lag;
  return sr / best;
}

function process(x, sr, secs) {
  // trim leading silence
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const thr = peak * 0.02;
  let s0 = 0;
  while (s0 < x.length && Math.abs(x[s0]) < thr) s0++;
  s0 = Math.max(0, s0 - Math.floor(sr * 0.004));
  const n = Math.min(x.length - s0, Math.floor(secs * sr));
  const y = x.slice(s0, s0 + n);
  const fade = Math.min(Math.floor(sr * 0.3), Math.floor(n / 4));
  for (let i = 0; i < fade; i++) y[n - 1 - i] *= i / fade;
  let p = 0;
  for (const v of y) p = Math.max(p, Math.abs(v));
  const g = p > 0 ? 0.89 / p : 1;
  for (let i = 0; i < n; i++) y[i] *= g;
  return y;
}

function encodeWav16(x, sr) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  return b;
}

function pickSpread(items, n) {
  if (items.length <= n) return items;
  const out = [];
  for (let k = 0; k < n; k++) out.push(items[Math.round((k * (items.length - 1)) / (n - 1))]);
  return [...new Set(out)];
}

async function pool(items, size, fn) {
  const res = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); }
  }));
  return res;
}

// ---------- main ----------
(async () => {
  console.log('Reading VSCO-2-CE file list…');
  const tree = JSON.parse((await get(`https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`)).toString('utf8')).tree;
  const blobs = tree.filter((e) => e.type === 'blob').map((e) => e.path);
  const manifest = { source: 'VS Chamber Orchestra 2 Community Edition (CC0-1.0), https://github.com/sgossner/VSCO-2-CE', sampleRate: SR, instruments: {} };
  await fsp.mkdir(OUT, { recursive: true });
  let total = 0;

  for (const [id, spec] of Object.entries(INSTRUMENTS)) {
    let files;
    if (spec.files) files = spec.files.map((p) => ({ p, named: null }));
    else {
      const depth = spec.dir.split('/').length + 1;
      files = blobs.filter((p) => p.startsWith(`${spec.dir}/`) && p.split('/').length === depth && spec.match.test(p))
        .map((p) => ({ p, named: noteFromName(path.basename(p)) }))
        .filter((f) => f.named != null || id === 'timpani')
        .sort((a, b) => (a.named ?? 0) - (b.named ?? 0) || a.p.localeCompare(b.p));
      files = pickSpread(files, spec.notes);
    }
    const decoded = await pool(files, 6, async (f) => {
      const raw = await fetchCached(f.p);
      const { sr, x } = decodeWav(raw);
      const mono = resample(x, sr, SR);
      const y = process(mono, SR, spec.secs);
      let midi = null;
      if (spec.pitched) {
        const hz = yin(y, SR, Math.floor(SR * (spec.secs > 2 ? 0.25 : 0.05)));
        const detected = hz > 0 ? 69 + 12 * Math.log2(hz / 440) : null;
        midi = { named: f.named, detected };
      }
      return { f, y, midi };
    });

    // resolve octave convention per folder by majority vote (named vs named+12)
    let offset = 0;
    if (spec.pitched && id !== 'timpani') {
      const votes = { 0: 0, 12: 0, '-12': 0 };
      for (const d of decoded) {
        if (d.midi.detected == null) continue;
        const best = [0, 12, -12].map((o) => [o, Math.abs(((d.midi.detected - (d.midi.named + o)) % 12 + 18) % 12 - 6) + Math.abs(d.midi.detected - (d.midi.named + o)) / 12])
          .sort((a, b) => a[1] - b[1])[0][0];
        votes[best]++;
      }
      offset = Number(Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0]);
    }

    const zones = [];
    for (const [k, d] of decoded.entries()) {
      const file = `${id}/${k}.wav`;
      await fsp.mkdir(path.join(OUT, id), { recursive: true });
      const wav = encodeWav16(d.y, SR);
      await fsp.writeFile(path.join(OUT, file), wav);
      total += wav.length;
      let midi = null;
      if (id === 'timpani') midi = Math.round(d.midi.detected);
      else if (spec.pitched) midi = d.midi.named + offset;
      zones.push({ file, midi, secs: +(d.y.length / SR).toFixed(2), src: d.f.p });
    }
    const det = decoded.filter((d) => d.midi?.detected).map((d) => `${d.midi.named ?? '-'}→${d.midi.detected.toFixed(1)}`).join(' ');
    console.log(`${id.padEnd(9)} ${zones.length} zones, octave offset ${offset >= 0 ? '+' : ''}${offset}  ${det}`);
    manifest.instruments[id] = { pitched: !!spec.pitched, zones };
  }

  await fsp.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  await fsp.writeFile(path.join(OUT, 'LICENSE.txt'),
    'Samples derived from VS Chamber Orchestra 2: Community Edition (VSCO-2-CE)\n' +
    'by Versilian Studios (recorded by Sam Gossner & Simon Dalzell).\n' +
    'License: CC0 1.0 Universal (public domain). https://github.com/sgossner/VSCO-2-CE\n' +
    'Processed for Earth Jukebox: mono, 32 kHz, trimmed, faded, normalised (tools/build-samples.js).\n');
  console.log(`Done: ${(total / 1e6).toFixed(1)} MB in ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });

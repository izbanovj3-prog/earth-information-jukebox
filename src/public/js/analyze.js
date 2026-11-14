// Frame loading + computer-vision feature extraction.
// Every frame is reduced to a COLS x ROWS grid over an equirectangular world map
// (column = longitude, row = latitude). Each dataset defines its own channels.

import { STATIC } from './env.js';

export const COLS = 64;
export const ROWS = 32;
// Pixels sampled per grid-cell side. Smooth fields are fine at 4 (256 x 128 canvas);
// tiny features (lightning dots, city lights) vanish when the frame is shrunk that much,
// so those datasets are analysed at higher resolution (32 -> 2048 x 1024 canvas).
const SUB_DEFAULT = 4;
const SUB_FOR = { lightning: 32, nightlights: 16 };

// Default geography: a full equirectangular map, -180..180 x 90..-90.
// A dataset may override it (`ds.geo`), e.g. the air-quality map spans more than 360°.
export const DEFAULT_GEO = { lonL: -180, lonR: 180, latT: 90, latB: -90 };
export function lonOfCol(c, geo = DEFAULT_GEO) {
  const lon = geo.lonL + ((c + 0.5) / COLS) * (geo.lonR - geo.lonL);
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}
export function latOfRow(r, geo = DEFAULT_GEO) {
  return Math.max(-90, Math.min(90, geo.latT + ((r + 0.5) / ROWS) * (geo.latB - geo.latT)));
}

export function fmtLon(lon) {
  const v = Math.round(Math.abs(lon));
  return v === 0 ? '0°' : `${v}°${lon < 0 ? 'W' : 'E'}`;
}
export function fmtLat(lat) {
  const v = Math.round(Math.abs(lat));
  return v === 0 ? 'the equator' : `${v}°${lat < 0 ? 'S' : 'N'}`;
}

// Coarse geography for narration. Order matters (first match wins).
const REGIONS = [
  ['Antarctica', -90, -62, -180, 180],
  ['the Arctic', 72, 90, -180, 180],
  ['Greenland', 60, 84, -73, -12],
  ['North America', 15, 72, -168, -52],
  ['Central America', 7, 15, -92, -77],
  ['South America', -56, 13, -82, -34],
  ['Europe', 36, 71, -10, 40],
  ['the Middle East', 12, 42, 35, 62],
  ['North Africa', 10, 36, -18, 35],
  ['Africa', -35, 10, -18, 52],
  ['India', 6, 35, 66, 92],
  ['Southeast Asia', -10, 23, 92, 150],
  ['East Asia', 18, 55, 100, 146],
  ['Russia and Central Asia', 35, 72, 40, 180],
  ['Australia', -45, -10, 112, 155],
  ['the North Atlantic', 0, 72, -80, 0],
  ['the South Atlantic', -60, 0, -70, 20],
  ['the Indian Ocean', -60, 25, 20, 120],
  ['the Southern Ocean', -90, -45, -180, 180],
  ['the Pacific', -90, 90, -180, 180],
];
export function regionName(lat, lon) {
  for (const [name, la0, la1, lo0, lo1] of REGIONS) {
    if (lat >= la0 && lat <= la1 && lon >= lo0 && lon <= lo1) return name;
  }
  return 'the open ocean';
}

// ---------- colour helpers ----------
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const hueIn = (h, a, b) => (a <= b ? h >= a && h <= b : h >= a || h <= b);

// ---------- per-dataset pixel classifiers ----------
// Each returns per-pixel channel values; cells average them (and optionally keep max).
const EXTRACTORS = {
  nightlights: {
    channels: ['light'],
    normalize: ['light'],
    pixel(r, g, b, out) {
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      out[0] = lum * lum * 0.5 + lum; // gentle emphasis on bright cores
    },
  },
  ocean: {
    channels: ['temp', 'flow', 'water'],
    normalize: ['flow'],
    pixel(r, g, b, out) {
      const [h, s, v] = rgbToHsv(r, g, b);
      const isWater = s > 0.3 && v > 0.12;
      // colormap: blue (cold, 240°) -> green -> yellow -> orange -> red (warm, 0°)
      out[0] = isWater ? clamp01(1 - Math.min(h, 240) / 240) : 0;
      out[1] = isWater ? v : 0; // brightness; turned into turbulence (variance) per cell
      out[2] = isWater ? 1 : 0;
    },
  },
  aerosols: {
    channels: ['carbon', 'dust', 'salt', 'sulfate'],
    normalize: ['carbon', 'dust', 'salt', 'sulfate'],
    pixel(r, g, b, out) {
      const [h, s, v] = rgbToHsv(r, g, b);
      out[0] = out[1] = out[2] = out[3] = 0;
      if (v < 0.14) return;
      if (s > 0.35 && hueIn(h, 340, 40)) out[0] = s * v; // black carbon: red-orange
      else if (s > 0.12 && hueIn(h, 255, 320)) out[1] = v * (0.5 + s); // dust: lavender
      else if (s > 0.4 && hueIn(h, 75, 150)) out[3] = s * v; // sulfate: green
      else if (v > 0.42 && s < 0.45 && hueIn(h, 150, 230)) out[2] = v; // sea salt: pale blue-white
      else if (v > 0.6 && s < 0.15) out[2] = v * 0.7; // bright white salt cores
    },
  },
  lightning: {
    channels: ['flash'],
    normalize: ['flash'],
    pixel(r, g, b, out) {
      // flashes are yellow dots on a grey map: strong red+green, weak blue
      const y = (Math.min(r, g) - b) / 255;
      out[0] = y > 0.15 ? y : 0;
    },
  },
  airquality: {
    // co/pm share the warm colour family; per-column votes decide which strip it is
    channels: ['co', 'pm', 'nox', 'o3', 'coVote', 'pmVote'],
    normalize: [],
    pixel(r, g, b, out) {
      const [h, s, v] = rgbToHsv(r, g, b);
      out[0] = out[1] = out[2] = out[3] = out[4] = out[5] = 0;
      if (v < 0.12) return;
      if (hueIn(h, 75, 165) && s > 0.2) { out[2] = clamp01(1.15 - v); return; } // NOx: light -> dark green
      if (hueIn(h, 225, 295) && s > 0.1) { out[3] = clamp01(s * 1.35); return; } // O3: grey -> violet
      if (hueIn(h, 345, 58) && s > 0.06) {
        // CO: saturated yellow -> orange -> red;  PM2.5: cream -> orange -> brown
        out[0] = clamp01(((52 - (h > 300 ? h - 360 : h)) / 50) * 0.75 + (1 - v) * 0.6);
        out[1] = clamp01(s * 0.95 + (1 - v) * 0.8 - 0.08);
        if (v > 0.85 && s > 0.45 && h > 34) out[4] = 1; // bright saturated yellow background = CO strip
        if (v > 0.85 && s < 0.32) out[5] = 1; // pale cream background = PM2.5 strip
      }
    },
  },
};

export function channelsOf(dsId) {
  return EXTRACTORS[dsId].channels;
}

/** Analyse a drawable (img / canvas / video) for dataset `ds`. */
const canvases = new Map();
export function analyzeDrawable(src, srcW, srcH, ds, { maxSub = 64 } = {}) {
  const ex = EXTRACTORS[ds.id];
  const SUB = Math.min(maxSub, SUB_FOR[ds.id] || SUB_DEFAULT);
  const W = COLS * SUB, H = ROWS * SUB;
  // reuse one canvas per size (live video analyses several times a second)
  let cv = canvases.get(W);
  if (!cv) { cv = document.createElement('canvas'); cv.width = W; cv.height = H; canvases.set(W, cv); }
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = SUB <= 4 ? 'high' : 'low';
  const c = ds.crop;
  g.drawImage(src, c.x0 * srcW, c.y0 * srcH, (c.x1 - c.x0) * srcW, (c.y1 - c.y0) * srcH, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;

  const nCh = ex.channels.length;
  const mean = ex.channels.map(() => new Float32Array(COLS * ROWS));
  const peak = ex.channels.map(() => new Float32Array(COLS * ROWS));
  const sumSq = new Float32Array(COLS * ROWS); // for ocean turbulence
  const tmp = new Float32Array(nCh);
  const masks = ds.masks || [];
  const n = SUB * SUB;

  for (let y = 0; y < H; y++) {
    const fy = c.y0 + ((y + 0.5) / H) * (c.y1 - c.y0); // frame-normalised coords for masks
    const row = Math.floor(y / SUB);
    const rowMasks = masks.filter((m) => fy >= m.y0 && fy <= m.y1);
    for (let x = 0; x < W; x++) {
      if (rowMasks.length) {
        const fx = c.x0 + ((x + 0.5) / W) * (c.x1 - c.x0);
        if (rowMasks.some((m) => fx >= m.x0 && fx <= m.x1)) continue;
      }
      const i = (y * W + x) * 4;
      ex.pixel(px[i], px[i + 1], px[i + 2], tmp);
      const cell = row * COLS + Math.floor(x / SUB);
      for (let k = 0; k < nCh; k++) {
        mean[k][cell] += tmp[k] / n;
        if (tmp[k] > peak[k][cell]) peak[k][cell] = tmp[k];
      }
      if (ds.id === 'ocean') sumSq[cell] += (tmp[1] * tmp[1]) / n;
    }
  }

  const ch = {};
  ex.channels.forEach((name, k) => { ch[name] = mean[k]; });

  if (ds.id === 'ocean') {
    // temperature = average over water pixels only; flow = brightness variance (eddies / streaks)
    const temp = new Float32Array(COLS * ROWS), flow = new Float32Array(COLS * ROWS);
    for (let i = 0; i < COLS * ROWS; i++) {
      const w = ch.water[i];
      temp[i] = w > 0.15 ? ch.temp[i] / w : -1;
      if (w > 0.15) {
        const m = ch.flow[i] / w, m2 = sumSq[i] / w;
        flow[i] = Math.sqrt(Math.max(0, m2 - m * m)) + m * 0.3;
      }
    }
    ch.temp = temp; ch.flow = flow;
  }
  if (ds.id === 'airquality') {
    // Decide per column whether a warm strip is CO or PM2.5, keep only that channel.
    // Smoke plumes are orange in both scales, so only the clean background near the
    // poles votes (CO = saturated yellow, PM2.5 = pale cream), smoothed over neighbours
    // because each strip is several columns wide.
    const polar = [0, 1, 2, 3, 4, ROWS - 6, ROWS - 5, ROWS - 4, ROWS - 3, ROWS - 2, ROWS - 1];
    const lean = new Float32Array(COLS);
    for (let c = 0; c < COLS; c++) {
      for (const r of polar) lean[c] += ch.coVote[r * COLS + c] - ch.pmVote[r * COLS + c];
    }
    for (let c = 0; c < COLS; c++) {
      let s = 0;
      for (let d = -3; d <= 3; d++) s += lean[(c + d + COLS) % COLS] * (d === 0 ? 2 : 1);
      for (let r = 0; r < ROWS; r++) {
        const i = r * COLS + c;
        if (s >= 0) ch.pm[i] = 0; else ch.co[i] = 0;
      }
    }
    delete ch.coVote; delete ch.pmVote;
  }
  if (ds.id === 'nightlights' || ds.id === 'lightning') {
    // small bright dots vanish in a mean; blend in the peak
    const name = ex.channels[0];
    for (let i = 0; i < COLS * ROWS; i++) ch[name][i] = ch[name][i] * 0.6 + peak[0][i] * 0.4;
  }
  return ch;
}

/** Normalise channels across ALL frames of a dataset (keeps change over time audible). */
export function normalizeFrames(frames, ds) {
  frames.geo = ds.geo || DEFAULT_GEO;
  frames.norm = {};
  for (const name of EXTRACTORS[ds.id].normalize) {
    const all = [];
    for (const f of frames) for (const v of f.ch[name]) if (v > 0) all.push(v);
    if (!all.length) continue;
    all.sort((a, b) => a - b);
    const p = all[Math.floor(all.length * 0.985)] || all[all.length - 1] || 1;
    frames.norm[name] = p;
    for (const f of frames) {
      const a = f.ch[name];
      for (let i = 0; i < a.length; i++) a[i] = a[i] > 0 ? Math.min(1, a[i] / p) : a[i];
    }
  }
  for (const f of frames) f.stats = frameStats(f.ch, ds, frames.geo);
}

/**
 * Analyse the current picture of a playing video with the same scale as the dated
 * frames (`norm` from normalizeFrames), so live and still frames sound alike.
 */
export function analyzeLive(video, ds, norm, geo) {
  // live analysis runs several times a second: cap at 1024 x 512 (still ~16x sharper than the default)
  const ch = analyzeDrawable(video, video.videoWidth, video.videoHeight, ds, { maxSub: 16 });
  for (const [name, p] of Object.entries(norm || {})) {
    const a = ch[name];
    for (let i = 0; i < a.length; i++) a[i] = a[i] > 0 ? Math.min(1, a[i] / p) : a[i];
  }
  return { ch, stats: frameStats(ch, ds, geo) };
}

function frameStats(ch, ds, geo) {
  const out = {};
  for (const [name, a] of Object.entries(ch)) {
    if (name === 'water') continue;
    let s = 0, n = 0;
    for (const v of a) if (v >= 0) { s += v; n++; }
    out[name] = n ? s / n : 0;
  }
  if (ds.id === 'aerosols') out.load = out.carbon + out.dust + out.salt + out.sulfate;
  if (ds.id === 'lightning') {
    let north = 0, all = 0;
    ch.flash.forEach((v, i) => { all += v; if (Math.floor(i / COLS) < ROWS / 2) north += v; });
    out.north = all > 0 ? north / all : 0.5;
  }
  if (ds.id === 'airquality') {
    // average level where a smoke-type strip is present
    let s = 0, n = 0;
    for (let i = 0; i < ch.co.length; i++) {
      const v = Math.max(ch.co[i], ch.pm[i]);
      if (v > 0) { s += v; n++; }
    }
    out.smoke = n ? s / n : 0;
  }
  // top regions for the main channel (for alt text)
  const tally = new Map();
  const mains = ds.id === 'ocean' ? ['temp'] : ds.id === 'airquality' ? ['co', 'pm'] : [channelsOf(ds.id)[0]];
  for (const main of mains) {
    const a = ch[main];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const v = a[r * COLS + c];
      if (v <= 0) continue;
      const name = regionName(latOfRow(r, geo), lonOfCol(c, geo));
      tally.set(name, (tally.get(name) || 0) + v * v);
    }
  }
  out.topRegions = [...tally.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4).map((e) => e[0]);
  return out;
}

// ---------- loading ----------
export const frameUrl = (src, ds) => `api/frame?url=${encodeURIComponent(src)}&w=${ds?.frameWidth || 1024}`;
/** Small picture for dataset cards and playlist rows. */
export const thumbUrl = (ds) => (STATIC ? `baked/${ds.id}/thumb.jpg` : frameUrl(ds.frames[0].src, ds));

// Pre-baked features (static site): Float32 channels stored as base64.
export function f32ToB64(a) {
  const u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64ToF32(b64) {
  const s = atob(b64), u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return new Float32Array(u8.buffer);
}
async function loadBaked(ds, onProgress) {
  onProgress?.('Loading pre-analysed frames 0 of 1…');
  const res = await fetch(`baked/${ds.id}.json`);
  if (!res.ok) throw new Error(`baked/${ds.id}.json: ${res.status}`);
  const data = await res.json();
  const n = data.frames.length;
  // preload the pictures so the stage never shows a half-loaded frame
  let done = 0;
  await Promise.all(data.frames.map((f) => loadImage(`baked/${ds.id}/${f.img}`).catch(() => null).then(() => {
    onProgress?.(`Loading frame ${++done} of ${n}…`);
  })));
  return data.frames.map((f) => ({
    label: f.label, date: f.date, url: `baked/${ds.id}/${f.img}`,
    ch: Object.fromEntries(Object.entries(f.ch).map(([k, v]) => [k, b64ToF32(v)])),
  }));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

function waitFor(el, ev, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { cleanup(); reject(new Error(`timeout waiting for ${ev}`)); }, ms);
    const ok = () => { cleanup(); resolve(); };
    const bad = () => { cleanup(); reject(new Error(`video error during ${ev}`)); };
    const cleanup = () => { clearTimeout(t); el.removeEventListener(ev, ok); el.removeEventListener('error', bad); };
    el.addEventListener(ev, ok, { once: true });
    el.addEventListener('error', bad, { once: true });
  });
}

async function sampleVideo(ds, onProgress) {
  const v = document.createElement('video');
  v.muted = true; v.preload = 'auto'; v.playsInline = true;
  v.src = `api/media?url=${encodeURIComponent(ds.video.src)}`;
  await waitFor(v, 'loadedmetadata', 45000);
  const out = [];
  const n = ds.video.samples.length;
  for (let i = 0; i < n; i++) {
    onProgress?.(`Sampling video frame ${i + 1} of ${n} from NASA SVS…`);
    v.currentTime = ds.video.samples[i] * v.duration;
    await waitFor(v, 'seeked', 45000);
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = Math.round((1024 * v.videoHeight) / v.videoWidth);
    cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
    // analyse straight from the full-resolution video picture (the 1024 px copy is only for display)
    out.push({ label: ds.video.labelFor(i, n), date: ds.video.dateFor?.(i), url: cv.toDataURL('image/jpeg', 0.85), ch: analyzeDrawable(v, v.videoWidth, v.videoHeight, ds) });
  }
  v.removeAttribute('src'); v.load();
  return out;
}

/**
 * Load and analyse every frame of a dataset.
 * @returns {Promise<Array<{label:string,url:string,ch:Object,stats:Object}>>}
 */
export async function loadDataset(ds, onProgress) {
  const frames = STATIC ? await loadBaked(ds, onProgress) : await loadRawFrames(ds, onProgress);
  normalizeFrames(frames, ds);
  return frames;
}

/** Load + analyse frames from NASA SVS (local server), before cross-frame normalisation. */
export async function loadRawFrames(ds, onProgress) {
  let frames = null;
  if (ds.video) {
    try {
      frames = await sampleVideo(ds, onProgress);
    } catch (err) {
      console.warn('Video sampling failed, using still frames instead:', err);
      onProgress?.('Video unavailable, using still frames instead…');
    }
  }
  if (!frames) {
    // fetch up to 4 frames at a time; the server decodes and caches each one
    const n = ds.frames.length;
    frames = new Array(n);
    let next = 0, done = 0;
    onProgress?.(`Loading frame 0 of ${n} from NASA SVS…`);
    const worker = async () => {
      while (next < n) {
        const i = next++;
        const f = ds.frames[i];
        const url = frameUrl(f.src, ds);
        const img = await loadImage(url);
        frames[i] = { label: f.label, date: f.date, url, ch: analyzeDrawable(img, img.naturalWidth, img.naturalHeight, ds) };
        done++;
        onProgress?.(`Loading frame ${done} of ${n} (${f.label}) from NASA SVS…`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, n) }, worker));
  }
  return frames;
}

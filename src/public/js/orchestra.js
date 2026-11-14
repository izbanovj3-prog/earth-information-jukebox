// "Orchestra" mode: one colour language for every NASA map.
//
// Each colour family in the visualization is played by its own section of a real
// (sampled) chamber orchestra. The data decides WHO plays (colour), HOW LOUD (amount),
// WHICH NOTES (latitude) and WHERE (longitude = time and stereo). The music decides
// HOW: a steady tempo, a chord per bar chosen from the data's mood, a melody, a bass
// line and a groove whose density follows the data.
//
// Samples: VS Chamber Orchestra 2 Community Edition (CC0), built by tools/build-samples.js.

import { COLS, ROWS, lonOfCol, latOfRow, regionName, fmtLon } from './analyze.js';

// ---------- colour families -> sections ----------
export const FAMILIES = {
  red:    { label: 'Red → trumpets', color: '#ff5a4a', lead: 'trumpet' },
  orange: { label: 'Orange & brown → horns', color: '#ff9a3c', lead: 'horns' },
  yellow: { label: 'Yellow → harp', color: '#ffd84a', lead: 'harp' },
  green:  { label: 'Green → flute & clarinet', color: '#4fd06a', lead: 'flute' },
  blue:   { label: 'Blue & cyan → strings', color: '#4aa8ff', lead: 'violins' },
  violet: { label: 'Violet → violas', color: '#a07cff', lead: 'clarinet' },
  white:  { label: 'White → piano & glockenspiel', color: '#e8eefc', lead: 'piano' },
};
export const FOUNDATION = [
  { id: 'melody', label: 'Melody (lead colour)', color: '#ffcf5c' },
  { id: 'bass', label: 'Double bass', color: '#8a96b8' },
  { id: 'drums', label: 'Drums & timpani', color: '#c8b48a' },
];

// ---------- music theory ----------
const QUAL = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], sus2: [0, 2, 7] };
const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10] };
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** nearest midi note >= lo whose pitch class is in `pcs` (pitch classes relative to 0=C) */
function fit(pcs, lo) {
  for (let m = lo; m < lo + 12; m++) if (pcs.includes(((m % 12) + 12) % 12)) return m;
  return lo;
}
function snap(midi, pcs) {
  let best = midi, d = 99;
  for (let m = midi - 6; m <= midi + 6; m++) {
    if (pcs.includes(((m % 12) + 12) % 12) && Math.abs(m - midi) < d) { d = Math.abs(m - midi); best = m; }
  }
  return best;
}

// ---------- per-dataset orchestration ----------
// voices(frame, i, prev) -> [[family, level], ...] for grid cell i
// mood(frame) -> 0..1 (picks the darker progression when high)
const DS = {
  nightlights: {
    bpm: 96, tonic: 0, scale: 'major',
    progs: [[[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']]], // I V vi IV: hopeful, growing
    rhythm: [0, 3, 6, 8, 11, 14],
    voices(fr, i, prev) {
      const v = fr.ch.light[i];
      const out = [];
      if (v > 0.05) out.push(['yellow', v]);
      const grow = prev ? Math.max(0, v - prev.ch.light[i]) * 2.5 : 0;
      const white = Math.max(v > 0.55 ? v : 0, grow);
      if (white > 0.05) out.push(['white', Math.min(1, white)]);
      return out;
    },
    mood: () => 0,
  },
  ocean: {
    bpm: 76, tonic: 2, scale: 'dorian',
    progs: [[[0, 'min'], [5, 'maj'], [0, 'min'], [10, 'maj']]], // i IV i VII: flowing, modal
    rhythm: [0, 4, 6, 8, 12],
    voices(fr, i) {
      const T = fr.ch.temp[i];
      if (T < 0) return [];
      const lvl = 0.35 + 0.65 * Math.min(1, fr.ch.flow[i]);
      const fam = T < 0.42 ? 'blue' : T < 0.58 ? 'green' : T < 0.72 ? 'yellow' : T < 0.85 ? 'orange' : 'red';
      return [[fam, lvl]];
    },
    mood: () => 0,
  },
  aerosols: {
    bpm: 88, tonic: 9, scale: 'major',
    progs: [[[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']], [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']]],
    scaleDark: 'minor',
    rhythm: [0, 3, 4, 8, 10, 12],
    voices(fr, i) {
      const { carbon, dust, salt, sulfate } = fr.ch;
      const out = [];
      if (carbon[i] > 0.04) out.push([carbon[i] > 0.6 ? 'red' : 'orange', carbon[i]]);
      if (dust[i] > 0.04) out.push(['violet', dust[i]]);
      if (salt[i] > 0.04) out.push(['white', salt[i]]);
      if (sulfate[i] > 0.04) out.push(['green', sulfate[i]]);
      return out;
    },
    mood: (fr) => Math.min(1, fr.stats.load * 2.2),
  },
  lightning: {
    bpm: 120, tonic: 4, scale: 'minor',
    progs: [[[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']]], // i VI III VII: dramatic
    rhythm: [0, 3, 6, 10, 12],
    percFromData: true,
    voices(fr, i) {
      const v = fr.ch.flash[i];
      return v > 0.1 ? [['yellow', v]] : [];
    },
    mood: () => 0,
  },
  airquality: {
    bpm: 100, tonic: 5, scale: 'minor',
    progs: [[[0, 'min'], [8, 'maj'], [5, 'min'], [7, 'maj']], [[0, 'min'], [8, 'maj'], [2, 'dim'], [7, 'maj']]],
    rhythm: [0, 2, 6, 8, 11, 14],
    voices(fr, i) {
      const { co, pm, nox, o3 } = fr.ch;
      const out = [];
      if (co[i] > 0.15) out.push([co[i] > 0.5 ? 'red' : 'yellow', co[i]]);
      if (pm[i] > 0.15) out.push(['orange', pm[i]]);
      if (nox[i] > 0.15) out.push(['green', nox[i]]);
      if (o3[i] > 0.15) out.push(['violet', o3[i]]);
      return out;
    },
    mood: (fr) => Math.min(1, (fr.stats.smoke || 0) * 3),
  },
};
export const orchestraFor = (id) => DS[id];
export const BARS = 4; // a frame = 4 bars of 4/4 = 64 sixteenth notes = 64 map columns
export const sweepForBpm = (bpm) => (BARS * 4 * 60) / bpm;

/** Families that actually appear in a dataset (for the mixer). */
export function familiesUsed(frames, ds) {
  const used = new Set();
  for (let f = 0; f < frames.length; f++) {
    const a = analyse(ds, frames, f);
    for (const fam of Object.keys(FAMILIES)) if (a.total[fam] > 0.002) used.add(fam);
  }
  return Object.keys(FAMILIES).filter((k) => used.has(k));
}

// ---------- per-frame analysis (memoised on the frame) ----------
function analyse(ds, frames, f) {
  const fr = frames[f];
  if (fr._orch) return fr._orch;
  const cfg = DS[ds.id];
  const prev = f > 0 ? frames[f - 1] : null;
  const fams = Object.keys(FAMILIES);
  const grid = Object.fromEntries(fams.map((k) => [k, new Float32Array(ROWS * COLS)]));
  for (let i = 0; i < ROWS * COLS; i++) for (const [fam, lvl] of cfg.voices(fr, i, prev)) grid[fam][i] = Math.max(grid[fam][i], lvl);

  // per column: level (mean over rows) and centroid row for each family
  const col = {}, row = {}, total = {};
  for (const fam of fams) {
    col[fam] = new Float32Array(COLS); row[fam] = new Float32Array(COLS);
    let t = 0;
    for (let c = 0; c < COLS; c++) {
      let s = 0, wr = 0;
      for (let r = 0; r < ROWS; r++) { const v = grid[fam][r * COLS + c]; s += v; wr += v * r; }
      col[fam][c] = s / ROWS; row[fam][c] = s > 0 ? wr / s : ROWS / 2; t += s / ROWS;
    }
    total[fam] = t / COLS;
  }
  // bar intensity
  const bars = [];
  for (let b = 0; b < BARS; b++) {
    let s = 0;
    for (let c = b * 16; c < b * 16 + 16; c++) for (const fam of fams) s += col[fam][c];
    bars.push(s / 16);
  }
  // lead colour = strongest family in this frame
  const lead = fams.slice().sort((a, b) => total[b] - total[a])[0];
  // harmony
  const mood = cfg.mood(fr);
  const prog = cfg.progs[mood > 0.5 && cfg.progs[1] ? 1 : 0];
  const scaleName = mood > 0.5 && cfg.scaleDark ? cfg.scaleDark : cfg.scale;
  const chords = prog.map(([root, qual]) => {
    const pcs = QUAL[qual].map((x) => (cfg.tonic + root + x) % 12);
    return { root: (cfg.tonic + root) % 12, qual, pcs, name: `${NAMES[(cfg.tonic + root) % 12]}${qual === 'min' ? 'm' : qual === 'dim' ? '°' : ''}` };
  });
  const scalePcs = SCALE[scaleName].map((x) => (cfg.tonic + x) % 12);

  // melody: follows the lead colour's latitude, rhythm from the dataset pattern, smoothed leaps
  const melody = new Array(COLS).fill(null);
  let last = null;
  for (let c = 0; c < COLS; c++) {
    const s = c % 16;
    if (!cfg.rhythm.includes(s)) continue;
    const lvl = col[lead][c];
    if (lvl < 0.03) { last = null; continue; }
    const deg = Math.round((1 - row[lead][c] / (ROWS - 1)) * 12);
    const sc = SCALE[scaleName];
    let m = 60 + 12 * Math.floor(deg / sc.length) + sc[deg % sc.length] + cfg.tonic - 0;
    const chord = chords[Math.floor(c / 16)];
    if (s % 4 === 0) m = snap(m, chord.pcs); else m = snap(m, scalePcs);
    if (last != null && Math.abs(m - last) > 7) m = snap(Math.round((m + last) / 2), s % 4 === 0 ? chord.pcs : scalePcs);
    melody[c] = { midi: m, lvl };
    last = m;
  }
  fr._orch = { grid, col, row, total, bars, lead, chords, scalePcs, melody, mood };
  return fr._orch;
}

export function orchestraRef(ds, frames) { return refLevel(ds, frames); }
function refLevel(ds, frames) {
  if (frames._orchRef) return frames._orchRef;
  let m = 0.05;
  for (let f = 0; f < frames.length; f++) for (const b of analyse(ds, frames, f).bars) m = Math.max(m, b);
  frames._orchRef = m;
  return m;
}

// instrument ranges (sounding midi) used for voicing
const RANGE = {
  violins: [55, 88], cellos: [36, 64], violas: [48, 76], harp: [36, 96], horns: [41, 72], trumpet: [55, 82],
  flute: [60, 93], clarinet: [50, 86], piano: [36, 96], glock: [79, 105], bass: [28, 52], pizz: [55, 84],
};
const clampTo = (inst, m) => {
  const [lo, hi] = RANGE[inst] || [24, 108];
  while (m < lo) m += 12;
  while (m > hi) m -= 12;
  return m;
};
const latOct = (row) => Math.round((1 - row / (ROWS - 1)) * 2); // 0..2 octaves up for the north
const pan = (c) => (c / (COLS - 1)) * 1.4 - 0.7;

// ---------- the composer (same interface as the scientific ones) ----------
export const ORCHESTRA_COMPOSER = {
  frameStart(E, frames, f, t, dur, ds) {
    const a = analyse(ds, frames, f);
    const ref = refLevel(ds, frames);
    const lvl = Math.min(1, a.bars[0] / ref);
    E.layer = 'drums';
    E.sample('timpani', t, 36 + a.chords[0].root, 0.25 + 0.4 * lvl, 0);
    E.sample('triangle', t + 0.01, null, 0.12, 0.3);
  },

  step(E, frames, f, c, t, rnd, S, ds) {
    const cfg = DS[ds.id];
    const a = analyse(ds, frames, f);
    const ref = refLevel(ds, frames);
    const s = c % 16, bar = Math.floor(c / 16);
    const chord = a.chords[bar];
    const I = Math.min(1, a.bars[bar] / ref); // groove intensity
    const P = pan(c);

    // --- sustained sections, once per bar, voiced by the colour's latitude ---
    if (s === 0) {
      const barLvl = (fam) => { let x = 0; for (let k = bar * 16; k < bar * 16 + 16; k++) x += a.col[fam][k]; return x / 16; };
      const barRow = (fam) => { let x = 0, w = 0; for (let k = bar * 16; k < bar * 16 + 16; k++) { x += a.row[fam][k] * a.col[fam][k]; w += a.col[fam][k]; } return w ? x / w : ROWS / 2; };
      const dur = 16 * S * 1.02;
      const blue = barLvl('blue');
      if (blue > 0.01) {
        E.layer = 'blue';
        const v = Math.min(0.55, 0.12 + blue * 0.9);
        E.sample('cellos', t, clampTo('cellos', 36 + chord.root), v, -0.35, { dur, attack: 0.15, release: 0.6 });
        const o = latOct(barRow('blue'));
        E.sample('violins', t + 0.02, clampTo('violins', fit(chord.pcs, 64 + 12 * (o - 1) + 0)), v * 0.8, 0.3, { dur, attack: 0.2, release: 0.7 });
        E.sample('violins', t + 0.03, clampTo('violins', fit(chord.pcs, 69 + 12 * (o - 1))), v * 0.7, 0.45, { dur, attack: 0.2, release: 0.7 });
      }
      const orange = barLvl('orange');
      if (orange > 0.01) {
        E.layer = 'orange';
        const v = Math.min(0.5, 0.1 + orange * 0.9);
        E.sample('horns', t, clampTo('horns', 48 + chord.root), v, -0.15, { dur, attack: 0.12, release: 0.5 });
        E.sample('horns', t + 0.02, clampTo('horns', fit(chord.pcs, 55)), v * 0.8, 0.15, { dur, attack: 0.12, release: 0.5 });
      }
      const violet = barLvl('violet');
      if (violet > 0.01) {
        E.layer = 'violet';
        const v = Math.min(0.5, 0.1 + violet * 0.9);
        const o = latOct(barRow('violet'));
        E.sample('violas', t, clampTo('violas', fit(chord.pcs, 55 + 6 * o)), v, -0.2, { dur, attack: 0.25, release: 0.7 });
        E.sample('violas', t + 0.02, clampTo('violas', fit(chord.pcs, 62 + 6 * o)), v * 0.8, 0.2, { dur, attack: 0.25, release: 0.7 });
      }
      const green = barLvl('green');
      if (green > 0.01) {
        E.layer = 'green';
        E.sample('clarinet', t, clampTo('clarinet', fit(chord.pcs, 57)), Math.min(0.4, 0.08 + green * 0.7), 0.1, { dur, attack: 0.2, release: 0.5 });
      }
    }

    // --- per-step colour voices along the playhead ---
    const yellow = a.col.yellow[c];
    if (yellow > 0.02 && (s % 2 === 0 || yellow > 0.35)) {
      E.layer = 'yellow';
      const o = latOct(a.row.yellow[c]);
      const tone = chord.pcs[(s / 2 | 0) % chord.pcs.length];
      const m = clampTo('harp', fit([tone], 55 + 12 * o));
      E.sample('harp', t, m, Math.min(0.75, 0.15 + yellow * 1.6), P);
    }
    const white = a.col.white[c];
    if (white > 0.02) {
      E.layer = 'white';
      if ([2, 7, 10, 15].includes(s) && rnd() < 0.4 + white * 2) {
        E.sample('glock', t, clampTo('glock', fit(chord.pcs, 84 + 12 * (latOct(a.row.white[c]) - 1))), Math.min(0.45, 0.08 + white * 0.9), P);
      }
      if (s % 4 === 0 && white > 0.06) {
        E.sample('piano', t, clampTo('piano', fit(chord.pcs, 60 + 12 * (latOct(a.row.white[c]) - 1))), Math.min(0.6, 0.12 + white * 1.2), P);
      }
    }
    const red = a.col.red[c];
    if (red > 0.02 && [0, 6, 12].includes(s)) {
      E.layer = 'red';
      E.sample('trumpet', t, clampTo('trumpet', fit(chord.pcs, 67)), Math.min(0.6, 0.15 + red * 1.2), P);
      E.sample('trumpet', t + 0.01, clampTo('trumpet', fit(chord.pcs, 62)), Math.min(0.5, 0.12 + red), P);
    }
    const green = a.col.green[c];
    if (green > 0.05 && s % 4 === 2 && a.lead !== 'green') {
      E.layer = 'green';
      E.sample('flute', t, clampTo('flute', fit(chord.pcs, 76)), Math.min(0.35, 0.08 + green * 0.6), P, { dur: S * 1.6, attack: 0.03, release: 0.15 });
    }

    // --- melody in the lead colour's instrument ---
    const mel = a.melody[c];
    if (mel) {
      let next = c + 1;
      while (next < COLS && !a.melody[next] && next - c < 6) next++;
      const len = (next - c) * S * 1.05;
      const inst = FAMILIES[a.lead].lead;
      E.layer = 'melody';
      const sustained = ['violins', 'flute', 'clarinet', 'horns'].includes(inst);
      E.sample(inst, t, clampTo(inst, mel.midi), Math.min(0.7, 0.25 + mel.lvl * 1.4), P * 0.5, sustained ? { dur: len, attack: 0.04, release: 0.25 } : {});
    }

    // --- bass line: roots on 1 and 3, approach note on the "and" of 4 ---
    E.layer = 'bass';
    const bassVel = 0.25 + 0.45 * I;
    if (s === 0) E.sample('bass', t, clampTo('bass', 36 + chord.root), bassVel, -0.1);
    if (s === 8) E.sample('bass', t, clampTo('bass', 36 + (I > 0.5 ? (chord.root + 7) % 12 : chord.root)), bassVel * 0.85, -0.1);
    if (s === 14 && I > 0.45) {
      const nextRoot = a.chords[(bar + 1) % BARS].root;
      E.sample('bass', t, clampTo('bass', 36 + nextRoot - 1), bassVel * 0.7, -0.1);
    }

    // --- groove ---
    E.layer = 'drums';
    if (cfg.percFromData) {
      // lightning: every flash cluster is a drum hit
      const flashes = [];
      for (let r = 0; r < ROWS; r++) { const v = frames[f].ch.flash[r * COLS + c]; if (v > 0.12) flashes.push([r, v]); }
      flashes.sort((x, y) => y[1] - x[1]);
      flashes.slice(0, 3).forEach(([r, v], k) => {
        const when = t + (k ? rnd() * S : 0);
        if (r < ROWS / 2) E.sample('snare', when, null, Math.min(0.6, 0.1 + v * 0.6), P);
        else E.sample('timpani', when, 36 + chord.root, Math.min(0.7, 0.15 + v * 0.7), P);
      });
      if (s === 0) E.sample('kick', t, null, 0.35, 0);
      if (flashes.length >= 3 && s % 4 === 0) E.sample('cymbal', t, null, 0.08, P, { dur: S * 6, release: 0.6 });
    } else {
      if (s === 0) E.sample('kick', t, null, 0.25 + 0.35 * I, 0);
      if (s === 8 && I > 0.25) E.sample('kick', t, null, 0.2 + 0.3 * I, 0);
      if ((s === 6 || s === 10) && I > 0.65) E.sample('kick', t, null, 0.15 + 0.2 * I, 0);
      if ((s === 4 || s === 12) && I > 0.35) E.sample('snare', t, null, 0.12 + 0.3 * I, 0.05);
      if (s % 2 === 1 && I > 0.5) E.sample('shaker', t, null, 0.05 + 0.12 * I, 0.35);
    }
    // cymbal swell into the next frame
    if (c === COLS - 8) E.sample('cymbal', t, null, 0.18, 0, { dur: S * 7.5, attack: 0.01, release: 0.3 });
  },

  describe(frames, f, c, ds) {
    const a = analyse(ds, frames, f);
    const lon = lonOfCol(c, frames.geo);
    const playing = Object.keys(FAMILIES).filter((k) => a.col[k][c] > 0.03)
      .sort((x, y) => a.col[y][c] - a.col[x][c]).slice(0, 3)
      .map((k) => FAMILIES[k].label.split('→')[1].trim());
    const chord = a.chords[Math.floor(c / 16)].name;
    const where = playing.length ? regionName(latOfRow(a.row[Object.keys(FAMILIES).sort((x, y) => a.col[y][c] - a.col[x][c])[0]][c], frames.geo), lon) : null;
    return `${frames[f].label}, ${fmtLon(lon)}${where ? ` over ${where}` : ''}: ${playing.length ? playing.join(', ') : 'bass and drums only'} · chord ${chord}.`;
  },

  probeFamily(ds, frames, f, r, c) {
    const a = analyse(ds, frames, f);
    let best = null, v = 0;
    for (const fam of Object.keys(FAMILIES)) { const x = a.grid[fam][r * COLS + c]; if (x > v) { v = x; best = fam; } }
    return best ? { fam: best, lvl: v } : null;
  },
};

/** Play one cell in the orchestra's voice (map explorer). */
export function probeOrchestra(E, ds, frames, f, r, c) {
  const hit = ORCHESTRA_COMPOSER.probeFamily(ds, frames, f, r, c);
  const t = E.ctx.currentTime + 0.01;
  E.layer = 'probe';
  const m = 48 + Math.round((1 - r / (ROWS - 1)) * 30);
  if (!hit) { E.sample('pizz', t, 55, 0.12, 0); return null; }
  const inst = FAMILIES[hit.fam].lead;
  E.sample(inst, t, clampTo(inst, m), Math.min(0.7, 0.2 + hit.lvl), pan(c), ['violins', 'flute', 'clarinet', 'horns'].includes(inst) ? { dur: 0.6, attack: 0.03, release: 0.3 } : {});
  return hit;
}

// ---------- sample bank ----------
let bankPromise = null;
export function loadSamples(decodeCtx, onProgress) {
  if (bankPromise) return bankPromise;
  bankPromise = (async () => {
    const manifest = await (await fetch('samples/manifest.json')).json();
    const jobs = [];
    for (const [id, ins] of Object.entries(manifest.instruments)) for (const z of ins.zones) jobs.push([id, z]);
    let done = 0;
    const bank = {};
    for (const [id, ins] of Object.entries(manifest.instruments)) bank[id] = { pitched: ins.pitched, zones: [] };
    await Promise.all(jobs.map(async ([id, z]) => {
      const buf = await (await fetch(`samples/${z.file}`)).arrayBuffer();
      const audio = await decodeCtx.decodeAudioData(buf);
      bank[id].zones.push({ midi: z.midi, buffer: audio });
      onProgress?.(++done, jobs.length);
    }));
    for (const ins of Object.values(bank)) ins.zones.sort((x, y) => (x.midi ?? 0) - (y.midi ?? 0));
    return bank;
  })();
  bankPromise.catch(() => { bankPromise = null; });
  return bankPromise;
}

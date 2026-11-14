// Sonification engine: Web Audio synths + per-dataset mapping rules ("composers").
// The same code drives live playback (AudioContext) and offline WAV rendering
// (OfflineAudioContext). All randomness is seeded per step, so a rendered track
// is exactly what the live jukebox plays at the same tempo.

import { COLS, ROWS, lonOfCol, latOfRow, fmtLat, fmtLon, regionName } from './analyze.js';
import { ORCHESTRA_COMPOSER, probeOrchestra } from './orchestra.js';

// One frame = one west→east sweep. Tempo is adjustable.
export let SWEEP_SECONDS = 8;
export let STEP = SWEEP_SECONDS / COLS;
export function setSweep(seconds) {
  SWEEP_SECONDS = seconds;
  STEP = seconds / COLS;
}
// 'science' = direct synth sonification, 'orchestra' = sampled orchestra with harmony
export let MODE = 'science';
export function setMode(m) { MODE = m; }

// ---------- music helpers ----------
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const SCALES = {
  majPent: [0, 2, 4, 7, 9],
  minPent: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};
function note(root, scale, deg) {
  const s = SCALES[scale], n = s.length;
  const o = Math.floor(deg / n);
  return root + 12 * o + s[((deg % n) + n) % n];
}
/** latitude -> scale degree: north = high */
const rowDeg = (r, span) => Math.round((1 - r / (ROWS - 1)) * span);
const panOf = (c) => (c / (COLS - 1)) * 1.4 - 0.7; // west = left, east = right

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7);

// ---------- engine (synths + mixer) ----------
export class Engine {
  constructor(ctx, destination = ctx.destination) {
    this.ctx = ctx;
    this.muted = new Set();
    this.layer = 'main';
    this.activity = {}; // voices started per layer since the UI last looked (for the mixer lights)
    const rand = mulberry32(1234);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = rand() * 2 - 1;

    // master chain: layers -> bus -> tone -> compressor -> volume -> destination, + reverb send
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass'; this.tone.frequency.value = 9000; this.tone.Q.value = 0.5;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18; this.comp.ratio.value = 3; this.comp.attack.value = 0.01; this.comp.release.value = 0.25;
    this.volume = ctx.createGain(); this.volume.gain.value = 0.8;
    this.tone.connect(this.comp); this.comp.connect(this.volume); this.volume.connect(destination);

    const verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 3.2);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (rand() * 2 - 1) * (1 - i / len) ** 3.2;
    }
    verb.buffer = ir;
    this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.32;
    const wet = ctx.createGain(); wet.gain.value = 0.9;
    this.verbIn.connect(verb); verb.connect(wet); wet.connect(this.comp);

    this.analyser = null;
    if (typeof OfflineAudioContext === 'undefined' || !(ctx instanceof OfflineAudioContext)) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.75;
      this.volume.connect(this.analyser);
    }
    this.newBus();
  }

  /** Fresh voice bus. Old one is faded out, which silences everything already scheduled. */
  newBus() {
    const ctx = this.ctx;
    if (this.bus) {
      const old = this.bus, t = ctx.currentTime;
      old.gain.cancelScheduledValues(t);
      old.gain.setValueAtTime(old.gain.value, t);
      old.gain.linearRampToValueAtTime(0, t + 0.15);
      setTimeout(() => old.disconnect(), 400);
    }
    this.bus = ctx.createGain();
    this.bus.connect(this.tone);
    this.bus.connect(this.verbIn);
    this.layerNodes = new Map();
  }

  setVolume(v) { this.volume.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }

  setMuted(layer, muted) {
    if (muted) this.muted.add(layer); else this.muted.delete(layer);
    const g = this.layerNodes.get(layer);
    if (g) g.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.04);
  }

  _layerNode(name) {
    let g = this.layerNodes.get(name);
    if (!g) {
      g = this.ctx.createGain();
      g.gain.value = this.muted.has(name) ? 0 : 1;
      g.connect(this.bus);
      this.layerNodes.set(name, g);
    }
    return g;
  }

  _out(pan) {
    this.activity[this.layer] = (this.activity[this.layer] || 0) + 1;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan || 0));
    p.connect(this._layerNode(this.layer));
    return p;
  }

  /** short plucked note */
  pluck(t, freq, vel, pan = 0, { type = 'triangle', decay = 0.7, cutoff = 3500 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(this._out(pan));
    o.start(t); o2.start(t); o.stop(t + decay + 0.05); o2.stop(t + decay + 0.05);
  }

  /** FM bell */
  bell(t, freq, vel, pan = 0, decay = 2.2) {
    const ctx = this.ctx;
    const car = ctx.createOscillator(); car.frequency.value = freq;
    const mod = ctx.createOscillator(); mod.frequency.value = freq * 3.5;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(freq * 1.8, t);
    mg.gain.exponentialRampToValueAtTime(freq * 0.05, t + decay * 0.6);
    mod.connect(mg); mg.connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    car.connect(g); g.connect(this._out(pan));
    car.start(t); mod.start(t); car.stop(t + decay + 0.05); mod.stop(t + decay + 0.05);
  }

  /** detuned, filtered pad; cutoff can glide from cutoff to cutoff1 */
  pad(t, dur, freqs, vel, { type = 'sawtooth', cutoff = 1200, cutoff1, detune = 7, vibrato = 0, attack = 1, release = 1.2, pan = 0 } = {}) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(cutoff, t);
    if (cutoff1) f.frequency.linearRampToValueAtTime(cutoff1, t + dur);
    const g = ctx.createGain();
    const end = t + dur + release;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + attack);
    g.gain.setValueAtTime(vel, t + Math.max(attack, dur));
    g.gain.linearRampToValueAtTime(0, end);
    f.connect(g); g.connect(this._out(pan));
    let lfoGain = null;
    if (vibrato > 0) {
      const lfo = ctx.createOscillator(); lfo.frequency.value = 4.5 + vibrato * 0.04;
      lfoGain = ctx.createGain(); lfoGain.gain.value = vibrato;
      lfo.connect(lfoGain); lfo.start(t); lfo.stop(end + 0.05);
    }
    const per = 1 / Math.sqrt(freqs.length * 2);
    for (const fr of freqs) {
      for (const d of [-detune, detune]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = fr; o.detune.value = d;
        if (lfoGain) lfoGain.connect(o.detune);
        const og = ctx.createGain(); og.gain.value = per;
        o.connect(og); og.connect(f);
        o.start(t); o.stop(end + 0.05);
      }
    }
  }

  /** breathy noise pad tuned to a pitch (smoke) */
  breath(t, dur, freq, vel, pan = 0) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 7;
    const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = freq * 1.5; bp2.Q.value = 9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(bp); src.connect(bp2); bp.connect(g); bp2.connect(g); g.connect(this._out(pan));
    src.start(t, (t * 0.37) % 1.5); src.stop(t + dur + 0.05);
  }

  /** tiny crackle grain (fire / particulates) */
  grain(t, vel, freq, pan = 0) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(bp); bp.connect(g); g.connect(this._out(pan));
    src.start(t, (t * 0.913) % 1.9); src.stop(t + 0.05);
  }

  /** percussive crack + pitched ping (lightning) */
  hit(t, vel, freq, pan = 0) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(hp); hp.connect(g);
    const out = this._out(pan);
    g.connect(out);
    src.start(t, (t * 0.731) % 1.8); src.stop(t + 0.12);

    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(vel * 0.7, t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(og); og.connect(out);
    o.start(t); o.stop(t + 0.5);
  }

  /**
   * Play a recorded orchestral sample (see orchestra.js / samples/manifest.json).
   * Pitched instruments pick the nearest recorded note and repitch it; long notes loop
   * inside the sustain part of the recording. Returns false if the bank is not loaded.
   */
  sample(inst, t, midi, vel, pan = 0, { dur = null, attack = 0.006, release = 0.35 } = {}) {
    const ins = this.samples?.[inst];
    if (!ins || !ins.zones.length) return false;
    const ctx = this.ctx;
    let z = ins.zones[0], rate = 1;
    if (ins.pitched && midi != null) {
      if (inst === 'timpani') {
        // timpani: closest pitch class, shifted by at most a tritone
        let best = Infinity;
        for (const zz of ins.zones) {
          const d = ((((midi - zz.midi) % 12) + 18) % 12) - 6;
          if (Math.abs(d) < Math.abs(best)) { best = d; z = zz; }
        }
        rate = 2 ** (best / 12);
      } else {
        for (const zz of ins.zones) if (Math.abs(zz.midi - midi) < Math.abs(z.midi - midi)) z = zz;
        rate = 2 ** ((midi - z.midi) / 12);
      }
    } else {
      z = ins.zones[Math.floor(((t * 1000) % 997)) % ins.zones.length]; // cheap deterministic round-robin
    }
    const src = ctx.createBufferSource();
    src.buffer = z.buffer;
    src.playbackRate.value = rate;
    const natural = z.buffer.duration / rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + attack);
    let end;
    if (dur != null) {
      // never loop (loop seams click); fit the note inside the recording instead
      if (dur + release > natural - 0.02) {
        release = Math.min(release, natural * 0.3);
        dur = Math.max(attack, natural - 0.02 - release);
      }
      g.gain.setValueAtTime(vel, t + Math.max(attack, dur));
      g.gain.linearRampToValueAtTime(0, t + dur + release);
      end = t + dur + release + 0.02;
    } else end = t + natural + 0.02;
    src.connect(g); g.connect(this._out(pan));
    src.start(t); src.stop(end);
    return true;
  }

  /** low thunder rumble */
  rumble(t, dur, vel, pan = 0) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140; lp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp); lp.connect(g); g.connect(this._out(pan));
    src.start(t, (t * 0.53) % 1.5); src.stop(t + dur + 0.05);
  }
}

// ---------- composers: data -> music ----------
const colCells = (a, c) => { const out = []; for (let r = 0; r < ROWS; r++) out.push(a[r * COLS + c]); return out; };
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function topRows(a, c, thr, max) {
  const rows = [];
  for (let r = 0; r < ROWS; r++) { const v = a[r * COLS + c]; if (v > thr) rows.push([r, v]); }
  return rows.sort((x, y) => y[1] - x[1]).slice(0, max);
}
const where = (frames, r, c) => {
  const lat = latOfRow(r, frames.geo), lon = lonOfCol(c, frames.geo);
  return { lat, lon, region: regionName(lat, lon) };
};

const AQ_NAMES = { co: 'carbon monoxide', pm: 'fine particulate (PM2.5) smoke', nox: 'nitrogen oxides', o3: 'ozone' };
function aqStrip(ch, c) {
  let best = null, bestSum = 0;
  for (const k of ['co', 'pm', 'nox', 'o3']) {
    let s = 0, n = 0;
    for (let r = 0; r < ROWS; r++) { const v = ch[k][r * COLS + c]; if (v > 0) { s += v; n++; } }
    if (n > bestSum) { bestSum = n; best = k; }
    ch[`_${k}`] = n ? s / n : 0;
  }
  return bestSum >= 4 ? best : null;
}

const COMPOSERS = {
  nightlights: {
    frameStart(E, frames, f, t, dur) {
      // planet-wide brightness: ~0.24 in 2012 -> ~0.56 in 2023, so the chord fills in over the years
      const L = Math.max(0, Math.min(1, (frames[f].stats.light - 0.03) * 25));
      const chord = [36, 43, 48, ...(L > 0.35 ? [52] : []), ...(L > 0.5 ? [55] : [])].map(mtof);
      E.layer = 'glow';
      E.pad(t, dur, chord, 0.05 + 0.06 * L, { cutoff: 250 + 900 * L, cutoff1: 350 + 1600 * L, attack: Math.min(1.5, dur / 3), release: 1.5 });
    },
    step(E, frames, f, c, t, rnd) {
      const a = frames[f].ch.light;
      const prev = f > 0 ? frames[f - 1].ch.light : null;
      const colSum = colCells(a, c).reduce((s, v) => s + v, 0);
      const n = Math.min(4, Math.ceil(colSum * 1.6));
      const rows = topRows(a, c, 0.06, n);
      E.layer = 'lights';
      rows.forEach(([r, v], i) => {
        const m = note(48, 'majPent', rowDeg(r, 16));
        E.pluck(t + (i * STEP) / Math.max(1, rows.length), mtof(m), 0.04 + 0.2 * v, panOf(c), { decay: 0.4 + 0.6 * v, cutoff: 1500 + 3500 * v });
      });
      if (prev) {
        E.layer = 'growth';
        for (let r = 0; r < ROWS; r++) {
          const d = a[r * COLS + c] - prev[r * COLS + c];
          if (d > 0.1 && rnd() < 0.5 + d) {
            E.bell(t + rnd() * STEP, mtof(note(72, 'majPent', rowDeg(r, 10))), 0.03 + 0.12 * Math.min(1, d * 2), panOf(c), 1.8);
            break;
          }
        }
      }
    },
    describe(frames, f, c) {
      const a = frames[f].ch.light;
      const rows = topRows(a, c, 0.06, 1);
      const lon = lonOfCol(c, frames.geo);
      if (!rows.length) return `${frames[f].label}, ${fmtLon(lon)}: darkness, almost silent.`;
      const [r, v] = rows[0];
      const w = where(frames, r, c);
      const word = v > 0.6 ? 'very bright, dense lights' : v > 0.3 ? 'bright lights' : 'scattered lights';
      return `${frames[f].label}, ${fmtLon(lon)}: ${word} over ${w.region}, strongest near ${fmtLat(w.lat)}.`;
    },
    probe: (frame, r, c) => frame.ch.light[r * COLS + c],
    probeText(frame, r, c) {
      const v = frame.ch.light[r * COLS + c];
      return `${v > 0.5 ? 'Bright city lights' : v > 0.15 ? 'Some lights' : v > 0.03 ? 'Faint lights' : 'Dark'}, intensity ${Math.round(v * 100)} percent`;
    },
  },

  ocean: {
    frameStart(E, frames, f, t, dur) {
      E.layer = 'deep';
      E.pad(t, dur, [mtof(26), mtof(38)], 0.05, { type: 'sine', cutoff: 400, attack: Math.min(2, dur / 3), release: 2 });
    },
    step(E, frames, f, c, t, rnd) {
      const { temp, flow } = frames[f].ch;
      if (c % 4 === 0) {
        E.layer = 'warmth';
        const bands = [[0, 10, 9], [11, 20, 5], [21, 31, 0]]; // rows, base degree (north highest)
        bands.forEach(([r0, r1, base], bi) => {
          const temps = [], flows = [];
          for (let cc = c; cc < Math.min(COLS, c + 4); cc++) {
            for (let r = r0; r <= r1; r++) {
              const v = temp[r * COLS + cc];
              if (v >= 0) { temps.push(v); flows.push(flow[r * COLS + cc]); }
            }
          }
          const water = temps.length / ((r1 - r0 + 1) * 4);
          if (water < 0.15) return;
          const T = avg(temps), F = avg(flows);
          const m = note(50, 'dorian', base + Math.round(T * 6));
          E.pad(t + bi * 0.05, STEP * 4 * 1.3, [mtof(m), mtof(m + 7)], 0.05 + 0.07 * water, {
            cutoff: 300 + 2800 * T, vibrato: F * 22, attack: Math.min(0.5, STEP * 2), release: 1.2, pan: panOf(c) * 0.8, detune: 5 + F * 10,
          });
        });
      }
      // droplets: turbulent water
      E.layer = 'eddies';
      const cand = [];
      for (let r = 0; r < ROWS; r++) {
        const fl = flow[r * COLS + c];
        if (temp[r * COLS + c] >= 0 && fl > 0.45) cand.push([r, fl]);
      }
      let played = 0;
      for (const [r, fl] of cand.sort((x, y) => y[1] - x[1])) {
        if (played >= 2) break;
        if (rnd() < fl * 0.55) {
          E.pluck(t + rnd() * STEP, mtof(note(74, 'dorian', rowDeg(r, 9))), 0.03 + 0.06 * fl, panOf(c), { type: 'sine', decay: 0.35, cutoff: 6000 });
          played++;
        }
      }
    },
    describe(frames, f, c) {
      const { temp, flow } = frames[f].ch;
      const temps = colCells(temp, c).filter((v) => v >= 0);
      const lon = lonOfCol(c, frames.geo);
      if (temps.length < 3) return `${frames[f].label}, ${fmtLon(lon)}: mostly land, the ocean voices rest.`;
      const T = avg(temps), F = avg(colCells(flow, c).filter((v) => v > 0));
      const tw = T > 0.65 ? 'warm' : T > 0.4 ? 'mild' : 'cold';
      const fw = F > 0.45 ? 'turbulent, swirling' : F > 0.25 ? 'flowing' : 'calm';
      const warm = topRows(temp, c, 0, 1)[0];
      const w = warm ? where(frames, warm[0], c) : null;
      const at = w ? `${w.region}, warmest near ${fmtLat(w.lat)}` : regionName(0, lon);
      return `${frames[f].label}, ${fmtLon(lon)}, ${at}: ${tw}, ${fw} water.`;
    },
    probe: (frame, r, c) => Math.max(0, frame.ch.temp[r * COLS + c]),
    probeText(frame, r, c) {
      const v = frame.ch.temp[r * COLS + c];
      if (v < 0) return 'Land';
      return `Water, ${v > 0.65 ? 'warm' : v > 0.4 ? 'mild' : 'cold'} (${Math.round(v * 100)} on a cold-to-warm scale), currents ${frame.ch.flow[r * COLS + c] > 0.45 ? 'turbulent' : 'gentle'}`;
    },
  },

  aerosols: {
    frameStart(E, frames, f, t, dur) {
      E.layer = 'harmony';
      E.pad(t, dur, [mtof(33), mtof(40)], 0.04, { type: 'triangle', cutoff: 300, attack: Math.min(2, dur / 3), release: 2 });
    },
    step(E, frames, f, c, t, rnd) {
      const ch = frames[f].ch;
      const span = (name) => {
        let s = 0, wr = 0, n = 0;
        for (let cc = c; cc < Math.min(COLS, c + 4); cc++) for (let r = 0; r < ROWS; r++) {
          const v = ch[name][r * COLS + cc]; s += v; wr += v * r; n++;
        }
        return { d: s / n, row: s > 0 ? wr / s : ROWS / 2 };
      };
      if (c % 4 === 0) {
        const dust = span('dust'), carbon = span('carbon'), salt = span('salt'), sul = span('sulfate');
        const load = dust.d + carbon.d + salt.d + sul.d;
        const scale = load > 0.32 ? 'minor' : 'major';
        const bar = STEP * 4;
        if (dust.d > 0.01) {
          E.layer = 'dust';
          const m = note(33, scale, Math.round(rowDeg(dust.row, 7)));
          E.pad(t, bar * 1.2, [mtof(m), mtof(m + 12)], Math.min(0.16, 0.03 + dust.d * 0.6), { type: 'sawtooth', cutoff: 180 + 900 * dust.d, detune: 14, attack: Math.min(0.3, bar / 2), release: 0.8, pan: panOf(c) });
        }
        if (carbon.d > 0.01) {
          E.layer = 'smoke';
          const m = note(57, scale, rowDeg(carbon.row, 7));
          E.breath(t, bar * 1.4, mtof(m), Math.min(0.5, 0.08 + carbon.d * 2.2), panOf(c));
        }
        // a quiet chord marks the harmony (major = cleaner air, minor = heavy load)
        E.layer = 'harmony';
        const third = scale === 'minor' ? 3 : 4;
        E.pad(t, bar, [mtof(45), mtof(45 + third), mtof(52)], 0.025 + Math.min(0.04, load * 0.08), { type: 'triangle', cutoff: 900, attack: Math.min(0.4, bar / 2), release: 0.6, pan: panOf(c) * 0.5 });
        if (salt.d > 0.01) {
          E.layer = 'salt';
          const n = Math.min(3, Math.round(salt.d * 10));
          for (let i = 0; i < n; i++) {
            const r = Math.min(ROWS - 1, Math.max(0, Math.round(salt.row + (rnd() - 0.5) * 6)));
            E.bell(t + rnd() * bar, mtof(note(69, 'majPent', rowDeg(r, 9))), 0.03 + 0.08 * Math.min(1, salt.d * 3), panOf(c) + (rnd() - 0.5) * 0.4, 1.6);
          }
        }
      }
      let s = 0, wr = 0;
      for (let r = 0; r < ROWS; r++) { const v = ch.sulfate[r * COLS + c]; s += v; wr += v * r; }
      const d = s / ROWS;
      if (d > 0.03) {
        E.layer = 'sulfate';
        const chordTones = [0, 2, 4, 7];
        const m = note(72, 'major', rowDeg(wr / s, 4) + chordTones[c % 4]);
        E.pluck(t, mtof(m), Math.min(0.14, 0.03 + d * 0.4), panOf(c), { type: 'sine', decay: 0.5, cutoff: 7000 });
      }
    },
    describe(frames, f, c) {
      const ch = frames[f].ch;
      const lon = lonOfCol(c, frames.geo);
      const names = { carbon: 'smoke', dust: 'desert dust', salt: 'sea salt', sulfate: 'sulfate pollution' };
      const parts = Object.keys(names).map((k) => [k, avg(colCells(ch[k], c))]).filter(([, v]) => v > 0.04).sort((a, b) => b[1] - a[1]);
      if (!parts.length) return `${frames[f].label}, ${fmtLon(lon)}: fairly clean air.`;
      return `${frames[f].label}, ${fmtLon(lon)}: ${parts.slice(0, 2).map(([k]) => names[k]).join(' and ')}.`;
    },
    probe(frame, r, c) {
      const i = r * COLS + c;
      return Math.max(frame.ch.carbon[i], frame.ch.dust[i], frame.ch.salt[i], frame.ch.sulfate[i]);
    },
    probeText(frame, r, c) {
      const i = r * COLS + c;
      const names = { carbon: 'smoke', dust: 'dust', salt: 'sea salt', sulfate: 'sulfate' };
      const parts = Object.keys(names).map((k) => [names[k], frame.ch[k][i]]).filter(([, v]) => v > 0.05).sort((a, b) => b[1] - a[1]);
      return parts.length ? parts.map(([n, v]) => `${n} ${Math.round(v * 100)} percent`).join(', ') : 'Clear air';
    },
  },

  lightning: {
    frameStart(E, frames, f, t, dur) {
      E.layer = 'night';
      E.pad(t, dur, [mtof(33), mtof(40), mtof(48)], 0.035, { type: 'sine', cutoff: 500, attack: Math.min(2, dur / 3), release: 2 });
    },
    step(E, frames, f, c, t, rnd) {
      const a = frames[f].ch.flash;
      const rows = topRows(a, c, 0.1, 5);
      let total = 0;
      E.layer = 'flashes';
      for (const [r, v] of rows) {
        total += v;
        const m = note(57, 'minPent', rowDeg(r, 12));
        E.hit(t + rnd() * STEP * 0.9, 0.05 + 0.3 * v, mtof(m), panOf(c));
      }
      if (total > 1.2 && rnd() < 0.6) {
        E.layer = 'thunder';
        E.rumble(t, 1.5, Math.min(0.5, 0.12 * total), panOf(c));
      }
    },
    describe(frames, f, c) {
      const a = frames[f].ch.flash;
      const rows = topRows(a, c, 0.1, 6);
      const lon = lonOfCol(c, frames.geo);
      if (!rows.length) return `${frames[f].label}, ${fmtLon(lon)}: no lightning, quiet.`;
      const w = where(frames, rows[0][0], c);
      return `${frames[f].label}, ${fmtLon(lon)}: ${rows.length > 3 ? 'many' : 'a few'} lightning flashes over ${w.region} near ${fmtLat(w.lat)}.`;
    },
    probe: (frame, r, c) => frame.ch.flash[r * COLS + c],
    probeText(frame, r, c) {
      const v = frame.ch.flash[r * COLS + c];
      return v > 0.4 ? 'Frequent lightning' : v > 0.1 ? 'Some lightning' : 'No lightning';
    },
  },

  airquality: {
    frameStart(E, frames, f, t, dur) {
      E.layer = 'bed';
      E.pad(t, dur, [mtof(31), mtof(38)], 0.04, { type: 'triangle', cutoff: 350, attack: Math.min(2, dur / 3), release: 2 });
    },
    step(E, frames, f, c, t, rnd) {
      const ch = frames[f].ch;
      const kind = aqStrip(ch, c);
      if (!kind) return;
      const a = ch[kind];
      const level = ch[`_${kind}`];
      const rows = topRows(a, c, 0.25, 4);
      const centre = rows.length ? rows[0][0] : ROWS / 2;
      E.layer = kind;
      if (kind === 'co') {
        if (c % 2 === 0) {
          const scale = level > 0.5 ? 'minor' : 'major';
          const root = note(45, scale, rowDeg(centre, 7));
          E.pad(t, STEP * 2.2, [mtof(root), mtof(root + (scale === 'minor' ? 3 : 4)), mtof(root + 7)], 0.03 + 0.09 * level,
            { type: 'sawtooth', cutoff: 400 + 2600 * level, attack: 0.04, release: 0.35, detune: 6, pan: panOf(c) });
        }
      } else if (kind === 'pm') {
        const n = Math.min(7, Math.round(level * 9));
        for (let i = 0; i < n; i++) {
          const r = rows.length ? rows[Math.floor(rnd() * rows.length)][0] : centre;
          E.grain(t + rnd() * STEP, 0.08 + 0.3 * level, 900 + 3200 * (1 - r / ROWS) + rnd() * 600, panOf(c) + (rnd() - 0.5) * 0.3);
        }
        if (c % 4 === 0 && level > 0.3) E.breath(t, STEP * 4.5, mtof(note(43, 'minor', rowDeg(centre, 5))), 0.05 + 0.15 * level, panOf(c));
      } else if (kind === 'nox') {
        const pulses = level > 0.55 ? 2 : 1;
        for (let i = 0; i < pulses; i++) {
          const m = note(57, 'dorian', rowDeg(centre, 9) + (i ? 2 : 0));
          E.pluck(t + (i * STEP) / 2, mtof(m), 0.03 + 0.09 * level, panOf(c), { type: 'square', decay: 0.16, cutoff: 900 + 3000 * level });
        }
      } else if (kind === 'o3') {
        for (const [r, v] of rows.slice(0, 2)) {
          if (rnd() < 0.25 + v * 0.6) E.bell(t + rnd() * STEP, mtof(note(76, 'majPent', rowDeg(r, 9))), 0.02 + 0.08 * v, panOf(c), 1.4);
        }
      }
    },
    describe(frames, f, c) {
      const ch = frames[f].ch;
      const lon = lonOfCol(c, frames.geo);
      const kind = aqStrip(ch, c);
      if (!kind) return `${frames[f].label}, ${fmtLon(lon)}: strip boundary.`;
      const level = ch[`_${kind}`];
      const top = topRows(ch[kind], c, 0.25, 1)[0];
      const word = level > 0.6 ? 'very high' : level > 0.35 ? 'elevated' : 'low';
      const at = top ? ` over ${where(frames, top[0], c).region}` : '';
      return `${frames[f].label}, ${AQ_NAMES[kind]} strip near ${fmtLon(lon)}: ${word} levels${at}.`;
    },
    probe(frame, r, c) {
      const i = r * COLS + c;
      return Math.max(frame.ch.co[i], frame.ch.pm[i], frame.ch.nox[i], frame.ch.o3[i]);
    },
    probeText(frame, r, c) {
      const i = r * COLS + c;
      const best = ['co', 'pm', 'nox', 'o3'].map((k) => [k, frame.ch[k][i]]).sort((a, b) => b[1] - a[1])[0];
      if (best[1] <= 0.02) return 'Clean or unclassified';
      return `${AQ_NAMES[best[0]]}, level ${Math.round(best[1] * 100)} percent`;
    },
  },
};

export const composerFor = (dsId) => COMPOSERS[dsId];

/** Text for "what is playing now" in the current mode. */
export function describeAt(ds, frames, f, c) {
  return MODE === 'orchestra' && E_HAS_SAMPLES ? ORCHESTRA_COMPOSER.describe(frames, f, c, ds) : COMPOSERS[ds.id].describe(frames, f, c);
}
let E_HAS_SAMPLES = false;

function scheduleStep(E, ds, frames, k, t) {
  const orch = MODE === 'orchestra' && E.samples;
  const comp = orch ? ORCHESTRA_COMPOSER : COMPOSERS[ds.id];
  const f = Math.floor(k / COLS) % frames.length, c = k % COLS;
  const rnd = mulberry32(hashStr(ds.id) ^ Math.imul(k + 1, 2654435761));
  if (c === 0) comp.frameStart(E, frames, f, t, SWEEP_SECONDS, ds);
  comp.step(E, frames, f, c, t, rnd, STEP, ds);
}

/** Give an engine the orchestral sample bank (see orchestra.js). */
export function attachSamples(E, bank) {
  E.samples = bank;
  E_HAS_SAMPLES = !!bank;
}

/** Play a single grid cell (keyboard / pointer exploration). */
export function probeCell(E, ds, frame, r, c, frames, f) {
  if (MODE === 'orchestra' && E.samples && frames) { probeOrchestra(E, ds, frames, f, r, c); return; }
  const comp = COMPOSERS[ds.id];
  const v = comp.probe(frame, r, c);
  const t = E.ctx.currentTime + 0.01;
  const m = note(48, 'majPent', rowDeg(r, 16));
  E.layer = 'probe';
  if (v < 0.03) E.pluck(t, mtof(m - 12), 0.03, panOf(c), { type: 'sine', decay: 0.15, cutoff: 600 });
  else E.pluck(t, mtof(m), 0.06 + 0.25 * Math.min(1, v), panOf(c), { decay: 0.3 + 0.8 * v, cutoff: 1200 + 4000 * v });
}

// ---------- live player ----------
export class Player {
  constructor(engine) {
    this.E = engine;
    this.timer = null;
    this.playing = false;
    this.onStep = null; // (k) => void, called when a step is scheduled
  }

  load(ds, frames) {
    this.stop();
    this.ds = ds; this.frames = frames;
    this.total = frames.length * COLS;
  }

  start(fromStep = 0) {
    if (!this.frames) return;
    const ctx = this.E.ctx;
    this.stop();
    this.E.newBus();
    this.next = Math.floor(fromStep) % this.total;
    this.t0 = ctx.currentTime + 0.08 - this.next * STEP;
    const c = this.next % COLS;
    if (c !== 0 && !(MODE === 'orchestra' && this.E.samples)) {
      // entering mid-frame: start the frame bed for the remaining time
      const f = Math.floor(this.next / COLS);
      COMPOSERS[this.ds.id].frameStart(this.E, this.frames, f, ctx.currentTime + 0.05, (COLS - c) * STEP);
    }
    this.playing = true;
    this._tick();
    this.timer = setInterval(() => this._tick(), 25);
  }

  /** change tempo without losing the place */
  setSweep(seconds) {
    const pos = this.position();
    setSweep(seconds);
    if (pos != null) this.start(Math.floor(pos));
  }

  _tick() {
    const ctx = this.E.ctx;
    while (this.t0 + this.next * STEP < ctx.currentTime + 0.15) {
      if (this.next >= this.total) { this.t0 += this.total * STEP; this.next = 0; }
      scheduleStep(this.E, this.ds, this.frames, this.next, this.t0 + this.next * STEP);
      this.onStep?.(this.next);
      this.next++;
    }
  }

  /** current playhead position in steps (fractional) */
  position() {
    if (!this.playing) return null;
    const p = (this.E.ctx.currentTime - this.t0) / STEP;
    return ((p % this.total) + this.total) % this.total;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.playing) this.E.newBus();
    this.playing = false;
  }
}

// ---------- offline render ----------
export async function renderOffline(ds, frames, { sweep = SWEEP_SECONDS, sampleRate = 44100, muted = [], mode = MODE, samples = null } = {}) {
  const saved = SWEEP_SECONDS, savedMode = MODE;
  setSweep(sweep);
  setMode(mode);
  try {
    const tail = 3;
    const dur = frames.length * sweep + tail;
    const ctx = new OfflineAudioContext(2, Math.ceil(dur * sampleRate), sampleRate);
    const E = new Engine(ctx);
    if (mode === 'orchestra') {
      if (!samples) throw new Error('orchestra samples not loaded');
      E.samples = samples;
    }
    for (const m of muted) E.setMuted(m, true);
    const total = frames.length * COLS;
    for (let k = 0; k < total; k++) scheduleStep(E, ds, frames, k, 0.05 + k * STEP);
    const buf = await ctx.startRendering();
    // normalise to -1 dBFS
    let peak = 0;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
    }
    if (peak > 0) {
      const g = 0.89 / peak;
      for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] *= g; }
    }
    return buf;
  } finally {
    setSweep(saved);
    setMode(savedMode);
  }
}

export function encodeWav(buf) {
  const nCh = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length;
  const out = new DataView(new ArrayBuffer(44 + n * nCh * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + n * nCh * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, nCh, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * nCh * 2, true); out.setUint16(32, nCh * 2, true); out.setUint16(34, 16, true);
  str(36, 'data'); out.setUint32(40, n * nCh * 2, true);
  const chans = [...Array(nCh)].map((_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < n; i++) for (let ch = 0; ch < nCh; ch++) {
    const s = Math.max(-1, Math.min(1, chans[ch][i]));
    out.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
  }
  return new Blob([out.buffer], { type: 'audio/wav' });
}

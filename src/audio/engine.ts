// The only module that makes sound. Web Audio API, no libraries.
import type { DroneParams, NoteEvent, Timbre } from '../types';

export type ContextFactory = () => AudioContext;

export interface EngineOptions {
  maxVoices?: number;
  /** Initial master volume 0..1 (perceptual; squared internally). */
  volume?: number;
}

const defaultFactory: ContextFactory = () => {
  const Ctor =
    globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error('Web Audio is not supported in this browser');
  return new Ctor({ latencyHint: 'interactive' });
};

/** Gain per timbre so voices sit together; keeps peak sum below the limiter threshold. */
const TIMBRE_GAIN: Record<Timbre, number> = { glass: 0.22, reed: 0.16, pluck: 0.2, bell: 0.14, noise: 0.1, probe: 0.26 };

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private droneNodes: { oscs: OscillatorNode[]; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private active: number[] = []; // end times of sounding voices
  private volume: number;
  private muted = false;
  readonly maxVoices: number;
  /** Notes dropped because the voice pool was full (for diagnostics/tests). */
  dropped = 0;

  constructor(
    private readonly factory: ContextFactory = defaultFactory,
    opts: EngineOptions = {},
  ) {
    this.maxVoices = opts.maxVoices ?? 24;
    this.volume = clamp01(opts.volume ?? 0.35);
  }

  get started(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /** Create or resume the AudioContext. Call ONLY from a user gesture handler. */
  async start(): Promise<void> {
    if (!this.ctx) {
      this.ctx = this.factory();
      this.buildGraph(this.ctx);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  /** Silence and suspend (keeps the context for a fast resume). */
  async stop(): Promise<void> {
    if (!this.ctx) return;
    this.setDrone(null);
    if (this.ctx.state === 'running') await this.ctx.suspend();
  }

  async dispose(): Promise<void> {
    if (!this.ctx) return;
    const ctx = this.ctx;
    this.ctx = null;
    this.droneNodes = null;
    this.active = [];
    await ctx.close();
  }

  setMasterVolume(v: number): void {
    this.volume = clamp01(v);
    this.applyVolume();
  }

  getMasterVolume(): number {
    return this.volume;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolume();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Number of voices still sounding at the current time. */
  activeVoices(): number {
    const t = this.now();
    this.active = this.active.filter((end) => end > t);
    return this.active.length;
  }

  /** Schedule notes at `atTime` (AudioContext seconds). Returns how many were scheduled. */
  schedule(notes: NoteEvent[], atTime: number): number {
    const ctx = this.ctx;
    if (!ctx || !this.bus) return 0;
    let count = 0;
    // Accents first so they survive a full pool.
    const ordered = [...notes].sort((a, b) => (b.band < 0 ? 1 : 0) - (a.band < 0 ? 1 : 0));
    for (const n of ordered) {
      if (this.activeVoices() >= this.maxVoices) {
        this.dropped++;
        continue;
      }
      const t = Math.max(atTime + n.offset, ctx.currentTime);
      const end = this.voice(ctx, this.bus, n, t);
      this.active.push(end);
      count++;
    }
    return count;
  }

  /** Set the change drone (null = fade out). Glides smoothly. */
  setDrone(p: DroneParams | null, glide = 1.2): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    if (!p) {
      if (this.droneNodes) this.droneNodes.gain.gain.setTargetAtTime(0, t, 0.3);
      return;
    }
    if (!this.droneNodes) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 2;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const oscs = [0, 7, -5].map((cents, i) => {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'sawtooth' : 'triangle';
        o.detune.value = cents;
        o.connect(filter);
        o.start();
        return o;
      });
      filter.connect(gain).connect(this.master);
      this.droneNodes = { oscs, filter, gain };
    }
    const { oscs, filter, gain } = this.droneNodes;
    oscs.forEach((o, i) => o.frequency.setTargetAtTime(p.freq * (i === 2 ? 2 : 1), t, glide / 3));
    filter.frequency.setTargetAtTime(p.cutoff, t, glide / 3);
    gain.gain.setTargetAtTime(0.09, t, 0.4);
  }

  private applyVolume(): void {
    if (!this.ctx || !this.master) return;
    const target = this.muted ? 0 : this.volume * this.volume * 0.9;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
  }

  private buildGraph(ctx: AudioContext): void {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(limiter);

    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(this.master);

    const reverb = ctx.createConvolver();
    reverb.buffer = impulseResponse(ctx, 2.4, 2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    this.bus.connect(reverb);
    reverb.connect(wet).connect(this.master);

    this.noiseBuffer = noise(ctx, 1);
    this.applyVolume();
  }

  /** Build one voice; returns its end time. */
  private voice(ctx: AudioContext, out: AudioNode, n: NoteEvent, t: number): number {
    const peak = TIMBRE_GAIN[n.timbre] * Math.max(0, Math.min(1, n.velocity)) * 2;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, n.pan));
    pan.connect(out);
    const env = ctx.createGain();
    env.gain.value = 0;
    env.connect(pan);
    const dur = Math.max(0.05, n.duration);
    const g = env.gain;

    const osc = (type: OscillatorType, freq: number, level: number, dest: AudioNode = env) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const lv = ctx.createGain();
      lv.gain.value = level;
      o.connect(lv).connect(dest);
      o.start(t);
      return o;
    };

    let end = t + dur;
    const sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
    switch (n.timbre) {
      case 'glass': {
        sources.push(osc('sine', n.freq, 1), osc('sine', n.freq * 2, 0.22), osc('sine', n.freq * 3.01, 0.06));
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(peak, t + 0.012);
        g.exponentialRampToValueAtTime(0.0008, t + dur * 1.6);
        end = t + dur * 1.6;
        break;
      }
      case 'reed': {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = n.freq * 3;
        f.Q.value = 0.8;
        f.connect(env);
        sources.push(osc('sawtooth', n.freq, 0.6, f), osc('triangle', n.freq, 0.8, f));
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(peak, t + 0.04);
        g.setValueAtTime(peak, t + dur * 0.7);
        g.exponentialRampToValueAtTime(0.0008, t + dur * 1.2);
        end = t + dur * 1.2;
        break;
      }
      case 'pluck': {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(n.freq * 8, t);
        f.frequency.exponentialRampToValueAtTime(n.freq * 1.2, t + dur);
        f.connect(env);
        sources.push(osc('square', n.freq, 0.5, f), osc('triangle', n.freq / 2, 0.5, f));
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(peak, t + 0.004);
        g.exponentialRampToValueAtTime(0.0008, t + dur * 1.1);
        end = t + dur * 1.1;
        break;
      }
      case 'bell': {
        for (const [ratio, level] of [
          [1, 1],
          [2.76, 0.5],
          [5.4, 0.25],
          [8.93, 0.12],
        ] as const) {
          sources.push(osc('sine', n.freq * ratio, level));
        }
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(peak, t + 0.003);
        g.exponentialRampToValueAtTime(0.0006, t + dur * 2);
        end = t + dur * 2;
        break;
      }
      case 'noise': {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = Math.max(200, n.freq * 4);
        f.Q.value = 3;
        src.connect(f).connect(env);
        src.start(t);
        sources.push(src);
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(peak, t + 0.05);
        g.exponentialRampToValueAtTime(0.0008, t + dur);
        break;
      }
      case 'probe': {
        sources.push(osc('sine', n.freq, 1), osc('triangle', n.freq * 2, 0.15));
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(peak, t + 0.02);
        g.setValueAtTime(peak, t + dur * 0.6);
        g.exponentialRampToValueAtTime(0.0008, t + dur);
        break;
      }
    }
    for (const s of sources) s.stop(end + 0.05);
    // Release graph nodes when done.
    const last = sources[0];
    if (last) {
      last.onended = () => {
        env.disconnect();
        pan.disconnect();
      };
    }
    return end;
  }
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

/** Procedurally generated stereo reverb impulse: decaying noise. */
export function impulseResponse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let seed = ch === 0 ? 12345 : 67890;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const r = (seed / 0x7fffffff) * 2 - 1;
      data[i] = r * (1 - i / len) ** decay;
    }
  }
  return buf;
}

function noise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 4242;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  return buf;
}

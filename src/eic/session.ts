// EicSession: framework-free controller for the Earth Information Center (NASA SVS) records.
// It wraps the teammate's engine (src/eic/vendor) behind a small, typed, subscribable API the
// React UI can use like the GIBS player.
//
// Sound modes (decision D2 in MERGE_PLAN.md):
// - Playback always starts at once in Scientific mode (synths, nothing to download).
// - If the listener prefers Orchestra (the default), only the instruments this piece needs are
//   downloaded in the background, and the music switches to Orchestra as soon as they are ready.
// - The preferred mode is remembered in localStorage.
// No AudioContext is created before a user gesture (play / probe / mode change while playing).
import { instrumentsFor } from './instruments';
import { COLS, ROWS, fmtLat, fmtLon, latOfRow, loadDataset as vendorLoadDataset, lonOfCol, regionName, channelsOf, type EicFrame, type EicFrames } from './vendor/analyze';
import { byId, DATASETS, type EicDataset } from './vendor/datasets';
import { attachSamples, composerFor, describeAt, encodeWav, Engine, Player, probeCell, renderOffline, setMode, setSweep } from './vendor/engine';
import { FAMILIES, FOUNDATION, familiesUsed, loadManifest, loadSamples as vendorLoadSamples, orchestraFor, sweepForBpm, type SampleBank, type SampleManifest } from './vendor/orchestra';
import type { EicLayer } from './vendor/datasets';

export type SoundMode = 'science' | 'orchestra';
export type OrchestraStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface EicState {
  dsId: string;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  frameCount: number;
  frameIndex: number;
  playing: boolean;
  /** What the listener chose (remembered). */
  preferredMode: SoundMode;
  /** What is sounding now (Scientific until the orchestra for this piece is loaded). */
  activeMode: SoundMode;
  orchestra: { status: OrchestraStatus; done: number; total: number; bytes: number; totalBytes: number; error: string | null };
  /** Short "what you hear now" line, updated every few steps while playing. */
  hearing: string;
  /** Mixer layers switched off for this record in the sounding mode. */
  mutedLayers: string[];
}

export interface EicDeps {
  createContext: () => AudioContext;
  loadDataset: (ds: EicDataset) => Promise<EicFrames>;
  loadSamples: (ctx: BaseAudioContext, onProgress: (done: number, total: number, bytes: number) => void, only: string[]) => Promise<SampleBank>;
  loadManifest: () => Promise<SampleManifest>;
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** Byte sizes per sample file (for the progress line); null when unknown. */
  fileSize?: (file: string) => number | null;
}

const STORAGE_KEY = 'eic.soundMode';
/** Science-mode sweep length (seconds per frame), as in the prototype. */
const SCIENCE_SWEEP = 8;

function safeStorage(): EicDeps['storage'] {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export const defaultDeps: EicDeps = {
  createContext: () => new AudioContext({ latencyHint: 'playback' }),
  loadDataset: (ds) => vendorLoadDataset(ds),
  loadSamples: (ctx, onProgress, only) => vendorLoadSamples(ctx, onProgress, only),
  loadManifest,
  storage: safeStorage(),
};

export const EIC_DATASETS: readonly EicDataset[] = DATASETS;
export { COLS as EIC_COLS, ROWS as EIC_ROWS };

/** Short date label for the timeline ticks (prototype's shortLabel). */
export function shortLabel(ds: EicDataset, f: EicFrame): string {
  if (ds.id === 'nightlights' || !f.date) return f.label;
  const d = new Date(`${f.date}T00:00:00Z`);
  if (ds.id === 'lightning') return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  if (ds.id === 'ocean') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace(' ', " '");
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Alt text for a frame picture (prototype's frameAlt). */
export function frameAlt(ds: EicDataset, f: EicFrame): string {
  const regions = f.stats.topRegions?.length ? ` Most prominent: ${f.stats.topRegions.join(', ')}.` : '';
  return `${ds.title}, ${f.label}. ${ds.summary.split('. ')[0]}.${regions}`;
}

/** The record's headline number for one frame (prototype's metricValue), in display units. */
export const metricValue = (ds: EicDataset, f: EicFrame) => (f.stats[ds.metric.key] || 0) * ds.metric.scale;
export const fmtVal = (ds: EicDataset, v: number) => (ds.metric.unit === '%' ? `${v.toFixed(0)}%` : v.toFixed(1));

/** Long description of a frame computed from the data (prototype's frameDescription). */
export function frameDescription(ds: EicDataset, f: EicFrame, prev?: EicFrame): string {
  const parts = [`${ds.metric.label}: ${fmtVal(ds, metricValue(ds, f))}${ds.metric.unit === '/100' ? ' out of 100' : ''}.`];
  if (prev) {
    const a = metricValue(ds, prev);
    const b = metricValue(ds, f);
    if (ds.metric.unit === '%') {
      const d = b - a;
      if (Math.abs(d) >= 1) parts.push(`${d > 0 ? 'Up' : 'Down'} ${Math.abs(d).toFixed(0)} points from ${prev.label}.`);
    } else if (a > 0) {
      const d = ((b - a) / a) * 100;
      if (Math.abs(d) >= 0.5) parts.push(`${d > 0 ? 'Up' : 'Down'} ${Math.abs(d).toFixed(0)} percent from ${prev.label}.`);
    }
  }
  if (ds.id === 'aerosols') {
    const names: Record<string, string> = { carbon: 'smoke', dust: 'dust', salt: 'sea salt', sulfate: 'sulfate' };
    const ranked = channelsOf('aerosols')
      .map((k) => [names[k] ?? k, f.stats[k] ?? 0] as const)
      .sort((x, y) => y[1] - x[1]);
    parts.push(`Most widespread: ${ranked
      .slice(0, 2)
      .map((x) => x[0])
      .join(' and ')}.`);
  }
  if (f.stats.topRegions?.length) parts.push(`Strongest regions: ${f.stats.topRegions.join(', ')}.`);
  return parts.join(' ');
}

/** "What you are hearing" bullet list for a dataset in a mode (prototype's renderHearing). */
export function hearingFor(ds: EicDataset, mode: SoundMode): string[] {
  if (mode === 'science') return ds.hearing;
  const cfg = orchestraFor(ds.id);
  return [
    `A sampled chamber orchestra at ${cfg.bpm} BPM. Each frame is four bars; the playhead crosses one map column per sixteenth note.`,
    'Every colour on the map has its own section: blue strings, green woodwinds, yellow harp, orange horns, red trumpets, violet violas, white piano and glockenspiel.',
    'Louder and busier sections mean more of that colour in the strip being played. Pitch still follows latitude: north is higher.',
    'The strongest colour of each frame carries the melody; double bass and drums keep the pulse, and the groove gets denser where the data is busier.',
    ...(ds.id === 'lightning' ? ['Here the drums are the data: every flash cluster is a snare (north) or timpani (south) hit.'] : []),
    ...(cfg.progs.length > 1 ? ['When the air is heavily loaded, the chord progression turns darker.'] : []),
  ];
}

/** Index of the frame with this date or label, else the frame nearest in time (like the GIBS deep links). */
export function nearestFrame(frames: readonly EicFrame[], date: string): number {
  const exact = frames.findIndex((f) => f.date === date || f.label === date);
  if (exact >= 0) return exact;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return 0;
  let best = 0;
  frames.forEach((f, i) => {
    const d = f.date ? Math.abs(Date.parse(f.date) - t) : Infinity;
    const b = frames[best]!.date ? Math.abs(Date.parse(frames[best]!.date!) - t) : Infinity;
    if (d < b) best = i;
  });
  return best;
}

type Listener = () => void;
export type NarrationKind = 'step' | 'frame' | 'event';

export class EicSession {
  private readonly deps: EicDeps;
  private state: EicState;
  private listeners = new Set<Listener>();
  private cache = new Map<string, Promise<EicFrames>>();
  private frames: EicFrames | null = null;
  private loadToken = 0;
  private ctx: AudioContext | null = null;
  private engine: Engine | null = null;
  private player: Player | null = null;
  private bank: SampleBank = {};
  /** Instruments needed per dataset (computed once frames are known). */
  private needs = new Map<string, string[]>();
  private resumeAt: number | null = null;
  private volume = 0.8;
  private muted = false;
  private timers: ReturnType<typeof setTimeout>[] = [];
  /** Muted mixer layers per `${mode}:${record}`. */
  private mutes = new Map<string, Set<string>>();

  /** Spoken narration hook: 'step' every bar while playing, 'frame' on a new frame, 'event' for play/mode messages. */
  onNarrate: ((text: string, kind: NarrationKind) => void) | null = null;
  setNarrator(fn: ((text: string, kind: NarrationKind) => void) | null): void {
    this.onNarrate = fn;
  }

  constructor(dsId: string = DATASETS[0]!.id, deps: Partial<EicDeps> = {}) {
    this.deps = { ...defaultDeps, ...deps };
    const stored = this.readPreference();
    this.state = {
      dsId,
      status: 'loading',
      error: null,
      frameCount: 0,
      frameIndex: 0,
      playing: false,
      preferredMode: stored,
      activeMode: 'science',
      orchestra: { status: 'idle', done: 0, total: 0, bytes: 0, totalBytes: 0, error: null },
      hearing: 'Nothing yet. Press Play to start the sweep, or explore the map with the arrow keys.',
      mutedLayers: [],
    };
  }

  // ----- subscription (useSyncExternalStore) -----
  getState = (): EicState => this.state;
  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<EicState>) {
    const remute = ('activeMode' in patch && patch.activeMode !== this.state.activeMode) || ('dsId' in patch && patch.dsId !== this.state.dsId);
    this.state = { ...this.state, ...patch };
    if (remute) {
      this.state = { ...this.state, mutedLayers: [...this.muteSet()] };
      this.applyMutes();
    }
    this.listeners.forEach((l) => l());
  }

  get dataset(): EicDataset {
    return byId(this.state.dsId)!;
  }
  get loadedFrames(): EicFrames | null {
    return this.frames;
  }
  get currentFrame(): EicFrame | null {
    return this.frames?.[this.state.frameIndex] ?? null;
  }

  private readPreference(): SoundMode {
    try {
      return this.deps.storage?.getItem(STORAGE_KEY) === 'science' ? 'science' : 'orchestra';
    } catch {
      return 'orchestra';
    }
  }

  // ----- loading -----
  /** Select a dataset and load its frames, at a frame index or a frame date (YYYY-MM-DD or label). */
  async select(dsId: string, frame: number | string = 0): Promise<void> {
    const ds = byId(dsId);
    if (!ds) throw new Error(`Unknown EIC record ${dsId}`);
    const wasPlaying = this.state.playing;
    this.stopPlayer();
    const token = ++this.loadToken;
    this.frames = null;
    this.resumeAt = null;
    this.set({ dsId, status: 'loading', error: null, frameCount: ds.frames.length, frameIndex: 0, playing: false, activeMode: 'science' });
    try {
      let p = this.cache.get(dsId);
      if (!p) {
        p = this.deps.loadDataset(ds);
        this.cache.set(dsId, p);
        p.catch(() => this.cache.delete(dsId));
      }
      const frames = await p;
      if (token !== this.loadToken) return;
      this.frames = frames;
      if (!this.needs.has(dsId)) this.needs.set(dsId, instrumentsFor(frames, ds));
      const wanted = typeof frame === 'string' ? nearestFrame(frames, frame) : frame;
      const fi = Math.min(Math.max(0, wanted), frames.length - 1);
      this.player?.load(ds, frames);
      this.set({ status: 'ready', frameCount: frames.length, frameIndex: fi, activeMode: this.orchestraReadyFor(dsId) && this.state.preferredMode === 'orchestra' ? 'orchestra' : 'science' });
      this.resumeAt = fi * COLS;
      this.refreshOrchestraStatus();
      if (wasPlaying) await this.play();
    } catch (e) {
      if (token !== this.loadToken) return;
      this.set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }

  /** Retry a failed load. */
  retry(): Promise<void> {
    return this.select(this.state.dsId, this.state.frameIndex);
  }

  // ----- audio -----
  private ensureAudio(): Engine {
    if (!this.ctx) {
      this.ctx = this.deps.createContext();
      this.engine = new Engine(this.ctx);
      this.player = new Player(this.engine);
      this.player.onStep = (k) => this.onStep(k);
      this.applyVolume();
      if (Object.keys(this.bank).length) attachSamples(this.engine, this.bank);
      this.applyMutes();
      if (this.frames) this.player.load(this.dataset, this.frames);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.engine!;
  }

  private orchestraReadyFor(dsId: string): boolean {
    const need = this.needs.get(dsId);
    return !!need && need.every((i) => this.bank[i]);
  }

  private refreshOrchestraStatus() {
    const need = this.needs.get(this.state.dsId) ?? [];
    if (this.orchestraReadyFor(this.state.dsId)) {
      this.set({ orchestra: { ...this.state.orchestra, status: 'ready', done: need.length, total: need.length, error: null } });
    } else if (this.state.orchestra.status !== 'loading') {
      this.set({ orchestra: { status: 'idle', done: 0, total: need.length, bytes: 0, totalBytes: 0, error: null } });
    }
  }

  private applySweep(mode: SoundMode) {
    setSweep(mode === 'orchestra' ? sweepForBpm(orchestraFor(this.state.dsId).bpm) : SCIENCE_SWEEP);
  }

  /** Switch what is sounding without losing the place in the piece. */
  private switchActive(mode: SoundMode) {
    const pos = this.player?.playing ? this.player.position() : null;
    if (pos != null) this.player!.stop();
    setMode(mode);
    this.applySweep(mode);
    this.set({ activeMode: mode });
    if (pos != null) {
      this.player!.start(Math.floor(pos));
      this.set({ playing: true });
    }
  }

  private loadingFor: string | null = null;
  /** Download (only) the instruments this piece needs; switch to Orchestra when they are in. */
  private async loadOrchestra(): Promise<void> {
    const dsId = this.state.dsId;
    const need = this.needs.get(dsId);
    if (!need || !this.ctx || this.orchestraReadyFor(dsId) || this.loadingFor === dsId) return;
    this.loadingFor = dsId;
    let totalBytes = 0;
    try {
      const manifest = await this.deps.loadManifest();
      totalBytes = need.reduce((s, i) => s + (manifest.instruments[i]?.zones.reduce((t, z) => t + (this.deps.fileSize?.(z.file) ?? z.secs * 64000), 0) ?? 0), 0);
    } catch {
      /* the progress line falls back to instrument counts */
    }
    this.set({ orchestra: { status: 'loading', done: 0, total: need.length, bytes: 0, totalBytes, error: null } });
    try {
      const bank = await this.deps.loadSamples(
        this.ctx,
        (done, total, bytes) => {
          if (this.state.dsId === dsId) this.set({ orchestra: { status: 'loading', done, total, bytes, totalBytes, error: null } });
        },
        need,
      );
      this.bank = { ...this.bank, ...bank };
      if (this.engine) attachSamples(this.engine, this.bank);
      if (this.state.dsId !== dsId) return;
      this.set({ orchestra: { status: 'ready', done: need.length, total: need.length, bytes: this.state.orchestra.bytes, totalBytes, error: null } });
      if (this.state.preferredMode === 'orchestra' && this.state.activeMode !== 'orchestra') {
        this.switchActive('orchestra');
        this.onNarrate?.('The orchestra has loaded and takes over.', 'event');
      }
    } catch (e) {
      if (this.state.dsId === dsId) {
        this.set({ orchestra: { status: 'error', done: 0, total: need.length, bytes: 0, totalBytes, error: e instanceof Error ? e.message : String(e) } });
        this.onNarrate?.('The orchestra could not load, so Scientific mode keeps playing.', 'event');
      }
    } finally {
      if (this.loadingFor === dsId) this.loadingFor = null;
    }
  }

  /** Start playback (must run inside a user gesture). Starts in Scientific; Orchestra follows when loaded. */
  async play(): Promise<void> {
    if (!this.frames) return;
    this.ensureAudio();
    const mode: SoundMode = this.state.preferredMode === 'orchestra' && this.orchestraReadyFor(this.state.dsId) ? 'orchestra' : 'science';
    setMode(mode);
    this.applySweep(mode);
    const from = this.resumeAt ?? this.state.frameIndex * COLS;
    this.resumeAt = null;
    this.player!.start(from);
    this.set({ playing: true, activeMode: mode });
    const f = this.frames[Math.floor(from / COLS) % this.frames.length];
    this.onNarrate?.(`Playing ${this.dataset.short}, ${f?.label ?? ''}${mode === 'science' && this.state.preferredMode === 'orchestra' ? ', in Scientific mode while the orchestra loads' : ''}.`, 'event');
    if (this.state.preferredMode === 'orchestra') void this.loadOrchestra();
  }

  pause(): void {
    if (!this.player?.playing) {
      this.set({ playing: false });
      return;
    }
    this.resumeAt = Math.floor(this.player.position() ?? 0);
    this.player.stop();
    this.clearTimers();
    this.set({ playing: false });
  }

  toggle(): Promise<void> | void {
    return this.state.playing ? this.pause() : this.play();
  }

  /** The listener picks a mode; it is remembered. */
  setPreferredMode(mode: SoundMode): void {
    try {
      this.deps.storage?.setItem(STORAGE_KEY, mode);
    } catch {
      /* private mode: not remembered, still applied */
    }
    this.set({ preferredMode: mode });
    if (mode === 'science') {
      if (this.state.activeMode !== 'science') this.switchActive('science');
      return;
    }
    if (this.orchestraReadyFor(this.state.dsId)) {
      if (this.state.activeMode !== 'orchestra') this.switchActive('orchestra');
    } else if (this.ctx) {
      void this.loadOrchestra();
    }
  }

  seekFrame(i: number): void {
    if (!this.frames) return;
    const n = this.frames.length;
    const j = ((i % n) + n) % n;
    // Drop UI updates queued for the old position, or they would snap the frame back.
    this.clearTimers();
    this.set({ frameIndex: j });
    if (this.player?.playing) this.player.start(j * COLS);
    else this.resumeAt = j * COLS;
  }

  /** Current playhead (frame and fractional column) or null when stopped. */
  position(): { frame: number; col: number } | null {
    const p = this.player?.playing ? this.player.position() : null;
    if (p == null) return null;
    return { frame: Math.floor(p / COLS), col: p % COLS };
  }

  /** Volume on the app's 0..1 scale (0.35 = the app default = the prototype's 0.8). */
  setVolume(v: number): void {
    this.volume = Math.min(1, (v / 0.35) * 0.8);
    this.applyVolume();
  }
  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolume();
  }
  private applyVolume() {
    this.engine?.setVolume(this.muted ? 0 : this.volume);
  }

  /** Play one grid cell (explore) and return its spoken description. Runs in a user gesture. */
  probe(r: number, c: number): string | null {
    const f = this.currentFrame;
    if (!f || !this.frames) return null;
    const E = this.ensureAudio();
    probeCell(E, this.dataset, f, r, c, this.frames, this.state.frameIndex);
    return this.cellText(r, c);
  }

  cellText(r: number, c: number): string {
    const f = this.currentFrame;
    if (!f || !this.frames) return '';
    const lat = latOfRow(r, this.frames.geo);
    const lon = lonOfCol(c, this.frames.geo);
    return `${fmtLat(lat)}, ${fmtLon(lon)}, ${regionName(lat, lon)}: ${composerFor(this.state.dsId).probeText(f, r, c)}.`;
  }

  /** "D": describe what is playing now, or the frame when stopped. */
  describeNow(): string {
    const f = this.currentFrame;
    if (!f || !this.frames) return `${this.dataset.title}: loading.`;
    const pos = this.position();
    if (!pos) return `${this.dataset.title}, ${f.label}. ${frameDescription(this.dataset, f, this.frames[this.state.frameIndex - 1])}`;
    return describeAt(this.dataset, this.frames, pos.frame % this.frames.length, Math.floor(pos.col));
  }

  private onStep(k: number) {
    if (!this.frames) return;
    const f = Math.floor(k / COLS) % this.frames.length;
    const c = k % COLS;
    // Steps are scheduled ~100 ms ahead; reflect them in the UI when they actually sound.
    if (c === 0)
      this.later(() => {
        if (!this.player?.playing || !this.frames || this.state.frameIndex === f) return;
        this.set({ frameIndex: f });
        const fr = this.frames[f]!;
        this.onNarrate?.(`${fr.label}. ${frameDescription(this.dataset, fr, this.frames[f - 1])}`, 'frame');
      }, 120);
    if (c % 4 === 0) {
      const text = describeAt(this.dataset, this.frames, f, c);
      this.later(() => this.player?.playing && this.set({ hearing: text }), 150);
    }
    if (c % 16 === 0) {
      const text = describeAt(this.dataset, this.frames, f, Math.min(COLS - 1, c + 2));
      this.later(() => this.player?.playing && this.onNarrate?.(text, 'step'), 150);
    }
  }

  private later(fn: () => void, ms: number) {
    const t = setTimeout(() => {
      this.timers = this.timers.filter((x) => x !== t);
      fn();
    }, ms);
    this.timers.push(t);
  }
  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
  private stopPlayer() {
    this.player?.stop();
    this.clearTimers();
  }

  /** Suspend audio entirely (tab hidden, or switching to a GIBS record). */
  async suspend(): Promise<void> {
    this.pause();
    if (this.ctx?.state === 'running') await this.ctx.suspend();
  }

  /** Render the whole record offline, in the mode that is sounding now, as a 16-bit stereo WAV. */
  async renderWav(): Promise<{ blob: Blob; seconds: number; mode: SoundMode; file: string }> {
    if (!this.frames) throw new Error('the frames are still loading');
    const ds = this.dataset;
    const mode: SoundMode = this.state.activeMode === 'orchestra' && this.orchestraReadyFor(ds.id) ? 'orchestra' : 'science';
    const sweep = mode === 'orchestra' ? sweepForBpm(orchestraFor(ds.id).bpm) : SCIENCE_SWEEP;
    const buf = await renderOffline(ds, this.frames, { sweep, mode, samples: mode === 'orchestra' ? this.bank : null, muted: [...this.muteSet(mode)] });
    return { blob: encodeWav(buf), seconds: buf.duration, mode, file: `earth-jukebox-${ds.id}-${mode}.wav` };
  }

  // ----- mixer -----
  private muteSet(mode: SoundMode = this.state.activeMode): Set<string> {
    const key = `${mode}:${this.state.dsId}`;
    let s = this.mutes.get(key);
    if (!s) this.mutes.set(key, (s = new Set()));
    return s;
  }
  private applyMutes() {
    const E = this.engine;
    if (!E) return;
    const want = this.muteSet();
    for (const id of [...E.muted]) if (!want.has(id)) E.setMuted(id, false);
    for (const id of want) E.setMuted(id, true);
  }
  /** The instruments of the mixer for the sounding mode: colour sections + foundation (Orchestra) or the record's synth layers. */
  mixerLayers(): EicLayer[] {
    if (this.state.activeMode === 'orchestra' && this.frames) {
      return [...familiesUsed(this.frames, this.dataset).map((id) => ({ id, label: FAMILIES[id]!.label, color: FAMILIES[id]!.color })), ...FOUNDATION];
    }
    return this.dataset.layers;
  }
  setLayerMuted(id: string, muted: boolean): void {
    const s = this.muteSet();
    if (muted) s.add(id);
    else s.delete(id);
    this.engine?.setMuted(id, muted);
    this.set({ mutedLayers: [...s] });
  }
  /** Voices started per layer since the last call (for the mixer's activity lights). */
  takeActivity(): Record<string, number> {
    const E = this.engine;
    if (!E) return {};
    const a = E.activity;
    E.activity = {};
    return a;
  }

  /** Create/resume the AudioContext inside a user gesture without playing (demo tour). */
  unlockAudio(): void {
    this.ensureAudio();
  }

  get audioStarted(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }
}

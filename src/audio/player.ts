// Framework-agnostic glue: frames + mapping -> scheduled notes, with audio-clock visual sync.
import { droneParams, mapProbe, mapToNotes } from '../sonify/mapping';
import { BAND_COUNT } from '../sonify/mapping';
import { blendSamples, droneMetricOf, frameStats, probe, sampleColumn } from '../sonify/sample';
import type { ColumnSample, DroneMetric, Frame, MappingConfig, NoteEvent } from '../types';
import { xToLon, yToLat } from '../data/values';
import type { AudioEngine } from './engine';
import { LookaheadScheduler, type Timers } from './scheduler';

export interface StepInfo {
  time: number;
  frameIndex: number;
  column: number;
  sample: ColumnSample;
  notes: NoteEvent[];
}

export interface PlayerOptions {
  /** Columns per sweep (west -> east). */
  steps?: number;
  bandCount?: number;
  /** Columns over which values crossfade from the previous frame. */
  crossfadeSteps?: number;
  timers?: Timers;
}

export interface DroneConfig {
  metric: DroneMetric;
  changeScale: number;
}

type Listener = (s: StepInfo) => void;

export class JukeboxPlayer {
  readonly steps: number;
  readonly bandCount: number;
  private readonly crossfadeSteps: number;
  private readonly scheduler: LookaheadScheduler;
  private frames: (Frame | undefined)[] = [];
  private mapping: MappingConfig | null = null;
  private drone: DroneConfig = { metric: 'mean', changeScale: 1 };
  private tempo = 4;
  private timelapse = true;
  private frameIndex = 0;
  private column = 0;
  private prevFrame: Frame | undefined;
  private prevSample: ColumnSample | undefined;
  private visualQueue: StepInfo[] = [];
  private listeners = new Set<Listener>();
  private frameListeners = new Set<(i: number) => void>();

  constructor(
    readonly engine: AudioEngine,
    opts: PlayerOptions = {},
  ) {
    this.steps = opts.steps ?? 48;
    this.bandCount = opts.bandCount ?? BAND_COUNT;
    this.crossfadeSteps = opts.crossfadeSteps ?? 8;
    this.scheduler = new LookaheadScheduler({
      clock: () => this.engine.now(),
      stepDuration: () => 1 / this.tempo,
      onStep: (_s, time) => this.onStep(time),
      timers: opts.timers,
    });
  }

  get playing(): boolean {
    return this.scheduler.running;
  }
  get currentFrameIndex(): number {
    return this.frameIndex;
  }
  get currentColumn(): number {
    return this.column;
  }

  onStepScheduled(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  /** Fires when the scan advances to another frame (time-lapse). */
  onFrameChange(fn: (i: number) => void): () => void {
    this.frameListeners.add(fn);
    return () => this.frameListeners.delete(fn);
  }

  setFrames(frames: (Frame | undefined)[]): void {
    this.frames = frames;
    if (this.frameIndex >= frames.length) this.frameIndex = 0;
    this.updateDrone();
  }
  setFrame(i: number, frame: Frame): void {
    this.frames[i] = frame;
    if (i === 0 || i === this.frameIndex) this.updateDrone();
  }
  setMapping(m: MappingConfig): void {
    this.mapping = m;
  }
  setTempo(stepsPerSecond: number): void {
    this.tempo = Math.max(1, Math.min(16, stepsPerSecond));
  }
  setTimelapse(on: boolean): void {
    this.timelapse = on;
  }
  setDroneConfig(c: DroneConfig): void {
    this.drone = c;
    this.updateDrone();
  }

  /** Jump to a frame (scrub). Restarts the sweep at the west edge. */
  seekFrame(i: number): void {
    if (this.frames.length === 0) return;
    this.prevFrame = this.frames[this.frameIndex];
    this.frameIndex = ((i % this.frames.length) + this.frames.length) % this.frames.length;
    this.column = 0;
    this.prevSample = undefined;
    this.updateDrone();
    this.frameListeners.forEach((fn) => fn(this.frameIndex));
  }

  /** Start scanning. Must be called from a user gesture (starts the AudioContext). */
  async play(): Promise<void> {
    await this.engine.start();
    if (this.scheduler.running) return; // already playing: keep the current timing
    this.scheduler.start();
    this.updateDrone();
  }

  async pause(): Promise<void> {
    this.scheduler.stop();
    this.visualQueue = [];
    await this.engine.stop();
  }

  /** Stop scanning but keep audio running (explore mode). */
  holdScan(): void {
    this.scheduler.stop();
    this.visualQueue = [];
    this.engine.setDrone(null); // the drone belongs to the scan, not to single-point exploring
  }

  /**
   * Explore: sonify the neighbourhood under (x, y) of the current frame. Starts audio if needed
   * (call from a key/pointer handler). Returns what was sampled, for narration.
   */
  async probeAt(x: number, y: number, gesture = true): Promise<{ value: number | null; lat: number; lon: number } | null> {
    const frame = this.frames[this.frameIndex];
    if (!frame || !this.mapping) return null;
    // Audio may only be created/resumed inside a user gesture; mouse hover is not one.
    if (gesture) await this.engine.start();
    const value = probe(frame, x, y);
    const lon = xToLon(frame, x);
    const lat = yToLat(frame, y);
    this.engine.schedule(mapProbe(value, lon, this.mapping), this.engine.now() + 0.02);
    return { value, lat, lon };
  }

  /** Steps whose scheduled time has passed, in order (for scan-line + narration sync). */
  drainVisual(now = this.engine.now()): StepInfo[] {
    const due: StepInfo[] = [];
    while (this.visualQueue.length && this.visualQueue[0]!.time <= now) due.push(this.visualQueue.shift()!);
    return due;
  }

  private onStep(time: number): void {
    const frame = this.frames[this.frameIndex];
    if (!frame || !this.mapping) return;
    const x = Math.floor(((this.column + 0.5) / this.steps) * frame.width);
    const halfWidth = Math.max(0, Math.floor(frame.width / this.steps / 2));
    let sample = sampleColumn(frame, x, this.bandCount, halfWidth);
    if (this.prevFrame && this.prevFrame !== frame && this.column < this.crossfadeSteps) {
      const k = (this.column + 1) / (this.crossfadeSteps + 1);
      sample = blendSamples(sampleColumn(this.prevFrame, x, this.bandCount, halfWidth), sample, k);
    }
    const notes = mapToNotes(sample, this.mapping);
    this.engine.schedule(notes, time);
    const info: StepInfo = { time, frameIndex: this.frameIndex, column: this.column, sample, notes };
    this.visualQueue.push(info);
    if (this.visualQueue.length > 256) this.visualQueue.shift();
    this.listeners.forEach((fn) => fn(info));
    this.prevSample = sample;

    this.column++;
    if (this.column >= this.steps) {
      this.column = 0;
      if (this.timelapse && this.frames.length > 1) {
        const next = (this.frameIndex + 1) % this.frames.length;
        if (this.frames[next]) {
          this.prevFrame = frame;
          this.frameIndex = next;
          this.updateDrone();
          this.frameListeners.forEach((fn) => fn(this.frameIndex));
        }
        // Next frame not loaded yet: repeat this one without re-running the old crossfade.
        else this.prevFrame = undefined;
      } else {
        this.prevFrame = undefined;
      }
    }
  }

  get lastSample(): ColumnSample | undefined {
    return this.prevSample;
  }

  private updateDrone(): void {
    const frame = this.frames[this.frameIndex];
    const base = this.frames[0];
    if (!frame || !base || !this.engine.started || !this.scheduler.running) return;
    const p = droneParams(
      droneMetricOf(frameStats(frame, this.bandCount), this.drone.metric),
      droneMetricOf(frameStats(base, this.bandCount), this.drone.metric),
      this.drone.changeScale,
    );
    this.engine.setDrone(p);
  }
}

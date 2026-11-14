import type { EicDataset } from './datasets';
import type { EicFrame, EicFrames } from './analyze';
import type { SampleBank } from './orchestra';

export let SWEEP_SECONDS: number;
export let STEP: number;
export function setSweep(seconds: number): void;
export let MODE: 'science' | 'orchestra';
export function setMode(m: 'science' | 'orchestra'): void;

export class Engine {
  constructor(ctx: BaseAudioContext, destination?: AudioNode);
  ctx: BaseAudioContext;
  samples?: SampleBank;
  activity: Record<string, number>;
  muted: Set<string>;
  analyser: AnalyserNode | null;
  setVolume(v: number): void;
  setMuted(layer: string, muted: boolean): void;
  newBus(): void;
}
export interface Composer {
  describe(frames: EicFrames, f: number, c: number): string;
  probeText(frame: EicFrame, r: number, c: number): string;
}
export function composerFor(dsId: string): Composer;
export function describeAt(ds: EicDataset, frames: EicFrames, f: number, c: number): string;
export function attachSamples(E: Engine, bank: SampleBank | null): void;
export function probeCell(E: Engine, ds: EicDataset, frame: EicFrame, r: number, c: number, frames: EicFrames, f: number): void;

export class Player {
  constructor(engine: Engine);
  E: Engine;
  playing: boolean;
  onStep: ((k: number) => void) | null;
  load(ds: EicDataset, frames: EicFrames): void;
  start(fromStep?: number): void;
  setSweep(seconds: number): void;
  position(): number | null;
  stop(): void;
}
export function renderOffline(
  ds: EicDataset,
  frames: EicFrames,
  opts?: { sweep?: number; sampleRate?: number; muted?: string[]; mode?: 'science' | 'orchestra'; samples?: SampleBank | null },
): Promise<AudioBuffer>;
export function encodeWav(buf: AudioBuffer): Blob;

import type { EicDataset } from './datasets';
import type { EicFrames } from './analyze';

export interface Family { label: string; color: string; lead: string }
export const FAMILIES: Record<string, Family>;
export const FOUNDATION: { id: string; label: string; color: string }[];
export interface OrchestraConfig { bpm: number; tonic: number; scale: string; progs: unknown[] }
export function orchestraFor(id: string): OrchestraConfig;
export const BARS: number;
export function sweepForBpm(bpm: number): number;
export function familiesUsed(frames: EicFrames, ds: EicDataset): string[];

/** The minimal engine surface the orchestra composer calls. */
export interface SampleSink {
  ctx: { currentTime: number };
  layer: string;
  sample(inst: string, t: number, midi: number | null, vel: number, pan?: number, opts?: object): boolean;
}
export const ORCHESTRA_COMPOSER: {
  frameStart(E: SampleSink, frames: EicFrames, f: number, t: number, dur: number, ds: EicDataset): void;
  step(E: SampleSink, frames: EicFrames, f: number, c: number, t: number, rnd: () => number, S: number, ds: EicDataset): void;
  describe(frames: EicFrames, f: number, c: number, ds: EicDataset): string;
  probeFamily(ds: EicDataset, frames: EicFrames, f: number, r: number, c: number): { fam: string; lvl: number } | null;
};

export interface SampleBank { [instrument: string]: { pitched: boolean; zones: { midi: number | null; buffer: AudioBuffer }[] } }
export interface SampleManifest { source: string; sampleRate: number; instruments: Record<string, { pitched: boolean; zones: { file: string; midi: number | null; secs: number; src: string }[] }> }
export function loadManifest(): Promise<SampleManifest>;
export function loadSamples(
  decodeCtx: BaseAudioContext,
  onProgress?: (done: number, total: number, bytes: number) => void,
  only?: string[],
): Promise<SampleBank>;

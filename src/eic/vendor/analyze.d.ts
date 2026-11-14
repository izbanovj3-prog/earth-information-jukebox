import type { EicDataset } from './datasets';

export const COLS: number;
export const ROWS: number;
export interface Geo { lonL: number; lonR: number; latT: number; latB: number }
export const DEFAULT_GEO: Geo;
export function lonOfCol(c: number, geo?: Geo): number;
export function latOfRow(r: number, geo?: Geo): number;
export function fmtLon(lon: number): string;
export function fmtLat(lat: number): string;
export function regionName(lat: number, lon: number): string;
export function channelsOf(dsId: string): string[];

/** One analysed frame: a COLS x ROWS grid per channel, plus derived statistics. */
export interface EicFrame {
  label: string;
  date?: string;
  url: string;
  ch: Record<string, Float32Array>;
  stats: Record<string, number> & { topRegions?: string[] };
}
export type EicFrames = EicFrame[] & { geo: Geo; norm: Record<string, number> };

export function loadDataset(ds: EicDataset, onProgress?: (msg: string) => void): Promise<EicFrames>;
export function thumbUrl(ds: EicDataset): string;
/** Normalise channels across all frames of a dataset (in place) and compute per-frame stats. */
export function normalizeFrames(frames: EicFrame[], ds: EicDataset): void;

// Pure sampling of frames: columns, probes, whole-frame statistics.
import type { Band, ColumnSample, Frame } from '../types';
import { regionMean, regionStats, valueGrid, xToLon, yToLat } from '../data/values';

/** Minimum fraction of valid pixels for a band to count as having data. */
export const MIN_VALID = 0.03;

/**
 * Sample a vertical strip centred on column x, split into `bandCount` equal latitude bands
 * (north -> south). Band value = mean of valid pixels; null when too few are valid.
 */
export function sampleColumn(frame: Frame, x: number, bandCount: number, halfWidth = 0): ColumnSample {
  if (!(bandCount >= 1)) throw new Error('bandCount must be >= 1');
  const cx = Math.min(frame.width - 1, Math.max(0, Math.round(x)));
  const x0 = cx - halfWidth;
  const x1 = cx + halfWidth;
  const bands: Band[] = [];
  let sum = 0;
  let weight = 0;
  for (let b = 0; b < bandCount; b++) {
    const y0 = Math.round((b * frame.height) / bandCount);
    const y1 = Math.round(((b + 1) * frame.height) / bandCount) - 1;
    const { mean: value, min, max } = regionStats(frame, x0, y0, x1, y1, MIN_VALID);
    const north = 90 - (b * 180) / bandCount;
    const south = 90 - ((b + 1) * 180) / bandCount;
    bands.push({ lat: [south, north], value, min, max });
    if (value !== null) {
      sum += value;
      weight++;
    }
  }
  return { x: cx, lon: xToLon(frame, cx), bands, meanValue: weight ? sum / weight : null };
}

/** Value under an explore cursor: mean of a small neighbourhood. */
export function probe(frame: Frame, x: number, y: number, radius = 2): number | null {
  return regionMean(frame, x - radius, y - radius, x + radius, y + radius, 0.2);
}

export interface Extreme {
  value: number;
  lat: number;
  lon: number;
}

export interface FrameStats {
  /** Area-weighted mean over valid pixels. */
  mean: number | null;
  /** Area-weighted sum of values / total area (e.g. global ice cover). */
  coverage: number;
  /** Area-weighted fraction of the globe with data. */
  validFraction: number;
  min: Extreme | null;
  max: Extreme | null;
  /** Mean per latitude band (north -> south). */
  bandMeans: (number | null)[];
  /** Area-weighted sum / band area per band (e.g. Arctic ice cover). */
  bandCoverage: number[];
}

const statsCache = new WeakMap<Frame, FrameStats>();

/** Whole-frame statistics with cos(latitude) area weighting. Cached per frame. */
export function frameStats(frame: Frame, bandCount = 3): FrameStats {
  const hit = statsCache.get(frame);
  if (hit && hit.bandMeans.length === bandCount) return hit;
  const g = valueGrid(frame);
  let wSum = 0;
  let vSum = 0;
  let wAll = 0;
  let min: Extreme | null = null;
  let max: Extreme | null = null;
  const bSum = new Array<number>(bandCount).fill(0);
  const bW = new Array<number>(bandCount).fill(0);
  const bAll = new Array<number>(bandCount).fill(0);
  for (let y = 0; y < frame.height; y++) {
    const lat = yToLat(frame, y);
    const w = Math.cos((lat * Math.PI) / 180);
    const band = Math.min(bandCount - 1, Math.floor((y * bandCount) / frame.height));
    for (let x = 0; x < frame.width; x++) {
      wAll += w;
      bAll[band]! += w;
      const v = g[y * frame.width + x]!;
      if (Number.isNaN(v)) continue;
      wSum += w;
      vSum += v * w;
      bSum[band]! += v * w;
      bW[band]! += w;
      if (!min || v < min.value) min = { value: v, lat, lon: xToLon(frame, x) };
      if (!max || v > max.value) max = { value: v, lat, lon: xToLon(frame, x) };
    }
  }
  const stats: FrameStats = {
    mean: wSum > 0 ? vSum / wSum : null,
    coverage: wAll > 0 ? vSum / wAll : 0,
    validFraction: wAll > 0 ? wSum / wAll : 0,
    min,
    max,
    bandMeans: bSum.map((s, i) => (bW[i]! > 0 ? s / bW[i]! : null)),
    bandCoverage: bSum.map((s, i) => (bAll[i]! > 0 ? s / bAll[i]! : 0)),
  };
  statsCache.set(frame, stats);
  return stats;
}

/** The global metric followed by the change drone. */
export function droneMetricOf(stats: FrameStats, metric: 'mean' | 'coverage' | 'northCoverage'): number | null {
  if (metric === 'mean') return stats.mean;
  if (metric === 'coverage') return stats.coverage;
  return stats.bandCoverage[0] ?? null;
}

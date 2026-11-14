// Recover a physical value per pixel from a Frame. Result is cached per frame object.
import type { Frame } from '../types';
import { createValueLookup, luminanceLookup } from './colormap';

const cache = new WeakMap<Frame, Float32Array>();

/** Per-pixel values (row-major, north row first). NaN = no data. */
export function valueGrid(frame: Frame): Float32Array {
  const hit = cache.get(frame);
  if (hit) return hit;
  const { width, height, rgba } = frame;
  if (rgba.length !== width * height * 4) throw new Error('Frame rgba size does not match dimensions');
  const lookup = frame.legend?.calibrated ? createValueLookup(frame.legend) : luminanceLookup;
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; p < out.length; p++, i += 4) {
    const v = lookup(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!, rgba[i + 3]!);
    out[p] = v === null ? NaN : v;
  }
  cache.set(frame, out);
  return out;
}

/** Mean of valid values in a rectangle (clamped). null if fewer than minValid fraction are valid. */
export function regionMean(frame: Frame, x0: number, y0: number, x1: number, y1: number, minValid = 0.1): number | null {
  const g = valueGrid(frame);
  const xa = Math.max(0, Math.floor(Math.min(x0, x1)));
  const xb = Math.min(frame.width - 1, Math.floor(Math.max(x0, x1)));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1)));
  const yb = Math.min(frame.height - 1, Math.floor(Math.max(y0, y1)));
  let sum = 0;
  let n = 0;
  let total = 0;
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      total++;
      const v = g[y * frame.width + x]!;
      if (!Number.isNaN(v)) {
        sum += v;
        n++;
      }
    }
  }
  return total > 0 && n / total >= minValid && n > 0 ? sum / n : null;
}

export function xToLon(frame: Pick<Frame, 'width'>, x: number): number {
  return ((x + 0.5) / frame.width) * 360 - 180;
}

export function yToLat(frame: Pick<Frame, 'height'>, y: number): number {
  return 90 - ((y + 0.5) / frame.height) * 180;
}

// GIBS colormap (v1.3 XML) parser and colour -> value recovery. Pure, runs in browser and Node.
import type { Legend, LegendEntry } from '../types';

const ATTR = /(\w+)="([^"]*)"/g;

function attrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(ATTR)) out[m[1]!] = m[2]!;
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

/** Parse a bound like "-INF", "+INF", "3.5". */
function bound(s: string): number {
  const t = s.trim().toUpperCase();
  if (t === '-INF') return -Infinity;
  if (t === '+INF' || t === 'INF') return Infinity;
  const n = t === '' ? NaN : Number(t);
  if (!Number.isFinite(n)) throw new Error(`Bad colormap bound: ${s}`);
  return n;
}

/** Split XML into <ColorMap ...>body</ColorMap> blocks with indexOf (linear, no backtracking). */
function colorMapBlocks(xml: string): { head: string; body: string }[] {
  const out: { head: string; body: string }[] = [];
  let i = 0;
  for (;;) {
    const start = xml.indexOf('<ColorMap', i);
    if (start < 0) break;
    const next = xml[start + 9];
    if (next !== ' ' && next !== '>' && next !== '\n' && next !== '\t' && next !== '\r') {
      i = start + 9; // e.g. <ColorMaps>
      continue;
    }
    const headEnd = xml.indexOf('>', start);
    const close = xml.indexOf('</ColorMap>', headEnd);
    if (headEnd < 0 || close < 0) break;
    out.push({ head: xml.slice(start + 9, headEnd), body: xml.slice(headEnd + 1, close) });
    i = close + 11;
  }
  return out;
}

/**
 * Parse a GIBS interval string ("[a,b)", "[a]", "[-INF,a)") into [lo, hi] and a representative value:
 * midpoint for finite intervals, the finite bound for half-open infinite ones.
 */
export function parseInterval(s: string): { lo: number; hi: number; value: number } {
  // Linear-time parsing (no backtracking regex): bracket, one or two comma-separated bounds, bracket.
  const t = s.trim();
  if (t.length < 3 || t.length > 64) throw new Error(`Bad colormap interval: ${s.slice(0, 64)}`);
  if (!'[('.includes(t[0]!) || !'])'.includes(t[t.length - 1]!)) throw new Error(`Bad colormap interval: ${s}`);
  const parts = t.slice(1, -1).split(',');
  if (parts.length < 1 || parts.length > 2) throw new Error(`Bad colormap interval: ${s}`);
  const lo = bound(parts[0]!);
  const hi = parts.length === 2 ? bound(parts[1]!) : lo;
  let value: number;
  if (Number.isFinite(lo) && Number.isFinite(hi)) value = (lo + hi) / 2;
  else if (Number.isFinite(lo)) value = lo;
  else if (Number.isFinite(hi)) value = hi;
  else throw new Error(`Unbounded interval: ${s}`);
  return { lo, hi, value };
}

function parseRgb(s: string): [number, number, number] {
  const parts = s.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 3 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    throw new Error(`Bad rgb: ${s}`);
  }
  return parts as [number, number, number];
}

/** Parse GIBS colormap XML into a Legend. Throws on malformed or empty input. */
export function parseColormap(xml: string): Legend {
  if (xml.length > 2_000_000) throw new Error('Colormap too large');
  const maps = colorMapBlocks(xml);
  if (maps.length === 0) throw new Error('No <ColorMap> found');
  const entries: LegendEntry[] = [];
  let title = '';
  let units: string | null = null;
  let min = Infinity;
  let max = -Infinity;
  for (const { head, body } of maps) {
    const mapAttrs = attrs(head);
    let mapHasData = false;
    for (const e of body.matchAll(/<ColorMapEntry\b([^>]*)>/g)) {
      const a = attrs(e[1]!);
      if (!a.rgb) continue;
      const rgb = parseRgb(a.rgb);
      const noData = a.nodata === 'true' || a.transparent === 'true' || a.value === undefined;
      if (noData) {
        entries.push({ rgb, value: null });
        continue;
      }
      const { lo, hi, value } = parseInterval(a.value!);
      for (const b of [lo, hi]) {
        if (Number.isFinite(b)) {
          min = Math.min(min, b);
          max = Math.max(max, b);
        }
      }
      entries.push({ rgb, value });
      mapHasData = true;
    }
    if (mapHasData && !title) {
      title = decodeEntities(mapAttrs.title ?? '');
      units = mapAttrs.units ? decodeEntities(mapAttrs.units) : null;
    }
  }
  if (!entries.some((e) => e.value !== null) || !Number.isFinite(min) || !(max > min)) {
    throw new Error('Colormap has no data entries');
  }
  return { title, units, entries, min, max, calibrated: true };
}

export type ValueLookup = (r: number, g: number, b: number, a: number) => number | null;

/** Max squared RGB distance for a nearest-colour match (beyond this the pixel is treated as no data). */
export const MAX_COLOUR_DISTANCE_SQ = 3 * 12 * 12;

/** Build a fast colour -> value function: exact match first, then nearest legend colour. */
export function createValueLookup(legend: Legend): ValueLookup {
  const exact = new Map<number, number | null>();
  for (const e of legend.entries) {
    const key = (e.rgb[0] << 16) | (e.rgb[1] << 8) | e.rgb[2];
    // Data entries win over no-data entries that share a colour.
    if (!exact.has(key) || exact.get(key) === null) exact.set(key, e.value);
  }
  const cache = new Map<number, number | null>();
  return (r, g, b, a) => {
    if (a < 128) return null;
    const key = (r << 16) | (g << 8) | b;
    const hit = exact.get(key);
    if (hit !== undefined) return hit;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    let best: number | null = null;
    let bestD = Infinity;
    for (const e of legend.entries) {
      const d = (e.rgb[0] - r) ** 2 + (e.rgb[1] - g) ** 2 + (e.rgb[2] - b) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e.value;
      }
    }
    const v = bestD <= MAX_COLOUR_DISTANCE_SQ ? best : null;
    cache.set(key, v);
    return v;
  };
}

/** Fallback when no colormap is usable: relative luminance 0..1 (NOT calibrated). */
export function luminanceLegend(): Legend {
  return { title: 'Relative brightness', units: null, entries: [], min: 0, max: 1, calibrated: false };
}

export const luminanceLookup: ValueLookup = (r, g, b, a) =>
  a < 128 ? null : (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

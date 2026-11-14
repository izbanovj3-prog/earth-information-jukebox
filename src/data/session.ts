// Session-wide loading policy: decoded-frame LRU, legend cache, and the live-GIBS circuit breaker.
// GIBS WMS answers with `Cache-Control: no-store`, so the browser HTTP cache never helps.
import type { Legend } from '../types';
import type { Track } from './catalog';
import { LruCache } from './frameCache';
import { loadFrame, loadLegend, type LoadResult, type LoaderDeps } from './loader';

/** ~1 MB of RGBA per frame: 30 frames keep about two records' worth in memory. */
const frameCache = new LruCache<Promise<LoadResult>>(30);
const legendCache = new Map<string, Promise<{ legend: Legend; warning?: string }>>();

/** After two live failures in a session, stop asking GIBS (fast fallback to bundled frames). */
const MAX_LIVE_FAILURES = 2;
let liveFailures = 0;
let lastFallbackReason: string | undefined;

export function resetSession(): void {
  liveFailures = 0;
  lastFallbackReason = undefined;
  legendCache.clear();
}

export function cachedLegend(track: Track, deps: LoaderDeps = {}) {
  let p = legendCache.get(track.id);
  if (!p) {
    p = loadLegend(track, deps);
    legendCache.set(track.id, p);
    // A fallback (uncalibrated) legend is never cached: the next load or Retry tries again.
    void p.then((r) => {
      if (r.warning) legendCache.delete(track.id);
    });
  }
  return p;
}

/**
 * Load (or reuse) one frame. Bundled results carry a fallback reason for as long as live GIBS is
 * considered down in this session, so every record shows the offline banner, not only the first.
 */
export function cachedFrame(track: Track, i: number, legend: Legend, deps: LoaderDeps = {}): Promise<LoadResult> {
  const key = `${track.layerId}|${track.dates[i]}`;
  let p = frameCache.get(key);
  if (!p) {
    p = loadFrame(track, track.dates[i]!, legend, { ...deps, preferLive: liveFailures < MAX_LIVE_FAILURES }).then((r) => {
      if (r.fallbackReason) {
        liveFailures++;
        lastFallbackReason = r.fallbackReason;
      }
      if (r.frame.source.mode === 'bundled' && !r.offline && !r.fallbackReason && lastFallbackReason) {
        return { ...r, fallbackReason: lastFallbackReason };
      }
      return r;
    });
    // Never cache failures: a retry must hit the network again.
    p.catch(() => frameCache.delete(key));
    frameCache.set(key, p);
  }
  return p;
}

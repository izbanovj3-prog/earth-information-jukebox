import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Track } from '../data/catalog';
import { LruCache, prefetchOrder } from '../data/frameCache';
import { FetchError } from '../data/gibs';
import { loadFrame, loadLegend, type LoadResult } from '../data/loader';
import type { Frame, Legend } from '../types';

export interface TrackFrames {
  status: 'loading' | 'ready' | 'error';
  legend: Legend | null;
  legendWarning?: string;
  frames: (Frame | undefined)[];
  loaded: number;
  /** Set if any frame came from the bundle because live GIBS failed. */
  fallbackReason?: string;
  error?: string;
  retry: () => void;
}

type State = Omit<TrackFrames, 'retry'> & { key: string };

/** ~1 MB of RGBA per frame: 30 frames keep about two records' worth in memory. */
const frameCache = new LruCache<Promise<LoadResult>>(30);
const legendCache = new Map<string, Promise<{ legend: Legend; warning?: string }>>();
/** Once GIBS fails twice in a session, stop trying it (fast fallback to bundled frames). */
let liveFailures = 0;

function cachedLegend(track: Track) {
  let p = legendCache.get(track.id);
  if (!p) {
    p = loadLegend(track);
    legendCache.set(track.id, p);
  }
  return p;
}

function cachedFrame(track: Track, i: number, legend: Legend): Promise<LoadResult> {
  const key = `${track.layerId}|${track.dates[i]}`;
  let p = frameCache.get(key);
  if (!p) {
    p = loadFrame(track, track.dates[i]!, legend, { preferLive: liveFailures < 2 }).then((r) => {
      if (r.fallbackReason) liveFailures++;
      return r;
    });
    // Never cache failures: a retry must hit the network again.
    p.catch(() => frameCache.delete(key));
    frameCache.set(key, p);
  }
  return p;
}

/**
 * Lazily loads a record's frames: the frame in focus first, then a small window ahead (for the
 * time-lapse), and more as the focus moves. Decoded frames are reused across record switches.
 */
export function useTrackFrames(track: Track, focus: number): TrackFrames {
  const [attempt, setAttempt] = useState(0);
  const key = `${track.id}:${attempt}`;
  const [state, setState] = useState<State | null>(null);
  const framesRef = useRef<{ key: string; frames: (Frame | undefined)[]; fallbackReason?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (framesRef.current?.key !== key) framesRef.current = { key, frames: new Array(track.dates.length).fill(undefined) };
    const store = framesRef.current;

    const publish = (legend: Legend, warning?: string) => {
      if (cancelled) return;
      const loaded = store.frames.filter(Boolean).length;
      setState({ key, status: 'ready', legend, legendWarning: warning, frames: [...store.frames], loaded, fallbackReason: store.fallbackReason });
    };

    (async () => {
      const { legend, warning } = await cachedLegend(track);
      if (cancelled) return;
      for (const i of prefetchOrder(track.dates.length, focus)) {
        if (store.frames[i]) continue;
        const r = await cachedFrame(track, i, legend);
        if (cancelled) return;
        store.frames[i] = r.frame;
        store.fallbackReason ??= r.fallbackReason;
        publish(legend, warning);
      }
    })().catch((e: unknown) => {
      if (cancelled || (e instanceof FetchError && e.kind === 'aborted')) return;
      const error = e instanceof Error ? e.message : String(e);
      setState((s) =>
        s && s.key === key
          ? { ...s, status: s.loaded > 0 ? 'ready' : 'error', error }
          : { key, status: 'error', legend: null, frames: [...store.frames], loaded: 0, error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [track, key, focus]);

  const empty = useMemo<State>(
    () => ({ key, status: 'loading', legend: null, frames: new Array(track.dates.length).fill(undefined), loaded: 0 }),
    [key, track],
  );
  const retry = useCallback(() => {
    liveFailures = 0;
    setAttempt((a) => a + 1);
  }, []);
  const current = state && state.key === key ? state : empty;
  return { ...current, retry };
}

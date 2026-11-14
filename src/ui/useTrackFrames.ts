import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Track } from '../data/catalog';
import { prefetchOrder } from '../data/frameCache';
import { FetchError } from '../data/gibs';
import { cachedFrame, cachedLegend, resetSession } from '../data/session';
import type { Frame, Legend } from '../types';

export interface TrackFrames {
  status: 'loading' | 'ready' | 'error';
  legend: Legend | null;
  legendWarning?: string;
  frames: (Frame | undefined)[];
  /** Per-frame load errors (only for frames that failed both live and bundled). */
  frameErrors: (string | undefined)[];
  loaded: number;
  /** Set if frames came from the bundle because live GIBS failed. */
  fallbackReason?: string;
  /** True when the app is configured to stay offline (VITE_OFFLINE_ONLY). */
  offline?: boolean;
  error?: string;
  retry: () => void;
}

type State = Omit<TrackFrames, 'retry'> & { key: string };

interface Store {
  key: string;
  frames: (Frame | undefined)[];
  errors: (string | undefined)[];
  fallbackReason?: string;
  offline?: boolean;
}

/**
 * Lazily loads a record's frames: the frame in focus first, then a small window ahead (for the
 * time-lapse) and the first frame (baseline). Decoded frames are reused across record switches.
 */
export function useTrackFrames(track: Track, focus: number): TrackFrames {
  const [attempt, setAttempt] = useState(0);
  const key = `${track.id}:${attempt}`;
  const [state, setState] = useState<State | null>(null);
  const storeRef = useRef<Store | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (storeRef.current?.key !== key) {
      storeRef.current = { key, frames: new Array(track.dates.length).fill(undefined), errors: new Array(track.dates.length).fill(undefined) };
    }
    const store = storeRef.current;
    let legendInfo: { legend: Legend; warning?: string } | null = null;

    const publish = () => {
      if (cancelled || !legendInfo) return;
      const loaded = store.frames.filter(Boolean).length;
      const anyError = store.errors.some(Boolean);
      setState({
        key,
        status: loaded === 0 && anyError ? 'error' : 'ready',
        legend: legendInfo.legend,
        legendWarning: legendInfo.warning,
        frames: [...store.frames],
        frameErrors: [...store.errors],
        loaded,
        fallbackReason: store.fallbackReason,
        offline: store.offline,
        error: store.errors.find(Boolean),
      });
    };

    (async () => {
      legendInfo = await cachedLegend(track);
      if (cancelled) return;
      publish();
      for (const i of prefetchOrder(track.dates.length, focus)) {
        if (store.frames[i] || cancelled) continue;
        try {
          const r = await cachedFrame(track, i, legendInfo.legend);
          store.frames[i] = r.frame;
          store.errors[i] = undefined;
          store.fallbackReason ??= r.fallbackReason;
          store.offline ||= r.offline;
        } catch (e) {
          if (e instanceof FetchError && e.kind === 'aborted') return;
          store.errors[i] = e instanceof Error ? e.message : String(e);
        }
        publish();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track, key, focus]);

  const empty = useMemo<State>(
    () => ({
      key,
      status: 'loading',
      legend: null,
      frames: new Array(track.dates.length).fill(undefined),
      frameErrors: new Array(track.dates.length).fill(undefined),
      loaded: 0,
    }),
    [key, track],
  );
  const retry = useCallback(() => {
    resetSession();
    setAttempt((a) => a + 1);
  }, []);
  // State from a previous record/attempt is never shown: derive "loading" until the new key reports.
  const current = state && state.key === key ? state : empty;
  return { ...current, retry };
}

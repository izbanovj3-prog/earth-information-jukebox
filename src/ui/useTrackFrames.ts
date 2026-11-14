import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Track } from '../data/catalog';
import { FetchError } from '../data/gibs';
import { loadFrame, loadLegend } from '../data/loader';
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

const CONCURRENCY = 3;

export function useTrackFrames(track: Track): TrackFrames {
  const [attempt, setAttempt] = useState(0);
  const key = `${track.id}:${attempt}`;
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const frames: (Frame | undefined)[] = new Array(track.dates.length).fill(undefined);
    let loaded = 0;
    let fallbackReason: string | undefined;

    (async () => {
      const { legend, warning } = await loadLegend(track);
      if (ac.signal.aborted) return;
      let liveFailures = 0;
      const loadOne = async (i: number) => {
        // After two live failures, stop trying GIBS for this track (fast fallback).
        const r = await loadFrame(track, track.dates[i]!, legend, { signal: ac.signal, preferLive: liveFailures < 2 });
        if (r.fallbackReason) {
          liveFailures++;
          fallbackReason ??= r.fallbackReason;
        }
        frames[i] = r.frame;
        loaded++;
        if (!ac.signal.aborted) {
          setState({ key, status: 'ready', legend, legendWarning: warning, frames: [...frames], loaded, fallbackReason });
        }
      };
      // First frame first so playback can start quickly, then the rest.
      await loadOne(0);
      const queue = track.dates.map((_, i) => i).slice(1);
      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          while (queue.length && !ac.signal.aborted) await loadOne(queue.shift()!);
        }),
      );
    })().catch((e: unknown) => {
      if (ac.signal.aborted || (e instanceof FetchError && e.kind === 'aborted')) return;
      const error = e instanceof Error ? e.message : String(e);
      setState((s) =>
        s && s.key === key
          ? { ...s, status: s.loaded > 0 ? 'ready' : 'error', error }
          : { key, status: 'error', legend: null, frames: [...frames], loaded: 0, error },
      );
    });
    return () => ac.abort();
  }, [track, key]);

  const empty = useMemo<State>(
    () => ({ key, status: 'loading', legend: null, frames: new Array(track.dates.length).fill(undefined), loaded: 0 }),
    [key, track],
  );
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  // State from a previous record/attempt is never shown: derive "loading" until the new key reports.
  const current = state && state.key === key ? state : empty;
  return { ...current, retry };
}

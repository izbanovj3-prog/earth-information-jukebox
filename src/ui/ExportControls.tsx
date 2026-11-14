// Take the sound home, two ways:
// 1. Instant: the pre-rendered soundscape for this record in the chosen mode (WebM/Opus, from the playlist).
// 2. "Render with my mixer settings": an offline re-render that honours the mixer mutes, as WAV, with a
//    progress bar, Cancel, and a clear error. It takes a minute or two, so it is the second choice.
import { useEffect, useRef, useState } from 'react';
import type { EicSession, SoundMode } from '../eic/session';
import { loadPlaylist, modeLabel, playlistUrl, type PlaylistTrack } from '../eic/playlist';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const btn =
  'min-h-[48px] px-space-md inline-flex items-center justify-center font-label-md text-label-md uppercase transition-colors disabled:opacity-50 w-fit';

/** Instant download of the pre-rendered file for this record and mode. */
export function InstantDownload({ dataset, mode }: { dataset: string; mode: SoundMode }) {
  const [tracks, setTracks] = useState<PlaylistTrack[] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadPlaylist().then((t) => alive && setTracks(t));
    return () => {
      alive = false;
    };
  }, []);
  const t = tracks?.find((x) => x.dataset === dataset && x.mode === mode);
  if (!tracks) return <p className="m-0 font-label-sm text-label-sm text-secondary">Loading the ready-made files…</p>;
  if (!t) return null;
  return (
    <div className="flex flex-col gap-1">
      <a href={playlistUrl(t)} download={t.file} className={`${btn} bg-primary text-on-primary hover:bg-primary-fixed`} data-testid="instant-download">
        Download this soundscape
      </a>
      <span className="font-label-sm text-label-sm text-secondary">
        {modeLabel(t.mode)} · {mmss(t.seconds)} · WebM (Opus) audio, ready at once. Rendered by the same engine with every instrument on.
      </span>
    </div>
  );
}

type RenderState =
  | { kind: 'idle' }
  | { kind: 'busy'; fraction: number; started: number }
  | { kind: 'done'; href: string; file: string; label: string; ms: number }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

/** Offline re-render with the mixer mutes: progress bar, Cancel, error message. */
export function MixRender({ session, ready, mutedCount }: { session: EicSession; ready: boolean; mutedCount: number }) {
  const [st, setSt] = useState<RenderState>({ kind: 'idle' });
  const abort = useRef<AbortController | null>(null);
  const href = st.kind === 'done' ? st.href : null;
  useEffect(
    () => () => {
      if (href) URL.revokeObjectURL(href);
    },
    [href],
  );
  // Leaving the record (or the page) cancels a render in progress.
  useEffect(() => () => abort.current?.abort(), []);

  const run = async () => {
    const ac = new AbortController();
    abort.current = ac;
    const started = performance.now();
    setSt({ kind: 'busy', fraction: 0, started });
    try {
      const r = await session.renderWav({ signal: ac.signal, onProgress: (fraction) => !ac.signal.aborted && setSt({ kind: 'busy', fraction, started }) });
      const label = `${r.file} (${(r.blob.size / 1e6).toFixed(1)} MB, ${Math.round(r.seconds)} s, ${modeLabel(r.mode)})`;
      setSt({ kind: 'done', href: URL.createObjectURL(r.blob), file: r.file, label, ms: performance.now() - started });
    } catch (e) {
      if (ac.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) setSt({ kind: 'cancelled' });
      else setSt({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      if (abort.current === ac) abort.current = null;
    }
  };

  const pct = st.kind === 'busy' ? Math.round(st.fraction * 100) : 0;
  return (
    <div className="flex flex-col gap-space-xs">
      <div className="flex flex-wrap gap-space-sm">
        <button
          type="button"
          disabled={!ready || st.kind === 'busy'}
          onClick={() => void run()}
          className={`${btn} bg-surface-container hover:bg-surface-container-high text-on-surface`}
        >
          Render with my mixer settings
        </button>
        {st.kind === 'busy' && (
          <button type="button" onClick={() => abort.current?.abort()} className={`${btn} bg-surface-container-lowest hover:bg-surface-container text-on-surface`}>
            Cancel
          </button>
        )}
      </div>
      <span className="font-label-sm text-label-sm text-secondary">
        WAV, {mutedCount ? `${mutedCount} mixer ${mutedCount === 1 ? 'layer' : 'layers'} off` : 'all mixer layers on'}. Takes a minute or two.
      </span>
      {st.kind === 'busy' && (
        <div className="flex items-center gap-space-sm">
          <div
            role="progressbar"
            aria-label="Rendering progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="flex-1 h-2 bg-surface-container-highest"
          >
            <div className="h-2 bg-primary transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-label-md text-on-surface w-12 text-right">{pct}%</span>
        </div>
      )}
      <p className="m-0 font-label-sm text-label-sm text-secondary" role="status" data-testid="wav-status">
        {st.kind === 'busy' && 'Rendering the whole record with your mixer settings…'}
        {st.kind === 'cancelled' && 'Rendering cancelled.'}
        {st.kind === 'done' && (
          <>
            Done in {(st.ms / 1000).toFixed(0)} s.{' '}
            <a className="text-primary underline" href={st.href} download={st.file}>
              Download {st.label}
            </a>
          </>
        )}
      </p>
      {st.kind === 'error' && (
        <p className="m-0 px-space-sm py-space-xs bg-error-container text-on-error-container font-label-md text-label-md" role="alert">
          Rendering failed: {st.message}. The ready-made download above still works.
        </p>
      )}
    </div>
  );
}

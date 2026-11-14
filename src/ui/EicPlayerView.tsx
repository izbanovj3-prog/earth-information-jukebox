// Player for the Earth Information Center (NASA SVS) records, in the same shell, rail and
// visual language as the GIBS player. Sound comes from the teammate's engine via EicSession.
import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import type { Track } from '../data/catalog';
import { EIC_COLS, EIC_ROWS, frameAlt, frameDescription, hearingFor, shortLabel, type EicSession, type EicState, type SoundMode } from '../eic/session';
import type { EicDataset } from '../eic/vendor/datasets';
import { MuteIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, VolumeIcon } from './icons';
import { TimeScrubber } from './TimeScrubber';
import { TrackRail, type EicRecord } from './TrackRail';
import type { NarrationMode } from './Transport';

export interface EicCursor {
  r: number;
  c: number;
}

interface Props {
  session: EicSession;
  state: EicState;
  dataset: EicDataset;
  records: EicRecord[];
  onSelectEic: (id: string) => void;
  tracks: Track[];
  onSelectTrack: (i: number) => void;
  onBrowseAll: () => void;
  notice?: string;
  audioError?: string | null;
  cursor: EicCursor;
  cursorLabel: string;
  exploring: boolean;
  onProbe: (r: number, c: number) => void;
  onMapFocus: () => void;
  onToggle: () => void;
  onPrevRecord: () => void;
  onNextRecord: () => void;
  onMode: (m: SoundMode) => void;
  volume: number;
  onVolume: (v: number) => void;
  muted: boolean;
  onMute: () => void;
  narration: NarrationMode;
  onNarration: (n: NarrationMode) => void;
  onOpenHelp: () => void;
}

const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;

/** The map picture with the scan line (driven by the audio clock) and the explore cursor. */
const EicStage = forwardRef<HTMLDivElement, Pick<Props, 'session' | 'state' | 'dataset' | 'cursor' | 'cursorLabel' | 'exploring' | 'onProbe' | 'onMapFocus'>>(
  function EicStage(p, ref) {
    const frames = p.session.loadedFrames;
    const frame = frames?.[p.state.frameIndex];
    const lineRef = useRef<HTMLDivElement>(null);

    // Scan line position from the AudioContext clock, without React renders per animation frame.
    useEffect(() => {
      if (!p.state.playing) return;
      let raf = 0;
      const loop = () => {
        const pos = p.session.position();
        if (pos && lineRef.current) lineRef.current.style.transform = `translateX(${((pos.col + 0.5) / EIC_COLS) * 100}%)`;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }, [p.state.playing, p.session]);

    const cellAt = (e: React.PointerEvent<HTMLDivElement>) => {
      const box = e.currentTarget.getBoundingClientRect();
      const c = Math.min(EIC_COLS - 1, Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * EIC_COLS)));
      const r = Math.min(EIC_ROWS - 1, Math.max(0, Math.floor(((e.clientY - box.top) / box.height) * EIC_ROWS)));
      return { r, c };
    };

    return (
      <div className="flex flex-col gap-space-xs">
        <div className="flex items-center justify-between pb-space-xs flex-wrap gap-space-xs" aria-hidden="true">
          <div className="flex items-center gap-space-xs flex-wrap">
            <span className="font-label-sm text-label-sm uppercase bg-surface-container-high text-primary px-space-sm py-1">Earth Information Center</span>
            <span className="font-mono text-label-md bg-surface-container-lowest text-primary px-space-sm py-1">{frame?.label ?? '…'}</span>
            <span className="font-label-sm text-label-sm uppercase border border-outline text-on-surface px-space-sm py-1">NASA SVS #{p.dataset.svsId}</span>
          </div>
        </div>
        <div className="relative w-full aspect-[2/1] bg-surface-container-lowest overflow-hidden touch-none">
          {frame && <img src={frame.url} alt="" className="absolute inset-0 w-full h-full object-fill" />}
          <div
            ref={lineRef}
            className="absolute top-0 bottom-0 left-0 w-full pointer-events-none"
            style={{ opacity: p.state.playing && !p.exploring ? 1 : 0 }}
            aria-hidden="true"
          >
            <div className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_12px_var(--color-primary)]" />
          </div>
          {p.exploring && (
            <div
              className="absolute border-2 border-primary pointer-events-none"
              style={{
                left: `${(p.cursor.c / EIC_COLS) * 100}%`,
                top: `${(p.cursor.r / EIC_ROWS) * 100}%`,
                width: `${100 / EIC_COLS}%`,
                height: `${100 / EIC_ROWS}%`,
                minWidth: 8,
                minHeight: 8,
              }}
              aria-hidden="true"
            />
          )}
          <div
            ref={ref}
            tabIndex={0}
            role="application"
            aria-roledescription="sonified map"
            aria-label={`Map explorer, ${p.dataset.title}, ${frame?.label ?? 'loading'}. ${frame ? frameAlt(p.dataset, frame) : ''} Arrow keys move the cursor and play the place under it; Shift plus arrows jumps further. Press D for a description.`}
            aria-describedby="frame-desc"
            className="absolute inset-0 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px]"
            onFocus={p.onMapFocus}
            onPointerDown={(e) => {
              const { r, c } = cellAt(e);
              p.onProbe(r, c);
            }}
          />
          {p.state.status === 'loading' && (
            <div className="absolute inset-0 flex flex-col gap-space-sm items-center justify-center p-space-md text-center bg-surface-container-lowest/85" role="status">
              <span className="w-3 h-3 bg-primary tube" aria-hidden="true" />
              <span className="font-label-md text-label-md text-on-surface">Loading {p.dataset.title}…</span>
            </div>
          )}
          {p.state.status === 'error' && (
            <div className="absolute inset-0 flex flex-col gap-space-sm items-center justify-center p-space-md text-center bg-surface-container-lowest/90" role="alert">
              <span className="font-label-md text-label-md text-on-surface">This visualization could not be loaded ({p.state.error}).</span>
              <button type="button" className="min-h-[48px] px-space-md bg-primary text-on-primary font-label-md text-label-md uppercase" onClick={() => void p.session.retry()}>
                Try again
              </button>
            </div>
          )}
        </div>
        <p className="font-label-sm text-label-sm text-secondary m-0" aria-live="off">
          {p.exploring ? p.cursorLabel : 'Source: '}
          {!p.exploring && (
            <>
              <a className="text-primary underline" href={p.dataset.sourceUrl} target="_blank" rel="noopener noreferrer">
                NASA SVS #{p.dataset.svsId}
              </a>
              {` · ${p.dataset.credit}`}
            </>
          )}
        </p>
      </div>
    );
  },
);

function ModeSwitch({ state, onMode }: { state: EicState; onMode: (m: SoundMode) => void }) {
  const id = useId();
  const o = state.orchestra;
  const loadingLine =
    o.status === 'loading'
      ? `Loading the orchestra: ${o.done} of ${o.total} instruments${o.totalBytes ? `, ${mb(o.bytes)} of ${mb(o.totalBytes)}` : ''}. Scientific plays meanwhile.`
      : o.status === 'error'
        ? `The orchestra could not load (${o.error}). Scientific keeps playing.`
        : state.preferredMode === 'orchestra' && state.activeMode === 'science'
          ? state.playing
            ? 'Scientific now; the orchestra takes over when it has loaded.'
            : `Press Play: Scientific starts at once, then the orchestra (${o.total} instruments) takes over.`
          : state.activeMode === 'orchestra'
            ? 'Orchestra playing.'
            : 'Scientific: synthesized, nothing to download.';
  return (
    <fieldset className="border-0 p-0 m-0 flex flex-col gap-space-xs">
      <legend className="font-label-sm text-label-sm uppercase text-primary mb-1.5">Sound</legend>
      <div className="flex bg-surface-container-low">
        {(['orchestra', 'science'] as const).map((m) => (
          <label
            key={m}
            className={`flex-1 min-h-[48px] px-space-md flex items-center justify-center cursor-pointer font-label-md text-label-md uppercase transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
              state.preferredMode === m ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <input type="radio" className="sr-only" name={`${id}-sound`} value={m} checked={state.preferredMode === m} onChange={() => onMode(m)} />
            <span>{m === 'orchestra' ? 'Orchestra' : 'Scientific'}</span>
          </label>
        ))}
      </div>
      <p className="font-label-sm text-label-sm text-secondary m-0" role="status" data-testid="orchestra-status">
        {loadingLine}
      </p>
      {o.status === 'loading' && (
        <div className="h-1 bg-surface-container-highest" aria-hidden="true">
          <div className="h-1 bg-primary transition-[width]" style={{ width: `${o.total ? Math.round((o.done / o.total) * 100) : 0}%` }} />
        </div>
      )}
    </fieldset>
  );
}

function EicTransport(p: Props) {
  const id = useId();
  const [more, setMore] = useState(false);
  const btn =
    'min-h-[48px] min-w-[48px] px-space-md bg-surface-container-low hover:bg-surface-container-high text-on-surface flex items-center justify-center font-label-md text-label-md uppercase tracking-wider transition-colors';
  return (
    <section
      aria-label="Console transport controls"
      className="fixed bottom-0 inset-x-0 xl:left-64 z-30 bg-surface-container px-space-md sm:px-space-lg py-space-sm flex flex-wrap items-center justify-between gap-space-sm sm:gap-space-md border-t border-surface-container-highest"
    >
      <h2 className="sr-only">Player controls</h2>
      <div className="flex items-center gap-space-sm">
        <button type="button" className={btn} onClick={p.onPrevRecord} aria-label="Previous record" aria-keyshortcuts="[">
          <PrevIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          className="w-14 h-14 rounded-full bg-primary hover:bg-primary-fixed text-on-primary flex items-center justify-center shrink-0 transition-transform active:scale-95 disabled:opacity-50"
          onClick={p.onToggle}
          disabled={p.state.status !== 'ready'}
          aria-keyshortcuts="Space"
          aria-label={p.state.playing ? 'Pause' : 'Play'}
        >
          {p.state.playing ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8" />}
        </button>
        <button type="button" className={btn} onClick={p.onNextRecord} aria-label="Next record" aria-keyshortcuts="]">
          <NextIcon className="w-5 h-5" />
        </button>
        <span className="hidden sm:inline font-label-md text-label-md uppercase text-on-surface-variant px-space-sm">
          {p.state.activeMode === 'orchestra' ? 'Orchestra' : 'Scientific'}
        </span>
      </div>

      <button
        type="button"
        className="sm:hidden w-full min-h-[44px] px-space-md bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant font-label-md text-label-md uppercase text-left"
        aria-expanded={more}
        aria-controls={`${id}-more`}
        onClick={() => setMore((m) => !m)}
      >
        {more ? 'Fewer controls ▴' : 'More controls ▾'}
      </button>

      <div id={`${id}-more`} className={`${more ? 'flex' : 'hidden'} sm:flex flex-wrap items-center gap-space-sm max-h-[50vh] overflow-y-auto sm:overflow-visible sm:max-h-none`}>
        <div className="min-h-[48px] px-space-md bg-surface-container-low flex items-center gap-space-sm">
          <label htmlFor={`${id}-vol`} className="font-label-sm text-label-sm uppercase text-secondary">
            Volume <span className="text-on-surface normal-case">{Math.round(p.volume * 100)}%</span>
          </label>
          <input
            id={`${id}-vol`}
            type="range"
            className="w-20 accent-primary"
            min={0}
            max={1}
            step={0.05}
            value={p.volume}
            aria-valuetext={`${Math.round(p.volume * 100)} percent`}
            onChange={(e) => p.onVolume(Number(e.target.value))}
          />
        </div>
        <button type="button" className={`${btn} gap-space-xs`} aria-pressed={p.muted} onClick={p.onMute} aria-keyshortcuts="M">
          {p.muted ? <MuteIcon className="w-[18px] h-[18px]" /> : <VolumeIcon className="w-[18px] h-[18px]" />}
          <span>Mute [M]</span>
        </button>
        <div className="min-h-[48px] px-space-md bg-surface-container-low flex items-center gap-space-sm">
          <label htmlFor={`${id}-narr`} className="font-label-sm text-label-sm uppercase text-secondary">
            Narration
          </label>
          <select
            id={`${id}-narr`}
            className="bg-transparent text-primary font-label-md text-label-md uppercase"
            value={p.narration}
            onChange={(e) => p.onNarration(e.target.value as NarrationMode)}
          >
            <option value="detailed" className="bg-surface-container text-on-surface">
              Detailed
            </option>
            <option value="changes" className="bg-surface-container text-on-surface">
              Changes only
            </option>
            <option value="off" className="bg-surface-container text-on-surface">
              Off
            </option>
          </select>
        </div>
      </div>
    </section>
  );
}

export const EicPlayerView = forwardRef<HTMLDivElement, Props>(function EicPlayerView(p, mapRef) {
  const frames = p.session.loadedFrames;
  const frame = frames?.[p.state.frameIndex];
  const labels = frames ? frames.map((f) => shortLabel(p.dataset, f)) : p.dataset.frames.map((f) => f.label);
  const description = frame && frames ? frameDescription(p.dataset, frame, frames[p.state.frameIndex - 1]) : `Loading ${p.dataset.title}…`;
  const hearingList = hearingFor(p.dataset, p.state.activeMode);

  return (
    <div className="flex flex-col pb-[150px] sm:pb-[110px]">
      <div className="px-space-md pt-space-md flex flex-col gap-space-xs">
        {p.notice && (
          <p className="m-0 px-space-sm py-space-xs bg-surface-container text-primary font-label-md text-label-md" role="status">
            {p.notice}
          </p>
        )}
        {p.audioError && (
          <p className="m-0 px-space-sm py-space-xs bg-error-container text-on-error-container font-label-md text-label-md" role="alert">
            Sound could not start ({p.audioError}). Press Play again; if it stays silent, check that this browser tab is not muted and that your device volume is up.
          </p>
        )}
      </div>

      <div className="flex flex-col xl:flex-row w-full bg-surface-container-lowest">
        <TrackRail
          tracks={p.tracks}
          selected={-1}
          onSelect={p.onSelectTrack}
          onBrowseAll={p.onBrowseAll}
          eic={{ records: p.records, selected: p.dataset.id, onSelect: p.onSelectEic }}
        />

        <main aria-label="Cartographic sonification visualizer" className="flex-1 min-w-0 p-space-md xl:p-space-lg flex flex-col gap-space-md xl:gap-space-lg bg-surface">
          <EicStage
            ref={mapRef}
            session={p.session}
            state={p.state}
            dataset={p.dataset}
            cursor={p.cursor}
            cursorLabel={p.cursorLabel}
            exploring={p.exploring}
            onProbe={p.onProbe}
            onMapFocus={p.onMapFocus}
          />
          <TimeScrubber
            frameIndex={p.state.frameIndex}
            frameCount={p.state.frameCount}
            loadedCount={frames ? frames.length : 0}
            dateLabels={labels}
            onSeek={(i) => p.session.seekFrame(i)}
            timelapse={true}
            onTimelapse={() => {}}
            timelapseFixed
          />
          <section aria-labelledby="desc-h" className="max-w-[72ch]">
            <h2 id="desc-h" className="font-label-sm text-label-sm uppercase text-primary mb-1.5">
              What this frame shows
            </h2>
            <p id="frame-desc" className="font-body-md text-body-md text-on-surface text-pretty">
              {description}
            </p>
            <p className="font-body-md text-body-md text-secondary text-pretty mt-space-sm">{p.dataset.summary}</p>
          </section>
        </main>

        <aside
          aria-label="Playback telemetry and sonic diagnostics"
          className="w-full xl:w-[360px] shrink-0 bg-surface-container-low p-space-md xl:p-space-lg flex flex-col gap-space-lg"
        >
          <section aria-labelledby="eic-now-h" className="flex flex-col gap-space-xs">
            <h2 id="eic-now-h" className="font-label-sm text-label-sm uppercase text-primary m-0">
              Now sonifying
            </h2>
            <p className="font-headline-md text-headline-md text-on-surface m-0">{p.dataset.title}</p>
            <p className="font-label-sm text-label-sm text-secondary m-0">{p.dataset.timeSpan}</p>
          </section>
          <ModeSwitch state={p.state} onMode={p.onMode} />
          <section aria-labelledby="eic-hearing-h">
            <h3 id="eic-hearing-h" className="font-label-sm text-label-sm uppercase text-primary mb-1.5">
              You Are Hearing
            </h3>
            <p className="font-body-md text-body-md text-on-surface m-0" data-testid="eic-hearing">
              {p.exploring ? p.cursorLabel : p.state.hearing}
            </p>
          </section>
          <section aria-labelledby="eic-how-h">
            <h3 id="eic-how-h" className="font-label-sm text-label-sm uppercase text-primary mb-1.5">
              How it sounds
            </h3>
            <ul className="font-body-md text-body-md text-secondary list-disc pl-5 m-0 flex flex-col gap-1">
              {hearingList.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="eic-src-h">
            <h3 id="eic-src-h" className="font-label-sm text-label-sm uppercase text-primary mb-1.5">
              Source
            </h3>
            <p className="font-body-md text-body-md text-secondary m-0">
              Imagery: NASA Scientific Visualization Studio,{' '}
              <a className="text-primary underline" href={p.dataset.sourceUrl} target="_blank" rel="noopener noreferrer">
                SVS #{p.dataset.svsId}
              </a>
              . {p.dataset.credit}. Orchestral samples: VS Chamber Orchestra 2 Community Edition (CC0). The sound interprets the picture&apos;s colours; go to the source for
              measurements.
            </p>
            <button
              type="button"
              className="mt-space-sm min-h-[48px] px-space-sm bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md uppercase"
              onClick={p.onOpenHelp}
            >
              Full guide &amp; keyboard shortcuts
            </button>
          </section>
        </aside>
      </div>

      <EicTransport {...p} />
    </div>
  );
});

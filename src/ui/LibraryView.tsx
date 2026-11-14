import { useMemo, useState } from 'react';
import type { Track } from '../data/catalog';
import { PauseIcon, PlayIcon, SearchIcon } from './icons';

/** An Earth Information Center (NASA SVS) record as the library lists it. */
export interface EicLibraryRecord {
  id: string;
  title: string;
  subtitle: string;
  source: string;
  hear: string;
}

interface Props {
  eic: { records: EicLibraryRecord[]; current: string | null; playing: boolean; onOpen: (id: string) => void; onPlay: (id: string) => void };
  tracks: Track[];
  /** Current GIBS record index, or -1 when an EIC record is current. */
  current: number;
  playing: boolean;
  onPlayTrack: (i: number) => void;
  onPauseCurrent: () => void;
  onOpenRecord: (i: number) => void;
}

function matches(t: Track, q: string): boolean {
  const hay = `${t.title} ${t.subtitle} ${t.ecTheme} ${t.layerId} ${t.layerTitle} ${t.timeRange}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

/** First sentence of the plain-language story, reused rather than inventing new per-row copy. */
function whatYouWillHear(t: Track): string {
  return `${t.pitchHint}. ${t.plainLanguageStory.split('. ')[0]}.`;
}

export function LibraryView(p: Props) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => p.tracks.map((t, i) => ({ t, i })).filter(({ t }) => matches(t, query)), [p.tracks, query]);
  const eicFiltered = useMemo(
    () => p.eic.records.map((r, i) => ({ r, i })).filter(({ r }) => `${r.title} ${r.subtitle} ${r.source} earth information center svs`.toLowerCase().includes(query.toLowerCase())),
    [p.eic.records, query],
  );

  return (
    <div className="w-full bg-surface-container-lowest p-space-md lg:p-space-xl flex flex-col gap-space-lg">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md border-b border-surface-container-highest pb-space-lg">
        <div className="flex flex-col gap-space-xs max-w-2xl">
          <div className="flex items-center gap-space-xs font-label-sm text-label-sm uppercase tracking-widest text-primary">
            <span className="inline-block w-2 h-2 bg-primary" aria-hidden="true" />
            <span>Catalog index · Reel 01</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold m-0">Choose a record</h1>
          <p className="font-body-md text-body-md text-secondary mt-1">
            Each record is one Earth phenomenon, played as sound from NASA satellite maps.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm w-full lg:w-auto">
          <label className="font-label-md text-label-md uppercase text-on-surface-variant font-semibold tracking-wider shrink-0" htmlFor="track-filter">
            Filter records
          </label>
          <div className="relative flex items-center w-full sm:w-80">
            <SearchIcon className="absolute left-3 w-4 h-4 text-outline pointer-events-none" />
            <input
              className="w-full h-12 bg-surface-container-low border border-surface-container-highest pl-9 pr-space-md text-on-surface font-label-md text-label-md placeholder:text-outline focus-visible:border-primary transition-colors"
              id="track-filter"
              placeholder="Filter by title, theme, sensor…"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      <section aria-label="Satellite sonification catalog" className="w-full border-t border-surface-container-highest flex flex-col">
        <div className="hidden md:grid grid-cols-12 gap-space-md px-space-lg py-space-xs bg-surface-container-low border-b border-surface-container-highest text-secondary font-label-sm text-label-sm uppercase tracking-wider">
          <span className="col-span-1">Slot</span>
          <span className="col-span-6">Record &amp; what you will hear</span>
          <span className="col-span-3">Source &amp; span</span>
          <span className="col-span-2 text-right">Transport</span>
        </div>

        {filtered.length === 0 && eicFiltered.length === 0 && (
          <p className="px-space-lg py-space-lg font-body-md text-body-md text-secondary m-0">No records match “{query}”.</p>
        )}

        {eicFiltered.map(({ r, i }) => {
          const isCurrent = r.id === p.eic.current;
          const isCurrentPlaying = isCurrent && p.eic.playing;
          return (
            <div
              key={r.id}
              className={`grid grid-cols-1 md:grid-cols-12 gap-space-sm md:items-center px-space-lg py-space-md border-b border-surface-container-highest ${isCurrent ? 'bg-surface-container-low' : ''}`}
              style={isCurrent ? { borderLeft: '3px solid #ffb959' } : undefined}
            >
              <span className="md:col-span-1 font-label-sm text-label-sm text-primary uppercase font-bold">E{i + 1}</span>
              <div className="md:col-span-6 flex flex-col gap-1">
                <button type="button" onClick={() => p.eic.onOpen(r.id)} className="text-left font-headline-md text-headline-md text-on-surface hover:text-primary transition-colors w-fit">
                  {r.title}
                </button>
                <span className="font-label-sm text-label-sm text-secondary uppercase">{r.subtitle}</span>
                <p className="font-body-md text-body-md text-secondary m-0 max-w-prose">
                  <strong className="text-on-surface">What you will hear: </strong>
                  {r.hear}
                </p>
              </div>
              <div className="md:col-span-3 font-label-sm text-label-sm text-secondary">
                <div>Earth Information Center</div>
                <div className="text-outline">{r.source}</div>
              </div>
              <div className="md:col-span-2 flex md:justify-end">
                <button
                  type="button"
                  onClick={() => (isCurrentPlaying ? p.onPauseCurrent() : p.eic.onPlay(r.id))}
                  aria-label={`${isCurrentPlaying ? 'Pause' : 'Play'} ${r.title}`}
                  className={`min-h-[48px] w-full md:w-auto px-space-md flex items-center justify-center gap-space-xs font-label-md text-label-md uppercase font-bold transition-colors ${
                    isCurrentPlaying ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                  }`}
                >
                  {isCurrentPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                  {isCurrentPlaying ? 'Playing' : 'Play'}
                </button>
              </div>
            </div>
          );
        })}

        {filtered.map(({ t, i }) => {
          const isCurrentPlaying = i === p.current && p.playing;
          return (
            <div
              key={t.id}
              className={`grid grid-cols-1 md:grid-cols-12 gap-space-sm md:items-center px-space-lg py-space-md border-b border-surface-container-highest ${
                i === p.current ? 'bg-surface-container-low' : ''
              }`}
              style={i === p.current ? { borderLeft: '3px solid #ffb959' } : undefined}
            >
              <span className="md:col-span-1 font-label-sm text-label-sm text-primary uppercase font-bold">A{i + 1}</span>
              <div className="md:col-span-6 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => p.onOpenRecord(i)}
                  className="text-left font-headline-md text-headline-md text-on-surface hover:text-primary transition-colors w-fit"
                >
                  {t.title}
                </button>
                <span className="font-label-sm text-label-sm text-secondary uppercase">{t.subtitle}</span>
                <p className="font-body-md text-body-md text-secondary m-0 max-w-prose">
                  <strong className="text-on-surface">What you will hear: </strong>
                  {whatYouWillHear(t)}
                </p>
              </div>
              <div className="md:col-span-3 font-label-sm text-label-sm text-secondary">
                <div>{t.timeRange}</div>
                <div className="text-outline">{t.layerTitle}</div>
              </div>
              <div className="md:col-span-2 flex md:justify-end">
                <button
                  type="button"
                  onClick={() => (isCurrentPlaying ? p.onPauseCurrent() : p.onPlayTrack(i))}
                  className={`min-h-[48px] w-full md:w-auto px-space-md flex items-center justify-center gap-space-xs font-label-md text-label-md uppercase font-bold transition-colors ${
                    isCurrentPlaying ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                  }`}
                >
                  {isCurrentPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                  {isCurrentPlaying ? 'Playing' : 'Play'}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-space-sm font-label-sm text-label-sm text-secondary uppercase">
        <span>
          <span className="inline-block w-2 h-2 bg-primary mr-1.5 align-middle" aria-hidden="true" />
          {p.eic.records.length + p.tracks.length} records catalogued
        </span>
        <span>Every record is played live in your browser with the Web Audio API.</span>
      </footer>
    </div>
  );
}

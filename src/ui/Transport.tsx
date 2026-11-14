import { useId, useState } from 'react';
import { PRESETS, type Preset } from '../sonify/mapping';
import { KEYS, SCALE_LABELS } from '../sonify/scales';
import type { ScaleName } from '../types';
import { MuteIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, VolumeIcon } from './icons';

export type NarrationMode = 'off' | 'changes' | 'detailed';

interface Props {
  playing: boolean;
  canPlay: boolean;
  onToggle: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  mode: 'scan' | 'explore';
  onMode: (m: 'scan' | 'explore') => void;
  tempo: number;
  onTempo: (v: number) => void;
  preset: Preset['id'];
  onPreset: (p: Preset['id']) => void;
  scale: ScaleName;
  onScale: (s: ScaleName) => void;
  rootMidi: number;
  onRoot: (m: number) => void;
  volume: number;
  onVolume: (v: number) => void;
  muted: boolean;
  onMute: () => void;
  narration: NarrationMode;
  onNarration: (n: NarrationMode) => void;
}

const chip = 'min-h-[48px] px-space-md bg-surface-container-low flex items-center gap-space-sm';

export function Transport(p: Props) {
  const id = useId();
  // Phones: the fixed bar shows only the play row; the rest opens on demand so the bar never covers the map.
  const [more, setMore] = useState(false);
  return (
    <section
      aria-label="Console transport controls"
      className="fixed bottom-0 inset-x-0 xl:left-64 z-30 bg-surface-container px-space-md sm:px-space-lg py-space-sm flex flex-wrap items-center justify-between gap-space-sm sm:gap-space-md border-t border-surface-container-highest"
    >
      <h2 className="sr-only">Player controls</h2>
      <div className="flex items-center gap-space-sm">
        <button
          type="button"
          className="min-h-[48px] min-w-[48px] px-space-md bg-surface-container-low hover:bg-surface-container-high text-on-surface flex items-center justify-center font-label-md text-label-md uppercase tracking-wider transition-colors"
          onClick={p.onPrevTrack}
          aria-label="Previous record"
          aria-keyshortcuts="["
        >
          <PrevIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          className="w-14 h-14 rounded-full bg-primary hover:bg-primary-fixed text-on-primary flex items-center justify-center shrink-0 transition-transform active:scale-95 disabled:opacity-50"
          onClick={p.onToggle}
          disabled={!p.canPlay}
          aria-keyshortcuts="Space"
          aria-label={p.playing ? 'Pause' : 'Play'}
        >
          {p.playing ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8" />}
        </button>
        <button
          type="button"
          className="min-h-[48px] min-w-[48px] px-space-md bg-surface-container-low hover:bg-surface-container-high text-on-surface flex items-center justify-center font-label-md text-label-md uppercase tracking-wider transition-colors"
          onClick={p.onNextTrack}
          aria-label="Next record"
          aria-keyshortcuts="]"
        >
          <NextIcon className="w-5 h-5" />
        </button>

        <fieldset className="flex border-0 p-0 m-0 bg-surface-container-low">
          <legend className="sr-only">Listening mode</legend>
          {(['scan', 'explore'] as const).map((m) => (
            <label
              key={m}
              className={`min-h-[48px] px-space-md flex items-center cursor-pointer font-label-md text-label-md uppercase transition-colors ${
                p.mode === m ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <input type="radio" name={`${id}-mode`} value={m} checked={p.mode === m} onChange={() => p.onMode(m)} className="sr-only" />
              <span>{m === 'scan' ? 'Scan' : 'Explore'}</span>
            </label>
          ))}
        </fieldset>
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
        <div className={chip}>
          <label htmlFor={`${id}-tempo`} className="font-label-sm text-label-sm uppercase text-secondary">
            Tempo <span className="text-on-surface normal-case">{p.tempo} steps/s</span>
          </label>
          <input
            id={`${id}-tempo`}
            type="range"
            className="w-20 accent-primary"
            min={2}
            max={10}
            step={1}
            value={p.tempo}
            aria-valuetext={`${p.tempo} steps per second`}
            onChange={(e) => p.onTempo(Number(e.target.value))}
          />
        </div>
        <div className={chip}>
          <label htmlFor={`${id}-scale`} className="font-label-sm text-label-sm uppercase text-secondary">
            Scale
          </label>
          <select
            id={`${id}-scale`}
            className="bg-transparent text-primary font-label-md text-label-md uppercase"
            value={p.scale}
            onChange={(e) => p.onScale(e.target.value as ScaleName)}
          >
            {(Object.keys(SCALE_LABELS) as ScaleName[]).map((s) => (
              <option key={s} value={s} className="bg-surface-container text-on-surface">
                {SCALE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className={chip}>
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
        <button
          type="button"
          className="min-h-[48px] px-space-md bg-surface-container-low hover:bg-surface-container-high text-on-surface flex items-center gap-space-xs font-label-md text-label-md uppercase transition-colors"
          aria-pressed={p.muted}
          onClick={p.onMute}
          aria-keyshortcuts="M"
        >
          {p.muted ? <MuteIcon className="w-[18px] h-[18px]" /> : <VolumeIcon className="w-[18px] h-[18px]" />}
          <span>Mute [M]</span>
        </button>

        <details className="min-h-[48px] bg-surface-container-low">
          <summary className="min-h-[48px] px-space-md flex items-center cursor-pointer font-label-md text-label-md uppercase text-on-surface-variant hover:text-on-surface">
            Sound settings
          </summary>
          <div className="flex flex-wrap gap-space-md p-space-md border-t border-surface-container-highest">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-preset`} className="font-label-sm text-label-sm uppercase text-secondary">
                Mood
              </label>
              <select
                id={`${id}-preset`}
                className="bg-surface-container-lowest text-on-surface px-space-sm py-1"
                value={p.preset}
                onChange={(e) => p.onPreset(e.target.value as Preset['id'])}
              >
                {Object.values(PRESETS).map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-key`} className="font-label-sm text-label-sm uppercase text-secondary">
                Key
              </label>
              <select
                id={`${id}-key`}
                className="bg-surface-container-lowest text-on-surface px-space-sm py-1"
                value={p.rootMidi}
                onChange={(e) => p.onRoot(Number(e.target.value))}
              >
                {KEYS.map((k) => (
                  <option key={k.label} value={k.midi}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-narr`} className="font-label-sm text-label-sm uppercase text-secondary">
                Spoken narration
              </label>
              <select
                id={`${id}-narr`}
                aria-describedby={`${id}-narr-hint`}
                className="bg-surface-container-lowest text-on-surface px-space-sm py-1"
                value={p.narration}
                onChange={(e) => p.onNarration(e.target.value as NarrationMode)}
              >
                <option value="detailed">Detailed</option>
                <option value="changes">Changes only</option>
                <option value="off">Off</option>
              </select>
              <span className="font-label-sm text-label-sm text-secondary max-w-[220px]" id={`${id}-narr-hint`}>
                {p.narration === 'detailed'
                  ? 'Describes what you hear every few seconds.'
                  : p.narration === 'changes'
                    ? 'Speaks only on a new frame or record.'
                    : 'No spoken updates.'}
              </span>
            </div>
          </div>
        </details>
      </div>

      <div className="hidden 2xl:flex items-center gap-space-xs font-label-sm text-label-sm">
        <div className="bg-surface-container-low px-2 py-1 flex items-center gap-1.5">
          <span className="text-primary font-bold">Space</span>
          <span className="text-secondary">Play</span>
        </div>
        <div className="bg-surface-container-low px-2 py-1 flex items-center gap-1.5">
          <span className="text-primary font-bold">Arrows</span>
          <span className="text-secondary">Explore</span>
        </div>
        <div className="bg-surface-container-low px-2 py-1 flex items-center gap-1.5">
          <span className="text-primary font-bold">[ ]</span>
          <span className="text-secondary">Tracks</span>
        </div>
      </div>
    </section>
  );
}

import type { Track } from '../data/catalog';
import { formatValue } from '../data/catalog';
import { formatLat, formatLon } from '../a11y/narration';
import { BANDS, normalise } from '../sonify/mapping';
import { HearingIcon } from './icons';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Nearest equal-tempered note name for a real frequency (A4 = 440 Hz), not a fabricated label. */
function noteName(freq: number): string {
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export interface LiveBand {
  value: number | null;
  freq: number | null;
}

interface Props {
  track: Track;
  index: number;
  dateLabel: string;
  hearing: string;
  lat: number | null;
  lon: number | null;
  nowValue: number | null;
  mode: 'scan' | 'explore';
  liveBands: LiveBand[];
  range: [number, number];
  onOpenHelp: () => void;
}

export function SidePanel(p: Props) {
  return (
    <aside
      aria-label="Playback telemetry and sonic diagnostics"
      className="w-full xl:w-[360px] shrink-0 bg-surface-container-low p-space-md xl:p-space-lg flex flex-col gap-space-md"
    >
      <div className="flex flex-col gap-space-xs pb-space-sm">
        <span className="font-label-sm text-label-sm text-primary uppercase">Now sonifying</span>
        <h2 id="now-h" className="font-headline-lg text-headline-lg text-on-surface leading-tight m-0">
          {p.track.title}
        </h2>
        <p className="font-label-sm text-label-sm text-secondary m-0">
          A{p.index + 1} · {p.track.subtitle} · <span className="font-mono">{p.dateLabel}</span>
        </p>
        <p className="font-body-md text-body-md text-secondary mt-1">{p.track.plainLanguageStory}</p>
      </div>

      <div className="bg-surface-container p-space-md flex flex-col gap-space-sm">
        <h3 className="font-label-sm text-label-sm uppercase text-secondary m-0">You Are Hearing</h3>
        <p className="font-mono text-body-md text-on-surface m-0">{p.hearing}</p>
      </div>

      <div className="bg-surface-container p-space-md flex flex-col gap-space-sm">
        <span className="font-label-sm text-label-sm uppercase text-secondary">Live telemetry readout</span>
        <div className="grid grid-cols-2 gap-space-sm font-label-sm text-label-sm">
          <div className="flex flex-col bg-surface-container-lowest p-2">
            <span className="text-secondary">Date</span>
            <span className="text-on-surface font-label-md text-label-md font-mono">{p.dateLabel}</span>
          </div>
          <div className="flex flex-col bg-surface-container-lowest p-2">
            <span className="text-secondary">Longitude</span>
            <span className="text-primary font-label-md text-label-md font-mono">{p.lon === null ? '—' : formatLon(p.lon)}</span>
          </div>
          <div className="flex flex-col bg-surface-container-lowest p-2">
            <span className="text-secondary">Latitude</span>
            <span className="text-on-surface font-label-md text-label-md font-mono">{p.lat === null ? '—' : formatLat(p.lat)}</span>
          </div>
          <div className="flex flex-col bg-surface-container-lowest p-2">
            <span className="text-secondary">Value</span>
            <span className="text-primary font-label-md text-label-md font-mono">{formatValue(p.track, p.nowValue)}</span>
          </div>
        </div>
      </div>

      <div className="bg-surface-container p-space-md flex flex-col gap-space-sm">
        <span className="font-label-sm text-label-sm uppercase text-secondary">Band energy &amp; pitch tiers</span>
        {BANDS.map((band, i) => {
          const live = p.liveBands[i];
          const norm = live?.value !== null && live?.value !== undefined ? normalise(live.value, p.range) : null;
          const filled = norm === null ? 0 : Math.round(norm * 8);
          return (
            <div key={band.name} className="flex flex-col gap-1 mt-1 first:mt-0">
              <div className="flex justify-between items-center font-label-sm text-label-sm">
                <span className="text-on-surface font-bold uppercase">{band.name}</span>
                <span className="text-primary font-mono">{live?.freq ? `${noteName(live.freq)} · ${Math.round(live.freq)} Hz` : '—'}</span>
              </div>
              <div className="flex items-center gap-1 h-3 bg-surface-container-lowest p-0.5" role="progressbar" aria-label={`${band.name} level`} aria-valuemin={0} aria-valuemax={8} aria-valuenow={filled}>
                {Array.from({ length: 8 }, (_, seg) => (
                  <div key={seg} className={`h-full flex-1 ${seg < filled ? 'bg-primary' : 'bg-surface-variant'}`} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-surface-container-low p-space-md flex flex-col gap-space-xs">
        <span className="font-label-sm text-label-sm uppercase text-on-surface font-bold tracking-wider">How to listen</span>
        <ul className="flex flex-col gap-1.5 mt-1 font-body-md text-body-md text-secondary list-none p-0 m-0">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-primary shrink-0" aria-hidden="true" />
            <span>Left to right = west to east</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-primary shrink-0" aria-hidden="true" />
            <span>{p.track.pitchHint}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-primary shrink-0" aria-hidden="true" />
            <span>Bell chime = extreme value</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-primary shrink-0" aria-hidden="true" />
            <span>Silence = no measurement data</span>
          </li>
        </ul>
        <button
          type="button"
          onClick={p.onOpenHelp}
          className="mt-2 min-h-[44px] self-start inline-flex items-center gap-space-xs px-space-sm bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md uppercase transition-colors"
        >
          <HearingIcon className="w-[18px] h-[18px] text-primary" />
          Full guide &amp; keyboard shortcuts
        </button>
      </div>
    </aside>
  );
}

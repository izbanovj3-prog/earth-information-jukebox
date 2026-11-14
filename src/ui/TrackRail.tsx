import type { Track } from '../data/catalog';

/** A record from the Earth Information Center (NASA SVS) collection. */
export interface EicRecord {
  id: string;
  title: string;
  subtitle: string;
}

interface Props {
  tracks: Track[];
  /** Selected GIBS record index, or -1 when an EIC record is selected. */
  selected: number;
  eic: { records: EicRecord[]; selected: string | null; onSelect: (id: string) => void };
  onSelect: (i: number) => void;
  onBrowseAll: () => void;
}

/** Desktop/tablet left rail of the player: real catalog tracks, matching the Main Player reference. */
const labelClass = (on: boolean) =>
  `w-full text-left p-space-sm flex items-start gap-space-sm min-h-[48px] cursor-pointer transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-container-low ${
    on ? 'bg-surface-container-high border-l-[3px] border-primary' : 'bg-surface-container-low hover:bg-surface-container border-l-[3px] border-transparent'
  }`;

function RecordRadio(p: { id: string; code: string; title: string; subtitle: string; on: boolean; onSelect: () => void }) {
  return (
    <div className="relative shrink-0 min-w-[220px] xl:min-w-0">
      <input className="sr-only peer" type="radio" name="record" id={p.id} checked={p.on} onChange={p.onSelect} aria-describedby={`${p.id}-sub`} />
      <label htmlFor={p.id} className={labelClass(p.on)}>
        <span className={`font-label-sm text-label-sm bg-surface-container-lowest px-1.5 py-0.5 mt-0.5 ${p.on ? 'text-primary' : 'text-secondary'}`}>{p.code}</span>
        <span className="flex flex-col min-w-0">
          <span className="font-headline-md text-headline-md text-on-surface leading-tight truncate">{p.title}</span>
          <span className="font-label-sm text-label-sm text-secondary truncate" id={`${p.id}-sub`}>
            {p.subtitle}
          </span>
        </span>
      </label>
    </div>
  );
}

export function TrackRail({ tracks, selected, onSelect, onBrowseAll, eic }: Props) {
  return (
    <aside
      aria-label="Dataset track selector"
      className="w-full xl:w-[280px] shrink-0 bg-surface-container-low p-space-md xl:p-space-lg flex flex-col gap-space-md xl:gap-space-lg xl:justify-between"
    >
      <div className="flex flex-col gap-space-md xl:gap-space-lg">
        <div className="hidden xl:flex flex-col">
          <div className="flex items-center gap-space-xs mb-1">
            <span className="w-2 h-2 bg-primary" aria-hidden="true" />
            <span className="font-headline-md text-headline-md tracking-tight uppercase text-on-surface">Earth Jukebox</span>
          </div>
          <span className="font-body-md text-body-md text-secondary">Listen to the planet change</span>
        </div>
        <fieldset className="flex flex-row xl:flex-col gap-2 overflow-x-auto xl:overflow-visible min-w-0 border-0 p-0 m-0">
          <legend className="sr-only">Records. One Earth story per record.</legend>
          <span className="hidden xl:block font-label-sm text-label-sm uppercase text-primary pt-1" aria-hidden="true">
            Earth Information Center
          </span>
          {eic.records.map((r, i) => (
            <RecordRadio
              key={r.id}
              id={`record-eic-${r.id}`}
              code={`E${i + 1}`}
              title={r.title}
              subtitle={r.subtitle}
              on={eic.selected === r.id}
              onSelect={() => eic.onSelect(r.id)}
            />
          ))}
          <span className="hidden xl:block font-label-sm text-label-sm uppercase text-primary pt-space-sm" aria-hidden="true">
            NASA GIBS data records
          </span>
          {tracks.map((t, i) => (
            <RecordRadio
              key={t.id}
              id={`record-${t.id}`}
              code={`A${i + 1}`}
              title={t.title}
              subtitle={t.subtitle}
              on={eic.selected === null && i === selected}
              onSelect={() => onSelect(i)}
            />
          ))}
        </fieldset>
        <button
          type="button"
          onClick={onBrowseAll}
          className="min-h-[48px] px-space-sm text-left bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-md text-label-md uppercase transition-colors"
        >
          Browse all records →
        </button>
      </div>
      <div className="hidden xl:flex flex-col gap-1">
        <div className="flex justify-between items-center font-label-sm text-label-sm text-secondary">
          <span>Source rack</span>
          <span className="text-on-surface">{eic.selected ? 'NASA SVS / EIC' : 'NASA GIBS'}</span>
        </div>
        <div className="flex justify-between items-center font-label-sm text-label-sm text-secondary">
          <span>Interpolation</span>
          <span className="text-on-surface">Nearest linear</span>
        </div>
      </div>
    </aside>
  );
}

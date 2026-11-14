import { useEffect, useRef } from 'react';
import { SHORTCUTS } from '../a11y/keymap';
import type { Track } from '../data/catalog';
import type { Manifest } from '../data/loader';
import { BANDS, DRONE_METRIC_WORDS } from '../sonify/mapping';
import type { Frame, Legend } from '../types';
import { DISCLAIMER } from './AppShell';
import { CloseIcon } from './icons';

interface Props {
  open: boolean;
  onClose: () => void;
  track: Track;
  frame: Frame | undefined;
  legend: Legend | null;
  legendWarning?: string;
  manifest: Manifest | null;
}

const dtClass = 'col-span-5 font-label-md text-label-md text-primary uppercase self-baseline';
const ddClass = 'col-span-7 font-body-md text-body-md text-on-surface self-baseline';
const row = 'grid grid-cols-12 gap-space-sm py-space-xs bg-surface-container-lowest p-space-sm';

export function HowToListenSheet(p: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (p.open && !d.open) d.showModal?.();
    if (!p.open && d.open) d.close();
  }, [p.open]);

  const m = p.manifest?.tracks[p.track.id];

  return (
    <dialog ref={ref} className="sheet" aria-labelledby="how-to-listen-h" onClose={p.onClose} onCancel={p.onClose}>
      <div className="flex flex-col h-full overflow-y-auto p-space-lg gap-space-xl">
        <div className="flex items-center justify-between pb-space-md border-b border-surface-container-highest sticky top-0 bg-surface-container-low">
          <h2 id="how-to-listen-h" className="font-headline-xl text-headline-xl text-on-surface font-bold m-0">
            How to listen
          </h2>
          <button
            type="button"
            onClick={p.onClose}
            className="min-h-[48px] min-w-[48px] px-space-md bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center gap-space-sm font-label-md text-label-md uppercase tracking-wider transition-colors"
            autoFocus
          >
            <CloseIcon className="w-4 h-4" />
            <span>Close</span>
            <span className="font-label-sm text-label-sm bg-surface-container-lowest text-primary px-1.5 py-0.5 uppercase tracking-widest">
              Esc
            </span>
          </button>
        </div>

        <section aria-labelledby="section-sound-means" className="flex flex-col gap-space-md">
          <div className="flex flex-col gap-space-xs pb-space-sm border-b border-surface-container-highest">
            <h3 className="font-title-md text-title-md uppercase tracking-wider text-on-surface m-0" id="section-sound-means">
              What the sound means
            </h3>
            <span className="font-label-sm text-label-sm text-secondary uppercase">For this record: {p.track.title}</span>
          </div>
          <dl className="flex flex-col gap-space-sm m-0">
            <div className={row}>
              <dt className={dtClass}>Left to right</dt>
              <dd className={ddClass}>The scan sweeps the map and pans from your left ear to your right, west to east.</dd>
            </div>
            <div className={row}>
              <dt className={dtClass}>Pitch</dt>
              <dd className={ddClass}>{p.track.pitchHint}. Notes snap to a musical scale.</dd>
            </div>
            <div className={row}>
              <dt className={dtClass}>{BANDS.length} voices</dt>
              <dd className={ddClass}>
                {BANDS.length} latitude bands, playing in order each step: {BANDS.map((b) => `${b.name} = ${b.timbreWord}`).join(', ')}.
              </dd>
            </div>
            <div className={row}>
              <dt className={dtClass}>Bell</dt>
              <dd className={ddClass}>{p.track.accentMeaning}</dd>
            </div>
            <div className={row}>
              <dt className={dtClass}>Silence</dt>
              <dd className={`${ddClass} text-secondary`}>{p.track.noDataMeans}</dd>
            </div>
            <div className={row}>
              <dt className={dtClass}>Low drone</dt>
              <dd className={ddClass}>
                Follows the global {DRONE_METRIC_WORDS[p.track.droneMetric]} compared with the first frame; a change of{' '}
                {p.track.changeScale} {p.track.display.unit} moves it a full musical fifth (an intentional exaggeration).
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="section-try-it" className="flex flex-col gap-space-md">
          <div className="flex flex-col gap-space-xs pb-space-sm border-b border-surface-container-highest">
            <h3 className="font-title-md text-title-md uppercase tracking-wider text-on-surface m-0" id="section-try-it">
              Try it
            </h3>
            <span className="font-label-sm text-label-sm text-secondary uppercase">Keyboard commands</span>
          </div>
          <table className="w-full border-collapse">
            <caption className="sr-only">Keyboard shortcuts</caption>
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.keys} className="border-b border-surface-container-highest last:border-0">
                  <td className="py-space-xs pr-space-sm align-top whitespace-nowrap">
                    <kbd className="inline-block font-label-sm text-label-sm bg-surface-container text-primary px-1.5 py-0.5 uppercase">
                      {s.keys}
                    </kbd>
                  </td>
                  <td className="py-space-xs font-body-md text-body-md text-on-surface">{s.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col gap-space-xs font-body-md text-body-md text-secondary list-none m-0 p-0">
            <li>Shortcuts never override a focused control: Space still presses the focused button, arrows still move a focused slider.</li>
            <li>With a screen reader, press E to move to the map; it is an application region, so arrow keys go straight to the explorer.</li>
            <li>You can use the jukebox by sound alone: nothing on screen is not also spoken or described in text.</li>
          </ul>
        </section>

        <section aria-labelledby="section-sources-limits" className="flex flex-col gap-space-md pb-space-lg">
          <div className="flex flex-col gap-space-xs pb-space-sm border-b border-surface-container-highest">
            <h3 className="font-title-md text-title-md uppercase tracking-wider text-on-surface m-0" id="section-sources-limits">
              Sources and limits
            </h3>
            <span className="font-label-sm text-label-sm text-secondary uppercase">{p.track.layerTitle}</span>
          </div>
          <div className="flex flex-col gap-space-md font-body-md text-body-md text-on-surface">
            <div className="p-space-md bg-surface-container-lowest flex flex-col gap-space-xs">
              <p className="m-0">
                Data streamed from NASA's Global Imagery Browse Services (GIBS). Layer:{' '}
                <code className="font-label-sm text-label-sm bg-surface-container text-primary px-1.5 py-0.5 uppercase" translate="no">
                  {p.track.layerId}
                </code>
                , span: <span className="font-label-sm text-label-sm bg-surface-container px-1.5 py-0.5">{p.track.timeRange}</span>.
              </p>
              <p className="m-0">
                {p.frame
                  ? p.frame.source.mode === 'live'
                    ? 'This frame: a live request to NASA GIBS just now.'
                    : `This frame: a bundled copy of the same NASA GIBS image, downloaded ${p.manifest?.generated.slice(0, 10) ?? 'at build time'}.`
                  : 'Loading this frame…'}{' '}
                {p.frame && (
                  <a href={p.frame.source.url} target="_blank" rel="noreferrer" className="text-primary">
                    Open the exact image request<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
              </p>
              <p className="m-0">
                {p.legend?.calibrated
                  ? `Colour scale: the GIBS colormap for this layer (${p.legend.title}${p.legend.units ? `, ${p.legend.units}` : ''}); every pixel colour is matched back to its value.`
                  : 'Colour scale: relative brightness only — values are NOT calibrated.'}{' '}
                {m && (
                  <a href={m.colormapSource} target="_blank" rel="noreferrer" className="text-primary">
                    Colormap source<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
                {p.legendWarning && <span className="text-primary"> {p.legendWarning}</span>}
              </p>
              <p className="m-0 text-secondary">Map outlines: coastlines © OpenStreetMap contributors (ODbL), via NASA GIBS. Decorative only; never sonified.</p>
            </div>
            <ul className="flex flex-col gap-space-xs text-secondary list-none m-0 p-0">
              <li><strong className="text-on-surface">Sound is an interpretation of the image, not a measurement.</strong> Values are read back from colours at 0.5° resolution and averaged over wide latitude bands.</li>
              <li>Musical choices (scales, the exaggerated drone, which extremes ring a bell) are design decisions, explained above.</li>
              <li>Single dates per year (sea ice, sea-surface temperature) are noisy; do not read a trend from two neighbouring frames.</li>
              <li>The equirectangular map stretches the poles; statistics in the descriptions are area-weighted to correct for this.</li>
            </ul>
            <p className="m-0 text-secondary">
              We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's
              Earth Science Data and Information System (ESDIS). Fonts, runtime and build tooling are listed in ATTRIBUTION.md in the
              source repository. All sounds are synthesized live with the Web Audio API; no recordings or samples are used.
            </p>
            <p className="m-0 font-bold text-on-surface">{DISCLAIMER}</p>
          </div>
        </section>
      </div>
    </dialog>
  );
}

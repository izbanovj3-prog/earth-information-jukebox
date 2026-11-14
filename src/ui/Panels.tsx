import { useEffect, useRef, useState } from 'react';
import type { Track } from '../data/catalog';
import { formatValue } from '../data/catalog';
import type { Manifest } from '../data/loader';
import { BAND_NAMES } from '../sonify/mapping';
import type { Frame, Legend } from '../types';
import { DISCLAIMER } from './Marquee';
import styles from './Panels.module.css';

export function NowPlaying({ track, index, dateLabel, hearing }: { track: Track; index: number; dateLabel: string; hearing: string }) {
  return (
    <section className={styles.card} aria-labelledby="now-h">
      <p className={styles.plate}>
        <span className={styles.plateNo}>A{index + 1}</span> Now playing · {track.ecTheme}
      </p>
      <h2 id="now-h" className={styles.title}>
        {track.title}
      </h2>
      <p className={styles.sub}>
        {track.subtitle} · <span className="mono">{dateLabel}</span>
      </p>
      <p className={styles.story}>{track.plainLanguageStory}</p>
      <div className={styles.hearing}>
        <h3 className={styles.hearingLabel}>You Are Hearing</h3>
        <p className="mono">{hearing}</p>
      </div>
    </section>
  );
}

export function LegendBar({ legend, track, marker }: { legend: Legend | null; track: Track; marker?: number | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; value: number } | null>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !legend) return;
    const data = legend.entries.filter((e) => e.value !== null).sort((a, b) => a.value! - b.value!);
    c.width = Math.max(1, data.length);
    c.height = 1;
    if (!legend.calibrated) {
      const g = ctx.createLinearGradient(0, 0, c.width, 0);
      g.addColorStop(0, '#000');
      g.addColorStop(1, '#fff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, 1);
      return;
    }
    data.forEach((e, i) => {
      ctx.fillStyle = `rgb(${e.rgb.join(',')})`;
      ctx.fillRect(i, 0, 1, 1);
    });
  }, [legend]);
  if (!legend) return null;
  const span = legend.max - legend.min;
  const pos = (v: number) => Math.min(1, Math.max(0, (v - legend.min) / span));
  const fmt = (v: number) => (legend.calibrated ? formatValue(track, v) : `${Math.round(v * 100)}% brightness`);
  const mid = legend.min + span / 2;
  // Keep labels inside the plot near the ends.
  const anchor = (x: number) => (x < 0.15 ? styles.anchorStart : x > 0.85 ? styles.anchorEnd : '');
  return (
    <figure className={styles.legend}>
      <figcaption className={styles.legendTitle}>
        Colour scale <span className={styles.dim}>— {track.pitchHint.toLowerCase()}</span>
      </figcaption>
      <div
        className={styles.legendPlot}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
          setHover({ x, value: legend.min + x * span });
        }}
        onPointerLeave={() => setHover(null)}
      >
        <canvas ref={ref} className={styles.legendBar} aria-hidden="true" />
        {marker !== undefined && marker !== null && (
          <span className={styles.nowMark} style={{ left: `${pos(marker) * 100}%` }}>
            <span className={`${styles.nowLabel} ${anchor(pos(marker))}`}>
              <strong>{fmt(marker)}</strong> now
            </span>
          </span>
        )}
        {hover && (
          <span className={styles.hair} style={{ left: `${hover.x * 100}%` }} aria-hidden="true">
            <span className={`${styles.tip} ${anchor(hover.x)}`}>
              <strong>{fmt(hover.value)}</strong>
            </span>
          </span>
        )}
      </div>
      <div className={styles.ticks}>
        <span>
          {fmt(legend.min)} <span className={styles.dim}>{track.lowWord}</span>
        </span>
        <span aria-hidden="true">{fmt(mid)}</span>
        <span>
          <span className={styles.dim}>{track.highWord}</span> {fmt(legend.max)}
        </span>
      </div>
    </figure>
  );
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
    <path d={d} />
  </svg>
);

export function HowToListen({ track }: { track: Track }) {
  return (
    <section className={styles.card} aria-labelledby="how-h">
      <h2 id="how-h" className={styles.h2}>
        How to Listen
      </h2>
      <ul className={styles.how}>
        <li>
          <Icon d="M4 18 L9 12 L13 15 L20 6" />
          <span>
            <strong>{track.pitchHint}.</strong> Lower pitch = {track.lowWord}. Notes snap to a musical scale; choose “Chromatic” for the most
            data-true mapping.
          </span>
        </li>
        <li>
          <Icon d="M3 12 H21 M17 8 L21 12 L17 16" />
          <span>
            <strong>Left to right = west to east.</strong> The scan sweeps the map and the sound pans from your left ear to your right.
          </span>
        </li>
        <li>
          <Icon d="M4 6 H20 M4 12 H20 M4 18 H20" />
          <span>
            <strong>Three voices, three latitude bands:</strong> {BAND_NAMES[0]} = glassy chime, {BAND_NAMES[1]} = soft reed,{' '}
            {BAND_NAMES[2]} = plucked string. They play in that order at each step.
          </span>
        </li>
        <li>
          <Icon d="M6 12 H18" />
          <span>
            <strong>Silence = no data.</strong> {track.noDataMeans}
          </span>
        </li>
        <li>
          <Icon d="M12 3 C8 3 7 7 7 11 L5 16 H19 L17 11 C17 7 16 3 12 3 Z M10 19 a2 2 0 0 0 4 0" />
          <span>
            <strong>Bell = extreme.</strong> {track.accentMeaning}
          </span>
        </li>
        <li>
          <Icon d="M2 14 Q6 10 10 14 T18 14 T22 14" />
          <span>
            <strong>Low drone = change over time.</strong> It follows the global{' '}
            {track.droneMetric === 'mean' ? 'average' : track.droneMetric === 'coverage' ? 'cover' : 'Arctic cover'} compared with the first
            frame, and rises when it goes up. The drone deliberately exaggerates: a change of {track.changeScale} {track.display.unit} moves
            it a full musical fifth.
          </span>
        </li>
      </ul>
    </section>
  );
}

export function SourcesPanel({
  track,
  frame,
  legend,
  legendWarning,
  manifest,
}: {
  track: Track;
  frame: Frame | undefined;
  legend: Legend | null;
  legendWarning?: string;
  manifest: Manifest | null;
}) {
  const m = manifest?.tracks[track.id];
  return (
    <section className={styles.sources} aria-labelledby="src-h">
      <details>
        <summary>
          <h2 id="src-h" className={styles.h2}>
            Sources and Limits
          </h2>
        </summary>
        <div className={styles.sourcesBody}>
          <dl className={styles.dl}>
            <dt>Data provider</dt>
            <dd>NASA Global Imagery Browse Services (GIBS), part of NASA’s Earth Science Data and Information System (ESDIS).</dd>
            <dt>Layer</dt>
            <dd>
              {track.layerTitle} <code translate="no">{track.layerId}</code>
            </dd>
            <dt>Date shown</dt>
            <dd>{frame?.date ?? '—'}</dd>
            <dt>How this frame was loaded</dt>
            <dd>
              {frame
                ? frame.source.mode === 'live'
                  ? 'Live request to NASA GIBS just now.'
                  : `Bundled copy of the same NASA GIBS image, downloaded ${manifest?.generated.slice(0, 10) ?? 'at build time'}.`
                : '—'}{' '}
              {frame && (
                <a href={frame.source.url} target="_blank" rel="noreferrer">
                  Open the exact image request<span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              )}
            </dd>
            <dt>Colour scale</dt>
            <dd>
              {legend?.calibrated
                ? `GIBS colormap for this layer (${legend.title}${legend.units ? `, ${legend.units}` : ''}); every pixel colour is matched back to its value.`
                : 'Relative brightness only — values are NOT calibrated.'}{' '}
              {m && (
                <a href={m.colormapSource} target="_blank" rel="noreferrer">
                  Colormap source<span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              )}
              {legendWarning && <span className={styles.warn}> {legendWarning}</span>}
            </dd>
            <dt>Map outlines</dt>
            <dd>Coastlines © OpenStreetMap contributors (ODbL), via NASA GIBS. Decorative only; not used for sound.</dd>
          </dl>
          <h3 className={styles.h3}>Limits</h3>
          <ul className={styles.limits}>
            <li>
              <strong>Sound is an interpretation of the image, not a measurement.</strong> Values are read back from the colours of a
              visualization at 0.5° resolution and averaged over wide latitude bands.
            </li>
            <li>Musical choices (scales, the exaggerated drone, which extremes ring a bell) are design decisions, explained above.</li>
            <li>Single dates per year (sea ice, sea-surface temperature) are noisy; do not read a trend from two neighbouring frames.</li>
            <li>The equirectangular map stretches the poles; statistics in the descriptions are area-weighted to correct for this.</li>
          </ul>
          <h3 className={styles.h3}>Credits</h3>
          <p className={styles.credits}>
            We acknowledge the use of imagery provided by services from NASA’s Global Imagery Browse Services (GIBS), part of NASA’s Earth
            Science Data and Information System (ESDIS). Fonts: Bungee (The Bungee Project Authors), Atkinson Hyperlegible (Braille
            Institute of America) and Atkinson Hyperlegible Mono (The Atkinson Hyperlegible Mono Project Authors), all SIL Open Font
            License 1.1. Built with React (MIT) and Vite (MIT). All sounds are synthesized live with the Web Audio API; no recordings are
            used. Full list in ATTRIBUTION.md.
          </p>
          <p className={styles.disclaimer}>{DISCLAIMER}</p>
        </div>
      </details>
    </section>
  );
}

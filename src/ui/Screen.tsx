import { forwardRef, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Frame, Legend } from '../types';
import { formatLat } from '../a11y/narration';
import { BANDS, bandLatitudes } from '../sonify/mapping';
import styles from './Screen.module.css';

/** "30–90°N", "30°S–30°N" */
function latRange([south, north]: [number, number]): string {
  if (south >= 0) return `${Math.round(south)}–${formatLat(north)}`;
  if (north <= 0) return `${Math.round(-north)}–${formatLat(south)}`;
  return `${formatLat(south)}–${formatLat(north)}`;
}

interface Props {
  frame: Frame | undefined;
  legend: Legend | null;
  basemapUrl: string;
  dateLabel: string;
  status: 'loading' | 'ready' | 'error';
  loaded: number;
  total: number;
  error?: string;
  onRetry: () => void;
  mode: 'scan' | 'explore';
  /** 0..1 position of the scan line. */
  scan: number;
  stepMs: number;
  playing: boolean;
  cursor: { x: number; y: number };
  cursorLabel: string;
  descriptionId: string;
  /** gesture = pointerdown (may start audio); hover moves pass false. */
  onProbe: (x: number, y: number, gesture: boolean) => void;
  onMapFocus: () => void;
}

function draw(canvas: HTMLCanvasElement | null, frame: Frame) {
  if (!canvas) return;
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.rgba), frame.width, frame.height), 0, 0);
}

export const Screen = forwardRef<HTMLDivElement, Props>(function Screen(p, mapRef) {
  const a = useRef<HTMLCanvasElement>(null);
  const b = useRef<HTMLCanvasElement>(null);
  const [front, setFront] = useState<0 | 1>(0);
  const shown = useRef<Frame | undefined>(undefined);
  const lastProbe = useRef(0);

  useEffect(() => {
    if (!p.frame || p.frame === shown.current) return;
    const target = front === 0 ? b.current : a.current;
    draw(target, p.frame);
    shown.current = p.frame;
    setFront((f) => (f === 0 ? 1 : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only redraw when the frame changes
  }, [p.frame]);

  const toPixel = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const w = p.frame?.width ?? 720;
    const h = p.frame?.height ?? 360;
    const x = Math.min(w - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * w)));
    const y = Math.min(h - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * h)));
    return { x, y };
  };

  const probe = (e: PointerEvent<HTMLDivElement>, gesture = false) => {
    const now = performance.now();
    if (!gesture && now - lastProbe.current < 90) return;
    lastProbe.current = now;
    const { x, y } = toPixel(e);
    p.onProbe(x, y, gesture);
  };

  const w = p.frame?.width ?? 720;
  const h = p.frame?.height ?? 360;
  const vars = {
    '--scan': p.scan,
    '--step-ms': `${p.stepMs}ms`,
    '--cx': (p.cursor.x + 0.5) / w,
    '--cy': (p.cursor.y + 0.5) / h,
  } as CSSProperties;

  return (
    <div className={styles.bezel}>
      <div className={styles.hud} aria-hidden="true">
        <span className={styles.date}>{p.dateLabel}</span>
        {p.frame && (
          <span className={styles.chip} data-kind={p.frame.source.mode}>
            {p.frame.source.mode === 'live' ? 'Live · NASA GIBS' : 'Bundled copy · NASA GIBS'}
          </span>
        )}
        {p.legend && !p.legend.calibrated && <span className={styles.chip} data-kind="warn">Relative values, not calibrated</span>}
      </div>

      <div className={styles.screen} style={vars} data-mode={p.mode} data-playing={p.playing}>
        <canvas ref={a} className={styles.layer} data-front={front === 0} aria-hidden="true" />
        <canvas ref={b} className={styles.layer} data-front={front === 1} aria-hidden="true" />
        <img className={styles.coast} src={p.basemapUrl} width={1440} height={720} alt="" aria-hidden="true" />
        <div className={styles.bands} aria-hidden="true">
          {BANDS.map((b, i) => (
            <span key={b.name} data-label={`${b.name} · ${latRange(bandLatitudes(i))}`} />
          ))}
        </div>
        <div className={styles.compass} aria-hidden="true">
          <span>W 180°</span>
          <span>0°</span>
          <span>180° E</span>
        </div>
        <div className={styles.scan} aria-hidden="true" />
        {p.mode === 'explore' && <div className={styles.cursor} aria-hidden="true" />}
        <div className={styles.scanlines} aria-hidden="true" />

        <div
          ref={mapRef}
          className={styles.surface}
          role="application"
          tabIndex={0}
          aria-roledescription="sonified map"
          aria-label={`Map explorer, ${p.dateLabel}. Arrow keys move the cursor and play the value under it; Shift plus arrows jumps further. Press D to read a description of the whole frame.`}
          aria-describedby={p.descriptionId}
          onFocus={p.onMapFocus}
          onPointerDown={(e) => {
            e.currentTarget.focus();
            e.currentTarget.setPointerCapture?.(e.pointerId);
            probe(e, true);
          }}
          onPointerMove={(e) => {
            if (p.mode === 'explore' && (e.buttons > 0 || e.pointerType === 'mouse')) probe(e);
          }}
        />

        {p.status === 'loading' && (
          <div className={styles.overlay} role="status">
            <span className={styles.valve} aria-hidden="true" />
            Tuning in… loading {p.dateLabel}
          </div>
        )}
        {p.status === 'error' && (
          <div className={styles.overlay} role="alert">
            <p>The frame for {p.dateLabel} could not be loaded, neither live from NASA GIBS nor from the bundled copy.</p>
            {p.error && <p className={styles.small}>{p.error}</p>}
            <button type="button" className={styles.retry} onClick={p.onRetry}>
              Try Again
            </button>
          </div>
        )}
      </div>
      <p className={styles.readout}>
        <span className="mono">{p.cursorLabel}</span>
      </p>
    </div>
  );
});

import { forwardRef, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Frame, Legend } from '../types';
import { formatLat } from '../a11y/narration';
import { BANDS, bandLatitudes } from '../sonify/mapping';

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
  const cx = (p.cursor.x + 0.5) / w;
  const cy = (p.cursor.y + 0.5) / h;
  const scanVisible = p.mode === 'scan' && p.playing;

  return (
    <div className="flex flex-col gap-space-sm">
      <div className="flex items-center justify-between pb-space-xs flex-wrap gap-space-xs" aria-hidden="true">
        <div className="flex items-center gap-space-sm flex-wrap">
          <span className="font-label-sm text-label-sm uppercase bg-surface-container px-2 py-1 text-primary">Field display 01</span>
          <span className="font-mono text-label-sm font-bold tabular-nums px-2 py-0.5 bg-surface-container-lowest text-primary">
            {p.dateLabel}
          </span>
          {p.frame && (
            <span
              className={`font-label-sm text-label-sm uppercase px-2 py-0.5 border ${
                p.frame.source.mode === 'live' ? 'border-surface-container-highest text-secondary' : 'border-dashed border-outline text-secondary'
              }`}
            >
              {p.frame.source.mode === 'live' ? 'Live · NASA GIBS' : 'Bundled copy · NASA GIBS'}
            </span>
          )}
          {p.legend && !p.legend.calibrated && (
            <span className="font-label-sm text-label-sm uppercase px-2 py-0.5 border border-primary text-primary">
              Relative values, not calibrated
            </span>
          )}
        </div>
        <span className="font-label-sm text-label-sm uppercase text-secondary">Equirectangular 2:1 / cylindrical</span>
      </div>

      <div
        className="relative w-full aspect-[2/1] bg-surface-container-lowest overflow-hidden touch-none"
        data-mode={p.mode}
        data-playing={p.playing}
      >
        <canvas
          ref={a}
          className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${front === 0 ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden="true"
        />
        <canvas
          ref={b}
          className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${front === 1 ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden="true"
        />
        <img
          className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen opacity-55 [filter:invert(1)_sepia(1)_saturate(0.6)_hue-rotate(5deg)_brightness(1.4)]"
          src={p.basemapUrl}
          width={1440}
          height={720}
          alt=""
          aria-hidden="true"
        />
        <div className="absolute inset-0 grid grid-rows-3 pointer-events-none" aria-hidden="true">
          {BANDS.map((band, i) => (
            <div key={band.name} className={`flex items-start justify-start p-1.5 ${i > 0 ? 'border-t border-dashed border-on-surface/20' : ''}`}>
              <span className="font-mono text-[11px] tracking-wider uppercase text-on-surface bg-surface-container-lowest/80 px-1.5 py-px">
                {band.name} · {latRange(bandLatitudes(i))}
              </span>
            </div>
          ))}
        </div>
        <div className="absolute left-0 right-0 bottom-0 flex justify-between p-1.5 font-mono text-[11px] text-on-surface pointer-events-none" aria-hidden="true">
          <span className="bg-surface-container-lowest/80 px-1.5 py-px">W 180°</span>
          <span className="bg-surface-container-lowest/80 px-1.5 py-px">0°</span>
          <span className="bg-surface-container-lowest/80 px-1.5 py-px">180° E</span>
        </div>
        <div
          className="absolute inset-y-0 w-[3px] bg-primary pointer-events-none"
          aria-hidden="true"
          style={{
            transform: `translateX(calc(${p.scan} * 100%))`,
            transitionProperty: 'transform',
            transitionDuration: `${p.stepMs}ms`,
            transitionTimingFunction: 'linear',
            opacity: scanVisible ? 1 : p.mode === 'explore' ? 0 : 0.35,
            boxShadow: '0 0 10px 2px rgb(255 185 89 / 0.8), 0 0 40px 8px rgb(255 185 89 / 0.35)',
          }}
        />
        {p.mode === 'explore' && (
          <div
            className="absolute w-9 h-9 -ml-[18px] -mt-[18px] rounded-full border-2 border-primary pointer-events-none"
            style={{ left: `${cx * 100}%`, top: `${cy * 100}%`, boxShadow: '0 0 0 2px #000, 0 0 16px rgb(255 185 89 / 0.8)' }}
            aria-hidden="true"
          >
            <span className="absolute left-1/2 -top-2 -bottom-2 w-0.5 -ml-px bg-primary" />
            <span className="absolute top-1/2 -left-2 -right-2 h-0.5 -mt-px bg-primary" />
          </div>
        )}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-multiply [background-image:repeating-linear-gradient(180deg,rgba(0,0,0,0.16)_0px,rgba(0,0,0,0.16)_1px,transparent_1px,transparent_3px)]"
          aria-hidden="true"
        />

        <div
          ref={mapRef}
          className="absolute inset-0 cursor-crosshair focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_#ffb959,inset_0_0_0_6px_#000]"
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
          <div className="absolute inset-0 flex flex-col gap-space-sm items-center justify-center p-space-md text-center bg-surface-container-lowest/85" role="status">
            <span className="w-3 h-3 bg-primary tube" aria-hidden="true" />
            <span className="font-body-md text-body-md text-on-surface">Tuning in… loading {p.dateLabel}</span>
          </div>
        )}
        {p.status === 'error' && (
          <div className="absolute inset-0 flex flex-col gap-space-sm items-center justify-center p-space-md text-center bg-surface-container-lowest/90" role="alert">
            <p className="font-body-md text-body-md text-on-surface m-0">
              The frame for {p.dateLabel} could not be loaded, neither live from NASA GIBS nor from the bundled copy.
            </p>
            {p.error && <p className="font-label-sm text-label-sm text-secondary m-0">{p.error}</p>}
            <button
              type="button"
              className="min-h-[48px] px-space-md bg-primary text-on-primary font-label-md text-label-md uppercase font-bold"
              onClick={p.onRetry}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
      <p className="readout mt-0 px-space-sm py-space-xs bg-surface-container-lowest text-primary font-mono text-body-md min-h-[2.2em]">
        {p.cursorLabel}
      </p>
    </div>
  );
});

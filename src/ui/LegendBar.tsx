import { useEffect, useRef, useState } from 'react';
import type { Track } from '../data/catalog';
import { formatValue } from '../data/catalog';
import type { Legend } from '../types';

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
  const anchor = (x: number) => (x < 0.15 ? 'left-0 translate-x-0' : x > 0.85 ? 'right-0 left-auto translate-x-0' : '-translate-x-1/2');
  return (
    <figure className="m-0 flex flex-col gap-space-xs bg-surface-container-low p-space-sm">
      <figcaption className="font-label-sm text-label-sm uppercase text-secondary">
        Colour scale <span className="normal-case text-outline">— {track.pitchHint.toLowerCase()}</span>
      </figcaption>
      <div
        className="relative h-7 cursor-crosshair"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
          setHover({ x, value: legend.min + x * span });
        }}
        onPointerLeave={() => setHover(null)}
      >
        <canvas ref={ref} className="absolute inset-0 w-full h-full" style={{ imageRendering: 'pixelated' }} aria-hidden="true" />
        {marker !== undefined && marker !== null && (
          <span className="absolute top-0 bottom-0 w-0.5 bg-on-surface" style={{ left: `${pos(marker) * 100}%` }}>
            <span className={`absolute -top-5 whitespace-nowrap font-mono text-label-sm text-on-surface bg-surface-container-lowest px-1 ${anchor(pos(marker))}`}>
              <strong>{fmt(marker)}</strong> now
            </span>
          </span>
        )}
        {hover && (
          <span className="absolute top-0 bottom-0 w-px bg-primary pointer-events-none" style={{ left: `${hover.x * 100}%` }} aria-hidden="true">
            <span className={`absolute -bottom-5 whitespace-nowrap font-mono text-label-sm text-primary bg-surface-container-lowest px-1 ${anchor(hover.x)}`}>
              <strong>{fmt(hover.value)}</strong>
            </span>
          </span>
        )}
      </div>
      <div className="flex justify-between font-label-sm text-label-sm text-secondary">
        <span>
          {fmt(legend.min)} <span className="text-outline normal-case">{track.lowWord}</span>
        </span>
        <span aria-hidden="true">{fmt(mid)}</span>
        <span>
          <span className="text-outline normal-case">{track.highWord}</span> {fmt(legend.max)}
        </span>
      </div>
    </figure>
  );
}

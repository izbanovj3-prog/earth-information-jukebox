// One headline number per frame of an EIC record, as a line chart with a data table.
// Single series: no legend (the heading names it). Line/markers use #c9831f, a darker step of the
// theme amber that passes the dataviz validator on the dark panel surface (lightness band, chroma,
// >= 3:1 contrast); the current frame is the brighter primary amber with a 2px surface ring.
// Text stays in text tokens. Hover/focus shows a tooltip; clicking a point jumps to that frame.
import { useId, useState } from 'react';

export interface TrendPoint {
  label: string;
  value: number;
}

interface Props {
  title: string;
  /** What the number is, e.g. "Global night-light brightness (index)". */
  metric: string;
  points: TrendPoint[];
  current: number;
  format: (v: number) => string;
  onSelect: (i: number) => void;
}

const W = 640;
const H = 170;
const PAD = { l: 44, r: 12, t: 12, b: 26 };
const LINE = '#c9831f';
const NOW = 'var(--color-primary)';
const SURFACE = 'var(--color-surface-container-low)';

export function TrendChart({ title, metric, points, current, format, onSelect }: Props) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const padY = (hi - lo) * 0.1;
  lo -= padY;
  hi += padY;
  const x = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const ticks = [lo + padY, (lo + hi) / 2, hi - padY];
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const iMax = vals.indexOf(Math.max(...vals));
  const iMin = vals.indexOf(Math.min(...vals));
  const summary = `${metric}: ${format(first.value)} in ${first.label}, ${format(last.value)} in ${last.label}; highest ${format(vals[iMax]!)} (${points[iMax]!.label}), lowest ${format(vals[iMin]!)} (${points[iMin]!.label}).`;
  const shown = hover ?? null;
  const colW = (W - PAD.l - PAD.r) / (points.length - 1);
  // Near the top the tooltip would cover the heading: show it under the point instead.
  const below = shown !== null && y(points[shown]!.value) < H * 0.45;

  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-space-xs bg-surface-container-low p-space-md">
      <h2 id={`${id}-h`} className="font-label-sm text-label-sm uppercase text-primary m-0">
        {title}
      </h2>
      <p className="m-0 font-label-sm text-label-sm text-secondary">{metric}</p>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label={summary} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-surface-container-highest)" strokeWidth={1} />
              <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-secondary)">
                {format(t)}
              </text>
            </g>
          ))}
          <path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {shown !== null && <line x1={x(shown)} x2={x(shown)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-outline)" strokeWidth={1} strokeDasharray="3 3" />}
          {points.map((p, i) => (
            <circle
              key={p.label}
              cx={x(i)}
              cy={y(p.value)}
              r={i === current ? 6 : 4}
              fill={i === current ? NOW : LINE}
              stroke={SURFACE}
              strokeWidth={2}
            />
          ))}
          <text x={PAD.l} y={H - 6} fontSize={11} fill="var(--color-secondary)">
            {first.label}
          </text>
          <text x={W - PAD.r} y={H - 6} fontSize={11} textAnchor="end" fill="var(--color-secondary)">
            {last.label}
          </text>
          {/* Hit targets wider than the marks: one column per frame. */}
          {points.map((p, i) => (
            <rect
              key={`hit-${p.label}`}
              x={x(i) - colW / 2}
              y={PAD.t}
              width={colW}
              height={H - PAD.t - PAD.b}
              fill="transparent"
              className="cursor-pointer"
              onPointerEnter={() => setHover(i)}
              onClick={() => onSelect(i)}
            />
          ))}
        </svg>
        {shown !== null && (
          <div
            className={`absolute pointer-events-none bg-surface-container-highest text-on-surface font-label-sm text-label-sm px-space-sm py-1 -translate-x-1/2 whitespace-nowrap ${below ? '' : '-translate-y-full'}`}
            style={{ left: `${(Math.min(Math.max(x(shown), 90), W - 90) / W) * 100}%`, top: `${(y(points[shown]!.value) / H) * 100}%`, marginTop: below ? 10 : -10 }}
            aria-hidden="true"
          >
            {points[shown]!.label}: <strong>{format(points[shown]!.value)}</strong>
          </div>
        )}
      </div>
      <details>
        <summary className="min-h-[44px] flex items-center cursor-pointer font-label-md text-label-md uppercase text-on-surface-variant hover:text-on-surface">
          Show as a table
        </summary>
        <table className="w-full border-collapse font-body-md text-body-md">
          <caption className="sr-only">{metric}, one value per frame</caption>
          <thead>
            <tr className="text-left text-secondary font-label-sm text-label-sm uppercase">
              <th scope="col" className="py-1 pr-space-sm">Frame</th>
              <th scope="col" className="py-1 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={p.label} aria-current={i === current ? 'true' : undefined} className={`border-t border-surface-container-highest ${i === current ? 'text-primary' : 'text-on-surface'}`}>
                <th scope="row" className="py-1 pr-space-sm font-normal text-left">
                  {p.label}
                  {i === current && <span className="sr-only"> (current frame)</span>}
                </th>
                <td className="py-1 text-right font-mono">{format(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

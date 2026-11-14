interface Props {
  frameIndex: number;
  frameCount: number;
  loadedCount: number;
  dateLabels: string[];
  onSeek: (i: number) => void;
  timelapse: boolean;
  onTimelapse: (v: boolean) => void;
}

/** Scrubber deck under the map, matching the Main Player reference's "Scrubber Deck" section. */
export function TimeScrubber(p: Props) {
  const pct = p.frameCount > 1 ? (p.frameIndex / (p.frameCount - 1)) * 100 : 0;
  return (
    <div className="flex flex-col gap-space-sm bg-surface-container-low p-space-md">
      <div className="relative w-full h-8 flex items-center">
        <div className="w-full h-1 bg-surface-container-highest" aria-hidden="true" />
        <div className="absolute left-0 h-1 bg-primary pointer-events-none" style={{ width: `${pct}%` }} aria-hidden="true" />
        <input
          type="range"
          className="absolute inset-0 w-full h-8 appearance-none bg-transparent cursor-pointer accent-primary"
          min={0}
          max={Math.max(0, p.frameCount - 1)}
          step={1}
          value={p.frameIndex}
          aria-label="Time"
          aria-valuetext={`${p.dateLabels[p.frameIndex] ?? ''}, frame ${p.frameIndex + 1} of ${p.frameCount}`}
          onChange={(e) => p.onSeek(Number(e.target.value))}
          disabled={p.frameCount < 2}
        />
      </div>
      <div className="flex justify-between items-center font-label-sm text-label-sm text-secondary px-1" aria-hidden="true">
        <span>{p.dateLabels[0]}</span>
        {p.frameCount > 2 && <span>{p.dateLabels[Math.floor((p.frameCount - 1) / 2)]}</span>}
        <span className="text-primary font-bold">{p.dateLabels[p.frameIndex]}</span>
      </div>
      <div className="flex justify-between items-center flex-wrap gap-space-xs pt-space-xs font-label-sm text-label-sm text-secondary">
        <span>
          Position: <strong className="text-on-surface font-bold">{p.dateLabels[p.frameIndex] ?? '—'}</strong>
          {p.loadedCount < p.frameCount && ` · ${p.loadedCount}/${p.frameCount} loaded`}
        </span>
        <span className="text-on-surface">
          Frame {p.frameIndex + 1} of {p.frameCount}
        </span>
        <label className="flex items-center gap-space-xs">
          <input type="checkbox" className="accent-primary" checked={p.timelapse} onChange={(e) => p.onTimelapse(e.target.checked)} />
          Advance through time after each sweep
        </label>
      </div>
    </div>
  );
}

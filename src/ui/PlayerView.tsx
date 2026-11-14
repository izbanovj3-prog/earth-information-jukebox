import { forwardRef } from 'react';
import type { Track } from '../data/catalog';
import type { Preset } from '../sonify/mapping';
import type { Frame, Legend, ScaleName } from '../types';
import { LegendBar } from './LegendBar';
import { Screen } from './Screen';
import { SidePanel, type LiveBand } from './SidePanel';
import { TimeScrubber } from './TimeScrubber';
import { Transport, type NarrationMode } from './Transport';
import { TrackRail, type EicRecord } from './TrackRail';

interface Props {
  tracks: Track[];
  trackIndex: number;
  track: Track;
  onSelectTrack: (i: number) => void;
  onBrowseAll: () => void;
  eicRecords: EicRecord[];
  onSelectEic: (id: string) => void;

  notice?: string;
  offlineBanner?: string;
  legendWarning?: string;
  audioError?: string | null;

  frame: Frame | undefined;
  legend: Legend | null;
  basemapUrl: string;
  dateLabel: string;
  screenStatus: 'loading' | 'ready' | 'error';
  frameError?: string;
  onRetry: () => void;
  mode: 'scan' | 'explore';
  onMode: (m: 'scan' | 'explore') => void;
  scan: number;
  stepMs: number;
  playing: boolean;
  cursor: { x: number; y: number };
  cursorLabel: string;
  onProbe: (x: number, y: number, gesture: boolean) => void;
  onMapFocus: () => void;

  frameIndex: number;
  loadedCount: number;
  dateLabels: string[];
  onSeek: (i: number) => void;
  timelapse: boolean;
  onTimelapse: (v: boolean) => void;

  nowValue: number | null;
  lat: number | null;
  lon: number | null;
  liveBands: LiveBand[];

  canPlay: boolean;
  onToggle: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
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

  hearing: string;
  onOpenHelp: () => void;
  description: string;
}

export const PlayerView = forwardRef<HTMLDivElement, Props>(function PlayerView(p, mapRef) {
  return (
    <div className="flex flex-col pb-[190px] sm:pb-[150px] xl:pb-[120px]">
      <div className="px-space-md pt-space-md flex flex-col gap-space-xs">
        {p.notice && (
          <p className="m-0 px-space-sm py-space-xs bg-surface-container text-primary font-label-md text-label-md" role="status">
            {p.notice}
          </p>
        )}
        {p.offlineBanner && (
          <p className="m-0 px-space-sm py-space-xs bg-surface-container text-primary font-label-md text-label-md" role="status">
            {p.offlineBanner}
          </p>
        )}
        {p.legendWarning && (
          <p className="m-0 px-space-sm py-space-xs bg-surface-container text-primary font-label-md text-label-md" role="status">
            {p.legendWarning}
          </p>
        )}
        {p.audioError && (
          <p className="m-0 px-space-sm py-space-xs bg-error-container text-on-error-container font-label-md text-label-md" role="alert">
            Sound could not start ({p.audioError}). Press Play again; if it stays silent, check that this browser tab is not muted and that
            your device volume is up.
          </p>
        )}
      </div>

      <div className="flex flex-col xl:flex-row w-full bg-surface-container-lowest">
        <TrackRail
          tracks={p.tracks}
          selected={p.trackIndex}
          onSelect={p.onSelectTrack}
          onBrowseAll={p.onBrowseAll}
          eic={{ records: p.eicRecords, selected: null, onSelect: p.onSelectEic }}
        />

        <main aria-label="Cartographic sonification visualizer" className="flex-1 min-w-0 p-space-md xl:p-space-lg flex flex-col gap-space-md xl:gap-space-lg bg-surface">
          <Screen
            ref={mapRef}
            frame={p.frame}
            legend={p.legend}
            basemapUrl={p.basemapUrl}
            dateLabel={p.dateLabel}
            status={p.screenStatus}
            loaded={p.loadedCount}
            total={p.dateLabels.length}
            error={p.frameError}
            onRetry={p.onRetry}
            mode={p.mode}
            scan={p.scan}
            stepMs={p.stepMs}
            playing={p.playing}
            cursor={p.cursor}
            cursorLabel={p.cursorLabel}
            descriptionId="frame-desc"
            onProbe={p.onProbe}
            onMapFocus={p.onMapFocus}
          />
          <LegendBar legend={p.legend} track={p.track} marker={p.nowValue} />
          <TimeScrubber
            frameIndex={p.frameIndex}
            frameCount={p.dateLabels.length}
            loadedCount={p.loadedCount}
            dateLabels={p.dateLabels}
            onSeek={p.onSeek}
            timelapse={p.timelapse}
            onTimelapse={p.onTimelapse}
          />
          <section aria-labelledby="desc-h" className="max-w-[72ch]">
            <h2 id="desc-h" className="font-label-sm text-label-sm uppercase text-primary mb-1.5">
              What this frame shows
            </h2>
            <p id="frame-desc" className="font-body-md text-body-md text-on-surface text-pretty">
              {p.description}
            </p>
          </section>
        </main>

        <SidePanel
          track={p.track}
          index={p.trackIndex}
          dateLabel={p.dateLabel}
          hearing={p.hearing}
          lat={p.lat}
          lon={p.lon}
          nowValue={p.nowValue}
          mode={p.mode}
          liveBands={p.liveBands}
          range={p.track.range}
          onOpenHelp={p.onOpenHelp}
        />
      </div>

      <Transport
        playing={p.playing}
        canPlay={p.canPlay}
        onToggle={p.onToggle}
        onPrevTrack={p.onPrevTrack}
        onNextTrack={p.onNextTrack}
        mode={p.mode}
        onMode={p.onMode}
        tempo={p.tempo}
        onTempo={p.onTempo}
        preset={p.preset}
        onPreset={p.onPreset}
        scale={p.scale}
        onScale={p.onScale}
        rootMidi={p.rootMidi}
        onRoot={p.onRoot}
        volume={p.volume}
        onVolume={p.onVolume}
        muted={p.muted}
        onMute={p.onMute}
        narration={p.narration}
        onNarration={p.onNarration}
      />
    </div>
  );
});

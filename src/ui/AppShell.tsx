import { useEffect, useState, type ReactNode } from 'react';
import { TRACKS } from '../data/catalog';
import { BackIcon, MuteIcon, PersonIcon, VolumeIcon } from './icons';

export const DISCLAIMER = 'Unofficial prototype built for NASA Space Apps Challenge. Not a NASA product.';

/** 01 Deck Monitor is the real player; the rest are visual-only (see .stitch/DESIGN.md). */
const DECORATIVE_RAIL_ITEMS = ['02 SPECTRUM RACK', '03 MATRIX ROUTER', '04 CALIBRATION', '05 TAPE ARCHIVE'];

function useUtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now.toISOString().slice(11, 19);
}

/** Real dB readout from the master volume fraction (0..1), not a fabricated meter. */
function volumeDb(volume: number, muted: boolean): string {
  if (muted || volume <= 0) return '-∞ dB';
  return `${Math.round(20 * Math.log10(volume))} dB`;
}

interface AppShellProps {
  view: 'player' | 'library';
  onOpenPlayer: () => void;
  volume: number;
  onVolume: (v: number) => void;
  muted: boolean;
  onMute: () => void;
  touring: boolean;
  onTour: () => void;
  onHelp: () => void;
  children: ReactNode;
}

export function AppShell(p: AppShellProps) {
  const clock = useUtcClock();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to the player
      </a>
      <header className="fixed top-0 left-0 right-0 h-16 bg-surface-container-low border-b border-surface-container-highest z-50 flex items-center justify-between px-space-md gap-space-sm overflow-x-auto">
        <div className="flex items-center gap-space-md shrink-0">
          <div className="flex items-center gap-space-sm pr-space-md border-r border-surface-container-highest">
            <span className="w-3 h-3 bg-primary shrink-0" aria-hidden="true" />
            <h1 className="font-headline-md text-headline-md tracking-wider uppercase text-on-surface m-0">Earth Jukebox</h1>
            <span className="font-label-sm text-label-sm uppercase px-1.5 py-0.5 bg-surface-container text-on-surface-variant border border-surface-container-highest ml-1">
              CH-01
            </span>
          </div>
          <div className="hidden 2xl:flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
            <span className="w-2 h-2 bg-primary tube" aria-hidden="true" />
            <span className="tracking-wider uppercase text-on-surface">Stream: live</span>
            <span className="text-outline-variant px-1">/</span>
            <span className="tracking-wider uppercase">Sonification engine: ready (Web Audio, live synthesis)</span>
          </div>
        </div>
        <div className="flex items-center gap-space-xs shrink-0">
          <button
            type="button"
            className="min-h-[48px] px-space-sm bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md uppercase transition-colors hidden lg:inline-flex items-center"
            onClick={p.onTour}
            aria-pressed={p.touring}
          >
            Demo Tour <span className="text-secondary normal-case ml-1.5">90s</span>
          </button>
          <div className="hidden xl:flex items-center gap-space-sm px-space-sm py-1 bg-surface-container border border-surface-container-highest">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Monitor</span>
            <span className="font-label-sm text-label-sm text-primary">{volumeDb(p.volume, p.muted)}</span>
          </div>
          <button
            type="button"
            className="min-h-[48px] min-w-[48px] px-space-sm bg-surface-container border border-surface-container-highest hover:bg-surface-container-high flex items-center gap-space-xs font-label-md text-label-md uppercase text-on-surface transition-colors"
            onClick={p.onMute}
            aria-pressed={p.muted}
          >
            {p.muted ? <MuteIcon className="w-[18px] h-[18px]" /> : <VolumeIcon className="w-[18px] h-[18px]" />}
            <span className="hidden sm:inline">Mute</span>
            <span className="font-label-sm text-label-sm bg-surface-container-lowest text-primary px-1 py-0.5 border border-surface-container-highest">
              M
            </span>
          </button>
          <label className="hidden xl:flex items-center gap-space-xs px-space-sm min-h-[48px] bg-surface-container border border-surface-container-highest">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Vol</span>
            <input
              aria-label="Master volume"
              className="w-20 accent-primary bg-surface-container-lowest h-1.5 cursor-pointer"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={p.volume}
              onChange={(e) => p.onVolume(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className="min-h-[48px] min-w-[48px] px-space-sm bg-surface-container border border-surface-container-highest hover:bg-surface-container-high flex items-center justify-center font-label-md text-label-md uppercase text-on-surface transition-colors"
            onClick={p.onHelp}
            aria-keyshortcuts="?"
          >
            <span className="font-label-sm text-label-sm bg-surface-container-lowest text-primary px-1.5 py-0.5 border border-surface-container-highest">
              ?
            </span>
            <span className="sr-only">How to listen and keyboard shortcuts</span>
          </button>
          <span
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 text-on-primary"
            aria-hidden="true"
            title="Earth Information Jukebox"
          >
            <PersonIcon className="w-[18px] h-[18px]" />
          </span>
        </div>
      </header>

      <aside
        aria-label="Console sections"
        className="hidden xl:flex fixed left-0 top-16 bottom-0 w-64 bg-surface-container-low border-r border-surface-container-highest z-40 flex-col justify-between p-space-md overflow-y-auto"
      >
        <div className="flex flex-col gap-space-md">
          <div className="border-b border-surface-container-highest pb-space-sm">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider block">Telemetry routing</span>
            <span className="font-headline-md text-headline-md text-on-surface">Master Bay</span>
          </div>
          <nav className="flex flex-col gap-1" aria-label="Console sections">
            <button
              type="button"
              onClick={p.onOpenPlayer}
              aria-current={p.view === 'player' ? 'page' : undefined}
              className={`flex items-center justify-between min-h-[48px] px-space-sm border transition-colors text-left ${
                p.view === 'player'
                  ? 'bg-primary-container text-on-primary-container font-bold border-primary'
                  : 'bg-surface-container border-surface-container-highest text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <span className="font-label-md text-label-md uppercase">01 Deck Monitor</span>
              <span className="font-label-sm text-label-sm text-secondary bg-surface-container-lowest px-1 border border-surface-container-highest">
                1
              </span>
            </button>
            {DECORATIVE_RAIL_ITEMS.map((label, i) => (
              <span
                key={label}
                aria-disabled="true"
                className="flex items-center justify-between min-h-[48px] px-space-sm bg-surface-container border border-surface-container-highest text-outline opacity-60 cursor-not-allowed"
              >
                <span className="font-label-md text-label-md uppercase">{label}</span>
                <span className="font-label-sm text-label-sm text-outline bg-surface-container-lowest px-1 border border-surface-container-highest">
                  {i + 2}
                </span>
              </span>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-space-xs border-t border-surface-container-highest pt-space-sm">
          <div className="flex justify-between items-center font-label-sm text-label-sm text-on-surface-variant">
            <span>Sync clock</span>
            <span className="text-primary font-bold mono">UTC {clock}</span>
          </div>
          <div className="flex justify-between items-center font-label-sm text-label-sm text-on-surface-variant">
            <span>Records</span>
            <span className="text-secondary">{TRACKS.length} verified</span>
          </div>
        </div>
      </aside>

      <div className="xl:pl-64 pt-16 flex flex-col min-h-screen">
        {p.view === 'player' && (
          <div className="xl:hidden h-12 px-space-md flex items-center border-b border-surface-container-highest bg-surface-container-low">
            <span className="font-label-sm text-label-sm text-primary uppercase">Sys // TLM-01</span>
          </div>
        )}
        <main className="flex-1 bg-surface" id="main" tabIndex={-1}>
          {p.children}
        </main>
        <footer className="w-full bg-surface-container-lowest px-space-lg py-space-sm text-center">
          <p className="font-label-sm text-label-sm text-secondary m-0">
            Data: NASA GIBS. Sound is an interpretation of the image, not a measurement. {DISCLAIMER}
          </p>
        </footer>
      </div>
    </>
  );
}

export function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[44px] inline-flex items-center gap-space-xs px-space-sm -ml-space-sm text-on-surface hover:text-primary transition-colors font-label-md text-label-md uppercase"
    >
      <BackIcon className="w-5 h-5" />
      {label}
    </button>
  );
}

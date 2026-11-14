import '@fontsource/bungee/400.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/atkinson-hyperlegible-mono/400.css';
import './global.css';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { keyInputFromEvent, resolveShortcut, type Action } from '../a11y/keymap';
import { describeColumn, describeFrame, formatLat, formatLon, levelWord, Throttle } from '../a11y/narration';
import { AudioEngine } from '../audio/engine';
import { JukeboxPlayer } from '../audio/player';
import { formatDate, formatValue, TRACKS } from '../data/catalog';
import { BASE_URL, loadManifest, type Manifest } from '../data/loader';
import { buildMapping, PRESETS, type Preset } from '../sonify/mapping';
import { frameStats } from '../sonify/sample';
import type { ScaleName } from '../types';
import styles from './App.module.css';
import { Carousel } from './Carousel';
import { HelpDialog } from './HelpDialog';
import { Marquee } from './Marquee';
import { HowToListen, LegendBar, NowPlaying, SourcesPanel } from './Panels';
import { Screen } from './Screen';
import { Transport, type NarrationMode } from './Transport';
import { TOUR, type TourAction } from './tour';
import { useTrackFrames } from './useTrackFrames';

const STEPS = 48;
const BASEMAP = `${BASE_URL}frames/basemap/coastlines.png`;
const NARRATION_INTERVAL_MS = 6000;
/** Explore cursor step in pixels (2° per arrow press; Shift = 20°). */
const CURSOR_STEP = 4;

function useAnnouncer() {
  const [message, setMessage] = useState('');
  const flip = useRef(false);
  // Alternate a trailing no-break space so identical messages are still announced.
  const announce = useCallback((text: string) => {
    flip.current = !flip.current;
    setMessage(text + (flip.current ? ' ' : ''));
  }, []);
  return [message, announce] as const;
}

export function App() {
  // Initial record/date can come from the URL (?record=sea-ice&date=2012-09-15) so views are shareable.
  const [initial] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const t = Math.max(0, TRACKS.findIndex((tr) => tr.id === q.get('record')));
    const d = TRACKS[t]!.dates.indexOf(q.get('date') ?? '');
    return { track: t, frame: Math.max(0, d) };
  });
  const [trackIndex, setTrackIndex] = useState(initial.track);
  const track = TRACKS[trackIndex]!;
  const data = useTrackFrames(track);
  const [manifest, setManifest] = useState<Manifest | null>(null);

  // Created once; the AudioContext itself is only created later, on a user gesture.
  const [player] = useState(() => new JukeboxPlayer(new AudioEngine(), { steps: STEPS }));

  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<'scan' | 'explore'>('scan');
  const [frameIndex, setFrameIndex] = useState(0);
  const [scan, setScan] = useState(0);
  const [hearing, setHearing] = useState('Nothing yet. Press Play (or Space) to start the scan, or E to explore the map.');
  const [cursor, setCursor] = useState({ x: 360, y: 90 });
  const [cursorLabel, setCursorLabel] = useState('Explore: click the map, or press E and use the arrow keys.');
  const [preset, setPreset] = useState<Preset['id']>('calm');
  const [scale, setScale] = useState<ScaleName>(PRESETS.calm.scale);
  const [rootMidi, setRootMidi] = useState(48);
  const [tempo, setTempo] = useState(PRESETS.calm.tempo);
  const [volume, setVolume] = useState(0.35);
  const [muted, setMuted] = useState(false);
  const [timelapse, setTimelapse] = useState(true);
  const [narration, setNarration] = useState<NarrationMode>('detailed');
  const [helpOpen, setHelpOpen] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  /** Value currently sounding (column mean while scanning, cursor value while exploring). */
  const [nowValue, setNowValue] = useState<number | null>(null);
  const [message, announce] = useAnnouncer();
  const mapRef = useRef<HTMLDivElement>(null);
  const throttle = useRef(new Throttle(NARRATION_INTERVAL_MS));

  const frame = data.frames[frameIndex];
  const baseFrame = data.frames[0];
  const dateLabels = useMemo(() => track.dates.map((d) => formatDate(track, d)), [track]);
  const dateLabel = dateLabels[frameIndex] ?? '';

  const description = useMemo(() => {
    if (!frame) return data.status === 'error' ? 'No frame could be loaded.' : 'Loading the first frame…';
    return describeFrame(
      track,
      frame.date,
      frameStats(frame),
      baseFrame ? { date: baseFrame.date, stats: frameStats(baseFrame) } : undefined,
    );
  }, [frame, baseFrame, track, data.status]);

  // Latest values for callbacks fired by the audio clock.
  const live = useRef({ track, narration, dateLabels, data, frameIndex, mode, playing, cursor });
  useLayoutEffect(() => {
    live.current = { track, narration, dateLabels, data, frameIndex, mode, playing, cursor };
  });

  const urgent = useCallback(
    (text: string) => {
      throttle.current.allow(true);
      announce(text);
    },
    [announce],
  );

  useEffect(() => {
    loadManifest()
      .then(setManifest)
      .catch(() => setManifest(null));
  }, []);

  // Wire data into the player. Reset to the first frame when the record changes.
  // A pending target frame for the next record (from ?date= or the demo tour); otherwise records start at frame 0.
  const lastTrack = useRef<string | null>(null);
  const pendingStart = useRef<{ trackId: string; frame: number } | null>({
    trackId: TRACKS[initial.track]!.id,
    frame: initial.frame,
  });
  useEffect(() => {
    player.setFrames(data.frames);
    if (lastTrack.current !== track.id && data.frames.length === track.dates.length) {
      const p = pendingStart.current;
      const start = p && p.trackId === track.id ? p.frame : 0;
      pendingStart.current = null;
      lastTrack.current = track.id;
      player.seekFrame(start);
      setFrameIndex(start);
      setScan(0);
    }
  }, [data.frames, track, player]);

  // Reflect the current record and date in the URL (no history spam).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    q.set('record', track.id);
    q.set('date', track.dates[frameIndex] ?? track.dates[0]!);
    window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
  }, [track, frameIndex]);

  const mapping = useMemo(
    () => buildMapping(PRESETS[preset], track.range, { scale, rootMidi, outliers: track.accents }),
    [preset, track, scale, rootMidi],
  );
  useEffect(() => player.setMapping(mapping), [player, mapping]);
  useEffect(() => player.setTempo(tempo), [player, tempo]);
  useEffect(() => player.setTimelapse(timelapse), [player, timelapse]);
  useEffect(() => player.setDroneConfig({ metric: track.droneMetric, changeScale: track.changeScale }), [player, track]);
  useEffect(() => player.engine.setMasterVolume(volume), [player, volume]);
  useEffect(() => player.engine.setMuted(muted), [player, muted]);

  // Frame changes from the time-lapse.
  useEffect(
    () =>
      player.onFrameChange((i) => {
        setFrameIndex(i);
        const l = live.current;
        if (l.narration !== 'off' && l.playing) {
          const f = l.data.frames[i];
          const s = f ? frameStats(f) : null;
          urgent(`${l.dateLabels[i]}. Average ${s ? formatValue(l.track, s.mean) : 'unknown'}.`);
        }
      }),
    [player, urgent],
  );

  // Announce record changes.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (live.current.narration !== 'off') urgent(`Record ${trackIndex + 1}: ${track.title}. ${track.subtitle}.`);
  }, [track, trackIndex, urgent]);

  // Visual + narration sync on the audio clock.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let prev: ReturnType<JukeboxPlayer['drainVisual']>[number] | undefined;
    const loop = () => {
      const due = player.drainVisual();
      const last = due[due.length - 1];
      if (last) {
        const l = live.current;
        setScan((last.column + 0.5) / STEPS);
        setNowValue(last.sample.meanValue);
        const text = describeColumn(l.track, last.sample, prev?.frameIndex === last.frameIndex ? prev.sample : undefined, last.notes);
        setHearing(text);
        if (l.narration === 'detailed' && throttle.current.allow()) announce(text);
        prev = last;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, player, announce]);

  const play = useCallback(async () => {
    try {
      setAudioError(null);
      setMode('scan');
      await player.play();
      setPlaying(true);
      const l = live.current;
      if (l.narration !== 'off') urgent(`Playing ${l.track.title}, ${l.dateLabels[player.currentFrameIndex]}. Scanning west to east.`);
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : String(e));
    }
  }, [player, urgent]);

  const pause = useCallback(
    async (reason?: string) => {
      await player.pause();
      setPlaying(false);
      urgent(reason ?? 'Paused.');
    },
    [player, urgent],
  );

  const togglePlay = useCallback(() => {
    if (live.current.playing) void pause();
    else void play();
  }, [play, pause]);

  // Pause when the tab is hidden; never resume without a gesture.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && live.current.playing) void pause('Paused because the tab was hidden.');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [pause]);

  const seek = useCallback(
    (i: number) => {
      const n = track.dates.length;
      const j = ((i % n) + n) % n;
      player.seekFrame(j);
      setFrameIndex(j);
      setScan(0);
      if (live.current.narration !== 'off') urgent(`${dateLabels[j]}.`);
    },
    [player, track, dateLabels, urgent],
  );

  const changeTrack = useCallback((i: number) => {
    const n = TRACKS.length;
    setTrackIndex(((i % n) + n) % n);
  }, []);

  /** Go to a record and a date (used by the demo tour). */
  const goTo = useCallback(
    (trackId: string, date: string) => {
      const ti = TRACKS.findIndex((t) => t.id === trackId);
      if (ti < 0) return;
      const fi = Math.max(0, TRACKS[ti]!.dates.indexOf(date));
      if (TRACKS[ti]!.id === live.current.track.id) {
        player.seekFrame(fi);
        setFrameIndex(fi);
        setScan(0);
      } else {
        pendingStart.current = { trackId, frame: fi };
        changeTrack(ti);
      }
    },
    [changeTrack, player],
  );

  const enterExplore = useCallback(() => {
    if (live.current.mode !== 'explore') {
      player.holdScan();
      setPlaying(false);
      setMode('explore');
    }
  }, [player]);

  const probeAt = useCallback(
    async (x: number, y: number) => {
      enterExplore();
      setCursor({ x, y });
      try {
        const r = await player.probeAt(x, y);
        if (!r) return;
        const l = live.current;
        const text = `${formatLat(r.lat)} ${formatLon(r.lon)}: ${formatValue(l.track, r.value)}${r.value === null ? '' : `, ${levelWord(l.track, r.value)}`}`;
        setCursorLabel(text);
        setHearing(`Explore cursor at ${text}.`);
        setNowValue(r.value);
        if (l.narration !== 'off') urgent(text);
      } catch (e) {
        setAudioError(e instanceof Error ? e.message : String(e));
      }
    },
    [enterExplore, player, urgent],
  );

  // ----- Demo tour (scripted, ~90 s; starts only from a button press) -----
  const [touring, setTouring] = useState(false);
  const tourTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stopTour = useCallback(() => {
    tourTimers.current.forEach(clearTimeout);
    tourTimers.current = [];
    setTouring(false);
  }, []);
  useEffect(() => stopTour, [stopTour]);

  const runTourAction = useCallback(
    (a: TourAction) => {
      switch (a.type) {
        case 'goto':
          return goTo(a.track, a.date);
        case 'play':
          return void play();
        case 'tempo':
          return setTempo(a.value);
        case 'timelapse':
          // Apply to the player immediately (the effect would lag one render behind the next step).
          player.setTimelapse(a.on);
          return setTimelapse(a.on);
        case 'say':
          return urgent(a.text);
        case 'explore': {
          const x = Math.round(((a.lon + 180) / 360) * 720);
          const y = Math.round(((90 - a.lat) / 180) * 360);
          return void probeAt(Math.min(719, x), Math.min(359, y));
        }
        case 'end':
          stopTour();
          return void pause('Demo tour finished.');
      }
    },
    [goTo, play, urgent, probeAt, stopTour, pause, player],
  );

  const toggleTour = useCallback(() => {
    if (touring) {
      stopTour();
      void pause('Demo tour stopped.');
      return;
    }
    setTouring(true);
    if (live.current.narration === 'off') setNarration('changes');
    // The first steps run synchronously inside the click, so audio starts within the user gesture.
    for (const step of TOUR) {
      if (step.at === 0) runTourAction(step.action);
      else tourTimers.current.push(setTimeout(() => runTourAction(step.action), step.at * 1000));
    }
    void play();
  }, [touring, stopTour, pause, runTourAction, play]);

  const onMode = useCallback(
    (m: 'scan' | 'explore') => {
      if (m === 'explore') {
        enterExplore();
        mapRef.current?.focus();
      } else {
        setMode('scan');
      }
    },
    [enterExplore],
  );

  const dispatch = useCallback(
    (a: Action) => {
      const l = live.current;
      switch (a.type) {
        case 'togglePlay':
          return togglePlay();
        case 'prevTrack':
          return changeTrack(trackIndex - 1);
        case 'nextTrack':
          return changeTrack(trackIndex + 1);
        case 'prevFrame':
          return seek(l.frameIndex - 1);
        case 'nextFrame':
          return seek(l.frameIndex + 1);
        case 'toggleMute':
          setMuted((m) => {
            urgent(m ? 'Sound on.' : 'Muted.');
            return !m;
          });
          return;
        case 'help':
          return setHelpOpen(true);
        case 'focusMap':
          enterExplore();
          mapRef.current?.focus();
          return;
        case 'describe':
          return urgent(description);
        case 'move': {
          const f = l.data.frames[l.frameIndex];
          const w = f?.width ?? 720;
          const h = f?.height ?? 360;
          const x = Math.min(w - 1, Math.max(0, l.cursor.x + a.dx * CURSOR_STEP));
          const y = Math.min(h - 1, Math.max(0, l.cursor.y + a.dy * CURSOR_STEP));
          void probeAt(x, y);
          return;
        }
      }
    },
    [togglePlay, changeTrack, trackIndex, seek, urgent, enterExplore, description, probeAt],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = resolveShortcut(keyInputFromEvent(e, document.activeElement === mapRef.current, helpOpen));
      if (!action) return;
      e.preventDefault();
      if (tourTimers.current.length) stopTour(); // any shortcut hands control back to the user
      dispatch(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, helpOpen, stopTour]);

  const stepMs = Math.round(1000 / tempo);

  return (
    <>
      <a className="skip-link" href="#player">
        Skip to the player
      </a>
      <Marquee onHelp={() => setHelpOpen(true)} onTour={toggleTour} touring={touring} />
      <main className={styles.cabinet} id="main">
        <div className={styles.records}>
          <Carousel tracks={TRACKS} selected={trackIndex} playing={playing} onSelect={changeTrack} />
        </div>

        <div className={styles.center} id="player" tabIndex={-1}>
          {data.fallbackReason && (
            <p className={styles.banner} role="status">
              Live NASA GIBS imagery is unavailable right now, so you are hearing bundled copies of the same NASA images
              {manifest ? ` (downloaded ${manifest.generated.slice(0, 10)})` : ''}.
            </p>
          )}
          {data.legendWarning && (
            <p className={styles.banner} role="status">
              {data.legendWarning}
            </p>
          )}
          {audioError && (
            <p className={styles.error} role="alert">
              Sound could not start: {audioError}
            </p>
          )}
          <Screen
            ref={mapRef}
            frame={frame}
            legend={data.legend}
            basemapUrl={BASEMAP}
            dateLabel={dateLabel}
            status={data.status}
            loaded={data.loaded}
            total={track.dates.length}
            error={data.error}
            onRetry={data.retry}
            mode={mode}
            scan={scan}
            stepMs={stepMs}
            playing={playing}
            cursor={cursor}
            cursorLabel={cursorLabel}
            descriptionId="frame-desc"
            onProbe={(x, y) => void probeAt(x, y)}
            onMapFocus={enterExplore}
          />
          <LegendBar legend={data.legend} track={track} marker={nowValue} />
          <Transport
            playing={playing}
            canPlay={!!frame}
            onToggle={togglePlay}
            onPrevTrack={() => changeTrack(trackIndex - 1)}
            onNextTrack={() => changeTrack(trackIndex + 1)}
            mode={mode}
            onMode={onMode}
            frameIndex={frameIndex}
            frameCount={track.dates.length}
            loadedCount={data.loaded}
            dateLabels={dateLabels}
            onSeek={seek}
            timelapse={timelapse}
            onTimelapse={setTimelapse}
            tempo={tempo}
            onTempo={setTempo}
            preset={preset}
            onPreset={(p) => {
              setPreset(p);
              setScale(PRESETS[p].scale);
              setTempo(PRESETS[p].tempo);
            }}
            scale={scale}
            onScale={setScale}
            rootMidi={rootMidi}
            onRoot={setRootMidi}
            volume={volume}
            onVolume={setVolume}
            muted={muted}
            onMute={() => setMuted((m) => !m)}
            narration={narration}
            onNarration={setNarration}
          />
          <section className={styles.describe} aria-labelledby="desc-h">
            <h2 id="desc-h" className={styles.h2}>
              What This Frame Shows
            </h2>
            <p id="frame-desc">{description}</p>
          </section>
        </div>

        <div className={styles.side}>
          <NowPlaying track={track} index={trackIndex} dateLabel={dateLabel} hearing={hearing} />
          <HowToListen track={track} />
        </div>

        <div className={styles.full}>
          <SourcesPanel track={track} frame={frame} legend={data.legend} legendWarning={data.legendWarning} manifest={manifest} />
        </div>
      </main>
      <footer className={styles.footer}>
        <p>
          Unofficial prototype built for NASA Space Apps Challenge. Not a NASA product. Data: NASA GIBS. Code: Apache-2.0.
        </p>
      </footer>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <div className="visually-hidden" aria-live="polite" aria-atomic="true" data-testid="narrator">
        {message}
      </div>
    </>
  );
}

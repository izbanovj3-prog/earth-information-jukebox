import '@fontsource/bungee/400.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/atkinson-hyperlegible-mono/400.css';
import './global.css';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { keyInputFromEvent, resolveShortcut, type Action } from '../a11y/keymap';
import { describeColumn, describeFrame, describeFrameChange, describePlaying, describeProbe, Throttle } from '../a11y/narration';
import { AudioEngine } from '../audio/engine';
import { JukeboxPlayer } from '../audio/player';
import { formatDate, TRACKS, withLegend } from '../data/catalog';
import { FRAME_HEIGHT, FRAME_WIDTH } from '../data/gibs';
import { latToY, lonToX } from '../data/values';
import { BASE_URL, loadManifest, type Manifest } from '../data/loader';
import { buildMapping, DEFAULT_ROOT_MIDI, PRESETS, type Preset } from '../sonify/mapping';
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
    const notes: string[] = [];
    const wanted = q.get('record');
    let t = TRACKS.findIndex((tr) => tr.id === wanted);
    if (t < 0) {
      if (wanted) notes.push(`There is no record called “${wanted}”, so the first record is playing.`);
      t = 0;
    }
    const dates = TRACKS[t]!.dates;
    const wantedDate = q.get('date');
    let d = wantedDate ? dates.indexOf(wantedDate) : 0;
    if (d < 0) {
      // Snap to the nearest available date and say so.
      const target = Date.parse(wantedDate!);
      d = Number.isNaN(target)
        ? 0
        : dates.reduce((best, x, i) => (Math.abs(Date.parse(x) - target) < Math.abs(Date.parse(dates[best]!) - target) ? i : best), 0);
      notes.push(`${TRACKS[t]!.title} has no frame for “${wantedDate}”; showing ${formatDate(TRACKS[t]!, dates[d]!)} instead.`);
    }
    return { track: t, frame: d, notice: notes.join(' ') };
  });
  const [trackIndex, setTrackIndex] = useState(initial.track);
  const [frameIndex, setFrameIndex] = useState(initial.frame);
  const baseTrack = TRACKS[trackIndex]!;
  const data = useTrackFrames(baseTrack, frameIndex);
  // With an uncalibrated (brightness) legend, range, units and words switch to relative values.
  const track = useMemo(() => withLegend(baseTrack, data.legend), [baseTrack, data.legend]);
  const [manifest, setManifest] = useState<Manifest | null>(null);

  // Created once; the AudioContext itself is only created later, on a user gesture.
  const [player] = useState(() => new JukeboxPlayer(new AudioEngine(), { steps: STEPS }));

  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<'scan' | 'explore'>('scan');
  const [scan, setScan] = useState(0);
  const [hearing, setHearing] = useState('Nothing yet. Press Play (or Space) to start the scan, or E to explore the map.');
  const [cursor, setCursor] = useState({ x: FRAME_WIDTH / 2, y: FRAME_HEIGHT / 4 });
  const [cursorLabel, setCursorLabel] = useState('Explore: click the map, or press E and use the arrow keys.');
  const [preset, setPreset] = useState<Preset['id']>('calm');
  const [scale, setScale] = useState<ScaleName>(PRESETS.calm.scale);
  const [rootMidi, setRootMidi] = useState(DEFAULT_ROOT_MIDI);
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

  const frameError = data.frameErrors[frameIndex];
  const description = useMemo(() => {
    if (!frame) return frameError ? `The frame for ${dateLabel} could not be loaded.` : `Loading ${dateLabel}…`;
    return describeFrame(
      track,
      frame.date,
      frameStats(frame),
      baseFrame ? { date: baseFrame.date, stats: frameStats(baseFrame) } : undefined,
    );
  }, [frame, baseFrame, track, frameError, dateLabel]);

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
  // Wire frames into the player; on a new record, start the player at the chosen frame.
  const lastTrack = useRef<string | null>(null);
  useEffect(() => {
    player.setFrames(data.frames);
    if (lastTrack.current !== track.id && data.frames.length === track.dates.length) {
      lastTrack.current = track.id;
      player.seekFrame(frameIndex);
    }
  }, [data.frames, track, player, frameIndex]);

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
          urgent(describeFrameChange(l.track, l.dateLabels[i] ?? '', s));
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
    const t = TRACKS[trackIndex]!;
    if (live.current.narration !== 'off') urgent(`Record ${trackIndex + 1}: ${t.title}. ${t.subtitle}.`);
  }, [trackIndex, urgent]);

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
      if (l.narration !== 'off') urgent(describePlaying(l.track, l.dateLabels[player.currentFrameIndex] ?? ''));
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : String(e));
    }
  }, [player, urgent]);

  // Tour timers live here (declared before pause so pausing can cancel them).
  const [touring, setTouring] = useState(false);
  const tourTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stopTour = useCallback(() => {
    tourTimers.current.forEach(clearTimeout);
    tourTimers.current = [];
    setTouring(false);
  }, []);

  const pause = useCallback(
    async (reason?: string) => {
      // Any pause ends the demo tour, so no later timer can resume audio without a gesture.
      stopTour();
      await player.pause();
      setPlaying(false);
      urgent(reason ?? 'Paused.');
    },
    [player, urgent, stopTour],
  );

  const togglePlay = useCallback(() => {
    if (live.current.playing) void pause();
    else void play();
  }, [play, pause]);

  // Pause when the tab is hidden; never resume without a gesture.
  useEffect(() => {
    const onVis = () => {
      // Covers explore mode too: any running audio stops when the tab is hidden.
      if (document.hidden && player.engine.started) void pause('Paused because the tab was hidden.');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [pause, player]);

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

  /** Switch record; it starts at `frame` (default: its first date). */
  const changeTrack = useCallback((i: number, frame = 0) => {
    const n = TRACKS.length;
    setTrackIndex(((i % n) + n) % n);
    setFrameIndex(frame);
    setScan(0);
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
        changeTrack(ti, fi);
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

  /** Explore probe. `gesture` is false for mouse hover, which must never start audio. */
  const probeAt = useCallback(
    async (x: number, y: number, gesture = true) => {
      enterExplore();
      setCursor({ x, y });
      try {
        const r = await player.probeAt(x, y, gesture);
        if (!r) return;
        const l = live.current;
        const text = describeProbe(l.track, r.lat, r.lon, r.value);
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
          const dims = { width: FRAME_WIDTH, height: FRAME_HEIGHT };
          return void probeAt(lonToX(dims, a.lon), latToY(dims, a.lat));
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
          const w = f?.width ?? FRAME_WIDTH;
          const h = f?.height ?? FRAME_HEIGHT;
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
          {initial.notice && trackIndex === initial.track && (
            <p className={styles.banner} role="status">
              {initial.notice}
            </p>
          )}
          {data.offline ? (
            <p className={styles.banner} role="status">
              Offline mode: you are hearing the bundled copies of the NASA GIBS images
              {manifest ? ` (downloaded ${manifest.generated.slice(0, 10)})` : ''}.
            </p>
          ) : (
            data.fallbackReason && (
              <p className={styles.banner} role="status">
                Live NASA GIBS imagery is unavailable right now, so you are hearing bundled copies of the same NASA images
                {manifest ? ` (downloaded ${manifest.generated.slice(0, 10)})` : ''}.
              </p>
            )
          )}
          {data.legendWarning && (
            <p className={styles.banner} role="status">
              {data.legendWarning}
            </p>
          )}
          {audioError && (
            <p className={styles.error} role="alert">
              Sound could not start ({audioError}). Press Play again; if it stays silent, check that this browser tab is not muted
              and that your device volume is up.
            </p>
          )}
          <Screen
            ref={mapRef}
            frame={frame}
            legend={data.legend}
            basemapUrl={BASEMAP}
            dateLabel={dateLabel}
            status={frame ? 'ready' : frameError ? 'error' : 'loading'}
            loaded={data.loaded}
            total={track.dates.length}
            error={frameError}
            onRetry={data.retry}
            mode={mode}
            scan={scan}
            stepMs={stepMs}
            playing={playing}
            cursor={cursor}
            cursorLabel={cursorLabel}
            descriptionId="frame-desc"
            onProbe={(x, y, gesture) => void probeAt(x, y, gesture)}
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

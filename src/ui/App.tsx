import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { AppShell } from './AppShell';
import { HowToListenSheet } from './HowToListenSheet';
import { LibraryView } from './LibraryView';
import type { LiveBand } from './SidePanel';
import { PlayerView } from './PlayerView';
import type { NarrationMode } from './Transport';
import { TOUR, type TourAction } from './tour';
import { useTrackFrames } from './useTrackFrames';
import { EIC_COLS, EIC_DATASETS, EIC_ROWS, EicSession, nearestFrame, type NarrationKind } from '../eic/session';
import { EicPlayerView, type EicCursor } from './EicPlayerView';
import type { EicRecord } from './TrackRail';

/** Earth Information Center records (NASA SVS), listed before the GIBS records. Night Lights opens first (D4). */
const EIC_RECORDS: EicRecord[] = EIC_DATASETS.map((d) => ({ id: d.id, title: d.title, subtitle: d.timeSpan }));
const DEFAULT_EIC = EIC_RECORDS[0]!.id;
/** One running order for [ and ]: EIC records, then GIBS records. */
type RecordRef = { kind: 'eic'; id: string } | { kind: 'gibs'; index: number };
const ALL_RECORDS: RecordRef[] = [
  ...EIC_RECORDS.map((r) => ({ kind: 'eic' as const, id: r.id })),
  ...TRACKS.map((_, index) => ({ kind: 'gibs' as const, index })),
];

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
    setMessage(text + (flip.current ? ' ' : ''));
  }, []);
  return [message, announce] as const;
}

export function App() {
  // Initial record/date can come from the URL (?record=sea-ice&date=2012-09-15) so views are shareable.
  const [initial] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const notes: string[] = [];
    const wanted = q.get('record');
    // EIC record (or no record at all): open the Earth Information Center player.
    // EIC records are named eic-<id> in the URL (GIBS and EIC both have an "aerosols" record).
    const t = TRACKS.findIndex((tr) => tr.id === wanted);
    const eicDs = EIC_DATASETS.find((d) => `eic-${d.id}` === wanted || (t < 0 && d.id === wanted));
    if (eicDs || t < 0) {
      if (wanted && !eicDs) notes.push(`There is no record called “${wanted}”, so the first record is playing.`);
      const ds = eicDs ?? EIC_DATASETS[0]!;
      // The frame date is resolved once the baked frames are loaded (EicSession.select).
      return { track: 0, frame: 0, eic: ds.id, eicFrame: q.get('date') ?? 0, notice: notes.join(' ') };
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
    return { track: t, frame: d, eic: null as string | null, eicFrame: 0 as number | string, notice: notes.join(' ') };
  });
  const [view, setView] = useState<'player' | 'library'>('player');
  const [eicId, setEicId] = useState<string | null>(initial.eic);
  const [eic] = useState(() => new EicSession(initial.eic ?? DEFAULT_EIC));
  const eicState = useSyncExternalStore(eic.subscribe, eic.getState);
  const [eicCursor, setEicCursor] = useState<EicCursor>({ r: Math.floor(EIC_ROWS / 3), c: Math.floor(EIC_COLS / 2) });
  const [eicCursorLabel, setEicCursorLabel] = useState('Explore: click the map, or press E and use the arrow keys.');
  const [eicExploring, setEicExploring] = useState(false);
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
  /** Position of the current reading: longitude while scanning, lat+lon while exploring a point. */
  const [lon, setLon] = useState<number | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  /** Per-band value + the real frequency last scheduled for it, for the live band meters. */
  const [liveBands, setLiveBands] = useState<LiveBand[]>([]);
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
  const live = useRef({ track, narration, dateLabels, data, frameIndex, mode, playing, cursor, trackIndex });
  useLayoutEffect(() => {
    live.current = { track, narration, dateLabels, data, frameIndex, mode, playing, cursor, trackIndex };
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

  // ----- Earth Information Center player (EicSession) -----
  const eicLive = useRef({ eicId, narration });
  useLayoutEffect(() => {
    eicLive.current = { eicId, narration };
  });
  // Load the selected EIC record; the first time at the frame named in the URL.
  const eicFirstFrame = useRef(initial.eicFrame);
  /** Start playing once the newly selected EIC record has loaded (record switch while playing, library Play). */
  const eicPlayWhenLoaded = useRef(false);
  useEffect(() => {
    if (!eicId) return;
    const fi = eicFirstFrame.current;
    eicFirstFrame.current = 0;
    void eic.select(eicId, fi).then(() => {
      if (eicPlayWhenLoaded.current && eic.getState().dsId === eicId) {
        eicPlayWhenLoaded.current = false;
        void eic.play();
      }
    });
  }, [eic, eicId]);
  useEffect(() => {
    eic.setNarrator((text: string, kind: NarrationKind) => {
      const n = eicLive.current.narration;
      if (n === 'off' || !eicLive.current.eicId) return;
      if (kind === 'step') {
        if (n === 'detailed' && throttle.current.allow()) announce(text);
        return;
      }
      urgent(text);
    });
    return () => eic.setNarrator(null);
  }, [eic, announce, urgent]);
  useEffect(() => eic.setVolume(volume), [eic, volume]);
  useEffect(() => eic.setMuted(muted), [eic, muted]);

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
  // Read from the loaded frames: their dates can differ from the static list (lightning is sampled from video).
  const eicFrameDate = eicId && eicState.status === 'ready' ? (eic.loadedFrames?.[eicState.frameIndex]?.date ?? '') : '';
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    q.set('record', eicId ? `eic-${eicId}` : track.id);
    if (eicId) {
      if (eicFrameDate) q.set('date', eicFrameDate);
      else q.delete('date');
    } else q.set('date', track.dates[frameIndex] ?? track.dates[0]!);
    window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
  }, [track, frameIndex, eicId, eicFrameDate]);

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
        setLon(last.sample.lon);
        setLat(null); // scanning covers whole bands, not one latitude point
        setLiveBands(last.sample.bands.map((b, i) => ({ value: b.value, freq: last.notes.find((n) => n.band === i)?.freq ?? null })));
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
      eic.pause();
      await player.play();
      setPlaying(true);
      const l = live.current;
      if (l.narration !== 'off') urgent(describePlaying(l.track, l.dateLabels[player.currentFrameIndex] ?? ''));
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : String(e));
    }
  }, [player, urgent, eic]);

  // Tour timers live here (declared before pause so pausing can cancel them).
  const [touring, setTouring] = useState(false);
  const tourTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stopTour = useCallback(() => {
    tourTimers.current.forEach(clearTimeout);
    tourTimers.current = [];
    setTouring(false);
  }, []);
  const stopTourRef = useRef(stopTour);
  useLayoutEffect(() => {
    stopTourRef.current = stopTour;
  });

  const pause = useCallback(
    async (reason?: string) => {
      // Any pause ends the demo tour, so no later timer can resume audio without a gesture.
      stopTour();
      eic.pause();
      await player.pause();
      setPlaying(false);
      urgent(reason ?? 'Paused.');
    },
    [player, urgent, stopTour, eic],
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
      if (document.hidden && eic.getState().playing) {
        void eic.suspend();
        urgent('Paused because the tab was hidden.');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [pause, player, eic, urgent]);

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
  const changeTrack = useCallback(
    (i: number, frame = 0) => {
      const n = TRACKS.length;
      if (eicLive.current.eicId) {
        eic.pause();
        eicLive.current = { ...eicLive.current, eicId: null };
        setEicId(null);
      }
      setTrackIndex(((i % n) + n) % n);
      setFrameIndex(frame);
      setScan(0);
    },
    [eic],
  );

  /** Open an Earth Information Center record; keeps playing if something was playing. */
  const selectEic = useCallback(
    (id: string) => {
      const wasPlaying = live.current.playing || eic.getState().playing;
      if (live.current.playing) {
        stopTourRef.current();
        void player.pause();
        setPlaying(false);
      }
      setEicExploring(false);
      // Update the live ref now: a demo-tour step in the same tick must see the new record.
      eicLive.current = { ...eicLive.current, eicId: id };
      setEicId(id);
      setView('player');
      const ds = EIC_DATASETS.find((d) => d.id === id);
      if (ds && live.current.narration !== 'off') urgent(`${ds.title}. ${ds.timeSpan}.`);
      eicPlayWhenLoaded.current = wasPlaying;
    },
    [eic, player, urgent],
  );

  /** [ and ] walk one list: EIC records first, then GIBS records. */
  const stepRecord = useCallback(
    (delta: number) => {
      const id = eicLive.current.eicId;
      const cur = ALL_RECORDS.findIndex((r) => (r.kind === 'eic' ? r.id === id : !id && r.index === live.current.trackIndex));
      const n = ALL_RECORDS.length;
      const next = ALL_RECORDS[(((cur + delta) % n) + n) % n]!;
      if (next.kind === 'eic') selectEic(next.id);
      else changeTrack(next.index);
    },
    [selectEic, changeTrack],
  );

  /** Go to a record and a date (used by the demo tour). */
  const goTo = useCallback(
    (trackId: string, date: string) => {
      const ti = TRACKS.findIndex((t) => t.id === trackId);
      if (ti < 0) return;
      const fi = Math.max(0, TRACKS[ti]!.dates.indexOf(date));
      // From an EIC record, always switch collections (the hidden GIBS player may already be on this record).
      if (TRACKS[ti]!.id === live.current.track.id && !eicLive.current.eicId) {
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
        setLat(r.lat);
        setLon(r.lon);
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
        case 'eic': {
          const frames = eic.loadedFrames;
          if (eicLive.current.eicId === a.record && frames && eic.getState().dsId === a.record) return eic.seekFrame(nearestFrame(frames, a.date));
          eicFirstFrame.current = a.date;
          return selectEic(a.record);
        }
        case 'play':
          if (eicLive.current.eicId) {
            if (eic.getState().status === 'ready' && eic.getState().dsId === eicLive.current.eicId) return void eic.play();
            eicPlayWhenLoaded.current = true;
            return;
          }
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
    [goTo, play, urgent, probeAt, stopTour, pause, player, eic, selectEic],
  );

  const toggleTour = useCallback(() => {
    if (touring) {
      stopTour();
      void pause('Demo tour stopped.');
      return;
    }
    setView('player');
    setTouring(true);
    // Later steps run from timers: unlock both audio engines inside this click.
    eic.unlockAudio();
    void player.engine.start().then(() => {
      if (!live.current.playing) void player.engine.stop();
    });
    if (live.current.narration === 'off') setNarration('changes');
    // The first steps run synchronously inside the click, so audio starts within the user gesture.
    for (const step of TOUR) {
      if (step.at === 0) runTourAction(step.action);
      else tourTimers.current.push(setTimeout(() => runTourAction(step.action), step.at * 1000));
    }
  }, [touring, stopTour, pause, runTourAction, eic, player]);

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

  const openPlayer = useCallback(() => setView('player'), []);
  const openRecord = useCallback(
    (i: number) => {
      changeTrack(i);
      setView('player');
    },
    [changeTrack],
  );
  const playTrackFromLibrary = useCallback(
    (i: number) => {
      changeTrack(i);
      setView('player');
      void play();
    },
    [changeTrack, play],
  );

  /** A playlist track started: pause whatever the live jukebox is playing. */
  const pauseForPlaylist = useCallback(() => {
    if (eic.getState().playing) eic.pause();
    if (live.current.playing) void pause('Paused while the playlist track plays.');
  }, [eic, pause]);

  // ----- EIC transport, explore and time -----
  const eicToggle = useCallback(async () => {
    try {
      setAudioError(null);
      if (eic.getState().playing) {
        eic.pause();
        urgent('Paused.');
      } else {
        setEicExploring(false);
        await eic.play();
      }
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : String(e));
    }
  }, [eic, urgent]);

  /** Explore a grid cell: pauses the sweep, plays the place, says where it is. Runs in a gesture. */
  const eicProbe = useCallback(
    (r: number, c: number) => {
      if (eic.getState().playing) eic.pause();
      setEicExploring(true);
      setEicCursor({ r, c });
      try {
        const text = eic.probe(r, c);
        if (!text) return;
        setEicCursorLabel(text);
        if (eicLive.current.narration !== 'off') urgent(text);
      } catch (e) {
        setAudioError(e instanceof Error ? e.message : String(e));
      }
    },
    [eic, urgent],
  );

  const eicSeek = useCallback(
    (i: number) => {
      eic.seekFrame(i);
      const f = eic.loadedFrames?.[eic.getState().frameIndex];
      if (f && eicLive.current.narration !== 'off') urgent(`${f.label}.`);
    },
    [eic, urgent],
  );

  const eicCursorRef = useRef(eicCursor);
  useLayoutEffect(() => {
    eicCursorRef.current = eicCursor;
  });
  const eicDispatch = useCallback(
    (a: Action) => {
      switch (a.type) {
        case 'togglePlay':
          return void eicToggle();
        case 'prevTrack':
          return stepRecord(-1);
        case 'nextTrack':
          return stepRecord(1);
        case 'prevFrame':
          return eicSeek(eic.getState().frameIndex - 1);
        case 'nextFrame':
          return eicSeek(eic.getState().frameIndex + 1);
        case 'toggleMute':
          setMuted((m) => {
            urgent(m ? 'Sound on.' : 'Muted.');
            return !m;
          });
          return;
        case 'help':
          return setHelpOpen(true);
        case 'focusMap':
          setView('player');
          if (eic.getState().playing) eic.pause();
          setEicExploring(true);
          mapRef.current?.focus();
          return;
        case 'describe':
          return urgent(eic.describeNow());
        case 'move': {
          // One grid cell per press (about 5.6°); Shift jumps four cells.
          const k = Math.abs(a.dx) + Math.abs(a.dy) > 1 ? 4 : 1;
          const { r, c } = eicCursorRef.current;
          const nc = (((c + Math.sign(a.dx) * k) % EIC_COLS) + EIC_COLS) % EIC_COLS;
          const nr = Math.min(EIC_ROWS - 1, Math.max(0, r + Math.sign(a.dy) * k));
          return eicProbe(nr, nc);
        }
      }
    },
    [eic, eicToggle, eicSeek, eicProbe, stepRecord, urgent],
  );

  const dispatch = useCallback(
    (a: Action) => {
      const l = live.current;
      if (eicLive.current.eicId) return eicDispatch(a);
      switch (a.type) {
        case 'togglePlay':
          return togglePlay();
        case 'prevTrack':
          return stepRecord(-1);
        case 'nextTrack':
          return stepRecord(1);
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
          setView('player');
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
    [togglePlay, stepRecord, seek, urgent, enterExplore, description, probeAt, eicDispatch],
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
  const noticeText = initial.notice && (initial.eic ? eicId === initial.eic : !eicId && trackIndex === initial.track) ? initial.notice : undefined;
  const offlineBannerText = data.offline
    ? `Offline mode: you are hearing the bundled copies of the NASA GIBS images${manifest ? ` (downloaded ${manifest.generated.slice(0, 10)})` : ''}.`
    : data.fallbackReason
      ? `Live NASA GIBS imagery is unavailable right now, so you are hearing bundled copies of the same NASA images${manifest ? ` (downloaded ${manifest.generated.slice(0, 10)})` : ''}.`
      : undefined;

  return (
    <AppShell
      view={view}
      onOpenPlayer={openPlayer}
      volume={volume}
      onVolume={setVolume}
      muted={muted}
      onMute={() => setMuted((m) => !m)}
      touring={touring}
      onTour={toggleTour}
      onHelp={() => setHelpOpen(true)}
    >
      {view === 'library' ? (
        <LibraryView
          eic={{
            records: EIC_DATASETS.map((d) => ({ id: d.id, title: d.title, subtitle: d.timeSpan, source: `NASA SVS #${d.svsId}`, hear: d.hearing.slice(0, 2).join(' ') })),
            current: eicId,
            playing: eicState.playing,
            onOpen: (id) => selectEic(id),
            onPlay: (id) => {
              if (eicId === id) {
                setView('player');
                void eicToggle();
                return;
              }
              selectEic(id);
              eicPlayWhenLoaded.current = true;
            },
          }}
          tracks={TRACKS}
          current={eicId ? -1 : trackIndex}
          playing={playing}
          onPlayTrack={playTrackFromLibrary}
          onExternalAudio={pauseForPlaylist}
          onPauseCurrent={() => (eicId ? (eic.pause(), urgent('Paused.')) : void pause())}
          onOpenRecord={openRecord}
        />
      ) : eicId ? (
        <EicPlayerView
          ref={mapRef}
          session={eic}
          state={eicState}
          dataset={EIC_DATASETS.find((d) => d.id === eicId)!}
          records={EIC_RECORDS}
          onSelectEic={selectEic}
          tracks={TRACKS}
          onSelectTrack={changeTrack}
          onBrowseAll={() => setView('library')}
          notice={noticeText}
          audioError={audioError}
          cursor={eicCursor}
          cursorLabel={eicCursorLabel}
          exploring={eicExploring}
          onProbe={eicProbe}
          onMapFocus={() => {
            if (eic.getState().playing) eic.pause();
            setEicExploring(true);
          }}
          onToggle={() => void eicToggle()}
          onPrevRecord={() => stepRecord(-1)}
          onNextRecord={() => stepRecord(1)}
          onMode={(m) => {
            eic.setPreferredMode(m);
            if (narration !== 'off') urgent(m === 'orchestra' ? 'Orchestra mode.' : 'Scientific mode.');
          }}
          volume={volume}
          onVolume={setVolume}
          muted={muted}
          onMute={() => setMuted((m) => !m)}
          narration={narration}
          onNarration={setNarration}
          onOpenHelp={() => setHelpOpen(true)}
          onExternalAudio={pauseForPlaylist}
        />
      ) : (
        <PlayerView
          eicRecords={EIC_RECORDS}
          onSelectEic={selectEic}
          tracks={TRACKS}
          trackIndex={trackIndex}
          track={track}
          onSelectTrack={changeTrack}
          onBrowseAll={() => setView('library')}
          notice={noticeText}
          offlineBanner={offlineBannerText}
          legendWarning={data.legendWarning}
          audioError={audioError}
          ref={mapRef}
          frame={frame}
          legend={data.legend}
          basemapUrl={BASEMAP}
          dateLabel={dateLabel}
          screenStatus={frame ? 'ready' : frameError ? 'error' : 'loading'}
          frameError={frameError}
          onRetry={data.retry}
          mode={mode}
          onMode={onMode}
          scan={scan}
          stepMs={stepMs}
          playing={playing}
          cursor={cursor}
          cursorLabel={cursorLabel}
          onProbe={(x, y, gesture) => void probeAt(x, y, gesture)}
          onMapFocus={enterExplore}
          frameIndex={frameIndex}
          loadedCount={data.loaded}
          dateLabels={dateLabels}
          onSeek={seek}
          timelapse={timelapse}
          onTimelapse={setTimelapse}
          nowValue={nowValue}
          lat={lat}
          lon={lon}
          liveBands={liveBands}
          canPlay={!!frame}
          onToggle={togglePlay}
          onPrevTrack={() => stepRecord(-1)}
          onNextTrack={() => stepRecord(1)}
          tempo={tempo}
          onTempo={setTempo}
          preset={preset}
          onPreset={(pr) => {
            setPreset(pr);
            setScale(PRESETS[pr].scale);
            setTempo(PRESETS[pr].tempo);
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
          hearing={hearing}
          onOpenHelp={() => setHelpOpen(true)}
          description={description}
        />
      )}
      <HowToListenSheet
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        track={track}
        frame={frame}
        legend={data.legend}
        legendWarning={data.legendWarning}
        manifest={manifest}
        eic={eicId ? { dataset: EIC_DATASETS.find((d) => d.id === eicId)!, mode: eicState.activeMode } : undefined}
      />
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="narrator">
        {message}
      </div>
    </AppShell>
  );
}

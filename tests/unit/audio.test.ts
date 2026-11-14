import { describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../../src/audio/engine';
import { JukeboxPlayer } from '../../src/audio/player';
import { blendSamples as blend } from '../../src/sonify/sample';
import { LookaheadScheduler } from '../../src/audio/scheduler';
import type { MappingConfig, NoteEvent } from '../../src/types';
import { fakeFactory, FakeParam, manualTimers } from './fakeAudio';
import { synthFrame } from './helpers';

const note = (over: Partial<NoteEvent> = {}): NoteEvent => ({
  band: 0,
  timbre: 'glass',
  midi: 60,
  freq: 261.6,
  offset: 0,
  duration: 0.3,
  velocity: 0.4,
  pan: 0,
  ...over,
});

describe('AudioEngine', () => {
  it('creates the AudioContext lazily, only on start(), and only once', async () => {
    const f = fakeFactory();
    const e = new AudioEngine(f.factory);
    expect(f.created()).toBe(0);
    expect(e.schedule([note()], 0)).toBe(0); // no context yet: nothing plays
    await e.start();
    await e.start();
    expect(f.created()).toBe(1);
    expect(f.ctx.resumes).toBe(1);
    expect(e.started).toBe(true);
  });

  it('schedules every timbre with valid envelopes', async () => {
    const f = fakeFactory();
    const e = new AudioEngine(f.factory);
    await e.start();
    const timbres: NoteEvent['timbre'][] = ['glass', 'reed', 'pluck', 'bell', 'noise', 'probe'];
    expect(e.schedule(timbres.map((timbre) => note({ timbre })), 1)).toBe(6);
    expect(f.ctx.oscillators.every((o) => o.startedAt >= 1 && o.stoppedAt > o.startedAt)).toBe(true);
  });

  it('never schedules in the past', async () => {
    const f = fakeFactory();
    const e = new AudioEngine(f.factory);
    await e.start();
    f.ctx.currentTime = 5;
    e.schedule([note()], 1);
    expect(f.ctx.oscillators[0].startedAt).toBe(5);
  });

  it('enforces a hard voice cap and keeps accents first', async () => {
    const f = fakeFactory();
    const e = new AudioEngine(f.factory, { maxVoices: 4 });
    await e.start();
    const n = e.schedule([...Array.from({ length: 10 }, () => note()), note({ band: -1, timbre: 'bell' })], 0);
    expect(n).toBe(4);
    expect(e.activeVoices()).toBe(4);
    expect(e.dropped).toBe(7);
    expect(f.ctx.oscillators.some((o) => o.frequency.value > 700)).toBe(true); // bell partials survived
    f.ctx.currentTime = 10; // all voices have ended
    expect(e.activeVoices()).toBe(0);
  });

  it('starts quiet, clamps volume, and mutes', async () => {
    const f = fakeFactory();
    const e = new AudioEngine(f.factory);
    expect(e.getMasterVolume()).toBeLessThanOrEqual(0.4);
    await e.start();
    e.setMasterVolume(7);
    expect(e.getMasterVolume()).toBe(1);
    e.setMasterVolume(-1);
    expect(e.getMasterVolume()).toBe(0);
    e.setMasterVolume(0.5);
    e.setMuted(true);
    expect(e.isMuted).toBe(true);
  });

  it('stop() suspends the context and fades the drone', async () => {
    const f = fakeFactory();
    const e = new AudioEngine(f.factory);
    await e.start();
    e.setDrone({ freq: 55, cutoff: 300, delta: 0 });
    await e.stop();
    expect(f.ctx.suspends).toBe(1);
    expect(e.started).toBe(false);
  });

  it('drone glides to new pitch', async () => {
    const f = fakeFactory();
    const e = new AudioEngine(f.factory);
    await e.start();
    e.setDrone({ freq: 55, cutoff: 300, delta: 0 });
    e.setDrone({ freq: 70, cutoff: 600, delta: 0.5 });
    const drone = f.ctx.oscillators.slice(0, 3);
    expect(drone[0].frequency.value).toBe(70);
    expect((drone[0].frequency as FakeParam).events.every((ev) => ev[0] === 'target')).toBe(true);
  });
});

describe('LookaheadScheduler', () => {
  it('schedules steps within the look-ahead window on the audio clock', () => {
    let now = 0;
    const steps: [number, number][] = [];
    const t = manualTimers();
    const s = new LookaheadScheduler({ clock: () => now, stepDuration: () => 0.05, onStep: (i, time) => steps.push([i, time]), timers: t.timers });
    s.start();
    // first tick at start: nextTime 0.05, window until 0.1 -> one step
    expect(steps).toHaveLength(1);
    expect(steps[0]![1]).toBeCloseTo(0.05);
    now = 0.1;
    t.fire();
    // window is [now, now + 0.1): steps at 0.05, 0.10, 0.15 -- not 0.20
    expect(steps.map((x) => x[0])).toEqual([0, 1, 2]);
    expect(steps.every(([, time]) => time < 0.2)).toBe(true);
    now = 0.15;
    t.fire();
    expect(steps.map((x) => x[0])).toEqual([0, 1, 2, 3]);
    expect(steps[3]![1]).toBeCloseTo(0.2);
  });

  it('stops cleanly', () => {
    const t = manualTimers();
    const s = new LookaheadScheduler({ clock: () => 0, stepDuration: () => 0.25, onStep: () => {}, timers: t.timers });
    s.start();
    expect(s.running).toBe(true);
    s.stop();
    expect(s.running).toBe(false);
    expect(t.active()).toBe(false);
  });

  it('skips ahead instead of bursting after the timer was throttled', () => {
    let now = 0;
    const times: number[] = [];
    const t = manualTimers();
    const s = new LookaheadScheduler({ clock: () => now, stepDuration: () => 0.1, onStep: (_i, time) => times.push(time), timers: t.timers });
    s.start();
    now = 30; // tab was in background for 30 s
    times.length = 0;
    t.fire();
    expect(times.length).toBeLessThanOrEqual(2);
    expect(times.every((x) => x >= 30)).toBe(true);
  });
});

describe('JukeboxPlayer', () => {
  const mapping: MappingConfig = {
    scale: 'pentatonic',
    rootMidi: 48,
    octaves: 2,
    range: [0, 25],
    outliers: { low: 0, high: 0.06 },
    noteDuration: 0.2,
    velocity: 0.3,
    panWidth: 1,
  };

  async function setup() {
    const f = fakeFactory();
    const engine = new AudioEngine(f.factory, { maxVoices: 64 });
    const t = manualTimers();
    const player = new JukeboxPlayer(engine, { steps: 4, timers: t.timers, crossfadeSteps: 2 });
    const a = synthFrame(40, 12, () => 5);
    const b = synthFrame(40, 12, () => 20);
    player.setFrames([a, b]);
    player.setMapping(mapping);
    player.setTempo(10);
    return { f, engine, t, player };
  }

  it('sweeps west -> east, pans accordingly, then advances frames (time-lapse)', async () => {
    const { f, t, player } = await setup();
    const steps: { col: number; frame: number; pan: number }[] = [];
    const frames: number[] = [];
    player.onStepScheduled((s) => steps.push({ col: s.column, frame: s.frameIndex, pan: s.notes[0]!.pan }));
    player.onFrameChange((i) => frames.push(i));
    await player.play();
    for (let i = 0; i < 20; i++) {
      f.ctx.currentTime += 0.1;
      t.fire();
    }
    expect(steps.slice(0, 4).map((s) => s.col)).toEqual([0, 1, 2, 3]);
    expect(steps[0]!.pan).toBeLessThan(0);
    expect(steps[3]!.pan).toBeGreaterThan(0);
    expect(frames[0]).toBe(1);
    expect(steps.some((s) => s.frame === 1)).toBe(true);
  });

  it('waits on the current frame (no crossfade replay) while the next frame is not loaded', async () => {
    const { f, t, player } = await setup();
    player.setFrames([synthFrame(40, 12, () => 5), undefined]);
    const frames: number[] = [];
    const steps: number[] = [];
    player.onFrameChange((i) => frames.push(i));
    player.onStepScheduled((s) => steps.push(s.frameIndex));
    await player.play();
    for (let i = 0; i < 20; i++) {
      f.ctx.currentTime += 0.1;
      t.fire();
    }
    expect(frames).toEqual([]);
    expect(steps.length).toBeGreaterThan(8);
    expect(steps.every((i) => i === 0)).toBe(true);
  });

  it('play() while playing keeps the scheduler timing (no restart)', async () => {
    const { f, t, player } = await setup();
    const times: number[] = [];
    player.onStepScheduled((s) => times.push(s.time));
    await player.play();
    f.ctx.currentTime = 0.3;
    t.fire();
    const before = [...times];
    await player.play();
    expect(times.slice(0, before.length)).toEqual(before);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeCloseTo(0.1);
  });

  it('a hover probe (no gesture) never starts audio; explore silences the drone', async () => {
    const { f, engine, player } = await setup();
    const r = await player.probeAt(10, 3, false);
    expect(r?.value).toBe(5);
    expect(f.created()).toBe(0);
    const setDrone = vi.spyOn(engine, 'setDrone');
    await player.play();
    expect(setDrone).toHaveBeenLastCalledWith(expect.objectContaining({ freq: expect.any(Number) }));
    player.holdScan();
    expect(setDrone).toHaveBeenLastCalledWith(null);
    expect(player.playing).toBe(false);
    // while exploring, frame changes must not bring the drone back
    player.seekFrame(1);
    expect(setDrone).toHaveBeenLastCalledWith(null);
  });

  it('drains visual steps in audio-clock order', async () => {
    const { f, t, player } = await setup();
    await player.play();
    f.ctx.currentTime = 0.5;
    t.fire();
    const due = player.drainVisual(0.3);
    expect(due.length).toBeGreaterThan(0);
    expect(due.every((d) => d.time <= 0.3)).toBe(true);
    expect(player.drainVisual(0.3)).toEqual([]);
  });

  it('probeAt starts audio and samples the cursor', async () => {
    const { f, player } = await setup();
    const r = await player.probeAt(20, 6);
    expect(f.ctx.state).toBe('running');
    expect(r?.value).toBe(5);
    expect(r?.lat).toBeCloseTo(-7.5);
  });

  it('pause stops scheduling and suspends audio', async () => {
    const { f, t, player } = await setup();
    await player.play();
    await player.pause();
    expect(player.playing).toBe(false);
    expect(t.active()).toBe(false);
    expect(f.ctx.state).toBe('suspended');
  });

  it('blend crossfades values and handles no data', () => {
    const s = (v: number | null) => ({ x: 0, lon: 0, bands: [{ lat: [0, 0] as [number, number], value: v }], meanValue: v });
    expect(blend(s(0), s(10), 0.25).bands[0]!.value).toBe(2.5);
    expect(blend(s(null), s(10), 0.25).bands[0]!.value).toBeNull();
    expect(blend(s(null), s(10), 0.75).bands[0]!.value).toBe(10);
  });
});

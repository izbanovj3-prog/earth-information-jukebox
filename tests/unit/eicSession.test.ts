import { afterEach, describe, expect, it, vi } from 'vitest';
import { EicSession, frameDescription, type EicDeps } from '../../src/eic/session';
import { instrumentsFor } from '../../src/eic/instruments';
import { DATASETS } from '../../src/eic/vendor/datasets';
import type { SampleBank, SampleManifest } from '../../src/eic/vendor/orchestra';
import { bakedFrames } from './eicHelpers';
import { fakeFactory } from './fakeAudio';

const nightlights = DATASETS.find((d) => d.id === 'nightlights')!;

function memoryStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), map: m };
}

/** A sample load we can resolve or reject by hand. */
function deferredSamples() {
  let resolve!: (b: SampleBank) => void;
  let reject!: (e: Error) => void;
  const calls: string[][] = [];
  const loadSamples: EicDeps['loadSamples'] = (_ctx, onProgress, only) => {
    calls.push(only);
    onProgress(0, only.length, 0);
    return new Promise<SampleBank>((res, rej) => {
      resolve = res;
      reject = rej;
    });
  };
  const bankFor = (ids: string[], ctx: { createBuffer: (c: number, l: number, r: number) => unknown }): SampleBank =>
    Object.fromEntries(ids.map((id) => [id, { pitched: true, zones: [{ midi: 60, buffer: ctx.createBuffer(1, 100, 8000) as AudioBuffer }] }]));
  return { loadSamples, calls, resolve: (b: SampleBank) => resolve(b), reject: (e: Error) => reject(e), bankFor };
}

const manifest: SampleManifest = { source: 'test', sampleRate: 32000, instruments: {} };

function setup(storage = memoryStorage()) {
  const audio = fakeFactory();
  const samples = deferredSamples();
  const session = new EicSession('nightlights', {
    createContext: audio.factory,
    loadDataset: async (ds) => bakedFrames(ds.id),
    loadSamples: samples.loadSamples,
    loadManifest: async () => manifest,
    storage,
  });
  const said: string[] = [];
  session.onNarrate = (t) => said.push(t);
  return { session, audio, samples, said, storage };
}

let active: EicSession | null = null;
afterEach(() => {
  active?.pause();
  active = null;
});

describe('EicSession', () => {
  it('loads frames without creating an AudioContext', async () => {
    const { session, audio } = setup();
    await session.select('nightlights');
    expect(session.getState().status).toBe('ready');
    expect(session.getState().frameCount).toBe(12);
    expect(audio.created()).toBe(0);
  });

  it('starts at once in Scientific, loads only the needed instruments, then the orchestra takes over', async () => {
    const { session, audio, samples, said } = setup();
    active = session;
    await session.select('nightlights');
    await session.play();
    expect(audio.created()).toBe(1);
    expect(session.getState()).toMatchObject({ playing: true, activeMode: 'science', preferredMode: 'orchestra' });
    await vi.waitFor(() => expect(samples.calls).toHaveLength(1));
    const need = instrumentsFor(bakedFrames('nightlights'), nightlights);
    expect(samples.calls[0]).toEqual(need);
    expect(need.length).toBeLessThan(19);
    expect(session.getState().orchestra.status).toBe('loading');
    expect(said[0]).toMatch(/Scientific mode while the orchestra loads/);

    samples.resolve(samples.bankFor(need, audio.ctx));
    await vi.waitFor(() => expect(session.getState().activeMode).toBe('orchestra'));
    expect(session.getState()).toMatchObject({ playing: true, orchestra: { status: 'ready' } });
    expect(said.at(-1)).toMatch(/orchestra has loaded/);
  });

  it('remembers Scientific as the choice and then never downloads samples', async () => {
    const storage = memoryStorage();
    const first = setup(storage);
    first.session.setPreferredMode('science');
    expect(storage.map.get('eic.soundMode')).toBe('science');

    const { session, samples } = setup(storage);
    active = session;
    expect(session.getState().preferredMode).toBe('science');
    await session.select('nightlights');
    await session.play();
    await new Promise((r) => setTimeout(r, 20));
    expect(samples.calls).toHaveLength(0);
    expect(session.getState().activeMode).toBe('science');
  });

  it('keeps playing in Scientific when the orchestra fails to load', async () => {
    const { session, samples, said } = setup();
    active = session;
    await session.select('nightlights');
    await session.play();
    await vi.waitFor(() => expect(samples.calls).toHaveLength(1));
    samples.reject(new Error('offline'));
    await vi.waitFor(() => expect(session.getState().orchestra.status).toBe('error'));
    expect(session.getState()).toMatchObject({ playing: true, activeMode: 'science' });
    expect(said.at(-1)).toMatch(/Scientific mode keeps playing/);
  });

  it('pause then play resumes in the same AudioContext; seek wraps around', async () => {
    const { session, audio } = setup(memoryStorage({ 'eic.soundMode': 'science' }));
    active = session;
    await session.select('nightlights', 3);
    expect(session.getState().frameIndex).toBe(3);
    await session.play();
    session.pause();
    expect(session.getState().playing).toBe(false);
    session.seekFrame(-1);
    expect(session.getState().frameIndex).toBe(11);
    await session.play();
    expect(audio.created()).toBe(1);
  });

  it('explore returns a spoken description with coordinates and region', async () => {
    const { session } = setup(memoryStorage({ 'eic.soundMode': 'science' }));
    await session.select('nightlights');
    const text = session.probe(10, 18);
    expect(text).toMatch(/°[NS]|equator/);
    expect(text).toMatch(/°[WE]|0°/);
  });

  it('describes a frame with its metric and change from the previous frame', () => {
    const frames = bakedFrames('nightlights');
    const text = frameDescription(nightlights, frames[11]!, frames[10]!);
    expect(text).toMatch(/^Global night-light brightness: \d/);
    expect(text).toMatch(/from 2022/);
  });
});

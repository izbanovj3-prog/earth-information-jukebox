import { describe, expect, it } from 'vitest';
import { buildMapping, droneParams, extremeOf, mapProbe, mapToNotes, PRESETS } from '../../src/sonify/mapping';
import { midiToFreq, quantize, scaleNotes } from '../../src/sonify/scales';
import { droneMetricOf, frameStats, probe, sampleColumn } from '../../src/sonify/sample';
import type { ColumnSample, MappingConfig } from '../../src/types';
import { synthFrame } from './helpers';

const mapping: MappingConfig = {
  scale: 'pentatonic',
  rootMidi: 48,
  octaves: 2,
  range: [0, 25],
  outliers: { low: 0.06, high: 0.06 },
  noteDuration: 0.3,
  velocity: 0.4,
  panWidth: 1,
};

describe('scales', () => {
  it('builds pentatonic notes across octaves with top tonic', () => {
    expect(scaleNotes('pentatonic', 48, 1)).toEqual([48, 50, 52, 55, 57, 60]);
  });
  it('quantize is monotonic and clamped', () => {
    let prev = -Infinity;
    for (let n = -0.2; n <= 1.2; n += 0.01) {
      const m = quantize(n, 'pentatonic', 48, 2);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
    expect(quantize(-5, 'chromatic', 48, 1)).toBe(48);
    expect(quantize(5, 'chromatic', 48, 1)).toBe(60);
    expect(quantize(NaN, 'minor', 50, 1)).toBe(50);
  });
  it('only yields notes in the scale', () => {
    const allowed = new Set(scaleNotes('minor', 50, 2));
    for (let n = 0; n <= 1; n += 0.05) expect(allowed.has(quantize(n, 'minor', 50, 2))).toBe(true);
  });
  it('converts MIDI to Hz', () => {
    expect(midiToFreq(69)).toBe(440);
    expect(midiToFreq(57)).toBeCloseTo(220);
  });
});

describe('sampleColumn', () => {
  // 3 bands of 4 rows each; north = 20, tropics = 10, south = no data
  const frame = synthFrame(8, 12, (_x, y) => (y < 4 ? 20 : y < 8 ? 10 : null));

  it('splits into north/tropics/south bands with lat edges', () => {
    const s = sampleColumn(frame, 3, 3);
    expect(s.bands.map((b) => b.value)).toEqual([20, 10, null]);
    expect(s.bands[0]!.lat).toEqual([30, 90]);
    expect(s.bands[2]!.lat).toEqual([-90, -30]);
    expect(s.meanValue).toBe(15);
  });
  it('reports longitude of the column centre and clamps x', () => {
    expect(sampleColumn(frame, 0, 3).lon).toBeCloseTo(-157.5);
    expect(sampleColumn(frame, 99, 3).x).toBe(7);
  });
  it('averages a strip and exposes min/max for accents', () => {
    const f = synthFrame(6, 3, (x) => x * 5);
    const s = sampleColumn(f, 2, 1, 1);
    expect(s.bands[0]!.value).toBe(10);
    expect(s.bands[0]!.min).toBe(5);
    expect(s.bands[0]!.max).toBe(15);
  });
  it('probe averages a neighbourhood and returns null over no data', () => {
    expect(probe(frame, 3, 1, 1)).toBe(20);
    expect(probe(frame, 3, 10, 1)).toBeNull();
  });
});

describe('frameStats', () => {
  it('area-weights, finds extremes and band coverage', () => {
    const f = synthFrame(4, 6, (x, y) => (y === 0 && x === 0 ? 25 : y === 5 ? null : 5));
    const s = frameStats(f);
    expect(s.max?.value).toBe(25);
    expect(s.min?.value).toBe(5);
    expect(s.validFraction).toBeGreaterThan(0.8);
    expect(s.validFraction).toBeLessThan(1);
    expect(s.bandCoverage).toHaveLength(3);
    expect(droneMetricOf(s, 'northCoverage')).toBe(s.bandCoverage[0]);
    expect(droneMetricOf(s, 'mean')).toBe(s.mean);
  });
});

describe('mapToNotes', () => {
  const sample = (values: (number | null)[], lon = 0, extras: Partial<ColumnSample['bands'][number]>[] = []): ColumnSample => ({
    x: 0,
    lon,
    bands: values.map((value, i) => ({ lat: [0, 0] as [number, number], value, ...extras[i] })),
    meanValue: null,
  });

  it('higher value -> higher pitch, same mapping for every band', () => {
    const notes = mapToNotes(sample([20, 10, 5]), mapping);
    expect(notes).toHaveLength(3);
    expect(notes[0]!.midi).toBeGreaterThan(notes[1]!.midi);
    expect(notes[1]!.midi).toBeGreaterThan(notes[2]!.midi);
    const same = mapToNotes(sample([10, 10, 10]), mapping);
    expect(new Set(same.map((n) => n.midi)).size).toBe(1);
  });

  it('gives each band its own timbre and a stagger', () => {
    const notes = mapToNotes(sample([10, 10, 10]), mapping);
    expect(notes.map((n) => n.timbre)).toEqual(['glass', 'reed', 'pluck']);
    expect(notes[0]!.offset).toBe(0);
    expect(notes[2]!.offset).toBeGreaterThan(notes[1]!.offset);
  });

  it('rests on no data', () => {
    const notes = mapToNotes(sample([null, 12, null]), mapping);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.band).toBe(1);
    expect(mapToNotes(sample([null, null, null]), mapping)).toEqual([]);
  });

  it('pans west to the left and east to the right', () => {
    expect(mapToNotes(sample([10], -180), mapping)[0]!.pan).toBe(-1);
    expect(mapToNotes(sample([10], 90), mapping)[0]!.pan).toBe(0.5);
    expect(mapToNotes(sample([10], 90), { ...mapping, panWidth: 0.5 })[0]!.pan).toBe(0.25);
  });

  it('adds one bell accent for an extreme pixel, even when the band mean is moderate', () => {
    const notes = mapToNotes(sample([12, 12], 0, [{ max: 25 }, { max: 24.5 }]), mapping);
    const accents = notes.filter((n) => n.band === -1);
    expect(accents).toHaveLength(1);
    expect(accents[0]!.timbre).toBe('bell');
    expect(notes[0]!.accent).toBe('high');
  });

  it('adds a noise accent for a low extreme and respects disabled outliers', () => {
    const low = mapToNotes(sample([0.5]), mapping).filter((n) => n.band === -1);
    expect(low[0]?.timbre).toBe('noise');
    const off = mapToNotes(sample([0.5, 25]), { ...mapping, outliers: { low: 0, high: 0 } });
    expect(off.some((n) => n.band === -1)).toBe(false);
  });

  it('extremeOf handles each side independently', () => {
    expect(extremeOf(0.99, { low: 0, high: 0.05 })).toBe('high');
    expect(extremeOf(0.01, { low: 0, high: 0.05 })).toBeUndefined();
    expect(extremeOf(0.01, { low: 0.05, high: 0 })).toBe('low');
  });

  it('probe uses the probe timbre', () => {
    const n = mapProbe(12, 45, mapping);
    expect(n[0]!.timbre).toBe('probe');
    expect(mapProbe(null, 0, mapping)).toEqual([]);
  });
});

describe('droneParams', () => {
  it('rises with the metric, clamps, and is neutral without data', () => {
    const base = droneParams(10, 10, 1);
    const up = droneParams(10.5, 10, 1);
    const huge = droneParams(100, 10, 1);
    expect(base.delta).toBe(0);
    expect(up.freq).toBeGreaterThan(base.freq);
    expect(up.cutoff).toBeGreaterThan(base.cutoff);
    expect(huge.delta).toBe(1);
    expect(droneParams(null, 10, 1).delta).toBe(0);
  });
});

describe('presets', () => {
  it('Calm is gentler and slower than Dramatic', () => {
    expect(PRESETS.calm.tempo).toBeLessThan(PRESETS.dramatic.tempo);
    expect(PRESETS.calm.velocity).toBeLessThan(PRESETS.dramatic.velocity);
    const m = buildMapping(PRESETS.calm, [0, 1], { scale: 'chromatic' });
    expect(m.scale).toBe('chromatic');
    expect(m.octaves).toBe(PRESETS.calm.octaves);
  });
});

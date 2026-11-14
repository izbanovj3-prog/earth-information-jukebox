import { describe, expect, it } from 'vitest';
import { getTrack } from '../../src/data/catalog';
import { describeColumn, describeFrame, formatLat, formatLon, levelWord, Throttle, trendWord } from '../../src/a11y/narration';
import { frameStats } from '../../src/sonify/sample';
import type { ColumnSample } from '../../src/types';
import { synthFrame } from './helpers';

const temp = getTrack('air-temperature'); // range 214..316 K, low=cold, high=warm

describe('coordinates', () => {
  it('formats longitude and latitude', () => {
    expect(formatLon(-40.2)).toBe('40°W');
    expect(formatLon(120)).toBe('120°E');
    expect(formatLon(0.3)).toBe('0°');
    expect(formatLat(-62)).toBe('62°S');
    expect(formatLat(45)).toBe('45°N');
  });
});

describe('words', () => {
  it('maps values to five levels with track words', () => {
    expect(levelWord(temp, 214)).toBe('very cold');
    expect(levelWord(temp, 265)).toBe('moderate');
    expect(levelWord(temp, 316)).toBe('very warm');
    expect(levelWord(temp, null)).toBe('no data');
  });
  it('detects trends', () => {
    expect(trendWord(temp, 250, 270)).toBe('rising');
    expect(trendWord(temp, 270, 250)).toBe('falling');
    expect(trendWord(temp, 270, 270.5)).toBe('steady');
    expect(trendWord(temp, undefined, 270)).toBe('');
  });
});

describe('describeColumn', () => {
  const s = (vals: (number | null)[], lon: number): ColumnSample => ({
    x: 0,
    lon,
    bands: vals.map((value) => ({ lat: [0, 0] as [number, number], value })),
    meanValue: null,
  });
  it('describes each band, trend and accents', () => {
    const text = describeColumn(temp, s([290, 300, null], -40), s([280, 300, null], -45), [
      { band: 1, timbre: 'reed', midi: 60, freq: 1, offset: 0, duration: 1, velocity: 1, pan: 0, accent: 'high' },
    ]);
    expect(text).toBe('40°W. North: warm, rising. Tropics: very warm, steady. South: no data. Bell: extreme warm in the tropics.');
  });
});

describe('describeFrame', () => {
  it('summarises mean, change, extremes, coverage and bands', () => {
    const track = { ...temp, range: [0, 25] as [number, number], display: { unit: 'u', offset: 0, scale: 1, decimals: 1 } };
    const f1 = synthFrame(8, 6, () => 10);
    const f2 = synthFrame(8, 6, (x, y) => (y === 5 ? null : x === 0 && y === 0 ? 25 : 12));
    const text = describeFrame(track, '2024-07-01', frameStats(f2), { date: '1980-07-01', stats: frameStats(f1) });
    expect(text).toContain('July 2024');
    expect(text).toMatch(/Up \d+\.\d\u00a0u compared with July 1980/);
    expect(text).toContain('Highest: 25.0\u00a0u');
    expect(text).toMatch(/Data covers \d+% of the globe/);
    expect(text).toContain('By latitude band: North');
  });
});

describe('Throttle', () => {
  it('allows one message per interval unless urgent', () => {
    let t = 0;
    const th = new Throttle(1000, () => t);
    expect(th.allow()).toBe(true);
    t = 500;
    expect(th.allow()).toBe(false);
    expect(th.allow(true)).toBe(true);
    t = 1600;
    expect(th.allow()).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { TRACKS } from '../../src/data/catalog';
import { TOUR, TOUR_SECONDS } from '../../src/ui/tour';
import { bakedFrames } from './eicHelpers';

describe('demo tour', () => {
  it('opens on an Earth Information Center record and plays at once (inside the click)', () => {
    expect(TOUR[0]!.action).toMatchObject({ type: 'eic', record: 'nightlights' });
    expect(TOUR.some((s) => s.at === 0 && s.action.type === 'play')).toBe(true);
  });
  it('lasts about 90 seconds and ends with an end action', () => {
    expect(TOUR_SECONDS).toBeGreaterThanOrEqual(80);
    expect(TOUR_SECONDS).toBeLessThanOrEqual(100);
    expect(TOUR[TOUR.length - 1]!.action.type).toBe('end');
  });
  it('is in time order', () => {
    for (let i = 1; i < TOUR.length; i++) expect(TOUR[i]!.at).toBeGreaterThanOrEqual(TOUR[i - 1]!.at);
  });
  it('only visits records and dates that exist', () => {
    for (const { action } of TOUR) {
      if (action.type === 'eic') {
        expect(bakedFrames(action.record).map((f) => f.date), action.record).toContain(action.date);
        continue;
      }
      if (action.type !== 'goto') continue;
      const t = TRACKS.find((tr) => tr.id === action.track);
      expect(t, action.track).toBeDefined();
      expect(t!.dates).toContain(action.date);
    }
  });
  it('explores valid coordinates', () => {
    for (const { action } of TOUR) {
      if (action.type !== 'explore') continue;
      expect(Math.abs(action.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(action.lon)).toBeLessThanOrEqual(180);
    }
  });
});

import type { Frame, Legend } from '../../src/types';

/** Legend mapping grey levels 0..250 (step 10) to values 0..25; magenta = no data. */
export function greyLegend(): Legend {
  const entries: Legend['entries'] = [{ rgb: [255, 0, 255], value: null }];
  for (let i = 0; i <= 25; i++) entries.push({ rgb: [i * 10, i * 10, i * 10], value: i });
  return { title: 'Test', units: 'u', entries, min: 0, max: 25, calibrated: true };
}

/** Deterministic synthetic frame: value(x, y) -> grey level index 0..25 or null (no data). */
export function synthFrame(width: number, height: number, value: (x: number, y: number) => number | null): Frame {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = value(x, y);
      if (v === null) {
        rgba.set([0, 0, 0, 0], i);
      } else {
        const g = Math.round(v) * 10;
        rgba.set([g, g, g, 255], i);
      }
    }
  }
  return {
    trackId: 'test',
    date: '2000-01-01',
    width,
    height,
    rgba,
    legend: greyLegend(),
    source: { provider: 'test', layerId: 'TEST', layerTitle: 'Test', date: '2000-01-01', url: 'about:blank', mode: 'bundled' },
  };
}

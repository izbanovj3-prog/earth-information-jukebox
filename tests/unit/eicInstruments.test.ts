import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { instrumentsFor } from '../../src/eic/instruments';
import { DATASETS } from '../../src/eic/vendor/datasets';
import { bakedFrames, eicRoot as root } from './eicHelpers';

const manifest = JSON.parse(readFileSync(new URL('samples/manifest.json', root), 'utf8')) as {
  instruments: Record<string, { zones: { file: string }[] }>;
};
const bytesOf = (ids: string[]) =>
  ids.reduce((s, id) => s + manifest.instruments[id]!.zones.reduce((t, z) => t + statSync(new URL(`samples/${z.file}`, root)).size, 0), 0);
const ALL = Object.keys(manifest.instruments);

describe('instrumentsFor (orchestra dry run)', () => {
  for (const ds of DATASETS) {
    it(`${ds.id}: needs a real subset of the 19 instruments, all present in the manifest`, () => {
      const need = instrumentsFor(bakedFrames(ds.id), ds);
      expect(need.length).toBeGreaterThan(3);
      expect(need.length).toBeLessThan(ALL.length);
      for (const i of need) expect(ALL).toContain(i);
      // the pulse is always there
      expect(need).toEqual(expect.arrayContaining(['bass', 'kick', 'timpani']));
      const mb = bytesOf(need) / 1e6;
      console.info(`${ds.id}: ${need.length} instruments, ${mb.toFixed(1)} MB of ${(bytesOf(ALL) / 1e6).toFixed(1)} MB [${need.join(', ')}]`);
      expect(mb).toBeLessThan(bytesOf(ALL) / 1e6);
    });
  }
});

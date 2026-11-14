import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createValueLookup,
  luminanceLegend,
  luminanceLookup,
  parseColormap,
  parseInterval,
} from '../../src/data/colormap';

const read = (name: string) => readFileSync(new URL(`../../public/frames/colormaps/${name}`, import.meta.url), 'utf8');

describe('parseInterval', () => {
  it('uses the midpoint of a finite interval', () => {
    expect(parseInterval('[220,221)')).toEqual({ lo: 220, hi: 221, value: 220.5 });
  });
  it('uses the finite bound of an open-ended interval', () => {
    expect(parseInterval('[-INF,220)').value).toBe(220);
    expect(parseInterval('[310,+INF)').value).toBe(310);
  });
  it('accepts a single value', () => {
    expect(parseInterval('[100]')).toEqual({ lo: 100, hi: 100, value: 100 });
  });
  it('rejects garbage', () => {
    expect(() => parseInterval('nope')).toThrow();
    expect(() => parseInterval('[a,b)')).toThrow();
  });
});

describe('parseColormap (real GIBS colormaps)', () => {
  it('parses MERRA-2 air temperature with units and range', () => {
    const legend = parseColormap(read('MERRA2_2m_Air_Temperature_Monthly.xml'));
    expect(legend.title).toBe('Air Temperature');
    expect(legend.units).toBe('K');
    expect(legend.calibrated).toBe(true);
    expect(legend.min).toBe(220);
    expect(legend.max).toBe(310);
    expect(legend.entries.filter((e) => e.value === null)).toHaveLength(1);
    expect(legend.entries.length).toBe(183);
  });

  it('treats transparent entries as no data (NDVI water/bare)', () => {
    const legend = parseColormap(read('MODIS_L3_NDVI.xml'));
    const lookup = createValueLookup(legend);
    // rgb 225,225,225 is transparent="true" in the NDVI colormap
    expect(lookup(225, 225, 225, 255)).toBeNull();
    expect(lookup(0, 24, 0, 255)).toBeCloseTo(0.9851, 3);
  });

  it('decodes XML entities in units', () => {
    const legend = parseColormap(read('GHRSST_Sea_Surface_Temperature.xml'));
    expect(legend.units).toBe('°C');
  });

  it('throws on a colormap without data entries', () => {
    expect(() => parseColormap('<ColorMaps></ColorMaps>')).toThrow();
    expect(() =>
      parseColormap('<ColorMaps><ColorMap title="No Data"><Entries><ColorMapEntry rgb="0,0,0" nodata="true"/></Entries></ColorMap></ColorMaps>'),
    ).toThrow();
  });
});

describe('createValueLookup', () => {
  const xml = `<ColorMaps>
    <ColorMap title="No Data"><Entries><ColorMapEntry rgb="255,0,255" transparent="true" nodata="true"/></Entries></ColorMap>
    <ColorMap title="T" units="K"><Entries>
      <ColorMapEntry rgb="0,0,255" transparent="false" value="[-INF,10)"/>
      <ColorMapEntry rgb="0,255,0" transparent="false" value="[10,20)"/>
      <ColorMapEntry rgb="255,0,0" transparent="false" value="[20,+INF)"/>
    </Entries></ColorMap></ColorMaps>`;
  const legend = parseColormap(xml);
  const lookup = createValueLookup(legend);

  it('maps exact colours to values', () => {
    expect(lookup(0, 0, 255, 255)).toBe(10);
    expect(lookup(0, 255, 0, 255)).toBe(15);
    expect(lookup(255, 0, 0, 255)).toBe(20);
  });
  it('maps near colours to the nearest entry', () => {
    expect(lookup(4, 250, 3, 255)).toBe(15);
  });
  it('returns null for far colours, no-data colour and transparent pixels', () => {
    expect(lookup(128, 128, 128, 255)).toBeNull();
    expect(lookup(255, 0, 255, 255)).toBeNull();
    expect(lookup(0, 255, 0, 0)).toBeNull();
  });
});

describe('luminance fallback', () => {
  it('is flagged as not calibrated and maps to 0..1', () => {
    expect(luminanceLegend().calibrated).toBe(false);
    expect(luminanceLookup(255, 255, 255, 255)).toBeCloseTo(1);
    expect(luminanceLookup(0, 0, 0, 255)).toBe(0);
    expect(luminanceLookup(10, 10, 10, 0)).toBeNull();
  });
});

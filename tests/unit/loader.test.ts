import { describe, expect, it, vi } from 'vitest';
import { getTrack } from '../../src/data/catalog';
import { FetchError, fetchRead, readImage, readText, resolveWmsBase, wmsUrl } from '../../src/data/gibs';
import { pngDimensions } from '../../src/data/wms';
import { loadFrame, loadLegend, validateManifest, type DecodedImage } from '../../src/data/loader';
import { latToY, lonToX, regionMean, valueGrid, xToLon, yToLat } from '../../src/data/values';
import { greyLegend, synthFrame } from './helpers';

const track = getTrack('air-temperature');
const manifest = {
  generated: 'x',
  provider: 'NASA GIBS',
  width: 720,
  height: 360,
  tracks: {
    'air-temperature': {
      layerId: track.layerId,
      colormap: 'frames/colormaps/x.xml',
      colormapSource: 'https://example/x.xml',
      frames: [{ date: '1980-07-01', file: 'frames/air-temperature/1980-07-01.png', sourceUrl: 'https://gibs/src', bytes: 1, dataPct: 100 }],
    },
  },
};

/** Minimal byte buffer with a valid PNG signature + IHDR declaring w x h (enough for header checks). */
function pngHeader(w = 720, h = 360, size = 64): Uint8Array {
  const b = new Uint8Array(size);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}
const png = (w = 720, h = 360) => new Response(pngHeader(w, h) as BodyInit, { headers: { 'content-type': 'image/png' } });
const okImage: DecodedImage = { width: 720, height: 360, rgba: new Uint8ClampedArray(720 * 360 * 4) };

function router(routes: Record<string, () => Response | Promise<Response>>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    for (const [k, fn] of Object.entries(routes)) if (url.includes(k)) return fn();
    return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
}

describe('wmsUrl', () => {
  it('builds an EPSG:4326 GetMap request with TIME', () => {
    const u = new URL(wmsUrl('MERRA2_2m_Air_Temperature_Monthly', '1980-07-01'));
    expect(u.hostname).toBe('gibs.earthdata.nasa.gov');
    expect(u.searchParams.get('LAYERS')).toBe('MERRA2_2m_Air_Temperature_Monthly');
    expect(u.searchParams.get('TIME')).toBe('1980-07-01');
    expect(u.searchParams.get('CRS')).toBe('EPSG:4326');
    expect(u.searchParams.get('WIDTH')).toBe('720');
  });
  it('rejects unsafe layer ids and dates', () => {
    expect(() => wmsUrl('a&b=c', '1980-07-01')).toThrow();
    expect(() => wmsUrl('A', 'yesterday')).toThrow();
  });
});

describe('fetch validation', () => {
  it('times out with AbortController before headers', async () => {
    const slow = ((_: unknown, init?: RequestInit) =>
      new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch;
    await expect(fetchRead('https://x', async (r) => r, { fetchImpl: slow, timeoutMs: 20 })).rejects.toMatchObject({ kind: 'timeout' });
  });
  it('times out when the body stalls after the headers', async () => {
    const stalled = ((_: unknown, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new Uint8Array([1, 2, 3]));
          init?.signal?.addEventListener('abort', () => c.error(new Error('aborted')));
        },
      });
      return Promise.resolve(new Response(body, { headers: { 'content-type': 'text/plain' } }));
    }) as typeof fetch;
    await expect(fetchRead('https://x', (r) => readText(r), { fetchImpl: stalled, timeoutMs: 30 })).rejects.toMatchObject({ kind: 'timeout' });
  });
  it('rejects HTTP errors', async () => {
    const f = router({ x: () => new Response('', { status: 500 }) });
    await expect(fetchRead('https://x', async (r) => r, { fetchImpl: f })).rejects.toMatchObject({ kind: 'http' });
  });
  it('stops reading a body as soon as it exceeds the limit (no Content-Length)', async () => {
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(c) {
        pulled++;
        c.enqueue(new Uint8Array(1000));
      },
    });
    await expect(readText(new Response(endless), 5000)).rejects.toMatchObject({ kind: 'size' });
    expect(pulled).toBeLessThan(20);
  });
  it('rejects a PNG whose header declares the wrong size, before decoding', async () => {
    await expect(readImage(png(30000, 30000))).rejects.toMatchObject({ kind: 'size' });
    await expect(readImage(new Response(new Uint8Array(64), { headers: { 'content-type': 'image/png' } }))).rejects.toMatchObject({ kind: 'type' });
    expect(pngDimensions(pngHeader(720, 360))).toEqual({ width: 720, height: 360 });
  });
  it('accepts only https overrides for the WMS endpoint', () => {
    expect(resolveWmsBase(undefined)).toContain('https://gibs.earthdata.nasa.gov');
    expect(resolveWmsBase('https://mirror.example/wms.cgi')).toBe('https://mirror.example/wms.cgi');
    expect(resolveWmsBase('http://evil.example/wms')).toContain('https://gibs.earthdata.nasa.gov');
    expect(resolveWmsBase('javascript:alert(1)')).toContain('https://gibs.earthdata.nasa.gov');
  });
  it('validates the manifest structure', () => {
    expect(() => validateManifest({ tracks: { a: { layerId: 'L', colormap: 'c', colormapSource: 's', frames: [{ date: 'd', file: '../x', sourceUrl: 'u' }] } } })).toThrow();
    expect(() => validateManifest({})).toThrow();
    expect(validateManifest(manifest).tracks['air-temperature']).toBeDefined();
  });
  it('rejects non-image content (e.g. a WMS XML error)', async () => {
    const res = new Response('<ServiceException/>', { headers: { 'content-type': 'text/xml' } });
    await expect(readImage(res)).rejects.toBeInstanceOf(FetchError);
  });
  it('rejects oversized images', async () => {
    await expect(readImage(png(), 50)).rejects.toMatchObject({ kind: 'size' });
  });
});

describe('loadFrame', () => {
  const legend = greyLegend();

  it('uses live GIBS when it works', async () => {
    const f = router({ 'gibs.earthdata.nasa.gov': () => png(), 'manifest.json': () => Response.json(manifest) });
    const r = await loadFrame(track, '1980-07-01', legend, { fetchImpl: f, decode: async () => okImage, baseUrl: '/' });
    expect(r.frame.source.mode).toBe('live');
    expect(r.fallbackReason).toBeUndefined();
    expect(r.frame.source.url).toContain('gibs.earthdata.nasa.gov');
  });

  it('falls back to the bundled frame when GIBS fails, with a reason', async () => {
    const f = router({
      'gibs.earthdata.nasa.gov': () => {
        throw new TypeError('Failed to fetch');
      },
      'manifest.json': () => Response.json(manifest),
      'frames/air-temperature/': () => png(),
    });
    const r = await loadFrame(track, '1980-07-01', legend, { fetchImpl: f, decode: async () => okImage, baseUrl: '/' });
    expect(r.frame.source.mode).toBe('bundled');
    expect(r.frame.source.url).toBe('https://gibs/src');
    expect(r.fallbackReason).toMatch(/Network error/);
  });

  it('falls back when GIBS returns an image of the wrong size', async () => {
    let calls = 0;
    const f = router({
      'gibs.earthdata.nasa.gov': () => png(),
      'manifest.json': () => Response.json(manifest),
      'frames/air-temperature/': () => png(),
    });
    // header says 720x360 but the decoder disagrees: still rejected after decoding
    const decode = async () => (calls++ === 0 ? { width: 10, height: 10, rgba: new Uint8ClampedArray(400) } : okImage);
    const r = await loadFrame(track, '1980-07-01', legend, { fetchImpl: f, decode, baseUrl: '/' });
    expect(r.frame.source.mode).toBe('bundled');
    expect(r.fallbackReason).toMatch(/size/);
  });

  it('never contacts GIBS in offline mode', async () => {
    const f = router({ 'manifest.json': () => Response.json(manifest), 'frames/air-temperature/': () => png() });
    const r = await loadFrame(track, '1980-07-01', legend, { fetchImpl: f, decode: async () => okImage, baseUrl: '/', offlineOnly: true });
    expect(r.frame.source.mode).toBe('bundled');
    expect(vi.mocked(f).mock.calls.some((c) => String(c[0]).includes('gibs.earthdata'))).toBe(false);
  });
});

describe('loadLegend', () => {
  it('falls back to uncalibrated luminance with a warning when the colormap is broken', async () => {
    const f = router({ 'manifest.json': () => Response.json(manifest), 'x.xml': () => new Response('<oops/>') });
    const r = await loadLegend(track, { fetchImpl: f, baseUrl: '/' });
    expect(r.legend.calibrated).toBe(false);
    expect(r.warning).toMatch(/not calibrated/);
  });
});

describe('valueGrid / regionMean', () => {
  it('recovers values and NaN for no data', () => {
    const f = synthFrame(4, 2, (x, y) => (y === 1 && x === 3 ? null : x + y * 10));
    const g = valueGrid(f);
    expect(Array.from(g.slice(0, 4))).toEqual([0, 1, 2, 3]);
    expect(Number.isNaN(g[7]!)).toBe(true);
    expect(regionMean(f, 0, 0, 1, 0)).toBe(0.5);
    expect(regionMean(f, 3, 1, 3, 1)).toBeNull();
  });
  it('converts pixel centres to lon/lat and back', () => {
    expect(xToLon({ width: 720 }, 0)).toBeCloseTo(-179.75);
    expect(yToLat({ height: 360 }, 359)).toBeCloseTo(-89.75);
    for (const x of [0, 1, 359, 718, 719]) expect(lonToX({ width: 720 }, xToLon({ width: 720 }, x))).toBe(x);
    for (const y of [0, 180, 359]) expect(latToY({ height: 360 }, yToLat({ height: 360 }, y))).toBe(y);
    expect(lonToX({ width: 720 }, 999)).toBe(719);
    expect(latToY({ height: 360 }, -999)).toBe(359);
  });
});

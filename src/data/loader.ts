// Frame loading: live GIBS first, bundled frames as fallback. All responses validated.
import type { Frame, Legend } from '../types';
import type { Track } from './catalog';
import { luminanceLegend, parseColormap } from './colormap';
import { FRAME_HEIGHT, FRAME_WIDTH, FetchError, fetchRead, readImage, readText, wmsUrl } from './gibs';

export interface ManifestFrame {
  date: string;
  file: string;
  sourceUrl: string;
  bytes: number;
  dataPct: number;
}
export interface Manifest {
  generated: string;
  provider: string;
  width: number;
  height: number;
  tracks: Record<string, { layerId: string; colormap: string; colormapSource: string; frames: ManifestFrame[] }>;
}

export interface DecodedImage {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}
export type Decoder = (blob: Blob) => Promise<DecodedImage>;

export interface LoaderDeps {
  fetchImpl?: typeof fetch;
  decode?: Decoder;
  baseUrl?: string;
  offlineOnly?: boolean;
  timeoutMs?: number;
}

const env = import.meta.env ?? {};
export const BASE_URL: string = (env.BASE_URL as string | undefined) ?? '/';
export const OFFLINE_ONLY = String(env.VITE_OFFLINE_ONLY ?? 'false') === 'true';

/** Browser decoder: exact pixel values, no colour management or premultiplication. */
export const decodeInBrowser: Decoder = async (blob) => {
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  try {
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(bmp.width, bmp.height)
        : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.drawImage(bmp, 0, 0);
    const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
    return { width: img.width, height: img.height, rgba: img.data };
  } finally {
    bmp.close();
  }
};

function join(base: string, path: string): string {
  return base.endsWith('/') ? base + path : `${base}/${path}`;
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Structural validation of the bundled manifest (it is our own file, but fail clearly if it is broken). */
export function validateManifest(m: unknown): Manifest {
  const bad = (why: string) => new Error(`Invalid frames manifest: ${why}`);
  if (!m || typeof m !== 'object') throw bad('not an object');
  const tracks = (m as { tracks?: unknown }).tracks;
  if (!tracks || typeof tracks !== 'object') throw bad('missing tracks');
  for (const [id, t] of Object.entries(tracks as Record<string, unknown>)) {
    const tr = t as Partial<Manifest['tracks'][string]>;
    if (!isStr(tr.layerId) || !isStr(tr.colormap) || !isStr(tr.colormapSource) || !Array.isArray(tr.frames)) {
      throw bad(`track ${id}`);
    }
    for (const f of tr.frames) {
      if (!f || !isStr(f.date) || !isStr(f.file) || !isStr(f.sourceUrl) || !f.file.startsWith('frames/')) {
        throw bad(`frame entry in ${id}`);
      }
    }
  }
  return m as Manifest;
}

let manifestPromise: Promise<Manifest> | null = null;

export function loadManifest(deps: LoaderDeps = {}): Promise<Manifest> {
  const run = () =>
    fetchRead(join(deps.baseUrl ?? BASE_URL, 'frames/manifest.json'), async (res) => validateManifest(JSON.parse(await readText(res))), {
      fetchImpl: deps.fetchImpl,
      timeoutMs: deps.timeoutMs,
    });
  if (deps.fetchImpl || deps.baseUrl) return run();
  manifestPromise ??= run().catch((e: unknown) => {
    manifestPromise = null;
    throw e;
  });
  return manifestPromise;
}

/** Load the bundled GIBS colormap for a track. Falls back to (uncalibrated) luminance. */
export async function loadLegend(track: Track, deps: LoaderDeps = {}): Promise<{ legend: Legend; warning?: string }> {
  try {
    const manifest = await loadManifest(deps);
    const entry = manifest.tracks[track.id];
    if (!entry) throw new Error(`Track ${track.id} missing from manifest`);
    const legend = await fetchRead(join(deps.baseUrl ?? BASE_URL, entry.colormap), async (res) => parseColormap(await readText(res)), {
      fetchImpl: deps.fetchImpl,
      timeoutMs: deps.timeoutMs,
    });
    return { legend };
  } catch (e) {
    return {
      legend: luminanceLegend(),
      warning: `Colour scale unavailable (${e instanceof Error ? e.message : String(e)}); using relative brightness, not calibrated values.`,
    };
  }
}

function validateDims(img: DecodedImage): void {
  if (img.width !== FRAME_WIDTH || img.height !== FRAME_HEIGHT) {
    throw new FetchError(`Unexpected image size ${img.width}x${img.height}`, 'size');
  }
  if (img.rgba.length !== img.width * img.height * 4) throw new FetchError('Corrupt pixel buffer', 'size');
}

export interface LoadResult {
  frame: Frame;
  /** Set when live data failed and the bundled copy was used. */
  fallbackReason?: string;
  /** True when the app is configured never to contact GIBS (VITE_OFFLINE_ONLY). */
  offline?: boolean;
}

export async function loadFrame(
  track: Track,
  date: string,
  legend: Legend,
  opts: LoaderDeps & { preferLive?: boolean; signal?: AbortSignal } = {},
): Promise<LoadResult> {
  const decode = opts.decode ?? decodeInBrowser;
  const fetchOpts = { fetchImpl: opts.fetchImpl, signal: opts.signal, timeoutMs: opts.timeoutMs };
  const offline = opts.offlineOnly ?? OFFLINE_ONLY;
  const make = (img: DecodedImage, mode: 'live' | 'bundled', url: string): Frame => ({
    trackId: track.id,
    date,
    width: img.width,
    height: img.height,
    rgba: img.rgba,
    legend,
    source: { provider: 'NASA GIBS', layerId: track.layerId, layerTitle: track.layerTitle, date, url, mode },
  });
  // PNG header is checked for 720x360 before decoding; decoded size is checked again after.
  const readFrame = async (res: Response) => {
    const img = await decode(await readImage(res));
    validateDims(img);
    return img;
  };

  let fallbackReason: string | undefined;
  if (opts.preferLive !== false && !offline) {
    const url = wmsUrl(track.layerId, date);
    try {
      return { frame: make(await fetchRead(url, readFrame, fetchOpts), 'live', url) };
    } catch (e) {
      if (e instanceof FetchError && e.kind === 'aborted') throw e;
      fallbackReason = e instanceof Error ? e.message : String(e);
    }
  }

  const manifest = await loadManifest(opts);
  const entry = manifest.tracks[track.id]?.frames.find((f) => f.date === date);
  if (!entry) throw new Error(`No bundled frame for ${track.id} ${date}`);
  const img = await fetchRead(join(opts.baseUrl ?? BASE_URL, entry.file), readFrame, fetchOpts);
  return { frame: make(img, 'bundled', entry.sourceUrl), fallbackReason, offline: offline || undefined };
}

// NASA GIBS client: URL builder and defensive fetching.

export const FRAME_WIDTH = 720;
export const FRAME_HEIGHT = 360;
export const MAX_IMAGE_BYTES = 5_000_000;
export const MAX_TEXT_BYTES = 2_000_000;
export const DEFAULT_TIMEOUT_MS = 8000;

export const GIBS_WMS_URL: string =
  (import.meta.env?.VITE_GIBS_WMS_URL as string | undefined) ||
  'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

export function wmsUrl(layerId: string, date: string, width = FRAME_WIDTH, height = FRAME_HEIGHT, base = GIBS_WMS_URL): string {
  if (!/^[A-Za-z0-9_]+$/.test(layerId)) throw new Error(`Invalid layer id: ${layerId}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date: ${date}`);
  const p = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.3.0',
    LAYERS: layerId,
    STYLES: '',
    CRS: 'EPSG:4326',
    BBOX: '-90,-180,90,180',
    WIDTH: String(width),
    HEIGHT: String(height),
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
    TIME: date,
  });
  return `${base}?${p.toString()}`;
}

export class FetchError extends Error {
  constructor(
    message: string,
    readonly kind: 'timeout' | 'network' | 'http' | 'type' | 'size' | 'aborted',
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

/** fetch with AbortController timeout; also honours an outer signal. */
export async function fetchWithTimeout(
  url: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS, signal, fetchImpl = fetch }: { timeoutMs?: number; signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<Response> {
  const ac = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, timeoutMs);
  const onAbort = () => ac.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetchImpl(url, { signal: ac.signal });
    if (!res.ok) throw new FetchError(`HTTP ${res.status} for ${url}`, 'http');
    return res;
  } catch (e) {
    if (e instanceof FetchError) throw e;
    if (timedOut) throw new FetchError(`Timed out after ${timeoutMs} ms: ${url}`, 'timeout');
    if (signal?.aborted) throw new FetchError('Aborted', 'aborted');
    throw new FetchError(`Network error for ${url}: ${String(e)}`, 'network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Validate an image response (type + size) and return its bytes as a Blob. */
export async function readImage(res: Response, maxBytes = MAX_IMAGE_BYTES): Promise<Blob> {
  const type = res.headers.get('content-type') ?? '';
  if (!/^image\/(png|jpeg)\b/.test(type)) throw new FetchError(`Unexpected content-type "${type}"`, 'type');
  const len = Number(res.headers.get('content-length') ?? '0');
  if (len > maxBytes) throw new FetchError(`Image too large (${len} bytes)`, 'size');
  const blob = await res.blob();
  if (blob.size === 0 || blob.size > maxBytes) throw new FetchError(`Bad image size (${blob.size} bytes)`, 'size');
  return blob;
}

/** Validate a text/XML/JSON response and return its text. */
export async function readText(res: Response, maxBytes = MAX_TEXT_BYTES): Promise<string> {
  const len = Number(res.headers.get('content-length') ?? '0');
  if (len > maxBytes) throw new FetchError(`Response too large (${len} bytes)`, 'size');
  const text = await res.text();
  if (text.length > maxBytes) throw new FetchError(`Response too large (${text.length} chars)`, 'size');
  return text;
}

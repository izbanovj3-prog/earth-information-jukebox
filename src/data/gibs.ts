// NASA GIBS client: defensive fetching. The request contract lives in ./wms (shared with scripts/).
import { DEFAULT_GIBS_WMS_URL, FRAME_HEIGHT, FRAME_WIDTH, pngDimensions, wmsUrl as buildWmsUrl } from './wms';

export { FRAME_HEIGHT, FRAME_WIDTH, pngDimensions } from './wms';

export const MAX_IMAGE_BYTES = 5_000_000;
export const MAX_TEXT_BYTES = 2_000_000;
export const DEFAULT_TIMEOUT_MS = 8000;

/** Only https endpoints are accepted for the optional VITE_GIBS_WMS_URL override. */
export function resolveWmsBase(override: string | undefined): string {
  if (!override) return DEFAULT_GIBS_WMS_URL;
  try {
    const u = new URL(override);
    if (u.protocol === 'https:') return u.toString();
  } catch {
    /* fall through */
  }
  console.warn(`Ignoring VITE_GIBS_WMS_URL (must be an https URL): ${override}`);
  return DEFAULT_GIBS_WMS_URL;
}

export const GIBS_WMS_URL: string = resolveWmsBase(import.meta.env?.VITE_GIBS_WMS_URL as string | undefined);

export function wmsUrl(layerId: string, date: string, width = FRAME_WIDTH, height = FRAME_HEIGHT, base = GIBS_WMS_URL): string {
  return buildWmsUrl(layerId, date, width, height, base);
}

export class FetchError extends Error {
  readonly kind: 'timeout' | 'network' | 'http' | 'type' | 'size' | 'aborted';
  constructor(message: string, kind: FetchError['kind']) {
    super(message);
    this.name = 'FetchError';
    this.kind = kind;
  }
}

export interface FetchOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

/**
 * fetch + read the body under ONE AbortController timeout (a response that stalls after its
 * headers still times out). Also honours an outer signal.
 */
export async function fetchRead<T>(
  url: string,
  read: (res: Response) => Promise<T>,
  { timeoutMs = DEFAULT_TIMEOUT_MS, signal, fetchImpl = fetch }: FetchOptions = {},
): Promise<T> {
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
    return await read(res);
  } catch (e) {
    if (timedOut) throw new FetchError(`Timed out after ${timeoutMs} ms: ${url}`, 'timeout');
    if (signal?.aborted) throw new FetchError('Aborted', 'aborted');
    if (e instanceof FetchError) throw e;
    throw new FetchError(`Network error for ${url}: ${String(e)}`, 'network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Read a body, aborting as soon as it exceeds maxBytes (works without Content-Length). */
export async function readBytes(res: Response, maxBytes: number): Promise<Uint8Array> {
  const len = Number(res.headers.get('content-length') ?? '0');
  if (len > maxBytes) throw new FetchError(`Response too large (${len} bytes)`, 'size');
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new FetchError(`Response too large (${buf.length} bytes)`, 'size');
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new FetchError(`Response too large (over ${maxBytes} bytes)`, 'size');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/**
 * Validate an image response (type, size, and for PNGs the declared dimensions, checked from the
 * header before any decoding) and return it as a Blob.
 */
export async function readImage(
  res: Response,
  maxBytes = MAX_IMAGE_BYTES,
  expect: { width: number; height: number } | null = { width: FRAME_WIDTH, height: FRAME_HEIGHT },
): Promise<Blob> {
  const type = res.headers.get('content-type') ?? '';
  if (!/^image\/png\b/.test(type)) throw new FetchError(`Unexpected content-type "${type}"`, 'type');
  const bytes = await readBytes(res, maxBytes);
  if (bytes.length === 0) throw new FetchError('Empty image', 'size');
  const dims = pngDimensions(bytes);
  if (!dims) throw new FetchError('Not a PNG image', 'type');
  if (expect && (dims.width !== expect.width || dims.height !== expect.height)) {
    throw new FetchError(`Unexpected image size ${dims.width}x${dims.height}`, 'size');
  }
  return new Blob([bytes as BlobPart], { type: 'image/png' });
}

/** Validate a text/XML/JSON response and return its text. */
export async function readText(res: Response, maxBytes = MAX_TEXT_BYTES): Promise<string> {
  return new TextDecoder().decode(await readBytes(res, maxBytes));
}

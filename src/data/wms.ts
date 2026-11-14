// GIBS WMS request contract, shared by the app and scripts/fetch-frames.mjs.
// Erasable TypeScript only: Node imports this file with type stripping.

export const FRAME_WIDTH = 720;
export const FRAME_HEIGHT = 360;
export const DEFAULT_GIBS_WMS_URL = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

/** GetMap URL for one global EPSG:4326 frame. `date` is omitted for static layers (e.g. coastlines). */
export function wmsUrl(
  layerId: string,
  date: string | null,
  width: number = FRAME_WIDTH,
  height: number = FRAME_HEIGHT,
  base: string = DEFAULT_GIBS_WMS_URL,
): string {
  if (!/^[A-Za-z0-9_]+$/.test(layerId)) throw new Error(`Invalid layer id: ${layerId}`);
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date: ${date}`);
  const params: Record<string, string> = {
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
  };
  if (date !== null) params.TIME = date;
  return `${base}?${new URLSearchParams(params).toString()}`;
}

/**
 * Width/height from a PNG header (signature + IHDR), without decoding. null if not a PNG.
 * Lets callers reject decompression bombs before decoding.
 */
export function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || sig.some((b, i) => bytes[i] !== b)) return null;
  // IHDR must be the first chunk: length(4) "IHDR"(4) width(4) height(4)
  if (String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!) !== 'IHDR') return null;
  const u32 = (o: number) => ((bytes[o]! << 24) | (bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!) >>> 0;
  return { width: u32(16), height: u32(20) };
}

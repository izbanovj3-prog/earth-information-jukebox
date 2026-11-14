// Download + verify the bundled offline frames for every track in src/data/catalog.ts.
// Usage: npm run frames   (needs network access to gibs.earthdata.nasa.gov)
// Every frame is validated: HTTP 200, image/png, 720x360, CORS "*", >1% data pixels.
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { TRACKS } from '../src/data/catalog.ts';

const WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
const OUT = new URL('../public/frames/', import.meta.url);
const W = 720;
const H = 360;

export function wmsUrl(layer, time) {
  const p = new URLSearchParams({
    SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', LAYERS: layer, STYLES: '',
    CRS: 'EPSG:4326', BBOX: '-90,-180,90,180', WIDTH: String(W), HEIGHT: String(H),
    FORMAT: 'image/png', TRANSPARENT: 'TRUE', TIME: time,
  });
  return `${WMS}?${p}`;
}

async function get(url, ms = 45000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { signal: ac.signal, headers: { Origin: 'http://localhost:5173' } });
  } finally {
    clearTimeout(t);
  }
}

const manifest = { generated: new Date().toISOString(), provider: 'NASA GIBS', width: W, height: H, tracks: {} };
let failures = 0;

mkdirSync(new URL('colormaps/', OUT), { recursive: true });
for (const track of TRACKS) {
  const dir = new URL(`${track.id}/`, OUT);
  mkdirSync(dir, { recursive: true });
  const cmName = track.colormapUrl.split('/').pop();
  const cm = await get(track.colormapUrl);
  if (!cm.ok) throw new Error(`colormap ${track.colormapUrl} -> ${cm.status}`);
  const cmXml = await cm.text();
  if (!cmXml.includes('<ColorMapEntry')) throw new Error(`colormap ${cmName} has no entries`);
  writeFileSync(new URL(`colormaps/${cmName}`, OUT), cmXml);

  const frames = [];
  for (const date of track.dates) {
    const url = wmsUrl(track.layerId, date);
    const r = await get(url);
    const type = r.headers.get('content-type') ?? '';
    const cors = r.headers.get('access-control-allow-origin');
    const buf = Buffer.from(await r.arrayBuffer());
    let ok = r.status === 200 && type.startsWith('image/png') && cors === '*' && buf.length < 5_000_000;
    let dataPct = 0;
    if (ok) {
      const png = PNG.sync.read(buf);
      let opaque = 0;
      for (let i = 3; i < png.data.length; i += 4) if (png.data[i] > 0) opaque++;
      dataPct = +((100 * opaque) / (png.width * png.height)).toFixed(1);
      ok = png.width === W && png.height === H && dataPct > 1;
    }
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${track.id} ${date} status=${r.status} type=${type} cors=${cors} bytes=${buf.length} data=${dataPct}%`);
    if (!ok) {
      failures++;
      continue;
    }
    writeFileSync(new URL(`${date}.png`, dir), buf);
    frames.push({ date, file: `frames/${track.id}/${date}.png`, sourceUrl: url, bytes: buf.length, dataPct });
  }
  manifest.tracks[track.id] = {
    layerId: track.layerId,
    colormap: `frames/colormaps/${cmName}`,
    colormapSource: track.colormapUrl,
    frames,
  };
}
writeFileSync(new URL('manifest.json', OUT), JSON.stringify(manifest, null, 2) + '\n');
console.log(failures ? `\n${failures} frame(s) failed verification` : '\nAll frames verified');
process.exitCode = failures ? 1 : 0;

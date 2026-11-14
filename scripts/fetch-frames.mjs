// Download + verify the bundled offline frames for every track in src/data/catalog.ts.
// Usage: npm run frames   (needs network access to gibs.earthdata.nasa.gov; Node >= 22.18)
// Every frame is validated: HTTP 200, image/png, PNG header 720x360 (checked before decoding),
// CORS "*", decodes, >1% data pixels. Colormaps must parse with the app's own parser.
// The manifest is only rewritten when EVERYTHING passes, so a flaky run never breaks offline mode.
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { TRACKS } from '../src/data/catalog.ts';
import { parseColormap } from '../src/data/colormap.ts';
import { DEFAULT_GIBS_WMS_URL, FRAME_HEIGHT as H, FRAME_WIDTH as W, pngDimensions, wmsUrl } from '../src/data/wms.ts';
import { ensureProxyEnv, get } from './lib/http.mjs';

ensureProxyEnv();

const OUT = new URL('../public/frames/', import.meta.url);
const override = process.env.VITE_GIBS_WMS_URL;
const BASE = override && override.startsWith('https://') ? override : DEFAULT_GIBS_WMS_URL;

/** Validate a PNG response; returns the decoded image or a reason. */
function checkPng(r, w, h, minDataPct) {
  if (r.status !== 200) return { reason: `status ${r.status}` };
  if (!r.type.startsWith('image/png')) return { reason: `type ${r.type}` };
  if (r.cors !== '*') return { reason: `CORS ${r.cors}` };
  const dims = pngDimensions(r.body);
  if (!dims || dims.width !== w || dims.height !== h) return { reason: `header ${dims ? `${dims.width}x${dims.height}` : 'not PNG'}` };
  const png = PNG.sync.read(r.body);
  let opaque = 0;
  for (let i = 3; i < png.data.length; i += 4) if (png.data[i] > 0) opaque++;
  const dataPct = +((100 * opaque) / (png.width * png.height)).toFixed(1);
  if (dataPct <= minDataPct) return { reason: `only ${dataPct}% data` };
  return { dataPct };
}

const manifest = { generated: new Date().toISOString(), provider: 'NASA GIBS', width: W, height: H, tracks: {} };
const pending = []; // files are written only after every check passed
let failures = 0;

for (const track of TRACKS) {
  const cmName = track.colormapUrl.split('/').pop();
  const cm = await get(track.colormapUrl, { maxBytes: 2_000_000 });
  const cmXml = cm.body.toString('utf8');
  try {
    if (!cm.ok) throw new Error(`status ${cm.status}`);
    parseColormap(cmXml); // throws on anything the app could not use
    pending.push([`colormaps/${cmName}`, cm.body]);
    console.log(`OK   colormap ${cmName}`);
  } catch (e) {
    failures++;
    console.log(`FAIL colormap ${cmName}: ${e instanceof Error ? e.message : e}`);
  }

  const frames = [];
  for (const date of track.dates) {
    const url = wmsUrl(track.layerId, date, W, H, BASE);
    const r = await get(url);
    const c = checkPng(r, W, H, 1);
    console.log(`${c.reason ? 'FAIL' : 'OK  '} ${track.id} ${date} bytes=${r.body.length} ${c.reason ?? `data=${c.dataPct}%`}`);
    if (c.reason) {
      failures++;
      continue;
    }
    pending.push([`${track.id}/${date}.png`, r.body]);
    frames.push({ date, file: `frames/${track.id}/${date}.png`, sourceUrl: url, bytes: r.body.length, dataPct: c.dataPct });
  }
  manifest.tracks[track.id] = { layerId: track.layerId, colormap: `frames/colormaps/${cmName}`, colormapSource: track.colormapUrl, frames };
}

// Static, decorative coastline overlay for orientation (OpenStreetMap data via GIBS; attribution required).
{
  const url = wmsUrl('Coastlines_15m', null, W * 2, H * 2, BASE);
  const r = await get(url);
  const c = checkPng(r, W * 2, H * 2, 0.1);
  console.log(`${c.reason ? 'FAIL' : 'OK  '} basemap Coastlines_15m bytes=${r.body.length} ${c.reason ?? ''}`);
  if (c.reason) failures++;
  else {
    pending.push(['basemap/coastlines.png', r.body]);
    manifest.basemap = { layerId: 'Coastlines_15m', file: 'frames/basemap/coastlines.png', sourceUrl: url, credit: '© OpenStreetMap contributors (ODbL), via NASA GIBS' };
  }
}

if (failures) {
  console.log(`\n${failures} item(s) failed verification; public/frames was NOT changed.`);
  process.exitCode = 1;
} else {
  for (const [rel, body] of pending) {
    const target = new URL(rel, OUT);
    mkdirSync(new URL('./', target), { recursive: true });
    writeFileSync(target, body);
  }
  writeFileSync(new URL('manifest.json', OUT), JSON.stringify(manifest, null, 2) + '\n');
  console.log('\nAll frames verified; public/frames updated.');
}

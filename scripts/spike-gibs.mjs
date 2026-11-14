// Data spike: verify candidate GIBS layers with real requests.
// Usage: node scripts/spike-gibs.mjs  -> prints a table, writes scripts/spike-report.json
import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
const CMAP = 'https://gibs.earthdata.nasa.gov/colormaps/v1.3/';

const candidates = [
  ['temperature', 'MERRA2_2m_Air_Temperature_Monthly', '1980-07-01'],
  ['temperature', 'MERRA2_2m_Air_Temperature_Monthly', '2024-07-01'],
  ['sea-ice', 'GHRSST_L4_MUR25_Sea_Ice_Concentration', '2003-09-15'],
  ['sea-ice', 'GHRSST_L4_MUR25_Sea_Ice_Concentration', '2025-09-15'],
  ['sea-ice', 'AMSRU2_Sea_Ice_Concentration_25km', '2020-09-15'],
  ['sst', 'MODIS_Aqua_L3_SST_Thermal_4km_Night_Monthly', '2023-01-01'],
  ['sst', 'GHRSST_L4_MUR25_Sea_Surface_Temperature', '2023-08-15'],
  ['vegetation', 'MODIS_Terra_L3_NDVI_Monthly', '2024-01-01'],
  ['vegetation', 'MODIS_Terra_L3_NDVI_Monthly', '2024-07-01'],
  ['aerosols', 'MERRA2_Total_Aerosol_Optical_Thickness_550nm_Extinction_Monthly', '2023-07-01'],
  ['land-temp', 'MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day', '2024-07-01'],
  ['methane', 'AIRS_L3_Methane_400hPa_Volume_Mixing_Ratio_Monthly_Day', '2024-07-01'],
  ['snow', 'MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct', '2024-01-01'],
];

function wmsUrl(layer, time, w = 720, h = 360) {
  const p = new URLSearchParams({
    SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', LAYERS: layer, STYLES: '',
    CRS: 'EPSG:4326', BBOX: '-90,-180,90,180', WIDTH: String(w), HEIGHT: String(h),
    FORMAT: 'image/png', TRANSPARENT: 'TRUE', TIME: time,
  });
  return `${WMS}?${p}`;
}

async function get(url, ms = 30000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { signal: ac.signal, headers: { Origin: 'http://localhost:5173' } });
  } finally {
    clearTimeout(t);
  }
}

const report = [];
for (const [theme, layer, time] of candidates) {
  const row = { theme, layer, time };
  try {
    const r = await get(wmsUrl(layer, time));
    row.status = r.status;
    row.type = r.headers.get('content-type');
    row.cors = r.headers.get('access-control-allow-origin');
    const buf = Buffer.from(await r.arrayBuffer());
    row.bytes = buf.length;
    if (row.type?.startsWith('image/png')) {
      const png = PNG.sync.read(buf);
      let opaque = 0;
      const colours = new Set();
      for (let i = 0; i < png.data.length; i += 4) {
        if (png.data[i + 3] > 0) {
          opaque++;
          if (colours.size < 5000) colours.add((png.data[i] << 16) | (png.data[i + 1] << 8) | png.data[i + 2]);
        }
      }
      row.dims = `${png.width}x${png.height}`;
      row.dataPct = +((100 * opaque) / (png.width * png.height)).toFixed(1);
      row.colours = colours.size;
    } else {
      row.body = buf.toString('utf8').slice(0, 160);
    }
    const c = await get(CMAP + layer + '.xml');
    row.colormap = c.status;
    if (c.ok) {
      const xml = await c.text();
      row.cmEntries = (xml.match(/<ColorMapEntry /g) || []).length;
      row.cmUnits = (xml.match(/units="([^"]*)"/) || [])[1] ?? null;
    }
  } catch (e) {
    row.error = String(e);
  }
  row.pass = row.status === 200 && row.dataPct > 1 && row.colours > 4 && row.cors === '*';
  report.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(new URL('./spike-report.json', import.meta.url), JSON.stringify(report, null, 2));

// Minimal baseline TIFF decoder (no dependencies).
// Supports: 8-bit chunky (interleaved) strips, RGB / RGBA / grayscale,
// compression none (1), LZW (5), Deflate (8, 32946), PackBits (32773),
// horizontal predictor (2). That covers the frame sequences published by NASA SVS.
//
// decodeTiffDownscaled() decodes strip by strip and box-filters straight into a
// smaller RGBA buffer, so an 8K frame never has to sit in memory at full size.

'use strict';
const zlib = require('zlib');

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 16: 8 };

function parseIfd(buf) {
  const order = buf.toString('latin1', 0, 2);
  if (order !== 'II' && order !== 'MM') throw new Error('Not a TIFF file');
  const le = order === 'II';
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  if (u16(2) !== 42) throw new Error('BigTIFF / unknown TIFF variant is not supported');

  const ifd = u32(4);
  const n = u16(ifd);
  const tags = {};
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e);
    const type = u16(e + 2);
    const count = u32(e + 4);
    const size = (TYPE_SIZE[type] || 1) * count;
    const at = size <= 4 ? e + 8 : u32(e + 8);
    const values = [];
    if (type === 3 || type === 4) {
      for (let k = 0; k < count; k++) values.push(type === 3 ? u16(at + k * 2) : u32(at + k * 4));
    } else if (type === 1 || type === 7) {
      for (let k = 0; k < count; k++) values.push(buf[at + k]);
    }
    tags[tag] = values;
  }
  return tags;
}

function lzwDecode(input, outSize) {
  const out = new Uint8Array(outSize);
  const prefix = new Int32Array(4096);
  const suffix = new Uint8Array(4096);
  const length = new Uint16Array(4096);
  const first = new Uint8Array(4096);
  for (let i = 0; i < 256; i++) { prefix[i] = -1; suffix[i] = i; length[i] = 1; first[i] = i; }

  let op = 0, bitPos = 0, codeLen = 9, next = 258, prev = -1;
  const totalBits = input.length * 8;

  const write = (code) => {
    const l = length[code];
    let p = op + l - 1;
    let c = code;
    while (c !== -1) {
      if (p < outSize) out[p] = suffix[c];
      p--;
      c = prefix[c];
    }
    op += l;
  };
  const add = (p, ch) => {
    if (next >= 4096) return;
    prefix[next] = p; suffix[next] = ch; length[next] = length[p] + 1; first[next] = first[p];
    next++;
    if (next >= (1 << codeLen) - 1 && codeLen < 12) codeLen++; // TIFF "early change"
  };

  while (op < outSize && bitPos + codeLen <= totalBits) {
    const bp = bitPos >> 3;
    const v = (input[bp] << 16) | ((input[bp + 1] || 0) << 8) | (input[bp + 2] || 0);
    const code = (v >>> (24 - (bitPos & 7) - codeLen)) & ((1 << codeLen) - 1);
    bitPos += codeLen;

    if (code === 257) break;
    if (code === 256) { next = 258; codeLen = 9; prev = -1; continue; }
    if (prev === -1) { write(code); prev = code; continue; }
    if (code < next) {
      write(code);
      add(prev, first[code]);
    } else {
      add(prev, first[prev]);
      write(code);
    }
    prev = code;
  }
  return out;
}

function packBitsDecode(input, outSize) {
  const out = new Uint8Array(outSize);
  let ip = 0, op = 0;
  while (ip < input.length && op < outSize) {
    const n = (input[ip++] << 24) >> 24;
    if (n >= 0) { for (let i = 0; i <= n && op < outSize; i++) out[op++] = input[ip++]; }
    else if (n !== -128) { const b = input[ip++]; for (let i = 0; i < 1 - n && op < outSize; i++) out[op++] = b; }
  }
  return out;
}

function decompress(compression, raw, outSize) {
  switch (compression) {
    case 1: return raw;
    case 5: return lzwDecode(raw, outSize);
    case 8:
    case 32946: return zlib.inflateSync(raw);
    case 32773: return packBitsDecode(raw, outSize);
    default: throw new Error(`Unsupported TIFF compression ${compression}`);
  }
}

/**
 * Decode a TIFF buffer and box-filter it down to at most `maxWidth` pixels wide.
 * @returns {{width:number,height:number,data:Uint8Array}} RGBA pixels
 */
function decodeTiffDownscaled(buf, maxWidth) {
  const t = parseIfd(buf);
  const W = t[256][0], H = t[257][0];
  const bps = t[258] || [1];
  const compression = (t[259] || [1])[0];
  const photometric = (t[262] || [2])[0];
  const spp = (t[277] || [1])[0];
  const rowsPerStrip = (t[278] || [H])[0];
  const planar = (t[284] || [1])[0];
  const predictor = (t[317] || [1])[0];
  const offsets = t[273], counts = t[279];

  if (t[322]) throw new Error('Tiled TIFFs are not supported');
  const bits = bps[0];
  if (bps.some((b) => b !== bits) || (bits !== 8 && bits !== 16)) throw new Error(`Only 8/16-bit TIFFs are supported (got ${bps})`);
  if (planar !== 1) throw new Error('Only interleaved (chunky) TIFFs are supported');
  if (!offsets || !counts) throw new Error('TIFF has no strips');
  const le = buf.toString('latin1', 0, 2) === 'II';
  const B = bits / 8; // bytes per sample

  const w = Math.max(1, Math.min(maxWidth || W, W));
  const h = Math.max(1, Math.round((H * w) / W));
  const sum = new Float32Array(w * h * 4);
  const cnt = new Uint32Array(w * h);
  const xMap = new Uint32Array(W);
  for (let x = 0; x < W; x++) xMap[x] = Math.min(w - 1, Math.floor((x * w) / W));

  const rowSamples = W * spp;
  const rowBytes = rowSamples * B;
  const row = new Float32Array(rowSamples); // samples normalised to 0..255
  const max = bits === 16 ? 65535 : 255;
  for (let s = 0; s < offsets.length; s++) {
    const y0 = s * rowsPerStrip;
    const rows = Math.min(rowsPerStrip, H - y0);
    if (rows <= 0) break;
    const raw = buf.subarray(offsets[s], offsets[s] + counts[s]);
    const data = decompress(compression, raw, rows * rowBytes);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    for (let r = 0; r < rows; r++) {
      const base = r * rowBytes;
      if (bits === 8) {
        if (predictor === 2) for (let i = spp; i < rowSamples; i++) data[base + i] = (data[base + i] + data[base + i - spp]) & 255;
        for (let i = 0; i < rowSamples; i++) row[i] = data[base + i];
      } else {
        let prevVals = new Uint16Array(spp);
        for (let i = 0; i < rowSamples; i++) {
          let v = view.getUint16(base + i * 2, le);
          if (predictor === 2 && i >= spp) v = (v + prevVals[i % spp]) & 0xffff;
          prevVals[i % spp] = v;
          row[i] = (v / max) * 255;
        }
      }
      const oy = Math.min(h - 1, Math.floor(((y0 + r) * h) / H));
      const orow = oy * w;
      for (let x = 0; x < W; x++) {
        const p = x * spp;
        let R, G, Bl, A = 255;
        if (spp >= 3) { R = row[p]; G = row[p + 1]; Bl = row[p + 2]; if (spp >= 4) A = row[p + 3]; }
        else { let v = row[p]; if (photometric === 0) v = 255 - v; R = G = Bl = v; if (spp === 2) A = row[p + 1]; }
        const o = orow + xMap[x];
        const o4 = o * 4;
        // premultiply by alpha so transparent pixels read as black
        const a = A / 255;
        sum[o4] += R * a; sum[o4 + 1] += G * a; sum[o4 + 2] += Bl * a; sum[o4 + 3] += A;
        cnt[o]++;
      }
    }
  }

  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const c = cnt[i] || 1;
    for (let k = 0; k < 3; k++) out[i * 4 + k] = Math.min(255, Math.round(sum[i * 4 + k] / c));
    out[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data: out };
}

module.exports = { decodeTiffDownscaled, lzwDecode, parseIfd };

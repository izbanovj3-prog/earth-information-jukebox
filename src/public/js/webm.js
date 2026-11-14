// Encode an AudioBuffer to Opus-in-WebM with WebCodecs (no dependencies).
// Used for the playlist: ~1–2 MB per track instead of ~10–20 MB of WAV.

const enc = new TextEncoder();

function vint(n) { // EBML size, always 8 bytes (simple and valid)
  const b = new Uint8Array(8);
  b[0] = 0x01;
  for (let i = 7; i >= 1; i--) { b[i] = n & 0xff; n = Math.floor(n / 256); }
  return b;
}
function idBytes(id) {
  const out = [];
  while (id > 0) { out.unshift(id & 0xff); id = Math.floor(id / 256); }
  return Uint8Array.from(out);
}
function cat(parts) {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const el = (id, ...children) => { const body = cat(children); return cat([idBytes(id), vint(body.length), body]); };
const uint = (id, v) => {
  const bytes = [];
  do { bytes.unshift(v & 0xff); v = Math.floor(v / 256); } while (v > 0);
  return el(id, Uint8Array.from(bytes));
};
const str = (id, s) => el(id, enc.encode(s));
const f64 = (id, v) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return el(id, b); };

function opusHead(channels, sampleRate, preSkip = 312) {
  const b = new Uint8Array(19);
  b.set(enc.encode('OpusHead'));
  const dv = new DataView(b.buffer);
  b[8] = 1; b[9] = channels;
  dv.setUint16(10, preSkip, true);
  dv.setUint32(12, sampleRate, true);
  dv.setInt16(16, 0, true);
  b[18] = 0;
  return b;
}

export async function encodeOpusWebm(buffer, { bitrate = 128000 } = {}) {
  if (typeof AudioEncoder === 'undefined') throw new Error('WebCodecs AudioEncoder not available');
  if (buffer.sampleRate !== 48000) throw new Error('render at 48 kHz for Opus');
  const channels = buffer.numberOfChannels, sr = buffer.sampleRate;
  const chunks = [];
  let description = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => {
      if (meta?.decoderConfig?.description && !description) description = new Uint8Array(meta.decoderConfig.description);
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      chunks.push({ t: chunk.timestamp, data });
    },
    error: (e) => { throw e; },
  });
  encoder.configure({ codec: 'opus', sampleRate: sr, numberOfChannels: channels, bitrate });
  const block = 4800;
  for (let i = 0; i < buffer.length; i += block) {
    const n = Math.min(block, buffer.length - i);
    const planar = new Float32Array(n * channels);
    for (let ch = 0; ch < channels; ch++) planar.set(buffer.getChannelData(ch).subarray(i, i + n), ch * n);
    const data = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: channels, timestamp: Math.round((i / sr) * 1e6), data: planar });
    encoder.encode(data);
    data.close();
  }
  await encoder.flush();
  encoder.close();

  const head = description && description.length >= 19 ? description : opusHead(channels, sr);
  const ebml = el(0x1a45dfa3, uint(0x4286, 1), uint(0x42f7, 1), uint(0x42f2, 4), uint(0x42f3, 8), str(0x4282, 'webm'), uint(0x4287, 4), uint(0x4285, 2));
  const info = el(0x1549a966, uint(0x2ad7b1, 1000000), str(0x4d80, 'EarthJukebox'), str(0x5741, 'EarthJukebox'), f64(0x4489, buffer.duration * 1000));
  const tracks = el(0x1654ae6b, el(0xae,
    uint(0xd7, 1), uint(0x73c5, 1), str(0x86, 'A_OPUS'), uint(0x83, 2), el(0x63a2, head),
    uint(0x56aa, 6500000), uint(0x56bb, 80000000),
    el(0xe1, f64(0xb5, sr), uint(0x9f, channels))));

  // clusters of ~5 s; SimpleBlock timecodes are relative int16 milliseconds
  const clusters = [];
  let i = 0;
  while (i < chunks.length) {
    const startMs = Math.round(chunks[i].t / 1000);
    const blocks = [];
    while (i < chunks.length && Math.round(chunks[i].t / 1000) - startMs < 5000) {
      const rel = Math.round(chunks[i].t / 1000) - startMs;
      const hdr = new Uint8Array(4);
      hdr[0] = 0x81; // track 1
      new DataView(hdr.buffer).setInt16(1, rel);
      hdr[3] = 0x80; // keyframe
      blocks.push(el(0xa3, hdr, chunks[i].data));
      i++;
    }
    clusters.push(el(0x1f43b675, uint(0xe7, startMs), ...blocks));
  }
  const segment = el(0x18538067, info, tracks, ...clusters);
  return new Blob([ebml, segment], { type: 'audio/webm' });
}

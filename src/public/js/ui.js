// Jukebox UI controller: dataset selection, transport, timeline, trend chart, mixer,
// narration, map explorer and export.
import { DATASETS, byId, liveLabel } from './datasets.js';
import { COLS, ROWS, loadDataset, latOfRow, lonOfCol, fmtLat, fmtLon, regionName, channelsOf, analyzeLive, thumbUrl } from './analyze.js';
import { STATIC } from './env.js';
import { Engine, Player, composerFor, probeCell, renderOffline, encodeWav, setSweep, SWEEP_SECONDS, setMode, MODE, attachSamples, describeAt } from './engine.js';
import { loadSamples, familiesUsed, FAMILIES, FOUNDATION, orchestraFor, sweepForBpm, orchestraRef } from './orchestra.js';

const $ = (id) => document.getElementById(id);
const el = {
  heroStats: $('hero-stats'), list: $('dataset-list'), title: $('ds-title'), timeSpan: $('time-span'), status: $('status'),
  img: $('frame-img'), overlay: $('overlay'), badgeDate: $('badge-date'), badgeSub: $('badge-sub'), nowChip: $('now-chip'),
  loader: $('loader'), loaderBar: $('loader-bar'), loaderText: $('loader-text'),
  frameLabel: $('frame-label'), source: $('source-link'), credit: $('credit'),
  timeline: $('timeline'), tlFill: $('tl-fill'), tlTicks: $('tl-ticks'), tlHead: $('tl-head'),
  play: $('btn-play'), prev: $('btn-prev'), next: $('btn-next'), tempo: $('tempo'), volume: $('volume'),
  narrate: $('narrate'), grid: $('show-grid'), meter: $('meter'), mixer: $('mixer'),
  trend: $('trend'), trendSub: $('trend-sub'), trendTip: $('trend-tip'), trendTable: $('trend-table'),
  hearing: $('hearing'), summary: $('summary'), frameDesc: $('frame-desc'), narration: $('narration'),
  render: $('btn-render'), renderOut: $('render-out'), playlist: $('playlist'), mixSub: $('mix-sub'),
  modes: [...document.querySelectorAll('input[name="mode"]')],
  liveRow: $('live-row'), live: $('live'), liveRate: $('live-rate'), video: $('live-video'), stage: $('stage'),
};

const state = {
  ds: null, frames: null, frame: 0, cache: new Map(), pending: new Map(), progress: new Map(), loadToken: 0,
  ctx: null, engine: null, player: null, muted: new Map(), activity: {},
  cursor: { r: Math.floor(ROWS / 2), c: Math.floor(COLS / 2) }, exploring: false, lastNarrated: -1, resumeAt: null,
  live: null, // { frames, staticFrames, timer } while Live video is on
};
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const mutedFor = (id) => { const k = `${MODE}:${id}`; if (!state.muted.has(k)) state.muted.set(k, new Set()); return state.muted.get(k); };

// ---------- audio ----------
function ensureAudio() {
  if (!state.ctx) {
    state.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
    state.engine = new Engine(state.ctx);
    state.engine.setVolume(Number(el.volume.value));
    state.player = new Player(state.engine);
    state.player.onStep = onStep;
    if (state.frames) { state.player.load(state.ds, state.frames); applyMutes(); }
  }
  if (state.ctx.state === 'suspended') state.ctx.resume();
  return state.engine;
}
/** Load the orchestral samples once (only needed in Orchestra mode). */
async function ensureOrchestra() {
  const E = ensureAudio();
  if (E.samples) return true;
  try {
    setStatus('Loading orchestra samples…');
    const bank = await loadSamples(state.ctx, (i, n) => setStatus(`Loading orchestra samples… ${i} of ${n}`));
    state.bank = bank;
    attachSamples(E, bank);
    setStatus(state.live ? 'Live video · orchestra loaded' : `Ready · ${state.frames?.length ?? 0} frames · orchestra loaded`);
    return true;
  } catch (err) {
    console.error(err);
    setStatus(`Could not load orchestra samples (${err.message}); using Scientific mode.`, true);
    setModeUI('science');
    return false;
  }
}
function applyMutes() {
  if (!state.engine || !state.ds) return;
  const m = mutedFor(state.ds.id);
  for (const id of currentLayerIds()) state.engine.setMuted(id, m.has(id));
}
function currentLayerIds() {
  const frames = state.live?.staticFrames || state.frames;
  if (MODE === 'orchestra' && frames) return [...familiesUsed(frames, state.ds), ...FOUNDATION.map((x) => x.id)];
  return state.ds.layers.map((l) => l.id);
}

// ---------- mode + tempo ----------
function sweepFor(mult) {
  if (MODE === 'orchestra') return sweepForBpm(orchestraFor(state.ds.id).bpm * mult);
  return 8 / mult;
}
function applyTempo() {
  if (!state.ds) return;
  const mult = Number(el.tempo.value);
  for (const o of el.tempo.options) {
    const m = Number(o.value), name = o.textContent.split(' ·')[0];
    o.textContent = MODE === 'orchestra'
      ? `${name} · ${Math.round(orchestraFor(state.ds.id).bpm * m)} BPM`
      : `${name} · ${(8 / m).toFixed(0)} s per frame`;
  }
  const s = sweepFor(mult);
  if (state.player?.playing) state.player.setSweep(s); else setSweep(s);
}
function setModeUI(mode) {
  setMode(mode);
  for (const r of el.modes) r.checked = r.value === mode;
  if (!state.ds) return;
  renderHearing();
  if (state.frames) buildMixer();
  applyTempo();
}
async function changeMode(mode) {
  const wasPlaying = state.player?.playing;
  const pos = state.player?.position();
  state.player?.stop();
  setModeUI(mode);
  if (mode === 'orchestra' && state.ctx) await ensureOrchestra();
  applyMutes();
  if (wasPlaying) {
    if (MODE === 'orchestra') await ensureOrchestra();
    state.player.start(Math.floor(pos ?? 0));
    requestAnimationFrame(draw);
  }
}
function renderHearing() {
  const ds = state.ds;
  if (MODE === 'orchestra') {
    const cfg = orchestraFor(ds.id);
    el.hearing.innerHTML = [
      `A sampled chamber orchestra at ${cfg.bpm} BPM. Each frame is four bars; the playhead crosses one map column per sixteenth note.`,
      'Every colour on the map has its own section (see the mixer): blue strings, green woodwinds, yellow harp, orange horns, red trumpets, violet violas, white piano and glockenspiel.',
      'Louder and busier sections mean more of that colour in the strip being played. Pitch still follows latitude: north is higher.',
      'The strongest colour of each frame carries the melody; double bass and drums keep the pulse, and the groove gets denser where the data is busier.',
      ...(ds.id === 'lightning' ? ['Here the drums are the data: every flash cluster is a snare (north) or timpani (south) hit.'] : []),
      ...(cfg.progs.length > 1 ? ['When the air is heavily loaded, the chord progression turns darker.'] : []),
    ].map((h) => `<li>${esc(h)}</li>`).join('');
    el.mixSub.textContent = 'One colour, one section of the orchestra. Switch sections on and off to hear each colour separately.';
  } else {
    el.hearing.innerHTML = ds.hearing.map((h) => `<li>${esc(h)}</li>`).join('');
    el.mixSub.textContent = 'Each visual layer is its own instrument. Switch layers on and off to hear them separately.';
  }
}
el.modes.forEach((r) => r.addEventListener('change', () => r.checked && changeMode(r.value)));

// ---------- live video ----------
// The real SVS animation plays on the stage; 4 times a second its current picture is
// analysed with the same scale as the dated frames, and the composer plays from it.
async function startLive() {
  const ds = state.ds;
  if (!ds.live || !state.frames || state.live) return;
  const staticFrames = state.frames;
  const wasPlaying = state.player?.playing;
  const v = el.video;
  v.src = `api/media?url=${encodeURIComponent(ds.live.src)}`;
  v.hidden = false; el.img.hidden = true; el.stage.classList.add('live');
  showLoader('Connecting to the NASA SVS animation…');
  try {
    await new Promise((res, rej) => {
      v.onloadeddata = res;
      v.onerror = () => rej(new Error(v.error?.message || 'video error'));
      setTimeout(() => rej(new Error('timed out')), 45000);
    });
  } catch (err) {
    el.loader.hidden = true;
    teardownVideo();
    el.live.checked = false;
    setStatus(`Live video unavailable: ${err.message}`, true);
    return;
  }
  el.loader.hidden = true;
  v.playbackRate = Number(el.liveRate.value);
  const frame = { label: '', ch: null, stats: null };
  const frames = [frame];
  frames.geo = staticFrames.geo; frames.norm = staticFrames.norm;
  frames._orchRef = orchestraRef(ds, staticFrames);
  let cost = 0;
  const sample = () => {
    if (v.readyState < 2 || !v.videoWidth) return;
    const frac = v.duration ? v.currentTime / v.duration : 0;
    const t0 = performance.now();
    const { ch, stats } = analyzeLive(v, ds, frames.norm, frames.geo);
    cost = performance.now() - t0;
    frame.ch = ch; frame.stats = stats; frame.label = liveLabel(ds, frac);
    delete frame._orch;
    el.badgeDate.textContent = frame.label;
    el.timeline.setAttribute('aria-valuetext', `Live video, ${frame.label}`);
  };
  sample();
  // analyse ~4x per second, slower if this computer needs longer per picture (keeps audio smooth)
  const loop = () => {
    if (!state.live) return;
    sample();
    state.live.timer = setTimeout(loop, Math.max(250, cost * 3));
  };
  state.live = { frames, staticFrames, savedFrame: state.frame, timer: setTimeout(loop, 250) };
  state.player?.load(ds, frames);
  state.frames = frames; state.frame = 0; state.resumeAt = null;
  el.badgeSub.textContent = 'live NASA animation';
  el.frameLabel.textContent = `Live video · ${Math.round(v.duration)} s animation at ${v.playbackRate}× speed`;
  el.img.alt = `${ds.title}: live animation from NASA SVS.`;
  setStatus('Live video ready · the music follows the animation as it plays');
  narrate(`Live video on. ${frame.label}.`);
  if (wasPlaying) await togglePlay();
}
function teardownVideo() {
  const v = el.video;
  v.pause(); v.removeAttribute('src'); v.load();
  v.hidden = true; el.img.hidden = false; el.stage.classList.remove('live');
}
function stopLive({ resume = true } = {}) {
  if (!state.live) return;
  const wasPlaying = state.player?.playing;
  clearTimeout(state.live.timer);
  const { staticFrames, savedFrame } = state.live;
  state.live = null;
  teardownVideo();
  state.frames = staticFrames;
  state.player?.load(state.ds, staticFrames);
  showFrame(savedFrame);
  if (resume && wasPlaying) togglePlay();
}
el.live.addEventListener('change', () => (el.live.checked ? startLive() : stopLive()));
el.liveRate.addEventListener('change', () => {
  el.video.playbackRate = Number(el.liveRate.value);
  if (state.live) el.frameLabel.textContent = `Live video · ${Math.round(el.video.duration)} s animation at ${el.video.playbackRate}× speed`;
});

// ---------- status ----------
function setStatus(msg, isError = false) {
  el.status.textContent = msg;
  el.status.classList.toggle('error', isError);
}
const narrate = (text) => { el.narration.textContent = text; };

function showLoader(msg) {
  el.loader.hidden = false;
  el.loaderText.textContent = msg;
  const m = /(\d+) of (\d+)/.exec(msg);
  if (m) el.loaderBar.style.width = `${(Number(m[1]) / Number(m[2])) * 100}%`;
}

// ---------- hero + dataset list ----------
function buildHero() {
  const frames = DATASETS.reduce((s, d) => s + (d.video ? d.video.samples.length : d.frames.length), 0);
  el.heroStats.innerHTML = [
    `<strong>${DATASETS.length}</strong> NASA visualizations`,
    `<strong>${frames}</strong> dated frames`,
    `<strong>2007–2024</strong> of Earth data`,
    `<strong>0</strong> install steps for listeners`,
  ].map((h) => `<li>${h}</li>`).join('');
}

function buildList() {
  el.list.innerHTML = '';
  DATASETS.forEach((ds, i) => {
    const label = document.createElement('label');
    label.className = 'ds-card';
    const thumbSrc = thumbUrl(ds);
    label.innerHTML = `<input type="radio" name="dataset" value="${ds.id}">
      <span class="thumb" aria-hidden="true"></span>
      <span><span class="t">${esc(ds.title)}</span><span class="s">${esc(ds.timeSpan)}</span></span>
      <span class="k" aria-hidden="true">${i + 1}</span>`;
    label.querySelector('input').addEventListener('change', () => selectDataset(ds.id));
    // lazy thumbnail (also warms the server cache)
    const img = new Image();
    img.onload = () => { label.querySelector('.thumb').style.backgroundImage = `url("${thumbSrc}")`; };
    img.src = thumbSrc;
    el.list.appendChild(label);
  });
}

async function selectDataset(id, { autoplay = false } = {}) {
  const ds = byId(id);
  if (!ds) return;
  if (state.live) stopLive({ resume: false });
  el.live.checked = false;
  el.liveRow.hidden = !ds.live;
  if (STATIC) { el.live.disabled = true; el.liveRate.disabled = true; $('live-note').hidden = false; }
  const wasPlaying = state.player?.playing;
  state.player?.stop();
  updatePlayButton(false);
  state.ds = ds; state.frames = null; state.frame = 0; state.resumeAt = null;
  const token = ++state.loadToken;

  el.list.querySelector(`input[value="${id}"]`).checked = true;
  el.title.textContent = ds.title;
  el.timeSpan.textContent = ds.timeSpan;
  el.source.href = ds.sourceUrl;
  el.source.textContent = `NASA SVS #${ds.svsId}`;
  el.credit.textContent = ds.credit;
  el.summary.textContent = ds.summary;
  renderHearing();
  el.frameDesc.textContent = '';
  el.badgeDate.textContent = '–'; el.badgeSub.textContent = '';
  el.img.classList.add('loading');
  el.img.alt = `${ds.title}: loading.`;
  el.loader.hidden = true;
  el.nowChip.hidden = true;
  el.trend.innerHTML = ''; el.trendTable.innerHTML = ''; el.trendSub.textContent = '';
  el.tlTicks.innerHTML = '';
  el.mixer.innerHTML = '';
  setButtons(false);
  history.replaceState(null, '', `#${id}`);

  try {
    let frames = state.cache.get(id);
    if (!frames) {
      setStatus('Fetching frames from NASA SVS…');
      showLoader('Fetching frames from NASA SVS… (the first load downloads full-resolution frames; after that they are cached)');
      // one load per dataset, even if it is selected again while loading
      if (!state.pending.has(id)) {
        const p = loadDataset(ds, (m) => { state.progress.set(id, m); if (state.ds?.id === id && !state.frames) showLoader(m); })
          .then((fr) => { state.cache.set(id, fr); return fr; })
          .finally(() => state.pending.delete(id));
        state.pending.set(id, p);
      } else if (state.progress.has(id)) showLoader(state.progress.get(id));
      frames = await state.pending.get(id);
    }
    if (token !== state.loadToken) return;
    el.loader.hidden = true;
    state.frames = frames;
    state.player?.load(ds, frames);
    buildMixer();
    applyMutes();
    applyTempo();
    buildTimeline();
    drawTrend();
    showFrame(0);
    setButtons(true);
    setStatus(`Ready · ${frames.length} frames · press Play or Space`);
    if (autoplay || wasPlaying) togglePlay();
  } catch (err) {
    if (token !== state.loadToken) return;
    console.error(err);
    el.loader.hidden = true;
    setStatus(`Could not load this visualization: ${err.message}. Is the local server running and online?`, true);
  }
}

function setButtons(on) {
  for (const b of [el.play, el.prev, el.next, el.render]) b.disabled = !on;
}

// ---------- mixer ----------
function buildMixer() {
  const ds = state.ds;
  const muted = mutedFor(ds.id);
  el.mixer.innerHTML = '';
  const frames = state.live?.staticFrames || state.frames;
  const layers = MODE === 'orchestra' && frames
    ? [...familiesUsed(frames, ds).map((id) => ({ id, label: FAMILIES[id].label, color: FAMILIES[id].color })), ...FOUNDATION]
    : ds.layers;
  for (const l of layers) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'layer-btn';
    b.style.setProperty('--sw', l.color);
    b.setAttribute('aria-pressed', String(!muted.has(l.id)));
    b.dataset.layer = l.id;
    b.innerHTML = `<span class="sw" aria-hidden="true"></span>${esc(l.label)}<span class="lvl" aria-hidden="true"><i></i></span>`;
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      if (on) muted.delete(l.id); else muted.add(l.id);
      state.engine?.setMuted(l.id, !on);
    });
    el.mixer.appendChild(b);
  }
}

// ---------- frames ----------
function shortLabel(ds, f) {
  if (ds.id === 'nightlights') return f.label;
  if (!f.date) return f.label;
  const d = new Date(`${f.date}T00:00:00Z`);
  if (ds.id === 'lightning') return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  if (ds.id === 'ocean') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace(' ', " '");
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function frameAlt(ds, f) {
  const regions = f.stats.topRegions?.length ? ` Most prominent: ${f.stats.topRegions.join(', ')}.` : '';
  return `${ds.title}, ${f.label}. ${ds.summary.split('. ')[0]}.${regions}`;
}

function metricValue(ds, f) {
  return (f.stats[ds.metric.key] || 0) * ds.metric.scale;
}
const fmtVal = (ds, v) => (ds.metric.unit === '%' ? `${v.toFixed(0)}%` : v.toFixed(1));

function frameDescription(ds, f, prevF) {
  const parts = [`${ds.metric.label}: ${fmtVal(ds, metricValue(ds, f))}${ds.metric.unit === '/100' ? ' out of 100' : ''}.`];
  if (prevF) {
    const a = metricValue(ds, prevF), b = metricValue(ds, f);
    if (ds.metric.unit === '%') {
      const d = b - a;
      if (Math.abs(d) >= 1) parts.push(`${d > 0 ? 'Up' : 'Down'} ${Math.abs(d).toFixed(0)} points from ${prevF.label}.`);
    } else if (a > 0) {
      const d = ((b - a) / a) * 100;
      if (Math.abs(d) >= 0.5) parts.push(`${d > 0 ? 'Up' : 'Down'} ${Math.abs(d).toFixed(0)} percent from ${prevF.label}.`);
    }
  }
  if (ds.id === 'aerosols') {
    const names = { carbon: 'smoke', dust: 'dust', salt: 'sea salt', sulfate: 'sulfate' };
    const ranked = channelsOf('aerosols').map((k) => [names[k], f.stats[k]]).sort((a, b) => b[1] - a[1]);
    parts.push(`Most widespread: ${ranked.slice(0, 2).map((x) => x[0]).join(' and ')}.`);
  }
  if (f.stats.topRegions?.length) parts.push(`Strongest regions: ${f.stats.topRegions.join(', ')}.`);
  return parts.join(' ');
}

function showFrame(i) {
  if (state.live) return; // the video is the picture
  el.loader.hidden = true;
  const f = state.frames[i];
  state.frame = i;
  if (el.img.getAttribute('src') !== f.url) {
    el.img.classList.add('loading');
    el.img.onload = () => el.img.classList.remove('loading');
    el.img.src = f.url;
  } else el.img.classList.remove('loading');
  el.img.alt = frameAlt(state.ds, f);
  el.badgeDate.textContent = f.label;
  el.badgeSub.textContent = `frame ${i + 1} of ${state.frames.length}`;
  el.frameLabel.textContent = `${f.label} · frame ${i + 1} of ${state.frames.length}`;
  el.frameDesc.textContent = frameDescription(state.ds, f, state.frames[i - 1]);
  el.timeline.setAttribute('aria-valuenow', String(i + 1));
  el.timeline.setAttribute('aria-valuetext', `${f.label}, frame ${i + 1} of ${state.frames.length}`);
  [...el.tlTicks.querySelectorAll('[data-i]')].forEach((t) => t.classList.toggle('on', Number(t.dataset.i) === i));
  el.trend.querySelectorAll('.pt').forEach((p, k) => {
    p.classList.toggle('on', k === i);
    p.setAttribute('r', k === i ? 6 : 4);
  });
  if (!state.player?.playing) updateTimeline(i * COLS);
}

function jumpToFrame(i, col = 0) {
  if (!state.frames) return;
  if (state.live) {
    // in live mode prev/next skip 5% through the animation
    const v = el.video;
    if (v.duration) v.currentTime = ((v.currentTime + Math.sign(i - state.frame || 1) * v.duration * 0.05) + v.duration) % v.duration;
    return;
  }
  const n = state.frames.length;
  i = ((i % n) + n) % n;
  showFrame(i);
  if (state.player?.playing) state.player.start(i * COLS + col);
  else { state.resumeAt = i * COLS + col; updateTimeline(state.resumeAt); narrate(`Frame ${i + 1}: ${state.frames[i].label}.`); }
}

// ---------- timeline ----------
function buildTimeline() {
  const n = state.frames.length;
  el.timeline.setAttribute('aria-valuemax', String(n));
  const width = el.timeline.clientWidth || 600;
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(width / 64))));
  el.tlTicks.innerHTML = state.frames.map((f, i) => {
    const x = (i / n) * 100;
    const lab = i % every === 0 ? `<span class="tl-label" data-i="${i}" style="left:calc(${x}% + ${50 / n}%)">${esc(shortLabel(state.ds, f))}</span>` : '';
    return `<span class="tl-tick" data-i="${i}" style="left:${x}%"></span>${lab}`;
  }).join('');
}
function updateTimeline(pos) {
  if (!state.frames) return;
  const total = state.frames.length * COLS;
  const v = el.video;
  const p = (state.live ? (v.duration ? v.currentTime / v.duration : 0) : Math.max(0, Math.min(1, pos / total))) * 100;
  el.tlFill.style.width = `${p}%`;
  el.tlHead.style.left = `calc(6px + (100% - 12px) * ${p / 100})`;
}
function timelineSeek(e) {
  if (!state.frames) return;
  const r = el.timeline.getBoundingClientRect();
  const x = Math.max(0, Math.min(0.9999, (e.clientX - r.left - 6) / (r.width - 12)));
  if (state.live) { if (el.video.duration) el.video.currentTime = x * el.video.duration; return; }
  const step = Math.floor(x * state.frames.length * COLS);
  jumpToFrame(Math.floor(step / COLS), step % COLS);
}
el.timeline.addEventListener('pointerdown', timelineSeek);
el.timeline.addEventListener('keydown', (e) => {
  const map = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -3, PageUp: 3 };
  if (e.key in map) { e.preventDefault(); jumpToFrame(state.frame + map[e.key]); }
  else if (e.key === 'Home') { e.preventDefault(); jumpToFrame(0); }
  else if (e.key === 'End') { e.preventDefault(); jumpToFrame(state.frames.length - 1); }
});

// ---------- trend chart (single series, one axis) ----------
function drawTrend() {
  const ds = state.ds, frames = state.frames;
  const vals = frames.map((f) => metricValue(ds, f));
  const W = 600, H = 170, L = 44, R = 14, T = 14, B = 28;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (ds.metric.unit === '%') { lo = Math.min(lo, 40); hi = Math.max(hi, 60); }
  const padV = (hi - lo) * 0.15 || 1;
  lo -= padV; hi += padV;
  const x = (i) => L + (frames.length === 1 ? 0.5 : i / (frames.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = [lo + padV, (lo + hi) / 2, hi - padV];
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const iMax = vals.indexOf(Math.max(...vals)), iMin = vals.indexOf(Math.min(...vals));
  const first = vals[0], last = vals[vals.length - 1];
  const pct = ds.metric.unit === '%';
  const change = pct ? last - first : first ? ((last - first) / first) * 100 : 0;
  const changeTxt = Math.abs(change) >= 1 ? ` (${change > 0 ? '+' : ''}${change.toFixed(0)}${pct ? ' points' : '%'})` : '';
  const summary = `${ds.metric.label}: ${fmtVal(ds, first)} in ${frames[0].label}, ${fmtVal(ds, last)} in ${frames[frames.length - 1].label}` +
    `${changeTxt}. Highest ${fmtVal(ds, vals[iMax])} in ${frames[iMax].label}, lowest ${fmtVal(ds, vals[iMin])} in ${frames[iMin].label}.`;
  el.trendSub.textContent = summary;
  const hitW = (W - L - R) / Math.max(1, frames.length - 1);
  el.trend.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(summary)}">
    <g class="grid">${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`).join('')}</g>
    <g class="axis">${ticks.map((v) => `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmtVal(ds, v)}</text>`).join('')}
      <text x="${x(0)}" y="${H - 8}" text-anchor="start">${esc(shortLabel(ds, frames[0]))}</text>
      <text x="${x(frames.length - 1)}" y="${H - 8}" text-anchor="end">${esc(shortLabel(ds, frames[frames.length - 1]))}</text></g>
    <path class="area" d="M${pts[0]} L${pts.join(' L')} L${x(frames.length - 1)},${H - B} L${x(0)},${H - B} Z"/>
    <polyline class="line" points="${pts.join(' ')}"/>
    ${vals.map((v, i) => `<rect class="hit" data-i="${i}" x="${x(i) - hitW / 2}" y="${T}" width="${hitW}" height="${H - T - B}"/><circle class="pt" cx="${x(i)}" cy="${y(v)}" r="4"/>`).join('')}
  </svg>`;
  el.trend.querySelectorAll('.hit').forEach((h) => {
    const i = Number(h.dataset.i);
    h.addEventListener('pointerenter', () => {
      const panel = el.trend.closest('.panel').getBoundingClientRect();
      const box = h.getBoundingClientRect();
      el.trendTip.innerHTML = `${esc(frames[i].label)}: <b>${fmtVal(ds, vals[i])}</b>`;
      el.trendTip.hidden = false;
      const tipW = el.trendTip.offsetWidth;
      const left = Math.max(8, Math.min(panel.width - tipW - 8, box.left - panel.left + box.width / 2 - tipW / 2));
      el.trendTip.style.left = `${left}px`;
      el.trendTip.style.top = `${box.top - panel.top - 30}px`;
    });
    h.addEventListener('pointerleave', () => { el.trendTip.hidden = true; });
    h.addEventListener('click', () => jumpToFrame(i));
  });
  el.trendTable.innerHTML = `<thead><tr><th scope="col">Frame</th><th scope="col">Date</th><th scope="col">${esc(ds.metric.label)}</th></tr></thead><tbody>${
    frames.map((f, i) => `<tr><td>${i + 1}</td><td>${esc(f.label)}</td><td>${fmtVal(ds, vals[i])}</td></tr>`).join('')}</tbody>`;
}

// ---------- transport ----------
function updatePlayButton(playing) {
  el.play.querySelector('.label').textContent = playing ? 'Pause' : 'Play';
  el.play.querySelector('.icon').textContent = playing ? '⏸' : '▶';
}

async function togglePlay() {
  if (!state.frames) return;
  ensureAudio();
  if (MODE === 'orchestra' && !state.engine.samples && !state.player.playing) {
    el.play.disabled = true;
    await ensureOrchestra();
    el.play.disabled = false;
  }
  const p = state.player;
  if (p.playing) {
    state.resumeAt = Math.floor(p.position() ?? 0);
    p.stop();
    if (state.live) el.video.pause();
    updatePlayButton(false);
    el.nowChip.hidden = true;
    narrate('Paused.');
  } else {
    const from = state.resumeAt ?? state.frame * COLS;
    state.resumeAt = null;
    p.start(from);
    if (state.live) el.video.play().catch(() => {});
    updatePlayButton(true);
    narrate(`Playing ${state.ds.short}, ${state.frames[Math.floor(from / COLS) % state.frames.length].label}.`);
    requestAnimationFrame(draw);
  }
}

function onStep(k) {
  const f = Math.floor(k / COLS), c = k % COLS;
  if (c === 0) setTimeout(() => state.player?.playing && showFrame(f), 120);
  if (c % 4 === 0) {
    const text = describeAt(state.ds, state.frames, f, c);
    setTimeout(() => {
      if (!state.player?.playing) return;
      el.nowChip.hidden = false;
      el.nowChip.textContent = text;
    }, 150);
  }
  if (el.narrate.checked && c % 16 === 0 && k !== state.lastNarrated) {
    state.lastNarrated = k;
    const text = describeAt(state.ds, state.frames, f, Math.min(COLS - 1, c + 2));
    setTimeout(() => state.player?.playing && narrate(text), 150);
  }
}

function describeNow() {
  if (!state.frames) return;
  const pos = state.player?.position();
  if (pos == null) {
    narrate(`${state.ds.title}, ${state.frames[state.frame].label}. ${el.frameDesc.textContent}`);
    return;
  }
  const k = Math.floor(pos);
  narrate(describeAt(state.ds, state.frames, Math.floor(k / COLS), k % COLS));
}

// ---------- drawing ----------
function sizeCanvas(cv) {
  const r = cv.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return { w, h, dpr };
}

function draw() {
  const { w, h, dpr } = sizeCanvas(el.overlay);
  const g = el.overlay.getContext('2d');
  g.clearRect(0, 0, w, h);
  const cw = w / COLS, rh = h / ROWS;

  if (el.grid.checked && state.frames) {
    const f = state.frames[state.frame];
    const comp = composerFor(state.ds.id);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const v = comp.probe(f, r, c);
      if (v <= 0.02) continue;
      g.fillStyle = `rgba(108,180,255,${Math.min(0.75, v * 0.8)})`;
      g.fillRect(c * cw + 1, r * rh + 1, cw - 2, rh - 2);
    }
  }

  const pos = state.player?.position();
  if (pos != null) {
    const f = Math.floor(pos / COLS) % state.frames.length;
    const x = ((pos % COLS) / COLS) * w;
    const grad = g.createLinearGradient(x - 60 * dpr, 0, x, 0);
    grad.addColorStop(0, 'rgba(255,207,92,0)');
    grad.addColorStop(1, 'rgba(255,207,92,0.28)');
    g.fillStyle = grad;
    g.fillRect(x - 60 * dpr, 0, 60 * dpr, h);
    g.fillStyle = '#ffcf5c';
    g.fillRect(x - dpr, 0, 2 * dpr, h);
    // glow on the cells that are sounding right now
    if (state.frames) {
      const c = Math.floor(pos % COLS);
      const comp = composerFor(state.ds.id);
      for (let r = 0; r < ROWS; r++) {
        const v = comp.probe(state.frames[f], r, c);
        if (v < 0.15) continue;
        g.beginPath();
        g.arc(x, (r + 0.5) * rh, (3 + 9 * Math.min(1, v)) * dpr, 0, Math.PI * 2);
        g.fillStyle = `rgba(255,230,150,${0.25 + 0.5 * Math.min(1, v)})`;
        g.fill();
      }
    }
    if (f !== state.frame && !el.img.classList.contains('loading')) showFrame(f);
    updateTimeline(pos);
  }

  if (state.exploring) {
    const { r, c } = state.cursor;
    g.strokeStyle = '#ffd84d';
    g.lineWidth = 2 * dpr;
    g.strokeRect(c * cw, r * rh, cw, rh);
    g.strokeStyle = 'rgba(255,216,77,0.35)';
    g.lineWidth = dpr;
    g.beginPath(); g.moveTo(0, (r + 0.5) * rh); g.lineTo(w, (r + 0.5) * rh); g.moveTo((c + 0.5) * cw, 0); g.lineTo((c + 0.5) * cw, h); g.stroke();
  }

  drawMeter();
  drawLayerLevels();
  if (state.player?.playing || state.exploring) requestAnimationFrame(draw);
}

let meterData = null;
function drawMeter() {
  const { w, h } = sizeCanvas(el.meter);
  const g = el.meter.getContext('2d');
  g.clearRect(0, 0, w, h);
  const an = state.engine?.analyser;
  if (!an) return;
  meterData ??= new Uint8Array(an.frequencyBinCount);
  an.getByteFrequencyData(meterData);
  const bins = 120;
  const bw = w / bins;
  for (let i = 0; i < bins; i++) {
    const idx = Math.floor((i / bins) ** 1.9 * meterData.length * 0.6);
    const v = meterData[idx] / 255;
    g.fillStyle = `hsl(${215 - v * 175}, 90%, ${42 + v * 22}%)`;
    const bh = Math.max(1, v * (h - 6));
    g.fillRect(i * bw + 1, h - 3 - bh, Math.max(1, bw - 2), bh);
  }
}

function drawLayerLevels() {
  const E = state.engine;
  if (!E) return;
  const act = E.activity || {};
  for (const b of el.mixer.querySelectorAll('.layer-btn')) {
    const id = b.dataset.layer;
    const target = Math.min(1, (act[id] || 0) * 0.12);
    state.activity[id] = Math.max(target, (state.activity[id] || 0) * 0.9);
    b.querySelector('.lvl i').style.width = `${Math.round(state.activity[id] * 100)}%`;
  }
  E.activity = {};
}

// ---------- map explorer ----------
function cellText(r, c) {
  const f = state.frames[state.frame];
  const lat = latOfRow(r, state.frames.geo), lon = lonOfCol(c, state.frames.geo);
  return `${fmtLat(lat)}, ${fmtLon(lon)}, ${regionName(lat, lon)}: ${composerFor(state.ds.id).probeText(f, r, c)}.`;
}
function probe(r, c, announce = true) {
  if (!state.frames) return;
  state.cursor = { r, c };
  const E = ensureAudio();
  if (MODE === 'orchestra' && !E.samples) ensureOrchestra();
  probeCell(E, state.ds, state.frames[state.frame], r, c, state.frames, state.frame);
  if (announce) narrate(cellText(r, c));
  if (!state.player?.playing) requestAnimationFrame(draw);
}

el.overlay.addEventListener('focus', () => { state.exploring = true; requestAnimationFrame(draw); });
el.overlay.addEventListener('blur', () => { state.exploring = false; requestAnimationFrame(draw); });
el.overlay.addEventListener('keydown', (e) => {
  if (!state.frames) return;
  let { r, c } = state.cursor;
  const step = e.shiftKey ? 4 : 1;
  switch (e.key) {
    case 'ArrowLeft': c = (c - step + COLS) % COLS; break;
    case 'ArrowRight': c = (c + step) % COLS; break;
    case 'ArrowUp': r = Math.max(0, r - step); break;
    case 'ArrowDown': r = Math.min(ROWS - 1, r + step); break;
    case 'Home': c = 0; break;
    case 'End': c = COLS - 1; break;
    case 'Enter': break;
    case 'Escape': el.play.focus(); e.preventDefault(); return;
    case ' ': togglePlay(); e.preventDefault(); return;
    default: return;
  }
  e.preventDefault();
  e.stopPropagation();
  probe(r, c);
});
let lastProbe = 0;
function pointerCell(e) {
  const rect = el.overlay.getBoundingClientRect();
  const c = Math.min(COLS - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * COLS)));
  const r = Math.min(ROWS - 1, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * ROWS)));
  return { r, c };
}
el.overlay.addEventListener('pointerdown', (e) => {
  el.overlay.setPointerCapture(e.pointerId);
  const { r, c } = pointerCell(e);
  probe(r, c);
});
el.overlay.addEventListener('pointermove', (e) => {
  if (!e.buttons) return;
  const now = performance.now();
  if (now - lastProbe < 90) return;
  lastProbe = now;
  const { r, c } = pointerCell(e);
  if (r !== state.cursor.r || c !== state.cursor.c) probe(r, c);
});

// ---------- export ----------
el.render.addEventListener('click', async () => {
  if (!state.frames) return;
  el.render.disabled = true;
  el.renderOut.textContent = 'Rendering… this takes a few seconds.';
  try {
    const t0 = performance.now();
    if (MODE === 'orchestra' && !(await ensureOrchestra())) throw new Error('orchestra samples unavailable');
    const buf = await renderOffline(state.ds, state.live?.staticFrames || state.frames, { sweep: SWEEP_SECONDS, muted: [...mutedFor(state.ds.id)], mode: MODE, samples: state.bank });
    const blob = encodeWav(buf);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `earth-jukebox-${state.ds.id}-${MODE}.wav`;
    a.textContent = `Download ${a.download} (${(blob.size / 1e6).toFixed(1)} MB, ${Math.round(buf.duration)} s)`;
    el.renderOut.textContent = `Done in ${((performance.now() - t0) / 1000).toFixed(1)} s. `;
    el.renderOut.appendChild(a);
  } catch (err) {
    console.error(err);
    el.renderOut.textContent = `Render failed: ${err.message}`;
  } finally {
    el.render.disabled = false;
  }
});

async function loadPlaylist() {
  try {
    const res = await fetch('playlist/playlist.json');
    if (!res.ok) return;
    const tracks = await res.json();
    if (!tracks.length) return;
    el.playlist.innerHTML = '';
    for (const t of tracks) {
      const ds = byId(t.dataset);
      const div = document.createElement('div');
      div.className = 'track';
      const thumb = ds ? `<img src="${thumbUrl(ds)}" alt="" loading="lazy">` : '';
      const mode = t.mode === 'orchestra' ? 'Orchestra' : t.mode === 'science' ? 'Scientific' : '';
      div.innerHTML = `${thumb}<span class="name">${esc(t.title)}${mode ? ` · ${mode}` : ''} <span class="muted small">· ${t.seconds} s · ${esc(t.frames[0])} → ${esc(t.frames[t.frames.length - 1])}</span></span>
        <audio controls preload="none" src="playlist/${encodeURIComponent(t.file)}" aria-label="${esc(t.title)}, ${mode || 'soundscape'}"></audio>`;
      el.playlist.appendChild(div);
    }
  } catch { /* no playlist yet */ }
}

// ---------- wiring ----------
el.play.addEventListener('click', togglePlay);
el.prev.addEventListener('click', () => jumpToFrame(state.frame - 1));
el.next.addEventListener('click', () => jumpToFrame(state.frame + 1));
el.volume.addEventListener('input', () => state.engine?.setVolume(Number(el.volume.value)));
el.tempo.addEventListener('change', applyTempo);
el.grid.addEventListener('change', () => requestAnimationFrame(draw));
window.addEventListener('resize', () => { if (state.frames) buildTimeline(); requestAnimationFrame(draw); });

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t === el.overlay || t === el.timeline) { if (e.key !== 'k' && e.key !== 'K' && e.key !== ' ') return; }
  const typing = t.closest?.('input[type=range], input[type=text], textarea, select');
  const onButton = t.tagName === 'BUTTON' || t.tagName === 'SUMMARY' || (t.tagName === 'INPUT' && t.type !== 'radio');
  if (typing) return;
  const key = e.key.toLowerCase();
  if ((key === ' ' && !onButton) || key === 'k') { e.preventDefault(); togglePlay(); }
  else if (key === 'n') jumpToFrame(state.frame + 1);
  else if (key === 'p') jumpToFrame(state.frame - 1);
  else if (key === 'd') describeNow();
  else if (key === 'e') el.overlay.focus();
  else if (key === 't') el.timeline.focus();
  else if (/^[1-9]$/.test(key) && DATASETS[Number(key) - 1]) selectDataset(DATASETS[Number(key) - 1].id);
});

window.__jukebox = state; // handy for debugging in the console

if (STATIC) $('data-note').textContent = 'Frames were downloaded from NASA SVS and analysed in advance (tools: bake.html); the local version streams them live.';
setMode(el.modes.find((r) => r.checked)?.value || 'orchestra');
buildHero();
buildList();
loadPlaylist();
selectDataset(byId(location.hash.slice(1)) ? location.hash.slice(1) : DATASETS[0].id);
requestAnimationFrame(draw);

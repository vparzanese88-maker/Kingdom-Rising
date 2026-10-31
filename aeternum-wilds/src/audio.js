// Aeternum Wilds: sound, music and ambience.
// Everything here is synthesized with the Web Audio API (original work), except the CC0 recordings in ../audio/rec:
// swing1-10 / clash1-10 (sword swings and clashes) and battle-music.mp3 ("Battle Theme A" by cynicmusic, CC0).
// Music is original procedural orchestral writing, generated in real time by a lookahead scheduler.

let ctx = null, master = null, comp = null;
let musicBus = null, sfxBus = null, ambBus = null;
let revIn = null, musicRevSend = null, sfxRevSend = null, ambRevSend = null;
let NZ = null;
const buffers = {};
export let volume = 0.6;
let musicVol = 0.5, sfxVol = 1.0, ambVol = 0.6;

// ---------------------------------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------------------------------
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const vr = (a = 0.06) => 1 + (Math.random() * 2 - 1) * a;
const r10 = () => 1 + ((Math.random() * 10) | 0);
const rp = (w = 0.3) => rnd(-w, w);

let live = 0;                      // sounding source nodes, used to bound the voice count
const MAX_LIVE = 340;
function done(src, nodes) {
  live++;
  src.onended = () => { live--; for (const n of nodes) { try { n.disconnect(); } catch (e) { /* gone */ } } };
}
function drop(nodes, ms) { setTimeout(() => { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* gone */ } } }, ms); }
function env(p, t, a, h, r, v) {
  v = Math.max(v, 0.0002);
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(v, t + a);
  if (h > 0) p.setValueAtTime(v, t + a + h);
  p.exponentialRampToValueAtTime(0.0001, t + a + h + r);
  return t + a + h + r;
}

// ---------------------------------------------------------------------------------------------
// init, buses, reverb, noise
// ---------------------------------------------------------------------------------------------
function makeNoise() {
  const sr = ctx.sampleRate, n = Math.floor(sr * 3), xf = Math.floor(sr * 0.05), m = n + xf;
  const w = new Float32Array(m), p = new Float32Array(m), b = new Float32Array(m);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
  for (let i = 0; i < m; i++) {
    const x = Math.random() * 2 - 1;
    w[i] = x;
    b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
    b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
    p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11; b6 = x * 0.115926;
    br = (br + 0.02 * x) / 1.02; b[i] = br * 3.5;
  }
  // blend the extra tail into the head, so sample n-1 runs smoothly into sample 0: seamless loops
  const out = {};
  for (const [name, d] of [['white', w], ['pink', p], ['brown', b]]) {
    for (let i = 0; i < xf; i++) { const k = i / xf; d[i] = d[i] * k + d[n + i] * (1 - k); }
    const bf = ctx.createBuffer(1, n, sr); bf.getChannelData(0).set(d.subarray(0, n)); out[name] = bf;
  }
  NZ = out;
}
function makeImpulse(sec = 3.2) {
  const sr = ctx.sampleRate, len = Math.floor(sr * sec), b = ctx.createBuffer(2, len, sr);
  const taps = [[0.011, 0.6], [0.019, 0.45], [0.027, 0.4], [0.041, 0.3], [0.053, 0.25], [0.067, 0.2]];
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let y = 0;
    for (let i = 0; i < len; i++) {
      const k = i / len, tt = i / sr;
      const a = 0.85 - 0.72 * k;                // tail darkens over time
      y += a * ((Math.random() * 2 - 1) - y);
      d[i] = y * Math.exp(-tt * 2.1) * (1 - k) * (tt < 0.008 ? tt / 0.008 : 1);
    }
    for (const [tt, g] of taps) { const i = Math.floor((tt + (c ? 0.003 : 0)) * sr); if (i < len) d[i] += g * (Math.random() < 0.5 ? -1 : 1); }
  }
  return b;
}

export function initAudio() {
  try {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = volume;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = musicVol; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = ambVol; ambBus.connect(master);
    // shared hall: generated impulse, high-passed input so the low end stays clean
    revIn = ctx.createGain();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 170;
    const conv = ctx.createConvolver(); conv.buffer = makeImpulse(3.2);
    const ro = ctx.createGain(); ro.gain.value = 0.85;
    revIn.connect(hp); hp.connect(conv); conv.connect(ro); ro.connect(master);
    musicRevSend = ctx.createGain(); musicRevSend.gain.value = musicVol; musicRevSend.connect(revIn);
    sfxRevSend = ctx.createGain(); sfxRevSend.gain.value = sfxVol; sfxRevSend.connect(revIn);
    ambRevSend = ctx.createGain(); ambRevSend.gain.value = ambVol; ambRevSend.connect(revIn);
    makeNoise();
    if (ctx.state === 'suspended') ctx.resume();
    const load = async (name, url) => {
      try {
        const r = await fetch(url); if (!r.ok) return;
        const b = await ctx.decodeAudioData(await r.arrayBuffer());
        buffers[name] = b;
        if (name === 'battle') buffers.battleLoop = trimLoop(b);
      } catch (e) { /* synth fallback */ }
    };
    for (let i = 1; i <= 10; i++) { load('swing' + i, `../audio/rec/swing${i}.mp3`); load('clash' + i, `../audio/rec/clash${i}.mp3`); }
    load('battle', '../audio/rec/battle-music.mp3');
    setInterval(tick, 25);
    if (curState !== 'none') startState(curState);
    applyAmbience();
  } catch (e) { /* audio unavailable */ }
}
function trimLoop(b) { // skip mp3 encoder padding so the loop is seamless
  const d = b.getChannelData(0), th = 0.003; let a = 0, z = d.length - 1;
  while (a < d.length && Math.abs(d[a]) < th) a++;
  while (z > a && Math.abs(d[z]) < th) z--;
  return { start: a / b.sampleRate, end: (z + 1) / b.sampleRate };
}
function ramp(param, v, tc = 0.03) { if (!ctx || !param) return; const now = ctx.currentTime; param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); param.setTargetAtTime(v, now, tc); }
export function setVolume(v) { volume = clamp(+v || 0, 0, 1); if (master) ramp(master.gain, volume); }
export function setMusicVolume(v) { musicVol = clamp(+v || 0, 0, 1); if (musicBus) { ramp(musicBus.gain, musicVol); ramp(musicRevSend.gain, musicVol); } }
export function setSfxVolume(v) { sfxVol = clamp(+v || 0, 0, 1); if (sfxBus) { ramp(sfxBus.gain, sfxVol); ramp(sfxRevSend.gain, sfxVol); } }
function duck(amt = 0.5, hold = 0.4) {
  if (!musicBus) return;
  const g = musicBus.gain, now = ctx.currentTime;
  g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(musicVol * amt, now + 0.05);
  g.setTargetAtTime(musicVol, now + 0.05 + hold, 0.5);
}

// ---------------------------------------------------------------------------------------------
// synthesis primitives (all scheduled at an absolute time t)
// ---------------------------------------------------------------------------------------------
// oscillator voice: o = { f, f1, glide, types, det, mix, a, h, r, v, lp, lp1, lpT, lp2, lp2T, ft, q, vib, vibRate, vibD }
function voice(dest, t, o) {
  const a = o.a ?? 0.005, h = o.h ?? 0, r = o.r ?? 0.2, end = t + a + h + r;
  const g = ctx.createGain(); env(g.gain, t, a, h, r, o.v ?? 0.2);
  const nodes = [g]; let head = g;
  if (o.lp) {
    const fl = ctx.createBiquadFilter(); fl.type = o.ft || 'lowpass'; fl.Q.value = o.q ?? 0.7;
    fl.frequency.setValueAtTime(o.lp, t);
    if (o.lp1) fl.frequency.exponentialRampToValueAtTime(o.lp1, t + (o.lpT ?? a + 0.001));
    if (o.lp2) fl.frequency.exponentialRampToValueAtTime(o.lp2, t + (o.lpT ?? a + 0.001) + (o.lp2T ?? h + r));
    fl.connect(g); head = fl; nodes.push(fl);
  }
  g.connect(dest);
  let lfoG = null;
  if (o.vib) {
    const lfo = ctx.createOscillator(); lfo.frequency.value = o.vibRate || rnd(4.7, 5.8);
    lfoG = ctx.createGain(); lfoG.gain.setValueAtTime(0, t); lfoG.gain.linearRampToValueAtTime(o.vib, t + (o.vibD ?? 0.3));
    lfo.connect(lfoG); lfo.start(t); lfo.stop(end + 0.05); nodes.push(lfo, lfoG);
  }
  const types = o.types || [o.type || 'sine'], det = o.det || [0];
  let last = null;
  for (let i = 0; i < types.length; i++) {
    const s = ctx.createOscillator(); s.type = types[i];
    const mul = o.mul ? o.mul[i] : 1;
    s.frequency.setValueAtTime(o.f * mul, t);
    if (o.f1) s.frequency.exponentialRampToValueAtTime(Math.max(5, o.f1 * mul), t + (o.glide ?? a + h + r));
    s.detune.value = det[i % det.length] || 0;
    if (lfoG) lfoG.connect(s.detune);
    if (o.mix) { const mg = ctx.createGain(); mg.gain.value = o.mix[i] ?? 1; s.connect(mg); mg.connect(head); nodes.push(mg); }
    else s.connect(head);
    s.start(t); s.stop(end + 0.05); nodes.push(s); last = s;
  }
  done(last, nodes);
  return end;
}
// filtered noise: o = { c, f, f1, fT, f2, ft, q, a, h, r, v, rate }
function nz(dest, t, o) {
  const a = o.a ?? 0.002, h = o.h ?? 0, r = o.r ?? 0.1, end = t + a + h + r;
  const s = ctx.createBufferSource(); s.buffer = NZ[o.c || 'white']; s.loop = true;
  if (o.rate) s.playbackRate.value = o.rate;
  const g = ctx.createGain(); env(g.gain, t, a, h, r, o.v ?? 0.2);
  const nodes = [s, g];
  if (o.f) {
    const fl = ctx.createBiquadFilter(); fl.type = o.ft || 'bandpass'; fl.Q.value = o.q ?? 1;
    fl.frequency.setValueAtTime(o.f, t);
    if (o.f1) fl.frequency.exponentialRampToValueAtTime(o.f1, t + (o.fT ?? a + h + r));
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, end);
    s.connect(fl); fl.connect(g); nodes.push(fl);
  } else s.connect(g);
  g.connect(dest);
  s.start(t, Math.random() * 2.5); s.stop(end + 0.05); done(s, nodes);
  return end;
}
// FM bell / metal: o = { f, ratio, idx, dur, v, a }
function fm(dest, t, o) {
  const a = o.a ?? 0.002, end = t + a + o.dur;
  const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
  c.frequency.value = o.f; m.frequency.value = o.f * (o.ratio || 2);
  mg.gain.setValueAtTime(o.f * (o.idx ?? 2), t); mg.gain.exponentialRampToValueAtTime(Math.max(1, o.f * (o.idx ?? 2) * 0.04), end);
  env(g.gain, t, a, 0, o.dur, o.v ?? 0.1);
  m.connect(mg); mg.connect(c.frequency); c.connect(g); g.connect(dest);
  m.start(t); c.start(t); m.stop(end + 0.05); c.stop(end + 0.05);
  done(c, [c, m, mg, g]);
  return end;
}
// amplitude-modulation insert (tremolo / growl / spin)
function am(dest, t, end, rate, depth) {
  const g = ctx.createGain(); g.gain.value = 1 - depth / 2;
  const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = rate; lg.gain.value = depth / 2;
  l.connect(lg); lg.connect(g.gain); g.connect(dest); l.start(t); l.stop(end + 0.1);
  done(l, [l, lg, g]);
  return g;
}
function autopan(dest, t, end, rate, depth) {
  if (!ctx.createStereoPanner) return dest;
  const p = ctx.createStereoPanner(), l = ctx.createOscillator(), lg = ctx.createGain();
  l.frequency.value = rate; lg.gain.value = depth; l.connect(lg); lg.connect(p.pan); p.connect(dest);
  l.start(t); l.stop(end + 0.1); done(l, [l, lg, p]);
  return p;
}
// Karplus-Strong plucked string (lute / harp), cached per pitch
const ksCache = new Map();
function ksBuf(midi, bright) {
  const key = midi + ':' + bright;
  let k = ksCache.get(key); if (k) return k;
  const sr = ctx.sampleRate, f = mtof(midi), N = Math.max(2, Math.floor(sr / f - 0.5));
  const len = Math.floor(sr * 1.7), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
  let y = 0, mean = 0; const a = 0.15 + bright * 0.8;
  for (let i = 0; i < N; i++) { y += a * ((Math.random() * 2 - 1) - y); d[i] = y; mean += y; }
  mean /= N; for (let i = 0; i < N; i++) d[i] -= mean;
  const damp = 0.9965 + bright * 0.002;
  d[N] = d[0] * damp;
  for (let i = N + 1; i < len; i++) d[i] = damp * 0.5 * (d[i - N] + d[i - N - 1]);
  const fo = Math.floor(sr * 0.08); for (let i = 0; i < fo; i++) d[len - 1 - i] *= i / fo;
  k = { buf: b, rate: f * (N + 0.5) / sr };
  ksCache.set(key, k);
  if (ksCache.size > 56) ksCache.delete(ksCache.keys().next().value);
  return k;
}
function pluck(dest, t, midi, v = 0.1, bright = 0.5, len = 1.2) {
  const k = ksBuf(Math.round(midi), Math.round(bright * 4) / 4);
  const s = ctx.createBufferSource(); s.buffer = k.buf; s.playbackRate.value = k.rate;
  const g = ctx.createGain(); const e = Math.min(len, 1.5);
  g.gain.setValueAtTime(v, t); g.gain.setValueAtTime(v, t + e); g.gain.exponentialRampToValueAtTime(0.0001, t + e + 0.15);
  s.connect(g); g.connect(dest); s.start(t); s.stop(t + e + 0.2); done(s, [s, g]);
}
function buf(dest, t, name, v = 1, rate = 1) {
  const b = buffers[name]; if (!b) return false;
  const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = v;
  s.connect(g); g.connect(dest); s.start(t); done(s, [s, g]);
  return true;
}
// output chain for one sound: gain > panner > bus, plus a reverb send
function chain(bus, revBus, v, pan, rev, life) {
  const g = ctx.createGain(); g.gain.value = v;
  const nodes = [g]; let tail = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); tail = p; nodes.push(p); }
  tail.connect(bus);
  if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; tail.connect(s); s.connect(revBus); nodes.push(s); }
  drop(nodes, life * 1000 + 500);
  return g;
}
const O = (v = 1, pan = rp(0.2), rev = 0.15, life = 3) => chain(sfxBus, sfxRevSend, v, pan, rev, life);

// shared musical instruments ------------------------------------------------------------------
const INS = {
  str(d, t, m, len, v, o = {}) {
    return voice(d, t, { types: ['sawtooth', 'sawtooth'], det: [-7 + rnd(-2, 2), 7 + rnd(-2, 2)], f: mtof(m), a: o.a ?? 0.25, h: len, r: o.r ?? 0.6, v, lp: o.lp ?? 1500, q: 0.5, vib: o.vib ?? 7, vibD: 0.5 });
  },
  short(d, t, m, len, v, lp = 1600) {
    return voice(d, t, { types: ['sawtooth', 'sawtooth'], det: [-6, 6], f: mtof(m), a: 0.006, h: len * 0.4, r: len * 0.7, v, lp: lp * 2, lp1: lp, lpT: 0.06, q: 0.9 });
  },
  horn(d, t, m, len, v, bright = 1) {
    return voice(d, t, { types: ['sawtooth', 'triangle'], det: [-4, 4], mix: [1, 0.8], f: mtof(m), a: 0.07, h: len, r: 0.35, v, lp: 260, lp1: 1500 * bright, lpT: 0.12, lp2: 850 * bright, lp2T: len + 0.3, q: 1.1, vib: 8, vibD: 0.5 });
  },
  flute(d, t, m, len, v) {
    voice(d, t, { types: ['sine', 'triangle'], mix: [1, 0.25], f: mtof(m), a: 0.12, h: len, r: 0.35, v, vib: 16, vibD: 0.45 });
    nz(d, t, { c: 'pink', f: mtof(m) * 2, q: 2.5, a: 0.06, r: 0.18, v: v * 0.6 });
  },
  bass(d, t, m, len, v, lp = 420) {
    return voice(d, t, { types: ['sawtooth', 'sine'], mix: [0.7, 1], f: mtof(m), a: 0.05, h: len, r: 0.35, v, lp, q: 0.7 });
  },
  bell(d, t, m, v, dur = 2.6) { fm(d, t, { f: mtof(m), ratio: 2.0, idx: 1.5, dur, v }); fm(d, t, { f: mtof(m) * 2.76, ratio: 1.41, idx: 0.6, dur: dur * 0.4, v: v * 0.25 }); },
  choir(d, t, m, len, v, vow = 'ah', o = {}) {
    const F = vow === 'oo' ? [[330, 1], [820, 0.45]] : vow === 'eh' ? [[540, 1], [1800, 0.35]] : [[760, 1], [1160, 0.65]];
    const a = o.a ?? 0.6, r = o.r ?? 1.2, end = t + a + len + r;
    const g = ctx.createGain(); env(g.gain, t, a, len, r, v); g.connect(d);
    const mix = ctx.createGain(); const nodes = [g, mix];
    for (const [ff, amp] of F) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff * rnd(0.97, 1.03); bp.Q.value = 5;
      const fg = ctx.createGain(); fg.gain.value = amp * 3.2; mix.connect(bp); bp.connect(fg); fg.connect(g); nodes.push(bp, fg);
    }
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(g); nodes.push(lp);
    const body = ctx.createGain(); body.gain.value = 0.25; mix.connect(body); body.connect(lp); nodes.push(body);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = rnd(4.6, 5.6); lg.gain.value = 11; lfo.connect(lg);
    lfo.start(t); lfo.stop(end + 0.05); nodes.push(lfo, lg);
    let last = null;
    for (const dt of [-13, 0, 12]) {
      const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = mtof(m); s.detune.value = dt + rnd(-3, 3);
      lg.connect(s.detune); s.connect(mix); s.start(t); s.stop(end + 0.05); nodes.push(s); last = s;
    }
    done(last, nodes);
  },
  taiko(d, t, v, p = 1) {
    voice(d, t, { f: 135 * p, f1: 46 * p, glide: 0.2, a: 0.002, r: 0.55, v });
    nz(d, t, { c: 'brown', f: 420, ft: 'lowpass', f1: 110, r: 0.28, v: v * 1.3 });
    nz(d, t, { c: 'white', f: 1700, q: 1, r: 0.025, v: v * 0.25 });
  },
  timp(d, t, m, v) {
    while (m > 52) m -= 12; while (m < 38) m += 12;
    const f = mtof(m);
    voice(d, t, { f, f1: f * 0.985, a: 0.003, r: 1.5, v });
    voice(d, t, { f: f * 1.5, a: 0.003, r: 0.8, v: v * 0.35 });
    voice(d, t, { f: f * 1.99, a: 0.003, r: 0.5, v: v * 0.15 });
    nz(d, t, { c: 'brown', f: 700, ft: 'lowpass', r: 0.16, v: v * 0.7 });
  },
  frame(d, t, v) { voice(d, t, { f: 230, f1: 135, a: 0.002, r: 0.12, v }); nz(d, t, { c: 'white', f: 1300, q: 1.2, r: 0.07, v: v * 0.6 }); },
  shaker(d, t, v) { nz(d, t, { c: 'white', f: 7000, ft: 'highpass', a: 0.006, r: 0.045, v }); },
  crash(d, t, v) { nz(d, t, { c: 'white', f: 4800, ft: 'highpass', a: 0.002, r: 2.4, v }); nz(d, t, { c: 'white', f: 9000, q: 1, r: 1.1, v: v * 0.5 }); },
  swell(d, t, len, v) { nz(d, t, { c: 'white', f: 4000, ft: 'highpass', a: len, r: 0.08, v }); },
};

// ---------------------------------------------------------------------------------------------
// sound effects
// ---------------------------------------------------------------------------------------------
function whoosh(d, t, dur, v, f0, fp, f1, c = 'pink', q = 1.6) { return nz(d, t, { c, f: f0, f1: fp, fT: dur * 0.45, f2: f1, a: dur * 0.45, r: dur * 0.55, v, q }); }
function crackle(d, t, n, spread, v, band) { for (let i = 0; i < n; i++) nz(d, t + rnd(0, spread), { c: 'white', f: band * rnd(0.6, 1.8), q: 2, a: 0.001, r: rnd(0.008, 0.03), v: v * rnd(0.4, 1) }); }
function sparkle(d, t, n, base, spread, v) { for (let i = 0; i < n; i++) fm(d, t + rnd(0, spread), { f: base * rnd(0.9, 2.2), ratio: 3.01, idx: 0.8, dur: rnd(0.12, 0.35), v: v * rnd(0.5, 1) }); }
function thud(d, t, v, f = 120, len = 0.18) { voice(d, t, { f: f * vr(), f1: f * 0.42, glide: len, a: 0.002, r: len, v }); nz(d, t, { c: 'brown', f: 900, ft: 'lowpass', f1: 150, r: len * 0.9, v: v * 1.2 }); }
function bubbles(d, t, n, spread, v) { for (let i = 0; i < n; i++) { const f = rnd(260, 620); voice(d, t + rnd(0, spread), { f, f1: f * rnd(1.6, 2.4), glide: 0.05, a: 0.004, r: 0.06, v: v * rnd(0.5, 1) }); } }
function brass(d, t, m, len, v, bright = 1.3) { INS.horn(d, t, m, len, v, bright); }
function choirS(d, t, ms, len, v, vow = 'ah', a = 0.3, r = 0.8) { for (const m of ms) INS.choir(d, t, m, len, v, vow, { a, r }); }

function explosion(t, v, size = 1) {
  duck(0.35, 1.0 * size);
  const d = O(v, rp(0.1), 0.45, 5);
  voice(d, t, { f: 95, f1: 28, glide: 1.0 * size, a: 0.003, h: 0.05, r: 1.4 * size, v: 0.9 });
  nz(d, t, { c: 'brown', f: 1800, ft: 'lowpass', f1: 60, fT: 1.6 * size, a: 0.004, r: 2.2 * size, v: 1.0 });
  nz(d, t, { c: 'white', f: 2600, ft: 'highpass', r: 0.13, v: 0.55 });
  nz(d, t, { c: 'pink', f: 800, q: 0.7, r: 0.6, v: 0.45 });
  nz(d, t + 0.25, { c: 'brown', f: 130, ft: 'lowpass', a: 0.3, h: 0.4, r: 2.0 * size, v: 0.5 });
  const dl = O(v * 0.6, -0.65, 0.25, 4), dr = O(v * 0.6, 0.65, 0.25, 4);
  const n = Math.round(12 * size);
  for (let i = 0; i < n; i++) {
    const dd = Math.random() < 0.5 ? dl : dr, tt = t + 0.12 + rnd(0, 1.5) * Math.sqrt(Math.random());
    nz(dd, tt, { c: 'white', f: rnd(1200, 5200), q: 3, a: 0.001, r: rnd(0.02, 0.07), v: rnd(0.06, 0.18) });
    if (Math.random() < 0.3) voice(dd, tt, { f: rnd(160, 320), f1: 90, a: 0.002, r: 0.06, v: 0.12 });
  }
}
function roarFX(t, v, s = 1, dur = 1.0, pan = rp(0.3)) {
  const d = O(v, pan, 0.3, dur + 2.5);
  const end = t + dur + 0.4;
  const g = am(d, t, end, rnd(24, 32), 0.55);
  voice(g, t, { types: ['sawtooth', 'sawtooth', 'square'], det: [-16, 13, 0], mix: [1, 1, 0.4], f: 82 * s * vr(), f1: 58 * s, glide: dur + 0.3, a: 0.14, h: dur * 0.45, r: dur * 0.55, v: 0.38, lp: 420, ft: 'bandpass', lp1: 820, lpT: dur * 0.3, lp2: 330, lp2T: dur * 0.7, q: 1.4 });
  nz(g, t, { c: 'pink', f: 650, f1: 1200, fT: dur * 0.3, f2: 380, q: 0.9, a: 0.14, h: dur * 0.4, r: dur * 0.55, v: 0.3 });
  voice(d, t, { f: 52 * s, a: 0.1, h: dur * 0.3, r: dur * 0.6, v: 0.32 });
}
function freezeFX(t, v) {
  const d = O(v, rp(), 0.3, 2.5);
  nz(d, t, { c: 'white', f: 5000, ft: 'highpass', r: 0.05, v: 0.45 });
  nz(d, t + 0.01, { c: 'white', f: 3200, f1: 1100, q: 2, r: 0.4, v: 0.14 });
  crackle(d, t, 6, 0.12, 0.2, 5000);
  for (let i = 0; i < 4; i++) fm(d, t + 0.03 + i * 0.045, { f: rnd(2400, 5200), ratio: 2.7, idx: 1, dur: rnd(0.3, 0.7), v: 0.045 });
  voice(d, t, { f: 1900, f1: 900, a: 0.01, r: 0.45, v: 0.04 });
}
function levelupFX(t, v) {
  duck(0.3, 1.8);
  const d = O(v, 0, 0.35, 5), B = 60 / 132;
  const dr = O(v, 0, 0.3, 5);
  INS.swell(dr, t, B, 0.05);
  brass(d, t, 67, B * 0.22, 0.09); brass(d, t + B / 3, 67, B * 0.22, 0.09); brass(d, t + 2 * B / 3, 67, B * 0.22, 0.09);
  for (const m of [48, 55, 60, 64]) brass(d, t + B, m, B * 2.4, 0.05, 1.1);
  brass(d, t + B, 72, B * 0.65, 0.1); brass(d, t + B * 1.75, 74, B * 0.22, 0.09); brass(d, t + B * 2, 76, B * 1.8, 0.1, 1.5);
  INS.timp(dr, t + B, 43, 0.4); INS.timp(dr, t + B * 2, 48, 0.35); INS.crash(dr, t + B, 0.09);
  choirS(d, t + B * 2, [72, 76, 79], B * 1.2, 0.03, 'ah', 0.25, 1.2);
  sparkle(d, t + B * 2, 6, 2000, 0.8, 0.03);
}
function healFX(t, v) {
  const d = O(v, 0, 0.45, 3);
  [72, 76, 79, 84].forEach((m, i) => voice(d, t + i * 0.07, { f: mtof(m), a: 0.02, r: 0.6, v: 0.05, vib: 10 }));
  choirS(d, t, [60, 64, 67], 0.25, 0.022, 'ah', 0.3, 0.7);
  sparkle(d, t + 0.1, 6, 2200, 0.6, 0.03);
  nz(d, t, { c: 'white', f: 7000, ft: 'highpass', a: 0.3, r: 0.5, v: 0.03 });
}

// element casts and impacts
const EL = {
  fire: {
    cast(t, v) { const d = O(v, rp(), 0.2, 2); nz(d, t, { c: 'brown', f: 300, f1: 1800, fT: 0.15, f2: 500, ft: 'lowpass', a: 0.12, r: 0.35, v: 0.6 }); nz(d, t, { c: 'pink', f: 800, f1: 2500, q: 1, a: 0.1, r: 0.3, v: 0.2 }); crackle(d, t + 0.05, 7, 0.35, 0.12, 2500); },
    impact(t, v) { const d = O(v, rp(), 0.3, 2.5); thud(d, t, 0.4, 120, 0.25); nz(d, t, { c: 'brown', f: 1500, f1: 150, ft: 'lowpass', r: 0.5, v: 0.8 }); nz(d, t, { c: 'pink', f: 2500, f1: 400, ft: 'lowpass', a: 0.02, r: 0.7, v: 0.25 }); crackle(d, t, 12, 0.5, 0.15, 2200); },
  },
  frost: {
    cast(t, v) { const d = O(v, rp(), 0.35, 2); nz(d, t, { c: 'white', f: 6000, ft: 'highpass', a: 0.2, r: 0.3, v: 0.08 }); nz(d, t, { c: 'pink', f: 1500, f1: 3200, q: 2, a: 0.15, r: 0.2, v: 0.14 }); for (let i = 0; i < 5; i++) fm(d, t + i * 0.05, { f: rnd(2000, 4500), ratio: 3.01, idx: 1.3, dur: 0.35, v: 0.035 }); voice(d, t, { f: 1600, f1: 2400, a: 0.15, r: 0.2, v: 0.04 }); },
    impact(t, v) { freezeFX(t, v); },
  },
  shadow: {
    cast(t, v) { const d = O(v, rp(), 0.4, 2); voice(d, t, { types: ['sawtooth', 'sawtooth'], det: [-30, 30], f: 110, f1: 68, a: 0.2, r: 0.4, v: 0.14, lp: 500 }); nz(d, t, { c: 'pink', f: 1400, f1: 200, ft: 'lowpass', a: 0.25, r: 0.2, v: 0.35 }); voice(d, t, { f: 55, a: 0.2, r: 0.4, v: 0.25 }); },
    impact(t, v) { const d = O(v, rp(), 0.45, 2.5); nz(d, t, { c: 'brown', f: 800, f1: 80, ft: 'lowpass', r: 0.6, v: 0.8 }); voice(d, t, { types: ['sawtooth', 'sawtooth'], det: [-25, 25], f: 90, f1: 40, a: 0.005, r: 0.6, v: 0.18, lp: 400 }); nz(d, t + 0.03, { c: 'pink', f: 900, q: 5, a: 0.05, r: 0.5, v: 0.14 }); },
  },
  holy: {
    cast(t, v) { const d = O(v, rp(), 0.5, 2.5); [76, 79, 83, 88].forEach((m) => voice(d, t, { f: mtof(m), a: 0.08, r: 0.7, v: 0.035, vib: 6 })); fm(d, t, { f: 1568, ratio: 2, idx: 1.5, dur: 1, v: 0.05 }); nz(d, t, { c: 'white', f: 6000, ft: 'highpass', a: 0.2, r: 0.4, v: 0.04 }); choirS(d, t, [64, 67, 71], 0.1, 0.02, 'ah', 0.2, 0.6); },
    impact(t, v) { const d = O(v, rp(), 0.5, 3); fm(d, t, { f: 1046, ratio: 2, idx: 2, dur: 1.4, v: 0.1 }); fm(d, t, { f: 1568, ratio: 2, idx: 1.4, dur: 1, v: 0.06 }); nz(d, t, { c: 'white', f: 3000, f1: 800, q: 0.7, r: 0.35, v: 0.3 }); thud(d, t, 0.3, 220, 0.25); sparkle(d, t, 6, 2500, 0.4, 0.03); },
  },
  nature: {
    cast(t, v) { const d = O(v, rp(), 0.25, 2); const end = t + 0.45; nz(am(d, t, end, 18, 0.7), t, { c: 'pink', f: 3000, q: 1, a: 0.05, r: 0.35, v: 0.22 }); voice(d, t, { f: 520, f1: 360, r: 0.06, v: 0.15 }); voice(d, t + 0.08, { f: 470, f1: 330, r: 0.06, v: 0.12 }); voice(d, t + 0.05, { type: 'triangle', f: 660, f1: 880, r: 0.2, v: 0.05 }); },
    impact(t, v) { const d = O(v, rp(), 0.25, 2); thud(d, t, 0.5, 140, 0.2); crackle(d, t, 7, 0.2, 0.15, 1500); nz(d, t, { c: 'pink', f: 2500, ft: 'highpass', a: 0.02, r: 0.4, v: 0.15 }); },
  },
  lightning: {
    cast(t, v) { const d = O(v, rp(), 0.3, 2); voice(d, t, { types: ['sawtooth', 'square'], det: [0, 9], f: 120, f1: 90, a: 0.01, h: 0.15, r: 0.1, v: 0.08, lp: 3000 }); crackle(d, t, 10, 0.25, 0.2, 5000); nz(d, t, { c: 'white', f: 4000, ft: 'highpass', r: 0.15, v: 0.15 }); },
    impact(t, v) { const d = O(v, rp(), 0.45, 3); nz(d, t, { c: 'white', f: 1200, ft: 'highpass', r: 0.08, v: 0.8 }); crackle(d, t, 12, 0.3, 0.25, 4500); nz(d, t + 0.05, { c: 'brown', f: 300, ft: 'lowpass', a: 0.05, r: 0.9, v: 0.55 }); voice(d, t, { type: 'square', f: 60, f1: 40, r: 0.2, v: 0.06 }); },
  },
  blood: {
    cast(t, v) { const d = O(v, rp(), 0.25, 2); voice(d, t, { f: 70, f1: 45, r: 0.12, v: 0.45 }); voice(d, t + 0.18, { f: 66, f1: 42, r: 0.14, v: 0.4 }); nz(d, t, { c: 'brown', f: 300, f1: 1200, q: 4, a: 0.02, r: 0.2, v: 0.5 }); voice(d, t, { type: 'sawtooth', f: 220, f1: 150, lp: 500, ft: 'bandpass', q: 3, r: 0.3, v: 0.06 }); },
    impact(t, v) { const d = O(v, rp(), 0.2, 2); nz(d, t, { c: 'brown', f: 600, f1: 200, ft: 'lowpass', r: 0.2, v: 0.8 }); nz(d, t, { c: 'pink', f: 1200, f1: 400, q: 3, r: 0.15, v: 0.4 }); voice(d, t, { f: 100, f1: 45, r: 0.18, v: 0.4 }); for (let i = 0; i < 3; i++) voice(d, t + 0.15 + i * rnd(0.06, 0.12), { f: 900 * vr(0.2), f1: 1400, r: 0.04, v: 0.04 }); },
  },
  arcane: {
    cast(t, v) { const d = O(v, rp(), 0.4, 2); voice(d, t, { f: 400, f1: 1600, a: 0.05, r: 0.35, v: 0.1, vib: 30, vibRate: 9 }); voice(d, t, { type: 'triangle', f: 600, f1: 2400, r: 0.3, v: 0.04 }); sparkle(d, t, 6, 2500, 0.3, 0.03); nz(d, t, { c: 'white', f: 2000, f1: 6000, q: 2, a: 0.1, r: 0.25, v: 0.08 }); },
    impact(t, v) { const d = O(v, rp(), 0.4, 2.5); voice(d, t, { f: 1600, f1: 200, r: 0.2, v: 0.2 }); fm(d, t, { f: 880, ratio: 1.5, idx: 3, dur: 0.7, v: 0.08 }); sparkle(d, t, 8, 2000, 0.3, 0.03); nz(d, t, { c: 'pink', f: 1500, q: 1, r: 0.25, v: 0.2 }); },
  },
  physical: {
    cast(t, v) { const d = O(v, rp(), 0.12, 1.5); whoosh(d, t, 0.25, 0.35, 400, 2500, 700); },
    impact(t, v) { SFX.hit(t, v); },
  },
  poison: {
    cast(t, v) { const d = O(v, rp(), 0.2, 2); bubbles(d, t, 6, 0.35, 0.09); nz(d, t, { c: 'white', f: 3500, ft: 'highpass', a: 0.05, r: 0.35, v: 0.08 }); },
    impact(t, v) { const d = O(v, rp(), 0.25, 2); nz(d, t, { c: 'pink', f: 900, f1: 300, q: 1.5, r: 0.3, v: 0.4 }); nz(d, t + 0.05, { c: 'white', f: 4000, ft: 'highpass', a: 0.03, r: 0.6, v: 0.12 }); bubbles(d, t + 0.05, 6, 0.5, 0.08); voice(d, t, { f: 120, f1: 60, r: 0.15, v: 0.25 }); },
  },
  spirit: {
    cast(t, v) { const d = O(v, rp(), 0.55, 2.5); voice(d, t, { types: ['sine', 'sine'], det: [-15, 15], f: 523, f1: 784, a: 0.2, r: 0.6, v: 0.06, vib: 25 }); nz(d, t, { c: 'pink', f: 600, f1: 1500, q: 6, a: 0.3, r: 0.4, v: 0.14 }); fm(d, t, { f: 1318, ratio: 3.5, idx: 1, dur: 0.9, v: 0.03 }); },
    impact(t, v) { const d = O(v, rp(), 0.55, 2.5); voice(d, t, { f: 784, f1: 392, a: 0.01, r: 0.6, v: 0.1, vib: 40 }); nz(d, t, { c: 'pink', f: 1000, f1: 300, q: 3, r: 0.5, v: 0.2 }); fm(d, t, { f: 659, ratio: 1.414, idx: 2, dur: 1.2, v: 0.06 }); },
  },
  sound: {
    cast(t, v) { const d = O(v, rp(), 0.3, 2); const end = t + 0.3; voice(am(d, t, end, 30, 0.8), t, { types: ['sine', 'square'], mix: [1, 0.2], f: 200, f1: 1200, a: 0.01, r: 0.25, v: 0.15 }); nz(d, t, { c: 'pink', f: 1500, q: 8, r: 0.25, v: 0.15 }); },
    impact(t, v) { const d = O(v, rp(), 0.35, 2.5); voice(d, t, { f: 160, f1: 40, r: 0.35, v: 0.6 }); nz(d, t, { c: 'brown', f: 1200, f1: 100, ft: 'lowpass', r: 0.4, v: 0.6 }); voice(d, t, { f: 2600, a: 0.01, r: 0.8, v: 0.025 }); voice(d, t, { f: 2647, a: 0.01, r: 0.8, v: 0.025 }); },
  },
};

const SFX = {
  step(t, v) {
    const d = O(v * 0.9, rp(0.15), 0.03, 0.6);
    nz(d, t, { c: 'brown', f: rnd(260, 400), ft: 'lowpass', f1: 120, r: 0.09, v: 0.5 });
    nz(d, t, { c: 'white', f: rnd(1800, 3400), q: 1.2, r: 0.045, v: 0.05 });
  },
  swing(t, v) {
    const d = O(v, rp(0.25), 0.12, 1.5);
    if (!buf(d, t, 'swing' + r10(), 0.5, vr(0.08))) whoosh(d, t, 0.28, 0.4, 500, 2600, 700);
    whoosh(d, t, 0.22, 0.12, 700, 3200, 900);
  },
  heavy(t, v) {
    const d = O(v, rp(0.2), 0.15, 1.8);
    if (!buf(d, t, 'swing' + r10(), 0.65, 0.72 * vr(0.05))) whoosh(d, t, 0.42, 0.45, 300, 1500, 300);
    whoosh(d, t, 0.45, 0.5, 200, 900, 250, 'brown', 1.2);
    voice(d, t + 0.05, { f: 90, f1: 60, a: 0.05, r: 0.3, v: 0.15 });
  },
  hit(t, v) {
    const d = O(v, rp(0.25), 0.12, 1.5);
    voice(d, t, { f: 160 * vr(), f1: 55, glide: 0.14, r: 0.16, v: 0.55 });
    nz(d, t, { c: 'brown', f: 1400, ft: 'lowpass', f1: 200, r: 0.14, v: 0.7 });
    nz(d, t, { c: 'white', f: 2600 * vr(0.15), q: 0.8, r: 0.035, v: 0.25 });
    if (Math.random() < 0.3) buf(d, t, 'clash' + r10(), 0.1, 1.3 * vr());
  },
  crit(t, v) {
    duck(0.6, 0.2);
    const d = O(v, rp(0.2), 0.25, 2);
    SFX.hit(t, v * 1.1);
    fm(d, t, { f: 1300 * vr(), ratio: 2.41, idx: 3, dur: 0.45, v: 0.08 });
    voice(d, t, { f: 72, f1: 34, a: 0.002, r: 0.35, v: 0.5 });
    nz(d, t, { c: 'white', f: 4000, ft: 'highpass', r: 0.06, v: 0.3 });
    nz(d, t, { c: 'pink', f: 2000, f1: 500, q: 1, r: 0.3, v: 0.15 });
  },
  block(t, v) {
    const d = O(v, rp(0.25), 0.2, 2);
    const ok = buf(d, t, 'clash' + r10(), 0.55, vr(0.06));
    voice(d, t, { f: 220, f1: 120, r: 0.08, v: 0.3 });
    fm(d, t, { f: 900 * vr(), ratio: 2.76, idx: ok ? 1.5 : 3, dur: ok ? 0.5 : 0.7, v: ok ? 0.05 : 0.14 });
    crackle(d, t, 5, 0.08, 0.07, 4500);
  },
  dodge(t, v) {
    const d = O(v, rp(0.3), 0.08, 1);
    whoosh(d, t, 0.32, 0.4, 300, 1500, 400);
    nz(d, t, { c: 'brown', f: 220, ft: 'lowpass', r: 0.1, v: 0.18 });
  },
  bow(t, v) {
    const d = O(v, rp(0.2), 0.12, 1.5);
    voice(d, t, { type: 'sawtooth', f: 140 * vr(), f1: 112, a: 0.002, r: 0.18, v: 0.2, lp: 1400, lp1: 300, lpT: 0.15 });
    voice(d, t, { type: 'triangle', f: 280 * vr(), a: 0.002, r: 0.1, v: 0.08 });
    whoosh(d, t + 0.02, 0.3, 0.2, 2500, 5000, 1800, 'white', 1.2);
  },
  hurt(t, v) {
    const d = O(v, rp(0.15), 0.1, 1.2);
    voice(d, t, { types: ['sawtooth', 'sawtooth'], det: [-10, 10], f: rnd(150, 190), f1: 100, glide: 0.22, a: 0.01, r: 0.22, v: 0.25, lp: 700, ft: 'bandpass', q: 2.5 });
    nz(d, t, { c: 'brown', f: 900, ft: 'lowpass', f1: 150, r: 0.12, v: 0.5 });
    voice(d, t, { f: 120, f1: 60, r: 0.12, v: 0.3 });
  },
  chop(t, v) {
    const d = O(v, rp(0.2), 0.1, 1);
    voice(d, t, { f: 320 * vr(0.1), f1: 170, r: 0.08, v: 0.45 });
    nz(d, t, { c: 'white', f: 1100 * vr(0.1), q: 4, r: 0.12, v: 0.5 });
    nz(d, t, { c: 'white', f: 3500, q: 1, r: 0.03, v: 0.2 });
    crackle(d, t + 0.02, 3, 0.08, 0.05, 3000);
  },
  mine(t, v) {
    const d = O(v, rp(0.2), 0.15, 1.5);
    const f = 2300 * vr(0.1);
    fm(d, t, { f, ratio: 1.47, idx: 2.5, dur: 0.25, v: 0.12 });
    fm(d, t, { f: f * 1.6, ratio: 1.3, idx: 1.5, dur: 0.18, v: 0.06 });
    nz(d, t, { c: 'white', f: 3500, q: 1.5, r: 0.07, v: 0.35 });
    voice(d, t, { f: 200, f1: 90, r: 0.06, v: 0.25 });
    crackle(d, t + 0.03, 5, 0.25, 0.05, 2500);
  },
  harvest(t, v) {
    const d = O(v, rp(0.2), 0.08, 1);
    for (let i = 0; i < 3; i++) nz(d, t + i * 0.06, { c: 'pink', f: rnd(2500, 4500), q: 1, a: 0.02, r: 0.08, v: 0.18 });
    voice(d, t + 0.15, { f: 900, f1: 1300, r: 0.1, v: 0.05 });
  },
  pickup(t, v) {
    const d = O(v, rp(0.1), 0.2, 1);
    voice(d, t, { f: 880, f1: 1320, r: 0.09, v: 0.14 });
    voice(d, t + 0.06, { f: 1320, f1: 1760, r: 0.14, v: 0.12 });
    sparkle(d, t + 0.05, 3, 2600, 0.12, 0.03);
  },
  coins(t, v) {
    const d = O(v, rp(0.15), 0.15, 1.2);
    const n = 4 + ((Math.random() * 3) | 0); let tt = t;
    for (let i = 0; i < n; i++) { fm(d, tt, { f: rnd(2600, 4200), ratio: 2.13, idx: 1.2, dur: rnd(0.08, 0.22), v: 0.07 }); tt += rnd(0.03, 0.07); }
  },
  loot(t, v) {
    const d = O(v, 0, 0.35, 3);
    [72, 76, 79, 84, 88].forEach((m, i) => pluck(d, t + i * 0.055, m, 0.14, 0.75, 1.2));
    INS.bell(d, t + 0.28, 96, 0.04, 1.4);
    nz(d, t, { c: 'white', f: 6000, ft: 'highpass', a: 0.3, r: 0.6, v: 0.05 });
    SFX.coins(t, v * 0.7);
  },
  level(t, v) { levelupFX(t, v); },
  levelup(t, v) { levelupFX(t, v); },
  mastery(t, v) {
    const d = O(v, 0, 0.45, 3.5);
    [69, 76, 81, 88].forEach((m, i) => INS.bell(d, t + i * 0.09, m, 0.05, 1.6));
    choirS(d, t, [57, 64, 69], 0.4, 0.03, 'ah', 0.3, 0.8);
    sparkle(d, t + 0.3, 5, 2400, 0.5, 0.03);
  },
  quest(t, v) {
    duck(0.45, 1.2);
    const d = O(v, 0, 0.4, 4);
    brass(d, t, 62, 0.18, 0.09); brass(d, t + 0.2, 69, 0.18, 0.09); brass(d, t + 0.4, 74, 1.0, 0.1, 1.5);
    brass(d, t + 0.4, 62, 1.0, 0.06, 1); brass(d, t + 0.4, 66, 1.0, 0.05, 1);
    [62, 64, 66, 67, 69, 71, 73, 74, 76, 78, 79, 81].forEach((m, i) => pluck(d, t + 0.4 + i * 0.03, m + 12, 0.06, 0.75, 1));
    INS.timp(d, t + 0.4, 50, 0.35);
  },
  craft(t, v) {
    const d = O(v, rp(0.15), 0.25, 2);
    for (const [dt, k] of [[0, 1], [0.18, 0.92]]) {
      fm(d, t + dt, { f: 1800 * k * vr(0.03), ratio: 2.76, idx: 4, dur: 0.6, v: 0.1 });
      voice(d, t + dt, { f: 400 * k, f1: 200, r: 0.05, v: 0.3 });
      nz(d, t + dt, { c: 'white', f: 5000, q: 1, r: 0.05, v: 0.25 });
    }
    nz(d, t + 0.32, { c: 'white', f: 5000, ft: 'highpass', a: 0.05, r: 0.5, v: 0.05 });
  },
  ui(t, v) {
    const d = O(v, 0, 0.02, 0.5);
    voice(d, t, { f: 1100 * vr(0.03), f1: 1250, r: 0.04, v: 0.08 });
    nz(d, t, { c: 'white', f: 4000, q: 1, r: 0.012, v: 0.04 });
  },
  boom(t, v) { explosion(t, v * 0.75, 0.6); },
  magic(t, v) { EL.arcane.cast(t, v); },
  roar(t, v) { roarFX(t, v, 1, 1.0); },
  boss_roar(t, v) {
    duck(0.3, 1.8);
    roarFX(t, v * 1.2, 0.62, 2.0, 0);
    roarFX(t + 0.05, v * 0.5, 1.3, 1.8, rp(0.4));
    const d = O(v, 0, 0.4, 4);
    nz(d, t, { c: 'brown', f: 150, ft: 'lowpass', a: 0.2, h: 0.6, r: 1.8, v: 0.5 });
    voice(d, t, { f: 38, a: 0.2, h: 0.8, r: 1.4, v: 0.35 });
  },
  death(t, v) {
    duck(0.25, 2.5);
    const d = O(v, 0, 0.4, 5);
    voice(d, t, { types: ['sawtooth', 'sawtooth'], det: [-12, 12], f: 220, f1: 110, glide: 1.4, a: 0.05, h: 0.3, r: 1.2, v: 0.15, lp: 800, ft: 'bandpass', q: 2 });
    INS.bell(d, t + 0.25, 41, 0.15, 3.5);
    thud(d, t + 0.35, 0.4, 90, 0.3);
    choirS(d, t + 0.4, [50, 53, 57], 1.2, 0.025, 'oo', 0.6, 1.8);
  },
  enemy_die(t, v) {
    const d = O(v, rp(0.35), 0.2, 2);
    voice(d, t, { type: 'sawtooth', f: 160 * vr(0.15), f1: 60, a: 0.01, r: 0.45, v: 0.2, lp: 600, ft: 'bandpass', q: 2 });
    thud(d, t + 0.18, 0.4, 110, 0.22);
    nz(d, t + 0.2, { c: 'pink', f: 1500, ft: 'highpass', a: 0.05, r: 0.4, v: 0.06 });
    voice(d, t + 0.22, { f: 600, f1: 1500, a: 0.05, r: 0.4, v: 0.025 });
  },
  potion(t, v) {
    const d = O(v, rp(0.1), 0.2, 2);
    for (let i = 0; i < 3; i++) { const f = rnd(280, 380); voice(d, t + i * 0.11, { f, f1: f * 1.8, glide: 0.06, a: 0.005, r: 0.07, v: 0.18 }); }
    sparkle(d, t + 0.35, 4, 2000, 0.3, 0.03);
    voice(d, t + 0.35, { f: 600, f1: 1200, a: 0.05, r: 0.4, v: 0.05 });
  },
  jump(t, v) {
    const d = O(v, rp(0.1), 0.05, 0.8);
    whoosh(d, t, 0.18, 0.22, 250, 900, 500);
    nz(d, t, { c: 'brown', f: 300, ft: 'lowpass', r: 0.06, v: 0.25 });
  },
  land(t, v) {
    const d = O(v, rp(0.1), 0.06, 0.8);
    nz(d, t, { c: 'brown', f: 500, f1: 100, ft: 'lowpass', r: 0.16, v: 0.7 });
    voice(d, t, { f: 120, f1: 50, r: 0.12, v: 0.35 });
    nz(d, t, { c: 'white', f: 2500, q: 0.8, r: 0.06, v: 0.08 });
    crackle(d, t + 0.01, 3, 0.08, 0.04, 2500);
  },
  swap(t, v) {
    const d = O(v, rp(0.15), 0.12, 1);
    nz(d, t, { c: 'white', f: 3000, f1: 7000, q: 3, a: 0.02, r: 0.14, v: 0.12 });
    fm(d, t + 0.1, { f: 2400, ratio: 1.5, idx: 1, dur: 0.25, v: 0.06 });
    whoosh(d, t, 0.15, 0.1, 400, 1200, 500);
  },
  heal(t, v) { healFX(t, v); },
  shield(t, v) {
    const d = O(v, 0, 0.4, 2.5);
    voice(d, t, { types: ['sine', 'triangle'], mix: [1, 0.3], f: 110, f1: 130, a: 0.1, h: 0.3, r: 0.6, v: 0.2 });
    fm(d, t, { f: 1400, ratio: 1.5, idx: 1.5, dur: 1, v: 0.06 });
    fm(d, t + 0.05, { f: 2100, ratio: 1.5, idx: 1, dur: 0.8, v: 0.04 });
    nz(d, t, { c: 'white', f: 2000, f1: 5000, q: 1, a: 0.15, r: 0.3, v: 0.06 });
    thud(d, t, 0.2, 100, 0.12);
  },
  summon(t, v) {
    const d = O(v, 0, 0.5, 3.5);
    nz(d, t, { c: 'pink', f: 300, f1: 2500, fT: 0.85, ft: 'lowpass', a: 0.8, r: 0.15, v: 0.35 });
    voice(d, t, { types: ['sawtooth', 'sawtooth'], det: [-20, 20], f: 55, f1: 110, a: 0.7, h: 0.1, r: 0.6, v: 0.12, lp: 400 });
    voice(d, t + 0.85, { f: 300, f1: 80, r: 0.2, v: 0.4 });
    INS.bell(d, t + 0.85, 72, 0.06, 1.2);
    sparkle(d, t + 0.85, 5, 1800, 0.3, 0.03);
  },
  explosion(t, v) { explosion(t, v, 1); },
  burn(t, v) {
    const d = O(v, rp(0.2), 0.12, 1.2);
    nz(d, t, { c: 'brown', f: 700, ft: 'lowpass', a: 0.03, r: 0.35, v: 0.3 });
    crackle(d, t, 8, 0.35, 0.12, 2500);
  },
  freeze(t, v) { freezeFX(t, v); },
  thunder(t, v) {
    duck(0.5, 1.4);
    const d = O(v, rp(0.4), 0.5, 5.5);
    nz(d, t, { c: 'white', f: 1500, ft: 'highpass', a: 0.001, r: 0.1, v: 0.9 });
    nz(d, t + 0.02, { c: 'white', f: 2500, q: 0.5, r: 0.25, v: 0.5 });
    crackle(d, t, 10, 0.25, 0.3, 4000);
    nz(d, t + 0.12, { c: 'brown', f: 260, f1: 80, ft: 'lowpass', a: 0.15, h: 0.4, r: 2.8, v: 0.9 });
    nz(d, t + 0.6, { c: 'brown', f: 160, ft: 'lowpass', a: 0.4, r: 2.4, v: 0.6 });
    voice(d, t + 0.1, { f: 45, f1: 30, a: 0.1, r: 2, v: 0.4 });
  },
  blink(t, v) {
    const s = Math.random() < 0.5 ? -1 : 1;
    const d = autopan(O(v, 0, 0.35, 1.5), t, t + 0.4, 2.5, 0.5 * s);
    nz(d, t, { c: 'pink', f: 400, f1: 4500, fT: 0.13, q: 2, a: 0.12, r: 0.08, v: 0.35 });
    voice(d, t, { f: 300, f1: 1800, glide: 0.2, a: 0.1, r: 0.1, v: 0.1 });
    voice(d, t + 0.2, { f: 1200, f1: 300, r: 0.1, v: 0.15 });
    nz(d, t + 0.2, { c: 'white', f: 3000, ft: 'highpass', r: 0.05, v: 0.15 });
    sparkle(d, t + 0.2, 3, 2500, 0.15, 0.025);
  },
  whirl(t, v) {
    const out = O(v, 0, 0.15, 1.8), end = t + 0.65;
    const d = autopan(out, t, end, 3, 0.7);
    nz(am(d, t, end, 11, 0.85), t, { c: 'pink', f: 1200, q: 1.5, a: 0.05, h: 0.35, r: 0.2, v: 0.5 });
    nz(am(d, t, end, 11, 0.6), t, { c: 'white', f: 3500, q: 2, a: 0.05, h: 0.3, r: 0.2, v: 0.12 });
    buf(out, t, 'swing' + r10(), 0.35, 1.1); buf(out, t + 0.2, 'swing' + r10(), 0.3, 1.0); buf(out, t + 0.4, 'swing' + r10(), 0.25, 0.9);
  },
  meteor(t, v) {
    const d = O(v, rp(0.2), 0.35, 3);
    nz(d, t, { c: 'pink', f: 300, f1: 2500, fT: 1.0, ft: 'lowpass', a: 1.0, r: 0.05, v: 0.5 });
    nz(d, t, { c: 'brown', f: 200, f1: 900, fT: 1.0, ft: 'lowpass', a: 1.0, r: 0.05, v: 0.6 });
    voice(d, t, { f: 1400, f1: 250, glide: 1.0, a: 0.9, r: 0.1, v: 0.07 });
    crackle(d, t + 0.3, 12, 0.7, 0.12, 3000);
    explosion(t + 1.0, v, 1.2);
  },
  fear(t, v) {
    const d = O(v, 0, 0.5, 3.5);
    voice(d, t, { types: ['sawtooth', 'sawtooth'], det: [-25, 25], f: 330, f1: 160, glide: 1.3, a: 0.25, h: 0.3, r: 0.9, v: 0.1, lp: 900, ft: 'bandpass', q: 3, vib: 40, vibRate: 6 });
    voice(d, t + 0.08, { types: ['sawtooth', 'sawtooth'], det: [-20, 20], f: 247, f1: 150, glide: 1.3, a: 0.25, h: 0.3, r: 0.9, v: 0.08, lp: 600, ft: 'bandpass', q: 3, vib: 35, vibRate: 5 });
    nz(d, t, { c: 'pink', f: 1200, f1: 500, q: 4, a: 0.3, r: 0.9, v: 0.1 });
    voice(d, t, { f: 60, a: 0.3, r: 1, v: 0.2 });
  },
};
for (const k of Object.keys(EL)) { SFX['cast_' + k] = EL[k].cast; SFX['impact_' + k] = EL[k].impact; }

// ---- combat feel: weapon whooshes, impacts by material, blocks, kills ----
Object.assign(SFX, {
  // swings: the recorded CC0 swing at a weapon-dependent speed, layered with synthesized air
  whoosh_light(t, v) {
    const d = O(v, rp(0.3), 0.1, 1.2);
    if (!buf(d, t, 'swing' + r10(), 0.42, rnd(1.0, 1.16))) whoosh(d, t, 0.24, 0.4, 600, 3000, 800);
    whoosh(d, t + 0.02, 0.18, 0.09, 1400, 5200, 1600, 'white', 2.2);
  },
  whoosh_heavy(t, v) {
    const d = O(v, rp(0.25), 0.14, 1.6);
    if (!buf(d, t, 'swing' + r10(), 0.55, rnd(0.78, 0.88))) whoosh(d, t, 0.38, 0.45, 350, 1800, 400);
    whoosh(d, t, 0.42, 0.42, 220, 1000, 260, 'brown', 1.1);
    nz(d, t + 0.05, { c: 'pink', f: 700, ft: 'lowpass', a: 0.08, r: 0.2, v: 0.12 });
  },
  whoosh_axe(t, v) {
    const d = O(v, rp(0.2), 0.15, 1.8);
    if (!buf(d, t, 'swing' + r10(), 0.5, rnd(0.66, 0.76))) whoosh(d, t, 0.46, 0.45, 260, 1300, 300);
    whoosh(d, t, 0.5, 0.6, 170, 720, 210, 'brown', 1.0);
    voice(d, t + 0.04, { f: 74 * vr(), f1: 46, a: 0.1, r: 0.35, v: 0.17 });
  },
  whoosh_hammer(t, v) {
    const d = O(v, rp(0.2), 0.15, 1.8);
    whoosh(d, t, 0.56, 0.85, 120 * vr(), 520, 160, 'brown', 0.9);
    whoosh(d, t + 0.03, 0.5, 0.24, 300, 1400 * vr(), 320, 'pink', 1.2);
    voice(d, t, { f: 56 * vr(), f1: 38, a: 0.16, r: 0.4, v: 0.22 });
  },
  whoosh_staff(t, v) {
    const d = O(v, rp(0.25), 0.35, 1.6);
    const f = 220 * vr(0.05);
    voice(d, t, { types: ['sine', 'triangle'], det: [-8, 8], mix: [1, 0.4], f, f1: f * 1.5, a: 0.06, r: 0.32, v: 0.08, vib: 14, vibRate: 7 });
    whoosh(d, t, 0.3, 0.22, 500, 2600, 700);
    sparkle(d, t + 0.05, 3, 2600, 0.2, 0.02);
  },
  // impacts by what you hit
  hit_flesh(t, v) {
    const d = O(v, rp(0.25), 0.1, 1.4);
    thud(d, t, 0.5, 110, 0.16);
    nz(d, t, { c: 'pink', f: 760 * vr(0.15), f1: 240, q: 3, r: 0.13, v: 0.42 });
    nz(d, t, { c: 'white', f: 3200 * vr(0.2), q: 1, r: 0.04, v: 0.2 });
    voice(d, t + 0.01, { f: 420 * vr(0.2), f1: 170, r: 0.06, v: 0.06 });
    if (Math.random() < 0.25) buf(d, t, 'clash' + r10(), 0.06, 1.4 * vr());
  },
  hit_bone(t, v) {
    const d = O(v, rp(0.25), 0.12, 1.4);
    nz(d, t, { c: 'white', f: 2400 * vr(0.15), q: 6, r: 0.05, v: 0.5 });
    fm(d, t, { f: 700 * vr(0.15), ratio: 1.41, idx: 1.5, dur: 0.12, v: 0.12 });
    crackle(d, t + 0.02, 6, 0.15, 0.12, 2600);
    thud(d, t, 0.25, 140, 0.1);
    nz(d, t + 0.02, { c: 'pink', f: 900, f1: 400, q: 2, a: 0.04, r: 0.3, v: 0.06 });
  },
  hit_metal(t, v) {
    const d = O(v, rp(0.25), 0.2, 1.8);
    const ok = buf(d, t, 'clash' + r10(), 0.5, vr(0.08));
    fm(d, t, { f: 1800 * vr(0.1), ratio: 2.76, idx: ok ? 1.2 : 3, dur: 0.5, v: ok ? 0.04 : 0.1 });
    voice(d, t, { f: 200, f1: 120, r: 0.06, v: 0.2 });
  },
  hit_corrupt(t, v) {
    const d = O(v, rp(0.25), 0.2, 1.8);
    nz(d, t, { c: 'brown', f: 1000, f1: 150, ft: 'lowpass', r: 0.25, v: 0.8 });
    voice(d, t, { types: ['sawtooth', 'sawtooth'], det: [-25, 25], f: 95 * vr(), f1: 50, a: 0.004, r: 0.3, v: 0.13, lp: 500 });
    nz(d, t + 0.01, { c: 'white', f: 4000, ft: 'highpass', a: 0.02, r: 0.3, v: 0.07 });
    crackle(d, t + 0.02, 6, 0.25, 0.08, 3500);
    thud(d, t, 0.3, 90, 0.14);
  },
  slam(t, v) {
    duck(0.55, 0.35);
    const d = O(v, rp(0.1), 0.35, 3);
    voice(d, t, { f: 72 * vr(), f1: 30, glide: 0.45, a: 0.002, r: 0.55, v: 0.75 });
    nz(d, t, { c: 'brown', f: 1400, f1: 80, ft: 'lowpass', fT: 0.6, r: 0.75, v: 0.95 });
    nz(d, t, { c: 'white', f: 2000, ft: 'highpass', r: 0.06, v: 0.35 });
    crackle(d, t + 0.06, 10, 0.5, 0.12, 2500);
    const l = O(v * 0.5, -0.6, 0.2, 2), r = O(v * 0.5, 0.6, 0.2, 2);
    for (let i = 0; i < 6; i++) nz(Math.random() < 0.5 ? l : r, t + 0.1 + rnd(0, 0.6), { c: 'white', f: rnd(1500, 4000), q: 3, a: 0.001, r: rnd(0.02, 0.06), v: rnd(0.05, 0.12) });
  },
  shatter(t, v) {
    const d = O(v, rp(0.2), 0.35, 2.5);
    nz(d, t, { c: 'white', f: 3000, ft: 'highpass', r: 0.08, v: 0.45 });
    for (let i = 0; i < 8; i++) fm(d, t + rnd(0, 0.12), { f: rnd(2500, 6000), ratio: 2.7, idx: 1, dur: rnd(0.2, 0.5), v: 0.035 });
    crackle(d, t, 8, 0.15, 0.14, 5000);
  },
  sparks(t, v) {
    const d = O(v, rp(0.25), 0.2, 1.5);
    crackle(d, t, 10, 0.2, 0.11, 5000);
    for (let i = 0; i < 3; i++) fm(d, t + rnd(0, 0.08), { f: rnd(3000, 5200), ratio: 2.3, idx: 1, dur: 0.1, v: 0.03 });
    nz(d, t, { c: 'white', f: 6000, ft: 'highpass', r: 0.15, v: 0.07 });
  },
  crit_ring(t, v) {
    duck(0.6, 0.15);
    const d = O(v, rp(0.2), 0.3, 2);
    fm(d, t, { f: 1300 * vr(), ratio: 2.41, idx: 3, dur: 0.5, v: 0.075 });
    fm(d, t + 0.01, { f: 2600 * vr(), ratio: 1.5, idx: 1, dur: 0.35, v: 0.035 });
    voice(d, t, { f: 66, f1: 32, a: 0.002, r: 0.35, v: 0.42 });
    nz(d, t, { c: 'white', f: 4000, ft: 'highpass', r: 0.05, v: 0.22 });
  },
  shield_thud(t, v) {
    const d = O(v, rp(0.2), 0.15, 1.2);
    voice(d, t, { f: 180 * vr(), f1: 90, r: 0.12, v: 0.42 });
    nz(d, t, { c: 'brown', f: 900, f1: 200, ft: 'lowpass', r: 0.14, v: 0.6 });
    nz(d, t, { c: 'pink', f: 600, q: 2, r: 0.08, v: 0.18 });
  },
  dodge_roll(t, v) {
    const d = O(v, rp(0.2), 0.06, 1.2);
    nz(d, t + 0.08, { c: 'brown', f: 420, ft: 'lowpass', a: 0.03, h: 0.1, r: 0.16, v: 0.32 });
    crackle(d, t + 0.1, 5, 0.25, 0.05, 2500);
    whoosh(d, t, 0.3, 0.15, 300, 900, 400);
  },
  kill_beast(t, v) {
    const d = O(v, rp(0.3), 0.2, 2);
    voice(d, t, { type: 'sawtooth', f: 340 * vr(0.15), f1: 140, glide: 0.5, a: 0.02, r: 0.5, v: 0.07, lp: 900, ft: 'bandpass', q: 3 });
    nz(d, t, { c: 'pink', f: 1200, f1: 400, q: 1.5, a: 0.03, r: 0.4, v: 0.1 });
    thud(d, t, 0.3, 120, 0.15);
  },
  kill_lost(t, v) {
    const end = t + 1.1;
    const d = autopan(O(v, 0, 0.5, 3), t, end, 1.3, 0.4);
    nz(d, t, { c: 'pink', f: 900, f1: 280, q: 4, a: 0.1, r: 1.0, v: 0.24 });
    voice(d, t, { types: ['sine', 'sine'], det: [-12, 12], f: 520 * vr(0.08), f1: 250, glide: 1.0, a: 0.1, r: 0.9, v: 0.05, vib: 30 });
    crackle(d, t + 0.05, 10, 0.4, 0.1, 2200);
  },
  kill_corrupt(t, v) {
    duck(0.6, 0.4);
    const d = O(v, rp(0.2), 0.4, 3);
    nz(d, t, { c: 'brown', f: 1200, f1: 80, ft: 'lowpass', r: 0.7, v: 0.85 });
    voice(d, t, { types: ['sawtooth', 'sawtooth'], det: [-30, 30], f: 110 * vr(), f1: 45, a: 0.005, r: 0.8, v: 0.15, lp: 600 });
    nz(d, t, { c: 'white', f: 3000, ft: 'highpass', a: 0.25, r: 0.1, v: 0.08 });
    crackle(d, t + 0.05, 12, 0.6, 0.08, 3000);
  },
  soul(t, v) {
    const d = O(v, rp(0.3), 0.6, 3);
    voice(d, t, { types: ['sine', 'sine'], det: [-10, 10], f: 600 * vr(0.06), f1: 1400, glide: 0.8, a: 0.1, r: 0.9, v: 0.045, vib: 20 });
    fm(d, t + 0.1, { f: 1568, ratio: 2, idx: 1.2, dur: 1.2, v: 0.025 });
    sparkle(d, t + 0.2, 6, 2400, 0.8, 0.02);
  },
});

const gateMap = {};
function gate(name) {
  const now = ctx.currentTime, r = gateMap[name] || (gateMap[name] = { t: -1, n: 0 });
  if (now - r.t < 0.04) { if (r.n >= (name === 'step' ? 1 : 2)) return false; r.n++; }
  else { r.t = now; r.n = 1; }
  return live < MAX_LIVE;
}
export function sfx(name, vol = 1) {
  if (!ctx || !NZ || typeof name !== 'string') return;
  const fn = Object.prototype.hasOwnProperty.call(SFX, name) ? SFX[name] : null;
  if (!fn || !gate(name)) return;
  try { fn(ctx.currentTime + 0.005, clamp(+vol || 0, 0, 2)); } catch (e) { /* never break gameplay */ }
}

// ---------------------------------------------------------------------------------------------
// procedural music
// ---------------------------------------------------------------------------------------------
const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
};
const ZONES = {
  town: { shift: 0 },
  meadow: { shift: 0 },
  coast: { shift: 2, airy: true, modes: { aeolian: 'dorian', phrygian: 'aeolian' } },
  thorn: { shift: -2, dark: 0.4, modes: { dorian: 'aeolian' } },
  mire: { shift: -1, eerie: true, modes: { dorian: 'phrygian', aeolian: 'phrygian', ionian: 'mixolydian' } },
  ruins: { shift: -4, dark: 1, modes: { dorian: 'harmonic', aeolian: 'harmonic' } },
  frost: { shift: 3, airy: true, dark: 0.5, modes: { ionian: 'lydian', dorian: 'aeolian' } },
};
let musicZone = 'meadow';
let curState = 'none', baseState = 'explore';
const players = [];
let combatRecToggle = Math.random() < 0.5;

function keyFor(def) {
  if (def.fixed) return { root: def.root, mode: def.mode, z: {} };
  const z = ZONES[musicZone] || ZONES.meadow;
  return { root: def.root + (z.shift || 0), mode: (z.modes && z.modes[def.mode]) || def.mode, z };
}
function N(p, d, oct = 0) { const md = MODES[p.key.mode], o = Math.floor(d / 7), i = d - o * 7; return p.key.root + 12 * (oct + o) + md[i]; }
const TONES = [0, 2, 4, 7, 9, 11, 14];
function ct(p, i, oct = 0) { return N(p, p.ch + TONES[i % TONES.length], oct); }
function snap(p, d) { for (const k of [0, -1, 1, -2, 2]) { const x = (((d + k - p.ch) % 7) + 7) % 7; if (x === 0 || x === 2 || x === 4) return d + k; } return d; }
function genPhrase(cells, steps, d0, range) {
  const ev = []; let at = 0, d = d0, dir = Math.random() < 0.5 ? 1 : -1;
  while (at < steps) {
    for (const c of pick(cells)) {
      if (at >= steps) break;
      const l = Math.min(Math.abs(c), steps - at);
      if (c > 0) {
        ev.push({ at, d, l });
        const r = Math.random(), sz = r < 0.55 ? 1 : r < 0.82 ? 2 : r < 0.93 ? 3 : 0;
        if (Math.random() < 0.3) dir = -dir;
        d += dir * sz;
        if (d > range[1]) { d = range[1] - 1; dir = -1; }
        if (d < range[0]) { d = range[0] + 1; dir = 1; }
      }
      at += l;
    }
  }
  if (ev.length) { const last = ev[ev.length - 1]; last.l = steps - last.at; }
  return ev;
}
function vary(ev, amt) {
  const shift = Math.random() < 0.2 ? pick([-2, 2]) : 0;
  let out = ev.map((e, i) => ({ at: e.at, l: e.l, d: e.d + shift + (i && Math.random() < amt ? pick([-1, 1, -1, 1, 2, -2]) : 0) }));
  if (Math.random() < 0.35) { // rhythmic variation: split a long note into two
    const longs = out.filter((e) => e.l >= 8 && e.at + e.l < 32);
    if (longs.length) { const e = pick(longs), h = e.l / 2; e.l = h; out.push({ at: e.at + h, l: h, d: e.d + pick([-1, 1]) }); out.sort((a, b) => a.at - b.at); }
  }
  return out;
}

function bus(p, key, pan = 0, rev = 0.3) {
  let b = p.buses[key]; if (b) return b;
  b = ctx.createGain(); let tail = b; const nodes = [b];
  if (pan && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = pan; b.connect(pn); tail = pn; nodes.push(pn); }
  tail.connect(p.gain);
  if (rev) { const s = ctx.createGain(); s.gain.value = rev * (p.key && p.key.z.airy ? 1.35 : 1); tail.connect(s); s.connect(p.wet); nodes.push(s); }
  p.nodes.push(...nodes); p.buses[key] = b;
  return b;
}
function barStart(p) {
  const d = p.def;
  if (p.bar % 4 === 0) {
    p.key = keyFor(d);
    if (!p.prog || (p.bar % 8 === 0 && Math.random() < 0.65)) p.prog = pick(d.progs);
    if (d.pats) p.pat = pick(d.pats);
    if (d.drums) p.drum = pick(d.drums);
  }
  if (d.cells && (p.bar % 16 === 0) && (!p.motif || Math.random() < 0.6)) {
    p.motif = genPhrase(d.cells, 32, pick([0, 2, 4]), d.range);
    p.motifB = genPhrase(d.cells, 32, pick([2, 4, 5]), [d.range[0] + 2, d.range[1] + 2]);
  }
  p.ch = p.prog[p.bar % p.prog.length];
  if (d.cells && p.bar % 2 === 0) {
    const ph = (p.bar >> 1) % 4;
    p.ph = ph;
    p.mel = ph === 0 ? p.motif : ph === 1 ? vary(p.motif, 0.3) : ph === 2 ? vary(p.motifB, 0.2) : vary(p.motif, 0.15);
    p.melOn = Math.random() < (d.melProb ?? 0.85);
  }
}
function melAt(p, s) { if (!p.melOn || !p.mel) return null; const pos = (p.bar % 2) * 16 + s; return p.mel.find((e) => e.at === pos) || null; }
function melNote(p, e, s, oct) { return N(p, s % 4 === 0 || e.l >= 8 ? snap(p, e.d) : e.d, oct); }

const OST_EX = [[0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 3, 2, 1, 2, 1], [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 3, 2, 1, 2, 1, 2], [0, 0, 2, 0, 1, 0, 2, 0, 0, 0, 2, 0, 3, 2, 1, 0]];
const OST_CB = [[0, 0, 1, 0, 2, 0, 1, 0, 0, 0, 1, 0, 3, 2, 1, 0], [0, 2, 0, 2, 1, 2, 0, 2, 0, 2, 0, 2, 3, 2, 1, 2], [0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 0, 2, 3, 0, 2, 1]];

const STATES = {
  // the title screen: an epic, booming war theme - pounding taiko and timpani, driving low strings,
  // brass stabs, a soaring horn melody over a full choir, crashes and huge low booms at each new phrase
  title: {
    bpm: 92, root: 50, mode: 'aeolian', fixed: true, melProb: 1,
    progs: [[0, 5, 3, 4], [0, 6, 5, 4], [0, 3, 6, 4], [0, 5, 6, 4]],
    cells: [[4, 4, 8], [6, 2, 8], [8, 4, 4], [2, 2, 4, 8], [12, 4]], range: [2, 10],
    step(p, s, t) {
      const L = p.spb * 16, dr = bus(p, 'drum', 0, 0.45), bar = p.bar % 8, intro = p.bar < 2;
      // drums: a war-drum groove, a rising roll into every fourth bar
      const groove = [1, 0, 0, 0.55, 0, 0, 0.75, 0, 1, 0, 0, 0.55, 0, 0, 0.7, 0.4];
      if (!intro && groove[s]) INS.taiko(dr, t, 0.42 * groove[s], s % 8 === 0 ? 0.85 : 1.1);
      if (intro && s === 0) INS.taiko(dr, t, 0.5, 0.75);
      if (p.bar % 4 === 3 && s >= 8) INS.taiko(dr, t, 0.12 + (s - 8) * 0.045, 1.25);
      if (s === 0) INS.timp(dr, t, p.key.root, 0.32);
      if (s === 8 && !intro) INS.timp(dr, t, ct(p, 2, -1), 0.2);
      // phrase starts: crash and a deep boom
      if (s === 0 && p.bar % 4 === 0) {
        INS.crash(bus(p, 'cym', 0, 0.6), t, p.bar ? 0.07 : 0.05);
        voice(dr, t, { f: 62, f1: 28, glide: 0.9, a: 0.004, r: 1.6, v: 0.5 });
        nz(dr, t, { c: 'brown', f: 300, ft: 'lowpass', f1: 60, fT: 0.8, a: 0.004, r: 1.2, v: 0.35 });
      }
      if (p.bar % 4 === 3 && s === 2) INS.swell(bus(p, 'cym', 0, 0.6), t, p.spb * 14, 0.05);
      // driving low strings
      const ost = bus(p, 'ost', -0.15, 0.25);
      if (!intro) INS.short(ost, t, ct(p, [0, 0, 2, 0, 1, 0, 2, 0][s % 8], -1), p.spb * 0.85, s % 4 === 0 ? 0.06 : 0.04, 1400);
      if (s === 0) {
        const lo = bus(p, 'low', 0, 0.3);
        INS.str(lo, t, ct(p, 0, -2), L * 0.95, 0.08, { a: 0.15, r: 0.8, lp: 420 });
        const c = bus(p, 'choir', 0, 0.7), vow = bar < 4 ? 'ah' : 'oh';
        for (const i of [0, 1, 2]) INS.choir(c, t, ct(p, i, 0), L * 0.9, 0.045, vow, { a: 0.5, r: 1.2 });
        INS.choir(c, t, ct(p, 0, 1), L * 0.9, 0.03, vow, { a: 0.6, r: 1.2 });
      }
      // brass stabs on the beat accents
      const br = bus(p, 'brass', 0.1, 0.5);
      if (!intro && (s === 0 || (bar % 2 === 1 && (s === 6 || s === 10)))) for (const i of [0, 1, 2]) brass(br, t, ct(p, i, 0), p.spb * (s === 0 ? 3 : 1.6), s === 0 ? 0.05 : 0.035, 1.7);
      // the heroic melody: horns, doubled an octave up by strings in the second half
      const e = melAt(p, s);
      if (e && !intro) {
        const len = e.l * p.spb * 0.95;
        INS.horn(bus(p, 'horn', -0.2, 0.6), t, melNote(p, e, s, 0), len, 0.085, 1.5);
        if (bar >= 4) INS.str(bus(p, 'hi', 0.2, 0.6), t, melNote(p, e, s, 1), len, 0.035, { a: 0.1, lp: 2600 });
      }
      if (s === 0 && bar === 6) INS.bell(bus(p, 'bell', 0.3, 0.75), t, ct(p, 0, 2), 0.04, 3);
    },
  },
  town: {
    bpm: 90, root: 53, mode: 'ionian', fixed: true, melProb: 0.7,
    progs: [[0, 3, 4, 0], [0, 5, 3, 4], [0, 4, 5, 3], [0, 3, 0, 4], [5, 3, 0, 4]],
    pats: [[0, 2, 1, 2, 3, 2, 1, 2], [0, 1, 2, 3, 2, 1, 2, 1], [0, 2, 3, 2, 4, 2, 3, 2], [0, 2, 1, 3, 2, 1, 2, 4]],
    cells: [[4, 4], [2, 2, 4], [6, 2], [4, -4], [8], [2, 2, 2, 2]], range: [2, 11],
    step(p, s, t) {
      const L = p.spb * 16;
      if (s === 0) {
        const pad = bus(p, 'pad', 0, 0.4);
        for (const i of [0, 1, 2]) INS.str(pad, t, ct(p, i, 0), L * 0.85, 0.016, { a: 0.8, r: 1, lp: 1100, vib: 5 });
      }
      const bs = bus(p, 'bass', 0, 0.2);
      if (s === 0) pluck(bs, t, ct(p, 0, -1), 0.14, 0.3, L * 0.5);
      if (s === 8) pluck(bs, t, ct(p, 2, -1), 0.11, 0.3, L * 0.5);
      if (s % 2 === 0) pluck(bus(p, 'lute', -0.25, 0.3), t, ct(p, p.pat[s / 2], 0), 0.06 + (s % 8 === 0 ? 0.025 : 0), 0.45, 0.9);
      const e = melAt(p, s);
      if (e) pluck(bus(p, 'harp', 0.3, 0.5), t, melNote(p, e, s, 1), 0.09, 0.75, e.l * p.spb + 0.6);
      if (s === 0 && p.bar % 4 === 0) INS.frame(bus(p, 'drum', 0, 0.3), t, 0.03);
    },
  },
  explore: {
    bpm: 84, root: 50, mode: 'dorian', melProb: 0.75,
    progs: [[0, 6, 3, 0], [0, 2, 6, 3], [0, 3, 4, 0], [0, 6, 2, 3], [0, 4, 6, 3]],
    pats: OST_EX,
    cells: [[4, 2, 2], [6, 2], [4, 4], [2, 2, 4], [8], [-4, 4], [3, 3, 2]], range: [0, 9],
    step(p, s, t) {
      const L = p.spb * 16, z = p.key.z, dark = z.dark || 0;
      if (s === 0) {
        const lo = bus(p, 'low', 0, 0.3);
        INS.str(lo, t, ct(p, 0, -1), L * 0.9, 0.06, { a: 0.3, r: 0.7, lp: 500 - dark * 150 });
        const pad = bus(p, 'pad', 0, 0.5);
        for (const i of [1, 2]) INS.str(pad, t, ct(p, i, 0), L * 0.85, 0.02, { a: 0.7, r: 1, lp: 1200 - dark * 300, vib: z.eerie ? 25 : 6 });
        if (dark) INS.str(lo, t, ct(p, 0, -2), L * 0.9, 0.05 * dark, { a: 0.6, r: 1, lp: 260 });
      }
      const ost = bus(p, 'ost', -0.2, 0.25);
      if (s % 2 === 0) INS.short(ost, t, ct(p, p.pat[s], dark > 0.5 ? -1 : 0), p.spb * 1.6, s % 4 === 0 ? 0.03 : 0.02, 1500 - dark * 500); // a gentle, flowing ostinato
      const dr = bus(p, 'drum', 0.1, 0.3);
      if (s === 0 || s === 10) INS.frame(dr, t, z.eerie ? 0.025 : 0.04);
      if (s === 0 && (p.bar % 4 === 0 || dark)) INS.taiko(dr, t, 0.1 + dark * 0.08, 0.9);
      if (!z.eerie && s % 4 === 2) INS.shaker(bus(p, 'shk', 0.35, 0.1), t, 0.012);
      if (!z.eerie && s % 4 === 0 && Math.random() < 0.55) pluck(bus(p, 'harp', 0.35, 0.6), t, ct(p, [0, 1, 2, 1][(s / 4) | 0], 1), 0.04, 0.8, 1.4); // harp shimmer
      if (p.bar % 8 === 7 && s === 4) INS.swell(bus(p, 'cym', 0, 0.5), t, p.spb * 12, 0.035);
      if (p.bar % 8 === 0 && s === 0 && p.bar) INS.crash(bus(p, 'cym', 0, 0.5), t, 0.035);
      if (z.airy && (s === 4 || s === 12) && Math.random() < 0.5) pluck(bus(p, 'harp', 0.4, 0.7), t, ct(p, (Math.random() * 3) | 0, 2), 0.05, 0.8, 1.2);
      if (z.eerie && s === 8 && Math.random() < 0.3) { const f = mtof(ct(p, 1, 1)); voice(bus(p, 'eerie', -0.4, 0.8), t, { f, f1: f * 0.94, a: 0.8, h: 0.6, r: 1.2, v: 0.018, vib: 25 }); }
      const e = melAt(p, s);
      if (e) {
        const len = e.l * p.spb * 0.95;
        if (p.ph === 2) INS.str(bus(p, 'hi', 0.2, 0.45), t, melNote(p, e, s, 1), len, 0.03, { a: 0.08, lp: 2400 });
        else INS.horn(bus(p, 'horn', -0.1, 0.45), t, melNote(p, e, s, 0), len, 0.065, 1 - dark * 0.25);
      }
    },
  },
  night: {
    bpm: 64, root: 45, mode: 'aeolian', melProb: 0.6,
    progs: [[0, 5, 0, 6], [0, 3, 0, 5], [0, 6, 5, 6], [3, 0, 5, 0]],
    cells: [[8, 8], [12, 4], [-8, 8], [16], [4, 4, 8], [-16], [6, 2, 8]], range: [0, 9],
    step(p, s, t) {
      const L = p.spb * 16, z = p.key.z;
      if (s === 0) {
        const pad = bus(p, 'pad', 0, 0.7);
        for (const i of [0, 1, 2]) INS.choir(pad, t, ct(p, i, 1), L * 0.7, 0.018, 'oo', { a: 2, r: 3 });
        voice(bus(p, 'low', 0, 0.3), t, { f: mtof(ct(p, 0, 0)), a: 1, h: L * 0.6, r: 2, v: 0.06 });
        if (z.dark) INS.str(bus(p, 'low', 0, 0.3), t, ct(p, 0, -1), L * 0.8, 0.035, { a: 1.2, r: 1.5, lp: 280 });
      }
      if (Math.random() < (z.airy ? 0.08 : 0.04)) pluck(bus(p, 'harp', rp(0.6), 0.85), t, ct(p, (Math.random() * 4) | 0, 2), 0.035, 0.7, 1.4);
      if (z.eerie && s === 4 && Math.random() < 0.3) { const f = mtof(ct(p, 1, 2)); voice(bus(p, 'eerie', 0.4, 0.9), t, { f, f1: f * 0.944, a: 1, h: 1, r: 1.5, v: 0.02, vib: 20 }); }
      const e = melAt(p, s);
      if (e) INS.flute(bus(p, 'flute', 0.15, 0.6), t, melNote(p, e, s, 2), e.l * p.spb * 0.92, 0.05);
    },
  },
  combat: {
    bpm: 144, root: 50, mode: 'harmonic', melProb: 0.75,
    progs: [[0, 0, 5, 4], [0, 5, 3, 4], [0, 3, 0, 4], [5, 3, 4, 4], [0, 5, 0, 4]],
    pats: OST_CB,
    drums: [[0, 3, 6, 8, 11, 14], [0, 6, 8, 10, 12, 14], [0, 3, 8, 11, 12, 13, 14, 15], [0, 7, 8, 10, 14]],
    cells: [[4, 4], [2, 2, 4], [6, 2], [3, 3, 2], [8], [2, 2, 2, 2]], range: [0, 9],
    init(p) {
      const lp = buffers.battleLoop;
      if (buffers.battle && lp && (combatRecToggle = !combatRecToggle)) {
        const s = ctx.createBufferSource(); s.buffer = buffers.battle; s.loop = true; s.loopStart = lp.start; s.loopEnd = lp.end;
        const g = ctx.createGain(); g.gain.value = 0.6; s.connect(g); g.connect(p.gain);
        const w = ctx.createGain(); w.gain.value = 0.12; g.connect(w); w.connect(p.wet);
        s.start(ctx.currentTime + 0.05, lp.start); p.src = s; p.rec = true; p.nodes.push(g, w);
      }
    },
    step(p, s, t) {
      if (p.rec) return;
      const L = p.spb * 16, dr = bus(p, 'drum', 0, 0.3);
      if (s === 0) {
        INS.str(bus(p, 'low', 0, 0.2), t, ct(p, 0, -2), L * 0.95, 0.06, { a: 0.05, r: 0.3, lp: 320 });
        if (p.bar % 4 === 0) INS.crash(bus(p, 'cym', 0, 0.4), t, 0.07);
      }
      if (p.drum.includes(s)) INS.taiko(dr, t, s % 8 === 0 ? 0.34 : 0.2, rnd(0.9, 1.1));
      if (s === 0) INS.timp(dr, t, ct(p, 0, -1), 0.28);
      if (s === 8) INS.timp(dr, t, ct(p, 2, -1), 0.2);
      if (s === 4 || s === 12) INS.frame(dr, t, 0.12);
      if (s % 2 === 0) INS.shaker(bus(p, 'shk', 0.3, 0.05), t, s % 4 === 0 ? 0.025 : 0.015);
      const ost = bus(p, 'ost', -0.25, 0.2), n = p.pat[s];
      INS.short(ost, t, ct(p, n, -1), p.spb * 0.9, s % 4 === 0 ? 0.05 : 0.034, 1500);
      INS.short(bus(p, 'ost2', 0.25, 0.2), t, ct(p, n, 0), p.spb * 0.8, s % 4 === 0 ? 0.03 : 0.018, 2000);
      const stab = s === 0 || (s === 6 && p.bar % 2 === 1) || (s === 10 && p.bar % 4 === 2);
      if (stab) { const b = bus(p, 'brass', 0, 0.3); for (const i of [0, 1, 2]) INS.horn(b, t, ct(p, i, 0), 0.18, 0.04, 1.6); }
      const e = melAt(p, s);
      if (e && (p.ph === 1 || p.ph === 3)) INS.horn(bus(p, 'lead', 0.05, 0.35), t, melNote(p, e, s, 0), e.l * p.spb * 0.92, 0.07, 1.3);
      else if (e && p.ph === 2) INS.str(bus(p, 'hi', 0.2, 0.35), t, melNote(p, e, s, 1), e.l * p.spb * 0.9, 0.03, { a: 0.03, lp: 2600 });
    },
  },
  boss: {
    bpm: 116, root: 47, mode: 'phrygian', melProb: 0.85,
    progs: [[0, 1, 0, 1], [0, 5, 1, 0], [0, 6, 5, 1], [0, 3, 1, 0]],
    cells: [[8, 8], [4, 4, 8], [12, 4], [16], [6, 2, 8]], range: [0, 8],
    step(p, s, t) {
      const L = p.spb * 16, dr = bus(p, 'drum', 0, 0.35);
      if (s === 0) {
        const c = bus(p, 'choir', 0, 0.55);
        for (const i of [0, 1, 2]) INS.choir(c, t, ct(p, i, 0), L * 0.9, 0.04, 'ah', { a: 0.3, r: 0.8 });
        INS.choir(c, t, ct(p, 0, 1), L * 0.9, 0.03, 'ah', { a: 0.3, r: 0.8 });
        voice(bus(p, 'sub', 0, 0), t, { f: mtof(ct(p, 0, -2)), a: 0.05, h: L * 0.85, r: 0.3, v: 0.12 });
        if (p.bar % 4 === 0) INS.crash(bus(p, 'cym', 0, 0.45), t, 0.08);
      }
      if (s % 4 === 0) INS.taiko(dr, t, 0.36, 0.72);
      if (s === 14 || s === 15) INS.taiko(dr, t, 0.24, 0.8);
      if (s === 6 || s === 10) INS.taiko(dr, t, 0.15, 1.4);
      if (s === 0) INS.timp(dr, t, ct(p, 0, -1), 0.34);
      if (s === 8) INS.timp(dr, t, ct(p, 0, -1), 0.24);
      if (s % 2 === 0) {
        const off = [0, 0, 1, 0, 0, 0, 1, -1][s / 2];
        INS.horn(bus(p, 'lowbrass', -0.15, 0.2), t, N(p, p.ch + off, -1), p.spb * 1.4, 0.045, 1.1);
      }
      INS.short(bus(p, 'trem', 0.3, 0.3), t, ct(p, s % 2 ? 2 : 1, 1), p.spb * 0.7, 0.012, 2200);
      const e = melAt(p, s);
      if (e) {
        if (p.ph === 2) INS.choir(bus(p, 'lead', 0.1, 0.6), t, melNote(p, e, s, 1), e.l * p.spb * 0.9, 0.04, 'oo', { a: 0.15, r: 0.5 });
        else INS.horn(bus(p, 'lead2', 0.1, 0.4), t, melNote(p, e, s, 1), e.l * p.spb * 0.92, 0.065, 1.3);
      }
    },
  },
  victory: {
    bpm: 120, root: 50, mode: 'ionian', fixed: true, progs: [[0]],
    step(p, s, t) {
      if (p.bar === 0 && s === 0) fanfare(p, t);
      if (p.bar === 3 && s === 0 && !p.fell) { p.fell = true; if (curState === 'victory') setMusic(baseState); }
    },
  },
};
function fanfare(p, t) {
  const B = 0.5, hb = bus(p, 'brass', 0, 0.45), dr = bus(p, 'drum', 0, 0.4), ch = bus(p, 'choir', 0, 0.6), st = bus(p, 'str', 0.2, 0.4);
  const mel = [[0, 57, 0.2], [1 / 3, 57, 0.2], [2 / 3, 57, 0.2], [1, 62, 1.2], [2.5, 64, 0.4], [3, 66, 0.9], [4, 64, 0.35], [4.5, 66, 0.35], [5, 69, 2.6]];
  for (const [b, m, l] of mel) { INS.horn(hb, t + b * B, m, l, 0.09, 1.5); INS.horn(hb, t + b * B, m - 12, l, 0.05, 1.1); }
  const chords = [[1, [50, 54, 57], 1.4], [3, [55, 59, 62], 0.9], [4, [57, 61, 64], 0.9], [5, [50, 54, 57, 62], 2.6]];
  for (const [b, ms, l] of chords) for (const m of ms) INS.horn(hb, t + b * B, m, l, 0.035, 1.1);
  for (const [b, m, l] of [[1, 38, 1.4], [3, 43, 0.9], [4, 45, 0.9], [5, 38, 2.6]]) INS.str(bus(p, 'low', 0, 0.3), t + b * B, m, l, 0.08, { a: 0.03, r: 0.8, lp: 500 });
  for (const [b, m, v] of [[1, 38, 0.35], [3, 43, 0.25], [4, 45, 0.25], [5, 38, 0.42]]) INS.timp(dr, t + b * B, m, v);
  for (let i = 0; i < 4; i++) INS.timp(dr, t + (4.5 + i / 8) * B, 45, 0.08 + i * 0.03);
  INS.swell(dr, t, B, 0.04); INS.crash(dr, t + 5 * B, 0.1); INS.crash(dr, t + B, 0.06);
  choirS(ch, t + 5 * B, [62, 66, 69], 1.8, 0.04, 'ah', 0.3, 1.5);
  [62, 64, 66, 67, 69, 71, 73, 74].forEach((m, i) => INS.short(st, t + (4 + i / 8) * B, m, B / 8, 0.03, 2600));
}

function newPlayer(state) {
  const def = STATES[state];
  const p = { state, def, s: 0, bar: -1, t: ctx.currentTime + 0.08, spb: 60 / def.bpm / 4, buses: {}, nodes: [], dying: false, key: keyFor(def) };
  p.gain = ctx.createGain(); p.gain.gain.value = 0.0001; p.gain.connect(musicBus);
  p.wet = ctx.createGain(); p.wet.gain.value = 0.0001; p.wet.connect(musicRevSend);
  try { def.init && def.init(p); } catch (e) { /* ignore */ }
  return p;
}
function fadeP(p, to, sec) {
  const now = ctx.currentTime;
  for (const g of [p.gain, p.wet]) { g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now); g.gain.linearRampToValueAtTime(Math.max(to, 0.0001), now + sec); }
}
function killP(p) {
  try { if (p.src) p.src.stop(); } catch (e) { /* stopped */ }
  for (const n of [p.gain, p.wet, ...p.nodes]) { try { n.disconnect(); } catch (e) { /* gone */ } }
  const i = players.indexOf(p); if (i >= 0) players.splice(i, 1);
}
function startState(state) {
  const fast = state === 'victory' || state === 'combat' || state === 'boss';
  for (const p of players) if (!p.dying) { p.dying = true; const sec = fast ? 1.8 : 2.6; fadeP(p, 0, sec); p.dieAt = ctx.currentTime + sec + 0.4; }
  if (state === 'none' || !STATES[state]) return;
  const p = newPlayer(state);
  fadeP(p, 1, state === 'victory' ? 0.25 : fast ? 1.6 : 2.6);
  players.push(p);
}
export function setMusic(state) {
  if (state !== 'none' && !STATES[state]) return;
  if (state === curState) return;
  curState = state;
  if (state === 'town' || state === 'explore' || state === 'night') baseState = state;
  if (!ctx || !musicBus) return;          // remembered; starts when initAudio runs
  try { startState(state); } catch (e) { /* ignore */ }
}
export function musicState() { return curState; }
export function setMusicZone(zone) { if (ZONES[zone]) musicZone = zone; }

function tick() {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  for (const p of players.slice()) {
    if (p.dying && now > p.dieAt) { killP(p); continue; }
    if (p.t < now - 0.25) p.t = now + 0.03;   // stalled (background tab): skip ahead rather than burst
    let guard = 0;
    while (p.t < now + 0.2 && guard++ < 24) {
      const s = p.s % 16;
      try { if (s === 0) { p.bar++; barStart(p); } if (live < MAX_LIVE + 80) p.def.step(p, s, p.t); } catch (e) { /* keep going */ }
      p.s++; p.t += p.spb;
    }
  }
  ambTick(now);
}

// ---------------------------------------------------------------------------------------------
// ambience
// ---------------------------------------------------------------------------------------------
const AMB = {};
const AMB_GAIN = { wind: 0.5, birds: 1, crickets: 1, sea: 0.8, mire: 0.9, embers: 0.8, town: 0.9 };
let ambWant = { zone: 'meadow', night: false, inTown: false };
let ambLast = 0;
function layer(name) {
  let L = AMB[name]; if (L) return L;
  const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(ambBus);
  const s = ctx.createGain(); s.gain.value = 0.35; g.connect(s); s.connect(ambRevSend);
  L = AMB[name] = { g, level: 0, built: false };
  return L;
}
function loopSrc(c, rate = 1) { const s = ctx.createBufferSource(); s.buffer = NZ[c]; s.loop = true; s.playbackRate.value = rate; s.start(ctx.currentTime, Math.random() * 2.5); return s; }
function lfo(param, rate, depth) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); return o; }
function filt(type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function gainN(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
function panN(v, dest) { if (!ctx.createStereoPanner) return dest; const p = ctx.createStereoPanner(); p.pan.value = v; p.connect(dest); return p; }
const BUILD = {
  wind(L) {
    for (const side of [-0.7, 0.7]) {
      const s = loopSrc('pink', rnd(0.9, 1.1)), bp = filt('bandpass', 480, 0.6), g = gainN(0.5);
      lfo(bp.frequency, rnd(0.05, 0.09), 280); lfo(g.gain, rnd(0.07, 0.13), 0.35);
      s.connect(bp); bp.connect(g); g.connect(panN(side, L.g));
    }
    const s = loopSrc('pink'), bp = filt('bandpass', 1400, 8), g = gainN(0.12);
    lfo(bp.frequency, 0.06, 250); lfo(g.gain, 0.17, 0.08);
    s.connect(bp); bp.connect(g); g.connect(L.g);
  },
  sea(L) {
    for (const [side, r1] of [[-0.35, 0.083], [0.35, 0.067]]) {
      const s = loopSrc('brown'), lp = filt('lowpass', 650), g = gainN(0.5);
      lfo(g.gain, r1, 0.38); lfo(g.gain, r1 * 1.7, 0.1);
      s.connect(lp); lp.connect(g); g.connect(panN(side, L.g));
      const f = loopSrc('pink'), hp = filt('highpass', 1800), fg = gainN(0.1);
      lfo(fg.gain, r1, 0.09);
      f.connect(hp); hp.connect(fg); fg.connect(panN(side, L.g));
    }
  },
  mire(L) { const s = loopSrc('brown', 0.7), lp = filt('lowpass', 220), g = gainN(0.4); lfo(g.gain, 0.05, 0.15); s.connect(lp); lp.connect(g); g.connect(L.g); },
  embers(L) {
    const s = loopSrc('brown'), lp = filt('lowpass', 420), g = gainN(0.35); lfo(g.gain, 0.3, 0.1); s.connect(lp); lp.connect(g); g.connect(L.g);
    const h = loopSrc('pink'), bp = filt('bandpass', 3000, 1), hg = gainN(0.025); h.connect(bp); bp.connect(hg); hg.connect(L.g);
  },
  town(L) { const s = loopSrc('pink'), bp = filt('bandpass', 450, 1.2), g = gainN(0.12); lfo(g.gain, 0.4, 0.05); lfo(bp.frequency, 0.23, 80); s.connect(bp); bp.connect(g); g.connect(L.g); },
};
function ev(L, pan = rp(0.8), rev = 0.4, life = 3) { return chain(L.g, ambRevSend, 1, pan, rev, life); }
const EVENTS = {
  wind: [[0.05, (L, t) => { const d = ev(L, rp(0.6), 0.2, 4); nz(d, t, { c: 'pink', f: 400, f1: 1200, fT: 1.2, f2: 500, q: 1, a: 1.2, r: 1.8, v: 0.25 }); }]],
  birds: [[0.45, (L, t) => {
    const d = ev(L, rp(0.9), 0.45, 3), k = Math.random();
    if (k < 0.45) { let tt = t; const n = 2 + ((Math.random() * 4) | 0), b = rnd(2800, 4500); for (let i = 0; i < n; i++) { const f = b * rnd(0.85, 1.15); voice(d, tt, { f, f1: f * rnd(0.7, 1.3), glide: 0.06, a: 0.005, r: 0.07, v: 0.045 }); tt += rnd(0.08, 0.14); } }
    else if (k < 0.7) voice(d, t, { f: rnd(3200, 4200), a: 0.02, h: rnd(0.25, 0.5), r: 0.1, v: 0.025, vib: 300, vibRate: rnd(20, 28), vibD: 0.02 });
    else { const f = rnd(2400, 3200); voice(d, t, { f, f1: f * 0.7, a: 0.02, r: 0.3, v: 0.035 }); voice(d, t + 0.4, { f: f * 0.75, f1: f * 1.05, a: 0.02, r: 0.22, v: 0.03 }); }
  }]],
  crickets: [[1.6, (L, t) => {
    const d = ev(L, rp(0.9), 0.2, 1.5), f = Math.random() < 0.5 ? 4300 : 4850, n = 3 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) voice(d, t + i * 0.028, { f, a: 0.003, r: 0.018, v: 0.022 });
  }], [0.03, (L, t) => { if (ambWant.zone === 'coast' || ambWant.inTown) return; const d = ev(L, rp(0.8), 0.6, 3); for (const dt of [0, 0.55]) voice(d, t + dt, { f: 390, f1: 345, a: 0.05, r: 0.32, v: 0.045 }); }]],
  sea: [[0.07, (L, t) => { const d = ev(L, rp(0.8), 0.6, 3); for (const dt of [0, 0.4]) voice(d, t + dt, { type: 'triangle', f: rnd(1700, 1900), f1: 1200, a: 0.02, r: 0.3, v: 0.022, vib: 60 }); }]],
  mire: [
    [0.7, (L, t) => { const d = ev(L, rp(0.8), 0.25, 1); bubbles(d, t, 1 + ((Math.random() * 3) | 0), 0.3, 0.07); }],
    [0.22, (L, t) => { const d = ev(L, rp(0.8), 0.35, 2), f = rnd(85, 140), n = 3 + ((Math.random() * 5) | 0); for (let i = 0; i < n; i++) voice(d, t + i * 0.09, { type: 'square', f, f1: f * 0.92, a: 0.005, r: 0.06, v: 0.06, lp: 650, ft: 'bandpass', q: 3 }); }],
    [0.03, (L, t) => { const d = ev(L, rp(0.8), 0.8, 4); voice(d, t, { types: ['sawtooth', 'sawtooth'], det: [-20, 20], f: 180, f1: 140, a: 0.8, r: 1.5, v: 0.03, lp: 500, ft: 'bandpass', q: 3, vib: 30 }); }],
  ],
  embers: [
    [3, (L, t) => { const d = ev(L, rp(0.6), 0.15, 0.6); nz(d, t, { c: 'white', f: rnd(1500, 5000), q: 2, a: 0.001, r: rnd(0.006, 0.02), v: rnd(0.03, 0.08) }); }],
    [0.2, (L, t) => { const d = ev(L, rp(0.6), 0.25, 1); crackle(d, t, 5, 0.15, 0.12, 2500); }],
    [0.05, (L, t) => { if (ambWant.night) return; const d = ev(L, rp(0.9), 0.6, 2); for (let i = 0; i < 2 + ((Math.random() * 2) | 0); i++) voice(d, t + i * 0.35, { type: 'sawtooth', f: 720, f1: 540, a: 0.01, r: 0.2, v: 0.025, lp: 1500, ft: 'bandpass', q: 3 }); }],
  ],
  town: [
    [0.3, (L, t) => { const d = ev(L, rp(0.9), 0.55, 3), f = rnd(1500, 2200), n = 1 + ((Math.random() * 3) | 0); for (let i = 0; i < n; i++) fm(d, t + i * 0.36, { f: f * vr(0.01), ratio: 2.76, idx: 2, dur: 0.4, v: 0.035 }); }],
    [0.22, (L, t) => { const d = ev(L, rp(0.8), 0.4, 2.5), n = 3 + ((Math.random() * 5) | 0); let tt = t; for (let i = 0; i < n; i++) { nz(d, tt, { c: 'pink', f: rnd(400, 950), q: 4, a: 0.03, r: 0.08, v: 0.05 }); tt += rnd(0.1, 0.18); } }],
    [0.05, (L, t) => { const d = ev(L, rp(0.9), 0.4, 1.5); for (const dt of [0, 0.14]) voice(d, t + dt, { f: 300, f1: 200, r: 0.06, v: 0.05 }); }],
  ],
};
function ambTargets(w) {
  const z = w.zone || 'meadow', n = !!w.night, town = !!w.inTown || z === 'town';
  return {
    wind: (z === 'frost' ? 1.2 : z === 'coast' ? 0.9 : z === 'ruins' ? 0.85 : z === 'thorn' ? 0.5 : z === 'mire' ? 0.35 : town ? 0.25 : 0.4) * (n ? 0.85 : 1),
    birds: !n && !town ? (z === 'ruins' ? 0.2 : z === 'mire' ? 0.45 : z === 'coast' ? 0.55 : 1) : 0,
    crickets: n ? (town ? 0.45 : z === 'coast' ? 0.4 : z === 'ruins' ? 0.5 : 1) : 0,
    sea: z === 'coast' ? 1 : 0,
    mire: z === 'mire' ? 1 : 0,
    embers: z === 'ruins' ? 1 : 0,
    town: town ? (n ? 0.45 : 1) : 0,
  };
}
function applyAmbience() {
  if (!ctx || !ambBus) return;
  const T = ambTargets(ambWant), now = ctx.currentTime;
  for (const name of Object.keys(T)) {
    const lv = T[name];
    if (lv <= 0 && !AMB[name]) continue;
    const L = layer(name);
    if (lv > 0 && !L.built && BUILD[name]) { try { BUILD[name](L); } catch (e) { /* ignore */ } L.built = true; }
    L.level = lv;
    L.g.gain.cancelScheduledValues(now);
    L.g.gain.setValueAtTime(Math.max(L.g.gain.value, 0.0001), now);
    L.g.gain.setTargetAtTime(Math.max(lv * AMB_GAIN[name], 0.0001), now, 0.9);
  }
}
export function setAmbience(o = {}) {
  const w = { zone: o.zone ?? ambWant.zone, night: o.night ?? ambWant.night, inTown: o.inTown ?? ambWant.inTown };
  if (w.zone === ambWant.zone && !!w.night === !!ambWant.night && !!w.inTown === !!ambWant.inTown && ambLast) return;
  ambWant = w;
  try { applyAmbience(); } catch (e) { /* ignore */ }
}
function ambTick(now) {
  const dt = ambLast ? Math.min(0.25, now - ambLast) : 0; ambLast = now;
  if (!dt || live > MAX_LIVE - 40) return;
  for (const name of Object.keys(EVENTS)) {
    const L = AMB[name]; if (!L || L.level < 0.05) continue;
    for (const [rate, fn] of EVENTS[name]) if (Math.random() < rate * L.level * dt) { try { fn(L, now + 0.05 + Math.random() * 0.1); } catch (e) { /* ignore */ } }
  }
}

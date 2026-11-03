// Kingdom Rising 2 audio: procedural music, synthesized sound effects, ambience, plus CC0 sword samples.
import { settings } from './saves.js';

let ctx = null, master, musicBus, musicOut, sfxBus, ambBus, reverb, reverbSend, comp, sfxWet, ambWet;
const samples = {};
let listener = { x: 0, y: 0, z: 0, yaw: 0 };
let noiseBuf = null;

export const A = {
  get ready() { return !!ctx; },
  init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); sfxBus = ctx.createGain(); ambBus = ctx.createGain();
    // music skips the effects compressor (its make-up gain would push recorded music far too loud)
    musicOut = ctx.createGain(); musicOut.connect(ctx.destination); musicBus.connect(musicOut);
    sfxBus.connect(master); ambBus.connect(master);
    reverb = ctx.createConvolver(); reverb.buffer = makeImpulse(2.8, 2.5);
    reverbSend = ctx.createGain(); reverbSend.gain.value = 0.9;
    reverbSend.connect(reverb); reverb.connect(master);
    // the echo of each sound follows that sound's own volume slider
    sfxWet = ctx.createGain(); ambWet = ctx.createGain(); sfxWet.connect(reverbSend); ambWet.connect(reverbSend);
    noiseBuf = makeNoise(2);
    A.applyVolumes();
    loadSamples();
    startAmbience();
  },
  applyVolumes() {
    if (!ctx) return;
    master.gain.value = settings.master;
    musicOut.gain.value = settings.master;
    musicBus.gain.value = settings.music * 0.6;
    sfxBus.gain.value = settings.sfx;
    ambBus.gain.value = settings.ambient * 0.8;
    if (sfxWet) { sfxWet.gain.value = settings.sfx; ambWet.gain.value = settings.ambient * 0.8; }
  },
  setListener(x, y, z, yaw) { listener.x = x; listener.y = y; listener.z = z; listener.yaw = yaw; },
};

function makeNoise(sec) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function makeImpulse(sec, decay) {
  const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return b;
}
function loadSamples() {
  const base = '../audio/rec/';
  const names = [];
  for (let i = 1; i <= 10; i++) { names.push('swing' + i, 'clash' + i); }
  for (const n of names) {
    fetch(base + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(ab => ab && ctx.decodeAudioData(ab)).then(buf => { if (buf) samples[n] = buf; }).catch(() => {});
  }
}

// ---- spatial helper: returns a node to connect sources into ----
function out(pos, bus = sfxBus, wet = 0.15) {
  const g = ctx.createGain();
  let vol = 1, pan = 0;
  if (pos) {
    const dx = pos.x - listener.x, dz = pos.z - listener.z, dy = (pos.y || 0) - listener.y;
    const d = Math.sqrt(dx * dx + dz * dz + dy * dy);
    vol = 1 / (1 + Math.max(0, d - 2) * 0.09);
    if (d > 80) vol = 0;
    // right vector of listener: yaw 0 looks toward -z
    const rx = Math.cos(listener.yaw), rz = -Math.sin(listener.yaw);
    pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) * 0.8 : 0;
  }
  g.gain.value = vol;
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(bus); }
  else g.connect(bus);
  if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet * vol; g.connect(w); w.connect(bus === ambBus ? ambWet : bus === sfxBus ? sfxWet : reverbSend); }
  return { node: g, vol };
}
function now() { return ctx.currentTime; }
function env(g, t, a, peak, d, sus = 0, rel = 0) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t + a + d);
  if (rel) g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + rel);
}
function noise(t, dur, dest, { type = 'bandpass', f = 1000, q = 1, f2 = null, gain = 0.5, a = 0.005, d = null } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); env(g, t, a, gain, d || dur);
  s.connect(fl); fl.connect(g); g.connect(dest);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
  return { s, fl, g };
}
function tone(t, dur, dest, { type = 'sine', f = 440, f2 = null, gain = 0.3, a = 0.005, d = null, detune = 0 } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); env(g, t, a, gain, d || dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  return { o, g };
}
function sample(name, dest, rate = 1, gain = 1) {
  const b = samples[name]; if (!b) return false;
  const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = gain; s.connect(g); g.connect(dest); s.start();
  return true;
}
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (n) => 1 + Math.floor(Math.random() * n);

// ---------------- SOUND EFFECTS ----------------
export const S = {
  click() { if (!ctx) return; const o = out(null, sfxBus, 0); tone(now(), 0.06, o.node, { type: 'triangle', f: 900, f2: 600, gain: 0.12 }); },
  hover() { if (!ctx) return; const o = out(null, sfxBus, 0); tone(now(), 0.04, o.node, { type: 'sine', f: 1400, gain: 0.04 }); },
  swing(size = 1, pos) {
    if (!ctx) return; const o = out(pos, sfxBus, 0.1); const t = now();
    if (!sample('swing' + ri(10), o.node, rnd(0.9, 1.1) / Math.sqrt(size), 0.55)) {
      noise(t, 0.22 * size, o.node, { type: 'bandpass', f: 600, f2: 2400 / size, q: 1.5, gain: 0.35, a: 0.06 });
    }
    noise(t, 0.25 * size, o.node, { type: 'bandpass', f: 300 / size, f2: 1200 / size, q: 0.8, gain: 0.18 * size, a: 0.08 });
  },
  // weapon-specific swings: blunt (mace/hammer), axe, spear, light (daggers), staff; blades use the recorded sword swings
  swingW(kind, size = 1, pos) {
    if (!ctx) return;
    if (kind === 'blade') return S.swing(size, pos);
    const o = out(pos, sfxBus, 0.1), t = now();
    if (kind === 'blunt') {
      noise(t, 0.32 * size, o.node, { type: 'lowpass', f: 260, f2: 720, q: 1.2, gain: 0.55 * size, a: 0.1 });
      noise(t + 0.04, 0.26 * size, o.node, { type: 'bandpass', f: 180, f2: 420, q: 2.5, gain: 0.35 * size, a: 0.08 });
      tone(t, 0.3 * size, o.node, { type: 'sine', f: 70, f2: 110, gain: 0.12 * size, a: 0.12 });
    } else if (kind === 'axe') {
      noise(t, 0.28 * size, o.node, { type: 'bandpass', f: 350, f2: 1100, q: 1.6, gain: 0.45 * size, a: 0.08 });
      noise(t, 0.3 * size, o.node, { type: 'lowpass', f: 300, f2: 600, gain: 0.3 * size, a: 0.1 });
    } else if (kind === 'spear') {
      noise(t, 0.16 * size, o.node, { type: 'bandpass', f: 900, f2: 2600, q: 2, gain: 0.35, a: 0.03 });
      noise(t, 0.2, o.node, { type: 'lowpass', f: 500, gain: 0.15, a: 0.04 });
    } else if (kind === 'light') {
      noise(t, 0.12, o.node, { type: 'bandpass', f: 1800, f2: 4200, q: 2, gain: 0.28, a: 0.02 });
    } else if (kind === 'staff') {
      noise(t, 0.3 * size, o.node, { type: 'bandpass', f: 400, f2: 900, q: 1.4, gain: 0.35 * size, a: 0.1 });
    }
  },
  blunt(pos) { if (!ctx) return; const o = out(pos, sfxBus, 0.2), t = now(); tone(t, 0.22, o.node, { type: 'sine', f: 95, f2: 45, gain: 0.7 }); noise(t, 0.16, o.node, { type: 'lowpass', f: 900, f2: 200, gain: 0.7 }); noise(t + 0.01, 0.07, o.node, { type: 'bandpass', f: 600, q: 3, gain: 0.35 }); },
  heavySwing(pos) { if (!ctx) return; S.swing(1.6, pos); const o = out(pos, sfxBus, 0.2); noise(now(), 0.45, o.node, { type: 'lowpass', f: 400, f2: 1500, q: 2, gain: 0.35, a: 0.12 }); },
  hit(kind = 'flesh', pos, big = 1) {
    if (!ctx) return; const o = out(pos, sfxBus, 0.18); const t = now();
    if (kind === 'flesh') {
      noise(t, 0.12, o.node, { type: 'lowpass', f: 1800, f2: 300, gain: 0.55 * big });
      tone(t, 0.14, o.node, { type: 'sine', f: 140 * rnd(0.9, 1.1), f2: 60, gain: 0.5 * big });
      noise(t + 0.01, 0.08, o.node, { type: 'bandpass', f: 3000, q: 2, gain: 0.12 });
    } else if (kind === 'metal') {
      if (!sample('clash' + ri(10), o.node, rnd(0.95, 1.1), 0.6)) {
        [1, 2.76, 5.4].forEach((m, i) => tone(t, 0.6 - i * 0.15, o.node, { type: 'sine', f: 620 * m * rnd(0.98, 1.02), gain: 0.15 / (i + 1) }));
        noise(t, 0.05, o.node, { type: 'highpass', f: 3000, gain: 0.3 });
      }
    } else if (kind === 'bone') {
      noise(t, 0.08, o.node, { type: 'bandpass', f: 1600, q: 3, gain: 0.5 }); tone(t, 0.08, o.node, { type: 'square', f: 300, f2: 150, gain: 0.08 });
    } else if (kind === 'stone') {
      noise(t, 0.15, o.node, { type: 'bandpass', f: 900, q: 1.5, gain: 0.6 }); tone(t, 0.18, o.node, { type: 'sine', f: 90, f2: 50, gain: 0.4 });
    }
  },
  block(shield, pos) {
    if (!ctx) return; const o = out(pos, sfxBus, 0.2); const t = now();
    if (shield) { tone(t, 0.25, o.node, { type: 'sine', f: 160, f2: 90, gain: 0.5 }); noise(t, 0.15, o.node, { type: 'lowpass', f: 1200, gain: 0.5 }); }
    else S.hit('metal', pos);
  },
  chop(pos) {
    if (!ctx) return; const o = out(pos, sfxBus, 0.25); const t = now();
    tone(t, 0.12, o.node, { type: 'triangle', f: 220 * rnd(0.9, 1.1), f2: 120, gain: 0.5 });
    noise(t, 0.1, o.node, { type: 'bandpass', f: 1100, q: 2, gain: 0.5 });
  },
  mine(pos) {
    if (!ctx) return; const o = out(pos, sfxBus, 0.3); const t = now();
    [1, 2.4, 3.9].forEach((m, i) => tone(t, 0.35 - i * 0.08, o.node, { type: 'sine', f: 1300 * m * rnd(0.97, 1.03), gain: 0.12 / (i + 1) }));
    noise(t, 0.07, o.node, { type: 'highpass', f: 2500, gain: 0.4 });
    noise(t, 0.2, o.node, { type: 'lowpass', f: 500, gain: 0.25, a: 0.02 });
  },
  gather(pos) { if (!ctx) return; const o = out(pos, sfxBus, 0.05); noise(now(), 0.25, o.node, { type: 'bandpass', f: 2500, f2: 1200, q: 0.8, gain: 0.2, a: 0.03 }); },
  treeFall(pos) {
    if (!ctx) return; const o = out(pos, sfxBus, 0.4); const t = now();
    for (let i = 0; i < 6; i++) noise(t + i * 0.12, 0.1, o.node, { type: 'bandpass', f: 400 + Math.random() * 600, q: 3, gain: 0.25 });
    noise(t + 1.0, 0.8, o.node, { type: 'lowpass', f: 300, f2: 80, gain: 0.8 }); tone(t + 1.0, 0.5, o.node, { type: 'sine', f: 70, f2: 35, gain: 0.6 });
  },
  rockBreak(pos) { if (!ctx) return; const o = out(pos, sfxBus, 0.4); const t = now(); noise(t, 0.5, o.node, { type: 'lowpass', f: 1500, f2: 200, gain: 0.7 }); for (let i = 0; i < 5; i++) noise(t + 0.1 + Math.random() * 0.4, 0.06, o.node, { type: 'bandpass', f: 1500 + Math.random() * 2000, q: 4, gain: 0.25 }); },
  skin(pos) { if (!ctx) return; const o = out(pos, sfxBus, 0.05); const t = now(); for (let i = 0; i < 3; i++) noise(t + i * 0.2, 0.15, o.node, { type: 'bandpass', f: 1800, f2: 900, q: 2, gain: 0.25 }); },
  step(surface = 'grass', pos, vol = 1) {
    if (!ctx) return; const o = out(pos, sfxBus, 0.02); const t = now();
    const f = { grass: 1400, sand: 900, wood: 500, stone: 2200, snow: 700, water: 1200, ash: 800 }[surface] || 1200;
    noise(t, 0.09, o.node, { type: surface === 'stone' ? 'highpass' : 'bandpass', f: f * rnd(0.85, 1.15), q: 0.7, gain: 0.13 * vol, a: 0.008 });
    if (surface === 'wood') tone(t, 0.08, o.node, { type: 'triangle', f: 140, f2: 90, gain: 0.15 * vol });
    if (surface === 'water') noise(t, 0.2, o.node, { type: 'bandpass', f: 600, f2: 2000, q: 1, gain: 0.15 * vol, a: 0.03 });
  },
  jump() { if (!ctx) return; const o = out(null, sfxBus, 0); noise(now(), 0.15, o.node, { type: 'bandpass', f: 800, f2: 1600, gain: 0.12, a: 0.02 }); tone(now(), 0.1, o.node, { type: 'sine', f: 180, f2: 240, gain: 0.08 }); },
  land(h = 1) { if (!ctx) return; const o = out(null, sfxBus, 0.05); noise(now(), 0.12, o.node, { type: 'lowpass', f: 600, gain: 0.25 * Math.min(2, h) }); tone(now(), 0.12, o.node, { type: 'sine', f: 90, f2: 50, gain: 0.25 * Math.min(2, h) }); },
  dodge() { if (!ctx) return; const o = out(null, sfxBus, 0.05); noise(now(), 0.35, o.node, { type: 'bandpass', f: 500, f2: 1800, q: 1, gain: 0.3, a: 0.05 }); },
  splash(pos, big = 1) { if (!ctx) return; const o = out(pos, sfxBus, 0.2); noise(now(), 0.5 * big, o.node, { type: 'bandpass', f: 1500, f2: 400, q: 0.7, gain: 0.4 * big, a: 0.01 }); },
  bowDraw() { if (!ctx) return; const o = out(null, sfxBus, 0); noise(now(), 0.5, o.node, { type: 'bandpass', f: 400, f2: 900, q: 6, gain: 0.08, a: 0.3 }); },
  bowShot(pos) {
    if (!ctx) return; const o = out(pos, sfxBus, 0.1); const t = now();
    tone(t, 0.15, o.node, { type: 'triangle', f: 160, f2: 110, gain: 0.35 }); noise(t, 0.2, o.node, { type: 'highpass', f: 2500, f2: 6000, gain: 0.2, a: 0.01 });
  },
  arrowHit(pos) { if (!ctx) return; const o = out(pos, sfxBus, 0.1); const t = now(); noise(t, 0.06, o.node, { type: 'bandpass', f: 1200, q: 2, gain: 0.5 }); tone(t, 0.12, o.node, { type: 'triangle', f: 300, f2: 180, gain: 0.2 }); },
  cast(el = 'fire', pos, big = 1) {
    if (!ctx) return; const o = out(pos, sfxBus, 0.4); const t = now(), b = Math.min(2.5, big);
    if (el === 'fire') {
      // a roaring whoosh of flame with crackles in it
      noise(t, 0.55 * b, o.node, { type: 'bandpass', f: 250, f2: 1800, q: 0.9, gain: 0.7 * b, a: 0.03 });
      noise(t + 0.05, 0.6 * b, o.node, { type: 'lowpass', f: 700, f2: 250, gain: 0.45 * b, a: 0.08 });
      tone(t, 0.45 * b, o.node, { type: 'sawtooth', f: 70, f2: 140, gain: 0.07 * b, a: 0.06 });
      for (let i = 0; i < 6 + 4 * b; i++) noise(t + 0.05 + Math.random() * 0.5 * b, 0.02, o.node, { type: 'highpass', f: 2500 + Math.random() * 3000, gain: 0.35 });
    } else if (el === 'frost') {
      // chiming ice and a cold hiss
      [2400, 3200, 4100, 5400].forEach((f, i) => tone(t + i * 0.05, 0.7, o.node, { type: 'sine', f, f2: f * 1.25, gain: 0.06 * b }));
      noise(t, 0.6 * b, o.node, { type: 'highpass', f: 4000, f2: 2000, gain: 0.3 * b, a: 0.05 });
      noise(t + 0.1, 0.4, o.node, { type: 'bandpass', f: 900, q: 3, gain: 0.12 });
    } else if (el === 'arcane') {
      // a shimmering, ringing hum
      tone(t, 0.6 * b, o.node, { type: 'sine', f: 330, f2: 990, gain: 0.16, a: 0.03 }); tone(t, 0.6 * b, o.node, { type: 'sine', f: 337, f2: 1004, gain: 0.16, a: 0.03 });
      tone(t + 0.08, 0.9, o.node, { type: 'triangle', f: 1320, f2: 1760, gain: 0.05 });
      noise(t, 0.35, o.node, { type: 'bandpass', f: 2600, q: 6, gain: 0.14 });
    } else if (el === 'lightning') {
      // a sharp electric crack, a buzzing zap, then thunder rolling away
      noise(t, 0.08, o.node, { type: 'highpass', f: 3000, gain: 1.0 * b, a: 0.001 });
      noise(t, 0.25, o.node, { type: 'bandpass', f: 1800, q: 0.7, gain: 0.6 * b, a: 0.001 });
      const z = tone(t, 0.3, o.node, { type: 'sawtooth', f: 90, gain: 0.12 * b, a: 0.002 }); const lfo = ctx.createOscillator(); lfo.frequency.value = 60; const lg = ctx.createGain(); lg.gain.value = 40; lfo.connect(lg); lg.connect(z.o.frequency); lfo.start(t); lfo.stop(t + 0.35);
      for (let i = 0; i < 8; i++) noise(t + Math.random() * 0.25, 0.03, o.node, { type: 'bandpass', f: 3000 + Math.random() * 4000, gain: 0.45 });
      noise(t + 0.15, 1.6 * b, o.node, { type: 'lowpass', f: 220, f2: 60, gain: 0.55 * b, a: 0.2 });
    } else {
      noise(t, 0.3, o.node, { type: 'bandpass', f: 1500, q: 2, gain: 0.25 }); tone(t, 0.3, o.node, { type: 'sine', f: 600, f2: 1200, gain: 0.08 });
    }
  },
  // a looping spell sound for as long as a staff stream is held: fire roars, frost hisses, arcane hums. returns { stop() }
  spellLoop(el = 'fire') {
    if (!ctx) return { stop() {} };
    const o = out(null, sfxBus, 0.25), t = now(), g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.15); g.connect(o.node);
    const nodes = [];
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; nodes.push(src);
    const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(); src.connect(f1); f1.connect(f2); f2.connect(g);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.connect(lg); nodes.push(lfo);
    if (el === 'fire') { f1.type = 'lowpass'; f1.frequency.value = 900; f2.type = 'peaking'; f2.frequency.value = 300; f2.gain.value = 8; lfo.frequency.value = 7; lg.gain.value = 350; lg.connect(f1.frequency); g.gain.value = 0.9; }
    else if (el === 'frost') { f1.type = 'highpass'; f1.frequency.value = 2500; f2.type = 'lowpass'; f2.frequency.value = 7000; lfo.frequency.value = 3; lg.gain.value = 800; lg.connect(f1.frequency); }
    else { f1.type = 'bandpass'; f1.frequency.value = 1400; f1.Q.value = 2; f2.type = 'lowpass'; f2.frequency.value = 5000; lfo.frequency.value = 18; lg.gain.value = 600; lg.connect(f1.frequency);
      for (const fr of [220, 223.5, 440]) { const os = ctx.createOscillator(); os.type = 'sine'; os.frequency.value = fr; const og = ctx.createGain(); og.gain.value = fr > 300 ? 0.05 : 0.12; os.connect(og); og.connect(g); os.start(t); nodes.push(os); } }
    const vol = ctx.createGain(); vol.gain.value = el === 'fire' ? 0.55 : el === 'frost' ? 0.35 : 0.4; g.disconnect(); g.connect(vol); vol.connect(o.node);
    src.start(t, Math.random()); lfo.start(t);
    // fire crackles and pops while it burns
    const iv = el === 'fire' ? setInterval(() => { const tt = now(); for (let i = 0; i < 3; i++) noise(tt + Math.random() * 0.1, 0.02, vol, { type: 'highpass', f: 2500 + Math.random() * 3000, gain: 0.5 }); }, 110) : el === 'arcane' ? setInterval(() => noise(now(), 0.03, vol, { type: 'bandpass', f: 3000 + Math.random() * 3000, q: 4, gain: 0.4 }), 140) : null;
    return { stop() { if (iv) clearInterval(iv); const tt = now(); g.gain.cancelScheduledValues(tt); g.gain.setValueAtTime(g.gain.value || 1, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.25); for (const n of nodes) try { n.stop(tt + 0.3); } catch (e) {} } };
  },
  // the crack of a lightning bolt striking something
  zap(pos, k = 1) {
    if (!ctx) return; const o = out(pos, sfxBus, 0.5); const t = now();
    noise(t, 0.06, o.node, { type: 'highpass', f: 2500, gain: 0.9 * k, a: 0.001 }); noise(t, 0.18, o.node, { type: 'bandpass', f: 1200, q: 0.8, gain: 0.5 * k, a: 0.001 });
    tone(t, 0.12, o.node, { type: 'square', f: 140, f2: 60, gain: 0.08 * k });
  },
  charge(el = 'fire') { if (!ctx) return; const o = out(null, sfxBus, 0.2); const t = now(); const f = el === 'frost' ? 1500 : el === 'arcane' ? 700 : 200; tone(t, 1.0, o.node, { type: 'sine', f, f2: f * 3, gain: 0.08, a: 0.6 }); noise(t, 1.0, o.node, { type: 'bandpass', f: f * 2, f2: f * 6, q: 3, gain: 0.08, a: 0.6 }); },
  // a black-powder gunshot: a sharp crack, a deep boom and an echo rolling away. k: loudness (1 = musket)
  gunshot(pos, k = 1) {
    if (!ctx) return; const o = out(pos, sfxBus, 0.75); const t = now(), g = Math.min(2, k);
    noise(t, 0.05, o.node, { type: 'highpass', f: 2500, gain: 1.6 * g, a: 0.001 });
    noise(t, 0.12, o.node, { type: 'bandpass', f: 1400, q: 0.8, gain: 1.4 * g, a: 0.001 });
    noise(t, 0.55, o.node, { type: 'lowpass', f: 1600, f2: 140, q: 0.6, gain: 1.5 * g, a: 0.002 });
    tone(t, 0.32, o.node, { type: 'sine', f: 95, f2: 38, gain: 1.4 * g, a: 0.002 });
    tone(t, 0.18, o.node, { type: 'triangle', f: 180, f2: 60, gain: 0.5 * g, a: 0.002 });
    for (let i = 1; i <= 3; i++) noise(t + 0.18 * i + Math.random() * 0.05, 0.4, o.node, { type: 'lowpass', f: 900 - i * 180, gain: 0.35 * g / i, a: 0.02 });
  },
  explode(pos, big = 1, el = 'fire') {
    if (!ctx) return; const o = out(pos, sfxBus, 0.5); const t = now();
    const lp = el === 'frost' ? 4000 : el === 'arcane' ? 2500 : 1800;
    noise(t, 0.9 * big, o.node, { type: 'lowpass', f: lp, f2: 120, q: 0.7, gain: 0.9 * Math.min(1.4, big), a: 0.005 });
    tone(t, 0.8 * big, o.node, { type: 'sine', f: 120, f2: 30, gain: 0.8 * Math.min(1.4, big) });
    if (el === 'frost') [1800, 2600, 3700, 5100].forEach(f => tone(t + Math.random() * 0.1, 0.6, o.node, { type: 'sine', f, gain: 0.05 }));
    if (el === 'fire') { noise(t + 0.15, 1.2 * big, o.node, { type: 'bandpass', f: 600, f2: 300, q: 0.8, gain: 0.35 * Math.min(1.4, big), a: 0.1 }); for (let i = 0; i < 10 * Math.min(2, big); i++) noise(t + 0.2 + Math.random() * 1.2 * big, 0.02, o.node, { type: 'highpass', f: 2500 + Math.random() * 3000, gain: 0.3 }); }
    if (el === 'lightning') { noise(t, 0.08, o.node, { type: 'highpass', f: 3000, gain: 0.9, a: 0.001 }); noise(t + 0.2, 1.4, o.node, { type: 'lowpass', f: 200, f2: 50, gain: 0.5, a: 0.2 }); }
    if (big > 1.5) { noise(t + 0.1, 2.5, o.node, { type: 'lowpass', f: 400, f2: 60, gain: 0.6, a: 0.1 }); for (let i = 0; i < 10; i++) noise(t + 0.2 + Math.random(), 0.05, o.node, { type: 'bandpass', f: 2000 + Math.random() * 3000, q: 3, gain: 0.2 }); }
  },
  whistle(pos, dur = 1.2) { if (!ctx) return; const o = out(pos, sfxBus, 0.2); tone(now(), dur, o.node, { type: 'sine', f: 1400, f2: 300, gain: 0.08, a: 0.2 }); noise(now(), dur, o.node, { type: 'bandpass', f: 600, f2: 200, q: 2, gain: 0.25, a: 0.3 }); },
  rumble(pos, dur = 1) { if (!ctx) return; const o = out(pos, sfxBus, 0.4); noise(now(), dur, o.node, { type: 'lowpass', f: 200, f2: 60, gain: 0.7, a: 0.05 }); tone(now(), dur, o.node, { type: 'sine', f: 55, f2: 35, gain: 0.5 }); },
  roar(pos) {
    if (!ctx) return; const o = out(pos, sfxBus, 0.4); const t = now();
    [1, 1.5, 2.02].forEach((m, i) => { const x = tone(t, 1.3, o.node, { type: 'sawtooth', f: 110 * m, f2: 80 * m, gain: 0.12, a: 0.1 }); });
    noise(t, 1.3, o.node, { type: 'bandpass', f: 700, f2: 400, q: 1, gain: 0.4, a: 0.1 });
  },
  growl(type = 'wolf', pos, vol = 1) {
    if (!ctx) return; const o = out(pos, sfxBus, 0.15); const t = now();
    const p = { wolf: 160, bear: 85, boar: 220, spider: 900, crab: 1500, rabbit: 1800, deer: 600, hound: 120, human: 140, skeleton: 400, troll: 70, imp: 500, golem: 50, tyrant: 45 }[type] || 150;
    if (type === 'spider' || type === 'crab') { for (let i = 0; i < 6; i++) noise(t + i * 0.04, 0.03, o.node, { type: 'bandpass', f: p * 2, q: 4, gain: 0.2 * vol }); return; }
    if (type === 'skeleton') { for (let i = 0; i < 5; i++) noise(t + i * 0.06, 0.04, o.node, { type: 'bandpass', f: 1800, q: 6, gain: 0.25 * vol }); return; }
    const x = tone(t, 0.6, o.node, { type: 'sawtooth', f: p, f2: p * 0.8, gain: 0.12 * vol, a: 0.06 });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 28; const lg = ctx.createGain(); lg.gain.value = p * 0.08; lfo.connect(lg); lg.connect(x.o.frequency); lfo.start(t); lfo.stop(t + 0.7);
    noise(t, 0.6, o.node, { type: 'bandpass', f: p * 3, q: 2, gain: 0.15 * vol, a: 0.06 });
  },
  yelp(type = 'wolf', pos) {
    if (!ctx) return; const o = out(pos, sfxBus, 0.1); const t = now();
    const p = { wolf: 700, wolfpup: 1100, bear: 300, boar: 500, deer: 900, rabbit: 2000, hound: 500, human: 260, troll: 140, imp: 900, golem: 90, tyrant: 80 }[type] || 500;
    tone(t, 0.18, o.node, { type: 'sawtooth', f: p, f2: p * 0.6, gain: 0.1 });
    noise(t, 0.12, o.node, { type: 'bandpass', f: p * 2, q: 2, gain: 0.15 });
  },
  hurt() { if (!ctx) return; const o = out(null, sfxBus, 0.05); const t = now(); tone(t, 0.2, o.node, { type: 'sawtooth', f: 220, f2: 150, gain: 0.08 }); noise(t, 0.12, o.node, { type: 'lowpass', f: 900, gain: 0.35 }); tone(t, 0.15, o.node, { type: 'sine', f: 100, f2: 60, gain: 0.35 }); },
  // a great war horn: two long brassy blasts over war drums. enemy = a lower, darker horn
  warHorn(enemy = false) {
    if (!ctx) return; const o = out(null, sfxBus, 0.9); const t = now();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = enemy ? 900 : 1500; lp.Q.value = 2.5; lp.connect(o.node);
    const base = enemy ? 73.4 : 98; // D2 / G2
    const blast = (t0, dur, f0, bend) => {
      for (const [m, g] of [[1, 0.2], [2, 0.12], [3, 0.07], [4, 0.04], [1.005, 0.12]]) {
        const x = ctx.createOscillator(); x.type = 'sawtooth'; x.frequency.setValueAtTime(f0 * m * bend, t0); x.frequency.exponentialRampToValueAtTime(f0 * m, t0 + 0.25);
        const vib = ctx.createOscillator(); vib.frequency.value = 5.2; const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t0); vg.gain.linearRampToValueAtTime(f0 * m * 0.012, t0 + dur * 0.6); vib.connect(vg); vg.connect(x.frequency);
        const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(g, t0 + 0.18); gg.gain.setValueAtTime(g, t0 + dur - 0.4); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        x.connect(gg); gg.connect(lp); x.start(t0); x.stop(t0 + dur + 0.05); vib.start(t0); vib.stop(t0 + dur + 0.05);
      }
      noise(t0, dur, lp, { type: 'bandpass', f: f0 * 6, q: 1.2, gain: 0.08, a: 0.15 });
    };
    blast(t, 1.1, base, 0.84); blast(t + 1.25, 2.6, enemy ? base * 0.94 : base * 1.5, 0.9);
    // war drums underneath
    for (let i = 0; i < 8; i++) { const tt = t + 0.1 + i * 0.5 + (i % 2 ? 0.12 : 0); tone(tt, 0.5, o.node, { type: 'sine', f: enemy ? 52 : 62, f2: 34, gain: 0.5, a: 0.004 }); noise(tt, 0.12, o.node, { type: 'lowpass', f: 600, gain: 0.25 }); }
  },
  battleCry() {
    if (!ctx) return; const o = out(null, sfxBus, 0.5); const t = now();
    for (let v = 0; v < 4; v++) { const f = 140 + v * 30; const x = tone(t + v * 0.03, 1.2, o.node, { type: 'sawtooth', f, f2: f * 1.25, gain: 0.08, a: 0.05 }); }
    noise(t, 1.2, o.node, { type: 'bandpass', f: 900, f2: 1200, q: 1, gain: 0.3, a: 0.05 });
    tone(t + 0.1, 1.5, o.node, { type: 'sawtooth', f: 220, gain: 0.06, a: 0.2 }); tone(t + 0.1, 1.5, o.node, { type: 'sawtooth', f: 330, gain: 0.05, a: 0.2 });
  },
  heal() { if (!ctx) return; const o = out(null, sfxBus, 0.5); const t = now(); [784, 988, 1175, 1568].forEach((f, i) => tone(t + i * 0.07, 0.7, o.node, { type: 'sine', f, gain: 0.07, a: 0.02 })); },
  drink() { if (!ctx) return; const o = out(null, sfxBus, 0.05); const t = now(); for (let i = 0; i < 4; i++) tone(t + i * 0.15, 0.1, o.node, { type: 'sine', f: 300 + Math.random() * 200, f2: 180, gain: 0.15 }); S.heal(); },
  eat() { if (!ctx) return; const o = out(null, sfxBus, 0.02); const t = now(); for (let i = 0; i < 4; i++) noise(t + i * 0.18, 0.08, o.node, { type: 'bandpass', f: 1200, q: 1.5, gain: 0.25 }); },
  coins() { if (!ctx) return; const o = out(null, sfxBus, 0.2); const t = now(); for (let i = 0; i < 4; i++) tone(t + i * 0.05, 0.25, o.node, { type: 'sine', f: 2200 + Math.random() * 1500, gain: 0.06 }); },
  loot() { if (!ctx) return; const o = out(null, sfxBus, 0.2); const t = now(); tone(t, 0.12, o.node, { type: 'triangle', f: 660, gain: 0.12 }); tone(t + 0.08, 0.2, o.node, { type: 'triangle', f: 990, gain: 0.12 }); },
  craft(station) {
    if (!ctx) return; const o = out(null, sfxBus, 0.3); const t = now();
    if (station === 'forge') { for (let i = 0; i < 3; i++) { [1, 2.7, 5.1].forEach((m, k) => tone(t + i * 0.28, 0.4, o.node, { type: 'sine', f: 900 * m, gain: 0.1 / (k + 1) })); noise(t + i * 0.28, 0.05, o.node, { type: 'highpass', f: 3000, gain: 0.3 }); } noise(t + 0.9, 0.5, o.node, { type: 'highpass', f: 2000, f2: 5000, gain: 0.2 }); }
    else if (station === 'workbench') { for (let i = 0; i < 4; i++) noise(t + i * 0.18, 0.14, o.node, { type: 'bandpass', f: 1500, f2: 900, q: 2, gain: 0.3 }); }
    else if (station === 'campfire') { noise(t, 1.0, o.node, { type: 'bandpass', f: 3000, q: 0.5, gain: 0.15, a: 0.1 }); for (let i = 0; i < 8; i++) noise(t + Math.random(), 0.02, o.node, { type: 'highpass', f: 2000, gain: 0.25 }); }
    else if (station === 'alchemy') { for (let i = 0; i < 6; i++) tone(t + i * 0.1, 0.12, o.node, { type: 'sine', f: 400 + Math.random() * 600, f2: 900, gain: 0.08 }); }
    else { for (let i = 0; i < 3; i++) noise(t + i * 0.2, 0.15, o.node, { type: 'bandpass', f: 800, q: 1.5, gain: 0.25 }); }
    setTimeout(() => S.loot(), 950);
  },
  levelUp() {
    if (!ctx) return; const o = out(null, sfxBus, 0.6); const t = now();
    const notes = [392, 523, 659, 784, 1046];
    notes.forEach((f, i) => { tone(t + i * 0.1, 1.4 - i * 0.1, o.node, { type: 'triangle', f, gain: 0.14, a: 0.01 }); tone(t + i * 0.1, 1.4 - i * 0.1, o.node, { type: 'sawtooth', f: f / 2, gain: 0.03, a: 0.02 }); });
    [523, 659, 784].forEach(f => tone(t + 0.55, 1.8, o.node, { type: 'sawtooth', f, gain: 0.05, a: 0.05 }));
    noise(t + 0.5, 1.5, o.node, { type: 'highpass', f: 5000, gain: 0.08, a: 0.1 });
  },
  questAccept() { if (!ctx) return; const o = out(null, sfxBus, 0.4); const t = now(); [440, 554, 659].forEach((f, i) => tone(t + i * 0.09, 0.5, o.node, { type: 'triangle', f, gain: 0.12 })); },
  questDone() { if (!ctx) return; const o = out(null, sfxBus, 0.5); const t = now(); [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(t + i * 0.11, 0.8, o.node, { type: 'triangle', f, gain: 0.12 })); [261, 392].forEach(f => tone(t + 0.4, 1.4, o.node, { type: 'sawtooth', f, gain: 0.04, a: 0.1 })); },
  objective() { if (!ctx) return; const o = out(null, sfxBus, 0.2); const t = now(); tone(t, 0.25, o.node, { type: 'triangle', f: 880, gain: 0.1 }); tone(t + 0.1, 0.35, o.node, { type: 'triangle', f: 1320, gain: 0.1 }); },
  error() { if (!ctx) return; const o = out(null, sfxBus, 0); tone(now(), 0.15, o.node, { type: 'square', f: 180, gain: 0.05 }); },
  swap() { if (!ctx) return; const o = out(null, sfxBus, 0.1); noise(now(), 0.2, o.node, { type: 'bandpass', f: 2500, q: 3, gain: 0.15 }); S.hit('metal'); },
  zone() { if (!ctx) return; const o = out(null, sfxBus, 0.7); const t = now(); [196, 294, 392].forEach((f, i) => tone(t + i * 0.2, 2.4, o.node, { type: 'sawtooth', f, gain: 0.035, a: 0.3 })); },
  wake() { if (!ctx) return; const o = out(null, sfxBus, 0.4); const t = now(); tone(t, 3, o.node, { type: 'sine', f: 60, gain: 0.25, a: 1 }); noise(t, 3, o.node, { type: 'lowpass', f: 200, gain: 0.2, a: 1 }); },
  heartbeat() { if (!ctx) return; const o = out(null, sfxBus, 0); const t = now(); tone(t, 0.15, o.node, { type: 'sine', f: 55, f2: 40, gain: 0.5 }); tone(t + 0.22, 0.15, o.node, { type: 'sine', f: 50, f2: 38, gain: 0.35 }); },
  stealth() { if (!ctx) return; const o = out(null, sfxBus, 0.4); noise(now(), 1.0, o.node, { type: 'lowpass', f: 2000, f2: 300, gain: 0.35, a: 0.01 }); },
};

// ---------------- MUSIC ----------------
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
let track = null, schedTimer = null;
let combatLevel = 0, combatTarget = 0;
const trackGain = {};
const TRACKS = {};

function busFor(name) {
  if (!trackGain[name]) { const g = ctx.createGain(); g.gain.value = 0; g.connect(musicBus); const w = ctx.createGain(); w.gain.value = 0.5; g.connect(w); w.connect(reverbSend); trackGain[name] = g; }
  return trackGain[name];
}
// instruments
function pad(t, notes, dur, dest, vol = 0.05, bright = 900) {
  for (const n of notes) {
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = bright; f.Q.value = 0.5;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(vol * 0.8, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
      o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.7);
    }
  }
}
function pluck(t, n, dest, vol = 0.12, dec = 1.6) {
  const f = NOTE(n);
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.001;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
  const g2 = ctx.createGain(); g2.gain.value = 0.3;
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest); o.start(t); o2.start(t); o.stop(t + dec); o2.stop(t + dec);
}
function flute(t, n, dur, dest, vol = 0.07) {
  const f = NOTE(n);
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
  const v = ctx.createOscillator(); v.frequency.value = 5; const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.6); v.connect(vg); vg.connect(o.frequency);
  const o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = f * 2; const g3 = ctx.createGain(); g3.gain.value = 0.15; o3.connect(g3);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.08); g.gain.setValueAtTime(vol * 0.9, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.15);
  o.connect(g); g3.connect(g); g.connect(dest);
  const nb = noise(t, 0.12, dest, { type: 'bandpass', f: f * 2, q: 2, gain: vol * 0.4, a: 0.02 });
  o.start(t); v.start(t); o3.start(t); o.stop(t + dur + 0.2); v.stop(t + dur + 0.2); o3.stop(t + dur + 0.2);
}
function brass(t, n, dur, dest, vol = 0.06) {
  for (const det of [-5, 4]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(2200, t + 0.15); f.frequency.linearRampToValueAtTime(1200, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.08); g.gain.setValueAtTime(vol, t + dur * 0.85); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25);
    o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.3);
  }
}
function choir(t, notes, dur, dest, vol = 0.03) {
  for (const n of notes) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n);
    const v = ctx.createOscillator(); v.frequency.value = 4.5 + Math.random(); const vg = ctx.createGain(); vg.gain.value = NOTE(n) * 0.008; v.connect(vg); vg.connect(o.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.5); g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
    for (const [ff, q, gg] of [[700, 8, 1], [1150, 10, 0.6], [2800, 12, 0.25]]) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q; const bg = ctx.createGain(); bg.gain.value = gg; o.connect(bp); bp.connect(bg); bg.connect(g); }
    g.connect(dest); o.start(t); v.start(t); o.stop(t + dur + 0.7); v.stop(t + dur + 0.7);
  }
}
function drum(t, dest, kind = 'taiko', vol = 0.5) {
  if (kind === 'taiko') { tone(t, 0.5, dest, { type: 'sine', f: 90, f2: 45, gain: vol }); noise(t, 0.15, dest, { type: 'lowpass', f: 700, gain: vol * 0.5 }); }
  else if (kind === 'timp') { tone(t, 0.9, dest, { type: 'sine', f: 73, f2: 68, gain: vol * 0.8 }); noise(t, 0.3, dest, { type: 'lowpass', f: 400, gain: vol * 0.3 }); }
  else if (kind === 'frame') { noise(t, 0.08, dest, { type: 'bandpass', f: 1800, q: 1, gain: vol * 0.3 }); tone(t, 0.12, dest, { type: 'sine', f: 200, f2: 150, gain: vol * 0.2 }); }
  else if (kind === 'snare') { noise(t, 0.12, dest, { type: 'highpass', f: 1500, gain: vol * 0.35 }); }
}
function strings(t, n, dur, dest, vol = 0.04) {
  for (const det of [-9, 0, 9]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
}

// chord tables (MIDI)
const D = 62;
const prog = {
  explore: [[50, [62, 65, 69]], [48, [60, 64, 67]], [46, [58, 62, 65]], [45, [57, 60, 64]], [50, [62, 65, 69]], [43, [59, 62, 67]], [46, [58, 62, 65]], [48, [60, 64, 67]]],
  title: [[38, [62, 65, 69]], [46, [58, 62, 65]], [41, [60, 65, 69]], [48, [60, 64, 67]], [38, [62, 65, 69]], [43, [62, 67, 70]], [45, [61, 64, 69]], [45, [61, 64, 69]]],
  combat: [[38, [62, 65, 69]], [38, [62, 65, 69]], [46, [58, 62, 65]], [45, [57, 61, 64]]],
  ash: [[38, [62, 65, 68]], [37, [61, 65, 68]], [38, [62, 65, 68]], [34, [58, 61, 65]]],
  snow: [[45, [64, 69, 72]], [41, [65, 69, 72]], [43, [62, 67, 71]], [40, [64, 67, 71]]],
};
const scaleDor = [0, 2, 3, 5, 7, 9, 10];
let melody = [];
function genMelody(chord, len, base = 74) {
  const out = []; let cur = chord[1][0] + 12;
  for (let i = 0; i < len; i++) {
    if (Math.random() < 0.25) { out.push(null); continue; }
    const cand = chord[1].map(n => n + 12).concat(chord[1].map(n => n + 24));
    const step2 = scaleDor.map(s => D + 12 + s).concat(scaleDor.map(s => D + 24 + s));
    const pool = Math.random() < 0.65 ? cand : step2;
    pool.sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur));
    cur = pool[Math.floor(Math.random() * Math.min(3, pool.length))];
    out.push(cur);
  }
  return out;
}

TRACKS.title = { bpm: 76, step(t, s, dest) {
  const bar = Math.floor(s / 8), ch = prog.title[bar % 8], b8 = s % 8, sp = 60 / this.bpm / 2;
  if (b8 === 0) { choir(t, ch[1].map(n => n - 12).concat([ch[1][0]]), sp * 8, dest, 0.02); tone(t, sp * 8, dest, { type: 'sawtooth', f: NOTE(ch[0]), gain: 0.05, a: 0.2, d: sp * 8 }); }
  if (b8 === 0 || b8 === 3 || b8 === 6) drum(t, dest, 'taiko', b8 === 0 ? 0.55 : 0.35);
  if (bar % 2 === 1 && b8 === 4) drum(t, dest, 'timp', 0.4);
  strings(t, ch[1][b8 % 3] - 12, sp * 0.9, dest, 0.018);
  if (bar >= 2) {
    const mel = [[69, 4], [72, 2], [74, 2]], mel2 = [[77, 3], [76, 1], [74, 4]], mel3 = [[72, 4], [74, 2], [76, 2]], mel4 = [[74, 8]];
    const m = [mel, mel2, mel3, mel4, mel, mel2, [[77, 4], [81, 4]], [[81, 8]]][bar % 8];
    let pos = 0; for (const [n, l] of m) { if (pos === b8) brass(t, n - 12, sp * l * 0.95, dest, 0.03); pos += l; }
  }
} };
function fiddle(t, n, dur, dest, vol = 0.05) {
  const f = NOTE(n);
  for (const det of [-4, 5]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
    const v = ctx.createOscillator(); v.frequency.value = 6; const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.01, t + dur * 0.7); v.connect(vg); vg.connect(o.frequency);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(3200, f * 2.5); bp.Q.value = 0.9;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.setValueAtTime(vol * 0.85, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(bp); bp.connect(g); g.connect(dest); o.start(t); v.start(t); o.stop(t + dur + 0.1); v.stop(t + dur + 0.1);
  }
}
function cymbal(t, dest, vol = 0.12, dur = 1.6) { noise(t, dur, dest, { type: 'highpass', f: 5000, gain: vol, a: dur > 1 ? dur * 0.8 : 0.005, d: dur }); }

// Exploring: bright and moving (harp 16ths, bass pulse, hand drum groove, flute or fiddle melody)
TRACKS.explore = { bpm: 96, div: 4, step(t, s, dest, zone) {
  const P = zone === 'ashlands' ? prog.ash : zone === 'highlands' ? prog.snow : prog.explore;
  const spb = this.div * 4, bar = Math.floor(s / spb), ch = P[bar % P.length], b = s % spb, sp = 60 / this.bpm / this.div;
  if (b === 0) { pad(t, ch[1], sp * spb, dest, 0.018, zone === 'ashlands' ? 700 : 1400); if (bar % 4 === 0) melody = genMelody(ch, 64); if (bar % 8 === 0) cymbal(t, dest, 0.05, 2); }
  // bass pulse on 8ths
  if (b % 2 === 0) tone(t, sp * 1.6, dest, { type: 'triangle', f: NOTE(ch[0] + (b % 8 === 6 ? 7 : 0)), gain: 0.11, a: 0.01 });
  // harp 16ths
  const arp = [0, 1, 2, 1, 3, 2, 1, 2];
  const notes = [ch[1][0], ch[1][1], ch[1][2], ch[1][0] + 12];
  if (zone !== 'ashlands' || b % 2 === 0) pluck(t, notes[arp[b % 8]] + (b >= 8 ? 12 : 0) - (zone === 'ashlands' ? 12 : 0), dest, 0.045, 0.9);
  // groove
  if (b % 8 === 0) drum(t, dest, zone === 'ashlands' ? 'taiko' : 'timp', 0.32); if (b % 8 === 4) drum(t, dest, 'snare', 0.25);
  if (b % 2 === 1) drum(t, dest, 'frame', 0.18);
  // melody: plays most of the time
  if ((Math.floor(bar / 2) % 4) !== 3 && b % 2 === 0) { const n = melody[((bar % 4) * 8 + b / 2) % 64]; if (n) (zone === 'highlands' ? flute : fiddle)(t, n, sp * 1.8, dest, zone === 'highlands' ? 0.05 : 0.035); }
} };
// Village / camp: a lively jig in D (12 steps per bar)
const JIG = [[74, 2, 0, 1], [78, 1, 0, 1], [76, 2, 1, 1], [74, 1, 1, 1], [73, 2, 2, 1], [74, 1, 2, 1], [76, 2, 3, 1], [69, 1, 3, 1]];
const JIGA = [62, 66, 69, 74, 69, 66, 62, 66, 69, 71, 69, 66, 64, 67, 71, 76, 71, 67, 62, 66, 69, 74, 73, 71, 69, 73, 76, 81, 76, 73, 74, 69, 66, 62, 64, 66, 67, 71, 74, 71, 67, 64, 62, 66, 69, 66, 62, 57];
const JIGB = [74, 76, 78, 79, 78, 76, 74, 73, 71, 69, 71, 73, 74, 69, 66, 69, 74, 78, 81, 79, 78, 76, 74, 73, 71, 74, 79, 78, 76, 74, 73, 76, 81, 79, 76, 73, 74, 78, 81, 78, 74, 69, 74, 69, 66, 62, 66, 69];
const JIGCH = [[50, [62, 66, 69]], [55, [59, 62, 67]], [45, [61, 64, 69]], [50, [62, 66, 69]]];
TRACKS.town = { bpm: 116, div: 3, step(t, s, dest) {
  const spb = 12, bar = Math.floor(s / spb), b = s % spb, sp = 60 / this.bpm / this.div;
  const ch = JIGCH[bar % 4];
  const mel = (Math.floor(bar / 4) % 2 ? JIGB : JIGA);
  const n = mel[((bar % 4) * 12 + b) % mel.length];
  fiddle(t, n, sp * 0.95, dest, 0.034);
  if (b % 3 === 0) pluck(t, n - 12, dest, 0.03, 0.5);
  // lute strums
  if (b === 0 || b === 6) for (let i = 0; i < 3; i++) pluck(t + i * 0.012, ch[1][i] - 12, dest, 0.05, 0.9);
  if (b === 3 || b === 9) for (let i = 0; i < 3; i++) pluck(t + i * 0.01, ch[1][i], dest, 0.035, 0.5);
  // bodhran
  if (b === 0 || b === 6) drum(t, dest, 'taiko', 0.32); if (b % 3 === 2) drum(t, dest, 'frame', 0.25); if (b === 3 || b === 9) drum(t, dest, 'frame', 0.35);
  if (b === 0) tone(t, sp * 5.5, dest, { type: 'triangle', f: NOTE(ch[0]), gain: 0.12, a: 0.01 });
  if (b === 6) tone(t, sp * 5.5, dest, { type: 'triangle', f: NOTE(ch[0] + 7), gain: 0.1, a: 0.01 });
} };
// Battle: driving taiko, 16th string ostinato, brass and choir hits
TRACKS.combat = { bpm: 148, div: 4, step(t, s, dest) {
  const spb = 16, bar = Math.floor(s / spb), ch = prog.combat[bar % 4], b = s % spb, sp = 60 / this.bpm / this.div;
  const tk = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0];
  if (tk[b]) drum(t, dest, 'taiko', b === 0 ? 0.6 : 0.42);
  if (b === 4 || b === 12) drum(t, dest, 'snare', 0.7);
  if (bar % 4 === 3 && b >= 12) drum(t, dest, 'snare', 0.4 + (b - 12) * 0.1);
  drum(t, dest, 'frame', b % 2 ? 0.15 : 0.28);
  const ost = [0, 0, 12, 0, 7, 0, 12, 7];
  strings(t, ch[1][0] - 12 + ost[b % 8], sp * 0.9, dest, 0.032);
  if (b === 0) { tone(t, sp * 16, dest, { type: 'sawtooth', f: NOTE(ch[0]), gain: 0.07, a: 0.02, d: sp * 16 }); brass(t, ch[1][2] - 12, sp * 5, dest, 0.04); brass(t, ch[1][0] - 12, sp * 5, dest, 0.035); if (bar % 4 === 0) { cymbal(t, dest, 0.16, 1.2); choir(t, ch[1], sp * 16, dest, 0.016); } }
  if (b === 10) brass(t, ch[1][1] - 12, sp * 2, dest, 0.035);
  if (b === 14) brass(t, ch[1][2] - 12, sp * 2, dest, 0.04);
} };

// ---------------- RECORDED MUSIC (see music/CREDITS.md) ----------------
// In the world: one calm song at a time, then a few minutes of just ambience before the next.
// Battle music only for real fights (hostile mobs chasing you or an elite), and it fades away soon after.
const SONGS = {
  coast: ['music/calm_meadow.mp3'], meadow: ['music/calm_meadow.mp3'], wood: ['music/calm_forest.mp3', 'music/forest.mp3'],
  highlands: ['music/calm_snow.mp3', 'music/calm_cave.mp3'], ashlands: ['music/calm_ash.mp3'],
  town: ['music/town4.mp3', 'music/town2.mp3', 'music/town3.mp3', 'music/town1.mp3'],
};
const LOOPS = { title: 'music/title.mp3', combat: '../audio/rec/battle-music.mp3', boss: 'music/boss.mp3' };
let musicZone = 'meadow', wanted = null, townOn = false, bossOn = false, inCombat = false;
const loops = {};
function loopCh(name) { let c = loops[name]; if (!c) { const el = new Audio(LOOPS[name]); el.loop = true; el.preload = 'auto'; el.volume = 0; c = loops[name] = { el, lv: 0 }; } return c; }
const song = { el: null, lv: 0, ctx: null, fadeOut: false, silenceUntil: 0, last: {} };
function ctxNow() { return townOn ? 'town' : musicZone; }
function startSong(now) {
  const key = ctxNow(), list = SONGS[key] || SONGS.meadow;
  let pick = list[Math.floor(Math.random() * list.length)];
  if (list.length > 1 && pick === song.last[key]) pick = list[(list.indexOf(pick) + 1) % list.length];
  song.last[key] = pick;
  const el = new Audio(pick); el.volume = 0; el.preload = 'auto';
  el.addEventListener('ended', () => { if (song.el === el) { song.el = null; song.lv = 0; song.silenceUntil = performance.now() + (townOn ? 15000 + Math.random() * 20000 : 60000 + Math.random() * 90000); } });
  song.el = el; song.lv = 0; song.ctx = key; song.fadeOut = false;
  el.play().then(() => { M.blocked = false; }).catch(() => { M.blocked = true; song.el = null; song.silenceUntil = now + 1500; });
}
function routeEl(el) { if (!ctx || el._routed) return; try { const s = ctx.createMediaElementSource(el); s.connect(musicBus); el._routed = true; } catch (e) { el._routed = 'no'; } }
const musicVol = (el) => (el && el._routed === true ? 1 : settings.master * settings.music);
export const M = {
  play(name) { wanted = name; track = name; if (name === 'explore') { song.silenceUntil = performance.now() + 4000; } },
  setCombat(on) { inCombat = on; },
  setBoss(on) { bossOn = on; },
  setZone(z) { musicZone = z; },
  setTown(on) { townOn = on; },
  blocked: false,
};
let lastTick = performance.now();
setInterval(() => {
  const now = performance.now(), dt = Math.min(0.5, (now - lastTick) / 1000); lastTick = now;
  const vol = 1;
  const fight = wanted === 'explore' && inCombat;
  // looping channels: title, battle, boss
  const wantLoop = wanted === 'title' ? 'title' : fight ? (bossOn ? 'boss' : 'combat') : null;
  for (const name in LOOPS) {
    const target = name === wantLoop ? 1 : 0;
    if (!loops[name] && !target) continue;
    const c = loopCh(name);
    const rate = target ? 0.6 : 0.3;
    c.lv += Math.sign(target - c.lv) * Math.min(Math.abs(target - c.lv), dt * rate);
    routeEl(c.el); c.el.volume = Math.max(0, Math.min(1, c.lv * c.lv * musicVol(c.el) * (name === 'title' ? 0.8 : name === 'combat' ? 0.32 : 0.5) / (c.el._routed === true ? 0.6 : 1)));
    if (c.lv > 0.001 && c.el.paused && !c.pending) { c.pending = true; c.el.play().then(() => { c.pending = false; M.blocked = false; }).catch(() => { c.pending = false; M.blocked = true; }); }
    if (c.lv <= 0.001 && !c.el.paused) { c.el.pause(); if (name !== 'title') c.el.currentTime = 0; }
  }
  // calm world songs with silence between them
  if (wanted !== 'explore') { if (song.el) { song.el.pause(); song.el = null; } return; }
  if (song.el) {
    // entering or leaving town changes the song; moving between zones lets it finish
    if ((song.ctx === 'town') !== townOn) song.fadeOut = true;
    const target = song.fadeOut || fight ? 0 : 1;
    song.lv += Math.sign(target - song.lv) * Math.min(Math.abs(target - song.lv), dt * (target ? 0.25 : 0.4));
    routeEl(song.el); song.el.volume = Math.max(0, Math.min(1, song.lv * song.lv * musicVol(song.el) * 0.42 / (song.el._routed === true ? 0.6 : 1)));
    if (fight && song.lv <= 0.001 && !song.el.paused) song.el.pause();
    if (!fight && !song.fadeOut && song.el.paused && song.el.currentTime > 0) song.el.play().catch(() => {});
    if (song.fadeOut && song.lv <= 0.001) { song.el.pause(); song.el = null; song.silenceUntil = now + (townOn ? 1500 : 20000); }
  } else if (!fight && now > song.silenceUntil) startSong(now);
}, 50);
function combatTick() {}

// ---------------- AMBIENCE ----------------
const amb = {};
let ambState = { sea: 0, wind: 0.2, forest: 0, waterfall: 0, fire: 0, lava: 0, night: 0 };
function loopNoise(type, f, q) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(ambBus); s.start();
  return { s, fl, g };
}
function startAmbience() {
  amb.sea = loopNoise('lowpass', 500, 0.5);
  amb.sea2 = loopNoise('bandpass', 1800, 0.4);
  amb.wind = loopNoise('bandpass', 400, 0.6);
  amb.fall = loopNoise('lowpass', 1400, 0.3);
  amb.fire = loopNoise('bandpass', 2500, 0.6);
  amb.lava = loopNoise('lowpass', 150, 1);
  setInterval(ambTick, 100);
}
let ambT = 0;
function ambTick() {
  if (!ctx) return;
  ambT += 0.1;
  const st = ambState, ON = track === 'explore' ? 1 : 0;
  const wave = 0.55 + 0.45 * Math.sin(ambT * 0.7) * Math.sin(ambT * 0.31 + 1);
  set(amb.sea.g, st.sea * 0.5 * wave * ON); set(amb.sea2.g, st.sea * 0.12 * Math.max(0, wave - 0.4) * ON);
  amb.wind.fl.frequency.value = 300 + 200 * Math.sin(ambT * 0.13);
  set(amb.wind.g, st.wind * (0.12 + 0.08 * Math.sin(ambT * 0.21)) * ON);
  set(amb.fall.g, st.waterfall * 0.55 * ON);
  set(amb.fire.g, st.fire * 0.05 * ON);
  set(amb.lava.g, st.lava * 0.35 * ON);
  if (st.fire > 0.1 && Math.random() < st.fire * 0.5) { const o = out(null, ambBus, 0); noise(now(), 0.02, o.node, { type: 'highpass', f: 2500, gain: 0.15 * st.fire }); }
  // birds and crickets
  if (ON && st.forest > 0 && st.night < 0.5 && Math.random() < 0.06 * st.forest) bird();
  if (ON && st.sea > 0.3 && st.night < 0.5 && Math.random() < 0.015) gull();
  if (ON && st.night > 0.5 && st.forest > 0.2 && Math.random() < 0.4) cricket();
}
function set(g, v) { g.gain.value += (v - g.gain.value) * 0.2; }
function bird() {
  const o = out({ x: listener.x + rnd(-30, 30), y: listener.y + 8, z: listener.z + rnd(-30, 30) }, ambBus, 0.3), t = now();
  const base = rnd(2200, 4200), n = 2 + Math.floor(Math.random() * 5), kind = Math.random();
  for (let i = 0; i < n; i++) {
    const tt = t + i * rnd(0.08, 0.16);
    if (kind < 0.5) tone(tt, 0.08, o.node, { type: 'sine', f: base, f2: base * rnd(1.2, 1.6), gain: 0.05 });
    else tone(tt, 0.12, o.node, { type: 'sine', f: base * 1.3, f2: base * 0.8, gain: 0.04 });
  }
}
function gull() { const o = out({ x: listener.x + rnd(-40, 40), y: 20, z: listener.z + rnd(-10, 40) }, ambBus, 0.4), t = now(); for (let i = 0; i < 3; i++) tone(t + i * 0.3, 0.25, o.node, { type: 'sawtooth', f: 1400, f2: 900, gain: 0.02 }); }
function cricket() { const o = out({ x: listener.x + rnd(-15, 15), y: 0, z: listener.z + rnd(-15, 15) }, ambBus, 0.1), t = now(); for (let i = 0; i < 3; i++) tone(t + i * 0.05, 0.03, o.node, { type: 'sine', f: 4600, gain: 0.015 }); }
export function setAmbience(st) { Object.assign(ambState, st); }

// Sound: CC0 recorded swings and clashes from ../audio/rec, everything else synthesized.
let ctx = null, master = null;
const buffers = {};
export let volume = 0.6;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
  const load = async (name, url) => {
    try { const r = await fetch(url); buffers[name] = await ctx.decodeAudioData(await r.arrayBuffer()); } catch (e) { /* synth fallback */ }
  };
  for (let i = 1; i <= 10; i++) { load('swing' + i, `../audio/rec/swing${i}.mp3`); load('clash' + i, `../audio/rec/clash${i}.mp3`); }
}
export function setVolume(v) { volume = v; if (master) master.gain.value = v; }

function playBuf(name, vol = 1, rate = 1) {
  const b = buffers[name]; if (!b) return false;
  const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(g); g.connect(master); s.start();
  return true;
}
function noise(dur, vol, f0, f1, type = 'bandpass', q = 1) {
  const n = Math.floor(ctx.sampleRate * dur);
  const b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(); s.buffer = b;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, ctx.currentTime); f.frequency.exponentialRampToValueAtTime(f1, ctx.currentTime + dur);
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
function tone(freq, dur, vol, type = 'sine', slide = 1, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
const r10 = () => 1 + Math.floor(Math.random() * 10);

export function sfx(name, vol = 1) {
  if (!ctx) return;
  switch (name) {
    case 'swing': if (!playBuf('swing' + r10(), 0.35 * vol, 0.9 + Math.random() * 0.2)) noise(0.18, 0.25 * vol, 2500, 600); break;
    case 'heavy': if (!playBuf('swing' + r10(), 0.5 * vol, 0.7)) noise(0.3, 0.3 * vol, 1500, 300); break;
    case 'hit': noise(0.12, 0.5 * vol, 900, 200, 'lowpass'); tone(110, 0.12, 0.25 * vol, 'triangle', 0.5); break;
    case 'crit': noise(0.15, 0.6 * vol, 1400, 200, 'lowpass'); tone(180, 0.18, 0.3 * vol, 'square', 0.4); break;
    case 'block': if (!playBuf('clash' + r10(), 0.4 * vol)) tone(900, 0.3, 0.2 * vol, 'triangle', 0.8); break;
    case 'dodge': noise(0.25, 0.25 * vol, 800, 300); break;
    case 'bow': tone(220, 0.15, 0.25 * vol, 'triangle', 0.6); noise(0.12, 0.15 * vol, 3000, 1000); break;
    case 'hurt': tone(160, 0.2, 0.3 * vol, 'sawtooth', 0.5); noise(0.1, 0.3 * vol, 600, 200, 'lowpass'); break;
    case 'chop': noise(0.1, 0.5 * vol, 700, 300); tone(140, 0.08, 0.3 * vol, 'triangle', 0.7); break;
    case 'mine': tone(1800, 0.12, 0.2 * vol, 'triangle', 0.9); noise(0.08, 0.3 * vol, 4000, 2000); break;
    case 'harvest': noise(0.2, 0.25 * vol, 3000, 1500, 'highpass'); break;
    case 'pickup': tone(660, 0.08, 0.15 * vol, 'sine', 1.5); tone(990, 0.1, 0.12 * vol, 'sine', 1.2, 0.07); break;
    case 'loot': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 0.12 * vol, 'triangle', 1, i * 0.07)); break;
    case 'level': [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 0.15 * vol, 'triangle', 1, i * 0.09)); break;
    case 'mastery': [440, 660, 880].forEach((f, i) => tone(f, 0.35, 0.12 * vol, 'sine', 1, i * 0.08)); break;
    case 'quest': [523, 784, 1046].forEach((f, i) => tone(f, 0.45, 0.14 * vol, 'triangle', 1, i * 0.12)); break;
    case 'craft': tone(1200, 0.2, 0.15 * vol, 'triangle', 0.95); tone(800, 0.25, 0.12 * vol, 'triangle', 0.9, 0.12); break;
    case 'ui': tone(700, 0.05, 0.08 * vol, 'sine', 1.1); break;
    case 'boom': noise(0.6, 0.7 * vol, 600, 60, 'lowpass'); tone(70, 0.5, 0.4 * vol, 'sine', 0.4); break;
    case 'magic': tone(520, 0.4, 0.15 * vol, 'sine', 2); noise(0.3, 0.12 * vol, 2000, 5000); break;
    case 'roar': tone(90, 0.9, 0.35 * vol, 'sawtooth', 0.6); noise(0.9, 0.3 * vol, 400, 120, 'lowpass'); break;
    case 'death': tone(220, 0.8, 0.25 * vol, 'sawtooth', 0.3); break;
    case 'potion': tone(400, 0.3, 0.15 * vol, 'sine', 2.5); break;
    case 'coins': [1200, 1500, 1350].forEach((f, i) => tone(f, 0.08, 0.1 * vol, 'triangle', 1, i * 0.05)); break;
  }
}

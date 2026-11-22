// All sounds are made on the spot with the Web Audio API.
// [f0, f1, dur, wave, vol, delay] is a tone; ['n', filterHz, dur, vol, delay] is a burst of noise.
const S = {
  rifle: [['n', 2600, 0.07, 0.22], [220, 90, 0.06, 'square', 0.08]],
  smg: [['n', 3400, 0.05, 0.16], [700, 300, 0.04, 'square', 0.05]],
  rocket: [['n', 900, 0.35, 0.3], [160, 60, 0.3, 'sawtooth', 0.12]],
  boom: [['n', 500, 0.7, 0.55], [80, 30, 0.6, 'sine', 0.5]],
  mini: [['n', 3000, 0.04, 0.09]],
  zap: [[1800, 300, 0.18, 'sawtooth', 0.12], ['n', 6000, 0.12, 0.1]],
  missile: [['n', 1200, 0.3, 0.18], [300, 700, 0.25, 'sawtooth', 0.06]],
  reload: [[500, 500, 0.04, 'square', 0.08], [300, 300, 0.05, 'square', 0.08, 0.18], [900, 900, 0.04, 'square', 0.08, 0.5]],
  empty: [[1200, 1200, 0.03, 'square', 0.06]],
  hit: [[1400, 1400, 0.03, 'square', 0.05]],
  kill: [[700, 1200, 0.08, 'triangle', 0.1]],
  hurt: [[200, 90, 0.18, 'sawtooth', 0.2]],
  place: [[300, 600, 0.1, 'square', 0.12], [600, 900, 0.12, 'square', 0.1, 0.1]],
  nope: [[160, 120, 0.2, 'square', 0.12]],
  buy: [[660, 880, 0.1, 'triangle', 0.2], [880, 1320, 0.2, 'triangle', 0.2, 0.1]],
  screech: [[1700, 900, 0.3, 'sawtooth', 0.07]],
  roar: [['n', 300, 1.2, 0.5], [70, 40, 1.2, 'sawtooth', 0.25]],
  spit: [['n', 1800, 0.15, 0.12], [400, 200, 0.1, 'triangle', 0.08]],
  alarm: [[880, 660, 0.25, 'square', 0.12], [880, 660, 0.25, 'square', 0.12, 0.3], [880, 660, 0.25, 'square', 0.12, 0.6]],
  wave: [[392, 392, 0.15, 'square', 0.12], [523, 523, 0.15, 'square', 0.12, 0.15], [784, 784, 0.4, 'square', 0.12, 0.3]],
  win: [[523, 523, 0.15, 'square', 0.14], [659, 659, 0.15, 'square', 0.14, 0.15], [784, 784, 0.15, 'square', 0.14, 0.3], [1047, 1047, 0.6, 'square', 0.14, 0.45]],
  lose: [[400, 300, 0.4, 'sawtooth', 0.15], [300, 200, 0.4, 'sawtooth', 0.15, 0.4], [200, 90, 0.9, 'sawtooth', 0.15, 0.8]],
  pickup: [[880, 1760, 0.12, 'triangle', 0.15]],
  heal: [[500, 800, 0.15, 'sine', 0.06]],
  tick: [[880, 880, 0.12, 'square', 0.12]],
  thunder: [['n', 220, 2.2, 0.6], [55, 35, 1.8, 'sine', 0.3]],
  grenade: [[400, 300, 0.1, 'triangle', 0.08]],
};
export class Audio {
  constructor() { this.ctx = null; this.vol = 0.5; this.noise = {}; this.last = {}; }
  unlock() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.chain(); } catch (e) { } }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  // everything goes through a compressor (so a wall of gunfire stays loud without crackling) and a battlefield echo
  chain() {
    const c = this.ctx; this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.knee.value = 8; this.comp.ratio.value = 6; this.comp.attack.value = 0.002; this.comp.release.value = 0.2; this.comp.connect(c.destination);
    this.out = c.createGain(); this.out.gain.value = 1; this.out.connect(this.comp);
    // a made-up impulse response: a long, dark, decaying rumble, like shots echoing off cliffs
    const len = c.sampleRate * 2.6, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len; lp += (Math.random() * 2 - 1 - lp) * (0.35 - t * 0.25); d[i] = lp * Math.pow(1 - t, 2.4) * (i < 400 ? i / 400 : 1); } }
    this.verb = c.createConvolver(); this.verb.buffer = ir; this.verbIn = c.createGain(); this.verbIn.gain.value = 0.9; this.verbIn.connect(this.verb); this.verb.connect(this.out);
  }
  noiseN(f0, f1, type, dur, v, t0, dest, q = 0.7) { const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.buf(Math.max(0.05, dur)); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t0); if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(f1, t0 + dur); s.connect(fl); fl.connect(g); g.connect(dest); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur); s.start(t0); s.stop(t0 + dur + 0.02); return g; }
  tone(f0, f1, type, dur, v, t0, dest) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur); o.connect(g); g.connect(dest); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur); o.start(t0); o.stop(t0 + dur + 0.02); }
  // A gunshot in layers: crack, body, thump and echo. power grows with weapon upgrades; far (0..1) muffles it and adds echo.
  gun(kind, vol = 1, power = 1, far = 0) {
    const c = this.ctx; if (!c || c.state !== 'running' || vol < 0.03) return; const t = c.currentTime + Math.random() * 0.004;
    const k = 'g' + kind; if (this.last[k] && t - this.last[k] < 0.022) return; this.last[k] = t;
    const bus = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000 - far * 16500; bus.connect(lp); lp.connect(this.out); const send = c.createGain(); send.gain.value = 0.25 + far * 0.9; lp.connect(send); send.connect(this.verbIn);
    const v = vol * this.vol * (0.7 + 0.3 * power) * (1 - far * 0.55);
    if (kind === 'rifle' || kind === 'mini') {
      this.noiseN(6000, 2500, 'highpass', 0.025, 0.9 * v, t, bus);                     // crack
      this.noiseN(1400, 500, 'bandpass', 0.13, 0.85 * v, t, bus, 0.9);                 // body
      this.tone(170 * (kind === 'mini' ? 1.1 : 1), 38, 'sine', 0.16 + 0.05 * power, 1.1 * v * power, t, bus);   // thump
      if (power > 1.3) this.tone(90, 28, 'triangle', 0.22, 0.6 * v * (power - 1), t, bus);
    } else if (kind === 'smg') {
      this.noiseN(7000, 3000, 'highpass', 0.02, 0.75 * v, t, bus);
      this.noiseN(2000, 800, 'bandpass', 0.08, 0.6 * v, t, bus, 1.1);
      this.tone(240, 60, 'sine', 0.09 + 0.03 * power, 0.75 * v * power, t, bus);
      this.tone(2400, 1200, 'square', 0.02, 0.05 * v, t, bus);                         // arc buzz
    } else if (kind === 'rocket') {
      this.noiseN(3000, 600, 'lowpass', 0.5, 0.8 * v, t, bus);
      this.tone(120, 40, 'sine', 0.3, 1.2 * v * power, t, bus);
      this.noiseN(800, 2400, 'bandpass', 0.9, 0.35 * v, t + 0.05, bus, 2);              // whoosh
    } else if (kind === 'boom') {
      this.tone(95, 22, 'sine', 1.1, 1.6 * v, t, bus);                                 // sub-bass blast
      this.noiseN(900, 120, 'lowpass', 1.3, 1.2 * v, t, bus);                          // the roar
      this.noiseN(5000, 3000, 'highpass', 0.04, 0.8 * v, t, bus);                      // the snap
      for (let i = 0; i < 5; i++) this.noiseN(3000, 1500, 'bandpass', 0.05, 0.25 * v, t + 0.12 + Math.random() * 0.5, bus, 2);   // debris crackle
    } else if (kind === 'artillery') {
      this.tone(60, 20, 'sine', 1.6, 0.9 * v, t, bus); this.noiseN(300, 80, 'lowpass', 2.2, 0.8 * v, t, bus);
    }
  }
  buf(dur) { const c = this.ctx, k = Math.round(dur * 100); if (this.noise[k]) return this.noise[k]; const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1; return this.noise[k] = b; }
  // vol can be lowered for far-away sounds; a sound is not played twice within 30 ms
  sfx(name, vol = 1) {
    const c = this.ctx, d = S[name]; if (!c || !d || c.state !== 'running' || vol < 0.03) return; const t0 = c.currentTime;
    if (this.last[name] && t0 - this.last[name] < 0.03) return; this.last[name] = t0;
    for (const p of d) {
      const g = c.createGain(); g.connect(this.out || c.destination);
      if (p[0] === 'n') { const [, f, dur, v, dl = 0] = p, s = c.createBufferSource(); s.buffer = this.buf(dur); const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f; s.connect(fl); fl.connect(g); g.gain.setValueAtTime(v * vol * this.vol, t0 + dl); g.gain.exponentialRampToValueAtTime(0.001, t0 + dl + dur); s.start(t0 + dl); }
      else { const [f0, f1, dur, type, v, dl = 0] = p, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0 + dl); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dl + dur); o.connect(g); g.gain.setValueAtTime(v * vol * this.vol, t0 + dl); g.gain.exponentialRampToValueAtTime(0.001, t0 + dl + dur); o.start(t0 + dl); o.stop(t0 + dl + dur + 0.02); }
    }
  }
}

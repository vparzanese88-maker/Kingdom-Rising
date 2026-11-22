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
  rotor: [['n', 260, 0.1, 0.22], [55, 45, 0.1, 'sine', 0.2]],
  engine: [[70, 62, 0.1, 'sawtooth', 0.05], ['n', 400, 0.08, 0.1]],
  step_sand: [['n', 900, 0.09, 0.13], ['n', 2400, 0.05, 0.05]],
  step_rock: [['n', 1600, 0.05, 0.14], [140, 90, 0.04, 'sine', 0.06]],
  step_snow: [['n', 2600, 0.15, 0.14], ['n', 5200, 0.09, 0.06, 0.02]],
  step_grass: [['n', 3600, 0.11, 0.08], ['n', 700, 0.07, 0.07]],
  step_gravel: [['n', 1900, 0.08, 0.15], ['n', 4200, 0.05, 0.08, 0.02]],
  step_metal: [[180, 120, 0.12, 'triangle', 0.1], ['n', 3200, 0.04, 0.1], [540, 520, 0.08, 'sine', 0.04]],
  step_concrete: [['n', 1200, 0.05, 0.16], [120, 80, 0.05, 'sine', 0.1]],
  magout: [['n', 2500, 0.05, 0.3], [900, 600, 0.04, 'square', 0.1], ['n', 600, 0.08, 0.18, 0.05]],
  magin: [['n', 1800, 0.05, 0.35], [300, 200, 0.06, 'square', 0.16], [1600, 1600, 0.02, 'square', 0.14, 0.07]],
  bolt: [['n', 3000, 0.04, 0.3], [1200, 800, 0.03, 'square', 0.1], ['n', 3000, 0.05, 0.35, 0.12], [700, 500, 0.04, 'square', 0.12, 0.12]],
  pump: [['n', 1500, 0.08, 0.4], [220, 150, 0.06, 'square', 0.16], ['n', 2200, 0.07, 0.4, 0.14], [500, 300, 0.05, 'square', 0.16, 0.14]],
  shell: [['n', 2600, 0.04, 0.28], [900, 700, 0.03, 'triangle', 0.12]],
  rocketload: [['n', 600, 0.3, 0.3], [200, 120, 0.25, 'sawtooth', 0.06], [1000, 1000, 0.03, 'square', 0.14, 0.3]],
  beltin: [['n', 1200, 0.15, 0.35], [400, 300, 0.1, 'square', 0.1, 0.05], ['n', 3000, 0.12, 0.22, 0.15]],
  upg: [[300, 1400, 0.55, 'sawtooth', 0.07], ['n', 5000, 0.35, 0.18, 0.1], [180, 160, 0.18, 'square', 0.16, 0.55], ['n', 1500, 0.12, 0.3, 0.55], [1400, 2100, 0.35, 'triangle', 0.09, 0.6]],
  tink: [[4200, 3800, 0.06, 'triangle', 0.04], [5200, 5000, 0.04, 'triangle', 0.03, 0.05]],
  headshot: [[2200, 2200, 0.05, 'square', 0.09], [3300, 3300, 0.08, 'square', 0.07, 0.04]],
  torch: [['n', 3500, 0.15, 0.06]],
  spin: [[200, 900, 0.45, 'sawtooth', 0.05]],
  flame: [['n', 1200, 0.25, 0.12]],
  rail: [[3000, 200, 0.35, 'sawtooth', 0.1], ['n', 5000, 0.2, 0.15]],
};
export class Audio {
  constructor() { this.ctx = null; this.vol = 0.5; try { const v = +localStorage.getItem('hb-sfx'); if (localStorage.getItem('hb-sfx') !== null && v >= 0) this.vol = v; } catch (e) { } this.noise = {}; this.last = {}; }
  unlock() {
    if (!this.ctx) { try { const AC = window.AudioContext || window.webkitAudioContext; try { this.ctx = new AC({ latencyHint: 'playback' }); } catch (e) { this.ctx = new AC(); } /* a bigger buffer: the browser can't run dry when a frame is slow */ this.chain(); let i = 0; const kinds = ['rifle', 'pistol', 'shotgun', 'sniper', 'smg', 'mini', 'rocket', 'boom', 'artillery'], warm = () => { if (i < kinds.length) { this.shots(kinds[i++]); setTimeout(warm, 30); } }; setTimeout(warm, 50); } catch (e) { } }
    if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => { });
    // iPhone and iPad: playing a silent HTML audio element moves the page into the "media" sound category, so the game is heard even with the silent switch on
    if (!this.el && /iPad|iPhone|iPod/.test(navigator.userAgent + (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform) ? 'iPad' : ''))) { try { const n = 8000, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, s) => [...s].forEach((ch, i) => b[o + i] = ch.charCodeAt(0)); w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
      const url = URL.createObjectURL(new Blob([b], { type: 'audio/wav' })); this.el = new window.Audio(url); this.el.loop = true; this.el.volume = 0.01; this.el.setAttribute('playsinline', ''); } catch (e) { this.el = 1; } }
    if (this.el && this.el.play && this.el.paused) this.el.play().catch(() => { });
  }
  // a continuous roar for the drop pod: deep engine rumble plus wind howl; level 0..1 sets how violent it is (0 fades it out)
  rumble(level) {
    const c = this.ctx; if (!c || !this.out) return;
    if (!this.rmb) { const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let lp = 0; for (let i = 0; i < n; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.08; d[i] = lp * 3; }
      const src = c.createBufferSource(); src.buffer = b; src.loop = true; const lo = c.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 120; const g = c.createGain(); g.gain.value = 0;
      const src2 = c.createBufferSource(); src2.buffer = this.buf(2); src2.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.8; const g2 = c.createGain(); g2.gain.value = 0;
      src.connect(lo); lo.connect(g); g.connect(this.out); src2.connect(bp); bp.connect(g2); g2.connect(this.out); src.start(); src2.start(); this.rmb = { g, g2, lo, bp, src, src2 }; }
    const R = this.rmb, t = c.currentTime, v = Math.max(0, Math.min(1, level || 0)) * this.vol * 0.9;
    R.g.gain.setTargetAtTime(v * 0.9, t, 0.15); R.g2.gain.setTargetAtTime(v * v * 0.45, t, 0.2); R.lo.frequency.setTargetAtTime(80 + level * 180, t, 0.2); R.bp.frequency.setTargetAtTime(300 + level * 1400 + Math.random() * 200, t, 0.1);
    if (level <= 0 && R) { setTimeout(() => { if (this.rmb === R && R.g.gain.value < 0.01) { try { R.src.stop(); R.src2.stop(); } catch (e) { } this.rmb = null; } }, 2500); }
  }
  // is sound actually able to play right now?
  ok() { return !!this.ctx && this.ctx.state === 'running'; }
  // everything goes through a compressor (so a wall of gunfire stays loud without crackling) and a battlefield echo
  chain() {
    const c = this.ctx;
    // one master bus for effects and music, ending in a hard limiter, so nothing can ever hit the speakers above full scale
    this.lim = c.createDynamicsCompressor(); this.lim.threshold.value = -4; this.lim.knee.value = 0; this.lim.ratio.value = 20; this.lim.attack.value = 0.002; this.lim.release.value = 0.15;
    this.bus = c.createGain(); this.bus.gain.value = 0.85; this.bus.connect(this.lim); this.lim.connect(c.destination);
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -20; this.comp.knee.value = 12; this.comp.ratio.value = 3.5; this.comp.attack.value = 0.006; this.comp.release.value = 0.3; this.comp.connect(this.bus);
    this.mon = c.createAnalyser(); this.mon.fftSize = 256; this.lim.connect(this.mon); this.monBuf = new Float32Array(256);
    if (!this.out) { this.out = c.createGain(); this.out.gain.value = 0.8; } this.out.connect(this.comp);
    // a made-up impulse response: a long, dark, decaying rumble, like shots echoing off cliffs
    const len = c.sampleRate * 1.6, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len; lp += (Math.random() * 2 - 1 - lp) * (0.35 - t * 0.25); d[i] = lp * Math.pow(1 - t, 2.4) * (i < 400 ? i / 400 : 1); } }
    this.verb = c.createConvolver(); this.verb.buffer = ir; if (!this.verbIn) { this.verbIn = c.createGain(); this.verbIn.gain.value = 0.4; } this.verbIn.connect(this.verb); this.verb.connect(this.out);
  }
  // Called every second by the game: keeps the sound alive. Browsers can suspend audio (focus changes, Bluetooth, power saving),
  // a stuck overlap counter could mute gunfire, and one bad value can jam the compressor into silence; each of these is repaired here.
  watchdog() {
    const c = this.ctx; if (!c) return; if (c.state !== 'running' && c.state !== 'closed') c.resume().catch(() => { });
    if ((this.live || 0) > 0 && performance.now() - (this.liveT || 0) > 3000) this.live = 0;
    if (this.mon && c.state === 'running') { this.mon.getFloatTimeDomainData(this.monBuf); let bad = false, peak = 0; for (let i = 0; i < this.monBuf.length; i++) { const v = this.monBuf[i]; if (!isFinite(v)) { bad = true; break; } peak = Math.max(peak, Math.abs(v)); }
      // dead air while music should be playing means the browser's audio got stuck: count it, and after a few seconds restart
      if (bad) this.restart(); }
  }
  // throw the whole sound engine away and build a new one (the next click or key turns it on); used when audio gets stuck
  restart() {
    const old = this.ctx; this.ctx = null; this.out = null; this.verbIn = null; this.noise = {}; this.sb = null; this.fb = null; this.rmb = null; this.last = {}; this.live = 0; this.sfxN = 0; try { old && old.close(); } catch (e) { }
    if (this.onRestart) this.onRestart(); this.unlock();
  }
  noiseN(f0, f1, type, dur, v, t0, dest, q = 0.7) { const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.buf(Math.max(0.05, dur)); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t0); if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(f1, t0 + dur); s.connect(fl); fl.connect(g); g.connect(dest); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur); s.start(t0); s.stop(t0 + dur + 0.02); return g; }
  tone(f0, f1, type, dur, v, t0, dest) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur); o.connect(g); g.connect(dest); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur); o.start(t0); o.stop(t0 + dur + 0.02); }
  // Real-sounding gunfire is rendered sample by sample once, a few variations per weapon:
  // an instant crack, a distorted noise blast, a deep low thump (no pitch sweep), a cliff slapback and a dark tail.
  shot(P, seed) {
    const c = this.ctx, sr = c.sampleRate, n = Math.floor(sr * P.dur), b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
    let r = seed * 9301 + 49297; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 116640 - 1; };
    const k = fc => 1 - Math.exp(-2 * Math.PI * fc / sr); let lb = 0, lb2 = 0, lo = 0, lo2 = 0, lt = 0, lr = 0; const slap = Math.floor(sr * P.slap), drive = P.drive, nd = Math.tanh(drive);
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr, w = rnd();
      const fcB = P.bc1 + (P.bc0 - P.bc1) * Math.exp(-t / P.bd); lb += (w - lb) * k(fcB); lb2 += (lb - lb2) * k(fcB);
      lo += (w - lo) * k(P.lo); lo2 += (lo - lo2) * k(P.lo); lt += (w - lt) * k(P.tc);
      lr += (w - lr) * k(220); const crack = w * Math.exp(-t / 0.0012) * P.tr, blast = lb2 * Math.exp(-t / P.bd) * P.bg * 3, body = lo2 * Math.exp(-t / P.ld) * P.lg * 14, tail = lt * Math.exp(-t / P.td) * P.tg;
      const mech = t > 0.028 && t < 0.05 ? w * Math.exp(-(t - 0.028) / 0.003) * (P.mech ?? 0.25) : 0, boom = lr * 18 * Math.exp(-t / 0.35) * (1 - Math.exp(-t / 0.04)) * (P.boom ?? 0.25);
      raw[i] = crack + blast + body + tail + mech + boom;
    }
    let pk = 1e-6; for (let i = 0; i < n; i++) { let x = raw[i]; if (i >= slap) x += raw[i - slap] * P.sg; raw[i] = Math.tanh(1.1 * x); pk = Math.max(pk, Math.abs(raw[i])); } const fadeN = Math.floor(sr * 0.03); for (let i = 0; i < n; i++) d[i] = raw[i] / pk * 0.6 * (i > n - fadeN ? (n - i) / fadeN : 1);
    return b;
  }
  shots(kind) {
    this.sb = this.sb || {}; if (this.sb[kind]) return this.sb[kind];
    const P = {
      rifle: { dur: 0.9, boom: 0.3, mech: 0.3, tr: 0.8, bc0: 8000, bc1: 700, bd: 0.026, bg: 1, lo: 140, ld: 0.08, lg: 1.1, tc: 1200, td: 0.12, tg: 0.12, slap: 0.11, sg: 0.07, drive: 2 },
      pistol: { dur: 0.6, boom: 0.15, mech: 0.35, tr: 0.8, bc0: 9000, bc1: 900, bd: 0.02, bg: 0.9, lo: 180, ld: 0.05, lg: 0.8, tc: 1500, td: 0.1, tg: 0.1, slap: 0.1, sg: 0.06, drive: 2 },
      shotgun: { dur: 1.0, boom: 0.4, mech: 0.2, tr: 1, bc0: 7000, bc1: 500, bd: 0.05, bg: 1.3, lo: 110, ld: 0.12, lg: 1.6, tc: 900, td: 0.16, tg: 0.12, slap: 0.12, sg: 0.07, drive: 2.6 },
      sniper: { dur: 1.3, boom: 0.5, mech: 0.35, tr: 1, bc0: 9000, bc1: 500, bd: 0.04, bg: 1.2, lo: 100, ld: 0.16, lg: 1.6, tc: 900, td: 0.3, tg: 0.16, slap: 0.15, sg: 0.1, drive: 2.4 },
      mini: { dur: 0.6, boom: 0.18, mech: 0.15, tr: 0.7, bc0: 7000, bc1: 800, bd: 0.02, bg: 1, lo: 150, ld: 0.055, lg: 1, tc: 1300, td: 0.09, tg: 0.1, slap: 0.09, sg: 0.05, drive: 3 },
      smg: { dur: 0.6, boom: 0.15, mech: 0.3, tr: 0.7, bc0: 9000, bc1: 1200, bd: 0.016, bg: 0.9, lo: 200, ld: 0.04, lg: 0.8, tc: 1800, td: 0.08, tg: 0.1, slap: 0.08, sg: 0.05, drive: 2.5 },
      rocket: { dur: 1.4, tr: 0.6, bc0: 3000, bc1: 400, bd: 0.25, bg: 0.9, lo: 90, ld: 0.2, lg: 1.4, tc: 900, td: 0.35, tg: 0.25, slap: 0.14, sg: 0.1, drive: 2.5 },
      boom: { dur: 2.2, tr: 0.8, bc0: 4500, bc1: 150, bd: 0.15, bg: 1.1, lo: 70, ld: 0.45, lg: 2, tc: 500, td: 0.6, tg: 0.45, slap: 0.2, sg: 0.12, drive: 2.5 },
      artillery: { dur: 3, tr: 0.15, bc0: 900, bc1: 120, bd: 0.3, bg: 0.7, lo: 55, ld: 0.8, lg: 2.2, tc: 300, td: 0.9, tg: 0.5, slap: 0.35, sg: 0.15, drive: 2 },
    }[kind];
    return this.sb[kind] = [1, 2, 3, 4].map(sd => this.shot(P, sd * 7 + kind.length));
  }
  // play a shot: power (from upgrades) makes it louder and deeper, far (0..1) muffles it and drowns it in echo
  gun(kind, vol = 1, power = 1, far = 0) {
    const c = this.ctx; if (!c || c.state !== 'running' || !(vol >= 0.03) || !isFinite(power) || !isFinite(far)) return; const t = c.currentTime;
    const k = 'g' + kind; if (this.last[k] && t - this.last[k] < (kind === 'mini' || kind === 'smg' ? 0.04 : 0.025)) return; this.last[k] = t; if ((this.live || 0) > 12 && vol < 0.9) return;
    const list = this.shots(kind), src = c.createBufferSource(); src.buffer = list[(Math.random() * list.length) | 0];
    src.playbackRate.value = (0.94 + Math.random() * 0.12) / (1 + (power - 1) * 0.35);
    const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 16000 - far * 14500; lp.Q.value = 0.5;
    g.gain.value = vol * this.vol * 0.5 * (0.85 + 0.15 * power) * (1 - far * 0.6);
    src.connect(lp); lp.connect(g); g.connect(this.out); const send = c.createGain(); send.gain.value = 0.04 + far * 0.3; g.connect(send); send.connect(this.verbIn);
    src.start(t); this.live = (this.live || 0) + 1; this.liveT = performance.now(); src.onended = () => { this.live = Math.max(0, this.live - 1); };
  }
  setVol(v) { this.vol = v; try { localStorage.setItem('hb-sfx', v); } catch (e) { } }
  buf(dur) { const c = this.ctx, k = Math.round(dur * 100); if (this.noise[k]) return this.noise[k]; const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1; return this.noise[k] = b; }
  // vol can be lowered for far-away sounds; a sound is not played twice within 30 ms
  sfx(name, vol = 1) {
    if (!(vol >= 0)) return; const c = this.ctx; if (c && FOLEY[name] && c.state === 'running') { const t0 = c.currentTime; if (this.last[name] && t0 - this.last[name] < 0.03) return; this.last[name] = t0; this.fb ??= {}; const b = this.fb[name] ??= FOLEY[name](c);
      const src = c.createBufferSource(); src.buffer = b; src.playbackRate.value = 0.96 + Math.random() * 0.08; const g = c.createGain(); g.gain.value = vol * this.vol * 0.8; src.connect(g); g.connect(this.out || c.destination); if (this.verbIn) { const sd = c.createGain(); sd.gain.value = 0.05; g.connect(sd); sd.connect(this.verbIn); } src.start(); return; }
    const d = S[name]; if (!c || !d || c.state !== 'running' || vol < 0.03) return; const t0 = c.currentTime;
    // never pile up too many synthesized sounds at once: that is what makes the browser drop audio
    if ((this.sfxN || 0) > 32) return; this.sfxN = (this.sfxN || 0) + 1; setTimeout(() => { this.sfxN--; }, 600);
    if (this.last[name] && t0 - this.last[name] < 0.03) return; this.last[name] = t0;
    for (const p of d) {
      const g = c.createGain(); g.connect(this.out || c.destination);
      if (p[0] === 'n') { const [, f, dur, v, dl = 0] = p, s = c.createBufferSource(); s.buffer = this.buf(dur); const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f; s.connect(fl); fl.connect(g); g.gain.setValueAtTime(v * vol * this.vol, t0 + dl); g.gain.exponentialRampToValueAtTime(0.001, t0 + dl + dur); s.start(t0 + dl); }
      else { const [f0, f1, dur, type, v, dl = 0] = p, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0 + dl); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dl + dur); o.connect(g); g.gain.setValueAtTime(v * vol * this.vol, t0 + dl); g.gain.exponentialRampToValueAtTime(0.001, t0 + dl + dur); o.start(t0 + dl); o.stop(t0 + dl + dur + 0.02); }
    }
  }
}

// ---------------------------------------------------------------- weapon handling foley, rendered once: metal clicks with ringing parts, spring scrapes, thuds, cloth
function fbuf(c, dur, fn) {
  const sr = c.sampleRate, n = Math.floor(sr * dur), b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
  const click = (t0, amp, base, ring = 0.03, snap = 1) => { const s0 = Math.floor(t0 * sr), P = [1, 1.52, 2.31, 2.94, 3.76, 4.9].map(r => base * r * (0.96 + Math.random() * 0.08)); let lp = 0;
    for (let i = 0; i < sr * 0.15 && s0 + i < n; i++) { const t = i / sr, w = Math.random() * 2 - 1; lp += 0.5 * (w - lp); let v = (w - lp) * Math.exp(-t / 0.0018) * snap * 1.4; for (let k = 0; k < P.length; k++) v += Math.sin(6.283 * P[k] * t + k) * Math.exp(-t / (ring / (1 + k * 0.5))) * 0.4 / (1 + k * 0.4); d[s0 + i] += v * amp; } };
  const thud = (t0, amp, f = 120, dec = 0.05) => { const s0 = Math.floor(t0 * sr); let lp = 0, ph = 0; for (let i = 0; i < sr * dec * 5 && s0 + i < n; i++) { const t = i / sr; ph += 6.283 * f * (1 + 1.5 * Math.exp(-t / 0.008)) / sr; lp += 0.08 * ((Math.random() * 2 - 1) - lp); d[s0 + i] += (Math.sin(ph) * 0.8 + lp * 2) * Math.exp(-t / dec) * amp; } };
  const scrape = (t0, dur, amp, lpf = 5000, hpf = 1200, rough = 0.6) => { const s0 = Math.floor(t0 * sr), m = Math.floor(dur * sr), al = 1 - Math.exp(-6.283 * lpf / sr), ah = 1 - Math.exp(-6.283 * hpf / sr); let l = 0, h = 0, g = 0, gt = 0;
    for (let i = 0; i < m && s0 + i < n; i++) { const w = Math.random() * 2 - 1; l += al * (w - l); h += ah * (l - h); if (--gt <= 0) { gt = 20 + Math.random() * 160; g = 1 - rough + rough * Math.random(); } const e = Math.sin(Math.PI * i / m) ** 0.6; d[s0 + i] += (l - h) * e * g * amp * 2.5; } };
  fn({ click, thud, scrape }); let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i])); if (mx > 0) for (let i = 0; i < n; i++) d[i] *= 0.9 / mx;
  for (let i = 0; i < Math.min(n, 64); i++) d[i] *= i / 64; return b;
}
const FOLEY = {
  magout: c => fbuf(c, 0.32, ({ click, scrape }) => { click(0.005, 0.7, 2300, 0.02); scrape(0.02, 0.13, 0.55, 6000, 1500); click(0.15, 0.35, 1700, 0.03); }),
  magin: c => fbuf(c, 0.32, ({ click, thud, scrape }) => { scrape(0.0, 0.07, 0.45, 5000, 1200); click(0.075, 1, 1450, 0.045); thud(0.075, 0.6, 150, 0.03); click(0.1, 0.3, 3100, 0.02); }),
  bolt: c => fbuf(c, 0.42, ({ click, thud, scrape }) => { click(0.0, 0.5, 2200, 0.02); scrape(0.01, 0.08, 0.6, 7000, 2000); click(0.09, 0.7, 2800, 0.03); scrape(0.2, 0.04, 0.5, 7000, 2000); click(0.24, 1, 1700, 0.05); thud(0.24, 0.5, 180, 0.03); }),
  slide: c => fbuf(c, 0.32, ({ click, thud, scrape }) => { scrape(0.0, 0.06, 0.6, 7000, 2200); click(0.06, 0.6, 3200, 0.025); click(0.14, 1, 2100, 0.04); thud(0.14, 0.4, 200, 0.02); }),
  pump: c => fbuf(c, 0.42, ({ click, thud, scrape }) => { scrape(0.0, 0.09, 0.7, 3500, 500); click(0.09, 0.9, 1300, 0.04); thud(0.09, 0.6, 110, 0.04); scrape(0.16, 0.08, 0.6, 3500, 500); click(0.25, 1, 1600, 0.05); thud(0.25, 0.6, 120, 0.04); }),
  shell: c => fbuf(c, 0.2, ({ click, thud, scrape }) => { scrape(0.0, 0.05, 0.35, 4500, 900); click(0.05, 0.7, 2500, 0.02); thud(0.05, 0.35, 220, 0.02); }),
  magdrop: c => fbuf(c, 0.4, ({ click, thud }) => { thud(0.0, 1, 90, 0.06); click(0.0, 0.45, 900, 0.05); click(0.11, 0.3, 1150, 0.03); click(0.19, 0.15, 1000, 0.02); }),
  pouch: c => fbuf(c, 0.3, ({ click, scrape }) => { scrape(0.0, 0.12, 0.7, 2800, 250, 0.9); scrape(0.1, 0.12, 0.5, 2400, 250, 0.9); click(0.06, 0.15, 700, 0.02, 0.3); }),
  rocketload: c => fbuf(c, 0.6, ({ click, thud, scrape }) => { scrape(0.0, 0.34, 0.6, 2200, 180, 0.4); thud(0.34, 1, 80, 0.09); click(0.36, 0.6, 1300, 0.05); }),
  beltin: c => fbuf(c, 0.45, ({ click, thud, scrape }) => { click(0.0, 0.6, 1800, 0.03); scrape(0.04, 0.16, 0.45, 6000, 1500, 0.9); for (let i = 0; i < 6; i++) click(0.05 + i * 0.025, 0.15, 3500, 0.01); click(0.25, 0.9, 1500, 0.045); thud(0.25, 0.6, 140, 0.04); }),
};

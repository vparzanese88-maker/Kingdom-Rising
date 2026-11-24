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
  reload: [['n', 1800, 0.05, 0.25], ['n', 700, 0.06, 0.2, 0.18], ['n', 1400, 0.05, 0.22, 0.5]],
  empty: [['n', 3000, 0.02, 0.15], ['n', 1200, 0.03, 0.12, 0.015]],
  hit: [['n', 900, 0.06, 0.25], [140, 90, 0.05, 'sine', 0.2]],
  kill: [['n', 700, 0.18, 0.35], [90, 45, 0.16, 'sine', 0.3]],
  hurt: [[200, 90, 0.18, 'sawtooth', 0.2]],
  place: [['n', 500, 0.12, 0.4], [80, 50, 0.15, 'sine', 0.4], ['n', 2400, 0.04, 0.15, 0.08]],
  nope: [[110, 100, 0.15, 'sawtooth', 0.05]],
  buy: [['n', 2200, 0.08, 0.16], ['n', 900, 0.1, 0.14, 0.05]],
  screech: [[1700, 900, 0.3, 'sawtooth', 0.07]],
  roar: [['n', 300, 1.2, 0.5], [70, 40, 1.2, 'sawtooth', 0.25]],
  spit: [['n', 1800, 0.15, 0.12], [400, 200, 0.1, 'triangle', 0.08]],
  whistle: [[1500, 380, 0.9, 'sine', 0.05], ['n', 3000, 0.9, 0.05]],   // an incoming shell
  heart: [[62, 48, 0.12, 'sine', 0.55], [56, 44, 0.14, 'sine', 0.42, 0.17]],
  pingS: [['n', 2200, 0.05, 0.12], [520, 520, 0.08, 'square', 0.035, 0.05]],
  alarmS: [[440, 440, 0.12, 'sawtooth', 0.05], [330, 330, 0.14, 'sawtooth', 0.05, 0.14]],
  alarm: [[330, 322, 0.55, 'sawtooth', 0.045], [165, 161, 0.55, 'square', 0.03], [262, 256, 0.55, 'sawtooth', 0.045, 0.62], [131, 128, 0.55, 'square', 0.03, 0.62]],   // a deep two-tone military klaxon
  wave: [['n', 300, 0.6, 0.5], [60, 35, 0.7, 'sine', 0.6], ['n', 300, 0.5, 0.35, 0.35], [55, 32, 0.6, 'sine', 0.5, 0.35]],
  win: [['n', 300, 0.8, 0.5], [55, 30, 1.0, 'sine', 0.6], [110, 110, 1.6, 'sawtooth', 0.04, 0.2], [165, 165, 1.6, 'sawtooth', 0.035, 0.2]],
  lose: [[400, 300, 0.4, 'sawtooth', 0.15], [300, 200, 0.4, 'sawtooth', 0.15, 0.4], [200, 90, 0.9, 'sawtooth', 0.15, 0.8]],
  pickup: [['n', 2600, 0.08, 0.18], ['n', 1200, 0.1, 0.15, 0.04], [220, 180, 0.06, 'triangle', 0.06]],
  heal: [['n', 1500, 0.25, 0.12]],
  tick: [[90, 60, 0.12, 'sine', 0.35], ['n', 600, 0.05, 0.15]],
  thunder: [['n', 220, 2.2, 0.6], [55, 35, 1.8, 'sine', 0.3]],
  grenade: [['n', 1800, 0.06, 0.15], ['n', 600, 0.08, 0.12, 0.04]],
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
  upg: [[300, 1400, 0.55, 'sawtooth', 0.05], ['n', 5000, 0.35, 0.15, 0.1], ['n', 1500, 0.12, 0.3, 0.55], [60, 40, 0.3, 'sine', 0.4, 0.55]],
  tink: [],
  headshot: [['n', 1400, 0.09, 0.35], [110, 60, 0.09, 'sine', 0.3], ['n', 500, 0.12, 0.2, 0.02]],
  torch: [['n', 3500, 0.15, 0.06]],
  spin: [[200, 900, 0.45, 'sawtooth', 0.05]],
  flame: [['n', 1200, 0.25, 0.12]],
  rail: [[3000, 200, 0.35, 'sawtooth', 0.1], ['n', 5000, 0.2, 0.15]],
};
export class Audio {
  constructor() { this.ctx = null; this.vol = 0.5; try { const v = +localStorage.getItem('hb-sfx'); if (localStorage.getItem('hb-sfx') !== null && v >= 0) this.vol = v; } catch (e) { } this.noise = {}; this.last = {}; }
  unlock() {
    if (!this.ctx) { try { const AC = window.AudioContext || window.webkitAudioContext; try { this.ctx = new AC({ latencyHint: 'playback' }); } catch (e) { this.ctx = new AC(); } /* a bigger buffer: the browser can't run dry when a frame is slow */ setTimeout(() => { if (!this.ctx) return; this.cb ??= {}; this.loadAliens(); for (const n in CREATURE) this.cb[n] ??= [0, 1, 2, 3, 4, 5].map(k => CREATURE[n](this.ctx, k)); this.fb ??= {}; for (const n in FOLEY) this.fb[n] ??= FOLEY[n](this.ctx); const jobs = []; for (const n in STEP) for (let k = 0; k < 8; k++) jobs.push([n, k]); const next = () => { const j = jobs.shift(); if (!j || !this.ctx) return; this._stepBuf(j[0], j[1]); setTimeout(next, 30); }; setTimeout(next, 300);   /* footsteps: one buffer per tick, so no frame stalls */ }, 900);   /* build the alien voices and reload noises ahead of time, not mid-fight */ this.chain(); this.ctx.onstatechange = () => { const c = this.ctx; if (c && c.state !== 'running' && c.state !== 'closed' && !document.hidden) c.resume().catch(() => { }); }; let i = 0; const kinds = ['rifle', 'pistol', 'shotgun', 'sniper', 'smg', 'mini', 'rocket', 'boom', 'artillery'], warm = () => { if (i < kinds.length) { this.shots(kinds[i++]); setTimeout(warm, 30); } }; setTimeout(warm, 50); } catch (e) { } }
    if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => { });
    // iPhone and iPad: playing a silent HTML audio element moves the page into the "media" sound category, so the game is heard even with the silent switch on
    if (!this.el && /iPad|iPhone|iPod/.test(navigator.userAgent + (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform) ? 'iPad' : ''))) { try { const n = 8000, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, s) => [...s].forEach((ch, i) => b[o + i] = ch.charCodeAt(0)); w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
      const url = URL.createObjectURL(new Blob([b], { type: 'audio/wav' })); this.el = new window.Audio(url); this.el.loop = true; this.el.volume = 0.01; this.el.setAttribute('playsinline', ''); } catch (e) { this.el = 1; } }
    if (this.el && this.el.play && this.el.paused) this.el.play().catch(() => { });
  }
  // a continuous roar for the drop pod: deep engine rumble plus wind howl; level 0..1 sets how violent it is (0 fades it out)
  rumble(level) {
    const c = this.ctx; if (!c || !this.out) return;
    if (!this.rmb) { const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let lp = 0; let pk = 1e-6; for (let i = 0; i < n; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.08; d[i] = lp; pk = Math.max(pk, Math.abs(lp)); } for (let i = 0; i < n; i++) d[i] *= 0.5 / pk;   /* normalised: never louder than half scale */
      const src = c.createBufferSource(); src.buffer = b; src.loop = true; const lo = c.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 120; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 45; const g = c.createGain(); g.gain.value = 0;
      const src2 = c.createBufferSource(); src2.buffer = this.buf(2); src2.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.8; const g2 = c.createGain(); g2.gain.value = 0;
      src.connect(hp); hp.connect(lo); lo.connect(g); g.connect(this.out); src2.connect(bp); bp.connect(g2); g2.connect(this.out); src.start(); src2.start(); this.rmb = { g, g2, lo, bp, src, src2 }; }
    const R = this.rmb, t = c.currentTime, v = Math.max(0, Math.min(1, level || 0)) * this.vol * 0.5;
    R.g.gain.setTargetAtTime(v * 0.55, t, 0.15); R.g2.gain.setTargetAtTime(0, t, 0.2);   /* the jittery hiss layer is off: it read as static (the roar carries the air sound) */ R.lo.frequency.setTargetAtTime(80 + level * 180, t, 0.2); R.bp.frequency.setTargetAtTime(300 + level * 1400 + Math.random() * 200, t, 0.1);
    if (level <= 0 && R) { setTimeout(() => { if (this.rmb === R && R.g.gain.value < 0.01) { try { R.src.stop(); R.src2.stop(); } catch (e) { } this.rmb = null; } }, 2500); }
  }
  // re-entry: the roar of burning air round the pod (a wide band you hear on any speaker, not just sub-bass), a howling whistle
  // through the hull seams, and the crackle of the heat shield ablating. Level 0 fades it out.
  roar(level) {
    const c = this.ctx; if (!c || !this.out) return; const L = Math.max(0, Math.min(1, level || 0));
    if (!this.ror) { if (L <= 0) return; const n = c.sampleRate * 3, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let lp = 0; for (let i = 0; i < n; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.35; d[i] = lp * 2.2; }
      const mk = (type, f, q) => { const x = c.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
      const s1 = c.createBufferSource(); s1.buffer = b; s1.loop = true; const b1 = mk('bandpass', 420, 0.45), b1b = mk('lowpass', 1800, 0.5), g1 = c.createGain(); g1.gain.value = 0; s1.connect(b1); b1.connect(b1b); b1b.connect(g1); g1.connect(this.out);   /* the roar */
      const s2 = c.createBufferSource(); s2.buffer = b; s2.loop = true; s2.playbackRate.value = 1.3; const b2 = mk('bandpass', 1400, 9), g2 = c.createGain(); g2.gain.value = 0; s2.connect(b2); b2.connect(g2); g2.connect(this.out);   /* the whistle through the seams */
      const s3 = c.createBufferSource(); s3.buffer = this.buf(2); s3.loop = true; const b3 = mk('highpass', 2600, 0.7), g3 = c.createGain(); g3.gain.value = 0; s3.connect(b3); b3.connect(g3); g3.connect(this.out);   /* the crackle */
      s1.start(); s2.start(); s3.start(0, 0.5); this.ror = { g1, g2, g3, b1, b2, s: [s1, s2, s3] }; }
    const R = this.ror, t = c.currentTime, v = this.vol;
    R.g1.gain.setTargetAtTime(L * 0.75 * v * (0.85 + Math.random() * 0.3), t, 0.12); R.b1.frequency.setTargetAtTime(260 + L * 520 + Math.random() * 120, t, 0.2);
    R.g2.gain.setTargetAtTime(L * L * 0.22 * v * (0.6 + 0.4 * Math.sin(t * 1.7) ** 2), t, 0.3); R.b2.frequency.setTargetAtTime(900 + L * 900 + Math.sin(t * 0.9) * 250, t, 0.4);
    R.g3.gain.setTargetAtTime(0, t, 0.05);   /* no crackle: it sounded like static */
    if (L <= 0) { setTimeout(() => { if (this.ror === R && R.g1.gain.value < 0.01) { try { R.s.forEach(q => q.stop()); } catch (e) { } this.ror = null; } }, 2500); }
  }
  // the welding arc, for as long as the beam is on: a mains-hum buzz, the frying sizzle of the arc and sputtering crackle; louder and harsher on contact
  weld(level) {
    const c = this.ctx; if (!c || !this.out) return; const L = Math.max(0, Math.min(1, level || 0));
    if (!this.wld) { if (L <= 0) return; const mk = (type, f, q) => { const x = c.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 120; const ob = mk('bandpass', 900, 1.2), og = c.createGain(); og.gain.value = 0; o.connect(ob); ob.connect(og); og.connect(this.out);   /* the buzz */
      const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 240; const o2b = mk('bandpass', 2400, 3), o2g = c.createGain(); o2g.gain.value = 0; o2.connect(o2b); o2b.connect(o2g); o2g.connect(this.out);
      const n = c.createBufferSource(); n.buffer = this.buf(2); n.loop = true; const nb = mk('highpass', 3200, 0.7), np = mk('peaking', 5500, 1); np.gain.value = 6; const ng = c.createGain(); ng.gain.value = 0; n.connect(nb); nb.connect(np); np.connect(ng); ng.connect(this.out);   /* the sizzle */
      o.start(); o2.start(); n.start(0, Math.random()); this.wld = { og, o2g, ng, o, src: [o, o2, n] }; }
    const W = this.wld, t = c.currentTime, v = this.vol;
    W.og.gain.setTargetAtTime(L * 0.05 * v, t, 0.03); W.o2g.gain.setTargetAtTime(L * L * 0.018 * v * Math.random(), t, 0.02); W.o.frequency.setTargetAtTime(118 + Math.random() * 6, t, 0.05);
    W.ng.gain.setTargetAtTime(L > 0 ? v * (0.03 + L * 0.06) * (Math.random() < 0.25 ? 2.2 : 0.6 + Math.random() * 0.6) : 0, t, 0.015);   /* sputter */
    if (L <= 0) { clearTimeout(W.stopT); W.stopT = setTimeout(() => { if (this.wld === W && W.og.gain.value < 0.003) { try { W.src.forEach(q => q.stop()); } catch (e) { } this.wld = null; } }, 1200); } else clearTimeout(W.stopT);
  }
  // battlefield ambience: a soft bed of wind that never stops (level 0 fades it out)
  ambient(level) {
    const c = this.ctx; if (!c || !this.out) return;
    if (!this.amb) { const src = c.createBufferSource(); src.buffer = this.buf(3); src.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6; const g = c.createGain(); g.gain.value = 0; const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 180; lfo.connect(lg); lg.connect(bp.frequency); src.connect(bp); bp.connect(g); g.connect(this.out); src.start(); lfo.start(); this.amb = { g }; }
    this.amb.g.gain.setTargetAtTime(Math.max(0, level) * this.vol * 0.07, c.currentTime, 0.8);
  }
  // is sound actually able to play right now?
  ok() { return !!this.ctx && this.ctx.state === 'running'; }
  // everything goes through a compressor (so a wall of gunfire stays loud without crackling) and a battlefield echo
  chain() {
    const c = this.ctx;
    // one master bus for effects and music, ending in a hard limiter, so nothing can ever hit the speakers above full scale
    this.lim = c.createDynamicsCompressor(); this.lim.threshold.value = -9; this.lim.knee.value = 6; this.lim.ratio.value = 12; this.lim.attack.value = 0.003; this.lim.release.value = 0.25;
    this.sub = c.createBiquadFilter(); this.sub.type = 'highpass'; this.sub.frequency.value = 32; this.sub.Q.value = 0.7;   // no sub-bass: it only eats headroom and makes the limiter duck everything
    this.bus = c.createGain(); this.bus.gain.value = 0.7; this.bus.connect(this.sub); this.sub.connect(this.lim); this.lim.connect(c.destination);
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
    if (this.mon && c.state === 'running') { this.mon.getFloatTimeDomainData(this.monBuf); let bad = false, peak = 0; for (let i = 0; i < this.monBuf.length; i++) { const v = this.monBuf[i]; if (!isFinite(v)) { bad = true; break; } peak = Math.max(peak, Math.abs(v)); }
      // dead air while music should be playing means the browser's audio got stuck: count it, and after a few seconds restart
      if (bad) this.restart(); }
  }
  // throw the whole sound engine away and build a new one (the next click or key turns it on); used when audio gets stuck
  restart() {
    const old = this.ctx; this.ctx = null; this.out = null; this.verbIn = null; this.noise = {}; this.sb = null; this.fb = null; this.rmb = null; this.amb = null; this.cb = null; this.last = {}; this.vox = []; try { old && old.close(); } catch (e) { }
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
      rifle: { dur: 0.7, boom: 0.22, mech: 0.3, tr: 0.8, bc0: 8000, bc1: 700, bd: 0.026, bg: 1, lo: 140, ld: 0.08, lg: 1.1, tc: 1200, td: 0.1, tg: 0.1, slap: 0.11, sg: 0.03, drive: 2 },
      pistol: { dur: 0.6, boom: 0.15, mech: 0.35, tr: 0.8, bc0: 9000, bc1: 900, bd: 0.02, bg: 0.9, lo: 180, ld: 0.05, lg: 0.8, tc: 1500, td: 0.1, tg: 0.1, slap: 0.1, sg: 0.06, drive: 2 },
      shotgun: { dur: 1.0, boom: 0.4, mech: 0.2, tr: 1, bc0: 7000, bc1: 500, bd: 0.05, bg: 1.3, lo: 110, ld: 0.12, lg: 1.6, tc: 900, td: 0.16, tg: 0.12, slap: 0.12, sg: 0.07, drive: 2.6 },
      sniper: { dur: 1.3, boom: 0.5, mech: 0.35, tr: 1, bc0: 9000, bc1: 500, bd: 0.04, bg: 1.2, lo: 100, ld: 0.16, lg: 1.6, tc: 900, td: 0.3, tg: 0.16, slap: 0.15, sg: 0.1, drive: 2.4 },
      mini: { dur: 0.4, boom: 0.12, mech: 0.15, tr: 0.7, bc0: 7000, bc1: 800, bd: 0.02, bg: 1, lo: 150, ld: 0.05, lg: 1, tc: 1300, td: 0.07, tg: 0.08, slap: 0.09, sg: 0, drive: 3 },
      smg: { dur: 0.35, boom: 0.08, mech: 0.3, tr: 0.8, bc0: 9000, bc1: 1400, bd: 0.014, bg: 0.9, lo: 220, ld: 0.035, lg: 0.8, tc: 2200, td: 0.05, tg: 0.06, slap: 0.08, sg: 0, drive: 2.2 },
      rocket: { dur: 1.4, tr: 0.6, bc0: 3000, bc1: 400, bd: 0.25, bg: 0.9, lo: 90, ld: 0.2, lg: 1.4, tc: 900, td: 0.35, tg: 0.25, slap: 0.14, sg: 0.1, drive: 2.5 },
      boom: { dur: 2.2, tr: 0.8, bc0: 4500, bc1: 150, bd: 0.15, bg: 1.1, lo: 70, ld: 0.45, lg: 2, tc: 500, td: 0.6, tg: 0.45, slap: 0.2, sg: 0.12, drive: 2.5 },
      artillery: { dur: 3, tr: 0.15, bc0: 900, bc1: 120, bd: 0.3, bg: 0.7, lo: 55, ld: 0.8, lg: 2.2, tc: 300, td: 0.9, tg: 0.5, slap: 0.35, sg: 0.15, drive: 2 },
    }[kind];
    return this.sb[kind] = [1, 2, 3, 4].map(sd => this.shot(P, sd * 7 + kind.length));
  }
  // play a shot: power (from upgrades) makes it louder and deeper, far (0..1) muffles it and drowns it in echo
  // Voice manager: every sound registers here. Nothing is ever refused: when too many are ringing at once, the quietest,
  // oldest one fades out in a few milliseconds to make room. (Refusing new sounds is what made audio seem to cut out.)
  _voice(g, stops, end, pri) {
    const now = this.ctx.currentTime; this.vox = (this.vox || []).filter(v => v.end > now);
    while (this.vox.length >= 44) { let k = 0; for (let i = 1; i < this.vox.length; i++) { const a = this.vox[i], b = this.vox[k]; if (a.pri < b.pri - 0.05 || (Math.abs(a.pri - b.pri) <= 0.05 && a.t0 < b.t0)) k = i; }
      const v = this.vox.splice(k, 1)[0]; try { v.g.gain.cancelScheduledValues(now); v.g.gain.setValueAtTime(v.g.gain.value, now); v.g.gain.linearRampToValueAtTime(0, now + 0.02); for (const s of v.stops) s.stop(now + 0.03); } catch (e) { } }
    this.vox.push({ g, stops, end, pri, t0: now });
  }
  // play a shot: power (from upgrades) makes it louder and deeper, far (0..1) muffles it and drowns it in echo
  gun(kind, vol = 1, power = 1, far = 0) {
    const c = this.ctx; if (!c || c.state !== 'running' || !(vol >= 0.03) || !isFinite(power) || !isFinite(far)) return; const t = c.currentTime;
    // your own shots (full volume) always play; other people's identical shots closer than 15 ms together merge into one
    if (vol < 0.9) { const k = 'g' + kind; if (this.last[k] && t - this.last[k] < 0.015) return; this.last[k] = t; }
    const list = this.shots(kind), src = c.createBufferSource(); src.buffer = list[(Math.random() * list.length) | 0];
    src.playbackRate.value = (0.94 + Math.random() * 0.12) / (1 + (power - 1) * 0.35);
    const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 16000 - far * 14500; lp.Q.value = 0.5;
    g.gain.value = vol * this.vol * 0.5 * (0.85 + 0.15 * power) * (1 - far * 0.6);
    src.connect(lp); lp.connect(g); g.connect(this.out); const send = c.createGain(); send.gain.value = 0.015 + far * 0.3; g.connect(send); send.connect(this.verbIn);   /* own and nearby shots stay dry: echo only for distant fire */
    src.start(t); this._voice(g, [src], t + src.buffer.duration / src.playbackRate.value, vol >= 0.9 ? 9 : vol);
  }
  // footsteps: rendered once per surface (5 steps, 3 landings each), then only picked and played. run: louder, brighter, a touch quicker
  // slots 0-4 are steps, 5-7 landings
  _stepBuf(surf, k) { this.stb ??= {}; const set = this.stb[surf] ??= { s: [], l: [], last: -1 }, land = k >= 5, list = land ? set.l : set.s, i = land ? k - 5 : k; return list[i] ??= STEP[surf](this.ctx, i, land ? 1 : 0); }
  _steps(surf) { for (let k = 0; k < 8; k++) this._stepBuf(surf, k); return this.stb[surf]; }
  _foot(surf, vol, rate, lpf, land) {
    const c = this.ctx; if (!c || c.state !== 'running' || !(vol >= 0.03) || !this.out) return; if (!STEP[surf]) surf = 'sand';
    const set = this._steps(surf), list = land ? set.l : set.s; let k = (Math.random() * list.length) | 0; if (!land && k === set.last) k = (k + 1) % list.length; if (!land) set.last = k;
    const t0 = c.currentTime, src = c.createBufferSource(); src.buffer = list[k]; src.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lpf; lp.Q.value = 0.5; const g = c.createGain(); g.gain.value = vol * this.vol * (STEP_TRIM[surf] || 1) * (0.85 + Math.random() * 0.3) * (land ? 0.14 : 0.085);   /* footsteps sit well under the guns and the music */
    src.connect(lp); lp.connect(g); g.connect(this.out); if (this.verbIn && (surf === 'concrete' || surf === 'metal')) { const sd = c.createGain(); sd.gain.value = 0.05; g.connect(sd); sd.connect(this.verbIn); }
    src.start(t0); this._voice(g, [src], t0 + list[k].duration / src.playbackRate.value, land ? 1 : vol * 0.5);   /* low priority: the first to make room in a firefight */
  }
  step(surf, vol = 1, run = false) { this._foot(surf, vol, run ? 1.06 : 1, run ? 15000 : vol < 0.5 ? 3200 : 7500, 0); }
  land(surf, vol = 1) { this._foot(surf, vol, 0.97, 12000, 1); }
  // real recorded creature voices (CC0, pitched down and roughened ahead of time, assets/sfx/al): they replace the synthesized ones as soon as they load
  loadAliens() { if (this.alLoading) return; this.alLoading = true; const c = this.ctx, base = new URL('../assets/sfx/al/', import.meta.url);
    fetch(new URL('index.json', base)).then(r => r.json()).then(idx => { for (const [name, files] of Object.entries(idx)) Promise.all(files.map(f => fetch(new URL(f, base)).then(r => r.arrayBuffer()).then(ab => new Promise((ok, no) => c.decodeAudioData(ab, ok, no))).catch(() => null))).then(bs => { bs = bs.filter(Boolean); if (bs.length) { this.cb[name] = bs; (this.real ??= {})[name] = true; } }); }).catch(() => { }); }
  setVol(v) { this.vol = v; try { localStorage.setItem('hb-sfx', v); } catch (e) { } }
  buf(dur) { const c = this.ctx, k = Math.round(dur * 100); if (this.noise[k]) return this.noise[k]; const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1; return this.noise[k] = b; }
  // vol can be lowered for far-away sounds; a sound is not played twice within 30 ms
  sfx(name, vol = 1) {
    const c = this.ctx; if (!c || c.state !== 'running' || !(vol >= 0.03) || !this.out) return; const t0 = c.currentTime;
    if (this.last[name] && t0 - this.last[name] < 0.03) return; this.last[name] = t0;   // the same sound twice within 30 ms is one sound
    if (CREATURE[name]) { this.cb ??= {}; this.cl ??= {}; this.cbT ??= {}; if (this.cbT[name] && t0 - this.cbT[name] < (name === 'roar' ? 0.6 : 0.12)) return; this.cbT[name] = t0;   /* a swarm doesn't all shout in the same instant */
      const set = this.cb[name] ??= [0, 1, 2, 3, 4, 5].map(k => CREATURE[name](c, k)); let vi = (Math.random() * set.length) | 0; if (vi === this.cl[name]) vi = (vi + 1 + ((Math.random() * (set.length - 1)) | 0)) % set.length; this.cl[name] = vi; const b = set[vi];   /* never the same voice twice in a row */
      const src = c.createBufferSource(); src.buffer = b; src.playbackRate.value = this.real && this.real[name] ? 0.9 + Math.random() * 0.16 : 0.8 + Math.random() * 0.2;   /* small variations on the recordings; the synthesized fallback only ever pitched down */ const g = c.createGain(); g.gain.value = vol * this.vol * (name === 'roar' ? 0.75 : 0.5); src.connect(g); g.connect(this.out); if (this.verbIn) { const sd = c.createGain(); sd.gain.value = 0.12; g.connect(sd); sd.connect(this.verbIn); }
      src.start(t0); this._voice(g, [src], t0 + b.duration / src.playbackRate.value, vol); return; }
    if (FOLEY[name]) { // weapon handling noises: soft and clean, no harsh crack or boom
      this.fb ??= {}; const b = this.fb[name] ??= FOLEY[name](c);
      const src = c.createBufferSource(); src.buffer = b; src.playbackRate.value = 0.96 + Math.random() * 0.08; const g = c.createGain(); g.gain.value = vol * this.vol * 0.32; const sf = c.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 6500; const hf = c.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 140;
      src.connect(hf); hf.connect(sf); sf.connect(g); g.connect(this.out); if (this.verbIn) { const sd = c.createGain(); sd.gain.value = 0.04; g.connect(sd); sd.connect(this.verbIn); }
      src.start(t0); this._voice(g, [src], t0 + b.duration, 5); return;
    }
    const d = S[name]; if (!d) return;
    const bus = c.createGain(); bus.connect(this.out); const stops = []; let end = t0;
    for (const p of d) {
      const g = c.createGain(); g.connect(bus);
      if (p[0] === 'n') { const [, f, dur, v, dl = 0] = p, s = c.createBufferSource(); s.buffer = this.buf(dur); const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f; s.connect(fl); fl.connect(g); g.gain.setValueAtTime(v * vol * this.vol, t0 + dl); g.gain.exponentialRampToValueAtTime(0.001, t0 + dl + dur); s.start(t0 + dl); s.stop(t0 + dl + dur + 0.02); stops.push(s); end = Math.max(end, t0 + dl + dur); }
      else { const [f0, f1, dur, type, v, dl = 0] = p, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0 + dl); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dl + dur); o.connect(g); g.gain.setValueAtTime(v * vol * this.vol, t0 + dl); g.gain.exponentialRampToValueAtTime(0.001, t0 + dl + dur); o.start(t0 + dl); o.stop(t0 + dl + dur + 0.02); stops.push(o); end = Math.max(end, t0 + dl + dur); }
    }
    this._voice(bus, stops, end + 0.03, vol);
  }
}

// ---------------------------------------------------------------- weapon handling foley, rendered once: metal clicks with ringing parts, spring scrapes, thuds, cloth
function fbuf(c, dur, fn) {
  const sr = c.sampleRate, n = Math.floor(sr * dur), b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
  const click = (t0, amp, base, ring = 0.03, snap = 1) => { const s0 = Math.floor(t0 * sr), P = [1, 1.52, 2.31, 2.94, 3.76, 4.9].map(r => base * r * (0.96 + Math.random() * 0.08)); let lp = 0;
    for (let i = 0; i < sr * 0.15 && s0 + i < n; i++) { const t = i / sr, w = Math.random() * 2 - 1; lp += 0.5 * (w - lp); let v = (w - lp) * Math.exp(-t / 0.0018) * snap * 0.6; for (let k = 0; k < P.length; k++) v += Math.sin(6.283 * P[k] * t + k) * Math.exp(-t / (ring / (1 + k * 0.5))) * 0.4 / (1 + k * 0.4); d[s0 + i] += v * amp; } };
  const thud = (t0, amp, f = 120, dec = 0.05) => { const s0 = Math.floor(t0 * sr); let lp = 0, ph = 0; for (let i = 0; i < sr * dec * 5 && s0 + i < n; i++) { const t = i / sr; ph += 6.283 * f * (1 + 1.5 * Math.exp(-t / 0.008)) / sr; lp += 0.08 * ((Math.random() * 2 - 1) - lp); d[s0 + i] += (Math.sin(ph) * 0.5 + lp * 0.8) * Math.exp(-t / dec) * amp * 0.6; } };
  const scrape = (t0, dur, amp, lpf = 5000, hpf = 1200, rough = 0.6) => { const s0 = Math.floor(t0 * sr), m = Math.floor(dur * sr), al = 1 - Math.exp(-6.283 * lpf / sr), ah = 1 - Math.exp(-6.283 * hpf / sr); let l = 0, h = 0, g = 0, gt = 0;
    for (let i = 0; i < m && s0 + i < n; i++) { const w = Math.random() * 2 - 1; l += al * (w - l); h += ah * (l - h); if (--gt <= 0) { gt = 20 + Math.random() * 160; g = 1 - rough + rough * Math.random(); } const e = Math.sin(Math.PI * i / m) ** 0.6; d[s0 + i] += (l - h) * e * g * amp * 2.5; } };
  fn({ click, thud, scrape }); let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i])); if (mx > 0) for (let i = 0; i < n; i++) d[i] *= 0.9 / mx;
  for (let i = 0; i < Math.min(n, 64); i++) d[i] *= i / 64; return b;
}
// ---------------------------------------------------------------- alien voices, rendered once: a throaty growl (a low buzzing voice wobbled by a second one),
// breathy shrieks (noise pushed through a moving band), wet hisses and insect clicking. Each gets a few variations so a swarm doesn't sound cloned.
function cbuf(c, dur, fn) { const sr = c.sampleRate, n = Math.floor(sr * dur), b = c.createBuffer(1, n, sr), d = b.getChannelData(0); fn(d, sr, n); let mx = 1e-6; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i])); for (let i = 0; i < n; i++) d[i] = Math.tanh(d[i] / mx * 1.6) * 0.85 * (i < 80 ? i / 80 : i > n - 400 ? (n - i) / 400 : 1); return b; }
function band(state, x, f, q, sr) { const w = 2 * Math.PI * f / sr, a = Math.sin(w) / (2 * q), b0 = a, a0 = 1 + a, a1 = -2 * Math.cos(w), a2 = 1 - a; const y = (b0 * x - b0 * state.x2 - a1 * state.y1 - a2 * state.y2) / a0; state.x2 = state.x1; state.x1 = x; state.y2 = state.y1; state.y1 = y; return y; }
// a creature's throat: a low buzzing source (two detuned partials, a sub-octave and a slow throat rattle) shaped by a moving mouth resonance, plus breath
function throat(d, sr, n, o) { const s1 = { x1: 0, x2: 0, y1: 0, y2: 0 }, s2 = { x1: 0, x2: 0, y1: 0, y2: 0 }, s3 = { x1: 0, x2: 0, y1: 0, y2: 0 }; let ph = 0, ph2 = 0, ph3 = 0, lp = 0;
  for (let i = 0; i < n; i++) { const t = i / sr, u = t / (n / sr), e = o.env(t, u), f = o.f0 * (1 + o.bend * Math.sin(Math.PI * Math.min(1, u * 1.3)) + 0.04 * Math.sin(t * 6.5 + o.k));
    ph += 6.283 * f / sr; ph2 += 6.283 * f * 1.007 / sr; ph3 += 6.283 * f * 0.5 / sr;
    const rat = 1 - o.rattle + o.rattle * (0.5 + 0.5 * Math.sin(t * 6.283 * o.rr + 2 * Math.sin(t * 9))) ** 2;   // the gravelly throat rattle
    const src = (Math.sin(ph + 1.8 * Math.sin(ph2 * 2)) * 0.7 + Math.sin(ph3) * o.sub + (((ph2 / 6.283) % 1) * 2 - 1) * 0.35) * rat;
    const w = Math.random() * 2 - 1; lp += 0.06 * (w - lp);
    const m1 = band(s1, src, o.fm1 * (1 + o.fsw * Math.sin(Math.PI * u)), 3, sr), m2 = band(s2, src, o.fm2 * (1 + o.fsw * 0.6 * Math.sin(Math.PI * u)), 4, sr), br = band(s3, w, o.fb, 1.2, sr);
    d[i] = (m1 * 1.6 + m2 * 0.9 + src * 0.25 + br * o.breath + lp * o.breath * 0.8) * e; } }
const CREATURE = {
  // the snarl (most aliens): short, deep and guttural, each one a different size of throat
  screech: (c, k) => cbuf(c, 0.55 + (k % 3) * 0.15, (d, sr, n) => throat(d, sr, n, { k, f0: 52 + k * 7, bend: 0.25 + (k % 2) * 0.15, sub: 0.6, rattle: 0.55, rr: 26 + k * 4, fm1: 520 + k * 60, fm2: 1150 + k * 90, fsw: 0.35, fb: 1500 + k * 120, breath: 0.35 + (k % 3) * 0.12, env: (t, u) => Math.min(1, t / 0.03) * Math.exp(-u * 2.6) })),
  // the roar (big beasts and the queen): a long, chest-deep bellow that rises and falls
  roar: (c, k) => cbuf(c, 1.7 + (k % 3) * 0.35, (d, sr, n) => throat(d, sr, n, { k, f0: 30 + k * 3.5, bend: 0.3, sub: 0.9, rattle: 0.45, rr: 18 + k * 3, fm1: 300 + k * 30, fm2: 700 + k * 55, fsw: 0.5, fb: 900 + k * 80, breath: 0.45, env: (t, u) => Math.min(1, t / 0.22) * (u < 0.55 ? 1 : Math.exp(-(u - 0.55) * 5)) })),
  // close-by chatter: a low purring growl broken by dull clicks of the mandibles (no squeaks)
  chitter: (c, k) => cbuf(c, 0.6 + (k % 2) * 0.2, (d, sr, n) => { throat(d, sr, n, { k, f0: 38 + k * 4, bend: 0.08, sub: 0.7, rattle: 0.85, rr: 14 + k * 3, fm1: 420 + k * 40, fm2: 900, fsw: 0.1, fb: 1100, breath: 0.15, env: (t, u) => Math.min(1, t / 0.05) * Math.sin(Math.PI * u) * 0.55 });
    const clicks = 3 + (k % 4); for (let j = 0; j < clicks; j++) { const t0 = Math.floor((0.05 + j * (0.45 / clicks) + Math.random() * 0.03) * sr), f = 700 + Math.random() * 700; for (let i = 0; i < sr * 0.04 && t0 + i < n; i++) d[t0 + i] += Math.sin(6.283 * f * i / sr) * Math.exp(-i / (sr * 0.008)) * 0.7; } }),
  // acid spit: a wet hawk and splatter, low and gurgling
  spit: (c, k) => cbuf(c, 0.45, (d, sr, n) => { const s = { x1: 0, x2: 0, y1: 0, y2: 0 }, s2 = { x1: 0, x2: 0, y1: 0, y2: 0 }; for (let i = 0; i < n; i++) { const t = i / sr, e = Math.min(1, t / 0.015) * Math.exp(-t * 7), g = 0.5 + 0.5 * Math.sin(t * 6.283 * (30 + k * 6)); d[i] = band(s, Math.random() * 2 - 1, 1300 - t * 1600 + k * 90, 1.4, sr) * e * (0.6 + 0.4 * g) + band(s2, Math.random() * 2 - 1, 260 + k * 20, 2, sr) * e * 1.4; } }),
};
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

// ---------------------------------------------------------------- footsteps, rendered once per surface: a heel strike then the toe roll, built from
// a low body thump, tiny damped "grains" (stones, sand, snow crystals, twigs), filtered noise and, for steel, ringing plate modes.
// L = 1 is a heavier two-footed landing: a deeper, longer thump, more debris.
function sbuf(c, dur, fn) {
  const sr = c.sampleRate, n = Math.floor(sr * dur), b = c.createBuffer(1, n, sr), d = b.getChannelData(0), R = Math.random;
  const put = (i, v) => { if (i >= 0 && i < n) d[i] += v; };
  const thump = (t0, amp, f, dec) => { const s0 = Math.floor(t0 * sr); let ph = 0, lp = 0, lp2 = 0; for (let i = 0; i < sr * dec * 6; i++) { const t = i / sr; ph += 6.283 * f / sr; lp += 0.08 * ((R() * 2 - 1) - lp); lp2 += 0.3 * (lp - lp2); put(s0 + i, (Math.sin(ph) * 0.35 + lp2 * 2.2) * Math.exp(-t / dec) * Math.min(1, t / 0.001) * amp); } };   /* a dull, flat impact: no pitch slide (that sounded like a bloop) */
  const grain = (t0, amp, f, dec) => { const s0 = Math.floor(t0 * sr), st = { x1: 0, x2: 0, y1: 0, y2: 0 }; for (let i = 0; i < sr * dec * 5; i++) { const t = i / sr; put(s0 + i, band(st, R() * 2 - 1, f, 0.7, sr) * Math.exp(-t / dec) * amp * 2.4); } };   /* a speck of grit: a tiny burst of filtered noise (pure-tone pings sounded like water) */
  // count grains spread over dur, densest where shape(u) is high
  const crunch = (t0, dur, count, fLo, fHi, amp, dLo, dHi, shape = u => (1 - u) ** 1.3) => { for (let j = 0; j < count; j++) { const u = R(), a = shape(u); if (R() > a + 0.08) continue; grain(t0 + u * dur, amp * (0.3 + R() * 0.7) * (0.4 + a * 0.6), fLo + (fHi - fLo) * R() ** 1.4, (dLo + (dHi - dLo) * R()) / 1000); } };
  // band-passed noise with an envelope; gate > 0 chops it into random little segments (rustling leaves)
  const hiss = (t0, dur, amp, f, q, env = u => Math.sin(Math.PI * Math.min(1, u * 3)) * (1 - u), gate = 0) => { const s0 = Math.floor(t0 * sr), m = Math.floor(dur * sr), st = { x1: 0, x2: 0, y1: 0, y2: 0 }; let gt = 0, gv = 1; for (let i = 0; i < m; i++) { if (gate && --gt <= 0) { gt = sr * (0.002 + R() * 0.01); gv = R() < gate ? 0.1 : 0.4 + R() * 0.6; } put(s0 + i, band(st, R() * 2 - 1, f, q, sr) * env(i / m) * gv * amp); } };
  const click = (t0, amp, f = 3500, dec = 0.0015) => { const s0 = Math.floor(t0 * sr), st = { x1: 0, x2: 0, y1: 0, y2: 0 }; for (let i = 0; i < sr * dec * 6; i++) put(s0 + i, band(st, R() * 2 - 1, f, 0.8, sr) * Math.exp(-i / (sr * dec)) * amp * 3); };
  // a steel plate: a handful of inharmonic modes that ring on, the high ones dying first
  const ring = (t0, amp, f0, len) => { const s0 = Math.floor(t0 * sr), P = [1, 1.58, 2.34, 3.17, 4.41, 5.93, 7.6], A = [0.5, 0.42, 0.34, 0.24, 0.17, 0.12, 0.08], ph = P.map(() => R() * 6.283), fr = P.map(r => f0 * r * (0.97 + R() * 0.06)); const dk = P.map((r, q) => Math.exp(-(4 + q * 3.2) / len * 0.4 / sr)), e = A.slice(); for (let i = 0; i < sr * len && s0 + i < n; i++) { const t = i / sr; let v = 0; for (let q = 0; q < P.length; q++) { v += Math.sin(6.283 * fr[q] * t + ph[q]) * e[q]; e[q] *= dk[q]; } put(s0 + i, v * amp * Math.min(1, t / 0.0008)); } };
  fn({ thump, grain, crunch, hiss, click, ring, R, sr, n, d });
  let mx = 1e-6; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i])); const k = 0.9 / mx; for (let i = 0; i < n; i++) d[i] = Math.tanh(d[i] * k * 1.1) * 0.9 * (i < 24 ? i / 24 : i > n - 300 ? (n - i) / 300 : 1); return b;
}
// short early reflections off nearby walls (the hub's concrete room): delayed, darker copies
function reflect(d, sr, taps) { const src = Float32Array.from(d); for (const [ms, g] of taps) { const o = Math.floor(ms / 1000 * sr); let lp = 0; for (let i = 0; i + o < d.length; i++) { lp += 0.35 * (src[i] - lp); d[i + o] += lp * g; } } }
const STEP_TRIM = { sand: 1, gravel: 0.9, concrete: 1, metal: 0.72, snow: 0.95, grass: 0.95, rock: 1 };
const STEP = {
  // soft and granular: a muffled push into loose sand with a fine crunch
  sand: (c, k, L) => sbuf(c, L ? 0.5 : 0.32, ({ thump, crunch, hiss, R }) => { const toe = 0.06 + R() * 0.03;
    thump(0, L ? 0.9 : 0.4, L ? 55 : 72, L ? 0.05 : 0.025); if (L) thump(0.02 + R() * 0.01, 0.6, 62, 0.04);
    hiss(0, L ? 0.32 : 0.2, L ? 0.8 : 0.5, 1100 + k * 120, 0.7); crunch(0.004, L ? 0.2 : 0.13, L ? 200 : 110, 1400, 4800, 0.14, 0.4, 1.3);
    if (!L) { crunch(toe, 0.09, 50, 1600, 5000, 0.09, 0.3, 1); hiss(toe, 0.12, 0.25, 1800, 0.8); } else hiss(0.06, 0.25, 0.18, 2200, 1); }),
  // sharp stones: dense bright crunch, a few bigger stones knocking, then the toe grinding
  gravel: (c, k, L) => sbuf(c, L ? 0.5 : 0.3, ({ thump, crunch, hiss, R }) => { const toe = 0.065 + R() * 0.025;
    thump(0, L ? 0.8 : 0.4, L ? 65 : 85, L ? 0.04 : 0.02); if (L) thump(0.018 + R() * 0.012, 0.55, 75, 0.03);
    crunch(0.002, L ? 0.16 : 0.09, L ? 160 : 70, 2000, 7500, 0.38, 0.25, 1.4); crunch(0.004, L ? 0.2 : 0.11, L ? 18 : 9, 800, 2100, 0.55, 2, 4.5);
    hiss(0, L ? 0.14 : 0.07, 0.3, 3200 + k * 200, 1);
    if (!L) { crunch(toe, 0.07, 45, 2200, 7000, 0.28, 0.25, 1.2); crunch(toe, 0.08, 5, 900, 2000, 0.4, 2, 4); hiss(toe, 0.09, 0.22, 2600, 1.2); } else crunch(0.12, 0.2, 40, 1500, 6000, 0.15, 0.3, 1.2, u => 1 - u); }),
  // a hard heel-toe tap on concrete, with short reflections off the hub's walls
  concrete: (c, k, L) => sbuf(c, L ? 0.45 : 0.3, ({ thump, click, hiss, crunch, R, d, sr }) => { const toe = 0.055 + R() * 0.025;
    click(0, L ? 1.1 : 0.9, 3000 + k * 250, 0.0012); thump(0, L ? 1 : 0.55, L ? 80 : 110, L ? 0.03 : 0.012);
    if (L) { click(0.02 + R() * 0.01, 0.8, 2700, 0.0014); thump(0.025, 0.7, 90, 0.025); hiss(0.05, 0.12, 0.12, 1800, 1); }
    else { click(toe, 0.5, 3600 + k * 200, 0.001); thump(toe, 0.25, 140, 0.008); hiss(toe, 0.04, 0.1, 2600, 1); }
    crunch(0.003, 0.05, 8, 3000, 7000, 0.08, 0.2, 0.6);   // a little grit under the sole
    reflect(d, sr, [[8 + k, 0.3], [15 + k * 1.5, 0.2], [27 + k * 2, 0.13], [43 + k, 0.07]]); }),
  // a hollow clang: the boot hits a steel deck that rings, with a low boom from the span underneath
  metal: (c, k, L) => sbuf(c, L ? 0.9 : 0.55, ({ thump, click, ring, grain, R }) => { const toe = 0.06 + R() * 0.025, f0 = 160 + k * 21 + R() * 10;
    click(0, 0.6, 2400, 0.001); thump(0, L ? 1 : 0.5, L ? 60 : 92, L ? 0.05 : 0.02); ring(0, L ? 0.9 : 0.55, f0, L ? 0.75 : 0.42); thump(0.002, L ? 0.8 : 0.4, 75 + k * 4, L ? 0.12 : 0.07);
    if (L) { ring(0.022, 0.6, f0 * 1.07, 0.6); click(0.022, 0.5, 2000, 0.001); for (let i = 0; i < 6; i++) grain(0.03 + R() * 0.15, 0.25, 1300 + R() * 1800, 0.004); }
    else { click(toe, 0.35, 2800, 0.0008); ring(toe, 0.3, f0 * 1.12, 0.3); for (let i = 0; i < 3; i++) grain(0.015 + R() * 0.1, 0.15, 1200 + R() * 1500, 0.003); } }),
  // snow compressing under the boot: a soft thump and a crisp crunch that swells then fades, with a faint squeak
  snow: (c, k, L) => sbuf(c, L ? 0.55 : 0.38, ({ thump, crunch, hiss, R }) => { const toe = 0.1 + R() * 0.03, sh = u => Math.sin(Math.PI * Math.min(1, u * 1.3)) ** 0.8;
    thump(0, L ? 0.8 : 0.3, L ? 50 : 62, L ? 0.06 : 0.035);
    crunch(0.006, L ? 0.28 : 0.19, L ? 320 : 190, 1200, 4000, 0.16, 0.3, 0.9, sh); hiss(0, L ? 0.3 : 0.18, 0.35, 550, 0.7);
    hiss(0.03, L ? 0.18 : 0.1, 0.08, 1050 + k * 60, 7, u => Math.sin(Math.PI * u));
    if (!L) crunch(toe, 0.1, 70, 1500, 4200, 0.1, 0.3, 0.8, sh); }),
  // grass and jungle undergrowth: a soft thump in a rustle of leaves, the odd twig
  grass: (c, k, L) => sbuf(c, L ? 0.55 : 0.36, ({ thump, crunch, hiss, grain, R }) => { const toe = 0.07 + R() * 0.03;
    thump(0, L ? 0.75 : 0.3, L ? 58 : 75, L ? 0.045 : 0.025);
    hiss(0, L ? 0.34 : 0.22, L ? 0.9 : 0.6, 3600 + k * 300, 0.9, u => Math.min(1, u * 8) * (1 - u) ** 1.5, 0.35); hiss(0.01, 0.16, 0.25, 1400, 0.8);
    if (!L) hiss(toe, 0.16, 0.35, 4400, 1, u => Math.min(1, u * 6) * (1 - u) ** 2, 0.4); else crunch(0.02, 0.2, 30, 2000, 5000, 0.2, 0.3, 1);
    if (R() < 0.6 || L) grain(0.01 + R() * 0.06, 0.35, 1800 + R() * 1600, 0.0012); }),
  // bare rock: a hard scuff with a little grit
  rock: (c, k, L) => sbuf(c, L ? 0.45 : 0.28, ({ thump, click, hiss, crunch, R }) => { const toe = 0.055 + R() * 0.025;
    click(0, 0.6, 2200 + k * 200, 0.0015); thump(0, L ? 1 : 0.5, L ? 70 : 100, L ? 0.03 : 0.015); hiss(0.004, L ? 0.12 : 0.06, 0.3, 1900, 1);
    crunch(0.003, L ? 0.12 : 0.07, L ? 40 : 18, 2000, 6500, 0.25, 0.25, 1);
    if (L) thump(0.022, 0.6, 85, 0.025); else { click(toe, 0.3, 2600, 0.001); hiss(toe, 0.06, 0.18, 2200, 1); } }),
};

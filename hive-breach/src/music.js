// The soundtrack: a military sci-fi score played live by a small synth orchestra.
// Marching snare rudiments, deep war drums, brass stabs, a driving string ostinato, a sub-bass pulse,
// a heroic horn line and a high futuristic pulse. D minor: Dm - Bb - C - Am.
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const PROG = { main: { roots: [38, 34, 36, 33], q: [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 3, 7]] }, boss: { roots: [38, 39, 38, 37], q: [[0, 3, 7], [0, 4, 7], [0, 3, 7], [0, 4, 7]] } };
// marching snare: 1 = accent, 0.4 = ghost note
const SNARE = [1, 0, 0.4, 0.4, 1, 0, 0.4, 0, 1, 0.4, 0.4, 0.4, 1, 0.4, 1, 1];
const TAIKO = [1, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 1, 0, 0, 0, 0.6, 0.6];
const OSTI = [0, 0, 12, 0, 7, 0, 12, 7, 0, 0, 12, 0, 7, 12, 7, 12];
const HORN = [[0, 7, 6], [6, 10, 2], [8, 12, 4], [12, 10, 4]];      // [step, interval, length in steps], one phrase per bar
const MIX = {
  off: { snare: 0, taiko: 0, kick: 0, brass: 0, strings: 0, sub: 0, horn: 0, pulse: 0 },
  title: { snare: 0.6, taiko: 0.9, kick: 0.5, brass: 1, strings: 0.8, sub: 0.7, horn: 1, pulse: 0.4 },
  calm: { snare: 0.35, taiko: 0.4, kick: 0, brass: 0.7, strings: 0.5, sub: 0.5, horn: 0, pulse: 0.6 },
  battle: { snare: 0.9, taiko: 1, kick: 1, brass: 0.9, strings: 1, sub: 1, horn: 0.4, pulse: 0.5 },
  boss: { snare: 1, taiko: 1, kick: 1, brass: 1, strings: 1, sub: 1, horn: 1, pulse: 0.4 },
};
export class Music {
  constructor(audio) { this.a = audio; this.mode = 'calm'; this.on = true; this.vol = 0.75; try { const v = JSON.parse(localStorage.getItem('hb-music2') || 'null'); if (v) { this.on = v.on; this.vol = v.vol; } } catch (e) { } }
  save() { try { localStorage.setItem('hb-music2', JSON.stringify({ on: this.on, vol: this.vol })); } catch (e) { } }
  start() {
    const c = this.a.ctx; if (!c || this.master) return;
    this.master = c.createGain(); this.master.gain.value = this.on ? this.vol * 2 : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; this.master.connect(comp); comp.connect(c.destination);
    this.L = {}; for (const k of Object.keys(MIX.calm)) { const g = c.createGain(); g.gain.value = MIX[this.mode][k]; g.connect(this.master); this.L[k] = g; }
    // a hall: short dark echo so drums and brass sound big
    this.hall = c.createDelay(1); const fb = c.createGain(), wet = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; fb.gain.value = 0.32; wet.gain.value = 0.35; this.hall.delayTime.value = 0.19;
    this.hall.connect(lp); lp.connect(fb); fb.connect(this.hall); lp.connect(wet); wet.connect(this.master);
    this.step = 0; this.next = c.currentTime + 0.1; this.bpm = 104; this.timer = setInterval(() => this.tick(), 25);
  }
  set(mode) {
    if (mode === this.mode || !MIX[mode]) return; this.mode = mode; if (!this.master) return; const t = this.a.ctx.currentTime;
    for (const k in this.L) this.L[k].gain.setTargetAtTime(MIX[mode][k], t, 0.8);
    this.bpm = mode === 'boss' ? 118 : mode === 'battle' ? 108 : 100;
  }
  toggle() { this.on = !this.on; this.save(); if (this.master) this.master.gain.setTargetAtTime(this.on ? this.vol * 2 : 0, this.a.ctx.currentTime, 0.1); return this.on; }
  setVol(v) { this.vol = v; this.save(); if (this.master && this.on) this.master.gain.setTargetAtTime(v * 2, this.a.ctx.currentTime, 0.1); }
  tick() {
    const c = this.a.ctx; if (!c || c.state !== 'running') { if (c) this.next = c.currentTime + 0.1; return; }
    if (this.next < c.currentTime - 0.2) this.next = c.currentTime + 0.05;
    while (this.next < c.currentTime + 0.15) { this.play(this.step, this.next); this.next += 60 / this.bpm / 4; this.step = (this.step + 1) % 64; }
  }
  play(step, t) {
    if (!this.on) return;
    const P = this.mode === 'boss' ? PROG.boss : PROG.main, bar = step >> 4, s = step & 15, root = P.roots[bar], q = P.q[bar], sx = 60 / this.bpm / 4, M = MIX[this.mode], calm = this.mode === 'calm';
    if (M.snare) { const v = SNARE[s]; if (v && !(calm && v < 1 && s % 4)) this.snare(t, v * (calm ? 0.5 : 1)); if (this.mode === 'boss' && bar === 3 && s >= 12) this.snare(t + sx / 2, 0.5); }
    if (M.taiko && TAIKO[s] && (!calm || s === 0)) this.taiko(t, TAIKO[s], s === 0 ? 1 : 1.3);
    if (M.kick && (s === 0 || s === 8 || (this.mode === 'boss' && s % 4 === 0))) this.kick(t);
    if (M.brass) { if (calm) { if (s === 0) for (const iv of q) this.brass(t, midi(root + 12 + iv), sx * 15, 0.5); } else if (s === 0 || s === 10 || (s === 14 && bar === 3)) for (const iv of [0, 7, 12, q[1] + 12]) this.brass(t, midi(root + 12 + iv), sx * (s === 0 ? 5 : 3), 1); }
    if (M.strings && (!calm || s % 2 === 0)) this.string(t, midi(root + 24 + OSTI[s]), sx * 0.8);
    if (M.sub && s % 2 === 0) this.sub(t, midi(root), sx * 1.8);
    if (M.horn) for (const [st, iv, len] of HORN) if (st === s && (this.mode !== 'battle' || bar % 2 === 1)) this.horn(t, midi(root + 24 + iv + (bar === 3 && st === 12 ? -2 : 0)), sx * len);
    if (M.pulse && s % 2 === 1) this.pulse(t, midi(root + 48 + q[(s >> 1) % 3]), sx * 0.6);
  }
  out(layer, wetAmt = 0) { const c = this.a.ctx, g = c.createGain(); g.connect(this.L[layer]); if (wetAmt) { const w = c.createGain(); w.gain.value = wetAmt; g.connect(w); w.connect(this.hall); } return g; }
  env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  osc(type, f, t, dur, dest, det = 0) { const o = this.a.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = det; o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o; }
  noise(t, dur, type, f, q, dest) { const c = this.a.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(); s.buffer = this.a.buf(Math.max(0.05, dur)); fl.type = type; fl.frequency.value = f; fl.Q.value = q; s.connect(fl); fl.connect(dest); s.start(t); s.stop(t + dur + 0.02); }
  snare(t, v) { const g = this.out('snare', 0.25); this.env(g, t, 0.001, 0.32 * v, 0.14 + 0.06 * v); this.noise(t, 0.2, 'bandpass', 2600, 0.9, g); const g2 = this.out('snare'); this.env(g2, t, 0.001, 0.12 * v, 0.07); this.osc('triangle', 220, t, 0.08, g2); }
  taiko(t, v, pitch) { const g = this.out('taiko', 0.45); this.env(g, t, 0.002, 0.8 * v, 0.6); const o = this.osc('sine', 95 * pitch, t, 0.6, g); o.frequency.exponentialRampToValueAtTime(48 * pitch, t + 0.35); const g2 = this.out('taiko'); this.env(g2, t, 0.001, 0.25 * v, 0.12); this.noise(t, 0.12, 'lowpass', 900, 0.7, g2); }
  kick(t) { const g = this.out('kick'); this.env(g, t, 0.002, 0.9, 0.3); const o = this.osc('sine', 130, t, 0.3, g); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); }
  brass(t, f, dur, v) { const c = this.a.ctx, g = this.out('brass', 0.35), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(2200 * v, t + 0.06); lp.frequency.exponentialRampToValueAtTime(700, t + dur); lp.connect(g);
    for (const d of [-9, 0, 9]) this.osc('sawtooth', f, t, dur, lp, d); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07 * v, t + 0.05); g.gain.setValueAtTime(0.06 * v, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  string(t, f, dur) { const c = this.a.ctx, g = this.out('strings', 0.15), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.connect(g); this.osc('sawtooth', f, t, dur, lp, -5); this.osc('sawtooth', f, t, dur, lp, 6); this.env(g, t, 0.006, 0.05, dur); }
  sub(t, f, dur) { const c = this.a.ctx, g = this.out('sub'), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.connect(g); this.osc('sawtooth', f, t, dur, lp); this.osc('sine', f / 2, t, dur, g); this.env(g, t, 0.005, 0.38, dur); }
  horn(t, f, dur) { const c = this.a.ctx, g = this.out('horn', 0.5), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 1.5; lp.connect(g);
    const o = this.osc('sawtooth', f, t, dur, lp), o2 = this.osc('square', f / 2, t, dur, lp, 4), lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t + 0.15); lfo.stop(t + dur + 0.05); void o2;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.11, t + 0.08); g.gain.setValueAtTime(0.1, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  pulse(t, f, dur) { const c = this.a.ctx, g = this.out('pulse', 0.6), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3; bp.connect(g); this.osc('square', f, t, dur, bp); this.env(g, t, 0.002, 0.08, dur); }
}

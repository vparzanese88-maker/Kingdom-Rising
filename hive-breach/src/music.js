// The soundtrack, played live by a small synth sequencer.
// Calm while building (pads, a soft arpeggio, hats), full battle music during waves (drums and a driving bass),
// and a faster, darker boss theme with a lead line while a Ravager or the Hive Queen is alive.
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const PROG = {
  main: { roots: [45, 41, 48, 43], q: [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]] },             // Am  F  C  G
  boss: { roots: [45, 46, 45, 44], q: [[0, 3, 7], [0, 4, 7], [0, 3, 7], [0, 4, 7]] },             // Am  Bb Am G#
};
const LEAD = [[0, 12], [3, 15], [6, 12], [8, 19], [10, 17], [12, 15], [14, 12]];   // [step, interval above the root]
const MIX = {
  off: { drums: 0, hat: 0, bass: 0, arp: 0, pad: 0, lead: 0 },
  title: { drums: 0.7, hat: 0.6, bass: 0.9, arp: 0.9, pad: 1, lead: 0.5 },
  calm: { drums: 0, hat: 0.6, bass: 0.8, arp: 0.9, pad: 1, lead: 0 },
  battle: { drums: 1, hat: 0.8, bass: 1, arp: 0.75, pad: 0.6, lead: 0 },
  boss: { drums: 1, hat: 0.9, bass: 1, arp: 0.6, pad: 0.5, lead: 0.8 },
};
export class Music {
  constructor(audio) { this.a = audio; this.mode = 'calm'; this.on = true; this.vol = 0.55; try { const v = JSON.parse(localStorage.getItem('hb-music') || 'null'); if (v) { this.on = v.on; this.vol = v.vol; } } catch (e) { } }
  save() { try { localStorage.setItem('hb-music', JSON.stringify({ on: this.on, vol: this.vol })); } catch (e) { } }
  start() {
    const c = this.a.ctx; if (!c || this.master) return;
    this.master = c.createGain(); this.master.gain.value = this.on ? this.vol * 2.4 : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; this.master.connect(comp); comp.connect(c.destination);
    this.L = {}; for (const k of Object.keys(MIX.calm)) { const g = c.createGain(); g.gain.value = MIX[this.mode][k]; g.connect(this.master); this.L[k] = g; }
    // echo on the arpeggio and lead
    this.echo = c.createDelay(1); const fb = c.createGain(), wet = c.createGain(); fb.gain.value = 0.38; wet.gain.value = 0.45; this.echo.connect(fb); fb.connect(this.echo); this.echo.connect(wet); wet.connect(this.master);
    this.step = 0; this.next = c.currentTime + 0.1; this.bpm = 126; this.setEcho();
    this.timer = setInterval(() => this.tick(), 25);
  }
  setEcho() { this.echo.delayTime.value = 60 / this.bpm * 0.75; }
  set(mode) {
    if (mode === this.mode || !MIX[mode]) return; this.mode = mode; if (!this.master) return; const t = this.a.ctx.currentTime;
    for (const k in this.L) this.L[k].gain.setTargetAtTime(MIX[mode][k], t, 0.6);
    const bpm = mode === 'boss' ? 138 : 126; if (bpm !== this.bpm) { this.bpm = bpm; this.setEcho(); }
  }
  toggle() { this.on = !this.on; this.save(); if (this.master) this.master.gain.setTargetAtTime(this.on ? this.vol * 2.4 : 0, this.a.ctx.currentTime, 0.1); return this.on; }
  setVol(v) { this.vol = v; this.save(); if (this.master && this.on) this.master.gain.setTargetAtTime(v * 2.4, this.a.ctx.currentTime, 0.1); }
  tick() {
    const c = this.a.ctx; if (!c || c.state !== 'running') { if (c) this.next = c.currentTime + 0.1; return; }
    if (this.next < c.currentTime - 0.2) this.next = c.currentTime + 0.05;   // after the tab was hidden
    while (this.next < c.currentTime + 0.15) { this.play(this.step, this.next); this.next += 60 / this.bpm / 4; this.step = (this.step + 1) % 64; }
  }
  play(step, t) {
    if (!this.on) return;
    const P = this.mode === 'boss' ? PROG.boss : PROG.main, bar = step >> 4, s = step & 15, root = P.roots[bar], q = P.q[bar], sx = 60 / this.bpm / 4, M = MIX[this.mode];
    if (M.drums) {
      if (s % 4 === 0 || (this.mode === 'boss' && bar === 3 && s === 14)) this.kick(t);
      if (s === 4 || s === 12) this.snare(t);
      if (this.mode === 'boss' && bar === 3 && s >= 13) this.snare(t, 0.5);
    }
    if (M.hat) { if (s % 4 === 2) this.hat(t, 0.5, 0.09); else if (this.mode !== 'calm' && s % 2 === 1) this.hat(t, 0.22, 0.03); }
    if (M.bass && s % 2 === 0) { const pat = this.mode === 'calm' ? [0, null, null, null, 0, null, 7, null] : [0, 0, 12, 0, 0, 12, 0, 7]; const iv = pat[s / 2]; if (iv !== null) this.bass(t, midi(root - 12 + iv), sx * (this.mode === 'calm' ? 3.5 : 1.7)); }
    if (M.arp && (this.mode !== 'calm' || s % 2 === 0)) { const seq = [0, 1, 2, 3, 2, 1, 2, 3], i = seq[(s >> (this.mode === 'calm' ? 1 : 0)) % 8], n = i === 3 ? root + 12 + 12 : root + 12 + q[i]; this.arp(t, midi(n + 12), sx * 0.9); }
    if (M.pad && s === 0) for (const iv of q) this.pad(t, midi(root + 12 + iv), sx * 16);
    if (M.lead) for (const [st, iv] of LEAD) if (st === s && (this.mode === 'title' ? bar % 2 === 1 : (bar % 2 === 0 || st < 8))) this.lead(t, midi(root + 12 + iv), sx * 1.8);
  }
  env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  osc(type, f, t, dur, out) { const c = this.a.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(out); o.start(t); o.stop(t + dur + 0.05); return o; }
  kick(t) { const c = this.a.ctx, g = c.createGain(); g.connect(this.L.drums); const o = this.osc('sine', 150, t, 0.3, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); this.env(g, t, 0.002, 1.0, 0.28); }
  snare(t, v = 1) {
    const c = this.a.ctx, g = c.createGain(), s = c.createBufferSource(), f = c.createBiquadFilter(); s.buffer = this.a.buf(0.2); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8; s.connect(f); f.connect(g); g.connect(this.L.drums); this.env(g, t, 0.002, 0.55 * v, 0.18); s.start(t);
    const g2 = c.createGain(); g2.connect(this.L.drums); this.osc('triangle', 190, t, 0.1, g2); this.env(g2, t, 0.002, 0.3 * v, 0.09);
  }
  hat(t, v, dur) { const c = this.a.ctx, g = c.createGain(), s = c.createBufferSource(), f = c.createBiquadFilter(); s.buffer = this.a.buf(0.1); f.type = 'highpass'; f.frequency.value = 7500; s.connect(f); f.connect(g); g.connect(this.L.hat); this.env(g, t, 0.001, v * 0.4, dur); s.start(t); }
  bass(t, f, dur) {
    const c = this.a.ctx, g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(180, t + dur);
    lp.connect(g); g.connect(this.L.bass); this.osc('sawtooth', f, t, dur, lp); this.osc('square', f / 2, t, dur, lp); this.env(g, t, 0.005, 0.45, dur);
  }
  arp(t, f, dur) { const c = this.a.ctx, g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(g); g.connect(this.L.arp); g.connect(this.echo); this.osc('square', f, t, dur, lp); this.env(g, t, 0.003, 0.14, dur); }
  pad(t, f, dur) {
    const c = this.a.ctx, g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(g); g.connect(this.L.pad);
    for (const d of [-7, 7]) { const o = this.osc('sawtooth', f, t, dur, lp); o.detune.value = d; }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.11, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  }
  lead(t, f, dur) {
    const c = this.a.ctx, g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 3; lp.connect(g); g.connect(this.L.lead); g.connect(this.echo);
    const o = this.osc('sawtooth', f, t, dur, lp), o2 = this.osc('sawtooth', f * 1.005, t, dur, lp); o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.04); void o2; this.env(g, t, 0.01, 0.16, dur);
  }
}

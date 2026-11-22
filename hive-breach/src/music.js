// The soundtrack: heroic orchestral sci-fi, played live. A monk-style choir (vowel-shaped voices with vibrato),
// slow-swelling strings and fast battle strings, heroic brass that blooms in, taiko, timpani and cymbal swells,
// all in a long concert-hall reverb. Original themes in D minor over Dm - Bb - F - C.
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const ROOTS = [38, 34, 41, 36], QUAL = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
// [step, semitone above D4, length in 16th steps], one phrase per bar
const CHANT = [[[0, 0, 4], [4, 2, 2], [6, 3, 2], [8, 7, 8]], [[0, 5, 4], [4, 3, 4], [8, 0, 8]], [[0, -2, 4], [4, 0, 2], [6, 3, 2], [8, 5, 4], [12, 7, 4]], [[0, 5, 6], [6, 2, 2], [8, 0, 8]]];
const THEME = [[[0, 7, 6], [6, 10, 2], [8, 12, 8]], [[0, 8, 6], [6, 7, 2], [8, 5, 8]], [[0, 3, 4], [4, 5, 4], [8, 7, 4], [12, 10, 4]], [[0, 12, 10], [10, 10, 2], [12, 7, 4]]];
const OSTI = [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 7, 0, 12, 7];
const TAIKO = [1, 0, 0, 0.5, 0, 0, 0.8, 0, 1, 0, 0, 0.5, 0, 0.7, 0.9, 0.6];
const VOWEL = { ah: [[730, 1], [1090, 0.5], [2440, 0.18]], oo: [[320, 1], [800, 0.35], [2240, 0.1]] };
const MIX = {
  off: { choir: 0, chant: 0, strings: 0, spicc: 0, brass: 0, drums: 0, timp: 0 },
  title: { choir: 0.9, chant: 1, strings: 0.7, spicc: 0, brass: 0.5, drums: 0.5, timp: 0.7 },
  calm: { choir: 0.7, chant: 0.6, strings: 0.6, spicc: 0, brass: 0, drums: 0.2, timp: 0.5 },
  battle: { choir: 0.7, chant: 0, strings: 0.6, spicc: 1, brass: 1, drums: 1, timp: 0.8 },
  boss: { choir: 1, chant: 0, strings: 0.7, spicc: 1, brass: 1, drums: 1, timp: 1 },
};
const BPM = { title: 72, calm: 72, battle: 124, boss: 132, off: 72 };
export class Music {
  constructor(audio) { this.a = audio; this.mode = 'calm'; this.on = true; this.vol = 0.75; try { const v = JSON.parse(localStorage.getItem('hb-music2') || 'null'); if (v) { this.on = v.on; this.vol = v.vol; } } catch (e) { } }
  save() { try { localStorage.setItem('hb-music2', JSON.stringify({ on: this.on, vol: this.vol })); } catch (e) { } }
  start() {
    const c = this.a.ctx; if (!c || this.master) return;
    this.master = c.createGain(); this.master.gain.value = this.on ? this.vol * 1.6 * (this.mul ?? 1) : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.02; this.master.connect(comp); comp.connect(c.destination);
    // a concert hall: a long, smooth stereo tail
    const len = c.sampleRate * 3.6, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len; lp += (Math.random() * 2 - 1 - lp) * (0.5 - t * 0.35); d[i] = lp * Math.pow(1 - t, 3) * (i < c.sampleRate * 0.02 ? i / (c.sampleRate * 0.02) : 1); } }
    this.hall = c.createConvolver(); this.hall.buffer = ir; const wet = c.createGain(); wet.gain.value = 0.55; this.hall.connect(wet); wet.connect(this.master);
    this.L = {}; for (const k of Object.keys(MIX.calm)) { const g = c.createGain(); g.gain.value = MIX[this.mode][k]; const dry = c.createGain(), send = c.createGain(); dry.gain.value = k === 'drums' ? 0.9 : 0.55; send.gain.value = k === 'drums' ? 0.35 : 0.8; g.connect(dry); dry.connect(this.master); g.connect(send); send.connect(this.hall); this.L[k] = g; }
    // two choirs: each is a bank of vowel filters every voice of that choir sings through
    this.choirBus = this.formants('choir', 'ah'); this.chantBus = this.formants('chant', 'oo');
    this.step = 0; this.next = c.currentTime + 0.1; this.bpm = BPM[this.mode]; this.timer = setInterval(() => this.tick(), 25);
  }
  formants(layer, vowel) {
    const c = this.a.ctx, input = c.createGain(), out = this.L[layer]; input.gain.value = 1; const fs = [];
    for (const [f, g] of VOWEL[vowel]) { const bp = c.createBiquadFilter(), gg = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 7; gg.gain.value = g * 2.2; input.connect(bp); bp.connect(gg); gg.connect(out); fs.push(bp); }
    return { input, fs, vowel };
  }
  vowel(bus, v, t) { VOWEL[v].forEach(([f], i) => bus.fs[i].frequency.setTargetAtTime(f, t, 0.3)); }
  set(mode) {
    if (mode === this.mode || !MIX[mode]) return; this.mode = mode; if (!this.master) return; const t = this.a.ctx.currentTime;
    for (const k in this.L) this.L[k].gain.setTargetAtTime(MIX[mode][k], t, 1.2);
    this.bpm = BPM[mode]; this.vowel(this.choirBus, mode === 'boss' || mode === 'battle' ? 'ah' : 'oo', t);
  }
  toggle() { this.on = !this.on; this.save(); if (this.master) this.master.gain.setTargetAtTime(this.on ? this.vol * 1.6 * (this.mul ?? 1) : 0, this.a.ctx.currentTime, 0.2); return this.on; }
  setVol(v) { this.vol = v; this.save(); if (this.master && this.on) this.master.gain.setTargetAtTime(v * 1.6 * (this.mul ?? 1), this.a.ctx.currentTime, 0.1); }
  tick() {
    const c = this.a.ctx; if (!c || c.state !== 'running') { if (c) this.next = c.currentTime + 0.1; return; }
    if (this.next < c.currentTime - 0.2) this.next = c.currentTime + 0.05;
    while (this.next < c.currentTime + 0.2) { this.play(this.step, this.next); this.next += 60 / this.bpm / 4; this.step = (this.step + 1) % 64; }
  }
  play(step, t) {
    if (!this.on) return;
    const bar = step >> 4, s = step & 15, root = ROOTS[bar], q = QUAL[bar], sx = 60 / this.bpm / 4, M = MIX[this.mode], fight = this.mode === 'battle' || this.mode === 'boss';
    if (s === 0) {
      // the choir holds each chord for the whole bar; the strings swell under it
      if (M.choir) for (const iv of [0, q[1], 7, 12]) this.voice(this.choirBus, midi(root + 12 + iv), sx * 16, fight ? 0.05 : 0.04);
      if (M.strings) for (const iv of [-12, 0, q[1] + 12, 19]) this.strings(t, midi(root + 12 + iv), sx * 16);
      if (M.timp) this.timpani(t, midi(root - 12 + 24) / 2, bar === 0 ? 1 : 0.6);
      if (bar === 0 && this.step === 0) this.crash(t);
    }
    if (M.chant) for (const [st, iv, l] of CHANT[bar]) if (st === s) this.voice(this.chantBus, midi(62 + iv - 12), sx * l, 0.06, 2);
    if (fight) {
      if (M.spicc) this.spicc(t, midi(root + 12 + OSTI[s]), sx * 0.9);
      if (M.brass) for (const [st, iv, l] of THEME[bar]) if (st === s) { this.brass(t, midi(62 + iv - 12), sx * l); this.brass(t, midi(62 + iv - 24), sx * l, 0.6); }
      if (M.drums && TAIKO[s]) this.taiko(t, TAIKO[s] * (this.mode === 'boss' ? 1.15 : 1));
      if (this.mode === 'boss' && s % 4 === 2) this.taiko(t, 0.4, 1.6);
    } else if (M.drums && (s === 0 || s === 10) && bar % 2 === 0) this.taiko(t, 0.5);
    if (bar === 3 && s === 8) this.swell(t, sx * 8);
  }
  // one choir note: three slightly detuned singers with vibrato, slow in and slow out
  voice(bus, f, dur, v, voices = 3) {
    const c = this.a.ctx, t = this.next, g = c.createGain(); g.connect(bus.input);
    for (let i = 0; i < voices; i++) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (i - (voices - 1) / 2) * 9 + (Math.random() - 0.5) * 6;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 4.6 + Math.random() * 0.8; lg.gain.value = f * 0.005; lfo.connect(lg); lg.connect(o.frequency); o.connect(g); o.start(t); o.stop(t + dur + 1); lfo.start(t); lfo.stop(t + dur + 1); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.5, dur * 0.3)); g.gain.setValueAtTime(v, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.8);
  }
  strings(t, f, dur) {
    const c = this.a.ctx, g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.5; lp.connect(g); g.connect(this.L.strings);
    for (const d of [-8, 0, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.2; lg.gain.value = f * 0.004; lfo.connect(lg); lg.connect(o.frequency); o.connect(lp); o.start(t); o.stop(t + dur + 1); lfo.start(t); lfo.stop(t + dur + 1); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.022, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.018, t + dur * 0.85); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
  }
  // fast battle strings: short bowed notes, a bite at the start, rounded by a filter
  spicc(t, f, dur) {
    const c = this.a.ctx, g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(900, t + dur); lp.connect(g); g.connect(this.L.spicc);
    for (const d of [-7, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.2); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.04, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
  }
  // heroic brass: a little scoop up into the note, the tone opening as it swells
  brass(t, f, dur, v = 1) {
    const c = this.a.ctx, g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2; lp.frequency.setValueAtTime(350, t); lp.frequency.linearRampToValueAtTime(1800, t + 0.18); lp.frequency.linearRampToValueAtTime(1200, t + dur); lp.connect(g); g.connect(this.L.brass);
    for (const d of [-6, 0, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.07); o.detune.value = d; const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5; lg.gain.value = f * 0.003; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t + 0.2); lfo.stop(t + dur + 0.5); o.connect(lp); o.start(t); o.stop(t + dur + 0.5); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05 * v, t + 0.12); g.gain.setValueAtTime(0.045 * v, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.35);
  }
  taiko(t, v, pitch = 1) {
    const c = this.a.ctx, g = c.createGain(); g.connect(this.L.drums); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110 * pitch, t); o.frequency.exponentialRampToValueAtTime(52 * pitch, t + 0.3); o.connect(g); o.start(t); o.stop(t + 0.75);
    const n = c.createBufferSource(), f = c.createBiquadFilter(), ng = c.createGain(); n.buffer = this.a.buf(0.15); f.type = 'lowpass'; f.frequency.value = 700; ng.gain.setValueAtTime(0.35 * v, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); n.connect(f); f.connect(ng); ng.connect(this.L.drums); n.start(t);
  }
  timpani(t, f, v) {
    const c = this.a.ctx, g = c.createGain(); g.connect(this.L.timp); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    for (const [m, a] of [[1, 1], [1.5, 0.35], [2, 0.2]]) { const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * m * 1.02, t); o.frequency.exponentialRampToValueAtTime(f * m, t + 0.2); og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(t + 2.3); }
  }
  crash(t) { const c = this.a.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); n.buffer = this.a.buf(2.5); f.type = 'highpass'; f.frequency.value = 5000; g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4); n.connect(f); f.connect(g); g.connect(this.L.timp); n.start(t); }
  swell(t, dur) { const c = this.a.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); n.buffer = this.a.buf(Math.max(0.05, dur + 0.1)); f.type = 'highpass'; f.frequency.value = 4000; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05); n.connect(f); f.connect(g); g.connect(this.L.timp); n.start(t); }
}

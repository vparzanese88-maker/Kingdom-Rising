// The soundtrack, played live: dark military sci-fi in D minor. Synth bass, drums, war drums, low brass, a tense arpeggio,
// a dark pad and a distant choir, in a short hall reverb. Original themes over Dm - Bb - C - A.
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const VOWEL = { ah: [[730, 1], [1090, 0.5], [2440, 0.18]], oo: [[320, 1], [800, 0.35], [2240, 0.1]] };
const MIX = {
  off: { choir: 0, chant: 0, strings: 0, spicc: 0, brass: 0, drums: 0, timp: 0, synth: 0 },
  drop: { choir: 0.7, chant: 0, strings: 0.7, spicc: 0.8, brass: 0.75, drums: 0.85, timp: 0.75, synth: 0.7 },
  title: { choir: 0.3, chant: 0, strings: 0.65, spicc: 0.4, brass: 0.6, drums: 0.5, timp: 0.6, synth: 0.6 },
  calm: { choir: 0.22, chant: 0, strings: 0.6, spicc: 0.35, brass: 0.35, drums: 0.4, timp: 0.4, synth: 0.55 },
  battle: { choir: 0.3, chant: 0, strings: 0.5, spicc: 0.7, brass: 0.8, drums: 0.9, timp: 0.7, synth: 0.8 },
  boss: { choir: 0.55, chant: 0, strings: 0.55, spicc: 0.8, brass: 0.9, drums: 1, timp: 0.9, synth: 0.9 },
};
const BPM = { title: 96, calm: 90, battle: 128, boss: 140, off: 90, drop: 132 };
// the drop-pod cue: D minor, D - Bb - C - A, a pulsing synth bass, war drums and a dark brass theme ([step, semitone above D4, length])
const DROOT = [38, 34, 36, 33], DQUAL = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
const DTHEME = [[[0, 0, 4], [4, 3, 2], [6, 5, 2], [8, 7, 8]], [[0, 10, 6], [6, 8, 2], [8, 5, 8]], [[0, 7, 4], [4, 10, 4], [8, 12, 8]], [[0, 13, 6], [6, 12, 2], [8, 9, 8]]];
const DBASS = [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 7, 0, 10, 12];
const DDRUM = [1, 0, 0.4, 0, 0.8, 0, 0.4, 0.5, 1, 0, 0.4, 0, 0.8, 0.5, 0.7, 0.9];
export class Music {
  constructor(audio) { this.a = audio; this.mode = 'calm'; this.on = true; this.vol = 0.75; try { const v = JSON.parse(localStorage.getItem('hb-music2') || 'null'); if (v) { this.on = v.on; this.vol = v.vol; } } catch (e) { } }
  save() { try { localStorage.setItem('hb-music2', JSON.stringify({ on: this.on, vol: this.vol })); } catch (e) { } }
  start() {
    const c = this.a.ctx; if (!c || this.master) return;
    this.master = c.createGain(); this.master.gain.value = this.on ? this.vol * 1.6 * (this.mul ?? 1) : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.02; this.master.connect(comp); comp.connect(this.a.bus || c.destination);   // through the shared limiter
    // a concert hall: a long, smooth stereo tail
    const len = c.sampleRate * 2.2, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len; lp += (Math.random() * 2 - 1 - lp) * (0.5 - t * 0.35); d[i] = lp * Math.pow(1 - t, 3) * (i < c.sampleRate * 0.02 ? i / (c.sampleRate * 0.02) : 1); } }
    this.hall = c.createConvolver(); this.hall.buffer = ir; const wet = c.createGain(); wet.gain.value = 0.55; this.hall.connect(wet); wet.connect(this.master);
    this.L = {}; for (const k of Object.keys(MIX.calm)) { const g = c.createGain(); g.gain.value = MIX[this.mode][k]; const dry = c.createGain(), send = c.createGain(); dry.gain.value = k === 'drums' ? 0.9 : 0.55; send.gain.value = k === 'drums' ? 0.35 : 0.8; g.connect(dry); dry.connect(this.master); g.connect(send); send.connect(this.hall); this.L[k] = g; }
    // two choirs: each is a bank of vowel filters every voice of that choir sings through
    this.choirBus = this.formants('choir', 'ah'); this.chantBus = this.formants('chant', 'oo');
    this.step = 0; this.next = c.currentTime + 0.1; this.bpm = BPM[this.mode]; this.timer = setInterval(() => this.tick(), 40);
  }
  // after the sound engine restarts, drop everything tied to the old one; start() builds it again on the next click
  reset() { clearInterval(this.timer); this.master = null; this.L = null; this.lock = false; if (this.mode === 'drop') this.mode = 'calm'; }
  formants(layer, vowel) {
    const c = this.a.ctx, input = c.createGain(), out = this.L[layer]; input.gain.value = 1; const fs = [];
    for (const [f, g] of VOWEL[vowel]) { const bp = c.createBiquadFilter(), gg = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 7; gg.gain.value = g * 2.2; input.connect(bp); bp.connect(gg); gg.connect(out); fs.push(bp); }
    return { input, fs, vowel };
  }
  vowel(bus, v, t) { VOWEL[v].forEach(([f], i) => bus.fs[i].frequency.setTargetAtTime(f, t, 0.3)); }
  // the game asks for a mix every frame; only switch once the new one has been wanted for a few seconds, so the music doesn't flicker in and out
  set(mode) {
    if (!MIX[mode] || this.lock) return; if (mode === this.mode) { this.want = null; return; } const now = performance.now(); if (this.want !== mode) { this.want = mode; this.wantT = now; } if (mode !== 'off' && mode !== 'title' && this.mode !== 'title' && now - this.wantT < 3500) return; this.want = null; this.mode = mode; if (!this.master) return; const t = this.a.ctx.currentTime;
    for (const k in this.L) this.L[k].gain.setTargetAtTime(MIX[mode][k], t, 1.2);
    this.bpm = BPM[mode]; this.vowel(this.choirBus, mode === 'boss' || mode === 'battle' ? 'ah' : 'oo', t);
  }
  toggle() { this.on = !this.on; this.save(); if (this.master) this.master.gain.setTargetAtTime(this.on ? this.vol * 1.6 * (this.mul ?? 1) : 0, this.a.ctx.currentTime, 0.2); return this.on; }
  setVol(v) { this.vol = v; this.save(); if (this.master && this.on) this.master.gain.setTargetAtTime(v * 1.6 * (this.mul ?? 1), this.a.ctx.currentTime, 0.1); }
  tick() {
    const c = this.a.ctx; if (!c || c.state !== 'running') { if (c) this.next = c.currentTime + 0.1; return; }
    if (this.next < c.currentTime - 0.3) this.next = c.currentTime + 0.05;
    while (this.next < c.currentTime + 2.5) { this.play(this.step, this.next); this.next += 60 / this.bpm / 4; this.step = (this.step + 1) % 64; }
  }
  // the soundtrack: dark military sci-fi in D minor (Dm - Bb - C - A). A growling synth bass, kick, snare and hats,
  // war-drum fills, low brass, a tense arpeggio and a dark pad. Calm keeps it sparse and uneasy; battle and boss drive hard.
  play(step, t) {
    if (!this.on) return; if (this.mode === 'drop') return this.playDrop(step, t);
    const bar = (step >> 4) & 3, s = step & 15, sx = 60 / this.bpm / 4, M = MIX[this.mode], mode = this.mode, fight = mode === 'battle' || mode === 'boss';
    const root = DROOT[bar], q = DQUAL[bar];
    if (s === 0) {
      if (M.strings) for (const iv of [0, q[1], 7]) this.strings(t, midi(root + 12 + iv), sx * 16);
      if (M.choir && (fight || bar % 2 === 0)) for (const iv of [0, 7]) this.voice(this.choirBus, midi(root + 24 + iv), sx * 16, 0.04, 2);
      if (M.timp) this.timpani(t, midi(root), bar === 0 ? 0.8 : 0.45);
      if (bar === 0 && fight) this.crash(t);
    }
    if (M.synth) { if (fight) this.synth(t, midi(root - 12 + DBASS[s]), sx * 0.9, 0.9); else if (s === 0 || s === 6 || s === 10) this.synth(t, midi(root - 12), sx * (s === 0 ? 5 : 3), 0.5); }
    if (M.drums) {
      if (fight) { if (s % 4 === 0) this.kick(t, 1); if (s === 4 || s === 12) this.snare(t, 1); if (mode === 'boss' && s >= 14) this.snare(t, 0.55); if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.5 : 0.3); if (bar === 3 && s >= 12) this.taiko(t, 0.8, 1 + (s - 12) * 0.15); }
      else { if (s === 0 || s === 10) this.kick(t, 0.6); if (s % 4 === 2) this.hat(t, 0.18); if (bar === 3 && s === 8) this.taiko(t, 0.5); }
    }
    if (M.spicc) { const arp = [0, q[1], 7, 12, 7, q[1]]; if (fight) this.spicc(t, midi(root + 24 + arp[s % 6]), sx * 0.8); else if (s % 4 === 0) this.spicc(t, midi(root + 24 + arp[(s / 4) % 6]), sx * 2); }
    if (M.brass) {
      if (fight) { for (const [st, iv, l] of DTHEME[bar]) if (st === s) { this.brass(t, midi(50 + iv), sx * l, 0.8); this.brass(t, midi(38 + iv), sx * l, 0.5); } }
      else if (s === 0 && bar === 0) { this.brass(t, midi(root), sx * 30, 0.45); this.brass(t, midi(root + 7), sx * 30, 0.3); }
    }
    if (bar === 3 && s === 8) this.swell(t, sx * 8);
  }
  kick(t, v) { const c = this.a.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g); g.connect(this.L.drums); o.start(t); o.stop(t + 0.4); }
  snare(t, v) { const c = this.a.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); n.buffer = this.a.buf(0.25); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7; g.gain.setValueAtTime(0.32 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); n.connect(f); f.connect(g); g.connect(this.L.drums); n.start(t);
    const o = c.createOscillator(), og = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.08); og.gain.setValueAtTime(0.18 * v, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(og); og.connect(this.L.drums); o.start(t); o.stop(t + 0.12); }
  hat(t, v) { const c = this.a.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); n.buffer = this.a.buf(0.05); f.type = 'highpass'; f.frequency.value = 7500; g.gain.setValueAtTime(0.09 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045); n.connect(f); f.connect(g); g.connect(this.L.drums); n.start(t); }
  // ---- the drop-pod score, locked to the film's clock: a tense build, a hit on EJECT, full war drums through the burn, silence at impact, a heroic chord as the door blows
  dropScore() {
    if (!this.master) this.start(); if (!this.master) return; const c = this.a.ctx, t = c.currentTime + 0.05;
    this.lock = true; this.mode = 'drop'; this.bpm = BPM.drop; for (const k in this.L) this.L[k].gain.setTargetAtTime(MIX.drop[k], t, 0.3);
    this.vowel(this.choirBus, 'oo', t); this.step = 0; this.next = t; this.sc0 = t;
    this.swell(t + 4.6, 2.4); this.hit(t + 7, 38, true); this.swell(t + 11, 2); this.hit(t + 13, 34, false); this.swell(t + 26.6, 2.4); this.hit(t + 29, 26, true); this.hit(t + 30.4, 38, 'major');
    setTimeout(() => this.vowel(this.choirBus, 'ah', c.currentTime), 7000);
  }
  endScore() { if (!this.lock) return; this.lock = false; this.mode = 'calm'; this.want = null; if (!this.master) return; const t = this.a.ctx.currentTime; for (const k in this.L) this.L[k].gain.setTargetAtTime(MIX.calm[k], t, 1.5); this.bpm = BPM.calm; }
  hit(t, root, big) { // a stab: drums, timpani, crash and a full brass chord
    this.taiko(t, 0.9, 0.8); this.taiko(t, 0.6, 1.3); this.timpani(t, midi(root), 0.8); this.crash(t);
    const iv = big === 'major' ? [0, 4, 7, 12] : [0, 3, 7, 12]; for (const i of iv) { this.brass(t, midi(root + 12 + i), big === 'major' ? 4 : 1.2, 0.55); this.brass(t, midi(root + i), big === 'major' ? 4 : 1.2, 0.4); }
    if (big === 'major') { const nx = this.next; this.next = t; for (const i of [0, 4, 7]) this.voice(this.choirBus, midi(root + 24 + i), 5, 0.08, 3); this.next = nx; }   // voice() starts at this.next
  }
  synth(t, f, dur, v) { // a growling saw bass with a filter that bites and closes
    const c = this.a.ctx, g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.setValueAtTime(180, t); lp.frequency.exponentialRampToValueAtTime(1500, t + 0.02); lp.frequency.exponentialRampToValueAtTime(220, t + dur); lp.connect(g); g.connect(this.L.synth);
    for (const [ty, m, d] of [['sawtooth', 1, -8], ['sawtooth', 1, 8], ['square', 0.5, 0]]) { const o = c.createOscillator(); o.type = ty; o.frequency.value = f * m; o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.1); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07 * v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  }
  playDrop(step, t) {
    const ft = t - this.sc0, s = step & 15, bar = (step >> 4) & 3, sx = 60 / this.bpm / 4;
    if (ft > 28.9 && ft < 30.3) return;                          // the impact: nothing but the crash
    if (ft < 7) { // the build: a heartbeat, a low pulse that grows, a held minor chord
      const k = ft / 7; if (s === 0 || s === 3) this.taiko(t, s === 0 ? 0.7 : 0.45, 0.7);
      if (s % 2 === 0) this.synth(t, midi(26), sx * 1.6, 0.35 + k * 0.6);
      if (s === 0 && bar % 2 === 0) { for (const i of [0, 3, 7]) this.voice(this.choirBus, midi(50 + i), sx * 32, 0.05, 2); this.strings(t, midi(62), sx * 32); this.strings(t, midi(65), sx * 32); }
      if (ft > 4.5) this.spicc(t, midi(74 + (s % 2) * 12), sx * 0.8);
      return;
    }
    if (ft > 30.3) { // after the door: heroic D major, then it settles toward the game's own music
      if (s === 0) { for (const i of [0, 4, 7]) this.strings(t, midi(50 + 12 + i), sx * 16); this.timpani(t, midi(38), 0.6); }
      if (s === 0 || s === 8) this.taiko(t, 0.6); return;
    }
    const root = DROOT[bar], q = DQUAL[bar], burn = ft > 13, hard = ft > 22;
    this.synth(t, midi(root - 12 + DBASS[s]), sx * 0.9, 1);
    if (DDRUM[s]) this.taiko(t, DDRUM[s] * (burn ? 1.15 : 1));
    if (burn && s % 4 === 2) this.taiko(t, 0.45, 1.7);
    if (hard && s % 2 === 1) this.taiko(t, 0.3, 2.2);
    this.spicc(t, midi(root + 24 + (s % 4 === 0 ? 0 : s % 4 === 2 ? 12 : 7)), sx * 0.8);
    for (const [st, iv, l] of DTHEME[bar]) if (st === s) { this.brass(t, midi(62 + iv - 12), sx * l); this.brass(t, midi(62 + iv - 24), sx * l, 0.7); if (burn) this.brass(t, midi(62 + iv), sx * l, 0.5); }
    if (s === 0) { this.timpani(t, midi(root), 0.9); for (const i of [0, q[1], 7]) this.voice(this.choirBus, midi(root + 24 + i + (burn ? 12 : 0)), sx * 16, 0.06, 2); this.strings(t, midi(root + 12), sx * 16); this.strings(t, midi(root + 19), sx * 16); }
  }
  // one choir note: three slightly detuned singers with vibrato, slow in and slow out
  voice(bus, f, dur, v, voices = 2) {
    const c = this.a.ctx, t = this.next, g = c.createGain(); g.connect(bus.input); const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 4.8 + Math.random() * 0.6; lg.gain.value = f * 0.005; lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 1);
    for (let i = 0; i < voices; i++) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (i - (voices - 1) / 2) * 11 + (Math.random() - 0.5) * 5; lg.connect(o.frequency); o.connect(g); o.start(t); o.stop(t + dur + 1); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.4, dur * 0.25)); g.gain.setValueAtTime(v, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.7);
  }
  strings(t, f, dur) {
    const c = this.a.ctx, g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.5; lp.connect(g); g.connect(this.L.strings);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.2; lg.gain.value = f * 0.004; lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 1); for (const d of [-7, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; lg.connect(o.frequency); o.connect(lp); o.start(t); o.stop(t + dur + 1); }
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
    for (const d of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.07); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.5); }
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

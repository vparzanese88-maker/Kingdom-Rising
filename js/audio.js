// Kingdom Rising — procedural orchestral music, creature voices and sound effects (Web Audio)
(function () {
  const KR = (window.KR = window.KR || {});
  const A = (KR.A = {});
  let ctx = null, master, musicBus, sfxBus, noiseBuf, reverb, revIn;
  A.musicVol = 0.5; A.sfxVol = 0.7; A.enabled = false;
  A.track = null; let trackGain = null; let nextNote = 0; let step = 0; let curTrack = null;

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3; comp.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = A.musicVol * 0.6; musicBus.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = A.sfxVol; sfxBus.connect(master);
    // smooth hall reverb shared by music and effects
    reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { lp = lp * 0.55 + (Math.random() * 2 - 1) * 0.45; d[i] = lp * Math.pow(1 - i / len, 3) * (i < 300 ? i / 300 : 1); } }
    reverb.buffer = ir; revIn = ctx.createGain(); revIn.gain.value = 1; revIn.connect(reverb);
    const rg = ctx.createGain(); rg.gain.value = 0.5; reverb.connect(rg); rg.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    A.enabled = true;
    setInterval(schedule, 50);
  };
  A.setVolumes = function (m, s) {
    A.musicVol = m; A.sfxVol = s;
    if (musicBus) musicBus.gain.setTargetAtTime(m * 0.6, ctx.currentTime, 0.1);
    if (sfxBus) sfxBus.gain.setTargetAtTime(s, ctx.currentTime, 0.05);
  };

  // =====================================================================
  // synthesis building blocks
  // =====================================================================
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function send(g, amt) { if (amt && revIn) { const s = ctx.createGain(); s.gain.value = amt; g.connect(s); s.connect(revIn); } }
  // one oscillator voice with envelope, filter, vibrato and reverb send
  function voice(dest, f, t, dur, o = {}) {
    const os = ctx.createOscillator(); os.type = o.type || 'sine'; os.frequency.setValueAtTime(f, t); if (o.detune) os.detune.value = o.detune;
    if (o.slide) os.frequency.exponentialRampToValueAtTime(Math.max(20, f * o.slide), t + (o.slideT || dur));
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vibRate || 5.3; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * o.vib, t + (o.vibDelay != null ? o.vibDelay : 0.2) + 0.25); l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + dur + (o.r || 0.3) + 0.2); }
    let node = os;
    if (o.lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = o.q || 0.7; if (Array.isArray(o.lp)) { fl.frequency.value = o.lp[0]; fl.frequency.setValueAtTime(o.lp[0], t); fl.frequency.exponentialRampToValueAtTime(o.lp[1], t + o.lp[2]); if (o.lp[3]) fl.frequency.setTargetAtTime(o.lp[3], t + o.lp[2], 0.2); } else fl.frequency.value = o.lp; node.connect(fl); node = fl; }
    if (o.hp) { const fl = ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = o.hp; node.connect(fl); node = fl; }
    const g = ctx.createGain(); const v = o.v || 0.05, a = o.a || 0.005, r = o.r || 0.2;
    g.gain.value = 0; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
    if (o.dec) g.gain.setTargetAtTime(v * (o.sus != null ? o.sus : 0.6), t + a, o.dec / 3);
    g.gain.setTargetAtTime(0.0001, t + Math.max(a, dur), r / 4);
    if (o.formants) { const out = ctx.createGain(); out.gain.value = 1; for (const [ff, qq, gg] of o.formants) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = qq; const fg = ctx.createGain(); fg.gain.value = gg; node.connect(bp); bp.connect(fg); fg.connect(out); } node = out; }
    node.connect(g); g.connect(dest); send(g, o.rev);
    os.start(t); os.stop(t + Math.max(a, dur) + r + 0.1);
    return os;
  }
  function noise(dest, t, dur, vol, o = {}) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.f || 1200;
    if (o.f2) { f.frequency.setValueAtTime(o.f || 1200, t); f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.fT || dur)); } f.Q.value = o.q || 1;
    const g = ctx.createGain(); g.gain.value = 0; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); send(g, o.rev);
    s.start(t, Math.random() * 1.2); s.stop(t + dur + 0.05);
  }
  // FM voice: bells, electric piano, steel pan, celesta
  function fm(dest, f, t, dur, o = {}) {
    const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    c.frequency.value = f; m.frequency.value = f * (o.ratio || 1); const idx = f * (o.index || 1.5);
    mg.gain.setValueAtTime(idx, t); mg.gain.exponentialRampToValueAtTime(Math.max(0.01, idx * (o.indexEnd || 0.05)), t + (o.indexT || dur * 0.6));
    m.connect(mg); mg.connect(c.frequency);
    const v = o.v || 0.05; g.gain.value = 0; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    c.connect(g); g.connect(dest); send(g, o.rev != null ? o.rev : 0.3);
    c.start(t); m.start(t); c.stop(t + dur + 0.05); m.stop(t + dur + 0.05);
  }
  // Karplus-Strong plucked strings, rendered once per pitch and cached
  const pcache = {};
  function pluckBuffer(n, bright, dur) {
    const key = n + '|' + bright + '|' + dur; if (pcache[key]) return pcache[key];
    const sr = ctx.sampleRate, f = midi(n), N = Math.max(2, Math.round(sr / f)), L = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, L, sr), out = buf.getChannelData(0), ring = new Float32Array(N);
    let prev = 0; for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; prev = prev * (1 - bright) + r * bright; ring[i] = prev; }
    const decay = Math.pow(0.001, 1 / (f * dur)) ; const s = 0.5; let idx = 0, peak = 0;
    for (let i = 0; i < L; i++) { const a = ring[idx], b = ring[(idx + 1) % N]; out[i] = a; ring[idx] = decay * (a * (1 - s) + b * s); idx = (idx + 1) % N; const ab = Math.abs(a); if (ab > peak) peak = ab; }
    const nrm = peak > 0 ? 0.9 / peak : 1; for (let i = 0; i < L; i++) out[i] *= nrm;
    pcache[key] = buf; return buf;
  }
  function pluck(dest, n, t, v = 0.08, bright = 0.5, dur = 1.4, rev = 0.3) {
    const src = ctx.createBufferSource(); src.buffer = pluckBuffer(Math.round(n), bright, dur);
    const g = ctx.createGain(); g.gain.value = v; src.connect(g); g.connect(dest); send(g, rev); src.start(t);
  }

  // ---------- the orchestra ----------
  const I = {
    strings: (d, n, t, dur, v = 0.03) => { const f = midi(n); for (const dt of [-9, 0, 8]) voice(d, f, t, dur, { type: 'sawtooth', detune: dt, v: v / 3, a: Math.min(0.35, dur * 0.3), r: 0.6, lp: Math.min(3200, f * 3.2), vib: dt === 0 ? 0.004 : 0, vibDelay: 0.3, rev: 0.45 }); },
    stac: (d, n, t, len, v = 0.03) => { const f = midi(n); voice(d, f, t, len, { type: 'sawtooth', v: v * 1.3, a: 0.004, r: 0.06, lp: Math.min(2600, f * 4), rev: 0.15 }); },
    tremolo: (d, n, t, dur, v = 0.02, rate = 0.0625) => { for (let x = 0; x < dur - 0.01; x += rate) voice(d, midi(n), t + x, rate * 0.8, { type: 'sawtooth', v, a: 0.004, r: 0.03, lp: 900, rev: 0.25 }); },
    brass: (d, n, t, dur, v = 0.035) => { const f = midi(n); voice(d, f, t, dur, { type: 'sawtooth', v: v * 1.3, a: 0.05, dec: 0.3, sus: 0.75, r: 0.25, lp: [Math.max(200, f * 0.8), Math.min(3400, f * 5), 0.12, Math.min(2400, f * 3)], vib: dur > 0.5 ? 0.003 : 0, vibDelay: 0.35, rev: 0.35 }); },
    horn: (d, n, t, dur, v = 0.04) => { const f = midi(n); voice(d, f, t, dur, { type: 'sawtooth', v, a: 0.07, dec: 0.4, sus: 0.8, r: 0.35, lp: [Math.max(150, f * 0.6), Math.min(1800, f * 2.6), 0.18, Math.min(1400, f * 2.1)], vib: 0.0035, vibDelay: 0.4, rev: 0.5 }); voice(d, f / 2, t, dur, { type: 'triangle', v: v * 0.35, a: 0.07, r: 0.35 }); },
    flute: (d, n, t, dur, v = 0.05) => { const f = midi(n); voice(d, f, t, dur, { type: 'sine', v, a: 0.07, r: 0.25, vib: 0.006, vibDelay: 0.25, rev: 0.45 }); voice(d, f * 2, t, dur, { type: 'triangle', v: v * 0.07, a: 0.08, r: 0.2 }); noise(d, t, 0.12, v * 0.35, { f: f * 2, q: 3, attack: 0.02, rev: 0.2 }); },
    ney: (d, n, t, dur, v = 0.05) => { const f = midi(n); voice(d, f, t, dur, { type: 'sine', v, a: 0.12, r: 0.3, vib: 0.009, vibDelay: 0.2, vibRate: 4.6, rev: 0.5 }); noise(d, t, dur * 0.9, v * 0.18, { f: f * 1.5, q: 1.5, attack: 0.1, rev: 0.3 }); },
    clarinet: (d, n, t, dur, v = 0.03) => { const f = midi(n); voice(d, f, t, dur, { type: 'square', v, a: 0.04, r: 0.18, lp: Math.min(2400, f * 3), vib: 0.003, vibDelay: 0.3, rev: 0.35 }); },
    oboe: (d, n, t, dur, v = 0.022) => { const f = midi(n); voice(d, f, t, dur, { type: 'sawtooth', v, a: 0.05, r: 0.15, formants: [[1100, 4, 1.2], [2600, 5, 0.6]], vib: 0.004, vibDelay: 0.25, rev: 0.4 }); },
    choir: (d, n, t, dur, v = 0.03, vowel = 'a') => { const f = midi(n); const F = vowel === 'o' ? [[420, 9, 1.4], [780, 10, 0.8], [2800, 12, 0.25]] : vowel === 'u' ? [[330, 9, 1.4], [700, 10, 0.6], [2600, 12, 0.2]] : [[750, 8, 1.3], [1150, 10, 0.9], [2900, 12, 0.3]]; for (const dt of [-7, 6]) voice(d, f, t, dur, { type: 'sawtooth', detune: dt, v: v / 2, a: Math.min(0.6, dur * 0.35), r: 1.0, formants: F, vib: 0.005, vibDelay: 0.2, vibRate: 4.8, rev: 0.7 }); },
    harp: (d, n, t, v = 0.07) => pluck(d, n, t, v, 0.62, 2.4, 0.45),
    lute: (d, n, t, v = 0.07) => pluck(d, n, t, v, 0.42, 1.3, 0.25),
    oud: (d, n, t, v = 0.07) => pluck(d, n, t, v, 0.3, 1.1, 0.3),
    guitar: (d, n, t, v = 0.06) => pluck(d, n, t, v, 0.5, 1.8, 0.3),
    pizz: (d, n, t, v = 0.06) => pluck(d, n, t, v, 0.35, 0.5, 0.35),
    epiano: (d, n, t, dur, v = 0.04) => { const f = midi(n); fm(d, f, t, Math.max(0.8, dur + 0.6), { ratio: 1, index: 1.6, indexEnd: 0.08, indexT: 0.5, v, rev: 0.3 }); voice(d, f * 4, t, 0.08, { v: v * 0.12, r: 0.1 }); },
    celesta: (d, n, t, v = 0.03) => fm(d, midi(n), t, 1.4, { ratio: 3.5, index: 0.8, indexEnd: 0.05, indexT: 0.4, v, rev: 0.5 }),
    musicbox: (d, n, t, v = 0.03, wobble = 0) => { fm(d, midi(n) * (1 + wobble * (Math.random() - 0.5)), t, 1.8, { ratio: 5.2, index: 0.5, indexEnd: 0.05, indexT: 0.3, v, rev: 0.6 }); },
    bell: (d, n, t, v = 0.05, dur = 4) => { fm(d, midi(n), t, dur, { ratio: 1.41, index: 2.5, indexEnd: 0.1, indexT: dur * 0.7, v, rev: 0.7 }); },
    marimba: (d, n, t, v = 0.05) => { const f = midi(n); voice(d, f, t, 0.05, { v, r: 0.5 }); voice(d, f * 4, t, 0.01, { v: v * 0.3, r: 0.06 }); noise(d, t, 0.02, v * 0.3, { f: f * 3, q: 2 }); },
    pan: (d, n, t, v = 0.045) => fm(d, midi(n), t, 0.9, { ratio: 2, index: 1.2, indexEnd: 0.05, indexT: 0.25, v, rev: 0.3 }),
    accordion: (d, n, t, dur, v = 0.02) => { const f = midi(n); voice(d, f, t, dur, { type: 'square', v, a: 0.03, r: 0.1, lp: 2000, rev: 0.2 }); voice(d, f, t, dur, { type: 'sawtooth', detune: 9, v: v * 0.7, a: 0.03, r: 0.1, lp: 1800 }); },
    organ: (d, n, t, dur, v = 0.025) => { const f = midi(n); [[1, 1.1], [2, 0.6]].forEach(([h, g]) => voice(d, f * h, t, dur, { type: 'sine', v: v * g, a: 0.03, r: 0.3, rev: 0.6 })); },
    bass: (d, n, t, dur, v = 0.09) => { const f = midi(n); voice(d, f, t, dur, { type: 'triangle', v, a: 0.006, dec: 0.4, sus: 0.6, r: 0.12, lp: 700 }); voice(d, f, t, dur, { type: 'sine', v: v * 0.6, a: 0.01, r: 0.12 }); },
    cello: (d, n, t, dur, v = 0.04) => { const f = midi(n); voice(d, f, t, dur, { type: 'sawtooth', v, a: 0.06, r: 0.3, lp: Math.min(900, f * 4), vib: 0.004, vibDelay: 0.3, rev: 0.3 }); voice(d, f, t, dur, { type: 'triangle', v: v * 0.6, a: 0.05, r: 0.3 }); },
    drone: (d, n, t, dur, v = 0.035) => { const f = midi(n); const os = voice(d, f, t, dur, { type: 'sawtooth', v, a: dur * 0.3, r: 1.5, lp: 260, q: 4, rev: 0.4 }); voice(d, f * 1.498, t, dur, { type: 'sawtooth', v: v * 0.4, a: dur * 0.3, r: 1.5, lp: 320, rev: 0.4 }); },
    glass: (d, n, t, dur, v = 0.02) => { const f = midi(n); voice(d, f, t, dur, { v, a: 0.25, r: 1.6, rev: 0.8 }); voice(d, f * 2.01, t, dur, { v: v * 0.25, a: 0.3, r: 1.2, rev: 0.8 }); },
    // percussion
    kick: (d, t, v = 0.3) => voice(d, 120, t, 0.02, { v, r: 0.28, slide: 0.35, slideT: 0.12 }),
    taiko: (d, t, v = 0.35) => { voice(d, 80, t, 0.02, { v, r: 0.55, slide: 0.5, slideT: 0.3, rev: 0.25 }); noise(d, t, 0.18, v * 0.35, { f: 250, type: 'lowpass', rev: 0.2 }); },
    timp: (d, t, v = 0.25, n = 38) => { const f = midi(n); voice(d, f, t, 0.02, { v, r: 1.0, slide: 0.94, slideT: 0.5, rev: 0.4 }); voice(d, f * 1.5, t, 0.02, { v: v * 0.25, r: 0.5, rev: 0.3 }); noise(d, t, 0.15, v * 0.25, { f: 200, q: 1 }); },
    roll: (d, t, dur, v = 0.12, n = 38) => { for (let x = 0; x < dur; x += 0.06) I.timp(d, t + x, v * (0.4 + 0.6 * (x / dur)), n); },
    snare: (d, t, v = 0.12) => { noise(d, t, 0.16, v, { f: 2200, q: 0.7, rev: 0.15 }); voice(d, 190, t, 0.01, { type: 'triangle', v: v * 0.4, r: 0.08 }); },
    ghost: (d, t, v = 0.04) => noise(d, t, 0.06, v, { f: 2600, q: 0.8 }),
    brush: (d, t, v = 0.03) => noise(d, t, 0.14, v, { f: 3200, q: 0.5, attack: 0.03 }),
    shaker: (d, t, v = 0.018) => noise(d, t, 0.07, v, { f: 6500, type: 'highpass', attack: 0.02 }),
    tamb: (d, t, v = 0.025) => { noise(d, t, 0.16, v, { f: 8500, type: 'highpass' }); noise(d, t + 0.02, 0.12, v * 0.6, { f: 6000, q: 6 }); },
    hat: (d, t, v = 0.02) => noise(d, t, 0.04, v, { f: 8000, type: 'highpass' }),
    bodhran: (d, t, v = 0.15) => { voice(d, 105, t, 0.01, { v, r: 0.22, slide: 0.65, slideT: 0.15 }); noise(d, t, 0.05, v * 0.25, { f: 700 }); },
    dum: (d, t, v = 0.18) => voice(d, 120, t, 0.01, { v, r: 0.3, slide: 0.75, slideT: 0.2 }),
    tek: (d, t, v = 0.05) => { noise(d, t, 0.05, v, { f: 3600, q: 2 }); voice(d, 760, t, 0.005, { v: v * 0.4, r: 0.03 }); },
    conga: (d, t, v = 0.08, hi = 0) => voice(d, hi ? 330 : 220, t, 0.01, { v, r: 0.18, slide: 0.9, slideT: 0.1 }),
    cymbal: (d, t, v = 0.035) => noise(d, t, 2.2, v, { f: 5200, type: 'highpass', rev: 0.4 }),
    scrape: (d, t, v = 0.025) => noise(d, t, 1.4, v, { f: 400, f2: 1800, q: 9, attack: 0.3, rev: 0.6 }),
    drip: (d, t, v = 0.03) => voice(d, 1700 + Math.random() * 600, t, 0.01, { v, r: 0.1, slide: 0.55, slideT: 0.08, rev: 0.7 }),
    frog: (d, t, v = 0.04) => { for (let i = 0; i < 2; i++) voice(d, 140 + Math.random() * 40, t + i * 0.09, 0.03, { type: 'square', v, r: 0.05, lp: 500, slide: 1.3, slideT: 0.05 }); },
    bird: (d, t, v = 0.012) => { const f0 = 2600 + Math.random() * 1400; for (let i = 0; i < 3; i++) voice(d, f0 * (1 + i * 0.08), t + i * 0.07, 0.04, { v, r: 0.05, slide: 1.15, slideT: 0.04, rev: 0.5 }); },
  };

  // =====================================================================
  // composition helpers
  // =====================================================================
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], hminor: [0, 2, 3, 5, 7, 8, 11], dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10], phrygdom: [0, 1, 4, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11] };
  const CH = { I: [0, 4, 7], ii: [2, 5, 9], iii: [4, 7, 11], IV: [5, 9, 12], V: [7, 11, 14], vi: [9, 12, 16], II: [2, 6, 9], i: [0, 3, 7], iv: [5, 8, 12], v: [7, 10, 14], VI: [8, 12, 15], III: [3, 7, 10], VII: [10, 14, 17], bVII: [10, 14, 17], bII: [1, 5, 8], bVI: [8, 12, 15], bIII: [3, 7, 10], bvii: [10, 13, 17],
    IM7: [0, 4, 7, 11], vi7: [9, 12, 16, 19], ii7: [2, 5, 9, 12], V7: [7, 11, 14, 17], IVM7: [5, 9, 12, 16], iii7: [4, 7, 11, 14], i7: [0, 3, 7, 10], V9: [7, 11, 14, 17, 21] };
  const deg = (sc, tok) => { const sharp = tok.endsWith('#') ? 1 : tok.endsWith('b') ? -1 : 0; const dg = parseInt(tok, 10); const z = dg - 1; const S = SCALES[sc]; return S[((z % 7) + 7) % 7] + 12 * Math.floor(z / 7) + sharp; };
  // song: sections of chords (one per bar) and melody (degree:eighths), arranged by `order`; `arr` plays each eighth
  function song(cfg) {
    const per = cfg.per || 8; const bars = [];
    for (const name of cfg.order) {
      const sec = cfg.sec[name]; const mel = new Array(sec.prog.length * per).fill(null); let pos = 0;
      if (sec.mel) for (const tok of sec.mel.trim().split(/\s+/)) { if (tok === '|') continue; const [a, l] = tok.split(':'); const L = +l || 1; if (a !== '-' && pos < mel.length) mel[pos] = { n: deg(cfg.scale || 'major', a), l: L }; pos += L; }
      sec.prog.forEach((c, i) => bars.push({ sec: name, ch: CH[c], mel: mel.slice(i * per, i * per + per), first: i === 0, last: i === sec.prog.length - 1 }));
    }
    const steps = bars.length * per;
    return { bpm: cfg.bpm, steps, gain: cfg.gain || 1, play(s, t, d, b) {
      const i = s % steps, bi = Math.floor(i / per), st = i % per, B = bars[bi], K = cfg.key;
      const mm = B.mel[st];
      cfg.arr({ s, i, st, bi, B, sec: B.sec, K, ch: B.ch.map((x) => K + x), root: K + B.ch[0], m: mm ? K + mm.n + (cfg.oct != null ? cfg.oct : 12) : null, ml: mm ? mm.l * b : 0, t, d, b, loop: Math.floor(s / steps), per });
    } };
  }
  const arp = (ch, k) => ch[k % ch.length] + 12 * Math.floor(k / ch.length);

  // =====================================================================
  // the soundtrack
  // =====================================================================
  const TRACKS = {
    // Valenmoor: warm, inviting, hummable. Lute arpeggios, soft strings, flute and clarinet, light shaker
    town_crown: song({ key: 50, bpm: 88, order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['I', 'vi', 'IV', 'V'], mel: '3:2 4:1 5:1 5:2 3:2 | 6:3 5:1 3:4 | 4:2 6:2 5:2 4:2 | 3:2 2:2 -:4' },
      A2: { prog: ['I', 'vi', 'ii', 'V'], mel: '3:2 4:1 5:1 5:2 8:2 | 7:3 6:1 5:4 | 4:2 6:2 5:2 2:2 | 1:6 -:2' },
      B: { prog: ['IV', 'V', 'iii', 'vi'], mel: '6:2 5:1 4:1 6:2 8:2 | 7:2 5:2 2:4 | 5:2 4:1 3:1 5:2 7:2 | 6:6 -:2' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, sec, loop } = x;
        if (st === 0) { ch.forEach((n, k) => I.strings(d, n + 12, t, b * 8.2, 0.014 - k * 0.002)); I.cello(d, root - 12, t, b * 3.8, 0.03); }
        if (st === 4) I.cello(d, ch[2] - 12, t, b * 3.8, 0.025);
        I.lute(d, arp(ch, [0, 1, 2, 3, 2, 1, 2, 1][st]) + 12, t, st % 2 ? 0.035 : 0.05);
        if (st % 2 === 1) I.shaker(d, t, 0.012); if (st === 4) I.tamb(d, t, 0.014);
        if (m) { if (sec === 'B') I.strings(d, m + 12, t, ml * 0.95, 0.03); else if (loop % 2) { I.lute(d, m + 12, t, 0.08); I.cello(d, m - 12, t, ml * 0.95, 0.018); } else { I.lute(d, m + 12, t, 0.08); I.strings(d, m, t, ml * 0.95, 0.02); } }
      } }),
    // Aelindor: dreamy elven lydian. Harp, flute, soft choir, celesta sparkles
    town_sylvan: song({ key: 53, bpm: 76, scale: 'lydian', order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['IM7', 'II', 'IM7', 'vi'], mel: '5:3 6:1 7:2 9:2 | 8:4 6:2 5:2 | 3:2 5:2 6:2 5:2 | 3:6 -:2' },
      A2: { prog: ['IM7', 'II', 'IVM7', 'V'], mel: '5:3 6:1 7:2 9:2 | 10:4 9:2 8:2 | 6:2 8:2 9:2 7:2 | 8:6 -:2' },
      B: { prog: ['vi', 'iii', 'IV', 'II'], mel: '6:4 5:2 3:2 | 5:4 3:2 2:2 | 1:2 3:2 4:2 6:2 | 5:6 -:2' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, loop } = x;
        I.harp(d, arp(ch, [0, 1, 2, 3, 4, 3, 2, 1][st]) + 12, t, 0.045);
        if (st === 0) { I.choir(d, ch[0] + 12, t, b * 8, 0.012, 'o'); I.choir(d, ch[1] + 12, t, b * 8, 0.01, 'o'); I.bass(d, root - 12, t, b * 6, 0.05); }
        if (st === 7 && x.bi % 2 === 1) I.harp(d, ch[2] + 24, t, 0.02);
        if (m) { I.harp(d, m + 12, t, 0.075); if (loop % 2 === 0 || x.sec === 'B') I.strings(d, m, t, ml * 0.95, 0.018); }
      } }),
    // ports: breezy sea-shanty lilt with accordion and lute
    harbor: song({ key: 55, bpm: 100, order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['I', 'IV', 'V', 'I'], mel: '5:1 5:1 6:1 5:1 3:2 1:2 | 4:2 6:2 5:4 | 5:1 5:1 6:1 5:1 7:2 5:2 | 8:6 -:2' },
      A2: { prog: ['I', 'IV', 'V', 'I'], mel: '8:1 7:1 6:1 5:1 6:2 4:2 | 5:2 3:2 1:4 | 2:2 4:2 7:2 5:2 | 8:6 -:2' },
      B: { prog: ['vi', 'IV', 'ii', 'V'], mel: '6:2 8:2 10:2 8:2 | 9:4 8:2 6:2 | 7:2 6:2 4:2 2:2 | 5:6 -:2' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, loop } = x;
        if (st === 0 || st === 4) I.bass(d, (st === 0 ? root : ch[2]) - 12, t, b * 1.8, 0.07);
        if (st === 2 || st === 6) ch.forEach((n) => I.accordion(d, n + 12, t, b * 1.6, 0.008));
        if (st % 2 === 1) I.lute(d, ch[st % 3] + 24, t, 0.03);
        if (st === 0 || st === 4) I.bodhran(d, t, 0.08); if (st % 2 === 1) I.shaker(d, t, 0.01);
        if (m) { if (loop % 2) I.accordion(d, m, t, ml * 0.9, 0.018); else { I.lute(d, m + 12, t, 0.08); I.accordion(d, m, t, ml * 0.9, 0.01); } }
      } }),
    // merchants: calm, relaxed bartering. Electric-piano chords, plucked guitar, music box, brushes
    shop: song({ key: 60, bpm: 80, order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['IM7', 'vi7', 'ii7', 'V7'], mel: '5:2 3:2 6:3 5:1 | 3:6 -:2 | 4:2 6:2 8:3 7:1 | 5:6 -:2' },
      A2: { prog: ['IM7', 'vi7', 'IVM7', 'V7'], mel: '5:2 3:2 6:3 5:1 | 8:4 7:2 6:2 | 4:2 5:2 6:2 2:2 | 1:6 -:2' },
      B: { prog: ['IVM7', 'iii7', 'ii7', 'V7'], mel: '6:3 5:1 4:2 3:2 | 5:3 4:1 3:2 2:2 | 4:2 3:2 2:2 1:2 | 2:6 -:2' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, loop } = x;
        if (st === 0 || st === 3) ch.forEach((n) => I.epiano(d, n, t, b * 2.5, 0.016));
        if (st === 0) I.bass(d, root - 12, t, b * 2.8, 0.06); if (st === 4) I.bass(d, ch[2] - 12, t, b * 2.8, 0.05);
        if (st === 2 || st === 6) I.guitar(d, ch[1] + 12, t, 0.025);
        if (st % 2 === 0) I.brush(d, t, st === 4 ? 0.025 : 0.014);
        if (m) { if (loop % 2) I.guitar(d, m + 12, t, 0.07); else I.epiano(d, m + 12, t, ml, 0.032); }
      } }),
    // taverns: jaunty 6/8 jig, lute boom-chick, fiddle and flute, bodhrán
    inn: song({ key: 62, bpm: 160, per: 6, order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['I', 'IV', 'I', 'V'], mel: '1:1 2:1 3:1 5:2 3:1 | 4:2 6:1 5:2 4:1 | 3:1 2:1 1:1 3:2 5:1 | 2:3 -:3' },
      A2: { prog: ['I', 'IV', 'V', 'I'], mel: '5:1 6:1 5:1 8:2 5:1 | 6:2 4:1 6:2 8:1 | 7:1 6:1 5:1 4:1 3:1 2:1 | 1:3 -:3' },
      B: { prog: ['vi', 'IV', 'V', 'I'], mel: '6:2 5:1 6:2 8:1 | 8:2 6:1 4:2 6:1 | 5:1 4:1 3:1 2:2 5:1 | 8:3 -:3' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, loop } = x;
        if (st === 0) I.lute(d, root - 12, t, 0.07); if (st === 3) I.lute(d, ch[2] - 12, t, 0.06);
        if (st === 1 || st === 2 || st === 4 || st === 5) { I.lute(d, ch[1], t, 0.035); I.lute(d, ch[2], t + 0.01, 0.03); }
        if (st === 0 || st === 3) I.bodhran(d, t, st === 0 ? 0.13 : 0.08); if (st === 5) I.ghost(d, t, 0.02);
        if (m) { if (loop % 2) I.lute(d, m + 12, t, 0.08); else I.stac(d, m + 12, t, ml * 0.8, 0.022); }
      } }),
    // inside homes: lullaby
    house: song({ key: 53, bpm: 66, order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['I', 'iii', 'IV', 'V'], mel: '3:4 2:2 1:2 | 2:4 3:4 | 4:4 6:2 5:2 | 3:8' },
      A2: { prog: ['I', 'vi', 'IV', 'V'], mel: '3:4 5:2 6:2 | 5:4 3:4 | 4:2 3:2 2:2 1:2 | 2:8' },
      B: { prog: ['IV', 'I', 'ii', 'V'], mel: '6:4 5:2 4:2 | 3:4 5:4 | 4:2 3:2 2:2 3:2 | 5:8' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml } = x;
        I.epiano(d, arp(ch, [0, 1, 2, 1, 3, 1, 2, 1][st]) + 12, t, b * 1.5, st === 0 ? 0.022 : 0.014);
        if (st === 0) { I.strings(d, root + 12, t, b * 8, 0.01); I.bass(d, root - 12, t, b * 7, 0.04); }
        if (m) I.epiano(d, m + 12, t, ml, 0.028);
      } }),
    // combat: fast, driving, heroic minor. 16th string ostinato, 3-3-2 accents with low brass and taiko, horns on top
    combat: song({ key: 52, bpm: 160, scale: 'minor', order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['i', 'VI', 'III', 'VII'], mel: '5:2 5:1 6:1 7:2 5:2 | 8:6 7:1 6:1 | 5:2 3:2 5:2 7:2 | 4:6 -:2' },
      A2: { prog: ['i', 'VI', 'iv', 'V'], mel: '5:2 5:1 6:1 7:2 8:2 | 10:6 9:1 8:1 | 7:2 6:2 5:2 4:2 | 5:6 -:2' },
      B: { prog: ['iv', 'v', 'VI', 'VII'], mel: '8:4 7:2 6:2 | 7:4 6:2 5:2 | 6:2 5:2 4:2 3:2 | 2:4 5:4' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, loop, bi, B } = x; const intro = loop === 0 && bi < 4;
        const pat = [0, 0, 2, 0, 1, 0, 2, 0]; for (let h = 0; h < 2; h++) I.stac(d, ch[pat[(st * 2 + h) % 8]] + 12, t + h * b / 2, b * 0.4, h ? 0.012 : 0.016);
        const acc = st === 0 || st === 3 || st === 6;
        if (acc) { I.brass(d, root, t, b * 0.9, st === 0 ? 0.034 : 0.026); I.taiko(d, t, st === 0 ? 0.3 : 0.2); I.bass(d, root - 12, t, b * 1.2, 0.08); }
        if (st === 4) I.snare(d, t, 0.1); if (st === 7) I.ghost(d, t, 0.03); I.hat(d, t, 0.012);
        if (B.first && st === 0 && (bi === 4 || bi === 8)) I.cymbal(d, t, 0.04);
        if (B.last && st >= 4) I.timp(d, t, 0.12, root - 12);
        if (m && !intro) { if (x.sec === 'B') I.strings(d, m + 12, t, ml * 0.95, 0.032); else { I.horn(d, m, t, ml * 0.95, 0.04); if (loop % 2) I.horn(d, m - 12, t, ml * 0.95, 0.02); } }
      } }),
    // bosses: relentless harmonic minor with choir and organ, heavier drums
    boss: song({ key: 50, bpm: 168, scale: 'hminor', order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['i', 'bII', 'i', 'V'], mel: '5:4 6:4 | 5:2 4:2 3:4 | 1:2 3:2 5:2 8:2 | 7:8' },
      A2: { prog: ['i', 'VI', 'bII', 'V'], mel: '8:4 7:2 6:2 | 5:4 3:4 | 6:2 5:2 4:2 3:2 | 0:8' },
      B: { prog: ['iv', 'V', 'VI', 'V'], mel: '4:3 5:1 6:4 | 7:3 6:1 5:4 | 6:3 7:1 8:4 | 7:6 5:2' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, B } = x;
        I.stac(d, root + 12, t, b * 0.4, 0.016); I.stac(d, ch[2] + 12, t + b / 2, b * 0.4, 0.012);
        if (st === 0) { ch.forEach((n) => I.organ(d, n + 12, t, b * 8, 0.01)); I.choir(d, root + 12, t, b * 8, 0.02, 'a'); }
        if (st % 2 === 0) { I.taiko(d, t, st === 0 ? 0.34 : 0.18); I.bass(d, root - 12, t, b * 0.9, 0.07); }
        if (st === 3 || st === 7) I.taiko(d, t, 0.14); if (st === 4) I.snare(d, t, 0.12);
        if (B.first && st === 0) I.cymbal(d, t, 0.045);
        if (m) I.brass(d, m, t, ml * 0.95, 0.04);
      } }),
    // caves and dungeons: dangerous. Harmonic minor drone, half-step chord clash, pizzicato heartbeat, sparse eerie lead
    dungeon: song({ key: 45, bpm: 64, scale: 'hminor', order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['i', 'bII', 'i', 'V'], mel: '-:4 5:2 6:2 | 5:8 | -:8 | 3:4 2:2 0:2' },
      A2: { prog: ['i', 'bII', 'iv', 'V'], mel: '-:8 | 8:4 7:4 | 6:6 -:2 | 5:8' },
      B: { prog: ['VI', 'bII', 'V', 'V'], mel: '3:4 4:4 | 2:8 | -:4 7:2 6:2 | 7:8' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, bi } = x;
        if (st === 0) { I.drone(d, root - 12, t, b * 8.4, 0.035); I.tremolo(d, root, t, b * 8, 0.006, b / 2); I.tremolo(d, ch[1], t, b * 8, 0.004, b / 2); }
        if (st === 0 || st === 1) I.pizz(d, root - (st ? 0 : 12), t, st ? 0.04 : 0.06);
        if (st === 0 && bi % 2 === 0) I.taiko(d, t, 0.16);
        if (st === 0 && bi % 4 === 0) I.choir(d, ch[0] + 12, t, b * 14, 0.012, 'u');
        if (st === 6 && Math.random() < 0.25) I.drip(d, t, 0.02);
        if (st === 3 && bi % 4 === 2) I.scrape(d, t, 0.02);
        if (m) { if (x.loop % 2) I.cello(d, m - 12, t, ml * 0.95, 0.035); else I.horn(d, m - 12, t, ml * 0.95, 0.03); }
      } }),
    // crypts and undead lands: tolling bells, phrygian choir, detuned music box
    crypt: song({ key: 52, bpm: 58, gain: 1.6, scale: 'phryg', order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['i', 'bII', 'i', 'bII'], mel: '5:4 6:4 | 5:6 -:2 | 4:2 3:2 2:4 | 1:8' },
      A2: { prog: ['i', 'bvii', 'bVI', 'bII'], mel: '8:4 7:2 6:2 | 5:8 | 6:2 5:2 4:2 2:2 | 1:8' },
      B: { prog: ['iv', 'bII', 'iv', 'bII'], mel: '-:4 3:4 | 2:4 1:4 | 0:4 2:4 | 1:8' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, bi } = x;
        if (st === 0) { I.bell(d, root - 12, t, 0.035, 5); I.drone(d, root - 12, t, b * 8.4, 0.03); I.choir(d, ch[1] + 12, t, b * 8, 0.012, 'o'); }
        if (st % 2 === 0) I.musicbox(d, ch[[0, 1, 2, 1][st / 2]] + 24, t, 0.012, 0.02);
        if (st === 4) I.pizz(d, root - 12, t, 0.04);
        if (m) I.choir(d, m + 12, t, ml * 1.05, 0.016, 'u');
      } }),
    // Sunleaf / forests: light and green. Pizzicato, harp, flute, birds
    forest: song({ key: 55, bpm: 96, order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['I', 'IV', 'vi', 'V'], mel: '5:2 6:2 8:3 7:1 | 6:4 5:4 | 3:2 5:2 6:2 8:2 | 7:6 -:2' },
      A2: { prog: ['I', 'IV', 'ii', 'V'], mel: '5:2 6:2 8:3 9:1 | 10:4 9:2 8:2 | 6:2 8:2 7:2 5:2 | 8:6 -:2' },
      B: { prog: ['vi', 'iii', 'IV', 'V'], mel: '10:3 9:1 8:4 | 7:3 6:1 5:4 | 6:2 7:2 8:2 9:2 | 7:6 -:2' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, loop } = x;
        if (st % 2 === 0) I.pizz(d, ch[(st / 2) % 3] + 12, t, 0.035);
        if (st === 0) { I.strings(d, ch[0] + 12, t, b * 8, 0.01); I.strings(d, ch[1] + 12, t, b * 8, 0.009); I.bass(d, root - 12, t, b * 3.5, 0.045); }
        if (st === 4) I.bass(d, ch[2] - 12, t, b * 3.5, 0.035);
        if (st === 5) I.harp(d, ch[2] + 24, t, 0.025);
        if (st === 6 && Math.random() < 0.3) I.bird(d, t);
        if (m) { if (loop % 2) { I.harp(d, m + 12, t, 0.07); I.strings(d, m, t, ml * 0.95, 0.016); } else I.clarinet(d, m, t, ml * 0.9, 0.026); }
      } }),
    // open plains: adventurous and bright, string ostinato and horn tune
    plains: song({ key: 48, bpm: 108, order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['I', 'V', 'vi', 'IV'], mel: '1:2 5:2 8:3 7:1 | 7:4 5:4 | 6:2 8:2 10:3 9:1 | 8:6 -:2' },
      A2: { prog: ['I', 'V', 'IV', 'V'], mel: '1:2 5:2 8:3 9:1 | 10:4 9:2 8:2 | 6:2 7:2 8:2 9:2 | 9:6 -:2' },
      B: { prog: ['vi', 'IV', 'I', 'V'], mel: '10:3 9:1 8:4 | 8:3 7:1 6:4 | 5:2 6:2 8:2 10:2 | 9:6 -:2' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, loop } = x;
        I.stac(d, ch[[0, 2, 1, 2][st % 4]] + 12, t, b * 0.5, 0.012);
        if (st === 0) { I.strings(d, ch[1] + 12, t, b * 8, 0.01); I.timp(d, t, 0.12, root - 12); I.bass(d, root - 12, t, b * 3.5, 0.06); }
        if (st === 4) { I.bass(d, ch[2] - 12, t, b * 3.5, 0.05); I.snare(d, t, 0.035); }
        if (st === 6 || st === 7) I.ghost(d, t, 0.015);
        if (m) { if (loop % 2) I.strings(d, m + 12, t, ml * 0.95, 0.028); else I.horn(d, m, t, ml * 0.95, 0.04); }
      } }),
    // mountains: majestic and broad. Horns in thirds, choir, timpani rolls
    mountain: song({ key: 46, bpm: 78, order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['I', 'IV', 'I', 'V'], mel: '1:4 5:4 | 8:6 7:2 | 6:4 5:2 4:2 | 5:8' },
      A2: { prog: ['I', 'IV', 'vi', 'V'], mel: '1:4 5:4 | 8:4 10:4 | 9:2 8:2 7:2 6:2 | 5:8' },
      B: { prog: ['IV', 'V', 'I', 'V'], mel: '6:4 8:4 | 7:4 9:4 | 8:2 7:2 6:2 5:2 | 5:8' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, B } = x;
        if (st === 0) { ch.forEach((n, k) => I.strings(d, n + 12, t, b * 8.2, 0.013 - k * 0.002)); I.choir(d, root + 12, t, b * 8, 0.01, 'o'); I.cello(d, root - 12, t, b * 7.5, 0.035); I.timp(d, t, 0.14, root - 12); }
        if (st % 2 === 0) I.harp(d, ch[(st / 2) % 3] + 24, t, 0.025);
        if (B.last && st === 4) I.roll(d, t, b * 4, 0.08, root - 12);
        if (m) { I.horn(d, m, t, ml * 0.95, 0.036); I.horn(d, m - 4, t, ml * 0.95, 0.018); }
      } }),
    // Sunscour desert: phrygian-dominant, oud and ney over doumbek
    desert: song({ key: 52, bpm: 100, scale: 'phrygdom', order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['I', 'bII', 'I', 'iv'], mel: '5:2 6:1 5:1 4:2 3:2 | 2:3 3:1 1:4 | 3:1 4:1 5:2 6:2 5:2 | 4:2 3:2 2:2 1:2' },
      A2: { prog: ['I', 'bII', 'iv', 'I'], mel: '8:2 7:1 6:1 5:2 4:2 | 3:2 2:2 3:4 | 5:1 6:1 7:2 8:2 7:2 | 6:2 5:2 2:2 1:2' },
      B: { prog: ['iv', 'iv', 'bII', 'I'], mel: '4:3 5:1 6:4 | 5:2 4:2 3:4 | 2:2 3:2 2:2 1:2 | 1:8' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, loop, K } = x;
        if (st === 0) { I.drone(d, K - 12, t, b * 8.4, 0.022); }
        if (st === 0 || st === 3) I.dum(d, t, st ? 0.12 : 0.16); if (st === 1 || st === 2 || st === 5 || st === 6) I.tek(d, t, 0.035); if (st === 4) I.dum(d, t, 0.1);
        if (st % 2 === 1) I.oud(d, ch[(st >> 1) % 3] + 12, t, 0.025);
        if (m) { if (loop % 2) { I.oud(d, m + 12, t, 0.06); if (ml > b * 2) I.oud(d, m + 12, t + b, 0.04); } else I.oboe(d, m + 12, t, ml * 0.95, 0.024); }
      } }),
    // Isle of Tidesong: sunny, steel pan and marimba
    island: song({ key: 53, bpm: 112, order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['I', 'IV', 'V', 'I'], mel: '3:1 5:2 5:1 6:2 5:2 | 3:2 1:2 2:4 | 2:1 4:2 4:1 5:2 4:2 | 3:6 -:2' },
      A2: { prog: ['I', 'IV', 'V', 'I'], mel: '3:1 5:2 8:1 8:2 7:1 6:1 | 5:2 6:2 5:4 | 4:1 5:2 6:1 7:2 9:2 | 8:6 -:2' },
      B: { prog: ['IV', 'V', 'vi', 'V'], mel: '6:2 8:2 6:2 4:2 | 5:2 7:2 5:2 2:2 | 3:2 6:2 8:2 6:2 | 5:6 -:2' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, loop } = x;
        if (st === 0 || st === 3 || st === 6) I.bass(d, (st === 3 ? ch[2] : root) - 12, t, b * 1.2, 0.06);
        if (st === 2 || st === 6) ch.forEach((n) => I.marimba(d, n + 12, t, 0.025));
        I.shaker(d, t, st % 2 ? 0.01 : 0.016); if (st === 3 || st === 7) I.conga(d, t, 0.06, st === 7);
        if (m) { if (loop % 2) I.marimba(d, m + 12, t, 0.06); else I.pan(d, m + 12, t, 0.05); }
      } }),
    // Dreadmire swamp: murky dorian, low marimba, clarinet, frogs
    swamp: song({ key: 50, bpm: 88, scale: 'dorian', order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['i', 'IV', 'i', 'IV'], mel: '5:3 4:1 3:2 1:2 | 4:3 5:1 6:4 | 5:2 3:2 4:2 2:2 | 1:6 -:2' },
      A2: { prog: ['i', 'bVII', 'IV', 'i'], mel: '8:3 7:1 6:2 5:2 | 4:2 3:2 4:4 | 6:2 5:2 4:2 3:2 | 1:6 -:2' },
      B: { prog: ['bVII', 'IV', 'v', 'i'], mel: '7:4 6:2 5:2 | 6:4 4:4 | 5:2 4:2 3:2 2:2 | 1:8' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml } = x;
        I.marimba(d, [root, ch[2], ch[1] + 12, ch[2]][st % 4], t, 0.04);
        if (st === 0) { I.drone(d, root - 12, t, b * 8.4, 0.02); I.bass(d, root - 12, t, b * 3, 0.05); }
        if (st === 0 || st === 5) I.conga(d, t, 0.06); if (st === 3) I.conga(d, t, 0.04, 1);
        if (st === 6 && Math.random() < 0.35) I.frog(d, t);
        if (m) I.clarinet(d, m, t, ml * 0.92, 0.028);
      } }),
    // dark lands: ominous minor march with low brass and choir
    epic: song({ key: 48, bpm: 84, scale: 'hminor', order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['i', 'VI', 'iv', 'V'], mel: '1:4 3:2 5:2 | 6:4 5:4 | 4:2 3:2 2:2 3:2 | 0:8' },
      A2: { prog: ['i', 'VI', 'iv', 'V'], mel: '1:4 3:2 5:2 | 8:4 7:4 | 6:2 5:2 4:2 2:2 | 5:8' },
      B: { prog: ['i', 'bVII', 'VI', 'V'], mel: '8:3 7:1 6:4 | 7:3 6:1 5:4 | 6:2 5:2 4:2 3:2 | 0:8' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, B } = x;
        if (st === 0) { I.choir(d, ch[0] + 12, t, b * 8, 0.014, 'a'); I.choir(d, ch[2] + 12, t, b * 8, 0.01, 'a'); I.cello(d, root - 12, t, b * 7.6, 0.04); }
        if (st === 0 || st === 4) { I.timp(d, t, 0.16, root - 12); I.brass(d, root - 12, t, b * 1.6, 0.025); }
        if (st === 6 || st === 7) I.snare(d, t, 0.03);
        if (B.last && st >= 4) I.ghost(d, t + b / 2, 0.03);
        if (m) I.horn(d, m, t, ml * 0.95, 0.04);
      } }),
    // cover page: two brothers, one crown, a kingdom burning. Slow, heavy, choir and war drums
    // the cover: a war song. Taiko war drums and timpani, driving string ostinato, brass power stabs,
    // a full choir on every chord, horns carrying the theme, snare rolls and cymbal crashes into each section
    cover: song({ key: 50, bpm: 136, scale: 'hminor', order: ['I', 'A', 'A2', 'B', 'C'], gain: 1.2, sec: {
      I: { prog: ['i', 'i', 'VI', 'V'] },
      A: { prog: ['i', 'VI', 'iv', 'V'], mel: '5:3 4:1 3:2 4:2 | 3:4 1:4 | 4:2 5:2 6:2 8:2 | 7:8' },
      A2: { prog: ['i', 'VI', 'bII', 'V'], mel: '8:3 7:1 6:2 5:2 | 6:4 3:4 | 6:2 5:2 4:2 3:2 | 2:4 5:4' },
      B: { prog: ['iv', 'i', 'VI', 'V'], mel: '8:4 10:4 | 9:3 8:1 7:4 | 6:2 7:2 8:2 10:2 | 9:8' },
      C: { prog: ['VI', 'VII', 'i', 'i'], mel: '10:4 9:2 8:2 | 9:4 7:4 | 8:8 | 8:8' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, B, sec } = x; const intro = sec === 'I', big = sec === 'B' || sec === 'C';
        // the string ostinato that never lets up
        const os = [root, root + 12, ch[2], root + 12, ch[1], root + 12, ch[2], root + 12][st];
        I.stac(d, os, t, b * 0.45, intro ? 0.017 : 0.024); if (!intro) I.stac(d, os - 12, t, b * 0.4, 0.014);
        // war drums
        if (st === 0 || st === 3 || st === 4 || st === 6) I.taiko(d, t, st === 0 ? 0.6 : 0.34);
        if (!intro && (st === 2 || st === 7)) I.taiko(d, t, 0.2);
        if (big && st % 2 === 1) I.taiko(d, t + b / 2, 0.14);
        if (st === 0) I.timp(d, t, intro ? 0.18 : 0.26, root - 12);
        if (B.last && st >= 4) { I.snare(d, t, 0.05 + (st - 4) * 0.03); I.snare(d, t + b / 2, 0.06 + (st - 4) * 0.03); if (st === 7) I.timp(d, t + b / 2, 0.22, root - 12); }
        if (B.first && st === 0) I.cymbal(d, t, intro ? 0.06 : 0.13);
        // power: brass stabs, choir and low strings on every chord
        if (intro && st === 0) { I.cello(d, root - 12, t, b * 7.8, 0.06); I.choir(d, root + 12, t, b * 8, 0.014, 'o'); I.brass(d, root - 24, t, b * 7, 0.03); }
        if (!intro && st === 0) { I.brass(d, root - 12, t, b * 1.4, 0.07); I.brass(d, ch[2] - 12, t, b * 1.4, 0.05); ch.forEach((n, k) => I.choir(d, n + 12, t, b * 8, 0.022 - k * 0.003, 'a')); I.cello(d, root - 12, t, b * 7.8, 0.075); I.strings(d, ch[1] + 12, t, b * 8, 0.016); }
        if (!intro && (st === 3 || st === 6)) I.brass(d, root - 12, t, b * 0.7, big ? 0.06 : 0.045);
        // the theme on horns, doubled by brass and strings
        if (m) { I.horn(d, m, t, ml * 0.95, big ? 0.08 : 0.07); I.brass(d, m - 12, t, ml * 0.95, 0.04); I.strings(d, m + 12, t, ml * 0.95, big ? 0.026 : 0.02); if (big) I.choir(d, m + 12, t, ml * 0.95, 0.02, 'a'); }
      } }),
    // main menu: heroic overture
    menu: song({ key: 50, bpm: 76, order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['I', 'V', 'vi', 'IV'], mel: '1:2 5:2 8:4 | 7:2 5:2 2:4 | 3:2 6:2 8:4 | 6:6 -:2' },
      A2: { prog: ['I', 'V', 'IV', 'V'], mel: '1:2 5:2 8:4 | 9:2 10:2 9:4 | 8:2 6:2 4:2 6:2 | 5:6 -:2' },
      B: { prog: ['vi', 'iii', 'IV', 'V'], mel: '10:4 9:2 8:2 | 7:4 5:4 | 6:2 8:2 9:2 10:2 | 9:6 -:2' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, loop, B } = x;
        if (st === 0) { ch.forEach((n, k) => I.strings(d, n + 12, t, b * 8.2, 0.014 - k * 0.002)); I.cello(d, root - 12, t, b * 7.5, 0.04); I.timp(d, t, 0.1, root - 12); }
        I.harp(d, arp(ch, [0, 1, 2, 3, 4, 3, 2, 1][st]) + 12, t, 0.03);
        if (B.first && st === 0 && x.bi === 0) I.cymbal(d, t, 0.03);
        if (m) { if (loop % 2) I.strings(d, m + 12, t, ml * 0.95, 0.03); else I.horn(d, m, t, ml * 0.95, 0.042); }
      } }),
    // victory: a grand, triumphant march. Brass melody, full strings, choir and timpani
    victory: song({ key: 50, bpm: 96, order: ['A', 'A2', 'B', 'A2'], sec: {
      A: { prog: ['I', 'IV', 'V', 'I'], mel: '5:2 8:2 8:3 9:1 | 10:4 9:2 8:2 | 6:2 8:2 9:2 10:2 | 12:6 -:2' },
      A2: { prog: ['I', 'vi', 'IV', 'V'], mel: '12:2 10:2 8:2 10:2 | 9:4 8:2 6:2 | 5:2 6:2 8:2 9:2 | 8:6 -:2' },
      B: { prog: ['IV', 'V', 'iii', 'vi'], mel: '10:3 9:1 8:2 9:2 | 10:4 12:4 | 13:2 12:2 10:2 9:2 | 10:6 -:2' } },
      arr(x) { const { d, t, b, st, ch, root, m, ml, B } = x;
        if (st === 0) { ch.forEach((n, k) => I.strings(d, n + 12, t, b * 8.2, 0.018 - k * 0.003)); I.cello(d, root - 12, t, b * 7.5, 0.05); I.timp(d, t, 0.16, root - 12); I.choir(d, ch[0] + 12, t, b * 8, 0.014, 'a'); I.choir(d, ch[2] + 12, t, b * 8, 0.011, 'a'); }
        if (st === 4) I.timp(d, t, 0.11, root - 12);
        if (st === 6) I.timp(d, t, 0.07, root - 5);
        if (st % 2 === 1) I.harp(d, arp(ch, st) + 24, t, 0.022);
        if (B.first && st === 0 && x.bi === 0) I.cymbal(d, t, 0.06);
        if (m) { I.horn(d, m, t, ml * 0.95, 0.06); I.horn(d, m - 12, t, ml * 0.95, 0.03); I.strings(d, m + 12, t, ml * 0.95, 0.02); }
      } }),
  };
  TRACKS.haunted = TRACKS.crypt;
  TRACKS.eyrie = TRACKS.mountain;
  A.TRACKS = Object.keys(TRACKS);

  // developer check: render a track offline and measure its level (used by automated tests)
  A._render = async function (name, secs = 12) {
    const saved = { ctx, musicBus, revIn, reverb, noiseBuf, sfxBus };
    const off = new OfflineAudioContext(2, Math.floor(44100 * secs), 44100);
    ctx = off; musicBus = off.createGain(); musicBus.gain.value = 0.3; const comp = off.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; musicBus.connect(comp); comp.connect(off.destination);
    reverb = off.createConvolver(); reverb.buffer = saved.reverb ? saved.reverb.buffer : null; revIn = off.createGain(); if (reverb.buffer) { revIn.connect(reverb); const rg = off.createGain(); rg.gain.value = 0.5; reverb.connect(rg); rg.connect(musicBus); }
    noiseBuf = saved.noiseBuf; sfxBus = musicBus;
    const tr = typeof name === 'function' ? { bpm: 120, play: (st, tt, dd) => name(I, dd, tt, st) } : TRACKS[name]; const b = 60 / tr.bpm / 2; let errs = 0;
    for (let s = 0, tt = 0.05; tt < secs - 0.5; s++, tt += b) { try { tr.play(s, tt, musicBus, b); } catch (e) { errs++; if (errs < 3) console.warn(name, e); } }
    const buf = await off.startRendering();
    Object.assign({}, saved); ctx = saved.ctx; musicBus = saved.musicBus; revIn = saved.revIn; reverb = saved.reverb; noiseBuf = saved.noiseBuf; sfxBus = saved.sfxBus;
    const dch = buf.getChannelData(0); let peak = 0, sum = 0, at = 0; for (let i = 0; i < dch.length; i++) { const v = Math.abs(dch[i]); if (v > peak) { peak = v; at = i; } sum += v * v; }
    return { name: typeof name === 'function' ? 'fn' : name, peak: +peak.toFixed(3), at: +(at / 44100).toFixed(3), rms: +Math.sqrt(sum / dch.length).toFixed(4), errs };
  };
  A.play = function (name) {
    if (!ctx || name === curTrack) return;
    curTrack = name; A.curName = name;
    if (trackGain) { const g = trackGain; g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.7); setTimeout(() => g.disconnect(), 3500); }
    trackGain = ctx.createGain(); trackGain.gain.value = 0.0001; trackGain.connect(musicBus);
    trackGain.gain.setTargetAtTime((TRACKS[name] && TRACKS[name].gain) || 1, ctx.currentTime + 0.3, name === 'combat' || name === 'boss' ? 0.25 : 0.9);
    A.track = TRACKS[name] || null; step = 0; nextNote = ctx.currentTime + 0.25;
  };
  function schedule() {
    if (!ctx || !A.track || !trackGain) return;
    const b = 60 / A.track.bpm / 2; // eighth notes
    while (nextNote < ctx.currentTime + 0.3) {
      try { A.track.play(step, nextNote, trackGain, b); } catch (e) {}
      step = (step + 1) % (A.track.steps * 4);
      nextNote += b;
    }
  }

  // =====================================================================
  // creature voices
  // =====================================================================
  const VOICE_OF = { wolf: 'growl', tiger: 'snarl', bear: 'roar', boar: 'grunt', rat: 'squeak', bat: 'squeak', snake: 'hiss', lizard: 'hiss', croc: 'hiss', spider: 'chitter', beetle: 'chitter', mosquito: 'buzz',
    goblin: 'cackle', orc: 'grunt', bandit: 'shout', guard: 'shout', ogre: 'bellow', troll: 'bellow', giant: 'bellow', harpy: 'screech', griffon: 'screech', drake: 'roar', dragon: 'roar',
    skeleton: 'rattle', zombie: 'groan', ghost: 'wail', lich: 'whisper', deathknight: 'groan', wisp: 'chime', golem: 'rumble', treant: 'creak', scarecrow: 'creak',
    elemental: 'rumble', fire_elemental: 'crackle', water_elemental: 'bubble', air_elemental: 'gust', spell: 'chime' };
  A.voiceOf = (kind) => VOICE_OF[kind] || 'grunt';
  // pitch: >1 for small creatures, <1 for big ones; what: aggro | attack | hurt | die
  A.voice = function (kind, what = 'aggro', pitch = 1, vol = 1, pan = 0) {
    if (!ctx || !A.enabled) return;
    const v = VOICE_OF[kind] || kind; const key = 'v_' + v + what; const now = ctx.currentTime;
    if (lastSfx[key] && now - lastSfx[key] < (what === 'die' ? 0.15 : 0.35)) return; lastSfx[key] = now;
    const d = out(vol, pan); const t = now; const P = pitch * (what === 'hurt' ? 1.15 : what === 'die' ? 0.85 : 1); const L = what === 'die' ? 1.6 : what === 'attack' ? 0.6 : what === 'hurt' ? 0.5 : 1;
    const growlAM = (f, dur, lp, vv) => { // rough throat: low saw with fast amplitude flutter
      const o = ctx.createOscillator(), g = ctx.createGain(), am = ctx.createOscillator(), ag = ctx.createGain(), fl = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 1.15, t + dur * 0.3); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + dur);
      am.frequency.value = 28 + Math.random() * 14; ag.gain.value = vv * 0.6; am.connect(ag); ag.connect(g.gain);
      fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = 3;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vv, t + 0.06); g.gain.setTargetAtTime(0.0001, t + dur * 0.7, dur * 0.12);
      o.connect(fl); fl.connect(g); g.connect(d); o.start(t); am.start(t); o.stop(t + dur + 0.3); am.stop(t + dur + 0.3);
    };
    switch (v) {
      case 'growl': growlAM(95 * P, 0.9 * L, 700, 0.35); noise(d, t, 0.8 * L, 0.12, { f: 500 * P, q: 2, attack: 0.05 }); break;
      case 'snarl': growlAM(140 * P, 0.7 * L, 1200, 0.32); noise(d, t, 0.5 * L, 0.18, { f: 1600 * P, q: 1.5, attack: 0.02 }); break;
      case 'roar': growlAM(70 * P, 1.4 * L, 600, 0.45); noise(d, t, 1.3 * L, 0.3, { f: 380 * P, f2: 160 * P, q: 1.2, attack: 0.08 }); break;
      case 'bellow': growlAM(60 * P, 1.1 * L, 450, 0.42); voice(d, 120 * P, t, 0.8 * L, { type: 'sawtooth', v: 0.1, a: 0.08, r: 0.3, formants: [[400, 6, 1.4], [700, 7, 0.8]] }); break;
      case 'grunt': voice(d, 130 * P, t, 0.22 * L, { type: 'sawtooth', v: 0.2, a: 0.02, r: 0.12, slide: 0.75, formants: [[500, 6, 1.4], [900, 7, 0.8]] }); noise(d, t, 0.18, 0.08, { f: 700, q: 2 }); break;
      case 'cackle': for (let i = 0; i < 4; i++) voice(d, (330 + i * 25) * P, t + i * 0.09, 0.05, { type: 'sawtooth', v: 0.1, r: 0.05, formants: [[900, 6, 1.4], [1700, 8, 0.7]], slide: 0.8, slideT: 0.06 }); break;
      case 'shout': voice(d, 170 * P, t, 0.35 * L, { type: 'sawtooth', v: 0.15, a: 0.03, r: 0.12, slide: 0.85, formants: [[700, 7, 1.4], [1200, 8, 0.8], [2600, 10, 0.3]] }); break;
      case 'squeak': for (let i = 0; i < 2; i++) voice(d, (2200 + i * 500) * P, t + i * 0.08, 0.05, { type: 'triangle', v: 0.08, r: 0.05, slide: 1.3, slideT: 0.05 }); break;
      case 'hiss': noise(d, t, 0.7 * L, 0.22, { f: 5200 * Math.min(1.3, P), q: 1.2, attack: 0.08 }); break;
      case 'chitter': for (let i = 0; i < 7; i++) noise(d, t + i * 0.035, 0.025, 0.14, { f: 3000 * P + i * 150, q: 6 }); break;
      case 'buzz': voice(d, 210 * P, t, 0.6 * L, { type: 'sawtooth', v: 0.06, a: 0.05, r: 0.1, lp: 1600, vib: 0.03, vibDelay: 0, vibRate: 18 }); break;
      case 'screech': voice(d, 1300 * P, t, 0.55 * L, { type: 'sawtooth', v: 0.08, a: 0.02, r: 0.15, slide: 0.6, formants: [[1800, 5, 1.3], [3200, 6, 0.7]], vib: 0.02, vibDelay: 0, vibRate: 11 }); noise(d, t, 0.4 * L, 0.08, { f: 3500, q: 2 }); break;
      case 'rattle': for (let i = 0; i < 9; i++) noise(d, t + i * 0.04 + Math.random() * 0.02, 0.03, 0.15, { f: 1800 + Math.random() * 1600, q: 7 }); if (what !== 'attack') voice(d, 95 * P, t, 0.8 * L, { type: 'sawtooth', v: 0.06, a: 0.1, r: 0.4, formants: [[350, 6, 1.3], [700, 7, 0.6]], vib: 0.02, vibRate: 3 }); break;
      case 'groan': voice(d, 92 * P, t, 1.3 * L, { type: 'sawtooth', v: 0.16, a: 0.15, r: 0.5, slide: 0.78, formants: [[420, 7, 1.5], [800, 8, 0.7], [2400, 10, 0.2]], vib: 0.025, vibDelay: 0.1, vibRate: 3.5 }); noise(d, t, 1.0 * L, 0.05, { f: 400, q: 3, attack: 0.15 }); break;
      case 'wail': voice(d, 520 * P, t, 1.6 * L, { type: 'sine', v: 0.09, a: 0.3, r: 0.7, slide: 0.65, vib: 0.03, vibDelay: 0.1, vibRate: 5, rev: 0.6 }); voice(d, 780 * P, t + 0.1, 1.4 * L, { type: 'triangle', v: 0.04, a: 0.3, r: 0.6, slide: 0.7, rev: 0.6 }); break;
      case 'whisper': noise(d, t, 1.2 * L, 0.12, { f: 2200, f2: 900, q: 4, attack: 0.2, rev: 0.6 }); voice(d, 110 * P, t, 1.0 * L, { type: 'sawtooth', v: 0.05, a: 0.2, r: 0.5, formants: [[300, 5, 1.2]] }); break;
      case 'chime': [0, 4, 7].forEach((k, i) => voice(d, midi(84 + k) * P, t + i * 0.06, 0.2, { v: 0.05, r: 0.5, rev: 0.6 })); break;
      case 'rumble': noise(d, t, 1.0 * L, 0.35, { f: 120, type: 'lowpass', attack: 0.1 }); voice(d, 48 * P, t, 0.9 * L, { type: 'sawtooth', v: 0.12, a: 0.1, r: 0.4, lp: 250 }); break;
      case 'creak': voice(d, 180 * P, t, 0.7 * L, { type: 'sawtooth', v: 0.08, a: 0.05, r: 0.2, slide: 1.4, lp: 900, q: 8 }); noise(d, t, 0.3, 0.06, { f: 600, q: 5 }); break;
      case 'crackle': noise(d, t, 0.8 * L, 0.3, { f: 600, f2: 200, type: 'lowpass', attack: 0.04 }); for (let i = 0; i < 6; i++) noise(d, t + Math.random() * 0.6, 0.02, 0.14, { f: 3000, q: 4 }); break;
      case 'bubble': for (let i = 0; i < 6; i++) voice(d, (300 + Math.random() * 400) * P, t + i * 0.07, 0.03, { v: 0.07, r: 0.06, slide: 1.8, slideT: 0.05 }); break;
      case 'gust': noise(d, t, 1.0 * L, 0.2, { f: 400, f2: 1800, q: 1.4, attack: 0.25 }); break;
      default: voice(d, 140 * P, t, 0.25, { type: 'sawtooth', v: 0.15, r: 0.15, lp: 800 });
    }
  };

  // =====================================================================
  // sound effects
  // =====================================================================
  let lastSfx = {};
  function out(vol, pan) {
    let d = sfxBus;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); const g = ctx.createGain(); g.gain.value = vol; g.connect(p); p.connect(sfxBus); d = g; }
    else if (vol !== 1) { const g = ctx.createGain(); g.gain.value = vol; g.connect(sfxBus); d = g; }
    return d;
  }
  const tone = (d, f, t, dur, type, v, o = {}) => voice(d, f, t, o.release != null ? 0.005 : dur, Object.assign({ type, v, a: o.attack || 0.005, r: o.release || dur, rev: o.rev ? 0.3 : 0 }, o.slide ? { slide: o.slide, slideT: o.release || dur } : {}, o.lp ? { lp: o.lp, q: o.q } : {}, o.vib ? { vib: 0.008, vibDelay: 0 } : {}));
  A.sfx = function (name, vol = 1, pan = 0) {
    if (!ctx || !A.enabled) return;
    const now = ctx.currentTime;
    if (lastSfx[name] && now - lastSfx[name] < 0.04) return; lastSfx[name] = now;
    const d = out(vol, pan); const t = now;
    switch (name) {
      // ----- melee -----
      case 'slash': noise(d, t, 0.16, 0.35, { f: 2500, f2: 6000, q: 2 }); noise(d, t + 0.02, 0.1, 0.15, { f: 900 }); break;
      case 'blunt': tone(d, 120, t, 0.18, 'sine', 0.5, { slide: 0.5, release: 0.18 }); noise(d, t, 0.12, 0.25, { f: 400, q: 1 }); break;
      case 'pierce': noise(d, t, 0.07, 0.3, { f: 4500, q: 3 }); tone(d, 900, t, 0.05, 'square', 0.04, { release: 0.05 }); break;
      case 'punch': tone(d, 160, t, 0.1, 'sine', 0.45, { slide: 0.5, release: 0.1 }); noise(d, t, 0.06, 0.2, { f: 800 }); break;
      case 'kick': noise(d, t, 0.12, 0.12, { f: 600, f2: 1800, q: 1.2 }); tone(d, 110, t + 0.08, 0.14, 'sine', 0.5, { slide: 0.45, release: 0.14 }); noise(d, t + 0.08, 0.06, 0.22, { f: 500 }); break;
      case 'swing': case 'whoosh': noise(d, t, 0.2, 0.15, { f: 700, f2: 2600, q: 1.5 }); break;
      case 'miss': noise(d, t, 0.14, 0.08, { f: 1500, f2: 400, q: 1.2 }); break;
      case 'bash': tone(d, 380, t, 0.5, 'square', 0.06, { release: 0.5, lp: 2500 }); tone(d, 570, t, 0.4, 'sine', 0.08, { release: 0.4 }); tone(d, 90, t, 0.2, 'sine', 0.45, { slide: 0.5, release: 0.2 }); noise(d, t, 0.1, 0.3, { f: 1200 }); break;
      case 'block': tone(d, 900, t, 0.3, 'square', 0.04, { release: 0.3, lp: 3000 }); tone(d, 1350, t, 0.25, 'sine', 0.06, { release: 0.25 }); noise(d, t, 0.05, 0.2, { f: 2500 }); break;
      case 'stab': noise(d, t, 0.05, 0.2, { f: 5000, q: 2 }); tone(d, 200, t + 0.04, 0.15, 'sine', 0.35, { slide: 0.6, release: 0.15 }); noise(d, t + 0.04, 0.15, 0.15, { f: 700, q: 2 }); break;
      case 'heavy': noise(d, t, 0.18, 0.2, { f: 500, f2: 2500, q: 1.5 }); tone(d, 75, t + 0.15, 0.4, 'sine', 0.6, { slide: 0.5, release: 0.4 }); noise(d, t + 0.15, 0.25, 0.35, { f: 300, q: 0.8 }); break;
      case 'flurry': for (let i = 0; i < 4; i++) { noise(d, t + i * 0.08, 0.1, 0.12, { f: 900, f2: 3000, q: 1.5 }); noise(d, t + i * 0.08 + 0.06, 0.05, 0.15, { f: 3000, q: 2 }); } break;
      case 'shout': case 'warcry': tone(d, 180, t, 0.6, 'sawtooth', 0.12, { slide: 1.25, release: 0.6, lp: 1400 }); tone(d, 270, t, 0.6, 'sawtooth', 0.07, { slide: 1.25, release: 0.6, lp: 1600 }); noise(d, t, 0.5, 0.08, { f: 900, q: 2 }); break;
      case 'stealth': noise(d, t, 0.6, 0.1, { f: 3000, f2: 400, q: 2, attack: 0.05 }); [79, 74, 67].forEach((n, i) => tone(d, midi(n), t + i * 0.08, 0.3, 'sine', 0.035, { release: 0.3 })); break;
      case 'charge': noise(d, t, 0.3, 0.2, { f: 400, f2: 3000, q: 1.2, attack: 0.05 }); tone(d, 90, t + 0.28, 0.25, 'sine', 0.55, { slide: 0.5, release: 0.25 }); noise(d, t + 0.28, 0.15, 0.25, { f: 500 }); break;
      case 'rage': tone(d, 70, t, 0.8, 'sawtooth', 0.14, { slide: 1.5, release: 0.8, lp: 600 }); noise(d, t, 0.7, 0.18, { f: 300, f2: 900, q: 1.5, attack: 0.1 }); break;
      case 'stun': for (let i = 0; i < 3; i++) tone(d, 1400 + i * 300, t + i * 0.05, 0.6, 'sine', 0.05, { release: 0.6, vib: true }); tone(d, 100, t, 0.2, 'sine', 0.4, { slide: 0.5, release: 0.2 }); break;
      case 'volley': for (let i = 0; i < 5; i++) { tone(d, 240, t + i * 0.06, 0.15, 'triangle', 0.1, { slide: 0.8, release: 0.15 }); noise(d, t + i * 0.06, 0.2, 0.05, { f: 1800, f2: 600 }); } break;
      case 'bow': tone(d, 220, t, 0.18, 'triangle', 0.18, { slide: 0.8, release: 0.18 }); noise(d, t + 0.02, 0.25, 0.08, { f: 1800, f2: 600 }); break;
      case 'throw': noise(d, t, 0.22, 0.12, { f: 1200, f2: 3500, q: 2 }); break;
      case 'arrowhit': noise(d, t, 0.06, 0.22, { f: 2200, q: 2 }); break;
      // ----- magic -----
      case 'magicbolt': tone(d, 660, t, 0.25, 'sine', 0.12, { slide: 1.8, release: 0.25 }); tone(d, 990, t, 0.2, 'triangle', 0.05, { slide: 1.5, release: 0.2 }); break;
      case 'fire': noise(d, t, 0.6, 0.35, { f: 500, f2: 150, type: 'lowpass', attack: 0.03 }); noise(d, t, 0.3, 0.12, { f: 2400, q: 0.6 }); for (let i = 0; i < 5; i++) noise(d, t + Math.random() * 0.4, 0.02, 0.1, { f: 3000, q: 4 }); break;
      case 'cold': for (let i = 0; i < 6; i++) tone(d, 1800 + Math.random() * 2400, t + i * 0.04, 0.3, 'sine', 0.05, { release: 0.3 }); noise(d, t, 0.3, 0.08, { f: 6000, type: 'highpass' }); break;
      case 'magic': case 'lightning': for (let i = 0; i < 6; i++) noise(d, t + i * 0.03, 0.05, 0.25, { f: 3000 + Math.random() * 3000, q: 4 }); tone(d, 80, t, 0.3, 'sawtooth', 0.12, { release: 0.3, lp: 400 }); break;
      case 'poison': case 'disease': noise(d, t, 0.6, 0.18, { f: 300, f2: 900, q: 6, attack: 0.08 }); for (let i = 0; i < 4; i++) tone(d, 300 + Math.random() * 300, t + i * 0.1, 0.06, 'sine', 0.05, { slide: 1.8, release: 0.06 }); break;
      case 'dark': noise(d, t, 0.7, 0.2, { f: 300, f2: 900, q: 6, attack: 0.08 }); tone(d, 110, t, 0.6, 'sawtooth', 0.07, { slide: 0.6, release: 0.6, lp: 600 }); break;
      case 'heal': [72, 76, 79, 84].forEach((n, i) => tone(d, midi(n), t + i * 0.07, 0.6, 'sine', 0.07, { release: 0.6, rev: true })); noise(d, t, 0.6, 0.03, { f: 7000, type: 'highpass', rev: true }); break;
      case 'buff': [67, 74, 79].forEach((n, i) => tone(d, midi(n), t + i * 0.05, 0.6, 'triangle', 0.055, { release: 0.6, rev: true })); noise(d, t, 0.5, 0.035, { f: 5000, type: 'highpass' }); break;
      case 'song': [69, 73, 76, 81].forEach((n, i) => pluck(d, n + 12, t + i * 0.06, 0.08, 0.6, 1.5, 0.4)); break;
      case 'songcast': [69, 76].forEach((n, i) => pluck(d, n + 12, t + i * 0.1, 0.05, 0.6, 1.2, 0.4)); break;
      case 'charm': [76, 79, 83, 88, 83].forEach((n, i) => voice(d, midi(n), t + i * 0.08, 0.2, { v: 0.045, r: 0.5, vib: 0.02, vibDelay: 0, rev: 0.5 })); break;
      case 'cast': case 'cast_Evocation': voice(d, 220, t, 1.0, { type: 'sawtooth', v: 0.035, a: 0.4, r: 0.3, slide: 2, slideT: 1.0, lp: 1200 }); noise(d, t, 1.0, 0.05, { f: 800, f2: 3000, attack: 0.5 }); break;
      case 'cast_Alteration': [72, 76, 79, 84, 79, 76].forEach((n, i) => voice(d, midi(n), t + i * 0.12, 0.1, { v: 0.025, r: 0.4, rev: 0.5 })); break;
      case 'cast_Abjuration': voice(d, 165, t, 1.0, { v: 0.06, a: 0.3, r: 0.4, vib: 0.01, vibDelay: 0, vibRate: 7, rev: 0.4 }); voice(d, 330, t, 1.0, { v: 0.025, a: 0.3, r: 0.4, rev: 0.4 }); break;
      case 'cast_Conjuration': noise(d, t, 1.1, 0.07, { f: 300, f2: 2400, q: 6, attack: 0.4, rev: 0.4 }); voice(d, 110, t, 1.0, { type: 'triangle', v: 0.05, a: 0.4, r: 0.3, slide: 1.5 }); break;
      case 'cast_Divination': for (let i = 0; i < 8; i++) voice(d, 1500 + Math.random() * 2500, t + i * 0.1, 0.02, { v: 0.02, r: 0.25, rev: 0.6 }); break;
      case 'fizzle': tone(d, 300, t, 0.3, 'square', 0.05, { slide: 0.4, release: 0.3, lp: 1200 }); break;
      case 'taunt': tone(d, 140, t, 0.3, 'sawtooth', 0.12, { slide: 1.4, release: 0.3, lp: 900 }); break;
      case 'whirl': noise(d, t, 0.5, 0.25, { f: 600, f2: 3000, q: 1.5 }); noise(d, t + 0.25, 0.3, 0.15, { f: 3000, f2: 800, q: 1.5 }); break;
      case 'hurt': tone(d, 200, t, 0.15, 'square', 0.07, { slide: 0.6, release: 0.15, lp: 900 }); break;
      case 'death': tone(d, 220, t, 1.2, 'sawtooth', 0.1, { slide: 0.3, release: 1.2, lp: 700 }); break;
      case 'mobdie': tone(d, 160, t, 0.5, 'triangle', 0.1, { slide: 0.4, release: 0.5 }); break;
      case 'levelup': [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => { tone(d, midi(n), t + i * 0.08, 0.9, 'triangle', 0.06, { release: 0.9 }); }); break;
      case 'ding': { // gentle level-up chime
        [[1, 0.12], [2.0, 0.04], [2.76, 0.03]].forEach(([m, v]) => tone(d, 1320 * m, t, 2.0, 'sine', v, { release: 2.0 }));
        tone(d, midi(76), t, 1.8, 'sine', 0.08, { release: 1.8 }); tone(d, midi(83), t + 0.02, 1.6, 'triangle', 0.035, { release: 1.6 });
        break; }
      case 'quest': [67, 72, 76, 79].forEach((n, i) => tone(d, midi(n), t + i * 0.12, 0.7, 'triangle', 0.08, { release: 0.7 })); break;
      case 'skillup': tone(d, midi(84), t, 0.2, 'sine', 0.045, { release: 0.2 }); tone(d, midi(88), t + 0.06, 0.25, 'sine', 0.045, { release: 0.25 }); break;
      case 'coin': for (let i = 0; i < 5; i++) { const tt = t + i * 0.055 + Math.random() * 0.02, f0 = 2400 + Math.random() * 1600; tone(d, f0, tt, 0.22, 'sine', 0.07, { release: 0.22 }); tone(d, f0 * 2.76, tt, 0.12, 'sine', 0.025, { release: 0.12 }); noise(d, tt, 0.03, 0.06, { f: 7000, q: 3 }); } break;
      case 'equip': noise(d, t, 0.09, 0.22, { f: 1400, q: 1.2 }); tone(d, 420, t, 0.12, 'triangle', 0.1, { slide: 0.7, release: 0.12 }); noise(d, t + 0.09, 0.07, 0.16, { f: 3200, q: 2 }); tone(d, 1300, t + 0.1, 0.25, 'square', 0.025, { release: 0.25, lp: 3500 }); break;
      case 'door': tone(d, 180, t, 0.5, 'sawtooth', 0.04, { slide: 1.6, release: 0.5, lp: 800, q: 6 }); noise(d, t + 0.4, 0.12, 0.1, { f: 300 }); break;
      case 'click': tone(d, 1200, t, 0.04, 'square', 0.03, { release: 0.04 }); break;
      case 'open': noise(d, t, 0.12, 0.06, { f: 2500, q: 0.8 }); break;
      case 'alarmbell': I.bell(d, 79, t, 0.22, 2.4); I.bell(d, 72, t + 0.02, 0.14, 2.6); noise(d, t, 0.04, 0.15, { f: 3500 }); break;
      // ----- gathering -----
      case 'chop': tone(d, 210, t, 0.12, 'triangle', 0.45, { slide: 0.55, release: 0.12 }); noise(d, t, 0.09, 0.4, { f: 1100, q: 1.4 }); noise(d, t + 0.01, 0.22, 0.1, { f: 380, q: 4 }); tone(d, 92, t + 0.02, 0.25, 'sine', 0.25, { slide: 0.8, release: 0.25 }); break;
      case 'treefall': noise(d, t, 1.4, 0.18, { f: 300, f2: 120, q: 2 }); voice(d, 140, t, 1.0, { type: 'sawtooth', v: 0.06, a: 0.2, r: 0.4, slide: 0.6, lp: 600, q: 6 }); tone(d, 60, t + 1.1, 0.6, 'sine', 0.55, { slide: 0.5, release: 0.6 }); noise(d, t + 1.1, 0.5, 0.35, { f: 260, q: 0.8 }); break;
      case 'pickaxe': tone(d, 1850, t, 0.22, 'square', 0.05, { release: 0.22, lp: 5200 }); tone(d, 2740, t, 0.16, 'sine', 0.06, { release: 0.16 }); noise(d, t, 0.06, 0.35, { f: 3200, q: 1 }); noise(d, t + 0.03, 0.25, 0.12, { f: 700, q: 2 }); break;
      case 'rockbreak': noise(d, t, 0.5, 0.35, { f: 500, f2: 180, q: 1 }); tone(d, 70, t, 0.4, 'sine', 0.4, { slide: 0.6, release: 0.4 }); for (let k = 0; k < 4; k++) noise(d, t + 0.08 + k * 0.07, 0.05, 0.12, { f: 2000 + k * 400, q: 2 }); break;
      case 'skin': noise(d, t, 0.22, 0.18, { f: 1800, f2: 900, q: 3 }); noise(d, t + 0.12, 0.18, 0.12, { f: 1200, f2: 700, q: 3 }); break;
      case 'anvil': tone(d, 1500, t, 0.7, 'square', 0.05, { release: 0.7, lp: 4000 }); tone(d, 2230, t, 0.5, 'sine', 0.06, { release: 0.5 }); noise(d, t, 0.05, 0.2, { f: 3000 }); break;
      case 'craft': tone(d, midi(72), t, 0.3, 'triangle', 0.08, { release: 0.3 }); tone(d, midi(79), t + 0.1, 0.4, 'triangle', 0.08, { release: 0.4 }); break;
      case 'fail': tone(d, midi(60), t, 0.3, 'square', 0.05, { release: 0.3, lp: 1000 }); tone(d, midi(55), t + 0.12, 0.4, 'square', 0.05, { release: 0.4, lp: 1000 }); break;
      case 'drink': noise(d, t, 0.4, 0.08, { f: 600, f2: 300, q: 3 }); break;
      case 'roar': A.voice('dragon', 'aggro', 0.9, vol); break;
      case 'gate': for (let i = 0; i < 8; i++) tone(d, midi(60 + i * 3), t + i * 0.05, 0.4, 'sine', 0.05, { release: 0.4 }); break;
      case 'bagfull': tone(d, midi(64), t, 0.18, 'triangle', 0.07, { release: 0.18 }); tone(d, midi(60), t + 0.12, 0.25, 'triangle', 0.07, { release: 0.25 }); break;
    }
  };
})();

// Sound effects are synthesised on the spot; music is shared with the Kingdom Rising II folder.
const S = {
  jump: [[300, 520, 0.12, 'square', 0.12]], jump2: [[420, 700, 0.12, 'square', 0.12]], jump3: [[520, 1040, 0.2, 'square', 0.13], [780, 1560, 0.2, 'sine', 0.08]],
  land: [[120, 60, 0.08, 'sine', 0.2]], coin: [[988, 988, 0.05, 'square', 0.08], [1319, 1319, 0.14, 'square', 0.08, 0.05]], whip: [['n', 3000, 0.09, 0.25, 0.02], [1800, 200, 0.05, 'sawtooth', 0.12, 0.06]],
  hook: [[200, 900, 0.18, 'sawtooth', 0.1]], cannon: [['n', 600, 0.2, 0.4], [90, 40, 0.25, 'sine', 0.4]], miss: [[160, 110, 0.12, 'square', 0.08]], hit: [['n', 900, 0.16, 0.35], [200, 70, 0.2, 'sawtooth', 0.18]],
  meow: [[650, 1150, 0.12, 'sawtooth', 0.13], [1150, 520, 0.32, 'sawtooth', 0.13, 0.12]], squeak: [[1500, 2300, 0.07, 'square', 0.09], [2300, 1700, 0.07, 'square', 0.09, 0.08]], splat: [['n', 1000, 0.22, 0.45], [220, 90, 0.15, 'sine', 0.3]],
  punch: [['n', 700, 0.08, 0.55], [170, 55, 0.13, 'sine', 0.6], [900, 300, 0.04, 'square', 0.12]],
  bonk: [[520, 180, 0.12, 'triangle', 0.3]], poof: [['n', 1400, 0.22, 0.2]], splash: [['n', 1800, 0.4, 0.3], ['n', 500, 0.5, 0.2]], slide: [['n', 2400, 0.35, 0.1]], bounce: [[180, 720, 0.25, 'sine', 0.25]],
  crumble: [['n', 400, 0.4, 0.3]], rumble: [['n', 160, 0.9, 0.45], [60, 40, 0.8, 'sine', 0.3]], spike: [[900, 1400, 0.05, 'sawtooth', 0.1]], dart: [[1500, 700, 0.08, 'square', 0.08]], throw: [[300, 600, 0.12, 'triangle', 0.12]],
  slam: [['n', 200, 0.5, 0.5], [70, 30, 0.5, 'sine', 0.5]], snort: [['n', 300, 0.25, 0.25], [110, 90, 0.25, 'sawtooth', 0.12]], screech: [[1900, 1200, 0.25, 'sawtooth', 0.08]],
  camp: [[392, 392, 0.12, 'triangle', 0.2], [523, 523, 0.12, 'triangle', 0.2, 0.12], [659, 659, 0.3, 'triangle', 0.2, 0.24]], gong: [[110, 104, 2.2, 'sine', 0.5], [223, 219, 1.8, 'sine', 0.25], [331, 330, 1.2, 'triangle', 0.12]],
  win: [[523, 523, 0.14, 'square', 0.14], [659, 659, 0.14, 'square', 0.14, 0.14], [784, 784, 0.14, 'square', 0.14, 0.28], [1047, 1047, 0.5, 'square', 0.14, 0.42]],
  jewel: [[1047, 1047, 0.1, 'triangle', 0.2], [1319, 1319, 0.1, 'triangle', 0.2, 0.1], [1568, 1568, 0.1, 'triangle', 0.2, 0.2], [2093, 2093, 0.4, 'triangle', 0.2, 0.3]],
  item: [[392, 392, 0.15, 'square', 0.12], [494, 494, 0.15, 'square', 0.12, 0.15], [587, 587, 0.15, 'square', 0.12, 0.3], [784, 784, 0.6, 'square', 0.12, 0.45]],
  talk: [[440, 480, 0.04, 'square', 0.04]], buy: [[660, 880, 0.1, 'triangle', 0.2], [880, 1320, 0.2, 'triangle', 0.2, 0.1]], nope: [[150, 120, 0.2, 'square', 0.1]],
};
export class Audio {
  constructor() { this.ctx = null; this.vol = 0.6; this.cur = null; this.el = null; this.musicOn = true; }
  unlock() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); if (this.el && this.el.paused && this.musicOn) this.el.play().catch(() => { }); }
  sfx(name, vol = 1) {
    const c = this.ctx, d = S[name]; if (!c || !d || c.state !== 'running') return; const t0 = c.currentTime;
    for (const p of d) {
      const g = c.createGain(); g.connect(c.destination);
      if (p[0] === 'n') { const [, f, dur, v, dl = 0] = p, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = buf; const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f; s.connect(fl); fl.connect(g); g.gain.setValueAtTime(v * vol * this.vol, t0 + dl); g.gain.exponentialRampToValueAtTime(0.001, t0 + dl + dur); s.start(t0 + dl); }
      else { const [f0, f1, dur, type, v, dl = 0] = p, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0 + dl); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dl + dur); o.connect(g); g.gain.setValueAtTime(v * vol * this.vol, t0 + dl); g.gain.exponentialRampToValueAtTime(0.001, t0 + dl + dur); o.start(t0 + dl); o.stop(t0 + dl + dur + 0.02); }
    }
  }
  music(name) {
    if (this.cur === name) return; this.cur = name; if (this.el) { this.el.pause(); this.el = null; } if (!name) return;
    const el = this.el = new window.Audio(`../kingdom-rising-2/music/${name}.mp3`); el.loop = true; el.volume = 0.3; if (this.musicOn) el.play().catch(() => { });
  }
  toggleMusic() { this.musicOn = !this.musicOn; if (this.el) { if (this.musicOn) this.el.play().catch(() => { }); else this.el.pause(); } return this.musicOn; }
}

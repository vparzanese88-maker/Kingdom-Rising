// The soundtrack: four recorded orchestral tracks (CC0, from OpenGameArt; see assets/music/CREDITS.txt), streamed and crossfaded by mood.
//   war    - "The Battlefield": horns and snares, for the title screen, Station Olympus and the drop
//   calm   - "Inevitable": the build-up before the swarm, quiet stretches, the forward base
//   battle - "Orchestral Battle Theme": the swarm is coming
//   boss   - "Epic Boss Battle": the Brood Queen's lair and boss aliens
// Each track plays through an <audio> element routed into the game's master bus, so it shares the limiter with the effects.
const TRACK = { title: 'war', drop: 'war', calm: 'calm', battle: 'battle', boss: 'boss', off: null };
const BASE = './assets/music/';
export class Music {
  constructor(audio) { this.a = audio; this.mode = 'title'; this.on = true; this.vol = 0.75; this.el = {}; try { const v = JSON.parse(localStorage.getItem('hb-music2') || 'null'); if (v) { this.on = v.on; this.vol = v.vol; } } catch (e) { } }
  save() { try { localStorage.setItem('hb-music2', JSON.stringify({ on: this.on, vol: this.vol })); } catch (e) { } }
  level() { return this.on ? this.vol * 0.9 * (this.mul ?? 1) : 0; }
  start() {
    const c = this.a.ctx; if (!c || this.master) return;
    this.master = c.createGain(); this.master.gain.value = this.level(); this.master.connect(this.a.bus || c.destination);
    this.play(TRACK[this.mode]);
  }
  // one <audio> per track, made the first time it is needed; each has its own fader into the master
  track(name) {
    if (this.el[name]) return this.el[name]; const c = this.a.ctx, au = new window.Audio(BASE + name + '.mp3'); au.loop = true; au.preload = 'auto'; au.crossOrigin = 'anonymous';
    const g = c.createGain(); g.gain.value = 0; try { c.createMediaElementSource(au).connect(g); } catch (e) { } g.connect(this.master); return this.el[name] = { au, g };
  }
  play(name, fade = 2.5) {
    if (!this.master) return; const t = this.a.ctx.currentTime;
    for (const [k, v] of Object.entries(this.el)) if (k !== name) { v.g.gain.setTargetAtTime(0, t, fade / 3); clearTimeout(v.stopT); v.stopT = setTimeout(() => { if (this.cur !== k) v.au.pause(); }, fade * 1500 + 500); }
    this.cur = name; if (!name) return; const tr = this.track(name); clearTimeout(tr.stopT); if (tr.au.paused) tr.au.play().catch(() => { }); tr.g.gain.setTargetAtTime(1, t, fade / 3);
  }
  // the game asks for a mood every frame; only switch once the new one has been wanted for a few seconds, so tracks don't flicker
  set(mode) {
    if (!TRACK.hasOwnProperty(mode) || this.lock) return; if (mode === this.mode) { this.want = null; return; }
    const now = performance.now(); if (this.want !== mode) { this.want = mode; this.wantT = now; }
    const same = TRACK[mode] === TRACK[this.mode]; if (!same && mode !== 'off' && mode !== 'title' && this.mode !== 'title' && now - this.wantT < (mode === 'calm' ? 9000 : 3500)) return;
    this.want = null; this.mode = mode; if (!same) this.play(TRACK[mode]);
  }
  toggle() { this.on = !this.on; this.save(); this.fade(); return this.on; }
  setVol(v) { this.vol = v; this.save(); this.fade(); }
  fade(k = 1) { if (this.master) this.master.gain.setTargetAtTime(this.level() * k, this.a.ctx.currentTime, 0.2); }
  // the drop: the war theme from the top, a little under the roar of the ride
  dropScore() { if (!this.master) this.start(); if (!this.master) return; this.lock = true; this.mode = 'drop'; const tr = this.track('war'); try { tr.au.currentTime = 0; } catch (e) { } this.play('war', 1.5); this.fade(0.8); }
  endScore() { if (!this.lock) return; this.lock = false; this.mode = 'calm'; this.want = null; this.fade(1); this.play('calm', 4); }
  // after the sound engine restarts, everything tied to the old one is dropped; start() builds it again
  reset() { for (const v of Object.values(this.el)) { try { v.au.pause(); } catch (e) { } } this.el = {}; this.master = null; this.lock = false; if (this.mode === 'drop') this.mode = 'calm'; }
}

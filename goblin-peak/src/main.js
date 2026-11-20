// Goblin Peak: boot, input, saving, the frame loop, and moving between the village and the mountain stages.
import * as THREE from 'three';
import { World, THEMES } from './world.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { LEVELS, ORDER, ITEMS, RELICS } from './levels.js';

const $ = id => document.getElementById(id), KEY = 'goblin-peak-save-1';
const fresh = () => ({ coins: 0, items: {}, upg: {}, done: {}, toll: {}, bombs: 0, jewels: {}, relics: {}, camp: {}, seen: {}, best: {}, stats: {}, sens: 1, third: false, won: false, cur: 'hub', played: 0 });

class Input {
  constructor() { this.k = {}; this.h = {}; this.mx = 0; this.my = 0; this.lmbHit = false; this.rmbHit = false; }
  down(c) { return !!this.k[c]; } hit(c) { return !!this.h[c]; }
  end() { this.h = {}; this.mx = this.my = 0; this.lmbHit = this.rmbHit = false; }
  clear() { this.h = {}; this.lmbHit = this.rmbHit = false; }
}

class Game {
  constructor() {
    this.canvas = $('game'); this.input = new Input(); this.audio = new Audio(); this.time = 0; this.frame = 0; this.locked = false; this.playing = false; this.paused = true;
    this.load(); { const S = this.save; S.relics = S.relics || {}; for (const id in S.jewels) (S.jewels[id] || []).forEach((v, i) => { if (v && RELICS[id] && RELICS[id][i]) S.relics[RELICS[id][i].id] = 1; }); }
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' }); r.setPixelRatio(Math.min(devicePixelRatio, 1.5)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(78, 1, 0.1, 1600);
    this.player = new Player(this); this.player.third = !!this.save.third; if (this.save.camDist) this.player.camDist = this.save.camDist; this.camera.add(this.player.hands);
    this.ui = new UI(this); this.bind(); this.resize(); addEventListener('resize', () => this.resize());
    $('btnContinue').hidden = !this.save.played; $('btnNew').textContent = this.save.played ? 'New game' : 'Start the climb';
    this.last = performance.now(); requestAnimationFrame(t => this.loop(t));
    const q = new URLSearchParams(location.search); this.debug = q.has('debug'); if (q.get('level')) { this.begin(q.get('level')); }
    else if (!q.has('split')) { this.buildRealm(); this.loadLevel(this.save.played ? this.save.cur : 'hub', true); }
    else this.loadLevel(this.save.played ? this.save.cur : 'hub', true);
  }
  load() { try { this.save = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { this.save = fresh(); } }
  saveNow() { try { localStorage.setItem(KEY, JSON.stringify(this.save)); } catch (e) { } }
  resize() { const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  bind() {
    const I = this.input, c = this.canvas;
    addEventListener('keydown', e => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow') || ((e.ctrlKey || e.metaKey || e.altKey) && this.playing && e.code !== 'KeyR' && e.code !== 'F5')) e.preventDefault(); if (!e.repeat) I.h[e.code] = true; I.k[e.code] = true;
      if (!this.playing) return;
      if (e.code === 'KeyV' && !this.locked) { this.player.third = this.save.third = !this.player.third; if (this.player.third && this.player.camDist < 2.5) this.player.camDist = 6.2; }
      if (e.code === 'KeyP' || e.code === 'Escape' && !document.pointerLockElement && !this.ui.shopOpen) this.pause(!this.paused);
      if (e.code === 'KeyF') this.fullscreen();
      if (e.code === 'KeyH') { this.save.clean = !this.save.clean; document.body.classList.toggle('clean', !!this.save.clean); this.ui.toast(this.save.clean ? 'Hints hidden. H brings them back.' : 'Hints shown.', 2); }
      if (e.code === 'KeyN' && !this.locked) this.ui.toast(this.audio.toggleMusic() ? 'Music on' : 'Music off', 2);
    });
    addEventListener('keyup', e => { I.k[e.code] = false; });
    addEventListener('blur', () => { I.k = {}; });
    c.addEventListener('mousedown', e => { this.audio.unlock(); if (!this.playing || this.paused) return; if (document.pointerLockElement !== c && !this.testing) { c.requestPointerLock(); return; } if (this.ui.dlg) { this.ui.advance(); return; } if (e.button === 0) I.lmbHit = true; if (e.button === 2) I.rmbHit = true; });
    c.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); return; } if (!this.playing || this.paused || this.ui.mapOpen) return; const P = this.player; let d = (P.third ? P.camDist : 0) + Math.sign(e.deltaY) * 1.1; if (d > 0 && d < 2.5) d = e.deltaY > 0 ? 2.5 : 0; d = Math.max(0, Math.min(14, d)); P.third = this.save.third = d >= 2.5; if (P.third) P.camDist = this.save.camDist = d; }, { passive: false });
    addEventListener('mousemove', e => { if (document.pointerLockElement === c && !this.paused) { I.mx += e.movementX; I.my += e.movementY; } });
    document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== c && this.playing && !this.paused && !this.testing && !this.ui.doneCb) this.pause(true); });
    $('btnNew').onclick = () => { this.audio.unlock(); if (this.save.played && !confirm('Start again from the beginning? Your saved climb will be erased.')) return; this.save = fresh(); this.player.third = false; this.begin('hub'); };
    $('btnContinue').onclick = () => { this.audio.unlock(); this.begin(this.save.cur || 'hub'); };
    $('btnResume').onclick = () => this.pause(false);
    $('btnFull').onclick = () => this.fullscreen();
    $('btnVillage').onclick = () => { this.pause(false); if (!this.world.def.hub) this.loadLevel('hub'); };
    $('btnCamp').onclick = () => { this.pause(false); this.toCamp(); };
    $('sens').oninput = e => { this.save.sens = +e.target.value; };
    $('doneBtn').onclick = () => { this.ui.closeDone(); this.canvas.requestPointerLock(); };
    $('shop').onclick = e => { const r = e.target.closest('.row'); if (r) this.ui.buy([...r.parentNode.children].indexOf(r)); };
  }
  fullscreen(on) { const d = document; try { if (!d.fullscreenElement) { const p = d.documentElement.requestFullscreen({ navigationUI: 'hide' }); if (p && p.catch) p.catch(() => { }); } else if (on === undefined) d.exitFullscreen(); } catch (e) { } }
  begin(id) { if (!this.testing && !this.debug) this.fullscreen(true); document.body.classList.toggle('clean', !!this.save.clean); this.playing = true; $('title').hidden = true; $('hud').hidden = false; this.save.played = 1; this.loadLevel(id); this.pause(false); }
  pause(on) {
    this.paused = on; $('pause').hidden = !on || !this.playing; if (on) { if (document.pointerLockElement) document.exitPointerLock(); $('sens').value = this.save.sens; $('btnVillage').hidden = this.world.def.hub; $('btnCamp').hidden = this.world.def.hub; this.saveNow(); }
    else if (this.playing && !this.testing) { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
  }
  // ---- one open world: the village and the three mountains all exist at once; whichever you stand in is the live one
  buildRealm() {
    const root = this.root = new THREE.Scene(); World.dressSky(this, root, THEMES.meadow);
    const rg = this.rg = new THREE.Group(); root.add(rg, this.player.model, this.player.rope, this.camera);
    const gp = new THREE.Mesh(new THREE.CircleGeometry(1700, 64), new THREE.MeshLambertMaterial({ color: new THREE.Color(...THEMES.meadow.ground).multiplyScalar(0.95) })); gp.rotation.x = -Math.PI / 2; gp.position.y = -0.05; gp.receiveShadow = true; rg.add(gp);
    const dirs = { l1: [-1, 0, 0], l2: [0, -1, -Math.PI / 2], l3: [1, 0, Math.PI] }; this.regions = {};
    for (const id of ['hub', 'l1', 'l2', 'l3']) { const W = new World(this, LEVELS[id], true), d = dirs[id], Dm = d ? W.spiral.R0 + 200 : 0; W.xf = d ? { ox: d[0] * Dm, oz: d[1] * Dm, rot: d[2] } : { ox: 0, oz: 0, rot: 0 }; W.scene.position.set(W.xf.ox, 0, W.xf.oz); W.scene.rotation.y = W.xf.rot; rg.add(W.scene); this.regions[id] = W; }
    this.trailhead = i => { const W = this.regions[ORDER[i]], g = this.toGlobal(W, W.start.x, W.start.z); return g; };
  }
  rotY(x, z, t) { const c = Math.cos(t), s = Math.sin(t); return [x * c + z * s, -x * s + z * c]; }
  toGlobal(W, x, z) { const r = this.rotY(x, z, W.xf.rot); return [r[0] + W.xf.ox, r[1] + W.xf.oz]; }
  setActive(W) {
    this.world = W; const { ox, oz, rot } = W.xf, p = this.rotY(ox, oz, -rot); this.rg.rotation.y = -rot; this.rg.position.set(-p[0], 0, -p[1]);
    const th = W.theme; this.root.fog.color.set(th.fog[0]); this.root.background.set(th.fog[0]); this.root.fog.near = W.def.hub ? 160 : th.fog[1] + 60; this.root.fog.far = W.def.hub ? 1000 : 760; this.save.cur = W.def.id; this.audio.music(th.music);
  }
  // Walking out of one place and into the next: swap which map is live and carry the hero across without a break.
  handoff() {
    const W = this.world, P = this.player, g = this.toGlobal(W, P.pos.x, P.pos.z), dv = Math.hypot(g[0], g[1]); let next = null, best = 1e9;
    for (const id of ORDER) { const m = this.regions[id], d = Math.hypot(g[0] - m.xf.ox, g[1] - m.xf.oz) - m.spiral.R0; if (d < 125 && d < best) { best = d; next = m; } }
    if (W.def.hub) { if (dv <= 92) next = null; } else if (dv < 80) next = this.regions.hub; else if (next === W || next && Math.hypot(g[0] - W.xf.ox, g[1] - W.xf.oz) - W.spiral.R0 < best + 12) next = null;
    if (!next || next === W) return;
    const l = this.rotY(g[0] - next.xf.ox, g[1] - next.xf.oz, -next.xf.rot), dr = W.xf.rot - next.xf.rot, v = this.rotY(P.vel.x, P.vel.z, dr);
    P.pos.x = l[0]; P.pos.z = l[1]; P.vel.x = v[0]; P.vel.z = v[1]; P.yaw += dr; P.faceYaw += dr; P.model.rotation.y += dr; P.routePhi = undefined; P.detach(); P.ground = null; this.levelT = 0;
    this.setActive(next); this.ui.area(next.def.name); this.saveNow();
  }
  loadLevel(id, quiet) {
    if (this.regions) { const W = this.regions[id] || this.regions.hub; $('fade').style.opacity = 1; this.setActive(W); this.levelT = 0; this.locked = false; this.toCamp(true); if (W.def.hub) { const g = W.guide(), p = this.player; if (g) p.yaw = Math.atan2(-(g.x - p.pos.x), -(g.z - p.pos.z)); } if (!quiet) { this.ui.area(W.def.name); this.saveNow(); } setTimeout(() => { $('fade').style.opacity = 0; }, 150); return; }
    const def = LEVELS[id] || LEVELS.hub; $('fade').style.opacity = 1;
    if (this.world) { this.world.scene.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.geometry && o.geometry.index && o.geometry.index.count > 2000) o.geometry.dispose(); }); this.renderer.renderLists.dispose(); }
    const W = this.world = new World(this, def); W.scene.add(this.player.model, this.player.rope, this.camera);
    this.save.cur = def.id; this.levelT = 0; this.locked = false; this.toCamp(true);
    if (def.hub) { const g = W.guide(), p = this.player; if (g) p.yaw = Math.atan2(-(g.x - p.pos.x), -(g.z - p.pos.z)); }
    this.audio.music(W.theme.music); if (!quiet) { this.ui.area(def.name); this.saveNow(); }
    setTimeout(() => { $('fade').style.opacity = 0; }, 150);
  }
  // Back to the last campfire you lit on this map (or the trailhead).
  toCamp(silent) { const W = this.world, n = this.save.camp[W.def.id] || 0, c = n && W.camps[n - 1]; let s = W.start; if (c) { const f = c.sec.spawn; s = { x: f.x, y: f.y, z: f.z, yaw: Math.atan2(-f.tx, -f.tz) }; } this.player.spawn(s.x, s.y + 0.1, s.z, s.yaw); if (!silent) this.ui.toast('Back at camp.', 2); }
  addCoins(n, quiet) { this.save.coins += n; this.audio.sfx('coin'); this.stat('coins', n); $('coinBox').classList.remove('pop'); void $('coinBox').offsetWidth; $('coinBox').classList.add('pop'); }
  loseCoins() { const n = Math.min(this.save.coins, Math.max(5, Math.round(this.save.coins * 0.12)) >> (this.save.upg.purse ? 1 : 0), 30); if (n > 0) { this.save.coins -= n; const p = this.player.pos; this.world.dropCoins(p.x, p.y + 1.2, p.z, n); } }
  give(item) { this.save.items[item] = 1; this.saveNow(); this.audio.sfx('item'); const it = ITEMS[item]; this.ui.dialog([{ who: 'You found', text: it.name + '!' }, { who: it.name, text: it.text }]); }
  gotJewel(idx) { const id = this.world.def.id, a = this.save.jewels[id] = this.save.jewels[id] || []; a[idx] = 1; const r = (RELICS[id] || [])[idx]; if (r) this.save.relics[r.id] = 1; this.audio.sfx('jewel'); this.saveNow(); this.ui.dialog([{ who: 'You found a relic', text: (r ? r.name : 'A relic') + `!  (${a.filter(Boolean).length} of 3 on this trail)` }, { who: r ? r.name : 'Relic', text: r ? r.text : '' }]); }
  stat(k, n = 1) { this.save.stats[k] = (this.save.stats[k] || 0) + n; }
  fmt(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + String(s).padStart(2, '0'); }
  completeLevel() {
    const id = this.world.def.id, S = this.save, first = !S.done[id]; S.done[id] = 1; const t = this.levelT; if (!S.best[id] || t < S.best[id]) S.best[id] = t; this.audio.sfx('win'); if (first) S.coins += 50; S.camp[id] = 0; this.saveNow();
    const nx = ORDER[ORDER.indexOf(id) + 1]; if (document.pointerLockElement) document.exitPointerLock();
    this.ui.levelDone({ title: this.world.def.name + ' cleared!', body: `<p>Time on the trail: <b>${this.fmt(t)}</b> (best ${this.fmt(S.best[id])})</p><p>Relics found: <b>${(S.jewels[id] || []).filter(Boolean).length}/3</b></p><p>Coins: <b>${S.coins}</b>${first ? ' (including a 50 coin bonus)' : ''}</p><p>${nx ? `The way to <b>${LEVELS[nx].name}</b> is now open, back in the village.` : ''}</p>` }, () => this.loadLevel('hub'));
  }
  finishGame() {
    const S = this.save; if (S.won) return; S.won = true; S.done.l3 = 1; this.saveNow(); this.audio.sfx('win'); if (document.pointerLockElement) document.exitPointerLock(); const st = S.stats, jw = ORDER.reduce((a, id) => a + (S.jewels[id] || []).filter(Boolean).length, 0);
    this.ui.levelDone({ title: 'The Princess is free!', body: `<p>Chieftain Grizzlegut was last seen rolling past the village, still shouting.</p><p>Total time: <b>${this.fmt(S.played)}</b></p><p>Goblins and friends bonked: <b>${st.bonked || 0}</b> · Times shoved about: <b>${(st.knocked || 0) + (st.flattened || 0)}</b></p><p>Relics: <b>${jw}/9</b> · Coins collected: <b>${st.coins || 0}</b></p><p>The mountain stays open: go back for the relics you missed.</p><p class="small">Goblin Peak. Music by Matthew Pablo, Hitctrl (CC-BY 3.0), cynicmusic, RandomMind and Juhani Junkala (CC0).</p>` }, () => { });
  }
  step(dt) {
    this.time += dt; this.frame++; this.levelT += dt; this.save.played += dt;
    this.world.update(dt); this.player.update(dt); if (this.regions) this.handoff(); this.ui.update(dt);
    if (this.frame % 600 === 0) this.saveNow();
  }
  loop(t) {
    requestAnimationFrame(tt => this.loop(tt)); const dt = Math.min(0.033, (t - this.last) / 1000); this.last = t;
    if (this.playing && !this.paused) this.step(dt); else if (!this.playing) { this.time += dt; const p = this.player; p.yaw += dt * 0.08; p.pos.set(Math.sin(this.time * 0.05) * 20, 14, 30); }
    this.player.updateCamera(dt, this.camera); if (!this.playing) { this.player.model.visible = false; this.player.hands.visible = false; this.camera.position.y = 16; this.camera.rotation.set(-0.15, this.player.yaw, 0); }
    this.input.end(); this.renderer.render(this.root || this.world.scene, this.camera);
  }
}
window.G = new Game();

// Goblin Peak: boot, input, saving, the frame loop, and moving between the village and the mountain stages.
import * as THREE from 'three';
import { World, THEMES } from './world.js';
import { ACT_TOTAL } from './lowland.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { Net } from './net.js';
import { LEVELS, ORDER, ITEMS, RELICS } from './levels.js';

const $ = id => document.getElementById(id), KEY = 'goblin-peak-save-1';
const fresh = () => ({ coins: 0, items: { whip: 1 }, upg: {}, done: {}, toll: {}, bombs: 0, jewels: {}, relics: {}, acts: {}, run: {}, camp: {}, seen: {}, best: {}, stats: {}, sens: 1, third: false, won: false, cur: 'hub', played: 0 });

class Input {
  constructor() { this.k = {}; this.h = {}; this.mx = 0; this.my = 0; this.lmbHit = false; this.rmbHit = false; }
  down(c) { return !!this.k[c]; } hit(c) { return !!this.h[c]; }
  end() { this.h = {}; this.mx = this.my = 0; this.lmbHit = this.rmbHit = false; }
  clear() { this.h = {}; this.lmbHit = this.rmbHit = false; }
}

class Game {
  constructor() {
    this.canvas = $('game'); this.input = new Input(); this.audio = new Audio(); this.time = 0; this.frame = 0; this.locked = false; this.playing = false; this.paused = true;
    try { const m = sessionStorage.getItem('gp-mp'); if (m) { sessionStorage.removeItem('gp-mp'); this.mp = JSON.parse(m); this.coop = true; } } catch (e) { }
    if (this.mp) this.save = fresh(); else this.load(); { const S = this.save; S.items.whip = 1; S.relics = S.relics || {}; for (const id in S.jewels) (S.jewels[id] || []).forEach((v, i) => { if (v && RELICS[id] && RELICS[id][i]) S.relics[RELICS[id][i].id] = 1; }); }
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' }); r.setPixelRatio(Math.min(devicePixelRatio, 1.5)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(78, 1, 0.1, 1600);
    this.player = new Player(this); this.player.third = !!this.save.third; if (this.save.camDist) this.player.camDist = this.save.camDist; this.camera.add(this.player.hands);
    this.net = new Net(this); this.ui = new UI(this); this.bind(); this.resize(); addEventListener('resize', () => this.resize());
    $('btnContinue').hidden = !this.save.played; $('btnNew').textContent = this.save.played ? 'New game' : 'Play';
    this.last = performance.now(); requestAnimationFrame(t => this.loop(t));
    const q = new URLSearchParams(location.search); this.debug = q.has('debug'); if (q.get('level')) { this.begin(q.get('level')); }
    else if (!q.has('split')) { this.buildRealm(); this.loadLevel(this.save.played ? this.save.cur : 'hub', true); }
    if (this.mp && this.regions) { const m = this.mp; this.net.name = m.name || 'Hero'; if (m.host) this.net.host(m.code); else this.net.join(m.code); this.testing = q.has('debug'); this.begin('lobby'); this.testing = false; this.ui.toast(m.host ? `You are hosting a fresh climb. Tell your friends the code: ${m.code}. Click the game to take control.` : `Joining ${m.code} on a fresh climb. Click the game to take control.`, 14); }
    else this.loadLevel(this.save.played ? this.save.cur : 'hub', true);
  }
  load() { try { this.save = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { this.save = fresh(); } }
  saveNow() { if (this.coop) return; try { localStorage.setItem(KEY, JSON.stringify(this.save)); } catch (e) { } }     // an online climb never touches the solo save
  resize() { const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  bind() {
    const I = this.input, c = this.canvas;
    addEventListener('keydown', e => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow') || ((e.ctrlKey || e.metaKey || e.altKey) && this.playing && e.code !== 'KeyR' && e.code !== 'F5')) e.preventDefault(); if (!e.repeat) I.h[e.code] = true; I.k[e.code] = true;
      if (!this.playing) return;
      if (e.code === 'KeyV' && !this.locked) { this.player.third = this.save.third = !this.player.third; if (this.player.third && this.player.camDist < 2.5) this.player.camDist = 6.2; }
      if (e.code === 'KeyP' || e.code === 'Escape' && !document.pointerLockElement && !this.ui.shopOpen) this.pause(!this.paused);
      if (e.code === 'KeyU') this.fullscreen();
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
    const nm = () => { this.net.name = ($('netName').value || 'Hero').trim().slice(0, 12) || 'Hero'; this.save.name = this.net.name; };
    $('netName').value = localStorage.getItem(KEY + '-name') || ''; $('netCode').addEventListener('keydown', e => e.stopPropagation()); $('netName').addEventListener('keydown', e => e.stopPropagation());
    // Going online reloads into a clean world: everyone starts from nothing, with the co-op obstacles built in.
    const goOnline = o => { nm(); try { localStorage.setItem(KEY + '-name', this.net.name); sessionStorage.setItem('gp-mp', JSON.stringify(Object.assign(o, { name: this.net.name }))); } catch (e) { } const u = new URL(location.href); location.href = u.pathname + u.search; };
    $('btnHost').onclick = () => goOnline({ host: 1, code: this.net.makeCode() });
    $('btnJoin').onclick = () => { const c = $('netCode').value.trim().toUpperCase(); if (c.length < 4) { $('netCode').focus(); return; } goOnline({ host: 0, code: c }); };
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
    this.paused = on; $('pause').hidden = !on || !this.playing; if (on) { if (document.pointerLockElement) document.exitPointerLock(); $('sens').value = this.save.sens; $('netInfo').textContent = this.net.on ? `Online: ${this.net.status}  ·  ${this.net.count()} player${this.net.count() > 1 ? 's' : ''}  ·  T drops a rope, E boosts a friend, whip a friend to haul them up` : ''; $('btnVillage').hidden = this.world.def.hub; $('btnCamp').hidden = this.world.def.hub; this.saveNow(); }
    else if (this.playing && !this.testing) { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
  }
  // ---- one open world: the village and the three mountains all exist at once; whichever you stand in is the live one
  buildRealm() {
    const root = this.root = new THREE.Scene(); World.dressSky(this, root, THEMES.meadow);
    const rg = this.rg = new THREE.Group(); root.add(rg, this.player.model, this.player.rope, this.camera);
    const gp = new THREE.Mesh(new THREE.CircleGeometry(1700, 64), new THREE.MeshLambertMaterial({ color: new THREE.Color(...THEMES.meadow.ground).multiplyScalar(0.95) })); gp.rotation.x = -Math.PI / 2; gp.position.y = -14; gp.receiveShadow = true; rg.add(gp);
    const dirs = { l1: [-1, 0, 0], l2: [0, -1, -Math.PI / 2], l3: [1, 0, Math.PI] }; this.regions = {};
    this.holes = []; this.save.acts = this.save.acts || {};
    for (const id of ['l1', 'l2', 'l3', this.coop ? 'lobby' : 'hub']) { const W = new World(this, LEVELS[id], true), d = dirs[id], Dm = d ? W.spiral.R0 + 200 : 0; W.xf = d ? { ox: d[0] * Dm, oz: d[1] * Dm, rot: d[2] } : { ox: 0, oz: 0, rot: 0 }; if (d) { this.holes.push({ x: W.xf.ox, z: W.xf.oz, r: W.spiral.R0 }); W.terrainMesh.position.y = 0.03; } W.scene.position.set(W.xf.ox, 0, W.xf.oz); W.scene.rotation.y = W.xf.rot; rg.add(W.scene); this.regions[id] = W; }
    if (this.coop) this.regions.hub = this.regions.lobby;
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
    if (this.coop) return;      // online, players are moved by the race, not by walking
    const W = this.world, P = this.player, g = this.toGlobal(W, P.pos.x, P.pos.z), dv = Math.hypot(g[0], g[1]); let next = null, best = 1e9;
    for (const id of ORDER) { const m = this.regions[id], d = Math.hypot(g[0] - m.xf.ox, g[1] - m.xf.oz) - m.spiral.R0; if (d < 118 && d < best) { best = d; next = m; } }
    if (!W.def.hub) { const own = Math.hypot(g[0] - W.xf.ox, g[1] - W.xf.oz) - W.spiral.R0; if (own <= 130 && (!next || next === W || own < best + 12)) next = null; else if (!next || next === W) next = this.regions.hub; }
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
  loseCoins() { const n = Math.min(this.save.coins, Math.max(2, Math.round(this.save.coins * 0.06)) >> (this.save.upg.purse ? 1 : 0), 10); if (n > 0) { this.save.coins -= n; const p = this.player.pos; this.world.dropCoins(p.x, p.y + 1.2, p.z, n); } }
  give(item) { if (this.mode !== 'race') this.net.send({ t: 'item', k: item }); this.save.items[item] = 1; this.saveNow(); this.audio.sfx('item'); const it = ITEMS[item]; this.ui.dialog([{ who: 'You found', text: it.name + '!' }, { who: it.name, text: it.text }]); }
  gotJewel(idx) { if (this.mode !== 'race') this.net.send({ t: 'relic', r: this.world.def.id, i: idx }); const id = this.world.def.id, a = this.save.jewels[id] = this.save.jewels[id] || []; a[idx] = 1; const r = (RELICS[id] || [])[idx]; if (r) this.save.relics[r.id] = 1; this.audio.sfx('jewel'); this.saveNow(); this.ui.dialog([{ who: 'You found a relic', text: (r ? r.name : 'A relic') + `!  (${a.filter(Boolean).length} of 3 on this trail)` }, { who: r ? r.name : 'Relic', text: r ? r.text : '' }]); }
  // Online with a partner, three knocks in quick succession leave you dizzy on the ground until a friend helps you up.
  dazed() { const P = this.player, N = this.net; if (N.count() < 2 || P.down > 0 || this.mode === 'race') return; P.daze = (P.daze || 0) + 1; P.dazeT = 9; if (P.daze >= 3) { P.daze = 0; P.down = 16; this.ui.toast('You are seeing stars. A friend can help you up (E beside you), or wait it out.', 6); N.call(true); } }
  // A real fall costs coins, and they are not left lying about: they go back to the places they were first picked up, for anyone to find.
  fallCost() { const S = this.save, n = Math.min(S.coins, Math.max(5, Math.min(40, Math.round(S.coins * 0.2)))); if (n <= 0) return; S.coins -= n; let back = 0; const took = this.took || []; while (back < n && took.length) { const [r, i] = took.pop(), W = this.regions ? this.regions[r] : (this.world.def.id === r ? this.world : null); if (W) { W.showCoin(i); this.net.send({ t: 'cr', r, i }); back++; } } this.ui.toast(`That fall cost you ${n} coins.` + (back ? ` ${back} of them are back where they were first found.` : ''), 5); }
  // Fall too far off the mountain and you are put back at your last lit campfire (or the trailhead).
  lucky(dt) {
    const P = this.player, W = this.world, S = this.save, COST = 15, WAIT = 8; if (P.dazeT > 0 && (P.dazeT -= dt) <= 0) P.daze = 0; if (this.callMark) this.callMark.t -= dt;
    if (!this.fall) { const sf = P.safe; if (sf && sf.r === W.def.id && !W.def.hub && P.pos.y < sf.y - 12 && !this.locked && !P.zep) { this.fall = { r: sf.r, t: WAIT }; this.audio.sfx('nope'); this.fallCost(); } return; }
    const f = this.fall, n = S.camp[W.def.id] || 0, c = n && W.camps[n - 1], where = c ? (c.sec.name || 'your campfire') : 'the trailhead'; f.t -= dt;
    if (f.r !== W.def.id) { this.fall = null; this.ui.show('lucky', false); return; }
    const pay = this.input.hit('KeyR') && S.coins >= COST && !this.locked; this.ui.show('lucky', true);
    this.ui.set('luckyT', S.coins >= COST ? `You fell.  R: back to ${where} right now (${COST} coins)  ·  or wait ${Math.ceil(f.t)} s to go back free` : `You fell. Going back to ${where} in ${Math.ceil(f.t)} s  (a quick return costs ${COST} coins; you have ${S.coins})`);
    if (pay || f.t <= 0) { if (pay) { S.coins -= COST; this.audio.sfx('buy'); } this.fall = null; P.safe = null; this.ui.show('lucky', false); this.toCamp(true); P.inv = 2; this.audio.sfx('camp'); this.ui.toast(`Back at ${where}.` + (pay ? ` (${COST} coins for the quick trip.)` : ''), 4); }
  }
  // Online: a fresh copy of the chosen mountain, everyone wiped clean and lined up, then a countdown.
  startRace(map, mode, slot, n) {
    const S = this.save, old = this.regions[map]; this.mode = mode; this.raceMap = map; this.fall = null; this.ui.show('lucky', false);
    S.items.whip = 1; Object.assign(S, { relics: {}, jewels: {}, camp: {}, run: {}, done: {}, best: {}, seen: {} });      // coins and bought upgrades carry on from the town this.lineUses = 0;
    this.rg.remove(old.scene); const W = new World(this, LEVELS[map], true); W.xf = old.xf; W.scene.position.copy(old.scene.position); W.scene.rotation.y = old.scene.rotation.y; W.terrainMesh.position.y = 0.03; this.rg.add(W.scene); this.regions[map] = W;
    this.setActive(W); const s0 = W.secs[0], f = s0.at(4, (slot - (n - 1) / 2) * 1.7, 0), P = this.player; P.spawn(f.x, f.y + 0.1, f.z, Math.atan2(-f.tx, -f.tz)); P.down = 0; P.daze = 0; P.safe = null;
    this.count = 19.99; this.locked = true; this.ui.show('lobbyBox', false); this.ui.closeAll(); this.audio.sfx('camp');
  }
  toLobby() { this.mode = null; this.count = 0; this.locked = false; this.player.zep = false; this.audio.music(this.world.theme.music); this.loadLevel('lobby'); const a = Math.random() * 6.28; this.player.spawn(Math.cos(a) * 4, 0.2, 10 + Math.sin(a) * 3, 0); }
  // One of the hundred lowland adventures done.
  act(id, name, coins, x, y, z) { const S = this.save; if (S.acts[id]) return; this.net.send({ t: 'act', id, name }); S.acts[id] = 1; const n = Object.keys(S.acts).length; this.audio.sfx('jewel'); if (coins) this.world.dropCoins(x, y, z, Math.min(40, coins)); this.ui.toast(`${name}!  Lowland adventures: ${n} of ${ACT_TOTAL}` + (n === ACT_TOTAL ? '. Every single one. The stones were right about you.' : ''), 5); this.saveNow(); }
  stat(k, n = 1) { this.save.stats[k] = (this.save.stats[k] || 0) + n; }
  fmt(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + String(s).padStart(2, '0'); }
  completeLevel() {
    if (this.coop) return this.net.finished();
    const id = this.world.def.id, S = this.save, first = !S.done[id]; S.done[id] = 1; const t = S.run[id] || this.levelT; S.run[id] = 0; if (!S.best[id] || t < S.best[id]) S.best[id] = t; this.audio.sfx('win'); if (first) S.coins += 50; S.camp[id] = 0; this.saveNow();
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.levelDone({ title: `${this.world.def.name} (${this.world.def.tag}) cleared!`, body: `<p>Your time: <b>${this.fmt(t)}</b> (best ${this.fmt(S.best[id])})</p><p>Relics found: <b>${(S.jewels[id] || []).filter(Boolean).length}/3</b></p><p>Coins: <b>${S.coins}</b>${first ? ' (including a 50 coin bonus)' : ''}</p><p>Back to town. Pick your next mountain at the red beam.</p>` }, () => this.loadLevel('hub'));
  }
  finishGame() {
    const S = this.save; if (S.won) return; S.won = true; S.done.l3 = 1; this.saveNow(); this.audio.sfx('win'); if (document.pointerLockElement) document.exitPointerLock(); const st = S.stats, jw = ORDER.reduce((a, id) => a + (S.jewels[id] || []).filter(Boolean).length, 0);
    this.ui.levelDone({ title: 'The Princess is free!', body: `<p>Chieftain Grizzlegut was last seen rolling past the village, still shouting.</p><p>Total time: <b>${this.fmt(S.played)}</b></p><p>Goblins and friends bonked: <b>${st.bonked || 0}</b> · Times shoved about: <b>${(st.knocked || 0) + (st.flattened || 0)}</b></p><p>Relics: <b>${jw}/9</b> · Coins collected: <b>${st.coins || 0}</b></p><p>The mountain stays open: go back for the relics you missed.</p><p class="small">Goblin Peak. Music by Matthew Pablo, Hitctrl (CC-BY 3.0), cynicmusic, RandomMind and Juhani Junkala (CC0).</p>` }, () => { });
  }
  step(dt) {
    this.time += dt; this.frame++; this.levelT += dt; this.save.played += dt; { const S = this.save, id = this.world.def.id; S.run = S.run || {}; if (!this.world.def.hub && !this.locked) S.run[id] = (S.run[id] || 0) + dt; }
    this.world.update(dt); this.player.update(dt); if (this.count > 0) { const c0 = Math.ceil(this.count); this.count -= dt; const c1 = Math.ceil(this.count); this.locked = true; this.ui.count(this.count > 0 ? c1 : 'GO!'); if (c1 !== c0 && (c1 <= 5 || c1 % 5 === 0)) this.audio.sfx(this.count > 0 ? 'coin' : 'win'); if (this.count <= 0) { this.locked = false; this.save.run = {}; setTimeout(() => this.ui.count(null), 900); } }
    if (this.coop && this.world.def.lobby) { const P = this.player.pos; for (const h of this.holes) { const dx = P.x - h.x, dz = P.z - h.z, d = Math.hypot(dx, dz), lim = h.r + 124; if (d < lim) { P.x = h.x + dx / d * lim; P.z = h.z + dz / d * lim; if (!this.wallT || this.time - this.wallT > 6) { this.wallT = this.time; this.ui.toast('The mountains stay closed until the host starts a climb at the red CLIMBS beam in town.', 4); } } } }
    if (!this.coop && this.world.def.hub && this.world.mapAt) { // alone: the same choice of three mountains at the red beam
      const W = this.world, P = this.player.pos, I = this.input, at = Math.hypot(P.x - W.mapAt.x, P.z - W.mapAt.z) < 7; this.pick = this.pick || 'l1';
      if (at && !this.locked && !this.ui.shopOpen) { for (let i = 0; i < 3; i++) if (I.hit('Digit' + (i + 1))) this.pick = ORDER[i]; if (I.hit('Enter')) { const id = this.pick; this.save.camp[id] = 0; this.loadLevel(id); this.count = 2.99; this.locked = true; this.ui.soloMenu(null, false); return; } }
      this.ui.soloMenu(this.pick, at);
    } else if (!this.coop) this.ui.soloMenu(null, false);
    if (this.regions) this.handoff(); this.lucky(dt); this.net.update(dt); this.ui.update(dt);
    if (this.frame % 600 === 0) this.saveNow();
  }
  loop(t) {
    requestAnimationFrame(tt => this.loop(tt)); const dt = Math.min(0.033, (t - this.last) / 1000); this.last = t;
    if (this.hitstop > 0) { this.hitstop -= dt; } else if (this.playing && !this.paused) this.step(dt); else if (!this.playing) { this.time += dt; const p = this.player; p.yaw += dt * 0.08; p.pos.set(Math.sin(this.time * 0.05) * 20, 14, 30); }
    this.player.updateCamera(dt, this.camera); if (!this.playing) { this.player.model.visible = false; this.player.hands.visible = false; this.camera.position.y = 16; this.camera.rotation.set(-0.15, this.player.yaw, 0); }
    this.input.end(); this.renderer.render(this.root || this.world.scene, this.camera);
  }
}
window.G = new Game();

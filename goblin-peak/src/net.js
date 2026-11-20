// Online co-op: friends share the same mountain. Each player's own game runs the goblins and traps it sees;
// what is shared is where everyone is, plus the ways of helping each other: boosts, dropped ropes, whip-pulls and lit camps.
import * as THREE from 'three';
import * as M from './models.js';

const COLORS = [0x2f6fd8, 0xd8762c, 0x8a3ab5, 0xd8c12c, 0x2fb5a6, 0xd83a7a, 0x6a8a2a];
const PRE = 'goblinpeak-';
export class Net {
  constructor(G) { this.G = G; this.id = Math.random().toString(36).slice(2, 8); this.name = 'Hero'; this.on = false; this.isHost = false; this.code = ''; this.conns = []; this.peers = new Map(); this.acc = 0; this.ropes = []; this.status = ''; this.loop = new URLSearchParams(location.search).get('net') === 'loop'; }
  makeCode() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
  host(code) {
    this.code = code || this.makeCode(); this.isHost = true; this.on = true; this.status = 'Hosting. Code: ' + this.code;
    if (this.loop) { this.bc = new BroadcastChannel(PRE + this.code); this.bc.onmessage = e => this.recv(e.data, null); return this.code; }
    try { this.peer = new window.Peer(PRE + this.code); } catch (e) { this.status = 'Online play could not start.'; this.on = false; return ''; }
    this.peer.on('connection', c => { this.conns.push(c); c.on('data', d => this.recv(d, c)); c.on('close', () => { this.conns = this.conns.filter(x => x !== c); }); });
    this.peer.on('error', e => { this.status = e.type === 'unavailable-id' ? 'That code is taken. Try hosting again.' : 'Connection problem: ' + e.type; this.G.ui.toast(this.status, 5); });
    return this.code;
  }
  join(code) {
    this.code = (code || '').toUpperCase().trim(); if (!this.code) return; this.isHost = false; this.on = true; this.status = 'Joining ' + this.code + '...';
    if (this.loop) { this.bc = new BroadcastChannel(PRE + this.code); this.bc.onmessage = e => this.recv(e.data, null); this.status = 'Joined ' + this.code; return; }
    try { this.peer = new window.Peer(); } catch (e) { this.status = 'Online play could not start.'; this.on = false; return; }
    this.peer.on('open', () => { const c = this.peer.connect(PRE + this.code, { reliable: true }); this.conns = [c]; c.on('open', () => { this.status = 'Joined ' + this.code; this.G.ui.toast('Connected! Your friends appear in the world with their names over their heads.', 5); }); c.on('data', d => this.recv(d, c)); c.on('close', () => { this.status = 'The host left.'; this.G.ui.toast(this.status, 5); }); });
    this.peer.on('error', e => { this.status = e.type === 'peer-unavailable' ? 'No game found with code ' + this.code + '.' : 'Connection problem: ' + e.type; this.G.ui.toast(this.status, 6); });
  }
  send(m, except) { if (!this.on) return; m.from = m.from || this.id; if (this.bc) { this.bc.postMessage(m); return; } for (const c of this.conns) if (c !== except && c.open) c.send(m); }
  recv(m, conn) {
    if (!m || m.from === this.id) return; if (this.isHost && !this.bc) this.send(m, conn);      // the host passes everything on to the others
    const G = this.G, P = G.player;
    if (m.t === 's') { let q = this.peers.get(m.from); if (!q) { q = this.spawnPeer(m); G.ui.toast(m.n + ' joined the climb.', 4); } q.n = m.n; q.tx = m.p[0]; q.ty = m.p[1]; q.tz = m.p[2]; q.yaw = m.yaw; q.mode = m.m; q.sp = m.sp; q.seen = G.time; if (q.r !== m.r) { q.r = m.r; q.x = q.tx; q.y = q.ty; q.z = q.tz; this.place(q); } }
    else if (m.t === 'boost' && m.to === this.id) { P.vel.y = 17; P.grounded = false; P.jumps = 1; P.pos.y += 0.1; G.audio.sfx('bounce'); G.ui.toast((this.nameOf(m.from)) + ' gave you a boost!', 3); }
    else if (m.t === 'pull' && m.to === this.id && m.r === G.world.def.id) { P.climb = P.swing = null; P.zip = { x: m.p[0], y: m.p[1] + 1.4, z: m.p[2], t: 0, last: 1e9, stuck: 0, sp: 24, pop: 6, sx: m.p[0], sy: m.p[1] + 1.4, sz: m.p[2] }; P.grounded = false; G.audio.sfx('whip'); G.ui.toast(this.nameOf(m.from) + ' is hauling you up with the whip!', 3); }
    else if (m.t === 'rope') this.makeRope(m.r, m.p[0], m.p[1], m.p[2]);
    else if (m.t === 'camp') { const W = G.regions ? G.regions[m.r] : (G.world.def.id === m.r ? G.world : null), c = W && W.camps[m.i - 1]; if (c && !c.lit) { c.setLit(true); G.save.camp[m.r] = Math.max(G.save.camp[m.r] || 0, m.i); G.ui.toast(this.nameOf(m.from) + ' lit a campfire: ' + (c.sec.name || 'camp') + '. Its rope net is down for you too.', 5); } }
  }
  nameOf(id) { const q = this.peers.get(id); return q ? q.n : 'A friend'; }
  spawnPeer(m) {
    const n = this.peers.size, col = COLORS[(n + m.from.charCodeAt(0)) % COLORS.length], model = M.biped({ skin: 0xe9b98c, shirt: col, sleeve: 0xf0e6cf, pants: 0x6a4d2e, hair: 0x3a2a1c, belt: 0x3a2a1c, cape: col, hat: col });
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d'); g.font = 'bold 34px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(43,28,14,.7)'; g.fillRect(0, 8, 256, 48); g.fillStyle = '#fff'; g.fillText(m.n.slice(0, 12), 128, 44);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, fog: false })); tag.scale.set(2.4, 0.6, 1); tag.position.y = 2.4; model.add(tag);
    const q = { id: m.from, n: m.n, model, r: null, x: m.p[0], y: m.p[1], z: m.p[2], tx: 0, ty: 0, tz: 0, yaw: 0, mode: 'idle', sp: 0, t: 0, seen: 0 }; this.peers.set(m.from, q); return q;
  }
  place(q) { const G = this.G, W = G.regions ? G.regions[q.r] : (G.world.def.id === q.r ? G.world : null); if (q.model.parent) q.model.parent.remove(q.model); if (W) W.scene.add(q.model); }
  // A rope anyone can climb, hung where a player is standing (so: stand at the top of a ledge and drop it for the friend below).
  makeRope(r, x, y, z) {
    const G = this.G, W = G.regions ? G.regions[r] : (G.world.def.id === r ? G.world : null); if (!W) return;
    const b = W.addBox(x, y + 0.3 - 9, z, 0.22, 9, 0.22, 0, null, { climb: true }), m = M.cyl(0xc9a25a, 0.07, 18, x, y + 0.3 - 9, z); m.castShadow = false; W.scene.add(m); const peg = M.cyl(0x6b4a2a, 0.09, 0.7, x, y + 0.4, z); W.scene.add(peg);
    W.limb(x, y - 17, z, x, y + 0.3, z); this.ropes.push({ W, b, m, peg, t: 120 });
  }
  dropRope() {
    const G = this.G, P = G.player, L = P.look, l = Math.hypot(L.x, L.z) || 1, x = P.pos.x + L.x / l * 1.1, z = P.pos.z + L.z / l * 1.1; if (!P.grounded) { G.ui.toast('Stand on firm ground to peg a rope.', 2); return; }
    if (this.ropes.filter(r => r.mine).length >= 2) { G.ui.toast('You only carry two ropes. Wait for one to fray.', 3); return; }
    this.makeRope(G.world.def.id, x, P.pos.y, z); this.ropes[this.ropes.length - 1].mine = true; this.send({ t: 'rope', r: G.world.def.id, p: [x, P.pos.y, z] }); G.audio.sfx('throw'); G.ui.toast('Rope pegged. It hangs 18 m down from here for two minutes.', 3);
  }
  // Whip crack landing on a friend: haul them to you.
  whipPull(P, range) {
    if (!this.on) return false; const p = P.pos, L = P.look, id = this.G.world.def.id;
    for (const q of this.peers.values()) { if (q.r !== id) continue; const dx = q.x - p.x, dy = q.y + 0.9 - (p.y + P.eye), dz = q.z - p.z, d = Math.hypot(dx, dy, dz); if (d < 1.2 || d > range + 16) continue; if ((dx * L.x + dy * L.y + dz * L.z) / d > 0.93) { this.send({ t: 'pull', to: q.id, r: id, p: [p.x, p.y, p.z] }); this.G.ui.toast('You haul ' + q.n + ' up!', 2); return true; } }
    return false;
  }
  update(dt) {
    const G = this.G, P = G.player, W = G.world, I = G.input;
    for (const r of this.ropes) { r.t -= dt; if (r.t <= 0) { r.b.solid = false; r.W.scene.remove(r.m, r.peg); r.dead = true; } } if (this.ropes.some(r => r.dead)) this.ropes = this.ropes.filter(r => !r.dead);
    if (!this.on) return;
    if (I.hit('KeyT') && !G.locked) this.dropRope();
    this.acc += dt; if (this.acc > 0.08) { this.acc = 0; const sp = Math.hypot(P.vel.x, P.vel.z), mode = P.swim ? 'swim' : P.climb ? 'climb' : P.swing || P.zip ? 'swing' : P.glide ? 'glide' : P.slideT > 0 ? 'slide' : P.crouch ? 'crouch' : P.airT > 0.2 ? 'air' : sp > 0.6 ? 'run' : 'idle'; this.send({ t: 's', n: this.name, r: W.def.id, p: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)], yaw: +(sp > 0.6 ? Math.atan2(-P.vel.x, -P.vel.z) : P.yaw).toFixed(2), m: mode, sp: +sp.toFixed(1) }); }
    let near = null, nd = 2.7;
    for (const q of this.peers.values()) {
      if (G.time - q.seen > 6) { if (q.model.parent) q.model.parent.remove(q.model); this.peers.delete(q.id); G.ui.toast(q.n + ' left.', 3); continue; }
      const k = Math.min(1, 12 * dt); q.x += (q.tx - q.x) * k; q.y += (q.ty - q.y) * k; q.z += (q.tz - q.z) * k; q.t += dt * (q.mode === 'run' ? q.sp * 1.6 : 5);
      M.animBiped(q.model, q.t, q.sp, q.mode); q.model.position.set(q.x, q.y + q.model.position.y, q.z); let dy = q.yaw - q.model.rotation.y; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; q.model.rotation.y += dy * k;
      if (q.r === W.def.id) { const d = Math.hypot(q.x - P.pos.x, q.y - P.pos.y, q.z - P.pos.z); if (d < nd) { nd = d; near = q; } }
    }
    if (near && !W.useEnt && !G.locked) { G.ui.prompt('Give ' + near.n + ' a boost'); if (I.hit('KeyE')) { this.send({ t: 'boost', to: near.id }); G.audio.sfx('bounce'); G.ui.toast('You boost ' + near.n + ' up!', 2); } }
  }
  count() { return this.peers.size + 1; }
}

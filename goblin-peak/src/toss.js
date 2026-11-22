// Things to pick up and throw: rocks, branches, snowballs, and the occasional rabbit or cat (who are never hurt, only indignant).
import * as THREE from 'three';
import * as M from './models.js';

export const TOSS = {
  rock: { name: 'rock', speed: 20, r: 0.26, make: () => { const m = M.boulderMesh(0.26, 0x8a8378); return m; } },
  branch: { name: 'branch', speed: 17, r: 0.3, make: () => { const g = new THREE.Group(); const a = M.cyl(0x6b4a2a, 0.05, 1.3, 0, 0, 0); a.rotation.z = 1.57; const b = M.cyl(0x6b4a2a, 0.035, 0.5, 0.25, 0.16, 0); b.rotation.z = 0.8; g.add(a, b, M.cone(0x3f9a44, 0.16, 0.3, 0.6, 0.1, 0)); return g; } },
  snowball: { name: 'snowball', speed: 21, r: 0.24, make: () => M.ball(0xffffff, 0.24, 0, 0, 0, { e: 0x8899aa }) },
  rabbit: { name: 'rabbit', speed: 15, r: 0.3, animal: 1, make: () => { const g = new THREE.Group(); g.add(M.box(0xf2efe8, 0.26, 0.26, 0.42, 0, 0.2, 0), M.box(0xf2efe8, 0.2, 0.2, 0.2, 0, 0.38, -0.22), M.box(0xf2efe8, 0.05, 0.3, 0.05, -0.06, 0.6, -0.2), M.box(0xf2efe8, 0.05, 0.3, 0.05, 0.06, 0.6, -0.2), M.ball(0xffffff, 0.08, 0, 0.24, 0.24), M.box(0x1a1410, 0.03, 0.03, 0.02, -0.06, 0.42, -0.33), M.box(0x1a1410, 0.03, 0.03, 0.02, 0.06, 0.42, -0.33)); return g; } },
  cat: { name: 'cat', speed: 15, r: 0.32, animal: 1, make: () => { const g = new THREE.Group(), c = 0xe08a3a; g.add(M.box(c, 0.24, 0.26, 0.55, 0, 0.28, 0), M.box(c, 0.24, 0.22, 0.22, 0, 0.44, -0.32), M.cone(c, 0.05, 0.12, -0.08, 0.6, -0.32), M.cone(c, 0.05, 0.12, 0.08, 0.6, -0.32), M.box(0x3a8a3a, 0.04, 0.04, 0.02, -0.06, 0.47, -0.44, { e: 0x226622 }), M.box(0x3a8a3a, 0.04, 0.04, 0.02, 0.06, 0.47, -0.44, { e: 0x226622 })); const t = M.cyl(c, 0.03, 0.5, 0, 0.5, 0.3); t.rotation.x = -0.5; g.add(t); for (const [x, z] of [[-0.08, -0.2], [0.08, -0.2], [-0.08, 0.2], [0.08, 0.2]]) g.add(M.box(c, 0.06, 0.16, 0.06, x, 0.08, z)); return g; } },
};
export class Toss {
  constructor(W, kind, x, z, o = {}) { this.W = W; this.kind = kind; this.k = TOSS[kind]; this.x = x; this.z = z; this.y = o.y !== undefined ? o.y : W.T.hAt(x, z); this.hx = x; this.hz = z; this.t = Math.random() * 9; this.state = o.fly ? 'fly' : 'rest'; this.v = new THREE.Vector3(); if (o.v) this.v.set(o.v[0], o.v[1], o.v[2]); this.ghost = !!o.ghost; this.mesh = this.k.make(); this.mesh.position.set(x, this.y, z); W.scene.add(this.mesh); this.prompt = 'Pick up the ' + this.k.name; this.dx = 1; this.dz = 0; }
  use() { const P = this.W.G.player; if (P.hold) return; P.hold = this; this.state = 'held'; const G = this.W.G; G.audio.sfx(this.kind === 'cat' ? 'meow' : this.kind === 'rabbit' ? 'squeak' : 'land'); G.ui.toast(`LEFT CLICK throws the ${this.k.name}.` + (this.k.animal ? ' It will be fine. It will also be furious.' : ''), 3); }
  throwFrom(P) { const L = P.look, sp = this.k.speed; this.state = 'fly'; this.x = P.pos.x + L.x * 0.8; this.y = P.pos.y + P.eye - 0.1; this.z = P.pos.z + L.z * 0.8; this.v.set(L.x * sp + P.vel.x * 0.5, L.y * sp + 4.5, L.z * sp + P.vel.z * 0.5); this.mine = true; const G = this.W.G; G.audio.sfx(this.kind === 'cat' ? 'meow' : this.kind === 'rabbit' ? 'squeak' : 'throw'); G.net.send({ t: 'tv', r: this.W.def.id, k: this.kind, p: [+this.x.toFixed(1), +this.y.toFixed(1), +this.z.toFixed(1)], v: [+this.v.x.toFixed(1), +this.v.y.toFixed(1), +this.v.z.toFixed(1)] }); }
  land() { const W = this.W; if (this.ghost) { this.dead = true; W.scene.remove(this.mesh); return; } this.mine = false; this.y = W.T.hAt(this.x, this.z); this.mesh.rotation.set(0, this.mesh.rotation.y, 0); if (this.kind === 'snowball') { W.puff(this.x, this.y + 0.2, this.z, 0xffffff, 10); this.x = this.hx; this.z = this.hz; this.y = W.T.hAt(this.x, this.z); } this.state = this.k.animal ? 'flee' : 'rest'; this.fleeT = 4; }
  update(dt) {
    const W = this.W, G = W.G, P = G.player, p = P.pos, m = this.mesh; this.t += dt;
    if (this.state === 'held') { if (P.hold !== this) { this.state = 'rest'; return; } const L = P.look, cy = Math.cos(P.yaw), sy = Math.sin(P.yaw); if (P.third) { this.x = p.x - sy * 0.45 + cy * 0.3; this.y = p.y + 1.15; this.z = p.z - cy * 0.45 - sy * 0.3; } else { this.x = p.x + L.x * 0.62 + cy * 0.26; this.y = p.y + P.eye - 0.34 + L.y * 0.5; this.z = p.z + L.z * 0.62 - sy * 0.26; } m.position.set(this.x, this.y, this.z); m.rotation.y = P.yaw + (this.k.animal ? Math.PI : 0); if (this.k.animal) m.rotation.z = Math.sin(this.t * 14) * 0.12; this.canUse = false; return; }
    if (this.state === 'fly') {
      this.v.y -= 17 * dt; this.x += this.v.x * dt; this.y += this.v.y * dt; this.z += this.v.z * dt; m.position.set(this.x, this.y, this.z); m.rotation.x += dt * 11; m.rotation.z += dt * 7; this.canUse = false;
      if (this.mine) {
        for (const q of G.net.peers.values()) if (q.r === W.def.id && Math.hypot(q.x - this.x, q.y + 0.95 - this.y, q.z - this.z) < 1.0) { const l = Math.hypot(this.v.x, this.v.z) || 1; G.net.send({ t: 'tw', to: q.id, k: this.kind, d: [+(this.v.x / l).toFixed(2), +(this.v.z / l).toFixed(2)] }); W.puff(this.x, this.y, this.z, this.kind === 'snowball' ? 0xffffff : 0xfff2c0, 9); G.audio.sfx('punch'); G.ui.toast(`Direct hit on ${q.n} with a ${this.k.name}!`, 3); this.v.set(-this.v.x * 0.2, 3, -this.v.z * 0.2); this.mine = false; break; }
        if (this.mine) for (const e of W.ents) if (e.mob && !e.dead && Math.hypot(e.x - this.x, e.y + e.k.h * 0.5 - this.y, e.z - this.z) < e.k.r + 0.6) { if (this.kind === 'rock') e.hit(1, p.x, p.z, 'stomp'); else if (this.kind === 'branch') e.hit(0.5, p.x, p.z); else { e.stunT = Math.max(e.stunT, this.k.animal ? 3 : 1.8); e.state = 'idle'; } W.puff(this.x, this.y, this.z, 0xfff2c0, 8); G.audio.sfx('bonk'); this.v.set(-this.v.x * 0.2, 3, -this.v.z * 0.2); this.mine = false; break; }
      }
      if (this.y < W.T.hAt(this.x, this.z) + 0.05) this.land(); return;
    }
    const d = Math.hypot(p.x - this.x, p.z - this.z);
    if (this.k.animal) { let sp = 0.9; if (this.state === 'flee') { this.fleeT -= dt; const hd = Math.hypot(this.hx - this.x, this.hz - this.z) || 1; this.dx = (this.hx - this.x) / hd; this.dz = (this.hz - this.z) / hd; sp = 6; if (this.fleeT <= 0 || hd < 1.5) this.state = 'rest'; } else { const hd = Math.hypot(this.hx - this.x, this.hz - this.z); if (hd > 7) { this.dx = (this.hx - this.x) / hd; this.dz = (this.hz - this.z) / hd; } else if (Math.sin(this.t * 0.6) > 0.2) { this.dx = Math.cos(this.t * 0.37 + this.hx); this.dz = Math.sin(this.t * 0.37 + this.hx); } else sp = 0; }
      this.x += this.dx * sp * dt; this.z += this.dz * sp * dt; this.y = W.T.hAt(this.x, this.z); const hop = this.kind === 'rabbit' && sp ? Math.abs(Math.sin(this.t * (sp > 3 ? 14 : 7))) * 0.25 : 0; m.position.set(this.x, this.y + hop, this.z); if (sp) m.rotation.y = Math.atan2(-this.dx, -this.dz); m.rotation.z = 0; }
    else m.position.set(this.x, this.y + (this.kind === 'branch' ? 0.08 : this.k.r), this.z);
    this.canUse = !this.ghost && !P.hold && d < 2.3 && Math.abs(p.y - this.y) < 2.5 && this.state !== 'flee';
  }
}
// What it is like to be on the receiving end.
export function tossHit(G, kind, d, from) {
  const P = G.player, race = G.mode === 'race', n = G.net.nameOf(from);
  if (kind === 'rock') { P.inv = 0; P.knock(d[0], d[1], 9, 5, !race); G.ui.toast(n + ' hit you with a rock!', 3); }
  else if (kind === 'branch') { P.inv = 0; P.knock(d[0], d[1], 6, 4, true); G.ui.toast(n + ' walloped you with a branch!', 3); }
  else if (kind === 'snowball') { G.ui.splat('snow', 2.4); P.vel.x += d[0] * 3; P.vel.z += d[1] * 3; G.audio.sfx('splat'); G.ui.toast(n + ' got you in the face with a snowball!', 3); }
  else if (kind === 'rabbit') { G.ui.splat('rabbit', 2.6); P.vel.y = Math.max(P.vel.y, 5); P.grounded = false; G.audio.sfx('squeak'); G.ui.toast(n + ' threw a RABBIT at you. It bounced off your head and left.', 4); }
  else if (kind === 'cat') { G.ui.splat('cat', 3.6); P.hex = Math.max(P.hex || 0, 2); G.audio.sfx('meow'); G.ui.toast(n + ' threw a CAT at you. It is on your face. It is not letting go.', 4); }
}
export function placeTossables(W) {
  const add = (k, x, z) => W.add(new Toss(W, k, x, z));
  if (!W.spiral) { [['rock', -3, 14], ['rock', 5, 15], ['rock', -14, -2], ['rock', 14, 0], ['branch', -5, 12], ['branch', 11, 12], ['branch', -12, 5], ['rabbit', -9, 18], ['rabbit', 12, 20], ['rabbit', -18, 4], ['cat', 4, 6], ['cat', -4, -2], ['cat', 18, 8]].forEach(a => add(a[0], a[1], a[2])); return; }
  const th = W.def.theme, pool = th === 'snow' ? ['snowball', 'snowball', 'rock', 'rabbit', 'snowball'] : th === 'gorge' ? ['rock', 'branch', 'rock', 'cat', 'rock'] : ['rock', 'branch', 'rabbit', 'rock', 'cat']; let k = 0;
  for (const s of W.secs) if (s.t === 'path' || s.t === 'camp' || s.t === 'ramp') { for (const q of [0.25, 0.7]) { const f = s.at(s.len * q, (k % 2 ? 1 : -1) * (s.w - 1.8), 0); add(pool[k++ % pool.length], f.x, f.z); } }
}

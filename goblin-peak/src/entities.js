// Things that move or react: goblins and other mobs, boulders, traps, chests, camps, villagers, the Chieftain.
import * as THREE from 'three';
import { clamp, TAU } from './util.js';
import * as M from './models.js';

const rt = { phi: 0, lat: 0, on: false }, nrm = { x: 0, y: 1, z: 0 };
const face = (m, dx, dz) => { m.rotation.y = Math.atan2(-dx, -dz); };

export const KINDS = {
  grunt: { name: 'Goblin Grunt', hp: 1, sp: 5.7, r: 0.5, h: 1.3, knock: 11, sight: 19, coins: 3, model: () => M.goblin({ club: 1 }) },
  brute: { name: 'Goblin Brute', hp: 3, sp: 4.8, r: 0.65, h: 1.7, knock: 14, sight: 15, coins: 6, model: () => M.goblin({ scale: 0.98, helm: 0x777f88, skin: 0x5c9a38, club: 1, wide: 1.3, shirt: 0x4a4a52 }) },
  boar: { name: 'Tuskboar', hp: 2, sp: 10, r: 0.75, h: 1.1, knock: 15, sight: 18, coins: 5, charge: 1, model: () => M.boar() },
  ram: { name: 'Summit Ram', hp: 2, sp: 11, r: 0.75, h: 1.1, knock: 16, sight: 20, coins: 6, charge: 1, model: () => M.boar(0xe8e4dc) },
  slinger: { name: 'Goblin Slinger', hp: 1, sp: 0, r: 0.5, h: 1.3, knock: 8, sight: 26, coins: 4, thrower: 1, model: () => M.goblin({ hat: 0xb5332a, shirt: 0x8a6a3a }) },
  yeti: { name: 'Yeti', hp: 3, sp: 0, r: 0.9, h: 3, knock: 13, sight: 30, coins: 10, thrower: 2, model: () => M.yeti() },
  bat: { name: 'Gloomwing', hp: 1, sp: 7.5, r: 0.5, h: 0.6, knock: 6, sight: 17, coins: 2, fly: 1, model: () => M.bat() },
  shield: { name: 'Goblin Bulwark', hp: 2, sp: 4.6, r: 0.6, h: 1.5, knock: 13, sight: 18, coins: 7, shield: 1, model: () => { const g = M.goblin({ scale: 0.86, helm: 0x8a8a92, shirt: 0x3b4a6a, wide: 1.2 }); g.userData.parts.armL.add(M.box(0x8a6238, 0.75, 0.95, 0.08, 0, -0.45, -0.3), M.box(0xc8c8d0, 0.2, 0.2, 0.1, 0, -0.45, -0.34)); return g; } },
  bomber: { name: 'Goblin Bomber', hp: 1, sp: 0, r: 0.5, h: 1.3, knock: 14, sight: 24, coins: 6, thrower: 3, rate: 3.4, model: () => M.goblin({ hat: 0x222222, shirt: 0x5a2a2a }) },
  tugger: { name: 'Lasso Goblin', hp: 1, sp: 0, r: 0.5, h: 1.3, knock: 0, sight: 19, coins: 6, thrower: 4, rate: 4.2, model: () => M.goblin({ hat: 0xc9a25a, shirt: 0x6a5a2a }) },
  shaman: { name: 'Goblin Hexer', hp: 1, sp: 0, r: 0.5, h: 1.3, knock: 0, sight: 26, coins: 8, thrower: 5, rate: 5, model: () => { const g = M.goblin({ hat: 0x7a3ab5, shirt: 0x4a2a6a }); g.userData.parts.armR.add(M.cyl(0x5a3c22, 0.03, 1.3, 0, -0.5, -0.1), M.ball(0xc77dff, 0.11, 0, 0.2, -0.1, { e: 0x7a3ab5 })); return g; } },
  harpy: { name: 'Harpy', hp: 2, sp: 9.5, r: 0.8, h: 1.1, knock: 0, sight: 24, coins: 8, fly: 1, grab: 1, model: () => { const g = M.bat(); g.scale.setScalar(1.9); return g; } },
  troll: { name: 'Rock Troll', hp: 3, sp: 2.7, r: 1.1, h: 3.6, knock: 13, sight: 18, coins: 12, slam: 1, model: () => M.troll() },
};

export class Mob {
  constructor(W, kind, x, z, o = {}) {
    const k = this.k = KINDS[kind]; this.kind = kind; this.W = W; this.x = x; this.z = z; this.y = W.T.hAt(x, z) + (k.fly ? 5 : 0); this.hx = x; this.hz = z; this.hy = this.y;
    this.hp = k.hp; this.stunT = 0; this.cd = 1 + Math.random() * 2; this.state = 'idle'; this.t = Math.random() * 9; this.dx = 0; this.dz = 1; this.arena = o.arena || 0; this.mob = true;
    if (W.spiral && !this.arena) { W.spiral.toRoute(x, z, rt); this.phi = rt.phi; this.pa = rt.phi - (o.range || 13) / W.spiral.R(rt.phi); this.pb = rt.phi + (o.range || 13) / W.spiral.R(rt.phi); }
    if (k.fly && W.spiral && !this.arena) { this.y = this.hy = Math.max(this.y, W.spiral.trailY(this.phi) + 3.5); }
    this.mesh = k.model(); this.mesh.position.set(x, this.y, z); W.scene.add(this.mesh);
  }
  hit(n, fx, fz, how) {
    if (this.dead) return; const G = this.W.G;
    if (this.k.shield && !how && n < 3) { G.audio.sfx('spike'); this.W.puff(this.x, this.y + 1, this.z, 0xfff2c0, 3); if (!this.told) { this.told = true; G.ui.toast('Its shield turns the whip aside. Jump on its head instead.', 4); } return; }
    this.hp -= n; this.stunT = 0.9; this.state = 'idle'; G.audio.sfx('bonk'); this.W.puff(this.x, this.y + this.k.h * 0.6, this.z, 0xffffff, 6);
    const dx = this.x - fx, dz = this.z - fz, l = Math.hypot(dx, dz) || 1; if (!this.k.thrower && !this.k.slam) this.move(dx / l * 1.2, dz / l * 1.2);
    if (this.hp <= 0) { this.dead = true; this.W.scene.remove(this.mesh); this.W.puff(this.x, this.y + 0.8, this.z, 0x9be06a, 14); this.W.dropCoins(this.x, this.y + 1, this.z, this.k.coins * (G.save.relics.midas ? 2 : 1)); G.audio.sfx('poof'); G.stat('bonked'); }
  }
  move(mx, mz) {
    const W = this.W, sp = W.spiral; let nx = this.x + mx, nz = this.z + mz;
    if (this.arena) { const r = Math.hypot(nx, nz); if (r > this.arena) { nx *= this.arena / r; nz *= this.arena / r; } }
    else if (sp) { sp.toRoute(nx, nz, rt); const w = sp.width(rt.phi) - 0.8, lat = clamp(rt.lat, -w, w), phi = clamp(rt.phi, this.pa, this.pb), r = sp.R(phi) + lat; nx = Math.cos(phi) * r; nz = Math.sin(phi) * r; }
    if (!this.k.fly) { W.T.normalAt(nx, nz, nrm); if (nrm.y < 0.8) return false; }
    this.x = nx; this.z = nz; return true;
  }
  update(dt) {
    const W = this.W, P = W.G.player, k = this.k, p = P.pos; this.t += dt; this.stunT -= dt; this.cd -= dt;
    if (this.carry) { // a harpy hauling the hero out over the drop
      const c = this.carry, I = W.G.input, r = Math.hypot(this.x, this.z) || 1, ox = this.arena ? Math.cos(this.t) : this.x / r, oz = this.arena ? Math.sin(this.t) : this.z / r; c.t += dt;
      this.x += ox * 5.5 * dt; this.z += oz * 5.5 * dt; this.y += 2.6 * dt; this.mesh.position.set(this.x, this.y, this.z); const fl = Math.sin(this.t * 22) * 0.9; this.mesh.userData.parts.wL.rotation.z = fl; this.mesh.userData.parts.wR.rotation.z = -fl;
      p.set(this.x, this.y - 2.1, this.z); P.vel.set(0, 0, 0); P.stun = 0.12; P.grounded = false; if (I.hit('Space')) c.mash++;
      const whip = I.lmbHit && W.G.save.items.whip; if (whip) { W.G.audio.sfx('whip'); this.hit(1, p.x, p.z, 'stomp'); }
      if (c.t > 2.4 || c.mash >= 4 || whip || this.dead) { this.carry = null; P.vel.set(ox * 3, 3, oz * 3); P.stun = 0; P.jumps = 1; this.state = 'back'; this.cd = 4; }
      return;
    }
    let dx = p.x - this.x, dz = p.z - this.z; const d = Math.hypot(dx, dz) || 0.01, dy = p.y - this.y; dx /= d; dz /= d;
    const sees = d < k.sight && Math.abs(dy) < (k.fly || k.thrower ? 12 : 4) && !W.G.locked; let sp = 0;
    if (this.stunT > 0) { this.mesh.rotation.z = Math.sin(this.t * 30) * 0.15; }
    else if (k.fly) {
      this.mesh.rotation.z = 0;
      if (this.state === 'swoop') { const ty = p.y + 1.2, l = Math.hypot(p.x - this.x, ty - this.y, p.z - this.z) || 1; this.x += (p.x - this.x) / l * k.sp * dt; this.z += (p.z - this.z) / l * k.sp * dt; this.y += (ty - this.y) / l * k.sp * dt; this.cd -= dt; if (this.cd < -3 || Math.hypot(this.x - this.hx, this.z - this.hz) > 22) { this.state = 'back'; } face(this.mesh, dx, dz); }
      else { const tx = this.hx + Math.cos(this.t * 0.9) * 3, tz = this.hz + Math.sin(this.t * 0.9) * 3, ty = this.hy + Math.sin(this.t * 2) * 0.6, k2 = Math.min(1, 2.5 * dt); this.x += (tx - this.x) * k2; this.z += (tz - this.z) * k2; this.y += (ty - this.y) * k2; if (this.state === 'back' && Math.hypot(tx - this.x, tz - this.z) < 1.5) { this.state = 'idle'; this.cd = 1.5; } if (this.state === 'idle' && sees && this.cd <= 0) { this.state = 'swoop'; this.cd = 0; W.G.audio.sfx('screech'); } face(this.mesh, -Math.sin(this.t * 0.9), Math.cos(this.t * 0.9)); }
      const fl = Math.sin(this.t * 16) * 0.8; this.mesh.userData.parts.wL.rotation.z = fl; this.mesh.userData.parts.wR.rotation.z = -fl;
    } else if (k.thrower) {
      this.mesh.rotation.z = 0; if (sees) { face(this.mesh, dx, dz); if (this.cd <= 0 && d > 3) { this.cd = k.rate || (k.thrower === 2 ? 3.0 : 2.1); this.throwT = 0.35; } }
      if (this.throwT > 0) { this.throwT -= dt; if (this.throwT <= 0) { const big = k.thrower === 2, T = clamp(d / 15, 0.5, 1.6), sy = this.y + k.h * 0.9; const vx = (p.x + P.vel.x * T * 0.5 - this.x) / T, vy = (p.y + 1 - sy + 7 * T * T) / T, vz = (p.z + P.vel.z * T * 0.5 - this.z) / T; if (k.thrower === 3) W.add(new Bomb(W, this.x, sy, this.z, vx, vy, vz, false)); else if (k.thrower === 4) W.add(new Lasso(W, this, sy)); else if (k.thrower === 5) W.add(new Orb(W, this.x, sy + 0.6, this.z)); else W.add(new Rock(W, this.x, sy, this.z, vx, vy, vz, big ? 0.55 : 0.25, big ? 0xf4f8ff : 0x8a8378, k.knock)); W.G.audio.sfx('throw'); } }
    } else if (k.slam) {
      this.mesh.rotation.z = 0;
      if (this.state === 'wind') { this.cd -= 0; this.windT -= dt; if (this.windT <= 0) { this.state = 'idle'; this.cd = 3.4; W.add(new Shock(W, this.x, this.y, this.z, k.knock)); W.G.audio.sfx('slam'); W.G.player.shake = Math.max(W.G.player.shake, d < 14 ? 0.3 : 0); } }
      else if (sees) { face(this.mesh, dx, dz); if (d < 6.5 && this.cd <= 0) { this.state = 'wind'; this.windT = 0.9; } else if (d > 3) { this.move(dx * k.sp * dt, dz * k.sp * dt); sp = k.sp; } }
    } else if (k.charge) {
      this.mesh.rotation.z = 0;
      if (this.state === 'wind') { this.windT -= dt; face(this.mesh, dx, dz); this.mesh.position.x = this.x + Math.sin(this.t * 40) * 0.05; if (this.windT <= 0) { this.state = 'charge'; this.windT = 1.5; this.dx = dx; this.dz = dz; } }
      else if (this.state === 'charge') { this.windT -= dt; sp = k.sp; const ok = this.move(this.dx * sp * dt, this.dz * sp * dt); if (this.windT <= 0 || !ok) { this.state = 'idle'; this.cd = 1.4; } }
      else if (sees && this.cd <= 0) { this.state = 'wind'; this.windT = 0.7; W.G.audio.sfx('snort'); }
      else { this.dx = Math.cos(this.t * 0.3); this.dz = Math.sin(this.t * 0.3); this.move(this.dx * dt, this.dz * dt); sp = 1; face(this.mesh, this.dx, this.dz); }
    } else {
      this.mesh.rotation.z = 0;
      if (sees) { this.move(dx * k.sp * dt, dz * k.sp * dt); sp = k.sp; face(this.mesh, dx, dz); }
      else { const hd = Math.hypot(this.hx - this.x, this.hz - this.z); if (hd > 6) { this.dx = (this.hx - this.x) / hd; this.dz = (this.hz - this.z) / hd; } else { this.dx = Math.cos(this.t * 0.25); this.dz = Math.sin(this.t * 0.25); } this.move(this.dx * 1.6 * dt, this.dz * 1.6 * dt); sp = 1.6; face(this.mesh, this.dx, this.dz); }
    }
    if (!k.fly) this.y = W.T.hAt(this.x, this.z);
    this.mesh.position.set(this.x, this.y, this.z);
    const parts = this.mesh.userData.parts;
    if (parts.armL) { M.animBiped(this.mesh, this.t * (sp ? 10 : 2), sp, sp ? 'run' : 'idle'); this.mesh.position.y = this.y; if (this.state === 'wind' || this.throwT > 0) parts.armR.rotation.x = -2.8; }
    else if (parts.legs) parts.legs.forEach((l, i) => l.rotation.x = Math.sin(this.t * 14 + i * 1.6) * Math.min(1, sp / 3) * 0.7);
    // touching the hero
    if (d < k.r + 0.45 && dy < k.h && dy > -1.9 && this.stunT <= 0) {
      if (P.vel.y < -2 && dy > k.h * 0.5) { this.hit(1, p.x, p.z, 'stomp'); P.vel.y = 10.5; P.jumps = 1; }
      else if (k.grab) { if (P.inv <= 0 && !this.carry) { this.carry = { t: 0, mash: 0 }; P.inv = 3.2; P.detach(); W.G.audio.sfx('screech'); W.G.ui.toast('A harpy has you! Mash SPACE or crack the whip to break free!', 3); W.G.stat('knocked'); } }
      else if (P.inv <= 0) { let kx = dx, kz = dz; if (W.spiral && !this.arena) { const r = Math.hypot(p.x, p.z) || 1; kx = dx * 0.8 + p.x / r * 0.35; kz = dz * 0.8 + p.z / r * 0.35; } if (P.knock(kx, kz, k.knock, 7)) { if (this.state === 'swoop') this.state = 'back'; if (this.state === 'charge') { this.state = 'idle'; this.cd = 1.6; } W.G.stat('knocked'); } }
    }
  }
}

export class Rock {
  constructor(W, x, y, z, vx, vy, vz, r, col, knock) { this.W = W; this.v = new THREE.Vector3(vx, vy, vz); this.r = r; this.knock = knock; this.mesh = M.boulderMesh(r, col); this.mesh.position.set(x, y, z); W.scene.add(this.mesh); this.t = 0; }
  update(dt) {
    const m = this.mesh.position, W = this.W, P = W.G.player; this.v.y -= 14 * dt; m.addScaledVector(this.v, dt); this.t += dt; this.mesh.rotation.x += dt * 6;
    if (Math.hypot(m.x - P.pos.x, m.y - P.pos.y - 0.9, m.z - P.pos.z) < this.r + 0.7) { P.knock(this.v.x, this.v.z, this.knock, 5); this.end(); }
    else if (m.y < W.T.hAt(m.x, m.z) || this.t > 6) this.end();
  }
  end() { this.dead = true; this.W.scene.remove(this.mesh); this.W.puff(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z, 0xcfc8ba, 5); }
}

// A fused bomb: lands, fizzes for a moment, then blows. Goblin ones flatten the hero; the hero's own squibs flatten goblins.
export class Bomb {
  constructor(W, x, y, z, vx, vy, vz, mine) { this.W = W; this.v = new THREE.Vector3(vx, vy, vz); this.mine = mine; this.mesh = M.ball(mine ? 0xd8362c : 0x222222, 0.3, x, y, z, { e: 0x331100 }); W.scene.add(this.mesh); this.t = 0; this.fuse = -1; }
  update(dt) {
    const m = this.mesh.position, W = this.W, G = W.G, P = G.player; this.t += dt;
    if (this.fuse < 0) { this.v.y -= 14 * dt; m.addScaledVector(this.v, dt); const gy = W.T.hAt(m.x, m.z) + 0.3; if (m.y < gy || this.t > 5) { m.y = Math.max(m.y, gy); this.fuse = this.mine ? 0.15 : 0.95; } }
    else { this.fuse -= dt; this.mesh.scale.setScalar(0.3 + Math.sin(this.t * 40) * 0.06); this.mesh.material = M.mat((this.t * 12 | 0) % 2 ? 0xffe27a : 0x222222, { e: 0x662200 });
      if (this.fuse <= 0) { this.dead = true; W.scene.remove(this.mesh); W.puff(m.x, m.y + 0.5, m.z, 0xffb040, 18); W.puff(m.x, m.y + 0.5, m.z, 0x555555, 10); G.audio.sfx('cannon'); const R = this.mine ? 5 : 3.6;
        if (this.mine) { for (const e of W.ents) if (!e.dead && (e.mob || e.hittable) && Math.hypot(e.x - m.x, e.y - m.y, e.z - m.z) < R + (e.k ? e.k.r : 1)) e.hit(3, m.x, m.z, 'bomb'); }
        else if (Math.hypot(P.pos.x - m.x, P.pos.y - m.y, P.pos.z - m.z) < R) { if (P.knock(P.pos.x - m.x, P.pos.z - m.z, 14, 9)) G.stat('flattened'); }
        if (Math.hypot(P.pos.x - m.x, P.pos.z - m.z) < 14) P.shake = Math.max(P.shake, 0.3); } }
  }
}
// A thrown loop of rope: if it lands, the goblin hauls you toward itself (it stands by the drop for a reason).
export class Lasso {
  constructor(W, from, sy) { this.W = W; this.from = from; const p = W.G.player.pos; this.pos = new THREE.Vector3(from.x, sy, from.z); this.v = new THREE.Vector3(p.x - from.x, p.y + 1 - sy, p.z - from.z).normalize().multiplyScalar(21); this.mesh = new THREE.Mesh(M.GEO.torG, M.mat(0xc9a25a)); this.mesh.scale.setScalar(0.5); W.scene.add(this.mesh); this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([this.pos.clone(), this.pos.clone()]), new THREE.LineBasicMaterial({ color: 0xc9a25a })); this.line.frustumCulled = false; W.scene.add(this.line); this.t = 0; }
  update(dt) {
    const W = this.W, P = W.G.player, p = P.pos; this.t += dt; this.pos.addScaledVector(this.v, dt); this.mesh.position.copy(this.pos); this.mesh.rotation.x += dt * 9; const a = this.line.geometry.attributes.position; a.setXYZ(0, this.from.x, this.from.y + 1.1, this.from.z); a.setXYZ(1, this.pos.x, this.pos.y, this.pos.z); a.needsUpdate = true;
    if (Math.hypot(p.x - this.pos.x, p.y + 0.9 - this.pos.y, p.z - this.pos.z) < 1.0 && P.inv <= 0 && !this.from.dead) { const dx = this.from.x - p.x, dz = this.from.z - p.z; if (P.knock(dx, dz, 13, 5)) { W.G.ui.toast('Lassoed! It is dragging you toward the edge.', 3); W.G.stat('knocked'); } this.end(); }
    else if (this.t > 0.95 || this.pos.y < W.T.hAt(this.pos.x, this.pos.z) || this.from.dead) this.end();
  }
  end() { this.dead = true; this.W.scene.remove(this.mesh, this.line); }
}
// A slow purple hex that follows you. Whip it out of the air, or outrun it.
export class Orb {
  constructor(W, x, y, z) { this.W = W; this.x = x; this.y = y; this.z = z; this.t = 0; this.hittable = true; this.r = 0.6; this.h = 0.2; this.mesh = M.ball(0xc77dff, 0.38, x, y, z, { e: 0x7a3ab5 }); this.mesh.castShadow = false; W.scene.add(this.mesh); }
  hit() { this.end(); this.W.G.audio.sfx('bonk'); }
  update(dt) {
    const W = this.W, P = W.G.player, p = P.pos, dx = p.x - this.x, dy = p.y + 1 - this.y, dz = p.z - this.z, d = Math.hypot(dx, dy, dz) || 1; this.t += dt; const sp = 6.2; this.x += dx / d * sp * dt; this.y += dy / d * sp * dt; this.z += dz / d * sp * dt; this.mesh.position.set(this.x, this.y, this.z); this.mesh.scale.setScalar(0.38 + Math.sin(this.t * 9) * 0.06);
    if (d < 0.9) { P.hex = 5; W.G.audio.sfx('nope'); W.G.ui.toast('Hexed! Your legs feel like lead for a few seconds.', 3); this.end(); } else if (this.t > 7) this.end();
  }
  end() { this.dead = true; this.W.scene.remove(this.mesh); this.W.puff(this.x, this.y, this.z, 0xc77dff, 6); }
}
export class Shock {
  constructor(W, x, y, z, knock) { this.W = W; this.x = x; this.y = y; this.z = z; this.R = 0.5; this.knock = knock; this.mesh = new THREE.Mesh(M.GEO.torG, M.mat(0xfff2c0, { e: 0xaa8833, op: 0.8 })); this.mesh.rotation.x = Math.PI / 2; this.mesh.position.set(x, y + 0.25, z); W.scene.add(this.mesh); }
  update(dt) {
    this.R += 9 * dt; this.mesh.scale.set(this.R, this.R, 1.6); const P = this.W.G.player, p = P.pos, d = Math.hypot(p.x - this.x, p.z - this.z);
    if (Math.abs(d - this.R) < 0.7 && p.y - this.y < 0.6 && p.y - this.y > -2) P.knock(p.x - this.x, p.z - this.z, this.knock, 9);
    if (this.R > 10) { this.dead = true; this.W.scene.remove(this.mesh); }
  }
}

// A boulder either follows the trail downhill (sec + arc) and then tumbles off, or rolls free down the slope.
export class Boulder {
  constructor(W, o) {
    this.W = W; this.r = o.r || 1.25; this.o = o; this.t = 0; this.v = new THREE.Vector3(o.vx || 0, 0, o.vz || 0); this.mode = o.sec ? 'trail' : 'free'; this.a = o.a; this.x = o.x || 0; this.z = o.z || 0; this.y = 0;
    this.mesh = M.boulderMesh(this.r, o.col); W.scene.add(this.mesh); this.ph = Math.random() * 6; if (this.mode === 'trail') this.place(); else this.y = W.T.hAt(this.x, this.z) + this.r; this.mesh.position.set(this.x, this.y, this.z);
  }
  place() { const s = this.o.sec, dir = this.o.dir || -1, lat = Math.sin(this.a * 0.22 + this.ph) * (this.o.wob === undefined ? 1.8 : this.o.wob), f = s.at(this.a, lat, 0); this.x = f.x; this.z = f.z; this.y = this.W.T.hAt(f.x, f.z) + this.r; this.tx = f.tx * dir; this.tz = f.tz * dir; this.nx = f.nx; this.nz = f.nz; }
  update(dt) {
    const W = this.W, T = W.T, P = W.G.player, p = P.pos; this.t += dt; const ox = this.x, oz = this.z;
    if (this.mode === 'trail') { const dir = this.o.dir || -1; this.a += dir * (this.o.sp || 9) * dt; this.place(); if (dir < 0 ? this.a <= (this.o.end || 2) : this.a >= this.o.end) { this.mode = 'free'; this.v.set(this.tx * 6 + this.nx * 5, 0, this.tz * 6 + this.nz * 5); } }
    else {
      T.normalAt(this.x, this.z, nrm); this.v.x += nrm.x * 22 * dt; this.v.z += nrm.z * 22 * dt; const sp = Math.hypot(this.v.x, this.v.z), cap = 24; if (sp > cap) { this.v.x *= cap / sp; this.v.z *= cap / sp; }
      const fr = Math.max(0, 1 - 0.25 * dt); this.v.x *= fr; this.v.z *= fr; this.x += this.v.x * dt; this.z += this.v.z * dt;
      const gy = T.hAt(this.x, this.z) + this.r; this.v.y -= 27 * dt; this.y += this.v.y * dt; if (this.y < gy) { this.y = gy; this.v.y = 0; }
      if (this.t > (this.o.life || 14) || (sp < 1 && this.t > 2) || Math.hypot(this.x, this.z) > T.S - 20 || T.waterY(this.x, this.z) > this.y - this.r * 0.5) return this.end();
    }
    const mx = this.x - ox, mz = this.z - oz, ml = Math.hypot(mx, mz); if (ml > 0) { this.mesh.rotateOnWorldAxis(new THREE.Vector3(mz / ml, 0, -mx / ml), ml / this.r); }
    this.mesh.position.set(this.x, this.y, this.z);
    if (Math.hypot(p.x - this.x, p.y + 0.9 - this.y, p.z - this.z) < this.r + 0.55 && P.inv <= 0) {
      let kx = mx / (ml || 1), kz = mz / (ml || 1); if (W.spiral) { const r = Math.hypot(p.x, p.z) || 1; kx = kx * 0.9 + p.x / r * 0.25; kz = kz * 0.9 + p.z / r * 0.25; }
      if (P.knock(kx, kz, this.o.dir > 0 ? 19 : 15, 8)) W.G.stat('flattened');
    }
    for (const e of W.ents) if (e.mob && !e.dead && !e.arena && !e.k.fly && Math.hypot(e.x - this.x, e.z - this.z) < this.r + e.k.r && Math.abs(e.y - this.y) < 2.5) e.hit(3, this.x, this.z);
  }
  end() { this.dead = true; this.W.scene.remove(this.mesh); this.W.puff(this.x, this.y, this.z, 0xcfc8ba, 10); }
}

// A goblin who shoves boulders: down the trail (sec given) or off the ledge above (free).
export class Roller {
  constructor(W, x, z, o) { this.W = W; this.x = x; this.z = z; this.o = o; this.cd = 1.5; this.mesh = M.goblin({ hat: 0x6a5acd }); this.y = W.T.hAt(x, z); this.mesh.position.set(x, this.y, z); W.scene.add(this.mesh); this.t = 0; this.pile = M.boulderMesh(0.9); this.pile.position.set(x + (o.px || 0), this.y + 0.9, z + (o.pz || 0)); W.scene.add(this.pile); this.hittable = true; this.r = 0.5; this.h = 1.3; this.name = 'Boulder Goblin'; }
  hit() { if (this.dead) return; const W = this.W, G = W.G; this.dead = true; W.scene.remove(this.mesh); W.puff(this.x, this.y + 0.8, this.z, 0x9be06a, 14); W.dropCoins(this.x, this.y + 1, this.z, 5); G.audio.sfx('bonk'); G.audio.sfx('poof'); G.stat('bonked'); G.ui.toast('No more boulders from that one.', 3); }
  update(dt) {
    const W = this.W, P = W.G.player, p = P.pos, d = Math.hypot(p.x - this.x, p.z - this.z); this.t += dt; this.cd -= dt;
    if (d < 0.95 && p.y - this.y > 0.6 && p.y - this.y < 2 && P.vel.y < -2) { this.hit(); P.vel.y = 10.5; P.jumps = 1; return; }
    face(this.mesh, p.x - this.x, p.z - this.z); M.animBiped(this.mesh, this.t * 3, 0, this.cd < 0.5 ? 'cheer' : 'idle'); this.mesh.position.y = this.y;
    if (d < (this.o.range || 60) && d > 6 && this.cd <= 0 && !W.G.locked) { this.cd = this.o.every || 3.4; W.G.audio.sfx('rumble', clamp(1 - d / 60, 0.15, 1)); W.add(new Boulder(W, this.o.make())); }
  }
}

export class Spikes {
  constructor(W, sec, a, ph) {
    this.W = W; this.f = sec.at(a, 0, 0); this.w = (sec.w || 5) + 1.2; this.ph = ph; this.g = new THREE.Group(); const f = this.f;
    this.g.add(M.box(0x4a4a52, this.w * 2, 0.08, 2.2, 0, 0.04, 0)); this.sp = new THREE.Group(); for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++) this.sp.add(M.cone(0xc8c8d0, 0.12, 0.9, -this.w + 0.5 + i * (this.w * 2 - 1) / 11, 0.45, -0.7 + j * 0.7)); this.g.add(this.sp);
    this.g.position.set(f.x, f.y, f.z); this.g.rotation.y = f.yaw; W.scene.add(this.g); this.up = 0;
  }
  update(dt) {
    const G = this.W.G, t = (G.time + this.ph) % 2.6, tgt = t < 1.0 ? 1 : 0, P = G.player, p = P.pos, f = this.f; if (tgt && this.up < 0.1 && Math.hypot(p.x - f.x, p.z - f.z) < 25) G.audio.sfx('spike', 0.4);
    this.up += (tgt - this.up) * Math.min(1, 18 * dt); this.sp.position.y = -0.95 + this.up * 0.95; this.sp.visible = this.up > 0.03 || t > 2.2; if (t > 2.2) this.sp.position.y = -0.8;
    const dx = p.x - f.x, dz = p.z - f.z, la = dx * f.nx + dz * f.nz, al = dx * f.tx + dz * f.tz;
    if (this.up > 0.5 && Math.abs(la) < this.w && Math.abs(al) < 1.2 && p.y - f.y < 0.7 && p.y - f.y > -1) { const sg = Math.sign(al) || -1; P.knock(f.tx * sg, f.tz * sg, 6, 10); }
  }
}
export class Pendulum {
  constructor(W, sec, a, ph) { this.W = W; this.f = sec.at(a, 0, 7); this.ph = ph; this.L = 5.6; this.g = new THREE.Group(); const f = this.f; this.arm = new THREE.Group(); this.arm.add(M.cyl(0x4a2c16, 0.06, this.L, 0, -this.L / 2, 0)); const lg = M.cyl(0x6b4a2a, 0.75, 2.6, 0, -this.L, 0); lg.rotation.x = Math.PI / 2; this.arm.add(lg); this.g.add(this.arm, M.box(0x6b4a2a, 12, 0.3, 0.3, 0, 0.15, 0), M.cyl(0x6b4a2a, 0.2, 9, -6, -4, 0), M.cyl(0x6b4a2a, 0.2, 9, 6, -4, 0)); this.g.position.set(f.x, f.y, f.z); this.g.rotation.y = f.yaw; W.scene.add(this.g); }
  update() {
    const G = this.W.G, w = 1.75, ang = Math.sin(G.time * w + this.ph) * 1.05, f = this.f, P = G.player, p = P.pos; this.arm.rotation.z = ang;
    const lx = Math.sin(ang) * this.L, ly = -Math.cos(ang) * this.L, bx = f.x + f.nx * lx, bz = f.z + f.nz * lx, by = f.y + ly;
    if (Math.hypot(p.x - bx, p.z - bz) < 1.25 && p.y < by + 0.9 && p.y + P.H > by - 0.9) { const dir = Math.sign(Math.cos(G.time * w + this.ph)) || 1; P.knock(f.nx * dir, f.nz * dir, 13, 6); }
  }
}
export class DartTotem {
  constructor(W, sec, a, ph) { this.W = W; this.ph = ph; this.w = sec.w || 5; this.f = sec.at(a, -this.w + 0.6, 0); const f = this.f; this.g = M.totem(); this.g.position.set(f.x, f.y, f.z); this.g.rotation.y = Math.atan2(-f.nx, -f.nz); W.scene.add(this.g); this.d = M.box(0xd8362c, 0.12, 0.12, 0.9, 0, 0, 0, { e: 0x661000 }); this.d.rotation.y = this.g.rotation.y; this.d.visible = false; W.scene.add(this.d); this.q = -1; }
  update(dt) {
    const G = this.W.G, t = (G.time + this.ph) % 2.0, f = this.f, P = G.player, p = P.pos; if (t < dt * 1.5 && this.q < 0) { this.q = 0.5; if (Math.hypot(p.x - f.x, p.z - f.z) < 22) G.audio.sfx('dart', 0.5); }
    if (this.q >= 0) { this.q += 15 * dt; const x = f.x + f.nx * this.q, z = f.z + f.nz * this.q; this.d.visible = true; this.d.position.set(x, f.y + 1.3, z); if (Math.hypot(p.x - x, p.z - z) < 0.75 && p.y < f.y + 1.6 && p.y + P.H > f.y + 1.0) { P.knock(f.nx, f.nz, 8, 5); this.q = -1; } if (this.q > this.w * 2 + 3) this.q = -1; } else this.d.visible = false;
  }
}

class Near { // shared "walk up and press E" behaviour
  near(r = 2.8) { const p = this.W.G.player.pos; return Math.hypot(p.x - this.x, p.z - this.z) < r && Math.abs(p.y - this.y) < 3; }
}
export class Chest extends Near {
  constructor(W, x, z, item, yaw) { super(); this.W = W; this.x = x; this.z = z; this.y = W.T.hAt(x, z); this.item = item; this.mesh = M.chest(); this.mesh.position.set(x, this.y, z); this.mesh.rotation.y = yaw || 0; W.scene.add(this.mesh); this.open = !!W.G.save.items[item]; this.prompt = 'Open chest'; this.beam = M.cyl(0xffe27a, 0.5, 30, x, this.y + 15, z, { e: 0xffc020, op: 0.25 }); this.beam.castShadow = false; W.scene.add(this.beam); }
  update(dt) { const lid = this.mesh.userData.lid; lid.rotation.x += ((this.open ? 1.9 : 0) - lid.rotation.x) * Math.min(1, 6 * dt); this.beam.visible = !this.open; this.canUse = !this.open && this.near(); }
  use() { this.open = true; this.W.G.give(this.item); }
}
export class Camp extends Near {
  constructor(W, x, z, idx) { super(); this.W = W; this.x = x; this.z = z; this.y = W.T.hAt(x, z); this.idx = idx; this.mesh = M.campfire(); this.mesh.position.set(x, this.y, z); W.scene.add(this.mesh); this.lit = false; this.light = new THREE.PointLight(0xff8a30, 0, 16); this.light.position.set(x, this.y + 1.2, z); W.scene.add(this.light); if ((W.G.save.camp[W.def.id] || 0) >= idx) this.setLit(true); }
  setLit(quiet) { this.lit = true; this.mesh.userData.flames.forEach(f => f.visible = true); this.mesh.userData.flag.material = M.mat(0xd8362c); this.light.intensity = 30; const n = this.W.nets[this.idx - 1]; if (n) { n.active = true; n.mesh.visible = true; } if (!quiet) { const G = this.W.G; G.save.camp[this.W.def.id] = Math.max(G.save.camp[this.W.def.id] || 0, this.idx); G.saveNow(); G.audio.sfx('camp'); G.ui.toast('Camp lit! Progress saved. A rope net now hangs down the cliff here: your way back up if you fall.', 6); } }
  update(dt) { if (!this.lit && this.near(4.5)) this.setLit(false); if (this.lit) { const f = this.mesh.userData.flames, s = 1 + Math.sin(this.W.G.time * 11) * 0.12; f[0].scale.y = 0.9 * s; f[1].scale.y = 0.5 / s; this.light.intensity = 26 + Math.sin(this.W.G.time * 9) * 6; } }
}
export class NPC extends Near {
  constructor(W, x, z, o) { super(); this.W = W; this.x = x; this.z = z; this.y = o.y !== undefined ? o.y : W.T.hAt(x, z); this.o = o; this.mesh = o.model; this.mesh.position.set(x, this.y, z); if (o.yaw !== undefined) this.mesh.rotation.y = o.yaw; W.scene.add(this.mesh); this.prompt = o.prompt || 'Talk to ' + o.name; this.t = Math.random() * 5; this.name = o.name; }
  update(dt) { this.t += dt; const p = this.W.G.player.pos, d = Math.hypot(p.x - this.x, p.z - this.z); if (this.mesh.userData.parts && this.mesh.userData.parts.armL) { M.animBiped(this.mesh, this.t * 3, 0, this.o.cheer ? 'cheer' : 'idle'); this.mesh.position.y = this.y; if (d < 9 && !this.o.fixed) face(this.mesh, p.x - this.x, p.z - this.z); } this.canUse = !this.gone && d < (this.o.reach || 3) && Math.abs(p.y - this.y) < 3; }
  use() { const G = this.W.G, lines = typeof this.o.lines === 'function' ? this.o.lines(G) : this.o.lines; G.ui.dialog(lines, () => { if (this.o.after) this.o.after(G, this); }); }
}
export class Jewel {
  constructor(W, x, y, z, idx) { this.W = W; this.x = x; this.y = y; this.z = z; this.idx = idx; this.mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), M.mat(0x7fe0ff, { e: 0x1a6f9a })); this.mesh.position.set(x, y, z); this.mesh.scale.y = 1.4; W.scene.add(this.mesh); this.got = !!(W.G.save.jewels[W.def.id] || [])[idx]; this.mesh.visible = !this.got; this.halo = M.cyl(0x9ae8ff, 0.35, 24, x, y + 12, z, { e: 0x3fb0e0, op: 0.2 }); this.halo.castShadow = false; this.halo.visible = !this.got; W.scene.add(this.halo); }
  update(dt) { if (this.got) return; this.mesh.rotation.y += dt * 2; this.mesh.position.y = this.y + Math.sin(this.W.G.time * 2) * 0.2; const p = this.W.G.player.pos; if (Math.hypot(p.x - this.x, p.y + 0.9 - this.y, p.z - this.z) < 1.6) { this.got = true; this.mesh.visible = this.halo.visible = false; this.W.G.gotJewel(this.idx); } }
}
export class Gate { // walk through to travel
  constructor(W, x, z, yaw, o) { this.W = W; this.x = x; this.z = z; this.o = o; this.y = W.T.hAt(x, z); const w = o.w || 4; this.mesh = M.gate(o.col, w); this.mesh.position.set(x, this.y, z); this.mesh.rotation.y = yaw; W.scene.add(this.mesh); this.cd = 1.5; const locked = !!(o.locked && o.locked(W.G));
    if (o.title) { this.mesh.children[3].visible = false; const sub = locked ? o.lockSub || 'LOCKED' : o.sub || 'Walk through'; for (const sd of [1, -1]) { const b = M.signBoard(o.title, sub, locked ? '#8a8378' : '#' + new THREE.Color(o.col).getHexString(), 10.5, 3.45); b.position.set(0, 8.6, sd * 0.72); b.rotation.y = sd > 0 ? 0 : Math.PI; this.mesh.add(b); } }
    if (locked) { this.door = new THREE.Group(); for (let i = 0; i < 5; i++) { const l = M.cyl(0x5a3c22, 0.3, w * 2 - 0.6, 0, 0.5 + i * 1.1, 0); l.rotation.z = Math.PI / 2 + (i % 2 ? 0.05 : -0.05); this.door.add(l); } for (const sd of [-1, 1]) { const l = M.cyl(0x4a3020, 0.22, 7.6, 0, 2.9, 0.4); l.rotation.z = sd * 0.9; this.door.add(l); } this.mesh.add(this.door); this.col = W.addBox(x, this.y + 3, z, w, 3, 0.5, -yaw, null); }
    else { this.glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 2 - 1.1, 5.6), new THREE.MeshBasicMaterial({ color: o.col, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })); this.glow.position.y = 2.9; this.mesh.add(this.glow); } }
  update(dt) { this.cd -= dt; if (this.glow) this.glow.material.opacity = 0.24 + Math.sin(this.W.G.time * 3) * 0.1; const p = this.W.G.player.pos, d = Math.hypot(p.x - this.x, p.z - this.z); if (d < 2.6 && Math.abs(p.y - this.y) < 4 && this.cd <= 0 && !this.W.G.locked) { this.cd = 3; if (this.door && this.o.pay && this.o.pay(this.W.G)) this.o.go(this.W.G); else if (this.door) { const t = typeof this.o.lockText === 'function' ? this.o.lockText(this.W.G) : this.o.lockText; this.W.G.ui.bark('The gate', t || 'Locked.'); } else this.o.go(this.W.G); } }
}
export class Geyser {
  constructor(W, x, z, ph) { this.W = W; this.x = x; this.z = z; this.y = W.T.hAt(x, z); this.ph = ph; this.m = M.cyl(0x77726a, 1.1, 0.3, x, this.y + 0.1, z); this.jet = M.cyl(0xcfeeff, 0.7, 1, x, this.y, z, { e: 0x7fb8d8, op: 0.55 }); this.jet.castShadow = false; W.scene.add(this.m, this.jet); }
  update() { const G = this.W.G, t = (G.time + this.ph) % 4, on = t < 1.3, P = G.player, p = P.pos, hgt = on ? 9 : t > 3.4 ? 0.6 : 0.01; this.jet.scale.y = hgt; this.jet.position.y = this.y + hgt / 2; this.jet.visible = hgt > 0.1; if (on && Math.hypot(p.x - this.x, p.z - this.z) < 1.3 && p.y - this.y < 8 && p.y >= this.y - 0.5) { if (P.vel.y < 14) { if (P.vel.y < 8) G.audio.sfx('bounce'); P.vel.y = 15; P.grounded = false; P.jumps = 1; } } }
}

// ---- the Goblin High Chieftain, on top of his throne pillar at the summit
export class Boss {
  constructor(W, y, story) {
    this.W = W; this.y0 = y; this.story = story; this.phase = 0; this.t = 0; this.cd = 4; this.sum = 9; this.stunT = 0; this.x = 0; this.z = 0; this.mob = false; this.done = !!W.G.save.won;
    this.pil = W.addCyl(0, y + 4.5, 0, 2.6, 4.5, 0x6a5a4a); this.top = y + 9;
    this.mesh = M.goblin({ scale: 1.5, skin: 0x5c9a38, shirt: 0x7a1f1f, wide: 1.4, club: 1 }); const P = this.mesh.userData.parts; P.head.add(M.cyl(0xf2c230, 0.24, 0.12, 0, 0.42, 0, { e: 0x4a3500 })); for (let i = 0; i < 5; i++) P.head.add(M.cone(0xf2c230, 0.05, 0.16, Math.cos(i * 1.257) * 0.2, 0.54, Math.sin(i * 1.257) * 0.2));
    W.scene.add(this.mesh); this.cage = M.cage(); this.cageY = y + 14; W.scene.add(this.cage); this.pr = M.princess(); W.scene.add(this.pr);
    this.gongs = []; if (this.done) { this.phase = 5; this.mesh.visible = false; this.cageY = y; this.pil.solid = false; this.pil.mesh.visible = false; this.cage.visible = false; }
  }
  gong(g) {
    if (this.phase >= 3 || g.rung) return; g.rung = true; g.mesh.userData.disc.material = M.mat(0x777777); const G = this.W.G; G.audio.sfx('gong'); this.phase++; this.stunT = 3.5; G.player.shake = 0.5;
    G.ui.bark('Chieftain Grizzlegut', this.story.gong[this.phase - 1]);
    for (const e of this.W.ents) if (e.mob && e.arena && !e.dead) e.hit(9, 0, 0);
  }
  hit() { if (this.phase !== 3) return; const G = this.W.G; this.phase = 4; this.t = 0; G.audio.sfx('bonk'); G.audio.sfx('poof'); G.ui.bark('Chieftain Grizzlegut', this.story.fall); this.fv = { x: G.player.look.x, z: G.player.look.z }; const l = Math.hypot(this.fv.x, this.fv.z) || 1; this.fv.x /= l; this.fv.z /= l; }
  update(dt) {
    const W = this.W, G = W.G, P = G.player, p = P.pos; this.t += dt; this.cd -= dt; this.stunT -= dt; this.sum -= dt;
    const tgtTop = this.y0 + [9, 6, 3, 0.02, 0.02, 0.02][this.phase]; this.top += (tgtTop - this.top) * Math.min(1, 2 * dt);
    const hy = Math.max(0.01, (this.top - this.y0) / 2 + 1); this.pil.hy = hy; this.pil.y = this.top - hy; this.pil.mesh.scale.y = hy * 2; this.pil.mesh.position.y = this.pil.y;
    const active = !this.done && Math.hypot(p.x, p.z) < 46 && p.y > this.y0 - 3; this.active = active;
    if (this.phase < 4) {
      if (this.phase === 3) { this.x = 4; this.z = 0; this.pil.solid = false; }
      const my = this.phase === 3 ? W.T.hAt(this.x, this.z) : this.top; this.y = my; this.hittable = this.phase === 3; this.r = 1.2; this.h = 2.6; this.mesh.position.set(this.x, my, this.z); face(this.mesh, p.x - this.x, p.z - this.z);
      M.animBiped(this.mesh, this.t * 4, 0, this.stunT > 0 || this.phase === 3 ? 'idle' : this.cd < 0.6 ? 'cheer' : 'idle'); this.mesh.position.y = my; this.mesh.rotation.z = this.stunT > 0 || this.phase === 3 ? Math.sin(this.t * 9) * 0.3 : 0;
      if (active && this.phase < 3 && this.stunT <= 0 && !G.locked) {
        if (!this.seen) { this.seen = true; G.ui.bark('Chieftain Grizzlegut', this.story.intro); G.audio.music('boss'); }
        if (this.cd <= 0) { this.cd = [3.2, 2.5, 1.9][this.phase]; const dx = p.x - this.x, dz = p.z - this.z, l = Math.hypot(dx, dz) || 1; W.add(new Boulder(W, { x: dx / l * 4.2, z: dz / l * 4.2, vx: dx / l * 15, vz: dz / l * 15, r: 1.1, life: 7, col: 0x7a6a5a })); G.audio.sfx('rumble', 0.7); }
        if (this.sum <= 0) { this.sum = 13 - this.phase * 2; let n = 0; for (const e of W.ents) if (e.mob && e.arena && !e.dead) n++; for (let i = n; i < 2 + this.phase; i++) { const a = Math.random() * TAU; W.add(new Mob(W, this.phase ? 'brute' : 'grunt', Math.cos(a) * 12, Math.sin(a) * 12, { arena: 38 })); W.puff(Math.cos(a) * 12, this.y0 + 1, Math.sin(a) * 12, 0x9be06a, 8); } }
      }
    } else if (this.phase === 4) {
      this.x += this.fv.x * 13 * dt; this.z += this.fv.z * 13 * dt; const my = W.T.hAt(this.x, this.z) + 1; this.mesh.position.set(this.x, my, this.z); this.mesh.rotation.x += dt * 12;
      if (this.t > 5 || Math.hypot(this.x, this.z) > 120) { this.phase = 5; this.mesh.visible = false; G.audio.music(W.theme.music); G.audio.sfx('win'); G.ui.toast('The Chieftain is rolling all the way down the mountain. Go and free the Princess!', 7); }
    }
    if (this.phase === 5 && this.cageY > this.y0 + 0.2) this.cageY = Math.max(this.y0 + 0.1, this.cageY - 3 * dt);
    this.cage.position.set(-7, this.cageY, 0); this.pr.position.set(-7, this.cageY + 0.1, 0); face(this.pr, p.x + 7, p.z); M.animBiped(this.pr, this.t * 3, 0, this.phase >= 5 ? 'cheer' : 'idle'); this.pr.position.y = this.cageY + 0.1;
    if (this.phase === 5 && !this.freed && this.cageY <= this.y0 + 0.2) { this.freed = true; this.cage.visible = false; W.add(new NPC(W, -7, 0, { name: 'Princess Wrenna', model: this.pr, y: this.y0 + 0.1, cheer: 1, lines: G2 => G2.save.won ? this.story.after : this.story.rescue, after: G2 => G2.finishGame() })); }
  }
}
export class Gong extends Near {
  constructor(W, x, y, z, boss) { super(); this.W = W; this.x = x; this.y = y; this.z = z; this.boss = boss; this.mesh = M.gong(); this.mesh.position.set(x, y, z); face(this.mesh, -x, -z); W.scene.add(this.mesh); this.hittable = true; this.r = 1.2; this.h = 3; }
  update() { if (!this.rung) this.mesh.userData.disc.rotation.z = Math.sin(this.W.G.time * 2) * 0.05; }
  hit() { this.boss.gong(this); }
}

// Rocks (or icicles) that drop out of the cliff above onto the trail. A shadow on the ground gives a second's warning.
export class RockRain {
  constructor(W, sec, rate) { this.W = W; this.s = sec; this.rate = rate || 0.5; this.cd = 0; this.d = []; this.ice = W.def.theme === 'snow'; }
  update(dt) {
    const W = this.W, G = W.G, P = G.player, p = P.pos, s = this.s, sp = W.spiral, rt = W.route; if (!rt) return;
    const a = (rt.phi - s.p0) / (s.p1 - s.p0) * s.len, inside = a > -6 && a < s.len + 2 && Math.abs(rt.lat) < s.w + 4 && Math.abs(p.y - sp.trailY(rt.phi)) < 8; this.cd -= dt;
    if (inside && this.cd <= 0 && !G.locked) {
      this.cd = this.rate * (0.6 + Math.random() * 0.8); const f = s.at(Math.max(1, Math.min(s.len - 1, a + Math.random() * 11 - 2)), (Math.random() * 2 - 1) * (s.w - 0.6), 0), y = W.T.hAt(f.x, f.z);
      const sh = M.cyl(0x000000, 1.5, 0.04, f.x, y + 0.06, f.z, { op: 0.35 }); sh.castShadow = false; const m = this.ice ? M.cone(0xcfeeff, 0.6, 2.4, f.x, y + 26, f.z, { flat: 1, e: 0x335566 }) : M.boulderMesh(0.8 + Math.random() * 0.4); if (this.ice) m.rotation.x = Math.PI; m.position.set(f.x, y + 26, f.z); W.scene.add(sh, m); this.d.push({ x: f.x, y, z: f.z, t: 0, sh, m });
    }
    for (const d of this.d) {
      d.t += dt; const q = d.t / 1.05; d.sh.scale.set(0.4 + q * 1.2, 0.04, 0.4 + q * 1.2); d.m.position.y = d.y + 26 * (1 - q * q) + 0.6; d.m.rotation.z += dt * 3;
      if (q >= 1) { d.dead = true; W.scene.remove(d.sh, d.m); W.puff(d.x, d.y + 0.5, d.z, this.ice ? 0xdff4ff : 0xcfc8ba, 9); const dd = Math.hypot(p.x - d.x, p.z - d.z); if (dd < 16) G.audio.sfx('slam', 0.45); if (dd < 1.9 && Math.abs(p.y - d.y) < 3) { if (P.knock(p.x - d.x + P.vel.x * 0.1, p.z - d.z + P.vel.z * 0.1, 9, 7)) G.stat('flattened'); } }
    }
    if (this.d.some(d => d.dead)) this.d = this.d.filter(d => !d.dead);
  }
}
// Gusts that shove you toward the drop unless you crouch.
export class Wind {
  constructor(W, sec) { this.W = W; this.s = sec; this.ph = sec.idx; }
  update(dt) {
    const W = this.W, G = W.G, P = G.player, p = P.pos, s = this.s, rt = W.route; if (!rt || rt.phi < s.p0 || rt.phi > s.p1 || Math.abs(rt.lat) > s.w + 3) return;
    const t = (G.time + this.ph) % 5.5, r = Math.hypot(p.x, p.z) || 1;
    if (t > 3.3 && t < 3.3 + dt * 1.5) { G.audio.sfx('slide'); G.ui.toast('Wind! Crouch (hold C) or it will carry you off.', 2.5); }
    if (t > 3.9) { if (Math.random() < 0.5) W.puff(p.x - p.x / r * 6 + (Math.random() - 0.5) * 8, p.y + Math.random() * 3, p.z - p.z / r * 6 + (Math.random() - 0.5) * 8, 0xffffff, 1); if (!P.crouch && !P.climb && !G.locked && !G.save.upg.cloak) { const k = (P.grounded ? 34 : 14) * dt; P.vel.x += p.x / r * k; P.vel.z += p.z / r * k; if (P.grounded) { p.x += p.x / r * 3.2 * dt; p.z += p.z / r * 3.2 * dt; } } }
  }
}
// A rope slung across a long drop: press E at the post to ride it.
export class ZipLine extends Near {
  constructor(W, a, b) { super(); this.W = W; this.x = a.x; this.y = a.y - 3.2; this.z = a.z; this.b = b; this.prompt = 'Ride the zip line'; W.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)]), new THREE.LineBasicMaterial({ color: 0x8a6238 }))); }
  update() { this.canUse = this.near(2.8) && !this.W.G.player.zip; }
  use() { const P = this.W.G.player, b = this.b; P.climb = P.swing = null; P.pos.y += 0.3; P.zip = { x: b.x, y: b.y - 0.4, z: b.z, t: 0, last: 1e9, stuck: 0, sp: 19, pop: 4, sx: b.x, sy: b.y, sz: b.z }; P.grounded = false; this.W.G.audio.sfx('hook'); }
}
// A goblin barricade that only comes down once every goblin guarding it has been bonked.
export class Ambush {
  constructor(W, sec, box, mesh, mobs) { this.W = W; this.s = sec; this.box = box; this.mesh = mesh; this.mobs = mobs; this.open = false; this.said = false; }
  update(dt) {
    const W = this.W, G = W.G, rt = W.route;
    if (!this.said && rt && rt.phi > this.s.p0 + 6 / W.spiral.R(this.s.p0) && rt.phi < this.s.p1) { this.said = true; G.ui.bark('Chieftain Grizzlegut', "AMBUSH! GET 'IM, LADS! NOBODY OPENS THAT GATE TILL HE IS FLAT!"); G.ui.toast('Beat every goblin here to bring the barricade down.', 5); }
    if (!this.open && this.mobs.every(m => m.dead)) { this.open = true; this.box.solid = false; G.audio.sfx('crumble'); G.audio.sfx('camp'); G.ui.toast('The barricade is down!', 3); W.dropCoins(this.box.x, this.box.y, this.box.z, 8); W.puff(this.box.x, this.box.y, this.box.z, 0xcfc8ba, 16); }
    if (this.open && this.mesh.position.y > -20) { this.mesh.position.y -= 9 * dt; this.mesh.rotation.x += dt * 0.6; }
  }
}
// The Chieftain's favourite: one enormous boulder set rolling behind you on a downhill stretch.
export class Chase {
  constructor(W, sec) { this.W = W; this.s = sec; this.b = null; this.cool = 0; const f = sec.at(1.5, -3, 0); this.gob = M.goblin({ hat: 0xb5332a }); this.gy = W.T.hAt(f.x, f.z); this.gob.position.set(f.x, this.gy, f.z); W.scene.add(this.gob); this.t = 0; }
  update(dt) {
    const W = this.W, G = W.G, s = this.s, rt = W.route; this.t += dt; this.cool -= dt; M.animBiped(this.gob, this.t * 4, 0, this.b && !this.b.dead ? 'cheer' : 'idle'); this.gob.position.y = this.gy; if (!rt) return;
    const a = (rt.phi - s.p0) / (s.p1 - s.p0) * s.len;
    if ((!this.b || this.b.dead) && this.cool <= 0 && a > 9 && a < s.len - 14 && Math.abs(rt.lat) < s.w + 2 && !G.locked) { this.b = W.add(new Boulder(W, { sec: s, a: 0.5, dir: 1, sp: 8, r: 2.5, end: s.len - 2, wob: 0.5, col: 0x6f6a62 })); this.cool = 22; G.ui.bark('Chieftain Grizzlegut', 'RELEASE THE BIG ONE!'); G.ui.toast('RUN! Sprint (SHIFT) and jump the logs!', 4); }
    if (this.b && !this.b.dead && (G.frame % 40) === 0) { G.audio.sfx('rumble', 0.6); G.player.shake = Math.max(G.player.shake, 0.12); }
  }
}

// River pike: big fish that leap across the crossing where you are about to step and knock you into the current.
export class Pike {
  constructor(W, sec, ac) { this.W = W; this.s = sec; this.ac = ac; this.cd = 1.5; this.j = null; this.mesh = new THREE.Group(); this.mesh.add(M.box(0x4a7a8a, 0.45, 0.5, 1.5, 0, 0, 0), M.cone(0x4a7a8a, 0.3, 0.6, 0, 0, -1.0), M.box(0x2f5a6a, 0.08, 0.55, 0.5, 0, 0, 0.95), M.box(0xf4f0d8, 0.3, 0.12, 0.3, 0, -0.18, -0.8)); this.mesh.children[1].rotation.x = -Math.PI / 2; this.mesh.visible = false; W.scene.add(this.mesh); }
  update(dt) {
    const W = this.W, G = W.G, P = G.player, p = P.pos, s = this.s, rt = W.route; if (!rt) return; const a = (rt.phi - s.p0) / (s.p1 - s.p0) * s.len, near = Math.abs(a - this.ac) < 10.5 && Math.abs(rt.lat) < s.w + 2 && !P.swim; this.cd -= dt;
    if (!this.j && near && this.cd <= 0 && !G.locked) { const lead = Math.hypot(P.vel.x, P.vel.z) > 1 ? 2.2 : 0, dir = (P.vel.x * -Math.sin(rt.phi) + P.vel.z * Math.cos(rt.phi)) >= 0 ? 1 : -1, ja = Math.max(this.ac - 8, Math.min(this.ac + 8, a + dir * lead)); this.j = { a: ja, t: -0.65 }; const f = s.at(ja, -3.5, -1); W.puff(f.x, f.y, f.z, 0x9fd8ff, 8); G.audio.sfx('splash', 0.5); }
    if (this.j) { const j = this.j; j.t += dt; if (j.t < 0) return; const q = j.t / 0.75, f = s.at(j.a, -3.5 + q * 7, -1 + Math.sin(q * Math.PI) * 3.1); this.mesh.visible = true; this.mesh.position.set(f.x, f.y, f.z); this.mesh.rotation.set(0, 0, 0); this.mesh.rotation.y = Math.atan2(-f.nx, -f.nz); this.mesh.rotation.x = (0.5 - q) * 1.8;
      if (Math.hypot(p.x - f.x, p.y + 0.9 - f.y, p.z - f.z) < 1.25 && P.inv <= 0) { if (P.knock(f.nx, f.nz, 9, 4)) { G.stat('knocked'); G.ui.toast('A river pike! Time your steps between its leaps.', 3); } }
      if (q >= 1) { this.j = null; this.mesh.visible = false; this.cd = 1.3 + Math.random() * 1.2; W.puff(f.x, f.y, f.z, 0x9fd8ff, 6); } }
  }
}

// The hero: running, triple jumps, sliding, crawling, climbing, balancing, swimming, whip swings, grapple zips, gliding.
import * as THREE from 'three';
import { clamp, approach } from './util.js';
import { hero, animBiped, glider, viewHands, GEO, mat } from './models.js';

const G_ = 27, J1 = 9.6, J2 = 9.2, J3 = 11, RAD = 0.4;
const nrm = { x: 0, y: 1, z: 0 }, cur = { x: 0, z: 0 };

export class Player {
  constructor(G) {
    this.G = G; this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0;
    this.H = 1.8; this.eye = 1.62; this.grounded = false; this.ground = null; this.jumps = 0; this.coyote = 0; this.sinceJump = 9;
    this.crouch = false; this.slideT = 0; this.steep = false; this.climb = null; this.swing = null; this.zip = null; this.glide = false; this.swim = false;
    this.lean = 0; this.onBeam = null; this.noBeamT = 0; this.stun = 0; this.inv = 0; this.whipCd = 0; this.whipAnim = 0; this.climbCd = 0; this.third = false; this.shake = 0; this.airT = 0;
    this.model = hero(); this.gl = glider(); this.gl.visible = false; this.model.add(this.gl); this.animT = 0; this.faceYaw = 0;
    this.hands = viewHands();
    this.rope = new THREE.Group(); this.segs = []; this.lashMat = [mat(0x3a2414), mat(0xb8b8c4)]; for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(GEO.cylG, this.lashMat[0]); m.frustumCulled = false; this.rope.add(m); this.segs.push(m); } this.rope.visible = false; this.camDist = 6.2; this.va = new THREE.Vector3(); this.vb = new THREE.Vector3(); this.vc = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0);
    this.aimWhip = null; this.aimHook = null; this.tmp = new THREE.Vector3(); this.look = new THREE.Vector3();
  }
  spawn(x, y, z, yaw = 0) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.yaw = yaw; this.pitch = 0; this.climb = this.swing = this.zip = null; this.crouch = false; this.swim = false; this.H = 1.8; this.stun = 0; this.inv = 1; this.lean = 0; }
  detach() { this.climb = null; this.swing = null; this.zip = null; }
  knock(dx, dz, power, up = 7) {
    if (this.inv > 0) return false;
    const l = Math.hypot(dx, dz) || 1; power *= 1 - (this.G.save.upg.hide || 0) * 0.17; this.vel.set(dx / l * power, up, dz / l * power); this.stun = 0.5; this.inv = 1.4; this.detach(); this.grounded = false; this.pos.y += 0.06; this.shake = 0.35; this.slideT = 0;
    this.G.loseCoins(); this.G.audio.sfx('hit'); return true;
  }
  canStand() {
    const p = this.pos;
    for (const b of this.G.world.boxes) {
      if (!b.solid || b.y - b.hy > p.y + 1.8 || b.y + b.hy < p.y + 0.95) continue;
      const dx = p.x - b.x, dz = p.z - b.z; if (Math.abs(dx) + Math.abs(dz) > b.rad + 1) continue;
      if (b.r) { if (dx * dx + dz * dz < (b.r + RAD) * (b.r + RAD)) return false; continue; }
      const lx = dx * b.ax + dz * b.az, lz = -dx * b.az + dz * b.ax, ex = lx - clamp(lx, -b.hx, b.hx), ez = lz - clamp(lz, -b.hz, b.hz);
      if (ex * ex + ez * ez < RAD * RAD) return false;
    }
    return true;
  }
  // The point on any branch, trunk, log or post that the aim passes closest to (within reach), or null.
  aimLimb(range, skip) {
    const ex = this.pos.x, ey = this.pos.y + this.eye, ez = this.pos.z, L = this.look, loose = this.grounded ? 1 : 1.6; let best = null, bs = 1;
    for (const m of this.G.world.limbs) {
      const wx = ex - m.ax, wy = ey - m.ay, wz = ez - m.az; if (Math.abs(wx) > range + m.len || Math.abs(wz) > range + m.len) continue;
      const vx = m.bx - m.ax, vy = m.by - m.ay, vz = m.bz - m.az, b = L.x * vx + L.y * vy + L.z * vz, c = m.len * m.len, d = L.x * wx + L.y * wy + L.z * wz, e = vx * wx + vy * wy + vz * wz, den = c - b * b;
      let q = den < 1e-6 ? 0.5 : clamp((e - b * d) / den, 0, 1), t = clamp(b * q - d, 0, range); q = clamp((b * t + e) / c, 0, 1); t = clamp(b * q - d, 0, range); if (t < 1.6) continue;
      const px = m.ax + vx * q, py = m.ay + vy * q, pz = m.az + vz * q, miss = Math.hypot(ex + L.x * t - px, ey + L.y * t - py, ez + L.z * t - pz), tol = (0.45 + t * 0.055) * loose; if (miss > tol || Math.hypot(px - ex, py - ey, pz - ez) > range) continue;
      if (skip && Math.hypot(px - skip.x, py - skip.y, pz - skip.z) < 3) continue;
      const sc = miss / tol; if (sc < bs) { bs = sc; best = this._al = this._al || {}; best.x = px; best.y = py; best.z = pz; }
    }
    return best ? { x: best.x, y: best.y, z: best.z } : null;
  }
  // Where a hook (rock, wood, cliff edges) or a cannon spike (anything at all) would bite along the line of sight.
  aimSurface(range, any) {
    const W = this.G.world, L = this.look, h = W.raycast(this.pos.x, this.pos.y + this.eye, this.pos.z, L.x, L.y, L.z, range); if (!h) return null;
    if (h.b && h.b.noHook) return null;
    if (!any && !h.b) { W.T.normalAt(h.x, h.z, nrm); if (nrm.y > 0.8) return null; }
    let y = h.y + 1.0; if (h.b) { const top = h.b.y + h.b.hy; if (top - h.y < 3.2) y = top + 0.5; }
    return { x: h.x - L.x * 0.5, y, z: h.z - L.z * 0.5, surf: 1, sx: h.x, sy: h.y, sz: h.z };
  }
  update(dt) {
    const G = this.G, I = G.input, W = G.world, T = W.T, S = G.save, p = this.pos, v = this.vel;
    const sens = 0.0023 * (S.sens || 1); this.yaw -= I.mx * sens; this.pitch = clamp(this.pitch - I.my * sens, -1.5, 1.5);
    const cp = Math.cos(this.pitch); this.look.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    this.stun -= dt; this.inv -= dt; this.whipCd -= dt; this.whipAnim -= dt; this.climbCd -= dt; this.noBeamT -= dt; this.sinceJump += dt; this.shake -= dt;
    const ctrl = this.stun <= 0 && !G.locked;
    let f = 0, s = 0; if (ctrl) { f = (I.down('KeyW') || I.down('ArrowUp') ? 1 : 0) - (I.down('KeyS') || I.down('ArrowDown') ? 1 : 0); s = (I.down('KeyD') || I.down('ArrowRight') ? 1 : 0) - (I.down('KeyA') || I.down('ArrowLeft') ? 1 : 0); }
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = -sy * f + cy * s, wz = -cy * f - sy * s; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
    const jumpHit = ctrl && I.hit('Space'), jumpHeld = ctrl && I.down('Space'), crouchHeld = ctrl && (I.down('KeyC') || I.down('ControlLeft')), sprint = I.down('ShiftLeft') || I.down('ShiftRight');
    this.hex = (this.hex || 0) - dt; const hexed = this.hex > 0, maxJumps = S.items.boots ? 3 : 2, jb = (1 + (S.upg.spring || 0) * 0.06) * (hexed ? 0.72 : 1);
    if (ctrl && I.hit('KeyG')) W.throwBomb(this);
    if (this.grounded && this.ground && this.ground.mover) { p.x += this.ground.dx; p.y += this.ground.dy; p.z += this.ground.dz; }
    const wasGrounded = this.grounded; let ice = false;
    // ---- tools
    this.aimWhip = S.items.whip ? this.aimLimb(13 + (S.upg.whip || 0) * 2.5, this.swing && this.swing.a) : null;
    const hr = S.items.cannon ? 62 : 27; this.aimHook = S.items.hook ? (this.aimLimb(hr) || this.aimSurface(hr, !!S.items.cannon)) : null; this.hookDenied = false; if (this.aimHook && !W.hookOk(p, this.aimHook)) { this.aimHook = null; this.hookDenied = true; }
    if (ctrl && I.lmbHit && S.items.whip && this.whipCd <= 0 && !this.swim) {
      this.whipCd = 0.4; this.whipAnim = 0.3;
      const hitMob = W.whipHit(this, 5.5 + (S.upg.whip || 0)); G.audio.sfx('whip');
      if (!hitMob && this.aimWhip) { const a = this.aimWhip, L = clamp(Math.hypot(a.x - p.x, a.y - p.y - 1.5, a.z - p.z), 2.5, 16); this.climb = this.zip = null; this.swing = { a, L, Lmin: clamp(L * 0.8, 2.5, 6.6), t: 0 }; this.grounded = false; this.jumps = 1;  }
      else if (this.swing && !hitMob) { this.swing = null; this.jumps = 1; }
    }
    if (ctrl && (I.rmbHit || I.hit('KeyQ')) && S.items.hook && !this.swim) {
      let t = this.aimHook; const sp = S.items.cannon ? 38 : 27;
      if (t) { this.climb = this.swing = null; this.zip = { x: t.x, y: t.y, z: t.z, t: 0, last: 1e9, stuck: 0, sp, pop: t.surf ? 11.5 : 8.8, sx: t.sx === undefined ? t.x : t.sx, sy: t.sy === undefined ? t.y : t.sy, sz: t.sz === undefined ? t.z : t.sz }; this.grounded = false; G.audio.sfx(S.items.cannon ? 'cannon' : 'hook'); if (S.items.cannon) W.cannonBlast(t); }
      else { G.audio.sfx('miss'); if (this.hookDenied) G.ui.toast('That face is too sheer and loose: the hook rips straight out. You will have to take the trail.', 4); }
    }
    // ---- water
    const wY = T.waterY(p.x, p.z), inWater = p.y < wY - 0.35;
    if (inWater && !this.swim) { G.audio.sfx('splash'); this.detach(); W.puff(p.x, wY, p.z, 0x9fd8ff, 10); }
    this.swim = inWater;
    // ---- motion states
    if (this.zip) {
      const z = this.zip, dx = z.x - p.x, dy = z.y - (p.y + 1.2), dz = z.z - p.z, d = Math.hypot(dx, dy, dz); z.t += dt;
      if (d > z.last - z.sp * dt * 0.3) z.stuck += dt; else z.stuck = 0; z.last = d;
      if (jumpHit) { this.zip = null; v.multiplyScalar(0.55); v.y = Math.max(v.y, 7); this.jumps = 1; }
      else if (d < 1.4 || z.t > 3 || z.stuck > 0.18) { this.zip = null; const hl = Math.hypot(dx, dz) || 1; if (wl > 0.1) v.set(wx / wl * 6.5, z.pop, wz / wl * 6.5); else v.set(dx / hl * 5.5, z.pop, dz / hl * 5.5); this.jumps = 1; this.sinceJump = 0; }
      else v.set(dx / d * z.sp, dy / d * z.sp, dz / d * z.sp);
    } else if (this.climb) {
      const c = this.climb;
      if (!ctrl) this.climb = null;
      else if (jumpHit) { v.set(c.nx * 6.5, 9.2, c.nz * 6.5); this.climb = null; this.climbCd = 0.3; this.jumps = 1; this.sinceJump = 0; G.audio.sfx('jump'); }
      else if (I.hit('KeyC') || I.hit('ControlLeft')) { this.climb = null; this.climbCd = 0.45; }
      else { const tx = -c.nz, tz = c.nx, side = (cy * tx - sy * tz) * s, ft = -sy * tx - cy * tz, cs = 1 + (S.upg.grip || 0) * 0.35, along = (side * 2.8 + f * ft * 3.4) * cs; v.set(tx * along - c.nx * 1.2, f * (1 - Math.abs(ft)) * 3.8 * cs, tz * along - c.nz * 1.2); if (wasGrounded && f < 0) { this.climb = null; this.climbCd = 0.3; } }
    } else if (this.swim) {
      T.current(p.x, p.z, cur); const k = Math.min(1, 5 * dt);
      v.x += (cur.x + wx * 3.3 - v.x) * k; v.z += (cur.z + wz * 3.3 - v.z) * k; if (Math.hypot(v.x, v.z) < 1.2 && Math.hypot(cur.x, cur.z) > 2) { v.x -= cur.z * 0.5; v.z += cur.x * 0.5; } v.y = clamp((wY - 0.6 - p.y) * 6, -6, 4); this.jumps = 0; this.glide = false; this.crouch = false; this.slideT = 0;
    } else {
      // crouch, crawl and slide
      if (crouchHeld && !this.crouch) { this.crouch = true; if (this.grounded && Math.hypot(v.x, v.z) > 6.2) { this.slideT = 1.0; const b = 1.18; v.x *= b; v.z *= b; G.audio.sfx('slide'); } }
      if (!crouchHeld && this.crouch && this.canStand()) { this.crouch = false; this.slideT = 0; }
      const beam = null;
      let maxSp = (this.crouch ? 2.5 : sprint ? 8.4 : 5.4) * (hexed ? 0.55 : 1); if (beam) maxSp = sprint ? 4.4 : 2.9;
      if (this.grounded) {
        ice = this.ground ? !!this.ground.ice : W.iceAt(p.x, p.z);
        if (this.slideT > 0) {
          this.slideT -= dt; T.normalAt(p.x, p.z, nrm); const fr = Math.max(0, 1 - 1.1 * dt); v.x = v.x * fr + nrm.x * 14 * dt + wx * 3 * dt; v.z = v.z * fr + nrm.z * 14 * dt + wz * 3 * dt;
          if (Math.hypot(v.x, v.z) < 2.6) this.slideT = 0;
        } else {
          const acc = (ice ? 5 : 60) * dt; if (beam) { const al = (wx * -beam.az + wz * beam.ax); wx = -beam.az * al; wz = beam.ax * al; }
          const tx = wx * maxSp, tz = wz * maxSp, ddx = tx - v.x, ddz = tz - v.z, dl = Math.hypot(ddx, ddz);
          if (dl <= acc) { v.x = tx; v.z = tz; } else { v.x += ddx / dl * acc; v.z += ddz / dl * acc; }
        }
      } else {
        const sp0 = Math.hypot(v.x, v.z), a = (this.steep ? 6 : this.swing ? 9 : 20) * dt; v.x += wx * a; v.z += wz * a;
        const sp1 = Math.hypot(v.x, v.z), cap = Math.max(sp0, maxSp); if (sp1 > cap) { v.x *= cap / sp1; v.z *= cap / sp1; }
      }
      // jumping
      if (jumpHit && !this.swing) {
        if (this.grounded || this.coyote > 0) { v.y = J1 * jb; this.jumps = 1; this.grounded = false; this.coyote = 0; this.sinceJump = 0; p.y += 0.03; G.audio.sfx('jump'); if (this.crouch && this.canStand()) { this.crouch = false; this.slideT = 0; } }
        else if (this.jumps < maxJumps) {
          if (this.jumps === 0) this.jumps = 1; this.jumps++; v.y = (this.jumps === 2 ? J2 : J3) * jb; this.sinceJump = 0;
          if (wl > 0.1) { const sp = Math.max(Math.hypot(v.x, v.z), 4.5); v.x = v.x * 0.4 + wx * sp * 0.6; v.z = v.z * 0.4 + wz * sp * 0.6; }
          G.audio.sfx(this.jumps === 3 ? 'jump3' : 'jump2'); W.puff(p.x, p.y, p.z, 0xffffff, 5);
        }
      }
      if (this.swing) { if (jumpHit) { this.swing = null; v.x *= 1.1; v.z *= 1.1; v.y += 4; this.jumps = 1; this.sinceJump = 0; G.audio.sfx('jump2'); } }
      // gliding
      this.glide = !!S.items.glider && jumpHeld && !this.grounded && !this.swing && (v.y < 0 || this.glide) && this.sinceJump > 0.22;
      if (this.glide) {
        const fall = -2.5 + (S.upg.silk || 0) * 0.45; if (v.y < fall) v.y += (fall - v.y) * Math.min(1, 9 * dt);
        const fx = -sy, fz = -cy, gs = 11.5, k = Math.min(1, 2.2 * dt); v.x += (fx * gs - v.x) * k; v.z += (fz * gs - v.z) * k;
        const up = W.updraftAt(p.x, p.y, p.z); if (up) v.y = Math.min(v.y + up * dt, 10);
      }
      v.y = Math.max(v.y - G_ * dt, -46);
    }
    // ---- balance beams
    if (false) {
      const b = this.ground, sp = Math.hypot(v.x, v.z), tt = G.time, amp = 0.35 + sp * 0.13;
      this.lean += (0.5 * this.lean + (Math.sin(tt * 1.3 + b.x) * 0.6 + Math.sin(tt * 2.9 + b.z) * 0.4) * amp - s * 1.9) * dt;
      const lat = (p.x - b.x) * b.ax + (p.z - b.z) * b.az, k = Math.min(1, 7 * dt); p.x -= b.ax * lat * k; p.z -= b.az * lat * k; this.onBeam = b;
      if (Math.abs(this.lean) >= 1) { const sg = Math.sign(this.lean); v.x = cy * sg * 4.5; v.z = -sy * sg * 4.5; v.y = 2; this.noBeamT = 0.6; this.grounded = false; this.lean = 0; this.stun = 0.3; G.audio.sfx('hit'); G.ui.toast('Whoa! Lost your balance.'); }
    } else { this.onBeam = null; this.lean *= Math.max(0, 1 - 6 * dt); }
    // ---- move and collide
    this.H = this.crouch || this.swim ? 0.9 : 1.8;
    const dist = v.length() * dt, steps = Math.max(1, Math.ceil(dist / 0.22)), sdt = dt / steps;
    this.grounded = false; this.ground = null; this.steep = false; let touchedClimb = false;
    for (let i = 0; i < steps; i++) {
      const ox = p.x, oz = p.z;
      p.x += v.x * sdt; p.y += v.y * sdt; p.z += v.z * sdt;
      // terrain
      let hT = T.hAt(p.x, p.z);
      if (p.y < hT + 0.002) {
        T.normalAt(p.x, p.z, nrm); const net = W.inNet(p.x, p.z);
        if (nrm.y >= 0.74 || net) { p.y = hT; if (v.y < 0) v.y = 0; if (v.y <= 0.5) { this.grounded = true; this.ground = null; } if (net) { const mx = Math.min(5, 6.5 * nrm.y / Math.max(0.3, Math.sqrt(1 - nrm.y * nrm.y))), sp = Math.hypot(v.x, v.z); if (sp > mx) { v.x *= mx / sp; v.z *= mx / sp; } } }
        else if (hT > p.y + 0.5 && !this.zip) { p.x = ox; p.z = oz; const hl = Math.hypot(nrm.x, nrm.z) || 1, ux = -nrm.x / hl, uz = -nrm.z / hl, d = v.x * ux + v.z * uz; if (d > 0) { v.x -= ux * d; v.z -= uz * d; } hT = T.hAt(p.x, p.z); if (p.y < hT) p.y = hT; }
        else { p.y = hT; const vn = v.x * nrm.x + v.y * nrm.y + v.z * nrm.z; if (vn < 0) { v.x -= nrm.x * vn; v.y -= nrm.y * vn; v.z -= nrm.z * vn; } this.steep = true; const fr = Math.max(0, 1 - 0.5 * sdt); v.x *= fr; v.z *= fr; }
      }
      // boxes and pillars
      for (const b of W.boxes) {
        if (!b.solid) continue; if (b.beam && this.noBeamT > 0) continue;
        const dx = p.x - b.x, dz = p.z - b.z; if (Math.abs(dx) > b.rad + 1 || Math.abs(dz) > b.rad + 1) continue;
        const top = b.y + b.hy, bot = b.y - b.hy; if (p.y >= top || p.y + this.H <= bot) continue;
        let ex, ez, d2, lx = 0, lz = 0;
        if (b.r) { const d = Math.hypot(dx, dz); if (d >= b.r + RAD) continue; const pen = Math.max(0, d - b.r); ex = d > 0 ? dx / d * pen : 0; ez = d > 0 ? dz / d * pen : 0; d2 = pen * pen; }
        else { lx = dx * b.ax + dz * b.az; lz = -dx * b.az + dz * b.ax; ex = lx - clamp(lx, -b.hx, b.hx); ez = lz - clamp(lz, -b.hz, b.hz); d2 = ex * ex + ez * ez; if (d2 >= RAD * RAD) continue; }
        const tol = (wasGrounded ? 0.5 : 0.3) + Math.max(0, -v.y) * sdt;
        if (p.y >= top - tol && v.y <= 0.5) {
          p.y = top; if (v.y < 0) { if (b.bounce) { v.y = b.bounce; this.jumps = 1; this.sinceJump = 0; G.audio.sfx('bounce'); if (b.onBounce) b.onBounce(); continue; } v.y = 0; }
          this.grounded = true; this.ground = b; if (b.crumble && !b.crT) b.crT = 0.001; continue;
        }
        if (v.y > 0 && p.y + this.H - bot < 0.4) { p.y = bot - this.H; v.y = 0; continue; }
        // push out sideways
        let nx, nz;
        if (b.r) { const d = Math.hypot(dx, dz) || 0.001; nx = dx / d; nz = dz / d; const push = b.r + RAD - d; p.x += nx * push; p.z += nz * push; }
        else {
          let px, pz;
          if (d2 < 1e-10) { const qx = b.hx - Math.abs(lx), qz = b.hz - Math.abs(lz); if (qx < qz) { px = Math.sign(lx) || 1; pz = 0; lx = px * (b.hx + RAD); } else { px = 0; pz = Math.sign(lz) || 1; lz = pz * (b.hz + RAD); } }
          else { const d = Math.sqrt(d2); px = ex / d; pz = ez / d; lx += px * (RAD - d); lz += pz * (RAD - d); }
          nx = px * b.ax - pz * b.az; nz = px * b.az + pz * b.ax; p.x = b.x + lx * b.ax - lz * b.az; p.z = b.z + lx * b.az + lz * b.ax;
        }
        // ledge grab: just short of the top while pushing toward it? Haul yourself up.
        if (!wasGrounded && !this.climb && !this.zip && !b.beam && !b.noGrab && ctrl && top - p.y < 1.4 && v.y < 9 && v.y > -16 && wx * nx + wz * nz < -0.3) { p.x -= nx * 0.55; p.z -= nz * 0.55; p.y = top + 0.02; v.y = 0; this.grounded = true; this.ground = b; this.swing = null; if (b.crumble && !b.crT) b.crT = 0.001; this.mantleT = 0.25; G.audio.sfx('land'); continue; }
        const vn = v.x * nx + v.z * nz; if (vn < 0 && !this.climb) { v.x -= nx * vn; v.z -= nz * vn; }
        if (b.climb) {
          if (this.climb && this.climb.b === b) { if (nx * this.climb.fx + nz * this.climb.fz > 0.9) { touchedClimb = true; this.climb.nx = nx; this.climb.nz = nz; } }
          else if (!this.climb && this.climbCd <= 0 && ctrl && !this.zip && !this.swing && (wx * nx + wz * nz < -0.3 || !wasGrounded && vn < -1)) { this.climb = { b, nx, nz, fx: nx, fz: nz }; touchedClimb = true; this.jumps = 1; this.glide = false; v.set(0, 0, 0); }
        }
      }
    }
    if (this.climb) {
      const b = this.climb.b;
      if (this.grounded && this.ground === b) this.climb = null;
      else if (!touchedClimb) { if (p.y >= b.y + b.hy - 0.9) { p.x -= this.climb.nx * 0.85; p.z -= this.climb.nz * 0.85; p.y = b.y + b.hy + 0.02; v.set(0, 0, 0); this.grounded = true; this.ground = b; } this.climb = null; this.climbCd = 0.25; }
    }
    // whip swing: stay on the end of the rope
    if (this.swing) {
      const a = this.swing.a, L = this.swing.L; let dx = p.x - a.x, dy = p.y + 1.5 - a.y, dz = p.z - a.z; const d = Math.hypot(dx, dy, dz); this.swing.t += dt;
      if (d > L) { dx /= d; dy /= d; dz /= d; p.x = a.x + dx * L; p.y = a.y + dy * L - 1.5; p.z = a.z + dz * L; const vr = v.x * dx + v.y * dy + v.z * dz; if (vr > 0) { v.x -= dx * vr; v.y -= dy * vr; v.z -= dz * vr; } }
      if (this.swing.L > this.swing.Lmin) this.swing.L = Math.max(this.swing.Lmin, this.swing.L - 5 * dt);
      if (this.grounded && this.swing.t > 0.5) this.swing = null;
    }
    if (this.grounded) { if (!wasGrounded && this.airT > 0.5) { G.audio.sfx('land'); W.puff(p.x, p.y, p.z, 0xd8ccb0, 4); } this.jumps = 0; this.coyote = 0.12; this.airT = 0; }
    else { this.coyote -= dt; this.airT += dt; }
    const r = Math.hypot(p.x, p.z), lim = T.S - 14; if (r > lim) { p.x *= lim / r; p.z *= lim / r; }
    this.ice = ice;
  }
  updateCamera(dt, cam) {
    const G = this.G, p = this.pos, T = G.world.T;
    this.mantleT = (this.mantleT || 0) - dt; const eyeT = this.H - 0.18 - (this.mantleT > 0 ? 0.5 : 0); this.eye += (eyeT - this.eye) * Math.min(1, 12 * dt);
    const sh = this.shake > 0 ? this.shake * 0.25 : 0, roll = this.lean * 0.3;
    cam.rotation.order = 'YXZ';
    if (!this.third) { cam.position.set(p.x + (Math.random() - 0.5) * sh, p.y + this.eye + (Math.random() - 0.5) * sh, p.z); cam.rotation.set(this.pitch, this.yaw, -roll); }
    else {
      const tx = p.x, ty = p.y + this.eye * 0.95, tz = p.z, L = this.look; let dist = this.camDist;
      for (let i = 1; i <= 8; i++) { const q = i / 8 * this.camDist, cx = tx - L.x * q, cz = tz - L.z * q, cyy = ty - L.y * q + 0.5; if (cyy < T.hAt(cx, cz) + 0.35) { dist = Math.max(1.2, q - 0.8); break; } }
      cam.position.set(tx - L.x * dist, ty - L.y * dist + 0.5 + sh, tz - L.z * dist); cam.rotation.set(this.pitch, this.yaw, -roll * 0.5);
    }
    // the body
    const m = this.model, sp = Math.hypot(this.vel.x, this.vel.z); m.visible = this.third; this.hands.visible = !this.third;
    if (this.third) {
      m.position.copy(p); if (sp > 0.6 && !this.climb) this.faceYaw = Math.atan2(-this.vel.x, -this.vel.z); else if (this.climb) this.faceYaw = Math.atan2(this.climb.nx, this.climb.nz); else if (G.locked !== true) this.faceYaw = this.yaw;
      let dy = this.faceYaw - m.rotation.y; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; m.rotation.y += dy * Math.min(1, 14 * dt);
      const mode = this.swim ? 'swim' : this.climb ? 'climb' : this.swing || this.zip ? 'swing' : this.glide ? 'glide' : this.crouch ? 'crouch' : !this.grounded ? 'air' : sp > 0.6 ? 'run' : 'idle';
      this.animT += dt * (mode === 'climb' ? Math.abs(this.vel.y) * 2.2 + Math.abs(this.vel.x) : mode === 'run' || mode === 'crouch' ? sp * 1.6 : 6);
      const body = m; animBiped(body, this.animT, sp, mode); m.position.y = p.y + (mode === 'crouch' ? -0.0 : 0); this.gl.visible = this.glide;
      m.visible = !(this.inv > 0 && this.stun <= 0 && (G.time * 12 | 0) % 2 === 0 && this.inv < 1.3);
    } else {
      const h = this.hands.userData, sw = this.whipAnim > 0 ? Math.sin((0.3 - this.whipAnim) / 0.3 * Math.PI) : 0, bob = this.grounded ? Math.sin(G.time * (sp > 6 ? 13 : 9)) * Math.min(1, sp / 5) * 0.012 : 0;
      h.r.rotation.x = 0.2 - sw * 1.3 + (this.swing ? -0.9 : 0) + (this.climb ? -0.7 + Math.sin(G.time * 7) * 0.2 * Math.sign(this.vel.y) : 0); h.r.position.y = -0.3 + bob + (this.glide ? 0.2 : 0);
      h.l.rotation.x = 0.2 + (this.zip ? -0.5 : 0) + (this.climb ? -0.7 - Math.sin(G.time * 7) * 0.2 * Math.sign(this.vel.y) : 0); h.l.position.y = -0.3 - bob + (this.glide ? 0.2 : 0);
      h.whip.visible = !!G.save.items.whip; h.coil.visible = !this.swing && this.whipAnim <= 0; h.hook.visible = !!G.save.items.hook && !G.save.items.cannon; h.cannon.visible = !!G.save.items.cannon;
    }
    // the whip lash (a tapering leather thong that arcs out and cracks) or the hook rope
    const t = this.swing ? this.swing.a : this.zip, crack = !t && this.whipAnim > 0 && !!G.save.items.whip; this.rope.visible = !!t || crack;
    if (this.rope.visible) {
      const side = this.zip ? -0.3 : 0.3, cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), L = this.look, a = this.va, b = this.vb, c = this.vc;
      if (this.third) a.set(p.x + cy * side, p.y + 1.25, p.z - sy * side); else a.set(p.x + cy * side * 0.8 + L.x * 0.45, p.y + this.eye - 0.3 + L.y * 0.45, p.z - sy * side * 0.8 + L.z * 0.45);
      if (t) { if (this.zip) b.set(t.sx, t.sy, t.sz); else b.set(t.x, t.y, t.z); const sag = this.zip ? 0 : Math.max(0, 0.5 - this.swing.t) * 3; c.set((a.x + b.x) / 2, (a.y + b.y) / 2 - sag, (a.z + b.z) / 2); }
      else { const u = 1 - this.whipAnim / 0.3, reach = (5.5 + (G.save.upg.whip || 0)) * Math.min(1, u * 1.7), back = 1 - Math.min(1, u * 1.5); b.set(a.x + L.x * reach - L.x * back * 2, a.y + L.y * reach + back * 1.6 - (1 - back) * 0.2, a.z + L.z * reach - L.z * back * 2); c.set(a.x + L.x * reach * 0.45 + cy * (0.9 - u * 1.4), a.y + L.y * reach * 0.45 + 1.7 * (1 - u) + 0.25, a.z + L.z * reach * 0.45 - sy * (0.9 - u * 1.4)); }
      const n = this.segs.length, mt = this.lashMat[this.zip ? 1 : 0]; let px = a.x, py = a.y, pz = a.z;
      for (let i = 0; i < n; i++) { const q = (i + 1) / n, w0 = (1 - q) * (1 - q), w1 = 2 * q * (1 - q), w2 = q * q, x = a.x * w0 + c.x * w1 + b.x * w2, y = a.y * w0 + c.y * w1 + b.y * w2, z = a.z * w0 + c.z * w1 + b.z * w2, m = this.segs[i], dx = x - px, dy = y - py, dz = z - pz, len = Math.hypot(dx, dy, dz) || 0.001, r = this.zip ? 0.018 : 0.034 - 0.024 * q; m.material = mt; m.position.set((x + px) / 2, (y + py) / 2, (z + pz) / 2); m.scale.set(r, len, r); m.quaternion.setFromUnitVectors(this.up, this.vc2 = (this.vc2 || new THREE.Vector3()).set(dx / len, dy / len, dz / len)); px = x; py = y; pz = z; }
    }
  }
}

import * as THREE from 'three';
import { G } from './state.js';
import { heightAt } from './world.js';

const tels = [];
const parts = [];
const rings = [];
const pGeo = new THREE.BoxGeometry(1, 1, 1);
const pMats = new Map();
const pmat = c => { if (!pMats.has(c)) pMats.set(c, new THREE.MeshBasicMaterial({ color: c, transparent: true })); return pMats.get(c); };

function telMat(color, op) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
}

// shape: circle {r} | sector {r, arc(deg)} | rect {width, len}; angle = facing (rotation.y)
export function telegraph(o) {
  const color = o.color ?? 0xff3020;
  const g = new THREE.Group();
  let outer, inner;
  if (o.shape === 'circle') {
    const geo = new THREE.CircleGeometry(o.r, 40); geo.rotateX(-Math.PI / 2);
    outer = new THREE.Mesh(geo, telMat(color, 0.18)); inner = new THREE.Mesh(geo, telMat(color, 0.3));
    const ring = new THREE.Mesh(new THREE.RingGeometry(o.r - 0.12, o.r, 40).rotateX(-Math.PI / 2), telMat(color, 0.7));
    g.add(ring);
  } else if (o.shape === 'sector') {
    const arc = o.arc * Math.PI / 180;
    const geo = new THREE.CircleGeometry(o.r, 24, -Math.PI / 2 - arc / 2, arc); geo.rotateX(-Math.PI / 2);
    outer = new THREE.Mesh(geo, telMat(color, 0.16)); inner = new THREE.Mesh(geo, telMat(color, 0.28));
  } else {
    const geo = new THREE.PlaneGeometry(o.width, o.len); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, o.len / 2);
    outer = new THREE.Mesh(geo, telMat(color, 0.16)); inner = new THREE.Mesh(geo, telMat(color, 0.3));
  }
  g.add(outer); g.add(inner);
  inner.scale.setScalar(0.001);
  g.renderOrder = 3; g.traverse(m => { m.renderOrder = 3; });
  g.position.set(o.x, heightAt(o.x, o.z) + 0.2, o.z);
  g.rotation.y = o.angle || 0;
  G.scene.add(g);
  const t = { g, inner, shape: o.shape, t: 0, dur: o.dur, done: false };
  tels.push(t);
  return t;
}
export function removeTelegraph(t) { if (t) t.done = true; }

export function burst(x, y, z, color, n = 10, speed = 4, life = 0.6, size = 0.15, grav = 9) {
  for (let i = 0; i < n; i++) {
    let p = parts.find(q => !q.alive);
    if (!p) { if (parts.length > 400) return; p = { mesh: new THREE.Mesh(pGeo, pmat(color)) }; G.scene.add(p.mesh); parts.push(p); }
    p.mesh.material = pmat(color);
    p.alive = true; p.mesh.visible = true;
    p.mesh.position.set(x, y, z);
    const a = Math.random() * Math.PI * 2, u = Math.random();
    p.vx = Math.cos(a) * speed * (0.4 + u); p.vz = Math.sin(a) * speed * (0.4 + u); p.vy = speed * (0.5 + Math.random());
    p.life = p.max = life * (0.6 + Math.random() * 0.6);
    p.size = size * (0.6 + Math.random() * 0.8); p.grav = grav;
    p.mesh.scale.setScalar(p.size);
  }
}

// expanding ring on the ground (shockwaves, landing)
export function shockRing(x, z, r, color = 0xffe0a0, dur = 0.4) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(x, heightAt(x, z) + 0.25, z);
  G.scene.add(m);
  rings.push({ m, r, t: 0, dur });
}

let shakeAmt = 0;
export function shake(a) { shakeAmt = Math.max(shakeAmt, a); }
export function shakeOffset(dt) {
  shakeAmt = Math.max(0, shakeAmt - dt * 2.5);
  return shakeAmt > 0 ? [(Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt] : [0, 0];
}

const timers = [];
export function later(d, fn) { timers.push({ t: d, fn }); }

export function updateFx(dt) {
  for (let i = timers.length - 1; i >= 0; i--) { const tm = timers[i]; tm.t -= dt; if (tm.t <= 0) { timers.splice(i, 1); tm.fn(); } }
  for (let i = tels.length - 1; i >= 0; i--) {
    const t = tels[i];
    t.t += dt;
    const k = Math.min(1, t.t / t.dur);
    if (t.shape === 'rect') t.inner.scale.set(1, 1, Math.max(0.001, k)); else t.inner.scale.setScalar(Math.max(0.001, k));
    if (t.done || t.t >= t.dur + 0.05) {
      G.scene.remove(t.g);
      t.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      tels.splice(i, 1);
    }
  }
  for (const p of parts) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; p.mesh.visible = false; continue; }
    p.vy -= p.grav * dt;
    p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt;
    p.mesh.scale.setScalar(p.size * (p.life / p.max));
    p.mesh.rotation.x += dt * 5; p.mesh.rotation.y += dt * 4;
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += dt;
    const k = r.t / r.dur;
    r.m.scale.setScalar(0.3 + k * r.r);
    r.m.material.opacity = 0.8 * (1 - k);
    if (k >= 1) { G.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(i, 1); }
  }
}

export function clearTelegraphs() { for (const t of tels) t.done = true; timers.length = 0; }

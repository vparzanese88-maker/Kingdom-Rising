// Goblin Island's wildlife in the air (the owner: a few birds here and there that land in the trees and perch, not a
// hundred circling the same way). Jungle parrots sit in the treetops, now and then flap off and glide to another tree;
// seagulls drift along the shore and settle on the sand or the wreck. Purely cosmetic and local.
import * as THREE from 'three';
import { G } from './state.js';
import { world } from './world.js';
import { heightAt } from './terrain.js';
import { loadGI } from './gimodels.js';
import { WRECK, CAMP_SPOT } from './gimap.js';

const R = (a, b) => a + Math.random() * (b - a);
const birds = [];
let treeH = 9; // a treetop's height above its base, for a tree of scale 1 (worked out from the trees' own shape)
// a flapping flyer drawn in code: body and two wings
function flyer(col, s) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 6), m); body.rotation.x = Math.PI / 2; g.add(body);
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.14, 0, 0, 0.16, 0.85, 0, 0.02], 3)); wg.computeVertexNormals();
  const wl = new THREE.Mesh(wg, m), wr = new THREE.Mesh(wg, m); wr.scale.x = -1; g.add(wl, wr); g.scale.setScalar(s); return { g, wl, wr };
}
const trees = () => world.nodes.filter(n => n.type && n.type.startsWith('tree') && n.alive);
const treeTop = (n) => new THREE.Vector3(n.x, n.y + treeH * n.s * 0.95, n.z);
const beachSpot = () => { for (let i = 0; i < 30; i++) { const x = CAMP_SPOT.x + R(-120, 120), z = CAMP_SPOT.z + R(10, 80), h = heightAt(x, z); if (h > 0.3 && h < 2.5) return new THREE.Vector3(x, h, z); } return new THREE.Vector3(WRECK.x, heightAt(WRECK.x, WRECK.z) + 8, WRECK.z); };
export function buildBirdsGI(scene, kinds) {
  if (kinds && kinds.oakA && kinds.oakA.geo) { kinds.oakA.geo.computeBoundingBox(); const b = kinds.oakA.geo.boundingBox; treeH = (b.max.y - b.min.y) || 9; }
  const T = trees(); if (!T.length) return;
  for (let i = 0; i < 9; i++) { const f = flyer(['#d02a20', '#2a5ad0', '#e8c020'][i % 3], 0.8), home = T[Math.floor(Math.random() * T.length)];
    const b = { kind: 'parrot', f, perch: null, at: treeTop(home), state: 'perch', t: R(4, 20), from: null, to: null, ft: 0, dur: 1 };
    scene.add(f.g); birds.push(b);
    loadGI('parrot').then(gl => { if (!gl) return; const o = gl.scene.clone(), k = 0.45 / gl.h; o.scale.setScalar(k); o.position.y = -gl.minY * k; const p = new THREE.Group(); p.add(o); scene.add(p); b.perch = p; }); }
  for (let i = 0; i < 4; i++) { const f = flyer('#f2f2f2', 1.1), b = { kind: 'gull', f, perch: null, at: beachSpot(), state: 'fly', t: 0, from: null, to: null, ft: 0, dur: 1 }; scene.add(f.g); birds.push(b); takeOff(b); }
}
function takeOff(b) {
  b.state = 'fly'; b.from = b.at.clone(); let to;
  if (b.kind === 'parrot') { const T = trees().filter(n => { const d = Math.hypot(n.x - b.at.x, n.z - b.at.z); return d > 30 && d < 140; }); const n = T[Math.floor(Math.random() * T.length)]; to = n ? treeTop(n) : b.at.clone(); }
  else to = Math.random() < 0.3 ? new THREE.Vector3(WRECK.x + R(-2, 2), heightAt(WRECK.x, WRECK.z) + 9.5, WRECK.z + R(-6, 6)) : beachSpot();
  b.to = to; b.ft = 0; b.dur = Math.max(4, b.from.distanceTo(to) / (b.kind === 'gull' ? 7 : 9)); b.peak = Math.max(b.from.y, to.y) + R(8, 18);
}
export function updateBirdsGI(dt) {
  const P = G.player, t = G.time || 0;
  for (const b of birds) {
    if (b.state === 'perch') {
      b.t -= dt; if (b.perch) { b.perch.visible = true; b.perch.position.copy(b.at); b.perch.rotation.y = Math.sin(t * 0.4 + b.at.x) * 0.6; } b.f.g.visible = !b.perch; b.f.g.position.copy(b.at);
      const scared = P && P.pos.distanceTo(b.at) < 9; // (they fly off when you come close)
      if (b.t <= 0 || scared) { if (b.perch) b.perch.visible = false; takeOff(b); }
      continue;
    }
    b.ft += dt / b.dur; const k = Math.min(1, b.ft), e = k * k * (3 - 2 * k);
    const x = b.from.x + (b.to.x - b.from.x) * e, z = b.from.z + (b.to.z - b.from.z) * e, base = b.from.y + (b.to.y - b.from.y) * e, y = base + (b.peak - base) * Math.sin(k * Math.PI) * (k < 0.85 ? 1 : (1 - k) / 0.15);
    const g = b.f.g, dx = x - g.position.x, dz = z - g.position.z; g.visible = true; g.position.set(x, Math.max(y, heightAt(x, z) + 1), z); if (Math.abs(dx) + Math.abs(dz) > 1e-4) g.rotation.y = Math.atan2(dx, dz);
    const flap = k < 0.25 || k > 0.85 ? 14 : (Math.sin(t * 0.7 + b.at.x) > 0.3 ? 9 : 0); const a = flap ? Math.sin(t * flap) * 0.7 : 0.08; b.f.wl.rotation.z = a; b.f.wr.rotation.z = -a; g.rotation.z = Math.sin(t * 0.8) * 0.15;
    if (k >= 1) { b.at = b.to.clone(); b.state = 'perch'; b.t = b.kind === 'gull' ? R(6, 16) : R(10, 40); }
  }
}

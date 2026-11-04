// Seabreak's defences, raised by the main quest: a palisade with four gates, then watchtowers at the gates.
import * as THREE from 'three';
import { G } from './state.js';
import { heightAt, VILLAGE } from './terrain.js';
import { addCircle } from './world.js';

const built = { walls: false, towers: false };
const R = 52;
const GATES = [-Math.PI / 2, 0.27, Math.PI - 0.27, Math.PI / 2 + 0.05]; // north road, the coast paths east and west, the pier
const inGate = (a) => GATES.some(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.09);
const wood = new THREE.MeshStandardMaterial({ color: '#7a5a36', roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: '#4a3420', roughness: 0.95 }), roof = new THREE.MeshStandardMaterial({ color: '#8a3a24', roughness: 0.85 });
export function buildDefenses(stage) {
  if (stage >= 1 && !built.walls) {
    built.walls = true;
    const N = Math.round(2 * Math.PI * R / 0.55), geo = new THREE.CylinderGeometry(0.2, 0.26, 3.4, 6); geo.translate(0, 1.7, 0);
    const tip = new THREE.ConeGeometry(0.22, 0.6, 6); tip.translate(0, 3.7, 0);
    const im = new THREE.InstancedMesh(geo, wood, N), it = new THREE.InstancedMesh(tip, dark, N), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    let k = 0;
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; if (inGate(a)) continue; const x = VILLAGE.x + Math.cos(a) * R, z = VILLAGE.z + Math.sin(a) * R, y = heightAt(x, z) - 0.3;
      sc.set(1, 0.9 + ((i * 7919) % 13) / 60, 1); q.setFromEuler(new THREE.Euler(0, a, 0)); m.compose(new THREE.Vector3(x, y, z), q, sc); im.setMatrixAt(k, m); it.setMatrixAt(k, m); k++;
      if (i % 2 === 0) addCircle(x, z, 0.45, 'wall'); }
    im.count = it.count = k; im.castShadow = true; G.scene.add(im, it);
    // cross beams on the inside
    for (let i = 0; i < 40; i++) { const a = (i + 0.5) / 40 * Math.PI * 2; if (inGate(a) || inGate(a + 0.06) || inGate(a - 0.06)) continue; const x = VILLAGE.x + Math.cos(a) * (R - 0.35), z = VILLAGE.z + Math.sin(a) * (R - 0.35);
      const b = new THREE.Mesh(new THREE.BoxGeometry(2 * Math.PI * R / 40, 0.18, 0.14), dark); b.position.set(x, heightAt(x, z) + 1.8, z); b.rotation.y = -a + Math.PI / 2; G.scene.add(b); }
    // gate posts
    for (const g of GATES) for (const s of [-1, 1]) { const a = g + s * 0.095, x = VILLAGE.x + Math.cos(a) * R, z = VILLAGE.z + Math.sin(a) * R; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 4.6, 8), dark); p.position.set(x, heightAt(x, z) + 2, z); p.castShadow = true; G.scene.add(p); addCircle(x, z, 0.5, 'wall'); }
  }
  if (stage >= 2 && !built.towers) {
    built.towers = true;
    for (const g of [GATES[0], GATES[3]]) for (const s of [-1, 1]) { const a = g + s * 0.15, x = VILLAGE.x + Math.cos(a) * (R - 1.5), z = VILLAGE.z + Math.sin(a) * (R - 1.5), y = heightAt(x, z);
      const t = new THREE.Group(); for (const dx of [-1, 1]) for (const dz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 6.5, 6), wood); l.position.set(dx * 1.2, 3.25, dz * 1.2); l.castShadow = true; t.add(l); }
      const fl = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 3.2), dark); fl.position.y = 6.2; t.add(fl);
      for (const r of [0, 1, 2, 3]) { const w = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 0.12), wood); w.position.set(0, 6.8, 1.55); const gr = new THREE.Group(); gr.rotation.y = r * Math.PI / 2; gr.add(w); t.add(gr); }
      const rf = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.8, 4), roof); rf.position.y = 8.6; rf.rotation.y = Math.PI / 4; rf.castShadow = true; t.add(rf);
      t.position.set(x, y, z); G.scene.add(t); addCircle(x, z, 1.8, 'wall'); }
  }
}
export function defensesFor(h) { const d = h.quests.done; return d.includes('mq_towers') ? 2 : d.includes('mq_walls') ? 1 : 0; }

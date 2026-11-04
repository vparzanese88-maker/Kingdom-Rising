// Seabreak's defences, raised by the main quest: a palisade with four gates, then watchtowers at the gates.
import * as THREE from 'three';
import { G } from './state.js';
import { heightAt, VILLAGE } from './terrain.js';
import { addCircle } from './world.js';

const built = {};
const R = 52;
const GATES = [-Math.PI / 2, 0.27, Math.PI - 0.27, Math.PI / 2 + 0.05]; // north road, the coast paths east and west, the pier
const inGate = (a) => GATES.some(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.09);
const wood = new THREE.MeshStandardMaterial({ color: '#7a5a36', roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: '#4a3420', roughness: 0.95 }), roof = new THREE.MeshStandardMaterial({ color: '#8a3a24', roughness: 0.85 });
function buildWalls() {
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
function buildTowers() {
    for (const g of [GATES[0], GATES[3]]) for (const s of [-1, 1]) { const a = g + s * 0.15, x = VILLAGE.x + Math.cos(a) * (R - 1.5), z = VILLAGE.z + Math.sin(a) * (R - 1.5), y = heightAt(x, z);
      const t = new THREE.Group(); for (const dx of [-1, 1]) for (const dz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 6.5, 6), wood); l.position.set(dx * 1.2, 3.25, dz * 1.2); l.castShadow = true; t.add(l); }
      const fl = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 3.2), dark); fl.position.y = 6.2; t.add(fl);
      for (const r of [0, 1, 2, 3]) { const w = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 0.12), wood); w.position.set(0, 6.8, 1.55); const gr = new THREE.Group(); gr.rotation.y = r * Math.PI / 2; gr.add(w); t.add(gr); }
      const rf = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.8, 4), roof); rf.position.y = 8.6; rf.rotation.y = Math.PI / 4; rf.castShadow = true; t.add(rf);
      t.position.set(x, y, z); G.scene.add(t); addCircle(x, z, 1.8, 'wall'); }
}

const stoneM = new THREE.MeshStandardMaterial({ color: '#8a847a', roughness: 0.95 }), canvas = new THREE.MeshStandardMaterial({ color: '#c8b890', roughness: 0.9, side: THREE.DoubleSide }), ironM = new THREE.MeshStandardMaterial({ color: '#3a3a3e', roughness: 0.5, metalness: 0.6 });
const box = (w, h, d, m, x, y, z, g, ry = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; g.add(o); return o; };
const place = (g, x, z, ry) => { g.position.set(x, heightAt(x, z), z); g.rotation.y = ry; G.scene.add(g); };
// stage 2: an armoury, with shields on the walls, weapon racks and training dummies
function buildArmoury() {
  const x = -36, z = 330, g = new THREE.Group();
  box(9, 4, 6, wood, 0, 2, 0, g); const r = new THREE.Mesh(new THREE.ConeGeometry(6.3, 2.6, 4), roof); r.position.y = 5.3; r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.7); r.castShadow = true; g.add(r);
  for (let i = 0; i < 4; i++) { const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 10), i % 2 ? roof : ironM); sh.rotation.x = Math.PI / 2; sh.position.set(-3 + i * 2, 2.6, 3.06); g.add(sh); }
  box(1.6, 2.6, 0.12, dark, 0, 1.3, 3.05, g);
  for (let k = 0; k < 2; k++) { const rack = new THREE.Group(); box(2.4, 0.12, 0.3, dark, 0, 1.6, 0, rack); for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 4), wood); sp.position.set(-1 + i * 0.5, 1.3, 0); rack.add(sp); } rack.position.set(-5.5, 0, -1 + k * 2.4); rack.rotation.y = Math.PI / 2; g.add(rack); }
  place(g, x, z, 0.6); addCircle(x, z, 5, 'wall');
  for (let i = 0; i < 3; i++) { const d = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 6), wood); p.position.y = 0.9; d.add(p); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.9, 8), canvas); b.position.y = 1.5; d.add(b); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), canvas); hd.position.y = 2.15; d.add(hd); box(1.2, 0.1, 0.1, wood, 0, 1.6, 0, d); place(d, -28 + i * 2.6, 318, 0); addCircle(-28 + i * 2.6, 318, 0.4); }
}
// stage 4: barracks tents and a bunkhouse for the new guards
function buildBarracks() {
  const g = new THREE.Group(); box(10, 3.2, 5, wood, 0, 1.6, 0, g); const r = new THREE.Mesh(new THREE.ConeGeometry(6.6, 2.2, 4), dark); r.position.y = 4.3; r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.55); g.add(r); place(g, 33, 330, -0.5); addCircle(33, 330, 5, 'wall');
  for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.4, 4, 1, true), canvas); const tg = new THREE.Group(); t.position.y = 1.2; t.rotation.y = Math.PI / 4; tg.add(t); place(tg, 22 + i * 4, 318 + (i % 2) * 2, 0); addCircle(22 + i * 4, 318 + (i % 2) * 2, 1.4); }
  G.hooks.moreGuards && G.hooks.moreGuards(4);
}
// stage 5: the siege yard: catapults and powder barrels, every one of them pointed north
function buildSiegeYard() {
  for (const [x, z] of [[-17, 323], [17, 323]]) {
    const g = new THREE.Group(); for (const s of [-1, 1]) { box(0.3, 0.3, 4.6, wood, s * 1.1, 0.6, 0, g); for (const zz of [-1.6, 1.6]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.2, 12), dark); w.rotation.z = Math.PI / 2; w.position.set(s * 1.3, 0.55, zz); g.add(w); } }
    for (const s of [-1, 1]) { const up = box(0.25, 2.4, 0.25, wood, s * 0.9, 1.8, 0.3, g); up.rotation.x = -0.25; }
    const arm = box(0.22, 0.22, 5, wood, 0, 2.6, -0.4, g); arm.rotation.x = 0.55; const cup = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), dark); cup.rotation.x = Math.PI; cup.position.set(0, 4.0, -2.4); g.add(cup);
    place(g, x, z, Math.PI); addCircle(x, z, 2.2);
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.33, 0.9, 10), dark); b.position.set(x + 3.2 + (i % 3) * 0.8, heightAt(x + 3, z) + 0.45 + Math.floor(i / 3) * 0.9, z + 1.5); G.scene.add(b); }
    for (let i = 0; i < 5; i++) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), stoneM); st.position.set(x - 3 + (i % 3) * 0.7, heightAt(x - 3, z) + 0.35, z + 1 + Math.floor(i / 3) * 0.7); G.scene.add(st); }
  }
}
const STAGES = [null, buildWalls, buildArmoury, buildTowers, buildBarracks, buildSiegeYard];
const SITES = [null, [[0, 310], [50, 376], [-50, 376], [-4, 414]], [[-36, 330]], [[-8, 310], [8, 310]], [[33, 330]], [[-17, 323], [17, 323]]];
export function buildDefenses(stage) { for (let k = 1; k <= stage && k < STAGES.length; k++) if (!built[k]) { built[k] = true; STAGES[k](); } }
export function defensesFor(h) { const d = h.quests.done; return d.includes('mq_people') ? 5 : d.includes('mq_gold') ? 4 : d.includes('mq_towers') ? 3 : d.includes('mq_hides') ? 2 : d.includes('mq_walls') ? 1 : 0; }
// construction: scaffolding and dust at the site for a while, then it is built
let work = null;
export function startConstruction(stage, onDone) {
  if (built[stage]) return;
  const sc = new THREE.Group(); for (const [x, z] of SITES[stage] || []) for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2, px = x + Math.cos(a) * 2.5, pz = z + Math.sin(a) * 2.5; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 5), wood); p.position.set(px, heightAt(px, pz) + 2.5, pz); sc.add(p); const pl = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 0.6), dark); pl.position.set(x, heightAt(x, z) + 1.5 + k * 0.9, z + (k % 2 ? 2.4 : -2.4)); sc.add(pl); }
  G.scene.add(sc); work = { stage, t: 0, dur: 15, sc, onDone, beat: 0 };
}
export function updateConstruction(dt, V, S) {
  if (!work) return; const w = work; w.t += dt; w.beat -= dt;
  if (w.beat <= 0) { w.beat = 0.45 + Math.random() * 0.3; for (const [x, z] of SITES[w.stage] || []) { V.burst('dust', new THREE.Vector3(x + (Math.random() - 0.5) * 4, heightAt(x, z) + 0.5, z + (Math.random() - 0.5) * 4), 6, { speed: 1.5, size: 0.6 }); if (Math.random() < 0.6) S.hit(Math.random() < 0.5 ? 'wood' : 'stone', new THREE.Vector3(x, heightAt(x, z) + 1, z), 0.7); } }
  if (w.t >= w.dur) { G.scene.remove(w.sc); work = null; built[w.stage] = true; STAGES[w.stage](); w.onDone && w.onDone(w.stage); }
}

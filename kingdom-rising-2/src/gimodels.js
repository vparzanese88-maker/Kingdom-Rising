// Goblin Island's Meshy models (models/gi/*.glb): goblins, trolls, villagers and animals with their own animations,
// camp props, trees and rocks. Everything loads in the background and swaps in as it arrives, so the world builds at
// once and the old stand-in shapes are replaced a moment later.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';

const L = new GLTFLoader(), cache = {};
export function loadGI(name) {
  return cache[name] || (cache[name] = L.loadAsync(`models/gi/${name}.glb`).then(g => {
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = !o.isSkinnedMesh; } });
    g.scene.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g.scene, true); g.h = b.max.y - b.min.y || 1; g.minY = b.min.y; g.box = b; cache[name].done = g; return g;
  }).catch(e => { console.warn('model', name, e && e.message); return null; }));
}
// a static prop standing on the ground at (x, y, z), so tall
export function propAt(name, x, y, z, rot, height, parent) {
  return loadGI(name).then(g => { if (!g) return null; const o = g.scene.clone(); const k = height / g.h; o.scale.setScalar(k); o.position.set(x, y - g.minY * k, z); o.rotation.y = rot || 0; (parent || G.scene).add(o); return o; });
}
// ---- animated characters ----
const PICK = { idle: /idle/i, walk: /walk/i, run: /run/i, hit: /hit/i, die: /dying|death/i, talk: /talk/i, cheer: /cheer/i, chop: /axe_chop/i, hammer: /hammer/i, carry: /carry/i };
const ATTACK = /attack|combo|hammer|chop|spin|throw/i;
function rigOf(g, targetH) {
  const o = SkeletonUtils.clone(g.scene), mixer = new THREE.AnimationMixer(o), acts = {}, attacks = [];
  for (const clip of g.animations) { const a = mixer.clipAction(clip); for (const k in PICK) if (!acts[k] && PICK[k].test(clip.name)) acts[k] = a; if (ATTACK.test(clip.name) && !/carry|walk/i.test(clip.name)) attacks.push(a); }
  const k = targetH / g.h; o.scale.setScalar(k); o.position.y = -g.minY * k;
  return { o, mixer, acts, attacks, cur: null, cura: null };
}
function play(Z, key, once, fade = 0.18, pickAttack) {
  let a = pickAttack ? Z.attacks[Math.floor(Math.random() * Z.attacks.length)] : Z.acts[key]; if (!a) a = Z.acts.idle; if (!a) return null;
  if (Z.cura === a && !once) return a;
  a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!once; a.enabled = true; a.setEffectiveWeight(1); a.play();
  if (Z.cura && Z.cura !== a) Z.cura.crossFadeTo(a, fade, false);
  Z.cura = a; Z.cur = key; return a;
}
// (an enemy) the old body is hidden and the Meshy one takes its place under the same root, scaled to the same height
const MOB_MODEL = { goblin: 'goblin_raider', goblin_slinger: 'goblin_slinger', goblin_brute: 'goblin_brute', troll: 'troll', troll_king: 'troll', goblin_chief: 'goblin_warlord' };
// (bodies are put on only near you and taken off far away, so a few dozen are animated at a time, not hundreds)
const wanting = [];
export function dressMob(m) { const name = MOB_MODEL[m.type]; if (!name) return; m.mzName = name; wanting.push(m); loadGI(name); }
function putOn(m) { const g = cache[m.mzName] && cache[m.mzName].done; if (!g || !m.root) return false; const sc = m.root.scale.y || 1, Z = rigOf(g, (m.height || 1.5) / sc);
  for (const c of m.root.children) c.visible = false; m.root.add(Z.o); m.mz = Z; play(Z, m.dead ? 'die' : 'idle'); if (m.dead && Z.cura) Z.cura.time = Z.cura.getClip().duration; if (m.type === 'troll_king') Z.o.scale.multiplyScalar(1.12); return true; }
function takeOff(m) { const Z = m.mz; if (!Z) return; Z.mixer.stopAllAction(); Z.mixer.uncacheRoot(Z.o); m.root.remove(Z.o); for (const c of m.root.children) c.visible = true; m.mz = null; }
export function tickDress() {
  const P = G.player; if (!P) return; let n = 0;
  for (const m of wanting) { const d2 = m.pos.distanceToSquared(P.pos);
    if (!m.mz && d2 < 75 * 75 && n < 8) { if (putOn(m)) n++; } else if (m.mz && d2 > 110 * 110) takeOff(m); }
}
// mobs.js calls this instead of its own animation when a Meshy body is on
export function animMob(m, dt, st) {
  const Z = m.mz, P = G.player; if (P && m.pos.distanceToSquared(P.pos) > 90 * 90) return; // (far away: frozen, saves the frame)
  if (st.dead) { if (Z.cur !== 'die') play(Z, 'die', true, 0.12); }
  else if (st.action && st.action !== 'charge') { const fresh = Z.cur !== 'attack' || Z.prevAct !== st.action || (st.actionT || 0) < (Z.prevT || 0) - 0.05; Z.prevAct = st.action; Z.prevT = st.actionT || 0; if (fresh) { const a = play(Z, 'attack', true, 0.1, true); if (a) a.timeScale = Math.max(0.8, Math.min(3, a.getClip().duration / Math.max(0.4, m.actionDur || 0.9))); } }
  else if (m.hitFlash > 0.15 && Z.cur !== 'hit' && Z.acts.hit && (Z.hitCd || 0) <= 0) { Z.hitCd = 1.2; const a = play(Z, 'hit', true, 0.08); if (a) a.timeScale = 2; }
  else if (Z.cur === 'hit' && Z.cura && Z.cura.isRunning()) { /* finishing the flinch */ }
  else { const sp = st.speed || 0; if (sp > 3.4) { const a = play(Z, 'run'); if (a) a.timeScale = Math.min(1.6, sp / 5); } else if (sp > 0.3) { const a = play(Z, 'walk'); if (a) a.timeScale = Math.min(2.2, sp / 1.1); } else play(Z, 'idle'); }
  Z.hitCd = (Z.hitCd || 0) - dt; Z.mixer.update(dt);
}
// (a friendly goblin) villager or elder: idles, walks, talks when you're near; workers chop, hammer and carry
export function dressPerson(p, name, height) {
  loadGI(name).then(g => { if (!g || !p.root) return; const Z = rigOf(g, height / (p.root.scale.y || 1)); for (const c of p.root.children) c.visible = false; p.root.add(Z.o); p.mz = Z; play(Z, 'idle'); });
}
export function animPerson(p, dt, state) { const Z = p.mz, P = G.player; if (P && p.pos.distanceToSquared(P.pos) > 80 * 80) return; play(Z, state || 'idle'); Z.mixer.update(dt); }
// ---- animals moved in code (no rig needed): bob, sway and lunge ----
export function dressBeast(m, name, length) {
  loadGI(name).then(g => { if (!g || !m.root) return; const o = g.scene.clone(), sz = g.box.getSize(new THREE.Vector3()), k = length / Math.max(sz.x, sz.z) / (m.root.scale.y || 1);
    o.scale.setScalar(k); o.position.y = -g.minY * k; const pivot = new THREE.Group(); pivot.add(o); for (const c of m.root.children) c.visible = false; m.root.add(pivot); m.beast = { pivot, t: Math.random() * 9 }; });
}
export function animBeast(m, dt, st) {
  const B = m.beast, sp = st.speed || 0; B.t += dt * (2 + sp * 1.6);
  if (st.dead) { B.pivot.rotation.z += (Math.PI / 2 - B.pivot.rotation.z) * Math.min(1, dt * 6); return; }
  B.pivot.position.y = sp > 0.3 ? Math.abs(Math.sin(B.t)) * 0.06 * Math.min(1, sp / 3) : Math.sin(B.t * 0.4) * 0.01;
  B.pivot.rotation.x = st.action ? -Math.sin(Math.min(1, st.actionT || 0) * Math.PI) * 0.35 : Math.sin(B.t) * 0.03 * Math.min(1, sp);
  B.pivot.rotation.z = Math.sin(B.t * 0.5) * 0.02;
}
// ---- trees, rocks and bushes: the island's instanced scenery takes the Meshy shapes ----
// (near you only: world.js cullChunks swaps each chunk between these and the old light shapes by distance)
const KIND_MODEL = { oakA: 'tree_jungle_lo', oakB: 'tree_jungle_lo', birch: 'tree_jungle_lo', palm: 'tree_palm_lo', rock0: 'rock_cluster_lo', rock1: 'rock_cluster_lo', rock2: 'cliff_rock_lo' };
export function swapScenery(kinds) {
  for (const [kind, name] of Object.entries(KIND_MODEL)) { const K = kinds[kind]; if (!K) continue;
    loadGI(name).then(g => { if (!g) return; const geos = [], mats = []; g.scene.updateMatrixWorld(true);
      g.scene.traverse(o => { if (o.isMesh) { const gg = o.geometry.clone(); gg.applyMatrix4(o.matrixWorld); for (const a of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(a)) gg.deleteAttribute(a); geos.push(gg); mats.push(o.material); } });
      if (!geos.length) return; const geo = geos.length > 1 ? mergeGeometries(geos, false) : geos[0]; if (!geo) return;
      K.geo.computeBoundingBox(); geo.computeBoundingBox(); const ob = K.geo.boundingBox, nb = geo.boundingBox, k = (ob.max.y - ob.min.y) / Math.max(1e-4, nb.max.y - nb.min.y) * (kind.startsWith('rock') ? 1.1 : 1.15);
      const c = nb.getCenter(new THREE.Vector3()); geo.translate(-c.x, -nb.min.y, -c.z); geo.scale(k, k, k); geo.translate(0, ob.min.y, 0); geo.computeBoundingSphere();
      const mat = mats[0].clone(); mat.side = THREE.DoubleSide; if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      K.hi = { geo, mat }; K.lo = { geo: K.geo, mat: K.mat }; });
  }
}

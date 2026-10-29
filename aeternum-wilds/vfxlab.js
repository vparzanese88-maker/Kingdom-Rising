// VFX test bench (not part of the game): a small sunny meadow, a player with a weapon, a few enemies,
// the same renderer / tone mapping / bloom as the game, and a deterministic stepper for screenshots.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { G } from './src/state.js';
import { heightAt } from './src/world.js';
import { makeHumanoid, makeBeast, makeWeapon } from './src/models.js';
import { animHumanoid, animBeast } from './src/anim.js';
import { updateFx, shakeOffset } from './src/fx.js';
import { updateSpellFx } from './src/spellfx.js';
import * as C from './src/combatfx.js';
import * as S from './src/spellfx.js';
import * as F from './src/fx.js';
import { initAudio, sfx } from './src/audio.js';
import { WEAPONS, ENEMIES } from './src/data.js';

const CX = 12, CZ = 62;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
document.getElementById('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const fogCol = new THREE.Color(0xbfd8e8); scene.fog = new THREE.Fog(fogCol, 70, 330); scene.background = fogCol;
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.08, 1300); camera.rotation.order = 'YXZ';
Object.assign(G, { scene, camera, renderer, mode: 'game', paused: false, time: 0, night: 0, quality: 'medium', Q: { view: 1 }, light: { hemi: 1.15, sun: 2.1, sunColor: new THREE.Color(0xfff0d8) } });
window.G = G;
scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a4a32, 1.15));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.1); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 200 });
sun.position.set(CX + 50, 80, CZ + 30); sun.target.position.set(CX, 0, CZ); scene.add(sun); scene.add(sun.target);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.55, 0.8));
composer.addPass(new OutputPass());

// terrain patch
{
  const g = new THREE.PlaneGeometry(90, 90, 90, 90); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + CX, z = p.getZ(i) + CZ; p.setY(i, heightAt(x, z));
    const n = Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.5 + Math.random() * 0.5;
    const c = new THREE.Color(0x5a9a3a).lerp(new THREE.Color(0x8ab84a), n); col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); m.position.set(CX, 0, CZ); m.receiveShadow = true; scene.add(m);
  // a few rocks and trees-ish blobs for depth
  for (let i = 0; i < 18; i++) {
    const x = CX + (Math.random() - 0.5) * 70, z = CZ + (Math.random() - 0.5) * 70;
    const t = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + Math.random() * 2, 0), new THREE.MeshStandardMaterial({ color: 0x3a7a2a, flatShading: true }));
    t.position.set(x, heightAt(x, z) + 3, z); t.castShadow = true; scene.add(t);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 3, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a22 })); tr.position.set(x, heightAt(x, z) + 1.5, z); scene.add(tr);
  }
}

// player
const PX = CX, PZ = CZ - 4;
const h = makeHumanoid({ skin: 0xe0ac84, hair: 0x5a3a1e, shirt: 0x7a6a52, pants: 0x4a3e30 });
scene.add(h.root);
const P = { h, pos: { x: PX, z: PZ }, y: heightAt(PX, PZ), yaw: 0, facing: 0, pitch: -0.2, state: 'idle', atk: null, buffs: [], move: 0, phase: 0, wR: null, wL: null };
G.player = P;
G.p = { equip: { w1: { wtype: 'sword' } }, activeW: 0, level: 5 };
function setWeapon(wt) {
  for (const k of ['wR', 'wL']) if (P[k]) { P[k].parent?.remove(P[k]); P[k] = null; }
  G.p.equip.w1 = { wtype: wt };
  P.wR = makeWeapon(wt, 2); P.wR.scale.setScalar(wt === 'staff' ? 1.1 : 1.45); h.parts.handR.add(P.wR);
  if (wt === 'sword') { P.wL = makeWeapon('shield', 2); P.wL.scale.setScalar(1.25); P.wL.position.set(0.14, 0.05, 0.15); P.wL.rotation.y = Math.PI / 2; h.parts.handL.add(P.wL); }
}
setWeapon('sword');

// enemies: a wolf, a Lost sailor, a corrupted soldier in a row in front
const foes = [];
function addFoe(type, x, z) {
  const def = ENEMIES[type];
  const model = def.model === 'humanoid' ? makeHumanoid({ skin: def.skin, shirt: def.shirt, pants: def.pants, eyes: def.eyes, size: def.size, hunched: def.hunched }) : makeBeast('wolf', { color: def.color, size: def.size, eyes: def.eyes });
  if (def.weapon) { const w = makeWeapon(def.weapon); model.parts.handR.add(w); }
  scene.add(model.root);
  const e = { type, def, model, pos: { x, z }, y: heightAt(x, z), size: def.size, radius: 0.5 * def.size, hp: 100, maxHp: 100, facing: Math.PI };
  model.root.position.set(x, e.y, z); model.root.rotation.y = Math.atan2(PX - x, PZ - z);
  foes.push(e); return e;
}
addFoe('wolf', PX, PZ + 3); addFoe('lost', PX - 3.5, PZ + 4.5); addFoe('corrupted', PX + 3.5, PZ + 4.5);
G.enemies = foes;
window.foes = foes;

// swing driver: like player.js startAttack + update
function attack(kind, pose) {
  const wt = G.p.equip.w1.wtype, W = WEAPONS[wt], spec = kind === 'light' ? W.light : W.heavy;
  pose = pose || (kind === 'light' ? 'slash' : spec.kind === 'spin' ? 'spin' : spec.kind === 'slam' ? 'slam' : 'thrust');
  if (wt === 'staff') pose = kind === 'heavy' ? 'cast' : 'thrust';
  P.state = 'attack'; P.atk = { kind, spec, pose, mult: 1, t: 0, dur: spec.time, hitDone: false, wt };
  C.swingFx(P, P.atk);
}
let camDist = 3.6;
function frame(dt) {
  // hit-stop as in main.js
  let sdt = dt; if (G.hitstop > 0) { G.hitstop -= dt; sdt = dt * 0.08; }
  G.time += sdt;
  if (P.state === 'attack') {
    const a = P.atk; a.t += sdt;
    if (!a.hitDone && a.t >= a.dur * a.spec.hit) {
      a.hitDone = true; C.swingPeakFx(P, a);
      const tgt = window.target || foes[0];
      if (a.wt !== 'staff' && Math.hypot(tgt.pos.x - P.pos.x, tgt.pos.z - P.pos.z) < 5) C.hitFx(tgt, 30, !!window.crit, a.kind, { x: P.pos.x, y: P.y + 1.3, z: P.pos.z });
    }
    if (a.t >= a.dur) { P.state = 'idle'; P.atk = null; }
  }
  if (P.state === 'dodge') { P.dodge.t += sdt; P.pos.x += P.dodge.dx * 7 * sdt; P.pos.z += P.dodge.dz * 7 * sdt; if (P.dodge.t >= P.dodge.dur) { P.state = 'idle'; P.dodge = null; } }
  let pose = null, t = 0;
  if (P.state === 'attack') { pose = P.atk.pose; t = P.atk.t / P.atk.dur; }
  else if (P.state === 'dodge') { pose = P.dodge.roll ? 'dodge' : 'hop'; t = P.dodge.t / P.dodge.dur; }
  else if (P.blocking) pose = 'block';
  animHumanoid(h, { move: 0, phase: 0, pose, t, twoHand: ['greataxe', 'hammer'].includes(G.p.equip.w1.wtype) });
  P.y = heightAt(P.pos.x, P.pos.z); P.facing = P.yaw;
  h.root.position.set(P.pos.x, P.y, P.pos.z); h.root.rotation.y = P.facing;
  for (const e of foes) { if (e.model.beast) animBeast(e.model, { move: 0, phase: 0 }); else animHumanoid(e.model, { move: 0, phase: 0 }); }
  updateFx(sdt); updateSpellFx(sdt);
  // camera (third person, right shoulder) with shake
  const [shx, shy] = shakeOffset(dt);
  const fx = Math.sin(P.yaw) * Math.cos(P.pitch), fy = Math.sin(P.pitch), fz = Math.cos(P.yaw) * Math.cos(P.pitch);
  const rx = -Math.cos(P.yaw), rz = Math.sin(P.yaw);
  camera.position.set(P.pos.x - fx * camDist + rx * 0.95 + shx * 0.3, P.y + 1.8 - fy * camDist + 0.15 + shy * 0.3, P.pos.z - fz * camDist + rz * 0.95);
  camera.rotation.set(P.pitch, P.yaw + Math.PI, 0);
  camera.updateMatrixWorld();
  C.tickCombatFx(dt, true);
  composer.render();
}
// deterministic stepping for screenshots; the RAF loop runs only when `live`
window.step = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) frame(dt); };
window.live = false;
const loop = () => { requestAnimationFrame(loop); if (window.live) frame(1 / 60); };
loop();
Object.assign(window, { THREE, C, S, F, P, attack, setWeapon, addFoe, heightAt, sfx, initAudio, setCam: (d, pitch) => { camDist = d; if (pitch != null) P.pitch = pitch; } });
window.ready = true;
frame(1 / 60);

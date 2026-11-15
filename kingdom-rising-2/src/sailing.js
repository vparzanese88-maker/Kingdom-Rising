// Goblos: your own ship (the owner: the big ship model). She is tied up at a long dock on the wash-up beach; walk up the gangway and
// press E at the helm (or E beside her from the dock) to take the wheel, sail her about (W/S sail forward and back, A/D steer, the
// mouse swings the camera round), and press E near any shore to step off.
// Out to the south lies Driftwood Key, a small palm island with a castaway's camp and an old sea chest worth the trip.
// The ship stays where you leave it (it is kept in the save); the dock bell and a conch on the Key call it back if it is lost.
import * as THREE from 'three';
import { G } from './state.js';
import { heightAt, SEA } from './terrain.js';
import { WASH } from './gimap.js';
import { DRIFT, driftHeight, driftInland } from './driftkey.js';
import { world, addSurface, addCircle, addBox, groundAt } from './world.js';
import { loadGI, propAt } from './gimodels.js';
import { buildGull, flap } from './sailintro.js';
import { S, A } from './audio.js';
import { V } from './vfx.js';
import { settings } from './saves.js';
import { mulberry32, smooth, clamp, fbm } from './util.js';
import * as UI from './ui.js';
import * as Game from './game.js';

// ---- the dock: out from the wash-up beach, away from the raft ----
const DOCK_A = 1.0, DOCK_S0 = 14, DOCK_S1 = 116, DOCK_Y = 1.6, DOCK_HW = 1.3;
const dfw = { x: Math.sin(DOCK_A), z: Math.cos(DOCK_A) }, drt = { x: Math.cos(DOCK_A), z: -Math.sin(DOCK_A) }; // along the dock, and across it (to its left, looking out to sea)
const dockAt = (s, side = 0) => ({ x: WASH.x + dfw.x * s + drt.x * side, z: WASH.z + dfw.z * s + drt.z * side });
const HOME = (() => { const p = dockAt(79, 6.8); return { x: p.x, z: p.z, yaw: DOCK_A }; })(); // moored alongside the outer half of the dock in deep water (5 m and more), bow out to sea
let BOAT_L = 66; const DRAFT = 2.7, SHALLOW = -3.4, MAXF = 13, MAXB = 2.5, LIMIT = 1600; // (a 66 m ship: her keel sits 2.7 m down, so she grounds where the sea is shallower than 1.5 m)
const W = (x, z, t) => Math.sin(x * 0.08 + t * 1.1) * 0.18 + Math.sin(z * 0.11 + t * 0.9) * 0.14 + Math.sin((x + z) * 0.21 + t * 1.7) * 0.06; // (the sea shader's own swell)

const B = { on: false, mode: 'idle', root: null, hull: null, oars: [], x: HOME.x, z: HOME.z, yaw: HOME.yaw, spd: 0, turn: 0, y: 0, pitch: 0, roll: 0,
  cy: 0, cp: 0.3, cd: 80, lookT: 0, t: 0, from: null, to: null, camFrom: null, camQ: null, prevCam: 0, fogK: 0, ph: [0, 0], dims: { w: 9.6, h: 7.7 }, helm: new THREE.Vector3(2.4, 7.7, -19.5), deckY: 7.7, surfs: [],
  land: null, landT: 0, tgt: null, bumpT: 0, farT: 0, hud: null, keyLand: null, keyMoor: null, refs: {}, seenKey: false };
let scene = null, camera = null, water = null;
const FOAM0 = new THREE.Color('#ffffff'), FOAM1 = new THREE.Color('#cfe6ee'), GOLD0 = new THREE.Color('#fff4b0'), GOLD1 = new THREE.Color('#ffc030');
const mat = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.9 }, o));
const MT = { plank: mat('#8a6a46'), plank2: mat('#7a5c3c'), beam: mat('#4e3826'), rope: mat('#c8b48a'), iron: mat('#3a3734', { metalness: 0.4, roughness: 0.55 }), oar: mat('#9a7a50'),
  chest: mat('#6a4424'), chestIn: mat('#6a4424', { side: THREE.DoubleSide }), gold: mat('#ffcc40', { metalness: 0.6, roughness: 0.35, emissive: '#5a3a00' }), lamp: mat('#ffcf80', { emissive: '#ffb050', emissiveIntensity: 0.4 }), sign: mat('#c9a878'), stone: mat('#8a8680') };
function box(w, h, d, m, x, y, z, g, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; }
function cyl(r0, r1, h, m, x, y, z, g, seg = 8) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; }
const use = (x, z, label, fn) => { const u = { x, z, label, use: fn }; (world.giUse || (world.giUse = [])).push(u); return u; };
const near = (p, x, z, r) => Math.hypot(p.pos.x - x, p.pos.z - z) < r;
export const sailing = () => B.mode !== 'idle';

// ---------- building ----------
export function initSailing(o) {
  scene = o.scene; camera = o.camera; water = o.water;
  widenSeaMap();
  buildDock(); buildKey(); buildBoatRig();
  G.offGrid = (pos) => { const dx = pos.x - DRIFT.x, dz = pos.z - DRIFT.z, d = Math.hypot(dx, dz), R = DRIFT.r + 70; if (d > R + 60) return false; if (d > R) { pos.x = DRIFT.x + dx / d * R; pos.z = DRIFT.z + dz / d * R; } return true; }; // (on and around the Key there is no grid edge to stop at)
  G.fogOverride = (fog) => { const k = B.fogK; if (k <= 0.001) return; fog.near += (260 - fog.near) * k; fog.far += (1700 - fog.far) * k; }; // out at sea you can see the islands on the horizon
  // E beside the boat: climb in; at sea, near land: step ashore
  B.useBoard = use(HOME.x, HOME.z, () => { const p = G.player; if (!p || B.mode !== 'idle' || !B.root.visible) return null; const U = B.useBoard;
    if (p.onSurf && B.deckSurfs && B.deckSurfs.includes(p.onSurf)) { const hp = helmWorld(); U.x = hp.x; U.z = hp.z; return Math.hypot(p.pos.x - hp.x, p.pos.z - hp.z) < 3.4 ? 'Take the wheel' : null; } // (on deck: the helm)
    const c = boatClosest(p.pos), dx = p.pos.x - c.x, dz = p.pos.z - c.z, d = Math.hypot(dx, dz) || 1, hw = B.dims.w / 2; const r = Math.max(hw, d - 2.4); U.x = c.x + dx / d * r; U.z = c.z + dz / d * r; // (beside her, or wading out to her from a beach: a rope ladder over the side)
    return d - hw < 8 ? 'Climb aboard your ship' : null; }, () => board());
  B.useLand = use(0, 0, () => { const p = G.player; if (!p || B.mode !== 'sail') return null; B.useLand.x = p.pos.x; B.useLand.z = p.pos.z; return landSpot() ? 'Step ashore' : null; }, () => leave());
  // the dock bell and the Key's conch call the boat back when it is somewhere else
  { const b = dockAt(DOCK_S0 + 1.2, -DOCK_HW - 0.2); use(b.x, b.z, () => B.mode === 'idle' && Math.hypot(B.x - HOME.x, B.z - HOME.z) > 60 ? 'Ring the bell: call your ship back to the dock' : null, () => recall(HOME, 'The bell rings out over the water. A Snagglefoot crew sails your ship back to the dock.')); }
  if (B.keyLand) use(B.keyLand.x, B.keyLand.z, () => B.mode === 'idle' && Math.hypot(B.x - B.keyMoor.x, B.z - B.keyMoor.z) > 60 ? 'Blow the conch: call your ship to the Key' : null, () => recall(B.keyMoor, 'The conch moans across the sea... and your ship comes gliding round the point on the tide.'));
  const st = document.createElement('style'); st.textContent = `body.sailing #crosshair{display:none}
    #sailhud{position:absolute;left:50%;top:14px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;font-family:var(--f-b,inherit);text-shadow:0 1px 3px #000}
    #sailhud .sh-goal{background:rgba(14,20,28,.62);border:1px solid rgba(255,226,160,.35);border-radius:18px;padding:5px 14px;color:#ffe8b8;font-size:16px;display:flex;align-items:center;gap:8px}
    #sailhud .sh-arrow{display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;font-size:18px;color:#ffd060;transition:transform .12s linear}
    #sailhud .sh-keys{background:rgba(14,20,28,.5);border-radius:14px;padding:4px 12px;color:#e8e0cc;font-size:13px}
    #sailhud .sh-keys kbd{display:inline-block;min-width:18px;padding:0 5px;margin:0 2px;background:#f3e9d2;color:#1a1208;border-radius:4px;font-weight:800;text-align:center;font-size:12px}
    #sailhud .sh-spd{display:inline-block;width:64px;height:6px;border-radius:3px;background:rgba(255,255,255,.18);overflow:hidden;vertical-align:middle;margin-left:4px}
    #sailhud .sh-spd i{display:block;height:100%;background:linear-gradient(90deg,#7ad0ff,#ffe08a)}`;
  document.head.appendChild(st);
}
// the sea's height map reaches out over Driftwood Key too, so it gets turquoise shallows and surf like Goblos
function widenSeaMap() {
  const m = water && water.mats && water.mats[0]; if (!m || !m.uniforms || !m.uniforms.hmap || !m.uniforms.halfW) return;
  const N = 1024, H = 1300, data = new Uint16Array(N * N), toH = THREE.DataUtils.toHalfFloat;
  for (let j = 0; j < N; j++) { const z = -H + (j + 0.5) / N * H * 2; for (let i = 0; i < N; i++) data[j * N + i] = toH(heightAt(-H + (i + 0.5) / N * H * 2, z)); }
  const t = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.HalfFloatType); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  m.uniforms.hmap.value = t; m.uniforms.halfW.value = H;
}
function buildDock() {
  const g = new THREE.Group(), len = DOCK_S1 - DOCK_S0, c = dockAt((DOCK_S0 + DOCK_S1) / 2), rng = mulberry32(91);
  for (let i = 0; i < len / 0.5; i++) { const p = box(DOCK_HW * 2, 0.09, 0.44, rng() < 0.5 ? MT.plank : MT.plank2, (rng() - 0.5) * 0.06, -0.045, i * 0.5 - len / 2 + 0.25, g); p.rotation.z = (rng() - 0.5) * 0.025; p.rotation.y = (rng() - 0.5) * 0.02; }
  for (const sx of [-1, 1]) box(0.18, 0.22, len, MT.beam, sx * (DOCK_HW - 0.25), -0.2, 0, g);
  for (let i = 0; i <= len / 3.6; i++) for (const sx of [-1, 1]) { const zl = Math.min(len / 2 - 0.2, i * 3.6 - len / 2 + 0.2), wx = c.x + dfw.x * zl + drt.x * sx * DOCK_HW, wz = c.z + dfw.z * zl + drt.z * sx * DOCK_HW;
    const bot = Math.min(heightAt(wx, wz), SEA) - 1.2, top = i === 0 || zl > len / 2 - 4 ? 0.55 : -0.05, h = top - (bot - DOCK_Y); cyl(0.15, 0.17, h, MT.beam, sx * DOCK_HW, top - h / 2, zl, g, 7);
    if (top > 0) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 5, 12), MT.rope); r.rotation.x = Math.PI / 2; r.position.set(sx * DOCK_HW, 0.32, zl); g.add(r); } }
  // a lantern on the last post, a coil of rope, a crate and the bell that calls the boat home
  { const L = new THREE.Group(); cyl(0.06, 0.07, 1.9, MT.beam, 0, 0.95, 0, L, 6); box(0.55, 0.06, 0.06, MT.beam, 0.25, 1.85, 0, L); const lp = box(0.22, 0.3, 0.22, MT.lamp, 0.48, 1.62, 0, L); box(0.28, 0.05, 0.28, MT.iron, 0.48, 1.8, 0, L); B.lamp = lp;
    L.position.set(-DOCK_HW + 0.2, 0, len / 2 - 0.4); L.rotation.y = Math.PI; g.add(L); }
  { const r = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 16), MT.rope); r.rotation.x = Math.PI / 2; r.position.set(0.6, 0.06, len / 2 - 2.2); g.add(r); box(0.7, 0.7, 0.7, MT.plank2, -0.65, 0.35, len / 2 - 5, g, 0, 0.3); }
  { const Bl = new THREE.Group(); cyl(0.07, 0.08, 2.2, MT.beam, 0, 1.1, 0, Bl, 6); box(0.7, 0.07, 0.07, MT.beam, 0.3, 2.15, 0, Bl); const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.28, 10, 1, true), MT.gold); bell.material = MT.gold.clone(); bell.material.side = THREE.DoubleSide; bell.material.emissive.set('#201400'); bell.position.set(0.55, 1.95, 0); Bl.add(bell); B.bell = bell;
    Bl.position.set(-DOCK_HW - 0.2, 0, -len / 2 + 1.2); g.add(Bl); }
  // a signpost at the foot of the dock, pointing the way
  { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = '#b89464'; x.fillRect(0, 0, 256, 64); x.strokeStyle = '#6a4a2a'; x.lineWidth = 4; x.strokeRect(2, 2, 252, 60);
    x.fillStyle = '#3a2410'; x.font = 'bold 30px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Driftwood Key  →', 128, 34); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const S2 = new THREE.Group(); cyl(0.07, 0.08, 2.0, MT.beam, 0, 1.0, 0, S2, 6); const face = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.38, 0.06), [MT.sign, MT.sign, MT.sign, MT.sign, new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9 })]); face.position.set(0.55, 1.72, 0); face.castShadow = true; S2.add(face);
    const sp = dockAt(DOCK_S0 - 1.5, DOCK_HW + 1.0), toKey = Math.atan2(DRIFT.x - sp.x, DRIFT.z - sp.z); S2.position.set(sp.x, heightAt(sp.x, sp.z) - 0.05, sp.z); S2.rotation.y = toKey - Math.PI / 2; scene.add(S2); addCircle(sp.x, sp.z, 0.2); }
  g.position.set(c.x, DOCK_Y, c.z); g.rotation.y = DOCK_A; scene.add(g);
  addSurface(c.x, c.z, DOCK_HW, len / 2, DOCK_A, DOCK_Y);
  B.dockRope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 4), MT.rope); scene.add(B.dockRope);
}
// Driftwood Key: its own ground mesh (sand, grass and jungle floor, the same painted look as Goblos), palms, a castaway's camp and a chest
function keyMaterial() {
  const L = new THREE.TextureLoader(), tex = {};
  for (const n of ['grass', 'jungle', 'sand', 'rock']) { const t = L.load(`models/gi/tex/${n}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; tex[n] = t; }
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    for (const n in tex) sh.uniforms['t_' + n] = { value: tex[n] };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 splat; varying vec4 vSplat; varying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat; vWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D t_grass, t_jungle, t_sand, t_rock; varying vec4 vSplat; varying vec3 vWP;\nvec3 two(sampler2D t, vec2 p, float s) { return mix(texture2D(t, p / s).rgb, texture2D(t, p / (s * 3.3) + 0.37).rgb, 0.45); }')
      .replace('#include <map_fragment>', `vec2 P = vWP.xz; float sum = vSplat.x + vSplat.y + vSplat.z + vSplat.w + 1e-4;
        vec3 gr = two(t_grass, P, 9.0); gr = mix(gr, vec3(dot(gr, vec3(0.3, 0.59, 0.11))) * vec3(0.8, 1.0, 0.7), 0.18);
        diffuseColor.rgb *= (gr * vSplat.y + two(t_sand, P, 9.0) * vSplat.x + two(t_jungle, P, 8.0) * vSplat.z + two(t_rock, P, 16.0) * vSplat.w) / sum;`)
      .replace('#include <color_fragment>', '#if defined( USE_COLOR )\n diffuseColor.rgb *= 0.82 + 0.4 * clamp(dot(vColor, vec3(0.3, 0.59, 0.11)) * 1.6, 0.0, 1.0);\n#endif');
  };
  m.customProgramCacheKey = () => 'driftGround';
  return m;
}
function buildKey() {
  const S0 = 340, N = 136, geo = new THREE.PlaneGeometry(S0, S0, N, N).rotateX(-Math.PI / 2), pos = geo.attributes.position, n = pos.count;
  const col = new Float32Array(n * 3), spl = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const x = pos.getX(i) + DRIFT.x, z = pos.getZ(i) + DRIFT.z, h = driftHeight(x, z); pos.setXYZ(i, x, h, z);
    const sand = smooth(2.5, 1.7, h + fbm(x * 0.07, z * 0.07, 2) * 0.5), jn = (1 - sand) * smooth(0.05, 0.35, fbm(x * 0.02 + 3, z * 0.02 - 5, 2)) * 0.8, rock = h < -1.5 ? smooth(-1.5, -4, h) * 0.6 : 0;
    spl[i * 4] = sand * (1 - rock); spl[i * 4 + 1] = (1 - sand) * (1 - jn); spl[i * 4 + 2] = jn; spl[i * 4 + 3] = rock;
    const wet = smooth(0.35, -0.6, h), v = 0.42 - wet * 0.22 + (fbm(x * 0.05, z * 0.05, 2)) * 0.05; col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v * (1 - wet * 0.1); }
  geo.translate(0, 0, 0); geo.computeVertexNormals(); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('splat', new THREE.BufferAttribute(spl, 4)); geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, keyMaterial()); mesh.receiveShadow = true; mesh.name = 'driftkey'; scene.add(mesh);
  // the landing beach facing Goblos (where the conch hangs) and a mooring spot just off it
  const aHome = Math.atan2(HOME.x - DRIFT.x, HOME.z - DRIFT.z); let land = null, moor = null;
  for (let d = 30; d < 170; d += 0.5) { const x = DRIFT.x + Math.sin(aHome) * d, z = DRIFT.z + Math.cos(aHome) * d, h = heightAt(x, z); if (!land && h < 1.0) land = { x: DRIFT.x + Math.sin(aHome) * (d - 4), z: DRIFT.z + Math.cos(aHome) * (d - 4) }; if (h < -6) { moor = { x: DRIFT.x + Math.sin(aHome) * (d + 25), z: DRIFT.z + Math.cos(aHome) * (d + 25), yaw: aHome }; break; } } // (a 66 m ship lies with her stern towards the beach, bow out to sea)
  B.keyLand = land; B.keyMoor = moor;
  const rng = mulberry32(2024), R = (a, b) => a + rng() * (b - a), hAt = (x, z) => heightAt(x, z), pol = (a, inl) => { const x0 = DRIFT.x + Math.sin(a) * 50, z0 = DRIFT.z + Math.cos(a) * 50, r = Math.max(0, driftInland(x0, z0) + 50 - inl); return { x: DRIFT.x + Math.sin(a) * r, z: DRIFT.z + Math.cos(a) * r }; };
  const clear = [land, { x: DRIFT.x, z: DRIFT.z }]; const free = (x, z, r) => clear.every(c => !c || Math.hypot(c.x - x, c.z - z) > r);
  // palms round the beach, leaning seaward in a loose ring, and a few inland
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + R(-0.1, 0.1), p = pol(a, R(9, 26)); if (!free(p.x, p.z, 7)) continue; propAt(rng() < 0.5 ? 'tree_palm2' : 'tree_palm3', p.x, hAt(p.x, p.z) - 0.1, p.z, R(0, 6.28), R(8.5, 12.5)); addCircle(p.x, p.z, 0.45); clear.push({ x: p.x, z: p.z }); }
  for (let i = 0; i < 9; i++) { const a = R(0, 6.28), p = pol(a, R(30, 60)); if (!free(p.x, p.z, 6)) continue; propAt(rng() < 0.6 ? 'tree_palm2' : 'tree_broad', p.x, hAt(p.x, p.z) - 0.1, p.z, R(0, 6.28), R(9, 13)); addCircle(p.x, p.z, 0.5); clear.push({ x: p.x, z: p.z }); }
  for (let i = 0; i < 22; i++) { const a = R(0, 6.28), p = pol(a, R(16, 70)); if (!free(p.x, p.z, 3)) continue; const nm = ['jungle_bush', 'fern', 'jungle_bush', 'fern', 'mushrooms'][i % 5]; propAt(nm, p.x, hAt(p.x, p.z), p.z, R(0, 6.28), nm === 'mushrooms' ? 0.5 : R(1.0, 1.8)); }
  for (let i = 0; i < 7; i++) { const a = R(0, 6.28), p = pol(a, R(-6, 3)); const s = R(1.2, 2.6); propAt(i % 3 ? 'rock_boulder' : 'rock_flat', p.x, hAt(p.x, p.z) - s * 0.3, p.z, R(0, 6.28), s); addCircle(p.x, p.z, s * 0.45); }
  // driftwood on the sand (what gives the Key its name)
  for (let i = 0; i < 6; i++) { const a = R(0, 6.28), p = pol(a, R(2, 6)); propAt('mossy_log', p.x, hAt(p.x, p.z) - 0.1, p.z, R(0, 6.28), R(0.5, 0.8)); }
  // the castaway's camp on the rise: a sail tent, a cold fire ring, a pot, barrels and the carved post
  const cA = aHome + 0.5, camp = { x: DRIFT.x + Math.sin(cA) * 22, z: DRIFT.z + Math.cos(cA) * 22 }, cy = hAt(camp.x, camp.z), cRot = Math.atan2(land ? land.x - camp.x : 0, land ? land.z - camp.z : 1);
  const at = (lx, lz) => ({ x: camp.x + Math.cos(cRot) * lx + Math.sin(cRot) * lz, z: camp.z - Math.sin(cRot) * lx + Math.cos(cRot) * lz });
  { const t = at(-5, -3); propAt('sail_tent', t.x, hAt(t.x, t.z), t.z, cRot + 0.3, 3.4); addCircle(t.x, t.z, 1.7); }
  { const t = at(0, 1); propAt('campfire', t.x, hAt(t.x, t.z), t.z, 0, 1.0); const t2 = at(0.9, 1.6); propAt('cook_pot', t2.x, hAt(t2.x, t2.z), t2.z, 0.4, 0.8); }
  for (const [lx, lz, nm, s] of [[4, -3, 'barrel', 1.0], [4.8, -2.2, 'barrel', 0.95], [4.2, -4.4, 'crate', 0.85], [-2, -6, 'supply_pile', 1.6]]) { const t = at(lx, lz); propAt(nm, t.x, hAt(t.x, t.z), t.z, R(0, 6.28), s); addCircle(t.x, t.z, s * 0.45); }
  { const t = at(2.5, 3.5); const post = new THREE.Group(); cyl(0.13, 0.16, 1.8, MT.beam, 0, 0.9, 0, post, 7); const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = '#8a6a44'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#2a1808'; x.lineWidth = 6; x.beginPath(); x.moveTo(30, 30); x.lineTo(98, 98); x.moveTo(98, 30); x.lineTo(30, 98); x.stroke(); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const pl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.95 })); pl.position.set(0, 1.4, 0.15); post.add(pl); post.position.set(t.x, hAt(t.x, t.z), t.z); post.rotation.y = cRot; scene.add(post); addCircle(t.x, t.z, 0.2);
    use(t.x, t.z, () => 'Read the carving', () => UI.hint('Cut deep into the post: <i>"Old Gil was here, 3 winters. Ate crabs. Hated crabs. What I saved is buried on the hill where the two palms cross. Finders keepers."</i>', 9000)); }
  // the treasure: on top of the hill, between two crossing palms, an X of driftwood on the sand
  { const tA = cA + Math.PI * 0.9, tp = { x: DRIFT.x + Math.sin(tA) * 9, z: DRIFT.z + Math.cos(tA) * 9 }, th = hAt(tp.x, tp.z);
    for (const s of [-1, 1]) { const q = { x: tp.x + s * 4.2, z: tp.z + 2.5 }; propAt('tree_palm2', q.x, hAt(q.x, q.z) - 0.1, q.z, s * 0.9, 11); addCircle(q.x, q.z, 0.45); }
    for (const r of [0.78, -0.78]) { const l = box(3.0, 0.1, 0.3, MT.beam, 0, 0, 0, scene); l.position.set(tp.x, th + 0.03, tp.z); l.rotation.y = r; } // (X marks the spot: the chest sits on it)
    B.chest = buildChest(); B.chest.g.position.set(tp.x, th - 0.02, tp.z); B.chest.g.rotation.y = Math.atan2(DRIFT.x - tp.x + 0.01, DRIFT.z + 6 - tp.z) + Math.PI; scene.add(B.chest.g); addBox(tp.x, tp.z, 0.6, 0.45, B.chest.g.rotation.y);
    use(tp.x, tp.z, () => G.save && !(G.save.drift && G.save.drift.chest) ? 'Open Old Gil\'s sea chest' : null, openChest); }
  // the conch on its post at the landing beach
  if (land) { const g = new THREE.Group(); cyl(0.08, 0.1, 1.6, MT.beam, 0, 0.8, 0, g, 6); const sh = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 9), mat('#f0d8c0', { roughness: 0.5 })); sh.rotation.z = Math.PI / 2; sh.position.set(0.12, 1.5, 0); g.add(sh); g.position.set(land.x, hAt(land.x, land.z), land.z); scene.add(g); addCircle(land.x, land.z, 0.15); }
  // gulls wheel over the island
  B.gulls = []; for (let i = 0; i < 4; i++) { const gl = buildGull(); gl.scale.setScalar(1.4); scene.add(gl); B.gulls.push({ g: gl, a: R(0, 6.28), r: R(18, 40), y: R(13, 22), sp: R(0.18, 0.32), ph: R(0, 6) }); }
}
function buildChest() {
  const g = new THREE.Group(), lid = new THREE.Group();
  box(1.1, 0.55, 0.7, MT.chest, 0, 0.28, 0, g); for (const x of [-0.42, 0.42]) box(0.06, 0.57, 0.72, MT.iron, x, 0.28, 0, g);
  const coins = box(1.0, 0.06, 0.6, MT.gold, 0, 0.5, 0, g); coins.visible = false;
  for (let i = 0; i < 9; i++) { const c = cyl(0.06, 0.06, 0.02, MT.gold, -0.35 + (i % 3) * 0.33 + (i * 0.37 % 0.1), 0.55, -0.18 + Math.floor(i / 3) * 0.17, g, 8); c.rotation.x = 0.3 * (i % 2); c.visible = false; c.userData.coin = true; }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.1, 12, 1, false, 0, Math.PI), MT.chestIn); top.rotation.z = Math.PI / 2; top.castShadow = true; lid.add(top);
  for (const x of [-0.42, 0.42]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.355, 0.03, 4, 12, Math.PI), MT.iron); b.rotation.y = Math.PI / 2; b.position.set(x, 0, 0); lid.add(b); }
  box(0.14, 0.18, 0.05, MT.iron, 0, -0.05, 0.37, lid);
  const piv = new THREE.Group(); piv.position.set(0, 0.55, -0.35); lid.position.set(0, 0, 0.35); piv.add(lid); g.add(piv); // (the lid hinges at its back edge)
  return { g, piv, coins, k: 0, open: false };
}
function openChest() {
  const h = G.save, p = G.player; if (!h || !B.chest) return; h.drift = h.drift || {}; if (h.drift.chest) return;
  h.drift.chest = true; B.chest.open = true; S.coins(); S.loot && S.loot();
  const lv = h.level || 1, gold = 60 + lv * 12, xp = 80 + lv * 30; h.gold = (h.gold || 0) + gold;
  Game.gainXp(h, xp, 'Old Gil\'s treasure'); try { Game.addItem(h, 'potion_heal2', 2); } catch (e) {}
  UI.banner('Old Gil\'s Treasure', `${gold} gold, two Greater Healing Potions and a castaway's tale`, 4200);
  UI.toast(`+${gold} gold`, '🪙', 'gold'); G.hooks.invChanged && G.hooks.invChanged();
  const c = B.chest.g.position; V.burst('gold', new THREE.Vector3(c.x, c.y + 0.8, c.z), 40, { speed: 4, size: 0.25, life: 1.0 });
}
// ---------- the boat ----------
function buildBoatRig() {
  const root = new THREE.Group(), hull = new THREE.Group(); root.add(hull); B.root = root; B.hull = hull; scene.add(root);
  const tryLoad = (L) => L.length ? loadGI(L[0][0]).then(m => m ? [m, L[0][1]] : tryLoad(L.slice(1))) : Promise.resolve([null, 0]);
  tryLoad([['ship', 66], ['boat_smallship', 48]]).then(([m, len]) => { if (!m) { hull.add(fallbackHull()); mooring(); return; }
    BOAT_L = len; const o = m.scene.clone(true), sz = m.box.getSize(new THREE.Vector3()), c = m.box.getCenter(new THREE.Vector3()), alongX = sz.x > sz.z, k = BOAT_L / Math.max(sz.x, sz.z);
    o.traverse(mm => { if (mm.isMesh) { mm.material = mm.material.clone(); mm.material.side = THREE.DoubleSide; mm.material.shadowSide = THREE.BackSide; } }); // (both sides of every plank drawn: no seeing the sea through the inside of the hull)
    o.scale.setScalar(k); o.position.set(-c.x * k, -m.minY * k - DRAFT, -c.z * k); const inner = new THREE.Group(); inner.add(o); if (alongX) inner.rotation.y = Math.PI / 2; inner.rotation.y += BOW_FLIP; hull.add(inner); // (the ship model's bow is its -x end: it ends up along +z, forward)
    B.model = o;
    // measure her by casting rays at the model: the beam at the waterline along her length, and the raised stern deck where the helm is
    root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.updateMatrixWorld(true); const rc = new THREE.Raycaster(), hit = (o0, d) => { rc.set(o0, d); return rc.intersectObject(hull, true)[0]; };
    const down = (x, z) => { const h = hit(new THREE.Vector3(x, 40, z), new THREE.Vector3(0, -1, 0)); return h ? h.point.y : null; };
    const wl = []; for (let i = 0; i <= 44; i++) { const z = -BOAT_L / 2 + BOAT_L * i / 44, h = hit(new THREE.Vector3(60, 1.6, z), new THREE.Vector3(-1, 0, 0)); wl.push([z, h ? Math.abs(h.point.x) : 0]); }
    const hz = -BOAT_L * 0.295, hx = BOAT_L * 0.037, dy = down(hx, hz); B.deckY = dy != null && dy > 2 ? dy : 7.7; B.helm.set(hx, B.deckY, hz);
    const sx = BOAT_L * 0.045; let z0 = hz, z1 = hz; while (z0 > -BOAT_L / 2 && Math.abs((down(sx, z0 - 0.75) ?? -9) - B.deckY) < 0.9) z0 -= 0.75; while (z1 < 0 && Math.abs((down(sx, z1 + 0.75) ?? -9) - B.deckY) < 0.9) z1 += 0.75;
    B.qd = { z0: z0 + 0.5, z1: z1 - 0.5, x0: hx * 0.55, x1: Math.max(hx + 1, (wl.find(w => w[0] >= hz) || [0, 4])[1] - 0.4) }; // (the stern deck either side of the raised poop down the middle)
    B.dims = { w: Math.max(...wl.map(w => w[1])) * 2, h: B.deckY };
    waterMask(wl); mooring(); });
  placeBoat(HOME.x, HOME.z, HOME.yaw);
}
// the sea must never show inside her: a hull-shaped lid at the waterline, drawn only into the depth buffer just before the water
function waterMask(wl) {
  const pts = wl.filter(w => w[1] > 0.3), sh = new THREE.Shape(); if (pts.length < 3) return;
  pts.forEach(([z, w], i) => { const x = Math.max(0, w - 0.25); i ? sh.lineTo(x, z) : sh.moveTo(x, z); }); for (let i = pts.length - 1; i >= 0; i--) sh.lineTo(-Math.max(0, pts[i][1] - 0.25), pts[i][0]);
  const g = new THREE.ShapeGeometry(sh); g.rotateX(Math.PI / 2); // (shape x,y -> world x,z)
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true, side: THREE.DoubleSide })); m.position.y = 1.6; m.renderOrder = 1; m.frustumCulled = false; B.root.add(m); B.mask = m;
}
// tied up at the dock: a stair up from the dock to a landing level with her stern deck, a plank across, and her stern deck walkable
function mooring() {
  const fx = Math.sin(HOME.yaw), fz = Math.cos(HOME.yaw), lx = Math.cos(HOME.yaw), lz = -Math.sin(HOME.yaw), Q = B.qd || { z0: -24, z1: -15, x0: 1.3, x1: 4.4 }, Y = B.deckY;
  const sideOff = (HOME.x - WASH.x) * drt.x + (HOME.z - WASH.z) * drt.z, sHome = (HOME.x - WASH.x) * dfw.x + (HOME.z - WASH.z) * dfw.z; // (her offset across the dock, and along it)
  const qzMid = (Q.z0 + Q.z1) / 2, hd = (Q.z1 - Q.z0) / 2;
  B.deckSurfs = [];
  const at = (cx, cz) => ({ x: HOME.x + lx * cx + fx * cz, z: HOME.z + lz * cx + fz * cz });
  { const c0 = at(0, qzMid); B.deckSurfs.push(addSurface(c0.x, c0.z, Q.x1, hd, HOME.yaw, Y)); } // (the whole stern deck, rail to rail)
  // her rails keep you on deck (only up at deck height, and only while she is tied up); a gap where the plank comes aboard
  const ds = Math.sign((WASH.x - HOME.x) * lx + (WASH.z - HOME.z) * lz) || -1, rail = (cx, cz, hx2, hz2) => { const c0 = at(cx, cz); return addBox(c0.x, c0.z, hx2, hz2, HOME.yaw, 'shiprail', Y - 0.6, Y + 3); };
  B.rails = [rail(-ds * (Q.x1 + 0.15), qzMid, 0.15, hd + 0.3), rail(0, Q.z0 - 0.15, Q.x1 + 0.3, 0.15), rail(0, Q.z1 + 0.15, Q.x1 + 0.3, 0.15)];
  { const gap = 0.9, la = Q.z0, lb = qzMid - gap, ra = qzMid + gap, rb = Q.z1; B.rails.push(rail(ds * (Q.x1 + 0.15), (la + lb) / 2, 0.15, (lb - la) / 2 + 0.15), rail(ds * (Q.x1 + 0.15), (ra + rb) / 2, 0.15, (rb - ra) / 2 + 0.15)); }
  // the stair (along the dock, rising outward) and its landing beside her stern deck
  const sLand = sHome + qzMid, rise = Y - DOCK_Y, run = rise / 0.5, sR0 = sLand - 1.6 - run, g = new THREE.Group();
  const stair = dockAt(sR0 + run / 2), land = dockAt(sLand);
  B.stairS = addSurface(stair.x, stair.z, 0.8, run / 2, DOCK_A, DOCK_Y, 0, Y); B.landS = addSurface(land.x, land.z, 0.85, 1.6, DOCK_A, Y);
  { const L2 = Math.hypot(run, rise), t = Math.atan2(rise, run), sg = new THREE.Group(); for (let i = 0; i < L2 / 0.42; i++) box(1.6, 0.08, 0.36, i % 2 ? MT.plank : MT.plank2, 0, 0, i * 0.42 - L2 / 2 + 0.2, sg);
    for (const sx2 of [-1, 1]) box(0.08, 0.08, L2, MT.rope, sx2 * 0.8, 1.0, 0, sg); sg.position.set(stair.x, (DOCK_Y + Y) / 2, stair.z); sg.rotation.set(-t, DOCK_A, 0, 'YXZ'); scene.add(sg);
    for (let i = 1; i <= 3; i++) { const q = dockAt(sR0 + run * i / 4); const hh = rise * i / 4; for (const sx2 of [-1, 1]) { const qq = dockAt(sR0 + run * i / 4, sx2 * 0.75); cyl(0.09, 0.1, hh, MT.beam, qq.x, DOCK_Y + hh / 2, qq.z, scene, 6); } }
    const lg = new THREE.Group(); box(1.7, 0.12, 3.2, MT.plank, 0, -0.06, 0, lg); for (const sx2 of [-1, 1]) for (const sz2 of [-1, 1]) cyl(0.12, 0.13, rise, MT.beam, sx2 * 0.75, -rise / 2, sz2 * 1.5, lg, 6); box(0.08, 0.08, 3.2, MT.rope, -0.82 * Math.sign(sideOff || 1), 1.0, 0, lg);
    lg.position.set(land.x, Y, land.z); lg.rotation.y = DOCK_A; scene.add(lg); }
  // the plank across to her deck (only while she is tied up)
  const nearEdge = Math.abs(sideOff) - Q.x1 + 0.3, sgn = Math.sign(sideOff) || 1, pa = dockAt(sLand, sgn * 0.6), pb = dockAt(sLand, sgn * nearEdge), pm = { x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2 }, pl = Math.hypot(pb.x - pa.x, pb.z - pa.z), rot = Math.atan2(pb.x - pa.x, pb.z - pa.z);
  B.plankS = addSurface(pm.x, pm.z, 0.6, pl / 2, rot, Y);
  { const pg = new THREE.Group(); for (let i = 0; i < pl / 0.4; i++) box(1.1, 0.08, 0.36, i % 2 ? MT.plank : MT.plank2, 0, 0, i * 0.4 - pl / 2 + 0.2, pg); for (const sx2 of [-1, 1]) box(0.06, 0.06, pl, MT.rope, sx2 * 0.55, 0.9, 0, pg); pg.position.set(pm.x, Y + 0.02, pm.z); pg.rotation.y = rot; scene.add(pg); B.gang = pg; }
  B.deckSurfs.push(B.plankS, B.landS, B.stairS);
  B.shipSurfs = [B.deckSurfs[0], B.plankS];
}
const BOW_FLIP = 0;
function fallbackHull() { const g = new THREE.Group(), hm = MT.plank2.clone(); hm.side = THREE.DoubleSide; const s = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), hm); s.scale.set(1.6, 2.2, BOAT_L / 2); s.position.y = 0.5; g.add(s); return g; }
function helmWorld() { B.root.updateMatrixWorld(true); return B.helm.clone().applyMatrix4(B.root.matrixWorld); }
function placeBoat(x, z, yaw) { B.x = x; B.z = z; B.yaw = yaw; B.spd = 0; B.turn = 0; }
// the nearest point on the boat's keel line to p (for the "climb in" prompt)
function boatClosest(p) { const fx = Math.sin(B.yaw), fz = Math.cos(B.yaw), t = clamp((p.x - B.x) * fx + (p.z - B.z) * fz, -BOAT_L / 2 + 1, BOAT_L / 2 - 1); return { x: B.x + fx * t, z: B.z + fz * t }; }
// where the hero stands in the boat (world space)
function seat() { return helmWorld(); } // (the hero stands at the helm on the stern deck)
// how far the hull is into the sand or the dock, summed over points round it (0: afloat and clear)
const dockPen = (x, z) => { const dx = x - WASH.x, dz = z - WASH.z, s = dx * dfw.x + dz * dfw.z, sd = dx * drt.x + dz * drt.z; return s > DOCK_S0 - 1 && s < DOCK_S1 + 0.6 ? Math.max(0, DOCK_HW + 0.25 - Math.abs(sd)) : 0; };
const HULL_PTS = [[1, 0], [0.62, 0.8], [0.62, -0.8], [0, 1], [0, -1], [-0.62, 0.8], [-0.62, -0.8], [-1, 0]];
function hullPen(x, z, yaw) { const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), hw = B.dims.w / 2, L = BOAT_L / 2; let pen = 0;
  for (const [a, b] of HULL_PTS) { const px = x + fx * a * L + rx * b * hw, pz = z + fz * a * L + rz * b * hw; pen += Math.max(0, heightAt(px, pz) - SHALLOW) + dockPen(px, pz); } return pen; }
// a move is allowed if it leaves the hull clear, or at least gets it less stuck (so you can always back or turn off a sandbank)
const canGo = (pen0, x, z, yaw) => { const p1 = hullPen(x, z, yaw); return p1 <= 0 || p1 < pen0 - 1e-4; };
function recall(to, msg) { if (!to) return; placeBoat(to.x, to.z, to.yaw); S.splash(new THREE.Vector3(to.x, 0, to.z), 0.6); UI.toast(msg, '⛵', 'gold'); if (B.bell) B.bellT = 1.2; }

// ---------- getting in and out ----------
function board() {
  const p = G.player; if (!p || p.dead || B.mode !== 'idle') return;
  B.mode = 'board'; B.t = 0; B.from = p.pos.clone(); B.prevCam = p.camDistT; B.camFrom = camera.position.clone(); B.camQ = camera.quaternion.clone();
  B.cy = 0; B.cp = 0.3; B.spd = 0; B.turn = 0; p.atk = null; p.press = null; p.channel = null; p.block = false; p.adsHeld = false; if (p.cancelGather) p.cancelGather();
  p.ch.hoverStill = true; p.vm.g.visible = false; if (p.adsG) p.adsG.visible = false; document.body.classList.add('sailing');
  B.tgt = Math.hypot(p.pos.x - DRIFT.x, p.pos.z - DRIFT.z) < 260 ? { x: HOME.x, z: HOME.z, name: 'Goblos dock' } : { x: B.keyMoor ? B.keyMoor.x : DRIFT.x, z: B.keyMoor ? B.keyMoor.z : DRIFT.z, name: DRIFT.name };
  S.step('wood', p.pos, 1.2);
}
// a dry spot to step out onto: the nearest bit of beach or dock within reach of the boat
function landSpot() {
  const tn = performance.now(); if (tn - B.landT < 200) return B.land; B.landT = tn; B.land = null;
  const fx = Math.sin(B.yaw), fz = Math.cos(B.yaw), rx = Math.cos(B.yaw), rz = -Math.sin(B.yaw); let best = null, bd = 1e9;
  for (let a = 0; a < 16; a++) { const ang = a / 16 * Math.PI * 2, dx = Math.sin(ang), dz = Math.cos(ang);
    for (let d = 1.5; d <= 18; d += 0.75) { const lx = dx * (B.dims.w / 2 + d), lz = dz * (BOAT_L / 2 + d) * 0.9, x = B.x + rx * lx + fx * lz, z = B.z + rz * lx + fz * lz, g = groundAt(x, z);
      if (g.h < 0.3) continue; if (!g.surf && Math.abs(heightAt(x + 1, z) - heightAt(x - 1, z)) + Math.abs(heightAt(x, z + 1) - heightAt(x, z - 1)) > 1.6) break;
      const dd = Math.hypot(x - B.x, z - B.z); if (dd < bd) { bd = dd; best = { x, z, h: g.h }; } break; } }
  B.land = best; return best;
}
function leave() {
  const p = G.player, L = landSpot(); if (!p || !L || B.mode !== 'sail') return;
  B.mode = 'leave'; B.t = 0; B.from = seat(); B.to = new THREE.Vector3(L.x, L.h, L.z); B.camFrom = camera.position.clone(); B.camQ = camera.quaternion.clone(); B.spd *= 0.3;
  S.splash(new THREE.Vector3(L.x, 0, L.z), 0.4);
}
function finishLeave() {
  const p = G.player, to = B.to; B.mode = 'idle'; document.body.classList.remove('sailing'); if (B.hud) B.hud.hidden = true;
  const yaw = Math.atan2(to.x - B.x, to.z - B.z); p.place(to.x, to.z, yaw); p.pitch = -0.05; p.vel.set(0, 0, 0); p.onGround = true; p.fallTop = null;
  p.ch.hoverStill = false; p.ch.root.rotation.set(0, yaw, 0); p.camDist = p.camDistT = B.prevCam;
  S.step('sand', p.pos, 1.1); B.spd = 0; B.turn = 0;
  if (Math.hypot(B.x - HOME.x, B.z - HOME.z) < 90 && (B.x !== HOME.x || B.z !== HOME.z)) { placeBoat(HOME.x, HOME.z, HOME.yaw); UI.toast('Dockhands warp your ship in and tie her up at the dock.', '⚓', 'gold'); } // (back home: she is made fast alongside, gangway down)
}
// ---------- each frame ----------
// runs every frame on Goblos; returns true while the boat has the controls (main.js then skips the hero's own update)
export function sailTick(dt) {
  const p = G.player; if (!B.root || !p) return false;
  const t = G.time;
  if (B.mode !== 'idle' && p.dead) { B.mode = 'idle'; document.body.classList.remove('sailing'); if (B.hud) B.hud.hidden = true; p.ch.hoverStill = false; }
  if (B.mode === 'sail') steer(dt);
  else if (B.mode === 'idle') { B.spd *= Math.max(0, 1 - dt * 1.5); B.turn = 0; }
  // the boat rides the swell: heave, pitch and roll from the waves under the bow, stern and both sides
  const fx = Math.sin(B.yaw), fz = Math.cos(B.yaw), rx = Math.cos(B.yaw), rz = -Math.sin(B.yaw), L2 = BOAT_L * 0.42, hw = B.dims.w * 0.5;
  const wb = W(B.x + fx * L2, B.z + fz * L2, t), ws = W(B.x - fx * L2, B.z - fz * L2, t), wl = W(B.x - rx * hw, B.z - rz * hw, t), wr = W(B.x + rx * hw, B.z + rz * hw, t);
  const acc = (B.spd - (B.lastSpd ?? B.spd)) / Math.max(dt, 1e-3); B.lastSpd = B.spd;
  const moored = B.mode === 'idle' && Math.abs(B.x - HOME.x) < 0.06 && Math.abs(B.z - HOME.z) < 0.06, sw = moored ? 0.15 : 0.45; // (a 22 m hull rides the swell gently; tied up she barely stirs, so you can walk her deck)
  B.y += (((wb + ws + wl + wr) * 0.25) * sw + SEA - B.y) * Math.min(1, dt * 2);
  B.pitch += ((Math.atan2(ws - wb, L2 * 2) - clamp(acc, -2, 2) * 0.006) * sw - B.pitch) * Math.min(1, dt * 1.5);
  B.roll += ((Math.atan2(wl - wr, hw * 2) * 0.5) * sw - B.turn * Math.abs(B.spd) * 0.012 - B.roll) * Math.min(1, dt * 1.5);
  // tied up at the dock her stern deck and the gangway can be walked; anywhere else they are not there
  if (B.shipSurfs) { for (const sf of B.shipSurfs) sf.y = moored ? B.deckY + Math.min(0, B.y) : -1e3; B.gang.visible = moored; for (const r of B.rails) r.on = moored; }
  B.root.position.set(B.x, B.y, B.z); B.root.rotation.set(B.pitch, B.yaw, B.roll, 'YXZ');
  // the rope to the dock while she is tied up there
  { const tied = B.mode === 'idle' && Math.hypot(B.x - HOME.x, B.z - HOME.z) < 1.5; B.dockRope.visible = tied; if (tied) { const a = dockAt(DOCK_S1 - 0.2 - 3.6 * 0, DOCK_HW), bo = new THREE.Vector3(fx * (BOAT_L / 2 - 0.4), B.dims.h - DRAFT - 0.1, 0); bo.set(B.x + fx * (BOAT_L / 2 - 0.5), B.y + B.dims.h - 0.2, B.z + fz * (BOAT_L / 2 - 0.5));
      const A0 = new THREE.Vector3(a.x - dfw.x * 0.4, DOCK_Y + 0.5, a.z - dfw.z * 0.4), d = bo.clone().sub(A0), l = d.length(); B.dockRope.position.copy(A0).addScaledVector(d, 0.5); B.dockRope.position.y -= 0.12; B.dockRope.scale.set(1, l, 1); B.dockRope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); } }
  seaSounds(dt);
  // the hero in the boat
  if (B.mode !== 'idle') heroInBoat(dt);
  if (B.mode !== 'idle') { boatCam(dt); sailHud(); }
  // the sea follows you far out, and you see further over open water
  const off = Math.abs(p.pos.x) > 560 || Math.abs(p.pos.z) > 560;
  B.fogK += ((B.mode !== 'idle' || off ? 1 : 0) - B.fogK) * Math.min(1, dt * 0.8);
  if (water && water.sea) { if (B.mode !== 'idle' || off) water.sea.position.set(Math.round(camera.position.x / 32) * 32, water.sea.position.y, Math.round(camera.position.z / 32) * 32); else if (water.sea.position.x || water.sea.position.z) water.sea.position.set(0, water.sea.position.y, 0); }
  // Driftwood Key: gulls, the chest's glint, and the first sight of it
  if (Math.hypot(p.pos.x - DRIFT.x, p.pos.z - DRIFT.z) < 420) { for (const g of B.gulls) { g.a += g.sp * dt; const x = DRIFT.x + Math.cos(g.a) * g.r, z = DRIFT.z + Math.sin(g.a) * g.r; g.g.position.set(x, g.y + Math.sin(t * 0.7 + g.ph) * 1.5, z); g.g.rotation.set(0, -g.a + Math.PI, 0.35); flap(g.g, t * 5 + g.ph, Math.sin(t * 0.5 + g.ph) > 0.2 ? 1 : 0.25); g.g.visible = true; } }
  else for (const g of B.gulls) g.g.visible = false;
  if (B.chest) { const opened = G.save && G.save.drift && G.save.drift.chest; B.chest.k += ((opened ? 1 : 0) - B.chest.k) * Math.min(1, dt * 3); B.chest.piv.rotation.x = -B.chest.k * 1.9; for (const c of B.chest.g.children) if (c.userData.coin) c.visible = B.chest.k > 0.05; B.chest.coins.visible = B.chest.k > 0.05;
    if (!opened && Math.random() < dt * 1.5 && near(p, DRIFT.x, DRIFT.z, 140)) { const c = B.chest.g.position; V.burst('gold', new THREE.Vector3(c.x + (Math.random() - 0.5) * 0.8, c.y + 0.7, c.z + (Math.random() - 0.5) * 0.5), 1, { speed: 0.4, size: 0.18, life: 0.7, vy: 0.6 }); } }
  if (!B.seenKey && G.save && near(p, DRIFT.x, DRIFT.z, DRIFT.r + 25)) { B.seenKey = true; const h = G.save; h.drift = h.drift || {}; if (!h.drift.seen) { h.drift.seen = true; UI.banner(DRIFT.name, 'A lonely palm isle out past the reef', 4200); UI.toast(`Discovered: ${DRIFT.name}`, '🗺', 'gold'); } }
  if (B.lamp) B.lamp.material.emissiveIntensity = 0.3 + (G.night || 0) * 2.2;
  if (B.bellT > 0) { B.bellT -= dt; B.bell.rotation.z = Math.sin(B.bellT * 18) * 0.5 * B.bellT; }
  return B.mode !== 'idle';
}
function steer(dt) {
  const K = G.keys, ui = G.uiOpen, fw = !ui && K.KeyW ? 1 : 0, bk = !ui && K.KeyS ? 1 : 0, tl = !ui && K.KeyA ? 1 : 0, tr = !ui && K.KeyD ? 1 : 0;
  B.effort = fw - bk;
  const thrust = fw * 1.0 - bk * 0.6, drag = 0.07 + (fw || bk ? 0 : 0.07); // (a heavy ship: slow to gather way, slow to lose it)
  B.spd += thrust * dt; B.spd -= B.spd * drag * dt + Math.sign(B.spd) * Math.min(Math.abs(B.spd), 0.12 * dt);
  B.spd = clamp(B.spd, -MAXB, MAXF);
  const steerK = 0.04 + 0.12 * Math.min(1, Math.abs(B.spd) / 7), want = (tl - tr) * steerK * (B.spd < -0.2 ? -1 : 1); // (the rudder bites with way on; dead in the water she barely turns)
  B.turn += (want - B.turn) * Math.min(1, dt * 0.8);
  const pen0 = hullPen(B.x, B.z, B.yaw), ny = B.yaw + B.turn * dt; if (canGo(pen0, B.x, B.z, ny)) B.yaw = ny; else B.turn *= 0.3;
  const nx = B.x + Math.sin(B.yaw) * B.spd * dt, nz = B.z + Math.cos(B.yaw) * B.spd * dt;
  if (Math.abs(B.spd) > 0.01 && !canGo(pen0, nx, nz, B.yaw)) { // ran aground (or into the dock): a bump, and she stops
    if (Math.abs(B.spd) > 1.6 && B.bumpT <= 0) { B.bumpT = 0.8; S.splash(new THREE.Vector3(nx, 0, nz), 0.5); S.step('wood', G.player.pos, 1.3); UI.toast(Math.hypot(nx - HOME.x, nz - HOME.z) < 14 ? 'Bump! You knock against the dock.' : 'The hull scrapes on sand: too shallow here. Press E to step ashore, or back off with S.', '⛵', 'bad'); V.shake = Math.max(V.shake || 0, 0.15); }
    B.spd = -B.spd * 0.15;
  } else { B.x = nx; B.z = nz; }
  B.bumpT -= dt;
  // the open sea has an edge: a current turns you back
  const r = Math.hypot(B.x, B.z); if (r > LIMIT) { B.x *= LIMIT / r; B.z *= LIMIT / r; B.spd *= 0.6; if ((B.farT -= dt) <= 0) { B.farT = 6; UI.toast('A strong current pushes you back. Nothing out there but endless sea.', '🌊', 'bad'); } }
  // foam: a wake off the stern, spray from the bow at speed
  const as = Math.abs(B.spd), fx = Math.sin(B.yaw), fz = Math.cos(B.yaw), rx = Math.cos(B.yaw), rz = -Math.sin(B.yaw), wk = B.dims.w * 0.45;
  if (as > 0.8 && Math.random() < dt * (10 + as * 3)) for (const sd of [-1, 1]) { const back = (B.spd > 0 ? -BOAT_L : BOAT_L) * (0.3 + Math.random() * 0.2); V.norm.spawn(B.x + fx * back + rx * sd * wk, SEA + 0.12, B.z + fz * back + rz * sd * wk, rx * sd * 0.7 - fx * B.spd * 0.15, 0.25, rz * sd * 0.7 - fz * B.spd * 0.15, 2.4, 0.9, 2.8, FOAM0, FOAM1, 0.55, 0, 0.3, 1.2); }
  if (as > 5 && Math.random() < dt * (as - 3) * 1.5) for (const sd of [-1, 1]) V.norm.spawn(B.x + fx * BOAT_L * 0.4 + rx * sd * 0.9, SEA + 0.4, B.z + fz * BOAT_L * 0.4 + rz * sd * 0.9, rx * sd * 1.6 + fx * B.spd * 0.3, 1.6 + Math.random(), rz * sd * 1.6 + fz * B.spd * 0.3, 0.8, 0.4, 0.9, FOAM0, FOAM1, 0.8, 0, 7, 0.6);
}
// the sea against her hull: a soft wash now and then, more often the faster she goes, and a creak of timber
function seaSounds(dt) {
  if (B.mode !== 'sail') return; const as = Math.abs(B.spd); B.sndT = (B.sndT || 0) - dt * (0.35 + as * 0.12);
  if (B.sndT <= 0) { B.sndT = 1 + Math.random() * 1.5; const p = new THREE.Vector3(B.x + Math.sin(B.yaw) * BOAT_L * 0.4, 0, B.z + Math.cos(B.yaw) * BOAT_L * 0.4); S.splash(p, 0.18 + Math.min(0.3, as * 0.03)); if (Math.random() < 0.35) S.step('wood', G.player.pos, 0.5); }
}
function heroInBoat(dt) {
  const p = G.player, s = seat(); B.t += dt;
  let k = 1; if (B.mode === 'board') { k = Math.min(1, B.t / 0.9); const e = k * k * (3 - 2 * k); p.pos.lerpVectors(B.from, s, e); p.pos.y += Math.sin(Math.PI * k) * 0.9; if (k >= 1) B.mode = 'sail'; }
  else if (B.mode === 'leave') { k = Math.min(1, B.t / 0.55); const e = k * k * (3 - 2 * k); p.pos.lerpVectors(B.from, B.to, e); p.pos.y += Math.sin(Math.PI * k) * 0.8; if (k >= 1) { finishLeave(); return; } }
  else p.pos.copy(s);
  p.bodyYaw = B.mode === 'leave' ? Math.atan2(B.to.x - B.from.x, B.to.z - B.from.z) : B.yaw; p.yaw = B.yaw + B.cy; p.vel.set(0, 0, 0); p.onGround = true; p.fallTop = null; p.swim = false;
  p.ch.hoverStill = true; p.vm.g.visible = false; if (p.adsG) p.adsG.visible = false; p.ch.root.visible = true;
  p.animate(dt, 0);
  if (B.mode === 'sail') { p.ch.root.rotation.x = B.pitch; p.ch.root.rotation.z = B.roll; }
}
// a chase camera behind the boat; the mouse swings it round and up or down, the wheel moves it in and out
function chasePose() {
  const h = B.yaw + B.cy, cp = B.cp, d = B.cd, tx = B.x + Math.sin(B.yaw) * 4, tz = B.z + Math.cos(B.yaw) * 4, ty = B.y + 14;
  const pos = new THREE.Vector3(tx - Math.sin(h) * Math.cos(cp) * d, ty + Math.sin(cp) * d, tz - Math.cos(h) * Math.cos(cp) * d);
  pos.y = Math.max(pos.y, Math.max(heightAt(pos.x, pos.z), SEA) + 0.9);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, new THREE.Vector3(tx, ty, tz), new THREE.Vector3(0, 1, 0)));
  return { pos, q };
}
function boatCam(dt) {
  B.lookT += dt; if (B.lookT > 2.5 && Math.abs(B.spd) > 1.5) B.cy *= Math.max(0, 1 - dt * 0.7); // (sailing on, the camera drifts back behind the boat)
  const P = chasePose();
  if (B.mode === 'board') { const k = Math.min(1, B.t / 1.0), e = k * k * (3 - 2 * k); camera.position.lerpVectors(B.camFrom, P.pos, e); camera.quaternion.copy(B.camQ).slerp(P.q, e); B.camNow = camera.position.clone(); }
  else if (B.mode === 'leave') { const p = G.player, k = Math.min(1, B.t / 0.55), e = k * k * (3 - 2 * k), eye = p.pos.clone(); eye.y += (p.eye || 1.6); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, Math.atan2(B.to.x - B.x, B.to.z - B.z) + Math.PI, 0, 'YXZ'));
    if (B.prevCam >= 0.6) { const fw = new THREE.Vector3(Math.sin(p.bodyYaw), 0, Math.cos(p.bodyYaw)); eye.addScaledVector(fw, -B.prevCam); }
    camera.position.lerpVectors(B.camFrom, eye, e); camera.quaternion.copy(B.camQ).slerp(q, e); }
  else { B.camNow = B.camNow || P.pos.clone(); B.camNow.lerp(P.pos, Math.min(1, dt * 7)); camera.position.copy(B.camNow); camera.quaternion.copy(P.q); }
  camera.rotation.order = 'YXZ'; camera.updateMatrixWorld();
  A.setListener(camera.position.x, camera.position.y, camera.position.z, B.yaw + B.cy + Math.PI);
}
export function sailLook(dx, dy) { const k = 0.0032 * (settings.sens || 1); B.cy -= dx * k; B.cp = clamp(B.cp + dy * k * (settings.invertY ? -1 : 1), 0.04, 1.25); B.lookT = 0; }
export function sailWheel(dy) { B.cd = clamp(B.cd + Math.sign(dy) * 5, 30, 150); }
// keys while in the boat (WASD go to G.keys as usual): E steps ashore
export function sailKey(code) {
  if (code === 'KeyE' && B.mode === 'sail') { if (landSpot()) leave(); else if (performance.now() - (B.noLandT || 0) > 2500) { B.noLandT = performance.now(); UI.toast('Too far from land to step off. Row closer to a beach or a dock.', '⛵', 'bad'); } }
}
function sailHud() {
  if (!B.hud) { B.hud = document.createElement('div'); B.hud.id = 'sailhud'; B.hud.innerHTML = '<div class="sh-goal"><span class="sh-arrow"><svg viewBox="0 0 20 20" width="20" height="20"><path d="M10 1 L17 17 L10 13 L3 17 Z" fill="#ffd060" stroke="#3a2a10" stroke-width="1.2"/></svg></span><span class="sh-txt"></span><span class="sh-spd"><i></i></span></div><div class="sh-keys"><kbd>W</kbd><kbd>S</kbd> sail &nbsp;·&nbsp; <kbd>A</kbd><kbd>D</kbd> steer &nbsp;·&nbsp; mouse: look &nbsp;·&nbsp; <kbd>E</kbd> step ashore</div>'; (document.getElementById('hud') || document.body).appendChild(B.hud); }
  B.hud.hidden = false; const T = B.tgt; if (!T) return;
  const d = Math.hypot(T.x - B.x, T.z - B.z), a = Math.atan2(T.x - B.x, T.z - B.z), rel = Math.atan2(Math.sin(a - (B.yaw + B.cy)), Math.cos(a - (B.yaw + B.cy)));
  const txt = d < 30 ? `${T.name}: here` : `${T.name} · ${Math.round(d)} m`; const el = B.hud.querySelector('.sh-txt'); if (el._t !== txt) { el.textContent = txt; el._t = txt; }
  B.hud.querySelector('.sh-arrow').style.transform = `rotate(${(-rel * 180 / Math.PI).toFixed(0)}deg)`;
  B.hud.querySelector('.sh-spd i').style.width = Math.round(clamp(Math.abs(B.spd) / MAXF, 0, 1) * 100) + '%';
}
// ---------- saving and loading ----------
export function sailSave(h) {
  h.boat = { x: +B.x.toFixed(2), z: +B.z.toFixed(2), yaw: +B.yaw.toFixed(3), aboard: B.mode === 'sail' || B.mode === 'board' };
  if (h.boat.aboard) h.pos = { x: B.x, z: B.z, yaw: B.yaw };
}
// a hero starts (or loads): put the boat where it was left (back at the dock if it was lost), and climb back in if you saved at sea
export function sailStart(h) {
  if (!B.root) return; const p = G.player;
  B.mode = 'idle'; document.body.classList.remove('sailing'); if (B.hud) B.hud.hidden = true; B.seenKey = !!(h.drift && h.drift.seen); B.fogK = 0; B.camNow = null;
  const s = h.boat, ok = s && isFinite(s.x) && isFinite(s.z) && Math.hypot(s.x, s.z) < LIMIT + 5 && hullPen(s.x, s.z, s.yaw || 0) <= 0;
  if (ok && Math.hypot(s.x - HOME.x, s.z - HOME.z) > 0.5) placeBoat(s.x, s.z, s.yaw || 0); else placeBoat(HOME.x, HOME.z, HOME.yaw);
  if (ok && s.aboard && p && !p.dead) { B.from = p.pos.clone(); board(); B.t = 1; B.mode = 'sail'; B.camFrom = null; B.camNow = null; return; }
  // far from the boat (it is somewhere you can't reach): it waits for you where you are
  if (p && Math.hypot(p.pos.x - B.x, p.pos.z - B.z) > 160) { const onKey = Math.hypot(p.pos.x - DRIFT.x, p.pos.z - DRIFT.z) < 220; const to = onKey ? B.keyMoor : HOME; if (to) placeBoat(to.x, to.z, to.yaw); }
}
export function sailStop() { B.mode = 'idle'; document.body.classList.remove('sailing'); if (B.hud) B.hud.hidden = true; B.fogK = 0; if (water && water.sea) water.sea.position.set(0, water.sea.position.y, 0); }
// (tests and tools)
export const SAIL = B;
export const SAIL_HOME = HOME;

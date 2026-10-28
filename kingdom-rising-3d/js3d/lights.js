// Kingdom Rising 3D — torches, lamps, braziers and hearths light the world: a small pool of real point
// lights is moved every frame to the fires nearest the camera, flickering like the 2D game's lights
import { THREE, K3, TS, PX } from './core.js';
import { geo } from './geo.js';

const KR = window.KR, W = KR.W, G = KR.G;
const pool = [];
let cands = [];
export const lights = { pool, cands };
function ensurePool() {
  const n = K3.quality.lights;
  while (pool.length < n) { const l = new THREE.PointLight(0xffaa66, 0, 16, 2); l.castShadow = false; K3.scene.add(l); pool.push({ l, c: null, i: 0 }); }
  while (pool.length > n) { const p = pool.pop(); K3.scene.remove(p.l); }
}
K3.onQuality.push(ensurePool);

const HEIGHT = { lamp: 2.5, fire: 0.9, magic: 2.2, ghost: 2.6 };
const KIND_I = { lamp: 14, fire: 22, magic: 12, ghost: 9 };
// build the list of light sources for the realm, snapping each to the nearest flame model
export function buildLights(flames) {
  ensurePool();
  cands = [];
  const fl = flames.filter((f) => f.kind === 0 || f.kind === 1);
  for (const L of W.lights) {
    const k = L.k || 'fire';
    let x = L.x * PX, z = (L.y + (k === 'lamp' ? 36 : k === 'ghost' ? 70 : 8)) * PX;
    const fy = geo.floorAt(x / PX, z / PX);
    let y = fy + (HEIGHT[k] || 1.2);
    // nearest flame within 3 m
    let best = null, bd = 3;
    for (const f of fl) { const d = Math.hypot(f.x - x, f.z - z); if (d < bd) { bd = d; best = f; } }
    if (best) { x = best.x; z = best.z; y = best.y + (best.kind === 0 ? best.h * 0.6 : 0.1); }
    const c = String(L.col || '255,180,100').split(',').map((v) => +v / 255);
    cands.push({ x, y, z, r: Math.max(8, (L.r || 160) * PX * 1.7), col: new THREE.Color(c[0], c[1], c[2]).convertSRGBToLinear(), fl: L.fl || 0.1, base: KIND_I[k] || 16, b: L.b || null, ph: Math.random() * 10, k });
  }
  lights.cands = cands;
  buildPools();
}
// every lamp, torch and brazier also throws a soft warm pool of light on the ground around it, drawn as one additive
// mesh for the whole realm: towns stay lit at night on any preset, however few real lights it can afford
let pools = null; const poolU = { uK: { value: 0 } };
function poolTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let poolT = null;
function buildPools() {
  if (pools) { K3.scene.remove(pools); pools.geometry.dispose(); pools = null; }
  const list = cands.filter((c) => c.k !== 'ghost'); if (!list.length) return;
  poolT = poolT || poolTex();
  const geom = new THREE.PlaneGeometry(1, 1); geom.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: poolT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mat.onBeforeCompile = (sh) => { sh.uniforms.uK = poolU.uK; sh.fragmentShader = 'uniform float uK;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= uK;'); };
  const m = new THREE.InstancedMesh(geom, mat, list.length); const M = new THREE.Matrix4(), col = new THREE.Color();
  list.forEach((c, i) => {
    const gy = geo.floorAt(c.x / PX, c.z / PX); const rad = Math.min(14, c.r * (c.k === 'lamp' ? 0.75 : 0.6));
    M.makeScale(rad * 2, 1, rad * 2); M.setPosition(c.x, gy + 0.06, c.z); m.setMatrixAt(i, M);
    m.setColorAt(i, col.copy(c.col).multiplyScalar(c.k === 'fire' ? 0.9 : 0.75));
  });
  m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.frustumCulled = false; m.renderOrder = 2; m.castShadow = m.receiveShadow = false; m.userData.lightPools = true;
  K3.scene.add(m); pools = m;
}
const _v = new THREE.Vector3();
let tick = 0, chosen = [];
export function updateLights(dt, camPos, ctx) {
  tick -= dt;
  const darkness = K3.sky && Number.isFinite(K3.sky.darkness) ? K3.sky.darkness : 0.5;
  const inside = ctx.inside;
  if (tick <= 0) {
    tick = 0.25;
    // nearest candidates, a little favouring the ones in front of the camera
    const fwd = K3.view ? K3.view.fwd : _v.set(0, 0, -1);
    const sc = [];
    for (const c of cands) {
      const dx = c.x - camPos.x, dy = c.y - camPos.y, dz = c.z - camPos.z; const d = Math.hypot(dx, dy, dz);
      if (d > 70) continue;
      // lights inside a building only matter when you are in it (or right by its door)
      if (c.b && (!inside || inside.id !== c.b) && d > 14) continue;
      if (!c.b && inside && d > 16) continue;
      // lights already burning get a head start, so they don't swap back and forth as you walk
      sc.push([d * (pool.some((p) => p.c === c) ? 0.8 : 1), c]);
    }
    sc.sort((a, b) => a[0] - b[0]);
    const want = sc.slice(0, pool.length).map((s) => s[1]);
    // keep every light on the lamp it already lights; only free slots take new lamps
    const keep = new Set(); chosen = pool.map((p) => (p.c && want.includes(p.c) ? (keep.add(p.c), p.c) : null));
    let k = 0; for (let i = 0; i < pool.length; i++) if (!chosen[i]) { while (k < want.length && keep.has(want[k])) k++; chosen[i] = want[k++] || null; }
  }
  const t = K3.time;
  // the ground pools fade in with the dark (none by day)
  poolU.uK.value += ((geo.dungeon ? 0.35 : 0.55) * K3.smooth(0.25, 0.8, darkness) - poolU.uK.value) * Math.min(1, dt * 2);
  if (pools) pools.visible = poolU.uK.value > 0.01;
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i], c = chosen[i];
    if (!c || p.c !== c) { p.l.intensity = Math.max(0, p.l.intensity - dt * 20); if (!c) { if (p.l.intensity <= 0) p.c = null; continue; } if (p.l.intensity > 0.05) continue; p.c = c; p.l.position.set(c.x, c.y, c.z); p.l.color.copy(c.col); p.l.distance = c.r; }
    const fl = 1 + Math.sin(t * 2.1 + c.ph) * Math.min(0.05, c.fl * 0.3) + Math.sin(t * 5.3 + c.ph * 2) * Math.min(0.03, c.fl * 0.15);
    const d = Math.hypot(c.x - camPos.x, c.z - camPos.z);
    const fade = 1 - K3.smooth(40, 64, d);
    const want = c.base * 0.5 * (0.15 + 0.85 * darkness) * fl * fade; // warm pools of light, not a glare
    p.l.intensity += (want - p.l.intensity) * Math.min(1, dt * 3);
    if (!Number.isFinite(p.l.intensity)) p.l.intensity = 0;
  }
}

// Kingdom Arena, Payload ("The Reliquary Cart"): the attackers (the south team) escort a war wagon carrying a glowing relic
// along an old stone tramway, from the foot of their courtyard stairs down the middle street, across the plaza and up the
// far street to the shrine below the defenders' courtyard. Like Paladins: the attackers move it by standing near it (a little
// faster with more of them), any defender near it stops it (contested), left alone it rolls back slowly (never past a
// checkpoint), each checkpoint adds time, the defenders win when time runs out (overtime while the attackers still touch it),
// the attackers win when it reaches the shrine. The host runs the cart; everyone else draws it from the host's numbers.
import * as THREE from 'three';
import { G } from './state.js';
import { V } from './vfx.js';
import { S } from './audio.js';

const Y = 3; // the ground level of the Ruins
// the track: the middle street's zig-zag round its collapsed walls (the north half is the south half mirrored)
const HALF = [[0, -61], [1.0, -58.2], [4.6, -56.3], [9.0, -54.4], [10.8, -51.8], [11.3, -48], [10.6, -45.2], [7.4, -43.7], [0, -43.3], [-6.8, -43], [-10.6, -41.2], [-11.3, -37.5], [-11.4, -33.6], [-11, -30.6], [-8.6, -28.4], [-4.6, -26.9], [-1, -24.4], [0, -20], [0, -10]];
export const PATH = [...HALF, [0, 0], ...HALF.slice().reverse().map(([x, z]) => [x, -z])];
export const PAY = { ZONE: 5.2, SPEED: 1.55, PER: 0.16, MAXP: 3, BACK_DELAY: 9, BACK: 0.55, T0: 180, CP_BONUS: 90, CPS: [0.34, 0.67], OT_GRACE: 3.5 };
// the live state (the host's; online clients get it from the host 4 times a second)
export const PL = { on: false, d: 0, len: 1, base: 0, next: 0, time: PAY.T0, push: 0, def: 0, cont: false, idleT: 0, ot: false, otG: 1, state: 'idle', att: 0, dfn: 1, done: false, dShow: 0 };
let SAMP = null, STEP = 0.4; // points every STEP metres: [x, z, tx, tz]
let cart = null, zone = null, root = null, cpMarks = [], wheels = [], relic = null, halo = null, motes = [], flag = null, flagBase = null, lamps = [], creakT = 0, dustT = 0, roll = 0, endMark = null;

// ---------- the track as numbers ----------
function sampleTrack() {
  const curve = new THREE.CatmullRomCurve3(PATH.map(([x, z]) => new THREE.Vector3(x, Y, z)), false, 'centripetal', 0.5);
  const len = curve.getLength(), n = Math.ceil(len / STEP); STEP = len / n; SAMP = [];
  const pts = curve.getSpacedPoints(n);
  for (let i = 0; i <= n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)], tl = Math.hypot(b.x - a.x, b.z - a.z) || 1; SAMP.push([pts[i].x, pts[i].z, (b.x - a.x) / tl, (b.z - a.z) / tl]); }
  PL.len = len; return SAMP;
}
// where the cart is at distance d along the track: { x, z, tx, tz }
export function trackAt(d) { if (!SAMP) sampleTrack(); const f = Math.max(0, Math.min(SAMP.length - 1.0001, d / STEP)), i = Math.floor(f), k = f - i, a = SAMP[i], b = SAMP[i + 1];
  const tx = a[2] + (b[2] - a[2]) * k, tz = a[3] + (b[3] - a[3]) * k, tl = Math.hypot(tx, tz) || 1; return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, tx: tx / tl, tz: tz / tl }; }
export const cartXZ = () => trackAt(PL.d);
export const cpDist = (k) => PAY.CPS[k] * PL.len;

// ---------- the rules (host) ----------
export function payloadReset(att = 0, dfn = 1) { if (!SAMP) sampleTrack(); Object.assign(PL, { on: true, d: 0, base: 0, next: 0, time: PAY.T0, push: 0, def: 0, cont: false, idleT: 0, ot: false, otG: 1, state: 'idle', att, dfn, done: false, dShow: 0 }); for (const m of cpMarks) m.reached = false; }
// fighters: [{ team, x, z }] of the living. Returns events: { cp: k } when a checkpoint is reached, { win: team } at the end
export function payloadTick(dt, fighters) {
  const ev = []; if (!PL.on || PL.done) return ev; const c = trackAt(PL.d); let att = 0, def = 0;
  for (const f of fighters) { if (Math.hypot(f.x - c.x, f.z - c.z) > PAY.ZONE) continue; if (f.team === PL.att) att++; else def++; }
  PL.push = att; PL.def = def; PL.cont = att > 0 && def > 0;
  if (att > 0 && def === 0) { PL.d = Math.min(PL.len, PL.d + PAY.SPEED * (1 + PAY.PER * (Math.min(PAY.MAXP, att) - 1)) * dt); PL.idleT = 0; PL.state = 'push'; }
  else if (att > 0 || def > 0) { PL.idleT = 0; PL.state = PL.cont ? 'contested' : 'blocked'; } // (a defender alone on it holds it where it is)
  else { PL.idleT += dt; if (PL.idleT > PAY.BACK_DELAY && PL.d > PL.base) { PL.d = Math.max(PL.base, PL.d - PAY.BACK * dt); PL.state = 'back'; } else PL.state = 'idle'; }
  while (PL.next < PAY.CPS.length && PL.d >= cpDist(PL.next)) { PL.base = cpDist(PL.next); PL.time += PAY.CP_BONUS; PL.ot = false; PL.otG = 1; ev.push({ cp: PL.next }); PL.next++; }
  if (PL.d >= PL.len - 0.01) { PL.done = true; ev.push({ win: PL.att }); return ev; }
  if (!PL.ot) { PL.time = Math.max(0, PL.time - dt); if (PL.time <= 0) { if (att > 0) { PL.ot = true; PL.otG = 1; } else { PL.done = true; ev.push({ win: PL.dfn }); } } }
  else { if (att > 0) PL.otG = Math.min(1, PL.otG + dt * 2); else { PL.otG -= dt / PAY.OT_GRACE; if (PL.otG <= 0) { PL.done = true; ev.push({ win: PL.dfn }); } } }
  return ev;
}
const STATES = ['idle', 'push', 'contested', 'blocked', 'back'];
export function payloadNet() { return [Math.round(PL.d * 100) / 100, Math.round(PL.time * 10) / 10, STATES.indexOf(PL.state), PL.next, PL.ot ? Math.round(PL.otG * 100) / 100 : -1, PL.push, PL.def]; }
export function payloadApply(q) { if (!q) return; PL.on = true; PL.d = q[0]; PL.time = q[1]; PL.state = STATES[q[2]] || 'idle'; PL.cont = PL.state === 'contested'; for (let k = PL.next; k < q[3]; k++) cpFx(k); PL.next = q[3]; PL.base = PL.next ? cpDist(PL.next - 1) : 0; PL.ot = q[4] >= 0; PL.otG = Math.max(0, q[4]); PL.push = q[5] || 0; PL.def = q[6] || 0; }

// ---------- textures ----------
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
function glowTex() { const [c, g] = canvas(64); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
// a band of carved runes (white on black), tiled round a circle in the shaders
export function runeTex(seed = 3) { const [c, g] = canvas(1024, 96); let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 96); g.strokeStyle = '#fff'; g.lineWidth = 5; g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 8;
  for (let k = 0; k < 16; k++) { const cx = 32 + k * 64, n = 2 + Math.floor(r() * 3); g.beginPath(); g.moveTo(cx, 18); g.lineTo(cx, 78); for (let j = 0; j < n; j++) { const y = 22 + r() * 50, d = (r() < 0.5 ? -1 : 1) * (10 + r() * 12); if (r() < 0.35) { g.moveTo(cx + d, y - 10); g.quadraticCurveTo(cx + d * 1.4, y, cx + d, y + 10); } else { g.moveTo(cx, y); g.lineTo(cx + d, y + (r() - 0.5) * 22); } } g.stroke();
    g.beginPath(); g.arc(cx, 48, 2.5, 0, 7); g.fill(); }
  g.fillStyle = '#fff'; for (let k = 0; k < 16; k++) { g.beginPath(); g.arc(64 + k * 64, 48, 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t; }
// the worn tramway bed: setts and gravel between the rails, darker in the middle where wheels and boots have worn it
function bedTex() { const [c, g] = canvas(256, 512); let s = 9; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#6e6252'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 2600; i++) { const v = 70 + r() * 70 | 0; g.fillStyle = `rgb(${v + 10},${v},${v - 12})`; g.fillRect(r() * 256, r() * 512, 2 + r() * 3, 2 + r() * 3); }
  for (let row = 0; row < 16; row++) for (let col = 0; col < 7; col++) { const x = col * 37 + (row % 2) * 18 - 8, y = row * 32; if (x > 52 && x < 190 && r() < 0.75) continue; const v = 120 + r() * 60 | 0; g.fillStyle = `rgb(${v},${v - 10},${v - 26})`; g.beginPath(); g.roundRect ? g.roundRect(x + 2, y + 2, 32, 27, 6) : g.rect(x + 2, y + 2, 32, 27); g.fill(); g.strokeStyle = 'rgba(40,32,24,.6)'; g.lineWidth = 2; g.stroke(); }
  const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(30,22,14,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  g.globalCompositeOperation = 'destination-in'; const ga = g.createLinearGradient(0, 0, 256, 0); ga.addColorStop(0, 'rgba(0,0,0,0)'); ga.addColorStop(0.12, 'rgba(0,0,0,1)'); ga.addColorStop(0.88, 'rgba(0,0,0,1)'); ga.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = ga; g.fillRect(0, 0, 256, 512);
  const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// a cross-section swept along the track (rails, the bed): shape = [[across, up], ...]
function sweep(shape, off, y0, uvScale = 1) { const P = [], UV = [], I = [], m = shape.length;
  for (let i = 0; i < SAMP.length; i++) { const [x, z, tx, tz] = SAMP[i], nx = tz, nz = -tx; for (let j = 0; j < m; j++) { const [a, u] = shape[j]; P.push(x + nx * (a + off), y0 + u, z + nz * (a + off)); UV.push(j / (m - 1), i * STEP / uvScale); } }
  for (let i = 0; i < SAMP.length - 1; i++) for (let j = 0; j < m - 1; j++) { const a = i * m + j, b = a + m; I.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals(); return g; }

// the soft glowing ring round the cart: a rim, a band of slowly turning runes and a faint ripple inside, in the side's colour
const ZONE_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const ZONE_FS = `uniform float time, k, flick; uniform vec3 col, col2; uniform sampler2D runes; varying vec2 vUv;
void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard; float a = atan(p.y, p.x);
  float rim = smoothstep(0.88, 0.965, r) * (1.0 - smoothstep(0.975, 1.0, r));
  float rim2 = smoothstep(0.705, 0.72, r) * (1.0 - smoothstep(0.72, 0.735, r));
  float band = smoothstep(0.75, 0.765, r) * (1.0 - smoothstep(0.865, 0.88, r));
  float rn = texture2D(runes, vec2(a / 6.2831853 * 3.0 + time * 0.025, (r - 0.755) / 0.12)).r * band;
  float dash = step(0.5, fract(a / 6.2831853 * 48.0 - time * 0.12)) * smoothstep(0.93, 0.95, r) * (1.0 - smoothstep(0.95, 0.965, r));
  float rip = (0.5 + 0.5 * sin(r * 22.0 - time * 2.6)) * (1.0 - smoothstep(0.1, 0.72, r)) * 0.10 + 0.035;
  float fl = 0.5 + 0.5 * sin(time * 22.0 + a * 3.0); vec3 c = mix(col, col2, flick * step(0.5, fl));
  float al = (rim * 0.85 + rim2 * 0.5 + rn * 0.8 + dash * 0.5 + rip) * k;
  gl_FragColor = vec4(c * al, 1.0); }`;
export function zoneMat(runes) { return new THREE.ShaderMaterial({ vertexShader: ZONE_VS, fragmentShader: ZONE_FS, uniforms: { time: { value: 0 }, k: { value: 1 }, flick: { value: 0 }, col: { value: new THREE.Color('#ffffff') }, col2: { value: new THREE.Color('#ff8a30') }, runes: { value: runes } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }); }

// ---------- building it ----------
const SM = (c, r = 0.85, m = 0, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, o));
export function buildPayload(scene, attCol = '#3a8cff', defCol = '#ff4a3a') {
  if (root) { scene.add(root); return root; } if (!SAMP) sampleTrack(); root = new THREE.Group(); root.name = 'payload'; scene.add(root);
  const wood = SM('#6a4a30', 0.9), woodL = SM('#8c6440', 0.85), iron = SM('#3c3a38', 0.45, 0.85), stone = SM('#bdb19c', 0.95), gold = SM('#d8b050', 0.35, 0.9), glowT = glowTex();
  // the bed, then sleepers, the two rails and kerb stones along both sides
  const bed = new THREE.Mesh(sweep([[-1.55, 0.015], [-1.25, 0.05], [1.25, 0.05], [1.55, 0.015]], 0, Y, 6.2), new THREE.MeshStandardMaterial({ map: bedTex(), roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  bed.receiveShadow = true; bed.renderOrder = 1; root.add(bed);
  { const n = Math.floor(PL.len / 0.95), sg = new THREE.BoxGeometry(2.3, 0.12, 0.3), im = new THREE.InstancedMesh(sg, wood, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) { const p = trackAt(i * 0.95 + 0.4); e.set(0, Math.atan2(p.tx, p.tz) + (r() - 0.5) * 0.08, (r() - 0.5) * 0.03); q.setFromEuler(e); m4.compose(new THREE.Vector3(p.x + (r() - 0.5) * 0.08, Y + 0.07, p.z), q, new THREE.Vector3(1 - r() * 0.12, 1, 1)); im.setMatrixAt(i, m4); }
    im.receiveShadow = true; im.castShadow = false; root.add(im); }
  const railShape = [[-0.06, 0], [-0.04, 0.1], [-0.07, 0.11], [-0.07, 0.16], [0.07, 0.16], [0.07, 0.11], [0.04, 0.1], [0.06, 0]];
  for (const o of [-0.78, 0.78]) { const rm = new THREE.Mesh(sweep(railShape, o, Y + 0.12), SM('#5a5450', 0.3, 0.9)); rm.castShadow = true; root.add(rm); }
  { const n = Math.floor(PL.len / 1.25) * 2, gk = new THREE.DodecahedronGeometry(0.24, 0); gk.scale(1.3, 0.55, 1); const im = new THREE.InstancedMesh(gk, SM('#8e8474', 0.95, 0, { flatShading: true }), n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let s = 17; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) { const p = trackAt((i >> 1) * 1.25 + r() * 0.4), sd = i & 1 ? 1 : -1, w = 1.62 + r() * 0.12; q.setFromEuler(new THREE.Euler(0, r() * 6.28, 0)); m4.compose(new THREE.Vector3(p.x + p.tz * w * sd, Y + 0.04, p.z - p.tx * w * sd), q, new THREE.Vector3(0.6 + r() * 0.4, 0.5 + r() * 0.4, 0.6 + r() * 0.3)); im.setMatrixAt(i, m4); }
    im.receiveShadow = true; root.add(im); }
  // checkpoints: a pair of carved waystones with braziers, joined by a band of runes across the track that lights in the attackers' colour once passed
  const runes = runeTex(11); cpMarks = [];
  PAY.CPS.forEach((f, k) => { const p = trackAt(f * PL.len), yaw = Math.atan2(p.tx, p.tz), g = new THREE.Group(); g.position.set(p.x, Y, p.z); g.rotation.y = yaw; root.add(g);
    const fire = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd0a0').multiplyScalar(1.6) }), glow = new THREE.SpriteMaterial({ map: glowT, color: '#ffb060', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.65 });
    for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.1, 6), stone); st.position.set(s * 2.25, 1.05, 0); st.castShadow = true; g.add(st); const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.3, 6), iron); cap.position.set(s * 2.25, 2.2, 0); g.add(cap);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 7), fire); fl.position.set(s * 2.25, 2.55, 0); g.add(fl); const sp = new THREE.Sprite(glow); sp.scale.set(1.8, 1.8, 1); sp.position.set(s * 2.25, 2.55, 0); g.add(sp); }
    const lineM = zoneLine(runes); const ln = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.9), lineM); ln.rotation.x = -Math.PI / 2; ln.position.y = 0.2; g.add(ln);
    cpMarks.push({ g, fire, glow, lineM, reached: false, p }); });
  // the destination: a shrine of two obelisks under a broken arch, a great sigil on the ground in the defenders' colour
  { const p = trackAt(PL.len), g = new THREE.Group(); g.position.set(p.x, Y, p.z); g.rotation.y = Math.atan2(p.tx, p.tz); root.add(g);
    for (const s of [-1, 1]) { const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.55, 4.2, 4), stone); ob.position.set(s * 2.6, 2.1, 0.8); ob.rotation.y = Math.PI / 4; ob.castShadow = true; g.add(ob);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), SM(defCol, 0.2, 0.1, { emissive: defCol, emissiveIntensity: 2.2 })); gem.position.set(s * 2.6, 4.6, 0.8); g.add(gem); }
    const sig = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4), zoneMat(runeTex(23))); sig.rotation.x = -Math.PI / 2; sig.position.set(0, 0.06, 0.6); sig.material.uniforms.col.value.set(defCol); sig.material.uniforms.k.value = 0.8; g.add(sig); endMark = sig; }
  // the cart: a timber war wagon on four iron-shod wheels, a reliquary on its bed holding a great glowing crystal, a lantern at each front corner, the attackers' banner on a pole at the back
  cart = new THREE.Group(); root.add(cart); wheels = [];
  const bx = (w, h, d, m, x, y, z, ry = 0, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); o.castShadow = true; o.receiveShadow = true; cart.add(o); return o; };
  bx(1.7, 0.22, 3.1, wood, 0, 0.92, 0); // the bed
  for (const s of [-1, 1]) { bx(0.12, 0.6, 3.1, woodL, s * 0.86, 1.32, 0); bx(0.16, 0.08, 3.16, iron, s * 0.86, 1.66, 0); for (const z of [-1.2, 0, 1.2]) bx(0.16, 0.64, 0.12, iron, s * 0.87, 1.3, z); }
  for (const s of [-1, 1]) { bx(1.84, 0.6, 0.12, woodL, 0, 1.32, s * 1.55); bx(1.9, 0.08, 0.16, iron, 0, 1.66, s * 1.55); }
  for (const z of [-1.0, 1.0]) { const ax = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 8), iron); ax.rotation.z = Math.PI / 2; ax.position.set(0, 0.65, z); cart.add(ax); }
  bx(0.14, 0.14, 1.5, wood, -0.35, 0.72, 2.3, 0.18); bx(0.14, 0.14, 1.5, wood, 0.35, 0.72, 2.3, -0.18); bx(1.2, 0.14, 0.14, wood, 0, 0.72, 3.0); // the yoke at the front, for pushing and pulling
  { const spokeG = new THREE.BoxGeometry(0.06, 0.86, 0.07), rimG = new THREE.TorusGeometry(0.47, 0.06, 6, 20), tyreG = new THREE.TorusGeometry(0.52, 0.035, 5, 24), hubG = new THREE.CylinderGeometry(0.11, 0.11, 0.24, 10);
    for (const x of [-0.78, 0.78]) for (const z of [-1.0, 1.0]) { const w = new THREE.Group(); w.position.set(x, 0.65, z); cart.add(w); const spin = new THREE.Group(); w.add(spin); spin.rotation.order = 'ZXY';
      const rim = new THREE.Mesh(rimG, woodL); rim.rotation.y = Math.PI / 2; spin.add(rim); const ty = new THREE.Mesh(tyreG, iron); ty.rotation.y = Math.PI / 2; spin.add(ty);
      for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(spokeG, wood); sp.rotation.x = k * Math.PI / 4; spin.add(sp); }
      const hb = new THREE.Mesh(hubG, iron); hb.rotation.z = Math.PI / 2; spin.add(hb); for (const o of spin.children) o.castShadow = true; wheels.push(spin); } }
  // the reliquary and its relic
  bx(1.0, 0.5, 1.2, stone, 0, 1.28, -0.1); bx(1.12, 0.1, 1.32, gold, 0, 1.56, -0.1); for (const [x, z] of [[-0.45, -0.6], [0.45, -0.6], [-0.45, 0.4], [0.45, 0.4]]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), gold); pl.position.set(x, 2.1, z - 0.1 + 0.1); cart.add(pl); }
  { const rf = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.5, 4), gold); rf.rotation.y = Math.PI / 4; rf.position.set(0, 2.85, -0.1); rf.castShadow = true; cart.add(rf); }
  relic = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), SM('#fff4d0', 0.15, 0.1, { emissive: '#ffcf70', emissiveIntensity: 2.4 })); relic.scale.set(0.8, 1.35, 0.8); relic.position.set(0, 2.05, -0.1); cart.add(relic);
  halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: '#ffd890', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 })); halo.scale.set(2.6, 2.6, 1); halo.position.copy(relic.position); cart.add(halo);
  motes = []; for (let k = 0; k < 5; k++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: '#ffe8b0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.scale.set(0.22, 0.22, 1); cart.add(m); motes.push(m); }
  lamps = []; for (const x of [-0.86, 0.86]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6), iron); pole.position.set(x, 2.15, 1.5); cart.add(pole); bx(0.22, 0.3, 0.22, iron, x, 2.75, 1.5);
    const lm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd080').multiplyScalar(1.8) })); lm.position.set(x, 2.75, 1.5); cart.add(lm); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: '#ffb050', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })); sp.scale.set(1.1, 1.1, 1); sp.position.copy(lm.position); cart.add(sp); lamps.push(sp); }
  { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 3.2, 6), wood); pole.position.set(0.6, 2.6, -1.4); pole.castShadow = true; cart.add(pole); const fin = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), gold); fin.position.set(0.6, 4.3, -1.4); cart.add(fin);
    const fg = new THREE.PlaneGeometry(1.1, 1.5, 8, 6); fg.translate(0.55, 0, 0); flagBase = fg.attributes.position.array.slice(); flag = new THREE.Mesh(fg, SM(attCol, 0.85, 0, { side: THREE.DoubleSide })); flag.position.set(0.62, 3.35, -1.4); flag.rotation.y = Math.PI / 2; flag.castShadow = true; cart.add(flag); }
  zone = new THREE.Mesh(new THREE.PlaneGeometry(PAY.ZONE * 2, PAY.ZONE * 2), zoneMat(runes)); zone.rotation.x = -Math.PI / 2; zone.renderOrder = 2; root.add(zone);
  PL.attCol = new THREE.Color(attCol); PL.defCol = new THREE.Color(defCol); PL.dShow = PL.d; payloadView(0);
  return root;
}
// a band of runes across the track at a checkpoint
const LINE_FS = `uniform float time, k; uniform vec3 col; uniform sampler2D runes; varying vec2 vUv;
void main(){ float e = smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.92, 1.0, vUv.x)); float rn = texture2D(runes, vec2(vUv.x * 1.2 + time * 0.03, vUv.y)).r;
  float edge = smoothstep(0.0, 0.1, vUv.y) * (1.0 - smoothstep(0.1, 0.2, vUv.y)) + smoothstep(0.8, 0.9, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y));
  float al = (rn * 0.75 + edge * 0.6) * e * k * (0.8 + 0.2 * sin(time * 2.0)); gl_FragColor = vec4(col * al, 1.0); }`;
function zoneLine(runes) { return new THREE.ShaderMaterial({ vertexShader: ZONE_VS, fragmentShader: LINE_FS, uniforms: { time: { value: 0 }, k: { value: 0.55 }, col: { value: new THREE.Color('#e8dcc0') }, runes: { value: runes } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); }
function cpFx(k) { const m = cpMarks[k]; if (!m || m.reached) return; m.reached = true; m.lineM.uniforms.col.value.copy(PL.attCol || new THREE.Color('#3a8cff')); m.lineM.uniforms.k.value = 1.2; m.glow.color.copy(PL.attCol || new THREE.Color('#3a8cff')); m.glow.opacity = 1;
  const at = new THREE.Vector3(m.p.x, Y + 2.6, m.p.z); V.burst('spark', at, 40, { speed: 6, life: 1.2 }); V.burst('gold', at, 30, { speed: 4, grav: 2, life: 1.6 }); S.fanfare && S.fanfare(G.myTeam === PL.att); }
export function payloadCheckpointFx(k) { cpFx(k); }

// ---------- every frame (everyone): put the cart where the numbers say and animate it ----------
export function payloadView(dt) {
  if (!cart || !PL.on) return; const t = G.time || 0;
  const prev = PL.dShow; PL.dShow += (PL.d - PL.dShow) * Math.min(1, dt * 6); if (Math.abs(PL.d - PL.dShow) > 6) PL.dShow = PL.d; const ds = PL.dShow - prev;
  const p = trackAt(PL.dShow), yaw = Math.atan2(p.tx, p.tz); cart.position.set(p.x, Y + 0.19, p.z); // (the iron tyres ride on the rails)
  { let dy = yaw - cart.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); cart.rotation.y += dy * Math.min(1, dt * 8 + (dt ? 0 : 1)); }
  roll += ds / 0.52; for (const w of wheels) w.rotation.x = roll; cart.rotation.z = Math.abs(ds) > 1e-4 ? Math.sin(t * 9) * 0.008 : 0; // (it rocks a little on the rails)
  relic.position.y = 2.05 + Math.sin(t * 1.6) * 0.08; relic.rotation.y = t * 0.8; halo.position.y = relic.position.y; halo.material.opacity = 0.65 + Math.sin(t * 2.3) * 0.15;
  motes.forEach((m, k) => { const a = t * (0.9 + k * 0.13) + k * 1.26; m.position.set(Math.cos(a) * 0.55, 2.05 + Math.sin(t * 1.3 + k) * 0.35, -0.1 + Math.sin(a) * 0.55); });
  lamps.forEach((l, k) => { l.material.opacity = 0.7 + Math.sin(t * 13 + k * 2) * 0.08 + Math.sin(t * 7.7 + k) * 0.06; });
  if (flag) { const P = flag.geometry.attributes.position; for (let i = 0; i < P.count; i++) { const x0 = flagBase[i * 3], y0 = flagBase[i * 3 + 1], w = x0 / 1.1; P.setZ(i, Math.sin(t * 4.2 + x0 * 3.4 + y0 * 0.8) * 0.12 * w + Math.sin(t * 2.3 + x0 * 2) * 0.05 * w); } P.needsUpdate = true; flag.geometry.computeVertexNormals(); }
  // the ring: the attackers' colour while it rolls, the defenders' while they hold it, flickering orange when both sides are on it
  const U = zone.material.uniforms; U.time.value = t; zone.position.set(p.x, Y + 0.09, p.z);
  const C = PL.state === 'push' ? PL.attCol : PL.state === 'blocked' ? PL.defCol : PL.state === 'contested' ? PL.attCol : PL.state === 'back' ? PL.defCol : null;
  U.col.value.lerp(C || new THREE.Color('#e8e0d0'), Math.min(1, dt * 6 + (dt ? 0 : 1))); U.col2.value.set('#ff8a30'); U.flick.value = PL.state === 'contested' ? 1 : 0; U.k.value = PL.state === 'idle' ? 0.55 + Math.sin(t * 2) * 0.1 : PL.state === 'back' ? 0.7 + Math.sin(t * 6) * 0.2 : 1;
  for (const m of cpMarks) m.lineM.uniforms.time.value = t; if (endMark) endMark.material.uniforms.time.value = t;
  // moving: dust off the wheels and the creak of the axles
  if (Math.abs(ds) > 1e-4 && dt > 0) { const sp = Math.abs(ds) / dt; if ((dustT -= dt) <= 0) { dustT = 0.18; for (const s of [-1, 1]) V.burst('dust', new THREE.Vector3(p.x + p.tz * 0.8 * s - p.tx * (ds > 0 ? 1.1 : -1.1), Y + 0.25, p.z - p.tx * 0.8 * s - p.tz * (ds > 0 ? 1.1 : -1.1)), 2, { speed: 0.8, life: 1.1 }); }
    if ((creakT -= dt) <= 0) { creakT = 1.1 + Math.random() * 0.8 - Math.min(0.5, sp * 0.15); S.cartCreak && S.cartCreak(cart.position, Math.min(1, 0.5 + sp * 0.3)); } }
}
export function payloadClear() { if (root && root.parent) root.parent.remove(root); PL.on = false; }

// ---------- the HUD strip: the track as a bar with its checkpoints, the cart on it, who is on it and the time left ----------
let cssDone = false;
export function payloadHud(col, attName, defName) {
  if (!cssDone) { cssDone = true; const st = document.createElement('style'); st.textContent = `.arpay{position:absolute;top:86px;left:50%;transform:translateX(-50%);width:min(520px,86vw);padding:6px 12px 8px;border-radius:10px;background:rgba(14,10,6,.78);color:#f0e4c8;font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,.4)}
.arpay .pt{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px}.arpay .pt b{font-size:15px}.arpay .pt .tm{font-variant-numeric:tabular-nums;font-weight:700;font-size:16px}.arpay .pt .ot{color:#ffb040;animation:arpfl .5s infinite alternate}
.arpay .tr{position:relative;height:12px;border-radius:6px;background:rgba(255,255,255,.12);overflow:visible}.arpay .fi{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:var(--ac);box-shadow:0 0 10px var(--ac)}
.arpay .cp{position:absolute;top:-4px;width:4px;height:20px;margin-left:-2px;border-radius:2px;background:#f0e4c8;opacity:.85}.arpay .cp.on{background:var(--ac);box-shadow:0 0 6px var(--ac)}.arpay .end{position:absolute;right:-6px;top:-7px;font-size:16px}
.arpay .cart{position:absolute;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:#2a1e12;border:2px solid var(--ac);display:grid;place-items:center;font-size:14px;transition:left .25s linear}.arpay .cart.cont{border-color:#ff8a30;animation:arpfl .25s infinite alternate}.arpay .cart.blk{border-color:var(--dc)}
.arpay .st{margin-top:6px;text-align:center;font-weight:600}.arpay .otb{height:3px;margin-top:4px;background:#ffb040;border-radius:2px}
@keyframes arpfl{from{opacity:1}to{opacity:.45}}`; document.head.appendChild(st); }
  const ac = '#' + PL.attCol.getHexString(), dc = '#' + PL.defCol.getHexString(), f = Math.max(0, Math.min(1, PL.d / PL.len)), r = Math.max(0, PL.time), mm = Math.floor(r / 60), ss = String(Math.floor(r % 60)).padStart(2, '0');
  const st = PL.state === 'push' ? `<span style="color:${ac}">${attName} push${PL.push > 1 ? ` ×${Math.min(PL.push, PAY.MAXP)}` : ''}</span>` : PL.state === 'contested' ? '<span style="color:#ff9a40">Contested!</span>' : PL.state === 'blocked' ? `<span style="color:${dc}">${defName} hold the cart</span>` : PL.state === 'back' ? `<span style="color:${dc}">The cart rolls back</span>` : 'Nobody is with the cart';
  return `<div class="arpay" style="--ac:${ac};--dc:${dc}"><div class="pt"><b>⛓ The Reliquary Cart</b><span>${Math.round(f * 100)}%</span><span class="tm${PL.ot ? ' ot' : ''}">${PL.ot ? 'OVERTIME' : mm + ':' + ss}</span></div>
<div class="tr"><div class="fi" style="width:${(f * 100).toFixed(1)}%"></div>${PAY.CPS.map((c, k) => `<div class="cp${k < PL.next ? ' on' : ''}" style="left:${c * 100}%"></div>`).join('')}<div class="end">🏛</div><div class="cart${PL.state === 'contested' ? ' cont' : PL.state === 'blocked' || PL.state === 'back' ? ' blk' : ''}" style="left:${(f * 100).toFixed(1)}%"><svg viewBox="0 0 24 20" width="18" height="15"><path d="M12 1l2.2 3.6h-4.4z" fill="#ffd870"/><rect x="2" y="6" width="20" height="7" rx="1.2" fill="#b98a52" stroke="#3a2614"/><circle cx="7" cy="15.5" r="3.2" fill="#2a1e12" stroke="#d8c8a8" stroke-width="1.4"/><circle cx="17" cy="15.5" r="3.2" fill="#2a1e12" stroke="#d8c8a8" stroke-width="1.4"/></svg></div></div>
<div class="st">${st}</div>${PL.ot ? `<div class="otb" style="width:${(PL.otG * 100).toFixed(0)}%"></div>` : ''}</div>`;
}

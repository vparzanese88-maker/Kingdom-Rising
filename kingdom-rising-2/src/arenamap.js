// Kingdom Arena: the colosseum. A sand floor ringed by a stone podium wall with four gates, tier after tier of
// stands packed with a cheering crowd, an awning, flags along the rim, statues, braziers and the imperial box.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';
import { addCircle } from './world.js';
import { buildHumanoid } from './character.js';

export const AR = { R: 30, /* a tighter ring: fighters stay close and big on screen */ Y: 3, WALL: 4.6, gates: [], gateBars: [], flagMats: [], crowdMats: [], cheer: 0, time: { value: 0 }, cheerU: { value: 0 }, hill: null, bases: [], braziers: [] };
const TIERS = 15, STEP_H = 1.25, STEP_D = 2.25;
export const COLORS = ['#3a7ae0', '#e04a3a', '#3ac060', '#e0b030', '#a050e0', '#30c0c0', '#e07a30', '#e050a0', '#8a8a8a', '#5a3a1a', '#f0f0f0', '#202020'];
export const COLOR_NAMES = ['Blue', 'Red', 'Green', 'Gold', 'Purple', 'Teal', 'Orange', 'Pink', 'Grey', 'Brown', 'White', 'Black'];

const S = (c, r = 0.85, m = 0, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, o));
const M = {};
function mats() {
  Object.assign(M, {
    sand: S('#c0a06a', 1), sandstone: S('#cdb48c', 0.95), stone: S('#a8977a', 0.95), dark: S('#5a4c3c', 0.95), marble: S('#ece6da', 0.6), marble2: S('#d8cfbf', 0.7),
    seat1: S('#c9b493', 0.95), seat2: S('#b8a280', 0.95), gold: S('#d8b04a', 0.35, 0.85), iron: S('#2e2e32', 0.45, 0.8), wood: S('#6a4a2a', 0.85),
    black: S('#120e0a', 1), floorStone: S('#b4a284', 0.95), red: S('#9a2020', 0.9, 0, { side: THREE.DoubleSide }), cream: S('#efe4c8', 0.95, 0, { side: THREE.DoubleSide }), fire: new THREE.MeshBasicMaterial({ color: '#ffb040' }),
  });
}
const box = (w, h, d, m, x, y, z, parent, ry = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
const cyl = (rt, rb, h, m, x, y, z, parent, seg = 12) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
// the angle (yaw) that faces the arena centre from (x, z)
const faceIn = (x, z) => Math.atan2(-x, -z);

// sand with rake lines and darker patches, drawn once on a canvas
function sandTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#c0a06a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const v = 170 + Math.random() * 60; g.fillStyle = `rgba(${v + 20},${v},${v - 50},0.35)`; g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  g.strokeStyle = 'rgba(150,120,70,0.18)'; g.lineWidth = 2; for (let r = 12; r < 256; r += 9) { g.beginPath(); g.arc(256, 256, r, 0, Math.PI * 2); g.stroke(); }
  for (let i = 0; i < 26; i++) { const x = Math.random() * 512, y = Math.random() * 512, r = 10 + Math.random() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,90,50,0.16)'); gr.addColorStop(1, 'rgba(120,90,50,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function buildColosseum(scene) {
  mats();
  const R = AR.R, Y = AR.Y, W = AR.WALL, root = new THREE.Group(); scene.add(root);
  // ---- the floor: raked sand, a marble centre medallion, the king-of-the-hill ring
  { const f = new THREE.Mesh(new THREE.CircleGeometry(R + 0.7, 128), new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 })); f.rotation.x = -Math.PI / 2; f.position.y = Y + 0.03; f.receiveShadow = true; root.add(f);
    for (const [r0, r1, m] of [[6.6, 7.2, M.gold], [5.4, 6.6, M.floorStone], [5.1, 5.4, M.dark], [0, 1.6, M.floorStone]]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 96), m); ring.rotation.x = -Math.PI / 2; ring.position.y = Y + 0.05; ring.receiveShadow = true; root.add(ring); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rr = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 3.4), M.floorStone); rr.rotation.x = -Math.PI / 2; rr.rotation.z = -a; rr.position.set(Math.sin(a) * 3.4, Y + 0.05, Math.cos(a) * 3.4); root.add(rr); }
    const hill = new THREE.Mesh(new THREE.RingGeometry(6.6, 7.2, 96), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); hill.rotation.x = -Math.PI / 2; hill.position.y = Y + 0.08; root.add(hill); AR.hill = hill; }
  // ---- the podium wall, its marble rim and a parapet
  { const GAP = 0.19, wm = M.stone.clone(), bm = M.marble2.clone(); wm.side = bm.side = THREE.BackSide; // (open at the four gates, so you can see through the bars into the holding rooms)
    for (let i = 0; i < 4; i++) { const t0 = i * Math.PI / 2 + GAP / 2, tl = Math.PI / 2 - GAP;
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.7, R + 0.7, W, 40, 1, true, t0, tl), wm); wall.position.y = Y + W / 2; wall.receiveShadow = true; root.add(wall);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.55, R + 0.55, 0.7, 40, 1, true, t0, tl), bm); base.position.y = Y + 0.35; root.add(base);
      const over = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.7, R + 0.7, W - 4.1, 6, 1, true, t0 - GAP, GAP), wm); over.position.y = Y + 4.1 + (W - 4.1) / 2; root.add(over); }
    const rim = new THREE.Mesh(new THREE.RingGeometry(R + 0.4, R + 1.8, 160), M.marble); rim.rotation.x = -Math.PI / 2; rim.position.y = Y + W + 0.02; root.add(rim);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.4, R + 0.4, 0.35, 160, 1, true), M.marble.clone()); lip.material.side = THREE.BackSide; lip.position.y = Y + W - 0.1; root.add(lip);
    const par = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.5, R + 0.5, 1.0, 160, 1, true), M.marble2.clone()); par.material.side = THREE.DoubleSide; par.position.y = Y + W + 0.5; root.add(par);
    for (let i = 0; i < 260; i++) { const a = i / 260 * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a * 4), Math.cos(a * 4))) / 4 < 0.115) continue; addCircle(Math.sin(a) * (R + 1.3), Math.cos(a) * (R + 1.3), 1.0); } } // (the gates stay passable: the holding rooms keep you in until they open)
  // ---- four great gates, each with a dark tunnel, a marble arch, gold trim and a raised portcullis
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, x = Math.sin(a) * (R + 0.45), z = Math.cos(a) * (R + 0.45), g = new THREE.Group(); g.position.set(x, Y, z); g.rotation.y = faceIn(x, z); root.add(g);
    for (const sx of [-1, 1]) { box(0.9, 4.6, 0.8, M.marble, sx * 3.05, 2.3, -0.2, g); box(1.1, 0.4, 1.0, M.gold, sx * 3.05, 4.65, -0.2, g); }
    box(7.0, 0.7, 0.9, M.marble, 0, 4.45, -0.2, g); box(7.2, 0.18, 1.0, M.gold, 0, 4.85, -0.2, g);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.3, 8, 24, Math.PI), M.marble); arch.position.set(0, 2.0, -0.05); g.add(arch);
    const bars = new THREE.Group(); for (let k = 0; k < 9; k++) cyl(0.05, 0.05, 4.0, M.iron, -2.2 + k * 0.55, 2.0, -0.35, bars, 6); for (const y of [0.8, 2.0, 3.2]) box(5.0, 0.1, 0.1, M.iron, 0, y, -0.35, bars); g.add(bars); AR.gateBars.push(bars);
    // a banner in team colour hangs over each gate
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.2, 2, 6), S(COLORS[i], 0.9, 0, { side: THREE.DoubleSide })); ban.position.set(0, 6.9, -0.7); g.add(ban); AR.gates.push({ a, x: Math.sin(a) * (R - 3.5), z: Math.cos(a) * (R - 3.5), banner: ban });
    const em = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), M.gold); em.position.set(0, 7.3, -0.72); em.rotation.y = Math.PI; g.add(em);
    // statues flank the gate on the podium
    for (const sx of [-1, 1]) statue(g, sx * 3.05, 5.05, -0.3, i * 2 + (sx > 0 ? 1 : 0));
  }
  for (let i = 0; i < 4; i++) holdingRoom(root, i);
  arenaProps(root);
  // ---- marble pilasters along the podium wall, with a torch in an iron bracket between every few
  { const N = 48, pil = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, W, 0.32), M.marble2, N), cap = new THREE.InstancedMesh(new THREE.BoxGeometry(0.75, 0.22, 0.45), M.marble, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    let n = 0; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2 + 0.065; if (AR.gates.some(g => Math.abs(Math.atan2(Math.sin(a - g.a), Math.cos(a - g.a))) < 0.17)) continue; const r = R + 0.62;
      q.setFromAxisAngle(up, a); m4.compose(new THREE.Vector3(Math.sin(a) * r, Y + W / 2, Math.cos(a) * r), q, one); pil.setMatrixAt(n, m4); m4.compose(new THREE.Vector3(Math.sin(a) * (r - 0.05), Y + W - 0.1, Math.cos(a) * (r - 0.05)), q, one); cap.setMatrixAt(n, m4); n++;
      if (i % 4 === 2) { const tx = Math.sin(a) * (R + 0.35), tz = Math.cos(a) * (R + 0.35), tg = new THREE.Group(); tg.position.set(tx, Y + 2.9, tz); root.add(tg);
        cyl(0.05, 0.09, 0.45, M.iron, 0, 0, 0, tg, 6); const cup = cyl(0.13, 0.07, 0.16, M.iron, 0, 0.28, 0, tg, 8); cup.castShadow = false;
        const fl = []; for (let k = 0; k < 2; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.11 - k * 0.04, 0.42 + k * 0.1, 7), new THREE.MeshBasicMaterial({ color: ['#ff7a20', '#ffe090'][k], transparent: true, opacity: 0.9 - k * 0.2, blending: THREE.AdditiveBlending, depthWrite: false })); c.position.y = 0.55 + k * 0.03; tg.add(c); fl.push(c); }
        AR.braziers.push({ g: tg, fl, x: tx, z: tz }); } }
    pil.count = n; cap.count = n; pil.castShadow = true; root.add(pil, cap); }
  // ---- banners down the podium wall between the gates
  for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * Math.PI * 2; if (i % 4 === 1 || i % 4 === 2) { const r = R + 0.55, b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.4, 1, 4), i % 2 ? M.red : S('#1e3a7a', 0.9, 0, { side: THREE.DoubleSide })); b.position.set(Math.sin(a) * r, Y + W - 1.9, Math.cos(a) * r); b.rotation.y = faceIn(b.position.x, b.position.z); root.add(b);
      const t = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.18), M.gold); t.position.copy(b.position).setY(Y + W - 0.25); t.rotation.y = b.rotation.y; t.position.x *= 0.999; t.position.z *= 0.999; root.add(t);
      const e = new THREE.Mesh(new THREE.CircleGeometry(0.34, 16), M.gold); e.position.copy(b.position).setY(Y + W - 1.6); e.rotation.y = b.rotation.y; e.position.x *= 0.998; e.position.z *= 0.998; root.add(e); } }
  // ---- the stands: tier after tier of stone seats, one mesh
  const rowR = [], rowY = [];
  { const parts = [], cols = []; let r = R + 1.8, y = Y + W + 0.6;
    const push = (geo, c) => { const n = geo.attributes.position.count, col = new Float32Array(n * 3), cc = new THREE.Color(c); for (let i = 0; i < n; i++) { col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; } geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(geo.toNonIndexed ? geo : geo); };
    for (let t = 0; t < TIERS; t++) {
      const riser = new THREE.CylinderGeometry(r, r, STEP_H, 160, 1, true); riser.translate(0, y + STEP_H / 2, 0); push(riser, t % 5 === 4 ? '#e8e0d0' : '#b8a280');
      const tread = new THREE.RingGeometry(r, r + STEP_D, 160, 1); tread.rotateX(-Math.PI / 2); tread.translate(0, y + STEP_H, 0); push(tread, t % 5 === 4 ? '#ece6da' : t % 2 ? '#c9b493' : '#d2bd9c');
      rowR.push(r + 0.7); rowY.push(y + STEP_H); r += STEP_D; y += STEP_H;
    }
    const geo = mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p)); geo.computeVertexNormals();
    const st = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide })); st.receiveShadow = true; root.add(st);
    AR.topR = r; AR.topY = y;
    // stairways: lighter stripes running up the stands
    for (let i = 0; i < 24; i++) { const a = (i + 0.25) / 24 * Math.PI * 2; for (let t = 0; t < TIERS; t++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, STEP_D), M.marble2); s.position.set(Math.sin(a) * (rowR[t] + 0.4), rowY[t] + 0.06, Math.cos(a) * (rowR[t] + 0.4)); s.rotation.y = a; root.add(s); } }
  }
  // ---- the outer wall and a colonnade along the top
  { const r = AR.topR + 0.4, h = AR.topY + 6 - Y;
    const out = new THREE.Mesh(new THREE.CylinderGeometry(r + 1.2, r + 1.6, h + 2, 160, 1, true), M.sandstone.clone()); out.material.side = THREE.DoubleSide; out.position.y = Y - 1 + (h + 2) / 2; root.add(out);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.2, r + 0.2, 7, 160, 1, true), M.sandstone.clone()); back.material.side = THREE.BackSide; back.position.y = AR.topY + 3.5; root.add(back);
    const N = 72, col = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.38, 5.6, 10), M.marble, N), m4 = new THREE.Matrix4();
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; m4.makeTranslation(Math.sin(a) * (r - 0.9), AR.topY + 2.8, Math.cos(a) * (r - 0.9)); col.setMatrixAt(i, m4); } col.castShadow = true; root.add(col);
    const roof = new THREE.Mesh(new THREE.RingGeometry(r - 1.8, r + 1.7, 160), M.marble2); roof.rotation.x = Math.PI / 2; roof.position.y = AR.topY + 5.7; root.add(roof);
    const roofTop = new THREE.Mesh(new THREE.RingGeometry(r - 1.8, r + 1.7, 160), M.sandstone); roofTop.rotation.x = -Math.PI / 2; roofTop.position.y = AR.topY + 5.75; root.add(roofTop);
    const cor = new THREE.Mesh(new THREE.CylinderGeometry(r - 1.8, r - 1.8, 0.6, 160, 1, true), M.gold.clone()); cor.material.side = THREE.BackSide; cor.position.y = AR.topY + 5.5; root.add(cor);
    // arches on the outside, three storeys
    const ag = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 4.2, 0.4), M.black, 64 * 3);
    let k = 0; for (let s = 0; s < 3; s++) for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2, rr = r + 1.35 + (2 - s) * 0.07; m4.makeRotationY(a); m4.setPosition(Math.sin(a) * rr, Y + 3 + s * (h / 3), Math.cos(a) * rr); ag.setMatrixAt(k++, m4); } root.add(ag);
    AR.rimR = r; }
  // ---- the awning (velarium): sails from the rim out over the upper stands
  { const r0 = AR.topR + 0.4, r1 = AR.topR - 13, y0 = AR.topY + 7.5, y1 = AR.topY + 3.2, N = 40;
    for (let i = 0; i < N; i++) { if (i % 10 === 0 || i % 10 === 5) continue; const a0 = i / N * Math.PI * 2, a1 = (i + 0.92) / N * Math.PI * 2;
      const g = new THREE.BufferGeometry(); const P = [[r0, y0, a0], [r0, y0, a1], [r1, y1, a1], [r1, y1, a0]].map(([rr, yy, aa]) => [Math.sin(aa) * rr, yy, Math.cos(aa) * rr]);
      g.setAttribute('position', new THREE.Float32BufferAttribute([...P[0], ...P[1], ...P[2], ...P[0], ...P[2], ...P[3]], 3)); g.computeVertexNormals();
      const s = new THREE.Mesh(g, i % 2 ? M.red : M.cream); s.castShadow = true; root.add(s); }
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; cyl(0.12, 0.15, 10, M.wood, Math.sin(a) * (AR.topR + 0.9), AR.topY + 4, Math.cos(a) * (AR.topR + 0.9), root, 6); } }
  // ---- flags on the rim, waving
  { const fm = []; for (let c = 0; c < 6; c++) { const m = S(['#9a2020', '#d8b04a', '#1e3a7a', '#efe4c8', '#3a7a3a', '#6a2a7a'][c], 0.9, 0, { side: THREE.DoubleSide }); wave(m); fm.push(m); AR.flagMats.push(m); }
    const geo = new THREE.PlaneGeometry(3.2, 1.9, 10, 3); geo.translate(1.6, 0, 0);
    for (let i = 0; i < 32; i++) { const a = (i + 0.5) / 32 * Math.PI * 2, x = Math.sin(a) * (AR.rimR + 0.9), z = Math.cos(a) * (AR.rimR + 0.9), top = AR.topY + 14;
      cyl(0.08, 0.1, 9, M.iron, x, top - 4.5, z, root, 6); const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), M.gold); ball.position.set(x, top + 0.1, z); root.add(ball);
      const f = new THREE.Mesh(geo, fm[i % fm.length]); f.position.set(x, top - 1.2, z); f.rotation.y = a + Math.PI / 2; root.add(f); } }
  // ---- the imperial box above the north gate
  { const a = Math.PI, x = Math.sin(a) * (R + 4.5), z = Math.cos(a) * (R + 4.5), g = new THREE.Group(); g.position.set(x, Y + W + 0.6, z); g.rotation.y = faceIn(x, z); root.add(g);
    box(12, 0.4, 7, M.marble, 0, 0.2, 0, g); for (const sx of [-5.6, -1.9, 1.9, 5.6]) { cyl(0.3, 0.34, 5, M.marble, sx, 2.7, 3.1, g, 12); cyl(0.42, 0.42, 0.3, M.gold, sx, 5.3, 3.1, g, 12); }
    box(13, 0.5, 7.6, M.gold, 0, 5.6, 0, g); const roof = box(13.4, 0.3, 8, M.red, 0, 6.0, 0, g); roof.rotation.x = 0.06;
    box(1.4, 2.2, 1, M.gold, 0, 1.5, -1.8, g); box(1.6, 0.4, 1.4, M.red, 0, 0.8, -1.6, g);
    const dr = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.6, 1, 2), M.red); dr.position.set(0, -1.1, 3.55); g.add(dr); const tr = box(10.2, 0.25, 0.05, M.gold, 0, 0.1, 3.58, g); tr.castShadow = false; }
  // ---- braziers around the sand
  for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * Math.PI * 2; if (i % 3 === 1) continue; const x = Math.sin(a) * (R - 1.4), z = Math.cos(a) * (R - 1.4), g = new THREE.Group(); g.position.set(x, Y, z); root.add(g);
    cyl(0.35, 0.45, 1.6, M.marble, 0, 0.8, 0, g, 10); cyl(0.75, 0.35, 0.5, M.iron, 0, 1.85, 0, g, 14); const coal = cyl(0.62, 0.62, 0.08, new THREE.MeshStandardMaterial({ color: '#ff5a10', emissive: '#ff4a00', emissiveIntensity: 2 }), 0, 2.08, 0, g, 14); coal.castShadow = false;
    const fl = []; for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.35 - k * 0.08, 1.1 + k * 0.25, 8), new THREE.MeshBasicMaterial({ color: ['#ff6a10', '#ffa030', '#ffe080'][k], transparent: true, opacity: 0.85 - k * 0.15, blending: THREE.AdditiveBlending, depthWrite: false })); c.position.y = 2.5 + k * 0.1; g.add(c); fl.push(c); }
    AR.braziers.push({ g, fl, x, z }); addCircle(x, z, 0.7); }
  buildCrowd(root, rowR, rowY);
  AR.root = root;
  return root;
}
// marble statues of heroes, each in a different pose
function statue(parent, x, y, z, i) {
  const ch = buildHumanoid({ race: ['human', 'dwarf', 'highelf', 'orc', 'barbarian', 'woodelf', 'human', 'darkelf'][i % 8], sex: i % 3 === 1 ? 'f' : 'm', cls: ['warrior', 'paladin', 'wizard', 'berserker', 'ranger', 'cleric', 'monk', 'rogue'][i % 8], outfit: 'warrior' });
  const mat = M.marble; ch.root.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = true; } });
  const ped = new THREE.Group(); ped.position.set(x, y, z); parent.add(ped);
  box(0.9, 0.5, 0.9, M.marble2, 0, 0.25, 0, ped); ch.root.position.y = 0.5; ch.root.scale.setScalar(1.35); ch.root.rotation.y = Math.PI; ped.add(ch.root);
  try { const A = ch.arms; A.R.sh.rotation.x = -2.7; A.R.el.rotation.x = -0.3; if (i % 2) { A.L.sh.rotation.z = 0.35; A.L.sh.rotation.x = -0.4; } } catch (e) { /* older rigs */ }
}
// the vertex shader that makes flags wave (each flag out of step with the next)
function wave(m) {
  m.onBeforeCompile = (sh) => { sh.uniforms.time = AR.time;
    sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = modelMatrix[3][0] * 0.37 + modelMatrix[3][2] * 0.23; float k = position.x / 3.2;
      transformed.z += sin(time * 4.2 + position.x * 2.2 + ph) * 0.32 * k; transformed.y += sin(time * 3.1 + position.x * 1.7 + ph) * 0.1 * k;`); };
}
// the crowd: thousands of spectators on the tiers, swaying, jumping up when blood is spilled
function buildCrowd(root, rowR, rowY) {
  const body = new THREE.BoxGeometry(0.44, 0.62, 0.3); body.translate(0, 0.31, 0);
  const head = new THREE.SphereGeometry(0.14, 8, 6); head.translate(0, 0.78, 0);
  const arms = new THREE.BoxGeometry(0.62, 0.12, 0.12); arms.translate(0, 0.52, 0);
  const pts = [];
  for (let t = 0; t < rowR.length; t++) { const r = rowR[t], n = Math.floor(Math.PI * 2 * r / 0.66);
    for (let i = 0; i < n; i++) { const a = (i + (t % 2) * 0.5) / n * Math.PI * 2; const deg = ((a / (Math.PI * 2)) * 24) % 1; if (deg > 0.2 && deg < 0.32) continue; // the stairways
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.17 && t < 4) continue; // under the imperial box
      if (Math.random() < 0.14) continue; pts.push([Math.sin(a) * r, rowY[t], Math.cos(a) * r, a]); } }
  const N = pts.length, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
  const mk = (geo, mat) => { const im = new THREE.InstancedMesh(geo, mat, N); im.frustumCulled = false; root.add(im); return im; };
  const cheerMat = () => { const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }); m.onBeforeCompile = (sh) => { sh.uniforms.time = AR.time; sh.uniforms.cheer = AR.cheerU;
    sh.vertexShader = 'uniform float time; uniform float cheer;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]); float ph = ip.x * 1.7 + ip.z * 1.3;
      float sway = sin(time * 1.6 + ph) * 0.05; float hop = max(0.0, sin(time * (6.0 + fract(ph) * 3.0) + ph)) * (0.06 + cheer * 0.38);
      transformed.y += hop; transformed.x += sway;`); }; AR.crowdMats.push(m); return m; };
  const B = mk(body, cheerMat()), H = mk(head, cheerMat()), A = mk(arms, cheerMat());
  const CLOTH = ['#9a2020', '#2a4a8a', '#3a6a3a', '#d8b04a', '#e6dcc4', '#6a2a7a', '#c86a30', '#3a3a3a', '#7a5a3a', '#e0e0e0', '#2a8a9a', '#a04a6a'];
  const SKIN = ['#f2d0b4', '#e0ac85', '#c08e68', '#8a6448', '#f8e0cc', '#d4a882'];
  for (let i = 0; i < N; i++) { const [x, y, z, a] = pts[i]; q.setFromAxisAngle(up, a + Math.PI); m4.compose(new THREE.Vector3(x, y, z), q, one); B.setMatrixAt(i, m4); H.setMatrixAt(i, m4);
    const armsUp = Math.random() < 0.18; if (armsUp) { const m2 = m4.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.38, 0)).multiply(new THREE.Matrix4().makeScale(0.8, 1, 1)); A.setMatrixAt(i, m2); } else A.setMatrixAt(i, m4);
    c.set(CLOTH[(Math.random() * CLOTH.length) | 0]); c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.12); B.setColorAt(i, c); A.setColorAt(i, c); c.set(SKIN[(Math.random() * SKIN.length) | 0]); H.setColorAt(i, c); }
  for (const im of [B, H, A]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  AR.crowdN = N;
}
// every frame: flags wave, the crowd cheers, braziers flicker, gates lift
export function updateColosseum(dt) {
  AR.time.value += dt; AR.cheer = Math.max(0, AR.cheer - dt * 0.35); AR.cheerU.value += (Math.min(1, AR.cheer) - AR.cheerU.value) * Math.min(1, dt * 4);
  for (const b of AR.braziers) b.fl.forEach((c, k) => { const s = 0.85 + Math.sin(AR.time.value * (9 + k * 3) + b.x) * 0.12 + Math.random() * 0.06; c.scale.set(s, s * (1 + k * 0.1), s); });
  const open = AR.gatesOpen ? 1 : 0; for (const bars of AR.gateBars) bars.position.y += ((open ? 4.1 : 0) - bars.position.y) * Math.min(1, dt * 1.5);
}
export function cheer(k = 1) { AR.cheer = Math.min(2, AR.cheer + k); }

// ---- a holding room behind each gate: a vaulted stone cell, torch-lit, where a team waits (and buffs) for the gate to lift
export const ROOM = { near: 1.1, far: 11.4, half: 3.6, H: 4.4 }; // along the gate's axis from the wall at R, and half its width
function holdingRoom(root, i) {
  const R = AR.R, Y = AR.Y, a = i * Math.PI / 2, g = new THREE.Group(); g.position.set(Math.sin(a) * R, Y, Math.cos(a) * R); g.rotation.y = a; root.add(g); // local +z runs out, away from the sand
  const rock = S('#6e6252', 0.95), rockD = S('#4a4036', 1), flag = S('#3c342a', 0.95), L = ROOM.far + 0.4, W2 = ROOM.half + 0.4, H = ROOM.H, zc = L / 2 + 0.2;
  box(W2 * 2, 0.12, L, flag, 0, 0.0, zc, g);
  for (let k = 0; k < 9; k++) box(W2 * 2 - 0.1, 0.02, 0.05, rockD, 0, 0.07, 1 + k * 1.2, g); // flagstone joints
  for (const sx of [-1, 1]) box(0.5, H, L, rock, sx * (W2 + 0.2), H / 2, zc, g);
  box(W2 * 2 + 1, H, 0.5, rock, 0, H / 2, L + 0.4, g);
  box(W2 * 2 + 1, 0.4, L, rockD, 0, H + 0.2, zc, g);
  // heavy timber beams and stone arches along the vault
  for (let k = 0; k < 4; k++) { const z = 1.8 + k * 2.8; box(W2 * 2, 0.3, 0.35, M.wood, 0, H - 0.15, z, g); for (const sx of [-1, 1]) box(0.45, H, 0.5, rockD, sx * (W2 - 0.05), H / 2, z, g); }
  // torches on the walls (one warm light per room)
  const fireM = new THREE.MeshBasicMaterial({ color: '#ffb050', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const [sx, z] of [[-1, 3.2], [1, 3.2], [-1, 8.6], [1, 8.6]]) { const t = new THREE.Group(); t.position.set(sx * (W2 - 0.15), 2.5, z); g.add(t); cyl(0.04, 0.07, 0.4, M.iron, 0, 0, 0, t, 6); const f = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.36, 7), fireM); f.position.y = 0.36; t.add(f); AR.braziers.push({ g: t, fl: [f], x: 0, z: 0 }); }
  const lt = new THREE.PointLight('#ff9a50', 14, 14, 1.6); lt.position.set(0, 3.2, 6); g.add(lt);
  // a team banner on the back wall, weapon racks, barrels, a bench, chains, straw
  const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.8), S(COLORS[i], 0.9, 0, { side: THREE.DoubleSide })); ban.position.set(0, 2.3, L + 0.13); ban.rotation.y = Math.PI; g.add(ban); AR.gates[i] && (AR.gates[i].roomBanner = ban);
  for (const sx of [-1, 1]) { const r = new THREE.Group(); r.position.set(sx * (W2 - 0.35), 0, 6); r.rotation.y = -sx * Math.PI / 2; g.add(r); box(1.6, 0.08, 0.12, M.wood, 0, 1.6, 0, r); box(1.6, 0.08, 0.12, M.wood, 0, 0.4, 0, r); for (const x of [-0.75, 0.75]) box(0.1, 1.8, 0.12, M.wood, x, 0.9, 0, r);
    for (let k = 0; k < 4; k++) { const sp = cyl(0.02, 0.02, 1.9, M.wood, -0.5 + k * 0.33, 1.0, 0.08, r, 5); sp.rotation.z = 0.08; const tip = cyl(0.0, 0.05, 0.22, M.iron, -0.5 + k * 0.33 + 0.08, 2.0, 0.08, r, 5); } }
  for (const [x, z] of [[-2.6, 10.2], [-1.9, 10.6], [2.7, 10.0]]) { const b = cyl(0.36, 0.33, 0.85, M.wood, x, 0.43, z, g, 12); for (const y of [0.15, 0.7]) cyl(0.375, 0.375, 0.05, M.iron, x, y, z, g, 12); }
  box(2.2, 0.12, 0.45, M.wood, 2.6, 0.5, 3.4, g, Math.PI / 2); for (const dz of [-0.9, 0.9]) box(0.4, 0.5, 0.12, M.wood, 2.6, 0.25, 3.4 + dz, g);
  for (let k = 0; k < 3; k++) { const c = cyl(0.03, 0.03, 1.4, M.iron, -1 + k, H - 0.7, 9.6, g, 4); c.castShadow = false; }
  for (let k = 0; k < 6; k++) { const st = new THREE.Mesh(new THREE.ConeGeometry(0.5 + Math.random() * 0.3, 0.25, 7), S('#b89a50', 1)); st.position.set(-3 + Math.random() * 1.4, 0.12, 1.5 + Math.random() * 2); g.add(st); }
}
// ---- the sand: stone pillars to fight around (two of them broken), weapon racks against the wall, urns
export const PILLARS = [];
function arenaProps(root) {
  const R = AR.R, Y = AR.Y;
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8, r = k % 2 ? 17 : 13.5, x = Math.sin(a) * r, z = Math.cos(a) * r, broken = k === 2 || k === 5, h = broken ? 2.2 + (k % 3) * 0.5 : 5.2;
    const g = new THREE.Group(); g.position.set(x, Y, z); g.rotation.y = a; root.add(g);
    box(1.6, 0.4, 1.6, M.marble2, 0, 0.2, 0, g); box(1.35, 0.25, 1.35, M.marble, 0, 0.52, 0, g);
    const sh = cyl(0.52, 0.58, h, M.marble2, 0, 0.65 + h / 2, 0, g, 16);
    for (let f = 0; f < 12; f++) { const fa = f / 12 * Math.PI * 2, fl = box(0.06, h, 0.06, M.marble, Math.sin(fa) * 0.55, 0.65 + h / 2, Math.cos(fa) * 0.55, g); fl.castShadow = false; }
    if (!broken) { box(1.3, 0.3, 1.3, M.marble, 0, 0.65 + h + 0.15, 0, g); box(1.15, 0.18, 1.15, M.gold, 0, 0.65 + h + 0.39, 0, g); }
    else for (let c = 0; c < 3; c++) { const ch = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + Math.random() * 0.2, 0), M.marble2); ch.position.set(Math.sin(a + c * 2) * 1.4, Y + 0.25, Math.cos(a + c * 2) * 1.4).add(g.position).setY(Y + 0.25); ch.castShadow = true; root.add(ch); }
    addCircle(x, z, 0.75); PILLARS.push({ x, z, r: 0.85 }); }
  // weapon racks and urns along the wall between the gates
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 4 + (k % 2 ? 0.2 : -0.2), r = R - 0.9, g = new THREE.Group(); g.position.set(Math.sin(a) * r, Y, Math.cos(a) * r); g.rotation.y = a + Math.PI; root.add(g);
    if (k % 2) { for (const x of [-0.7, 0.7]) box(0.1, 1.5, 0.1, M.wood, x, 0.75, 0, g); box(1.6, 0.08, 0.1, M.wood, 0, 1.3, 0, g); for (let w = 0; w < 3; w++) { const sw = box(0.07, 1.2, 0.02, S('#c8ccd2', 0.3, 0.9), -0.4 + w * 0.4, 0.75, 0.08, g); sw.rotation.z = 0.06; } const shd = cyl(0.42, 0.42, 0.08, S(COLORS[k % 4], 0.8), 0.95, 0.6, 0.15, g, 16); shd.rotation.x = Math.PI / 2 - 0.2; }
    else for (const [x, s2] of [[-0.5, 1], [0.35, 0.8], [0.9, 0.65]]) { const u = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s2, 12, 8), S('#a85a30', 0.8)); u.scale.y = 1.3; u.position.set(x, 0.42 * s2, 0); u.castShadow = true; g.add(u); cyl(0.12 * s2, 0.18 * s2, 0.25 * s2, S('#a85a30', 0.8), x, 0.85 * s2, 0, g, 10); } }
}

// Kingdom Arena, Ruins of Aldermere: set dressing that is only for looks. Nothing here has a collider or sits where anyone walks
// as an obstacle: on the paths there is only flat ground detail (cracks, damp, moss, fallen leaves, puddles); plants grow only off
// the lanes and at the foot of walls; strings of lanterns, pennants and washing hang well above head height; smoke and dust drift
// in the air; and far off, beyond the walls, a ring of hazy mountains and a castle on a hill give the town a skyline.
// Cost: about ten draw calls in all (merged meshes and two Points clouds animated in the shader), and no per-frame CPU work.
import * as THREE from 'three';
import { world } from './world.js';
import { AR } from './arenamap.js';
import { RUINS } from './ruinsmap.js';

const Y = 3; // ground level
let seedV = 1; const rr = () => (seedV = (seedV * 16807) % 2147483647) / 2147483647;
const seedR = (s) => { seedV = s; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

// ---- where things may go ----
let SEGS = [];
function laneD(x, z) { let d = 1e9; for (const [ax, az, bx, bz] of SEGS) { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)); const e = Math.hypot(x - ax - dx * t, z - az - dz * t); if (e < d) d = e; } return d; }
// anything solid standing on level h within pad of (x, z)?
function blocked(x, z, pad, h = Y) { for (const c of world.colliders) { if (c.on === false) continue;
  if (c.t === 'c') { if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true; continue; }
  if (!(c.y0 < h + 1.6 && c.y1 > h + 0.15)) continue; const dx = x - c.x, dz = z - c.z; if (Math.abs(dx * c.cos - dz * c.sin) < c.hw + pad && Math.abs(dx * c.sin + dz * c.cos) < c.hd + pad) return true; } return false; }
// the flat level at (x, z): the ground, the courtyards (4 m) or the rampart walk (9 m); null on stairs, ramps, roofs and floors
function levelAt(x, z) { let h = Y; for (const s of world.surfaces) { const dx = x - s.x, dz = z - s.z; if (Math.abs(dx * s.cos - dz * s.sin) > s.hw + 0.3 || Math.abs(dx * s.sin + dz * s.cos) > s.hd + 0.3) continue;
    if (s.ramp || s.slope) return null; if (s.y > h) h = s.y; }
  return (h < Y + 0.3 || Math.abs(h - (Y + 4)) < 0.15 || Math.abs(h - (Y + 9)) < 0.15) ? h : null; }
const inMosaic = (x, z) => Math.hypot(x, z) < 11;

// ---- quads into one merged geometry ----
class Batch { constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; }
  // a flat quad on the ground (centre x,z at height y), size w x d, turned by a, uv cell [u0, v0, u1, v1]
  flat(x, y, z, w, d, a, cell) { const c = Math.cos(a), s = Math.sin(a), P = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [x + u * c + v * s, y, z - u * s + v * c]);
    const U = [[cell[0], cell[1]], [cell[2], cell[1]], [cell[2], cell[3]], [cell[0], cell[3]]];
    for (const i of [0, 2, 1, 0, 3, 2]) { this.p.push(...P[i]); this.n.push(0, 1, 0); this.uv.push(...U[i]); } }
  // a triangle (any orientation), with a colour
  tri(a, b, c, col, uv = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]) { this.p.push(...a, ...b, ...c); const n = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c), new THREE.Vector3(...a))).normalize(); for (let i = 0; i < 3; i++) { this.n.push(n.x, n.y, n.z); this.c.push(col.r, col.g, col.b); } this.uv.push(...uv); }
  quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); }
  // a thin square beam from a to b (ropes)
  beam(a, b, r, col) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A).normalize(), up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), u = new THREE.Vector3().crossVectors(dir, up).normalize().multiplyScalar(r), v = new THREE.Vector3().crossVectors(dir, u).normalize().multiplyScalar(r);
    const k = [u.clone().add(v), u.clone().sub(v), u.clone().negate().sub(v), u.clone().negate().add(v)]; for (let i = 0; i < 4; i++) { const p = k[i], q = k[(i + 1) % 4]; this.quad(A.clone().add(p).toArray(), B.clone().add(p).toArray(), B.clone().add(q).toArray(), A.clone().add(q).toArray(), col); } }
  geo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); if (this.c.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.computeBoundingSphere(); return g; } }

// ---- textures, drawn once ----
// stains that darken the ground (white = no change): cracks, damp, moss, soot
function stainAtlas() { const N = 256, [c, g] = canvas(N * 2); g.fillStyle = '#fff'; g.fillRect(0, 0, N * 2, N * 2); seedR(901);
  const blot = (ox, oy, n, col, r0, r1, a) => { for (let i = 0; i < n; i++) { const ang = rr() * 6.283, rad = rr() * N * 0.3, x = ox + N / 2 + Math.cos(ang) * rad, y = oy + N / 2 + Math.sin(ang) * rad, r = r0 + rr() * (r1 - r0); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } };
  // 0: cracks, branching from the middle
  g.save(); g.beginPath(); g.rect(0, 0, N, N); g.clip(); g.lineCap = 'round'; g.lineJoin = 'round';
  const crack = (x, y, a, len, w, depth) => { let px = x, py = y; g.lineWidth = w; g.strokeStyle = `rgba(92,78,64,${0.35 + rr() * 0.25})`; g.beginPath(); g.moveTo(px, py); const n = 5 + Math.floor(rr() * 5);
    for (let i = 0; i < n; i++) { a += (rr() - 0.5) * 0.9; px += Math.cos(a) * len / n; py += Math.sin(a) * len / n; if (Math.hypot(px - N / 2, py - N / 2) > N * 0.46) break; g.lineTo(px, py); if (depth < 2 && rr() < 0.3) { g.stroke(); crack(px, py, a + (rr() < 0.5 ? 1 : -1) * (0.5 + rr() * 0.6), len * 0.5, w * 0.6, depth + 1); g.lineWidth = w; g.strokeStyle = 'rgba(92,78,64,0.45)'; g.beginPath(); g.moveTo(px, py); } }
    g.stroke(); };
  for (let k = 0; k < 4; k++) crack(N / 2, N / 2, k * 1.6 + rr(), N * 0.42, 2.0, 0); blot(0, 0, 6, '120,104,88', 10, 30, 0.25); g.restore();
  // 1: damp and dirt
  g.save(); g.beginPath(); g.rect(N, 0, N, N); g.clip(); blot(N, 0, 26, '96,84,70', 18, 60, 0.32); blot(N, 0, 12, '70,60,52', 8, 28, 0.3); g.restore();
  // 2: moss creeping between the stones
  g.save(); g.beginPath(); g.rect(0, N, N, N); g.clip(); blot(0, N, 26, '92,118,52', 14, 52, 0.42); blot(0, N, 16, '60,86,38', 8, 26, 0.4); for (let i = 0; i < 260; i++) { const a = rr() * 6.283, r = Math.sqrt(rr()) * N * 0.4; g.fillStyle = `rgba(${rr() < 0.5 ? '70,96,40' : '120,140,60'},${0.3 + rr() * 0.4})`; g.fillRect(N / 2 + Math.cos(a) * r, N + N / 2 + Math.sin(a) * r, 2 + rr() * 3, 2 + rr() * 3); } g.restore();
  // 3: soot and old scorch marks
  g.save(); g.beginPath(); g.rect(N, N, N, N); g.clip(); blot(N, N, 20, '40,34,30', 14, 54, 0.38); blot(N, N, 8, '20,18,16', 8, 24, 0.35); g.restore();
  return tex(c); }
// things lying on the ground (alpha): leaves, straw, pottery shards, petals
function litterAtlas() { const N = 256, [c, g] = canvas(N * 2); seedR(1717);
  const leaf = (x, y, s, a, col) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.beginPath(); g.moveTo(-s, 0); g.quadraticCurveTo(0, -s * 0.55, s, 0); g.quadraticCurveTo(0, s * 0.55, -s, 0); g.fill(); g.strokeStyle = 'rgba(60,40,20,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke(); g.restore(); };
  const inC = (ox, oy, f) => { for (let i = 0; i < 400; i++) { const a = rr() * 6.283, r = Math.sqrt(rr()) * N * 0.42; f(ox + N / 2 + Math.cos(a) * r, oy + N / 2 + Math.sin(a) * r, i); } };
  const LC = ['#b8862e', '#c46a24', '#8a5a2a', '#a4a03a', '#d4a43c', '#7c8a34', '#9a4a22'];
  inC(0, 0, (x, y, i) => { if (i < 70) leaf(x, y, 6 + rr() * 7, rr() * 6.3, LC[Math.floor(rr() * LC.length)]); });
  inC(N, 0, (x, y, i) => { if (i < 120) { g.strokeStyle = rr() < 0.5 ? '#d8bc6a' : '#b89a50'; g.lineWidth = 1.5 + rr() * 1.5; const a = rr() * 6.3, l = 8 + rr() * 16; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } });
  inC(0, N, (x, y, i) => { if (i < 14) { const s = 8 + rr() * 14, n = 3 + Math.floor(rr() * 3); g.fillStyle = rr() < 0.7 ? '#a85a34' : '#c88a5a'; g.beginPath(); for (let k = 0; k < n; k++) { const a = k / n * 6.283 + rr() * 0.6, r = s * (0.5 + rr() * 0.6); k ? g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); g.strokeStyle = 'rgba(240,200,160,0.6)'; g.lineWidth = 1.5; g.stroke(); } else if (i < 40) { g.fillStyle = 'rgba(120,110,100,0.9)'; g.fillRect(x, y, 2 + rr() * 4, 2 + rr() * 3); } });
  inC(N, N, (x, y, i) => { if (i < 90) leaf(x, y, 3 + rr() * 3, rr() * 6.3, ['#f0c8d8', '#ffffff', '#f4e4a0', '#e890b0'][i % 4]); });
  return tex(c); }
// a puddle's outline (alpha map)
function puddleAlpha() { const N = 128, [c, g] = canvas(N); g.fillStyle = '#000'; g.fillRect(0, 0, N, N); seedR(333); for (let i = 0; i < 9; i++) { const x = N / 2 + (rr() - 0.5) * N * 0.4, y = N / 2 + (rr() - 0.5) * N * 0.3, r = N * (0.12 + rr() * 0.16); const gr = g.createRadialGradient(x, y, r * 0.8, x, y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } return tex(c, false); }
// wild plants (alpha), four cells across: daisies, poppies, lavender, tall grass with seed heads
function plantAtlas() { const N = 256, [c, g] = canvas(N * 4, N); seedR(4321);
  const stem = (x, h, lean, col = '#4a6a2a', w = 2) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x, N); g.quadraticCurveTo(x + lean * 0.3, N - h * 0.6, x + lean, N - h); g.stroke(); return [x + lean, N - h]; };
  const leafy = (ox) => { for (let i = 0; i < 26; i++) { const x = ox + N * (0.1 + rr() * 0.8), h = N * (0.15 + rr() * 0.3), l = (rr() - 0.5) * 40; const gr = g.createLinearGradient(0, N, 0, N - h); gr.addColorStop(0, '#2e4a1e'); gr.addColorStop(1, '#7a9a44'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - 4, N); g.quadraticCurveTo(x + l * 0.4, N - h * 0.6, x + l, N - h); g.quadraticCurveTo(x + l * 0.4 + 2, N - h * 0.6, x + 4, N); g.fill(); } };
  // daisies
  leafy(0); for (let i = 0; i < 9; i++) { const [x, y] = stem(N * (0.12 + rr() * 0.76), N * (0.35 + rr() * 0.4), (rr() - 0.5) * 30); for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; g.fillStyle = '#fbf8ee'; g.beginPath(); g.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 5, 6, 2.6, a, 0, 7); g.fill(); } g.fillStyle = '#f0c030'; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); }
  // poppies
  leafy(N); for (let i = 0; i < 7; i++) { const [x, y] = stem(N + N * (0.12 + rr() * 0.76), N * (0.4 + rr() * 0.45), (rr() - 0.5) * 36, '#5a7a32', 2.4); g.fillStyle = rr() < 0.25 ? '#f0a020' : '#d8281e'; for (let k = 0; k < 4; k++) { const a = k / 4 * 6.283 + 0.4; g.beginPath(); g.ellipse(x + Math.cos(a) * 6, y + Math.sin(a) * 4, 9, 7, a, 0, 7); g.fill(); } g.fillStyle = '#2a1a14'; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); }
  // lavender and bluebells
  leafy(N * 2); for (let i = 0; i < 14; i++) { const [x, y] = stem(N * 2 + N * (0.1 + rr() * 0.8), N * (0.45 + rr() * 0.45), (rr() - 0.5) * 28, '#5a7048', 1.6); const col = rr() < 0.6 ? ['#8a6ad0', '#a080e0', '#7058b8'] : ['#5a78e0', '#7894f0', '#4a64c8']; for (let k = 0; k < 9; k++) { g.fillStyle = col[k % 3]; g.beginPath(); g.ellipse(x - (k / 9) * (x - (x - 2)) , y + k * 4.5, 3.2, 2.6, 0, 0, 7); g.fill(); } }
  // tall grass with seed heads
  for (let i = 0; i < 60; i++) { const x = N * 3 + N * (0.08 + rr() * 0.84), h = N * (0.4 + rr() * 0.55), l = (rr() - 0.5) * 60, w = 2 + rr() * 3; const gr = g.createLinearGradient(0, N, 0, N - h); gr.addColorStop(0, '#3e5a24'); gr.addColorStop(0.6, '#8a9a4a'); gr.addColorStop(1, '#d8c880'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - w, N); g.quadraticCurveTo(x + l * 0.4, N - h * 0.6, x + l, N - h); g.quadraticCurveTo(x + l * 0.4 + w * 0.3, N - h * 0.6, x + w, N); g.fill();
    if (i % 4 === 0) { g.fillStyle = '#e0cc8a'; g.beginPath(); g.ellipse(x + l, N - h, 2.6, 9, l * 0.01, 0, 7); g.fill(); } }
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; }

// ---- the parts ----
function groundDetail(root) {
  const stains = new Batch(), litter = new Batch(), wet = new Batch(), mud = new Batch(), cell = (k, n = 2) => { const i = k % n, j = Math.floor(k / n); return [i / n + 0.004, 1 - (j + 1) / n + 0.004, (i + 1) / n - 0.004, 1 - j / n - 0.004]; };
  seedR(2468);
  const put = (b, x, z, h, s, k, lift) => b.flat(x, h + lift, z, s * (0.8 + rr() * 0.5), s * (0.8 + rr() * 0.5), rr() * 6.283, cell(k));
  for (let i = 0; i < 2600; i++) { const x = (rr() - 0.5) * 116, z = (rr() - 0.5) * 196, h = levelAt(x, z); if (h == null) continue; const kind = rr();
    if (blocked(x, z, 0.1, h)) { if (kind < 0.5) continue; } // (some damp and moss reaches right up to the walls)
    if (inMosaic(x, z) && kind > 0.12) continue;
    const near = laneD(x, z);
    if (kind < 0.24) put(stains, x, z, h, 1.6 + rr() * 2.6, 0, 0.03); // cracks
    else if (kind < 0.5) put(stains, x, z, h, 2.5 + rr() * 4, 1, 0.025); // damp / dirt
    else if (kind < 0.68) { if (near < 1.2 && h === Y) continue; put(stains, x, z, h, 1.8 + rr() * 3, 2, 0.028); } // moss (worn off where everyone walks)
    else if (kind < 0.72) put(stains, x, z, h, 1.4 + rr() * 2, 3, 0.027); // soot
    else if (kind < 0.88) { if (inMosaic(x, z)) continue; put(litter, x, z, h, 1.2 + rr() * 1.4, 0, 0.04); } // fallen leaves
    else if (kind < 0.93) put(litter, x, z, h, 1.0 + rr() * 1.2, 1, 0.042); // straw
    else if (kind < 0.97) { if (near < 1.5) continue; put(litter, x, z, h, 0.9 + rr() * 0.8, 2, 0.045); } // broken pottery (to the side)
    else put(litter, x, z, h, 0.9 + rr() * 1.0, 3, 0.043); } // petals
  // soot round every fire bowl, damp round the wells and the pond
  for (const f of world.fires) { const h = f.pos.y - 1.55 * (f.size / 0.45); if (Math.abs(h - Y) < 0.1 || levelAt(f.pos.x, f.pos.z) != null) stains.flat(f.pos.x, h + 0.029, f.pos.z, 3.6, 3.6, rr() * 6, cell(3)); }
  // puddles: in the streets, the alleys and the outer path (low ground, between the stones), each with a dark damp rim
  let n = 0; for (let i = 0; i < 900 && n < 30; i++) { const x = (rr() - 0.5) * 114, z = (rr() - 0.5) * 150, h = levelAt(x, z); if (h !== Y || inMosaic(x, z) || blocked(x, z, 0.8)) continue; if (Math.abs(x) > 33 && x > 0) continue; // (not in the garden)
    const s = 0.9 + rr() * 1.5, a = rr() * 6.283; for (const sz of [1, -1]) { wet.flat(x, Y + 0.05, z * sz, s * 1.4, s, a, [0, 0, 1, 1]); mud.flat(x, Y + 0.031, z * sz, s * 2.1, s * 1.6, a, cell(1)); } n++; }
  for (const b of [mud]) { stains.p.push(...b.p); stains.n.push(...b.n); stains.uv.push(...b.uv); }
  const mul = new THREE.MeshBasicMaterial({ map: stainAtlas(), transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor, blendEquation: THREE.AddEquation, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const m1 = new THREE.Mesh(stains.geo(), mul); m1.renderOrder = 1; root.add(m1);
  const lit = new THREE.MeshStandardMaterial({ map: litterAtlas(), alphaTest: 0.45, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide });
  const m2 = new THREE.Mesh(litter.geo(), lit); m2.receiveShadow = true; root.add(m2);
  const pud = new THREE.MeshStandardMaterial({ color: '#1c2226', roughness: 0.02, metalness: 0.3, alphaMap: puddleAlpha(), transparent: true, opacity: 0.85, depthWrite: false, envMapIntensity: 1.4, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const m3 = new THREE.Mesh(wet.geo(), pud); m3.receiveShadow = true; m3.renderOrder = 2; root.add(m3); }

// wildflowers and tall grass: off the lanes, in the garden, along the outer path and hugging the foot of the walls
function plants(root) { const b = new Batch(); seedR(8642); let n = 0;
  const clump = (x, z, h, k) => { const s = 0.55 + rr() * 0.5, hh = (k === 3 ? 0.8 + rr() * 0.5 : 0.45 + rr() * 0.35), a0 = rr() * 3.14, u0 = k / 4 + 0.002, u1 = (k + 1) / 4 - 0.002;
    for (let j = 0; j < 2; j++) { const a = a0 + j * Math.PI / 2, c = Math.cos(a) * s / 2, sn = Math.sin(a) * s / 2, P = [[x - c, h, z + sn], [x + c, h, z - sn], [x + c, h + hh, z - sn], [x - c, h + hh, z + sn]], U = [[u0, 0], [u1, 0], [u1, 1], [u0, 1]];
      for (const i of [0, 1, 2, 0, 2, 3]) { b.p.push(...P[i]); b.n.push(0, 1, 0); b.uv.push(...U[i]); } } n++; };
  const garden = (x, z) => x > 33 && Math.abs(z) > 12 && Math.abs(z) < 73 && !(x > 34.5 && x < 47.5 && Math.abs(z) > 29.5 && Math.abs(z) < 46.5);
  const verge = (x, z) => (x < -55.5 || x > 56) && Math.abs(z) > 9 && Math.abs(z) < 73;
  for (let i = 0; i < 9000 && n < 900; i++) { const x = (rr() - 0.5) * 116, z = (rr() - 0.5) * 150, h = levelAt(x, z); if (h !== Y || inMosaic(x, z)) continue;
    if (laneD(x, z) < 2.8 || blocked(x, z, 0.45)) continue; const wallFoot = blocked(x, z, 1.4);
    if (!(garden(x, z) || verge(x, z) || (wallFoot && rr() < 0.5))) continue;
    if (Math.abs(x - 51) < 6 && Math.abs(Math.abs(z) - 20) < 4.5) continue; // (the pond)
    const r = rr(), k = wallFoot ? (r < 0.6 ? 3 : r < 0.8 ? 0 : 1) : (r < 0.35 ? 0 : r < 0.6 ? 1 : r < 0.8 ? 2 : 3); clump(x, z, Y, k);
    if (garden(x, z) && rr() < 0.5) { const x2 = x + (rr() - 0.5) * 1.4, z2 = z + (rr() - 0.5) * 1.4; if (laneD(x2, z2) > 2.6 && !blocked(x2, z2, 0.45) && levelAt(x2, z2) === Y) clump(x2, z2, Y, k); } }
  const mat = new THREE.MeshStandardMaterial({ map: plantAtlas(), alphaTest: 0.5, roughness: 0.95, side: THREE.DoubleSide, color: '#f4f0e0' });
  mat.onBeforeCompile = (sh) => { sh.uniforms.time = AR.time; sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat sw = uv.y * uv.y * (sin(time * 1.7 + position.x * 0.7 + position.z * 0.5) * 0.06 + sin(time * 3.1 + position.z * 1.3) * 0.025); transformed.x += sw; transformed.z += sw * 0.6;'); };
  const m = new THREE.Mesh(b.geo(), mat); m.receiveShadow = true; root.add(m); }

// strings of lanterns and pennants across the street and the plaza, and washing lines over the outer path, all high up
function hanging(root) { const cloth = new Batch(), bulbs = new Batch(); seedR(1357);
  const C = (h) => new THREE.Color(h), ROPE = C('#5a4634'), PEN = ['#c8402a', '#e0b040', '#3a6ab0', '#f0e6c8', '#5a8a3a'].map(C), WASH = ['#f2ece0', '#d8c8a8', '#a8b8d0', '#c89080', '#e8dcc0', '#8a9a70'].map(C), LAMP = C('#ffe0a0').multiplyScalar(2.2), PAPER = C('#ffb060').multiplyScalar(1.9);
  const curve = (a, b, sag) => (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag, a[2] + (b[2] - a[2]) * t];
  const bulb = (p, r, col) => { const g = new THREE.OctahedronGeometry(r, 1).toNonIndexed(), P = g.attributes.position; for (let i = 0; i < P.count; i++) { bulbs.p.push(P.getX(i) + p[0], P.getY(i) * 1.25 + p[1], P.getZ(i) + p[2]); bulbs.n.push(0, 1, 0); bulbs.uv.push(0, 0); bulbs.c.push(col.r, col.g, col.b); } };
  // pennants and lights
  const festoon = (a, b, sag, lamps = true) => { const P = curve(a, b, sag), L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(8, Math.round(L / 0.7)), dx = (b[0] - a[0]) / L, dz = (b[2] - a[2]) / L;
    for (let i = 0; i < n; i++) { const p = P(i / n), q = P((i + 1) / n); cloth.beam(p, q, 0.025, ROPE);
      const m = P((i + 0.5) / n); if (lamps && i % 3 === 1) { bulb([m[0], m[1] - 0.16, m[2]], i % 6 === 1 ? 0.15 : 0.09, i % 6 === 1 ? PAPER : LAMP); continue; }
      const w = 0.24, col = PEN[(i * 7 + Math.abs(Math.floor(a[2]))) % PEN.length], t0 = [p[0] + dx * 0.05, p[1] - 0.02, p[2] + dz * 0.05], t1 = [q[0] - dx * 0.05, q[1] - 0.02, q[2] - dz * 0.05], tip = [m[0], m[1] - 0.5, m[2]]; cloth.tri(t0, t1, tip, col); } };
  // washing on a line: shirts, sheets and cloths pegged up
  const washing = (a, b, sag) => { const P = curve(a, b, sag), L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.round(L / 0.5), dx = (b[0] - a[0]) / L, dz = (b[2] - a[2]) / L;
    for (let i = 0; i < n; i++) cloth.beam(P(i / n), P((i + 1) / n), 0.02, ROPE);
    for (let t = 0.08; t < 0.92;) { const w = 0.5 + rr() * 0.8, hh = 0.5 + rr() * 0.7, tt = t + w / L / 2, p = P(tt), col = WASH[Math.floor(rr() * WASH.length)], nx = -dz * 0.02, nz = dx * 0.02, sway = (rr() - 0.5) * 0.12;
      if (rr() < 0.8) { const A = [p[0] - dx * w / 2, p[1] - 0.02, p[2] - dz * w / 2], B = [p[0] + dx * w / 2, p[1] - 0.02, p[2] + dz * w / 2]; cloth.quad(A, B, [B[0] + nx + sway, B[1] - hh, B[2] + nz + sway], [A[0] + nx + sway, A[1] - hh * (0.9 + rr() * 0.2), A[2] + nz + sway], col); }
      t += (w + 0.25 + rr() * 0.5) / L; } };
  for (const sz of [-1, 1]) {
    // the middle street, between the tall houses' upper floors (above the balconies and the bridge)
    for (const z of [34.4, 45.6]) festoon([-16.75, Y + 6.9, z * sz], [16.75, Y + 6.7, (z + 0.3) * sz], 1.0);
    // washing lines from the outer wall to the rampart over the outer path
    for (const z of [26, 37.5, 59]) washing([-58.35, Y + 7.3, z * sz], [-45.15, Y + 7.6, (z + 1.2) * sz], 0.55); }
  // the plaza: lights strung between the tops of the standing columns
  const top = (k) => { const a = (k + 0.5) / 16 * Math.PI * 2; return [Math.cos(a) * 10.45, Y + 7.2, Math.sin(a) * 10.45]; };
  for (const [i, j] of [[0, 5], [5, 10], [8, 13], [13, 2], [10, 15]]) festoon(top(i), top(j), 1.25);
  const cm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  cm.onBeforeCompile = (sh) => { sh.uniforms.time = AR.time; sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat fl = sin(time * 2.3 + position.x * 0.9 + position.z * 0.7) * 0.07 + sin(time * 4.1 + position.y * 3.0) * 0.02; transformed.x += fl * (1.0 - color.r * 0.0); transformed.z += fl * 0.7;'); };
  const m1 = new THREE.Mesh(cloth.geo(), cm); m1.castShadow = true; m1.receiveShadow = true; root.add(m1);
  const m2 = new THREE.Mesh(bulbs.geo(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true })); root.add(m2); }

// smoke curling up from every fire bowl, and from chimneys in the town beyond the walls; embers over the fires
function smoke(root) { seedR(9753); const src = [];
  for (const f of world.fires) src.push([f.pos.x, f.pos.y + 0.6, f.pos.z, 7 + f.size * 6, 0.9 + f.size, 18]);
  for (let i = 0; i < 9; i++) { const a = rr() * 6.283, r = 125 + rr() * 40, x = Math.cos(a) * r * 0.75, z = Math.sin(a) * r * 1.05; src.push([x, Y + 22 + rr() * 10, z, 55 + rr() * 30, 6 + rr() * 4, 40]); }
  const N = src.reduce((s, e) => s + e[5], 0), base = new Float32Array(N * 3), prm = new Float32Array(N * 4); let k = 0;
  for (const [x, y, z, H, sz, n] of src) for (let i = 0; i < n; i++, k++) { base[k * 3] = x; base[k * 3 + 1] = y; base[k * 3 + 2] = z; prm[k * 4] = i / n + rr() * 0.02; prm[k * 4 + 1] = H; prm[k * 4 + 2] = sz; prm[k * 4 + 3] = rr() * 100; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(base, 3)); g.setAttribute('prm', new THREE.BufferAttribute(prm, 4)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 400);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { scale: { value: 520 } }]),
    vertexShader: `attribute vec4 prm; uniform float time, scale; varying float vA; varying float vT; #include <fog_pars_vertex>
      void main(){ float sp = prm.y > 30.0 ? 0.012 : 0.07; float t = fract(prm.x + time * sp); vec3 p = position; float hgt = t * prm.y;
        p.x += hgt * 0.35 + sin(t * 6.0 + prm.w) * (0.3 + t * prm.z * 0.6); p.z += hgt * 0.12 + cos(t * 5.0 + prm.w) * (0.3 + t * prm.z * 0.5); p.y += hgt;
        vA = smoothstep(0.0, 0.08, t) * (1.0 - t) * (prm.y > 30.0 ? 0.55 : 0.32); vT = t; vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition; gl_PointSize = scale * prm.z * (0.35 + t * 1.3) / -mvPosition.z;
        #include <fog_vertex>
      }`.replace('#include <fog_pars_vertex>', '\n#include <fog_pars_vertex>\n'),
    fragmentShader: `varying float vA; varying float vT; uniform float time;
      #include <fog_pars_fragment>
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = smoothstep(0.5, 0.1, r) * vA; float n = sin(gl_PointCoord.x * 9.0 + vT * 7.0) * sin(gl_PointCoord.y * 8.0 - vT * 5.0); a *= 0.8 + 0.2 * n;
        vec3 c = mix(vec3(0.42, 0.38, 0.36), vec3(0.78, 0.74, 0.72), vT); gl_FragColor = vec4(c, a);
        #include <fog_fragment>
      }` });
  m.uniforms.time = AR.time; const p = new THREE.Points(g, m); p.renderOrder = 3; root.add(p);
  // embers: little sparks rising and winking out over each fire
  const E = world.fires.length * 14, eb = new Float32Array(E * 3), ep = new Float32Array(E * 2); k = 0; for (const f of world.fires) for (let i = 0; i < 14; i++, k++) { eb[k * 3] = f.pos.x; eb[k * 3 + 1] = f.pos.y + 0.3; eb[k * 3 + 2] = f.pos.z; ep[k * 2] = rr(); ep[k * 2 + 1] = rr() * 100; }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(eb, 3)); eg.setAttribute('ep', new THREE.BufferAttribute(ep, 2)); eg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);
  const em = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { time: AR.time },
    vertexShader: `attribute vec2 ep; uniform float time; varying float vA; void main(){ float t = fract(ep.x + time * 0.45); vec3 p = position; p.y += t * 3.2; p.x += sin(t * 9.0 + ep.y) * 0.5 * t; p.z += cos(t * 7.0 + ep.y) * 0.5 * t;
      vA = (1.0 - t) * (0.6 + 0.4 * sin(time * 20.0 + ep.y)); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 70.0 / -mv.z; }`,
    fragmentShader: `varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.62, 0.25) * 2.0, smoothstep(0.5, 0.0, r) * vA); }` });
  const ep2 = new THREE.Points(eg, em); ep2.renderOrder = 3; root.add(ep2); }

// dust drifting in the sunlight down the street, the alleys, the chapel and the outer path
function dust(root) { seedR(2222); const boxes = [[-14, 14, 20, 72, 9], [33, 58, 13, 72, 7], [-58, -46, 10, 72, 8], [-30, -15, 20, 70, 9], [15, 30, 20, 70, 9], [-35, -45, 25, 69, 4]], n = 900, pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { const b = boxes[i % boxes.length], sz = rr() < 0.5 ? 1 : -1; pos[i * 3] = b[0] + rr() * (b[1] - b[0]); pos[i * 3 + 1] = Y + 0.3 + rr() * b[4] + (b[4] === 4 ? 9 : 0); pos[i * 3 + 2] = sz * (b[2] + rr() * (b[3] - b[2])); ph[i] = rr() * 100; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 120);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { time: AR.time },
    vertexShader: `attribute float ph; uniform float time; varying float vA; void main(){ vec3 p = position; float t = time * 0.12 + ph; p.x += sin(t * 1.3) * 1.2 + sin(t * 0.37) * 2.0; p.y += sin(t * 0.9) * 0.6; p.z += cos(t * 1.1) * 1.2;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); float dd = -mv.z; vA = (0.35 + 0.35 * sin(t * 5.0)) * smoothstep(40.0, 10.0, dd) * smoothstep(0.5, 2.0, dd); gl_Position = projectionMatrix * mv; gl_PointSize = 40.0 / dd; }`,
    fragmentShader: `varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(1.0, 0.86, 0.62, smoothstep(0.5, 0.0, r) * vA); }` });
  const p = new THREE.Points(g, m); p.renderOrder = 3; root.add(p); }

// far away, beyond the plain: a ring of mountains, snow on the high peaks, blue with distance; a castle on a hill to the north
function skyline(root) { seedR(6061); const P = [], N = [], C = [], push = (g, col) => { g = g.index ? g.toNonIndexed() : g; g.computeVertexNormals(); const p = g.attributes.position, nn = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(nn.getX(i), nn.getY(i), nn.getZ(i)); const c = col(p.getX(i), p.getY(i), p.getZ(i), nn.getY(i)); C.push(c.r, c.g, c.b); } };
  const rock = new THREE.Color('#585a74'), rockW = new THREE.Color('#7a6a70'), snow = new THREE.Color('#f4f0f4'), forest = new THREE.Color('#3e4a3a'), tmp = new THREE.Color();
  const peak = (x, z, w, h, d) => { const g = new THREE.ConeGeometry(1, 1, 7, 4, false); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.5, j = (1 - y) * 0.35; p.setXYZ(i, p.getX(i) * (1 + (rr() - 0.5) * j) * w, Y - 30 + y * h * (1 + (rr() - 0.5) * 0.12 * (1 - y)), p.getZ(i) * (1 + (rr() - 0.5) * j) * d); }
    g.rotateY(rr() * 6); g.translate(x, 0, z); const snowLine = Y - 30 + h * (0.62 + rr() * 0.1);
    push(g, (px, py, pz, ny) => { const f = (py - (Y - 30)) / h; tmp.copy(f < 0.3 ? forest : rock).lerp(rockW, Math.max(0, Math.min(1, f * 1.5 - 0.3)) * 0.5); if (py > snowLine && ny > 0.25) tmp.copy(snow); return tmp; }); };
  for (let i = 0; i < 44; i++) { const a = i / 44 * Math.PI * 2 + rr() * 0.08, r = 1300 + rr() * 450, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 420 + rr() * 380; peak(x, z, 200 + rr() * 220, h, 180 + rr() * 220);
    if (rr() < 0.8) peak(x + (rr() - 0.5) * 300, z + (rr() - 0.5) * 300, 120 + rr() * 120, h * (0.55 + rr() * 0.3), 120 + rr() * 120); }
  for (let i = 0; i < 30; i++) { const a = rr() * Math.PI * 2, r = 700 + rr() * 300, g = new THREE.IcosahedronGeometry(1, 1); g.scale(140 + rr() * 140, 70 + rr() * 80, 120 + rr() * 120); g.translate(Math.cos(a) * r, Y - 25, Math.sin(a) * r); push(g, () => tmp.copy(forest).lerp(rockW, 0.25)); } // (wooded foothills)
  // the castle of the Vale, on a hill to the north
  { const cx = 320, cz = 1050, hy = Y + 130, stone = new THREE.Color('#b0a090'), roof = new THREE.Color('#5a3a40'); const hill = new THREE.IcosahedronGeometry(1, 2); hill.scale(260, 160, 200); hill.translate(cx, Y - 30, cz); push(hill, (px, py, pz, ny) => tmp.copy(forest).lerp(rockW, py > hy - 30 ? 0.6 : 0.15));
    const box = (x, z, w, h, d) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(cx + x, hy + h / 2 - 4, cz + z); push(g, () => stone); };
    const tower = (x, z, r, h) => { const g = new THREE.CylinderGeometry(r, r * 1.08, h, 10); g.translate(cx + x, hy + h / 2 - 4, cz + z); push(g, () => stone); const c = new THREE.ConeGeometry(r * 1.3, r * 2.6, 10); c.translate(cx + x, hy + h - 4 + r * 1.3, cz + z); push(c, () => roof); };
    box(0, 0, 80, 26, 50); box(0, 0, 34, 52, 26); tower(-42, -26, 7, 40); tower(42, -26, 7, 40); tower(-42, 26, 7, 36); tower(42, 26, 7, 36); tower(8, 4, 8, 78); tower(-14, -6, 5, 62);
    for (let i = -3; i <= 3; i++) box(i * 11, -25.5, 5, 32, 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeBoundingSphere();
  const haze = { value: new THREE.Color('#d6a48a') }, m = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false, flatShading: true });
  m.onBeforeCompile = (sh) => { sh.uniforms.haze = haze; sh.vertexShader = 'varying float vHz;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 wp = modelMatrix * vec4(transformed, 1.0); float dd = length(wp.xz); vHz = clamp(0.12 + dd / 5200.0, 0.0, 0.6) * mix(1.0, 0.6, clamp((wp.y - 3.0) / 700.0, 0.0, 1.0)); }');
    sh.fragmentShader = 'uniform vec3 haze; varying float vHz;\n' + sh.fragmentShader.replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, haze, vHz);\n#include <tonemapping_fragment>'); };
  const mesh = new THREE.Mesh(g, m); mesh.onBeforeRender = (r, scene) => { if (scene.fog) haze.value.copy(scene.fog.color); }; mesh.renderOrder = -1; root.add(mesh); }

export function buildRuinsDecor(root) { SEGS = []; for (const l of RUINS.lanes) for (let i = 0; i < l.length - 1; i++) SEGS.push([l[i][0], l[i][1], l[i + 1][0], l[i + 1][1]]);
  const n0 = root.children.length, parts = [groundDetail, plants, hanging, smoke, dust, skyline]; for (const f of parts) { try { f(root); } catch (e) { console.warn('ruins decor', f.name, e); } }
  for (let i = n0; i < root.children.length; i++) root.children[i].userData.decor = true; }
export function updateRuinsDecor() { /* (everything moves in its shaders, off AR.time) */ }

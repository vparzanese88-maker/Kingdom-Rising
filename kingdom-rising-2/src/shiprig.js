// The hero's ship, alive: sails cut out of the ship model so they can furl up to their yards and drop and fill with wind,
// a ship's wheel at the helm that turns as you steer, a rudder that swings at the stern, and a pennant flying from the masthead.
import * as THREE from 'three';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, o));
const WOOD = mat('#7a5230'), WOOD2 = mat('#5a3a20'), BRASS = mat('#c89a40', { metalness: 0.6, roughness: 0.4 });

// ---- sails ----
// The ship model is one mesh with its sails baked in. Sail cloth is the pale canvas colour in its texture: every triangle whose
// texture is that colour is sail, and each connected group of them is one sail. They become their own meshes (children of the
// hull mesh, so in the model's own units), which we can furl and billow by moving their vertices.
const isCloth = (r, g, b) => r > 140 && g > 105 && b > 60 && r - g < 60;
export function splitSails(model) {
  const sails = [];
  model.traverse(mesh => {
    if (!mesh.isMesh || !mesh.geometry.index || !mesh.material.map || !mesh.material.map.image) return;
    const img = mesh.material.map.image, W = img.width, H = img.height; if (!W || !H) return;
    let D; try { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0); D = c.getImageData(0, 0, W, H).data; } catch (e) { return; }
    const flip = mesh.material.map.flipY, g = mesh.geometry, P = g.attributes.position, UV = g.attributes.uv, N = g.attributes.normal, I = g.index.array; if (!UV) return;
    const px = (u, v) => { u = ((u % 1) + 1) % 1; v = ((v % 1) + 1) % 1; if (flip) v = 1 - v; const k = (Math.min(H - 1, Math.floor(v * H)) * W + Math.min(W - 1, Math.floor(u * W))) * 4; return isCloth(D[k], D[k + 1], D[k + 2]); };
    const cloth = []; for (let t = 0; t < I.length / 3; t++) { let n = 0; for (let j = 0; j < 3; j++) if (px(UV.getX(I[t * 3 + j]), UV.getY(I[t * 3 + j]))) n++; if (n >= 2) cloth.push(t); }
    // connected groups (vertices welded by position: the model splits them at texture seams)
    const wid = new Map(), vid = new Int32Array(P.count); for (let i = 0; i < P.count; i++) { const k = P.getX(i).toFixed(4) + ',' + P.getY(i).toFixed(4) + ',' + P.getZ(i).toFixed(4); if (!wid.has(k)) wid.set(k, wid.size); vid[i] = wid.get(k); }
    const par = new Int32Array(wid.size).map((_, i) => i), f = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
    for (const t of cloth) { const a = f(vid[I[t * 3]]); par[f(vid[I[t * 3 + 1]])] = a; par[f(vid[I[t * 3 + 2]])] = a; }
    const groups = new Map(); for (const t of cloth) { const r = f(vid[I[t * 3]]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(t); }
    const take = new Set(), sm = mesh.material.clone(); sm.side = THREE.DoubleSide;
    for (const ts of groups.values()) { if (ts.length < 8) continue; // (tiny scraps stay on the hull)
      const n = ts.length * 3, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      ts.forEach((t, q) => { for (let j = 0; j < 3; j++) { const i = I[t * 3 + j], o = q * 3 + j; pos[o * 3] = P.getX(i); pos[o * 3 + 1] = P.getY(i); pos[o * 3 + 2] = P.getZ(i); uv[o * 2] = UV.getX(i); uv[o * 2 + 1] = UV.getY(i); } take.add(t); });
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3)); sg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); sg.computeVertexNormals();
      const s = new THREE.Mesh(sg, sm); s.castShadow = true; s.frustumCulled = false; mesh.add(s);
      sails.push(makeSail(s, pos));
    }
    if (take.size) { const keep = []; for (let t = 0; t < I.length / 3; t++) if (!take.has(t)) keep.push(I[t * 3], I[t * 3 + 1], I[t * 3 + 2]); const g2 = g.clone(); g2.setIndex(keep); mesh.geometry = g2; }
  });
  return sails;
}
// a sail's shape: open (as modelled) and furled (gathered up to its top edge, the yard, as a thin roll)
function makeSail(mesh, open) {
  const n = open.length / 3; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, zc = 0;
  for (let i = 0; i < n; i++) { const x = open[i * 3], y = open[i * 3 + 1]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); zc += open[i * 3 + 2] / n; }
  const NB = 12, top = new Array(NB).fill(-1e9), bot = new Array(NB).fill(1e9), bin = (x) => Math.max(0, Math.min(NB - 1, Math.floor((x - x0) / Math.max(1e-6, x1 - x0) * NB)));
  for (let i = 0; i < n; i++) { const b = bin(open[i * 3]); top[b] = Math.max(top[b], open[i * 3 + 1]); bot[b] = Math.min(bot[b], open[i * 3 + 1]); }
  for (let b = 0; b < NB; b++) if (top[b] < -1e8) { let l = b, r = b; while (l >= 0 && top[l] < -1e8) l--; while (r < NB && top[r] < -1e8) r++; top[b] = l >= 0 && r < NB ? (top[l] + top[r]) / 2 : l >= 0 ? top[l] : top[r]; bot[b] = l >= 0 ? bot[l] : bot[r]; }
  const env = (arr, x) => { const f = (x - x0) / Math.max(1e-6, x1 - x0) * NB - 0.5, b = Math.max(0, Math.min(NB - 1, Math.floor(f))), b2 = Math.min(NB - 1, b + 1), k = Math.max(0, Math.min(1, f - b)); return arr[b] + (arr[b2] - arr[b]) * k; };
  const furl = new Float32Array(open.length), U = new Float32Array(n), Vv = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = open[i * 3], y = open[i * 3 + 1], t = env(top, x), bt = env(bot, x), d = Math.max(1e-6, t - bt);
    U[i] = (x - x0) / Math.max(1e-6, x1 - x0); Vv[i] = Math.max(0, Math.min(1, (t - y) / d));
    furl[i * 3] = x; furl[i * 3 + 1] = t - (t - y) * 0.05 - 0.0015; furl[i * 3 + 2] = open[i * 3 + 2] + 0.0025 * Math.sin(Vv[i] * 9); }
  return { mesh, open, furl, U, V: Vv, n, k: 0, shown: -1, h: y1 - y0, delay: Math.random() * 0.5 };
}
// open: 0 furled .. 1 set; billow: how full of wind (0..1); flap: time
export function updateSails(sails, dt, want, wind, t) {
  for (const s of sails) {
    const tgt = want ? 1 : 0; if (want && s.k < 1 && (s.wait = (s.wait ?? s.delay) - dt) > 0) continue; if (!want) s.wait = s.delay;
    s.k += Math.sign(tgt - s.k) * Math.min(Math.abs(tgt - s.k), dt / (want ? 2.0 : 1.6));
    const still = s.k <= 0.0001 && s.shown === 0; if (still) continue;
    const P = s.mesh.geometry.attributes.position, a = P.array, e = s.k * s.k * (3 - 2 * s.k), belly = s.h * (0.07 + 0.05 * wind) * e, fl = s.h * 0.006 * (0.4 + wind) * e;
    for (let i = 0; i < s.n; i++) { const u = s.U[i], v = s.V[i], o = i * 3;
      // dropping from the yard: the lower cloth unrolls last, then fills: the belly pushed out to leeward, a ripple running aft
      const drop = Math.max(0, Math.min(1, e * 1.6 - v * 0.6)), bulge = Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 0.9 + 0.1)) * belly + Math.sin(t * 5.5 - u * 9 + v * 3) * fl * v;
      a[o] = s.furl[o] + (s.open[o] - s.furl[o]) * drop; a[o + 1] = s.furl[o + 1] + (s.open[o + 1] - s.furl[o + 1]) * drop; a[o + 2] = s.furl[o + 2] + (s.open[o + 2] - s.furl[o + 2]) * drop + bulge; }
    P.needsUpdate = true; s.mesh.geometry.computeVertexNormals(); s.shown = s.k <= 0.0001 ? 0 : 1;
  }
}

// ---- the wheel, the rudder and the pennant (in the ship's own frame: +z forward, y up, metres) ----
export function buildWheel(parent, at) {
  const g = new THREE.Group(), w = new THREE.Group(), R = 0.85;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.35, 0.36), WOOD2); post.position.set(0, 0.67, 0.12); g.add(post);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.055, 6, 28), WOOD); w.add(rim); const rim2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.035, 5, 20), WOOD); w.add(rim2);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 12), BRASS); hub.rotation.x = Math.PI / 2; w.add(hub);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, sp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, R, 6), WOOD); sp.position.set(Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0); sp.rotation.z = a - Math.PI / 2; w.add(sp);
    const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 6), WOOD2); hd.position.set(Math.cos(a) * (R + 0.15), Math.sin(a) * (R + 0.15), 0); hd.rotation.z = a - Math.PI / 2; w.add(hd); }
  w.position.set(0, 1.35, 0); g.add(w); g.position.copy(at); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); parent.add(g);
  return { g, w, R };
}
export function buildRudder(parent, at) {
  const piv = new THREE.Group(), b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.5, 3.4), WOOD2); b.position.set(0, 0.2, -1.7); b.castShadow = true; piv.add(b);
  for (const y of [-2.5, 0.5, 3]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 3.5), BRASS); s.position.set(0, y, -1.7); piv.add(s); }
  const til = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 8.5, 8), WOOD); til.position.set(0, 0.6, 0.1); piv.add(til);
  piv.position.copy(at); parent.add(piv); return piv;
}
export function buildPennant(parent, at) {
  const g = new THREE.PlaneGeometry(7, 1.3, 16, 1); g.translate(3.5, 0, 0); // (its hoist at the masthead)
  { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) * (1 - x / 7 * 0.85)); } } // (tapering to a point)
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#b01e1e', roughness: 0.8, side: THREE.DoubleSide })); m.castShadow = true;
  const holder = new THREE.Group(); holder.position.copy(at); holder.rotation.y = Math.PI / 2; holder.add(m); parent.add(holder); // (streaming aft, along -z)
  const base = Float32Array.from(g.attributes.position.array);
  return { holder, m, base };
}
export function flapPennant(P, t, wind) {
  const a = P.m.geometry.attributes.position, b = P.base;
  for (let i = 0; i < a.count; i++) { const x = b[i * 3]; a.setXYZ(i, x, b[i * 3 + 1] - x * 0.05 * (1 - wind), Math.sin(t * (4 + wind * 5) - x * 0.9) * 0.18 * (x / 7) * (0.5 + wind)); }
  a.needsUpdate = true; P.m.geometry.computeVertexNormals();
}

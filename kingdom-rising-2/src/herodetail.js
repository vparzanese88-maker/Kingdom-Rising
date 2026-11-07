// Close-up detail for the arena heroes: a sculpted face (eyes with coloured irises, lids, lashes, brows, a real nose,
// lips, ears), strand-clump hair and beards, hands with jointed fingers and nails, deltoids, veins on bare arms,
// stitched seams, and the secondary motion that makes cloth and muscle feel the pull of gravity.
// Everything here is plain meshes parented to the existing joints, so bake() still merges it per joint.
import * as THREE from 'three';

const GC = new Map();
const cached = (k, fn) => { let g = GC.get(k); if (!g) { g = fn(); GC.set(k, g); } return g; };
const mat = (c, r = 0.75, m = 0, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, o));
const sph = (r, w = 10, h = 8) => cached(`s${r}_${w}_${h}`, () => new THREE.SphereGeometry(r, w, h));
function add(parent, geo, m, x = 0, y = 0, z = 0, detail = false) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = !detail; if (detail) o.userData.detail = true; parent.add(o); return o; }
const tint = (base, col, k) => base.clone().lerp(new THREE.Color(col), k);
const bump = (nx, ny, nz, cx, cy, cz, w) => { const dx = nx - cx, dy = ny - cy, dz = nz - cz; return Math.exp(-(dx * dx + dy * dy + dz * dz) / (w * w)); };
const sat = (v) => Math.max(0, Math.min(1, v));

// ---------- the head ----------
// one deformed sphere: a long skull, a jaw that narrows to a chin, a brow ridge over sunken sockets, cheekbones
function skullGeo(female, broad) {
  return cached(`skull${female}${broad}`, () => {
    const g = new THREE.SphereGeometry(1, 34, 26), p = g.attributes.position, fk = female ? 0.45 : 1;
    for (let i = 0; i < p.count; i++) {
      const nx = p.getX(i), ny = p.getY(i), nz = p.getZ(i);
      let x = nx * 0.094 * (1 + broad * 0.06), y = ny * 0.118, z = nz * 0.106;
      const low = sat((0.15 - ny) / 1.15); x *= 1 - (female ? 0.44 : 0.36 - broad * 0.08) * Math.pow(low, 1.4); // the jaw narrows to the chin
      if (nz < 0 && ny < -0.15) z *= 1 - 0.42 * sat((-0.15 - ny) / 0.85); // no skull behind the jaw: the neck goes there
      if (nz > 0.55) z -= (nz - 0.55) * 0.016; // a flatter face
      for (const s of [-1, 1]) {
        z += 0.0075 * fk * bump(nx, ny, nz, s * 0.33, 0.33, 0.88, 0.22); // brow ridge
        z -= 0.013 * bump(nx, ny, nz, s * 0.34, 0.14, 0.93, 0.16); // eye sockets
        x += s * 0.007 * bump(nx, ny, nz, s * 0.64, -0.02, 0.74, 0.24); z += 0.004 * bump(nx, ny, nz, s * 0.64, -0.02, 0.74, 0.24); // cheekbones
        x -= s * 0.006 * bump(nx, ny, nz, s * 0.56, -0.42, 0.68, 0.22); // hollow under the cheekbone
        x -= s * 0.005 * bump(nx, ny, nz, s * 0.86, 0.36, 0.32, 0.25); // temples
        x += s * 0.006 * fk * bump(nx, ny, nz, s * 0.55, -0.72, 0.42, 0.22); // the corner of the jaw
      }
      z += 0.004 * bump(nx, ny, nz, 0, 0.28, 0.96, 0.18); // glabella
      z += 0.005 * bump(nx, ny, nz, 0, -0.45, 0.9, 0.24); // the mouth sits forward a little
      z += (female ? 0.006 : 0.011) * bump(nx, ny, nz, 0, -0.86, 0.45, 0.26); y -= 0.006 * fk * bump(nx, ny, nz, 0, -0.9, 0.4, 0.3); // chin
      z -= 0.008 * bump(nx, ny, nz, 0, 0.4, -0.9, 0.5); // the back of the skull
      p.setXYZ(i, x, y + 0.098, z);
    }
    g.computeVertexNormals(); return g;
  });
}
const EYES = ['#3a6ab0', '#4a8a4a', '#7a6a2a', '#5a3a1e', '#3a2414', '#7a8a96', '#b07a1a', '#2a5a7a'];
const GOBLIN_CLS = new Set(['musketeer', 'blunderbuss', 'bombardier']);

export function heroHead(g, app, mats, female) {
  const sk = mats.skin, race = app.race || 'human', gob = GOBLIN_CLS.has(app.cls) || race === 'goblin';
  const elf = race === 'woodelf' || race === 'highelf' || race === 'darkelf', orc = race === 'orc', dwarf = race === 'dwarf';
  add(g, skullGeo(female, orc || dwarf ? 1 : 0), sk);
  const skinC = sk.color, lidM = mat(tint(skinC, '#7a4a3a', 0.12), 0.6), shade = mat(tint(skinC, '#3a1a14', 0.35), 0.8);
  // ---- eyes: white, a coloured iris with a dark rim, a pupil, a wet highlight; lids and lashes over them ----
  const irisC = app.eye || EYES[(Math.random() * EYES.length) | 0];
  const white = mat('#f2ece4', 0.18), irisM = mat(gob ? '#f0c020' : irisC, 0.25), rimM = mat(tint(new THREE.Color(irisC), '#000000', 0.6), 0.4), pupM = mat('#050505', 0.1), shine = mat('#ffffff', 0.05);
  const lash = mat('#120c08', 0.9), browM = mat(mats.hair.color, 0.95);
  const eyeY = 0.1157, eyeZ = 0.0852, eyeX = 0.0318, er = 0.0128;
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(s * eyeX, eyeY, eyeZ); eg.rotation.y = s * 0.12; g.add(eg);
    add(eg, sph(er, 10, 7), white, 0, 0, 0, true);
    const ir = add(eg, sph(er * 0.56, 10, 5), irisM, 0, 0, er * 0.84, true); ir.scale.z = 0.32;
    const rim = add(eg, cached('irisrim', () => new THREE.TorusGeometry(er * 0.56, er * 0.07, 3, 12)), rimM, 0, 0, er * 0.86, true);
    const pu = add(eg, sph(er * 0.24, 6, 4), pupM, 0, 0, er * 0.94, true); pu.scale.z = 0.3;
    add(eg, sph(er * 0.09, 4, 3), shine, er * 0.22, er * 0.24, er * 1.0, true);
    const up = add(eg, cached('lidU', () => new THREE.SphereGeometry(er * 1.12, 10, 4, 0, Math.PI * 2, 0, Math.PI * 0.42)), lidM, 0, 0, 0, true); up.rotation.x = 0.16; // upper lid
    const lo = add(eg, cached('lidL', () => new THREE.SphereGeometry(er * 1.1, 10, 3, 0, Math.PI * 2, Math.PI * 0.72, Math.PI * 0.28)), lidM, 0, 0, 0, true); lo.rotation.x = -0.3; // lower lid
    const ls = add(eg, cached('lash', () => new THREE.TorusGeometry(er * 1.14, er * 0.075, 3, 14, Math.PI)), lash, 0, er * 0.42, er * 0.36, true); ls.rotation.x = -1.15; ls.scale.set(1.04, 1, 1); // upper lashes
    for (let k = 0; k < 5; k++) { const a = 0.35 + k * 0.6; const l = add(eg, cached('lashT', () => new THREE.ConeGeometry(er * 0.06, er * 0.4, 3)), lash, Math.cos(a) * er * 1.0, er * 0.78 + Math.sin(a) * er * 0.15, er * 0.7, true); l.rotation.set(0.6, 0, -Math.cos(a) * 0.7); } // a few lashes flicking up
    // brow: six tapering tufts along the ridge, thick near the nose
    for (let k = 0; k < 9; k++) { const t = k / 8, bx = s * (0.012 + t * 0.036), by = 0.137 + Math.sin(t * Math.PI) * 0.007 * (orc ? -0.3 : 1) - (elf ? -t * 0.006 : 0), bz = 0.099 - t * t * 0.02;
      const b = add(g, cached('browT', () => new THREE.BoxGeometry(0.0085, 0.0034, 0.0035)), browM, bx, by, bz, true); b.scale.set(1, 1.35 - t * 0.7, 1); b.rotation.set(-0.2, s * t * 0.5, s * (elf ? -0.25 : orc ? 0.35 : -0.12) + s * (t - 0.5) * 0.3); }
    add(g, sph(0.006, 6, 4), shade, s * 0.044, 0.1, 0.09, true).scale.set(1.6, 0.6, 0.5); // crease beside the eye
    flattenInto(eg, g); // (no extra joint for bake: the eye's parts merge into the head)
  }
  // ---- nose ----
  if (!gob) {
    const nk = dwarf ? 1.45 : orc ? 1.25 : elf ? 0.82 : 1, wide = orc ? 1.6 : dwarf ? 1.25 : elf ? 0.85 : 1;
    const br = add(g, cached('nbridge', () => { const b = new THREE.BoxGeometry(0.014, 0.044, 0.016, 1, 4, 1); const p = b.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (0.62 + (0.022 - y) * 14)); if (p.getZ(i) < 0) p.setZ(i, p.getZ(i) * 0.4); } b.computeVertexNormals(); return b; }), sk, 0, 0.092, 0.1);
    br.rotation.x = -0.3 * (orc ? 0.3 : 1); br.scale.set(wide, nk, nk * (orc ? 0.7 : 1));
    add(g, sph(0.0084, 12, 8), sk, 0, 0.073, 0.111 + (nk - 1) * 0.01).scale.set(wide * (dwarf ? 1.35 : 1.0), dwarf ? 1.2 : 0.95, dwarf ? 1.25 : 1.05);
    for (const s of [-1, 1]) { add(g, sph(0.0056, 10, 6), sk, s * 0.0084 * wide, 0.0698, 0.1028).scale.set(0.9, 0.8, 1.2); add(g, sph(0.003, 6, 4), mat('#2a1410', 0.9), s * 0.0058 * wide, 0.0665, 0.1082, true).scale.set(1.3, 0.55, 1); } // alae and nostrils
  }
  // ---- lips and mouth ----
  const lipM = mat(tint(skinC, female ? '#b04a52' : '#9a4a44', female ? 0.45 : 0.3), 0.45);
  add(g, sph(0.019, 14, 6), lipM, 0, 0.0525, 0.099).scale.set(1, 0.27, 0.36);
  add(g, sph(0.018, 14, 6), lipM, 0, 0.0445, 0.0975).scale.set(0.92, 0.33, 0.4);
  add(g, cached('mline', () => new THREE.BoxGeometry(0.03, 0.0016, 0.004)), mat('#3a1a16', 0.8), 0, 0.0487, 0.1045, true);
  add(g, sph(0.006, 6, 4), shade, 0, 0.058, 0.105, true).scale.set(0.8, 1.2, 0.3); // philtrum
  if (orc) for (const s of [-1, 1]) { const t = add(g, cached('htusk', () => new THREE.ConeGeometry(0.008, 0.04, 6)), mat('#efe6c8', 0.4), s * 0.02, 0.05, 0.1); t.rotation.z = s * 0.15; }
  // ---- ears ----
  if (!gob) for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(s * 0.086, 0.1, -0.004); eg.rotation.set(0, s * 0.35, 0); g.add(eg);
    const pin = add(eg, sph(0.026, 12, 10), sk, s * 0.004, 0, 0); pin.scale.set(0.3, 1, 0.68);
    const helix = add(eg, cached('helix', () => new THREE.TorusGeometry(0.021, 0.0045, 5, 16, Math.PI * 1.45)), sk, s * 0.007, 0.002, -0.001); helix.rotation.set(0, s * Math.PI / 2, Math.PI * 0.3);
    add(eg, sph(0.009, 8, 6), sk, s * 0.005, -0.024, 0.003).scale.set(0.6, 1, 0.9); // lobe
    add(eg, sph(0.01, 8, 6), shade, s * 0.0085, -0.002, 0.004, true).scale.set(0.3, 1.1, 0.8); // the hollow
    add(eg, sph(0.006, 6, 4), sk, s * 0.008, -0.006, 0.014).scale.set(0.6, 1, 0.8); // tragus
    if (elf || orc) { const hi = race === 'highelf', L = orc ? 0.07 : hi ? 0.13 : 0.1; const tip = add(eg, cached('etip' + L, () => { const c = new THREE.ConeGeometry(0.018, L, 8); c.translate(0, L / 2, 0); c.scale(0.35, 1, 1); return c; }), sk, s * 0.004, 0.01, -0.008); tip.rotation.set(-0.55, 0, -s * (orc ? 0.7 : 0.35));
      const rimT = add(eg, cached('etipR' + L, () => { const c = new THREE.CylinderGeometry(0.003, 0.005, L * 0.9, 5); c.translate(0, L * 0.45, 0); return c; }), sk, s * 0.008, 0.012, -0.016); rimT.rotation.copy(tip.rotation); }
    flattenInto(eg, g);
  }
  // ---- hair: strand clumps over a cap, a lighter streak through them ----
  const st = app.hairStyle ?? (female ? 1 : 0), hm = mats.hair;
  if (st !== 3) {
    const cap = add(g, cached('hcap2', () => new THREE.SphereGeometry(0.111, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.56)), hm, 0, 0.112, -0.016); cap.scale.set(0.93, 1.0, 1.04); cap.rotation.x = -0.5;
    const hl = mat(tint(hm.color, '#f0d8a0', 0.22), 0.7), clump = (len) => cached('clump' + len, () => { const c = new THREE.ConeGeometry(0.02, len, 5, 1); c.translate(0, -len / 2, 0); c.scale(1, 1, 0.28); return c; });
    const L = st === 1 ? 0.2 : st === 0 ? 0.06 : 0.09, n = st === 1 ? 64 : 48, q = new THREE.Quaternion(), up = new THREE.Vector3(0, -1, 0), d = new THREE.Vector3(), nrm = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const u = (i * 0.618034) % 1, v = (i + 0.5) / n, th = u * Math.PI * 2, ph = Math.acos(1 - v * 1.25); // spread over the top and back
      nrm.set(Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th));
      if (nrm.z > 0.35 && nrm.y < 0.75) continue; // keep the forehead clear
      const len = L * (0.7 + ((i * 37) % 10) / 22) * (nrm.y < 0.2 && st === 1 ? 1.4 : 1) * (nrm.y > 0.8 ? 0.55 : 1);
      // the strands fall back and down, lying along the scalp
      d.set(0, -0.35, -1).normalize(); if (nrm.z > 0.2) d.set(0, 0.25, -1).normalize(); else if (st === 1 || nrm.y < 0.3) d.set(nrm.x * 0.2, -1, -0.25).normalize(); d.set(d.x, d.y - 0.25, d.z).normalize(); d.addScaledVector(nrm, -d.dot(nrm)).normalize().addScaledVector(nrm, 0.07).normalize();
      const o = add(cap, clump(+len.toFixed(3)), i % 5 === 0 ? hl : hm, 0, 0, 0);
      // cap is rotated/scaled: place in head space then convert into the cap's frame
      const hp = new THREE.Vector3(nrm.x * 0.108, 0.104 + nrm.y * 0.112, nrm.z * 0.11 - 0.01);
      cap.updateMatrix(); const inv = cap.matrix.clone().invert(); hp.applyMatrix4(inv); o.position.copy(hp);
      const dl = d.clone().applyQuaternion(cap.quaternion.clone().invert()); q.setFromUnitVectors(up, dl); o.quaternion.copy(q); o.rotateY(Math.random() * 3);
    }
    if (st === 2 || st === 4) { // a tail of strands at the back (its own pivot so it can swing)
      const tail = new THREE.Group(); tail.position.set(0, 0.15, -0.105); g.add(tail); tail.userData.hairTail = true;
      const strands = st === 2 ? [[0, 0]] : [[-0.07, 0], [0.07, 0]];
      for (const [tx] of strands) for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; const c = add(tail, clump(0.26), k % 3 ? hm : hl, tx + Math.cos(a) * 0.008, -0.01, Math.sin(a) * 0.008); c.rotation.set(0.25, 0, Math.cos(a) * 0.08); }
      add(tail, sph(0.016, 8, 6), mat('#3a2010', 0.8), 0, -0.01, 0); g.userData.hairTail = tail;
    }
  }
  // ---- beard ----
  const bd = app.beard ?? (dwarf && !female ? 3 : 0);
  if (!female && bd > 0) {
    const bm = app.beardCol ? mat(app.beardCol, 0.9) : hm, len = bd === 1 ? 0.025 : bd === 2 ? 0.05 : 0.13;
    const bc = cached('bclump' + len, () => { const c = new THREE.ConeGeometry(0.008, len, 4, 1); c.translate(0, -len / 2, 0); c.scale(1, 1, 0.5); return c; });
    if (bd >= 2) { const sh2 = add(g, cached('bshell', () => new THREE.SphereGeometry(0.088, 16, 10, 0, Math.PI, Math.PI * 0.55, Math.PI * 0.4)), bm, 0, 0.068, 0.018); sh2.scale.set(0.94, bd === 2 ? 0.8 : 1.1, 1.05); }
    for (let i = 0; i < 44; i++) { const a = -1.25 + ((i % 11) + (((i / 11) | 0) % 2) * 0.5) / 10.5 * 2.5, row = (i / 11) | 0; const x = Math.sin(a) * (0.072 - row * 0.008), z = Math.cos(a) * 0.07 + 0.02, y = 0.06 - row * 0.022 - Math.cos(a) * 0.02;
      const c = add(g, bc, bm, x, y, z); c.rotation.set(0.35 + row * 0.15, 0, -Math.sin(a) * 0.4); }
    if (bd >= 2) for (const s of [-1, 1]) { const m = add(g, cached('mous2', () => { const c = new THREE.ConeGeometry(0.007, 0.034, 5); c.rotateZ(Math.PI / 2); return c; }), bm, s * 0.015, 0.058, 0.104); m.rotation.z = s * -0.35; m.scale.x = s; }
  }
  g.userData.eyes = true;
}

// ---------- hands ----------
// fingers stack front to back across the palm and curl inward around a handle running front to back (the grip axis)
function flattenInto(group, target) { group.updateMatrixWorld(true); const inv = target.matrixWorld.clone().invert(); const list = []; group.traverse(o => { if (o.isMesh) list.push(o); });
  for (const o of list) { const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); o.parent.remove(o); m.decompose(o.position, o.quaternion, o.scale); target.add(o); } group.parent && group.parent.remove(group); }
export function heroHand(hand, s, skinM, k, grip) {
  const xi = -s, root = new THREE.Group(); root.scale.setScalar(k); hand.add(root);
  const nailM = mat(tint(skinM.color, '#f6d6d0', 0.55), 0.25), crease = mat(tint(skinM.color, '#5a2a20', 0.25), 0.8);
  const palm = add(root, cached('palm2', () => { const b = new THREE.BoxGeometry(0.026, 0.07, 0.06, 1, 2, 2); const p = b.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i), y = p.getY(i); p.setX(i, p.getX(i) * (1 - z * z * 60) * (y > 0.02 ? 0.85 : 1)); } b.computeVertexNormals(); return b; }), skinM, 0, -0.04, 0.003);
  palm.castShadow = true;
  for (let i = 0; i < 4; i++) add(root, sph(0.006, 6, 4), skinM, -xi * 0.011, -0.073, 0.022 - i * 0.0145, true); // knuckles on the back of the hand
  const curl = grip ? [1.45, 1.5, 1.1] : [0.35, 0.5, 0.4];
  const F = [[0.022, 1.0, 1], [0.0075, 1.08, 1], [-0.0075, 1.0, 0.95], [-0.021, 0.8, 0.85]];
  for (const [fz, lk, rk] of F) {
    let par = new THREE.Group(); par.position.set(xi * 0.003, -0.075, fz); par.rotation.z = xi * curl[0] * (grip ? 1 : 0.8 + Math.abs(fz) * 6); par.rotation.x = -fz * 1.2; root.add(par);
    const segs = [0.024, 0.017, 0.014];
    for (let j = 0; j < 3; j++) { const L = segs[j] * lk, r = (0.0062 - j * 0.0005) * rk;
      add(par, sph(r * 0.98, 5, 4), skinM, 0, 0, 0, true); // the joint
      const f = add(par, cached(`fseg${(L * 1000) | 0}_${(r * 10000) | 0}`, () => { const c = new THREE.CylinderGeometry(r * (j === 2 ? 0.82 : 0.92), r, L, 7); c.translate(0, -L / 2, 0); return c; }), skinM, 0, 0, 0); f.userData.finger = true; f.castShadow = j === 0;
      if (j === 2) { add(par, sph(r * 0.8, 6, 5), skinM, 0, -L, 0, true).userData.finger = true; const n = add(par, cached('nail', () => new THREE.BoxGeometry(0.0018, 0.009, 0.0085)), nailM, -xi * r * 0.8, -L * 0.62, 0, true); n.userData.nail = true; n.scale.set(1, 1, rk); n.rotation.z = xi * 0.08; }
      else if (j === 0) add(par, cached('fcrease', () => new THREE.BoxGeometry(0.0012, 0.0012, 0.012)), crease, xi * r * 0.95, -L, 0, true);
      const nx = new THREE.Group(); nx.position.y = -L; nx.rotation.z = xi * curl[Math.min(2, j + 1)] * (j === 1 ? 0.9 : 1); par.add(nx); par = nx; }
  }
  // the thumb: from the heel of the palm, forward and across the grip
  { let par = new THREE.Group(); par.position.set(xi * 0.01, -0.03, 0.028); par.rotation.set(grip ? -0.9 : -0.5, 0, xi * (grip ? 0.85 : 0.45)); root.add(par);
    add(par, sph(0.012, 8, 6), skinM, 0, -0.008, 0).scale.set(1, 1.4, 1); // the ball of the thumb
    for (let j = 0; j < 2; j++) { const L = j ? 0.018 : 0.022, r = j ? 0.0066 : 0.0076;
      add(par, sph(r, 7, 5), skinM, 0, 0, 0, true); const f = add(par, cached(`tseg${j}`, () => { const c = new THREE.CylinderGeometry(r * 0.85, r, L, 7); c.translate(0, -L / 2, 0); return c; }), skinM); f.userData.finger = true;
      if (j === 1) { add(par, sph(r * 0.85, 7, 5), skinM, 0, -L, 0, true).userData.finger = true; const n = add(par, cached('tnail', () => new THREE.BoxGeometry(0.0024, 0.012, 0.011)), nailM, -xi * r * 0.8, -L * 0.6, 0, true); n.userData.nail = true; }
      const nx = new THREE.Group(); nx.position.y = -L; nx.rotation.z = xi * (grip ? 0.7 : 0.3); par.add(nx); par = nx; } }
  // tendons and a vein over the back of the hand
  for (let i = 0; i < 3; i++) add(root, cached('tendon', () => new THREE.CylinderGeometry(0.0011, 0.0014, 0.04, 4)), skinM, -xi * 0.0128, -0.045, 0.014 - i * 0.014, true).rotation.x = (i - 1) * -0.12;
  flattenInto(root, hand);
}

// ---------- shoulders, veins ----------
export function deltoids(ch, uaM, mus) { const T = ch.R.thick;
  for (const sd of ['L', 'R']) { const s = sd === 'L' ? 1 : -1, sh = ch.arms[sd].sh;
    const d = add(sh, cached('delt', () => { const g = new THREE.SphereGeometry(0.07, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.72); g.translate(0, -0.012, 0); return g; }), uaM, s * 0.006, 0.004, 0); d.scale.set(0.98 * T * (0.9 + 0.1 * mus), 1.25 * (0.95 + 0.05 * mus), 1.12 * T); d.rotation.z = s * -0.25;
  } }
const veinGeo = (key, pts, r) => cached(key, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, r, 4, false));
export function veins(ch, skinM, opts = {}) { // raised veins winding down the forearm, up the inside of the biceps, over the back of the hand
  const T = ch.R.thick, ua = ch.R.armL * 0.52, fa = ch.R.armL * 0.46, m = mat(tint(skinM.color, '#4a5a7a', 0.22), 0.5);
  const faR = (t) => (t < 0.22 ? 0.05 + (0.056 - 0.05) * t / 0.22 : t < 0.6 ? 0.056 - (0.012) * (t - 0.22) / 0.38 : 0.044 - 0.011 * (t - 0.6) / 0.4) * T;
  const uaR = (t) => (t < 0.12 ? 0.07 : t < 0.45 ? 0.075 - 0.013 * (t - 0.12) / 0.33 : 0.062 - 0.015 * (t - 0.45) / 0.55) * T * (opts.mus || 1);
  for (const sd of ['L', 'R']) { const s = sd === 'L' ? 1 : -1, A = ch.arms[sd];
    for (const [a0, a1, w] of [[0.3, 0.9, 1], [1.4, 1.0, 0.8], [-0.4, 0.2, 0.7]]) { const pts = []; for (let i = 0; i <= 6; i++) { const t = 0.08 + i / 6 * 0.86, a = a0 + (a1 - a0) * t + Math.sin(t * 9 + a0 * 3) * 0.12, r = faR(t) * 1.0;
        pts.push(new THREE.Vector3(s * Math.sin(a) * r * -1, -t * fa, Math.cos(a) * r * 0.86)); }
      add(A.el, veinGeo(`vf${sd}${a0}${T.toFixed(2)}${fa.toFixed(3)}`, pts, 0.0022 * w * T), m, 0, 0, 0, true); }
    { const pts = []; for (let i = 0; i <= 6; i++) { const t = 0.25 + i / 6 * 0.7, a = 0.6 + Math.sin(t * 7) * 0.15, r = uaR(t) * 0.93; pts.push(new THREE.Vector3(s * -Math.sin(a) * r, -t * ua, Math.cos(a) * r * 0.92)); }
      add(A.sh, veinGeo(`vb${sd}${T.toFixed(2)}${ua.toFixed(3)}${opts.mus || 1}`, pts, 0.0026 * T), m, 0, 0, 0, true); }
  }
}

// ---------- stitching ----------
const STITCH = () => cached('stitch', () => { const g = new THREE.BoxGeometry(0.0065, 0.0016, 0.0018); g.deleteAttribute('uv'); return g; });
function stitchLine(parent, a, b, n, m, rotZ = 0.5) { for (let i = 0; i <= n; i++) { const t = i / n, o = add(parent, STITCH(), m, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, true);
  const dx = b.x - a.x, dy = b.y - a.y; o.rotation.z = Math.atan2(dy, dx) + rotZ; if (Math.abs(b.z - a.z) > Math.abs(dx) + Math.abs(dy)) o.rotation.y = Math.PI / 2; } }
export function stitching(ch, O, mats) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z), T = ch.R.thick, tl = ch.R.legL * 0.5;
  const thread = (c) => mat(tint(new THREE.Color(c), '#e8d8b0', 0.45), 0.9);
  // outer seam down each trouser leg
  const pt = thread(mats.pants.color.getStyle());
  for (const sd of ['L', 'R']) { const s = sd === 'L' ? 1 : -1, th = ch.legs[sd].thigh; stitchLine(th, V(s * 0.093 * T * 0.98, -0.02, 0), V(s * 0.062 * T * 0.98, -tl * 0.95, 0), 11, pt, Math.PI / 2 + 0.5); }
  // the cuffs of the sleeves / the top of the bracers
  if (!O.bareArms) for (const sd of ['L', 'R']) { const el = ch.arms[sd].el, m = thread(mats.shirt.color.getStyle()); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, o = add(el, STITCH(), m, Math.sin(a) * 0.057 * T, -0.012, Math.cos(a) * 0.05 * T, true); o.rotation.y = a; o.rotation.z = 0.5; } }
  // tabard edges and hem, the chest tabard border
  for (const k of ['tabard1', 'tabard-1']) { const tb = ch.outfit && ch.outfit[k]; if (!tb) continue; const zs = k === 'tabard1' ? 1 : -1, m = thread('#2a1a10');
    for (const x of [-0.088, 0.088]) stitchLine(tb, V(x, 0.29, zs * 0.0075), V(x, -0.28, zs * 0.0075), 14, m, Math.PI / 2 + 0.5); stitchLine(tb, V(-0.085, -0.27, zs * 0.0075), V(0.085, -0.27, zs * 0.0075), 12, m); }
  // a seam down the front of a vest
  if (ch.outfit && ch.outfit.vest) { const th = ch.R.torsoH - 0.2, m = thread('#1a120a'); for (const x of [-0.012, 0.012]) stitchLine(ch.chest, V(x, -0.04, 0.152 * T * 0.7 + 0.004), V(x, th * 0.82, ch.R.sw * 0.6 * 0.7 + 0.004), 14, m, Math.PI / 2 + 0.5); }
  // robe hem
  if (ch.outfit && ch.outfit.robe) { const L = ch.R.legL + 0.02, m = thread('#1a120a'); for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, o = add(ch.hips, STITCH(), m, Math.sin(a) * 0.252 * T, -L + 0.085, Math.cos(a) * 0.252 * T * 0.8, true); o.rotation.y = a; o.rotation.z = 0.4; } }
  // the shoulder seam of the shirt
  if (!O.robe && !O.mail) { const th = ch.R.torsoH - 0.2, m = thread(mats.shirt.color.getStyle()); for (const s of [-1, 1]) stitchLine(ch.chest, V(s * 0.06, th + 0.055, 0.0), V(s * ch.R.sw * 0.95, th * 0.95, 0.0), 10, m, 0.5); }
}

// ---------- secondary motion: things that hang fall under gravity and swing with the body ----------
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _yaw = new THREE.Quaternion(), _s = new THREE.Vector3(), _fw = new THREE.Vector3();
export function addDangle(ch, obj, o = {}) { if (!obj || !obj.parent) return null;
  const d = { obj, rest: obj.quaternion.clone(), hang: o.hang ?? 0.8, k: o.k ?? 60, damp: o.damp ?? 7, gain: o.gain ?? 0.035, drag: o.drag ?? 0.05, max: o.max ?? 1.2, side: o.side ?? 0.6, ax: 0, az: 0, vx: 0, vz: 0, last: null, lv: new THREE.Vector3() };
  (ch.dangles = ch.dangles || []).push(d); return d; }
export function addJiggle(ch, obj, o = {}) { if (!obj) return null; const j = { obj, rest: obj.scale.clone(), amt: o.amt ?? 0.05, k: o.k ?? 140, damp: o.damp ?? 9, s: 0, v: 0, last: null, lvy: 0 }; (ch.jiggles = ch.jiggles || []).push(j); return j; }
export function tickSecondary(ch, dt) {
  if (!(dt > 0) || dt > 0.1) return;
  if (ch.dangles) for (const d of ch.dangles) { const par = d.obj.parent; if (!par) continue;
    par.matrixWorld.decompose(_p, _q, _s);
    if (!d.last) { d.last = _p.clone(); continue; }
    _v.copy(_p).sub(d.last).divideScalar(dt); d.last.copy(_p); const ax = (_v.x - d.lv.x) / dt, az = (_v.z - d.lv.z) / dt, ay = (_v.y - d.lv.y) / dt; d.lv.copy(_v);
    // the body's facing, from the root's yaw only
    const rootQ = ch.root.quaternion; _fw.set(0, 0, 1).applyQuaternion(rootQ); const yaw = Math.atan2(_fw.x, _fw.z); _yaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), vf = _v.x * sy + _v.z * cy, vs = _v.x * cy - _v.z * sy, af = ax * sy + az * cy, as = ax * cy - az * sy;
    // targets: trail behind the motion, kick back on acceleration, lift a little when falling
    const tx = Math.max(-d.max, Math.min(d.max, vf * d.drag + af * d.gain * 0.02 + Math.min(0, ay) * -0.004)), tz = Math.max(-d.max, Math.min(d.max, -(vs * d.drag + as * d.gain * 0.02) * d.side));
    d.vx += ((tx - d.ax) * d.k - d.vx * d.damp) * dt; d.vz += ((tz - d.az) * d.k - d.vz * d.damp) * dt; d.ax += d.vx * dt; d.az += d.vz * dt;
    if (!isFinite(d.ax) || !isFinite(d.az)) { d.ax = d.az = d.vx = d.vz = 0; }
    // gravity: undo the parent's lean (keep only its facing), then swing; blend with the rigid rest pose by `hang`
    _qi.copy(_q).invert(); const grav = _qi.multiply(_yaw); // parent^-1 * yaw: hangs straight down in world
    _e.set(d.ax, 0, d.az); const sw = new THREE.Quaternion().setFromEuler(_e);
    const hangQ = grav.multiply(sw).multiply(d.rest), rigid = d.rest.clone().multiply(sw);
    d.obj.quaternion.copy(rigid).slerp(hangQ, d.hang); }
  if (ch.jiggles) for (const j of ch.jiggles) { const par = j.obj.parent; if (!par) continue; const y = par.matrixWorld.elements[13];
    if (j.last == null) { j.last = y; continue; } const vy = (y - j.last) / dt; j.last = y; const ay = (vy - j.lvy) / dt; j.lvy = vy;
    j.v += (-j.s * j.k - j.v * j.damp - Math.max(-60, Math.min(60, ay)) * j.amt) * dt; j.s += j.v * dt; j.s = Math.max(-0.12, Math.min(0.12, j.s));
    const sy = 1 + j.s, sxz = 1 / Math.sqrt(sy); j.obj.scale.set(j.rest.x * sxz, j.rest.y * sy, j.rest.z * sxz); }
}

// ---------- per-class stance and gait (offsets removed again at the start of the next frame) ----------
export function styleUndo(ch) { const o = ch._so; if (!o) return; for (let i = 0; i < o.length; i += 3) o[i].rotation[o[i + 1]] -= o[i + 2]; o.length = 0; }
export function styleApply(ch, st, S, ph, amp, walkF, runF) {
  const o = ch._so = ch._so || []; const put = (obj, ax, v) => { if (!v) return; obj.rotation[ax] += v; o.push(obj, ax, v); };
  const roll = st.roll != null, dead = st.dead || st.lie || st.sit || st.swim; if (dead) return;
  const W = roll ? 0 : 1, armW = W * (st.action || st.block || st.bowDraw || st.aimStaff ? 0.15 : 1), idle = 1 - walkF;
  const { hips, spine, chest, neck, arms, legs } = ch;
  const crouch = (S.crouch || 0) * W * (1 - runF * 0.4);
  hips.position.y -= crouch * 0.55 * (ch.R.legL / 0.9);
  put(legs.L.thigh, 'x', -crouch * 1.5); put(legs.R.thigh, 'x', -crouch * 1.5); put(legs.L.knee, 'x', crouch * 3); put(legs.R.knee, 'x', crouch * 3); put(legs.L.ankle, 'x', -crouch * 1.5); put(legs.R.ankle, 'x', -crouch * 1.5);
  const wide = (S.wide || 0) * W * (1 - walkF * 0.6); put(legs.L.thigh, 'z', wide); put(legs.R.thigh, 'z', -wide);
  const toe = (S.toe || 0) * W; put(legs.L.thigh, 'y', toe); put(legs.R.thigh, 'y', -toe);
  if (S.tiptoe) { put(legs.L.ankle, 'x', S.tiptoe * W * 0.6); put(legs.R.ankle, 'x', S.tiptoe * W * 0.6); }
  const hunch = ((S.hunch || 0) + (S.runLean || 0) * runF) * W; put(spine, 'x', hunch * 0.7); put(chest, 'x', hunch * 0.5 - (S.chest || 0) * W);
  put(neck, 'x', ((S.head || 0) - hunch * 0.85 + (S.chest || 0) * 0.6) * W);
  const sw = (S.swagger || 0) * W * amp; if (sw) { put(hips, 'z', -Math.sin(ph) * 0.1 * sw); put(chest, 'z', Math.sin(ph) * 0.07 * sw); put(hips, 'y', Math.sin(ph) * 0.06 * sw); }
  if (S.rock) { const r = Math.sin(ph) * S.rock * W * walkF; put(hips, 'z', -r); put(spine, 'z', r * 1.4); }
  if (S.idleSway) { const r = Math.sin(ch.anim.t * 1.1) * S.idleSway * idle * W; put(spine, 'z', r); put(neck, 'z', -r * 0.6); }
  const out = (S.arms || 0) * armW; put(arms.R.sh, 'z', out); put(arms.L.sh, 'z', -out);
  const elb = (S.elbow || 0) * armW; put(arms.R.el, 'x', -elb); put(arms.L.el, 'x', -elb);
  if (S.armFwd) { put(arms.R.sh, 'x', -S.armFwd * armW); put(arms.L.sh, 'x', -S.armFwd * armW); }
  if (S.clasp) { const c = S.clasp * armW * idle; put(arms.L.sh, 'x', -0.55 * c); put(arms.L.sh, 'z', 0.45 * c); put(arms.L.el, 'x', -1.1 * c); }
  if (S.jitter) { const j = Math.sin(ch.anim.t * 23) * Math.sin(ch.anim.t * 7.3) * S.jitter * W; put(neck, 'y', j); put(chest, 'y', j * 0.4); }
}

import * as THREE from 'three';

const shared = new Map();
// shared material (scenery); use own=true for characters so hit flashes stay per-character
export function mat(color, own = false, extra = {}) {
  if (own) return new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
  const key = color + JSON.stringify(extra);
  if (!shared.has(key)) shared.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra }));
  return shared.get(key);
}
const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = `${w},${h},${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
export function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(boxGeo(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}
function cyl(rt, rb, h, m, seg = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.castShadow = true;
  return mesh;
}

// ---------- Weapons ----------
export function makeWeapon(type, tier = 1) {
  const g = new THREE.Group();
  const metal = mat([0x9aa0a6, 0x8fb8d8, 0xe0a640][tier - 1] ?? 0x9aa0a6, false, { emissive: tier === 3 ? 0x3a2000 : 0x000000 });
  const wood = mat(0x6b4a2a), dark = mat(0x2a2018), gold = mat(0xc8a040);
  if (type === 'sword' || type === 'cutlass') {
    const len = type === 'cutlass' ? 0.8 : 0.95;
    g.add(box(0.07, 0.24, 0.07, dark, 0, 0, 0));
    g.add(box(0.36, 0.07, 0.09, gold, 0, 0.14, 0));
    g.add(box(0.1, len, 0.035, type === 'cutlass' ? mat(0x7d7c72) : metal, 0, 0.17 + len / 2, 0));
    g.rotation.x = Math.PI / 2;
  } else if (type === 'shield') {
    const s = box(0.62, 0.72, 0.08, mat(0x6a3a22), 0, 0, 0);
    g.add(s);
    g.add(box(0.66, 0.08, 0.1, metal, 0, 0.32, 0));
    g.add(box(0.66, 0.08, 0.1, metal, 0, -0.32, 0));
    g.add(box(0.2, 0.2, 0.06, metal, 0, 0, 0.06));
  } else if (type === 'greataxe') {
    g.add(box(0.07, 1.6, 0.07, wood, 0, 0.55, 0));
    g.add(box(0.05, 0.52, 0.5, metal, 0, 1.2, 0.22));
    g.add(box(0.05, 0.3, 0.18, metal, 0, 1.22, -0.1));
    g.rotation.x = Math.PI / 2;
  } else if (type === 'hammer') {
    g.add(box(0.08, 1.4, 0.08, wood, 0, 0.45, 0));
    g.add(box(0.36, 0.34, 0.6, metal, 0, 1.15, 0));
    g.rotation.x = Math.PI / 2;
  } else if (type === 'club') {
    g.add(box(0.12, 1.2, 0.12, wood, 0, 0.45, 0));
    g.add(box(0.3, 0.5, 0.3, mat(0x3a2a1a), 0, 1.0, 0));
    g.rotation.x = Math.PI / 2;
  } else if (type === 'greatsword') {
    g.add(box(0.09, 0.4, 0.09, dark, 0, 0, 0));
    g.add(box(0.5, 0.09, 0.1, mat(0x5a0a0a), 0, 0.22, 0));
    g.add(box(0.16, 1.7, 0.05, mat(0x2a1a1a, false, { emissive: 0x401008 }), 0, 1.1, 0));
    g.rotation.x = Math.PI / 2;
  } else if (type === 'bow') {
    const bm = mat([0x8a5a32, 0x6a3a22, 0x5a2a5a][tier - 1] ?? 0x8a5a32);
    for (let i = -3; i <= 3; i++) {
      const a = i / 3 * 0.9;
      const seg = box(0.06, 0.22, 0.06, bm, 0, Math.sin(a) * 0.6, Math.cos(a) * 0.25 - 0.2);
      seg.rotation.x = -a;
      g.add(seg);
    }
    const str = box(0.015, 1.1, 0.015, mat(0xe8e0c8), 0, 0, -0.24);
    g.add(str);
    g.userData.string = str;
  }
  return g;
}

// ---------- Humanoid ----------
// Faces +z. Returns { root, parts, mats }
export function makeHumanoid(o = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // scaled, bobbing
  root.add(body);
  const s = o.size || 1;
  body.scale.setScalar(s);
  const skin = mat(o.skin ?? 0xe0b48a, true), shirt = mat(o.shirt ?? 0x6a5236, true), pants = mat(o.pants ?? 0x40362a, true), boot = mat(o.boots ?? 0x2a2018, true);
  const mats = [skin, shirt, pants, boot];
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
  const upper = new THREE.Group(); hips.add(upper);
  if (o.hunched) upper.rotation.x = 0.35;
  const torso = box(0.62, 0.72, 0.36, shirt, 0, 0.38, 0); upper.add(torso);
  const belt = box(0.64, 0.1, 0.38, boot, 0, 0.05, 0); upper.add(belt);
  const head = new THREE.Group(); head.position.y = 1.0; upper.add(head);
  head.add(box(0.42, 0.44, 0.42, skin, 0, 0, 0));
  const eyeM = o.eyes ? mat(o.eyes, false, { emissive: o.eyes }) : mat(0x1a1410);
  head.add(box(0.08, 0.06, 0.02, eyeM, 0.1, 0.04, 0.215));
  head.add(box(0.08, 0.06, 0.02, eyeM, -0.1, 0.04, 0.215));
  if (o.hair !== undefined) head.add(box(0.46, 0.14, 0.46, mat(o.hair, true), 0, 0.2, -0.02));
  if (o.hat) { head.add(box(0.7, 0.06, 0.7, mat(0x1a1a22), 0, 0.24, 0)); head.add(box(0.44, 0.24, 0.44, mat(0x1a1a22), 0, 0.36, 0)); }
  if (o.horns) {
    const hm = mat(0x1a0a08);
    const h1 = box(0.08, 0.4, 0.08, hm, 0.2, 0.32, 0); h1.rotation.z = -0.5; head.add(h1);
    const h2 = box(0.08, 0.4, 0.08, hm, -0.2, 0.32, 0); h2.rotation.z = 0.5; head.add(h2);
  }
  if (o.helm) head.add(box(0.48, 0.3, 0.48, mat(o.helm, true), 0, 0.12, -0.01));
  const mkArm = side => {
    const a = new THREE.Group(); a.position.set(side * 0.42, 0.66, 0); upper.add(a);
    a.add(box(0.2, 0.62, 0.22, shirt, 0, -0.28, 0));
    a.add(box(0.18, 0.16, 0.2, skin, 0, -0.66, 0));
    const hand = new THREE.Group(); hand.position.set(0, -0.68, 0.04); a.add(hand);
    return [a, hand];
  };
  const [armR, handR] = mkArm(-1);
  const [armL, handL] = mkArm(1);
  const mkLeg = side => {
    const l = new THREE.Group(); l.position.set(side * 0.17, 0, 0); hips.add(l);
    l.add(box(0.25, 0.62, 0.28, pants, 0, -0.32, 0));
    l.add(box(0.27, 0.3, 0.34, boot, 0, -0.78, 0.03));
    return l;
  };
  const legR = mkLeg(-1), legL = mkLeg(1);
  return { root, body, mats, parts: { hips, upper, torso, head, armR, armL, handR, handL, legR, legL }, size: s, hunched: !!o.hunched };
}

// Recolor armor pieces on the player model by gear tier
export function dressHumanoid(h, look) {
  const [skin, shirt, pants, boot] = h.mats;
  shirt.color.setHex(look.chest);
  pants.color.setHex(look.legs);
  boot.color.setHex(look.feet);
  const head = h.parts.head;
  if (head.userData.helm) { head.remove(head.userData.helm); head.userData.helm = null; }
  if (look.helm != null) {
    const hg = new THREE.Group();
    hg.add(box(0.48, 0.28, 0.48, mat(look.helm), 0, 0.12, -0.01));
    if (look.helmTier >= 2) hg.add(box(0.06, 0.22, 0.1, mat(look.helm), 0, 0.33, 0));
    head.add(hg); head.userData.helm = hg;
  }
}

// ---------- Quadrupeds ----------
export function makeBeast(kind, o = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const s = o.size || 1;
  body.scale.setScalar(s);
  const fur = mat(o.color ?? 0x7b7468, true), dark = mat(0x2a2420, true);
  const mats = [fur, dark];
  const eyeM = mat(o.eyes ?? 0xffd040, false, { emissive: o.eyes ?? 0x403000 });
  const torso = new THREE.Group(); torso.position.y = kind === 'boar' ? 0.62 : 0.72; body.add(torso);
  if (kind === 'boar') {
    torso.add(box(0.7, 0.62, 1.15, fur, 0, 0, 0));
    torso.add(box(0.2, 0.2, 0.9, dark, 0, 0.36, -0.05));
  } else {
    torso.add(box(0.48, 0.5, 1.15, fur, 0, 0, 0));
    torso.add(box(0.56, 0.56, 0.5, fur, 0, 0.04, 0.3));
  }
  const head = new THREE.Group(); head.position.set(0, kind === 'boar' ? 0.0 : 0.22, kind === 'boar' ? 0.68 : 0.72); torso.add(head);
  if (kind === 'boar') {
    head.add(box(0.52, 0.48, 0.5, fur, 0, 0, 0.1));
    head.add(box(0.3, 0.26, 0.2, mat(0xc89080, true), 0, -0.08, 0.42));
    head.add(box(0.06, 0.2, 0.06, mat(0xf0e8d0), 0.2, 0.0, 0.38));
    head.add(box(0.06, 0.2, 0.06, mat(0xf0e8d0), -0.2, 0.0, 0.38));
    head.add(box(0.07, 0.07, 0.02, eyeM, 0.16, 0.1, 0.36));
    head.add(box(0.07, 0.07, 0.02, eyeM, -0.16, 0.1, 0.36));
  } else {
    head.add(box(0.4, 0.38, 0.44, fur, 0, 0, 0.1));
    head.add(box(0.24, 0.2, 0.32, fur, 0, -0.08, 0.42));
    head.add(box(0.1, 0.08, 0.06, dark, 0, -0.02, 0.6));
    head.add(box(0.1, 0.18, 0.08, fur, 0.13, 0.26, 0.0));
    head.add(box(0.1, 0.18, 0.08, fur, -0.13, 0.26, 0.0));
    head.add(box(0.07, 0.06, 0.02, eyeM, 0.11, 0.06, 0.33));
    head.add(box(0.07, 0.06, 0.02, eyeM, -0.11, 0.06, 0.33));
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.12, -0.58); torso.add(tail);
  tail.add(box(0.12, 0.12, kind === 'boar' ? 0.2 : 0.55, fur, 0, 0, -0.25));
  tail.rotation.x = kind === 'boar' ? 0 : 0.5;
  const legs = [];
  const lh = kind === 'boar' ? 0.42 : 0.55;
  for (const [x, z] of [[0.18, 0.4], [-0.18, 0.4], [0.18, -0.42], [-0.18, -0.42]]) {
    const l = new THREE.Group(); l.position.set(x, -0.15, z); torso.add(l);
    l.add(box(0.14, lh, 0.16, fur, 0, -lh / 2, 0));
    l.add(box(0.15, 0.08, 0.18, dark, 0, -lh, 0.02));
    legs.push(l);
  }
  return { root, body, mats, parts: { torso, head, tail, legs }, size: s, beast: true };
}

// ---------- Scenery ----------
const trunkM = () => mat(0x5a4028);
export function makeTree(kind = 'oak', scale = 1) {
  const g = new THREE.Group();
  if (kind === 'pine') {
    const t = cyl(0.18, 0.28, 2.2, trunkM(), 6); t.position.y = 1.1; g.add(t);
    const lm = mat(0x2f5a32);
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.6 - i * 0.4, 1.8, 7), lm); c.position.y = 2.2 + i * 1.0; c.castShadow = true; g.add(c); }
  } else if (kind === 'dead') {
    const t = cyl(0.14, 0.3, 3.2, mat(0x3a2e26), 5); t.position.y = 1.6; g.add(t);
    const b1 = cyl(0.06, 0.1, 1.4, mat(0x3a2e26), 4); b1.position.set(0.4, 2.6, 0); b1.rotation.z = -0.8; g.add(b1);
    const b2 = cyl(0.06, 0.1, 1.2, mat(0x3a2e26), 4); b2.position.set(-0.35, 2.2, 0.1); b2.rotation.z = 0.9; g.add(b2);
  } else if (kind === 'willow') {
    const t = cyl(0.25, 0.4, 2.4, mat(0x4a3a2a), 6); t.position.y = 1.2; g.add(t);
    const lm = mat(0x56703a);
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), lm); c.position.y = 3.0; c.scale.y = 0.8; c.castShadow = true; g.add(c);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(box(0.3, 1.6, 0.3, lm, Math.cos(a) * 1.4, 2.0, Math.sin(a) * 1.4)); }
  } else if (kind === 'wyrd') {
    const t = cyl(0.22, 0.42, 3, mat(0x3a2440), 6); t.position.y = 1.5; g.add(t);
    const lm = mat(0x8a3a6a, false, { emissive: 0x2a0a20 });
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 - i * 0.15, 0), lm); c.position.set((i - 1) * 0.7, 3.2 + (i % 2) * 0.6, (i % 2) * 0.4); c.castShadow = true; g.add(c); }
  } else {
    const t = cyl(0.22, 0.34, 2.0, trunkM(), 6); t.position.y = 1.0; g.add(t);
    const lm = mat(kind === 'aged' ? 0x4a6a2e : 0x4f8a3a);
    const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), lm); c1.position.y = 2.8; c1.castShadow = true; g.add(c1);
    const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 0), lm); c2.position.set(0.8, 2.4, 0.3); c2.castShadow = true; g.add(c2);
    if (kind === 'aged') { const c3 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), lm); c3.position.set(-0.7, 3.3, -0.3); c3.castShadow = true; g.add(c3); }
  }
  g.scale.setScalar(scale);
  return g;
}

export function makeRock(kind = 'iron', scale = 1) {
  const g = new THREE.Group();
  const rm = mat(kind === 'plain' ? 0x8a8478 : 0x77736a);
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rm);
  r.scale.set(1.2, 0.8, 1); r.position.y = 0.5; r.castShadow = true; r.receiveShadow = true;
  g.add(r);
  const vc = { iron: 0xb07a5a, starmetal: 0x7ac0ff, orichalcum: 0xffa830 }[kind];
  if (vc) {
    const vm = mat(vc, false, { emissive: kind === 'iron' ? 0x000000 : vc, emissiveIntensity: 0.35 });
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      const v = box(0.24, 0.24, 0.24, vm, Math.cos(a) * 0.9, 0.5 + Math.sin(i * 2.1) * 0.3, Math.sin(a) * 0.75);
      v.rotation.set(i, i * 2, 0);
      g.add(v);
    }
  }
  g.scale.setScalar(scale);
  return g;
}

export function makePlant(kind = 'hemp') {
  const g = new THREE.Group();
  const lm = mat(kind === 'silkweed' ? 0x9ab0c8 : 0x6ab04a);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const st = box(0.06, 0.9, 0.06, lm, Math.cos(a) * 0.2, 0.45, Math.sin(a) * 0.2);
    st.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
    g.add(st);
  }
  const fm = mat(kind === 'silkweed' ? 0xf0f4ff : 0xd8e070);
  for (let i = 0; i < 3; i++) g.add(box(0.16, 0.16, 0.16, fm, Math.cos(i * 2) * 0.25, 0.95, Math.sin(i * 2) * 0.25));
  return g;
}

export function makeHouse(w = 6, d = 5, color = 0x8a6a48, roof = 0x7a3a28) {
  const g = new THREE.Group();
  const wall = box(w, 3, d, mat(color), 0, 1.5, 0); wall.receiveShadow = true; g.add(wall);
  const beam = mat(0x4a3220);
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) g.add(box(0.3, 3.1, 0.3, beam, x, 1.55, z));
  const rg = new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2.4, 4);
  const r = new THREE.Mesh(rg, mat(roof)); r.rotation.y = Math.PI / 4; r.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); r.position.y = 4.2; r.castShadow = true; g.add(r);
  g.add(box(1.0, 1.8, 0.1, mat(0x3a2414), 0, 0.9, d / 2 + 0.05));
  g.add(box(0.8, 0.7, 0.1, mat(0xf0d090, false, { emissive: 0x403010 }), w / 4 + 0.3, 1.8, d / 2 + 0.05));
  return g;
}

export function makeFlag(color = 0x2a5a9a) {
  const g = new THREE.Group();
  const pole = cyl(0.08, 0.1, 7, mat(0x5a4028), 6); pole.position.y = 3.5; g.add(pole);
  const f = box(1.6, 1.0, 0.05, mat(color), 0.85, 6.3, 0); g.add(f);
  g.userData.flag = f;
  return g;
}

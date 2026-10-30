// Worn armor you can see: cloth robes for casters, leather for hybrids, plate for the heavy classes.
// Pieces are simple shells built in the character's body axes and hung on "anchors" that follow the
// skeleton (the rigged hero) or the limb groups (the built-in humanoid).
import * as THREE from 'three';
import { weaponModelMesh } from './weapons3d.js';

// the shapes this file builds were a stand-in; only the owner's own armor models are worn now
const GENERATED = false;

const COLS = { light: [0x8a7c5c, 0x34406a, 0x6a2020], medium: [0x6a4a2a, 0x54402e, 0x3e3022], heavy: [0x9a9aa2, 0x9ab4cc, 0xd8a850] };
const matCache = new Map();
function M(kind, color, extra = {}) {
  const k = kind + color + JSON.stringify(extra);
  let m = matCache.get(k);
  if (!m) {
    const base = kind === 'heavy' ? { metalness: 0.85, roughness: 0.3 } : kind === 'medium' ? { metalness: 0.05, roughness: 0.72 } : kind === 'gold' ? { metalness: 0.9, roughness: 0.25 } : { metalness: 0, roughness: 0.92 };
    m = new THREE.MeshStandardMaterial({ color, ...base, ...extra });
    matCache.set(k, m);
  }
  return m;
}
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

// body measurements and anchors for the two character kinds
function frame(h) {
  if (h.rig?.follower) {
    const P = h.rig.restP, g = h.rig.girth || {};
    const tz = g.torso || 1, ar = g.arm || 1, lg = g.leg || 1;
    const shX = Math.abs(P.LeftArm.x - P.RightArm.x) / 2;
    const F = {
      waistY: P.Spine02.y, hipY: P.Hips.y, chestTop: P.neck.y - 0.03, headY: P.Head.y + 0.1, headR: 0.125,
      chestW: shX * 1.7 * tz, chestD: shX * 1.15 * tz, chestZ: 0.01, hipR: Math.abs(P.LeftUpLeg.x) * 1.9 * Math.max(1, tz * 0.95),
      shX, shY: P.LeftArm.y, shR: 0.12 * ar, foreLen: P.LeftForeArm.distanceTo(P.LeftHand), foreR: 0.055 * ar,
      kneeY: P.LeftLeg.y, footY: P.LeftFoot.y, legX: P.LeftLeg.x, shinR: 0.075 * lg,
    };
    F.at = (name, mesh, x, y, z) => { const r = P[name]; mesh.position.set(x - r.x, y - r.y, z - r.z); h.rig.follower(name).add(mesh); };
    F.side = (s, part) => (s > 0 ? 'Left' : 'Right') + part;
    F.hero = true;
    return F;
  }
  // built-in humanoid (body units: hips at 0.95, shoulders at 1.65, head at 2.03)
  const p = h.parts;
  const groups = { Hips: [p.hips, 0, 0.95], Spine: [p.upper, 0, 0.95], LeftArm: [p.armL, 0.4, 1.65], RightArm: [p.armR, -0.4, 1.65], LeftForeArm: [p.armL, 0.4, 1.65], RightForeArm: [p.armR, -0.4, 1.65], LeftLeg: [p.legL, 0.15, 0.95], RightLeg: [p.legR, -0.15, 0.95], Head: [p.head, 0, 2.03] };
  const F = {
    waistY: 1.0, hipY: 0.95, chestTop: 1.74, headY: 2.06, headR: 0.24,
    chestW: 0.66, chestD: 0.42, chestZ: 0, hipR: 0.32, shX: 0.4, shY: 1.68, shR: 0.17, foreLen: 0.32, foreR: 0.11,
    kneeY: 0.5, footY: 0.06, legX: 0.15, shinR: 0.14, foreY: 1.2,
  };
  F.at = (name, mesh, x, y, z) => { const [g, gx, gy] = groups[name]; mesh.position.set(x - gx, y - gy, z); g.add(mesh); };
  F.side = (s, part) => (s > 0 ? 'Left' : 'Right') + part;
  return F;
}

const cyl = (rt, rb, hgt, seg = 20, open = false) => new THREE.CylinderGeometry(rt, rb, hgt, seg, 1, open);
const dome = (r, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.6 | 0), 0, Math.PI * 2, 0, Math.PI / 2);
function mesh(g, m, sx = 1, sy = 1, sz = 1) { const o = new THREE.Mesh(g, m); o.scale.set(sx, sy, sz); o.castShadow = true; return o; }

// spec: { chest, legs, feet, hands, head: weight class or null; tier; trim: class colour }
export function dressArmor(h, spec) {
  if (h.armorParts) for (const o of h.armorParts) o.parent?.remove(o);
  h.armorParts = [];
  const F = frame(h), add = (name, o, x, y, z) => { F.at(name, o, x, y, z); h.armorParts.push(o); return o; };
  // the owner's boot model on both feet, coloured by armor weight (the hero only: it follows the foot bones)
  if (spec.feet && F.hero) {
    const P = h.rig.restP;
    for (const s of [1, -1]) {
      const b = weaponModelMesh('boot', 1);
      if (!b) break; // still downloading; dressed again when it arrives
      const foot = F.side(s, 'Foot'), toe = F.side(s, 'ToeBase');
      const fl = Math.hypot(P[toe].x - P[foot].x, P[toe].z - P[foot].z) * 1.9;
      const k = fl / 1.9;
      b.material = b.material.clone();
      b.material.color.set(spec.feet === 'heavy' ? 0xb8bcc8 : spec.feet === 'medium' ? 0x8a5a34 : 0x5a4a6a);
      b.material.metalness = spec.feet === 'heavy' ? 0.8 : 0.1; b.material.roughness = spec.feet === 'heavy' ? 0.3 : 0.75;
      b.scale.set(k * 1.25, k * 1.4, k);
      add(foot, b, P[foot].x, 0.005, P[foot].z);
    }
  }
  if (!GENERATED) return;
  const tier = Math.min(3, Math.max(1, spec.tier || 1));
  const trimC = spec.trim ?? 0x8a6a3a;
  const colOf = kind => kind === 'light' ? mix(COLS.light[tier - 1], trimC, 0.45) : COLS[kind][tier - 1];
  const gold = M('gold', tier === 3 ? 0xe8c060 : tier === 2 ? 0xc0c8d0 : 0xa08050);
  const trimM = M('light', trimC);
  const midY = (F.chestTop + F.waistY) / 2, torsoH = F.chestTop - F.waistY;

  // ---- torso ----
  const ch = spec.chest;
  if (ch) {
    const m = M(ch, colOf(ch));
    const inf = ch === 'heavy' ? 1.12 : ch === 'medium' ? 1.07 : 1.05;
    const shell = mesh(cyl(1, 0.86, 1, ch === 'heavy' ? 12 : 20), m, F.chestW / 2 * inf, torsoH * 1.02, F.chestD / 2 * inf);
    add('Spine', shell, 0, midY, F.chestZ);
    if (ch === 'heavy') {
      add('Spine', mesh(new THREE.BoxGeometry(0.035, torsoH * 0.9, 0.03), gold), 0, midY, F.chestZ + F.chestD / 2 * inf + 0.005); // keel ridge
      add('Spine', mesh(new THREE.TorusGeometry(F.chestW * 0.2, 0.03, 8, 20), m, 1, 1, 0.8), 0, F.chestTop + 0.02, 0).rotation.x = Math.PI / 2; // gorget
    } else if (ch === 'medium') {
      const strap = mesh(new THREE.BoxGeometry(0.06, torsoH * 1.25, 0.02), M('medium', 0x2a1a10));
      strap.rotation.z = 0.6; add('Spine', strap, 0, midY, F.chestZ + F.chestD / 2 * inf + 0.006);
    } else {
      // robe: a capelet over the shoulders and a trim panel down the front
      add('Spine', mesh(cyl(F.chestW * 0.2, F.chestW * 0.64, torsoH * 0.32, 24, true), M('light', shade(colOf(ch), 0.8), { side: THREE.DoubleSide })), 0, F.chestTop - torsoH * 0.12, F.chestZ);
      add('Spine', mesh(new THREE.BoxGeometry(F.chestW * 0.18, torsoH, 0.02), trimM), 0, midY, F.chestZ + F.chestD / 2 * inf + 0.004);
    }
    // shoulders
    for (const s of [1, -1]) {
      if (ch === 'heavy') {
        const p1 = mesh(dome(F.shR * 1.25, 14), m, 1.15, 0.85, 1.1); p1.rotation.z = -s * 0.35;
        add(F.side(s, 'Arm'), p1, s * F.shX, F.shY + 0.02, 0);
        const p2 = mesh(dome(F.shR * 1.05, 14), m, 1.15, 0.8, 1.05); p2.rotation.z = -s * 0.5;
        add(F.side(s, 'Arm'), p2, s * (F.shX + 0.03), F.shY - 0.07, 0);
        if (tier >= 2) add(F.side(s, 'Arm'), mesh(new THREE.TorusGeometry(F.shR * 1.2, 0.012, 6, 18, Math.PI), gold, 1.15, 1, 1.1), s * F.shX, F.shY + 0.02, 0).rotation.set(0, Math.PI / 2, -s * 0.35);
      } else if (ch === 'medium') {
        const p = mesh(dome(F.shR, 12), m, 1.1, 0.7, 1.05); p.rotation.z = -s * 0.4;
        add(F.side(s, 'Arm'), p, s * F.shX, F.shY + 0.01, 0);
      }
    }
    // belt
    const belt = mesh(new THREE.TorusGeometry(1, 0.06, 6, 24), ch === 'light' ? trimM : M('medium', 0x2a1a10), F.chestW * 0.45, F.chestD * 0.45 / 0.6 * 0.6, 1);
    belt.rotation.x = Math.PI / 2; belt.scale.set(F.chestW * 0.47, F.chestD * 0.47, 1);
    add('Spine', belt, 0, F.waistY + 0.02, F.chestZ);
    add('Spine', mesh(new THREE.BoxGeometry(0.07, 0.06, 0.02), gold), 0, F.waistY + 0.02, F.chestZ + F.chestD * 0.47 + 0.01);
  }

  // ---- hips and legs ----
  const lg = spec.legs;
  if (lg === 'light' || (ch === 'light' && !lg)) {
    // the robe skirt, hem to the ankles, with a trim band
    const len = F.waistY - F.footY - 0.08;
    const c = colOf('light');
    add('Hips', mesh(cyl(F.hipR * 1.02, F.hipR * 1.85, len, 24, true), M('light', c, { side: THREE.DoubleSide })), 0, F.waistY - len / 2, 0);
    add('Hips', mesh(cyl(F.hipR * 1.86, F.hipR * 1.9, 0.07, 24, true), M('light', trimC, { side: THREE.DoubleSide })), 0, F.waistY - len + 0.03, 0);
    add('Hips', mesh(new THREE.BoxGeometry(F.hipR * 0.5, len * 0.95, 0.02), trimM), 0, F.waistY - len * 0.5, F.hipR * 1.45);
  } else if (lg) {
    const m = M(lg, colOf(lg));
    if (lg === 'heavy') {
      add('Hips', mesh(cyl(F.hipR * 1.1, F.hipR * 1.3, 0.26, 10, true), M('heavy', colOf('heavy'), { side: THREE.DoubleSide })), 0, F.hipY - 0.06, 0);
    } else {
      for (const a of [0, Math.PI]) { const flap = mesh(new THREE.BoxGeometry(F.hipR * 0.9, 0.3, 0.02), m); add('Hips', flap, 0, F.hipY - 0.12, Math.cos(a) * F.hipR * 1.05); }
    }
    for (const s of [1, -1]) {
      add(F.side(s, 'Leg'), mesh(new THREE.SphereGeometry(F.shinR * 1.05, 10, 8), m, 1, 0.9, 1.1), s * F.legX, F.kneeY, 0.04);
    }
  }
  // ---- feet: greaves or boots up the shin ----
  const ft = spec.feet;
  if (ft && ft !== 'light') {
    const m = M(ft, colOf(ft));
    const len = (F.kneeY - F.footY) * (ft === 'heavy' ? 0.85 : 0.6);
    for (const s of [1, -1]) add(F.side(s, 'Leg'), mesh(cyl(F.shinR * 1.25, F.shinR * 1.1, len, ft === 'heavy' ? 10 : 16), m), s * F.legX, F.footY + 0.06 + len / 2, 0);
  }
  // ---- hands: vambraces, bracers or bell sleeves ----
  const hd = spec.hands || (ch === 'light' ? 'light' : null);
  if (hd) {
    for (const s of [1, -1]) {
      const name = F.side(s, 'ForeArm');
      const top = F.hero ? h.rig.restP[name] : new THREE.Vector3(s * 0.4, 1.2, 0);
      const L = F.foreLen * (hd === 'light' ? 0.75 : 0.6);
      const g = hd === 'light' ? cyl(F.foreR * 1.2, F.foreR * 2.2, L, 16, true) : cyl(F.foreR * 1.35, F.foreR * 1.2, L, hd === 'heavy' ? 10 : 14);
      add(name, mesh(g, hd === 'light' ? M('light', colOf('light'), { side: THREE.DoubleSide }) : M(hd, colOf(hd))), top.x, top.y - L / 2 - (hd === 'light' ? F.foreLen * 0.15 : F.foreLen * 0.25), top.z);
    }
  }
  // ---- head (the hero only; the built-in humanoid has its own helms) ----
  const he = spec.head;
  if (he && F.hero) {
    if (he === 'light') {
      const hood = mesh(new THREE.SphereGeometry(F.headR * 1.45, 18, 12, Math.PI * 0.8, Math.PI * 1.4), M('light', colOf('light'), { side: THREE.DoubleSide }), 1, 1.12, 1.05);
      add('Head', hood, 0, F.headY + 0.01, -0.01);
    } else {
      const m = M(he, colOf(he));
      add('Head', mesh(dome(F.headR * 1.3, 16), m, 1, 1.05, 1.08), 0, F.headY - 0.01, -0.005);
      if (he === 'heavy') {
        add('Head', mesh(new THREE.BoxGeometry(0.035, F.headR * 1.35, 0.03), m), 0, F.headY - F.headR * 0.55, F.headR * 1.25); // nasal
        if (tier >= 2) add('Head', mesh(new THREE.BoxGeometry(0.03, F.headR * 0.6, F.headR * 2.2), gold), 0, F.headY + F.headR * 1.25, 0); // crest
      }
    }
  }
}

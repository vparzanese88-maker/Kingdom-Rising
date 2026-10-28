// Kingdom Rising 3D — people and humanoid monsters: a skinned body built from the 2D game's `look`
// (race, sex, skin, hair, armour kind and colours, helms and hats, capes, beards, tusks, ears...),
// with procedural animation for walking, idling, every weapon swing, casting, sitting, kicking and dying.
import { THREE, K3 } from './core.js';
import { MB, PRIM } from './mb.js';
import { weaponMesh } from './weapons.js';

import { humanAsset, makeHumanRig } from './human.js';
import { legs, handsOnKnees } from './gait.js';
import { spring, bodyLean, melee, hurt, casting, look, cape } from './motion.js';
const KR = window.KR, D = KR.D;

// ---------- the material: vertex colours plus per-vertex metal/roughness and procedural detail ----------
// aMat.x metalness, aMat.y roughness, aMat.z pattern (0 plain 1 cloth 2 leather 3 metal 4 fur 5 skin 6 hair 7 chain 8 bone 9 glow 10 scales)
export const charMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
charMat.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aMat; varying vec3 vMat; varying vec3 vOP;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat; vOP = position;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
    varying vec3 vMat; varying vec3 vOP;
    float ch(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float cn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(mix(ch(i), ch(i + vec3(1,0,0)), f.x), mix(ch(i + vec3(0,1,0)), ch(i + vec3(1,1,0)), f.x), f.y), mix(mix(ch(i + vec3(0,0,1)), ch(i + vec3(1,0,1)), f.x), mix(ch(i + vec3(0,1,1)), ch(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float gPat; float gEm;
  `).replace('#include <map_fragment>', `#include <map_fragment>
    float pat = floor(vMat.z + .5); vec3 q = vOP; gPat = .5; gEm = 0.;
    // fade fine patterns out before they get smaller than a pixel (no shimmer at a distance)
    float px = length(fwidth(q));
    float aaF = 1. - smoothstep(.0015, .006, px), aaM = 1. - smoothstep(.006, .02, px);
    // patterns stay subtle: a fine weave on cloth up close, rings on mail, strands in hair and fur
    if (pat == 1.) { float w = sin(q.x * 520.) * sin(q.y * 520.) * .5 + .5; gPat = mix(.5, w, aaF); diffuseColor.rgb *= .95 + .08 * gPat; }
    else if (pat == 4.) { float n = mix(.5, cn(vec3(q.x * 160., q.y * 30., q.z * 160.)), aaF); gPat = n; diffuseColor.rgb *= .88 + .2 * n; }
    else if (pat == 6.) { float n = mix(.5, cn(vec3(q.x * 220., q.y * 14., q.z * 220.)), aaF); gPat = n; diffuseColor.rgb *= .88 + .2 * n; }
    else if (pat == 7.) { vec2 g = fract(vec2(q.x + q.z, q.y) * 90.) - .5; float r = abs(length(g) - .32); gPat = mix(.35, smoothstep(.1, 0., r), aaF); diffuseColor.rgb *= .78 + .32 * gPat; }
    else if (pat == 9.) { gEm = 1.; }
    else if (pat == 10.) { vec3 sq = q * 55.; vec3 si = floor(sq); vec3 sf = fract(sq) - .5; float cell = cn(si * 1.7); float bump = 1. - smoothstep(.15, .5, length(sf.xy + sf.z * .3)); gPat = mix(.5, bump * (.7 + .3 * cell), aaM); diffuseColor.rgb *= .94 + .1 * gPat + .06 * (cell - .5); }
  `).replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vMat.x;')
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vMat.y;')
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    if (pat == 7. || pat == 10.) { vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition); float dhx = dFdx(gPat), dhy = dFdy(gPat);
      vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx); float det = dot(dpdx, r1); vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
      normal = normalize(abs(det) * normal - grad * (pat == 7. ? .5 : .03)); }`)
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * gEm * 2.5;');
};
charMat.customProgramCacheKey = () => 'krchar';
const MATS = { plain: [0, 0.8, 0], cloth: [0, 0.95, 1], leather: [0, 0.62, 2], metal: [0.85, 0.32, 3], fur: [0, 1, 4], skin: [0, 0.6, 5], hair: [0, 0.55, 6], chain: [0.8, 0.45, 7], bone: [0, 0.7, 8], glow: [0, 1, 9], scales: [0.03, 0.55, 10], gold: [1, 0.25, 3], wood: [0, 0.8, 2], gem: [0.2, 0.1, 9] };

// ---------- skeleton ----------
const BONE_NAMES = ['hips', 'spine', 'chest', 'neck', 'head', 'shL', 'armL', 'foreL', 'handL', 'shR', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'capeA', 'capeB', 'tail1', 'tail2', 'tail3', 'wingL', 'wingR'];
const BI = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i]));
const PARENT = { hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', shL: 'chest', armL: 'shL', foreL: 'armL', handL: 'foreL', shR: 'chest', armR: 'shR', foreR: 'armR', handR: 'foreR', thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR', capeA: 'chest', capeB: 'capeA', tail1: 'hips', tail2: 'tail1', tail3: 'tail2', wingL: 'chest', wingR: 'chest' };
// proportions per body type
function proportions(look, kind) {
  const race = D.RACES[look.race] || {};
  const fem = look.gender === 'f';
  const P = { h: race.scale || 1, w: (look.width || race.width || 1) * (fem ? 0.92 : 1), head: 1, arm: 1, leg: 1, hunch: 0, belly: 0, neck: 1, hand: 1, fem };
  switch (kind) {
    case 'goblin': Object.assign(P, { head: 1.3, arm: 1.08, leg: 0.88, hunch: 0.22 }); break;
    case 'orc': Object.assign(P, { head: 1.05, arm: 1.1, hunch: 0.12, neck: 0.6, hand: 1.25 }); break;
    case 'troll': Object.assign(P, { head: 0.9, arm: 1.32, leg: 0.95, hunch: 0.35, neck: 0.5, hand: 1.5 }); break;
    case 'ogre': Object.assign(P, { head: 0.85, arm: 1.1, leg: 0.85, belly: 0.16, neck: 0.5, hand: 1.4 }); break;
    case 'giant': Object.assign(P, { head: 0.9, arm: 1.08, hand: 1.3 }); break;
    case 'zombie': Object.assign(P, { hunch: 0.2 }); break;
    case 'skeleton': case 'lich': Object.assign(P, { w: 0.82, neck: 1 }); break;
    case 'lizard': Object.assign(P, { head: 1.0, hunch: 0.1, neck: 1.3 }); break;
    case 'deathknight': Object.assign(P, { w: 1.12 }); break;
    case 'scarecrow': Object.assign(P, { w: 0.85, arm: 1.1 }); break;
  }
  if (look.race === 'dwarf') Object.assign(P, { head: 1.12, leg: 0.82, arm: 0.95, hand: 1.2 });
  if (look.race === 'gnome') Object.assign(P, { head: 1.28, leg: 0.85 });
  if (look.race === 'halfling') Object.assign(P, { head: 1.15, leg: 0.9 });
  if (look.race === 'barbarian' || look.race === 'ogrin' || look.race === 'firbolg' || look.race === 'ogre' || look.race === 'troll') Object.assign(P, { hand: 1.15 });
  return P;
}
function restPositions(P) {
  const L = P.leg, A = P.arm, w = P.w;
  const hipY = 0.97 * L, chestY = hipY + 0.32, shY = chestY + 0.18;
  const pos = {
    hips: [0, hipY, 0], spine: [0, hipY + 0.12, 0], chest: [0, chestY, 0], neck: [0, shY + 0.06, 0], head: [0, shY + 0.06 + 0.1 * P.neck, 0],
    shL: [0.06 * w, shY, 0], armL: [0.19 * w, shY - 0.01, 0], foreL: [0.205 * w, shY - 0.29 * A, 0], handL: [0.215 * w, shY - 0.555 * A, 0],
    thighL: [0.095 * w, hipY - 0.03, 0], shinL: [0.1 * w, hipY - 0.03 - 0.44 * L, 0.01], footL: [0.1 * w, 0.085, 0],
    capeA: [0, shY + 0.02, -0.14 * w], capeB: [0, hipY - 0.15, -0.2 * w],
    tail1: [0, hipY - 0.05, -0.12], tail2: [0, hipY - 0.25, -0.6], tail3: [0, hipY - 0.55, -1.05],
    wingL: [0.1 * w, shY - 0.05, -0.12], wingR: [-0.1 * w, shY - 0.05, -0.12],
  };
  for (const s of ['sh', 'arm', 'fore', 'hand']) { const p = pos[s + 'L']; pos[s + 'R'] = [-p[0], p[1], p[2]]; }
  for (const s of ['thigh', 'shin', 'foot']) { const p = pos[s + 'L']; pos[s + 'R'] = [-p[0], p[1], p[2]]; }
  return pos;
}

// ---------- body builder ----------
class Body {
  constructor(rest) { this.rest = rest; this.pos = []; this.nor = []; this.col = []; this.mat = []; this.si = []; this.sw = []; this.idx = []; this.n = 0; }
  // add geometry g placed by matrix m (rest/world space), bound to bone (with optional blend toward parent near its root)
  add(g, m, bone, color, mat = 'plain', blend = 0, bone2 = null, w2 = 0) {
    const pa = g.attributes.position, na = g.attributes.normal; const nm = new THREE.Matrix3().getNormalMatrix(m);
    const c = color && color.isColor ? color : K3.col(color || '#888888', new THREE.Color()); const M = MATS[mat] || MATS.plain;
    const bi = BI[bone], par = PARENT[bone] ? BI[PARENT[bone]] : bi; const b2 = bone2 != null ? BI[bone2] : null;
    const root = this.rest[bone]; const child = this.childOf(bone); const ax = child ? new THREE.Vector3(child[0] - root[0], child[1] - root[1], child[2] - root[2]) : null; const axl = ax ? ax.length() : 1; if (ax) ax.normalize();
    const base = this.n; const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(m); n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
      this.pos.push(v.x, v.y, v.z); this.nor.push(n.x, n.y, n.z); this.col.push(c.r, c.g, c.b); this.mat.push(M[0], M[1], M[2]);
      let wp = 0;
      if (blend && ax) { const t = ((v.x - root[0]) * ax.x + (v.y - root[1]) * ax.y + (v.z - root[2]) * ax.z) / axl; wp = t < blend ? 0.5 * (1 - Math.max(0, t) / blend) : 0; }
      if (b2 != null) { this.si.push(bi, b2, 0, 0); this.sw.push(1 - w2, w2, 0, 0); }
      else { this.si.push(bi, par, 0, 0); this.sw.push(1 - wp, wp, 0, 0); }
    }
    if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) this.idx.push(base + ia[i]); } else for (let i = 0; i < pa.count; i++) this.idx.push(base + i);
    this.n += pa.count;
  }
  childOf(bone) { const ch = { hips: 'spine', spine: 'chest', chest: 'neck', neck: 'head', armL: 'foreL', foreL: 'handL', armR: 'foreR', foreR: 'handR', thighL: 'shinL', shinL: 'footL', thighR: 'shinR', shinR: 'footR', capeA: 'capeB', tail1: 'tail2', tail2: 'tail3' }[bone]; return ch ? this.rest[ch] : null; }
  // limb segment between two joints (capsule-ish), radius r0 at a to r1 at b
  seg(bone, a, b, r0, r1, color, mat, blend = 0.18, sx = 1, sz = 1) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const L = A.distanceTo(B);
    const g = new THREE.CylinderGeometry(r1, r0, L, 12, 4, false);
    // round the ends
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / (L / 2); const k = 1 - Math.pow(Math.abs(y), 6) * 0.18; p.setX(i, p.getX(i) * k * sx); p.setZ(i, p.getZ(i) * k * sz); } g.computeVertexNormals();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    const m = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    this.add(g, m, bone, color, mat, blend); g.dispose();
    // joint ball at the root to hide the crease
    const s = new THREE.SphereGeometry(r0 * 1.02, 10, 8); this.add(s, new THREE.Matrix4().makeTranslation(A.x, A.y, A.z).multiply(new THREE.Matrix4().makeScale(sx, 1, sz)), bone, color, mat, blend); s.dispose();
  }
  ell(bone, x, y, z, rx, ry, rz, color, mat, rot = null, blend = 0, seg = 14) {
    const g = new THREE.SphereGeometry(1, seg, Math.max(8, seg - 4)); const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), rot || new THREE.Quaternion(), new THREE.Vector3(rx, ry, rz));
    this.add(g, m, bone, color, mat, blend); g.dispose();
  }
  box(bone, x, y, z, sx, sy, sz, color, mat, rot = null) { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), rot || new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)); this.add(PRIM.box, m, bone, color, mat); }
  geom(bone, g, m, color, mat, blend, bone2, w2) { this.add(g, m, bone, color, mat, blend, bone2, w2); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3)); g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); g.boundingSphere.radius *= 1.6;
    return g;
  }
}
const Q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const shade = (c, a) => K3.shade(c || '#777777', a);

// the head: a sculpted sphere plus features
function head(B, look, P, kind, skin, hp) {
  const fem = P.fem; const s = 0.126 * P.head * (fem ? 0.95 : 1);
  const [hx, hy, hz] = hp; const cy = hy + s * 1.05;
  const skull = kind === 'skeleton' || kind === 'lich';
  const g = new THREE.SphereGeometry(1, 28, 20); const p = g.attributes.position;
  const lizard = kind === 'lizard' || look.snout;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    y *= 1.16; x *= 0.84;
    if (y < -0.15) { const k = (-y - 0.15); x *= 1 - k * (fem ? 0.55 : 0.4); z += (z > 0 ? k * 0.15 : 0); if (kind === 'orc' || kind === 'troll' || kind === 'ogre') { x *= 1 + k * 0.6; z += z > 0 ? k * 0.25 : 0; } }
    if (z > 0.55 && Math.abs(x) < 0.2 && y > -0.4 && y < 0.15 && !skull && !lizard) { z += (0.2 - Math.abs(x)) * (0.15 - Math.abs(y + 0.12)) * 3.2 * (kind === 'troll' ? 2.5 : kind === 'goblin' ? 2 : 1); }
    if (z > 0.4 && y > 0.12 && y < 0.32 && !fem) z += 0.04;
    if (z > 0.5 && Math.abs(x) > 0.18 && Math.abs(x) < 0.5 && y > -0.05 && y < 0.2) z -= 0.05;
    if (lizard && z > 0) { z *= 1 + Math.max(0, -y + 0.2) * 1.6; y *= 0.85; }
    if (skull && y < -0.3) { x *= 0.85; }
    p.setXYZ(i, x * s, y * s, z * s);
  }
  g.computeVertexNormals();
  B.geom('head', g, new THREE.Matrix4().makeTranslation(hx, cy, hz + s * 0.05), skull ? '#e8e2cc' : skin, skull ? 'bone' : lizard ? 'scales' : 'skin'); g.dispose();
  // eyes
  const eyeCol = look.eyesCol || (skull ? '#7affb0' : kind === 'zombie' ? '#c8ff6a' : '#1a1a1a');
  const glowEyes = !!look.eyesCol || skull || kind === 'zombie' || kind === 'deathknight';
  for (const sd of [-1, 1]) {
    const ex = hx + sd * s * 0.36, ey = cy + s * 0.12, ez = hz + s * (lizard ? 0.75 : 0.86);
    if (skull) { B.ell('head', ex, ey, ez - s * 0.05, s * 0.2, s * 0.2, s * 0.1, '#111111', 'plain'); B.ell('head', ex, ey, ez, s * 0.07, s * 0.07, s * 0.05, eyeCol, 'glow'); continue; }
    if (!lizard) B.ell('head', ex, ey, ez - s * 0.04, s * 0.16, s * 0.11, s * 0.09, '#f4f0e8', 'plain');
    B.ell('head', ex, ey, ez + s * 0.01, s * 0.075, s * 0.075, s * 0.06, lizard ? '#ffd23a' : eyeCol, glowEyes || lizard ? 'glow' : 'gloss' in MATS ? 'plain' : 'plain');
    // brows
    if (!lizard && look.hairStyle !== 4 || (!lizard && look.hair)) B.box('head', ex, ey + s * 0.2, ez + s * 0.02, s * 0.32, s * 0.06, s * 0.08, shade(look.hair || '#2a1e16', -0.2), 'hair', Q(0, 0, sd * (kind === 'orc' || kind === 'goblin' ? 0.35 : 0.12)));
  }
  if (skull) { B.box('head', hx, cy - s * 0.55, hz + s * 0.55, s * 0.9, s * 0.3, s * 0.5, '#ddd5c0', 'bone'); for (let k = -2; k <= 2; k++) B.box('head', hx + k * s * 0.14, cy - s * 0.42, hz + s * 0.82, s * 0.08, s * 0.14, s * 0.06, '#f0ead8', 'bone'); B.ell('head', hx, cy - s * 0.12, hz + s * 0.9, s * 0.1, s * 0.13, s * 0.05, '#111111', 'plain'); }
  else if (!lizard) {
    // mouth
    B.box('head', hx, cy - s * 0.48, hz + s * 0.84, s * (fem ? 0.36 : 0.42), s * (fem ? 0.07 : 0.05), s * 0.06, fem ? '#a85a5a' : shade(skin, -0.35), 'skin');
    if (look.race && D.RACES[look.race] && D.RACES[look.race].nose) B.ell('head', hx, cy - s * 0.12, hz + s * 1.0, s * 0.2, s * 0.17, s * 0.17, shade(skin, -0.05), 'skin');
  } else {
    // lizard: a crest and nostrils
    for (let k = 0; k < 5; k++) B.box('head', hx, cy + s * (0.9 - k * 0.12), hz - s * (0.2 + k * 0.25), s * 0.06, s * 0.3, s * 0.2, shade(skin, -0.25), 'scales');
    B.box('head', hx, cy - s * 0.55, hz + s * 1.4, s * 0.6, s * 0.06, s * 0.6, '#3a1a1a', 'plain');
  }
  // tusks
  if (look.tusk) for (const sd of [-1, 1]) B.geom('head', PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(hx + sd * s * 0.28, cy - s * 0.48, hz + s * 0.85), Q(-0.3, 0, sd * 0.15), new THREE.Vector3(s * 0.12, s * 0.42, s * 0.12)), '#f0ead8', 'bone');
  // ears
  const race = D.RACES[look.race] || {};
  const ears = look.ears || race.ears;
  if (!skull && !lizard) for (const sd of [-1, 1]) {
    const ex = hx + sd * s * 0.84, ey = cy + s * 0.05, ez = hz;
    if (ears === 'long') B.geom('head', PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(ex + sd * s * 0.25, ey + s * 0.28, ez - s * 0.05), Q(-0.35, 0, -sd * 1.0), new THREE.Vector3(s * 0.22, s * 0.95, s * 0.1)), skin, 'skin');
    else if (ears === 'half') B.geom('head', PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(ex + sd * s * 0.12, ey + s * 0.15, ez - s * 0.05), Q(-0.3, 0, -sd * 0.8), new THREE.Vector3(s * 0.2, s * 0.55, s * 0.1)), skin, 'skin');
    else if (ears === 'goblin') B.geom('head', PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(ex + sd * s * 0.55, ey + s * 0.1, ez - s * 0.1), Q(0, 0, -sd * 1.45), new THREE.Vector3(s * 0.32, s * 1.3, s * 0.12)), skin, 'skin');
    else B.ell('head', ex, ey, ez, s * 0.12, s * 0.22, s * 0.16, skin, 'skin');
  }
  return { s, cy, top: cy + s * 1.16 };
}
function hair(B, look, P, kind, H) {
  const hs = look.hairStyle || 0, fem = P.fem; const col = look.hair || '#5a3a22';
  const covered = look.helm || look.hood || (look.hat && !['circlet', 'headband', 'leafcrown', 'bandana', 'bonemask', 'crown'].includes(look.hat));
  const { s, cy } = H; const hz = B.rest.head[2];
  if (kind === 'skeleton' || kind === 'lich' || kind === 'lizard' || hs === 4 && !fem) return;
  if (!covered) {
    // cap of hair
    const g = new THREE.SphereGeometry(1.08, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.58);
    B.geom('head', g, new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 0.08, hz - s * 0.06), Q(-0.25, 0, 0), new THREE.Vector3(s * 0.88, s * 1.14, s * 1.04)), col, 'hair'); g.dispose();
    if (hs === 2) for (let k = 0; k < 6; k++) B.geom('head', PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 1.0 - k * s * 0.08, hz + s * (0.5 - k * 0.3)), Q(-0.4 - k * 0.25, 0, 0), new THREE.Vector3(s * 0.25, s * 0.6, s * 0.25)), col, 'hair');
  }
  if (!look.helm && !look.hood && (hs === 1 || hs === 3 || fem)) {
    const L = hs === 3 ? 0.55 : fem ? 0.38 : 0.26;
    B.geom('head', PRIM.box, new THREE.Matrix4().compose(new THREE.Vector3(0, cy - L * 0.45 + s * 0.2, hz - s * 0.72), Q(0.08, 0, 0), new THREE.Vector3(s * 1.6, L, s * 0.5)), col, 'hair');
    if (fem || hs === 3) for (const sd of [-1, 1]) B.geom('head', PRIM.box, new THREE.Matrix4().compose(new THREE.Vector3(sd * s * 0.8, cy - s * 0.4, hz - s * 0.2), Q(0, 0, sd * 0.05), new THREE.Vector3(s * 0.25, s * 1.3, s * 0.6)), col, 'hair');
  }
  const race = D.RACES[look.race] || {};
  if ((race.beard && !fem) || look.beard) {
    const bc = look.beard || col;
    B.ell('head', 0, cy - s * 0.75, hz + s * 0.55, s * 0.62, s * (race.beard ? 0.75 : 0.5), s * 0.42, bc, 'hair');
    B.box('head', 0, cy - s * 0.36, hz + s * 0.92, s * 0.6, s * 0.1, s * 0.12, bc, 'hair');
  }
}
// a bishop's mitre: two stiff embroidered panels rising to a pointed arch, gold bands, a jewel and two ribbons behind
function mitre(B, s, top, hz, hc, tr) {
  top -= s * 0.32; // sits down on the brow
  const w = s * 1.02, h = s * 2.2;
  const sh = new THREE.Shape(); sh.moveTo(-w, 0); sh.lineTo(-w * 0.98, h * 0.42); sh.quadraticCurveTo(-w * 0.86, h * 0.86, 0, h); sh.quadraticCurveTo(w * 0.86, h * 0.86, w * 0.98, h * 0.42); sh.lineTo(w, 0); sh.lineTo(-w, 0);
  const panel = new THREE.ExtrudeGeometry(sh, { depth: s * 0.05, bevelEnabled: true, bevelThickness: s * 0.012, bevelSize: s * 0.012, bevelSegments: 1, curveSegments: 10 });
  // curve each panel round the head
  const p = panel.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) - (x * x) / (w * 1.6)); }
  panel.computeVertexNormals();
  for (const sd of [1, -1]) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(0, top - s * 0.42, hz + sd * s * 0.62), Q(sd * -0.16, sd > 0 ? 0 : Math.PI, 0), new THREE.Vector3(1, 1, 1));
    B.geom('head', panel, m, hc, 'cloth');
    // orphrey: a gold band up the middle and one across the bottom (titulus and circulus)
    const tilt = Q(sd * -0.16, 0, 0), zc = hz + sd * s * 0.7;
    B.geom('head', PRIM.box || new THREE.BoxGeometry(1, 1, 1), new THREE.Matrix4().compose(new THREE.Vector3(0, top - s * 0.42 + h * 0.48, zc + sd * s * 0.02 - sd * Math.sin(0.16) * h * 0.48), tilt, new THREE.Vector3(s * 0.2, h * 0.94, s * 0.03)), tr, 'gold');
    B.geom('head', PRIM.box || new THREE.BoxGeometry(1, 1, 1), new THREE.Matrix4().compose(new THREE.Vector3(0, top - s * 0.3, zc + sd * s * 0.0), tilt, new THREE.Vector3(w * 2.02, s * 0.2, s * 0.03)), tr, 'gold');
  }
  panel.dispose();
  // the band round the brow joining the two panels, a jewel at the front, a cross at the tips
  B.geom('head', new THREE.CylinderGeometry(s * 1.04, s * 1.04, s * 0.32, 22, 1, true), new THREE.Matrix4().makeTranslation(0, top - s * 0.3, hz), tr, 'gold');
  B.ell('head', 0, top - s * 0.05, hz + s * 0.95, s * 0.13, s * 0.17, s * 0.08, '#c03030', 'glow');
  for (const sd of [1, -1]) { B.box('head', 0, top - s * 0.42 + h * 0.97, hz + sd * s * 0.42, s * 0.06, s * 0.3, s * 0.05, tr, 'gold'); B.box('head', 0, top - s * 0.42 + h * 0.99, hz + sd * s * 0.42, s * 0.2, s * 0.06, s * 0.05, tr, 'gold'); }
  // lappets: two ribbons hanging down the back
  for (const sx of [-1, 1]) B.box('head', sx * s * 0.35, top - s * 1.25, hz - s * 1.02, s * 0.28, s * 1.6, s * 0.03, hc, 'cloth');
  for (const sx of [-1, 1]) B.box('head', sx * s * 0.35, top - s * 1.98, hz - s * 1.03, s * 0.3, s * 0.12, s * 0.035, tr, 'gold');
}
function shell(B, pts, cy, hz, s, col, mat, gap = 0, zs = 1.1) {
  const P2 = pts.map(([r, y]) => new THREE.Vector2(r * s, y * s));
  for (const pp of [P2, P2.slice().reverse().map((v) => new THREE.Vector2(v.x * 0.97, v.y))]) {
    const g = new THREE.LatheGeometry(pp, 20, gap, Math.PI * 2 - gap * 2); B.geom('head', g, new THREE.Matrix4().compose(new THREE.Vector3(0, cy, hz), Q(0, 0, 0), new THREE.Vector3(1, 1, zs)), col, mat); g.dispose();
  }
}
function headgear(B, look, P, H) {
  const { s, cy } = H; const hz = B.rest.head[2]; const c = look.helmCol || (look.armor && look.armor.col) || '#a8acb4';
  if (look.helm === 'plate') { // a 1300s bascinet: pointed skull, open face, riveted brow band, mail aventail to the shoulders
    const m = shade(c, 0.05), dk = shade(c, -0.22);
    shell(B, [[0.001, 1.52], [0.3, 1.45], [0.6, 1.27], [0.82, 1.0], [0.95, 0.68], [1.0, 0.34]], cy, hz, s, m, 'metal');
    shell(B, [[1.0, 0.36], [1.01, 0.05], [0.99, -0.3], [0.95, -0.6]], cy, hz, s, m, 'metal', 0.72);
    shell(B, [[1.05, 0.42], [1.06, 0.26]], cy, hz, s, dk, 'metal');
    for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; B.ell('head', Math.sin(a) * s * 1.07, cy + s * 0.34, hz + Math.cos(a) * s * 1.07 * 1.1, s * 0.05, s * 0.05, s * 0.05, shade(c, 0.25), 'metal'); }
    B.box('head', 0, cy + s * 1.0, hz - s * 0.05, s * 0.07, s * 0.16, s * 1.9, shade(c, 0.15), 'metal', Q(0.25, 0, 0));
    shell(B, [[0.95, -0.6], [1.06, -0.86], [1.3, -1.1], [1.62, -1.3]], cy, hz, s, '#7e828a', 'chain', 0.12, 1.08);
    if (look.helmPlume) for (let k = 0; k < 7; k++) B.ell('head', 0, cy + s * (1.5 + Math.sin(k / 6 * 2.4) * 0.22), hz - s * (0.1 + k * 0.2), s * 0.09, s * 0.22, s * 0.16, k % 2 ? shade(look.helmPlume, 0.12) : look.helmPlume, 'fur', Q(-0.5 - k * 0.12, 0, 0));
    if (look.helmSpike) B.geom('head', PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 1.75, hz), Q(0, 0, 0), new THREE.Vector3(s * 0.22, s * 0.7, s * 0.22)), shade(c, -0.2), 'metal');
    if (look.horns) for (const sd of [-1, 1]) B.geom('head', PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(sd * s * 1.1, cy + s * 0.8, hz), Q(0, 0, -sd * 0.7), new THREE.Vector3(s * 0.25, s * 1.1, s * 0.25)), '#e8dcc0', 'bone');
  } else if (look.helm === 'chain') { // a kettle hat with a broad brim over a mail coif
    shell(B, [[0.001, 1.2], [0.5, 1.12], [0.86, 0.82], [1.02, 0.35], [1.04, -0.2], [1.0, -0.5]], cy, hz, s, '#858991', 'chain', 0.78, 1.04);
    shell(B, [[1.0, -0.48], [1.06, -0.86], [1.25, -1.07], [1.55, -1.28]], cy, hz, s, '#858991', 'chain', 0.12, 1.1);
    const k = shade(c === '#a8acb4' ? '#9a9ea6' : c, 0);
    shell(B, [[0.001, 1.5], [0.4, 1.44], [0.78, 1.2], [1.0, 0.85], [1.1, 0.55]], cy, hz, s, k, 'metal');
    shell(B, [[1.1, 0.55], [1.5, 0.43], [1.66, 0.33], [1.68, 0.28]], cy, hz, s, shade(k, -0.08), 'metal');
    shell(B, [[1.1, 0.6], [1.12, 0.52]], cy, hz, s, shade(k, -0.3), 'metal');
    for (let j = 0; j < 4; j++) { const a = j / 4 * 6.283 + 0.785; B.box('head', Math.sin(a) * s * 0.62, cy + s * 1.18, hz + Math.cos(a) * s * 0.62 * 1.08, s * 0.08, s * 0.6, s * 0.06, shade(k, 0.18), 'metal', Q(0, a, Math.sin(a) * 0.9)); }
  }
  if (look.helm) return;
  const hc = look.hatCol || '#3a3a6a', tr = look.hatTrim || '#e0c050';
  const top = H.hatTop != null ? H.hatTop : cy + s * 0.9; // human heads give the real brow height
  switch (look.hat) {
    case 'wizard': B.geom('head', new THREE.CylinderGeometry(s * 1.9, s * 1.9, s * 0.08, 20), new THREE.Matrix4().makeTranslation(0, top - s * 0.15, hz), hc, 'cloth');
      { const g = new THREE.ConeGeometry(s * 1.0, s * 2.8, 16, 6); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / (s * 2.8) + 0.5; p.setZ(i, p.getZ(i) - y * y * s * 0.9); } g.computeVertexNormals(); B.geom('head', g, new THREE.Matrix4().makeTranslation(0, top + s * 1.25, hz), hc, 'cloth'); g.dispose(); }
      B.geom('head', new THREE.CylinderGeometry(s * 1.02, s * 1.02, s * 0.22, 20, 1, true), new THREE.Matrix4().makeTranslation(0, top, hz), tr, 'gold'); break;
    case 'hood': { const g = new THREE.SphereGeometry(1, 20, 14, Math.PI * 0.32, Math.PI * 1.36, 0, Math.PI * 0.74); /* a cowl: wide open at the face and underneath, so it frames the face instead of swallowing it */ B.geom('head', g, new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 0.12, hz - s * 0.16), Q(0, Math.PI / 2, 0), /* the opening at the face (it used to face the shoulder) */ new THREE.Vector3(s * 1.25, s * 1.38, s * 1.3)), hc, 'cloth'); g.dispose();
      B.ell('chest', 0, B.rest.neck[1], hz - 0.03, s * 1.8, s * 0.6, s * 1.5, hc, 'cloth');
      if (look.hoodPoint) B.geom('head', PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 1.0, hz - s * 1.0), Q(-1.1, 0, 0), new THREE.Vector3(s * 0.5, s * 1.1, s * 0.5)), hc, 'cloth');
      if (look.mask) B.box('head', 0, cy - s * 0.35, hz + s * 0.85, s * 1.5, s * 0.55, s * 0.35, look.mask, 'cloth');
      break; }
    case 'feather': B.geom('head', new THREE.CylinderGeometry(s * 1.0, s * 1.05, s * 0.6, 18), new THREE.Matrix4().makeTranslation(0, top - s * 0.05, hz), hc, 'cloth'); B.geom('head', new THREE.CylinderGeometry(s * 1.6, s * 1.6, s * 0.06, 18), new THREE.Matrix4().makeTranslation(0, top - s * 0.32, hz), hc, 'cloth');
      B.geom('head', new THREE.CylinderGeometry(s * 1.02, s * 1.02, s * 0.14, 18, 1, true), new THREE.Matrix4().makeTranslation(0, top - s * 0.18, hz), tr, 'cloth');
      B.geom('head', PRIM.sph12, new THREE.Matrix4().compose(new THREE.Vector3(s * 0.9, top + s * 0.4, hz - s * 0.3), Q(-0.6, 0, -0.5), new THREE.Vector3(s * 0.18, s * 1.5, s * 0.06)), '#f4f0e8', 'fur'); break;
    case 'circlet': B.geom('head', new THREE.TorusGeometry(s * 0.9, s * 0.05, 6, 24), new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 0.42, hz), Q(Math.PI / 2 + 0.15, 0, 0), new THREE.Vector3(1, 1, 1)), tr, 'gold'); B.ell('head', 0, cy + s * 0.4, hz + s * 0.9, s * 0.1, s * 0.1, s * 0.06, '#c06aff', 'glow'); break;
    case 'headband': B.geom('head', new THREE.TorusGeometry(s * 0.92, s * 0.08, 6, 24), new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 0.38, hz), Q(Math.PI / 2 + 0.1, 0, 0), new THREE.Vector3(1, 1, 1)), hc, 'cloth'); break;
    case 'mitre': mitre(B, s, top, hz, hc, tr); break;
    case 'sailor': // a knitted sailor's cap with a rolled brim
      B.geom('head', new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 0.22, hz - s * 0.04), Q(-0.12, 0, 0), new THREE.Vector3(s * 1.1, s * 1.0, s * 1.14)), hc, 'cloth');
      B.geom('head', new THREE.TorusGeometry(s * 1.04, s * 0.12, 8, 24), new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 0.3, hz - s * 0.04), Q(Math.PI / 2 - 0.12, 0, 0), new THREE.Vector3(1, 1.04, 1)), K3.shade(hc, 0.12), 'cloth'); break;
    case 'leafcrown': for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; B.ell('head', Math.cos(a) * s * 0.92, cy + s * 0.55, hz + Math.sin(a) * s * 0.92, s * 0.18, s * 0.32, s * 0.06, k % 2 ? '#5a9a3a' : '#3a7a2a', 'cloth', Q(0, -a, 0.3)); } break;
    case 'skullmask': B.geom('head', new THREE.SphereGeometry(1, 18, 12), new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 0.1, hz - s * 0.05), Q(0, 0, 0), new THREE.Vector3(s * 1.22, s * 1.35, s * 1.28)), hc, 'cloth'); B.ell('head', 0, cy - s * 0.05, hz + s * 0.95, s * 0.7, s * 0.8, s * 0.35, '#e8e2cc', 'bone'); for (const sd of [-1, 1]) B.ell('head', sd * s * 0.3, cy + s * 0.12, hz + s * 1.15, s * 0.14, s * 0.14, s * 0.06, look.eyesCol || '#111111', look.eyesCol ? 'glow' : 'plain'); break;
    case 'fur': B.geom('head', new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 0.15, hz - s * 0.05), Q(-0.2, 0, 0), new THREE.Vector3(s * 1.2, s * 1.25, s * 1.25)), hc, 'fur'); for (const sd of [-1, 1]) B.ell('head', sd * s * 0.7, cy + s * 1.15, hz - s * 0.2, s * 0.25, s * 0.3, s * 0.15, shade(hc, -0.15), 'fur'); if (look.horns) for (const sd of [-1, 1]) B.geom('head', PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(sd * s * 1.15, cy + s * 0.75, hz), Q(0, 0, -sd * 0.8), new THREE.Vector3(s * 0.25, s * 1.1, s * 0.25)), '#e8dcc0', 'bone'); break;
    case 'bonemask': B.ell('head', 0, cy - s * 0.1, hz + s * 0.9, s * 0.75, s * 0.85, s * 0.3, '#e8dcc0', 'bone'); for (const sd of [-1, 1]) B.ell('head', sd * s * 0.3, cy + s * 0.05, hz + s * 1.08, s * 0.12, s * 0.12, s * 0.05, '#7a2a1a', 'plain'); B.geom('head', PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(s * 0.6, cy + s * 1.1, hz), Q(0, 0, -0.5), new THREE.Vector3(s * 0.2, s * 0.9, s * 0.1)), '#c8402a', 'fur'); break;
    case 'bandana': B.geom('head', new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 0.1, hz - s * 0.04), Q(-0.15, 0, 0), new THREE.Vector3(s * 1.06, s * 1.18, s * 1.1)), hc, 'cloth'); B.box('head', 0, cy + s * 0.2, hz - s * 1.1, s * 0.3, s * 0.5, s * 0.1, hc, 'cloth', Q(0.4, 0, 0)); if (look.mask) B.box('head', 0, cy - s * 0.4, hz + s * 0.85, s * 1.5, s * 0.5, s * 0.35, look.mask, 'cloth'); break;
    case 'strawhat': B.geom('head', new THREE.CylinderGeometry(s * 2.1, s * 2.2, s * 0.07, 18), new THREE.Matrix4().makeTranslation(0, top - s * 0.2, hz), '#d8b878', 'cloth'); B.geom('head', new THREE.CylinderGeometry(s * 0.85, s * 1.0, s * 0.7, 16), new THREE.Matrix4().makeTranslation(0, top + s * 0.15, hz), '#d8b878', 'cloth'); break;
    case 'chef': B.geom('head', new THREE.CylinderGeometry(s * 1.0, s * 0.95, s * 0.9, 16), new THREE.Matrix4().makeTranslation(0, top + s * 0.2, hz), '#f4f2ec', 'cloth'); B.ell('head', 0, top + s * 0.9, hz, s * 1.25, s * 0.6, s * 1.25, '#f4f2ec', 'cloth'); break;
  }
  if (look.crown) { for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; B.geom('head', PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * s * 0.85, cy + s * 0.95, hz + Math.sin(a) * s * 0.85), Q(0, 0, 0), new THREE.Vector3(s * 0.22, s * 0.5, s * 0.22)), '#f0c040', 'gold'); } B.geom('head', new THREE.CylinderGeometry(s * 0.95, s * 0.95, s * 0.3, 20, 1, true), new THREE.Matrix4().makeTranslation(0, cy + s * 0.78, hz), '#f0c040', 'gold'); B.ell('head', 0, cy + s * 0.8, hz + s * 0.93, s * 0.12, s * 0.12, s * 0.06, '#c8302a', 'glow'); }
}

// ---------- a real skeleton: skull and jaw, vertebrae, ribcage, collarbones, shoulder blades, pelvis, paired forearm and shin bones, fingers and toes ----------
function skeletonFrame(B, R, P) {
  const C = '#d6cbad', J = '#c2b591', DK = '#17110b'; const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const tube = (bone, pts, r, col = C) => { const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => V(...q))), 10, r, 6); B.geom(bone, g, new THREE.Matrix4(), col, 'bone'); g.dispose(); };
  const longBone = (bone, a, b, r, knob = 1.9) => { B.seg(bone, a, b, r, r * 0.85, C, 'bone', 0.12); B.ell(bone, b[0], b[1], b[2], r * knob, r * knob * 0.9, r * knob, J, 'bone'); };
  const hipY = R.hips[1], chestY = R.chest[1], shY = R.shL[1], w = P.w;
  // spine: a curved column of vertebrae with their back spines
  const n = 17, y0 = hipY - 0.04, y1 = R.head[1] + 0.02;
  for (let k = 0; k <= n; k++) { const t = k / n, y = y0 + (y1 - y0) * t, z = -0.045 - Math.sin(t * Math.PI * 1.6) * 0.018; const bone = y < hipY + 0.06 ? 'hips' : y < chestY - 0.04 ? 'spine' : y < shY + 0.04 ? 'chest' : 'neck'; const r = t > 0.82 ? 0.016 : 0.022 - t * 0.006;
    B.ell(bone, 0, y, z, r * 1.25, r * 0.62, r, k % 2 ? C : J, 'bone'); B.box(bone, 0, y - 0.004, z - r * 1.4, r * 0.35, r * 0.5, r * 1.3, C, 'bone', Q(0.5, 0, 0)); for (const sx of [-1, 1]) B.box(bone, sx * r * 1.3, y, z - r * 0.2, r * 1.1, r * 0.3, r * 0.4, C, 'bone'); }
  // ribcage: seven pairs sloping down from the spine round to the breastbone, widest in the middle
  for (let k = 0; k < 7; k++) { const y = shY - 0.035 - k * 0.04, wd = (0.075 + Math.sin((k + 1) / 8 * Math.PI) * 0.055) * w, fz = 0.085 - Math.abs(k - 3) * 0.006;
    for (const sx of [-1, 1]) tube('chest', [[sx * 0.018, y, -0.06], [sx * wd * 0.85, y - 0.005, -0.045], [sx * wd, y - 0.025, 0.012], [sx * wd * 0.7, y - 0.05, fz - 0.01], [sx * (k < 5 ? 0.022 : 0.05), y - (k < 5 ? 0.07 : 0.085), fz]], 0.0075); }
  B.box('chest', 0, shY - 0.13, 0.09, 0.028, 0.19, 0.012, C, 'bone', Q(-0.18, 0, 0)); B.box('chest', 0, shY - 0.025, 0.08, 0.045, 0.04, 0.014, C, 'bone');
  for (const sx of [-1, 1]) {
    const S = sx > 0 ? 'L' : 'R';
    // collarbone and shoulder blade
    tube('chest', [[sx * 0.022, shY - 0.02, 0.075], [sx * 0.08 * w, shY + 0.004, 0.05], [R['arm' + S][0], R['arm' + S][1] + 0.02, 0.0]], 0.008);
    B.ell('chest', sx * 0.085 * w, shY - 0.07, -0.085, 0.048, 0.07, 0.01, C, 'bone', Q(0.12, sx * 0.35, sx * 0.1)); B.box('chest', sx * 0.085 * w, shY - 0.04, -0.093, 0.07, 0.01, 0.012, J, 'bone', Q(0, sx * 0.35, sx * 0.25));
    // arm: humerus, then radius and ulna side by side, the wrist and five fingers
    const a0 = R['arm' + S], a1 = R['fore' + S], a2 = R['hand' + S];
    B.ell('arm' + S, a0[0], a0[1], a0[2], 0.026, 0.026, 0.026, J, 'bone'); longBone('arm' + S, a0, a1, 0.014);
    for (const dz of [-0.011, 0.011]) B.seg('fore' + S, [a1[0], a1[1] - 0.01, a1[2] + dz], [a2[0], a2[1] + 0.01, a2[2] + dz * 0.8], 0.0085, 0.007, C, 'bone', 0);
    B.ell('hand' + S, a2[0], a2[1] - 0.012, a2[2], 0.014, 0.016, 0.026, J, 'bone');
    for (let f = 0; f < 4; f++) { const z = a2[2] - 0.022 + f * 0.015; const b0 = [a2[0], a2[1] - 0.025, z], b1 = [a2[0] + sx * 0.004, a2[1] - 0.065, z + 0.002], b2 = [a2[0] + sx * 0.012, a2[1] - 0.1 + Math.abs(f - 1.5) * 0.008, z + 0.01]; B.seg('hand' + S, b0, b1, 0.0055, 0.005, C, 'bone', 0); B.seg('hand' + S, b1, b2, 0.0048, 0.0035, C, 'bone', 0); }
    B.seg('hand' + S, [a2[0], a2[1] - 0.02, a2[2] + 0.03], [a2[0] + sx * 0.015, a2[1] - 0.06, a2[2] + 0.05], 0.006, 0.004, C, 'bone', 0);
    // pelvis wing, hip socket, femur with its ball, kneecap, tibia and fibula, ankle and the foot bones
    B.ell('hips', sx * 0.075 * w, hipY + 0.035, -0.012, 0.07 * w, 0.06, 0.018, C, 'bone', Q(0.15, sx * 0.55, sx * 0.25));
    tube('hips', [[sx * 0.03, hipY - 0.07, 0.06], [sx * 0.075 * w, hipY - 0.06, 0.035], [sx * 0.1 * w, hipY - 0.025, 0.0]], 0.011);
    const th = R['thigh' + S], sh = R['shin' + S], ft = R['foot' + S];
    B.ell('thigh' + S, th[0], th[1] + 0.005, th[2], 0.022, 0.022, 0.022, J, 'bone'); B.ell('thigh' + S, th[0] + sx * 0.022, th[1] - 0.04, th[2], 0.016, 0.02, 0.016, J, 'bone');
    longBone('thigh' + S, th, sh, 0.017, 1.75); B.ell('shin' + S, sh[0], sh[1] + 0.012, sh[2] + 0.03, 0.018, 0.022, 0.01, C, 'bone');
    const ank = [ft[0], ft[1] - 0.02, ft[2]]; B.seg('shin' + S, sh, ank, 0.015, 0.011, C, 'bone', 0.1); B.seg('shin' + S, [sh[0] + sx * 0.02, sh[1] - 0.02, sh[2] - 0.006], [ft[0] + sx * 0.018, ft[1] - 0.01, ft[2] - 0.006], 0.006, 0.006, C, 'bone', 0);
    B.ell('foot' + S, ft[0], ft[1] - 0.04, ft[2] - 0.01, 0.022, 0.02, 0.03, J, 'bone'); B.ell('foot' + S, ft[0], ft[1] - 0.06, ft[2] - 0.04, 0.016, 0.016, 0.022, C, 'bone');
    for (let t = 0; t < 5; t++) { const x = ft[0] + (t - 2) * 0.012 * sx * -1; B.seg('foot' + S, [x * 0.6 + ft[0] * 0.4, ft[1] - 0.045, ft[2] + 0.01], [x, ft[1] - 0.07, ft[2] + 0.1], 0.0055, 0.0045, C, 'bone', 0); B.seg('foot' + S, [x, ft[1] - 0.07, ft[2] + 0.1], [x, ft[1] - 0.078, ft[2] + 0.135 - Math.abs(t - 1) * 0.006], 0.0045, 0.0035, C, 'bone', 0); }
  }
  B.ell('hips', 0, hipY - 0.01, -0.05, 0.032, 0.05, 0.02, C, 'bone', Q(-0.35, 0, 0)); // the sacrum
  // the skull: cranium, brow, cheekbones, dark sockets and nose, upper teeth, and a jaw hanging a little open
  const s = 0.126 * P.head * 0.94, [hx, hy, hz] = R.head, cy = hy + s * 1.05;
  B.ell('head', hx, cy + s * 0.12, hz - s * 0.1, s * 0.8, s * 0.88, s * 0.98, C, 'bone', null, 0, 22);
  B.ell('head', hx, cy - s * 0.28, hz + s * 0.32, s * 0.6, s * 0.44, s * 0.56, C, 'bone');
  B.ell('head', hx, cy + s * 0.14, hz + s * 0.66, s * 0.66, s * 0.14, s * 0.24, J, 'bone');
  for (const sx of [-1, 1]) { B.ell('head', hx + sx * s * 0.29, cy - s * 0.04, hz + s * 0.74, s * 0.2, s * 0.19, s * 0.13, DK, 'plain'); B.ell('head', hx + sx * s * 0.29, cy - s * 0.05, hz + s * 0.78, s * 0.035, s * 0.035, s * 0.02, '#8affc0', 'glow');
    B.ell('head', hx + sx * s * 0.46, cy - s * 0.26, hz + s * 0.56, s * 0.17, s * 0.11, s * 0.2, J, 'bone'); B.box('head', hx + sx * s * 0.62, cy - s * 0.22, hz + s * 0.18, s * 0.08, s * 0.1, s * 0.5, C, 'bone'); }
  B.geom('head', PRIM.cone8, new THREE.Matrix4().compose(V(hx, cy - s * 0.27, hz + s * 0.82), Q(Math.PI, 0, 0), V(s * 0.17, s * 0.24, s * 0.08)), DK, 'plain');
  for (let k = -3; k <= 3; k++) { const a = k * 0.2; B.box('head', hx + Math.sin(a) * s * 0.38, cy - s * 0.58, hz + s * 0.36 + Math.cos(a) * s * 0.42, s * 0.085, s * 0.13, s * 0.07, '#ece4cc', 'bone', Q(0, a, 0)); }
  const jw = Q(0.16, 0, 0);
  B.box('head', hx, cy - s * 0.86, hz + s * 0.64, s * 0.42, s * 0.16, s * 0.2, C, 'bone', jw);
  for (const sx of [-1, 1]) { B.box('head', hx + sx * s * 0.36, cy - s * 0.78, hz + s * 0.36, s * 0.12, s * 0.14, s * 0.52, C, 'bone', Q(0.16, -sx * 0.45, 0)); B.box('head', hx + sx * s * 0.54, cy - s * 0.48, hz + s * 0.08, s * 0.1, s * 0.5, s * 0.14, C, 'bone', Q(-0.2, 0, 0)); }
  for (let k = -2; k <= 2; k++) { const a = k * 0.22; B.box('head', hx + Math.sin(a) * s * 0.34, cy - s * 0.74, hz + s * 0.34 + Math.cos(a) * s * 0.38, s * 0.08, s * 0.1, s * 0.06, '#ece4cc', 'bone', Q(0.16, a, 0)); }
  return { s, cy, top: cy + s * 1.05 };
}

// ---------- the whole humanoid ----------
const geoCache = new Map();
function lookKey(look, kind) {
  const L = look || {}; const a = L.armor || {};
  return [kind, L.race, L.gender, L.skin, L.hair, L.hairStyle, a.kind, a.col, a.trim, L.robe, L.bare, L.helm, L.helmCol, L.helmPlume, L.helmSpike, L.horns, L.hat, L.hatCol, L.hatTrim, L.hoodPoint, L.mask, L.cape, L.sash, L.beard, L.crown, L.tusk, L.snout, L.ears, L.eyesCol, L.width, L.pants, L.barefoot].join('|');
}
export function humanoidGeometry(look, kind) {
  const key = lookKey(look, kind); let g = geoCache.get(key); if (g) return g;
  const P = proportions(look, kind); const rest = restPositions(P); const B = new Body(rest);
  if (kind === 'skeleton') { const H = skeletonFrame(B, rest, P); headgear(B, look, P, H); g = B.build(); g.userData = { rest, P, top: H.top, headS: H.s }; geoCache.set(key, g); return g; }
  const armor = look.armor || { kind: 'none', col: '#7a6a5a', trim: '#5a4a3a' };
  const ak = armor.kind || 'none'; const ac = armor.col || '#7a6a5a', at = armor.trim || '#5a4a3a';
  const robe = ak === 'cloth' || look.robe;
  const skull = kind === 'skeleton' || kind === 'lich';
  const skin = skull ? '#e8e2cc' : look.skin || '#e2b48e';
  const race = D.RACES[look.race] || {};
  const pants = ak === 'plate' ? shade(ac, -0.1) : ak === 'chain' ? '#6a6a70' : ak === 'leather' ? '#5a3e28' : look.pants || '#4a4a5a';
  const boots = ak === 'plate' ? shade(ac, -0.25) : look.barefoot || race.barefoot || kind === 'troll' || kind === 'ogre' || kind === 'goblin' ? skin : '#3a2a1e';
  const torsoMat = ak === 'plate' ? 'metal' : ak === 'chain' ? 'chain' : ak === 'leather' ? 'leather' : 'cloth';
  const bare = look.bare || ak === 'none' && (kind === 'troll' || kind === 'ogre' || kind === 'lizard' || kind === 'giant' && false);
  const fem = P.fem, w = P.w;
  const R = rest;
  const skinMat = skull ? 'bone' : kind === 'lizard' ? 'scales' : 'skin';
  // ---- legs ----
  for (const sd of ['L', 'R']) {
    const th = R['thigh' + sd], sh = R['shin' + sd], ft = R['foot' + sd];
    const thighR = (skull ? 0.035 : 0.092 * (kind === 'ogre' || kind === 'troll' ? 1.3 : 1) * (fem ? 0.95 : 1)) * w;
    if (skull) { B.seg('thigh' + sd, th, sh, 0.03, 0.028, skin, 'bone'); B.seg('shin' + sd, sh, ft, 0.028, 0.024, skin, 'bone'); B.ell('shin' + sd, sh[0], sh[1], sh[2] + 0.02, 0.05, 0.05, 0.05, skin, 'bone'); }
    else {
      B.seg('thigh' + sd, th, sh, thighR, thighR * 0.72, bare && kind !== 'giant' ? skin : pants, bare && kind !== 'giant' ? skinMat : ak === 'plate' ? 'metal' : ak === 'chain' ? 'chain' : 'cloth', 0.22);
      B.seg('shin' + sd, sh, [ft[0], ft[1] + 0.04, ft[2]], thighR * 0.68, thighR * 0.5, bare && kind !== 'giant' ? skin : pants, bare && kind !== 'giant' ? skinMat : ak === 'plate' ? 'metal' : 'cloth', 0.22);
    }
    // boots / feet
    if (!skull) B.box('foot' + sd, ft[0], ft[1] - 0.04, ft[2] + 0.06, 0.1 * w, 0.09, 0.25, boots, boots === skin ? skinMat : ak === 'plate' ? 'metal' : 'leather');
    else B.box('foot' + sd, ft[0], ft[1] - 0.05, ft[2] + 0.06, 0.06, 0.04, 0.18, skin, 'bone');
    if (!skull && boots !== skin) B.seg('shin' + sd, [sh[0], sh[1] - 0.16, sh[2]], [ft[0], ft[1] - 0.02, ft[2]], thighR * 0.62, thighR * 0.58, boots, ak === 'plate' ? 'metal' : 'leather', 0);
    if (ak === 'plate') { B.ell('shin' + sd, sh[0], sh[1], sh[2] + 0.04, 0.06, 0.06, 0.05, shade(ac, 0.15), 'metal'); }
  }
  // ---- torso ----
  const hipY = R.hips[1], chestY = R.chest[1], shY = R.shL[1];
  const chestCol = bare ? skin : ac;
  if (skull) {
    B.ell('hips', 0, hipY, 0, 0.12, 0.08, 0.07, skin, 'bone');
    B.seg('spine', [0, hipY, -0.02], [0, shY, -0.03], 0.025, 0.025, skin, 'bone');
    for (let k = 0; k < 5; k++) { const y = chestY - 0.08 + k * 0.055; B.geom('chest', new THREE.TorusGeometry(0.12 - Math.abs(k - 2) * 0.012, 0.012, 5, 14, Math.PI * 1.4), new THREE.Matrix4().compose(new THREE.Vector3(0, y, 0.0), Q(Math.PI / 2, 0, -Math.PI * 0.2 + Math.PI), new THREE.Vector3(1, 0.8, 1)), skin, 'bone'); }
    B.ell('chest', 0, shY - 0.01, 0, 0.17, 0.03, 0.06, skin, 'bone');
  } else {
    const belly = 1 + P.belly * 2.5;
    B.ell('hips', 0, hipY + 0.02, 0, 0.175 * w * (fem ? 1.08 : 1), 0.125, 0.125 * belly, bare && kind !== 'giant' ? skin : pants, bare ? skinMat : 'cloth', null, 0);
    B.ell('spine', 0, hipY + 0.15, 0.005 + P.belly * 0.12, 0.162 * w * belly, 0.15, 0.118 * belly + P.belly * 0.1, chestCol, bare ? skinMat : torsoMat, null, 0.3);
    B.ell('chest', 0, chestY + 0.06, 0, 0.205 * w * (fem ? 0.88 : 1), 0.18, 0.13, chestCol, bare ? skinMat : torsoMat, null, 0.3);
    if (fem && !robe && ak !== 'plate') for (const sd of [-1, 1]) B.ell('chest', sd * 0.065 * w, chestY + 0.04, 0.085, 0.06, 0.055, 0.055, chestCol, bare ? skinMat : torsoMat);
    if (bare && kind !== 'giant') { B.ell('chest', 0, chestY + 0.02, 0.07, 0.15 * w, 0.06, 0.04, shade(skin, -0.05), skinMat); }
    // neck
    B.seg('neck', [0, shY - 0.02, 0], [0, R.head[1] + 0.02, 0.01], 0.055 * (kind === 'troll' || kind === 'orc' ? 1.6 : 1) * (fem ? 0.85 : 1), 0.05 * (kind === 'orc' ? 1.5 : 1), skull ? skin : skin, skinMat, 0.3);
    // armour details on the torso
    if (ak === 'plate') {
      B.ell('chest', 0, chestY + 0.07, 0.03, 0.205 * w, 0.165, 0.125, shade(ac, 0.08), 'metal');
      B.box('chest', 0, chestY + 0.1, 0.14, 0.025, 0.2, 0.02, at, 'gold');
      B.geom('hips', new THREE.CylinderGeometry(0.17 * w, 0.21 * w, 0.2, 14, 1, true), new THREE.Matrix4().makeTranslation(0, hipY - 0.06, 0), shade(ac, -0.05), 'metal');
      B.geom('hips', new THREE.CylinderGeometry(0.172 * w, 0.172 * w, 0.06, 14), new THREE.Matrix4().makeTranslation(0, hipY + 0.05, 0), at, 'leather');
    } else if (ak === 'chain') {
      B.geom('hips', new THREE.CylinderGeometry(0.16 * w, 0.2 * w, 0.26, 14, 1, true), new THREE.Matrix4().makeTranslation(0, hipY - 0.08, 0), '#8e9298', 'chain');
      B.geom('hips', new THREE.CylinderGeometry(0.165 * w, 0.165 * w, 0.05, 14), new THREE.Matrix4().makeTranslation(0, hipY + 0.05, 0), '#3a2618', 'leather');
      B.box('chest', 0, chestY + 0.06, 0.13, 0.2 * w, 0.24, 0.02, at, 'cloth');
    } else if (ak === 'leather') {
      B.geom('hips', new THREE.CylinderGeometry(0.165 * w, 0.165 * w, 0.055, 14), new THREE.Matrix4().makeTranslation(0, hipY + 0.05, 0), '#3a2618', 'leather');
      B.box('hips', 0, hipY + 0.05, 0.165, 0.06, 0.05, 0.02, '#c8a040', 'gold');
      for (const sd of [-1, 1]) B.box('chest', sd * 0.08 * w, chestY + 0.06, 0.115, 0.03, 0.3, 0.02, shade(ac, -0.35), 'leather', Q(0, 0, sd * 0.35));
    } else if (!bare && !robe) {
      B.geom('hips', new THREE.CylinderGeometry(0.163 * w, 0.163 * w, 0.045, 14), new THREE.Matrix4().makeTranslation(0, hipY + 0.06, 0), '#3a2618', 'leather');
      B.geom('hips', new THREE.CylinderGeometry(0.165 * w, 0.18 * w, 0.14, 14, 1, true), new THREE.Matrix4().makeTranslation(0, hipY - 0.03, 0), ac, 'cloth');
    }
    if (look.sash) { B.geom('hips', new THREE.CylinderGeometry(0.17 * w, 0.17 * w, 0.06, 14), new THREE.Matrix4().makeTranslation(0, hipY + 0.06, 0), look.sash, 'cloth'); B.box('hips', -0.12 * w, hipY - 0.08, 0.1, 0.05, 0.25, 0.02, look.sash, 'cloth'); }
  }
  // robe: a long skirt that follows the legs a little
  if (robe && !skull || kind === 'lich') {
    const g = new THREE.CylinderGeometry(0.17 * w, 0.28 * w, hipY - 0.04, 18, 6, true); const p = g.attributes.position;
    const off = hipY / 2 - 0.02; const base = B.n;
    B.geom('hips', g, new THREE.Matrix4().makeTranslation(0, off, 0), ac, 'cloth');
    // bind the lower robe to the thighs
    for (let i = base; i < B.n; i++) { const y = B.pos[i * 3 + 1], x = B.pos[i * 3]; const t = 1 - y / hipY; const side = x >= 0 ? BI.thighL : BI.thighR; B.si[i * 4] = BI.hips; B.si[i * 4 + 1] = side; B.sw[i * 4] = 1 - t * 0.55; B.sw[i * 4 + 1] = t * 0.55; }
    g.dispose();
    B.box('spine', 0, hipY + 0.12, 0.1, 0.04, 0.4, 0.02, at, 'cloth');
    B.geom('hips', new THREE.CylinderGeometry(0.168 * w, 0.168 * w, 0.06, 14), new THREE.Matrix4().makeTranslation(0, hipY + 0.06, 0), at, 'cloth');
  }
  // ---- arms ----
  const armCol = bare ? skin : robe ? ac : ak === 'none' ? (look.bare ? skin : ac) : shade(ac, -0.05);
  const handCol = ak === 'plate' ? shade(ac, -0.1) : skin;
  for (const sd of ['L', 'R']) {
    const sx = sd === 'L' ? 1 : -1;
    const a0 = R['arm' + sd], a1 = R['fore' + sd], a2 = R['hand' + sd];
    const ar = (skull ? 0.022 : 0.058 * (kind === 'troll' || kind === 'ogre' ? 1.5 : kind === 'orc' ? 1.25 : 1)) * w * (fem ? 0.85 : 1);
    if (skull) { B.seg('arm' + sd, a0, a1, 0.025, 0.022, skin, 'bone'); B.seg('fore' + sd, a1, a2, 0.02, 0.018, skin, 'bone'); }
    else {
      B.seg('arm' + sd, a0, a1, ar * 1.08, ar * 0.86, armCol, bare ? skinMat : robe ? 'cloth' : ak === 'plate' ? 'metal' : ak === 'chain' ? 'chain' : ak === 'leather' ? 'leather' : 'cloth', 0.2);
      const foreBare = !robe && (ak === 'none' || ak === 'leather' || bare);
      B.seg('fore' + sd, a1, a2, ar * 0.84, ar * 0.66, foreBare ? skin : armCol, foreBare ? skinMat : robe ? 'cloth' : ak === 'plate' ? 'metal' : 'chain', 0.22);
      if (robe) B.geom('fore' + sd, new THREE.CylinderGeometry(ar * 1.0, ar * 1.7, 0.18, 12, 1, true), new THREE.Matrix4().makeTranslation(a2[0], a2[1] + 0.1, a2[2]), ac, 'cloth');
      if (ak === 'leather') B.seg('fore' + sd, [a1[0], a1[1] - 0.1, a1[2]], [a2[0], a2[1] + 0.02, a2[2]], ar * 0.78, ar * 0.72, '#3a2618', 'leather', 0);
      // shoulders
      if (ak === 'plate') B.ell('arm' + sd, a0[0] + sx * 0.02, a0[1] + 0.01, a0[2], 0.1 * w, 0.075, 0.1, shade(ac, 0.1), 'metal', Q(0, 0, -sx * 0.4), 0);
      else if (ak === 'chain' || ak === 'leather') B.ell('arm' + sd, a0[0], a0[1], a0[2], 0.075 * w, 0.06, 0.075, ak === 'chain' ? '#8e9298' : shade(ac, -0.1), ak === 'chain' ? 'chain' : 'leather', null, 0);
      else B.ell('arm' + sd, a0[0] - sx * 0.01, a0[1] - 0.01, a0[2], 0.062 * w, 0.06, 0.07, armCol, bare ? skinMat : 'cloth');
    }
    // hand
    const hs = P.hand * (skull ? 0.8 : 1);
    B.box('hand' + sd, a2[0], a2[1] - 0.05 * hs, a2[2] + 0.005, 0.045 * hs, 0.1 * hs, 0.085 * hs, handCol, skull ? 'bone' : ak === 'plate' ? 'metal' : skinMat);
    B.box('hand' + sd, a2[0] - sx * 0.025 * hs, a2[1] - 0.04 * hs, a2[2] + 0.04 * hs, 0.03 * hs, 0.06 * hs, 0.03 * hs, handCol, skull ? 'bone' : ak === 'plate' ? 'metal' : skinMat, Q(0.3, 0, 0));
  }
  // ---- head, hair and hats ----
  const H = head(B, look, P, kind, skin, R.head);
  hair(B, look, P, kind, H);
  headgear(B, look, P, H);
  // ---- cape ----
  if (look.cape) {
    const cw = 0.42 * w, chh = R.capeA[1] - 0.12;
    const g = new THREE.PlaneGeometry(cw, chh, 4, 8); const p = g.attributes.position; const base = B.n;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); const t = 0.5 - y / chh; p.setX(i, p.getX(i) * (1 + t * 0.35)); p.setZ(i, -Math.abs(p.getX(i)) * 0.15); }
    g.computeVertexNormals();
    B.geom('capeA', g, new THREE.Matrix4().makeTranslation(0, R.capeA[1] - chh / 2, R.capeA[2] - 0.02), look.cape, 'cloth');
    for (let i = base; i < B.n; i++) { const y = B.pos[i * 3 + 1]; const t = K3.clamp((R.capeA[1] - y) / chh, 0, 1); B.si[i * 4] = BI.capeA; B.si[i * 4 + 1] = BI.capeB; B.sw[i * 4] = 1 - t; B.sw[i * 4 + 1] = t; }
    // back face
    const g2 = g.clone(); g2.scale(1, 1, 1); const ix = g2.index.array; for (let i = 0; i < ix.length; i += 3) { const tmp = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = tmp; } const nn = g2.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, -nn.getX(i), -nn.getY(i), -nn.getZ(i));
    const base2 = B.n; B.geom('capeA', g2, new THREE.Matrix4().makeTranslation(0, R.capeA[1] - chh / 2, R.capeA[2] - 0.025), shade(look.cape, -0.25), 'cloth');
    for (let i = base2; i < B.n; i++) { const y = B.pos[i * 3 + 1]; const t = K3.clamp((R.capeA[1] - y) / chh, 0, 1); B.si[i * 4] = BI.capeA; B.si[i * 4 + 1] = BI.capeB; B.sw[i * 4] = 1 - t; B.sw[i * 4 + 1] = t; }
    g.dispose(); g2.dispose();
    B.box('chest', 0, R.capeA[1] + 0.01, R.capeA[2] + 0.02, cw * 0.9, 0.05, 0.05, shade(look.cape, -0.2), 'cloth');
  }
  // ---- lizard tail ----
  if (kind === 'lizard') { B.seg('tail1', R.tail1, R.tail2, 0.09, 0.07, skin, 'scales', 0.1); B.seg('tail2', R.tail2, R.tail3, 0.07, 0.04, skin, 'scales', 0.2); B.seg('tail3', R.tail3, [0, R.tail3[1] - 0.2, R.tail3[2] - 0.45], 0.04, 0.01, skin, 'scales', 0.2); }
  // ---- scarecrow straw tufts ----
  if (kind === 'scarecrow') for (const sd of ['L', 'R']) { const h2 = R['hand' + sd]; for (let k = 0; k < 4; k++) B.geom('hand' + sd, PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(h2[0] + (k - 1.5) * 0.02, h2[1] - 0.1, h2[2]), Q(Math.PI, 0, (k - 1.5) * 0.3), new THREE.Vector3(0.03, 0.15, 0.03)), '#d8b878', 'fur'); }
  g = B.build(); g.userData = { rest, P, top: H.top, headS: H.s };
  geoCache.set(key, g);
  return g;
}

// ---------- a rigged instance ----------
// kinds still built the classic way (no human body underneath)
const CLASSIC = new Set(['skeleton', 'lich', 'lizard', 'scarecrow']);
export const useHumanBody = (look, kind) => !!humanAsset() && !CLASSIC.has(kind) && !(look && (look.snout || look.wings || look.classic));
// crests on a fitted helmet: f is the head frame (centre c, radii rad); the shell sits about 1.5 cm out
const _up = new THREE.Vector3(0, 1, 0);
function rod(B, a, b, r0, r1, col, mat) { const d = new THREE.Vector3().subVectors(b, a); const len = d.length(); if (len < 1e-4) return; const g = new THREE.CylinderGeometry(r1, r0, len, 7); B.geom('head', g, new THREE.Matrix4().compose(a.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(_up, d.normalize()), new THREE.Vector3(1, 1, 1)), col, mat); g.dispose(); }
function helmCrest(B, L, f) {
  const c = f.c, R = f.rad; const top = c.y + R.y + 0.012; const V = (x, y, z) => new THREE.Vector3(x, y, z);
  if (L.helmCrest === 'horns') for (const sd of [-1, 1]) { // curved horns sweeping out, up and forward from the temples
    let p = V(sd * R.x * 0.92, c.y + R.y * 0.42, c.z + R.z * 0.05); let d = V(sd * 1, 0.35, 0.15).normalize(); let r = 0.024;
    for (let k = 0; k < 7; k++) { const q = p.clone().addScaledVector(d, 0.03); rod(B, p, q, r, r * 0.8, k < 1 ? '#3a2a1e' : '#e2d6b8', 'bone'); p = q; r *= 0.8; d.y += 0.28; d.x -= sd * 0.08; d.z += 0.1; d.normalize(); }
  }
  if (L.helmCrest === 'antlers') for (const sd of [-1, 1]) { // branching antlers, like a stag's
    const br = (p, d, len, r, depth) => { const q = p.clone().addScaledVector(d, len); rod(B, p, q, r, r * 0.75, '#5a4632', 'bone'); if (depth <= 0) return;
      br(q, d.clone().add(V(sd * 0.25, 0.5, -0.1)).normalize(), len * 0.8, r * 0.75, depth - 1); br(q, d.clone().add(V(-sd * 0.2, 0.7, 0.35)).normalize(), len * 0.55, r * 0.6, depth - 2); };
    br(V(sd * R.x * 0.7, c.y + R.y * 0.75, c.z), V(sd * 0.8, 0.6, -0.1).normalize(), 0.055, 0.009, 3);
  }
  if (L.helmCrest === 'wings') for (const sd of [-1, 1]) { // gilded wings rising from the sides
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.03, 0.09, 0.02, 0.16); sh.lineTo(0.0, 0.11); sh.lineTo(-0.012, 0.13); sh.lineTo(-0.02, 0.08); sh.lineTo(-0.03, 0.09); sh.quadraticCurveTo(-0.03, 0.03, 0, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false }); B.geom('head', g, new THREE.Matrix4().compose(V(sd * (R.x + 0.012), c.y + R.y * 0.35, c.z - R.z * 0.15), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sd * Math.PI / 2, sd * -0.35)), V(1, 1, 1)), '#d8b048', 'gold'); g.dispose();
  }
  if (L.helmPlume) for (let k = 0; k < 8; k++) { const a = -0.3 + k * 0.32; B.ell('head', 0, c.y + Math.cos(a) * (R.y + 0.03) + 0.01, c.z + Math.sin(-a) * (R.z + 0.03), 0.012, 0.03, 0.024, k % 2 ? shade(L.helmPlume, 0.12) : L.helmPlume, 'fur', Q(-a - 0.3, 0, 0)); }
  void top;
}
// hats, helmets, crowns, capes and plumes placed on a realistic head (the classic builders, re-aimed)
function humanAccessories(look, kind) {
  return (c) => {
    const f = c.headFrame; const rest = Object.assign({}, c.rest); rest.head = [rest.head[0], rest.head[1], f.c.z];
    const B = new Body(rest); const s = f.rad.x / 0.8; const H = { s, cy: f.c.y + f.rad.y * 0.05, top: c.top, hatTop: f.c.y + f.rad.y * 0.42 + s * 0.15 }; // brimmed hats sit down to the brow
    const L = Object.assign({}, look);
    // helmets on a real head are shells of that head (human.js); here only what rises from them: horns, antlers, wings, plumes
    if (L.helm === 'chain' || L.helm === 'plate' || L.helm === 'leather') { helmCrest(B, L, f); L.helm = null; L.helmPlume = null; L.helmSpike = null; L.horns = null; }
    headgear(B, L, c.P, H);
    if (look.cape) {
      const cw = 0.4, chh = rest.capeA[1] - 0.14;
      const g = new THREE.PlaneGeometry(cw, chh, 6, 12); const p = g.attributes.position; const base = B.n;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); const t = 0.5 - y / chh; p.setX(i, p.getX(i) * (1 + t * 0.3)); p.setZ(i, -Math.abs(p.getX(i)) * 0.12 - Math.sin(p.getX(i) * 40) * 0.006 * t); }
      g.computeVertexNormals();
      B.geom('capeA', g, new THREE.Matrix4().makeTranslation(0, rest.capeA[1] - chh / 2, rest.capeA[2] - 0.01), look.cape, 'cloth');
      for (let i = base; i < B.n; i++) { const y = B.pos[i * 3 + 1]; const t = K3.clamp((rest.capeA[1] - y) / chh, 0, 1); B.si[i * 4] = BI.capeA; B.si[i * 4 + 1] = BI.capeB; B.sw[i * 4] = 1 - t; B.sw[i * 4 + 1] = t; }
      const g2 = g.clone(); const ix = g2.index.array; for (let i = 0; i < ix.length; i += 3) { const tmp = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = tmp; } const nn = g2.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, -nn.getX(i), -nn.getY(i), -nn.getZ(i));
      const base2 = B.n; B.geom('capeA', g2, new THREE.Matrix4().makeTranslation(0, rest.capeA[1] - chh / 2, rest.capeA[2] - 0.015), shade(look.cape, -0.25), 'cloth');
      for (let i = base2; i < B.n; i++) { const y = B.pos[i * 3 + 1]; const t = K3.clamp((rest.capeA[1] - y) / chh, 0, 1); B.si[i * 4] = BI.capeA; B.si[i * 4 + 1] = BI.capeB; B.sw[i * 4] = 1 - t; B.sw[i * 4 + 1] = t; }
      g.dispose(); g2.dispose();
      B.box('chest', 0, rest.capeA[1] + 0.005, rest.capeA[2] + 0.02, cw * 0.85, 0.035, 0.04, shade(look.cape, -0.2), 'cloth');
      for (const sx of [-1, 1]) B.ell('chest', sx * cw * 0.42, rest.capeA[1] + 0.005, rest.capeA[2] + 0.05, 0.016, 0.016, 0.01, '#d8b048', 'gold');
    }
    if (look.sash) B.box('hips', -0.1, rest.hips[1] - 0.06, 0.11, 0.05, 0.22, 0.015, look.sash, 'cloth');
    if (!B.n) return null;
    const g = B.build(); return g;
  };
}
export function makeHumanoid(look, kind) {
  if (useHumanBody(look, kind)) {
    const rig = makeHumanRig(look, kind, humanAccessories(look, kind), charMat);
    equip(rig, look);
    return rig;
  }
  const geom = humanoidGeometry(look, kind); const rest = geom.userData.rest;
  const bones = BONE_NAMES.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  bones.forEach((b, i) => { const n = BONE_NAMES[i]; const p = rest[n]; const par = PARENT[n]; if (par) { const pp = rest[par]; b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]); bones[BI[par]].add(b); } else b.position.set(p[0], p[1], p[2]); });
  const mesh = new THREE.SkinnedMesh(geom, charMat);
  mesh.add(bones[0]); mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = true;
  const rig = { mesh, bones: Object.fromEntries(bones.map((b) => [b.name, b])), rest, P: geom.userData.P, top: geom.userData.top, kind, look, held: {}, t: Math.random() * 10, phase: 0, deadT: 0, atkPrev: 0, swing: 0, swingKind: null };
  // weapons
  equip(rig, look);
  return rig;
}
export function equip(rig, look) {
  for (const k in rig.held) { const o = rig.held[k]; if (o && o.parent) o.parent.remove(o); }
  rig.held = {};
  const wt = look.weapon; const rangedBow = look.rangeW && look.rangeW === 'ARC';
  const opt = { staff: look.staff || ['wizard', 'enchanter', 'magician', 'necromancer', 'druid', 'shaman', 'cleric'].includes(look.cls), orb: look.orb, tomeCol: look.tomeCol, item: look.wItem };
  if (wt) {
    const w = weaponMesh(wt === 'sword' ? '1HS' : wt, opt);
    if (w) { const gp = (S, dy, dz) => (rig.hands ? w.position.set(...rig.hands[S].grip) : w.position.set(0, dy, dz)); if (wt === 'ARC') { rig.bones.handL.add(w); gp('L', -0.06, 0.02); w.rotation.set(Math.PI / 2, 0, 0); rig.held.L = w; rig.bow = true; } else if (wt === 'TOME') { rig.bones.handL.add(w); gp('L', -0.08, 0.04); w.rotation.set(0.3, 0, 0); rig.held.L = w; } else { rig.bones.handR.add(w); gp('R', -0.07, 0.01); w.rotation.set(Math.PI / 2, 0, 0); rig.held.R = w; } }
    rig.wtype = wt;
  }
  if (look.offhand && !rig.held.L) {
    if (look.offhand === 'shield') { const s = weaponMesh('shield', { shieldCol: look.shieldCol, shieldEmb: look.shieldEmb, wood: false, item: look.oItem }); if (s) { rig.bones.foreL.add(s); const fl = rig.rest.foreL, hl = rig.rest.handL; s.position.set((hl[0] - fl[0]) * 0.55 + 0.07, (hl[1] - fl[1]) * 0.55, 0.04); s.rotation.set(0, Math.PI / 2, 0); rig.held.L = s; rig.shield = true; } }
    else { const w = weaponMesh(look.offhand === 'sword' ? '1HS' : look.offhand, { item: look.oItem }); if (w) { rig.bones.handL.add(w); if (rig.hands) w.position.set(...rig.hands.L.grip); else w.position.set(0, -0.07, 0.01); w.rotation.set(Math.PI / 2, 0, 0); rig.held.L = w; rig.dual = true; } }
  }
  if (look.back === 'bow' && wt !== 'ARC') { const b = weaponMesh('ARC', {}); if (b) { rig.bones.chest.add(b); b.position.set(0.02, 0.0, -0.16); b.rotation.set(0, 0, 0.7); rig.held.back = b; } const q = weaponMesh('quiver', {}); if (q) { rig.bones.chest.add(q); q.position.set(-0.1, 0.02, -0.15); q.rotation.set(0.15, 0, -0.35); rig.held.quiver = q; } }
  rig.mesh.updateMatrixWorld(true);
}

// ---------- animation ----------
const E = (b, x, y, z) => { b.rotation.set(x, y, z); };
// st: { move (0..1 speed), dist (m walked this frame), atk (0..1), atkKind, cast, sit, dead, stun, mez, fear, kick, anim, animK, combat, float, drunk, mounted, look target yaw offset }
export function animateHumanoid(rig, st, dt) {
  const B = rig.bones; const t = (rig.t += dt);
  const P = rig.P;
  // walking blends in quickly (a slow blend read as a delay before the legs answered the keys)
  const mv = K3.clamp(st.move, 0, 1); rig.mv = (rig.mv || 0) + (mv - (rig.mv || 0)) * Math.min(1, dt * (mv > (rig.mv || 0) ? 14 : 9)); const m = rig.mv;
  // the walk cycle (gait.js) advances with the distance covered; cos(ph) = 1 when the left foot lands
  const ph = (rig.phase = (rig.gp || 0) * Math.PI * 2); const c = Math.cos(ph);
  // reset
  for (const k in B) B[k].rotation.set(0, 0, 0);
  B.hips.position.set(rig.rest.hips[0], rig.rest.hips[1], rig.rest.hips[2]);
  const hunch = P.hunch || 0;
  // ---- idle breathing and stance ----
  const br = 0;
  B.spine.rotation.x = hunch * 0.5 + br * 0.4; B.chest.rotation.x = hunch * 0.6 - br; B.neck.rotation.x = -hunch * 0.8; B.head.rotation.x = -hunch * 0.3;
  B.armL.rotation.z = 0.09 + Math.sin(t * 1.9) * 0.015; B.armR.rotation.z = -0.09 - Math.sin(t * 1.9) * 0.015;
  B.foreL.rotation.x = -0.12; B.foreR.rotation.x = -0.12;
  if (rig.shield) { B.armL.rotation.x = -0.25; B.foreL.rotation.x = -1.1; B.armL.rotation.z = 0.25; }
  if (rig.bow) { B.armL.rotation.x = -0.15; }
  if (st.combat && !st.cast) {
    // fighting stance: weapon up, knees bent
    B.armR.rotation.x = -0.35; B.foreR.rotation.x = -1.0; B.armR.rotation.z = -0.25;
    if (rig.wtype === '2HS' || rig.wtype === '2HB' && !rig.staffy || rig.wtype === 'axe' && rig.twoHand || rig.wtype === 'spear') { B.armL.rotation.x = -0.6; B.foreL.rotation.x = -1.15; B.armL.rotation.z = -0.2; }
  }
  // ---- walking / running ----
  if (m > 0.02) {
    // pelvis turns with the stepping leg, shoulders counter it, arms swing against the legs
    const run = K3.smooth(2.3, 5.0, rig.gv || 0), A = (0.32 + 0.3 * run) * m;
    B.hips.rotation.y = -c * (0.08 + 0.04 * run) * m; B.chest.rotation.y = c * (0.1 + 0.08 * run) * m; B.spine.rotation.x += (0.04 + 0.14 * run) * m;
    B.hips.rotation.z = -Math.sin(ph * 2) * 0.03 * m * (1 - run);
    // the head stays steady over the twisting shoulders and leans less than the body, as a runner's does
    B.neck.rotation.y -= c * (0.1 + 0.08 * run) * m * 0.85; B.neck.rotation.x -= (0.03 + 0.1 * run) * m;
    if (st.combat || st.cast) { B.armL.rotation.x += c * A * 0.28; } // fighting on the move: the free arm still swings a little
    if (!st.combat) { B.armL.rotation.z += 0.08 * run * m; B.armR.rotation.z -= 0.08 * run * m; B.armL.rotation.x = c * A; B.armR.rotation.x = -c * A; B.foreL.rotation.x = -0.18 - (0.15 + 1.05 * run) * m - Math.max(0, -c) * 0.25 * m; B.foreR.rotation.x = -0.18 - (0.15 + 1.05 * run) * m - Math.max(0, c) * 0.25 * m; }
  }
  // ---- jumping: arms lift for balance in the air, and the knees give a little on landing ----
  if (st.air != null) { const k = Math.sin(Math.PI * K3.clamp(st.air, 0, 1)); B.armL.rotation.x -= 0.55 * k; B.armR.rotation.x -= 0.55 * k; B.armL.rotation.z += 0.35 * k; B.armR.rotation.z -= 0.35 * k; B.spine.rotation.x += 0.12 * k; rig.landK = 1; }
  else if (rig.landK > 0) { rig.landK = Math.max(0, rig.landK - dt / 0.2); const k = Math.sin(Math.PI * (1 - rig.landK)) * 0.5; B.hips.position.y -= 0.07 * k * (rig.dims ? rig.dims.scale : 1); B.spine.rotation.x += 0.1 * k; }
  // ---- kneeling to skin an animal ----
  rig.crouchK = (rig.crouchK || 0) + ((st.crouch ? 1 : 0) - (rig.crouchK || 0)) * Math.min(1, dt * 5);
  if (rig.crouchK > 0.01) { B.hips.position.y -= rig.rest.hips[1] * 0.38 * rig.crouchK; B.spine.rotation.x += 0.45 * rig.crouchK; B.head.rotation.x += 0.35 * rig.crouchK; }
  // ---- leaning into starts and turns, rocking back on stops, breathing (motion.js) ----
  if (!st.mounted && !st.dead && !st.far) bodyLean(rig, B, st, dt);
  // ---- legs: feet planted on the ground, and sitting cross-legged (gait.js) ----
  rig.swimK = (rig.swimK || 0) + ((st.swim ? 1 : 0) - (rig.swimK || 0)) * Math.min(1, dt * 4);
  if (!st.mounted && !st.dead && rig.swimK < 0.5) legs(rig, st, dt, m);
  else { rig.sitK = 0; rig.sitHands = 0; }
  // weapons are stowed while swimming, and come back out on dry land
  { const hide = rig.swimK > 0.5; if (!!rig.swimHid !== hide) { rig.swimHid = hide; for (const h of [rig.held.R, rig.held.L]) if (h) h.visible = !hide; } }
  // ---- swimming: treading water when still; laid out along the surface with a breaststroke and a kick when moving ----
  if (rig.swimK > 0.01) {
    const k = rig.swimK; rig.swimMv = (rig.swimMv || 0) + ((st.swim && st.move > 0 ? 1 : 0) - (rig.swimMv || 0)) * Math.min(1, dt * 3); const sm = rig.swimMv;
    rig.swimPh = (rig.swimPh || 0) + dt * (0.55 + 0.45 * sm); const a = rig.swimPh * Math.PI * 2, s1 = Math.sin(a), pull = 0.5 + 0.5 * s1;
    const L = (b, ax, v) => { b.rotation[ax] = K3.lerp(b.rotation[ax], v, k); };
    L(B.hips, 'x', 0.25 + 1.05 * sm); L(B.spine, 'x', -0.12 * sm); L(B.chest, 'x', -0.1 * sm);
    L(B.neck, 'x', -0.15 - 0.75 * sm); L(B.head, 'x', -0.1 - 0.3 * sm); L(B.hips, 'y', 0); L(B.chest, 'y', 0);
    // arms: reach forward together, sweep out and back, tuck and shoot forward again; treading water they scull at the sides
    L(B.armL, 'x', K3.lerp(-0.45 + 0.25 * s1, -2.7 + 1.3 * pull, sm)); L(B.armR, 'x', K3.lerp(-0.45 + 0.25 * s1, -2.7 + 1.3 * pull, sm));
    L(B.armL, 'z', K3.lerp(0.7 + 0.25 * s1, 0.15 + 0.9 * pull, sm)); L(B.armR, 'z', -K3.lerp(0.7 + 0.25 * s1, 0.15 + 0.9 * pull, sm));
    L(B.foreL, 'x', K3.lerp(-0.6, -0.15 - 1.1 * pull, sm)); L(B.foreR, 'x', K3.lerp(-0.6, -0.15 - 1.1 * pull, sm));
    // legs: a frog kick timed against the arms, a slow bicycle while treading water
    const kick = 0.5 + 0.5 * Math.sin(a + 1.6), bike = Math.sin(a * 1.4);
    L(B.thighL, 'x', K3.lerp(-0.35 + 0.35 * bike, -0.15 - 0.55 * kick, sm)); L(B.thighR, 'x', K3.lerp(-0.35 - 0.35 * bike, -0.15 - 0.55 * kick, sm));
    L(B.thighL, 'z', 0.15 + 0.25 * kick * sm); L(B.thighR, 'z', -0.15 - 0.25 * kick * sm);
    L(B.shinL, 'x', K3.lerp(0.6 - 0.3 * bike, 0.2 + 1.2 * kick, sm)); L(B.shinR, 'x', K3.lerp(0.6 + 0.3 * bike, 0.2 + 1.2 * kick, sm));
    L(B.footL, 'x', 0.6 * sm); L(B.footR, 'x', 0.6 * sm);
  }
  if (rig.sitK > 0.01) { const k = K3.smooth(0, 1, rig.sitK); B.armL.rotation.x = K3.lerp(B.armL.rotation.x, -0.5, k); B.armR.rotation.x = K3.lerp(B.armR.rotation.x, -0.5, k); }
  // ---- casting: a looping gesture by school, or a quick hand charge, then a release thrust (motion.js) ----
  casting(rig, B, st, dt);
  // ---- attacks ----
  const a = st.atk || 0;
  // melee: wind-up, strike, follow-through and recovery, the body leading the arms (motion.js)
  const swung = melee(rig, B, st, dt);
  if (a > 0 && a < 1 && !swung) {
    const k = st.atkKind || 'slash';
    const wind = K3.smooth(0, 0.35, a), hit = K3.smooth(0.3, 0.6, a), rec = K3.smooth(0.6, 1, a);
    const sw = wind * (1 - hit) + 0, st2 = hit * (1 - rec);
    if (k === 'slash') { B.armR.rotation.x = -0.4 - wind * 1.9 + hit * 1.7 - rec * 0.1; B.armR.rotation.z = -0.3 - wind * 0.5 + hit * 0.95 - rec * 0.3; B.foreR.rotation.x = -1.0 + hit * 0.6; B.chest.rotation.y = 0.35 * wind - 0.6 * hit + 0.25 * rec; B.spine.rotation.y = -0.2 * hit; }
    else if (k === 'chop') { const up = wind * (1 - hit); B.armR.rotation.x = -0.4 - up * 2.4 - hit * 0.6 * (1 - rec); B.armL.rotation.x = B.armR.rotation.x; B.armR.rotation.z = -0.1; B.armL.rotation.z = -0.3; B.foreR.rotation.x = -0.6 - up * 0.6; B.foreL.rotation.x = -1.1 - up * 0.4; B.chest.rotation.x = -0.15 * up + 0.35 * hit * (1 - rec); B.spine.rotation.x += 0.15 * hit * (1 - rec); }
    else if (k === 'thrust') { B.armR.rotation.x = -0.5 - wind * 0.3 - hit * 1.0 + rec * 0.6; B.foreR.rotation.x = -1.2 - wind * 0.4 + hit * 1.3 - rec * 0.5; B.chest.rotation.y = 0.3 * wind - 0.4 * hit; B.thighL.rotation.x -= 0.3 * hit; }
    else if (k === 'punch') { const L = (rig.punch = rig.punch || 0) % 2; const arm = L ? 'L' : 'R'; B['arm' + arm].rotation.x = -0.4 - hit * 1.2 * (1 - rec); B['fore' + arm].rotation.x = -1.6 + hit * 1.4 * (1 - rec); B.chest.rotation.y = (L ? -1 : 1) * 0.4 * hit * (1 - rec); }
    else if (k === 'bow') { const dr = K3.smooth(0, 0.55, a), rl = K3.smooth(0.55, 0.65, a); B.armL.rotation.x = -1.5; B.armL.rotation.z = -0.15; B.foreL.rotation.x = -0.05; B.armR.rotation.x = -1.45; B.armR.rotation.z = 0.3; B.foreR.rotation.x = -0.2 - dr * (1 - rl) * 1.9; B.chest.rotation.y = 0.5; B.head.rotation.y = -0.4; }
    else if (k === 'staff') { B.armR.rotation.x = -0.4 - wind * 1.6 + hit * 1.8; B.foreR.rotation.x = -0.8; B.armL.rotation.x = -0.9 * hit * (1 - rec) - 0.3; B.foreL.rotation.x = -0.5; B.chest.rotation.x = 0.15 * hit * (1 - rec); }
    else if (k === 'claw') { B.armR.rotation.x = -0.4 - wind * 2.0 + hit * 2.0; B.armL.rotation.x = -0.4 - wind * 1.6 + hit * 1.7; B.armR.rotation.z = 0.3 * hit; B.armL.rotation.z = -0.3 * hit; B.chest.rotation.x = 0.3 * hit * (1 - rec); }
    else if (k === 'spin') { B.hips.rotation.y = a * Math.PI * 4; B.armR.rotation.z = -1.4; B.armL.rotation.z = 1.4; }
  }
  // ---- struck: a flinch, or a stagger from a heavy blow (motion.js) ----
  hurt(rig, B, st);
  // ---- kick ----
  if (st.kick > 0 && st.kick < 1) { const k = Math.sin(st.kick * Math.PI); B.thighR.rotation.x = -1.6 * k; B.shinR.rotation.x = 0.3 * (1 - k); B.chest.rotation.x = 0.2 * k; B.armL.rotation.z = 0.6 * k; B.armR.rotation.z = -0.6 * k; }
  // ---- special moves ----
  if (st.animK && st.animP > 0 && st.animP < 1) {
    const k = st.animK, p = st.animP, s1 = Math.sin(p * Math.PI);
    if (k === 'slam' || k === 'hop') { B.hips.position.y += s1 * (k === 'slam' ? 0.7 : 0.45); B.thighL.rotation.x -= s1 * 0.6; B.thighR.rotation.x -= s1 * 0.6; B.shinL.rotation.x += s1 * 1.0; B.shinR.rotation.x += s1 * 1.0; if (k === 'slam') { B.armR.rotation.x = -2.6 * s1; B.armL.rotation.x = -2.6 * s1; } }
    else if (k === 'raise') { B.armL.rotation.x = -2.8 * s1; B.armR.rotation.x = -2.8 * s1; B.chest.rotation.x = -0.2 * s1; B.head.rotation.x = -0.4 * s1; }
    // the pub (systems.js 'drink' / 'pour' work): a mug raised to the lips and the head tipped back, a talker's open
    // hands and a nod, the trader tipping a jug
    else if (k === 'drink') { const u = K3.smooth(0, 0.3, p) * (1 - K3.smooth(0.75, 1, p)); B.armR.rotation.x = -1.35 * u; B.armR.rotation.z = -0.25 * u; B.foreR.rotation.x = -1.7 * u; B.head.rotation.x = -0.35 * u * K3.smooth(0.35, 0.5, p); }
    else if (k === 'chat') { B.armL.rotation.x = -0.7 * s1; B.foreL.rotation.x = -0.9 * s1; B.armL.rotation.z = 0.35 * s1 + Math.sin(p * 12) * 0.08; B.armR.rotation.x = -0.45 * s1; B.foreR.rotation.x = -0.8 * s1; B.head.rotation.x = Math.sin(p * 9) * 0.12; B.chest.rotation.y = Math.sin(p * 4) * 0.12; }
    else if (k === 'pour') { B.armR.rotation.x = -1.0 * s1; B.foreR.rotation.x = -0.6 * s1; B.armR.rotation.y = 0.5 * s1; B.armL.rotation.x = -0.8 * s1; B.foreL.rotation.x = -1.2 * s1; B.chest.rotation.x = 0.15 * s1; }
    else if (k === 'thrust') { B.armR.rotation.x = -1.6 * s1; B.foreR.rotation.x = -0.1; B.thighL.rotation.x -= 0.6 * s1; B.thighR.rotation.x += 0.4 * s1; }
    else if (k === 'spin') { B.hips.rotation.y = p * Math.PI * 4; B.armR.rotation.z = -1.4; B.armL.rotation.z = 1.4; }
    // gathering: an axe swung across into a trunk, a pick brought down on rock, a knife working a hide
    else if (k === 'chop') {
      const up = K3.smooth(0, 0.48, p), hit = K3.smooth(0.48, 0.6, p), back = K3.smooth(0.62, 1, p);
      const raise = up * (1 - hit), strike = hit * (1 - back);
      B.armR.rotation.x = -0.6 - 1.9 * raise - 0.8 * strike; B.armR.rotation.z = -0.15 - 0.7 * raise + 0.55 * strike; B.foreR.rotation.x = -0.5 - 0.7 * raise;
      B.armL.rotation.x = -0.75 - 1.5 * raise - 0.7 * strike; B.armL.rotation.z = 0.35 - 0.4 * raise + 0.5 * strike; B.foreL.rotation.x = -1.0 - 0.4 * raise;
      B.chest.rotation.y = 0.55 * raise - 0.55 * strike; B.spine.rotation.y = 0.2 * raise - 0.25 * strike; B.spine.rotation.x += 0.12 + 0.2 * strike;
    }
    else if (k === 'mine') {
      const up = K3.smooth(0, 0.5, p), hit = K3.smooth(0.5, 0.6, p), back = K3.smooth(0.65, 1, p);
      const raise = up * (1 - hit), strike = hit * (1 - back);
      B.armR.rotation.x = -0.6 - 2.5 * raise - 0.4 * strike; B.armL.rotation.x = -0.7 - 2.3 * raise - 0.4 * strike; B.armR.rotation.z = -0.1; B.armL.rotation.z = 0.25;
      B.foreR.rotation.x = -0.4 - 0.6 * raise; B.foreL.rotation.x = -0.8 - 0.5 * raise;
      B.chest.rotation.x = -0.3 * raise + 0.4 * strike; B.spine.rotation.x += 0.1 + 0.35 * strike; B.head.rotation.x += 0.2 * strike;
    }
    else if (k === 'skin') {
      const saw = Math.sin(p * Math.PI * 4);
      B.armR.rotation.x = -1.05 + saw * 0.22; B.foreR.rotation.x = -0.55 - saw * 0.2; B.armR.rotation.z = -0.15;
      B.armL.rotation.x = -0.9; B.foreL.rotation.x = -0.6; B.armL.rotation.z = 0.2;
    }
  }
  // ---- status ----
  if (st.stun) { B.head.rotation.z = Math.sin(t * 3) * 0.2; B.chest.rotation.z = Math.sin(t * 3 + 1) * 0.08; B.armL.rotation.z = 0.3; B.armR.rotation.z = -0.3; }
  if (st.mez) { B.head.rotation.x = 0.5; B.chest.rotation.x += 0.2; B.armL.rotation.x = 0.1; B.armR.rotation.x = 0.1; }
  if (st.drunk) { B.spine.rotation.z = Math.sin(t * 2.1) * 0.12; B.head.rotation.z = Math.sin(t * 2.4 + 1) * 0.18; }
  if (st.mounted) { B.thighL.rotation.x = -1.3; B.thighR.rotation.x = -1.3; B.thighL.rotation.z = 0.5; B.thighR.rotation.z = -0.5; B.shinL.rotation.x = 1.2; B.shinR.rotation.x = 1.2; }
  // ---- cape trails, swings past on stops and turns (motion.js) ----
  cape(rig, B, st, dt, m);
  if (B.tail1) { B.tail1.rotation.y = Math.sin(t * 2 + ph) * 0.25; B.tail2.rotation.y = Math.sin(t * 2 + ph - 0.8) * 0.3; B.tail3.rotation.y = Math.sin(t * 2 + ph - 1.6) * 0.35; B.tail1.rotation.x = 0.5; }
  // weapons: swords hang down at rest and come up when fighting, staffs and spears stay upright
  const ready = st.combat || st.atk > 0 || st.cast ? 1 : 0; rig.ready = (rig.ready || 0) + (ready - (rig.ready || 0)) * Math.min(1, dt * 6);
  if (rig.held.R) { const upright = rig.wtype === '2HB' || rig.wtype === 'spear'; const rest = upright ? 0.15 : Math.PI - 0.35; rig.held.R.rotation.x = rest + (Math.PI / 2 - rest) * rig.ready; }
  if (rig.bow && rig.held.L) { rig.held.L.rotation.x = (Math.PI / 2) * rig.ready; }
  if (rig.dual && rig.held.L) { rig.held.L.rotation.x = (Math.PI - 0.35) + (Math.PI / 2 - (Math.PI - 0.35)) * rig.ready; }
  // look toward a target
  if (!st.far) look(rig, B, st, dt);
  if (!st.cast && !rig.sw && !(st.atk > 0 && st.atk < 1)) handsOnKnees(rig);
  // fingers: a fist around a weapon, open while casting, loosely curled otherwise
  if (rig.hands && !st.far) for (const S of ['L', 'R']) {
    const held = S === 'R' ? rig.held.R : (rig.held.L && !rig.shield) || rig.bow; const grip = S === 'L' && rig.shield;
    const want = st.cast ? 0.08 : held ? 1.35 : grip ? 1.1 : st.dead ? 0.6 : 0.32 + Math.sin(t * 0.7 + (S === 'L' ? 1 : 0)) * 0.03;
    const k = 'curl' + S; rig[k] = rig[k] == null ? want : rig[k] + (want - rig[k]) * Math.min(1, dt * 10); const c = rig[k]; const h = rig.hands[S];
    for (let f = 1; f <= 4; f++) { const sp = (f - 2.5) * 0.05; B['f' + f + S + '1'].quaternion.setFromAxisAngle(h.axis, c * (0.95 + sp)); B['f' + f + S + '2'].quaternion.setFromAxisAngle(h.axis, c * (1.05 + sp)); }
    B['th' + S + '1'].quaternion.setFromAxisAngle(h.tax, c * 0.35); B['th' + S + '2'].quaternion.setFromAxisAngle(h.tax, c * 0.55);
  }
}
export { BONE_NAMES, BI };

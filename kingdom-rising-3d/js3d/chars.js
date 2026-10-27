// Kingdom Rising 3D — people and humanoid monsters: a skinned body built from the 2D game's `look`
// (race, sex, skin, hair, armour kind and colours, helms and hats, capes, beards, tusks, ears...),
// with procedural animation for walking, idling, every weapon swing, casting, sitting, kicking and dying.
import { THREE, K3 } from './core.js';
import { MB, PRIM } from './mb.js';
import { weaponMesh } from './weapons.js';

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
    else if (pat == 10.) { vec2 g = fract(vec2(q.x * 60. + q.z * 60., q.y * 60. + floor(q.x * 60. + q.z * 60.) * .5)) - .5; gPat = mix(.5, smoothstep(.5, .2, length(g)), aaM); diffuseColor.rgb *= .85 + .22 * gPat; }
  `).replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vMat.x;')
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vMat.y;')
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    if (pat == 7. || pat == 10.) { vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition); float dhx = dFdx(gPat), dhy = dFdy(gPat);
      vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx); float det = dot(dpdx, r1); vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
      normal = normalize(abs(det) * normal - grad * (pat == 7. ? .5 : .2)); }`)
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * gEm * 2.5;');
};
charMat.customProgramCacheKey = () => 'krchar';
const MATS = { plain: [0, 0.8, 0], cloth: [0, 0.95, 1], leather: [0, 0.62, 2], metal: [0.85, 0.32, 3], fur: [0, 1, 4], skin: [0, 0.6, 5], hair: [0, 0.55, 6], chain: [0.8, 0.45, 7], bone: [0, 0.7, 8], glow: [0, 1, 9], scales: [0.1, 0.45, 10], gold: [1, 0.25, 3], wood: [0, 0.8, 2], gem: [0.2, 0.1, 9] };

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
  if (look.race === 'barbarian' || look.race === 'ogre' || look.race === 'troll') Object.assign(P, { hand: 1.15 });
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
function headgear(B, look, P, H) {
  const { s, cy } = H; const hz = B.rest.head[2]; const c = look.helmCol || (look.armor && look.armor.col) || '#a8acb4';
  if (look.helm === 'plate') {
    const g = new THREE.SphereGeometry(1, 20, 14); B.geom('head', g, new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 0.06, hz + s * 0.02), Q(0, 0, 0), new THREE.Vector3(s * 1.08, s * 1.3, s * 1.14)), shade(c, 0.05), 'metal'); g.dispose();
    B.box('head', 0, cy + s * 0.12, hz + s * 1.08, s * 1.3, s * 0.12, s * 0.15, '#0a0a0a', 'plain');
    B.box('head', 0, cy - s * 0.2, hz + s * 1.06, s * 0.1, s * 0.7, s * 0.14, shade(c, 0.2), 'metal');
    B.box('head', 0, cy + s * 0.95, hz, s * 0.12, s * 0.3, s * 1.8, shade(c, 0.15), 'metal');
    if (look.helmPlume) for (let k = 0; k < 6; k++) B.ell('head', 0, cy + s * (1.35 + Math.sin(k / 5 * 2) * 0.15), hz + s * (0.5 - k * 0.32), s * 0.16, s * 0.32, s * 0.2, look.helmPlume, 'fur');
    if (look.helmSpike) B.geom('head', PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 1.6, hz), Q(0, 0, 0), new THREE.Vector3(s * 0.3, s * 0.9, s * 0.3)), shade(c, -0.2), 'metal');
    if (look.horns) for (const sd of [-1, 1]) B.geom('head', PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(sd * s * 1.1, cy + s * 0.8, hz), Q(0, 0, -sd * 0.7), new THREE.Vector3(s * 0.25, s * 1.1, s * 0.25)), '#e8dcc0', 'bone');
  } else if (look.helm === 'chain') {
    const g = new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.75); B.geom('head', g, new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 0.02, hz - s * 0.08), Q(-0.2, 0, 0), new THREE.Vector3(s * 1.08, s * 1.26, s * 1.12)), '#8a8a92', 'chain'); g.dispose();
    B.ell('chest', 0, B.rest.neck[1] + 0.02, hz - 0.01, s * 1.4, s * 0.45, s * 1.25, '#8a8a92', 'chain');
  }
  if (look.helm) return;
  const hc = look.hatCol || '#3a3a6a', tr = look.hatTrim || '#e0c050';
  const top = cy + s * 0.9;
  switch (look.hat) {
    case 'wizard': B.geom('head', new THREE.CylinderGeometry(s * 1.9, s * 1.9, s * 0.08, 20), new THREE.Matrix4().makeTranslation(0, top - s * 0.15, hz), hc, 'cloth');
      { const g = new THREE.ConeGeometry(s * 1.0, s * 2.8, 16, 6); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / (s * 2.8) + 0.5; p.setZ(i, p.getZ(i) - y * y * s * 0.9); } g.computeVertexNormals(); B.geom('head', g, new THREE.Matrix4().makeTranslation(0, top + s * 1.25, hz), hc, 'cloth'); g.dispose(); }
      B.geom('head', new THREE.CylinderGeometry(s * 1.02, s * 1.02, s * 0.22, 20, 1, true), new THREE.Matrix4().makeTranslation(0, top, hz), tr, 'gold'); break;
    case 'hood': { const g = new THREE.SphereGeometry(1, 20, 14, Math.PI * 0.18, Math.PI * 1.64); B.geom('head', g, new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 0.12, hz - s * 0.05), Q(0, Math.PI, 0), new THREE.Vector3(s * 1.25, s * 1.38, s * 1.3)), hc, 'cloth'); g.dispose();
      B.ell('chest', 0, B.rest.neck[1], hz - 0.03, s * 1.8, s * 0.6, s * 1.5, hc, 'cloth');
      if (look.hoodPoint) B.geom('head', PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 1.0, hz - s * 1.0), Q(-1.1, 0, 0), new THREE.Vector3(s * 0.5, s * 1.1, s * 0.5)), hc, 'cloth');
      if (look.mask) B.box('head', 0, cy - s * 0.35, hz + s * 0.85, s * 1.5, s * 0.55, s * 0.35, look.mask, 'cloth');
      break; }
    case 'feather': B.geom('head', new THREE.CylinderGeometry(s * 1.0, s * 1.05, s * 0.6, 18), new THREE.Matrix4().makeTranslation(0, top - s * 0.05, hz), hc, 'cloth'); B.geom('head', new THREE.CylinderGeometry(s * 1.6, s * 1.6, s * 0.06, 18), new THREE.Matrix4().makeTranslation(0, top - s * 0.32, hz), hc, 'cloth');
      B.geom('head', new THREE.CylinderGeometry(s * 1.02, s * 1.02, s * 0.14, 18, 1, true), new THREE.Matrix4().makeTranslation(0, top - s * 0.18, hz), tr, 'cloth');
      B.geom('head', PRIM.sph12, new THREE.Matrix4().compose(new THREE.Vector3(s * 0.9, top + s * 0.4, hz - s * 0.3), Q(-0.6, 0, -0.5), new THREE.Vector3(s * 0.18, s * 1.5, s * 0.06)), '#f4f0e8', 'fur'); break;
    case 'circlet': B.geom('head', new THREE.TorusGeometry(s * 0.9, s * 0.05, 6, 24), new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 0.42, hz), Q(Math.PI / 2 + 0.15, 0, 0), new THREE.Vector3(1, 1, 1)), tr, 'gold'); B.ell('head', 0, cy + s * 0.4, hz + s * 0.9, s * 0.1, s * 0.1, s * 0.06, '#c06aff', 'glow'); break;
    case 'headband': B.geom('head', new THREE.TorusGeometry(s * 0.92, s * 0.08, 6, 24), new THREE.Matrix4().compose(new THREE.Vector3(0, cy + s * 0.38, hz), Q(Math.PI / 2 + 0.1, 0, 0), new THREE.Vector3(1, 1, 1)), hc, 'cloth'); break;
    case 'mitre': { const g = new THREE.CylinderGeometry(s * 0.3, s * 0.95, s * 2.0, 4, 1); B.geom('head', g, new THREE.Matrix4().compose(new THREE.Vector3(0, top + s * 0.8, hz), Q(0, Math.PI / 4, 0), new THREE.Vector3(1, 1, 0.75)), hc, 'cloth'); g.dispose(); B.box('head', 0, top + s * 0.8, hz + s * 0.52, s * 0.18, s * 1.6, s * 0.04, tr, 'gold'); B.box('head', 0, top + s * 1.1, hz + s * 0.5, s * 0.7, s * 0.16, s * 0.04, tr, 'gold'); break; }
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

// ---------- the whole humanoid ----------
const geoCache = new Map();
function lookKey(look, kind) {
  const L = look || {}; const a = L.armor || {};
  return [kind, L.race, L.gender, L.skin, L.hair, L.hairStyle, a.kind, a.col, a.trim, L.robe, L.bare, L.helm, L.helmCol, L.helmPlume, L.helmSpike, L.horns, L.hat, L.hatCol, L.hatTrim, L.hoodPoint, L.mask, L.cape, L.sash, L.beard, L.crown, L.tusk, L.snout, L.ears, L.eyesCol, L.width, L.pants, L.barefoot].join('|');
}
export function humanoidGeometry(look, kind) {
  const key = lookKey(look, kind); let g = geoCache.get(key); if (g) return g;
  const P = proportions(look, kind); const rest = restPositions(P); const B = new Body(rest);
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
export function makeHumanoid(look, kind) {
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
  const opt = { staff: look.staff || ['wizard', 'enchanter', 'magician', 'necromancer', 'druid', 'shaman', 'cleric'].includes(look.cls), orb: look.orb, tomeCol: look.tomeCol };
  if (wt) {
    const w = weaponMesh(wt === 'sword' ? '1HS' : wt, opt);
    if (w) { if (wt === 'ARC') { rig.bones.handL.add(w); w.position.set(0, -0.06, 0.02); w.rotation.set(Math.PI / 2, 0, 0); rig.held.L = w; rig.bow = true; } else if (wt === 'TOME') { rig.bones.handL.add(w); w.position.set(0, -0.08, 0.04); w.rotation.set(0.3, 0, 0); rig.held.L = w; } else { rig.bones.handR.add(w); w.position.set(0, -0.07, 0.01); w.rotation.set(Math.PI / 2, 0, 0); rig.held.R = w; } }
    rig.wtype = wt;
  }
  if (look.offhand && !rig.held.L) {
    if (look.offhand === 'shield') { const s = weaponMesh('shield', { shieldCol: look.shieldCol, shieldEmb: look.shieldEmb, wood: false }); if (s) { rig.bones.foreL.add(s); const fl = rig.rest.foreL, hl = rig.rest.handL; s.position.set((hl[0] - fl[0]) * 0.55 + 0.07, (hl[1] - fl[1]) * 0.55, 0.04); s.rotation.set(0, Math.PI / 2, 0); rig.held.L = s; rig.shield = true; } }
    else { const w = weaponMesh(look.offhand === 'sword' ? '1HS' : look.offhand, {}); if (w) { rig.bones.handL.add(w); w.position.set(0, -0.07, 0.01); w.rotation.set(Math.PI / 2, 0, 0); rig.held.L = w; rig.dual = true; } }
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
  // walk phase advances with the distance covered
  const stride = 1.35 * P.leg * (P.h || 1);
  rig.phase += (st.dist / stride) * Math.PI;
  const mv = K3.clamp(st.move, 0, 1); rig.mv = (rig.mv || 0) + (mv - (rig.mv || 0)) * Math.min(1, dt * 8); const m = rig.mv;
  const ph = rig.phase; const s = Math.sin(ph), c = Math.cos(ph);
  // reset
  for (const k in B) B[k].rotation.set(0, 0, 0);
  B.hips.position.set(rig.rest.hips[0], rig.rest.hips[1], rig.rest.hips[2]);
  const hunch = P.hunch || 0;
  // ---- idle breathing and stance ----
  const br = Math.sin(t * 1.9) * 0.025;
  B.spine.rotation.x = hunch * 0.5 + br * 0.4; B.chest.rotation.x = hunch * 0.6 - br; B.neck.rotation.x = -hunch * 0.8; B.head.rotation.x = -hunch * 0.3;
  B.armL.rotation.z = 0.09 + Math.sin(t * 1.9) * 0.015; B.armR.rotation.z = -0.09 - Math.sin(t * 1.9) * 0.015;
  B.foreL.rotation.x = -0.12; B.foreR.rotation.x = -0.12;
  if (rig.shield) { B.armL.rotation.x = -0.25; B.foreL.rotation.x = -1.1; B.armL.rotation.z = 0.25; }
  if (rig.bow) { B.armL.rotation.x = -0.15; }
  if (st.combat && !st.cast) {
    // fighting stance: weapon up, knees bent
    B.armR.rotation.x = -0.35; B.foreR.rotation.x = -1.0; B.armR.rotation.z = -0.25;
    if (rig.wtype === '2HS' || rig.wtype === '2HB' && !rig.staffy || rig.wtype === 'axe' && rig.twoHand || rig.wtype === 'spear') { B.armL.rotation.x = -0.6; B.foreL.rotation.x = -1.15; B.armL.rotation.z = -0.2; }
    B.thighL.rotation.x = -0.15; B.thighR.rotation.x = 0.1; B.shinL.rotation.x = 0.25; B.shinR.rotation.x = 0.2;
    B.hips.position.y -= 0.04;
  }
  // ---- walking / running ----
  if (m > 0.02) {
    const A = 0.55 * m, K = 0.85 * m;
    B.thighL.rotation.x += -s * A; B.thighR.rotation.x += s * A;
    B.shinL.rotation.x += Math.max(0, c) * K + 0.1 * m; B.shinR.rotation.x += Math.max(0, -c) * K + 0.1 * m;
    B.footL.rotation.x = -Math.max(0, -s) * 0.3 * m; B.footR.rotation.x = -Math.max(0, s) * 0.3 * m;
    B.hips.position.y += -Math.abs(c) * 0.045 * m + 0.02 * m;
    B.hips.rotation.y = s * 0.12 * m; B.chest.rotation.y = -s * 0.18 * m; B.spine.rotation.x += 0.08 * m;
    if (!st.combat) { B.armL.rotation.x = s * 0.5 * m; B.armR.rotation.x = -s * 0.5 * m; B.foreL.rotation.x = -0.2 - Math.max(0, -s) * 0.35 * m; B.foreR.rotation.x = -0.2 - Math.max(0, s) * 0.35 * m; }
  }
  // ---- sitting ----
  if (st.sit) { B.hips.position.y = rig.rest.hips[1] * 0.52; B.thighL.rotation.x = -1.45; B.thighR.rotation.x = -1.45; B.shinL.rotation.x = 1.45; B.shinR.rotation.x = 1.45; B.armL.rotation.x = -0.5; B.armR.rotation.x = -0.5; B.foreL.rotation.x = -0.6; B.foreR.rotation.x = -0.6; }
  // ---- casting: hands raised and glowing ----
  if (st.cast) { const w = Math.sin(t * 8) * 0.08; B.armL.rotation.x = -1.25 + w; B.armR.rotation.x = -1.25 - w; B.armL.rotation.z = -0.25; B.armR.rotation.z = 0.25; B.foreL.rotation.x = -0.5; B.foreR.rotation.x = -0.5; B.chest.rotation.x -= 0.1; }
  // ---- attacks ----
  const a = st.atk || 0;
  if (a > 0 && a < 1) {
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
  // ---- kick ----
  if (st.kick > 0 && st.kick < 1) { const k = Math.sin(st.kick * Math.PI); B.thighR.rotation.x = -1.6 * k; B.shinR.rotation.x = 0.3 * (1 - k); B.chest.rotation.x = 0.2 * k; B.armL.rotation.z = 0.6 * k; B.armR.rotation.z = -0.6 * k; }
  // ---- special moves ----
  if (st.animK && st.animP > 0 && st.animP < 1) {
    const k = st.animK, p = st.animP, s1 = Math.sin(p * Math.PI);
    if (k === 'slam' || k === 'hop') { B.hips.position.y += s1 * (k === 'slam' ? 0.7 : 0.45); B.thighL.rotation.x -= s1 * 0.6; B.thighR.rotation.x -= s1 * 0.6; B.shinL.rotation.x += s1 * 1.0; B.shinR.rotation.x += s1 * 1.0; if (k === 'slam') { B.armR.rotation.x = -2.6 * s1; B.armL.rotation.x = -2.6 * s1; } }
    else if (k === 'raise') { B.armL.rotation.x = -2.8 * s1; B.armR.rotation.x = -2.8 * s1; B.chest.rotation.x = -0.2 * s1; B.head.rotation.x = -0.4 * s1; }
    else if (k === 'thrust') { B.armR.rotation.x = -1.6 * s1; B.foreR.rotation.x = -0.1; B.thighL.rotation.x -= 0.6 * s1; B.thighR.rotation.x += 0.4 * s1; }
    else if (k === 'spin') { B.hips.rotation.y = p * Math.PI * 4; B.armR.rotation.z = -1.4; B.armL.rotation.z = 1.4; }
  }
  // ---- status ----
  if (st.stun) { B.head.rotation.z = Math.sin(t * 3) * 0.2; B.chest.rotation.z = Math.sin(t * 3 + 1) * 0.08; B.armL.rotation.z = 0.3; B.armR.rotation.z = -0.3; }
  if (st.mez) { B.head.rotation.x = 0.5; B.chest.rotation.x += 0.2; B.armL.rotation.x = 0.1; B.armR.rotation.x = 0.1; }
  if (st.drunk) { B.spine.rotation.z = Math.sin(t * 2.1) * 0.12; B.head.rotation.z = Math.sin(t * 2.4 + 1) * 0.18; }
  if (st.mounted) { B.thighL.rotation.x = -1.3; B.thighR.rotation.x = -1.3; B.thighL.rotation.z = 0.5; B.thighR.rotation.z = -0.5; B.shinL.rotation.x = 1.2; B.shinR.rotation.x = 1.2; }
  // ---- cape lags behind when moving ----
  if (B.capeA) { B.capeA.rotation.x = 0.06 + m * 0.5 + Math.sin(t * 3) * 0.03 * (0.4 + m) + (st.sit ? 0.6 : 0); B.capeB.rotation.x = 0.08 + m * 0.35 + Math.sin(t * 3.7 + 1) * 0.05 * (0.4 + m); }
  if (B.tail1) { B.tail1.rotation.y = Math.sin(t * 2 + ph) * 0.25; B.tail2.rotation.y = Math.sin(t * 2 + ph - 0.8) * 0.3; B.tail3.rotation.y = Math.sin(t * 2 + ph - 1.6) * 0.35; B.tail1.rotation.x = 0.5; }
  // weapons: swords hang down at rest and come up when fighting, staffs and spears stay upright
  const ready = st.combat || st.atk > 0 || st.cast ? 1 : 0; rig.ready = (rig.ready || 0) + (ready - (rig.ready || 0)) * Math.min(1, dt * 6);
  if (rig.held.R) { const upright = rig.wtype === '2HB' || rig.wtype === 'spear'; const rest = upright ? 0.15 : Math.PI - 0.35; rig.held.R.rotation.x = rest + (Math.PI / 2 - rest) * rig.ready; }
  if (rig.bow && rig.held.L) { rig.held.L.rotation.x = (Math.PI / 2) * rig.ready; }
  if (rig.dual && rig.held.L) { rig.held.L.rotation.x = (Math.PI - 0.35) + (Math.PI / 2 - (Math.PI - 0.35)) * rig.ready; }
  // look toward a target
  if (st.lookYaw) { B.head.rotation.y += K3.clamp(st.lookYaw, -0.9, 0.9) * 0.6; B.neck.rotation.y += K3.clamp(st.lookYaw, -0.9, 0.9) * 0.3; }
}
export { BONE_NAMES, BI };

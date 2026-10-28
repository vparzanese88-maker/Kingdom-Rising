// Kingdom Rising 3D — realistic people. Every humanoid is shaped from the MakeHuman base human (CC0,
// converted by tools/makehuman/build.mjs): morph targets give the race, gender, build and a face of its
// own, the body is re-posed into the game's rest pose (arms down) and rigged on the game skeleton with
// real fingers. Skin, lips, brows and stubble are painted per pixel by the skin shader; eyes, lashes,
// brows and hair are separate meshes; clothes and armour are shells cut from the body and its tights.
import { THREE, K3 } from './core.js';

const KR = window.KR, D = KR.D;
let A = null;
export const humanAsset = () => A;

// ---------------------------------------------------------------- loading
export async function loadHuman(base = 'assets/human/') {
  if (A) return A;
  const v = (window.KR3D_ASSET_V || 1);
  const [meta, bin] = await Promise.all([fetch(base + 'mh.json?v=' + v).then((r) => r.json()), fetch(base + 'mh.bin?v=' + v).then((r) => r.arrayBuffer())]);
  const C = { Float32Array, Uint16Array, Uint8Array, Int16Array };
  const view = (n) => { const [o, len, t] = meta.layout[n]; return new C[t](bin, o, len); };
  const a = { meta, pos: view('pos'), uv: view('uv'), map: view('map'), skinI: view('skinI'), skinW: view('skinW'), twist: view('twist'), tIdx: view('tIdx'), tD: view('tD'), idx: {}, NV: meta.NV, NS: meta.NS };
  for (const k in meta.layout) if (k.startsWith('idx_')) a.idx[k.slice(4)] = view(k);
  a.targets = Object.fromEntries(meta.targets.map((t) => [t.name, t]));
  a.B = meta.bones; a.BI = Object.fromEntries(meta.bones.map((b, i) => [b, i]));
  // the body part each vertex belongs to (its strongest bone)
  a.region = new Uint8Array(a.NV); for (let i = 0; i < a.NV; i++) a.region[i] = a.skinI[i * 4];
  // triangles by original vertex (for normals and shells)
  a.tri = {}; for (const p in a.idx) { const ix = a.idx[p], o = new Uint16Array(ix.length); for (let i = 0; i < ix.length; i++) o[i] = a.map[ix[i]]; a.tri[p] = o; }
  a.helper = (p) => { const s = new Set(a.tri[p]); return [...s]; };
  a.eyeV = { L: a.helper('eyeL'), R: a.helper('eyeR') };
  A = a; return a;
}

// ---------------------------------------------------------------- small math
const V3 = THREE.Vector3, M4 = THREE.Matrix4, Qt = THREE.Quaternion;
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngOf(seed) { let s = seed || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hex2rgb = (h) => new THREE.Color(h || '#888888');
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- who looks like what
const KIND = {
  human: {}, goblin: { h: 0.05, muscle: 0.45, weight: 0.3, head: 1.28, arm: 1.08, leg: 0.86, ear: 'goblin', nose: 1, hunch: 0.22, gaunt: 1 },
  orc: { h: 0.8, muscle: 1, weight: 0.65, jaw: 1, brow: 1, ear: 'half', hunch: 0.12, neck: 1.35 },
  troll: { h: 1, muscle: 0.85, weight: 0.4, arm: 1.22, leg: 0.95, head: 0.9, ear: 'long', nose: 1, hunch: 0.35, jaw: 0.6, gaunt: 1 },
  ogre: { h: 1, muscle: 0.75, weight: 1, belly: 1, head: 0.88, jaw: 1, leg: 0.88, neck: 1.4 },
  giant: { h: 1, muscle: 0.8, weight: 0.6, head: 0.92 }, zombie: { muscle: 0.2, weight: 0.15, hunch: 0.2, gaunt: 1 },
  deathknight: { h: 0.8, muscle: 0.9, weight: 0.5 },
};
const RACE = {
  human: {}, halfelf: { h: 0.6, weight: 0.4, ear: 'half', ideal: 0.7 }, highelf: { h: 0.85, weight: 0.25, muscle: 0.4, ear: 'long', ideal: 1 },
  woodelf: { h: 0.55, weight: 0.3, muscle: 0.55, ear: 'long', ideal: 0.9 }, darkelf: { h: 0.55, weight: 0.25, ear: 'long', ideal: 0.9 },
  dwarf: { h: 0.1, muscle: 0.95, weight: 0.85, leg: 0.8, arm: 0.94, head: 1.08, neck: 1.25 }, gnome: { h: 0.1, weight: 0.35, head: 1.22, leg: 0.84, nose: 0.8 },
  halfling: { h: 0.15, weight: 0.6, head: 1.14, leg: 0.88 }, barbarian: { h: 0.9, muscle: 1, weight: 0.6 }, erudite: { h: 0.6, weight: 0.35, head: 1.06, forehead: 1 },
  highlander: { h: 0.75, muscle: 0.8, weight: 0.5 }, ogrin: { h: 1, muscle: 1, weight: 0.95, head: 0.96, neck: 1.35, arm: 1.06 },
  seaelf: { h: 0.65, weight: 0.25, muscle: 0.5, ear: 'long', ideal: 0.9 }, firbolg: { h: 1, muscle: 0.85, weight: 0.8, head: 1.04, neck: 1.15, ear: 'half' },
};
const CLS_MUSCLE = { warrior: 0.8, paladin: 0.75, berserker: 0.95, monk: 0.75, ranger: 0.62, rogue: 0.58, beastlord: 0.7, shadowknight: 0.75, bard: 0.55, cleric: 0.5, druid: 0.5, shaman: 0.55, wizard: 0.35, enchanter: 0.38, magician: 0.38, necromancer: 0.32 };

// every look gets a body and a face of its own, the same each time
export function bodySpec(look, kind) {
  const L = look || {}; const k = KIND[kind] || {}; const r = RACE[L.race] || {}; const raceD = D.RACES[L.race] || {};
  const fem = L.gender === 'f';
  const seed = hashStr([nameVariant(L), L.race, L.gender, L.skin, L.hair, L.hairStyle, L.cls, kind, L.face || ''].join('|'));
  const rnd = rngOf(seed); const sr = () => rnd() * 2 - 1;
  const muscle = K3.clamp((k.muscle ?? r.muscle ?? CLS_MUSCLE[L.cls] ?? 0.5) + sr() * 0.12 - (fem ? 0.12 : 0), 0, 1);
  const weight = K3.clamp((k.weight ?? r.weight ?? 0.5) + sr() * 0.15 + (L.width ? (L.width - 1) * 0.8 : 0), 0, 1);
  const height = L.tall != null ? K3.clamp(0.5 + L.tall * 0.5, 0, 1) : K3.clamp((k.h ?? r.h ?? 0.5) + sr() * 0.15, 0, 1);
  // skin tone picks the ethnic face shapes
  const sk = hex2rgb(L.skin || '#e2b48e'); const l = lum(sk); const warm = sk.r - sk.b;
  const human = !k.muscle && !KIND[kind];
  let af = K3.clamp((0.42 - l) / 0.25, 0, 1), as = K3.clamp(0.25 + sr() * 0.35, 0, 0.6) * (1 - af), ca = Math.max(0, 1 - af - as);
  if (!human && !L.race) { af = 0.2; as = 0.1; ca = 0.7; }
  const M = {};
  const add = (n, w) => { if (w) M[n] = (M[n] || 0) + w; };
  const g = fem ? 'female' : 'male';
  add(`caucasian-${g}-young`, ca); add(`african-${g}-young`, af); add(`asian-${g}-young`, as);
  // muscle and weight: MakeHuman's weighting between min, average and max
  const mw = (x) => (x < 0.5 ? { min: (0.5 - x) * 2, average: 1 - (0.5 - x) * 2, max: 0 } : { min: 0, average: 1 - (x - 0.5) * 2, max: (x - 0.5) * 2 });
  const mm = mw(muscle), ww = mw(weight);
  for (const a in mm) for (const b in ww) if (!(a === 'average' && b === 'average')) add(`${g}-${a}muscle-${b}weight`, mm[a] * ww[b]);
  if (height < 0.5) add(`${g}-minheight`, (0.5 - height) * 2); else add(`${g}-maxheight`, (height - 0.5) * 2);
  add(`${g}-idealproportions`, r.ideal ?? (human ? 0.5 : 0));
  if (fem) { const cup = sr(); if (cup > 0) add('female-maxcup', cup * 0.5); else add('female-mincup', -cup * 0.6); }
  // a face of its own
  const det = (n, amt) => { if (Math.abs(amt) < 0.02) return; const pos = A.targets[n + '-incr'] ? [n + '-incr', n + '-decr'] : A.targets[n + '-up'] ? [n + '-up', n + '-down'] : A.targets[n + '-forward'] ? [n + '-forward', n + '-backward'] : A.targets[n + '-convex'] ? [n + '-convex', n + '-concave'] : A.targets[n + '-in'] ? [n + '-in', n + '-out'] : [n, n]; add(amt > 0 ? pos[0] : pos[1], Math.abs(amt)); };
  for (const n of ['nose-scale-vert', 'nose-scale-horiz', 'nose-trans-forward', 'nose-hump', 'nose-point-width', 'nose-nostrils-width', 'nose-curve', 'mouth-scale-horiz', 'mouth-lowerlip-volume', 'mouth-upperlip-volume', 'chin-prominent', 'chin-width', 'chin-height', 'head-oval', 'head-square', 'head-round', 'forehead-trans-forward', 'eyebrows-trans-forward', 'eyebrows-angle', 'neck-scale-horiz', 'torso-vshape']) det(n, sr() * 0.45);
  const cb = sr() * 0.6; det('l-cheek-bones', cb); det('r-cheek-bones', cb);
  const es = sr() * 0.35; det('l-eye-scale', es); det('r-eye-scale', es); const eh = sr() * 0.3; det('l-eye-height2', eh); det('r-eye-height2', eh);
  if (fem) { det('mouth-upperlip-volume', 0.25); det('mouth-lowerlip-volume', 0.3); det('nose-scale-horiz', -0.2); det('chin-width', -0.2); }
  if (!fem) { det('chin-width', 0.25); det('torso-vshape', muscle * 0.5); }
  // race and creature features
  const ear = L.ears || k.ear || r.ear || raceD.ears;
  if (ear === 'long' || ear === 'goblin') { det('l-ear-shape-pointed', 1); det('r-ear-shape-pointed', 1); det('l-ear-trans-backward', 0.5); det('r-ear-trans-backward', 0.5); }
  if (ear === 'half') { det('l-ear-shape-pointed', 0.55); det('r-ear-shape-pointed', 0.55); }
  if (k.nose || r.nose || raceD.nose) { det('nose-scale-vert', 0.7); det('nose-trans-forward', 0.6); det('nose-point-width', 0.6); det('nose-scale-horiz', 0.4); }
  if (k.jaw) { det('chin-width', 0.9 * k.jaw); det('chin-prominent', 0.7 * k.jaw); det('head-square', 0.8 * k.jaw); det('mouth-scale-horiz', 0.5 * k.jaw); det('neck-scale-horiz', 0.8); }
  if (k.brow) { det('forehead-trans-forward', 0.9); det('eyebrows-trans-forward', 1); }
  if (r.forehead) { det('forehead-scale-vert', 0.6); }
  if (k.belly) det('stomach-pregnant', 0.9);
  if (L.old) det('head-age', 0.9);
  // the player's own choices in character creation, on top of the face they rolled
  const mo = L.morph || {};
  if (mo.nose) { det('nose-scale-vert', mo.nose * 0.7); det('nose-scale-horiz', mo.nose * 0.5); det('nose-trans-forward', mo.nose * 0.4); }
  if (mo.jaw) { det('chin-width', mo.jaw * 0.8); det('chin-prominent', mo.jaw * 0.6); det('head-square', mo.jaw * 0.7); }
  if (mo.cheek) { det('l-cheek-bones', mo.cheek * 0.9); det('r-cheek-bones', mo.cheek * 0.9); }
  if (mo.eyes) { det('l-eye-scale', mo.eyes * 0.6); det('r-eye-scale', mo.eyes * 0.6); }
  if (mo.lips) { det('mouth-upperlip-volume', mo.lips * 0.7); det('mouth-lowerlip-volume', mo.lips * 0.8); }
  if (mo.brow) { det('eyebrows-angle', mo.brow * 0.8); det('forehead-trans-forward', mo.brow * 0.3); }
  if (mo.head) { if (mo.head > 0) det('head-round', mo.head * 0.8); else det('head-oval', -mo.head * 0.8); }
  const baseH = (fem ? 1.70 : 1.82) * (L.race ? raceD.scale || 1 : 1);
  return { seed, M, fem, muscle, weight, ear, scales: { leg: k.leg ?? r.leg ?? 1, arm: k.arm ?? r.arm ?? 1, head: k.head ?? r.head ?? 1, neck: k.neck ?? r.neck ?? 1 }, height: baseH * (1 + (height - 0.5) * (L.tall != null ? 0.12 : 0.06)), hunch: k.hunch || 0, gaunt: k.gaunt || 0, tusk: L.tusk };
}

// ---------------------------------------------------------------- shaping, re-posing, measuring
const _v = new V3(), _q = new Qt();
function rotAbout(c, q) { return new M4().makeTranslation(c.x, c.y, c.z).multiply(new M4().makeRotationFromQuaternion(q)).multiply(new M4().makeTranslation(-c.x, -c.y, -c.z)); }
function scaleAbout(c, sx, sy, sz) { return new M4().makeTranslation(c.x, c.y, c.z).multiply(new M4().makeScale(sx, sy, sz)).multiply(new M4().makeTranslation(-c.x, -c.y, -c.z)); }
const qFrom = (a, b) => new Qt().setFromUnitVectors(a.clone().normalize(), b.clone().normalize());

export function shapeBody(spec) {
  const NV = A.NV, P = new Float32Array(A.pos);
  for (const n in spec.M) {
    const t = A.targets[n], w = spec.M[n]; if (!t || !w) continue; const u = A.meta.deltaUnit * w;
    for (let i = 0; i < t.n; i++) { const v = A.tIdx[t.off + i] * 3, d = (t.off + i) * 3; P[v] += A.tD[d] * u; P[v + 1] += A.tD[d + 1] * u; P[v + 2] += A.tD[d + 2] * u; }
  }
  const J = (name) => { const ids = A.meta.joints[name]; const o = new V3(); for (const i of ids) o.x += P[i * 3], o.y += P[i * 3 + 1], o.z += P[i * 3 + 2]; return o.multiplyScalar(1 / ids.length); };
  const piv = (b) => J(A.meta.pivots[b]);
  // ---- re-pose: arms hang down beside the body, palms in; legs straight under the hips ----
  const BN = A.B, NB = BN.length; const Mb = BN.map(() => new M4());
  const twist = {};
  for (const S of ['L', 'R']) {
    const sx = S === 'L' ? 1 : -1;
    const s = piv('arm' + S), e = piv('fore' + S), w = piv('hand' + S);
    const Ma = rotAbout(s, qFrom(e.clone().sub(s), new V3(0.11 * sx, -1, -0.02)));
    const e1 = e.clone().applyMatrix4(Ma), w1 = w.clone().applyMatrix4(Ma);
    const Mf = rotAbout(e1, qFrom(w1.clone().sub(e1), new V3(0.05 * sx, -1, 0.07))).multiply(Ma);
    for (const b of ['arm' + S]) Mb[A.BI[b]] = Ma;
    for (const b of BN) if (b === 'fore' + S || b === 'hand' + S || (b.length === 4 && b[2] === S && /^(th|f\d)/.test(b))) Mb[A.BI[b]] = Mf;
    // twist the forearm so the palm faces the thigh and the thumb points forward
    const w2 = w.clone().applyMatrix4(Mf), ax = w2.clone().sub(e1).normalize();
    const across = piv('f1' + S + '1').applyMatrix4(Mf).sub(piv('f4' + S + '1').applyMatrix4(Mf));
    const pa = across.clone().sub(ax.clone().multiplyScalar(across.dot(ax))).normalize();
    const want = new V3(0, 0, 1); const pw = want.clone().sub(ax.clone().multiplyScalar(want.dot(ax))).normalize();
    let th = Math.acos(K3.clamp(pa.dot(pw), -1, 1)); if (new V3().crossVectors(pa, pw).dot(ax) < 0) th = -th;
    twist[S] = { o: e1, ax, th };
    // legs
    const h = piv('thigh' + S), k = piv('shin' + S), a = piv('foot' + S);
    const Mt = rotAbout(h, qFrom(k.clone().sub(h), new V3(0.01 * sx, -1, 0.02)));
    const k1 = k.clone().applyMatrix4(Mt), a1 = a.clone().applyMatrix4(Mt);
    const Ms = rotAbout(k1, qFrom(a1.clone().sub(k1), new V3(0, -1, -0.025))).multiply(Mt);
    const a2 = a.clone().applyMatrix4(Ms);
    Mb[A.BI['thigh' + S]] = Mt; Mb[A.BI['shin' + S]] = Ms; Mb[A.BI['foot' + S]] = new M4().makeTranslation(a2.x - a.x, a2.y - a.y, a2.z - a.z);
  }
  const lbs = (M, P, twistOn) => {
    const out = new Float32Array(P.length); const me = M.map((m) => m.elements);
    for (let v = 0; v < NV; v++) {
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]; let ox = 0, oy = 0, oz = 0;
      for (let k = 0; k < 4; k++) { const w = A.skinW[v * 4 + k] / 255; if (!w) continue; const e = me[A.skinI[v * 4 + k]]; ox += w * (e[0] * x + e[4] * y + e[8] * z + e[12]); oy += w * (e[1] * x + e[5] * y + e[9] * z + e[13]); oz += w * (e[2] * x + e[6] * y + e[10] * z + e[14]); }
      if (twistOn) { const tw = A.twist[v] / 255; if (tw > 0) { const T = twist[x >= 0 ? 'L' : 'R']; _v.set(ox, oy, oz).sub(T.o).applyQuaternion(_q.setFromAxisAngle(T.ax, T.th * tw)).add(T.o); ox = _v.x; oy = _v.y; oz = _v.z; } }
      out[v * 3] = ox; out[v * 3 + 1] = oy; out[v * 3 + 2] = oz;
    }
    return out;
  };
  // pivots move with their own bone (hands and fingers also take the full twist)
  const pivots = {};
  for (const b of BN) { if (!A.meta.pivots[b]) continue; const p = piv(b).applyMatrix4(Mb[A.BI[b]]); if (/^(hand[LR]|th[LR]\d|f\d[LR]\d)$/.test(b)) { const T = twist[b.includes('L') ? 'L' : 'R']; p.sub(T.o).applyQuaternion(_q.setFromAxisAngle(T.ax, T.th)).add(T.o); } pivots[b] = p; }
  let R = lbs(Mb, P, true);
  // ---- proportions for races and creatures: legs, arms, head ----
  const sc = spec.scales; const M2 = BN.map(() => new M4()); let any = false;
  const hipY = pivots.thighL.y;
  if (sc.leg !== 1) { any = true; const m = scaleAbout(new V3(0, hipY, 0), 1, sc.leg, 1); for (const b of BN) if (/^(thigh|shin|foot)/.test(b)) M2[A.BI[b]] = m; }
  if (sc.arm !== 1) for (const S of ['L', 'R']) { any = true; const m = scaleAbout(pivots['arm' + S], 1, sc.arm, 1); for (const b of BN) if (b === 'arm' + S || b === 'fore' + S || b === 'hand' + S || (b.length === 4 && b[2] === S && /^(th|f\d)/.test(b))) M2[A.BI[b]] = m; }
  if (sc.head !== 1) { any = true; M2[A.BI.head] = scaleAbout(pivots.head, sc.head, sc.head, sc.head); }
  if (sc.neck !== 1) { any = true; const m = scaleAbout(pivots.neck, sc.neck, 1, sc.neck); M2[A.BI.neck] = m; }
  if (any) { R = lbs(M2, R, false); for (const b in pivots) { const i = A.BI[b]; pivots[b].applyMatrix4(M2[i]); } if (sc.head !== 1 || sc.neck !== 1) { /* the head sits on a resized neck */ } }
  // ---- stand on the ground, centred, at the right height ----
  let minY = 1e9, maxY = -1e9; const body = A.tri.body;
  for (let i = 0; i < body.length; i++) { const y = R[body[i] * 3 + 1]; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const s = spec.height / (maxY - minY), oz = pivots.hips.z;
  for (let v = 0; v < NV; v++) { R[v * 3] *= s; R[v * 3 + 1] = (R[v * 3 + 1] - minY) * s; R[v * 3 + 2] = (R[v * 3 + 2] - oz) * s; }
  const fix = (p) => p.set(p.x * s, (p.y - minY) * s, (p.z - oz) * s);
  for (const b in pivots) fix(pivots[b]);
  // landmarks for the face painter (taken from the re-posed, scaled joints)
  const JR = (name) => { const ids = A.meta.joints[name]; const o = new V3(); for (const i of ids) o.x += R[i * 3], o.y += R[i * 3 + 1], o.z += R[i * 3 + 2]; return o.multiplyScalar(1 / ids.length); };
  const eye = (S) => { const ids = A.eyeV[S]; const c = new V3(); for (const i of ids) c.x += R[i * 3], c.y += R[i * 3 + 1], c.z += R[i * 3 + 2]; c.multiplyScalar(1 / ids.length); let r = 0; for (const i of ids) r += Math.hypot(R[i * 3] - c.x, R[i * 3 + 1] - c.y, R[i * 3 + 2] - c.z); return { c, r: r / ids.length }; };
  const lm = { eyeL: eye('L'), eyeR: eye('R'), mouth: JR('oris05____head').add(JR('oris01____head')).multiplyScalar(0.5), corner: JR('oris07.L____tail'), lipTop: JR('oris05____tail'), lipLow: JR('oris01____head'), nose: JR('levator06.L____head'), chin: JR('special04____head'), browIn: JR('oculi01.L____tail'), browOut: JR('oculi02.L____head'), top: maxY, jaw: JR('jaw____head'), headTop: (maxY - minY) * s };
  lm.nose.x = 0;
  return { P: R, pivots, lm, s, hunch: spec.hunch };
}

// smooth vertex normals over a set of triangles (by original vertex, so uv seams stay invisible)
export function normalsFor(P, tris, N = new Float32Array(P.length)) {
  const a = new V3(), b = new V3(), c = new V3(), n = new V3();
  for (let i = 0; i < tris.length; i += 3) {
    const i0 = tris[i] * 3, i1 = tris[i + 1] * 3, i2 = tris[i + 2] * 3;
    a.set(P[i0], P[i0 + 1], P[i0 + 2]); b.set(P[i1] - a.x, P[i1 + 1] - a.y, P[i1 + 2] - a.z); c.set(P[i2] - a.x, P[i2 + 1] - a.y, P[i2 + 2] - a.z); n.crossVectors(b, c);
    for (const j of [i0, i1, i2]) { N[j] += n.x; N[j + 1] += n.y; N[j + 2] += n.z; }
  }
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
  return N;
}

// rest positions of the game skeleton for this body
export function skeletonRest(sh) {
  const p = sh.pivots; const o = {};
  for (const b of A.B) if (p[b]) o[b] = [p[b].x, p[b].y, p[b].z];
  // the back of the chest, for the cape
  let back = 0; const P = sh.P; for (let v = 0; v < A.NV; v++) { const r = A.B[A.region[v]]; if (r === 'chest' || r === 'spine') back = Math.min(back, P[v * 3 + 2]); }
  const hy = o.hips[1], cy = o.chest[1];
  o.capeA = [0, cy + 0.12, back - 0.015]; o.capeB = [0, hy - 0.15, back - 0.05];
  o.tail1 = [0, hy - 0.05, back * 0.8]; o.tail2 = [0, hy - 0.25, back - 0.45]; o.tail3 = [0, hy - 0.55, back - 0.9];
  o.wingL = [0.1, cy + 0.06, back + 0.01]; o.wingR = [-0.1, cy + 0.06, back + 0.01];
  return o;
}

// ---------------------------------------------------------------- shaders
const NOISE = `
float hh1(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(hh1(i), hh1(i + vec3(1,0,0)), f.x), mix(hh1(i + vec3(0,1,0)), hh1(i + vec3(1,1,0)), f.x), f.y), mix(mix(hh1(i + vec3(0,0,1)), hh1(i + vec3(1,0,1)), f.x), mix(hh1(i + vec3(0,1,1)), hh1(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ return vn(p) * .5 + vn(p * 2.03 + 7.1) * .3 + vn(p * 4.1 + 3.7) * .2; }
`;
// skin: base tone with blotches, blush, lips, brows, stubble and a painted scalp, pores and fine wrinkles
function skinMaterial(u) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.52, metalness: 0, sheen: 0.35, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.55, 0.16, 0.1), specularIntensity: 0.45 });
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vRest;
      uniform vec3 uSkin, uLip, uBrow, uHairC, uEye, uMouth, uNose, uChin, uBrowIn, uBrowOut, uHead;
      uniform float uCorner, uStub, uScalp, uFem, uAge, uBrowW, uPaint, uGrime;
      uniform vec3 uPaintC, uTatC, uChestP, uShP; uniform float uScar, uTat;
      float seg2(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
      float gBump; float gRough; float gBumpScar = 0.;
      ${NOISE}`)
      .replace('#include <map_fragment>', `
      {
        vec3 p = vRest; vec3 q = vec3(abs(p.x), p.y, p.z);
        vec3 col = uSkin;
        // blotchy variation and a little redness where skin is thin
        float n1 = fbm3(p * 14.), n2 = vn(p * 70.);
        col *= .95 + .08 * n1 + .012 * n2;
        vec3 cheek = vec3(uEye.x + .012, uEye.y - .035, uEye.z + .005);
        float blush = exp(-dot(q - cheek, q - cheek) / .0006) * (.5 + .5 * uFem) + exp(-dot(p - uNose, p - uNose) / .00025) * .7;
        col = mix(col, col * vec3(1.08, .82, .8), clamp(blush, 0., 1.) * .45);
        // darker around the eyes and in creases
        float sock = exp(-dot(q - uEye, q - uEye) / .0007); col *= 1. - sock * (.12 + .08 * uAge);
        gRough = .5 + (n1 - .5) * .12;
        float front = smoothstep(uMouth.z - .03, uMouth.z - .012, p.z);
        // lips with a cupid's bow
        vec2 m = vec2(q.x / uCorner, (p.y - uMouth.y) / uCorner);
        float bow = .52 * (1. - m.x * m.x) + .12 * exp(-pow((m.x - .32) / .2, 2.)) - .1 * exp(-pow(m.x / .13, 2.));
        float low = .6 * pow(max(0., 1. - m.x * m.x), .7);
        float lip = front * smoothstep(1.08, .9, m.x) * (m.y > 0. ? smoothstep(bow + .06, bow - .06, m.y) : smoothstep(-low - .07, -low + .07, m.y));
        col = mix(col, uLip * (.9 + .15 * n2), lip * .85);
        col *= 1. - smoothstep(.08, 0., abs(m.y + .02)) * smoothstep(1.0, .7, m.x) * front * .45; // the line between the lips
        gRough = mix(gRough, .32, lip);
        // eyebrows: an arch of fine hairs from the inner to the outer end
        float t = (q.x - uBrowIn.x) / (uBrowOut.x - uBrowIn.x);
        float yc = mix(uBrowIn.y, uBrowOut.y, t) + .006 * sin(3.1416 * clamp(t, 0., 1.) * .95);
        float th = mix(.0068, .0026, clamp(t, 0., 1.)) * uBrowW;
        float bz = smoothstep(uEye.z - .01, uEye.z + .002, p.z);
        float brow = bz * smoothstep(-.06, .04, t) * smoothstep(1.08, .95, t) * smoothstep(th, th * .3, abs(p.y - yc));
        vec2 bs = vec2(q.x * cos(.5 - t * .4) - p.y * sin(.5 - t * .4), q.x * sin(.5 - t * .4) + p.y * cos(.5 - t * .4));
        float hairs = smoothstep(.35, .75, vn(vec3(bs.x * 1400., bs.y * 160., 1.)));
        col = mix(col, uBrow, brow * (.45 + .55 * hairs));
        gRough = mix(gRough, .65, brow);
        // stubble / beard shadow on the jaw, chin and upper lip
        float jaw = smoothstep(uNose.y - .002, uNose.y - .012, p.y) * smoothstep(uChin.y - .045, uChin.y - .015, p.y);
        float side = smoothstep(uEye.x + .05, uEye.x + .035, q.x) * smoothstep(uMouth.z - .085, uMouth.z - .05, p.z);
        float cheekLine = smoothstep(uEye.y - .045, uEye.y - .06, p.y + q.x * .15);
        float neck = smoothstep(uChin.y - .06, uChin.y - .03, p.y) * step(p.y, uChin.y) * smoothstep(uMouth.z - .1, uMouth.z - .06, p.z);
        float beard = max(jaw * side * cheekLine, neck) * (1. - lip) * uStub;
        float dots = smoothstep(.55, .85, vn(p * 1100.));
        col = mix(col, uHairC * .7, beard * (.25 + .5 * dots));
        gRough = mix(gRough, .7, beard * .6);
        // painted scalp under the hair (or shaved), from the hairline back
        vec3 hd = normalize(p - uHead);
        float faceZone = smoothstep(.15, .45, hd.z) * smoothstep(.5, .3, hd.y);
        float earZone = smoothstep(.62, .82, abs(hd.x)) * smoothstep(.25, .05, hd.y);
        float scalp = smoothstep(-.42, -.25, hd.y) * (1. - faceZone) * (1. - earZone) * uScalp;
        float strands = vn(vec3(hd.x * 260., hd.y * 40., hd.z * 260.));
        col = mix(col, uHairC * (.6 + .5 * strands), scalp * .92);
        gRough = mix(gRough, .55, scalp);
        // war paint or grime
        col = mix(col, uPaintC, uPaint * smoothstep(.55, .62, vn(vec3(q.x * 30., p.y * 8., 0.))) * smoothstep(uEye.y + .02, uEye.y - .01, p.y) * smoothstep(uNose.y - .01, uNose.y + .01, p.y) * front);
        col *= 1. - uGrime * .35 * smoothstep(.4, .8, fbm3(p * 9.));
        float faceF = smoothstep(uEye.z - .055, uEye.z - .025, p.z) * step(uChin.y - .03, p.y);
        // tattoos: ink in the skin (face patterns, or on the shoulders, arms and chest)
        if (uTat > .5) {
          float tt = 0.;
          if (uTat < 1.5) { vec2 c2 = vec2(q.x - (uEye.x + .006), p.y - (uEye.y - .042)); float r = length(c2), a = atan(c2.y, c2.x); tt = smoothstep(.0032, .0012, abs(r - .011 - .005 * sin(a * 2. + r * 140.))) * step(r, .026) * faceF; }
          else if (uTat < 2.5) { vec2 c2 = vec2(p.x, p.y - (uBrowIn.y + .034)); float r = length(c2); tt = max(smoothstep(.0022, .0009, abs(r - .011)), max(smoothstep(.0016, .0006, abs(c2.x)) * step(abs(c2.y), .017), smoothstep(.0016, .0006, abs(c2.y + abs(c2.x) * .8 - .004)) * step(r, .011))) * faceF; }
          else if (uTat < 3.5) { tt = smoothstep(.0013, .0005, abs(fract(q.x / .0075) - .5) * .0075) * step(q.x, .02) * step(p.y, uMouth.y - .012) * faceF; }
          else if (uTat < 4.5) { tt = step(0., p.x) * smoothstep(.52, .58, vn(vec3(p.x * 95., p.y * 95., 3.))) * step(uChin.y, p.y) * step(p.y, uBrowIn.y + .05) * faceF; }
          else if (uTat < 5.5) { tt = smoothstep(.012, .0095, abs(p.y - uEye.y)) * step(q.x, uBrowOut.x + .012) * faceF; }
          else if (uTat < 6.5) { float sy = p.y - uShP.y; tt = step(.1, q.x) * smoothstep(.055, .045, abs(sy + .02)) * smoothstep(.35, .55, abs(sin(q.x * 110. + p.z * 80. + sy * 60.))); }
          else if (uTat < 7.5) { float yb = uShP.y - .1; tt = step(.15, q.x) * (smoothstep(.007, .0045, abs(p.y - yb)) + smoothstep(.0035, .002, abs(p.y - yb + .016))); }
          else { vec2 c2 = vec2(p.x, p.y - (uChestP.y + .03)); float r = length(c2); tt = step(.0, p.z) * (smoothstep(.003, .0014, abs(r - .05)) + smoothstep(.003, .0014, abs(r - .036)) + smoothstep(.0024, .001, abs(abs(c2.x) - abs(c2.y))) * step(r, .05)); }
          col = mix(col, uTatC * (.8 + .2 * n1), clamp(tt, 0., 1.) * .88);
        }
        // a scar: a pale, raised line
        if (uScar > .5) {
          vec2 fp = p.xy; float sc = 1e3; vec3 E = uEye;
          if (uScar < 1.5) sc = seg2(fp, vec2(E.x + .012, E.y - .014), vec2(E.x - .028, uMouth.y + .006));
          else if (uScar < 2.5) sc = seg2(fp, vec2(-E.x + .004, uBrowIn.y + .022), vec2(-E.x - .006, E.y - .036));
          else if (uScar < 3.5) sc = seg2(fp, vec2(uBrowOut.x * .78, uBrowIn.y + .014), vec2(uBrowOut.x * .64, uBrowIn.y - .008));
          else if (uScar < 4.5) sc = seg2(fp, vec2(.006, uMouth.y + .017), vec2(.001, uMouth.y - .015));
          else if (uScar < 5.5) { for (int i = 0; i < 3; i++) { float o = float(i) * .0085; sc = min(sc, seg2(fp, vec2(-E.x - .014 + o, E.y - .012), vec2(-E.x + .004 + o, uMouth.y - .006))); } }
          else sc = seg2(fp, vec2(E.x + .032, uChin.y + .032), vec2(.012, uChin.y - .001));
          float sm = (1. - smoothstep(.0011, .0024, sc)) * faceF;
          col = mix(col, col * vec3(1.1, .9, .88) + vec3(.07, .025, .025), sm * .85); gRough = mix(gRough, .3, sm); gBumpScar = sm;
        }
        // pores and fine wrinkles for the bump
        gBump = gBumpScar * .9 + vn(p * 480.) * .6 + vn(p * 1100.) * .4 - fbm3(vec3(q.x * 30., p.y * 300., p.z * 30.)) * .5 * uAge * smoothstep(uEye.y - .01, uEye.y + .04, p.y);
        diffuseColor.rgb = col;
      }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = gRough;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float bx = dFdx(gBump), by = dFdy(gBump);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1); vec3 gr = sign(det) * (bx * r1 + by * r2);
          float fade = 1. - smoothstep(.6, 6., -vViewPosition.z); normal = normalize(abs(det) * normal - gr * .00035 * fade); }`);
  };
  m.customProgramCacheKey = () => 'krskin3';
  return m;
}
function skinUniforms(look, kind, sh, spec) {
  const lm = sh.lm; const L = look || {}; const fem = spec.fem;
  const skin = new THREE.Color(L.skin || '#e2b48e');
  const hairC = new THREE.Color(L.hair || '#3a2a1e');
  const lip = skin.clone().lerp(new THREE.Color(fem ? '#b0505a' : '#a2645e'), fem ? 0.55 : 0.35);
  const bald = (L.hairStyle === 4 && !fem) || kind === 'troll' || kind === 'ogre' || kind === 'goblin';
  const beardy = !fem && (L.beard || (D.RACES[L.race] || {}).beard);
  const head = new V3(0, lm.eyeL.c.y + 0.01, lm.eyeL.c.z - 0.085);
  return {
    uSkin: { value: skin }, uLip: { value: lip }, uBrow: { value: hairC.clone().multiplyScalar(0.75) }, uHairC: { value: hairC },
    uEye: { value: lm.eyeL.c.clone() }, uMouth: { value: lm.mouth.clone() }, uNose: { value: lm.nose.clone() }, uChin: { value: lm.chin.clone() },
    uBrowIn: { value: lm.browIn.clone() }, uBrowOut: { value: lm.browOut.clone() }, uHead: { value: head }, uCorner: { value: Math.max(0.012, Math.abs(lm.corner.x)) },
    uStub: { value: fem ? 0 : L.beardStyle != null ? [0, 0.9, 1, 1, 1, 0.6, 0.35][L.beardStyle] || 0 : beardy ? 1 : 0.25 + (spec.seed % 7) / 12 }, uScalp: { value: bald ? (fem ? 0 : 0.18) : 1 }, uFem: { value: fem ? 1 : 0 }, uAge: { value: L.old ? 1 : 0.15 },
    uScar: { value: L.scar || 0 }, uTat: { value: L.tattoo || 0 }, uTatC: { value: new THREE.Color(L.tatCol || '#1e2a5a') }, uChestP: { value: new V3(...(sh.pivots.chest ? [sh.pivots.chest.x, sh.pivots.chest.y, sh.pivots.chest.z] : [0, 1.3, 0])) }, uShP: { value: new V3(...(sh.pivots.shL ? [sh.pivots.shL.x, sh.pivots.shL.y, sh.pivots.shL.z] : [0.18, 1.45, 0])) },
    uBrowW: { value: fem ? 0.75 : kind === 'orc' ? 1.4 : 1 }, uPaint: { value: L.warpaint ? 1 : 0 }, uPaintC: { value: new THREE.Color(L.warpaint || '#2a3a8a') }, uGrime: { value: kind === 'zombie' ? 1 : kind === 'goblin' || kind === 'troll' ? 0.5 : 0 },
  };
}

// clothes and armour: one material, the kind (cloth, leather, metal, mail, fur) comes per vertex in aMat.z
let garmentMat = null;
export function garmentMaterial() {
  if (garmentMat) return garmentMat;
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(1, 1, 1), side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aMat; varying vec3 vMat; varying vec3 vRest;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat; vRest = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vMat; varying vec3 vRest; float gB; float gR; float gM; float gCloth;
      ${NOISE}`)
      .replace('#include <map_fragment>', `
      {
        vec3 p = vRest; float pid = floor(vMat.z + .5); float wear = floor(pid / 20. + .01); float pat = pid - wear * 20.; gB = 0.; gR = vMat.y; gM = vMat.x; gCloth = 0.;
        float uA = atan(p.x, p.z) * .16; // distance round the body (about a torso's radius), for plates and studs
        float px = length(fwidth(p)); float aa = 1. - smoothstep(.00025, .0009, px);
        vec3 col = diffuseColor.rgb;
        float big = fbm3(p * 6.), mid = vn(p * 40.);
        if (pat == 1.) { // woven cloth with soft folds that run down the limbs
          float folds = vn(vec3(p.x * 18., p.y * 4., p.z * 18.)) * .7 + vn(vec3(p.x * 45., p.y * 9., p.z * 45.)) * .3;
          float weave = (sin(p.x * 1400. + p.z * 1400.) * sin(p.y * 1400.)) * .5 + .5;
          col *= .86 + .2 * folds + .05 * (big - .5); col *= mix(1., .95 + .07 * weave, aa);
          gB = folds * 1.6 + weave * .15 * aa; gCloth = 1.; gR = .9;
        } else if (pat == 2.) { // leather: grain, wear on the high spots, darker in the creases
          float grain = vn(p * 420.) * .6 + vn(p * 1100.) * .4;
          col *= .8 + .3 * big; col = mix(col, col * 1.35 + .03, smoothstep(.62, .85, mid) * .35); col *= .92 + .1 * grain;
          gB = grain * .5 + big * .8; gR = .55 + .2 * (1. - mid);
        } else if (pat == 3.) { // metal: brushed, scratched, a little tarnish
          float brush = vn(vec3(p.x * 60., p.y * 500., p.z * 60.)) * .5 + .5 * vn(p * 25.); float scratch = smoothstep(.93, .99, vn(vec3(p.x * 90., p.y * 1500., p.z * 90.) + big * 4.));
          col *= .9 + .12 * brush; col = mix(col, col * .55 + vec3(.04, .035, .02), smoothstep(.55, .8, big) * .35);
          gR = clamp(vMat.y + .1 + .1 * (brush - .5) + .25 * smoothstep(.55, .8, big) - scratch * .12, .2, .9); gB = brush * .05 + scratch * .2;
        } else if (pat == 7.) { // mail: rows of rings
          vec2 q = vec2((p.x + p.z) * 150., p.y * 170.); q.x += floor(q.y) * .5; vec2 f = fract(q) - .5; float ring = smoothstep(.13, 0., abs(length(f) - .32));
          float aaR = 1. - smoothstep(.0006, .0022, px); // rings stay visible a few metres out
          float rows = .5 + .5 * sin(p.y * 170. * 6.283) * (1. - smoothstep(.0012, .003, px)); // further away the rows fade to an even sheen (no stripes)
          col *= mix(.72 + .12 * rows, .4 + .85 * ring, aaR); col *= .85 + .3 * big;
          gB = mix(rows * .2, ring * 1.2, aaR); gR = mix(.5 - .12 * rows, mix(.62, .32, ring), aaR); gM = mix(.7, mix(.25, .9, ring), aaR);
        } else if (pat == 4.) { // fur
          float fh = vn(vec3(p.x * 300., p.y * 60., p.z * 300.)); col *= .75 + .4 * fh; gB = fh; gR = 1.; gCloth = .6;
        } else if (pat == 8.) { gR = .45; col *= .9 + .15 * mid; }
        else if (pat == 9.) { // lamellar: staggered rows of riveted plates, dark seams, bright worn edges
          float rowH = .082, plW = .125; float row = floor(p.y / rowH), fy = fract(p.y / rowH);
          float uu = uA / plW + mod(row, 2.) * .5; float ci = floor(uu), fx = fract(uu);
          float edge = min(min(fx, 1. - fx) * plW, min(fy, 1. - fy) * rowH);
          float seam = 1. - smoothstep(.0012, .0035, edge); float bevel = smoothstep(.0, .007, edge);
          col *= .88 + .18 * vn(vec3(row * 3.1, ci * 4.7, .5)); col *= .72 + .32 * smoothstep(.0, .45, fy); col = mix(col * 1.22 + .04, col, bevel); col *= 1. - seam * .45;
          vec2 rv = vec2((fx - .5) * plW, (fy - .8) * rowH); float riv = smoothstep(.0042, .0024, length(rv)); col = mix(col, col * 1.35 + .06, riv);
          float scratch = smoothstep(.93, .99, vn(vec3(p.x * 90., p.y * 1500., p.z * 90.) + big * 4.)); col = mix(col, col * 1.4, scratch * .5);
          gB = bevel * .7 + riv * .9 - seam * .5; gR = clamp(vMat.y + .18 * (1. - bevel) + .2 * seam + .1 * (big - .5), .18, .95); gM = vMat.x * (1. - seam * .7);
        } else if (pat == 10.) { // banded lames: each band overlaps the one below, rivets along the top
          float bh = .032; float fy = fract(p.y / bh); float lap = smoothstep(.0, .3, fy); float lip = smoothstep(.86, 1., fy);
          col *= .62 + .42 * lap; col = mix(col, col * 1.3 + .04, lip * .6);
          vec2 q = vec2((fract(uA / .11) - .5) * .11, (fy - .78) * bh); float riv = smoothstep(.0034, .0018, length(q)) * step(.5, fract(floor(p.y / bh) * .5)); col = mix(col, col * 1.4 + .06, riv);
          float scratch = smoothstep(.93, .99, vn(vec3(p.x * 90., p.y * 1500., p.z * 90.) + big * 4.)); col = mix(col, col * 1.35, scratch * .4);
          gB = lap * .9 + riv * .8; gR = clamp(vMat.y + .22 * (1. - lap) + .1 * (big - .5), .18, .95); gM = vMat.x * (.55 + .45 * lap);
        } else if (pat == 11.) { // studded leather: grain, stitched panels and rows of round studs
          float grain = vn(p * 420.) * .6 + vn(p * 1100.) * .4;
          col *= .78 + .3 * big; col *= .92 + .1 * grain;
          float sy = fract(p.y / .09); float groove = 1. - smoothstep(.0, .035, abs(sy - .5)); col *= 1. - groove * .45;
          float st = step(.55, fract(uA / .007)) * (1. - smoothstep(.0, .008, abs(abs(sy - .5) - .06))); col = mix(col, col * 1.5 + .06, st * .45);
          vec2 g = vec2(fract(uA / .05) - .5, fract(p.y / .09 + .25) - .5); float stud = smoothstep(.13, .08, length(g * vec2(1., .5)));
          col = mix(col, vec3(.62, .58, .5) * (.8 + .4 * mid), stud); gM = stud * .85; gR = mix(.6 + .2 * (1. - mid), .35, stud); gB = grain * .4 + big * .6 - groove * .8 + stud * 1.2;
        } else if (pat == 12.) { // quilted padding: puffed diamonds sewn down along the seams
          vec2 q = vec2(uA + p.y, uA - p.y) / .045; vec2 f = abs(fract(q) - .5); float ln = 1. - smoothstep(.0, .07, min(f.x, f.y));
          col *= (.86 + .2 * vn(p * 30.)) * (1. - ln * .38); gB = (1. - ln) * 1.2; gR = .95; gCloth = 1.;
        }
        // wear by tier on metal: rust and grime on crude gear, scuffs on used gear, engraving on the finest
        if (pat == 3. || pat == 7. || pat == 9. || pat == 10.) {
          float rn = fbm3(p * 9. + 3.1); float rust = wear == 2. ? smoothstep(.5, .78, rn) * .55 : wear == 1. ? smoothstep(.66, .86, rn) * .25 : 0.;
          vec3 rc = vec3(.5, .27, .13) * (.75 + .45 * vn(p * 90.)); col = mix(col, rc, rust); gR = mix(gR, .92, rust); gM = mix(gM, .12, rust);
          if (wear == 2.) col *= .82 + .18 * fbm3(p * 4.);
          if (wear == 3.) { float e = vn(vec3(p.x * 40., p.y * 40., p.z * 40.)); float eng = 1. - smoothstep(.0, .02, abs(e - .5)); col = mix(col, vec3(.86, .66, .3), eng * .12); gR = max(.16, gR - .08); }
        }
        diffuseColor.rgb = col;
      }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = gR;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = gM;')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n material.sheenColor = diffuseColor.rgb * gCloth * .8; material.sheenRoughness = .55;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float bx = dFdx(gB), by = dFdy(gB);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1); vec3 gr = sign(det) * (bx * r1 + by * r2);
          normal = normalize(abs(det) * normal - gr * .0025); }`);
  };
  m.customProgramCacheKey = () => 'krgarment';
  garmentMat = m; return m;
}
// eyes: a wet sclera, a fibrous iris with a dark limbal ring and a pupil, under a clear cornea
const eyeGeoCache = new Map();
function eyeMaterial(iris, glow) {
  // a soft wet shine only: a mirror-sharp cornea caught the sun or your lantern head-on and the bloom turned it into a beam
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3, specularIntensity: 0.25, emissive: glow ? new THREE.Color(iris) : new THREE.Color(0), emissiveIntensity: glow ? 1.4 : 0 });
  const u = { uIris: { value: new THREE.Color(iris) }, uGlow: { value: glow ? 1 : 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aEye; varying vec3 vEye;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvEye = aEye;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vEye; uniform vec3 uIris; uniform float uGlow;\n' + NOISE)
      .replace('#include <map_fragment>', `{
        vec3 e = normalize(vEye); float a = acos(clamp(e.z, -1., 1.)); float ang = atan(e.y, e.x);
        vec3 scl = vec3(.93, .9, .86) * (.92 + .08 * vn(e * 20.)); scl = mix(scl, vec3(.85, .55, .5), smoothstep(.9, 1.5, a) * .5 * vn(vec3(ang * 6., a * 10., 0.)));
        float irisR = .5, pup = .17;
        float fib = vn(vec3(ang * 40., a * 6., 0.)) * .6 + vn(vec3(ang * 90., a * 20., 3.)) * .4;
        vec3 ir = uIris * (.55 + .75 * fib) * mix(1.25, .7, smoothstep(pup, irisR, a));
        ir = mix(ir, ir * 1.6 + .05, smoothstep(pup + .05, pup, a - .02) * .6); // a lighter ring around the pupil
        ir *= 1. - smoothstep(irisR - .08, irisR, a) * .7; // limbal ring
        vec3 c = mix(ir, scl, smoothstep(irisR - .01, irisR + .02, a));
        c = mix(vec3(.01), c, smoothstep(pup - .015, pup + .01, a));
        diffuseColor.rgb = c;
        if (uGlow > .5) totalEmissiveRadiance *= smoothstep(irisR + .05, irisR - .05, a);
      }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n if (uGlow > .5) totalEmissiveRadiance *= smoothstep(.6, .4, acos(clamp(normalize(vEye).z, -1., 1.)));');
  };
  m.customProgramCacheKey = () => 'kreye';
  return m;
}
function eyeGeometry(sh, headBone) {
  const parts = [];
  for (const S of ['L', 'R']) {
    const e = sh.lm['eye' + S]; const g = new THREE.SphereGeometry(e.r * 0.97, 24, 16); g.rotateX(Math.PI / 2); // poles front and back
    const p = g.attributes.position; const aEye = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); aEye[i * 3] = x; aEye[i * 3 + 1] = y; aEye[i * 3 + 2] = z; const nz = z / (e.r * 0.97); if (nz > 0.86) p.setZ(i, z + (nz - 0.86) * e.r * 0.45); } // the cornea bulges
    g.setAttribute('aEye', new THREE.BufferAttribute(aEye, 3)); g.translate(e.c.x, e.c.y, e.c.z); g.computeVertexNormals(); parts.push(g);
  }
  const g = mergeSimple(parts); const n = g.attributes.position.count;
  g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint8Array(n * 4).map((_, i) => (i % 4 ? 0 : headBone)), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(new Uint8Array(n * 4).map((_, i) => (i % 4 ? 0 : 255)), 4, true));
  return g;
}
function mergeSimple(gs) {
  const out = new THREE.BufferGeometry(); const names = Object.keys(gs[0].attributes); let n = 0; const idx = [];
  for (const g of gs) { const c = g.attributes.position.count; const gi = g.index ? g.index.array : [...Array(c).keys()]; for (const i of gi) idx.push(i + n); n += c; }
  for (const k of names) { const s = gs[0].attributes[k]; const arr = new s.array.constructor(n * s.itemSize); let o = 0; for (const g of gs) { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; } out.setAttribute(k, new THREE.BufferAttribute(arr, s.itemSize, s.normalized)); }
  out.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); return out;
}

// strands: hair, beards, brows and lashes are cards of fine hairs
let strandTex = null;
function strandTexture() {
  if (strandTex) return strandTex;
  const W = 256, Hh = 512; const c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d');
  g.clearRect(0, 0, W, Hh); const r = rngOf(7);
  for (let i = 0; i < 420; i++) {
    const x = 6 + r() * (W - 12), w = 0.7 + r() * 1.5, len = Hh * (0.6 + r() * 0.4), a = 0.45 + r() * 0.55, l = 0.82 + r() * 0.18, bend = (r() - 0.5) * 10;
    const gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, `rgba(${255 * l | 0},${255 * l | 0},${255 * l | 0},${a})`); gr.addColorStop(0.85, `rgba(${255 * l | 0},${255 * l | 0},${255 * l | 0},${a * 0.8})`); gr.addColorStop(1, `rgba(${255 * l | 0},${255 * l | 0},${255 * l | 0},0)`);
    g.strokeStyle = gr; g.lineWidth = w; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + bend, len * 0.5, x + bend * 0.4, len); g.stroke();
  }
  strandTex = new THREE.CanvasTexture(c); strandTex.colorSpace = THREE.SRGBColorSpace; strandTex.wrapS = THREE.RepeatWrapping; strandTex.anisotropy = 4; strandTex.generateMipmaps = true;
  return strandTex;
}
function hairMaterial(color, kind = 'hair') {
  const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color), map: strandTexture(), alphaTest: 0.38, side: THREE.DoubleSide, roughness: 0.5, metalness: 0, anisotropy: 0.5, specularIntensity: 0.28 });
  m.alphaToCoverage = !!(K3.quality && K3.quality.msaa);
  // both sides of a card share the outward normal, so hair is lit as one mass
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '').replace('tbn[0] *= faceDirection;', '').replace('tbn[1] *= faceDirection;', '')); };
  m.customProgramCacheKey = () => 'krhair';
  return m;
}

// ---------------------------------------------------------------- hair, beards, brows and lashes
function headFrame(sh) {
  const P = sh.P, lm = sh.lm; const c = new V3(0, lm.eyeL.c.y + 0.012, lm.eyeL.c.z - 0.08);
  const scalp = [], isScalp = new Uint8Array(A.NV); let rx = 0.05, ry = 0.05, rz = 0.05, rzb = 0.05;
  for (let v = 0; v < A.NV; v++) {
    if (A.B[A.region[v]] !== 'head') continue; const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    const d = new V3(x - c.x, y - c.y, z - c.z); const l = d.length(); if (l < 1e-4) continue; d.multiplyScalar(1 / l);
    const face = smooth(0.15, 0.45, d.z) * smooth(0.5, 0.3, d.y), ear = smooth(0.62, 0.82, Math.abs(d.x)) * smooth(0.25, 0.05, d.y);
    const s = smooth(-0.42, -0.25, d.y) * (1 - face) * (1 - ear);
    if (s > 0.5) { isScalp[v] = 1; scalp.push(v); rx = Math.max(rx, Math.abs(x)); ry = Math.max(ry, y - c.y); if (z > c.z) rz = Math.max(rz, z - c.z); else rzb = Math.max(rzb, c.z - z); }
  }
  return { c, isScalp, scalp, rad: new V3(rx + 0.004, ry + 0.004, Math.max(rz, rzb) + 0.004) };
}
// sample points on the triangles whose vertices all pass a test, spread by area
function sampleSurface(P, N, tris, test, n, rnd) {
  const list = [], area = []; let tot = 0; const a = new V3(), b = new V3(), c = new V3();
  for (let i = 0; i < tris.length; i += 3) { const i0 = tris[i], i1 = tris[i + 1], i2 = tris[i + 2]; if (!test(i0) || !test(i1) || !test(i2)) continue; a.set(P[i0 * 3], P[i0 * 3 + 1], P[i0 * 3 + 2]); b.set(P[i1 * 3], P[i1 * 3 + 1], P[i1 * 3 + 2]).sub(a); c.set(P[i2 * 3], P[i2 * 3 + 1], P[i2 * 3 + 2]).sub(a); const ar = b.cross(c).length() / 2; tot += ar; list.push(i); area.push(tot); }
  const out = []; if (!list.length) return out;
  for (let k = 0; k < n; k++) {
    const r = rnd() * tot; let lo = 0, hi = area.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (area[mid] < r) lo = mid + 1; else hi = mid; }
    const i = list[lo]; let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; } const w = 1 - u - v; const ids = [tris[i], tris[i + 1], tris[i + 2]];
    const p = new V3(), nn = new V3(); ids.forEach((id, j) => { const f = j === 0 ? w : j === 1 ? u : v; p.x += P[id * 3] * f; p.y += P[id * 3 + 1] * f; p.z += P[id * 3 + 2] * f; nn.x += N[id * 3] * f; nn.y += N[id * 3 + 1] * f; nn.z += N[id * 3 + 2] * f; });
    out.push({ p, n: nn.normalize() });
  }
  return out;
}
const HAIR_STYLE = {
  short: { n: 1700, len: [0.05, 0.09], seg: 4, grav: 0.35, lift: 0.3, w: 0.016 },
  crop: { n: 1400, len: [0.03, 0.05], seg: 3, grav: 0.2, lift: 0.3, w: 0.014 },
  shoulder: { n: 1900, len: [0.2, 0.28], seg: 9, grav: 1, lift: 0.3, w: 0.02 },
  long: { n: 2000, len: [0.32, 0.44], seg: 11, grav: 1, lift: 0.3, w: 0.021 },
  vlong: { n: 2100, len: [0.45, 0.58], seg: 12, grav: 1, lift: 0.3, w: 0.021 },
  mohawk: { n: 600, len: [0.07, 0.12], seg: 4, grav: 0, lift: 1, w: 0.012, strip: 0.025 },
  buzz: { n: 2600, len: [0.012, 0.024], seg: 2, grav: 0.2, lift: 0.1, w: 0.008 },
  curly: { n: 2200, len: [0.06, 0.1], seg: 7, grav: 0.4, lift: 0.6, w: 0.016, curl: 1 },
  pony: { n: 1700, len: [0.18, 0.26], seg: 9, grav: 0.2, lift: 0.2, w: 0.018, gather: 'pony' },
  bun: { n: 1700, len: [0.16, 0.22], seg: 9, grav: 0.1, lift: 0.2, w: 0.018, gather: 'bun' },
};
function styleFor(look, kind, fem) {
  const hs = look.hairStyle || 0;
  if (kind === 'goblin' || kind === 'ogre' || kind === 'troll' && hs !== 2) return null;
  if (hs === 4) return fem ? 'crop' : null;
  if (hs === 2) return 'mohawk';
  if (hs === 5) return 'buzz';
  if (hs === 6) return 'curly';
  if (hs === 7) return 'pony';
  if (hs === 8) return 'bun';
  if (hs === 3) return fem ? 'vlong' : 'long';
  if (hs === 1) return fem ? 'long' : 'shoulder';
  return fem ? 'shoulder' : 'short';
}
// builds card strips along paths; each path point carries a position, a card side vector and a bone blend
function cardsGeometry(cards, headBone, chestBone) {
  let nv = 0; for (const c of cards) nv += c.pts.length * 2;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), si = new Uint8Array(nv * 4), sw = new Uint8Array(nv * 4); const idx = [];
  let o = 0;
  for (const c of cards) {
    const L = c.pts.length;
    for (let k = 0; k < L; k++) {
      const p = c.pts[k], s = c.side[k], w = c.width[k], t = k / (L - 1);
      for (let e = 0; e < 2; e++) {
        const sg = e ? 0.5 : -0.5; const i = o + k * 2 + e;
        pos[i * 3] = p.x + s.x * w * sg; pos[i * 3 + 1] = p.y + s.y * w * sg; pos[i * 3 + 2] = p.z + s.z * w * sg;
        nor[i * 3] = c.nrm[k].x; nor[i * 3 + 1] = c.nrm[k].y; nor[i * 3 + 2] = c.nrm[k].z;
        uv[i * 2] = c.u0 + c.uw * e; uv[i * 2 + 1] = 1 - t * c.vlen;
        col[i * 3] = c.col.r * (c.shade ? 0.7 + 0.3 * t : 1); col[i * 3 + 1] = c.col.g * (c.shade ? 0.7 + 0.3 * t : 1); col[i * 3 + 2] = c.col.b * (c.shade ? 0.7 + 0.3 * t : 1);
        const cb = c.chest ? c.chest[k] : 0; si[i * 4] = headBone; si[i * 4 + 1] = chestBone; sw[i * 4] = Math.round((1 - cb) * 255); sw[i * 4 + 1] = 255 - sw[i * 4];
      }
      if (k < L - 1) { const a = o + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    o += L * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4, true));
  g.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); return g;
}
function strandCards(look, kind, sh, spec, N, rest) {
  const rnd = rngOf(spec.seed ^ 0x9e37); const cards = []; const P = sh.P, lm = sh.lm;
  const hairCol = new THREE.Color(look.hair || '#3a2a1e'); const fr = headFrame(sh); const { c, rad } = fr;
  const neckY = rest.neck[1], shY = rest.shL[1], backZ = rest.capeA[2] + 0.02;
  const inHead = (p) => { const x = (p.x - c.x) / rad.x, y = (p.y - c.y) / rad.y, z = (p.z - c.z) / rad.z; return Math.hypot(x, y, z); };
  const covered = look.helm || look.hood || (look.hat && !['circlet', 'headband', 'leafcrown', 'bandana', 'bonemask', 'crown'].includes(look.hat));
  const closedHelm = !!(look.helm && HELM_CLOSED[look.helmStyle || (look.helm === 'chain' ? 'coif' : '')]);
  const style = closedHelm ? null : styleFor(look, kind, spec.fem);
  const push = (pts, side, width, nrm, chest, col, uw = 0.18, vlen = 1, shade = true) => cards.push({ pts, side, width, nrm, chest, col, u0: rnd() * (1 - uw), uw, vlen, shade });
  // ---- scalp hair: cards that lie along the head, layered, then fall below the ears ----
  if (style && !(covered && style !== 'long' && style !== 'vlong' && style !== 'shoulder')) {
    const S = HAIR_STYLE[style]; const crown = new V3(c.x, c.y + rad.y * 0.95, c.z - rad.z * 0.35);
    const fallY = c.y - rad.y * 0.35; const faceZ = c.z + rad.z * 0.45, browY = lm.browIn.y + 0.012;
    const roots = sampleSurface(P, N, A.tri.body, (v) => fr.isScalp[v] && (!S.strip || Math.abs(P[v * 3]) < S.strip * 1.8), Math.round(S.n * (K3.quality && K3.quality.grass >= 1.5 ? 1 : 0.7)), rnd);
    const part = ((spec.seed >> 3) % 3) - 1; const partX = part * 0.025; const short = style === 'short' || style === 'crop' || style === 'buzz' || style === 'curly';
    // ponytails and buns: everything is combed to one point at the back of the head
    const G = S.gather === 'pony' ? new V3(c.x, c.y + rad.y * 0.12, c.z - rad.z * 1.02) : S.gather === 'bun' ? new V3(c.x, c.y + rad.y * 0.72, c.z - rad.z * 0.78) : null;
    for (const r of roots) {
      if (S.strip && Math.abs(r.p.x) > S.strip) continue;
      if (covered && r.p.y > c.y - 0.01) continue; // under a hat only the hair below the brim shows
      const hd = r.p.clone().sub(c).normalize(); const layer = rnd();
      // which way it is combed: away from the crown, swept back at the front for short styles, from the part for longer ones
      let flow = r.p.clone().sub(crown); if (short && hd.z > 0.1) flow = new V3((r.p.x - partX) * 0.6, 0.2, -1);
      if (!short && hd.z > 0.15) flow = new V3(Math.sign(r.p.x - partX || 1), -0.4, 0.15);
      flow.sub(r.n.clone().multiplyScalar(flow.dot(r.n))).normalize();
      const len = S.len[0] + rnd() * (S.len[1] - S.len[0]);
      let dir = S.strip ? r.n.clone().lerp(new V3(0, 0.3, -1), 0.3).normalize() : r.n.clone().multiplyScalar(0.25).add(flow).normalize();
      if (G) { const tg = G.clone().sub(r.p); tg.sub(r.n.clone().multiplyScalar(tg.dot(r.n))); dir = tg.normalize().lerp(r.n, 0.12).normalize(); }
      const curlPh = rnd() * 6.28;
      const pts = [], side = [], width = [], nrm = [], chest = []; const p = r.p.clone().add(r.n.clone().multiplyScalar(0.001)); const seg = len / S.seg;
      const shell = 1.035 + layer * (short ? 0.05 : 0.09);
      let cut = false;
      for (let k = 0; k <= S.seg; k++) {
        pts.push(p.clone());
        const out = p.clone().sub(c).normalize(); let sd = new V3().crossVectors(dir, out).normalize(); if (!isFinite(sd.x) || sd.lengthSq() < 0.5) sd = new V3(1, 0, 0);
        side.push(sd); width.push(S.w * (1 - 0.6 * (k / S.seg)) * (0.85 + rnd() * 0.3)); nrm.push(out.clone().lerp(new V3(0, 1, 0), 0.2).normalize());
        chest.push(smooth(neckY + 0.02, neckY - 0.12, p.y));
        if (k === S.seg || cut) break;
        p.addScaledVector(dir, seg);
        if (G) { if (p.distanceTo(G) < 0.03) cut = true; dir.lerp(G.clone().sub(p).normalize(), 0.45).normalize(); }
        if (S.curl) { const o3 = p.clone().sub(c).normalize(); dir.applyAxisAngle(o3, Math.sin(k * 1.9 + curlPh) * 0.9); }
        const e = inHead(p); const onHead = p.y > fallY || (p.z > c.z && p.y > lm.chin.y);
        if (S.strip) { dir.lerp(new V3(0, 0.2, -1).normalize(), 0.25).normalize(); continue; }
        if (onHead || e < shell) {
          // hug the head at this strand's layer, sliding round it and down
          const q = p.clone().sub(c); p.copy(c).add(q.multiplyScalar(shell / Math.max(e, 0.01)));
          const o2 = p.clone().sub(c).normalize(); dir.addScaledVector(new V3(0, -1, 0), S.grav * 0.22); dir.sub(o2.clone().multiplyScalar(dir.dot(o2))).normalize();
        } else { dir.y -= S.grav * 0.5; dir.normalize(); }
        // keep the face clear and fall behind the shoulders
        if (p.z > faceZ && p.y < browY && Math.abs(p.x) < Math.abs(lm.eyeL.c.x) + 0.035) { p.x = Math.sign(p.x || 1) * (Math.abs(lm.eyeL.c.x) + 0.035); dir.x += Math.sign(p.x) * 0.5; dir.normalize(); }
        if (p.y < neckY + 0.03 && p.z > backZ - 0.012 - Math.max(0, shY - p.y) * 0.1 && Math.abs(p.x) < 0.15) p.z = Math.min(p.z, backZ - 0.012 - Math.max(0, shY - p.y) * 0.1);
        if (p.y < shY + 0.03 && Math.abs(p.x) > 0.09) { p.x *= 0.96; if (p.z > backZ + 0.02) p.z = backZ + 0.02; }
      }
      push(pts, side, width, nrm, chest, hairCol.clone().multiplyScalar(0.8 + rnd() * 0.35), 0.2, Math.min(1, len / 0.2 + 0.35));
    }
    if (G && S.gather === 'pony') {
      // the tail: a thick bundle from the tie down the back
      for (let i = 0; i < 260; i++) {
        const p = G.clone().add(new V3((rnd() - 0.5) * 0.024, (rnd() - 0.5) * 0.02, -rnd() * 0.01)); let dir = new V3((rnd() - 0.5) * 0.3, 0.15, -1).normalize();
        const L = (spec.fem ? 0.3 : 0.24) + rnd() * 0.12, n = 10, sg = L / n; const pts = [], side = [], width = [], nrm = [], chest = [];
        for (let k = 0; k <= n; k++) { pts.push(p.clone()); side.push(new V3(1, 0, 0)); width.push(0.016 * (1 - 0.7 * k / n)); nrm.push(new V3(0, 0.3, -1).normalize()); chest.push(smooth(neckY + 0.04, neckY - 0.1, p.y)); p.addScaledVector(dir, sg); dir.y -= 0.32; dir.z *= 0.92; dir.normalize(); if (p.z > backZ - 0.01 && p.y < neckY + 0.05) p.z = backZ - 0.01; }
        push(pts, side, width, nrm, chest, hairCol.clone().multiplyScalar(0.8 + rnd() * 0.3), 0.2, 1);
      }
      // the tie
      for (let i = 0; i < 18; i++) { const a = (i / 18) * 6.283; const p0 = G.clone().add(new V3(Math.cos(a) * 0.014, Math.sin(a) * 0.014, -0.012)); const t2 = new V3(-Math.sin(a), Math.cos(a), 0); push([p0, p0.clone().addScaledVector(t2, 0.006)], [new V3(0, 0, 1), new V3(0, 0, 1)], [0.008, 0.008], [new V3(0, 0, -1), new V3(0, 0, -1)], null, new THREE.Color('#3a2418'), 0.05, 0.2, false); }
    }
    if (G && S.gather === 'bun') {
      // coils of hair round a knot at the crown
      const B = G.clone().add(G.clone().sub(c).normalize().multiplyScalar(0.035));
      for (let i = 0; i < 300; i++) {
        const ax = new V3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(); let u = new V3(1, 0, 0).cross(ax); if (u.lengthSq() < 0.01) u = new V3(0, 1, 0).cross(ax); u.normalize(); const w2 = ax.clone().cross(u);
        const R2 = 0.034 + rnd() * 0.014, a0 = rnd() * 6.283, n = 10; const pts = [], side = [], width = [], nrm = [];
        for (let k = 0; k <= n; k++) { const a = a0 + (k / n) * 3.6; const rv = u.clone().multiplyScalar(Math.cos(a)).add(w2.clone().multiplyScalar(Math.sin(a))); pts.push(B.clone().addScaledVector(rv, R2)); side.push(ax.clone()); width.push(0.014); nrm.push(rv); }
        push(pts, side, width, nrm, null, hairCol.clone().multiplyScalar(0.8 + rnd() * 0.3), 0.2, 0.8);
      }
    }
  }
  // ---- beard and moustache ----
  const raceD = D.RACES[look.race] || {};
  const beardCol = new THREE.Color(look.beard || look.hair || '#3a2a1e');
  const bst = look.beardStyle; // 0 none, 1 stubble, 2 short, 3 full, 4 long, 5 goatee, 6 moustache
  if (!spec.fem && !(look.helm && HELM_NOBEARD[look.helmStyle]) && (bst != null ? bst >= 2 : (look.beard || raceD.beard))) {
    const long = bst != null ? bst === 4 : look.race === 'dwarf' || kind === 'giant'; const ex = lm.eyeL.c;
    const test = (v) => { const x = Math.abs(P[v * 3]), y = P[v * 3 + 1], z = P[v * 3 + 2]; if (A.B[A.region[v]] !== 'head' && A.B[A.region[v]] !== 'neck') return false; return y < lm.nose.y - 0.006 && y > lm.chin.y - 0.03 && x < ex.x + 0.045 && z > lm.mouth.z - 0.07 && y < ex.y - 0.04 - x * 0.2 && !(Math.abs(y - lm.mouth.y) < 0.008 && x < Math.abs(lm.corner.x) * 1.1); };
    const test2 = bst === 5 ? (v) => test(v) && Math.abs(P[v * 3]) < 0.03 && P[v * 3 + 1] < lm.mouth.y + 0.014 : bst === 6 ? (v) => test(v) && P[v * 3 + 1] > lm.mouth.y + 0.002 && P[v * 3 + 1] < lm.nose.y - 0.004 : test;
    const roots = sampleSurface(P, N, A.tri.body, test2, long ? 900 : bst === 6 ? 260 : bst === 5 ? 380 : 650, rnd);
    for (const r of roots) {
      const lip = r.p.y > lm.mouth.y; const len = lip ? 0.012 + rnd() * 0.008 : long ? 0.08 + rnd() * 0.12 * smooth(lm.mouth.y, lm.chin.y - 0.01, r.p.y) + 0.03 : bst === 2 ? 0.007 + rnd() * 0.008 : bst === 5 ? 0.02 + rnd() * 0.03 : 0.015 + rnd() * 0.02;
      let dir = r.n.clone().multiplyScalar(0.45).add(new V3(Math.sign(r.p.x) * (lip ? 0.6 : 0.1), -1, lip ? 0 : 0.25)).normalize();
      const segs = long && !lip ? 6 : 2; const pts = [], side = [], width = [], nrm = []; const p = r.p.clone().add(r.n.clone().multiplyScalar(0.001));
      for (let k = 0; k <= segs; k++) { pts.push(p.clone()); const sd = new V3().crossVectors(dir, r.n).normalize(); side.push(sd); width.push((long ? 0.012 : 0.008) * (1 - 0.5 * k / segs)); nrm.push(r.n.clone()); if (k < segs) { dir.y -= long ? 0.25 : 0.05; dir.normalize(); p.addScaledVector(dir, len / segs); } }
      push(pts, side, width, nrm, null, beardCol.clone().multiplyScalar(0.8 + rnd() * 0.35), 0.15, 0.5);
    }
  }
  // ---- eyebrows: short hairs lying on the brow ridge ----
  if (kind !== 'skeleton') {
    const browCol = hairCol.clone().multiplyScalar(0.62); const surf = (x, y) => { // the nearest face vertex to (x, y) on the front of the head
      let best = -1, bd = 1e9; for (const v of fr.scalpFace || (fr.scalpFace = (() => { const o = []; for (let i = 0; i < A.NV; i++) if (A.B[A.region[i]] === 'head' && P[i * 3 + 2] > lm.eyeL.c.z - 0.02) o.push(i); return o; })())) { const d = (P[v * 3] - x) ** 2 + (P[v * 3 + 1] - y) ** 2; if (d < bd) { bd = d; best = v; } }
      return { p: new V3(P[best * 3], P[best * 3 + 1], P[best * 3 + 2]), n: new V3(N[best * 3], N[best * 3 + 1], N[best * 3 + 2]) }; };
    const bi = lm.browIn, bo = lm.browOut; const nB = spec.fem ? 34 : 44;
    for (const sx of [1, -1]) for (let i = 0; i < nB; i++) {
      const t = rnd(); const x = (bi.x + (bo.x - bi.x) * t) * sx, y = bi.y + (bo.y - bi.y) * t + 0.006 * Math.sin(Math.PI * t * 0.95) + (rnd() - 0.5) * 0.008 * (1 - t * 0.6) * (spec.fem ? 0.6 : 1);
      const s = surf(x, y); const along = new V3(sx * (0.9 - 0.5 * (1 - t)), 0.55 * (1 - t) + 0.1, 0); along.sub(s.n.clone().multiplyScalar(along.dot(s.n))).normalize();
      const p0 = s.p.clone().add(s.n.clone().multiplyScalar(0.0012)); const L = 0.007 + rnd() * 0.004;
      const pts = [p0, p0.clone().addScaledVector(along, L * 0.5).addScaledVector(s.n, 0.0006), p0.clone().addScaledVector(along, L).addScaledVector(s.n, 0.0004)];
      const sd = new V3().crossVectors(along, s.n).normalize();
      push(pts, [sd, sd, sd], [0.0028, 0.0024, 0.0012], [s.n, s.n, s.n], null, browCol, 0.06, 0.35, false);
    }
  }
  // ---- eyelashes along the lid edges ----
  if (kind !== 'skeleton') {
    const lashCol = new THREE.Color(0.04, 0.03, 0.03); const lv = A.helper('lashes');
    for (const S of ['L', 'R']) {
      const e = lm['eye' + S]; const sx = S === 'L' ? 1 : -1;
      for (const upper of [true, false]) {
        // the lid edge is the inner rim of the lash helper
        const bins = new Map();
        for (const v of lv) { const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]; if (Math.sign(x) !== sx || (y > e.c.y) !== upper) continue; const ang = Math.atan2(y - e.c.y, (x - e.c.x) * sx); const b = Math.round(ang * 12); const d = Math.hypot(x - e.c.x, y - e.c.y); const cur = bins.get(b); if (!cur || d < cur.d) bins.set(b, { d, p: new V3(x, y, z) }); }
        const edge = [...bins.entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1].p);
        const n = upper ? 44 : 22;
        for (let i = 0; i < n && edge.length > 1; i++) {
          const f = (i + 0.5) / n * (edge.length - 1); const a = edge[Math.floor(f)], b = edge[Math.min(edge.length - 1, Math.floor(f) + 1)]; const p0 = a.clone().lerp(b, f - Math.floor(f));
          const out = p0.clone().sub(e.c); out.z = 0; out.normalize(); const fwd = new V3(0, 0, 1);
          const mid = Math.sin(Math.PI * (i + 0.5) / n); const L = (upper ? 0.0065 : 0.0035) * (0.5 + 0.5 * mid) * (0.85 + rnd() * 0.3);
          const d1 = out.clone().multiplyScalar(0.5).add(fwd.clone().multiplyScalar(0.8)).normalize(); const d2 = out.clone().multiplyScalar(upper ? 1 : 0.7).add(new V3(0, upper ? 0.5 : -0.3, 0.3)).normalize();
          const p1 = p0.clone().addScaledVector(d1, L * 0.5), p2 = p1.clone().addScaledVector(d2, L * 0.5);
          const sd = new V3().crossVectors(d1, out).normalize(); const nrm = fwd.clone();
          push([p0.clone().addScaledVector(fwd, -0.0008), p1, p2], [sd, sd, sd], [0.0016, 0.0013, 0.0006], [nrm, nrm, nrm], null, lashCol, 0.03, 0.3, false);
        }
      }
    }
  }
  return cards.length ? cardsGeometry(cards, A.BI.head, A.BI.chest) : null;
}

// ---------------------------------------------------------------- clothes and armour: shells around the body
const MATP = { cloth: [0, 0.95, 1], leather: [0, 0.62, 2], metal: [0.85, 0.4, 3], chain: [0.8, 0.45, 7], gold: [1, 0.25, 3], fur: [0, 1, 4], plain: [0, 0.8, 0], lamellar: [0.82, 0.46, 9], bands: [0.82, 0.44, 10], studded: [0, 0.6, 11], quilted: [0, 0.95, 12] };
// a material with wear (0 clean, 1 used, 2 rusty, 3 engraved): the shader reads it from the pattern id
const matW = (name, wear) => { const m = MATP[name] || MATP.cloth; return wear ? [m[0], m[1], m[2] + 20 * wear] : m; };
const matOf = (m) => (Array.isArray(m) ? m : MATP[m] || MATP.cloth);
function catOf(v, P, rest) {
  const b = A.B[A.region[v]];
  if (b === 'head') return 'head'; if (b === 'neck') return 'neck';
  if (b === 'hips') return P[v * 3 + 1] < rest.hips[1] + 0.03 ? 'pelvis' : 'torso';
  if (b === 'spine' || b === 'chest' || b === 'shL' || b === 'shR') return 'torso';
  if (b === 'armL' || b === 'armR') return 'uarm'; if (b === 'foreL' || b === 'foreR') return 'farm';
  if (/^(hand[LR]|th[LR]\d|f\d[LR]\d)$/.test(b)) return 'hand';
  if (b === 'thighL' || b === 'thighR') return 'thigh'; if (b === 'shinL' || b === 'shinR') return 'shin'; if (b === 'footL' || b === 'footR') return 'foot';
  return 'torso';
}
// neighbours of each vertex as flat arrays (start[i]..start[i+1] in list): far quicker than maps of sets
function adjacency(tris, NV) {
  const deg = new Int32Array(NV + 1); for (let i = 0; i < tris.length; i++) deg[tris[i] + 1] += 2;
  for (let i = 0; i < NV; i++) deg[i + 1] += deg[i];
  const list = new Int32Array(deg[NV]); const fill = deg.slice(0, NV);
  for (let i = 0; i < tris.length; i += 3) { const a = tris[i], b = tris[i + 1], c = tris[i + 2]; list[fill[a]++] = b; list[fill[a]++] = c; list[fill[b]++] = a; list[fill[b]++] = c; list[fill[c]++] = a; list[fill[c]++] = b; }
  return { start: deg, list };
}
const _loc = { a: null };
// one piece: the triangles of `src` whose vertices pass `test`, pushed out along the normals
function shellPiece(sh, N, src, field, o, FV) {
  const P = sh.P; const all = A.tri[src];
  // the field, worked out at most once per vertex (NaN = not yet)
  if (!FV) FV = new Float32Array(A.NV).fill(NaN);
  const f = (v) => { let x = FV[v]; if (x !== x) { x = field(v); FV[v] = x; } return x; };
  // a triangle is kept when any corner is inside, then outside corners slide back to where the field crosses zero
  const tris = [];
  for (let i = 0; i < all.length; i += 3) { const a = f(all[i]), b = f(all[i + 1]), c = f(all[i + 2]); if (a >= 0 || b >= 0 || c >= 0) { if ((a < -0.5 || b < -0.5 || c < -0.5) && !(a >= 0 && b >= 0 && c >= 0)) continue; tris.push(all[i], all[i + 1], all[i + 2]); } }
  if (!tris.length) return null;
  if (!_loc.a || _loc.a.length < A.NV) _loc.a = new Int32Array(A.NV);
  const loc = _loc.a; loc.fill(-1); const verts = [];
  for (let i = 0; i < tris.length; i++) { const v = tris[i]; if (loc[v] < 0) { loc[v] = verts.length; verts.push(v); } }
  const NVl = verts.length;
  let pos = new Float32Array(NVl * 3); for (let i = 0; i < NVl; i++) { const v = verts[i]; pos[i * 3] = P[v * 3]; pos[i * 3 + 1] = P[v * 3 + 1]; pos[i * 3 + 2] = P[v * 3 + 2]; }
  const ltris = new Uint32Array(tris.length); for (let i = 0; i < tris.length; i++) ltris[i] = loc[tris[i]];
  const fv = new Float32Array(NVl); for (let i = 0; i < NVl; i++) fv[i] = FV[verts[i]];
  const { start, list } = adjacency(ltris, NVl);
  { const snap = new Float32Array(pos); for (let i = 0; i < NVl; i++) { const fi = fv[i]; if (fi >= 0) continue; let x = 0, y = 0, z = 0, n = 0; for (let q = start[i]; q < start[i + 1]; q++) { const j = list[q]; const fj = fv[j]; if (fj < 0) continue; const t = fj / (fj - fi); x += pos[j * 3] + (pos[i * 3] - pos[j * 3]) * t; y += pos[j * 3 + 1] + (pos[i * 3 + 1] - pos[j * 3 + 1]) * t; z += pos[j * 3 + 2] + (pos[i * 3 + 2] - pos[j * 3 + 2]) * t; n++; } if (n) { snap[i * 3] = x / n; snap[i * 3 + 1] = y / n; snap[i * 3 + 2] = z / n; } } pos = snap; }
  // boundary (edges used once) for trims and to keep the edges in place while smoothing
  const ec = new Map(); for (let i = 0; i < ltris.length; i += 3) for (let k = 0; k < 3; k++) { const a = ltris[i + k], b = ltris[i + (k + 1) % 3]; const key = a < b ? a * 65536 + b : b * 65536 + a; ec.set(key, (ec.get(key) || 0) + 1); }
  const edge = new Uint8Array(NVl); for (const [key, c] of ec) if (c === 1) { edge[Math.floor(key / 65536)] = 1; edge[key % 65536] = 1; }
  // smooth away fine anatomy (plate armour is smooth, cloth a little)
  // smoothing never moves a point inward (so cloth and plate stay outside the skin)
  if (o.smooth) { const n0 = normalsFor(pos, ltris); const p0 = new Float32Array(pos); let np = new Float32Array(pos.length);
    for (let it = 0; it < o.smooth; it++) { np.set(pos); for (let i = 0; i < NVl; i++) { const s0 = start[i], s1 = start[i + 1]; if (s0 === s1) continue; let x = 0, y = 0, z = 0; for (let q = s0; q < s1; q++) { const j = list[q] * 3; x += pos[j]; y += pos[j + 1]; z += pos[j + 2]; } const cnt = s1 - s0, k = edge[i] ? 0.25 : 0.55, i3 = i * 3; np[i3] += (x / cnt - pos[i3]) * k; np[i3 + 1] += (y / cnt - pos[i3 + 1]) * k; np[i3 + 2] += (z / cnt - pos[i3 + 2]) * k;
      const dx = np[i3] - p0[i3], dy = np[i3 + 1] - p0[i3 + 1], dz = np[i3 + 2] - p0[i3 + 2]; const dn = dx * n0[i3] + dy * n0[i3 + 1] + dz * n0[i3 + 2]; if (dn < 0) { np[i3] -= n0[i3] * dn; np[i3 + 1] -= n0[i3 + 1] * dn; np[i3 + 2] -= n0[i3 + 2] * dn; } } const t = pos; pos = np; np = t; } }
  const nrm = normalsFor(pos, ltris);
  const offFn = typeof o.off === 'function';
  for (let i = 0; i < NVl; i++) { const off = offFn ? o.off(verts[i], pos[i * 3 + 1]) : o.off; pos[i * 3] += nrm[i * 3] * off; pos[i * 3 + 1] += nrm[i * 3 + 1] * off; pos[i * 3 + 2] += nrm[i * 3 + 2] * off; }
  if (o.hull) { const H = o.hull; for (let i = 0; i < NVl; i++) { const dx = pos[i * 3] - H.c.x, dy = pos[i * 3 + 1] - H.c.y, dz = pos[i * 3 + 2] - H.c.z; const n = H.n || 2; const k = (Math.abs(dx / H.rx) ** n + Math.abs(dy / (dy > 0 ? H.ryT : H.ryB)) ** n + Math.abs(dz / (dz > 0 ? H.rzF : H.rzB)) ** n) ** (1 / n); if (k < 1 && k > 1e-6) { pos[i * 3] = H.c.x + dx / k; pos[i * 3 + 1] = H.c.y + dy / k; pos[i * 3 + 2] = H.c.z + dz / k; } } }
  const nrm2 = normalsFor(pos, ltris);
  // distance from the edge, for trims
  let dist = null;
  if (o.trim) { dist = new Float32Array(NVl).fill(1e9); const q = []; for (let i = 0; i < NVl; i++) if (edge[i]) { dist[i] = 0; q.push(i); } for (let h = 0; h < q.length; h++) { const i = q[h]; for (let r = start[i]; r < start[i + 1]; r++) { const j = list[r]; const d = dist[i] + Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2]); if (d < dist[j] && d < 0.06) { dist[j] = d; q.push(j); } } } }
  const col = new Float32Array(NVl * 3), mat = new Float32Array(NVl * 3), si = new Uint8Array(NVl * 4), sw = new Uint8Array(NVl * 4);
  const C = new THREE.Color(o.col), T = o.trim ? new THREE.Color(o.trim) : null; const M = matOf(o.mat), MT = o.trimMat ? matOf(o.trimMat) : M;
  for (let i = 0; i < NVl; i++) {
    const v = verts[i]; const tr = T && dist[i] < (o.trimW || 0.014);
    const c = tr ? T : o.colFn ? o.colFn(v, pos[i * 3 + 1], C, pos[i * 3], pos[i * 3 + 2]) : C; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    const m = tr ? MT : M; mat[i * 3] = m[0]; mat[i * 3 + 1] = m[1]; mat[i * 3 + 2] = m[2];
    for (let k = 0; k < 4; k++) { si[i * 4 + k] = A.skinI[v * 4 + k]; sw[i * 4 + k] = A.skinW[v * 4 + k]; }
    if (o.bind) o.bind(v, pos[i * 3 + 1], si, sw, i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm2, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aMat', new THREE.BufferAttribute(mat, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4, true)); g.setIndex(Array.from(ltris));
  return g;
}
function rigidPiece(geo, mtx, col, mat, bone) {
  const g = geo.clone(); g.applyMatrix4(mtx); if (g.attributes.uv) g.deleteAttribute('uv'); const n = g.attributes.position.count;
  const C = new THREE.Color(col); const M = matOf(mat); const cc = new Float32Array(n * 3), mm = new Float32Array(n * 3), si = new Uint8Array(n * 4), sw = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { cc[i * 3] = C.r; cc[i * 3 + 1] = C.g; cc[i * 3 + 2] = C.b; mm[i * 3] = M[0]; mm[i * 3 + 1] = M[1]; mm[i * 3 + 2] = M[2]; si[i * 4] = bone; sw[i * 4] = 255; }
  g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); g.setAttribute('aMat', new THREE.BufferAttribute(mm, 3)); g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4, true));
  if (!g.index) g.setIndex([...Array(n).keys()]); return g;
}
const RG = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12), sph: new THREE.SphereGeometry(0.5, 10, 8), torus: new THREE.TorusGeometry(0.5, 0.12, 6, 14) };
const TRS = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => new M4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz));
// helmets are shells of the head itself, so they sit snugly on this skull; the style decides what they cover
const HELM_CLOSED = { great: 1, barbute: 1, coif: 1, coifcap: 1 }; // no hair shows
const HELM_NOBEARD = { great: 1, barbute: 1 }; // the face is covered
function helmet(L, sh, N, rest, cat, add, solid, X, Y, Z) {
  const cl = (x) => Math.max(-0.45, Math.min(0.45, x));
  const lm = sh.lm, hf = headFrame(sh); const hc = hf.c, HR = hf.rad;
  const eyeY = lm.eyeL.c.y, eyeX = Math.abs(lm.eyeL.c.x), eyeR = Math.max(0.011, lm.eyeL.r), browY = lm.browIn.y, chinY = lm.chin.y, mouthY = lm.mouth.y, noseY = lm.nose.y;
  const neckY = rest.neck[1], shY = rest.shL[1];
  const kind = L.helm, st = L.helmStyle || (kind === 'chain' ? 'coif' : kind === 'leather' ? 'cap' : 'nasal'), t = L.helmTier || 0;
  const wear = kind === 'leather' ? 0 : t <= 0 ? 2 : t <= 2 ? 1 : t >= 4 ? 3 : 0;
  const base = L.helmCol || '#a8acb4'; const mcol = kind === 'plate' ? K3.shade(base, [-0.32, -0.2, -0.1, -0.02, 0.04, 0.08][Math.min(5, t)]) : base;
  // edges round the face openings stay dark metal (a gold line there looked jagged); the gold goes on the brow band and crest ridge
  const trimC = K3.shade(mcol, -0.3), trimM = matW('metal', wear);
  const goldC = t >= 3 ? '#c8a040' : trimC, goldM = t >= 3 ? 'gold' : trimM;
  const H = (v) => cat[v] === 'head' || cat[v] === 'neck';
  const back = (v) => K3.clamp((hc.z - Z(v)) / HR.z, 0, 1), side = (v) => K3.clamp(Math.abs(X(v)) / HR.x, 0, 1);
  const front = (v) => Z(v) - (hc.z + HR.z * 0.15);
  // the rim of a skull cap: just above the brow at the front, over the ears at the sides, down to the nape at the back
  const rim = (v) => browY + 0.009 - 0.08 * smooth(0, 1, back(v)) - 0.03 * smooth(0.55, 0.95, side(v)) * (1 - back(v));
  const cap = (v) => (H(v) ? Y(v) - rim(v) : -1);
  const whole = (v) => (H(v) ? Y(v) - (neckY - 0.01) : -1);
  const fw = eyeX + eyeR * 1.7; const fc = (browY + chinY) / 2, fh = (browY - chinY) / 2 + 0.014;
  const faceHole = (v) => (Z(v) > hc.z ? (1 - ((X(v) / fw) ** 2 + ((Y(v) - fc) / fh) ** 2)) * 0.03 : -0.03);
  const smoothMetal = 16, offM = 0.0135;
  let noseZ = -1, foreZ = -1; for (let v = 0; v < A.NV; v++) if (cat[v] === 'head') { noseZ = Math.max(noseZ, Z(v)); if (Y(v) > browY + 0.008) foreZ = Math.max(foreZ, Z(v)); }
  const hullOf = (o, faceCovered) => ({ c: hc, n: st === 'great' ? 2.9 : st === 'barbute' ? 2.4 : 2, rx: HR.x + o, ryT: HR.y + o, ryB: HR.y * 1.25 + o, rzF: (faceCovered ? noseZ + 0.006 : foreZ) - hc.z + o, rzB: HR.z + o });
  if (st === 'coif' || st === 'coifcap') {
    // mail coif: over the head, round the chin and throat, and out over the shoulders
    add('body', (v) => { const sd = Math.hypot(X(v), Z(v) - rest.neck[2]); const mant = (cat[v] === 'torso' || cat[v] === 'uarm') ? Math.min(Y(v) - (shY - 0.06), 0.2 - sd) : -1; return K3.clamp(Math.min(Math.max(H(v) ? 0.04 : -1, mant), -faceHole(v)), -0.45, 0.45); }, { off: 0.0095, smooth: 9, col: '#8a8e96', mat: matW('chain', wear), trim: '#5a5e66', trimW: 0.006 }, false);
    if (st === 'coifcap') add('body', (v) => cl(cap(v) + 0.012), { off: 0.016, hull: hullOf(0.016, false), smooth: smoothMetal, col: mcol, mat: matW('bands', wear), trim: trimC, trimW: 0.008, trimMat: trimM }, false);
    return { closed: true, top: 0.016 };
  }
  if (st === 'cap') { // a stitched leather arming cap with ear flaps
    add('body', (v) => { if (!H(v)) return -1; const flap = Math.min(0.022 - Math.abs(Z(v) - (hc.z - HR.z * 0.1)) * 0.5, Y(v) - (chinY + 0.012), side(v) - 0.7); return K3.clamp(Math.max(cap(v) + 0.004, flap), -0.45, 0.45); }, { off: 0.008, smooth: 12, hull: hullOf(0.008, false), col: K3.shade(mcol, -0.05), mat: 'leather', trim: '#2a1a10', trimW: 0.007, trimMat: 'leather' }, false);
    return { closed: false, top: 0.008 };
  }
  let field = cap, off = offM;
  if (st === 'nasal' || st === 'skull') {
    const cheek = (v) => (H(v) ? Math.min(Math.abs(X(v)) - (eyeX + eyeR * 1.15), Y(v) - (mouthY - 0.006), front(v) + HR.z * 0.9, rim(v) + 0.03 - Y(v) + 0.03) : -1);
    field = st === 'nasal' ? (v) => Math.max(cap(v), cheek(v)) : cap;
  } else if (st === 'barbute') { // closed to the jaw with a T-shaped opening for the eyes and mouth
    const T = (v) => (Z(v) > lm.eyeL.c.z - 0.035 ? Math.max(Math.min(eyeX + eyeR * 1.35 - Math.abs(X(v)), eyeR * 1.05 - Math.abs(Y(v) - (eyeY + eyeR * 0.15))), Math.min(0.018 - Math.abs(X(v)), eyeY - Y(v), Y(v) - (chinY + 0.004))) : -0.03);
    field = (v) => Math.min(whole(v), -T(v));
  } else if (st === 'sallet') { // a tailed sallet with a visor slit; the jaw stays open
    const cover = (v) => (H(v) ? Y(v) - (eyeY - eyeR * 1.6 - 0.07 * smooth(0, 1, back(v))) : -1);
    const slit = (v) => (Z(v) > lm.eyeL.c.z - 0.035 ? Math.min(eyeX + eyeR * 1.6 - Math.abs(X(v)), eyeR * 0.5 - Math.abs(Y(v) - (eyeY + eyeR * 0.1))) : -0.03);
    field = (v) => Math.min(cover(v), -slit(v));
    off = (v, y) => offM + 0.03 * back(v) * smooth(eyeY + 0.02, eyeY - 0.06, y);
  } else if (st === 'great') { // a great helm: closed all round, an eye slit and breaths
    const slit = (v) => (Z(v) > lm.eyeL.c.z - 0.035 ? Math.min(eyeX + eyeR * 1.8 - Math.abs(X(v)), eyeR * 0.42 - Math.abs(Y(v) - eyeY)) : -0.03);
    field = (v) => Math.min(H(v) ? Y(v) - (neckY - 0.03) : -1, -slit(v)); off = 0.017;
  }
  const breaths = st === 'great' ? (v, y, C, x, z) => { if (z < lm.eyeL.c.z - 0.01 || x > -0.016 || x < -0.046 || y > noseY + 0.004 || y < mouthY - 0.012) return C; const gx = Math.abs(((x + 0.016) * 1000) % 8), gy = Math.abs(((y - noseY) * 1000) % 8); return gx > 2.5 && gx < 5.5 && gy > 2.5 && gy < 5.5 ? C.clone().multiplyScalar(0.12) : C; } : null;
  const faceCovered = st === 'great' || st === 'barbute';
  // darkness behind eye slits: you see shadow through a visor, not skin
  if (st === 'great' || st === 'sallet') add('body', (v) => (cat[v] === 'head' && Z(v) > lm.eyeL.c.z - 0.04 ? cl(Math.min(eyeX + eyeR * 2.2 - Math.abs(X(v)), eyeR * 1.4 - Math.abs(Y(v) - eyeY))) : -1), { off: 0.004, smooth: 6, col: '#070504', mat: 'plain' }, false);
  if (st === 'great') { // a riveted band across the brow and a strip down the face
    add('body', (v) => (H(v) ? cl(Math.min(Y(v) - (eyeY + eyeR * 0.55), eyeY + eyeR * 0.55 + 0.018 - Y(v))) : -1), { off: 0.0225, hull: hullOf(0.0225, true), smooth: smoothMetal, col: K3.shade(mcol, 0.05), mat: matW('bands', wear), trim: trimC, trimW: 0.004, trimMat: trimM }, false);
    add('body', (v) => (cat[v] === 'head' && Z(v) > hc.z && Y(v) < eyeY - eyeR * 0.6 ? cl(0.011 - Math.abs(X(v))) : -1), { off: 0.0225, hull: hullOf(0.0225, true), smooth: smoothMetal, col: K3.shade(mcol, 0.08), mat: matW('metal', wear), trim: trimC, trimW: 0.003, trimMat: trimM }, false);
  }
  add('body', (v) => cl(field(v)), { off, hull: hullOf(typeof off === 'number' ? off : offM, faceCovered), smooth: smoothMetal, col: mcol, mat: matW(st === 'great' || st === 'barbute' ? 'metal' : 'bands', wear), trim: trimC, trimW: 0.006, trimMat: trimM, colFn: breaths }, false);
  // a raised brow band and a ridge over the crown
  if (st !== 'great') add('body', (v) => (H(v) ? cl(Math.min(Y(v) - (rim(v) + 0.004), rim(v) + 0.022 - Y(v))) : -1), { off: off === offM ? offM + 0.006 : (v, y) => off(v, y) + 0.006, hull: hullOf(offM + 0.006, false), smooth: smoothMetal, col: t >= 3 ? goldC : K3.shade(mcol, 0.06), mat: t >= 3 ? goldM : matW('metal', wear), trim: trimC, trimW: 0.004, trimMat: trimM }, false);
  add('body', (v) => (H(v) && Y(v) > browY ? cl(0.009 - Math.abs(X(v))) : -1), { off: (typeof off === 'function' ? 0.02 : off + 0.0055), hull: hullOf((typeof off === 'function' ? 0.02 : off + 0.0055), faceCovered), smooth: smoothMetal, col: t >= 3 ? goldC : K3.shade(mcol, 0.1), mat: t >= 3 ? goldM : matW('metal', wear), trim: trimC, trimW: 0.003, trimMat: trimM }, false);
  if (st === 'nasal') { // the nasal bar, from the brow band down over the nose
    let z = lm.nose.z; for (let v = 0; v < A.NV; v++) if (cat[v] === 'head' && Math.abs(X(v)) < 0.006 && Y(v) < browY && Y(v) > noseY) z = Math.max(z, Z(v));
    solid(RG.box, TRS(0, (browY + noseY) / 2 + 0.004, z + 0.012, 0.016, browY - noseY + 0.02, 0.006, -0.12), mcol, matW('metal', wear), A.BI.head);
  }
  return { closed: !!HELM_CLOSED[st], top: typeof off === 'number' ? off : 0.02 };
}
// what someone wears, as shells cut along smooth lines, and which parts of the skin they hide
function outfit(look, kind, sh, N, rest) {
  const L = look || {}; const P = sh.P; const pieces = []; const covers = [];
  const armor = L.armor || { kind: 'none', col: '#7a6a5a', trim: '#5a4a3a' }; const ak = armor.kind || 'none';
  const tier = armor.tier != null ? armor.tier : 1; const wear = ak === 'plate' || ak === 'chain' ? (tier <= 0 ? 2 : tier <= 2 ? 1 : tier >= 4 ? 3 : 0) : 0;
  const ac = ak === 'plate' ? K3.shade(armor.col || '#a8acb4', [-0.3, -0.18, -0.08, 0, 0.05, 0.08][Math.min(5, tier)]) : armor.col || '#7a6a5a', at = armor.trim || '#5a4a3a';
  const fine = tier >= 3; const trimM = matW('metal', fine ? 0 : wear), trimC = fine ? K3.shade(ac, -0.16) : K3.shade(ac, -0.32); // a low-contrast edge: a bright line showed every step of the mesh
  const raceD = D.RACES[L.race] || {}; const fem = L.gender === 'f';
  const robe = (ak === 'cloth' && !L.shirtOnly) || L.robe; // a cloth shirt or tunic is worn over trousers, not as a robe
  const bare = L.bare || (ak === 'none' && (kind === 'troll' || kind === 'ogre' || kind === 'goblin'));
  // heroes in 3D show exactly their gear: no shirt without a chest piece, a loincloth without leggings
  const torsoBare = bare || !!L.noShirt, legsBare = bare || !!L.noPants;
  const barefoot = L.barefoot || raceD.barefoot || kind === 'troll' || kind === 'ogre' || kind === 'goblin' || kind === 'zombie';
  const cat = new Array(A.NV); for (let v = 0; v < A.NV; v++) cat[v] = catOf(v, P, rest);
  const X = (v) => P[v * 3], Y = (v) => P[v * 3 + 1], Z = (v) => P[v * 3 + 2];
  const shY = rest.shL[1], elbowY = rest.foreL[1], wristY = rest.handL[1], kneeY = rest.shinL[1], hipY = rest.hips[1], ankleY = rest.footL[1], neckY = rest.neck[1];
  const bootTop = ankleY + (kneeY - ankleY) * (ak === 'plate' ? 0.55 : 0.62);
  const cl = (x) => Math.max(-0.45, Math.min(0.45, x));
  const IN = (v, a, b, c, d, e) => { const k = cat[v]; return k === a || k === b || k === c || k === d || k === e; };
  const min = Math.min;
  // a round neckline, lower at the front
  const neckCut = (v, drop = 0) => shY + 0.035 - drop - (Z(v) > 0 ? 0.045 * Math.exp(-((X(v) / 0.075) ** 2)) : 0.01);
  const add = (src, field, o, cover = true) => { const FV = new Float32Array(A.NV).fill(NaN); const g = shellPiece(sh, N, src, field, o, FV); if (g) pieces.push(g); if (cover && src === 'body') covers.push({ field, FV }); };
  const solid = (geo, mtx, col, mat, bone) => pieces.push(rigidPiece(geo, mtx, col, mat, bone));
  // the outermost point of the body near (x, y), for buckles and pouches that sit on the surface
  const surfZ = (x, y, w = 0.016) => { let z = -1; for (let v = 0; v < A.NV; v++) { const k = cat[v]; if ((k === 'torso' || k === 'pelvis') && Math.abs(X(v) - x) < w && Math.abs(Y(v) - y) < 0.014) z = Math.max(z, Z(v)); } return z < -0.5 ? 0.1 : z; };
  const buckle = (x, y, zOff, col, bone) => { const z = surfZ(x, y) + zOff; solid(RG.box, TRS(x, y, z, 0.032, 0.026, 0.006), col, matW('metal', 1), bone); solid(RG.box, TRS(x, y, z + 0.0035, 0.02, 0.014, 0.004), '#1a120c', 'leather', bone); solid(RG.box, TRS(x + 0.003, y, z + 0.005, 0.004, 0.02, 0.004), col, matW('metal', 1), bone); };
  const pants = ak === 'plate' ? (fine ? K3.shade(ac, -0.3) : '#3a2a20') : ak === 'chain' ? '#4a4a52' : ak === 'leather' ? '#4a3424' : L.pants || '#4a4a5a';
  const bootC = ak === 'plate' ? K3.shade(ac, -0.1) : '#3a2a1e';
  // ---- legs and feet ----
  const pantsBottom = barefoot ? ankleY + 0.03 : bootTop - 0.04;
  if (!legsBare || kind === 'giant') add('body', (v) => IN(v, 'pelvis', 'torso', 'thigh', 'shin') ? cl(min(hipY + 0.07 - Y(v), Y(v) - pantsBottom)) : -1, { off: 0.0045, smooth: 2, col: pants, mat: ak === 'plate' ? (fine ? matW('chain', wear) : 'leather') : ak === 'chain' ? matW('chain', wear) : ak === 'leather' ? 'leather' : 'cloth' });
  else if (L.noPants) {
    // a linen loincloth: a band round the hips with a flap hanging front and back
    add('body', (v) => IN(v, 'pelvis', 'torso', 'thigh') ? cl(min(hipY + 0.03 - Y(v), Y(v) - (hipY - 0.1))) : -1, { off: 0.005, smooth: 3, col: '#d8ccb0', mat: 'cloth', trim: '#8a7a5a', trimW: 0.008 });
    add('body', (v) => IN(v, 'pelvis', 'thigh') && Math.abs(X(v)) < 0.075 ? cl(min(0.075 - Math.abs(X(v)), Y(v) - (hipY - 0.27), hipY - 0.02 - Y(v))) : -1, { off: 0.009, smooth: 2, col: '#cfc2a4', mat: 'cloth', trim: '#8a7a5a', trimW: 0.006 }, false);
  }
  else add('body', (v) => IN(v, 'pelvis', 'torso', 'thigh') ? cl(min(hipY + 0.045 - Y(v), Y(v) - (hipY - 0.14))) : -1, { off: 0.006, smooth: 3, col: '#5a4030', mat: 'leather', trim: '#3a2818', trimW: 0.01 });
  if (!barefoot) {
    add('body', (v) => IN(v, 'foot', 'shin') ? cl(bootTop - Y(v)) : -1, { off: (v, y) => (ak === 'plate' ? 0.013 : 0.009) + (y < 0.025 ? 0.005 : 0) + (ak !== 'plate' ? 0.007 * smooth(bootTop - 0.035, bootTop - 0.005, y) : 0), smooth: 18, col: bootC, mat: ak === 'plate' ? matW('metal', wear) : 'leather', trim: ak === 'plate' ? trimC : K3.shade(bootC, -0.35), trimW: 0.014, trimMat: ak === 'plate' ? trimM : 'leather' });
    add('body', (v) => IN(v, 'foot') ? cl(0.016 - Y(v)) : -1, { off: (ak === 'plate' ? 0.016 : 0.012), smooth: 18, col: '#1e140c', mat: 'leather' }, false); // the sole
  }
  // ---- torso and arms ----
  const sleeves = robe || ak === 'chain' || ak === 'plate' || ak === 'leather' || L.sleeves !== 'short';
  const cuffY = sleeves ? wristY + 0.025 : elbowY + 0.07;
  if (!torsoBare) {
    const shirtC = ak === 'none' ? ac : ak === 'leather' ? (L.shirt || '#8a7a5a') : ac;
    const shirt = (v) => IN(v, 'torso', 'neck', 'pelvis') ? cl(min(neckCut(v, robe ? 0 : 0.005) - Y(v), Y(v) - (hipY - 0.045))) : IN(v, 'uarm', 'farm') ? cl(Y(v) - cuffY) : -1;
    if (ak !== 'plate') add('body', shirt, { off: (v, y) => (fem ? 0.007 : 0.005) + (robe && cat[v] === 'farm' ? 0.04 * smooth(elbowY, wristY, y) : 0), smooth: fem ? 8 : 4, col: robe ? ac : shirtC, mat: ak === 'chain' ? 'chain' : 'cloth', trim: robe ? at : K3.shade(shirtC, -0.2), trimW: robe ? 0.02 : 0.008 });
    if (false) add('body', (v) => IN(v, 'torso') ? cl(0.07 - Math.abs(Y(v) - (rest.chest[1] + 0.02))) : -1, { off: 0.004, smooth: 2, col: '#6a4a3a', mat: 'leather' });
    if (ak === 'leather') {
      add('body', (v) => IN(v, 'torso', 'neck', 'pelvis') ? cl(min(neckCut(v, 0.02) - Y(v), Y(v) - (hipY - 0.03))) : -1, { off: 0.012, smooth: fem ? 10 : 6, col: ac, mat: 'studded', trim: K3.shade(ac, -0.35), trimW: 0.012, trimMat: 'leather' });
      for (let k = 0; k < 2; k++) add('body', (v) => IN(v, 'uarm', 'torso') && (cat[v] === 'uarm' || Math.abs(X(v)) > 0.11) ? cl(Y(v) - (shY - 0.05 - k * 0.05)) : -1, { off: 0.024 - k * 0.006, smooth: 8, col: K3.shade(ac, -0.06 - k * 0.06), mat: 'studded', trim: K3.shade(ac, -0.4), trimW: 0.008, trimMat: 'leather' }, false);
      add('body', (v) => IN(v, 'farm') ? cl(min(Y(v) - (wristY + 0.02), elbowY - 0.05 - Y(v))) : -1, { off: 0.011, smooth: 4, col: K3.shade(ac, -0.2), mat: 'studded', trim: K3.shade(ac, -0.4), trimW: 0.008, trimMat: 'leather' }, false);
      // a cross strap over the chest
      add('body', (v) => IN(v, 'torso') ? cl(0.014 - Math.abs((Y(v) - rest.chest[1]) - X(v) * 1.1)) : -1, { off: 0.016, smooth: 8, col: '#2a1a10', mat: 'leather', trim: '#c8a040', trimW: 0.002, trimMat: 'gold' }, false);
    }
    if (ak === 'chain') {
      add('body', (v) => IN(v, 'farm') ? cl(min(Y(v) - (wristY + 0.02), (elbowY + wristY) / 2 - Y(v))) : -1, { off: 0.009, smooth: 4, col: '#3a2a1e', mat: 'leather', trim: at, trimW: 0.008 }, false);
      add('body', (v) => IN(v, 'torso', 'neck', 'pelvis') ? cl(min(neckCut(v, 0.01) - Y(v), Y(v) - (hipY - 0.04), 0.16 - Math.abs(X(v)))) : -1, { off: 0.016, smooth: 10, col: at, mat: 'cloth', trim: K3.shade(at, -0.3), trimW: 0.012, colFn: (v, y, C, x) => (Math.abs(x) < 0.022 || Math.abs((y - rest.chest[1] - 0.03) - Math.abs(x) * 0.7) < 0.012 ? C.clone().lerp(new THREE.Color('#e8d8a0'), 0.75) : C) }, false); // a tabard over the mail, with a pale stripe and chevron
      add('skirt', (v) => cl(min(0.13 - Math.abs(X(v)), Y(v) - (hipY - (hipY - kneeY) * 0.7))), { off: 0.016, smooth: 3, col: at, mat: 'cloth', trim: K3.shade(at, -0.3), trimW: 0.012, bind: (v, y, si, sw, i) => { const t = K3.clamp((hipY - y) / (hipY - ankleY), 0, 1); const sd = P[v * 3] >= 0 ? A.BI.thighL : A.BI.thighR; si[i * 4] = A.BI.hips; si[i * 4 + 1] = sd; si[i * 4 + 2] = 0; si[i * 4 + 3] = 0; const w2 = Math.round(t * 0.5 * 255); sw[i * 4] = 255 - w2; sw[i * 4 + 1] = w2; sw[i * 4 + 2] = 0; sw[i * 4 + 3] = 0; } }, false);
      for (let k = 0; k < 2; k++) add('body', (v) => IN(v, 'uarm', 'torso') && (cat[v] === 'uarm' || Math.abs(X(v)) > 0.11) ? cl(Y(v) - (shY - 0.045 - k * 0.045)) : -1, { off: 0.024 - k * 0.006, smooth: 8, col: K3.shade('#5a3a24', -k * 0.12), mat: 'studded', trim: '#2a1a10', trimW: 0.008, trimMat: 'leather' }, false);
    }
    if (ak === 'plate') {
      // under it all a padded gambeson shows at the sleeves and collar
      add('body', (v) => IN(v, 'torso', 'neck', 'pelvis') ? cl(min(neckCut(v, -0.01) - Y(v), Y(v) - (hipY - 0.05))) : IN(v, 'uarm', 'farm') ? cl(Y(v) - (wristY + 0.02)) : -1, { off: 0.007, smooth: 3, col: fine ? '#7e828a' : '#5a4232', mat: fine ? matW('chain', wear) : 'quilted' });
      // the cuirass: rows of riveted plates following the chest, with buckled straps down the front
      add('body', (v) => IN(v, 'torso', 'neck', 'pelvis') ? cl(min(neckCut(v, -0.005) - Y(v), Y(v) - (hipY - 0.03))) : -1, { off: 0.026, smooth: 12, col: ac, mat: matW(fine ? 'lamellar' : 'lamellar', wear), trim: trimC, trimW: 0.014, trimMat: trimM });
      add('body', (v) => IN(v, 'torso') ? cl(min(0.016 - Math.abs(X(v)), neckCut(v, 0.02) - Y(v), Y(v) - (hipY + 0.05))) : -1, { off: 0.03, smooth: 12, col: '#3a2416', mat: 'leather', trim: '#1e140c', trimW: 0.003, trimMat: 'leather' }, false);
      for (let k = 0; k < 3; k++) buckle(0, rest.chest[1] + 0.08 - k * 0.09, 0.034, fine ? '#d8b048' : '#8a8e94', k ? A.BI.spine : A.BI.chest);
      // a gorget round the throat
      add('body', (v) => IN(v, 'neck', 'torso', 'head') ? cl(min(neckY + 0.035 - Y(v), Y(v) - (shY - 0.02), 0.1 - Math.abs(X(v)))) : -1, { off: 0.02, smooth: 6, col: K3.shade(ac, -0.08), mat: matW('bands', wear), trim: trimC, trimW: 0.008, trimMat: trimM });
      // pauldrons: three overlapping lames over each shoulder, the top one outermost
      for (let k = 0; k < 3; k++) add('body', (v) => IN(v, 'uarm', 'torso') && (cat[v] === 'uarm' || Math.abs(X(v)) > 0.1 + k * 0.006) ? cl(Y(v) - (shY - 0.035 - k * 0.05)) : -1, { off: (v, y) => 0.046 - k * 0.008 + 0.006 * smooth(shY - 0.08, shY, y), smooth: 10, col: K3.shade(ac, 0.06 - k * 0.05), mat: matW('bands', wear), trim: trimC, trimW: 0.011, trimMat: trimM }, false);
      add('body', (v) => IN(v, 'uarm') ? cl(Y(v) - (elbowY - 0.02)) : -1, { off: 0.013, smooth: 6, col: K3.shade(ac, -0.06), mat: matW('metal', wear) });
      // a couter over the elbow and vambraces flaring at the wrist
      add('body', (v) => IN(v, 'uarm', 'farm') ? cl(0.035 - Math.abs(Y(v) - elbowY)) : -1, { off: 0.022, smooth: 8, col: K3.shade(ac, 0.04), mat: matW('metal', wear), trim: trimC, trimW: 0.006, trimMat: trimM }, false);
      add('body', (v) => IN(v, 'farm') ? cl(min(Y(v) - (wristY + 0.012), elbowY - 0.02 - Y(v))) : -1, { off: (v, y) => 0.013 + 0.012 * smooth(wristY + 0.06, wristY + 0.015, y), smooth: 6, col: K3.shade(ac, -0.04), mat: matW('bands', wear), trim: trimC, trimW: 0.01, trimMat: trimM });
      add('body', (v) => IN(v, 'hand') ? 1 : IN(v, 'farm') ? cl(wristY + 0.04 - Y(v)) : -1, { off: 0.004, smooth: 1, col: K3.shade(ac, -0.15), mat: matW('metal', wear) });
      if (fine) add('body', (v) => IN(v, 'thigh') ? cl(min(hipY - 0.07 - Y(v), Y(v) - (kneeY - 0.01))) : -1, { off: 0.016, smooth: 8, col: K3.shade(ac, 0.02), mat: matW('bands', wear), trim: trimC, trimW: 0.012, trimMat: trimM }, false);
      // knee cops and greaves over the shins
      add('body', (v) => IN(v, 'shin', 'thigh') ? cl(0.04 - Math.abs(Y(v) - (kneeY + 0.01))) : -1, { off: 0.024, smooth: 10, col: K3.shade(ac, 0.06), mat: matW('metal', wear), trim: trimC, trimW: 0.006, trimMat: trimM }, false);
      add('body', (v) => IN(v, 'shin', 'thigh') ? cl(min(kneeY - 0.02 - Y(v), Y(v) - (ankleY + 0.04))) : -1, { off: 0.016, smooth: 10, col: K3.shade(ac, 0.02), mat: matW('metal', wear), trim: trimC, trimW: 0.01, trimMat: trimM }, false);
    }
  }
  // a linen wrap over the breasts
  if (fem && torsoBare && (L.wrap || L.bare)) add('body', (v) => IN(v, 'torso') ? cl(min(0.065 - Math.abs(Y(v) - (rest.chest[1] + 0.035)), 1)) : -1, { off: 0.0055, smooth: 3, col: '#d8ccb0', mat: 'cloth', trim: '#8a7a5a', trimW: 0.006 });
  if (!torsoBare) {
    // a belt at the waist
    if (!robe || ak === 'chain') {
      const bOff = ak === 'plate' ? 0.031 : ak === 'leather' ? 0.018 : ak === 'chain' ? 0.02 : 0.012, bY = hipY + 0.035;
      add('body', (v) => IN(v, 'torso', 'pelvis') ? cl(0.02 - Math.abs(Y(v) - bY)) : -1, { off: bOff, smooth: 3, col: '#3a2618', mat: 'leather', trim: '#c8a040', trimW: 0.0035, trimMat: 'gold' }, false);
      if (ak === 'plate' || ak === 'chain' || ak === 'leather') {
        buckle(0, bY, bOff + 0.004, fine ? '#d8b048' : '#9a9ea6', A.BI.hips);
        const px = 0.12 * (L.gender === 'f' ? 0.9 : 1); const pz = surfZ(-px, bY - 0.03, 0.03) + bOff + 0.012;
        solid(RG.box, TRS(-px, bY - 0.045, pz, 0.065, 0.075, 0.03, 0, -0.35), '#4a3020', 'leather', A.BI.hips); solid(RG.box, TRS(-px, bY - 0.016, pz + 0.004, 0.068, 0.025, 0.033, 0, -0.35), '#3a2416', 'leather', A.BI.hips);
      }
    }
  }
  // ---- skirts: robes, mail skirts, tassets and tunics ----
  const skirt = (bottom, o) => add('skirt', (v) => cl(P[v * 3 + 1] - bottom), Object.assign({ smooth: 2, bind: (v, y, si, sw, i) => { const t = K3.clamp((hipY - y) / (hipY - ankleY), 0, 1); const side = P[v * 3] >= 0 ? A.BI.thighL : A.BI.thighR; si[i * 4] = A.BI.hips; si[i * 4 + 1] = side; si[i * 4 + 2] = 0; si[i * 4 + 3] = 0; const w2 = Math.round(t * 0.6 * 255); sw[i * 4] = 255 - w2; sw[i * 4 + 1] = w2; sw[i * 4 + 2] = 0; sw[i * 4 + 3] = 0; } }, o), false);
  if (robe && !torsoBare) skirt(ankleY + 0.02, { off: 0.012, col: ac, mat: 'cloth', trim: at, trimW: 0.03 });
  else if (ak === 'chain') skirt(kneeY + 0.06, { off: 0.008, col: '#8e9298', mat: 'chain', trim: '#6a6e74', trimW: 0.01 });
  else if (ak === 'plate') skirt(hipY - (hipY - kneeY) * 0.62, { off: 0.02, smooth: 4, col: K3.shade(ac, -0.05), mat: matW('lamellar', wear), trim: trimC, trimW: 0.012, trimMat: trimM });
  else if (ak === 'leather' || (ak === 'none' && !torsoBare && L.tunic !== false && !fem)) skirt(hipY - (hipY - kneeY) * 0.38, { off: 0.008, col: ak === 'leather' ? K3.shade(ac, -0.08) : ac, mat: ak === 'leather' ? 'leather' : 'cloth', trim: K3.shade(ac, -0.3), trimW: 0.01 });
  else if (fem && ak === 'none' && !torsoBare && !legsBare) skirt(ankleY + 0.12, { off: 0.01, col: ac, mat: 'cloth', trim: at, trimW: 0.02 });
  if (L.helm === 'plate' || L.helm === 'chain' || L.helm === 'leather') helmet(L, sh, N, rest, cat, add, solid, X, Y, Z);
  // the skin under a covering piece is not drawn (it never shows and cannot poke through)
  const hidden = new Uint8Array(A.NV); for (const { field, FV } of covers) for (let v = 0; v < A.NV; v++) { if (hidden[v]) continue; let x = FV[v]; if (x !== x) x = field(v); if (x >= 0.012) hidden[v] = 1; }
  return { pieces, hidden, cat };
}
// ---------------------------------------------------------------- one person, ready to animate
const EYE_COLS = ['#5a3a22', '#6a4a2a', '#4a6a8a', '#5a7a5a', '#7a6a4a', '#3a2a1e', '#6a7a8a'];
const cache = new Map();
export const HUMAN_PARENT = (() => { const P = { hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', shL: 'chest', armL: 'shL', foreL: 'armL', handL: 'foreL', shR: 'chest', armR: 'shR', foreR: 'armR', handR: 'foreR', thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR', capeA: 'chest', capeB: 'capeA', tail1: 'hips', tail2: 'tail1', tail3: 'tail2', wingL: 'chest', wingR: 'chest' }; for (const S of ['L', 'R']) for (const f of ['th', 'f1', 'f2', 'f3', 'f4']) { P[f + S + '1'] = 'hand' + S; P[f + S + '2'] = f + S + '1'; } return P; })();
// townsfolk come in a handful of body-and-face variants per outfit (picked by name), so most of them share a
// built body from the cache instead of each costing ~100 ms to make; heroes with a chosen face keep their own
const BODY_VARIANTS = 6;
function nameVariant(L) { if (L.face != null || L.app || L.hero) return L.name || ''; return 'v' + (hashStr(L.name || '') % BODY_VARIANTS); }
export function humanKey(look, kind) {
  const L = look || {}; const a = L.armor || {};
  return [kind, nameVariant(L), L.race, L.gender, L.skin, L.hair, L.hairStyle, L.cls, a.kind, a.col, a.trim, L.robe, L.bare, L.helm, L.hat, L.hood, L.beard, L.tusk, L.ears, L.eyesCol, L.width, L.pants, L.barefoot, L.old, L.warpaint, L.face, L.noShirt, L.shirtOnly, L.noPants, L.wrap, L.tall, JSON.stringify(L.morph || null), L.beardStyle, L.scar, L.tattoo, L.tatCol, L.iris, a.tier, L.helmStyle, L.helmCrest, L.helmTier, L.helmCol].join('|');
}
function skinGeometry(sh, N, hidden) {
  const NS = A.NS, map = A.map;
  const pos = new Float32Array(NS * 3), nor = new Float32Array(NS * 3), si = new Uint8Array(NS * 4), sw = new Uint8Array(NS * 4);
  for (let i = 0; i < NS; i++) { const v = map[i]; for (let k = 0; k < 3; k++) { pos[i * 3 + k] = sh.P[v * 3 + k]; nor[i * 3 + k] = N[v * 3 + k]; } for (let k = 0; k < 4; k++) { si[i * 4 + k] = A.skinI[v * 4 + k]; sw[i * 4 + k] = A.skinW[v * 4 + k]; } }
  const attrs = { position: new THREE.BufferAttribute(pos, 3), normal: new THREE.BufferAttribute(nor, 3), uv: new THREE.BufferAttribute(A.uv, 2), skinIndex: new THREE.BufferAttribute(si, 4), skinWeight: new THREE.BufferAttribute(sw, 4, true) };
  const keep = (ix) => { const o = []; for (let i = 0; i < ix.length; i += 3) { const a = map[ix[i]], b = map[ix[i + 1]], c = map[ix[i + 2]]; if (hidden[a] && hidden[b] && hidden[c]) continue; o.push(ix[i], ix[i + 1], ix[i + 2]); } return new THREE.Uint16BufferAttribute(o, 1); };
  return ['body', 'body_lod1', 'body_lod2'].map((k) => { const g = new THREE.BufferGeometry(); for (const n in attrs) g.setAttribute(n, attrs[n]); g.setIndex(keep(A.idx[k])); g.computeBoundingSphere(); g.boundingSphere.radius *= 1.5; return g; });
}
export function humanGeometry(look, kind, accessories) {
  const key = humanKey(look, kind); let c = cache.get(key); if (c) return c;
  const L = look || {};
  const spec = bodySpec(L, kind); const sh = shapeBody(spec); const N = normalsFor(sh.P, A.tri.body);
  const rest = skeletonRest(sh);
  const fit = outfit(L, kind, sh, N, rest);
  const skin = skinGeometry(sh, N, fit.hidden);
  const uniforms = skinUniforms(L, kind, sh, spec);
  const glow = !!L.eyesCol || kind === 'zombie' || kind === 'deathknight';
  const iris = L.eyesCol || L.iris || (L.race === 'darkelf' ? '#b8302a' : /elf/.test(L.race || '') ? ['#4a7aaa', '#5a8a5a', '#7a5aa8'][spec.seed % 3] : EYE_COLS[spec.seed % EYE_COLS.length]);
  const eyes = eyeGeometry(sh, A.BI.head);
  const hair = strandCards(L, kind, sh, spec, N, rest);
  const gar = fit.pieces.length ? mergeSimple(fit.pieces) : null; if (gar) { gar.computeBoundingSphere(); gar.boundingSphere.radius *= 1.5; }
  // tusks: curved fangs from the lower lip
  const lm = sh.lm; let tusks = null;
  if (L.tusk) { const gs = []; for (const sx of [1, -1]) { const g = new THREE.ConeGeometry(0.0055, 0.03, 8, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 0.03 + 0.5; p.setZ(i, p.getZ(i) - y * y * 0.006); } g.computeVertexNormals(); g.rotateZ(-sx * 0.25); g.rotateX(-0.25); g.translate(Math.abs(lm.corner.x) * 0.85 * sx, lm.mouth.y + 0.008, lm.mouth.z - 0.004); gs.push(g.toNonIndexed()); }
    tusks = mergeSimple(gs.map((g) => { g.setIndex([...Array(g.attributes.position.count).keys()]); const n = g.attributes.position.count; g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.92), 3)); g.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => [0, 0.5, 8][i % 3]), 3)); g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint8Array(n * 4).map((_, i) => (i % 4 ? 0 : A.BI.head)), 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(new Uint8Array(n * 4).map((_, i) => (i % 4 ? 0 : 255)), 4, true)); delete g.attributes.uv; return g; })); }
  // hands: where a weapon sits, and how the fingers curl
  const hands = {};
  for (const S of ['L', 'R']) {
    const r = (b) => new V3(...rest[b]); const wr = r('hand' + S), i1 = r('f1' + S + '1'), p1 = r('f4' + S + '1'), m1 = r('f2' + S + '1'), m2 = r('f2' + S + '2'), t1 = r('th' + S + '1'), t2 = r('th' + S + '2');
    const across = i1.clone().sub(p1).normalize(); const fdir = m2.clone().sub(m1).normalize();
    const sx = S === 'L' ? 1 : -1; const palmN = new V3(-sx, 0, 0);
    let axis = across.clone(); { const d = fdir.clone().applyAxisAngle(axis, 0.3); if (d.dot(palmN) < fdir.dot(palmN)) axis.negate(); }
    const tdir = t2.clone().sub(t1).normalize(); let tax = new V3().crossVectors(tdir, palmN).normalize(); { const d = tdir.clone().applyAxisAngle(tax, 0.3); if (d.dot(across.clone().negate()) < tdir.dot(across.clone().negate())) tax.negate(); }
    const grip = m1.clone().lerp(wr, 0.25).addScaledVector(palmN, 0.022).sub(wr);
    hands[S] = { axis, tax, grip: [grip.x, grip.y, grip.z] };
  }
  const P = { h: 1, w: 1, leg: rest.hips[1] / 0.97, arm: 1, head: 1, hunch: spec.hunch, belly: 0, neck: 1, hand: 1, fem: spec.fem };
  c = { key, skin, eyes, hair, gar, tusks, rest, P, top: lm.headTop, uniforms, iris, glow, hands, headFrame: headFrame(sh), lm, hairCol: L.hair || '#3a2a1e', spec };
  // hats, helmets, crowns, capes and tails come from the classic builder, placed on this head
  if (accessories) c.acc = accessories(c);
  cache.set(key, c);
  return c;
}
const skinMats = new Map(), eyeMats = new Map(), hairMats = new Map();
export function makeHumanRig(look, kind, accessories, charMat) {
  const G = humanGeometry(look, kind, accessories);
  const names = A.B; const bones = names.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  const idx = Object.fromEntries(names.map((n, i) => [n, i]));
  bones.forEach((b, i) => { const n = names[i]; const p = G.rest[n]; const par = HUMAN_PARENT[n]; if (par) { const pp = G.rest[par]; b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]); bones[idx[par]].add(b); } else b.position.set(p[0], p[1], p[2]); });
  let sm = skinMats.get(G.key); if (!sm) { sm = skinMaterial(G.uniforms); skinMats.set(G.key, sm); }
  const mesh = new THREE.SkinnedMesh(G.skin[0], sm); mesh.add(bones[0]); mesh.updateMatrixWorld(true); const skel = new THREE.Skeleton(bones); mesh.bind(skel);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const extra = (geo, mat, shadow = true) => { if (!geo) return null; const m = new THREE.SkinnedMesh(geo, mat); m.bind(skel, mesh.bindMatrix); m.castShadow = shadow; m.receiveShadow = true; mesh.add(m); return m; };
  const lods = [mesh, extra(G.skin[1], sm), extra(G.skin[2], sm)]; lods[1].visible = lods[2].visible = false;
  const ek = G.iris + (G.glow ? 'g' : ''); let em = eyeMats.get(ek); if (!em) { em = eyeMaterial(G.iris, G.glow); eyeMats.set(ek, em); }
  const eyes = extra(G.eyes, em, false);
  let hm = hairMats.get('h'); if (!hm) { hm = hairMaterial('#ffffff'); hm.vertexColors = true; hairMats.set('h', hm); }
  const hair = extra(G.hair, hm);
  const gm = garmentMaterial();
  const gar = extra(G.gar, gm);
  extra(G.tusks, gm);
  if (G.acc) extra(G.acc, gm);
  const rig = { mesh, bones: Object.fromEntries(bones.map((b) => [b.name, b])), rest: G.rest, P: G.P, top: G.top, kind, look, held: {}, t: Math.random() * 10, phase: 0, deadT: 0, atkPrev: 0, swing: 0, swingKind: null, hands: G.hands, human: true, lods, eyes, hair, lod: 0 };
  rig.setLod = (d) => { const l = d < 14 ? 0 : d < 38 ? 1 : 2; if (l === rig.lod) return; rig.lod = l; lods.forEach((m, i) => (m.visible = i === l)); if (eyes) eyes.visible = l < 2; if (hair) hair.visible = l < 2 || !!G.hair; };
  return rig;
}

// ---------------------------------------------------------------- your own arms in first person
// the same arm, sleeve and glove as the body (cut out of it), on a little skeleton of its own
export function firstPersonArm(look, kind, S, accessories) {
  const G = humanGeometry(look, kind, accessories);
  const chain = ['arm' + S, 'fore' + S, 'hand' + S]; for (const f of ['th', 'f1', 'f2', 'f3', 'f4']) chain.push(f + S + '1', f + S + '2');
  const loc = new Map(chain.map((b, i) => [A.BI[b], i]));
  const cut = (geo) => {
    if (!geo) return null; const si = geo.attributes.skinIndex.array, sw = geo.attributes.skinWeight.array, ix = geo.index.array; const keep = [];
    const inChain = (v) => loc.has(si[v * 4]);
    for (let i = 0; i < ix.length; i += 3) if (inChain(ix[i]) && inChain(ix[i + 1]) && inChain(ix[i + 2])) keep.push(ix[i], ix[i + 1], ix[i + 2]);
    if (!keep.length) return null;
    const g = new THREE.BufferGeometry(); for (const n in geo.attributes) if (n !== 'skinIndex') g.setAttribute(n, geo.attributes[n]);
    const nsi = new Uint8Array(si.length); for (let i = 0; i < si.length; i++) { const l = loc.get(si[i]); nsi[i] = l == null ? 0 : l; }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(nsi, 4)); g.setIndex(keep); return g;
  };
  const bones = chain.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  const par = (n) => (n === 'arm' + S ? null : HUMAN_PARENT[n]);
  bones.forEach((b, i) => { const n = chain[i]; const p = G.rest[n]; const pn = par(n); if (pn) { const pp = G.rest[pn]; b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]); bones[chain.indexOf(pn)].add(b); } else b.position.set(p[0], p[1], p[2]); });
  let sm = skinMats.get(G.key); if (!sm) { sm = skinMaterial(G.uniforms); skinMats.set(G.key, sm); }
  const empty = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(9), 3)); g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint8Array(12), 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(new Uint8Array(12).fill(0).map((_, i) => (i % 4 ? 0 : 255)), 4, true)); return g; };
  const skinG = cut(G.skin[0]); const mesh = new THREE.SkinnedMesh(skinG || empty(), sm); mesh.add(bones[0]); mesh.updateMatrixWorld(true); const skel = new THREE.Skeleton(bones); mesh.bind(skel); mesh.frustumCulled = false;
  const garG = cut(G.gar); if (garG) { const m = new THREE.SkinnedMesh(garG, garmentMaterial()); m.bind(skel, mesh.bindMatrix); m.frustumCulled = false; mesh.add(m); }
  const grip = new THREE.Group(); grip.position.set(...G.hands[S].grip); bones[2].add(grip);
  const B = Object.fromEntries(bones.map((b) => [b.name, b]));
  return { mesh, shoulder: bones[0], elbow: bones[1], wrist: bones[2], grip, held: null, restArm: G.rest['arm' + S], hand: G.hands[S], B, S,
    curl(c) { const h = G.hands[S]; for (let f = 1; f <= 4; f++) { const sp = (f - 2.5) * 0.05; B['f' + f + S + '1'].quaternion.setFromAxisAngle(h.axis, c * (0.95 + sp)); B['f' + f + S + '2'].quaternion.setFromAxisAngle(h.axis, c * (1.05 + sp)); } B['th' + S + '1'].quaternion.setFromAxisAngle(h.tax, c * 0.35); B['th' + S + '2'].quaternion.setFromAxisAngle(h.tax, c * 0.55); } };
}

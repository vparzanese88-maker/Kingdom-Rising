// Kingdom Rising 3D — converts the MakeHuman base human (CC0) into one compact file the game loads.
// Usage: (cd kingdom-rising-3d/tools/makehuman && npm install && node build.mjs)
// Downloads the CC0 MakeHuman base mesh, its skeleton weights and a set of morph targets from the
// MakeHuman repository, maps the 163 MakeHuman bones onto the game's skeleton (plus finger bones),
// builds lower-detail index buffers for distant characters and writes ../../assets/human/mh.json + mh.bin.
// The game shapes every race, body and face from these at run time (js3d/human.js).
import fs from 'node:fs';
import path from 'node:path';
import { MeshoptSimplifier } from 'meshoptimizer';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const CACHE = path.join(HERE, '.cache');
const OUT = path.join(HERE, '../../assets/human');
const SRC = 'https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/';
fs.mkdirSync(CACHE, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });

async function get(rel) {
  const f = path.join(CACHE, rel.replace(/\//g, '__'));
  if (fs.existsSync(f)) { const t = fs.readFileSync(f, 'utf8'); return t === '#404' ? null : t; }
  const r = await fetch(SRC + rel);
  if (!r.ok) { fs.writeFileSync(f, '#404'); return null; }
  const t = await r.text(); fs.writeFileSync(f, t); return t;
}

// ---------- the game's skeleton ----------
const FINGERS = ['th', 'f1', 'f2', 'f3', 'f4'];
const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'shL', 'armL', 'foreL', 'handL', 'shR', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'capeA', 'capeB', 'tail1', 'tail2', 'tail3', 'wingL', 'wingR'];
for (const s of ['L', 'R']) for (const f of FINGERS) BONES.push(f + s + '1', f + s + '2');
const BI = Object.fromEntries(BONES.map((b, i) => [b, i]));
// MakeHuman bone -> game bone (and the MakeHuman joint that is the game bone's pivot)
function mapBone(mh) {
  const side = mh.endsWith('.L') ? 'L' : mh.endsWith('.R') ? 'R' : '';
  const n = mh.replace(/\.(L|R)$/, '');
  if (n === 'root' || n === 'spine05' || n === 'spine04' || n === 'pelvis') return 'hips';
  if (n === 'spine03' || n === 'spine02') return 'spine';
  if (n === 'spine01' || n === 'breast') return 'chest';
  if (/^neck0/.test(n)) return 'neck';
  if (n === 'clavicle' || n === 'shoulder01') return 'sh' + side;
  if (/^upperarm/.test(n)) return 'arm' + side;
  if (/^lowerarm/.test(n)) return 'fore' + side;
  if (n === 'wrist' || /^metacarpal/.test(n)) return 'hand' + side;
  let m = /^finger(\d)-(\d)$/.exec(n);
  if (m) { const f = FINGERS[+m[1] - 1]; return f + side + (m[2] === '1' ? '1' : '2'); }
  if (/^upperleg/.test(n)) return 'thigh' + side;
  if (/^lowerleg/.test(n)) return 'shin' + side;
  if (n === 'foot' || /^toe/.test(n)) return 'foot' + side;
  return 'head'; // head, jaw, eyes, tongue and the face muscles
}
// where each game bone pivots: the head joint of this MakeHuman bone
const PIVOT = { hips: 'spine05', spine: 'spine03', chest: 'spine01', neck: 'neck01', head: 'head' };
for (const s of ['L', 'R']) {
  Object.assign(PIVOT, { ['sh' + s]: 'clavicle.' + s, ['arm' + s]: 'upperarm01.' + s, ['fore' + s]: 'lowerarm01.' + s, ['hand' + s]: 'wrist.' + s, ['thigh' + s]: 'upperleg01.' + s, ['shin' + s]: 'lowerleg01.' + s, ['foot' + s]: 'foot.' + s });
  FINGERS.forEach((f, i) => { PIVOT[f + s + '1'] = `finger${i + 1}-1.${s}`; PIVOT[f + s + '2'] = `finger${i + 1}-2.${s}`; });
}

// ---------- morph targets ----------
const TARGETS = [];
for (const e of ['caucasian', 'african', 'asian']) for (const g of ['male', 'female']) TARGETS.push([`${e}-${g}-young`, `macrodetails/${e}-${g}-young.target`]);
for (const g of ['male', 'female']) {
  for (const m of ['min', 'average', 'max']) for (const w of ['min', 'average', 'max']) if (!(m === 'average' && w === 'average')) TARGETS.push([`${g}-${m}muscle-${w}weight`, `macrodetails/universal-${g}-young-${m}muscle-${w}weight.target`]);
  for (const h of ['min', 'max']) TARGETS.push([`${g}-${h}height`, `macrodetails/height/${g}-young-averagemuscle-averageweight-${h}height.target`]);
  for (const p of ['ideal', 'uncommon']) TARGETS.push([`${g}-${p}proportions`, `macrodetails/proportions/${g}-young-averagemuscle-averageweight-${p}proportions.target`]);
}
TARGETS.push(['female-maxcup', 'breast/female-young-averagemuscle-averageweight-maxcup-averagefirmness.target'], ['female-mincup', 'breast/female-young-averagemuscle-averageweight-mincup-averagefirmness.target']);
const PAIRS = { nose: ['nose-scale-vert', 'nose-scale-horiz', 'nose-scale-depth', 'nose-trans-up', 'nose-trans-forward', 'nose-hump', 'nose-point-width', 'nose-nostrils-width', 'nose-width1', 'nose-flaring'],
  mouth: ['mouth-scale-horiz', 'mouth-scale-vert', 'mouth-lowerlip-volume', 'mouth-upperlip-volume', 'mouth-trans-forward', 'mouth-trans-up', 'mouth-cupidsbow-width'],
  chin: ['chin-prominent', 'chin-width', 'chin-height', 'chin-bones'], cheek: ['l-cheek-bones', 'r-cheek-bones', 'l-cheek-volume', 'r-cheek-volume', 'l-cheek-inner', 'r-cheek-inner'],
  eyebrows: ['eyebrows-trans-forward', 'eyebrows-trans-up', 'eyebrows-angle'], forehead: ['forehead-trans-forward', 'forehead-scale-vert', 'forehead-nubian'],
  head: ['head-oval', 'head-square', 'head-round', 'head-age', 'head-fat', 'head-scale-vert', 'head-scale-horiz', 'head-scale-depth', 'head-back-scale'],
  neck: ['neck-scale-horiz', 'neck-scale-depth'], torso: ['torso-vshape', 'torso-scale-depth'], stomach: ['stomach-pregnant'],
  ears: ['l-ear-shape-pointed', 'r-ear-shape-pointed', 'l-ear-scale', 'r-ear-scale', 'l-ear-scale-vert', 'r-ear-scale-vert', 'l-ear-trans-up', 'r-ear-trans-up', 'l-ear-trans-backward', 'r-ear-trans-backward', 'l-ear-flap', 'r-ear-flap', 'l-ear-lobe'],
  eyes: ['l-eye-height2', 'r-eye-height2', 'l-eye-move', 'r-eye-move', 'l-eye-scale', 'r-eye-scale', 'l-eye-corner1', 'r-eye-corner1', 'l-eye-bag', 'r-eye-bag', 'l-eye-epicanthus', 'r-eye-epicanthus'],
  armslegs: ['l-hand-scale', 'r-hand-scale'] };
const SUFFIXES = [['-incr', '-decr'], ['-up', '-down'], ['-convex', '-concave'], ['-in', '-out'], ['-forward', '-backward'], ['', '']];
for (const dir in PAIRS) for (const base of PAIRS[dir]) {
  // most details come as a pair (incr/decr, up/down...); the loader tries the usual endings
  TARGETS.push(['?' + dir + '/' + base, null]);
}

function parseTarget(txt) {
  const idx = [], d = [];
  for (const line of txt.split('\n')) { if (!line || line[0] === '#') continue; const p = line.trim().split(/\s+/); if (p.length < 4) continue; idx.push(+p[0]); d.push(+p[1] * 0.1, +p[2] * 0.1, +p[3] * 0.1); }
  return { idx, d };
}

// ---------- main ----------
const obj = await get('3dobjs/base.obj');
const skel = JSON.parse(await get('rigs/default.mhskel'));
const wts = JSON.parse(await get('rigs/default_weights.mhw')).weights;
const V = [], VT = [], faces = []; let group = '';
for (const line of obj.split('\n')) {
  if (line.startsWith('v ')) { const p = line.split(/\s+/); V.push(+p[1] * 0.1, +p[2] * 0.1, +p[3] * 0.1); }
  else if (line.startsWith('vt ')) { const p = line.split(/\s+/); VT.push(+p[1], +p[2]); }
  else if (line.startsWith('g ')) group = line.slice(2).trim();
  else if (line.startsWith('f ')) { const p = line.trim().split(/\s+/).slice(1).map((s) => s.split('/').map((x) => +x - 1)); faces.push({ g: group, v: p.map((x) => x[0]), t: p.map((x) => (x.length > 1 && !isNaN(x[1]) ? x[1] : -1)) }); }
}
const NV = V.length / 3;
// feet on the ground
let minY = 1e9; const bodyV = new Set(); for (const f of faces) if (f.g === 'body') for (const v of f.v) bodyV.add(v);
for (const v of bodyV) minY = Math.min(minY, V[v * 3 + 1]);
for (let i = 0; i < NV; i++) V[i * 3 + 1] -= minY;
console.log('vertices', NV, 'uvs', VT.length / 2, 'faces', faces.length, 'feet at', minY.toFixed(3));

// split vertices by (v, vt) so every rendered vertex has one uv
const splitKey = new Map(); const map = [], uv = [];
const PART_OF = (g) => g === 'body' ? 'body' : g === 'helper-tights' ? 'tights' : g === 'helper-skirt' ? 'skirt' : g === 'helper-hair' ? 'hair' : /eyelashes/.test(g) ? 'lashes' : g === 'helper-l-eye' ? 'eyeL' : g === 'helper-r-eye' ? 'eyeR' : /teeth/.test(g) ? 'teeth' : null;
const parts = {};
for (const f of faces) {
  const part = PART_OF(f.g); if (!part) continue;
  const ids = f.v.map((v, k) => { const t = f.t[k]; const key = v * 100000 + (t < 0 ? 99999 : t); let i = splitKey.get(key); if (i == null) { i = map.length; splitKey.set(key, i); map.push(v); uv.push(t < 0 ? 0 : VT[t * 2], t < 0 ? 0 : VT[t * 2 + 1]); } return i; });
  const arr = (parts[part] = parts[part] || []);
  for (let k = 1; k < ids.length - 1; k++) arr.push(ids[0], ids[k], ids[k + 1]);
}
const NS = map.length; console.log('split vertices', NS, Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.length / 3])));
if (NS > 65535) throw new Error('too many vertices for 16-bit indices');

// level of detail: the same vertices, fewer triangles
await MeshoptSimplifier.ready;
const sPos = new Float32Array(NS * 3); for (let i = 0; i < NS; i++) for (let k = 0; k < 3; k++) sPos[i * 3 + k] = V[map[i] * 3 + k];
const lods = {};
for (const p of ['body', 'tights', 'skirt', 'hair']) {
  const src = new Uint32Array(parts[p]); lods[p] = [];
  for (const ratio of [0.35, 0.12]) {
    const [ix, err] = MeshoptSimplifier.simplify(src, sPos, 3, Math.floor(src.length * ratio / 3) * 3, 0.02, ['LockBorder']);
    lods[p].push(Array.from(ix)); console.log('lod', p, ratio, ix.length / 3, 'tris, error', err.toFixed(4));
  }
}

// skin weights on the game skeleton
const acc = Array.from({ length: NV }, () => new Map());
const twist = new Float32Array(NV);
for (const mh in wts) {
  const gb = BI[mapBone(mh)];
  const tw = /^(lowerarm02|wrist|metacarpal|finger)/.test(mh) ? 1 : 0;
  for (const [v, w] of wts[mh]) { const m = acc[v]; m.set(gb, (m.get(gb) || 0) + w); if (tw) twist[v] += w; }
}
const skinI = new Uint8Array(NV * 4), skinW = new Uint8Array(NV * 4); let unweighted = 0;
for (let v = 0; v < NV; v++) {
  let e = [...acc[v].entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (!e.length) { unweighted++; e = [[BI.head, 1]]; }
  const s = e.reduce((a, x) => a + x[1], 0); let left = 255;
  // quantise to bytes that add up to exactly 255
  e.forEach(([b, w], k) => { skinI[v * 4 + k] = b; const q = k === e.length - 1 ? Math.max(0, left) : Math.min(left, Math.round((w / s) * 255)); skinW[v * 4 + k] = q; left -= q; });
}
console.log('vertices without weights', unweighted);

// joints: each MakeHuman joint is the average of a few vertices
const joints = {}; for (const k in skel.joints) joints[k] = skel.joints[k];
const pivots = {}; for (const b in PIVOT) pivots[b] = skel.bones[PIVOT[b]].head;
const bonesMH = Object.fromEntries(Object.entries(skel.bones).map(([k, b]) => [k, { head: b.head, tail: b.tail, parent: b.parent }]));

// targets
const tlist = []; const tIdx = [], tD = [];
async function addTarget(name, rel) { const t = await get('targets/' + rel); if (!t) return false; const { idx, d } = parseTarget(t); if (!idx.length) return false; tlist.push({ name, off: tIdx.length, n: idx.length }); tIdx.push(...idx); tD.push(...d); return true; }
for (const [name, rel] of TARGETS) {
  if (rel) { if (!(await addTarget(name, rel))) console.log('missing', rel); continue; }
  const [dir, base] = name.slice(1).split('/');
  let found = false;
  for (const [a, b] of SUFFIXES) {
    const okA = await addTarget(base + a, `${dir}/${base}${a}.target`); if (!okA) continue;
    if (b && b !== a) await addTarget(base + b, `${dir}/${base}${b}.target`);
    found = true; break;
  }
  if (!found) console.log('missing detail', dir, base);
}
console.log('targets', tlist.length, 'entries', tIdx.length);

// ---------- write ----------
const chunks = []; let off = 0; const layout = {};
function put(name, arr) { const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(new Uint8Array(pad)); off += pad; } const b = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); layout[name] = [off, arr.length, arr.constructor.name]; chunks.push(b); off += b.byteLength; }
put('pos', new Float32Array(V)); put('uv', new Float32Array(uv)); put('map', new Uint16Array(map));
put('skinI', skinI); put('skinW', skinW); put('twist', Uint8Array.from(twist, (x) => Math.round(Math.min(1, x) * 255)));
for (const p in parts) put('idx_' + p, new Uint16Array(parts[p]));
for (const p in lods) lods[p].forEach((ix, k) => put(`idx_${p}_lod${k + 1}`, new Uint16Array(ix)));
put('tIdx', new Uint16Array(tIdx)); put('tD', Int16Array.from(tD, (x) => Math.round(x * 20000)));
const meta = { version: 1, source: 'MakeHuman 1.x base mesh, default skeleton weights and targets, released as CC0 by Data Collection AB, Joel Palmius and Jonas Hauquier (www.makehumancommunity.org)', license: 'CC0', NV, NS, deltaUnit: 1 / 20000, bones: BONES, pivots, joints, bonesMH, targets: tlist, layout };
fs.writeFileSync(path.join(OUT, 'mh.bin'), Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength))));
fs.writeFileSync(path.join(OUT, 'mh.json'), JSON.stringify(meta));
fs.writeFileSync(path.join(OUT, 'LICENSE.txt'), 'The human base mesh, skeleton weights and morph targets in mh.bin / mh.json come from MakeHuman\n(www.makehumancommunity.org) and were released under CC0 1.0 (public domain) by Data Collection AB,\nJoel Palmius and Jonas Hauquier. Converted for Kingdom Rising 3D by tools/makehuman/build.mjs.\n');
console.log('wrote', (off / 1e6).toFixed(2), 'MB');

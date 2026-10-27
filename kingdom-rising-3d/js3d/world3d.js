// Kingdom Rising 3D — the built world: per-area groups of buildings, walls, decorations and plants,
// with distance culling, level of detail, doors, flags, smoke, fountains, boats and the torch lights
import { THREE, K3, TILE, TS, PX } from './core.js';
import { geo, T } from './geo.js';
import { MB, dispose } from './mb.js';
import { mats } from './mats.js';
import { buildStructuresIn, buildFlags, structs, resetStructs } from './structures.js';
import { buildProps, makeAnimProp, VEG_KINDS } from './props.js';
import { buildVeg, buildOutcrops, setVegLod, stumpFor, setHidden } from './veg.js';
import { staticBillboards, fx } from './fx.js';
import { buildLights, updateLights } from './lights.js';

const KR = window.KR, D = KR.D, W = KR.W, G = KR.G;
const CH = 32;
const root = new THREE.Group(); root.name = 'world'; K3.scene.add(root);
fx.init();

const chunks = new Map(); // key -> chunk
let pending = [], pendingIdx = null;
let anims = [], flagGroup = null, allFlames = [], torchFlames = null;
const key = (cx, cy) => cx + ',' + cy;

function decorIndex() {
  const idx = new Map();
  for (const d of W.decor) { const k = key(Math.floor(d.tx / CH), Math.floor(d.ty / CH)); let a = idx.get(k); if (!a) idx.set(k, (a = [])); a.push(d); }
  return idx;
}
function sig(list) { let h = list ? list.length : 0; if (list) for (const d of list) h = (h * 31 + d.tx * 7 + d.ty * 13 + d.kind.length) | 0; return h; }

function buildChunk(cx, cy, list, withStructs = true) {
  const x0 = cx * CH, y0 = cy * CH, x1 = x0 + CH, y1 = y0 + CH;
  const c = chunks.get(key(cx, cy)) || { cx, cy, x: (cx + 0.5) * CH * TILE, z: (cy + 0.5) * CH * TILE };
  const grp = new THREE.Group(); grp.name = 'chunk ' + cx + ',' + cy;
  const out = { flames: [], smokes: [], emitters: [], flags: [], signs: [], anim: [] };
  if (withStructs) { c.structs = buildStructuresIn(x0, y0, x1, y1); }
  if (c.structs) grp.add(c.structs);
  // decorations
  const mb = new MB();
  buildProps(mb, list || [], out);
  const pg = mb.build(); grp.add(pg);
  c.veg = buildVeg(list || [], out); for (const m of c.veg) grp.add(m);
  const oc = buildOutcrops(x0, y0, x1, y1); for (const m of oc) grp.add(m);
  // signposts with names on them
  for (const s of out.signs) grp.add(signpost(s));
  if (out.flags.length) buildFlags(out.flags, grp);
  const bb = staticBillboards(out.flames, true); if (bb) grp.add(bb);
  c.flames = out.flames; c.smokes = out.smokes; c.emitters = out.emitters; c.list = list || []; c.sig = sig(list);
  c.harvest = (list || []).filter((d) => d.kind === 'boulder' || ['oak', 'elmwood', 'darkoak', 'birch', 'willow', 'pine', 'snowpine', 'palm'].includes(d.kind));
  c.stumps = new Map();
  for (const a of out.anim) { const o = makeAnimProp(a); K3.scene.add(o); anims.push(o); }
  grp.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) { o.matrixAutoUpdate = false; o.updateMatrix(); } });
  grp.updateMatrixWorld(true);
  if (c.group) { root.remove(c.group); disposeGroup(c.group, c.structs); }
  c.group = grp; c.lod = -1;
  root.add(grp);
  chunks.set(key(cx, cy), c);
  return c;
}
function disposeGroup(g, keep) { g.traverse((o) => { if (keep && isInside(o, keep)) return; if (o.geometry && !o.userData.keepGeo && !o.isInstancedMesh) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose && o.dispose(); }); }
function isInside(o, parent) { for (let p = o; p; p = p.parent) if (p === parent) return true; return false; }

const signMats = new Map();
function signpost(s) {
  const tex = K3.canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#8a6440'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a2614'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = '#2a1a0a'; g.font = 'bold 26px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; let nm = s.name || ''; while (g.measureText(nm).width > w - 24 && nm.length > 3) nm = nm.slice(0, -1); g.fillText(nm, w / 2, h / 2 + 2); });
  const side = new THREE.MeshStandardMaterial({ color: 0x5a3e24, roughness: 0.9 }); const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.06), [side, side, side, side, face, face]);
  m.position.set(s.x, s.y, s.z); m.rotation.y = s.ry || 0; m.castShadow = true;
  return m;
}

export const world3d = {
  build() {
    const t0 = performance.now();
    for (const c of chunks.values()) { if (c.group) { root.remove(c.group); disposeGroup(c.group); } }
    chunks.clear();
    for (const o of anims) { K3.scene.remove(o); dispose(o); } anims = [];
    if (flagGroup) { root.remove(flagGroup); dispose(flagGroup); flagGroup = null; }
    if (torchFlames) { root.remove(torchFlames); torchFlames = null; }
    fx.clear();
    resetStructs();
    const idx = decorIndex();
    const ncx = Math.ceil(W.W / CH), ncy = Math.ceil(W.H / CH);
    // the areas around the hero now, the rest a few at a time over the next frames
    const p = G.player; const pcx = p ? Math.floor(p.x / TS / CH) : ncx / 2, pcy = p ? Math.floor(p.y / TS / CH) : ncy / 2;
    const all = []; for (let cy = 0; cy < ncy; cy++) for (let cx = 0; cx < ncx; cx++) all.push([cx, cy, Math.hypot(cx - pcx, cy - pcy)]);
    all.sort((a, b) => a[2] - b[2]);
    pending = [];
    for (const [cx, cy, d] of all) { if (d <= 3.2) buildChunk(cx, cy, idx.get(key(cx, cy))); else pending.push([cx, cy]); }
    pendingIdx = idx;
    this.finish();
    console.log(`3D buildings and props: ${Math.round(performance.now() - t0)} ms, ${chunks.size} areas`);
  },
  // flags, wall torches and lights for everything built so far
  finish() {
    if (flagGroup) { root.remove(flagGroup); dispose(flagGroup); }
    flagGroup = new THREE.Group(); flagGroup.name = 'flags'; buildFlags(structs.flags, flagGroup); root.add(flagGroup);
    if (torchFlames) root.remove(torchFlames);
    const tf = []; for (const t of structs.torches) { tf.push({ x: t.x, y: t.y, z: t.z, w: 0.34, h: 0.66, r: 3.2, g: 1.6, b: 0.55, kind: 0 }); tf.push({ x: t.x, y: t.y + 0.2, z: t.z, w: 1.1, h: 1.1, r: 2.2, g: 1.2, b: 0.5, a: 0.35, kind: 1 }); }
    torchFlames = staticBillboards(tf, true); if (torchFlames) root.add(torchFlames);
    // torch brackets
    const mb = new MB(); for (const t of structs.torches) { mb.cyl('timber', t.x, t.y - 0.25, t.z, 0.05, 0.6, '#4a3220', 6); mb.cyl('metalv', t.x, t.y - 0.02, t.z, 0.08, 0.14, '#3a3a3e', 8); }
    const tg = mb.build(); flagGroup.add(tg);
    allFlames = []; for (const c of chunks.values()) allFlames.push(...c.flames); allFlames.push(...tf);
    buildLights(allFlames);
  },
  rebuildArea(x0, y0, w, h) {
    const idx = decorIndex();
    resetStructs();
    for (const c of chunks.values()) {
      const cx0 = c.cx * CH, cy0 = c.cy * CH;
      const touched = !(cx0 + CH < x0 - 2 || cx0 > x0 + w + 2 || cy0 + CH < y0 - 2 || cy0 > y0 + h + 2);
      if (touched) buildChunk(c.cx, c.cy, idx.get(key(c.cx, c.cy)), true);
      else { const old = c.structs; c.structs = buildStructuresIn(cx0, cy0, cx0 + CH, cy0 + CH); if (old) { c.group.remove(old); disposeGroup(old); } c.group.add(c.structs); c.structs.updateMatrixWorld(true); }
    }
    this.finish();
  },
  refreshDecor() {
    const idx = decorIndex();
    for (const c of chunks.values()) { const list = idx.get(key(c.cx, c.cy)); if (sig(list) !== c.sig) buildChunk(c.cx, c.cy, list, false); }
    this.finish();
  },
  update(dt, ctx) {
    if (pending.length) {
      const t0 = performance.now();
      while (pending.length && performance.now() - t0 < 7) { const [cx, cy] = pending.shift(); buildChunk(cx, cy, pendingIdx.get(key(cx, cy))); }
      if (!pending.length || K3.frame % 30 === 0) this.finish();
    }
    const cam = ctx.cam; const view = K3.quality.view;
    const treeNear = 85, treeFar = K3.quality.treeFar;
    for (const c of chunks.values()) {
      const d = Math.hypot(c.x - cam.x, c.z - cam.z) - CH * TILE * 0.71;
      const vis = d < view; if (c.group.visible !== vis) c.group.visible = vis;
      if (!vis) continue;
      const lod = d < treeNear ? 0 : 1;
      if (lod !== c.lod) { c.lod = lod; setVegLod(c.veg, lod); for (const m of c.veg) { m.castShadow = lod === 0 && !m.userData.small; } }
      for (const m of c.veg) if (m.userData.small) m.visible = d < 60;
      for (const m of c.veg) if (!m.userData.small && !m.userData.lods) m.visible = d < treeFar + 80;
      if (c.veg) for (const m of c.veg) if (m.userData.lods) m.visible = d < treeFar;
    }
    // doors swing open as you walk up
    for (const dr of structs.doors) { const a = dr.door.open * 1.45; if (dr.obj.rotation.y !== a) { dr.obj.rotation.y = a; dr.obj.updateMatrix(); dr.obj.updateMatrixWorld(true); } }
    mats.setNight(K3.sky ? K3.sky.darkness : 0);
    // the wind picks up in the rain
    K3.shared.uWind.value += ((G.weather && G.weather.type === 'rain' ? 1.9 : 1) - K3.shared.uWind.value) * Math.min(1, dt * 0.3);
    // boats bob on the water, the balloon floats
    for (const o of anims) { const a = o.userData.anim; if (a.kind === 'boat') { o.position.y = a.y + Math.sin(K3.time * 1.3 + a.v * 9) * 0.12 - 0.35; o.rotation.z = Math.sin(K3.time * 1.1 + a.v * 5) * 0.03; o.rotation.x = Math.sin(K3.time * 0.9 + a.v * 3) * 0.02; } else { o.position.y = a.y + Math.sin(K3.time * 0.8) * 0.25; } o.updateMatrixWorld(true); }
    // smoke, sparks, fountains and drips near the camera
    emitTick(dt, cam);
    // felled trees and quarried rocks
    harvestTick(cam);
    updateLights(dt, cam, ctx);
    fx.update(dt);
  },
  // the tree or rock under a ray (for gathering)
  pickDecor(ray) {
    let best = null, bd = 1e9;
    for (const c of chunks.values()) {
      if (Math.hypot(c.x - ray.origin.x, c.z - ray.origin.z) > 90) continue;
      for (const d of c.harvest) {
        const px = (d.tx + 0.5) * TS, py = (d.ty + 0.5) * TS; const x = px * PX, z = py * PX; const y0 = geo.floorAt(px, py);
        const tree = d.kind !== 'boulder'; const top = y0 + (tree ? 4 : 1.4), rad = tree ? 0.8 : 1.0;
        // distance from the ray to the vertical segment
        const ox = ray.origin.x - x, oz = ray.origin.z - z; const dx = ray.direction.x, dz = ray.direction.z;
        const a = dx * dx + dz * dz; if (a < 1e-6) continue; const t = -(ox * dx + oz * dz) / a; if (t < 0 || t > 40) continue;
        const cx = ox + dx * t, cz = oz + dz * t; const dist = Math.hypot(cx, cz); const y = ray.origin.y + ray.direction.y * t;
        if (dist < rad && y > y0 - 0.3 && y < top && t < bd) { bd = t; best = d; }
      }
    }
    return best;
  },
  chunks,
};
K3.world3d = world3d;

let emitAcc = 0;
function emitTick(dt, cam) {
  emitAcc += dt; if (emitAcc < 0.05) return; const step = emitAcc; emitAcc = 0;
  const t = K3.time;
  for (const c of chunks.values()) {
    if (!c.group.visible || Math.hypot(c.x - cam.x, c.z - cam.z) > 110) continue;
    for (const s of c.smokes) { if (Math.random() < step * (s.kind === 'forge' ? 3 : 4)) fx.smoke.emit({ x: s.x + (Math.random() - 0.5) * 0.3, y: s.y, z: s.z + (Math.random() - 0.5) * 0.3, vx: 0.25 + Math.random() * 0.2, vy: 0.9 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.2, life: 3.5 + Math.random() * 2, s0: 0.5, s1: 2.6, r: 0.55, g: 0.55, b: 0.58, a: 0.42, kind: 2, drag: 0.15 }); if (s.kind !== 'forge' && Math.random() < step * 3) fx.add.emit({ x: s.x, y: s.y - 0.8, z: s.z, vx: (Math.random() - 0.5) * 0.6, vy: 1.6 + Math.random(), vz: (Math.random() - 0.5) * 0.6, life: 1.2, s0: 0.06, s1: 0.02, r: 3, g: 1.2, b: 0.3, a: 1, kind: 3, drag: 0.5 }); }
    for (const e of c.emitters) {
      if (e.kind === 'fountain') for (let k = 0; k < 6; k++) { const a = Math.random() * 6.283, sp = 0.9 + Math.random() * 0.4; fx.add.emit({ x: e.p.x, y: e.p.y, z: e.p.z, vx: Math.cos(a) * sp, vy: 2.6 + Math.random() * 0.6, vz: Math.sin(a) * sp, life: 1.05, s0: 0.12, s1: 0.06, r: 0.5, g: 0.62, b: 0.75, a: 0.5, kind: 1, grav: 5.5, fade: 0 }); }
      else if (e.kind === 'drip') { if (Math.random() < step * 2) fx.add.emit({ x: e.p.x, y: e.p.y, z: e.p.z, vy: -0.5, life: 0.6, s0: 0.06, s1: 0.06, r: 0.3, g: 0.45, b: 0.3, a: 0.7, kind: 1, grav: 8 }); }
      else if (e.kind === 'portal') { for (let k = 0; k < 2; k++) { const a = Math.random() * 6.283; fx.add.emit({ x: e.p.x + Math.cos(a) * 1.4, y: e.p.y + Math.sin(a) * 1.7, z: e.p.z, vx: -Math.cos(a) * 0.8, vy: -Math.sin(a) * 0.9, life: 1.4, s0: 0.12, s1: 0.03, r: 2.4, g: 2, b: 1.2, kind: 3 }); } }
    }
  }
  // chimney smoke for buildings close by
  for (const ch of structs.chimneys) { if (Math.abs(ch.x - cam.x) > 90 || Math.abs(ch.z - cam.z) > 90) continue; if (Math.random() < step * 2.2) fx.smoke.emit({ x: ch.x, y: ch.y, z: ch.z, vx: 0.35 + Math.random() * 0.2, vy: 0.8 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.25, life: 5 + Math.random() * 2, s0: 0.6, s1: 3.2, r: ch.forge ? 0.35 : 0.62, g: ch.forge ? 0.33 : 0.62, b: ch.forge ? 0.32 : 0.66, a: 0.38, kind: 2, drag: 0.12 }); }
}
let harvestT = 0;
function harvestTick(cam) {
  harvestT -= K3.dt; if (harvestT > 0) return; harvestT = 0.5;
  for (const c of chunks.values()) {
    if (Math.hypot(c.x - cam.x, c.z - cam.z) > 120) continue;
    for (const d of c.harvest) {
      const cut = !!(d.cutUntil && d.cutUntil > G.now);
      if (cut && !c.stumps.has(d)) { setHidden(d, true); const s = stumpFor(d); c.group.add(s); c.stumps.set(d, s); }
      else if (!cut && c.stumps.has(d)) { setHidden(d, false); c.group.remove(c.stumps.get(d)); c.stumps.delete(d); }
    }
  }
}

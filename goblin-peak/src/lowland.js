// The lowlands around the village: one hundred small adventures for anyone who would rather not climb just now.
import * as THREE from 'three';
import * as M from './models.js';
import { Mob } from './entities.js';
import { TAU, rng } from './util.js';

const STORIES = [
  'Here lies Grubb\'s first boulder. It rolled uphill. Nobody knows how. Grubb was promoted.',
  'TURNIP FIELD. Property of Chieftain Grizzlegut. Trespassers will be fed turnips.',
  'On this spot Dame Hilda fell off nothing at all. A flat field. Witnesses were impressed.',
  'Goblin proverb: "If at first you do not succeed, roll something heavy at it."',
  'This stone marks the exact middle of nowhere. You are welcome.',
  'Nib\'s first shop stood here. It sold one rock. The rock was not for sale.',
  'Lost: one harpy. Answers to "OI". If found, do not approach. Especially do not hold snacks.',
  'The princess once skipped a stone seventeen times across the pond. The goblins have been sulking ever since.',
  'Beware of the chickens. They know what you did.',
  'You have read every stone in the lowlands. The stones are proud of you. Stones do not say that lightly.'];
const NAMES = { chest: 'Hidden treasure chest', dig: 'Buried treasure', stone: 'Story stone', pot: 'Goblin pot smashed', chicken: 'Runaway chicken caught', spire: 'Rock spire climbed', camp: 'Goblin camp cleared', race: 'Foot race won', bounce: 'Mushroom star reached', hoops: 'Glide course flown', troll: 'Troll sent packing' };
export const ACT_TOTAL = 100;

class Base { constructor(W, id, kind, x, z) { this.W = W; this.id = id; this.kind = kind; this.x = x; this.z = z; this.y = W.T.hAt(x, z); this.done = !!W.G.save.acts[id]; }
  near(r = 2.8) { const p = this.W.G.player.pos; return Math.hypot(p.x - this.x, p.z - this.z) < r && Math.abs(p.y - this.y) < 3.5; }
  finish(coins) { if (this.done) return; this.done = true; this.W.G.act(this.id, NAMES[this.kind], coins, this.x, this.y + 1.2, this.z); } }
class Chest extends Base { constructor(W, id, x, z) { super(W, id, 'chest', x, z); this.mesh = M.chest(); this.mesh.position.set(x, this.y, z); this.mesh.rotation.y = id; W.scene.add(this.mesh); this.prompt = 'Open the chest'; }
  update(dt) { const l = this.mesh.userData.lid; l.rotation.x += ((this.done ? 1.9 : 0) - l.rotation.x) * Math.min(1, 6 * dt); this.canUse = !this.done && this.near(); } use() { this.finish(25 + (this.id % 4) * 8); } }
class Dig extends Base { constructor(W, id, x, z) { super(W, id, 'dig', x, z); const g = this.mesh = new THREE.Group(); for (const r of [0.785, -0.785]) { const b = M.box(0xb5332a, 1.5, 0.05, 0.28, 0, 0.04, 0); b.rotation.y = r; b.castShadow = false; g.add(b); } g.position.set(x, this.y, z); g.visible = !this.done; W.scene.add(g); this.prompt = 'Dig here'; }
  update() { this.canUse = !this.done && this.near(2.2); } use() { this.mesh.visible = false; this.W.puff(this.x, this.y + 0.3, this.z, 0x8a6238, 12); if (this.id % 3 === 0) { this.W.G.save.bombs = (this.W.G.save.bombs || 0) + 2; this.W.G.ui.toast('You dug up two squibs as well. Press G to throw one.', 4); } this.finish(18 + (this.id % 5) * 6); } }
class Stone extends Base { constructor(W, id, x, z, n) { super(W, id, 'stone', x, z); this.n = n; const m = M.box(0x8a8378, 1.1, 1.7, 0.3, 0, 0.85, 0, { flat: 1 }); m.position.set(x, this.y + 0.85, z); m.rotation.y = id; W.scene.add(m); W.addBox(x, this.y + 0.85, z, 0.55, 0.85, 0.3, -id, null); this.prompt = 'Read the old stone'; }
  update() { this.canUse = this.near(); } use() { this.W.G.ui.dialog([{ who: 'Carved in the stone', text: STORIES[this.n % STORIES.length] }], () => this.finish(8)); } }
class Pot extends Base { constructor(W, id, x, z) { super(W, id, 'pot', x, z); this.mesh = new THREE.Group(); this.mesh.add(M.cyl(0xb5652a, 0.42, 0.8, 0, 0.4, 0), M.cyl(0x8a4a22, 0.3, 0.16, 0, 0.86, 0), M.box(0x3f8a3a, 0.5, 0.12, 0.05, 0, 0.5, -0.42)); this.mesh.position.set(x, this.y, z); this.mesh.visible = !this.done; W.scene.add(this.mesh); this.hittable = !this.done; this.r = 0.6; this.h = 0.9; this.name = 'pot'; }
  update() { } hit() { if (this.done) return; this.hittable = false; this.mesh.visible = false; this.W.puff(this.x, this.y + 0.5, this.z, 0xb5652a, 10); this.W.G.audio.sfx('crumble'); this.finish(10 + (this.id % 3) * 5); } }
class Chicken extends Base { constructor(W, id, x, z) { super(W, id, 'chicken', x, z); this.hx = x; this.hz = z; this.t = id; const g = this.mesh = new THREE.Group(); g.add(M.box(0xffffff, 0.34, 0.34, 0.5, 0, 0.36, 0), M.box(0xffffff, 0.2, 0.24, 0.2, 0, 0.62, -0.26), M.box(0xe2a020, 0.08, 0.06, 0.12, 0, 0.6, -0.4), M.box(0xd8362c, 0.06, 0.1, 0.14, 0, 0.78, -0.26), M.box(0xe2a020, 0.05, 0.2, 0.05, -0.08, 0.1, 0), M.box(0xe2a020, 0.05, 0.2, 0.05, 0.08, 0.1, 0)); g.position.set(x, this.y, z); g.visible = !this.done; W.scene.add(g); this.dx = 1; this.dz = 0; }
  update(dt) { if (this.done) return; const W = this.W, p = W.G.player.pos; this.t += dt; let dx = this.x - p.x, dz = this.z - p.z; const d = Math.hypot(dx, dz) || 1; let sp = 0;
    if (d < 1.1 && Math.abs(p.y - this.y) < 2) { this.mesh.visible = false; W.puff(this.x, this.y + 0.4, this.z, 0xffffff, 12); W.G.audio.sfx('screech', 0.6); return this.finish(15); }
    if (d < 9) { const j = Math.sin(this.t * 3.1) * 0.9; this.dx = dx / d * Math.cos(j) - dz / d * Math.sin(j); this.dz = dz / d * Math.cos(j) + dx / d * Math.sin(j); sp = 7.3; } else if (Math.hypot(this.x - this.hx, this.z - this.hz) > 3) { const h = Math.hypot(this.hx - this.x, this.hz - this.z); this.dx = (this.hx - this.x) / h; this.dz = (this.hz - this.z) / h; sp = 2; } else { this.dx = Math.cos(this.t * 0.7); this.dz = Math.sin(this.t * 0.7); sp = 0.8; }
    if (Math.hypot(this.x - this.hx, this.z - this.hz) > 26) { const h = Math.hypot(this.hx - this.x, this.hz - this.z); this.dx = this.dx * 0.3 + (this.hx - this.x) / h; this.dz = this.dz * 0.3 + (this.hz - this.z) / h; }
    this.x += this.dx * sp * dt; this.z += this.dz * sp * dt; this.y = W.T.hAt(this.x, this.z); this.mesh.position.set(this.x, this.y + Math.abs(Math.sin(this.t * 14)) * (sp > 3 ? 0.18 : 0.04), this.z); this.mesh.rotation.y = Math.atan2(-this.dx, -this.dz); } }
class Star extends Base { constructor(W, id, kind, x, y, z) { super(W, id, kind, x, z); this.y = y; this.mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), M.mat(0xffe27a, { e: 0xaa7700 })); this.mesh.position.set(x, y, z); this.mesh.visible = !this.done; W.scene.add(this.mesh); }
  update(dt) { if (this.done) return; this.mesh.rotation.y += dt * 3; const p = this.W.G.player.pos; if (Math.hypot(p.x - this.x, p.y + 0.9 - this.y, p.z - this.z) < 1.8) { this.mesh.visible = false; this.finish(30); } } }
class CampSite extends Base { constructor(W, id, kind, x, z, foes) { super(W, id, kind, x, z); const t = M.tent(kind === 'troll' ? 0x5a4a3a : 0x7a4a2a); t.position.set(x, this.y, z); W.scene.add(t); const f = M.campfire(); f.position.set(x + 2.6, W.T.hAt(x + 2.6, z + 1.5), z + 1.5); f.userData.flames.forEach(q => q.visible = !this.done); W.scene.add(f);
    this.mobs = this.done ? [] : foes.map((k, i) => W.add(new Mob(W, k, x + Math.cos(i * 2.1) * 5, z + Math.sin(i * 2.1) * 5, { arena: 0 }))); for (const m of this.mobs) { m.homeR = 16; } }
  update() { if (!this.done && this.mobs.every(m => m.dead)) this.finish(this.kind === 'troll' ? 60 : 35); } }
// A run through a string of glowing rings against the clock. With air:true the rings hang in the sky and the clock starts at the first.
class Race extends Base { constructor(W, id, kind, x, z, pts, secs) { super(W, id, kind, x, z); this.pts = pts; this.secs = secs; this.i = -1; this.t = 0; this.air = kind === 'hoops'; const flag = new THREE.Group(); flag.add(M.cyl(0x6b4a2a, 0.07, 3.4, 0, 1.7, 0), M.box(this.air ? 0x54d6ff : 0xd8362c, 1.1, 0.7, 0.05, 0.6, 3.0, 0)); flag.position.set(x, this.y, z); W.scene.add(flag);
    this.rings = pts.map(p => { const r = new THREE.Mesh(M.GEO.torG, M.mat(this.air ? 0x54d6ff : 0xffd23a, { e: this.air ? 0x1a7fb0 : 0x7a5200, op: 0.85 })); r.scale.setScalar(this.air ? 2.6 : 1.5); r.position.set(p.x, p.y, p.z); r.rotation.y = p.yaw || 0; r.castShadow = false; r.visible = this.air; W.scene.add(r); return r; }); this.prompt = (this.done ? 'Run the race again' : 'Start the foot race') + ` (${secs} seconds)`; }
  start() { this.i = 0; this.t = this.secs; this.rings.forEach((r, k) => r.visible = true); this.W.G.audio.sfx('camp'); this.W.G.ui.toast(this.air ? 'Glide course! Fly through every ring.' : 'GO! Through every ring before the time runs out.', 3); }
  update(dt) { const W = this.W, G = W.G, p = G.player.pos; this.canUse = !this.air && this.i < 0 && this.near(3);
    if (this.i < 0) { if (this.air && !this.done) { const q = this.pts[0]; if (Math.hypot(p.x - q.x, p.y + 0.9 - q.y, p.z - q.z) < 3.2) { this.start(); this.i = 1; } } return; }
    this.t -= dt; const q = this.pts[this.i]; this.rings.forEach((r, k) => { r.material.opacity = k === this.i ? 0.95 : 0.3; if (k === this.i) r.rotation.z += dt * 2; }); if ((G.frame % 30) === 0) G.ui.toast((this.air ? 'Glide course' : 'Foot race') + `: ring ${this.i + 1} of ${this.pts.length}  ·  ${Math.max(0, this.t).toFixed(0)} s left`, 1);
    if (Math.hypot(p.x - q.x, p.y + 0.9 - q.y, p.z - q.z) < (this.air ? 3.4 : 2.6)) { this.i++; G.audio.sfx('coin'); if (this.i >= this.pts.length) { this.i = -1; this.rings.forEach(r => r.visible = this.air); G.audio.sfx('win'); if (this.done) G.ui.toast('Course cleared again!', 3); this.finish(45); return; } }
    if (this.t <= 0 || this.air && G.player.grounded && this.i > 0 && p.y < q.y - 6) { this.i = -1; this.rings.forEach(r => r.visible = this.air); G.audio.sfx('nope'); G.ui.toast(this.air ? 'Missed a ring. Climb back up and try again.' : 'Out of time! Try again from the flag.', 3); } }
  use() { this.start(); } }

export function buildLowlands(W) {
  const G = W.G, T = W.T, R = rng(4242), spots = [], n = { x: 0, y: 1, z: 0 };
  const free = (x, z, sep) => { if (Math.hypot(x, z) < 78 || Math.hypot(x, z) > T.S - 62) return false; for (const h of T.holes) if (Math.hypot(x - h.x, z - h.z) < h.r + 152) return false; if (T.waterY(x, z) > -5) return false; T.normalAt(x, z, n); if (n.y < 0.93) return false; for (const s of spots) if (Math.hypot(x - s[0], z - s[1]) < sep) return false; return true; };
  const spot = (sep = 24) => { for (let i = 0; i < 4000; i++) { const x = (R() - 0.5) * 2 * T.S, z = (R() - 0.5) * 2 * T.S; if (free(x, z, sep)) { spots.push([x, z]); return [x, z]; } } const s = [0, 90 + spots.length * 2]; spots.push(s); return s; };
  let id = 0; const add = e => W.add(e);
  for (let i = 0; i < 12; i++) { const [x, z] = spot(); add(new Chest(W, id++, x, z)); }
  for (let i = 0; i < 10; i++) { const [x, z] = spot(); add(new Dig(W, id++, x, z)); }
  for (let i = 0; i < 10; i++) { const [x, z] = spot(); add(new Stone(W, id++, x, z, i)); }
  for (let i = 0; i < 16; i++) { const [x, z] = spot(18); add(new Pot(W, id++, x, z)); }
  for (let i = 0; i < 10; i++) { const [x, z] = spot(30); add(new Chicken(W, id++, x, z)); }
  for (let i = 0; i < 10; i++) { const [x, z] = spot(30), y = T.hAt(x, z), h = 7 + (i % 4) * 2.5; W.addCyl(x, y + h / 2 - 0.5, z, 2.2, h / 2 + 0.5, 't'); W.addBox(x + 2.25, y + h / 2 - 0.5, z, 0.25, h / 2 + 0.5, 1.1, 0, null, { climb: true }); const v = W.vines(2.2, h); v.position.set(x + 2.52, y + h / 2, z); v.rotation.y = Math.PI / 2; W.scene.add(v); add(new Star(W, id++, 'spire', x, y + h + 1.3, z)); }
  const camps = [['grunt', 'grunt', 'slinger'], ['grunt', 'brute', 'grunt'], ['bomber', 'grunt', 'grunt'], ['shield', 'grunt', 'slinger'], ['boar', 'boar', 'grunt'], ['tugger', 'brute', 'grunt'], ['shaman', 'grunt', 'grunt', 'grunt'], ['brute', 'brute', 'bomber'], ['shield', 'shield', 'slinger'], ['harpy', 'grunt', 'brute', 'shaman']];
  for (let i = 0; i < 10; i++) { const [x, z] = spot(46); add(new CampSite(W, id++, 'camp', x, z, camps[i])); }
  for (let i = 0; i < 8; i++) { const [x, z] = spot(60), pts = []; let a = R() * TAU, px = x, pz = z; for (let k = 0; k < 6 + (i % 3); k++) { a += (R() - 0.5) * 1.6; let nx = px + Math.cos(a) * 15, nz = pz + Math.sin(a) * 15; if (!free(nx, nz, 0)) { a += 2.2; nx = px + Math.cos(a) * 15; nz = pz + Math.sin(a) * 15; } px = nx; pz = nz; pts.push({ x: px, y: T.hAt(px, pz) + 1.3, z: pz, yaw: -a + Math.PI / 2 }); } add(new Race(W, id++, 'race', x, z, pts, Math.round(pts.length * 2.6 + 3))); }
  for (let i = 0; i < 6; i++) { const [x, z] = spot(34), y = T.hAt(x, z), a = R() * TAU; for (let k = 0; k < 3; k++) { const mx = x + Math.cos(a) * k * 6.5, mz = z + Math.sin(a) * k * 6.5, my = T.hAt(mx, mz) + k * 2.2; if (k) W.addCyl(mx, my - k * 1.1 + 0.4, mz, 0.5, k * 1.1 + 0.2, 0xf0e6cf); W.addCyl(mx, my + 0.92, mz, 1.3, 0.5, null, { bounce: 15.5 }); const m = M.mushroom(); m.position.set(mx, my, mz); W.scene.add(m); } add(new Star(W, id++, 'bounce', x + Math.cos(a) * 19, y + 11 + (i % 2) * 2, z + Math.sin(a) * 19)); }
  for (let i = 0; i < 5; i++) { const [x, z] = spot(80), y = T.hAt(x, z), h = 17, a = R() * TAU, pts = []; W.addCyl(x, y + h / 2 - 0.5, z, 2.6, h / 2 + 0.5, 't'); W.addBox(x - Math.cos(a) * 2.65, y + h / 2 - 0.5, z - Math.sin(a) * 2.65, 0.25, h / 2 + 0.5, 1.2, a, null, { climb: true }); const v = W.vines(2.4, h); v.position.set(x - Math.cos(a) * 2.93, y + h / 2, z - Math.sin(a) * 2.93); v.rotation.y = -a + Math.PI / 2; W.scene.add(v);
    for (let k = 0; k < 5; k++) pts.push({ x: x + Math.cos(a) * (9 + k * 10), y: y + h + 3.2 - k * 2.3, z: z + Math.sin(a) * (9 + k * 10), yaw: -a + Math.PI / 2 }); add(new Race(W, id++, 'hoops', x, z, pts, 40)); }
  for (let i = 0; i < 3; i++) { const [x, z] = spot(60); add(new CampSite(W, id++, 'troll', x, z, i === 2 ? ['troll', 'troll'] : ['troll'])); }
  W.actCount = id;
}

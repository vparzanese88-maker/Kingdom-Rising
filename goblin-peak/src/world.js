// Builds a playable map (the village, or one mountain stage) from its description in levels.js.
import * as THREE from 'three';
import { TAU, clamp, rng, vnoise } from './util.js';
import { Spiral, Meadow } from './terrain.js';
import * as M from './models.js';
import { buildLowlands } from './lowland.js';
import { LEVELS } from './levels.js';
import { buildVillage } from './village.js';
import { placeTossables } from './toss.js';
import { Pike, Bomb, Mob, Boulder, Roller, Spikes, Pendulum, DartTotem, Chest, Camp, NPC, Jewel, Gate, Geyser, Boss, Gong, RockRain, Wind, ZipLine, Ambush, Chase } from './entities.js';

export const THEMES = {
  meadow: { sky: [0x3f8fe0, 0xcfe9f7], fog: [0xcfe9f7, 120, 520], ground: [0.38, 0.66, 0.27], ground2: [0.5, 0.72, 0.3], rock: [0.5, 0.46, 0.4], trail: [0.72, 0.6, 0.42], bed: [0.3, 0.42, 0.45], tree: [0x2f7a36, 0x3f9a44], trunk: 0x6b4a2a, sun: 0xfff2d8, music: 'town1', rockCol: 0x8a8378 },
  forest: { sky: [0x3f8fe0, 0xd4ecf7], fog: [0xd4ecf7, 90, 460], ground: [0.33, 0.6, 0.25], ground2: [0.46, 0.68, 0.28], rock: [0.5, 0.45, 0.38], trail: [0.7, 0.57, 0.38], bed: [0.3, 0.42, 0.45], tree: [0x2a6e33, 0x3c9442], trunk: 0x6b4a2a, sun: 0xfff2d8, music: 'forest', rockCol: 0x8a8378 },
  gorge: { sky: [0x4a86d8, 0xf6d9b0], fog: [0xf2d2a8, 90, 470], ground: [0.82, 0.62, 0.36], ground2: [0.7, 0.56, 0.3], rock: [0.72, 0.4, 0.25], trail: [0.6, 0.44, 0.3], bed: [0.36, 0.44, 0.44], tree: [0x55742a, 0x6a8a30], trunk: 0x7a5236, sun: 0xffe2b8, music: 'calm_cave', rockCol: 0xb5683f },
  snow: { sky: [0x6aa2dc, 0xeaf3fa], fog: [0xe6f0f8, 70, 400], ground: [0.92, 0.95, 0.99], ground2: [0.84, 0.9, 0.97], rock: [0.45, 0.5, 0.6], trail: [0.76, 0.83, 0.93], bed: [0.5, 0.66, 0.78], tree: [0x2c5f4a, 0xe8f0f6], trunk: 0x5a4030, sun: 0xf4f8ff, music: 'calm_snow', rockCol: 0x7f8a9c },
};
const G0 = w => w.G; const ROCK = 't', WOOD = 0x8a6238, LOG = 0x7a5230, PLANK = 0xb08a52;
const rt = { phi: 0, lat: 0, on: false };

// How each kind of section shapes the trail: y (height by arc metres), pit (depth), width.
const PROFILE = {
  climb: s => ({ y: a => a < 6 ? 0 : s.rise }), teamwall: s => ({ y: a => a < 6 ? 0 : s.rise }), cliff: s => ({ y: a => a < 6 ? 0 : s.rise }),
  gap: s => ({ pit: a => a > 4 && a < s.len - 4 ? s.depth || 9 : 0, y: s.style === 'rising' ? a => a < s.len - 4 ? 0 : s.rise : null }),
  beam: s => ({ pit: a => a > 4 && a < s.len - 4 ? s.depth || 9 : 0 }), swing: s => ({ pit: a => a > 4 && a < s.len - 4 ? s.depth || 9 : 0 }),
  traverse: s => ({ pit: a => a > 4 && a < s.len - 4 ? s.depth || 9 : 0 }), zip: s => ({ pit: a => a > 4 && a < s.len - 4 ? s.depth || 9 : 0 }),
  chasm: s => ({ pit: a => a > 4 && a < s.len - 4 ? s.depth || 9 : 0 }), glide: s => ({ pit: a => a > 12 && a < s.len - 4 ? s.depth || 9 : 0 }),
};

export class World {
  constructor(G, def, realm) {
    this.G = G; this.def = def; this.realm = !!realm; const th = this.theme = THEMES[def.theme]; this.scene = realm ? new THREE.Group() : new THREE.Scene();
    this.limbs = []; this.loose = []; this.boxes = []; this.ents = []; this.anchors = []; this.drafts = []; this.nets = []; this.iceR = []; this.coins = []; this.triggers = []; this.secs = []; this.movers = []; this.jewels = []; this.camps = []; this.spiral = null;
    this.rnd = rng(def.seed || 7); this.rockMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }); this.rg = M.rockGeos(new THREE.Color(...th.ground).getHex(), th.rockCol); this.rk = 0;
    if (!realm) World.dressSky(this, this.scene, th);
    // water
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = '#3f9bd8'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.35})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 3, 10 + Math.random() * 26); }
    this.waterTex = new THREE.CanvasTexture(cv); this.waterTex.wrapS = this.waterTex.wrapT = THREE.RepeatWrapping; this.waterTex.repeat.set(2, 1); this.waterTex.colorSpace = THREE.SRGBColorSpace;
    this.waterMat = new THREE.MeshLambertMaterial({ map: this.waterTex, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
    // particles
    this.parts = []; for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(M.GEO.icoG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); m.visible = false; this.scene.add(m); this.parts.push({ m, v: new THREE.Vector3(), life: 0 }); } this.pi = 0;
    // aim markers
    this.ret = ['#ffd24a', '#54d6ff'].map(col => { const cc = document.createElement('canvas'); cc.width = cc.height = 64; const g = cc.getContext('2d'); g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); g.arc(32, 32, 24, 0, 7); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 10, 0, 7); g.stroke(); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cc), depthTest: false, fog: false })); sp.visible = false; sp.renderOrder = 9; this.scene.add(sp); return sp; });
    if (def.hub) this.buildHub(); else this.buildMountain();
    this.scatter(); placeTossables(this);
    const cg = new THREE.CylinderGeometry(0.36, 0.36, 0.07, 14); cg.rotateX(Math.PI / 2);
    this.coinMesh = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ color: 0xffd23a, emissive: 0x7a5200 }), Math.max(1, this.coins.length)); this.coinMesh.frustumCulled = false; this.scene.add(this.coinMesh); this.dummy = new THREE.Object3D();
    this.coins.forEach((c, i) => { c.init = true; this.dummy.position.set(c.x, c.y, c.z); this.dummy.rotation.y = i; this.dummy.updateMatrix(); this.coinMesh.setMatrixAt(i, this.dummy.matrix); });
    if (def.hub) { const hc = G.save.hubCoins = G.save.hubCoins || {}; this.coins.forEach((c, i) => { if (hc[i]) { c.got = true; this.dummy.position.set(0, -999, 0); this.dummy.updateMatrix(); this.coinMesh.setMatrixAt(i, this.dummy.matrix); } }); }
  }
  // Sky dome, lights and clouds. In the single open world there is one set for everything; a lone map gets its own.
  static dressSky(o, scene, th) {
    scene.fog = new THREE.Fog(th.fog[0], th.fog[1], th.fog[2]); scene.background = new THREE.Color(th.fog[0]);
    const sg = new THREE.SphereGeometry(1400, 24, 12), sc = new Float32Array(sg.attributes.position.count * 3), top = new THREE.Color(th.sky[0]), bot = new THREE.Color(th.sky[1]), c = new THREE.Color();
    for (let i = 0; i < sg.attributes.position.count; i++) { c.copy(bot).lerp(top, clamp(sg.attributes.position.getY(i) / 780, 0, 1)); sc[i * 3] = c.r; sc[i * 3 + 1] = c.g; sc[i * 3 + 2] = c.b; }
    sg.setAttribute('color', new THREE.BufferAttribute(sc, 3)); o.sky = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); scene.add(o.sky);
    scene.add(new THREE.HemisphereLight(th.sky[1], 0x6a6258, 1.25));
    const sun = o.sun = new THREE.DirectionalLight(th.sun, 1.9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc2 = sun.shadow.camera; sc2.left = sc2.bottom = -55; sc2.right = sc2.top = 55; sc2.near = 10; sc2.far = 260; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05; scene.add(sun, sun.target);
    for (let i = 0; i < 26; i++) { const cl = M.ball(0xffffff, 1, (Math.random() - 0.5) * 2200, 300 + Math.random() * 160, (Math.random() - 0.5) * 2200); cl.scale.set(30 + Math.random() * 40, 8 + Math.random() * 6, 20 + Math.random() * 25); cl.castShadow = false; cl.material = M.mat(0xffffff, { e: 0xd0d0d0 }); scene.add(cl); }
  }
  add(e) { this.ents.push(e); return e; }
  // A hanging curtain of vines and leaves for climbable rock faces.
  vines(w, h) {
    if (!this._vt) { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); g.clearRect(0, 0, 128, 128); for (let i = 0; i < 9; i++) { const x = 8 + i * 14; g.strokeStyle = '#3a5a22'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= 128; y += 16) g.lineTo(x + Math.sin(y * 0.2 + i) * 5, y); g.stroke(); for (let y = 4; y < 128; y += 9) { g.fillStyle = ['#2f7a36', '#3f9a44', '#4fae4a'][(i + y) % 3]; g.beginPath(); g.ellipse(x + Math.sin(y * 0.2 + i) * 5 + (y % 2 ? 5 : -5), y, 6, 3.4, y % 2 ? 0.6 : -0.6, 0, 7); g.fill(); } } this._vt = new THREE.CanvasTexture(cv); this._vt.wrapS = this._vt.wrapT = THREE.RepeatWrapping; this._vt.colorSpace = THREE.SRGBColorSpace; }
    const t = this._vt.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 3)));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide })); return m;
  }
  showCoin(i) { const c = this.coins[i]; if (!c || !c.got) return; c.got = false; c.init = false; if (this.def.hub && this.G.save.hubCoins) delete this.G.save.hubCoins[i]; }
  hideCoin(i) { const c = this.coins[i]; if (!c || c.got) return; c.got = true; this.dummy.position.set(0, -999, 0); this.dummy.updateMatrix(); this.coinMesh.setMatrixAt(i, this.dummy.matrix); this.coinMesh.instanceMatrix.needsUpdate = true; }
  // Loose coins that pop out, bounce and wait to be picked up.
  dropCoins(x, y, z, n) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 2 + Math.random() * 3.5, m = new THREE.Mesh(this.coinMesh.geometry, this.coinMesh.material); m.position.set(x, y, z); this.scene.add(m); this.loose.push({ m, vx: Math.cos(a) * sp, vy: 6 + Math.random() * 4, vz: Math.sin(a) * sp, t: 0 }); } }
  color(c) { return c === ROCK ? this.rockMat : c; }
  addBox(x, y, z, hx, hy, hz, th, color, f = {}) {
    const b = Object.assign({ x, y, z, hx, hy, hz, ax: Math.cos(th), az: Math.sin(th), rad: Math.hypot(hx, hz), solid: true, dx: 0, dy: 0, dz: 0 }, f);
    if (color !== null) { const rock = color === ROCK; color = this.color(color); let m; if (b.beam) { m = M.fallenTree(Math.max(hx, hz) * 2 + 1.2, 0.34); m.rotation.y = -th + (hz > hx ? Math.PI / 2 : 0); m.position.set(x, y - 0.08, z); } else if (b.log) { m = M.fallenTree(hx * 2, hy, b.log === 2 ? this.theme.tree[0] : 0); m.rotation.y = -th; m.position.set(x, y, z); } else { m = new THREE.Mesh(rock ? this.rg.boxes[this.rk++ % 4] : M.GEO.boxG, typeof color === 'object' ? color : M.mat(color, { flat: 1 })); m.scale.set(hx * 2, hy * 2, hz * 2); m.position.set(x, y, z); m.rotation.y = -th; } m.castShadow = m.receiveShadow = true; this.scene.add(m); b.mesh = m; }
    if (b.log || b.beam) { const lx = b.beam && hz > hx ? -b.az * hz : b.ax * hx, lz = b.beam && hz > hx ? b.ax * hz : b.az * hx; this.limb(x - lx, y, z - lz, x + lx, y, z + lz); }
    this.boxes.push(b); if (b.mover) this.movers.push(b); return b;
  }
  addCyl(x, y, z, r, hy, color, f = {}) {
    const b = Object.assign({ x, y, z, r, hy, hx: r, hz: r, ax: 1, az: 0, rad: r, solid: true, dx: 0, dy: 0, dz: 0 }, f);
    if (color !== null) { const rock = color === ROCK; color = this.color(color); const m = new THREE.Mesh(rock ? this.rg.spires[this.rk++ % 4] : M.GEO.cylG, typeof color === 'object' ? color : M.mat(color, { flat: 1 })); m.scale.set(r, hy * 2, r); m.position.set(x, y, z); m.rotation.y = this.rk * 1.3; m.castShadow = m.receiveShadow = true; this.scene.add(m); b.mesh = m; }
    this.boxes.push(b); if (b.mover) this.movers.push(b); return b;
  }
  sb(s, a, l, u, hx, hy, hz, color, f) { const fr = s.at(a, l, u); return this.addBox(fr.x, fr.y, fr.z, hx, hy, hz, fr.th, color, f); }
  deco(s, a, l, u, mesh, yawOff = 0) { const fr = s.at(a, l, u); mesh.position.set(fr.x, fr.y, fr.z); mesh.rotation.y = fr.yaw + yawOff; this.scene.add(mesh); return fr; }
  ground(s, a, l) { const fr = s.at(a, l, 0); fr.y = this.T.hAt(fr.x, fr.z); return fr; }
  coin(x, y, z) { this.coins.push({ x, y, z, got: false }); }
  coinLine(s, a0, a1, lat = 0, up = 1, n) { n = n || Math.max(2, Math.round(Math.abs(a1 - a0) / 2.6)); for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (n === 1 ? 0.5 : i / (n - 1)), f = s.at(a, typeof lat === 'function' ? lat(a) : lat, typeof up === 'function' ? up(i / Math.max(1, n - 1)) : up); this.coin(f.x, f.y, f.z); } }
  // Anything a whip can wrap round or a hook can catch: branches, trunks, logs, posts.
  limb(ax, ay, az, bx, by, bz) { this.limbs.push({ ax, ay, az, bx, by, bz, len: Math.hypot(bx - ax, by - ay, bz - az) || 0.01 }); }
  slimb(s, a1, l1, u1, a2, l2, u2) { const f = s.at(a1, l1, u1), g = s.at(a2, l2, u2); this.limb(f.x, f.y, f.z, g.x, g.y, g.z); }
  anchor(s, a, l, u, kind) { const f = s.at(a, l, u); this.anchors.push({ x: f.x, y: f.y, z: f.z, kind }); return f; }

  // ------------------------------------------------------------------ mountain stages
  buildMountain() {
    const def = this.def, P0 = 46, k0 = P0 / TAU; let list = def.sections;
    if (this.G.coop) { // online: walls only two can scale and gates only two can pass, every few sections
      list = []; let k = 0; def.sections.forEach((s, i) => { list.push(s); if (i > 1 && i % 5 === 2 && i < def.sections.length - 3) list.push(k++ % 2 ? { t: 'teamgate', len: 30, rise: 0, w: 6 } : { t: 'teamwall', len: 12, rise: 7.5 }); }); }
    const Ltot = list.reduce((a, s) => a + s.len, 0) + 80, R0 = Math.sqrt(58 * 58 + 2 * k0 * Ltot), phiEst = (R0 - 58) / k0;
    const rloops = def.river ? Math.min(def.river.loops, Math.floor((phiEst - def.river.th - 0.5) / TAU) + 1) : 0;
    const sp = this.spiral = this.T = new Spiral({ R0, P: P0, realm: this.realm, river: rloops > 0 ? { th: def.river.th, loops: rloops } : null }), rv = sp.river;
    let crossN = 0;
    const lay = s => {
      s.w = s.w || 5; const pr = PROFILE[s.t] ? PROFILE[s.t](s) : {}, rec = sp.lay(s.len, s.rise || 0, pr.y, pr.pit, () => s.w);
      s.p0 = rec.p0; s.p1 = rec.p1; s.y0 = rec.y0; s.y1 = rec.y1; s.at = (a, l = 0, u = 0) => sp.frame(s.p0 + (a / s.len) * (s.p1 - s.p0), l, u); s.idx = this.secs.length; this.secs.push(s);
    };
    for (const s0 of list) {
      let s = Object.assign({}, s0); if (this.G.coop && s.t === 'arena') s = { t: 'goal', len: 30, rise: 0, w: 8 };      // online there is no story: the top is a finish line
      if (rv && crossN < rv.loops) {
        const cross = rv.th + TAU * crossN, start = cross - 17 / sp.R(cross);
        if (sp.PHI + s.len / sp.R(sp.PHI) > start) { const fill = (start - sp.PHI) * sp.R(sp.PHI); if (fill > 1.5) lay({ t: 'path', len: fill, rise: fill * 0.03 }); lay({ t: 'river', len: 34, rise: 0, w: 6, style: def.river.styles[crossN], cross }); crossN++; }
      }
      lay(s);
    }
    sp.openFrom = this.secs[this.secs.length - 1].p0 - 3 / sp.R(sp.PHI);
    sp.Y.push(sp.Ytop); sp.G.push(sp.Ytop); sp.W.push(sp.W[sp.W.length - 1]);
    sp.bake(); this.terrainMesh = sp.mesh(this.theme); this.scene.add(this.terrainMesh); for (const m of sp.waterMeshes(this.waterMat)) this.scene.add(m);
    this.campN = 0; this.jewelN = 0;
    for (const s of this.secs) { if (this[`b_${s.t}`]) this[`b_${s.t}`](s); this.common(s); }
    const f = this.secs[0].at(3, 0, 0); this.start = { x: f.x, y: f.y, z: f.z, yaw: Math.atan2(-f.tx, -f.tz) };
    // the trailhead gate: barred until the trail before it has been cleared
    const idx = ['l1', 'l2', 'l3'].indexOf(def.id), prev = idx > 0 ? ['l1', 'l2', 'l3'][idx - 1] : null, b = this.secs[0].at(this.realm ? this.secs[0].len - 3 : -6, 0, 0);
    this.add(new Gate(this, b.x, b.z, b.yaw, { w: 6, title: this.realm ? `${idx + 1}. ${def.name} · ${def.tag}` : 'Back to the village', sub: 'The trail starts here', lockSub: `LOCKED: clear trail ${idx} first`, col: def.col || 0x3f8a3a, locked: g => this.realm && !g.coop && prev && !g.save.done[prev], lockText: 'This trail starts where the one before it ends. Climb that first.', go: G => { if (!this.realm) G.loadLevel('hub'); } }));
  }
  common(s) {
    const sp = this.spiral, G = this.G;
    if (s.ice) this.iceR.push([s.p0, s.p1]);
    if (s.t === 'logs' || s.t === 'rockfall' || s.t === 'traps' || s.t === 'crawl' || s.t === 'ambush' || s.t === 'chase' || s.t === 'teamgate') this.benchWall(s);
    if (s.rain) this.add(new RockRain(this, s, s.rain === true ? 0.5 : s.rain)); if (s.wind) this.add(new Wind(this, s));
    if ((s.t === 'path' || s.t === 'ramp' || s.t === 'traps' || s.t === 'chase' || s.t === 'ambush') && s.coins !== 0) this.coinLine(s, 2, s.len - 2, a => Math.sin(a * 0.16 + s.idx) * (s.w - 2.2), 1, Math.floor(s.len / 4.5));
    for (const m of s.mobs || []) { const f = s.at(m[1] * s.len, m[2] || 0, 0); this.add(new Mob(this, m[0], f.x, f.z, { range: m[3] || Math.min(16, s.len / 2) })); if (G.coop && this.def.diff > 0 && ['grunt', 'brute', 'shield', 'boar', 'ram'].includes(m[0])) { const g = s.at(Math.min(s.len - 2, m[1] * s.len + 4), -(m[2] || 0) + 1.5, 0); this.add(new Mob(this, m[0], g.x, g.z, { range: m[3] || Math.min(16, s.len / 2) })); } }
    if (s.chest) { const f = s.at(s.len / 2, -s.w + 2, 0); this.add(new Chest(this, f.x, f.z, s.chest, f.yaw + Math.PI / 2)); }
    for (const n0 of s.npcs || []) { if (G.coop && !n0.stall) continue; const n = G.coop ? Object.assign({}, n0, { lines: [] }) : n0; const f = s.at(n.a === undefined ? s.len / 2 : n.a, n.lat === undefined ? -s.w + 1.6 : n.lat, 0); if (n.stall) { const st = M.stall(); st.position.set(f.x - f.nx * 1.4, this.T.hAt(f.x, f.z), f.z - f.nz * 1.4); st.rotation.y = Math.atan2(f.nx, f.nz); this.scene.add(st); } this.add(new NPC(this, f.x, f.z, { name: n.name, model: n.model(), lines: n.lines, after: n.after, prompt: n.prompt })); }
    if (s.tip) this.triggers.push({ p0: s.p0, p1: s.p0 + 10 / sp.R(s.p0), key: 't' + this.def.id + s.idx, fn: () => G.ui.toast(s.tip, 9) });
    if (s.bark && !G.coop) this.triggers.push({ p0: s.p0, p1: s.p0 + 10 / sp.R(s.p0), key: 'b' + this.def.id + s.idx, fn: () => G.ui.bark(s.bark[0], s.bark[1]) });
    if (s.name) this.triggers.push({ p0: s.p0, p1: s.p0 + 8 / sp.R(s.p0), fn: () => G.ui.area(s.name), repeat: 40 });
    if (s.jewel) {
      const j = s.jewel, f = s.at(j.a === undefined ? s.len / 2 : j.a, j.lat || 0, 0), gy = j.abs ? f.y : this.T.hAt(f.x, f.z), y = gy + (j.up || 0) + 1.3; const idx = this.jewelN++;
      if (j.plat) this.addBox(f.x, y - 1.6, f.z, 1.2, 0.3, 1.2, f.th, ROCK);
      for (let i = 1; i <= (j.steps || 0); i++) { const q = i / (j.steps + 1), g = s.at((j.a || s.len / 2) - (j.sa || 0) * (1 - q), s.w + ((j.lat || 0) - s.w) * q, 0); this.addBox(g.x, g.y + (y - 1.6 - g.y) * q - 0.3, g.z, 1, 0.3, 1, g.th, ROCK); }
      const jw = new Jewel(this, f.x, y, f.z, idx); this.add(jw); this.jewels.push(jw);
    }
    if (s.rollers && s.p0 + TAU < sp.PHI) for (let i = 0; i < s.rollers; i++) {
      const phi = s.p0 + (s.p1 - s.p0) * (i + 0.5) / s.rollers + TAU, w = sp.width(phi), f = sp.frame(phi, w - 1.3, 0), e = sp.frame(phi, w + 0.6, 0);
      if (Math.abs(sp.groundY(phi) - sp.trailY(phi)) < 0.5) this.add(new Roller(this, f.x, f.z, { every: 4.2 + i, range: 75, px: f.nx * 1.4, pz: f.nz * 1.4, make: () => ({ x: e.x, z: e.z, vx: e.nx * 5, vz: e.nz * 5, r: 1.15 }) }));
    }
    for (let i = 0; i < (s.geysers || 0); i++) { const f = s.at(s.len * (i + 1) / (s.geysers + 1), Math.sin(i * 2.4) * (s.w - 2.5), 0); this.add(new Geyser(this, f.x, f.z, i * 1.3)); }
  }
  // Rock buttresses that fill the flat shelf on the uphill side of an obstacle, so it cannot simply be walked round.
  benchWall(s) {
    const sp = this.spiral, n = Math.max(1, Math.ceil((s.len - 2) / 10)), seg = (s.len - 2) / n;
    for (let i = 0; i < n; i++) {
      const a = 1 + seg * (i + 0.5), phi = s.p0 + a / s.len * (s.p1 - s.p0); let Wi = Math.min(sp.width(phi + TAU), 30), Wo = Math.min(s.w, 30); if (Wi + Wo > sp.P - 6) { if (Wi > Wo) Wi = sp.P - 6 - Wo; else Wo = sp.P - 6 - Wi; }
      const avail = sp.P - Wi - Wo, cw = clamp(Math.abs(sp.groundY(phi + TAU) - sp.groundY(phi)) / 1.6, 1.5, avail), bench = avail - cw; if (bench < 0.8) continue;
      const hw = (bench + 3) / 2, hgt = 7.5 + (i % 3) * 1.2; this.sb(s, a, -s.w - 0.2 - hw, hgt / 2 - 1, hw, hgt / 2 + 1, seg / 2 + 0.6, ROCK, { noGrab: true });
    }
  }
  // Pit walls: the near wall is covered in vines so a fall into the pit costs only the climb back out.
  pit(s, o = {}) {
    const d = s.depth || 9, w = s.w + 1.5, a0 = o.a0 || 4, a1 = s.len - 4, h0 = (d + 1) / 2, up = o.endUp || 0, h1 = (d + 1 + up) / 2;
    this.sb(s, a0 + 0.2, 0, 0.02 - h0, w, h0, 2.4, ROCK, { climb: true });
    this.deco(s, a0 + 2.72, 0, -d / 2, this.vines((w - 0.6) * 2, d), 0);
    { const f = s.at(a1 - 0.2, 0, 0), top = this.spiral.trailY(s.p0 + (a1 + 0.4) / s.len * (s.p1 - s.p0)) + 0.02; this.addBox(f.x, top - h1, f.z, w, h1, 2.4, f.th, ROCK); }
    return { a0: a0 + 2.6, a1: a1 - 2.6, d };
  }
  b_gap(s) {
    const rising = s.style === 'rising', { a0, d } = this.pit(s, { endUp: rising ? s.rise : 0 }), n = s.n, g = s.g, sz = s.size, step = rising ? s.rise / (n + 1) : 0;
    let prevTop = 0;
    for (let i = 0; i < n; i++) {
      const a = a0 + g + sz / 2 + i * (sz + g), lat = (s.zig === undefined ? 1.2 : s.zig) * (i % 2 ? 1 : -1), top = step * (i + 1), hh = (d + top + 1) / 2;
      if (s.style === 'pillar') { const f = s.at(a, lat, top - hh); this.addCyl(f.x, f.y, f.z, sz / 2, hh, ROCK); }
      else if (s.style === 'moving') { const f = s.at(a, 0, -0.3), amp = i % 2 ? 0 : 3.2, vamp = i % 2 ? 1.6 : 0, ph = i * 1.9; this.addBox(f.x, f.y, f.z, sz / 2 + 0.3, 0.3, sz / 2, f.th, WOOD, { mover: (t, b) => { const q = Math.sin(t * 1.15 + ph); b.x = f.x + f.nx * q * amp; b.z = f.z + f.nz * q * amp; b.y = f.y + q * vamp; } }); }
      else if (s.style === 'collapse') this.sb(s, a, -s.w + 1.7, -0.3, 1.7, 0.3, sz / 2, ROCK, { crumble: true, noGrab: true });
      else if (s.style === 'bridge') this.sb(s, a, 0, -0.12, 1.3, 0.1, sz / 2, i % 3 === 2 ? 0x7a6a4a : PLANK, i % 3 === 2 ? { crumble: true, noGrab: true } : {});
      else if (s.style === 'bounce') { const f = s.at(a, 0, -2.6 - 0.5); this.addCyl(f.x, f.y, f.z, 1.3, 0.5, null, { bounce: 15.5 }); const m = M.mushroom(); m.position.set(f.x, f.y + 0.5 - 1.42, f.z); this.scene.add(m); this.scene.add(M.cyl(0xf0e6cf, 0.4, d - 3, f.x, f.y - (d - 3) / 2, f.z)); }
      else { const f = s.at(a, lat, top - hh); this.addCyl(f.x, f.y, f.z, sz / 2 * (1 + (i * 37 % 5) * 0.06), hh, ROCK); }
      if (s.style === 'bridge' || s.style === 'collapse') { if (i % 2 === 0) { const f = s.at(a, s.style === 'collapse' ? -s.w + 1.7 : 0, 1.1); this.coin(f.x, f.y, f.z); } } else if (s.style !== 'bounce') { const f = s.at(a, s.style === 'moving' ? 0 : lat, top + 1.1); this.coin(f.x, f.y, f.z); } else this.coinLine(s, a, a, 0, q => 1 + q * 3, 3);
      prevTop = top;
    }
    if (s.style === 'bridge') { // rope rails and end posts
      const e0 = a0 - 0.6, e1 = a0 + g + n * (sz + g) + 0.6; for (const l of [-1.4, 1.4]) { const pts = []; for (let q = 0; q <= 12; q++) { const f = s.at(e0 + (e1 - e0) * q / 12, l, 1.1 - Math.sin(q / 12 * Math.PI) * 0.45); pts.push(new THREE.Vector3(f.x, f.y, f.z)); } this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8a6238 }))); for (const e of [e0, e1]) this.deco(s, e, l, 0.6, M.cyl(0x6b4a2a, 0.11, 1.5, 0, 0, 0)); }
    }
  }
  // A vine-hung rock face running along the uphill side of a ravine: climb across it sideways.
  b_traverse(s) {
    const { a0, a1, d } = this.pit(s), mid = (a0 + a1) / 2, hl = (a1 - a0) / 2 + 1.6, f = s.at(mid, -s.w + 1.2 - 1.6, 5);
    this.addBox(f.x, f.y, f.z, 1.6, 8, hl, f.th, ROCK, { climb: true, noHook: true }); this.deco(s, mid, -s.w + 1.3, 4.5, this.vines(hl * 2 - 0.4, 12), Math.PI / 2);
    this.coinLine(s, a0 + 1, a1 - 1, -s.w + 2.1, i => 1.5 + Math.sin(i * 9) * 1.2);
  }
  // A long drop crossed on a rope.
  b_zip(s) {
    const { a0, a1 } = this.pit(s), A = s.at(a0 - 1.6, 0, 3.4), B = s.at(a1 + 2.6, 0, 2.3); this.deco(s, a0 - 1.6, 0, 1.7, M.cyl(0x5a3c22, 0.2, 3.6, 0, 0, 0)); this.deco(s, a1 + 2.6, 0, 1.15, M.cyl(0x5a3c22, 0.2, 2.5, 0, 0, 0));
    this.add(new ZipLine(this, A, B)); this.coinLine(s, a0 + 3, a1 - 2, 0, q => 2.2 - q * 1.0, Math.round((a1 - a0) / 4));
  }
  b_ambush(s) {
    const w = s.w, a = s.len - 5, f = s.at(a, 0, 0), box = this.addBox(f.x, f.y + 3.5, f.z, w + 4, 4.5, 0.7, f.th, null, { noHook: true, noGrab: true });
    const g = new THREE.Group(); for (let i = 0; i < 7; i++) { const l = M.cyl(0x5a3c22, 0.38, (w + 4) * 2, 0, 0.4 + i * 0.78, (i % 2 ? 0.12 : -0.12)); l.rotation.z = Math.PI / 2; g.add(l); } for (const x of [-w - 2, -w / 2, 0, w / 2, w + 2]) g.add(M.cyl(0x4a3020, 0.2, 7, x, 3.3, 0.45), M.cone(0x4a3020, 0.24, 0.7, x, 7.1, 0.45)); this.deco(s, a, 0, 0, g);
    const mobs = (s.foes || ['grunt', 'grunt', 'grunt']).map((k, i, arr) => { const q = s.at(11 + (s.len - 22) * (i + 0.5) / arr.length, (i % 2 ? 1 : -1) * 2.2, 0); return this.add(new Mob(this, k, q.x, q.z, { range: s.len / 2 })); });
    this.add(new Ambush(this, s, box, g, mobs));
  }
  b_chase(s) { this.add(new Chase(this, s)); for (let a = 24; a < s.len - 12; a += 13) { const f = s.at(a, 0, 0); this.addBox(f.x, f.y + 0.42, f.z, s.w + 3, 0.45, 0.45, f.th + 0.1, LOG, { log: 1 }); } }
  // Online only. A sheer wall with no vines: one hero boosts the other up, who then pegs a rope or whips them up after.
  b_teamwall(s) {
    const w = s.w + 1.5, r = s.rise, f = s.at(6, 0, 0), box = this.addBox(f.x, s.y0 + (r - 1) / 2 + 0.015, f.z, w, (r + 1) / 2, 2.4, f.th, ROCK, { noHook: true });
    const v = this.vines((w - 0.6) * 2, r); this.deco(s, 3.46, 0, r / 2, v, 0); const sg = M.signBoard('TWO-HERO WALL', 'E boosts a friend  ·  T pegs a rope', '#54a6d6', 5, 1.65); this.deco(s, 2.2, -s.w + 1.4, 2.2, sg, Math.PI / 2 + Math.PI);
    this.add({ update: () => { const alone = G0(this).net.count() < 2 || G0(this).mode === 'race'; box.climb = alone; v.visible = alone; } });
    this.triggers.push({ p0: s.p0, p1: s.p0 + 6 / this.spiral.R(s.p0), fn: () => this.G.mode === 'race' || this.G.ui.toast(this.G.net.count() < 2 ? 'A two-hero wall. You are alone, so the vines are out for you.' : 'Too sheer to climb alone. One of you boosts the other (E beside them), then the one on top pegs a rope (T) or whips the other up.', 7), repeat: 30 });
  }
  // Online only. A gate that stays up only while someone stands on a plate: one holds it, the other goes through and holds the far plate.
  b_teamgate(s) {
    const w = s.w, f = s.at(15, 0, 0), box = this.addBox(f.x, f.y + 3.5, f.z, w + 4, 4.5, 0.6, f.th, null, { noHook: true, noGrab: true });
    const g = new THREE.Group(); for (let i = 0; i < 7; i++) { const l = M.cyl(0x4a4a52, 0.34, (w + 4) * 2, 0, 0.4 + i * 0.78, 0); l.rotation.z = Math.PI / 2; g.add(l); } for (const x of [-w - 2, -w / 2, 0, w / 2, w + 2]) g.add(M.cyl(0x2a2a32, 0.18, 7, x, 3.3, 0.4)); this.deco(s, 15, 0, 0, g); const gy = g.position.y;
    const plates = [8, 22].map(a => { const q = s.at(a, 0, 0), m = M.cyl(0x54a6d6, 1.7, 0.16, q.x, q.y + 0.08, q.z, { e: 0x103a55 }); m.castShadow = false; this.scene.add(m); return { x: q.x, y: q.y, z: q.z, m }; });
    const id = this.def.id, on = (px, py, pz) => plates.some(p => Math.hypot(px - p.x, pz - p.z) < 1.9 && Math.abs(py - p.y) < 2);
    this.add({ update: dt => { const G = this.G, N = G.net, P = G.player.pos; let open = N.count() < 2 || G.mode === 'race' || (G.world === this && on(P.x, P.y, P.z)); if (!open) for (const q of N.peers.values()) if (q.r === id && on(q.x, q.y, q.z)) { open = true; break; }
      if (open !== !box.solid) { box.solid = !open; G.world === this && Math.hypot(P.x - f.x, P.z - f.z) < 40 && G.audio.sfx(open ? 'camp' : 'crumble'); } g.position.y += ((open ? gy - 7.5 : gy) - g.position.y) * Math.min(1, 6 * dt); for (const p of plates) p.m.material = M.mat(open ? 0x7ee07a : 0x54a6d6, { e: open ? 0x1a5a1a : 0x103a55 }); } });
    this.triggers.push({ p0: s.p0, p1: s.p0 + 6 / this.spiral.R(s.p0), fn: () => this.G.mode === 'race' || this.G.ui.toast(this.G.net.count() < 2 ? 'A two-hero gate. You are alone, so it stands open.' : 'The gate only stays down while someone stands on a blue plate. One of you hold it; the other go through and hold the plate on the far side.', 7), repeat: 30 });
  }
  // Fallen trees across the trail: hop the low ones, crawl or slide under the high ones.
  b_logs(s) {
    const w = s.w;
    for (let i = 0; i < s.n; i++) {
      const a = 8 + i * 6, kind = i % 3, f = s.at(a, 0, 0), tilt = (i % 2 ? 1 : -1) * 0.12, th = f.th + tilt;
      if (kind === 0) { this.addBox(f.x, f.y + 0.42, f.z, w + 3, 0.45, 0.45, th, LOG, { log: 2 }); const c = s.at(a, 0, 2.2); this.coin(c.x, c.y, c.z); }
      else if (kind === 1) { this.addBox(f.x, f.y + 1.72, f.z, w + 3, 0.55, 0.55, th, LOG, { log: 1 }); for (const l of [-w - 0.5, w + 0.5]) { const r = s.at(a, l, 0); this.addCyl(r.x, r.y + 0.55, r.z, 1.1, 0.62, ROCK); } this.coinLine(s, a - 1.5, a + 1.5, 0, 0.5, 3); }
      else { this.addBox(f.x, f.y + 0.42, f.z, w + 3, 0.45, 0.45, th, LOG, { log: 1 }); const f2 = s.at(a + 0.75, 0, 0); this.addBox(f2.x, f2.y + 1.25, f2.z, w + 3, 0.42, 0.42, f2.th - tilt, LOG, { log: 2 }); const c = s.at(a + 0.4, 0, 3.2); this.coin(c.x, c.y, c.z); }
    }
  }
  // A rockslide heaped across the trail: scramble up and over it.
  b_rockfall(s) {
    const w = s.w, R = this.rnd;
    for (let i = 0; i < s.n; i++) {
      const a = 7 + i * 2.7, peak = Math.sin((i + 0.5) / s.n * Math.PI), h = 0.9 + peak * (s.high || 2.6);
      for (let l = -w - 1.5; l <= w + 1.6; l += 2.3) { const hh = h + (R() - 0.5) * 0.7, r = 1.45 + R() * 0.45, f = s.at(a + (R() - 0.5) * 0.6, l + (R() - 0.5) * 0.5, 0); this.addCyl(f.x, f.y + hh / 2 - 0.5, f.z, r, hh / 2 + 0.5, ROCK); }
      if (i % 2 === 0) { const c = s.at(a, 0, h + 1.4); this.coin(c.x, c.y, c.z); }
    }
  }
  b_climb(s) {
    const w = s.w + 1.5, r = s.rise; { const f = s.at(6, 0, 0); this.addBox(f.x, s.y0 + (r - 1) / 2 + 0.015, f.z, w, (r + 1) / 2, 2.4, f.th, ROCK, { climb: true }); }
    this.deco(s, 3.46, 0, r / 2, this.vines((w - 0.6) * 2, r), 0);
    for (let i = 0; i < 5; i++) { const f = s.at(3.1, (i - 2) * 1.6, 1.5 + i % 3 * (r - 2.5) / 2); this.coin(f.x, f.y, f.z); }
  }
  b_cliff(s) {
    const w = s.w + 1.5, r = s.rise; { const f = s.at(6, 0, 0); this.addBox(f.x, s.y0 + (r - 1) / 2 + 0.015, f.z, w, (r + 1) / 2, 2.4, f.th, ROCK); }
    for (const l of [-2.5, 2.5]) { this.anchor(s, 2.5, l, r + 3.1, 'grapple'); this.deco(s, 4.4, l, r + 1.6, M.cyl(0x5a3c22, 0.2, 3.2, 0, 0, 0)); const br = M.cyl(0x5a3c22, 0.13, 3, 0, 0, 0); br.rotation.x = Math.PI / 2; this.deco(s, 3.2, l, r + 3.1, br); this.slimb(s, 1.8, l, r + 3.1, 4.6, l, r + 3.1); this.slimb(s, 4.4, l, r, 4.4, l, r + 3.2); }
  }
  b_chasm(s) {
    const { a0, a1 } = this.pit(s); for (const l of [-2, 2]) { this.anchor(s, a1 - 0.9, l, 3.4, 'grapple'); this.deco(s, a1 + 0.9, l, 1.7, M.cyl(0x5a3c22, 0.2, 3.4, 0, 0, 0)); const br = M.cyl(0x5a3c22, 0.13, 2.8, 0, 0, 0); br.rotation.x = Math.PI / 2; this.deco(s, a1 - 0.2, l, 3.4, br); this.slimb(s, a1 - 1.6, l, 3.4, a1 + 1.2, l, 3.4); this.slimb(s, a1 + 0.9, l, 0, a1 + 0.9, l, 3.4); }
    this.coinLine(s, a0 + 3, a1 - 3, 0, 2.2);
  }
  b_swing(s) {
    const { a0, d } = this.pit(s);
    for (let i = 0; i < s.n; i++) { const a = a0 + 5.5 + i * 11; this.anchors.push(Object.assign(s.at(a, 0, 8.45), { kind: 'whip' })); this.deco(s, a, 0, 0, M.whipPost(7.5, d)); this.slimb(s, a, -3.6, 8.15, a, 1.9, 8.75); this.coinLine(s, a - 3, a + 3, 0, q => 0.6 - Math.sin(q * Math.PI) * 1.2, 4); }
  }
  b_beam(s) {
    const { a0, d } = this.pit(s), L = s.L;
    for (let i = 0; i < s.n; i++) {
      const a = a0 + L / 2 + i * (L + 3); const lg = this.sb(s, a, 0, -0.25, 0.3, 0.25, L / 2 + 0.15, LOG, { beam: true }); this.coinLine(s, a - L / 2 + 2, a + L / 2 - 2, 0, 1.1);
      if (i < s.n - 1) this.sb(s, a + L / 2 + 1.5, 0, -(d + 1) / 2, 1.5, (d + 1) / 2, 1.5, ROCK);
    }
  }
  b_crawl(s) {
    const w = s.w; this.sb(s, 8, -(w + 8.8) / 2, -1, (w + 8 - 0.8) / 2, 8, 4, ROCK); this.sb(s, 8, (w + 6.8) / 2, -1, (w + 6 - 0.8) / 2, 8, 4, ROCK); this.sb(s, 8, 0, 1.15 + 2.9, 0.85, 2.9, 4, ROCK);
    this.coinLine(s, 5, 11, 0, 0.5, 4);
  }
  b_glide(s) {
    const { a0, a1, d } = this.pit(s, { a0: 12 }); this.sb(s, 6, -2.5, 2.5, 2.2, 2.5, 2.6, ROCK, { climb: true }); this.deco(s, 3.36, -2.5, 2.5, this.vines(3.6, 5), 0);
    const span = a1 - a0;
    const nd = Math.max(2, Math.round(span / 20)); for (let i = 0; i < nd; i++) { const q = (i + 0.7) / (nd + 0.4), f = s.at(a0 + span * q, 0, 0); this.drafts.push({ x: f.x, z: f.z, r: 6.5, y0: f.y - d, y1: f.y + 18, str: 46 }); const m = M.cyl(0xffffff, 6.5, d + 18, f.x, f.y + (18 - d) / 2, f.z, { op: 0.13 }); m.castShadow = false; this.scene.add(m); this.coinLine(s, a0 + span * q, a0 + span * q, 0, u => 3 + u * 6, 4); }
  }
  b_river(s) {
    const ac = s.ac = (s.cross - s.p0) / (s.p1 - s.p0) * s.len, st = s.style || 'stones';
    if (st === 'stones') [-11.4, -7.6, -3.8, 0, 3.8, 7.6, 11.4].forEach((o, i) => { const f = s.at(ac + o, i % 2 ? 1.7 : -1.7, -2.4), sink = i % 2 === 1; this.addCyl(f.x, f.y, f.z, sink ? 0.8 : 0.95, 2.2, ROCK, sink ? { crumble: true, noGrab: true } : {}); this.coin(f.x, f.y + 3.4, f.z); });
    else if (st === 'log') { for (const [o, l] of [[-8.7, 0.9], [0, -0.9], [8.7, 0.9]]) this.sb(s, ac + o, l, -0.3, 0.42, 0.3, 3.1, LOG, { beam: true }); this.coinLine(s, ac - 10, ac + 10, 0, 1.1); }
    else if (st === 'swing') for (const o of [-9.6, 0, 9.6]) { this.anchors.push(Object.assign(s.at(ac + o, 0, 8.45), { kind: 'whip' })); this.deco(s, ac + o, 0, 0, M.whipPost(7.5, 3)); this.slimb(s, ac + o, -3.6, 8.15, ac + o, 1.9, 8.75); this.coinLine(s, ac + o - 3, ac + o + 3, 0, q => 0.8 - Math.sin(q * Math.PI) * 1.2, 4); }
    else if (st === 'raft') { const f = s.at(ac, 0, -1.1); this.addBox(f.x, f.y, f.z, 1.6, 0.25, 1.6, f.th, PLANK, { mover: (t, b) => { const q = Math.sin(t * 0.5) * 11.6; b.x = f.x + f.tx * q; b.z = f.z + f.tz * q; } }); }
    else if (st === 'hook') { for (const l of [-1.5, 1.5]) { this.anchor(s, ac + 12.2, l, 3.3, 'grapple'); this.deco(s, ac + 14, l, 1.6, M.cyl(0x5a3c22, 0.2, 3.2, 0, 0, 0)); const br = M.cyl(0x5a3c22, 0.13, 3, 0, 0, 0); br.rotation.x = Math.PI / 2; this.deco(s, ac + 12.7, l, 3.3, br); this.slimb(s, ac + 11.2, l, 3.3, ac + 14.2, l, 3.3); this.slimb(s, ac + 14, l, 0, ac + 14, l, 3.2); } }
    else if (st === 'planks') for (let o = -10.4; o <= 10.5; o += 2.6) this.sb(s, ac + o, 0, -0.2, 1.2, 0.18, 1.2, PLANK, { crumble: true, noGrab: true });
    this.add(new Pike(this, s, ac));
    const sg = M.sign(); this.deco(s, ac - 15.5, -s.w + 1, 0, sg, Math.PI / 2); sg.position.y = this.T.hAt(sg.position.x, sg.position.z);
  }
  b_camp(s) {
    const sp = this.spiral, idx = ++this.campN, f = this.ground(s, 9, -2.5); const cmp = this.add(new Camp(this, f.x, f.z, idx)); cmp.sec = s; this.camps.push(cmp);
    const t1 = M.tent(0xc9a25a); this.deco(s, 5, -5.5, 0, t1, Math.PI); const t2 = M.tent(0xb5652a); this.deco(s, 13, -6, 0, t2, Math.PI);
    // the rope net down the cliff
    const phi = s.p0 + (21 / s.len) * (s.p1 - s.p0), dY = sp.trailY(phi) - sp.groundY(phi - TAU), cw = clamp(Math.abs(dY) / 1.6, 1.5, sp.P - s.w - 5), l0 = s.w - 1.5, l1 = s.w + cw + 2.5, c = sp.frame(phi, (l0 + l1) / 2, 0), hl = (l1 - l0) / 2;
    const pts = [], uv = [], ix = []; let k = 0; for (let q = -hl; q <= hl + 0.01; q += 1, k++) { for (const sd of [-2.2, 2.2]) { const x = c.x + c.nx * q + c.tx * sd, z = c.z + c.nz * q + c.tz * sd; pts.push(x, this.T.hAt(x, z) + 0.18, z); uv.push(sd < 0 ? 0 : 3, k * 0.7); } if (k) { const a = (k - 1) * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(ix); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.netMat()); mesh.visible = false; this.scene.add(mesh); const net = { x: c.x, z: c.z, ax: c.nx, az: c.nz, hx: hl, hz: 2.2, active: false, mesh }; this.nets[idx - 1] = net; if (cmp.lit) { net.active = true; mesh.visible = true; }
    s.spawn = this.ground(s, 5, 0);
  }
  netMat() { if (this._nm) return this._nm; const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.strokeStyle = '#8a6238'; g.lineWidth = 7; g.strokeRect(0, 0, 64, 64); g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.lineWidth = 3; g.stroke(); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return this._nm = new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }); }
  b_ramp(s) { const f = this.ground(s, s.len - 3, -2.6); this.add(new Roller(this, f.x, f.z, { every: s.every || 3.6, range: s.len + 25, px: -f.tx * 1.5, pz: -f.tz * 1.5, make: () => ({ sec: s, a: s.len - 6, end: 2.5, sp: s.bsp || 11 }) })); }
  b_traps(s) { for (let i = 0; i < s.n; i++) { const a = 7 + i * 7, k = s.kind === 'mix' ? ['spikes', 'logs', 'darts'][i % 3] : s.kind; this.add(k === 'spikes' ? new Spikes(this, s, a, i * 0.7) : k === 'logs' ? new Pendulum(this, s, a, i * 1.1) : new DartTotem(this, s, a, i * 0.55)); } }
  b_goal(s) { const f = this.ground(s, s.len - 5, 0); this.add(new Gate(this, f.x, f.z, f.yaw, { title: 'The top of ' + this.def.name, sub: 'Walk through to finish', col: 0xe2b33a, w: 4, go: G => G.completeLevel() })); this.goalAt = f; }
  b_arena(s) {
    const y = this.spiral.Ytop, boss = this.boss = this.add(new Boss(this, y, this.def.story));
    // three gong towers: one to climb, one to grapple, one to bounce up to
    [[0.9, 'climb'], [3.0, 'hook'], [5.1, 'bounce']].forEach(([ang, how]) => {
      const x = Math.cos(ang) * 24, z = Math.sin(ang) * 24; this.addBox(x, y + 3, z, 2.4, 3, 2.4, ang, ROCK, { climb: how === 'climb' });
      if (how === 'climb') { const v = this.vines(4.4, 6); v.position.set(x - Math.cos(ang) * 2.6, y + 3, z - Math.sin(ang) * 2.6); v.rotation.y = -ang + Math.PI / 2; this.scene.add(v); }
      if (how === 'hook') { const ax = x - Math.cos(ang) * 3.4, az = z - Math.sin(ang) * 3.4, bx2 = x - Math.cos(ang) * 1.6, bz2 = z - Math.sin(ang) * 1.6; this.anchors.push({ x: ax, y: y + 8.8, z: az, kind: 'grapple' }); this.scene.add(M.cyl(0x5a3c22, 0.2, 3, bx2, y + 7.5, bz2)); const br = M.cyl(0x5a3c22, 0.13, 2.4, (ax + bx2) / 2, y + 8.8, (az + bz2) / 2); br.rotation.z = Math.PI / 2; br.rotation.y = -ang; this.scene.add(br); this.limb(ax, y + 8.8, az, bx2, y + 8.8, bz2); this.limb(bx2, y + 6, bz2, bx2, y + 9, bz2); }
      if (how === 'bounce') { const mx = x - Math.cos(ang) * 5, mz = z - Math.sin(ang) * 5; this.addCyl(mx, y + 0.92, mz, 1.3, 0.5, null, { bounce: 17 }); const m = M.mushroom(); m.position.set(mx, y, mz); this.scene.add(m); }
      const g = this.add(new Gong(this, x + Math.cos(ang) * 1.5, y + 6, z + Math.sin(ang) * 1.5, boss)); boss.gongs.push(g);
    });
  }

  // ------------------------------------------------------------------ the village
  buildHub() {
    const T = this.T = new Meadow(this.realm, this.G.holes), G = this.G, st = this.def.story; this.scene.add(T.mesh(this.theme)); for (const m of T.waterMeshes(this.waterMat)) this.scene.add(m);
    this.start = { x: 0, y: 0, z: 6, yaw: 0 };
    return this.buildLobby();      // one town for everyone, alone or online
    const put = (m, x, z, yaw = 0) => { m.position.set(x, T.hAt(x, z), z); m.rotation.y = yaw; this.scene.add(m); return m; };
    [[-14, 14, 0.5, 0xb5652a], [14, 16, -0.4, 0x8a4a6a], [-20, -8, 1.4, 0x3f7a8a], [20, -10, -1.4, 0xb5652a], [0, 26, 0, 0x6a8a3a]].forEach(([x, z, yaw, c]) => { put(M.hut(c), x, z, yaw); const hy = T.hAt(x, z); this.addBox(x, hy + 1.5, z, 2.5, 1.5, 2.2, -yaw, null); for (let i = 0; i < 6; i++) { const q = 3.04 * (1 - i / 6) + 0.1; this.addBox(x, hy + 3.2 + i * 0.4, z, q, 0.2, q, -yaw, null); } });
    put(M.cyl(0x8a8378, 1.6, 0.9, 0, 0, 0), 0, -4).position.y += 0.45; this.addCyl(0, 0.45, -4, 1.6, 0.5, null); const wr = M.cyl(0x6b4a2a, 0.1, 2.4, 0, 0, 0); put(wr, 1.4, -4).position.y += 1.2; const wr2 = wr.clone(); put(wr2, -1.4, -4).position.y += 1.2; const roof = M.cone(0xb5332a, 2.2, 1, 0, 0, 0); put(roof, 0, -4).position.y += 2.9;
    // the three trailheads
    const lv = this.def.levels;
    [[-46, -30, Math.PI / 2, 0], [0, -62, 0, 1], [46, -30, -Math.PI / 2, 2]].forEach(([x, z, yaw, i]) => {
      const L = lv[i], S = G.save, lockd = i > 0 && !S.done[lv[i - 1].id];
      for (let k = 0; k < (this.realm ? 0 : 10); k++) { const sd = k % 2 ? 1 : -1, along = 7 + (k >> 1) * 2.2 + this.rnd() * 2, back = this.rnd() * 9 - 2, px = x + Math.cos(yaw) * sd * along - Math.sin(yaw) * -back * (yaw === 0 ? 0 : 1) + (yaw === 0 ? 0 : 0), pz = z + (yaw === 0 ? -back : sd * along), qx = yaw === 0 ? x + sd * along : x + Math.sign(x) * back, sc = 0.8 + this.rnd() * 0.9;
        const m = i === 0 ? M.cone(0x2a6e33, 2 * sc, 6 * sc, 0, 3 * sc, 0, { flat: 1 }) : i === 1 ? M.cone(0xb5683f, 1.6 * sc, 5 * sc, 0, 2.5 * sc, 0, { flat: 1 }) : k % 3 ? M.cone(0xbfe6ff, 1.1 * sc, 4.5 * sc, 0, 2.2 * sc, 0, { flat: 1, e: 0x224455 }) : M.ball(0xf4f8ff, 2.4 * sc, 0, 0.3, 0, { flat: 1 }); const g2 = new THREE.Group(); g2.add(m); put(g2, qx, pz); }
      if (!this.realm) this.add(new Gate(this, x, z, yaw, { title: `${i + 1}. ${L.name}`, sub: this.realm ? 'this way: 150 m' : S.done[L.id] ? 'CLEARED  \u2714  walk through' : 'OPEN: walk through', lockSub: `LOCKED: clear trail ${i} first`, col: L.col, go: g => { if (!this.realm) g.loadLevel(L.id); }, locked: g => !this.realm && i > 0 && !g.save.done[lv[i - 1].id], lockName: g => 'Gate', lockText: g => `That trail starts where ${lv[Math.max(0, i - 1)].name} ends. Climb that first.` }));
      const sx = x - Math.sin(yaw) * 0 + Math.cos(yaw) * 6.5, sz = z + Math.sin(yaw) * 6.5 * 0 + (yaw === 0 ? 0 : 0); const sg = put(M.sign(), x + (yaw === 0 ? 6.5 : 0), z + (yaw === 0 ? 0 : 6.5), yaw + Math.PI);
      this.add(new NPC(this, sg.position.x, sg.position.z, { name: 'the sign', model: new THREE.Group(), prompt: 'Read the sign', lines: g => [{ who: 'Trail sign', text: `${L.name}. ${L.blurb}` }] }));
    });
    // villagers
    this.add(new NPC(this, 3.5, 0, { name: 'Old Barnaby', model: M.biped({ shirt: 0x8a6a3a, pants: 0x4a4030, hair: 0xdddddd, beard: 0xdddddd, hat: 0x5a4630 }), lines: st.barnaby }));
    put(M.stall(), -8, -14, 0.6); this.addBox(-8, 0.5, -14, 1.4, 0.6, 0.6, -0.6, null);
    this.add(new NPC(this, -7.3, -15.3, { name: 'Nib', model: M.goblin({ hat: 0xe2b33a, shirt: 0x3b6fb5 }), lines: st.nib, after: g => g.ui.shop() }));
    this.add(new NPC(this, 8, -12, { name: 'Dame Hilda', model: M.biped({ shirt: 0x9aa0aa, pants: 0x5a5f6a, hair: 0xb5332a, helm: 0x9aa0aa, cape: 0x3b6fb5 }), lines: st.hildaHub }));
    this.add(new NPC(this, -5, 9, { name: 'Pip', model: M.biped({ scale: 0.6, shirt: 0xe2b33a, pants: 0x3b6fb5, hair: 0x3a2a1c }), lines: st.pip }));
    const board = put(M.box(0xc9a25a, 2.6, 1.8, 0.14, 0, 0, 0), 6, -24, -0.3); board.position.y += 1.7; put(M.cyl(0x6b4a2a, 0.09, 2.6, 0, 0, 0), 6, -24).position.y += 1.3;
    this.add(new NPC(this, 6, -23.4, { name: 'map', model: new THREE.Group(), prompt: 'Look at the map (M)', lines: null })).use = () => G.ui.toggleMap(true);
    // practice yard: jumps, a vine wall, a beam over the pond
    this.addBox(-34, -0.35, 30, 0.3, 0.25, 15.5, 0, LOG, { beam: true }); for (let i = 0; i < 6; i++) this.coin(-34, 1, 20 + i * 4);
    put(M.whipPost(8), 30, 44); this.limb(26.4, 8.65, 44, 31.9, 9.25, 44);
    buildVillage(this);
    for (let i = 0; i < 26; i++) { const a = i / 26 * TAU; this.coin(Math.cos(a) * 16, 1, Math.sin(a) * 16 - 4); }
    // the mountain itself, looming to the north
    if (this.realm) buildLowlands(this);
    if (!this.realm) { const mt = new THREE.Mesh(new THREE.ConeGeometry(190, 330, 9), M.mat(0x6f7a72, { flat: 1 })); mt.position.set(0, 150, -330); const cap = new THREE.Mesh(new THREE.ConeGeometry(64, 112, 9), M.mat(0xf2f6fa, { flat: 1 })); cap.position.set(0, 261, -330); const m2 = new THREE.Mesh(new THREE.ConeGeometry(150, 190, 7), M.mat(0x5c7a54, { flat: 1 })); m2.position.set(-170, 80, -290); const m3 = new THREE.Mesh(new THREE.ConeGeometry(140, 170, 7), M.mat(0x9a6a4a, { flat: 1 })); m3.position.set(180, 70, -280); this.scene.add(mt, cap, m2, m3); }
  }

  // The online starting camp: a fenced yard where players gather while the host picks the mountain and the mode.
  // Online: a simple town in open country. Two people matter and both stand under a tall beam: the Trail Master (choose the climb) and Nib (upgrades).
  buildLobby() {
    const T = this.T, S = this.scene, G = this.G, put = (m, x, z, yaw = 0, dy = 0) => { m.position.set(x, T.hAt(x, z) + dy, z); m.rotation.y = yaw; S.add(m); return m; };
    [[-16, 14, 0.5, 0xb5652a], [16, 16, -0.4, 0x8a4a6a], [-24, -10, 1.4, 0x3f7a8a], [24, -12, -1.4, 0xb5652a]].forEach(([x, z, yaw, c]) => { put(M.hut(c), x, z, yaw); const hy = T.hAt(x, z); this.addBox(x, hy + 1.5, z, 2.5, 1.5, 2.2, -yaw, null); for (let i = 0; i < 6; i++) { const q = 3.04 * (1 - i / 6) + 0.1; this.addBox(x, hy + 3.2 + i * 0.4, z, q, 0.2, q, -yaw, null); } });
    const station = (x, z, col, title, sub, model, o) => {
      const beam = M.cyl(col, 0.9, 60, x, 30, z, { e: col, op: 0.22 }); beam.castShadow = false; S.add(beam); const ring = M.cyl(col, 2.6, 0.08, x, T.hAt(x, z) + 0.05, z, { e: col, op: 0.5 }); ring.castShadow = false; S.add(ring);
      for (const sd of [1, -1]) { const b = M.signBoard(title, sub, '#' + new THREE.Color(col).getHexString(), 8, 2.65); b.position.set(x, 5.2, z + sd * 0.06 - 1.6); b.rotation.y = sd > 0 ? 0 : Math.PI; S.add(b); } S.add(M.cyl(0x6b4a2a, 0.14, 4, x - 3.3, 2, z - 1.6), M.cyl(0x6b4a2a, 0.14, 4, x + 3.3, 2, z - 1.6));
      return this.add(new NPC(this, x, z, Object.assign({ name: title, model, yaw: Math.PI, fixed: true, reach: 3.6 }, o)));
    };
    const tm = station(-8, -8, 0xd8362c, 'CLIMBS', 'choose the mountain here', M.biped({ shirt: 0xb5332a, pants: 0x4a4030, hair: 0xdddddd, beard: 0xdddddd, hat: 0x5a4630, cape: 0xb5332a }), { prompt: 'Choose the climb', lines: [] });
    tm.use = () => !G.coop ? G.ui.dialog(LEVELS.hub.story.barnaby(G)) : G.ui.toast(G.net.isHost ? 'You are the host: 1 2 3 picks the mountain, G switches Race or Team, ENTER starts the countdown.' : 'Only the host can choose. Stand by and get ready.', 5); this.mapAt = { x: -8, z: -8 };
    put(M.stall(), 8, -9.6, 0); this.addBox(8, 0.5, -9.6, 1.4, 0.6, 0.6, 0, null);
    station(8, -8, 0xe2b33a, 'UPGRADES', 'spend your coins here', M.goblin({ hat: 0xe2b33a, shirt: 0x3b6fb5 }), { prompt: 'Buy upgrades', lines: [], after: g => g.ui.shop() });
    put(M.cyl(0x8a8378, 1.6, 0.9, 0, 0, 0), 0, 2).position.y += 0.45; this.addCyl(0, 0.45, 2, 1.6, 0.5, null);
    this.start = { x: 0, y: 0, z: 10, yaw: 0 };
    buildVillage(this, true); if (this.realm) buildLowlands(this);
  }
  scatter() {
    const T = this.T, th = this.theme, r = this.rnd, pts = [], rocks = [], sp = this.spiral, n = { x: 0, y: 1, z: 0 };
    const many = this.realm && !sp; for (let i = 0; i < (many ? 30000 : 6000) && pts.length < (many ? 2200 : 620); i++) {
      const x = (r() - 0.5) * 2 * (T.S - 12), z = (r() - 0.5) * 2 * (T.S - 12), y = T.hAt(x, z); T.normalAt(x, z, n); if (n.y < 0.9 || T.waterY(x, z) > y - 0.2) continue;
      if (sp) { sp.h(x, z); if (sp.info.kind === 1 || sp.info.kind === 3 || Math.abs(sp.info.lat) < sp.width(sp.info.phi) + 1.5 && sp.info.phi > -0.5 && sp.info.phi < sp.PHI + 0.5) continue; if (Math.hypot(x, z) < sp.R(sp.PHI) + 4 || this.realm && Math.hypot(x, z) > sp.R0 + 82) continue; }
      else { if (this.realm && T.holes.some(h => Math.hypot(x - h.x, z - h.z) < h.r + 88)) continue; if (Math.hypot(x, z) < 34 || Math.abs(x) < 5 && z < 10 && z > -66 || Math.abs(z + 30) < 5 && Math.abs(x) < 50 || x > 16 && x < 54 && z > 16 && z < 46) continue; }
      (r() < 0.82 ? pts : rocks).push([x, y, z, 0.7 + r() * 0.8, r() * 6]);
    }
    for (const p of pts) this.limb(p[0], p[1] + 2.2 * p[3], p[2], p[0], p[1] + 6.2 * p[3], p[2]);
    const mk = (geo, color, list, fn) => { const im = new THREE.InstancedMesh(geo, M.mat(color, { flat: 1 }), list.length); const d = new THREE.Object3D(); list.forEach((p, i) => { fn(d, p); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }); im.castShadow = true; im.receiveShadow = true; this.scene.add(im); };
    const dead = this.def.theme === 'gorge';
    mk(M.GEO.cylG, th.trunk, pts, (d, p) => { d.position.set(p[0], p[1] + 1.2 * p[3], p[2]); d.scale.set(0.28 * p[3], 2.6 * p[3], 0.28 * p[3]); d.rotation.set(0, 0, 0); });
    mk(M.GEO.coneG, th.tree[0], pts, (d, p) => { d.position.set(p[0], p[1] + 3.6 * p[3], p[2]); d.scale.set((dead ? 1.3 : 2.1) * p[3], 4.2 * p[3], (dead ? 1.3 : 2.1) * p[3]); d.rotation.set(0, p[4], 0); });
    mk(M.GEO.coneG, th.tree[1], pts, (d, p) => { d.position.set(p[0], p[1] + 5.4 * p[3], p[2]); d.scale.set((dead ? 0.9 : 1.5) * p[3], 3.2 * p[3], (dead ? 0.9 : 1.5) * p[3]); d.rotation.set(0, p[4] + 1, 0); });
    mk(M.GEO.icoG, th.rockCol, rocks, (d, p) => { d.position.set(p[0], p[1] + 0.3, p[2]); d.scale.set(1.2 * p[3], 0.9 * p[3], 1.1 * p[3]); d.rotation.set(p[4], p[4] * 2, 0); });
  }

  // Where should the player head next? Village: the first gate not yet cleared. Mountain: a point a little way up the trail.
  guide() {
    const G = this.G, S = G.save, p = G.player.pos, sp = this.spiral; if (this.def.lobby) return null; if (G.callMark && G.callMark.t > 0 && G.callMark.r === this.def.id) return { x: G.callMark.x, y: G.callMark.y + 2.2, z: G.callMark.z, label: G.callMark.n, text: G.callMark.n + ' needs help: follow the arrow to them' };
    if (!sp) {
      const lv = this.def.levels, i = lv.findIndex(L => !S.done[L.id]) < 0 || S.won ? -1 : lv.findIndex(L => !S.done[L.id]); if (i < 0) return null;
      const g = G.trailhead ? G.trailhead(i) : [[-46, -30], [0, -62], [46, -30]][i]; return { x: g[0], y: 3, z: g[1], label: lv[i].name, text: G.trailhead ? `Head ${['west', 'north', 'east'][i]} to the foot of ${lv[i].name}` : `Walk through the ${['west', 'north', 'east'][i]} gate to ${lv[i].name}` };
    }
    sp.toRoute(p.x, p.z, rt); const phi = clamp(rt.phi, 0, sp.PHI), R = sp.R(phi);
    let nc = null; for (const c of this.camps) if (c.sec.p0 > phi + 4 / R) { nc = c; break; }
    const endName = this.boss ? 'the summit' : 'the top gate', toPhi = nc ? nc.sec.p0 : sp.PHI, dist = Math.round((toPhi - phi) * (sp.R(phi) + sp.R(toPhi)) / 2);
    const text = `Follow the trail · ${nc ? 'next camp, ' + nc.sec.name : endName}: ${Math.max(0, dist)} m`;
    if (sp.PHI - phi < 34 / R) { if (this.boss) return this.boss.phase >= 5 ? { x: -7, y: sp.Ytop + 2, z: 0, label: 'Princess', text: 'Talk to the Princess' } : { x: 0, y: sp.Ytop + 3, z: 0, label: 'Chieftain', text: 'Ring the three gongs around the throne with your whip, then whip the Chieftain' }; const g = this.goalAt; return { x: g.x, y: g.y + 3, z: g.z, label: 'Gate', text: 'Walk through the gate' }; }
    const off = Math.abs(rt.lat) > sp.width(phi) + 3 || Math.abs(p.y - sp.trailY(phi)) > 12, f = sp.frame(Math.min(sp.PHI, phi + (off ? 4 : 32) / R), 0, 1.6);
    return { x: f.x, y: f.y, z: f.z, label: off ? 'Trail' : 'This way', text: off ? 'Get back onto the trail and follow it up. Lit camps have a rope net up the cliff.' : text };
  }

  // ------------------------------------------------------------------ queries
  // The hook only holds on things belonging to the stretch of trail you are on: not on the great faces up to the next level.
  hookOk(p, t) {
    const sp = this.spiral; if (!sp) return true; const P = this.G.player, b = this._hb = this._hb || { phi: 0, lat: 0 }; let phiP = P.routePhi;
    if (phiP === undefined) { sp.toRoute(p.x, p.z, b); phiP = b.phi; while (phiP > 0 && sp.groundY(Math.min(phiP, sp.PHI)) > p.y + 5) phiP -= TAU; P.routePhi = phiP; } phiP = clamp(phiP, 0, sp.PHI);
    if (phiP > sp.PHI - 0.45 && Math.hypot(t.x, t.z) < sp.R(sp.PHI) + 12) return true;      // the summit itself, once you have walked up to it
    sp.toRoute(t.x, t.z, b); const ahead = Math.min(sp.PHI, phiP + 30 / sp.R(phiP)), top = Math.max(sp.trailY(phiP), sp.trailY(ahead)) + (t.ter ? 6 : 9);
    const bp = clamp(b.phi, 0, sp.PHI); return b.phi < phiP + 1.2 && t.y < top && t.y < Math.max(sp.trailY(bp), sp.trailY(Math.min(sp.PHI, bp + 14 / sp.R(bp)))) + (t.ter ? 6 : 9);
  }
  inNet(x, z) { for (const n of this.nets) { if (!n || !n.active) continue; const dx = x - n.x, dz = z - n.z; if (Math.abs(dx * n.ax + dz * n.az) < n.hx && Math.abs(-dx * n.az + dz * n.ax) < n.hz) return true; } return false; }
  iceAt(x, z) { if (!this.iceR.length) return false; this.spiral.toRoute(x, z, rt); for (const r of this.iceR) if (rt.phi >= r[0] && rt.phi <= r[1]) return true; return false; }
  updraftAt(x, y, z) { for (const d of this.drafts) if (y > d.y0 && y < d.y1 && (x - d.x) * (x - d.x) + (z - d.z) * (z - d.z) < d.r * d.r) return d.str; return 0; }
  raycast(x, y, z, dx, dy, dz, max) {
    for (let t = 1; t < max; t += 0.25) {
      const px = x + dx * t, py = y + dy * t, pz = z + dz * t; if (py < this.T.hAt(px, pz)) return { x: px, y: py, z: pz, b: null };
      for (const b of this.boxes) { if (!b.solid || Math.abs(py - b.y) > b.hy) continue; const ex = px - b.x, ez = pz - b.z; if (b.r ? ex * ex + ez * ez < b.r * b.r : Math.abs(ex * b.ax + ez * b.az) < b.hx && Math.abs(-ex * b.az + ez * b.ax) < b.hz) return { x: px, y: py, z: pz, b }; }
    }
    return null;
  }
  whipHit(P, range) {
    const p = P.pos, L = P.look, ey = p.y + P.eye; let any = this.G.net.whipPull(P, range);
    for (const e of this.ents) {
      if (e.dead || !(e.mob || e.hittable)) continue; const h = e.k ? e.k.h : e.h, dx = e.x - p.x, dy = e.y + h * 0.5 - ey, dz = e.z - p.z, d = Math.hypot(dx, dy, dz); if (d > range + (e.k ? e.k.r : e.r)) continue;
      if (d < 1.6 || (dx * L.x + dy * L.y + dz * L.z) / d > 0.45) { e.hit(1 + (this.G.save.upg.heavy || 0), p.x, p.z); any = true; }
    }
    if (this.G.save.relics.thunder) for (const e of this.ents) if (!e.dead && e.mob && Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z) < 4.5 + e.k.r) { e.hit(1, p.x, p.z); any = true; }
    const t = 3.5; this.puff(p.x + L.x * t, ey + L.y * t, p.z + L.z * t, 0xfff2c0, any ? 6 : 2); return any;
  }
  throwBomb(P) { const S = this.G.save; if (!(S.bombs > 0)) { this.G.audio.sfx('nope'); this.G.ui.toast('No squibs. Nib sells them.', 2); return; } S.bombs--; const L = P.look; this.add(new Bomb(this, P.pos.x + L.x, P.pos.y + P.eye, P.pos.z + L.z, L.x * 15 + P.vel.x * 0.5, L.y * 15 + 5, L.z * 15 + P.vel.z * 0.5, true)); this.G.audio.sfx('throw'); }
  // A two-handed shove at whatever is right in front: friends always, goblins too until you have the whip.
  // A punch at whatever is right in front. It always lands on friends (as a shove); on goblins until you have the whip.
  pushHit(P, mobs) {
    const p = P.pos, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let any = this.G.net.pushFriend(P, fx, fz);
    if (mobs) for (const e of this.ents) { if (!(e.mob || e.hittable) || e.dead) continue; const r = e.k ? e.k.r : e.r, dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz); if (d < 2.2 + r && Math.abs(e.y - p.y) < 2.6 && (dx * fx + dz * fz) / (d || 1) > 0.4) { any = true; this.puff(e.x - fx * r, e.y + 1.1, e.z - fz * r, 0xfff2c0, 7); if (e.mob) { e.hit(0.5, p.x, p.z); if (!e.dead && !e.k.slam && !e.k.thrower) e.move(fx * 1.6, fz * 1.6); } else e.hit(1, p.x, p.z); } }
    return any;
  }
  cannonBlast(t) { for (const e of this.ents) if (e.mob && !e.dead && Math.hypot(e.x - t.x, e.y - t.y, e.z - t.z) < 3.5) e.hit(1, t.x, t.z); }
  puff(x, y, z, color, n) { for (let i = 0; i < n; i++) { const q = this.parts[this.pi = (this.pi + 1) % this.parts.length]; q.m.position.set(x, y, z); q.m.material.color.set(color); q.v.set((Math.random() - 0.5) * 5, Math.random() * 4 + 1, (Math.random() - 0.5) * 5); q.life = 0.5 + Math.random() * 0.3; q.m.visible = true; } }

  update(dt) {
    const G = this.G, P = G.player, p = P.pos, t = G.time;
    for (const b of this.movers) { const ox = b.x, oy = b.y, oz = b.z; b.mover(t, b); b.dx = b.x - ox; b.dy = b.y - oy; b.dz = b.z - oz; b.mesh.position.set(b.x, b.y, b.z); }
    for (const b of this.boxes) if (b.crT) {
      b.crT += dt; const m = b.mesh;
      if (b.crT < 0.7) { m.position.x = b.x + Math.sin(t * 60) * 0.04; } else if (b.crT < 5) { if (b.solid) { b.solid = false; G.audio.sfx('crumble'); } m.position.y -= (b.crT - 0.7) * 22 * dt; m.visible = b.crT < 2.2; } else { b.solid = true; b.crT = 0; m.position.set(b.x, b.y, b.z); m.visible = true; }
    }
    let rm = false; for (const e of this.ents) { if (!e.dead) e.update(dt); else rm = true; } if (rm) this.ents = this.ents.filter(e => !e.dead);
    if (this.mobs) { const N = G.net, id = this.def.id; for (const m of this.mobs) if (m.dead && m.mi >= 0 && (m.rsT -= dt) <= 0 && N.owns(this) && Math.hypot(p.x - m.hx, p.z - m.hz) > 38 && ![...N.peers.values()].some(q => q.r === id && Math.hypot(q.x - m.hx, q.z - m.hz) < 38)) { m.revive(); N.send({ t: 'mr', r: id, i: m.mi }); } }
    // interact prompt
    let use = null; for (const e of this.ents) if (e.canUse) { use = e; break; } this.useEnt = G.locked ? null : use; G.ui.prompt(this.useEnt ? this.useEnt.prompt : null);
    if (this.useEnt && G.input.hit('KeyE')) this.useEnt.use();
    // coins
    const mag = 1.3 + (G.save.upg.magnet || 0) * 2.2, d = this.dummy; let got = 0;
    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i]; if (c.got) continue; const dx = p.x - c.x, dy = p.y + 0.9 - c.y, dz = p.z - c.z;
      if (Math.abs(dx) < 60 && Math.abs(dz) < 60) { if (dx * dx + dy * dy + dz * dz < mag * mag) { c.got = true; got++; (G.took = G.took || []).push([this.def.id, i]); if (G.net.on) G.net.send({ t: 'c', r: this.def.id, i }); if (this.def.hub) G.save.hubCoins[i] = 1; d.position.set(0, -999, 0); d.updateMatrix(); this.coinMesh.setMatrixAt(i, d.matrix); continue; } d.position.set(c.x, c.y + Math.sin(t * 3 + i) * 0.12, c.z); d.rotation.y = t * 3 + i; d.updateMatrix(); this.coinMesh.setMatrixAt(i, d.matrix); }
      else if (!c.init) { c.init = true; d.position.set(c.x, c.y, c.z); d.rotation.y = i; d.updateMatrix(); this.coinMesh.setMatrixAt(i, d.matrix); }
    }
    this.coinMesh.instanceMatrix.needsUpdate = true;
    for (const c of this.loose) {
      const m = c.m.position; c.t += dt; c.vy -= 22 * dt; m.x += c.vx * dt; m.y += c.vy * dt; m.z += c.vz * dt; c.m.rotation.y += dt * 6;
      const gy = this.T.hAt(m.x, m.z) + 0.45; if (m.y < gy) { m.y = gy; c.vy = c.vy < -3 ? -c.vy * 0.45 : 0; c.vx *= 0.6; c.vz *= 0.6; }
      const dx = p.x - m.x, dy = p.y + 0.9 - m.y, dz = p.z - m.z, dd = Math.hypot(dx, dy, dz);
      if (c.t > 0.5 && dd < mag + 2.2) { m.x += dx / dd * 9 * dt; m.y += dy / dd * 9 * dt; m.z += dz / dd * 9 * dt; }
      if (c.t > 0.5 && dd < 1.1) { c.dead = true; got++; } else if (c.t > 25) c.dead = true; else if (c.t > 21) c.m.visible = (t * 8 | 0) % 2 === 0;
      if (c.dead) this.scene.remove(c.m);
    }
    if (this.loose.length && this.loose.some(c => c.dead)) this.loose = this.loose.filter(c => !c.dead);
    if (got) G.addCoins(got, true);
    // story triggers along the trail
    if (this.spiral) {
      const sp = this.spiral; sp.toRoute(p.x, p.z, rt); this.route = rt; if (P.grounded && !P.steep && rt.phi >= -0.3 && rt.phi <= sp.PHI + 0.3 && Math.abs(p.y - sp.groundY(rt.phi)) < 4.5 && Math.abs(rt.lat) < sp.width(rt.phi) + 0.8 && !this.inNet(p.x, p.z)) { P.routePhi = rt.phi; if (Math.abs(p.y - sp.trailY(rt.phi)) < 1.2 && Math.abs(rt.lat) < sp.width(rt.phi) - 1.2 && !G.fall) { const sf = P.safe = P.safe || {}; sf.x = p.x; sf.y = p.y; sf.z = p.z; sf.r = this.def.id; sf.yaw = P.yaw; } }
      if (Math.abs(rt.lat) < 9 && Math.abs(p.y - sp.trailY(rt.phi)) < 7) for (const tr of this.triggers) {
        if (rt.phi < tr.p0 || rt.phi > tr.p1) continue; if (tr.key) { if (G.save.seen[tr.key]) continue; G.save.seen[tr.key] = 1; } else { if (tr.last && t - tr.last < tr.repeat) continue; tr.last = t; } tr.fn();
      }
    }
    for (const q of this.parts) if (q.life > 0) { q.life -= dt; q.v.y -= 9 * dt; q.m.position.addScaledVector(q.v, dt); const s = Math.max(0.01, q.life * 0.35); q.m.scale.setScalar(s); if (q.life <= 0) q.m.visible = false; }
    this.waterTex.offset.y = -t * 0.9;
    [P.aimWhip, P.aimHook].forEach((a, i) => { const s = this.ret[i]; s.visible = !!a && !G.locked; if (a) { s.position.set(a.x, a.y, a.z); const dd = Math.hypot(a.x - p.x, a.y - p.y, a.z - p.z); s.scale.setScalar(0.5 + dd * 0.06 + Math.sin(t * 8) * 0.05 * dd * 0.1); } });
    const lit = this.sun ? this : G; lit.sun.position.set(p.x + 60, p.y + 110, p.z + 40); lit.sun.target.position.set(p.x, p.y, p.z); lit.sky.position.set(p.x, 0, p.z);
  }
}

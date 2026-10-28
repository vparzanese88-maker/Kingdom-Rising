// Kingdom Rising 3D — everyone and everything that moves: the hero, townsfolk, guards, kings, mercenaries,
// pets, monsters and bosses, other players, war engines and horses; plus projectiles, spell effects,
// cast circles, target rings and the data the name plates need. All driven by the shared game state.
import { THREE, K3, PX, TS, TILE } from './core.js';
import { geo } from './geo.js';
import { MB, PRIM } from './mb.js';
import { mats } from './mats.js';
import { makeHumanoid, animateHumanoid, equip } from './chars.js';
import { makeCreature, animateCreature, creatureHeight } from './creatures.js';
import { weaponMesh, WFX, BLADE_LEN } from './weapons.js';
import { fx, rgb } from './fx.js';
import { view } from './camera.js';
import { cardTex } from './texgen.js';
import { buildFlags } from './structures.js';
import { siegeModel } from './siege3d.js';
import { workerPose } from './realm3d.js';

const KR = window.KR, D = KR.D, W = KR.W, G = KR.G, S = KR.S;
const root = new THREE.Group(); root.name = 'actors'; K3.scene.add(root);
const avatars = new Map(); // entity (or 'p:' + peer id for other players) -> avatar
// other players' presence objects are replaced on every update, so they are keyed by their peer id
// (a targeted player is a stand-in with type 'peer' from group.js, and finds the same avatar)
const keyOf = (e) => (e && typeof e.peer === 'string' && (!e.type || e.type === 'peer') ? 'p:' + e.peer : e);
// the hero is drawn on layer 1 in first person: invisible to the camera but still casting a shadow
K3.camera.layers.enable(0);

const HUMAN_KINDS = new Set(['goblin', 'orc', 'bandit', 'lizard', 'skeleton', 'zombie', 'troll', 'ogre', 'giant', 'deathknight', 'lich', 'scarecrow', 'guard', 'harpy']);
const CAST_COL = { fire: '255,140,50', cold: '140,210,255', magic: '200,140,255', poison: '120,230,80', disease: '170,200,90', heal: '255,230,140' };

function lookOf(e) {
  if (e.type === 'player') return e.look;
  if (e.look) return e.look;
  if (e.kind === 'harpy') return { race: 'human', gender: 'f', skin: '#d8b090', hair: '#5a3a22', hairStyle: 3, armor: { kind: 'none', col: e.col, trim: e.col }, wings: e.col };
  return S.mobLook ? S.mobLook(e) : null;
}
function kindOf(e) { return e.type === 'player' || e.type === 'npc' || e.type === 'king' || e.type === 'guard' || e.type === 'merc' ? (e.look && e.look.kind) || 'human' : e.kind || 'human'; }
function lookSig(l) { if (!l) return ''; const a = l.armor || {}; return [l.race, l.gender, l.skin, l.hair, l.hairStyle, a.kind, a.col, a.trim, l.robe, l.helm, l.hat, l.cape, l.weapon, l.offhand, l.back, l.wfx, l.rangeW, l.bare, l.crown, l.sash, l.mask, l.beard, l.noShirt, l.noPants, l.wrap, l.barefoot, l.helmPlume, l.wItem && l.wItem.uid, l.oItem && l.oItem.uid].join('|'); }

// ---------- war engines and other special entities ----------
function warModel(e) {
  const mb = new MB(); const F = D.FACTIONS[e.faction] || {}; const k = e.siege; const parts = {};
  const SC = 1.25;
  if (k === 'archer') {
    for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) mb.cylB('bark', x, 0, z, 0.16, 6.6, '#5a3e24', 8);
    for (const y of [1.8, 4.0]) for (const s of [-1, 1]) { mb.beam('timber', new THREE.Vector3(-1.2, y - 1.4, s * 1.2), new THREE.Vector3(1.2, y, s * 1.2), 0.1, 0.1, '#4a3220'); mb.beam('timber', new THREE.Vector3(s * 1.2, y - 1.4, -1.2), new THREE.Vector3(s * 1.2, y, 1.2), 0.1, 0.1, '#4a3220'); }
    mb.box('planks', 0, 6.6, 0, 3.2, 0.2, 3.2, '#7a5a3a'); for (const s of [-1, 1]) { mb.box('planks', 0, 7.1, s * 1.55, 3.2, 0.9, 0.12, '#6a4a2a'); mb.box('planks', s * 1.55, 7.1, 0, 0.12, 0.9, 3.2, '#6a4a2a'); }
    mb.cyl('timber', 1.4, 8.4, 1.4, 0.05, 3.6, '#3a2818', 6);
    mb.cone('rooftile', 0, 8.6, 0, 2.4, 1.4, '#8a4a30', 4, Math.PI / 4);
    parts.flag = { x: 1.4, y: 10, z: 1.4 };
    parts.archer = { x: 0, y: 6.7, z: 0 };
  } else if (k === 'bell') { /* handled below */ }
  else {
    // stone emplacement with an engine on top
    mb.boxB('stone', 0, -0.4, 0, 3.4, 1.6, 3.4, '#6d665e'); for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { mb.boxB('stone', -1.4 + i * 0.7, 1.2, s * 1.5, 0.45, 0.5, 0.4, '#7d766e'); }
    mb.box('cloth2', 0, 0.6, 1.72, 0.9, 0.7, 0.02, F.banner || '#333333');
  }
  const g = mb.build(); const holder = new THREE.Group(); holder.add(g); holder.scale.setScalar(SC);
  // the engine itself turns and moves
  if (k && k !== 'archer') {
    const em = new MB(); const turret = new THREE.Group(); turret.position.y = 1.2;
    if (k === 'ballista' || k === 'heavyballista') { em.box('timber', 0, 0.6, 0, 0.3, 0.3, 2.4, '#5a3e24'); em.box(k === 'heavyballista' ? 'metalv' : 'timber', 0, 0.62, 0.7, 2.3, 0.14, 0.18, k === 'heavyballista' ? '#8e9298' : '#6a4a2a'); em.box('timber', 0, 0.3, 0, 0.5, 0.6, 0.5, '#4a3220'); parts.bolt = { z: 1 }; }
    else if (k === 'catapult' || k === 'trebuchet') { const big = k === 'trebuchet'; const H = big ? 3.2 : 1.6; for (const s of [-1, 1]) { em.beam('timber', new THREE.Vector3(s * 0.7, 0, -0.8), new THREE.Vector3(s * 0.35, H, 0), 0.14, 0.14, '#6a4a2a'); em.beam('timber', new THREE.Vector3(s * 0.7, 0, 0.8), new THREE.Vector3(s * 0.35, H, 0), 0.14, 0.14, '#6a4a2a'); } em.box('timber', 0, 0.1, 0, 1.6, 0.2, 2.2, '#5a3e24'); parts.armH = H; parts.big = big; }
    else if (k === 'cannon') { em.box('timber', 0, 0.3, -0.2, 0.8, 0.4, 1.4, '#3a2818'); em.cyl('metalv', -0.45, 0.35, -0.2, 0.32, 0.12, '#3a3a40', 12, null, 0, 0, Math.PI / 2); em.cyl('metalv', 0.45, 0.35, -0.2, 0.32, 0.12, '#3a3a40', 12, null, 0, 0, Math.PI / 2); }
    turret.add(em.build()); holder.add(turret); parts.turret = turret;
    if (parts.armH) { const arm = new MB(); arm.box('timber', 0, parts.armH * 0.25, 0, 0.16, parts.armH * 1.4, 0.16, '#7a5a3a'); if (parts.big) arm.box('metalv', 0, -parts.armH * 0.35, 0, 0.6, 0.6, 0.6, '#4a4a4a'); arm.sph('stone', 0, parts.armH * 0.95, 0, 0.35, 0.35, 0.35, '#8a8070'); const ag = arm.build(); const pivot = new THREE.Group(); pivot.position.y = parts.armH; pivot.add(ag); turret.add(pivot); parts.arm = pivot; }
    if (k === 'cannon') { const bar = new MB(); bar.cyl('metalv', 0, 0, 0.5, 0.17, 1.8, '#2a2a30', 14, 0.12, 0, Math.PI / 2, 0); bar.cyl('metalv', 0, 0, 1.38, 0.15, 0.1, '#4a4a52', 14, null, 0, Math.PI / 2, 0); const bg = bar.build(); const bp = new THREE.Group(); bp.position.y = 0.65; bp.add(bg); turret.add(bp); parts.barrel = bp; }
  }
  return { obj: holder, parts };
}
function bellModel(e) { const mb = new MB(); for (const s of [-1, 1]) mb.cylB('bark', s * 1.0, 0, 0, 0.13, 4.2, '#5a3e24', 8); mb.box('timber', 0, 4.1, 0, 2.4, 0.22, 0.3, '#4a3220'); mb.cone('rooftile', 0, 4.25, 0, 1.6, 0.9, '#7a3a2a', 4, Math.PI / 4); const g = mb.build(); const bell = new MB(); bell.add('gold', new THREE.LatheGeometry([[0, 0], [0.28, 0], [0.36, -0.05], [0.42, -0.55], [0.5, -0.65], [0, -0.65]].map(([x, y]) => new THREE.Vector2(x, y)), 16), new THREE.Matrix4(), '#c8a040', 'local'); const bg = bell.build(); const pivot = new THREE.Group(); pivot.position.set(0, 3.95, 0); pivot.add(bg); g.add(pivot); return { obj: g, parts: { bell: pivot } }; }
function boardModel(e) { const mb = new MB(); const F = D.FACTIONS[e.faction] || {}; for (const s of [-1, 1]) mb.cylB('bark', s * 0.9, 0, 0, 0.08, 2.3, '#5a3e24', 6); mb.box('planks', 0, 1.6, 0, 2.0, 1.2, 0.08, '#8a6440'); for (let k = 0; k < 6; k++) mb.box('paint', -0.7 + (k % 3) * 0.7, 1.35 + Math.floor(k / 3) * 0.5, 0.05, 0.42, 0.32, 0.01, k === 2 ? F.banner || '#7a1e1e' : '#efe3c8'); mb.cone('rooftile', 0, 2.25, 0, 1.4, 0.5, '#6a3a2a', 4, Math.PI / 4); return { obj: mb.build(), parts: {} }; }
function horseModel(e) {
  const col = e.seed > 0.66 ? '#5a3a24' : e.seed > 0.33 ? '#2a2420' : '#c8c0b0';
  const rig = makeCreature('horse', col, e); const F = D.FACTIONS[e.faction] || {};
  // a caparison in the faction colours
  const mb = new MB(); mb.box('cloth2', 0, 1.42, 0, 0.8, 0.5, 1.2, F.banner || '#7a1e1e'); mb.box('cloth2', 0, 1.2, 0, 0.82, 0.04, 1.22, F.trim || '#e0c060'); const cap = mb.build(); rig.bones.root.add(cap); cap.position.set(0, 0, 0);
  rig.mesh.updateMatrixWorld(true);
  return rig;
}
// anything else draws its 2D picture onto a billboard
function billboardModel(e) {
  const cv = document.createElement('canvas'); cv.width = 160; cv.height = 160; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(160 * PX * 1.2, 160 * PX * 1.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide }));
  m.geometry.translate(0, 160 * PX * 1.2 * 0.3, 0);
  return { obj: m, parts: { cv, tex, t: 0 } };
}
function drawBillboard(av, e) {
  const p = av.model.parts; p.t -= K3.dt; if (p.t > 0) return; p.t = 0.08;
  const g = p.cv.getContext('2d'); g.clearRect(0, 0, 160, 160);
  try { const proxy = Object.create(e); proxy.x = 80; proxy.y = 120; if (e.customDraw) e.customDraw(g, proxy, K3.time); else if (KR.War && (e.siege || e.bell || e.raidBoard)) KR.War.draw(g, proxy, K3.time); else if (S.drawCreature) S.drawCreature(g, proxy, K3.time); } catch (er) {}
  p.tex.needsUpdate = true;
}

// ---------- avatar lifecycle ----------
function makeAvatar(e, peer) {
  const av = { e, peer, kind: null, rig: null, obj: new THREE.Group(), yaw: e.face === -1 ? -Math.PI / 2 : e.face === 1 ? Math.PI / 2 : 0, lx: e.x, ly: e.y, deadK: 0, height: 1.8, scale: 1, sig: '', hover: 0, t: Math.random() * 10 };
  av.obj.name = 'actor ' + (e.name || '');
  build(av);
  root.add(av.obj);
  return av;
}
function clearAvatar(av) {
  for (const c of [...av.obj.children]) { av.obj.remove(c); }
  if (av.horse) av.horse = null;
  av.rig = null; av.model = null;
}
function build(av) {
  const e = av.e; clearAvatar(av);
  if (av.peer) { const look = peerLook(e); av.sig = lookSig(look); av.rig = makeHumanoid(look, 'human'); av.kind = 'human'; av.obj.add(av.rig.mesh); av.height = av.rig.top; return; }
  if (e.ram || e.big) { const m = siegeModel(e); if (m) { av.model = m; av.kind = 'war'; av.obj.add(m.obj); av.height = m.height; return; } } // siege3d.js: the ram and the great engines
  if (e.siege) { av.model = warModel(e); av.kind = 'war'; av.obj.add(av.model.obj); av.height = e.siege === 'archer' ? 9 : 3.2; if (e.siege === 'archer') { const ar = makeHumanoid({ race: 'human', gender: 'm', skin: '#d8b090', hair: '#3a2a1a', armor: { kind: 'leather', col: '#4a6b35', trim: '#3a2618' }, hat: 'hood', hatCol: '#4a6b35', weapon: 'ARC', rangeW: 'ARC' }, 'human'); ar.mesh.position.set(0, 6.7 * 1.25, 0); av.model.obj.add(ar.mesh); av.archer = ar; } return; }
  if (e.bell) { av.model = bellModel(e); av.kind = 'war'; av.obj.add(av.model.obj); av.height = 4.6; return; }
  if (e.raidBoard) { av.model = boardModel(e); av.kind = 'war'; av.obj.add(av.model.obj); av.height = 2.6; return; }
  if (e.barracks) { av.kind = 'none'; return; }
  const look = lookOf(e);
  if (e.customDraw || (!look && !e.kind)) { av.model = billboardModel(e); av.kind = 'board'; av.obj.add(av.model.obj); av.height = 2; return; }
  if (look) {
    let kind = kindOf(e); if (look.kind === 'skeleton' || look.kind === 'lich') kind = look.kind;
    av.sig = lookSig(look);
    av.rig = makeHumanoid(look, kind); av.kind = 'human'; av.obj.add(av.rig.mesh);
    av.height = av.rig.top; av.float = !!look.float;
    if (look.wings || e.kind === 'harpy') addWings(av, look.wings || e.col);
    if (e.mounted && KR.War) { av.horse = horseModel(e); av.obj.add(av.horse.mesh); av.rig.mesh.position.y = 0.72; av.height += 0.9; }
    // the standard-bearer's banner and the drummer's drum
    if (look.standard) { const pole = new THREE.Group(); const mb = new MB(); mb.cylB('timber', 0, -1.1, 0, 0.035, 4.6, '#5a3a20', 8); mb.sph('gold', 0, 3.55, 0, 0.12, 0.16, 0.12, '#e0c050'); pole.add(mb.build()); buildFlags([{ kind: 'pole', x: 0, y: 3.35, z: 0, w: 1.5, h: 1.0, f: look.standard }], pole); av.rig.bones.handR.add(pole); if (av.rig.hands) pole.position.set(...av.rig.hands.R.grip); pole.rotation.set(Math.PI / 2, 0, 0); av.standard = pole; }
    if (look.drum) { const mb = new MB(); mb.cyl('planks', 0, 0, 0, 0.22, 0.32, '#7a2a1a', 16).cyl('cloth', 0, 0.165, 0, 0.215, 0.01, '#efe6cc', 16).cyl('cloth', 0, -0.165, 0, 0.215, 0.01, '#efe6cc', 16);
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; mb.box('timber', Math.cos(a) * 0.21, 0, Math.sin(a) * 0.21, 0.02, 0.34, 0.02, '#e0c050', 0, 0, (k % 2 ? 0.5 : -0.5)); }
      const drum = mb.build(); drum.position.set(0.05, -0.1, 0.24); drum.rotation.set(0.25, 0, 0); av.rig.bones.hips.add(drum);
      const sticks = []; for (const S of ['R', 'L']) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.38, 6), mats.get('timber')); const g = new THREE.Group(); g.add(st); st.position.y = -0.17; av.rig.bones['hand' + S].add(g); if (av.rig.hands) g.position.set(...av.rig.hands[S].grip); g.rotation.set(Math.PI / 2, 0, 0); sticks.push(g); } av.drumSticks = sticks; }
    if (e.soldier === 'musketeer') { const m = weaponMesh('musket'); if (m) { av.rig.bones.handR.add(m); m.rotation.set(Math.PI / 2 - 0.4, 0, 0); } }
    if (look.glow) av.glowCol = look.glow;
    return;
  }
  av.rig = makeCreature(e.kind, e.col, e); av.kind = 'creature'; av.obj.add(av.rig.mesh); av.height = creatureHeight(av.rig); av.hover = av.rig.mesh.userData && av.rig.mesh.userData.hover || 0;
  if (e.kind === 'spiritwolf') av.rig.mesh.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.7; } });
}
function addWings(av, col) {
  const mk = (s) => { const g = new THREE.BufferGeometry(); const P = [0, 0, 0, s * 0.5, 0.25, -0.05, s * 1.1, 0.05, -0.2, s * 0.8, -0.35, -0.25, s * 0.3, -0.45, -0.15]; g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex([0, 1, 4, 1, 3, 4, 1, 2, 3]); g.computeVertexNormals(); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: K3.shade(col, -0.15), side: THREE.DoubleSide, roughness: 0.9 })); m.castShadow = true; m.userData.keepGeo = false; return m; };
  const wl = mk(1), wr = mk(-1); const ch = av.rig.bones.chest; wl.position.set(0.08, 0.12, -0.12); wr.position.set(-0.08, 0.12, -0.12); ch.add(wl); ch.add(wr); av.wings = [wl, wr];
}
function peerLook(pp) {
  const look = Object.assign(S.classLook(pp.c || 'warrior', pp.a && pp.a !== 'none' ? { ak: pp.a, kind: pp.a } : null), { race: pp.r, gender: pp.g, skin: S.skinOf(pp.r, pp.s), hair: S.HAIRS[pp.h] || S.HAIRS[1], hairStyle: pp.hs, cls: pp.c, weapon: pp.w });
  if (pp.a && pp.a !== 'none') look.armor.kind = pp.a;
  return look;
}

// ---------- the per-frame update ----------
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
function atkKindFor(av, e) {
  const l = av.rig && av.rig.look || {}; const w = l.weapon;
  if (w === 'GUN' && av.kind === 'human') return 'thrust'; // the arquebus: shoulder, fire and kick back (the bayonet thrusts the same way)
  if (e.type === 'player' && e.c && e.c.rangeMode === 'ranged' && l.rangeW) return 'bow';
  if (av.kind !== 'human') return 'bite';
  if (w === 'ARC') return 'bow'; if (w === 'spear' || w === '1HP' || w === 'dagger') return 'thrust'; if (w === '2HS' || w === 'axe' && l.cls === 'berserker' || w === 'club' || w === '2HSaxe') return 'chop';
  if (w === '2HB') return 'staff'; if (w === 'H2H' || !w) return e.kind === 'troll' || e.kind === 'zombie' || e.kind === 'ogre' ? 'claw' : 'punch';
  return 'slash';
}
// where someone stands: the ground, a floor, a deck, the wall-walk, or an upper floor they climbed to
const floorOf = (e) => (e.introY != null ? e.introY : e.upB && e.upB._floor3 != null ? e.upB._floor3 + geo.LOFT_H : e.swim || e.sw ? swimY(e) : geo.floorAt(e.x, e.y));
// a swimmer floats with head and shoulders out of the water (never below the sea bed), bobbing a little with each stroke
function swimY(e) { const wl = geo.waterAt(e.x, e.y), g = geo.floorAt(e.x, e.y); if (isNaN(wl)) return g; const sc = e.scale || (D.RACES[e.c ? e.c.race : e.race] || {}).scale || 1; return Math.max(g, wl - 1.18 * sc + Math.sin(K3.time * 3.4) * 0.03); }
// a jump: up and down in a parabola over JUMP_T seconds (cosmetic: the game itself stays on the ground)
export const JUMP_T = 0.62, JUMP_H = 0.75;
export const jumpHeight = (t) => (t == null || t < 0 || t >= JUMP_T ? 0 : 4 * JUMP_H * (t / JUMP_T) * (1 - t / JUMP_T));
const heroJump = (e) => (e === G.player && K3.jumpT != null ? jumpHeight(K3.jumpT) : 0);
export function actorY(e) {
  const av = avatars.get(keyOf(e)); const base = floorOf(e) + heroJump(e) + (av ? av.jumpY || 0 : 0);
  return base + (av ? av.hoverNow || 0 : 0);
}
K3.actorY = (e) => floorOf(e) + heroJump(e);

// ---------- combat feel: hit-stop, flinches, sparks, spell releases and fizzles ----------
// the game applies a blow at once; these hooks remember it so the bodies can react (motion.js)
{
  const at3 = (e, h) => ({ x: e.x * PX, y: floorOf(e) + (h || 1.1) * (e.scale || 1), z: e.y * PX });
  const dmg0 = G.damage;
  G.damage = function (src, tgt, amt, opt) {
    const r = dmg0.apply(this, arguments);
    try {
      const o = opt || {};
      if (r > 0 && src && tgt && !o.dot && !o.spell && Math.hypot(tgt.x - src.x, tgt.y - src.y) < 90) {
        const now = G.now, mag = r / Math.max(1, tgt.hpMax || 1), heavy = !!o.crit || mag > 0.12;
        // a moment's freeze on both bodies sells the weight of the blow: longer for heavy hits and kills
        const stop = tgt.dead ? 150 : heavy ? 110 : 60;
        src._hs = now + stop; tgt._hs = now + stop;
        const dx = tgt.x - src.x, dy = tgt.y - src.y, l = Math.hypot(dx, dy) || 1;
        tgt._hurt = { at: now + stop, dx: dx / l, dy: dy / l, mag };
        const P = at3(tgt); fx.burst(P.x - dx / l * 0.25, P.y, P.z - dy / l * 0.25, heavy ? 16 : 9, heavy ? [3.2, 2.4, 1.2] : [2.6, 2.2, 1.6], { speed: heavy ? 3.4 : 2.4, life: 0.35, grav: 5, s0: 0.07, kind: 3 });
        if ((src === G.player || tgt === G.player) && K3.shakeHit) K3.shakeHit(heavy ? 0.07 : tgt === G.player ? 0.045 : 0.03, heavy ? 0.26 : 0.17);
      }
    } catch (err) { /* effects must never break combat */ }
    return r;
  };
  const int0 = G.interrupt;
  G.interrupt = function (e) {
    const was = e && e.cast;
    const r = int0.apply(this, arguments);
    try { if (was && !e.cast) { e._fizAt = G.now; const P = at3(e, 1.25); fx.burst(P.x, P.y, P.z, 10, [0.9, 0.85, 0.8], { speed: 0.8, life: 0.6, s0: 0.25, kind: 2 }); } } catch (err) {}
    return r;
  };
  const vfx0 = G.spellVfx;
  if (vfx0) G.spellVfx = function (src, tgt, def) {
    const r = vfx0.apply(this, arguments);
    try {
      if (src) { src._relAt = G.now; src._relSchool = def && def.school; }
      // a landing effect on the target: a ring of light rising from the ground
      if (tgt && def && !def.quiet) {
        const col = rgb(CAST_COL[def.res || (def.target === 'enemy' ? 'magic' : 'heal')] || '255,220,140', 2.4); const P = at3(tgt, 0.05);
        for (let k = 0; k < 18; k++) { const a = (k / 18) * 6.283; fx.add.emit({ x: P.x + Math.cos(a) * 0.55, y: P.y + 0.05, z: P.z + Math.sin(a) * 0.55, vx: Math.cos(a) * 0.3, vz: Math.sin(a) * 0.3, vy: 1.2 + Math.random() * 0.8, life: 0.9, s0: 0.16, s1: 0.03, r: col[0], g: col[1], b: col[2], kind: 1 }); }
      }
    } catch (err) {}
    return r;
  };
}
// how long the wind-up before an auto-attack lasts, by swing (heavier swings take longer)
const WIND = { thrust: 0.13, punch: 0.1, slash: 0.2, staff: 0.24, chop: 0.32, claw: 0.2, bite: 0.3 }; // bite: a beast's crouch, rear or coil before it strikes
// the state motion.js needs: wind-up, hit-stop, flinch, casting, releases, acceleration and turning
function motionState(av, e, st, tgt, dt) {
  const now = G.now;
  // the next swing lands when the attack timer runs out: wind up just before it, with a short hold at the top
  const wd = WIND[st.atkKind];
  if (wd && tgt && !tgt.dead && e.atkT > 0 && !e.cast && !e.dead && (e === G.player ? e.autoAttack : e.inCombat)) {
    const reach = (G.meleeRange ? G.meleeRange(e, tgt) : 40) * 1.05;
    if (Math.hypot(tgt.x - e.x, tgt.y - e.y) <= reach) st.wind = Math.max(0, Math.min(1, 1 - (e.atkT - 0.04) / wd));
  }
  st.freeze = (e._hs || 0) > now;
  if (e._hurt && now - e._hurt.at < 1300) {
    const h = e._hurt, cy = Math.cos(av.yaw), sy = Math.sin(av.yaw);
    st.hurt = { t: (now - h.at) / 1000, fx: h.dx * cy - h.dy * sy, fz: h.dx * sy + h.dy * cy, mag: h.mag };
  }
  // casting: how full the bar is and which school, so the gesture and its particles match
  const c = e.cast;
  if (c && c.spell) st.cast = { p: c.dur > 0 ? Math.min(1, (c.t || 0) / c.dur) : 1, school: c.spell.school, dur: c.dur || 0 };
  else if (e.casting) st.cast = { p: 0.5, school: null, dur: 2 };
  else st.cast = null;
  if (e._relAt && now - e._relAt < 700) st.rel = (now - e._relAt) / 1000;
  if (e._fizAt && now - e._fizAt < 500) st.fizzle = (now - e._fizAt) / 1000;
  // acceleration and turning, from the body's own motion (for leaning, banking and the cape)
  if (st.far) { st.acc = 0; st.yawRate = 0; return; }
  const v = dt > 0 ? (st.dist || 0) * (av.scale || 1) / dt : 0;
  av.vS = (av.vS || 0) + (v - (av.vS || 0)) * Math.min(1, dt * 10);
  const acc = dt > 0 ? (av.vS - (av.vPrev == null ? av.vS : av.vPrev)) / dt : 0; av.vPrev = av.vS;
  av.accS = (av.accS || 0) + (acc - (av.accS || 0)) * Math.min(1, dt * 12); st.acc = Math.max(-25, Math.min(25, av.accS));
  const yr = dt > 0 ? K3.dampAngle(0, av.yaw - (av.yawPrev == null ? av.yaw : av.yawPrev), 1) / dt : 0; av.yawPrev = av.yaw;
  av.yawR = (av.yawR || 0) + (yr - (av.yawR || 0)) * Math.min(1, dt * 10); st.yawRate = Math.max(-8, Math.min(8, av.yawR));
}
// group mates shine: a glowing shell around the body that also shows faintly through walls
let glowMat = null, glowBack = null;
function makeGlowMats() {
  const mk = (behind) => {
    // the outline is the back of a slightly fattened body; the see-through layer is its front, drawn only where something hides it
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(KR.Sys.GROUP_COL || '#3cf0ff').multiplyScalar(behind ? 0.9 : 1.8), transparent: true, opacity: behind ? 0.35 : 0.6, side: behind ? THREE.FrontSide : THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    if (behind) m.depthFunc = THREE.GreaterDepth;
    m.onBeforeCompile = (sh) => { sh.uniforms.uTime = K3.shared.uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <skinning_vertex>', '#include <skinning_vertex>\n transformed += normalize(objectNormal) * (0.035 + 0.012 * sin(uTime * 4.));'); };
    m.customProgramCacheKey = () => 'krglow' + (behind ? 'b' : 'f'); return m;
  };
  glowMat = mk(false); glowBack = mk(true);
}
function mateGlow(av, on) {
  const rig = av.rig; if (!rig || !rig.mesh) return;
  if (on && !rig.glow) {
    if (!glowMat) makeGlowMats();
    rig.glow = [glowMat, glowBack].map((m, i) => { const g = new THREE.SkinnedMesh(rig.mesh.geometry, m); g.bind(rig.mesh.skeleton, rig.mesh.bindMatrix); g.frustumCulled = false; g.renderOrder = i ? 8 : 2; g.castShadow = false; rig.mesh.add(g); return g; });
  } else if (!on && rig.glow) { for (const g of rig.glow) rig.mesh.remove(g); rig.glow = null; }
}
function updateAvatar(av, dt, ctx) {
  const e = av.e; const p = G.player;
  if (av.peer) mateGlow(av, KR.Sys.isMate && KR.Sys.isMate(e));
  if (!av.peer && e.type === 'player' && e === p) { const s = lookSig(e.look); if (s !== av.sig) build(av); }
  else if (av.peer) { const s = lookSig(peerLook(e)); if (s !== av.sig) build(av); }
  // other players' positions arrive a few times a second: glide between them instead of hopping
  let ex = e.x, ey = e.y;
  if (av.peer) {
    if (av.sx == null || Math.hypot(e.x - av.sx, e.y - av.sy) > 320) { av.sx = e.x; av.sy = e.y; }
    const k = Math.min(1, dt * 9); av.sx += (e.x - av.sx) * k; av.sy += (e.y - av.sy) * k; ex = av.sx; ey = av.sy;
    // they jumped (a counter in their presence): play the same jump here
    if (e.jmp != null && e.jmp !== av.jmpSeen) { if (av.jmpSeen != null) av.jt = 0; av.jmpSeen = e.jmp; }
  }
  if (av.jt != null) { av.jt += dt; if (av.jt >= JUMP_T) av.jt = null; }
  av.jumpY = av.peer ? jumpHeight(av.jt) : 0;
  const air = av.peer ? (av.jt != null ? av.jt / JUMP_T : null) : e === p && K3.jumpT != null ? K3.jumpT / JUMP_T : null;
  const fy = floorOf(e) + heroJump(e) + av.jumpY;
  // how far it moved (for the walk cycle) and which way it is going
  const dx = ex - av.lx, dy = ey - av.ly; const dist = Math.hypot(dx, dy) * PX; av.lx = ex; av.ly = ey;
  // steps taken on frames that were not animated still count (or far walkers would slide)
  av.accD = (av.accD || 0) + dist; av.accT = (av.accT || 0) + dt;
  // moving: a short grace so a walker who stalls for a frame does not flicker into the idle pose
  const movingNow = av.peer ? !!e.m : !!e.moving && dist > 0.0005;
  if (movingNow) av.movT = 0.12; else av.movT = Math.max(0, (av.movT || 0) - dt);
  const moving = movingNow || av.movT > 0;
  let want = av.yaw;
  const tgt = e.target && !e.target.removed ? e.target : null;
  if (e === p) {
    // the hero faces where the camera looks when moving or fighting, otherwise where it walks
    // EverQuest style: the hero faces where the camera points (backpedals and sidesteps with its legs),
    // except when it is being steered for you (auto follow)
    if (moving || view.firstPerson() || view.turning) want = view.yaw + Math.PI;
    if (e.harvest && !moving) { const h = e.harvest; const tg = h.corpse || (h.d ? { x: h.d.x, y: h.d.y - 8 } : null); if (tg) want = Math.atan2(tg.x - e.x, tg.y - e.y); }
    if (moving && !view.firstPerson() && (p.chase || p.moveTo) && dist > 0.002) want = Math.atan2(dx, dy);
    if (tgt && tgt !== p && (p.autoAttack || p.cast || p.atk > 0) && !(moving && view.firstPerson())) want = Math.atan2(tgt.x - e.x, tgt.y - e.y);
  } else if (e._talkTo && !e.dead) want = Math.atan2(e._talkTo.x - e.x, e._talkTo.y - e.y);
  else if (dist > 0.002 && dist < 3) want = Math.atan2(dx, dy);
  else if (tgt && (e.inCombat || e.cast || e.atk > 0)) want = Math.atan2(tgt.x - e.x, tgt.y - e.y);
  else if (e.type === 'npc' && UI_npcFacing(e)) want = Math.atan2(p.x - e.x, p.y - e.y);
  if (e.dead) want = av.yaw;
  // the hero turns with the camera at once (a soft ease here felt like input lag); others turn smoothly
  av.yaw = K3.dampAngle(av.yaw, want, Math.min(1, dt * (e === p ? (view.turning || moving ? 30 : 16) : 9)));
  // death: fall over
  av.deadK += ((e.dead || e.fd ? 1 : 0) - av.deadK) * Math.min(1, dt * (e.dead || e.fd ? 3.2 : 6));
  // hover for fliers and floaters
  let hover = 0;
  if (av.kind === 'creature') { if (av.rig.type === 'spirit') hover = av.hover + Math.sin(K3.time * 2 + av.t) * 0.15; else if (e.fly && (av.rig.type === 'quad' && av.rig.sp.wings) && (moving || e.inCombat || av.rig.sp.L < 4)) hover = 1.2 + Math.sin(K3.time * 2 + av.t) * 0.2; else if (av.rig.type === 'bug' && av.rig.bee) hover = 0.3; }
  if (av.float) hover = 0.35 + Math.sin(K3.time * 2 + av.t) * 0.12;
  if (e.kind === 'harpy') hover = 0.6 + Math.sin(K3.time * 3) * 0.2;
  av.hoverNow = (av.hoverNow || 0) + (hover * (1 - av.deadK) - (av.hoverNow || 0)) * Math.min(1, dt * 4);
  const sc = (e.scale && !(av.rig && av.rig.look && av.rig.look.scale) ? e.scale : 1) * (av.rig && av.rig.look && av.rig.look.scale ? av.rig.look.scale : 1);
  av.scale = sc;
  av.obj.position.set(ex * PX, fy + av.hoverNow, ey * PX);
  av.obj.rotation.set(0, av.yaw, 0);
  if (av.deadK > 0.001) { av.obj.rotation.x = -av.deadK * Math.PI / 2 * (av.kind === 'creature' ? 0 : 1); av.obj.rotation.z = av.kind === 'creature' ? av.deadK * Math.PI / 2 : 0; av.obj.position.y = fy + (av.kind === 'creature' ? av.deadK * 0.15 * sc : av.deadK * 0.12); }
  av.obj.scale.setScalar(sc);
  // the hero is invisible to the camera in first person (but still casts a shadow)
  const hideSelf = e === p && view.firstPerson();
  if (av._hidden !== hideSelf) { av._hidden = hideSelf; av.obj.traverse((o) => { if (o.isMesh) o.layers.set(hideSelf ? 1 : 0); }); }
  // animation
  const near = Math.hypot(av.obj.position.x - ctx.cam.x, av.obj.position.z - ctx.cam.z);
  // far away people move less often: nobody can see it, and it saves a lot of work
  // (by time, not frames: beyond 30 m a pose 15 times a second, beyond 70 m 8 times; the body still glides every frame)
  const rate = e === p ? 0 : near > 70 ? 8 : near > 30 ? 15 : 0;
  if (rate) { av.animAcc = (av.animAcc || 0) + dt; if (av.animAcc < 1 / rate) return; av.animAcc = 0; }
  const adt = av.accT || dt, adist = av.accD || 0; av.accD = 0; av.accT = 0; dt = adt;
  const animP = e.animK && e.animT > G.now ? 1 - (e.animT - G.now) / (e.animDur || 400) : 0;
  const st = { move: moving ? (av.peer ? 1 : Math.min(1, (e.speed || 120) / 128)) : 0, dist: moving && air == null ? adist / sc : 0, air, atk: e.atk || 0, atkKind: atkKindFor(av, e), cast: !!(e.cast || e.casting), sit: !!e.sit, dead: !!e.dead, stun: e.stun > 0, mez: e.mez > 0, kick: e.kickT || 0, animK: animP > 0 ? e.animK : null, animP, combat: !!(e.autoAttack || e.inCombat) && !e.dead && !!tgt, drunk: !!(e.drunk || (e.drunkUntil && e.drunkUntil > G.now) || (av.rig && av.rig.look && av.rig.look.drunk)), mounted: !!e.mounted && !e.dead, crouch: !!(e.harvest && e.harvest.tool === 'knife'), swim: !!(e.swim || e.sw) && !e.dead, fly: !!e.fly && (moving || e.inCombat), breath: e.breath > 0 };
  st.far = near > 30 && e !== p; // far people skip the fine motion (leaning, breathing, looking, fingers)
  if (av.kind === 'human' || av.kind === 'creature') motionState(av, e, st, tgt, dt); // beasts wind up, freeze on a hit and flinch too (creatures.js)
  if ((e.realmWorker || e.millHand || e.worker) && av.kind === 'human') workerPose(av, e, st); // the kingdom's arborist and miner: tool in hand, a load home (realm3d.js)
  if (st.atk > 0 && (av.prevAtk || 0) === 0 && av.rig) { av.rig.punch = (av.rig.punch || 0) + 1; }
  av.prevAtk = st.atk;
  if (av.peer) { st.move = moving ? 1 : 0; st.dist = air != null ? 0 : adist > 0.0005 ? adist / sc : moving ? dt * 3.2 : 0; }
  if (av.kind === 'human') {
    // direction of travel in the body's own frame, for the steps; the ground under each foot
    const cy = Math.cos(av.yaw), sy = Math.sin(av.yaw);
    if (dist > 0.0005) { const l = Math.hypot(dx, dy); const lx = (dx * cy - dy * sy) / l, lz = (dx * sy + dy * cy) / l; av.mdir = av.mdir || [0, 1]; av.mdir[0] += (lx - av.mdir[0]) * Math.min(1, dt * 12); av.mdir[1] += (lz - av.mdir[1]) * Math.min(1, dt * 12); const n = Math.hypot(av.mdir[0], av.mdir[1]) || 1; av.mdir[0] /= n; av.mdir[1] /= n; }
    st.dir = av.mdir || [0, 1];
    if (near < 32 && !hover && !e.upB && air == null) { const ox = av.obj.position.x, oz = av.obj.position.z; st.ground = (x, z) => (geo.floorAt((ox + (x * cy + z * sy) * sc) / PX, (oz + (-x * sy + z * cy) * sc) / PX) - fy) / sc; }
  }
  const lookAt = tgt && tgt !== e ? tgt : e.type === 'npc' && !moving && p && !p.dead && Math.hypot(p.x - e.x, p.y - e.y) < 190 ? p : null;
  if (lookAt && av.kind === 'human') st.lookYaw = K3.dampAngle(0, Math.atan2(lookAt.x - e.x, lookAt.y - e.y) - av.yaw, 1);
  if (av.kind === 'human') { animateHumanoid(av.rig, st, dt); if (e === p) K3.playerRig = av.rig; if (av.rig.setLod) av.rig.setLod(av.obj.position.distanceTo(K3.camera.position)); }
  else if (av.kind === 'creature') animateCreature(av.rig, st, dt);
  if (av.horse) animateCreature(av.horse, { move: st.move, dist: st.dist * 1.5, atk: 0 }, dt);
  if (av.archer) { av.archer.mesh.rotation.y = (e.aimAng != null ? Math.PI / 2 - e.aimAng : 0) - av.yaw; animateHumanoid(av.archer, { move: 0, dist: 0, atk: (e.fireK || 0) > 0.05 ? 1 - e.fireK : 0, atkKind: 'bow', combat: true }, dt); }
  if (av.wings) { const f = Math.sin(K3.time * 9); av.wings[0].rotation.y = -0.4 + f * 0.6; av.wings[1].rotation.y = 0.4 - f * 0.6; }
  if (av.kind === 'war' && av.model) warAnim(av, e);
  if (av.kind === 'board') { drawBillboard(av, e); av.obj.rotation.set(0, 0, 0); av.model.obj.quaternion.copy(K3.camera.quaternion); }
  if (av.drumSticks) { const since = (G.now - (e.drumHit || 0)) / 1000; av.drumSticks.forEach((g, i) => { const hit = (e.drumHit && since < 0.25 && i === Math.floor(e.drumHit / 7) % 2) ? Math.sin(Math.min(1, since / 0.25) * Math.PI) : 0; g.rotation.x = Math.PI / 2 - 0.9 + hit * 0.9; }); }
  // effects tied to the body
  bodyFx(av, e, dt);
}
function UI_npcFacing(e) { const u = KR.UI; return u && u._npc === e && u.wins && u.wins.npc && !u.wins.npc.el.hidden; }
function warAnim(av, e) {
  const P = av.model.parts;
  if (P.anim) return P.anim(av, e, K3.dt);
  if (P.turret) { const ang = e.aimAng || 0; P.turret.rotation.y = Math.PI / 2 - ang - av.yaw; }
  if (P.arm) { const rec = e.fireK || 0; P.arm.rotation.x = rec > 0 ? -0.9 + (1 - rec) * 2.2 : 1.1; }
  if (P.barrel) { const rec = e.fireK || 0; P.barrel.position.z = -rec * 0.3; }
  if (P.bell) { P.bell.rotation.z = e.ringUntil > G.now ? Math.sin(K3.time * 10) * 0.5 : 0; }
  if (e.dead && !av.rubble) { av.rubble = true; av.model.obj.scale.y = 0.3; }
}
// glowing hands while casting, level-up halos, weapon enchantments, boss auras, loot sparkles
function bodyFx(av, e, dt) {
  av.fxT = (av.fxT || 0) - dt; if (av.fxT > 0) return; av.fxT = 0.05;
  const o = av.obj.position; const h = av.height * av.scale;
  if (e.cast && av.rig && av.rig.bones && av.rig.bones.handL) {
    const col = rgb(CAST_COL[(e.cast.spell && e.cast.spell.res) || (e.cast.spell && e.cast.spell.target === 'enemy' ? 'magic' : 'heal')] || '255,220,140', 2.6);
    const cp = e.cast.dur > 0 ? Math.min(1, (e.cast.t || 0) / e.cast.dur) : 1; const n = cp > 0.85 ? 3 : 1 + (cp > 0.4 ? 1 : 0);
    for (const hn of ['handL', 'handR']) { av.rig.bones[hn].getWorldPosition(_v);
      fx.add.emit({ x: _v.x + (Math.random() - 0.5) * 0.1, y: _v.y, z: _v.z + (Math.random() - 0.5) * 0.1, vy: 0.6 + Math.random() * 0.5, vx: (Math.random() - 0.5) * 0.3, vz: (Math.random() - 0.5) * 0.3, life: 0.6, s0: 0.14 + 0.08 * cp, s1: 0.02, r: col[0], g: col[1], b: col[2], kind: 1 });
      // motes drawn in toward the hand from a spiralling ring around it
      for (let k = 0; k < n; k++) { const a = K3.time * 5 + k * 2.1 + (hn === 'handL' ? 3.1 : 0), rr = 0.28 + 0.06 * Math.sin(K3.time * 3 + k); fx.add.emit({ x: _v.x + Math.cos(a) * rr, y: _v.y + Math.sin(a * 0.7) * 0.12, z: _v.z + Math.sin(a) * rr, vx: -Math.cos(a) * rr * 2.2, vz: -Math.sin(a) * rr * 2.2, vy: 0.25, life: 0.42, s0: 0.07, s1: 0.11, r: col[0], g: col[1], b: col[2], kind: 3 }); } }
    const a = Math.random() * 6.283; fx.add.emit({ x: o.x + Math.cos(a) * 0.9 * av.scale, y: o.y + 0.05, z: o.z + Math.sin(a) * 0.9 * av.scale, vy: 0.9, life: 0.8, s0: 0.1, s1: 0.03, r: col[0], g: col[1], b: col[2], kind: 3 });
  }
  if (e.glowUntil && e.glowUntil > G.now && !e.dead) { for (let k = 0; k < 3; k++) { const a = Math.random() * 6.283, r = 0.4 + Math.random() * 0.4; fx.add.emit({ x: o.x + Math.cos(a) * r, y: o.y + Math.random() * 0.3, z: o.z + Math.sin(a) * r, vy: 1.6 + Math.random(), life: 1.2, s0: 0.12, s1: 0.02, r: 3, g: 2.4, b: 0.8, kind: 3 }); } }
  // enchanted weapons glow and smoulder
  if (av.rig && av.rig.held && av.rig.held.R && av.rig.look && av.rig.look.wfx && !e.dead) { const c = WFX[av.rig.look.wfx]; if (c) { av.rig.held.R.getWorldPosition(_v); const L = BLADE_LEN[av.rig.look.weapon] || 0.7; av.rig.held.R.localToWorld(_v2.set(0, L * Math.random(), 0)); fx.add.emit({ x: _v2.x, y: _v2.y, z: _v2.z, vy: 0.3, life: 0.45, s0: 0.1, s1: 0.02, r: c[0], g: c[1], b: c[2], kind: 1 }); } }
  // bosses smoulder with menace
  if (e.boss && !e.dead && Math.random() < 0.5) { const a = Math.random() * 6.283; fx.smoke.emit({ x: o.x + Math.cos(a) * 0.6 * av.scale, y: o.y + 0.1, z: o.z + Math.sin(a) * 0.6 * av.scale, vy: 0.4, life: 1.6, s0: 0.5 * av.scale, s1: 1.2 * av.scale, r: 0.25, g: 0.1, b: 0.12, a: 0.25, kind: 2 }); }
  if (av.glowCol && !e.dead && Math.random() < 0.4) { const c = rgb(av.glowCol.replace(/rgba?\(|\)/g, '').split(',').slice(0, 3).join(','), 2.2); fx.add.emit({ x: o.x + (Math.random() - 0.5) * 0.6, y: o.y + h * Math.random(), z: o.z + (Math.random() - 0.5) * 0.6, vy: 0.4, life: 0.9, s0: 0.15, s1: 0.02, r: c[0], g: c[1], b: c[2], kind: 1 }); }
  // spirits and elementals shed light
  if (av.kind === 'creature' && av.rig.type === 'spirit') {
    const el = av.rig.mesh.userData.element; const k = av.rig.kind;
    const col = k === 'wisp' ? [1.6, 2.6, 3] : el === 'fire' ? [3, 1.2, 0.3] : el === 'water' ? [0.6, 1.4, 2.6] : el === 'air' ? [2, 2.2, 2.6] : rgb(e.col || '#9ab0c8', 1.6);
    for (let i = 0; i < (el === 'fire' ? 3 : 1); i++) fx.add.emit({ x: o.x + (Math.random() - 0.5) * 0.5 * av.scale, y: o.y + h * (0.3 + Math.random() * 0.6), z: o.z + (Math.random() - 0.5) * 0.5 * av.scale, vy: el === 'fire' ? 1.8 : 0.3, vx: (Math.random() - 0.5) * 0.4, vz: (Math.random() - 0.5) * 0.4, life: el === 'fire' ? 0.7 : 1.2, s0: el === 'fire' ? 0.35 * av.scale : 0.14, s1: 0.04, r: col[0], g: col[1], b: col[2], kind: el === 'fire' ? 0 : 1 });
  }
  // dragon fire
  if (e.breath > 0 && av.rig && av.rig.bones && av.rig.bones.head) { av.rig.bones.head.getWorldPosition(_v); const fwx = Math.sin(av.yaw), fwz = Math.cos(av.yaw); for (let k = 0; k < 6; k++) fx.add.emit({ x: _v.x + fwx * 0.6 * av.scale, y: _v.y, z: _v.z + fwz * 0.6 * av.scale, vx: fwx * (7 + Math.random() * 4) + (Math.random() - 0.5) * 2, vy: (Math.random() - 0.6) * 2, vz: fwz * (7 + Math.random() * 4) + (Math.random() - 0.5) * 2, life: 0.7, s0: 0.3, s1: 1.6, r: 3.2, g: 1.2 + Math.random(), b: 0.3, kind: 0, drag: 1 }); }
  // loot on a corpse
  if (e.dead && e.loot && e.loot.items && e.loot.items.length && e.type === 'mob' && Math.random() < 0.5) fx.add.emit({ x: o.x + (Math.random() - 0.5) * 0.6, y: o.y + 0.3, z: o.z + (Math.random() - 0.5) * 0.6, vy: 0.5, life: 1, s0: 0.1, s1: 0.03, r: 3, g: 2.6, b: 1, kind: 3 });
  // status: stunned stars, mesmerised
  if (e.stun > 0 && !e.dead) { const a = K3.time * 5; fx.add.emit({ x: o.x + Math.cos(a) * 0.3, y: o.y + h + 0.15, z: o.z + Math.sin(a) * 0.3, life: 0.25, s0: 0.12, s1: 0.1, r: 3, g: 2.6, b: 0.8, kind: 3, fade: 0 }); }
  if (e.root > 0 && !e.dead && Math.random() < 0.5) fx.add.emit({ x: o.x + (Math.random() - 0.5) * 0.6, y: o.y + 0.1, z: o.z + (Math.random() - 0.5) * 0.6, vy: 0.3, life: 0.8, s0: 0.12, s1: 0.05, r: 0.5, g: 1.6, b: 0.4, kind: 1 });
}

// ---------- projectiles ----------
const projObjs = new Map();
let arrowGeo = null;
function projObj(pr) {
  let o = projObjs.get(pr); if (o) return o;
  const v = pr.vis; const g = new THREE.Group();
  if (v === 'arrow' || v === 'bolt' || v === 'shot') { const mb = new MB(); const L = v === 'bolt' ? 1.4 : 0.8; mb.cyl('timber', 0, 0, 0, v === 'bolt' ? 0.03 : 0.012, L, v === 'shot' ? '#ffe0a0' : '#8a6a3a', 6, null, 0, Math.PI / 2); mb.cone('metalv', 0, -0.05, L / 2, v === 'bolt' ? 0.06 : 0.025, 0.12, '#cccccc', 6); g.add(mb.build({ castShadow: false })); g.children[0].children.forEach((m) => { m.rotation.x = Math.PI / 2; }); }
  else if (v === 'knife') { const w = weaponMesh('THR'); if (w) { w.rotation.x = Math.PI / 2; g.add(w); } }
  else if (v === 'boulder' || v === 'ball') { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(v === 'ball' ? 0.18 : 0.45, 1), mats.get(v === 'ball' ? 'metalv' : 'rock')); m.castShadow = true; g.add(m); }
  // faction armies (warmarch.js): iron cannon balls, and the great bolts of the elven ballistas
  else if (v === 'ironball') { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 2), mats.get('metalv')); m.material = m.material.clone(); m.material.color.set('#2a2a2e'); m.castShadow = true; g.add(m); }
  else if (v === 'bigbolt') { const mb = new MB(); mb.cyl('timber', 0, 0, 0, 0.07, 3.0, '#6a4a2a', 8); mb.cone('metalv', 0, 1.5, 0, 0.16, 0.5, '#8e9a90', 8); for (const a of [0, 2.09, 4.19]) mb.box('cloth2', Math.cos(a) * 0.1, -1.3, Math.sin(a) * 0.1, 0.02, 0.5, 0.18, '#3a7a3a', a); const inner = mb.build(); inner.rotation.x = Math.PI / 2; g.add(inner); } // built along y, turned to point forward
  else { const c = rgb(G.projCol ? G.projCol(v) : '#ffffff', 3); const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]) })); g.add(m); g.userData.col = c; }
  root.add(g); projObjs.set(pr, o = g); return g;
}
function updateProjectiles(dt) {
  const live = new Set(G.proj);
  for (const [pr, o] of projObjs) if (!live.has(pr)) { root.remove(o); projObjs.delete(pr); }
  for (const pr of G.proj) {
    const o = projObj(pr);
    const sy = pr.src ? srcY(pr.src) : 1.4, ty = pr.tgt ? srcY(pr.tgt) : 1.2;
    const sx = pr.src ? pr.src.x : pr.x, sz = pr.src ? pr.src.y : pr.y; const tx = pr.tgt ? pr.tgt.x : pr.x, tz = pr.tgt ? pr.tgt.y : pr.y;
    const total = Math.hypot(tx - sx, tz - sz) || 1; const done = Math.hypot(pr.x - sx, pr.y - sz); const k = K3.clamp(done / total, 0, 1);
    const arc = pr.vis === 'boulder' || pr.vis === 'ironball' || pr.vis === 'bigbolt' ? Math.sin(k * Math.PI) * ((pr.opt && pr.opt.arc) || Math.min(8, total * PX * 0.3)) : pr.vis === 'arrow' ? Math.sin(k * Math.PI) * total * PX * 0.04 : 0;
    const y = geo.floorAt(pr.x, pr.y) * 0 + K3.lerp(geo.floorAt(sx, sz) + sy, geo.floorAt(tx, tz) + ty, k) + arc;
    o.position.set(pr.x * PX, y, pr.y * PX);
    const ang = Math.atan2(tx - sx, tz - sz); o.rotation.set(0, ang, 0);
    if (pr.vis === 'boulder' || pr.vis === 'ball') o.rotation.x += K3.time * 6;
    if (pr.vis === 'bigbolt') o.rotation.x = -Math.atan2((pr.opt && pr.opt.arc || 0) * Math.PI * Math.cos(k * Math.PI), total * PX); // nose follows the flight
    if (pr.vis === 'ironball' && Math.random() < 0.6) fx.smoke.emit({ x: o.position.x, y: o.position.y, z: o.position.z, vy: 0.2, life: 0.9, s0: 0.25, s1: 0.9, r: 0.6, g: 0.58, b: 0.55, a: 0.35, kind: 2 });
    // a handgun shot: flame and a puff of smoke at the muzzle when it leaves
    if (pr.vis === 'shot' && !pr._flash) { pr._flash = 1; const sx3 = sx * PX, sz3 = sz * PX, sy3 = geo.floorAt(sx, sz) + sy; const dx = Math.sin(ang) * 0.6, dz = Math.cos(ang) * 0.6;
      fx.burst(sx3 + dx, sy3, sz3 + dz, 10, '#ffc060', { speed: 2.5, life: 0.18 });
      for (let i = 0; i < 6; i++) fx.smoke.emit({ x: sx3 + dx, y: sy3, z: sz3 + dz, vx: dx * 1.5 + (Math.random() - 0.5) * 0.4, vy: 0.3 + Math.random() * 0.3, vz: dz * 1.5 + (Math.random() - 0.5) * 0.4, drag: 1.6, life: 1.6 + Math.random(), s0: 0.25, s1: 1.2, r: 0.82, g: 0.8, b: 0.76, a: 0.45, kind: 2 }); }
    if (o.userData.col && Math.random() < 0.8) { const c = o.userData.col; fx.add.emit({ x: o.position.x, y: o.position.y, z: o.position.z, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, vz: (Math.random() - 0.5) * 0.4, life: 0.35, s0: 0.32, s1: 0.05, r: c[0], g: c[1], b: c[2], kind: 1 }); }
  }
}
function srcY(e) { const av = avatars.get(keyOf(e)); return av ? av.height * av.scale * 0.72 + (av.hoverNow || 0) : 1.3; }

// ---------- one-off effects from the shared game (G.fx) ----------
const seenFx = new WeakSet();
function fxPos(f) { const e = f.ent || null; const x = e ? e.x : f.x, y = e ? e.y : f.y; return { x: x * PX, y: geo.floorAt(x, y), z: y * PX, e }; }
function updateGameFx(dt) {
  for (const f of G.fx) {
    const first = !seenFx.has(f); if (first) seenFx.add(f);
    const P = fxPos(f); const col = f.col ? rgb(f.col, 2.4) : f.rgb ? rgb(f.rgb, 2.4) : [2.6, 2.2, 1.2]; const h = P.e ? srcY(P.e) : 1.2;
    switch (f.k) {
      case 'ring': if (first) ringFx(P.x, P.y, P.z, (f.r || 14) * PX * 1.6, col, f.life || 0.5); break;
      case 'slash': if (first) { const a = (f.ang || 0); for (let k = 0; k < 10; k++) { const t = (k / 9 - 0.5) * 1.8; const r = (f.big ? 1.1 : 0.75); const ax = Math.cos(a + t) * r, az = Math.sin(a + t) * r; fx.add.emit({ x: P.x + ax * 0.4, y: P.y + 1.2 + t * 0.2, z: P.z + az * 0.4, vx: ax * 0.8, vz: az * 0.8, life: 0.22, s0: 0.2, s1: 0.05, r: col[0], g: col[1], b: col[2], kind: 3 }); } } break;
      case 'burst': if (first) fx.burst(P.x, P.y + 1, P.z, 18, col, { speed: (f.r || 20) * PX * 4, life: f.life || 0.5, s0: 0.3, kind: 1 }); break;
      case 'spark': case 'sparks': if (first) fx.burst(P.x, P.y + 1.0, P.z, 10, [3, 2, 0.8], { speed: 3, life: 0.5, grav: 6, s0: 0.08 }); break;
      case 'nova': if (first) { ringFx(P.x, P.y, P.z, (f.r || 120) * PX, col, f.life || 0.6, true); fx.burst(P.x, P.y + 0.5, P.z, 30, col, { speed: (f.r || 120) * PX * 1.6, life: f.life || 0.6, s0: 0.25, kind: 1, drag: 1 }); } break;
      case 'levelup': case 'pillar': { const k = f.t / f.life; for (let i = 0; i < 4; i++) { const a = Math.random() * 6.283, r = Math.random() * 0.5; fx.add.emit({ x: P.x + Math.cos(a) * r, y: P.y + Math.random() * 0.5, z: P.z + Math.sin(a) * r, vy: 3 + Math.random() * 3, life: 1.0, s0: 0.2, s1: 0.04, r: col[0], g: col[1], b: col[2], kind: f.k === 'levelup' ? 3 : 1 }); } if (first) ringFx(P.x, P.y, P.z, 1.6, col, 1.2, true); break; }
      case 'aura': case 'swirl': case 'spiral': case 'runes': { const a = K3.time * 5 + Math.random(); const r = 0.6; fx.add.emit({ x: P.x + Math.cos(a) * r, y: P.y + Math.random() * h, z: P.z + Math.sin(a) * r, vy: 0.6, life: 0.6, s0: 0.14, s1: 0.03, r: col[0], g: col[1], b: col[2], kind: f.k === 'runes' ? 3 : 1 }); if (first && f.k === 'runes') runeFx(P, col, f.life || 1); break; }
      case 'shield': if (first) shieldFx(P, col, f.life || 1); break;
      case 'roots': if (Math.random() < 0.6) fx.add.emit({ x: P.x + (Math.random() - 0.5) * 0.8, y: P.y + 0.05, z: P.z + (Math.random() - 0.5) * 0.8, vy: 0.8, life: 0.6, s0: 0.15, s1: 0.05, r: 0.4, g: 1.8, b: 0.3, kind: 1 }); break;
      case 'smoke': if (first) for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; fx.smoke.emit({ x: P.x, y: P.y + 0.8, z: P.z, vx: Math.cos(a) * 1.2, vy: 0.4, vz: Math.sin(a) * 1.2, life: 1.4, s0: 0.6, s1: 1.8, r: 0.6, g: 0.6, b: 0.65, a: 0.5, kind: 2, drag: 1.5 }); } break;
      case 'flames': for (let i = 0; i < 2; i++) fx.add.emit({ x: P.x + (Math.random() - 0.5) * 0.8, y: P.y + Math.random() * 1.2, z: P.z + (Math.random() - 0.5) * 0.8, vy: 1.5, life: 0.5, s0: 0.35, s1: 0.1, r: 3, g: 1.2, b: 0.3, kind: 0 }); break;
      case 'note': if (first || Math.random() < 0.1) fx.add.emit({ x: P.x + (Math.random() - 0.5) * 0.6, y: P.y + 2, z: P.z + (Math.random() - 0.5) * 0.6, vy: 0.9, life: 1.2, s0: 0.2, s1: 0.15, r: 3, g: 2.6, b: 1.4, kind: 3 }); break;
      case 'stars': { const a = K3.time * 6; fx.add.emit({ x: P.x + Math.cos(a) * 0.35, y: P.y + h + 0.2, z: P.z + Math.sin(a) * 0.35, life: 0.2, s0: 0.14, s1: 0.1, r: 3, g: 2.6, b: 0.8, kind: 3, fade: 0 }); break; }
      case 'cross': if (first) fx.burst(P.x, P.y + 1.3, P.z, 16, [3, 2.6, 1.2], { speed: 1.5, life: 0.5, kind: 3 }); break;
      case 'dash': if (first) for (let i = 0; i < 16; i++) { const t = i / 15; fx.add.emit({ x: K3.lerp(f.x0, f.x1, t) * PX, y: geo.floorAt(K3.lerp(f.x0, f.x1, t), K3.lerp(f.y0, f.y1, t)) + 1, z: K3.lerp(f.y0, f.y1, t) * PX, life: 0.35, s0: 0.3, s1: 0.05, r: 2, g: 2, b: 2, kind: 1 }); } break;
      case 'shout': if (first) ringFx(P.x, P.y, P.z, 3.5, col, 0.6, true); break;
      case 'whirlfx': { const a = K3.time * 20; const r = (f.r || 40) * PX * 1.2; fx.add.emit({ x: P.x + Math.cos(a) * r, y: P.y + 1, z: P.z + Math.sin(a) * r, life: 0.2, s0: 0.3, s1: 0.1, r: 2.6, g: 2.4, b: 2, kind: 1 }); break; }
      case 'portal': if (first) ringFx(P.x, P.y, P.z, 1.6, [2.6, 2.2, 1.4], 1.2, true); fx.add.emit({ x: P.x + (Math.random() - 0.5), y: P.y + Math.random() * 2, z: P.z + (Math.random() - 0.5), vy: 1, life: 0.8, s0: 0.2, s1: 0.04, r: 2.6, g: 2.2, b: 1.4, kind: 3 }); break;
    }
  }
}
// ground decals: expanding rings and rune circles
const decals = [];
let ringMat = null, runeMat = null;
function decalMat(tex) { return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, color: 0xffffff }); }
function ringFx(x, y, z, r, col, life, expand) {
  if (!ringMat) ringMat = cardTex('ring');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), decalMat(ringMat)); m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.06, z); m.material.color.setRGB(col[0], col[1], col[2]);
  root.add(m); decals.push({ m, t: 0, life, r, expand: expand !== false });
}
function runeFx(P, col, life) { if (!runeMat) runeMat = cardTex('runes'); const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), decalMat(runeMat)); m.rotation.x = -Math.PI / 2; m.position.set(P.x, P.y + 0.07, P.z); m.material.color.setRGB(col[0], col[1], col[2]); root.add(m); decals.push({ m, t: 0, life, r: 1.3, spin: 1, follow: P.e }); }
function shieldFx(P, col, life) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(col[0] * 0.25, col[1] * 0.25, col[2] * 0.25), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(P.x, P.y + 1, P.z); root.add(m); decals.push({ m, t: 0, life, r: 1.1, bubble: 1, follow: P.e }); }
function updateDecals(dt) {
  for (let i = decals.length - 1; i >= 0; i--) {
    const d = decals[i]; d.t += dt; const k = d.t / d.life;
    if (k >= 1) { root.remove(d.m); d.m.geometry.dispose(); d.m.material.dispose(); decals.splice(i, 1); continue; }
    if (d.follow) { d.m.position.x = d.follow.x * PX; d.m.position.z = d.follow.y * PX; d.m.position.y = geo.floorAt(d.follow.x, d.follow.y) + (d.bubble ? 1 : 0.07); }
    const s = d.expand ? d.r * (0.35 + 0.65 * k) : d.r; d.m.scale.setScalar(s);
    if (d.spin) d.m.rotation.z = d.t * 1.5;
    d.m.material.opacity = 1 - k * k;
  }
}

// ---------- contact shadows ----------
// a soft dark patch on the ground under each body: grounds people even where the sun's shadow map is coarse
let blobs = null; const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), _bp = new THREE.Vector3(), _bs = new THREE.Vector3();
function ensureBlobs() {
  if (blobs) return;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false, fog: true });
  blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, 192); blobs.frustumCulled = false; blobs.count = 0; blobs.renderOrder = 1; root.add(blobs);
}
function updateBlobs(cam) {
  ensureBlobs(); let n = 0;
  for (const [, av] of avatars) {
    if (n >= 192) break; const e = av.e; if (!e || !av.obj.visible || av._err || av.kind === 'board' || av.kind === 'war' || e.dead) continue;
    const o = av.obj.position; if (Math.abs(o.x - cam.x) > 40 || Math.abs(o.z - cam.z) > 40) continue;
    const up = (av.hoverNow || 0) + (av.jumpY || 0) + (e === G.player && K3.jumpT != null ? jumpHeight(K3.jumpT) : 0);
    const gy = o.y - up; const r = Math.max(0.5, ((av.peer ? 12 : e.r || 12) * (typeof e.scale === 'number' ? e.scale : 1)) * PX * 2.4) * (1 - Math.min(0.5, up * 0.4)); // a player's shared 'r' is their race
    _bp.set(o.x, gy + 0.03, o.z); _bs.set(r * 2, r * 2, 1); _bm.compose(_bp, _bq, _bs); blobs.setMatrixAt(n++, _bm);
  }
  blobs.count = n; blobs.instanceMatrix.needsUpdate = true;
}

// ---------- cast circle and target ring ----------
let targetRing = null, castRings = new Map();
function ensureRings() {
  if (targetRing) return;
  targetRing = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48), new THREE.MeshBasicMaterial({ color: 0xff5544, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, blending: THREE.AdditiveBlending }));
  targetRing.rotation.x = -Math.PI / 2; root.add(targetRing);
}
function updateRings(dt) {
  ensureRings(); const p = G.player; const t = p && p.target && !p.target.removed ? p.target : null;
  targetRing.visible = !!t;
  if (t) { const av = avatars.get(keyOf(t)); const r = ((t.r || 12) * (t.scale || 1) + 8) * PX * 1.3; targetRing.scale.setScalar(r); targetRing.position.set(t.x * PX, geo.floorAt(t.x, t.y) + 0.05, t.y * PX); const col = G.isHostile(p, t) ? D.CON_COLORS[D.conOf(p.level, t.level)] : '#7aff8a'; targetRing.material.color.set(col).multiplyScalar(1.6); targetRing.rotation.z = K3.time * 0.5; }
  // spell circles under casters
  if (!runeMat) runeMat = cardTex('runes');
  for (const [e, m] of castRings) if (!e.cast || e.dead || e.removed) { root.remove(m); m.geometry.dispose(); m.material.dispose(); castRings.delete(e); }
  for (const e of G.ents) {
    if (!e.cast || e.dead || e.removed) continue; let m = castRings.get(e);
    if (!m) { m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), decalMat(runeMat)); m.rotation.x = -Math.PI / 2; root.add(m); castRings.set(e, m); const c = rgb(CAST_COL[(e.cast.spell && e.cast.spell.res) || (e.cast.spell && e.cast.spell.target === 'enemy' ? 'magic' : 'heal')] || '255,220,140', 1.8); m.material.color.setRGB(c[0], c[1], c[2]); }
    const k = Math.min(1, e.cast.t / (e.cast.dur || 1)); m.position.set(e.x * PX, geo.floorAt(e.x, e.y) + 0.06, e.y * PX); m.rotation.z = K3.time * 1.2; m.scale.setScalar((0.7 + 0.4 * k) * (e.scale || 1)); m.material.opacity = 0.5 + 0.5 * k;
  }
}

// ---------- public ----------
export const actors = {
  avatars,
  reset() { for (const av of avatars.values()) root.remove(av.obj); avatars.clear(); for (const [, o] of projObjs) root.remove(o); projObjs.clear(); },
  update(dt, ctx) {
    ctx = Object.assign({ cam: K3.camera.position }, ctx);
    const p = G.player; const cam = ctx.cam;
    const alive = new Set();
    // new bodies take a moment to build: spend at most a few milliseconds a frame on them (nearest first come first)
    const t0 = performance.now(); let built = 0;
    const consider = (e, peer) => {
      if (!e || e.removed || e.hidden) return;
      const d = Math.hypot(e.x * PX - cam.x, e.y * PX - cam.z);
      const key = keyOf(e);
      if (d > 160) { const av = avatars.get(key); if (av) { root.remove(av.obj); avatars.delete(key); } return; }
      alive.add(key);
      let av = avatars.get(key);
      try {
        const tb = performance.now();
        if (!av) { if (built > 0 && performance.now() - t0 > (d < 25 ? 14 : 6)) { alive.delete(key); return; } built++; av = makeAvatar(e, peer); avatars.set(key, av); if (K3.prof) { const bt = performance.now() - tb; K3.prof.acc.actBuild = (K3.prof.acc.actBuild || 0) + bt; if (bt > 25 && K3.settings.showFps) console.log('slow build', Math.round(bt), e.name, e.type, e.kind, av.kind); } }
        av.e = e;
        av.obj.visible = d < (peer ? 156 : 150);
        const ta = performance.now(); updateAvatar(av, dt, ctx); if (K3.prof) { const k = av.kind === 'human' ? 'actHuman' : 'actOther'; K3.prof.acc[k] = (K3.prof.acc[k] || 0) + performance.now() - ta; K3.prof.acc.nAv = (K3.prof.acc.nAv || 0) + 1; }
      } catch (err) { if (av && !av._err) { av._err = true; console.warn('actor', e.name, err); } else if (!av) { console.warn('actor build', e.name, e.kind, err); const dummy = { e, obj: new THREE.Group(), height: 1.8, scale: 1, _err: true }; avatars.set(e, dummy); } }
    };
    for (const e of G.ents) consider(e, false);
    if (KR.Sys.Net && KR.Sys.Net.peers) for (const pp of KR.Sys.Net.peers) { if ((pp.rm || 'main') !== (W.realm || 'main') || pp.dead) continue; consider(pp, true); }
    for (const [e, av] of avatars) if (!alive.has(e)) { root.remove(av.obj); avatars.delete(e); }
    updateProjectiles(dt);
    updateGameFx(dt);
    updateDecals(dt);
    updateRings(dt);
    updateBlobs(cam);
  },
  // dress everyone near the hero ahead of time (behind the loading screen), so nobody has to be built
  // mid-game when they walk into view: a new face and outfit takes tens of milliseconds to make
  prewarm(maxMs = 4000, radius = 170) {
    const p = G.player; if (!p) return 0; const t0 = performance.now(); let n = 0;
    const list = G.ents.filter((e) => e && !e.removed && !e.hidden && !e.siege && !e.bell && !e.raidBoard && !e.barracks && lookOf(e)).map((e) => [e, Math.hypot(e.x - p.x, e.y - p.y) * PX]).filter((a) => a[1] < radius).sort((a, b) => a[1] - b[1]);
    for (const [e] of list) { if (performance.now() - t0 > maxMs) break; try { let kind = kindOf(e); const look = lookOf(e); if (look.kind === 'skeleton' || look.kind === 'lich') kind = look.kind; makeHumanoid(look, kind); n++; } catch (er) {} }
    return n;
  },
  // the monsters that live in the land are built once per kind and colour: do the ones near the hero now,
  // and the rest a few at a time while the game has time to spare
  prewarmCreatures(maxMs = 2500, radius = 260) {
    const p = G.player; if (!p) return 0; const t0 = performance.now(); let n = 0;
    const seen = new Set(), list = [];
    for (const s of W.spawns || []) { const M = KR.D.MOBS[s.mob]; if (!M || !M.kind) continue; const key = M.kind + '|' + (M.col || ''); if (seen.has(key)) continue; seen.add(key); list.push([M, Math.hypot(s.tx * TS - p.x, s.ty * TS - p.y) * PX]); }
    // humanoid monsters (orcs, goblins, skeletons...) get a dressed body, the rest a creature body
    const build = (M) => { const fake = { kind: M.kind, col: M.col, name: M.name, type: 'mob', scale: M.scale || 1, ranged: M.ranged, boss: M.boss }; const lk = S.mobLook ? S.mobLook(fake) : null; if (lk) { let kind = M.kind; if (lk.kind === 'skeleton' || lk.kind === 'lich') kind = lk.kind; makeHumanoid(lk, kind); } else makeCreature(M.kind, M.col, null); };
    list.sort((a, b) => a[1] - b[1]);
    const later = [];
    for (const [M, d] of list) { if (d < radius && performance.now() - t0 < maxMs) { try { build(M); n++; } catch (e) {} } else later.push(M); }
    // the rest: one per idle moment
    const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 20 }), 200));
    const next = (dl) => { while (later.length && dl.timeRemaining() > 12) { const M = later.shift(); try { build(M); } catch (e) {} break; } if (later.length) idle(next, { timeout: 4000 }); };
    if (later.length) idle(next, { timeout: 4000 });
    return n;
  },
  // the entity under a screen point
  pickScreen(sx, sy) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1), K3.camera);
    const o = ray.ray.origin, d = ray.ray.direction; const p = G.player;
    let best = null, bt = 1e9;
    for (const [key, av] of avatars) {
      const e = av.peer ? av.e : key; // other players can be clicked too (to heal, buff or invite them)
      if (!e || e === p || (!av.peer && e.noPick) || !av.obj.visible) continue;
      const base = av.obj.position; const h = Math.max(0.6, av.height * av.scale) * (e.dead ? 0.25 : 1); const r = av.peer ? 12 * PX * 1.4 : Math.max(0.45, ((e.r || 12) * (e.scale || 1)) * PX * 1.4); // a player's shared 'r' is their race, not a size
      // closest approach between the ray and the vertical segment base..base+h
      const wx = o.x - base.x, wz = o.z - base.z; const a = d.x * d.x + d.z * d.z; if (a < 1e-6) continue;
      let t = -(wx * d.x + wz * d.z) / a; if (t < 0.2) continue;
      const cx = wx + d.x * t, cz = wz + d.z * t; const y = o.y + d.y * t - base.y;
      const dist = Math.hypot(cx, cz);
      if (dist < r && y > -0.3 && y < h + 0.3 && t < bt) { bt = t; best = av.peer ? (KR.Sys.peerEnt ? KR.Sys.peerEnt(e) : null) : e; }
    }
    return best;
  },
  // world-space head position of an entity (for name plates)
  rigOf(e) { const av = avatars.get(keyOf(e)); return av ? av.rig : null; }, // the speaker's face in a cutscene (scene3d.js)
  headPos(e, out) { const av = avatars.get(keyOf(e)); if (!av) return null; out.copy(av.obj.position); out.y += (e.dead ? 0.6 : av.height * av.scale + 0.25); return out; },
};
K3.actors = actors;

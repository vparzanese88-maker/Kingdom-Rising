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

const KR = window.KR, D = KR.D, W = KR.W, G = KR.G, S = KR.S;
const root = new THREE.Group(); root.name = 'actors'; K3.scene.add(root);
const avatars = new Map(); // entity (or peer) -> avatar
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
function lookSig(l) { if (!l) return ''; const a = l.armor || {}; return [l.race, l.gender, l.skin, l.hair, l.hairStyle, a.kind, a.col, a.trim, l.robe, l.helm, l.hat, l.cape, l.weapon, l.offhand, l.back, l.wfx, l.rangeW, l.bare, l.crown, l.sash, l.mask, l.beard].join('|'); }

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
  if (e.type === 'player' && e.c && e.c.rangeMode === 'ranged' && l.rangeW) return 'bow';
  if (av.kind !== 'human') return 'bite';
  if (w === 'ARC') return 'bow'; if (w === 'spear' || w === '1HP' || w === 'dagger') return 'thrust'; if (w === '2HS' || w === 'axe' && l.cls === 'berserker' || w === 'club' || w === '2HSaxe') return 'chop';
  if (w === '2HB') return 'staff'; if (w === 'H2H' || !w) return e.kind === 'troll' || e.kind === 'zombie' || e.kind === 'ogre' ? 'claw' : 'punch';
  return 'slash';
}
export function actorY(e) {
  const av = avatars.get(e); const base = geo.floorAt(e.x, e.y);
  return base + (av ? av.hoverNow || 0 : 0);
}
K3.actorY = (e) => geo.floorAt(e.x, e.y);
function updateAvatar(av, dt, ctx) {
  const e = av.e; const p = G.player;
  if (!av.peer && e.type === 'player' && e === p) { const s = lookSig(e.look); if (s !== av.sig) build(av); }
  else if (av.peer) { const s = lookSig(peerLook(e)); if (s !== av.sig) build(av); }
  const fy = geo.floorAt(e.x, e.y);
  // how far it moved (for the walk cycle) and which way it is going
  const dx = e.x - av.lx, dy = e.y - av.ly; const dist = Math.hypot(dx, dy) * PX; av.lx = e.x; av.ly = e.y;
  const moving = av.peer ? !!e.m : !!e.moving && dist > 0.0005;
  let want = av.yaw;
  const tgt = e.target && !e.target.removed ? e.target : null;
  if (e === p) {
    // the hero faces where the camera looks when moving or fighting, otherwise where it walks
    if (moving || p.autoAttack || p.cast || view.firstPerson()) want = view.yaw + Math.PI;
    if (p.moveTo && moving && !view.look) want = Math.atan2(dx, dy);
    if (tgt && (p.autoAttack || p.cast) && !moving) want = Math.atan2(tgt.x - e.x, tgt.y - e.y);
  } else if (dist > 0.002 && dist < 3) want = Math.atan2(dx, dy);
  else if (tgt && (e.inCombat || e.cast || e.atk > 0)) want = Math.atan2(tgt.x - e.x, tgt.y - e.y);
  else if (e.type === 'npc' && UI_npcFacing(e)) want = Math.atan2(p.x - e.x, p.y - e.y);
  if (e.dead) want = av.yaw;
  av.yaw = K3.dampAngle(av.yaw, want, Math.min(1, dt * (e === p ? 14 : 8)));
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
  av.obj.position.set(e.x * PX, fy + av.hoverNow, e.y * PX);
  av.obj.rotation.set(0, av.yaw, 0);
  if (av.deadK > 0.001) { av.obj.rotation.x = -av.deadK * Math.PI / 2 * (av.kind === 'creature' ? 0 : 1); av.obj.rotation.z = av.kind === 'creature' ? av.deadK * Math.PI / 2 : 0; av.obj.position.y = fy + (av.kind === 'creature' ? av.deadK * 0.15 * sc : av.deadK * 0.12); }
  av.obj.scale.setScalar(sc);
  // the hero is invisible to the camera in first person (but still casts a shadow)
  const hideSelf = e === p && view.firstPerson();
  if (av._hidden !== hideSelf) { av._hidden = hideSelf; av.obj.traverse((o) => { if (o.isMesh) o.layers.set(hideSelf ? 1 : 0); }); }
  // animation
  const near = Math.hypot(av.obj.position.x - ctx.cam.x, av.obj.position.z - ctx.cam.z);
  if (near > 90 && K3.frame % 4) return;
  const animP = e.animK && e.animT > G.now ? 1 - (e.animT - G.now) / (e.animDur || 400) : 0;
  const st = { move: moving ? (av.peer ? 1 : Math.min(1, (e.speed || 120) / 128)) : 0, dist: moving ? dist / sc : 0, atk: e.atk || 0, atkKind: atkKindFor(av, e), cast: !!(e.cast || e.casting), sit: !!e.sit, dead: !!e.dead, stun: e.stun > 0, mez: e.mez > 0, kick: e.kickT || 0, animK: animP > 0 ? e.animK : null, animP, combat: !!(e.autoAttack || e.inCombat) && !e.dead && !!tgt, drunk: !!(e.drunk || (e.drunkUntil && e.drunkUntil > G.now) || (av.rig && av.rig.look && av.rig.look.drunk)), mounted: !!e.mounted && !e.dead, fly: !!e.fly && (moving || e.inCombat), breath: e.breath > 0 };
  if (st.atk > 0 && (av.prevAtk || 0) === 0 && av.rig) { av.rig.punch = (av.rig.punch || 0) + 1; }
  av.prevAtk = st.atk;
  if (av.peer) { st.move = e.m ? 1 : 0; st.dist = e.m ? dt * 6 : 0; }
  if (tgt && av.kind === 'human' && !moving) st.lookYaw = K3.dampAngle(0, Math.atan2(tgt.x - e.x, tgt.y - e.y) - av.yaw, 1);
  if (av.kind === 'human') animateHumanoid(av.rig, st, dt);
  else if (av.kind === 'creature') animateCreature(av.rig, st, dt);
  if (av.horse) animateCreature(av.horse, { move: st.move, dist: st.dist * 1.5, atk: 0 }, dt);
  if (av.archer) { av.archer.mesh.rotation.y = (e.aimAng != null ? Math.PI / 2 - e.aimAng : 0) - av.yaw; animateHumanoid(av.archer, { move: 0, dist: 0, atk: (e.fireK || 0) > 0.05 ? 1 - e.fireK : 0, atkKind: 'bow', combat: true }, dt); }
  if (av.wings) { const f = Math.sin(K3.time * 9); av.wings[0].rotation.y = -0.4 + f * 0.6; av.wings[1].rotation.y = 0.4 - f * 0.6; }
  if (av.kind === 'war' && av.model) warAnim(av, e);
  if (av.kind === 'board') { drawBillboard(av, e); av.obj.rotation.set(0, 0, 0); av.model.obj.quaternion.copy(K3.camera.quaternion); }
  // effects tied to the body
  bodyFx(av, e, dt);
}
function UI_npcFacing(e) { const u = KR.UI; return u && u._npc === e && u.wins && u.wins.npc && !u.wins.npc.el.hidden; }
function warAnim(av, e) {
  const P = av.model.parts;
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
    for (const hn of ['handL', 'handR']) { av.rig.bones[hn].getWorldPosition(_v); fx.add.emit({ x: _v.x + (Math.random() - 0.5) * 0.1, y: _v.y, z: _v.z + (Math.random() - 0.5) * 0.1, vy: 0.6 + Math.random() * 0.5, vx: (Math.random() - 0.5) * 0.3, vz: (Math.random() - 0.5) * 0.3, life: 0.6, s0: 0.14, s1: 0.02, r: col[0], g: col[1], b: col[2], kind: 1 }); }
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
    const arc = pr.vis === 'boulder' ? Math.sin(k * Math.PI) * Math.min(8, total * PX * 0.3) : pr.vis === 'arrow' ? Math.sin(k * Math.PI) * total * PX * 0.04 : 0;
    const y = geo.floorAt(pr.x, pr.y) * 0 + K3.lerp(geo.floorAt(sx, sz) + sy, geo.floorAt(tx, tz) + ty, k) + arc;
    o.position.set(pr.x * PX, y, pr.y * PX);
    const ang = Math.atan2(tx - sx, tz - sz); o.rotation.set(0, ang, 0);
    if (pr.vis === 'boulder' || pr.vis === 'ball') o.rotation.x += K3.time * 6;
    if (o.userData.col && Math.random() < 0.8) { const c = o.userData.col; fx.add.emit({ x: o.position.x, y: o.position.y, z: o.position.z, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, vz: (Math.random() - 0.5) * 0.4, life: 0.35, s0: 0.32, s1: 0.05, r: c[0], g: c[1], b: c[2], kind: 1 }); }
  }
}
function srcY(e) { const av = avatars.get(e); return av ? av.height * av.scale * 0.72 + (av.hoverNow || 0) : 1.3; }

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
  if (t) { const av = avatars.get(t); const r = ((t.r || 12) * (t.scale || 1) + 8) * PX * 1.3; targetRing.scale.setScalar(r); targetRing.position.set(t.x * PX, geo.floorAt(t.x, t.y) + 0.05, t.y * PX); const col = G.isHostile(p, t) ? D.CON_COLORS[D.conOf(p.level, t.level)] : '#7aff8a'; targetRing.material.color.set(col).multiplyScalar(1.6); targetRing.rotation.z = K3.time * 0.5; }
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
    const consider = (e, peer) => {
      if (!e || e.removed || e.hidden) return;
      const d = Math.hypot(e.x * PX - cam.x, e.y * PX - cam.z);
      if (d > 160) { const av = avatars.get(e); if (av) { root.remove(av.obj); avatars.delete(e); } return; }
      alive.add(e);
      let av = avatars.get(e);
      try {
        if (!av) { av = makeAvatar(e, peer); avatars.set(e, av); }
        av.obj.visible = d < 150;
        updateAvatar(av, dt, ctx);
      } catch (err) { if (av && !av._err) { av._err = true; console.warn('actor', e.name, err); } else if (!av) { console.warn('actor build', e.name, e.kind, err); const dummy = { e, obj: new THREE.Group(), height: 1.8, scale: 1, _err: true }; avatars.set(e, dummy); } }
    };
    for (const e of G.ents) consider(e, false);
    if (KR.Sys.Net && KR.Sys.Net.peers) for (const pp of KR.Sys.Net.peers) { if ((pp.rm || 'main') !== (W.realm || 'main') || pp.dead) continue; consider(pp, true); }
    for (const [e, av] of avatars) if (!alive.has(e)) { root.remove(av.obj); avatars.delete(e); }
    updateProjectiles(dt);
    updateGameFx(dt);
    updateDecals(dt);
    updateRings(dt);
  },
  // the entity under a screen point
  pickScreen(sx, sy) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1), K3.camera);
    const o = ray.ray.origin, d = ray.ray.direction; const p = G.player;
    let best = null, bt = 1e9;
    for (const [e, av] of avatars) {
      if (e === p || av.peer || e.noPick || !av.obj.visible) continue;
      const base = av.obj.position; const h = Math.max(0.6, av.height * av.scale) * (e.dead ? 0.25 : 1); const r = Math.max(0.45, ((e.r || 12) * (e.scale || 1)) * PX * 1.4);
      // closest approach between the ray and the vertical segment base..base+h
      const wx = o.x - base.x, wz = o.z - base.z; const a = d.x * d.x + d.z * d.z; if (a < 1e-6) continue;
      let t = -(wx * d.x + wz * d.z) / a; if (t < 0.2) continue;
      const cx = wx + d.x * t, cz = wz + d.z * t; const y = o.y + d.y * t - base.y;
      const dist = Math.hypot(cx, cz);
      if (dist < r && y > -0.3 && y < h + 0.3 && t < bt) { bt = t; best = e; }
    }
    return best;
  },
  // world-space head position of an entity (for name plates)
  headPos(e, out) { const av = avatars.get(e); if (!av) return null; out.copy(av.obj.position); out.y += (e.dead ? 0.6 : av.height * av.scale + 0.25); return out; },
};
K3.actors = actors;

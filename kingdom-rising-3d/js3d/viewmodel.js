// Kingdom Rising 3D — your own arms and weapon in first person: sleeves and gauntlets match your armour,
// every weapon has its own swing, casters raise glowing hands, gatherers swing an axe or pick
import { THREE, K3 } from './core.js';
import { MB } from './mb.js';
import { weaponMesh, WFX, BLADE_LEN } from './weapons.js';
import { charMat, useHumanBody } from './chars.js';
import { firstPersonArm } from './human.js';
import { view } from './camera.js';
import { fx, rgb } from './fx.js';

const KR = window.KR, D = KR.D, G = KR.G;
const scene = K3.vmScene, cam = K3.vmCamera;
const hemi = new THREE.HemisphereLight(0xffffff, 0x554433, 1); scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 2); dir.position.set(0.5, 1, 0.3); scene.add(dir);
const point = new THREE.PointLight(0xffaa66, 0, 3, 2); point.position.set(0, -0.1, -0.4); scene.add(point);
const holder = new THREE.Group(); scene.add(holder);
let sig = '', arms = null, ready = 0, swing = 0;
const CAST_COL = { fire: '255,140,50', cold: '140,210,255', magic: '200,140,255', poison: '120,230,80', disease: '170,200,90', heal: '255,230,140' };

// a simple arm: a group at the shoulder, sleeve, forearm and hand
function buildArm(side, look) {
  const armor = look.armor || { kind: 'none', col: '#7a6a5a' }; const ak = armor.kind || 'none'; const ac = armor.col || '#7a6a5a';
  const robe = ak === 'cloth' || look.robe; const skin = look.skin || '#e2b48e';
  const sleeve = look.bare ? skin : robe ? ac : ak === 'none' ? ac : K3.shade(ac, -0.05);
  const fore = robe ? ac : ak === 'plate' ? K3.shade(ac, 0.05) : ak === 'chain' ? '#8e9298' : skin;
  const hand = ak === 'plate' ? K3.shade(ac, -0.1) : skin;
  const mt = (m) => (m === 'metal' ? [0.85, 0.32, 3] : m === 'chain' ? [0.8, 0.45, 7] : m === 'skin' ? [0, 0.6, 5] : m === 'leather' ? [0, 0.62, 2] : [0, 0.95, 1]);
  const part = (g, col, m) => { const c = K3.col(col); const n = g.attributes.position.count; const colA = new Float32Array(n * 3), matA = new Float32Array(n * 3); const M = mt(m); for (let i = 0; i < n; i++) { colA.set([c.r, c.g, c.b], i * 3); matA.set(M, i * 3); } g.setAttribute('color', new THREE.BufferAttribute(colA, 3)); g.setAttribute('aMat', new THREE.BufferAttribute(matA, 3)); return new THREE.Mesh(g, charMat); };
  const shoulder = new THREE.Group();
  const upper = part(new THREE.CylinderGeometry(0.05, 0.058, 0.3, 12), sleeve, look.bare ? 'skin' : robe ? 'cloth' : ak === 'plate' ? 'metal' : ak === 'chain' ? 'chain' : 'cloth'); upper.position.y = -0.15; shoulder.add(upper);
  const elbow = new THREE.Group(); elbow.position.y = -0.3; shoulder.add(elbow);
  const forearm = part(new THREE.CylinderGeometry(0.036, 0.047, 0.28, 12), fore, robe ? 'cloth' : ak === 'plate' ? 'metal' : ak === 'chain' ? 'chain' : 'skin'); forearm.position.y = -0.14; elbow.add(forearm);
  if (robe) { const cuff = part(new THREE.CylinderGeometry(0.06, 0.04, 0.12, 12, 1, true), ac, 'cloth'); cuff.position.y = -0.24; elbow.add(cuff); }
  if (ak === 'leather') { const br = part(new THREE.CylinderGeometry(0.043, 0.048, 0.14, 12), '#3a2618', 'leather'); br.position.y = -0.18; elbow.add(br); }
  const ball = part(new THREE.SphereGeometry(0.05, 10, 8), sleeve, 'cloth'); elbow.add(ball);
  const wrist = new THREE.Group(); wrist.position.y = -0.28; elbow.add(wrist);
  const palm = part(new THREE.BoxGeometry(0.085, 0.1, 0.04), hand, ak === 'plate' ? 'metal' : 'skin'); palm.position.set(0, -0.045, 0); wrist.add(palm);
  const fing = part(new THREE.BoxGeometry(0.08, 0.06, 0.045), hand, ak === 'plate' ? 'metal' : 'skin'); fing.position.set(0, -0.1, 0.02); fing.rotation.x = 0.9; wrist.add(fing);
  const thumb = part(new THREE.BoxGeometry(0.03, 0.06, 0.03), hand, ak === 'plate' ? 'metal' : 'skin'); thumb.position.set(-side * 0.045, -0.05, 0.03); thumb.rotation.z = side * 0.5; wrist.add(thumb);
  const grip = new THREE.Group(); grip.position.set(0, -0.08, 0.02); wrist.add(grip);
  shoulder.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  return { shoulder, elbow, wrist, grip, held: null };
}
function rebuild(look) {
  for (const c of [...holder.children]) holder.remove(c);
  let L, R;
  if (useHumanBody(look, 'human')) {
    // the real arms of your hero: the same skin, sleeves and gloves as your body
    L = firstPersonArm(look, 'human', 'L'); R = firstPersonArm(look, 'human', 'R');
    for (const [a, x] of [[L, 0.27], [R, -0.27]]) { a.mesh.position.set(x - a.restArm[0], -0.27 - a.restArm[1], 0.0 - a.restArm[2]); holder.add(a.mesh); }
  } else {
    L = buildArm(1, look); R = buildArm(-1, look);
    L.shoulder.position.set(0.3, -0.34, 0.05); R.shoulder.position.set(-0.3, -0.34, 0.05); // the holder is turned to face -z
    holder.add(L.shoulder); holder.add(R.shoulder);
  }
  arms = { L, R, look };
  setHeld(look.weapon, look);
}
function setHeld(wt, look, tool) {
  for (const s of ['L', 'R']) { if (arms[s].held) { arms[s].grip.remove(arms[s].held); arms[s].held = null; } }
  const opt = { staff: look.staff || ['wizard', 'enchanter', 'magician', 'necromancer', 'druid', 'shaman', 'cleric'].includes(look.cls), orb: look.orb, tomeCol: look.tomeCol };
  const kind = tool || wt;
  arms.kind = kind;
  if (kind) {
    const w = weaponMesh(kind === 'sword' ? '1HS' : kind, opt);
    if (w) { w.traverse((o) => { if (o.isMesh) o.frustumCulled = false; }); const side = kind === 'ARC' || kind === 'TOME' ? 'L' : 'R'; arms[side].grip.add(w); arms[side].held = w; w.rotation.set(Math.PI / 2, 0, 0); if (kind === 'ARC') w.rotation.set(Math.PI / 2, 0, 0); }
  }
  if (!tool && look.offhand) {
    const off = look.offhand === 'shield' ? weaponMesh('shield', { shieldCol: look.shieldCol, shieldEmb: look.shieldEmb }) : weaponMesh(look.offhand === 'sword' ? '1HS' : look.offhand, {});
    if (off) { off.traverse((o) => { if (o.isMesh) o.frustumCulled = false; }); arms.L.grip.add(off); arms.L.held = off; if (look.offhand === 'shield') { off.position.set(0.06, 0.02, 0.06); off.rotation.set(-0.6, -Math.PI / 2 + 0.5, 0); off.scale.setScalar(0.6); arms.shield = true; } else { off.rotation.set(Math.PI / 2, 0, 0); arms.shield = false; } }
  } else arms.shield = false;
  arms.tool = tool || null;
}

const E = (o, x, y, z) => o.rotation.set(x, y, z);
export const viewmodel = {
  update(dt, p) {
    const fp = view.firstPerson() && K3.settings.fpArms && !p.dead && !p.sit;
    K3.vmVisible = fp;
    if (!fp) return;
    const look = p.look || {}; const s = JSON.stringify([look.armor, look.weapon, look.offhand, look.skin, look.robe, look.bare, look.staff, look.orb, look.wfx]);
    if (s !== sig || !arms) { sig = s; rebuild(look); }
    // gathering swaps in a tool
    const tool = p.harvest ? (p.harvest.tool === 'axe' ? 'axe' : 'pick') : null;
    if ((arms.tool || null) !== tool) setHeld(look.weapon, look, tool);
    // lighting follows the world
    scene.environment = K3.scene.environment; scene.environmentIntensity = K3.scene.environmentIntensity != null ? K3.scene.environmentIntensity : 1;
    const sky = K3.sky; hemi.intensity = sky.hemi.intensity * 1.2 + 0.15; hemi.color.copy(sky.hemi.color); hemi.groundColor.copy(sky.hemi.groundColor); dir.intensity = sky.sun.intensity * 0.8; dir.color.copy(sky.sun.color);
    const ld = K3.shared.uSunDir.value; const q = K3.camera.quaternion.clone().invert(); dir.position.copy(ld).applyQuaternion(q);
    point.intensity = (sky.darkness || 0) * 0.6 + (p.cast ? 1.5 : 0);
    const hostile = p.target && !p.target.dead && G.isHostile(p, p.target) && Math.hypot(p.target.x - p.x, p.target.y - p.y) < 500;
    const want = p.autoAttack || p.cast || p.atk > 0 || p.harvest || hostile || (p.inCombat) ? 1 : 0;
    ready += (want - ready) * Math.min(1, dt * 6);
    const t = K3.time; const bob = view.bob; const mv = p.moving ? 1 : 0;
    const swayX = Math.sin(bob) * 0.012 * mv + Math.sin(t * 1.3) * 0.003, swayY = Math.abs(Math.cos(bob)) * 0.015 * mv + Math.sin(t * 1.9) * 0.004;
    holder.position.set(swayX, -swayY - (1 - ready) * 0.55, 0);
    const L = arms.L, R = arms.R, k = arms.kind;
    // base pose: forearms forward, weapon up
    E(R.shoulder, -1.5, -0.15, 0.1); E(R.elbow, -0.35, 0, 0); E(R.wrist, 0.75, 0, -0.45);
    E(L.shoulder, -1.05, -0.15, -0.1); E(L.elbow, -0.9, 0, 0); E(L.wrist, 0.2, 0, 0);
    if (!k || k === 'H2H') { E(R.shoulder, -1.0, 0.2, 0.12); E(R.elbow, -1.5, 0, 0); E(L.shoulder, -1.0, -0.2, -0.12); E(L.elbow, -1.5, 0, 0); }
    if (k === '2HS' || k === '2HSaxe' || k === 'spear' || (k === '2HB' && !(look.staff || ['wizard', 'enchanter', 'magician', 'necromancer', 'druid', 'shaman', 'cleric'].includes(look.cls)))) { E(R.shoulder, -1.1, 0.35, 0.1); E(R.elbow, -0.8, 0, 0); E(L.shoulder, -1.15, -0.55, -0.35); E(L.elbow, -0.7, 0, 0.3); }
    if (k === 'ARC') { E(L.shoulder, -1.4, 0.32, -0.1); E(L.elbow, -0.2, 0, 0); E(L.wrist, 0, 0, 0.35); E(R.shoulder, -1.25, -0.15, 0.15); E(R.elbow, -1.3, 0, 0); }
    if (arms.shield) { E(L.shoulder, -1.15 - 0.2 * ready, 0.4, -0.25); E(L.elbow, -0.45, 0, 0); }
    if (!arms.shield && !arms.L.held && k !== 'ARC' && k && k !== 'H2H' && !(k === '2HS' || k === 'spear' || k === '2HSaxe')) { E(L.shoulder, -0.6, -0.1, -0.1); E(L.elbow, -0.4, 0, 0); }
    // casting: both hands up, glowing
    if (p.cast) {
      const w = Math.sin(t * 9) * 0.06; E(R.shoulder, -1.35 + w, 0.3, 0.15); E(R.elbow, -0.55, 0, 0); E(L.shoulder, -1.35 - w, -0.3, -0.15); E(L.elbow, -0.55, 0, 0); E(R.wrist, -0.3, 0, 0); E(L.wrist, -0.3, 0, 0);
      const col = rgb(CAST_COL[(p.cast.spell && p.cast.spell.res) || (p.cast.spell && p.cast.spell.target === 'enemy' ? 'magic' : 'heal')] || '255,220,140', 1);
      point.color.setRGB(col[0], col[1], col[2]);
      if (Math.random() < 0.6) { const wp = new THREE.Vector3(); for (const side of [L, R]) { side.wrist.getWorldPosition(wp); wp.applyMatrix4(K3.camera.matrixWorld); fx.add.emit({ x: wp.x, y: wp.y, z: wp.z, vy: 0.4, life: 0.4, s0: 0.05, s1: 0.01, r: col[0] * 3, g: col[1] * 3, b: col[2] * 3, kind: 1 }); } }
    }
    // swings: p.atk ramps 0..1 for each blow
    const a = p.atk || 0;
    if (a > 0 && a < 1) {
      const wind = K3.smooth(0, 0.3, a), hit = K3.smooth(0.25, 0.55, a), rec = K3.smooth(0.55, 1, a);
      const mode = tool ? 'tool' : p.c && p.c.rangeMode === 'ranged' && look.rangeW === 'ARC' ? 'bow' : k === 'ARC' ? 'bow' : k === 'spear' || k === '1HP' || k === 'dagger' ? 'thrust' : k === '2HS' || k === '2HSaxe' || k === 'club' ? 'chop' : !k || k === 'H2H' ? 'punch' : k === '2HB' ? 'staff' : 'slash';
      if (mode === 'slash') { R.shoulder.rotation.x += -0.6 * wind + 1.2 * hit - 0.6 * rec; R.shoulder.rotation.z += 0.45 * wind - 0.9 * hit + 0.45 * rec; R.shoulder.rotation.y += -0.3 * hit * (1 - rec); R.elbow.rotation.x += 0.5 * hit * (1 - rec); R.wrist.rotation.z = -0.8 * hit * (1 - rec); }
      else if (mode === 'chop' || mode === 'tool' || mode === 'staff') { const up = wind * (1 - hit); R.shoulder.rotation.x += -1.0 * up + 0.9 * hit * (1 - rec); L.shoulder.rotation.x += -1.0 * up + 0.9 * hit * (1 - rec); R.elbow.rotation.x += 0.4 * up; R.wrist.rotation.x += 0.8 * hit * (1 - rec); }
      else if (mode === 'thrust') { const push = hit * (1 - rec); R.shoulder.position.z = 0.05 + 0.25 * push; R.shoulder.rotation.x += -0.35 * push; R.elbow.rotation.x += 0.7 * push; }
      else if (mode === 'punch') { const side = (Math.floor(G.now / 700) % 2) ? L : R; const push = hit * (1 - rec); side.shoulder.position.z = 0.05 + 0.3 * push; side.elbow.rotation.x += 1.2 * push; }
      else if (mode === 'bow') { const dr = K3.smooth(0, 0.5, a), rl = K3.smooth(0.5, 0.6, a); R.shoulder.position.z = 0.05 - 0.12 * dr * (1 - rl); R.elbow.rotation.x -= 0.4 * dr * (1 - rl); }
    } else { R.shoulder.position.z = 0.05; L.shoulder.position.z = 0.05; }
    // kicks (monks) and special moves
    if (p.animK && p.animT > G.now) { const pk = 1 - (p.animT - G.now) / (p.animDur || 400); const s1 = Math.sin(pk * Math.PI); if (p.animK === 'raise') { R.shoulder.rotation.x -= 1.0 * s1; L.shoulder.rotation.x -= 1.0 * s1; } else if (p.animK === 'slam') { R.shoulder.rotation.x += -1.2 * s1 + 0.6; L.shoulder.rotation.x += -1.2 * s1 + 0.6; } else if (p.animK === 'spin') { holder.rotation.z = pk * Math.PI * 2; } }
    else holder.rotation.z = 0;
    for (const a of [L, R]) if (a.restArm) a.shoulder.position.z = a.restArm[2] + (a.shoulder.position.z - 0.05); // real arms keep their own shoulder
    holder.rotation.y = Math.PI;
    // fingers wrap the weapon, open for spells
    for (const S of ['L', 'R']) { const a = arms[S]; if (!a.curl) continue; const want = p.cast ? 0.1 : a.held ? (arms.shield && S === 'L' ? 0.8 : 1.4) : 0.35; a.c = a.c == null ? want : a.c + (want - a.c) * Math.min(1, dt * 12); a.curl(a.c); }
    // enchanted blades shed sparks
    if (look.wfx && R.held && WFX[look.wfx] && Math.random() < 0.5) { const c = WFX[look.wfx]; const wp = new THREE.Vector3(0, (BLADE_LEN[k] || 0.7) * Math.random(), 0); R.held.localToWorld(wp); wp.applyMatrix4(K3.camera.matrixWorld); fx.add.emit({ x: wp.x, y: wp.y, z: wp.z, vy: 0.2, life: 0.3, s0: 0.04, s1: 0.01, r: c[0], g: c[1], b: c[2], kind: 1 }); }
    cam.fov = Math.min(70, K3.settings.fov * 0.85); cam.updateProjectionMatrix();
    holder.updateMatrixWorld(true);
  },
};

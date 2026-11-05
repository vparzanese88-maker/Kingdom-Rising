// Warrior banners: a pole driven into the ground with a waving flag. While you stand within its reach you get
// its blessing, shown by the ring on the ground, rising motes in its colour and the buff on your HUD.
//   war   (red and gold): you hit 20% harder
//   vigor (green):        you regenerate 3% of your health every second
//   stone (steel blue):   you take 30% less damage
import * as THREE from 'three';
import { G } from './state.js';
import { V } from './vfx.js';
import { heightAt } from './terrain.js';

export const BANNER = {
  war: { name: 'War Banner', cloth: '#b01818', trim: '#ffd050', glow: '#ff7a3a', mote: 'ember', buff: 'bWar' },
  vigor: { name: 'Banner of Vigor', cloth: '#1e8a3a', trim: '#e8ffd0', glow: '#60ff90', mote: 'heal', buff: 'bVigor' },
  rally: { name: 'Rallying Banner', cloth: '#c88a18', trim: '#fff0c0', glow: '#ffd050', mote: 'gold', buff: 'cry' },
  stone: { name: 'Banner of Stone', cloth: '#2a4a7a', trim: '#c8d8ff', glow: '#8ac8ff', mote: 'frost', buff: 'bStone' },
};
const list = [];
const W = 1.3, H = 0.95, SX = 14, SY = 8;

function build(kind) {
  const B = BANNER[kind], root = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#5a3a1e', roughness: 0.8 }), gold = new THREE.MeshStandardMaterial({ color: B.trim, metalness: 0.6, roughness: 0.35, emissive: B.trim, emissiveIntensity: 0.15 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 8), wood); pole.position.y = 1.7; root.add(pole);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, W + 0.2, 6), wood); bar.rotation.z = Math.PI / 2; bar.position.set(W / 2, 3.2, 0); root.add(bar);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 8), gold); tip.position.y = 3.55; root.add(tip);
  for (const x of [-0.08, W + 0.08]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), gold); k.position.set(x, 3.2, 0); root.add(k); }
  // the flag: a grid we ripple every frame, hung from the cross bar, swallow-tailed at the bottom
  const geo = new THREE.PlaneGeometry(W, H * 1.35, SX, SY); geo.translate(W / 2, 3.2 - H * 0.675, 0);
  const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); const u = x / W, v = (3.2 - y) / (H * 1.35); if (v > 0.72) { const notch = 1 - Math.abs(u - 0.5) * 2; pos.setY(i, 3.2 - H * 1.35 * (0.72 + (v - 0.72) * (1 - notch * 0.75))); } }
  geo.userData.base = Float32Array.from(pos.array);
  const tex = flagTexture(B), cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9, emissive: B.glow, emissiveIntensity: 0.08 }));
  root.add(cloth); root.userData.cloth = cloth;
  // the reach on the ground
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), new THREE.MeshBasicMaterial({ color: B.glow, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; ring.visible = false; root.add(ring); root.userData.ring = ring;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: B.glow, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.06; disc.visible = false; root.add(disc); root.userData.disc = disc;
  return root;
}
const texCache = {};
function flagTexture(B) {
  if (texCache[B.name]) return texCache[B.name];
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = B.cloth; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = B.trim; x.lineWidth = 8; x.strokeRect(6, 6, 116, 116);
  x.fillStyle = B.trim; x.globalAlpha = 0.95; x.beginPath();
  if (B.buff === 'bWar' || B.buff === 'cry') { x.moveTo(64, 22); x.lineTo(72, 56); x.lineTo(100, 60); x.lineTo(74, 72); x.lineTo(82, 104); x.lineTo(64, 84); x.lineTo(46, 104); x.lineTo(54, 72); x.lineTo(28, 60); x.lineTo(56, 56); x.closePath(); x.fill(); x.fillRect(60, 30, 8, 70); }
  else if (B.buff === 'bVigor') { x.moveTo(64, 100); x.bezierCurveTo(20, 70, 26, 30, 50, 34); x.bezierCurveTo(58, 34, 62, 40, 64, 46); x.bezierCurveTo(66, 40, 70, 34, 78, 34); x.bezierCurveTo(102, 30, 108, 70, 64, 100); x.fill(); x.fillStyle = B.cloth; x.fillRect(59, 50, 10, 34); x.fillRect(47, 62, 34, 10); }
  else { x.moveTo(64, 20); x.lineTo(100, 32); x.lineTo(100, 60); x.bezierCurveTo(100, 84, 84, 98, 64, 108); x.bezierCurveTo(44, 98, 28, 84, 28, 60); x.lineTo(28, 32); x.closePath(); x.fill(); x.fillStyle = B.cloth; x.fillRect(60, 34, 8, 60); x.fillRect(40, 54, 48, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (texCache[B.name] = t);
}

// one banner of each kind at a time: planting it again moves it
export function plantBanner(kind, at, yaw, dur, r) {
  for (const b of list.filter(o => o.kind === kind)) remove(b);
  const root = build(kind), y = heightAt(at.x, at.z);
  root.position.set(at.x, y, at.z); root.rotation.y = yaw + Math.PI / 2; root.scale.set(1, 0.01, 1);
  G.scene.add(root);
  const b = { kind, root, t: 0, dur, r, pos: new THREE.Vector3(at.x, y, at.z), moteT: 0 };
  root.userData.ring.scale.setScalar(r / 2); root.userData.disc.scale.setScalar(r / 2); // (hidden: no circles)
  list.push(b);
  const B = BANNER[kind];
  V.burst('dust', b.pos.clone().setY(y + 0.2), 30, { speed: 5, size: 1 }); V.burst('stone', b.pos.clone().setY(y + 0.2), 14, { speed: 5, grav: 14, size: 0.25 });
  V.burst(B.mote, b.pos.clone().setY(y + 5), 50, { speed: 5, vy: 2 }); V.light(b.pos.clone().setY(y + 5), B.glow, 8, 0.6); V.addShake(0.3);
  return b;
}
function remove(b) { G.scene.remove(b.root); b.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); const i = list.indexOf(b); if (i >= 0) list.splice(i, 1); }
export const banners = () => list;
export function clearBanners() { for (const b of list.slice()) remove(b); }

// every frame: rise out of the ground, ripple the flag, pulse the ring, bless whoever stands inside
export function updateBanners(dt, P) {
  for (const b of list.slice()) {
    b.t += dt; const B = BANNER[b.kind], R = b.root, ud = R.userData;
    if (b.t > b.dur) { V.burst('dust', b.pos.clone().setY(b.pos.y + 1), 20, { speed: 3, size: 0.9 }); remove(b); continue; }
    const rise = Math.min(1, b.t / 0.25); R.scale.x = R.scale.z = 2; R.scale.y = 2 * ( 0.01 + (1 - Math.pow(1 - rise, 3)) * 0.99 + (rise < 1 ? 0 : Math.max(0, 0.08 * Math.sin((b.t - 0.25) * 20) * Math.exp(-(b.t - 0.25) * 6))));
    const fade = b.dur - b.t < 1.5 ? (b.dur - b.t) / 1.5 : 1;
    ud.ring.material.opacity = (0.35 + 0.25 * Math.sin(b.t * 4)) * fade; ud.disc.material.opacity = 0.07 * fade;
    // waving cloth: a travelling wave that grows toward the free edge, with a little flutter
    const cl = ud.cloth, pos = cl.geometry.attributes.position, base = cl.geometry.userData.base, tt = b.t;
    for (let i = 0; i < pos.count; i++) { const x = base[i * 3], y = base[i * 3 + 1], u = x / W; pos.setZ(i, (Math.sin(u * 6 - tt * 5.5 + y * 0.8) * 0.16 + Math.sin(u * 13 - tt * 9) * 0.035) * u * 1.2); pos.setX(i, x - u * u * 0.08 * (1 + Math.sin(tt * 3))); }
    pos.needsUpdate = true; cl.geometry.computeVertexNormals();
    if (false && (b.moteT -= dt) <= 0) { b.moteT = 0.12; const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * b.r; V.emit(B.mote, new THREE.Vector3(b.pos.x + Math.cos(a) * rr, b.pos.y + 0.2, b.pos.z + Math.sin(a) * rr), { speed: 0.3, vy: 1.4, size: 0.3, life: 1.1 }); }
    if (P && !P.dead && Math.hypot(P.pos.x - b.pos.x, P.pos.z - b.pos.z) < b.r) {
      P.buffs[B.buff] = 0.35;
      if (b.kind === 'vigor' && P.hp < P.maxHp) { const add = Math.min(P.maxHp - P.hp, P.maxHp * 0.03 * dt * (P.hk ? P.hk() : 1)); P.hp += add; b.healed = (b.healed || 0) + add; }
      if ((b.tickT = (b.tickT || 0) - dt) <= 0) { b.tickT = 1; // once a second: show it working on you
        if (b.kind === 'vigor' && b.healed >= 1) { V.number(P.pos.clone().setY(P.pos.y + 2.1), '+' + Math.round(b.healed), 'heal'); V.burst('heal', P.pos.clone().setY(P.pos.y + 1), 12, { speed: 1.5, vy: 2 }); b.healed = 0; }
      }
    }
  }
}

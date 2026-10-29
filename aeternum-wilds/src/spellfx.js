// Elemental spell effects: bursts, lightning arcs, holy pillars, falling meteors and light flashes.
import * as THREE from 'three';
import { G } from './state.js';
import { burst, shockRing } from './fx.js';
import { heightAt } from './world.js';

export const ELEMENT_COLOR = {
  fire: 0xff7a2a, frost: 0x8ad8ff, shadow: 0x8a3aff, holy: 0xffe27a, nature: 0x6ae04a, lightning: 0xb8d8ff,
  blood: 0xd0203a, arcane: 0xc66dff, physical: 0xd8c8a0, poison: 0x9ae03a, spirit: 0x6af0e0, sound: 0xffb0e0,
};
export const elColor = (el, fallback) => ELEMENT_COLOR[el] ?? fallback ?? 0x9ad0ff;

// a small pool of point lights reused for flashes (a fixed count keeps shaders from recompiling)
const lights = [];
function initLights() {
  if (lights.length) return;
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffffff, 0, 14, 1.8); G.scene.add(l); lights.push({ l, t: 0, dur: 1, peak: 0 }); }
}
export function flash(x, y, z, color, power = 30, dur = 0.35, range = 14) {
  initLights();
  const s = lights.reduce((a, b) => (a.t / a.dur > b.t / b.dur ? a : b));
  s.l.position.set(x, y, z); s.l.color.setHex(color); s.l.distance = range;
  s.t = 0; s.dur = dur; s.peak = power;
}

const temp = []; // short-lived meshes: {mesh, t, dur, update}
function addTemp(mesh, dur, update) { G.scene.add(mesh); temp.push({ mesh, t: 0, dur, update }); }

function glowMat(color, opacity = 0.9) { return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }); }

// a jagged lightning bolt between two points
export function lightning(a, b, color = 0xb8d8ff) {
  const pts = [], n = 10;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const j = i === 0 || i === n ? 0 : 0.5;
    pts.push(new THREE.Vector3(a.x + (b.x - a.x) * k + (Math.random() - 0.5) * j, a.y + (b.y - a.y) * k + (Math.random() - 0.5) * j, a.z + (b.z - a.z) * k + (Math.random() - 0.5) * j));
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.06, 4, false);
  const m = new THREE.Mesh(geo, glowMat(color, 1));
  addTemp(m, 0.25, (o, k) => { o.material.opacity = 1 - k; });
  const core = new THREE.Mesh(geo, glowMat(0xffffff, 1)); core.scale.setScalar(1);
  addTemp(core, 0.12, (o, k) => { o.material.opacity = 1 - k; });
  flash((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, color, 40, 0.2);
}

// column of light (holy) or of flame
export function pillar(x, z, r, color, height = 9) {
  const y = heightAt(x, z);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, height, 20, 1, true), glowMat(color, 0.55));
  m.position.set(x, y + height / 2, z);
  addTemp(m, 0.7, (o, k) => { o.material.opacity = 0.55 * (1 - k); o.scale.x = o.scale.z = 1 + k * 0.3; });
}

// expanding glowing dome
export function dome(x, y, z, r, color, dur = 0.45) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), glowMat(color, 0.5));
  m.position.set(x, y, z);
  addTemp(m, dur, (o, k) => { o.scale.setScalar(0.3 + k * r); o.material.opacity = 0.5 * (1 - k); });
}

// burst with an elemental look at a point; r is roughly the area size
export function impact(el, x, y, z, r = 2) {
  const c = elColor(el);
  const n = Math.round(10 + r * 5);
  switch (el) {
    case 'fire':
      burst(x, y, z, 0xffd060, n, 5 + r, 0.5, 0.22, 2);
      burst(x, y, z, 0xff5010, n, 4 + r, 0.8, 0.3, -2);
      burst(x, y, z, 0x3a2a20, Math.round(n / 2), 2, 1.2, 0.35, -3);
      dome(x, y, z, r, 0xff7a2a, 0.4);
      flash(x, y + 1, z, 0xff7a2a, 60, 0.45, r * 6);
      break;
    case 'frost':
      burst(x, y, z, 0xe8f8ff, n, 5 + r, 0.6, 0.2, 9);
      burst(x, y, z, 0x8ad8ff, n, 3 + r, 0.9, 0.28, 3);
      dome(x, y, z, r, 0xbfeaff, 0.5);
      flash(x, y + 1, z, 0x8ad8ff, 35, 0.4, r * 5);
      break;
    case 'lightning':
      for (let i = 0; i < 3; i++) lightning({ x: x + (Math.random() - 0.5) * r, y: y + 7, z: z + (Math.random() - 0.5) * r }, { x, y, z }, c);
      burst(x, y, z, 0xffffff, n, 6 + r, 0.3, 0.15, 6);
      break;
    case 'holy':
      pillar(x, z, Math.max(0.8, r * 0.5), 0xffe27a);
      burst(x, y, z, 0xfff0b0, n, 3 + r, 0.8, 0.2, -3);
      flash(x, y + 2, z, 0xffe27a, 50, 0.5, r * 6);
      break;
    case 'shadow':
      burst(x, y, z, 0x5a1aa0, n, 2 + r * 0.6, 1.2, 0.4, -2.5);
      burst(x, y, z, 0x1a0a2a, n, 3 + r, 0.9, 0.35, -1.5);
      dome(x, y, z, r, 0x6a2aff, 0.5);
      break;
    case 'nature':
      burst(x, y, z, 0x6ae04a, n, 4 + r, 0.9, 0.18, 4);
      burst(x, y, z, 0xa8f070, Math.round(n / 2), 2, 1.2, 0.14, -1.5);
      break;
    case 'blood':
      burst(x, y, z, 0xa0101a, n, 5 + r, 0.7, 0.2, 10);
      dome(x, y, z, r, 0xd0203a, 0.35);
      break;
    case 'poison':
      burst(x, y, z, 0x9ae03a, n, 2 + r * 0.5, 1.3, 0.3, -1.5);
      dome(x, y, z, r, 0x7ac02a, 0.6);
      break;
    case 'arcane':
      burst(x, y, z, 0xc66dff, n, 5 + r, 0.6, 0.16, 0);
      burst(x, y, z, 0xffffff, Math.round(n / 3), 3, 0.5, 0.1, 0);
      shockRing(x, z, r, 0xc66dff, 0.5);
      flash(x, y + 1, z, 0xc66dff, 35, 0.35, r * 5);
      break;
    case 'spirit':
      burst(x, y, z, 0x6af0e0, n, 2 + r * 0.5, 1.3, 0.22, -3);
      dome(x, y, z, r, 0x6af0e0, 0.5);
      break;
    case 'sound':
      for (let i = 0; i < 3; i++) setTimeout(() => shockRing(x, z, r * (1 + i * 0.3), 0xffb0e0, 0.5), i * 90);
      burst(x, y, z, 0xffb0e0, Math.round(n / 2), 4, 0.5, 0.12, 0);
      break;
    default:
      burst(x, y, z, 0xd8c8a0, n, 4 + r, 0.6, 0.22, 9);
      burst(x, y, z, 0x8a7a60, Math.round(n / 2), 3, 0.8, 0.3, 6);
  }
}

// little sparkle around the caster's hands when a spell goes off
export function castGlow(el, x, y, z) {
  const c = elColor(el);
  burst(x, y, z, c, 8, 1.6, 0.5, 0.12, -1);
  flash(x, y, z, c, 15, 0.25, 6);
}

// a glowing rock falling from the sky onto (x, z) over `dur` seconds, then onLand()
export function meteor(x, z, dur, color, onLand) {
  const gy = heightAt(x, z);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), new THREE.MeshLambertMaterial({ color: 0x3a2a20, emissive: color, emissiveIntensity: 0.6 })));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 8), glowMat(color, 0.45)));
  const sx = x + 14, sy = gy + 40, sz = z - 6;
  g.position.set(sx, sy, sz);
  addTemp(g, dur, (o, k) => {
    o.position.set(sx + (x - sx) * k, sy + (gy - sy) * k * k, sz + (z - sz) * k);
    o.rotation.x += 0.2; o.rotation.y += 0.15;
    burst(o.position.x, o.position.y, o.position.z, color, 2, 1, 0.5, 0.4, -1);
    if (k >= 1 && !o.userData.landed) { o.userData.landed = true; onLand(); }
  });
}

// stationary totem/ward model; returns the group (caller removes it)
export function totemMesh(color) {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x5a3a22, flatShading: true });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2, 6), wood); pole.position.y = 1; g.add(pole);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.42), new THREE.MeshLambertMaterial({ color: [0x8a2a1a, 0x2a4a8a, 0x2a6a3a][i], flatShading: true })); b.position.y = 0.6 + i * 0.5; b.rotation.y = i; g.add(b); }
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), new THREE.MeshBasicMaterial({ color })); orb.position.y = 2.3; g.add(orb); g.userData.orb = orb;
  return g;
}

export function updateSpellFx(dt) {
  for (const s of lights) { if (s.t < s.dur) { s.t += dt; s.l.intensity = s.peak * Math.max(0, 1 - s.t / s.dur); } else s.l.intensity = 0; }
  for (let i = temp.length - 1; i >= 0; i--) {
    const o = temp[i];
    o.t += dt;
    const k = Math.min(1, o.t / o.dur);
    o.update?.(o.mesh, k);
    if (o.t >= o.dur) {
      G.scene.remove(o.mesh);
      o.mesh.traverse(m => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } });
      temp.splice(i, 1);
    }
  }
}

// Elemental spell effects: every element has its own cast (hand glow, magic circle, motes), its own projectile
// (glowing core, halo, light, trailing particles) and its own impact (fire explosions with smoke and embers,
// frost shatter, lightning arcs, holy pillars, shadow tendrils, vines and leaves, poison clouds, arcane runes,
// spirit wisps, sonic rings, blood spray). Built on the pooled particle and mesh effects in gfx/vfx.
import * as THREE from 'three';
import { G } from './state.js';
import { heightAt } from './world.js';
import { emit, emitOne } from './gfx/vfx/particles.js';
import { FX } from './gfx/vfx/presets.js';
import { decal, wall, orb, beam, bolt, tendril, updateMeshFx } from './gfx/vfx/meshfx.js';
import { flash as lightFlash, updateLights } from './gfx/vfx/lights.js';
import { eruption, blastCloud } from './gfx/spellfx.js';

export const ELEMENT_COLOR = {
  fire: 0xff7a2a, frost: 0x8ad8ff, shadow: 0x8a3aff, holy: 0xffe27a, nature: 0x6ae04a, lightning: 0xb8d8ff,
  blood: 0xd0203a, arcane: 0xc66dff, physical: 0xd8c8a0, poison: 0x9ae03a, spirit: 0x6af0e0, sound: 0xffb0e0,
};
export const elColor = (el, fallback) => ELEMENT_COLOR[el] ?? fallback ?? 0x9ad0ff;
// the element whose colour is nearest (for projectiles and buffs that only know a colour)
const elCache = new Map();
export function elFromColor(hex) {
  if (hex == null) return 'physical';
  let r = elCache.get(hex); if (r) return r;
  const c = new THREE.Color(hex); let best = 1e9;
  for (const [k, v] of Object.entries(ELEMENT_COLOR)) { const d = new THREE.Color(v); const e = (d.r - c.r) ** 2 + (d.g - c.g) ** 2 + (d.b - c.b) ** 2; if (e < best) { best = e; r = k; } }
  elCache.set(hex, r);
  return r;
}

export function flash(x, y, z, color, power = 30, dur = 0.35, range = 14) { lightFlash(x, y, z, color, power, dur, range); }

// a jagged lightning bolt between two points, with a branch or two and sparks where it lands
export function lightning(a, b, color = 0xb8d8ff) {
  bolt(a, b, color, { width: 0.1, hdr: 3.2, dur: 0.24 });
  bolt(a, b, color, { width: 0.05, hdr: 2.2, dur: 0.18, jag: 1.6 });
  const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  if (L > 3) {
    const k = 0.35 + Math.random() * 0.3, mx = a.x + (b.x - a.x) * k, my = a.y + (b.y - a.y) * k, mz = a.z + (b.z - a.z) * k;
    bolt({ x: mx, y: my, z: mz }, { x: mx + (Math.random() - 0.5) * L * 0.5, y: my - Math.random() * L * 0.25, z: mz + (Math.random() - 0.5) * L * 0.5 }, color, { width: 0.04, hdr: 2, dur: 0.16 });
  }
  emit(FX.zap, 10, b.x, b.y, b.z);
  emit(FX.flashSmall, 1, b.x, b.y, b.z, 0, 1, 0, 1.2, color);
  lightFlash((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, color, 45, 0.22, 16, 0.02);
}

// column of light (holy) or flame
export function pillar(x, z, r, color, height = 9) {
  const y = heightAt(x, z);
  beam(x, y, z, r, height, color, 0.8, 0xffffff, 2.4);
  emit(FX.holyMote, Math.round(10 + r * 6), x, y + 0.5, z, 0, 1, 0, 1, color);
  decal(x, z, { ring: { w: 0.12 }, size: r * 4, color: 0x000000, alpha: 0, glow: 1, glowColor: color, glowHdr: 2.5, life: 0.6 });
}

// expanding glowing dome
export function dome(x, y, z, r, color, dur = 0.45) {
  orb(x, y, z, { color, r0: 0.3, r1: r, dur, alpha: 0.7, rim: 2.2, hdr: 1.6 });
}

// ---------- impacts ----------
const D = 'cone';
export function impact(el, x, y, z, r = 2) {
  const c = elColor(el);
  const s = Math.max(0.6, Math.min(2.4, 0.55 + r * 0.3)); // effect scale
  const n = (k) => Math.round(k * (0.7 + r * 0.35));
  const gy = heightAt(x, z), low = y - gy < 1.6;
  // the owner's sculpted effects: fire and blood explode in a rolling cloud, everything else erupts as a column
  if (low && r >= 1.5) {
    if (el === 'fire') blastCloud(G.scene, x, gy, z, r);
    else if (el === 'blood' || el === 'physical') blastCloud(G.scene, x, gy, z, r, c);
    else eruption(G.scene, x, gy, z, r * 0.8, el === 'arcane' || el === 'shadow' ? null : c);
  }
  switch (el) {
    case 'fire': {
      emit(FX.flash, 1, x, y, z, 0, 1, 0, s * 1.6, 0xffc070);
      emit(FX.fireBall, n(5), x, y, z, 0, 1, 0, s);
      emit(FX.fire, n(12), x, y, z, 0, 1, 0, s);
      emit(FX.sparkWide, n(14), x, y, z, 0, 1, 0, 1, 0xffb050);
      emit(FX.ember, n(12), x, y, z, 0, 1, 0, s);
      emit(FX.smokeDark, n(6), x, y + 0.4, z, 0, 1, 0, s);
      emit(FX.smoke, n(5), x, y + 0.8, z, 0, 1, 0, s);
      orb(x, y, z, { color: 0xff7a2a, core: 0xffe0a0, r0: 0.3, r1: r * 0.9, dur: 0.35, alpha: 0.9, rim: 1.4, hdr: 2.2 });
      if (low) { decal(x, z, { cell: 1, size: r * 2.6 + 1, color: 0x120804, alpha: 0.75, glow: 1, glowColor: 0xff6a1a, glowHdr: 2.5, life: 7, glowFade: 0.4 }); wall(x, gy, z, r * 1.1, 0xff7a2a, 0.4, 1.2, 2.2); }
      lightFlash(x, y + 1, z, 0xff8a3a, 70, 0.5, r * 6 + 6);
      break;
    }
    case 'frost': {
      emit(FX.flash, 1, x, y, z, 0, 1, 0, s * 1.3, 0xd8f4ff);
      emit(FX.shardIce, n(16), x, y, z, 0, 1, 0, s);
      emit(FX.frostMist, n(8), x, y, z, 0, 1, 0, s);
      emit(FX.snow, n(18), x, y + 0.3, z, 0, 1, 0, s);
      emit(FX.sparkle, n(6), x, y, z, 0, 1, 0, 1, 0xbfeaff);
      orb(x, y, z, { color: 0x9ad8ff, core: 0xffffff, r0: 0.4, r1: r, dur: 0.5, alpha: 0.75, rim: 2.5, hdr: 1.4, cover: 0.15 });
      if (low) decal(x, z, { cell: 3, size: r * 2.4 + 1, color: 0xdff4ff, alpha: 0.55, glow: 0.6, glowColor: 0x9ad8ff, glowHdr: 1.4, life: 5, glowFade: 1 });
      lightFlash(x, y + 1, z, 0x8ad8ff, 40, 0.45, r * 5 + 6);
      break;
    }
    case 'lightning': {
      for (let i = 0; i < 3; i++) lightning({ x: x + (Math.random() - 0.5) * r * 1.5, y: y + 8 + Math.random() * 3, z: z + (Math.random() - 0.5) * r * 1.5 }, { x: x + (Math.random() - 0.5) * r * 0.6, y, z: z + (Math.random() - 0.5) * r * 0.6 }, c);
      for (let i = 0; i < 3; i++) { const a = Math.random() * 6.283, d = r * (0.5 + Math.random() * 0.7); bolt({ x, y, z }, { x: x + Math.cos(a) * d, y: gy + 0.2, z: z + Math.sin(a) * d }, c, { width: 0.04, hdr: 2.5, dur: 0.2 }); }
      emit(FX.flash, 1, x, y, z, 0, 1, 0, s * 1.5, 0xe8f4ff);
      emit(FX.zap, n(14), x, y, z);
      emit(FX.ringFlash, 1, x, y, z, 0, 1, 0, s * 0.8, c);
      if (low) decal(x, z, { cell: 1, size: r * 1.8 + 1, color: 0x0a0a10, alpha: 0.55, glow: 0.7, glowColor: 0x9ac8ff, glowHdr: 2, life: 4, glowFade: 0.25 });
      break;
    }
    case 'holy': {
      pillar(x, z, Math.max(0.8, r * 0.5), 0xffe27a, 9 + r);
      emit(FX.flash, 1, x, y, z, 0, 1, 0, s * 1.4, 0xfff0c0);
      emit(FX.star, 1, x, y + 0.5, z, 0, 1, 0, s * 0.8, 0xfff4c0);
      emit(FX.holyMote, n(10), x, y, z, 0, 1, 0, s);
      emit(FX.sparkle, n(8), x, y, z, 0, 1, 0, 1, 0xfff0b0);
      decal(x, z, { cell: 2, size: r * 2.2 + 1.2, color: 0x000000, alpha: 0, glow: 1.2, glowColor: 0xffe08a, glowHdr: 2.2, life: 1.1, grow: 0.15, spin: 0.8, glowFade: 1 });
      lightFlash(x, y + 2, z, 0xffe27a, 60, 0.6, r * 6 + 6);
      break;
    }
    case 'shadow': {
      const tn = Math.min(8, 3 + Math.round(r * 1.2));
      for (let i = 0; i < tn; i++) { const a = i / tn * 6.283 + Math.random(), d = r * (0.25 + Math.random() * 0.55); tendril(x + Math.cos(a) * d, gy, z + Math.sin(a) * d, { height: 1.4 + Math.random() * 1.6 * s, radius: 0.5 + Math.random() * 0.5, dur: 0.8 + Math.random() * 0.3, width: 0.1 * s, color: 0x12061e, core: 0x9a4aff, coreHdr: 2.2, cover: 0.85 }); }
      emit(FX.shadowSmoke, n(10), x, y, z, 0, 1, 0, s);
      emit(FX.shadowWisp, n(8), x, y, z, 0, 1, 0, s);
      orb(x, y, z, { color: 0x6a2aff, core: 0x100418, r0: r * 1.1, r1: 0.2, dur: 0.45, alpha: 0.85, rim: 1.6, hdr: 1.6, cover: 0.5 });
      if (low) decal(x, z, { cell: 3, size: r * 2.2 + 1, color: 0x0a0410, alpha: 0.7, glow: 0.8, glowColor: 0x8a3aff, glowHdr: 2, life: 4, glowFade: 0.5 });
      lightFlash(x, y + 1, z, 0x8a3aff, 30, 0.5, r * 5 + 5);
      break;
    }
    case 'nature': {
      emit(FX.leaf, n(16), x, y, z, 0, 1, 0, s);
      emit(FX.pollen, n(12), x, y, z, 0, 1, 0, s);
      emit(FX.dust, n(6), x, gy + 0.1, z, 0, 1, 0, s * 0.8, 0x8a7a4a);
      const vn = Math.min(6, 2 + Math.round(r));
      for (let i = 0; i < vn; i++) { const a = Math.random() * 6.283, d = r * Math.random() * 0.6; tendril(x + Math.cos(a) * d, gy, z + Math.sin(a) * d, { height: 1 + Math.random() * 1.2 * s, radius: 0.4, dur: 1.0, width: 0.07 * s, color: 0x2a6a1a, core: 0x8af05a, coreHdr: 1.2, cover: 0.95, curl: 5 }); }
      emit(FX.flashSmall, 1, x, y, z, 0, 1, 0, s * 1.4, 0xa8f070);
      if (low) decal(x, z, { cell: 2, size: r * 2 + 1, color: 0x000000, alpha: 0, glow: 0.8, glowColor: 0x6ae04a, glowHdr: 1.6, life: 1.2, grow: 0.2, spin: 0.5, glowFade: 1 });
      lightFlash(x, y + 1, z, 0x6ae04a, 25, 0.4, r * 5 + 4);
      break;
    }
    case 'blood': {
      emit(FX.blood, n(22), x, y, z, 0, 1, 0, s * 1.1);
      emit(FX.bloodMist, n(8), x, y, z, 0, 1, 0, s * 1.4);
      emit(FX.flashSmall, 1, x, y, z, 0, 1, 0, s * 1.3, 0xff3040);
      orb(x, y, z, { color: 0xd0203a, core: 0x400008, r0: 0.3, r1: r * 0.8, dur: 0.35, alpha: 0.8, rim: 1.8, hdr: 1.4, cover: 0.3 });
      if (low) decal(x, z, { cell: 3, size: r * 1.6 + 1, color: 0x4a0408, alpha: 0.8, life: 6 });
      lightFlash(x, y + 1, z, 0xd0203a, 25, 0.35, r * 5 + 4);
      break;
    }
    case 'poison': {
      emit(FX.poisonCloud, n(12), x, y, z, 0, 1, 0, s);
      emit(FX.bubble, n(10), x, gy + 0.2, z, 0, 1, 0, s);
      emit(FX.flashSmall, 1, x, y, z, 0, 1, 0, s * 1.2, 0xb0ff60);
      if (low) decal(x, z, { cell: 3, size: r * 2.2 + 1, color: 0x2a4a0a, alpha: 0.6, glow: 0.5, glowColor: 0x9ae03a, glowHdr: 1.5, life: 6, glowFade: 1 });
      lightFlash(x, y + 1, z, 0x9ae03a, 22, 0.5, r * 5 + 4);
      break;
    }
    case 'arcane': {
      emit(FX.flash, 1, x, y, z, 0, 1, 0, s * 1.2, 0xe0b0ff);
      emit(FX.rune, n(8), x, y, z, 0, 1, 0, s);
      emit(FX.sparkle, n(10), x, y, z, 0, 1, 0, 1, 0xd8a0ff);
      emit(FX.ringFlash, 1, x, y, z, 0, 1, 0, s, 0xc66dff);
      orb(x, y, z, { color: 0xc66dff, core: 0xffffff, r0: 0.2, r1: r * 0.9, dur: 0.4, alpha: 0.8, rim: 3, hdr: 2 });
      decal(x, z, { cell: 2, size: r * 2.4 + 1, color: 0x000000, alpha: 0, glow: 1.2, glowColor: 0xc66dff, glowHdr: 2.4, life: 0.9, grow: 0.12, spin: 2.5, glowFade: 1 });
      decal(x, z, { ring: { w: 0.08 }, size: r * 2.6, alpha: 0, glow: 1, glowColor: 0xc66dff, glowHdr: 2.5, life: 0.5 });
      lightFlash(x, y + 1, z, 0xc66dff, 40, 0.4, r * 5 + 5);
      break;
    }
    case 'spirit': {
      emit(FX.spectral, n(10), x, y, z, 0, 1, 0, s);
      emit(FX.mote, n(14), x, y, z, 0, 1, 0, s, 0x8afff0);
      emit(FX.flashSmall, 1, x, y, z, 0, 1, 0, s * 1.3, 0xb0fff4);
      orb(x, y, z, { color: 0x6af0e0, core: 0xffffff, r0: 0.3, r1: r, dur: 0.55, alpha: 0.6, rim: 2.6, hdr: 1.6, rise: 0.6 });
      lightFlash(x, y + 1, z, 0x6af0e0, 30, 0.5, r * 5 + 5);
      break;
    }
    case 'sound': {
      for (let i = 0; i < 3; i++) {
        decal(x, z, { ring: { w: 0.06 }, size: r * (2.2 + i * 0.7), alpha: 0.05, glow: 1, glowColor: 0xffb0e0, glowHdr: 2.2, life: 0.5 + i * 0.1 });
        wall(x, gy, z, r * (0.9 + i * 0.3), 0xffb0e0, 0.45 + i * 0.08, 0.8 + i * 0.3, 1.6);
      }
      emit(FX.note, n(8), x, y, z, 0, 1, 0, s);
      emit(FX.ringFlash, 2, x, y, z, 0, 1, 0, s * 0.9, 0xffc0e8);
      emit(FX.dust, n(5), x, gy + 0.1, z, 0, 1, 0, s * 0.8);
      lightFlash(x, y + 1, z, 0xffb0e0, 25, 0.35, r * 5 + 4);
      break;
    }
    default: {
      emit(FX.dust, n(10), x, gy + 0.1, z, 0, 1, 0, s);
      emit(FX.debris, n(10), x, y, z, 0, 1, 0, 1);
      emit(FX.sparkWide, n(8), x, y, z);
      emit(FX.flashSmall, 1, x, y, z, 0, 1, 0, s);
      if (low) decal(x, z, { cell: 0, size: r * 2 + 1, color: 0x2a2018, alpha: 0.6, life: 5, grow: 0.08 });
    }
  }
}

// ---------- casting ----------
// motes and a magic circle; called with the caster's hand position (castGlow) or the caster (castEffect)
const CAST_MOTE = { fire: 'ember', frost: 'snow', shadow: 'shadowWisp', holy: 'holyMote', nature: 'pollen', lightning: 'zap', blood: 'bloodMist', arcane: 'rune', physical: 'dustPuff', poison: 'bubble', spirit: 'spectral', sound: 'note' };
export function castGlow(el, x, y, z) {
  const c = elColor(el);
  emit(FX.flashSmall, 1, x, y, z, 0, 1, 0, 1.1, c);
  emit(FX.mote, 8, x, y, z, 0, 1, 0, 0.8, c);
  emit(FX[CAST_MOTE[el]] || FX.mote, 5, x, y, z, 0, 1, 0, 0.6, CAST_MOTE[el] ? -1 : c);
  lightFlash(x, y, z, c, 18, 0.3, 7);
}
export function magicCircle(x, z, r, el, life = 1.0) {
  const c = elColor(el);
  decal(x, z, { cell: 2, size: r * 2, color: 0x000000, alpha: 0.15, glow: 1.3, glowColor: c, glowHdr: 2.2, life, grow: 0.18, spin: el === 'arcane' ? 1.6 : 0.9, glowFade: 1, pulse: 9 });
  decal(x, z, { ring: { w: 0.12 }, size: r * 2.4, alpha: 0, glow: 0.8, glowColor: c, glowHdr: 2, life: 0.45 });
}
// the full cast: glow in the casting hand, a circle at the feet, element motes rising around the caster
const _hp = new THREE.Vector3();
export function castEffect(P, el) {
  const c = elColor(el);
  let hx = P.pos.x + Math.sin(P.yaw) * 0.6, hy = P.y + 1.4 * (P.h?.size || 1), hz = P.pos.z + Math.cos(P.yaw) * 0.6;
  const hand = P.h?.parts?.handR;
  if (hand && hand.parent && P.h.root.visible !== false) { hand.getWorldPosition(_hp); hx = _hp.x; hy = _hp.y; hz = _hp.z; }
  castGlow(el, hx, hy, hz);
  magicCircle(P.pos.x, P.pos.z, 1.3, el, 0.9);
  const m = FX[CAST_MOTE[el]] || FX.mote;
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; emit(m, 1, P.pos.x + Math.cos(a) * 1.1, P.y + 0.15, P.pos.z + Math.sin(a) * 1.1, 0, 1, 0, 0.7, CAST_MOTE[el] ? -1 : c); }
  emit(FX.mote, 10, P.pos.x, P.y + 0.3, P.pos.z, 0, 1, 0, 1, c);
}

// ---------- meteor ----------
const temp = []; // {mesh, t, dur, update}
function addTemp(mesh, dur, update) { G.scene.add(mesh); temp.push({ mesh, t: 0, dur, update }); }
let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.NoColorSpace;
  return glowTex;
}
const spriteMat = (hex, k, opacity = 1) => { const m = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(hex).multiplyScalar(k), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }); return m; };
// a burning rock falling from the sky onto (x, z) over `dur` seconds, then onLand()
export function meteor(x, z, dur, color, onLand) {
  const gy = heightAt(x, z);
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshStandardMaterial({ color: 0x2a1a12, emissive: color, emissiveIntensity: 1.4, roughness: 0.9, flatShading: true }));
  g.add(rock);
  const halo = new THREE.Sprite(spriteMat(color, 2.5, 0.9)); halo.scale.setScalar(5); g.add(halo);
  const core = new THREE.Sprite(spriteMat(0xffe0a0, 3, 1)); core.scale.setScalar(2.4); g.add(core);
  const sx = x + 14, sy = gy + 40, sz = z - 6;
  g.position.set(sx, sy, sz);
  let lx = sx, ly = sy, lz = sz;
  addTemp(g, dur, (o, k, dt) => {
    const nx = sx + (x - sx) * k, ny = sy + (gy - sy) * k * k, nz = sz + (z - sz) * k;
    o.position.set(nx, ny, nz);
    rock.rotation.x += dt * 6; rock.rotation.y += dt * 4;
    // a thick tail of fire and smoke along the path
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      const f = i / steps, px = lx + (nx - lx) * f, py = ly + (ny - ly) * f, pz = lz + (nz - lz) * f;
      emit(FX.fire, 1, px, py, pz, 0, 1, 0, 1.6);
      if (Math.random() < 0.6) emit(FX.smokeDark, 1, px, py, pz, 0, 1, 0, 1.4);
      if (Math.random() < 0.5) emit(FX.ember, 1, px, py, pz, 0, 1, 0, 1.2);
    }
    lx = nx; ly = ny; lz = nz;
    if (k >= 1 && !o.userData.landed) { o.userData.landed = true; onLand(); }
  });
  lightFlash(x, gy + 6, z, color, 30, dur, 30, 0.9);
}

// stationary totem/ward model; returns the group (caller removes it)
export function totemMesh(color) {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x5a3a22, flatShading: true });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2, 6), wood); pole.position.y = 1; g.add(pole);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.42), new THREE.MeshLambertMaterial({ color: [0x8a2a1a, 0x2a4a8a, 0x2a6a3a][i], flatShading: true })); b.position.y = 0.6 + i * 0.5; b.rotation.y = i; g.add(b); }
  const orbM = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2) })); orbM.position.y = 2.3; g.add(orbM); g.userData.orb = orbM;
  const halo = new THREE.Sprite(spriteMat(color, 1.8, 0.85)); halo.scale.setScalar(1.6); halo.position.y = 2.3; g.add(halo);
  return g;
}

// ---------- projectiles ----------
// projectileVisual(color, size, el) gives a pooled Object3D for a magic projectile: a white-hot core in a coloured
// halo, plus an element ornament (ice crystal, arcane rings, shadow heart...). Add it to the scene and move it as
// usual; while it is in the scene it trails its element's particles by itself, and when it is removed from the
// scene it goes back to the pool (do not dispose its geometry or materials).
const projPool = new Map(); // key -> [visual]
const projLive = [];
const TRAIL = {
  fire: [['fire', 0.9, 1], ['ember', 0.5, 1], ['smoke', 0.12, 0.8]], frost: [['frostMist', 0.25, 0.6], ['snow', 0.8, 1]],
  shadow: [['shadowSmoke', 0.45, 0.7], ['shadowWisp', 0.35, 0.7]], holy: [['holyMote', 0.7, 0.8], ['mote', 0.5, 0.8]],
  nature: [['pollen', 0.7, 0.9], ['leaf', 0.25, 0.7]], lightning: [['zap', 0.9, 0.7]], blood: [['bloodMist', 0.4, 0.6], ['blood', 0.3, 0.8]],
  arcane: [['rune', 0.25, 0.6], ['mote', 0.8, 0.8]], physical: [['dustPuff', 0.3, 0.5]], poison: [['poisonCloud', 0.3, 0.45], ['bubble', 0.4, 0.8]],
  spirit: [['spectral', 0.5, 0.5], ['mote', 0.5, 0.8]], sound: [['note', 0.25, 0.8], ['mote', 0.4, 0.6]],
};
const _ornGeo = {};
function ornament(el, c) {
  const basic = (hex, k = 1.6, op = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), transparent: op < 1, opacity: op, depthWrite: op >= 1 });
  switch (el) {
    case 'frost': { const m = new THREE.Mesh(_ornGeo.oct || (_ornGeo.oct = new THREE.OctahedronGeometry(1, 0)), basic(0xe8f8ff, 1.5)); m.scale.set(0.7, 1.3, 0.7); m.userData.spin = [3, 5, 0]; return m; }
    case 'arcane': case 'sound': {
      const g = new THREE.Group(); const tg = _ornGeo.torus || (_ornGeo.torus = new THREE.TorusGeometry(1.6, 0.08, 6, 32));
      for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(tg, basic(c, 2.2)); m.rotation.x = i ? 1.2 : -0.4; m.rotation.y = i * 1.4; g.add(m); }
      g.userData.spin = el === 'sound' ? [0, 0, 6] : [4, 6, 2]; g.userData.pulse = el === 'sound'; return g;
    }
    case 'shadow': { const m = new THREE.Mesh(_ornGeo.ico || (_ornGeo.ico = new THREE.IcosahedronGeometry(1, 0)), basic(0x0a0412, 1)); m.scale.setScalar(0.8); m.userData.spin = [2, 3, 1]; return m; }
    case 'nature': { const m = new THREE.Mesh(_ornGeo.ico || (_ornGeo.ico = new THREE.IcosahedronGeometry(1, 0)), basic(0x5ab02a, 1.2)); m.scale.set(0.7, 0.95, 0.7); m.userData.spin = [1, 4, 0]; return m; }
    case 'blood': { const m = new THREE.Mesh(_ornGeo.sph || (_ornGeo.sph = new THREE.SphereGeometry(1, 12, 8)), basic(0x6a0410, 1.1)); m.scale.set(0.75, 0.75, 1.1); return m; }
    case 'poison': { const m = new THREE.Mesh(_ornGeo.sph || (_ornGeo.sph = new THREE.SphereGeometry(1, 12, 8)), basic(0x6ab01a, 1.3, 0.85)); m.scale.setScalar(0.8); m.userData.wobble = true; return m; }
    case 'holy': { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), color: new THREE.Color(0xfff4c8).multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(3.4); s.userData.spinS = 3; return s; }
    default: return null;
  }
}
let starTex = null;
function starTexture() {
  if (starTex) return starTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.translate(32, 32);
  for (let r = 0; r < 4; r++) { g.rotate(Math.PI / 4); const gr = g.createLinearGradient(-32, 0, 32, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${r % 2 ? 0.5 : 1})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(-32, 0); g.quadraticCurveTo(0, -3, 32, 0); g.quadraticCurveTo(0, 3, -32, 0); g.fill(); }
  starTex = new THREE.CanvasTexture(c); starTex.colorSpace = THREE.NoColorSpace; return starTex;
}
const CORE_COL = { fire: 0xffe8b0, frost: 0xffffff, shadow: 0xd8b0ff, holy: 0xffffff, nature: 0xeaffc0, lightning: 0xffffff, blood: 0xff9090, arcane: 0xffffff, physical: 0xffffff, poison: 0xeaffb0, spirit: 0xeafffa, sound: 0xffffff };
export function projectileVisual(color, size = 0.25, el) {
  el = el || elFromColor(color);
  const key = el + ':' + color;
  let v = projPool.get(key)?.pop();
  if (!v) {
    v = new THREE.Group();
    const halo = new THREE.Sprite(spriteMat(color, el === 'shadow' ? 1.6 : 2.2, 0.95));
    const core = new THREE.Sprite(spriteMat(CORE_COL[el] ?? 0xffffff, el === 'shadow' ? 1.2 : 3.2, 1));
    v.add(halo); v.add(core);
    const orn = ornament(el, color); if (orn) v.add(orn);
    v.userData = { key, el, color, halo, core, orn, live: false, t: 0, lx: 0, ly: 0, lz: 0, acc: 0 };
  }
  const u = v.userData;
  const s = Math.max(0.12, size);
  u.halo.scale.setScalar(s * (el === 'shadow' ? 7 : 6.5));
  u.core.scale.setScalar(s * 2.6);
  if (u.orn) u.orn.scale.setScalar(s * (el === 'holy' ? 4 : el === 'arcane' || el === 'sound' ? 0.75 : 0.85));
  if (u.orn && el === 'frost') u.orn.scale.set(s * 0.6, s * 1.15, s * 0.6);
  u.size = s; u.live = true; u.t = 0; u.first = true; u.acc = 0; u.wait = 0;
  v.position.set(0, 0, 0); v.rotation.set(0, 0, 0);
  projLive.push(v);
  return v;
}
function updateProjectileVisuals(dt) {
  for (let i = projLive.length - 1; i >= 0; i--) {
    const v = projLive[i], u = v.userData;
    if (!v.parent) {
      if (u.first && (u.wait = (u.wait || 0) + 1) < 4) continue; // not added to the scene yet
      // removed from the scene: a small pop where it ended, then back to the pool
      if (!u.first) { emit(FX.flashSmall, 1, u.lx, u.ly, u.lz, 0, 1, 0, u.size * 3, u.color); emit(FX.mote, 4, u.lx, u.ly, u.lz, 0, 1, 0, 0.7, u.color); }
      u.live = false; u.wait = 0; projLive.splice(i, 1);
      const L = projPool.get(u.key) || []; if (L.length < 12) { L.push(v); projPool.set(u.key, L); }
      continue;
    }
    const p = v.position;
    if (u.first) { u.first = false; u.lx = p.x; u.ly = p.y; u.lz = p.z; }
    u.t += dt;
    // flicker and ornaments
    const fl = u.el === 'lightning' ? 0.7 + Math.random() * 0.6 : u.el === 'fire' ? 0.9 + Math.sin(u.t * 40) * 0.08 + Math.random() * 0.08 : 1 + Math.sin(u.t * 12) * 0.05;
    u.core.scale.setScalar(u.size * 2.6 * fl);
    if (u.orn) {
      const sp = u.orn.userData.spin; if (sp) { u.orn.rotation.x += sp[0] * dt; u.orn.rotation.y += sp[1] * dt; u.orn.rotation.z += sp[2] * dt; }
      if (u.orn.userData.spinS) u.orn.material.rotation += u.orn.userData.spinS * dt;
      if (u.orn.userData.pulse) u.orn.scale.setScalar(u.size * 0.75 * (0.8 + 0.4 * ((u.t * 3) % 1)));
      if (u.orn.userData.wobble) u.orn.scale.set(u.size * (0.8 + Math.sin(u.t * 17) * 0.1), u.size * (0.8 + Math.cos(u.t * 13) * 0.1), u.size * 0.8);
    }
    // particles along the path travelled this frame (dense for fast projectiles)
    const dx = p.x - u.lx, dy = p.y - u.ly, dz = p.z - u.lz, d = Math.hypot(dx, dy, dz);
    const tr = TRAIL[u.el] || TRAIL.physical;
    const steps = Math.min(6, Math.max(1, Math.round(d / 0.35)));
    for (let k = 0; k < steps; k++) {
      const f = (k + Math.random()) / steps, x = u.lx + dx * f, y = u.ly + dy * f, z = u.lz + dz * f;
      for (const [name, rate, sc] of tr) if (Math.random() < rate) emit(FX[name], 1, x, y, z, 0, 1, 0, sc * Math.min(1.6, u.size / 0.28), name === 'mote' ? u.color : -1);
    }
    if (u.el === 'lightning' && Math.random() < dt * 14) { const a = Math.random() * 6.283, b = Math.random() * 3 - 1.5; bolt({ x: p.x, y: p.y, z: p.z }, { x: p.x + Math.cos(a) * 0.9, y: p.y + b * 0.4, z: p.z + Math.sin(a) * 0.9 }, u.color, { width: 0.03, hdr: 2.5, dur: 0.08 }); }
    u.lx = p.x; u.ly = p.y; u.lz = p.z;
  }
}

export function updateSpellFx(dt) {
  updateLights(dt);
  updateMeshFx(dt);
  updateProjectileVisuals(dt);
  for (let i = temp.length - 1; i >= 0; i--) {
    const o = temp[i];
    o.t += dt;
    const k = Math.min(1, o.t / o.dur);
    o.update?.(o.mesh, k, dt);
    if (o.t >= o.dur) {
      G.scene.remove(o.mesh);
      o.mesh.traverse((m) => { if (m.isMesh || m.isSprite) { if (!m.isSprite) m.geometry.dispose(); m.material.dispose(); } });
      temp.splice(i, 1);
    }
  }
}

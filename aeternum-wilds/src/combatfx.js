// Combat feel hooks: called by the player and enemy code at key moments, implemented here with
// visual effects, sounds and camera feedback. Keep these signatures stable.
//  swingFx(P, atk)            the player starts a melee swing (atk.kind 'light'|'heavy', atk.wt weapon type, atk.pose)
//  swingPeakFx(P, atk)        the swing reaches its hit moment (whether or not it hit)
//  hitFx(e, dmg, crit, kind, src)  an enemy was damaged; kind 'light'|'heavy'|'ability'|'spell'; src {x,y,z} of the blow
//  blockFx(P, src)            the player blocked a hit
//  hurtFx(P, dmg, src)        the player took damage
//  dodgeFx(P)                 the player starts a dodge
//  killFx(e)                  an enemy died
//  castFx(P, el)              the player casts a spell of element el
// These hooks play their own sounds (whooshes, hits, blocks, dodges, kills, casts), so callers should not also
// play the old generic ones. tickCombatFx(dt, thirdPerson) runs once per frame from main.js (trails, camera kick).
import * as THREE from 'three';
import { G } from './state.js';
import { heightAt } from './world.js';
import { shake, later } from './fx.js';
import { sfx } from './audio.js';
import { emit } from './gfx/vfx/particles.js';
import { FX } from './gfx/vfx/presets.js';
import { decal, wall, orb } from './gfx/vfx/meshfx.js';
import { flash } from './gfx/vfx/lights.js';
import { updateTrail, trailStyle } from './gfx/vfx/trail.js';
import { castEffect, elFromColor, elColor } from './spellfx.js';
import { stats } from './stats.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const hitstop = (s) => { G.hitstop = Math.max(G.hitstop || 0, s); };

// ---------- camera kick (FOV punch) ----------
// a short zoom that snaps in and eases back; applied on top of whatever FOV the camera has
let fovTarget = 0, fovCur = 0, fovApplied = 0;
export function punchFov(deg) { if (Math.abs(deg) > Math.abs(fovTarget)) fovTarget = deg; }
function tickFov(dt) {
  const cam = G.camera; if (!cam) return;
  fovCur += (fovTarget - fovCur) * Math.min(1, dt * 28);
  fovTarget *= Math.exp(-dt * 9);
  if (Math.abs(fovTarget) < 0.01) fovTarget = 0;
  if (Math.abs(fovCur) < 0.01 && fovTarget === 0) fovCur = 0;
  if (fovCur !== fovApplied) { cam.fov = cam.fov - fovApplied + fovCur; fovApplied = fovCur; cam.updateProjectionMatrix(); }
}

// ---------- screen edge flash (hurt, crit) ----------
let veil = null, veilA = 0, veilCol = '';
function setVeil(color, a) {
  if (typeof document === 'undefined') return;
  if (!veil) {
    veil = document.createElement('div');
    veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;transition:none;mix-blend-mode:normal';
    document.body.appendChild(veil);
  }
  if (veilCol !== color) { veilCol = color; veil.style.background = `radial-gradient(ellipse at center, rgba(0,0,0,0) 52%, ${color} 100%)`; }
  veilA = Math.max(veilA, a);
}
function tickVeil(dt) {
  if (!veil) return;
  if (veilA > 0) { veilA = Math.max(0, veilA - dt * 2.2); veil.style.opacity = veilA.toFixed(3); }
  else if (veil.style.opacity !== '0') veil.style.opacity = '0';
}

// ---------- short-lived emitters that follow something (dodge dust, kill wisps) ----------
const tickers = [];
function ticker(dur, fn) { tickers.push({ t: 0, dur, acc: 0, fn }); }
function tickTickers(dt) {
  for (let i = tickers.length - 1; i >= 0; i--) {
    const k = tickers[i]; k.t += dt;
    if (k.t >= k.dur) { tickers.splice(i, 1); continue; }
    k.fn(k, dt);
  }
}

// per frame from main.js (real seconds); simulation effects use the game's time scale
export function tickCombatFx(dt, thirdPerson = true) {
  const sdt = G.paused ? 0 : G.hitstop > 0 ? dt * 0.08 : dt;
  updateTrail(dt, thirdPerson);
  tickFov(dt);
  tickVeil(dt);
  if (sdt > 0) tickTickers(sdt);
  hitsThisFrame = 0;
}

// ---------- helpers ----------
const _v = new THREE.Vector3();
function handPos(P, side = 'handR') {
  const h = P.h?.parts?.[side];
  if (h && h.parent) { h.getWorldPosition(_v); return _v; }
  return _v.set(P.pos.x + Math.sin(P.facing ?? P.yaw) * 0.5, P.y + 1.3, P.pos.z + Math.cos(P.facing ?? P.yaw) * 0.5);
}
function weaponTipPos(P) {
  const w = P.wR; if (!w) return handPos(P);
  w.updateMatrixWorld(true);
  return _v.set(0, 1.1, 0).applyMatrix4(w.matrixWorld);
}
// an elemental buff tints swings (fire blades, frost weapons ...)
const EL_MOTE = { fire: 'ember', frost: 'snow', holy: 'holyMote', nature: 'pollen', lightning: 'zap', shadow: 'shadowWisp', poison: 'bubble', arcane: 'mote', spirit: 'spectral', sound: 'note', blood: 'bloodMist' };
function buffElement(P) {
  if (P.whirl?.el && P.whirl.el !== 'physical') return P.whirl.el;
  for (let i = (P.buffs?.length || 0) - 1; i >= 0; i--) { const b = P.buffs[i]; if (b.color != null && (b.mods?.dmg || b.mods?.atkSpeed || b.mods?.lifesteal)) return elFromColor(b.color); }
  return null;
}
const WHOOSH = { sword: ['whoosh_light', 'whoosh_heavy'], greataxe: ['whoosh_axe', 'whoosh_axe'], hammer: ['whoosh_hammer', 'whoosh_hammer'], staff: ['whoosh_staff', 'whoosh_staff'], club: ['whoosh_hammer', 'whoosh_hammer'], spear: ['whoosh_light', 'whoosh_heavy'], rapier: ['whoosh_light', 'whoosh_light'], dagger: ['whoosh_light', 'whoosh_light'] };

// ---------- hooks ----------
export function swingFx(P, atk) {
  if (!P || !atk) return;
  const heavy = atk.kind === 'heavy', wt = atk.wt || 'sword';
  const el = buffElement(P);
  const tint = el ? elColor(el) : -1;
  const mote = el ? FX[EL_MOTE[el]] : heavy && wt !== 'staff' ? FX.ember : null;
  trailStyle(heavy ? 'heavy' : 'light', wt === 'staff' && tint < 0 ? 0xc0a0ff : tint, mote);
  const names = WHOOSH[wt] || WHOOSH.sword;
  sfx(heavy ? names[1] : names[0], heavy ? 0.95 : rnd(0.75, 0.9));
  if (heavy && atk.spec?.kind === 'spin') sfx('whoosh_axe', 0.6);
  if (el) sfx('cast_' + el, 0.25);
  if (heavy) {
    // weight shifts: a scuff of dust at the feet and a slight lean-in of the camera
    emit(FX.dustPuff, 5, P.pos.x, P.y + 0.1, P.pos.z, 0, 1, 0, 0.9);
    punchFov(-1.2);
  }
}

export function swingPeakFx(P, atk) {
  if (!P || !atk) return;
  const sp = atk.spec || {}, heavy = atk.kind === 'heavy';
  const f = P.facing ?? P.yaw, fx = Math.sin(f), fz = Math.cos(f);
  if (sp.kind === 'slam' && heavy) {
    // the hammer comes down: crack the ground, throw stones and dust, a shock band and a thump through the camera
    const d = sp.fwd ?? 1.6, cx = P.pos.x + fx * d, cz = P.pos.z + fz * d, gy = heightAt(cx, cz), r = sp.radius ?? 2.6;
    decal(cx, cz, { cell: 0, size: r * 2.4, color: 0x1a120c, alpha: 0.85, glow: 0.9, glowColor: 0xffa040, glowHdr: 1.8, life: 6, grow: 0.12, glowFade: 0.15 });
    decal(cx, cz, { ring: { w: 0.14 }, size: r * 2.6, color: 0x000000, alpha: 0.2, glow: 0.9, glowColor: 0xffe0a0, glowHdr: 1.8, life: 0.45 });
    wall(cx, gy, cz, r * 1.1, 0xffe0b0, 0.35, 1, 1.6);
    emit(FX.dust, 22, cx, gy + 0.15, cz, 0, 1, 0, 1.3);
    emit(FX.debris, 16, cx, gy + 0.2, cz, 0, 1, 0, 1.1);
    emit(FX.sparkWide, 10, cx, gy + 0.3, cz, 0, 1, 0, 1);
    emit(FX.flash, 1, cx, gy + 0.3, cz, 0, 1, 0, 1.4, 0xffe0b0);
    flash(cx, gy + 1, cz, 0xffd090, 30, 0.3, 10);
    sfx('slam', 1);
    shake(0.42); hitstop(0.06); punchFov(-3.5);
    return;
  }
  if (sp.kind === 'spin' && heavy) {
    // a full turn: a ring of cut air around the fighter
    wall(P.pos.x, P.y + 0.6, P.pos.z, (sp.range ?? 3.2) * 0.95, 0xfff0d8, 0.3, 0.9, 1.2);
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; emit(FX.windLine, 1, P.pos.x + Math.cos(a) * 1.4, P.y + 1.1, P.pos.z + Math.sin(a) * 1.4, -Math.sin(a), 0, Math.cos(a), 1); }
    emit(FX.dust, 14, P.pos.x, P.y + 0.12, P.pos.z, 0, 1, 0, 1.1);
    shake(0.12); punchFov(-1.5);
    return;
  }
  if (atk.wt === 'staff') return;
  // thrusts and slashes: air ripping off the edge in the swing direction
  const tip = weaponTipPos(P);
  if (heavy || atk.pose === 'thrust') {
    emit(FX.windLine, heavy ? 8 : 4, tip.x, tip.y, tip.z, fx, 0.05, fz, heavy ? 1.2 : 0.8);
    emit(FX.ringFlash, 1, tip.x, tip.y, tip.z, 0, 1, 0, heavy ? 0.6 : 0.4, 0xfff4e0);
  }
}

let hitsThisFrame = 0;
const FAMILY_SFX = { beast: 'hit_flesh', lost: 'hit_bone', corrupted: 'hit_corrupt' };
export function hitFx(e, dmg, crit, kind, src) {
  if (!e) return;
  hitsThisFrame++;
  const many = hitsThisFrame > 3; // area hits: keep the crowd's effects lighter
  const fam = e.def?.family || 'beast';
  const size = e.size || 1, beastBody = !!e.model?.beast;
  const cy = e.y + (beastBody ? 0.75 : 1.2) * size;
  const P = G.player;
  const sx = src?.x ?? P?.pos.x ?? e.pos.x, sz = src?.z ?? P?.pos.z ?? e.pos.z;
  let dx = e.pos.x - sx, dz = e.pos.z - sz; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const rr = (e.radius || 0.6) * 0.55;
  const hx = e.pos.x - dx * rr, hz = e.pos.z - dz * rr, hy = src?.y != null && kind !== 'spell' ? Math.min(cy + 0.4 * size, Math.max(e.y + 0.4, src.y)) : cy;
  const spell = kind === 'spell';
  const heavy = kind === 'heavy';
  const w = (spell ? 0.45 : heavy ? 1.15 : kind === 'ability' ? 0.95 : 0.7) * (crit ? 1.35 : 1) * (many ? 0.5 : 1);
  const n = (k) => Math.max(1, Math.round(k * w));
  // spray away from the attacker, a little upward
  const ux = dx, uy = 0.35, uz = dz;
  switch (fam) {
    case 'beast':
      emit(FX.blood, n(14), hx, hy, hz, ux, uy + 0.2, uz, 1);
      emit(FX.bloodMist, n(4), hx, hy, hz, ux, uy, uz, 1);
      if (!spell) emit(FX.spark, n(5), hx, hy, hz, ux, uy, uz, 0.7, 0xfff0d0);
      if ((heavy || crit) && !many) decal(e.pos.x + dx * 0.8, e.pos.z + dz * 0.8, { cell: 3, size: 0.9 + Math.random() * 0.6 + (crit ? 0.4 : 0), color: 0x4a0406, alpha: 0.75, life: 9 });
      break;
    case 'lost':
      emit(FX.bone, n(10), hx, hy, hz, ux, uy + 0.2, uz, 1);
      emit(FX.spectral, n(4), hx, hy, hz, ux, uy, uz, 0.8);
      emit(FX.mist, n(3), hx, hy, hz, ux, 0.2, uz, 0.8);
      if (!spell) emit(FX.spark, n(4), hx, hy, hz, ux, uy, uz, 0.6, 0xe8fff8);
      break;
    case 'corrupted':
      emit(FX.corrupt, n(7), hx, hy, hz, ux, uy, uz, 1);
      emit(FX.corruptGlow, n(5), hx, hy, hz, ux, uy, uz, 1);
      emit(FX.corruptSpark, n(9), hx, hy, hz, ux, uy + 0.1, uz, 1);
      if (heavy || crit) emit(FX.blood, n(5), hx, hy, hz, ux, uy, uz, 0.8, 0x2a0404);
      break;
    default:
      emit(FX.spark, n(10), hx, hy, hz, ux, uy, uz, 1);
      emit(FX.dustPuff, n(3), hx, hy, hz, ux, uy, uz, 0.8);
  }
  // the moment of contact: a hot flash, bigger for heavy blows
  if (!spell || crit) emit(heavy || crit ? FX.flash : FX.flashSmall, 1, hx, hy, hz, 0, 1, 0, heavy ? 0.9 : 0.75, fam === 'corrupted' ? 0xffb0a0 : fam === 'lost' ? 0xd8fff4 : 0xfff2dc);
  if (heavy && !many) emit(FX.streak, 6, hx, hy, hz, ux, 0.15, uz, 1, 0xfff4e0);
  if (crit) {
    emit(FX.star, 1, hx, hy + 0.1, hz, 0, 1, 0, 0.9 + size * 0.2, 0xfff0c0);
    emit(FX.ringFlash, 1, hx, hy, hz, 0, 1, 0, 0.7, 0xffe0a0);
    emit(FX.sparkWide, 12, hx, hy, hz, 0, 1, 0, 1, 0xffe8a0);
    flash(hx, hy, hz, 0xffe0b0, 26, 0.18, 8, 0.02);
  } else if (heavy && !many) flash(hx, hy, hz, 0xfff0d0, 14, 0.15, 6, 0.02);
  // sound: family material, crit ring on top
  if (!many || Math.random() < 0.4) sfx(FAMILY_SFX[fam] || 'hit_metal', spell ? 0.45 : heavy ? 1 : 0.85);
  if (crit) sfx('crit_ring', 0.8);
  // feel: hit-stop, shake and a camera kick scaled to the blow
  if (!spell) {
    hitstop((heavy ? 0.085 : kind === 'ability' ? 0.06 : 0.045) + (crit ? 0.04 : 0) + (e.def?.boss ? 0.015 : 0));
    shake((heavy ? 0.22 : kind === 'ability' ? 0.16 : 0.09) + (crit ? 0.12 : 0));
    if (heavy || crit) punchFov(heavy && crit ? -4.5 : heavy ? -3 : -2);
  } else if (crit) { hitstop(0.03); shake(0.1); }
}

export function blockFx(P, src) {
  if (!P) return;
  const f = P.facing ?? P.yaw;
  let sx = Math.sin(f), sz = Math.cos(f);
  const hasShield = !!P.wL && P.atk?.wt !== 'bow';
  // sparks fly at the attacker from the shield (or the weapon held across the body)
  const x = P.pos.x + sx * 0.75, y = P.y + 1.25, z = P.pos.z + sz * 0.75;
  if (src) { const dx = src.x - P.pos.x, dz = src.z - P.pos.z, l = Math.hypot(dx, dz) || 1; sx = dx / l; sz = dz / l; }
  emit(FX.spark, 18, x, y, z, sx, 0.4, sz, 1.1, 0xfff0c0);
  emit(FX.sparkWide, 6, x, y, z, 0, 1, 0, 0.8);
  emit(FX.flash, 1, x, y, z, 0, 1, 0, 0.8, 0xfff0d0);
  emit(FX.ringFlash, 1, x, y, z, 0, 1, 0, 0.5, 0xffe8b0);
  emit(FX.dustPuff, 4, P.pos.x - sx * 0.3, P.y + 0.1, P.pos.z - sz * 0.3, -sx, 0.2, -sz, 0.9); // feet skid back
  flash(x, y, z, 0xffd8a0, 22, 0.16, 7, 0.02);
  sfx('block', 1); sfx(hasShield ? 'shield_thud' : 'sparks', 0.7);
  hitstop(0.05); shake(0.14); punchFov(-1.5);
}

export function hurtFx(P, dmg, src) {
  if (!P) return;
  let maxHp = 300; try { maxHp = stats().maxHp || 300; } catch (e) { /* no profile */ }
  const frac = Math.min(1, (dmg || 0) / Math.max(1, maxHp));
  const x = P.pos.x, y = P.y + 1.2, z = P.pos.z;
  let dx = 0, dz = 0;
  if (src) { dx = x - src.x; dz = z - src.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; }
  emit(FX.blood, Math.round(5 + frac * 20), x - dx * 0.2, y, z - dz * 0.2, dx, 0.5, dz, 0.9);
  emit(FX.bloodMist, 3, x, y, z, dx, 0.3, dz, 0.8);
  emit(FX.flashSmall, 1, x, y, z, 0, 1, 0, 0.6, 0xff6040);
  setVeil('rgba(170,10,10,0.85)', Math.min(0.9, 0.3 + frac * 3));
  sfx('hurt', 0.75 + frac);
  if (frac > 0.12) sfx('hit_flesh', 0.6);
  shake(Math.min(0.6, 0.15 + frac * 2)); punchFov(frac > 0.15 ? 2.5 : 1.2);
  hitstop(frac > 0.15 ? 0.05 : 0.02);
}

export function dodgeFx(P) {
  if (!P) return;
  const d = P.dodge || {}, dx = d.dx ?? -Math.sin(P.yaw), dz = d.dz ?? -Math.cos(P.yaw);
  // a kick of dirt where you push off, then dust and wind streaks along the roll
  emit(FX.dust, 8, P.pos.x - dx * 0.3, P.y + 0.12, P.pos.z - dz * 0.3, -dx, 0.3, -dz, 0.9);
  emit(FX.debris, 4, P.pos.x - dx * 0.2, P.y + 0.15, P.pos.z - dz * 0.2, -dx, 0.8, -dz, 0.6);
  sfx('dodge', 0.9); if (d.roll) sfx('dodge_roll', 0.7);
  punchFov(1.6);
  const dur = d.dur || 0.4;
  ticker(dur, (k, dt) => {
    k.acc += dt;
    while (k.acc > 0.045) {
      k.acc -= 0.045;
      emit(FX.dustPuff, 2, P.pos.x, P.y + 0.08, P.pos.z, -dx, 0.4, -dz, 0.8);
      emit(FX.windLine, 1, P.pos.x + rnd(-0.3, 0.3), P.y + rnd(0.5, 1.5), P.pos.z + rnd(-0.3, 0.3), -dx, 0, -dz, 0.7);
    }
  });
}

export function killFx(e) {
  if (!e) return;
  const fam = e.def?.family || 'beast', size = e.size || 1, boss = !!e.def?.boss;
  const x = e.pos.x, z = e.pos.z, gy = heightAt(x, z), cy = e.y + (e.model?.beast ? 0.7 : 1.1) * size;
  const k = size * (boss ? 1.6 : 1);
  switch (fam) {
    case 'corrupted': {
      // the corruption bursts out of the body, then its trapped souls spiral free
      emit(FX.corrupt, Math.round(16 * k), x, cy, z, 0, 1, 0, k);
      emit(FX.corruptGlow, Math.round(10 * k), x, cy, z, 0, 1, 0, k);
      emit(FX.corruptSpark, Math.round(16 * k), x, cy, z, 0, 1, 0, k);
      orb(x, cy, z, { color: 0xff2a1a, core: 0x200404, r0: 0.4 * k, r1: 1.8 * k, dur: 0.45, alpha: 0.8, rim: 1.6, hdr: 1.8, cover: 0.4 });
      decal(x, z, { cell: 1, size: 2.4 * k, color: 0x120404, alpha: 0.75, glow: 1, glowColor: 0xff3a1a, glowHdr: 2, life: 8, glowFade: 0.4 });
      flash(x, cy, z, 0xff3a1a, 40, 0.5, 10);
      sfx('kill_corrupt', boss ? 1.2 : 0.9);
      const souls = boss ? 9 : 3 + Math.round(size);
      later(0.3, () => {
        sfx('soul', 0.7);
        for (let i = 0; i < souls; i++) {
          const a0 = i / souls * 6.283, rad = 0.4 + Math.random() * 0.4 * size, spd = 2.2 + Math.random() * 1.4, tw = 3 + Math.random() * 2;
          ticker(1.4 + Math.random() * 0.5, (t) => { const a = a0 + t.t * tw, h = t.t * spd; const sx = x + Math.cos(a) * rad * (1 + t.t), sz2 = z + Math.sin(a) * rad * (1 + t.t); emit(FX.soul, 1, sx, cy + h, sz2, 0, 1, 0, 0.55, 0xffb0a0); if (Math.random() < 0.4) emit(FX.mote, 1, sx, cy + h, sz2, 0, 1, 0, 0.6, 0xff6040); });
        }
      });
      break;
    }
    case 'lost': {
      // the drowned dead come apart: a gust of sea-ghost mist, bones clattering, a spirit rising
      emit(FX.mist, Math.round(12 * k), x, cy, z, 0, 1, 0, k);
      emit(FX.spectral, Math.round(10 * k), x, cy, z, 0, 1, 0, k);
      emit(FX.bone, Math.round(14 * k), x, cy, z, 0, 1, 0, k);
      emit(FX.flash, 1, x, cy, z, 0, 1, 0, k, 0xc8fff0);
      orb(x, cy, z, { color: 0x8af0dc, core: 0xffffff, r0: 0.3, r1: 1.4 * k, dur: 0.6, alpha: 0.6, rim: 2.4, hdr: 1.4, rise: 0.8 });
      flash(x, cy, z, 0x8af0dc, 30, 0.6, 10);
      sfx('kill_lost', boss ? 1.2 : 0.9);
      ticker(1.3, (t) => { if (Math.random() < 0.7) emit(FX.spectral, 1, x + rnd(-0.3, 0.3), cy + t.t * 2.4, z + rnd(-0.3, 0.3), 0, 1, 0, 0.6 * size); });
      later(0.45, () => { emit(FX.dust, Math.round(8 * k), x, gy + 0.1, z, 0, 1, 0, k); sfx('land', 0.5); });
      break;
    }
    default: {
      // beasts: a last spray and a heavy fall in a puff of dust
      emit(FX.blood, Math.round(14 * k), x, cy, z, 0, 1, 0, k);
      emit(FX.bloodMist, Math.round(5 * k), x, cy, z, 0, 1, 0, k);
      sfx('kill_beast', boss ? 1.2 : 0.9);
      later(0.38, () => {
        emit(FX.dust, Math.round(14 * k), x, gy + 0.12, z, 0, 1, 0, k);
        emit(FX.debris, Math.round(5 * k), x, gy + 0.15, z, 0, 1, 0, 0.7);
        decal(x, z, { cell: 3, size: 1.6 * k, color: 0x3a0406, alpha: 0.7, life: 14 });
        sfx('land', 0.7);
        shake(0.06 * k);
      });
    }
  }
  if (boss) {
    wall(x, gy, z, 9, 0xffe0b0, 0.7, 2.2, 2.2);
    decal(x, z, { ring: { w: 0.08 }, size: 20, color: 0x000000, alpha: 0.2, glow: 1, glowColor: 0xffe0b0, glowHdr: 2.2, life: 0.8 });
    emit(FX.flash, 1, x, cy, z, 0, 1, 0, 4, 0xfff0d0);
    emit(FX.dust, 30, x, gy + 0.2, z, 0, 1, 0, 2);
    flash(x, cy + 1, z, 0xfff0d0, 80, 1, 30);
    hitstop(0.22); shake(0.6); punchFov(-6);
    sfx('explosion', 0.6);
  } else { hitstop(0.05); punchFov(-1.5); }
}

export function castFx(P, el) {
  if (!P) return;
  el = el || 'arcane';
  castEffect(P, el);
  sfx('cast_' + el, 0.9);
}

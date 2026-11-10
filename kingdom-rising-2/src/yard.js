// The Training Yard: a plain field with practice dummies, every class at the top level and every weapon.
// Y opens the yard panel: pick a class, pick a weapon, reset cooldowns, unlimited mana and endurance.
import { heroHeight, fixNormals } from './heromodels.js';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { addCircle } from './world.js';
import { G } from './state.js';
import { Mob } from './mobs.js';
import { CLASSES, WEAPON_TYPES, ABILITIES, LEVEL_CAP } from './data.js';
import { heightAt } from './terrain.js';
import * as Game from './game.js';
import * as Icons from './icons.js';
import { S } from './audio.js';
import { PVP_K } from './mp.js';
import { arenaHero, perksFor, recomputePK, kitOf, rmbOf, ultOf, roleOf, summonDemon, mendBanner, paladinWrath, monkFists, rogueAssassinate, berserkerStorm, rangerRain, druidOvergrowth, shamanSpirit, healerMend, shamanTotem, clericMiracle, wizardTranscend, musketBarrage, aimAlly, runTableUlt, ULTS, playerRules, SparBot, burnFx } from './arena.js';
import { classPortrait, RACE } from './portraits.js';
import { bodyPoseTick } from './abilityfx.js';
import { playUlt, ULT_ORDER } from './yardults.js';
import { openKitInfo, abilityCards } from './arena.js';
import { buildHumanoid, equipWeapon, animateHumanoid, bake } from './character.js';
import { arenaSpec, arenaBody, arenaDecor, arenaWeaponDecor, addOutline, notesTick, arenaLookTick } from './arenalooks.js';

export const YD = { infinite: false, dmg: [], startGame: null }; window.KR2Y = YD; /* (for tests) */
const dummies = [];
// six dummies standing evenly in a ring on open ground in front of the start: hit one from outside, or step into the middle for area attacks
const RING = { x: 0, z: 47, r: 8 }; /* (between the two weapon racks; the class line-up is behind the start, at z = -8) */
const SPOTS = [0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * Math.PI * 2; return [RING.x + Math.sin(a) * RING.r, RING.z + Math.cos(a) * RING.r, 'Training Dummy']; });
// every class standing shoulder to shoulder behind the start: walk up to one and press E to become that class
const LINE = []; YD.line = LINE;
function nameTag(text) { const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d'); g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(text, 256, 42); g.fillStyle = '#f2dfb0'; g.fillText(text, 256, 42); /* (wide enough for the longest name, Goblin Bombardier) */
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true })); sp.scale.set(3.2, 0.4, 1); return sp; }
let lineStarted = false;
function spawnLineUp() {
  if (lineStarted || !/[?&]line\b/.test(location.search)) return; /* (the owner: no class line-up in the yard any more, K picks the class; ?line brings it back for testing) */ lineStarted = true; /* (?noline: tests skip the 20 figures) */ /* (the 20 figures load one by one after you arrive, so the yard opens fast) */
  const keys = Object.keys(CLASSES), z = -8; /* (spaced by each class's size so no two figures touch, giants included) */
  const wid = (c) => heroHeight(c) * 0.42 + 0.9, xs = []; let run = 0; keys.forEach((c, i) => { if (i) run += (wid(keys[i - 1]) + wid(c)) / 2; xs.push(run); }); const mid = run / 2;
  const one = (cls, i) => { const x = xs[i] - mid;
    try { const ch = buildHumanoid({ race: RACE[cls] || 'human', sex: 'm', cls, outfit: cls, spec: arenaSpec(cls), body: arenaBody(cls), skin: cls === 'musketeer' ? '#7a9a3a' : cls === 'blunderbuss' ? '#4f6a2a' : cls === 'bombardier' ? '#8aa23a' : '#d8a888', hair: '#3a2a1a' }); arenaDecor(ch, cls);
      try { equipWeapon(ch, cls === 'warrior' ? 'swordshield' : CLASSES[cls].weapons[0], 3, 0); arenaWeaponDecor(ch, cls); } catch (e) { /* no weapon model */ }
      ch.root.position.set(x, heightAt(x, z), z); ch.root.rotation.y = 0; G.scene.add(ch.root);
      const tag = nameTag(CLASSES[cls].name); tag.position.set(x, heightAt(x, z) + heroHeight(cls) + 0.35, z); G.scene.add(tag);
      LINE.push({ cls, ch, x, z, t: Math.random() * 3 }); return ch; } catch (e) { console.warn('line-up', cls, e); return null; } };
  // your own hero loads first (model, arms and weapons): only then do the figures follow, one at a time, each after the last has arrived
  let i = 0, wait = 0; const ready = (ch) => !ch || (ch.heroModel && ch.heroModel !== 'loading'); const kitsIn = (ch) => { const W = ch && ch.weapons || {}; for (const k of ['main', 'off']) { const w = W[k]; if (!w) continue; let g = !!w.userData.glb; if (!g) w.traverse(c => { if (c.userData && c.userData.glb) g = true; }); if (!g) return false; } return true; }; /* (your own sword and shield have arrived) */
  const step = () => { const P = G.player; if (i === 0 && P && (!ready(P.ch) || !kitsIn(P.ch)) && wait < 40) { wait += 0.5; return setTimeout(step, 500); } if (i >= keys.length) return; const ch = one(keys[i], i); i++; let t = 0; const next = () => { t += 0.25; if (ready(ch) || t > 8) setTimeout(step, 150); else setTimeout(next, 250); }; next(); };
  setTimeout(step, 1500);
}
// the class figure you are standing at, if any
export function lineUpNear() { const P = G.player; if (!P) return null; let best = null, bd = 2.4 * 2.4; for (const f of LINE) { const d = (P.pos.x - f.x) ** 2 + (P.pos.z - f.z) ** 2; if (d < bd) { bd = d; best = f; } } return best; }
export function lineUpSwitch() { const f = lineUpNear(); if (!f || !YD.startGame) return false; const P = G.player, pos = P.pos.clone(), yaw = P.yaw; YD.startGame(yardHero(f.cls, G.save)); G.player.place(pos.x, pos.z, yaw); S.levelUp && S.levelUp(); return true; }
export function spawnDummies() {
  if (!LINE.length) spawnLineUp();
  G.hooks.mendBanner = mendBanner; G.hooks.arenaDemon = summonDemon; G.hooks.arenaWrath = paladinWrath; G.hooks.arenaFists = monkFists; G.hooks.arenaAssassinate = rogueAssassinate; G.hooks.arenaStorm = berserkerStorm; G.hooks.arenaRain = rangerRain; G.hooks.arenaOvergrowth = druidOvergrowth; G.hooks.arenaSpirit = shamanSpirit; G.hooks.healerMend = healerMend; G.hooks.shamanTotem = shamanTotem; G.hooks.arenaMiracle = clericMiracle; G.hooks.arenaTranscend = wizardTranscend; G.hooks.arenaBarrage = musketBarrage; G.hooks.aimAlly = aimAlly; G.hooks.tableUlt = runTableUlt; // (the finished ultimates work here too)
  for (const [x, z, name] of SPOTS) {
    const m = new Mob('bandit', 10, x, z); m.dummy = true; m.hostile = false; m.def = Object.assign({}, m.def, { aggro: 0, flee: false, gold: null, loot: {}, gearChance: 0 });
    Object.defineProperty(m, 'name', { value: name, configurable: true }); m.maxHp = m.hp = 1e7; m.lv = LEVEL_CAP; m.yaw = Math.atan2(x - RING.x, z - RING.z); /* (each one faces out of the ring) */ m.home.set(x, heightAt(x, z), z);
    m.walk = null; /* (no walking dummy any more; dummyUpdate still supports one) */ m.update = dummyUpdate; m.loot = null;
    const take = m.takeHit.bind(m); m.takeHit = (dmg, src, o) => { const d = take(dmg, src, o); YD.dmg.push([performance.now(), Math.max(0, d || dmg)]); m.lastHit = G.time; if (m.hp < m.maxHp * 0.5) m.hp = m.maxHp; m.dead = false; return d; };
    G.mobs.push(m); dummies.push(m);
  }
  plantProps();
  setTimeout(spawnSparrer, 2500); /* (after your own hero has loaded) */
}
// a sparring warrior beside the ring: takes real hits, gets knocked down, dies and gets up again, but never moves or fights back
function spawnSparrer() { if (YD.spar) return; try { const x = RING.x + RING.r + 6, z = RING.z; const b = new SparBot(x, z, -Math.PI / 2); YD.spar = b;
    const take = b.takeHit.bind(b); b.takeHit = (dmg, src, o) => { const d = take(dmg, src, o); if (d > 0) YD.dmg.push([performance.now(), d / PVP_K]); return d; }; } catch (e) { console.warn('sparring warrior', e); } }
// trees and rocks around the yard: the owner's Meshy models, fetched once in the background and drawn as one instanced mesh per part
// (a few draw calls for all of them, nothing done per frame; if a model fails to load the yard simply has none)
const PROPS = {
  tree: { url: 'models/props/yard_tree.fbx', at: [[-25, 50, 9, 0.4], [27, 57, 8, 2.1], [-33, 17, 7, 4.0], [35, 21, 7.5, 1.2], [7, 66, 10, 5.3]] }, /* [x, z, height m, turn] */
  rock: { url: 'models/props/yard_rock.fbx', at: [[-16, 35, 1.4, 0.3], [19, 52, 1.2, 1.7], [-24, 61, 1.0, 2.6], [27, 32, 1.3, 4.4], [-37, 29, 0.9, 0.9], [-9, 64, 1.6, 3.3]] },
};
let propsOn = false;
function plantProps() {
  if (propsOn) return; propsOn = true;
  setTimeout(() => { const L = new FBXLoader(); /* (a moment after the yard opens, so the heroes load first) */
    for (const kind in PROPS) { const P = PROPS[kind];
      L.load(P.url, (base) => { try { placeProp(kind, base, P.at); } catch (e) { console.warn('yard prop', kind, e); } }, undefined, (e) => console.warn('yard prop failed to load', kind, e)); } }, 1500);
}
function placeProp(kind, base, at) {
  base.updateMatrixWorld(true); const parts = [], box = new THREE.Box3();
  base.traverse(o => { if (!o.isMesh || !o.geometry) return; const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); fixNormals(geo); geo.computeBoundingBox(); box.union(geo.boundingBox);
    const mats = (Array.isArray(o.material) ? o.material : [o.material]).map(m => { if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.anisotropy = 4; m.map.needsUpdate = true; } if (m.color) m.color.setScalar(kind === 'rock' ? 1.6 : 1); /* (the rock's texture is dark: lifted so it reads as grey stone, not a black lump) */ if ('shininess' in m) m.shininess = 4; if (m.specular) m.specular.setScalar(0.05); return m; });
    parts.push([geo, mats.length === 1 ? mats[0] : mats]); });
  if (!parts.length) return;
  const H = Math.max(0.01, box.max.y - box.min.y), cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2; // (stand the model on its base, centred, one metre tall)
  const norm = new THREE.Matrix4().makeScale(1 / H, 1 / H, 1 / H).multiply(new THREE.Matrix4().makeTranslation(-cx, -box.min.y, -cz));
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(), p = new THREE.Vector3();
  const halfW = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2 / H;
  for (const [geo, mat] of parts) { geo.applyMatrix4(norm); geo.computeBoundingBox(); geo.computeBoundingSphere();
    const im = new THREE.InstancedMesh(geo, mat, at.length);
    at.forEach(([x, z, h, turn], i) => { const y = heightAt(x, z) - (kind === 'rock' ? h * 0.12 : 0.15); /* (sunk a little so no edge floats) */ q.setFromAxisAngle(up, turn); s.set(h * (kind === 'rock' ? 1.15 : 1), h, h * (kind === 'rock' ? 1.15 : 1)); p.set(x, y, z); im.setMatrixAt(i, M.compose(p, q, s)); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere && im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = kind === 'rock'; im.matrixAutoUpdate = false; im.updateMatrix(); im.name = 'yard_' + kind;
    G.scene.add(im); }
  for (const [x, z, h] of at) addCircle(x, z, kind === 'tree' ? Math.max(0.5, h * 0.06) : h * halfW * 0.8, 'yardprop'); // (you walk round the trunks and rocks, not through them)
  if (kind === 'tree') { G.camOcc = G.camOcc || []; for (const [x, z, h] of at) G.camOcc.push({ x, y: heightAt(x, z) + h * 0.68, z, r: h * Math.max(0.3, halfW * 0.9) + 0.9, sy: 0.75, tag: 'yardtree' }); } // (the crowns: ultimate cameras keep out of them and never look through them)
}
function dummyUpdate(dt) {
  const m = this; m.dead = false; if (m.held) return; // (in the demon's grip)
  if (m.walk) { m.walk.a += dt * 0.35; m.pos.x = 24 + Math.sin(m.walk.a) * 12; m.yaw = Math.cos(m.walk.a) > 0 ? Math.PI / 2 : -Math.PI / 2; }
  for (const k in m.status) if (typeof m.status[k] === 'number' && m.status[k] > 0 && k !== 'knock') m.status[k] = Math.max(0, m.status[k] - dt);
  if (m.status.knock && m.status.knock.lengthSq && m.status.knock.lengthSq() > 0) { m.status.knock.set(0, 0, 0); m.pos.x = m.walk ? m.pos.x : m.home.x; m.pos.z = m.home.z; }
  if (m.status.burn > 0 && m.status.burnDps > 0) { const d = m._burn = m._burn || { acc: 0 }; d.dps = m.status.burnDps * PVP_K; const a0 = d.acc; burnFx(m, d, dt); if (d.acc < a0) YD.dmg.push([performance.now(), m.status.burnDps * 0.5]); } /* (burning: flames up the dummy, the burn's ticks on the DPS meter) */
  if (G.time - (m.lastHit || -99) > 3) m.hp = m.maxHp;
  m.pos.y = heightAt(m.pos.x, m.pos.z); m.root.position.copy(m.pos); m.root.rotation.y = m.yaw;
  m.animate(dt, { speed: m.walk ? 1.5 : 0, action: null, actionT: 0 });
}
// damage per second over the last 8 seconds, and cheats while training
export function updateYard(dt) {
  if (!YD.faced && G.player) { YD.faced = true; const P = G.player; P.yaw = P.bodyYaw = Math.atan2(RING.x - P.pos.x, RING.z - P.pos.z); } // (you start looking at the ring of dummies)
  playerRules(G.player); // (the arena's control rules: roots, silence, mesmerize, the shield's defensive)
  { const P = G.player; YD.lineN = (YD.lineN || 0) + 1; for (const f of LINE) { // (the line-up stands still: posed once, then left alone; the 3D models only get a light update now and then, when you are near)
      if (!f.posed) { for (let i = 0; i < 20; i++) animateHumanoid(f.ch, 0.05, { speed: 0, armed: true, ready: true }); f.posed = true; if (!f.ch.heroModel) { try { bake(f.ch.root); } catch (e) { /* keep it unbaked */ } } addOutline(f.ch.root, '#1a1208'); f.ch.root.updateMatrixWorld(true); f.ch.root.traverse(o => { o.matrixAutoUpdate = false; }); } // (a standing figure is merged into a few meshes: far less to draw)
      const H = f.ch.heroModel; if (H && H !== 'loading' && P && (YD.lineN + f.x * 7 | 0) % 6 === 0 && Math.hypot(P.pos.x - f.x, P.pos.z - f.z) < 14) { f.ch.root.traverse(o => { o.matrixAutoUpdate = true; }); arenaLookTick(f.ch, dt * 6); f.ch.root.updateMatrixWorld(true); f.ch.root.traverse(o => { o.matrixAutoUpdate = false; }); } } }
  { const f = lineUpNear(), cur = G.save && G.save.cls; const key = f && f.cls !== cur ? f.cls : null; if (key !== YD.lineHint) { YD.lineHint = key; const el2 = document.getElementById('linehint') || (() => { const d = document.createElement('div'); d.id = 'linehint'; d.style.cssText = 'position:fixed;left:50%;bottom:24%;transform:translateX(-50%);padding:8px 16px;border-radius:8px;background:rgba(15,10,6,0.82);border:1px solid #8a6a3a;color:#f2dfb0;font:600 17px Georgia,serif;pointer-events:none;z-index:30'; document.body.appendChild(d); return d; })(); el2.hidden = !key; if (key) el2.innerHTML = `Press <b style="color:#ffd27a">E</b> to become the <b>${CLASSES[key].name}</b>`; } }
  notesTick(dt); // (music notes: the bard's songs)
  G.zoneLabel = 'Training Yard<small>The arena classes</small>'; const tr = document.getElementById('tracker'); if (tr && !tr.hidden) tr.hidden = true;
  const now = performance.now(); while (YD.dmg.length && now - YD.dmg[0][0] > 8000) YD.dmg.shift();
  const tot = YD.dmg.reduce((a, b) => a + b[1], 0), span = YD.dmg.length ? Math.max(1, (now - YD.dmg[0][0]) / 1000) : 1;
  let e = document.getElementById('yardhud'); if (!e) { e = document.createElement('div'); e.id = 'yardhud'; document.getElementById('hud').appendChild(e); }
  const h = G.save, html = `<b>Training Yard</b><span>${CLASSES[h.cls].name} · level ${h.level}</span><span class="dps">DPS <b>${YD.dmg.length ? Math.round(tot / span) : 0}</b></span><small><kbd>K</kbd> change class · <kbd>U</kbd> get hit by an ultimate · <kbd>R</kbd> ultimate</small>`;
  if (e._h !== html) { e.innerHTML = html; e._h = html; }
  if (G.save.arenaUlt) G.save.ultCharge = Math.min(100, (G.save.ultCharge || 0) + dt * 25); // (the yard: the ultimate is back in 4 seconds)
  const P = G.player; if (P && YD.infinite) { P.mana = P.maxMana; P.end = P.maxEnd; }
}
export function resetCooldowns() { const P = G.player; if (P) for (const k in P.cd) P.cd[k] = 0; }

// the hero for a class: exactly the arena's version of it (its look, its five keys, its ultimate on R, its perks)
export function yardHero(cls, keep) {
  const h = arenaHero({ cls, race: keep ? keep.race : 'human', you: true }, keep ? keep.name : 'Trainee'); h.yard = true; h.ultCharge = 100;
  if (keep && keep.cls === cls && keep.arenaPerks) { h.arenaPerks = Object.assign({}, keep.arenaPerks); recomputePK(h); }
  return h;
}
// weapons you can pick: everything except a lone shield
const PICK = () => Object.keys(WEAPON_TYPES).filter(w => w !== 'shield' && !['daggers', 'handaxes', 'swordmace'].includes(w)); // no twin weapons
let YF = 'all';
let YT = 'class';
// the one Training Yard window: class and perks, get hit by an ultimate, and what your keys do
export function openYardPanel(UI, tab) {
  if (tab) YT = tab;
  const c = UI.openWin('yard', 'Training Yard', '', 'big yardwin'), h = G.save;
  const render = () => {
    c.innerHTML = ''; const h = G.save;
    const top = el('div', 'artabs yardtop'); for (const [k, nm] of [['class', 'Class & perks'], ['ult', 'Get hit by an ultimate'], ['keys', 'Your keys']]) { const t = el('button', 'artab' + (YT === k ? ' on' : ''), nm); t.onclick = () => { S.click(); YT = k; render(); }; top.appendChild(t); } c.appendChild(top);
    if (YT === 'ult') { c.appendChild(el('h3', '', 'Get hit by an ultimate <small>pick one: an enemy of that class appears in front of you and uses it on you, and you watch from the victim\'s side</small>'));
      const ug = el('div', 'pgrid yardgrid'); for (const k of ULT_ORDER) { if (!CLASSES[k]) continue; const id = ultOf(k), ab = id && ABILITIES[k].find(a => a.id === id); if (!ab) continue;
        const b = el('button', 'pcard', `<img src="${classPortrait(k)}" alt=""><b>${CLASSES[k].name}</b><span style="display:block;font-size:12px;color:#ffd070">${ab.name}</span>`); b.onclick = () => { S.click(); UI.closeWin(); setTimeout(() => playUlt(k), 120); }; ug.appendChild(b); }
      c.appendChild(ug); return; }
    if (YT === 'keys') { try { openKitInfo(UI, c); } catch (e) { c.appendChild(el('p', 'dim', 'Your keys are listed in the arena.')); } return; }
    c.appendChild(el('h3', '', 'Class <small>the arena classes: the same keys, looks, ultimate and perks</small>'));
    const tabs = el('div', 'artabs'); for (const [k, nm] of [['all', 'All'], ['Tank', 'Tanks'], ['Healer', 'Healers'], ['Damage', 'Damage']]) { const t = el('button', 'artab' + (YF === k ? ' on' : ''), nm); t.onclick = () => { S.click(); YF = k; render(); }; tabs.appendChild(t); } c.appendChild(tabs);
    const cg = el('div', 'pgrid yardgrid');
    for (const k of Object.keys(CLASSES)) { if (YF !== 'all' && roleOf(k) !== YF) continue; const b = el('button', 'pcard' + (h.cls === k ? ' on' : ''), `<img src="${classPortrait(k)}" alt=""><b>${CLASSES[k].name}</b>`); b.onclick = () => { S.click(); const nh = yardHero(k, G.save); UI.closeWin(); YD.startGame(nh); }; cg.appendChild(b); }
    c.appendChild(cg);
    // every key of the class you are: left and right click, F, C, Q and the ultimate (the same cards as the skills window on P)
    if (G.player && G.player.h) { c.appendChild(el('h3', '', `Your abilities <small>${CLASSES[G.player.h.cls].name}: every key, left and right click included</small>`)); c.appendChild(abilityCards(G.player)); }
    // perks: set any rank you like here, no points needed
    c.appendChild(el('h3', '', `Perks <small>${CLASSES[h.cls].name}: set any rank to try it, no points needed</small>`));
    const pg = el('div', 'perkgrid'); h.arenaPerks = h.arenaPerks || {};
    for (const pk of perksFor(h.cls)) { const lv = h.arenaPerks[pk.id] || 0, r = el('div', 'perkcard' + (lv ? ' has' : ''));
      r.innerHTML = `<div class="kiti"><span class="perkglyph${pk.passive ? ' pas' : ''}">${pk.glyph || '◆'}</span></div><div class="kitt"><b>${pk.name}</b><span>${pk.desc}</span><div class="perkpips">${[0, 1, 2].map(i => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>`;
      const bx = el('div', 'perkbtns'), plus = el('button', 'btn gold perkb', '+'), minus = el('button', 'btn perkb', '−'); plus.disabled = lv >= 3; minus.disabled = lv <= 0;
      const set = (v) => { h.arenaPerks[pk.id] = v; recomputePK(h); const P = G.player, k2 = P.hp / P.maxHp; P.refreshStatsOnly(); P.hp = P.maxHp * k2; S.click(); render(); };
      plus.onclick = () => set(lv + 1); minus.onclick = () => set(lv - 1); bx.append(plus, minus); r.appendChild(bx); pg.appendChild(r); }
    c.appendChild(pg);
    const row = el('div', 'yrow');
    const t1 = el('button', 'btn', 'Reset cooldowns'); t1.onclick = () => { S.click(); resetCooldowns(); G.save.ultCharge = 100; };
    const t5 = el('button', 'btn', 'Max all perks'); t5.onclick = () => { for (const pk of perksFor(h.cls)) h.arenaPerks[pk.id] = 3; recomputePK(h); G.player.refreshStatsOnly(); G.player.hp = G.player.maxHp; S.click(); render(); };
    const t6 = el('button', 'btn', 'Clear perks'); t6.onclick = () => { h.arenaPerks = {}; recomputePK(h); G.player.refreshStatsOnly(); S.click(); render(); };
    const t3 = el('button', 'btn', 'Clear DPS'); t3.onclick = () => { S.click(); YD.dmg.length = 0; };
    const t4 = el('button', 'btn red', 'Leave the yard'); t4.onclick = () => { location.href = location.pathname; };
    row.append(t1, t5, t6, t3, t4); c.appendChild(row);
  };
  render();
}
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

// U in the Training Yard: an enemy necromancer appears in front of you and calls its demon on you, so you can watch the
// ultimate from the victim's side (you come back to life afterwards)
let ultBusy = false;
const REAL_ULT_T = { darkknight: 6, blunderbuss: 12, elementalist: 12, enchanter: 10, beastmaster: 10, priest: 6, bombardier: 12 }; // (table ultimates aimed at you in the yard: how far away the enemy appears)
const REAL_ULT = { necromancer: ['arenaDemon', 'Maw of the Abyss', '☠'], paladin: ['arenaWrath', 'Avenging Wrath', '✝'], monk: ['arenaFists', 'Thousand Fists', '👊', 5], rogue: ['arenaAssassinate', 'Assassinate', '🗡', 12, true], berserker: ['arenaStorm', 'Bladestorm', '🌪', 6], ranger: ['arenaRain', 'Rain of Arrows', '🏹', 14], druid: ['arenaOvergrowth', 'Overgrowth', '🌳', 12], shaman: ['arenaSpirit', 'Spirit of the Storm', '⚡', 8] }; // (true: aimed at you rather than your spot) // [hook, name, icon, how far away the enemy appears] // (the classes whose ultimate is finished: the real thing, cast on you)
export function yardUltTest(cls = 'necromancer') { let RU = REAL_ULT[cls]; if (!RU && ULTS[cls] && REAL_ULT_T[cls]) { const U2 = ULTS[cls]; G.hooks['tbl_' + cls] = (foe, at) => U2.run(foe, U2.aim === 'foe' ? G.player : at); RU = ['tbl_' + cls, U2.name, '★', REAL_ULT_T[cls]]; }
  const P = G.player; if (!P || ultBusy || !RU || !G.hooks[RU[0]]) return; ultBusy = true;
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), far = RU[3] || 10, x = P.pos.x + fx * far, z = P.pos.z + fz * far; const home = P.pos.clone();
  const ch = buildHumanoid({ race: 'human', sex: 'm', cls, outfit: cls, spec: arenaSpec(cls), body: arenaBody(cls) }); arenaDecor(ch, cls);
  try { equipWeapon(ch, CLASSES[cls].weapons.includes('swordshield') ? 'swordshield' : CLASSES[cls].weapons[0], 3, 0); arenaWeaponDecor(ch, cls); } catch (e) { /* no weapon model */ }
  addOutline(ch.root, '#8a0c06'); ch.root.position.set(x, heightAt(x, z), z); ch.root.rotation.y = Math.atan2(-fx, -fz); G.scene.add(ch.root);
  const foe = { pos: ch.root.position, team: 99, heroName: 'Training ' + CLASSES[cls].name, name: 'Training ' + CLASSES[cls].name, root: ch.root, model: ch };
  G.hooks.toast && G.hooks.toast(`An enemy ${CLASSES[cls].name} uses ${RU[1]} on you!`, RU[2], 'bad');
  let t = 0, cast = false;
  G.timers.push({ update: (dt) => { t += dt; animateHumanoid(ch, dt, { speed: 0, armed: true, ready: true }); bodyPoseTick(foe, ch, dt);
    if (t < 1.4 && !RU[4]) { const k = Math.min(1, t * 3); ch.arms.R.sh.rotation.x = -2.6 * k; ch.arms.L.sh.rotation.x = -2.6 * k; ch.arms.R.sh.rotation.z = 0.7 * k; ch.arms.L.sh.rotation.z = -0.7 * k; }
    if (t > 0.9 && !cast) { cast = true; G.hooks[RU[0]](foe, RU[4] ? P : P.pos.clone()); }
    if (t > 11) { G.scene.remove(ch.root); ultBusy = false; if (P.dead || P.pos.distanceTo(home) > 0.5) { P.dead = false; P.deadT = 0; P.hp = P.maxHp || P.hp; P.place(home.x, home.z, P.yaw); if (P.ch) P.ch.root.visible = true; const dd = document.getElementById('death'); if (dd) dd.hidden = true; } return true; }
    return false; } });
}

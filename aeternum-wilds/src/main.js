import * as THREE from 'three';
import { G, SAVE_KEY, newProfile } from './state.js';
import { ZONES, WEAPONS, RACES, CLASSES, HAIR_STYLES, ARMOR_SLOTS } from './data.js';
import { buildWorld, heightAt, zoneAt, updateWorld } from './world.js';
import { createPlayer, updatePlayer, updateProjectiles, useAbility, swapWeapon, usePotion, eatFood, startRecall, startGather, startDodge, jump, makeCharacter, TOWN_SPAWN } from './player.js';
import { updateEnemies, updateCamps, removeEnemy, enemiesNear } from './enemies.js';
import { updateFx, shakeOffset } from './fx.js';
import { initUI, updateHud, setPrompt, togglePanel, closePanel, talkTo, openPanel, refreshHud, refreshTracker, toast } from './ui.js';
import { makeGear } from './items.js';
import { fillBounties } from './quests.js';
import { initAudio, setVolume } from './audio.js';
import { dressHumanoid, makeWeapon } from './models.js';
import { animHumanoid } from './anim.js';
import { renderViewmodel, vmLook, vmCam } from './viewmodel.js';
import { esc, clamp, lerp } from './util.js';

const $ = id => document.getElementById(id);

// ---------- Settings ----------
const SET_KEY = 'aeternum-wilds-settings';
const S = Object.assign({ sens: 1, fov: 70, quality: 'medium', volume: 0.6, invertY: false, autoFS: true, view: 'third' }, (() => { try { return JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch (e) { return {}; } })());
if (S.v !== 2) { S.v = 2; S.view = 'third'; } // the game now plays over the shoulder by default
// graphics levels; 'superultra' is a joke option that falls back to ultra
export const QUALITY = {
  low: { name: 'Low', ratio: 1, shadows: 0, grass: 0, seg: 220, view: 0.7, aa: false },
  medium: { name: 'Medium', ratio: 1.25, shadows: 2048, grass: 12000, seg: 300, view: 1, aa: true },
  high: { name: 'High', ratio: 1.5, shadows: 2048, grass: 20000, seg: 330, view: 1.15, aa: true },
  ultra: { name: 'Ultra', ratio: 2, shadows: 4096, grass: 30000, seg: 400, view: 1.35, aa: true },
  superultra: { name: 'Super Ultra', ratio: 2, shadows: 4096, grass: 30000, seg: 400, view: 1.35, aa: true },
};
if (!QUALITY[S.quality] || S.quality === 'superultra') S.quality = QUALITY[S.quality] ? 'ultra' : 'medium';
G.settings = S;
G.quality = S.quality;
G.Q = QUALITY[S.quality];
export function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(S)); } catch (e) { /* blocked */ } }
G.saveSettings = saveSettings;
G.settingsHtml = (...a) => settingsHtml(...a); G.bindSettings = (...a) => bindSettings(...a); G.controlsHtml = (...a) => controlsHtml(...a);
setVolume(S.volume);

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: G.Q.aa, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, G.Q.ratio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = G.Q.shadows > 0;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const fogCol = new THREE.Color(ZONES.town.fog);
scene.fog = new THREE.Fog(fogCol, 70, 330);
const camera = new THREE.PerspectiveCamera(S.fov, innerWidth / innerHeight, 0.08, 1300);
camera.rotation.order = 'YXZ';
G.scene = scene; G.camera = camera; G.renderer = renderer;
window.G = G; // handy for debugging from the console

const hemi = new THREE.HemisphereLight(0xdfefff, 0x5a4a32, 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.1);
sun.castShadow = true;
const shadowSize = G.Q.shadows || 1024;
sun.shadow.mapSize.set(shadowSize, shadowSize);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 220 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
scene.add(sun); scene.add(sun.target);
G.light = { hemi: 1.15, sun: 2.1, sunColor: new THREE.Color(0xfff0d8) };

addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// ---------- Fullscreen & pointer lock ----------
export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
G.toggleFullscreen = toggleFullscreen;
const canvas = renderer.domElement;
G.relock = () => { if (G.mode === 'game' && !G.ui.open && G.player?.state !== 'dead') { try { const r = canvas.requestPointerLock(); if (r?.catch) r.catch(() => {}); } catch (e) { /* needs a click */ } } };
G.unlock = () => { if (document.pointerLockElement) document.exitPointerLock(); };
document.addEventListener('pointerlockchange', () => {
  G.locked = document.pointerLockElement === canvas;
  if (!G.locked) {
    G.input.lmb = G.input.rmb = false; G.input.keys = {};
    // Esc while playing releases the mouse: show the pause menu
    if (G.mode === 'game' && !G.ui.open && G.player?.state !== 'dead' && !G.noLockNeeded) openPanel('menu');
  }
});

// ---------- Input ----------
const inp = G.input;
let camDist = S.view === 'third' ? 3.6 : 0, camDistT = camDist;
addEventListener('mousemove', e => {
  inp.mx = e.clientX; inp.my = e.clientY;
  if (!G.locked || !G.player) return;
  const k = 0.0022 * S.sens * (S.fov / 75);
  G.player.yaw -= e.movementX * k;
  G.player.pitch = clamp(G.player.pitch - e.movementY * k * (S.invertY ? -1 : 1), -1.45, 1.35);
  vmLook(e.movementX, e.movementY);
});
canvas.addEventListener('mousedown', e => {
  initAudio();
  if (G.mode !== 'game') return;
  if (!G.locked) { G.relock(); return; }
  if (G.ui.open) return;
  if (e.button === 0) inp.lmb = true;
  if (e.button === 2) inp.rmb = true;
  inp.overUI = false;
});
addEventListener('mouseup', e => { if (e.button === 0) inp.lmb = false; if (e.button === 2) inp.rmb = false; });
addEventListener('contextmenu', e => { if (e.target === canvas) e.preventDefault(); });
addEventListener('blur', () => { inp.keys = {}; inp.lmb = inp.rmb = false; });
canvas.addEventListener('wheel', e => {
  if (G.mode !== 'game') return;
  camDistT = clamp(camDistT + Math.sign(e.deltaY) * 0.6, 0, 7);
  if (camDistT > 0 && camDistT < 2.2) camDistT = e.deltaY > 0 ? 2.2 : 0;
  S.view = camDistT > 0 ? 'third' : 'first'; saveSettings();
}, { passive: true });
G.setView = v => { S.view = v; camDistT = v === 'third' ? 3.6 : 0; saveSettings(); };

addEventListener('keydown', e => {
  if (G.mode !== 'game') return;
  if (e.target.tagName === 'INPUT') return;
  initAudio();
  const c = e.code;
  if (c === 'Escape') { if (G.ui.open) closePanel(); else { G.unlock(); openPanel('menu'); } e.preventDefault(); return; }
  if (c === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
  const panels = { KeyI: 'inventory', KeyC: 'character', KeyK: 'mastery', KeyJ: 'quests', KeyL: 'quests', KeyM: 'map', Tab: 'map' };
  if (panels[c]) { e.preventDefault(); togglePanel(panels[c]); return; }
  if (G.ui.open) return;
  if (c === 'Space' || c === 'Tab' || c === 'ShiftLeft' || c === 'ShiftRight') e.preventDefault();
  if (e.repeat) return;
  inp.keys[c] = true;
  if (G.player.state === 'dead') return;
  switch (c) {
    case 'ShiftLeft': case 'ShiftRight': startDodge(); break;
    case 'Space': jump(); break;
    case 'KeyQ': useAbility(0); break;
    case 'KeyR': useAbility(1); break;
    case 'KeyF': useAbility(2); break;
    case 'Digit1': swapWeapon(0); break;
    case 'Digit2': swapWeapon(1); break;
    case 'Digit3': usePotion(); break;
    case 'Digit4': eatFood(); break;
    case 'KeyH': startRecall(); break;
    case 'KeyE': interact(); break;
    case 'KeyV': G.setView(S.view === 'first' ? 'third' : 'first'); break;
  }
});
addEventListener('keyup', e => { inp.keys[e.code] = false; });

// ---------- Interaction ----------
let near = null;
function findInteractable() {
  const P = G.player;
  let best = null, bs = 1e9;
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
  const consider = (o, r) => {
    const dx = o.x - P.pos.x, dz = o.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d > r) return;
    const facing = d < 1.2 ? 1 : (dx * fx + dz * fz) / d;
    if (facing < 0.35) return;
    const score = d * (2 - facing);
    if (score < bs) { bs = score; best = o; }
  };
  for (const n of G.npcs) consider(n, 3.4);
  for (const s of G.stations) consider(s, 3.8);
  for (const c of G.corpses) if (!c.skinned) consider(c, 2.8);
  for (const n of G.nodes) if (n.depleted <= 0 && Math.abs(n.x - P.pos.x) < 4 && Math.abs(n.z - P.pos.z) < 4) consider(n, n.def.skill === 'mining' ? 3.1 : 2.7);
  return best;
}
function interact() {
  const P = G.player;
  if (!near) return;
  if (near.kind === 'npc') talkTo(near);
  else if (near.kind === 'station') openPanel('station', near.id);
  else if (P.state !== 'gather') startGather(near);
}
function updatePrompt() {
  const P = G.player;
  near = P.state === 'dead' ? null : findInteractable();
  if (!near || P.state === 'gather') { setPrompt(null); return; }
  let t = '';
  if (near.kind === 'npc') t = near.id === 'board' ? 'Read the Bounty Board' : `Talk to ${near.id === 'thorne' ? 'Captain Thorne' : 'Ilsa'}`;
  else if (near.kind === 'station') t = `Use the ${near.id[0].toUpperCase() + near.id.slice(1)}`;
  else if (near.kind === 'corpse') t = `Skin ${esc(near.name)}`;
  else {
    const d = near.def, lv = G.p.trade[d.skill].lv;
    t = lv < d.req ? `<span class="no">${d.name}: needs ${d.skill[0].toUpperCase() + d.skill.slice(1)} ${d.req}</span>` : `${d.verb} ${d.name}`;
  }
  setPrompt(`<kbd>E</kbd> ${t}`);
}

// ---------- Aim: march the crosshair ray against terrain and enemies ----------
const fwd = new THREE.Vector3(), aimP = new THREE.Vector3();
function updateAim() {
  const P = G.player;
  camera.getWorldDirection(fwd);
  const o = camera.position;
  const list = enemiesNear(o.x, o.z, 60);
  let hitE = null, t = 0.5;
  // in third person, start the ray at the player so nothing behind them is picked
  if (camDist > 0) t = camDist;
  for (; t < 80; t += 0.4) {
    const x = o.x + fwd.x * t, y = o.y + fwd.y * t, z = o.z + fwd.z * t;
    if (y < heightAt(x, z)) break;
    for (const e of list) {
      if (e.dead) continue;
      const top = e.y + (e.model.beast ? 1.3 : 2.1) * e.size;
      if (y > e.y - 0.2 && y < top && Math.hypot(e.pos.x - x, e.pos.z - z) < e.radius + 0.25) { hitE = e; break; }
    }
    if (hitE) break;
  }
  aimP.set(o.x + fwd.x * t, o.y + fwd.y * t, o.z + fwd.z * t);
  inp.aimPoint = aimP;
  inp.aimEnemy = hitE;
  inp.aimDist = Math.hypot(aimP.x - P.pos.x, aimP.z - P.pos.z);
  inp.aimX = aimP.x; inp.aimZ = aimP.z;
}

// ---------- Day and night ----------
const DAY_LEN = 24 * 60; // seconds per full day
const cSunDay = new THREE.Color(0xfff0d8), cSunSet = new THREE.Color(0xff9a50), cMoon = new THREE.Color(0x8aa8ff);
const cTopDay = new THREE.Color(0x3d7fd0), cTopNight = new THREE.Color(0x0a1230), cHorDay = new THREE.Color(0xcfe4ee), cHorSet = new THREE.Color(0xf0a070), cHorNight = new THREE.Color(0x1a2440);
const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), zoneFog = new THREE.Color();
function updateSky(dt, center) {
  if (G.mode === 'game' && G.p) { G.p.dayT = ((G.p.dayT ?? 0.32) + dt / DAY_LEN) % 1; }
  const dayT = G.mode === 'game' && G.p ? G.p.dayT : 0.36;
  const ang = (dayT - 0.25) * Math.PI * 2; // 0.25 sunrise, 0.5 noon, 0.75 sunset
  const sy = Math.sin(ang), sx = Math.cos(ang);
  const day = clamp(sy * 3 + 0.3, 0, 1), set = clamp(1 - Math.abs(sy) * 4, 0, 1) * (sy > -0.25 ? 1 : 0);
  const sunDir = new THREE.Vector3(sx, Math.max(0.12, Math.abs(sy)), 0.35).normalize();
  const isSun = sy > -0.05;
  // light
  const sunCol = tmpC.copy(cMoon).lerp(cSunDay, day).lerp(cSunSet, set * 0.7);
  G.light.sun = isSun ? lerp(0.5, 2.1, day) : 0.45;
  G.light.hemi = lerp(0.42, 1.15, day);
  G.light.sunColor.copy(sunCol);
  sun.intensity = G.light.sun; sun.color.copy(sunCol);
  hemi.intensity = G.light.hemi;
  hemi.color.setHex(0xdfefff).lerp(cMoon, 1 - day);
  const sd = isSun ? sunDir : new THREE.Vector3(-sx, Math.max(0.3, -sy), -0.3).normalize();
  sun.position.set(center.x + sd.x * 90, center.y + sd.y * 90, center.z + sd.z * 90);
  sun.target.position.copy(center);
  // sky
  if (G.sky) {
    const u = G.sky.material.uniforms;
    u.top.value.copy(cTopNight).lerp(cTopDay, day);
    u.horizon.value.copy(cHorNight).lerp(cHorDay, day).lerp(cHorSet, set * 0.75);
    u.sunDir.value.copy(sunDir).setY(sy);
    u.sunCol.value.copy(isSun ? cSunDay : cMoon).lerp(cSunSet, set);
    u.stars.value = 1 - day;
    G.sky.position.copy(camera.position);
  }
  if (G.cloudMat) G.cloudMat.emissive.setRGB(0.55 * day + 0.05 + set * 0.2, 0.55 * day + 0.05 + set * 0.08, 0.58 * day + 0.08);
  // fog = zone colour, darkened at night, warmed at sunset
  const zn = G.player ? zoneAt(G.player.pos.x, G.player.pos.z) : 'meadow';
  zoneFog.setHex(ZONES[zn].fog);
  tmpC2.copy(cHorNight).lerp(zoneFog, day).lerp(cHorSet, set * 0.35);
  fogCol.lerp(tmpC2, Math.min(1, dt * 1.5));
  // torches at night
  for (const t of G.torches || []) if (t.light) t.light.intensity = (1 - day) * 25;
  G.night = 1 - day;
}

// ---------- Save ----------
function saveGame() {
  if (!G.p || G.mode !== 'game' || window.skipSave) return;
  G.p.pos = [G.player.pos.x, G.player.pos.z];
  G.p.yaw = G.player.yaw;
  if (G.player.state === 'dead') G.p.pos = [TOWN_SPAWN.x, TOWN_SPAWN.z];
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.p)); } catch (e) { /* storage full or blocked */ }
}
window.saveGame = saveGame;
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.v === 1 ? s : null; } catch (e) { return null; } }
addEventListener('beforeunload', saveGame);

// ---------- Home screen ----------
function title() {
  G.mode = 'title';
  const save = loadSave();
  const t = $('title');
  const R = save ? RACES[save.race || 'human'] : null, C = save ? CLASSES[save.cls] : null;
  t.innerHTML = `<div class="home">
    <div class="logo"><div class="crest">⚜</div><h1>Aeternum<span>Wilds</span></h1><p>Shipwrecked on a cursed island. Fight, gather, craft, and break the Corruption.</p></div>
    <nav>
      ${save ? `<button id="cont" class="primary"><b>Continue</b><small>${esc(save.name || 'Castaway')} · ${R ? R.name : ''} ${C ? C.name : ''} · Level ${save.level}</small></button>` : ''}
      <button id="newg" class="${save ? '' : 'primary'}"><b>New Character</b><small>Choose a race and a class</small></button>
      <button id="sett"><b>Settings</b><small>Mouse, view, graphics, sound</small></button>
      <button id="fs"><b>${document.fullscreenElement ? 'Exit Full Screen' : 'Full Screen'}</b><small>Or press F11 at any time</small></button>
      <button id="ctrl"><b>Controls</b></button>
    </nav>
    <div id="homeside"></div>
    <footer>Over-the-shoulder view · scroll all the way in for first person</footer></div>`;
  t.style.display = 'block';
  if (save) $('cont').onclick = () => { initAudio(); enterGame(save); };
  $('newg').onclick = () => { initAudio(); if (save && !confirm('Create a new character? Your current character will be replaced.')) return; creator(); };
  $('sett').onclick = () => { initAudio(); $('homeside').innerHTML = settingsHtml(); bindSettings($('homeside')); };
  $('fs').onclick = () => { toggleFullscreen(); setTimeout(title, 200); };
  $('ctrl').onclick = () => { $('homeside').innerHTML = `<div class="card">${controlsHtml()}</div>`; };
}

export function controlsHtml() {
  return `<h3>Controls</h3><table class="keys">
    <tr><td>Mouse</td><td>Look and aim</td><td>WASD</td><td>Move</td></tr>
    <tr><td>Left click</td><td>Light attack · hold for heavy · bow: hold to draw</td><td>Right click</td><td>Block</td></tr>
    <tr><td>Shift</td><td>Dodge (roll length depends on armor weight)</td><td>Space</td><td>Jump</td></tr>
    <tr><td>Q R F</td><td>Weapon abilities</td><td>1 / 2</td><td>Swap weapon</td></tr>
    <tr><td>3 / 4</td><td>Potion / Eat</td><td>E</td><td>Interact, gather, skin</td></tr>
    <tr><td>H</td><td>Recall to town</td><td>Tab</td><td>Map</td></tr>
    <tr><td>Wheel</td><td>Zoom (all the way in for first person)</td><td>F11</td><td>Full screen</td></tr>
    <tr><td>I</td><td>Inventory</td><td>C</td><td>Character</td></tr>
    <tr><td>K</td><td>Mastery</td><td>J</td><td>Journal</td></tr>
    <tr><td>M</td><td>Map</td><td>Esc</td><td>Menu</td></tr></table>`;
}
export function settingsHtml() {
  return `<div class="card settings"><h3>Settings</h3>
    <label>Mouse sensitivity <input type="range" data-s="sens" min="0.2" max="3" step="0.05" value="${S.sens}"><output>${S.sens.toFixed(2)}</output></label>
    <label>Field of view <input type="range" data-s="fov" min="60" max="100" step="1" value="${S.fov}"><output>${S.fov}</output></label>
    <label>Volume <input type="range" data-s="volume" min="0" max="1" step="0.05" value="${S.volume}"><output>${Math.round(S.volume * 100)}%</output></label>
    <label>View <select data-s="view"><option value="third" ${S.view === 'third' ? 'selected' : ''}>Over the shoulder</option><option value="first" ${S.view === 'first' ? 'selected' : ''}>First person</option></select></label>
    <label>Graphics <select data-s="quality">${Object.entries(QUALITY).map(([k, q]) => `<option value="${k}" ${S.quality === k ? 'selected' : ''}>${q.name}</option>`).join('')}</select></label>
    <label class="chk"><input type="checkbox" data-s="invertY" ${S.invertY ? 'checked' : ''}> Invert mouse Y</label>
    <label class="chk"><input type="checkbox" data-s="autoFS" ${S.autoFS ? 'checked' : ''}> Go full screen when the game starts</label>
    <p class="dim small" id="qnote"></p></div>`;
}
export function bindSettings(root) {
  root.querySelectorAll('[data-s]').forEach(el => {
    const k = el.dataset.s;
    el.oninput = el.onchange = () => {
      const v = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : +el.value;
      if (k === 'quality' && v === 'superultra') {
        el.value = S.quality;
        const n = root.querySelector('#qnote');
        if (n) { n.innerHTML = '<b class="nope">⚠ Your computer can\'t handle this.</b> Super Ultra would melt it. Try Ultra instead.'; n.classList.remove('shake'); void n.offsetWidth; n.classList.add('shake'); }
        return;
      }
      if (k === 'quality' && v !== S.quality) { const n = root.querySelector('#qnote'); if (n) n.innerHTML = `Graphics set to ${QUALITY[v].name}. <button id="qreload" class="small">Reload now</button> to apply it.`; setTimeout(() => { const b = root.querySelector('#qreload'); if (b) b.onclick = () => { window.saveGame(); location.reload(); }; }); }
      S[k] = v;
      const out = el.parentElement.querySelector('output');
      if (out) out.textContent = k === 'volume' ? Math.round(v * 100) + '%' : k === 'sens' ? v.toFixed(2) : v;
      if (k === 'fov') { camera.fov = v; camera.updateProjectionMatrix(); }
      if (k === 'volume') setVolume(v);
      if (k === 'view') G.setView(v);
      saveSettings();
    };
  });
}

// ---------- Character creator ----------
const draft = { name: '', race: 'human', cls: 'knight', look: { skin: null, hair: null, hairStyle: 0, beard: true } };
let preview = null, previewYaw = 0;
const PREVIEW_AT = { x: 3, z: 24 };
function buildPreview() {
  if (preview) scene.remove(preview.root);
  const R = RACES[draft.race], C = CLASSES[draft.cls];
  if (draft.look.skin == null || !R.skins.includes(draft.look.skin)) draft.look.skin = R.skins[0];
  if (draft.look.hair == null || !R.hair.includes(draft.look.hair)) draft.look.hair = R.hair[0];
  preview = makeCharacter({ race: draft.race, look: draft.look });
  const hide = [0x6a4a2a, 0x4a3420, 0x3a2a1a];
  dressHumanoid(preview, { chest: C.gear.includes('chest') ? hide[0] : 0x7a6a52, legs: C.gear.includes('legs') ? hide[1] : 0x4a3e30, feet: hide[2], helm: C.gear.includes('head') ? 0x6a4a2a : null, helmTier: 1, trim: C.color });
  const wt = C.weapon;
  if (wt === 'bow') preview.parts.handL.add(makeWeapon('bow', 1));
  else { preview.parts.handR.add(makeWeapon(wt, 1)); if (wt === 'sword') { const sh = makeWeapon('shield', 1); sh.position.set(0.12, 0.05, 0.15); sh.rotation.y = Math.PI / 2; preview.parts.handL.add(sh); } }
  preview.root.position.set(PREVIEW_AT.x, heightAt(PREVIEW_AT.x, PREVIEW_AT.z), PREVIEW_AT.z);
  scene.add(preview.root);
}
function creator() {
  G.mode = 'create';
  buildPreview();
  const t = $('title');
  const R = RACES[draft.race], C = CLASSES[draft.cls];
  const attrs = { str: 5, dex: 5, int: 5, con: 5 };
  for (const src of [R, C]) for (const k in src.attrs) attrs[k] += src.attrs[k];
  const sw = (list, key) => list.map(c => `<button class="sw ${draft.look[key] === c ? 'on' : ''}" data-${key}="${c}" style="background:#${c.toString(16).padStart(6, '0')}"></button>`).join('');
  t.innerHTML = `<div class="creator">
    <div class="cpanel">
      <h2>Create your character</h2>
      <label class="nm">Name <input id="cname" maxlength="18" placeholder="Castaway" value="${esc(draft.name)}"></label>
      <h3>Race</h3><div class="cards">${Object.entries(RACES).map(([k, r]) => `<button class="ccard ${k === draft.race ? 'on' : ''}" data-race="${k}"><span>${r.icon}</span><b>${r.name}</b></button>`).join('')}</div>
      <p class="cdesc">${R.desc}<br><em>${R.perk}</em></p>
      <h3>Class</h3><div class="cards">${Object.entries(CLASSES).map(([k, c]) => `<button class="ccard ${k === draft.cls ? 'on' : ''}" data-cls="${k}"><span>${c.icon}</span><b>${c.name}</b><small>${WEAPONS[c.weapon].name}</small></button>`).join('')}</div>
      <p class="cdesc">${C.desc}<br><em>${C.perk}</em> Also gets a ${WEAPONS[C.second].name.toLowerCase()} from the first quest.</p>
      <h3>Appearance</h3>
      <div class="look"><span>Skin</span>${sw(R.skins, 'skin')}</div>
      <div class="look"><span>Hair</span>${sw(R.hair, 'hair')}</div>
      <div class="look"><span>Style</span>${HAIR_STYLES.map((h, i) => `<button class="hs ${draft.look.hairStyle === i ? 'on' : ''}" data-hs="${i}">${h}</button>`).join('')}</div>
      ${R.beard ? `<div class="look"><span>Beard</span><button class="hs ${draft.look.beard ? 'on' : ''}" data-beard="1">Yes</button><button class="hs ${!draft.look.beard ? 'on' : ''}" data-beard="0">No</button></div>` : ''}
      <div class="cattrs">${['str', 'dex', 'int', 'con'].map(k => `<span>${{ str: 'Strength', dex: 'Dexterity', int: 'Intelligence', con: 'Constitution' }[k]} <b>${attrs[k]}</b></span>`).join('')}</div>
      <div class="row"><button id="cback">Back</button><button id="cgo" class="primary">Begin your journey</button></div>
    </div>
    <div class="chint">Drag to turn your character</div></div>`;
  t.style.display = 'block';
  $('cname').oninput = e => { draft.name = e.target.value; };
  t.querySelectorAll('[data-race]').forEach(b => b.onclick = () => { draft.race = b.dataset.race; draft.look.skin = null; draft.look.hair = null; creator(); });
  t.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { draft.cls = b.dataset.cls; creator(); });
  t.querySelectorAll('[data-skin]').forEach(b => b.onclick = () => { draft.look.skin = +b.dataset.skin; creator(); });
  t.querySelectorAll('[data-hair]').forEach(b => b.onclick = () => { draft.look.hair = +b.dataset.hair; creator(); });
  t.querySelectorAll('[data-hs]').forEach(b => b.onclick = () => { draft.look.hairStyle = +b.dataset.hs; creator(); });
  t.querySelectorAll('[data-beard]').forEach(b => b.onclick = () => { draft.look.beard = b.dataset.beard === '1'; creator(); });
  $('cback').onclick = () => { if (preview) { scene.remove(preview.root); preview = null; } title(); };
  $('cgo').onclick = () => {
    const C2 = CLASSES[draft.cls];
    const p = newProfile(C2.weapon, draft.race, draft.cls, { ...draft.look }, draft.name.trim() || 'Castaway');
    G.p = p;
    p.equip.w1 = makeGear({ kind: 'weapon', wtype: C2.weapon, gs: 100, rarity: 0 });
    for (const sl of C2.gear) p.equip[sl] = makeGear({ kind: 'armor', slot: sl, gs: 100, rarity: 0, wclass: C2.armor });
    if (preview) { scene.remove(preview.root); preview = null; }
    enterGame(p);
  };
}
let dragging = false, lastX = 0;
$('title').addEventListener('mousedown', e => { if (G.mode === 'create' && e.target.closest('.cpanel') == null) { dragging = true; lastX = e.clientX; } });
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', e => { if (dragging) { previewYaw += (e.clientX - lastX) * 0.01; lastX = e.clientX; } });

// ---------- Enter the world ----------
function enterGame(profile) {
  G.p = profile;
  if (!profile.race) profile.race = 'human';
  if (!profile.cls) profile.cls = ({ sword: 'knight', greataxe: 'berserker', hammer: 'vanguard', bow: 'ranger' })[profile.startWeapon] || 'knight';
  $('title').style.display = 'none';
  if (S.autoFS && !document.fullscreenElement) toggleFullscreen();
  createPlayer();
  initUI();
  fillBounties();
  refreshHud(); refreshTracker();
  $('hud').style.display = 'block';
  G.mode = 'game'; G.started = true; G.paused = false;
  G.relock();
  if (profile.story.step === 0) setTimeout(() => toast(`Welcome to Aeternum, ${esc(profile.name || 'Castaway')}. Captain Thorne is waiting by the flag. Walk up to him and press <kbd>E</kbd>.`, 'gold'), 800);
}

// ---------- Loop ----------
const clock = new THREE.Clock();
let cullT = 0, saveT = 20, promptT = 0, aimT = 0, eyeBob = 0;
const center = new THREE.Vector3();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(G.maxDt || 0.05, clock.getDelta());
  const t = performance.now() / 1000;
  const P = G.player;
  if (G.mode === 'game') {
    G.paused = !!G.ui.open || (!G.locked && P.state !== 'dead' && !G.noLockNeeded);
    $('resume').style.display = !G.locked && !G.ui.open && P.state !== 'dead' && !G.noLockNeeded ? 'flex' : 'none';
    if (!G.paused) {
      G.time += dt;
      G.p.stats.playTime += dt;
      updatePlayer(dt);
      updateCamps(dt);
      updateEnemies(dt);
      updateProjectiles(dt);
      updateFx(dt);
      cullT -= dt;
      if (cullT <= 0) { cullT = 0.4; for (const n of G.nodes) { const far = Math.abs(n.x - P.pos.x) > 120 || Math.abs(n.z - P.pos.z) > 120; n.mesh.visible = !far && n.depleted <= 0; } }
      for (const n of G.nodes) if (n.depleted > 0) { n.depleted -= dt; if (n.depleted <= 0) { n.mesh.visible = true; cullT = 0; if (n.stump) n.stump.visible = false; if (n.col) n.col.off = false; } }
      for (let i = G.corpses.length - 1; i >= 0; i--) { const c = G.corpses[i]; if (G.time > c.until) { removeEnemy(c.ent); G.corpses.splice(i, 1); } }
      promptT -= dt; if (promptT <= 0) { promptT = 0.1; updatePrompt(); }
      saveT -= dt; if (saveT <= 0) { saveT = 20; saveGame(); }
      if (G.p.food && G.p.food.until <= G.p.stats.playTime) { G.p.food = null; G.statsDirty = true; toast('Your food buff wore off'); }
    }
    // camera
    camDist += (camDistT - camDist) * Math.min(1, dt * 10);
    const third = camDist > 0.3;
    const eyeH = 1.62 * (P.h.size || 1);
    const [shx, shy] = shakeOffset(dt);
    let ey = P.y + eyeH + (P.jumpY || 0);
    if (P.state === 'dodge') ey -= Math.sin(P.dodge.t / P.dodge.dur * Math.PI) * 0.55;
    if (P.state === 'dead') ey = P.y + 0.5;
    eyeBob += dt * (P.move > 0.1 ? 1 : 0);
    if (!third) ey += Math.sin(P.phase * 2) * 0.045 * P.move;
    const fx = Math.sin(P.yaw) * Math.cos(P.pitch), fy = Math.sin(P.pitch), fz = Math.cos(P.yaw) * Math.cos(P.pitch);
    if (third) {
      const rx = -Math.cos(P.yaw), rz = Math.sin(P.yaw);
      const sh = Math.min(1, camDist / 3.6) * 0.95; // shoulder offset to the right
      let cx = P.pos.x - fx * camDist + rx * sh, cy = P.y + (P.jumpY || 0) + 1.8 * (P.h.size || 1) - fy * camDist + 0.15, cz = P.pos.z - fz * camDist + rz * sh;
      cy = Math.max(cy, heightAt(cx, cz) + 0.4);
      camera.position.set(cx + shx * 0.3, cy + shy * 0.3, cz);
    } else camera.position.set(P.pos.x + fx * 0.12 + shx * 0.15, ey + shy * 0.15, P.pos.z + fz * 0.12);
    camera.rotation.set(P.pitch, P.yaw + Math.PI, P.state === 'dodge' && !third ? Math.sin(P.dodge.t / P.dodge.dur * Math.PI) * 0.06 : 0);
    if (P.state === 'dead') camera.rotation.z = 0.5;
    P.h.root.visible = third;
    camera.updateMatrixWorld();
    if (!G.paused) { aimT -= dt; if (aimT <= 0) { aimT = 0.05; updateAim(); } }
    center.set(P.pos.x, P.y, P.pos.z);
    updateSky(G.paused ? 0 : dt, center);
    updateWorld(dt, P.pos.x, P.pos.z, t);
    const zn = zoneAt(P.pos.x, P.pos.z);
    scene.fog.near = (zn === 'mire' ? 25 : zn === 'ruins' ? 45 : 70) * G.Q.view;
    scene.fog.far = (zn === 'mire' ? 170 : zn === 'ruins' ? 230 : 330) * G.Q.view;
    if (G.night > 0.5) scene.fog.far *= 0.8;
    updateHud(dt);
  } else {
    // home screen fly-over or character preview
    if (G.mode === 'create' && preview) {
      const px = PREVIEW_AT.x, pz = PREVIEW_AT.z, py = heightAt(px, pz);
      preview.root.rotation.y = previewYaw;
      animHumanoid(preview, { move: 0, phase: t, pose: null });
      preview.body.position.y = Math.sin(t * 2) * 0.01;
      camera.position.set(px - 1.7, py + 1.5, pz + 5.2);
      camera.lookAt(px - 1.7, py + 1.0, pz);
      center.set(px, py, pz);
    } else {
      const a = t * 0.025;
      camera.position.set(Math.cos(a) * 95, 42 + Math.sin(t * 0.1) * 6, Math.sin(a) * 95);
      camera.lookAt(Math.cos(a + 0.9) * 20, 8, Math.sin(a + 0.9) * 20);
      center.set(Math.cos(a) * 60, 3, Math.sin(a) * 60);
    }
    updateSky(dt, center);
    updateWorld(dt, center.x, center.z, t);
    scene.fog.near = 90; scene.fog.far = 420;
  }
  // ambience
  if (G.flag) G.flag.userData.flag.rotation.y = Math.sin(t * 2) * 0.25;
  if (G.flame) { G.flame.scale.set(1 + Math.sin(t * 13) * 0.12, 1 + Math.sin(t * 9) * 0.2, 1 + Math.cos(t * 11) * 0.12); }
  for (const tr of G.torches || []) tr.flame.scale.set(1 + Math.sin(t * 12 + tr.flame.id) * 0.15, 1 + Math.sin(t * 9 + tr.flame.id) * 0.25, 1);
  if (G.crystal) { G.crystal.rotation.y = t * 0.6; G.crystal.position.y = 3.4 + Math.sin(t * 1.5) * 0.3; }
  if (G.water) G.water.position.y = -0.15 + Math.sin(t * 0.6) * 0.06;
  scene.background = fogCol;
  renderer.render(scene, camera);
  if (G.mode === 'game' && camDist < 0.3) { vmCam.fov = 58; renderViewmodel(renderer, dt); }
}

// ---------- Boot: build the island behind the home screen ----------
$('resume').onclick = () => G.relock();
setTimeout(() => {
  buildWorld();
  $('loading').style.display = 'none';
  title();
  clock.getDelta();
  requestAnimationFrame(loop);
}, 30);

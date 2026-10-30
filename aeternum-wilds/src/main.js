import { hostGame, joinGame, online, onlineCode, tickOnline, initChat, focusChat, hello, leaveOnline, partySize } from './online.js';
import { loadSpellModel, loadFxModels } from './gfx/spellfx.js';
import { loadCreatures } from './gfx/creatures.js';
import * as THREE from 'three';
import { G, SAVE_KEY, newProfile } from './state.js';
import { ZONES, WEAPONS, HAIR_STYLES, ARMOR_SLOTS, SKIN_TONES, HAIR_COLORS, EYE_COLORS, FACIAL_HAIR, WAR_PAINT, BODY_SLIDERS, FACE_SLIDERS } from './data.js';
import { CLASSES, CLASS_LIST } from './classes.js';
import { ensureSkills, castSkill, updateSkills, spellPower } from './skills.js';
import { updatePets, clearPets } from './pets.js';
import { buildWorld, heightAt, zoneAt, updateWorld } from './world.js';
import { createPlayer, updatePlayer, updateProjectiles, useAbility, swapWeapon, usePotion, eatFood, startRecall, startGather, startDodge, jump, makeCharacter, armCharacter, carryWeapon, refreshLook, TOWN_SPAWN } from './player.js';
import { updateEnemies, updateCamps, removeEnemy, enemiesNear } from './enemies.js';
import { updateFx, shakeOffset } from './fx.js';
import { initUI, updateHud, setPrompt, togglePanel, closePanel, talkTo, openPanel, refreshHud, refreshTracker, toast } from './ui.js';
import { makeGear } from './items.js';
import { fillBounties } from './quests.js';
import { initAudio, setVolume, setMusic, setMusicZone, setAmbience, setMusicVolume } from './audio.js';
import { dressHumanoid, makeWeapon } from './models.js';
import { WEAPON_MODELS, onWeaponModel, weaponModelMesh } from './gfx/weapons3d.js';
import { dressArmor } from './gfx/armor.js';
// a weapon model finished downloading: re-dress whoever is holding the stand-in
onWeaponModel(() => { if (G.mode === 'create' && preview) buildPreview(); else if (G.player && G.p) refreshLook(); });
weaponModelMesh('gothicBoss'); // the Warden's blade, ready before anyone meets him
import { animHumanoid } from './anim.js';
import { renderViewmodel, vmLook, vmCam } from './viewmodel.js';
import { updateSpellFx } from './spellfx.js';
import { loadMeshy, meshyReady } from './gfx/meshy.js';
import { loadHeroRig } from './gfx/herorig.js';
import { buildLife, updateLife } from './life.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { esc, clamp, lerp } from './util.js';

const $ = id => document.getElementById(id);

// ---------- Settings ----------
const SET_KEY = 'aeternum-wilds-settings';
// ranged weapons that zoom with right-click (only the bow exists so far)
const ZOOM_WEAPONS = new Set(['bow', 'crossbow', 'musket', 'blunderbuss']);
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
setMusicVolume(S.music ?? 0.5);

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: G.Q.aa, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, G.Q.ratio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = G.Q.shadows > 0;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// filmic tone mapping keeps bright fire and magic from clipping to flat white
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
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

// bloom: glow on flames, spells, eyes and lit windows (off on Low)
let composer = null;
if (S.quality !== 'low') {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), S.quality === 'medium' ? 0.42 : 0.55, 0.55, 0.8));
  composer.addPass(new OutputPass());
}
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); composer?.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// ---------- Weapon swing trails ----------
// Trails, camera kicks and screen feedback for combat live in combatfx.js and gfx/vfx/; this runs them every frame.
import { tickCombatFx } from './combatfx.js';
let fxClock = performance.now();
function updateTrail() {
  const now = performance.now(), d = Math.min(0.1, (now - fxClock) / 1000); fxClock = now;
  tickCombatFx(d, camDist > 0.3);
}

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
  const k = 0.0022 * S.sens * (camera.fov / 75);
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
  if (G.mode === 'create') { previewZoom = clamp(previewZoom + Math.sign(e.deltaY) * 0.08, 0.3, 1.3); return; }
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
  if ((c === 'Enter' || c === 'NumpadEnter') && !G.ui.open) { e.preventDefault(); inp.keys = {}; focusChat(); return; }
  const panels = { KeyI: 'inventory', KeyP: 'character', KeyC: 'character', KeyK: 'skills', KeyJ: 'quests', KeyL: 'quests', KeyM: 'map', Tab: 'map' };
  if (panels[c]) { e.preventDefault(); togglePanel(panels[c]); return; }
  if (G.ui.open) return;
  if (c === 'Space' || c === 'Tab' || c === 'ShiftLeft' || c === 'ShiftRight') e.preventDefault();
  if (e.repeat) return;
  inp.keys[c] = true;
  if (G.player.state === 'dead') return;
  switch (c) {
    case 'ShiftLeft': case 'ShiftRight': startDodge(); break;
    case 'Space': jump(); break;
    // weapon abilities 1 2 3, the class ability on F, Q swaps weapons, R potion, T food
    case 'Digit1': useAbility(0); break;
    case 'Digit2': useAbility(1); break;
    case 'Digit3': useAbility(2); break;
    case 'KeyF': castSkill(); break;
    case 'KeyQ': swapWeapon(G.p.activeW ? 0 : 1); break;
    case 'KeyR': usePotion(); break;
    case 'KeyT': eatFood(); break;
    case 'KeyH': startRecall(); break;
    case 'KeyE': interact(); break;
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
  const C = save ? CLASSES[save.cls] : null;
  t.innerHTML = `<div class="home">
    <div class="logo"><div class="crest">⚜</div><h1>Aeternum<span>Wilds</span></h1><p>Shipwrecked on a cursed island. Fight, gather, craft, and break the Corruption.</p></div>
    <nav>
      ${save ? `<button id="cont" class="primary"><b>Continue</b><small>${esc(save.name || 'Castaway')} · ${C ? C.name : 'Adventurer'} · Level ${save.level}</small></button>` : ''}
      <button id="newg" class="${save ? '' : 'primary'}"><b>New Character</b><small>Pick one of 16 classes and shape your hero</small></button>
      <button id="onl"><b>${online() ? `Online · ${onlineCode()}` : 'Play Online'}</b><small>${online() ? `${partySize()} in the party · invite more friends` : 'Host a game or join friends · chat, party up, share XP'}</small></button>
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
  $('onl').onclick = () => { initAudio(); onlinePanel(); };
  if (invited && !online()) onlinePanel(invited);
  $('fs').onclick = () => { toggleFullscreen(); setTimeout(title, 200); };
  $('ctrl').onclick = () => { $('homeside').innerHTML = `<div class="card">${controlsHtml()}</div>`; };
}

// ---------- Online ----------
const invited = (new URLSearchParams(location.search).get('join') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
const inviteLink = code => `${location.origin}${location.pathname}?join=${code}`;
function onlinePanel(code = '') {
  const side = $('homeside');
  if (online()) {
    side.innerHTML = `<div class="card online"><h3>Online game ${onlineCode()}</h3>
      <p>Friends join with the code <b class="code">${onlineCode()}</b> or this link:</p>
      <div class="invite"><input id="invl" readonly value="${inviteLink(onlineCode())}"><button id="invc">Copy</button></div>
      <p class="small">${partySize()} in the party. Now press <b>Continue</b> or <b>New Character</b>: everyone starts together in Driftwood Landing. Press <kbd>Enter</kbd> in game to chat.</p>
      <button id="oleave">Leave online game</button></div>`;
    $('invc').onclick = () => { $('invl').select(); navigator.clipboard?.writeText($('invl').value); $('invc').textContent = 'Copied'; };
    $('oleave').onclick = () => { leaveOnline(); title(); };
    return;
  }
  side.innerHTML = `<div class="card online"><h3>Play Online</h3>
    <p>Play the island together. One player hosts and sends the code or link; up to 7 friends join. You start in the same town, see each other, chat, fight the same enemies and share experience.</p>
    <button id="ohost" class="primary">Host online game</button>
    <div class="joinrow"><input id="ocode" maxlength="4" placeholder="CODE" value="${code}"><button id="ojoin">Join</button></div>
    <p id="ostat" class="small"></p></div>`;
  const stat = m => { $('ostat').textContent = m; };
  const done = r => { if (r.error) stat(r.error); else { title(); onlinePanel(); } };
  $('ohost').onclick = () => { stat('Creating your game…'); hostGame(done); };
  $('ojoin').onclick = () => { const c = $('ocode').value.toUpperCase().replace(/[^A-Z]/g, ''); if (c.length !== 4) { stat('Enter the 4-letter code.'); return; } stat(`Joining ${c}…`); joinGame(c, done); };
  if (code) stat(`You're invited to game ${code}. Press Join.`);
}

export function controlsHtml() {
  return `<h3>Controls</h3><table class="keys">
    <tr><td>Mouse</td><td>Look and aim</td><td>WASD</td><td>Move</td></tr>
    <tr><td>Left click</td><td>Light attack · hold for heavy · bow: hold to draw</td><td>Right click</td><td>Block</td></tr>
    <tr><td>Shift</td><td>Dodge (roll length depends on armor weight)</td><td>Space</td><td>Jump</td></tr>
    <tr><td>1 2 3</td><td>Weapon abilities</td><td>F</td><td>Class ability</td></tr>
    <tr><td>Q</td><td>Swap weapon</td><td>K</td><td>Abilities</td></tr>
    <tr><td>R / T</td><td>Potion / Eat</td><td>E</td><td>Interact, gather, skin</td></tr>
    <tr><td>H</td><td>Recall to town</td><td>Tab</td><td>Map</td></tr>
    <tr><td>Wheel</td><td>Zoom (all the way in for first person)</td><td>F11</td><td>Full screen</td></tr>
    <tr><td>I</td><td>Inventory</td><td>P</td><td>Character</td></tr>
    <tr><td>C</td><td>Character</td><td>J</td><td>Journal</td></tr>
    <tr><td>M</td><td>Map</td><td>Esc</td><td>Menu</td></tr></table>`;
}
export function settingsHtml() {
  return `<div class="card settings"><h3>Settings</h3>
    <label>Mouse sensitivity <input type="range" data-s="sens" min="0.2" max="3" step="0.05" value="${S.sens}"><output>${S.sens.toFixed(2)}</output></label>
    <label>Field of view <input type="range" data-s="fov" min="60" max="100" step="1" value="${S.fov}"><output>${S.fov}</output></label>
    <label>Volume <input type="range" data-s="volume" min="0" max="1" step="0.05" value="${S.volume}"><output>${Math.round(S.volume * 100)}%</output></label>
    <label>Music <input type="range" data-s="music" min="0" max="1" step="0.05" value="${S.music ?? 0.5}"><output>${Math.round((S.music ?? 0.5) * 100)}%</output></label>
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
      if (out) out.textContent = k === 'volume' || k === 'music' ? Math.round(v * 100) + '%' : k === 'sens' ? v.toFixed(2) : v;
      if (k === 'fov') { camera.fov = v; camera.updateProjectionMatrix(); }
      if (k === 'volume') setVolume(v);
      if (k === 'music') setMusicVolume(v);
      if (k === 'view') G.setView(v);
      saveSettings();
    };
  });
}

// ---------- Character creator ----------
const draft = { name: '', cls: 'warrior', look: { model: 'barbarian', sex: 'm', skin: SKIN_TONES[2], hair: HAIR_COLORS[2], eyeColor: EYE_COLORS[0], hairStyle: 0, facialHair: 0, paint: null, scar: false } };
for (const [k, , , , d] of [...BODY_SLIDERS, ...FACE_SLIDERS]) draft.look[k] = d;
let previewQueued = false, previewZoom = 1;
let preview = null, previewYaw = 0, previewView = 'body', creatorTab = 'class';
const PREVIEW_AT = { x: 3, z: 24 };
function buildPreview() {
  if (preview) scene.remove(preview.root);
  const C = CLASSES[draft.cls];
  preview = makeCharacter({ look: draft.look });
  dressHumanoid(preview, { chest: 0x7a6a52, legs: 0x4a3e30, feet: 0x2a2018, helm: null, trim: C.color }); // the creator shows the person, not the gear
  preview.root.position.set(PREVIEW_AT.x, heightAt(PREVIEW_AT.x, PREVIEW_AT.z), PREVIEW_AT.z);
  armCharacter(preview, { wtype: C.weapon, tier: 1, model: C.model, shield: C.shield }, null);
  preview.root.position.set(PREVIEW_AT.x, heightAt(PREVIEW_AT.x, PREVIEW_AT.z), PREVIEW_AT.z);
  scene.add(preview.root);
}
const sw = (list, key) => list.map(c => `<button class="sw ${draft.look[key] === c ? 'on' : ''}" data-sw="${key}" data-v="${c}" style="background:#${c.toString(16).padStart(6, '0')}"></button>`).join('');
const sliders = list => list.map(([k, label, mn, mx]) => `<label class="sl"><span>${label}</span><input type="range" min="${mn}" max="${mx}" step="0.01" value="${draft.look[k]}" data-sl="${k}"></label>`).join('');
function creator() {
  G.mode = 'create';
  buildPreview();
  const t = $('title');
  const C = CLASSES[draft.cls], L = draft.look;
  const attrs = { str: 5, dex: 5, int: 5, con: 5 };
  for (const k in C.attrs) attrs[k] += C.attrs[k];
  let body = '';
  if (creatorTab === 'class') {
    body = `<div class="cards c16">${CLASS_LIST.map(k => { const c = CLASSES[k]; return `<button class="ccard ${k === draft.cls ? 'on' : ''}" data-cls="${k}"><span>${c.icon}</span><b>${c.name}</b><small>${c.role}</small></button>`; }).join('')}</div>
      <div class="cinfo"><h3>${C.icon} ${C.name} <small>${C.role}</small></h3><p class="cdesc">${C.desc}</p>
      <p class="small">Starts with: <b>${C.model && WEAPON_MODELS[C.model] ? WEAPON_MODELS[C.model].name : WEAPONS[C.weapon].name}</b> (${WEAPONS[C.weapon].name}), ${C.armor} armor. ${C.start2 ? `Also carries a ${WEAPONS[C.second].name.toLowerCase()}.` : `Gets a ${WEAPONS[C.second].name.toLowerCase()} from the first quest.`}</p>
      <div class="trees3">${C.trees.map(tr => `<div><b>${tr.icon} ${tr.name}</b><small>${tr.desc}</small><ul>${tr.nodes.filter(n => n.type === 'active').map(n => `<li>${n.icon} ${n.name}</li>`).join('')}</ul></div>`).join('')}</div>
      <div class="cattrs">${['str', 'dex', 'int', 'con'].map(k => `<span>${{ str: 'Strength', dex: 'Dexterity', int: 'Intelligence', con: 'Constitution' }[k]} <b>${attrs[k]}</b></span>`).join('')}</div></div>`;
  } else if (creatorTab === 'body') {
    body = `${meshyReady() ? `<div class="look"><span>Hero</span><button class="hs ${L.model === 'barbarian' ? 'on' : ''}" data-model="barbarian">Sculpted barbarian</button><button class="hs ${L.model !== 'barbarian' ? 'on' : ''}" data-model="custom">Custom (sliders)</button></div>` : ''}
      <div class="look"><span>Sex</span><button class="hs ${L.sex === 'm' ? 'on' : ''}" data-sex="m">Male</button><button class="hs ${L.sex === 'f' ? 'on' : ''}" data-sex="f">Female</button></div>
      ${sliders(L.model === 'barbarian' ? BODY_SLIDERS.filter(b => b[0] !== 'headSize') : BODY_SLIDERS)}
      ${L.model === 'barbarian' ? `<p class="small">The barbarian's skin, face and hair are painted into his model. Pick <b>Custom</b> to choose skin tone, face and hair.</p>` : `<div class="look"><span>Skin</span>${sw(SKIN_TONES, 'skin')}</div>`}`;
  } else {
    if (L.model === 'barbarian') body = `<p class="cdesc">The barbarian's face, hair and beard are sculpted into his model, so they can't be restyled here. New looks (other hairstyles, beards, faces, a female hero) come as their own Meshy models: send them and they appear as choices on the Body tab.</p>`;
    else body = `${sliders(FACE_SLIDERS)}
      <div class="look"><span>Eyes</span>${sw(EYE_COLORS, 'eyeColor')}</div>
      <div class="look"><span>Hair</span>${sw(HAIR_COLORS, 'hair')}</div>
      <div class="look"><span>Style</span>${HAIR_STYLES.map((h, i) => `<button class="hs ${L.hairStyle === i ? 'on' : ''}" data-hs="${i}">${h}</button>`).join('')}</div>
      <div class="look"><span>Facial hair</span>${FACIAL_HAIR.map((h, i) => `<button class="hs ${L.facialHair === i ? 'on' : ''}" data-fh="${i}">${h}</button>`).join('')}</div>
      <div class="look"><span>War paint</span>${WAR_PAINT.map(([n, c]) => `<button class="hs ${L.paint === c ? 'on' : ''}" data-paint="${c}">${n}</button>`).join('')}</div>
      <div class="look"><span>Scar</span><button class="hs ${L.scar ? 'on' : ''}" data-scar="1">Yes</button><button class="hs ${!L.scar ? 'on' : ''}" data-scar="0">No</button></div>`;
  }
  t.innerHTML = `<div class="creator">
    <div class="cpanel">
      <h2>Create your character</h2>
      <label class="nm">Name <input id="cname" maxlength="18" placeholder="Castaway" value="${esc(draft.name)}"></label>
      <div class="tabs ctabs">${[['class', 'Class'], ['body', 'Body'], ['face', 'Face & Hair']].map(([k, n]) => `<button class="${creatorTab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}<button id="crand" class="right">🎲 Random look</button></div>
      ${body}
      <div class="row"><button id="cback">Back</button><button id="cgo" class="primary">Begin your journey</button></div>
    </div>
    <div class="chint">Drag to turn your character · Mouse wheel to zoom</div></div>`;
  t.style.display = 'block';
  $('cname').oninput = e => { draft.name = e.target.value; };
  t.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { creatorTab = b.dataset.tab; previewView = creatorTab === 'face' ? 'face' : 'body'; creator(); });
  t.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { draft.cls = b.dataset.cls; creator(); });
  t.querySelectorAll('[data-model]').forEach(b => b.onclick = () => { L.model = b.dataset.model; if (L.model === 'barbarian') L.sex = 'm'; creator(); });
  t.querySelectorAll('[data-sex]').forEach(b => b.onclick = () => { L.sex = b.dataset.sex; if (L.sex === 'f') L.model = 'custom'; if (L.sex === 'f') { L.facialHair = 0; if (L.hairStyle === 0 || L.hairStyle === 3) L.hairStyle = 1; } creator(); });
  t.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => { L[b.dataset.sw] = +b.dataset.v; creator(); });
  t.querySelectorAll('[data-hs]').forEach(b => b.onclick = () => { L.hairStyle = +b.dataset.hs; creator(); });
  t.querySelectorAll('[data-fh]').forEach(b => b.onclick = () => { L.facialHair = +b.dataset.fh; creator(); });
  t.querySelectorAll('[data-paint]').forEach(b => b.onclick = () => { L.paint = b.dataset.paint === 'null' ? null : +b.dataset.paint; creator(); });
  t.querySelectorAll('[data-scar]').forEach(b => b.onclick = () => { L.scar = b.dataset.scar === '1'; creator(); });
  // sliders rebuild only the 3D preview so dragging stays smooth
  t.querySelectorAll('[data-sl]').forEach(r => r.oninput = () => { L[r.dataset.sl] = +r.value; if (!previewQueued) { previewQueued = true; requestAnimationFrame(() => { previewQueued = false; if (G.mode === 'create') buildPreview(); }); } });
  $('crand').onclick = () => {
    const pk = a => a[Math.floor(Math.random() * a.length)];
    for (const [k, , mn, mx] of [...BODY_SLIDERS, ...FACE_SLIDERS]) L[k] = +(mn + Math.random() * (mx - mn)).toFixed(2);
    L.skin = pk(SKIN_TONES); L.hair = pk(HAIR_COLORS); L.eyeColor = pk(EYE_COLORS); L.hairStyle = Math.floor(Math.random() * HAIR_STYLES.length);
    L.facialHair = L.sex === 'f' ? 0 : Math.floor(Math.random() * FACIAL_HAIR.length); L.paint = Math.random() < 0.25 ? pk(WAR_PAINT.slice(1))[1] : null; L.scar = Math.random() < 0.2;
    creator();
  };
  $('cback').onclick = () => { if (preview) { scene.remove(preview.root); preview = null; } title(); };
  $('cgo').onclick = () => {
    const C2 = CLASSES[draft.cls];
    const p = newProfile(C2.weapon, 'human', draft.cls, { ...draft.look }, draft.name.trim() || 'Castaway');
    G.p = p;
    p.equip.w1 = makeGear({ kind: 'weapon', wtype: C2.weapon, gs: 100, rarity: 0 });
    if (C2.model) p.equip.w1.model = C2.model;
    if (C2.model && WEAPON_MODELS[C2.model]) { p.equip.w1.model = C2.model; p.equip.w1.name = WEAPON_MODELS[C2.model].name; }
    if (C2.shield) p.equip.w1.shield = C2.shield;
    if (C2.start2) { p.equip.w2 = makeGear({ kind: 'weapon', wtype: C2.second, gs: 100, rarity: 0 }); if (C2.model2) p.equip.w2.model = C2.model2; }
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
const OLD_CLASSES = { knight: 'warrior', berserker: 'berserker', vanguard: 'paladin', ranger: 'ranger' };
function enterGame(profile) {
  G.p = profile;
  // older saves: map the first classes onto the new list, add the staff mastery
  if (!CLASSES[profile.cls]) profile.cls = OLD_CLASSES[profile.cls] || ({ sword: 'warrior', greataxe: 'berserker', hammer: 'paladin', bow: 'ranger' })[profile.startWeapon] || 'warrior';
  for (const w of Object.keys(WEAPONS)) if (!profile.mastery[w]) profile.mastery[w] = { lv: 1, xp: 0, nodes: [], slots: [null, null, null] };
  if (!profile.look || !profile.look.sex) profile.look = { sex: 'm', ...(profile.look || {}) };
  ensureSkills(profile);
  if (online()) { const a = Math.random() * 6.28; profile.pos = [TOWN_SPAWN.x + Math.cos(a) * 2.5, TOWN_SPAWN.z + Math.sin(a) * 2.5]; } // the party starts together in town
  $('title').style.display = 'none';
  if (S.autoFS && !document.fullscreenElement) toggleFullscreen();
  createPlayer();
  initUI();
  fillBounties();
  refreshHud(); refreshTracker();
  $('hud').style.display = 'block';
  G.mode = 'game'; G.started = true; G.paused = false;
  G.relock();
  initChat(); hello();
  if (online()) setTimeout(() => toast(`Online game <b>${onlineCode()}</b>: ${partySize()} in the party. Press <kbd>Enter</kbd> to chat.`, 'gold'), 1500);
  if (profile.story.step === 0) setTimeout(() => toast(`Welcome to Aeternum, ${esc(profile.name || 'Castaway')}. Captain Thorne is waiting by the flag. Walk up to him and press <kbd>E</kbd>.`, 'gold'), 800);
  if (profile.skills.points > 0) setTimeout(() => toast(`You have ${profile.skills.points} skill point${profile.skills.points > 1 ? 's' : ''}. Press <kbd>K</kbd> to see your abilities.`, 'gold'), 2500);
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
  tickOnline(dt);
  if (G.mode === 'game') {
    G.paused = !!G.ui.open || (!G.locked && P.state !== 'dead' && !G.noLockNeeded);
    $('resume').style.display = !G.locked && !G.ui.open && P.state !== 'dead' && !G.noLockNeeded ? 'flex' : 'none';
    // hit-stop: freeze the action for a few frames on big hits
    let simDt = dt;
    if (G.hitstop > 0) { G.hitstop -= dt; simDt = dt * 0.08; }
    if (!G.paused) {
      const dt = simDt;
      G.time += dt;
      G.p.stats.playTime += dt;
      updatePlayer(dt);
      updateSkills(dt);
      updatePets(dt, spellPower);
      updateCamps(dt);
      updateEnemies(dt);
      updateProjectiles(dt);
      updateFx(dt);
      updateSpellFx(dt);
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
    // aiming down a bow (and later crossbows, muskets, blunderbusses): hold right-click to zoom
    const wt = G.p.equip[G.p.activeW ? 'w2' : 'w1']?.wtype;
    const wantZoom = ZOOM_WEAPONS.has(wt) && inp.rmb && P.state !== 'dead' && P.state !== 'dodge' && !G.paused;
    G.zoomK = (G.zoomK || 0) + ((wantZoom ? 1 : 0) - (G.zoomK || 0)) * Math.min(1, dt * 10);
    const fov = S.fov * (1 - 0.52 * G.zoomK);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
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
      const sh = Math.min(1, camDist / 3.6) * 0.95 + 0.25 * G.zoomK; // shoulder offset to the right
      const cd = camDist * (1 - 0.45 * G.zoomK);
      let cx = P.pos.x - fx * cd + rx * sh, cy = P.y + (P.jumpY || 0) + 1.8 * (P.h.size || 1) - fy * cd + 0.15, cz = P.pos.z - fz * cd + rz * sh;
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
      carryWeapon(preview, null, 1);
      preview.body.position.y = Math.sin(t * 2) * 0.01;
      const H = preview.tallW || 2;
      if (previewView === 'face') { const hy = py + H * 0.9; camera.position.set(px - 0.42, hy, pz + 1.35); camera.lookAt(px - 0.42, hy - 0.03, pz); }
      else { const k = H / 2 * previewZoom, up = (1 - previewZoom) * 0.3; camera.position.set(px - 1.7 * k, py + (0.75 + up) * H, pz + 5.2 * k); camera.lookAt(px - 1.7 * k, py + (0.5 + up) * H, pz); }
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
  updateLife(dt, t, G.mode === 'game' && !G.paused);
  musicT -= dt; if (musicT <= 0) { musicT = 0.5; updateMusic(); }
  if (G.mode === 'game') updateTrail();
  if (composer) composer.render(); else renderer.render(scene, camera);
  if (G.mode === 'game' && camDist < 0.3) { vmCam.fov = 58; renderViewmodel(renderer, dt); }
}

// ---------- Music and ambience follow what's happening ----------
let musicT = 0, calmT = 0;
function updateMusic() {
  if (G.mode !== 'game') { setMusic('title'); setAmbience({ zone: 'meadow', night: false, inTown: false }); return; }
  const P = G.player, zn = zoneAt(P.pos.x, P.pos.z), night = (G.night || 0) > 0.55;
  setMusicZone(zn);
  setAmbience({ zone: zn, night, inTown: zn === 'town' });
  const fighting = G.enemies.some(e => !e.dead && e.aggro && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 28);
  if (G.boss && !G.boss.dead) { setMusic('boss'); calmT = 6; return; }
  if (fighting) { setMusic('combat'); calmT = 5; return; }
  if (calmT > 0) { calmT -= 0.5; if (calmT <= 0) setMusic('victory'); return; }
  setMusic(zn === 'town' ? 'town' : night ? 'night' : 'explore');
}
G.setMusicVolume = setMusicVolume;

// ---------- Boot: build the island behind the home screen ----------
$('resume').onclick = () => G.relock();
setTimeout(async () => {
  await Promise.all([loadMeshy(), loadHeroRig(), loadCreatures(), loadSpellModel(), loadFxModels()]);
  buildWorld();
  buildLife();
  $('loading').style.display = 'none';
  title();
  clock.getDelta();
  requestAnimationFrame(loop);
}, 30);

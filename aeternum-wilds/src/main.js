import * as THREE from 'three';
import { G, SAVE_KEY, newProfile } from './state.js';
import { ZONES, WEAPONS, HAIR_STYLES, ARMOR_SLOTS, SKIN_TONES, HAIR_COLORS, EYE_COLORS, FACIAL_HAIR, WAR_PAINT, BODY_SLIDERS, FACE_SLIDERS } from './data.js';
import { CLASSES, CLASS_LIST } from './classes.js';
import { ensureSkills, castSkill, updateSkills, spellPower } from './skills.js';
import { updatePets, clearPets } from './pets.js';
import { buildWorld, heightAt, zoneAt, updateWorld } from './world.js';
import { createPlayer, updatePlayer, updateProjectiles, useAbility, swapWeapon, usePotion, eatFood, startRecall, startGather, startDodge, jump, makeCharacter, TOWN_SPAWN } from './player.js';
import { updateEnemies, updateCamps, removeEnemy, enemiesNear } from './enemies.js';
import { updateFx, shakeOffset } from './fx.js';
import { initUI, updateHud, setPrompt, togglePanel, closePanel, talkTo, openPanel, refreshHud, refreshTracker, toast } from './ui.js';
import { makeGear } from './items.js';
import { fillBounties } from './quests.js';
import { initAudio, setVolume, setMusic, setMusicZone, setAmbience, setMusicVolume } from './audio.js';
import { dressHumanoid, makeWeapon } from './models.js';
import { animHumanoid } from './anim.js';
import { renderViewmodel, vmLook, vmCam } from './viewmodel.js';
import { updateSpellFx } from './spellfx.js';
import { buildLife, updateLife } from './life.js';
import { U, initEnv } from './gfx/env/shared.js';
import { initSky, updateSky as updateSkyGfx, SKY } from './gfx/env/sky.js';
import { buildComposer, resizeComposer, updatePost, renderFrame } from './gfx/env/post.js';
import { buildFires, updateFires } from './gfx/env/fire.js';
import { mats as envMats } from './gfx/env/mats.js';
import { sectorWeights } from './world.js';
import { esc, clamp, lerp } from './util.js';

const $ = id => document.getElementById(id);

// ---------- Settings ----------
const SET_KEY = 'aeternum-wilds-settings';
const S = Object.assign({ sens: 1, fov: 70, quality: 'medium', volume: 0.6, invertY: false, autoFS: true, view: 'third' }, (() => { try { return JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch (e) { return {}; } })());
if (S.v !== 2) { S.v = 2; S.view = 'third'; } // the game now plays over the shoulder by default
// graphics levels; 'superultra' is a joke option that falls back to ultra
// ratio: pixel ratio cap; shadows: sun shadow map size (0 none); shadowBox: half size of the shadowed area (m);
// shadowEvery: redraw shadows every n frames; grass: density of the grass field; texSize: generated texture size;
// msaa: multisampling (else FXAA); ao: ground-contact ambient occlusion; tree*: tree detail bands (m);
// lights: real flickering point lights; detailMul: draw distance of small scenery; fogMul: haze density
const ULTRA = { name: 'Ultra', ratio: 1.5, shadows: 4096, shadowBox: 64, shadowEvery: 1, shadowRadius: 2, grass: 1.4, seg: 400, view: 1.35, aa: true, post: true, texSize: 1024, msaa: 4, ao: true, bloom: true, bloomDiv: 2, treeShadow: 56, treeNear: 100, treeMid: 260, treeFar: 480, lights: 8, cloudOct: 6, waterSeg: 192, terrainLod: 0, detailMul: 1.35, fogMul: 0.9, aniso: 16, softShadows: true };
export const QUALITY = {
  low: { name: 'Low', ratio: 0.85, shadows: 0, shadowBox: 30, grass: 0, seg: 220, view: 0.7, aa: true, post: false, texSize: 256, msaa: 0, bloom: false, treeShadow: 0, treeNear: 0, treeMid: 70, treeFar: 210, lights: 2, cloudOct: 3, waterSeg: 64, terrainLod: 1, detailMul: 0.55, fogMul: 1.4, env: false, aniso: 2 },
  medium: { name: 'Medium', ratio: 1, shadows: 1024, shadowBox: 32, shadowEvery: 2, grass: 0.6, seg: 300, view: 1, aa: true, post: true, texSize: 512, msaa: 0, bloom: true, bloomDiv: 4, treeShadow: 26, treeNear: 45, treeMid: 140, treeFar: 290, lights: 3, cloudOct: 4, waterSeg: 96, terrainLod: 0.3, detailMul: 0.8, fogMul: 1.1, aniso: 4 },
  high: { name: 'High', ratio: 1.25, shadows: 2048, shadowBox: 46, shadowEvery: 1, grass: 1, seg: 330, view: 1.15, aa: true, post: true, texSize: 1024, msaa: 0, bloom: true, bloomDiv: 3, treeShadow: 40, treeNear: 70, treeMid: 200, treeFar: 380, lights: 5, cloudOct: 5, waterSeg: 128, terrainLod: 0, detailMul: 1, fogMul: 1, aniso: 8, softShadows: true },
  ultra: ULTRA,
  superultra: Object.assign({}, ULTRA, { name: 'Super Ultra' }),
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
// Low draws straight to the screen (the browser's own antialiasing); the other levels render into a half-float
// buffer and post-process it (gfx/env/post.js: bloom, filmic tone mapping, FXAA or MSAA, colour grade, GTAO on Ultra)
const renderer = new THREE.WebGLRenderer({ antialias: G.Q.post === false, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, G.Q.ratio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = G.Q.shadows > 0;
renderer.shadowMap.type = G.Q.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false; // redrawn when the sun's shadow box moves (gfx/env/sky.js)
renderer.outputColorSpace = THREE.SRGBColorSpace;
// filmic tone mapping keeps bright fire, magic and the sun from clipping to flat white
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.info.autoReset = false; // whole-frame totals across every pass: G.frameInfo
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(S.fov, innerWidth / innerHeight, 0.08, 2600);
camera.rotation.order = 'YXZ';
G.scene = scene; G.camera = camera; G.renderer = renderer;
window.G = G; // handy for debugging from the console
initEnv(renderer, scene, camera, G.Q);
initSky();
G.light = { hemi: 1.0, sun: 3.0, sunColor: new THREE.Color(0xfff0d8) };
G.frameInfo = { calls: 0, tris: 0 };
buildComposer();
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); resizeComposer(); });

// ---------- Weapon swing trails ----------
const TRAIL_N = 14;
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2 * 3), 3));
trailGeo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2), 1));
{ const idx = []; for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(idx); }
const trailMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  uniforms: { color: { value: new THREE.Color(0xfff0d0) } },
  vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 color; varying float vA; void main(){ gl_FragColor = vec4(color * vA, vA); }',
});
const trail = new THREE.Mesh(trailGeo, trailMat); trail.frustumCulled = false; scene.add(trail);
const trailPts = [];
const TIP = { sword: 1.05, greataxe: 1.4, hammer: 1.3, staff: 1.5 };
const vTip = new THREE.Vector3(), vBase = new THREE.Vector3();
function updateTrail() {
  const P = G.player;
  const swinging = P && (P.state === 'attack' || (P.state === 'ability' && P.ability?.pose !== 'cast') || P.whirl) && P.wR && camDist > 0.3;
  if (swinging) {
    const wt = G.p.equip[G.p.activeW ? 'w2' : 'w1']?.wtype;
    P.wR.updateMatrixWorld(true);
    vTip.set(0, TIP[wt] || 1.1, 0); P.wR.localToWorld(vTip);
    vBase.set(0, (TIP[wt] || 1.1) * 0.45, 0); P.wR.localToWorld(vBase);
    trailPts.unshift([vTip.clone(), vBase.clone()]);
    const el = P.whirl?.el; trailMat.uniforms.color.value.setHex(el ? 0xffc890 : P.atk?.kind === 'heavy' ? 0xffd890 : 0xfff4e0);
  } else trailPts.unshift(null);
  if (trailPts.length > TRAIL_N) trailPts.length = TRAIL_N;
  const pos = trailGeo.attributes.position.array, al = trailGeo.attributes.alpha.array;
  let last = null;
  for (let i = 0; i < TRAIL_N; i++) {
    const p = trailPts[i] || last;
    if (trailPts[i]) last = trailPts[i];
    const [a, b] = p || [vTip, vTip];
    pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    const k = trailPts[i] ? (1 - i / TRAIL_N) * 0.55 : 0;
    al[i * 2] = k; al[i * 2 + 1] = 0;
  }
  trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.alpha.needsUpdate = true;
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
  const panels = { KeyI: 'inventory', KeyP: 'character', KeyT: 'skills', KeyK: 'mastery', KeyJ: 'quests', KeyL: 'quests', KeyM: 'map', Tab: 'map' };
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
    case 'KeyZ': castSkill(0); break;
    case 'KeyX': castSkill(1); break;
    case 'KeyC': if (e.shiftKey) togglePanel('character'); else castSkill(2); break;
    case 'KeyV': castSkill(3); break;
    case 'KeyB': castSkill(4); break;
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
// dayT: 0.25 sunrise, 0.5 noon, 0.75 sunset, 0.95 deep night. A full day takes about 24 minutes, but the clock
// runs slowly while the sun is up and quickly through the night, so most of the playing time is daylight.
const DAY_LEN = 24 * 60;
const dayRate = (t) => (t > 0.23 && t < 0.77 ? 0.62 : 2.6);
const zoneW = {};
function updateSky(dt, center) {
  if (G.mode === 'game' && G.p) { G.p.dayT = ((G.p.dayT ?? 0.32) + dt / DAY_LEN * dayRate(G.p.dayT ?? 0.32)) % 1; }
  const dayT = G.mode === 'game' && G.p ? G.p.dayT : 0.37;
  const cp = camera.position;
  Object.assign(zoneW, sectorWeights(cp.x, cp.z));
  const s = updateSkyGfx(dt, dayT, cp, center, zoneW);
  G.light.sun = SKY.sun.intensity; G.light.hemi = SKY.hemi.intensity; G.light.sunColor.copy(SKY.sun.color);
  G.night = 1 - s.dayK;
  const dark = Math.max(G.night, s.duskK * 0.4);
  envMats.setNight(Math.max(0, Math.min(1, (dark - 0.2) / 0.5)));
  updateFires(dt, performance.now() / 1000, cp, dark);
  updatePost(performance.now() / 1000, G.night, zoneW);
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
    <tr><td>Z X C V</td><td>Class skills</td><td>T</td><td>Class skill trees</td></tr>
    <tr><td>I</td><td>Inventory</td><td>P</td><td>Character</td></tr>
    <tr><td>K</td><td>Mastery</td><td>J</td><td>Journal</td></tr>
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
const draft = { name: '', cls: 'warrior', look: { sex: 'm', skin: SKIN_TONES[2], hair: HAIR_COLORS[2], eyeColor: EYE_COLORS[0], hairStyle: 0, facialHair: 0, paint: null, scar: false } };
for (const [k, , , , d] of [...BODY_SLIDERS, ...FACE_SLIDERS]) draft.look[k] = d;
let preview = null, previewYaw = 0, previewView = 'body', creatorTab = 'class';
const PREVIEW_AT = { x: 3, z: 24 };
function buildPreview() {
  if (preview) scene.remove(preview.root);
  const C = CLASSES[draft.cls];
  preview = makeCharacter({ look: draft.look });
  const cols = { light: [0x9a9270, 0x7a7258, 0x4a4030], medium: [0x6a4a2a, 0x4a3420, 0x3a2a1a], heavy: [0x8a8a90, 0x6a6a70, 0x4a4a50] }[C.armor];
  dressHumanoid(preview, { chest: C.gear.includes('chest') ? cols[0] : 0x7a6a52, legs: C.gear.includes('legs') ? cols[1] : 0x4a3e30, feet: cols[2], helm: C.gear.includes('head') && previewView === 'body' ? cols[0] : null, helmTier: C.armor === 'heavy' ? 2 : 1, trim: C.color });
  const wt = C.weapon;
  if (wt === 'bow') { const b = makeWeapon('bow', 1); b.scale.setScalar(1.25); preview.parts.handL.add(b); }
  else { const w = makeWeapon(wt, 1); w.scale.setScalar(1.45); preview.parts.handR.add(w); if (wt === 'sword') { const sh = makeWeapon('shield', 1); sh.scale.setScalar(1.25); sh.position.set(0.14, 0.05, 0.15); sh.rotation.y = Math.PI / 2; preview.parts.handL.add(sh); } }
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
      <p class="small">Starts with: <b>${WEAPONS[C.weapon].name}</b>, ${C.armor} armor. Gets a ${WEAPONS[C.second].name.toLowerCase()} from the first quest.</p>
      <div class="trees3">${C.trees.map(tr => `<div><b>${tr.icon} ${tr.name}</b><small>${tr.desc}</small><ul>${tr.nodes.filter(n => n.type === 'active').map(n => `<li>${n.icon} ${n.name}</li>`).join('')}</ul></div>`).join('')}</div>
      <div class="cattrs">${['str', 'dex', 'int', 'con'].map(k => `<span>${{ str: 'Strength', dex: 'Dexterity', int: 'Intelligence', con: 'Constitution' }[k]} <b>${attrs[k]}</b></span>`).join('')}</div></div>`;
  } else if (creatorTab === 'body') {
    body = `<div class="look"><span>Sex</span><button class="hs ${L.sex === 'm' ? 'on' : ''}" data-sex="m">Male</button><button class="hs ${L.sex === 'f' ? 'on' : ''}" data-sex="f">Female</button></div>
      ${sliders(BODY_SLIDERS)}
      <div class="look"><span>Skin</span>${sw(SKIN_TONES, 'skin')}</div>`;
  } else {
    body = `${sliders(FACE_SLIDERS)}
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
    <div class="chint">Drag to turn your character</div></div>`;
  t.style.display = 'block';
  $('cname').oninput = e => { draft.name = e.target.value; };
  t.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { creatorTab = b.dataset.tab; previewView = creatorTab === 'face' ? 'face' : 'body'; creator(); });
  t.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { draft.cls = b.dataset.cls; creator(); });
  t.querySelectorAll('[data-sex]').forEach(b => b.onclick = () => { L.sex = b.dataset.sex; if (L.sex === 'f') { L.facialHair = 0; if (L.hairStyle === 0 || L.hairStyle === 3) L.hairStyle = 1; } creator(); });
  t.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => { L[b.dataset.sw] = +b.dataset.v; creator(); });
  t.querySelectorAll('[data-hs]').forEach(b => b.onclick = () => { L.hairStyle = +b.dataset.hs; creator(); });
  t.querySelectorAll('[data-fh]').forEach(b => b.onclick = () => { L.facialHair = +b.dataset.fh; creator(); });
  t.querySelectorAll('[data-paint]').forEach(b => b.onclick = () => { L.paint = b.dataset.paint === 'null' ? null : +b.dataset.paint; creator(); });
  t.querySelectorAll('[data-scar]').forEach(b => b.onclick = () => { L.scar = b.dataset.scar === '1'; creator(); });
  // sliders rebuild only the 3D preview so dragging stays smooth
  t.querySelectorAll('[data-sl]').forEach(r => r.oninput = () => { L[r.dataset.sl] = +r.value; buildPreview(); });
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
  if (profile.skills.points > 0) setTimeout(() => toast(`You have ${profile.skills.points} skill point${profile.skills.points > 1 ? 's' : ''}. Press <kbd>T</kbd> to open your ${CLASSES[profile.cls].name} skill trees.`, 'gold'), 2500);
}

// ---------- Loop ----------
const clock = new THREE.Clock();
let cullT = 0, saveT = 20, promptT = 0, aimT = 0, eyeBob = 0;
const center = new THREE.Vector3();
// G.renderHold pauses the loop and G.snap(frames, dt) steps it by hand and returns the picture (for tests:
// software rendering is too slow to keep a live loop running while screenshots are taken)
G.snap = (frames = 1, step = 0.1, type = 'image/png') => { for (let i = 0; i < frames; i++) frame(step, performance.now() / 1000); return type ? renderer.domElement.toDataURL(type) : null; };
function loop() {
  requestAnimationFrame(loop);
  const dt0 = clock.getDelta();
  if (G.renderHold) return;
  frame(Math.min(G.maxDt || 0.05, dt0), performance.now() / 1000);
}
function frame(dt, t) {
  const P = G.player;
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
    updateHud(dt);
  } else {
    // home screen fly-over or character preview
    if (G.mode === 'create' && preview) {
      const px = PREVIEW_AT.x, pz = PREVIEW_AT.z, py = heightAt(px, pz);
      preview.root.rotation.y = previewYaw;
      animHumanoid(preview, { move: 0, phase: t, pose: null });
      preview.body.position.y = Math.sin(t * 2) * 0.01;
      if (previewView === 'face') { const hy = py + 2.0 * (draft.look.height || 1); camera.position.set(px - 0.42, hy, pz + 1.35); camera.lookAt(px - 0.42, hy - 0.03, pz); }
      else { camera.position.set(px - 1.7, py + 1.5, pz + 5.2); camera.lookAt(px - 1.7, py + 1.0, pz); }
      center.set(px, py, pz);
    } else {
      // home screen: a slow flight round the island, over the meadows, the town and the coast
      const a = t * 0.022 + 0.6;
      const r = 82 + Math.sin(t * 0.05) * 14;
      camera.position.set(Math.cos(a) * r, 26 + Math.sin(t * 0.08) * 5, Math.sin(a) * r);
      camera.position.y = Math.max(camera.position.y, heightAt(camera.position.x, camera.position.z) + 12);
      camera.lookAt(Math.cos(a + 1.05) * 30, 6, Math.sin(a + 1.05) * 30);
      center.set(Math.cos(a + 0.5) * 55, 3, Math.sin(a + 0.5) * 55);
    }
    updateSky(dt, center);
    updateWorld(dt, center.x, center.z, t);
  }
  U.uTime.value = t;
  updateLife(dt, t, G.mode === 'game' && !G.paused);
  musicT -= dt; if (musicT <= 0) { musicT = 0.5; updateMusic(); }
  if (G.mode === 'game') updateTrail();
  renderer.info.reset();
  renderFrame();
  G.frameInfo.calls = renderer.info.render.calls; G.frameInfo.tris = renderer.info.render.triangles;
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
setTimeout(() => {
  buildWorld();
  buildFires();
  buildLife();
  $('loading').style.display = 'none';
  title();
  clock.getDelta();
  requestAnimationFrame(loop);
}, 30);

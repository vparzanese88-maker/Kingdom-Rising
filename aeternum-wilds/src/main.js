import * as THREE from 'three';
import { G, SAVE_KEY, newProfile } from './state.js';
import { ZONES, WEAPONS, NODES } from './data.js';
import { buildWorld, heightAt, zoneAt } from './world.js';
import { createPlayer, updatePlayer, updateProjectiles, useAbility, swapWeapon, usePotion, eatFood, startRecall, startGather, startDodge, refreshLook, TOWN_SPAWN } from './player.js';
import { updateEnemies, updateCamps, removeEnemy } from './enemies.js';
import { updateFx, shakeOffset } from './fx.js';
import { initUI, updateHud, setPrompt, togglePanel, closePanel, talkTo, openPanel, refreshHud, refreshTracker, toast } from './ui.js';
import { makeGear } from './items.js';
import { fillBounties } from './quests.js';
import { stats } from './stats.js';
import { initAudio, sfx } from './audio.js';
import { esc } from './util.js';

const $ = id => document.getElementById(id);

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const fogCol = new THREE.Color(ZONES.town.fog);
scene.fog = new THREE.Fog(fogCol, 70, 170);
scene.background = fogCol;
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.5, 400);
G.scene = scene; G.camera = camera; G.renderer = renderer;
window.G = G; // handy for debugging from the console

const hemi = new THREE.HemisphereLight(0xdfefff, 0x5a4a32, 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 140 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun); scene.add(sun.target);

addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// ---------- Input ----------
const inp = G.input;
let zoom = 1;
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
addEventListener('mousemove', e => { inp.mx = e.clientX; inp.my = e.clientY; });
renderer.domElement.addEventListener('mousedown', e => {
  initAudio();
  if (G.ui.open || G.paused) return;
  if (e.button === 0) inp.lmb = true;
  if (e.button === 2) inp.rmb = true;
  inp.overUI = false;
});
addEventListener('mouseup', e => { if (e.button === 0) inp.lmb = false; if (e.button === 2) inp.rmb = false; });
addEventListener('contextmenu', e => { if (e.target === renderer.domElement) e.preventDefault(); });
addEventListener('blur', () => { inp.keys = {}; inp.lmb = inp.rmb = false; });
renderer.domElement.addEventListener('wheel', e => { zoom = Math.min(1.45, Math.max(0.55, zoom + Math.sign(e.deltaY) * 0.08)); }, { passive: true });

addEventListener('keydown', e => {
  if (!G.started) return;
  if (e.target.tagName === 'INPUT') return;
  initAudio();
  const c = e.code;
  if (c === 'Escape') { if (G.ui.open) closePanel(); else openPanel('menu'); e.preventDefault(); return; }
  const panels = { KeyI: 'inventory', KeyC: 'character', KeyK: 'mastery', KeyL: 'quests', KeyM: 'map', Tab: 'map' };
  if (panels[c]) { e.preventDefault(); togglePanel(panels[c]); return; }
  if (G.ui.open) return;
  if (c === 'Space') e.preventDefault();
  if (e.repeat) return;
  inp.keys[c] = true;
  if (G.player.state === 'dead') return;
  switch (c) {
    case 'Space': startDodge(); break;
    case 'KeyQ': useAbility(0); break;
    case 'KeyR': useAbility(1); break;
    case 'KeyF': useAbility(2); break;
    case 'Digit1': swapWeapon(0); break;
    case 'Digit2': swapWeapon(1); break;
    case 'Digit3': usePotion(); break;
    case 'Digit4': eatFood(); break;
    case 'KeyH': startRecall(); break;
    case 'KeyE': interact(); break;
  }
});
addEventListener('keyup', e => { inp.keys[e.code] = false; });


// ---------- Interaction ----------
let near = null;
function findInteractable() {
  const P = G.player;
  let best = null, bd = 99;
  const consider = (o, r) => { const d = Math.hypot(o.x - P.pos.x, o.z - P.pos.z); if (d < r && d < bd) { bd = d; best = o; } };
  for (const n of G.npcs) consider(n, 3.2);
  for (const s of G.stations) consider(s, 3.6);
  for (const c of G.corpses) if (!c.skinned) consider(c, 2.6);
  for (const n of G.nodes) if (n.depleted <= 0 && Math.abs(n.x - P.pos.x) < 4 && Math.abs(n.z - P.pos.z) < 4) consider(n, n.def.skill === 'mining' ? 2.9 : 2.4);
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

// ---------- Save ----------
function saveGame() {
  if (!G.p || window.skipSave) return;
  G.p.pos = [G.player.pos.x, G.player.pos.z];
  if (zoneAt(G.player.pos.x, G.player.pos.z) !== 'town' && G.player.state === 'dead') G.p.pos = [TOWN_SPAWN.x, TOWN_SPAWN.z];
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.p)); } catch (e) { /* storage full or blocked */ }
}
window.saveGame = saveGame;
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.v === 1 ? s : null; } catch (e) { return null; } }
addEventListener('beforeunload', saveGame);

// ---------- Start ----------
function title() {
  const save = loadSave();
  const t = $('title');
  t.innerHTML = `<div class="tbox"><h1>Aeternum Wilds</h1><p class="sub">Shipwrecked on a cursed island. Fight, gather, craft and grow strong enough to face the Corruption.</p>
    ${save ? `<button id="cont" class="big">Continue <small>Level ${save.level}</small></button>` : ''}
    <button id="newg" class="${save ? '' : 'big'}">New Game</button>
    <p class="hint">WASD move · mouse aim · click attack (hold for heavy) · right click block · Space dodge · Q R F abilities · E interact</p></div>`;
  t.style.display = 'flex';
  if (save) $('cont').onclick = () => { initAudio(); start(save); };
  $('newg').onclick = () => { initAudio(); if (save && !confirm('Start a new character? Your current save will be replaced.')) return; pickWeapon(); };
}
function pickWeapon() {
  const t = $('title');
  const blurb = { sword: 'Balanced. Blocks every hit with the shield.', greataxe: 'Wide, sweeping swings and lifesteal. Strength.', hammer: 'Slow, crushing blows that stun crowds. Strength.', bow: 'Strike from range; hold to draw. Dexterity.' };
  t.innerHTML = `<div class="tbox"><h2>Choose your first weapon</h2><p class="sub">You will get a second one soon, and can master all four.</p><div class="wpick">${Object.keys(WEAPONS).map(k => `<button data-w="${k}"><span>${WEAPONS[k].icon}</span><b>${WEAPONS[k].name}</b><small>${blurb[k]}</small></button>`).join('')}</div></div>`;
  t.querySelectorAll('[data-w]').forEach(b => b.onclick = () => {
    const p = newProfile(b.dataset.w);
    G.p = p;
    p.equip.w1 = makeGear({ kind: 'weapon', wtype: b.dataset.w, gs: 100, rarity: 0 });
    p.equip.chest = makeGear({ kind: 'armor', slot: 'chest', gs: 100, rarity: 0 });
    p.equip.feet = makeGear({ kind: 'armor', slot: 'feet', gs: 100, rarity: 0 });
    start(p);
  });
}

let built = false;
function start(profile) {
  G.p = profile;
  $('title').style.display = 'none';
  $('loading').style.display = 'flex';
  setTimeout(() => {
    if (!built) { buildWorld(); built = true; }
    createPlayer();
    initUI();
    fillBounties();
    refreshHud(); refreshTracker();
    $('loading').style.display = 'none';
    $('hud').style.display = 'block';
    G.started = true; G.paused = false;
    if (profile.story.step === 0) setTimeout(() => toast('Captain Thorne is waiting by the flag. Walk up to him and press <kbd>E</kbd>.', 'gold'), 800);
    if (!loop.running) { loop.running = true; clock.getDelta(); requestAnimationFrame(loop); }
  }, 30);
}

// ---------- Loop ----------
const clock = new THREE.Clock();
let cullT = 0, saveT = 20, promptT = 0, camX = 0, camZ = 0, camInit = false;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(G.maxDt || 0.05, clock.getDelta());
  const P = G.player;
  G.paused = !!G.ui.open;
  if (!G.paused) {
    G.time += dt;
    G.p.stats.playTime += dt;
    updatePlayer(dt);
    updateCamps(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateFx(dt);
    cullT -= dt;
    if (cullT <= 0) { cullT = 0.4; for (const n of G.nodes) { const far = Math.abs(n.x - P.pos.x) > 70 || Math.abs(n.z - P.pos.z) > 60; n.mesh.visible = !far && n.depleted <= 0; } }
    for (const n of G.nodes) if (n.depleted > 0) { n.depleted -= dt; if (n.depleted <= 0) { n.mesh.visible = true; cullT = 0; if (n.stump) n.stump.visible = false; if (n.col) n.col.off = false; } }
    for (let i = G.corpses.length - 1; i >= 0; i--) { const c = G.corpses[i]; if (G.time > c.until) { removeEnemy(c.ent); G.corpses.splice(i, 1); } }
    promptT -= dt; if (promptT <= 0) { promptT = 0.1; updatePrompt(); }
    saveT -= dt; if (saveT <= 0) { saveT = 20; saveGame(); }
    if (G.p.food && G.p.food.until <= G.p.stats.playTime) { G.p.food = null; G.statsDirty = true; toast('Your food buff wore off'); }
  }
  // aim point
  ndc.set(inp.mx / innerWidth * 2 - 1, -(inp.my / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  plane.constant = -(P.y + 1.0);
  if (raycaster.ray.intersectPlane(plane, hit)) { inp.aimX = hit.x; inp.aimZ = hit.z; }
  // camera
  const d = 31 * zoom;
  if (!camInit) { camX = P.pos.x; camZ = P.pos.z; camInit = true; }
  camX += (P.pos.x - camX) * Math.min(1, dt * 8); camZ += (P.pos.z - camZ) * Math.min(1, dt * 8);
  const [sx, sz] = shakeOffset(dt);
  camera.position.set(camX + sx, P.y + d * 0.84, camZ + d * 0.6 + sz);
  camera.lookAt(camX + sx, P.y + 0.8, camZ + sz);
  sun.position.set(P.pos.x + 30, P.y + 60, P.pos.z + 22);
  sun.target.position.set(P.pos.x, P.y, P.pos.z);
  // zone fog
  const zn = zoneAt(P.pos.x, P.pos.z);
  fogCol.lerp(new THREE.Color(ZONES[zn].fog), Math.min(1, dt * 0.8));
  scene.fog.near = 60 * zoom + 20; scene.fog.far = 160 * zoom + 30;
  // ambience
  const t = performance.now() / 1000;
  if (G.flag) G.flag.userData.flag.rotation.y = Math.sin(t * 2) * 0.25;
  if (G.flame) { G.flame.scale.set(1 + Math.sin(t * 13) * 0.12, 1 + Math.sin(t * 9) * 0.2, 1 + Math.cos(t * 11) * 0.12); }
  if (G.crystal) { G.crystal.rotation.y = t * 0.6; G.crystal.position.y = 3.4 + Math.sin(t * 1.5) * 0.3; }
  G.water.position.y = -0.15 + Math.sin(t * 0.6) * 0.06;
  updateHud(dt);
  renderer.render(scene, camera);
}
loop.running = false;

title();

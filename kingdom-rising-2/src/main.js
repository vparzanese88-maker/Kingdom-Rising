// Kingdom Rising II: boot, renderer, game loop, day/night, intro cinematic, input, saving, and glue between systems.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { G } from './state.js';
import { settings, putSave, getSave } from './saves.js';
import { A, S, M, setAmbience } from './audio.js';
import { V } from './vfx.js';
import { PORT } from './terrain.js';
import { applyBattleTerrain, buildTerrain, buildWater, buildSky, buildWaterfall, skyColors, heightAt, zoneAt, SPAWN, VILLAGE, FALL, CAMPS, biomeMasks } from './terrain.js';
import { buildGull, flap, placeHomeBoat, BOAT_Y } from './sailintro.js';
import { summonPets, petCommand, pets, PETS } from './pets.js';
import { spawnGuards, updateGuards } from './guards.js';
import { updateBanners } from './banners.js';
import { storyTalk, sceneKey, updateScene, inScene, advance as sceneAdvance } from './story.js';
import { buildDefenses, defensesFor, startConstruction, updateConstruction } from './seabreak.js';
import { mobsInCone, foe as isFoe } from './combat.js';
import { initChat, openChat, add as chatAdd } from './chat.js';
import { pois, learn, known, chatter, villagerName, LORE } from './lore.js';
import { fog, updateFog, packFog, unpackFog } from './fog.js';
import { buildWorld, world, cullChunks, updateGrass, updateBirds, updateAmbient, showNode, nodeKinds } from './world.js';
import { battleLevels, campaignLevels, campaignXp, shownLv, LEVEL_CAP, SPAWNS, ZONES, NPCS, RACES, CLASSES, WEAPON_TYPES, QUESTS, MOBS, GOBLIN_CAMPS, FAMILIES, ABILITIES, familiesOf } from './data.js';
import { Mob, NPC, Villager } from './mobs.js';
import { Player } from './player.js';
import * as Game from './game.js';
import * as UI from './ui.js';
import * as Icons from './icons.js';
import { showTitle, initMenu, Menu, renderPreview, goFull, renderStage, BATTLE_GOAL, showCreator } from './menu.js';
import { buildHumanoid, equipWeapon, tintGear, bake, animateHumanoid } from './character.js';
import { BATTLE, YARD, SETUP, LAYOUT, computeLayout } from './battlemap.js';
import { spawnDummies, updateYard, openYardPanel, yardHero, YD, resetCooldowns } from './yard.js';
import { MP, lobby, send as mpSend, setStatus as setMpStatus, statusPanel } from './mp.js';
import * as Sync from './mpsync.js';
import * as Battle from './battle.js';
import * as BUI from './battleui.js';
import { TEAM_COLORS, CLASS_KIT, ECON, BATTLE_ABILITIES } from './battledata.js';
import * as BQ from './battlequests.js';
import { updateProjectiles, telegraph, enemyBlast, enemyProjectile, mobShot, mobBlast, telegraphSelf, telegraphLine, telegraphCone } from './combat.js';

const canvas = document.getElementById('game');
const $ = (id) => document.getElementById(id);
let renderer, scene, camera, composer, bloom, sun, hemi, sky, water, fall, fireLights = [], vmSun, vmHemi;
let mode = 'loading', intro = null, saveTimer = 0, zoneNow = null, lastT = performance.now();

// ---------- boot ----------
function boot() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene(); G.scene = scene; G.renderer = renderer;
  camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 3500); G.camera = camera; scene.add(camera);
  scene.fog = new THREE.Fog('#b8d4e8', 150, 900);
  // first-person hands and weapon are drawn in their own scene with a narrower camera, on top of the world
  G.vmScene = new THREE.Scene(); G.vmCam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 50); G.vmScene.add(G.vmCam);
  vmSun = new THREE.DirectionalLight('#fff2d8', 2.2); vmSun.position.set(0.5, 1, 0.3); G.vmScene.add(vmSun, vmSun.target); vmHemi = new THREE.HemisphereLight('#cfe4ff', '#5a4a30', 0.9); G.vmScene.add(vmHemi);
  sun = new THREE.DirectionalLight('#fff2d8', 2.5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 420 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  hemi = new THREE.HemisphereLight('#cfe4ff', '#5a4a30', 0.9); scene.add(hemi);
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight('#ff9040', 0, 16, 2); scene.add(l); fireLights.push(l); }
  // soft sky environment so metal and wet surfaces have something to reflect
  { const es = new THREE.Scene(); const g = new THREE.SphereGeometry(10, 32, 16); const cols = []; const pa = g.attributes.position; const top = new THREE.Color('#9cc4ec'), hor = new THREE.Color('#f0e4cc'), gnd = new THREE.Color('#5a5040'); for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / 10; const c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(gnd, Math.min(1, -y * 3)); cols.push(c.r, c.g, c.b); } g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }))); const sunM = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4e0').multiplyScalar(6) })); sunM.position.set(5, 6, 3); es.add(sunM);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, 0.03).texture; scene.environmentIntensity = 0.55; G.envMap = scene.environment; G.vmScene.environment = scene.environment; G.vmScene.environmentIntensity = 0.7; }
  buildTerrain(scene); water = buildWater(scene); sky = buildSky(scene); fall = buildWaterfall(scene);
  buildWorld(scene); if (!BATTLE) placeHomeBoat(scene);
  V.init(scene, camera);
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.5, 0.88); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  applyGraphics();
  if (!BATTLE) campaignSetup();
  if (BATTLE) { Battle.initBattle(scene); G.myTeam = Battle.B.myTeam; battleLevels(); G.hooks.decorCamps = decorCamps; if (!MP.client) { spawnBattleCamps(); decorCamps(); for (const m of G.mobs) if (m.team == null && !m.statLv) battleMob(m); G.mobs.filter(m => m.team == null).forEach((m, i) => { m.netIdx = i; Sync.mobList.push(m); }); Sync.flushRoster(); } }
  else if (YARD) spawnDummies();
  else {
  // NPCs and villagers live in the world from the start (visible behind the title screen)
  for (const id in NPCS) G.npcs.push(new NPC(id));
  const vill = [[-6, 352, { race: 'human', sex: 'f', outfit: 'weaver', hair: '#7b2a15', hairStyle: 2, skin: '#e0ac85', height: 0.8 }], [12, 372, { race: 'human', sex: 'm', outfit: 'worker', hair: '#d9b26a', skin: '#f1c7a5', beard: 0, height: 0.75 }], [-18, 340, { race: 'dwarf', sex: 'm', outfit: 'worker', hair: '#6b3a17', skin: '#dba07a' }], [24, 360, { race: 'elf', sex: 'f', outfit: 'merchant', hair: '#e8e8e8', skin: '#ead0b5', hairStyle: 1 }]];
  { const SK = ['#e0ac85', '#f1c7a5', '#c08e68', '#8a6448', '#d4a882'], HA = ['#5a3a1e', '#2a1a10', '#d9b26a', '#7b2a15', '#8a8a8a'];
    const rnd = (a) => a[Math.floor(Math.random() * a.length)], app = (i) => ({ race: 'human', sex: i % 2 ? 'f' : 'm', outfit: ['worker', 'weaver', 'smith', 'hunter'][i % 4], hair: rnd(HA), hairStyle: i % 3, skin: rnd(SK), beard: i % 4 === 0 ? 1 : 0, height: 0.75 + Math.random() * 0.12 });
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28 + 0.2, r = 18 + (i % 3) * 14; vill.push([PORT.x + Math.cos(a) * r, PORT.z + Math.sin(a) * r, app(i)]); } // Saltmere's townsfolk
    vill.push([CAMPS[0].x + 6, CAMPS[0].z - 4, app(3)], [CAMPS[1].x + 4, CAMPS[1].z + 6, app(5)]); }
  vill.forEach(([x, z, app], i) => { const v = new Villager(x, z, app); v.talkable = true; v.vname = villagerName(i); G.npcs.push(v); });
  for (const s of SPAWNS) { const [type, x, z, r, n, l0, l1] = s; const hostileN = MOBS[type].elite ? 1 : MOBS[type].aggro > 0 ? 2.2 : 1.3; const packs = Math.max(1, Math.round(n / 3)); const centers = []; for (let j = 0; j < packs; j++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r * 0.75; centers.push([x + Math.cos(a) * d, z + Math.sin(a) * d]); }
    for (let i = 0; i < Math.max(1, Math.round(n * hostileN)); i++) { const [cx0, cz0] = centers[i % packs]; let px, pz, k = 0; do { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * Math.max(14, r * 0.6); px = cx0 + Math.cos(a) * d; pz = cz0 + Math.sin(a) * d; k++; } while (k < 20 && heightAt(px, pz) < (type === 'crab' ? 0.2 : 1.2)); G.mobs.push(new Mob(type, l0 + Math.floor(Math.random() * (l1 - l0 + 1)), px, pz)); } }
  // fill the empty stretches between spawn areas with small roaming packs
  { const TAB = { coast: [['crab', 1, 2], ['rabbit', 1, 1], ['wolf', 1, 2]], meadow: [['wolf', 1, 2], ['wolf', 2, 3], ['bear', 2, 3], ['tiger', 2, 3], ['goblin', 1, 3], ['boarlet', 1, 2], ['bear', 3, 4], ['tiger', 3, 4]], edge: [['wolf', 3, 4], ['bear', 3, 5], ['tiger', 4, 5], ['boar', 4, 5]], wood: [['tiger', 5, 8], ['boar', 5, 7], ['wolf', 5, 8], ['bear', 7, 9], ['tiger', 8, 10]], north: [['wolf', 9, 11], ['boar', 9, 10], ['bear', 10, 12], ['tiger', 11, 13]], highlands: [['bear', 12, 15], ['tiger', 13, 16], ['wolf', 12, 14], ['bear', 15, 18]] };
    for (let gx = -520; gx <= 520; gx += 60) for (let gz = -520; gz <= 460; gz += 60) {
      const x = gx + (Math.random() - 0.5) * 40, z = gz + (Math.random() - 0.5) * 40;
      if (heightAt(x, z) < 1.2 || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 70 || Math.hypot(x - PORT.x, z - PORT.z) < 110) continue;
      if (SPAWNS.some(s2 => Math.hypot(s2[1] - x, s2[2] - z) < s2[3] * 0.8 + 20) || GOBLIN_CAMPS.some(g => Math.hypot(g[0] - x, g[1] - z) < 40) || CAMPS.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 25)) continue;
      let zn = zoneAt(x, z); if (zn === 'meadow' && z < 215) zn = 'edge'; if (zn === 'wood' && z > 150) zn = 'edge';
      const tab = TAB[zn]; if (!tab) continue;
      const [type, l0, l1] = tab[Math.floor(Math.random() * tab.length)];
      const n = zn === 'meadow' || zn === 'edge' || zn === 'coast' ? 2 + (Math.random() < 0.5 ? 1 : 0) : type === 'tiger' || type === 'snowtiger' ? 2 : type === 'rabbit' || type === 'crab' ? 4 : 3 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) { const px = x + (Math.random() - 0.5) * 34, pz = z + (Math.random() - 0.5) * 34; if (heightAt(px, pz) < (type === 'crab' ? 0.2 : 1.2)) continue; G.mobs.push(new Mob(type, l0 + Math.floor(Math.random() * (l1 - l0 + 1)), px, pz)); }
    } }
  // goblin camps: three around the fire, two on patrol
  for (const [cx, cz, l0, l1] of GOBLIN_CAMPS) {
    const lv = () => l0 + Math.floor(Math.random() * (l1 - l0 + 1));
    const fire = new THREE.Vector3(cx, heightAt(cx, cz), cz);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; const m = new Mob(i === 2 ? 'goblin_slinger' : i === 3 && l0 >= 5 ? 'goblin_brute' : 'goblin', lv(), cx + Math.cos(a) * 2.4, cz + Math.sin(a) * 2.4); m.sitAt = fire; G.mobs.push(m); }
    for (let k = 0; k < 2; k++) {
      const r = 16 + k * 7, pts = []; for (let j = 0; j < 6; j++) { const a = j / 6 * Math.PI * 2 * (k ? -1 : 1); pts.push(new THREE.Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r)); }
      const m = new Mob(k ? 'goblin_slinger' : 'goblin', lv(), pts[0].x, pts[0].z); m.patrol = { pts, i: 1 }; m.home.set(cx, heightAt(cx, cz), cz); G.mobs.push(m);
    }
  }
  // no beasts inside towns and villages, and guards to keep it that way (2 in a small village, more in bigger places)
  { const TOWNS = [{ x: VILLAGE.x, z: VILLAGE.z, r: 60, n: 2, col: '#3a7a3a' }, { x: PORT.x, z: PORT.z, r: 90, n: 8, col: '#2a4a8a' }, { x: CAMPS[0].x, z: CAMPS[0].z, r: 32, n: 2, col: '#6a3a2a' }, { x: CAMPS[1].x, z: CAMPS[1].z, r: 34, n: 3, col: '#6a3a2a' }];
    for (const m of G.mobs.slice()) if (m.team == null && TOWNS.some(T => Math.hypot(m.home.x - T.x, m.home.z - T.z) < T.r + 12)) { G.scene.remove(m.root); if (m.ring) G.scene.remove(m.ring); G.mobs.splice(G.mobs.indexOf(m), 1); }
    spawnGuards(TOWNS); }
  }
  hooks();
  initMenu();
  Menu.onPlay = startGame;
  addEventListener('resize', onResize); onResize();
  input();
  $('loading').hidden = true;
  // online: the world is ready, now everyone makes their hero for this match
  if (BATTLE && MP.on && !SETUP.hero) { mode = 'creator'; Menu.onBattleHero = (hero) => { SETUP.hero = hero; SETUP.race = hero.race; mpSend({ t: 'hero', info: { name: hero.name, cls: hero.cls, race: hero.race, sex: hero.sex, app: hero.app } }); MP.players.set(MP.myId, Object.assign(MP.players.get(MP.myId) || {}, hero)); $('creator').hidden = true; startBattle(); }; const mt = Battle.myTown(); const nm = (MP.players.get(MP.myId) || {}).name; showCreator({ battle: { mp: true, live: true, name: nm, towns: [{ race: SETUP.myRace || mt.race }] } }); setMpStatus('hero'); }
  else if (BATTLE) startBattle(); else if (YARD) { YD.startGame = startGame; startGame(yardHero('warrior')); setTimeout(() => UI.hint('Welcome to the <b>Training Yard</b>. Press <span class="kbd">Y</span> to change class or weapon, <span class="kbd">K</span> to put abilities on your hotbar. The dummies show your damage per second.', 12000), 1200); } else { mode = 'title'; showTitle(); }
  // first interaction: start audio + full screen
  const first = () => { A.init(); M.play(mode === 'game' ? 'explore' : 'title'); removeEventListener('pointerdown', first); removeEventListener('keydown', first); };
  addEventListener('pointerdown', first); addEventListener('keydown', first);
  requestAnimationFrame(loop);
}
function onResize() { renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); V.setScale && V.setScale(innerHeight); applyGraphics(); }
function applyGraphics() {
  const q = settings.quality, pr = Math.min(devicePixelRatio, q === 'high' ? 1.5 : q === 'medium' ? 1 : 0.75);
  renderer.setPixelRatio(pr); composer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = settings.shadows; sun.castShadow = settings.shadows;
  bloom.enabled = settings.bloom;
  sun.shadow.mapSize.set(q === 'low' ? 1024 : 2048, q === 'low' ? 1024 : 2048); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  scene.traverse(o => { if (o.material && o.material.needsUpdate !== undefined && o.isMesh) o.material.needsUpdate = true; });
}

// ---------- start / quit ----------
function startGame(save) {
  const h = Game.migrateHero(save.inv ? save : getSave(save.id));
  G.save = h;
  // the island tops out at level 20: heroes from the short-lived 1-50 scale move back once
  if (!BATTLE && h.lv50 && !h.lv20) { if (h.level > 1) { h.level = Math.max(1, Math.min(LEVEL_CAP, Math.round(1 + (h.level - 1) * 19 / 49))); h.xp = 0; } }
  if (!BATTLE) { h.lv20 = true; h.lv50 = true; }
  if (G.player) { scene.remove(G.player.ch.root); G.vmCam.remove(G.player.vm.g); }
  for (const m of G.mobs) if (m.dead) m.respawn();
  for (const p of G.projectiles) p.mesh && scene.remove(p.mesh); G.projectiles.length = 0;
  const p = new Player(h); G.player = p;
  if (h.pos) p.place(h.pos.x, h.pos.z, h.pos.yaw); else p.place(SPAWN.x, SPAWN.z, Math.atan2(VILLAGE.x - SPAWN.x, VILLAGE.z - SPAWN.z));
  if (h.hp) p.hp = Math.max(1, Math.min(p.maxHp, h.hp));
  G.tod = h.tod ?? 0.3;
  $('title').hidden = true; $('creator').hidden = true; $('hud').hidden = false; $('death').hidden = true;
  if (!BATTLE && !YARD) { fog.on = true; fog.soft = true; G.fog = fog; unpackFog(h.fogEx); buildDefenses(defensesFor(h)); }
  initChat(() => lockPointer()); Game.autoFillHotbar(h); UI.buildMapImage(); UI.buildAbilityBar(); UI.updateTracker(); UI.applyHud();
  zoneNow = null; mode = 'game'; G.paused = false; G.uiOpen = false;
  A.init(); M.play('explore');
  if (!h.introDone) startIntro(); else { if (!BATTLE && !YARD && !h.quests.active.mq_boat && !h.quests.done.includes('mq_boat')) { startMainQuest(h); setTimeout(() => UI.toast('New main quest: Repairs at Sea\'s End', '📜', 'gold'), 2500); } lockPointer(); UI.banner(`Welcome back, ${h.name}`, `Level ${h.level} ${RACES[h.race].name} ${CLASSES[h.cls].name}`); }
}
function saveNow() {
  if (BATTLE || YARD) return;
  const p = G.player, h = G.save; if (!p || !h) return;
  h.pos = { x: p.pos.x, z: p.pos.z, yaw: p.yaw }; if (p.dead) h.pos = null;
  h.hp = p.hp; h.tod = G.tod; if (fog.on && fog.soft) h.fogEx = packFog();
  const zn = ZONES.find(z => z.id === G.zone); h.zone = zn ? zn.name : h.zone;
  putSave(h);
}
function quitToTitle() {
  if (BATTLE) { location.href = location.pathname; return; }
  saveNow(); UI.closeWin();
  if (G.player) { scene.remove(G.player.ch.root); G.vmCam.remove(G.player.vm.g); G.player = null; }
  $('hud').hidden = true; $('death').hidden = true; $('clickToPlay').hidden = true; $('intro').hidden = true; intro = null;
  if (document.pointerLockElement) document.exitPointerLock();
  mode = 'title'; showTitle();
}

// ---------- Kingdom Battles ----------
// camp dressing: goblins keep powder kegs by their fire, bandits pile scrap metal from the wagons they rob
const campFires = [];
function decorCamps() {
  const wood = new THREE.MeshStandardMaterial({ color: '#5a3a20', roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: '#3a2a1a', roughness: 0.9 });
  const keg = new THREE.MeshStandardMaterial({ color: '#6a4424', roughness: 0.8 }), band = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.5, metalness: 0.7 });
  const flame = new THREE.MeshBasicMaterial({ color: '#ffa030', transparent: true, opacity: 0.9 }), flame2 = new THREE.MeshBasicMaterial({ color: '#fff0a0' });
  const rock = new THREE.MeshStandardMaterial({ color: '#6a6a66', roughness: 0.95 }), rust = new THREE.MeshStandardMaterial({ color: '#7a4a2a', roughness: 0.6, metalness: 0.6 }), iron = new THREE.MeshStandardMaterial({ color: '#7a7e84', roughness: 0.45, metalness: 0.8 });
  const hide = new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.95, side: THREE.DoubleSide }), cloth = new THREE.MeshStandardMaterial({ color: '#5a2a24', roughness: 0.95, side: THREE.DoubleSide });
  const add = (g, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; };
  for (const c of LAYOUT.camps) {
    if (c.decor) continue;
    const near = G.mobs.filter(m => m.team == null && Math.hypot(m.home.x - c.x, m.home.z - c.z) < 14).map(m => m.type);
    const gob = near.some(t => t.startsWith('goblin')), ban = near.some(t => t.startsWith('bandit'));
    if (!gob && !ban) continue; c.decor = gob ? 'goblin' : 'bandit';
    const g = new THREE.Group(); g.position.set(c.x, heightAt(c.x, c.z), c.z); scene.add(g);
    // campfire: a ring of stones, crossed logs, flames and a flickering light
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; add(g, new THREE.DodecahedronGeometry(0.28, 0), rock, Math.cos(a) * 0.95, 0.12, Math.sin(a) * 0.95, i, i * 2, 0); }
    for (let i = 0; i < 4; i++) add(g, new THREE.CylinderGeometry(0.1, 0.12, 1.4, 6), dark, 0, 0.22, 0, Math.PI / 2 - 0.3, i * Math.PI / 4, 0);
    const f1 = add(g, new THREE.ConeGeometry(0.45, 1.2, 7), flame, 0, 0.75, 0), f2 = add(g, new THREE.ConeGeometry(0.22, 0.7, 6), flame2, 0, 0.6, 0);
    const L = new THREE.PointLight('#ff9a40', 3, 18, 1.6); L.position.set(0, 1.4, 0); g.add(L); campFires.push({ f1, f2, L, ph: Math.random() * 10 });
    // logs to sit on
    for (const a of [0.6, 2.4, 4.3]) add(g, new THREE.CylinderGeometry(0.22, 0.22, 1.8, 7), wood, Math.cos(a) * 2.4, 0.22, Math.sin(a) * 2.4, Math.PI / 2, a, 0);
    if (gob) {
      // powder kegs stacked by the fire (a little too close, as goblins do) and crude hide tents
      const kp = [[3.2, 1.4], [3.7, 0.6], [3.4, 2.2], [3.55, 1.4, 1]];
      for (const [x, z, up] of kp) { const k = add(g, new THREE.CylinderGeometry(0.34, 0.34, 0.7, 10), keg, x, up ? 1.05 : 0.35, z); for (const yy of [-0.22, 0.22]) add(k, new THREE.CylinderGeometry(0.36, 0.36, 0.06, 10), band, 0, yy, 0); add(k, new THREE.CylinderGeometry(0.2, 0.2, 0.02, 8), new THREE.MeshStandardMaterial({ color: '#1a1a1a' }), 0, 0.36, 0); }
      add(g, new THREE.BoxGeometry(0.5, 0.5, 0.5), keg, 2.7, 0.25, 2.9, 0, 0.5, 0);
      for (const [x, z, r] of [[-3.6, -2, 0.4], [-1.5, -4.2, 1.3]]) { const tent = add(g, new THREE.ConeGeometry(1.7, 2.4, 5, 1, true), hide, x, 1.2, z, 0, r, 0); add(tent, new THREE.CylinderGeometry(0.05, 0.05, 3, 4), dark, 0, 0.3, 0); }
      // a sign of a skull on a pole
      add(g, new THREE.CylinderGeometry(0.06, 0.07, 2.6, 5), dark, -2.6, 1.3, 2.6); add(g, new THREE.SphereGeometry(0.22, 7, 5), new THREE.MeshStandardMaterial({ color: '#e8dfc4' }), -2.6, 2.7, 2.6);
    } else {
      // bandits: piles of scrap metal from robbed wagons, a broken cart wheel, a lean-to of stolen cloth
      for (let i = 0; i < 14; i++) { const x = 3.1 + Math.sin(i * 7.1) * 0.9, z = -1.2 + Math.cos(i * 3.3) * 0.9; const k = i % 3; add(g, k === 0 ? new THREE.BoxGeometry(0.6, 0.08, 0.35) : k === 1 ? new THREE.CylinderGeometry(0.05, 0.05, 0.9, 5) : new THREE.TorusGeometry(0.25, 0.05, 5, 10), i % 2 ? rust : iron, x, 0.1 + (i % 4) * 0.12, z, i * 0.7, i * 1.3, i * 0.4); }
      const wh = add(g, new THREE.TorusGeometry(0.6, 0.07, 6, 14), wood, 2.2, 0.62, -3, 0, 0.6, 0.2); for (let k = 0; k < 4; k++) add(wh, new THREE.BoxGeometry(1.1, 0.05, 0.05), wood, 0, 0, 0, 0, 0, k * Math.PI / 4);
      for (const [x, z] of [[-3, -2.5], [-1.2, -4]]) { add(g, new THREE.CylinderGeometry(0.06, 0.07, 2.2, 5), dark, x, 1.1, z); }
      const lean = add(g, new THREE.PlaneGeometry(2.4, 2.2), cloth, -2.1, 1.3, -3.6, -0.7, 0.55, 0);
      add(g, new THREE.BoxGeometry(0.9, 0.6, 0.6), wood, -2.6, 0.3, 1.8, 0, 0.3, 0); add(g, new THREE.BoxGeometry(0.7, 0.5, 0.6), wood, -2.2, 0.85, 1.9, 0, -0.2, 0);
    }
  }
}
function tickCampFires() { const t = performance.now() * 0.001; for (const c of campFires) { const k = 0.85 + Math.sin(t * 9 + c.ph) * 0.1 + Math.sin(t * 23 + c.ph) * 0.06; c.f1.scale.set(1, k, 1); c.f2.scale.set(1, 2 - k, 1); c.L.intensity = 2.4 + k * 1.2; } }
// Kingdom Battles monsters: levels shown halved (top level 10), and tuned so a fight against your own level
// takes a few swings and real damage, three levels up is a hard fight, and five up will usually kill you
function battleMob(m) {
  m.statLv = m.lv; m.lv = Math.max(1, Math.ceil(m.lv / 2));
  m.maxHp = Math.round(m.maxHp * 1.4); m.hp = m.maxHp;
  m.dmg *= 0.95 - 0.03 * (m.lv - 1);
  m.xp = Math.round(m.xp * 1.4);
}
function spawnBattleCamps() {
  const TIERS = [
    [['wolf', 2, 4, 5], ['goblin', 3, 5, 5], ['boar', 2, 4, 4], ['spider', 3, 5, 4], ['rat', 1, 3, 5]],
    [['bear', 6, 8, 4], ['bandit', 7, 9, 5], ['tiger', 7, 9, 4], ['goblin_brute', 6, 8, 4], ['wolf', 6, 8, 6]],
    [['troll', 11, 13, 3], ['snowtiger', 11, 13, 4], ['skeleton', 12, 14, 5], ['frostwolf', 10, 12, 5], ['ashhound', 12, 14, 4]],
  ];
  // bosses get tougher the further they are from the towns
  const BOSSES = [['bandit_boss', 8, ['bandit', 7, 4]], ['golem', 12, ['imp', 11, 3]], ['troll_king', 16, ['troll', 13, 3]]];
  let bossN = 0; const campN = {};
  for (const c of LAYOUT.camps) {
    if (c.tier === 3) { const bt = (bossN++) % 3; const [boss, lv, [add, al, an]] = BOSSES[bt]; const m = new Mob(boss, lv + Math.floor(Math.random() * 2), c.x, c.z); m.bossy = true; m.maxHp = Math.round(m.maxHp * 1.6); m.hp = m.maxHp; G.mobs.push(m); for (let i = 0; i < an; i++) { const a = i / an * 6.28; G.mobs.push(new Mob(add, al, c.x + Math.cos(a) * 7, c.z + Math.sin(a) * 7)); } continue; }
    // every kind of camp turns up (goblin and bandit camps are needed for the town jobs)
    const opts = TIERS[c.tier], [type, l0, l1, n] = opts[(campN[c.tier] = (campN[c.tier] ?? Math.floor(Math.random() * opts.length)) + 1) % opts.length];
    for (let i = 0; i < n; i++) { const a = i / n * 6.28 + Math.random() * 0.5, r = 3 + Math.random() * 4, m = new Mob(type, l0 + Math.floor(Math.random() * (l1 - l0 + 1)), c.x + Math.cos(a) * r, c.z + Math.sin(a) * r); G.mobs.push(m); }
    if (type === 'goblin') G.mobs.push(new Mob('goblin_slinger', l0 + 1, c.x, c.z + 3));
  }
}
const NPC_NAMES = { human: ['Foreman Hobb', 'Master Builder Edric'], orc: ['Peon-boss Gruk', 'Wallmaster Durgo'], highelf: ['Steward Ilvaen', 'Architect Saelora'], woodelf: ['Gatherer Fenwick', 'Shaper Thalanor'], dwarf: ['Foreman Brokk', 'Master Mason Dain'] };
function spawnBattleNpcs() {
  const t = Battle.myTown(), [fn, bn] = NPC_NAMES[t.race] || NPC_NAMES.human;
  const race = t.race === 'woodelf' || t.race === 'highelf' ? t.race : t.race;
  NPCS.b_foreman = { name: fn, title: 'Peasants & tools', race, sex: 'm', outfit: 'worker', x: t.foremanSpot[0], z: t.foremanSpot[1], hello: '', battleRole: 'foreman' };
  NPCS.b_builder = { name: bn, title: 'Town & tower upgrades', race, sex: 'm', outfit: 'smith', x: t.builderSpot[0], z: t.builderSpot[1], hello: '', battleRole: 'builder' };
  // the two job givers: kill and loot jobs that make the town stronger
  const at = (along, lat) => [t.x + t.dir[0] * along + t.perp[0] * lat, t.z + t.dir[1] * along + t.perp[1] * lat];
  const QN = { human: ['Huntmaster Oswin', 'Quartermaster Bess'], orc: ['Huntmaster Rakh', 'Quartermaster Zug'], highelf: ['Huntmaster Aelir', 'Quartermaster Ithrae'], woodelf: ['Huntmaster Sylwen', 'Quartermaster Bramblewick'], dwarf: ['Huntmaster Grimma', 'Quartermaster Thorek'] }[t.race] || ['Huntmaster', 'Quartermaster'];
  const hs = at(27, 6), qs = at(27, -6);
  NPCS.b_hunt = { name: QN[0], title: 'Hunting jobs', race, sex: 'f', outfit: 'worker', x: hs[0], z: hs[1], hello: '', battleRole: 'hunt' };
  NPCS.b_quarter = { name: QN[1], title: 'Supply jobs', race, sex: 'm', outfit: 'smith', x: qs[0], z: qs[1], hello: '', battleRole: 'quarter' };
  // the town runs itself, so only the job givers stand in the square
  for (const id of ['b_hunt', 'b_quarter']) { const n = new NPC(id); n.baseYaw = t.yaw; G.npcs.push(n); }
  G.hooks.npcMarker = (id) => id === 'b_hunt' ? BQ.marker('hunt') : id === 'b_quarter' ? BQ.marker('quarter') : '';
  BQ.initQuests({
    say: (giver, text, kind) => BUI.report(giver === 'hunt' ? 'huntmaster' : 'quartermaster', text, kind),
    toast: (t2) => UI.toast(t2, '✦', 'gold'),
    banner: (a, b) => UI.banner(a, b, 3500),
    changed: () => BUI.questTrack(),
    reward: (j) => { Battle.questReward(Battle.myTown(), j.id); },
  });
}
// Both modes fight the same way: class abilities come from the class kit (they work with any weapon),
// no talent trees, and abilities grow a little stronger, longer and wider every level instead.
function kitAbilities(levelOf) {
  for (const c in BATTLE_ABILITIES) for (const a of BATTLE_ABILITIES[c]) if (!ABILITIES[c].some(x => x.id === a.id)) ABILITIES[c].push(a);
  for (const c in ABILITIES) for (const a of ABILITIES[c]) if (CLASS_KIT[a.id]) { a.name = CLASS_KIT[a.id][0]; a.desc = CLASS_KIT[a.id][1]; }
  for (const c in ABILITIES) for (const a of ABILITIES[c]) { if (a.lv20 == null) a.lv20 = a.level; a.level = levelOf(a.lv20); }
  G.abilScale = (lv) => 1 + (lv - 1) * 0.675 / (LEVEL_CAP - 1);
  G.battleFx = true; G.noTalents = true; G.hotbarSlots = 8;
}
// The campaign plays like Kingdom Battles, but keeps crafting and harvesting and climbs to level 50
function campaignSetup() {
  campaignLevels();
  kitAbilities((lv20) => Math.min(LEVEL_CAP - 2, shownLv(lv20)));
  // campaign summons stay until they fall, or until you summon again
  for (const c in ABILITIES) for (const a of ABILITIES[c]) if (a.t === 'summon' || a.id === 'spiritwolf') a.desc = a.desc.replace(/ for \d+ s/g, '').replace(/\s*\([^)]*\)/g, '').replace(/\.?\s*$/, '.') + ' It stays until it falls, or until you summon again.';
  G.itemSlots = 0; G.xpReq = campaignXp; document.body.classList.add('battlefx');
}
function startBattle() {
  const t = Battle.myTown(), cfg = SETUP.hero || {};
  const h = Game.newHero({ name: cfg.name || 'Hero', race: (MP.on && cfg.race) || t.race || 'human', cls: cfg.cls || 'warrior', sex: cfg.sex || 'm', app: cfg.app || { skin: '#e0ac85', hair: '#3a2a1a', hairStyle: 1, beard: 0, height: 1, build: 0 } });
  h.introDone = true; h.gold = ECON.start.gold; h.tools = { hatchet: 1, pickaxe: 1, knife: 0 }; h.carry = { wood: 0, stone: 0 };
  h.pos = { x: t.x + t.dir[0] * 14, z: t.z + t.dir[1] * 14, yaw: t.yaw };
  G.xpReq = ECON.xpNeed; G.gatherXp = 3; G.noHarvest = true;
  // level 10 is the top in Kingdom Battles: spread every ability over levels 1 to 10
  kitAbilities((lv20) => Math.max(1, Math.min(10, Math.ceil(lv20 / 2))));
  startGame(h);
  BUI.init({ respawn, lock: lockPointer });
  spawnBattleNpcs(); BUI.questTrack(); document.body.classList.add('battlefx');
  setTimeout(() => { if (document.getElementById('bgoal')) return; const d = document.createElement('div'); d.id = 'bgoal'; d.innerHTML = `<div class="bsgoal">${BATTLE_GOAL}<div class="brow"><button class="btn gold big" id="bgoalGo">To battle!</button></div></div>`; document.body.appendChild(d); G.uiOpen = true; if (document.pointerLockElement) document.exitPointerLock(); const go = () => { d.remove(); G.uiOpen = false; lockPointer(); }; d.querySelector('#bgoalGo').onclick = go; setTimeout(() => { if (d.isConnected) go(); }, 25000); }, 600);
  if (MP.client) mpSend({ t: 'booted' });
  if (MP.on) setMpStatus('playing');
  UI.banner('Kingdom Battles', `${t.name} awaits your command`, 4500);
  setTimeout(() => BUI.report('steward', `welcome home. I will run ${t.name} for you: hire the workers, gather wood and stone and raise the walls. You lead the fight. Hunt the beasts of the wilds, grow strong, and break the enemy halls.`, 'big'), 2500);
  setTimeout(() => BUI.report('captain', 'the army will march when it is ready. Press B any time for a war report or to give orders.', 'war'), 9000);
}
// every player on the same side shares every kill (full XP and their own loot roll), wherever they are
const SHARE_R = Infinity;
function battleHooks() {
  const H = G.hooks;
  // kills: XP and your own loot go straight to you (auto loot), gold goes to the town
  H.onKill = (mob, src, fromHost, earns = true) => { if (G.player && src === G.player) G.player.onKillPerks && G.player.onKillPerks(mob);
    let sharedKill = fromHost ? !earns : false;
    if (mob.team != null) return;
    // online, on the host: every hero on the killer's side who is close by gets the full XP and their own loot
    if (MP.on && MP.host && !mob._shared) {
      mob._shared = true;
      const team = src && src.team != null ? src.team : Battle.B.myTeam;
      const mates = [...MP.remotes.values()].filter(r => r.team === team);
      const earner = src && src.remote && src.team === team ? src : team === Battle.B.myTeam ? G.player : mates[0];
      for (const r of mates) mpSend({ t: 'kill', to: r.netId, i: mob.netIdx, xp: r === earner ? 1 : 0 });
      if (team !== Battle.B.myTeam) return;
      sharedKill = earner !== G.player;
    } else if (src && src.remote) return;
    const p = G.player; if (!p || (!fromHost && mob.pos.distanceTo(p.pos) > SHARE_R)) return;
    Game.onKill(G.save, mob, sharedKill);
    BQ.questKill(mob);
    if (!mob.loot) return;
    // only weapons and armour drop (no materials, no cloaks); bosses always drop a few good pieces
    const gearOnly = () => { for (let k = 0; k < 6; k++) { const g = Game.randomGear(G.save, mob.lv, mob.bossy ? 3 : mob.def.elite ? 2 : 1); if (g.kind !== 'acc') return g; } return null; };
    mob.loot.items = []; mob.loot.gear = mob.loot.gear.filter(g => g.kind !== 'acc');
    const n = mob.bossy ? 3 : Math.random() < (mob.def.elite ? 0.7 : 0.22) ? 1 : 0; for (let k = 0; k < n; k++) { const g = gearOnly(); if (g) mob.loot.gear.push(g); }
    mob.loot.gold = (mob.loot.gold || 0) + 6 + mob.lv * 4 + (mob.bossy ? 150 + mob.lv * 20 : 0);
    if (mob.bossy) UI.banner(`${mob.name} defeated!`, 'Boss loot is in your bag', 3500);
    const got = mob.loot.gear.slice();
    Game.lootCorpse(G.save, mob);
    // auto-equip better armour (never weapons) unless turned off, then celebrate each piece
    const h = G.save, score = (it) => (it ? (it.armor || 0) * 1.5 + Object.values(it.stats || {}).reduce((a, b) => a + b, 0) * 2 + it.rarity * 2 : -1);
    for (const g of got) {
      let eq = false; const i = h.inv.indexOf(g);
      if (i >= 0 && settings.autoEquip !== false && g.kind !== 'weapon' && Game.canEquip(h, g)) { const cur = h.equip[g.slot]; if (score(g) > score(cur)) eq = Game.equipFromInv(h, i); }
      // a better weapon of the same kind you already use goes straight into that hand (either weapon set)
      else if (i >= 0 && settings.autoEquip !== false && g.kind === 'weapon') {
        const wscore = (it) => (it ? (it.dmg || 0) * 2 + Object.values(it.stats || {}).reduce((a, b) => a + b, 0) * 2 + it.rarity * 2 : -1);
        const slot = ['w1', 'w2', 'w3', 'w4'].find(k => h.equip[k] && h.equip[k].wt === g.wt && wscore(g) > wscore(h.equip[k]));
        if (slot) { eq = Game.equipFromInv(h, i, slot); if (eq && G.player) G.player.refreshGear(); }
      }
      BUI.lootPopup(g, eq);
    }
  };
  H.carryFull = (N) => { const k = N.item === 'wood' ? 'wood' : N.item === 'stone' ? 'stone' : null; if (!k) return null; const cap = BUI.heroCarryCap(); return G.save.carry[k] >= cap ? `You can't carry more ${k}. Unload it at the Storehouse in town.` : null; };
  H.gatherBank = (item, n) => { const k = item === 'wood' ? 'wood' : item === 'stone' ? 'stone' : null; if (!k) return false; const cap = BUI.heroCarryCap(), c = G.save.carry; const amt = Math.min(n * 4, cap - c[k]); if (amt > 0) { c[k] += amt; UI.toast(`+${amt} ${k} (carrying ${c[k]}/${cap})`, BUI.resIcon(k), 'gold'); } if (c[k] >= cap) UI.toast(`Full of ${k}! Take it to the Storehouse in town.`, BUI.resIcon(k), 'bad'); return true; };
  H.battleXp = (n) => Game.gainXp(G.save, n);
  let mirroring = false;
  H.xpGained = (n, why) => { if (why) UI.toast(`+${n} XP · ${why}`, '✦', 'xp'); if (MP.on && !mirroring && n > 0) mpSend({ t: 'txp', n, why: why || '', team: Battle.B.myTeam }); };
  H.teamXp = (n, why) => { if (!G.save) return; mirroring = true; try { Game.gainXp(G.save, n, why ? why + ' (team)' : 'Team'); } finally { mirroring = false; } };
  H.banner = (a, b, ms) => UI.banner(a, b, ms);
  H.matchOver = (r) => BUI.matchOver(r);
  H.killReward = (g, u) => UI.toast(`+${g} gold · ${u.name}`, Icons.coin(), 'gold');
  H.trained = (u) => UI.toast(`${u.name} ready`, '⚔', 'gold');
  H.talk = (npc) => { S.click(); const role = npc.def.battleRole; if (role === 'hunt' || role === 'quarter') { BQ.turnIn(role); BUI.questTrack(); } if (role) BUI.openNpc(role); else UI.openDialog(npc); };
  const lvUp = H.levelUp; H.levelUp = (lv, un) => { lvUp(lv, un); const g = ECON.levelGold(lv); Battle.bank(Battle.myTown(), 'gold', g); UI.toast(`+${g} gold for reaching level ${lv}`, Icons.coin(), 'gold'); };
  H.died = () => { G.save.deaths = (G.save.deaths || 0) + 1; BUI.died(); };
  H.cmd = (who, text, kind) => BUI.report(who, text, kind);
  H.rally = () => {};
  H.allyFx = (p, [r, heal, kind, dur], up) => { const R = r * Math.sqrt(up); if (MP.client) mpSend({ t: 'fx', x: p.x, z: p.z, r: R, heal: heal ? heal * up : 0, kind: kind || null, dur: dur ? dur * up : 0 }); else { if (heal) Battle.allyHeal(p, R, heal * up); if (kind) Battle.allyBuff(p, R, kind, dur * up); } V.ring(p, R, heal ? '#80ff90' : kind === 'ward' ? '#80d8ff' : '#ffd84a', 0.7); }
  H.summonPet = (pet, p, lv, dur, n, big) => { if (MP.client) mpSend({ t: 'summon', kind: 'pet', pet, x: p.x, z: p.z, lv, dur, n, big }); else Battle.summonPet(pet, p, lv, dur, n, big); };
  H.spiritWolf = (p, lv, dur) => { if (MP.client) mpSend({ t: 'summon', kind: 'spirit', x: p.x, z: p.z, lv, dur }); else Battle.spiritWolf(p, lv, dur); };
  H.alliesNear = (p, r) => { const out = []; for (const u of Battle.B.units) if (!u.dead && u.team === Battle.B.myTeam && !u.worker && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < r) out.push(u); for (const x of MP.remotes.values()) if (!x.dead && x.team === Battle.B.myTeam && Math.hypot(x.pos.x - p.x, x.pos.z - p.z) < r) out.push(x); return out; };
  H.summonWolves = (p, lv, dur) => { if (MP.client) mpSend({ t: 'summon', x: p.x, z: p.z, lv, dur }); else Battle.summonWolves(p, lv, dur); };
  // online plumbing
  G.mpSend = mpSend; G.mpMobStep = Sync.proxyMobStep;
  H.netData = Sync.onData;
  H.netSay = (to, who, text, kind) => mpSend({ t: 'say', to, who, text, kind });
  H.netHeal = (h, pct) => mpSend({ t: 'heal', to: h.netId, pct });
  H.netBuff = (h, kind, dur) => mpSend({ t: 'buff', to: h.netId, kind, dur });
  H.warHorn = (d) => BUI.warHorn(d);
  H.teamSay = (who, text, kind) => { if (MP.on) mpSend({ t: 'teamsay', team: Battle.B.myTeam, who, text, kind }); };
  H.netLeave = (id) => {
    if (!Battle.B.towns.length) return;
    if (id === 0 && MP.client) { UI.banner('The host left the game', 'The battle has ended', 6000); setTimeout(() => { location.href = location.pathname; }, 6000); return; }
    const info = MP.players.get(id); const r = MP.remotes.get(id); if (r) { r.remove(); const i = G.mobs.indexOf(r); if (i >= 0) G.mobs.splice(i, 1); MP.remotes.delete(id); }
    const t = Battle.B.towns.find(x => (x.members || []).includes(id) || x.owner === id); if (t) { t.members = (t.members || []).filter(m => m !== id); if (t.leader === r) t.leader = null; if (!t.members.length && !t.isMe) { t.owner = null; t.ai = true; } else if (t.owner === id) t.owner = t.members.find(m => m !== MP.myId) ?? null; }
    BUI.report('scout', `${info ? info.name : 'a player'} has left the battle. The computer takes over their town.`, '');
  };
  H.sentry = (x, z, lv) => Battle.placeSentry(x, z, lv);
  // selling loot: the gold goes into your town; giving: straight into another player's bag
  H.sellItem = (i) => { const h = G.save, it = h.inv[i]; if (!it || !it.kind) return; const g = Game.itemValue(it); h.inv[i] = null; Battle.bank(Battle.myTown(), 'gold', g); S.coins(); UI.toast(`Sold ${it.name}: +${g} gold for ${Battle.myTown().name}`, Icons.coin(), 'gold'); H.invChanged && H.invChanged(); };
  H.tradeTargets = () => [...MP.remotes.values()].map(r => ({ id: r.netId, name: r.heroName, col: TEAM_COLORS[r.team] || '#888' }));
  H.giveItem = (i, to) => { const h = G.save, it = h.inv[i]; const r = MP.remotes.get(to); if (!it || !r) return; h.inv[i] = null; mpSend({ t: 'give', to, item: it, from: h.name }); S.loot && S.loot(); UI.toast(`Gave ${it.name || 'an item'} to ${r.heroName}`, '🎁', 'gold'); H.invChanged && H.invChanged(); };
  H.gotItem = (d, from) => { const h = G.save, i = h.inv.indexOf(null); if (i < 0) { mpSend({ t: 'give', to: from, item: d.item, from: h.name, back: 1 }); UI.toast(`${d.from} tried to give you ${d.item.name || 'an item'}, but your bag is full`, '🎒', 'bad'); return; } h.inv[i] = d.item; S.loot && S.loot(); UI.toast(d.back ? `${d.from}'s bag was full: ${d.item.name} came back to you` : `${d.from} gave you ${d.item.name || 'an item'}!`, '🎁', 'gold'); if (d.item.kind && !d.back) BUI.lootPopup(d.item, false); H.invChanged && H.invChanged(); };
}
const B_DEAD = (m) => false;

// ---------- hooks ----------
function hooks() {
  const H = G.hooks;
  H.toast = (t, i, k) => UI.toast(t, i, k);
  H.invChanged = () => { UI.refreshOpen(); UI.updateTracker(); };
  H.gearChanged = (swap) => { G.player && G.player.refreshGear(); portraitCh = null; UI.refreshAbilityBar(); UI.refreshOpen(); };
  H.masteryUp = (fam, lv) => { const aw = Game.activeWeapon(G.save), wt = aw && familiesOf(aw.wt)[0] === fam ? aw.wt : null;
    const un = wt ? Game.weaponUnlocks(wt).filter(u => u.lv === lv).map(u => `${u.key}: ${u.what}`) : [];
    const fn = FAMILIES[fam] ? FAMILIES[fam].name : fam; chatAdd(`<b class="sk">You have become better at ${fn}! (${lv})</b>${un.length ? ' Learned: ' + un.join(', ') + '.' : ' Faster and a little harder hitting.'}`, 'skill');
    UI.banner(`${fn} skill ${lv}`, un.length ? 'Learned: ' + un.join(' · ') : 'Faster and a little harder hitting', 3800); S.levelUp(); UI.refreshAbilityBar && UI.refreshAbilityBar(); };
  H.skillUp = (name, lv) => { chatAdd(`<b class="sk">You have become better at ${name}! (${lv})</b>`, 'skill'); if (lv % 5 === 0) UI.toast(`${name} skill ${lv}`, '🌊', 'gold'); };
  H.masteryTick = () => {}; // (skill progress is not reported, only each new point)
  H.newWeapon = (wt) => { chatAdd(`You pick up a new kind of weapon: <b>${WEAPON_TYPES[wt].name}</b>. `, 'skill'); UI.toast(`New weapon skill: ${WEAPON_TYPES[wt].name}. Use it to learn its attacks (press L)`, '⚔', 'gold'); };
  H.questsChanged = () => UI.updateTracker();
  H.hotbarAdded = (list) => { UI.refreshAbilityBar(); };
  H.objective = (q, o, n) => { S.objective(); UI.toast(`${o.label}: ${n}/${o.n}`, '📜', 'gold'); if (Game.questComplete(G.save, q)) UI.banner('Objective complete', `${q.title}: return to ${(q.turnin && NPCS[q.turnin] ? NPCS[q.turnin].name : "the story")}`, 2600); };
  H.questDone = (q) => { UI.banner('Quest Complete!', q.title); };
  H.xpGained = (n, why) => UI.toast(`+${n} XP${why ? ' · ' + why : ''}`, '✦', 'xp');
  H.onKill = (mob, src) => { if (src && src.isGuard) { mob.loot = { items: [], gold: 0, gear: [] }; mob.looted = true; return; } if (G.player && (src === G.player || !src)) G.player.onKillPerks && G.player.onKillPerks(mob); Game.onKill(G.save, mob); if (settings.autoLoot !== false) setTimeout(() => { if (mob.dead && Game.hasLoot(mob)) Game.lootCorpse(G.save, mob); }, 650); const p = G.player; if (p && Game.perk(G.save, 'bloodlust')) p.heal(p.maxHp * 0.05); };
  H.mastery = (m) => { UI.banner(`Dual Wield Mastery: Rank ${m.rank}`, `${m.name}: ${m.desc}`, 4500); S.levelUp(); UI.refreshAbilityBar(); };
  H.levelUp = (lv, unlocked) => {
    const p = G.player; p.refreshGear(); p.hp = p.maxHp; p.mana = p.maxMana; p.end = p.maxEnd;
    UI.banner(`Level ${lv}!`, (unlocked.length ? 'Unlocked: ' + unlocked.join(' · ') + ' · ' : '') + (G.noTalents ? 'Your abilities grow stronger' : 'New talent point: press N'), 4500);
    S.levelUp(); V.burst('gold', p.pos.clone().setY(p.pos.y + 1), 80, { speed: 5, vy: 4, grav: -1, life: 1.6 }); V.ring(p.pos, 5, '#ffe090', 0.8); V.sphereFlash(p.pos.clone().setY(p.pos.y + 1), 2, '#ffe8a0', 0.6); V.light(p.pos.clone().setY(p.pos.y + 2), '#ffd080', 6, 1.2);
    Game.autoFillHotbar(G.save); UI.refreshAbilityBar(); saveNow();
    for (const u of unlocked) setTimeout(() => UI.toast(`Unlocked: ${u}`, '✦', 'gold'), 600);
  };
  H.talk = (npc) => { S.click(); if (storyTalk(G.save, npc)) return; UI.openDialog(npc); };
  H.storyStep = (id) => { const st = { mq_walls: 1, mq_hides: 2, mq_towers: 3, mq_gold: 4, mq_people: 5 }[id]; UI.updateTracker();
    const NAMES = [null, ['Seabreak is walled', 'A palisade with a gate on every road'], ['The armoury is open', 'The watch has leather armour now'], ['Watchtowers raised', 'Four towers watch the gates'], ['New guards hired', 'The barracks are full'], ['The siege yard is finished', 'Seabreak is stronger than it has ever been']];
    if (st) { UI.toast('The builders are at work...', '🔨', 'gold'); startConstruction(st, (k) => { UI.banner(NAMES[k][0], NAMES[k][1], 3500); S.levelUp && S.levelUp(); }); } };
  H.moreGuards = (n) => spawnGuards([{ x: VILLAGE.x, z: VILLAGE.z, r: 60, n, col: '#3a7a3a' }]);
  H.relock = () => lockPointer();
  // summons in the campaign (Kingdom Battles overrides these with town pets)
  if (!BATTLE) H.spiritWolf = (p, lv, dur) => summonPets('spirit', p, 1 + (lv - 1) * 9 / (LEVEL_CAP - 1), dur, 1);
  H.castBar = (name, k) => { let e = $('castbar'); if (!e) { e = document.createElement('div'); e.id = 'castbar'; e.innerHTML = '<b></b><i><u></u></i>'; $('hud').appendChild(e); }
    if (name == null) { e.hidden = true; return; } e.hidden = false; e.querySelector('b').textContent = name; e.querySelector('u').style.width = Math.round(Math.min(1, k) * 100) + '%'; };
  H.chatter = (v) => { const P = G.player; v.yaw = Math.atan2(P.pos.x - v.pos.x, P.pos.z - v.pos.z); v.to = null; v.t = 6; S.click(); UI.openChatter(v); };
  H.mapLearned = (p, v) => chatAdd(`<b class="sk">Map updated:</b> ${p.name} <span style="color:#a8987a">(from ${v.vname})</span>`, 'skill');
  H.boat = () => { S.step('wood'); const q = G.save.quests;
    UI.toast("You can't set sail yet: the boat needs major repairs.", '⛵', 'bad');
    monologue(q.active.mq_boat ? 'Split plank, torn sail... I need a shipwright before she goes anywhere.' : 'She needs major repairs before she sails again.', 4200); };
  H.station = (type) => { S.click(); UI.openCrafting(type); };
  H.progress = (k, l) => UI.progress(k, l);
  H.died = () => { setTimeout(() => { $('death').hidden = false; if (document.pointerLockElement) document.exitPointerLock(); }, 1500); };
  H.telegraph = telegraph; H.enemyBlast = enemyBlast; H.enemyProjectile = enemyProjectile; H.mobShot = mobShot; H.mobBlast = mobBlast; H.telegraphSelf = telegraphSelf; H.telegraphLine = telegraphLine; H.telegraphCone = telegraphCone;
  H.saveQuit = quitToTitle;
  H.applyGraphics = applyGraphics;
  H.nodeDone = (n, p) => { if (n.type.startsWith('tree')) fallTree(n, p); else if (n.def.tool === 'pickaxe') { S.rockBreak(n); V.burst('stone', new THREE.Vector3(n.x, n.y + 0.5, n.z), 30, { speed: 6, size: 0.3, grav: 14 }); V.burst('dust', new THREE.Vector3(n.x, n.y + 0.5, n.z), 20, { speed: 3, size: 1.2, life: 1.5 }); } };
  if (BATTLE) battleHooks();
  G.onUiClosed = () => { G.uiClosedAt = performance.now(); if (mode === 'game' && !G.player.dead && !intro) lockPointer(); };
  $('btnRespawn').onclick = () => respawn();
}
function respawn() {
  const p = G.player; if (!p) return;
  if (BATTLE) { const t = Battle.myTown(); p.dead = false; p.hp = p.maxHp; p.mana = p.maxMana; p.end = p.maxEnd; p.place(t.x + t.dir[0] * 12, t.z + t.dir[1] * 12, t.yaw); $('death').hidden = true; lockPointer(); S.heal(); V.burst('heal', p.pos.clone().setY(p.pos.y + 1), 40, { speed: 3, vy: 3 }); return; }
  // nearest settlement
  const spots = [{ x: VILLAGE.x + 4, z: VILLAGE.z + 10 }, ...CAMPS.slice(0, 3).map(c => ({ x: c.x + 5, z: c.z + 5 }))];
  let best = spots[0]; for (const s of spots) if (Math.hypot(s.x - p.pos.x, s.z - p.pos.z) < Math.hypot(best.x - p.pos.x, best.z - p.pos.z)) best = s;
  p.dead = false; p.hp = p.maxHp * 0.6; p.mana = p.maxMana; p.end = p.maxEnd; p.place(best.x, best.z, p.yaw);
  for (const m of G.mobs) if (m.state === 'chase') m.state = 'return';
  $('death').hidden = true; lockPointer(); S.heal(); V.burst('heal', p.pos.clone().setY(p.pos.y + 1), 40, { speed: 3, vy: 3 });
}

// ---------- tree falling ----------
function fallTree(n, p) {
  const K = nodeKinds[n.kind]; if (!K) return;
  const pivot = new THREE.Group(); pivot.position.set(n.x, n.y - 0.2, n.z);
  const m = new THREE.Mesh(K.geo, K.mat); m.scale.set(n.s * 0.72, n.s, n.s * 0.72); m.rotation.y = Math.random() * 6; m.castShadow = true; pivot.add(m); scene.add(pivot);
  if (n.mesh && n.mesh.instanceColor) { /* keep it simple: default colours */ }
  const away = new THREE.Vector3(n.x - p.pos.x, 0, n.z - p.pos.z).normalize();
  const axis = new THREE.Vector3(away.z, 0, -away.x);
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * n.s, 0.4 * n.s, 0.5, 8), new THREE.MeshStandardMaterial({ color: '#5a3f28', roughness: 0.9 }));
  stump.position.set(n.x, n.y + 0.05, n.z); stump.castShadow = true; scene.add(stump); n.stump = stump;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * n.s, 0.3 * n.s, 0.02, 8), new THREE.MeshStandardMaterial({ color: '#d8b888' })); top.position.y = 0.26; stump.add(top);
  S.treeFall(new THREE.Vector3(n.x, n.y + 3, n.z));
  let t = 0, landed = false;
  G.timers.push({ update(dt) {
    t += dt;
    const k = Math.min(1, t / 1.9);
    const ang = Math.pow(k, 2.6) * (Math.PI / 2 - 0.08) + (k >= 1 ? Math.sin(Math.min(1, (t - 1.9) * 4) * Math.PI) * 0.04 : 0);
    pivot.quaternion.setFromAxisAngle(axis, ang);
    if (k >= 1 && !landed) {
      landed = true; V.addShake(0.3 * Math.max(0.2, 1 - p.pos.distanceTo(pivot.position) / 40));
      for (let i = 1; i < 6; i++) { const q = pivot.position.clone().addScaledVector(away, i * 2 * n.s); q.y = heightAt(q.x, q.z) + 0.3; V.burst('dust', q, 6, { speed: 3, size: 1, life: 1.2 }); V.burst('leaf', q.clone().setY(q.y + 1), 6, { speed: 3, size: 0.2, grav: 1.5, life: 2.2 }); }
    }
    if (t > 7) { pivot.position.y -= dt * 1.2; }
    if (t > 9.5) { scene.remove(pivot); return true; }
    return false;
  } });
}

// ---------- intro cinematic: sailing in ----------
// First person in your own little boat, far out at sea, with the island only a hazy coast on the horizon.
// You can look around while she rocks; after half a minute a gull drops in, does its business and leaves,
// then the scene cuts to the pier with the boat tied up beside you.
const SAIL = { dur: 30, speed: 4.2, from: { x: -90, z: 1500 } };
function startIntro() {
  const p = G.player;
  const boat = world.myBoat || placeHomeBoat(scene);
  const home = world.myBoatHome, to = { x: home.x, z: home.z }, yaw = Math.atan2(to.x - SAIL.from.x, to.z - SAIL.from.z);
  intro = { t: 0, boat, yaw, ly: 0, lp: -0.05, gulls: [], poop: null, fade: 0 };
  boat.position.set(SAIL.from.x, BOAT_Y, SAIL.from.z); boat.rotation.set(0, yaw, 0);
  // a few gulls wheel about overhead the whole way in; one of them has plans
  for (let i = 0; i < 4; i++) { const g = buildGull(); scene.add(g); intro.gulls.push({ g, a: Math.random() * 6.28, r: 9 + Math.random() * 9, y: 8 + Math.random() * 6, sp: 0.35 + Math.random() * 0.25, ph: Math.random() * 6 }); }
  intro.lander = { g: buildGull(), st: 'away' }; scene.add(intro.lander.g); intro.lander.g.visible = false;
  $('intro').hidden = false; $('intro').classList.add('sail'); $('hud').hidden = true;
  p.vm.g.visible = false; p.ch.root.visible = false;
  G.tod = 0.42; // a bright, clear late morning
  intro.lines = [[3.0, 'There it is. Land, at last.'], [11.0, 'Easy now, old girl. Not much further.'], [24.6, '...Really?']];
  M.play('explore'); M.soonSong && M.soonSong();
  lockPointer();
}
function introBoatTo(I, dt) {
  const b = I.boat, t = I.t;
  b.position.x += Math.sin(I.yaw) * SAIL.speed * dt; b.position.z += Math.cos(I.yaw) * SAIL.speed * dt;
  b.position.y = BOAT_Y + Math.sin(t * 1.05) * 0.14 + Math.sin(t * 0.47 + 1) * 0.07;
  b.rotation.set(Math.sin(t * 0.62 + 0.8) * 0.035, I.yaw + Math.sin(t * 0.21) * 0.03, Math.sin(t * 0.83) * 0.07, 'YXZ');
  const sail = b.userData.sail; if (sail) sail.scale.z = 1 + Math.sin(t * 1.7) * 0.06;
}
function updateIntro(dt) {
  const p = G.player, I = intro; I.t += dt; const t = I.t, b = I.boat;
  introBoatTo(I, dt);
  // the island only as a far-off coast: push the haze back and draw its trees far away
  if (water.sea) water.sea.position.set(Math.round(b.position.x / 32) * 32, water.sea.position.y, Math.round(b.position.z / 32) * 32); // the sea reaches the horizon all round
  // the eye: sitting at the stern, rocking with the boat, free to look around
  b.updateMatrixWorld(true);
  const eye = b.userData.seat.clone().applyMatrix4(b.matrixWorld);
  camera.rotation.order = 'YXZ'; camera.rotation.set(I.lp + b.rotation.x * 0.8, I.yaw + I.ly + Math.PI, b.rotation.z * 0.9);
  camera.position.copy(eye);
  p.pos.set(eye.x, 0.3, eye.z); p.yaw = I.yaw + I.ly; p.pitch = I.lp;
  A.setListener(eye.x, eye.y, eye.z, p.yaw + Math.PI);
  setAmbience({ sea: 1, wind: 0.55, forest: 0, waterfall: 0, fire: 0, lava: 0, night: 0 });
  // circling gulls
  for (const q of I.gulls) { q.a += q.sp * dt; const x = b.position.x + Math.cos(q.a) * q.r, z = b.position.z + Math.sin(q.a) * q.r, y = q.y + Math.sin(t * 0.6 + q.ph) * 1.2; q.g.position.set(x, y, z); q.g.rotation.set(0, Math.atan2(-Math.sin(q.a), Math.cos(q.a)), -0.35); flap(q.g, t * 9 + q.ph, Math.sin(t * 0.5 + q.ph) > 0.2 ? 0.15 : 1); }
  if (Math.random() < dt * 0.35) S.gull && S.gull({ x: b.position.x + (Math.random() - 0.5) * 30, y: 12, z: b.position.z + (Math.random() - 0.5) * 30 });
  // the gull that lands on the bow, poops and leaves
  const L = I.lander, g = L.g, perch = b.userData.bow.clone().applyMatrix4(b.matrixWorld);
  if (t > 17 && L.st === 'away') { L.st = 'in'; g.visible = true; L.from = new THREE.Vector3(b.position.x + Math.sin(I.yaw) * 40 + 14, 16, b.position.z + Math.cos(I.yaw) * 40); L.t0 = t; S.gull && S.gull(L.from); }
  if (L.st === 'in') { const k = Math.min(1, (t - L.t0) / 4.2), e = k * k * (3 - 2 * k); g.position.lerpVectors(L.from, perch, e); g.position.y += Math.sin(k * Math.PI) * 2.5; g.lookAt(perch.x, g.position.y, perch.z); flap(g, t * 10, k > 0.8 ? 1.4 : 0.6); if (k >= 1) { L.st = 'perch'; L.t0 = t; S.gull && S.gull(perch); } }
  if (L.st === 'perch') {
    g.position.copy(perch); g.position.y += 0.2; g.rotation.set(0, I.yaw + Math.PI + Math.sin(t * 1.3) * 0.5, 0); flap(g, 0, 0, true);
    if (!I.poop && t - L.t0 > 2.0) { // plop
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), new THREE.MeshStandardMaterial({ color: '#f2f0e6', roughness: 0.4 }));
      b.add(drop); const lp = b.userData.bow.clone(); lp.y += 0.1; lp.z -= 0.22; drop.position.copy(lp); I.poop = { m: drop, v: 0, landed: false };
    }
    if (t - L.t0 > 4.6) { L.st = 'out'; L.t0 = t; L.from = g.position.clone(); L.to = g.position.clone().add(new THREE.Vector3(Math.cos(I.yaw) * 30, 14, -Math.sin(I.yaw) * 30)); S.gull && S.gull(perch); }
  }
  if (L.st === 'out') { const k = Math.min(1, (t - L.t0) / 4); g.position.lerpVectors(L.from, L.to, k * k); g.lookAt(L.to); flap(g, t * 11, 1.3); if (k >= 1) { L.st = 'gone'; g.visible = false; } }
  if (I.poop && !I.poop.landed) { const P = I.poop; P.v += 9.8 * dt; P.m.position.y -= P.v * dt; if (P.m.position.y <= 0.62) { P.landed = true; P.m.position.y = 0.62; P.m.scale.set(2.4, 0.35, 2.0); S.plop && S.plop(); } }
  // subtitles (your own thoughts)
  const sub = document.querySelector('#intro .sub');
  let line = ''; for (const [at, l] of I.lines) if (t > at && t < at + 3.2) line = l;
  if (sub.textContent !== line) { sub.style.opacity = 0; setTimeout(() => { sub.textContent = line; sub.style.opacity = line ? 1 : 0; }, line ? 150 : 0); }
  // fade to black, then arrive at the pier
  const fd = $('sailfade'); if (t > SAIL.dur) { fd.style.opacity = 1; if (t > SAIL.dur + 1.6) endIntro(); }
}
function endIntro() {
  if (!intro) return;
  const I = intro; intro = null; const p = G.player;
  for (const q of I.gulls) scene.remove(q.g); scene.remove(I.lander.g);
  if (I.poop) { I.boat.remove(I.poop.m); I.poop.m.scale.set(2.4, 0.35, 2.0); I.poop.m.position.y = 0.62; I.boat.add(I.poop.m); } // it stays. of course it stays.
  if (water.sea) water.sea.position.set(0, water.sea.position.y, 0);
  const H0 = world.myBoatHome; I.boat.position.set(H0.x, BOAT_Y, H0.z); I.boat.rotation.set(0, H0.yaw, 0);
  // standing on the pier beside her
  const P = world.pier, sx = P.x - 0.3, sz = H0.z - 13; p.place(sx, sz, Math.atan2(H0.x - sx, H0.z - sz)); p.ch.root.visible = true; p.pos.y = P.y + 0.02; if (p.vel) p.vel.set(0, 0, 0); p.onGround = true;
  $('intro').hidden = true; $('intro').classList.remove('sail'); canvas.style.filter = ''; $('hud').hidden = false;
  p.pitch = -0.1; G.save.introDone = true;
  startMainQuest(G.save);
  saveNow();
  const fd = $('sailfade'); setTimeout(() => { fd.style.opacity = 0; }, 400);
  setTimeout(() => monologue('I should see if I can find someone who can fix my boat.'), 1800);
  setTimeout(() => UI.banner('Driftwood Coast', 'Main quest: Repairs at Sea\'s End', 3500), 7600);
  setTimeout(() => UI.hint('The village is up the pier. People there may know a shipwright. Look for the gold <b style="color:#ffd84a">!</b> above heads and press <span class="kbd">E</span> to talk. Press <span class="kbd">E</span> at your boat to check on her. Scroll the mouse wheel for third person.', 12000), 11500);
  lockPointer();
}
// your own thoughts, shown in italics low on the screen
function monologue(text, ms = 5200) {
  const m = $('mono'); m.innerHTML = `<i>“${text}”</i><small>to yourself</small>`; m.hidden = false; m.classList.remove('out'); void m.offsetWidth; m.classList.add('in');
  clearTimeout(monologue.t); monologue.t = setTimeout(() => { m.classList.remove('in'); m.classList.add('out'); setTimeout(() => { m.hidden = true; }, 700); }, ms);
}
function startMainQuest(h) {
  const q = QUESTS.find(x => x.id === 'mq_boat'); if (!q || h.quests.done.includes(q.id) || h.quests.active[q.id]) return;
  Game.acceptQuest(h, q); h.trackQ = h.trackQ || null; UI.updateTracker();
}

// ---------- input ----------
let lockBusyUntil = 0;
function lockPointer() { if (mode !== 'game' || G.uiOpen || !canvas.requestPointerLock || document.pointerLockElement || performance.now() < lockBusyUntil - 700) return; lockBusyUntil = performance.now() + 900; try { const r = canvas.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => { try { canvas.requestPointerLock(); } catch (e) {} }); } catch (e) { try { canvas.requestPointerLock(); } catch (e2) {} } }
// ---------- pet commands (G): tap = attack your target; hold = command wheel ----------
const PET_OPTS = [
  { id: 'attackTarget', icon: '⚔', name: 'Attack my target' },
  { id: 'attack', icon: '🔥', name: 'Aggressive', tip: 'Attack anything hostile near you' },
  { id: 'guard', icon: '🛡', name: 'Guard me', tip: 'Attack what you attack, and what attacks you' },
  { id: 'stay', icon: '✋', name: 'Stay here', tip: 'Hold this spot; fight only what comes close' },
  { id: 'follow', icon: '👣', name: 'Follow', tip: 'Stay at your side and never fight' },
  { id: 'taunt', icon: '📢', name: 'Taunt', tip: 'On: enemies they hit turn on them. Off: they leave enemies to you' },
];
function petTarget() {
  const p = G.player, t = G.target;
  if (t && !t.dead && !t.pet && isFoe(t) && t.pos.distanceTo(p.pos) < 40) return t;
  let best = null, bd = 1e9; for (const m of mobsInCone(p.pos, p.yaw, 35, 0.22)) { if (m.pet) continue; const d = m.pos.distanceTo(p.pos); if (d < bd) { bd = d; best = m; } }
  return best;
}
function petTap() {
  if (!pets().length) { UI.toast(BATTLE ? 'Pet orders work in the campaign' : 'You have no pet. Summon one first.', '🐾', 'bad'); return; }
  const t = petTarget(); if (!t) { UI.toast('No target: aim at an enemy, or hit one first', '🐾', 'bad'); return; }
  petCommand('attackTarget', t); S.click(); UI.toast(`Pets: attack ${t.name}!`, '⚔', 'gold');
}
let petWheel = null;
function openPetWheel() {
  if (!pets().length) { petTap(); return; }
  let e = $('petwheel'); if (!e) { e = document.createElement('div'); e.id = 'petwheel'; document.body.appendChild(e); }
  e.innerHTML = '<div class="pwc">Pet orders<small>move the mouse, let go of Z</small></div>' + PET_OPTS.map((o, i) => { const a = -Math.PI / 2 + i / PET_OPTS.length * Math.PI * 2; return `<div class="pwo" data-i="${i}" style="left:calc(50% + ${Math.cos(a) * 150}px);top:calc(50% + ${Math.sin(a) * 150}px)"><b>${o.icon}</b><span>${o.id === 'taunt' ? `Taunt: ${PETS.taunt ? 'on' : 'off'}` : o.name}</span>${o.id === PETS.mode ? '<i>current</i>' : ''}</div>`; }).join('');
  e.hidden = false; petWheel = { x: 0, y: 0, sel: -1 }; S.click();
}
function petWheelMove(dx, dy) {
  const w = petWheel; w.x = Math.max(-200, Math.min(200, w.x + dx)); w.y = Math.max(-200, Math.min(200, w.y + dy));
  let sel = -1; if (Math.hypot(w.x, w.y) > 40) { const a = Math.atan2(w.y, w.x) + Math.PI / 2; sel = Math.round(((a / (Math.PI * 2)) * PET_OPTS.length + PET_OPTS.length) % PET_OPTS.length) % PET_OPTS.length; }
  if (sel !== w.sel) { w.sel = sel; $('petwheel').querySelectorAll('.pwo').forEach(o => o.classList.toggle('on', +o.dataset.i === sel)); }
}
function closePetWheel() {
  const w = petWheel; petWheel = null; const e = $('petwheel'); if (e) e.hidden = true; if (!w || w.sel < 0) return;
  const o = PET_OPTS[w.sel];
  if (o.id === 'attackTarget') { petTap(); return; }
  petCommand(o.id); S.click(); UI.toast(o.id === 'taunt' ? `Pet taunt ${PETS.taunt ? 'on' : 'off'}` : `Pets: ${o.name}`, o.icon, 'gold');
}
// the pet panel: names, health, orders
let petBarT = 0;
function updatePetBar(dt) {
  if ((petBarT -= dt) > 0) return; petBarT = 0.2;
  const list = pets(); let e = $('petbar');
  if (!list.length) { if (e) e.hidden = true; return; }
  if (!e) { e = document.createElement('div'); e.id = 'petbar'; $('hud').appendChild(e); }
  const mode = PET_OPTS.find(o => o.id === PETS.mode);
  const html = `<div class="pbh"><b>${mode.icon} ${mode.name}</b><span>Taunt ${PETS.taunt ? 'on' : 'off'} · <kbd>G</kbd> tap: attack · hold: orders</span></div>` + list.map(m => `<div class="pbp"><span>${m.name}</span><i><u style="width:${Math.max(0, Math.round(m.hp / m.maxHp * 100))}%"></u></i>${m.tgt && !m.tgt.dead ? `<small>⚔ ${m.tgt.name}</small>` : ''}</div>`).join('');
  if (e._h !== html) { e.innerHTML = html; e._h = html; } e.hidden = false;
}
function input() {
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (mode !== 'game') { if (e.code === 'Escape' && $('windows').children.length) UI.closeWin(); return; }
    if (intro) { if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') endIntro(); return; }
    if (inScene()) { e.preventDefault(); if (!e.repeat) sceneKey(e.code); return; }
    if (e.code === 'Enter' && !e.repeat && !G.uiOpen && !G.chatting) { e.preventDefault(); for (const k in G.keys) G.keys[k] = false; if (G.player) { G.player.press = null; G.player.rmbHeld = false; } if (document.pointerLockElement) document.exitPointerLock(); openChat(); return; }
    if (e.code === 'Tab') { e.preventDefault(); if (BATTLE && mode === 'game' && !e.repeat) BUI.scoreboard(true); }
    const p = G.player;
    if (!e.repeat) {
      const map = { KeyI: 'inv', KeyJ: 'quests', KeyN: 'talents', KeyM: 'map', KeyP: 'craft' };
      if (UI.dialogKey(e.code)) { e.preventDefault(); return; }
      if (e.code === 'KeyK' || e.code === 'KeyN') { BUI.openBook('abil'); return; }
      if (YARD && e.code === 'KeyY') { if (UI.UI.open === 'yard') UI.closeWin(); else openYardPanel(UI); return; }
      if (e.code === 'KeyO' && !BATTLE) { UI.toggleMainOnly(); return; }
      if (e.code === 'KeyQ' && G.uiOpen && UI.UI.open === 'inv' && G.player) { G.player.swapWeapon(); UI.refreshOpen(); return; } // swap weapon sets with the bag open
      if (e.code === 'KeyG' && !G.uiOpen) { const t0 = performance.now(); G.zDown = t0; setTimeout(() => { if (G.zDown === t0 && !petWheel) openPetWheel(); }, 260); return; }
      if (BATTLE && e.code === 'KeyJ') { if (G.uiOpen) UI.closeWin(); else BUI.openNpc('jobs'); return; }
      if (BATTLE && e.code === 'KeyE' && BUI.jobKey()) return;
      if (BATTLE && e.code === 'KeyP') { UI.toast('No crafting in Kingdom Battles', '·'); return; }
      if (map[e.code]) { S.click(); UI.toggleWin(map[e.code]); return; }
      if (e.code === 'Escape') { if (G.uiOpen) { UI.closeWin(); } else UI.openPause(); return; }
    }
    G.keys[e.code] = true;
    if (!e.repeat && !G.uiOpen && p) { p.onKey(e.code, true); p.tapRoll(e.code); }
  });
  addEventListener('keyup', (e) => { if (e.code === 'KeyG' && G.zDown) { const held = performance.now() - G.zDown; G.zDown = 0; if (petWheel) closePetWheel(); else if (held < 260 && mode === 'game' && !G.uiOpen) petTap(); } if (e.code === 'Tab' && BATTLE) BUI.scoreboard(false); G.keys[e.code] = false; if (mode === 'game' && G.player) G.player.onKeyUp(e.code); });
  addEventListener('blur', () => { for (const k in G.keys) G.keys[k] = false; });
  addEventListener('mousedown', () => { if (inScene()) sceneAdvance(); }, true);
  canvas.addEventListener('mousedown', (e) => { if (inScene()) return;
    if (mode !== 'game' || intro) return;
    if (!document.pointerLockElement) { if (!G.uiOpen && !G.player.dead) lockPointer(); return; }
    G.player.onMouse(e.button, true);
  });
  addEventListener('mouseup', (e) => { if (mode === 'game' && G.player && document.pointerLockElement) G.player.onMouse(e.button, false); else if (G.player) G.player.press = null; });
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => { if (petWheel) { petWheelMove(e.movementX, e.movementY); return; } if (intro && document.pointerLockElement) { const k = 0.0032 * (settings.sens || 1); intro.ly = Math.max(-2.6, Math.min(2.6, intro.ly - e.movementX * k)); intro.lp = Math.max(-1.0, Math.min(1.1, intro.lp - e.movementY * k)); return; } if (mode === 'game' && document.pointerLockElement && G.player && !intro && !G.uiOpen) { G.player.look(e.movementX, e.movementY); if (G.player.camDist < 0.6) { camera.rotation.order = 'YXZ'; camera.rotation.x = G.player.pitch; camera.rotation.y = G.player.yaw + Math.PI; } G.player.lookDX = (G.player.lookDX || 0) + e.movementX; G.player.lookDY = (G.player.lookDY || 0) + e.movementY; } });
  addEventListener('wheel', (e) => { if (mode === 'game' && G.player && !G.uiOpen) G.player.onWheel(e.deltaY); }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    const locked = !!document.pointerLockElement;
    $('clickToPlay').hidden = locked || mode !== 'game' || G.uiOpen || intro || (G.player && G.player.dead);
    // only the Esc key (the browser dropping the lock) opens the pause menu; unlocks caused by opening/closing our own windows are ignored
    if (locked || mode !== 'game' || G.uiOpen || intro || !G.player || G.player.dead) return;
    // never pop a menu up on its own: just show "click to continue" (Esc opens the menu)
    $('clickToPlay').hidden = false;
  });
  // a page change (title -> battle) always drops full screen in the browser: the first click puts it back
  let wantFs = false; try { wantFs = BATTLE && localStorage.getItem('kr2_fs') === '1'; } catch (e) {}
  if (wantFs) { const c = $('clickToPlay').firstElementChild; if (c) c.firstChild.textContent = 'Click to enter the battle'; }
  $('clickToPlay').addEventListener('click', () => { $('clickToPlay').hidden = true; if (BATTLE && !document.fullscreenElement) { goFull(); setTimeout(lockPointer, 350); } lockPointer(); });
  addEventListener('fullscreenchange', () => { if (document.fullscreenElement && mode === 'game' && !G.uiOpen && !document.pointerLockElement) setTimeout(lockPointer, 120); });
  addEventListener('beforeunload', () => { if (mode === 'game') saveNow(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'game') saveNow(); });
}

// ---------- world simulation ----------
const tmpV = new THREE.Vector3();
function updateDayNight(dt, focus) {
  if (mode === 'game') G.tod = (G.tod + dt / (22 * 60)) % 1;
  const a = (G.tod - 0.25) * Math.PI * 2;
  const sd = new THREE.Vector3(Math.cos(a) * 0.75, Math.sin(a), 0.35 + Math.cos(a) * 0.1).normalize();
  const sunY = sd.y;
  const c = skyColors(sunY);
  const night = Math.max(0, Math.min(1, (-sunY + 0.05) / 0.25));
  const lightDir = sunY > -0.05 ? sd : sd.clone().multiplyScalar(-1); // moonlight at night
  sun.position.copy(focus).addScaledVector(lightDir, 200); sun.target.position.copy(focus);
  sun.color.copy(night > 0.5 ? new THREE.Color('#8aa0d8') : c.sun); sun.intensity = night > 0.5 ? 0.45 : c.light * 2.0;
  hemi.intensity = c.amb * 1.25; hemi.color.copy(c.hor).lerp(new THREE.Color('#ffffff'), 0.3); hemi.groundColor.set(night > 0.5 ? '#1a1a28' : '#5a4a30');
  sky.mat.uniforms.sunDir.value.copy(sd); sky.mat.uniforms.top.value.copy(c.top); sky.mat.uniforms.horizon.value.copy(c.hor); sky.mat.uniforms.sunCol.value.copy(c.sun); sky.mat.uniforms.night.value = night; sky.mat.uniforms.time.value = G.time;
  // fog: zone tint
  const fogC = c.fog.clone(); const zn = G.zone;
  if (zn === 'ashlands') fogC.lerp(new THREE.Color('#5a3a30'), 0.55); if (zn === 'highlands') fogC.lerp(new THREE.Color('#d8e4f0'), 0.25); if (zn === 'wood') fogC.lerp(new THREE.Color('#5a7a5a'), 0.15);
  scene.fog.color.lerp(fogC, Math.min(1, dt * 2)); const vd = settings.viewDist;
  scene.fog.near = (zn === 'ashlands' ? 60 : zn === 'wood' ? 90 : 140) * vd; scene.fog.far = (zn === 'ashlands' ? 420 : zn === 'wood' ? 520 : 900) * vd;
  if (intro) { scene.fog.near = 350; scene.fog.far = 2600; } // sailing in: the island is a hazy coast on the horizon
  scene.background = null;
  for (const m of water.mats) { m.uniforms.time.value = G.time; m.uniforms.sunDir.value.copy(sd); m.uniforms.sky.value.copy(c.hor); m.uniforms.sunCol.value.copy(c.sun).multiplyScalar(night > 0.5 ? 0.2 : 1); m.uniforms.light.value = 0.35 + c.light * 0.5; m.uniforms.fogColor && m.uniforms.fogColor.value.copy(scene.fog.color); m.uniforms.fogNear && (m.uniforms.fogNear.value = scene.fog.near); m.uniforms.fogFar && (m.uniforms.fogFar.value = scene.fog.far); }
  fall.mat.uniforms.time.value = G.time; fall.mat.uniforms.light.value = 0.4 + c.light * 0.5;
  // windows & lamps glow at night
  const winGlow = Math.max(0, Math.min(1, (0.25 - sunY) / 0.3));
  if (!updateDayNight.winMat) { scene.traverse(o => { if (o.isMesh && o.material && o.material.emissive && o.material.color && o.material.color.getHexString() === 'ffd890') updateDayNight.winMat = o.material; }); }
  if (updateDayNight.winMat) updateDayNight.winMat.emissiveIntensity = winGlow * 1.6;
  renderer.toneMappingExposure = 0.95 + night * 0.25;
  return night;
}
function updateFires(dt, focus) {
  // nearest fires get the real lights; all near fires emit particles
  const list = world.fires.map(f => ({ f, d: f.pos.distanceTo(focus) })).sort((a, b) => a.d - b.d);
  fireLights.forEach((l, i) => { const e = list[i]; if (e && e.d < 70) { l.position.copy(e.f.pos).add(new THREE.Vector3(0, 0.6, 0)); l.intensity = (e.f.size > 0 ? 4 : 6) * (0.85 + Math.sin(G.time * 13 + i) * 0.08 + Math.sin(G.time * 29 + i * 2) * 0.07); l.distance = e.f.size > 0 ? 16 : 26; l.color.set(e.f.size > 0 ? '#ff9040' : '#ff5010'); } else l.intensity = 0; });
  for (const e of list) { if (e.d > 70) break; V.fireTick(e.f, dt, true); }
  // chimney smoke
  if (world.smokes) for (const s of world.smokes) if (s.distanceTo(focus) < 120 && Math.random() < dt * 3) V.norm.spawn(s.x, s.y, s.z, 0.3 + Math.random() * 0.3, 1.2, Math.random() * 0.2, 5, 0.6, 3, SMK0, SMK1, 0.35, 0, -0.05, 0.1);
  // waterfall mist
  if (focus.distanceTo(fall.base) < 160) for (let i = 0; i < 3; i++) { V.norm.spawn(fall.base.x - 3 + Math.random() * 3, fall.base.y + 0.5, fall.base.z + (Math.random() - 0.5) * 10, Math.random() * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 2, 2.2, 1.2, 5, MIST0, MIST1, 0.35, 0, -0.2, 0.4); }
  // flags & boats
  if (world.flags) for (const f of world.flags) { const a = f.geometry.attributes.position; for (let i = 0; i < a.count; i++) { const x = a.getX(i) + 0.6; a.setZ(i, Math.sin(G.time * 4 + x * 3) * 0.12 * x); } a.needsUpdate = true; }
  if (world.myBoat && !intro) { const b = world.myBoat, H0 = world.myBoatHome; b.position.y = BOAT_Y + Math.sin(G.time * 1.1) * 0.08; b.rotation.set(Math.sin(G.time * 0.7) * 0.015, H0.yaw, Math.sin(G.time * 0.9 + 1) * 0.035); }
  if (world.boats) world.boats.forEach((b, i) => { b.position.y = 0.3 + Math.sin(G.time * 1.2 + i) * 0.12; b.rotation.z = Math.sin(G.time * 0.9 + i * 2) * 0.05; });
}
const SMK0 = new THREE.Color('#8a8480'), SMK1 = new THREE.Color('#5a5654'), MIST0 = new THREE.Color('#ffffff'), MIST1 = new THREE.Color('#c8dce8');

function updateZone(p) {
  const z = zoneAt(p.pos.x, p.pos.z);
  G.zone = z;
  if (z !== zoneNow) {
    const prev = zoneNow; zoneNow = z;
    const zn = ZONES.find(x => x.id === z);
    if (prev && zn && !BATTLE) { UI.banner(zn.name, `Level ${zn.lv}`); S.zone(); }
    M.setZone(z);
    if (G.save) G.save.zone = zn.name;
  }
  const m = biomeMasks(p.pos.x, p.pos.z);
  const sea = Math.max(0, Math.min(1, 1 - (440 - p.pos.z) / 110)) + Math.max(0, Math.min(1, 1 - (500 - p.pos.x) / 90)) * (p.pos.z > -100 ? 1 : 0);
  const fd = p.pos.distanceTo(fall.base);
  let fireD = 99; for (const f of world.fires) { const d = f.pos.distanceTo(p.pos); if (d < fireD) fireD = d; }
  let lavaD = 999; if (world.lavaPools) for (const L of world.lavaPools) lavaD = Math.min(lavaD, Math.hypot(L.x - p.pos.x, L.z - p.pos.z) - L.r);
  setAmbience({ sea: Math.min(1, sea), wind: 0.25 + m.hl * 0.6 + Math.max(0, p.pos.y - 30) / 80, forest: Math.min(1, m.forest + (z === 'meadow' ? 0.6 : 0)), waterfall: Math.max(0, 1 - fd / 140), fire: Math.max(0, 1 - fireD / 9), lava: Math.max(0, 1 - lavaD / 40), night: G.night || 0 });
}
function updateMobs(dt, p) {
  let chasing = false;
  const heroes = MP.host ? [p, ...MP.remotes.values()].filter(h => !h.dead && !(h.stealth > 0)) : null;
  for (const m of G.mobs) {
    let d = m.pos.distanceTo(p.pos), tp = p;
    if (m.petFoe) { if (m.petFoe.dead || !G.mobs.includes(m.petFoe)) m.petFoe = null; else if (!m.dead && m.state === 'chase') { const dd = m.pos.distanceTo(m.petFoe.pos); if (dd < 30) { tp = m.petFoe; d = Math.min(d, dd); } } }
    if (heroes && m.team == null && !m.netProxy) for (const h of heroes) { const dd = m.pos.distanceTo(h.pos); if (dd < d || (tp.dead && !h.dead)) { d = dd; tp = h; } }
    if (m.isStruct) continue;
    if (m.team != null) { if (!m.dead && !m.gone) m.root.visible = d < 170; m.update(dt); continue; }
    if (d > 110 && !m.dead) { m.root.visible = false; if (d > 150) continue; }
    else if (!m.dead) m.root.visible = true;
    if (d < 150) m.update(dt, tp);
    if (m.state === 'chase' && !m.dead) chasing = true;
  }
  for (const n of G.npcs) if (n.pos.distanceTo(p.pos) < 160) n.update(dt, p);
  if (chasing) G.inCombat = Math.max(G.inCombat, 1.5);
  // node respawn
  for (const n of world.nodes) if (!n.alive && G.time > n.respawn && Math.hypot(n.x - p.pos.x, n.z - p.pos.z) > 30) { n.alive = true; showNode(n); if (n.stump) { scene.remove(n.stump); n.stump = null; } }
}

// title screen camera fly-around
function titleCam(t) {
  const a = t * 0.03;
  const cx = VILLAGE.x, cz = VILLAGE.z + 30;
  camera.position.set(cx + Math.cos(a) * 75, 26 + Math.sin(t * 0.07) * 4, cz + Math.sin(a) * 75);
  camera.lookAt(cx, 6, cz - 10);
  camera.fov = 60; camera.updateProjectionMatrix();
  A.setListener(camera.position.x, camera.position.y, camera.position.z, 0);
}

// ---------- loop ----------
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (G.hitstop > 0) { G.hitstop -= dt; dt *= 0.15; }
  G.time += dt; world.time.value = G.time;
  const p = G.player;
  if (mode === 'title' || mode === 'creator') {
    G.tod = 0.66; // golden late afternoon behind the menus
    titleCam(G.time);
    const focus = new THREE.Vector3(VILLAGE.x, 0, VILLAGE.z);
    G.night = updateDayNight(dt, focus); updateFires(dt, camera.position);
    cullChunks(camera.position.x, camera.position.z, 500 * settings.viewDist, settings.shadows); updateGrass(VILLAGE.x, VILLAGE.z + 30, settings.grass);
    updateBirds(G.time, dt); V.update(dt);
    for (const n of G.npcs) if (n.update && G.player == null && n.ch) { /* idle */ }
    if (!$('creator').hidden) { renderer.setClearColor('#0b0a0d'); renderer.clear(); renderPreview(renderer, dt); return; }
    composer.render(dt);
    return;
  }
  if (mode !== 'game' || !p) return;
  const paused = gameUpdate(dt) === 'paused';
  const pc = UI.portraitRect && UI.portraitRect() && document.getElementById('portrait');
  if (pc) {
    if (!portraitCh) { const pl = G.player; portraitCh = buildHumanoid(pl.app); const w = pl.weapon; equipWeapon(portraitCh, w ? w.wt : null, w ? w.tier : 0, w ? w.rarity : 0); tintGear(portraitCh, pl.h.equip); bake(portraitCh.root); }
    animateHumanoid(portraitCh, dt, { speed: 0, armed: true });
    portraitRot += dt * 0.35;
    const pr = renderer.getPixelRatio(), cw = Math.round(pc.width / pr), chh = Math.round(pc.height / pr);
    renderStage(renderer, { left: 0, top: innerHeight - chh, width: cw, height: chh }, portraitCh, G.portraitYaw ?? Math.sin(portraitRot) * 0.6, 1.75);
    const g2 = pc.getContext('2d'); g2.clearRect(0, 0, pc.width, pc.height);
    g2.drawImage(renderer.domElement, 0, renderer.domElement.height - chh * pr, cw * pr, chh * pr, 0, 0, pc.width, pc.height);
  }
  composer.render(paused ? 0 : dt);
  // first-person hands & weapon on top
  const pl = G.player;
  if (pl && pl.vm.g.visible && !intro) {
    camera.updateMatrixWorld(); G.vmCam.position.copy(camera.position); G.vmCam.quaternion.copy(camera.quaternion);
    G.vmCam.fov = 72 + (camera.fov - settings.fov) * 0.5; G.vmCam.aspect = camera.aspect; G.vmCam.updateProjectionMatrix();
    vmSun.color.copy(sun.color); vmSun.intensity = Math.max(0.6, sun.intensity * 0.9); vmSun.position.copy(sun.position).sub(sun.target.position).normalize().add(camera.position);
    vmSun.target.position.copy(camera.position); vmHemi.intensity = hemi.intensity; vmHemi.color.copy(hemi.color); vmHemi.groundColor.copy(hemi.groundColor);
    renderer.autoClear = false; renderer.clearDepth(); renderer.render(G.vmScene, G.vmCam); renderer.autoClear = true;
  }
}
let portraitCh = null, portraitRot = 0, musicFight = 0;
function gameUpdate(dt) {
  const p = G.player;
  if (intro) updateIntro(dt);
  else {
    if (G.uiOpen && (UI.UI.open === 'pause' || UI.UI.open === 'settings' || UI.UI.open === 'controls')) return 'paused'; // pause freezes the world
    p.update(dt);
  }
  G.inCombat = Math.max(0, G.inCombat - dt);
  // battle music only for real fights: hostile mobs hunting you, or an elite
  { let threat = false, elite = false; for (const m of G.mobs) { if (m.dead || m.state !== 'chase') continue; if (Math.hypot(m.pos.x - p.pos.x, m.pos.z - p.pos.z) > 35) continue; if (m.def.aggro > 0) threat = true; if (m.def.elite) elite = true; }
    musicFight = threat || elite ? Math.min(6, musicFight + dt) : Math.max(0, musicFight - dt * 0.4);
    M.setCombat(musicFight > 1.2); M.setBoss(elite); }
  if (BATTLE) { const t = Battle.myTown(); M.setTown(Math.hypot(p.pos.x - t.x, p.pos.z - t.z) < 45 && musicFight < 1); } else { const near = (x, z, r) => Math.hypot(p.pos.x - x, p.pos.z - z) < r; M.setTown(near(VILLAGE.x, VILLAGE.z, 60) || CAMPS.slice(0, 3).some(c => near(c.x, c.z, 40))); }
  if (YARD) updateYard(dt);
  if (!BATTLE && !YARD && !intro) { updateFog(dt, [{ x: p.pos.x, z: p.pos.z, r: 80 }]);
    if ((G.poiT = (G.poiT || 0) - dt) <= 0) { G.poiT = 1; for (const q of pois()) if (!known(G.save, q.id) && Math.hypot(q.x - p.pos.x, q.z - p.pos.z) < (q.big ? 110 : 55)) { learn(G.save, q.id); UI.toast(`Discovered: ${q.name}`, '🗺', 'gold'); chatAdd(`<b class="sk">Discovered:</b> ${q.name}`, 'skill'); } } }
  updatePetBar(dt);
  updateScene(dt); updateConstruction(dt, V, S);
  if (!BATTLE) updateGuards(dt, p);
  updateBanners(dt, p);
  updateMobs(dt, p);
  if (BATTLE) { tickCampFires(); Battle.update(dt); BUI.update(dt); if (MP.on) { if (MP.host) Sync.hostTick(dt); else Sync.meTick(dt); } }
  updateProjectiles(dt);
  for (let i = G.timers.length - 1; i >= 0; i--) if (G.timers[i].update(dt)) G.timers.splice(i, 1);
  const focus = p.pos;
  G.night = updateDayNight(dt, focus);
  updateFires(dt, focus);
  updateZone(p);
  cullChunks(focus.x, focus.z, intro ? 1500 : 480 * settings.viewDist, settings.shadows && !intro);
  updateGrass(focus.x, focus.z, settings.grass);
  updateBirds(G.time, dt);
  updateAmbient(dt, focus.x, focus.y, focus.z, G.zone, G.night);
  V.update(dt);
  if (!intro) { UI.updateHUD(dt); UI.updatePlates(); UI.drawMinimap(); }
  V.updateNumbers(dt, camera, innerWidth, innerHeight);
  // crosshair hit flash
  // save
  if (BATTLE || YARD) return;
  G.save.timePlayed = (G.save.timePlayed || 0) + dt;
  saveTimer += dt; if (saveTimer > 30) { saveTimer = 0; saveNow(); }
}

// start the title music straight away, before the world is built
M.play('title');
setTimeout(() => { if (M.blocked) { const l = $('loading'); if (l && !l.hidden) l.querySelector('small').innerHTML = 'Building the world... <b style="color:#ffe2a0">Click anywhere to begin</b>'; } }, 600);
addEventListener('pointerdown', function early() { A.init(); removeEventListener('pointerdown', early); }, { once: true });
window.KR2 = { get intro() { return intro; }, G, startGame, quitToTitle, UI, Game, Battle, sim(sec) { let t = 0; while (t < sec) { G.time += 0.033; world.time.value = G.time; gameUpdate(0.033); t += 0.033; } } };
// online host in a hidden tab: keep the battle running on a timer so nobody's game freezes
setInterval(() => { if (BATTLE && MP.on && MP.host && document.hidden && mode === 'game' && G.player) { G.time += 0.1; world.time.value = G.time; gameUpdate(0.1); } }, 100);
setTimeout(() => { if (BATTLE && SETUP.mp) lobby().then(() => { computeLayout(); applyBattleTerrain(); boot(); }); else boot(); }, 60);

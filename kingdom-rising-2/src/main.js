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
import { buildTerrain, buildWater, buildSky, buildWaterfall, skyColors, heightAt, zoneAt, SPAWN, VILLAGE, FALL, CAMPS, biomeMasks } from './terrain.js';
import { buildWorld, world, cullChunks, updateGrass, updateBirds, updateAmbient, showNode, nodeKinds } from './world.js';
import { SPAWNS, ZONES, NPCS, RACES, CLASSES, WEAPON_TYPES, QUESTS, MOBS, GOBLIN_CAMPS, FAMILIES } from './data.js';
import { Mob, NPC, Villager } from './mobs.js';
import { Player } from './player.js';
import * as Game from './game.js';
import * as UI from './ui.js';
import { showTitle, initMenu, Menu, renderPreview, goFull, renderStage } from './menu.js';
import { buildHumanoid, equipWeapon, tintGear, bake, animateHumanoid } from './character.js';
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
  buildWorld(scene);
  V.init(scene, camera);
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.5, 0.88); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  applyGraphics();
  // NPCs and villagers live in the world from the start (visible behind the title screen)
  for (const id in NPCS) G.npcs.push(new NPC(id));
  const vill = [[-6, 352, { race: 'human', sex: 'f', outfit: 'weaver', hair: '#7b2a15', hairStyle: 2, skin: '#e0ac85', height: 0.8 }], [12, 372, { race: 'human', sex: 'm', outfit: 'worker', hair: '#d9b26a', skin: '#f1c7a5', beard: 0, height: 0.75 }], [-18, 340, { race: 'dwarf', sex: 'm', outfit: 'worker', hair: '#6b3a17', skin: '#dba07a' }], [24, 360, { race: 'elf', sex: 'f', outfit: 'merchant', hair: '#e8e8e8', skin: '#ead0b5', hairStyle: 1 }]];
  for (const [x, z, app] of vill) G.npcs.push(new Villager(x, z, app));
  for (const s of SPAWNS) { const [type, x, z, r, n, l0, l1] = s; const hostileN = MOBS[type].elite ? 1 : MOBS[type].aggro > 0 ? 2.2 : 1.3; const packs = Math.max(1, Math.round(n / 3)); const centers = []; for (let j = 0; j < packs; j++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r * 0.75; centers.push([x + Math.cos(a) * d, z + Math.sin(a) * d]); }
    for (let i = 0; i < Math.max(1, Math.round(n * hostileN)); i++) { const [cx0, cz0] = centers[i % packs]; let px, pz, k = 0; do { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * Math.max(14, r * 0.6); px = cx0 + Math.cos(a) * d; pz = cz0 + Math.sin(a) * d; k++; } while (k < 20 && heightAt(px, pz) < (type === 'crab' ? 0.2 : 1.2)); G.mobs.push(new Mob(type, l0 + Math.floor(Math.random() * (l1 - l0 + 1)), px, pz)); } }
  // fill the empty stretches between spawn areas with small roaming packs
  { const TAB = { coast: [['wolf', 1, 2], ['rat', 1, 2], ['crab', 1, 2]], meadow: [['wolf', 1, 2], ['wolf', 2, 3], ['bear', 2, 3], ['tiger', 2, 3], ['goblin', 1, 3], ['wolf', 1, 3], ['bear', 3, 4], ['tiger', 3, 4]], edge: [['wolf', 3, 4], ['bear', 3, 5], ['tiger', 3, 5], ['goblin', 3, 5], ['boar', 3, 5]], wood: [['goblin_brute', 6, 8], ['goblin', 5, 7], ['wolf', 5, 7], ['boar', 5, 7], ['spider', 6, 8], ['wolf', 6, 7], ['boar', 6, 8], ['tiger', 7, 8]], highlands: [['skeleton', 10, 12], ['goblin_brute', 10, 12], ['frostwolf', 9, 11], ['bear', 9, 11], ['frostwolf', 10, 11], ['snowtiger', 11, 12]], ashlands: [['ashhound', 14, 16], ['imp', 15, 16], ['golem', 16, 17], ['skeleton', 15, 17]] };
    for (let gx = -520; gx <= 520; gx += 60) for (let gz = -520; gz <= 460; gz += 60) {
      const x = gx + (Math.random() - 0.5) * 40, z = gz + (Math.random() - 0.5) * 40;
      if (heightAt(x, z) < 1.2 || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 70) continue;
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
  hooks();
  initMenu();
  Menu.onPlay = startGame;
  addEventListener('resize', onResize); onResize();
  input();
  $('loading').hidden = true;
  mode = 'title'; showTitle();
  // first interaction: start audio + full screen
  const first = () => { A.init(); goFull(); M.play(mode === 'game' ? 'explore' : 'title'); removeEventListener('pointerdown', first); removeEventListener('keydown', first); };
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
  if (G.player) { scene.remove(G.player.ch.root); G.vmCam.remove(G.player.vm.g); }
  for (const m of G.mobs) if (m.dead) m.respawn();
  for (const p of G.projectiles) p.mesh && scene.remove(p.mesh); G.projectiles.length = 0;
  const p = new Player(h); G.player = p;
  if (h.pos) p.place(h.pos.x, h.pos.z, h.pos.yaw); else p.place(SPAWN.x, SPAWN.z, Math.atan2(VILLAGE.x - SPAWN.x, VILLAGE.z - SPAWN.z));
  if (h.hp) p.hp = Math.max(1, Math.min(p.maxHp, h.hp));
  G.tod = h.tod ?? 0.3;
  $('title').hidden = true; $('creator').hidden = true; $('hud').hidden = false; $('death').hidden = true;
  Game.autoFillHotbar(h); UI.buildMapImage(); UI.buildAbilityBar(); UI.updateTracker(); UI.applyHud();
  zoneNow = null; mode = 'game'; G.paused = false; G.uiOpen = false;
  A.init(); M.play('explore');
  if (!h.introDone) startIntro(); else { lockPointer(); UI.banner(`Welcome back, ${h.name}`, `Level ${h.level} ${RACES[h.race].name} ${CLASSES[h.cls].name}`); }
}
function saveNow() {
  const p = G.player, h = G.save; if (!p || !h) return;
  h.pos = { x: p.pos.x, z: p.pos.z, yaw: p.yaw }; if (p.dead) h.pos = null;
  h.hp = p.hp; h.tod = G.tod;
  const zn = ZONES.find(z => z.id === G.zone); h.zone = zn ? zn.name : h.zone;
  putSave(h);
}
function quitToTitle() {
  saveNow(); UI.closeWin();
  if (G.player) { scene.remove(G.player.ch.root); G.vmCam.remove(G.player.vm.g); G.player = null; }
  $('hud').hidden = true; $('death').hidden = true; $('clickToPlay').hidden = true; $('intro').hidden = true; intro = null;
  if (document.pointerLockElement) document.exitPointerLock();
  mode = 'title'; showTitle();
}

// ---------- hooks ----------
function hooks() {
  const H = G.hooks;
  H.toast = (t, i, k) => UI.toast(t, i, k);
  H.invChanged = () => { UI.refreshOpen(); UI.updateTracker(); };
  H.gearChanged = (swap) => { G.player && G.player.refreshGear(); portraitCh = null; UI.refreshAbilityBar(); UI.refreshOpen(); };
  H.masteryUp = (wt, lv) => { UI.banner(`${FAMILIES[wt] ? FAMILIES[wt].name : wt} Mastery ${lv}`, 'New weapon skill point! Press K to spend it.', 3500); S.levelUp(); };
  H.questsChanged = () => UI.updateTracker();
  H.hotbarAdded = (list) => { UI.refreshAbilityBar(); };
  H.objective = (q, o, n) => { S.objective(); UI.toast(`${o.label}: ${n}/${o.n}`, '📜', 'gold'); if (Game.questComplete(G.save, q)) UI.banner('Objective complete', `${q.title}: return to ${NPCS[q.turnin].name}`, 2600); };
  H.questDone = (q) => { UI.banner('Quest Complete!', q.title); };
  H.xpGained = (n, why) => UI.toast(`+${n} XP${why ? ' · ' + why : ''}`, '✦', 'xp');
  H.onKill = (mob) => { Game.onKill(G.save, mob); const p = G.player; if (p && Game.perk(G.save, 'bloodlust')) p.heal(p.maxHp * 0.05); };
  H.mastery = (m) => { UI.banner(`Dual Wield Mastery: Rank ${m.rank}`, `${m.name}: ${m.desc}`, 4500); S.levelUp(); UI.refreshAbilityBar(); };
  H.levelUp = (lv, unlocked) => {
    const p = G.player; p.refreshGear(); p.hp = p.maxHp; p.mana = p.maxMana; p.end = p.maxEnd;
    UI.banner(`Level ${lv}!`, (unlocked.length ? 'Unlocked: ' + unlocked.join(' · ') + ' · ' : '') + 'New talent point: press N', 4500);
    S.levelUp(); V.burst('gold', p.pos.clone().setY(p.pos.y + 1), 80, { speed: 5, vy: 4, grav: -1, life: 1.6 }); V.ring(p.pos, 5, '#ffe090', 0.8); V.sphereFlash(p.pos.clone().setY(p.pos.y + 1), 2, '#ffe8a0', 0.6); V.light(p.pos.clone().setY(p.pos.y + 2), '#ffd080', 6, 1.2);
    Game.autoFillHotbar(G.save); UI.refreshAbilityBar(); saveNow();
    for (const u of unlocked) setTimeout(() => UI.toast(`Unlocked: ${u}`, '✦', 'gold'), 600);
  };
  H.talk = (npc) => { S.click(); UI.openDialog(npc); };
  H.station = (type) => { S.click(); UI.openCrafting(type); };
  H.progress = (k, l) => UI.progress(k, l);
  H.died = () => { setTimeout(() => { $('death').hidden = false; if (document.pointerLockElement) document.exitPointerLock(); }, 1500); };
  H.telegraph = telegraph; H.enemyBlast = enemyBlast; H.enemyProjectile = enemyProjectile; H.mobShot = mobShot; H.mobBlast = mobBlast; H.telegraphSelf = telegraphSelf; H.telegraphLine = telegraphLine; H.telegraphCone = telegraphCone;
  H.saveQuit = quitToTitle;
  H.applyGraphics = applyGraphics;
  H.nodeDone = (n, p) => { if (n.type.startsWith('tree')) fallTree(n, p); else if (n.def.tool === 'pickaxe') { S.rockBreak(n); V.burst('stone', new THREE.Vector3(n.x, n.y + 0.5, n.z), 30, { speed: 6, size: 0.3, grav: 14 }); V.burst('dust', new THREE.Vector3(n.x, n.y + 0.5, n.z), 20, { speed: 3, size: 1.2, life: 1.5 }); } };
  G.onUiClosed = () => { G.uiClosedAt = performance.now(); if (mode === 'game' && !G.player.dead && !intro) lockPointer(); };
  $('btnRespawn').onclick = () => respawn();
}
function respawn() {
  const p = G.player; if (!p) return;
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

// ---------- intro cinematic ----------
function startIntro() {
  const p = G.player;
  intro = { t: 0 };
  $('intro').hidden = false; $('hud').hidden = true;
  p.vm.g.visible = false;
  S.wake();
  const lines = [[2.2, 'Where... where am I?'], [5.8, 'The raft... it\'s wrecked.'], [9.2, 'There\'s a village up the beach.']];
  intro.lines = lines;
}
function updateIntro(dt) {
  const p = G.player, I = intro; I.t += dt;
  const t = I.t;
  // eyelids: closed, flutter open, blink, open
  const open = t < 1.0 ? 0 : t < 1.8 ? (t - 1.0) / 0.8 * 0.35 : t < 2.2 ? 0.35 - (t - 1.8) / 0.4 * 0.35 : t < 3.4 ? (t - 2.2) / 1.2 * 0.8 : t < 3.6 ? 0.8 - (t - 3.4) * 4 * 0.7 : Math.min(1, 0.1 + (t - 3.6) * 1.5);
  const lidH = 52 - open * 60;
  document.querySelector('#intro .lid.top').style.height = lidH + '%'; document.querySelector('#intro .lid.bot').style.height = lidH + '%';
  canvas.style.filter = `blur(${Math.max(0, 6 - t * 1.3).toFixed(1)}px) saturate(${Math.min(1, 0.4 + t * 0.12).toFixed(2)})`;
  // camera: lying on back looking at sky -> sit up -> stand -> look at raft -> look at village
  const vy = Math.atan2(VILLAGE.x - p.pos.x, VILLAGE.z - p.pos.z);
  const raftYaw = Math.atan2(-3, 3.5) + Math.PI * 0;
  let pitch, yaw, h, roll = 0;
  const e = (a, b, k) => a + (b - a) * (k < 0 ? 0 : k > 1 ? 1 : (k * k * (3 - 2 * k)));
  const g = p.ch.height;
  if (t < 4.5) { pitch = 1.2 + Math.sin(t * 0.8) * 0.03; yaw = vy + 2.6; h = 0.25; roll = 0.25; }
  else if (t < 6.5) { const k = (t - 4.5) / 2; pitch = e(1.2, -0.25, k); yaw = e(vy + 2.6, vy + 2.2, k); h = e(0.25, 0.9, k); roll = e(0.25, 0, k); }
  else if (t < 8.5) { const k = (t - 6.5) / 2; pitch = e(-0.25, -0.5, k) + Math.sin(t * 3) * 0.02; yaw = e(vy + 2.2, vy + 2.9, k); h = e(0.9, g * 0.94, k); roll = Math.sin(t * 2) * 0.04 * (1 - k); }
  else { const k = (t - 8.5) / 2.2; pitch = e(-0.5, 0.0, k); yaw = e(vy + 2.9, vy, k); h = g * 0.94; }
  if (t > 6.5 && t < 7.0 && !I.stood) { I.stood = true; S.step('sand'); setTimeout(() => S.step('sand'), 250); }
  camera.rotation.order = 'YXZ'; camera.rotation.set(pitch, yaw + Math.PI, roll);
  camera.position.set(p.pos.x, p.pos.y + h, p.pos.z);
  p.yaw = yaw; p.pitch = pitch;
  A.setListener(camera.position.x, camera.position.y, camera.position.z, yaw + Math.PI);
  // subtitles
  const sub = document.querySelector('#intro .sub');
  let line = ''; for (const [at, l] of I.lines) if (t > at && t < at + 3.0) line = l;
  if (sub.textContent !== line) { sub.style.opacity = 0; setTimeout(() => { sub.textContent = line; sub.style.opacity = line ? 1 : 0; }, line ? 150 : 0); }
  if (t > 11.5) endIntro();
}
function endIntro() {
  if (!intro) return;
  intro = null; const p = G.player;
  $('intro').hidden = true; canvas.style.filter = ''; $('hud').hidden = false;
  p.pitch = 0; G.save.introDone = true; saveNow();
  UI.banner('Driftwood Coast', 'Washed ashore with nothing...', 3500);
  setTimeout(() => UI.hint('Head up the beach to the village. Talk to <b>Elder Maren</b>: look for the gold <b style="color:#ffd84a">!</b> above her head and press <span class="kbd">E</span>. Scroll the mouse wheel for third person.', 12000), 1500);
  lockPointer();
}

// ---------- input ----------
let lockBusyUntil = 0;
function lockPointer() { if (mode !== 'game' || G.uiOpen || !canvas.requestPointerLock || document.pointerLockElement || performance.now() < lockBusyUntil - 700) return; lockBusyUntil = performance.now() + 900; try { const r = canvas.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => { try { canvas.requestPointerLock(); } catch (e) {} }); } catch (e) { try { canvas.requestPointerLock(); } catch (e2) {} } }
function input() {
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (mode !== 'game') { if (e.code === 'Escape' && $('windows').children.length) UI.closeWin(); return; }
    if (intro) { if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') endIntro(); return; }
    if (e.code === 'Tab') e.preventDefault();
    const p = G.player;
    if (!e.repeat) {
      const map = { KeyI: 'inv', KeyJ: 'quests', KeyN: 'talents', KeyM: 'map', KeyP: 'craft' };
      if (UI.dialogKey(e.code)) { e.preventDefault(); return; }
      if (map[e.code]) { S.click(); UI.toggleWin(map[e.code]); return; }
      if (e.code === 'Escape') { if (G.uiOpen) { UI.closeWin(); } else UI.openPause(); return; }
    }
    G.keys[e.code] = true;
    if (!e.repeat && !G.uiOpen && p) p.onKey(e.code, true);
  });
  addEventListener('keyup', (e) => { G.keys[e.code] = false; if (mode === 'game' && G.player) G.player.onKeyUp(e.code); });
  addEventListener('blur', () => { for (const k in G.keys) G.keys[k] = false; });
  canvas.addEventListener('mousedown', (e) => {
    if (mode !== 'game' || intro) return;
    if (!document.pointerLockElement) { if (!G.uiOpen && !G.player.dead) lockPointer(); return; }
    G.player.onMouse(e.button, true);
  });
  addEventListener('mouseup', (e) => { if (mode === 'game' && G.player && document.pointerLockElement) G.player.onMouse(e.button, false); else if (G.player) G.player.press = null; });
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => { if (mode === 'game' && document.pointerLockElement && G.player && !intro && !G.uiOpen) { G.player.look(e.movementX, e.movementY); if (G.player.camDist < 0.6) { camera.rotation.order = 'YXZ'; camera.rotation.x = G.player.pitch; camera.rotation.y = G.player.yaw + Math.PI; } G.player.lookDX = (G.player.lookDX || 0) + e.movementX; G.player.lookDY = (G.player.lookDY || 0) + e.movementY; } });
  addEventListener('wheel', (e) => { if (mode === 'game' && G.player && !G.uiOpen) G.player.onWheel(e.deltaY); }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    const locked = !!document.pointerLockElement;
    $('clickToPlay').hidden = locked || mode !== 'game' || G.uiOpen || intro || (G.player && G.player.dead);
    // only the Esc key (the browser dropping the lock) opens the pause menu; unlocks caused by opening/closing our own windows are ignored
    if (locked || mode !== 'game' || G.uiOpen || intro || !G.player || G.player.dead) return;
    // never pop a menu up on its own: just show "click to continue" (Esc opens the menu)
    $('clickToPlay').hidden = false;
  });
  $('clickToPlay').addEventListener('click', () => { $('clickToPlay').hidden = true; lockPointer(); });
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
  if (world.boats) world.boats.forEach((b, i) => { b.position.y = 0.3 + Math.sin(G.time * 1.2 + i) * 0.12; b.rotation.z = Math.sin(G.time * 0.9 + i * 2) * 0.05; });
}
const SMK0 = new THREE.Color('#8a8480'), SMK1 = new THREE.Color('#5a5654'), MIST0 = new THREE.Color('#ffffff'), MIST1 = new THREE.Color('#c8dce8');

function updateZone(p) {
  const z = zoneAt(p.pos.x, p.pos.z);
  G.zone = z;
  if (z !== zoneNow) {
    const prev = zoneNow; zoneNow = z;
    const zn = ZONES.find(x => x.id === z);
    if (prev && zn) { UI.banner(zn.name, `Level ${zn.lv}`); S.zone(); }
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
  for (const m of G.mobs) {
    const d = m.pos.distanceTo(p.pos);
    if (d > 110 && !m.dead) { m.root.visible = false; if (d > 150) continue; }
    else if (!m.dead) m.root.visible = true;
    if (d < 150) m.update(dt, p);
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
  { const near = (x, z, r) => Math.hypot(p.pos.x - x, p.pos.z - z) < r; M.setTown(near(VILLAGE.x, VILLAGE.z, 60) || CAMPS.slice(0, 3).some(c => near(c.x, c.z, 40))); }
  updateMobs(dt, p);
  updateProjectiles(dt);
  for (let i = G.timers.length - 1; i >= 0; i--) if (G.timers[i].update(dt)) G.timers.splice(i, 1);
  const focus = p.pos;
  G.night = updateDayNight(dt, focus);
  updateFires(dt, focus);
  updateZone(p);
  cullChunks(focus.x, focus.z, 480 * settings.viewDist, settings.shadows);
  updateGrass(focus.x, focus.z, settings.grass);
  updateBirds(G.time, dt);
  updateAmbient(dt, focus.x, focus.y, focus.z, G.zone, G.night);
  V.update(dt);
  if (!intro) { UI.updateHUD(dt); UI.updatePlates(); UI.drawMinimap(); }
  V.updateNumbers(dt, camera, innerWidth, innerHeight);
  // crosshair hit flash
  // save
  G.save.timePlayed = (G.save.timePlayed || 0) + dt;
  saveTimer += dt; if (saveTimer > 30) { saveTimer = 0; saveNow(); }
}

// start the title music straight away, before the world is built
M.play('title');
setTimeout(() => { if (M.blocked) { const l = $('loading'); if (l && !l.hidden) l.querySelector('small').innerHTML = 'Building the world... <b style="color:#ffe2a0">Click anywhere to begin</b>'; } }, 600);
addEventListener('pointerdown', function early() { A.init(); goFull(); removeEventListener('pointerdown', early); }, { once: true });
window.KR2 = { G, startGame, quitToTitle, UI, Game, sim(sec) { let t = 0; while (t < sec) { G.time += 0.033; world.time.value = G.time; gameUpdate(0.033); t += 0.033; } } };
setTimeout(boot, 60);

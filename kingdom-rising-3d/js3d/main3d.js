// Kingdom Rising 3D — boot, game loop, input and the music director.
// This is the 3D twin of ../js/main.js: the game rules all run in the shared files, this only
// replaces how the world is drawn and how you steer your hero.
await window.KR_READY;

const { THREE, K3, PX, TS, TILE } = await import('./core.js');
const { geo, buildGeo } = await import('./geo.js');
const { buildTerrain, updateTerrain, refreshTerrainArea } = await import('./terrain.js');
const { updateSky, sky } = await import('./sky.js');
const { view, updateCamera, moveInput, screenRay, rayGround, eyeHeight } = await import('./camera.js');
const { world3d } = await import('./world3d.js');
// the realistic human body (MakeHuman, CC0) is loaded before anyone is built
{ const { loadHuman } = await import('./human.js'); try { await loadHuman(); } catch (e) { console.warn('human body not loaded, using the classic figures', e); } }
const { actors, JUMP_T } = await import('./actors.js');
const { hud3d } = await import('./hud3d.js');
const { viewmodel } = await import('./viewmodel.js');
const { settings3d } = await import('./settings3d.js');
const { actionOf, held, pressed } = await import('./keys3d.js');
await import('./portrait3d.js');
await import('./herolight.js');
await import('./harvest3d.js');
await import('./items3d.js');
const { grass } = await import('./grass.js');
const { menu: menu3d } = await import('./menu3d.js');
await import('./cine3d.js');
await import('./heroview.js');
await import('./wildlife.js');
await import('./intro3d.js');
await import('./scene3d.js');
await import('./cover3d.js');

const KR = window.KR;
const D = KR.D, U = KR.U, W = KR.W, G = KR.G, Sys = KR.Sys, R = KR.R, UI = KR.UI, A = KR.A, T = KR.T;
const Main = (KR.Main = KR.Main || {});
const cv = document.getElementById('game');
let running = false, last = 0, lastDraw = 0;
let musicOverride = null, combatT = 0, saveT = 0, worldKey = null;

// ---------- keeping the 3D world in step with the game's world ----------
// the shared code calls these when it rebuilds the map, changes realm or moves decorations
const dirty = { all: true, areas: [], decor: false };
const inv0 = R.invalidateArea, clear0 = R.clear, reindex0 = R.reindex;
R.invalidateArea = function (x0, y0, w, h) { dirty.areas.push([x0, y0, w, h]); return inv0.apply(this, arguments); };
R.clear = function () { dirty.all = true; return clear0.apply(this, arguments); };
R.reindex = function () { dirty.decor = true; return reindex0.apply(this, arguments); };
// the minimap arrow points where the camera looks
if (R.drawMinimap) { const dm = R.drawMinimap; R.drawMinimap = function (cv2, ...a) { const p = G.player; if (!p) return dm.call(this, cv2, ...a); const g = cv2.getContext('2d'); const d = p.dir; p.dir = -1; const rot = g.rotate; g.rotate = function (r) { return rot.call(this, r === 0 ? Math.PI - view.yaw : r); }; try { return dm.call(this, cv2, ...a); } finally { g.rotate = rot; p.dir = d; } }; }
function syncWorld(force) {
  if (!W.tiles) return;
  if (geo.tilesRef !== W.tiles || geo.realm !== (W.realm || 'main')) dirty.all = true;
  if (dirty.all || force) {
    const t0 = performance.now();
    buildGeo(); buildTerrain(); world3d.build(); actors.reset(); grass.rebuild(K3.terrain.tileTex);
    dirty.all = false; dirty.areas.length = 0; dirty.decor = false;
    console.log(`3D world for ${geo.realm}: heights ${geo.ms} ms, terrain ${K3.terrain.ms} ms, total ${Math.round(performance.now() - t0)} ms`);
    return;
  }
  if (dirty.areas.length) {
    buildGeo();
    for (const [x0, y0, w, h] of dirty.areas) { refreshTerrainArea(x0, y0, w, h); world3d.rebuildArea(x0, y0, w, h); }
    grass.refreshHeights();
    dirty.areas.length = 0; dirty.decor = false;
  }
  if (dirty.decor) { world3d.refreshDecor(); dirty.decor = false; }
}
K3.syncWorld = syncWorld;

// ---------- how fast people move ----------
// The 2D map is drawn small, so its speeds (128 px/s = 6.4 m/s for a hero) look like sprinting in 3D.
// Realistic: a jog of 3.2 m/s, walking 1.4 m/s; everyone else slows by the same amount so chases stay fair.
const SPEEDS = { realistic: 0.5, brisk: 0.78, fast: 0.9, classic: 1 };
const move = { walk: !!K3.settings.walkMode, back: false, autorun: false };
G.moveScale = (e) => {
  const k = SPEEDS[K3.settings.moveSpeed] || SPEEDS.brisk;
  if (e !== G.player) return k;
  return k * (move.walk ? 0.44 : 1) * (move.back ? 0.65 : 1);
};
Main.toggleWalk = function () { move.walk = !move.walk; K3.settings.walkMode = move.walk; K3.saveSettings(); G.log(move.walk ? 'You are now walking.' : 'You are now running.', 'sys', '#ccc'); };

// ---------- boot ----------
Main.boot = async function () {
  const boot = document.getElementById('boot3d');
  try { G.ui_autoloot = JSON.parse(localStorage.getItem('kr_autoloot') || 'true'); } catch (e) {}
  await Promise.race([Sys.Store.init(), new Promise((r) => setTimeout(r, 4000))]);
  await Sys.loadAccount();
  A.setVolumes(G.account.settings.music, G.account.settings.sfx);
  // build the world now, behind the loading screen, so the cover and the menus can fly over it
  try { const bm = document.getElementById('boot3d-msg'); if (bm) bm.textContent = 'Raising the realm...'; await new Promise((r) => setTimeout(r, 30)); Main.ensureWorld(); syncWorld(true); } catch (e) { console.error('menu world', e); }
  if (boot) boot.remove();
  const start = () => { menu3d.start(); A.init(); A.setVolumes(G.account.settings.music, G.account.settings.sfx); KR.Menus.showMenu(); setTimeout(() => { try { if (worldKey !== G.account.seed && !running) Main.ensureWorld(); } catch (e) { console.error(e); } }, 700); };
  const gate = document.getElementById('gate'); gate.hidden = false; window.KR_BOOTED = true;
  if (KR.Kingdom && KR.Kingdom.cover) KR.Kingdom.cover(gate, () => { Main.autoFullscreen(); start(); });
  else document.getElementById('gate-go').onclick = () => { Main.autoFullscreen(); gate.hidden = true; start(); };
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) try { window.claude.hot.snapshot(() => { if (running) Sys.save(true); return {}; }); } catch (e) {}
};

Main.ensureWorld = function () {
  const key = G.account.seed;
  if (W.realm && W.realm !== 'main' && W.realms && W.realms.main) { W.realms[W.realm] = W.snapshot(); W.restore(W.realms.main); }
  if (worldKey !== key) {
    const lv = {}; for (const f of D.FACTION_IDS) lv[f] = G.account.cities[f].level;
    W.realms = {}; W.generate(G.account.seed, lv); R.clear(); R.reindex(); Sys.buildQuests(); worldKey = key;
  } else {
    for (const f of D.FACTION_IDS) if (W.cityData[f].level !== G.account.cities[f].level) { W.stampCity(f, G.account.cities[f].level); }
    W.explored.fill(0); R.clear(); R.reindex();
  }
  W.spawns.forEach((s) => { s.ent = null; s.timer = 0; });
};

const lockEsc = () => { try { if (navigator.keyboard && navigator.keyboard.lock) { if (document.fullscreenElement) navigator.keyboard.lock(['Escape']).catch(() => {}); else navigator.keyboard.unlock(); } } catch (e) {} };
document.addEventListener('fullscreenchange', lockEsc);
// Firefox and Safari always let Esc leave full screen (and Chrome can too): if the browser drops you out of
// full screen while you play, the next click or key press puts you back. The Windowed button turns this off.
let fsWanted = false;
document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement) fsWanted = true; });
{ const tf0 = UI.toggleFullscreen; UI.toggleFullscreen = function (want) { if (want === false || (want == null && UI.isFullscreen && UI.isFullscreen())) fsWanted = false; else fsWanted = true; return tf0.apply(this, arguments); }; }
const reFullscreen = (ev) => {
  if (!fsWanted || !running || document.fullscreenElement || document.webkitFullscreenElement || (ev.key && ev.key === 'Escape')) return;
  try { if (localStorage.getItem('kr_auto_fs') === '0') return; } catch (e) {}
  Main.autoFullscreen();
};
addEventListener('pointerdown', reFullscreen, true); addEventListener('keydown', reFullscreen, true);
Main.autoFullscreen = function () {
  let on = true; try { on = localStorage.getItem('kr_auto_fs') !== '0'; } catch (e) {}
  if (!on || document.fullscreenElement || document.webkitFullscreenElement) return;
  const d = document.documentElement;
  try { const pr = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : d.webkitRequestFullscreen && d.webkitRequestFullscreen(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {}
};
Main.enterWorld = async function (id, newChar, opt = {}) {
  Main.autoFullscreen(); menu3d.stop();
  const scr = document.getElementById('screen');
  scr.innerHTML = '<div class="enter"><div class="spin"></div><p id="enter-step">Loading your hero...</p></div>';
  const step = async (t) => { const el = document.getElementById('enter-step'); if (el) el.textContent = t; await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); };
  const t0 = performance.now();
  let c = newChar;
  try {
    await step('Loading your hero...');
    if (!c) { c = await Sys.loadChar(id); if (!c) { KR.UI.confirm('That hero could not be loaded from this browser or your account.', () => KR.Menus.showMenu()); return; } }
    await step(worldKey === G.account.seed ? 'Returning to the realm...' : 'Building the world (first time only)...');
    Main.ensureWorld();
    await step('Waking the townsfolk...');
    Sys.startPlayer(c);
    if (G.player._resumeRealm) { const [rid, rx, ry] = G.player._resumeRealm; await step('Entering ' + (W.REALMS[rid] ? W.REALMS[rid].name : rid) + '...'); Sys.enterRealm(rid, rx, ry, { instant: true }); }
    await step('Raising mountains, castles and forests...');
    syncWorld(true);
    { const t0 = performance.now(); const n = world3d.flush(2500); console.log(`built ${n} more areas in ${Math.round(performance.now() - t0)} ms`); }
    await step('Dressing the townsfolk...');
    { const t0 = performance.now(); const n = actors.prewarm(4000); const m = actors.prewarmCreatures(2500); console.log(`prepared ${n} people and ${m} kinds of creature in ${Math.round(performance.now() - t0)} ms`); }
    await step('Opening your journal...');
    console.log(`Entered world in ${Math.round(performance.now() - t0)} ms`);
    if (newChar) { G.clock = 9 * 60; Sys.save(true); } else if (G.account.clock != null) G.clock = G.account.clock;
    Sys.Net.init();
    scr.hidden = true; scr.innerHTML = '';
    UI.buildHUD();
    Main.snapCamera();
    const showHud = () => { document.getElementById('ui').hidden = false; hud3d.show(true); };
    if (opt.cine && K3.startCine) {
      // the opening film; the HUD and the welcome come up when it ends
      const after = () => { showHud(); UI.banner(`Welcome home to ${D.FACTIONS[c.faction].city}`, `${D.FACTIONS[c.faction].king} must see you at once: he holds court in his castle's throne hall, at the top of the great stairs. Look for the gold ! above townsfolk.`); };
      // a homecoming by sea when the city has a harbour, else the flight over the land
      if (!(K3.startIntro && K3.startIntro(c, after))) K3.startCine(c, after);
      G.log('Tip: W and S move, A and D turn, hold the right mouse button to look and steer (A and D then sidestep), the left button clicks, T or Num Lock runs on its own, scroll the wheel to zoom out to third person. H walks or runs, X sits. Tab targets, Q auto attacks, 1-3 use abilities, E talks, right-click a tree, rock or carcass to gather, /stuck frees you. Press O for settings and key bindings.', 'sys', '#e8d48a');
    } else showHud();
    if (opt.cine && K3.startCine) {} else if (newChar) {
      UI.banner(`Welcome to ${D.FACTIONS[c.faction].city}`, `Speak to ${D.FACTIONS[c.faction].king} in his castle's throne hall, at the top of the great stairs. Look for the gold ! above townsfolk.`);
      G.log('Tip: W and S move, A and D turn, hold the right mouse button to look and steer (A and D then sidestep), the left button clicks, T or Num Lock runs on its own, scroll the wheel to zoom out to third person. H walks or runs, X sits. Tab targets, Q auto attacks, 1-3 use abilities, E talks, right-click a tree, rock or carcass to gather, /stuck frees you. Press O for settings and key bindings.', 'sys', '#e8d48a');
    } else G.log('W and S move, A and D turn, hold the right mouse button to look and steer, the left button clicks. Press O for settings and key bindings.', 'sys', '#e8d48a');
    running = true; last = performance.now(); requestAnimationFrame(loop);
  } catch (err) {
    console.error(err); running = false; document.getElementById('ui').hidden = true;
    Main.showFatal(err, true);
    return;
  }
};
Main.showFatal = function (err, hard) {
  if (!hard && window.KR_BOOTED) { console.error(err); try { KR.UI && KR.UI.toast ? KR.UI.toast('A small error was caught; the game carries on.') : 0; } catch (e) {} return; } // after start-up a stray error must never blank the cover or the menus
  if (running) { console.error(err); return; }
  const scr = document.getElementById('screen'); if (!scr) return;
  const msg = (err && (err.stack || err.message)) || String(err);
  scr.hidden = false;
  scr.innerHTML = `<div class="enter"><p>Something went wrong.</p><pre class="dim small" style="max-width:min(680px,90vw);white-space:pre-wrap;text-align:left;overflow:auto;max-height:40vh">${KR.UI ? KR.UI.esc(msg) : msg}</pre><p class="dim small">Game version ${window.KR_VERSION}. Reloading the page usually fixes this.</p><p><button class="btn gold" id="fatal-back">Back to character select</button></p></div>`;
  document.getElementById('fatal-back').onclick = () => { try { KR.Menus.showMenu(); } catch (e) { location.reload(); } };
};
Main.exitToMenu = function (create) {
  if (Sys.Grp && Sys.Grp.gid) Sys.groupLeave();
  Sys.save(true); Sys.Net.leave(); if (KR.Online) KR.Online.exit(); running = false; if (KR.UI.toast) KR.UI.toast('Game saved');
  for (const id in UI.wins) UI.close(id);
  document.getElementById('ui').hidden = true; hud3d.show(false); settings3d.toggle(false); endLook();
  G.player = null; G.ents = [];
  KR.Menus.showMenu(); if (create === true) KR.Menus.showCreate();
  menu3d.start();
};
Main.snapCamera = function () {
  const p = G.player; if (!p) return; R.cam.x = p.x; R.cam.y = p.y - 20;
  // face away from the nearest wall: look north in town (toward the great hall), else keep the last heading
  if (!view._init) { view.yaw = 0; view.pitch = -0.05; view._init = true; }
};
Main.setMusicOverride = (m) => { musicOverride = m; };
Main.onCombat = () => { combatT = 6; };
Main.isRunning = () => running;

// ---------- loop ----------
function loop(now) {
  // frame rate limit (Settings → Graphics)
  const cap = K3.settings.fpsCap || 0;
  if (cap && running && now - lastDraw < 1000 / cap - 1.5) { requestAnimationFrame(loop); return; }
  lastDraw = now;
  try { loopBody(now); } catch (err) { console.error(err); if (!Main._loopErr) { Main._loopErr = true; G.log('A game error occurred: ' + (err && err.message) + '. The game will keep running; please tell Claude what you were doing.', 'sys', '#ff8a6a'); } }
  if (running) requestAnimationFrame(loop);
}
const typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable); };
// a per-section timer (Settings → Show FPS shows the slowest parts), also used for testing: K3.prof
const PF = (K3.prof = { acc: {}, n: 0, t: 0 }); let pfT = 0;
const mk = (k) => { const t = performance.now(); PF.acc[k] = (PF.acc[k] || 0) + (t - pfT); pfT = t; };
function loopBody(now) {
  if (!running) return;
  pfT = performance.now(); PF.n++;
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  K3.dt = dt; K3.time += dt; K3.frame++; K3.frameTick(dt);
  const p = G.player;
  // keyboard: forward and back move, A and D turn the hero and the camera (EverQuest style);
  // while the right mouse button is held they sidestep instead
  let f = 0, s = 0, turn = 0;
  if (!typing()) {
    if (held('forward')) f += 1; if (held('back')) f -= 1;
    if (held('turnLeft')) turn += 1; if (held('turnRight')) turn -= 1;
    if (held('strafeLeft')) s -= 1; if (held('strafeRight')) s += 1;
  }
  if (f) move.autorun = false;
  if (move.autorun) f = 1;
  if (mouse.r && turn) { s -= turn; turn = 0; }
  if (K3.cine) turn = 0;
  view.yaw += turn * dt * (K3.settings.turnSpeed || 1.9);
  view.turning = !!turn || (mouse.r && !K3.cine); // holding the right button steers: the hero turns with the mouse
  // a camera swung round with the left button drifts back behind the hero once you move or turn (EverQuest)
  if (K3.cine) view.oyaw = 0;
  else if (view.oyaw && !mouse.l && (f || s || turn || (p && p.moving))) { view.oyaw = K3.dampAngle(view.oyaw, 0, Math.min(1, dt * 5)); if (Math.abs(view.oyaw) < 0.002) view.oyaw = 0; }
  // both mouse buttons held: walk forward (like most 3D RPGs)
  if (mouse.l && mouse.r) f = 1;
  if (K3.cine) f = s = 0; // the opening film is playing
  move.back = f < 0;
  let { mx, my } = moveInput(f, s);
  if (touch.move && !K3.cine) { const m2 = moveInput(-touch.my, touch.mx); mx = m2.mx; my = m2.my; }
  if (p.fear > 0 && p.fearFrom) { const dx = p.x - p.fearFrom.x, dy = p.y - p.fearFrom.y, d = Math.hypot(dx, dy) || 1; mx = dx / d; my = dy / d; }
  mk('input');
  // a filmed conversation holds the world still (nobody attacks you while the king talks)
  const gdt = K3.cine && K3.cine.pause ? 0 : dt;
  if (K3.jumpT != null) { K3.jumpT += dt; if (K3.jumpT >= JUMP_T || p.dead) K3.jumpT = null; }
  G.update(gdt, { mx, my }); mk('game');
  Sys.worldTick(gdt); mk('worldTick');
  p.c.playTime = (p.c.playTime || 0) + dt;
  if (p.drunkUntil && p.drunkUntil < G.now) { p.drunkUntil = 0; p.drinks = 0; }
  R.cam.x = p.x; R.cam.y = p.y - 20;
  syncWorld(); mk('sync');
  // camera, world and actors
  updateCamera(dt, p);
  if (K3.cine) (K3.cine.update || K3.updateCine)(dt);
  const inside = W.buildingAt(p.x, p.y);
  mk('camera');
  world3d.update(dt, { inside, cam: K3.camera.position }); mk('world');
  actors.update(dt, { inside }); mk('actors');
  updateSky(dt, K3.camera.position, { inside, focus: view.focus }); mk('sky');
  updateTerrain(K3.camera.position); mk('terrain');
  grass.update(K3.camera.position); mk('grass');
  viewmodel.update(dt, p); mk('viewmodel');
  for (const u of K3.updaters) u(dt, K3.time); mk('updaters');
  K3.render(); mk('render');
  hud3d.draw(dt); mk('hud');
  UI.tick(); mk('ui');
  Sys.Net.tick(); mk('net');
  // music director
  combatT -= dt;
  const inCombat = combatT > 0 && G.inCombat(p);
  let track;
  const b = inside;
  const reg = D.REGIONS[W.regionAtPx(p.x, p.y)];
  const cd = W.cityData[p.c.faction];
  const inOwnCity = cd && Math.abs(p.x / TS - cd.cx) <= cd.R + 4 && Math.abs(p.y / TS - cd.cy) <= cd.R + 4;
  const hubNear = (k) => { const h = D.HUBS[k]; return h && (h.realm || 'main') === W.realm && Math.hypot(p.x / TS - h.at[0], p.y / TS - h.at[1]) < 14; };
  if (inCombat) track = G.ents.some((m) => m.boss && !m.dead && m.inCombat && m.hate && m.hate.has(p)) ? 'boss' : 'combat';
  else if (musicOverride) track = musicOverride;
  else if (b && (b.type === 'inn' || b.type === 'outpost')) track = 'inn';
  else if (b) track = 'house';
  else if (reg.dungeon) track = reg.biome === 'crypt' ? 'crypt' : 'dungeon';
  else if (reg.city) track = reg.city === 'sylvan' ? 'town_sylvan' : 'town_crown';
  else if (inOwnCity) track = p.c.faction === 'sylvan' ? 'town_sylvan' : 'town_crown';
  else if (hubNear('tidesong') || hubNear('docks')) track = 'harbor';
  else if (hubNear('eyrie')) track = 'eyrie';
  else track = reg.music || 'plains';
  if (!K3.cine) A.play(track);
  saveT += dt; if (saveT > 45) { saveT = 0; Sys.save(); }
  const npcW = UI.wins.npc; if (npcW && !npcW.el.hidden && UI._npc && Math.hypot(UI._npc.x - p.x, UI._npc.y - p.y) > 260) UI.close('npc');
}

// ---------- keyboard ----------
addEventListener('keydown', (e) => {
  if (!running || K3.cine) return;
  if (typing()) { if (e.key === 'Escape') document.activeElement.blur(); return; }
  if (settings3d.capturing && settings3d.capturing()) return; // the key bindings window is listening for a new key
  if (e.key === 'Enter') { e.preventDefault(); const ci = document.getElementById('chatin'); if (ci) ci.focus(); return; }
  if (e.key === '/') { e.preventDefault(); const ci = document.getElementById('chatin'); if (ci) { ci.value = '/'; ci.focus(); } return; }
  const code = e.code || e.key;
  const repeat = e.repeat || pressed.has(code);
  pressed.add(code);
  const p = G.player;
  if (e.key === 'Escape') {
    if (settings3d.isOpen()) { settings3d.toggle(false); return; }
    if (!p || p.dead) { UI.closeAll() || UI.toggle('menu'); return; }
    if (!UI.closeAll()) { if (p.target) p.target = null; else UI.toggle('menu'); }
    return;
  }
  const act = actionOf(code); if (!act) return;
  if (act === 'target' || act === 'help' || act === 'jump' || /^hot/.test(act)) e.preventDefault(); // Space must not press a focused button or scroll
  if (repeat) return;
  runAction(act, p);
});
function runAction(act, p) {
  if (!p || p.dead) { if (act === 'settings') settings3d.toggle(); return; }
  const hot = /^hot(\d+)$/.exec(act);
  if (hot) { const i = +hot[1] - 1; if (i < D.slotsForLevel(p.c.level)) { const a = Sys.bar()[i]; if (a) G.useAction(a); } return; }
  switch (act) {
    case 'target': Main.targetNearest(true); break;
    case 'autoAttack': Main.toggleAuto(); break;
    case 'range': Main.cycleRange(); break;
    case 'sit': Main.toggleSit(); break;
    case 'jump': Main.jump(); break;
    case 'interact': Main.interact(); break;
    case 'autorun': move.autorun = !move.autorun; break;
    case 'walk': Main.toggleWalk(); break;
    case 'light': if (KR.Gear) KR.Gear.toggleLight(); break;
    case 'map': UI.toggle('map'); break;
    case 'minimap': UI.toggleMinimap(); break;
    case 'fullscreen': UI.toggleFullscreen(); break;
    case 'inv': UI.toggle('inv'); break;
    case 'spells': UI.toggle('spells'); break;
    case 'abil': UI.toggle('abil'); break;
    case 'journal': UI.toggle('journal'); break;
    case 'kingdom': UI.toggle('kingdom'); break;
    case 'macros': UI.toggle('macros'); break;
    case 'mercs': UI.toggle('mercs'); break;
    case 'group': UI.toggle('group'); break;
    case 'view': Main.toggleView(); break;
    case 'settings': settings3d.toggle(); break;
    case 'help': UI.toggle('help'); break;
    case 'zoomIn': zoomBy(-1.5); break;
    case 'zoomOut': zoomBy(1.5); break;
  }
}
Main.runAction = (act) => runAction(act, G.player);
addEventListener('keyup', (e) => { pressed.delete(e.code || e.key); });
addEventListener('blur', () => { pressed.clear(); endLook(); mouse.l = mouse.r = false; });

function zoomBy(d) {
  let w = view.want + d * (view.want < 3 ? 0.6 : 1);
  if (view.want === 0 && d > 0) w = 2.2; // leaving first person jumps straight to a useful distance
  if (w < 1.2) w = 0;
  view.want = K3.clamp(w, 0, view.maxDist); K3.lsSet('kr3d_dist', view.want);
}
Main.toggleView = function () { view.want = view.want > 0 ? 0 : 4.5; K3.lsSet('kr3d_dist', view.want); A.sfx('click', 0.4); };
Main.toggleAuto = function () { const p = G.player; p.autoAttack = !p.autoAttack; if (p.autoAttack) { if (!p.target || !G.isHostile(p, p.target) || p.target.dead) Main.targetNearest(); if (!p.target) p.autoAttack = false; p.sit = false; } G.log(p.autoAttack ? 'Auto attack is on.' : 'Auto attack is off.', 'sys', '#ccc'); A.sfx('click'); };
Main.cycleRange = function () { const c = G.player.c; if (!c.equip.range) { G.log('You have no ranged weapon equipped.', 'sys', '#aaa'); return; } const order = ['both', 'melee', 'ranged']; c.rangeMode = order[(order.indexOf(c.rangeMode || 'both') + 1) % 3]; G.log(`Combat mode: ${c.rangeMode === 'both' ? 'melee and ranged' : c.rangeMode + ' only'}.`, 'sys', '#ccc'); A.sfx('click'); };
// jump (Space): a hop in place or on the run, one at a time. Cosmetic: the game itself keeps you on the ground,
// so it never changes where you can walk. Other players see it through a counter in your presence.
K3.jumpT = null; K3.jumpN = 0;
Main.jump = function () {
  const p = G.player; if (!p || p.dead || K3.cine || K3.jumpT != null) return;
  if (p.stun > 0 || p.mez > 0 || p.root > 0 || p.swim) return; // no jumping out of deep water
  if (p.sit) { Main.toggleSit(); return; } // stand up first
  K3.jumpT = 0; K3.jumpN++;
};
// swimming only where the water is really deep enough to swim in (game.js swimTick asks)
G.deepWaterAt = (px, py) => { if (!geo.ready) return true; const wl = geo.waterAt(px, py); return !isNaN(wl) && wl - geo.groundT(px / TS, py / TS) > 0.9; };
{ const pe0 = Sys.presenceExtra; Sys.presenceExtra = function () { const o = pe0 ? pe0.apply(this, arguments) : {}; o.jmp = K3.jumpN; o.sw = G.player && G.player.swim ? 1 : 0; return o; }; }
Main.toggleSit = function () { const p = G.player; if (p.moving) return; p.sit = !p.sit; if (p.sit) { p.autoAttack = false; p.cast = null; } G.log(p.sit ? 'You sit down.' : 'You stand up.', 'sys', '#ccc'); };
Main.targetNearest = function (cycle) {
  const p = G.player;
  // prefer enemies in front of the camera, nearest first
  const fx = -Math.sin(view.yaw + view.oyaw), fz = -Math.cos(view.yaw + view.oyaw);
  const score = (e) => { const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1; const front = (dx * fx + dy * fz) / d; return d * (front > 0.3 ? 1 : 2.2); };
  const cands = G.ents.filter((e) => !e.dead && !e.removed && G.isHostile(p, e) && Math.hypot(e.x - p.x, e.y - p.y) < 650 && !(W.buildingAt(e.x, e.y) && W.buildingAt(e.x, e.y) !== W.buildingAt(p.x, p.y))).sort((a, b) => score(a) - score(b));
  if (!cands.length) { if (!cycle) return; G.log('No enemies nearby.', 'sys', '#aaa'); return; }
  if (cycle && p.target && cands.includes(p.target)) { const i = cands.indexOf(p.target); p.target = cands[(i + 1) % cands.length]; }
  else p.target = cands[0];
  A.sfx('click', 0.5);
};
Main.interact = function (target) {
  if (target && target.dead) return;
  const p = G.player;
  let e = target;
  if (!e) {
    // what the crosshair is on, if it is close, then whatever is nearest
    const aim = actors.pickScreen(innerWidth / 2, innerHeight / 2);
    if (aim && Math.hypot(aim.x - p.x, aim.y - p.y) < 110 && (aim.type === 'npc' || aim.type === 'king' || aim.type === 'merc' || (aim.dead && aim.loot) || (aim.type === 'guard' && aim.faction === p.c.faction))) e = aim;
  }
  if (!e) {
    const near = G.ents.filter((x) => x !== p && !x.removed && Math.hypot(x.x - p.x, x.y - p.y) < 90).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    e = near.find((x) => x.dead && x.loot && x.loot.items.length) || near.find((x) => !x.dead && (x.type === 'npc' || x.type === 'king' || (x.type === 'guard' && x.faction === p.c.faction))) || (p.target && Math.hypot(p.target.x - p.x, p.target.y - p.y) < 100 ? p.target : null);
  }
  if (!e) { G.log('There is nothing here to interact with.', 'sys', '#aaa'); return; }
  if (Math.hypot(e.x - p.x, e.y - p.y) > 110) { G.log(`You are too far away from ${e.name}.`, 'sys', '#ffb24a'); return; }
  p.target = e;
  if (e.dead && e.loot) { if (e.loot.items.length) UI.openLoot(e); else G.log('The corpse has nothing on it.', 'sys', '#aaa'); return; }
  if (e.type === 'merc') { UI.openMerc(e); return; }
  if (e.treasureX && KR.War) { KR.War.digTreasure(e); return; }
  if (e.raidBoard && KR.War) { const s = KR.War.raidStatus(e.faction); G.log(`War Board of ${D.FACTIONS[e.faction].city}: ${s.big} ${s.small}. Garrison ${KR.War.garrison(e.faction).length} soldiers.`, 'sys', '#e8d48a'); return; }
  if ((e.barracks || e.recruiter) && KR.War) { G.faceTo && G.faceTo(e, p); if (e.recruiter) G.say(e, e.faction === p.c.faction ? 'Looking to strengthen our war parties? Every soldier I sign up marches on every raid.' : 'Not for your kind.', 3); KR.War.openBarracks(e); return; }
  if (e.bell) { G.log(e.ringUntil > G.now ? 'The alarm bell is ringing: the kingdom is under attack!' : 'The alarm bell hangs quiet. A guard will ring it if enemy soldiers reach the kingdom.', 'sys', '#e8d48a'); return; }
  if (e.type === 'npc' || e.type === 'king' || e.type === 'guard') { UI._npc = e; Sys.hail(e); }
};

// ---------- mouse ----------
const mouse = { l: false, r: false, lx: 0, ly: 0, downX: 0, downY: 0, downT: 0, moved: 0, btn: -1 };
// the cursor turns into the tool when it is over something you can gather (right-click to gather)
const svgCur = (body, hx, hy) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>${body}</svg>`)}") ${hx} ${hy}, pointer`;
const TOOL_CURSOR = {
  pick: svgCur(`<path d='M6 4 Q16 1 27 9 Q17 6 9 8 Z' fill='#cfd6de' stroke='#222' stroke-width='1.2'/><rect x='14.5' y='5' width='3.2' height='24' rx='1.2' transform='rotate(18 16 17)' fill='#8a5a2e' stroke='#222' stroke-width='1.1'/>`, 6, 4),
  axe: svgCur(`<rect x='14' y='6' width='3.2' height='24' rx='1.2' transform='rotate(-20 16 18)' fill='#8a5a2e' stroke='#222' stroke-width='1.1'/><path d='M8 4 Q4 9 7 15 L15 11 L14 6 Z' fill='#cfd6de' stroke='#222' stroke-width='1.2'/>`, 6, 6),
  knife: svgCur(`<path d='M4 4 L20 20 L22 18 Q12 6 4 4 Z' fill='#e2e6ea' stroke='#222' stroke-width='1.1'/><rect x='19' y='19' width='3' height='11' rx='1.2' transform='rotate(-45 20.5 24.5)' fill='#5a3a20' stroke='#222' stroke-width='1.1'/>`, 4, 4),
};
let hoverT = 0, hoverCur = '';
function hoverTool(sx, sy) {
  const now = performance.now(); if (now - hoverT < 90) return; hoverT = now;
  const K = KR.Kingdom; const p = G.player; let tool = null;
  if (K && p && !p.dead && !view.look) {
    const e = pickAt(sx, sy);
    if (e) { if (K.skinnable && K.skinnable(e) && (!e.loot || !e.loot.items.length)) tool = 'knife'; }
    else { const d = world3d.pickDecor(screenRay(sx, sy)); const h = d && K.harvestOf && K.harvestOf(d); if (h && !(d.cutUntil && d.cutUntil > G.now)) tool = h.tool; }
  }
  const cur = (tool && TOOL_CURSOR[tool]) || ''; if (cur !== hoverCur) { hoverCur = cur; cv.style.cursor = cur; }
}
// the second mouse button pressed while the first is held only shows up in the buttons mask of move events
function syncButtons(ev) {
  if (ev.pointerType === 'touch' || K3.cine || typeof ev.buttons !== 'number') return;
  const l = !!(ev.buttons & 1), r = !!(ev.buttons & 2);
  // only ever adds a button here: some browsers report no buttons on moves while the mouse is locked, and that must
  // not end a right drag halfway (releases come from pointerup, which always arrives)
  if (r && !mouse.r) { mouse.r = true; steerFromCamera(); }
  if (l && !mouse.l) mouse.l = true;
  syncLook();
}
// EverQuest mouse: hold the right button and drag to look and steer (the hero turns left and right with the mouse, the
// view tilts up and down). The left button only ever clicks, dragged or not. The cursor hides and locks only once a
// right drag really starts (a plain right-click never locks, so the browser's cooldown between locks never bites),
// and it comes back the moment you let go (or switch away, or a window opens).
const dragging = () => mouse.r && mouse.moved > 3;
function syncLook() { const want = running && dragging(); if (want && !view.look) startLook(); else if (!want && view.look) endLook(); }
// pressing the right button after a free look turns the hero to face where the camera looks
function steerFromCamera() { if (view.oyaw) { view.yaw += view.oyaw; view.oyaw = 0; } }
// the first move after the pointer locks can carry a jump of hundreds of pixels; real moves never come in that big
let skipMove = 0; // the first move or two after the lock lands can carry the jump to the screen centre
const tame = (v) => (Math.abs(v) > 250 ? 0 : K3.clamp(v, -120, 120)); // a real flick never moves 250 px in one event: those are the browser's lock jumps
let lastClick = 0;
function wantLock() { return cv.requestPointerLock && !('ontouchstart' in window && navigator.maxTouchPoints > 0 && !matchMedia('(pointer:fine)').matches); }
// the ordinary (accelerated) mouse feel, like the desktop cursor; if the browser won't lock, the drag still works
function startLook() { view.look = true; cv.style.cursor = 'none'; if (wantLock()) { try { const pr = cv.requestPointerLock(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {} } }
function endLook() { view.look = false; if (document.pointerLockElement === cv) try { document.exitPointerLock(); } catch (e) {} if (cv.style.cursor === 'none') cv.style.cursor = hoverCur; }
K3.endLook = endLook;
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (ev) => {
  if (!running || (K3.cine && !K3.cine.look)) return;
  if (K3.cine) { mouse.downX = ev.clientX; mouse.downY = ev.clientY; mouse.downT = performance.now(); mouse.moved = 0; if (ev.button === 2) { mouse.r = true; ev.preventDefault(); } else if (ev.button === 0) mouse.l = true; syncLook(); try { cv.setPointerCapture(ev.pointerId); } catch (e) {} return; }
  A.init();
  if (ev.pointerType === 'touch') return onTouchStart(ev);
  mouse.downX = ev.clientX; mouse.downY = ev.clientY; mouse.downT = performance.now(); mouse.moved = 0;
  if (ev.button === 2) { mouse.r = true; steerFromCamera(); ev.preventDefault(); }
  else if (ev.button === 0) { mouse.l = true; }
  else { const code = 'Mouse' + (ev.button + 2); pressed.add(code); const act = actionOf(code); if (act) { ev.preventDefault(); runAction(act, G.player); } }
  try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
});
addEventListener('pointermove', (ev) => {
  if (!running) return;
  if (ev.pointerType === 'touch') return onTouchMove(ev);
  const mxv = tame(ev.movementX || 0), myv = tame(ev.movementY || 0);
  syncButtons(ev);
  if (!mouse.r && !mouse.l && ev.target === cv) hoverTool(ev.clientX, ev.clientY);
  if (mouse.r || mouse.l) mouse.moved += Math.abs(mxv) + Math.abs(myv);
  syncLook();
  if (skipMove > 0) { skipMove--; return; }
  if (dragging() && (!K3.cine || K3.cine.look)) {
    const s = 0.0026 * (K3.settings.sens || 1);
    // the right button (alone or with the left) steers the hero and tilts the view
    view.yaw -= mxv * s;
    view.pitch -= myv * s * (K3.settings.sensY || 1) * (K3.settings.invertY ? -1 : 1);
  }
});
addEventListener('pointerup', (ev) => {
  if (!running) return;
  if (ev.pointerType === 'touch') return onTouchEnd(ev);
  const click = performance.now() - mouse.downT < 400 && mouse.moved < 6;
  if (ev.button !== 0 && ev.button !== 2) pressed.delete('Mouse' + (ev.button + 2));
  if (K3.cine) { if (ev.button === 2) mouse.r = false; else if (ev.button === 0) mouse.l = false; syncLook(); return; }
  // under pointer lock the click lands where the cursor was when the button went down
  const onCv = ev.target === cv || document.pointerLockElement === cv;
  if (ev.button === 2 && mouse.r) { mouse.r = false; syncLook(); if (click) rightClick(mouse.downX, mouse.downY); }
  else if (ev.button === 0 && mouse.l) { mouse.l = false; syncLook(); if (onCv && !mouse.r) leftClick(mouse.downX, mouse.downY); } // a left press is always a click, dragged or not
  if (typeof ev.buttons === 'number' && !ev.buttons) { mouse.l = mouse.r = false; syncLook(); } // a chord let go at once
});
// the cursor must always come back: a lock granted after the button was already released is handed straight back,
// and losing the lock (Esc, switching windows) ends the look
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === cv) skipMove = 2;
  if (document.pointerLockElement === cv && (!view.look || !running || !dragging())) { view.look = false; try { document.exitPointerLock(); } catch (e) {} }
  else if (document.pointerLockElement !== cv && view.look) { view.look = false; mouse.l = mouse.r = false; }
  if (document.pointerLockElement !== cv && cv.style.cursor === 'none') cv.style.cursor = hoverCur;
});
document.addEventListener('pointerlockerror', () => { if (view.look && !dragging()) endLook(); }); // a refused lock: the drag carries on with the cursor hidden
document.addEventListener('visibilitychange', () => { if (document.hidden) { mouse.l = mouse.r = false; pressed.clear(); endLook(); } });
cv.addEventListener('lostpointercapture', (ev) => { if (ev.pointerType !== 'touch' && document.pointerLockElement !== cv && typeof ev.buttons === 'number' && !ev.buttons && (mouse.l || mouse.r)) { mouse.l = mouse.r = false; syncLook(); } });
// a window opening (loot, a merchant, the map) gives the cursor back at once
{ const open0 = UI.open; if (open0) UI.open = function () { if (view.look) { mouse.l = mouse.r = false; endLook(); } return open0.apply(this, arguments); }; }

function pickAt(sx, sy) { return actors.pickScreen(sx, sy); }
function leftClick(sx, sy) {
  const p = G.player; if (!p || p.dead) return;
  const e = pickAt(sx, sy);
  const dbl = performance.now() - lastClick < 320; lastClick = performance.now();
  if (e) {
    p.target = e;
    if (dbl && !e.dead && G.isHostile(p, e)) { p.autoAttack = true; }
    else if (dbl || (!G.isHostile(p, e) && Math.hypot(e.x - p.x, e.y - p.y) < 100) || (e.dead && e.loot && Math.hypot(e.x - p.x, e.y - p.y) < 100)) Main.interact(e);
    return;
  }
  const d = world3d.pickDecor(screenRay(sx, sy));
  // a sewer grate in the street: click it (when close) to climb down
  { const ray = screenRay(sx, sy); const gp = rayGround ? rayGround(ray) : null; const gr = W.portals && W.portals.find((pt) => pt.cityGrate && !pt.back && ((d && d.cityGrate && d.tx === pt.x && d.ty === pt.y) || (gp && Math.hypot(gp.x / TILE - (pt.x + 0.5), gp.z / TILE - (pt.y + 0.5)) < 1.2)));
    if (gr) { if (Math.hypot(p.x / TS - (gr.x + 0.5), p.y / TS - (gr.y + 0.5)) <= 3) Sys.useGrate(gr); else G.log('Walk up to the grate first.', 'sys', '#aaa'); return; } }
  // trees, rocks and hides are gathered with the right button (rightClick); a left click only selects
  // clicking the ground does nothing in 3D: you steer with the keys and the mouse
}
function rightClick(sx, sy) {
  const p = G.player; if (!p || p.dead) return;
  const e = pickAt(sx, sy); const K = KR.Kingdom;
  if (!e) {
    const d = world3d.pickDecor(screenRay(sx, sy)); if (d && K && K.harvestOf && K.harvestOf(d)) K.startHarvest(d); return;
  }
  if (K && K.skinnable && K.skinnable(e) && (!e.loot || !e.loot.items.length) && K.startSkin) { p.target = e; K.startSkin(e); return; }
  p.target = e;
  if (G.isHostile(p, e) && !e.dead) { p.autoAttack = true; if (D.CLASSES[p.c.cls].role !== 'caster') { p.moveTo = null; if (p.chase !== e) G.log(`Auto attack and auto follow on ${e.name}. Move with WASD to stop following.`, 'sys', '#cccccc'); p.chase = e; } }
  else Main.interact(e);
}
cv.addEventListener('wheel', (e) => { if (!running) return; e.preventDefault(); zoomBy(e.deltaY > 0 ? 1.2 : -1.2); }, { passive: false });
cv.addEventListener('dblclick', (e) => e.preventDefault());
addEventListener('beforeunload', () => { if (running) { Sys.save(true); Sys.Net.leave(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && running) Sys.save(true); });

// ---------- touch: left half of the screen walks, right half looks ----------
const touch = { move: false, look: null, id: -1, sx: 0, sy: 0, mx: 0, my: 0, tapT: 0 };
const looks = new Map();
function onTouchStart(ev) {
  if (ev.clientX < innerWidth * 0.4 && !touch.move) { touch.move = true; touch.id = ev.pointerId; touch.sx = ev.clientX; touch.sy = ev.clientY; touch.mx = touch.my = 0; }
  else looks.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY, t: performance.now() });
  try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
}
function onTouchMove(ev) {
  if (touch.move && ev.pointerId === touch.id) { const dx = ev.clientX - touch.sx, dy = ev.clientY - touch.sy, d = Math.hypot(dx, dy); touch.mx = d > 10 ? dx / Math.max(d, 50) : 0; touch.my = d > 10 ? dy / Math.max(d, 50) : 0; return; }
  const l = looks.get(ev.pointerId); if (!l) return; const ts = 0.006 * (K3.settings.sens || 1); view.yaw -= (ev.clientX - l.x) * ts; view.pitch -= (ev.clientY - l.y) * ts * (K3.settings.sensY || 1) * (K3.settings.invertY ? -1 : 1); l.x = ev.clientX; l.y = ev.clientY;
}
function onTouchEnd(ev) {
  if (touch.move && ev.pointerId === touch.id) { touch.move = false; touch.mx = touch.my = 0; return; }
  const l = looks.get(ev.pointerId); looks.delete(ev.pointerId);
  if (l && performance.now() - l.t < 300 && Math.hypot(ev.clientX - l.sx, ev.clientY - l.sy) < 12) { const e = pickAt(ev.clientX, ev.clientY); if (e) { const p = G.player; p.target = e; if (G.isHostile(p, e) && !e.dead) p.autoAttack = true; else Main.interact(e); } else leftClick(ev.clientX, ev.clientY); }
}

Main.boot();

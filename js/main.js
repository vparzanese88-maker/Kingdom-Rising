// Kingdom Rising — boot, game loop, input, camera, music director
(function () {
  const KR = (window.KR = window.KR || {});
  const D = KR.D, U = KR.U, W = KR.W, G = KR.G, Sys = KR.Sys, R = KR.R, UI = KR.UI, A = KR.A, T = KR.T;
  const Main = (KR.Main = {});
  const TS = D.TS;
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  let running = false, last = 0, dpr = 1;
  const keys = {};
  let musicOverride = null, combatT = 0, saveT = 0, worldKey = null;

  function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.floor(innerWidth * dpr); cv.height = Math.floor(innerHeight * dpr); cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; }
  addEventListener('resize', resize); resize();

  // ---------- boot ----------
  Main.boot = async function () {
    const loading = document.getElementById('loading');
    try { G.ui_autoloot = JSON.parse(localStorage.getItem('kr_autoloot') || 'true'); R.cam.zoom = JSON.parse(localStorage.getItem('kr_zoom') || '1'); } catch (e) {}
    await Promise.race([Sys.Store.init(), new Promise((r) => setTimeout(r, 4000))]);
    await Sys.loadAccount();
    A.setVolumes(G.account.settings.music, G.account.settings.sfx);
    loading.hidden = true;
    const start = () => { A.init(); A.setVolumes(G.account.settings.music, G.account.settings.sfx); let seen = false; try { seen = !!localStorage.getItem('kr_intro_seen'); } catch (e) {} KR.Menus.showMenu(); /* the full story now plays when a new hero is created */ setTimeout(() => { try { if (worldKey !== G.account.seed && !running) Main.ensureWorld(); } catch (e) { console.error(e); } }, 700); };
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

  // entering the realm goes full screen (must run inside the click, before any await)
  // in full screen, keep Esc for the game (closing windows) instead of leaving full screen. Holding Esc still exits.
  const lockEsc = () => { try { if (navigator.keyboard && navigator.keyboard.lock) { if (document.fullscreenElement) navigator.keyboard.lock(['Escape']).catch(() => {}); else navigator.keyboard.unlock(); } } catch (e) {} };
  document.addEventListener('fullscreenchange', lockEsc);
  Main.autoFullscreen = function () {
    let on = true; try { on = localStorage.getItem('kr_auto_fs') !== '0'; } catch (e) {}
    if (!on || document.fullscreenElement || document.webkitFullscreenElement) return;
    const d = document.documentElement;
    try { const pr = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : d.webkitRequestFullscreen && d.webkitRequestFullscreen(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {}
  };
  Main.enterWorld = async function (id, newChar) {
    Main.autoFullscreen();
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
      await step('Opening your journal...');
      console.log(`Entered world in ${Math.round(performance.now() - t0)} ms`);
      if (newChar) { G.clock = 9 * 60; Sys.save(true); } else if (G.account.clock != null) G.clock = G.account.clock;
      Sys.Net.init();
      scr.hidden = true; scr.innerHTML = '';
      document.getElementById('ui').hidden = false;
      UI.buildHUD();
      Main.snapCamera();
      if (newChar) {
        UI.banner(`Welcome to ${D.FACTIONS[c.faction].city}`, `Speak to ${D.FACTIONS[c.faction].king} in his castle's throne hall, at the top of the great stairs. Look for the gold ! above townsfolk.`);
        G.log('Tip: WASD to move, Tab to target, Q to auto attack, 1-3 for abilities, E to talk. Press Esc for help.', 'sys', '#e8d48a');
      }
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
    document.getElementById('ui').hidden = true;
    G.player = null; G.ents = [];
    KR.Menus.showMenu(); if (create === true) KR.Menus.showCreate();
  };
  Main.snapCamera = function () { const p = G.player; if (p) { R.cam.x = p.x; R.cam.y = p.y - 20; } };
  Main.setMusicOverride = (m) => { musicOverride = m; };
  Main.onCombat = () => { combatT = 6; };

  // ---------- loop ----------
  function loop(now) {
    try { loopBody(now); } catch (err) { console.error(err); if (!Main._loopErr) { Main._loopErr = true; G.log('A game error occurred: ' + (err && err.message) + '. The game will keep running; please tell Claude what you were doing.', 'sys', '#ff8a6a'); } }
    if (running) requestAnimationFrame(loop);
  }
  function loopBody(now) {
    if (!running) return;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    const p = G.player;
    let mx = 0, my = 0;
    if (!typing()) { if (keys.w || keys.arrowup) my -= 1; if (keys.s || keys.arrowdown) my += 1; if (keys.a || keys.arrowleft) mx -= 1; if (keys.d || keys.arrowright) mx += 1; }
    if (touch.active) { mx = touch.dx; my = touch.dy; }
    if (p.fear > 0 && p.fearFrom) { const dx = p.x - p.fearFrom.x, dy = p.y - p.fearFrom.y, d = Math.hypot(dx, dy) || 1; mx = dx / d; my = dy / d; }
    G.update(dt, { mx, my });
    Sys.worldTick(dt);
    p.c.playTime = (p.c.playTime || 0) + dt;
    if (p.drunkUntil && p.drunkUntil < G.now) { p.drunkUntil = 0; p.drinks = 0; }
    // camera
    const tx = p.x, ty = p.y - 20;
    R.cam.x += (tx - R.cam.x) * Math.min(1, dt * 8); R.cam.y += (ty - R.cam.y) * Math.min(1, dt * 8);
    // draw
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0a0f'; ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.save(); try { R.draw(ctx, innerWidth, innerHeight, now / 1000); } finally { ctx.restore(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    UI.tick();
    Sys.Net.tick();
    // music director
    combatT -= dt;
    const inCombat = combatT > 0 && G.inCombat(p);
    let track;
    const b = W.buildingAt(p.x, p.y);
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
    A.play(track);
    // autosave
    saveT += dt; if (saveT > 45) { saveT = 0; Sys.save(); }
    // proximity: close NPC windows if walked away
    const npcW = UI.wins.npc; if (npcW && !npcW.el.hidden && UI._npc && Math.hypot(UI._npc.x - p.x, UI._npc.y - p.y) > 260) UI.close('npc');
  }

  // ---------- input ----------
  const typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable); };
  addEventListener('keydown', (e) => {
    if (!running) return;
    const k = e.key.toLowerCase();
    if (typing()) { if (e.key === 'Escape') document.activeElement.blur(); return; }
    if (e.key === 'Enter') { e.preventDefault(); const ci = document.getElementById('chatin'); if (ci) ci.focus(); return; }
    if (e.key === '/') { e.preventDefault(); const ci = document.getElementById('chatin'); if (ci) { ci.value = '/'; ci.focus(); } return; }
    keys[k] = true;
    const p = G.player; if (!p || p.dead) { if (k === 'escape') UI.closeAll() || UI.toggle('menu'); return; }
    if (e.key === 'Tab') { e.preventDefault(); Main.targetNearest(true); return; }
    if (/^[0-9]$/.test(k)) { const i = k === '0' ? 9 : +k - 1; if (i < D.slotsForLevel(p.c.level)) { const a = Sys.bar()[i]; if (a) G.useAction(a); } return; }
    switch (k) {
      case 'q': case '`': Main.toggleAuto(); break;
      case 'r': Main.cycleRange(); break;
      case 'x': Main.toggleSit(); break;
      case 'e': Main.interact(); break;
      case 'm': UI.toggle('map'); break;
      case 'z': UI.toggleMinimap(); break;
      case 'f': UI.toggleFullscreen(); break;
      case 'i': case 'b': UI.toggle('inv'); break;
      case 'p': UI.toggle('spells'); break;
      case 'k': UI.toggle('abil'); break;
      case 'j': case 'l': UI.toggle('journal'); break;
      case 'n': UI.toggle('kingdom'); break;
      case 'u': UI.toggle('macros'); break;
      case 'y': UI.toggle('mercs'); break;
      case 'g': UI.toggle('group'); break;
      case 'f1': e.preventDefault(); UI.toggle('help'); break;
      case 'escape': if (!UI.closeAll()) { if (p.target) p.target = null; else UI.toggle('menu'); } break;
      case '=': case '+': R.cam.zoom = Math.min(1.6, R.cam.zoom + 0.1); break;
      case '-': R.cam.zoom = Math.max(0.7, R.cam.zoom - 0.1); break;
    }
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  Main.toggleAuto = function () { const p = G.player; p.autoAttack = !p.autoAttack; if (p.autoAttack) { if (!p.target || !G.isHostile(p, p.target) || p.target.dead) Main.targetNearest(); if (!p.target) p.autoAttack = false; p.sit = false; } G.log(p.autoAttack ? 'Auto attack is on.' : 'Auto attack is off.', 'sys', '#ccc'); A.sfx('click'); };
  Main.cycleRange = function () { const c = G.player.c; if (!c.equip.range) { G.log('You have no ranged weapon equipped.', 'sys', '#aaa'); return; } const order = ['both', 'melee', 'ranged']; c.rangeMode = order[(order.indexOf(c.rangeMode || 'both') + 1) % 3]; G.log(`Combat mode: ${c.rangeMode === 'both' ? 'melee and ranged' : c.rangeMode + ' only'}.`, 'sys', '#ccc'); A.sfx('click'); };
  Main.toggleSit = function () { const p = G.player; if (p.moving) return; p.sit = !p.sit; if (p.sit) { p.autoAttack = false; p.cast = null; } G.log(p.sit ? 'You sit down.' : 'You stand up.', 'sys', '#ccc'); };
  Main.targetNearest = function (cycle) {
    const p = G.player;
    const cands = G.ents.filter((e) => !e.dead && !e.removed && G.isHostile(p, e) && Math.hypot(e.x - p.x, e.y - p.y) < 650 && !(W.buildingAt(e.x, e.y) && W.buildingAt(e.x, e.y) !== W.buildingAt(p.x, p.y))).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
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
    if ((e.barracks || e.recruiter) && KR.War) { G.faceTo && G.faceTo(e, p); if (e.recruiter) G.say(e, e.faction === p.c.faction ? 'Soldiers cost gold. A Barracks lets me train guards and men-at-arms; an Archery Range, a Stable and a Siege Workshop let me train archers, cavalry and siege. Walls and towers are raised from the kingdom panel (N).' : 'Not for your kind.', 3); KR.War.openBarracks(e); return; }
    if (e.bell) { G.log(e.ringUntil > G.now ? 'The alarm bell is ringing: the kingdom is under attack!' : 'The alarm bell hangs quiet. A guard will ring it if enemy soldiers reach the kingdom.', 'sys', '#e8d48a'); return; }
    if (e.type === 'npc' || e.type === 'king' || e.type === 'guard') { UI._npc = e; Sys.hail(e); }
  };

  // mouse
  const touch = { active: false, dx: 0, dy: 0 };
  function screenToWorld(sx, sy) { const z = R.cam.zoom; return [R.cam.x + (sx - innerWidth / 2) / z, R.cam.y + (sy - innerHeight / 2) / z]; }
  function pickEnt(wx, wy) {
    const p = G.player; let best = null, bd = 1e9;
    const inside = W.buildingAt(p.x, p.y);
    for (const e of G.ents) {
      if (e === p || e.removed || e.noPick) continue; if (W.buildingAt(e.x, e.y) && W.buildingAt(e.x, e.y) !== inside) continue;
      const sc = e.scale || 1; const cy = e.y - (e.h || 46) * sc * 0.45;
      const d = Math.hypot(wx - e.x, (wy - cy) * 0.7);
      const rad = Math.max(22, (e.r || 12) * sc * 1.6);
      if (d < rad && d < bd) { bd = d; best = e; }
    }
    // other players can be clicked too (to heal, buff or invite them)
    for (const pp of Sys.Net.peers) {
      if ((pp.rm || 'main') !== (W.realm || 'main') || !Number.isFinite(pp.x) || !Number.isFinite(pp.y)) continue; if (W.buildingAt(pp.x, pp.y) && W.buildingAt(pp.x, pp.y) !== inside) continue;
      const d = Math.hypot(wx - pp.x, (wy - (pp.y - 21)) * 0.7);
      if (d < 22 && d < bd) { bd = d; best = Sys.peerEnt(pp); }
    }
    return best;
  }
  let lastClick = 0;
  cv.addEventListener('pointerdown', (ev) => {
    if (!running) return;
    A.init();
    const [wx, wy] = screenToWorld(ev.clientX, ev.clientY);
    const p = G.player; if (p.dead) return;
    const e = pickEnt(wx, wy);
    const dbl = performance.now() - lastClick < 320; lastClick = performance.now();
    if (ev.button === 2) { ev.preventDefault(); if (e) { p.target = e; if (G.isHostile(p, e) && !e.dead) { p.autoAttack = true; if (D.CLASSES[p.c.cls].role !== 'caster') { p.moveTo = null; if (p.chase !== e) G.log(`Auto attack and auto follow on ${e.name}. Move with WASD to stop following.`, 'sys', '#cccccc'); p.chase = e; } } else Main.interact(e); } return; }
    if (e) {
      p.target = e;
      if ((dbl || ev.pointerType === 'touch') && !e.dead && G.isHostile(p, e)) { p.autoAttack = true; }
      else if (dbl || (!G.isHostile(p, e) && Math.hypot(e.x - p.x, e.y - p.y) < 100) || (e.dead && e.loot && Math.hypot(e.x - p.x, e.y - p.y) < 100)) Main.interact(e);
      return;
    }
    if (ev.button === 0 && KR.Kingdom && KR.Kingdom.clickWorld(wx, wy)) return;
    if (ev.pointerType === 'touch') { touch.active = true; touch.sx = ev.clientX; touch.sy = ev.clientY; touch.dx = 0; touch.dy = 0; touch.moved = false; cv.setPointerCapture(ev.pointerId); return; }
    p.moveTo = { x: wx, y: wy }; p.chase = null;
    G.fxAdd({ k: 'ring', x: wx, y: wy, r: 14, col: '#ffffff', life: 0.4 });
  });
  cv.addEventListener('pointermove', (ev) => { if (!touch.active) return; const dx = ev.clientX - touch.sx, dy = ev.clientY - touch.sy, d = Math.hypot(dx, dy); if (d > 12) { touch.moved = true; touch.dx = dx / Math.max(d, 40); touch.dy = dy / Math.max(d, 40); } });
  const endTouch = (ev) => { if (!touch.active) return; touch.active = false; if (!touch.moved) { const [wx, wy] = screenToWorld(ev.clientX, ev.clientY); G.player.moveTo = { x: wx, y: wy }; } touch.dx = touch.dy = 0; };
  cv.addEventListener('pointerup', endTouch); cv.addEventListener('pointercancel', endTouch);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => { if (!running) return; e.preventDefault(); R.cam.zoom = U.clamp(R.cam.zoom * (e.deltaY > 0 ? 0.92 : 1.08), 0.7, 1.6); }, { passive: false });
  addEventListener('beforeunload', () => { if (running) { Sys.save(true); Sys.Net.leave(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) Sys.save(true); });

  Main.boot();
})();

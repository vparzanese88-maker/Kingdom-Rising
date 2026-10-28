// Kingdom Rising — the war button: a big, burning ⚔ ATTACK on the HUD whenever you have soldiers or ships ready,
// the battle score and the din of the fight, and every order to march made to feel like one
(function () {
  const KR = window.KR; const { D, G, W } = KR; const A = KR.A;
  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const pf = () => (G.player && G.player.c ? G.player.c.faction : null);
  const foe = (f) => D.FACTION_IDS.find((x) => x !== f);
  const live = (e) => e && !e.dead && !e.removed;

  // ---------- the look ----------
  const css = document.createElement('style');
  css.textContent = `
  #war-btn { position: fixed; right: 22px; bottom: 74px; z-index: 40; width: 178px; height: 82px; padding: 4px 0 0; border-radius: 14px; cursor: pointer;
    border: 2px solid #ffcf6a; color: #fff6dc; font: 700 26px/1 'IM Fell English SC', Georgia, serif; letter-spacing: 3px; text-shadow: 0 2px 6px #000, 0 0 14px #ff7a1a;
    background: radial-gradient(120% 140% at 50% 110%, #ff6a12 0%, #b3220c 38%, #4a0c06 78%); overflow: hidden; isolation: isolate;
    box-shadow: 0 0 18px 4px rgba(255,110,30,.65), inset 0 0 18px rgba(0,0,0,.6); animation: wbPulse 1.4s ease-in-out infinite; user-select: none; }
  #war-btn[hidden] { display: none; }
  #war-btn::before, #war-btn::after { content: ''; position: absolute; inset: -40% -10% 0 -10%; z-index: -1; pointer-events: none;
    background: radial-gradient(4px 4px at 12% 90%, #ffd27a, transparent), radial-gradient(3px 3px at 30% 95%, #ffb04a, transparent), radial-gradient(5px 5px at 52% 92%, #ffe6a0, transparent),
      radial-gradient(3px 3px at 70% 96%, #ff9a3a, transparent), radial-gradient(4px 4px at 88% 90%, #ffd27a, transparent), radial-gradient(2px 2px at 40% 98%, #fff, transparent);
    animation: wbEmbers 1.6s linear infinite; opacity: .9; }
  #war-btn::after { animation-delay: -.8s; filter: hue-rotate(-12deg); }
  #war-btn .wb-flame { position: absolute; left: 0; right: 0; bottom: -10px; height: 60%; z-index: -1; background: linear-gradient(0deg, rgba(255,150,40,.85), rgba(255,80,20,.25) 60%, transparent);
    filter: blur(6px); animation: wbFlicker .18s steps(2) infinite alternate; }
  #war-btn small { display: block; font: 600 12px/1.2 Georgia, serif; letter-spacing: 1px; color: #ffe2b0; margin-top: 4px; text-shadow: 0 1px 3px #000; }
  #war-btn:hover { transform: scale(1.06); } #war-btn:active { transform: scale(.97); }
  #war-btn.wb-out { background: radial-gradient(120% 140% at 50% 110%, #ffb02a 0%, #8a3a0c 45%, #2a0c06 85%); }
  @keyframes wbPulse { 0%,100% { box-shadow: 0 0 14px 3px rgba(255,110,30,.55), inset 0 0 18px rgba(0,0,0,.6); } 50% { box-shadow: 0 0 34px 10px rgba(255,140,40,.9), inset 0 0 12px rgba(0,0,0,.4); } }
  @keyframes wbEmbers { 0% { transform: translateY(30%); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-60%); opacity: 0; } }
  @keyframes wbFlicker { 0% { opacity: .75; transform: scaleY(1); } 100% { opacity: 1; transform: scaleY(1.12); } }
  #war-menu { position: fixed; right: 22px; bottom: 166px; z-index: 41; display: grid; gap: 8px; width: 230px; padding: 12px; border-radius: 12px;
    background: rgba(24,10,6,.92); border: 1px solid #a8642a; box-shadow: 0 10px 30px rgba(0,0,0,.6); }
  #war-menu[hidden] { display: none; }
  #war-menu h5 { margin: 0 0 2px; font: 700 15px 'IM Fell English SC', Georgia, serif; color: #ffd27a; letter-spacing: 1px; }
  #war-menu button { font: 700 16px Georgia, serif; padding: 10px 12px; border-radius: 9px; border: 1px solid #c88a3a; color: #fff3d6; cursor: pointer; text-align: left;
    background: linear-gradient(180deg, #7a2410, #3a0c06); text-shadow: 0 1px 3px #000; }
  #war-menu button.wm-retreat { background: linear-gradient(180deg, #3e3a30, #1c1a14); border-color: #8a8270; }
  #war-menu button:disabled { opacity: .35; cursor: default; }
  #war-menu button:not(:disabled):hover { filter: brightness(1.25); }
  #war-banner { position: fixed; left: 0; right: 0; top: 22%; z-index: 60; text-align: center; pointer-events: none; font: 700 clamp(28px, 4.4vw, 56px)/1.1 'IM Fell English SC', Georgia, serif;
    color: #fff1cc; letter-spacing: 3px; text-shadow: 0 0 24px #ff5a10, 0 4px 12px #000; animation: wbBanner 3.4s ease forwards; }
  #war-banner small { display: block; font-size: .42em; letter-spacing: 2px; color: #ffd8a0; margin-top: 8px; }
  #war-flash { position: fixed; inset: 0; z-index: 59; pointer-events: none; background: radial-gradient(circle at 50% 60%, rgba(255,120,30,.55), rgba(120,10,0,.35) 60%, transparent 85%); animation: wbFlash 1.1s ease-out forwards; }
  @keyframes wbBanner { 0% { opacity: 0; transform: scale(1.6); filter: blur(6px); } 12% { opacity: 1; transform: scale(1); filter: none; } 78% { opacity: 1; } 100% { opacity: 0; transform: scale(.96); } }
  @keyframes wbFlash { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
  /* the order buttons in the kingdom panel: big and burning too */
  .rm-orders .btn, .rm-orders2 .btn { font-size: 15px !important; padding: 10px 14px !important; border-radius: 9px !important; margin: 3px; }
  .rm-orders .btn.gold:not(:disabled) { background: linear-gradient(180deg, #a8341a, #4a0e06) !important; color: #fff3d6 !important; border-color: #ffcf6a !important; animation: wbPulse 1.4s ease-in-out infinite; }
  body.k3-menu #war-btn, body.k3-menu #war-menu { display: none !important; }
  `;
  document.head.appendChild(css);

  // ---------- the moment of the order ----------
  function fanfare(f, what) {
    try { A.init && A.init(); A.sfx('warhorn', 1); setTimeout(() => A.sfx('battlecry', 0.9), 900); setTimeout(() => A.sfx('wardrum', 0.9), 250); setTimeout(() => A.sfx('wardrum', 0.9), 650); } catch (e) {}
    try { A.battle && A.battle(150); } catch (e) {}
    const city = D.FACTIONS[foe(f)] ? D.FACTIONS[foe(f)].city : 'the enemy';
    const head = what === 'fleet' ? `Your fleet sails on ${city}!` : what === 'all' ? `All-out attack on ${city}!` : `Your army marches on ${city}!`;
    const sub = what === 'fleet' ? 'Run out the guns' : what === 'all' ? 'Every sword, every ship' : 'For the crown and the kingdom';
    document.querySelectorAll('#war-banner, #war-flash').forEach((e) => e.remove());
    const fl = h('div'); fl.id = 'war-flash'; document.body.appendChild(fl); setTimeout(() => fl.remove(), 1200);
    const bn = h('div', '', `⚔ ${head} ⚔<small>${sub}</small>`); bn.id = 'war-banner'; document.body.appendChild(bn); setTimeout(() => bn.remove(), 3500);
    try { G.shake = Math.max(G.shake || 0, 0.8); } catch (e) {}
    try { if (window.K3 && K3.shakeHit) { K3.shakeHit(0.12, 0.6); setTimeout(() => K3.shakeHit(0.08, 0.5), 650); } } catch (e) {}
  }
  function retreatCue() { try { A.sfx('warhorn', 0.7); } catch (e) {} }
  // every way of ordering (this button, the kingdom panel, the chat commands) goes through War.command or orderAttack
  function hook() {
    const War = KR.War; if (!War || War._wbHooked) return !!(War && War._wbHooked);
    War._wbHooked = true;
    if (War.command) { const c0 = War.command; War.command = function (f, what) { const n = c0.apply(this, arguments); try { if (n > 0 && (f || pf()) === pf()) { if (/^retreat/.test(what)) retreatCue(); else fanfare(f || pf(), what); } } catch (e) {} return n; }; }
    if (War.orderAttack) { const o0 = War.orderAttack; War.orderAttack = function (f, opts) { const n = o0.apply(this, arguments); try { if (n > 0 && (f || pf()) === pf() && !hook.inCmd) fanfare(f || pf(), 'army'); } catch (e) {} return n; }; }
    return true;
  }
  // orders given through War.command call orderAttack inside: only one fanfare
  { const t = setInterval(() => { if (hook()) { clearInterval(t); const War = KR.War; if (War.command) { const c1 = War.command; War.command = function () { hook.inCmd = true; try { return c1.apply(this, arguments); } finally { hook.inCmd = false; } }; } } }, 500); }

  // ---------- the button and its menu ----------
  let btn = null, menu = null;
  function state() {
    const War = KR.War, f = pf(); if (!War || !f || !G.player) return null;
    let home = 0, out = 0, ships = 0, atSea = 0;
    try { const a = War.army(f); home = a.home || 0; out = a.out || 0; } catch (e) {}
    try { if (War.fleet) { const fl = War.fleet(f); ships = fl.ships || 0; atSea = fl.atSea || 0; } } catch (e) {}
    if (!out) { try { out = War.squads && War.squads.some((s) => s.f === f && !s.hunt && s.members.some((m) => live(m) && m.warState !== 'home')) ? 1 : 0; } catch (e) {} }
    return { f, home, out, ships, atSea, moored: ships - atSea };
  }
  function build() {
    btn = h('button', '', `<span class="wb-flame"></span>⚔ ATTACK<small></small>`); btn.id = 'war-btn'; btn.hidden = true; btn.title = 'Order your army or your fleet into battle';
    btn.onclick = (e) => { e.stopPropagation(); try { A.init && A.init(); A.sfx('wardrum', 0.6); } catch (er) {} menu.hidden = !menu.hidden; if (!menu.hidden) fillMenu(); };
    menu = h('div'); menu.id = 'war-menu'; menu.hidden = true;
    ['pointerdown', 'mousedown', 'contextmenu', 'wheel'].forEach((ev) => { btn.addEventListener(ev, (e) => e.stopPropagation()); menu.addEventListener(ev, (e) => e.stopPropagation()); });
    document.body.appendChild(menu); document.body.appendChild(btn);
    document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== btn) menu.hidden = true; }, true);
  }
  function fillMenu() {
    const s = state(); if (!s) return; const War = KR.War;
    menu.innerHTML = `<h5>⚔ Orders</h5>`;
    const add = (label, what, ok, cls) => { const b = h('button', cls || '', label); b.disabled = !ok; b.onclick = () => { menu.hidden = true; try { War.command ? War.command(s.f, what) : what === 'army' ? War.orderAttack(s.f) : War.retreat && War.retreat(s.f); } catch (e) { console.warn(e); } try { KR.UI.refresh(); } catch (e) {} }; menu.appendChild(b); };
    add(`⚔ Attack with the army <small>(${s.home} ready)</small>`, 'army', s.home > 0 && !s.out);
    if (s.ships || War.fleet) add(`⛵ Attack with the fleet <small>(${s.moored} in harbour)</small>`, 'fleet', s.moored > 0);
    add('🔥 All-out attack', 'all', (s.home > 0 && !s.out) || s.moored > 0);
    if (s.out || s.atSea) {
      add('🏳 Retreat the army', 'retreat-army', !!s.out, 'wm-retreat');
      if (s.ships) add('🏳 Retreat the fleet', 'retreat-fleet', s.atSea > 0, 'wm-retreat');
      add('🏳 Retreat everyone', 'retreat-all', true, 'wm-retreat');
    }
  }
  function tickButton() {
    if (!btn) build();
    const s = state(); const cine = window.K3 && K3.cine;
    const show = !!(s && !cine && (s.home > 0 || s.moored > 0 || s.out || s.atSea) && (!W.realm || W.realm === 'main'));
    if (btn.hidden === show) btn.hidden = !show;
    if (!show) { menu.hidden = true; return; }
    const out = s.out || s.atSea; btn.classList.toggle('wb-out', !!out);
    const sm = btn.querySelector('small'); const txt = out ? (s.out ? 'army on the march' : 'fleet at sea') : `${s.home} soldier${s.home === 1 ? '' : 's'}${s.moored ? ` · ${s.moored} ship${s.moored === 1 ? '' : 's'}` : ''} ready`;
    if (sm.textContent !== txt) sm.textContent = txt;
    if (!menu.hidden) fillMenu();
  }

  // ---------- battle music and the din of the fight ----------
  const FIGHTERS = (e) => live(e) && (e.type === 'player' || e.type === 'merc' || e.type === 'pet' || e.raider || e.soldier || e.type === 'guard' || e.warState || e.realmWorker || e.bodyguard);
  let raidSeen = 0;
  function tickBattle() {
    const p = G.player; if (!p || !A || !A.enabled) return; const f = pf();
    // fighters close to you, in the thick of it
    let n = 0; for (const e of G.ents) { if (!FIGHTERS(e) || !e.inCombat) continue; if (Math.abs(e.x - p.x) > 1100 || Math.abs(e.y - p.y) > 1100) continue; n++; }
    try { A.battleDin && A.battleDin(n >= 4 ? n : 0); } catch (e) {}
    if (n >= 6) try { A.battle(25); } catch (e) {}
    // an enemy war party at (or inside) your town: the alarm and the battle score
    const cd = W.cityData && W.cityData[f];
    if (cd) {
      const R = (cd.R || 30) + 22; const foes = G.ents.some((e) => live(e) && e.raider && e.faction && e.faction !== f && Math.abs(e.x / D.TS - cd.cx) < R && Math.abs(e.y / D.TS - cd.cy) < R);
      if (foes) { if (!raidSeen) { raidSeen = 1; try { A.sfx('warhorn', 0.8); } catch (e) {} } try { A.battle(40); } catch (e) {} } else raidSeen = 0;
    }
    // your own army in the fight at their walls
    try { const War = KR.War; if (War && War.squads && War.squads.some((s) => s.f === f && s.members.some((m) => live(m) && m.inCombat))) A.battle(30); } catch (e) {}
  }

  // ---------- muskets and arquebuses: a real gunshot ----------
  { const t = setInterval(() => { if (!G.shoot || G.shoot._wb) return; const s0 = G.shoot; G.shoot = function (src, tgt, kind) {
      if (kind === 'GUN' && A && A.enabled) { try { const P = A.place ? A.place(src.x, src.y, 1800) : { v: 1, pan: 0 }; A.playBank && A.playBank('musket', 0.9 * P.v, P.pan, { rev: 0.12 }); } catch (e) {} A._noHeavy = true; try { return s0.apply(this, arguments); } finally { A._noHeavy = false; } }
      return s0.apply(this, arguments); }; G.shoot._wb = true; clearInterval(t); }, 500); }
  { const sfx1 = A.sfx; A.sfx = function (name) { if (A._noHeavy && name === 'heavy') return; return sfx1.apply(this, arguments); }; }

  // the battle score's level from the saved settings
  { const t = setInterval(() => { const st = G.account && G.account.settings; if (!st) return; clearInterval(t); if (st.battle != null && A.setBattleVol) A.setBattleVol(st.battle); }, 1000); }

  setInterval(() => { try { tickButton(); } catch (e) { console.warn('war button', e); } }, 500);
  setInterval(() => { try { tickBattle(); } catch (e) { console.warn('battle din', e); } }, 500);
  KR.WarButton = { fanfare, state };
})();

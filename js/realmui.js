// Kingdom Rising — the Kingdom panel (Status / Build / Workers / Army / Defenses) and the wood and stone bar on the HUD
(function () {
  const KR = window.KR;
  const D = KR.D, G = KR.G, W = KR.W, UI = KR.UI, R = KR.Realm;
  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = UI.esc;
  const myF = () => (G.player && G.player.c ? G.player.c.faction : null);
  const fmt = (n) => Math.floor(n).toLocaleString();

  // ---------------- styles ----------------
  const css = `
#realm-bar { position: fixed; left: 50%; top: 8px; transform: translateX(calc(-100% - 160px)); z-index: 30; display: flex; gap: 10px; align-items: center;
  padding: 3px 12px; border-radius: 99px; border: 1px solid var(--brass, #c9a45c); background: rgba(20, 14, 8, 0.78); color: #f3e6c6;
  font: 700 13px/1.3 var(--ui-font, Georgia, serif); pointer-events: auto; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
#realm-bar[hidden] { display: none; }
#realm-bar .rb-r { display: inline-flex; gap: 4px; align-items: center; }
#realm-bar .rb-r small { color: #b8d890; font-weight: 600; font-size: 11px; }
#realm-bar .rb-c { color: #e8c86a; font-size: 11px; font-weight: 600; }
.rm { display: flex; flex-direction: column; gap: 8px; height: 100%; }
.rm-res { display: flex; gap: 14px; flex-wrap: wrap; padding: 6px 8px; border-radius: 8px; background: rgba(0,0,0,0.25); font-weight: 700; }
.rm-res span small { color: #b8d890; font-weight: 600; margin-left: 3px; }
.rm-pane { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 8px; }
.rm-card { border: 1px solid rgba(201,164,92,0.45); border-radius: 8px; padding: 8px 10px; background: rgba(255,240,200,0.04); }
.rm-card h4 { margin: 0 0 3px; font-size: 14px; display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.rm-card h4 small { font-weight: 600; color: #c8b890; }
.rm-card p { margin: 2px 0 6px; font-size: 12px; color: #d8ccb0; }
.rm-card .rm-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 12px; }
.rm-card.lock { opacity: 0.62; }
.rm-card.done { border-color: rgba(140,200,120,0.6); }
.rm-bar { height: 8px; border-radius: 4px; background: rgba(0,0,0,0.4); overflow: hidden; flex: 1; min-width: 120px; }
.rm-bar i { display: block; height: 100%; background: linear-gradient(90deg, #c9a45c, #f0d48a); }
.rm-cost .bad { color: #ff9a7a; } .rm-cost .good { color: #b8e890; }
.rm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.rm-map { width: 100%; max-width: 300px; aspect-ratio: 1; border-radius: 8px; border: 1px solid rgba(201,164,92,0.45); image-rendering: pixelated; background: #0a0810; }
.rm-kv { font-size: 12px; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; }
.rm-kv b { color: #f0d48a; font-weight: 700; }
@media (max-width: 560px) { .rm-grid { grid-template-columns: 1fr; } #realm-bar { transform: translateX(-50%); top: 40px; } }
`;
  const st0 = document.createElement('style'); st0.textContent = css; document.head.appendChild(st0);

  // ---------------- the window ----------------
  let tab = 'status';
  const bw0 = UI.buildWindows;
  UI.buildWindows = function () {
    const r = bw0.apply(this, arguments);
    UI.win('realm', 'Kingdom', { w: Math.min(620, innerWidth - 16), h: Math.min(600, innerHeight - 30), y: 50, render: renderRealm, min: [300, 260] });
    makeBar();
    return r;
  };
  // the Kingdom key (N) and the crown button open the court once the liaison is hired
  const tog0 = UI.toggle, open0 = UI.open;
  const redirect = (id) => {
    if (id !== 'kingdom' || !G.player) return id;
    const st = R.state(myF());
    if (st && st.liaison) return 'realm';
    G.log('Hire the Court Liaison in the Town Hall (just inside the gate) to run the kingdom from anywhere.', 'sys', '#f0d48a');
    return null;
  };
  UI.toggle = function (id) { const t = redirect(id); if (t) return tog0.call(this, t); };
  UI.open = function (id) { const t = redirect(id); if (t) return open0.call(this, t); };

  function costHtml(f, cost) {
    const st = R.state(f); const s = [];
    if (cost.wood) s.push(`<span class="${st.wood >= cost.wood ? 'good' : 'bad'}">🪵 ${fmt(cost.wood)}</span>`);
    if (cost.stone) s.push(`<span class="${st.stone >= cost.stone ? 'good' : 'bad'}">🪨 ${fmt(cost.stone)}</span>`);
    return `<span class="rm-cost">${s.join(' ') || 'free'}</span>`;
  }
  const secs = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`; };
  function bar(p) { return `<div class="rm-bar"><i style="width:${Math.round(p * 100)}%"></i></div>`; }

  function renderRealm(w) {
    const f = myF(); if (!f) return; const st = R.state(f); if (!st) return;
    const F = D.FACTIONS[f]; const c = G.player.c; const rt = R.rates(f);
    w.title.textContent = `Kingdom of ${F.city}`;
    const sc = w.body.querySelector('.rm-pane'); const keep = sc ? sc.scrollTop : 0;
    w.body.innerHTML = `<div class="rm"><div class="rm-res"><span>🪵 Wood ${fmt(st.wood)}<small>+${rt.wood}/min</small></span><span>🪨 Stone ${fmt(st.stone)}<small>+${rt.stone}/min</small></span><span>🪙 ${G.fmtCoins(c.coins)}</span></div>
      <div class="tabs">${[['status', 'Status'], ['build', 'Build'], ['workers', 'Workers'], ['army', 'Army'], ['defenses', 'Defenses']].map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div>
      <div class="rm-pane"></div></div>`;
    w.body.querySelectorAll('.tab').forEach((b) => (b.onclick = () => { tab = b.dataset.t; renderRealm(w); }));
    const pane = $('.rm-pane', w.body);
    ({ status: paneStatus, build: paneBuild, workers: paneWorkers, army: paneArmy, defenses: paneDefenses }[tab] || paneStatus)(pane, f, st, w);
    pane.scrollTop = keep;
  }

  // ----- Status -----
  function workerLine(f, k) {
    const st = R.state(f); const wd = st.workers[k]; const W2 = R.WORKER[k];
    if (!wd.hired) return 'Not hired. Ask the Court Liaison.';
    if (wd.deadUntil > Date.now()) return `Killed! Back in ${secs(wd.deadUntil - Date.now())}.`;
    const e = R.workers(f).find((x) => x.realmWorker === k);
    if (!e || !e.wk) return W.realm && W.realm !== 'main' ? `At work (about ${R.yieldOf(f, k)} ${W2.res} a load).` : 'Getting ready.';
    switch (e.wk.st) {
      case 'go': return `Heading out to ${k === 'arborist' ? 'the trees' : 'the rocks'}.`;
      case 'work': return k === 'arborist' ? 'Chopping wood.' : 'Breaking stone.';
      case 'back': return `Carrying ${e.wk.load || ''} ${W2.res} home.`;
      case 'shelter': return 'Sheltering inside the walls: the bells are ringing.';
      case 'wait': return `Looking for ${k === 'arborist' ? 'trees' : 'rocks'} to work.`;
      default: return 'Back in town.';
    }
  }
  function armyCounts(f) {
    const Wr = KR.War;
    if (Wr && typeof Wr.army === 'function') { try { const a = Wr.army(f); if (a && typeof a === 'object') return a; } catch (e) {} }
    const out = {}; for (const e of G.ents) if (e.faction === f && !e.dead && !e.removed && (e.raider || e.type === 'guard')) { const k = e.raider ? 'Raiders' : 'Guards'; out[k] = (out[k] || 0) + 1; }
    return out;
  }
  function spottedFoes(f) {
    const Wr = KR.War; if (!Wr || typeof Wr.spotted !== 'function') return [];
    try { const s = Wr.spotted(f); if (Array.isArray(s)) return s; if (s instanceof Set) return [...s]; } catch (e) {}
    return [];
  }
  function paneStatus(pane, f, st) {
    const b = st.buildings; const built = R.ORDER.filter((id) => b[id]).map((id) => R.levelName(id, b[id]));
    const cons = st.construction.map((c0) => `${R.levelName(c0.id, c0.lvl)} ${Math.round(R.progress(f, c0.id) * 100)}% (${secs(c0.end - Date.now())})`);
    const army = armyCounts(f); const foes = spottedFoes(f);
    const alarm = KR.War && KR.War.alarm && KR.War.alarm[f] && KR.War.alarm[f].state;
    const g = h('div', 'rm-grid');
    g.innerHTML = `<div class="rm-card"><h4>Workers</h4><div class="rm-kv">${['arborist', 'miner'].map((k) => `<b>${R.WORKER[k].icon} ${R.WORKER[k].name}</b><span>${esc(workerLine(f, k))}</span>`).join('')}</div></div>
      <div class="rm-card"><h4>Buildings</h4><div class="rm-kv"><b>Standing</b><span>${esc(['Town Hall'].concat(built).join(', '))}</span><b>Building</b><span>${esc(cons.join('; ') || 'nothing')}</span>
        <b>Walls</b><span>${esc(R.DEFS.walls.levels[b.walls || 0])}, ${b.towers || 0} archer tower${b.towers === 1 ? '' : 's'}</span></div></div>
      <div class="rm-card"><h4>Army</h4><div class="rm-kv">${Object.keys(army).length ? Object.entries(army).map(([k, v]) => `<b>${esc(String(k))}</b><span>${esc(String(typeof v === 'object' ? v.n != null ? v.n : JSON.stringify(v) : v))}</span>`).join('') : '<span class="dim">No troops yet.</span>'}</div></div>
      <div class="rm-card"><h4>Threats</h4><div class="rm-kv"><b>Bells</b><span>${alarm ? 'Ringing! The gates are shut.' : 'Quiet.'}</span><b>Enemy raiders seen</b><span>${foes.length || 'none'}</span></div></div>`;
    pane.appendChild(g);
    const mc = h('div', 'rm-card'); mc.innerHTML = `<h4>The realm <small>your raiders in gold, foes seen in red</small></h4>`;
    const cv = h('canvas', 'rm-map'); cv.width = cv.height = 300; mc.appendChild(cv); pane.appendChild(mc);
    drawMap(cv, f, foes);
    const atk = h('div', 'rm-card');
    const can = KR.War && typeof KR.War.orderAttack === 'function';
    atk.innerHTML = `<h4>War</h4><p>${can ? `Send your raiders against ${esc(D.FACTIONS[D.FACTION_IDS.find((x) => x !== f)].city)}. They march behind the battering ram if you have one; you can ride with them or not.` : 'Raiders and the order to attack come with the Barracks.'}</p>`;
    const bt = h('button', 'btn gold', '⚔ Order the attack'); bt.disabled = !can;
    bt.onclick = () => { try { KR.War.orderAttack(f); } catch (e) { console.warn(e); } UI.refresh(); };
    atk.appendChild(bt); pane.appendChild(atk);
  }
  function drawMap(cv, f, foes) {
    const g = cv.getContext('2d'); const ef = D.FACTION_IDS.find((x) => x !== f);
    const a = D.CITY_CENTER[f], b = D.CITY_CENTER[ef];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; const span = Math.max(80, Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) + 90);
    const x0 = mx - span / 2, y0 = my - span / 2, s = cv.width / span;
    g.fillStyle = '#0a0810'; g.fillRect(0, 0, cv.width, cv.height);
    if (W.mapCanvas) { g.imageSmoothingEnabled = false; try { g.drawImage(W.mapCanvas, x0, y0, span, span, 0, 0, cv.width, cv.height); } catch (e) {} }
    const T = (px, py) => [(px / D.TS - x0) * s, (py / D.TS - y0) * s];
    for (const [ff, [cx, cy]] of [[f, a], [ef, b]]) { const [X, Y] = [(cx - x0) * s, (cy - y0) * s]; g.strokeStyle = D.FACTIONS[ff].color || '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(X, Y, 9, 0, 6.283); g.stroke(); g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText(D.FACTIONS[ff].city, X, Y - 13); }
    const dot = (e, col, r = 3) => { const [X, Y] = T(e.x, e.y); g.fillStyle = col; g.beginPath(); g.arc(X, Y, r, 0, 6.283); g.fill(); };
    for (const e of G.ents) if (!e.dead && !e.removed && e.faction === f && (e.raider || e.realmWorker)) dot(e, e.raider ? '#ffd84a' : '#9ad870', e.raider ? 3 : 2.4);
    for (const e of foes) if (e && !e.dead) dot(e, '#ff5a4a', 3);
    if (G.player) dot(G.player, '#ffffff', 3.4);
  }

  // ----- Build -----
  function buildCard(pane, f, id) {
    const st = R.state(f), d = R.DEFS[id]; const cur = st.buildings[id] || 0; const can = R.can(f, id); const cons = R.building(f, id);
    const card = h('div', 'rm-card' + (can.locked ? ' lock' : '') + (can.max ? ' done' : ''));
    const lvTxt = d.max > 1 ? `${cur}/${d.max}` : cur ? 'built' : 'not built';
    const plot = R.plotOf(f, id);
    let row = '';
    if (cons) row = `${bar(R.progress(f, id))}<span>${esc(R.levelName(id, cons.lvl))}: ${secs(cons.end - Date.now())}</span>`;
    else if (can.max) row = `<span class="dim">${esc(can.why)}</span>`;
    else row = `${costHtml(f, can.cost || R.cost(id, cur + 1))}<span class="dim">${(d.time[cur] || 60) >= 60 ? Math.round((d.time[cur] || 60) / 60) + ' min' : d.time[cur] + ' s'}</span>${can.ok ? '' : `<span class="dim">${esc(can.why)}</span>`}`;
    card.innerHTML = `<h4>${esc(d.name)} <small>${lvTxt}</small></h4><p>${esc(d.desc)}${plot && !cur && !cons ? ' It goes up on its marked plot in town.' : ''}</p><div class="rm-row">${row}</div>`;
    if (!cons && !can.max) { const bt = h('button', 'btn small' + (can.ok ? ' gold' : ''), cur ? `Upgrade to ${d.max > 1 && id !== 'towers' ? 'level ' + (cur + 1) : id === 'towers' ? 'tower ' + (cur + 1) : ''}` : 'Build'); bt.disabled = !can.ok; bt.onclick = () => { R.build(f, id); UI.refresh(); }; $('.rm-row', card).appendChild(bt); }
    pane.appendChild(card);
  }
  function paneBuild(pane, f) {
    pane.appendChild(h('p', 'hint', 'Buildings cost wood and stone. Each goes up on its own plot in town. The Sawmill and Stone Cutter come first; they open the way to the Barracks and everything after.'));
    for (const id of R.ORDER) buildCard(pane, f, id);
  }
  // ----- Workers -----
  function paneWorkers(pane, f, st) {
    pane.appendChild(h('p', 'hint', 'The Arborist and the Miner go out on their own and bring wood and stone home. Better tools mean bigger loads; gold pays for them. Only enemy raiders and heroes will harm them, and a fallen worker is replaced in a minute.'));
    for (const k of ['arborist', 'miner']) {
      const wd = st.workers[k], W2 = R.WORKER[k]; const card = h('div', 'rm-card');
      const next = wd.lvl < 3 ? R.workerCost(k, wd.lvl + 1) : null;
      card.innerHTML = `<h4>${W2.icon} ${W2.name} <small>tools ${wd.lvl}/3</small></h4><p>${esc(workerLine(f, k))} ${R.yieldOf(f, k)} ${W2.res} a load${wd.lvl ? ` (+${Math.round(R.YIELD_UP[wd.lvl] * 100)}%)` : ''}${st.buildings[W2.mill] ? `, +${st.buildings[W2.mill] * 10}% from the ${R.DEFS[W2.mill].name}` : ''}.</p><div class="rm-row"></div>`;
      const row = $('.rm-row', card);
      if (!wd.hired) { const bt = h('button', 'btn small gold', `Hire the ${W2.name} (free)`); bt.onclick = () => { R.hireWorker(f, k); UI.refresh(); }; row.appendChild(bt); }
      else if (next) { row.innerHTML = `<span>Next: +${Math.round(R.YIELD_UP[wd.lvl + 1] * 100)}% a load for <b>${G.fmtCoins(next)}</b></span>`; const bt = h('button', 'btn small' + (G.player.c.coins >= next ? ' gold' : ''), 'Upgrade tools'); bt.disabled = G.player.c.coins < next; bt.onclick = () => { R.upgradeWorker(f, k); UI.refresh(); }; row.appendChild(bt); }
      else row.innerHTML = '<span class="dim">The finest tools in the land.</span>';
      pane.appendChild(card);
    }
  }
  // ----- Army (war.js does the hiring) -----
  function paneArmy(pane, f) {
    const Wr = KR.War;
    if (!R.has(f, 'barracks')) { pane.appendChild(h('p', 'hint', 'Build the Barracks to raise an army: the Recruiter trains guards and raiders for gold.')); return; }
    if (!Wr || typeof Wr.recruitTypes !== 'function' || typeof Wr.hire !== 'function') { pane.appendChild(h('p', 'hint', 'The Recruiter is setting up in the Barracks. Coming soon.')); return; }
    let types = []; try { types = Wr.recruitTypes(f) || []; } catch (e) { console.warn(e); }
    const army = armyCounts(f);
    pane.appendChild(h('p', 'hint', 'Troops cost gold. Guards hold the town; raiders march when you order the attack.'));
    for (const t of types) {
      const id = t.id || t.type || t.name; const card = h('div', 'rm-card' + (t.locked ? ' lock' : ''));
      const have = army[id] != null ? (typeof army[id] === 'object' ? army[id].n : army[id]) : t.have;
      card.innerHTML = `<h4>${esc(t.icon || '')} ${esc(t.name || id)} <small>${have != null ? esc(String(have)) + ' in service' : ''}${t.max ? ' / ' + t.max : ''}</small></h4><p>${esc(t.desc || '')}${t.locked ? ` <span class="dim">${esc(t.why || 'Locked.')}</span>` : ''}</p><div class="rm-row">${t.cost != null ? `<span>${G.fmtCoins(t.cost)} each</span>` : ''}</div>`;
      if (!t.locked) for (const n of [1, 5]) { const bt = h('button', 'btn small', `Hire ${n}`); bt.disabled = t.cost != null && G.player.c.coins < t.cost * n; bt.onclick = () => { try { Wr.hire(f, id, n); } catch (e) { console.warn(e); } UI.refresh(); }; $('.rm-row', card).appendChild(bt); }
      pane.appendChild(card);
    }
  }
  // ----- Defenses -----
  function paneDefenses(pane, f) {
    pane.appendChild(h('p', 'hint', 'Walls and archer towers are built with wood and stone. Guards and archers to man them are hired in the Army tab.'));
    buildCard(pane, f, 'walls'); buildCard(pane, f, 'towers');
  }

  // ---------------- the HUD bar: wood and stone, always in sight ----------------
  let barEl = null, lastTxt = '';
  function makeBar() {
    if (barEl && document.body.contains(barEl)) return;
    barEl = h('div', ''); barEl.id = 'realm-bar'; barEl.hidden = true; barEl.title = 'The kingdom\'s stores (click to open the kingdom)';
    barEl.onclick = () => UI.toggle('kingdom');
    ($('#ui') || document.body).appendChild(barEl);
  }
  function tickBar() {
    if (!barEl) return;
    const f = myF(); const st = f && R.state(f);
    const show = !!(st && G.player && !document.body.classList.contains('k3-menu'));
    if (barEl.hidden === show) barEl.hidden = !show;
    if (!show) return;
    const rt = R.rates(f); const cons = st.construction.length;
    const txt = `<span class="rb-r">🪵 ${fmt(st.wood)}<small>+${rt.wood}</small></span><span class="rb-r">🪨 ${fmt(st.stone)}<small>+${rt.stone}</small></span>${cons ? `<span class="rb-c">🔨 ${cons}</span>` : ''}`;
    if (txt !== lastTxt) { lastTxt = txt; barEl.innerHTML = txt; barEl.title = `Wood ${fmt(st.wood)} (+${rt.wood}/min), stone ${fmt(st.stone)} (+${rt.stone}/min)${cons ? `, ${cons} under construction` : ''}. Click to open the kingdom.`; }
  }
  setInterval(() => { try { tickBar(); if (UI.isOpen && UI.isOpen('realm') && !document.hidden) { const w = UI.wins.realm; if (w && !w.el.matches(':hover')) renderRealm(w); } } catch (e) {} }, 1000);
  R.on('resources', () => { lastTxt = ''; tickBar(); });
  R.on('built', () => UI.refresh());
})();

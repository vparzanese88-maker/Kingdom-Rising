// Kingdom Rising — tips for new players, the healer who scrapes you off the floor, and the gold blink on new abilities
// Tips are shown once each, one at a time, never during a fight unless they are about staying alive.
// To teach players about a feature added in a later patch, add an entry to TIPS and fire it from the right place:
// heroes who have never seen that id will get it, everyone else never sees it again.
(function () {
  const KR = window.KR; const { D, G, W, U } = KR; const Sys = KR.Sys, UI = KR.UI, S = KR.S; const K = KR.Kingdom; const TS = 32; const T = KR.T;
  const Tips = (KR.Tips = {});
  const k = (s) => s.replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>');

  // ---------------------------------------------------------------- the tips
  const TIPS = {
    welcome: { icon: '👑', title: (c) => `Welcome, ${c.name}`, body: (c) => k(`${window.KR3D ? 'Move with [W] and [S], turn with [A] and [D]. Hold the right mouse button to look around. Scroll the mouse wheel to zoom.' : 'Move with [W][A][S][D], or click the ground to walk there. Scroll the mouse wheel to zoom.'}<br>${D.FACTIONS[c.faction].king} needs heroes. People with a gold <b class="g">!</b> over their heads have work for you.`) },
    quests: { icon: '❗', title: 'Someone has work for you', body: () => k(`A gold <b class="g">!</b> means a quest is waiting. Walk up and press [E] or click them to talk. A gold <b class="g">?</b> means a quest is finished: go back and collect your reward.<br>Your journal is [J]. The quest you track is marked on your map [M].`) },
    fight: { icon: '⚔', title: 'How to fight', body: (c) => D.CLASSES[c.cls].role === 'caster' ? k(`Click a monster to target it (or press [Tab] for the nearest). Cast your spells with [1]–[0].<br>Spells cost mana. Sit with [X] out of combat to get it back faster. [Q] turns your melee auto attack on and off.`) : k(`<b>Right-click a monster</b>: your hero runs to it and attacks until it dies.<br>Moving with [W][A][S][D] stops the chase but keeps you swinging. [Tab] targets the nearest enemy, [Q] turns auto attack on and off, and [1]–[0] use your abilities.`), hl: '#hotbar' },
    con: { icon: '🎯', title: 'Read the name colour', body: () => `A monster's name tells you how dangerous it is: <span style="color:#8a8a8a">gray</span> and <span style="color:#6ad86a">green</span> are easy, <span style="color:#fff">white</span> and <span style="color:#7ab8ff">blue</span> are fair fights, <span style="color:#ffd84a">yellow</span> hurts, and <span style="color:#ff5a4a">red</span> will probably kill you.` },
    loot: { icon: '💰', title: 'Loot the body', body: () => k(`Click a fallen monster or press [E] next to it to see what it dropped. You can turn on <b>auto-loot</b> in Settings ([Esc]).`) },
    levelup: { icon: '⭐', title: 'You levelled up', body: () => `New abilities go straight onto your hotbar and <b class="g">blink gold</b> so you can find them. <b>Right-click</b> an ability on the hotbar to have it used automatically in combat. See everything you can do in Abilities <kbd>K</kbd>.`, hl: '#hotbar' },
    lowhp: { icon: '❤', title: 'You are badly hurt', body: () => k(`Back away from the fight if you can. Out of combat, sit with [X] to heal much faster. Food and drink in your bags are eaten automatically and speed up healing too.`), urgent: true },
    death: { icon: '🪦', title: 'You died', body: () => `You wake beside your kingdom's healer with almost no health, mana or endurance, and <b>crippled</b> (75% slower) for 15 seconds. The healer patches you up to a quarter of your health.<br>To wake up somewhere else, talk to an innkeeper and <b>bind</b> your soul there.`, urgent: true },
    bags: { icon: '🎒', title: 'Your bags are full', body: (c) => { const b = Sys.bagInfo ? Sys.bagInfo() : null; return `Sell what you don't need: open any merchant and <b>click an item in your bag</b> to sell it. Store keepsakes in the <b>bank</b>, which is shared by all your heroes.<br>${b && b.canBuy ? `The <b>Outfitter</b> sells 8 more bag slots for ${G.fmtCoins(b.price)}.` : b && !b.full ? `When your kingdom reaches level ${b.nextLevel}, the Outfitter will sell you 8 more bag slots.` : 'Your bags are as big as they get.'}`; }, urgent: true },
    vendor: { icon: '🛒', title: 'Buying and selling', body: () => `Click an item on the left to <b>buy</b> it. Click an item in your bag on the right to <b>sell</b> it. Sold something by mistake? It waits in the buy-back list for a while.<br>As your kingdom grows, merchants stock better gear.` },
    craft: { icon: '⚒', title: 'Crafting', body: (c) => `Crafters turn materials into gear. Metal, hide, cloth and arcane materials drop from monsters and are sold in the crafter's <b>Shop</b> tab. Every craft raises your skill and unlocks the next tier.<br><b>${D.FACTIONS[c.faction].craftPrefix}</b> gear is made only in your kingdom and beats shop gear. <b>Signature pieces</b> are rare and much stronger.` },
    trainer: { icon: '📖', title: 'Learning spells', body: () => `Your guildmaster teaches new spells and songs for coin as you level up. Learned spells go on your hotbar automatically. Higher ranks cost more, so save some coin.` },
    bank: { icon: '🏦', title: 'The bank', body: () => `The bank is shared by every hero on your account. Click an item to move it in or out. Coins left here are safe from everything.` },
    mercs: { icon: '🗡', title: 'Mercenaries', body: () => k(`Hire mercenaries to fight beside you: one for each kingdom level. They level with you and use their class abilities. Manage them with [Y].`) },
    innkeeper: { icon: '🛏', title: 'Binding your soul', body: () => `Ask an innkeeper to <b>bind</b> you. When you die you will wake there instead of beside your kingdom's healer. You can't bind in dungeons or in the other brother's kingdom.` },
    harvest: { icon: '🪓', title: 'Timber and stone', body: () => k(`Your king needs wood and stone to build. Walk up to a <b>tree</b> or a <b>boulder</b> and press [E], or click it. You chop with your axe and break rock with your pick.<br>Harder lands have better wood and stone, and better tools from the <b>Outfitter</b> can cut them. Fallen trees grow back.`) },
    tooltier: { icon: '🛠', title: 'You need a better tool', body: () => `This wood or stone is too hard for your tools. The <b>Outfitter</b> in your kingdom sells Iron, Steel and Mithril axes and picks as you level up. Better tools also gather faster and give more.` },
    king: { icon: '🏰', title: 'How your kingdom grows', body: (c) => `${D.FACTIONS[c.faction].city} rises a level when it has <b>both</b>:<br>• enough <b>status</b>, earned from bosses, named monsters and quests, and<br>• the <b>timber and stone</b> your king asked for in his building quest.<br>Each level brings new merchants, more guards and stronger defenses. Check progress any time in Kingdoms <kbd>N</kbd>.` },
    status: { icon: '✨', title: 'Status', body: (c) => `You just earned status for ${D.FACTIONS[c.faction].city}. Bosses give the most, then named monsters (the ones with proper names) and quests. Status, together with your king's timber and stone, raises your kingdom.` },
    barracks: { icon: '🛡', title: 'The barracks and war parties', body: () => `This is where your kingdom's army lives.<br>• Hire soldiers from the <b>recruiter</b>: 6 places for each kingdom level. Each class does something different: priests heal, pikemen wreck siege engines, knights and cavalry hit hard.<br>• When you are ready, <b>send the war party</b>. They march to the other kingdom, spread out, tear down towers and go for the <b>king</b>.<br>• Survivors come home. The fallen must be replaced.` },
    alarm: { icon: '🔔', title: 'Your kingdom is under attack', body: () => `The enemy's war party has reached your walls. Townsfolk run indoors while your guards fight. Help defend the <b>towers</b> at the gates: every engine lost makes the next attack easier. Wiping out the whole party earns status.`, urgent: true },
    enemyland: { icon: '⚠', title: 'Enemy territory', body: (c) => `This is the other brother's kingdom. Its guards attack you on sight and its merchants won't trade with you. Slaying its king wins the war, but he is far stronger than his guards. Bring an army.`, urgent: true },
    dungeon: { icon: '🕯', title: 'Dungeons', body: () => `Dungeons get harder the deeper you go, and their bosses wait in the last rooms. You can't bind your soul down here. The glowing doorway by the entrance takes you back out.` },
    map: { icon: '🗺', title: 'Maps and windows', body: () => k(`[M] opens the world map, [N] your kingdom, [I] your bags, [C] your character, [J] your journal. Press [Esc] for settings, where you can also turn these tips off.`) },
    stances: { icon: '🌙', title: 'Stances', body: () => `The stance buttons beside your hotbar change how you fight. The last three are calm stances with no combat bonuses or penalties:<br>🌳 <b>Heartwood Vigil</b>: health returns much faster<br>🌙 <b>Moonwell Serenity</b>: mana returns much faster<br>🌬 <b>Galeborn Stride</b>: endurance returns much faster<br>Switch to one while you rest between fights.`, hl: '.hb-stances' },
    weak: { icon: '🗡', title: 'Weaknesses and resistances', body: () => `Under your target's name you'll see what it is <b class="g">weak</b> to and what it <b>resists</b>. Hover an icon to read more. Hit a monster with what it's weak to for extra damage, and avoid what it shrugs off.`, hl: '.hud-target' },
    pet: { icon: '🐾', title: 'Your pet', body: () => `Your pet fights for you and pulls monsters off you. Its window lets you send it to attack, call it back and switch its taunt on or off.` },
    group: { icon: '🤝', title: 'Playing together', body: () => k(`Other players may be online. Open Group with [G] to see who is around and invite them. Groups share experience and quest kills.`) },
  };
  const open = (id) => UI.isOpen && UI.isOpen(id);
  const inBarracks = () => { const p = G.player; const b = p && W.buildingAt(p.x, p.y); return (b && b.type === 'barracks') || open('barracks'); };
  // tips about the thing in front of you jump the queue, and are dropped (to come back later) if you walk away first
  const CTX = { vendor: () => open('vendor') || (UI.craftShopOpen && UI.craftShopOpen()), craft: () => open('craft'), trainer: () => open('trainer'), bank: () => open('bank'), mercs: () => open('mtrader') || open('mercs'), barracks: inBarracks, king: () => true, innkeeper: () => true, tooltier: () => true, harvest: () => G.player && K && !!K.nearestHarvest(G.player.x, G.player.y, 140) };
  const BEGINNER = ['welcome', 'quests', 'fight', 'con', 'loot', 'levelup', 'lowhp', 'vendor', 'trainer', 'bank', 'map', 'innkeeper', 'mercs', 'pet', 'group'];

  // ---------------------------------------------------------------- settings
  Tips.newCharsOn = () => !(G.account && G.account.settings && G.account.settings.tipsNew === false);
  Tips.prep = function (c) {
    if (c.tipsOn == null) { c.tipsOn = true; c.tipsSeen = c.tipsSeen || {}; if (c.level > 5) BEGINNER.forEach((id) => (c.tipsSeen[id] = 1)); }
    c.tipsSeen = c.tipsSeen || {};
  };
  const nc0 = Sys.newChar;
  Sys.newChar = function (o) { const c = nc0.apply(this, arguments); c.tipsOn = Tips.newCharsOn(); c.tipsSeen = {}; return c; };
  Tips.setOn = function (on) { const c = G.player && G.player.c; if (!c) return; c.tipsOn = on; if (!on) Tips.hide(true); Sys.save && Sys.save(); };
  Tips.resetSeen = function () { const c = G.player && G.player.c; if (!c) return; c.tipsSeen = {}; c.tipsOn = true; Tips.lastShown = 0; Sys.save && Sys.save(); };

  // ---------------------------------------------------------------- the card
  let card = null, cur = null, hideT = null; const queue = [];
  Tips.lastShown = 0;
  function build() {
    card = document.createElement('div'); card.className = 'tip-card'; card.hidden = true;
    card.innerHTML = `<div class="tc-ic"></div><div class="tc-m"><div class="tc-k">Tip</div><div class="tc-t"></div><div class="tc-b"></div><div class="tc-f"><button class="btn small gold tc-ok">Got it</button><button class="tc-off">Turn off tips</button></div></div><button class="tc-x" aria-label="Close">✕</button>`;
    document.body.appendChild(card);
    card.querySelector('.tc-ok').onclick = () => Tips.hide();
    card.querySelector('.tc-x').onclick = () => Tips.hide();
    card.querySelector('.tc-off').onclick = () => { Tips.setOn(false); G.log('Tips are off. You can turn them back on in Settings (Esc).', 'sys', '#e8d48a'); };
    card.addEventListener('mouseenter', () => { clearTimeout(hideT); }); card.addEventListener('mouseleave', () => { clearTimeout(hideT); hideT = setTimeout(() => Tips.hide(), 9000); });
  }
  Tips.hide = function (silent) {
    if (!card || card.hidden) return; card.classList.remove('in'); clearTimeout(hideT); const old = cur; cur = null;
    setTimeout(() => { if (!cur) card.hidden = true; }, 260); document.querySelectorAll('.tip-hl').forEach((e) => e.classList.remove('tip-hl'));
    Tips.lastShown = G.now;
  };
  function show(id) {
    const c = G.player.c; const tip = TIPS[id]; if (!tip) return;
    if (!card) build();
    c.tipsSeen[id] = 1; cur = id; Sys.save && Sys.save();
    card.querySelector('.tc-ic').textContent = tip.icon;
    card.querySelector('.tc-t').textContent = typeof tip.title === 'function' ? tip.title(c) : tip.title;
    card.querySelector('.tc-b').innerHTML = tip.body(c);
    card.classList.toggle('urgent', !!tip.urgent);
    card.hidden = false; placeCard(); requestAnimationFrame(() => card.classList.add('in'));
    try { KR.A.sfx('chime', 0.25); } catch (e) {}
    document.querySelectorAll('.tip-hl').forEach((e) => e.classList.remove('tip-hl'));
    if (tip.hl) { const el = document.querySelector(tip.hl); if (el) { el.classList.add('tip-hl'); setTimeout(() => el.classList.remove('tip-hl'), 7000); } }
    clearTimeout(hideT); hideT = setTimeout(() => Tips.hide(), 26000 + tip.body(c).length * 25);
  }
  // keep the card clear of any open window: left side by default, right side if a window is in the way
  function placeCard() {
    if (!card || card.hidden) return;
    const wins = Object.values(UI.wins || {}).filter((w) => w.el && !w.el.hidden).map((w) => w.el.getBoundingClientRect());
    const hits = (r) => wins.some((q) => r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top);
    let pick = null;
    for (const narrow of [false, true]) {
      card.classList.toggle('narrow', narrow); const w = card.offsetWidth, h = card.offsetHeight;
      const spots = [[14, 152], [innerWidth - w - 64, 280], [innerWidth - w - 64, innerHeight - h - 150], [14, Math.max(152, innerHeight - h - 250)]];
      for (const [x, y] of spots) { if (!hits({ left: x, top: y, right: x + w, bottom: y + h })) { pick = [x, y]; break; } }
      if (pick) break;
    }
    if (!pick) { card.classList.remove('narrow'); pick = [14, 152]; }
    card.style.left = Math.max(8, pick[0]) + 'px'; card.style.top = Math.max(8, pick[1]) + 'px';
  }
  setInterval(placeCard, 700);
  // ask for a tip: it waits its turn and only ever appears once
  Tips.fire = function (id) {
    const p = G.player; if (!p || !p.c) return; const c = p.c; Tips.prep(c);
    if (!c.tipsOn || c.tipsSeen[id] || cur === id || queue.includes(id) || !TIPS[id]) return;
    if (TIPS[id].urgent || CTX[id]) queue.unshift(id); else queue.push(id);
  };
  // pacing: one at a time, a breather between them, nothing mid-fight unless it is about staying alive
  function pump() {
    const p = G.player; if (!p || !queue.length || cur) return; const c = p.c; if (!c.tipsOn) { queue.length = 0; return; }
    const next = queue[0]; const tip = TIPS[next];
    if (c.tipsSeen[next]) { queue.shift(); return; }
    if (CTX[next] && !CTX[next]()) { queue.shift(); return; }
    const gap = CTX[next] ? 5000 : 22000;
    if (!tip.urgent && (p.inCombat || p.dead || G.now - Tips.lastShown < gap)) return;
    if (tip.urgent && G.now - Tips.lastShown < 3000) return;
    if (document.querySelector('.realm-load.in, .exec-scene, .vic-scene')) return;
    queue.shift(); show(next);
  }

  // ---------------------------------------------------------------- what triggers each tip
  let enteredAt = 0, slow = 0, lastPlayer = null;
  function watch(dt) {
    const p = G.player; if (!p || !p.c) return; const c = p.c; Tips.prep(c);
    if (p !== lastPlayer) { lastPlayer = p; enteredAt = G.now; queue.length = 0; Tips.hide(true); Tips.lastShown = G.now - 18000; }
    pump(); if (!c.tipsOn) return;
    slow += dt; if (slow < 0.8) return; slow = 0;
    const since = (G.now - enteredAt) / 1000; const realm = W.realm || 'main';
    if (since > 3) Tips.fire('welcome');
    if (p.hp < p.hpMax * 0.35 && !p.dead && p.inCombat && c.level <= 15 && !p.buffs.some((b) => b.name === 'Crippled')) Tips.fire('lowhp');
    if (p.target && p.target.type === 'mob' && !p.target.dead) Tips.fire('con');
    if (since > 200) Tips.fire('map');
    if (since > 900 && c.level >= 4) Tips.fire('group');
    if (p.pet) Tips.fire('pet');
    if (since > 60 && !p.inCombat && (p.hp < p.hpMax * 0.6 || (p.manaMax && p.mana < p.manaMax * 0.5) || (p.endurMax && p.endur < p.endurMax * 0.5))) Tips.fire('stances');
    if (p.target && p.target.type === 'mob' && p.target.aff && (p.target.aff.weak.length || Object.keys(p.target.aff.res).length) && c.tipsSeen.con) Tips.fire('weak');
    if (realm !== 'main' && realm !== 'tidesong' && realm !== 'summit') Tips.fire('dungeon');
    if (KR.War && KR.War.alarm && KR.War.alarm[c.faction] && KR.War.alarm[c.faction].state) Tips.fire('alarm');
    if (realm === 'main') {
      for (const f of D.FACTION_IDS) { if (f === c.faction) continue; const cd = W.cityData[f]; if (cd && Math.max(Math.abs(p.x / TS - cd.cx), Math.abs(p.y / TS - cd.cy)) < cd.R + 10) Tips.fire('enemyland'); }
      const b = W.buildingAt(p.x, p.y); if (b && b.type === 'barracks' && b.city === c.faction) Tips.fire('barracks');
      if (since > 25 && !p.inCombat && K && K.nearestHarvest(p.x, p.y, 110)) Tips.fire('harvest');
    }
    // people with work for you, monsters nearby
    if (since > 8 && !c.tipsSeen.quests) { for (const e of G.ents) if ((e.type === 'npc' || e.type === 'king') && e.city === c.faction && Math.hypot(e.x - p.x, e.y - p.y) < 330 && Sys.npcMarker(e) === '!') { Tips.fire('quests'); break; } }
    if (since > 12 && !c.tipsSeen.fight) { for (const e of G.ents) if (e.type === 'mob' && !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 340) { Tips.fire('fight'); break; } }
  }
  // event hooks
  const kill0 = G.kill; G.kill = function (e, src) { const r = kill0.apply(this, arguments); try { if (e && e.type === 'mob' && (src === G.player || (src && src.owner === G.player))) setTimeout(() => Tips.fire('loot'), 700); } catch (er) {} return r; };
  const lv0 = Sys.levelUp; Sys.levelUp = function () { const r = lv0.apply(this, arguments); Tips.fire('levelup'); return r; };
  const bf0 = Sys.bagsFull; Sys.bagsFull = function () { const r = bf0.apply(this, arguments); Tips.fire('bags'); return r; };
  const st0 = Sys.addStatus; Sys.addStatus = function (f, n) { const r = st0.apply(this, arguments); if (n > 0 && G.player && G.player.c.faction === f && G.player.c.tipsSeen && G.player.c.tipsSeen.welcome) Tips.fire('status'); return r; };
  const open0 = UI.open; UI.open = function (id) { const r = open0.apply(this, arguments); try { const map = { vendor: 'vendor', craft: 'craft', trainer: 'trainer', bank: 'bank', mtrader: 'mercs', mercs: 'mercs', barracks: 'barracks', kingdom: 'king' }; if (map[id]) Tips.fire(map[id]); } catch (e) {} return r; };
  const hail0 = Sys.hail; Sys.hail = function (e) { const r = hail0.apply(this, arguments); try { const c = G.player.c; if (e.type === 'king' && e.faction === c.faction) Tips.fire('king'); if (e.role === 'innkeeper' && e.city === c.faction) Tips.fire('innkeeper'); } catch (er) {} return r; };
  if (K) { const sh0 = K.startHarvest; K.startHarvest = function (d) { const r = sh0.apply(this, arguments); try { const h = K.harvestOf(d); if (h && K.tools(G.player.c)[h.tool] < K.MATS[h.mat].tier) Tips.fire('tooltier'); } catch (e) {} return r; }; }

  // ---------------------------------------------------------------- the healer, the well, and dying
  // each kingdom's healer gets a well beside them; heroes bound at home wake up next to it
  K.respawnSpot = {}; K.wellAt = {};
  const okTile = (x, y) => W.inb(x, y) && !W.isBlockedTile(x, y) && ![T.WATER, T.DEEP].includes(W.tile(x, y)) && !W.buildingAt(x * TS + 16, y * TS + 16);
  const sc0 = Sys.spawnCity;
  Sys.spawnCity = function (f) {
    const r = sc0.apply(this, arguments);
    try {
      const hl = G.ents.find((e) => e.city === f && e.role === 'healer' && !e.kpriest && !e.removed); if (!hl) return r;
      W.decor = W.decor.filter((d) => !(d.kind === 'well' && d.city === f));
      const hx = Math.floor(hl.x / TS), hy = Math.floor(hl.y / TS);
      const wo = [[2, 0], [-2, 0], [2, -1], [-2, -1], [0, -2], [2, 1], [-2, 1]].find(([dx, dy]) => okTile(hx + dx, hy + dy) && okTile(hx + dx, hy + dy + 1));
      if (wo) { const tx = hx + wo[0], ty = hy + wo[1]; W.decor.push({ kind: 'well', city: f, tx, ty, x: tx * TS + 16, y: ty * TS + 24, v: 0.5 }); W.block[ty * W.W + tx] = 1; K.wellAt[f] = [tx, ty]; KR.R.reindex(); }
      const so = [[0, 2], [1, 2], [-1, 2], [0, -2], [1, 1], [-1, 1]].find(([dx, dy]) => okTile(hx + dx, hy + dy));
      K.respawnSpot[f] = so ? [(hx + so[0]) * TS + 16, (hy + so[1]) * TS + 16] : [hl.x, hl.y + 50];
    } catch (e) { console.warn(e); }
    return r;
  };
  const drawDecor0 = S.drawDecor;
  S.drawDecor = function (g, d, t, wind) {
    if (d.kind !== 'well') return drawDecor0.apply(this, arguments);
    const x = d.x, y = d.y;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + 2, y + 2, 17, 6, 0, 0, 6.28); g.fill();
    g.fillStyle = '#8a8478'; g.beginPath(); g.ellipse(x, y - 4, 15, 7, 0, 0, 6.28); g.fill(); g.fillRect(x - 15, y - 14, 30, 10); g.beginPath(); g.ellipse(x, y - 14, 15, 7, 0, 0, 6.28); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (let k2 = -12; k2 <= 12; k2 += 6) { g.beginPath(); g.moveTo(x + k2, y - 13); g.lineTo(x + k2, y - 4); g.stroke(); }
    g.fillStyle = '#1c2e3a'; g.beginPath(); g.ellipse(x, y - 14, 11, 4.6, 0, 0, 6.28); g.fill(); g.fillStyle = `rgba(140,190,230,${0.25 + Math.sin(t * 2) * 0.08})`; g.beginPath(); g.ellipse(x - 2, y - 15, 5, 1.6, 0, 0, 6.28); g.fill();
    g.fillStyle = '#6a4a2a'; g.fillRect(x - 15, y - 42, 3, 30); g.fillRect(x + 12, y - 42, 3, 30); g.fillRect(x - 13, y - 34, 26, 2.5);
    g.fillStyle = '#8a3a2a'; g.beginPath(); g.moveTo(x - 20, y - 40); g.lineTo(x, y - 52); g.lineTo(x + 20, y - 40); g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x - 20, y - 41, 40, 2);
    g.strokeStyle = '#c8b48a'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 3, y - 33); g.lineTo(x + 3, y - 22); g.stroke(); g.fillStyle = '#7a5a3a'; g.fillRect(x, y - 23, 7, 6);
  };
  const isHomeBind = (c) => { const b = c.bind; if (!b || b.home) return true; if (b.realm && b.realm !== 'main') return false; const [cx, cy] = D.CITY_CENTER[c.faction]; return Math.hypot(b.x / TS - cx, b.y / TS - (cy + 3)) < 4; };
  let rez = null;
  const resp0 = Sys.respawn;
  Sys.respawn = function () {
    const p = G.player, c = p.c; const home = isHomeBind(c); const spot = home && K.respawnSpot[c.faction];
    if (spot) c.bind = { x: spot[0], y: spot[1], realm: 'main', home: true };
    const r = resp0.apply(this, arguments);
    p.hp = 1; p.mana = Math.min(p.manaMax || 0, 1); p.endur = Math.min(p.endurMax || 0, 1);
    G.addBuff(p, { name: 'Crippled', icon: '🦴', dur: 15, snare: 0.75, debuff: true, desc: 'Weak from death: movement speed reduced by 75%.' });
    G.recalc && G.recalc(p);
    if (spot) rez = { t: 0, phase: 0, f: c.faction };
    else { p.hp = Math.max(1, Math.round(p.hpMax * 0.1)); rez = null; setTimeout(() => Tips.fire('death'), 1500); }
    return r;
  };
  const LAUGH = ['Ha! Ha ha ha! Look what the crows dragged in.', 'Hah! Back again? You really are making a habit of this.', '*laughs* Oh, that one looked like it hurt.', 'Ha ha! Did you trip over a rat again?', 'Ah ha ha! You should see your face. Well, what is left of it.'];
  function rezTick(dt) {
    const R = rez; if (!R) return; const p = G.player; if (!p || p.dead) { rez = null; return; }
    if ((W.realm || 'main') !== 'main' || document.querySelector('.realm-load.in')) return;
    const hl = G.ents.find((e) => e.city === R.f && e.role === 'healer' && !e.kpriest && !e.removed && !e.dead);
    R.t += dt;
    if (!hl) { p.hp = Math.max(p.hp, Math.round(p.hpMax * 0.25)); rez = null; Tips.fire('death'); return; }
    if (R.phase === 0 && R.t > 0.7) { R.phase = 1; R.t = 0; G.faceTo(hl, p); G.say(hl, U.pick(LAUGH), 3.2); try { KR.A.sfx('cackle', 0.25); } catch (e) {} R.scold = Math.random() < 0.5; }
    else if (R.phase === 1 && R.t > 3.2) { R.phase = R.scold ? 2 : 3; R.t = 0; if (R.scold) G.say(hl, 'You can\'t help the king rule this kingdom if you keep dying!', 3.4); }
    else if (R.phase === 2 && R.t > 3.4) { R.phase = 3; R.t = 0; }
    else if (R.phase === 3) { R.phase = 4; R.t = 0; hl.casting = true; R.from = p.hp; R.to = Math.max(p.hp, Math.round(p.hpMax * 0.25)); KR.A.sfx('heal', 0.6); G.fxAdd({ k: 'ring', x: p.x, y: p.y, r: 46, col: '#9affb8', life: 1.2 }); G.addBuff(p, { name: "Healer's Mending", icon: '💚', dur: 3, desc: 'Your kingdom\'s healer is knitting you back together.' }); G.say(hl, 'Here, that ought to keep you alive for now.', 4); }
    else if (R.phase === 4) {
      const k2 = Math.min(1, R.t / 2.5); const want = Math.round(R.from + (R.to - R.from) * k2); if (want > p.hp) p.hp = want;
      if (Math.random() < dt * 4) G.fxAdd({ k: 'ring', x: p.x + (Math.random() - 0.5) * 20, y: p.y - 10, r: 10, col: '#c8ffd8', life: 0.6 });
      if (k2 >= 1) { hl.casting = false; G.float(p, `+${Math.max(0, R.to - R.from)}`, '#7fe08a'); rez = null; setTimeout(() => Tips.fire('death'), 1200); }
    }
  }

  // ---------------------------------------------------------------- new abilities blink gold on the hotbar
  const sync0 = Sys.autoBarSync;
  Sys.autoBarSync = function () {
    const p = G.player; if (!p || !p.c) return sync0.apply(this, arguments); const c = p.c; const before = Sys.bar().map((a) => (a ? a.k + ':' + a.id : null));
    const r = sync0.apply(this, arguments);
    Sys.bar().forEach((a, i) => { if (a && before[i] !== a.k + ':' + a.id && c.barSeen && Object.keys(c.barSeen).length) { c.newAb = c.newAb || {}; c.newAb[a.k + ':' + a.id] = Date.now() + 25000; UI.renderBar && UI.renderBar(); } });
    return r;
  };
  const rb0 = UI.renderBar;
  UI.renderBar = function () {
    const r = rb0.apply(this, arguments); const p = G.player; if (!p || !p.c || !p.c.newAb) return r; const c = p.c; const bar = Sys.bar(); const now = Date.now();
    document.querySelectorAll('#hotbar .hb-slot').forEach((el, i) => { const a = bar[i]; const key = a && a.k + ':' + a.id; if (key && c.newAb[key] > now) { el.classList.add('hb-new'); const clear = () => { delete c.newAb[key]; el.classList.remove('hb-new'); }; el.addEventListener('mouseenter', clear, { once: true }); el.addEventListener('click', clear, { once: true }); setTimeout(() => el.classList.remove('hb-new'), c.newAb[key] - now); } });
    for (const key in c.newAb) if (c.newAb[key] < now) delete c.newAb[key];
    return r;
  };

  // ---------------------------------------------------------------- ticking
  if (KR.War) { const tick0 = KR.War.tick; KR.War.tick = function (dt) { tick0.apply(this, arguments); try { watch(dt); } catch (e) { console.warn(e); } try { rezTick(dt); } catch (e) { console.warn(e); } }; }
  Tips.TIPS = TIPS;
})();

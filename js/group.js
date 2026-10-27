// Kingdom Rising — grouping: invites, group window, group frames, shared XP, group buffs, group chat
(function () {
  const KR = window.KR;
  const D = KR.D, U = KR.U, G = KR.G, W = KR.W, Sys = KR.Sys, UI = KR.UI;
  const Net = Sys.Net;
  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = UI.esc;
  const MAX = 6, BUFF_RANGE = 450, XP_RANGE = 1500, GCOL = '#9affb8';

  const Grp = (Sys.Grp = { gid: null, leader: null, members: [], names: {}, invites: [], lfg: false, seen: {} });
  let filter = 'all', search = '';

  const me = () => Net.me;
  const myName = () => (G.player ? G.player.c.name : '');
  const inGroup = () => !!Grp.gid && Grp.members.length > 1;
  const isLeader = () => inGroup() && Grp.leader === me();
  const peerOf = (id) => Net.peers.find((p) => p.peer === id);
  const nameOf = (id) => (id === me() ? myName() : (peerOf(id) || {}).n || Grp.names[id] || 'Someone');
  Sys.inGroup = inGroup;
  // group mates are drawn in their own colour everywhere (world, minimap, map, edge arrows)
  Sys.GROUP_COL = '#3cf0ff';
  Sys.isMate = (pp) => { const id = pp && (pp.peer || pp); return inGroup() && id !== me() && Grp.members.includes(id); };
  Sys.mates = () => (inGroup() ? Net.peers.filter((pp) => Grp.members.includes(pp.peer) && (pp.rm || 'main') === (W.realm || 'main')) : []);

  function send(op, data = {}) { if (!Net.room) return; Net.room.emit('grp', Object.assign({ op, fn: myName() }, data)).catch(() => {}); }
  function zoneName() { const p = G.player; if (!p) return ''; const reg = D.REGIONS[W.regionAtPx(p.x, p.y)]; const R = W.REALMS && W.REALMS[W.realm || 'main']; return W.realm && W.realm !== 'main' && R ? R.name : reg ? reg.name : ''; }

  Sys.presenceExtra = function () {
    const p = G.player; if (!p) return {};
    return { hp: Math.round((p.hp / p.hpMax) * 100), mp: p.manaMax ? Math.round((p.mana / p.manaMax) * 100) : -1, ep: Math.round((p.endur / (p.endurMax || 1)) * 100), lfg: Grp.lfg ? 1 : 0, gid: inGroup() ? Grp.gid : null, z: zoneName() };
  };

  function setState(st) {
    Grp.gid = st.gid; Grp.leader = st.leader; Grp.members = st.members.slice(0, MAX); Object.assign(Grp.names, st.names || {});
    if (Grp.lfg && inGroup() && Grp.members.length >= MAX) Grp.lfg = false;
    refresh();
  }
  function clearGroup(msg) { if (msg) G.log(msg, 'sys', GCOL); Grp.gid = null; Grp.leader = null; Grp.members = []; refresh(); }
  function broadcastState() { const names = {}; for (const id of Grp.members) names[id] = nameOf(id); send('st', { gid: Grp.gid, leader: Grp.leader, members: Grp.members, names }); }
  function refresh() { if (UI.isOpen('group')) renderGroup(UI.wins.group); tickFrames(true); }

  // ---------- actions ----------
  Sys.groupInvite = function (target) {
    if (!Net.ok || !me()) { G.log('Grouping needs other players: host or join a multiplayer game from the main menu.', 'sys', '#ffb24a'); return; }
    const pp = typeof target === 'string' ? Net.peers.find((x) => x.peer === target || (x.n || '').toLowerCase() === target.toLowerCase()) : target;
    if (!pp) { G.log(`No player named "${target}" is online.`, 'sys', '#ffb24a'); return; }
    if (inGroup() && !isLeader()) { G.log('Only the group leader can invite.', 'sys', '#ffb24a'); return; }
    if (inGroup() && Grp.members.length >= MAX) { G.log('Your group is full (6 players).', 'sys', '#ffb24a'); return; }
    if (Grp.members.includes(pp.peer)) { G.log(`${pp.n} is already in your group.`, 'sys', '#ffb24a'); return; }
    if (pp.gid) { G.log(`${pp.n} is already in a group.`, 'sys', '#ffb24a'); return; }
    if (!Grp.gid) { Grp.gid = me() + '-' + Date.now().toString(36); Grp.leader = me(); Grp.members = [me()]; }
    send('inv', { to: pp.peer, gid: Grp.gid });
    G.log(`You invite ${pp.n} to join your group.`, 'sys', GCOL); KR.A.sfx('click');
  };
  Sys.groupAccept = function (inv) {
    Grp.invites = Grp.invites.filter((x) => x !== inv); renderInvites();
    if (inGroup()) { G.log('Leave your current group first.', 'sys', '#ffb24a'); return; }
    send('acc', { to: inv.from, gid: inv.gid }); G.log(`You accept ${inv.name}'s invitation.`, 'sys', GCOL);
  };
  Sys.groupDecline = function (inv) { Grp.invites = Grp.invites.filter((x) => x !== inv); renderInvites(); send('dec', { to: inv.from }); };
  Sys.groupLeave = function () {
    if (!Grp.gid) return; const was = Grp.gid;
    send('lv', { gid: was, leaver: me() }); clearGroup('You leave the group.');
  };
  Sys.groupKick = function (id) {
    if (!isLeader() || id === me()) return; const n = nameOf(id);
    Grp.members = Grp.members.filter((x) => x !== id); G.log(`You remove ${n} from the group.`, 'sys', GCOL);
    if (Grp.members.length <= 1) { broadcastState(); clearGroup('Your group has disbanded.'); return; }
    broadcastState(); refresh();
  };
  Sys.groupPromote = function (id) { if (!isLeader() || id === me()) return; Grp.leader = id; broadcastState(); G.log(`${nameOf(id)} is now the group leader.`, 'sys', GCOL); refresh(); };
  Sys.groupDisband = function () { if (!isLeader()) { Sys.groupLeave(); return; } Grp.members = [me()]; broadcastState(); clearGroup('You disband the group.'); };
  Sys.groupChat = function (t) {
    t = String(t || '').trim().slice(0, 200); if (!t) return;
    if (!inGroup()) { G.log('You are not in a group.', 'sys', '#ffb24a'); return; }
    send('chat', { gid: Grp.gid, t }); G.log(`[Group] ${myName()}: ${t}`, 'group', GCOL);
  };
  Sys.setLFG = function (on) { Grp.lfg = !!on; G.log(on ? 'You are now flagged as Looking for Group.' : 'You are no longer Looking for Group.', 'sys', GCOL); refresh(); };

  // members in range, same realm, alive
  function nearMembers(range) {
    const p = G.player; if (!inGroup() || !p) return [];
    return Grp.members.filter((id) => id !== me()).map(peerOf).filter((pp) => pp && !pp.dead && (pp.rm || 'main') === (W.realm || 'main') && Math.hypot(pp.x - p.x, pp.y - p.y) < range);
  }
  // shared experience: split between nearby members, with a bonus for grouping
  Sys.groupXp = function (xp, e) {
    const near = nearMembers(XP_RANGE); const n = 1 + near.length;
    if (n === 1) { G.giveXp(xp); return; }
    const share = Math.max(1, Math.round((xp * (1 + 0.2 * (n - 1))) / n));
    G.giveXp(share, `(group of ${n})`);
    const p = G.player; send('xp', { gid: Grp.gid, amt: share, rm: W.realm || 'main', x: Math.round(p.x), y: Math.round(p.y), mob: e ? e.name : '' });
  };
  // group buffs reach real players in your group
  Sys.groupBuff = function (def, src) {
    if (!inGroup() || !def || def.kind !== 'spell' || !nearMembers(BUFF_RANGE).length) return;
    send('buff', { gid: Grp.gid, sp: def.id, lvl: src.level, song: def.school === 'Song' ? 1 : 0, rm: W.realm || 'main', x: Math.round(src.x), y: Math.round(src.y) });
  };

  // ---------- group loot ----------
  // In a group, kills are looted automatically. Coins are split evenly between the members nearby and
  // ordinary drops are handed out in turn; weapons, ingredients and anything rare are rolled for:
  // everyone nearby gets a dice window (Need, Greed or Pass) and the highest Need roll wins, then Greed.
  const ROLL_TIME = 25000;
  const FINE = /^(Gleaming|Ancient|Runed|Blessed|Shadowed|Fabled) /;
  const rollable = (it) => it.kind === 'weapon' || it.kind === 'mat' || it.unique || it.proc || it.sig || it.fx || it.kind === 'jewel' || FINE.test(it.name || '') || (it.value || 0) >= 2000;
  const rolls = new Map(); // id -> { item, owner, eligible, picks, until, mine, done }
  const fresh = (it) => Object.assign(JSON.parse(JSON.stringify(it)), { uid: U.uid() });
  const giveMe = (it, how) => { const c = fresh(it); if (Sys.addItem(c, true)) { G.log(`You receive ${c.qty > 1 ? c.qty + ' x ' : ''}${c.name}${how ? ' ' + how : ''}.`, 'loot', '#f0d070'); KR.A.sfx('coin', 0.5); KR.UI && KR.UI.refresh(); return true; } G.log(`Your bags are full, so ${c.name} was left behind.`, 'loot', '#ffb24a'); return false; };
  Sys.groupCoins = function (amt, e) {
    const near = nearMembers(XP_RANGE); if (!near.length || amt <= 0) return false;
    const n = 1 + near.length, share = Math.floor(amt / n), mine = amt - share * (n - 1);
    const c = G.player.c; c.coins += mine;
    G.log(`You loot ${G.fmtCoins(amt)} from ${e.name} and split it ${n} ways (${G.fmtCoins(mine)} for you).`, 'loot', '#f0d070'); KR.A.sfx('coin', 0.8);
    if (share > 0) for (const pp of near) send('coin', { gid: Grp.gid, to: pp.peer, amt: share, mob: e.name });
    return true;
  };
  Sys.groupLoot = function (e) {
    const near = nearMembers(XP_RANGE); if (!near.length || !e.loot) return false;
    const order = [me()].concat(near.map((pp) => pp.peer));
    for (const it of e.loot.items.splice(0)) {
      if (rollable(it)) { startRoll(it, order); continue; }
      const to = order[(Grp.rr = ((Grp.rr || 0) + 1) % order.length)];
      if (to === me()) { if (!giveMe(it, 'as your share')) e.loot.items.push(it); }
      else { send('give', { gid: Grp.gid, to, item: it, mob: e.name }); G.log(`${nameOf(to)} receives ${it.name}.`, 'loot', GCOL); }
    }
    return true;
  };
  function startRoll(it, order) {
    const id = me() + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const r = { id, item: it, owner: me(), eligible: order, picks: {}, until: Date.now() + ROLL_TIME, mine: null };
    rolls.set(id, r); send('roll', { gid: Grp.gid, id, item: it, eligible: order, ms: ROLL_TIME });
    G.log(`Rolling for ${it.name}...`, 'loot', GCOL); renderRolls();
    r.timer = setTimeout(() => resolveRoll(id), ROLL_TIME + 500);
  }
  Sys.groupPick = function (id, choice) {
    const r = rolls.get(id); if (!r || r.mine) return; r.mine = choice;
    if (r.owner === me()) gotPick(r, me(), choice); else send('pick', { gid: Grp.gid, id, to: r.owner, choice });
    if (choice === 'pass') G.log(`You pass on ${r.item.name}.`, 'loot', '#bba');
    renderRolls();
  };
  function gotPick(r, who, choice) {
    if (r.done || !r.eligible.includes(who) || r.picks[who]) return;
    r.picks[who] = { choice: ['need', 'greed'].includes(choice) ? choice : 'pass', roll: 1 + Math.floor(Math.random() * 100) };
    if (r.eligible.every((x) => r.picks[x])) resolveRoll(r.id);
  }
  function resolveRoll(id) {
    const r = rolls.get(id); if (!r || r.done || r.owner !== me()) return; r.done = true; clearTimeout(r.timer);
    const res = Object.entries(r.picks).filter(([, v]) => v.choice !== 'pass').map(([who, v]) => ({ who, n: nameOf(who), c: v.choice, r: v.roll }));
    const best = (c) => res.filter((x) => x.c === c).sort((a, b) => b.r - a.r)[0];
    const win = best('need') || best('greed');
    const winner = win ? win.who : me(); // if everyone passes, whoever made the kill keeps it
    send('won', { gid: Grp.gid, id, winner, item: winner === me() ? null : r.item, name: r.item.name, res });
    announce(r.item.name, res, winner);
    if (winner === me()) giveMe(r.item, win ? 'from the roll' : '(everyone passed)');
    rolls.delete(id); renderRolls();
  }
  function announce(name, res, winner) {
    for (const x of res) G.log(`${x.n} rolls ${x.r} (${x.c === 'need' ? 'Need' : 'Greed'}) for ${name}.`, 'loot', '#cfe');
    G.log(`${winner === me() ? 'You win' : nameOf(winner) + ' wins'} ${name}.`, 'loot', GCOL);
  }
  function renderRolls() {
    let box = $('.groll-box'); if (!box) { box = h('div', 'groll-box'); $('#ui').appendChild(box); }
    box.innerHTML = '';
    for (const r of rolls.values()) {
      if (r.mine) continue;
      const it = r.item, left = Math.max(0, r.until - Date.now());
      const card = h('div', 'groll', `<div class="groll-i">${UI.icHTML(it)}</div><div class="groll-m"><b>${esc(it.name)}</b><small>Roll for it: Need if you will use it, Greed to sell it.</small><div class="groll-t"><i style="width:${(left / ROLL_TIME) * 100}%"></i></div>
        <div class="groll-b"><button class="btn small gold" data-c="need">🎲 Need</button><button class="btn small" data-c="greed">💰 Greed</button><button class="btn small ghost" data-c="pass">Pass</button></div></div>`);
      card.querySelectorAll('button').forEach((b) => (b.onclick = () => { KR.A.sfx('click'); Sys.groupPick(r.id, b.dataset.c); }));
      if (UI.bindTip) UI.bindTip(card.querySelector('.groll-i'), () => UI.itemTip(it));
      box.appendChild(card);
    }
    box.hidden = !box.children.length;
  }
  // timers on the dice windows, and passing automatically when time runs out
  setInterval(() => {
    let any = false; const now = Date.now();
    for (const r of rolls.values()) {
      if (r.mine) continue; any = true;
      if (now > r.until) { if (r.owner === me()) { r.mine = 'pass'; gotPick(r, me(), 'pass'); } else Sys.groupPick(r.id, 'pass'); }
    }
    if (any) for (const el of document.querySelectorAll('.groll-t i')) { const r = [...rolls.values()].filter((x) => !x.mine)[[...document.querySelectorAll('.groll-t i')].indexOf(el)]; if (r) el.style.width = (Math.max(0, r.until - now) / ROLL_TIME) * 100 + '%'; }
    for (const [id, r] of rolls) if (r.owner !== me() && now > r.until + 15000) rolls.delete(id); // the roll's owner went away
  }, 500);

  // ---------- network ----------
  Sys.onNetReady = function (room) {
    Net.on('grp', (m) => {
      if (m.isMe || !m.data) return; const d = m.data, from = m.peer; if (d.fn) Grp.names[from] = String(d.fn).slice(0, 24);
      const p = G.player; if (!p) return;
      switch (d.op) {
        case 'inv': if (d.to !== me()) return;
          if (inGroup()) { send('dec', { to: from, busy: 1 }); return; }
          if (!Grp.invites.some((x) => x.from === from)) Grp.invites.push({ from, name: Grp.names[from], gid: d.gid, at: Date.now() });
          G.log(`${Grp.names[from]} invites you to join a group. Open the Group tab (G) or click Accept.`, 'sys', GCOL); KR.A.sfx('open', 0.5); renderInvites(); break;
        case 'dec': if (d.to !== me()) return; G.log(`${Grp.names[from]} ${d.busy ? 'is already in a group' : 'declines your invitation'}.`, 'sys', '#ffb24a');
          if (Grp.members.length <= 1) clearGroup(); break;
        case 'acc': if (d.to !== me()) return;
          if (Grp.gid !== d.gid || (inGroup() && !isLeader())) return;
          if (Grp.members.length >= MAX) { send('full', { to: from }); return; }
          if (!Grp.members.includes(from)) Grp.members.push(from);
          G.log(`${Grp.names[from]} has joined your group.`, 'sys', GCOL); KR.A.sfx('quest', 0.4); broadcastState(); refresh(); break;
        case 'full': if (d.to === me()) G.log('That group is full.', 'sys', '#ffb24a'); break;
        case 'st':
          if (d.members.includes(me())) { const was = Grp.gid; const joined = was !== d.gid; const newLead = Grp.leader !== d.leader && !joined; setState(d); if (joined) { G.log(`You have joined ${nameOf(d.leader)}'s group.`, 'sys', GCOL); Grp.invites = []; renderInvites(); } else if (newLead) G.log(`${nameOf(d.leader)} is now the group leader.`, 'sys', GCOL); if (d.members.length <= 1) clearGroup('Your group has disbanded.'); }
          else if (Grp.gid === d.gid) clearGroup(d.members.length <= 1 ? 'Your group has disbanded.' : 'You have been removed from the group.');
          break;
        case 'lv': if (Grp.gid !== d.gid) return;
          G.log(`${Grp.names[from]} has left the group.`, 'sys', GCOL);
          Grp.members = Grp.members.filter((x) => x !== from);
          if (Grp.leader === from) Grp.leader = Grp.members[0];
          if (Grp.members.length <= 1) { clearGroup('Your group has disbanded.'); return; }
          if (isLeader()) broadcastState(); refresh(); break;
        case 'chat': if (Grp.gid !== d.gid) return; { const t = String(d.t || '').slice(0, 200); G.log(`[Group] ${Grp.names[from]}: ${t}`, 'group', GCOL); const pp = peerOf(from); if (pp) pp.bubble = { text: t.slice(0, 120), until: Date.now() + 5000 }; } break;
        case 'xp': if (Grp.gid !== d.gid || (d.rm || 'main') !== (W.realm || 'main') || p.dead) return;
          if (Math.hypot(d.x - p.x, d.y - p.y) > XP_RANGE) return;
          G.giveXp(Math.max(1, Math.min(+d.amt || 0, D.xpNeeded(p.c.level) * 0.5)), `as your group's share${d.mob ? ' for ' + String(d.mob).slice(0, 30) : ''}`); break;
        case 'buff': { if (Grp.gid !== d.gid || (d.rm || 'main') !== (W.realm || 'main') || p.dead) return;
          if (Math.hypot(d.x - p.x, d.y - p.y) > BUFF_RANGE + 40) return;
          const def = D.SPELLS[d.sp]; if (!def || !def.effects.every((e) => ['buff', 'hot', 'rune'].includes(e.t))) return;
          const lvl = U.clamp(+d.lvl || 1, 1, D.MAX_LEVEL);
          const d2 = d.song ? Object.assign({}, def, { quiet: true, effects: def.effects.map((e) => Object.assign({}, e, { dur: D.SONG_DUR })) }) : def;
          const src = { level: lvl, name: Grp.names[from], spellMul: 1, type: 'peer' };
          for (const t of G.party(p)) if (Math.hypot(t.x - p.x, t.y - p.y) < BUFF_RANGE) G.applyEffects(src, t, d2);
          if (d.song) G.noteFx(p, def, 2); else G.fxAdd({ k: 'aura', x: p.x, y: p.y, col: '#9affb8', life: 0.9, ent: p });
          break; }
        case 'coin': if (Grp.gid !== d.gid || d.to !== me()) return; { const amt = Math.max(0, Math.min(Math.round(+d.amt || 0), 1e7)); if (!amt) return; p.c.coins += amt; G.log(`You receive ${G.fmtCoins(amt)} as your share${d.mob ? ' from ' + String(d.mob).slice(0, 30) : ''}.`, 'loot', '#f0d070'); KR.A.sfx('coin', 0.5); KR.UI.refresh && KR.UI.refresh(); } break;
        case 'give': if (Grp.gid !== d.gid || d.to !== me() || !d.item || typeof d.item !== 'object') return; giveMe(d.item, `from ${Grp.names[from]}'s kill`); break;
        case 'roll': if (Grp.gid !== d.gid || !d.item || typeof d.item !== 'object' || !Array.isArray(d.eligible) || !d.eligible.includes(me())) return;
          rolls.set(d.id, { id: d.id, item: d.item, owner: from, eligible: d.eligible, picks: {}, until: Date.now() + Math.min(+d.ms || ROLL_TIME, 60000), mine: null });
          KR.A.sfx('open', 0.5); renderRolls(); break;
        case 'pick': if (Grp.gid !== d.gid || d.to !== me()) return; { const r = rolls.get(d.id); if (r && r.owner === me()) gotPick(r, from, d.choice); } break;
        case 'won': if (Grp.gid !== d.gid) return; { const r = rolls.get(d.id); if (!r && d.winner !== me()) return; rolls.delete(d.id); renderRolls();
          announce(String(d.name || 'the item').slice(0, 60), Array.isArray(d.res) ? d.res.slice(0, 6).map((x) => ({ n: String(x.n || '').slice(0, 24), c: x.c === 'need' ? 'need' : 'greed', r: Math.max(1, Math.min(100, Math.round(+x.r) || 1)) })) : [], d.winner);
          if (d.winner === me() && d.item && typeof d.item === 'object') giveMe(d.item, 'from the roll'); } break;
      }
    });
  };
  Sys.onPeersChanged = function () {
    const now = Date.now(); for (const pp of Net.peers) Grp.seen[pp.peer] = now;
    if (UI.isOpen('group')) { const w = UI.wins.group; clearTimeout(Grp._rt); Grp._rt = setTimeout(() => renderGroup(w), 250); }
  };
  // leader drops members who have been offline for a minute
  setInterval(() => {
    if (!isLeader()) return; const now = Date.now();
    const gone = Grp.members.filter((id) => id !== me() && !peerOf(id) && now - (Grp.seen[id] || now) > 60000);
    if (!gone.length) return; for (const id of gone) G.log(`${nameOf(id)} has gone offline and left the group.`, 'sys', GCOL);
    Grp.members = Grp.members.filter((id) => !gone.includes(id));
    if (Grp.members.length <= 1) { broadcastState(); clearGroup('Your group has disbanded.'); } else { broadcastState(); refresh(); }
    for (const id of Grp.members) if (!Grp.seen[id]) Grp.seen[id] = now;
  }, 5000);
  setInterval(() => { const now = Date.now(); const n = Grp.invites.length; Grp.invites = Grp.invites.filter((x) => now - x.at < 90000); if (n !== Grp.invites.length) renderInvites(); }, 3000);

  // ---------- chat commands ----------
  const oldCmd = Sys.command;
  Sys.command = function (ln) {
    const m = /^\/(\w+)\s*(.*)$/.exec(ln.trim());
    if (m) {
      const cmd = m[1].toLowerCase(), arg = m[2].trim();
      if (cmd === 'invite' || cmd === 'inv') { if (arg) Sys.groupInvite(arg); else if (G.player.target && G.player.target.type === 'peer') Sys.groupInvite(G.player.target.peer); else if (KR.Online && KR.Online.mode !== 'solo') { const O = KR.Online; G.log(`Invite friends to "${O.name}" with this link: ${O.inviteLink()} (game code ${O.code}${O.pass ? ', plus the password' : ''}). To invite a player who is already here into your group: /invite <name>.`, 'status', '#ffd84a'); try { navigator.clipboard && navigator.clipboard.writeText(O.inviteLink()).catch(() => {}); } catch (e) {} } else G.log('Usage: /invite <name>', 'sys', '#ccc'); return; }
      if (cmd === 'g' || cmd === 'gsay' || cmd === 'gs') { Sys.groupChat(arg); return; }
      if (cmd === 'disband') { Sys.groupDisband(); return; }
      if (cmd === 'leavegroup') { Sys.groupLeave(); return; }
      if (cmd === 'lfg') { Sys.setLFG(arg ? arg !== 'off' : !Grp.lfg); return; }
      if (cmd === 'kick' && arg) { const id = Grp.members.find((x) => nameOf(x).toLowerCase() === arg.toLowerCase()); if (id) Sys.groupKick(id); else G.log(`${arg} is not in your group.`, 'sys', '#ffb24a'); return; }
      if (cmd === 'accept' || cmd === 'follow') { const inv = Grp.invites[Grp.invites.length - 1]; if (inv) Sys.groupAccept(inv); else G.log('You have no group invitations.', 'sys', '#ccc'); return; }
      if (cmd === 'decline') { const inv = Grp.invites[Grp.invites.length - 1]; if (inv) Sys.groupDecline(inv); return; }
      if (cmd === 'help') { oldCmd(ln); G.log('Group: /invite <name>, /g <text>, /accept, /decline, /lfg, /kick <name>, /disband, /leavegroup. Press G for the Group tab.', 'sys', '#ccc'); return; }
    }
    oldCmd(ln);
  };

  // ---------- invitation popup ----------
  function renderInvites() {
    let box = $('.ginv-box'); if (!box) { box = h('div', 'ginv-box'); $('#ui').appendChild(box); }
    box.innerHTML = '';
    for (const inv of Grp.invites) {
      const pp = peerOf(inv.from);
      const card = h('div', 'ginv', `<b>${esc(inv.name || 'Someone')}</b> invites you to a group${pp ? `<small>Level ${pp.l} ${esc(D.RACES[pp.r] ? D.RACES[pp.r].name : '')} ${esc(D.CLASSES[pp.c] ? D.CLASSES[pp.c].name : '')}</small>` : ''}<div class="ginv-b"><button class="btn small primary">Accept</button><button class="btn small">Decline</button></div>`);
      const [a, d] = card.querySelectorAll('button'); a.onclick = () => Sys.groupAccept(inv); d.onclick = () => Sys.groupDecline(inv);
      box.appendChild(card);
    }
    box.hidden = !Grp.invites.length;
  }

  // ---------- group window ----------
  const raceN = (r) => (D.RACES[r] ? D.RACES[r].name : '');
  const clsN = (c) => (D.CLASSES[c] ? D.CLASSES[c].name : '');
  const facN = (f) => (D.FACTIONS[f] ? D.FACTIONS[f].city : '');
  function bars(pp) { const hp = pp.hp == null ? 100 : pp.hp, mp = pp.mp == null ? -1 : pp.mp; return `<span class="bar hp"><i style="width:${hp}%"></i></span>${mp >= 0 ? `<span class="bar mana"><i style="width:${mp}%"></i></span>` : ''}`; }
  function renderGroup(w) {
    if (!w || w.el.hidden) return;
    const p = G.player; if (!p) return; const c = p.c; const b = w.body;
    const keep = b.querySelector('.gp-search'); const hadFocus = keep && document.activeElement === keep;
    if (!Net.ok) { b.innerHTML = `<p class="empty-note">Grouping is for multiplayer games. Go back to the main menu and choose Multiplayer to host a game or join one.</p>`; return; }
    const lead = Grp.leader;
    const mem = inGroup() ? Grp.members : [me()];
    const rows = mem.map((id) => {
      const mine = id === me(); const pp = mine ? null : peerOf(id);
      const d = mine ? { n: c.name, l: c.level, r: c.race, c: c.cls, hp: Math.round((p.hp / p.hpMax) * 100), mp: p.manaMax ? Math.round((p.mana / p.manaMax) * 100) : -1, z: zoneName() } : pp || { n: nameOf(id), off: 1 };
      const far = !mine && pp && ((pp.rm || 'main') !== (W.realm || 'main') || Math.hypot(pp.x - p.x, pp.y - p.y) > XP_RANGE);
      return `<div class="gp-m ${d.off ? 'off' : ''}"><div class="gp-mh"><b>${id === lead && inGroup() ? '👑 ' : ''}${esc(d.n)}</b><small>${d.off ? 'offline' : `${d.l} ${esc(raceN(d.r))} ${esc(clsN(d.c))}`}</small></div>${d.off ? '' : bars(d)}<small class="dim">${esc(d.z || '')}${far ? ' · <span style="color:#ffb24a">too far to share XP</span>' : ''}</small>${isLeader() && !mine ? `<div class="gp-act"><button class="btn tiny" data-k="${esc(id)}">Kick</button><button class="btn tiny" data-p="${esc(id)}">Make leader</button></div>` : ''}</div>`;
    }).join('');
    const near = nearMembers(XP_RANGE).length;
    const list = Net.peers.filter((pp) => !Grp.members.includes(pp.peer));
    const mid = c.level;
    const flt = list.filter((pp) => (filter === 'lfg' ? pp.lfg : filter === 'level' ? Math.abs((pp.l || 1) - mid) <= 5 : filter === 'zone' ? (pp.rm || 'main') === (W.realm || 'main') && pp.z === zoneName() : filter === 'kingdom' ? pp.f === c.faction : true) && (!search || (pp.n || '').toLowerCase().includes(search.toLowerCase())))
      .sort((a, b2) => (b2.lfg || 0) - (a.lfg || 0) || Math.abs((a.l || 1) - mid) - Math.abs((b2.l || 1) - mid));
    const canInv = !inGroup() || (isLeader() && Grp.members.length < MAX);
    b.innerHTML = `<div class="gp">
      <section class="gp-sec"><h4>Your group <span class="dim small">${inGroup() ? `${Grp.members.length} / ${MAX}` : 'solo'}</span></h4>
        <div class="gp-mem">${rows}</div>
        ${inGroup() ? `<p class="dim small">${near ? `Experience is split with ${near} nearby member${near > 1 ? 's' : ''}, with a ${Math.round(20 * near)}% group bonus.` : 'No members nearby: you keep all your experience.'} Group spells and bard songs reach members within range.</p>` : '<p class="dim small">Invite players below to form a group of up to 6. Groups share experience from kills, with a bonus, and receive each other\'s group buffs and songs.</p>'}
        <div class="gp-btns"><label class="gp-lfg"><input type="checkbox" class="gp-lfgc" ${Grp.lfg ? 'checked' : ''}> Looking for group</label>${inGroup() ? `<button class="btn small gp-leave">${isLeader() ? 'Disband' : 'Leave group'}</button>` : ''}</div>
        ${inGroup() ? `<form class="gp-chat"><input maxlength="200" placeholder="Say to your group (or /g in chat)"><button class="btn small">Send</button></form>` : ''}
      </section>
      <section class="gp-sec"><h4>Players online <span class="dim small">${Net.peers.length} other${Net.peers.length === 1 ? '' : 's'}</span></h4>
        <div class="gp-f">${[['all', 'All'], ['lfg', 'Looking for group'], ['level', 'Near my level'], ['zone', 'My zone'], ['kingdom', 'My kingdom']].map(([k, l]) => `<button class="tab ${filter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
        <input class="gp-search" placeholder="Search by name" value="${esc(search)}">
        <div class="gp-list">${flt.length ? flt.map((pp) => `<div class="gp-p"><div class="gp-pm"><b>${esc(pp.n)}</b>${pp.lfg ? '<span class="pill lfg">LFG</span>' : ''}${pp.gid ? '<span class="pill">grouped</span>' : ''}<small>${pp.l} ${esc(raceN(pp.r))} ${esc(clsN(pp.c))} · ${esc(facN(pp.f))}</small><small class="dim">${esc(pp.z || '')}${(pp.rm || 'main') === (W.realm || 'main') && G.player ? ` · ${Math.round(Math.hypot(pp.x - p.x, pp.y - p.y) / 32)}m away` : ''}</small></div>${canInv && !pp.gid ? `<button class="btn small" data-i="${esc(pp.peer)}">Invite</button>` : ''}</div>`).join('') : `<p class="empty-note">${Net.peers.length ? 'Nobody matches this filter.' : 'No other players are online right now. They will appear here as soon as they log in.'}</p>`}</div>
      </section></div>`;
    b.querySelectorAll('[data-i]').forEach((x) => (x.onclick = () => { Sys.groupInvite(x.dataset.i); x.disabled = true; x.textContent = 'Invited'; }));
    b.querySelectorAll('[data-k]').forEach((x) => (x.onclick = () => Sys.groupKick(x.dataset.k)));
    b.querySelectorAll('[data-p]').forEach((x) => (x.onclick = () => Sys.groupPromote(x.dataset.p)));
    b.querySelectorAll('[data-f]').forEach((x) => (x.onclick = () => { filter = x.dataset.f; renderGroup(w); }));
    const lf = b.querySelector('.gp-lfgc'); if (lf) lf.onchange = () => Sys.setLFG(lf.checked);
    const lv = b.querySelector('.gp-leave'); if (lv) lv.onclick = () => (isLeader() ? Sys.groupDisband() : Sys.groupLeave());
    const sf = b.querySelector('.gp-search'); sf.oninput = () => { search = sf.value; renderGroup(w); }; if (hadFocus) { sf.focus(); sf.setSelectionRange(sf.value.length, sf.value.length); }
    const cf = b.querySelector('.gp-chat'); if (cf) cf.onsubmit = (e) => { e.preventDefault(); const i = cf.querySelector('input'); Sys.groupChat(i.value); i.value = ''; };
  }

  // ---------- group frames on the HUD ----------
  function tickFrames(force) {
    let box = $('.hud-group'); if (!box) return;
    const ids = inGroup() ? Grp.members.filter((id) => id !== me()) : [];
    box.hidden = (UI.hudClosed && UI.hudClosed('group')) || !ids.length;
    const sig = ids.join(',') + '|' + Grp.leader;
    if (force || box.dataset.sig !== sig) { box.dataset.sig = sig; let gb = box.querySelector('.gf-body'); if (!gb) { gb = h('div', 'gf-body'); box.prepend(gb); } gb.innerHTML = ids.map((id) => `<div class="mf gf" data-id="${esc(id)}" title="Group member"><span class="mf-n"></span><span class="bar hp"><i></i></span><span class="bar mana"><i></i></span></div>`).join(''); }
    box.querySelectorAll('.gf').forEach((f) => {
      const id = f.dataset.id, pp = peerOf(id); const n = (id === Grp.leader ? '👑 ' : '') + nameOf(id) + (pp ? ` ${pp.l}` : ' (offline)');
      const ne = f.querySelector('.mf-n'); if (ne.textContent !== n) ne.textContent = n;
      const [hp, mn] = f.querySelectorAll('.bar'); hp.firstChild.style.width = (pp && pp.hp != null ? pp.hp : 0) + '%';
      mn.hidden = !pp || pp.mp == null || pp.mp < 0; if (!mn.hidden) mn.firstChild.style.width = pp.mp + '%';
      f.classList.toggle('dead', !pp || !!pp.dead); f.classList.toggle('far', !!pp && ((pp.rm || 'main') !== (W.realm || 'main')));
    });
  }
  let fT = 0, wT = 0;
  UI.tickGroup = function () {
    const now = performance.now(); if (now - fT > 300) { fT = now; tickFrames(); }
    if (UI.isOpen('group') && now - wT > 1500 && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#w-group'))) { wT = now; renderGroup(UI.wins.group); }
  };
  UI.buildGroupUI = function () {
    UI.win('group', 'Group', { w: 460, h: 600, y: 60, x: 40, render: renderGroup });
    renderInvites();
  };
  UI.buildGroupHUD = function () {
    if (!$('.hud-group')) { const box = h('div', 'hud-group'); box.hidden = true; $('#ui').appendChild(box); }
  };
})();

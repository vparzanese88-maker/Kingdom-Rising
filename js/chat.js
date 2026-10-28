// Kingdom Rising — the chat window: tabs (Main and Combat to start, add as many as you like), right-click a tab
// to choose what it shows, rename it, or change the text size and background; and the EverQuest slash commands.
(function () {
  const KR = window.KR; const { D, G, U } = KR; const Sys = KR.Sys, UI = KR.UI;
  const TS = D.TS;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LSg = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const LSs = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  // ---------------------------------------------------------------- what a message is about
  const CATS = [
    ['sys', 'System messages'], ['combat', 'Melee hits and misses'], ['spell', 'Spells and abilities'], ['loot', 'Loot and money'],
    ['xp', 'Experience'], ['skill', 'Skill-ups'], ['quest', 'Quests and your kingdom'], ['craft', 'Crafting and gathering'],
    ['say', 'Say and townsfolk'], ['emote', 'Emotes'], ['tell', 'Tells (whispers)'], ['group', 'Group chat'], ['world', 'General (world) chat'],
  ];
  const CAT_OF = { status: 'quest', war: 'quest', kingdom: 'quest', npc: 'say', social: 'emote', whisper: 'tell', ooc: 'world', general: 'world', heal: 'spell', dmg: 'combat' };
  const catOf = (ch) => (CATS.some((c) => c[0] === ch) ? ch : CAT_OF[ch] || 'sys');
  const ALL = () => Object.fromEntries(CATS.map(([k]) => [k, true]));
  const DEFAULT = () => ({ tabs: [{ name: 'Main', show: Object.assign(ALL(), { combat: false }) }, { name: 'Combat', show: Object.fromEntries(CATS.map(([k]) => [k, k === 'combat' || k === 'spell'])) }], cur: 0, size: 13, bg: 0.92 });
  const C = (KR.Chat = { cfg: LSg('kr_chat', null) || DEFAULT(), unread: [] });
  const save = () => LSs('kr_chat', C.cfg);
  if (!C.cfg.tabs || !C.cfg.tabs.length) C.cfg = DEFAULT();

  // ---------------------------------------------------------------- the window
  function tabBar() {
    const box = $('.hud-chat'); if (!box) return;
    let bar = $('.ct-tabs', box); if (!bar) { bar = document.createElement('div'); bar.className = 'ct-tabs'; box.insertBefore(bar, box.firstChild); }
    bar.innerHTML = C.cfg.tabs.map((t, i) => `<button class="ct-tab${i === C.cfg.cur ? ' on' : ''}${C.unread[i] && i !== C.cfg.cur ? ' new' : ''}" data-i="${i}" title="Right-click for options">${esc(t.name)}</button>`).join('') + '<button class="ct-tab ct-add" title="New chat tab">+</button>';
    bar.querySelectorAll('[data-i]').forEach((b) => {
      b.onclick = () => { C.cfg.cur = +b.dataset.i; C.unread[C.cfg.cur] = false; save(); tabBar(); redraw(); };
      b.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); menu(+b.dataset.i, e.clientX, e.clientY); };
    });
    $('.ct-add', bar).onclick = () => { C.cfg.tabs.push({ name: 'Tab ' + (C.cfg.tabs.length + 1), show: ALL() }); C.cfg.cur = C.cfg.tabs.length - 1; save(); tabBar(); redraw(); menu(C.cfg.cur, bar.getBoundingClientRect().left + 40, bar.getBoundingClientRect().top + 20); };
    box.style.setProperty('--chat-size', C.cfg.size + 'px'); box.style.setProperty('--chat-bg', C.cfg.bg);
    box.classList.add('chat2');
  }
  function shows(m, t) { return !!(t || C.cfg.tabs[C.cfg.cur]).show[catOf(m.ch)]; }
  function line(m) { const ln = document.createElement('div'); ln.className = 'ln ch-' + m.ch; ln.textContent = (C.cfg.stamps ? `[${new Date(m.t || Date.now()).toTimeString().slice(0, 5)}] ` : '') + m.text; if (m.color) ln.style.color = m.color; return ln; }
  function redraw() {
    const log = $('#chatlog'); if (!log) return; log.innerHTML = '';
    const t = C.cfg.tabs[C.cfg.cur]; const msgs = G.msgs.filter((m) => shows(m, t)).slice(-200);
    const frag = document.createDocumentFragment(); for (const m of msgs) frag.appendChild(line(m)); log.appendChild(frag); log.scrollTop = log.scrollHeight;
  }
  // a message arrives: show it if this tab wants it, and light up the other tabs that would
  UI.onLog = function (m) {
    const log = $('#chatlog'); if (!log) return;
    C.cfg.tabs.forEach((t, i) => { if (i !== C.cfg.cur && shows(m, t) && !C.unread[i]) { C.unread[i] = true; const b = document.querySelector(`.ct-tab[data-i="${i}"]`); if (b) b.classList.add('new'); } });
    if (!shows(m)) return;
    const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
    log.appendChild(line(m)); while (log.children.length > 200) log.firstChild.remove();
    if (atBottom) log.scrollTop = log.scrollHeight;
  };
  // right-click a tab: what it shows, its name, and how the window looks
  function menu(i, x, y) {
    document.querySelectorAll('.ct-menu').forEach((el) => el.remove());
    const t = C.cfg.tabs[i]; const m = document.createElement('div'); m.className = 'ct-menu ctx';
    m.innerHTML = `<div class="ct-h">${esc(t.name)}</div>
      <div class="ct-cats">${CATS.map(([k, n]) => `<label><input type="checkbox" data-k="${k}" ${t.show[k] ? 'checked' : ''}> ${n}</label>`).join('')}</div>
      <div class="ct-row"><button data-a="all">Show all</button><button data-a="none">Show none</button></div>
      <div class="ct-row"><input class="ct-name" maxlength="16" value="${esc(t.name)}" aria-label="Tab name"><button data-a="rename">Rename</button></div>
      <div class="ct-row"><label>Text <input type="range" min="10" max="20" value="${C.cfg.size}" data-a="size"></label><label>Background <input type="range" min="0" max="100" value="${Math.round(C.cfg.bg * 100)}" data-a="bg"></label></div>
      <label class="ct-stamp"><input type="checkbox" data-a="stamps" ${C.cfg.stamps ? 'checked' : ''}> Time stamps</label>
      <div class="ct-row"><button data-a="new">New tab</button>${C.cfg.tabs.length > 1 ? '<button data-a="del" class="bad">Delete tab</button>' : ''}<button data-a="reset">Reset chat</button><button data-a="close">Close</button></div>`;
    document.body.appendChild(m);
    const r = m.getBoundingClientRect(); m.style.left = Math.max(6, Math.min(innerWidth - r.width - 6, x)) + 'px'; m.style.top = Math.max(6, Math.min(innerHeight - r.height - 6, y - r.height)) + 'px';
    const apply = () => { save(); tabBar(); redraw(); };
    m.querySelectorAll('[data-k]').forEach((cb) => (cb.onchange = () => { t.show[cb.dataset.k] = cb.checked; apply(); }));
    m.onclick = (e) => {
      const a = e.target.dataset && e.target.dataset.a; if (!a || e.target.type === 'range' || e.target.type === 'checkbox') return;
      if (a === 'all' || a === 'none') { for (const [k] of CATS) t.show[k] = a === 'all'; m.querySelectorAll('[data-k]').forEach((cb) => (cb.checked = a === 'all')); apply(); }
      else if (a === 'rename') { t.name = $('.ct-name', m).value.trim().slice(0, 16) || t.name; apply(); m.remove(); }
      else if (a === 'new') { C.cfg.tabs.push({ name: 'Tab ' + (C.cfg.tabs.length + 1), show: ALL() }); C.cfg.cur = C.cfg.tabs.length - 1; apply(); m.remove(); }
      else if (a === 'del') { C.cfg.tabs.splice(i, 1); C.cfg.cur = Math.min(C.cfg.cur, C.cfg.tabs.length - 1); apply(); m.remove(); }
      else if (a === 'reset') { C.cfg = DEFAULT(); apply(); m.remove(); }
      else if (a === 'close') m.remove();
    };
    $('[data-a="size"]', m).oninput = (e) => { C.cfg.size = +e.target.value; apply(); };
    $('[data-a="bg"]', m).oninput = (e) => { C.cfg.bg = +e.target.value / 100; apply(); };
    $('[data-a="stamps"]', m).onchange = (e) => { C.cfg.stamps = e.target.checked; apply(); };
    $('.ct-name', m).onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') { t.name = e.target.value.trim().slice(0, 16) || t.name; apply(); m.remove(); } };
    setTimeout(() => { const off = (e) => { if (!m.contains(e.target)) { m.remove(); removeEventListener('pointerdown', off, true); } }; addEventListener('pointerdown', off, true); }, 0);
  }
  const build0 = UI.buildHUD;
  UI.buildHUD = function () { const r = build0.apply(this, arguments); try { tabBar(); redraw(); } catch (e) { console.warn(e); } return r; };

  // ---------------------------------------------------------------- the slash commands
  const EMOTES = { wave: 'waves', bow: 'bows deeply', cheer: 'cheers', cry: 'cries', laugh: 'laughs', dance: 'dances', point: 'points', salute: 'salutes', thank: 'thanks', smile: 'smiles', nod: 'nods', shrug: 'shrugs', sigh: 'sighs', yawn: 'yawns', clap: 'claps', kneel: 'kneels', grin: 'grins', glare: 'glares', flex: 'flexes', blush: 'blushes', hug: 'hugs', kiss: 'blows a kiss', cower: 'cowers in fear', roar: 'roars' };
  const emote = (text) => { const p = G.player; G.log(`${p.c.name} ${text}`, 'emote', '#e8c8ff'); try { Sys.Net.chat(`* ${text}`); } catch (e) {} };
  const near = (p, name) => G.ents.filter((x) => !x.removed && x !== p && x.name && x.name.toLowerCase().startsWith(name.toLowerCase())).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  let campT = 0;
  const HELP = [
    'Chat: /say /s, /g /gsay (group), /general /gen /ooc /world /shout /auction (everyone), /tell /t <name> <text>, /reply /r, /emote /em /me <text>',
    'Actions: /sit [on|off], /stand, /camp (sit and log out), /quit, /stuck (free yourself, once a minute), /attack [on|off], /target /tar <name>, /assist, /follow, /consider /con, /hail, /loot',
    'Info: /loc, /time, /who, /played, /exp, /roll /random [max], /afk [message], /clear, /help',
    'Emotes: ' + Object.keys(EMOTES).map((k) => '/' + k).join(' '),
    'Group: /invite <name>, /accept, /decline, /disband, /kick <name>, /lfg. Pets: /pet attack|back. Spells: /cast <spell>, /use <ability>',
  ];
  const cmd0 = Sys.command;
  Sys.command = function (ln) {
    const p = G.player; if (!p) return cmd0.apply(this, arguments);
    const s = String(ln).trim(); if (!s) return;
    if (!s.startsWith('/')) return cmd0.apply(this, arguments); // plain text is said aloud
    const [cmd, ...rest] = s.split(/\s+/); const arg = rest.join(' '); const lc = cmd.toLowerCase().slice(1);
    const c = p.c;
    switch (lc) {
      case 's': return Sys.command('/say ' + arg);
      case 'gen': case 'general': case 'shout': case 'auction': case 'ooc': case 'world': case '1':
        if (!arg) { G.log(`Say what? /${lc} <text>`, 'sys', '#aaa'); return; }
        try { Sys.Net.chat(lc === 'auction' ? '[Auction] ' + arg : arg); } catch (e) {} G.log(`[General] ${c.name}: ${lc === 'auction' ? '[Auction] ' : ''}${arg}`, 'world', '#9ad8ff'); return;
      case 't': case 'tell': case 'msg': case 'whisper': case 'w': {
        const [to, ...m] = rest; const text = m.join(' '); if (!to || !text) { G.log('Usage: /tell <name> <message>', 'sys', '#aaa'); return; }
        const peer = (Sys.Net.peers || []).find((pp) => (pp.n || '').toLowerCase() === to.toLowerCase());
        if (!peer) { G.log(`${to} is not online in your game.`, 'tell', '#ff9ad8'); return; }
        try { Sys.Net.room.emit('chat', { n: c.name, t: text, to: peer.n }).catch(() => {}); } catch (e) {}
        G.log(`You tell ${peer.n}, '${text}'`, 'tell', '#ff9ad8'); C.lastTell = peer.n; return; }
      case 'r': case 'reply': if (!C.lastTell) { G.log('No one has sent you a tell yet.', 'sys', '#aaa'); return; } return Sys.command(`/tell ${C.lastTell} ${arg}`);
      case 'em': case 'emote': case 'me': if (arg) emote(arg); return;
      case 'sit': if (arg === 'off') p.sit = false; else if (arg === 'on') p.sit = true; else p.sit = !p.sit; if (p.sit) { p.autoAttack = false; } G.log(p.sit ? 'You sit down.' : 'You stand up.', 'sys', '#ccc'); return;
      case 'stand': p.sit = false; G.log('You stand up.', 'sys', '#ccc'); return;
      case 'camp': {
        if (G.inCombat && G.inCombat(p)) { G.log('You cannot camp while in combat.', 'sys', '#ffb24a'); return; }
        p.sit = true; const t0 = Date.now(); campT = t0; G.log('It will take you about 10 seconds to prepare your camp. Stand up to cancel.', 'sys', '#e8d48a');
        const tick = () => { if (campT !== t0) return; if (!p.sit || p.dead || (G.inCombat && G.inCombat(p))) { G.log('You abandon your preparations to camp.', 'sys', '#ffb24a'); campT = 0; return; } if (Date.now() - t0 >= 10000) { campT = 0; KR.Main.exitToMenu && KR.Main.exitToMenu(); return; } setTimeout(tick, 250); }; setTimeout(tick, 250); return; }
      case 'quit': case 'exit': case 'logout': KR.Main.exitToMenu && KR.Main.exitToMenu(); return;
      case 'tar': return Sys.command('/target ' + arg);
      case 'assist': { const t = p.target; if (!t) { G.log('You have no target to assist.', 'sys', '#aaa'); return; } if (!t.target) { G.log(`${t.name} has no target.`, 'sys', '#aaa'); return; } p.target = t.target; G.log(`You are now assisting ${t.name}: targeting ${t.target.name}.`, 'sys', '#ccc'); return; }
      case 'follow': { const t = p.target; if (!t || t === p) { G.log('Target someone to follow.', 'sys', '#aaa'); return; } p.chase = t; G.log(`You begin to follow ${t.name}. Move to stop.`, 'sys', '#ccc'); return; }
      case 'con': case 'consider': { const t = p.target; if (!t) { G.log('Target something to consider.', 'sys', '#aaa'); return; } if (t.type !== 'mob') { G.log(`${t.name} regards you indifferently.`, 'sys', '#ccc'); return; } const con = D.conOf(c.level, t.level); const txt = { gray: 'looks like an easy target', green: 'looks like a reasonably safe opponent', lblue: 'looks like a reasonably safe opponent', blue: 'looks like a decent fight', white: 'looks like an even fight', yellow: 'looks like quite a gamble', red: 'what would you like your tombstone to say?' }[con] || 'looks dangerous'; G.log(`${t.name} (level ${t.level}) ${txt}.`, 'sys', D.CON_COLORS ? D.CON_COLORS[con] : '#ccc'); return; }
      case 'hail': case 'h': { const t = p.target && !p.target.dead ? p.target : near(p, arg || ''); if (t && Math.hypot(t.x - p.x, t.y - p.y) < 160) { G.log(`You say, 'Hail, ${t.name}!'`, 'say', '#fff'); KR.Main.interact && KR.Main.interact(t); } else G.log('You say, \'Hail!\'', 'say', '#fff'); return; }
      case 'loot': { const t = p.target && p.target.dead ? p.target : G.ents.filter((e) => e.dead && e.loot && e.loot.items.length && Math.hypot(e.x - p.x, e.y - p.y) < 90)[0]; if (!t) { G.log('There is nothing to loot nearby.', 'sys', '#aaa'); return; } Sys.lootAll(t); return; }
      case 'time': { const m = Math.floor(G.clock || 0) % 1440; const hh = Math.floor(m / 60), mm = m % 60; G.log(`It is ${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'} in the realm.`, 'sys', '#ccc'); return; }
      case 'played': { const s2 = Math.floor(c.playTime || 0); G.log(`You have played ${c.name} for ${Math.floor(s2 / 3600)} hours, ${Math.floor(s2 / 60) % 60} minutes.`, 'sys', '#ccc'); return; }
      case 'exp': case 'xp': { const need = D.xpNeeded(c.level); G.log(`Level ${c.level}: ${c.xp} / ${need} experience (${Math.floor((c.xp / need) * 100)}%).`, 'xp', '#e8d48a'); return; }
      case 'roll': case 'random': { const mx = Math.max(2, parseInt(arg, 10) || 100); const r = 1 + Math.floor(Math.random() * mx); G.log(`**A Magic Die is rolled by ${c.name}. It could have been any number from 1 to ${mx}, but this time it turned up a ${r}.`, 'emote', '#e8c8ff'); try { Sys.Net.chat(`rolls ${r} (1-${mx})`); } catch (e) {} return; }
      case 'afk': p.afk = !p.afk; C.afkMsg = arg || 'Sorry, I am away from the keyboard.'; G.log(p.afk ? `You are now away from the keyboard: "${C.afkMsg}"` : 'You are no longer away from the keyboard.', 'sys', '#ccc'); return;
      case 'clear': G.msgs.length = 0; redraw(); return;
      case 'help': for (const l of HELP) G.log(l, 'sys', '#ccc'); return;
      case 'walk': case 'run': KR.Main.toggleWalk && KR.Main.toggleWalk(); return;
    }
    if (EMOTES[lc]) { const t = p.target && p.target !== p ? p.target : null; emote(`${EMOTES[lc]}${t ? (lc === 'point' || lc === 'wave' || lc === 'bow' || lc === 'thank' || lc === 'hug' || lc === 'glare' ? ' at ' : ' to ') + t.name : ''}.`); return; }
    return cmd0.apply(this, arguments);
  };
  // tells and emotes from other players
  const hook = () => {
    const Net = Sys.Net; if (!Net || !Net.on || Net._chat2) return; Net._chat2 = true;
    const on0 = Net.on.bind(Net);
    Net.on = function (ev, fn) {
      if (ev !== 'chat') return on0(ev, fn);
      return on0(ev, (m) => {
        const d = m && m.data; if (!d || m.isMe) return fn(m);
        if (d.to) { if (G.player && d.to.toLowerCase() === G.player.c.name.toLowerCase()) { G.log(`${d.n} tells you, '${String(d.t).slice(0, 200)}'`, 'tell', '#ff9ad8'); C.lastTell = d.n; if (G.player.afk) Sys.command(`/tell ${d.n} [AFK] ${C.afkMsg}`); } return; }
        if (String(d.t || '').startsWith('* ')) { G.log(`${d.n} ${String(d.t).slice(2, 200)}`, 'emote', '#e8c8ff'); return; }
        return fn(m);
      });
    };
  };
  hook();
})();

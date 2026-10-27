// Kingdom Rising — single player and hosted multiplayer
// Single player never connects to anyone. Multiplayer runs one named room per hosted game:
// the host's page is the server (it owns both kingdoms, the clock and the war) and joiners send
// what they do to the host and take the host's world as it comes. The hosted world is saved,
// encrypted with the game's password, in a shared document, so anyone with the code and the
// password can host it again later, and when a host leaves mid-game another player takes over.
(function () {
  const KR = window.KR; const { D, G } = KR; const Sys = KR.Sys;
  const O = (KR.Online = { mode: 'solo', room: null, lobby: null, code: '', pass: '', name: '', hostPeer: null, lastSnap: null });
  const HOST_KEYS = ['cities', 'war', 'seed', 'worldV', 'clock', 'rivalT', 'day'];
  const JOIN_KEYS = ['cities', 'seed', 'worldV', 'clock', 'day'];
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const pick = (a, keys) => { const o = {}; for (const k of keys) if (a[k] !== undefined) o[k] = clone(a[k]); return o; };
  const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v) || 0));
  const toast = (t, s) => KR.UI && KR.UI.toast && KR.UI.toast(t, s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  O.available = () => !!(window.claude && window.claude.use);
  O.cleanCode = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  O.newCode = () => { const s = 'abcdefghjkmnpqrstuvwxyz23456789'; let c = ''; for (let i = 0; i < 6; i++) c += s[Math.floor(Math.random() * s.length)]; return c; };
  O.getLobby = async function () {
    if (O.lobby) return O.lobby;
    try { if (O.available()) O.lobby = await window.claude.use('room'); } catch (e) { O.lobby = null; }
    return O.lobby;
  };

  // ---------- password: the room name and the save are both derived from code + password ----------
  const te = new TextEncoder();
  const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
  async function sha(s) {
    if (crypto.subtle) return hex(await crypto.subtle.digest('SHA-256', te.encode(s)));
    let h1 = 0x811c9dc5, h2 = 0x9e3779b9; for (let i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619); h2 = Math.imul(h2 ^ s.charCodeAt(i), 2246822519); }
    return ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16)).padEnd(32, '0');
  }
  const roomFor = async (code, pass) => 'kr-' + (await sha('room|' + code + '|' + pass)).slice(0, 40);
  const docFor = async (code, pass) => 'games/' + (await sha('save|' + code + '|' + pass)).slice(0, 40);
  async function keyFor(code, pass) {
    const base = await crypto.subtle.importKey('raw', te.encode('kr|' + code + '|' + pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: te.encode('kingdom-rising-' + code), iterations: 100000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
  async function seal(obj, code, pass) {
    const json = JSON.stringify(obj);
    if (!crypto.subtle) return { plain: json };
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(code, pass), te.encode(json));
    return { iv: b64(iv), box: b64(new Uint8Array(ct)) };
  }
  async function unseal(d, code, pass) {
    if (d.plain) return JSON.parse(d.plain);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(d.iv) }, await keyFor(code, pass), unb64(d.box));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  // ---------- the shared save ----------
  O.loadShared = async function (code, pass) {
    const db = Sys.Store.db; if (!db) return null;
    const s = await Sys.withTimeout(db.doc(await docFor(code, pass)).get(), 6000);
    if (!s || !s.exists) return null;
    try { return await unseal(s.data(), code, pass); } catch (e) { return null; }
  };
  O.saveShared = function () {
    if (O.mode !== 'host' || !Sys.Store.db) return;
    const a = G.account; a.clock = Math.round(G.clock);
    const save = { name: O.name, world: pick(a, HOST_KEYS), updated: Date.now() }; // taken now, before any await
    const { code, pass } = O; O.lastShared = Date.now();
    (async () => { try { await Sys.Store.db.doc(await docFor(code, pass)).set(Object.assign({ v: 1, updated: save.updated }, await seal(save, code, pass))); } catch (e) { console.warn('hosted save', e); } })();
  };
  O.freshWorld = function () {
    const def = Sys.defaultAccount(); for (const f of D.FACTION_IDS) def.cities[f].built = 0;
    return { cities: def.cities, war: {}, seed: def.seed, worldV: 4, clock: 9 * 60, rivalT: 0, day: 0 };
  };

  // ---------- swapping the active world in and out of the account ----------
  // the player's own single-player world waits in a._solo and is what gets saved to their account
  function useWorld(keys, world) {
    const a = G.account;
    if (!a._solo) { a._solo = pick(a, keys); a._soloKeys = keys; }
    else for (const k of keys) if (!a._soloKeys.includes(k)) { a._solo[k] = clone(a[k]); a._soloKeys = a._soloKeys.concat(k); }
    for (const k of keys) { if (world[k] !== undefined) a[k] = clone(world[k]); else delete a[k]; }
    for (const f of D.FACTION_IDS) if (!a.cities[f]) a.cities[f] = { level: 1, status: 0, built: 0 };
  }
  O.restoreSolo = function () {
    const a = G.account; if (!a || !a._solo) return;
    for (const k of a._soloKeys) delete a[k];
    Object.assign(a, a._solo); delete a._solo; delete a._soloKeys;
  };
  Sys.persistable = function (a) {
    const o = clone(a);
    if (a._solo) { for (const k of a._soloKeys) delete o[k]; Object.assign(o, clone(a._solo)); }
    delete o._solo; delete o._soloKeys;
    return o;
  };
  O.remember = function (code, pass, name) {
    const a = G.account; a.games = (a.games || []).filter((g) => g.code !== code);
    a.games.unshift({ code, pass, name: String(name || '').slice(0, 40), t: Date.now() }); a.games = a.games.slice(0, 8);
    Sys.saveAccount(true);
  };

  // ---------- rooms ----------
  function snapshot() {
    const a = G.account; const cities = {};
    for (const f of D.FACTION_IDS) { const c = a.cities[f]; cities[f] = { level: c.level, status: c.status, built: c.built || 0 }; }
    return { host: true, code: O.code, name: O.name, cities, clock: Math.round(G.clock), day: a.day || 0, seed: a.seed, worldV: a.worldV };
  }
  O.sendWorld = function () { if (O.mode !== 'host' || !O.room) return; O.lastWorld = Date.now(); O.room.emit('world', snapshot()).catch(() => {}); };
  O.advertise = function () {
    if (!O.lobby) return; O.lastAd = Date.now();
    if (O.mode !== 'host') { O.lobby.presence({ host: null }).catch(() => {}); return; }
    const a = G.account, p = G.player;
    const n = 1 + (O.room ? O.room.peers().filter((x) => !x.isMe && x.presence && x.presence.n).length : 0);
    O.lobby.presence({ host: { code: O.code, name: String(O.name).slice(0, 40), hero: p ? p.c.name : '', lock: O.pass ? 1 : 0, lv: D.FACTION_IDS.map((f) => a.cities[f].level), n } }).catch(() => {});
  };
  O.listHosts = function () {
    if (!O.lobby) return [];
    return O.lobby.peers().filter((p) => !p.isMe && p.presence && p.presence.host && p.presence.host.code).map((p) => p.presence.host);
  };
  function myPeer(room) { const me = room.peers().find((p) => p.isMe && p.sameTab); return me ? me.peer : null; }
  function bind(room) {
    room.on('hello', () => { if (O.mode === 'host' && Date.now() - (O.lastHello || 0) > 400) { O.lastHello = Date.now(); O.sendWorld(); } });
    room.on('op', (m) => { if (O.mode === 'host' && !m.isMe) applyOp(m.data || {}); });
    room.on('world', (m) => {
      if (O.mode !== 'join' || m.isMe || !m.data || !m.data.host) return;
      if (!O.hostPeer) { O.hostPeer = m.peer; clearTimeout(O.electT); toast('A new host has taken over', 'The game goes on.'); }
      if (m.peer === O.hostPeer) applyWorld(m.data);
    });
    room.onPeers((ch) => {
      if (O.mode === 'join' && O.hostPeer && ch.left.some((p) => p.peer === O.hostPeer)) hostLeft();
      if (O.mode === 'host' && (ch.joined.length || ch.left.length)) O.advertise();
    });
  }
  async function enterRoom(code, pass) {
    const lobby = await O.getLobby();
    if (!lobby) throw new Error('Multiplayer only works in the claude.ai version of the game.');
    let room;
    try { room = await lobby.join(await roomFor(code, pass)); } catch (e) { throw new Error('Could not open the game room (' + (e && e.code || 'error') + '). Try again in a moment.'); }
    for (let i = 0; i < 20 && !room.connected(); i++) await wait(150);
    return room;
  }
  // ask the room for its host; resolves with the first answer or null
  function findHost(room, ms) {
    return new Promise((res) => {
      let done = false; const stop = (v) => { if (done) return; done = true; off(); clearInterval(iv); clearTimeout(to); res(v); };
      const off = room.on('world', (m) => { if (!m.isMe && m.data && m.data.host) stop({ peer: m.peer, data: m.data }); });
      const ask = () => room.emit('hello', {}).catch(() => {});
      const iv = setInterval(ask, 1200); const to = setTimeout(() => stop(null), ms); ask();
    });
  }

  // ---------- host ----------
  // opts: {code, pass, name, fresh}
  O.host = async function (opts) {
    const code = O.cleanCode(opts.code) || O.newCode(), pass = String(opts.pass || '');
    if (!Sys.Store.db) throw new Error('Hosting needs you to be signed in to claude.ai, so the game can be saved.');
    const room = await enterRoom(code, pass);
    const other = await findHost(room, 2500);
    if (other) { room.leave().catch(() => {}); throw new Error(`"${other.data.name || code}" already has a host. Join it instead.`); }
    let save = null;
    if (!opts.fresh) { save = await O.loadShared(code, pass); if (!save) { room.leave().catch(() => {}); throw new Error('No saved game matches that code and password.'); } }
    const name = String(opts.name || (save && save.name) || 'Kingdom Rising game').slice(0, 40);
    O.room = room; O.code = code; O.pass = pass; O.name = name; O.mode = 'host'; O.hostPeer = null;
    bind(room);
    useWorld(HOST_KEYS, save ? save.world : O.freshWorld());
    O.remember(code, pass, name);
    O.saveShared(); O.advertise(); O.sendWorld();
    return code;
  };

  // ---------- join ----------
  O.join = async function (codeIn, passIn) {
    const code = O.cleanCode(codeIn), pass = String(passIn || '');
    if (!code) throw new Error('Enter the game code.');
    const room = await enterRoom(code, pass);
    const host = await findHost(room, 9000);
    if (!host) { room.leave().catch(() => {}); throw new Error('No host answered. Check the code and password, and that the host is in the game.'); }
    O.room = room; O.code = code; O.pass = pass; O.name = String(host.data.name || code).slice(0, 40); O.mode = 'join'; O.hostPeer = host.peer;
    bind(room);
    O.lastSnap = host.data;
    useWorld(JOIN_KEYS, worldFromSnap(host.data));
    O.remember(code, pass, O.name);
    return code;
  };
  function worldFromSnap(d) {
    const cities = {};
    for (const f of D.FACTION_IDS) { const s = (d.cities && d.cities[f]) || {}; cities[f] = { level: int(s.level, 1, 5), status: Math.max(0, +s.status || 0), built: int(s.built, 0, 5) }; }
    return { cities, seed: Number.isFinite(+d.seed) ? +d.seed : G.account.seed, worldV: 4, clock: int(d.clock, 0, 1439), day: int(d.day, 0, 1e6) };
  }
  function applyWorld(d) {
    O.lastSnap = d;
    const a = G.account; const w = worldFromSnap(d);
    for (const f of D.FACTION_IDS) {
      const c = a.cities[f], s = w.cities[f]; const old = c.level;
      c.level = s.level; c.status = s.status; c.built = s.built;
      if (G.player && c.level !== old) Sys.cityChanged(f, c.level > old);
    }
    if (G.player) { const diff = Math.abs(w.clock - G.clock); if (diff > 3 && diff < 1437) G.clock = w.clock; }
    a.day = w.day;
    KR.UI && KR.UI.refresh && KR.UI.refresh();
  }
  // the host is gone: the player whose peer label sorts first takes over, everyone else waits for them
  function hostLeft() {
    O.hostPeer = null; clearTimeout(O.electT);
    G.log && G.log('The host has left the game. Finding a new host...', 'sys', '#ffb24a');
    setTimeout(() => {
      if (O.mode !== 'join' || O.hostPeer) return;
      const me = myPeer(O.room);
      const live = O.room.peers().filter((p) => p.presence && p.presence.n).map((p) => p.peer).sort();
      if (me && live[0] === me) O.takeOver();
      else O.electT = setTimeout(() => { if (O.mode === 'join' && !O.hostPeer) { toast('The host has left', 'Nobody took over, so the game has ended.'); KR.Main.exitToMenu(); } }, 12000);
    }, 1500);
  }
  O.takeOver = async function () {
    const save = await O.loadShared(O.code, O.pass);
    const world = save ? save.world : Object.assign(O.freshWorld(), worldFromSnap(O.lastSnap || {}));
    if (O.lastSnap) { const s = worldFromSnap(O.lastSnap); world.cities = s.cities; world.clock = Math.round(G.clock); world.day = s.day; }
    if (save && save.name) O.name = save.name;
    O.restoreSolo(); useWorld(HOST_KEYS, world); O.mode = 'host';
    try { KR.War && KR.War.updateRivalAvatar && KR.War.updateRivalAvatar(); } catch (e) {}
    O.saveShared(); O.sendWorld(); O.advertise();
    G.log('You are now the host. The game is saved for everyone as you play.', 'status', '#ffd84a');
    toast('You are now the host', 'Others can keep playing in your world.');
  };

  // ---------- leaving ----------
  O.exit = function () {
    if (O.mode === 'solo') return;
    const room = O.room;
    if (O.mode === 'host') O.saveShared();
    O.mode = 'solo'; O.room = null; O.hostPeer = null; O.lastSnap = null; clearTimeout(O.electT);
    O.advertise();
    O.restoreSolo();
    const N = Sys.Net; N.room = null; N.ok = false; N.peers = [];
    if (room) room.leave().catch(() => {});
  };

  // ---------- the host applies what joiners send ----------
  function applyOp(d) {
    const f = d.f; if (!D.FACTION_IDS.includes(f)) return;
    const who = String(d.who || 'A player').slice(0, 24);
    const a = G.account, c = a.cities[f];
    if (d.t === 'status') { const n = int(d.n, 0, 1000); if (!n) return; O.applying = true; try { Sys.addStatus(f, n, `${String(d.why || 'deeds').slice(0, 60)} (${who})`); } finally { O.applying = false; } }
    else if (d.t === 'built') { c.built = Math.max(c.built || 0, int(d.tier, 1, 4)); KR.Kingdom.checkRise(f); }
    else if (d.t === 'kingfall') { if (c.level > 1) { c.level--; c.status = Math.min(c.status, D.CITY_THRESHOLDS[c.level - 1] || 0); Sys.cityChanged(f, false); } G.log(`${who} has slain the king of ${D.FACTIONS[f].city}!`, 'status', '#ff9a6a'); }
    else if (d.t === 'newage') { if (KR.War && KR.War.newAge) KR.War.newAge(); }
    else return;
    O.sendWorld(); Sys.saveAccount();
  }
  const sendOp = (op) => { if (O.room) O.room.emit('op', Object.assign({ who: G.player ? G.player.c.name : '' }, op)).catch(() => {}); };

  // ---------- hooks into the game ----------
  const addStatus0 = Sys.addStatus;
  Sys.addStatus = function (f, n, why) {
    if (O.mode !== 'join' || O.applying) return addStatus0.apply(this, arguments);
    if (O.silent || !n) return;
    sendOp({ t: 'status', f, n, why: why || '' });
    if (G.player && G.player.c.faction === f) G.log(`+${n} status for ${D.FACTIONS[f].city}${why ? ' for ' + why : ''}.`, 'status', '#f0c75e');
  };
  const turnIn0 = Sys.turnIn;
  Sys.turnIn = function (q) {
    if (O.mode === 'join' && q && q.type === 'build' && Sys.questComplete(q)) sendOp({ t: 'built', f: G.player.c.faction, tier: q.tier });
    return turnIn0.apply(this, arguments);
  };
  const kingSlain0 = Sys.kingSlain;
  Sys.kingSlain = function (k, killer) { if (O.mode === 'join' && k && D.FACTION_IDS.includes(k.faction) && !(killer && killer.raider)) sendOp({ t: 'kingfall', f: k.faction }); return kingSlain0.apply(this, arguments); };
  // a joiner's own war parties are only seen on their screen; the host's war decides the kingdoms
  const byWar0 = Sys.kingSlainByWar;
  Sys.kingSlainByWar = function () { if (O.mode !== 'join') return byWar0.apply(this, arguments); O.silent = true; try { return byWar0.apply(this, arguments); } finally { O.silent = false; } };
  const cityChanged0 = Sys.cityChanged;
  Sys.cityChanged = function () { const r = cityChanged0.apply(this, arguments); if (O.mode === 'host') { clearTimeout(O.cityT); O.cityT = setTimeout(() => { O.sendWorld(); O.advertise(); }, 50); } return r; };
  if (KR.War && KR.War.newAge) { const newAge0 = KR.War.newAge; KR.War.newAge = function () { if (O.mode === 'join') sendOp({ t: 'newage', f: G.player ? G.player.c.faction : D.FACTION_IDS[0] }); const r = newAge0.apply(this, arguments); if (O.mode === 'host') O.sendWorld(); return r; }; }
  const saveAccount0 = Sys.saveAccount;
  Sys.saveAccount = function (force) { const r = saveAccount0.apply(this, arguments); if (O.mode === 'host' && (force || Date.now() - (O.lastShared || 0) > 30000)) O.saveShared(); return r; };
  // the host keeps everyone in step: the world every few seconds, the lobby listing every so often
  O.tick = function () {
    if (O.mode !== 'host') return; const now = Date.now();
    if (now - (O.lastWorld || 0) > 4000) O.sendWorld();
    if (now - (O.lastAd || 0) > 10000) O.advertise();
    if (now - (O.lastShared || 0) > 30000) O.saveShared();
  };
})();

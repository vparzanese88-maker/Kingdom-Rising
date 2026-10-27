// Kingdom Rising — multiplayer anywhere the game is hosted (GitHub Pages, itch.io, your own site)
// Outside claude.ai there is no built-in room service, so this file gives the game the same room
// API (join, presence, peers, on, emit, leave) over free public MQTT brokers on secure websockets.
// Every client connects to all the brokers it can reach and sends each message through each of
// them, so players always meet even if one broker is down; copies are dropped on arrival.
// A shared game save is kept as a retained message on the brokers and in the host's browser.
// Use your own broker by adding ?relay=wss://your.broker/mqtt (comma separated for several),
// or by setting window.KR_RELAYS = ['wss://...'] before this file loads.
(function () {
  const KR = window.KR;
  if (window.claude && window.claude.use) return; // claude.ai provides its own rooms
  if (typeof WebSocket === 'undefined' || typeof TextEncoder === 'undefined') return;
  const qs = new URLSearchParams(location.search);
  const BROKERS = (qs.get('relay') ? qs.get('relay').split(',') : window.KR_RELAYS || ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt']).map((s) => s.trim()).filter(Boolean);
  const NS = 'kingdomrising/v1/';
  const HEARTBEAT = 3000, PEER_TIMEOUT = 25000, KEEPALIVE = 60;
  const te = new TextEncoder(), td = new TextDecoder();
  const rid = (n) => { const s = 'abcdefghijkmnopqrstuvwxyz23456789'; let o = ''; const r = crypto.getRandomValues(new Uint8Array(n)); for (const x of r) o += s[x % s.length]; return o; };
  const safe = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);

  // ---------- a minimal MQTT 3.1.1 client (QoS 0) over one websocket ----------
  function str(s) { const b = te.encode(s); const o = new Uint8Array(b.length + 2); o[0] = b.length >> 8; o[1] = b.length & 255; o.set(b, 2); return o; }
  function cat(parts) { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let i = 0; for (const p of parts) { o.set(p, i); i += p.length; } return o; }
  function packet(type, body) {
    const len = []; let x = body.length; do { let d = x % 128; x = Math.floor(x / 128); if (x > 0) d |= 128; len.push(d); } while (x > 0);
    return cat([new Uint8Array([type]), new Uint8Array(len), body]);
  }
  class Mqtt {
    constructor(url, will) { this.url = url; this.will = will; this.ok = false; this.subs = new Set(); this.onmsg = null; this.onstate = null; this.buf = new Uint8Array(0); this.pid = 1; this.closed = false; this.tries = 0; this.open(); }
    open() {
      if (this.closed) return;
      let ws; try { ws = new WebSocket(this.url, 'mqtt'); } catch (e) { return this.retry(); }
      ws.binaryType = 'arraybuffer'; this.ws = ws;
      ws.onopen = () => {
        const flags = 0x02 | (this.will ? 0x04 : 0);
        const parts = [str('MQTT'), new Uint8Array([4, flags, KEEPALIVE >> 8, KEEPALIVE & 255]), str('kr' + rid(14))];
        if (this.will) { parts.push(str(this.will.topic)); const p = te.encode(this.will.payload); parts.push(new Uint8Array([p.length >> 8, p.length & 255]), p); }
        ws.send(packet(0x10, cat(parts)));
      };
      ws.onmessage = (ev) => { this.buf = cat([this.buf, new Uint8Array(ev.data)]); this.parse(); };
      ws.onclose = ws.onerror = () => { if (this.ws !== ws) return; this.ws = null; const was = this.ok; this.ok = false; clearInterval(this.ping); if (was && this.onstate) this.onstate(false); this.retry(); };
    }
    retry() { if (this.closed) return; this.tries++; clearTimeout(this.rt); this.rt = setTimeout(() => this.open(), Math.min(30000, 1000 * 2 ** Math.min(this.tries, 5))); }
    parse() {
      for (;;) {
        const b = this.buf; if (b.length < 2) return;
        let mul = 1, len = 0, i = 1, d;
        do { if (i >= b.length) return; d = b[i++]; len += (d & 127) * mul; mul *= 128; } while (d & 128);
        if (b.length < i + len) return;
        const type = b[0] >> 4, body = b.subarray(i, i + len); this.buf = b.slice(i + len);
        if (type === 2) { // CONNACK
          if (body[1] !== 0) { this.ws.close(); continue; }
          this.ok = true; this.tries = 0;
          for (const t of this.subs) this.sendSub(t);
          clearInterval(this.ping); this.ping = setInterval(() => this.raw(new Uint8Array([0xc0, 0])), (KEEPALIVE * 1000) / 2);
          if (this.onstate) this.onstate(true);
        } else if (type === 3) { // PUBLISH
          const tl = (body[0] << 8) | body[1]; const topic = td.decode(body.subarray(2, 2 + tl));
          let j = 2 + tl; if ((b[0] >> 1) & 3) j += 2; // packet id for QoS > 0
          if (this.onmsg) this.onmsg(topic, body.subarray(j), !!(b[0] & 1));
        }
      }
    }
    raw(p) { if (this.ws && this.ws.readyState === 1) try { this.ws.send(p); } catch (e) {} }
    sendSub(t) { const id = this.pid = (this.pid % 65000) + 1; this.raw(packet(0x82, cat([new Uint8Array([id >> 8, id & 255]), str(t), new Uint8Array([0])]))); }
    sub(t) { this.subs.add(t); if (this.ok) this.sendSub(t); }
    unsub(t) { if (!this.subs.delete(t) || !this.ok) return; const id = this.pid = (this.pid % 65000) + 1; this.raw(packet(0xa2, cat([new Uint8Array([id >> 8, id & 255]), str(t)]))); }
    pub(topic, payload, retain) { if (!this.ok) return false; const p = typeof payload === 'string' ? te.encode(payload) : payload; this.raw(packet(0x30 | (retain ? 1 : 0), cat([str(topic), p]))); return true; }
    close() { this.closed = true; clearTimeout(this.rt); clearInterval(this.ping); if (this.ws) { this.raw(new Uint8Array([0xe0, 0])); try { this.ws.close(); } catch (e) {} } this.ws = null; this.ok = false; }
  }

  // ---------- a room: presence and events between everyone who joined the same name ----------
  class Room {
    constructor(name) {
      this.base = NS + safe(name) + '/'; this.me = rid(10); this.seq = 0; this.state = {}; this.peerMap = new Map(); this.handlers = new Map(); this.peerFns = new Set(); this.seen = new Map(); this.left = false; this.lastPub = 0; this.stats = { in: 0, p: 0, e: 0, dup: 0, out: 0 };
      const will = { topic: this.base + 'p/' + this.me, payload: JSON.stringify({ p: this.me, bye: 1 }) };
      this.conns = BROKERS.map((u) => { const c = new Mqtt(u, will); c.sub(this.base + '#'); c.onmsg = (t, d) => this.recv(t, d); c.onstate = (up) => { if (up) { this.sendState(true); this.publish('e/_who', { k: 'e', t: '_who', d: 0 }); } }; return c; });
      this.hb = setInterval(() => this.beat(), 1000);
    }
    connected() { return this.conns.some((c) => c.ok); }
    publish(sub, obj) { obj.p = this.me; obj.s = ++this.seq; const s = JSON.stringify(obj); let any = false; this.stats.out++; for (const c of this.conns) any = c.pub(this.base + sub, s) || any; return any; }
    dup(p, s) { let set = this.seen.get(p); if (!set) this.seen.set(p, (set = new Set())); if (set.has(s)) return true; set.add(s); if (set.size > 300) { const it = set.values(); for (let i = 0; i < 100; i++) set.delete(it.next().value); } return false; }
    recv(topic, data) {
      if (this.left) return; let m; try { m = JSON.parse(td.decode(data)); } catch (e) { return; }
      if (!m || typeof m.p !== 'string') return; this.stats.in++;
      if (m.bye) { if (m.p !== this.me) this.drop(m.p); return; }
      if (typeof m.s !== 'number' || this.dup(m.p, m.s)) { this.stats.dup++; return; }
      const isMe = m.p === this.me;
      if (m.k === 'p') { this.stats.p++;
        if (isMe) return; const now = Date.now(); const old = this.peerMap.get(m.p);
        this.peerMap.set(m.p, { peer: m.p, presence: m.d || {}, updatedAt: now, isMe: false });
        this.changed(old ? [] : [m.p], []);
      } else if (m.k === 'e') {
        if (m.t === '_who') { if (!isMe) this.sendState(true); return; }
        const fns = this.handlers.get(m.t); if (!fns) return;
        const msg = { peer: m.p, isMe, data: m.d, topic: m.t, at: Date.now() };
        for (const fn of [...fns]) try { fn(msg); } catch (e) { console.warn(e); }
      }
    }
    drop(p) { if (this.peerMap.delete(p)) this.changed([], [p]); }
    changed(joined, left) {
      if (!this.peerFns.size) return;
      const peers = this.peers(); const ch = { peers, joined: peers.filter((x) => joined.includes(x.peer)), left: left.map((p) => ({ peer: p })) };
      for (const fn of [...this.peerFns]) try { fn(ch); } catch (e) { console.warn(e); }
    }
    beat() {
      const now = Date.now();
      for (const [p, x] of this.peerMap) if (now - x.updatedAt > PEER_TIMEOUT) this.drop(p);
      if (now - this.lastPub > HEARTBEAT) this.sendState(true);
    }
    hasState() { for (const k in this.state) if (this.state[k] != null) return true; return false; }
    sendState(force) {
      const now = Date.now();
      if (!force && now - this.lastPub < 100) { clearTimeout(this.lateT); this.lateT = setTimeout(() => this.sendState(true), 110); return; }
      if (!this.hasState() && !this.wasActive) return;
      this.wasActive = this.hasState(); this.lastPub = now;
      this.publish('p/' + this.me, { k: 'p', d: this.state });
    }
    // ---- the room API the game uses ----
    peers() { return [{ peer: this.me, isMe: true, sameTab: true, presence: this.state, updatedAt: Date.now() }].concat([...this.peerMap.values()]); }
    presence(obj) { Object.assign(this.state, obj || {}); this.sendState(false); return Promise.resolve(); }
    on(topic, fn) { let s = this.handlers.get(topic); if (!s) this.handlers.set(topic, (s = new Set())); s.add(fn); return () => s.delete(fn); }
    onPeers(fn) { this.peerFns.add(fn); return () => this.peerFns.delete(fn); }
    emit(topic, data) { return this.publish('e/' + safe(topic), { k: 'e', t: topic, d: data === undefined ? null : data }) ? Promise.resolve() : Promise.reject(new Error('offline')); }
    leave() {
      if (this.left) return Promise.resolve(); this.left = true; clearInterval(this.hb); clearTimeout(this.lateT);
      const bye = JSON.stringify({ p: this.me, bye: 1 });
      for (const c of this.conns) c.pub(this.base + 'p/' + this.me, bye);
      setTimeout(() => { for (const c of this.conns) c.close(); }, 200);
      this.handlers.clear(); this.peerFns.clear(); return Promise.resolve();
    }
  }
  async function openRoom(name) {
    const r = new Room(name);
    for (let i = 0; i < 40 && !r.connected(); i++) await new Promise((res) => setTimeout(res, 150));
    if (!r.connected()) { r.leave(); const e = new Error('Could not reach the multiplayer servers. Check your internet connection.'); e.code = 'offline'; throw e; }
    return r;
  }

  // ---------- shared saves: retained messages on the brokers, plus a copy in this browser ----------
  const LSK = 'kr_shared_';
  const lsGet = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let saveConns = null;
  function saveLinks() { if (!saveConns) saveConns = BROKERS.map((u) => new Mqtt(u, null)); return saveConns; }
  function fetchRetained(topic, ms) {
    return new Promise((res) => {
      const cs = saveLinks(); let best = null, done = false, got = 0;
      const finish = () => { if (done) return; done = true; clearTimeout(to); for (const c of cs) { c.unsub(topic); c.onmsg = null; } res(best); };
      const to = setTimeout(finish, ms);
      for (const c of cs) {
        c.onmsg = (t, d) => { if (t !== topic) return; try { const v = JSON.parse(td.decode(d)); if (v && (!best || (v.updated || 0) > (best.updated || 0))) best = v; } catch (e) {} if (++got >= cs.length) setTimeout(finish, 300); };
        c.sub(topic);
      }
    });
  }
  const db = {
    doc(id) {
      const topic = NS + 'save/' + safe(id), key = LSK + safe(id);
      return {
        async get() {
          const local = lsGet(key); const remote = await fetchRetained(topic, 3500);
          const v = remote && (!local || (remote.updated || 0) >= (local.updated || 0)) ? remote : local;
          return { exists: !!v, data: () => v };
        },
        async set(v) {
          lsSet(key, v); const s = JSON.stringify(v);
          const cs = saveLinks(); for (let i = 0; i < 30 && !cs.some((c) => c.ok); i++) await new Promise((r) => setTimeout(r, 150));
          for (const c of cs) c.pub(topic, s, true);
        },
      };
    },
  };

  let lobby = null;
  KR.Relay = {
    brokers: BROKERS, db,
    lobby: async () => { if (lobby && !lobby.left) return lobby; const r = await openRoom('lobby'); r.join = (name) => openRoom(name); lobby = r; return r; },
  };
})();

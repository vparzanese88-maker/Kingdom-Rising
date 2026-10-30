// Online play with no game server: browsers connect straight to each other (WebRTC via PeerJS). The free
// public PeerJS broker only introduces them by a 4-letter code. The host relays every message to everyone
// else, so each player talks to the host only (up to 7 friends).
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ', PREFIX = 'aew-', MAX = 7;
const newCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');

export class Net {
  constructor() { this.role = null; this.id = null; this.code = null; this.h = {}; this.peer = null; this.conns = new Map(); this.conn = null; }
  static available() { return !!(window.peerjs && window.peerjs.Peer && window.RTCPeerConnection); }
  on(ev, fn) { this.h[ev] = fn; }
  emit(ev, ...a) { if (this.h[ev]) this.h[ev](...a); }

  host(tries = 0) {
    this.role = 'host';
    const code = newCode();
    const peer = this.peer = new window.peerjs.Peer(PREFIX + code, { debug: 0 });
    let opened = false;
    const timer = setTimeout(() => { if (!opened) { this.emit('error', 'Could not reach the matchmaking service. Check your connection and try again.'); this.close(); } }, 12000);
    peer.on('open', () => { opened = true; clearTimeout(timer); this.code = code; this.id = 0; this.emit('ready', { code, id: 0 }); });
    peer.on('connection', conn => this.accept(conn));
    peer.on('error', e => {
      if (!opened && e.type === 'unavailable-id' && tries < 6) { clearTimeout(timer); peer.destroy(); this.host(tries + 1); return; }
      if (!opened) { clearTimeout(timer); this.emit('error', 'Could not reach the matchmaking service. Check your connection and try again.'); }
    });
  }
  accept(conn) {
    let id = null;
    conn.on('data', m => {
      if (!m) return;
      if (m.t === 'hello' && id === null) {
        for (let i = 1; i <= MAX; i++) if (!this.conns.has(i)) { id = i; break; }
        if (id === null) { try { conn.send({ t: 'error', msg: 'That game is full.' }); } catch (e) { /* closed */ } setTimeout(() => conn.close(), 300); return; }
        this.conns.set(id, conn);
        conn.send({ t: 'joined', code: this.code, id });
        this.emit('join', id);
      } else if (m.t === 'up' && id !== null) {
        // relay to everyone else, then handle it here
        for (const [cid, c] of this.conns) if (cid !== id && c.open) c.send({ t: 'd', from: id, d: m.d });
        this.emit('data', id, m.d);
      }
    });
    const gone = () => { if (id !== null && this.conns.get(id) === conn) { this.conns.delete(id); this.emit('leave', id); for (const c of this.conns.values()) if (c.open) c.send({ t: 'left', id }); } };
    conn.on('close', gone); conn.on('error', gone);
  }
  join(code) {
    this.role = 'client'; this.code = code;
    let done = false;
    const fail = msg => { if (!done) { done = true; this.emit('error', msg); this.close(); } };
    const peer = this.peer = new window.peerjs.Peer(undefined, { debug: 0 });
    const timer = setTimeout(() => fail(`Could not connect to game ${code}. Check the code, or ask the host to try again.`), 25000);
    peer.on('open', () => {
      const conn = this.conn = peer.connect(PREFIX + code, { reliable: true });
      conn.on('open', () => conn.send({ t: 'hello' }));
      conn.on('data', m => {
        if (!m) return;
        if (m.t === 'joined') { clearTimeout(timer); done = true; this.id = m.id; this.emit('ready', { code: m.code, id: m.id }); }
        else if (m.t === 'error') { clearTimeout(timer); fail(m.msg); }
        else if (m.t === 'd') this.emit('data', m.from, m.d);
        else if (m.t === 'left') this.emit('leave', m.id);
      });
      conn.on('close', () => { if (done) this.emit('hostleft'); else { clearTimeout(timer); fail(`No game found with code ${code}.`); } });
    });
    peer.on('error', e => { clearTimeout(timer); fail(e.type === 'peer-unavailable' ? `No game found with code ${code}.` : 'Could not reach the matchmaking service. Check your connection and try again.'); });
  }
  // to everyone else in the game
  send(d) {
    if (this.role === 'host') { for (const c of this.conns.values()) if (c.open) c.send({ t: 'd', from: 0, d }); }
    else if (this.conn && this.conn.open) this.conn.send({ t: 'up', d });
  }
  count() { return this.role === 'host' ? this.conns.size + 1 : null; }
  close() { if (this.peer) { try { this.peer.destroy(); } catch (e) { /* ignore */ } } this.peer = null; }
}

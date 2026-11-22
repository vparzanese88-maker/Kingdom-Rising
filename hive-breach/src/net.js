// Online co-op. The host runs the battle; friends send where they are and what they do, and get the battle back ten times a second.
// ?net=loop uses a BroadcastChannel instead, to test with two tabs on one computer.
const PRE = 'hivebreach-';
export const VER = 1;      // bump when the messages change
export class Net {
  constructor(onMsg, onStatus) { this.onMsg = onMsg; this.onStatus = onStatus; this.on = false; this.isHost = false; this.conns = []; this.loop = new URLSearchParams(location.search).get('net') === 'loop'; this.id = Math.random().toString(36).slice(2, 9); }
  code5() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 5; i++) s += a[Math.random() * a.length | 0]; return s; }
  host() {
    this.code = this.code5(); this.isHost = true; this.on = true;
    if (this.loop) { this.bc = new BroadcastChannel(PRE + this.code); this.bc.onmessage = e => this.recv(e.data); this.onStatus('Hosting (test mode). Code: ' + this.code); return this.code; }
    if (!window.Peer) { this.onStatus('Online play could not load. Check your internet connection.'); this.on = false; return ''; }
    this.peer = new window.Peer(PRE + this.code);
    this.peer.on('open', () => this.onStatus('Hosting. Tell your friends the code: ' + this.code));
    this.peer.on('connection', c => { this.conns.push(c); c.on('data', d => this.recv(d, c)); c.on('close', () => { this.conns = this.conns.filter(x => x !== c); if (c.pid) this.onMsg({ t: 'bye', from: c.pid }); }); });
    this.peer.on('error', e => this.onStatus(e.type === 'unavailable-id' ? 'That code is taken. Host again.' : 'Connection problem: ' + e.type));
    return this.code;
  }
  join(code, onOpen) {
    this.code = (code || '').toUpperCase().trim(); if (!this.code) return; this.isHost = false; this.on = true; this.onStatus('Joining ' + this.code + '...');
    if (this.loop) { this.bc = new BroadcastChannel(PRE + this.code); this.bc.onmessage = e => this.recv(e.data); setTimeout(onOpen, 100); return; }
    if (!window.Peer) { this.onStatus('Online play could not load. Check your internet connection.'); this.on = false; return; }
    this.peer = new window.Peer();
    this.peer.on('open', () => { const c = this.peer.connect(PRE + this.code, { reliable: true }); this.conns = [c]; c.on('open', () => { this.onStatus('Connected to ' + this.code); onOpen(); }); c.on('data', d => this.recv(d, c)); c.on('close', () => this.onStatus('The host left the game.')); });
    this.peer.on('error', e => this.onStatus(e.type === 'peer-unavailable' ? 'No game found with code ' + this.code + '. Check the code with your friend.' : 'Connection problem: ' + e.type));
  }
  send(m) { if (!this.on) return; m.from = this.id; if (this.bc) { m.h = this.isHost ? 1 : 0; this.bc.postMessage(m); return; } for (const c of this.conns) if (c.open) c.send(m); }
  recv(m, c) {
    if (!m || m.from === this.id) return;
    if (this.bc) { if (this.isHost === !!m.h) return; }       // in test mode everyone hears everyone: hosts listen to friends and friends to the host
    if (c && this.isHost) c.pid = m.from;
    this.onMsg(m);
  }
}

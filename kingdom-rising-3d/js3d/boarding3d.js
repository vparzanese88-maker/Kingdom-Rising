// Kingdom Rising 3D — jumping aboard your kingdom's warships, and over the side again (js/warmarch.js naval ride).
// Space close to one of your ships, facing her, and you leap from the quay (or climb out of the water) onto her deck,
// landing where you aimed. Aboard, Space at her rail facing out jumps you over the side: onto the pier if it is there,
// else into the sea (only in harbour, off the enemy coast, or near enough to land to swim for it).
// The leap carries you across in an arc from the height you jumped from to the height you land at (K3.leapY).
import { K3, PX } from './core.js';
import { geo } from './geo.js';
import { view } from './camera.js';
import { JUMP_T } from './actors.js';

const KR = window.KR, G = KR.G, W = KR.W, T = KR.T, Main = (KR.Main = KR.Main || {});
const R = () => KR.War && KR.War.naval && KR.War.naval.ride;
const REACH = 150; // how far you can leap, in pixels (7.5 m with a run up), to the deck you land on
const sfx = (n, v) => { try { KR.A.sfx(n, v); } catch (e) {} };
const fwd = () => [-Math.sin(view.yaw), -Math.cos(view.yaw)]; // the way you face, in map pixels
const local = (s, x, y) => { const h = s.heading || 0, ch = Math.cos(h), sh = Math.sin(h), dx = x - s.x, dy = y - s.y; return [dx * ch + dy * sh, -dx * sh + dy * ch]; };
const localDir = (s, fx, fy) => { const h = s.heading || 0, ch = Math.cos(h), sh = Math.sin(h); return [fx * ch + fy * sh, -fx * sh + fy * ch]; };
const floorHere = (x, y) => { const f = geo.floorAt(x, y); const wl = geo.waterAt ? geo.waterAt(x, y) : NaN; return isNaN(wl) ? f : Math.max(f, wl - 0.9); };

// where on her deck a leap from here would land, or null if she is out of reach or not in front of you
function landing(s) {
  const r = R(); const p = G.player; if (!r || !p || !r.canBoard(s)) return null;
  const [a, c] = local(s, p.x, p.y); const [fa, fc] = localDir(s, ...fwd());
  const to = r.clampDeck(s, a + fa * 70, c + fc * 70); const gx = to[0] - a, gy = to[1] - c, g = Math.hypot(gx, gy);
  if (g > REACH || (g > 20 && (gx * fa + gy * fc) / g < 0.45)) return null; // too far, or not the way you are facing
  return to;
}
function shipToJump() { const r = R(); const p = G.player; if (!r || !p || p.onShip) return null; let best = null; for (const s of KR.War.naval.alive(p.c.faction)) { const to = landing(s); if (to) { best = [s, to]; break; } } return best; }
// the ride prompt asks this: is she close enough to jump aboard?
const hookPrompt = () => { const r = R(); if (r && !r.jumpable) r.jumpable = (s) => !!landing(s); };

let leap = null;
function startLeap(o) { leap = Object.assign({ t: 0 }, o); K3.jumpT = 0; K3.jumpN++; sfx('whoosh', 0.35); }
// aboard from the quay or out of the water: the deck position runs from where you stood to where you land
function jumpAboard(s, to) {
  const r = R(), p = G.player; const from = local(s, p.x, p.y); const climb = !!p.swim;
  const fromY = climb ? (geo.waterAt(p.x, p.y) || 0) - 0.6 : floorHere(p.x, p.y); // measured before boarding moves you
  if (!r.board(s, { far: true, quiet: true })) return false;
  p.deckPos = from.slice();
  startLeap({ s, from, to, onto: true, fromY });
  G.log(climb ? `You haul yourself up her side onto the ${s.name}.` : `You leap aboard the ${s.name}!`, 'status', '#9ad8ff');
  return true;
}
// over the side: onto the pier if it is right there, else into the sea
function jumpOff() {
  const r = R(), p = G.player, s = p.onShip; if (!s) return false;
  const [fx, fy] = fwd(); const [fa, fc] = localDir(s, fx, fy); const dp = p.deckPos || [0, 0];
  const ahead = [dp[0] + fa * 30, dp[1] + fc * 30], cl = r.clampDeck(s, ahead[0], ahead[1]);
  if (Math.hypot(cl[0] - ahead[0], cl[1] - ahead[1]) < 8) return false; // not at her rail facing out: an ordinary hop on deck
  const tx = p.x + fx * 120, ty = p.y + fy * 120; const tt = W.tile(Math.floor(tx / KR.D.TS), Math.floor(ty / KR.D.TS));
  const dry = tt !== T.WATER && tt !== T.DEEP && !W.isBlockedTile(Math.floor(tx / KR.D.TS), Math.floor(ty / KR.D.TS));
  if (!dry && !['moor', 'siege'].includes(s.state) && !(W.swimmable && W.swimmable(Math.floor(tx / KR.D.TS), Math.floor(ty / KR.D.TS)))) { G.log('Not out here in open water: wait until she drops anchor off the coast or in harbour.', 'sys', '#ffb24a'); return true; }
  const fromY = K3.shipDeckY ? K3.shipDeckY(p) : floorHere(p.x, p.y);
  p.onShip = null; p.deckPos = null;
  startLeap({ x0: p.x, y0: p.y, x1: tx, y1: ty, onto: false, fromY, wet: !dry });
  G.log(dry ? 'You leap from her rail onto the quay.' : 'You leap over the side!', 'status', '#9ad8ff');
  return true;
}
// every frame, after the game has moved everyone: carry the hero through the air
K3.leapUpdate = function (dt) {
  hookPrompt();
  const n = leap; if (!n) { K3.leapY = 0; return; }
  const p = G.player; n.t += dt; const u = Math.min(1, n.t / JUMP_T), e = u * u * (3 - 2 * u);
  let floorNow;
  if (n.onto) {
    if (p.onShip !== n.s) { leap = null; K3.leapY = 0; return; }
    p.deckPos = [n.from[0] + (n.to[0] - n.from[0]) * e, n.from[1] + (n.to[1] - n.from[1]) * e];
    const [x, y] = R().toWorld(n.s, p.deckPos[0], p.deckPos[1]); p.x = x; p.y = y; p.moveTo = null;
    floorNow = K3.shipDeckY ? K3.shipDeckY(p) : floorHere(x, y);
  } else {
    p.x = n.x0 + (n.x1 - n.x0) * e; p.y = n.y0 + (n.y1 - n.y0) * e; p.homeX = p.x; p.homeY = p.y; p.moveTo = null;
    floorNow = floorHere(p.x, p.y);
  }
  K3.leapY = (n.fromY - floorNow) * (1 - e) + 4 * 0.55 * u * (1 - u); // from the height you left, plus a higher arc than a hop
  if (u >= 1) { leap = null; K3.leapY = 0; sfx(n.wet ? 'splash' : 'door', n.wet ? 0.8 : 0.35); }
};
K3.leaping = () => !!leap;

const jump0 = Main.jump;
Main.jump = function () {
  const p = G.player; const r = R();
  if (r && p && !p.dead && !K3.cine && !leap && K3.jumpT == null && !(p.stun > 0 || p.mez > 0 || p.root > 0)) {
    if (p.onShip) { if (jumpOff()) return; }
    else { const j = shipToJump(); if (j && jumpAboard(j[0], j[1])) return; }
  }
  return jump0.apply(this, arguments);
};

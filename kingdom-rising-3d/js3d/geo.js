// Kingdom Rising 3D — turns the 2D tile map of the current realm into heights:
// rolling land, mountains rising out of the rock tiles, lake and river beds, flat ground under
// every building and inside the city walls, bridge and dock decks, cave floors and ceilings.
import { K3, TS, TILE, PX } from './core.js';

const KR = window.KR;
export const T = KR.T;
const D = KR.D, W = KR.W;

// relief (meters of hills) per biome
const RELIEF = { hills: 7, mountain: 9, forest: 3.6, darkforest: 4.5, plains: 1.8, plains2: 2.6, grass: 3.4, swamp: 0.7, ash: 3.2, snow: 8, gloom: 3.2, volcanic: 5.5, scar: 4, desert: 4.2, ocean: 0, island: 3.4, summit: 6, citystone: 1.2, cityforest: 1.2, cityplains: 1.0, cave: 0, crypt: 0, icecave: 0, abyss: 0, sewer: 0 };
// ridged mountain ranges (0..1.2) per biome, on top of the hills
const PEAKS = { mountain: 1, snow: 1.2, summit: 0.9, volcanic: 0.7, hills: 0.32, darkforest: 0.22, gloom: 0.3, scar: 0.45, ash: 0.35 };
const MOUNTAIN = { hills: 0.8, mountain: 1.35, snow: 1.5, summit: 1.3, volcanic: 1.1, scar: 1.0, desert: 0.75, swamp: 0.6 };
// snow on the ground and on peaks (0..1) per biome
const DOCK_Y = 0.8; // a port city's ground: the level of its quay and piers, just above the sea
const SNOWY = { snow: 1, summit: 0.75, mountain: 0.35, icecave: 0.8 };

// fast value noise (own table so it is quick to call half a million times)
const P = new Uint8Array(512); { const r = K3.rng(1337); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
const RV = new Float32Array(256); { const r = K3.rng(99); for (let i = 0; i < 256; i++) RV[i] = r(); }
function vn(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const X = xi & 255, Y = yi & 255; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = RV[P[P[X] + Y]], b = RV[P[P[X + 1] + Y]], c = RV[P[P[X] + Y + 1]], d = RV[P[P[X + 1] + Y + 1]]; return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x, y, o = 4) { let t = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { t += a * vn(x * f + i * 31.7, y * f - i * 17.3); n += a; a *= 0.5; f *= 2; } return t / n; }
function ridge(x, y, o = 4) { let t = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { t += a * (1 - Math.abs(vn(x * f + i * 13.1, y * f + i * 7.7) * 2 - 1)); n += a; a *= 0.5; f *= 2; } return t / n; }
K3.fbm = fbm;

// chamfer distance transform (in tiles) from cells where src[i] is true
function distField(w, h, src) {
  const INF = 1e6, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = src(i) ? 0 : INF;
  const A = 1, B = 1.4142;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; let v = d[i]; if (!v) continue;
    if (x > 0) v = Math.min(v, d[i - 1] + A); if (y > 0) { v = Math.min(v, d[i - w] + A); if (x > 0) v = Math.min(v, d[i - w - 1] + B); if (x < w - 1) v = Math.min(v, d[i - w + 1] + B); } d[i] = v; }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; let v = d[i]; if (!v) continue;
    if (x < w - 1) v = Math.min(v, d[i + 1] + A); if (y < h - 1) { v = Math.min(v, d[i + w] + A); if (x < w - 1) v = Math.min(v, d[i + w + 1] + B); if (x > 0) v = Math.min(v, d[i + w - 1] + B); } d[i] = v; }
  return d;
}
// separable box blur, repeated
function blur(src, w, h, r, passes = 2) {
  let a = Float32Array.from(src), b = new Float32Array(w * h);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) { let s = 0, n = 0; const row = y * w; for (let x = -r; x <= r; x++) if (x >= 0 && x < w) { s += a[row + x]; n++; }
      for (let x = 0; x < w; x++) { b[row + x] = s / n; const xo = x - r, xi = x + r + 1; if (xo >= 0) { s -= a[row + xo]; n--; } if (xi < w) { s += a[row + xi]; n++; } } }
    for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let y = -r; y <= r; y++) if (y >= 0 && y < h) { s += b[y * w + x]; n++; }
      for (let y = 0; y < h; y++) { a[y * w + x] = s / n; const yo = y - r, yi = y + r + 1; if (yo >= 0) { s -= b[yo * w + x]; n--; } if (yi < h) { s += b[yi * w + x]; n++; } } }
  }
  return a;
}

export const geo = { ready: false };
// an upper floor stands this far above the building's ground floor
export const LOFT_H = 2.91;
geo.LOFT_H = LOFT_H;
// each floor of the king's castle stands this far above the one below (three flights up to the throne hall)
export const CASTLE_FH = 2.8;
geo.CASTLE_FH = CASTLE_FH;
K3.geo = geo;

export function buildGeo() {
  const t0 = performance.now();
  const Wd = W.W, Hd = W.H, N = Wd * Hd, VW = Wd + 1, VH = Hd + 1, NV = VW * VH;
  const tiles = W.tiles, region = W.region;
  const realm = W.realm || 'main';
  const dgn = D.DUNGEONS.find((d) => d.id === realm) || null;
  Object.assign(geo, { ready: true, realm, W: Wd, H: Hd, VW, VH, dungeon: !!dgn, dtype: dgn ? dgn.type : null, dgnId: dgn ? dgn.id : null, tilesRef: tiles, version: (geo.version || 0) + 1 });
  const biomeOf = (i) => (D.REGIONS[region[i]] || {}).biome || 'grass';
  // ---- tile classes ----
  // 0 land, 1 rock, 2 water, 3 deep, 4 lava, 5 wall, 6 bridge, 7 dock
  const bmap = new Int16Array(N).fill(-1);
  W.buildings.forEach((b, k) => { for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (x >= 0 && y >= 0 && x < Wd && y < Hd) bmap[y * Wd + x] = k; });
  const cls = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const t = tiles[i];
    cls[i] = t === T.ROCK ? 1 : t === T.WATER ? 2 : t === T.DEEP ? 3 : t === T.LAVA ? 4 : (t === T.WALL || t === T.CWALL || t === T.DOOR) ? 5 : t === T.BRIDGE ? 6 : (t === T.WOOD && bmap[i] < 0) ? 7 : 0;
  }
  // docks over water count as water for the ground below them
  geo.bmap = bmap; geo.cls = cls;
  const isWet = (c) => c === 2 || c === 3 || c === 6;
  const tileAt = (x, y) => (x < 0 || y < 0 || x >= Wd || y >= Hd ? -1 : y * Wd + x);
  // helper: list the up-to-4 tiles touching vertex (vx, vy)
  const around = (vx, vy, fn) => { for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) { const i = tileAt(vx + dx, vy + dy); if (i >= 0) fn(i); } };

  const H = new Float32Array(NV), WL = new Float32Array(NV).fill(NaN), CEIL = dgn ? new Float32Array(NV) : null;
  const SNOW = new Float32Array(NV);
  geo.HV = H; geo.WL = WL; geo.CEIL = CEIL; geo.SNOW = SNOW;

  if (dgn) buildDungeon(dgn, Wd, Hd, VW, VH, cls, H, WL, CEIL, around, tiles);
  else buildSurface(realm, Wd, Hd, VW, VH, cls, H, WL, SNOW, around, biomeOf, tileAt, isWet, bmap, tiles);

  // ---- decks: bridges and docks ----
  const deck = new Float32Array(N).fill(NaN);
  for (let pass = 0; pass < 1; pass++) {
    for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
      const i = y * Wd + x; if (cls[i] !== 6 && cls[i] !== 7) continue;
      let wl = -1e9, land = -1e9; const vi = [y * VW + x, y * VW + x + 1, (y + 1) * VW + x, (y + 1) * VW + x + 1];
      for (const v of vi) { if (!isNaN(WL[v])) wl = Math.max(wl, WL[v]); land = Math.max(land, H[v]); }
      deck[i] = Math.max(wl > -1e8 ? wl + (cls[i] === 6 ? 1.15 : 0.75) : land + 0.3, land + 0.25);
    }
  }
  // relax decks toward the land at their ends so bridges arch gently and meet the road
  for (let it = 0; it < 24; it++) for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
    const i = y * Wd + x; if (isNaN(deck[i])) continue; let s = 0, n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = tileAt(x + dx, y + dy); if (j < 0) continue; if (!isNaN(deck[j])) { s += deck[j]; n++; } else if (cls[j] === 0) { s += sampleH(H, VW, (x + dx + 0.5), (y + dy + 0.5)) + 0.08; n++; } }
    if (n) { const minDeck = (() => { let wl = -1e9; for (const v of [y * VW + x, y * VW + x + 1, (y + 1) * VW + x, (y + 1) * VW + x + 1]) if (!isNaN(WL[v])) wl = Math.max(wl, WL[v]); return wl + 0.45; })(); deck[i] = Math.max(minDeck, deck[i] * 0.5 + (s / n) * 0.5); }
  }
  geo.deck = deck;
  // ---- building floors ----
  W.buildings.forEach((b) => {
    let s = 0, n = 0; for (let y = b.y; y <= b.y + b.h; y++) for (let x = b.x; x <= b.x + b.w; x++) if (x >= 0 && y >= 0 && x <= Wd && y <= Hd) { s += H[y * VW + x]; n++; }
    b._y3 = n ? s / n : 0; b._floor3 = b._y3 + 0.16;
  });
  geo.ms = Math.round(performance.now() - t0);
  return geo;
}

function sampleH(H, VW, u, v) {
  const x = Math.floor(u), y = Math.floor(v), fx = u - x, fy = v - y; const i = y * VW + x;
  const a = H[i], b = H[i + 1], c = H[i + VW], d = H[i + VW + 1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function buildSurface(realm, Wd, Hd, VW, VH, cls, H, WL, SNOW, around, biomeOf, tileAt, isWet, bmap, tiles) {
  const N = Wd * Hd, NV = VW * VH;
  // ---- relief and snow per tile, smoothed so biome borders blend ----
  const rel = new Float32Array(N), mtn = new Float32Array(N), snw = new Float32Array(N), ocean = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const b = biomeOf(i); rel[i] = RELIEF[b] != null ? RELIEF[b] : 3; mtn[i] = MOUNTAIN[b] || 1; snw[i] = SNOWY[b] || 0; ocean[i] = b === 'ocean' ? 1 : 0; }
  const relB = blur(rel, Wd, Hd, 6, 2), mtnB = blur(mtn, Wd, Hd, 5, 2), snwB = blur(snw, Wd, Hd, 4, 2);
  // ---- distance fields ----
  const dWater = distField(Wd, Hd, (i) => isWet(cls[i]));
  const dRock = distField(Wd, Hd, (i) => cls[i] !== 1); // inside rock: distance to the nearest open tile
  const dOcean = distField(Wd, Hd, (i) => ocean[i] === 1);
  const summit = realm === 'summit', SU = D.SUMMIT;
  // ---- base land heights ----
  // The land is low and flat by the sea and the rivers and climbs as you go inland: a broad swell of high
  // ground, rolling hills (taller in hilly country), and ridged mountains in the mountain lands.
  const dSea = summit ? null : distField(Wd, Hd, (i) => ocean[i] === 1 || cls[i] === 3);
  const pk = new Float32Array(N); for (let i = 0; i < N; i++) pk[i] = PEAKS[biomeOf(i)] || 0;
  const pkB = blur(pk, Wd, Hd, 8, 2);
  const B = new Float32Array(NV);
  for (let vy = 0; vy < VH; vy++) for (let vx = 0; vx < VW; vx++) {
    const tx = Math.min(Wd - 1, vx), ty = Math.min(Hd - 1, vy); const ti = ty * Wd + tx;
    const r = relB[ti];
    const n0 = fbm(vx * 0.006 + 11, vy * 0.006 - 7, 3), n1 = fbm(vx * 0.016, vy * 0.016, 4), n2 = fbm(vx * 0.05 + 40, vy * 0.05 - 20, 3), n3 = fbm(vx * 0.16 - 9, vy * 0.16 + 4, 2);
    let h;
    if (dSea) {
      const inland = K3.smooth(3, 150, dSea[ti]);
      h = 0.7 + inland * (12 + 30 * n0);
      const hillA = (3.2 + r * 2.6) * (0.45 + 0.55 * inland);
      h += hillA * (n1 - 0.45) * 2 + hillA * 0.35 * (n2 - 0.5) + 0.08 * r * (n3 - 0.5);
      const pkv = pkB[ti]; if (pkv > 0.01) { const rg = ridge(vx * 0.011 + 3, vy * 0.011 - 5, 5); h += pkv * Math.pow(rg, 2.2) * 95 * (0.25 + 0.75 * inland); }
    } else h = r * (0.55 + 1.25 * (n1 - 0.5) + 0.45 * (n2 - 0.5)) + 0.08 * r * (n3 - 0.5) + 0.7;
    if (biomeOf(ti) === 'desert') { const dn = Math.sin(vx * 0.11 + vy * 0.03 + n2 * 5) * 0.5 + 0.5; h += dn * dn * 2.2; }
    // gently slope the land down to the sea
    const dO = dOcean[ti]; if (dO < 24) h = h * K3.smooth(0, 24, dO) + 0.6 * (1 - K3.smooth(0, 24, dO));
    B[vy * VW + vx] = Math.max(0.35, h);
  }
  // ---- water level: a heavily blurred copy of the land ----
  const Bb = blur(B, VW, VH, 10, 2);
  // per-vertex: count wet / rock / lava neighbours
  for (let vy = 0; vy < VH; vy++) for (let vx = 0; vx < VW; vx++) {
    const v = vy * VW + vx; let nT = 0, nWet = 0, nDeep = 0, nRock = 0, nLava = 0, oc = 0, dW = 1e9, dR = 1e9, mt = 1, sn = 0;
    around(vx, vy, (i) => { nT++; const c = cls[i]; if (isWet(c)) { nWet++; if (c === 3) nDeep++; } if (c === 1) { nRock++; dR = Math.min(dR, dRock[i]); } if (c === 4) nLava++; dW = Math.min(dW, dWater[i]); if (ocean[i]) oc = 1; mt = mtnB[i]; sn = Math.max(sn, snwB[i]); });
    const wl = oc ? 0 : Bb[v] - 0.35;
    let h = B[v];
    // land near water settles down to the shore
    if (dW < 12) { const wNear = 1 - K3.smooth(6, 12, dW); h = h + wNear * (Math.max(h, wl + 0.3) - h); if (dW < 7) h = K3.lerp(wl + 0.22, h, K3.smooth(0.5, 7, dW)); }
    if (nWet) WL[v] = wl;
    if (nWet === nT) { const dep = nDeep >= 3 ? 2.6 + fbm(vx * 0.2, vy * 0.2, 2) * 0.8 : nDeep ? 1.6 : 0.75; h = wl - dep; }
    else if (nWet) h = wl - 0.18;
    // mountains out of the rock tiles
    if (nRock) {
      if (nRock === nT) {
        const rn = ridge(vx * 0.045, vy * 0.045, 4), pk = fbm(vx * 0.11 + 7, vy * 0.11 - 3, 3);
        let m = 2.4 * Math.pow(dR, 1.08) * (0.7 + 0.6 * rn) + (dR > 3 ? (pk - 0.3) * dR * 1.6 : 0);
        m = Math.min(70, Math.max(3.2, m)) * mt;
        h += m;
        if (summit) { const sd = Math.hypot(vx - SU.cx, vy - SU.cy); if (sd > SU.r - 6) h = Math.min(h, -8 - (sd - SU.r + 6) * 6 + rn * 6); }
      } else h += [0, 0.35, 1.1, 2.5][nRock] * Math.min(1.3, mt);
    }
    if (nLava) { if (nLava === nT) h -= 1.1; else h -= 0.35 * nLava; }
    H[v] = h;
    SNOW[v] = sn;
  }
  // ---- flatten the cities and every building plot ----
  for (const f in W.cityData) {
    const cd = W.cityData[f]; if (!cd || cd.cx == null) continue; const R = cd.R + 1;
    let s = 0, n = 0; for (let y = cd.cy - R; y <= cd.cy + R + 1; y++) for (let x = cd.cx - R; x <= cd.cx + R + 1; x++) if (x >= 0 && y >= 0 && x < VW && y < VH) { s += H[y * VW + x]; n++; }
    // a port city sits right down at its quay: the whole city on the level of the docks (just above the sea), so the
    // streets, the sea gate, the quay and the piers are one level, with no steps or ramps between them
    const avg = s / n, hb = cd.harbour, base = hb ? DOCK_Y : avg; cd._y3 = base;
    const blend = hb ? 40 : 26; // a lowered city's surroundings come down to it over a longer, gentler slope
    for (let y = cd.cy - R - blend; y <= cd.cy + R + blend + 1; y++) for (let x = cd.cx - R - blend; x <= cd.cx + R + blend + 1; x++) {
      if (x < 0 || y < 0 || x >= VW || y >= VH) continue; const v = y * VW + x;
      const d = Math.max(Math.abs(x - cd.cx - 0.5), Math.abs(y - cd.cy - 0.5)) - (R + 0.5);
      const flat = base + (H[v] - avg) * (hb ? 0.04 : 0.1);
      if (d <= 0) H[v] = flat; else if (d < blend) H[v] = K3.lerp(flat, H[v], K3.smooth(0, blend, d));
    }
    // the dock district outside the sea gate (and the quay along the water): dead level with the city and the piers
    if (hb) for (let i = -2; i <= hb.k + 2; i++) for (let sd = -hb.half - 2; sd <= hb.half + 2; sd++) {
      const tx = hb.gx + hb.dx * i + hb.px * sd, ty = hb.gy + hb.dy * i + hb.py * sd;
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const x = tx + ox, y = ty + oy; if (x < 0 || y < 0 || x >= VW || y >= VH) continue; H[y * VW + x] = base; }
    }
  }
  W.buildings.forEach((b) => {
    let s = 0, n = 0; for (let y = b.y; y <= b.y + b.h; y++) for (let x = b.x; x <= b.x + b.w; x++) if (x >= 0 && y >= 0 && x < VW && y < VH) { s += H[y * VW + x]; n++; }
    const base = n ? s / n : 0;
    for (let y = b.y - 4; y <= b.y + b.h + 4; y++) for (let x = b.x - 4; x <= b.x + b.w + 4; x++) {
      if (x < 0 || y < 0 || x >= VW || y >= VH) continue; const v = y * VW + x;
      const d = Math.max(b.x - x, x - (b.x + b.w), b.y - y, y - (b.y + b.h), 0);
      if (d === 0) H[v] = base; else H[v] = K3.lerp(base, H[v], K3.smooth(0, 4.5, d));
    }
  });
  // ---- a harbour's basin is the sea itself: its water lies at sea level, below the quay ----
  for (const f in W.cityData) {
    const hb = W.cityData[f] && W.cityData[f].harbour; if (!hb) continue;
    for (let i = -2; i <= hb.k + 70; i++) for (let sd = -hb.half - 34; sd <= hb.half + 34; sd++) {
      const x = hb.gx + hb.dx * i + hb.px * sd, y = hb.gy + hb.dy * i + hb.py * sd; if (x < 0 || y < 0 || x >= VW || y >= VH) continue;
      const v = y * VW + x; if (!isNaN(WL[v]) && WL[v] > 0) { H[v] -= WL[v]; WL[v] = 0; }
    }
  }
  // ---- the water near a city (its harbour basin) stays water: flattening the city plot must not lift the bed of a
  // water tile above the water's surface, or heroes would walk where the map has them swim ----
  for (const f in W.cityData) {
    const cd = W.cityData[f]; if (!cd || cd.cx == null) continue; const R = cd.R + 30;
    for (let y = cd.cy - R; y <= cd.cy + R + 1; y++) for (let x = cd.cx - R; x <= cd.cx + R + 1; x++) {
      if (x < 0 || y < 0 || x >= VW || y >= VH) continue; const v = y * VW + x; if (isNaN(WL[v])) continue;
      let nT = 0, nWet = 0, nDeep = 0; around(x, y, (i) => { nT++; if (isWet(cls[i])) { nWet++; if (cls[i] === 3) nDeep++; } });
      if (!nWet) continue;
      const bed = nWet === nT ? WL[v] - (nDeep >= 3 ? 2.6 : nDeep ? 1.6 : 0.75) : WL[v] - 0.18;
      if (H[v] > bed) H[v] = bed;
    }
  }
  // ---- smooth the roads ----
  const isRoadV = new Uint8Array(NV);
  for (let vy = 1; vy < VH - 1; vy++) for (let vx = 1; vx < VW - 1; vx++) { let r = 0; around(vx, vy, (i) => { if (tiles[i] === T.ROAD) r++; }); if (r >= 2) isRoadV[vy * VW + vx] = 1; }
  for (let it = 0; it < 3; it++) { const C = Float32Array.from(H); for (let vy = 1; vy < VH - 1; vy++) for (let vx = 1; vx < VW - 1; vx++) { const v = vy * VW + vx; if (!isRoadV[v]) continue; let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += C[v + dy * VW + dx]; H[v] = s / 9; } }
}

function buildDungeon(dg, Wd, Hd, VW, VH, cls, H, WL, CEIL, around, tiles) {
  const cave = dg.type === 'cave';
  const CH = cave ? 6.2 : 4.6;
  geo.ceilH = CH;
  const dRock = distField(Wd, Hd, (i) => cls[i] !== 1 && cls[i] !== 5);
  for (let vy = 0; vy < VH; vy++) for (let vx = 0; vx < VW; vx++) {
    const v = vy * VW + vx; let nT = 0, nSolid = 0, nWet = 0, nDeep = 0, dR = 1e9;
    around(vx, vy, (i) => { nT++; const c = cls[i]; if (c === 1 || c === 5) { nSolid++; dR = Math.min(dR, dRock[i]); } if (c === 2 || c === 3) { nWet++; if (c === 3) nDeep++; } });
    let h = cave ? (fbm(vx * 0.3, vy * 0.3, 2) - 0.5) * 0.5 : 0;
    let c = cave ? CH - fbm(vx * 0.12 + 3, vy * 0.12, 3) * 2.2 - fbm(vx * 0.5, vy * 0.5, 2) * 0.6 : CH;
    if (nWet) WL[v] = -0.22;
    if (nWet === nT) h = nDeep ? -2.4 : -0.85; else if (nWet) h = -0.3;
    if (cave && nSolid) {
      if (nSolid === nT) { h = CH + 1.5 + Math.min(dR, 4) * 0.5; c = h; }
      else { const f = nSolid / nT; h = h + (c - h) * Math.pow(f, 1.6) * 0.9 + (fbm(vx * 0.4, vy * 0.4, 2) - 0.5) * 0.6 * f; c = Math.max(h + 0.2, c - f * 1.4); }
    }
    H[v] = h; CEIL[v] = c;
  }
}

// ---------- queries ----------
// terrain height at world tile coordinates (u, v in tiles)
geo.groundT = function (u, v) {
  if (!geo.ready) return 0; const VW = geo.VW;
  u = K3.clamp(u, 0, geo.W - 0.001); v = K3.clamp(v, 0, geo.H - 0.001);
  return sampleTri(geo.HV, VW, u, v);
};
// the height on the terrain mesh itself: each cell is two triangles split along alternating diagonals (terrain.js
// chunkIndex), so feet, the camera and the ground line up exactly instead of a bilinear guess that floats or sinks
function sampleTri(H, VW, u, v) {
  const x = Math.floor(u), y = Math.floor(v), fx = u - x, fy = v - y; const i = y * VW + x;
  const a = H[i], b = H[i + 1], c = H[i + VW], d = H[i + VW + 1];
  if ((x + y) & 1) return fx + fy <= 1 ? a + (b - a) * fx + (c - a) * fy : d + (c - d) * (1 - fx) + (b - d) * (1 - fy);
  return fx >= fy ? a + (b - a) * fx + (d - b) * fy : a + (c - a) * fy + (d - c) * fx;
}
// where an entity stands, from 2D pixel coordinates
geo.floorAt = function (px, py) {
  if (!geo.ready) return 0;
  const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
  if (tx >= 0 && ty >= 0 && tx < geo.W && ty < geo.H) {
    const i = ty * geo.W + tx; const bi = geo.bmap[i];
    // the wall-walk and the stairs up to it
    if (W.wallTop && (!W.realm || W.realm === 'main')) {
      if (W.wallTop[i]) { for (const f in W.cityData) { const cd = W.cityData[f]; if (cd && cd._wallTop3 != null && Math.abs(tx - cd.cx) <= cd.R && Math.abs(ty - cd.cy) <= cd.R) return cd._wallTop3; } }
      const s = W.stairs && W.stairs.get(i);
      if (s && s.loft) { const b = s.loft; if (b._floor3 != null) { const u = 1 - (py / TS - ty); return b._floor3 + LOFT_H * Math.min(1, (s.k + u) / s.n); } }
      if (s && !s.loft) { const cd = W.cityData[s.f]; if (cd && cd._wallTop3 != null) { let u = s.dir[0] ? px / TS - tx : py / TS - ty; if ((s.dir[0] || s.dir[1]) < 0) u = 1 - u; /* flights climb either way along the wall */ const g = geo.groundT(px / TS, py / TS); return g + (cd._wallTop3 - g) * Math.min(1, (s.k + u) / s.n); } }
    }
    if (bi >= 0) { const b = W.buildings[bi]; if (b && b._floor3 != null) return b.terr && W.terrAt ? b._floor3 + CASTLE_FH * W.terrAt(b, px, py) : b._floor3; } // the castle's raised floors
    const dk = geo.deck[i]; if (!isNaN(dk)) return dk;
  }
  return geo.groundT(px / TS, py / TS);
};
geo.waterAt = function (px, py) {
  if (!geo.ready) return NaN; const u = px / TS, v = py / TS; const x = Math.round(u), y = Math.round(v);
  if (x < 0 || y < 0 || x > geo.W || y > geo.H) return NaN; return geo.WL[y * geo.VW + x];
};
// world-space helpers
geo.groundXZ = (X, Z) => geo.groundT(X / TILE, Z / TILE);
geo.solidTileXZ = function (X, Z) { const tx = Math.floor(X / TILE), ty = Math.floor(Z / TILE); if (tx < 0 || ty < 0 || tx >= geo.W || ty >= geo.H) return 1; return geo.cls[ty * geo.W + tx]; };
geo.snowAt = (u, v) => { const x = Math.round(u), y = Math.round(v); if (x < 0 || y < 0 || x > geo.W || y > geo.H) return 0; return geo.SNOW[y * geo.VW + x]; };
export { sampleH };

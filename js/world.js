// Kingdom Rising — world generation: terrain, regions, roads, cities, buildings, lights, spawns
(function () {
  const KR = (window.KR = window.KR || {});
  const D = KR.D;
  // the Corsair Coast: new land in what was the empty south-east sea, a palm-fringed shore of coves and smugglers'
  // beaches (levels 36-46, between the desert and Gloamreach), peopled by the same creatures as the Isle of Tidesong
  if (D.REGIONS && D.REGION_BY_ID && D.REGION_BY_ID.corsair == null) {
    D.REGIONS.push({ id: 'corsair', name: 'Corsair Coast', biome: 'island', seeds: [[520, 520], [585, 545], [500, 585], [600, 595], [560, 495]], lv: [36, 46], dark: 0, mobs: ['shore_crab', 'island_tiger', 'pirate', 'pirate', 'pirate_mage', 'sea_harpy', 'coral_golem', 'reef_croc'], music: 'island' });
    D.REGION_BY_ID.corsair = D.REGIONS.length - 1;
  }
  const U = (KR.U = {});
  // ---------- utils ----------
  U.mulberry = function (a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  U.hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  U.vnoise = function (x, y, s = 0) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const sm = (t) => t * t * (3 - 2 * t);
    const a = U.hash(xi, yi, s), b = U.hash(xi + 1, yi, s), c = U.hash(xi, yi + 1, s), d = U.hash(xi + 1, yi + 1, s);
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  U.fbm = (x, y, s = 0, o = 4) => { let t = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { t += a * U.vnoise(x * f, y * f, s + i * 17); n += a; a *= 0.5; f *= 2; } return t / n; };
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  U.pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
  U.rint = (a, b, r = Math.random) => a + Math.floor(r() * (b - a + 1));
  U.uid = () => Math.random().toString(36).slice(2, 10);

  // ---------- tiles ----------
  const T = (KR.T = { GRASS: 0, DGRASS: 1, FOREST: 2, ROAD: 3, COBBLE: 4, WATER: 5, DEEP: 6, SAND: 7, ROCK: 8, SNOW: 9, MUD: 10, ASH: 11, WOOD: 12, WALL: 13, DOOR: 14, FARM: 15, BRIDGE: 16, STONE: 17, GRAVEL: 18, LAVA: 19, CWALL: 20, GLOOM: 21, PLAINS: 22, VOLC: 23, CARPET: 24, CAVE: 25, ICE: 26, SCAR: 27 });
  const SOLID = new Uint8Array(32); [T.DEEP, T.ROCK, T.WALL, T.LAVA, T.CWALL].forEach((t) => (SOLID[t] = 1));
  KR.SOLID = SOLID;

  const W = (KR.W = {});
  W.W = D.WORLD_SIZE || 640; W.H = W.W;
  W.RING = 16; // tiles of open sea round the edge of the world
  const TS = D.TS;

  W.idx = (x, y) => y * W.W + x;
  W.inb = (x, y) => x >= 0 && y >= 0 && x < W.W && y < W.H;
  W.tile = (x, y) => (W.inb(x, y) ? W.tiles[y * W.W + x] : T.ROCK);
  W.regionAt = (tx, ty) => (W.inb(tx, ty) ? W.region[ty * W.W + tx] : 0);
  W.regionAtPx = (px, py) => W.regionAt(Math.floor(px / TS), Math.floor(py / TS));

  W.isBlockedTile = function (tx, ty, opts) {
    if (!W.inb(tx, ty)) return true;
    const i = ty * W.W + tx, t = W.tiles[i];
    if (SOLID[t] && !(t === T.DEEP && opts && opts.swim && W.swimmable(tx, ty))) return true; // the hero can swim out into deep water
    if (W.block[i]) return true;
    if (t === T.DOOR) {
      const d = W.doorAt[i];
      if (!d) return false;
      if (opts && opts.door === 'pass') return !!d.locked && !(opts.key && opts.key(d.locked));
      return d.open < 0.6;
    }
    if (t === T.WATER && opts && opts.noWater) return true;
    return false;
  };
  // deep water you can swim in: anywhere within 8 tiles of land, a pier or shallows (the open sea is too rough: take a ship)
  let swimC = null, swimFor = null;
  W.swimmable = function (tx, ty) {
    if (swimFor !== W.tiles) { swimC = new Map(); swimFor = W.tiles; }
    const i = ty * W.W + tx; let v = swimC.get(i); if (v != null) return v;
    // nobody swims through a ship's hull
    const HULL = { rowboat: 1, sloop: 1.6, cog: 2.2, galleon: 3 };
    for (const d of W.decor) if (d.kind === 'boat' && Math.abs(d.tx - tx) < 5 && Math.abs(d.ty - ty) < 5 && Math.hypot(d.tx - tx, d.ty - ty) <= (HULL[d.size] || 1.6)) { swimC.set(i, false); return false; }
    v = false; const R = 8;
    for (let y = ty - R; y <= ty + R && !v; y++) for (let x = tx - R; x <= tx + R; x++) { if (!W.inb(x, y)) continue; if (W.tiles[y * W.W + x] !== T.DEEP) { v = true; break; } }
    swimC.set(i, v); return v;
  };
  // rails: thin stone balustrades along tile edges (the castle's raised floors and the sides of its stairs). W.edge holds,
  // per tile, which of its sides are railed (1 north, 2 east, 4 south, 8 west); nobody walks across a railed side and the
  // pathfinders go round by the stairs
  W.edge = null;
  W.solidAtPx = (px, py, opts) => W.isBlockedTile(Math.floor(px / TS), Math.floor(py / TS), opts);
  const RAIL = 10; // px: how close anyone's middle comes to a balustrade
  const SIDE = (dx, dy) => (dy < 0 ? 1 : dy > 0 ? 4 : dx > 0 ? 2 : 8);
  // a step can never carry anyone's middle across a rail, however long it is (a far walker's big step, a dash, a shove),
  // nor closer to one than RAIL (stepping away from it is always allowed, so nobody can get wedged against it):
  // G.moveEnt is wrapped once, the first time a city with rails is built, and undoes the part of a step that broke that
  function railMoves() {
    const G = KR.G; if (!G || !G.moveEnt || G.moveEnt._rails) return;
    const mv0 = G.moveEnt;
    G.moveEnt = function (e, dx, dy, opts) {
      const ox = e.x, oy = e.y; const r = mv0.apply(this, arguments);
      const E = W.edge; if (!E || E.length !== W.W * W.H || (W.realm && W.realm !== 'main') || e.fly) return r;
      const otx = Math.floor(ox / TS), oty = Math.floor(oy / TS);
      let ntx = Math.floor(e.x / TS);
      if (ntx !== otx && W.edgeBlk(otx, oty, Math.sign(ntx - otx), 0)) { e.x = ox; ntx = otx; }
      { const m = E[oty * W.W + ntx], fx = e.x - ntx * TS; if ((m & 8 && fx < RAIL && e.x < ox) || (m & 2 && fx > TS - RAIL && e.x > ox)) e.x = ox; }
      const tx2 = Math.floor(e.x / TS); let nty = Math.floor(e.y / TS);
      if (nty !== oty && W.edgeBlk(tx2, oty, 0, Math.sign(nty - oty))) { e.y = oy; nty = oty; }
      { const m = E[nty * W.W + tx2], fy = e.y - nty * TS; if ((m & 1 && fy < RAIL && e.y < oy) || (m & 4 && fy > TS - RAIL && e.y > oy)) e.y = oy; }
      return r;
    };
    G.moveEnt._rails = true;
  }
  W.railMoves = railMoves;
  // is the step from tile (x, y) to (x + dx, y + dy) across a rail? (a diagonal step must clear both corners)
  W.edgeBlk = function (x, y, dx, dy) {
    const E = W.edge; if (!E || E.length !== W.W * W.H) return false; const i = y * W.W + x;
    if (!dx || !dy) return !!(E[i] & SIDE(dx, dy));
    return !!((E[i] & (SIDE(dx, 0) | SIDE(0, dy))) || (E[i + dx] & SIDE(0, dy)) || (E[i + dy * W.W] & SIDE(dx, 0)));
  };

  // ---------- generation ----------
  W.generate = function (seed, cityLevels) {
    const rnd = U.mulberry(seed);
    W.seed = seed;
    const N = W.W * W.H;
    W.tiles = new Uint8Array(N); W.region = new Uint8Array(N); W.vari = new Uint8Array(N); W.block = new Uint8Array(N);
    W.doorAt = {}; W.decor = []; W.buildings = []; W.lights = []; W.spawns = []; W.camps = []; W.chambers = {}; W.dungeons = {}; W.explored = new Uint8Array((W.W >> 2) * (W.H >> 2));
    W.cityData = {}; W.wallTop = null; W.stairs = new Map(); W.edge = null;
    const RI = D.REGION_BY_ID;
    // ---- regions: warped voronoi over the mainland seeds (grid-bucketed for speed) ----
    const seeds = [];
    D.REGIONS.forEach((r, i) => r.seeds.forEach((s) => seeds.push([s[0], s[1], i])));
    for (let y = 0; y < W.H; y++) for (let x = 0; x < W.W; x++) {
      const wx = x + (U.fbm(x * 0.03, y * 0.03, 11, 3) - 0.5) * 44, wy = y + (U.fbm(x * 0.03, y * 0.03, 23, 3) - 0.5) * 44;
      let best = 1e9, bi = 0;
      for (let k = 0; k < seeds.length; k++) { const s = seeds[k]; const d = (s[0] - wx) * (s[0] - wx) + (s[1] - wy) * (s[1] - wy); if (d < best) { best = d; bi = s[2]; } }
      W.region[y * W.W + x] = bi;
      W.vari[y * W.W + x] = Math.floor(U.hash(x, y, 5) * 255);
    }
    // ---- special areas override the voronoi ----
    for (const f of D.FACTION_IDS) {
      const [cx, cy] = D.CITY_CENTER[f]; const ri = RI[D.CITY_REGION[f]];
      for (let y = cy - 46; y <= cy + 46; y++) for (let x = cx - 46; x <= cx + 46; x++) if (W.inb(x, y)) W.region[y * W.W + x] = ri;
    }
    W.realm = 'main'; W.portals = [];
    // the south-east sea now leaves room for the Corsair Coast: land east of a bay that still laps the desert's
    // coast (where Sunscour Docks stand) and runs out to open water along the southern edge
    const coastLand = (x, y) => x > SE.x0 + (U.fbm(x * 0.025, y * 0.025, 71, 3) - 0.5) * 30 && y < SE.y1 + (U.fbm(x * 0.025, y * 0.025, 73, 3) - 0.5) * 26;
    const inOcean = (x, y) => x > OC.x0 + (U.fbm(x * 0.02, y * 0.02, 61, 3) - 0.5) * 50 && y > OC.y0 + (U.fbm(x * 0.02, y * 0.02, 67, 3) - 0.5) * 50 && !coastLand(x, y);
    for (let y = 0; y < W.H; y++) for (let x = 0; x < W.W; x++) if (inOcean(x, y) || W.portSea(x, y)) W.region[y * W.W + x] = RI.ocean;
    // the Encircling Sea: a wide ocean all round the edge of the land, joining both capitals' harbours, so warships
    // can sail from one kingdom to the other (warmarch.js naval section)
    for (let y = 0; y < W.H; y++) for (let x = 0; x < W.W; x++) { const e = Math.min(x, y, W.W - 1 - x, W.H - 1 - y) + (U.fbm(x * 0.035, y * 0.035, 83, 3) - 0.5) * 9; if (e < W.RING) W.region[y * W.W + x] = RI.ocean; }
    paintTerrain();
    shoreline();
    // ---- mountain ridges between regions whose levels differ a lot ----
    const regMin = D.REGIONS.map((r) => (r.city || r.noRidge ? -1 : r.lv[0]));
    const ridge = new Uint8Array(N);
    for (let y = 2; y < W.H - 2; y++) for (let x = 2; x < W.W - 2; x++) {
      const a = W.region[y * W.W + x]; if (regMin[a] < 0) continue;
      let hit = false;
      for (let dy = -2; dy <= 2 && !hit; dy++) for (let dx = -2; dx <= 2 && !hit; dx++) { const b = W.region[(y + dy) * W.W + x + dx]; if (b !== a && regMin[b] >= 0 && Math.abs(regMin[a] - regMin[b]) >= 17) hit = true; }
      if (hit) ridge[y * W.W + x] = 1;
    }
    for (let i = 0; i < N; i++) if (ridge[i]) W.tiles[i] = U.hash(i % W.W, (i / W.W) | 0, 13) < 0.08 ? T.GRAVEL : T.ROCK;
    // ---- river from the peaks down to the sea ----
    for (let y = 118; y < OC.y0 + 10; y++) {
      const rx = 398 + Math.sin(y * 0.03) * 16 + Math.sin(y * 0.011 + 1) * 10;
      const ford = (y % 70) > 60;
      for (let dx = -4; dx <= 4; dx++) {
        const x = Math.round(rx + dx); if (!W.inb(x, y)) continue;
        const i = y * W.W + x, cur = W.tiles[i]; const rg = D.REGIONS[W.region[i]];
        if (cur === T.LAVA || rg.city || rg.dungeon || rg.id === 'summit') continue;
        const a = Math.abs(dx);
        if (a <= 1 && !ford) W.tiles[i] = T.DEEP; else if (a <= 3) W.tiles[i] = T.WATER; else if (cur !== T.ROCK) W.tiles[i] = T.SAND;
      }
    }
    // the river's spring: a small lake in the hills
    { const y = 118, rx = Math.round(398 + Math.sin(y * 0.03) * 16 + Math.sin(y * 0.011 + 1) * 10); for (let dy = -6; dy <= 2; dy++) for (let dx = -7; dx <= 7; dx++) { const d = Math.hypot(dx, dy * 1.2); if (d > 6.5) continue; const x = rx + dx, yy = y + dy; if (!W.inb(x, yy)) continue; const i = yy * W.W + x; W.tiles[i] = d < 3 ? T.DEEP : d < 5.5 ? T.WATER : T.SAND; } }
    // ---- dungeons: carve caves and crypts out of solid rock ----
    for (const dg of D.DUNGEONS) if ((dg.parent || 'main') === 'main' && dg.type !== 'sewer') carveEntrance(dg);
    // ---- roads ----
    const ROADS = [
      [[170, 440], [175, 380], [220, 305], [290, 262], [335, 262]],
      [[500, 95], [500, 170], [450, 215], [380, 255], [335, 262]],
      [[335, 262], [320, 200], [300, 130], [265, 70], [265, 58]],
      [[335, 262], [260, 225], [205, 215], [173, 214], [173, 226]],
      [[335, 262], [420, 300], [444, 340], [444, 351]],
      [[444, 340], [470, 390], [500, 425], [540, 410], [584, 386]],
      [[500, 425], [508, 468], [522, 505], [548, 536], [578, 556]], // south into the Corsair Coast
      [[175, 380], [120, 352], [75, 318], [60, 260]],
      [[170, 440], [190, 520], [260, 585], [330, 560], [372, 548]],
      [[170, 440], [110, 515], [80, 570], [92, 580]],
      [[500, 95], [580, 150], [575, 235], [605, 300], [605, 340]],
      [[205, 215], [200, 150], [250, 110]],
    ];
    W.roads = ROADS;
    const roadPts = [];
    ROADS.forEach((pts, ri) => {
      for (let s = 0; s < pts.length - 1; s++) {
        const [x0, y0] = pts[s], [x1, y1] = pts[s + 1];
        const len = Math.hypot(x1 - x0, y1 - y0) || 1, steps = Math.ceil(len * 2);
        for (let k = 0; k <= steps; k++) {
          const u = k / steps;
          const wob = Math.sin((s * 7 + u * len) * 0.12 + ri) * 3 * Math.sin(u * Math.PI);
          const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
          const px = x0 + (x1 - x0) * u + nx * wob, py = y0 + (y1 - y0) * u + ny * wob;
          const rgn = D.REGIONS[W.regionAt(Math.round(px), Math.round(py))];
          if (rgn.dungeon) continue;
          roadPts.push([px, py, ri]);
          // the King's Road between the two cities (routes 0 and 1, meeting at the crossroads) is twice as wide
          const RR = ri <= 1 ? 4 : 2, R2 = ri <= 1 ? 14.5 : 3.2;
          for (let dy = -RR; dy <= RR; dy++) for (let dx = -RR; dx <= RR; dx++) {
            const tx = Math.round(px + dx), ty = Math.round(py + dy); if (!W.inb(tx, ty)) continue;
            if (dx * dx + dy * dy > R2) continue;
            const i = ty * W.W + tx, cur = W.tiles[i];
            if (D.REGIONS[W.region[i]].dungeon) continue;
            if (cur === T.WATER || cur === T.DEEP) W.tiles[i] = T.BRIDGE;
            else if (cur !== T.BRIDGE) W.tiles[i] = T.ROAD;
          }
        }
      }
    });
    let lampCount = 0;
    for (let k = 0; k < roadPts.length; k += 22) {
      const [px, py, ri] = roadPts[k];
      const reg = D.REGIONS[W.regionAt(Math.round(px), Math.round(py))];
      if (reg.city) continue;
      const side = lampCount++ % 2 ? 1 : -1;
      const k2 = Math.min(roadPts.length - 1, k + 2);
      const dx = roadPts[k2][0] - px, dy = roadPts[k2][1] - py, l = Math.hypot(dx, dy) || 1;
      let off = ri <= 1 ? 5.2 : 2.6; let lx = Math.round(px + (-dy / l) * off * side), ly = Math.round(py + (dx / l) * off * side);
      // a lamp stands beside the road, never on it (where roads meet, the King's Road is wide)
      while (off < 9 && W.inb(lx, ly) && (W.tile(lx, ly) === T.ROAD || W.tile(lx, ly) === T.BRIDGE)) { off += 1; lx = Math.round(px + (-dy / l) * off * side); ly = Math.round(py + (dx / l) * off * side); }
      if (!W.inb(lx, ly) || SOLID[W.tile(lx, ly)] || W.tile(lx, ly) === T.WATER) continue;
      const broken = reg.dark > 0.6 && U.hash(lx, ly, 3) < 0.6;
      addDecor('lamp', lx, ly, { broken, roadLamp: true });
      if (!broken) W.lights.push({ x: lx * TS + 16, y: ly * TS - 20, r: 190, col: '255,196,110', fl: 0.08, k: 'lamp', roadLamp: true });
    }
    // ---- outpost at the crossroads ----
    clearArea(338, 255, 12, 10, null);
    stampBuilding({ x: 340, y: 256, w: 8, h: 6, type: 'outpost', name: "Wayfarer's Rest", faction: null, style: 'crown', minLevel: 1 });
    W.lights.push({ x: 339 * TS, y: 263 * TS, r: 230, col: '255,190,110', fl: 0.1, k: 'fire' });
    addDecor('campfire', 339, 264, {});
    // ---- cities ----
    W.cityBase = {};
    for (const f of D.FACTION_IDS) {
      const [cx, cy] = D.CITY_CENTER[f]; const R = 60; const base = { x0: cx - R, y0: cy - R, w: R * 2 + 1, tiles: null };
      base.tiles = new Uint8Array(base.w * base.w);
      for (let y = 0; y < base.w; y++) for (let x = 0; x < base.w; x++) { const tx = base.x0 + x, ty = base.y0 + y; base.tiles[y * base.w + x] = W.inb(tx, ty) ? W.tiles[ty * W.W + tx] : T.ROCK; }
      W.cityBase[f] = base;
    }
    decorateWorld();
    placeCamps(rnd);
    // ---- boss chambers and open-world bosses ----
    for (const b of D.BOSSES) {
      if (!b.chamber || (b.realm || 'main') !== 'main') continue;
      const [bx, by] = b.at;
      const bb = { x: bx - 5, y: by - 5, w: 11, h: 9, type: 'chamber', name: b.name + "'s Lair", faction: null, style: 'chamber', minLevel: 1, locked: 'key_' + b.id };
      clearArea(bb.x - 1, bb.y - 1, bb.w + 2, bb.h + 4, W.tiles[by * W.W + bx] === T.ROCK ? T.GRAVEL : null);
      stampBuilding(bb);
      for (let k = 0; k < 6; k++) { const tx = bx, ty = bb.y + bb.h + k; if (W.inb(tx, ty)) { const i = ty * W.W + tx; if (SOLID[W.tiles[i]]) W.tiles[i] = T.GRAVEL; W.block[i] = 0; } }
      W.chambers[b.id] = bb;
    }
    for (const b of D.BOSSES) if (!b.chamber && !b.dungeon && (b.realm || 'main') === 'main') clearArea(b.at[0] - 3, b.at[1] - 3, 7, 7, null);
    // ---- neutral hubs on the mainland: docks and the dragon roost ----
    buildHubs('main');
    D.REGIONS[RI.ocean].label = [430, 600]; if (RI.corsair != null) D.REGIONS[RI.corsair].label = [548, 528];
    // ---- cities ----
    for (const f of D.FACTION_IDS) W.stampCity(f, (cityLevels && cityLevels[f]) || 1, true);
    // roadside lamps that later paving (gate roads, the crossroads) left standing in the road come down
    { const onRoad = (tx, ty) => { const t = W.tile(tx, ty); return t === T.ROAD || t === T.BRIDGE; };
      const gone = new Set(W.decor.filter((d) => d.roadLamp && onRoad(d.tx, d.ty)).map((d) => d.tx + ',' + d.ty));
      if (gone.size) { W.decor = W.decor.filter((d) => !(d.roadLamp && gone.has(d.tx + ',' + d.ty))); W.lights = W.lights.filter((l) => !(l.roadLamp && gone.has(Math.floor(l.x / TS) + ',' + Math.floor((l.y + 20) / TS))));
        for (const k of gone) { const [tx, ty] = k.split(',').map(Number); if (!W.decor.some((d) => d.tx === tx && d.ty === ty && !d.nb)) W.block[ty * W.W + tx] = 0; } } }
    W.makeSpawns(rnd);
    W.mapCanvas = null; W.buildMinimap(); W.present = presentRegions();
  };

  // ---------- shared terrain helpers (used by every realm) ----------
  const OC = D.OCEAN, SU = D.SUMMIT;
  const SE = { x0: 452, y1: 610 }; // the Corsair Coast: land east of x0, north of y1, within the old south-east sea
  // the two capitals are sea ports: a northern sea whose coast swells into a harbour at Aelindor's north wall,
  // and a bay from the western edge right up to Valenmoor's west gate
  W.portSea = function (x, y) {
    const n = (U.fbm(x * 0.03, y * 0.03, 81, 3) - 0.5) * 16;
    const [sx, sy] = D.CITY_CENTER.sylvan, [cx, cy] = D.CITY_CENTER.crown;
    if (x > 345 + n * 2) { let coast = 24 + n; const dxs = Math.abs(x - sx); if (dxs < 85) coast = Math.max(coast, sy - 46 - Math.pow(dxs / 85, 2) * 22 + n * 0.25); if (y < coast) return true; }
    const dyc = Math.abs(y - cy - 2); if (dyc < 72) { const coast = cx - 47 - Math.pow(dyc / 72, 2) * 82 + n * 0.5; if (x < coast) return true; }
    return false;
  };
  let islandD = () => 9;
  function paintTerrain() {
    const RI = D.REGION_BY_ID;
    for (let y = 0; y < W.H; y++) for (let x = 0; x < W.W; x++) {
      const i = y * W.W + x, reg = D.REGIONS[W.region[i]], n = U.fbm(x * 0.06, y * 0.06, 3), n2 = U.fbm(x * 0.12, y * 0.12, 7);
      let t = T.GRASS;
      switch (reg.biome) {
        case 'hills': t = n > 0.72 ? T.ROCK : T.GRASS; break;
        case 'mountain': t = n > 0.66 ? T.ROCK : n2 > 0.55 ? T.GRAVEL : T.DGRASS; break;
        case 'forest': t = n2 > 0.62 ? T.GRASS : T.FOREST; break;
        case 'darkforest': t = n > 0.74 ? T.ROCK : T.DGRASS; break;
        case 'plains': t = T.PLAINS; break;
        case 'plains2': t = n2 > 0.6 ? T.GRASS : T.PLAINS; break;
        case 'grass': t = n > 0.76 ? T.ROCK : T.GRASS; break;
        case 'swamp': t = n > 0.62 ? T.WATER : T.MUD; if (n > 0.7) t = T.DEEP; break;
        case 'ash': t = n2 > 0.66 ? T.GRAVEL : T.ASH; break;
        case 'snow': t = n > 0.68 ? T.ROCK : T.SNOW; break;
        case 'gloom': t = n > 0.75 ? T.ROCK : T.GLOOM; break;
        case 'volcanic': t = n > 0.73 ? T.LAVA : n > 0.66 ? T.ROCK : T.VOLC; break;
        case 'scar': t = n > 0.74 ? T.LAVA : n > 0.67 ? T.ROCK : n2 > 0.55 ? T.ASH : T.SCAR; break;
        case 'desert': t = n > 0.78 ? T.ROCK : n2 > 0.7 ? T.GRAVEL : T.SAND; break;
        case 'ocean': t = T.DEEP; break;
        // (the mainland's Corsair Coast gets its beaches from shoreline())
        case 'island': { const d = reg.id === 'corsair' ? 0 : islandD(x, y); t = d > 0.9 ? T.SAND : n2 > 0.58 ? T.FOREST : n > 0.78 ? T.ROCK : T.GRASS; break; }
        case 'summit': { const sd = Math.hypot(x - SU.cx, y - SU.cy) + (U.fbm(x * 0.05, y * 0.05, 73, 3) - 0.5) * 10; t = sd > SU.r ? T.ROCK : n > 0.72 ? T.ROCK : n2 > 0.52 ? T.SNOW : T.GRASS; break; }
        case 'cave': case 'crypt': case 'icecave': case 'abyss': t = T.ROCK; break;
        case 'citystone': t = n > 0.6 ? T.GRAVEL : T.DGRASS; break;
        case 'cityforest': t = T.FOREST; break;
        case 'cityplains': t = T.PLAINS; break;
      }
      if (['grass', 'hills', 'plains', 'forest'].includes(reg.biome)) { const ln = U.fbm(x * 0.045, y * 0.045, 41); if (ln > 0.74) t = ln > 0.785 ? T.DEEP : T.WATER; else if (ln > 0.715) t = T.SAND; }
      const edge = Math.min(x, y, W.W - 1 - x, W.H - 1 - y) + (U.fbm(x * 0.1, y * 0.1, 9) - 0.5) * 6;
      if (edge < 4) t = reg.biome === 'ocean' || reg.biome === 'island' ? T.DEEP : reg.biome === 'swamp' ? T.DEEP : T.ROCK;
      W.tiles[i] = t;
    }
  }
  function shoreline() {
    const RI = D.REGION_BY_ID;
    // shallow water and beaches where land meets the sea
    const isSea = (x, y) => W.inb(x, y) && W.region[y * W.W + x] === RI.ocean;
    for (let y = 1; y < W.H - 1; y++) for (let x = 1; x < W.W - 1; x++) {
      const i = y * W.W + x; const sea = isSea(x, y);
      let near = 99;
      for (let r = 1; r <= 4 && near === 99; r++) for (let dy = -r; dy <= r && near === 99; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; if (isSea(x + dx, y + dy) !== sea && !(W.region[(y + dy) * W.W + x + dx] >= 0 && D.REGIONS[W.region[(y + dy) * W.W + x + dx]].dungeon)) { near = r; break; } }
      if (sea && near <= 2) W.tiles[i] = T.WATER;
      else if (!sea && near <= 3 && !D.REGIONS[W.region[i]].dungeon && W.tiles[i] !== T.ROCK) W.tiles[i] = T.SAND;
    }
  }
  function decorateWorld() {
    // ---- wild decorations ----
    for (let y = 2; y < W.H - 2; y++) for (let x = 2; x < W.W - 2; x++) {
      const i = y * W.W + x, t = W.tiles[i]; if (SOLID[t] || t === T.ROAD || t === T.BRIDGE || t === T.WATER) continue;
      const reg = D.REGIONS[W.region[i]]; if (reg.dungeon) continue;
      if (t === T.SAND && reg.biome !== 'desert' && reg.biome !== 'island') continue;
      const h = U.hash(x, y, 77), h2 = U.hash(x, y, 91);
      const dens = { hills: 0.025, mountain: 0.022, forest: 0.065, darkforest: 0.075, plains: 0.012, plains2: 0.02, grass: 0.035, swamp: 0.04, ash: 0.03, snow: 0.035, gloom: 0.035, volcanic: 0.015, scar: 0.02, desert: 0.012, island: 0.045, summit: 0.03, citystone: 0.02, cityforest: 0.055, cityplains: 0.01 }[reg.biome] || 0.02;
      const nearRoad = W.tile(x + 1, y) === T.ROAD || W.tile(x - 1, y) === T.ROAD || W.tile(x, y + 1) === T.ROAD || W.tile(x, y - 1) === T.ROAD;
      // keep trees and rocks at least one open tile apart so forests never wall you in
      let crowd = false; for (let dy = -1; dy <= 1 && !crowd; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && W.block[(y + dy) * W.W + x + dx]) { crowd = true; break; }
      if (h < dens && !nearRoad && !crowd) {
        const tk = { hills: h2 < 0.6 ? 'oak' : 'pine', mountain: h2 < 0.5 ? 'pine' : 'boulder', forest: h2 < 0.45 ? 'elmwood' : h2 < 0.8 ? 'oak' : 'birch', darkforest: h2 < 0.7 ? 'darkoak' : 'deadtree', plains: h2 < 0.7 ? 'oak' : 'birch', plains2: h2 < 0.5 ? 'oak' : 'bramble',
          grass: h2 < 0.6 ? 'oak' : h2 < 0.85 ? 'pine' : 'boulder', swamp: h2 < 0.6 ? 'willow' : 'deadtree', ash: h2 < 0.6 ? 'deadtree' : 'tomb', snow: h2 < 0.75 ? 'snowpine' : 'boulder', gloom: h2 < 0.5 ? 'deadtree' : h2 < 0.75 ? 'tomb' : 'crystal', volcanic: h2 < 0.5 ? 'boulder' : 'charred',
          scar: h2 < 0.5 ? 'charred' : h2 < 0.8 ? 'boulder' : 'crystal', desert: h2 < 0.55 ? 'cactus' : h2 < 0.8 ? 'boulder' : 'bones', island: t === T.SAND ? 'palm' : h2 < 0.55 ? 'palm' : h2 < 0.85 ? 'oak' : 'boulder', summit: h2 < 0.6 ? 'snowpine' : 'boulder',
          citystone: 'pine', cityforest: h2 < 0.6 ? 'elmwood' : 'oak', cityplains: 'oak' }[reg.biome];
        if (tk) addDecor(tk, x, y, {});
      } else if (h < dens + 0.06 && h2 < 0.5) {
        const sk = { plains: 'flowers', plains2: 'flowers', grass: 'flowers', hills: 'flowers', forest: h2 < 0.25 ? 'mushroom' : 'fern', darkforest: 'mushroom', swamp: 'reeds', ash: 'bones', gloom: 'bones', snow: 'snowtuft', volcanic: 'ember', scar: 'ember', mountain: 'pebbles', desert: 'pebbles', island: 'fern', summit: 'snowtuft', cityforest: 'flowers', cityplains: 'flowers', citystone: 'pebbles' }[reg.biome];
        if (sk) addDecor(sk, x, y, { nb: true });
      }
    }
  }
  function placeCamps(rnd) {
    // ---- camps per region ----
    D.REGIONS.forEach((reg, ri) => {
      if (!reg.mobs || reg.dungeon) return;
      const nCamps = Math.max(2, reg.seeds.length + 1);
      for (let c = 0; c < nCamps; c++) {
        for (let tries = 0; tries < 80; tries++) {
          let x, y;
          if (reg.seeds.length) { const s = reg.seeds[c % reg.seeds.length]; x = Math.round(s[0] + (rnd() - 0.5) * 50); y = Math.round(s[1] + (rnd() - 0.5) * 50); }
          else { x = Math.round(rnd() * W.W); y = Math.round(rnd() * W.H); }
          if (!W.inb(x, y) || W.regionAt(x, y) !== ri || nearCity(x, y, 50) || nearHub(x, y, 16)) continue;
          if (!areaFree(x - 3, y - 3, 7, 7)) continue;
          const kind = /orc|gob|thug|bandit|cutpurse|lizard|nomad|pirate/.test(reg.mobs.join()) ? 'camp' : reg.biome === 'ash' || reg.biome === 'gloom' ? 'graveyard' : 'den';
          makeCamp(kind, x, y, reg);
          W.camps.push({ x, y, ri, kind });
          break;
        }
      }
    });
  }

  // ---------- realms: separate maps for the island, the summit, and every dungeon ----------
  W.REALM_KEYS = ['wallTop', 'stairs', 'W', 'H', 'tiles', 'region', 'vari', 'block', 'doorAt', 'decor', 'buildings', 'lights', 'spawns', 'camps', 'chambers', 'dungeons', 'explored', 'cityData', 'cityBase', 'roads', 'mapCanvas', 'realm', 'portals', 'present', 'seed', 'edge'];
  W.realms = {};
  W.snapshot = function () { const o = {}; for (const k of W.REALM_KEYS) o[k] = W[k]; return o; };
  W.restore = function (o) { for (const k of W.REALM_KEYS) W[k] = o[k]; };
  function presentRegions() { const set = new Set(); for (let i = 0; i < W.region.length; i += 7) set.add(W.region[i]); return set; }
  W.presentRegions = presentRegions;
  function blankRealm(id, size, ri, tile) {
    W.wallTop = null; W.stairs = null; W.edge = null;
    W.realm = id; W.W = W.H = size; const N = size * size;
    W.tiles = new Uint8Array(N).fill(tile); W.region = new Uint8Array(N).fill(ri); W.vari = new Uint8Array(N); W.block = new Uint8Array(N);
    for (let i = 0; i < N; i++) W.vari[i] = Math.floor(U.hash(i % size, (i / size) | 0, 5) * 255);
    W.doorAt = {}; W.decor = []; W.buildings = []; W.lights = []; W.spawns = []; W.camps = []; W.chambers = {}; W.dungeons = {}; W.explored = new Uint8Array((size >> 2) * (size >> 2));
    W.cityData = {}; W.cityBase = {}; W.roads = []; W.mapCanvas = null; W.portals = [];
  }
  W.REALMS = {
    tidesong: { name: 'Isle of Tidesong', sub: 'Across the Shimmering Sea', col: ['#0e3a5a', '#3a8ab0'] },
    summit: { name: 'Skyreach Summit', sub: 'Above the clouds', col: ['#2a3a6a', '#c8d8f0'] },
    sewer_crown: { name: 'Valenmoor Sewers', sub: 'Beneath the streets, where the Rat Tail Gang hides', col: ['#0c120e', '#3a5a44'] },
    sewer_sylvan: { name: 'Aelindor Sewers', sub: 'Old drains under the elven kingdom, overrun by orcs', col: ['#0a120e', '#2e5a4a'] },
    gnollrock: { name: 'Gnollrock Warren', sub: 'A goblin-infested cave', col: ['#1a120c', '#5a4030'] },
    crypt: { name: 'Crypt of the Forsaken', sub: 'Beneath the Ashen Barrows', col: ['#0a140e', '#3a6a4a'] },
    frostfang: { name: 'Frostfang Caverns', sub: 'Ice beneath Ironspine', col: ['#0e1a2a', '#8ac0e0'] },
    sunken: { name: 'Sunken Temple', sub: 'Drowned halls of the tide priests', col: ['#06141e', '#2a7a8a'] },
    abyss: { name: 'Abyssal Depths', sub: 'Where the world ends', col: ['#120408', '#7a1a1a'] },
    main: { name: 'The Realm', sub: 'Aelindor, Valenmoor and the wild lands', col: ['#1a2a1a', '#6a8a4a'] },
  };
  W.genRealm = function (id) {
    const rnd = U.mulberry((W.seed || 1) * 7 + id.length * 131 + id.charCodeAt(0));
    const RI = D.REGION_BY_ID;
    if (id === 'tidesong') {
      const S = 300; blankRealm(id, S, RI.ocean, T.DEEP);
      const IS = D.ISLAND; islandD = (x, y) => { const dx = (x - IS.cx) / IS.rx, dy = (y - IS.cy) / IS.ry; return Math.sqrt(dx * dx + dy * dy) + (U.fbm(x * 0.03, y * 0.03, 71, 3) - 0.5) * 0.3; };
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (islandD(x, y) < 1) W.region[y * S + x] = RI.island;
      paintTerrain(); shoreline(); decorateWorld(); placeCamps(rnd);
      for (const dg of D.DUNGEONS) if (dg.parent === id) carveEntrance(dg);
      buildHubs('tidesong');
      D.REGIONS[RI.island].label = [IS.cx, IS.cy - 40]; D.REGIONS[RI.ocean].label = [IS.cx, 20];
    } else if (id === 'summit') {
      const S = 200; blankRealm(id, S, RI.summit, T.ROCK);
      paintTerrain(); decorateWorld(); placeCamps(rnd);
      buildHubs('summit');
      D.REGIONS[RI.summit].label = [D.SUMMIT.cx, D.SUMMIT.cy - 60];
    } else {
      const dg = D.DUNGEONS.find((x) => x.id === id);
      const dw = dg.type === 'sewer' ? 60 : dg.w, dh = dg.type === 'sewer' ? 46 : dg.h; // sewers: a wider net of tunnels
      const S = Math.max(dw, dh) + 18; blankRealm(id, S, RI[id], T.ROCK);
      const local = Object.assign({}, dg, { w: dw, h: dh, x: Math.floor((S - dw) / 2), y: Math.floor((S - dh) / 2) });
      carveDungeon(local, rnd);
      const dd = W.dungeons[id]; const ins = local.entry === 'n' ? [0, 1] : local.entry === 's' ? [0, -1] : local.entry === 'w' ? [1, 0] : [-1, 0];
      W.portals.push({ x: dd.entry.x, y: dd.entry.y, to: dg.parent || 'main', back: true, label: 'Exit to ' + (dg.parent === 'tidesong' ? 'the Isle of Tidesong' : D.REGIONS[RI[dg.near]] ? D.REGIONS[RI[dg.near]].name : 'the surface') });
      dd.arrive = dd.arrive || [dd.entry.x + ins[0] * 3, dd.entry.y + ins[1] * 3];
      if (dg.type === 'sewer') addDecor('sewerexit', dd.entry.x, dd.entry.y, { nb: true, px: dd.entry.x * TS + 16, py: dd.entry.y * TS + 24 }); else addDecor('exitportal', dd.entry.x, dd.entry.y, { nb: true });
      D.REGIONS[RI[id]].label = [dd.entry.x, dd.entry.y + ins[1] * 6 - 2];
    }
    for (const b of D.BOSSES) if (b.realm === id && !b.dungeon) clearArea(b.at[0] - 3, b.at[1] - 3, 7, 7, null);
    W.makeSpawns(rnd);
    W.buildMinimap(); W.present = presentRegions();
  };
  // a cave mouth on the surface that leads into a dungeon realm
  function carveEntrance(dg) {
    const [ex, ey] = dg.at; const ins = dg.entry === 'n' ? [0, 1] : dg.entry === 's' ? [0, -1] : dg.entry === 'w' ? [1, 0] : [-1, 0];
    const cx = ex + ins[0] * 4, cy = ey + ins[1] * 4;
    for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 6; x <= cx + 6; x++) { if (!W.inb(x, y)) continue; const d = Math.hypot(x - cx, y - cy) + (U.hash(x, y, 33) - 0.5) * 1.6; if (d < 5.2) { W.tiles[y * W.W + x] = T.ROCK; W.block[y * W.W + x] = 0; } }
    W.decor = W.decor.filter((d) => Math.hypot(d.tx - cx, d.ty - cy) > 6);
    // the mouth itself and a clear approach
    for (let k = -1; k <= 1; k++) { const tx = ex + (ins[1] ? k : 0), ty = ey + (ins[0] ? k : 0); if (W.inb(tx, ty)) W.tiles[ty * W.W + tx] = T.CAVE; }
    const ox = ex - ins[0] * 3, oy = ey - ins[1] * 3;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const tx = ox + dx, ty = oy + dy; if (!W.inb(tx, ty)) continue; const k = ty * W.W + tx; if (SOLID[W.tiles[k]] || W.tiles[k] === T.WATER || W.tiles[k] === T.DEEP) W.tiles[k] = T.GRAVEL; W.block[k] = 0; }
    W.decor = W.decor.filter((d) => Math.hypot(d.tx - ox, d.ty - oy) > 3.5);
    addDecor('cavemouth', ex, ey, { nb: true, dir: dg.entry });
    const side = ins[1] ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
    for (const [sx, sy] of side) { const tx = ex - ins[0] + sx * 2, ty = ey - ins[1] + sy * 2; addDecor('torch', tx, ty, {}); W.lights.push({ x: tx * TS + 16, y: ty * TS, r: 170, col: '255,170,90', fl: 0.15, k: 'fire' }); }
    addDecor('cavesign', ex - ins[0] * 2 + side[0][0] * 3, ey - ins[1] * 2 + side[0][1] * 3, { name: W.REALMS[dg.id].name, nb: true });
    W.portals.push({ x: ex, y: ey, to: dg.id, label: W.REALMS[dg.id].name, out: [ox, oy] });
  }

  // ---- the sewer outflow: a brick culvert through the foot of the city wall, on the side that faces the sea ----
  // Each city's sewer drains out through its own wall: an arched pipe big enough to walk into, its grate broken
  // open, and a ditch of foul water running from it down to the nearest open water. It is rebuilt with the city
  // (the walls move out as the kingdom grows), so it always sits right under the wall, a short walk from a gate.
  const OUTFLOW_SIDE = { crown: [-1, 0], sylvan: [0, -1] }; // Valenmoor's west wall faces the bay, Aelindor's north wall the sea
  function placeOutflow(f, R, cx, cy) {
    const dg = D.DUNGEONS.find((d) => d.type === 'sewer' && d.home === f && (d.parent || 'main') === 'main'); if (!dg || W.realm !== 'main') return;
    W.portals = (W.portals || []).filter((p) => p.to !== dg.id); W.decor = W.decor.filter((d) => d.sewerOut !== f); W.lights = W.lights.filter((l) => l.sewerOut !== f);
    const cd = W.cityData[f] || {}; const gates = cd.gates || []; const hb = cd.harbour; const fields = cd.fields || [];
    const isW = (x, y) => { const t = W.tile(x, y); return t === T.WATER || t === T.DEEP; };
    const bad = (x, y) => { if (!W.inb(x, y)) return true; const t = W.tile(x, y); return t === T.CWALL || t === T.WALL || t === T.DOOR || t === T.WOOD || t === T.LAVA || t === T.FARM || !!W.buildingAt(x * TS + 16, y * TS + 16); };
    const inHarbour = (x, y) => { if (!hb) return false; const ox = x - hb.gx, oy = y - hb.gy; const i = ox * hb.dx + oy * hb.dy, sd = ox * hb.px + oy * hb.py; return i >= -3 && i <= hb.k + 3 && Math.abs(sd) <= hb.half + 3; };
    const inField = (x, y) => fields.some((r) => r && x >= r[0] - 2 && y >= r[1] - 2 && x < r[0] + r[2] + 2 && y < r[1] + r[3] + 2);
    const pref = OUTFLOW_SIDE[f] || [0, 1];
    // how far you walk from the nearest gate, outside the walls, to each spot (the harbour walls and the sea cut
    // some stretches of shore off completely)
    const B0 = cx - R - 16, B1 = cy - R - 16, BW2 = 2 * R + 33; const walk = new Int16Array(BW2 * BW2).fill(-1);
    const wIdx = (x, y) => (x < B0 || y < B1 || x >= B0 + BW2 || y >= B1 + BW2 ? -1 : (y - B1) * BW2 + (x - B0));
    { const Q = [];
      for (const [gx, gy] of gates) { const ox = Math.abs(gx - cx) === R ? Math.sign(gx - cx) : 0, oy = Math.abs(gy - cy) === R ? Math.sign(gy - cy) : 0; const sx = gx + ox, sy = gy + oy, i = wIdx(sx, sy); if (i >= 0 && walk[i] < 0 && !W.isBlockedTile(sx, sy)) { walk[i] = 0; Q.push(sx, sy); } }
      for (let q = 0; q < Q.length; q += 2) { const x = Q[q], y = Q[q + 1], d0 = walk[wIdx(x, y)];
        for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + a, ny = y + c, i = wIdx(nx, ny); if (i < 0 || walk[i] >= 0 || Math.max(Math.abs(nx - cx), Math.abs(ny - cy)) <= R || !W.inb(nx, ny) || W.isBlockedTile(nx, ny)) continue; walk[i] = d0 + 1; Q.push(nx, ny); } } }
    const walkTo = (x, y) => { const i = wIdx(x, y); return i < 0 ? -1 : walk[i]; };
    const sides = [pref, [0, 1], [1, 0], [-1, 0], [0, -1]].filter((s2, i, a2) => a2.findIndex((q) => q[0] === s2[0] && q[1] === s2[1]) === i);
    let best = null;
    sides.forEach(([ox, oy], si) => {
      const pxv = -oy, pyv = ox; // along the wall
      for (let t = -(R - 5); t <= R - 5; t++) {
        const wx = ox ? cx + ox * R : cx + t, wy = oy ? cy + oy * R : cy + t;
        if (W.tile(wx, wy) !== T.CWALL) continue;
        if (gates.some(([gx, gy]) => Math.max(Math.abs(gx - wx), Math.abs(gy - wy)) <= 6)) continue;
        const mx = wx + ox, my = wy + oy;
        let ok = true; for (let l = -2; l <= 2 && ok; l++) for (let k = 0; k <= 2 && ok; k++) { const x = mx + ox * k + pxv * l, y = my + oy * k + pyv * l; if (bad(x, y) || inHarbour(x, y) || inField(x, y) || (k === 0 && isW(x, y))) ok = false; }
        if (!ok) continue;
        let len = 0, roads = 0;
        for (let k = 2; k <= 14; k++) { const x = mx + ox * k, y = my + oy * k; if (isW(x, y)) { len = k; break; } if (bad(x, y) || inHarbour(x, y) || inField(x, y)) break; const tt = W.tile(x, y); if (tt === T.ROAD || tt === T.BRIDGE) roads++; }
        let wk = 1e9; for (let k = 1; k <= 2; k++) for (let l = -1; l <= 1; l++) { const v = walkTo(mx + ox * k + pxv * l, my + oy * k + pyv * l); if (v >= 0) wk = Math.min(wk, v); }
        if (wk > 1e8) continue; // can't be reached on foot from any gate
        const score = (len ? len * 0.8 : 30) + si * 3 + roads * 5 + wk * 0.6 + (len ? 0 : 40);
        if (!best || score < best.score) best = { score, wx, wy, mx, my, ox, oy, pxv, pyv, len };
      }
    });
    if (!best) return;
    const { mx, my, ox, oy, pxv, pyv } = best; let len = best.len;
    const setT = (x, y, t, blk = 0) => { if (!W.inb(x, y)) return; const k = y * W.W + x; W.tiles[k] = t; W.block[k] = blk; };
    // nothing grows or stands on the culvert, its wings, the ditch and its banks
    const pond = !len; if (pond) len = 7;
    const ditch = []; const wet = (x, y) => { for (const [a, c] of [[0, 0], [1, 0], [0, 1], [1, 1]]) ditch.push((y + c) * W.W + x + a); }; // for the murky brown water in 3D
    W.decor = W.decor.filter((d) => { const ax = d.tx - mx, ay = d.ty - my; const i = ax * ox + ay * oy, sd = ax * pxv + ay * pyv; return !(i >= -1 && i <= len + (pond ? 3 : 1) && Math.abs(sd) <= (i <= 2 ? 3 : 2)); });
    // the culvert mouth (walk in here) between two wing walls of brick
    setT(mx, my, T.STONE);
    for (const l of [-1, 1]) setT(mx + pxv * l, my + pyv * l, T.STONE, 1);
    // a ditch of sewer water from the mouth to the sea, with muddy banks; a road it crosses gets a little bridge
    for (let k = 1; k < len; k++) {
      const x = mx + ox * k, y = my + oy * k; const tt = W.tile(x, y);
      if (tt === T.ROAD || tt === T.BRIDGE) setT(x, y, T.BRIDGE); else setT(x, y, T.WATER); wet(x, y);
      for (const l of [-1, 1]) { const bx = x + pxv * l, by = y + pyv * l; const bt = W.tile(bx, by); if (bt == null || bt === T.ROAD || bt === T.BRIDGE || isW(bx, by) || bad(bx, by)) continue; setT(bx, by, k <= 2 ? T.GRAVEL : T.MUD); }
    }
    if (pond) for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const d2 = Math.hypot(i, j); if (d2 > 2.4) continue; const x = mx + ox * (len + 1 + j) + pxv * i, y = my + oy * (len + 1 + j) + pyv * i; if (!bad(x, y)) { setT(x, y, d2 < 1.2 ? T.DEEP : T.WATER); wet(x, y); } }
    const ry = Math.atan2(ox, oy); // the mouth's front faces out, away from the wall
    addDecor('sewermouth', mx, my, { nb: true, px: mx * TS + 16, py: my * TS + 24, ry, sewerOut: f, ditchLen: pond ? 0 : len });
    W.lights.push({ x: (mx + pxv * 1.2) * TS + 16 + ox * 10, y: (my + pyv * 1.2) * TS + 16 + oy * 10, r: 150, col: '255,176,96', fl: 0.12, k: 'fire', sewerOut: f });
    const sx = mx + ox * 2 + pxv * 2, sy = my + oy * 2 + pyv * 2;
    if (!bad(sx, sy) && !isW(sx, sy)) addDecor('cavesign', sx, sy, { name: W.REALMS[dg.id].name, nb: true, sewerOut: f });
    const ex = mx + ox * 2 - pxv, ey = my + oy * 2 - pyv; // where you come out: on the bank beside the ditch
    if (W.inb(ex, ey) && !isW(ex, ey)) { setT(ex, ey, T.GRAVEL); }
    dg.at = [mx, my]; dg.out = [ex, ey]; dg.outDir = [ox, oy]; cd.ditch = ditch;
    W.portals.push({ x: mx, y: my, to: dg.id, label: W.REALMS[dg.id].name, out: [ex, ey], sewer: true });
  }

  // ---------- sewers: a net of brick tunnels ----------
  // Straight vaulted tunnels on a grid, each three tiles wide: a walkway either side of a channel of foul water.
  // Where tunnels meet there are junctions; some of the crossings are chambers (the gang's dens, two cisterns with
  // deep pools, Vinny's cell and the boss's hall at the far end), and short dead-end side passages end under a
  // shaft of daylight with a ladder up to a grate. Every tunnel connects: the grid is a spanning tree plus loops.
  function carveSewer(dg, rnd) {
    const fl = T.STONE;
    const X0 = dg.x + 2, Y0 = dg.y + 2, X1 = dg.x + dg.w - 3, Y1 = dg.y + dg.h - 3;
    for (let y = dg.y; y < dg.y + dg.h; y++) for (let x = dg.x; x < dg.x + dg.w; x++) if (W.inb(x, y)) { W.tiles[y * W.W + x] = T.WALL; W.block[y * W.W + x] = 0; }
    W.decor = W.decor.filter((d) => !(d.tx >= dg.x && d.tx < dg.x + dg.w && d.ty >= dg.y && d.ty < dg.y + dg.h));
    const inA = (x, y) => x >= X0 && y >= Y0 && x <= X1 && y <= Y1;
    const set = (x, y, t = fl) => { if (inA(x, y)) W.tiles[y * W.W + x] = t; };
    const ent = [dg.x + (dg.w >> 1), dg.y + dg.h - 1]; // the outflow: south edge
    // the grid of junctions
    const NX = 5, NY = 4;
    const colX = [], rowY = [];
    for (let i = 0; i < NX; i++) colX.push(Math.round(X0 + 4 + i * (X1 - X0 - 8) / (NX - 1)));
    for (let j = 0; j < NY; j++) rowY.push(Math.round(Y0 + 4 + j * (Y1 - Y0 - 8) / (NY - 1)));
    const midI = NX >> 1; colX[midI] = ent[0]; // the trunk runs straight in from the outflow
    const node = (i, j) => ({ i, j, x: colX[i], y: rowY[j] });
    const key = (i, j) => i + ',' + j;
    // a spanning tree by random depth-first walk from the junction above the outflow, then a few loops
    const edges = new Set(), seen = new Set([key(midI, NY - 1)]); const stack = [[midI, NY - 1]];
    const eKey = (a, b) => (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) ? key(...a) + '|' + key(...b) : key(...b) + '|' + key(...a);
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [i + a, j + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < NX && b < NY && !seen.has(key(a, b)));
      if (!nb.length) { stack.pop(); continue; }
      const n = nb[Math.floor(rnd() * nb.length)]; seen.add(key(...n)); edges.add(eKey([i, j], n)); stack.push(n);
    }
    const all = []; for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) { if (i + 1 < NX) all.push([[i, j], [i + 1, j]]); if (j + 1 < NY) all.push([[i, j], [i, j + 1]]); }
    let loops = 0; for (let t = 0; t < 40 && loops < 4; t++) { const e = all[Math.floor(rnd() * all.length)]; const k = eKey(e[0], e[1]); if (!edges.has(k)) { edges.add(k); loops++; } }
    const deg = new Map(); for (const e of edges) for (const n of e.split('|')) deg.set(n, (deg.get(n) || 0) + 1);
    // which junctions are chambers: the one by the outflow, then dead ends and far crossings, spread out
    const dist = (n) => Math.hypot(n.x - ent[0], n.y - ent[1]);
    const nodes = []; for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) nodes.push(node(i, j));
    const start = node(midI, NY - 1);
    const pick = [start];
    const cand = nodes.filter((n) => n !== start && !(n.i === start.i && n.j === start.j)).sort((a, b) => ((deg.get(key(a.i, a.j)) === 1 ? -1 : 0) - (deg.get(key(b.i, b.j)) === 1 ? -1 : 0)) || (rnd() - 0.5));
    for (const n of cand) { if (pick.length >= dg.rooms) break; if (pick.some((o) => Math.abs(o.i - n.i) + Math.abs(o.j - n.j) < 2)) continue; pick.push(n); }
    for (const n of cand) { if (pick.length >= dg.rooms) break; if (!pick.includes(n)) pick.push(n); }
    pick.sort((a, b) => dist(a) - dist(b));
    // the far hall must be the farthest of all, Vinny's cell next to it
    const rooms = pick.map((n, k) => ({ x: n.x, y: n.y, r: k === 0 ? 2 : k === pick.length - 1 ? 4 : 3, i: n.i, j: n.j }));
    const L = rooms.length;
    rooms[L - 2].r = 2; // Vinny's cell is a small vault
    // tunnels: three wide, a channel down the middle
    const segs = [], chan = [];
    const carveSeg = (a, b) => {
      const horiz = a.y === b.y; const s0 = horiz ? Math.min(a.x, b.x) : Math.min(a.y, b.y), s1 = horiz ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
      for (let t = s0; t <= s1; t++) for (let w = -1; w <= 1; w++) { const x = horiz ? t : a.x + w, y = horiz ? a.y + w : t; set(x, y); if (w === 0) chan.push([x, y]); }
      segs.push({ horiz, a: s0, b: s1, c: horiz ? a.y : a.x });
    };
    for (const e of edges) { const [p, q] = e.split('|').map((k) => k.split(',').map(Number)); carveSeg(node(...p), node(...q)); }
    // the way in from the outflow
    carveSeg({ x: ent[0], y: ent[1] }, start);
    // junctions are a little wider than the tunnels; chambers are vaulted halls
    const roomAt = (x, y) => rooms.find((o) => Math.abs(x - o.x) <= o.r && Math.abs(y - o.y) <= o.r);
    for (const n of nodes) if (deg.get(key(n.i, n.j)) || n === start) for (let y = n.y - 2; y <= n.y + 2; y++) for (let x = n.x - 2; x <= n.x + 2; x++) if (Math.abs(x - n.x) + Math.abs(y - n.y) <= 3) set(x, y);
    for (const o of rooms) for (let y = o.y - o.r; y <= o.y + o.r; y++) for (let x = o.x - o.r; x <= o.x + o.r; x++) set(x, y);
    // the channels: water down the middle of every tunnel and through the junctions, but not across the chambers
    for (const [x, y] of chan) if (!roomAt(x, y) && inA(x, y)) W.tiles[y * W.W + x] = T.WATER;
    // cisterns: two of the middle chambers hold a deep pool with a walk around it; the far hall has one at its back
    const pools = [];
    const cisterns = [2, 4].filter((k) => k < L - 3);
    for (const k of cisterns) { const o = rooms[k]; o.cistern = true; pools.push([o.x - 1, o.y - 1, o.x + 1, o.y + 1]); }
    { const o = rooms[L - 1]; pools.push([o.x - 2, o.y - o.r, o.x + 2, o.y - o.r + 2]); o.hall = true; }
    for (const [ax, ay, bx, by] of pools) for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if (inA(x, y)) W.tiles[y * W.W + x] = (x === ax || x === bx || y === ay || y === by) && bx - ax > 2 ? T.WATER : T.DEEP;
    // side passages: short dead ends off the tunnels, each ending under a shaft of daylight with a ladder
    const spurs = [];
    const solidRun = (x, y, dx, dy, n) => { for (let k = 1; k <= n; k++) for (let w = -2; w <= 2; w++) { const tx = x + dx * k + (dx ? 0 : w), ty = y + dy * k + (dy ? 0 : w); if (!inA(tx, ty) || W.tile(tx, ty) !== T.WALL) return false; } return true; };
    for (let t = 0; t < 80 && spurs.length < 6; t++) {
      const sg = segs[Math.floor(rnd() * segs.length)]; if (sg.b - sg.a < 7) continue;
      const along = sg.a + 3 + Math.floor(rnd() * (sg.b - sg.a - 6)); const side = rnd() < 0.5 ? -1 : 1; const len = 3 + Math.floor(rnd() * 2);
      const [dx, dy] = sg.horiz ? [0, side] : [side, 0]; const bx = sg.horiz ? along : sg.c + side * 1, by = sg.horiz ? sg.c + side * 1 : along;
      if (spurs.some((q) => Math.abs(q.x - bx) + Math.abs(q.y - by) < 6) || !solidRun(bx, by, dx, dy, len + 1)) continue;
      for (let k = 1; k <= len; k++) set(bx + dx * k, by + dy * k);
      spurs.push({ x: bx + dx * len, y: by + dy * len, dir: [dx, dy], len });
    }
    // Vinny's cell: no monsters spawn in it
    const cell = rooms[L - 2];
    W.dungeonsCell = W.dungeonsCell || {}; W.dungeonsCell[dg.id] = { x: cell.x, y: cell.y, r: cell.r };
    // the outflow mouth: open the edge tile so the exit sits in the tunnel
    for (let k = 0; k < 3; k++) for (let w = -1; w <= 1; w++) { const x = ent[0] + w, y = ent[1] - k; if (W.inb(x, y)) W.tiles[y * W.W + x] = w === 0 ? T.WATER : fl; }
    W.tiles[ent[1] * W.W + ent[0]] = fl;
    // furnishings: rubbish heaps in the dens, pipes spilling into the halls, grates of light, torches
    const deco = { sewer_crown: ['barrel', 'crate', 'bones', 'pebbles'], sewer_sylvan: ['barrel', 'bones', 'crate', 'mushroom'] }[dg.id] || ['barrel', 'bones'];
    const free = (x, y) => W.tile(x, y) === fl && !W.decor.some((d) => d.tx === x && d.ty === y);
    for (const o of rooms) {
      if (o.y - o.r - 1 >= Y0) addDecor('drainpipe', o.x + (o.cistern ? 0 : 2), o.y - o.r - 1, { nb: true, px: (o.x + (o.cistern ? 0 : 2)) * TS + 16, py: (o.y - o.r) * TS - 4 });
      if (!o.cistern && !o.hall && o !== cell && o !== rooms[0]) addDecor('grate', o.x, o.y + 1, { nb: true, px: o.x * TS + 16, py: (o.y + 1) * TS + 16 }).flat = true;
      W.lights.push({ x: o.x * TS + 16, y: o.y * TS, r: 120 + o.r * 22, col: '255,170,90', fl: 0.15, k: 'fire' });
      for (const [cx2, cy2] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) { const tx = o.x + cx2 * o.r, ty = o.y + cy2 * o.r; if (free(tx, ty) && rnd() < 0.8) addDecor('torch', tx, ty, {}); }
      for (let k = 0; k < (o.hall ? 6 : 3); k++) { const a = rnd() * 6.28, rr = o.r - 0.5; const tx = Math.round(o.x + Math.cos(a) * rr), ty = Math.round(o.y + Math.sin(a) * rr); if (free(tx, ty) && Math.hypot(tx - ent[0], ty - ent[1]) > 4) addDecor(deco[k % deco.length], tx, ty, { nb: k > 0 }); }
    }
    for (const sp of spurs) { W.lights.push({ x: sp.x * TS + 16, y: sp.y * TS + 16, r: 130, col: '190,210,235', fl: 0.02, k: 'lamp' }); if (rnd() < 0.6) addDecor(deco[Math.floor(rnd() * deco.length)], sp.x - sp.dir[0], sp.y - sp.dir[1], { nb: true }); }
    // a lamp now and then along the long tunnels (on the walkway, against the wall)
    for (const sg of segs) for (let t = sg.a + 4; t < sg.b - 3; t += 9) { const side = ((t + sg.c) % 2) ? 1 : -1; const x = sg.horiz ? t : sg.c + side, y = sg.horiz ? sg.c + side : t; if (!roomAt(x, y) && free(x, y)) W.lights.push({ x: x * TS + 16, y: y * TS + 16, r: 110, col: '255,160,80', fl: 0.18, k: 'fire' }); }
    W.dungeons[dg.id] = { rooms, entry: { x: ent[0], y: ent[1] }, floor: fl, def: dg, cell: W.dungeonsCell[dg.id], sewer: { segs, spurs, pools, cols: colX, rows: rowY }, arrive: [ent[0] + 1, ent[1] - 3] }; // arrive on the walkway, not in the channel
    for (const bid of dg.bosses) { const b = D.BOSS_BY_ID[bid]; const room = rooms[rooms.length + (b.room || -1)] || rooms[rooms.length - 1]; b.at = [room.x, room.y + (room.hall ? 1 : 0)]; }
  }
  // ---------- dungeons ----------
  function carveDungeon(dg, rnd) {
    if (dg.type === 'sewer') return carveSewer(dg, rnd);
    const sewer = dg.type === 'sewer';
    const floor = { cave: T.CAVE, crypt: T.STONE, sewer: T.STONE }[dg.type] || T.CAVE;
    const fl = dg.id === 'frostfang' ? T.ICE : dg.id === 'abyss' ? T.SCAR : dg.id === 'sunken' ? T.STONE : floor;
    const wallT = dg.type === 'crypt' || sewer ? T.WALL : T.ROCK;
    const x0 = dg.x + 2, y0 = dg.y + 2, x1 = dg.x + dg.w - 3, y1 = dg.y + dg.h - 3;
    for (let y = dg.y; y < dg.y + dg.h; y++) for (let x = dg.x; x < dg.x + dg.w; x++) if (W.inb(x, y)) { W.tiles[y * W.W + x] = wallT; W.block[y * W.W + x] = 0; }
    W.decor = W.decor.filter((d) => !(d.tx >= dg.x && d.tx < dg.x + dg.w && d.ty >= dg.y && d.ty < dg.y + dg.h));
    const set = (x, y) => { if (x >= x0 && y >= y0 && x <= x1 && y <= y1) W.tiles[y * W.W + x] = fl; };
    // entrance on the chosen side
    const ent = dg.entry === 'n' ? [dg.x + (dg.w >> 1), dg.y] : dg.entry === 's' ? [dg.x + (dg.w >> 1), dg.y + dg.h - 1] : dg.entry === 'w' ? [dg.x, dg.y + (dg.h >> 1)] : [dg.x + dg.w - 1, dg.y + (dg.h >> 1)];
    const inward = dg.entry === 'n' ? [0, 1] : dg.entry === 's' ? [0, -1] : dg.entry === 'w' ? [1, 0] : [-1, 0];
    // rooms
    const rooms = []; const first = [ent[0] + inward[0] * 6, ent[1] + inward[1] * 6];
    rooms.push({ x: first[0], y: first[1], r: 3 });
    let tries = 0;
    while (rooms.length < dg.rooms && tries++ < 600) {
      const r = dg.type === 'crypt' || sewer ? 3 + Math.floor(rnd() * 2) : 3 + Math.floor(rnd() * 3);
      const x = Math.round(x0 + r + 1 + rnd() * (x1 - x0 - 2 * r - 2)), y = Math.round(y0 + r + 1 + rnd() * (y1 - y0 - 2 * r - 2));
      if (rooms.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + r + 5)) continue;
      rooms.push({ x, y, r });
    }
    // order rooms by distance from the entrance, connect each to its nearest earlier room
    rooms.sort((a, b) => Math.hypot(a.x - ent[0], a.y - ent[1]) - Math.hypot(b.x - ent[0], b.y - ent[1]));
    const carveRoom = (o) => {
      if (dg.type === 'crypt' || sewer) { for (let y = o.y - o.r; y <= o.y + o.r; y++) for (let x = o.x - o.r - 1; x <= o.x + o.r + 1; x++) set(x, y); }
      else for (let y = o.y - o.r - 1; y <= o.y + o.r + 1; y++) for (let x = o.x - o.r - 2; x <= o.x + o.r + 2; x++) { const d = Math.hypot((x - o.x) / 1.2, y - o.y) + (U.hash(x, y, 81) - 0.5) * 1.6; if (d < o.r + 0.6) set(x, y); }
    };
    const chan = [];
    const tunnel = (a, b) => {
      let x = a.x, y = a.y; const w = sewer ? 2 : 1;
      let guard = 0;
      while ((x !== b.x || y !== b.y) && guard++ < 400) {
        if (sewer) chan.push([x, y]);
        if (dg.type === 'crypt' || sewer) { if (x !== b.x && (y === b.y || guard % 2)) x += Math.sign(b.x - x); else y += Math.sign(b.y - y); }
        else { if (rnd() < 0.25) { const d = rnd() < 0.5 ? [Math.sign(b.x - x) || 1, 0] : [0, Math.sign(b.y - y) || 1]; x += d[0]; y += d[1]; } else if (Math.abs(b.x - x) > Math.abs(b.y - y)) x += Math.sign(b.x - x); else y += Math.sign(b.y - y); }
        for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) set(x + dx, y + dy);
      }
    };
    rooms.forEach(carveRoom);
    for (let i = 1; i < rooms.length; i++) { let bj = 0, bd = 1e9; for (let j = 0; j < i; j++) { const d = Math.hypot(rooms[i].x - rooms[j].x, rooms[i].y - rooms[j].y); if (d < bd) { bd = d; bj = j; } } tunnel(rooms[bj], rooms[i]); }
    // a loop or two so it isn't a pure tree
    if (rooms.length > 4 && !sewer) { tunnel(rooms[2], rooms[rooms.length - 2]); }
    if (sewer && rooms.length > 5) tunnel(rooms[2], rooms[rooms.length - 4]);
    // sewer: a channel of filthy water runs down the middle of every tunnel (not through the rooms)
    if (sewer) {
      const inRoom = (x, y) => rooms.some((o) => Math.abs(x - o.x) <= o.r + 1 && Math.abs(y - o.y) <= o.r);
      for (const [x, y] of chan) if (!inRoom(x, y) && W.tile(x, y) === fl) W.tiles[y * W.W + x] = T.WATER;
      // the last room spills out through a grate into a deep cistern
      const L = rooms[rooms.length - 1];
      for (let y = L.y - L.r - 2; y <= L.y - L.r - 1; y++) for (let x = L.x - 2; x <= L.x + 2; x++) if (x >= x0 && y >= y0) W.tiles[y * W.W + x] = y === L.y - L.r - 2 ? T.DEEP : T.WATER;
      // Vinny's cell: the room just before the gang boss; no monsters spawn in it
      const cell = rooms[rooms.length - 2];
      W.dungeonsCell = W.dungeonsCell || {}; W.dungeonsCell[dg.id] = { x: cell.x, y: cell.y, r: cell.r };
    }
    // entrance corridor from the outside edge
    let ex = ent[0], ey = ent[1];
    for (let k = 0; k < 9; k++) { for (let s = -1; s <= 1; s++) { const tx = ex + (inward[1] ? s : 0), ty = ey + (inward[0] ? s : 0); if (W.inb(tx, ty)) W.tiles[ty * W.W + tx] = fl; } ex += inward[0]; ey += inward[1]; }
    // clear the outside approach
    const ox = ent[0] - inward[0] * 3, oy = ent[1] - inward[1] * 3;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const tx = ox + dx, ty = oy + dy; if (!W.inb(tx, ty)) continue; const k = ty * W.W + tx; if (D.REGIONS[W.region[k]].dungeon) continue; if (SOLID[W.tiles[k]] || W.tiles[k] === T.WATER || W.tiles[k] === T.DEEP) W.tiles[k] = T.GRAVEL; W.block[k] = 0; }
    // entrance markers and lights
    const side = inward[1] ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
    for (const [sx, sy] of side) { const tx = ent[0] - inward[0] + sx * 2, ty = ent[1] - inward[1] + sy * 2; addDecor('torch', tx, ty, {}); W.lights.push({ x: tx * TS + 16, y: ty * TS, r: 170, col: '255,170,90', fl: 0.15, k: 'fire' }); }
    addDecor('cavesign', ent[0] - inward[0] * 2 + side[0][0] * 3, ent[1] - inward[1] * 2 + side[0][1] * 3, { name: D.REGIONS[D.REGION_BY_ID[dg.id]].name, nb: true });
    // furnishings and lights inside
    const deco = { sewer_crown: ['barrel', 'crate', 'bones', 'pebbles'], sewer_sylvan: ['barrel', 'bones', 'crate', 'mushroom'], gnollrock: ['stalagmite', 'mushroom', 'bones', 'crate'], crypt: ['tomb', 'bones', 'pillar', 'sarcophagus'], frostfang: ['icecrystal', 'stalagmite', 'snowtuft', 'bones'], sunken: ['pillar', 'reeds', 'statue', 'bones'], abyss: ['crystal', 'bones', 'charred', 'ember'] }[dg.id] || ['bones'];
    for (const o of rooms) {
      if (sewer) { addDecor('drainpipe', o.x, o.y - o.r - 1, { nb: true, px: o.x * TS + 16, py: (o.y - o.r) * TS - 4 }); if (o !== rooms[rooms.length - 2]) addDecor('grate', o.x, o.y, { nb: true, px: o.x * TS + 16, py: o.y * TS + 16 }).flat = true; }
      const lc = dg.id === 'frostfang' ? '150,210,255' : dg.id === 'abyss' ? '255,80,60' : dg.id === 'sunken' ? '90,200,220' : dg.id === 'crypt' ? '150,255,170' : '255,170,90';
      W.lights.push({ x: o.x * TS + 16, y: o.y * TS, r: 120 + o.r * 18, col: lc, fl: 0.15, k: dg.type === 'crypt' ? 'ghost' : 'fire' });
      for (let k = 0; k < 3; k++) { const a = rnd() * 6.28, rr = o.r - 0.5; const tx = Math.round(o.x + Math.cos(a) * rr), ty = Math.round(o.y + Math.sin(a) * rr); if (W.tile(tx, ty) === fl && Math.hypot(tx - ent[0], ty - ent[1]) > 4) addDecor(deco[k % deco.length], tx, ty, { nb: k > 0 }); }
    }
    W.dungeons[dg.id] = { rooms, entry: { x: ent[0], y: ent[1] }, floor: fl, def: dg, cell: sewer ? W.dungeonsCell[dg.id] : null };
    // place this dungeon's bosses in the far rooms
    for (const bid of dg.bosses) { const b = D.BOSS_BY_ID[bid]; const room = rooms[rooms.length + (b.room || -1)] || rooms[rooms.length - 1]; b.at = [room.x, room.y]; }
  }
  // ---------- hubs ----------
  function nearHub(x, y, r) { for (const k in D.HUBS) { if ((D.HUBS[k].realm || 'main') !== W.realm) continue; const [hx, hy] = D.HUBS[k].at; if (Math.abs(x - hx) < r && Math.abs(y - hy) < r) return true; } return false; }
  W.nearHub = nearHub;
  function buildHubs(realm) {
    if (realm === 'tidesong') {
    // Port Tidesong on the island's west shore
    const [tx, ty] = D.HUBS.tidesong.at;
    clearArea(tx - 9, ty - 11, 24, 23, T.GRASS);
    for (let y = ty - 9; y <= ty + 9; y++) for (let x = tx - 6; x <= tx + 12; x++) if (W.inb(x, y)) W.tiles[y * W.W + x] = (x + y) % 7 ? T.COBBLE : T.GRAVEL;
    stampBuilding({ x: tx - 5, y: ty - 9, w: 8, h: 6, type: 'inn', name: 'The Salty Gull', faction: null, style: 'crown', minLevel: 1, hub: 'tidesong' });
    stampBuilding({ x: tx + 5, y: ty - 9, w: 6, h: 5, type: 'store', name: 'Tidesong Trading Post', faction: null, style: 'crown', minLevel: 1, hub: 'tidesong' });
    stampBuilding({ x: tx + 5, y: ty + 3, w: 6, h: 5, type: 'smithy', name: 'Driftwood Forge', faction: null, style: 'crown', minLevel: 1, hub: 'tidesong' });
    dock(tx - 7, ty, -1, 0); addDecor('boat', tx - 14, ty + 1, { nb: true }); addDecor('banner', tx - 3, ty + 1, { nb: true });
    W.lights.push({ x: (tx + 2) * TS, y: ty * TS, r: 260, col: '255,200,130', fl: 0.08, k: 'lamp' }); addDecor('lamp', tx + 2, ty - 2, {}); addDecor('lamp', tx + 2, ty + 2, {});
    return; }
    if (realm === 'main') {
    // Sunscour Docks on the desert coast: find the shoreline east of the camp so the pier runs half over sand, half over water
    { const [ox, oy] = D.HUBS.docks.at; let sx = null;
      for (let x = ox; x < ox + 60 && sx == null; x++) { const t = W.tile(x, oy); if (t === T.WATER || SOLID[t]) sx = x; }
      if (sx != null) D.HUBS.docks.at = [sx - 6, oy]; }
    const [dx, dy] = D.HUBS.docks.at;
    clearArea(dx - 6, dy - 5, 9, 11, T.SAND);
    dock(dx + 2, dy, 1, 0); addDecor('boat', dx + 9, dy + 1, { nb: true }); addDecor('tent', dx - 4, dy - 3, { col: '#c8a060' }); addDecor('crate', dx - 2, dy + 3, {}); addDecor('lamp', dx, dy - 2, {});
    W.lights.push({ x: dx * TS, y: dy * TS, r: 220, col: '255,200,130', fl: 0.08, k: 'lamp' });
    // Emberwing's roost near the dragon
    const [lx, ly] = D.HUBS.lair.at; clearArea(lx - 4, ly - 4, 9, 9, T.GRAVEL);
    return; }
    // Eyrie Camp on the summit
    const [ex, ey] = D.HUBS.eyrie.at;
    clearArea(ex - 8, ey - 6, 17, 13, T.GRASS);
    addDecor('tent', ex - 5, ey - 3, { col: '#4a6aaa' }); addDecor('tent', ex + 5, ey - 3, { col: '#aa6a4a' }); addDecor('campfire', ex, ey, {}); addDecor('balloon', ex + 6, ey + 3, { nb: true });
    W.lights.push({ x: ex * TS + 16, y: ey * TS, r: 240, col: '255,180,100', fl: 0.15, k: 'fire' });
  }
  function dock(x, y, dx) {
    for (let k = 0; k < 9; k++) for (let w = -1; w <= 1; w++) { const tx = x + dx * k, ty = y + w; if (W.inb(tx, ty)) { W.tiles[ty * W.W + tx] = T.WOOD; W.block[ty * W.W + tx] = 0; } }
    for (let k = 0; k < 9; k += 3) for (const w of [-2, 2]) { const tx = x + dx * k, ty = y + w; if (W.inb(tx, ty)) addDecor('post', tx, ty, { nb: true }); }
  }

  // ---- no way down into the sewers from inside a city: they are reached only by the outflow outside the walls ----
  // (this clears any grate an older version of the world left in the streets)
  function cityGrate(f, R, cx, cy) {
    W.portals = (W.portals || []).filter((p) => p.cityGrate !== f); W.decor = W.decor.filter((d) => !(d.cityGrate && (d.cityGrate === true || d.cityGrate === f)));
    if (R != null) placeOutflow(f, R, cx, cy); // ...but by the brick outflow under the city wall
  }
  // ---- the wall-walk: the top of the city wall can be walked, reached by stone stairs inside the wall ----
  // W.wallTop marks walkable wall tiles (not the corner towers or the gatehouses); W.stairs maps a tile to its step
  function wallWalks(f, R, cx, cy) {
    if (!W.wallTop || W.wallTop.length !== W.W * W.H) W.wallTop = new Uint8Array(W.W * W.H);
    if (!W.stairs) W.stairs = new Map();
    // clear this city's old wall-walk (the wall may have moved outward with a new level)
    for (let ty = cy - 46; ty <= cy + 46; ty++) for (let tx = cx - 46; tx <= cx + 46; tx++) if (W.inb(tx, ty)) W.wallTop[ty * W.W + tx] = 0;
    const gates = W.cityData[f].gates;
    const nearGate = (tx, ty) => gates.some(([gx, gy]) => Math.abs(tx - gx) <= 3 && Math.abs(ty - gy) <= 3);
    for (let ty = cy - R; ty <= cy + R; ty++) for (let tx = cx - R; tx <= cx + R; tx++) {
      const dx = tx - cx, dy = ty - cy; if (Math.abs(dx) !== R && Math.abs(dy) !== R) continue;
      if (Math.abs(dx) >= R - 1 && Math.abs(dy) >= R - 1) continue; // corner towers
      if (W.tile(tx, ty) !== T.CWALL || nearGate(tx, ty)) continue;
      W.wallTop[ty * W.W + tx] = 1;
    }
    // stairs run along the inside of the wall, six steps of a tile each: one flight on each side of every gate, climbing
    // toward the gate (from the top you shoot down on whoever attacks it), and one more on a side with no gate
    const LEN = 6;
    const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    // a flight along side (nx, ny) over wall offsets o0..o0+LEN-1, climbing in direction sg (+1 or -1 along the wall)
    const flight = (nx, ny, o0, sg) => {
      const ax = ny ? 1 : 0, ay = nx ? 1 : 0; // along the wall
      const tiles = [];
      for (let k = 0; k < LEN; k++) {
        const o = sg > 0 ? o0 + k : o0 + LEN - 1 - k; // k counts up the flight
        const tx = cx + nx * (R - 1) + ax * o, ty = cy + ny * (R - 1) + ay * o;
        const wx = tx + nx, wy = ty + ny; const i = ty * W.W + tx;
        if (!W.inb(tx, ty) || W.stairs.get(i) || W.buildingAt(tx * TS + 16, ty * TS + 16) || SOLID[W.tiles[i]] || W.tiles[i] === T.DOOR || W.tiles[i] === T.WATER || (k === LEN - 1 && !W.wallTop[wy * W.W + wx])) return false;
        tiles.push([tx, ty, i]);
      }
      // the foot of the flight must open onto the street
      const [fx, fy] = tiles[0], bx = fx - ax * sg, by = fy - ay * sg; if (!W.inb(bx, by) || SOLID[W.tile(bx, by)] || W.buildingAt(bx * TS + 16, by * TS + 16)) return false;
      tiles.forEach(([tx, ty, i], k) => { W.tiles[i] = T.STONE; W.block[i] = 0; W.decor = W.decor.filter((d) => !(d.tx === tx && d.ty === ty)); W.stairs.set(i, { f, k, n: LEN, dir: [ax * sg, ay * sg], wall: [nx, ny], top: k === LEN - 1 }); });
      return true;
    };
    for (const [nx, ny] of sides) {
      let n = 0;
      for (const [gx, gy] of gates) {
        if ((nx && gx - cx !== nx * R) || (ny && gy - cy !== ny * R)) continue; // a gate in this side
        const g = nx ? gy - cy : gx - cx; // the gate's middle along the wall
        const off = nx ? 5 : ny < 0 ? 5 : 4; // the top step just clear of the gatehouse and the gate guards
        if (flight(nx, ny, g + off, -1)) n++; // east / south of the gate, climbing back toward it
        if (flight(nx, ny, g - off - LEN + 1, 1)) n++;
      }
      if (n) continue;
      for (const start of [-R + 3, R - 3 - LEN, -10, 4]) if (flight(nx, ny, start, 1)) break;
    }
  }
  // ---- the harbour outside a capital's sea gate: a paved quay, three wooden piers and ships of every size ----
  function harbour(f, R, cx, cy) {
    // from the sea gate straight out to the water
    const [gx, gy, dx, dy] = f === 'sylvan' ? [cx, cy - R - 1, 0, -1] : [cx - R - 1, cy + 3, -1, 0];
    const isW = (x, y) => { const t = W.tile(x, y); return t === T.WATER || t === T.DEEP; };
    let k = 0; while (k < 60 && !isW(gx + dx * k, gy + dy * k)) k++;
    if (k >= 60) return;
    // a rebuilt city rebuilds its harbour: clear the old one first (some of it lies outside the city's own area)
    W.decor = W.decor.filter((d) => d.harbour !== f);
    const deco = (kind, x, y, o = {}) => addDecor(kind, x, y, Object.assign({ harbour: f }, o));
    const px = -dy, py = dx; // along the shore
    const half = Math.min(R + 1, 11), P2 = (i, sd) => [gx + dx * i + px * sd, gy + dy * i + py * sd];
    // the marina sits right at the sea gate at every size of city: a short quay, then the water. A small city
    // gets a basin dug out to the old shore (wide enough for the piers and the ships along them); a big one
    // that has grown to the shore fills in a strip of sea for its quay
    const KQ = 6, KMIN = 4, BW = half + 17;
    if (k > KQ) {
      for (let sd = -BW - 2; sd <= BW + 2; sd++) for (let i = KQ; i < k + 16; i++) {
        const edge = BW + Math.floor(U.hash(i, sd > 0 ? 1 : 2, 57) * 3) - (i === KQ ? 2 : 0); if (Math.abs(sd) > edge) continue;
        const [x, y] = P2(i, sd); if (!W.inb(x, y)) break; const j = y * W.W + x;
        if (isW(x, y)) break; // reached the open sea in this column
        if (W.tiles[j] === T.CWALL) continue;
        W.tiles[j] = i < KQ + 2 || Math.abs(sd) > edge - 2 ? T.WATER : T.DEEP; W.block[j] = 0;
      }
      W.decor = W.decor.filter((d) => !isW(d.tx, d.ty) || d.kind === 'boat' || d.harbour);
      k = KQ;
    } else if (k < KMIN) {
      for (let i = 0; i < KMIN; i++) for (let sd = -half; sd <= half; sd++) { const [x, y] = P2(i, sd); if (!W.inb(x, y)) continue; const j = y * W.W + x; if (isW(x, y)) { W.tiles[j] = T.STONE; W.block[j] = 0; } }
      k = KMIN;
    }
    // the dock district: everything from the sea wall down to the water is paved, the road through it cobbled,
    // and two curtain walls run from the city's corners down to the sea, so the harbour lies inside the walls
    for (let i = 0; i < k + 1; i++) for (let sd = -half; sd <= half; sd++) { const [x, y] = P2(i, sd); if (!W.inb(x, y)) continue; const t = W.tiles[y * W.W + x]; if (isW(x, y) || t === T.CWALL) continue; W.tiles[y * W.W + x] = Math.abs(sd) <= 2 ? T.COBBLE : T.STONE; W.block[y * W.W + x] = 0; }
    for (const sd of [-half - 1, half + 1]) for (let i = -1; i <= k + 1; i++) { const [x, y] = P2(i, sd); if (!W.inb(x, y)) continue; W.tiles[y * W.W + x] = T.CWALL; W.block[y * W.W + x] = 1; }
    // a broad stone quay along the water's edge, between the two walls
    for (let sd = -half; sd <= half; sd++) for (let d = -3; d <= 1; d++) { const [x, y] = P2(k + d, sd); if (!W.inb(x, y)) continue; const i = y * W.W + x; if (W.tiles[i] === T.CWALL) continue; W.tiles[i] = d === 1 || isW(x, y) ? T.WOOD : T.STONE; W.block[i] = 0; }
    // one pier out into the deep water (the ship that brings heroes home ties up beside it, a rowboat at its foot)
    const piers = [[0, 16]];
    for (const [off, len] of piers) for (let i = 0; i < len; i++) for (let w = -1; w <= 1; w++) { const x = gx + dx * (k + 1 + i) + px * (off + w), y = gy + dy * (k + 1 + i) + py * (off + w); if (W.inb(x, y)) { W.tiles[y * W.W + x] = T.WOOD; W.block[y * W.W + x] = 0; } }
    const at = (i, s) => [gx + dx * (k + 1 + i) + px * s, gy + dy * (k + 1 + i) + py * s];
    const ry = Math.atan2(dx, dy); // ships lie along the piers, bows out to sea
    // a ship's spot can fall between tiles: it is tested on its tile and placed exactly
    const ship = (i, s, size, v, o = {}) => { const [x, y] = at(i, s); const tx = Math.round(x), ty = Math.round(y); if (isW(tx, ty)) deco('boat', tx, ty, Object.assign({ nb: true, size, ry, v, px: x * TS + 16, py: y * TS + 16 }, o)); };
    // the ship that brought you home lies at the pier's inner berth (s 3.5: intro3d.js sails it in along that lane), and
    // a rowboat is tied up at the foot of the pier on the other side
    ship(9, 3.5, 'cog', 0.45, { ry: ry + Math.PI, arrival: true });
    ship(1.5, -2.6, 'rowboat', 0.7);
    // posts, crates, barrels, nets and lamps
    for (const [off, len] of piers) for (let i = 2; i < len; i += 4) for (const w of [-2, 2]) { const [x, y] = at(i, off + w); if (W.inb(x, y)) deco('post', x, y, { nb: true }); }
    for (let s = -24; s <= 24; s += 6) { const x = gx + dx * (k - 2) + px * s, y = gy + dy * (k - 2) + py * s; if (!W.inb(x, y) || W.tiles[y * W.W + x] !== T.STONE) continue; const h = U.hash(x, y, 4); deco(h < 0.35 ? 'crate' : h < 0.7 ? 'barrel' : 'lamp', x, y, h >= 0.7 ? {} : { nb: true }); if (h >= 0.7) W.lights.push({ x: x * TS + 16, y: y * TS - 20, r: 170, col: '255,196,110', fl: 0.08, k: 'lamp' }); }
    // tall flags along the quay
    for (let s = -24; s <= 24; s += 8) { const x = gx + dx * (k - 3) + px * s, y = gy + dy * (k - 3) + py * s; if (W.inb(x, y) && W.tiles[y * W.W + x] === T.STONE) deco('flagpole', x, y, { nb: true, f }); }
    // the market of the docks: stalls along the road, cargo stacked against the walls, lamps and benches
    const stallCols = ['#b84a3a', '#3a6ab8', '#c9a23a', '#3a8a5a', '#8a4ab8', '#c86a2a'];
    for (let i = 3; i < k - 5; i += 4) for (const sd of [-5, 5]) { const [x, y] = P2(i, sd); if (W.inb(x, y) && W.tiles[y * W.W + x] === T.STONE) deco('stall', x, y, { col: stallCols[(i + (sd > 0 ? 1 : 0)) % stallCols.length] }); }
    for (let i = 1; i < k - 3; i += 3) for (const sd of [-half + 1, half - 1, -half + 2, half - 2]) { const [x, y] = P2(i, sd); if (!W.inb(x, y) || W.tiles[y * W.W + x] !== T.STONE) continue; const h = U.hash(x, y, 11); if (h < 0.55) deco(h < 0.2 ? 'crate' : h < 0.4 ? 'barrel' : 'keg', x, y, { nb: true }); }
    for (let i = 2; i < k; i += 6) for (const sd of [-3, 3]) { const [x, y] = P2(i, sd); if (!W.inb(x, y)) continue; deco('lamp', x, y, {}); W.lights.push({ x: x * TS + 16, y: y * TS - 20, r: 170, col: '255,196,110', fl: 0.08, k: 'lamp', harbour: f }); }
    for (let i = 5; i < k - 4; i += 8) for (const sd of [-8, 8]) { const [x, y] = P2(i, sd); if (W.inb(x, y) && W.tiles[y * W.W + x] === T.STONE) deco('bench', x, y, { nb: true, ry: sd > 0 ? -Math.PI / 2 : Math.PI / 2 }); }
    // nothing wild grows on the docks: trees, rocks and ore veins on paving, planks or walls go
    const dock = new Set([T.STONE, T.COBBLE, T.WOOD, T.CWALL]);
    W.decor = W.decor.filter((d) => { if (d.harbour === f) return true; const ox = d.tx - gx, oy = d.ty - gy; const i = ox * dx + oy * dy, sd = ox * px + oy * py; if (i < -2 || i > k + 26 || Math.abs(sd) > half + 30) return true; const t = W.tile(d.tx, d.ty); return !(dock.has(t) || t === T.WATER || t === T.DEEP) || ['lamp', 'flagpole', 'post', 'crate', 'barrel', 'boat'].includes(d.kind) && d.harbour === f; });
    W.cityData[f] = W.cityData[f] || {}; W.cityData[f].harbour = { gx, gy, dx, dy, k, px, py, half };
  }
  // ---- the shipyard's plot: on the quay beside the pier, across from the arrival berth, its slipway running into
  // the water. Published as W.cityData[f].shipyardPlot (KR.Realm.plotOf(f, 'shipyard') finds it); the 3D building is
  // naval3d.js's. Once built it is solid, all but the quay's edge
  function harbourYard(f) {
    const cd = W.cityData[f]; const H = cd && cd.harbour; if (!H) { if (cd) cd.shipyardPlot = null; return; }
    const P = (i, sd) => [H.gx + H.dx * i + H.px * sd, H.gy + H.dy * i + H.py * sd];
    const pts = [P(1, -10), P(H.k - 1, -10), P(1, -4), P(H.k - 1, -4)];
    const x0 = Math.min(...pts.map((q) => q[0])), x1 = Math.max(...pts.map((q) => q[0])), y0 = Math.min(...pts.map((q) => q[1])), y1 = Math.max(...pts.map((q) => q[1]));
    const front = H.dx < 0 ? 'w' : H.dx > 0 ? 'e' : H.dy < 0 ? 'n' : 's';
    const slip = P(H.k + 5, -7), moor = [P(H.k + 12, -6), P(H.k + 16, -10), P(H.k + 14, -2), P(H.k + 20, -6)];
    const sea = { out: [H.dx, H.dy], lat: [H.px, H.py], slip, moor, quay: P(H.k, -7) };
    // the town's own plot for the shipyard (placePlots, near the sea gate) when it has one: the yard stands there and
    // its ships lie in the harbour basin
    const town = (cd.plots || []).find((q) => q.id === 'shipyard');
    if (town) { cd.shipyardPlot = Object.assign(town, sea); W.shipyardBlock(f); return; }
    const pl = Object.assign({ id: 'shipyard', x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, front, quayPlot: true }, sea);
    cd.shipyardPlot = pl;
    W.decor = W.decor.filter((d) => d.kind === 'boat' || !(d.tx >= x0 && d.tx <= x1 && d.ty >= y0 && d.ty <= y1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = y * W.W + x; if (W.tiles[k] === T.CWALL) continue; W.tiles[k] = T.STONE; W.block[k] = 0; }
    W.shipyardBlock(f);
  }
  // a finished shipyard is solid where its sheds stand (its quayside row stays open to walk along)
  W.shipyardBlock = function (f) {
    const cd = W.cityData[f]; const pl = cd && cd.shipyardPlot; if (!pl || (W.realm && W.realm !== 'main')) return;
    const lv = W.realmLevel(f, 'shipyard'); const H = cd.harbour;
    if (!pl.quayPlot) { // a plot in town: its footprint grows with the level, like every building's (placePlots leaves the shipyard to us)
      if (pl.fp) for (let y = pl.fp.y; y < pl.fp.y + pl.fp.h; y++) for (let x = pl.fp.x; x < pl.fp.x + pl.fp.w; x++) W.block[y * W.W + x] = 0;
      pl.level = lv; pl.fp = lv && W.plotFootprint ? W.plotFootprint(pl, lv) : null;
      if (pl.fp) for (let y = pl.fp.y; y < pl.fp.y + pl.fp.h; y++) for (let x = pl.fp.x; x < pl.fp.x + pl.fp.w; x++) W.block[y * W.W + x] = 1;
      return;
    }
    for (let y = pl.y; y < pl.y + pl.h; y++) for (let x = pl.x; x < pl.x + pl.w; x++) {
      const i = (x - H.gx) * H.dx + (y - H.gy) * H.dy; // how far out toward the water
      const k = y * W.W + x; if (W.tiles[k] === T.CWALL) continue; W.block[k] = lv && i < H.k - 1 ? 1 : 0;
    }
  };
  function nearCity(x, y, r) { for (const f of D.FACTION_IDS) { const [cx, cy] = D.CITY_CENTER[f]; if (Math.abs(x - cx) < r && Math.abs(y - cy) < r) return true; } return false; }
  function areaFree(x, y, w, h) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { if (!W.inb(i, j)) return false; const t = W.tile(i, j); if (SOLID[t] || t === T.WATER || t === T.ROAD || t === T.WOOD || t === T.STONE) return false; } return true; }
  function clearArea(x, y, w, h, floor) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (!W.inb(i, j)) continue; const k = j * W.W + i;
      if (floor != null || SOLID[W.tiles[k]] || W.tiles[k] === T.WATER) W.tiles[k] = floor != null ? floor : T.GRAVEL;
      W.block[k] = 0;
    }
    W.decor = W.decor.filter((d) => !(d.tx >= x && d.tx < x + w && d.ty >= y && d.ty < y + h));
  }

  function addDecor(kind, tx, ty, opt = {}, blocks) {
    const d = { kind, tx, ty, x: tx * TS + 16 + (opt.nb ? (U.hash(tx, ty, 2) - 0.5) * 18 : (U.hash(tx, ty, 2) - 0.5) * 6), y: ty * TS + 24 + (opt.nb ? (U.hash(tx, ty, 4) - 0.5) * 14 : 0), v: U.hash(tx, ty, 9), ...opt };
    if (opt.px != null) { d.x = opt.px; d.y = opt.py; }
    const blocking = !opt.nb && !['post', 'cavesign', 'boat', 'balloon', 'flowers', 'mushroom', 'fern', 'reeds', 'bones', 'snowtuft', 'ember', 'pebbles', 'rug', 'carpet', 'crop', 'banner', 'bedroll', 'lamp_wall', 'torch_wall', 'torch', 'dummy', 'lamp', 'brazier', 'scarecrowpost', 'totem'].includes(kind);
    if (blocking && W.inb(tx, ty)) W.block[ty * W.W + tx] = 1;
    d.flat = !blocking && ['flowers', 'mushroom', 'fern', 'reeds', 'bones', 'snowtuft', 'ember', 'pebbles', 'rug', 'carpet', 'crop', 'bedroll'].includes(kind);
    W.decor.push(d);
    return d;
  }
  W.addDecor = addDecor;

  function makeCamp(kind, x, y, reg) {
    clearArea(x - 3, y - 3, 7, 7, null);
    if (kind === 'camp') {
      addDecor('campfire', x, y, {});
      W.lights.push({ x: x * TS + 16, y: y * TS + 10, r: 220, col: '255,150,70', fl: 0.18, k: 'fire' });
      addDecor('tent', x - 2, y - 2, { col: reg.id === 'greywood' || reg.id === 'sunleaf' ? '#5a4a2a' : reg.id === 'dreadmire' ? '#3f5a3a' : '#7a3a2a' });
      addDecor('tent', x + 2, y - 2, { col: '#6a5a3a' });
      addDecor('crate', x + 2, y + 2, {}); addDecor('barrel', x - 2, y + 2, {});
      addDecor('totem', x, y - 3, { col: reg.id === 'pebblebrook' || reg.id === 'copperdeep' ? '#6a8a3a' : '#8a3a2a' });
    } else if (kind === 'graveyard') {
      for (let i = 0; i < 6; i++) addDecor('tomb', x - 2 + (i % 3) * 2, y - 1 + Math.floor(i / 3) * 2, {});
      addDecor('crypt', x, y - 3, {});
      W.lights.push({ x: x * TS + 16, y: y * TS - 70, r: 120, col: '120,255,170', fl: 0.3, k: 'ghost' });
    } else {
      addDecor('boulder', x - 2, y - 1, {}); addDecor('boulder', x + 2, y + 1, {}); addDecor('bones', x, y, { nb: true }); addDecor('bones', x + 1, y - 1, { nb: true });
    }
  }

  // ---------- buildings ----------
  function stampBuilding(b) {
    b.id = b.id || U.uid();
    const floor = ['hall', 'bank', 'chamber', 'heroes', 'exchange'].includes(b.type) ? T.STONE : T.WOOD;
    for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) {
      if (!W.inb(i, j)) continue; const k = j * W.W + i;
      const edge = i === b.x || j === b.y || i === b.x + b.w - 1 || j === b.y + b.h - 1;
      W.tiles[k] = edge ? T.WALL : floor; W.block[k] = 0;
    }
    if (!b.city) W.decor = W.decor.filter((d) => !(d.tx >= b.x - 1 && d.tx <= b.x + b.w && d.ty >= b.y - 1 && d.ty <= b.y + b.h));
    else W.decor = W.decor.filter((d) => !(d.tx >= b.x && d.tx < b.x + b.w && d.ty >= b.y && d.ty < b.y + b.h)); // no street lamp or wall torch left inside a city building
    const dx = b.doorX != null ? b.doorX : b.x + Math.floor(b.w / 2), dy = b.y + b.h - 1;
    W.tiles[dy * W.W + dx] = T.DOOR;
    // clear tile in front of door
    if (W.inb(dx, dy + 1)) { const k = (dy + 1) * W.W + dx; if (SOLID[W.tiles[k]] || W.tiles[k] === T.WATER) W.tiles[k] = T.GRAVEL; W.block[k] = 0; }
    b.door = { tx: dx, ty: dy, open: 0, locked: b.locked || null, x: dx * TS + 16, y: dy * TS + 16, last: 0 };
    W.doorAt[dy * W.W + dx] = b.door;
    b.spots = {};
    b.px = b.x * TS; b.py = b.y * TS; b.pw = b.w * TS; b.ph = b.h * TS;
    furnish(b);
    clearDoorway(b);
    W.buildings.push(b);
    return b;
  }
  W.stampBuilding = stampBuilding;
  // keep every building enterable: nothing blocks the door, and all floor space connects to it
  function clearDoorway(b) {
    const dx = b.door.tx, dy = b.door.ty;
    const unblock = (tx, ty) => { const k = ty * W.W + tx; if (!W.block[k]) return; W.block[k] = 0; W.decor = W.decor.filter((d) => !(d.tx === tx && d.ty === ty && !d.flat && !['banner', 'lamp_wall', 'torch_wall', 'rug', 'carpet'].includes(d.kind))); };
    unblock(dx, dy - 1); unblock(dx, dy - 2); unblock(dx, dy + 1);
    const inside = (x, y) => x > b.x && y > b.y && x < b.x + b.w - 1 && y < b.y + b.h - 1;
    const floorOk = (x, y) => !SOLID[W.tiles[y * W.W + x]];
    for (let guard = 0; guard < 12; guard++) {
      const seen = new Set([(dy - 1) * W.W + dx]); const q = [[dx, dy - 1]];
      while (q.length) { const [x, y] = q.pop(); for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ox, ny = y + oy; if (!inside(nx, ny)) continue; const k = ny * W.W + nx; if (seen.has(k) || W.block[k] || !floorOk(nx, ny)) continue; seen.add(k); q.push([nx, ny]); } }
      let total = 0; for (let y = b.y + 1; y < b.y + b.h - 1; y++) for (let x = b.x + 1; x < b.x + b.w - 1; x++) if (floorOk(x, y) && !W.block[y * W.W + x]) total++;
      if (seen.size >= total) break; // every open tile can be walked to (a small room may be well furnished)
      // remove a blocking prop that touches the reachable area
      let done = false;
      for (const k of seen) { const x = k % W.W, y = Math.floor(k / W.W); for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ox, ny = y + oy; if (inside(nx, ny) && W.block[ny * W.W + nx]) { unblock(nx, ny); done = true; break; } } if (done) break; }
      if (!done) break;
    }
  }
  const spot = (b, key, tx, ty) => { (b.spots[key] = b.spots[key] || []).push([tx * TS + 16, ty * TS + 20]); };
  // sets furniture out in a room so that it all fits: nothing in the lane from the door, nothing on the stairs, and every
  // piece that is used from the front (a forge, a loom, a counter, a shelf, a bed...) keeps a free tile before it.
  // Pieces against a wall face away from it; opts.face fixes the facing, opts.free lets a piece stand out in the room.
  const NEEDS_FRONT = new Set(['workbench', 'forge', 'loom', 'hearth', 'stove', 'counter', 'lectern', 'bookshelf', 'shelf', 'vault', 'weaponrack', 'clothrack', 'cauldron', 'bed', 'kingbed', 'throne', 'wardrobe', 'dresser', 'chest', 'desk', 'keg', 'armorstand', 'statue']);
  const FACE_D = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }; // a piece facing 's' stands against the north wall... (see front())
  function placer(b, x0, y0, x1, y1) {
    const door = b.door; const hold = new Set(); const K = (x, y) => y * W.W + x;
    const inR = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const lane = (x, y) => x === door.tx && y >= y1 - 1; // the two tiles inside the door
    const stairAt = (x, y) => !!(W.stairs && W.stairs.get(K(x, y)));
    const occ = (x, y) => !inR(x, y) || W.block[K(x, y)] || stairAt(x, y) || W.decor.some((d) => d.tx === x && d.ty === y && !d.flat && !d.up && !d.nb);
    const free = (x, y) => !occ(x, y) && !hold.has(K(x, y));
    // the side a piece is used from: away from the nearest wall (ties go to the back wall, then the front, west, east)
    const wallOf = (x, y) => { const n = y - b.y, s = b.y + b.h - 1 - y, w = x - b.x, e = b.x + b.w - 1 - x; const m = Math.min(n, s, w, e); return m === n ? 'n' : m === s ? 's' : m === w ? 'w' : 'e'; };
    const front = (x, y, face) => { const f = face ? { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }[face] : FACE_D[wallOf(x, y)]; return [x + f[0], y + f[1]]; };
    const connected = () => {
      const open = (x, y) => inR(x, y) && !W.block[K(x, y)] && !SOLID[W.tiles[K(x, y)]];
      const sx = door.tx, sy = door.ty - 1; if (!open(sx, sy)) return false;
      const seen = new Set([K(sx, sy)]); const q = [[sx, sy]];
      while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = K(nx, ny); if (!seen.has(k) && open(nx, ny)) { seen.add(k); q.push([nx, ny]); } } }
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (open(x, y) && !seen.has(K(x, y))) return false;
      return true;
    };
    const P = {
      lane, free, front: (x, y) => front(x, y), hold: (x, y) => hold.add(K(x, y)),
      put(kind, x, y, o = {}) {
        if (!free(x, y) || lane(x, y)) return false;
        const face = o.face || null; const opts = Object.assign({}, o); delete opts.free;
        if (!o.free && !face && ['s'].includes(wallOf(x, y)) && NEEDS_FRONT.has(kind)) return false; // never with its back to the door wall
        let fk = -1, foot = -1;
        if (NEEDS_FRONT.has(kind)) { const [fx, fy] = front(x, y, face); if (occ(fx, fy)) return false; /* two pieces may share the tile they are used from */ if (!o.free && !face) { const m = Math.min(y - b.y, b.y + b.h - 1 - y, x - b.x, b.x + b.w - 1 - x); if (m !== 1) return false; } fk = K(fx, fy); if (kind === 'bed') foot = fk; }
        if (face) opts.face = face;
        const d = addDecor(kind, x, y, opts); if (foot >= 0) W.block[foot] = 1;
        // never wall off a corner of the room: every open tile must still be reachable from the door
        if (!connected()) { W.decor.splice(W.decor.indexOf(d), 1); W.block[K(x, y)] = 0; if (foot >= 0) W.block[foot] = 0; return false; }
        if (fk >= 0) hold.add(fk);
        return true;
      },
      first(kind, list, o = {}) { for (const [x, y] of list) if (P.put(kind, x, y, o)) return [x, y]; return null; },
      // a tile to post someone on: free and out of the door lane if possible, else at least not inside furniture
      anyFree(list) { for (const [x, y] of list) if (free(x, y) && !lane(x, y)) return [x, y]; for (const [x, y] of list) if (!occ(x, y) && !lane(x, y)) return [x, y]; for (const [x, y] of list) if (!occ(x, y)) return [x, y]; return null; },
    };
    b._hold = hold;
    return P;
  }
  function furnish(b) {
    const x0 = b.x + 1, y0 = b.y + 1, x1 = b.x + b.w - 2, y1 = b.y + b.h - 2, mx = b.x + Math.floor(b.w / 2);
    const lightIn = (tx, ty, r = 150, col = '255,180,100') => W.lights.push({ x: tx * TS + 16, y: ty * TS + 10, r, col, fl: 0.12, k: 'fire', b: b.id });
    const D_ = (k, tx, ty, o = {}) => addDecor(k, tx, ty, o);
    // the stairs to an upper floor go in first, so the furniture is set out around them
    let loftCol = null;
    if (['inn', 'guild', 'bank', 'heroes', 'exchange'].includes(b.type) && y1 - y0 >= 4 && x1 - x0 >= 3) { makeLoft(b, x0, y0, x1, y1); if (b.loft) loftCol = b.loft.col; }
    const P = placer(b, x0, y0, x1, y1);
    // the carpenter's bench (for refining wood) against a side wall, its sawhorse beside it
    const carpenter = () => { const wb = P.first('workbench', [[x0, y0 + 2], [x0, y0 + 3], [x1 - 1, y0], [x0 + 2, y0], [x1, y0 + 1], [x1, y0 + 3], [x0, y0 + 1], [x1, y1 - 1], [x0, y1 - 1]]); if (wb) P.first('sawhorse', [[wb[0], wb[1] + 1], [wb[0], wb[1] - 1], [wb[0] + (wb[0] === x0 ? 1 : -1), wb[1] + 1]], { free: true }); };
    switch (b.type) {
      case 'hall':
        if (b.city && b.w >= 15 && b.h >= 14) { castleKeep(b); break; }
        D_('throne', mx, y0, {}); D_('carpet', mx, y0 + 1, { len: b.h - 3 });
        for (let j = y0 + 1; j <= y1; j += 2) { D_('pillar', x0 + 1, j); D_('pillar', x1 - 1, j); }
        D_('brazier', mx - 2, y0); D_('brazier', mx + 2, y0); lightIn(mx - 2, y0, 200); lightIn(mx + 2, y0, 200);
        D_('banner', x0, y0, { nb: true }); D_('banner', x1, y0, { nb: true });
        spot(b, 'king', mx, y0 + 1); spot(b, 'guard', mx - 2, y0 + 2); spot(b, 'guard', mx + 2, y0 + 2); spot(b, 'guard', mx - 2, y1 - 1); spot(b, 'guard', mx + 2, y1 - 1);
        break;
      case 'inn': case 'outpost': {
        // the bar in the back corner opposite the stairs: kegs on the back wall, the keeper behind a counter that faces
        // the room, the hearth on the side wall, and tables wherever two stools fit beside them
        const bx = loftCol === x0 ? x1 : x0, bs = bx === x0 ? 1 : -1, bw = Math.min(3, x1 - x0); const cy0 = y1 - y0 >= 4 ? y0 + 2 : y0 + 1;
        P.put('keg', bx, y0, { face: 's' }); P.put('keg', bx + bs, y0, { face: 's' });
        for (let k = 0; k < bw; k++) P.put('counter', bx + bs * k, cy0, { face: 's', free: true });
        spot(b, 'keeper', bx + bs, cy0 - 1);
        const hx = P.first('hearth', [[bx, y1 - 1], [bx, y1], [x0 + Math.floor((x1 - x0) / 2) + 1, y0]]); if (hx) { lightIn(hx[0], hx[1], 190, '255,160,80'); spot(b, 'cook', ...P.front(hx[0], hx[1])); }
        const nT = b.type === 'outpost' ? 1 : 3; let nt = 0;
        for (let y = y1 - 1; y >= cy0 + 1 && nt < nT; y--) for (let x = x0 + 1; x <= x1 - 1 && nt < nT; x++) {
          if (!P.free(x, y) || !P.free(x - 1, y) || !P.free(x + 1, y) || P.lane(x - 1, y) || P.lane(x + 1, y)) continue;
          if (P.put('table', x, y, { free: true })) { spot(b, 'seat', x - 1, y); spot(b, 'seat', x + 1, y); P.hold(x - 1, y); P.hold(x + 1, y); nt++; x += 2; }
        }
        const st = P.anyFree([[x1 - 1, y1], [x0 + 1, y1], [mx + 2, y1 - 1]]); if (st) spot(b, 'stage', st[0], st[1]);
        lightIn(bx + bs, cy0 - 1, 170, '255,170,90');
        break; }
      case 'pub': {
        // the mercenaries' pub: kegs on the back wall, the bar in front of them (the Mercenary Trader serves behind it),
        // a hearth, and tables with a seat at each end; sellswords lean at the bar or drink at the tables
        P.put('keg', x0, y0, { face: 's' }); P.put('keg', x1, y0, { face: 's' });
        const cyB = y0, bx0 = x0 + 1, bx1 = Math.max(bx0, x1 - 2); // the keeper's row between the kegs, the counter before it (a gap at its east end leads behind it)
        for (let x = bx0; x <= bx1; x++) P.put('counter', x, cyB + 1, { face: 's', free: true });
        spot(b, 'keeper', Math.floor((bx0 + bx1) / 2), cyB); P.hold(Math.floor((bx0 + bx1) / 2), cyB);
        for (let x = bx0; x <= bx1; x += 2) if (!W.block[(cyB + 2) * W.W + x] && !P.lane(x, cyB + 2)) { spot(b, 'bar', x, cyB + 2); P.hold(x, cyB + 2); } // leaning on the counter (its front tiles stay clear)
        const hx = P.first('hearth', [[x1, y1 - 1], [x0, y1 - 1], [x1, y1]]); if (hx) lightIn(hx[0], hx[1], 190, '255,160,80');
        let nt = 0;
        for (let y = y1 - 1; y >= cyB + 3 && nt < 3; y--) for (let x = x0 + 1; x <= x1 - 1 && nt < 3; x++) {
          if (!P.free(x, y) || !P.free(x - 1, y) || !P.free(x + 1, y) || P.lane(x - 1, y) || P.lane(x + 1, y)) continue;
          if (P.put('table', x, y, { free: true })) { spot(b, 'seat', x - 1, y); spot(b, 'seat', x + 1, y); P.hold(x - 1, y); P.hold(x + 1, y); nt++; x += 2; }
        }
        lightIn(Math.floor((bx0 + bx1) / 2), cyB + 1, 180, '255,170,90'); lightIn(mx, y1 - 1, 150, '255,180,110');
        break; }
      case 'bank': {
        // the vault and a strongbox against the back wall, the tellers' counter in front of them with a gap at each end
        P.put('vault', x0, y0, { face: 's' }); P.put('chest', x1, y0, { face: 's' });
        for (let i = x0 + 1; i <= x1 - 1; i++) if (i !== loftCol) P.put('counter', i, y0 + 1, { face: 's', free: true });
        spot(b, 'banker', mx === loftCol ? mx - 1 : mx, y0); lightIn(mx, y0 + 2, 160); break; }
      case 'smithy': case 'forge': {
        // the forge on the back wall a step from the corner, the anvil two paces in front of it, ore in the corner and
        // the weapon rack on the side wall: every one of them with room to work in front
        const fp = P.first('forge', [[x0 + 1, y0], [x0, y0], [x1, y0]]); if (fp) lightIn(fp[0], fp[1], 210, '255,120,50');
        const ax = fp ? fp[0] : x0 + 1, ap = P.first('anvil', [[ax, y0 + 2], [ax + 1, y0 + 2], [ax, y0 + 3], [ax + 1, y0 + 1]], { free: true });
        P.first('orepile', [[x1, y0], [x0, y0]], { free: true });
        P.first('weaponrack', [[x1, y0 + 2], [x1, y0 + 1], [x0, y0 + 2], [x0, y0 + 3]]);
        carpenter(x0, y0, x1, y1);
        P.first('washtub', [[x0, y0 + 2], [x0, y1 - 1], [x1, y1 - 1]], { nb: true });
        const sp = ap ? P.anyFree([[ap[0] + 1, ap[1]], [ap[0] - 1, ap[1]], [ap[0], ap[1] - 1], [ap[0], ap[1] + 1]]) : null; spot(b, 'smith', ...(sp || [mx, y0 + 1]));
        spot(b, 'vendor', ...(P.anyFree([[x1 - 1, y0 + 1], [mx + 1, y0 + 1], [mx, y0 + 1]]) || [mx, y1 - 1])); break; }
      case 'tailor': {
        const lp = P.first('loom', [[x0, y0], [x0 + 1, y0], [x1, y0]]);
        P.first('clothrack', [[x1, y0], [x1, y0 + 1], [x0, y0 + 1]]);
        P.first('table', [[x1, y1], [x0, y1], [x1, y1 - 1]], { free: true });
        const tp = lp ? P.front(lp[0], lp[1]) : [x0, y0 + 1]; spot(b, 'tailor', ...tp); spot(b, 'vendor', ...tp); lightIn(mx, y0 + 1, 150); break; }
      case 'guild': {
        P.first('bookshelf', [[x0, y0]]); P.first('bookshelf', [[x0 + 1, y0]]); P.first('bookshelf', [[x1, y0], [x1 - 1, y0]]);
        P.first('lectern', [[mx, y0 + 1], [mx + 1, y0 + 1]], { free: true });
        P.first('dummy', [[x1, y1], [x1, y1 - 1]], { free: true }); P.first('dummy', [[x1 - 2, y1], [x0, y1]], { free: true });
        spot(b, 'trainer', ...(P.anyFree([[mx, y0 + 2], [mx - 1, y0 + 2], [mx + 1, y0 + 2]]) || [mx, y1 - 1])); lightIn(mx, y0 + 1, 170, '210,200,255'); break; }
      case 'jeweler': case 'gemcutter': P.first('desk', [[x0, y0], [x0 + 1, y0]]); P.first('chest', [[x1, y0], [x1 - 1, y0]]); spot(b, 'vendor', ...(P.anyFree([[mx, y0 + 1], [mx - 1, y0 + 1]]) || [mx, y1 - 1])); lightIn(mx, y0, 150, '210,225,255'); break;
      case 'bowyer': P.first('weaponrack', [[x0, y0], [x0 + 1, y0]]); P.first('table', [[x1, y0], [x1 - 1, y0]], { free: true }); spot(b, 'vendor', ...(P.anyFree([[mx, y0 + 1], [mx - 1, y0 + 1]]) || [mx, y1 - 1])); lightIn(mx, y0, 140); break;
      case 'store': case 'armorer': case 'weaponsmith': case 'fletcher': case 'armory': case 'exchange': case 'arms': case 'alchemist':
        // shelves and racks along the back and side walls, barrels and crates in the front corners away from the door
        P.first('shelf', [[x0, y0]]); P.first('shelf', [[x1, y0], [x1, y0 + 1]]);
        if (b.type === 'weaponsmith' || b.type === 'armory') P.first('weaponrack', [[x0 + 1, y0], [x0, y0 + 1], [x0, y0 + 2]]);
        if (b.type === 'armorer') P.first('armorstand', [[x0 + 1, y0], [x0, y0 + 1], [x0, y0 + 2]]);
        if (b.type === 'arms') { P.first('weaponrack', [[x0 + 1, y0], [x0, y0 + 1], [x0, y0 + 2]]); P.first('armorstand', [[x1 - 1, y0], [x1, y0 + 2], [x0, y0 + 3]]); }
        if (b.type === 'alchemist') { P.first('cauldron', [[x0 + 1, y0], [x0, y0 + 1]]); P.first('bookshelf', [[x1 - 1, y0], [x1, y0 + 2]]); }
        if (b.type === 'fletcher') { P.first('weaponrack', [[x0, y0 + 2], [x1, y0 + 2]]); carpenter(x0, y0, x1, y1); }
        P.first('barrel', [[x0, y1], [x0, y1 - 1]], { free: true }); P.first('crate', [[x1, y1], [x1, y1 - 1]], { free: true });
        spot(b, 'vendor', ...(P.anyFree([[mx, y0 + 1], [mx - 1, y0 + 1], [mx + 1, y0 + 1]]) || [mx, y1 - 1])); lightIn(mx, y0 + 1, 150); break;
      case 'scribe': P.first('bookshelf', [[x0, y0]]); P.first('bookshelf', [[x1, y0]]); P.first('lectern', [[mx, y0 + 1], [x0, y0 + 2], [x1, y0 + 2]], { free: true });
        { const v = P.anyFree([[mx, y0 + 2], [mx - 1, y0 + 2], [mx, y0 + 3]]) || [mx, y1 - 1]; spot(b, 'vendor', ...v); spot(b, 'scribe', ...v); } lightIn(mx, y0 + 1, 160, '200,180,255'); break;
      case 'heroes': P.first('statue', [[mx, y0], [mx - 1, y0]]); D_('banner', x0, y0, { nb: true }); D_('banner', x1, y0, { nb: true }); D_('brazier', x0, y1); D_('brazier', x1, y1); lightIn(x0, y1, 170); lightIn(x1, y1, 170); spot(b, 'vendor', ...(P.anyFree([[mx, y0 + 2], [mx, y0 + 1]]) || [mx, y1 - 1])); break;
      case 'barracks': {
        // bunks along the back wall (a bed takes its tile and the one at its foot), the armoury corner and the recruiter's
        // desk by the door, a training dummy in the far corner
        for (let i = x0; i <= x1; i += 2) P.put('bed', i, y0);
        P.first('weaponrack', [[x0, y1], [x0, y1 - 1]]); P.first('armorstand', [[x0 + 1, y1], [x0, y1 - 2]]); P.first('dummy', [[x1, y1], [x1, y1 - 1]], { free: true });
        P.first('chest', [[x1, y0 + 2], [x1, y0 + 3]]);
        const tp = P.first('table', [[mx + 2, y1 - 1], [mx - 2, y1 - 1], [mx + 2, y1]], { free: true });
        D_('banner', x0, y0, { nb: true });
        spot(b, 'recruiter', ...(P.anyFree(tp ? [[tp[0], tp[1] + 1], [tp[0] + 1, tp[1]], [tp[0] - 1, tp[1]]] : []) || [mx + 1, y1])); spot(b, 'spawn', ...(P.anyFree([[mx, y1 - 1], [mx - 1, y1 - 1], [mx + 1, y1 - 2]]) || [mx, y1]));
        lightIn(mx, y0 + 2, 180); lightIn(x0 + 1, y1, 140); break; }
      case 'house': {
        // a bed in a back corner, the stove in the other, a wardrobe or a chest between them, a table if there is room
        const bp = P.first('bed', [[x0, y0], [x1, y0]]);
        const sp = P.first('stove', bp && bp[0] === x0 ? [[x1, y0], [x1, y0 + 1]] : [[x0, y0], [x0, y0 + 1]]); if (sp) lightIn(sp[0], sp[1], 150, '255,170,100');
        P.first(y1 - y0 >= 2 ? 'wardrobe' : 'chest', [[x0 + 2, y0], [x1 - 2, y0], [x0 + 1, y0]]);
        if (y1 - y0 >= 2) P.first('table', [[x1 - 1, y1 - 1], [x0 + 1, y1 - 1], [x1, y1]], { free: true });
        spot(b, 'home', ...(P.anyFree([[x0 + 1, y0 + 1], [mx, y0 + 1], [mx, y1]]) || [mx, y1])); lightIn(mx, y0, 150, '255,195,125'); break; }
      case 'kingtower': D_('banner', mx, y0, { nb: true }); D_('weaponrack', x1, y0); D_('table', mx, y0 + 2); D_('chair', mx - 1, y0 + 2, { nb: true }); D_('chair', mx + 1, y0 + 2, { nb: true }); D_('candle', x1, y1 - 1, { nb: true }); spot(b, 'guard', x1 - 1, y1 - 1); lightIn(mx, y0 + 1, 150); break;
      case 'chamber': D_('brazier', x0, y0); D_('brazier', x1, y0); D_('bones', x0 + 2, y1, { nb: true }); D_('bones', x1 - 1, y1 - 1, { nb: true }); lightIn(x0, y0, 170, '255,110,60'); lightIn(x1, y0, 170, '255,110,60'); spot(b, 'boss', mx, y0 + 2); break;
    }
    if (b.type === 'kingtower') { makeLoft(b, x0, y0, x1, y1, y1 - 2); if (b.loft) towerBalcony(b); }
    dress(b, x0, y0, x1, y1);
  }
  // ---------- the castle: the king's throne hall on the fourth floor, three wide flights up ----------
  // One great keep. Its floor is terraced: the gate (four tiles wide) opens into a stone vestibule on the ground floor,
  // and three flights four tiles abreast climb in switchbacks by two long landings to the throne hall, which fills the
  // whole back of the keep. No floor lies over another, so everyone (the player, the guards, the king and a raiding
  // party) simply walks it: the 3D view raises every tile to its floor (b.terr, W.terrAt) and the stone balustrades
  // (W.edge) keep walkers from stepping off a floor anywhere but at the stairs.
  const CASTLE_N = 3; // tiles per flight
  // the floor (0 ground .. 3 throne hall) at fraction (u, v) across a castle tile
  const terrLv = (cell, u, v) => {
    if (!cell) return 0;
    if (cell.st) { const s = cell.st; const t = s.dir[1] < 0 ? 1 - v : s.dir[1] > 0 ? v : s.dir[0] > 0 ? u : 1 - u; return s.a + (s.k + t) / s.n; }
    return cell.lv;
  };
  W.terrAt = function (b, px, py) {
    const T3 = b.terr; if (!T3) return 0; const fx = px / TS - T3.x0, fy = py / TS - T3.y0; const c = Math.floor(fx), r = Math.floor(fy);
    if (c < 0 || r < 0 || c >= T3.w || r >= T3.h) return 0;
    return terrLv(T3.cells[r * T3.w + c], fx - c, fy - r);
  };
  W.terrLv = terrLv;
  function castleKeep(b) {
    const X0 = b.x + 1, Y0 = b.y + 1, w = b.w - 2, h = b.h - 2;
    const lw = 4, mE = w - lw, rL3 = h - 8; // lanes: west 0..3, middle 4..w-5, east w-4..w-1; the throne hall is rows 0..h-8
    const lane = (c) => (c < lw ? 'W' : c >= mE ? 'E' : 'M');
    const cells = new Array(w * h);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const L = lane(c); let cell;
      if (r <= rL3) cell = { lv: 3 };
      else if (r <= rL3 + 2) cell = { lv: L === 'W' ? 3 : 1 }; // the north landing (second floor); in the west, the throne hall's stairhead
      else if (r <= rL3 + 2 + CASTLE_N) { // the three flights, side by side: up north in the east, back south in the middle, up north in the west
        const k = r - rL3 - 3;
        cell = { st: L === 'E' ? { a: 0, k: CASTLE_N - 1 - k, n: CASTLE_N, dir: [0, -1] } : L === 'M' ? { a: 1, k, n: CASTLE_N, dir: [0, 1] } : { a: 2, k: CASTLE_N - 1 - k, n: CASTLE_N, dir: [0, -1] } };
      } else cell = { lv: L === 'E' ? 0 : 2 }; // the vestibule inside the gate, and the south landing (third floor)
      cells[r * w + c] = cell;
    }
    b.terr = { x0: X0, y0: Y0, w, h, cells, lanes: [lw, mE], rL3 };
    // rails wherever two floors meet (not across the ends of a flight)
    if (!W.edge || W.edge.length !== W.W * W.H) W.edge = new Uint8Array(W.W * W.H);
    railMoves();
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const A = cells[r * w + c], i = (Y0 + r) * W.W + X0 + c;
      if (c + 1 < w && Math.abs(terrLv(A, 1, 0.5) - terrLv(cells[r * w + c + 1], 0, 0.5)) > 0.1) { W.edge[i] |= 2; W.edge[i + 1] |= 8; }
      if (r + 1 < h && Math.abs(terrLv(A, 0.5, 1) - terrLv(cells[(r + 1) * w + c], 0.5, 0)) > 0.1) { W.edge[i] |= 4; W.edge[i + W.W] |= 1; }
    }
    // the gate: the whole width of the vestibule, always open (a raised portcullis, no door leaf)
    const gy = b.y + b.h - 1; b.gate = { x0: X0 + mE, x1: X0 + w - 1, ty: gy };
    delete W.doorAt[b.door.ty * W.W + b.door.tx];
    for (let x = b.gate.x0; x <= b.gate.x1; x++) { const k = gy * W.W + x; W.tiles[k] = T.STONE; W.block[k] = 0; if (W.inb(x, gy + 1)) { W.block[k + W.W] = 0; if (SOLID[W.tiles[k + W.W]]) W.tiles[k + W.W] = T.STONE; } }
    // the throne against the back wall, a red carpet to it, braziers and banners; armour stands down the side walls
    const D_ = (k, c, r, o = {}) => addDecor(k, X0 + c, Y0 + r, o);
    const lit = (c, r, rad = 200, col = '255,176,96') => W.lights.push({ x: (X0 + c) * TS + 16, y: (Y0 + r) * TS + 10, r: rad, col, fl: 0.06, k: 'fire', b: b.id });
    const solid = (c, r) => { W.block[(Y0 + r) * W.W + X0 + c] = 1; };
    const mid = Math.floor(w / 2);
    D_('throne', mid, 0); D_('carpet', mid, 1, { len: rL3 - 0.4 }); // the runner stops short of the hall's front edge
    for (const c of [mid - 2, mid + 2]) { D_('brazier', c, 0); solid(c, 0); lit(c, 0, 230); }
    D_('banner', mid - 4, 0, { nb: true }); D_('banner', mid + 4, 0, { nb: true });
    D_('tapestry', 0, 2, { nb: true }); D_('tapestry', w - 1, 2, { nb: true });
    D_('armorstand', 0, 1); D_('armorstand', w - 1, 1); D_('armorstand', w - 1, 3);
    for (const [c, r] of [[0, 0], [w - 1, 0], [w - 1, rL3]]) { D_('brazier', c, r); solid(c, r); lit(c, r, 210); }
    // a brazier in a far corner of each landing, out of the way of the stairs; the vestibule is lit from the walls
    D_('brazier', w - 1, rL3 + 1); solid(w - 1, rL3 + 1); lit(w - 1, rL3 + 1, 220);
    D_('brazier', 0, h - 1); solid(0, h - 1); lit(0, h - 1, 220);
    lit(mE, h - 2, 170); lit(w - 1, h - 2, 170);
    // the king before his throne, two royal guards beside him and two holding the head of the stairs
    spot(b, 'king', X0 + mid, Y0 + 1);
    for (const [c, r] of [[mid - 2, 1], [mid + 2, 1], [0, rL3], [lw - 1, rL3]]) spot(b, 'guard', X0 + c, Y0 + r);
  }
  // the things people of the 1300s had at home, added around what each building already has:
  // rugs, stools and benches by the tables, a wood stove, cupboards, candles, tapestries on the walls
  function dress(b, x0, y0, x1, y1) {
    const door = b.door; const taken = (x, y) => x < x0 || x > x1 || y < y0 || y > y1 || W.block[y * W.W + x] || W.decor.some((d) => d.tx === x && d.ty === y && !d.flat && !d.up) || (W.stairs && W.stairs.get(y * W.W + x)) || (Math.abs(x - door.tx) <= 1 && y >= y1 - 1) || Object.values(b.spots || {}).some((l) => l.some(([px, py]) => Math.floor(px / TS) === x && Math.floor(py / TS) === y));
    const held = (x, y) => !!(b._hold && b._hold.has(y * W.W + x));
    const frontFree = (k, x, y) => { if (!NEEDS_FRONT.has(k)) return true; const n = y - b.y, s = b.y + b.h - 1 - y, w = x - b.x, e = b.x + b.w - 1 - x; const m = Math.min(n, s, w, e); if (m !== 1 || m === s) return false; const [fx, fy] = m === n ? [x, y + 1] : m === w ? [x + 1, y] : [x - 1, y]; return !taken(fx, fy) && !held(fx, fy); };
    const put = (k, x, y, o = {}) => { if (taken(x, y) || held(x, y) || !frontFree(k, x, y)) return false; addDecor(k, x, y, o); if (NEEDS_FRONT.has(k) && b._hold) { const n = y - b.y, w = x - b.x, e = b.x + b.w - 1 - x; const m = Math.min(n, w, e); b._hold.add(m === n ? (y + 1) * W.W + x : m === w ? y * W.W + x + 1 : y * W.W + x - 1); } return true; };
    const mx = Math.floor((x0 + x1) / 2), my = Math.floor((y0 + y1) / 2);
    const rugAt = (x, y) => { if (!W.block[y * W.W + x] && !W.decor.some((d) => d.tx === x && d.ty === y && (d.kind === 'rug' || (!d.flat && !d.up)))) addDecor('rug', x, y, { nb: true, flat: true }); };
    // seats where people sit at the tables
    for (const s of (b.spots && b.spots.seat) || []) { const x = Math.floor(s[0] / TS), y = Math.floor(s[1] / TS); if (!W.decor.some((d) => d.tx === x && d.ty === y)) addDecor('stool', x, y, { nb: true }); }
    for (const d of W.decor.filter((d) => d.kind === 'table' && d.tx >= x0 && d.tx <= x1 && d.ty >= y0 && d.ty <= y1 && !d.up)) { put('stool', d.tx - 1, d.ty, { nb: true }) || put('bench', d.tx, d.ty + 1, { nb: true }); put('stool', d.tx + 1, d.ty, { nb: true }); }
    const corners = [[x0, y1 - 1], [x1, y1 - 1], [x0, y0], [x1, y0]];
    switch (b.type) {
      case 'house': rugAt(mx, my); put('stove', x0, y1 - 1) || put('stove', x1, y1 - 1); put('wardrobe', mx, y0) || put('dresser', mx + 1, y0); put('washtub', x1, my, { nb: true }); put('candle', x0 + 1, y0, { nb: true }); put('tapestry', mx - 1, y0, { nb: true }); break;
      case 'inn': case 'outpost': rugAt(mx, y1 - 1); for (const [x, y] of corners) put('candle', x, y, { nb: true }); put('tapestry', mx, y0, { nb: true }); break;
      case 'barracks': put('candle', x0, my, { nb: true }); put('stool', mx - 1, y1 - 1, { nb: true }); put('stove', x1, my); break;
      case 'hall': if (b.terr) break; for (let x = x0 + 2; x <= x1 - 2; x += 3) { put('tapestry', x, y0, { nb: true }); } put('candle', x0, y1 - 1, { nb: true }); put('candle', x1, y1 - 1, { nb: true }); break;
      case 'kingtower': rugAt(mx, y1); put('tapestry', mx - 1, y0, { nb: true }); break;
      case 'bank': case 'guild': case 'heroes': case 'exchange': rugAt(mx, my + 1); put('candle', x0, y1 - 1, { nb: true }); put('candle', x1, y1 - 1, { nb: true }); put('tapestry', mx + 1, y0, { nb: true }); put('bench', mx, y1 - 1, { nb: true }); break;
      case 'chamber': break;
      default: rugAt(mx, y1 - 1); put('stool', mx + 1, y0 + 1, { nb: true }); put('candle', x0, y1 - 1, { nb: true }); put(b.type === 'smithy' || b.type === 'forge' ? 'washtub' : 'stove', x1, y1 - 1, b.type === 'smithy' || b.type === 'forge' ? { nb: true } : {}); break;
    }
  }
  // an upper floor over the back half of a building, reached by a staircase along a side wall:
  // b.loft is the floor's tile rectangle; its steps go in W.stairs (climbing north, toward the back wall)
  function makeLoft(b, x0, y0, x1, y1, ymOver) {
    if (!W.stairs) W.stairs = new Map();
    // the flight climbs north along a side wall and stops a tile short of the front wall, so its foot opens onto the room
    const foot = ymOver != null ? y1 : y1 - 1;
    const ym = ymOver != null ? ymOver : Math.max(y0 + 1, foot - 3), n = foot - ym;
    if (n < 2) return;
    const busy = (x, y) => W.decor.some((d) => d.tx === x && d.ty === y) || Object.values(b.spots || {}).some((l) => l.some(([px, py]) => Math.floor(px / TS) === x && Math.floor(py / TS) === y));
    const cost = (col) => { let c = 0; for (let y = ym; y <= y1; y++) if (busy(col, y)) c++; return c; };
    const col = Math.abs(x1 - b.door.tx) <= 0 ? x0 : cost(x1) <= cost(x0) ? x1 : x0;
    for (let y = ym; y <= y1; y++) { W.decor = W.decor.filter((d) => !(d.tx === col && d.ty === y)); W.block[y * W.W + col] = 0; for (const k in b.spots || {}) b.spots[k] = b.spots[k].filter(([px, py]) => !(Math.floor(px / TS) === col && Math.floor(py / TS) === y)); }
    W.block[ym * W.W + col] = 1; // the landing is under the stairs' top: on the ground floor you cannot stand there
    b.loft = { x0, y0, x1, y1: ym, col, city: b.city || b.faction || null };
    for (let k = 0; k < n; k++) { const y = foot - k; W.stairs.set(y * W.W + col, { loft: b, k, n, dir: [0, -1], top: k === n - 1 }); }
    // upstairs: beds for the inn's guests, books for the guild, strongboxes for the bank
    const other = col === x0 ? x1 : x0, step = col === x0 ? -1 : 1;
    const up = (k, tx, ty, o = {}) => addDecor(k, tx, ty, Object.assign({ nb: true, up: true }, o));
    if (b.type === 'kingtower') {
      // the king holds court up here: his throne against the back wall under tapestries, a rug before it, and in the
      // corner an iron-bound chest with a skull and crossed bones on its front
      const mid = Math.floor((x0 + x1) / 2);
      up('throne', mid, y0); up('rug', mid, y0 + 1, { flat: true }); up('tapestry', mid - 1, y0); up('tapestry', mid + 1, y0); up('poisonchest', other, ym); up('candle', col - step, ym);
    }
    else if (b.type === 'inn') { up('bed', other, y0); up('bed', other + step * 2, y0); up('chest', other, ym); up('table', other + step * 4, y0); up('rug', other + step * 2, ym, { flat: true }); }
    else if (b.type === 'guild' || b.type === 'heroes') { up('bookshelf', other, y0); up('bookshelf', other + step, y0); up('table', other + step * 2, ym); up('lectern', other, ym); }
    else { up('chest', other, y0); up('chest', other + step, y0); up('vault', other + step * 2, y0); }
  }

  // the king's tower: the upper floor runs out through an open arcade onto a balcony two tiles deep, over the green
  // on the west side (or the east if that is blocked). The loft's tile rectangle covers the balcony, so walking on
  // the upper floor works there too; b.balcony tells the 3D builder where to open the wall and put the railing.
  function towerBalcony(b) {
    const L = b.loft;
    const free = (tx, ty) => { if (!W.inb(tx, ty)) return false; const t = W.tiles[ty * W.W + tx]; return !SOLID[t] && t !== T.WATER && t !== T.DOOR && !W.buildings.some((o) => o !== b && tx >= o.x && ty >= o.y && tx < o.x + o.w && ty < o.y + o.h); };
    for (const side of ['w', 'e']) {
      const xs = side === 'w' ? [b.x - 2, b.x - 1] : [b.x + b.w, b.x + b.w + 1];
      let ok = true; for (let ty = L.y0; ty <= L.y1 && ok; ty++) for (const tx of xs) if (!free(tx, ty)) ok = false;
      if (!ok) continue;
      b.balcony = { side, x0: xs[0], x1: xs[1], y0: L.y0, y1: L.y1, wall: side === 'w' ? b.x : b.x + b.w - 1 };
      if (side === 'w') L.x0 = b.x - 2; else L.x1 = b.x + b.w + 1;
      return;
    }
  }

  // ---------- city layout ----------
  // [type, x, y, w, h, minLevel, name]
  // The city is laid out around two paved avenues that run gate to gate through the plaza (north-south and
  // east-west), with a lane behind each row of houses. Every building faces a street (doors are on the south
  // side), alleys between them are at least two tiles wide. The king's castle stands in the north-west with an open
  // courtyard before its gate (room for the siege engines), the inn and the green east of the north avenue, so the way to
  // the sea gate stays open.
  const CITY_LAYOUT = [ // [type, x, y, w, h, minLevel]
  // the Town Hall closes the north end of the main avenue: its gate (the east lane of the keep, four tiles) lies right
  // on the avenue's line, across the grand plaza from the south gate; the smiths and crafters are gone: a general
  // merchant, an arms merchant and an alchemist keep shop, and the inn (and the pub, once built) keep the tables
  ['hall', -11, -20, 15, 14, 1], ['inn', 8, -19, 9, 8, 1], ['bank', 8, -7, 8, 6, 1],
  ['arms', -18, 7, 7, 5, 1], ['alchemist', -8, 7, 5, 5, 1], ['store', 4, 7, 5, 5, 1], ['guild', 11, 7, 7, 5, 1],
  ['house', -18, 14, 6, 4, 1], ['house', 12, 14, 6, 4, 1], // (the middle pair of this row made way for the kingdom's building plots)
  ['house', -24, 7, 4, 5, 2], ['house', 21, 7, 4, 5, 2], ['house', -22, -25, 6, 4, 2], ['house', -9, 20, 5, 4, 2], ['house', 4, 20, 5, 4, 2],
  ['house', -30, 7, 4, 5, 3], ['house', 27, 7, 4, 5, 3], ['house', -23, -30, 6, 4, 3], ['house', 17, -30, 6, 4, 3], ['house', -17, 26, 6, 4, 3], ['house', 11, 26, 6, 4, 3],
  ['house', -36, 8, 4, 5, 4], ['house', 33, 8, 4, 5, 4], ['house', -27, 32, 6, 4, 4], ['house', 21, 32, 6, 4, 4],
  ['house', -42, 8, 4, 5, 5], ['house', 39, 8, 4, 5, 5], ['house', -31, -42, 6, 4, 5], ['house', 25, -42, 6, 4, 5], ['house', -9, 38, 5, 4, 5], ['house', 4, 38, 5, 4, 5],
  ];
  const BNAMES = {
    sylvan: { arms: 'Thornedge Arms', alchemist: 'Dewleaf Remedies', pub: 'The Laughing Troll', kingtower: 'Aelindor Town Hall', hall: 'Aelindor Town Hall', inn: 'The Moonlit Bough', bank: 'Silverleaf Vault', guild: 'Hall of the Old Ways', smithy: 'Leafsteel Forge', tailor: 'Threadwhisper Looms', store: 'Glade Provisions', armorer: 'Bark & Mail', weaponsmith: 'Thornedge Arms', scribe: 'Library of Leaves', fletcher: 'Feather & Yew', jeweler: 'Dewdrop Gems', gemcutter: 'Starlight Lapidary', bowyer: 'Yewheart Bowyers', forge: 'Elderforge', armory: 'Royal Armory', exchange: 'Grand Exchange', heroes: 'Hall of Heroes', house: 'Cottage' },
    iron: { arms: 'Axe & Anvil', alchemist: 'Bitterroot Apothecary', pub: 'The Rusty Pick', kingtower: 'Khar Duum Town Hall', hall: 'Khar Duum Town Hall', inn: 'The Foaming Tankard', bank: 'Deepvault Bank', guild: 'Guild of the Hammer', smithy: 'Runeforge', tailor: 'Hide & Bolt', store: 'Delver Supplies', armorer: 'Stonemail Outfitters', weaponsmith: 'Axe & Anvil', scribe: 'Gearwright Scriptorium', fletcher: 'Bolt & Barrel', jeweler: 'Gemvein Jewelers', gemcutter: 'Deepstone Lapidary', bowyer: 'Crossbow Works', forge: 'Magma Forge', armory: 'Royal Armory', exchange: 'Grand Exchange', heroes: 'Hall of Heroes', house: 'Stonehome' },
    crown: { arms: 'Sword & Shield', alchemist: 'The Green Phial', pub: 'The Drunken Sellsword', kingtower: 'Valenmoor Town Hall', hall: 'Valenmoor Town Hall', inn: 'The Gilded Goose', bank: 'Crown Treasury', guild: 'Valen Academy', smithy: "Hammersmith's", tailor: 'Needle & Thimble', store: 'Market Hall', armorer: 'Shield & Mail', weaponsmith: 'Swordsmith Row', scribe: 'Royal Scriptorium', fletcher: "Bowyer's Lodge", jeweler: 'Crown Jewelers', gemcutter: 'Royal Lapidary', bowyer: 'Longbow Hall', forge: 'Kingsforge', armory: 'Royal Armory', exchange: 'Grand Exchange', heroes: 'Hall of Heroes', house: 'House' },
  };

  const BARRACKS_SIZES = [[9, 6], [11, 6], [13, 7], [15, 7], [17, 8]];
  function placeBarracks(f, level, cx, cy, R, names) {
    const sizes = BARRACKS_SIZES.slice(0, Math.max(1, Math.min(5, level))).reverse().concat([[11, 4], [9, 5], [9, 4], [8, 5], [7, 5], [7, 4]]);
    let M = 2;
    const free = (x0, y0, w, h) => {
      for (let y = y0 - M; y < y0 + h + M + 1; y++) for (let x = x0 - M; x < x0 + w + M; x++) {
        const dx = x - cx, dy = y - cy;
        if (Math.abs(dx) > R - 1 - (M > 1 ? 1 : 0) || Math.abs(dy) > R - 1 - (M > 1 ? 1 : 0)) return false;
        if (dx >= -8 && dx <= 8 && dy >= -7 && dy <= 2) return false; // plaza
        if (Math.abs(dx) <= 3) return false; // the north-south avenue
        if (dx >= -12 && dx <= 4 && dy >= -21 && dy <= -6) return false; // the Town Hall
        if (dx >= -20 && dx <= -13 && dy >= -19 && dy <= -11) return false; // the green
        if (dx >= -19 && dx <= -3 && dy >= -6 && dy <= 0) return false; // the castle's courtyard (room for siege engines)
        const t = W.tiles[y * W.W + x]; if (t === T.WALL || t === T.DOOR || t === T.CWALL || t === T.WATER) return false;
      }
      for (const b of W.buildings) if (b.city === f && !(x0 + w + M <= b.x || b.x + b.w + M <= x0 || y0 + h + M + 1 <= b.y || b.y + b.h + M <= y0)) return false;
      // keep the east and west gate roads (rows 1..5) open
      if (y0 <= cy + 5 && y0 + h >= cy + 1) return false;
      return true;
    };
    for (const [m2, [w, h]] of sizes.flatMap((sz) => [[2, sz], [1, sz]])) {
      M = m2; const cands = [];
      for (let y = cy - R + 1; y <= cy + R - 1 - h; y++) for (let x = cx - R + 1; x <= cx + R - 1 - w; x++) if (free(x, y, w, h)) cands.push([x, y]);
      if (!cands.length) continue;
      cands.sort((a, b) => Math.hypot(a[0] + w / 2 - cx, a[1] + h / 2 - cy) - Math.hypot(b[0] + w / 2 - cx, b[1] + h / 2 - cy));
      const [x, y] = cands[0];
      W.decor = W.decor.filter((d) => !(d.tx >= x - 1 && d.tx <= x + w && d.ty >= y - 1 && d.ty <= y + h));
      const b = stampBuilding({ x, y, w, h, type: 'barracks', name: `${D.FACTIONS[f] ? D.FACTIONS[f].city : ''} Barracks`, faction: f, city: f, style: f, minLevel: 1 });
      b.city = f; W.cityData[f] = W.cityData[f] || {}; W.cityData[f].barracksB = b;
      return b;
    }
    return null;
  }
  // ---------- the kingdom's building plots (realm.js builds on them; realm3d.js draws them) ----------
  // Each kingdom building has its own fixed, marked plot of open ground off the streets: [id, w, h] in tiles. The sawmill
  // and the stone cutter reserve the footprint of their grandest (level 3) form; the rest are about the size of a house.
  // the pub is a real building on its plot (like the barracks); the shipyard plot lies by the sea gate, for the
  // shipyard and its ships (the naval work builds on W.cityData[f].plots' 'shipyard' entry and cd.harbour)
  const PLOTS = [['barracks', 10, 6], ['sawmill', 8, 6], ['cutter', 8, 6], ['range', 9, 6], ['stable', 8, 5], ['workshop', 9, 6], ['pub', 10, 8], ['shipyard', 9, 7]];
  const PLOT_MIN = { barracks: [8, 5], sawmill: [6, 5], cutter: [6, 5], range: [7, 5], stable: [6, 4], workshop: [7, 5], pub: [9, 7], shipyard: [8, 6] };
  // where each plot would rather be: by default near the plaza; the shipyard as near the sea gate as it can
  const plotAnchor = (id, f, cx, cy, R) => id === 'shipyard' ? (f === 'sylvan' ? [cx, cy - R + 2] : [cx - R + 2, cy + 3]) : [cx, cy];
  W.realmMode = () => !!(KR.Realm && typeof KR.Realm.state === 'function');
  // the kingdom's town keeps one size from the start (walls are upgraded, not moved out): at least the old level-4
  // walls, so every building plot fits and none of them moves as the town fills up
  { const cr0 = D.cityRadius; if (cr0 && !cr0._realm) { D.cityRadius = (lvl) => cr0(W.realmMode() ? Math.max(4, lvl) : lvl); D.cityRadius._realm = true; } }
  W.realmHas = (f, id) => { const R2 = KR.Realm; if (!R2 || typeof R2.has !== 'function') return id === 'barracks'; try { return !!R2.has(f, id); } catch (e) { return id === 'barracks'; } };
  // the level of a kingdom building (0 = not built), from KR.Realm
  W.realmLevel = (f, id) => { const R2 = KR.Realm; try { const st = R2 && typeof R2.state === 'function' && R2.state(f); const v = st && st.buildings && st.buildings[id]; return typeof v === 'number' ? v : v ? 1 : 0; } catch (e) { return 0; } };
  // the solid footprint of a building on its plot (tile rect): it stands at the back of the plot, growing with its level,
  // and always leaves the plot's front row (the side toward the street) and a tile at each side open to walk round
  W.plotFootprint = function (p, lvl) {
    const k = lvl >= 3 ? 1 : lvl === 2 ? 0.85 : 0.7;
    const w = Math.max(3, Math.round((p.w - 2) * k)), h = Math.max(3, Math.round((p.h - 1) * k));
    return { x: p.x + Math.floor((p.w - w) / 2), y: p.front === 'n' ? p.y + p.h - h : p.y, w, h };
  };
  const LANES = [-10, -9, 13, 14, 18, 19];
  function placePlots(f, cx, cy, R) {
    const cd = W.cityData[f] = W.cityData[f] || {}; const out = []; cd.plots = out;
    const taken = (x0, y0, w, h, M) => out.some((p) => !(x0 + w + M <= p.x || p.x + p.w + M <= x0 || y0 + h + M <= p.y || p.y + p.h + M <= y0));
    const free = (x0, y0, w, h, M) => {
      for (let y = y0 - M; y < y0 + h + M + 1; y++) for (let x = x0 - M; x < x0 + w + M; x++) {
        const dx = x - cx, dy = y - cy;
        if (Math.abs(dx) > R - 2 || Math.abs(dy) > R - 2) return false;
        if (dx >= -8 && dx <= 8 && dy >= -7 && dy <= 2) return false; // the plaza
        if (Math.abs(dx) <= 3) return false; // the north-south avenue
        if (dx >= -12 && dx <= 4 && dy >= -21 && dy <= -6) return false; // the Town Hall
        if (dx >= -20 && dx <= -13 && dy >= -19 && dy <= -11) return false; // the green
        if (dx >= -19 && dx <= -3 && dy >= -6 && dy <= 0) return false; // the castle's courtyard (the siege yard)
        if (LANES.includes(dy)) return false; // the lanes behind the rows of buildings
        const k = y * W.W + x, t = W.tiles[k];
        if (t === T.WALL || t === T.DOOR || t === T.CWALL || t === T.WATER || t === T.DEEP || t === T.STONE) return false;
        if (W.stairs && W.stairs.get(k)) return false;
      }
      if (y0 <= cy + 5 && y0 + h >= cy + 1) return false; // the east and west gate roads (rows 1..5)
      for (const b of W.buildings) if (b.city === f && !(x0 + w + M <= b.x || b.x + b.w + M <= x0 || y0 + h + M + 1 <= b.y || b.y + b.h + M <= y0)) return false;
      // ...nor where a building of a later town level will stand, so a plot keeps its place as the town grows
      const rm = W.realmMode();
      for (const [type, bx, by, bw, bh, minL] of CITY_LAYOUT) { if (type === 'house' && (rm ? minL > 2 : true)) continue; const X = cx + bx, Y = cy + by; if (!(x0 + w + M <= X || X + bw + M <= x0 || y0 + h + M + 1 <= Y || Y + bh + M <= y0)) return false; }
      return !taken(x0, y0, w, h, M);
    };
    for (const [id, w0, h0] of PLOTS) {
      const [wm, hm] = PLOT_MIN[id]; let got = null;
      for (const M of [2, 1]) { for (let w = w0, h = h0; !got && w >= wm && h >= hm; w > wm ? w-- : h--) {
        const c = []; for (let y = cy - R + 2; y <= cy + R - 2 - h; y++) for (let x = cx - R + 2; x <= cx + R - 2 - w; x++) if (free(x, y, w, h, M)) c.push([x, y]);
        if (c.length) { const [ax, ay] = plotAnchor(id, f, cx, cy, R); c.sort((a, b2) => Math.hypot(a[0] + w / 2 - ax, a[1] + h / 2 - ay) - Math.hypot(b2[0] + w / 2 - ax, b2[1] + h / 2 - ay)); got = { id, x: c[0][0], y: c[0][1], w, h }; }
      } if (got) break; }
      if (!got) continue;
      out.push(got);
      // the plot is bare ground, cleared of decor; its front edge faces the nearest street
      W.decor = W.decor.filter((d) => !(d.tx >= got.x - 1 && d.tx <= got.x + got.w && d.ty >= got.y - 1 && d.ty <= got.y + got.h));
      for (let y = got.y; y < got.y + got.h; y++) for (let x = got.x; x < got.x + got.w; x++) { const k = y * W.W + x; W.tiles[k] = T.GRAVEL; W.block[k] = 0; }
      // which side faces the street: the side with the most paved tiles just outside it
      const paved = (x, y) => { const t = W.tile(x, y); return t === T.STONE || t === T.COBBLE || t === T.ROAD; };
      let sN = 0, sS = 0; for (let x = got.x; x < got.x + got.w; x++) { if (paved(x, got.y - 1) || paved(x, got.y - 2)) sN++; if (paved(x, got.y + got.h) || paved(x, got.y + got.h + 1)) sS++; }
      got.front = sN > sS ? 'n' : 's';
    }
    // finished buildings (other than the barracks, a real building) are solid where they stand
    for (const q of out) { if (q.id === 'barracks' || q.id === 'pub' || q.id === 'shipyard') continue; const lv = W.realmLevel(f, q.id); q.level = lv; if (!lv) continue;
      const fp = W.plotFootprint(q, lv); q.fp = fp;
      for (let y = fp.y; y < fp.y + fp.h; y++) for (let x = fp.x; x < fp.x + fp.w; x++) W.block[y * W.W + x] = 1; }
    return out;
  }
  // the last touches to a city once everything stands
  function cityFinish(f) {
    const bs = W.buildings.filter((b) => b.city === f);
    // the king and his royal guard stand up in the king's tower: the king before his throne, two guards beside
    // him and two out on the balcony
    const hall = bs.find((b) => b.type === 'hall'), tw = bs.find((b) => b.type === 'kingtower' && b.loft);
    if (hall && tw) {
      const L = tw.loft, ix0 = tw.x + 1, ix1 = tw.x + tw.w - 2, mid = Math.floor((ix0 + ix1) / 2);
      const at = (tx, ty) => [tx * TS + 16, ty * TS + 20];
      hall.spots.king = [at(mid, L.y0 + 1)];
      const g = [at(mid - 2, L.y0 + 1), at(mid + 2, L.y0 + 1)];
      const B = tw.balcony; if (B) { const bx = B.side === 'w' ? B.x0 : B.x1; g.push(at(bx, B.y0), at(bx, B.y1)); } else g.push(at(mid - 1, L.y1), at(mid + 1, L.y1));
      hall.spots.guard = g;
      tw.court = true; // KR.Kingdom marks the king and guards standing here as upstairs
      if (B) W.decor = W.decor.filter((d) => d.up || d.flat || !(d.tx >= B.x0 && d.tx <= B.x1 && d.ty >= B.y0 - 1 && d.ty <= B.y1 + 1));
    }
    // doorways stay clear: nothing standing in a door, on the two tiles inside it or the two in front of it
    // (torches, lamps and dummies do not block in 2D, but in 3D you would walk through them)
    const keep = ['rug', 'carpet', 'banner', 'lamp_wall', 'torch_wall', 'tapestry'];
    for (const b of bs) {
      const d = b.door; if (!d) continue;
      const [nx, ny] = d.ty === b.y + b.h - 1 ? [0, 1] : d.ty === b.y ? [0, -1] : d.tx === b.x ? [-1, 0] : [1, 0]; // outward
      const tiles = [[0, 0], [-1, 0], [-2, 0], [1, 0], [2, 0], [1, 1], [1, -1]].map(([o, l]) => [d.tx + nx * o + ny * l, d.ty + ny * o + nx * l]);
      for (const [tx, ty] of tiles) {
        if (!W.inb(tx, ty)) continue;
        W.decor = W.decor.filter((o) => !(o.tx === tx && o.ty === ty && !o.up && !o.flat && !keep.includes(o.kind)));
        const k = ty * W.W + tx; if (!SOLID[W.tiles[k]]) W.block[k] = 0;
      }
    }
    // the open-air front of a craft house (the smithy's forge, the tailor's stall...) stands on the street beside the
    // door: those tiles are blocked (an invisible 'yard' marker) so nobody walks through it in 3D, and b.yard tells the
    // 3D builder exactly where it may build. Only where the street stays at least two tiles wide past it.
    const YARD = new Set(['smithy', 'forge', 'tailor', 'armorer', 'armory', 'weaponsmith', 'fletcher', 'bowyer', 'scribe', 'jeweler', 'gemcutter', 'store']);
    for (const b of bs) {
      b.yard = null; if (!YARD.has(b.type) || !b.door) continue; const d = b.door, ty = b.y + b.h;
      const left = d.tx - b.x, right = b.x + b.w - 1 - d.tx; const side = right >= left ? 1 : -1;
      const xs = []; for (let x = d.tx + side * 2; side > 0 ? x <= b.x + b.w - 1 : x >= b.x; x += side) xs.push(x);
      const ok = (x) => { const k = ty * W.W + x; if (!W.inb(x, ty + 2) || SOLID[W.tiles[k]] || W.block[k] || W.tiles[k] === T.WATER || W.buildingAt(x * TS + 16, ty * TS + 16) || W.stairs && W.stairs.get(k) || W.decor.some((o) => o.tx === x && o.ty === ty && !o.flat)) return false;
        for (const dy of [1, 2]) { const k2 = (ty + dy) * W.W + x; if (SOLID[W.tiles[k2]] || W.block[k2] || W.buildingAt(x * TS + 16, (ty + dy) * TS + 16)) return false; } return true; };
      const use = []; for (const x of xs) { if (!ok(x)) break; use.push(x); }
      if (use.length < 1) continue;
      for (const x of use) { addDecor('yard', x, ty, {}); }
      b.yard = { x0: Math.min(...use), x1: Math.max(...use), ty };
    }
  }
  // when a city is rebuilt (a kingdom level-up, often handed in to the king while you stand in his castle) everyone in
  // it keeps their footing: whoever was upstairs stays on the new building's upper floor, and anyone left inside a wall,
  // a prop or a balustrade steps to the nearest open tile on the same floor
  function keepFooting(f, cx, cy, R) {
    const G = KR.G; if (!G || !G.ents) return;
    const lvOf = (px, py) => { const b = W.buildingAt(px, py); return b && b.terr ? Math.round(W.terrAt(b, px, py) * 4) / 4 : 0; };
    for (const e of G.ents) {
      if (e.dead || e.removed || e.x == null || Math.max(Math.abs(e.x / TS - cx), Math.abs(e.y / TS - cy)) > R + 3) continue;
      const lv0 = lvOf(e.x, e.y); // the castle stands the same at every level, so its floors are where they were
      if (e.upB) { // the old building object is gone: hand over to the one that replaced it, if its upper floor is here
        const o = e.upB; const nb = W.buildings.find((b) => b.city === o.city && b.type === o.type && b.x === o.x && b.y === o.y);
        const L = nb && nb.loft; const tx = Math.floor(e.x / TS), ty = Math.floor(e.y / TS);
        const up = L && tx >= L.x0 && tx <= L.x1 && ty >= L.y0 && ty <= L.y1;
        if (o !== nb) { e.upB = up ? nb : null; if (e.loftHome === o) e.loftHome = up ? nb : null; }
        if (e.upB) continue;
      }
      const stuck = (px, py) => W.solidAtPx(px - 8, py - 4) || W.solidAtPx(px + 8, py - 4) || W.solidAtPx(px - 8, py + 6) || W.solidAtPx(px + 8, py + 6);
      if (!stuck(e.x, e.y)) continue;
      const tx = Math.floor(e.x / TS), ty = Math.floor(e.y / TS); let best = null;
      for (let r = 1; r <= 8 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const px = (tx + dx) * TS + 16, py = (ty + dy) * TS + 16;
        if (stuck(px, py) || W.isBlockedTile(tx + dx, ty + dy)) continue;
        const sameFloor = lv0 == null || Math.abs(lvOf(px, py) - lv0) < 0.3; const d = Math.hypot(dx, dy) + (sameFloor ? 0 : 50);
        if (!best || d < best[2]) best = [px, py, d];
      }
      if (best) { e.x = best[0]; e.y = best[1]; }
    }
  }
  W.stampCity = function (f, level, initial) {
    const [cx, cy] = D.CITY_CENTER[f]; const base = W.cityBase[f]; const R = D.cityRadius(level);
    // a kingdom's town starts open: no walls, gates or wall stairs until the court builds them (KR.Realm walls 1..3:
    // a wooden palisade, stone walls, fortified gates); without the economy the old stone walls stand
    const walled = !W.realmMode() || W.realmLevel(f, 'walls') >= 1;
    // restore base terrain & remove old city content
    const x0 = base.x0, y0 = base.y0, bw = base.w;
    for (let y = 0; y < bw; y++) for (let x = 0; x < bw; x++) { const tx = x0 + x, ty = y0 + y; if (!W.inb(tx, ty)) continue; const k = ty * W.W + tx; W.tiles[k] = base.tiles[y * bw + x]; W.block[k] = 0; if (W.edge) W.edge[k] = 0; }
    const inArea = (tx, ty) => tx >= x0 && ty >= y0 && tx < x0 + bw && ty < y0 + bw;
    W.buildings = W.buildings.filter((b) => { if (b.city === f) { delete W.doorAt[b.door.ty * W.W + b.door.tx]; return false; } return true; });
    if (W.stairs) for (const [i, st] of [...W.stairs]) if (st.f === f || (st.loft && st.loft.city === f)) W.stairs.delete(i);
    W.decor = W.decor.filter((d) => !inArea(d.tx, d.ty));
    W.lights = W.lights.filter((l) => !inArea(Math.floor(l.x / TS), Math.floor(l.y / TS)));
    // re-add wild decor around (outside walls) deterministically
    for (let y = 0; y < bw; y++) for (let x = 0; x < bw; x++) {
      const tx = x0 + x, ty = y0 + y; if (!W.inb(tx, ty)) continue;
      if (Math.max(Math.abs(tx - cx), Math.abs(ty - cy)) <= R + 2) continue;
      const t = W.tiles[ty * W.W + tx]; if (SOLID[t] || t === T.ROAD || t === T.WATER || t === T.BRIDGE) continue;
      const h = U.hash(tx, ty, 77), h2 = U.hash(tx, ty, 91);
      let dens = f === 'sylvan' ? 0.09 : f === 'iron' ? 0.03 : 0.012;
      if (f === 'sylvan') {
        // Aelindor's woods open out near the city: open glades under the walls, clear ground along the roads and before
        // the gates, and the trees thinning in to about a third of the wild wood's density (back to full by the edge)
        const d = Math.max(Math.abs(tx - cx), Math.abs(ty - cy)) - R;
        let road = false; for (let j = -2; j <= 2 && !road; j++) for (let i = -2; i <= 2 && !road; i++) { const t2 = W.tile(tx + i, ty + j); if (t2 === T.ROAD || t2 === T.BRIDGE) road = true; }
        const byGate = [[cx, cy + R], [cx + R, cy + 3], [cx - R, cy + 3], [cx, cy - R]].some(([gx, gy]) => Math.abs(tx - gx) <= 8 && Math.abs(ty - gy) <= 8);
        dens = d < 6 || road || byGate ? 0 : dens * Math.min(1, 0.3 + ((d - 6) / 45) * 0.7);
      }
      if (h < dens) addDecor(f === 'sylvan' ? (h2 < 0.6 ? 'elmwood' : 'oak') : f === 'iron' ? (h2 < 0.6 ? 'pine' : 'boulder') : 'oak', tx, ty, {});
      else if (h < dens + 0.05 && h2 < 0.5) addDecor(f === 'iron' ? 'pebbles' : 'flowers', tx, ty, { nb: true });
    }
    // ground + walls
    for (let ty = cy - R; ty <= cy + R; ty++) for (let tx = cx - R; tx <= cx + R; tx++) {
      const k = ty * W.W + tx, dx = tx - cx, dy = ty - cy;
      const wall = Math.abs(dx) === R || Math.abs(dy) === R;
      const gate = (dy === R && Math.abs(dx) <= 1) || (Math.abs(dx) === R && dy >= 2 && dy <= 4) || (f === 'sylvan' && dy === -R && Math.abs(dx) <= 2); // Aelindor's sea gate opens north onto the harbour
      if (wall && !gate && walled) W.tiles[k] = T.CWALL;
      else {
        let g = T.COBBLE;
        if (f === 'sylvan' && U.fbm(tx * 0.15, ty * 0.15, 31) > 0.55) g = T.FOREST;
        if (f === 'crown' && U.fbm(tx * 0.15, ty * 0.15, 31) > 0.62) g = T.GRASS;
        W.tiles[k] = g;
      }
    }
    // roads out of gates
    const outRoad = (sx, sy, dx, dy, n) => { for (let i = 0; i < n; i++) for (let w = -1; w <= 1; w++) { const tx = sx + dx * i + (dy ? w : 0), ty = sy + dy * i + (dx ? w : 0); if (W.inb(tx, ty)) { const k = ty * W.W + tx; if (!SOLID[W.tiles[k]] || W.tiles[k] === T.ROCK) W.tiles[k] = T.ROAD; W.block[k] = 0; } } };
    outRoad(cx, cy + R + 1, 0, 1, 12);
    for (const [lx, ly] of [[cx - 3, cy + R + 4], [cx + 3, cy + R + 9], [cx + R + 5, cy + 1], [cx - R - 5, cy + 1]]) if (W.inb(lx, ly) && !SOLID[W.tiles[ly * W.W + lx]]) { addDecor('lamp', lx, ly, {}); W.lights.push({ x: lx * TS + 16, y: ly * TS - 20, r: 190, col: '255,196,110', fl: 0.08, k: 'lamp' }); } outRoad(cx + R + 1, cy + 3, 1, 0, 10); outRoad(cx - R - 1, cy + 3, -1, 0, 10);
    // roads that reached the wall away from a gate: cut them short of the wall and run them along the walls to the nearest gate
    if (walled) {
      const ringD = (tx, ty) => Math.max(Math.abs(tx - cx), Math.abs(ty - cy));
      const nearGate = (tx, ty) => { const dx = tx - cx, dy = ty - cy; return (dy > R && Math.abs(dx) <= 1) || (Math.abs(dx) > R && dy >= 2 && dy <= 4); };
      const isRoad = (t) => t === T.ROAD || t === T.BRIDGE;
      const fillFor = (tx, ty) => { const n = new Map(); for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const t = W.tile(tx + i, ty + j); if (t == null || isRoad(t) || SOLID[t] || t === T.COBBLE || t === T.STONE || t === T.WATER) continue; n.set(t, (n.get(t) || 0) + 1); } let best = T.GRASS, bn = 0; for (const [t, c] of n) if (c > bn) { best = t; bn = c; } return best; };
      const L = R + 3, P = 8 * L; // the walk around the walls runs on the square ring at distance L
      const ringAt = (i) => { i = ((i % P) + P) % P; const side = Math.floor(i / (2 * L)), o = (i % (2 * L)) - L; return side === 0 ? [cx + o, cy + L] : side === 1 ? [cx + L, cy - o] : side === 2 ? [cx - o, cy - L] : [cx - L, cy + o]; };
      const ringIndex = (tx, ty) => { let best = 0, bd = 1e9; for (let i = 0; i < P; i++) { const [x, y] = ringAt(i); const d = Math.abs(x - tx) + Math.abs(y - ty); if (d < bd) { bd = d; best = i; } } return best; };
      const gates = [ringIndex(cx, cy + L), ringIndex(cx + L, cy + 3), ringIndex(cx - L, cy + 3)];
      const contacts = [];
      for (let ty = cy - R - 2; ty <= cy + R + 2; ty++) for (let tx = cx - R - 2; tx <= cx + R + 2; tx++) {
        if (!W.inb(tx, ty) || ringD(tx, ty) <= R || nearGate(tx, ty)) continue;
        const k = ty * W.W + tx; if (!isRoad(W.tiles[k])) continue;
        if (ringD(tx, ty) === R + 1) contacts.push([tx, ty]);
        W.tiles[k] = W.tiles[k] === T.BRIDGE ? T.WATER : fillFor(tx, ty);
      }
      const paint = (tx, ty) => { if (!W.inb(tx, ty) || ringD(tx, ty) <= R + 1) return; const k = ty * W.W + tx, t = W.tiles[k]; if (t === T.DEEP || t === T.LAVA || t === T.CWALL || t === T.WALL) return; W.tiles[k] = t === T.WATER ? T.BRIDGE : T.ROAD; W.block[k] = 0; };
      const done = new Set();
      for (const [tx, ty] of contacts) {
        const s0 = ringIndex(tx, ty); if (done.has(s0)) continue; done.add(s0);
        // from where the old road met the wall, walk out to the ring, then around it the short way to a gate
        const ox = Math.sign(tx - cx) * (Math.abs(tx - cx) > R ? 1 : 0), oy = Math.sign(ty - cy) * (Math.abs(ty - cy) > R ? 1 : 0);
        for (let d = 0; d <= 3; d++) for (let w = -1; w <= 1; w++) paint(tx + ox * d + (oy ? w : 0), ty + oy * d + (ox ? w : 0));
        let bestG = null, bestSteps = 1e9;
        for (const g of gates) for (const dir of [1, -1]) { const st = (((g - s0) * dir) % P + P) % P; if (st < bestSteps) { bestSteps = st; bestG = dir; } }
        for (let i = 0; i <= bestSteps; i++) { const [x, y] = ringAt(s0 + i * bestG); for (let j = -1; j <= 1; j++) for (let k2 = -1; k2 <= 1; k2++) if (Math.abs(j) + Math.abs(k2) <= 1) paint(x + j, y + k2); }
      }
      W.decor = W.decor.filter((d) => !(ringD(d.tx, d.ty) > R && isRoad(W.tile(d.tx, d.ty)) && !['lamp', 'signpost'].includes(d.kind)));
    }
    harbour(f, R, cx, cy);
    // the grand plaza before the Town Hall: the main avenue runs from the south gate straight across it to the hall's gate
    for (let ty = cy - 6; ty <= cy + 1; ty++) for (let tx = cx - 7; tx <= cx + 7; tx++) W.tiles[ty * W.W + tx] = T.STONE;
    // the two avenues (paved, gate to gate) and the lanes behind the rows of buildings
    for (let d = -R + 1; d <= R - 1; d++) { for (let w = -2; w <= 2; w++) { W.tiles[(cy + d) * W.W + cx + w] = T.STONE; } for (let w = 1; w <= 5; w++) W.tiles[(cy + w) * W.W + cx + d] = T.STONE; }
    for (const ly of [-10, -9, 13, 14, 18, 19]) if (Math.abs(ly) < R - 1) for (let d = -R + 1; d <= R - 1; d++) { const k = (cy + ly) * W.W + cx + d; if (W.tiles[k] !== T.STONE) W.tiles[k] = T.COBBLE; }
    // the green, west of the Town Hall, with trees and a bench
    for (let ty = cy - 18; ty <= cy - 12; ty++) for (let tx = cx - 19; tx <= cx - 14; tx++) W.tiles[ty * W.W + tx] = T.GRASS;
    for (const [ox, oy] of [[-18, -17], [-15, -13]]) addDecor('oak', cx + ox, cy + oy, { garden: true });
    addDecor('bench', cx - 16, cy - 15, { nb: true, ry: Math.PI / 2 });
    const inHallRect = (x, y) => x >= cx - 11 && x <= cx + 3 && y >= cy - 20 && y <= cy - 7; // the Town Hall's footprint
    for (let d = -R + 3; d <= R - 3; d += 6) for (const [x, y] of [[cx - 3, cy + d], [cx + 3, cy + d], [cx + d, cy], [cx + d, cy + 6]]) { if (Math.abs(x - cx) <= 8 && y - cy >= -7 && y - cy <= 1) continue; if (inHallRect(x, y)) continue; const k = y * W.W + x; if (W.tiles[k] !== T.STONE && W.tiles[k] !== T.COBBLE) continue; addDecor('lamp', x, y, {}); W.lights.push({ x: x * TS + 16, y: y * TS - 20, r: 170, col: '255,196,110', fl: 0.08, k: 'lamp' }); }
    // two fountains either side of the avenue (the way to the hall's gate stays straight and clear), statues flanking
    // the gate, the kingdom's banners round the plaza and lamps along the way in
    for (const ox of [-5, 6]) { addDecor(level >= 5 ? 'monument' : 'fountain', cx + ox, cy - 2, {}); W.lights.push({ x: (cx + ox) * TS + 16, y: (cy - 2) * TS, r: level >= 5 ? 220 : 160, col: level >= 5 ? '255,220,140' : '170,210,255', fl: 0.05, k: 'magic' }); }
    for (const ox of [-5, 6]) addDecor('statue', cx + ox, cy - 6, {});
    for (const [ox, oy] of [[-7, -6], [7, -6], [-7, 1], [7, 1], [-3, -6], [4, -6]]) addDecor('flagpole', cx + ox, cy + oy, { nb: true, f });
    for (const [ox, oy] of [[-3, -4], [4, -4], [-3, 0], [4, 0]]) { addDecor('lamp', cx + ox, cy + oy, {}); W.lights.push({ x: (cx + ox) * TS + 16, y: (cy + oy) * TS - 20, r: 170, col: '255,196,110', fl: 0.08, k: 'lamp' }); }
    if (level >= 2) { addDecor('stall', cx - 7, cy - 5, { col: '#b84a3a' }); addDecor('stall', cx + 7, cy - 5, { col: '#3a6ab8' }); addDecor('stall', cx - 7, cy - 1, { col: '#c9a23a' }); addDecor('stall', cx + 7, cy - 1, { col: '#3a8a5a' }); }
    // towers + torches on walls
    // (the old stone guard towers on the wall corners are gone: the gates are guarded by archer towers and siege engines)
    if (walled) for (let i = -R + 4; i <= R - 4; i += 6) {
      for (const [tx, ty] of [[cx + i, cy - R + 1], [cx + i, cy + R - 1], [cx - R + 1, cy + i], [cx + R - 1, cy + i]]) {
        if (W.tiles[ty * W.W + tx] === T.CWALL) continue;
        addDecor('torch', tx, ty, {});
        W.lights.push({ x: tx * TS + 16, y: ty * TS, r: 150, col: '255,170,90', fl: 0.15, k: 'fire' });
      }
    }
    // gate torches
    if (walled) for (const [tx, ty] of [[cx - 2, cy + R], [cx + 2, cy + R], [cx + R, cy + 1], [cx + R, cy + 5], [cx - R, cy + 1], [cx - R, cy + 5]]) W.lights.push({ x: tx * TS + 16, y: ty * TS - 10, r: 200, col: '255,175,95', fl: 0.12, k: 'fire' });
    // buildings
    const names = BNAMES[f];
    for (const [type, bx, by, bw2, bh, minL] of CITY_LAYOUT) {
      if (minL > level) continue;
      if (type === 'house' && minL > 2 && W.realmMode()) continue; // the kingdom (KR.Realm) keeps a small town: its open ground goes to building plots
      const b = stampBuilding({ x: cx + bx, y: cy + by, w: bw2, h: bh, doorX: type === 'hall' ? cx + bx + bw2 - 4 : undefined, type, name: type === 'house' ? names.house : names[type], faction: f, city: f, style: f, minLevel: minL });
      b.city = f;
    }
    // the kingdom's building plots; the barracks stands on its plot only once it has been built (KR.Realm)
    W.cityData[f] = W.cityData[f] || {}; W.cityData[f].barracksB = null;
    const plots = placePlots(f, cx, cy, R);
    harbourYard(f); // the shipyard's plot on the quay (warmarch.js naval section)
    if (W.realmHas(f, 'barracks')) {
      const pb = plots.find((q) => q.id === 'barracks');
      if (pb) { const b = stampBuilding({ x: pb.x, y: pb.y, w: pb.w, h: pb.h, type: 'barracks', name: `${D.FACTIONS[f] ? D.FACTIONS[f].city : ''} Barracks`, faction: f, city: f, style: f, minLevel: 1 }); b.city = f; b.plot = 'barracks'; W.cityData[f].barracksB = b; }
      else placeBarracks(f, level, cx, cy, R, names);
    }
    W.cityData[f].pubB = null;
    if (W.realmMode() && W.realmHas(f, 'pub')) {
      const pp = plots.find((q) => q.id === 'pub');
      if (pp) { const b = stampBuilding({ x: pp.x, y: pp.y, w: pp.w, h: pp.h, type: 'pub', name: names.pub || 'The Pub', faction: f, city: f, style: f, minLevel: 1 }); b.city = f; b.plot = 'pub'; W.cityData[f].pubB = b; }
    }
    // no dead-end slivers: one-tile gaps behind buildings and along the wall, where walkers wander in and jam,
    // are filled with stacked crates and barrels (through-passages stay open)
    {
      const open = (x, y) => W.inb(x, y) && !W.isBlockedTile(x, y) && W.tile(x, y) !== T.DOOR;
      const inB = (x, y) => !!W.buildingAt(x * TS + 16, y * TS + 16);
      for (let pass = 0; pass < 60; pass++) { let n = 0;
        for (let y = cy - R + 1; y < cy + R; y++) for (let x = cx - R + 1; x < cx + R; x++) {
          if (!open(x, y) || inB(x, y) || W.tile(x, y) === T.STONE) continue;
          const sq = (!open(x - 1, y) && !open(x + 1, y)) || (!open(x, y - 1) && !open(x, y + 1)); if (!sq) continue;
          const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => open(x + dx, y + dy) && !W.doorAt[(y + dy) * W.W + x + dx]).length;
          const byWall = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => W.tile(x + dx, y + dy) === T.CWALL);
          if ((nb > 1 && !byWall) || [[1, 0], [-1, 0], [0, 1], [0, -1], [0, -2]].some(([dx, dy]) => W.tile(x + dx, y + dy) === T.DOOR)) continue;
          W.decor = W.decor.filter((d) => !(d.tx === x && d.ty === y)); { const h = U.hash(x, y, 3); addDecor(h < 0.4 ? 'crate' : h < 0.75 ? 'barrel' : 'keg', x, y, {}); } W.block[y * W.W + x] = 1; n++;
        }
        if (!n) break; }
    }
    // farm fields outside the walls, east and west
    for (const side of [-1, 1]) {
      let fx0 = side < 0 ? cx - R - 13 : cx + R + 4, fy0 = cy + 7;
      // a field that would lie on the harbour's quay goes south of the walls instead
      const H = W.cityData[f] && W.cityData[f].harbour;
      if (H) { let hit = false; for (let ty = fy0; ty < fy0 + 8 && !hit; ty++) for (let tx = fx0; tx < fx0 + 9 && !hit; tx++) { const ox = tx - H.gx, oy = ty - H.gy; const i = ox * H.dx + oy * H.dy, sd = ox * H.px + oy * H.py; if (i >= -2 && i <= H.k + 4 && Math.abs(sd) <= H.half + 3) hit = true; }
        if (hit) { fx0 = side < 0 ? cx - 15 : cx + 7; fy0 = cy + R + 4; } }
      for (let ty = fy0; ty < fy0 + 8; ty++) for (let tx = fx0; tx < fx0 + 9; tx++) {
        if (!W.inb(tx, ty)) continue; const k = ty * W.W + tx; if (SOLID[W.tiles[k]] && W.tiles[k] !== T.ROCK) continue;
        W.tiles[k] = T.FARM; W.block[k] = 0;
        W.decor = W.decor.filter((d) => !(d.tx === tx && d.ty === ty));
        if ((ty - fy0) % 2 === 0) addDecor('crop', tx, ty, { nb: true, crop: f });
      }
      addDecor('scarecrowpost', fx0 + 4, fy0 + 3, { nb: true });
      W.cityData[f] = W.cityData[f] || {}; (W.cityData[f].fields = W.cityData[f].fields || [])[side < 0 ? 0 : 1] = [fx0, fy0, 9, 8];
    }
    W.cityData[f].R = R; W.cityData[f].level = level; W.cityData[f].cx = cx; W.cityData[f].cy = cy; W.cityData[f].walled = walled;
    W.cityData[f].siegeYard = [cx - 18, cy - 5, 13, 5]; // [x, y, w, h] tiles: the open courtyard before the castle gate
    W.cityData[f].gates = [[cx, cy + R], [cx + R, cy + 3], [cx - R, cy + 3]].concat(f === 'sylvan' ? [[cx, cy - R]] : []);
    wallWalks(f, R, cx, cy);
    cityGrate(f, R, cx, cy);
    cityFinish(f);
    // invalidate chunk caches
    railMoves(); keepFooting(f, cx, cy, R);
    if (KR.R && KR.R.invalidateArea) KR.R.invalidateArea(x0, y0, bw, bw);
    if (!initial) W.buildMinimap();
  };

  // ---------- spawns ----------
  W.makeSpawns = function (rnd) {
    W.spawns = [];
    D.REGIONS.forEach((reg, ri) => {
      if (!reg.mobs) return;
      // count tiles in region
      const tilesIn = []; const dgn = reg.dungeon ? W.dungeons[reg.id] : null; const step = dgn ? 2 : 3;
      for (let y = 4; y < W.H - 4; y += step) for (let x = 4; x < W.W - 4; x += step) {
        if (W.region[y * W.W + x] !== ri) continue;
        if (W.isBlockedTile(x, y) || W.tile(x, y) === T.WATER || W.tile(x, y) === T.ROAD || W.tile(x, y) === T.BRIDGE || W.tile(x, y) === T.WOOD) continue;
        if (nearCity(x, y, 47) || nearHub(x, y, 13)) continue;
        if (dgn && Math.hypot(x - dgn.entry.x, y - dgn.entry.y) < 8) continue;
        if (dgn && dgn.cell && Math.abs(x - dgn.cell.x) <= dgn.cell.r + 3 && Math.abs(y - dgn.cell.y) <= dgn.cell.r + 3) continue;
        tilesIn.push([x, y]);
      }
      if (!tilesIn.length) return;
      const n = Math.round(tilesIn.length / (dgn ? 5 : 11));
      for (let i = 0; i < n; i++) {
        const [x, y] = tilesIn[Math.floor(rnd() * tilesIn.length)];
        if (dgn) { const far = Math.max(...dgn.rooms.map((o) => Math.hypot(o.x - dgn.entry.x, o.y - dgn.entry.y))) || 1; const lvR = U.clamp(Math.hypot(x - dgn.entry.x, y - dgn.entry.y) / far * 0.9 + rnd() * 0.2, 0, 1); W.spawns.push({ tx: x, ty: y, ri, mob: reg.mobs[Math.floor(rnd() * reg.mobs.length)], lvR, ent: null, timer: rnd() * 5 }); continue; }
        // levels increase with distance from the region's first seed? use random within range, a bit higher deeper in
        let lvR = rnd();
        if (reg.faction) { let dc = 1e9; for (const f of D.FACTION_IDS) { const [cx, cy] = D.CITY_CENTER[f]; dc = Math.min(dc, Math.hypot(x - cx, y - cy)); } const fd = U.clamp((dc - 46) / 85, 0, 1); lvR = U.clamp(fd * 0.85 + rnd() * 0.3 - 0.1, 0, 1); }
        W.spawns.push({ tx: x, ty: y, ri, mob: reg.mobs[Math.floor(rnd() * reg.mobs.length)], lvR, ent: null, timer: rnd() * 5 });
      }
      // camps get extra social mobs
      W.camps.filter((c) => c.ri === ri).forEach((c) => {
        for (let k = 0; k < 4; k++) {
          const sx = c.x + Math.round((rnd() - 0.5) * 6), sy = c.y + Math.round((rnd() - 0.5) * 6);
          if (W.isBlockedTile(sx, sy)) continue;
          const socials = reg.mobs.filter((m) => D.MOBS[m].social); const m = socials.length ? socials[Math.floor(rnd() * socials.length)] : reg.mobs[0];
          W.spawns.push({ tx: sx, ty: sy, ri, mob: m, lvR: 0.5 + rnd() * 0.5, ent: null, timer: 0 });
        }
      });
    });
    // city outskirts: easy starter mobs between the city wall and the wilds
    for (const f of D.FACTION_IDS) {
      if (!W.cityData[f]) continue;
      const ci = D.REGIONS.findIndex((r) => r.city === f), ni = D.REGIONS.findIndex((r) => r.faction === f && r.lv[0] === 1);
      if (ci < 0 || ni < 0) continue;
      const reg = D.REGIONS[ni]; const easy = reg.mobs.filter((m) => D.MOBS[m].lv[0] <= 3); if (!easy.length) continue;
      const [cx, cy] = D.CITY_CENTER[f]; const R = (W.cityData[f] && W.cityData[f].R) || 20;
      // nothing hunts on the harbour: from the sea gate across the quay and out along the piers
      const H = W.cityData[f].harbour;
      const inHarbour = (x, y) => { if (!H) return false; const ox = x - H.gx, oy = y - H.gy; const i = ox * H.dx + oy * H.dy, sd = ox * H.px + oy * H.py; return i >= -2 && i <= H.k + 24 && Math.abs(sd) <= H.half + 20; };
      const pts = [];
      for (let y = cy - 52; y <= cy + 52; y += 2) for (let x = cx - 52; x <= cx + 52; x += 2) {
        const dc = Math.max(Math.abs(x - cx), Math.abs(y - cy)); if (dc <= R + 5 || inHarbour(x, y)) continue;
        if ([T.WOOD, T.STONE, T.COBBLE].includes(W.tile(x, y))) continue; // no wolves on the paving or the planks
        if (!W.inb(x, y) || (W.regionAt(x, y) !== ci && dc > 47)) continue;
        if (W.isBlockedTile(x, y) || [T.WATER, T.ROAD, T.BRIDGE].includes(W.tile(x, y))) continue;
        pts.push([x, y, dc]);
      }
      const n = Math.min(70, Math.round(pts.length / 14));
      for (let i = 0; i < n; i++) {
        const [x, y, dc] = pts[Math.floor(rnd() * pts.length)];
        W.spawns.push({ tx: x, ty: y, ri: ni, city: f, mob: easy[Math.floor(rnd() * easy.length)], lvR: U.clamp((dc - R) / 60 * 0.35 + rnd() * 0.12, 0, 0.4), ent: null, timer: rnd() * 5 });
      }
    }
    // named mobs in dungeons: fixed spots in the middle rooms, rare and slow to respawn
    for (const dg of D.DUNGEONS) {
      const dd = W.dungeons[dg.id]; if (!dd) continue; const ri = D.REGION_BY_ID[dg.id];
      dg.named.forEach((id, k) => { const room = dd.rooms[Math.min(dd.rooms.length - 3, 1 + k * 2)] || dd.rooms[1]; W.spawns.push({ tx: room.x + 1, ty: room.y, ri, mob: id, lvR: 1, named: true, ent: null, timer: 30 + rnd() * 60 }); });
    }
    // bosses
    for (const b of D.BOSSES) {
      if ((b.realm || 'main') !== W.realm || !b.at) continue;
      let tx = b.at[0], ty = b.at[1];
      if (b.chamber) { const c = W.chambers[b.id]; tx = c.x + Math.floor(c.w / 2); ty = c.y + 3; }
      W.spawns.push({ tx, ty, ri: D.REGION_BY_ID[b.region], boss: b.id, ent: null, timer: 0 });
    }
  };

  // ---------- minimap ----------
  const MINI_COL = { 0: '#5f8f45', 1: '#3f6a37', 2: '#3d6a33', 3: '#a4875a', 4: '#8f8a80', 5: '#4a86b0', 6: '#2f5f8f', 7: '#cdbb84', 8: '#6b6660', 9: '#e8eef2', 10: '#5d5a3c', 11: '#5a5450', 12: '#7a5a3a', 13: '#3a3028', 14: '#9a6a3a', 15: '#7a6a3a', 16: '#8a6a40', 17: '#9a948a', 18: '#7d756a', 19: '#e0582a', 20: '#4a4440', 21: '#3a3346', 22: '#a3a856', 23: '#3e3632', 24: '#8a2a2a', 25: '#4a3e34', 26: '#a8c4d4', 27: '#3a2c2a' };
  W.buildMinimap = function () {
    const c = W.mapCanvas || (W.mapCanvas = document.createElement('canvas'));
    c.width = W.W; c.height = W.H; const g = c.getContext('2d'); const im = g.createImageData(W.W, W.H);
    const rgb = {}; for (const k in MINI_COL) { const h = MINI_COL[k]; rgb[k] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
    for (let i = 0; i < W.W * W.H; i++) {
      let c3 = rgb[W.tiles[i]] || [0, 0, 0];
      const v = (W.vari[i] / 255 - 0.5) * 14; const bl = W.block[i] ? -28 : 0;
      im.data[i * 4] = c3[0] + v + bl; im.data[i * 4 + 1] = c3[1] + v + bl; im.data[i * 4 + 2] = c3[2] + v + bl; im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  };

  // ---------- pathfinding (A*, 8-dir, bounded) ----------
  W.findPath = function (sx, sy, gx, gy, maxN = 5000, opts) {
    if (sx === gx && sy === gy) return [];
    if (W.isBlockedTile(gx, gy, opts)) return null;
    const key = (x, y) => y * W.W + x;
    const open = [[sx, sy, 0, Math.hypot(gx - sx, gy - sy)]]; const came = new Map(); const g = new Map([[key(sx, sy), 0]]);
    let n = 0;
    while (open.length && n++ < maxN) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][3] < open[bi][3]) bi = i;
      const [x, y, gc] = open[bi]; open.splice(bi, 1);
      if (x === gx && y === gy) { const path = []; let k = key(x, y); while (k !== key(sx, sy)) { path.push([k % W.W, Math.floor(k / W.W)]); k = came.get(k); } return path.reverse(); }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
        if (W.isBlockedTile(nx, ny, opts)) continue;
        if (dx && dy && (W.isBlockedTile(x + dx, y, opts) || W.isBlockedTile(x, y + dy, opts))) continue;
        if (W.edge && W.edgeBlk(x, y, dx, dy)) continue;
        const nk = key(nx, ny), ng = gc + (dx && dy ? 1.41 : 1) + (W.tile(nx, ny) === T.WATER ? 2 : 0);
        if (g.has(nk) && g.get(nk) <= ng) continue;
        g.set(nk, ng); came.set(nk, key(x, y)); open.push([nx, ny, ng, ng + Math.hypot(gx - nx, gy - ny)]);
      }
    }
    return null;
  };

  W.lineClear = function (x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 16);
    for (let i = 1; i < n; i++) { const t = W.tile(Math.floor((x0 + (x1 - x0) * i / n) / TS), Math.floor((y0 + (y1 - y0) * i / n) / TS)); if (t === T.WALL || t === T.CWALL || t === T.ROCK) return false; }
    return true;
  };

  W.buildingAt = function (px, py) { for (const b of W.buildings) if (px >= b.px + 4 && py >= b.py + 4 && px < b.px + b.pw - 4 && py < b.py + b.ph - 4) return b; return null; };
})();

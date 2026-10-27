// Kingdom Rising — world generation: terrain, regions, roads, cities, buildings, lights, spawns
(function () {
  const KR = (window.KR = window.KR || {});
  const D = KR.D;
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
  const TS = D.TS;

  W.idx = (x, y) => y * W.W + x;
  W.inb = (x, y) => x >= 0 && y >= 0 && x < W.W && y < W.H;
  W.tile = (x, y) => (W.inb(x, y) ? W.tiles[y * W.W + x] : T.ROCK);
  W.regionAt = (tx, ty) => (W.inb(tx, ty) ? W.region[ty * W.W + tx] : 0);
  W.regionAtPx = (px, py) => W.regionAt(Math.floor(px / TS), Math.floor(py / TS));

  W.isBlockedTile = function (tx, ty, opts) {
    if (!W.inb(tx, ty)) return true;
    const i = ty * W.W + tx, t = W.tiles[i];
    if (SOLID[t]) return true;
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
  W.solidAtPx = (px, py, opts) => W.isBlockedTile(Math.floor(px / TS), Math.floor(py / TS), opts);

  // ---------- generation ----------
  W.generate = function (seed, cityLevels) {
    const rnd = U.mulberry(seed);
    W.seed = seed;
    const N = W.W * W.H;
    W.tiles = new Uint8Array(N); W.region = new Uint8Array(N); W.vari = new Uint8Array(N); W.block = new Uint8Array(N);
    W.doorAt = {}; W.decor = []; W.buildings = []; W.lights = []; W.spawns = []; W.camps = []; W.chambers = {}; W.dungeons = {}; W.explored = new Uint8Array((W.W >> 2) * (W.H >> 2));
    W.cityData = {}; W.wallTop = null; W.stairs = new Map();
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
    const inOcean = (x, y) => x > OC.x0 + (U.fbm(x * 0.02, y * 0.02, 61, 3) - 0.5) * 50 && y > OC.y0 + (U.fbm(x * 0.02, y * 0.02, 67, 3) - 0.5) * 50;
    for (let y = 0; y < W.H; y++) for (let x = 0; x < W.W; x++) if (inOcean(x, y) || W.portSea(x, y)) W.region[y * W.W + x] = RI.ocean;
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
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            const tx = Math.round(px + dx), ty = Math.round(py + dy); if (!W.inb(tx, ty)) continue;
            if (dx * dx + dy * dy > 3.2) continue;
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
      const [px, py] = roadPts[k];
      const reg = D.REGIONS[W.regionAt(Math.round(px), Math.round(py))];
      if (reg.city) continue;
      const side = lampCount++ % 2 ? 1 : -1;
      const k2 = Math.min(roadPts.length - 1, k + 2);
      const dx = roadPts[k2][0] - px, dy = roadPts[k2][1] - py, l = Math.hypot(dx, dy) || 1;
      const lx = Math.round(px + (-dy / l) * 2.6 * side), ly = Math.round(py + (dx / l) * 2.6 * side);
      if (!W.inb(lx, ly) || SOLID[W.tile(lx, ly)] || W.tile(lx, ly) === T.WATER) continue;
      const broken = reg.dark > 0.6 && U.hash(lx, ly, 3) < 0.6;
      addDecor('lamp', lx, ly, { broken });
      if (!broken) W.lights.push({ x: lx * TS + 16, y: ly * TS - 20, r: 190, col: '255,196,110', fl: 0.08, k: 'lamp' });
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
    for (const dg of D.DUNGEONS) if ((dg.parent || 'main') === 'main' && dg.type === 'sewer') carveSewerMouth(dg);
    D.REGIONS[RI.ocean].label = [520, 590];
    // ---- cities ----
    for (const f of D.FACTION_IDS) W.stampCity(f, (cityLevels && cityLevels[f]) || 1, true);
    W.makeSpawns(rnd);
    W.mapCanvas = null; W.buildMinimap(); W.present = presentRegions();
  };

  // ---------- shared terrain helpers (used by every realm) ----------
  const OC = D.OCEAN, SU = D.SUMMIT;
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
        case 'island': { const d = islandD(x, y); t = d > 0.9 ? T.SAND : n2 > 0.58 ? T.FOREST : n > 0.78 ? T.ROCK : T.GRASS; break; }
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
  W.REALM_KEYS = ['wallTop', 'stairs', 'W', 'H', 'tiles', 'region', 'vari', 'block', 'doorAt', 'decor', 'buildings', 'lights', 'spawns', 'camps', 'chambers', 'dungeons', 'explored', 'cityData', 'cityBase', 'roads', 'mapCanvas', 'realm', 'portals', 'present', 'seed'];
  W.realms = {};
  W.snapshot = function () { const o = {}; for (const k of W.REALM_KEYS) o[k] = W[k]; return o; };
  W.restore = function (o) { for (const k of W.REALM_KEYS) W[k] = o[k]; };
  function presentRegions() { const set = new Set(); for (let i = 0; i < W.region.length; i += 7) set.add(W.region[i]); return set; }
  W.presentRegions = presentRegions;
  function blankRealm(id, size, ri, tile) {
    W.wallTop = null; W.stairs = null;
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
      const S = Math.max(dg.w, dg.h) + 18; blankRealm(id, S, RI[id], T.ROCK);
      const local = Object.assign({}, dg, { x: Math.floor((S - dg.w) / 2), y: Math.floor((S - dg.h) / 2) });
      carveDungeon(local, rnd);
      const dd = W.dungeons[id]; const ins = local.entry === 'n' ? [0, 1] : local.entry === 's' ? [0, -1] : local.entry === 'w' ? [1, 0] : [-1, 0];
      W.portals.push({ x: dd.entry.x, y: dd.entry.y, to: dg.parent || 'main', back: true, label: 'Exit to ' + (dg.parent === 'tidesong' ? 'the Isle of Tidesong' : D.REGIONS[RI[dg.near]] ? D.REGIONS[RI[dg.near]].name : 'the surface') });
      dd.arrive = [dd.entry.x + ins[0] * 3, dd.entry.y + ins[1] * 3];
      addDecor('exitportal', dd.entry.x, dd.entry.y, { nb: true });
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

  // a brick sewer outflow beside a city: a grated arch that spills into a pool and drains toward the nearest water
  function carveSewerMouth(dg) {
    const [ex, ey] = dg.at; const px = dg.pool || -1;
    const inA = (x, y) => W.inb(x, y);
    const setT = (x, y, t) => { if (!inA(x, y)) return; const k = y * W.W + x; W.tiles[k] = t; W.block[k] = 0; };
    // clear the site: brick wall behind, cobbled apron in front
    W.decor = W.decor.filter((d) => !(Math.abs(d.tx - ex) <= 9 && d.ty >= ey - 5 && d.ty <= ey + 6));
    for (let y = ey - 4; y <= ey + 5; y++) for (let x = ex - 8; x <= ex + 8; x++) if (inA(x, y)) setT(x, y, T.GRASS);
    for (let y = ey - 3; y <= ey - 1; y++) for (let x = ex - 3; x <= ex + 3; x++) setT(x, y, T.WALL);
    for (let y = ey; y <= ey + 4; y++) for (let x = ex - 3; x <= ex + 3; x++) setT(x, y, T.COBBLE);
    setT(ex, ey, T.STONE);
    // the outflow pool and a channel that runs on to the nearest open water
    const pcx = ex + px * 6, pcy = ey + 2;
    for (let y = pcy - 4; y <= pcy + 4; y++) for (let x = pcx - 4; x <= pcx + 4; x++) { const d = Math.hypot(x - pcx, (y - pcy) * 1.15) + (U.hash(x, y, 77) - 0.5) * 0.8; if (d < 2.2) setT(x, y, T.DEEP); else if (d < 3.6) setT(x, y, T.WATER); else if (d < 4.4 && W.tile(x, y) !== T.COBBLE) setT(x, y, T.SAND); }
    for (let x = ex + px; x !== pcx; x += px) setT(x, ey + 1, T.WATER);
    let x = pcx + px * 4, y = pcy;
    for (let k = 0; k < 40; k++) {
      const t0 = W.tile(x, y); if (k > 2 && (t0 === T.WATER || t0 === T.DEEP)) break;
      const rg = D.REGIONS[W.region[y * W.W + x]]; if (!inA(x, y) || (rg && (rg.city || rg.dungeon))) break;
      setT(x, y, T.WATER); if (W.tile(x, y + 1) !== T.WATER) setT(x, y + 1, k % 3 ? T.WATER : T.SAND);
      x += px; if (k % 5 === 4) y += (U.hash(x, y, 5) < 0.5 ? 1 : -1);
    }
    W.decor = W.decor.filter((d) => !(W.tile(d.tx, d.ty) === T.WATER || W.tile(d.tx, d.ty) === T.DEEP));
    addDecor('sewermouth', ex, ey, { nb: true, px: ex * TS + 16, py: ey * TS + 6 });
    addDecor('torch', ex - 2, ey, {}); addDecor('torch', ex + 2, ey, {});
    W.lights.push({ x: (ex - 2) * TS + 16, y: ey * TS, r: 150, col: '255,170,90', fl: 0.15, k: 'fire' }); W.lights.push({ x: (ex + 2) * TS + 16, y: ey * TS, r: 150, col: '255,170,90', fl: 0.15, k: 'fire' });
    addDecor('cavesign', ex - px * 3, ey + 2, { name: W.REALMS[dg.id].name, nb: true, px: (ex - px * 3) * TS + 16, py: (ey + 2) * TS + 20 });
    addDecor('barrel', ex - px * 3, ey + 4, {}); addDecor('crate', ex - px * 4, ey + 4, {});
    W.portals.push({ x: ex, y: ey, to: dg.id, label: W.REALMS[dg.id].name, out: [ex, ey + 3], sewer: true });
  }

  // ---------- dungeons ----------
  function carveDungeon(dg, rnd) {
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

  // ---- a sewer grate in a back street: climb down into the city's sewers from inside the walls ----
  function cityGrate(f, R, cx, cy) {
    const id = 'sewer_' + f; if (!W.REALMS || !W.REALMS[id]) return;
    W.portals = (W.portals || []).filter((p) => p.cityGrate !== f); W.decor = W.decor.filter((d) => !d.cityGrate);
    const free = (x, y) => { for (let j = -1; j <= 2; j++) for (let i = -1; i <= 1; i++) { const t = W.tile(x + i, y + j); if (t == null || SOLID[t] || t === T.DOOR || t === T.WATER || W.block[(y + j) * W.W + x + i] || W.buildingAt((x + i) * TS + 16, (y + j) * TS + 16)) return false; } return true; };
    for (let r = 6; r < R - 3; r++) for (let a = 0; a < 16; a++) {
      const x = Math.round(cx + Math.cos(a / 16 * 6.283 + 0.7) * r), y = Math.round(cy + 4 + Math.sin(a / 16 * 6.283 + 0.7) * r);
      if (!free(x, y)) continue;
      W.tiles[y * W.W + x] = T.STONE; addDecor('grate', x, y, { nb: true, cityGrate: true });
      W.portals.push({ x, y, to: id, label: W.REALMS[id].name, out: [x, y + 2], sewer: true, cityGrate: f });
      return;
    }
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
    // one flight of stairs per side, running along the inside of the wall, six steps of a tile each
    const LEN = 6;
    const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [nx, ny] of sides) {
      const ax = ny ? 1 : 0, ay = nx ? 1 : 0; // along the wall
      for (const start of [-R + 3, R - 3 - LEN, -10, 4]) {
        const tiles = []; let ok = true;
        for (let k = 0; k < LEN; k++) {
          const tx = cx + nx * (R - 1) + ax * (start + k), ty = cy + ny * (R - 1) + ay * (start + k);
          const wx = tx + nx, wy = ty + ny; const i = ty * W.W + tx;
          if (!W.inb(tx, ty) || W.buildingAt(tx * TS + 16, ty * TS + 16) || SOLID[W.tiles[i]] || W.tiles[i] === T.DOOR || (k === LEN - 1 && !W.wallTop[wy * W.W + wx])) { ok = false; break; }
          tiles.push([tx, ty, i]);
        }
        if (!ok) continue;
        tiles.forEach(([tx, ty, i], k) => { W.tiles[i] = T.STONE; W.block[i] = 0; W.decor = W.decor.filter((d) => !(d.tx === tx && d.ty === ty)); W.stairs.set(i, { f, k, n: LEN, dir: [ax, ay], wall: [nx, ny], top: k === LEN - 1 }); });
        break;
      }
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
    // three piers out into the deep water
    const piers = [[0, 18], [-14, 14], [14, 14]];
    for (const [off, len] of piers) for (let i = 0; i < len; i++) for (let w = -1; w <= 1; w++) { const x = gx + dx * (k + 1 + i) + px * (off + w), y = gy + dy * (k + 1 + i) + py * (off + w); if (W.inb(x, y)) { W.tiles[y * W.W + x] = T.WOOD; W.block[y * W.W + x] = 0; } }
    const at = (i, s) => [gx + dx * (k + 1 + i) + px * s, gy + dy * (k + 1 + i) + py * s];
    const ry = Math.atan2(dx, dy); // ships lie along the piers, bows out to sea
    const ship = (i, s, size, v) => { const [x, y] = at(i, s); if (isW(x, y)) deco('boat', x, y, { nb: true, size, ry, v }); };
    // each ship has its own water: the east basin's inner berth (s 3.5) is kept free for the ship that brings new heroes home
    ship(14, 9, 'galleon', 0.3); ship(9, -5, 'cog', 0.6); ship(10, -10.5, 'sloop', 0.1); ship(9, 18, 'sloop', 0.8); ship(14, 24, 'sloop', 0.45);
    ship(2, -18, 'rowboat', 0.2); ship(1.5, 6.5, 'rowboat', 0.7); ship(1, -9, 'rowboat', 0.9); ship(23, -6, 'cog', 0.5); ship(4, -19, 'sloop', 0.15);
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
      let total = 0; for (let y = b.y + 1; y < b.y + b.h - 1; y++) for (let x = b.x + 1; x < b.x + b.w - 1; x++) if (floorOk(x, y)) total++;
      if (seen.size >= total * 0.6) break;
      // remove a blocking prop that touches the reachable area
      let done = false;
      for (const k of seen) { const x = k % W.W, y = Math.floor(k / W.W); for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ox, ny = y + oy; if (inside(nx, ny) && W.block[ny * W.W + nx]) { unblock(nx, ny); done = true; break; } } if (done) break; }
      if (!done) break;
    }
  }
  const spot = (b, key, tx, ty) => { (b.spots[key] = b.spots[key] || []).push([tx * TS + 16, ty * TS + 20]); };
  function furnish(b) {
    const x0 = b.x + 1, y0 = b.y + 1, x1 = b.x + b.w - 2, y1 = b.y + b.h - 2, mx = b.x + Math.floor(b.w / 2);
    const lightIn = (tx, ty, r = 150, col = '255,180,100') => W.lights.push({ x: tx * TS + 16, y: ty * TS + 10, r, col, fl: 0.12, k: 'fire', b: b.id });
    const D_ = (k, tx, ty, o = {}) => addDecor(k, tx, ty, o);
    switch (b.type) {
      case 'hall':
        D_('throne', mx, y0, {}); D_('carpet', mx, y0 + 1, { len: b.h - 3 });
        for (let j = y0 + 1; j <= y1; j += 2) { D_('pillar', x0 + 1, j); D_('pillar', x1 - 1, j); }
        D_('brazier', mx - 2, y0); D_('brazier', mx + 2, y0); lightIn(mx - 2, y0, 200); lightIn(mx + 2, y0, 200);
        D_('banner', x0, y0, { nb: true }); D_('banner', x1, y0, { nb: true });
        spot(b, 'king', mx, y0 + 1); spot(b, 'guard', mx - 2, y0 + 2); spot(b, 'guard', mx + 2, y0 + 2); spot(b, 'guard', mx - 2, y1 - 1); spot(b, 'guard', mx + 2, y1 - 1);
        break;
      case 'inn': case 'outpost': {
        // bar counter along top
        for (let i = x0; i <= Math.min(x1, x0 + 4); i++) D_('counter', i, y0 + 1);
        D_('keg', x0, y0); D_('keg', x0 + 1, y0);
        D_('stove', x1, y0); lightIn(x1, y0, 170, '255,150,80');
        D_('hearth', x1, y0 + 2 < y1 ? y0 + 2 : y0); lightIn(x1, y0 + 2, 190, '255,160,80');
        const tables = b.type === 'outpost' ? [[x0 + 1, y1]] : [[x0 + 1, y1 - 1], [x0 + 4, y1 - 1], [x1 - 2, y1 - 2]];
        tables.forEach(([tx, ty]) => { D_('table', tx, ty); spot(b, 'seat', tx - 1, ty); spot(b, 'seat', tx + 1, ty); });
        spot(b, 'keeper', x0 + 2, y0); spot(b, 'cook', x1 - 1, y0); spot(b, 'stage', x1 - 1, y1);
        break; }
      case 'bank': for (let i = x0; i <= x1; i++) D_('counter', i, y0 + 1); D_('vault', x0, y0); D_('chest', x1, y0); spot(b, 'banker', mx, y0); lightIn(mx, y0 + 2, 140); break;
      case 'smithy': case 'forge': D_('forge', x0, y0); lightIn(x0, y0, 200, '255,120,50'); D_('anvil', Math.min(x0 + 2, x1), y0 + 2); D_('orepile', x1, y0); D_('weaponrack', x1, y1); spot(b, 'smith', Math.min(x0 + 2, x1), Math.min(y0 + 3, y1)); spot(b, 'vendor', x1 - 1, y0 + 1); break;
      case 'tailor': D_('loom', x0, y0); D_('clothrack', x1, y0); D_('table', x1, y1); spot(b, 'tailor', x0 + 1, y0 + 1); spot(b, 'vendor', x0 + 1, y0 + 1); lightIn(mx, y0 + 1, 130); break;
      case 'guild': D_('bookshelf', x0, y0); D_('bookshelf', x0 + 1, y0); D_('lectern', mx, y0 + 1); D_('dummy', x1, y1); D_('dummy', x1 - 2, y1); D_('bookshelf', x1, y0); spot(b, 'trainer', mx, y0 + 2); lightIn(mx, y0 + 1, 160, '200,190,255'); break;
      case 'jeweler': case 'gemcutter': D_('table', x0, y0); D_('chest', x1, y0); spot(b, 'vendor', mx, y0 + 1); lightIn(mx, y0, 140, '200,220,255'); break;
      case 'bowyer': D_('weaponrack', x0, y0); D_('table', x1, y0); spot(b, 'vendor', mx, y0 + 1); lightIn(mx, y0, 130); break;
      case 'store': case 'armorer': case 'weaponsmith': case 'fletcher': case 'armory': case 'exchange':
        D_('shelf', x0, y0); D_('shelf', x1, y0); D_('crate', x1, y1); D_('barrel', x0, y1);
        if (b.type === 'weaponsmith' || b.type === 'armory') D_('weaponrack', x0 + 1, y0); if (b.type === 'armorer') D_('armorstand', x0 + 1, y0);
        spot(b, 'vendor', mx, y0 + 1); lightIn(mx, y0 + 1, 130); break;
      case 'scribe': D_('bookshelf', x0, y0); D_('bookshelf', x1, y0); D_('lectern', mx, y0 + 1); spot(b, 'vendor', mx, y0 + 2); spot(b, 'scribe', mx, y0 + 2); lightIn(mx, y0 + 1, 150, '190,170,255'); break;
      case 'heroes': D_('statue', mx, y0, {}); D_('banner', x0, y0, { nb: true }); D_('banner', x1, y0, { nb: true }); D_('brazier', x0, y1); D_('brazier', x1, y1); lightIn(x0, y1, 160); lightIn(x1, y1, 160); spot(b, 'vendor', mx, y0 + 2); break;
      case 'barracks': {
        // rows of bunks along the back wall, an armory corner, a training dummy and the recruiter's desk by the door
        for (let i = x0; i <= x1; i += 2) D_('bed', i, y0);
        if (y1 - y0 >= 4) for (let i = x0 + 2; i <= x1 - 2; i += 2) D_('bed', i, y0 + 2);
        D_('weaponrack', x0, y1); D_('armorstand', x0 + 1, y1); D_('dummy', x1, y1); D_('chest', x1, y0 + 1 <= y1 ? y0 + 1 : y0);
        D_('table', mx + 2 <= x1 ? mx + 2 : x1, y1 - 1);
        D_('banner', x0, y0, { nb: true });
        spot(b, 'recruiter', mx + 2 <= x1 ? mx + 2 : x1, y1); spot(b, 'spawn', mx, y1 - 1);
        lightIn(mx, y0 + 1, 170); lightIn(x0 + 1, y1, 130); break; }
      case 'house': D_('bed', x0, y0); D_('table', x1, y1); D_('chest', x1, y0); spot(b, 'home', x0 + 1, y0 + 1); lightIn(mx, y0, 110, '255,190,120'); break;
      case 'kingtower': D_('banner', mx, y0, { nb: true }); D_('weaponrack', x1, y0); D_('table', mx, y0 + 2); D_('chair', mx - 1, y0 + 2, { nb: true }); D_('chair', mx + 1, y0 + 2, { nb: true }); D_('candle', x1, y1 - 1, { nb: true }); spot(b, 'guard', x1 - 1, y1 - 1); lightIn(mx, y0 + 1, 150); break;
      case 'chamber': D_('brazier', x0, y0); D_('brazier', x1, y0); D_('bones', x0 + 2, y1, { nb: true }); D_('bones', x1 - 1, y1 - 1, { nb: true }); lightIn(x0, y0, 170, '255,110,60'); lightIn(x1, y0, 170, '255,110,60'); spot(b, 'boss', mx, y0 + 2); break;
    }
    if (['inn', 'guild', 'bank', 'heroes', 'exchange'].includes(b.type) && y1 - y0 >= 4 && x1 - x0 >= 3) makeLoft(b, x0, y0, x1, y1);
    if (b.type === 'kingtower') makeLoft(b, x0, y0, x1, y1, y1 - 2);
    dress(b, x0, y0, x1, y1);
  }
  // the things people of the 1300s had at home, added around what each building already has:
  // rugs, stools and benches by the tables, a wood stove, cupboards, candles, tapestries on the walls
  function dress(b, x0, y0, x1, y1) {
    const door = b.door; const taken = (x, y) => x < x0 || x > x1 || y < y0 || y > y1 || W.block[y * W.W + x] || W.decor.some((d) => d.tx === x && d.ty === y && !d.flat && !d.up) || (W.stairs && W.stairs.get(y * W.W + x)) || (Math.abs(x - door.tx) <= 1 && y >= y1 - 1) || Object.values(b.spots || {}).some((l) => l.some(([px, py]) => Math.floor(px / TS) === x && Math.floor(py / TS) === y));
    const put = (k, x, y, o = {}) => { if (taken(x, y)) return false; addDecor(k, x, y, o); return true; };
    const mx = Math.floor((x0 + x1) / 2), my = Math.floor((y0 + y1) / 2);
    const rugAt = (x, y) => { if (!W.decor.some((d) => d.tx === x && d.ty === y && d.kind === 'rug')) addDecor('rug', x, y, { nb: true, flat: true }); };
    // seats where people sit at the tables
    for (const s of (b.spots && b.spots.seat) || []) { const x = Math.floor(s[0] / TS), y = Math.floor(s[1] / TS); if (!W.decor.some((d) => d.tx === x && d.ty === y)) addDecor('stool', x, y, { nb: true }); }
    for (const d of W.decor.filter((d) => d.kind === 'table' && d.tx >= x0 && d.tx <= x1 && d.ty >= y0 && d.ty <= y1 && !d.up)) { put('stool', d.tx - 1, d.ty, { nb: true }) || put('bench', d.tx, d.ty + 1, { nb: true }); put('stool', d.tx + 1, d.ty, { nb: true }); }
    const corners = [[x0, y1 - 1], [x1, y1 - 1], [x0, y0], [x1, y0]];
    switch (b.type) {
      case 'house': rugAt(mx, my); put('stove', x0, y1 - 1) || put('stove', x1, y1 - 1); put('wardrobe', mx, y0) || put('dresser', mx + 1, y0); put('washtub', x1, my, { nb: true }); put('candle', x0 + 1, y0, { nb: true }); put('tapestry', mx - 1, y0, { nb: true }); break;
      case 'inn': case 'outpost': rugAt(mx, y1 - 1); put('cauldron', x1 - 1, y0 + 2); for (const [x, y] of corners) put('candle', x, y, { nb: true }); put('tapestry', mx, y0, { nb: true }); break;
      case 'barracks': put('candle', x0, my, { nb: true }); put('stool', mx - 1, y1 - 1, { nb: true }); put('stove', x1, my); break;
      case 'hall': for (let x = x0 + 2; x <= x1 - 2; x += 3) { put('tapestry', x, y0, { nb: true }); } put('candle', x0, y1 - 1, { nb: true }); put('candle', x1, y1 - 1, { nb: true }); break;
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
    const ym = ymOver != null ? ymOver : y0 + Math.floor((y1 - y0 + 1) / 2) - 1, n = y1 - ym;
    if (n < 2) return;
    const busy = (x, y) => W.decor.some((d) => d.tx === x && d.ty === y) || Object.values(b.spots || {}).some((l) => l.some(([px, py]) => Math.floor(px / TS) === x && Math.floor(py / TS) === y));
    const cost = (col) => { let c = 0; for (let y = ym; y <= y1; y++) if (busy(col, y)) c++; return c; };
    const col = cost(x0) <= cost(x1) ? x0 : x1;
    for (let y = ym; y <= y1; y++) { W.decor = W.decor.filter((d) => !(d.tx === col && d.ty === y)); W.block[y * W.W + col] = 0; for (const k in b.spots || {}) b.spots[k] = b.spots[k].filter(([px, py]) => !(Math.floor(px / TS) === col && Math.floor(py / TS) === y)); }
    W.block[ym * W.W + col] = 1; // the landing is under the stairs' top: on the ground floor you cannot stand there
    b.loft = { x0, y0, x1, y1: ym, col, city: b.city || b.faction || null };
    for (let k = 0; k < n; k++) { const y = y1 - k; W.stairs.set(y * W.W + col, { loft: b, k, n, dir: [0, -1], top: k === n - 1 }); }
    // upstairs: beds for the inn's guests, books for the guild, strongboxes for the bank
    const other = col === x0 ? x1 : x0, step = col === x0 ? -1 : 1;
    const up = (k, tx, ty, o = {}) => addDecor(k, tx, ty, Object.assign({ nb: true, up: true }, o));
    if (b.type === 'kingtower') {
      // the king's bedchamber: a canopied bed, a writing desk, a wardrobe, a rug... and in the corner, an iron-bound chest with a skull and crossed bones on its front
      up('kingbed', other + step, y0); up('poisonchest', other, ym); up('desk', other + step * 3, y0); up('chair', other + step * 3, y0 + 1); up('wardrobe', col - step, y0); up('rug', other + step * 2, ym - 1, { flat: true }); up('candle', col - step, ym); up('tapestry', other + step * 2, y0);
    }
    else if (b.type === 'inn') { up('bed', other, y0); up('bed', other + step * 2, y0); up('chest', other, ym); up('table', other + step * 4, y0); up('rug', other + step * 2, ym, { flat: true }); }
    else if (b.type === 'guild' || b.type === 'heroes') { up('bookshelf', other, y0); up('bookshelf', other + step, y0); up('table', other + step * 2, ym); up('lectern', other, ym); }
    else { up('chest', other, y0); up('chest', other + step, y0); up('vault', other + step * 2, y0); }
  }

  // ---------- city layout ----------
  // [type, x, y, w, h, minLevel, name]
  // The city is laid out around two paved avenues that run gate to gate through the plaza (north-south and
  // east-west), with a lane behind each row of houses. Every building faces a street (doors are on the south
  // side), alleys between them are at least two tiles wide, and the throne hall and the king's tower stand on
  // either side of the green at the head of the north avenue, so the way to the sea gate stays open.
  const CITY_LAYOUT = [ // [type, x, y, w, h, minLevel]
  ['hall', -18, -19, 12, 8, 1], ['kingtower', 9, -19, 7, 7, 1], ['inn', -18, -8, 10, 7, 1], ['bank', 8, -7, 8, 6, 1],
  ['smithy', -18, 7, 7, 6, 1], ['tailor', -8, 7, 5, 5, 1], ['store', 4, 7, 5, 5, 1], ['guild', 11, 7, 7, 6, 1],
  ['house', -18, 15, 5, 3, 1], ['house', -10, 15, 5, 3, 1], ['house', 5, 15, 5, 3, 1], ['house', 12, 15, 5, 3, 1],
  ['armorer', -24, -12, 4, 7, 2], ['weaponsmith', 21, -12, 4, 7, 2], ['house', -24, 7, 4, 5, 2], ['house', 21, 7, 4, 5, 2], ['house', -15, -24, 6, 4, 2], ['jeweler', 9, -24, 6, 4, 2], ['house', -9, 20, 5, 4, 2], ['house', 4, 20, 5, 4, 2],
  ['scribe', -30, -8, 4, 7, 3], ['fletcher', 27, -8, 4, 7, 3], ['house', -30, 7, 4, 5, 3], ['house', 27, 7, 4, 5, 3], ['house', -23, -30, 6, 4, 3], ['house', 17, -30, 6, 4, 3], ['house', -17, 26, 6, 4, 3], ['house', 11, 26, 6, 4, 3],
  ['forge', -36, -9, 4, 8, 4], ['armory', 33, -9, 4, 8, 4], ['house', -36, 8, 4, 5, 4], ['house', 33, 8, 4, 5, 4], ['gemcutter', -10, -36, 6, 4, 4], ['bowyer', 4, -36, 6, 4, 4], ['house', -27, 32, 6, 4, 4], ['house', 21, 32, 6, 4, 4],
  ['exchange', 39, -9, 4, 8, 5], ['heroes', -42, -9, 4, 8, 5], ['house', -42, 8, 4, 5, 5], ['house', 39, 8, 4, 5, 5], ['house', -31, -42, 6, 4, 5], ['house', 25, -42, 6, 4, 5], ['house', -9, 38, 5, 4, 5], ['house', 4, 38, 5, 4, 5],
  ];
  const BNAMES = {
    sylvan: { kingtower: "Theron's Tower", hall: 'Starbough Hall', inn: 'The Moonlit Bough', bank: 'Silverleaf Vault', guild: 'Hall of the Old Ways', smithy: 'Leafsteel Forge', tailor: 'Threadwhisper Looms', store: 'Glade Provisions', armorer: 'Bark & Mail', weaponsmith: 'Thornedge Arms', scribe: 'Library of Leaves', fletcher: 'Feather & Yew', jeweler: 'Dewdrop Gems', gemcutter: 'Starlight Lapidary', bowyer: 'Yewheart Bowyers', forge: 'Elderforge', armory: 'Royal Armory', exchange: 'Grand Exchange', heroes: 'Hall of Heroes', house: 'Cottage' },
    iron: { kingtower: "The King's Tower", hall: 'Anvilheart Throne Hall', inn: 'The Foaming Tankard', bank: 'Deepvault Bank', guild: 'Guild of the Hammer', smithy: 'Runeforge', tailor: 'Hide & Bolt', store: 'Delver Supplies', armorer: 'Stonemail Outfitters', weaponsmith: 'Axe & Anvil', scribe: 'Gearwright Scriptorium', fletcher: 'Bolt & Barrel', jeweler: 'Gemvein Jewelers', gemcutter: 'Deepstone Lapidary', bowyer: 'Crossbow Works', forge: 'Magma Forge', armory: 'Royal Armory', exchange: 'Grand Exchange', heroes: 'Hall of Heroes', house: 'Stonehome' },
    crown: { kingtower: "Aldric's Tower", hall: 'Valen Keep', inn: 'The Gilded Goose', bank: 'Crown Treasury', guild: 'Valen Academy', smithy: "Hammersmith's", tailor: 'Needle & Thimble', store: 'Market Hall', armorer: 'Shield & Mail', weaponsmith: 'Swordsmith Row', scribe: 'Royal Scriptorium', fletcher: "Bowyer's Lodge", jeweler: 'Crown Jewelers', gemcutter: 'Royal Lapidary', bowyer: 'Longbow Hall', forge: 'Kingsforge', armory: 'Royal Armory', exchange: 'Grand Exchange', heroes: 'Hall of Heroes', house: 'House' },
  };

  const BARRACKS_SIZES = [[9, 6], [11, 6], [13, 7], [15, 7], [17, 8]];
  function placeBarracks(f, level, cx, cy, R, names) {
    const sizes = BARRACKS_SIZES.slice(0, Math.max(1, Math.min(5, level))).reverse().concat([[11, 4], [9, 5], [9, 4], [8, 5], [7, 5], [7, 4]]);
    let M = 2;
    const free = (x0, y0, w, h) => {
      for (let y = y0 - M; y < y0 + h + M + 1; y++) for (let x = x0 - M; x < x0 + w + M; x++) {
        const dx = x - cx, dy = y - cy;
        if (Math.abs(dx) > R - 1 - (M > 1 ? 1 : 0) || Math.abs(dy) > R - 1 - (M > 1 ? 1 : 0)) return false;
        if (dx >= -6 && dx <= 6 && dy >= -6 && dy <= 2) return false; // plaza
        if (Math.abs(dx) <= 3) return false; // the north-south avenue
        if (dx >= -6 && dx <= 7 && dy >= -19 && dy <= -11) return false; // the green
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
  W.stampCity = function (f, level, initial) {
    const [cx, cy] = D.CITY_CENTER[f]; const base = W.cityBase[f]; const R = D.cityRadius(level);
    // restore base terrain & remove old city content
    const x0 = base.x0, y0 = base.y0, bw = base.w;
    for (let y = 0; y < bw; y++) for (let x = 0; x < bw; x++) { const tx = x0 + x, ty = y0 + y; if (!W.inb(tx, ty)) continue; const k = ty * W.W + tx; W.tiles[k] = base.tiles[y * bw + x]; W.block[k] = 0; }
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
      const dens = f === 'sylvan' ? 0.09 : f === 'iron' ? 0.03 : 0.012;
      if (h < dens) addDecor(f === 'sylvan' ? (h2 < 0.6 ? 'elmwood' : 'oak') : f === 'iron' ? (h2 < 0.6 ? 'pine' : 'boulder') : 'oak', tx, ty, {});
      else if (h < dens + 0.05 && h2 < 0.5) addDecor(f === 'iron' ? 'pebbles' : 'flowers', tx, ty, { nb: true });
    }
    // ground + walls
    for (let ty = cy - R; ty <= cy + R; ty++) for (let tx = cx - R; tx <= cx + R; tx++) {
      const k = ty * W.W + tx, dx = tx - cx, dy = ty - cy;
      const wall = Math.abs(dx) === R || Math.abs(dy) === R;
      const gate = (dy === R && Math.abs(dx) <= 1) || (Math.abs(dx) === R && dy >= 2 && dy <= 4) || (f === 'sylvan' && dy === -R && Math.abs(dx) <= 2); // Aelindor's sea gate opens north onto the harbour
      if (wall && !gate) W.tiles[k] = T.CWALL;
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
    {
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
    // plaza
    for (let ty = cy - 5; ty <= cy + 1; ty++) for (let tx = cx - 5; tx <= cx + 5; tx++) W.tiles[ty * W.W + tx] = T.STONE;
    // the two avenues (paved, gate to gate) and the lanes behind the rows of buildings
    for (let d = -R + 1; d <= R - 1; d++) { for (let w = -2; w <= 2; w++) { W.tiles[(cy + d) * W.W + cx + w] = T.STONE; } for (let w = 1; w <= 5; w++) W.tiles[(cy + w) * W.W + cx + d] = T.STONE; }
    for (const ly of [-10, -9, 13, 14, 18, 19]) if (Math.abs(ly) < R - 1) for (let d = -R + 1; d <= R - 1; d++) { const k = (cy + ly) * W.W + cx + d; if (W.tiles[k] !== T.STONE) W.tiles[k] = T.COBBLE; }
    // the green between the throne hall and the king's tower, with trees and benches
    for (let ty = cy - 18; ty <= cy - 12; ty++) for (let tx = cx - 5; tx <= cx + 6; tx++) if (Math.abs(tx - cx) > 2) W.tiles[ty * W.W + tx] = T.GRASS;
    for (const [ox, oy] of [[-4, -17], [5, -17], [-4, -13], [5, -13]]) addDecor('oak', cx + ox, cy + oy, { garden: true });
    for (const [ox, oy] of [[-4, -15], [5, -15]]) addDecor('bench', cx + ox, cy + oy, { nb: true, ry: ox < 0 ? -Math.PI / 2 : Math.PI / 2 });
    for (let d = -R + 3; d <= R - 3; d += 6) for (const [x, y] of [[cx - 3, cy + d], [cx + 3, cy + d], [cx + d, cy], [cx + d, cy + 6]]) { if (Math.abs(x - cx) <= 6 && y - cy >= -6 && y - cy <= 1) continue; const k = y * W.W + x; if (W.tiles[k] !== T.STONE && W.tiles[k] !== T.COBBLE) continue; addDecor('lamp', x, y, {}); W.lights.push({ x: x * TS + 16, y: y * TS - 20, r: 170, col: '255,196,110', fl: 0.08, k: 'lamp' }); }
    addDecor(level >= 5 ? 'monument' : 'fountain', cx, cy - 2, {});
    for (const [ox, oy] of [[-5, -5], [5, -5], [-5, 1], [5, 1]]) addDecor('flagpole', cx + ox, cy + oy, { nb: true, f });
    W.lights.push({ x: cx * TS + 16, y: (cy - 2) * TS, r: level >= 5 ? 260 : 170, col: level >= 5 ? '255,220,140' : '170,210,255', fl: 0.05, k: 'magic' });
    if (level >= 2) { addDecor('stall', cx - 5, cy - 5, { col: '#b84a3a' }); addDecor('stall', cx + 5, cy - 5, { col: '#3a6ab8' }); addDecor('stall', cx - 5, cy - 1, { col: '#c9a23a' }); addDecor('stall', cx + 5, cy - 1, { col: '#3a8a5a' }); }
    if (level >= 3) { addDecor('statue', cx - 6, cy - 6, {}); addDecor('statue', cx + 6, cy - 6, {}); }
    // towers + torches on walls
    // (the old stone guard towers on the wall corners are gone: the gates are guarded by archer towers and siege engines)
    for (let i = -R + 4; i <= R - 4; i += 6) {
      for (const [tx, ty] of [[cx + i, cy - R + 1], [cx + i, cy + R - 1], [cx - R + 1, cy + i], [cx + R - 1, cy + i]]) {
        if (W.tiles[ty * W.W + tx] === T.CWALL) continue;
        addDecor('torch', tx, ty, {});
        W.lights.push({ x: tx * TS + 16, y: ty * TS, r: 150, col: '255,170,90', fl: 0.15, k: 'fire' });
      }
    }
    // gate torches
    for (const [tx, ty] of [[cx - 2, cy + R], [cx + 2, cy + R], [cx + R, cy + 1], [cx + R, cy + 5], [cx - R, cy + 1], [cx - R, cy + 5]]) W.lights.push({ x: tx * TS + 16, y: ty * TS - 10, r: 200, col: '255,175,95', fl: 0.12, k: 'fire' });
    // buildings
    const names = BNAMES[f];
    for (const [type, bx, by, bw2, bh, minL] of CITY_LAYOUT) {
      if (minL > level) continue;
      const b = stampBuilding({ x: cx + bx, y: cy + by, w: bw2, h: bh, type, name: type === 'house' ? names.house : names[type], faction: f, city: f, style: f, minLevel: minL });
      b.city = f;
    }
    // the barracks grows with the city: it houses every soldier of the kingdom's war parties
    placeBarracks(f, level, cx, cy, R, names);
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
      const fx0 = side < 0 ? cx - R - 13 : cx + R + 4, fy0 = cy + 7;
      for (let ty = fy0; ty < fy0 + 8; ty++) for (let tx = fx0; tx < fx0 + 9; tx++) {
        if (!W.inb(tx, ty)) continue; const k = ty * W.W + tx; if (SOLID[W.tiles[k]] && W.tiles[k] !== T.ROCK) continue;
        W.tiles[k] = T.FARM; W.block[k] = 0;
        W.decor = W.decor.filter((d) => !(d.tx === tx && d.ty === ty));
        if ((ty - fy0) % 2 === 0) addDecor('crop', tx, ty, { nb: true, crop: f });
      }
      addDecor('scarecrowpost', fx0 + 4, fy0 + 3, { nb: true });
      W.cityData[f] = W.cityData[f] || {}; (W.cityData[f].fields = W.cityData[f].fields || [])[side < 0 ? 0 : 1] = [fx0, fy0, 9, 8];
    }
    W.cityData[f].R = R; W.cityData[f].level = level; W.cityData[f].cx = cx; W.cityData[f].cy = cy;
    W.cityData[f].gates = [[cx, cy + R], [cx + R, cy + 3], [cx - R, cy + 3]].concat(f === 'sylvan' ? [[cx, cy - R]] : []);
    wallWalks(f, R, cx, cy);
    cityGrate(f, R, cx, cy);
    // invalidate chunk caches
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

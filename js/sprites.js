// Kingdom Rising — procedural art: tiles, decor, buildings, characters and creatures
(function () {
  const KR = (window.KR = window.KR || {});
  const D = KR.D, U = KR.U, T = KR.T, W = KR.W;
  const S = (KR.S = {});
  const TS = D.TS;

  const shade = (hex, amt) => {
    let c = hex.replace('#', ''); if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const n = parseInt(c, 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; } else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  };
  S.shade = shade;
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  S.rr = rr;
  const circ = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); };
  const ell = (g, x, y, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.2832); g.fill(); };

  // ---------- tiles ----------
  const TCOL = { 0: '#5f9046', 1: '#46703a', 2: '#3f6b34', 3: '#a98b5e', 4: '#8d877c', 5: '#4c8ab4', 6: '#2e5f8c', 7: '#d4c08a', 8: '#6f6a63', 9: '#e9eff3', 10: '#5e5a3e', 11: '#5d5752', 12: '#8a6440', 13: '#3d342c', 14: '#7a5a3a', 15: '#7b6438', 16: '#8d6b40', 17: '#a19a8e', 18: '#827a6e', 19: '#e2622a', 20: '#6d665e', 21: '#3d3649', 22: '#a6ab5a', 23: '#3f3733', 24: '#8a2c2c' , 25: '#4a3e34', 26: '#b4d0de', 27: '#3c2e2a' };
  const PRI = { 25: 4, 26: 4, 27: 4, 6: 0, 5: 1, 7: 2, 10: 3, 0: 4, 1: 4, 2: 4, 22: 4, 21: 4, 11: 4, 9: 4, 23: 4, 18: 5, 15: 6, 3: 7, 16: 9, 4: 8, 17: 8, 12: 8, 8: 10, 19: 3, 20: 11, 13: 11, 14: 11, 24: 9 };
  S.TCOL = TCOL;
  S.drawChunk = function (g, cx, cy, n) {
    const x0 = cx * n, y0 = cy * n;
    g.fillStyle = '#000'; g.fillRect(0, 0, n * TS, n * TS);
    // pass 1: base fill
    for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
      const tx = x0 + i, ty = y0 + j, t = W.tile(tx, ty), v = W.inb(tx, ty) ? W.vari[ty * W.W + tx] / 255 : 0.5;
      g.fillStyle = shade(TCOL[t] || '#000', (v - 0.5) * 0.035);
      g.fillRect(i * TS, j * TS, TS, TS);
    }
    // pass 2: ragged edges where a higher-priority ground meets a lower one
    const skip = (t) => t === 12 || t === 13 || t === 14 || t === 17 || t === 20 || t === 24 || t === 8;
    for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
      const tx = x0 + i, ty = y0 + j, t = W.tile(tx, ty); if (skip(t)) continue;
      const pt = PRI[t] == null ? 4 : PRI[t];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nt = W.tile(tx + dx, ty + dy); if (nt === t || skip(nt)) continue;
        const pn = PRI[nt] == null ? 4 : PRI[nt]; if (pn <= pt && !(pn === pt && nt > t)) continue;
        g.fillStyle = shade(TCOL[nt], (U.hash(tx + dx, ty + dy, 1) - 0.5) * 0.08);
        for (let k = 0; k < 4; k++) {
          const h1 = U.hash(tx * 7 + k, ty * 5 + dx * 3 + dy, 21), h2 = U.hash(tx * 3 + k, ty * 11 + dy * 7 + dx, 22);
          const along = 4 + (k + h1 * 0.8) * 7, depth = 1 + h2 * 6, r = 3.5 + h1 * 4;
          const cx = dx ? (dx > 0 ? TS - depth : depth) : along, cy = dy ? (dy > 0 ? TS - depth : depth) : along;
          g.beginPath(); g.arc(i * TS + cx + dx * 2, j * TS + cy + dy * 2, r, 0, 6.2832); g.fill();
        }
      }
    }
    // pass 3: details
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const tx = x0 + i, ty = y0 + j, t = W.tile(tx, ty), px = i * TS, py = j * TS;
      const h = (k) => U.hash(tx, ty, k);
      switch (t) {
        case T.GRASS: case T.DGRASS: case T.FOREST: case T.PLAINS: {
          const base = TCOL[t];
          for (let k = 0; k < 5; k++) { const bx = px + h(k) * 30, by = py + h(k + 9) * 30; g.strokeStyle = shade(base, k % 2 ? 0.16 : -0.18); g.lineWidth = 1.2; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + (h(k + 3) - 0.5) * 3, by - 3 - h(k + 5) * 3); g.stroke(); }
          if (t === T.PLAINS && h(30) < 0.25) { g.fillStyle = '#e6d36a'; g.fillRect(px + h(31) * 28, py + h(32) * 28, 2, 2); }
          if (t === T.FOREST && h(33) < 0.4) { g.fillStyle = shade('#8a6a30', h(34) * 0.3); g.beginPath(); g.ellipse(px + h(35) * 28, py + h(36) * 28, 2.5, 1.5, h(37) * 3, 0, 6.28); g.fill(); }
          break; }
        case T.ROAD: for (let k = 0; k < 4; k++) { g.fillStyle = shade('#a98b5e', k % 2 ? -0.18 : 0.14); g.fillRect(px + h(k) * 29, py + h(k + 7) * 29, 2 + h(k + 2) * 2, 2); } break;
        case T.COBBLE: case T.STONE: {
          const c = TCOL[t]; g.strokeStyle = shade(c, -0.25); g.lineWidth = 1;
          const off = (ty % 2) * 8;
          for (let r = 0; r < 2; r++) for (let q = -1; q < 2; q++) { const sx = px + q * 16 + off + (r % 2) * 8, sy = py + r * 16; g.fillStyle = shade(c, (U.hash(tx * 3 + q, ty * 3 + r, 4) - 0.5) * 0.18); rr(g, sx + 1, sy + 1, 14, 14, 3); g.fill(); g.stroke(); }
          break; }
        case T.WOOD: case T.BRIDGE: {
          const c = TCOL[t];
          for (let r = 0; r < 4; r++) { g.fillStyle = shade(c, (U.hash(tx, ty * 4 + r, 6) - 0.5) * 0.2); g.fillRect(px, py + r * 8, TS, 7); g.fillStyle = shade(c, -0.35); g.fillRect(px, py + r * 8 + 7, TS, 1); if (h(r) < 0.4) g.fillRect(px + h(r + 1) * 28, py + r * 8, 1, 7); }
          if (t === T.BRIDGE) { g.fillStyle = '#5a4128'; g.fillRect(px, py, TS, 3); g.fillRect(px, py + TS - 3, TS, 3); }
          break; }
        case T.WATER: case T.DEEP: { g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 1; for (let k = 0; k < 2; k++) { const wx = px + h(k) * 24, wy = py + 6 + h(k + 4) * 20; g.beginPath(); g.moveTo(wx, wy); g.quadraticCurveTo(wx + 4, wy - 2, wx + 8, wy); g.stroke(); } break; }
        case T.SAND: for (let k = 0; k < 4; k++) { g.fillStyle = shade('#d4c08a', k % 2 ? -0.12 : 0.1); g.fillRect(px + h(k) * 30, py + h(k + 8) * 30, 1.5, 1.5); } break;
        case T.ROCK: {
          const below = W.tile(tx, ty + 1) !== T.ROCK;
          g.fillStyle = shade('#6f6a63', (h(1) - 0.5) * 0.2); g.fillRect(px, py, TS, TS);
          g.fillStyle = shade('#6f6a63', 0.18); g.beginPath(); g.moveTo(px + 3, py + 8); g.lineTo(px + 14 + h(2) * 8, py + 2); g.lineTo(px + 29, py + 10); g.lineTo(px + 22, py + 16); g.closePath(); g.fill();
          g.strokeStyle = shade('#6f6a63', -0.3); g.beginPath(); g.moveTo(px + 6, py + 20); g.lineTo(px + 16, py + 14 + h(3) * 6); g.lineTo(px + 26, py + 22); g.stroke();
          if (below) { g.fillStyle = shade('#6f6a63', -0.35); g.fillRect(px, py + 22, TS, 10); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, py + TS, TS, 5); }
          const reg = D.REGIONS[W.regionAt(tx, ty)];
          if (reg && reg.biome === 'snow') { g.fillStyle = '#eef3f6'; g.beginPath(); g.ellipse(px + 16, py + 6, 14, 5, 0, 0, 6.28); g.fill(); }
          break; }
        case T.SNOW: for (let k = 0; k < 3; k++) { g.fillStyle = k % 2 ? '#ffffff' : '#d3dde4'; g.fillRect(px + h(k) * 30, py + h(k + 4) * 30, 2, 1.5); } break;
        case T.MUD: for (let k = 0; k < 3; k++) ell(g, px + h(k) * 28 + 2, py + h(k + 3) * 28 + 2, 3, 1.5, 'rgba(30,40,20,0.35)'); break;
        case T.ASH: case T.GLOOM: case T.VOLC: case T.GRAVEL: for (let k = 0; k < 5; k++) { g.fillStyle = shade(TCOL[t], k % 2 ? -0.25 : 0.15); g.fillRect(px + h(k) * 30, py + h(k + 6) * 30, 2, 2); } if (t === T.VOLC && h(20) < 0.2) { g.strokeStyle = 'rgba(255,90,30,0.5)'; g.beginPath(); g.moveTo(px + 4, py + 10 + h(21) * 10); g.lineTo(px + 16, py + 16); g.lineTo(px + 28, py + 12 + h(22) * 10); g.stroke(); } break;
        case T.FARM: g.fillStyle = shade('#7b6438', -0.2); for (let r = 0; r < 4; r++) g.fillRect(px, py + r * 8 + 5, TS, 2); break;
        case T.LAVA: g.fillStyle = '#ffb347'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(px + h(k) * 30, py + h(k + 3) * 30, 2 + h(k + 6) * 3, 0, 6.28); g.fill(); } break;
        case T.WALL: {
          const st = buildingStyleAt(tx, ty);
          g.fillStyle = st.wallTop; g.fillRect(px, py, TS, TS);
          g.strokeStyle = shade(st.wallTop, -0.3); g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
          break; }
        case T.CWALL: {
          const below = W.tile(tx, ty + 1) !== T.CWALL;
          g.fillStyle = '#7a736a'; g.fillRect(px, py, TS, TS);
          g.strokeStyle = '#4e4840'; g.lineWidth = 1;
          for (let r = 0; r < 2; r++) for (let q = 0; q < 2; q++) { g.fillStyle = shade('#7a736a', (U.hash(tx * 2 + q, ty * 2 + r, 8) - 0.5) * 0.25); g.fillRect(px + q * 16 + (r % 2) * 4, py + r * 16, 15, 15); g.strokeRect(px + q * 16 + (r % 2) * 4 + 0.5, py + r * 16 + 0.5, 15, 15); }
          if (below) { g.fillStyle = '#4f4a43'; g.fillRect(px, py + 20, TS, 12); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px, py + TS, TS, 6); }
          break; }
        case T.DOOR: g.fillStyle = '#5a4128'; g.fillRect(px, py, TS, TS); break;
      }
    }
  };
  function buildingStyleAt(tx, ty) { for (const b of W.buildings) if (tx >= b.x && ty >= b.y && tx < b.x + b.w && ty < b.y + b.h) return STYLE[b.style] || STYLE.crown; return STYLE.crown; }

  // ---------- building styles ----------
  const STYLE = {
    sylvan: { wall: '#d9cfae', beam: '#7a5a34', wallTop: '#6f5a3c', roof: '#4f8a4a', roof2: '#3d6e3a', trim: '#e7d48a', win: '#ffe6a0', arch: true },
    iron: { wall: '#8a857c', beam: '#5a544c', wallTop: '#4d4842', roof: '#5c6670', roof2: '#47505a', trim: '#c98b3a', win: '#ffb860', stone: true },
    crown: { wall: '#ece3cf', beam: '#6b4a2e', wallTop: '#6a4e34', roof: '#b0483a', roof2: '#8a3a2e', trim: '#f0c75e', win: '#ffe08a' },
    chamber: { wall: '#4a4440', beam: '#2e2a26', wallTop: '#2e2a28', roof: '#3a3532', roof2: '#2a2624', trim: '#8a2a2a', win: '#ff7a3a', stone: true },
  };
  S.STYLE = STYLE;
  const SIGN = { inn: '🍺', outpost: '🍺', bank: '💰', smithy: '⚒', forge: '⚒', tailor: '🧵', guild: '📜', store: '🛍', armorer: '🛡', weaponsmith: '⚔', scribe: '📖', fletcher: '🏹', armory: '🛡', exchange: '💎', heroes: '🏆', hall: '👑', chamber: '💀' };

  S.drawBuilding = function (g, b, t, night, alpha) {
    const st = STYLE[b.style] || STYLE.crown;
    const x = b.px, y = b.py, w = b.pw, h = b.ph, H = b.type === 'house' ? 40 : b.type === 'hall' ? 64 : 50;
    g.save(); g.globalAlpha = alpha;
    // facade (south face) occupies bottom H px of the footprint
    const fy = y + h - H;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 4, y + h, w, 8);
    g.fillStyle = st.wall; g.fillRect(x, fy, w, H);
    if (st.stone) {
      g.strokeStyle = shade(st.wall, -0.25); g.lineWidth = 1;
      for (let r = 0; r < H / 10; r++) for (let q = 0; q < w / 20 + 1; q++) g.strokeRect(x + q * 20 - (r % 2) * 10 + 0.5, fy + r * 10 + 0.5, 20, 10);
    } else {
      g.fillStyle = st.beam; g.fillRect(x, fy, w, 4); g.fillRect(x, fy + H - 4, w, 4);
      for (let q = 0; q <= w; q += 32) g.fillRect(x + q - 2, fy, 4, H);
      if (!st.arch) { g.strokeStyle = st.beam; g.lineWidth = 3; for (let q = 0; q < w - 16; q += 64) { g.beginPath(); g.moveTo(x + q + 2, fy + 4); g.lineTo(x + q + 30, fy + H - 4); g.stroke(); } }
    }
    // windows
    const nWin = Math.max(1, Math.floor(w / 64));
    for (let i = 0; i < nWin; i++) {
      const wx = x + (i + 0.5) * (w / nWin) - 7; if (Math.abs(wx + 7 - b.door.x) < 26) continue;
      const wy = fy + 12;
      g.fillStyle = night > 0.3 ? st.win : '#3a4a5a'; if (st.arch) { g.beginPath(); g.moveTo(wx, wy + 16); g.lineTo(wx, wy + 6); g.arc(wx + 7, wy + 6, 7, Math.PI, 0); g.lineTo(wx + 14, wy + 16); g.closePath(); g.fill(); } else g.fillRect(wx, wy, 14, 16);
      g.strokeStyle = st.beam; g.lineWidth = 2; g.strokeRect(wx, wy, 14, 16); g.beginPath(); g.moveTo(wx + 7, wy); g.lineTo(wx + 7, wy + 16); g.moveTo(wx, wy + 8); g.lineTo(wx + 14, wy + 8); g.stroke();
      if (night > 0.3) { g.fillStyle = 'rgba(255,200,120,0.12)'; g.fillRect(wx - 6, wy + 16, 26, 18); }
    }
    // door
    const dx = b.door.x - 13, dh = Math.min(34, H - 6), dy = y + h - dh;
    g.fillStyle = '#1e1610'; if (st.arch || b.type === 'hall' || b.type === 'chamber') { g.beginPath(); g.moveTo(dx, dy + dh); g.lineTo(dx, dy + 10); g.arc(dx + 13, dy + 10, 13, Math.PI, 0); g.lineTo(dx + 26, dy + dh); g.fill(); } else g.fillRect(dx, dy, 26, dh);
    const op = b.door.open;
    if (op < 0.99) {
      const dw = 26 * (1 - op);
      g.fillStyle = b.door.locked ? '#4a3a30' : '#7a5530'; g.fillRect(dx, dy + 2, dw, dh - 2);
      g.fillStyle = shade('#7a5530', -0.3); for (let q = 6; q < dw; q += 7) g.fillRect(dx + q, dy + 2, 1, dh - 2);
      if (dw > 8) circ(g, dx + dw - 5, dy + dh / 2 + 2, 1.8, '#e0c060');
      if (b.door.locked) { g.fillStyle = '#c0a040'; g.fillRect(dx + dw / 2 - 3, dy + dh / 2, 6, 6); }
    } else { g.fillStyle = 'rgba(255,190,110,0.25)'; g.fillRect(dx, dy, 26, dh); }
    // roof
    const ry0 = y - H * 0.55 - 6, ry1 = fy + 2, rx0 = x - 8, rx1 = x + w + 8;
    if (st.arch) {
      g.fillStyle = st.roof2; rr(g, rx0, ry0, rx1 - rx0, ry1 - ry0, 18); g.fill();
      g.fillStyle = st.roof; rr(g, rx0 + 4, ry0 + 2, rx1 - rx0 - 8, (ry1 - ry0) * 0.55, 16); g.fill();
      g.fillStyle = shade(st.roof, 0.15);
      for (let q = rx0 + 10; q < rx1 - 10; q += 14) for (let r = ry0 + 8; r < ry1 - 6; r += 12) { g.beginPath(); g.ellipse(q + ((r / 12) % 2) * 7, r, 6, 4, 0, 0, 6.28); g.fill(); }
      g.strokeStyle = st.trim; g.lineWidth = 2; rr(g, rx0, ry0, rx1 - rx0, ry1 - ry0, 18); g.stroke();
    } else {
      const mid = ry0 + (ry1 - ry0) * 0.45;
      g.fillStyle = st.roof; g.beginPath(); g.moveTo(rx0, mid); g.lineTo(x + 6, ry0); g.lineTo(x + w - 6, ry0); g.lineTo(rx1, mid); g.closePath(); g.fill();
      g.fillStyle = st.roof2; g.beginPath(); g.moveTo(rx0, mid); g.lineTo(rx1, mid); g.lineTo(rx1, ry1); g.lineTo(rx0, ry1); g.closePath(); g.fill();
      g.strokeStyle = shade(st.roof2, -0.25); g.lineWidth = 1;
      for (let r = mid + 7; r < ry1; r += 7) { g.beginPath(); g.moveTo(rx0, r); g.lineTo(rx1, r); g.stroke(); }
      for (let r = ry0 + 6; r < mid; r += 7) { g.beginPath(); g.moveTo(rx0 + 6, r); g.lineTo(rx1 - 6, r); g.stroke(); }
      g.fillStyle = shade(st.roof, 0.2); g.fillRect(x + 6, ry0 - 2, w - 12, 4);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(rx0, ry1 - 3, rx1 - rx0, 3);
    }
    // chimney + smoke
    if (['house', 'inn', 'smithy', 'forge', 'outpost'].includes(b.type)) {
      const cx = x + w - 28, cy = ry0 + 4;
      g.fillStyle = st.stone ? '#5a544c' : '#7a4a3a'; g.fillRect(cx, cy - 16, 12, 22); g.fillStyle = '#2a2420'; g.fillRect(cx - 1, cy - 18, 14, 4);
      for (let k = 0; k < 4; k++) { const ph = (t * 0.3 + k * 0.25 + b.x * 0.01) % 1; g.fillStyle = `rgba(200,200,205,${0.35 * (1 - ph)})`; g.beginPath(); g.arc(cx + 6 + Math.sin(ph * 6 + k) * 6 + ph * 14, cy - 22 - ph * 50, 4 + ph * 9, 0, 6.28); g.fill(); }
    }
    // hall: banners & crenellations
    if (b.type === 'hall') {
      const F = D.FACTIONS[b.faction];
      for (const bx of [x + 20, x + w - 34]) { g.fillStyle = F.banner; g.fillRect(bx, fy + 6, 14, 30); g.beginPath(); g.moveTo(bx, fy + 36); g.lineTo(bx + 7, fy + 30); g.lineTo(bx + 14, fy + 36); g.fill(); g.fillStyle = F.trim; g.fillRect(bx + 5, fy + 14, 4, 4); }
    }
    // sign
    if (SIGN[b.type]) {
      const sx = b.door.x + 22, sy = fy + 6;
      g.fillStyle = '#5a3e24'; g.fillRect(sx - 2, sy - 2, 2, 8); g.fillStyle = '#e8d8b0'; rr(g, sx, sy + 4, 22, 18, 3); g.fill(); g.strokeStyle = '#5a3e24'; g.stroke();
      g.font = '13px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(SIGN[b.type], sx + 11, sy + 14);
    }
    g.restore();
  };

  // ---------- decor ----------
  S.drawDecor = function (g, d, t, wind) {
    const x = d.x, y = d.y, v = d.v;
    const sway = Math.sin(t * 1.2 + x * 0.02) * wind;
    switch (d.kind) {
      case 'oak': case 'elmwood': case 'darkoak': case 'birch': case 'willow': {
        const big = d.kind === 'elmwood' ? 1.25 : d.kind === 'willow' ? 1.15 : 1;
        const sc = (1.15 + v * 0.4) * big; // bigger trees, fewer of them
        ell(g, x + 6, y + 2, 20 * sc, 8 * sc, 'rgba(0,0,0,0.22)');
        g.fillStyle = d.kind === 'birch' ? '#e6e2d6' : d.kind === 'elmwood' ? '#cfc3a0' : '#5a3e26';
        g.fillRect(x - 4 * sc, y - 26 * sc, 8 * sc, 28 * sc);
        if (d.kind === 'birch') { g.fillStyle = '#333'; for (let k = 0; k < 4; k++) g.fillRect(x - 3 * sc, y - 22 * sc + k * 6 * sc, 4 * sc, 1.5); }
        const cols = { oak: ['#2f5a2a', '#3e7334', '#5a9446'], elmwood: ['#2f6a3a', '#43914a', '#86c46a'], darkoak: ['#1f3524', '#2a4630', '#3a5a3a'], birch: ['#4f7f2f', '#6a9a3a', '#9cc45a'], willow: ['#3a5a2a', '#4a6a34', '#6a8a44'] }[d.kind];
        const cx = x + sway * 3, cy = y - 40 * sc;
        if (d.kind === 'willow') {
          circ(g, cx, cy, 22 * sc, cols[0]); g.strokeStyle = cols[1]; g.lineWidth = 2;
          for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(cx + k * 5 * sc, cy); g.quadraticCurveTo(cx + k * 6 * sc + sway * 4, cy + 18 * sc, cx + k * 6 * sc + sway * 6, cy + 30 * sc); g.stroke(); }
          circ(g, cx - 4, cy - 6, 14 * sc, cols[2]);
          break;
        }
        circ(g, cx - 12 * sc, cy + 6 * sc, 16 * sc, cols[0]); circ(g, cx + 12 * sc, cy + 6 * sc, 16 * sc, cols[0]);
        circ(g, cx, cy - 6 * sc, 20 * sc, cols[1]); circ(g, cx - 9 * sc, cy - 2 * sc, 14 * sc, cols[1]); circ(g, cx + 10 * sc, cy, 14 * sc, cols[1]);
        circ(g, cx - 6 * sc, cy - 12 * sc, 10 * sc, cols[2]); circ(g, cx + 6 * sc, cy - 8 * sc, 7 * sc, cols[2]);
        if (d.kind === 'elmwood') { for (let k = 0; k < 4; k++) circ(g, cx + Math.sin(k * 2 + v * 9) * 14 * sc, cy + Math.cos(k * 3) * 10 * sc, 1.8, '#f6f0a0'); }
        break; }
      case 'pine': case 'snowpine': {
        const sc = 1.15 + v * 0.45; ell(g, x + 4, y + 2, 14 * sc, 6 * sc, 'rgba(0,0,0,0.22)');
        g.fillStyle = '#4a3220'; g.fillRect(x - 3, y - 14 * sc, 6, 16 * sc);
        const c1 = d.kind === 'snowpine' ? '#2e4a3e' : '#24482c', c2 = d.kind === 'snowpine' ? '#3a5e4c' : '#2f5e38';
        for (let k = 0; k < 4; k++) {
          const ty = y - 12 * sc - k * 13 * sc, wd = (22 - k * 4.5) * sc, sw = sway * (k + 1) * 0.8;
          g.fillStyle = k % 2 ? c2 : c1; g.beginPath(); g.moveTo(x - wd + sw * 0.5, ty); g.lineTo(x + sw, ty - 20 * sc); g.lineTo(x + wd + sw * 0.5, ty); g.closePath(); g.fill();
          if (d.kind === 'snowpine') { g.fillStyle = '#eef4f7'; g.beginPath(); g.moveTo(x - wd * 0.5 + sw * 0.5, ty - 8 * sc); g.lineTo(x + sw, ty - 20 * sc); g.lineTo(x + wd * 0.5 + sw * 0.5, ty - 8 * sc); g.closePath(); g.fill(); }
        }
        break; }
      case 'deadtree': case 'charred': {
        const sc = 0.9 + v * 0.3; ell(g, x + 4, y + 2, 12 * sc, 5, 'rgba(0,0,0,0.22)');
        g.strokeStyle = d.kind === 'charred' ? '#1e1a18' : '#4a3e34'; g.lineCap = 'round';
        g.lineWidth = 6 * sc; g.beginPath(); g.moveTo(x, y); g.lineTo(x + sway, y - 34 * sc); g.stroke();
        g.lineWidth = 3 * sc; g.beginPath(); g.moveTo(x + sway * 0.5, y - 18 * sc); g.lineTo(x - 14 * sc, y - 34 * sc); g.moveTo(x + sway, y - 28 * sc); g.lineTo(x + 14 * sc, y - 44 * sc); g.moveTo(x + sway, y - 34 * sc); g.lineTo(x - 4 * sc, y - 50 * sc); g.stroke();
        g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 14 * sc, y - 34 * sc); g.lineTo(x - 20 * sc, y - 36 * sc); g.moveTo(x + 14 * sc, y - 44 * sc); g.lineTo(x + 20 * sc, y - 42 * sc); g.stroke(); g.lineCap = 'butt';
        break; }
      case 'boulder': ell(g, x + 3, y + 2, 15, 6, 'rgba(0,0,0,0.25)'); g.fillStyle = '#7a756d'; g.beginPath(); g.moveTo(x - 14, y + 2); g.quadraticCurveTo(x - 16, y - 14, x - 2, y - 18); g.quadraticCurveTo(x + 14, y - 16, x + 14, y + 2); g.closePath(); g.fill(); g.fillStyle = '#958f86'; g.beginPath(); g.ellipse(x - 3, y - 10, 8, 5, -0.4, 0, 6.28); g.fill(); break;
      case 'bramble': for (let k = 0; k < 5; k++) circ(g, x + Math.cos(k * 1.3) * 8, y - 6 + Math.sin(k * 2.1) * 4, 7, k % 2 ? '#4a5a2a' : '#5e6e34'); for (let k = 0; k < 4; k++) circ(g, x + Math.cos(k * 2.3) * 8, y - 8 + Math.sin(k * 1.7) * 5, 1.5, '#8a2a3a'); break;
      case 'flowers': { const c = ['#f2d34a', '#e86a8a', '#ffffff', '#9a7ae0', '#f0904a'][Math.floor(v * 5)]; for (let k = 0; k < 3; k++) { const fx = x + Math.cos(k * 2.1 + v * 6) * 5, fy = y + Math.sin(k * 1.7 + v * 6) * 3; g.fillStyle = '#3e6a2a'; g.fillRect(fx, fy, 1, 4); circ(g, fx, fy, 2, c); } break; }
      case 'mushroom': g.fillStyle = '#e8dcc8'; g.fillRect(x - 1, y - 4, 2, 4); circ(g, x, y - 5, 3.5, v < 0.5 ? '#c8402a' : '#b08a5a'); circ(g, x - 1, y - 6, 0.8, '#fff'); break;
      case 'fern': g.strokeStyle = '#3f7a34'; g.lineWidth = 1.5; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + k * 4, y - 8, x + k * 7 + sway, y - 6); g.stroke(); } break;
      case 'reeds': g.strokeStyle = '#6a7a3a'; g.lineWidth = 1.5; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * 2, y); g.lineTo(x + k * 3 + sway * 2, y - 14 - Math.abs(k) * 2); g.stroke(); } circ(g, x + sway * 2, y - 15, 2, '#5a3a20'); break;
      case 'bones': g.fillStyle = '#ddd5c0'; g.save(); g.translate(x, y); g.rotate(v * 3); g.fillRect(-6, -1, 12, 2); circ(g, -6, 0, 2, '#ddd5c0'); circ(g, 6, 0, 2, '#ddd5c0'); g.restore(); if (v > 0.6) { circ(g, x + 6, y - 2, 3.5, '#e6dfcc'); circ(g, x + 5, y - 2, 0.9, '#222'); circ(g, x + 7, y - 2, 0.9, '#222'); } break;
      case 'snowtuft': circ(g, x, y, 3, '#ffffff'); circ(g, x + 3, y + 1, 2, '#e4ecf0'); break;
      case 'ember': { const a = 0.5 + Math.sin(t * 4 + v * 10) * 0.3; circ(g, x, y, 2, `rgba(255,140,40,${a})`); break; }
      case 'pebbles': for (let k = 0; k < 3; k++) circ(g, x + k * 4 - 4, y + (k % 2) * 2, 1.8, '#8a847a'); break;
      case 'tomb': ell(g, x + 2, y + 2, 10, 4, 'rgba(0,0,0,0.25)'); g.fillStyle = '#8a8680'; g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x - 8, y - 14); g.arc(x, y - 14, 8, Math.PI, 0); g.lineTo(x + 8, y); g.fill(); g.fillStyle = '#6a6660'; g.fillRect(x - 1, y - 18, 2, 10); g.fillRect(x - 4, y - 15, 8, 2); break;
      case 'crystal': { const a = 0.6 + Math.sin(t * 2 + v * 9) * 0.3; g.fillStyle = `rgba(150,110,255,${a})`; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x - 3, y - 18); g.lineTo(x, y); g.moveTo(x - 1, y); g.lineTo(x + 3, y - 24); g.lineTo(x + 6, y); g.fill(); break; }
      case 'lamp': {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + 3, y + 2, 7, 3, 0, 0, 6.28); g.fill();
        g.fillStyle = '#2e2a26'; g.fillRect(x - 2, y - 46, 4, 48); g.fillRect(x - 5, y - 2, 10, 3); g.fillRect(x - 2, y - 46, 12, 3);
        g.fillStyle = '#3a3430'; g.fillRect(x + 4, y - 44, 10, 14);
        if (!d.broken) { const fl = 0.85 + Math.sin(t * 9 + v * 20) * 0.08; g.fillStyle = `rgba(255,214,140,${fl})`; g.fillRect(x + 6, y - 42, 6, 10); }
        break; }
      case 'torch': { g.fillStyle = '#4a3220'; g.fillRect(x - 1.5, y - 22, 3, 12); const f = Math.sin(t * 12 + v * 30) * 2; g.fillStyle = '#ff9a3a'; g.beginPath(); g.ellipse(x, y - 26, 4, 7 + f, 0, 0, 6.28); g.fill(); g.fillStyle = '#ffe080'; g.beginPath(); g.ellipse(x, y - 24, 2, 4, 0, 0, 6.28); g.fill(); break; }
      case 'campfire': {
        for (let k = 0; k < 6; k++) circ(g, x + Math.cos(k) * 9, y + Math.sin(k) * 4, 3, '#6a6460');
        g.strokeStyle = '#5a3a20'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 8, y + 2); g.lineTo(x + 8, y - 3); g.moveTo(x - 8, y - 3); g.lineTo(x + 8, y + 2); g.stroke();
        for (let k = 0; k < 3; k++) { const f = Math.sin(t * 10 + k * 2) * 3; g.fillStyle = ['#ff6a1a', '#ffa63a', '#ffe27a'][k]; g.beginPath(); g.ellipse(x + (k - 1) * 2, y - 6 - k * 2, 6 - k * 1.5, 10 - k * 2 + f, 0, 0, 6.28); g.fill(); }
        break; }
      case 'tent': { const c = d.col || '#7a5a3a'; ell(g, x + 4, y + 4, 26, 8, 'rgba(0,0,0,0.25)'); g.fillStyle = c; g.beginPath(); g.moveTo(x - 24, y + 4); g.lineTo(x, y - 30); g.lineTo(x + 24, y + 4); g.closePath(); g.fill(); g.fillStyle = shade(c, -0.35); g.beginPath(); g.moveTo(x - 6, y + 4); g.lineTo(x, y - 14); g.lineTo(x + 6, y + 4); g.fill(); g.strokeStyle = shade(c, -0.5); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x, y - 36); g.stroke(); break; }
      case 'sewermouth': {
        // brick arch, a rusted grate with one bar bent wide, and a stream of muck spilling out
        g.fillStyle = '#5a5248'; g.beginPath(); g.moveTo(x - 30, y + 26); g.lineTo(x - 30, y - 14); g.arc(x, y - 14, 30, Math.PI, 0); g.lineTo(x + 30, y + 26); g.closePath(); g.fill();
        g.fillStyle = '#0a0c0a'; g.beginPath(); g.moveTo(x - 20, y + 26); g.lineTo(x - 20, y - 12); g.arc(x, y - 12, 20, Math.PI, 0); g.lineTo(x + 20, y + 26); g.closePath(); g.fill();
        g.strokeStyle = '#3a342c'; g.lineWidth = 1.5; for (let k = 0; k < 9; k++) { const a = Math.PI + k * Math.PI / 8; g.beginPath(); g.moveTo(x + Math.cos(a) * 20, y - 14 + Math.sin(a) * 20); g.lineTo(x + Math.cos(a) * 30, y - 14 + Math.sin(a) * 30); g.stroke(); }
        g.fillStyle = 'rgba(90,140,60,0.55)'; g.fillRect(x - 22, y + 12, 44, 4); circ(g, x - 16, y + 18, 3, 'rgba(90,140,60,0.5)'); circ(g, x + 12, y + 20, 2.5, 'rgba(90,140,60,0.5)');
        g.strokeStyle = '#6a4a32'; g.lineWidth = 2.5; for (let k = -3; k <= 3; k++) { if (k === 1) continue; const bx = x + k * 5.5; const top = y - 12 - Math.sqrt(Math.max(0, 400 - (k * 5.5) ** 2)) + 2; g.beginPath(); g.moveTo(bx, top); g.lineTo(bx, y + 24); g.stroke(); }
        g.beginPath(); g.moveTo(x + 5.5, y - 30); g.quadraticCurveTo(x + 14, y - 6, x + 5.5, y + 24); g.stroke();
        g.beginPath(); g.moveTo(x - 20, y - 4); g.lineTo(x + 20, y - 4); g.moveTo(x - 20, y + 12); g.lineTo(x + 20, y + 12); g.stroke();
        for (let k = 0; k < 5; k++) { const ph = (t * 1.6 + k * 0.2) % 1; g.fillStyle = `rgba(150,190,170,${0.55 * (1 - ph)})`; g.fillRect(x - 12 + k * 6, y + 22 + ph * 10, 3, 3); }
        const a2 = 0.35 + Math.sin(t * 2 + v * 5) * 0.15; g.fillStyle = `rgba(255,220,150,${a2})`; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText('▼', x, y - 50); break; }
      case 'drainpipe': {
        g.fillStyle = '#5a5a58'; rr(g, x - 8, y - 16, 16, 12, 3); g.fill(); g.fillStyle = '#1a1a18'; g.beginPath(); g.ellipse(x, y - 4, 6, 3, 0, 0, 6.28); g.fill(); g.fillStyle = '#7a4a2a'; g.fillRect(x - 9, y - 12, 18, 2);
        for (let k = 0; k < 4; k++) { const ph = (t * 1.3 + k * 0.25 + v) % 1; g.fillStyle = `rgba(120,170,130,${0.6 * (1 - ph)})`; g.fillRect(x - 1.5 + Math.sin(k) * 1.5, y - 2 + ph * 22, 3, 4); }
        g.fillStyle = 'rgba(80,130,60,0.5)'; g.beginPath(); g.ellipse(x, y + 22, 9, 3, 0, 0, 6.28); g.fill(); break; }
      case 'grate': {
        g.fillStyle = '#1a1c1a'; g.fillRect(x - 12, y - 8, 24, 16); g.strokeStyle = '#5a5248'; g.lineWidth = 2; g.strokeRect(x - 12, y - 8, 24, 16);
        g.strokeStyle = '#4a4440'; g.lineWidth = 1.5; for (let k = -8; k <= 8; k += 4) { g.beginPath(); g.moveTo(x + k, y - 8); g.lineTo(x + k, y + 8); g.stroke(); }
        if (Math.sin(t * 3 + v * 9) > 0.7) { g.fillStyle = 'rgba(150,200,150,0.35)'; g.fillRect(x - 4, y - 2, 8, 2); } break; }
      case 'cavemouth': { g.fillStyle = '#120c08'; g.beginPath(); g.ellipse(x, y - 8, 26, 22, 0, Math.PI, 0); g.lineTo(x + 26, y + 6); g.lineTo(x - 26, y + 6); g.closePath(); g.fill(); const gr = g.createRadialGradient(x, y - 4, 2, x, y - 4, 26); gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gr; g.fillRect(x - 28, y - 32, 56, 40); g.strokeStyle = '#5a4a3a'; g.lineWidth = 4; g.beginPath(); g.ellipse(x, y - 8, 27, 23, 0, Math.PI, 0); g.stroke(); const a = 0.35 + Math.sin(t * 2 + v * 5) * 0.15; g.fillStyle = `rgba(255,220,150,${a})`; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('▼', x, y - 2 + Math.sin(t * 3) * 2); g.textAlign = 'start'; break; }
      case 'exitportal': { const a = 0.5 + Math.sin(t * 2.5) * 0.25; const gr = g.createRadialGradient(x, y - 14, 2, x, y - 14, 30); gr.addColorStop(0, `rgba(255,240,190,${a})`); gr.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y - 14, 22, 30, 0, 0, 6.28); g.fill(); g.strokeStyle = `rgba(255,230,170,${a})`; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y - 14, 16, 24, 0, 0, 6.28); g.stroke(); break; }
      case 'cactus': { ell(g, x + 3, y + 3, 10, 4, 'rgba(0,0,0,0.22)'); const c = '#4a8a3a'; g.fillStyle = c; rr(g, x - 4, y - 34, 8, 36, 4); g.fill(); rr(g, x - 13, y - 22, 6, 12, 3); g.fill(); g.fillRect(x - 10, y - 14, 7, 4); rr(g, x + 7, y - 28, 6, 14, 3); g.fill(); g.fillRect(x + 3, y - 18, 6, 4); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x - 2, y - 32, 2, 30); if (v > 0.6) circ(g, x, y - 35, 3, '#e05a8a'); break; }
      case 'palm': { const sc = 1.15 + v * 0.35; ell(g, x + 8, y + 3, 18 * sc, 6 * sc, 'rgba(0,0,0,0.2)'); g.strokeStyle = '#8a6a3a'; g.lineWidth = 6 * sc; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6 * sc, y - 30 * sc, x + 2 * sc + sway * 2, y - 58 * sc); g.stroke(); const tx = x + 2 * sc + sway * 2, ty = y - 58 * sc; g.strokeStyle = '#2f7a3a'; g.lineWidth = 5 * sc; for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.6 + sway * 0.1; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * 18 * sc, ty + Math.sin(a) * 18 * sc - 6, tx + Math.cos(a) * 30 * sc, ty + Math.sin(a) * 30 * sc + 10 * sc); g.stroke(); } circ(g, tx - 3, ty + 4, 3, '#6a4a2a'); circ(g, tx + 3, ty + 5, 3, '#6a4a2a'); break; }
      case 'boat': { const bob = Math.sin(t * 1.5 + v * 5) * 2; g.save(); g.translate(x, y + bob); ell(g, 0, 10, 46, 9, 'rgba(0,30,60,0.35)'); g.fillStyle = '#6a4424'; g.beginPath(); g.moveTo(-46, -6); g.lineTo(46, -6); g.lineTo(34, 10); g.lineTo(-34, 10); g.closePath(); g.fill(); g.fillStyle = '#8a5a30'; g.fillRect(-44, -10, 88, 5); g.fillStyle = '#4a2e18'; g.fillRect(-2, -78, 4, 72); g.fillStyle = '#efe6cc'; g.beginPath(); g.moveTo(2, -76); g.quadraticCurveTo(34 + Math.sin(t * 2) * 3, -46, 2, -14); g.closePath(); g.fill(); g.fillStyle = '#b84a3a'; g.beginPath(); g.moveTo(2, -78); g.lineTo(18, -73); g.lineTo(2, -68); g.fill(); g.restore(); break; }
      case 'balloon': { const bob = Math.sin(t * 0.8) * 4; g.save(); g.translate(x, y - 20 + bob); ell(g, 0, 22 - bob, 20, 6, 'rgba(0,0,0,0.25)'); g.strokeStyle = '#5a3a20'; g.lineWidth = 1.5; for (const sx of [-10, 10]) { g.beginPath(); g.moveTo(sx, -6); g.lineTo(sx * 2.2, -40); g.stroke(); } g.fillStyle = '#8a5a30'; g.fillRect(-12, -8, 24, 16); g.fillStyle = '#6a4424'; g.fillRect(-12, -8, 24, 3); const cols = ['#c83a3a', '#e8c040', '#c83a3a', '#e8c040']; for (let k = 0; k < 4; k++) { g.fillStyle = cols[k]; g.beginPath(); g.ellipse(-27 + k * 18, -78, 10, 38, 0, 0, 6.28); g.fill(); } g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(-12, -92, 10, 18, -0.3, 0, 6.28); g.fill(); g.restore(); break; }
      case 'post': g.fillStyle = '#5a3a20'; g.fillRect(x - 3, y - 18, 6, 22); g.fillStyle = '#7a5a30'; g.fillRect(x - 4, y - 20, 8, 4); break;
      case 'cavesign': { g.fillStyle = '#5a3e24'; g.fillRect(x - 2, y - 26, 4, 28); g.fillStyle = '#a07a4a'; g.fillRect(x - 26, y - 34, 52, 14); g.strokeStyle = '#3a2614'; g.lineWidth = 1.5; g.strokeRect(x - 26, y - 34, 52, 14); g.fillStyle = '#2a1a0a'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.fillText((d.name || '').slice(0, 18), x, y - 24.5); g.textAlign = 'start'; break; }
      case 'stalagmite': { ell(g, x + 2, y + 2, 10, 4, 'rgba(0,0,0,0.3)'); const c = d.ty && W.tile(d.tx, d.ty) === 26 ? '#cfe6f2' : '#7a6a5a'; g.fillStyle = c; g.beginPath(); g.moveTo(x - 9, y + 2); g.lineTo(x - 2, y - 30 - v * 12); g.lineTo(x + 3, y - 14); g.lineTo(x + 6, y - 22 - v * 8); g.lineTo(x + 10, y + 2); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x - 4, y - 24, 2, 22); break; }
      case 'icecrystal': { const a = 0.7 + Math.sin(t * 1.6 + v * 7) * 0.2; ell(g, x + 2, y + 2, 10, 4, 'rgba(0,0,0,0.25)'); g.fillStyle = `rgba(170,220,255,${a})`; g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x - 4, y - 26); g.lineTo(x, y); g.moveTo(x - 2, y); g.lineTo(x + 3, y - 34); g.lineTo(x + 8, y); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + 2, y - 28, 1.5, 20); break; }
      case 'sarcophagus': ell(g, x + 2, y + 3, 16, 5, 'rgba(0,0,0,0.3)'); g.fillStyle = '#8a8070'; g.fillRect(x - 14, y - 14, 28, 16); g.fillStyle = '#a49a88'; g.fillRect(x - 15, y - 18, 30, 6); g.fillStyle = '#6a6050'; g.fillRect(x - 3, y - 16, 6, 2); g.fillRect(x - 1, y - 18, 2, 6); break;
      case 'crate': ell(g, x + 2, y + 2, 11, 4, 'rgba(0,0,0,0.25)'); g.fillStyle = '#9a7344'; g.fillRect(x - 10, y - 18, 20, 18); g.strokeStyle = '#5a3e24'; g.lineWidth = 2; g.strokeRect(x - 10, y - 18, 20, 18); g.beginPath(); g.moveTo(x - 10, y - 18); g.lineTo(x + 10, y); g.stroke(); break;
      case 'barrel': case 'keg': ell(g, x + 2, y + 2, 10, 4, 'rgba(0,0,0,0.25)'); g.fillStyle = '#8a5e34'; rr(g, x - 9, y - 20, 18, 20, 5); g.fill(); g.fillStyle = '#4a3a2a'; g.fillRect(x - 9, y - 16, 18, 2); g.fillRect(x - 9, y - 5, 18, 2); ell(g, x, y - 20, 9, 3, '#6a4a2a'); break;
      case 'totem': g.fillStyle = '#5a3e24'; g.fillRect(x - 3, y - 36, 6, 36); circ(g, x, y - 38, 7, d.col || '#8a3a2a'); circ(g, x - 2, y - 39, 1.5, '#ffeb6a'); circ(g, x + 2, y - 39, 1.5, '#ffeb6a'); g.fillStyle = '#ddd'; g.beginPath(); g.moveTo(x - 7, y - 42); g.lineTo(x - 12, y - 50); g.lineTo(x - 4, y - 44); g.moveTo(x + 7, y - 42); g.lineTo(x + 12, y - 50); g.lineTo(x + 4, y - 44); g.fill(); break;
      case 'crypt': ell(g, x + 4, y + 4, 30, 8, 'rgba(0,0,0,0.3)'); g.fillStyle = '#5a5650'; g.fillRect(x - 26, y - 34, 52, 36); g.fillStyle = '#46423e'; g.beginPath(); g.moveTo(x - 30, y - 34); g.lineTo(x, y - 52); g.lineTo(x + 30, y - 34); g.fill(); g.fillStyle = '#141212'; g.beginPath(); g.moveTo(x - 8, y + 2); g.lineTo(x - 8, y - 18); g.arc(x, y - 18, 8, Math.PI, 0); g.lineTo(x + 8, y + 2); g.fill(); break;
      case 'fountain': {
        ell(g, x + 16, y + 6, 44, 16, 'rgba(0,0,0,0.25)'); ell(g, x + 16, y - 4, 42, 18, '#8d877c'); ell(g, x + 16, y - 6, 36, 14, '#4c8ab4');
        g.fillStyle = '#9a948a'; g.fillRect(x + 12, y - 34, 8, 30); ell(g, x + 16, y - 34, 12, 4, '#a8a296');
        for (let k = 0; k < 6; k++) { const ph = (t * 1.5 + k / 6) % 1; circ(g, x + 16 + Math.cos(k) * ph * 20, y - 36 + ph * ph * 30 - ph * 16, 2, `rgba(200,230,255,${1 - ph})`); }
        break; }
      case 'monument': {
        ell(g, x + 16, y + 8, 46, 16, 'rgba(0,0,0,0.3)'); g.fillStyle = '#b8b0a0'; g.fillRect(x - 14, y - 10, 60, 14); g.fillStyle = '#d8d0c0'; g.fillRect(x + 4, y - 90, 24, 82);
        g.fillStyle = '#f0c75e'; g.beginPath(); g.moveTo(x + 4, y - 90); g.lineTo(x + 16, y - 112); g.lineTo(x + 28, y - 90); g.fill();
        const a = 0.6 + Math.sin(t * 2) * 0.3; circ(g, x + 16, y - 70, 6, `rgba(255,230,140,${a})`);
        break; }
      case 'stall': { const c = d.col || '#b84a3a'; ell(g, x + 2, y + 4, 26, 6, 'rgba(0,0,0,0.25)'); g.fillStyle = '#7a5530'; g.fillRect(x - 22, y - 14, 44, 14); g.fillStyle = '#5a3e24'; g.fillRect(x - 22, y - 40, 3, 40); g.fillRect(x + 19, y - 40, 3, 40);
        for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? c : '#f2ead8'; g.fillRect(x - 24 + k * 8, y - 44, 8, 10); } g.fillStyle = '#e0a040'; circ(g, x - 12, y - 16, 3, '#e0a040'); circ(g, x - 5, y - 16, 3, '#6aa840'); circ(g, x + 4, y - 16, 3, '#c83a3a'); circ(g, x + 12, y - 16, 3, '#e8d070'); break; }
      case 'statue': ell(g, x + 3, y + 4, 16, 5, 'rgba(0,0,0,0.25)'); g.fillStyle = '#9a948a'; g.fillRect(x - 12, y - 10, 24, 12); g.fillStyle = '#c8c0b0'; g.fillRect(x - 5, y - 38, 10, 28); circ(g, x, y - 42, 6, '#c8c0b0'); g.fillRect(x + 5, y - 52, 3, 32); break;
      case 'tower': { const F = D.FACTIONS[d.f]; ell(g, x + 4, y + 8, 28, 8, 'rgba(0,0,0,0.3)'); g.fillStyle = '#6d665e'; g.fillRect(x - 22, y - 70, 44, 76); g.fillStyle = '#5a544c'; for (let k = 0; k < 4; k++) g.fillRect(x - 22 + k * 12, y - 80, 8, 10); g.fillStyle = '#2a2420'; g.fillRect(x - 4, y - 50, 8, 14); g.fillStyle = F ? F.banner : '#333'; g.fillRect(x + 6, y - 106, 16, 12); g.fillStyle = '#3a3028'; g.fillRect(x + 4, y - 108, 2, 30); break; }
      case 'scarecrowpost': g.fillStyle = '#5a3e24'; g.fillRect(x - 2, y - 34, 4, 34); g.fillRect(x - 14, y - 28, 28, 3); g.fillStyle = '#8a6a3a'; g.fillRect(x - 7, y - 30, 14, 14); circ(g, x, y - 36, 6, '#d8b878'); g.fillStyle = '#4a3a2a'; g.beginPath(); g.moveTo(x - 9, y - 39); g.lineTo(x, y - 48); g.lineTo(x + 9, y - 39); g.fill(); break;
      case 'crop': { const c = d.crop === 'sylvan' ? '#6aa84a' : d.crop === 'iron' ? '#b8a858' : '#d8b84a'; for (let k = -1; k <= 1; k++) { g.strokeStyle = '#4a7a2a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + k * 10, y); g.lineTo(x + k * 10 + sway, y - 12); g.stroke(); circ(g, x + k * 10 + sway, y - 13, 3, c); } break; }
      // interior furniture
      case 'throne': g.fillStyle = '#7a1e1e'; rr(g, x - 14, y - 40, 28, 40, 4); g.fill(); g.fillStyle = '#e0b84a'; g.fillRect(x - 16, y - 44, 32, 6); g.fillRect(x - 16, y - 12, 4, 12); g.fillRect(x + 12, y - 12, 4, 12); circ(g, x, y - 46, 4, '#e0b84a'); break;
      case 'carpet': g.fillStyle = '#8a2a2a'; g.fillRect(x - 18, y - 12, 36, (d.len || 4) * TS); g.strokeStyle = '#e0b84a'; g.lineWidth = 2; g.strokeRect(x - 15, y - 9, 30, (d.len || 4) * TS - 6); break;
      case 'pillar': ell(g, x + 2, y + 3, 10, 4, 'rgba(0,0,0,0.25)'); g.fillStyle = '#b8b0a0'; g.fillRect(x - 7, y - 54, 14, 56); g.fillStyle = '#d0c8b8'; g.fillRect(x - 9, y - 58, 18, 6); g.fillRect(x - 9, y - 2, 18, 4); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 2, y - 52, 4, 50); break;
      case 'brazier': g.fillStyle = '#3a342e'; g.fillRect(x - 2, y - 18, 4, 18); g.fillStyle = '#5a524a'; g.beginPath(); g.moveTo(x - 10, y - 26); g.lineTo(x + 10, y - 26); g.lineTo(x + 6, y - 18); g.lineTo(x - 6, y - 18); g.fill(); for (let k = 0; k < 2; k++) { const f = Math.sin(t * 11 + k * 3 + v * 9) * 2; g.fillStyle = k ? '#ffe07a' : '#ff7a2a'; g.beginPath(); g.ellipse(x, y - 30 + k * 2, 7 - k * 3, 9 - k * 3 + f, 0, 0, 6.28); g.fill(); } break;
      case 'banner': { const F = D.FACTIONS[KR.W.buildings.find((b) => d.tx >= b.x && d.tx < b.x + b.w && d.ty >= b.y && d.ty < b.y + b.h)?.faction] || D.FACTIONS.crown; g.fillStyle = F.banner; g.fillRect(x - 7, y - 30, 14, 26); g.fillStyle = F.trim; g.fillRect(x - 3, y - 22, 6, 6); break; }
      case 'counter': g.fillStyle = '#6a4a2a'; g.fillRect(x - 16, y - 18, 32, 18); g.fillStyle = '#8a6440'; g.fillRect(x - 16, y - 22, 32, 6); break;
      case 'table': ell(g, x + 2, y + 2, 14, 5, 'rgba(0,0,0,0.2)'); g.fillStyle = '#7a5530'; rr(g, x - 13, y - 18, 26, 12, 3); g.fill(); g.fillRect(x - 11, y - 8, 3, 8); g.fillRect(x + 8, y - 8, 3, 8); circ(g, x - 4, y - 14, 2.5, '#d8c890'); circ(g, x + 5, y - 13, 2, '#c8a060'); break;
      case 'stove': g.fillStyle = '#3a3430'; g.fillRect(x - 12, y - 22, 24, 22); g.fillStyle = '#ff7a2a'; g.fillRect(x - 6, y - 10, 12, 6); g.fillStyle = '#5a524a'; circ(g, x - 4, y - 24, 6, '#5a524a'); for (let k = 0; k < 3; k++) { const ph = (t * 0.6 + k / 3) % 1; circ(g, x - 4 + Math.sin(ph * 8) * 3, y - 30 - ph * 20, 3 + ph * 3, `rgba(230,230,230,${0.4 * (1 - ph)})`); } break;
      case 'hearth': g.fillStyle = '#6a5a4a'; g.fillRect(x - 14, y - 30, 28, 30); g.fillStyle = '#1e1612'; g.fillRect(x - 9, y - 18, 18, 18); for (let k = 0; k < 2; k++) { const f = Math.sin(t * 9 + k * 2) * 2; g.fillStyle = k ? '#ffd06a' : '#ff6a2a'; g.beginPath(); g.ellipse(x, y - 6, 7 - k * 3, 8 - k * 3 + f, 0, 0, 6.28); g.fill(); } break;
      case 'vault': g.fillStyle = '#6a6a72'; rr(g, x - 13, y - 26, 26, 26, 4); g.fill(); circ(g, x, y - 13, 6, '#9a9aa4'); g.strokeStyle = '#3a3a42'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 4, y - 13); g.lineTo(x + 4, y - 13); g.moveTo(x, y - 17); g.lineTo(x, y - 9); g.stroke(); break;
      case 'chest': g.fillStyle = '#7a5028'; g.fillRect(x - 10, y - 14, 20, 14); g.fillStyle = '#c8a040'; g.fillRect(x - 10, y - 9, 20, 2); g.fillRect(x - 2, y - 11, 4, 5); break;
      case 'forge': g.fillStyle = '#4a423a'; g.fillRect(x - 14, y - 32, 28, 32); g.fillStyle = '#1e1612'; g.fillRect(x - 9, y - 16, 18, 14); { const a = 0.7 + Math.sin(t * 6) * 0.2; g.fillStyle = `rgba(255,110,30,${a})`; g.fillRect(x - 8, y - 12, 16, 9); } break;
      case 'anvil': g.fillStyle = '#3a3a40'; g.fillRect(x - 4, y - 8, 8, 8); g.beginPath(); g.moveTo(x - 14, y - 16); g.lineTo(x + 10, y - 16); g.lineTo(x + 16, y - 12); g.lineTo(x + 8, y - 8); g.lineTo(x - 10, y - 8); g.closePath(); g.fill(); g.fillStyle = '#5a5a62'; g.fillRect(x - 12, y - 17, 20, 2); break;
      case 'orepile': for (let k = 0; k < 5; k++) circ(g, x + (k - 2) * 5, y - 4 - (k % 2) * 4, 5, ['#7a6a5a', '#9a5a3a', '#6a6a7a'][k % 3]); break;
      case 'weaponrack': g.fillStyle = '#5a3e24'; g.fillRect(x - 14, y - 4, 28, 4); g.fillRect(x - 14, y - 30, 3, 30); g.fillRect(x + 11, y - 30, 3, 30); g.strokeStyle = '#c8ccd2'; g.lineWidth = 2; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + k * 7, y - 4); g.lineTo(x + k * 7, y - 30); g.stroke(); } break;
      case 'armorstand': g.fillStyle = '#5a3e24'; g.fillRect(x - 1, y - 30, 2, 30); g.fillStyle = '#a8acb4'; rr(g, x - 9, y - 30, 18, 16, 4); g.fill(); circ(g, x, y - 34, 5, '#a8acb4'); break;
      case 'loom': g.fillStyle = '#7a5530'; g.fillRect(x - 14, y - 30, 3, 30); g.fillRect(x + 11, y - 30, 3, 30); g.fillRect(x - 14, y - 30, 28, 3); g.fillStyle = '#b84a6a'; g.fillRect(x - 10, y - 26, 20, 16); g.strokeStyle = '#f0e0d0'; g.lineWidth = 0.5; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(x - 10 + k * 4, y - 26); g.lineTo(x - 10 + k * 4, y - 10); g.stroke(); } break;
      case 'clothrack': g.fillStyle = '#5a3e24'; g.fillRect(x - 14, y - 30, 28, 2); ['#3a6ab8', '#c8a03a', '#6a3a8a', '#3a8a5a'].forEach((c, k) => { g.fillStyle = c; g.fillRect(x - 13 + k * 7, y - 28, 6, 18); }); break;
      case 'bookshelf': g.fillStyle = '#5a3e24'; g.fillRect(x - 14, y - 36, 28, 36); for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) { g.fillStyle = ['#8a2a2a', '#2a4a8a', '#3a6a2a', '#8a6a2a'][(k + r) % 4]; g.fillRect(x - 12 + k * 4, y - 34 + r * 11, 3, 9); } break;
      case 'lectern': g.fillStyle = '#6a4a2a'; g.fillRect(x - 2, y - 20, 4, 20); g.fillRect(x - 10, y - 26, 20, 6); g.fillStyle = '#efe3c8'; g.fillRect(x - 9, y - 29, 18, 4); break;
      case 'dummy': g.fillStyle = '#5a3e24'; g.fillRect(x - 1.5, y - 30, 3, 30); g.fillStyle = '#c8a870'; rr(g, x - 8, y - 30, 16, 16, 4); g.fill(); circ(g, x, y - 34, 5, '#c8a870'); g.strokeStyle = '#8a2a2a'; g.beginPath(); g.arc(x, y - 22, 4, 0, 6.28); g.stroke(); break;
      case 'shelf': g.fillStyle = '#6a4a2a'; g.fillRect(x - 14, y - 32, 28, 32); for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) circ(g, x - 9 + k * 6, y - 26 + r * 10, 2.5, ['#c84a3a', '#e0c060', '#6a9ac8', '#9a6ac8'][(k + r) % 4]); break;
      case 'bed': g.fillStyle = '#6a4a2a'; g.fillRect(x - 12, y - 24, 24, 26); g.fillStyle = '#e8e0d0'; g.fillRect(x - 10, y - 22, 20, 8); g.fillStyle = '#5a6aa8'; g.fillRect(x - 10, y - 14, 20, 14); break;
      default: break;
    }
  };

  // ---------- characters ----------
  // o: {race, gender, skin, hair, hairStyle, cls, dir, walk, moving, atk, cast, castCol, sit, dead, scale, armor:{kind,col,trim}, helm, hat, weapon, offhand, back, cape, glow, kind(mob humanoid), col, tusk, eyesCol}
  const SKINS = ['#f3d2b4', '#e2b48e', '#c48a5e', '#8e5a3a', '#5a3a26'];
  const HAIRS = ['#2a1e16', '#5a3a22', '#9a6a3a', '#d8b46a', '#e8e0d0', '#a83a22', '#3a3a44', '#6a3a8a'];
  S.SKINS = SKINS; S.HAIRS = HAIRS;
  S.skinsFor = (race) => (D.RACES[race] && D.RACES[race].skins) || SKINS;
  S.skinOf = (race, i) => { const a = S.skinsFor(race); return typeof i === 'number' ? a[Math.max(0, Math.min(a.length - 1, i))] : i || a[1]; };

  S.drawHumanoid = function (g, x, y, o, t) {
    const sc = (o.scale || 1);
    const race = D.RACES[o.race] || {};
    const wid = o.width || race.width || 1;
    const dir = o.dir || 0;
    g.save(); g.translate(x, y);
    if (o.dead) { g.rotate(Math.PI / 2 * (o.deadDir || 1)); g.translate(0, -6 * sc); }
    if (o.drunk) g.rotate(Math.sin(t * 2.3) * 0.12);
    g.scale(sc, sc);
    // shadow
    if (!o.dead) ell(g, 0, 0, 11 * wid, 4, 'rgba(0,0,0,0.28)');
    if (o.float) g.translate(0, -6 - Math.sin(t * 2) * 3);
    if (o.sit) g.translate(0, 6);
    const flip = dir === 1 ? -1 : 1; if (dir === 1) g.scale(-1, 1);
    const side = dir === 1 || dir === 2;
    const ph = o.moving ? o.walk : 0;
    const legA = Math.sin(ph) * 5, legB = -legA;
    const bob = o.moving ? Math.abs(Math.sin(ph)) * -1.5 : Math.sin(t * 2 + x) * 0.4;
    const armor = o.armor || { kind: 'none', col: '#7a6a5a', trim: '#5a4a3a' };
    const ac = armor.col, at = armor.trim;
    const robe = armor.kind === 'cloth' || o.robe;
    const skin = o.skin || SKINS[1];
    const pants = armor.kind === 'plate' ? shade(ac, -0.1) : armor.kind === 'chain' ? '#6a6a70' : armor.kind === 'leather' ? '#5a3e28' : o.pants || '#4a4a5a';
    const boots = armor.kind === 'plate' ? shade(ac, -0.25) : o.barefoot || race.barefoot ? skin : '#3a2a1e';
    // cape (behind when facing down / side)
    if (o.cape && dir !== 3) { g.fillStyle = shade(o.cape, -0.15); g.beginPath(); g.moveTo(-9 * wid, -30 + bob); g.lineTo(9 * wid, -30 + bob); g.lineTo(12 * wid + (o.moving ? Math.sin(ph) * 2 : 0), -4); g.lineTo(-12 * wid, -4); g.fill(); }
    if (o.back === 'bow' && dir !== 3) drawBow(g, -6, -26 + bob, 0.6, true);
    if (dir === 3) drawWeaponLayer(g, o, bob, side, t, true);
    // legs
    if (!o.sit && o.kick > 0) {
      const k = Math.sin(Math.min(1, o.kick) * Math.PI);
      g.fillStyle = pants; g.fillRect(-6 * wid, -16 + bob, 5 * wid, 15); g.fillStyle = boots; g.fillRect(-7 * wid, -4, 6 * wid, 4);
      g.save(); g.translate(3 * wid, -15 + bob); g.rotate(-k * (side ? 1.5 : 1.1)); g.fillStyle = pants; g.fillRect(-2.5 * wid, 0, 5 * wid, 15); g.fillStyle = boots; g.fillRect(-3 * wid, 11, 7 * wid, 5);
      if (k > 0.6) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 19, Math.PI * 0.35, Math.PI * 0.75); g.stroke(); }
      g.restore();
    } else if (!o.sit) {
      g.fillStyle = pants;
      if (side) { g.fillRect(-4 + legA * 0.6, -16 + bob, 5, 14); g.fillRect(-1 + legB * 0.6, -16 + bob, 5, 14); g.fillStyle = boots; g.fillRect(-5 + legA * 0.8, -4, 8, 4); g.fillRect(-2 + legB * 0.8, -4, 8, 4); }
      else { g.fillRect(-6 * wid, -16 + bob, 5 * wid, 15 + Math.min(0, legA * 0.4)); g.fillRect(1 * wid, -16 + bob, 5 * wid, 15 + Math.min(0, legB * 0.4)); g.fillStyle = boots; g.fillRect(-7 * wid, -4 + Math.min(0, legA * 0.4), 6 * wid, 4); g.fillRect(1 * wid, -4 + Math.min(0, legB * 0.4), 6 * wid, 4); }
    } else { g.fillStyle = pants; g.fillRect(-7 * wid, -8, 14 * wid, 6); g.fillStyle = boots; g.fillRect(-9 * wid, -4, 5, 4); g.fillRect(4 * wid, -4, 5, 4); }
    // torso
    const tw = 16 * wid, ty0 = -31 + bob;
    if (robe) {
      g.fillStyle = ac; g.beginPath(); g.moveTo(-tw / 2, ty0); g.lineTo(tw / 2, ty0); g.lineTo(tw / 2 + 4, -2 + (o.sit ? -4 : 0)); g.lineTo(-tw / 2 - 4, -2 + (o.sit ? -4 : 0)); g.closePath(); g.fill();
      g.fillStyle = shade(ac, -0.2); g.beginPath(); g.moveTo(-tw / 2 - 4, -2); g.lineTo(tw / 2 + 4, -2); g.lineTo(tw / 2 + 3, -6); g.lineTo(-tw / 2 - 3, -6); g.fill();
      g.fillStyle = at; if (!side) g.fillRect(-1.5, ty0 + 2, 3, 28); else g.fillRect(2, ty0 + 2, 2.5, 28);
      g.fillRect(-tw / 2, ty0 + 12, tw, 3);
    } else {
      g.fillStyle = ac; rr(g, -tw / 2, ty0, tw, 17, 4); g.fill();
      if (armor.kind === 'plate') {
        g.fillStyle = shade(ac, 0.3); rr(g, -tw / 2 + 2, ty0 + 1, tw - 4, 6, 3); g.fill();
        g.fillStyle = at; g.fillRect(-tw / 2, ty0 + 13, tw, 3);
        if (!side) { circ(g, -tw / 2 - 1, ty0 + 3, 5, shade(ac, 0.1)); circ(g, tw / 2 + 1, ty0 + 3, 5, shade(ac, 0.1)); g.fillStyle = at; g.fillRect(-1, ty0 + 3, 2, 9); }
        else circ(g, 1, ty0 + 3, 5.5, shade(ac, 0.1));
      } else if (armor.kind === 'chain') {
        g.fillStyle = shade(ac, -0.2); for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) g.fillRect(-tw / 2 + 2 + q * 4 + (r % 2) * 2, ty0 + 2 + r * 3.5, 1.5, 1.5);
        g.fillStyle = at; g.fillRect(-tw / 2, ty0 + 13, tw, 3); if (!side) { circ(g, -tw / 2, ty0 + 3, 4, shade(ac, 0.05)); circ(g, tw / 2, ty0 + 3, 4, shade(ac, 0.05)); }
      } else if (armor.kind === 'leather') {
        g.strokeStyle = shade(ac, -0.35); g.lineWidth = 1; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(-tw / 2 + 3, ty0 + 2); g.lineTo(-tw / 2 + 3, ty0 + 13); g.moveTo(tw / 2 - 3, ty0 + 2); g.lineTo(tw / 2 - 3, ty0 + 13); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#3a2618'; g.fillRect(-tw / 2, ty0 + 13, tw, 3); g.fillStyle = '#c8a040'; g.fillRect(-1.5, ty0 + 13, 3, 3);
      } else { g.fillStyle = shade(ac, 0.12); g.fillRect(-tw / 2, ty0 + 1, tw, 3); g.fillStyle = '#3a2618'; g.fillRect(-tw / 2, ty0 + 13, tw, 2.5); }
      if (o.bare) { g.fillStyle = skin; rr(g, -tw / 2 + 1, ty0, tw - 2, 12, 4); g.fill(); g.strokeStyle = shade(skin, -0.25); g.beginPath(); g.moveTo(0, ty0 + 3); g.lineTo(0, ty0 + 10); g.stroke(); g.fillStyle = '#6a4a2a'; g.fillRect(-tw / 2, ty0 + 2, tw, 2); }
    }
    if (o.sash) { g.fillStyle = o.sash; g.fillRect(-tw / 2, ty0 + 12, tw, 3); g.fillRect(tw / 2 - 3, ty0 + 14, 3, 8); }
    // arms
    const armSwing = o.moving ? Math.sin(ph) * 4 : 0;
    const armCol = armor.kind === 'none' || o.bare ? (o.bare ? skin : ac) : robe ? ac : shade(ac, -0.05);
    const handCol = armor.kind === 'plate' ? shade(ac, -0.1) : skin;
    const atk = o.atk || 0;
    const swingA = atk > 0 ? Math.sin(atk * Math.PI) * 1.6 - 0.4 : 0;
    // far arm (left)
    if (!side) { g.fillStyle = armCol; g.fillRect(-tw / 2 - 4, ty0 + 2 + armSwing * 0.5, 4.5, 13); circ(g, -tw / 2 - 2, ty0 + 16 + armSwing * 0.5, 2.6, handCol); }
    if (o.offhand && dir !== 3) drawOffhand(g, o, -tw / 2 - 3, ty0 + 14 + armSwing * 0.5, side, t);
    // head
    const hy = ty0 - 7;
    drawHead(g, o, race, skin, hy, side, dir, t);
    // near arm (right) with weapon
    g.save(); g.translate(side ? 1 : tw / 2 + 2, ty0 + 3);
    let armRot = -armSwing * 0.06; if (atk > 0) armRot = -swingA; if (o.cast) armRot = -1.2 + Math.sin(t * 10) * 0.15;
    g.rotate(armRot);
    g.fillStyle = armCol; g.fillRect(-2.2, -1, 4.5, 13); circ(g, 0, 13, 2.6, handCol);
    if (dir !== 3) drawWeapon(g, o.weapon, 0, 13, o, t);
    if (o.cast) { const c = o.castCol || '255,220,140'; circ(g, 0, 15, 5 + Math.sin(t * 14) * 1.5, `rgba(${c},0.55)`); circ(g, 0, 15, 2.5, `rgba(255,255,255,0.9)`); }
    g.restore();
    if (dir === 3 && o.cape) { g.fillStyle = o.cape; g.beginPath(); g.moveTo(-9 * wid, ty0 + 1); g.lineTo(9 * wid, ty0 + 1); g.lineTo(12 * wid + (o.moving ? Math.sin(ph) * 2 : 0), -3); g.lineTo(-12 * wid, -3); g.fill(); g.fillStyle = shade(o.cape, 0.15); g.fillRect(-9 * wid, ty0 + 1, 18 * wid, 3); }
    if (dir === 3 && o.back === 'bow') drawBow(g, 0, -22 + bob, 0.65, true);
    if (o.glow) { g.globalCompositeOperation = 'lighter'; circ(g, 0, -20, 22, o.glow); g.globalCompositeOperation = 'source-over'; }
    g.restore();
  };

  function drawHead(g, o, race, skin, hy, side, dir, t) {
    const hair = o.hair || HAIRS[1];
    const hs = o.hairStyle || 0;
    const fem = o.gender === 'f';
    const kind = o.kind;
    // back hair (long styles) behind head
    if ((hs === 1 || hs === 3 || fem) && !o.helm && !o.hood && kind !== 'skeleton' && kind !== 'lich') {
      g.fillStyle = hair;
      if (dir === 3) { rr(g, -8, hy - 6, 16, 18, 5); g.fill(); }
      else if (!side) { rr(g, -8.5, hy - 5, 17, hs === 3 ? 19 : 14, 5); g.fill(); }
      else { rr(g, -7, hy - 5, 9, hs === 3 ? 18 : 14, 4); g.fill(); }
    }
    // ears
    if (race.ears === 'long' || o.ears === 'long') { g.fillStyle = skin; if (!side) { g.beginPath(); g.moveTo(-6.5, hy); g.lineTo(-13, hy - 6); g.lineTo(-6, hy + 3); g.fill(); g.beginPath(); g.moveTo(6.5, hy); g.lineTo(13, hy - 6); g.lineTo(6, hy + 3); g.fill(); } else { g.beginPath(); g.moveTo(-2, hy); g.lineTo(-9, hy - 7); g.lineTo(-1, hy + 3); g.fill(); } }
    if (race.ears === 'half') { g.fillStyle = skin; if (!side) { g.beginPath(); g.moveTo(-6.5, hy - 0.5); g.lineTo(-10, hy - 3.5); g.lineTo(-6, hy + 3); g.fill(); g.beginPath(); g.moveTo(6.5, hy - 0.5); g.lineTo(10, hy - 3.5); g.lineTo(6, hy + 3); g.fill(); } else { g.beginPath(); g.moveTo(-2, hy); g.lineTo(-6, hy - 4); g.lineTo(-1, hy + 3); g.fill(); } }
    if (o.ears === 'goblin') { g.fillStyle = skin; g.beginPath(); g.moveTo(-6, hy - 1); g.lineTo(-15, hy - 3); g.lineTo(-6, hy + 3); g.fill(); g.beginPath(); g.moveTo(6, hy - 1); g.lineTo(15, hy - 3); g.lineTo(6, hy + 3); g.fill(); }
    // head
    const hr = o.headR || race.headR || 7.2;
    if (kind === 'skeleton' || kind === 'lich') {
      g.fillStyle = '#e8e2cc'; g.beginPath(); g.arc(0, hy, hr, 0, 6.28); g.fill(); g.fillRect(-4, hy + 4, 8, 4);
      if (dir !== 3) { const ec = o.eyesCol || '#7affb0'; circ(g, side ? 3 : -2.8, hy, 2.2, '#111'); if (!side) circ(g, 2.8, hy, 2.2, '#111'); circ(g, side ? 3 : -2.8, hy, 1, ec); if (!side) circ(g, 2.8, hy, 1, ec); }
    } else {
      g.fillStyle = skin; g.beginPath(); g.arc(0, hy, hr, 0, 6.28); g.fill();
      g.fillStyle = shade(skin, -0.12); g.beginPath(); g.arc(0, hy + 1.5, hr, 0.2, Math.PI - 0.2); g.fill();
      if (dir !== 3) {
        const ec = o.eyesCol || '#222';
        if (!side) { circ(g, -2.6, hy, 1.2, ec); circ(g, 2.6, hy, 1.2, ec); if (fem) { g.strokeStyle = '#222'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-4, hy - 1.5); g.lineTo(-1.5, hy - 1.8); g.moveTo(4, hy - 1.5); g.lineTo(1.5, hy - 1.8); g.stroke(); } g.fillStyle = shade(skin, -0.35); g.fillRect(-1.5, hy + 3.5, 3, 1); }
        else { circ(g, 3.5, hy - 0.5, 1.2, ec); g.fillStyle = shade(skin, -0.1); g.beginPath(); g.moveTo(6.5, hy); g.lineTo(8.5 + (race.nose ? 2.5 : 0), hy + 2); g.lineTo(6, hy + 3); g.fill(); }
        if (race.nose && !side) circ(g, 0, hy + 2, 2.2, shade(skin, -0.08));
        if (o.tusk) { g.fillStyle = '#f0ead8'; g.beginPath(); g.moveTo(-3, hy + 4); g.lineTo(-3.5, hy + 0.5); g.lineTo(-1.8, hy + 4); g.moveTo(3, hy + 4); g.lineTo(3.5, hy + 0.5); g.lineTo(1.8, hy + 4); g.fill(); }
        if (o.mask) { g.fillStyle = o.mask; g.fillRect(-7, hy + 1, 14, 6); }
        if (o.snout) { g.fillStyle = skin; g.beginPath(); g.ellipse(side ? 7 : 0, hy + 3, side ? 6 : 4, 3, 0, 0, 6.28); g.fill(); circ(g, side ? 3 : -2.6, hy - 1, 1.4, '#ffd23a'); if (!side) circ(g, 2.6, hy - 1, 1.4, '#ffd23a'); }
      }
    }
    // beard
    if ((race.beard && !fem) || o.beard) {
      g.fillStyle = o.beard || hair;
      if (!side && dir !== 3) { g.beginPath(); g.moveTo(-6.5, hy + 1); g.quadraticCurveTo(-7, hy + 12, 0, hy + 15); g.quadraticCurveTo(7, hy + 12, 6.5, hy + 1); g.quadraticCurveTo(0, hy + 6, -6.5, hy + 1); g.fill(); }
      else if (side) { g.beginPath(); g.moveTo(0, hy + 2); g.quadraticCurveTo(2, hy + 13, 7, hy + 11); g.lineTo(7, hy + 3); g.fill(); }
    }
    if (race.beard && fem && !o.helm && dir !== 3) { g.fillStyle = hair; g.fillRect(-9, hy + 2, 3, 10); g.fillRect(6, hy + 2, 3, 10); }
    // hair top
    if (!o.helm && !o.hood && !o.hat && kind !== 'skeleton' && kind !== 'lich' && hs !== 4) {
      g.fillStyle = hair;
      g.beginPath(); g.arc(0, hy - 1.5, hr + 0.6, Math.PI * (dir === 3 ? 0 : 1.05), Math.PI * (dir === 3 ? 2 : 1.95)); g.fill();
      if (dir === 3) { g.beginPath(); g.arc(0, hy, hr + 0.4, 0, 6.28); g.fill(); }
      if (hs === 2) { g.fillRect(-2, hy - hr - 4, 4, 6); }
      if (side) { g.fillRect(-hr, hy - 3, 5, 6); }
      if (race.nose) { circ(g, -7, hy - 3, 3.5, hair); circ(g, 7, hy - 3, 3.5, hair); }
    }
    // headgear
    if (o.helm) drawHelm(g, o, hy, side, dir);
    else if (o.hat) drawHat(g, o, hy, side, dir, t);
    if (o.crown) { g.fillStyle = '#f0c040'; g.fillRect(-6, hy - 10, 12, 4); for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(k * 4 - 2, hy - 10); g.lineTo(k * 4, hy - 15); g.lineTo(k * 4 + 2, hy - 10); g.fill(); } circ(g, 0, hy - 8, 1.3, '#c8302a'); }
  }
  function drawHelm(g, o, hy, side, dir) {
    const c = o.helmCol || (o.armor && o.armor.col) || '#a8acb4';
    if (o.helm === 'plate') {
      g.fillStyle = shade(c, 0.05); g.beginPath(); g.arc(0, hy - 1, 8, Math.PI, 0); g.lineTo(8, hy + 3); g.lineTo(-8, hy + 3); g.fill();
      g.fillStyle = shade(c, 0.3); g.fillRect(-6, hy - 7, 4, 2);
      if (dir !== 3) { g.fillStyle = '#1a1a1a'; if (!side) g.fillRect(-5, hy - 0.5, 10, 2); else g.fillRect(2, hy - 0.5, 6, 2); g.fillStyle = c; if (!side) g.fillRect(-1, hy - 1, 2, 6); }
      if (o.helmSpike) { g.fillStyle = shade(c, -0.2); g.beginPath(); g.moveTo(-2, hy - 8); g.lineTo(0, hy - 15); g.lineTo(2, hy - 8); g.fill(); }
      if (o.helmPlume) { g.fillStyle = o.helmPlume; g.beginPath(); g.ellipse(side ? -3 : 0, hy - 11, 3, 6, side ? -0.6 : 0, 0, 6.28); g.fill(); }
      if (o.horns) { g.fillStyle = '#e8dcc0'; g.beginPath(); g.moveTo(-7, hy - 3); g.quadraticCurveTo(-14, hy - 8, -12, hy - 15); g.lineTo(-6, hy - 6); g.fill(); g.beginPath(); g.moveTo(7, hy - 3); g.quadraticCurveTo(14, hy - 8, 12, hy - 15); g.lineTo(6, hy - 6); g.fill(); }
    } else if (o.helm === 'chain') { g.fillStyle = '#8a8a92'; g.beginPath(); g.arc(0, hy, 8.2, Math.PI * 0.9, Math.PI * 2.1); g.lineTo(7, hy + 6); g.lineTo(-7, hy + 6); g.fill(); if (dir !== 3) { g.fillStyle = o.skin || '#e2b48e'; g.beginPath(); g.ellipse(side ? 3 : 0, hy + 1, side ? 4 : 5, 5, 0, 0, 6.28); g.fill(); circ(g, side ? 4 : -2.4, hy, 1.1, '#222'); if (!side) circ(g, 2.4, hy, 1.1, '#222'); } }
    else { g.fillStyle = c; g.beginPath(); g.arc(0, hy - 1, 7.8, Math.PI, 0); g.fill(); g.fillRect(-8, hy - 2, 16, 2); }
  }
  function drawHat(g, o, hy, side, dir, t) {
    const c = o.hatCol || '#3a3a6a', tr = o.hatTrim || '#e0c050';
    switch (o.hat) {
      case 'wizard': g.fillStyle = c; g.beginPath(); g.ellipse(0, hy - 4, 12, 3.5, 0, 0, 6.28); g.fill(); g.beginPath(); g.moveTo(-7, hy - 5); g.quadraticCurveTo(-2, hy - 20, side ? -8 : 5, hy - 26); g.lineTo(7, hy - 5); g.fill(); g.fillStyle = tr; g.fillRect(-7, hy - 7, 14, 2); circ(g, -1, hy - 14, 1.3, tr); circ(g, 2, hy - 10, 1, tr); break;
      case 'hood': g.fillStyle = c; g.beginPath(); g.arc(0, hy - 0.5, 9, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(8, hy + 7); g.lineTo(-8, hy + 7); g.fill(); if (dir !== 3) { g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.ellipse(side ? 3 : 0, hy + 1.5, side ? 4 : 5.5, 5.5, 0, 0, 6.28); g.fill(); circ(g, side ? 4 : -2.3, hy + 0.5, 1, o.eyesCol || '#e8e0d0'); if (!side) circ(g, 2.3, hy + 0.5, 1, o.eyesCol || '#e8e0d0'); } if (o.hoodPoint) { g.beginPath(); g.moveTo(-4, hy - 8); g.lineTo(side ? -10 : 0, hy - 15); g.lineTo(4, hy - 8); g.fill(); } break;
      case 'feather': g.fillStyle = c; g.beginPath(); g.ellipse(0, hy - 5, 11, 3.5, 0, 0, 6.28); g.fill(); rr(g, -6, hy - 12, 12, 8, 3); g.fill(); g.fillStyle = tr; g.fillRect(-6, hy - 7, 12, 2); g.strokeStyle = '#e8e8e8'; g.lineWidth = 2; g.beginPath(); g.moveTo(4, hy - 9); g.quadraticCurveTo(12, hy - 18, 16, hy - 22); g.stroke(); break;
      case 'circlet': g.fillStyle = o.hair || '#5a3a22'; g.beginPath(); g.arc(0, hy - 1.5, 7.8, Math.PI * 1.05, Math.PI * 1.95); g.fill(); g.fillStyle = tr; g.fillRect(-7.5, hy - 4.5, 15, 2); circ(g, 0, hy - 4, 1.8, '#c06aff'); break;
      case 'headband': g.fillStyle = o.hair || '#2a1e16'; g.beginPath(); g.arc(0, hy - 1.5, 7.8, Math.PI * 1.05, Math.PI * 1.95); g.fill(); g.fillStyle = c; g.fillRect(-7.5, hy - 4, 15, 2.5); if (dir !== 0) { g.fillRect(-9, hy - 3, 3, 8); } break;
      case 'mitre': g.fillStyle = c; g.beginPath(); g.moveTo(-6, hy - 4); g.lineTo(-5, hy - 14); g.lineTo(0, hy - 19); g.lineTo(5, hy - 14); g.lineTo(6, hy - 4); g.fill(); g.fillStyle = tr; g.fillRect(-1, hy - 17, 2, 13); g.fillRect(-4, hy - 12, 8, 2); break;
      case 'leafcrown': g.fillStyle = o.hair || '#5a3a22'; g.beginPath(); g.arc(0, hy - 1.5, 7.8, Math.PI * 1.05, Math.PI * 1.95); g.fill(); for (let k = -3; k <= 3; k++) { g.fillStyle = k % 2 ? '#5a9a3a' : '#3a7a2a'; g.beginPath(); g.ellipse(k * 2.3, hy - 7, 1.8, 3.5, k * 0.25, 0, 6.28); g.fill(); } break;
      case 'skullmask': g.fillStyle = c; g.beginPath(); g.arc(0, hy - 0.5, 8.6, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(8, hy + 7); g.lineTo(-8, hy + 7); g.fill(); if (dir !== 3) { g.fillStyle = '#e8e2cc'; g.beginPath(); g.ellipse(side ? 3 : 0, hy + 1, side ? 4 : 5, 5, 0, 0, 6.28); g.fill(); circ(g, side ? 4 : -2, hy, 1.4, '#111'); if (!side) circ(g, 2, hy, 1.4, '#111'); } break;
      case 'fur': g.fillStyle = c; g.beginPath(); g.arc(0, hy - 1, 9, Math.PI * 0.9, Math.PI * 2.1); g.fill(); circ(g, -6, hy - 7, 3, shade(c, -0.15)); circ(g, 6, hy - 7, 3, shade(c, -0.15)); if (dir !== 3 && !side) { circ(g, -2.5, hy - 4, 1, '#111'); circ(g, 2.5, hy - 4, 1, '#111'); } break;
      case 'bonemask': g.fillStyle = o.hair || '#2a1e16'; g.beginPath(); g.arc(0, hy - 1.5, 7.8, Math.PI * 1.05, Math.PI * 1.95); g.fill(); if (dir !== 3) { g.fillStyle = '#e8dcc0'; g.beginPath(); g.moveTo(-6, hy - 3); g.lineTo(6, hy - 3); g.lineTo(4, hy + 5); g.lineTo(-4, hy + 5); g.fill(); g.fillStyle = '#7a2a1a'; g.fillRect(-3.5, hy - 1, 2, 2); g.fillRect(1.5, hy - 1, 2, 2); } g.fillStyle = '#c8402a'; g.beginPath(); g.moveTo(5, hy - 6); g.lineTo(11, hy - 14); g.lineTo(7, hy - 4); g.fill(); break;
      case 'bandana': g.fillStyle = o.hair || '#2a1e16'; g.beginPath(); g.arc(0, hy - 1.5, 7.8, Math.PI * 1.05, Math.PI * 1.95); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(0, hy - 2, 7.9, Math.PI, 0); g.fill(); break;
      case 'strawhat': g.fillStyle = '#d8b878'; g.beginPath(); g.ellipse(0, hy - 5, 12, 3.5, 0, 0, 6.28); g.fill(); rr(g, -6, hy - 11, 12, 7, 3); g.fill(); break;
      case 'chef': g.fillStyle = '#f4f2ec'; g.fillRect(-6, hy - 10, 12, 6); circ(g, -3, hy - 12, 4, '#f4f2ec'); circ(g, 3, hy - 12, 4, '#f4f2ec'); circ(g, 0, hy - 14, 4, '#f4f2ec'); break;
    }
  }
  function drawWeapon(g, wt, hx, hy, o, t, fxArg) {
    if (!wt) return;
    const fx = fxArg !== undefined ? fxArg : o && o.wfx;
    g.save(); g.translate(hx, hy);
    const metal = '#d4d8de', dark = '#4a3a2a';
    switch (wt) {
      case '1HS': g.fillStyle = dark; g.fillRect(-1.5, -2, 3, 6); g.fillStyle = '#c8a040'; g.fillRect(-5, -3, 10, 2); g.fillStyle = metal; g.beginPath(); g.moveTo(-2, -3); g.lineTo(-2, -22); g.lineTo(0, -26); g.lineTo(2, -22); g.lineTo(2, -3); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-0.5, -22, 1, 18); break;
      case '2HS': g.fillStyle = dark; g.fillRect(-1.5, -4, 3, 12); g.fillStyle = '#c8a040'; g.fillRect(-6, -5, 12, 2.5); g.fillStyle = metal; g.beginPath(); g.moveTo(-2.5, -5); g.lineTo(-2.5, -34); g.lineTo(0, -38); g.lineTo(2.5, -34); g.lineTo(2.5, -5); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-0.5, -34, 1, 28); break;
      case 'axe': case '2HSaxe': g.fillStyle = dark; g.fillRect(-1.5, -26, 3, 32); g.fillStyle = metal; g.beginPath(); g.moveTo(1, -26); g.quadraticCurveTo(12, -28, 12, -18); g.quadraticCurveTo(8, -16, 1, -18); g.fill(); break;
      case '1HB': case 'mace': case 'club': g.fillStyle = dark; g.fillRect(-1.5, -18, 3, 22); if (wt === 'club') { g.fillStyle = '#7a5530'; g.beginPath(); g.ellipse(0, -22, 4.5, 8, 0, 0, 6.28); g.fill(); } else { circ(g, 0, -21, 5, '#9a9ea6'); g.fillStyle = '#cfd3da'; for (let k = 0; k < 6; k++) { const a = k * 1.047; g.fillRect(Math.cos(a) * 5 - 1, -21 + Math.sin(a) * 5 - 1, 2, 2); } } break;
      case '2HB': if (o && (o.cls === 'wizard' || o.cls === 'enchanter' || o.cls === 'magician' || o.cls === 'necromancer' || o.cls === 'druid' || o.cls === 'shaman' || o.cls === 'cleric' || o.staff)) {
          g.fillStyle = '#6a4a2a'; g.fillRect(-1.5, -40, 3, 48); const col = o.orb || '#8ad0ff'; const a = 0.6 + Math.sin(t * 3) * 0.3; circ(g, 0, -43, 6, `rgba(255,255,255,0.15)`); circ(g, 0, -43, 4, col); g.globalAlpha = a; circ(g, 0, -43, 8, col); g.globalAlpha = 1; g.strokeStyle = '#8a6a3a'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, -43, 5, 0.3, 2.8); g.stroke();
        } else { g.fillStyle = dark; g.fillRect(-1.5, -30, 3, 36); g.fillStyle = '#8a8e96'; g.fillRect(-7, -38, 14, 10); g.fillStyle = '#b4b8c0'; g.fillRect(-7, -38, 14, 3); } break;
      case '1HP': case 'dagger': case 'spear': if (wt === 'spear') { g.fillStyle = dark; g.fillRect(-1, -36, 2, 44); g.fillStyle = metal; g.beginPath(); g.moveTo(-3, -36); g.lineTo(0, -46); g.lineTo(3, -36); g.fill(); break; } g.fillStyle = dark; g.fillRect(-1.2, -1, 2.4, 5); g.fillStyle = '#a08030'; g.fillRect(-3.5, -2, 7, 1.5); g.fillStyle = metal; g.beginPath(); g.moveTo(-1.5, -2); g.lineTo(0, -14); g.lineTo(1.5, -2); g.fill(); break;
      case 'H2H': g.fillStyle = '#e8e0d0'; g.fillRect(-3, -2, 6, 4); break;
      case 'ARC': drawBow(g, 0, -4, 1, false); break;
      case 'THR': g.fillStyle = metal; g.beginPath(); g.moveTo(-1, 0); g.lineTo(0, -8); g.lineTo(1, 0); g.fill(); break;
      case 'TOME': { g.fillStyle = o && o.tomeCol || '#6a3a8a'; g.fillRect(-6, -6, 12, 9); g.fillStyle = '#efe3c8'; g.fillRect(-5, -5, 10, 1.5); const a = 0.5 + Math.sin(t * 4) * 0.4; g.fillStyle = `rgba(200,170,255,${a})`; g.font = '7px serif'; g.fillText('✦', -3, -10 - Math.sin(t * 3) * 2); break; }
      case 'sword': drawWeapon(g, '1HS', 0, 0, o, t, null); break;
    }
    if (fx) weaponFx(g, wt, fx, t, o && o.cls);
    g.restore();
  }
  const BLADE = { '1HS': 26, '2HS': 38, axe: 28, '2HSaxe': 28, '1HB': 24, mace: 24, club: 28, '2HB': 44, '1HP': 14, dagger: 14, spear: 46, H2H: 5, ARC: 22, THR: 8, TOME: 10 };
  const FXCOL = { fire: ['255,140,40', '255,220,90'], frost: ['120,200,255', '230,250,255'], poison: ['90,230,60', '180,255,120'], shadow: ['60,255,110', '170,255,190'], storm: ['140,170,255', '240,245,255'], holy: ['255,220,110', '255,250,210'], nature: ['110,210,80', '210,255,150'] };
  function weaponFx(g, wt, fx, t, cls) {
    const L = BLADE[wt] || 20; const [c1, c2] = FXCOL[fx] || FXCOL.holy;
    g.save(); g.globalCompositeOperation = 'lighter';
    const top = wt === 'ARC' ? -4 : -L, mid = top / 2;
    // aura along the blade
    const gr = g.createLinearGradient(0, 0, 0, top); gr.addColorStop(0, `rgba(${c1},0.05)`); gr.addColorStop(0.6, `rgba(${c1},${fx === 'shadow' ? 0.5 : 0.35})`); gr.addColorStop(1, `rgba(${c2},0.15)`);
    g.strokeStyle = gr; g.lineCap = 'round'; g.lineWidth = fx === 'shadow' ? 8 + Math.sin(t * 5) * 1.5 : 6; g.beginPath(); g.moveTo(0, -3); g.lineTo(0, top); g.stroke();
    if (fx === 'fire') { for (let k = 0; k < 7; k++) { const ph = (t * 2.2 + k * 0.37) % 1; const y = -3 + (top + 3) * (k / 6) - ph * 8; const r = 2.6 * (1 - ph) + 0.6; circ(g, Math.sin(t * 9 + k * 2) * 2.2, y, r + 1.4, `rgba(${c1},${0.35 * (1 - ph)})`); circ(g, Math.sin(t * 9 + k * 2) * 1.6, y, r * 0.6, `rgba(${c2},${0.7 * (1 - ph)})`); } }
    else if (fx === 'poison') { for (let k = 0; k < 3; k++) { const ph = (t * 0.9 + k * 0.33) % 1; const y0 = top * (0.35 + k * 0.22); const y = y0 + ph * 18; circ(g, (k - 1) * 1.6, y, 1.6 * (1 - ph * 0.4), `rgba(${c1},${0.9 * (1 - ph)})`); circ(g, (k - 1) * 1.6, y0, 1.2, `rgba(${c2},0.6)`); } }
    else if (fx === 'shadow') { for (let k = 0; k < 4; k++) { const ph = (t * 0.7 + k * 0.25) % 1; circ(g, Math.sin(t * 3 + k) * 4, top * (k / 4) - ph * 10, 1.8 * (1 - ph), `rgba(${c2},${0.6 * (1 - ph)})`); } }
    else if (fx === 'frost') { for (let k = 0; k < 4; k++) { const ph = (t * 1.3 + k * 0.25) % 1; const y = top * ((k + 0.5) / 4); g.fillStyle = `rgba(${c2},${0.9 * Math.sin(ph * Math.PI)})`; g.fillRect(Math.sin(k * 3.1) * 3 - 0.8, y - 0.8, 1.6, 1.6); } }
    else if (fx === 'storm') { if (Math.sin(t * 13) > -0.2) { g.strokeStyle = `rgba(${c2},0.85)`; g.lineWidth = 1; g.beginPath(); let x = 0; g.moveTo(0, -2); for (let k = 1; k <= 5; k++) { x = (Math.random() - 0.5) * 6; g.lineTo(x, top * (k / 5)); } g.stroke(); } }
    else if (fx === 'holy') { circ(g, 0, top, 4 + Math.sin(t * 4), `rgba(${c2},0.45)`); for (let k = 0; k < 3; k++) { const a = t * 2 + k * 2.1; circ(g, Math.cos(a) * 5, mid + Math.sin(a) * 5, 1.1, `rgba(${c2},0.8)`); } }
    else if (fx === 'nature') { for (let k = 0; k < 3; k++) { const a = t * 1.6 + k * 2.1; g.fillStyle = `rgba(${c1},0.75)`; g.beginPath(); g.ellipse(Math.cos(a) * 5, mid + Math.sin(a) * 7, 2.2, 1.1, a, 0, 6.28); g.fill(); } }
    g.restore();
  }
  function drawBow(g, x, y, s, back) { g.save(); g.translate(x, y); g.scale(s, s); if (back) g.rotate(0.5); g.strokeStyle = '#6a4a2a'; g.lineWidth = 2.5; g.beginPath(); g.arc(-8, -6, 16, -1.1, 1.1); g.stroke(); g.strokeStyle = '#e8e0d0'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-8 + Math.cos(-1.1) * 16, -6 + Math.sin(-1.1) * 16); g.lineTo(-8 + Math.cos(1.1) * 16, -6 + Math.sin(1.1) * 16); g.stroke(); g.restore(); }
  function drawOffhand(g, o, x, y, side, t) {
    if (o.offhand === 'shield') {
      const c = o.shieldCol || '#7a5530', e = o.shieldEmb || '#c8a040';
      g.save(); g.translate(side ? -2 : x - 2, y - 6);
      if (side) { g.fillStyle = shade(c, -0.2); g.fillRect(-3, -8, 4, 18); }
      else { g.fillStyle = c; g.beginPath(); g.moveTo(-7, -9); g.lineTo(7, -9); g.lineTo(7, 2); g.quadraticCurveTo(0, 12, -7, 2); g.closePath(); g.fill(); g.strokeStyle = '#c8ccd2'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = e; g.beginPath(); g.arc(0, -2, 3, 0, 6.28); g.fill(); }
      g.restore();
    } else if (o.offhand) { g.save(); g.translate(x, y); if (!side) drawWeapon(g, o.offhand, 0, 0, o, t, o.offFx || null); g.restore(); }
  }
  function drawWeaponLayer(g, o, bob, side, t) { g.save(); g.translate(8, -28 + bob); drawWeapon(g, o.weapon, 0, 13, o, t); g.restore(); }

  // ---------- item icons (drawn to look like the item) ----------
  const iconCache = new Map();
  const METAL = ['#8f8478', '#aeb3bb', '#cfd5dd', '#e2c25a', '#8fd8ea', '#c9a8ff'];
  const LEATHER = ['#8a5a32', '#7a4a28', '#6b3c22', '#4f5a36', '#7a2a24', '#34344a'];
  const CLOTH = ['#cbb994', '#5f72c4', '#8848c4', '#2f58b8', '#c44a8a', '#2a2458'];
  const CHAIN = ['#7e8288', '#9a9ea6', '#b6bac2', '#c8b070', '#8ac8d8', '#b8a0e8'];
  S.itemIcon = function (it) {
    const tier = Math.min(5, it.tier || 0);
    const key = [it.kind, it.wt, it.ak, it.slot, tier, it.fx, it.unique ? 1 : 0, it.shield ? 1 : 0, it.axe ? 1 : 0, it.club ? 1 : 0, it.wood ? 1 : 0, it.sig ? 1 : 0, sub(it)].join('|');
    if (iconCache.has(key)) return iconCache.get(key);
    const cv = document.createElement('canvas'); cv.width = cv.height = 48; const g = cv.getContext('2d');
    try { drawIcon(g, it, tier); } catch (e) { return null; }
    const url = cv.toDataURL(); iconCache.set(key, url); return url;
  };
  function sub(it) { const n = it.name || ''; if (it.kind !== 'weapon') return ''; if (/Axe|Cleaver|Executioner|Hatchet/.test(n) || it.axe) return 'axe'; if (/Club|Cudgel/.test(n) || it.club) return 'club'; if (/Hammer|Maul|Sunhammer|Warhammer/.test(n)) return 'hammer'; if (/Staff/.test(n)) return 'staff'; if (/Shuriken|Chakram|Starblade|Disc|Star/.test(n)) return 'star'; if (/Spear|Pike/.test(n)) return 'spear'; return ''; }
  function drawIcon(g, it, tier) {
    const m = METAL[tier], dk = '#2a1c12';
    g.translate(24, 24); g.lineJoin = 'round'; g.lineCap = 'round';
    const glow = it.unique ? '200,140,255' : it.fx ? { fire: '255,140,40', frost: '120,200,255', poison: '90,230,60', shadow: '60,255,110', storm: '150,180,255', holy: '255,220,110', nature: '120,210,80' }[it.fx] : it.sig ? '255,190,80' : null;
    if (glow) { const gr = g.createRadialGradient(0, 0, 2, 0, 0, 24); gr.addColorStop(0, `rgba(${glow},0.55)`); gr.addColorStop(1, `rgba(${glow},0)`); g.fillStyle = gr; g.fillRect(-24, -24, 48, 48); }
    const outline = (fn, w = 2.2) => { g.save(); g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = w; fn(true); g.restore(); fn(false); };
    if (it.kind === 'weapon') {
      const s = sub(it);
      g.rotate(-Math.PI / 4);
      switch (it.wt) {
        case '1HS': case '2HS': {
          if (s === 'axe') { blade(g, () => { g.fillStyle = '#6a4626'; g.fillRect(-1.8, -20, 3.6, 38); }); g.fillStyle = m; g.strokeStyle = '#111'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(1, -18); g.quadraticCurveTo(15, -22, 14, -6); g.quadraticCurveTo(8, -9, 1, -8); g.closePath(); g.fill(); g.stroke(); if (it.wt === '2HS') { g.beginPath(); g.moveTo(-1, -18); g.quadraticCurveTo(-15, -22, -14, -6); g.quadraticCurveTo(-8, -9, -1, -8); g.closePath(); g.fill(); g.stroke(); } break; }
          const L = it.wt === '2HS' ? 34 : 26, W = it.wt === '2HS' ? 3.8 : 3;
          g.fillStyle = m; g.strokeStyle = '#111'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-W, 8); g.lineTo(-W, 8 - L); g.lineTo(0, 8 - L - 6); g.lineTo(W, 8 - L); g.lineTo(W, 8); g.closePath(); g.fill(); g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(-0.6, 6 - L, 1.2, L - 4);
          g.fillStyle = tier >= 3 ? '#e2c25a' : '#a07a3a'; g.fillRect(-9, 8, 18, 3.4); g.strokeRect(-9, 8, 18, 3.4);
          g.fillStyle = '#5a3a20'; g.fillRect(-2, 11.4, 4, 8); circ(g, 0, 21, 2.8, tier >= 3 ? '#e2c25a' : '#a07a3a'); break; }
        case '1HB': case '2HB': {
          if (s === 'staff' || (it.wt === '2HB' && s !== 'hammer')) { g.fillStyle = '#7a5530'; g.strokeStyle = '#111'; g.lineWidth = 1; g.fillRect(-2, -20, 4, 42); g.strokeRect(-2, -20, 4, 42); const oc = ['#8ad0ff', '#7affc8', '#c8a8ff', '#ffb84a', '#ff6a8a', '#ffffff'][tier]; circ(g, 0, -21, 6, oc); circ(g, -1.6, -23, 2, 'rgba(255,255,255,0.8)'); g.strokeStyle = '#c8a060'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, -21, 7, 0.4, 2.7); g.stroke(); break; }
          if (s === 'club') { g.fillStyle = '#7a5530'; g.strokeStyle = '#111'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-2, 20); g.lineTo(-6, -14); g.quadraticCurveTo(0, -24, 6, -14); g.lineTo(2, 20); g.closePath(); g.fill(); g.stroke(); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 3; k++) g.fillRect(-3 + k * 2, -12 + k * 6, 2, 3); break; }
          g.fillStyle = '#5a3a20'; g.fillRect(-1.8, -8, 3.6, 30);
          if (s === 'hammer' || it.wt === '2HB') { g.fillStyle = m; g.strokeStyle = '#111'; g.lineWidth = 1.2; g.fillRect(-10, -18, 20, 11); g.strokeRect(-10, -18, 20, 11); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-10, -18, 20, 2.5); }
          else { circ(g, 0, -12, 7.5, '#111'); circ(g, 0, -12, 6.5, m); g.fillStyle = m; for (let k = 0; k < 6; k++) { const a = k * 1.047; g.save(); g.translate(Math.cos(a) * 7, -12 + Math.sin(a) * 7); g.rotate(a); g.fillRect(-1, -2.5, 4, 5); g.restore(); } circ(g, -2, -14, 2, 'rgba(255,255,255,0.6)'); }
          break; }
        case '1HP': { g.fillStyle = m; g.strokeStyle = '#111'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-3, 4); g.lineTo(0, -20); g.lineTo(3, 4); g.closePath(); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-0.5, -16, 1, 18); g.fillStyle = '#a07a3a'; g.fillRect(-7, 4, 14, 3); g.fillStyle = '#4a2a18'; g.fillRect(-1.8, 7, 3.6, 9); circ(g, 0, 17, 2.4, '#a07a3a'); if (it.fx === 'poison') { circ(g, 0, -10, 2, 'rgba(90,230,60,0.9)'); circ(g, 1, -4, 1.5, 'rgba(90,230,60,0.8)'); } break; }
        case 'H2H': { g.rotate(Math.PI / 4); g.fillStyle = it.tier >= 2 ? m : '#e6dcc4'; g.strokeStyle = '#111'; g.lineWidth = 1.2; rr(g, -11, -8, 22, 16, 5); g.fill(); g.stroke(); g.fillStyle = 'rgba(0,0,0,0.2)'; for (let k = 0; k < 3; k++) g.fillRect(-6 + k * 5, -8, 1.2, 9); if (it.tier >= 3) { g.fillStyle = '#eee'; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-9 + k * 6, -8); g.lineTo(-7 + k * 6, -16); g.lineTo(-5 + k * 6, -8); g.fill(); } } break; }
        case 'ARC': { g.rotate(Math.PI / 4); g.strokeStyle = '#111'; g.lineWidth = 5; g.beginPath(); g.arc(-10, 0, 20, -1.05, 1.05); g.stroke(); g.strokeStyle = tier >= 4 ? '#e2c25a' : '#8a5a30'; g.lineWidth = 3.2; g.beginPath(); g.arc(-10, 0, 20, -1.05, 1.05); g.stroke(); g.strokeStyle = '#eee'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-10 + Math.cos(-1.05) * 20, Math.sin(-1.05) * 20); g.lineTo(-10 + Math.cos(1.05) * 20, Math.sin(1.05) * 20); g.stroke(); g.strokeStyle = '#6a4a2a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-1, 0); g.lineTo(18, 0); g.stroke(); g.fillStyle = m; g.beginPath(); g.moveTo(18, -3); g.lineTo(22, 0); g.lineTo(18, 3); g.fill(); break; }
        case 'THR': { g.rotate(Math.PI / 4); if (s === 'star') { g.fillStyle = m; g.strokeStyle = '#111'; g.lineWidth = 1.2; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? 5 : 15; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); circ(g, 0, 0, 2.5, '#333'); } else for (let k = -1; k <= 1; k++) { g.save(); g.translate(k * 7, 2); g.rotate(-0.5 + k * 0.25); g.fillStyle = m; g.strokeStyle = '#111'; g.lineWidth = 1; g.beginPath(); g.moveTo(-2.4, 4); g.lineTo(0, -14); g.lineTo(2.4, 4); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#5a3a20'; g.fillRect(-1.5, 4, 3, 7); g.restore(); } break; }
        case 'TOME': { g.rotate(Math.PI / 4); const bc = ['#6a3a8a', '#3a5a9a', '#8a2a2a', '#2a6a5a', '#9a7a2a', '#2a2a4a'][tier]; g.fillStyle = '#111'; rr(g, -13, -16, 26, 32, 3); g.fill(); g.fillStyle = bc; rr(g, -12, -15, 24, 30, 3); g.fill(); g.fillStyle = '#efe3c8'; g.fillRect(9, -13, 2.5, 26); g.strokeStyle = '#e2c25a'; g.lineWidth = 1.4; g.strokeRect(-9, -12, 16, 24); g.fillStyle = '#e2c25a'; g.font = 'bold 13px serif'; g.textAlign = 'center'; g.fillText('✦', -1, 5); break; }
      }
      return;
    }
    if (it.kind === 'armor' && it.shield) {
      const wood = it.wood || tier === 0; const fc = wood ? '#8a5a2e' : ['#7a5530', '#7a2a2a', '#28457a', '#2e6a3c', '#5a2a6a', '#c8a040'][tier];
      if (tier === 0 && !it.wood) { circ(g, 0, 0, 17, '#111'); circ(g, 0, 0, 16, fc); g.strokeStyle = METAL[1]; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 14.5, 0, 6.28); g.stroke(); circ(g, 0, 0, 4, METAL[2]); return; }
      g.fillStyle = '#111'; g.beginPath(); g.moveTo(-16, -18); g.lineTo(16, -18); g.lineTo(16, 0); g.quadraticCurveTo(0, 24, -16, 0); g.closePath(); g.fill();
      g.fillStyle = fc; g.beginPath(); g.moveTo(-14.5, -16.5); g.lineTo(14.5, -16.5); g.lineTo(14.5, 0); g.quadraticCurveTo(0, 21, -14.5, 0); g.closePath(); g.fill();
      if (wood) { g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * 6, -16); g.lineTo(k * 6, 10 - Math.abs(k) * 3); g.stroke(); } }
      else { g.strokeStyle = METAL[Math.min(5, tier + 1)]; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-14.5, -16.5); g.lineTo(14.5, -16.5); g.lineTo(14.5, 0); g.quadraticCurveTo(0, 21, -14.5, 0); g.closePath(); g.stroke(); g.fillStyle = METAL[3]; g.beginPath(); g.moveTo(0, -11); g.lineTo(6, -2); g.lineTo(0, 8); g.lineTo(-6, -2); g.closePath(); g.fill(); }
      circ(g, 0, -3, 2.5, METAL[2]); return;
    }
    if (it.kind === 'armor') {
      const ak = it.ak; const col = ak === 'plate' ? m : ak === 'chain' ? CHAIN[tier] : ak === 'leather' ? LEATHER[tier] : it.fx === 'fire' ? '#d0401a' : it.fx === 'storm' ? '#4a6ab0' : CLOTH[tier];
      const trim = ak === 'cloth' ? '#e2c25a' : ak === 'leather' ? '#3a2414' : tier >= 3 ? '#e2c25a' : '#5a5e66';
      g.strokeStyle = '#111'; g.lineWidth = 1.4; g.fillStyle = col;
      const P = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); g.stroke(); };
      switch (it.slot) {
        case 'head':
          if (ak === 'plate') { g.beginPath(); g.moveTo(-13, 14); g.lineTo(-13, -4); g.quadraticCurveTo(-13, -18, 0, -18); g.quadraticCurveTo(13, -18, 13, -4); g.lineTo(13, 14); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#111'; g.fillRect(-10, -3, 20, 3); g.fillRect(-1.2, 0, 2.4, 10); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-9, -15, 4, 10); if (tier >= 3) { g.fillStyle = '#c03030'; g.beginPath(); g.moveTo(0, -18); g.quadraticCurveTo(12, -26, 16, -16); g.quadraticCurveTo(8, -20, 0, -16); g.fill(); } }
          else if (ak === 'chain') { g.beginPath(); g.arc(0, -2, 14, Math.PI, 0); g.lineTo(14, 14); g.lineTo(7, 14); g.lineTo(7, 2); g.lineTo(-7, 2); g.lineTo(-7, 14); g.lineTo(-14, 14); g.closePath(); g.fill(); g.stroke(); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = -12; y < 12; y += 3) for (let x = -12; x < 12; x += 3) if ((x + y) % 2 === 0 && (y < 1 || Math.abs(x) > 7)) g.fillRect(x, y, 1.2, 1.2); }
          else if (ak === 'leather') { g.beginPath(); g.moveTo(-14, 6); g.quadraticCurveTo(-14, -16, 0, -16); g.quadraticCurveTo(14, -16, 14, 6); g.lineTo(18, 8); g.lineTo(-18, 8); g.closePath(); g.fill(); g.stroke(); g.strokeStyle = trim; g.beginPath(); g.moveTo(0, -16); g.lineTo(0, 6); g.stroke(); }
          else { g.beginPath(); g.moveTo(-15, 16); g.quadraticCurveTo(-16, -6, 0, -18); g.quadraticCurveTo(16, -6, 15, 16); g.lineTo(9, 16); g.quadraticCurveTo(8, 0, 0, -2); g.quadraticCurveTo(-8, 0, -9, 16); g.closePath(); g.fill(); g.stroke(); g.strokeStyle = trim; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-9, 16); g.quadraticCurveTo(-8, 0, 0, -2); g.quadraticCurveTo(8, 0, 9, 16); g.stroke(); }
          break;
        case 'chest':
          if (ak === 'cloth') { P([[-8, -17], [8, -17], [16, -10], [13, -4], [10, -7], [12, 18], [-12, 18], [-10, -7], [-13, -4], [-16, -10]]); g.strokeStyle = trim; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -15); g.lineTo(0, 18); g.stroke(); g.fillStyle = trim; g.fillRect(-10, 2, 20, 2.5); }
          else { P([[-8, -17], [8, -17], [17, -11], [14, -3], [11, -5], [11, 16], [-11, 16], [-11, -5], [-14, -3], [-17, -11]]);
            if (ak === 'plate') { g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(-8, -12, 5, 18); g.strokeStyle = '#333'; g.beginPath(); g.moveTo(0, -15); g.lineTo(0, 15); g.moveTo(-11, 3); g.quadraticCurveTo(0, 8, 11, 3); g.stroke(); circ(g, -14, -10, 4, col); circ(g, 14, -10, 4, col); }
            else if (ak === 'chain') { g.fillStyle = 'rgba(0,0,0,0.28)'; for (let y = -14; y < 15; y += 3) for (let x = -10; x < 11; x += 3) if ((x + y) % 2 === 0) g.fillRect(x, y, 1.3, 1.3); g.fillStyle = trim; g.fillRect(-11, 12, 22, 3); }
            else { g.strokeStyle = trim; g.lineWidth = 1.2; g.beginPath(); for (let y = -10; y < 12; y += 4) { g.moveTo(-3, y); g.lineTo(3, y + 2); g.moveTo(3, y); g.lineTo(-3, y + 2); } g.stroke(); g.fillStyle = '#3a2414'; g.fillRect(-11, 4, 22, 3); } }
          break;
        case 'hands': P([[-9, 16], [-9, -2], [-12, -8], [-9, -10], [-6, -4], [-6, -16], [-3, -17], [-2, -6], [0, -18], [3, -17], [3, -6], [5, -15], [8, -14], [7, -4], [9, -12], [12, -11], [10, 4], [9, 16]]); g.fillStyle = trim; g.fillRect(-10, 10, 20, 4); break;
        case 'legs': P([[-12, -16], [12, -16], [12, 16], [3, 16], [1, -4], [-1, -4], [-3, 16], [-12, 16]]); g.fillStyle = trim; g.fillRect(-12, -16, 24, 4); if (ak === 'plate') { circ(g, -7, 2, 3, 'rgba(255,255,255,0.35)'); circ(g, 7, 2, 3, 'rgba(255,255,255,0.35)'); } break;
        case 'back': P([[-9, -17], [9, -17], [12, -12], [17, 16], [8, 13], [0, 17], [-8, 13], [-17, 16], [-12, -12]]); g.fillStyle = trim; g.fillRect(-10, -17, 20, 4); circ(g, -8, -15, 2.5, '#e2c25a'); circ(g, 8, -15, 2.5, '#e2c25a'); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(-4, -12); g.lineTo(-7, 14); g.moveTo(4, -12); g.lineTo(7, 14); g.stroke(); if (it.fx === 'fire') { for (let k = 0; k < 5; k++) circ(g, -12 + k * 6, 14 - (k % 2) * 3, 3, 'rgba(255,190,60,0.85)'); } break;
        case 'waist': g.fillStyle = it.tier >= 3 ? '#6a4a8a' : LEATHER[tier]; rr(g, -20, -5, 40, 10, 3); g.fill(); g.stroke(); g.fillStyle = METAL[Math.max(2, tier)]; rr(g, -7, -8, 14, 16, 2); g.fill(); g.stroke(); g.fillStyle = '#111'; g.fillRect(-3, -4, 6, 8); g.fillStyle = METAL[3]; g.fillRect(-1, -4, 2, 8); if (it.haste) { g.strokeStyle = 'rgba(160,200,255,0.9)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-18, -10); g.lineTo(-12, -14); g.moveTo(12, 14); g.lineTo(18, 10); g.stroke(); } break;
        case 'feet': P([[-6, -16], [6, -16], [6, 6], [16, 8], [17, 15], [-7, 15], [-8, 4]]); g.fillStyle = trim; g.fillRect(-7, -16, 13, 4); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-7, 12, 24, 3); break;
      }
      return;
    }
    if (it.kind === 'jewel') {
      const gem = ['#c87a4a', '#c8d0e0', '#5adc8a', '#4a9aff', '#ff4a6a', '#c8a8ff'][tier];
      const band = tier === 0 ? '#c87a4a' : tier === 1 ? '#d0d6de' : '#e2c25a';
      if (it.slot === 'ring') { g.strokeStyle = '#111'; g.lineWidth = 7; g.beginPath(); g.ellipse(0, 4, 12, 10, 0, 0, 6.28); g.stroke(); g.strokeStyle = band; g.lineWidth = 4.5; g.beginPath(); g.ellipse(0, 4, 12, 10, 0, 0, 6.28); g.stroke(); g.fillStyle = '#111'; g.beginPath(); g.moveTo(0, -16); g.lineTo(8, -8); g.lineTo(0, -1); g.lineTo(-8, -8); g.closePath(); g.fill(); g.fillStyle = gem; g.beginPath(); g.moveTo(0, -14); g.lineTo(6, -8); g.lineTo(0, -3); g.lineTo(-6, -8); g.closePath(); g.fill(); circ(g, -2, -10, 1.5, 'rgba(255,255,255,0.8)'); }
      else { g.strokeStyle = band; g.lineWidth = 1.8; g.setLineDash([2, 1.5]); g.beginPath(); g.moveTo(-15, -18); g.quadraticCurveTo(0, 8, 15, -18); g.stroke(); g.setLineDash([]); circ(g, 0, 8, 8, '#111'); circ(g, 0, 8, 6.8, band); circ(g, 0, 8, 4.5, gem); circ(g, -1.6, 6.4, 1.4, 'rgba(255,255,255,0.8)'); }
    }
    function blade(g2, f) { f(); }
  }

  // ---------- class looks ----------
  S.classLook = function (cls, armorItem) {
    const C = D.CLASSES[cls];
    const look = { armor: { kind: armorItem ? armorItem.kind : C.armor === 'cloth' ? 'cloth' : 'none', col: C.color, trim: C.trim } };
    switch (cls) {
      case 'warrior': look.helmPlume = '#b8302a'; break;
      case 'paladin': look.cape = '#e9e3cf'; look.helmPlume = '#e9d070'; break;
      case 'shadowknight': look.cape = '#3a2244'; look.helmSpike = true; look.eyesCol = '#ff4a4a'; break;
      case 'ranger': look.hat = 'hood'; look.hatCol = '#3f6b35'; look.hoodPoint = true; break;
      case 'rogue': look.hat = 'hood'; look.hatCol = '#2a2e30'; look.mask = '#1a1c1e'; break;
      case 'bard': look.hat = 'feather'; look.hatCol = '#b8462e'; look.hatTrim = '#e3c04a'; look.cape = '#e3c04a'; break;
      case 'monk': look.hat = 'headband'; look.hatCol = '#c8302a'; look.sash = '#3a3a3a'; look.robe = false; break;
      case 'berserker': look.bare = true; look.horns = true; look.hat = 'fur'; look.hatCol = '#7a5a3a'; break;
      case 'beastlord': look.hat = 'fur'; look.hatCol = '#8a6a3a'; look.sash = '#c46b2c'; break;
      case 'cleric': look.hat = 'mitre'; look.hatCol = '#f1efe6'; look.hatTrim = '#4f7cc4'; look.robe = true; look.orb = '#fff4b0'; break;
      case 'druid': look.hat = 'leafcrown'; look.robe = true; look.orb = '#9aff6a'; break;
      case 'shaman': look.hat = 'bonemask'; look.orb = '#6ae8d8'; break;
      case 'necromancer': look.hat = 'skullmask'; look.hatCol = '#1d1a22'; look.robe = true; look.orb = '#79ff6b'; look.eyesCol = '#79ff6b'; break;
      case 'wizard': look.hat = 'wizard'; look.hatCol = '#2b4fa3'; look.hatTrim = '#e2c55a'; look.robe = true; look.orb = '#8ad0ff'; break;
      case 'magician': look.hat = 'hood'; look.hatCol = '#b03a2e'; look.robe = true; look.orb = '#ffab4a'; break;
      case 'enchanter': look.hat = 'circlet'; look.hatTrim = '#e0b7ff'; look.robe = true; look.orb = '#d08aff'; break;
    }
    look.tomeCol = { wizard: '#2b4fa3', magician: '#b03a2e', necromancer: '#2a3a22', enchanter: '#6a3fa0', cleric: '#e9e3cf', druid: '#4e7d2f', shaman: '#2d7b78' }[cls] || '#6a3a8a';
    return look;
  };

  // ---------- creatures ----------
  S.drawCreature = function (g, e, t) {
    const k = e.kind, col = e.col || '#777', sc = (e.scale || 1);
    const ph = e.moving ? e.walk : 0;
    const f = e.face || 1; // 1 right, -1 left
    const atk = e.atk || 0;
    g.save(); g.translate(e.x, e.y);
    if (e.dead) { g.globalAlpha = 0.9; }
    g.scale(sc * f, sc);
    const legS = Math.sin(ph) * 3;
    const lunge = atk > 0 ? Math.sin(atk * Math.PI) * 5 : 0;
    const quad = (len, hgt, opts) => {
      const bc = opts.col || col;
      ell(g, 0, 0, len * 0.65, 4.5, 'rgba(0,0,0,0.25)');
      if (e.dead) { ell(g, 0, -hgt * 0.3, len * 0.6, hgt * 0.3, shade(bc, -0.2)); g.fillStyle = shade(bc, -0.35); for (let q = -1; q <= 1; q += 2) g.fillRect(q * len * 0.3 - 2, -hgt * 0.62, 4, hgt * 0.3); return true; }
      // legs
      g.fillStyle = shade(bc, -0.3);
      const lx = len * 0.32, lh = hgt * 0.5;
      g.fillRect(-lx - 2 + legS, -lh, 4, lh); g.fillRect(lx - 2 - legS, -lh, 4, lh);
      g.fillStyle = shade(bc, -0.15); g.fillRect(-lx + 2 - legS, -lh, 4, lh); g.fillRect(lx + 2 + legS, -lh, 4, lh);
      // tail
      if (opts.tail) { g.strokeStyle = opts.tailCol || bc; g.lineWidth = opts.tailW || 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(-len * 0.45, -hgt * 0.65); g.quadraticCurveTo(-len * 0.75, -hgt * (0.7 + Math.sin(t * 6) * 0.1), -len * (0.55 + opts.tail), -hgt * (0.4 + Math.sin(t * 4) * 0.15)); g.stroke(); g.lineCap = 'butt'; }
      // body
      g.fillStyle = bc; g.beginPath(); g.ellipse(lunge * 0.3, -hgt * 0.65, len * 0.5, hgt * 0.33, 0, 0, 6.28); g.fill();
      g.fillStyle = shade(bc, 0.15); g.beginPath(); g.ellipse(lunge * 0.3, -hgt * 0.78, len * 0.38, hgt * 0.14, 0, 0, 6.28); g.fill();
      if (opts.stripes) { g.strokeStyle = opts.stripes; g.lineWidth = 2; for (let s = -2; s <= 2; s++) { g.beginPath(); g.moveTo(s * 6, -hgt * 0.95); g.lineTo(s * 6 - 2, -hgt * 0.5); g.stroke(); } }
      // head
      const hx = len * 0.5 + lunge, hy = -hgt * (opts.headY || 0.8);
      g.fillStyle = bc; g.beginPath(); g.ellipse(hx, hy, opts.headR || 6, (opts.headR || 6) * 0.85, 0, 0, 6.28); g.fill();
      g.fillStyle = shade(bc, -0.08); g.beginPath(); g.ellipse(hx + (opts.snout || 6), hy + 2, (opts.snout || 6) * 0.7, 3, 0, 0, 6.28); g.fill();
      circ(g, hx + (opts.snout || 6) * 1.3, hy + 1.5, 1.5, '#1a1a1a');
      circ(g, hx + 2, hy - 2, 1.5, opts.eye || '#1a1a1a');
      if (opts.ears === 'point') { g.fillStyle = shade(bc, -0.1); g.beginPath(); g.moveTo(hx - 3, hy - 4); g.lineTo(hx - 1, hy - 12); g.lineTo(hx + 2, hy - 4); g.fill(); }
      if (opts.ears === 'round') { circ(g, hx - 2, hy - 5, 3, shade(bc, -0.1)); }
      if (opts.ears === 'pink') { circ(g, hx - 1, hy - 5, 3, '#e8a0a0'); }
      if (opts.tusk) { g.fillStyle = '#f0ead8'; g.beginPath(); g.moveTo(hx + 6, hy + 3); g.lineTo(hx + 9, hy - 3); g.lineTo(hx + 8, hy + 4); g.fill(); }
      if (opts.mane) { g.fillStyle = opts.mane; for (let s = 0; s < 5; s++) { g.beginPath(); g.moveTo(len * 0.3 - s * 5, -hgt * 0.95); g.lineTo(len * 0.3 - s * 5 - 2, -hgt * 1.12); g.lineTo(len * 0.3 - s * 5 - 4, -hgt * 0.95); g.fill(); } }
      return false;
    };
    const wings = (span, y0, c, flap) => { const a = Math.sin(t * (flap || 10)) * 0.6; g.fillStyle = c; for (const s of [-1, 1]) { g.save(); g.translate(0, y0); g.scale(1, s === 1 ? 1 : 0.65); g.rotate(-0.4 - a * 0.6); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-span * 0.4, -span * 0.9, -span, -span * 0.4); g.quadraticCurveTo(-span * 0.6, -span * 0.25, -span * 0.75, 0); g.quadraticCurveTo(-span * 0.4, -span * 0.1, 0, 0); g.fill(); g.restore(); } };
    let done = false;
    switch (k) {
      case 'rat': done = quad(20, 12, { tail: 0.6, tailCol: '#d8a0a0', tailW: 1.5, ears: 'pink', snout: 4, headR: 4.5 }); break;
      case 'wolf': case 'spiritwolf': if (k === 'spiritwolf') g.globalAlpha = 0.75; done = quad(32, 24, { tail: 0.35, tailW: 5, ears: 'point', snout: 7, eye: k === 'spiritwolf' ? '#9ef' : '#e8c040', col: k === 'spiritwolf' ? '#9ad8ff' : col }); break;
      case 'tiger': done = quad(34, 24, { tail: 0.5, tailW: 3, ears: 'round', snout: 5, stripes: '#2a1a10', eye: '#e8c040' }); break;
      case 'bear': done = quad(40, 32, { ears: 'round', snout: 6, headR: 8, eye: '#2a1a10' }); break;
      case 'boar': done = quad(30, 22, { tusk: true, snout: 6, ears: 'point', mane: shade(col, -0.35) }); break;
      case 'croc': done = quad(48, 14, { tail: 0.7, tailW: 7, snout: 12, headR: 5, headY: 0.6, eye: '#e8d040' }); break;
      case 'spider': {
        ell(g, 0, 0, 16, 5, 'rgba(0,0,0,0.25)');
        if (e.dead) { ell(g, 0, -4, 12, 7, col); break; }
        g.strokeStyle = shade(col, -0.2); g.lineWidth = 2;
        for (let s = 0; s < 4; s++) { const o = Math.sin(ph + s) * 3; g.beginPath(); g.moveTo(-2, -10); g.quadraticCurveTo(-14 - s * 2, -22 + s * 3, -18 - s * 2 + o, 0); g.stroke(); g.beginPath(); g.moveTo(2, -10); g.quadraticCurveTo(14 + s * 2, -22 + s * 3, 18 + s * 2 - o, 0); g.stroke(); }
        ell(g, -6, -11, 10, 8, col); ell(g, 6 + lunge, -10, 6, 5, shade(col, -0.1)); g.fillStyle = '#c83a3a'; g.fillRect(-9, -14, 5, 2);
        for (let s = 0; s < 4; s++) circ(g, 8 + lunge + (s % 2) * 2, -12 + Math.floor(s / 2) * 2, 1, '#ff4a4a');
        break; }
      case 'beetle': ell(g, 0, 0, 12, 4, 'rgba(0,0,0,0.25)'); g.strokeStyle = '#2a1a10'; g.lineWidth = 1.5; for (let s = -1; s <= 1; s++) { g.beginPath(); g.moveTo(s * 5, -6); g.lineTo(s * 6 + legS, 0); g.stroke(); } ell(g, 0, -7, 11, 7, col); g.strokeStyle = shade(col, -0.4); g.beginPath(); g.moveTo(-3, -13); g.lineTo(-3, -1); g.stroke(); ell(g, 11 + lunge, -6, 4, 3.5, '#2a1a10'); circ(g, 4, -9, 2, `rgba(255,210,90,${0.6 + Math.sin(t * 3) * 0.3})`); circ(g, -6, -8, 2, `rgba(255,210,90,${0.6 + Math.sin(t * 3 + 1) * 0.3})`); break;
      case 'snake': { ell(g, 0, 0, 16, 4, 'rgba(0,0,0,0.2)'); g.strokeStyle = col; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); for (let s = 0; s <= 10; s++) { const sx = -18 + s * 3.4, sy = -4 + Math.sin(s * 0.9 + t * 6 * (e.moving ? 1 : 0.2)) * 3; s ? g.lineTo(sx, sy) : g.moveTo(sx, sy); } g.stroke(); g.lineCap = 'butt'; ell(g, 18 + lunge, -6, 5, 4, shade(col, 0.1)); circ(g, 20 + lunge, -7, 1.2, '#e8d040'); g.strokeStyle = '#c83a3a'; g.lineWidth = 1; g.beginPath(); g.moveTo(23 + lunge, -6); g.lineTo(27 + lunge, -5); g.stroke(); break; }
      case 'bat': case 'mosquito': {
        ell(g, 0, 0, 8, 3, 'rgba(0,0,0,0.2)'); g.translate(0, -24 - Math.sin(t * 3) * 4);
        if (k === 'bat') { wings(18, -2, shade(col, -0.1), 14); ell(g, 0, 0, 6, 7, col); g.fillStyle = col; g.beginPath(); g.moveTo(-4, -5); g.lineTo(-3, -11); g.lineTo(0, -6); g.moveTo(4, -5); g.lineTo(3, -11); g.lineTo(0, -6); g.fill(); circ(g, -2, -2, 1.2, '#ff5a3a'); circ(g, 2, -2, 1.2, '#ff5a3a'); }
        else { g.fillStyle = 'rgba(220,230,255,0.5)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(-2, -5, 9, 3, s * (0.5 + Math.sin(t * 40) * 0.3), 0, 6.28); g.fill(); } ell(g, -4, 0, 8, 3.5, col); ell(g, 5, -1, 3.5, 3, shade(col, -0.2)); g.strokeStyle = '#2a1a10'; g.lineWidth = 1; g.beginPath(); g.moveTo(7, 0); g.lineTo(14 + lunge, 3); g.stroke(); }
        break; }
      case 'wisp': { g.translate(0, -18 - Math.sin(t * 2.5) * 5); g.globalCompositeOperation = 'lighter'; circ(g, 0, 0, 14, 'rgba(150,230,255,0.15)'); circ(g, 0, 0, 8, 'rgba(180,240,255,0.4)'); circ(g, 0, 0, 4, '#ffffff'); for (let s = 0; s < 5; s++) { const a = t * 2 + s * 1.25; circ(g, Math.cos(a) * 12, Math.sin(a) * 8, 1.5, 'rgba(200,250,255,0.8)'); } g.globalCompositeOperation = 'source-over'; break; }
      case 'ghost': {
        g.translate(0, -10 - Math.sin(t * 2) * 4); g.globalAlpha = e.dead ? 0.3 : 0.78;
        g.fillStyle = col; g.beginPath(); g.moveTo(-12, -30); g.quadraticCurveTo(0, -48, 12, -30); g.lineTo(13, 0);
        for (let s = 0; s < 5; s++) g.lineTo(13 - s * 6.5, 6 * ((s % 2) ? 0.2 : 1) + Math.sin(t * 5 + s) * 2);
        g.closePath(); g.fill();
        circ(g, -4, -30, 2.4, '#0a0a14'); circ(g, 4, -30, 2.4, '#0a0a14'); circ(g, -4, -30, 1, '#9ef'); circ(g, 4, -30, 1, '#9ef');
        g.strokeStyle = shade(col, -0.2); g.lineWidth = 3; g.beginPath(); g.moveTo(-10, -20); g.quadraticCurveTo(-20 - lunge, -16, -22 - lunge, -8); g.moveTo(10, -20); g.quadraticCurveTo(20 + lunge, -16, 22 + lunge, -8); g.stroke();
        g.globalAlpha = 1; break; }
      case 'elemental': case 'fire_elemental': case 'water_elemental': case 'earth_elemental': case 'air_elemental': {
        const el = k === 'elemental' ? 'fire' : k.split('_')[0];
        const c = { fire: ['#ff6a1a', '#ffd06a'], water: ['#3a8ad8', '#9ad8ff'], earth: ['#7a6a4a', '#a8946a'], air: ['#c8d8e8', '#ffffff'] }[el];
        ell(g, 0, 0, 14, 5, 'rgba(0,0,0,0.25)');
        if (el === 'earth') { g.fillStyle = c[0]; rr(g, -12, -40, 24, 30, 6); g.fill(); circ(g, 0, -46, 8, c[1]); g.fillRect(-18 - lunge * 0.3, -38, 7, 22); g.fillRect(11 + lunge, -38, 7, 22); g.fillRect(-9, -12, 7, 12); g.fillRect(2, -12, 7, 12); circ(g, -3, -47, 1.6, '#ffd060'); circ(g, 3, -47, 1.6, '#ffd060'); break; }
        g.globalCompositeOperation = el === 'water' ? 'source-over' : 'lighter';
        for (let s = 0; s < 8; s++) { const a = t * (el === 'air' ? 6 : 3) + s; circ(g, Math.cos(a) * (6 + s), -10 - s * 4 + Math.sin(a) * 2, 9 - s * 0.6, s % 2 ? c[0] : c[1]); }
        g.globalCompositeOperation = 'source-over'; circ(g, -3, -38, 1.6, '#fff'); circ(g, 3, -38, 1.6, '#fff'); break; }
      case 'golem': {
        ell(g, 0, 0, 18, 6, 'rgba(0,0,0,0.3)');
        g.fillStyle = shade(col, -0.2); g.fillRect(-12 + legS, -18, 9, 18); g.fillRect(3 - legS, -18, 9, 18);
        g.fillStyle = col; rr(g, -16, -48, 32, 32, 6); g.fill(); g.fillStyle = shade(col, 0.15); rr(g, -12, -46, 24, 10, 4); g.fill();
        g.fillStyle = shade(col, -0.1); g.fillRect(-26, -46 + lunge * 0.2, 10, 30); g.fillRect(16 + lunge, -46, 10, 30);
        rr(g, -9, -62, 18, 15, 4); g.fillStyle = col; g.fill(); circ(g, -4, -55, 2, '#7affff'); circ(g, 4, -55, 2, '#7affff');
        g.strokeStyle = 'rgba(120,255,255,0.4)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-6, -40); g.lineTo(0, -32); g.lineTo(-4, -24); g.stroke(); break; }
      case 'drake': case 'dragon': case 'griffon': case 'harpy': {
        const big = k === 'dragon';
        if (k === 'harpy') { ell(g, 0, 0, 10, 4, 'rgba(0,0,0,0.2)'); g.translate(0, -16 - Math.sin(t * 3) * 3); wings(26, -24, shade(col, -0.15), 8); S.drawHumanoid(g, 0, 0, { race: 'human', gender: 'f', skin: '#d8b090', hair: '#5a3a22', hairStyle: 3, armor: { kind: 'none', col: col, trim: col }, dir: 2, moving: false, atk }, t); break; }
        ell(g, 0, 0, big ? 40 : 28, 8, 'rgba(0,0,0,0.25)');
        if (e.dead) { ell(g, 0, -8, big ? 36 : 24, 10, col); break; }
        const fly = k === 'griffon' || (k === 'drake' && e.moving);
        if (fly) g.translate(0, -8 - Math.sin(t * 3) * 3);
        wings(big ? 52 : 34, -30, shade(col, -0.2), fly ? 7 : 2);
        done = quad(big ? 64 : 40, big ? 34 : 24, { tail: big ? 0.8 : 0.6, tailW: big ? 8 : 5, snout: k === 'griffon' ? 3 : 9, headR: big ? 9 : 6, headY: big ? 1.15 : 0.95, eye: k === 'griffon' ? '#1a1a1a' : '#ffd23a', col });
        if (k === 'griffon') { g.fillStyle = '#e8c040'; g.beginPath(); g.moveTo(26 + lunge, -24); g.lineTo(34 + lunge, -21); g.lineTo(26 + lunge, -19); g.fill(); g.fillStyle = '#f4efe0'; g.beginPath(); g.ellipse(18 + lunge, -24, 8, 7, 0, 0, 6.28); g.fill(); circ(g, 22 + lunge, -26, 1.6, '#111'); }
        else { g.fillStyle = shade(col, -0.35); for (let s = 0; s < 4; s++) { g.beginPath(); g.moveTo(-8 + s * 8, -(big ? 44 : 32)); g.lineTo(-4 + s * 8, -(big ? 52 : 38)); g.lineTo(0 + s * 8, -(big ? 44 : 32)); g.fill(); } g.fillStyle = '#e8dcc0'; g.beginPath(); g.moveTo((big ? 30 : 18) + lunge, -(big ? 46 : 30)); g.lineTo((big ? 26 : 14) + lunge, -(big ? 58 : 38)); g.lineTo((big ? 34 : 22) + lunge, -(big ? 47 : 31)); g.fill(); }
        if (e.breath > 0) { g.globalCompositeOperation = 'lighter'; for (let s = 0; s < 10; s++) circ(g, (big ? 44 : 28) + s * 9, -(big ? 38 : 22) + Math.sin(t * 20 + s) * 4, 5 + s * 1.5, `rgba(255,${120 + s * 10},40,${0.5 - s * 0.04})`); g.globalCompositeOperation = 'source-over'; }
        break; }
      case 'treant': {
        ell(g, 0, 0, 20, 6, 'rgba(0,0,0,0.3)');
        g.fillStyle = col; g.fillRect(-10 + legS, -20, 8, 20); g.fillRect(2 - legS, -20, 8, 20); rr(g, -12, -56, 24, 40, 6); g.fill();
        g.strokeStyle = shade(col, -0.2); g.lineWidth = 2; for (let s = -1; s <= 1; s++) { g.beginPath(); g.moveTo(s * 6, -54); g.lineTo(s * 6 + 1, -20); g.stroke(); }
        g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.moveTo(-10, -48); g.lineTo(-24 - lunge * 0.3, -36); g.moveTo(10, -48); g.lineTo(26 + lunge, -38); g.stroke();
        circ(g, -4, -46, 2, '#e8ff6a'); circ(g, 4, -46, 2, '#e8ff6a');
        for (let s = 0; s < 6; s++) circ(g, Math.cos(s) * 16, -62 + Math.sin(s * 2) * 8, 10, s % 2 ? '#4a5a2a' : '#5a4a2a');
        break; }
      case 'animsword': { g.translate(0, -20 - Math.sin(t * 3) * 4); g.rotate(0.6 + (atk > 0 ? Math.sin(atk * Math.PI) * 1.5 : Math.sin(t * 2) * 0.2)); g.globalCompositeOperation = 'lighter'; circ(g, 0, -10, 14, 'rgba(200,140,255,0.2)'); g.globalCompositeOperation = 'source-over'; drawWeapon(g, '2HS', 0, 10, null, t); break; }
      default: done = quad(30, 22, {});
    }
    g.restore();
  };

  // humanoid mob presets
  S.mobLook = function (e) {
    const k = e.kind, c = e.col;
    const base = { dir: e.dir, walk: e.walk, moving: e.moving, atk: e.atk, cast: e.casting, dead: e.dead, scale: e.scale, deadDir: e.face };
    switch (k) {
      case 'goblin': return { ...base, race: 'x', skin: c, ears: 'goblin', width: 0.9, scale: (e.scale || 1) * 0.72, armor: { kind: 'leather', col: '#5a4a2a', trim: '#3a2a1a' }, hair: '#2a1e16', hairStyle: 4, weapon: e.ranged === 'archer' ? 'ARC' : e.ranged === 'caster' ? '2HB' : e.weapon || 'dagger', staff: true, orb: '#7aff6a', hat: e.ranged === 'caster' ? 'bonemask' : null, eyesCol: '#ffd23a' };
      case 'orc': return { ...base, race: 'x', skin: c, tusk: true, width: 1.2, scale: (e.scale || 1) * 1.08, armor: { kind: e.ranged === 'caster' ? 'none' : 'leather', col: '#4a3a2a', trim: '#7a2a1a' }, hair: '#1a1a1a', hairStyle: 2, weapon: e.ranged === 'archer' ? 'ARC' : e.ranged === 'caster' ? '2HB' : e.weapon || 'axe', staff: true, orb: '#ff6a3a', hat: e.ranged === 'caster' ? 'bonemask' : null, eyesCol: '#ff3a2a' };
      case 'bandit': return { ...base, race: 'human', skin: S.SKINS[Math.floor((e.seed || 0.3) * 4)], armor: { kind: e.ranged === 'caster' ? 'cloth' : 'leather', col: c, trim: '#2a1a10' }, hair: S.HAIRS[Math.floor((e.seed || 0.5) * 6)], hat: e.ranged === 'caster' ? 'hood' : 'bandana', hatCol: e.ranged === 'caster' ? c : '#8a2a2a', mask: e.ranged === 'caster' ? null : '#2a2a2a', weapon: e.ranged === 'archer' ? 'ARC' : e.ranged === 'caster' ? '2HB' : e.weapon || '1HS', staff: true, orb: '#c06aff', gender: (e.seed || 0) > 0.75 ? 'f' : 'm' };
      case 'lizard': return { ...base, race: 'x', skin: c, snout: true, width: 1.05, armor: { kind: 'none', col: shade(c, -0.15), trim: '#3a2a1a' }, hairStyle: 4, weapon: e.ranged === 'caster' ? '2HB' : e.weapon || 'spear', staff: true, orb: '#6affd8', cape: null };
      case 'skeleton': return { ...base, race: 'x', kind: 'skeleton', skin: '#e8e2cc', armor: { kind: 'none', col: '#d8d0b8', trim: '#8a8270' }, width: 0.85, weapon: e.ranged === 'archer' ? 'ARC' : e.weapon || '1HS', offhand: e.ranged ? null : 'shield', shieldCol: '#5a4a3a' };
      case 'zombie': return { ...base, race: 'x', skin: c, armor: { kind: 'none', col: '#4a4a3a', trim: '#3a3a2a' }, hair: '#3a3a2a', hairStyle: 1, eyesCol: '#c8ff6a', drunk: true };
      case 'troll': return { ...base, race: 'x', skin: c, width: 1.3, scale: (e.scale || 1) * 1.45, armor: { kind: 'none', col: '#5a4a3a', trim: '#3a2a1a' }, hair: '#2a3a2a', hairStyle: 2, weapon: 'club', eyesCol: '#ffd23a' };
      case 'ogre': return { ...base, race: 'x', skin: c, width: 1.5, scale: (e.scale || 1) * 1.5, armor: { kind: 'leather', col: '#6a4a2a', trim: '#3a2a1a' }, hairStyle: 4, weapon: 'club', tusk: true };
      case 'giant': return { ...base, race: 'x', skin: c, width: 1.3, scale: (e.scale || 1) * 2.1, armor: { kind: 'leather', col: '#6a5a3a', trim: '#3a2a1a' }, hair: '#8a6a3a', hairStyle: 1, beard: '#8a6a3a', weapon: 'club' };
      case 'deathknight': return { ...base, race: 'x', skin: '#3a3a44', width: 1.15, scale: (e.scale || 1) * 1.15, armor: { kind: 'plate', col: '#2c2a36', trim: '#6a2a8a' }, helm: 'plate', helmSpike: true, eyesCol: '#7affff', weapon: '2HS', cape: '#1a1420', glow: 'rgba(120,80,200,0.08)' };
      case 'lich': return { ...base, race: 'x', kind: 'lich', skin: '#e8e2cc', robe: true, armor: { kind: 'cloth', col: c, trim: '#8aff8a' }, crown: true, weapon: '2HB', staff: true, orb: '#7aff9a', eyesCol: '#7aff9a', float: true, glow: 'rgba(120,255,160,0.06)' };
      case 'scarecrow': return { ...base, race: 'x', skin: '#d8b878', armor: { kind: 'none', col: '#8a6a3a', trim: '#5a3e24' }, hat: 'strawhat', weapon: 'H2H', eyesCol: '#ff8a2a', drunk: true };
      default: return null;
    }
  };
})();

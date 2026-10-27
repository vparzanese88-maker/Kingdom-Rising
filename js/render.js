// Kingdom Rising — world renderer: chunks, y-sorted scene, lighting, weather, overlays
(function () {
  const KR = (window.KR = window.KR || {});
  const D = KR.D, U = KR.U, W = KR.W, T = KR.T, G = KR.G, S = KR.S;
  const R = (KR.R = {});
  const TS = D.TS, CN = 16, CPX = CN * TS;
  const cache = new Map();
  R.cam = { x: 0, y: 0, zoom: 1 };
  R.invalidateArea = function (x0, y0, w, h) { for (const k of [...cache.keys()]) { const [cx, cy] = k.split(',').map(Number); if (cx * CN + CN >= x0 && cx * CN <= x0 + w && cy * CN + CN >= y0 && cy * CN <= y0 + h) cache.delete(k); } };
  R.clear = () => cache.clear();
  function chunk(cx, cy) {
    const k = cx + ',' + cy; let c = cache.get(k);
    if (c) { c.used = performance.now(); return c.cv; }
    const cv = document.createElement('canvas'); cv.width = CPX; cv.height = CPX;
    S.drawChunk(cv.getContext('2d'), cx, cy, CN);
    cache.set(k, { cv, used: performance.now() });
    if (cache.size > 90) { let oldK = null, old = Infinity; for (const [kk, v] of cache) if (v.used < old) { old = v.used; oldK = kk; } cache.delete(oldK); }
    return cv;
  }
  // decor index by chunk
  let decorIdx = null, decorCount = -1;
  function indexDecor() { decorIdx = new Map(); for (const d of W.decor) { const k = Math.floor(d.tx / CN) + ',' + Math.floor(d.ty / CN); let a = decorIdx.get(k); if (!a) decorIdx.set(k, (a = [])); a.push(d); } decorCount = W.decor.length; }
  R.reindex = () => { decorIdx = null; };

  const dark = document.createElement('canvas'); const dg = dark.getContext('2d');
  R.ambient = function () {
    const h = G.clock / 60;
    // daylight 0..1
    let day = h < 5 ? 0 : h < 7 ? (h - 5) / 2 : h < 18.5 ? 1 : h < 20.5 ? 1 - (h - 18.5) / 2 : 0;
    return day;
  };

  R.draw = function (ctx, vw, vh, t) {
    const p = G.player; const cam = R.cam; const z = cam.zoom;
    const x0 = cam.x - vw / 2 / z, y0 = cam.y - vh / 2 / z, x1 = cam.x + vw / 2 / z, y1 = cam.y + vh / 2 / z;
    const shk = G.shake > 0 ? G.shake * 6 : 0; if (G.shake > 0) G.shake = Math.max(0, G.shake - 0.016);
    ctx.save(); if (shk) ctx.translate((Math.random() - 0.5) * shk, (Math.random() - 0.5) * shk); ctx.scale(z, z); ctx.translate(-x0, -y0);
    // ground
    const cx0 = Math.floor(x0 / CPX), cy0 = Math.floor(y0 / CPX), cx1 = Math.floor(x1 / CPX), cy1 = Math.floor(y1 / CPX);
    ctx.imageSmoothingEnabled = false;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) { if (cx < 0 || cy < 0 || cx * CN >= W.W || cy * CN >= W.H) continue; ctx.drawImage(chunk(cx, cy), cx * CPX, cy * CPX); }
    ctx.imageSmoothingEnabled = true;
    // animated water/lava
    const tx0 = Math.max(0, Math.floor(x0 / TS)), ty0 = Math.max(0, Math.floor(y0 / TS)), tx1 = Math.min(W.W - 1, Math.floor(x1 / TS)), ty1 = Math.min(W.H - 1, Math.floor(y1 / TS));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const tt = W.tiles[ty * W.W + tx];
      if (tt === T.WATER || tt === T.DEEP) { const ph = t * 1.5 + tx * 0.7 + ty * 0.4; ctx.fillStyle = `rgba(255,255,255,${0.06 + Math.sin(ph) * 0.05})`; ctx.fillRect(tx * TS + 4 + Math.sin(ph) * 3, ty * TS + 12 + (tx % 2) * 6, 10, 1.5); }
      else if (tt === T.LAVA) { ctx.fillStyle = `rgba(255,${180 + Math.sin(t * 2 + tx) * 50},60,${0.25 + Math.sin(t * 3 + tx * 1.3 + ty) * 0.15})`; ctx.fillRect(tx * TS, ty * TS, TS, TS); }
    }
    // flat decor, quest ground rings, corpses glow
    if (!decorIdx || decorCount !== W.decor.length) indexDecor();
    const wind = 1 + Math.sin(t * 0.3) * 0.6 + (G.weather.type === 'rain' ? 1.5 : 0);
    const sorted = [];
    for (let cy = Math.floor(y0 / CPX) - 1; cy <= Math.floor((y1 + 120) / CPX); cy++) for (let cx = Math.floor(x0 / CPX) - 1; cx <= Math.floor(x1 / CPX) + 1; cx++) {
      const arr = decorIdx.get(cx + ',' + cy); if (!arr) continue;
      for (const d of arr) { if (d.x < x0 - 80 || d.x > x1 + 80 || d.y < y0 - 20 || d.y > y1 + 140) continue; if (d.flat) S.drawDecor(ctx, d, t, wind); else sorted.push({ y: d.y, d }); }
    }
    // target ring
    if (p.target && !p.target.removed) { const tg = p.target; const col = G.isHostile(p, tg) ? D.CON_COLORS[D.conOf(p.level, tg.level)] : '#7aff8a'; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.ellipse(tg.x, tg.y, (tg.r + 8) * (tg.scale || 1), (tg.r + 8) * 0.45 * (tg.scale || 1), 0, 0, 6.28); ctx.stroke(); ctx.globalAlpha = 1; }
    // fx ground rings
    for (const f of G.fx) if (f.k === 'ring') { const a = 1 - f.t / f.life; ctx.strokeStyle = f.col; ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.4 + 0.6 * f.t / f.life), f.r * 0.5 * (0.4 + 0.6 * f.t / f.life), 0, 0, 6.28); ctx.stroke(); ctx.globalAlpha = a * 0.15; ctx.fillStyle = f.col; ctx.fill(); ctx.globalAlpha = 1; }
    // buildings
    const inside = W.buildingAt(p.x, p.y);
    for (const b of W.buildings) {
      if (b.px > x1 + 40 || b.px + b.pw < x0 - 40 || b.py > y1 + 80 || b.py + b.ph < y0 - 160) continue;
      const want = inside === b ? 0.0 : 1; b.ra = b.ra == null ? want : b.ra + (want - b.ra) * 0.15;
      sorted.push({ y: b.py + b.ph - 2, b });
    }
    // entities
    for (const e of G.ents) { if (e.removed || e.x < x0 - 100 || e.x > x1 + 100 || e.y < y0 - 60 || e.y > y1 + 160) continue; if (e.hidden) continue; sorted.push({ y: e.y + (e.dead ? -8 : 0), e }); }
    for (const pp of KR.Sys.Net.peers) { if ((pp.rm || 'main') !== (W.realm || 'main')) continue; if (pp.x < x0 - 100 || pp.x > x1 + 100 || pp.y < y0 - 60 || pp.y > y1 + 160) continue; sorted.push({ y: pp.y, peer: pp }); }
    sorted.sort((a, b) => a.y - b.y);
    const night = 1 - R.ambient();
    for (const s of sorted) {
      if (s.d) S.drawDecor(ctx, s.d, t, wind);
      else if (s.b) { if (s.b.ra > 0.02) S.drawBuilding(ctx, s.b, t, night, s.b.ra); else drawDoorInside(ctx, s.b); }
      else if (s.e) drawEnt(ctx, s.e, t, inside);
      else if (s.peer) drawPeer(ctx, s.peer, t);
    }
    // projectiles
    for (const pr of G.proj) drawProj(ctx, pr, t);
    // fx
    for (const f of G.fx) { ctx.save(); try { drawFx(ctx, f, t); } catch (e) { f.t = f.life; } ctx.restore(); }
    ctx.restore();
    // lighting
    drawLighting(ctx, vw, vh, x0, y0, z, t, night);
    // weather
    drawWeather(ctx, vw, vh, t);
    // overlays (names, bars, floaters) on top of lighting
    ctx.save(); ctx.scale(z, z); ctx.translate(-x0, -y0);
    for (const s of sorted) { if (s.e) drawLabel(ctx, s.e, inside); if (s.peer) drawPeerLabel(ctx, s.peer); }
    for (const f of G.floaters) { const a = 1 - Math.max(0, f.t - 0.7) / 0.6; ctx.globalAlpha = a; ctx.font = `700 ${f.big ? 17 : 13}px "Alegreya Sans", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;
    // group mates: an arrow over their heads that shows through walls and roofs (up to 500 ft away)
    const mates = KR.Sys.mates ? KR.Sys.mates() : [];
    for (const pp of mates) { if (pp.dead || Math.hypot(pp.x - p.x, pp.y - p.y) > R.MATE_RANGE) continue; R.mateArrow(ctx, pp.x, pp.y - 80 + Math.sin(t * 3) * 3, 1); }
    ctx.restore();
    // and an arrow at the edge of the screen pointing to each mate who is off screen
    for (const pp of mates) {
      const sx = (pp.x - x0) * z, sy = (pp.y - 30 - y0) * z;
      if (sx > 0 && sy > 0 && sx < vw && sy < vh) continue;
      R.edgeArrow(ctx, vw, vh, vw / 2, vh / 2, sx - vw / 2, sy - vh / 2, pp.n, Math.hypot(pp.x - p.x, pp.y - p.y) * R.FT_PER_PX);
    }
  };
  R.FT_PER_PX = 0.05 * 3.28084; // one pixel is 5 cm
  R.MATE_RANGE = 500 / R.FT_PER_PX;
  R.mateArrow = function (ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.shadowColor = KR.Sys.GROUP_COL; ctx.shadowBlur = 8; ctx.fillStyle = KR.Sys.GROUP_COL; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-8, -2); ctx.lineTo(-3, -2); ctx.lineTo(-3, -10); ctx.lineTo(3, -10); ctx.lineTo(3, -2); ctx.lineTo(8, -2); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
  };
  // a small arrow pointing from the centre (cx, cy) along (dx, dy) toward a mate, with their name and distance
  R.edgeArrow = function (ctx, vw, vh, cx, cy, dx, dy, name, ft) {
    // on a ring around the middle of the screen, clear of the corner panels
    const a = Math.atan2(dy, dx); const x = cx + Math.cos(a) * Math.min(vw * 0.36, vw / 2 - 60), y = cy + Math.sin(a) * Math.min(vh * 0.34, vh / 2 - 60);
    ctx.save(); ctx.translate(x, y);
    ctx.save(); ctx.rotate(a); ctx.shadowColor = KR.Sys.GROUP_COL; ctx.shadowBlur = 8; ctx.fillStyle = KR.Sys.GROUP_COL; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
    ctx.font = '700 11px "Alegreya Sans", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.fillStyle = '#e8fdff';
    const ty = Math.sin(a) > 0.5 ? -16 : 22; const label = `${String(name || '').slice(0, 16)} ${ft >= 1000 ? (ft / 5280).toFixed(1) + ' mi' : Math.round(ft) + ' ft'}`;
    ctx.strokeText(label, 0, ty); ctx.fillText(label, 0, ty); ctx.restore();
  };

  function drawDoorInside(ctx, b) {
    const d = b.door; if (d.open > 0.9) return;
    ctx.fillStyle = '#6a4a28'; ctx.fillRect(d.tx * TS + 2, d.ty * TS + 6, TS - 4 - d.open * 24, 20);
  }
  function hiddenByRoof(e, inside) { if (inside) return false; const b = W.buildingAt(e.x, e.y); return !!b; }

  function drawEnt(ctx, e, t, inside) {
    if ((e.siege || e.barracks || e.bell || e.raidBoard || e.customDraw) && KR.War) { KR.War.draw(ctx, e, t); return; }
    if (e.type !== 'player' && hiddenByRoof(e, inside) && W.buildingAt(e.x, e.y) !== inside) return; // drawn under roof anyway (roof covers)
    const glow = e.glowUntil && e.glowUntil > G.now && !e.dead ? Math.min(1, (e.glowUntil - G.now) / 1200) * (0.75 + 0.25 * Math.sin(t * 7)) : 0;
    if (glow > 0) levelGlow(ctx, e, t, glow, false);
    if (e.fd) { ctx.save(); ctx.globalAlpha = 0.95; }
    const look = e.type === 'player' ? e.look : e.look || S.mobLook(e);
    if (e.cast && !e.dead) { ctx.save(); try { castCircle(ctx, e, t); } catch (er) {} ctx.restore(); }
    const an = e.animK && e.animT > G.now ? e.animK : null, ak = an ? 1 - (e.animT - G.now) / (e.animDur || 400) : 0;
    let animSaved = false;
    if (an === 'slam' || an === 'thrust' || an === 'hop') { ctx.save(); animSaved = true; const f2 = e.face || 1; if (an === 'slam') ctx.translate(f2 * 4 * Math.sin(ak * Math.PI), -14 * Math.sin(ak * Math.PI)); else if (an === 'hop') ctx.translate(0, -10 * Math.sin(ak * Math.PI)); else ctx.translate(f2 * 10 * Math.sin(ak * Math.PI), 0); }
    if (look) {
      {
        const o = Object.assign({}, look, { dir: e.dir, walk: e.walk, moving: e.moving, atk: e.atk, cast: !!e.cast || e.casting, castCol: e.cast ? hexToRgb(G.projCol(e.cast.spell.res || 'heal')) : null, kick: e.kickT || 0, sit: e.sit, dead: e.dead || e.fd, deadDir: e.face, drunk: look.drunk || e.drunk || (e === G.player && e.drunkUntil > G.now), scale: (look.scale || 1) * (e.scale && !look.scale ? e.scale : 1) });
        if (e.type === 'player') { o.weapon = look.weapon; if (e.c.rangeMode === 'ranged' && look.rangeW) { o.weapon = look.rangeW; o.back = null; } }
        if (an === 'spin') { o.dir = [0, 2, 3, 1][Math.floor(ak * 12) % 4]; o.atk = 0.5; }
        else if (an === 'raise') { o.cast = true; o.castCol = e.animCol || '255,215,120'; }
        else if (an === 'slam' || an === 'thrust') o.atk = Math.max(o.atk || 0, 0.3 + ak * 0.6);
        if (e.mez > 0) { ctx.save(); ctx.globalAlpha = 0.75; }
        if (e.mounted && KR.War && !e.dead) { KR.War.drawHorse(ctx, e, t); o.moving = false; S.drawHumanoid(ctx, e.x, e.y - 22, o, t + e.id); }
        else S.drawHumanoid(ctx, e.x, e.y, o, t + e.id);
        if (e.soldier === 'musketeer' && KR.War && !e.dead) KR.War.drawMusket(ctx, e);
        if (e.mez > 0) ctx.restore();
        if (e.type === 'npc' && e.work === 'cook') { for (let k = 0; k < 2; k++) { const ph = (t * 0.7 + k * 0.5) % 1; ctx.fillStyle = `rgba(240,240,240,${0.4 * (1 - ph)})`; ctx.beginPath(); ctx.arc(e.x + 18, e.y - 30 - ph * 20, 3 + ph * 4, 0, 6.28); ctx.fill(); } }
      }
    } else {
      S.drawCreature(ctx, e, t + e.id);
    }
    if (animSaved) ctx.restore();
    if (e.fd) ctx.restore();
    if (e.cast && !e.dead) { ctx.save(); try { castMotes(ctx, e, t); } catch (er) {} ctx.restore(); }
    if (glow > 0) levelGlow(ctx, e, t, glow, true);
    // status visuals
    if (!e.dead) {
      if (e.stun > 0) for (let k = 0; k < 3; k++) { const a = t * 4 + k * 2.1; ctx.fillStyle = '#ffe07a'; ctx.font = '10px serif'; ctx.fillText('★', e.x + Math.cos(a) * 10 - 4, e.y - (e.h || 46) * (e.scale || 1) - 4 + Math.sin(a) * 3); }
      if (e.mez > 0) { ctx.fillStyle = '#ffb0ff'; ctx.font = '12px serif'; ctx.fillText('z', e.x + 8 + Math.sin(t * 2) * 3, e.y - (e.h || 46) - 6 - ((t * 10) % 10)); }
      if (e.root > 0) { ctx.strokeStyle = '#5aa83a'; ctx.lineWidth = 2; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(e.x + k * 6, e.y); ctx.quadraticCurveTo(e.x + k * 10, e.y - 8, e.x + k * 4, e.y - 14); ctx.stroke(); } }
      if (e.buffs && e.buffs.some((b) => b.rune > 0)) { ctx.strokeStyle = 'rgba(140,200,255,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(e.x, e.y - 22, 18, 28, 0, 0, 6.28); ctx.stroke(); }
    }
    if (e.dead && e.loot && e.loot.items.length && e.type === 'mob') { const a = 0.5 + Math.sin(t * 4) * 0.4; ctx.fillStyle = `rgba(255,230,120,${a})`; ctx.beginPath(); ctx.arc(e.x + Math.sin(t * 2) * 6, e.y - 14, 2.5, 0, 6.28); ctx.fill(); }
  }
  function levelGlow(ctx, e, t, a, front) {
    const cy = e.y - 22 * (e.scale || 1);
    ctx.save();
    if (!front) {
      const g = ctx.createRadialGradient(e.x, cy, 4, e.x, cy, 62);
      g.addColorStop(0, `rgba(255,236,120,${0.75 * a})`); g.addColorStop(0.45, `rgba(255,210,60,${0.38 * a})`); g.addColorStop(1, 'rgba(255,190,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(e.x, cy, 62, 70, 0, 0, 6.28); ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(e.x, cy, 2, e.x, cy, 34);
      g.addColorStop(0, `rgba(255,240,140,${0.45 * a})`); g.addColorStop(1, 'rgba(255,220,80,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(e.x, cy, 26, 40, 0, 0, 6.28); ctx.fill();
      for (let k = 0; k < 10; k++) { const ph = (t * 0.6 + k / 10) % 1; const ang = k * 2.4 + t * 1.5; ctx.fillStyle = `rgba(255,232,120,${a * (1 - ph)})`; ctx.beginPath(); ctx.arc(e.x + Math.cos(ang) * (14 + k % 3 * 5), e.y - ph * 64, 1.6 + (k % 2), 0, 6.28); ctx.fill(); }
    }
    ctx.restore();
  }
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; }

  function drawLabel(ctx, e, inside) {
    if (e.removed || e.noLabel || e.hidden) return;
    const p = G.player;
    if (e.type !== 'player' && W.buildingAt(e.x, e.y) && W.buildingAt(e.x, e.y) !== inside) return;
    const sc = e.look && e.look.scale ? e.look.scale : e.scale || 1;
    const top = e.y - (e.h || 46) * sc - 12;
    const near = Math.hypot(e.x - p.x, e.y - p.y) < 520 || e === p.target;
    if (e.bubble) drawBubble(ctx, e.x, top - 18, e.bubble.text);
    if (e.dead && e.type !== 'mob') return;
    if (!near && e.type !== 'player') return;
    if (e.raider && e !== p.target) { // war-party soldiers: no clutter, just a skull when they are about to fall
      if (e.hp < e.hpMax * 0.25) { const bob = Math.sin(G.now / 180) * 1.5; ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText('☠', e.x, top + 4 + bob); ctx.fillStyle = '#ff3a2a'; ctx.fillText('☠', e.x, top + 4 + bob); }
      return;
    }
    let col = '#ffffff';
    if (e.type === 'mob') col = D.CON_COLORS[D.conOf(p.level, e.level)];
    else if (e.type === 'npc') col = '#a8e0ff';
    else if (e.type === 'guard' || e.type === 'king') col = e.faction === p.c.faction ? '#a8e0ff' : '#ff6a5a';
    else if (e.type === 'pet') col = '#c8ffc8';
    else if (e.type === 'merc') col = '#9affb8';
    ctx.font = `600 ${e.boss || e.type === 'king' ? 14 : 12}px "Alegreya Sans", system-ui, sans-serif`; ctx.textAlign = 'center';
    let name = e.name; if (e.dead) name += "'s corpse";
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(name, e.x, top); ctx.fillStyle = e.dead ? '#bbb' : col; ctx.fillText(name, e.x, top);
    if (e.title && !e.dead) { ctx.font = 'italic 11px "Alegreya Sans", system-ui, sans-serif'; ctx.strokeText(`<${e.title}>`, e.x, top + 12); ctx.fillStyle = '#e8d8a8'; ctx.fillText(`<${e.title}>`, e.x, top + 12); }
    // quest markers
    if (e.type === 'npc' || e.type === 'king') { const m = KR.Sys.npcMarker(e); if (m) { const bob = Math.sin(G.now / 250) * 3; ctx.font = '800 24px "IM Fell English SC", serif'; ctx.lineWidth = 4; ctx.strokeStyle = '#2a1a00'; ctx.strokeText(m, e.x, top - 16 + bob); ctx.fillStyle = m === '?' ? '#ffe23a' : '#ffcf2a'; ctx.fillText(m, e.x, top - 16 + bob); } }
    // hp bar
    if (!e.dead && (e.type === 'mob' || e.type === 'pet' || e.type === 'merc' || (e.type !== 'npc' && e.hp < e.hpMax))) {
      const w = e.boss ? 60 : 36; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2 - 1, top + 3, w + 2, 5);
      ctx.fillStyle = e.type === 'pet' ? '#5ad86a' : '#d8443a'; ctx.fillRect(e.x - w / 2, top + 4, w * Math.max(0, e.hp / e.hpMax), 3);
    }
    if (e.cast && e !== p) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - 18, top + 9, 36, 3); ctx.fillStyle = '#c8a8ff'; ctx.fillRect(e.x - 18, top + 9, 36 * Math.min(1, e.cast.t / e.cast.dur), 3); }
  }
  function drawBubble(ctx, x, y, text) {
    ctx.font = '12px "Alegreya Sans", system-ui, sans-serif';
    const words = text.split(' '); const lines = []; let cur = '';
    for (const w of words) { if (ctx.measureText(cur + ' ' + w).width > 170 && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
    if (cur) lines.push(cur);
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, h = lines.length * 14 + 8;
    const bx = x - w / 2, by = y - h;
    ctx.fillStyle = 'rgba(250,244,228,0.95)'; S.rr(ctx, bx, by, w, h, 6); ctx.fill(); ctx.strokeStyle = 'rgba(80,60,30,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 5, by + h); ctx.lineTo(x, by + h + 6); ctx.lineTo(x + 5, by + h); ctx.fillStyle = 'rgba(250,244,228,0.95)'; ctx.fill();
    ctx.fillStyle = '#3a2a18'; ctx.textAlign = 'center'; lines.forEach((l, i) => ctx.fillText(l, x, by + 15 + i * 14));
  }
  function drawPeer(ctx, pp, t) {
    if (pp.dead) return;
    const look = Object.assign(S.classLook(pp.c || 'warrior', pp.a && pp.a !== 'none' ? { ak: pp.a, kind: pp.a } : null), { race: pp.r, gender: pp.g, skin: S.skinOf(pp.r, pp.s), hair: S.HAIRS[pp.h] || S.HAIRS[1], hairStyle: pp.hs, cls: pp.c, weapon: pp.w });
    if (pp.a && pp.a !== 'none') look.armor.kind = pp.a;
    pp.walk = (pp.walk || 0) + (pp.m ? 0.18 : 0);
    const mate = KR.Sys.isMate && KR.Sys.isMate(pp);
    if (mate) { // group mates shine: a ring at their feet and a glowing outline
      const pulse = 0.65 + 0.35 * Math.sin(t * 4);
      ctx.save(); ctx.strokeStyle = KR.Sys.GROUP_COL; ctx.globalAlpha = 0.85 * pulse; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(pp.x, pp.y + 2, 15, 7, 0, 0, 6.28); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.shadowColor = KR.Sys.GROUP_COL; ctx.shadowBlur = 10 + 6 * pulse;
    }
    S.drawHumanoid(ctx, pp.x, pp.y, Object.assign(look, { dir: pp.d || 0, walk: pp.walk, moving: !!pp.m }), t);
    if (mate) ctx.restore();
  }
  function drawPeerLabel(ctx, pp) {
    const top = pp.y - 60;
    ctx.font = '600 12px "Alegreya Sans", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    const mate = KR.Sys.isMate && KR.Sys.isMate(pp);
    const label = `${String(pp.n).slice(0, 24)} (${pp.l || 1})`; ctx.strokeText(label, pp.x, top); ctx.fillStyle = mate ? KR.Sys.GROUP_COL : pp.f === G.player.c.faction ? '#9affb8' : '#ffb08a'; ctx.fillText(label, pp.x, top);
    if (pp.bubble && pp.bubble.until > Date.now()) drawBubble(ctx, pp.x, top - 18, pp.bubble.text);
  }
  function drawProj(ctx, p, t) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang || 0);
    if (KR.War && KR.War.drawProj(ctx, p, t)) { ctx.restore(); return; }
    if (p.vis === 'arrow') { ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(6, 0); ctx.stroke(); ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(6, -3); ctx.lineTo(11, 0); ctx.lineTo(6, 3); ctx.fill(); ctx.fillStyle = '#e8e0d0'; ctx.fillRect(-12, -2, 4, 4); }
    else if (p.vis === 'knife') { ctx.rotate(t * 20); ctx.fillStyle = '#e0e4ea'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(0, -3); ctx.lineTo(7, 0); ctx.lineTo(0, 3); ctx.fill(); }
    else {
      const col = G.projCol(p.vis);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = col; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 6.28); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, 6.28); ctx.fill();
      if (p.vis === 'cold') { ctx.strokeStyle = '#e0f8ff'; ctx.lineWidth = 1.5; for (let k = 0; k < 3; k++) { ctx.rotate(1.05); ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke(); } }
      if (p.vis === 'magic') { ctx.strokeStyle = '#f0e0ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-14, 0); for (let k = 0; k < 4; k++) ctx.lineTo(-14 + k * 4, (Math.random() - 0.5) * 8); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
  // ---------- spellcasting visuals ----------
  function castCircle(ctx, e, t) {
    const c = e.cast; const col = hexToRgb(G.projCol(c.spell.res || (c.spell.target === 'enemy' ? 'magic' : 'heal'))); const k = Math.min(1, c.t / (c.dur || 1));
    const R0 = 18 + k * 10; ctx.save(); ctx.translate(e.x, e.y); ctx.scale(1, 0.45);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, R0 + 8); g.addColorStop(0, `rgba(${col},${0.25 + 0.25 * k})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R0 + 8, 0, 6.28); ctx.fill();
    ctx.strokeStyle = `rgba(${col},${0.55 + 0.35 * k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R0, 0, 6.28); ctx.stroke();
    ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, R0 * 0.7, 0, 6.28); ctx.stroke();
    ctx.rotate(t * 1.6); const n = 6; ctx.beginPath(); for (let i = 0; i <= n; i++) { const a2 = (i * 2 * Math.PI * 2) / n; const x = Math.cos(a2) * R0 * 0.7, y = Math.sin(a2) * R0 * 0.7; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
    for (let i = 0; i < 8; i++) { const a2 = i * 0.785 - t * 2.2; ctx.fillStyle = `rgba(${col},0.9)`; ctx.fillRect(Math.cos(a2) * R0 - 1.5, Math.sin(a2) * R0 - 1.5, 3, 3); }
    ctx.restore();
  }
  function castMotes(ctx, e, t) {
    const c = e.cast; const col = hexToRgb(G.projCol(c.spell.res || (c.spell.target === 'enemy' ? 'magic' : 'heal'))); const k = Math.min(1, c.t / (c.dur || 1));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) { const ph = (t * 0.9 + i / 10) % 1; const a2 = i * 2.4 + t * 3; const rr = 16 * (1 - ph * 0.6); ctx.fillStyle = `rgba(${col},${(1 - ph) * (0.5 + 0.5 * k)})`; ctx.beginPath(); ctx.arc(e.x + Math.cos(a2) * rr, e.y - 6 - ph * 52, 1.6 + (1 - ph) * 1.6, 0, 6.28); ctx.fill(); }
    // gathering orb between the hands grows as the spell completes
    const gy = e.y - 40; const gr = 3 + k * 7 + Math.sin(t * 16) * 1; const g = ctx.createRadialGradient(e.x, gy, 0, e.x, gy, gr * 2.2); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, `rgba(${col},0.7)`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, gy, gr * 2.2, 0, 6.28); ctx.fill();
    ctx.restore();
  }
  function drawFx(ctx, f, t) {
    const a = 1 - f.t / f.life;
    switch (f.k) {
      case 'slash': ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang); ctx.strokeStyle = f.col; ctx.globalAlpha = a; ctx.lineWidth = f.big ? 4 : 2.5; ctx.beginPath(); ctx.arc(0, 0, f.big ? 22 : 15, -0.9, 0.9); ctx.stroke(); ctx.restore(); break;
      case 'burst': ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = f.col; ctx.globalAlpha = a * 0.7; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + f.t / f.life), 0, 6.28); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; break;
      case 'spark': ctx.globalAlpha = a; ctx.fillStyle = f.col; if (f.r) { ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * a, 0, 6.28); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; } ctx.globalAlpha = 1; break;
      case 'note': { if (f.t < (f.delay || 0)) break; const e = f.ent || f; const k = (f.t - (f.delay || 0)) / (f.life - (f.delay || 0)); const x = e.x + f.dx + Math.sin(f.ph + k * 7) * 9, y = e.y - 44 - k * 46; ctx.globalAlpha = Math.min(1, (1 - k) * 1.6); ctx.font = 'bold 17px serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.strokeText(f.ch, x, y); ctx.fillStyle = f.col; ctx.fillText(f.ch, x, y); ctx.globalAlpha = 1; break; }
      case 'aura': { const e = f.ent || f; ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 6; k++) { const ang = t * 3 + k * 1.05; const yy = e.y - 10 - (f.t / f.life) * 40 - k * 4; ctx.fillStyle = f.col; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(e.x + Math.cos(ang) * 14, yy, 2.5, 0, 6.28); ctx.fill(); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; break; }
      case 'levelup': { const e = f.ent; ctx.globalCompositeOperation = 'lighter'; const g2 = ctx.createLinearGradient(0, e.y - 140, 0, e.y); g2.addColorStop(0, 'rgba(255,220,120,0)'); g2.addColorStop(1, `rgba(255,220,120,${0.5 * a})`); ctx.fillStyle = g2; ctx.fillRect(e.x - 24, e.y - 140, 48, 140); for (let k = 0; k < 10; k++) { ctx.fillStyle = `rgba(255,240,170,${a})`; ctx.beginPath(); ctx.arc(e.x + Math.cos(t * 4 + k) * 22, e.y - ((f.t * 60 + k * 14) % 120), 2, 0, 6.28); ctx.fill(); } ctx.globalCompositeOperation = 'source-over'; break; }
      case 'sparks': for (let k = 0; k < 6; k++) { ctx.fillStyle = `rgba(255,${180 + k * 10},80,${a})`; ctx.fillRect(f.x + Math.cos(k * 1.1) * f.t * 60, f.y - Math.sin(k * 0.9) * f.t * 50 + f.t * f.t * 60, 2, 2); } break;
      case 'note': ctx.globalAlpha = a; ctx.fillStyle = '#ffe9a8'; ctx.font = '14px serif'; ctx.fillText('♪', f.x, f.y); ctx.globalAlpha = 1; break;
      case 'pillar': { const e = f.ent || f; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const w = 22 * (0.6 + 0.4 * Math.sin(Math.min(1, f.t / f.life) * Math.PI)); const g2 = ctx.createLinearGradient(0, e.y - 170, 0, e.y); g2.addColorStop(0, `rgba(${f.rgb},0)`); g2.addColorStop(1, `rgba(${f.rgb},${0.55 * a})`); ctx.fillStyle = g2; ctx.fillRect(e.x - w / 2, e.y - 170, w, 170);
        for (let k = 0; k < 10; k++) { const ph = (f.t * 1.3 + k / 10) % 1; ctx.fillStyle = `rgba(255,255,255,${a * (1 - ph)})`; ctx.fillRect(e.x - 12 + ((k * 37) % 24), e.y - ph * 80 - 4, 2, 2); } ctx.restore(); break; }
      case 'runes': { const e = f.ent || f; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.font = 'bold 11px serif'; ctx.textAlign = 'center'; const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹ'; for (let k = 0; k < 8; k++) { const a2 = k * 0.785 + f.t * 3; const yy = e.y - 8 - (f.t / f.life) * 50; const x = e.x + Math.cos(a2) * 20, y = yy + Math.sin(a2) * 7; ctx.fillStyle = `rgba(${f.rgb},${a * (Math.sin(a2) > -0.2 ? 1 : 0.4)})`; ctx.fillText(glyphs[k], x, y); } ctx.restore(); break; }
      case 'swirl': { const e = f.ent || f; ctx.save(); for (let k = 0; k < 14; k++) { const a2 = k * 0.9 + f.t * 6; const rr = 22 * (1 - f.t / f.life) + 4; ctx.fillStyle = `rgba(${f.rgb},${a * 0.8})`; ctx.beginPath(); ctx.arc(e.x + Math.cos(a2) * rr, e.y - 24 + Math.sin(a2) * rr * 0.5 - k * 1.5, 2.6, 0, 6.28); ctx.fill(); } ctx.restore(); break; }
      case 'spiral': { const e = f.ent || f; const top = e.y - (e.h || 50) * (e.scale || 1) - 10; ctx.save(); ctx.strokeStyle = `rgba(${f.rgb},${a})`; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k < 40; k++) { const a2 = k * 0.35 + f.t * 5, rr = k * 0.35; const x = e.x + Math.cos(a2) * rr, y = top + Math.sin(a2) * rr * 0.5; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); if (f.zzz) { ctx.fillStyle = `rgba(255,220,255,${a})`; ctx.font = 'bold 12px sans-serif'; ctx.fillText('z', e.x + 10 + f.t * 8, top - 6 - f.t * 14); ctx.fillText('Z', e.x + 16 + f.t * 10, top - 14 - f.t * 16); } ctx.restore(); break; }
      case 'stars': { const e = f.ent || f; const top = e.y - (e.h || 50) * (e.scale || 1) - 6; ctx.save(); ctx.font = '12px serif'; ctx.textAlign = 'center'; for (let k = 0; k < 4; k++) { const a2 = k * 1.57 + f.t * 6; ctx.fillStyle = `rgba(255,230,120,${a})`; ctx.fillText('★', e.x + Math.cos(a2) * 14, top + Math.sin(a2) * 5); } ctx.restore(); break; }
      case 'roots': { const e = f.ent || f; ctx.save(); ctx.strokeStyle = `rgba(90,170,70,${a})`; ctx.lineWidth = 3; ctx.lineCap = 'round'; const grow = Math.min(1, f.t / 0.3); for (let k = 0; k < 7; k++) { const a2 = k * 0.9; const bx = e.x + Math.cos(a2) * 14, by = e.y + Math.sin(a2) * 5; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + Math.cos(a2 + 1) * 8, by - 12 * grow, bx - Math.cos(a2) * 6, by - 22 * grow); ctx.stroke(); } ctx.restore(); break; }
      case 'nova': { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const k2 = f.t / f.life; const rr = f.r * (0.2 + 0.8 * k2); ctx.strokeStyle = `rgba(${f.rgb},${a})`; ctx.lineWidth = 3; for (let k = 0; k < 16; k++) { const a2 = k * 0.3927; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a2) * rr * 0.5, f.y + Math.sin(a2) * rr * 0.25); ctx.lineTo(f.x + Math.cos(a2) * rr, f.y + Math.sin(a2) * rr * 0.5); ctx.stroke(); } ctx.fillStyle = `rgba(${f.rgb},${a * 0.25})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, rr, rr * 0.5, 0, 0, 6.28); ctx.fill(); ctx.restore(); break; }
      case 'portal': { const e = f.ent || f; ctx.save(); ctx.translate(e.x, e.y); ctx.scale(1, 0.45); ctx.globalCompositeOperation = 'lighter'; const rr = 30 * Math.sin(Math.min(1, f.t / f.life) * Math.PI); for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(${f.rgb},${0.7 - k * 0.2})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, Math.max(0.5, rr - k * 7), f.t * 5 + k, f.t * 5 + k + 4.5); ctx.stroke(); } ctx.restore(); break; }
      case 'shout': { const e = f.ent || f; ctx.save(); ctx.strokeStyle = `rgba(${f.rgb},${a * 0.8})`; ctx.lineWidth = 3; for (let k = 0; k < 3; k++) { const rr = ((f.t / f.life) * 70 + k * 18) % 70; ctx.globalAlpha = 1 - rr / 70; ctx.beginPath(); ctx.ellipse(e.x, e.y - 34, rr, rr * 0.6, 0, 0, 6.28); ctx.stroke(); } ctx.restore(); break; }
      case 'whirlfx': { const e = f.ent || f; ctx.save(); ctx.translate(e.x, e.y - 20); ctx.scale(1, 0.55); ctx.strokeStyle = `rgba(255,240,210,${a})`; ctx.lineWidth = 4; const rot = f.t * 22; ctx.beginPath(); ctx.arc(0, 0, f.r || 40, rot, rot + 2.4); ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, (f.r || 40) * 0.75, rot + 3.1, rot + 5); ctx.stroke(); ctx.restore(); break; }
      case 'smoke': { ctx.save(); for (let k = 0; k < 8; k++) { const a2 = k * 0.785; const rr = 6 + (f.t / f.life) * 26; ctx.fillStyle = `rgba(150,150,160,${a * 0.45})`; ctx.beginPath(); ctx.arc(f.x + Math.cos(a2) * rr, f.y - 18 + Math.sin(a2) * rr * 0.5 - f.t * 20, 9 + f.t * 10, 0, 6.28); ctx.fill(); } ctx.restore(); break; }
      case 'flames': { const e = f.ent || f; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 9; k++) { const ph = (f.t * 2 + k / 9) % 1; const x = e.x + Math.sin(k * 2.1 + f.t * 4) * 14; ctx.fillStyle = `rgba(${f.rgb || '255,110,40'},${a * (1 - ph) * 0.8})`; ctx.beginPath(); ctx.arc(x, e.y - 6 - ph * 50, 5 * (1 - ph) + 1.5, 0, 6.28); ctx.fill(); } ctx.restore(); break; }
      case 'shield': { const e = f.ent || f; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g2 = ctx.createRadialGradient(e.x, e.y - 26, 8, e.x, e.y - 26, 34); g2.addColorStop(0, `rgba(${f.rgb},0)`); g2.addColorStop(0.8, `rgba(${f.rgb},${0.18 * a})`); g2.addColorStop(1, `rgba(${f.rgb},${0.6 * a})`); ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(e.x, e.y - 26, 30, 36, 0, 0, 6.28); ctx.fill(); ctx.restore(); break; }
      case 'cross': { ctx.save(); ctx.strokeStyle = f.col; ctx.globalAlpha = a; ctx.lineWidth = 4; ctx.lineCap = 'round'; const L = 18 * Math.min(1, f.t / 0.08); ctx.beginPath(); ctx.moveTo(f.x - L, f.y - L); ctx.lineTo(f.x + L, f.y + L); ctx.moveTo(f.x + L, f.y - L); ctx.lineTo(f.x - L, f.y + L); ctx.stroke(); ctx.restore(); break; }
      case 'dash': ctx.strokeStyle = `rgba(255,255,255,${a * 0.6})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(f.x0, f.y0 - 20); ctx.lineTo(f.x1, f.y1 - 20); ctx.stroke(); break;
    }
  }

  // ---------- lighting ----------
  function drawLighting(ctx, vw, vh, x0, y0, z, t, night) {
    const p = G.player;
    const reg = D.REGIONS[W.regionAtPx(p.x, p.y)];
    // region darkness blends in smoothly
    R.regDark = R.regDark == null ? reg.dark : R.regDark + (reg.dark - R.regDark) * 0.02;
    const weatherDim = G.weather.type === 'rain' ? 0.18 : G.weather.type === 'fog' ? 0.22 : G.weather.type === 'cloudy' ? 0.08 : 0;
    const roadBright = W.tile(Math.floor(p.x / TS), Math.floor(p.y / TS)) === T.ROAD ? -0.05 : 0;
    const darkness = U.clamp(night * 0.72 + R.regDark * (0.74 + night * 0.2) + weatherDim + roadBright, 0, 0.94);
    // warm dusk tint / cool night tint
    const h = G.clock / 60;
    const dusk = (h > 17 && h < 20.5) ? Math.sin((h - 17) / 3.5 * Math.PI) : (h > 5 && h < 7.5 ? Math.sin((h - 5) / 2.5 * Math.PI) * 0.6 : 0);
    if (dusk > 0.02) { ctx.fillStyle = `rgba(255,140,60,${dusk * 0.14})`; ctx.fillRect(0, 0, vw, vh); }
    if (darkness < 0.02) return;
    const sc = 0.5;
    const w = Math.ceil(vw * sc), hh = Math.ceil(vh * sc);
    if (dark.width !== w || dark.height !== hh) { dark.width = w; dark.height = hh; }
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, w, hh);
    const tint = R.regDark > 0.6 ? '14,10,28' : '10,14,34';
    dg.fillStyle = `rgba(${tint},${darkness})`; dg.fillRect(0, 0, w, hh);
    dg.globalCompositeOperation = 'destination-out';
    const toS = (x, y) => [(x - x0) * z * sc, (y - y0) * z * sc];
    const vx1 = x0 + vw / z, vy1 = y0 + vh / z;
    const glows = [];
    const light = (x, y, r, inten = 1) => {
      if (x < x0 - r || x > vx1 + r || y < y0 - r || y > vy1 + r) return;
      const [sx, sy] = toS(x, y); const rr = r * z * sc;
      const g = dg.createRadialGradient(sx, sy, 0, sx, sy, rr);
      g.addColorStop(0, `rgba(0,0,0,${inten})`); g.addColorStop(0.55, `rgba(0,0,0,${inten * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      dg.fillStyle = g; dg.beginPath(); dg.arc(sx, sy, rr, 0, 6.28); dg.fill();
    };
    // player light
    light(p.x, p.y - 20, 210 + (1 - R.regDark) * 40, 0.85);
    if (p.glowUntil > G.now) light(p.x, p.y - 20, 300, 1);
    for (const L of W.lights) {
      if (L.x < x0 - 300 || L.x > vx1 + 300 || L.y < y0 - 300 || L.y > vy1 + 300) continue;
      const fl = 1 - L.fl * (0.5 + 0.5 * Math.sin(t * 9 + L.x * 0.13) * Math.sin(t * 5.3 + L.y));
      light(L.x, L.y, L.r * fl, 1);
      glows.push([L, fl]);
    }
    for (const pr of G.proj) if (!['arrow', 'knife'].includes(pr.vis)) light(pr.x, pr.y, 90, 0.9);
    for (const f of G.fx) if (f.k === 'burst' || f.k === 'ring') light(f.x, f.y, 120, 0.7 * (1 - f.t / f.life));
    for (const e of G.ents) { if (e.near && !e.dead && (e.kind === 'wisp' || e.kind === 'elemental' || e.kind === 'fire_elemental' || e.kind === 'lich' || e.glowLight)) light(e.x, e.y - 20, 120, 0.8); if (e.cast) light(e.x, e.y - 20, 80, 0.7); }
    // windows glow at night
    for (const b of W.buildings) { if (b.px > vx1 || b.px + b.pw < x0 || b.py > vy1 || b.py + b.ph < y0) continue; light(b.door.x, b.door.y + 8, 70, 0.6); }
    dg.globalCompositeOperation = 'source-over';
    ctx.drawImage(dark, 0, 0, vw, vh);
    // warm additive glows
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [L, fl] of glows) {
      const [sx, sy] = [(L.x - x0) * z, (L.y - y0) * z]; const rr = L.r * 0.55 * z * fl;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
      g.addColorStop(0, `rgba(${L.col},${0.22 * darkness + 0.04})`); g.addColorStop(1, `rgba(${L.col},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, rr, 0, 6.28); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- weather ----------
  const drops = [];
  function drawWeather(ctx, vw, vh, t) {
    const wt = G.weather.type;
    const p = G.player; const reg = D.REGIONS[W.regionAtPx(p.x, p.y)];
    const snow = reg.biome === 'snow';
    if (wt === 'rain' || (snow && wt !== 'clear')) {
      while (drops.length < (snow ? 160 : 260)) drops.push({ x: Math.random() * vw, y: Math.random() * vh, s: 0.6 + Math.random() * 0.6 });
      if (snow) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (const d of drops) { d.y += 1.2 * d.s; d.x += Math.sin(t + d.y * 0.02) * 0.6; if (d.y > vh) { d.y = -4; d.x = Math.random() * vw; } ctx.beginPath(); ctx.arc(d.x, d.y, 1.6 * d.s, 0, 6.28); ctx.fill(); } }
      else { ctx.strokeStyle = 'rgba(180,200,230,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); for (const d of drops) { d.y += 14 * d.s; d.x -= 3 * d.s; if (d.y > vh) { d.y = -10; d.x = Math.random() * (vw + 100); } ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 3, d.y + 12 * d.s); } ctx.stroke(); }
    } else drops.length = 0;
    if (wt === 'fog' || reg.biome === 'swamp' || reg.biome === 'gloom') {
      const a = wt === 'fog' ? 0.22 : 0.1;
      ctx.save(); ctx.globalAlpha = a;
      for (let k = 0; k < 5; k++) { const fx = ((t * 12 + k * 260) % (vw + 400)) - 200, fy = vh * (0.15 + k * 0.18); const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 260); g.addColorStop(0, reg.biome === 'gloom' ? 'rgba(120,100,160,1)' : 'rgba(210,215,220,1)'); g.addColorStop(1, 'rgba(210,215,220,0)'); ctx.fillStyle = g; ctx.fillRect(fx - 260, fy - 260, 520, 520); }
      ctx.restore();
    }
    if (reg.biome === 'ash' || reg.biome === 'volcanic') { ctx.fillStyle = reg.biome === 'volcanic' ? 'rgba(255,140,60,0.7)' : 'rgba(200,200,200,0.5)'; for (let k = 0; k < 40; k++) { const x = (k * 97 + t * 20 * (1 + (k % 3))) % vw, y = (k * 53 + t * (reg.biome === 'volcanic' ? -30 : 15)) % vh; ctx.fillRect(x, (y + vh) % vh, 2, 2); } }
  }

  // ---------- minimap ----------
  R.drawMinimap = function (cv, scale = 3, radius = 40) {
    const g = cv.getContext('2d'); const w = cv.width, h = cv.height; const p = G.player;
    const ptx = p.x / TS, pty = p.y / TS;
    g.fillStyle = '#111'; g.fillRect(0, 0, w, h);
    g.imageSmoothingEnabled = false;
    const sw = w / scale, sh = h / scale;
    g.drawImage(W.mapCanvas, ptx - sw / 2, pty - sh / 2, sw, sh, 0, 0, w, h);
    // fog of war
    const EW = W.W >> 2;
    g.fillStyle = 'rgba(8,6,14,0.82)';
    for (let y = Math.floor((pty - sh / 2) / 4); y <= Math.ceil((pty + sh / 2) / 4); y++) for (let x = Math.floor((ptx - sw / 2) / 4); x <= Math.ceil((ptx + sw / 2) / 4); x++) { if (x >= 0 && y >= 0 && x < EW && y < EW && W.explored[y * EW + x]) continue; g.fillRect((x * 4 - ptx + sw / 2) * scale, (y * 4 - pty + sh / 2) * scale, 4 * scale + 1, 4 * scale + 1); }
    const toM = (x, y) => [(x - ptx) * scale + w / 2, (y - pty) * scale + h / 2];
    // tracked quest
    R.drawQuestMarks(g, toM, scale);
    for (const e of G.ents) {
      if (e.dead || e === p) continue; const [mx, my] = toM(e.x / TS, e.y / TS); if (mx < 0 || my < 0 || mx > w || my > h) continue;
      if (e.type === 'mob') { g.fillStyle = D.CON_COLORS[D.conOf(p.level, e.level)]; g.fillRect(mx - 1.5, my - 1.5, e.boss ? 5 : 3, e.boss ? 5 : 3); }
      else if (e.type === 'npc' || e.type === 'king') { const m = KR.Sys.npcMarker(e); if (m) { g.fillStyle = '#ffd84a'; g.font = 'bold 11px sans-serif'; g.fillText(m, mx - 3, my + 4); } else { g.fillStyle = '#7ac8ff'; g.fillRect(mx - 1, my - 1, 2, 2); } }
      else if (e.type === 'guard') { g.fillStyle = e.faction === p.c.faction ? '#5aa8ff' : '#ff5a4a'; g.fillRect(mx - 1, my - 1, 2, 2); }
      else if (e.type === 'merc') { g.fillStyle = '#9affb8'; g.beginPath(); g.arc(mx, my, 2.5, 0, 6.28); g.fill(); }
      else if (e.type === 'pet') { g.fillStyle = '#7aff8a'; g.fillRect(mx - 1, my - 1, 3, 3); }
    }
    for (const pp of KR.Sys.Net.peers) {
      if ((pp.rm || 'main') !== (W.realm || 'main')) continue; let [mx, my] = toM(pp.x / TS, pp.y / TS);
      if (!(KR.Sys.isMate && KR.Sys.isMate(pp))) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(mx, my, 2.5, 0, 6.28); g.fill(); continue; }
      // group mates: a bright dot, or a pointer on the rim when they are beyond the minimap
      const dx = mx - w / 2, dy = my - h / 2, rr = Math.min(w, h) / 2 - 7, d = Math.hypot(dx, dy);
      g.save();
      if (d > rr) { const a = Math.atan2(dy, dx); g.translate(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr); g.rotate(a); g.fillStyle = KR.Sys.GROUP_COL; g.strokeStyle = '#000'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(6, 0); g.lineTo(-4, -5); g.lineTo(-4, 5); g.closePath(); g.fill(); g.stroke(); }
      else { g.fillStyle = KR.Sys.GROUP_COL; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, my, 4, 0, 6.28); g.fill(); g.stroke(); g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeText(String(pp.n || '').slice(0, 10), mx, my - 7); g.fillText(String(pp.n || '').slice(0, 10), mx, my - 7); }
      g.restore();
    }
    // player arrow
    g.save(); g.translate(w / 2, h / 2); g.rotate([Math.PI, Math.PI / 2, -Math.PI / 2, 0][p.dir] || 0); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 6); g.lineTo(-4, -4); g.lineTo(4, -4); g.closePath(); g.fill(); g.stroke(); g.restore();
  };
  R.drawQuestMarks = function (g, toM, scale) {
    const c = G.player.c;
    for (const id in c.quests.active) {
      const st = c.quests.active[id]; if (!st.tracked) continue; const q = KR.Sys.QUESTS[id]; if (!q) continue;
      for (const m of KR.Sys.questTarget(q)) {
        const [mx, my] = toM(m.x, m.y);
        g.strokeStyle = '#ffd84a'; g.fillStyle = 'rgba(255,216,74,0.12)'; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, my, Math.max(6, m.r * scale), 0, 6.28); g.fill(); g.stroke();
        g.fillStyle = '#ffd84a'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText(m.boss ? '☠' : m.npc ? '?' : '!', mx, my + 4); g.textAlign = 'left';
      }
    }
  };
})();

// Kingdom Rising — a map worth reading: every land has a description, and hovering over the map tells you
// what is there (levels, how dangerous it is for you, its bosses, the ore in its rocks, dungeons beneath).
// Shops and halls get their own signs, harbours an anchor, your camp and bind point are marked, and the
// map carries a compass rose and a scale bar. The minimap gets the same signs and a north marker.
(function () {
  const KR = window.KR; const { D, G, U, W, UI } = KR; const Sys = KR.Sys, R = KR.R;
  if (!UI || !UI.drawWorldMap || !R) return;
  const TS = D.TS;

  D.REGION_DESC = {
    aelindor: 'Capital of the Sylvan Court. The elves built it among the great trees on the northern shore. Its sea gate opens onto a busy marina.',
    valenmoor: 'Seat of the Crown of Valen: a walled city of stone and timber on the western bay. It has the king\'s tower, the harbour and the markets.',
    sunleaf: 'Sunlit glades around Aelindor. You will meet rats, wolves and the first orc scouts here. It has copper and oak for new crafters.',
    greywood: 'An old, dark forest where the orc warbands make camp. Treants walk among the trunks.',
    meadowrun: 'Rolling farmland around Valenmoor, the safest country for a young adventurer.',
    thornfield: 'Hedged fields gone wild. Bandits and gnolls hide in the thorn rows.',
    copperdeep: 'Rocky crags rich in copper and iron. The Gnollrock Warren tunnels beneath them.',
    crossroads: 'The wild heart of the realm, where the King\'s Road joins the two kingdoms. War parties march through here.',
    dreadmire: 'A fog-bound swamp of sinking paths and lizardmen, and of things that drown travellers.',
    ashen: 'Burial mounds under ash-grey skies, where the dead do not rest. The Crypt of the Forsaken lies here.',
    ironspine: 'Snowbound peaks with high passes, frost giants and veins of mithril. The Frostfang Caverns lie under the ice.',
    gloamreach: 'A land of endless dusk. Only veterans walk here, and only in company.',
    dragonfall: 'Volcanic crags where the dragons nest. Adamantite runs through the lava rock.',
    blackscar: 'Wastes scorched by an ancient war: the deadliest land on the mainland.',
    desert: 'Wind-carved dunes and buried ruins, home to scorpions and sand wraiths.',
    ocean: 'The open sea. Ships sail from the marinas of both kingdoms.',
    island: 'A warm isle reached by ship. The Sunken Temple lies beneath its reefs.',
    summit: 'The roof of the world, reached only by airship. Storm giants rule here.',
    sewer_crown: 'Tunnels under Valenmoor, reached through the grates in the streets. You will find rats and thieves there, and worse.',
    sewer_sylvan: 'Tunnels under Aelindor, reached through the grates in the streets. You will find rats and thieves there, and worse.',
    gnollrock: 'A warren of gnoll tunnels deep under Copperdeep.',
    crypt: 'Halls of the honoured dead, now desecrated. Bring light.',
    frostfang: 'Ice caves where the white wolves den.',
    sunken: 'A drowned temple to a forgotten sea god.',
    abyss: 'The bottom of the world. Few come back.',
  };
  const BICON = { inn: '🍺', bank: '💰', exchange: '⚖', forge: '🔥', smithy: '⚒', armorer: '🛡', armory: '🛡', weaponsmith: '⚔', bowyer: '🏹', fletcher: '🏹', guild: '📜', scribe: '✒', hall: '🏛', heroes: '🎖', jeweler: '💍', gemcutter: '💎', tailor: '🧵', store: '🛒', kingtower: '👑' };
  const ORE_COL = ['#c87a4a', '#9aa0a8', '#e0e4ea', '#7affd8', '#c86aff', '#ffe27a'];
  const regAt = (tx, ty) => { const i = Math.floor(ty) * W.W + Math.floor(tx); return D.REGIONS[W.region[i]]; };
  const explored = (tx, ty) => { const EW = W.W >> 2; return !!W.explored[(Math.floor(ty) >> 2) * EW + (Math.floor(tx) >> 2)]; };
  const oreName = (t) => { const K = KR.Kingdom; return K && K.MATS && K.MATS['ore' + t] ? K.MATS['ore' + t].name : ['Copper', 'Iron', 'Silver', 'Mithril', 'Adamantite', 'Starmetal'][t] + ' Ore'; };

  // what a land holds, worked out once per world
  let infoCache = null, infoSeed = null;
  function landInfo() {
    if (infoCache && infoSeed === W.decor.length) return infoCache;
    infoCache = {}; infoSeed = W.decor.length;
    for (const d of W.decor) { if (d.kind !== 'orevein') continue; const r = regAt(d.tx, d.ty); if (!r) continue; const o = (infoCache[r.id] = infoCache[r.id] || { ores: new Set() }); o.ores.add(d.ore || 0); }
    return infoCache;
  }
  function describe(r) {
    const p = G.player; const out = { title: r.name, lines: [] };
    if (r.city) { const F = D.FACTIONS[r.city]; out.sub = `${F.name} · ${r.city === p.c.faction ? 'your kingdom' : 'the enemy capital'}`; }
    else if (r.lv && r.lv[1]) { const mid = Math.round((r.lv[0] + r.lv[1]) / 2); const con = D.conOf ? D.conOf(p.level, mid) : 0; out.sub = `Levels ${r.lv[0]}–${r.lv[1]}`; out.con = D.CON_COLORS ? D.CON_COLORS[con] : '#fff'; out.risk = p.level < r.lv[0] - 3 ? 'Deadly for you' : p.level < r.lv[0] ? 'Dangerous for you' : p.level > r.lv[1] + 4 ? 'Easy for you' : 'About right for you'; }
    out.desc = D.REGION_DESC[r.id] || '';
    const bosses = (D.BOSSES || []).filter((b) => b.region === r.id).map((b) => `${b.name} (${b.lv})`); if (bosses.length) out.lines.push(['☠ Bosses', bosses.join(', ')]);
    const li = landInfo()[r.id]; if (li && li.ores.size) out.lines.push(['⛏ Ore', [...li.ores].sort().map(oreName).join(', ')]);
    const dun = (D.DUNGEONS || []).filter((d) => d.near === r.id).map((d) => (D.REGIONS.find((x) => x.id === d.id) || {}).name).filter(Boolean); if (dun.length) out.lines.push(['🕳 Beneath', dun.join(', ')]);
    return out;
  }
  UI.describeRegion = describe;

  // ---- the world map: signs, compass, scale, and a description of whatever is under the pointer ----
  const draw0 = UI.drawWorldMap;
  let lastView = null;
  UI.drawWorldMap = function (cv) {
    draw0.apply(this, arguments);
    const g = cv.getContext('2d'); const p = G.player;
    const v = UI._mapView || { z: 1, cx: W.W / 2, cy: W.H / 2 }; const z = v.z, span = W.W / z, s = cv.width / span;
    const x0 = v.cx - span / 2, y0 = v.cy - span / 2; // the original has already clamped the centre
    lastView = { cv, x0, y0, s, z }; hookMap({ body: cv.parentElement });
    const T2 = (x, y) => [(x - x0) * s, (y - y0) * s];
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    // harbours
    for (const f of D.FACTION_IDS) { const hb = W.cityData && W.cityData[f] && W.cityData[f].harbour; if (!hb) continue; const [a, b] = T2(hb.gx + hb.dx * (hb.k + 4), hb.gy + hb.dy * (hb.k + 4)); g.font = `${U.clamp(12 + z * 1.5, 13, 22)}px sans-serif`; g.fillStyle = '#9ad8ff'; g.fillText('⚓', a, b); if (z >= 2) { g.font = '600 11px "Alegreya Sans", sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText('Marina', a, b + 13); g.fillText('Marina', a, b + 13); } }
    // shops and halls
    if (z >= 2) { g.font = `${U.clamp(9 + z * 1.4, 11, 20)}px sans-serif`; for (const bd of W.buildings) { const ic = BICON[bd.type]; if (!ic) continue; const [a, b] = T2(bd.x + bd.w / 2, bd.y + bd.h / 2 - (z >= 3 ? 1.2 : 0)); if (a < -20 || b < -20 || a > cv.width + 20 || b > cv.height + 20) continue; g.fillText(ic, a, b - (z >= 3 ? 8 : 0)); } }
    // ore veins you have seen
    if (z >= 4) for (const d of W.decor) { if (d.kind !== 'orevein' || !explored(d.tx, d.ty)) continue; const [a, b] = T2(d.tx + 0.5, d.ty + 0.5); if (a < 0 || b < 0 || a > cv.width || b > cv.height) continue; g.fillStyle = ORE_COL[d.ore || 0]; g.strokeStyle = '#000'; g.lineWidth = 1; g.beginPath(); g.arc(a, b, 2.6, 0, 6.28); g.fill(); g.stroke(); }
    // your camp and your bind point
    const c = p.c; g.font = `${U.clamp(12 + z, 14, 22)}px sans-serif`;
    if (c.camp) { const [a, b] = T2(c.camp.tx + 0.5, c.camp.ty + 0.5); g.fillText('⛺', a, b); }
    else if (c.bind && c.bind.x != null) { const [a, b] = T2(c.bind.x / TS, c.bind.y / TS); g.fillText('✚', a, b); }
    // compass rose
    { const R0 = 20, cx = cv.width - R0 - 10, cy = R0 + 12; g.fillStyle = 'rgba(10,8,16,0.55)'; g.beginPath(); g.arc(cx, cy, R0 + 6, 0, 6.28); g.fill(); g.strokeStyle = '#c8a860'; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, R0, 0, 6.28); g.stroke();
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 - Math.PI / 2; g.fillStyle = k === 0 ? '#e8503a' : '#e8dcc0'; g.beginPath(); g.moveTo(cx + Math.cos(a) * R0, cy + Math.sin(a) * R0); g.lineTo(cx + Math.cos(a + 1.57) * 4, cy + Math.sin(a + 1.57) * 4); g.lineTo(cx + Math.cos(a - 1.57) * 4, cy + Math.sin(a - 1.57) * 4); g.closePath(); g.fill(); }
      g.font = '700 10px "Alegreya Sans", sans-serif'; g.fillStyle = '#ffe9a8'; g.fillText('N', cx, cy - R0 - 1); }
    // scale bar: a tile is 1.6 m
    { const m = [50, 100, 250, 500, 1000, 2000].find((mm) => (mm / 1.6) * s > 60) || 2000; const px = (m / 1.6) * s; const x = 12, y = cv.height - 14;
      g.fillStyle = 'rgba(10,8,16,0.6)'; g.fillRect(x - 6, y - 16, px + 12, 24); g.strokeStyle = '#e8dcc0'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x, y); g.lineTo(x + px, y); g.lineTo(x + px, y - 4); g.stroke();
      g.font = '600 10px "Alegreya Sans", sans-serif'; g.fillStyle = '#e8dcc0'; g.fillText(m >= 1000 ? `${m / 1000} km` : `${m} m`, x + px / 2, y - 9); }
    g.restore();
  };

  function hookMap(w) {
    const b = w && w.body; if (!b) return; const cv = b.querySelector('canvas.mapcv'); if (!cv || cv._info) return; cv._info = true;
    const box = document.createElement('div'); box.className = 'map-info'; box.hidden = true; b.style.position = 'relative'; b.appendChild(box);
    const leg = b.querySelector('.map-legend'); if (leg) leg.innerHTML = '<span>● You</span><span class="gold">◯ Tracked quest</span><span>🏰 Capital</span><span>⚓ Marina</span><span>⛺ Your camp</span><span>✚ Bind point</span><span>⛏ Dungeon</span><span>🍺 Inn · 💰 Bank · ⚒ Smith · 🔥 Forge · 👑 King</span><span>Zoom in to see ore veins</span><span class="dim">Hover a land to read about it</span>';
    cv.addEventListener('mousemove', (e) => {
      const v = lastView; if (!v) return; const r = cv.getBoundingClientRect(); const px = (e.clientX - r.left) * (cv.width / r.width), py = (e.clientY - r.top) * (cv.height / r.height);
      const tx = v.x0 + px / v.s, ty = v.y0 + py / v.s; if (tx < 0 || ty < 0 || tx >= W.W || ty >= W.H) { box.hidden = true; return; }
      if (!explored(tx, ty)) { box.innerHTML = '<b>Unexplored</b><p class="dim">Nobody has mapped this land for you yet.</p>'; }
      else {
        const reg = regAt(tx, ty); if (!reg) { box.hidden = true; return; } const d = describe(reg);
        const bd = W.buildings.find((q) => tx >= q.x && tx < q.x + q.w && ty >= q.y && ty < q.y + q.h && q.name);
        box.innerHTML = (bd ? `<b>${UI.esc(bd.name)}</b><p class="dim">${BICON[bd.type] || '🏠'} in ${reg.name}</p>` : '') + `<b>${d.title}</b>${d.sub ? `<div style="color:${d.con || '#e8dcc0'}">${d.sub}${d.risk ? ' · ' + d.risk : ''}</div>` : ''}${d.desc ? `<p>${d.desc}</p>` : ''}${d.lines.map(([k, t]) => `<div><span class="gold">${k}:</span> ${t}</div>`).join('')}`;
      }
      box.hidden = false; const bx = e.clientX - b.getBoundingClientRect().left + 16, by = e.clientY - b.getBoundingClientRect().top + 12; box.style.left = Math.min(bx, b.clientWidth - 270) + 'px'; box.style.top = Math.min(by, b.clientHeight - box.offsetHeight - 6) + 'px';
    });
    cv.addEventListener('mouseleave', () => (box.hidden = true));
  }

  // ---- the minimap: north marker, marinas, shops, your camp, and the land's description on hover ----
  const mm0 = R.drawMinimap;
  R.drawMinimap = function (cv, scale = 3) {
    mm0.apply(this, arguments);
    const g = cv.getContext('2d'); const p = G.player; const w = cv.width, h = cv.height; const ptx = p.x / TS, pty = p.y / TS;
    const toM = (x, y) => [(x - ptx) * scale + w / 2, (y - pty) * scale + h / 2]; const inside = (a, b) => a > 4 && b > 4 && a < w - 4 && b < h - 4;
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const f of D.FACTION_IDS) { const hb = W.cityData && W.cityData[f] && W.cityData[f].harbour; if (!hb) continue; const [a, b] = toM(hb.gx + hb.dx * (hb.k + 4), hb.gy + hb.dy * (hb.k + 4)); if (inside(a, b)) { g.font = '13px sans-serif'; g.fillText('⚓', a, b); } }
    if (scale >= 2.5) { g.font = `${scale >= 4 ? 13 : 11}px sans-serif`; for (const bd of W.buildings) { const ic = BICON[bd.type]; if (!ic) continue; const [a, b] = toM(bd.x + bd.w / 2, bd.y + bd.h / 2); if (inside(a, b)) g.fillText(ic, a, b); } }
    if (scale >= 4) for (const d of W.decor) { if (d.kind !== 'orevein') continue; const [a, b] = toM(d.tx + 0.5, d.ty + 0.5); if (!inside(a, b) || !explored(d.tx, d.ty)) continue; g.fillStyle = ORE_COL[d.ore || 0]; g.beginPath(); g.arc(a, b, 2.2, 0, 6.28); g.fill(); }
    const c = p.c; if (c.camp) { const [a, b] = toM(c.camp.tx + 0.5, c.camp.ty + 0.5); g.font = '13px sans-serif'; if (inside(a, b)) g.fillText('⛺', a, b); }
    g.font = '700 11px "Alegreya Sans", sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText('N', w / 2, 8); g.fillStyle = '#ffe9a8'; g.fillText('N', w / 2, 8);
    g.restore();
    const reg = D.REGIONS[W.regionAtPx(p.x, p.y)]; if (reg && cv._reg !== reg.id) { cv._reg = reg.id; const d = describe(reg); cv.title = `${d.title}${d.sub ? ' — ' + d.sub : ''}${d.risk ? ' (' + d.risk + ')' : ''}\n${d.desc}${d.lines.map(([k, t]) => '\n' + k + ': ' + t).join('')}\n\nClick to open the map (M)`; }
  };
})();

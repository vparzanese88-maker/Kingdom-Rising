// Kingdom Rising — what each monster is weak to and what it shrugs off, shown on the target frame,
// plus the "Interrupted" cast bar
(function () {
  const KR = window.KR; const { D, G, U } = KR; const UI = KR.UI;
  const A = (KR.Aff = {});
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  A.TYPES = {
    slash: { icon: '⚔', name: 'Slashing', what: 'swords and axes' },
    pierce: { icon: '🗡', name: 'Piercing', what: 'daggers, spears, arrows and thrown weapons' },
    blunt: { icon: '🔨', name: 'Blunt', what: 'maces, hammers, staves and fists' },
    fire: { icon: '🔥', name: 'Fire', what: 'fire spells and burning attacks' },
    cold: { icon: '❄', name: 'Cold', what: 'frost and ice spells' },
    poison: { icon: '🧪', name: 'Poison', what: 'poisons and venom' },
    disease: { icon: '🦠', name: 'Disease', what: 'plagues and rot' },
    magic: { icon: '✨', name: 'Magic', what: 'arcane and holy spells' },
  };
  A.WEAK_MUL = 1.35;
  const PHYS = ['slash', 'pierce', 'blunt'];
  // by creature type: weaknesses and resistances (0-100)
  const KIND = {
    skeleton: { weak: ['blunt'], res: { pierce: 45, slash: 20, poison: 60, disease: 60, cold: 30 } },
    zombie: { weak: ['fire', 'slash'], res: { poison: 60, disease: 60 } },
    deathknight: { weak: ['blunt'], res: { cold: 40, poison: 50, disease: 50 } },
    ghost: { weak: ['magic'], res: { slash: 50, pierce: 50, blunt: 50, poison: 80, disease: 80, cold: 40 } },
    wisp: { weak: ['cold'], res: { slash: 40, pierce: 40, blunt: 40, magic: 40 } },
    lich: { weak: ['fire'], res: { cold: 50, poison: 70, disease: 70 } },
    spider: { weak: ['fire'], res: { poison: 60 } },
    beetle: { weak: ['blunt'], res: { pierce: 40, slash: 20 } },
    mosquito: { weak: ['fire', 'blunt'], res: {} },
    bat: { weak: ['pierce'], res: { disease: 40 } },
    wolf: { weak: ['fire'], res: {} }, spiritwolf: { weak: ['magic'], res: { cold: 40 } },
    bear: { weak: ['fire'], res: { blunt: 20, cold: 30 } },
    tiger: { weak: ['fire'], res: {} }, boar: { weak: ['pierce'], res: { blunt: 20 } },
    snake: { weak: ['cold'], res: { poison: 60 } }, croc: { weak: ['cold'], res: { slash: 20, pierce: 20 } }, lizard: { weak: ['cold'], res: { poison: 30 } },
    troll: { weak: ['fire'], res: { poison: 30, disease: 30 } },
    golem: { weak: ['blunt'], res: { slash: 50, pierce: 60, poison: 100, disease: 100 } },
    giant: { weak: ['pierce'], res: { blunt: 30, cold: 30 } }, ogre: { weak: ['pierce'], res: { blunt: 20 } },
    drake: { weak: ['cold'], res: { fire: 60 } }, dragon: { weak: ['cold'], res: { fire: 70, slash: 20, pierce: 20 } },
    griffon: { weak: ['pierce'], res: {} }, harpy: { weak: ['pierce'], res: {} },
    treant: { weak: ['fire', 'slash'], res: { pierce: 40, blunt: 30, poison: 50 } }, scarecrow: { weak: ['fire', 'slash'], res: { pierce: 40, poison: 80, disease: 80 } },
    fire_elemental: { weak: ['cold'], res: { fire: 100, poison: 100, disease: 100 } },
    water_elemental: { weak: ['cold'], res: { fire: 60, poison: 100, slash: 30 } },
    air_elemental: { weak: ['magic'], res: { pierce: 40, slash: 30, poison: 100 } },
    earth_elemental: { weak: ['magic'], res: { slash: 40, pierce: 40, poison: 100 } },
    elemental: { weak: ['magic'], res: { poison: 100, disease: 100 } },
    rat: { weak: [], res: { disease: 40 } },
    orc: { weak: [], res: {} }, goblin: { weak: [], res: {} }, bandit: { weak: [], res: {} },
  };
  // names that tell you more than the kind does
  const NAMED = [
    [/fire|ember|flame|magma|cinder|salamander|lava|ash_|scorch|burn/, { weak: ['cold'], res: { fire: 70 }, drop: ['fire'] }],
    [/frost|ice|snow|yeti|rime|glaci|winter|whitefang|frostmaw/, { weak: ['fire'], res: { cold: 70 }, drop: ['cold'] }],
    [/bone|skel/, { weak: ['blunt'] }],
    [/plague|bog|rot|blight|carrion/, { res: { disease: 50 } }],
    [/stone|rock|iron|crystal|coral/, { weak: ['blunt'], res: { slash: 30, pierce: 30 } }],
    [/shadow|void|abyss|umbra/, { weak: ['magic'], res: { cold: 30 } }],
  ];
  // work out a monster's profile from its kind, its name and any resistances it already had
  A.profile = function (id, kind, name, baseRes, undead) {
    const weak = new Set(), res = {}; const add = (P) => { if (!P) return; (P.weak || []).forEach((w) => weak.add(w)); for (const k in P.res || {}) res[k] = Math.max(res[k] || 0, P.res[k]); (P.drop || []).forEach((w) => weak.delete(w)); };
    add(KIND[kind]);
    const n = ((id || '') + ' ' + (name || '')).toLowerCase();
    for (const [re, P] of NAMED) if (re.test(n)) add(P);
    if (undead) { add({ res: { poison: 50, disease: 50 } }); if (!KIND[kind] || !(KIND[kind].weak || []).length) weak.add('fire'); }
    for (const k in baseRes || {}) { const v = baseRes[k]; if (v <= -20) { weak.add(k); delete res[k]; } else res[k] = Math.max(res[k] || 0, v); }
    for (const w of weak) if ((res[w] || 0) >= 40) weak.delete(w); // a monster can't be weak to what it resists
    for (const w of weak) delete res[w];
    return { weak: [...weak], res };
  };
  const apply = (e, id, kind, name) => {
    if (!e || e.type !== 'mob') return;
    const P = A.profile(id, kind, name, e.res, e.undead); e.aff = P; e.res = e.res || {};
    // spell resistances use the same numbers; weaknesses make spells land more often
    for (const k of ['fire', 'cold', 'poison', 'disease', 'magic']) { if (P.res[k]) e.res[k] = Math.max(e.res[k] || 0, P.res[k]); if (P.weak.includes(k)) e.res[k] = Math.min(e.res[k] || 0, -30); }
  };
  // only people (and people-shaped things) use bows; beasts bite and claw, casters cast
  A.HUMANOID = new Set(['bandit', 'orc', 'goblin', 'skeleton', 'lizard', 'guard', 'troll', 'ogre', 'giant', 'deathknight', 'zombie', 'scarecrow', 'lich', 'ghost', 'pirate', 'gnoll', 'kobold']);
  const BOW_ABILITIES = ['pinshot', 'volley', 'snareshot'];
  const humanize = (e, kind) => {
    if (!e || e.type !== 'mob') return;
    if (!A.HUMANOID.has(kind)) { if (e.ranged === 'archer') e.ranged = null; if (e.mabil) e.mabil = e.mabil.filter((k) => !BOW_ABILITIES.includes(k)); e.proj = null; }
  };
  const sm0 = G.spawnMob; G.spawnMob = function (sp, mobId, lv, opt) { const e = sm0.apply(this, arguments); try { const M = D.MOBS[mobId]; apply(e, mobId, M && M.kind, M && M.name); humanize(e, M && M.kind); } catch (er) {} return e; };
  const sb0 = G.spawnBoss; G.spawnBoss = function (sp, b) { const e = sb0.apply(this, arguments); try { apply(e, b.id, b.kind, b.name); } catch (er) {} return e; };

  // damage type of a hit, when the caller didn't say
  const WT = { '1HS': 'slash', '2HS': 'slash', '1HP': 'pierce', '1HB': 'blunt', '2HB': 'blunt', H2H: 'blunt', ARC: 'pierce', THR: 'pierce', TOME: 'magic', GUN: 'pierce' };
  const SHOT = { ARC: 'pierce', THR: 'pierce', TOME: 'magic', GUN: 'pierce', fire: 'fire', cold: 'cold', magic: 'magic', poison: 'poison', disease: 'disease' };
  const shoot0 = G.shoot; G.shoot = function (src, tgt, kind, dmg, opt = {}) { if (!opt.dtype && SHOT[kind]) opt.dtype = SHOT[kind]; return shoot0.call(this, src, tgt, kind, dmg, opt); };
  const dmg0 = G.damage;
  G.damage = function (src, tgt, amt, opt = {}) {
    if (tgt && tgt.aff && amt > 0) {
      let dt = opt.dtype;
      if (!dt && src && src.c && src.c.equip && !opt.spell && !opt.dot) { const w = src.c.equip.primary; dt = w ? WT[w.wt] : 'blunt'; }
      if (dt) {
        if (tgt.aff.weak.includes(dt)) { amt = Math.round(amt * A.WEAK_MUL); if (src === G.player && (!tgt._weakShown || G.now - tgt._weakShown > 6000)) { tgt._weakShown = G.now; G.float(tgt, `weak to ${A.TYPES[dt].name.toLowerCase()}!`, '#ffd84a'); } }
        else if (PHYS.includes(dt) && tgt.aff.res[dt]) { amt = Math.max(1, Math.round(amt * (1 - tgt.aff.res[dt] / 200))); if (src === G.player && (!tgt._resShown || G.now - tgt._resShown > 8000)) { tgt._resShown = G.now; G.float(tgt, 'resists ' + A.TYPES[dt].name.toLowerCase(), '#a8a8b8'); } }
      }
    }
    return dmg0.call(this, src, tgt, amt, opt);
  };

  // ---------------------------------------------------------------- target frame icons
  const lvl = (v) => (v >= 90 ? 'immune' : v >= 60 ? 'very high' : v >= 40 ? 'high' : 'some');
  function tipFor(kind, t, isWeak, v) {
    const T = A.TYPES[t];
    if (isWeak) return `<b style="color:#ffd84a">${T.icon} Weak to ${T.name}</b><div>${PHYS.includes(t) ? `Attacks with ${T.what} deal ${Math.round((A.WEAK_MUL - 1) * 100)}% more damage.` : `${T.name} spells land more often and deal ${Math.round((A.WEAK_MUL - 1) * 100)}% more damage.`}</div>`;
    return `<b style="color:#c8c8d8">${T.icon} Resists ${T.name} (${lvl(v)})</b><div>${PHYS.includes(t) ? `Attacks with ${T.what} deal ${Math.round(v / 2)}% less damage.` : v >= 90 ? `${T.name} spells almost never work on it.` : `${T.name} spells are often resisted or only partly land.`}</div>`;
  }
  let sig = '';
  function frameTick() {
    const tf = document.querySelector('.hud-target'); if (!tf) return; let row = document.getElementById('tf-aff');
    if (!row) { row = document.createElement('div'); row.id = 'tf-aff'; row.className = 'tf-aff'; const sub = document.getElementById('tf-sub'); if (sub) sub.after(row); else tf.appendChild(row); }
    const p = G.player; const t = p && p.target; const P = t && !t.removed && t.type === 'mob' && t.aff;
    const s = P ? t.id + ':' + P.weak.join(',') + '|' + Object.entries(P.res).filter(([, v]) => v >= 40).map(([k, v]) => k + v).join(',') : '';
    if (s === sig) return; sig = s; row.innerHTML = ''; row.hidden = !P; if (!P) return;
    const mk = (t2, isWeak, v) => { const el = document.createElement('span'); el.className = 'aff ' + (isWeak ? 'weak' : 'res'); el.innerHTML = `${A.TYPES[t2].icon}`; el.setAttribute('aria-label', (isWeak ? 'Weak to ' : 'Resists ') + A.TYPES[t2].name); UI.bindTip(el, () => tipFor('', t2, isWeak, v)); row.appendChild(el); };
    if (P.weak.length) { const l = document.createElement('small'); l.textContent = 'Weak'; row.appendChild(l); P.weak.forEach((w) => mk(w, true)); }
    const rs = Object.entries(P.res).filter(([, v]) => v >= 40).sort((a, b) => b[1] - a[1]);
    if (rs.length) { const l = document.createElement('small'); l.textContent = 'Resists'; l.className = 'r'; row.appendChild(l); rs.forEach(([k, v]) => mk(k, false, v)); }
    if (!P.weak.length && !rs.length) { const l = document.createElement('small'); l.className = 'none'; l.textContent = 'No known weaknesses'; row.appendChild(l); }
  }

  // ---------------------------------------------------------------- "Interrupted" on the cast bar
  const int0 = G.interrupt;
  G.interrupt = function (e, msg) { if (e === G.player && e.cast) { e.interrupted = { at: G.now, name: e.cast.spell && e.cast.spell.name }; } return int0.apply(this, arguments); };
  function castTick() {
    const p = G.player; if (!p) return;
    // being stunned, mezzed or feared breaks a spell or song
    if (p.cast && (p.stun > 0 || p.mez > 0 || p.fear > 0)) G.interrupt(p, 'You lose your concentration and your spell is interrupted!');
  }
  // run after the HUD refresh each frame
  const hud0 = UI.tick || null;
  function loop() { try { if (G.player && !document.getElementById('ui').hidden) { frameTick(); castTick(); } } catch (e) {} requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
})();

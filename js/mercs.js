// Kingdom Rising — mercenaries: hiring, stances, gear, ability toggles and companion AI
(function () {
  const KR = window.KR;
  const D = KR.D, U = KR.U, W = KR.W, G = KR.G, Sys = KR.Sys;
  const TS = D.TS;

  Sys.STANCES = {
    standard: { name: 'Standard', desc: 'A little of everything. Fights, heals when someone is hurt, and holds enemies if built to tank.', healAt: 0.6, dmg: 1, taken: 1, taunt: true, buffs: true },
    healing: { name: 'Focus healing', desc: 'Keeps the group alive first. Heals early and only fights with spare mana.', healAt: 0.85, dmg: 0.85, taken: 1, taunt: false, buffs: true, healFirst: true },
    damage: { name: 'Focus damage', desc: 'All-out offense. Hits 25% harder and heals only in emergencies.', healAt: 0.35, dmg: 1.25, taken: 1.1, taunt: false, buffs: false },
    defense: { name: 'Focus defense', desc: 'Takes 25% less damage, taunts enemies off allies, hits softer.', healAt: 0.55, dmg: 0.85, taken: 0.75, taunt: true, alwaysTaunt: true, buffs: true },
  };
  const TANKS = ['warrior', 'paladin', 'shadowknight'];
  Sys.MERC_TANKS = TANKS;
  Sys.mercRole = (cls) => (TANKS.includes(cls) ? 'Tank' : ['cleric', 'druid', 'shaman'].includes(cls) ? 'Healer' : ['enchanter', 'bard', 'beastlord'].includes(cls) ? 'Support' : 'Damage');
  // mercenaries are for hire from Kingdom Level 2: one slot then, and one more each level after (4 at level 5)
  Sys.MERC_MIN_KL = 2;
  // mercenaries sign once your kingdom has a Barracks: two to start, one more each for the Archery Range and the Stable
  Sys.mercsOpen = (f) => !KR.War || !KR.War.hasB || KR.War.hasB(f, 'barracks');
  Sys.mercSlots = () => { if (!G.player) return 0; const f = G.player.c.faction; if (!Sys.mercsOpen(f)) return 0; return Math.min(4, 2 + (KR.War && KR.War.hasB ? ['range', 'stable'].filter((x) => KR.War.hasB(f, x)).length : 2)); };
  // a contract costs more as you level, and each mercenary you already lead makes the next one dearer (+50%)
  Sys.mercCost = (lv, have) => { if (have == null) have = G.player ? (G.player.c.mercs || []).length : 0; return Math.round((100 + lv * lv * 30) * (1 + 0.5 * have)); };

  // ---------- trader offers (refresh every in-game day) ----------
  Sys.mercOffers = function () {
    const c = G.player.c, a = G.account; const day = a.day || 0;
    if (!c.mercOffers || c.mercOffers.day !== day) {
      const rnd = U.mulberry((day + 1) * 7919 + c.id.length * 31 + c.created % 1000);
      const F = D.FACTIONS[c.faction];
      const classes = D.CLASS_IDS.slice().sort(() => rnd() - 0.5).slice(0, 5);
      const used = new Set((c.mercs || []).map((m) => m.name));
      const list = classes.map((cls) => {
        let races = F.races.filter((r) => D.RACES[r].classes.includes(cls));
        if (!races.length) races = Object.keys(D.RACES).filter((r) => D.RACES[r].classes.includes(cls));
        const race = races[Math.floor(rnd() * races.length)];
        const gender = rnd() < 0.5 ? 'm' : 'f'; const NM = D.NAMES[c.faction] || D.NAMES[D.RACES[race].faction];
        let name; do { name = NM[gender][Math.floor(rnd() * NM[gender].length)] + ' ' + NM.last[Math.floor(rnd() * NM.last.length)]; } while (used.has(name) && used.size < 40); used.add(name);
        return { oid: U.uid(), name, race, cls, gender, skin: Math.floor(rnd() * 5), hair: Math.floor(rnd() * 8), hairStyle: Math.floor(rnd() * 4) };
      });
      c.mercOffers = { day, list };
    }
    return c.mercOffers.list;
  };
  Sys.hoursToNewMercs = () => (1440 - G.clock) / 60;

  function starterGear(data) {
    const C = D.CLASSES[data.cls], lv = data.level, tier = G.tierOfLevel(lv);
    let wt = C.role === 'caster' ? (C.weapons.includes('2HB') ? '2HB' : C.weapons[0]) : TANKS.includes(data.cls) ? '1HS' : data.cls === 'monk' ? 'H2H' : data.cls === 'rogue' ? '1HP' : C.weapons[0];
    if (!C.weapons.includes(wt)) wt = C.weapons[0];
    const eq = {};
    eq.primary = G.makeWeapon(wt, tier, { ilvl: lv, q: 0.95 });
    if (C.shield && TANKS.includes(data.cls)) eq.secondary = G.makeShield(tier, { ilvl: lv, q: 0.95 });
    for (const sl of ['chest', 'legs', 'head']) eq[sl] = G.makeArmor(C.armor, sl, tier, { ilvl: lv, q: 0.95 });
    if (C.ranged.includes('TOME')) eq.range = G.makeWeapon('TOME', tier, { ilvl: lv, q: 0.95 });
    for (const k in eq) eq[k].req = 1;
    return eq;
  }

  Sys.hireMerc = function (offer) {
    const p = G.player, c = p.c; c.mercs = c.mercs || [];
    if (!Sys.mercsOpen(c.faction)) { G.log(`No mercenary will sign until ${D.FACTIONS[c.faction].city} has a Barracks.`, 'sys', '#ffb24a'); KR.A.sfx('fail', 0.5); return; }
    if (c.mercs.length >= Sys.mercSlots()) { G.log(`You can lead ${Sys.mercSlots()} mercenar${Sys.mercSlots() > 1 ? 'ies' : 'y'}. ${Sys.mercSlots() < 4 ? 'Build an Archery Range and a Stable for more.' : ''}`, 'sys', '#ffb24a'); KR.A.sfx('fail', 0.5); return; }
    const cost = Sys.mercCost(c.level);
    if (c.coins < cost) { G.log("You can't afford that mercenary's contract.", 'sys', '#ff8a6a'); KR.A.sfx('fail', 0.5); return; }
    c.coins -= cost;
    const data = { id: U.uid(), name: offer.name, race: offer.race, cls: offer.cls, gender: offer.gender, skin: offer.skin, hair: offer.hair, hairStyle: offer.hairStyle, faction: c.faction,
      level: c.level, alloc: {}, bonus: {}, wskill: {}, school: {}, stance: TANKS.includes(offer.cls) ? 'defense' : ['cleric', 'druid', 'shaman'].includes(offer.cls) ? 'healing' : 'standard', off: {} };
    D.STATS.forEach((s) => (data.alloc[s] = 0));
    data.equip = starterGear(data);
    c.mercs.push(data);
    c.mercOffers.list = c.mercOffers.list.filter((o) => o.oid !== offer.oid);
    Sys.spawnMerc(data);
    KR.A.sfx('coin', 0.6); KR.A.sfx('quest', 0.6);
    G.log(`${data.name} the ${D.RACES[data.race].name} ${D.CLASSES[data.cls].name} joins you for ${G.fmtCoins(cost)}.`, 'sys', '#9affb8');
    KR.UI && KR.UI.refresh(); Sys.save();
  };
  Sys.dismissMerc = function (m) {
    const p = G.player, c = p.c;
    for (const sl in m.c.equip) if (m.c.equip[sl]) { if (!Sys.addItem(m.c.equip[sl], true)) G.account.bank.items[G.account.bank.items.indexOf(null)] = m.c.equip[sl]; }
    c.mercs = c.mercs.filter((x) => x !== m.c);
    p.mercs = p.mercs.filter((x) => x !== m);
    if (m.pet) { G.remove(m.pet); m.pet = null; }
    for (const e of G.ents) if (e.hate) e.hate.delete(m);
    G.remove(m);
    G.log(`${m.name} leaves your service. Their gear has been returned to your bags.`, 'sys', '#ccc');
    KR.UI && KR.UI.refresh(); Sys.save();
  };

  Sys.spawnMerc = function (data) {
    const p = G.player; p.mercs = p.mercs || [];
    data.level = p.c.level;
    const i = p.mercs.length;
    const m = G.makeEnt({ type: 'merc', owner: p, c: data, name: data.name, x: p.x - 30 - i * 16, y: p.y + 20, r: 11, hostile: false, faction: p.c.faction, title: `${Sys.mercRole(data.cls)} · ${D.CLASSES[data.cls].name}` });
    m.hp = null; m.mana = null; G.recalc(m); m.atkT = 1; m.gcd = 0; m.thinkT = 0;
    p.mercs.push(m);
    return m;
  };
  Sys.spawnAllMercs = function () { const p = G.player; for (const m of p.mercs || []) { if (m.pet) G.remove(m.pet); G.remove(m); } p.mercs = []; for (const d of p.c.mercs || []) Sys.spawnMerc(d); };
  Sys.syncMercLevels = function () { const p = G.player; for (const m of p.mercs || []) { m.c.level = p.c.level; G.recalc(m); m.hp = m.hpMax; m.mana = m.manaMax; m._abKey = null; } };

  Sys.applyStance = function (m) {
    const C = D.CLASSES[m.c.cls]; const cap = D.weaponSkillCap(m.c.level);
    for (const wt of C.weapons.concat(C.ranged, ['H2H'])) m.c.wskill[wt] = cap;
    for (const sc of D.SCHOOLS) m.c.school[sc] = D.schoolSkillCap(m.c.level);
    const st = Sys.STANCES[m.c.stance] || Sys.STANCES.standard;
    m.dmgMul *= st.dmg; m.spellMul *= st.dmg; m.dmgTaken = (m.dmgTaken || 1) * st.taken;
  };
  Sys.setStance = function (m, s) { m.c.stance = s; G.recalc(m); G.log(`${m.name} switches to ${Sys.STANCES[s].name}.`, 'sys', '#9affb8'); KR.A.sfx('click'); KR.UI && KR.UI.refresh(); };

  // ---------- abilities ----------
  const SKIP_SPELL = ['gate', 'fd', 'bind', 'charm'];
  const SKIP_SKILL = ['evade', 'hide', 'fading', 'feigndeath', 'layonhands_never'];
  Sys.mercAbilities = function (mc) {
    const C = D.CLASSES[mc.cls], L = mc.level, out = [];
    for (const [id, lv] of C.skills) { const s = D.SKILLS[id]; if (lv > L || s.passive || SKIP_SKILL.includes(id)) continue; out.push({ key: 'skill:' + id, a: { k: 'skill', id }, def: Object.assign({ id, kind: 'skill' }, s) }); }
    const add = (wt) => { if (!wt) return; D.WEAPON_ABILITIES[wt].forEach((ab, i) => { if (D.weaponSkillCap(L) >= D.WEAPON_UNLOCKS[i]) out.push({ key: 'weapon:' + wt + ':' + i, a: { k: 'weapon', id: wt + ':' + i }, def: G.actionDef({ k: 'weapon', id: wt + ':' + i }) }); }); };
    add(mc.equip.primary ? mc.equip.primary.wt : 'H2H'); if (mc.equip.range) add(mc.equip.range.wt); if (mc.equip.secondary && mc.equip.secondary.shield) add('SHIELD');
    const best = {};
    for (const id of D.CLASS_SPELLS[mc.cls] || []) { const sp = D.SPELLS[id]; if (sp.level > L || SKIP_SPELL.includes(sp.type)) continue; const line = id.split('_')[1]; if (!best[line] || best[line].level < sp.level) best[line] = sp; }
    Object.values(best).sort((a, b) => a.level - b.level).forEach((sp) => out.push({ key: 'spell:' + sp.id, a: { k: 'spell', id: sp.id }, def: sp }));
    for (const x of out) x.cat = catOf(x.def);
    return out;
  };
  function catOf(def) {
    const e = def.effects || [];
    if (def.kind === 'spell') {
      if (def.type === 'pet') return 'pet';
      if (def.type === 'pethl') return 'petheal';
      if (def.type === 'pethaste') return 'petbuff';
      if (['mez', 'fear', 'root'].includes(def.type)) return 'cc';
      if (def.type === 'sow') return 'buff';
      if (['heal', 'hot'].includes(def.type)) return 'heal';
      if (['buff_ac', 'buff_hp', 'buff_stat', 'haste', 'regen', 'clarity', 'ds', 'rune'].includes(def.type)) return 'buff';
      if (def.type === 'dmgbuff') return 'selfbuff';
      return 'attack';
    }
    if (e.some((x) => x.t === 'healpct')) return def.id === 'layonhands' ? 'bigheal' : 'selfheal';
    if (e.some((x) => x.t === 'taunt')) return 'taunt';
    if (e.some((x) => x.t === 'mana' && !x.ranged) && (def.target === 'self')) return 'mana';
    if (e.some((x) => x.t === 'cannibal')) return 'mana';
    if (def.target === 'self') return 'selfbuff';
    return 'attack';
  }
  Sys.mercAbCached = function (m) { const key = m.c.level + '|' + (m.c.equip.primary ? m.c.equip.primary.wt : '') + '|' + (m.c.equip.range ? m.c.equip.range.wt : ''); if (m._abKey !== key) { m._abKey = key; m._ab = Sys.mercAbilities(m.c); } return m._ab; };

  function ready(m, x) { const d = x.def; if ((m.cds[x.key] || 0) > G.now) return false; if (d.kind === 'spell' && m.gcd > G.now) return false; if (d.mana && m.mana < d.mana * G.LOW_MIN) return false; if (m.c.off && m.c.off[x.key]) return false; return true; }
  function inRange(m, x, t) {
    const d = x.def; const dist = Math.hypot(t.x - m.x, t.y - m.y);
    if (d.target === 'pbae') return dist < (d.radius || 110) * 0.8;
    const r = d.range === 'melee' || (!d.range && d.kind !== 'spell') ? G.meleeRange(m, t) + 6 : d.range || 420;
    if (dist > r) return false;
    if (d.kind === 'spell' && !W.lineClear(m.x, m.y - 20, t.x, t.y - 20)) return false;
    return true;
  }
  function use(m, x, tgt) {
    const d = x.def;
    if (d.kind === 'spell' && d.cast > 0) { m.cast = { spell: d, x, t: 0, dur: d.cast, tgt }; m.moving = false; return true; }
    exec(m, x, tgt); return true;
  }
  function exec(m, x, tgt) {
    let d = x.def;
    const low = d.mana && m.mana < d.mana;
    if (d.mana) m.mana = Math.max(0, m.mana - d.mana);
    if (low) d = G.weakDef(d);
    if (G.animFor(d) === 'kick') m.kickT = 0.01;
    m.cds[x.key] = G.now + Math.max(d.cd || 0, d.kind === 'spell' ? 2.5 : 0) * 1000;
    if (d.kind === 'spell') m.gcd = G.now + 1500;
    G.applyAll(m, tgt, d);
  }

  // ---------- AI ----------
  Sys.updateMerc = function (m, dt) {
    const p = m.owner, c = m.c;
    if (m.dead) {
      if (m.reviveAt && G.now > m.reviveAt && !p.dead && !G.inCombat(p)) { m.dead = false; m.hp = Math.round(m.hpMax * 0.5); m.mana = Math.round(m.manaMax * 0.5); m.x = p.x - 30; m.y = p.y + 20; m.buffs = []; m.stun = m.root = m.mez = m.fear = 0; G.log(`${m.name} has recovered and rejoins you.`, 'sys', '#9affb8'); G.fxAdd({ k: 'ring', x: m.x, y: m.y, r: 40, col: '#9affb8', life: 0.8 }); }
      return;
    }
    G.statusTick(m, dt); if (m.dead) return;
    if (m.atk > 0) { m.atk += dt * 4; if (m.atk > 1) m.atk = 0; }
    const st = Sys.STANCES[c.stance] || Sys.STANCES.standard;
    const fighting = G.inCombat(p) || !!(m.target && !m.target.dead && m.target.inCombat);
    // regen
    m.hp = Math.min(m.hpMax, m.hp + (0.25 + c.level * 0.06 + m.regenB) * (fighting ? 0.4 : 1.6) * dt);
    if (m.manaMax) m.mana = Math.min(m.manaMax, m.mana + (0.3 + c.level * 0.035 + m.manaRegenB) * (fighting ? 0.5 : 1.6) * dt);
    if (m.stun > 0 || m.mez > 0) { m.moving = false; return; }
    // casting
    if (m.cast) {
      m.cast.t += dt; const cs = m.cast;
      if (!cs.tgt || cs.tgt.dead || cs.tgt.removed) m.cast = null;
      else if (cs.t >= cs.dur) { m.cast = null; if (m.mana >= (cs.spell.mana || 0) * G.LOW_MIN) exec(m, cs.x, cs.tgt); }
      if (cs.tgt) G.faceTo(m, cs.tgt);
      return;
    }
    const ab = Sys.mercAbCached(m);
    m.thinkT -= dt;
    const party = G.party(p);
    if (m.thinkT <= 0) {
      m.thinkT = 0.35;
      // 1. healing
      const heals = ab.filter((x) => (x.cat === 'heal' || x.cat === 'bigheal' || x.cat === 'selfheal') && ready(m, x));
      if (heals.length) {
        // in Focus healing the hero always comes first; with the group healthy, a healer tends the wounded soldiers of your war party nearby
        let hurt = st.healFirst && !p.dead && p.hp / p.hpMax < st.healAt ? p : party.filter((e) => e.hp / e.hpMax < st.healAt).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
        if (!hurt && heals.some((x) => x.cat === 'heal' || x.cat === 'bigheal')) {
          const cut = Math.min(st.healAt, 0.7); let bs = cut;
          for (const o of G.ents) { if (!o.raider || o.dead || o.removed || o.ram || o.nonCombat || o.faction !== p.c.faction || o.warState === 'garrison') continue; const k = o.hp / o.hpMax; if (k < bs && Math.hypot(o.x - m.x, o.y - m.y) < 450) { bs = k; hurt = o; } }
        }
        if (hurt) {
          const ratio = hurt.hp / hurt.hpMax;
          let pick = null;
          if (ratio < 0.25) pick = heals.find((x) => x.cat === 'bigheal') || null;
          if (!pick && hurt === m) pick = heals.find((x) => x.cat === 'selfheal');
          if (!pick) { const sp = heals.filter((x) => x.cat === 'heal'); pick = (ratio < 0.5 ? sp.filter((x) => x.def.type === 'heal').pop() : null) || sp.find((x) => x.def.type === 'hot' && !hurt.buffs.some((b) => b.name === x.def.name)) || sp.filter((x) => x.def.type === 'heal').pop(); }
          if (pick && (pick.cat === 'selfheal' ? hurt === m : true) && Math.hypot(hurt.x - m.x, hurt.y - m.y) < 450) { use(m, pick, pick.cat === 'selfheal' ? m : hurt); return; }
        }
      }
      // 1b. keep a pet summoned and healthy
      const ps = ab.filter((x) => x.cat === 'pet' && ready(m, x)).pop();
      if (ps && (!m.pet || m.pet.dead || m.pet.removed) && (!G.inCombat(p) || m.mana > m.manaMax * 0.4)) { use(m, ps, m); return; }
      if (m.pet && !m.pet.dead) {
        const ph = ab.find((x) => x.cat === 'petheal' && ready(m, x));
        if (ph && m.pet.hp / m.pet.hpMax < 0.55 && Math.hypot(m.pet.x - m.x, m.pet.y - m.y) < 420) { use(m, ph, m.pet); return; }
        const pb = ab.find((x) => x.cat === 'petbuff' && ready(m, x) && !m.pet.buffs.some((b) => b.name === (x.def.effects[0].name || x.def.name)));
        if (pb && m.mana > m.manaMax * 0.4 && Math.hypot(m.pet.x - m.x, m.pet.y - m.y) < 420) { use(m, pb, m.pet); return; }
      }
      // 2. mana & emergency self skills
      for (const x of ab) { if (!ready(m, x)) continue; if (x.cat === 'mana' && m.manaMax && m.mana < m.manaMax * 0.35 && (x.def.effects[0].t !== 'cannibal' || m.hp > m.hpMax * 0.6)) { use(m, x, m); return; } if (x.key === 'skill:divineaura' && m.hp < m.hpMax * 0.25) { use(m, x, m); return; } }
    }
    // pick an enemy
    let t = m.target && !m.target.dead && !m.target.removed && !(m.target.mez > 0) && G.isHostile(m, m.target) ? m.target : null;
    if (!t || (!t.inCombat && !(p.autoAttack && p.target === t))) {
      t = null;
      if (p.target && !p.target.dead && !(p.target.mez > 0) && G.isHostile(p, p.target) && (p.autoAttack || p.target.inCombat)) t = p.target;
      else t = G.nextAttacker(p);
    }
    m.target = t;
    if (t && Math.hypot(t.x - p.x, t.y - p.y) > 900) { m.target = t = null; }
    if (t) {
      const dist = Math.hypot(t.x - m.x, t.y - m.y);
      const caster = D.CLASSES[c.cls].role === 'caster';
      if (m.thinkT === 0.35) {
        // 3. taunt to protect the group
        if (TANKS.includes(c.cls) && st.taunt) {
          const top = G.topHate(t);
          if (top && top !== m && (st.alwaysTaunt || top.type !== 'merc' || !TANKS.includes(top.c && top.c.cls))) {
            const tn = ab.find((x) => x.cat === 'taunt' && ready(m, x));
            if (tn && dist <= G.meleeRange(m, t) + 6) { use(m, tn, t); if (G.player && Math.hypot(m.x - G.player.x, m.y - G.player.y) < 500 && Math.random() < 0.3) G.say(m, U.pick(['Over here!', 'Face me!', 'I have this one!']), 2); return; }
          }
        }
        // 4. self buffs in combat
        const sb = ab.find((x) => x.cat === 'selfbuff' && ready(m, x) && !m.buffs.some((b) => b.name === (x.def.effects[0].name || x.def.name)));
        if (sb && dist < 400) { use(m, sb, m); return; }
        // 4b. crowd control on extra attackers
        const cc = ab.find((x) => x.cat === 'cc' && ready(m, x) && (x.def.mana || 0) < m.mana);
        if (cc) { const add = G.ents.find((e) => e !== t && !e.dead && e.inCombat && e.hate && !e.boss && !(e.mez > 0) && G.isHostile(m, e) && party.some((q) => e.hate.has(q)) && inRange(m, cc, e) && !e.buffs.some((b) => b.name === cc.def.name)); if (add) { use(m, cc, add); return; } }
        // 5. attacks
        const spare = !st.healFirst || m.mana > m.manaMax * 0.7;
        const healer = ab.some((x) => x.cat === 'heal');
        const reserve = healer && c.stance !== 'damage' ? 0.3 : 0.05;
        const atks = ab.filter((x) => x.cat === 'attack' && ready(m, x) && (x.def.kind !== 'spell' || (spare && m.mana - (x.def.mana || 0) > m.manaMax * reserve)));
        // dots and debuffs only if not already on the target
        const usable = atks.filter((x) => !(x.def.kind === 'spell' && ['dot', 'slow', 'resistdebuff'].includes(x.def.type) && t.buffs.some((b) => b.name === x.def.name || (x.def.effects[0] && b.name === x.def.effects[0].name))) && inRange(m, x, t));
        if (usable.length) { const x = usable[Math.floor(Math.random() * usable.length)]; use(m, x, t); return; }
      }
      // movement
      const reach = G.meleeRange(m, t);
      const want = caster ? 200 : reach;
      if (dist > want + (caster ? 60 : 0)) { if (m.root <= 0) G.chase(m, t, dt, 1); }
      else { m.moving = false; G.faceTo(m, t); }
      // auto attack
      m.atkT -= dt * (1 + m.haste);
      if (m.atkT <= 0) {
        if (dist <= reach) { const wd = G.weaponDmg(m, 'main'); m.atkT = wd.delay; G.playerSwing(m, t, 'main'); }
        else if (c.equip.range && dist <= D.WEAPON_TYPES[c.equip.range.wt].range && W.lineClear(m.x, m.y - 20, t.x, t.y - 20)) { m.atkT = c.equip.range.delay; G.playerSwing(m, t, 'range'); }
        else m.atkT = 0.2;
      }
      return;
    }
    // out of combat: buff the group, then follow
    if (st.buffs && m.thinkT === 0.35 && m.manaMax && m.mana > m.manaMax * 0.5) {
      for (const x of ab) {
        if (x.cat !== 'buff' || !ready(m, x)) continue;
        const bn = x.def.effects[0].name || x.def.name;
        const who = x.def.target === 'self' ? [m] : party;
        const need = who.find((e) => !e.buffs.some((b) => b.name === bn || (x.def.type === 'rune' && b.rune > 0)) && Math.hypot(e.x - m.x, e.y - m.y) < 400 && !(x.def.type === 'clarity' && !e.manaMax) && !G.buffBlocked(e, x.def));
        if (need) { use(m, x, need); return; }
      }
    }
    const i = p.mercs.indexOf(m);
    const ang = Math.PI * (0.65 + i * 0.32) * (p.face || 1) + (p.face < 0 ? Math.PI : 0);
    const fx = p.x - (p.face || 1) * (38 + i * 10) + Math.sin(ang) * 0, fy = p.y + 18 + (i % 2 ? -26 : 14);
    const dx = fx - m.x, dy = fy - m.y, d = Math.hypot(dx, dy);
    if (d > 2000) { m.x = fx; m.y = fy; }
    if (d > 18) { const sp = Math.min(m.speed * (d > 160 ? 1.35 : 1), d * 4) * dt; G.moveEnt(m, dx / d * sp, dy / d * sp); m.moving = true; m.walk += dt * 10; G.faceTo(m, { x: fx, y: fy }); }
    else { m.moving = false; m.dir = p.dir; m.face = p.face; }
  };

  Sys.mercDied = function (e, src) {
    e.cast = null; e.reviveAt = G.now + 60000; e.target = null;
    for (const m of G.ents) if (m.hate && m.hate.has(e)) { m.hate.delete(e); if (!m.hate.size) m.inCombat = false; }
    G.log(`${e.name} has been slain! They will recover a minute after the fighting stops.`, 'combat', '#ff8a6a');
  };
  Sys.mercsHome = function () { const p = G.player; for (const m of p.mercs || []) { if (m.pet && !m.pet.dead) { m.pet.x = p.x - 40; m.pet.y = p.y + 30; m.pet.target = null; for (const e of G.ents) if (e.hate) e.hate.delete(m.pet); } m.x = p.x - 30; m.y = p.y + 20; m.target = null; for (const e of G.ents) if (e.hate) e.hate.delete(m); if (m.dead) { m.dead = false; m.hp = Math.round(m.hpMax * 0.5); m.mana = Math.round(m.manaMax * 0.5); } } };

  // ---------- gear ----------
  Sys.mercEquip = function (m, it) {
    const c = G.player.c;
    const u = G.canUse(m.c, it); if (!u.ok) { G.log(`${m.name}: ${u.why.replace(/s cannot/, 's cannot')}`, 'sys', '#ff8a6a'); KR.A.sfx('fail', 0.5); return; }
    let slot = G.itemSlot(it, m.c);
    if (it._toSecondary && it.kind === 'weapon' && !it.twoHand) { slot = 'secondary'; delete it._toSecondary; }
    const old = m.c.equip[slot];
    c.inv[c.inv.indexOf(it)] = null;
    m.c.equip[slot] = it;
    if (old) Sys.addItem(old, true);
    if (slot === 'primary' && it.twoHand && m.c.equip.secondary) { Sys.addItem(m.c.equip.secondary, true); m.c.equip.secondary = null; }
    G.recalc(m); m._abKey = null; KR.A.sfx('equip', 0.9);
    G.log(`${m.name} equips ${it.name}.`, 'sys', '#9affb8');
    KR.UI && KR.UI.refresh();
  };
  Sys.mercUnequip = function (m, slot) {
    const it = m.c.equip[slot]; if (!it) return;
    if (G.player.c.inv.indexOf(null) < 0) { Sys.bagsFull(); return; }
    m.c.equip[slot] = null; Sys.addItem(it, true); G.recalc(m); m._abKey = null; KR.UI && KR.UI.refresh();
  };
})();

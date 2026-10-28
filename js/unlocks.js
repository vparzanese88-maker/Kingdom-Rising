// Kingdom Rising — unlocks. A new player starts with eight classes and four races; the rest are bought with unlock
// points, won by beating the war (a full playthrough) for the first time on each difficulty: Easy 3, Normal 5, Hard 7.
// That is 15 points, exactly one for each class and race still locked. Winning on Normal also opens the Orc kingdom,
// and winning on Hard the Troll kingdom, each with its own race and class.
// Unlocks belong to the player, not a hero: kept in this browser (kr_unlocks) and in the account, whichever has more.
(function () {
  const KR = window.KR, D = KR.D, G = KR.G;
  const Un = (KR.Unlocks = {});
  Un.OPEN_CLASSES = ['warrior', 'paladin', 'ranger', 'rogue', 'cleric', 'druid', 'wizard', 'necromancer'];
  Un.OPEN_RACES = ['human', 'highelf', 'woodelf', 'dwarf'];
  Un.REWARD = { easy: 3, normal: 5, hard: 7 };
  Un.KINGDOM_FOR = { normal: 'orc', hard: 'troll' }; // the first win on this difficulty opens this kingdom
  Un.BASE_KINGDOMS = ['crown', 'sylvan'];
  const blank = () => ({ won: {}, spent: [], kingdoms: [], free: [] });
  const merge = (a, b) => ({ won: Object.assign({}, a.won, b.won), spent: [...new Set([...(a.spent || []), ...(b.spent || [])])], kingdoms: [...new Set([...(a.kingdoms || []), ...(b.kingdoms || [])])], free: [...new Set([...(a.free || []), ...(b.free || [])])] });
  Un.state = function () {
    let ls = blank(); try { ls = Object.assign(blank(), JSON.parse(localStorage.getItem('kr_unlocks') || 'null') || {}); } catch (e) {}
    const acc = G.account && G.account.unlocks ? Object.assign(blank(), G.account.unlocks) : blank();
    return merge(ls, acc);
  };
  Un.save = function (s) {
    try { localStorage.setItem('kr_unlocks', JSON.stringify(s)); } catch (e) {}
    if (G.account) { G.account.unlocks = s; try { KR.Sys.saveAccount && KR.Sys.saveAccount(true); } catch (e) {} }
  };
  Un.earned = (s = Un.state()) => Object.keys(s.won).reduce((n, d) => n + (Un.REWARD[d] || 0), 0);
  // what is left to spend: points won, less those spent (unlocks given free to old heroes cost nothing)
  Un.points = (s = Un.state()) => Math.max(0, Un.earned(s) - s.spent.filter((k) => !(s.free || []).includes(k)).length);
  // a kingdom's own race and class come with the kingdom, not with points
  const kingdomOf = (kind, id) => { for (const k in D.KINGDOMS || {}) { const K = D.KINGDOMS[k]; if ((kind === 'race' && K.race === id) || (kind === 'class' && K.cls === id)) return k; } return null; };
  Un.kingdomOk = (k, s = Un.state()) => Un.BASE_KINGDOMS.includes(k) || s.kingdoms.includes(k);
  Un.classOk = (cls, s = Un.state()) => { const k = kingdomOf('class', cls); if (k) return Un.kingdomOk(k, s); return Un.OPEN_CLASSES.includes(cls) || s.spent.includes('class:' + cls); };
  Un.raceOk = (r, s = Un.state()) => { const k = kingdomOf('race', r); if (k) return Un.kingdomOk(k, s); return Un.OPEN_RACES.includes(r) || s.spent.includes('race:' + r); };
  // the classes and races that points can buy (the kingdoms' own ones come with their kingdom)
  Un.lockedClasses = () => Object.keys(D.CLASSES).filter((c) => !kingdomOf('class', c) && !Un.OPEN_CLASSES.includes(c));
  Un.lockedRaces = () => D.RACE_IDS.filter((r) => !kingdomOf('race', r) && !Un.OPEN_RACES.includes(r));
  Un.unlock = function (kind, id) {
    const s = Un.state(); const key = kind + ':' + id;
    if (s.spent.includes(key) || Un.points(s) < 1) return false;
    s.spent.push(key); Un.save(s); return true;
  };
  // the first win on a difficulty: its points, and the kingdom it opens
  Un.award = function (diff) {
    const s = Un.state(); if (s.won[diff]) return null;
    s.won[diff] = Date.now(); const out = { pts: Un.REWARD[diff] || 0, kingdom: null };
    const k = Un.KINGDOM_FOR[diff]; if (k && !s.kingdoms.includes(k)) { s.kingdoms.push(k); out.kingdom = k; }
    Un.save(s); return out;
  };
  Un.unlockAll = function () { const s = Un.state(); for (const d in Un.REWARD) s.won[d] = s.won[d] || Date.now(); for (const k of Object.values(Un.KINGDOM_FOR)) if (!s.kingdoms.includes(k)) s.kingdoms.push(k); for (const c of Un.lockedClasses()) if (!s.spent.includes('class:' + c)) s.spent.push('class:' + c); for (const r of Un.lockedRaces()) if (!s.spent.includes('race:' + r)) s.spent.push('race:' + r); Un.save(s); };
  // heroes made before unlocks existed keep their class and race: what an existing hero plays is unlocked, free
  Un.grandfather = function () {
    const a = G.account; if (!a || !a.chars || !a.chars.length) return; const s = Un.state(); let n = 0;
    for (const ch of a.chars) for (const [kind, id, ok] of [['class', ch.cls, Un.classOk], ['race', ch.race, Un.raceOk]]) {
      if (!id || ok(id, s) || kingdomOf(kind, id)) continue; const key = kind + ':' + id; s.spent.push(key); (s.free = s.free || []).push(key); n++;
    }
    if (n) Un.save(s);
  };
  // the victory scene: the points won and the kingdom opened
  const War = KR.War;
  if (War && War.victoryScene) {
    const vs0 = War.victoryScene;
    War.victoryScene = function (k) {
      const r = vs0.apply(this, arguments);
      try {
        const c = G.player && G.player.c; const diff = War.difficulty(c); const got = Un.award(diff);
        const ov = document.querySelector('.vic-scene'); const note = ov && ov.querySelector('.vic-note');
        if (got && note) {
          const b = document.createElement('div'); b.className = 'vic-unlock';
          b.style.cssText = 'margin:12px auto 0;padding:10px 14px;border:1px solid #e0b050;border-radius:10px;background:rgba(40,28,8,.75);color:#ffe2a0;max-width:560px;font-weight:600';
          const K = got.kingdom && D.KINGDOMS && D.KINGDOMS[got.kingdom];
          b.innerHTML = `🏆 First win on ${D.DIFFICULTY[diff].name}: +${got.pts} unlock points (${Un.points()} to spend on new classes and races).` + (K ? `<br>👑 New kingdom unlocked: <b>${K.name}</b>, with the ${D.RACES[K.race] ? D.RACES[K.race].name : K.race} race and the ${D.CLASSES[K.cls] ? D.CLASSES[K.cls].name : K.cls} class.` : '');
          note.parentNode.insertBefore(b, note.nextSibling);
        }
      } catch (e) { console.warn('unlocks', e); }
      return r;
    };
  }
})();

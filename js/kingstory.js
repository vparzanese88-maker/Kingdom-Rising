// Kingdom Rising — the king's story. Every quest the king gives (his works and his story) opens and closes
// with a scene in the great hall where he speaks to you; the story follows the poisoning of old King Edric
// from the day you come home from the sea to the day you stand over his brother. In 3D the scenes are
// filmed (kingdom-rising-3d/js3d/scene3d.js); in 2D they play as a dialogue.
(function () {
  const KR = window.KR; const { D, G, U, W } = KR; const Sys = KR.Sys, UI = KR.UI;
  const TS = D.TS;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------------------------------------------------------------- scenes
  const Scenes = (KR.Scenes = {});
  // lines: [[who, text, seconds?]]; speaker: the entity talking (camera favours it); done: after the last line
  Scenes.play = function (lines, speaker, done, opt = {}) {
    lines = lines.filter(Boolean);
    if (!lines.length) { if (done) done(); return; }
    if (window.K3 && window.K3.playScene && G.player) { window.K3.playScene({ lines, speaker, done, style: opt.style }); return; }
    // 2D: a dialogue box, one line at a time
    const ov = document.createElement('div'); ov.className = 'modal scene2d';
    let i = 0; const show = () => { const [who, text] = lines[i]; ov.innerHTML = `<div class="modal-b scene-b"><div class="sc-who">${esc(who)}</div><p class="sc-text">${esc(text)}</p><div class="row"><button class="btn gold">${i < lines.length - 1 ? 'Continue ›' : 'Close'}</button></div></div>`; ov.querySelector('button').onclick = () => { i++; if (i < lines.length) show(); else { ov.remove(); if (done) done(); } }; ov.querySelector('button').focus(); };
    document.body.appendChild(ov); show();
  };

  // ---------------------------------------------------------------- who says what
  const kingOf = (f) => D.FACTIONS[f].king;
  const SCN = {};
  SCN.crown = {
    home: { offer: [
      ['King Aldric', 'My father was poisoned at the feast. My brother Theron fled to the elves.'],
      ['King Aldric', 'See my captain, my arms merchant and the healer, then come back.'],
    ], done: [
      ['King Aldric', 'We are thin, but not broken. Now we build.'],
    ] },
    rats: { offer: [
      ['King Aldric', 'The Rat Tail Gang passes letters to Theron through the sewers.'],
      ['King Aldric', 'Find their leader, Fingers Fenwick, and bring me what he carries.'],
    ], done: [
      ['King Aldric', 'Theron\'s seal. "Nightshade, as before." He poisoned Father.'],
      ['King Aldric', 'No more letters leave this city.'],
    ] },
    cupbearer: { offer: [
      ['King Aldric', 'Old Wendel poured the wine that night, then vanished.'],
      ['King Aldric', 'He hides at the Wayfarer\'s Rest. Hear what he saw.'],
    ], done: [
      ['King Aldric', 'Theron at the cask with a green vial. Now I know the truth.'],
    ] },
    ledger: { offer: [
      ['King Aldric', 'The marsh alchemist sold the poison. Lizardfolk guard her.'],
      ['King Aldric', 'Bring me her ledger.'],
    ], done: [
      ['King Aldric', '"Nightshade, sealed with the leaf." Let every square read it.'],
    ] },
    war: { offer: [
      ['King Aldric', 'We are strong now. Order the attack on Aelindor.'],
      ['King Aldric', 'When you find my brother, tell him whose son sent you.'],
    ], done: [] },
  };
  SCN.sylvan = {
    home: { offer: [
      ['King Theron', 'My father was poisoned at the feast. Aldric\'s guards came for me, so I fled.'],
      ['King Theron', 'See my captain, my arms merchant and the healer, then come back.'],
    ], done: [
      ['King Theron', 'These people chose us. Now we build.'],
    ] },
    rats: { offer: [
      ['King Theron', 'Someone in our sewers passes letters to Aldric.'],
      ['King Theron', 'Find the orc Skulk the Drowned and bring me what he carries.'],
    ], done: [
      ['King Theron', 'Aldric\'s lion. "Nightshade, as before." He killed our father.'],
      ['King Theron', 'Seal the grates.'],
    ] },
    cupbearer: { offer: [
      ['King Theron', 'Old Wendel poured the wine that night and fled.'],
      ['King Theron', 'He hides at the Wayfarer\'s Rest. Hear what he saw.'],
    ], done: [
      ['King Theron', 'Aldric at the cask with a green vial. So it is true.'],
    ] },
    ledger: { offer: [
      ['King Theron', 'The marsh alchemist sold the poison. Lizardfolk guard her.'],
      ['King Theron', 'Bring me her ledger.'],
    ], done: [
      ['King Theron', '"Nightshade, sealed with the lion." Let Aelindor read it.'],
    ] },
    war: { offer: [
      ['King Theron', 'We have the truth and the walls. Order the attack on Valenmoor.'],
      ['King Theron', 'If you find him, let him speak before the end.'],
    ], done: [] },
  };
  // what the king says when he sets you to his works, and when they are done
  const BUILD_LINES = {
    crown: [null, ['A hamlet. My father\'s capital is a hamlet with a fence. Bring me timber and fieldstone, and Valenmoor becomes a village.', 'Good. People are moving in from the farms already. They feel safe here.'],
      ['Theron raises walls in the forest. We will raise higher ones, of darkoak and granite.', 'Look at those walls. Let my brother look at them too.'],
      ['A real king needs real halls: willow and sandstone, from the swamp and the desert.', 'Halls fit for a court. Father would have walked these with pride.'],
      ['One last work. Frostpine and marble from the peaks, and Valenmoor will be the capital Father always meant it to be.', 'A capital. A true capital. Now the whole realm will see which brother is king.']],
    sylvan: [null, ['Aelindor shelters more people every day, all of them fleeing my brother. Bring timber and fieldstone so they have roofs.', 'Roofs, hearths, a village. You have done more for these people than you know.'],
      ['Aldric raises walls. So shall we, of darkoak and granite.', 'Let him come now. These walls will hold.'],
      ['Our people deserve halls, not tents: willow from the swamp, sandstone from the desert.', 'Halls among the trees. The elves say they have never seen a city like it.'],
      ['One last work: frostpine and marble from the peaks, and Aelindor will be the jewel of the realm.', 'The jewel of the realm. Let my brother weep.']],
  };

  // ---------------------------------------------------------------- the story quests
  const bq0 = Sys.buildQuests;
  Sys.buildQuests = function () {
    bq0.apply(this, arguments);
    const Q = Sys.QUESTS;
    for (const f of ['crown', 'sylvan']) {
      const enemy = f === 'crown' ? 'sylvan' : 'crown', E = D.FACTIONS[enemy];
      const leader = f === 'crown' ? 'n_fingers' : 'n_skulk';
      Q[f + '_story0'] = { id: f + '_story0', f, giver: 'king', lv: 1, type: 'visit', roles: ['captain', 'armsdealer', 'healer'], scene: 'home', title: 'Home from the Sea',
        text: `${kingOf(f)} wants you to see the city with your own eyes: speak with the captain of the guard, the arms merchant and the healer, then return to him.`, reward: { coin: 150, status: 10 } };
      Q[f + '_story1'] = { id: f + '_story1', f, giver: 'king', lv: 4, type: 'collect', item: 'Sealed Letter', storyDrop: [leader], mobs: [leader], n: 1, scene: 'rats', title: 'Rats Beneath the Streets', req: f + '_build1',
        text: `Enter the sewer outflow outside the walls, kill ${D.MOBS[leader].name} and bring the king what he carries.`, reward: { coin: 800, status: 30, item: { k: 'weapon', tier: 0, q: 1.25 } } };
      Q[f + '_story2'] = { id: f + '_story2', f, giver: 'king', lv: 12, type: 'visit', roles: ['cupbearer'], scene: 'cupbearer', title: 'The Cupbearer', req: f + '_story1',
        text: 'Find old Wendel at the Wayfarer\'s Rest and hear what he saw.', reward: { coin: 2500, status: 50 } };
      Q[f + '_story3'] = { id: f + '_story3', f, giver: 'king', lv: 26, type: 'collect', item: "Alchemist's Ledger", storyDrop: ['lizard_shaman', 'lizard_warrior', 'lizardman'], mobs: ['lizard_shaman', 'lizard_warrior', 'lizardman'], n: 1, scene: 'ledger', title: "The Alchemist's Ledger", req: f + '_story2',
        text: 'Take the alchemist\'s ledger from the Dreadmire lizardfolk and bring it to the king.', reward: { coin: 12000, status: 90, item: { k: 'jewel', slot: 'neck', tier: 3, q: 1.2 } } };
      Q[f + '_story4'] = { id: f + '_story4', f, giver: 'king', lv: 35, type: 'warking', scene: 'war', title: `The Fall of ${E.city}`, req: f + '_story3',
        text: `Order the attack (N, then Status), march on ${E.city} and bring down ${E.king}.`, reward: { coin: 0, status: 0 } };
      for (let i = 1; i <= 4; i++) { const q = Q[f + '_build' + i]; if (q) { q.buildScene = i; if (i === 1) q.req = f + '_story0'; } }
    }
  };
  // a kill by the right mob drops the quest item, every time it is needed
  const loot0 = G.genLoot;
  G.genLoot = function (e) {
    const loot = loot0.apply(this, arguments);
    try { const c = G.player && G.player.c; if (c) for (const id in c.quests.active) { const q = Sys.QUESTS[id]; if (q && q.storyDrop && q.storyDrop.includes(e.mob) && Sys.countItem(q.item) < q.n && !loot.items.some((x) => x.name === q.item)) loot.items.push(Object.assign(G.makeTrophy(q.item, e.level), { kind: 'trophy', icon: q.item === 'Sealed Letter' ? '✉' : '📒' })); } } catch (er) { console.warn(er); }
    return loot;
  };
  // visit quests: speak with each of these people
  const qp = Sys.questProgress, qg = Sys.questGoal;
  Sys.questProgress = function (q) { if (q.type === 'visit') { const st = G.player.c.quests.active[q.id]; return st ? Object.keys(st.v || {}).length : 0; } if (q.type === 'warking') { const st = G.player.c.quests.active[q.id]; return st && st.n ? 1 : 0; } return qp.apply(this, arguments); };
  Sys.questGoal = function (q) { if (q.type === 'visit') return q.roles.length; if (q.type === 'warking') return 1; return qg.apply(this, arguments); };
  const open0 = UI.openNPC;
  UI.openNPC = function (e) {
    try {
      const c = G.player.c;
      for (const id in c.quests.active) { const q = Sys.QUESTS[id]; if (!q || q.type !== 'visit' || !q.roles.includes(e.role) || (e.city && e.city !== c.faction && e.role !== 'cupbearer')) continue; const st = c.quests.active[id]; st.v = st.v || {}; if (st.v[e.role]) continue; st.v[e.role] = 1; G.log(`${q.title}: ${Object.keys(st.v).length}/${q.roles.length}`, 'quest', '#ffe89a'); if (Sys.questComplete(q)) { G.log(`Return to ${kingOf(c.faction)}.`, 'quest', '#ffd84a'); KR.A.sfx('quest', 0.5); }
        if (e.role === 'cupbearer') { Scenes.play(cupbearerLines(c), e); return; } }
    } catch (er) { console.warn(er); }
    return open0.apply(this, arguments);
  };
  const cupbearerLines = (c) => { const E = D.FACTIONS[c.faction === 'crown' ? 'sylvan' : 'crown'], brother = E.king.replace(/^King /, ''); return [
    ['Old Wendel', 'Who... who sent you? Put that away, put it away, I\'m only an old man!'],
    ['Old Wendel', `${kingOf(c.faction)}? Gods be thanked. Then I can say it. I have carried it so long.`],
    ['Old Wendel', `Before the toast I went down to fetch the second cask. ${brother} was there, alone, bent over the king's cup. A little green vial in his hand.`],
    ['Old Wendel', 'He saw me. He smiled. He said, "Pour, Wendel." And I poured. Gods forgive me, I poured it.'],
    ['Old Wendel', 'Tell your king. Tell him I am sorry.'],
  ]; };
  // where the map points for these quests
  const qt0 = Sys.questTarget;
  Sys.questTarget = function (q) {
    const c = G.player.c;
    if (q.type === 'visit' && !Sys.questComplete(q)) { const st = c.quests.active[q.id] || {}; return G.ents.filter((e) => q.roles.includes(e.role) && !(st.v || {})[e.role] && (e.city === c.faction || e.role === 'cupbearer')).map((e) => ({ x: e.x / TS, y: e.y / TS, r: 2, npc: true })); }
    if (q.type === 'warking' && !Sys.questComplete(q)) { const E = W.cityData[q.f === 'crown' ? 'sylvan' : 'crown']; return E ? [{ x: E.cx, y: E.cy, r: 8, boss: true }] : []; }
    return qt0.apply(this, arguments);
  };
  // the cupbearer hides at the Wayfarer's Rest
  function ensureCupbearer() {
    if (!G.player || (W.realm && W.realm !== 'main')) return;
    if (G.ents.some((e) => e.role === 'cupbearer' && !e.removed)) return;
    const b = (W.buildings || []).find((x) => x.type === 'outpost'); if (!b) return;
    const x = (b.x + b.w - 2) * TS + 16, y = (b.y + 2) * TS + 20;
    const e = G.makeEnt({ type: 'npc', role: 'cupbearer', city: null, faction: null, name: 'Old Wendel', title: 'Cupbearer to King Edric', x, y, homeX: x, homeY: y, level: 5, hostile: false, services: [], gender: 'm', race: 'human' });
    e.static = true; e.sit = true; e.hpMax = e.hp = 120;
    e.look = { race: 'human', gender: 'm', skin: '#e0c0a0', hair: '#d8d0c0', hairStyle: 1, beardStyle: 4, beard: '#d8d0c0', old: true, armor: { kind: 'cloth', col: '#5a4a3a', trim: '#2a1e14' }, robe: true };
    e.greetFn = () => (G.player.c.quests.done[G.player.c.faction + '_story2'] ? 'I have told you all I know. Leave an old man to his ale.' : 'Leave me be. I don\'t know you.');
  }
  setInterval(() => { try { ensureCupbearer(); } catch (e) {} }, 4000);
  // every king's quest opens and closes with him speaking
  const acc0 = Sys.acceptQuest, ti0 = Sys.turnIn;
  const kingEnt = (f) => G.ents.find((e) => e.type === 'king' && e.faction === f && !e.dead && !e.removed) || G.ents.find((e) => e.role === 'king' && e.city === f);
  function sceneFor(q, phase) {
    const f = q.f; if (q.scene && SCN[f] && SCN[f][q.scene]) return SCN[f][q.scene][phase].map((l) => [l[0], l[1]]);
    if (q.buildScene && BUILD_LINES[f] && BUILD_LINES[f][q.buildScene]) { const k = kingOf(f); return [[k, BUILD_LINES[f][q.buildScene][phase === 'offer' ? 0 : 1]]]; }
    return null;
  }
  Sys.acceptQuest = function (q) {
    const r = acc0.apply(this, arguments);
    if (q.giver === 'king') { const L = sceneFor(q, 'offer'); if (L) { UI.close && UI.close('npc'); Scenes.play(L, kingEnt(q.f)); } }
    return r;
  };
  Sys.turnIn = function (q) {
    const ready = Sys.questComplete(q);
    const r = ti0.apply(this, arguments);
    if (ready && q.giver === 'king') { const L = sceneFor(q, 'done'); if (L && L.length) { UI.close && UI.close('npc'); Scenes.play(L, kingEnt(q.f)); } }
    return r;
  };

  // ---------------------------------------------------------------- the fall of the enemy king
  // he does not die at once: he sinks to his knees and, at the last, tells the truth
  const CONFESS = {
    crown: (c) => [ // Theron, slain by a hero of Valenmoor
      ['King Theron', 'Wait... wait. Let me... let me speak.'],
      ['King Theron', 'It was me. I poured the nightshade. Father was going to name Aldric heir at the feast, and I could not bear to kneel to him.'],
      ['King Theron', 'I told myself the elves needed a king. That Aldric was cruel. I told myself so many things...'],
      ['King Theron', `Tell my brother... tell him I am sorry. Tell him... the crown was never worth it.`],
      ['', 'His eyes close. Far below, the bells of Aelindor begin to toll, and the green banners come down one by one.'],
    ],
    sylvan: (c) => [ // Aldric, slain by a hero of Aelindor
      ['King Aldric', 'Hold. Hold your blade... I have not much breath left, so hear me.'],
      ['King Aldric', 'It was me. Father meant to pass me over, to give the crown to Theron at the feast. The firstborn, passed over!'],
      ['King Aldric', 'So I bought the nightshade, and I poured it, and I watched him drink. And then I blamed my brother, and burned everything that could say otherwise.'],
      ['King Aldric', `Tell Theron... tell him he was right. Tell him I am sorry.`],
      ['', 'His eyes close. Far below, the bells of Valenmoor begin to toll, and the red banners come down one by one.'],
    ],
  };
  const slain0 = Sys.kingSlain;
  Sys.kingSlain = function (k, killer) {
    const p = G.player; const pf = p && p.c.faction;
    const kf = killer && (killer.c ? killer.c.faction : killer.owner && killer.owner.c ? killer.owner.c.faction : killer.faction);
    if (pf && k.faction !== pf && kf === pf && CONFESS[pf]) {
      const args = arguments, self = this; const c = p.c;
      const st = c.quests.active[pf + '_story4']; if (st) st.n = 1;
      c.confessions = (c.confessions || 0) + 1;
      Scenes.play(CONFESS[pf](c), k, () => slain0.apply(self, args), { style: 'death' });
      return;
    }
    return slain0.apply(this, arguments);
  };

  // =====================================================================================================
  // the homecoming: the main quest line. The harbourmaster meets you on the dock, the king tells you what
  // is coming, and the court shows you how a kingdom is raised (js/realm.js): the Court Liaison, the Arborist
  // and the Miner, the Sawmill and the Stone Cutter, the Barracks and its raiders, and the first march.
  // Every step opens with a filmed scene that plays by itself as you walk up (or click), before anything else.
  // =====================================================================================================
  const Story = (KR.Story = {});
  const clsName = (c) => D.CLASSES[c.cls].name;
  const firstName = (n) => { const w = String(n || '').split(' '); return /^(Lord|Lady|Sir|Dame|Master|Mistress|Captain)$/.test(w[0]) && w[1] ? w[1] : w[0]; };
  const enemyOf = (f) => (f === 'crown' ? 'sylvan' : 'crown');
  const npcOf = (f, role) => G.ents.find((e) => e.role === role && e.city === f && !e.removed && !e.dead);
  const nameOf = (f, role, fb) => { const e = npcOf(f, role); return e ? e.name.split(' ')[0] : fb; };
  const MAIN = (f) => ['arrive', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map((k) => f + '_' + k);
  const OLD_MAIN = (f) => ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].map((k) => f + '_' + k);
  let quiet = 0; // our own accept / turn-in: no extra scene from the wrappers above
  // ---- the lines: L(who, text, opt) ----
  const L = (who, text, opt) => [who, text, 0, opt || {}];
  const words = (c) => { const f = c.faction, F = D.FACTIONS[f], E = D.FACTIONS[enemyOf(f)];
    return { f, F, E, K: kingOf(f), bro: F.brother, broK: E.king, city: F.city, ecity: E.city, cls: clsName(c), me: c.name }; };
  const SCENE = {
    arrive: (c, e) => { const w = words(c); return [
      L(e.name, `Welcome back, ${w.cls}. The king must see you at once.`, { g: 'raise', shot: 'wide' }),
      L(e.name, 'Go to the Town Hall and climb to the throne room.', { g: 'thrust' }),
    ]; },
    arriveDone: (c, e) => { const w = words(c); return [
      L(w.K, `Welcome home, sailor. My brother ${w.bro} is raising an army to attack us.`, { g: 'raise', shot: 'wide' }),
      L(w.K, `Raise the walls and build an army, then march on ${w.ecity}.`, { g: 'slam', gd: 1.1 }),
      L(w.K, 'Wood and stone build. Gold hires soldiers.'),
      L(w.K, 'My Court Liaison waits downstairs. Their fee is paid. Go.', { g: 'thrust' }),
    ]; },
    k1meet: (c, e) => { const w = words(c); return [
      L(e.name, `I'm ${firstName(e.name)}, the Court Liaison. The king paid my fee.`, { g: 'raise', shot: 'wide' }),
      L(e.name, 'Take me on and I run the kingdom for you.', { g: 'thrust' }),
    ]; },
    k1done: (c, e) => { const w = words(c); return [
      L(e.name, 'Press N anywhere to open the kingdom.', { g: 'raise', shot: 'wide' }),
      L(e.name, 'Status, Build, Workers, Army, Defenses: it is all there.'),
      L(e.name, 'First, hire an Arborist and a Miner. Their wages are paid too.', { g: 'thrust' }),
    ]; },
    k2done: (c, e) => { const w = words(c); return [
      L(e.name, 'They gather outside the walls and bring loads home.', { g: 'raise', shot: 'wide' }),
      L(e.name, `Only ${w.bro}'s raiders hunt them. The fallen return in a minute.`),
      L(e.name, 'Build the Sawmill and the Stone Cutter next.', { g: 'thrust' }),
    ]; },
    k3done: (c, e) => { const w = words(c); return [
      L(e.name, 'Mill and cutter both upgrade three times: more hands, bigger loads.', { g: 'raise', shot: 'wide' }),
      L(e.name, 'Better tools are in the Workers tab, for gold.'),
      L(e.name, 'Now build the Barracks.', { g: 'thrust' }),
    ]; },
    k4done: (c, e) => { const w = words(c); return [
      L(e.name, "I'm the Recruiter. Guards hold the walls, raiders march. Both cost gold.", { shot: 'wide' }),
      L(e.name, 'Earn gold from quests, loot, and killing named foes and bosses.', { g: 'thrust' }),
      L(e.name, `Hire ${RAIDERS} raiders to start.`),
    ]; },
    k5done: (c, e) => { const w = words(c); return [
      L(e.name, 'Next: Archery Range, Stable, then the Siege Workshop.', { g: 'raise', shot: 'wide' }),
      L(e.name, 'The Workshop builds the ram. Walls and towers are in Defenses.', { g: 'slam', gd: 1.1 }),
      L(e.name, 'Now report to the king.', { g: 'thrust' }),
    ]; },
    k6meet: (c, e) => { const w = words(c); return [
      L(w.K, `It is time to march on ${w.ecity}.`, { g: 'raise', shot: 'wide' }),
      L(w.K, 'Order the attack from the Status tab. Bring a ram if you have one.', { g: 'thrust' }),
    ]; },
    k6done: (c, e) => { const w = words(c); return [
      L(w.K, `The war has begun. Bring ${w.broK} to his knees.`, { g: 'thrust' }),
    ]; },
  };
  // ---- the quests ----
  const R_ = () => KR.Realm;
  const hasB = (f, id, lv = 1) => !!(R_() && R_().has && R_().has(f, id, lv));
  const realmSt = (f) => (R_() && R_().state ? R_().state(f) : null);
  const raiders = (f) => { try { return KR.War && KR.War.army ? KR.War.army(f).total : 0; } catch (e) { return 0; } };
  const RAIDERS = 3;
  const bq2 = Sys.buildQuests;
  Sys.buildQuests = function () {
    bq2.apply(this, arguments);
    const Q = Sys.QUESTS;
    for (const f of ['crown', 'sylvan']) {
      const F = D.FACTIONS[f], E = D.FACTIONS[enemyOf(f)], K = kingOf(f), id = (k) => f + '_' + k;
      const base = { f, lv: 1, main: true };
      Q[id('arrive')] = Object.assign({ id: id('arrive'), giver: 'harbor', turnin: 'king', type: 'meet', meet: 'king', title: 'An Urgent Summons', next: [id('k1')], scDone: 'arriveDone', noGear: true, reward: { coin: 25 },
        get text() { return `See ${K} in the throne room of the ${F.city} Town Hall.`; } }, base);
      Q[id('k1')] = Object.assign({ id: id('k1'), giver: 'king', turnin: 'liaison', type: 'realm', cond: 'liaison', meet: 'liaison', req: id('arrive'), title: 'The Court Liaison', next: [id('k2')], scMeet: 'k1meet', scDone: 'k1done', noGear: true, reward: { coin: 40 },
        text: `Hire the Court Liaison by the Town Hall doors (free).` }, base);
      Q[id('k2')] = Object.assign({ id: id('k2'), giver: 'liaison', turnin: 'liaison', type: 'realm', cond: 'workers', req: id('k1'), title: 'Hands for the Work', next: [id('k3')], scDone: 'k2done', noGear: true, reward: { coin: 40, wood: 30, stone: 30 },
        text: `Hire the Arborist and the Miner through the Court Liaison (free).` }, base);
      Q[id('k3')] = Object.assign({ id: id('k3'), giver: 'liaison', turnin: 'sawyer', type: 'realm', cond: 'mills', req: id('k2'), title: 'Mill and Quarry', next: [id('k4')], scDone: 'k3done', reward: { coin: 120, wood: 60, stone: 60 },
        text: `Build the Sawmill and the Stone Cutter (N, then Build). Then visit the sawmill.` }, base);
      Q[id('k4')] = Object.assign({ id: id('k4'), giver: 'sawyer', turnin: 'recruiter', type: 'realm', cond: 'barracks', req: id('k3'), title: 'The Barracks', next: [id('k5')], scDone: 'k4done', noGear: true, reward: { coin: 150, wood: 80, stone: 80 },
        text: `Build the Barracks (N, then Build) and meet the Recruiter.` }, base);
      Q[id('k5')] = Object.assign({ id: id('k5'), giver: 'recruiter', turnin: 'recruiter', type: 'realm', cond: 'raiders', req: id('k4'), title: 'Steel and Wheels', next: [id('k6')], scDone: 'k5done', reward: { coin: 250 },
        text: `Hire ${RAIDERS} raiders with gold (N, then Army). Then report to the Recruiter.` }, base);
      Q[id('k6')] = Object.assign({ id: id('k6'), giver: 'recruiter', turnin: 'king', type: 'realm', cond: 'march', meet: 'king', auto: true, req: id('k5'), title: 'The First March', next: [], scMeet: 'k6meet', scDone: 'k6done', reward: { coin: 400 },
        text: `See ${K}, then order the attack on ${E.city} (N, then Status).` }, base);
      // the old opening errands stay only for heroes already on them; the story continues after the first march
      if (Q[id('story0')]) Q[id('story0')].req = id('retired');
      if (Q[id('story1')]) Q[id('story1')].req = id('k6');
    }
  };
  // what each step waits for in the kingdom
  const COND = {
    liaison: (f) => !!(realmSt(f) && realmSt(f).liaison),
    workers: (f) => { const s = realmSt(f); return !!(s && s.workers && s.workers.arborist.hired && s.workers.miner.hired); },
    mills: (f) => hasB(f, 'sawmill') && hasB(f, 'cutter'),
    barracks: (f) => hasB(f, 'barracks'),
    raiders: (f) => raiders(f) >= RAIDERS,
    march: (f) => { const st = G.player && G.player.c.quests.active[f + '_k6']; return !!(st && st.marched); },
  };
  // an attack ordered while the last step is open completes it
  if (KR.War && typeof KR.War.orderAttack === 'function') {
    const oa0 = KR.War.orderAttack;
    KR.War.orderAttack = function (f) { const r = oa0.apply(this, arguments); try { const p = G.player; const ff = f || (p && p.c.faction); if (r && p && ff === p.c.faction) { const st = p.c.quests.active[ff + '_k6']; if (st && st.met) { st.marched = 1; Sys.save && Sys.save(); } } } catch (er) { console.warn(er); } return r; };
  }
  // the extra stores a step pays in, and gear only on the bigger steps
  const turnIn9 = Sys.turnIn;
  Sys.turnIn = function (q) {
    const c = G.player.c; const was = !!c.quests.done[q.id];
    const r = turnIn9.apply(this, arguments);
    try { if (isMain(q) && !was && c.quests.done[q.id] && q.reward && (q.reward.wood || q.reward.stone) && R_() && R_().add) { R_().add(q.f, { wood: q.reward.wood || 0, stone: q.reward.stone || 0 }, 'quest'); G.log(`The stores of ${D.FACTIONS[q.f].city} receive ${q.reward.wood || 0} wood and ${q.reward.stone || 0} stone.`, 'loot', '#d8c890'); } } catch (er) { console.warn(er); }
    return r;
  };
  const isMain = (q) => !!(q && q.main);
  const qp2 = Sys.questProgress, qg2 = Sys.questGoal;
  Sys.questProgress = function (q) {
    if (!isMain(q)) return qp2.apply(this, arguments);
    const c = G.player.c, st = c.quests.active[q.id] || {};
    if (q.type === 'meet') return st.met ? 1 : 0;
    if (q.type === 'realm') {
      if (q.cond === 'workers') { const s = realmSt(q.f); return s ? (s.workers.arborist.hired ? 1 : 0) + (s.workers.miner.hired ? 1 : 0) : 0; }
      if (q.cond === 'mills') return (hasB(q.f, 'sawmill') ? 1 : 0) + (hasB(q.f, 'cutter') ? 1 : 0);
      if (q.cond === 'raiders') return Math.min(RAIDERS, raiders(q.f));
      return COND[q.cond] && COND[q.cond](q.f) ? 1 : 0;
    }
    return 0;
  };
  Sys.questGoal = function (q) { if (!isMain(q)) return qg2.apply(this, arguments); if (q.type === 'realm') return q.cond === 'workers' || q.cond === 'mills' ? 2 : q.cond === 'raiders' ? RAIDERS : 1; return 1; };
  const tick = (ok) => (ok ? '✓' : '○');
  Story.progText = function (q) {
    const c = G.player.c, st = c.quests.active[q.id] || {}, F = D.FACTIONS[q.f];
    const who = (role, fb) => (whoIs(q.f, role) || { name: fb }).name;
    if (q.type === 'meet') return `Speak with ${who(q.meet, q.meet)}`;
    if (q.type === 'realm') {
      const s = realmSt(q.f);
      if (q.cond === 'liaison') return st.met || (s && s.liaison) ? `${tick(s && s.liaison)} Take the Court Liaison into your service` : `Find ${who('liaison', 'the Court Liaison')} in the Town Hall`;
      if (q.cond === 'workers') return s ? `${tick(s.workers.arborist.hired)} Arborist · ${tick(s.workers.miner.hired)} Miner` : 'Hire the Arborist and the Miner';
      if (q.cond === 'mills') { const done = COND.mills(q.f); if (done) return `Visit ${who('sawyer', 'the sawmill')}`; const R = R_(); const bld = (id) => (R && R.building && R.building(q.f, id) ? '⚒' : tick(hasB(q.f, id))); return `${bld('sawmill')} Sawmill · ${bld('cutter')} Stone Cutter${s ? ` · stores ${Math.floor(s.wood)} wood, ${Math.floor(s.stone)} stone` : ''}`; }
      if (q.cond === 'barracks') return COND.barracks(q.f) ? `Meet ${who('recruiter', 'the Recruiter')} at the Barracks` : `${R_() && R_().building && R_().building(q.f, 'barracks') ? '⚒ Barracks going up' : '○ Build the Barracks'}`;
      if (q.cond === 'raiders') return `${Math.min(RAIDERS, raiders(q.f))} / ${RAIDERS} raiders hired`;
      if (q.cond === 'march') return st.met ? '○ Order the attack (N, then Status)' : `Speak with ${F.king}`;
    }
    return '';
  };
  // who a step sends you to: some people are found by what they do, not their trade
  function whoIs(f, role) {
    if (role === 'liaison') return G.ents.find((e) => e.liaison && e.city === f && !e.removed && !e.dead) || null;
    if (role === 'sawyer') return G.ents.find((e) => e.millHand === 'sawmill' && e.city === f && !e.removed && !e.dead) || G.ents.find((e) => e.millHand && e.city === f && !e.removed && !e.dead) || whoIs(f, 'liaison');
    if (role === 'king') return G.ents.find((e) => e.type === 'king' && e.faction === f && !e.dead && !e.removed) || npcOf(f, 'king');
    if (role === 'recruiter') return npcOf(f, 'recruiter') || whoIs(f, 'liaison'); // until the barracks has its recruiter standing, the liaison speaks for him
    return npcOf(f, role);
  }
  // where the map points
  const qt2 = Sys.questTarget;
  Sys.questTarget = function (q) {
    if (!isMain(q)) return qt2.apply(this, arguments);
    const c = G.player.c, st = c.quests.active[q.id] || {};
    const at = (role) => { const n = whoIs(q.f, role); return n ? [{ x: n.x / TS, y: n.y / TS, r: 2, npc: true }] : []; };
    const plot = (id) => { const R = R_(); const pl = R && R.plotOf && R.plotOf(q.f, id); return pl ? [{ x: pl.x + pl.w / 2, y: pl.y + pl.h / 2, r: Math.max(2, pl.w / 2) }] : []; };
    if (q.meet && !st.met) return at(q.meet);
    if (Sys.questComplete(q)) return q.auto ? [] : at(q.turnin);
    if (q.type === 'realm') {
      if (q.cond === 'workers') return at('liaison');
      if (q.cond === 'mills') return [].concat(hasB(q.f, 'sawmill') ? [] : plot('sawmill'), hasB(q.f, 'cutter') ? [] : plot('cutter'));
      if (q.cond === 'barracks') return plot('barracks');
      if (q.cond === 'raiders') return at('recruiter');
      return [];
    }
    return at(q.turnin);
  };
  // the person you are sent to see wears a gold ? until you have spoken
  const nm2 = Sys.npcMarker;
  Sys.npcMarker = function (npc) {
    const p = G.player; if (p && npc && npc.city === p.c.faction) { const c = p.c;
      for (const id in c.quests.active) { const q = Sys.QUESTS[id]; if (!isMain(q)) continue; const st = c.quests.active[id]; if ((q.meet && !st.met && whoIs(q.f, q.meet) === npc) || (q.scDone && !q.auto && Sys.questComplete(q) && whoIs(q.f, q.turnin) === npc)) return '?'; } }
    return nm2.apply(this, arguments);
  };
  // our own accepts and hand-ins (quiet: the scene has already played)
  const takeQuest = (id) => { const q = Sys.QUESTS[id]; const c = G.player.c; if (!q || c.quests.done[id] || c.quests.active[id]) return; quiet++; try { Sys.acceptQuest(q); } finally { quiet--; } };
  function finishMain(q) {
    const c = G.player.c; if (!c.quests.active[q.id]) return;
    quiet++; try { Sys.turnIn(q); } finally { quiet--; }
    if (!c.quests.done[q.id]) return;
    for (const n of q.next || []) takeQuest(n);
    if ((q.next || []).length) { const nq = Sys.QUESTS[q.next[q.next.length - 1]]; if (nq && UI.banner) UI.banner(nq.title, nq.text.length > 150 ? nq.text.slice(0, 147).replace(/\s+\S*$/, '') + '...' : nq.text); }
    else if (q.auto && q.scDone && SCENE[q.scDone]) for (const [who, text] of SCENE[q.scDone](c, null)) G.log(`${who}: ${text}`, 'say', '#f0e0b0');
    UI.refresh && UI.refresh(); Sys.save();
  }
  Story.finish = finishMain;
  // ---- playing the scenes ----
  let playing = false;
  function play(lines, speaker, done) {
    if (playing) return false; playing = true;
    if (UI.close) { UI.close('npc'); } const bn = document.querySelector('.banner'); if (bn) bn.hidden = true;
    const p = G.player; if (p) { p.autoAttack = false; p.harvest = null; p.moveTo = null; p.chase = null; if (p.cast) p.cast = null; }
    Scenes.play(lines, speaker, () => { playing = false; try { if (done) done(); } catch (er) { console.warn(er); } });
    return true;
  }
  Story.playing = () => playing || !!(window.K3 && window.K3.cine);
  function meetScene(q, npc) {
    const c = G.player.c, st = c.quests.active[q.id];
    const lines = q.scMeet ? SCENE[q.scMeet](c, npc) : SCENE[q.scDone](c, npc);
    return play(lines, npc, () => {
      st.met = 1; Sys.save();
      if (q.type === 'meet') finishMain(q);
      else if (q.type === 'realm' && !q.auto) { if (Sys.questComplete(q) && whoIs(q.f, q.turnin) === npc) doneScene(q, npc); else openPrev.call(UI, npc); } // straight into their window
      UI.refresh && UI.refresh();
    });
  }
  function doneScene(q, npc) {
    const c = G.player.c; const lines = q.scDone && SCENE[q.scDone] ? SCENE[q.scDone](c, npc) : null;
    if (!lines || !npc) { finishMain(q); return true; }
    return play(lines, npc, () => { finishMain(q);
      // the liaison has more to do for you straight after: back into their window
      const nx = (q.next || []).map((id) => Sys.QUESTS[id]).find((n) => n && n.type === 'realm' && whoIs(n.f, n.turnin) === npc && !Sys.questComplete(n));
      if (nx) setTimeout(() => { try { openPrev.call(UI, npc); } catch (er) {} }, 60); });
  }
  // the dock: a new hero is met as they step off the ship
  Story.arrive = function () {
    const p = G.player; if (!p || p.dead) return false; const c = p.c, f = c.faction; const id = f + '_arrive';
    if (!Sys.QUESTS[id] || c.quests.done[id] || c.quests.active[id]) return false;
    let hm = npcOf(f, 'harbor'); if (!hm) { spawnHarbour(f); hm = npcOf(f, 'harbor'); } if (!hm) { takeQuest(id); return false; }
    // they come to you if you landed somewhere else
    if (Math.hypot(hm.x - p.x, hm.y - p.y) > 160) { hm.x = p.x + 40; hm.y = p.y + 20; if (W.isBlockedTile(Math.floor(hm.x / TS), Math.floor(hm.y / TS))) { hm.x = p.x - 30; hm.y = p.y; } }
    G.faceTo && G.faceTo(hm, p);
    return play(SCENE.arrive(c, hm), hm, () => { takeQuest(id); if (UI.banner) UI.banner('An Urgent Summons', Sys.QUESTS[id].text); });
  };
  // the harbourmaster stands at the head of the pier
  function spawnHarbour(f) {
    const cd = W.cityData[f], H = cd && cd.harbour; if (!H || (W.realm && W.realm !== 'main')) return;
    if (G.ents.some((e) => e.role === 'harbor' && e.city === f && !e.removed)) return;
    const tile = (i, s) => [(H.gx + H.dx * (H.k + 1 + i) + H.px * s + 0.5) * TS, (H.gy + H.dy * (H.k + 1 + i) + H.py * s + 0.5) * TS];
    let x = null, y = null;
    for (const [i, sd] of [[-3.2, 1.3], [-3.2, -0.6], [-4, 1.6], [-2.6, 1.6], [-4.5, 0], [-3, 2.4]]) { const [tx, ty] = tile(i, sd); if (!W.isBlockedTile(Math.floor(tx / TS), Math.floor(ty / TS))) { x = tx; y = ty; break; } }
    if (x == null) [x, y] = tile(-3.2, 1.3);
    const sy = f === 'sylvan';
    const e = G.makeEnt({ type: 'npc', role: 'harbor', city: f, faction: f, name: sy ? 'Nessa Tidewell' : 'Bram Saltmarsh', title: 'Harbourmaster', x, y, homeX: x, homeY: y, level: 20, hostile: false, services: ['quest'], gender: sy ? 'f' : 'm', race: 'human', speed: 70, seed: 0.3 });
    e.static = true; e.hpMax = e.hp = 500; e.qkey = 'harbor';
    e.look = { race: 'human', gender: e.gender, skin: KR.S ? KR.S.skinOf('human', 2) : '#d8b090', hair: sy ? '#8a4a2a' : '#5a4a3a', hairStyle: sy ? 3 : 1, beardStyle: sy ? 0 : 2, beard: '#5a4a3a', armor: { kind: 'leather', col: '#2e4a6a', trim: '#e0c890' }, sash: '#c84a3a', hat: 'feather', hatCol: '#2a3a5a' };
    e.greetFn = () => { const c = G.player.c; return c.quests.done[f + '_arrive'] ? U.pick(['Fair winds today. The ships are all in.', 'Mind the ropes on the pier.', 'The king keeps you busy, eh?']) : 'The king is waiting for you!'; };
  }
  const sc2 = Sys.spawnCity;
  Sys.spawnCity = function (f) { const r = sc2.apply(this, arguments); try { spawnHarbour(f); } catch (er) { console.warn(er); } return r; };
  // ---- who can start a scene: walking up to them, or clicking them ----
  const close3 = (a, b, r) => Math.hypot(a.x - b.x, a.y - b.y) < r && (!(window.K3 && window.K3.actorY) || Math.abs(window.K3.actorY(a) - window.K3.actorY(b)) < 1.8);
  function sceneFor2(npc, near) { // the scene this person has waiting for you, if any (near: you walked up)
    const p = G.player, c = p.c; if (!npc || npc.city !== c.faction) return null;
    for (const id in c.quests.active) {
      const q = Sys.QUESTS[id]; if (!isMain(q) || q.f !== c.faction) continue; const st = c.quests.active[id];
      if (q.meet && !st.met && whoIs(q.f, q.meet) === npc) return () => meetScene(q, npc);
      if (!q.auto && Sys.questComplete(q) && whoIs(q.f, q.turnin) === npc && (q.scDone || q.type !== 'meet')) return () => doneScene(q, npc);
    }
    // a hero who never got the summons (no ship to arrive on): the harbourmaster still has it
    if (npc.role === 'harbor' && !c.quests.done[c.faction + '_arrive'] && !c.quests.active[c.faction + '_arrive'] && !near) return () => Story.arrive();
    return null;
  }
  Story.tick = function () {
    const p = G.player; if (!p || p.dead || Story.playing() || (W.realm && W.realm !== 'main')) return;
    if (KR.Main && KR.Main.isRunning && !KR.Main.isRunning()) return;
    const c = p.c; if (!c || !c.quests) return;
    for (const id in c.quests.active) {
      const q = Sys.QUESTS[id]; if (!isMain(q) || q.f !== c.faction) continue; const st = c.quests.active[id];
      // the march has begun: the last step closes wherever you are
      if (q.auto && (!q.meet || st.met) && Sys.questComplete(q)) { finishMain(q); return; }
      const role = q.meet && !st.met ? q.meet : Sys.questComplete(q) && !q.auto ? q.turnin : null; if (!role) continue;
      const npc = whoIs(q.f, role); if (!npc || !close3(p, npc, 110)) continue;
      const go = sceneFor2(npc, true); if (go) { go(); return; }
    }
  };
  setInterval(() => { try { Story.tick(); } catch (er) { console.warn(er); } }, 250);
  // clicking someone (or pressing E): their scene first; the king's own quests open and close with him talking
  const openPrev = UI.openNPC;
  UI.openNPC = function (e) {
    try {
      const p = G.player; if (p && e && !Story.playing()) {
        const go = sceneFor2(e, false); if (go) { go(); return; }
        const c = p.c;
        if ((e.type === 'king' || e.role === 'king') && e.city === c.faction) {
          const r = Sys.questsFor(e);
          const ready = r.ready.find((q) => !isMain(q) && q.giver === 'king' && sceneFor(q, 'done') && sceneFor(q, 'done').length);
          if (ready) { play(sceneFor(ready, 'done'), e, () => { quiet++; try { Sys.turnIn(ready); } finally { quiet--; } setTimeout(() => UI.openNPC(e), 50); }); return; }
          const offer = r.avail.find((q) => !isMain(q) && q.giver === 'king' && sceneFor(q, 'offer'));
          if (offer) { play(sceneFor(offer, 'offer'), e, () => { quiet++; try { Sys.acceptQuest(offer); } finally { quiet--; } if (UI.banner) UI.banner(offer.title, offer.text.length > 150 ? offer.text.slice(0, 147).replace(/\s+\S*$/, '') + '...' : offer.text); }); return; }
        }
      }
    } catch (er) { console.warn(er); }
    return openPrev.apply(this, arguments);
  };
  // the old wrappers play the king's scenes after a quest is taken or handed in from his window; ours already did
  const acc2 = Sys.acceptQuest, ti2 = Sys.turnIn;
  Sys.acceptQuest = function (q) { if (!quiet) return acc2.apply(this, arguments); const sv = q.giver; q.giver = '_'; try { return acc2.apply(this, arguments); } finally { q.giver = sv; } };
  Sys.turnIn = function (q) {
    if (quiet) { const sv = q.giver; q.giver = '_'; try { return ti2.apply(this, arguments); } finally { q.giver = sv; } }
    const r = ti2.apply(this, arguments);
    // a main quest handed in from a window still moves the story along
    if (isMain(q) && G.player.c.quests.done[q.id]) for (const n of q.next || []) takeQuest(n);
    return r;
  };
  // heroes from before the homecoming keep their place in the story
  const sp2 = Sys.startPlayer;
  Sys.startPlayer = function (c) {
    const r = sp2.apply(this, arguments);
    try { const f = c.faction; const Q = Sys.QUESTS; const qd = c.quests.done, qa = c.quests.active;
      // the old homecoming (smith's tools, timber and stone, Kingdom Levels) is retired: those steps leave the journal
      let wasOn = false; for (const id of OLD_MAIN(f)) { if (qa[id] || qd[id]) wasOn = true; delete qa[id]; }
      const veteran = wasOn || qd[f + '_story0'] || qa[f + '_story0'] || qd[f + '_build1'] || qd[f + '_story1'] || c.level >= 6;
      if (Q[f + '_arrive'] && veteran) {
        if (!qd[f + '_arrive']) { delete qa[f + '_arrive']; qd[f + '_arrive'] = 1; }
        // the new steps count as done as far as the kingdom already stands; the story heroes are past them all
        const past = qd[f + '_story1'] || qa[f + '_story1'] || qd[f + '_story2'];
        const steps = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'], ok = { k1: 'liaison', k2: 'workers', k3: 'mills', k4: 'barracks', k5: 'raiders' };
        let next = null;
        for (const k of steps) { const id = f + '_' + k; if (qd[id]) continue; if (past || (ok[k] && COND[ok[k]](f))) { delete qa[id]; qd[id] = 1; continue; } next = id; break; }
        if (next && !qa[next] && Q[next]) setTimeout(() => { try { if (G.player && G.player.c === c) takeQuest(next); } catch (er) { console.warn(er); } }, 0);
      }
    } catch (er) { console.warn(er); }
    return r;
  };
})();

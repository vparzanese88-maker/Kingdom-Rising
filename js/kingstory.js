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
      ['King Aldric', 'There you are. Three months at sea, and you come home to a kingdom torn in half. Sit. Listen.'],
      ['King Aldric', 'Two weeks after you sailed, my father raised his cup at the midwinter feast and drank poison. He died before dawn, in my arms.'],
      ['King Aldric', 'And my brother? Theron ran. That same night, into the elven forests, with half the court at his heels. Now the elves call him king.'],
      ['King Aldric', 'Valenmoor is a hamlet with a wall. I need it to be a kingdom. I need every soldier, every smith, every healer working, and I need you.'],
      ['King Aldric', 'Go to my captain, my smith and the healer. See what they need. Then come back to me. We have a war to win.'],
    ], done: [
      ['King Aldric', 'Good. You have seen it with your own eyes: we are thin, but we are not broken.'],
      ['King Aldric', 'Now we build. Timber and stone first. A king without walls is just a man with a crown.'],
    ] },
    rats: { offer: [
      ['King Aldric', 'Something is rotten beneath our streets. The Rat Tail Gang has been passing letters out through the sewer grates.'],
      ['King Aldric', 'Letters to the elves. To Theron. Go down there, find the gang\'s leader, Fingers Fenwick, and bring me whatever he carries. Every scrap of it.'],
    ], done: [
      ['King Aldric', 'Give it here. A wax seal... a leaf. Theron\'s own leaf.'],
      ['King Aldric', '"Nightshade, as before, from the alchemist of the marsh. Payment on delivery." As before. AS BEFORE! He poisoned Father, and now he means to poison me!'],
      ['King Aldric', 'Burn the sewers if you must. No more letters leave this city.'],
    ] },
    cupbearer: { offer: [
      ['King Aldric', 'There was a cupbearer at the feast. Old Wendel. He poured the wine, and he vanished the same night as my brother.'],
      ['King Aldric', 'Word is he hides at the Wayfarer\'s Rest, at the crossroads. Find him. Make him tell you what he saw. Gently, if he lets you.'],
    ], done: [
      ['King Aldric', 'Theron\'s hand over the cask. A small green vial. Wendel saw it all, and kept silent out of fear.'],
      ['King Aldric', 'I knew it. In my bones I knew it. Thank you. You have given me the truth, and the truth is a weapon.'],
    ] },
    ledger: { offer: [
      ['King Aldric', 'The alchemist of the marsh. The one in the letter. The lizardfolk of the Dreadmire guard her shack and trade in her poisons.'],
      ['King Aldric', 'She keeps a ledger: every buyer, every vial. Bring it to me, and the whole realm will read my brother\'s name in it.'],
    ], done: [
      ['King Aldric', '"Midwinter. Nightshade, three drams. Paid in gold, sealed with the leaf." There it is, in ink.'],
      ['King Aldric', 'I will have this read in every square of Valenmoor. Let them see who their true king is, and who is a murderer.'],
    ] },
    war: { offer: [
      ['King Aldric', 'Enough. We are strong now. The walls are high and the people know the truth.'],
      ['King Aldric', 'Raise a war party at the barracks. March on Aelindor. Cut down whatever stands between you and my brother.'],
      ['King Aldric', 'And when you find him, look him in the eye. I want him to know whose son sent you.'],
    ], done: [] },
  };
  SCN.sylvan = {
    home: { offer: [
      ['King Theron', 'You made it home. Good. Sit with me a moment, before the world starts shouting again.'],
      ['King Theron', 'At the midwinter feast my father drank to his sons, and the cup was poisoned. By dawn he was gone.'],
      ['King Theron', 'Aldric had the feast-hall records burned that same morning, and his guards came for anyone who asked questions. So I ran. The elves took me in, and crowned me.'],
      ['King Theron', 'Aelindor shelters everyone fleeing him now, and it is barely a village. I need it strong. I need you.'],
      ['King Theron', 'Go and see my captain, my smith and the healer. They will tell you what we lack. Then come back, and we will begin.'],
    ], done: [
      ['King Theron', 'Now you know how thin we are spread. But these people chose us, and that is worth more than any wall.'],
      ['King Theron', 'Still, walls help. Timber and stone, my friend. Let us build.'],
    ] },
    rats: { offer: [
      ['King Theron', 'There are rats in our sewers, and not the four-legged kind. Someone is passing letters out through the grates.'],
      ['King Theron', 'Their leader is an orc they call Skulk the Drowned. Go down through the grate, bring me what he carries.'],
    ], done: [
      ['King Theron', 'Aldric\'s lion on the seal. Of course.'],
      ['King Theron', '"Nightshade, as before, from the alchemist of the marsh." As before... He did it. My own brother poured death into our father\'s cup, and now he wants mine!'],
      ['King Theron', 'Seal the grates. Nothing else leaves this city without my knowing.'],
    ] },
    cupbearer: { offer: [
      ['King Theron', 'Old Wendel, Father\'s cupbearer, poured the wine that night. He fled and has not been seen since.'],
      ['King Theron', 'A trader swears he is hiding at the Wayfarer\'s Rest, at the crossroads. Find him, calm him, and hear what he saw.'],
    ], done: [
      ['King Theron', 'Aldric at the cask, before the toast. A green vial. Wendel saw it, and kept silent for fear of the king\'s guards.'],
      ['King Theron', 'Then it is true. I never wanted it to be true.'],
    ] },
    ledger: { offer: [
      ['King Theron', 'The alchemist of the marsh sells to anyone with gold. The lizardfolk of the Dreadmire guard her trade.'],
      ['King Theron', 'She keeps a ledger. If my brother bought nightshade, his seal is in it. Bring it to me.'],
    ], done: [
      ['King Theron', '"Midwinter. Nightshade, three drams. Paid in gold, sealed with the lion." There it is, in her own hand.'],
      ['King Theron', 'Let every elf and every man in Aelindor read it. The true king is the one who did not murder his father.'],
    ] },
    war: { offer: [
      ['King Theron', 'We have the truth. We have the walls. We have the people.'],
      ['King Theron', 'Raise a war party at the barracks and march on Valenmoor. End this.'],
      ['King Theron', 'If you find him... let him speak, before the end. I want to know why.'],
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
      Q[f + '_story0'] = { id: f + '_story0', f, giver: 'king', lv: 1, type: 'visit', roles: ['captain', 'smith', 'healer'], scene: 'home', title: 'Home from the Sea',
        text: `${kingOf(f)} wants you to see the city with your own eyes: speak with the captain of the guard, the smith and the healer, then return to him.`, reward: { coin: 150, status: 10 } };
      Q[f + '_story1'] = { id: f + '_story1', f, giver: 'king', lv: 4, type: 'collect', item: 'Sealed Letter', storyDrop: [leader], mobs: [leader], n: 1, scene: 'rats', title: 'Rats Beneath the Streets', req: f + '_build1',
        text: `Someone in the sewers is passing letters to ${E.king}. Climb down through the sewer grate in the city, find ${D.MOBS[leader].name} and bring the king whatever he carries.`, reward: { coin: 800, status: 30, item: { k: 'weapon', tier: 0, q: 1.25 } } };
      Q[f + '_story2'] = { id: f + '_story2', f, giver: 'king', lv: 12, type: 'visit', roles: ['cupbearer'], scene: 'cupbearer', title: 'The Cupbearer', req: f + '_story1',
        text: 'Old Wendel, who poured the wine at the midwinter feast, is hiding at the Wayfarer\'s Rest at the crossroads. Find him and hear what he saw.', reward: { coin: 2500, status: 50 } };
      Q[f + '_story3'] = { id: f + '_story3', f, giver: 'king', lv: 26, type: 'collect', item: "Alchemist's Ledger", storyDrop: ['lizard_shaman', 'lizard_warrior', 'lizardman'], mobs: ['lizard_shaman', 'lizard_warrior', 'lizardman'], n: 1, scene: 'ledger', title: "The Alchemist's Ledger", req: f + '_story2',
        text: 'The lizardfolk of the Dreadmire guard the marsh alchemist who sold the nightshade. Take her ledger from them and bring it to the king.', reward: { coin: 12000, status: 90, item: { k: 'jewel', slot: 'neck', tier: 3, q: 1.2 } } };
      Q[f + '_story4'] = { id: f + '_story4', f, giver: 'king', lv: 35, type: 'warking', scene: 'war', title: `The Fall of ${E.city}`, req: f + '_story3',
        text: `Raise a war party at the barracks, march on ${E.city} and bring down ${E.king}. Let him speak before the end.`, reward: { coin: 0, status: 0 } };
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
})();

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
        text: `Someone in the sewers is passing letters to ${E.king}. Go down through the sewer outflow outside the city walls, find ${D.MOBS[leader].name} and bring the king whatever he carries.`, reward: { coin: 800, status: 30, item: { k: 'weapon', tier: 0, q: 1.25 } } };
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

  // =====================================================================================================
  // the homecoming: the main quest line. The harbourmaster meets you on the dock, the king tells you what
  // is coming, and his people show you how a kingdom is raised: tools from the smith, timber and stone,
  // the recruiter and his soldiers, the mercenaries, the walls of Kingdom Level 2, and the battering ram.
  // Every step opens with a filmed scene that plays by itself as you walk up (or click), before anything else.
  // =====================================================================================================
  const Story = (KR.Story = {});
  const clsName = (c) => D.CLASSES[c.cls].name;
  const enemyOf = (f) => (f === 'crown' ? 'sylvan' : 'crown');
  const npcOf = (f, role) => G.ents.find((e) => e.role === role && e.city === f && !e.removed && !e.dead);
  const nameOf = (f, role, fb) => { const e = npcOf(f, role); return e ? e.name.split(' ')[0] : fb; };
  const ownTool = (c, k) => !!((c.equip[k] && c.equip[k].tool === k) || c.inv.some((x) => x && x.tool === k));
  const MG = { wood: 'oak', stone: 'fieldstone', n: 5 };
  const MAIN = (f) => ['arrive', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6'].map((k) => f + '_' + k);
  let quiet = 0; // our own accept / turn-in: no extra scene from the wrappers above
  // ---- the lines: L(who, text, opt) ----
  const L = (who, text, opt) => [who, text, 0, opt || {}];
  const words = (c) => { const f = c.faction, F = D.FACTIONS[f], E = D.FACTIONS[enemyOf(f)];
    return { f, F, E, K: kingOf(f), bro: F.brother, broK: E.king, city: F.city, ecity: E.city, cls: clsName(c), me: c.name }; };
  const SCENE = {
    arrive: (c, e) => { const w = words(c); return [
      L(e.name, `Ahoy there! Welcome back, ${w.cls}! Three months at sea and you come home in one piece. Mostly in one piece.`, { g: 'raise', shot: 'wide' }),
      L(w.me, 'Good to be home. Why does everyone on this dock look like someone died?'),
      L(e.name, `No time for ale and gossip, I'm afraid. The king must speak with you at once. It's urgent. He said "at once" twice, and ${w.K.replace(/^King /, '')} never says anything twice.`),
      L(e.name, `Up through the town to the castle, then all the way up the King's Tower to the top floor. Big chair, bigger crown. You can't miss him.`, { g: 'thrust' }),
      L(e.name, `Go on, ${w.cls}. And keep your wits about you: a lot has changed while you were away.`),
    ]; },
    m1meet: (c, e) => { const w = words(c); return [
      L(e.name, `Hah! Another one the king sent down. Let me guess: "Go and see the smith, the smith will sort you out."`, { g: 'hop', shot: 'wide' }),
      L(w.me, 'He said you would sell me a woodcutting axe and a pick.'),
      L(e.name, `That I will. Copper, cheap and honest. They won't fell a darkoak, but they'll do for the oaks around ${w.city}.`),
      L(e.name, 'Buy them from me and wear them: they go in their own slots on your character sheet, Woodcutting and Mining, and leave your hands free for that weapon.'),
      L(e.name, 'Then out past the walls. Hold your mouse over a tree and the cursor turns into a little axe: right-click it and chop. A boulder turns it into a pick. Right-click, and swing.', { g: 'chop', gd: 1.0 }),
      L(e.name, 'Now, what will it be? Take your time. Actually, don\'t: the king is in a hurry, and when the king is in a hurry, so am I.'),
    ]; },
    m1done: (c, e) => { const w = words(c); return [
      L(e.name, 'There. Now you look like someone who works for a living.', { g: 'raise' }),
      L(e.name, `Oaks grow all around the city, and fieldstone boulders lie out in the fields past the gates. Bring the king five oak logs and five fieldstone. He'll want a mountain of it later. Kings always do.`, { g: 'thrust' }),
    ]; },
    arriveDone: (c, e) => { const w = words(c); const mine = w.f === 'crown'; return [
      L(w.K, `Welcome home, sailor. ${w.me}, isn't it? The ${w.cls} from the spring fleet. Come closer. I don't bite. Not before supper.`, { g: 'raise', shot: 'wide' }),
      L(w.K, 'I will be plain, because there is no time to be anything else. I need your help.'),
      L(w.K, mine ? `While you were at sea, my father drank poison at his own feast. My brother ${w.bro} fled that same night to ${w.ecity}, and the elves put a crown on his head.` : `While you were at sea, my father drank poison at his own feast. My brother ${w.bro} blamed me, and his guards came for me, so I fled here, to ${w.city}.`),
      L(w.K, `And now my spies tell me ${w.bro} is building an army in ${w.ecity}. Soldiers, siege engines, all of it. He is planning an attack, and he means to finish it in this hall.`, { g: 'thrust' }),
      L(w.me, 'Then we had better be ready for him.'),
      L(w.K, `We had better be more than ready. We need to raise these walls and build an army: one to defend ${w.city}, and one to march out and destroy ${w.broK}.`, { g: 'slam', gd: 1.1 }),
      L(w.K, `Walls need timber and stone, and timber and stone need tools. Go down to the smithy first: ${nameOf(w.f, 'smith', 'my smith')} will sell you an axe and a pick.`, { g: 'thrust' }),
      L(w.K, 'Then the barracks, where my recruiter will teach you how an army is raised. And the mercenaries in the plaza. You will need every blade we can buy.'),
      L(w.K, `Off you go. And ${w.me}... welcome home. I mean it.`),
    ]; },
    m2done: (c, e) => { const w = words(c); return [
      L(w.K, 'Oak and fieldstone, cut with your own hands. Good. Keep them: they are the first stones of our new walls.', { shot: 'wide' }),
      L(w.K, `Here is how a kingdom grows. Every quest you finish for our people earns ${w.city} status. With enough status, and the timber and stone for my masons, ${w.city} rises a Kingdom Level.`),
      L(w.K, `Thirty oak logs and thirty fieldstone, and we become a walled village: Kingdom Level 2. I have set it down as The King's Works. It is in your journal.`, { g: 'thrust' }),
      L(w.K, 'Every level brings more: new shops, better guards, engines on the walls, more soldiers in the barracks. And sharper teeth for us.', { g: 'raise' }),
      L(w.K, `Now go to the barracks and find the recruiter. ${w.bro} will not wait for us to be ready.`),
    ]; },
    m3meet: (c, e) => { const w = words(c); return [
      L(e.name, 'So you are the one the king keeps going on about. Stand up straight. Hm. You\'ll do.', { shot: 'wide' }),
      L(e.name, 'This is the barracks. I sign up soldiers: footmen, archers, knights, healers. You pay their wages in coin, and they wait right here until you give the order.'),
      L(e.name, 'The bigger the kingdom, the more soldiers these barracks can hold. A Level 1 kingdom gets a handful. A capital gets a host.'),
      L(e.name, `When you are ready, come back and send the war party: they march on ${w.ecity} and fight their way to ${w.broK}'s throne. You can march with them. I recommend it. It's more fun from the front.`, { g: 'thrust' }),
      L(e.name, `And when ${w.bro}'s raiders come for us, the bells ring and the gates slam shut. Nobody gets in, nobody gets out. Get up on the walls and make them regret it.`, { g: 'raise' }),
      L(e.name, 'One more thing. Soldiers follow orders. Mercenaries follow coin, and they follow you. Go and see the Mercenary Trader in the plaza.'),
    ]; },
    m4meet: (c, e) => { const w = words(c); return [
      L(e.name, 'Looking for blades? You found the right man. My mercenaries walk at your side and fight whatever you fight, and the ones who can heal will keep you breathing.', { shot: 'wide' }),
      L(e.name, `The bad news: my lads don't work for a hamlet. Get ${w.city} to Kingdom Level 2 and I'll open my book to you. The price climbs with their level, and with every extra blade you hire.`),
      L(e.name, `And trust me, you'll want them. When you storm ${w.ecity} to get at ${w.bro}, the war party fights the guards. My mercenaries keep you alive long enough to reach the king.`, { g: 'thrust' }),
      L(w.me, 'So I should start saving my coin.'),
      L(e.name, 'Now you\'re thinking like a mercenary.', { g: 'hop' }),
    ]; },
    m5done: (c, e) => { const w = words(c); return [
      L(w.K, `Do you hear that? Hammers. Masons. A city that believes in itself again. ${w.city} is a Level 2 kingdom, and that is your doing.`, { g: 'raise', shot: 'wide' }),
      L(w.K, `Now, about breaking things. When raiders come, the bells ring and our gates close. ${w.bro}'s gates close too, and you cannot climb an army over a wall.`),
      L(w.K, 'So you bring a battering ram. Now that we are Level 2, the barracks can build you one. The war party marches behind it, it rolls up to their gate, and it knocks. Hard.', { g: 'slam', gd: 1.1 }),
      L(w.K, 'Go and see the recruiter about it. And hire those mercenaries: you will need them when you reach my brother.', { g: 'thrust' }),
    ]; },
    m6meet: (c, e) => { const w = words(c); return [
      L(e.name, 'The king wants a ram? Finally, someone in this city who understands doors.', { g: 'hop', shot: 'wide' }),
      L(e.name, 'You buy it here, before you send the war party. It\'s heavy and slow, slower than a man can run, so the soldiers march behind it and keep it safe.'),
      L(e.name, 'At their gate it swings: five good blows, a few seconds each, and the gate comes down in splinters. Then it\'s through the courtyard and up to the king.', { g: 'slam', gd: 1.1 }),
      L(e.name, `If they break the ram before it breaks the gate, the war party is stuck outside, so guard it. Same for us: if ${w.bro} brings a ram to our gate, smash it before it smashes us.`),
      L(e.name, 'That\'s the lesson. Now go and make yourself useful. I hear the king has another errand for you.'),
    ]; },
  };
  // ---- the quests ----
  const bq2 = Sys.buildQuests;
  Sys.buildQuests = function () {
    bq2.apply(this, arguments);
    const Q = Sys.QUESTS;
    for (const f of ['crown', 'sylvan']) {
      const F = D.FACTIONS[f], E = D.FACTIONS[enemyOf(f)], K = kingOf(f), id = (k) => f + '_' + k;
      const base = { f, lv: 1, main: true };
      Q[id('arrive')] = Object.assign({ id: id('arrive'), giver: 'harbor', turnin: 'king', type: 'meet', meet: 'king', title: 'An Urgent Summons', next: [id('m1')], scDone: 'arriveDone', reward: { coin: 25, status: 5 },
        get text() { const c = G.player && G.player.c; return `Welcome back, ${c ? clsName(c) : 'sailor'}. The king must speak with you at once: it's urgent. Climb to the top floor of the King's Tower in ${F.city} and speak with ${K}.`; } }, base);
      Q[id('m1')] = Object.assign({ id: id('m1'), giver: 'king', turnin: 'smith', type: 'tools', meet: 'smith', req: id('arrive'), title: 'Tools of the Trade', next: [id('m2')], scMeet: 'm1meet', scDone: 'm1done', reward: { coin: 60, status: 3 },
        text: `${K} wants his walls raised, and that starts with tools. See the blacksmith of ${F.city}, buy a woodcutting axe and a mining pick, and wear them in your Woodcutting and Mining slots.` }, base);
      Q[id('m2')] = Object.assign({ id: id('m2'), giver: 'smith', turnin: 'king', type: 'mgather', req: id('m1'), title: 'Timber and Stone', next: [id('build1'), id('m3')], scDone: 'm2done', reward: { coin: 80, status: 5 },
        text: `Go out past the walls and gather ${MG.n} Oak Logs and ${MG.n} Fieldstone: hold the mouse over a tree or a boulder (the cursor becomes the tool) and right-click it. Then bring them up to ${K}.` }, base);
      Q[id('m3')] = Object.assign({ id: id('m3'), giver: 'king', turnin: 'recruiter', type: 'meet', meet: 'recruiter', req: id('m2'), title: 'The Recruiter', next: [id('m4')], scMeet: 'm3meet', reward: { coin: 40, status: 3 },
        text: `${K} wants an army. Find the recruiter in the barracks of ${F.city} and learn how soldiers are raised and sent to war.` }, base);
      Q[id('m4')] = Object.assign({ id: id('m4'), giver: 'recruiter', turnin: 'mercmaster', type: 'meet', meet: 'mercmaster', req: id('m3'), title: 'Swords for Hire', next: [id('m5')], scMeet: 'm4meet', reward: { coin: 40, status: 3 },
        text: `Soldiers follow orders; mercenaries follow you. Speak with the Mercenary Trader in the plaza of ${F.city}.` }, base);
      Q[id('m5')] = Object.assign({ id: id('m5'), giver: 'king', turnin: 'king', type: 'klevel', n: 2, req: id('m4'), title: 'Raise the Walls', next: [id('m6')], scDone: 'm5done', reward: { coin: 300, status: 10 },
        text: `Raise ${F.city} to Kingdom Level 2: finish The King's Works (Oak Logs and Fieldstone for the masons) and earn status by doing quests for its people. Then return to ${K}.` }, base);
      Q[id('m6')] = Object.assign({ id: id('m6'), giver: 'king', turnin: 'recruiter', type: 'meet', meet: 'recruiter', req: id('m5'), title: 'The Battering Ram', next: [], scMeet: 'm6meet', reward: { coin: 150, status: 8 },
        text: `${E.city}'s gates close when its bells ring. Ask the recruiter in the barracks how a battering ram breaks a gate.` }, base);
      // the old opening errand stays only for heroes already on it; the King's Works follow the tools
      if (Q[id('story0')]) Q[id('story0')].req = id('retired');
      if (Q[id('build1')]) Q[id('build1')].req = id('m2');
      if (Q[id('story1')]) Q[id('story1')].req = id('m6');
      // gathering is a right-click now
      for (let i = 1; i <= 4; i++) { const q = Q[id('build' + i)]; if (q && q.text) q.text = q.text.replace('walk up and press E', 'hold the mouse over a tree or a boulder and right-click it'); }
    }
  };
  const isMain = (q) => !!(q && q.main);
  const qp2 = Sys.questProgress, qg2 = Sys.questGoal;
  Sys.questProgress = function (q) {
    if (!isMain(q)) return qp2.apply(this, arguments);
    const c = G.player.c, st = c.quests.active[q.id] || {};
    if (q.type === 'meet') return st.met ? 1 : 0;
    if (q.type === 'tools') return (ownTool(c, 'axe') ? 1 : 0) + (ownTool(c, 'pick') ? 1 : 0);
    if (q.type === 'mgather') { const K = KR.Kingdom; return K ? Math.min(MG.n, K.have(c, MG.wood)) + Math.min(MG.n, K.have(c, MG.stone)) : 0; }
    if (q.type === 'klevel') return Sys.cityLevel(q.f) >= q.n ? 1 : 0;
    return 0;
  };
  Sys.questGoal = function (q) { if (!isMain(q)) return qg2.apply(this, arguments); return q.type === 'tools' ? 2 : q.type === 'mgather' ? MG.n * 2 : 1; };
  Story.progText = function (q) {
    const c = G.player.c, st = c.quests.active[q.id] || {}, F = D.FACTIONS[q.f];
    if (q.type === 'meet') return `Speak with ${(npcOf(q.f, q.meet) || { name: q.meet }).name}`;
    if (q.type === 'tools') return st.met ? `${ownTool(c, 'axe') ? '✓' : '○'} Woodcutting axe · ${ownTool(c, 'pick') ? '✓' : '○'} Mining pick` : `Visit ${(npcOf(q.f, 'smith') || { name: 'the blacksmith' }).name} at the smithy`;
    if (q.type === 'mgather') { const K = KR.Kingdom; return `${Math.min(MG.n, K.have(c, MG.wood))} / ${MG.n} Oak Logs · ${Math.min(MG.n, K.have(c, MG.stone))} / ${MG.n} Fieldstone`; }
    if (q.type === 'klevel') return `${F.city}: Kingdom Level ${Sys.cityLevel(q.f)} / ${q.n}`;
    return '';
  };
  // where the map points
  let gatherPts = null, gatherT = 0;
  const qt2 = Sys.questTarget;
  Sys.questTarget = function (q) {
    if (!isMain(q)) return qt2.apply(this, arguments);
    const c = G.player.c, st = c.quests.active[q.id] || {};
    const at = (role) => { const n = npcOf(q.f, role); return n ? [{ x: n.x / TS, y: n.y / TS, r: 2, npc: true }] : []; };
    if (q.meet && !st.met) return at(q.meet);
    if (Sys.questComplete(q)) return at(q.turnin);
    if (q.type === 'mgather' && KR.Kingdom) {
      if (!gatherPts || performance.now() - gatherT > 6000) { gatherT = performance.now(); const K = KR.Kingdom, p = G.player; let bw = null, bs = null, dw = 1e9, ds = 1e9;
        for (const d of W.decor) { const h = K.harvestOf(d); if (!h || (d.cutUntil && d.cutUntil > G.now)) continue; const dd = Math.hypot(d.x - p.x, d.y - p.y); if (h.mat === MG.wood && dd < dw) { dw = dd; bw = d; } else if (h.mat === MG.stone && dd < ds) { ds = dd; bs = d; } }
        gatherPts = [bw, bs].filter(Boolean).map((d) => ({ x: d.x / TS, y: d.y / TS, r: 4 })); }
      const K = KR.Kingdom; return gatherPts.filter((m, i) => (i === 0 && K.have(c, MG.wood) < MG.n) || (i === 1 && K.have(c, MG.stone) < MG.n) || gatherPts.length === 1);
    }
    if (q.type === 'klevel') return at('king');
    return at(q.turnin);
  };
  // the person you are sent to see wears a gold ? until you have spoken
  const nm2 = Sys.npcMarker;
  Sys.npcMarker = function (npc) {
    const p = G.player; if (p && npc && npc.city === p.c.faction) { const c = p.c;
      for (const id in c.quests.active) { const q = Sys.QUESTS[id]; if (!isMain(q)) continue; const st = c.quests.active[id]; if ((q.meet === npc.role && !st.met) || (q.scDone && q.turnin === npc.role && Sys.questComplete(q))) return '?'; } }
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
      else if (q.type === 'tools') { if (Sys.questComplete(q)) doneScene(q, npc); else { openPrev.call(UI, npc); } } // straight into the smith's shop
      UI.refresh && UI.refresh();
    });
  }
  function doneScene(q, npc) {
    const c = G.player.c; const lines = q.scDone && SCENE[q.scDone] ? SCENE[q.scDone](c, npc) : null;
    if (q.type === 'tools') for (const k of ['axe', 'pick']) if (!c.equip[k]) { const it = c.inv.find((x) => x && x.tool === k); if (it && Sys.equip) Sys.equip(it); } // wear them
    if (!lines || !npc) { finishMain(q); return true; }
    return play(lines, npc, () => finishMain(q));
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
      if (q.meet === npc.role && !st.met) return () => meetScene(q, npc);
      if (q.turnin === npc.role && Sys.questComplete(q) && (q.scDone || q.type !== 'meet')) return () => doneScene(q, npc);
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
      // the smith's tools are bought: he sees you are kitted out and says so
      if (q.type === 'tools' && st.met && Sys.questComplete(q)) { const sm = npcOf(q.f, 'smith'); if (UI.isOpen && UI.isOpen('npc')) return; doneScene(q, sm && close3(p, sm, 360) ? sm : null); return; }
      const role = q.meet && !st.met ? q.meet : Sys.questComplete(q) ? q.turnin : null; if (!role) continue;
      const npc = npcOf(q.f, role); if (!npc || !close3(p, npc, 110)) continue;
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
    try { const f = c.faction; const Q = Sys.QUESTS;
      if (Q[f + '_arrive'] && (c.quests.done[f + '_story0'] || c.quests.active[f + '_story0'] || c.quests.done[f + '_build1'] || c.quests.done[f + '_story1'] || c.level >= 6)) for (const id of MAIN(f)) if (!c.quests.done[id] && !c.quests.active[id]) c.quests.done[id] = 1;
    } catch (er) { console.warn(er); }
    return r;
  };
})();

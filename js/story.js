// Kingdom Rising — the story a new hero sees before entering the world:
// the old king poisoned, two sons at each other's throats, a kingdom torn in two, and why the hero's king is in the right.
(function () {
  const KR = window.KR; const { D, U, S } = KR;
  const Story = (KR.Story = {});
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------------------------------------------------------------- the cast
  const skin = () => S.skinOf('human', 1);
  const EDRIC = () => ({ race: 'human', gender: 'm', skin: skin(), hair: '#e8e0d0', hairStyle: 1, beard: '#e8e0d0', armor: { kind: 'cloth', col: '#7a1e1e', trim: '#e0b84a' }, robe: true, crown: true, cape: '#5a1010' });
  const ALDRIC = () => ({ race: 'human', gender: 'm', skin: skin(), hair: '#3a2a1c', hairStyle: 1, beard: '#3a2a1c', armor: { kind: 'plate', col: '#28457a', trim: '#e0b84a' }, cape: '#7a1e1e', weapon: '1HS' });
  const THERON = () => ({ race: 'human', gender: 'm', skin: skin(), hair: '#a83a22', hairStyle: 2, beard: '#a83a22', armor: { kind: 'plate', col: '#2e5a3a', trim: '#e0b84a' }, cape: '#1e4a2c', weapon: '1HS' });
  const folk = (race, i, col) => ({ race, gender: i % 2 ? 'f' : 'm', skin: S.skinOf(race, i % 4), hair: race === 'darkelf' ? S.HAIRS[4] : S.HAIRS[(i * 3) % 7], hairStyle: i % 4, armor: { kind: i % 3 ? 'cloth' : 'leather', col: col || ['#5a6a3a', '#3a5a6a', '#6a4a3a', '#4a3a5a', '#7a6a4a'][i % 5], trim: '#2a1e14' }, beard: (race === 'dwarf' || (race === 'human' && i % 3 === 0)) && i % 2 === 0 ? S.HAIRS[(i * 3) % 7] : null });
  const crownOf = (look, on) => Object.assign({}, look, { crown: on });
  const fig = (g, x, y, sc, look, t, o = {}) => { try { S.drawHumanoid(g, x, y, Object.assign({}, look, { scale: sc * (D.RACES[look.race] ? D.RACES[look.race].scale || 1 : 1), dir: o.dir || 0, moving: !!o.walk, walk: o.walk ? t * 9 : 0, atk: o.atk || 0, dead: o.dead, deadDir: o.deadDir || 1, sit: o.sit, cast: o.cast }), t); } catch (e) {} };

  // ---------------------------------------------------------------- painted backdrops
  function hall(g, w, h, t, tint) {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a1210'); gr.addColorStop(0.7, '#3a2a20'); gr.addColorStop(1, '#140e0a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; for (let r = 0; r < 14; r++) { const y = r * h * 0.05; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let k = 0; k < 30; k++) { const x = k * 70 + (r % 2) * 35; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h * 0.05); g.stroke(); } }
    // tall windows with light shafts
    for (let i = 0; i < 3; i++) { const x = w * (0.2 + i * 0.3); g.fillStyle = '#6a7a9a'; g.beginPath(); g.moveTo(x - 26, h * 0.42); g.lineTo(x - 26, h * 0.16); g.arc(x, h * 0.16, 26, Math.PI, 0); g.lineTo(x + 26, h * 0.42); g.fill();
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(200,210,255,${0.06 + Math.sin(t * 0.7 + i) * 0.02})`; g.beginPath(); g.moveTo(x - 26, h * 0.16); g.lineTo(x + 26, h * 0.16); g.lineTo(x + 140, h * 0.95); g.lineTo(x + 40, h * 0.95); g.fill(); g.restore(); }
    // banners
    for (const bx of [0.06, 0.94]) { const x = w * bx; g.fillStyle = tint || '#7a1e1e'; g.fillRect(x - 24, h * 0.1, 48, h * 0.38); g.beginPath(); g.moveTo(x - 24, h * 0.48); g.lineTo(x, h * 0.53); g.lineTo(x + 24, h * 0.48); g.fill(); g.fillStyle = '#e0b84a'; g.font = `${Math.round(h * 0.05)}px serif`; g.textAlign = 'center'; g.fillText('♛', x, h * 0.3); }
    // floor
    g.fillStyle = '#2a201a'; g.fillRect(0, h * 0.72, w, h * 0.28); g.fillStyle = '#6a1a1a'; g.beginPath(); g.moveTo(w * 0.44, h * 0.72); g.lineTo(w * 0.56, h * 0.72); g.lineTo(w * 0.7, h); g.lineTo(w * 0.3, h); g.fill();
    torches(g, w, h, t, [0.12, 0.88], h * 0.4);
  }
  function torches(g, w, h, t, xs, y) { for (const tx of xs) { const x = w * tx; g.fillStyle = '#3a2a1a'; g.fillRect(x - 3, y, 6, 26); const f = Math.sin(t * 13 + tx * 9) * 3; g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(x, y - 6, 2, x, y - 6, 120); gl.addColorStop(0, 'rgba(255,170,80,0.45)'); gl.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gl; g.fillRect(x - 120, y - 126, 240, 240); g.restore(); g.fillStyle = '#ffb04a'; g.beginPath(); g.ellipse(x, y - 6, 6, 12 + f, 0, 0, 6.28); g.fill(); g.fillStyle = '#ffe9a0'; g.beginPath(); g.ellipse(x, y - 3, 3, 6, 0, 0, 6.28); g.fill(); } }
  function night(g, w, h, t) {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#060814'); gr.addColorStop(1, '#1a2238'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,240,${0.2 + 0.6 * Math.abs(Math.sin(t * 0.6 + i))})`; g.fillRect(U.hash(i, 1) * w, U.hash(i, 2) * h * 0.6, 1.5, 1.5); }
    g.fillStyle = 'rgba(240,240,220,0.95)'; g.beginPath(); g.arc(w * 0.8, h * 0.2, Math.min(w, h) * 0.05, 0, 6.28); g.fill();
    // the old capital behind, dark
    g.fillStyle = '#0c0e18'; const cx = w * 0.18, cy = h * 0.7; g.fillRect(cx - 120, cy - 70, 240, 70); for (const tx of [-120, -40, 40, 100]) { g.fillRect(cx + tx, cy - 130, 22, 130); g.beginPath(); g.moveTo(cx + tx - 4, cy - 130); g.lineTo(cx + tx + 11, cy - 160); g.lineTo(cx + tx + 26, cy - 130); g.fill(); }
    for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(255,200,120,${0.5 + Math.sin(t * 2 + k) * 0.2})`; g.fillRect(cx - 100 + k * 45, cy - 40, 5, 8); }
    g.fillStyle = '#10141e'; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.74); for (let x = 0; x <= w; x += 10) g.lineTo(x, h * 0.74 + Math.sin(x * 0.01) * 10); g.lineTo(w, h); g.fill();
    g.strokeStyle = 'rgba(160,140,110,0.35)'; g.lineWidth = 18; g.beginPath(); g.moveTo(0, h * 0.86); g.quadraticCurveTo(w * 0.5, h * 0.8, w, h * 0.84); g.stroke();
  }
  function dawnForest(g, w, h, t) { KR.Menus.paintCity(g, w, h, 'sylvan', t); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,160,90,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }

  // ---------------------------------------------------------------- the scenes
  const SHARED = [
    { title: 'The Golden Years', music: 'town_crown', text: 'For forty years King Edric Valen ruled one kingdom, from the western plains to the old elven forests. Elves and dwarves, halflings and men all bent the knee to the same crown, and the land knew peace.',
      draw(g, w, h, t, s) { KR.Menus.paintCity(g, w, h, 'crown', t); const y = h * 0.72; fig(g, w * 0.5, y, s * 1.6, crownOf(EDRIC(), true), t); fig(g, w * 0.38, y + 6, s * 1.2, ALDRIC(), t); fig(g, w * 0.62, y + 6, s * 1.2, THERON(), t); ['dwarf', 'highelf', 'halfling', 'human', 'woodelf', 'gnome'].forEach((r, i) => fig(g, w * (0.1 + i * 0.15) + (i > 2 ? w * 0.06 : 0), h * 0.8, s * 0.95, folk(r, i), t)); } },
    { title: 'The Midwinter Feast', music: 'epic', text: 'At the midwinter feast the old king rose to toast his sons. He drank... and the cup fell from his hand.',
      draw(g, w, h, t, s, st) { hall(g, w, h, t); const ty = h * 0.66; // long table
        fig(g, w * 0.5, ty - 4, s * 1.5, crownOf(EDRIC(), true), t, { atk: st < 3 ? Math.min(0.5, st / 3) : 0 }); fig(g, w * 0.36, ty - 4, s * 1.25, ALDRIC(), t); fig(g, w * 0.64, ty - 4, s * 1.25, THERON(), t);
        g.fillStyle = '#4a2e1a'; g.fillRect(w * 0.1, ty - 30 * s, w * 0.8, 34 * s); g.fillStyle = '#e8dcc0'; g.fillRect(w * 0.1, ty - 30 * s, w * 0.8, 6 * s); g.fillStyle = '#3a2214'; g.fillRect(w * 0.12, ty + 4 * s, 10, 60); g.fillRect(w * 0.86, ty + 4 * s, 10, 60);
        for (let k = 0; k < 9; k++) { const x = w * (0.15 + k * 0.09); g.fillStyle = '#d8c070'; g.fillRect(x, ty - 46 * s, 6, 16 * s); const f = Math.sin(t * 9 + k) * 2; g.fillStyle = '#ffd070'; g.beginPath(); g.ellipse(x + 3, ty - 50 * s, 3, 6 + f, 0, 0, 6.28); g.fill(); }
        // the cup
        const fall = Math.max(0, st - 3); const cx = w * 0.5 + 40 * s + fall * 30, cy = ty - 60 * s + Math.min(fall, 0.6) * 90 * s; g.save(); g.translate(cx, cy); g.rotate(Math.min(fall * 3, 1.9)); g.fillStyle = '#e0b84a'; g.beginPath(); g.moveTo(-8, -12); g.lineTo(8, -12); g.lineTo(4, 4); g.lineTo(-4, 4); g.fill(); g.fillRect(-1.5, 4, 3, 8); g.fillRect(-6, 11, 12, 3); g.restore();
        if (fall > 0.5) { g.fillStyle = 'rgba(120,10,30,0.8)'; g.beginPath(); g.ellipse(cx + 20, ty - 26 * s, Math.min(60, (fall - 0.5) * 50), 5, 0, 0, 6.28); g.fill(); } } },
    { title: 'Poison', music: 'crypt', text: 'The wine was poisoned. By morning King Edric was dead. Every cook, every servant and every guest was questioned. The poisoner was never found.',
      draw(g, w, h, t, s) { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a080c'); gr.addColorStop(1, '#22161a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        // deathbed by candlelight
        const bx = w * 0.5, by = h * 0.6; g.fillStyle = '#3a2214'; g.fillRect(bx - 180 * s, by - 20 * s, 360 * s, 50 * s); g.fillStyle = '#e8e0d0'; g.fillRect(bx - 170 * s, by - 34 * s, 340 * s, 20 * s); g.fillStyle = '#7a1e1e'; g.fillRect(bx - 60 * s, by - 36 * s, 220 * s, 24 * s);
        fig(g, bx - 40 * s, by - 26 * s, s * 1.5, EDRIC(), t, { dead: true, deadDir: -1 });
        g.save(); g.globalCompositeOperation = 'lighter'; for (const cx of [bx - 230 * s, bx + 230 * s]) { const gl = g.createRadialGradient(cx, by - 80 * s, 2, cx, by - 80 * s, 260 * s); gl.addColorStop(0, 'rgba(255,190,110,0.5)'); gl.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = gl; g.fillRect(cx - 300 * s, by - 380 * s, 600 * s, 600 * s); } g.restore();
        for (const cx of [bx - 230 * s, bx + 230 * s]) { g.fillStyle = '#e8dcc0'; g.fillRect(cx - 5, by - 70 * s, 10, 40 * s); g.fillStyle = '#ffd070'; g.beginPath(); g.ellipse(cx, by - 76 * s, 4, 9 + Math.sin(t * 8 + cx) * 2, 0, 0, 6.28); g.fill(); }
        // a hooded figure slipping away in the dark
        const hx = w * 0.9 - (t % 30) * 4; g.fillStyle = 'rgba(8,6,10,0.9)'; g.beginPath(); g.moveTo(hx - 20, h * 0.72); g.quadraticCurveTo(hx - 24, h * 0.41, hx, h * 0.36); g.quadraticCurveTo(hx + 24, h * 0.41, hx + 20, h * 0.72); g.fill(); g.fillStyle = 'rgba(140,255,140,0.5)'; g.fillRect(hx - 6, h * 0.42, 3, 2); g.fillRect(hx + 3, h * 0.42, 3, 2); } },
    { title: 'Brother Against Brother', music: 'epic', text: 'Grief turned to suspicion. "You poured his wine," Aldric told his brother. "And you have wanted his crown since the day you could walk," Theron answered. Each was certain the other was the murderer.',
      draw(g, w, h, t, s, st) { hall(g, w, h, t, '#3a1010'); g.fillStyle = 'rgba(120,0,0,0.18)'; g.fillRect(0, 0, w, h); const y = h * 0.74;
        fig(g, w * 0.36, y, s * 1.9, ALDRIC(), t, { dir: 2, atk: 0.12 + Math.sin(t * 2) * 0.05 }); fig(g, w * 0.64, y, s * 1.9, THERON(), t, { dir: 1, atk: 0.12 + Math.cos(t * 2) * 0.05 });
        // the crown on the floor between them
        crown(g, w * 0.5, y - 6, s * 0.7, t); } },
    { title: 'The Crown Divided', music: 'epic', text: 'Aldric, the firstborn, claimed the throne by right of birth. He arrested Theron\'s friends, burned the feast-hall records, and raised the taxes on the elven forests to pay for new walls. One night Theron slipped out of the city and rode north-east.',
      draw(g, w, h, t, s, st) { night(g, w, h, t); const x = w * 0.25 + st * w * 0.06; fig(g, x, h * 0.78, s * 1.4, THERON(), t, { dir: 2, walk: true }); fig(g, x - 60 * s, h * 0.79, s * 1.05, folk('halfelf', 1, '#3a3a4a'), t, { dir: 2, walk: true });
        // a crown split in two, hanging over the night
        const cx = w * 0.62, cy = h * 0.32; const gap = Math.min(40, st * 8) * s; g.save(); g.translate(-gap, 0); g.beginPath(); g.rect(0, 0, cx, h); g.clip(); crown(g, cx, cy, s * 1.3, t); g.restore(); g.save(); g.translate(gap, 0); g.beginPath(); g.rect(cx, 0, w, h); g.clip(); crown(g, cx, cy, s * 1.3, t); g.restore(); } },
    { title: 'The Exodus', music: 'forest', text: 'The elves had never loved Aldric. His axes had felled their sacred groves for timber, and his tax collectors took the rest. High elves, wood elves, half-elves and the exiled dark elves, and many human families who feared Aldric\'s purges, followed Theron into the forest.',
      draw(g, w, h, t, s, st) { dawnForest(g, w, h, t); const races = ['highelf', 'woodelf', 'human', 'halfelf', 'darkelf', 'human', 'woodelf', 'highelf', 'halfelf'];
        races.forEach((r, i) => { const x = ((i * 0.12 + st * 0.035) % 1.2 - 0.1) * w, y = h * (0.72 + (i % 2) * 0.05); fig(g, x, y, s * 1.15, folk(r, i), t, { dir: 2, walk: true }); }); } },
    { title: 'Those Who Stayed', music: 'mountain', text: 'The mountain clans had sworn an oath of iron to the firstborn of the Valen line, and a dwarf does not break an oath. Dwarves, gnomes and barbarians stayed with Aldric, and so did the halflings of the plains, who wanted only peace and full granaries.',
      draw(g, w, h, t, s) { KR.Menus.paintCity(g, w, h, 'crown', t); const y = h * 0.74; fig(g, w * 0.5, y - 10, s * 1.7, crownOf(ALDRIC(), true), t);
        ['dwarf', 'gnome', 'barbarian', 'halfling', 'dwarf', 'human'].forEach((r, i) => { const side = i % 2 ? 1 : -1; fig(g, w * 0.5 + side * (0.14 + Math.floor(i / 2) * 0.1) * w, y + 8, s * 1.1, folk(r, i, ['#6a4a2a', '#4a4a5a', '#7a3a2a'][i % 3]), t, { dir: side > 0 ? 1 : 2, sit: true }); }); } },
    { title: 'A Second Crown', music: 'town_sylvan', text: 'Theron would not hide. Under the great trees of Aelindor the elves crowned him king, and he swore two oaths: to build a kingdom greater than his brother\'s, and to find the one who poisoned their father.',
      draw(g, w, h, t, s, st) { KR.Menus.paintCity(g, w, h, 'sylvan', t); const y = h * 0.74; fig(g, w * 0.5, y, s * 1.8, crownOf(THERON(), st > 3), t, { atk: st > 3 ? 0.5 : 0 });
        if (st <= 3) crown(g, w * 0.5, y - 260 * s + Math.min(1, st / 3) * 120 * s, s * 0.8, t); else { g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(w * 0.5, y - 120 * s, 4, w * 0.5, y - 120 * s, 200 * s); gl.addColorStop(0, `rgba(255,230,150,${0.5 * Math.min(1, st - 3)})`); gl.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gl; g.fillRect(0, 0, w, h); g.restore(); }
        ['highelf', 'woodelf', 'halfelf', 'human'].forEach((r, i) => { const side = i % 2 ? 1 : -1; fig(g, w * 0.5 + side * (0.18 + Math.floor(i / 2) * 0.12) * w, y + 6, s * 1.15, folk(r, i), t, { dir: side > 0 ? 1 : 2 }); }); } },
  ];
  const BRANCH = {
    crown: [
      { title: 'Why You Serve Aldric', music: 'town_crown', text: 'The law of the land is older than either brother: the crown passes to the firstborn. Theron ran rather than answer for the poisoned cup, and now he hides behind elven walls, splitting a kingdom your forefathers bled for.',
        draw(g, w, h, t, s) { hall(g, w, h, t, '#28457a'); const y = h * 0.76; throne(g, w * 0.5, y - 10 * s, s); fig(g, w * 0.5, y - 14 * s, s * 1.7, crownOf(ALDRIC(), true), t); fig(g, w * 0.32, y + 10, s * 1.5, Story.heroLook, t, { dir: 2 }); } },
      { title: 'For Valenmoor', music: 'victory', text: '"Theron calls me a tyrant. A tyrant would have let the realm burn. I will hold it together, by the sword if I must. Raise Valenmoor high, hero, and help me bring my brother to justice."  —  King Aldric Valen',
        draw(g, w, h, t, s) { KR.Menus.paintCity(g, w, h, 'crown', t); rays(g, w, h, t); const y = h * 0.74; fig(g, w * 0.42, y, s * 1.7, crownOf(ALDRIC(), true), t, { atk: 0.5 }); fig(g, w * 0.58, y, s * 1.7, Story.heroLook, t, { atk: 0.5 }); } },
    ],
    sylvan: [
      { title: 'Why You Serve Theron', music: 'town_sylvan', text: 'An innocent man does not burn the records of the night his father died. Aldric\'s first acts as king were to silence anyone who asked questions and to tax the forests into ruin. Theron gave the hunted a home, and Aelindor turns no one away.',
        draw(g, w, h, t, s) { KR.Menus.paintCity(g, w, h, 'sylvan', t); const y = h * 0.74; fig(g, w * 0.5, y - 6, s * 1.7, crownOf(THERON(), true), t); fig(g, w * 0.32, y + 6, s * 1.5, Story.heroLook, t, { dir: 2 }); ['woodelf', 'human'].forEach((r, i) => fig(g, w * (0.68 + i * 0.12), y + 6, s * 1.1, folk(r, i + 2), t, { dir: 1 })); } },
      { title: 'For Aelindor', music: 'victory', text: '"My brother says birth makes a king. I say the people do. Build Aelindor into the jewel of this land, hero, and together we will find Father\'s killer and free the realm from a tyrant."  —  King Theron Valen',
        draw(g, w, h, t, s) { KR.Menus.paintCity(g, w, h, 'sylvan', t); rays(g, w, h, t); const y = h * 0.74; fig(g, w * 0.42, y, s * 1.7, crownOf(THERON(), true), t, { atk: 0.5 }); fig(g, w * 0.58, y, s * 1.7, Story.heroLook, t, { atk: 0.5 }); } },
    ],
  };
  function crown(g, x, y, sc, t) { g.save(); g.translate(x, y); g.scale(sc, sc); const gl = g.createRadialGradient(0, -20, 2, 0, -20, 80); gl.addColorStop(0, 'rgba(255,220,120,0.45)'); gl.addColorStop(1, 'rgba(255,200,90,0)'); g.fillStyle = gl; g.fillRect(-90, -100, 180, 160); const cg = g.createLinearGradient(0, -50, 0, 10); cg.addColorStop(0, '#fff0b0'); cg.addColorStop(0.5, '#e8b040'); cg.addColorStop(1, '#8a5a10'); g.fillStyle = cg; g.beginPath(); g.moveTo(-40, 10); g.lineTo(-45, -32); g.lineTo(-24, -10); g.lineTo(-12, -42); g.lineTo(0, -14); g.lineTo(12, -42); g.lineTo(24, -10); g.lineTo(45, -32); g.lineTo(40, 10); g.closePath(); g.fill(); [['#d83a3a', -24], ['#3a8ad8', 0], ['#3ad86a', 24]].forEach(([c, xx]) => { g.fillStyle = c; g.beginPath(); g.arc(xx, 2, 4, 0, 6.28); g.fill(); }); g.restore(); }
  function throne(g, x, y, s) { g.fillStyle = '#5a3a1a'; g.fillRect(x - 50 * s, y - 150 * s, 100 * s, 150 * s); g.fillStyle = '#7a1e1e'; g.fillRect(x - 38 * s, y - 130 * s, 76 * s, 110 * s); g.fillStyle = '#e0b84a'; g.beginPath(); g.arc(x, y - 150 * s, 16 * s, Math.PI, 0); g.fill(); g.fillStyle = '#3a2a1a'; g.fillRect(x - 80 * s, y, 160 * s, 14 * s); }
  function rays(g, w, h, t) { g.save(); g.translate(w / 2, h * 0.7); g.rotate(t * 0.1); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.fillStyle = 'rgba(255,220,140,0.07)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.max(w, h), -50); g.lineTo(Math.max(w, h), 50); g.fill(); } g.restore(); }

  // ---------------------------------------------------------------- the player
  Story.play = function (c, done) {
    if (document.querySelector('.story')) return;
    const scenes = SHARED.concat(BRANCH[c.faction] || BRANCH.crown);
    Story.heroLook = Object.assign(S.classLook(c.cls, null), { race: c.race, gender: c.gender, skin: S.skinOf(c.race, c.skin), hair: S.HAIRS[c.hair], hairStyle: c.hairStyle, cls: c.cls });
    const ov = document.createElement('div'); ov.className = 'story';
    ov.innerHTML = `<canvas></canvas><div class="st-cap"><div class="st-k"></div><h2 class="st-t"></h2><p class="st-b"></p></div><div class="st-nav"><span class="st-dots"></span><button class="btn small ghost st-next">Next ›</button><button class="btn small ghost st-skip">Skip story</button></div>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector('canvas'), g = cv.getContext('2d'); const cap = ov.querySelector('.st-cap');
    let idx = -1, start = 0, alive = true; const t0 = performance.now(); const DUR = 10.5;
    const show = (i) => {
      idx = i; start = (performance.now() - t0) / 1000; const sc = scenes[i];
      cap.classList.remove('in'); void cap.offsetWidth; cap.classList.add('in');
      ov.querySelector('.st-k').textContent = i < SHARED.length ? `Chapter ${i + 1}` : `Your path · ${D.FACTIONS[c.faction].city}`;
      ov.querySelector('.st-t').textContent = sc.title; ov.querySelector('.st-b').textContent = sc.text;
      ov.querySelector('.st-dots').innerHTML = scenes.map((_, k) => `<i class="${k === i ? 'on' : k >= SHARED.length ? 'br' : ''}"></i>`).join('');
      ov.querySelector('.st-next').textContent = i === scenes.length - 1 ? 'Begin ›' : 'Next ›';
      try { KR.A.init(); if (sc.music) KR.A.play(sc.music); } catch (e) {}
    };
    const finish = () => { if (!alive) return; alive = false; removeEventListener('keydown', key); ov.classList.add('out'); setTimeout(() => ov.remove(), 600); done(); };
    const next = () => { if (idx < scenes.length - 1) show(idx + 1); else finish(); };
    const key = (e) => { if (e.key === 'Escape') finish(); else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); } };
    addEventListener('keydown', key);
    ov.querySelector('.st-skip').onclick = (e) => { e.stopPropagation(); finish(); }; ov.querySelector('.st-next').onclick = (e) => { e.stopPropagation(); next(); }; cv.onclick = next;
    show(0);
    const loop = () => {
      if (!alive) return; const t = (performance.now() - t0) / 1000, st = t - start;
      const W2 = cv.width = innerWidth, H2 = cv.height = innerHeight; const s = Math.min(W2 / 1100, H2 / 700) * 2.1;
      if (st > DUR + scenes[idx].text.length * 0.012) { next(); if (!alive) return; }
      g.save(); const z = 1 + st * 0.012; g.translate(W2 / 2, H2 / 2); g.scale(z, z); g.translate(-W2 / 2, -H2 / 2); // slow push in
      try { scenes[idx].draw(g, W2, H2, t, s, st); } catch (e) { console.warn(e); }
      g.restore();
      const vg = g.createRadialGradient(W2 / 2, H2 / 2, H2 * 0.3, W2 / 2, H2 / 2, H2 * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)'); g.fillStyle = vg; g.fillRect(0, 0, W2, H2);
      const fade = Math.min(1, st / 0.9); g.fillStyle = `rgba(0,0,0,${1 - fade})`; g.fillRect(0, 0, W2, H2);
      const bar = H2 * 0.09; g.fillStyle = '#000'; g.fillRect(0, 0, W2, bar); g.fillRect(0, H2 - bar, W2, bar);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };
})();

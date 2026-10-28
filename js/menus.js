// Kingdom Rising — intro history, main menu, character select and creation
(function () {
  const KR = (window.KR = window.KR || {});
  const D = KR.D, U = KR.U, S = KR.S, Sys = KR.Sys, G = KR.G;
  const M = (KR.Menus = {});
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------------- vignette painter (shared by intro + menu background) ----------------
  function sky(g, w, h, top, bot) { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  function stars(g, w, h, t, n = 80) { for (let i = 0; i < n; i++) { const x = (U.hash(i, 1) * w), y = U.hash(i, 2) * h * 0.55; g.fillStyle = `rgba(255,255,240,${0.3 + 0.5 * Math.abs(Math.sin(t * 0.8 + i))})`; g.fillRect(x, y, 1.5, 1.5); } }
  function hills(g, w, h, y0, amp, col, seed, t, par = 0) { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 8) { const xx = x + t * par; g.lineTo(x, y0 + Math.sin(xx * 0.006 + seed) * amp + Math.sin(xx * 0.017 + seed * 2) * amp * 0.4); } g.lineTo(w, h); g.closePath(); g.fill(); }
  M.paintCity = function (g, w, h, which, t) {
    const pan = t * 6;
    if (which === 'sylvan') {
      sky(g, w, h, '#16324a', '#5f8a7a'); stars(g, w, h, t, 60);
      g.fillStyle = 'rgba(255,250,220,0.9)'; g.beginPath(); g.arc(w * 0.78, h * 0.2, 34, 0, 6.28); g.fill();
      hills(g, w, h, h * 0.62, 26, '#1f3f36', 1, t, 4);
      // giant trees and spires
      for (let i = 0; i < 7; i++) {
        const x = ((i * 220 - pan * 0.6) % (w + 300) + w + 300) % (w + 300) - 150, base = h * 0.78, th = h * (0.45 + U.hash(i, 9) * 0.2);
        g.fillStyle = '#2a2a24'; g.fillRect(x - 14, base - th, 28, th);
        for (let k = 0; k < 5; k++) { g.fillStyle = ['#1f4a33', '#2b6141', '#3d7d4f'][k % 3]; g.beginPath(); g.arc(x + Math.sin(k * 2 + i) * 40, base - th + k * 18 - 10, 70 - k * 8, 0, 6.28); g.fill(); }
      }
      // elven spires with lights
      for (let i = 0; i < 4; i++) { const x = w * (0.2 + i * 0.2), y = h * 0.7; g.fillStyle = '#d8d0b0'; g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x, y - 140 - i * 20); g.lineTo(x + 12, y); g.fill(); g.fillStyle = '#4f8a4a'; g.beginPath(); g.arc(x, y - 60, 18, Math.PI, 0); g.fill(); g.fillStyle = `rgba(255,230,150,${0.6 + Math.sin(t * 2 + i) * 0.3})`; g.fillRect(x - 3, y - 90 - i * 10, 6, 10); }
      hills(g, w, h, h * 0.82, 14, '#16302a', 4, t, 10);
      for (let i = 0; i < 40; i++) { const x = (U.hash(i, 5) * w + Math.sin(t + i) * 20), y = h * 0.6 + U.hash(i, 6) * h * 0.35 + Math.cos(t * 0.7 + i) * 10; g.fillStyle = `rgba(220,255,140,${0.4 + 0.5 * Math.sin(t * 3 + i)})`; g.beginPath(); g.arc(x, y, 2, 0, 6.28); g.fill(); }
    } else if (which === 'iron') {
      sky(g, w, h, '#2a2230', '#8a5a3a'); stars(g, w, h, t, 40);
      g.fillStyle = '#3a3438'; g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.12, h * 0.4); g.lineTo(w * 0.3, h * 0.55); g.lineTo(w * 0.5, h * 0.12); g.lineTo(w * 0.7, h * 0.5); g.lineTo(w * 0.88, h * 0.3); g.lineTo(w, h * 0.6); g.lineTo(w, h); g.fill();
      g.fillStyle = '#eef'; g.beginPath(); g.moveTo(w * 0.45, h * 0.2); g.lineTo(w * 0.5, h * 0.12); g.lineTo(w * 0.55, h * 0.2); g.fill();
      // great gate carved into mountain
      const gx = w * 0.5, gy = h * 0.82;
      g.fillStyle = '#5a5250'; g.fillRect(gx - 150, gy - 220, 300, 220);
      g.fillStyle = '#4a4442'; for (let k = 0; k < 6; k++) g.fillRect(gx - 150 + k * 50, gy - 240, 30, 20);
      g.fillStyle = '#1a1210'; g.beginPath(); g.moveTo(gx - 60, gy); g.lineTo(gx - 60, gy - 110); g.arc(gx, gy - 110, 60, Math.PI, 0); g.lineTo(gx + 60, gy); g.fill();
      const glow = 0.5 + Math.sin(t * 3) * 0.2; const gr = g.createRadialGradient(gx, gy - 60, 10, gx, gy - 60, 120); gr.addColorStop(0, `rgba(255,140,40,${glow})`); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gr; g.fillRect(gx - 130, gy - 190, 260, 190);
      // statues
      for (const s of [-1, 1]) { const sx = gx + s * 110; g.fillStyle = '#6a625e'; g.fillRect(sx - 18, gy - 160, 36, 160); g.beginPath(); g.arc(sx, gy - 170, 18, 0, 6.28); g.fill(); g.fillStyle = '#7a726c'; g.beginPath(); g.moveTo(sx - 18, gy - 150); g.quadraticCurveTo(sx, gy - 100, sx + 18, gy - 150); g.fill(); }
      // smoke + embers
      for (let k = 0; k < 12; k++) { const ph = (t * 0.15 + k / 12) % 1; g.fillStyle = `rgba(80,70,70,${0.4 * (1 - ph)})`; g.beginPath(); g.arc(w * 0.7 + Math.sin(ph * 5 + k) * 30, h * 0.5 - ph * h * 0.4, 20 + ph * 40, 0, 6.28); g.fill(); }
      for (let k = 0; k < 30; k++) { const ph = (t * 0.3 + k / 30) % 1; g.fillStyle = `rgba(255,170,60,${1 - ph})`; g.fillRect(gx + Math.sin(k * 7 + t) * 80, gy - 40 - ph * 260, 2, 2); }
    } else {
      sky(g, w, h, '#3a4a7a', '#f0a868');
      g.fillStyle = 'rgba(255,220,150,0.95)'; g.beginPath(); g.arc(w * 0.25, h * 0.55, 46, 0, 6.28); g.fill();
      hills(g, w, h, h * 0.6, 18, '#6a7a4a', 3, t, 3);
      // castle
      const cx = w * 0.62, cy = h * 0.66;
      g.fillStyle = '#c8bca4'; g.fillRect(cx - 160, cy - 90, 320, 90);
      for (const tx of [-160, -60, 60, 140]) { g.fillRect(cx + tx, cy - 170, 30, 170); g.fillStyle = '#b0483a'; g.beginPath(); g.moveTo(cx + tx - 6, cy - 170); g.lineTo(cx + tx + 15, cy - 215); g.lineTo(cx + tx + 36, cy - 170); g.fill(); g.fillStyle = '#c8bca4'; }
      g.fillRect(cx - 30, cy - 200, 60, 200); g.fillStyle = '#b0483a'; g.beginPath(); g.moveTo(cx - 38, cy - 200); g.lineTo(cx, cy - 260); g.lineTo(cx + 38, cy - 200); g.fill();
      for (let k = 0; k < 3; k++) { const fx = cx - 100 + k * 100; g.fillStyle = '#5a4a3a'; g.fillRect(fx, cy - 250 + (k === 1 ? -20 : 40), 2, 40); g.fillStyle = '#28457a'; g.beginPath(); g.moveTo(fx + 2, cy - 250 + (k === 1 ? -20 : 40)); g.quadraticCurveTo(fx + 20, cy - 245 + Math.sin(t * 4 + k) * 4 + (k === 1 ? -20 : 40), fx + 34, cy - 238 + (k === 1 ? -20 : 40)); g.lineTo(fx + 2, cy - 230 + (k === 1 ? -20 : 40)); g.fill(); }
      g.fillStyle = '#2a1e16'; g.beginPath(); g.moveTo(cx - 22, cy); g.lineTo(cx - 22, cy - 40); g.arc(cx, cy - 40, 22, Math.PI, 0); g.lineTo(cx + 22, cy); g.fill();
      for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(255,220,140,${0.6 + Math.sin(t * 2 + k) * 0.3})`; g.fillRect(cx - 140 + k * 50, cy - 60, 8, 12); }
      // wheat fields
      hills(g, w, h, h * 0.78, 10, '#c8a84a', 6, t, 8);
      g.strokeStyle = 'rgba(120,90,30,0.5)'; for (let k = 0; k < 80; k++) { const x = (k * 23 + t * 8) % w, y = h * 0.8 + (k % 5) * 18; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(t * 2 + k) * 3, y - 14); g.stroke(); }
    }
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.9); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
  };

  // ---------------- intro ----------------
  const INTRO = [
    { city: 'crown', text: 'For forty years King Edric Valen ruled one kingdom, from the western plains to the old elven forests, and the land knew peace.' },
    { city: 'crown', title: 'The Old King Dies', sub: 'A feast, a cup, a poisoner never found', text: 'At the midwinter feast the old king drank from his cup and fell. The wine was poisoned. The poisoner was never found, and each of his sons, Aldric and Theron, swore the other had done it.' },
    { city: 'crown', title: 'Valenmoor', sub: 'Crown of Valen · Humans, Dwarves, Gnomes, Halflings and Barbarians', text: 'Aldric, the firstborn, claimed the crown by right of birth and kept the old capital. The mountain clans and the halflings of the plains knelt to him.' },
    { city: 'sylvan', title: 'Aelindor', sub: 'Sylvan Throne · Humans, High Elves, Wood Elves, Half Elves and Dark Elves', text: 'Theron, the younger, would not kneel. He rode to the elven city of Aelindor, and the elves, who never loved his brother, crowned him there. Many human families fled after him.' },
    { city: 'sylvan', text: 'The kingdom split in two. Each brother calls the other a tyrant, and each swears the whole land is his by right.' },
    { city: 'crown', title: 'Kingdom Rising', text: 'Choose your king. Gather timber and stone, slay the beasts that haunt the land, build your kingdom, and crush your king\'s brother.' },
  ];
  let introRaf = 0;
  M.playIntro = function (done) {
    const scr = $('#screen'); scr.innerHTML = `<canvas id="intro-cv"></canvas><div class="intro-txt"><div class="it-title"></div><div class="it-sub"></div><p class="it-body"></p></div><div class="intro-nav"><span class="it-dots"></span><button class="btn ghost" id="it-skip">Skip</button></div>`;
    const cv = $('#intro-cv'), g = cv.getContext('2d');
    let idx = -1, t0 = performance.now(), sceneStart = 0;
    const DUR = 7.5;
    const fit = () => { cv.width = innerWidth; cv.height = innerHeight; };
    fit(); addEventListener('resize', fit);
    const show = (i) => {
      idx = i; sceneStart = (performance.now() - t0) / 1000;
      const s = INTRO[i];
      const box = $('.intro-txt'); box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
      $('.it-title').textContent = s.title || ''; $('.it-sub').textContent = s.sub || ''; $('.it-body').textContent = s.text;
      $('.it-dots').innerHTML = INTRO.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
    };
    const finish = () => { cancelAnimationFrame(introRaf); removeEventListener('resize', fit); removeEventListener('keydown', key); try { localStorage.setItem('kr_intro_seen', '1'); } catch (e) {} done(); };
    const key = (e) => { if (e.key === 'Escape') finish(); else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { if (idx < INTRO.length - 1) show(idx + 1); else finish(); } };
    addEventListener('keydown', key);
    $('#it-skip').onclick = finish;
    cv.onclick = () => { if (idx < INTRO.length - 1) show(idx + 1); else finish(); };
    show(0);
    const loop = () => {
      if (!cv.isConnected) { removeEventListener('resize', fit); removeEventListener('keydown', key); return; }
      const t = (performance.now() - t0) / 1000; const st = t - sceneStart;
      if (st > DUR) { if (idx < INTRO.length - 1) show(idx + 1); else return finish(); }
      M.paintCity(g, cv.width, cv.height, INTRO[idx].city, t);
      const fade = Math.min(1, st / 0.8, (DUR - st) / 0.8); g.fillStyle = `rgba(0,0,0,${1 - Math.max(0, fade)})`; g.fillRect(0, 0, cv.width, cv.height);
      introRaf = requestAnimationFrame(loop);
    };
    loop();
  };

  // ---------------- main menu / character select ----------------
  let bgRaf = 0;
  function bgLoop(cv) {
    cancelAnimationFrame(bgRaf);
    if (window.KR3D) return; // in 3D the real world flies by behind the menus (kingdom-rising-3d/js3d/menu3d.js)
    const g = cv.getContext('2d'); const t0 = performance.now(); const order = ['sylvan', 'crown', 'iron'];
    const fit = () => { cv.width = innerWidth; cv.height = innerHeight; }; fit(); addEventListener('resize', fit);
    const loop = () => { if (!cv.isConnected) { removeEventListener('resize', fit); return; } const t = (performance.now() - t0) / 1000; const i = Math.floor(t / 12) % 3; M.paintCity(g, cv.width, cv.height, order[i], t); const st = t % 12; const f = Math.min(1, st / 1, (12 - st) / 1); g.fillStyle = `rgba(0,0,0,${0.35 + 0.65 * (1 - f)})`; g.fillRect(0, 0, cv.width, cv.height); bgRaf = requestAnimationFrame(loop); };
    loop();
  }
  // ---------------- main menu: a city rising from hamlet to capital ----------------
  const RISE = (() => { // deterministic city layout, built in five tiers
    const B = []; let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const add = (tier, x, w, hgt, kind, depth) => B.push({ tier, x, w, h: hgt, kind, depth, delay: r() * 0.7, roof: ['#8a3a2a', '#3a5a8a', '#4a6a3a', '#7a5a2a', '#5a3a6a'][Math.floor(r() * 5)], seed: r() });
    for (let i = 0; i < 9; i++) add(0, (r() - 0.5) * 0.22, 0.03 + r() * 0.012, 0.035 + r() * 0.015, 'hut', 2 + r());
    for (let i = 0; i < 16; i++) add(1, (r() - 0.5) * 0.42, 0.032 + r() * 0.02, 0.05 + r() * 0.03, 'house', 1 + r() * 2);
    add(2, -0.33, 0.04, 0.13, 'tower', 0.5); add(2, 0.33, 0.04, 0.13, 'tower', 0.5); add(2, 0, 0.66, 0.055, 'wall', 0.4);
    for (let i = 0; i < 14; i++) add(2, (r() - 0.5) * 0.5, 0.035 + r() * 0.02, 0.07 + r() * 0.04, 'house', 1.2 + r() * 1.5);
    for (let i = 0; i < 10; i++) add(3, (r() - 0.5) * 0.46, 0.04 + r() * 0.02, 0.1 + r() * 0.06, 'stone', 1.4 + r());
    add(3, -0.14, 0.05, 0.2, 'tower', 1.3); add(3, 0.15, 0.05, 0.18, 'tower', 1.3); add(3, 0.07, 0.06, 0.16, 'temple', 1.5);
    add(4, 0, 0.13, 0.22, 'keep', 1.9); add(4, -0.055, 0.035, 0.32, 'spire', 2.0); add(4, 0.055, 0.035, 0.3, 'spire', 2.0); add(4, 0, 0.04, 0.4, 'spire', 2.1);
    add(4, -0.45, 0.045, 0.16, 'tower', 0.3); add(4, 0.45, 0.045, 0.16, 'tower', 0.3); add(4, 0, 0.92, 0.07, 'wall', 0.2);
    return B.sort((a, b) => b.depth - a.depth);
  })();
  const TIER_NAMES = ['Hamlet', 'Village', 'Town', 'City', 'Kingdom', 'Capital'];
  M.paintRising = function (g, w, h, t) {
    const CYCLE = 40, k = t % CYCLE; const L = Math.min(5, (k / 30) * 5.3);
    const night = 0.55 + 0.45 * Math.sin(t * 0.05);
    sky(g, w, h, `rgb(${Math.round(18 + 30 * (1 - night))},${Math.round(16 + 26 * (1 - night))},${Math.round(40 + 40 * (1 - night))})`, `rgb(${Math.round(150 - 60 * night)},${Math.round(90 - 40 * night)},${Math.round(70 - 20 * night)})`);
    stars(g, w, h, t, 120);
    // moon and drifting clouds
    g.fillStyle = 'rgba(255,245,215,0.9)'; g.beginPath(); g.arc(w * 0.8, h * 0.17, Math.min(w, h) * 0.045, 0, 6.28); g.fill();
    for (let i = 0; i < 6; i++) { const cx = ((i * 0.23 + t * 0.006 * (1 + i * 0.2)) % 1.3 - 0.15) * w, cy = h * (0.12 + i * 0.05); g.fillStyle = 'rgba(40,30,50,0.35)'; for (let j = 0; j < 4; j++) { g.beginPath(); g.ellipse(cx + j * 40, cy + (j % 2) * 6, 70, 18, 0, 0, 6.28); g.fill(); } }
    hills(g, w, h, h * 0.62, 30, '#2a2236', 3, t, 0); hills(g, w, h, h * 0.7, 22, '#211a2a', 9, t, 0);
    // the hill the city grows on
    const cx = w / 2, base = h * 0.82, S2 = Math.min(w * 0.95, h * 1.6);
    g.fillStyle = '#1a1520'; g.beginPath(); g.moveTo(0, h); g.lineTo(0, base + 40); g.quadraticCurveTo(cx, base - S2 * 0.06, w, base + 40); g.lineTo(w, h); g.fill();
    // golden glow grows with the city
    const glow = g.createRadialGradient(cx, base - S2 * 0.12, 10, cx, base - S2 * 0.12, S2 * 0.6); glow.addColorStop(0, `rgba(255,190,90,${0.06 + 0.07 * L})`); glow.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = glow; g.fillRect(0, 0, w, h);
    if (L >= 4.9) { g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.16 + Math.sin(t * 0.3 + i) * 0.03; g.fillStyle = `rgba(255,215,140,${0.05})`; g.beginPath(); g.moveTo(cx, base - S2 * 0.3); g.lineTo(cx + Math.cos(a - 0.04) * h, base - S2 * 0.3 + Math.sin(a - 0.04) * h); g.lineTo(cx + Math.cos(a + 0.04) * h, base - S2 * 0.3 + Math.sin(a + 0.04) * h); g.fill(); } g.restore(); }
    for (const b of RISE) {
      const gr = Math.max(0, Math.min(1, (L - b.tier - b.delay) * 1.6)); if (gr <= 0) continue;
      const e = 1 - Math.pow(1 - gr, 3); const bx = cx + b.x * S2, bw = b.w * S2, bh = b.h * S2 * e, by = base - S2 * 0.03 * (1 - Math.abs(b.x) * 1.6) + (b.depth - 1) * 6;
      const shade = 0.75 + 0.25 * (1 - b.depth / 2.5);
      const stone = b.kind === 'hut' ? `rgb(${Math.round(110 * shade)},${Math.round(80 * shade)},${Math.round(55 * shade)})` : b.kind === 'house' ? `rgb(${Math.round(150 * shade)},${Math.round(125 * shade)},${Math.round(95 * shade)})` : `rgb(${Math.round(120 * shade)},${Math.round(112 * shade)},${Math.round(104 * shade)})`;
      g.fillStyle = stone;
      if (b.kind === 'wall') { g.fillRect(bx - bw / 2, by - bh, bw, bh); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = bx - bw / 2; x < bx + bw / 2; x += 14) g.fillRect(x, by - bh - 6 * e, 8, 6 * e); g.fillStyle = stone; for (let x = bx - bw / 2; x < bx + bw / 2; x += 14) g.fillRect(x, by - bh - 6 * e, 8, 6 * e); g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(bx, by, bh * 0.45, Math.PI, 0); g.fill(); continue; }
      g.fillRect(bx - bw / 2, by - bh, bw, bh);
      // roofs
      if (b.kind === 'hut' || b.kind === 'house') { g.fillStyle = b.kind === 'hut' ? '#6a5a3a' : b.roof; g.beginPath(); g.moveTo(bx - bw * 0.62, by - bh); g.lineTo(bx, by - bh - bw * 0.55 * e); g.lineTo(bx + bw * 0.62, by - bh); g.fill(); }
      else if (b.kind === 'tower' || b.kind === 'stone') { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(bx - bw / 2, by - bh, bw * 0.18, bh); if (b.kind === 'tower') { g.fillStyle = b.roof; g.beginPath(); g.moveTo(bx - bw * 0.65, by - bh); g.lineTo(bx, by - bh - bw * 1.3 * e); g.lineTo(bx + bw * 0.65, by - bh); g.fill(); } else { g.fillStyle = stone; for (let x = bx - bw / 2; x < bx + bw / 2 - 2; x += bw / 4) g.fillRect(x, by - bh - 5 * e, bw / 8, 5 * e); } }
      else if (b.kind === 'temple') { g.fillStyle = '#c8b890'; g.beginPath(); g.arc(bx, by - bh, bw * 0.45 * e, Math.PI, 0); g.fill(); }
      else if (b.kind === 'keep') { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(bx - bw / 2, by - bh, bw * 0.15, bh); g.fillStyle = stone; for (let x = bx - bw / 2; x < bx + bw / 2 - 4; x += bw / 7) g.fillRect(x, by - bh - 8 * e, bw / 14, 8 * e); g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(bx, by, bw * 0.16, Math.PI, 0); g.fill(); }
      else if (b.kind === 'spire') { g.fillStyle = '#3a4a7a'; g.beginPath(); g.moveTo(bx - bw * 0.7, by - bh); g.lineTo(bx, by - bh - bw * 2.2 * e); g.lineTo(bx + bw * 0.7, by - bh); g.fill(); if (gr >= 1) { const fy = by - bh - bw * 2.2; g.strokeStyle = '#ccc'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, fy); g.lineTo(bx, fy - 18); g.stroke(); g.fillStyle = '#c8282a'; g.beginPath(); g.moveTo(bx, fy - 18); for (let q = 0; q <= 6; q++) g.lineTo(bx + q * 4, fy - 18 + Math.sin(t * 5 + q * 0.8 + b.seed * 6) * 2 + q * 0.2); g.lineTo(bx + 24, fy - 10); for (let q = 6; q >= 0; q--) g.lineTo(bx + q * 4, fy - 10 + Math.sin(t * 5 + q * 0.8 + b.seed * 6) * 2); g.fill(); } }
      // lit windows
      if (gr >= 1 && b.kind !== 'hut') { const rows = Math.max(1, Math.floor(bh / 18)), cols = Math.max(1, Math.floor(bw / 12)); for (let ry = 0; ry < rows; ry++) for (let cxw = 0; cxw < cols; cxw++) { const hsh = U.hash(Math.round(b.seed * 1000) + cxw, ry); if (hsh < 0.45) continue; const fl = 0.6 + 0.4 * Math.sin(t * 2 + hsh * 20); g.fillStyle = `rgba(255,${Math.round(190 + 40 * hsh)},110,${night * fl})`; g.fillRect(bx - bw / 2 + 4 + cxw * (bw - 8) / cols, by - bh + 8 + ry * 18, 3, 5); } }
      if (gr >= 1 && (b.kind === 'house' || b.kind === 'hut') && b.seed < 0.35) for (let q = 0; q < 3; q++) { const ph = (t * 0.25 + q / 3 + b.seed) % 1; g.fillStyle = `rgba(200,200,210,${0.25 * (1 - ph)})`; g.beginPath(); g.arc(bx + bw * 0.25 + ph * 12, by - bh - bw * 0.5 - ph * 40, 3 + ph * 7, 0, 6.28); g.fill(); }
      if (gr > 0 && gr < 1) for (let q = 0; q < 4; q++) { g.fillStyle = `rgba(180,150,110,${0.35 * (1 - gr)})`; g.beginPath(); g.arc(bx + (q - 1.5) * bw * 0.35, by - 2 - gr * 10, 4 + gr * 8, 0, 6.28); g.fill(); }
    }
    // tier label
    const ti = Math.min(5, Math.floor(L)); g.textAlign = 'center'; g.font = `600 ${Math.round(Math.min(26, w / 40))}px Cinzel, Georgia, serif`; g.fillStyle = 'rgba(255,224,160,0.85)'; g.fillText(TIER_NAMES[ti], cx, h - 26);
    for (let i = 0; i < 5; i++) { g.fillStyle = i < Math.floor(L) ? '#ffd27a' : 'rgba(255,224,160,0.25)'; g.beginPath(); g.arc(cx - 40 + i * 20, h - 12, 4, 0, 6.28); g.fill(); }
    // fade out and in around the loop
    const fade = k < 1.5 ? 1 - k / 1.5 : k > CYCLE - 1.5 ? (k - (CYCLE - 1.5)) / 1.5 : 0; if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, w, h); }
    const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
  };
  let riseRaf = 0;
  function riseLoop(cv) {
    cancelAnimationFrame(riseRaf); cancelAnimationFrame(bgRaf);
    if (window.KR3D) return;
    const g = cv.getContext('2d'); const t0 = performance.now();
    const fit = () => { cv.width = innerWidth; cv.height = innerHeight; }; fit(); addEventListener('resize', fit);
    const loop = () => { if (!cv.isConnected) { removeEventListener('resize', fit); return; } M.paintRising(g, cv.width, cv.height, (performance.now() - t0) / 1000); riseRaf = requestAnimationFrame(loop); };
    loop();
  }
  const LSg = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const LSs = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  // an invite link (?join=code) opens straight onto the Multiplayer screen
  const INVITED = !!new URLSearchParams(location.search).get('join');
  let mmTab = INVITED ? 'online' : 'heroes', heroDir = 0, inviteFailed = false;
  // in 3D a hero looks exactly like what it wears: nothing from the class picture is added
  const lookOf = (ch) => Object.assign(window.KR3D && ch.look ? {} : S.classLook(ch.cls, null), ch.look || {}, ch.app || {}, { race: ch.race, gender: ch.gender, skin: S.skinOf(ch.race, ch.skin), hair: S.HAIRS[ch.hair], hairStyle: ch.hairStyle, cls: ch.cls });
  // 3D: a still render of a hero drawn into a small card canvas (falls back to the 2D figure)
  const snap3 = (cv, look) => { if (!(window.KR3D && KR.heroSnap)) return false; try { const img = new Image(); img.onload = () => { const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height); }; img.src = KR.heroSnap(look, cv.width, cv.height); return true; } catch (e) { console.warn(e); return false; } };
  // a hero dressed the way the game will dress them (each class comes home in its own clothes)
  const previewLook = (o) => {
    try { const c = Sys.newChar({ name: 'Preview', faction: o.faction || null, race: o.race, cls: o.cls, gender: o.gender || 'm', skin: o.skin || 0, hair: o.hair || 0, hairStyle: o.hairStyle || 0, app: o.app || null }); return G.lookFor(c); }
    catch (e) { console.warn(e); return Object.assign(S.classLook(o.cls, null), { race: o.race, gender: o.gender, skin: S.skinOf(o.race, o.skin || 0), hair: S.HAIRS[o.hair || 0], hairStyle: o.hairStyle || 0, cls: o.cls }); }
  };
  // each race is shown in a class that suits it, so the race cards do not all look alike
  const RACE_SHOWCASE = { human: 'warrior', highelf: 'wizard', woodelf: 'ranger', darkelf: 'necromancer', gnome: 'enchanter', halfling: 'rogue', dwarf: 'cleric', barbarian: 'berserker', ogrin: 'shaman' };
  // a still of a class's scene behind a small card figure (the figure canvas itself stays transparent)
  const clsBackCache = {};
  const clsBack = (cv, cls) => {
    if (!KR.ClassBG) return;
    const key = cls + ':' + cv.width + 'x' + cv.height;
    if (!clsBackCache[key]) { const o = document.createElement('canvas'); o.width = cv.width * 2; o.height = cv.height * 2; KR.ClassBG.paint(o.getContext('2d'), o.width, o.height, cls, 2.5); clsBackCache[key] = o.toDataURL(); }
    cv.style.background = `url(${clsBackCache[key]}) center / cover`;
  };
  // a class's living scene on a canvas (full screen in creation, the frame behind a hero in Choose Hero)
  let clsRaf = 0;
  function classBgLoop(cv, clsOf, fitTo) {
    if (!fitTo) { cancelAnimationFrame(clsRaf); cancelAnimationFrame(bgRaf); cancelAnimationFrame(riseRaf); }
    const g = cv.getContext('2d'); const t0 = performance.now(); let last = 0; if (!fitTo) cv.classList.add('cls-on');
    const loop = () => {
      if (!cv.isConnected) return;
      // a soft backdrop: drawn at reduced resolution (the browser scales it up) and at most 30 times a second
      const now = performance.now(); if (now - last < 32) { const id = requestAnimationFrame(loop); if (!fitTo) clsRaf = id; return; } last = now;
      const k = fitTo ? Math.min(1.5, devicePixelRatio || 1) : 0.6; const box = fitTo ? fitTo() : { w: innerWidth, h: innerHeight };
      const W = Math.max(1, Math.round(box.w * k)), H = Math.max(1, Math.round(box.h * k)); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const cls = clsOf(); if (cls) KR.ClassBG.paint(g, W, H, cls, (now - t0) / 1000); else { g.fillStyle = '#0b0a0f'; g.fillRect(0, 0, W, H); }
      const id = requestAnimationFrame(loop); if (!fitTo) clsRaf = id;
    };
    loop();
  }
  const ago = (ts) => { if (!ts) return 'never'; const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  M.showMenu = function (tab) {
    const scr = $('#screen'); scr.hidden = false; $('#ui').hidden = true; if (tab) mmTab = tab;
    KR.A.play('menu');
    const a = G.account; const chars = a.chars.slice().sort((x, y) => (y.updated || 0) - (x.updated || 0));
    let sel = LSg('kr_sel_hero', null); if (!chars.some((c) => c.id === sel)) sel = chars[0] ? chars[0].id : null;
    if (!chars.length && mmTab === 'online') mmTab = 'heroes';
    if (mmTab === 'quit' || mmTab === 'create' || mmTab === 'new') mmTab = 'heroes';
    // the title menu: Continue first, then a few clear choices (How to Play, History and Delete live under Settings)
    const tabs = [['heroes', '🛡', 'Heroes'], ['new', '✚', 'New Hero'], ['online', '⚔', 'Multiplayer'], ['options', '⚙', 'Settings'], ['quit', '⏻', 'Quit']];
    const under = { guide: 'options', history: 'options', delete: 'options' };
    const createHero = () => { KR.A.sfx('click'); if (chars.length >= 8) { KR.UI.toast && KR.UI.toast('Hero limit reached', 'Delete a hero to make room.'); return; } M.showCreate(); };
    const banner = (f) => { const F = D.FACTIONS[f]; return `<div class="mm-ban" style="--fb:${F.banner};--ft:${F.trim};--fc:${F.color}" title="${esc(F.city)}"><span>${f === 'sylvan' ? '❦' : '♜'}</span><small>${esc(F.city)}</small></div>`; };
    if (M.offLobby) M.offLobby();
    scr.innerHTML = `<canvas class="bgcv"></canvas><div class="mm">
      <header class="mm-title">${banner(D.FACTION_IDS[0])}<div class="mm-tt"><div class="mm-crest">♛</div><h1>Kingdom Rising</h1><div class="mm-rule"><i></i><span>Two brothers · One crown</span><i></i></div></div>${banner(D.FACTION_IDS[1])}</header>
      <nav class="mm-nav">${chars.length ? `<button class="mm-continue" id="mm-cont"><span>▶ Continue</span><small>${esc(chars[0].name)} · level ${D.shown(chars[0].level)} ${esc(D.CLASSES[chars[0].cls].name)}</small></button>` : ''}${tabs.map(([k, ic, n]) => `<button class="mm-tab ${(mmTab === k || under[mmTab] === k) ? 'on' : ''}" data-t="${k}"><span>${ic}</span>${n}</button>`).join('')}
        <div class="mm-realm"><small>${KR.Sys.Store.db ? 'Saved to your Claude account' : 'Saved in this browser'} · v${window.KR_VERSION}</small></div></nav>
      <section class="mm-panel"></section></div>`;
    // the title screen: the kingdom burns behind the title
    if (KR.ClassBG) classBgLoop($('.bgcv', scr), () => 'burning'); else riseLoop($('.bgcv', scr));
    { const cont = $('#mm-cont', scr); if (cont) cont.onclick = () => { KR.A.sfx('click'); LSs('kr_sel_hero', chars[0].id); cancelAnimationFrame(riseRaf); KR.Main.enterWorld(chars[0].id); }; }
    { const nav = $('.mm-nav', scr); const lab = document.createElement('label'); lab.className = 'mm-tipchk'; lab.innerHTML = `<input type="checkbox" id="mm-tips" ${a.settings.tipsNew === false ? '' : 'checked'}> <span>Show me tool tips for newly created characters</span>`; lab.hidden = true; nav.insertBefore(lab, nav.querySelector('.mm-realm')); $('#mm-tips', lab).onchange = (e) => { a.settings.tipsNew = e.target.checked; Sys.saveAccount && Sys.saveAccount(); }; }
    scr.querySelectorAll('.mm-tab').forEach((b) => (b.onclick = () => { KR.A.sfx('click'); if (b.dataset.t === 'quit') return M.quit(); if (b.dataset.t === 'new') return createHero(); mmTab = b.dataset.t; M.showMenu(); }));
    const P = $('.mm-panel', scr);
    if (mmTab === 'heroes') {
      if (!chars.length) { P.innerHTML = `<div class="mm-empty"><h2>No heroes yet</h2><p>Every kingdom starts as a hamlet. Create a hero, choose any race and class, and pledge yourself to one of the two brothers.</p><button class="btn gold big" id="mm-first">✚ Create your first hero</button></div>`; $('#mm-first').onclick = createHero; return; }
      const ch = chars.find((c) => c.id === sel);
      P.innerHTML = `<div class="mm-hero"><div class="mm-stage"><canvas class="mm-clsbg" aria-hidden="true"></canvas><canvas class="mm-fig" width="380" height="440"></canvas><div class="mm-rot"><button class="btn small ghost" data-r="-1" aria-label="Turn left">⟲</button><button class="btn small ghost" data-r="1" aria-label="Turn right">⟳</button></div></div>
        <div class="mm-info"><h2>${esc(ch.name)}</h2><div class="mm-cls">Level ${D.shown(ch.level)} ${esc(D.RACES[ch.race].name)} ${esc(D.CLASSES[ch.cls].name)}</div>
        <dl><dt>Kingdom</dt><dd style="color:${D.FACTIONS[ch.faction].color}">${esc(D.FACTIONS[ch.faction].city)}</dd><dt>Location</dt><dd>${esc(ch.zone || D.FACTIONS[ch.faction].city)}</dd><dt>Last played</dt><dd>${ago(ch.updated)}</dd><dt>Difficulty</dt><dd class="mm-diff">${['easy', 'normal', 'hard'].map((d) => `<button class="btn small ${(ch.diff || 'normal') === d ? 'gold' : 'ghost'}" data-diff="${d}" title="${{ easy: 'Your brother builds slowly and rarely raids', normal: 'Your brother builds and raids as fast as you', hard: 'Your brother builds fast and raids often, with big armies' }[d]}">${{ easy: 'Easy', normal: 'Normal', hard: 'Hard' }[d]}</button>`).join(' ')}</dd></dl>
        <div class="mm-play"><button class="btn gold big mm-enter" id="mm-enter">Single Player</button><button class="btn big mm-enter" id="mm-multi">Multiplayer</button></div></div></div>
        <div class="mm-roster"><h3>Your heroes <small>${chars.length} / 8</small><button class="btn small gold mm-new" id="mm-new" ${chars.length >= 8 ? 'disabled title="Delete a hero to make room"' : ''}>✚ Create New Hero</button></h3><div class="mm-list"></div></div>`;
      $('#mm-new', P).onclick = createHero;
      const cv = $('.mm-stage canvas.mm-fig', P);
      // the hero stands in front of their class's scene
      if (KR.ClassBG) { const bg = $('.mm-clsbg', P); classBgLoop(bg, () => ch.cls, () => { const w = cv.offsetWidth, h = cv.offsetHeight; Object.assign(bg.style, { left: cv.offsetLeft + 'px', top: cv.offsetTop + 'px', width: w + 'px', height: h + 'px' }); return { w, h }; }); } const g = cv.getContext('2d'); const look = lookOf(ch); const t0 = performance.now();
      const draw = () => { if (!cv.isConnected) return; const t = (performance.now() - t0) / 1000; g.clearRect(0, 0, 380, 440);
        const gl = g.createRadialGradient(190, 380, 10, 190, 330, 220); gl.addColorStop(0, `${D.FACTIONS[ch.faction].color}55`); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(0, 0, 380, 440);
        g.save(); g.translate(190, 400); g.scale(1, 0.32); g.strokeStyle = 'rgba(255,215,140,0.55)'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 110, 0, 6.28); g.stroke(); g.strokeStyle = 'rgba(255,215,140,0.25)'; g.beginPath(); g.arc(0, 0, 130, t, t + 4); g.stroke(); g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(0, 0, 80, 0, 6.28); g.fill(); g.restore();
        for (let i = 0; i < 14; i++) { const ph = (t * 0.15 + i / 14) % 1; g.fillStyle = `rgba(255,220,150,${0.5 * (1 - ph)})`; g.fillRect(190 + Math.sin(i * 2.3) * 120, 400 - ph * 360, 2, 2); }
        S.drawHumanoid(g, 190, 398 + Math.sin(t * 1.6) * 1.5, Object.assign({}, look, { scale: 5.2, dir: [0, 1, 3, 2][((heroDir % 4) + 4) % 4], walk: 0, moving: false }), t);
        requestAnimationFrame(draw); };
      let hv = null;
      if (window.KR3D && KR.heroView3D) { cv.classList.add('k3-hero'); hv = KR.heroView3D(cv, { ring: D.FACTIONS[ch.faction].color, pose: 'ready' }); hv.set(look); } else draw();
      P.querySelectorAll('.mm-rot [data-r]').forEach((b) => (b.onclick = () => { heroDir += +b.dataset.r; if (hv) hv.yaw += +b.dataset.r * Math.PI / 2; }));
      const enter = () => { LSs('kr_sel_hero', ch.id); cancelAnimationFrame(riseRaf); KR.Main.enterWorld(ch.id); };
      $('#mm-enter', P).onclick = enter;
      // the enemy kingdom's difficulty for this hero's campaign (monsters are the same on every setting)
      P.querySelectorAll('.mm-diff [data-diff]').forEach((bt) => (bt.onclick = () => { KR.A.sfx('click'); ch.diff = bt.dataset.diff; try { localStorage.setItem('kr_diff_' + ch.id, ch.diff); } catch (e) {} Sys.saveAccount && Sys.saveAccount(); M.showMenu(); }));
      $('#mm-multi', P).onclick = () => { KR.A.sfx('click'); mmTab = 'online'; M.showMenu(); };
      const list = $('.mm-list', P);
      chars.forEach((c) => {
        const card = document.createElement('button'); card.className = 'mm-card' + (c.id === sel ? ' on' : '');
        card.innerHTML = `<canvas width="56" height="66"></canvas><span><b>${esc(c.name)}</b><small>${D.shown(c.level)} ${esc(D.CLASSES[c.cls].name)} · ${esc(D.FACTIONS[c.faction].city)} · ${{ easy: 'Easy', normal: 'Normal', hard: 'Hard' }[c.diff || 'normal']}</small><small class="dim">${esc(c.zone || '')}</small></span>`;
        clsBack(card.querySelector('canvas'), c.cls);
        if (!snap3(card.querySelector('canvas'), lookOf(c))) S.drawHumanoid(card.querySelector('canvas').getContext('2d'), 28, 62, Object.assign(lookOf(c), { scale: 1.15 }), 0);
        card.onclick = () => { LSs('kr_sel_hero', c.id); KR.A.sfx('click'); M.showMenu(); };
        card.ondblclick = () => { LSs('kr_sel_hero', c.id); KR.Main.enterWorld(c.id); };
        list.appendChild(card);
      });
    } else if (mmTab === 'online') {
      M.showOnline(P, chars.find((c) => c.id === sel));
    } else if (mmTab === 'delete') {
      P.innerHTML = `<div class="mm-del"><button class="btn small ghost mm-back" onclick="KR.Menus && KR.Menus.showMenu ? KR.Menus.showMenu('options') : null">← Settings</button><h2>Delete a hero</h2><p class="dim">Deleting a hero cannot be undone. Items and coin in the shared bank are kept for your other heroes.</p><div class="mm-list wide"></div></div>`;
      const list = $('.mm-list', P); if (!chars.length) list.innerHTML = '<p class="empty-note">You have no heroes.</p>';
      P.querySelector('.mm-del').insertAdjacentHTML('beforeend', `<div class="mm-danger"><h3>Start completely over</h3><p class="dim">Delete every hero and start both kingdoms over.</p><button class="btn danger" id="md-reset">Reset entire game</button></div>`);
      $('#md-reset').onclick = () => KR.UI.confirm('Reset the entire game? Every hero, the bank and both kingdoms will be wiped. This cannot be undone.', async () => { await Sys.fullReset(); M.showMenu('heroes'); });
      chars.forEach((c) => {
        const row = document.createElement('div'); row.className = 'mm-card del';
        row.innerHTML = `<canvas width="56" height="66"></canvas><span><b>${esc(c.name)}</b><small>Level ${D.shown(c.level)} ${esc(D.RACES[c.race].name)} ${esc(D.CLASSES[c.cls].name)} · ${esc(D.FACTIONS[c.faction].city)}</small></span><button class="btn danger">Delete</button>`;
        S.drawHumanoid(row.querySelector('canvas').getContext('2d'), 28, 62, Object.assign(lookOf(c), { scale: 1.15 }), 0);
        row.querySelector('button').onclick = () => KR.UI.confirm(`Delete ${c.name} forever? This cannot be undone.`, () => { Sys.deleteChar(c.id); setTimeout(() => M.showMenu('delete'), 50); });
        list.appendChild(row);
      });
    } else if (mmTab === 'guide') {
      const T = D.CITY_THRESHOLDS;
      P.innerHTML = `<div class="mm-guide"><button class="btn small ghost mm-back" onclick="KR.Menus && KR.Menus.showMenu ? KR.Menus.showMenu('options') : null">← Settings</button>
        <h2>How to Play</h2>
        <p class="mg-goal"><b>The story:</b> Old King Edric Valen is dead, and his two sons have split his kingdom. Aldric, the firstborn, rules Valenmoor. Theron, the younger, rules Aelindor. <b>Your goal:</b> build your king's kingdom from a hamlet into a mighty capital, then <b>destroy the other kingdom by slaying its king</b>.</p>
        <div class="mg-steps">
          <div class="mg-step"><span>1</span><div><b>Come home and meet your king</b><p>You arrive by ship. The harbourmaster sends you to the king at the top of the Town Hall. Follow the main quest: it walks you through everything below.</p></div></div>
          <div class="mg-step"><span>2</span><div><b>Run the kingdom</b><p>Hire the Court Liaison in the Town Hall, then press <b>N</b> to open the kingdom anywhere. Arborists and Miners gather wood and stone for you; buildings cost wood and stone.</p></div></div>
          <div class="mg-step"><span>3</span><div><b>Build</b><p>Sawmill and Stone Cutter first, then the Barracks, Archery Range, Stable and Siege Workshop. Add walls, towers, a Pub (mercenaries) and a Shipyard (warships).</p></div></div>
          <div class="mg-step"><span>4</span><div><b>Grow your hero</b><p>Quest, hunt and loot up to level 20. Gold from quests, loot and humanoid foes hires soldiers and better tools.</p></div></div>
          <div class="mg-step"><span>5</span><div><b>Go to war</b><p>When soldiers are ready the <b>⚔ Attack</b> button sends your army or fleet. Rams break gates, cannons and ballistas break walls. When your bells ring, defend your town.</p></div></div>
          <div class="mg-step"><span>6</span><div><b>Win</b><p>Kill the enemy king in his Town Hall. Then play again on a harder difficulty with the same hero.</p></div></div>
        </div>
        <p class="dim">Not sure what to do next? Talk to the townsfolk of your kingdom: they will tell you which quests are waiting, where to hunt and gather at your level, and what your king still needs.</p>
        ${chars.length ? '' : '<button class="btn gold big" id="mm-first">Create your first hero</button>'}</div>`;
      const fb = $('#mm-first', P); if (fb) fb.onclick = () => M.showCreate();
    } else if (mmTab === 'history') {
      P.innerHTML = `<div class="mm-hist"><button class="btn small ghost mm-back" onclick="KR.Menus && KR.Menus.showMenu ? KR.Menus.showMenu('options') : null">← Settings</button><h2>History of the Realm</h2><p>For forty years King Edric Valen ruled one kingdom from the plains to the old forests. Then, at his own midwinter feast, someone poisoned his wine. The poisoner was never found. Each of his sons, Aldric and Theron, accused the other, and the kingdom tore in two before the snow had melted.</p><p>Aldric, the firstborn, holds the old capital of Valenmoor with the mountain clans and the halflings. Theron, the younger, was crowned by the elves in Aelindor, and many human families followed him there. Aldric calls his brother a thief in a borrowed crown. Theron calls Aldric a tyrant. Both swear the whole land is theirs by right.</p><p>Every boss you slay, every named beast you hunt and every quest you finish earns status for your kingdom. Bring your king timber and stone and he will build it higher, from hamlet to village, town, city and finally capital.</p><button class="btn gold" id="mm-intro">Watch the history</button></div>`;
      $('#mm-intro', P).onclick = () => M.playIntro(() => M.showMenu());
    } else if (mmTab === 'options') {
      const st = a.settings;
      P.innerHTML = `<div class="mm-opt"><h2>Settings</h2><div class="mm-links"><button class="btn" data-go="guide">🧭 How to Play</button><button class="btn" data-go="history">📜 History of the Realm</button><button class="btn" data-go="delete">🗑 Delete a hero</button></div><label class="check"><input type="checkbox" id="mo-tips" ${a.settings.tipsNew === false ? '' : 'checked'}> Show tips to newly created heroes</label><label class="slider">Music <input type="range" id="mo-mus" min="0" max="1" step="0.05" value="${st.music}"></label><label class="slider">Sound effects <input type="range" id="mo-sfx" min="0" max="1" step="0.05" value="${st.sfx}"></label><button class="btn" id="mo-fs">Toggle full screen</button><p class="dim small">More settings (hotbar, panels, zoom) are in the game's Settings window (Esc).</p></div>`;
      const apply = () => { st.music = +$('#mo-mus').value; st.sfx = +$('#mo-sfx').value; KR.A.setVolumes(st.music, st.sfx); Sys.saveAccount && Sys.saveAccount(); };
      P.querySelector('.mm-opt').insertAdjacentHTML('beforeend', `<div class="mm-danger"><h3>Reset the whole game</h3><p class="dim">Deletes every hero you have made, empties the shared bank and starts both kingdoms over from a bare town. This cannot be undone.</p><button class="btn danger" id="mo-reset">Reset entire game</button></div>`);
      $('#mo-reset').onclick = () => KR.UI.confirm('Reset the entire game? Every hero, the bank and both kingdoms will be wiped. This cannot be undone.', async () => { await Sys.fullReset(); M.showMenu('heroes'); });
      P.querySelectorAll('[data-go]').forEach((bt) => (bt.onclick = () => { KR.A.sfx('click'); mmTab = bt.dataset.go; M.showMenu(); }));
      $('#mo-tips').onchange = (e) => { a.settings.tipsNew = e.target.checked; const t = $('#mm-tips'); if (t) { t.checked = e.target.checked; t.dispatchEvent(new Event('change')); } Sys.saveAccount && Sys.saveAccount(); };
      $('#mo-mus').oninput = apply; $('#mo-sfx').oninput = apply; $('#mo-fs').onclick = () => KR.UI.toggleFullscreen && KR.UI.toggleFullscreen();
    }
  };

  // ---------------- multiplayer: host or join a game ----------------
  M.showOnline = function (P, ch) {
    const O = KR.Online, a = G.account;
    const lv = (n) => Math.max(1, Math.min(5, Math.round(+n) || 1));
    P.innerHTML = `<div class="mm-online">
      <h2>Multiplayer</h2>
      <p class="mo-as">Playing as <b>${esc(ch.name)}</b>, level ${D.shown(ch.level)} ${esc(D.CLASSES[ch.cls].name)} of ${esc(D.FACTIONS[ch.faction].city)}. <button class="btn small ghost" id="mo-hero">Change hero</button></p>
      ${O.available() ? '' : '<p class="mo-msg bad">Multiplayer only works in the claude.ai version of the game. Here you can play Single Player.</p>'}
      <p class="mo-msg" id="mo-msg" role="status"></p>
      <section class="mo-box mo-main">
        <ol class="mo-how"><li>One of you presses <b>Host a game</b>.</li><li>Send your friends the invite link (or the game code).</li><li>They open it, pick a hero and press <b>Join</b>.</li></ol>
        <div class="mo-actions">
          <button class="btn gold big" id="mo-host">Host a game</button>
          <div class="mo-or">or</div>
          <div class="mo-joinrow"><input id="mo-jcode" maxlength="12" autocomplete="off" spellcheck="false" placeholder="Game code" aria-label="Game code"><button class="btn gold big" id="mo-join">Join</button></div>
        </div>
        <details class="mo-more" id="mo-more"><summary>Password and game name (optional)</summary>
          <label>Password<input id="mo-pass" type="password" maxlength="40" autocomplete="off" placeholder="Leave empty for an open game"></label>
          <label>Game name (when hosting)<input id="mo-hname" maxlength="40" value="${esc(ch.name)}'s realm"></label>
        </details>
      </section>
      <div class="mo-grid">
        <section class="mo-box"><h3>Open games</h3><div class="mo-list" id="mo-list"><p class="empty-note">Looking for games...</p></div></section>
        <section class="mo-box"><h3>Your games</h3><div class="mo-list" id="mo-mine"></div>
          <p class="dim small">Join a game you played before, or host it again to carry on where it left off.</p></section>
      </div></div>`;
    const msg = (t, bad) => { const m = $('#mo-msg', P); if (m) { m.textContent = t; m.className = 'mo-msg' + (bad ? ' bad' : ''); } };
    const busy = (on) => P.querySelectorAll('button, input').forEach((el) => (el.disabled = on));
    let offL = null; M.offLobby = () => { if (offL) { offL(); offL = null; } };
    const go = async (label, fn) => {
      if (!O.available()) return msg('Multiplayer only works in the claude.ai version of the game.', true);
      KR.A.sfx('click'); busy(true); msg(label);
      try { await fn(); } catch (e) { busy(false); msg((e && e.message) || String(e), true); return; }
      M.offLobby(); LSs('kr_sel_hero', ch.id); cancelAnimationFrame(riseRaf);
      await KR.Main.enterWorld(ch.id);
      if (O.mode === 'host') O.advertise();
      if (O.mode === 'host' && KR.UI.banner) {
        const link = O.inviteLink(); let copied = false;
        try { if (navigator.clipboard) { await navigator.clipboard.writeText(link); copied = true; } } catch (e) {}
        KR.UI.banner(`You are hosting ${O.name}`, `Game code: ${O.code}${O.pass ? ' (password set)' : ''}. ${copied ? 'Invite link copied: paste it to your friends.' : 'Send your friends the invite link from the chat.'}`);
        G.log(`You are hosting "${O.name}". Game code: ${O.code}${O.pass ? '. Friends also need the password you chose.' : '.'}`, 'status', '#ffd84a');
        G.log(`Invite link: ${link}${copied ? ' (copied)' : ''}. Type /invite to see it again.`, 'status', '#ffd84a');
      } else if (O.mode === 'join') G.log(`You joined "${O.name}". The host's world decides both kingdoms.`, 'status', '#9ad8ff');
    };
    $('#mo-hero', P).onclick = () => { mmTab = 'heroes'; M.showMenu(); };
    const pass = () => $('#mo-pass', P).value;
    const join = () => go('Looking for the host...', async () => {
      try { await O.join($('#mo-jcode', P).value, pass()); }
      catch (e) { if (!pass() && /No host answered/.test(e.message || '')) throw new Error('No host answered. If the game has a password, open "Password and game name" and enter it. Otherwise check the code and that the host is still playing.'); throw e; }
    });
    $('#mo-join', P).onclick = join;
    $('#mo-jcode', P).onkeydown = (e) => { if (e.key === 'Enter') join(); };
    $('#mo-host', P).onclick = () => go('Opening your game...', () => O.host({ fresh: true, name: $('#mo-hname', P).value, pass: pass() }));
    // an invite link (?join=code) fills in the code
    const inv = O.cleanCode(new URLSearchParams(location.search).get('join') || '');
    if (inv) { $('#mo-jcode', P).value = inv; msg(`You were invited to game ${inv}. Press Join.`); }
    const mine = $('#mo-mine', P); const games = a.games || [];
    if (!games.length) mine.innerHTML = '<p class="empty-note">Games you host or join are listed here.</p>';
    games.forEach((gm) => {
      const row = document.createElement('div'); row.className = 'mo-row';
      row.innerHTML = `<span><b>${esc(gm.name || gm.code)}</b><small>Code ${esc(gm.code)}${gm.pass ? ' · 🔒' : ''}</small></span><button class="btn small" data-a="join">Join</button><button class="btn small" data-a="host">Host</button>`;
      row.querySelector('[data-a=join]').onclick = () => go('Looking for the host...', () => O.join(gm.code, gm.pass));
      row.querySelector('[data-a=host]').onclick = () => go('Loading the saved game...', () => O.host({ code: gm.code, pass: gm.pass }));
      mine.appendChild(row);
    });
    const renderList = () => {
      const box = $('#mo-list', P); if (!box) return;
      const hs = O.listHosts();
      box.innerHTML = hs.length ? '' : '<p class="empty-note">No open games right now. Host one, or join with a code.</p>';
      hs.forEach((h) => {
        const code = O.cleanCode(h.code); const lvs = Array.isArray(h.lv) ? h.lv : [];
        const row = document.createElement('div'); row.className = 'mo-row';
        row.innerHTML = `<span><b>${h.lock ? '🔒 ' : ''}${esc(String(h.name || code).slice(0, 40))}</b><small>Host ${esc(String(h.hero || 'unknown').slice(0, 24))} · ${Math.max(1, Math.round(+h.n) || 1)} playing · ${D.FACTION_IDS.map((f, i) => `${esc(D.FACTIONS[f].city)} ${'★'.repeat(lv(lvs[i]))}`).join(' · ')}</small></span><button class="btn small">Join</button>`;
        row.querySelector('button').onclick = () => {
          $('#mo-jcode', P).value = code;
          if (h.lock && !pass()) { $('#mo-more', P).open = true; $('#mo-pass', P).focus(); msg(`${String(h.name || code).slice(0, 40)} has a password. Enter it, then press Join.`); }
          else go('Looking for the host...', () => O.join(code, pass()));
        };
        box.appendChild(row);
      });
    };
    if (!O.available()) { $('#mo-list', P).innerHTML = '<p class="empty-note">Not available in this version.</p>'; busy(true); $('#mo-hero', P).disabled = false; return; }
    O.getLobby().then((l) => {
      if (!P.isConnected) return;
      if (!l) { $('#mo-list', P).innerHTML = (window.claude ? '<p class="empty-note">Could not reach other players. Make sure you are signed in to claude.ai.</p>' : '<p class="empty-note">Could not reach the multiplayer servers. Check your internet connection, or join with a game code.</p>'); return; }
      renderList(); offL = l.onPeers(() => { if (!P.isConnected) return M.offLobby(); renderList(); });
    });
  };

  // ---------------- quit ----------------
  M.quit = function () {
    KR.UI.confirm('Quit Kingdom Rising? Your heroes and kingdoms are saved.', () => {
      Sys.saveAccount && Sys.saveAccount(true);
      cancelAnimationFrame(riseRaf); if (M.offLobby) M.offLobby();
      KR.A.play('silence');
      const scr = $('#screen');
      scr.innerHTML = `<div class="mm-quit"><div class="mm-crest">♛</div><h1>Farewell, hero</h1><p>Your heroes and kingdoms are saved. You can close this tab now.</p><button class="btn gold big" id="mq-back">Back to the main menu</button></div>`;
      $('#mq-back').onclick = () => { mmTab = 'heroes'; M.showMenu(); };
      try { window.close(); } catch (e) {}
    });
  };

  // ---------------- creation ----------------
  let cs = null;
  M.showCreate = function () {
    cs = { step: 0, faction: null, race: null, cls: null, gender: 'm', skin: 1, hair: 1, hairStyle: 0, name: '', bonus: {}, dir: 0 };
    D.STATS.forEach((s) => (cs.bonus[s] = 0));
    // your first hero's kingdom is your kingdom for good (until a full reset of the game)
    if (G.account.faction && D.FACTIONS[G.account.faction]) { cs.sworn = G.account.faction; cs.locked = true; }
    renderCreate();
  };
  const BONUS = 20;
  function renderCreate() {
    const scr = $('#screen');
    // your pledge comes first: each kingdom has its own class, and the player should know before choosing
    const steps = ['Pledge', 'Race', 'Class', 'Appearance', 'Name'];
    scr.innerHTML = `<canvas class="bgcv"></canvas><div class="cr"><header class="cr-h"><button class="btn ghost" id="cr-back">← Back</button><ol class="steps">${steps.map((s, i) => `<li class="${i === cs.step ? 'on' : i < cs.step ? 'done' : ''}">${s}</li>`).join('')}</ol></header><div class="cr-body"></div></div>`;
    // once a class is on the table, its scene fills the screen (on the class step it follows the card you point at)
    cs.bgCls = cs.step >= 3 ? cs.cls : null;
    if (cs.step >= 2 && KR.ClassBG) classBgLoop($('.bgcv', scr), () => cs.bgCls); else bgLoop($('.bgcv', scr));
    $('#cr-back').onclick = () => { if (cs.step === 0) M.showMenu(); else { cs.step--; renderCreate(); } };
    const body = $('.cr-body', scr);
    const next = () => { cs.step++; renderCreate(); };
    if (cs.step === 0) {
      // the first step: kneel before one of the two brothers
      body.innerHTML = `<h2>Pledge your allegiance</h2><p class="lead">The land is split between two brothers. Kneel before one of them: your kingdom decides your home, your people and your enemies, and it opens one class no one else can take. The other brother's guards will attack you on sight.${cs.locked ? ` Your heroes already serve ${esc(D.FACTIONS[cs.sworn].king)}.` : ''}</p><div class="cards fac-cards"></div>`;
      const cards = $('.cards', body);
      const PITCH = { crown: 'Steel and black powder: knights, musketeers and cannons hold the walls of Valenmoor.', sylvan: 'Elven wild magic: troll giants, ballistas and the old ways of the forest guard Aelindor.' };
      D.FACTION_IDS.forEach((f) => {
        const F = D.FACTIONS[f]; const barred = cs.locked && cs.sworn !== f; const sp = D.CLASSES[D.SPECIAL_CLASS[f]];
        const c = document.createElement('div'); c.className = 'card fac pledge' + (barred ? ' barred' : '') + (cs.faction === f ? ' sel' : ''); c.style.setProperty('--fc', F.color); c.style.setProperty('--fb', F.banner);
        c.innerHTML = `<canvas width="300" height="150" style="width:100%;height:120px;object-fit:cover;display:block"></canvas><div class="card-b"><h3>${F.city}</h3><div class="fac-n">${F.name} · ${F.king}</div><p>${PITCH[f] || ''} ${F.blurb}</p>
          ${sp ? `<div class="fac-sp" style="border:1px solid ${sp.trim};border-radius:6px;padding:6px 8px;margin:6px 0;background:rgba(0,0,0,.3)"><b style="color:${sp.trim}">Kingdom class: ${sp.name}</b><div class="small">${esc(sp.desc)}</div></div>` : ''}
          <div class="dim small">Rivals: ${F.enemyMobs}</div>
          <button class="btn gold pledge-go" ${barred ? 'disabled' : ''}>${barred ? `Your heroes serve ${esc(D.FACTIONS[cs.sworn].kingFirst || D.FACTIONS[cs.sworn].king)}` : `Pledge to ${esc(F.king)}`}</button></div>`;
        const g = c.querySelector('canvas').getContext('2d'); g.scale(300 / 860, 150 / 430); M.paintCity(g, 860, 430, f, 3);
        c.querySelector('.pledge-go').onclick = () => { if (barred) return; if (cs.faction !== f && cs.cls && !D.classOpen(cs.cls, f)) cs.cls = null; cs.faction = f; KR.A.sfx('quest', 0.6); next(); };
        cards.appendChild(c);
      });
    } else if (cs.step === 1) {
      body.innerHTML = `<h2>Choose your race</h2><p class="lead">Every people of the realm can be found in both kingdoms. Each race starts with different natural strengths. Every other stat comes from the gear you earn.</p><div class="cards"></div>`;
      const cards = $('.cards', body);
      D.RACE_IDS.forEach((r) => {
        const R = D.RACES[r]; const sig = RACE_SHOWCASE[r] && R.classes.includes(RACE_SHOWCASE[r]) ? RACE_SHOWCASE[r] : R.classes[0];
        const c = document.createElement('button'); c.className = 'card race' + (cs.race === r ? ' sel' : '');
        c.innerHTML = `<canvas width="120" height="140"></canvas><div class="card-b"><h3>${R.name}</h3><p>${R.desc}</p><table class="mini-stats">${D.STATS.map((s) => `<tr><th>${s}</th><td><span class="sb"><i style="width:${R.stats[s]}%"></i></span>${R.stats[s]}</td></tr>`).join('')}</table><div class="dim small">${R.classes.length} classes · shown as a ${D.CLASSES[sig].name.toLowerCase()}</div></div>`;
        const cv = c.querySelector('canvas'); clsBack(cv, sig);
        const look = previewLook({ race: r, cls: sig, gender: cs.gender, skin: 1, hair: R.hairDefault != null ? R.hairDefault : r === 'gnome' ? 5 : r === 'highelf' ? 3 : 1, hairStyle: 1 });
        if (!snap3(cv, look)) S.drawHumanoid(cv.getContext('2d'), 60, 132, Object.assign(look, { scale: 2.0 * R.scale }), 0);
        c.onclick = () => { cs.race = r; cs.cls = null; if (R.hairDefault != null) cs.hair = R.hairDefault; next(); };
        cards.appendChild(c);
      });
    } else if (cs.step === 2) {
      const R = D.RACES[cs.race]; const F = D.FACTIONS[cs.faction];
      body.innerHTML = `<h2>Choose your class</h2><p class="lead">Every class learns 8 abilities and 3 passives on the way to level 20, and comes home in its own clothes. ${F ? `Your pledge to ${esc(F.king)} opens ${esc(F.city)}'s own class.` : ''}</p><div class="cards cls"></div>`;
      const cards = $('.cards', body);
      // the kingdom's own class first, the other kingdom's class last and closed
      const list = R.classes.slice().sort((a, b) => (D.CLASSES[b].only === cs.faction) - (D.CLASSES[a].only === cs.faction) || (!!D.CLASSES[a].only && D.CLASSES[a].only !== cs.faction) - (!!D.CLASSES[b].only && D.CLASSES[b].only !== cs.faction));
      list.forEach((k) => {
        const C = D.CLASSES[k]; const own = C.only && C.only === cs.faction, shut = C.only && C.only !== cs.faction;
        const c = document.createElement('button'); c.className = 'card clsc' + (cs.cls === k ? ' sel' : '') + (shut ? ' barred' : ''); c.style.setProperty('--fc', C.color);
        if (own) { c.style.outline = `2px solid ${C.trim}`; c.style.boxShadow = `0 0 18px ${C.trim}`; }
        if (shut) { c.disabled = true; c.style.opacity = '0.45'; c.style.filter = 'grayscale(0.7)'; }
        const badge = C.only ? `<span style="background:${C.trim};color:#1a120a;font-weight:700;border-radius:4px;padding:1px 6px">${esc(D.FACTIONS[C.only].city)} only</span>` : '';
        c.innerHTML = `<canvas width="90" height="104"></canvas><div class="card-b"><h3>${C.name}</h3><div class="tags">${badge}<span>${C.role === 'melee' ? 'Melee' : C.role === 'hybrid' ? 'Hybrid' : 'Caster'}</span><span>${C.armor} armor</span></div><p>${C.desc}</p>${shut ? `<p class="dim small">Only heroes pledged to ${esc(D.FACTIONS[C.only].king)} can take this class.</p>` : ''}</div>`;
        const cv = c.querySelector('canvas'); clsBack(cv, k);
        const look = previewLook({ race: cs.race, cls: k, gender: cs.gender, skin: cs.skin, hair: cs.hair, hairStyle: cs.hairStyle });
        if (!snap3(cv, look)) S.drawHumanoid(cv.getContext('2d'), 45, 98, Object.assign(look, { scale: 1.55 * R.scale }), 0);
        c.onmouseenter = c.onfocus = () => { if (!shut) cs.bgCls = k; };
        c.onclick = () => { if (shut) return; cs.cls = k; next(); };
        cards.appendChild(c);
      });
    } else if (cs.step === 3 && window.KR3D && KR.heroView3D) {
      appearance3D(body, next);
    } else if (cs.step === 3) {
      body.innerHTML = `<h2>Your appearance</h2><div class="app"><div class="app-prev"><canvas id="ap-cv" width="220" height="260"></canvas><div class="row"><button class="btn ghost" id="ap-rot" aria-label="Turn">↻ Turn</button></div></div><div class="app-opts">
        <div class="opt"><label>Body</label><div class="seg"><button data-g="m" class="${cs.gender === 'm' ? 'on' : ''}">Male</button><button data-g="f" class="${cs.gender === 'f' ? 'on' : ''}">Female</button></div></div>
        <div class="opt"><label>Skin</label><div class="sw">${S.skinsFor(cs.race).map((c, i) => `<button data-skin="${i}" style="background:${c}" class="${cs.skin === i ? 'on' : ''}" aria-label="Skin tone ${i + 1}"></button>`).join('')}</div></div>
        <div class="opt"><label>Hair color</label><div class="sw">${S.HAIRS.map((c, i) => `<button data-hair="${i}" style="background:${c}" class="${cs.hair === i ? 'on' : ''}" aria-label="Hair color ${i + 1}"></button>`).join('')}</div></div>
        <div class="opt"><label>Hair style</label><div class="seg">${['Short', 'Long', 'Crest', 'Flowing', 'Shaved'].map((n, i) => `<button data-hs="${i}" class="${cs.hairStyle === i ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <button class="btn gold big" id="ap-next">Continue</button></div></div>`;
      const cv = $('#ap-cv'); let raf;
      const draw = () => { if (!cv.isConnected) return cancelAnimationFrame(raf); const g = cv.getContext('2d'); g.clearRect(0, 0, 220, 260); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(110, 240, 60, 14, 0, 0, 6.28); g.fill(); const look = Object.assign(previewLook(cs), { hat: null, helm: null, mask: null }); S.drawHumanoid(g, 110, 238, Object.assign(look, { dir: cs.dir, scale: 3.6 * D.RACES[cs.race].scale, walk: performance.now() / 160, moving: false }), performance.now() / 1000); raf = requestAnimationFrame(draw); };
      draw();
      body.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { cs.gender = b.dataset.g; renderCreate(); }));
      body.querySelectorAll('[data-skin]').forEach((b) => (b.onclick = () => { cs.skin = +b.dataset.skin; renderCreate(); }));
      body.querySelectorAll('[data-hair]').forEach((b) => (b.onclick = () => { cs.hair = +b.dataset.hair; renderCreate(); }));
      body.querySelectorAll('[data-hs]').forEach((b) => (b.onclick = () => { cs.hairStyle = +b.dataset.hs; renderCreate(); }));
      $('#ap-rot').onclick = () => { cs.dir = [0, 2, 3, 1][(([0, 2, 3, 1].indexOf(cs.dir)) + 1) % 4]; };
      $('#ap-next').onclick = next;
    } else {
      const R = D.RACES[cs.race], C = D.CLASSES[cs.cls]; const fit = Sys.CLASS_OUTFITS[cs.cls];
      const names = D.NAMES[cs.faction || cs.sworn || R.faction] || D.NAMES[D.FACTION_IDS[0]];
      body.innerHTML = `<h2>Name your hero</h2><div class="nm"><div class="nm-l"><label for="cr-name">Name</label><input id="cr-name" maxlength="14" autocomplete="off" value="${esc(cs.name)}" placeholder="${esc(names[cs.gender][0])}"><button class="btn ghost small" id="cr-rand">Suggest a name</button><p class="err" id="cr-err" aria-live="polite"></p>
        <div class="summary"><b>${R.name} ${C.name}</b><span>${C.role === 'melee' ? 'melee' : C.role}</span><span class="dim">You come home from the sea dressed as a ${C.name.toLowerCase()}${fit ? ` (${[fit.head, fit.chest].filter(Boolean).map((x) => x[0].toLowerCase()).join(' and ')})` : ''}, with a weapon suited to your calling, 16 bag slots and 3 abilities. The clothes give no armour: everything else you earn.</span></div></div>
        <div class="nm-r"><h3>Starting stats</h3><table class="stats">${D.STATS.map((s) => `<tr><th title="${esc(D.STAT_HELP[s])}">${D.STAT_NAMES[s]}</th><td>${R.stats[s]}</td></tr>`).join('')}</table><p class="dim small">These are your race's natural stats. From here on, stats only come from gear: weapons, armor, jewelry, capes and belts.</p></div></div>
        <div class="cr-diff"><h3>Difficulty <small class="dim">how fast your rival brother builds and how often he raids; monsters are the same on every setting</small></h3><div>${[['easy', 'Easy', 'A slow rival, rare raids'], ['normal', 'Normal', 'An even race'], ['hard', 'Hard', 'He builds fast and raids often']].map(([k, n, d]) => `<button class="cr-dbtn ${(cs.diff || 'normal') === k ? 'on' : ''}" data-diff="${k}"><b>${n}</b><small>${d}</small></button>`).join('')}</div></div>
        <button class="btn gold big" id="cr-go">Swear to ${esc(D.FACTIONS[cs.faction].king)} and begin</button><p class="err" id="pl-err"></p>`;
      body.querySelectorAll('.cr-dbtn').forEach((bt) => (bt.onclick = () => { KR.A.sfx('click'); cs.diff = bt.dataset.diff; body.querySelectorAll('.cr-dbtn').forEach((x) => x.classList.toggle('on', x === bt)); }));
      const inp = $('#cr-name'); inp.oninput = () => { cs.name = inp.value; $('#cr-err').textContent = ''; };
      $('#cr-rand').onclick = () => { cs.name = U.pick(names[cs.gender]) + U.pick(['', 'a', 'en', 'ric', 'wyn', 'dor', 'ix']); inp.value = cs.name; };
      const go = () => {
        const nm = cs.name.trim();
        if (!/^[A-Za-z]{3,14}$/.test(nm)) { $('#cr-err').textContent = 'Use 3 to 14 letters, no spaces or numbers.'; inp.focus(); return; }
        if (G.account.chars.some((c) => c.name.toLowerCase() === nm.toLowerCase())) { $('#cr-err').textContent = 'You already have a hero with that name.'; return; }
        cs.name = nm[0].toUpperCase() + nm.slice(1).toLowerCase(); if (!cs.busy) create();
      };
      $('#cr-go').onclick = go; inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
      setTimeout(() => inp.focus(), 50);
    }
    function pledgeBtns(off) { const b = $('#cr-go'); if (b) b.disabled = off; }
    function create() {
        const name = cs.name;
        cs.busy = true; const c = cs.made || (cs.made = Sys.newChar({ name, faction: cs.faction, race: cs.race, cls: cs.cls, gender: cs.gender, skin: cs.skin, hair: cs.hair, hairStyle: cs.hairStyle, app: cs.app || null, bonus: {} })); // made once, even if joining fails and you pledge again
        { const d = cs.diff || 'normal'; c.diff = d; try { if (KR.War && KR.War.setDifficulty) KR.War.setDifficulty(c, d); else localStorage.setItem('kr_diff_' + c.id, d); } catch (e) {} } // the campaign's difficulty, chosen at the start
        if (!G.account.faction) { G.account.faction = c.faction; Sys.saveAccount && Sys.saveAccount(); } // the kingdom is now chosen for good
        // invited players go back to the Multiplayer screen with their new hero to join the game
        if (INVITED && !inviteFailed && KR.Online && KR.Online.mode === 'solo') {
          const code = KR.Online.cleanCode(new URLSearchParams(location.search).get('join'));
          $('#pl-err').textContent = `Joining game ${code}...`; pledgeBtns(true);
          KR.Online.join(code, '').then(() => { LSs('kr_sel_hero', c.id); return KR.Main.enterWorld(null, c); }).then(() => G.log(`You joined "${KR.Online.name}".`, 'status', '#9ad8ff'))
            .catch((err) => { cs.busy = false; inviteFailed = true; pledgeBtns(false); $('#pl-err').textContent = `${(err && err.message) || err} Pledge again to start on your own; you can join from Multiplayer later.`; });
        }
        else if (window.KR3D && KR.K3cine) KR.Main.enterWorld(null, c, { cine: true }); // 3D: the opening film plays in the real world
        else if (KR.Story) KR.Story.play(c, () => KR.Main.enterWorld(null, c)); else KR.Main.enterWorld(null, c);
    }
  }
  // ---------------- 3D appearance: a live model you can turn, with face, body, hair and marks ----------------
  const SCARS = ['None', 'Cheek slash', 'Blind eye', 'Brow nick', 'Split lip', 'Claw marks', 'Jaw scar'];
  const TATS = ['None', 'Tribal cheek', 'Forehead rune', 'Chin lines', 'Woad', 'Eye band', 'Shoulder tribal', 'Arm bands', 'Chest sigil'];
  const INKS = ['#1e2a5a', '#2a1a14', '#7a1a1a', '#1a4a2a', '#4a2a6a', '#c8a040'];
  const IRIS = ['#5a3a1e', '#3a6aa8', '#4a7a4a', '#7a7a8a', '#b8862a', '#6a3a8a', '#b8302a'];
  const STYLES = ['Short', 'Long', 'Crest', 'Flowing', 'Shaved', 'Buzz', 'Curly', 'Ponytail', 'Bun'];
  const BEARDS = ['Clean', 'Stubble', 'Short', 'Full', 'Long', 'Goatee', 'Moustache'];
  const MORPH = [['nose', 'Nose'], ['jaw', 'Jaw'], ['cheek', 'Cheekbones'], ['eyes', 'Eye size'], ['lips', 'Lips'], ['brow', 'Brow'], ['head', 'Head shape']];
  let apTab = 'body';
  function appearance3D(body, next) {
    const a = cs.app = cs.app || { tall: 0, face: 0, morph: {}, beardStyle: cs.race === 'dwarf' ? 4 : 2, scar: 0, tattoo: 0, tatCol: INKS[0], iris: null };
    const lookNow = () => { try { const c = Sys.newChar({ name: 'Preview', faction: cs.faction, race: cs.race, cls: cs.cls, gender: cs.gender, skin: cs.skin, hair: cs.hair, hairStyle: cs.hairStyle, app: a }); if (apTab !== 'body') delete c.equip.head; /* show the hair and face, not the cap */ return G.lookFor(c); } catch (e) { console.warn(e); return Object.assign({ race: cs.race, gender: cs.gender, skin: S.skinOf(cs.race, cs.skin), hair: S.HAIRS[cs.hair], hairStyle: cs.hairStyle, cls: cs.cls }, a); } };
    const seg = (key, names, cur) => `<div class="seg wrap">${names.map((n, i) => `<button data-${key}="${i}" class="${cur === i ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    const sw = (key, cols, cur, lbl) => `<div class="sw">${cols.map((c, i) => `<button data-${key}="${i}" style="background:${c}" class="${cur === i || cur === c ? 'on' : ''}" aria-label="${lbl} ${i + 1}"></button>`).join('')}</div>`;
    const slider = (key, label, v) => `<div class="opt sl"><label>${label}</label><input type="range" min="-100" max="100" step="5" value="${Math.round((v || 0) * 100)}" data-sl="${key}"><span class="slv">${v > 0.02 ? '+' : ''}${Math.round((v || 0) * 100)}</span></div>`;
    const tabs = [['body', 'Body'], ['face', 'Face'], ['hair', 'Hair'], ['marks', 'Scars & Tattoos']];
    body.innerHTML = `<h2>Your appearance</h2><div class="app app3"><div class="app-prev3"><canvas id="ap-cv3" class="k3-hero"></canvas><div class="ap-cam"><button class="btn small ghost" id="ap-rand">🎲 Surprise me</button><span class="dim small">Drag to turn</span></div></div>
      <div class="app-opts3"><nav class="ap-tabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${apTab === k ? 'on' : ''}">${n}</button>`).join('')}</nav><div class="ap-pane"></div><button class="btn gold big" id="ap-next">Continue</button></div></div>`;
    const view = KR.heroView3D($('#ap-cv3'), { ring: D.CLASSES[cs.cls].color, yaw: 0.25 });
    const refresh = () => view.set(lookNow());
    const pane = $('.ap-pane', body);
    const paint = () => {
      body.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === apTab));
      view.focus(apTab === 'body' ? 'full' : 'face');
      if (apTab === 'body') pane.innerHTML = `<div class="opt"><label>Body</label><div class="seg"><button data-g="m" class="${cs.gender === 'm' ? 'on' : ''}">Male</button><button data-g="f" class="${cs.gender === 'f' ? 'on' : ''}">Female</button></div></div>
        ${slider('tall', 'Height', a.tall)}<div class="opt"><label>Skin</label>${sw('skin', S.skinsFor(cs.race), cs.skin, 'Skin tone')}</div>
        <p class="dim small">You arrive by sea in a sailor's cap, a loose silk shirt, baggy trousers and boots, with your class weapon. What you wear from here on is what you earn.</p>`;
      else if (apTab === 'face') pane.innerHTML = `<div class="opt"><label>Face</label><div class="seg"><button id="ap-fp">◀</button><button class="on" disabled>Face ${a.face + 1}</button><button id="ap-fn">▶</button></div></div>
        ${MORPH.map(([k, n]) => slider(k, n, a.morph[k])).join('')}<div class="opt"><label>Eyes</label>${sw('iris', IRIS, a.iris, 'Eye colour')}</div>`;
      else if (apTab === 'hair') pane.innerHTML = `<div class="opt"><label>Hair colour</label>${sw('hair', S.HAIRS, cs.hair, 'Hair colour')}</div><div class="opt"><label>Hair style</label>${seg('hs', STYLES, cs.hairStyle)}</div>
        ${cs.gender === 'm' ? `<div class="opt"><label>Beard</label>${seg('bd', BEARDS, a.beardStyle)}</div>` : ''}`;
      else pane.innerHTML = `<div class="opt"><label>Scar</label>${seg('sc', SCARS, a.scar)}</div><div class="opt"><label>Tattoo</label>${seg('tt', TATS, a.tattoo)}</div><div class="opt"><label>Ink</label>${sw('ink', INKS, a.tatCol, 'Ink colour')}</div>`;
      const on = (sel, fn) => pane.querySelectorAll(sel).forEach((b) => (b.onclick = () => { KR.A.sfx('click', 0.5); fn(b); paint(); refresh(); }));
      on('[data-g]', (b) => { cs.gender = b.dataset.g; });
      on('[data-skin]', (b) => { cs.skin = +b.dataset.skin; });
      on('[data-hair]', (b) => { cs.hair = +b.dataset.hair; });
      on('[data-hs]', (b) => { cs.hairStyle = +b.dataset.hs; });
      on('[data-bd]', (b) => { a.beardStyle = +b.dataset.bd; });
      on('[data-sc]', (b) => { a.scar = +b.dataset.sc; });
      on('[data-tt]', (b) => { a.tattoo = +b.dataset.tt; });
      on('[data-ink]', (b) => { a.tatCol = INKS[+b.dataset.ink]; });
      on('[data-iris]', (b) => { a.iris = IRIS[+b.dataset.iris]; });
      on('#ap-fp', () => { a.face = (a.face + 19) % 20; }); on('#ap-fn', () => { a.face = (a.face + 1) % 20; });
      pane.querySelectorAll('[data-sl]').forEach((r) => { r.oninput = () => { const v = +r.value / 100, k = r.dataset.sl; if (k === 'tall') a.tall = v; else a.morph[k] = v; r.nextElementSibling.textContent = (v > 0.02 ? '+' : '') + r.value; refresh(); }; });
    };
    body.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { KR.A.sfx('click', 0.5); apTab = b.dataset.tab; paint(); }));
    $('#ap-rand').onclick = () => { const r = Math.random, pick = (n) => Math.floor(r() * n); a.face = pick(20); a.tall = Math.round((r() * 2 - 1) * 20) / 20; MORPH.forEach(([k]) => (a.morph[k] = Math.round((r() * 1.6 - 0.8) * 20) / 20)); cs.skin = pick(S.skinsFor(cs.race).length); cs.hair = pick(S.HAIRS.length); cs.hairStyle = pick(STYLES.length); a.beardStyle = pick(BEARDS.length); a.scar = r() < 0.4 ? 1 + pick(6) : 0; a.tattoo = r() < 0.35 ? 1 + pick(8) : 0; a.tatCol = INKS[pick(INKS.length)]; a.iris = IRIS[pick(IRIS.length)]; paint(); refresh(); };
    $('#ap-next').onclick = () => { view.focus('full'); next(); };
    paint(); refresh();
  }
})();

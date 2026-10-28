// Kingdom Rising — a living scene for each class, painted behind your hero in Choose Hero and during creation
// (flaming skulls in a graveyard for necromancers, an aurora over a totem for shamans, and so on).
// KR.ClassBG.paint(g, w, h, cls, t) fills the whole canvas; everything scales with its size.
(function () {
  const KR = window.KR;
  const TAU = Math.PI * 2;
  // stable pseudo-random numbers, so particles stay put between frames
  const hash = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const fr = (x) => x - Math.floor(x);

  function sky(g, w, h, stops) { const gr = g.createLinearGradient(0, 0, 0, h); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  function glow(g, x, y, r, col, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  function stars(g, w, h, t, n, top) { for (let i = 0; i < n; i++) { const a = 0.35 + 0.55 * Math.abs(Math.sin(t * (0.6 + hash(i, 3)) + i)); g.fillStyle = `rgba(255,255,240,${a})`; const s = 1 + hash(i, 4) * 1.4 * (w / 900 + 0.4); g.fillRect(hash(i, 1) * w, hash(i, 2) * h * top, s, s); } }
  function moon(g, x, y, r, col, halo) { glow(g, x, y, r * 3.2, halo, 0.35); g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  function hills(g, w, h, y0, amp, col, seed, freq = 1) { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w + 8; x += Math.max(4, w / 120)) { const u = x / w; g.lineTo(x, y0 + Math.sin(u * 6.3 * freq + seed) * amp + Math.sin(u * 17 * freq + seed * 2) * amp * 0.35); } g.lineTo(w, h); g.closePath(); g.fill(); }
  function mountains(g, w, h, y0, amp, col, seed) { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); const n = 9; for (let i = 0; i <= n; i++) { const x = (i / n) * w; g.lineTo(x, y0 - (i % 2 ? amp * (0.6 + hash(i, seed) * 0.6) : amp * 0.15 * hash(i, seed + 1))); } g.lineTo(w, h); g.closePath(); g.fill(); }
  function vignette(g, w, h, a = 0.6) { const vg = g.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${a})`); g.fillStyle = vg; g.fillRect(0, 0, w, h); }
  // rising particles (embers, motes, petals...) with a stable layout
  function rise(g, w, h, t, n, col, speed, size, sway = 20, from = 1, fall = false) {
    for (let i = 0; i < n; i++) {
      const ph = fr(t * speed * (0.6 + hash(i, 7) * 0.8) + hash(i, 8)); const y = fall ? ph * h * 1.1 - h * 0.05 : h * from - ph * h * from * 1.05;
      const x = hash(i, 9) * w + Math.sin(t * 1.3 + i) * sway * (w / 900 + 0.3);
      const a = fall ? 0.85 : Math.sin(ph * Math.PI); g.fillStyle = col.replace('A', (a * 0.9).toFixed(2)); const s = size * (0.6 + hash(i, 10)) * (w / 900 + 0.35);
      g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    }
  }
  function tree(g, x, base, ht, col) { g.fillStyle = col; g.beginPath(); g.moveTo(x, base - ht); g.lineTo(x - ht * 0.28, base); g.lineTo(x + ht * 0.28, base); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x, base - ht * 0.8); g.lineTo(x - ht * 0.34, base - ht * 0.25); g.lineTo(x + ht * 0.34, base - ht * 0.25); g.closePath(); g.fill(); }
  function deadTree(g, x, base, ht, col, sc) {
    g.strokeStyle = col; g.lineCap = 'round';
    const br = (x0, y0, ang, len, wd, d) => { const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len; g.lineWidth = wd; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); if (d > 0) { br(x1, y1, ang - 0.5, len * 0.68, wd * 0.62, d - 1); br(x1, y1, ang + 0.42, len * 0.62, wd * 0.6, d - 1); } };
    br(x, base, -Math.PI / 2 + 0.05, ht * 0.42, 6 * sc, 4);
  }

  // a bone skull wreathed in flickering green fire
  function flamingSkull(g, x, y, s, t, i) {
    for (let k = 0; k < 5; k++) {
      const fl = 0.75 + 0.25 * Math.sin(t * 9 + k * 1.7 + i); const fx = x + (k - 2) * s * 0.28 + Math.sin(t * 5 + k + i) * s * 0.08; const fh = s * (1.6 + 0.5 * Math.sin(t * 6 + k * 2 + i)) * fl;
      const gr = g.createLinearGradient(fx, y - s * 0.2, fx, y - s * 0.2 - fh); gr.addColorStop(0, 'rgba(160,255,120,0.9)'); gr.addColorStop(0.5, 'rgba(60,220,90,0.55)'); gr.addColorStop(1, 'rgba(20,120,40,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(fx - s * 0.32, y - s * 0.1); g.quadraticCurveTo(fx - s * 0.2, y - s * 0.2 - fh * 0.6, fx + Math.sin(t * 7 + k) * s * 0.15, y - s * 0.2 - fh); g.quadraticCurveTo(fx + s * 0.2, y - s * 0.2 - fh * 0.6, fx + s * 0.32, y - s * 0.1); g.closePath(); g.fill();
    }
    glow(g, x, y, s * 2.4, '90,255,120', 0.3);
    g.fillStyle = '#e8e2cc'; g.beginPath(); g.ellipse(x, y, s * 0.62, s * 0.56, 0, 0, TAU); g.fill();
    g.fillRect(x - s * 0.34, y + s * 0.28, s * 0.68, s * 0.34);
    g.fillStyle = '#c8c0a4'; for (let k = 0; k < 4; k++) g.fillRect(x - s * 0.3 + k * s * 0.17, y + s * 0.5, s * 0.1, s * 0.16);
    g.fillStyle = '#120c10'; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(x + sx * s * 0.24, y + s * 0.02, s * 0.17, s * 0.2, 0, 0, TAU); g.fill(); }
    g.beginPath(); g.moveTo(x, y + s * 0.18); g.lineTo(x - s * 0.08, y + s * 0.32); g.lineTo(x + s * 0.08, y + s * 0.32); g.closePath(); g.fill();
    const p = 0.6 + 0.4 * Math.sin(t * 4 + i); for (const sx of [-1, 1]) { glow(g, x + sx * s * 0.24, y + s * 0.04, s * 0.22, '140,255,120', p); g.fillStyle = '#d8ffc8'; g.beginPath(); g.arc(x + sx * s * 0.24, y + s * 0.04, s * 0.045, 0, TAU); g.fill(); }
  }
  function note(g, x, y, s, col) { g.fillStyle = col; g.strokeStyle = col; g.lineWidth = Math.max(1, s * 0.14); g.beginPath(); g.ellipse(x, y, s * 0.5, s * 0.36, -0.4, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x + s * 0.45, y - s * 0.1); g.lineTo(x + s * 0.45, y - s * 1.7); g.quadraticCurveTo(x + s * 1.1, y - s * 1.3, x + s * 0.9, y - s * 0.8); g.stroke(); }
  function banner(g, x, top, len, wd, col, trim, t, ph) {
    g.fillStyle = '#4a3a2a'; g.fillRect(x - wd * 0.06, top - wd * 0.3, wd * 0.12, len * 1.9);
    g.fillStyle = col; g.beginPath(); g.moveTo(x, top);
    for (let k = 0; k <= 8; k++) g.lineTo(x + (k / 8) * wd * 1.4, top + Math.sin(t * 2.4 + k * 0.7 + ph) * wd * 0.12);
    for (let k = 8; k >= 0; k--) g.lineTo(x + (k / 8) * wd * 1.4 - (k === 8 ? wd * 0.25 : 0), top + len * (k === 8 ? 0.5 : 1) + Math.sin(t * 2.4 + k * 0.7 + ph) * wd * 0.12);
    g.closePath(); g.fill(); g.strokeStyle = trim; g.lineWidth = Math.max(1, wd * 0.06); g.stroke();
  }

  const S = {
    necromancer(g, w, h, t) {
      sky(g, w, h, ['#05080a', '#0d1a14', '#1a2a1e']); stars(g, w, h, t, 50, 0.5); moon(g, w * 0.8, h * 0.18, Math.min(w, h) * 0.06, '#d8e8c8', '140,200,140');
      hills(g, w, h, h * 0.72, h * 0.03, '#0a120d', 1);
      for (let i = 0; i < 4; i++) deadTree(g, w * (0.06 + i * 0.3 + hash(i, 2) * 0.08), h * 0.76, h * (0.55 + hash(i, 3) * 0.2), '#070a08', w / 900 + 0.4);
      g.fillStyle = '#121a15'; for (let i = 0; i < 9; i++) { const x = (i + 0.5) / 9 * w + (hash(i, 5) - 0.5) * w * 0.05; const tw = w * 0.035, th = h * (0.07 + hash(i, 6) * 0.05), y = h * 0.84 + hash(i, 7) * h * 0.06; g.beginPath(); g.moveTo(x - tw / 2, y); g.lineTo(x - tw / 2, y - th); g.arc(x, y - th, tw / 2, Math.PI, 0); g.lineTo(x + tw / 2, y); g.fill(); if (i % 3 === 1) { g.fillRect(x - tw * 0.08, y - th * 1.9, tw * 0.16, th * 0.8); g.fillRect(x - tw * 0.35, y - th * 1.65, tw * 0.7, tw * 0.16); } }
      g.fillStyle = '#060908'; g.fillRect(0, h * 0.9, w, h * 0.1);
      const s = Math.min(w, h) * 0.055;
      const spots = [[0.14, 0.32], [0.86, 0.42], [0.3, 0.16], [0.72, 0.2], [0.08, 0.6], [0.93, 0.66]];
      spots.forEach(([u, v], i) => flamingSkull(g, w * u + Math.sin(t * 0.7 + i) * w * 0.015, h * v + Math.sin(t * 1.3 + i * 2) * h * 0.02, s * (0.75 + hash(i, 11) * 0.5), t, i));
      for (let i = 0; i < 6; i++) { const x = fr(hash(i, 12) + t * 0.02 * (i % 2 ? 1 : -1)) * w * 1.4 - w * 0.2; glow(g, x, h * (0.86 + hash(i, 13) * 0.08), w * 0.22, '80,200,110', 0.12); }
      rise(g, w, h, t, 24, 'rgba(140,255,140,A)', 0.07, 1.6);
      vignette(g, w, h, 0.7);
    },
    wizard(g, w, h, t) {
      sky(g, w, h, ['#03061a', '#0c1640', '#1c2c68']); stars(g, w, h, t, 110, 0.9);
      mountains(g, w, h, h * 0.84, h * 0.12, '#0a1030', 3);
      const tx = w * 0.82, tb = h * 0.86; g.fillStyle = '#080c22'; g.fillRect(tx - w * 0.035, tb - h * 0.5, w * 0.07, h * 0.5); g.beginPath(); g.moveTo(tx - w * 0.05, tb - h * 0.5); g.lineTo(tx, tb - h * 0.66); g.lineTo(tx + w * 0.05, tb - h * 0.5); g.fill();
      g.fillStyle = `rgba(255,220,140,${0.6 + 0.3 * Math.sin(t * 3)})`; g.fillRect(tx - w * 0.008, tb - h * 0.42, w * 0.016, h * 0.03);
      const cx = w / 2, cy = h * 0.5, R = Math.min(w, h) * 0.34;
      glow(g, cx, cy, R * 1.4, '90,140,255', 0.18);
      g.save(); g.translate(cx, cy); g.rotate(t * 0.15); g.strokeStyle = 'rgba(140,190,255,0.55)'; g.lineWidth = Math.max(1, R * 0.012);
      for (const r of [1, 0.84, 0.5]) { g.beginPath(); g.arc(0, 0, R * r, 0, TAU); g.stroke(); }
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, b = (k + 2) / 6 * TAU; g.moveTo(Math.cos(a) * R * 0.84, Math.sin(a) * R * 0.84); g.lineTo(Math.cos(b) * R * 0.84, Math.sin(b) * R * 0.84); } g.stroke();
      g.fillStyle = 'rgba(170,210,255,0.8)'; g.font = `${Math.max(8, R * 0.09)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗ'; for (let k = 0; k < 20; k++) { const a = k / 20 * TAU; g.save(); g.rotate(a); g.fillText(runes[k], 0, -R * 0.92); g.restore(); }
      g.restore();
      for (let i = 0; i < 7; i++) { const a = t * 0.4 + i / 7 * TAU; const x = cx + Math.cos(a) * R * 1.1, y = cy + Math.sin(a) * R * 0.55 - h * 0.05; glow(g, x, y, Math.min(w, h) * 0.05, '120,180,255', 0.7); g.fillStyle = '#e8f4ff'; g.beginPath(); g.arc(x, y, Math.min(w, h) * 0.008, 0, TAU); g.fill(); }
      rise(g, w, h, t, 30, 'rgba(160,200,255,A)', 0.05, 1.3);
      vignette(g, w, h, 0.6);
    },
    magician(g, w, h, t) {
      sky(g, w, h, ['#140404', '#3a0c06', '#6a1a08']);
      mountains(g, w, h, h * 0.82, h * 0.16, '#1c0604', 5);
      const cx = w / 2, cy = h * 0.84, R = Math.min(w, h) * 0.4;
      glow(g, cx, cy - h * 0.1, R * 1.5, '255,120,40', 0.3);
      g.save(); g.translate(cx, cy); g.scale(1, 0.3); g.rotate(-t * 0.3); g.strokeStyle = 'rgba(255,170,70,0.85)'; g.lineWidth = Math.max(1.5, R * 0.025);
      for (const r of [1, 0.78]) { g.beginPath(); g.arc(0, 0, R * r, 0, TAU); g.stroke(); }
      g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU * 2 - Math.PI / 2; const x = Math.cos(a) * R * 0.78, y = Math.sin(a) * R * 0.78; if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); g.stroke(); g.restore();
      for (let i = 0; i < 5; i++) { const a = t * 0.9 + i / 5 * TAU; const x = cx + Math.cos(a) * R * 0.9, y = h * 0.5 + Math.sin(a) * R * 0.3; const r = Math.min(w, h) * 0.035 * (1 + 0.15 * Math.sin(t * 6 + i));
        glow(g, x, y, r * 3, '255,140,40', 0.55); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.5, '#ffb040'); gr.addColorStop(1, 'rgba(255,80,20,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      rise(g, w, h, t, 60, 'rgba(255,170,70,A)', 0.12, 1.4, 30);
      vignette(g, w, h, 0.6);
    },
    enchanter(g, w, h, t) {
      sky(g, w, h, ['#12061e', '#2a0e46', '#40185a']);
      g.save(); g.translate(w / 2, h * 0.45); for (let k = 0; k < 7; k++) { g.rotate(t * 0.05 + k * 0.9); g.fillStyle = `hsla(${(t * 20 + k * 50) % 360},80%,65%,0.08)`; g.beginPath(); g.ellipse(0, 0, w * 0.6, h * 0.12, 0, 0, TAU); g.fill(); } g.restore();
      for (let i = 0; i < 6; i++) { const x = w * (0.1 + hash(i, 1) * 0.8), y = h * (0.15 + hash(i, 2) * 0.5) + Math.sin(t + i) * h * 0.02, s = Math.min(w, h) * (0.03 + hash(i, 3) * 0.03);
        glow(g, x, y, s * 3, '210,150,255', 0.35); g.fillStyle = `hsla(${280 + hash(i, 4) * 60},80%,${70 + 10 * Math.sin(t * 2 + i)}%,0.85)`; g.beginPath(); g.moveTo(x, y - s * 1.6); g.lineTo(x + s * 0.6, y); g.lineTo(x, y + s * 1.2); g.lineTo(x - s * 0.6, y); g.closePath(); g.fill(); }
      for (let i = 0; i < 8; i++) { const ph = fr(t * 0.05 + hash(i, 5)); const x = w * fr(hash(i, 6) + ph * 0.6), y = h * (0.9 - ph * 0.85) + Math.sin(t * 2 + i) * h * 0.03; const s = Math.min(w, h) * 0.02; const flap = Math.abs(Math.sin(t * 9 + i));
        g.fillStyle = `hsla(${(200 + i * 30) % 360},90%,75%,0.8)`; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(x + sx * s * 0.5 * flap, y, s * 0.6 * flap + 0.5, s * 0.8, sx * 0.4, 0, TAU); g.fill(); } glow(g, x, y, s * 2.5, '230,190,255', 0.3); }
      rise(g, w, h, t, 50, 'rgba(255,220,255,A)', 0.06, 1.1, 25);
      vignette(g, w, h, 0.55);
    },
    cleric(g, w, h, t) {
      sky(g, w, h, ['#3a3a5a', '#8a7a8a', '#e8d8b0']);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 9; k++) { const a = -0.55 + k * 0.14 + Math.sin(t * 0.3 + k) * 0.02; const x0 = w * 0.5; g.fillStyle = `rgba(255,240,190,${0.05 + 0.03 * Math.sin(t + k)})`; g.beginPath(); g.moveTo(x0, -h * 0.05); g.lineTo(x0 + Math.tan(a - 0.05) * h * 1.2, h * 1.1); g.lineTo(x0 + Math.tan(a + 0.05) * h * 1.2, h * 1.1); g.closePath(); g.fill(); }
      g.restore();
      for (let i = 0; i < 5; i++) { const x = fr(hash(i, 1) + t * 0.01) * w * 1.3 - w * 0.15, y = h * (0.12 + hash(i, 2) * 0.2); g.fillStyle = 'rgba(255,250,240,0.35)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + k * w * 0.04, y + Math.sin(k) * h * 0.01, w * 0.045, 0, TAU); g.fill(); } }
      const cx = w / 2, cy = h * 0.34, R = Math.min(w, h) * 0.18; glow(g, cx, cy, R * 2.2, '255,230,170', 0.4);
      g.strokeStyle = 'rgba(90,70,40,0.55)'; g.lineWidth = Math.max(1.5, R * 0.05); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke(); g.beginPath(); g.arc(cx, cy, R * 0.35, 0, TAU); g.stroke();
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.35, cy + Math.sin(a) * R * 0.35); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke(); g.fillStyle = `hsla(${k * 30},70%,70%,0.35)`; g.beginPath(); g.arc(cx + Math.cos(a + 0.26) * R * 0.7, cy + Math.sin(a + 0.26) * R * 0.7, R * 0.14, 0, TAU); g.fill(); }
      g.fillStyle = '#5a4a3e'; g.fillRect(0, h * 0.86, w, h * 0.14); for (const u of [0.12, 0.88]) { g.fillStyle = '#6a5a4a'; g.fillRect(w * u - w * 0.03, h * 0.3, w * 0.06, h * 0.56); }
      rise(g, w, h, t, 40, 'rgba(255,245,200,A)', 0.04, 1.6, 15);
      vignette(g, w, h, 0.45);
    },
    paladin(g, w, h, t) {
      sky(g, w, h, ['#3a4a8a', '#c88a5a', '#f8d888']); const sx = w / 2, sy = h * 0.68;
      g.save(); g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI + Math.PI + t * 0.02; g.fillStyle = 'rgba(255,220,140,0.07)'; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a - 0.04) * w, sy + Math.sin(a - 0.04) * w); g.lineTo(sx + Math.cos(a + 0.04) * w, sy + Math.sin(a + 0.04) * w); g.closePath(); g.fill(); } g.restore();
      glow(g, sx, sy, Math.min(w, h) * 0.3, '255,230,150', 0.8); g.fillStyle = '#fff3c8'; g.beginPath(); g.arc(sx, sy, Math.min(w, h) * 0.08, 0, TAU); g.fill();
      hills(g, w, h, h * 0.74, h * 0.03, '#4a4a3a', 2); hills(g, w, h, h * 0.84, h * 0.025, '#2a2a22', 4);
      const bw = Math.min(w, h) * 0.07; banner(g, w * 0.1, h * 0.28, h * 0.28, bw, '#e9e3cf', '#e0b84a', t, 0); banner(g, w * 0.8, h * 0.3, h * 0.28, bw, '#e9e3cf', '#e0b84a', t, 2);
      const cx = w / 2, cy = h * 0.34, L = Math.min(w, h) * 0.22; glow(g, cx, cy, L, '255,240,180', 0.5 + 0.2 * Math.sin(t * 2));
      g.fillStyle = 'rgba(255,240,190,0.85)'; g.fillRect(cx - L * 0.04, cy - L * 0.55, L * 0.08, L * 1.1); g.fillRect(cx - L * 0.28, cy - L * 0.18, L * 0.56, L * 0.07); g.beginPath(); g.moveTo(cx - L * 0.04, cy + L * 0.55); g.lineTo(cx, cy + L * 0.7); g.lineTo(cx + L * 0.04, cy + L * 0.55); g.fill();
      rise(g, w, h, t, 30, 'rgba(255,240,180,A)', 0.05, 1.4);
      vignette(g, w, h, 0.45);
    },
    shadowknight(g, w, h, t) {
      sky(g, w, h, ['#0a0204', '#2a060a', '#3a0a0c']); const mx = w * 0.7, my = h * 0.26, mr = Math.min(w, h) * 0.12;
      glow(g, mx, my, mr * 3.5, '200,20,20', 0.4); g.fillStyle = '#b8201c'; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill(); g.fillStyle = 'rgba(80,0,0,0.4)'; g.beginPath(); g.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.25, 0, TAU); g.fill();
      g.fillStyle = '#050203'; const cx = w * 0.3, base = h * 0.82;
      for (const [u, ht, wd] of [[-0.12, 0.42, 0.05], [-0.04, 0.6, 0.06], [0.05, 0.5, 0.05], [0.13, 0.36, 0.045]]) { const x = cx + u * w; g.fillRect(x - wd * w / 2, base - ht * h, wd * w, ht * h); g.beginPath(); g.moveTo(x - wd * w * 0.7, base - ht * h); g.lineTo(x, base - ht * h - h * 0.12); g.lineTo(x + wd * w * 0.7, base - ht * h); g.fill(); }
      g.fillRect(cx - w * 0.15, base - h * 0.22, w * 0.3, h * 0.22);
      for (let i = 0; i < 5; i++) { const x = fr(hash(i, 1) + t * 0.015 * (1 + hash(i, 2))) * w * 1.4 - w * 0.2, y = h * (0.6 + hash(i, 3) * 0.35); const r = w * (0.1 + hash(i, 4) * 0.07); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(10,4,6,0.55)'); gr.addColorStop(1, 'rgba(10,4,6,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
      g.fillStyle = '#030102'; g.fillRect(0, h * 0.88, w, h * 0.12);
      rise(g, w, h, t, 45, 'rgba(255,60,40,A)', 0.1, 1.3, 25);
      vignette(g, w, h, 0.7);
    },
    warrior(g, w, h, t) {
      sky(g, w, h, ['#2a1a2a', '#8a3a1e', '#e8803a']); glow(g, w * 0.5, h * 0.72, Math.min(w, h) * 0.4, '255,150,60', 0.5);
      hills(g, w, h, h * 0.72, h * 0.04, '#3a1e14', 1); hills(g, w, h, h * 0.82, h * 0.03, '#1e100a', 3);
      g.strokeStyle = '#140a06'; g.lineCap = 'round';
      for (let i = 0; i < 14; i++) { const x = (i + 0.5) / 14 * w + (hash(i, 1) - 0.5) * w * 0.04; const y = h * (0.86 + hash(i, 2) * 0.08); const L = h * (0.1 + hash(i, 3) * 0.08); const a = (hash(i, 4) - 0.5) * 0.6; g.lineWidth = Math.max(1.5, w * 0.004); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * L, y - Math.cos(a) * L); g.stroke(); if (i % 2 === 0) { g.beginPath(); g.moveTo(x + Math.sin(a) * L * 0.7 - L * 0.12, y - Math.cos(a) * L * 0.7); g.lineTo(x + Math.sin(a) * L * 0.7 + L * 0.12, y - Math.cos(a) * L * 0.7); g.stroke(); } }
      const bw = Math.min(w, h) * 0.06; banner(g, w * 0.12, h * 0.42, h * 0.2, bw, '#7a1a14', '#2a0a06', t, 1); banner(g, w * 0.82, h * 0.46, h * 0.18, bw, '#5a1a10', '#2a0a06', t, 3);
      for (let i = 0; i < 7; i++) { const x = fr(hash(i, 6) + t * 0.01) * w, y = h * (0.45 + hash(i, 7) * 0.3) - fr(t * 0.05 + hash(i, 8)) * h * 0.2; glow(g, x, y, w * 0.12, '60,40,40', 0.25); }
      rise(g, w, h, t, 55, 'rgba(255,170,80,A)', 0.11, 1.3, 30);
      vignette(g, w, h, 0.6);
    },
    ranger(g, w, h, t) {
      sky(g, w, h, ['#1a2a4a', '#5a6a6a', '#d8a868']); moon(g, w * 0.22, h * 0.2, Math.min(w, h) * 0.05, '#f8f0d8', '255,240,200');
      for (const [k, col, y0] of [[0, '#2a3a32', 0.68], [1, '#1a2a22', 0.76], [2, '#0e1a14', 0.86]]) for (let i = 0; i < 12 + k * 3; i++) tree(g, (i + hash(i, k + 1) * 0.6) / (12 + k * 3) * w * 1.05, h * y0 + h * 0.05, h * (0.24 + k * 0.08 + hash(i, k + 4) * 0.1), col);
      g.fillStyle = '#0a1410'; g.fillRect(0, h * 0.9, w, h * 0.1);
      for (let i = 0; i < 22; i++) { const ph = fr(t * 0.06 * (0.6 + hash(i, 5)) + hash(i, 6)); const x = w * fr(hash(i, 7) + ph * 0.3) + Math.sin(t * 2 + i) * w * 0.02; const y = ph * h; const s = Math.min(w, h) * 0.008; g.save(); g.translate(x, y); g.rotate(t * 2 + i); g.fillStyle = ['#c87a2a', '#a8582a', '#d8a83a'][i % 3]; g.beginPath(); g.ellipse(0, 0, s * 1.6, s * 0.8, 0, 0, TAU); g.fill(); g.restore(); }
      for (let i = 0; i < 14; i++) { const x = w * hash(i, 8) + Math.sin(t * 0.7 + i) * w * 0.03, y = h * (0.55 + hash(i, 9) * 0.35) + Math.cos(t * 0.9 + i) * h * 0.02; glow(g, x, y, Math.min(w, h) * 0.02, '220,255,120', 0.5 + 0.5 * Math.sin(t * 3 + i * 2)); }
      vignette(g, w, h, 0.55);
    },
    druid(g, w, h, t) {
      sky(g, w, h, ['#0a1a14', '#16302a', '#2a4a2a']); glow(g, w / 2, h * 0.45, Math.min(w, h) * 0.6, '120,220,120', 0.18);
      const cx = w / 2, base = h * 0.92, tw = w * 0.16;
      g.fillStyle = '#1a140e'; g.beginPath(); g.moveTo(cx - tw * 0.9, base); g.quadraticCurveTo(cx - tw * 0.3, h * 0.6, cx - tw * 0.35, h * 0.25); g.lineTo(cx + tw * 0.35, h * 0.25); g.quadraticCurveTo(cx + tw * 0.3, h * 0.6, cx + tw * 0.9, base); g.closePath(); g.fill();
      for (let k = 0; k < 7; k++) { g.fillStyle = ['#183a1e', '#21502a', '#2c6434'][k % 3]; g.beginPath(); g.arc(cx + Math.sin(k * 1.9) * w * 0.25, h * (0.1 + (k % 3) * 0.07), Math.min(w, h) * (0.16 + hash(k, 1) * 0.06), 0, TAU); g.fill(); }
      const rg = 0.5 + 0.5 * Math.sin(t * 1.5); g.fillStyle = `rgba(140,255,140,${0.4 + 0.5 * rg})`; g.font = `${Math.max(8, tw * 0.22)}px serif`; g.textAlign = 'center'; for (let k = 0; k < 4; k++) { glow(g, cx, h * (0.42 + k * 0.11), tw * 0.3, '120,255,120', 0.25 * rg); g.fillText('ᚠᛟᛉᚱ'[k], cx, h * (0.45 + k * 0.11)); }
      g.strokeStyle = '#2a5a2a'; g.lineWidth = Math.max(1, w * 0.004); for (let k = 0; k < 6; k++) { const x0 = w * (k < 3 ? 0.02 : 0.98); g.beginPath(); g.moveTo(x0, 0); for (let s = 1; s <= 10; s++) g.lineTo(x0 + Math.sin(s + k + t * 0.6) * w * 0.02 + (k < 3 ? 1 : -1) * k % 3 * w * 0.03, s / 10 * h * (0.4 + (k % 3) * 0.15)); g.stroke(); }
      g.fillStyle = '#0a1a0e'; g.fillRect(0, base, w, h - base);
      for (let i = 0; i < 18; i++) { const x = w * hash(i, 3) + Math.sin(t * 0.6 + i) * w * 0.03, y = h * (0.3 + hash(i, 4) * 0.6) + Math.cos(t * 0.8 + i) * h * 0.02; glow(g, x, y, Math.min(w, h) * 0.02, '200,255,120', 0.5 + 0.5 * Math.sin(t * 3 + i)); }
      rise(g, w, h, t, 14, 'rgba(120,200,80,A)', 0.05, 2, 30, 1, true);
      vignette(g, w, h, 0.6);
    },
    monk(g, w, h, t) {
      sky(g, w, h, ['#4a3a6a', '#d88a9a', '#f8c8a0']); glow(g, w * 0.5, h * 0.55, Math.min(w, h) * 0.35, '255,200,170', 0.5);
      mountains(g, w, h, h * 0.62, h * 0.24, 'rgba(110,80,120,0.7)', 2); mountains(g, w, h, h * 0.74, h * 0.18, 'rgba(70,50,90,0.85)', 6);
      for (let i = 0; i < 4; i++) { const y = h * (0.6 + i * 0.07) + Math.sin(t * 0.3 + i) * h * 0.01; g.fillStyle = 'rgba(255,230,230,0.12)'; g.fillRect(0, y, w, h * 0.04); }
      const px = w * 0.78, pb = h * 0.82, pw = w * 0.1; g.fillStyle = '#2a1820'; for (let k = 0; k < 4; k++) { const y = pb - k * h * 0.09, wd = pw * (1 - k * 0.18); g.fillRect(px - wd * 0.35, y - h * 0.07, wd * 0.7, h * 0.07); g.beginPath(); g.moveTo(px - wd * 0.75, y - h * 0.06); g.quadraticCurveTo(px, y - h * 0.11, px + wd * 0.75, y - h * 0.06); g.lineTo(px + wd * 0.5, y - h * 0.08); g.lineTo(px - wd * 0.5, y - h * 0.08); g.fill(); }
      g.fillStyle = '#1e1218'; g.fillRect(0, h * 0.86, w, h * 0.14);
      g.strokeStyle = '#2a1a1e'; g.lineWidth = Math.max(2, w * 0.006); g.beginPath(); g.moveTo(0, h * 0.2); g.quadraticCurveTo(w * 0.15, h * 0.24, w * 0.24, h * 0.36); g.stroke();
      for (let k = 0; k < 9; k++) { g.fillStyle = 'rgba(255,170,200,0.75)'; g.beginPath(); g.arc(w * (0.04 + k * 0.025), h * (0.21 + Math.sin(k) * 0.03 + k * 0.016), Math.min(w, h) * 0.018, 0, TAU); g.fill(); }
      for (let i = 0; i < 26; i++) { const ph = fr(t * 0.05 * (0.6 + hash(i, 1)) + hash(i, 2)); const x = w * fr(hash(i, 3) + ph * 0.5) + Math.sin(t * 1.5 + i) * w * 0.02, y = ph * h; const s = Math.min(w, h) * 0.007; g.save(); g.translate(x, y); g.rotate(t * 1.5 + i); g.fillStyle = 'rgba(255,190,210,0.9)'; g.beginPath(); g.ellipse(0, 0, s * 1.5, s * 0.8, 0, 0, TAU); g.fill(); g.restore(); }
      vignette(g, w, h, 0.45);
    },
    bard(g, w, h, t) {
      sky(g, w, h, ['#140a14', '#2a1420', '#3a1e1a']);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) { const a = Math.sin(t * 0.6 + k * 2.1) * 0.35; const x0 = w * (0.2 + k * 0.3); const col = ['255,200,120', '255,140,180', '160,200,255'][k]; g.fillStyle = `rgba(${col},0.13)`; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + Math.tan(a - 0.12) * h, h); g.lineTo(x0 + Math.tan(a + 0.12) * h, h); g.closePath(); g.fill(); glow(g, x0 + Math.tan(a) * h * 0.92, h * 0.92, w * 0.12, col, 0.25); }
      g.restore();
      for (let r = 0; r < 2; r++) { const y0 = h * (0.08 + r * 0.1); g.strokeStyle = '#3a2a1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y0); g.quadraticCurveTo(w / 2, y0 + h * 0.06, w, y0); g.stroke();
        for (let k = 0; k < 14; k++) { const u = (k + 0.5) / 14; const x = u * w, y = y0 + Math.sin(u * Math.PI) * h * 0.03 + Math.sin(t * 2 + k) * 1.5; g.fillStyle = ['#c83a2a', '#e8c04a', '#3a6ac8', '#3a9a4a'][(k + r) % 4]; g.beginPath(); g.moveTo(x - w * 0.025, y); g.lineTo(x + w * 0.025, y); g.lineTo(x, y + h * 0.05); g.closePath(); g.fill(); } }
      g.fillStyle = '#2a1a10'; g.fillRect(0, h * 0.86, w, h * 0.14); g.fillStyle = '#4a2e18'; g.fillRect(0, h * 0.86, w, h * 0.012);
      for (let i = 0; i < 12; i++) { const ph = fr(t * 0.08 * (0.6 + hash(i, 1)) + hash(i, 2)); const x = w * hash(i, 3) + Math.sin(t * 1.4 + i) * w * 0.04, y = h * 0.85 - ph * h * 0.75; g.globalAlpha = Math.sin(ph * Math.PI); note(g, x, y, Math.min(w, h) * (0.02 + hash(i, 4) * 0.015), ['#ffe08a', '#ffb0c8', '#b8d8ff'][i % 3]); g.globalAlpha = 1; }
      vignette(g, w, h, 0.55);
    },
    rogue(g, w, h, t) {
      sky(g, w, h, ['#04060c', '#0c1424', '#1a2436']); stars(g, w, h, t, 60, 0.6); moon(g, w * 0.3, h * 0.24, Math.min(w, h) * 0.13, '#e8ecf0', '200,210,230');
      const roofs = (y0, col, seed) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); let x = 0, i = 0; while (x < w) { const rw = w * (0.08 + hash(i, seed) * 0.08), rh = h * (0.08 + hash(i, seed + 1) * 0.1); g.lineTo(x, y0); g.lineTo(x + rw / 2, y0 - rh); g.lineTo(x + rw, y0); if (hash(i, seed + 2) > 0.5) { g.lineTo(x + rw * 0.7, y0); g.lineTo(x + rw * 0.7, y0 - rh * 1.2); g.lineTo(x + rw * 0.8, y0 - rh * 1.2); g.lineTo(x + rw * 0.8, y0); } x += rw; i++; } g.lineTo(w, h); g.closePath(); g.fill(); };
      roofs(h * 0.7, '#0c1220', 2); roofs(h * 0.82, '#070a12', 7);
      for (let i = 0; i < 9; i++) { const x = w * hash(i, 11), y = h * (0.74 + hash(i, 12) * 0.12); const on = hash(i, 13) > 0.3 || Math.sin(t * 0.5 + i) > 0.6; if (on) { g.fillStyle = 'rgba(255,200,110,0.85)'; g.fillRect(x, y, w * 0.012, h * 0.022); glow(g, x, y, w * 0.03, '255,190,100', 0.3); } }
      for (let i = 0; i < 5; i++) { const x = fr(hash(i, 14) + t * 0.012) * w * 1.6 - w * 0.3; glow(g, x, h * (0.78 + hash(i, 15) * 0.15), w * 0.25, '120,140,170', 0.12); }
      for (let i = 0; i < 4; i++) { const p = fr(t * 0.2 + hash(i, 16)); if (p < 0.15) { const x = w * hash(i, 17), y = h * (0.3 + hash(i, 18) * 0.4); const a = Math.sin(p / 0.15 * Math.PI); g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 1; const s = Math.min(w, h) * 0.03; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke(); } }
      vignette(g, w, h, 0.65);
    },
    shaman(g, w, h, t) {
      sky(g, w, h, ['#020814', '#061428', '#0a1e2a']); stars(g, w, h, t, 70, 0.7);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 3; b++) { g.beginPath(); for (let x = 0; x <= w; x += Math.max(4, w / 100)) { const u = x / w; const y = h * (0.22 + b * 0.06) + Math.sin(u * 5 + t * 0.5 + b) * h * 0.06 + Math.sin(u * 13 - t * 0.8) * h * 0.015; if (x) g.lineTo(x, y); else g.moveTo(x, y); } for (let x = w; x >= 0; x -= Math.max(4, w / 100)) { const u = x / w; g.lineTo(x, h * (0.22 + b * 0.06) + Math.sin(u * 5 + t * 0.5 + b) * h * 0.06 - h * (0.12 + 0.04 * Math.sin(u * 7 + t))); }
        const gr = g.createLinearGradient(0, h * 0.05, 0, h * 0.45); gr.addColorStop(0, 'rgba(120,80,255,0)'); gr.addColorStop(0.5, `rgba(${b === 1 ? '80,255,190' : '60,220,160'},0.22)`); gr.addColorStop(1, 'rgba(40,255,140,0)'); g.fillStyle = gr; g.fill(); }
      g.restore();
      hills(g, w, h, h * 0.8, h * 0.02, '#c8d8e8', 1); hills(g, w, h, h * 0.86, h * 0.015, '#9ab0c4', 3);
      const tx = w * 0.18, tb = h * 0.84, tw = w * 0.05; g.fillStyle = '#1a1210'; g.fillRect(tx - tw / 2, tb - h * 0.5, tw, h * 0.5);
      for (let k = 0; k < 4; k++) { const y = tb - h * (0.12 + k * 0.11); g.fillStyle = ['#7a2a1a', '#2a5a7a', '#c8a03a', '#3a7a4a'][k]; g.fillRect(tx - tw * 0.6, y - h * 0.04, tw * 1.2, h * 0.07); g.fillStyle = '#f0e0c0'; g.fillRect(tx - tw * 0.3, y - h * 0.02, tw * 0.15, h * 0.015); g.fillRect(tx + tw * 0.15, y - h * 0.02, tw * 0.15, h * 0.015); }
      g.fillStyle = '#1a1210'; g.beginPath(); g.moveTo(tx - tw * 1.8, tb - h * 0.5); g.lineTo(tx, tb - h * 0.46); g.lineTo(tx + tw * 1.8, tb - h * 0.5); g.lineTo(tx, tb - h * 0.53); g.fill();
      for (let i = 0; i < 8; i++) { const a = t * 0.8 + i / 8 * TAU; const r = Math.min(w, h) * (0.12 + 0.06 * Math.sin(t + i)); const x = w * 0.55 + Math.cos(a) * r * 1.6, y = h * 0.5 + Math.sin(a) * r * 0.6 - fr(t * 0.1 + i / 8) * h * 0.2; glow(g, x, y, Math.min(w, h) * 0.04, '120,255,220', 0.6); }
      vignette(g, w, h, 0.6);
    },
    beastlord(g, w, h, t) {
      sky(g, w, h, ['#060814', '#141a30', '#2a2a40']); stars(g, w, h, t, 60, 0.6);
      const mx = w * 0.62, my = h * 0.3, mr = Math.min(w, h) * 0.18; moon(g, mx, my, mr, '#f0ecd8', '240,230,200');
      g.fillStyle = 'rgba(200,190,160,0.25)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(mx + Math.cos(k * 2) * mr * 0.4, my + Math.sin(k * 3) * mr * 0.35, mr * 0.12, 0, TAU); g.fill(); }
      g.fillStyle = '#05060a'; const rx = w * 0.6, ry = h * 0.66; g.beginPath(); g.moveTo(rx - w * 0.22, h); g.lineTo(rx - w * 0.12, ry); g.lineTo(rx + w * 0.06, ry - h * 0.02); g.lineTo(rx + w * 0.18, h); g.fill();
      const s = Math.min(w, h) * 0.0011, wx = rx - w * 0.02, wy = ry; g.save(); g.translate(wx, wy); g.scale(s * 100, s * 100);
      g.beginPath(); g.moveTo(-0.5, 0); g.lineTo(-0.45, -0.25); g.lineTo(-0.2, -0.35); g.lineTo(0.15, -0.38); g.lineTo(0.28, -0.6); g.lineTo(0.33, -0.95); g.lineTo(0.36, -0.75); g.lineTo(0.42, -0.85); g.lineTo(0.42, -0.62); g.lineTo(0.55, -0.88); g.lineTo(0.48, -0.55); g.lineTo(0.38, -0.4); g.lineTo(0.35, 0); g.lineTo(0.25, 0); g.lineTo(0.22, -0.2); g.lineTo(-0.2, -0.2); g.lineTo(-0.3, 0); g.lineTo(-0.38, 0); g.lineTo(-0.38, -0.18); g.lineTo(-0.62, -0.3 + Math.sin(t * 2) * 0.03); g.lineTo(-0.5, -0.15); g.closePath(); g.fill(); g.restore();
      hills(g, w, h, h * 0.84, h * 0.03, '#04050a', 4);
      for (let i = 0; i < 6; i++) { const x = w * (0.05 + hash(i, 1) * 0.9), y = h * (0.86 + hash(i, 2) * 0.08); const blink = Math.sin(t * 0.7 + i * 3) > -0.85 ? 1 : 0; if (!blink || Math.abs(x - rx) < w * 0.12) continue; for (const sx of [-1, 1]) { glow(g, x + sx * w * 0.008, y, w * 0.012, '255,200,60', 0.9); } }
      vignette(g, w, h, 0.6);
    },
    berserker(g, w, h, t) {
      const flash = Math.max(0, 1 - fr(t * 0.37) * 9) * (hash(Math.floor(t * 0.37), 1) > 0.3 ? 1 : 0);
      sky(g, w, h, ['#0a0606', '#1e0e0e', '#2a1414']); if (flash) { g.fillStyle = `rgba(255,80,60,${flash * 0.35})`; g.fillRect(0, 0, w, h); }
      if (flash) { g.strokeStyle = `rgba(255,${180 + flash * 70},${150 + flash * 80},${flash})`; g.lineWidth = Math.max(2, w * 0.004); g.beginPath(); let x = w * (0.2 + hash(Math.floor(t * 0.37), 2) * 0.6), y = 0; g.moveTo(x, y); while (y < h * 0.62) { x += (hash(y, 3) - 0.5) * w * 0.08; y += h * 0.06; g.lineTo(x, y); } g.stroke(); glow(g, x, y, w * 0.2, '255,90,60', flash * 0.6); }
      mountains(g, w, h, h * 0.7, h * 0.3, '#160a0a', 9); mountains(g, w, h, h * 0.8, h * 0.18, '#0c0606', 12);
      const gr = g.createLinearGradient(0, h * 0.75, 0, h); gr.addColorStop(0, 'rgba(255,40,20,0)'); gr.addColorStop(1, `rgba(255,50,20,${0.45 + 0.15 * Math.sin(t * 2)})`); g.fillStyle = gr; g.fillRect(0, h * 0.75, w, h * 0.25);
      g.strokeStyle = 'rgba(180,190,220,0.35)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i < 70; i++) { const x = fr(hash(i, 5) + t * 0.08) * w, y = fr(hash(i, 6) + t * 1.4) * h; g.moveTo(x, y); g.lineTo(x - w * 0.006, y + h * 0.04); } g.stroke();
      rise(g, w, h, t, 30, 'rgba(255,90,50,A)', 0.12, 1.3, 30);
      vignette(g, w, h, 0.65);
    },
    // a dawn battle line: muzzle flashes along a field, powder smoke drifting, a banner on the rise
    arquebusier(g, w, h, t) {
      sky(g, w, h, ['#1a1612', '#4a3a2a', '#a07040', '#d8a060']);
      glow(g, w * 0.7, h * 0.62, Math.max(w, h) * 0.4, '255,190,110', 0.35);
      hills(g, w, h, h * 0.66, h * 0.05, '#2a2018', 3); hills(g, w, h, h * 0.76, h * 0.03, '#1a140e', 6);
      // a rank of musketeers in silhouette, firing in turn
      const n = 9, base = h * 0.8, sc = Math.min(w, h) * 0.0016;
      for (let i = 0; i < n; i++) {
        const x = w * (0.08 + i * 0.105), fire = fr(t * 0.45 + i * 0.137) < 0.05;
        g.save(); g.translate(x, base); g.scale(sc * 100, sc * 100); g.fillStyle = '#0c0906';
        g.beginPath(); g.ellipse(0, -0.62, 0.07, 0.08, 0, 0, TAU); g.fill(); // head
        g.beginPath(); g.moveTo(-0.13, -0.66); g.lineTo(0.14, -0.66); g.lineTo(0.05, -0.74); g.lineTo(-0.05, -0.74); g.fill(); // brimmed hat
        g.fillRect(-0.08, -0.54, 0.16, 0.3); g.fillRect(-0.07, -0.24, 0.05, 0.24); g.fillRect(0.02, -0.24, 0.05, 0.24); // body and legs
        g.save(); g.translate(0.02, -0.5); g.rotate(-0.08); g.fillRect(0, -0.02, 0.62, 0.035); g.restore(); // the arquebus levelled
        g.restore();
        if (fire) { const mx = x + 0.62 * sc * 100, my = base - 0.52 * sc * 100; glow(g, mx, my, w * 0.03, '255,230,150', 0.95); }
        // a smoke puff that drifts and grows after each shot
        const ph = fr(t * 0.45 + i * 0.137); const sx = x + 0.62 * sc * 100 + ph * w * 0.06, sy = base - 0.52 * sc * 100 - ph * h * 0.05, sr = w * (0.012 + ph * 0.05);
        const gr = g.createRadialGradient(sx, sy, 0, sx, sy, sr); gr.addColorStop(0, `rgba(210,200,185,${0.55 * (1 - ph)})`); gr.addColorStop(1, 'rgba(210,200,185,0)'); g.fillStyle = gr; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
      }
      // the Valen banner on the rise
      const bx = w * 0.86, by = h * 0.5; g.fillStyle = '#100c08'; g.fillRect(bx, by, w * 0.004, h * 0.3);
      g.fillStyle = '#7a1a1a'; g.beginPath(); g.moveTo(bx, by); for (let k = 0; k <= 8; k++) g.lineTo(bx + (k / 8) * w * 0.07, by + Math.sin(t * 3 + k) * h * 0.006); g.lineTo(bx + w * 0.07, by + h * 0.05); g.lineTo(bx, by + h * 0.05); g.fill();
      rise(g, w, h, t, 30, 'rgba(220,210,190,A)', 0.03, 2.6, 60, 0.9);
      vignette(g, w, h, 0.6);
    },
    // a mossy forest at dusk, fireflies, and the great shape of a troll among the trees
    trollcaller(g, w, h, t) {
      sky(g, w, h, ['#06100a', '#0e2214', '#1e3a20', '#2a4a24']);
      for (let i = 0; i < 6; i++) tree(g, w * (0.02 + i * 0.19 + hash(i, 1) * 0.05), h * 0.86, h * (0.5 + hash(i, 2) * 0.3), '#0a1a0e');
      // the troll: hunched, long-armed, eyes catching the light
      const tx = w * 0.56, ty = h * 0.86, s = Math.min(w, h) * 0.0042, br = Math.sin(t * 0.9) * 0.02;
      g.save(); g.translate(tx, ty); g.scale(s * 100, s * 100); g.fillStyle = '#071008';
      g.beginPath(); g.moveTo(-0.55, 0); g.quadraticCurveTo(-0.62, -0.6, -0.35, -0.95 - br); g.quadraticCurveTo(0, -1.25 - br, 0.32, -0.98 - br); g.quadraticCurveTo(0.62, -0.62, 0.55, 0); g.fill(); // hunched back
      g.beginPath(); g.ellipse(0.02, -1.08 - br, 0.2, 0.17, 0, 0, TAU); g.fill(); // head
      g.beginPath(); g.moveTo(-0.45, -0.75); g.quadraticCurveTo(-0.85, -0.4, -0.78, 0.02); g.lineTo(-0.62, 0.02); g.quadraticCurveTo(-0.62, -0.4, -0.3, -0.7); g.fill(); // long arms
      g.beginPath(); g.moveTo(0.45, -0.75); g.quadraticCurveTo(0.85, -0.4, 0.8, 0.02); g.lineTo(0.64, 0.02); g.quadraticCurveTo(0.64, -0.4, 0.3, -0.7); g.fill();
      g.restore();
      const blink = Math.sin(t * 0.5) > -0.92; if (blink) for (const ex of [-0.07, 0.09]) glow(g, tx + ex * s * 100, ty - (1.1 + br) * s * 100, w * 0.012, '200,255,120', 0.95);
      hills(g, w, h, h * 0.86, h * 0.025, '#040a05', 5);
      // fireflies and drifting spores
      for (let i = 0; i < 40; i++) { const x = w * fr(hash(i, 3) + Math.sin(t * 0.2 + i) * 0.02), y = h * (0.35 + hash(i, 4) * 0.5) + Math.sin(t * 0.8 + i * 2) * h * 0.02; const a = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7); if (a > 0.3) glow(g, x, y, w * 0.008, '210,255,130', a * 0.8); }
      rise(g, w, h, t, 25, 'rgba(160,220,120,A)', 0.04, 1.2, 40, 0.9);
      vignette(g, w, h, 0.62);
    },
    // the title screen: the kingdom burns while the brothers fight over the crown
    burning(g, w, h, t) {
      sky(g, w, h, ['#08040a', '#2a0a08', '#6a1e0a', '#b8461a']); stars(g, w, h, t, 30, 0.35);
      glow(g, w * 0.5, h * 0.8, Math.max(w, h) * 0.55, '255,110,30', 0.35 + 0.05 * Math.sin(t * 1.7));
      // smoke columns lit from below
      for (let i = 0; i < 6; i++) { const x0 = w * (0.1 + i * 0.16 + hash(i, 1) * 0.05); for (let k = 0; k < 7; k++) { const ph = fr(t * 0.04 + k / 7 + hash(i, 2)); const y = h * 0.62 - ph * h * 0.7; const r = w * (0.04 + ph * 0.09); const x = x0 + Math.sin(ph * 4 + i + t * 0.3) * w * 0.04 + ph * w * 0.06;
        const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${Math.round(60 + 60 * (1 - ph))},${Math.round(30 + 20 * (1 - ph))},26,${0.5 * (1 - ph)})`); gr.addColorStop(1, 'rgba(20,10,10,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } }
      mountains(g, w, h, h * 0.62, h * 0.12, '#1a0806', 4);
      // the city: walls, houses, towers and the castle keep, black against the fire
      const base = h * 0.8; g.fillStyle = '#0c0405';
      const keep = (x, wd, ht) => { g.fillRect(x - wd / 2, base - ht, wd, ht); for (let k = 0; k < 4; k++) g.fillRect(x - wd / 2 + k * wd / 3.5, base - ht - wd * 0.12, wd / 7, wd * 0.12); };
      const spire = (x, wd, ht) => { g.fillRect(x - wd / 2, base - ht, wd, ht); g.beginPath(); g.moveTo(x - wd * 0.7, base - ht); g.lineTo(x, base - ht - wd * 1.6); g.lineTo(x + wd * 0.7, base - ht); g.fill(); };
      keep(w * 0.5, w * 0.16, h * 0.3); spire(w * 0.43, w * 0.04, h * 0.42); spire(w * 0.57, w * 0.04, h * 0.42); spire(w * 0.5, w * 0.05, h * 0.5);
      for (let i = 0; i < 16; i++) { const x = (i + 0.5) / 16 * w; if (Math.abs(x - w * 0.5) < w * 0.12) continue; const hw = w * (0.035 + hash(i, 3) * 0.02), hh = h * (0.06 + hash(i, 4) * 0.06); g.fillRect(x - hw / 2, base - hh, hw, hh); g.beginPath(); g.moveTo(x - hw * 0.65, base - hh); g.lineTo(x, base - hh - hw * 0.7); g.lineTo(x + hw * 0.65, base - hh); g.fill(); if (i % 4 === 1) spire(x + hw * 0.6, w * 0.022, h * (0.2 + hash(i, 5) * 0.08)); }
      keep(w * 0.05, w * 0.06, h * 0.16); keep(w * 0.95, w * 0.06, h * 0.16); g.fillRect(0, base - h * 0.08, w, h * 0.08); for (let x = 0; x < w; x += w / 40) g.fillRect(x, base - h * 0.095, w / 80, h * 0.015);
      // fires on the roofs and lit windows
      const fire = (x, y, s, i) => { for (let k = 0; k < 4; k++) { const fl = 0.7 + 0.3 * Math.sin(t * 9 + k * 1.9 + i); const fx = x + (k - 1.5) * s * 0.3 + Math.sin(t * 6 + k + i) * s * 0.07, fh = s * (1.3 + 0.5 * Math.sin(t * 7 + k * 2 + i)) * fl;
        const gr = g.createLinearGradient(fx, y, fx, y - fh); gr.addColorStop(0, 'rgba(255,240,170,0.95)'); gr.addColorStop(0.4, 'rgba(255,140,40,0.85)'); gr.addColorStop(1, 'rgba(200,40,10,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(fx - s * 0.3, y); g.quadraticCurveTo(fx - s * 0.18, y - fh * 0.6, fx + Math.sin(t * 8 + k) * s * 0.12, y - fh); g.quadraticCurveTo(fx + s * 0.18, y - fh * 0.6, fx + s * 0.3, y); g.closePath(); g.fill(); }
        glow(g, x, y - s * 0.4, s * 2.6, '255,120,30', 0.4); };
      const fs = Math.min(w, h) * 0.05;
      [[0.12, 0.7], [0.27, 0.68], [0.36, 0.72], [0.62, 0.66], [0.73, 0.7], [0.86, 0.69], [0.5, 0.31], [0.57, 0.39], [0.2, 0.74], [0.8, 0.73]].forEach(([u, v], i) => fire(w * u, h * v, fs * (0.7 + hash(i, 6) * 0.6), i));
      for (let i = 0; i < 26; i++) { const x = w * hash(i, 7), y = base - h * (0.02 + hash(i, 8) * 0.12); if (Math.sin(t * 2 + i * 3) > -0.3) { g.fillStyle = 'rgba(255,170,70,0.85)'; g.fillRect(x, y, w * 0.006, h * 0.012); } }
      g.fillStyle = '#070203'; g.fillRect(0, base, w, h - base); glow(g, w * 0.5, base, w * 0.5, '255,90,20', 0.25);
      rise(g, w, h, t, 90, 'rgba(255,170,70,A)', 0.09, 1.5, 35, 0.85);
      vignette(g, w, h, 0.6);
    },
    neutral(g, w, h, t) { sky(g, w, h, ['#141022', '#3a2a3a', '#8a5a3a']); stars(g, w, h, t, 40, 0.5); hills(g, w, h, h * 0.78, h * 0.04, '#1a1210', 2); rise(g, w, h, t, 20, 'rgba(255,220,160,A)', 0.05, 1.3); vignette(g, w, h, 0.55); },
  };

  KR.ClassBG = {
    paint(g, w, h, cls, t) {
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      try { (S[cls] || S.neutral)(g, w, h, t || 0); } catch (e) { g.fillStyle = '#0b0a0f'; g.fillRect(0, 0, w, h); }
      g.restore();
    },
  };
})();

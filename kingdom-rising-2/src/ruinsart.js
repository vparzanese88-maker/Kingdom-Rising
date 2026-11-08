// Kingdom Arena art for the Ruins of Aldermere (see docs/ARENA_ART.md): the procedural textures (cut stone, plaster,
// planks, roof tiles, cobbles, grass), the golden-hour sky and light, the painted ground (a splat map of cobbles,
// flagstones, grass and earth, with baked contact shadows and warm firelight pools), the great Heartwood tree, the
// distant city and hills beyond the walls, and the owner's Meshy trees and rocks. Everything is built once at load:
// the only per-frame work is setting a few light colours and one time uniform.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { fixNormals } from './heromodels.js';

const SRGB = THREE.SRGBColorSpace;
let seedV = 777; const rr = () => { seedV = (seedV * 16807) % 2147483647; return (seedV - 1) / 2147483646; }; // (its own random stream: the map's scatter stays as it was)
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
function tex(c, rep = 1, srgb = true) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = SRGB; t.anisotropy = 8; t.repeat.set(rep, rep); return t; }
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
// draw something so that it wraps round the edges of a tile
function wrapDraw(n, x, y, w, h, fn) { for (const ox of [0, -n, n]) for (const oy of [0, -n, n]) { if (x + ox > n || x + ox + w < 0 || y + oy > n || y + oy + h < 0) continue; fn(x + ox, y + oy); } }
function speckle(g, n, count, a0, a1, light = true) { for (let i = 0; i < count; i++) { const v = light ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${a0 + rr() * (a1 - a0)})`; const s = 1 + rr() * 2.5; g.fillRect(rr() * n, rr() * n, s, s); } }
function blotches(g, n, count, col, r0, r1, a) { for (let i = 0; i < count; i++) { const x = rr() * n, y = rr() * n, r = r0 + rr() * (r1 - r0); wrapDraw(n, x - r, y - r, r * 2, r * 2, (px, py) => { const gr = g.createRadialGradient(px + r, py + r, 0, px + r, py + r, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(px, py, r * 2, r * 2); }); } }
// a normal map from a canvas's brightness (dark mortar and cracks read as grooves)
function normalFrom(c, k = 2.2) { const n = c.width, g = c.getContext('2d'), src = g.getImageData(0, 0, n, n).data, [o, og] = canvas(n), out = og.createImageData(n, n), L = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) L[i] = (src[i * 4] * 0.3 + src[i * 4 + 1] * 0.59 + src[i * 4 + 2] * 0.11) / 255;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const l = (xx, yy) => L[((yy + n) % n) * n + ((xx + n) % n)], dx = (l(x + 1, y) - l(x - 1, y)) * k, dy = (l(x, y + 1) - l(x, y - 1)) * k, len = Math.hypot(dx, dy, 1), j = (y * n + x) * 4;
    out.data[j] = (-dx / len * 0.5 + 0.5) * 255; out.data[j + 1] = (dy / len * 0.5 + 0.5) * 255; out.data[j + 2] = (1 / len * 0.5 + 0.5) * 255; out.data[j + 3] = 255; }
  og.putImageData(out, 0, 0); return tex(o, 1, false); }

// ---- the texture kit (all near-neutral, light: the material colour gives the hue) ----
function ashlar(n = 512, rows = [70, 92, 78, 96, 84, 92], mortar = 5, base = 205) { const [c, g] = canvas(n); g.fillStyle = rgb(base * 0.42, base * 0.4, base * 0.37); g.fillRect(0, 0, n, n);
  let y = 0; for (const h of rows) { let x = rr() * n; const x0 = x; while (x < x0 + n - 40) { const w = Math.min(x0 + n - x, 90 + rr() * 140), v = base * (0.86 + rr() * 0.2), wr = rr() * 8 - 4;
      wrapDraw(n, x, y, w, h, (px, py) => { const gr = g.createLinearGradient(px, py, px + w * 0.3, py + h); gr.addColorStop(0, rgb(v + 14 + wr, v + 12, v + 6 - wr)); gr.addColorStop(1, rgb(v - 16 + wr, v - 18, v - 22 - wr)); g.fillStyle = gr;
        g.beginPath(); const m = mortar, r = 5; g.roundRect(px + m / 2, py + m / 2, w - m, h - m, r); g.fill();
        g.strokeStyle = 'rgba(255,250,235,0.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(px + m, py + h - m); g.lineTo(px + m, py + m); g.lineTo(px + w - m, py + m); g.stroke(); // (a lit top-left edge)
        g.strokeStyle = 'rgba(30,24,18,0.25)'; g.beginPath(); g.moveTo(px + w - m, py + m); g.lineTo(px + w - m, py + h - m); g.lineTo(px + m, py + h - m); g.stroke();
        if (rr() < 0.35) { g.strokeStyle = 'rgba(40,32,24,0.45)'; g.lineWidth = 1.2; g.beginPath(); let cx = px + w * rr(), cy = py + m; g.moveTo(cx, cy); for (let k = 0; k < 5; k++) { cx += (rr() - 0.5) * 18; cy += h / 5; g.lineTo(cx, cy); } g.stroke(); } // a crack
        }); // (no chipped-corner dots: they read as rivets)
      x += w; } y += h; }
  speckle(g, n, 2600, 0.04, 0.12, true); speckle(g, n, 2600, 0.05, 0.16, false); blotches(g, n, 14, '60,52,40', 30, 90, 0.18); blotches(g, n, 6, '250,240,220', 30, 80, 0.12); return c; }
function flagstones(n = 512) { const [c, g] = canvas(n); g.fillStyle = '#5a5246'; g.fillRect(0, 0, n, n); const cells = 4, s = n / cells;
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) { const split = rr() < 0.4, parts = split ? [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] : [[0, 0, 1, 1]];
    for (const [a, b, w, h] of parts) { const x = (i + a) * s + (j % 2) * s * 0.5, y = (j + b) * s, W = w * s, H = h * s, v = 180 + rr() * 50; wrapDraw(n, x, y, W, H, (px, py) => { g.fillStyle = rgb(v + 6, v, v - 10); g.beginPath(); g.roundRect(px + 3, py + 3, W - 6, H - 6, 9); g.fill();
      g.fillStyle = `rgba(255,248,230,${0.06 + rr() * 0.08})`; g.fillRect(px + 8, py + 8, W - 16, H * 0.3); }); } }
  blotches(g, n, 30, '70,90,40', 6, 22, 0.35); /* (moss in the joints) */ speckle(g, n, 3000, 0.04, 0.12, true); speckle(g, n, 3000, 0.05, 0.14, false); blotches(g, n, 10, '50,44,36', 40, 110, 0.18); return c; }
function cobbles(n = 512) { const [c, g] = canvas(n); g.fillStyle = '#6a5c4c'; g.fillRect(0, 0, n, n); const k = 8, s = n / k;
  for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) { const x = (i + (j % 2) * 0.5) * s + (rr() - 0.5) * 6, y = j * s + (rr() - 0.5) * 6, rx = s * (0.4 + rr() * 0.06), ry = s * (0.38 + rr() * 0.06), v = 150 + rr() * 45, tw = rr() * 12 - 6;
    wrapDraw(n, x - rx, y - ry, rx * 2, ry * 2, (px, py) => { const cx = px + rx, cy = py + ry, gr = g.createRadialGradient(cx - rx * 0.3, cy - ry * 0.35, 1, cx, cy, rx * 1.1); gr.addColorStop(0, rgb(v + 16 + tw, v + 10, v - tw)); gr.addColorStop(1, rgb(v - 22 + tw, v - 28, v - 36 - tw)); g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, rr() * 0.6, 0, 7); g.fill(); }); }
  blotches(g, n, 24, '70,92,38', 5, 16, 0.4); speckle(g, n, 2000, 0.04, 0.1, false); blotches(g, n, 8, '40,34,28', 50, 120, 0.2); return c; }
function grass(n = 512) { const [c, g] = canvas(n); g.fillStyle = '#5f7a34'; g.fillRect(0, 0, n, n); blotches(g, n, 40, '120,140,50', 20, 70, 0.35); blotches(g, n, 30, '40,70,30', 20, 60, 0.35); blotches(g, n, 10, '140,120,70', 15, 40, 0.3);
  for (let i = 0; i < 9000; i++) { const x = rr() * n, y = rr() * n, l = 3 + rr() * 8, a = -Math.PI / 2 + (rr() - 0.5) * 0.9, v = rr(); g.strokeStyle = v < 0.5 ? `rgba(150,180,70,${0.35 + rr() * 0.4})` : `rgba(40,70,25,${0.3 + rr() * 0.4})`; g.lineWidth = 1 + rr(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  for (let i = 0; i < 90; i++) { g.fillStyle = ['rgba(255,240,150,0.9)', 'rgba(255,255,255,0.85)', 'rgba(220,140,200,0.85)'][i % 3]; g.beginPath(); g.arc(rr() * n, rr() * n, 1.4 + rr() * 1.4, 0, 7); g.fill(); } return c; } // (tiny flowers)
function earth(n = 512) { const [c, g] = canvas(n); g.fillStyle = '#7a6448'; g.fillRect(0, 0, n, n); blotches(g, n, 40, '110,90,62', 20, 80, 0.4); blotches(g, n, 30, '70,56,40', 15, 60, 0.4); blotches(g, n, 16, '100,110,60', 10, 40, 0.3);
  for (let i = 0; i < 700; i++) { const x = rr() * n, y = rr() * n, r = 1.5 + rr() * 4, v = 120 + rr() * 80; g.fillStyle = rgb(v, v * 0.92, v * 0.82); g.beginPath(); g.ellipse(x, y, r, r * 0.8, rr() * 3, 0, 7); g.fill(); g.fillStyle = 'rgba(30,24,16,0.3)'; g.beginPath(); g.ellipse(x + 1, y + r * 0.6, r, r * 0.4, 0, 0, 7); g.fill(); }
  speckle(g, n, 3000, 0.05, 0.15, false); return c; }
function plaster(n = 512) { const [c, g] = canvas(n); g.fillStyle = '#e2d8c2'; g.fillRect(0, 0, n, n); blotches(g, n, 40, '200,186,160', 20, 90, 0.35); blotches(g, n, 20, '250,246,236', 20, 70, 0.3); blotches(g, n, 10, '150,130,100', 20, 60, 0.2);
  for (let k = 0; k < 4; k++) { const x0 = rr() * n, y0 = rr() * n, w = 60 + rr() * 80, h = 40 + rr() * 50; // patches where the plaster fell off and the bricks show
    for (let yy = 0; yy < h; yy += 12) for (let xx = (yy / 12) % 2 * 12; xx < w; xx += 24) { const fade = 1 - Math.hypot((xx - w / 2) / w, (yy - h / 2) / h) * 1.6; if (fade < 0.1 + rr() * 0.3) continue; const v = 150 + rr() * 40; wrapDraw(n, x0 + xx, y0 + yy, 22, 10, (px, py) => { g.fillStyle = rgb(v + 20, v - 10, v - 30); g.fillRect(px, py, 22, 10); }); } }
  speckle(g, n, 2500, 0.04, 0.1, false); for (let i = 0; i < 8; i++) { g.strokeStyle = 'rgba(90,76,60,0.3)'; g.lineWidth = 1; g.beginPath(); let x = rr() * n, y = rr() * n; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rr() - 0.5) * 30; y += 8 + rr() * 14; g.lineTo(x, y); } g.stroke(); } return c; }
function planks(n = 512) { const [c, g] = canvas(n); const k = 6, h = n / k;
  for (let j = 0; j < k; j++) { const v = 150 + rr() * 50; g.fillStyle = rgb(v, v * 0.82, v * 0.64); g.fillRect(0, j * h, n, h);
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(60,40,24,${0.15 + rr() * 0.25})`; g.lineWidth = 1 + rr() * 1.5; g.beginPath(); const y = j * h + rr() * h; g.moveTo(0, y); for (let x = 0; x <= n; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 2.5); g.stroke(); }
    g.fillStyle = 'rgba(30,20,12,0.85)'; g.fillRect(0, j * h, n, 3); const cut = rr() * n; g.fillRect(cut, j * h, 3, h); g.fillStyle = 'rgba(40,30,20,0.7)'; for (const x of [cut - 14, cut + 17]) { g.beginPath(); g.arc((x + n) % n, j * h + h * 0.3, 2.2, 0, 7); g.arc((x + n) % n, j * h + h * 0.72, 2.2, 0, 7); g.fill(); }
    if (rr() < 0.5) { g.fillStyle = 'rgba(70,46,26,0.5)'; g.beginPath(); g.ellipse(rr() * n, j * h + h / 2, 7, 4, 0, 0, 7); g.fill(); } }
  speckle(g, n, 1500, 0.04, 0.1, false); return c; }
function rooftiles(n = 512) { const [c, g] = canvas(n); g.fillStyle = '#5a2a1a'; g.fillRect(0, 0, n, n); const rows = 10, h = n / rows, w = n / 12;
  for (let j = rows; j >= 0; j--) for (let i = -1; i < 13; i++) { const x = i * w + (j % 2) * w / 2, y = j * h, v = 170 + rr() * 60; const gr = g.createLinearGradient(0, y - h * 0.2, 0, y + h); gr.addColorStop(0, rgb(v * 0.75, v * 0.42, v * 0.3)); gr.addColorStop(1, rgb(v, v * 0.6, v * 0.44)); g.fillStyle = gr;
    g.beginPath(); g.moveTo(x + 1, y - h * 0.2); g.lineTo(x + w - 1, y - h * 0.2); g.lineTo(x + w - 1, y + h * 0.7); g.quadraticCurveTo(x + w / 2, y + h * 1.15, x + 1, y + h * 0.7); g.closePath(); g.fill(); g.strokeStyle = 'rgba(40,16,10,0.6)'; g.lineWidth = 1.5; g.stroke(); }
  blotches(g, n, 14, '90,100,50', 8, 30, 0.35); blotches(g, n, 10, '40,30,26', 20, 60, 0.3); speckle(g, n, 1500, 0.04, 0.1, true); return c; }
function marble(n = 512) { const [c, g] = canvas(n); g.fillStyle = '#eee8dc'; g.fillRect(0, 0, n, n); blotches(g, n, 30, '220,210,190', 30, 100, 0.35);
  for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(150,140,125,${0.15 + rr() * 0.25})`; g.lineWidth = 0.8 + rr() * 1.6; g.beginPath(); let x = rr() * n, y = rr() * n; g.moveTo(x, y); for (let k = 0; k < 14; k++) { x += 20 + rr() * 20; y += (rr() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
  blotches(g, n, 10, '120,110,90', 20, 50, 0.15); speckle(g, n, 1500, 0.03, 0.08, false); return c; }
function leaves(n = 256, alpha = false, gold = false) { const [c, g] = canvas(n); if (!alpha) { g.fillStyle = gold ? '#a86a28' : '#3c5a28'; g.fillRect(0, 0, n, n); }
  for (let i = 0; i < (alpha ? 260 : 700); i++) { const x = rr() * n, y = alpha ? n * (0.02 + rr() * 0.96) : rr() * n, s = (alpha ? 6 : 5) + rr() * 6, a = rr() * 6.28, v = rr();
    const col = gold ? (v < 0.3 ? 'rgb(190,110,40)' : v < 0.65 ? 'rgb(235,160,60)' : v < 0.9 ? 'rgb(255,205,100)' : 'rgb(255,240,170)') : v < 0.3 ? 'rgb(64,98,40)' : v < 0.65 ? 'rgb(92,128,52)' : v < 0.9 ? 'rgb(128,160,64)' : 'rgb(170,180,80)';
    wrapDraw(n, x - s, y - s, s * 2, s * 2, (px, py) => { g.save(); g.translate(px + s, py + s); g.rotate(a); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, s, s * 0.55, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(30,50,20,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke(); g.restore(); }); }
  if (alpha) { g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(rr() * n, rr() * n, 4 + rr() * 10, 0, 7); g.fill(); } g.globalCompositeOperation = 'source-over'; }
  return c; }
function bark(n = 256) { const [c, g] = canvas(n); g.fillStyle = '#6a5240'; g.fillRect(0, 0, n, n); for (let i = 0; i < 70; i++) { const x = rr() * n, w = 2 + rr() * 6; g.fillStyle = `rgba(${rr() < 0.5 ? '40,28,20' : '150,124,96'},${0.25 + rr() * 0.35})`; let y = 0; g.beginPath(); g.moveTo(x, 0); for (; y <= n; y += 16) g.lineTo(x + Math.sin(y * 0.05 + i) * 4, y); g.lineTo(x + w, n); for (y = n; y >= 0; y -= 16) g.lineTo(x + w + Math.sin(y * 0.05 + i) * 4, y); g.fill(); }
  speckle(g, n, 1200, 0.05, 0.15, false); return c; }
function clothPattern(n = 256) { const [c, g] = canvas(n); g.fillStyle = '#ffffff'; g.fillRect(0, 0, n, n); // a banner: trim, a pale sigil, a little wear (tinted by the team colour)
  g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < n; y += 3) g.fillRect(0, y, n, 1); g.fillStyle = '#e8c870'; g.fillRect(0, 0, n, 14); g.fillRect(0, 0, 10, n); g.fillRect(n - 10, 0, 10, n); g.fillStyle = 'rgba(80,60,20,0.5)'; g.fillRect(0, 14, n, 3); g.fillRect(10, 0, 3, n); g.fillRect(n - 13, 0, 3, n);
  g.fillStyle = 'rgba(255,240,200,0.75)'; g.save(); g.translate(n / 2, n * 0.42); for (let k = 0; k < 8; k++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(0, -12); g.lineTo(9, -44); g.lineTo(0, -60); g.lineTo(-9, -44); g.closePath(); g.fill(); } g.beginPath(); g.arc(0, 0, 18, 0, 7); g.fill(); g.restore();
  g.strokeStyle = 'rgba(255,240,200,0.6)'; g.lineWidth = 4; g.beginPath(); g.arc(n / 2, n * 0.42, 70, 0, 7); g.stroke(); blotches(g, n, 10, '40,30,20', 10, 40, 0.15); return c; }

// the plaza round the Heartwood: rings of pale paving, a sunburst of marble rays, a dark border, cracks where the roots broke through
function mosaic(n = 1024) { const [c, g] = canvas(n); const C = n / 2, R = n / 2, m = (v) => v / 10.6 * R; g.fillStyle = '#4a4238'; g.fillRect(0, 0, n, n);
  const band = (r0, r1, len, v0, v1, warm = 0) => { const rm = (r0 + r1) / 2, k = Math.max(8, Math.round(2 * Math.PI * rm / len)), off = rr(); for (let i = 0; i < k; i++) { const a0 = (i + off) / k * Math.PI * 2, a1 = (i + 1 + off) / k * Math.PI * 2, v = v0 + rr() * (v1 - v0);
    g.fillStyle = rgb(v + warm, v, v - 8 - warm); g.beginPath(); g.arc(C, C, m(r1) - 2, a0 + 0.004, a1 - 0.004); g.arc(C, C, m(r0) + 2, a1 - 0.004, a0 + 0.004, true); g.closePath(); g.fill(); } };
  for (let r = 2.8; r < 6.5; r += 0.55) band(r, r + 0.55, 0.6, 160, 200, 6);
  { const k = 32; for (let i = 0; i < k; i++) { const a0 = i / k * Math.PI * 2, a1 = (i + 1) / k * Math.PI * 2, v = i % 2 ? 228 : 150; g.fillStyle = i % 2 ? rgb(v, v - 6, v - 20) : rgb(v - 30, v - 50, v - 60); g.beginPath(); g.arc(C, C, m(10.25), a0 + 0.003, a1 - 0.003); g.arc(C, C, m(7.3), a1 - 0.003, a0 + 0.003, true); g.closePath(); g.fill(); } } // the sunburst
  band(9.6, 10.25, 0.45, 90, 115); band(7.25, 7.7, 0.4, 100, 120);
  g.strokeStyle = 'rgba(30,24,18,0.75)'; g.lineWidth = 2.5; for (let k = 0; k < 9; k++) { let a = k / 9 * Math.PI * 2 + rr() * 0.4, r = m(3); g.beginPath(); g.moveTo(C + Math.cos(a) * r, C + Math.sin(a) * r); while (r < m(10.4)) { r += 10 + rr() * 16; a += (rr() - 0.5) * 0.16; g.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r); } g.stroke(); } // root cracks
  blotches(g, n, 40, '80,100,40', 6, 22, 0.35); blotches(g, n, 6, '30,24,20', 40, 120, 0.35); speckle(g, n, 8000, 0.04, 0.12, false); speckle(g, n, 5000, 0.03, 0.1, true); return c; }

// the texture set, made once; tile: metres per repeat (the map's put() gives every surface world-space UVs in metres)
export function makeKit() {
  seedV = 777; const T = {};
  const add = (k, c, tile, nk) => { T[k] = { map: tex(c), tile, normal: nk ? normalFrom(c, nk) : null }; };
  add('ashlar', ashlar(), 3.2, 2.4); add('ashlarD', ashlar(512, [96, 120, 104, 88, 104], 6, 190), 4.2, 2.6); add('flag', flagstones(), 4.2, 2.0); add('cobble', cobbles(), 3.4, 1.6);
  add('plaster', plaster(), 3.6, 0.8); add('wood', planks(), 2.2, 1.6); add('roof', rooftiles(), 2.0, 2.2); add('marble', marble(), 3.0, 0.6); add('grass', grass(), 3.6, 0); add('earth', earth(), 4.0, 0);
  add('leaf', leaves(256), 2.6, 0); add('gold', leaves(256, false, true), 2.6, 0); add('bark', bark(), 1.6, 1.4); T.ivy = { map: tex(leaves(256, true)), tile: 0 }; T.cloth = { map: tex(clothPattern()), tile: 0 }; { const c = mosaic(); T.mosaic = { map: tex(c), tile: 0, normal: normalFrom(c, 1.6) }; }
  return T; }

// a standard material with an optional texture from the kit; tile 0: the geometry keeps its own UVs
export function kitMat(T, key, color, rough = 0.9, metal = 0, extra = {}) {
  const t = key ? T[key] : null, m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal, vertexColors: true }, extra));
  if (t) { m.map = t.map; if (t.normal) { m.normalMap = t.normal; m.normalScale = new THREE.Vector2(0.9, 0.9); } }
  m.userData.tile = t ? t.tile : 0; glowify(m); return m; }
// baked firelight: a per-vertex 'glow' colour added as emissive light (lit by the braziers, torches and lanterns nearby)
export function glowify(m) { m.userData.glow = true; m.onBeforeCompile = (sh) => {
  sh.vertexShader = 'attribute vec3 glow;\nvarying vec3 vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
  sh.fragmentShader = 'varying vec3 vGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow * diffuseColor.rgb;'); };
  m.customProgramCacheKey = () => 'kr2glow'; }

// ---- the golden hour: a fixed low sun, warm light and cool shade, warm haze (called each frame from the day/night update) ----
const LOOK = { dir: new THREE.Vector3(-0.66, 0.40, -0.34).normalize(), sun: new THREE.Color('#ffd09a'), top: new THREE.Color('#33558f'), hor: new THREE.Color('#ffb784'), sunSky: new THREE.Color('#ffd49a'),
  sky: new THREE.Color('#9fb0dc'), ground: new THREE.Color('#7a5444'), fill: new THREE.Color('#90a4e0'), fog: new THREE.Color('#d6a48a') };
export function ruinsLook({ sun, hemi, fill, sky, scene, renderer, focus }) {
  sun.position.copy(focus).addScaledVector(LOOK.dir, 200); sun.target.position.copy(focus); sun.color.copy(LOOK.sun); sun.intensity = 2.9;
  fill.position.copy(focus).add(new THREE.Vector3(-LOOK.dir.x * 120, 50, -LOOK.dir.z * 120)); fill.target.position.copy(focus); fill.color.copy(LOOK.fill); fill.intensity = 0.55;
  hemi.color.copy(LOOK.sky); hemi.groundColor.copy(LOOK.ground); hemi.intensity = 1.05;
  const u = sky.mat.uniforms; u.sunDir.value.copy(LOOK.dir); u.top.value.copy(LOOK.top); u.horizon.value.copy(LOOK.hor); u.sunCol.value.copy(LOOK.sunSky); u.night.value = 0;
  scene.fog.color.copy(LOOK.fog); scene.fog.near = 70; scene.fog.far = 430; renderer.toneMappingExposure = 1.02; return 0; }

// ---- the ground: one plane, a painted splat map (cobbles / grass / earth / flagstones) and a shade map (contact shadows, firelight) ----
export function buildGround(T, o) { // o: { W, D, Y, paint(ctxs, px, pz, pr), boxes, lights }
  const W = o.W, D = o.D, SW = 512, SH = Math.round(512 * D / W), px = (x) => (x + W / 2) / W * SW, pz = (z) => (z + D / 2) / D * SH, pr = (r) => r / W * SW;
  const layers = {}; for (const k of ['grass', 'earth', 'flag']) { const [c, g] = canvas(SW, SH); g.fillStyle = '#000'; g.fillRect(0, 0, SW, SH); layers[k] = { c, g }; }
  o.paint(layers, px, pz, pr);
  const [sc, sg] = canvas(SW, SH); { const d = sg.createImageData(SW, SH), L = [layers.grass, layers.earth, layers.flag].map(l => l.g.getImageData(0, 0, SW, SH).data);
    for (let i = 0; i < SW * SH; i++) { d.data[i * 4] = L[0][i * 4]; d.data[i * 4 + 1] = L[1][i * 4]; d.data[i * 4 + 2] = L[2][i * 4]; d.data[i * 4 + 3] = 255; } sg.putImageData(d, 0, 0); }
  // shade: red = ambient light (dark at the foot of every wall), green = warm firelight, blue = a big soft variation in tone
  const AO = 3, [ac, ag] = canvas(SW * 1, SH * 1); ag.fillStyle = 'rgb(255,0,128)'; ag.fillRect(0, 0, SW, SH);
  { const [bc, bg] = canvas(SW, SH); bg.fillStyle = '#fff'; bg.fillRect(0, 0, SW, SH); bg.fillStyle = '#000';
    for (const b of o.boxes) { const k = SW / W; if (b.t === 'c') { bg.beginPath(); bg.arc(px(b.x), pz(b.z), b.r * k + 0.5, 0, 7); bg.fill(); continue; } if (b.t !== 'b' || b.y0 > o.Y + 0.6 || b.y1 < o.Y + 0.5) continue;
      bg.save(); bg.translate(px(b.x), pz(b.z)); bg.rotate(-b.rot); bg.fillRect(-b.hw * k - 1, -b.hd * k - 1, b.hw * 2 * k + 2, b.hd * 2 * k + 2); bg.restore(); } /* (a box's local x,z turn into the world by -rot on a canvas whose z runs down) */
    ag.globalCompositeOperation = 'multiply'; ag.filter = `blur(${AO}px)`; ag.drawImage(bc, 0, 0); ag.filter = 'none'; ag.globalAlpha = 0.5; ag.filter = `blur(${AO * 3}px)`; ag.drawImage(bc, 0, 0); ag.filter = 'none'; ag.globalAlpha = 1; ag.globalCompositeOperation = 'source-over'; }
  { const d = ag.getImageData(0, 0, SW, SH); for (let i = 0; i < SW * SH; i++) { const v = d.data[i * 4] / 255; d.data[i * 4] = (0.42 + 0.58 * v) * 255; d.data[i * 4 + 1] = 0; d.data[i * 4 + 2] = 128; } ag.putImageData(d, 0, 0); }
  ag.globalCompositeOperation = 'lighter';
  for (const l of o.lights) { if (l.y > o.Y + 3.5) continue; const r = pr(l.r * 1.1), x = px(l.x), y = pz(l.z), gr = ag.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,${Math.min(255, 200 * l.k) | 0},0,1)`); gr.addColorStop(1, 'rgba(0,0,0,1)'); ag.fillStyle = gr; ag.fillRect(x - r, y - r, r * 2, r * 2); }
  ag.globalCompositeOperation = 'source-over';
  { const d = ag.getImageData(0, 0, SW, SH); seedV = 4242; const nx = 16, nz = Math.round(16 * D / W), grid = []; for (let i = 0; i <= nx * nz + nx + nz + 2; i++) grid.push(rr());
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const fx = x / SW * nx, fz = y / SH * nz, ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, s = (a, b) => grid[(b * (nx + 1) + a) % grid.length], v = (s(ix, iz) * (1 - tx) + s(ix + 1, iz) * tx) * (1 - tz) + (s(ix, iz + 1) * (1 - tx) + s(ix + 1, iz + 1) * tx) * tz; d.data[(y * SW + x) * 4 + 2] = v * 255; }
    ag.putImageData(d, 0, 0); }
  const splat = tex(sc, 1, false), shade = tex(ac, 1, false); splat.wrapS = splat.wrapT = shade.wrapS = shade.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.MeshStandardMaterial({ map: splat, roughness: 0.92, normalMap: T.cobble.normal, normalScale: new THREE.Vector2(0.7, 0.7) });
  m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, { tShade: { value: shade }, tCob: { value: T.cobble.map }, tGrass: { value: T.grass.map }, tEarth: { value: T.earth.map }, tFlag: { value: T.flag.map }, gSize: { value: new THREE.Vector2(W, D) } });
    sh.fragmentShader = 'uniform sampler2D tShade, tCob, tGrass, tEarth, tFlag; uniform vec2 gSize;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `vec4 sp = texture2D(map, vMapUv); vec2 wp = (vMapUv - 0.5) * vec2(gSize.x, -gSize.y);
        vec3 sh3 = texture2D(tShade, vMapUv).rgb; float wg = sp.r, we = sp.g, wf = sp.b, wc = max(0.0, 1.0 - wg - we - wf), ws = max(0.001, wg + we + wf + wc);
        vec3 col = (texture2D(tCob, wp / 3.4).rgb * vec3(0.96, 0.9, 0.82) * wc + texture2D(tGrass, wp / 3.6).rgb * wg + texture2D(tEarth, wp / 4.0).rgb * we + texture2D(tFlag, wp / 4.2).rgb * vec3(0.95, 0.92, 0.86) * wf) / ws;
        col *= 0.86 + 0.28 * sh3.b; col *= sh3.r; diffuseColor.rgb *= col;`)
      .replace('#include <normal_fragment_maps>', `#ifdef USE_NORMALMAP_TANGENTSPACE
        vec3 mapN = texture2D(normalMap, wp / 3.4).xyz * 2.0 - 1.0; mapN.xy *= normalScale * (wc / ws); normal = normalize(tbn * mapN);
        #endif`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.52, 0.2) * sh3.g * 0.85 * diffuseColor.rgb;'); };
  m.customProgramCacheKey = () => 'kr2ground';
  const g = new THREE.Mesh(new THREE.PlaneGeometry(W, D, 1, 1), m); g.rotation.x = -Math.PI / 2; g.position.y = o.Y + 0.02; g.receiveShadow = true; return g; }

// ---- bake the light: vertex colours (a tint per block, soot and shade low down, moss at the foot of stone) and firelight ----
export function bakeVerts(list, mat, lights, Y) { const cell = 10, grid = new Map(), key = (i, j) => i * 1000 + j;
  for (const l of lights) { const i0 = Math.floor((l.x - l.r) / cell), i1 = Math.floor((l.x + l.r) / cell), j0 = Math.floor((l.z - l.r) / cell), j1 = Math.floor((l.z + l.r) / cell); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(l); } }
  const moss = mat.userData.moss, soot = mat.userData.soot ?? 1, emissive = !!(mat.emissive && mat.emissiveIntensity > 0.3);
  for (const g of list) { const p = g.attributes.position, n = g.attributes.normal, N = p.count, col = new Float32Array(N * 3), glow = new Float32Array(N * 3);
    // one tint for the whole piece (hashed from where it stands, so the two mirrored halves match)
    let cx = 0, cz = 0; for (let i = 0; i < N; i += Math.max(1, N >> 3)) { cx += p.getX(i); cz += p.getZ(i); } const h = Math.abs(Math.sin(Math.round(cx * 3) * 12.9898 + Math.round(Math.abs(cz) * 3) * 78.233) * 43758.5453) % 1, tint = 0.9 + h * 0.17, warm = (h - 0.5) * 0.06;
    for (let i = 0; i < N; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), up = y - Y, ny0 = n.getY(i), ao = emissive ? 1 : ny0 > 0.6 ? 0.96 : (0.5 + 0.5 * Math.min(1, Math.max(0, (up + 0.15) / 2.6))) * (ny0 < -0.6 ? 0.8 : 1), top = up > 9 ? 1.04 : 1;
      let r = tint * ao * top * (1 + warm), gg = tint * ao * top, b = tint * ao * top * (1 - warm);
      if (soot < 1) { const s = 0.5 + 0.5 * Math.sin(x * 0.37 + Math.sin(z * 0.23) * 3) * Math.sin(z * 0.31 + y * 0.6); const k = 1 - (1 - soot) * Math.max(0, s - 0.35) * 1.5; r *= k; gg *= k; b *= k; }
      if (moss && up < 1.6) { const m = (1 - Math.max(0, up) / 1.6) * moss; r *= 1 - 0.16 * m; b *= 1 - 0.26 * m; gg *= 1 - 0.04 * m; }
      col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
      const ls = grid.get(key(Math.floor(x / cell), Math.floor(z / cell))); if (!ls || emissive) continue; const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i); let gr = 0, gG = 0, gb = 0;
      for (const l of ls) { const dx = l.x - x, dy = l.y - y, dz = l.z - z, d = Math.hypot(dx, dy, dz); if (d > l.r) continue; const f = (1 - d / l.r), lam = 0.35 + 0.65 * Math.max(0, (dx * nx + dy * ny + dz * nz) / (d + 1e-4)), k = f * f * lam * l.k; gr += l.c[0] * k; gG += l.c[1] * k; gb += l.c[2] * k; }
      glow[i * 3] = Math.min(1.2, gr); glow[i * 3 + 1] = Math.min(1.2, gG); glow[i * 3 + 2] = Math.min(1.2, gb); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('glow', new THREE.BufferAttribute(glow, 3)); } }

// ---- the Heartwood: a vast gnarled alder, one side charred by the Night of Ash, its crown still glowing with emberlight ----
function taperTube(pts, r0, r1, segs = 14, rad = 8) { const curve = new THREE.CatmullRomCurve3(pts), g = new THREE.TubeGeometry(curve, segs, 1, rad, false), p = g.attributes.position;
  for (let i = 0; i <= segs; i++) { const t = i / segs, c = curve.getPointAt(t), r = r0 + (r1 - r0) * Math.pow(t, 0.8); for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j, v = new THREE.Vector3().fromBufferAttribute(p, k).sub(c).multiplyScalar(r * (0.9 + 0.2 * Math.sin(j * 2.1 + i))); p.setXYZ(k, c.x + v.x, c.y + v.y, c.z + v.z); } }
  g.computeVertexNormals(); return { g, curve }; }
export function heartwood(put, M, x0, y0, z0, lights) { seedV = 31337; const V = (x, y, z) => new THREE.Vector3(x0 + x, y0 + y, z0 + z);
  { const g = new THREE.CylinderGeometry(1.35, 2.3, 9.5, 16, 10), p = g.attributes.position; // the trunk: twisted, buttressed, flaring at the root
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = (y + 4.75) / 9.5, a = Math.atan2(z, x), tw = t * 1.1, fl = 1 + Math.pow(Math.max(0, 1 - t * 2.2), 2) * 0.55 * (1 + 0.5 * Math.sin(a * 5)), gn = 1 + 0.12 * Math.sin(a * 7 + t * 9) + 0.08 * Math.sin(a * 3 - t * 5);
      const r = Math.hypot(x, z) * fl * gn, na = a + tw; p.setXYZ(i, Math.cos(na) * r, y, Math.sin(na) * r); }
    g.computeVertexNormals(); put(g, M.bark, x0, y0 + 4.75, z0); }
  // roots splitting the paving round the plinth
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + rr() * 0.4, L = 4.2 + rr() * 3.2; const pts = [V(Math.cos(a) * 1.4, 1.2, Math.sin(a) * 1.4), V(Math.cos(a) * 2.6, 0.5, Math.sin(a) * 2.6), V(Math.cos(a + 0.15) * (2.6 + L * 0.5), 0.05, Math.sin(a + 0.15) * (2.6 + L * 0.5)), V(Math.cos(a + 0.05) * (2.6 + L), -0.5, Math.sin(a + 0.05) * (2.6 + L))];
    put(taperTube(pts, 0.55, 0.12, 10, 7).g, k % 3 === 0 ? M.char : M.bark, 0, 0, 0); }
  // limbs, then the crown: clusters of glowing leaves at every limb's end (the north-east side burned bare)
  const tips = [];
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + 0.3, burnt = Math.cos(a - 0.8) > 0.55, L = 5 + rr() * 2.5, up = 8.2 + rr() * 0.8;
    const pts = [V(Math.cos(a) * 0.6, up - 1.2, Math.sin(a) * 0.6), V(Math.cos(a) * 2.2, up + 1.0, Math.sin(a) * 2.2), V(Math.cos(a + 0.2) * (2.2 + L * 0.6), up + 2.6 + rr(), Math.sin(a + 0.2) * (2.2 + L * 0.6)), V(Math.cos(a + 0.3) * (2.2 + L), up + 3.0 + rr() * 1.5, Math.sin(a + 0.3) * (2.2 + L))];
    const { g, curve } = taperTube(pts, 0.85, 0.18, 12, 8); put(g, burnt ? M.char : M.bark, 0, 0, 0);
    const end = curve.getPointAt(1), mid = curve.getPointAt(0.55); if (!burnt) tips.push(end, mid); else { const tw = [end.clone().add(new THREE.Vector3(0, 1.4, 0)), end.clone().add(new THREE.Vector3(Math.cos(a) * 1.5, 0.4, Math.sin(a) * 1.5))]; put(taperTube([end, ...tw], 0.18, 0.04, 6, 5).g, M.char, 0, 0, 0); } }
  { const top = [V(0, 9, 0), V(0.4, 12, -0.3), V(-0.2, 15, 0.4), V(0.3, 17.2, 0)]; put(taperTube(top, 1.0, 0.2, 10, 8).g, M.bark, 0, 0, 0); tips.push(V(0.3, 17, 0), V(0, 14.5, 0.4)); }
  for (const t of tips) for (let k = 0; k < 4; k++) { const s = 1.7 + rr() * 1.5, g = new THREE.IcosahedronGeometry(s, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + (rr() - 0.5) * 0.25), p.getY(i) * 0.72 * (1 + (rr() - 0.5) * 0.25), p.getZ(i) * (1 + (rr() - 0.5) * 0.25)); g.computeVertexNormals();
    put(g, k % 3 === 2 ? M.leafGlowD : M.leafGlow, t.x + (rr() - 0.5) * 3, t.y + (rr() - 0.3) * 1.6, t.z + (rr() - 0.5) * 3, rr() * 6, 0, true); }
  // hanging emberlight pods
  for (let k = 0; k < 14; k++) { const t = tips[k % tips.length], x = t.x + (rr() - 0.5) * 4, z = t.z + (rr() - 0.5) * 4, len = 1 + rr() * 2.2; put(new THREE.CylinderGeometry(0.03, 0.03, len, 3), M.bark, x, t.y - 1.2 - len / 2, z, 0, 0, false); const pod = new THREE.SphereGeometry(0.22, 8, 6); pod.scale(1, 1.4, 1); put(pod, M.ember, x, t.y - 1.3 - len, z, 0, 0, false); }
  lights.push({ x: x0, y: y0 + 10, z: z0, r: 16, k: 0.7, c: [1, 0.72, 0.32] }, { x: x0, y: y0 + 2.5, z: z0, r: 9, k: 0.6, c: [1, 0.66, 0.28] });
  return tips; }

// drifting emberlight motes round the Heartwood (and anywhere else asked): animated in the shader from one time uniform
export function motes(root, time, x0, y0, z0, R = 13, H = 14, n = 260, col = '#ffd27a', size = 0.22) { const pos = new Float32Array(n * 3), ph = new Float32Array(n); seedV = 99;
  for (let i = 0; i < n; i++) { const a = rr() * 6.283, r = Math.sqrt(rr()) * R; pos[i * 3] = x0 + Math.cos(a) * r; pos[i * 3 + 1] = y0 + rr() * H; pos[i * 3 + 2] = z0 + Math.sin(a) * r; ph[i] = rr() * 100; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { time, col: { value: new THREE.Color(col) }, size: { value: size * 900 }, H: { value: H }, y0: { value: y0 } },
    vertexShader: `attribute float ph; uniform float time, size, H, y0; varying float vA; void main(){ vec3 p = position; float t = time * 0.35 + ph; p.y = y0 + mod(p.y - y0 + time * 0.45 + ph, H); p.x += sin(t * 1.3) * 0.8; p.z += cos(t * 1.1) * 0.8;
      vA = smoothstep(0.0, 1.5, p.y - y0) * smoothstep(H, H - 3.0, p.y - y0) * (0.55 + 0.45 * sin(t * 4.0)); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size / -mv.z; }`,
    fragmentShader: `uniform vec3 col; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(col * 1.6, a * vA); }` });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 2; root.add(p); return p; }

// ---- grass tufts: one instanced mesh of crossed cut-out cards (no shadows, no per-frame work) ----
function blades(n = 256) { const [c, g] = canvas(n); for (let i = 0; i < 70; i++) { const x = n * (0.1 + rr() * 0.8), h = n * (0.45 + rr() * 0.5), lean = (rr() - 0.5) * n * 0.25, w = 3 + rr() * 5, v = rr();
    const gr = g.createLinearGradient(0, n, 0, n - h); gr.addColorStop(0, v < 0.5 ? '#3a5a22' : '#4a6a28'); gr.addColorStop(1, v < 0.5 ? '#a8c060' : '#c8d070'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - w, n); g.quadraticCurveTo(x + lean * 0.4, n - h * 0.6, x + lean, n - h); g.quadraticCurveTo(x + lean * 0.4 + w * 0.3, n - h * 0.6, x + w, n); g.fill(); }
  for (let i = 0; i < 6; i++) { g.fillStyle = ['#fff6c0', '#ffffff', '#f0a0d0'][i % 3]; g.beginPath(); g.arc(n * (0.15 + rr() * 0.7), n * (0.1 + rr() * 0.35), 4 + rr() * 3, 0, 7); g.fill(); } return c; }
export function tufts(root, spots) { if (!spots.length) return; const t = tex(blades()); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const a = new THREE.PlaneGeometry(1, 1); a.translate(0, 0.5, 0); const b = a.clone(); b.rotateY(Math.PI / 2); const geo = new THREE.BufferGeometry(); { const m = [a, b].map(g => g.toNonIndexed()); const pos = [], nor = [], uv = []; for (const g of m) { pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array); for (let i = 0; i < g.attributes.position.count; i++) nor.push(0, 1, 0); } geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); }
  const mat = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, color: '#e8f0c8' }), im = new THREE.InstancedMesh(geo, mat, spots.length), M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(), p = new THREE.Vector3(); seedV = 515;
  spots.forEach(([x, y, z], i) => { const h = 0.45 + rr() * 0.55; q.setFromAxisAngle(up, rr() * 3.14); s.set(h * (1.1 + rr() * 0.6), h, h * (1.1 + rr() * 0.6)); im.setMatrixAt(i, M4.compose(p.set(x, y, z), q, s)); }); im.computeBoundingSphere(); im.receiveShadow = true; root.add(im); return im; }

// ---- beyond the walls: the rest of Aldermere (broken towers, roofs) and the hills of the Vale, hazy in the warm fog ----
export function backdrop(put, M, Y) { seedV = 2024; const ring = (R0, R1, n, fn) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rr() * 0.1, r = R0 + rr() * (R1 - R0), x = Math.cos(a) * r * 0.75, z = Math.sin(a) * r * 1.05; if (Math.abs(x) < 70 && Math.abs(z) < 110) continue; fn(x, z, a); } };
  ring(120, 175, 48, (x, z, a) => { const h = 10 + rr() * 22, w = 6 + rr() * 8; put(new THREE.BoxGeometry(w, h, w * (0.6 + rr() * 0.6)), M.farStone, x, Y + h / 2 - 1, z, a, 0, false); if (rr() < 0.45) { const c = new THREE.ConeGeometry(w * 0.75, 5 + rr() * 6, 4); c.rotateY(Math.PI / 4); put(c, M.farRoof, x, Y + h + 2, z, a, 0, false); } else for (let k = 0; k < 3; k++) put(new THREE.BoxGeometry(w * 0.3, 2 + rr() * 3, w * 0.3), M.farStone, x + (rr() - 0.5) * w * 0.6, Y + h, z + (rr() - 0.5) * w * 0.4, rr(), 0, false); });
  ring(130, 160, 10, (x, z, a) => { const h = 34 + rr() * 22; put(new THREE.CylinderGeometry(4, 5.5, h, 10), M.farStone, x, Y + h / 2, z, 0, 0, false); if (rr() < 0.5) put(new THREE.ConeGeometry(6, 10, 10), M.farRoof, x, Y + h + 5, z, 0, 0, false); }); // broken spires
  { const g = new THREE.CircleGeometry(1600, 32); g.rotateX(-Math.PI / 2); put(g, M.farPlain, 0, Y - 0.05, 0, 0, 0, false); } // (the plain beyond the walls, under the campaign's grass)
  ring(330, 420, 26, (x, z) => { const h = 28 + rr() * 45, w = 70 + rr() * 60, g = new THREE.IcosahedronGeometry(1, 1); g.scale(w, h, w * (0.7 + rr() * 0.5)); put(g, M.farHill, x, Y - 4, z, rr() * 3, 0, false); }); } // (low rolling hills, blue with distance)

// ---- the owner's Meshy props (trees and rocks), loaded after the map and drawn instanced ----
export function plantMeshy(root, list, done) { if (!list.tree.length && !list.rock.length) return; const L = new FBXLoader();
  const load = (kind, url, at) => L.load(url, (base) => { try { place(root, kind, base, at); if (done) done(kind); } catch (e) { console.warn('arena prop', kind, e); } }, undefined, () => { /* (the procedural stand-ins stay) */ });
  setTimeout(() => { load('tree', 'models/props/yard_tree.fbx', list.tree); load('rock', 'models/props/yard_rock.fbx', list.rock); }, 2500); }
function place(root, kind, base, at) { if (!at.length) return; base.updateMatrixWorld(true); const parts = [], box = new THREE.Box3();
  base.traverse(o => { if (!o.isMesh || !o.geometry) return; const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); fixNormals(geo); geo.computeBoundingBox(); box.union(geo.boundingBox);
    const mats = (Array.isArray(o.material) ? o.material : [o.material]).map(m0 => { const m = new THREE.MeshStandardMaterial({ map: m0.map || null, color: '#ffffff', roughness: 0.92, metalness: 0, side: kind === 'tree' ? THREE.DoubleSide : THREE.FrontSide, alphaTest: m0.map && kind === 'tree' ? 0.4 : 0 });
      if (m.map) { m.map.colorSpace = SRGB; m.map.anisotropy = 4; m.map.needsUpdate = true; } if (kind === 'rock') m.color.setRGB(1.5, 1.42, 1.32); else m.color.setRGB(1.05, 1.0, 0.86); return m; });
    parts.push([geo, mats.length === 1 ? mats[0] : mats]); });
  if (!parts.length) return; const H = Math.max(0.01, box.max.y - box.min.y), cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const norm = new THREE.Matrix4().makeScale(1 / H, 1 / H, 1 / H).multiply(new THREE.Matrix4().makeTranslation(-cx, -box.min.y, -cz)), Mx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (const [geo, mat] of parts) { geo.applyMatrix4(norm); geo.computeBoundingSphere(); for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    const im = new THREE.InstancedMesh(geo, mat, at.length); at.forEach(([x, y, z, h, ry], i) => { q.setFromAxisAngle(up, ry); s.setScalar(h); p.set(x, y - (kind === 'rock' ? h * 0.18 : 0.1), z); im.setMatrixAt(i, Mx.compose(p, q, s)); });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); root.add(im); } }

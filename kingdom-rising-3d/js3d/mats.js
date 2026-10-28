// Kingdom Rising 3D — shared materials for buildings and props
import { THREE, K3 } from './core.js';
import { propTex } from './texgen.js';

// metres per texture repeat when texture coordinates are projected from world space
export const MAT_UV = { brick: 1.1, stone: 2.4, darkstone: 2.4, plaster: 3.2, timber: 1.2, planks: 1.9, rooftile: 1.6, slate: 1.8, shingle: 1.6, bark: 1.2, birch: 1.4, pinebark: 1.2, metal: 0.8, cloth: 1.2, leather: 0.8, marble: 2.2, fur: 0.6, cobble: 2.4, gold: 0.6, rock: 3.2 };

const TEX = { brick: 'stonebrick', stone: 'stonebrick', darkstone: 'darkstone', plaster: 'plaster', timber: 'timber', planks: 'planks', rooftile: 'rooftile', slate: 'slate', shingle: 'shingle', bark: 'bark', birch: 'birch', pinebark: 'pinebark', metal: 'metal', cloth: 'cloth', leather: 'leather', marble: 'marble', fur: 'fur', gold: 'metal', rock: 'rock', snowrock: 'snow' };
const SPEC = {
  brick: { roughness: 0.92 }, stone: { roughness: 0.88 }, darkstone: { roughness: 0.9 }, plaster: { roughness: 0.95 }, timber: { roughness: 0.82 }, planks: { roughness: 0.8 },
  rooftile: { roughness: 0.75 }, slate: { roughness: 0.6 }, shingle: { roughness: 0.8 }, bark: { roughness: 0.95 }, birch: { roughness: 0.85 }, pinebark: { roughness: 0.92 },
  metal: { roughness: 0.38, metalness: 0.85 }, gold: { roughness: 0.3, metalness: 1, color: 0xe8b84a }, cloth: { roughness: 0.98 }, leather: { roughness: 0.7 }, marble: { roughness: 0.32 }, fur: { roughness: 1 }, rock: { roughness: 0.9 }, snowrock: { roughness: 0.75 },
};
// eight small paintings, brushed onto one canvas: a landscape, a sea piece with a ship, a portrait, a still life, a
// castle on its hill, a stag in a wood, a night harbour, and a heraldic lion; each with a dark varnish and some brush noise
function paintingAtlas() {
  const C = 128, c = document.createElement('canvas'); c.width = C * 4; c.height = C * 2; const g = c.getContext('2d');
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const grad = (x, y0, y1, a, b) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  const strokes = (x, y, n, cols, w = 6) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.18 + rnd() * 0.25; g.beginPath(); g.ellipse(x + rnd() * C, y + rnd() * C, 2 + rnd() * w, 1 + rnd() * 2.5, rnd() * 3.14, 0, 6.283); g.fill(); } g.globalAlpha = 1; };
  const hill = (x, y, h, col, ph) => { g.fillStyle = col; g.beginPath(); g.moveTo(x, y + C); for (let i = 0; i <= C; i += 4) g.lineTo(x + i, y + C - h - Math.sin(i / C * 6 + ph) * h * 0.35 - Math.sin(i / C * 13 + ph) * 4); g.lineTo(x + C, y + C); g.fill(); };
  const cell = (k, fn) => { const x = (k % 4) * C, y = Math.floor(k / 4) * C; g.save(); g.beginPath(); g.rect(x, y, C, C); g.clip(); fn(x, y); g.restore(); };
  cell(0, (x, y) => { g.fillStyle = grad(x, y, y + C * 0.6, '#9ec4e0', '#f2dcae'); g.fillRect(x, y, C, C); g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(x + 92, y + 34, 11, 0, 6.283); g.fill();
    hill(x, y, 58, '#7a9a5a', 1); hill(x, y, 40, '#5a7a3a', 3); hill(x, y, 22, '#3e5a2a', 5); strokes(x, y + 70, 160, ['#4a6a2a', '#8aa860', '#c8b870']); });
  cell(1, (x, y) => { g.fillStyle = grad(x, y, y + C * 0.55, '#c8d8e4', '#e8c8a0'); g.fillRect(x, y, C, C); g.fillStyle = grad(x, y + 70, y + C, '#3a6a86', '#1a3a50'); g.fillRect(x, y + 72, C, C);
    strokes(x, y + 74, 120, ['#8ab0c8', '#2a5068', '#c8dce4'], 8); g.fillStyle = '#4a2e1a'; g.beginPath(); g.moveTo(x + 36, y + 80); g.lineTo(x + 92, y + 80); g.lineTo(x + 84, y + 92); g.lineTo(x + 44, y + 92); g.fill();
    g.fillStyle = '#3a2416'; g.fillRect(x + 62, y + 30, 3, 50); g.fillStyle = '#efe6cc'; g.beginPath(); g.moveTo(x + 66, y + 34); g.quadraticCurveTo(x + 88, y + 52, x + 66, y + 74); g.fill(); g.fillStyle = '#b8402a'; g.fillRect(x + 58, y + 26, 10, 5); });
  cell(2, (x, y) => { g.fillStyle = grad(x, y, y + C, '#3a2a1e', '#1a120c'); g.fillRect(x, y, C, C); g.fillStyle = '#5a1e1e'; g.beginPath(); g.ellipse(x + 64, y + 128, 46, 40, 0, 0, 6.283); g.fill();
    g.fillStyle = '#e0b894'; g.beginPath(); g.ellipse(x + 64, y + 62, 19, 25, 0, 0, 6.283); g.fill(); g.fillStyle = '#3a2412'; g.beginPath(); g.ellipse(x + 64, y + 44, 22, 14, 0, 3.14, 6.283); g.fill();
    g.fillStyle = '#2a1a10'; g.fillRect(x + 56, y + 58, 4, 2); g.fillRect(x + 68, y + 58, 4, 2); g.fillStyle = '#a04a3a'; g.fillRect(x + 59, y + 74, 10, 2); g.fillStyle = '#d8b040'; g.fillRect(x + 50, y + 98, 28, 4); strokes(x, y, 80, ['#2a1c12', '#4a3020'], 10); });
  cell(3, (x, y) => { g.fillStyle = grad(x, y, y + C, '#2e2418', '#120e08'); g.fillRect(x, y, C, C); g.fillStyle = '#6a4a2a'; g.fillRect(x, y + 92, C, 36); g.fillStyle = '#b8a890'; g.beginPath(); g.ellipse(x + 64, y + 90, 34, 9, 0, 0, 6.283); g.fill();
    for (const [fx, fy, r, col] of [[50, 78, 12, '#c83a2a'], [70, 76, 13, '#e0a030'], [62, 66, 11, '#7aa040'], [82, 82, 9, '#6a2a5a'], [40, 84, 8, '#d8c050']]) { g.fillStyle = col; g.beginPath(); g.arc(x + fx, y + fy, r, 0, 6.283); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x + fx - r * 0.35, y + fy - r * 0.35, r * 0.3, 0, 6.283); g.fill(); }
    g.fillStyle = '#c8a050'; g.fillRect(x + 96, y + 52, 9, 40); });
  cell(4, (x, y) => { g.fillStyle = grad(x, y, y + C * 0.7, '#e8b880', '#a87a8a'); g.fillRect(x, y, C, C); hill(x, y, 50, '#6a6a4a', 2);
    g.fillStyle = '#c8c0b0'; g.fillRect(x + 48, y + 46, 34, 30); g.fillRect(x + 42, y + 36, 10, 40); g.fillRect(x + 78, y + 32, 10, 44); g.fillStyle = '#3a4a7a'; for (const tx of [42, 78]) { g.beginPath(); g.moveTo(x + tx - 2, y + (tx === 42 ? 36 : 32)); g.lineTo(x + tx + 5, y + (tx === 42 ? 22 : 16)); g.lineTo(x + tx + 12, y + (tx === 42 ? 36 : 32)); g.fill(); }
    hill(x, y, 26, '#4a5a32', 4); strokes(x, y + 80, 100, ['#3a4a2a', '#7a7a50']); });
  cell(5, (x, y) => { g.fillStyle = grad(x, y, y + C, '#4a6a3a', '#1a2a14'); g.fillRect(x, y, C, C); for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#2a3a1a' : '#3a2a1a'; g.fillRect(x + i * 15 + rnd() * 6, y, 5 + rnd() * 4, C); }
    g.fillStyle = '#8a5a30'; g.beginPath(); g.ellipse(x + 64, y + 86, 22, 11, 0, 0, 6.283); g.fill(); g.fillRect(x + 48, y + 90, 4, 22); g.fillRect(x + 76, y + 90, 4, 22); g.beginPath(); g.ellipse(x + 86, y + 72, 7, 9, 0.4, 0, 6.283); g.fill();
    g.strokeStyle = '#d8c8a0'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 86, y + 64); g.lineTo(x + 80, y + 48); g.moveTo(x + 86, y + 64); g.lineTo(x + 96, y + 50); g.stroke(); strokes(x, y, 140, ['#5a7a3a', '#2a3a1a', '#a8c870'], 5); });
  cell(6, (x, y) => { g.fillStyle = grad(x, y, y + C, '#0e1428', '#28304a'); g.fillRect(x, y, C, C); g.fillStyle = '#f4f0d8'; g.beginPath(); g.arc(x + 30, y + 26, 9, 0, 6.283); g.fill(); for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,230,0.7)'; g.fillRect(x + rnd() * C, y + rnd() * 60, 1, 1); }
    g.fillStyle = '#141a28'; g.fillRect(x, y + 70, C, 58); g.fillStyle = '#2a2018'; for (const hx of [12, 40, 70, 98]) { g.fillRect(x + hx, y + 52, 22, 22); g.beginPath(); g.moveTo(x + hx - 2, y + 52); g.lineTo(x + hx + 11, y + 42); g.lineTo(x + hx + 24, y + 52); g.fill(); g.fillStyle = '#f8c060'; g.fillRect(x + hx + 8, y + 60, 5, 6); g.fillStyle = '#2a2018'; }
    strokes(x, y + 74, 90, ['#f8c060', '#3a4a6a', '#1a2234'], 7); });
  cell(7, (x, y) => { g.fillStyle = '#7a1a1a'; g.fillRect(x, y, C, C); g.fillStyle = '#d8b040'; g.beginPath(); g.moveTo(x + 24, y + 18); g.lineTo(x + 104, y + 18); g.lineTo(x + 104, y + 70); g.quadraticCurveTo(x + 104, y + 108, x + 64, y + 118); g.quadraticCurveTo(x + 24, y + 108, x + 24, y + 70); g.fill();
    g.fillStyle = '#7a1a1a'; g.beginPath(); g.ellipse(x + 64, y + 66, 18, 24, 0, 0, 6.283); g.fill(); g.beginPath(); g.arc(x + 64, y + 40, 11, 0, 6.283); g.fill(); g.fillRect(x + 46, y + 84, 8, 18); g.fillRect(x + 74, y + 84, 8, 18); strokes(x, y, 60, ['#5a1010', '#e8c860'], 6); });
  // varnish, a craquelure of noise, and a dark rim inside each frame
  for (let k = 0; k < 8; k++) { const x = (k % 4) * C, y = Math.floor(k / 4) * C; const vg = g.createRadialGradient(x + C / 2, y + C / 2, C * 0.2, x + C / 2, y + C / 2, C * 0.75); vg.addColorStop(0, 'rgba(60,40,10,0)'); vg.addColorStop(1, 'rgba(30,18,6,0.55)'); g.fillStyle = vg; g.fillRect(x, y, C, C); }
  const im = g.getImageData(0, 0, c.width, c.height); for (let i = 0; i < im.data.length; i += 4) { const n = (rnd() - 0.5) * 16; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n * 0.8; } g.putImageData(im, 0, 0);
  return c;
}
const cache = new Map();
export const mats = {
  get(key) {
    let m = cache.get(key); if (m) return m;
    if (TEX[key]) {
      const t = propTex(TEX[key]);
      const s = SPEC[key] || {};
      m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(1.1, 1.1), roughness: s.roughness != null ? s.roughness : 0.85, metalness: s.metalness || 0, vertexColors: true, color: s.color != null ? s.color : 0xffffff });
    } else switch (key) {
      case 'paint': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }); break;
      case 'haft': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }); break; // polished wood: weapon shafts and bows (too thin for the timber texture)
      case 'gloss': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }); break;
      case 'metalv': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.9 }); break;
      case 'glow': m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true }); m.userData.noShadow = true; break;
      case 'window': m = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x22262c, roughness: 0.15, metalness: 0.4, emissive: new THREE.Color(1.0, 0.62, 0.28), emissiveIntensity: 0 }); m.userData.noShadow = true; break;
      case 'glass': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45 }); m.userData.noShadow = true; break;
      case 'cloth2': { const t = propTex('cloth'); m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, vertexColors: true, roughness: 0.97, side: THREE.DoubleSide }); break; }
      case 'dark': m = new THREE.MeshBasicMaterial({ color: 0x050403 }); m.userData.noShadow = true; break;
      case 'water': m = new THREE.MeshStandardMaterial({ color: 0x2a5a6a, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.8 }); m.userData.noShadow = true; break;
      // baked light: soft additive pools of torchlight and shafts of daylight (no real lights; tinted by vertex colour)
      case 'lightpool': case 'shaft': {
        const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
        if (key === 'lightpool') { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
        else { for (let x = 0; x < 64; x++) { const k = Math.pow(Math.sin(Math.PI * (x + 0.5) / 64), 2); const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, `rgba(255,255,255,${0.9 * k})`); gr.addColorStop(0.75, `rgba(255,255,255,${0.35 * k})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, 0, 1, 64); } }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
        m = new THREE.MeshBasicMaterial({ map: t, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true });
        m.userData.noShadow = true; break; }
      // paintings: eight little oils in one atlas (4 x 2 cells), so every picture on every wall is one draw call
      case 'painting': { const t = new THREE.CanvasTexture(paintingAtlas()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }); break; }
      // sewage: a dark green, wet, slightly mirror-like skin on the sewer channels
      case 'sewage': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.9 }); m.userData.noShadow = true; break;
      default: m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    }
    m.name = key;
    cache.set(key, m);
    return m;
  },
  // windows glow at night: called every frame with 0..1
  setNight(k) { const w = cache.get('window'); if (w) w.emissiveIntensity = 0.05 + k * 2.4; },
};
K3.mats = mats;

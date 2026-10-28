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

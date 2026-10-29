// Aeternum Wilds — shared textured materials for buildings, props and scenery (after Kingdom Rising 3D's mats.js)
import * as THREE from 'three';
import { propTex } from './tex.js';
import { U } from './shared.js';

// metres per texture repeat when texture coordinates are projected from world space
export const MAT_UV = { stone: 2.4, fieldstone: 2.6, plaster: 3.2, timber: 1.2, planks: 1.9, rooftile: 1.6, slate: 1.8, shingle: 1.6, thatch: 2.2, bark: 1.2, birch: 1.4, pinebark: 1.2, metal: 0.8, cloth: 1.2, cloth2: 1.2, rock: 3.2, gold: 0.6 };
const TEX = { stone: 'stonebrick', fieldstone: 'fieldstone', plaster: 'plaster', timber: 'timber', planks: 'planks', rooftile: 'rooftile', slate: 'slate', shingle: 'shingle', thatch: 'thatch', bark: 'bark', birch: 'birch', pinebark: 'pinebark', metal: 'metal', gold: 'metal', cloth: 'cloth', rock: 'rock' };
const SPEC = {
  stone: { roughness: 0.88 }, fieldstone: { roughness: 0.9 }, plaster: { roughness: 0.95 }, timber: { roughness: 0.82 }, planks: { roughness: 0.8 },
  rooftile: { roughness: 0.72 }, slate: { roughness: 0.6 }, shingle: { roughness: 0.8 }, thatch: { roughness: 1 }, bark: { roughness: 0.95 }, birch: { roughness: 0.85 }, pinebark: { roughness: 0.92 },
  metal: { roughness: 0.38, metalness: 0.85 }, gold: { roughness: 0.3, metalness: 1, color: 0xe8b84a }, cloth: { roughness: 0.98 }, rock: { roughness: 0.9 },
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
      case 'gloss': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }); break;
      case 'metalv': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.9 }); break;
      case 'glow': m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true }); m.userData.noShadow = true; break;
      // windows: dark panes that light up warm at night (mats.setNight)
      case 'window': m = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x2a3038, roughness: 0.12, metalness: 0.5, emissive: new THREE.Color(1.0, 0.62, 0.28), emissiveIntensity: 0 }); m.userData.noShadow = true; break;
      case 'glass': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45 }); m.userData.noShadow = true; break;
      case 'cloth2': { const t = propTex('cloth'); m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, vertexColors: true, roughness: 0.97, side: THREE.DoubleSide }); break; }
      case 'water': m = new THREE.MeshStandardMaterial({ color: 0x2a5a6a, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85, vertexColors: true }); m.userData.noShadow = true; break;
      // magic: crystals and runes that pulse
      case 'magic': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.1, emissive: 0xffffff, emissiveIntensity: 1.6 });
        m.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.uTime; sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor * (0.75 + 0.25 * sin(uTime * 2.3 + vViewPosition.x * 0.3));'); };
        m.customProgramCacheKey = () => 'awmagic'; break;
      default: m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    }
    m.name = key;
    cache.set(key, m);
    return m;
  },
  // windows glow at night: 0..1
  setNight(k) { const w = cache.get('window'); if (w) w.emissiveIntensity = 0.03 + k * 2.6; },
};

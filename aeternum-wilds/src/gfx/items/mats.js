// Aeternum Wilds — materials for weapons, armour and item icons.
// Every material takes its colour from vertex colours (the mesh builder tints each piece), so a whole weapon is a
// handful of draw calls: steel, fittings, wood, leather, gems and glow.
// Two sets exist: 'world' materials carry their own sunny-sky reflection map (metal renders black without something
// to reflect), 'icon' materials leave that to the icon studio's scene environment.
import * as THREE from 'three';
import { G } from '../../state.js';
import { itemTex } from './tex.js';

// metres per texture repeat when texture coordinates are projected from object space
export const UV_SCALE = { steel: 0.3, metal: 0.25, wood: 0.35, leather: 0.12, cloth: 0.12, fur: 0.25, rock: 0.4, planks: 0.6, paint: 0.4, gloss: 0.4 };

let worldEnv = null, worldEnvTried = false;
// a bright outdoor sky to reflect: blue zenith, a warm sun, pale horizon haze and sunlit grass below
function makeWorldEnv(renderer) {
  const s = new THREE.Scene();
  const g = new THREE.SphereGeometry(10, 48, 24); const col = []; const p = g.attributes.position;
  const zen = new THREE.Color(0.22, 0.42, 0.85), hor = new THREE.Color(0.66, 0.7, 0.74), gnd = new THREE.Color(0.1, 0.09, 0.06), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 10; if (y >= 0) c.copy(hor).lerp(zen, Math.pow(y, 0.6)); else c.copy(hor).multiplyScalar(0.5).lerp(gnd, Math.min(1, Math.pow(-y, 0.3))); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 12, 9) })); sun.position.set(4, 7, 4); s.add(sun);
  const cloud = (x, y, z, k) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 1.02) })); m.position.set(x, y, z); m.scale.set(2, 0.6, 1.2); s.add(m); };
  cloud(-6, 4, -5, 1.6); cloud(5, 3, -6, 1.4); cloud(-3, 5, 6, 1.5);
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(s, 0.02); pm.dispose();
  g.dispose();
  return rt.texture;
}
function getWorldEnv() {
  if (!worldEnv && !worldEnvTried && G.renderer) { worldEnvTried = true; try { worldEnv = makeWorldEnv(G.renderer); } catch (e) { console.warn('weapon env failed', e); } }
  return worldEnv;
}

const SPEC = {
  // blades: brushed steel, tinted per tier by vertex colour
  steel: { tex: 'steel', metalness: 1, roughness: 0.32, env: 0.9 },
  // guards, pommels, bands, rivets, rims
  metal: { tex: 'metal', metalness: 1, roughness: 0.32, env: 0.95 },
  wood: { tex: 'wood', roughness: 0.62, env: 0.45 },
  leather: { tex: 'leather', roughness: 0.68, env: 0.4 },
  cloth: { tex: 'cloth', roughness: 0.92, env: 0.3, side: THREE.DoubleSide },
  fur: { tex: 'fur', roughness: 1, env: 0.2 },
  rock: { tex: 'rock', roughness: 0.9, env: 0.3 },
  planks: { tex: 'planks', roughness: 0.75, env: 0.35 },
  paint: { roughness: 0.6, env: 0.45 },
  gloss: { roughness: 0.25, env: 0.7 },
  bone: { roughness: 0.55, env: 0.4 },
  // gem stones: glassy, lit a little from within
  gem: { roughness: 0.08, metalness: 0.1, env: 1.6, emissive: 0.45 },
  // potion glass
  glass: { roughness: 0.04, metalness: 0, env: 1.6, transparent: true, opacity: 0.42, depthWrite: false },
};
const sets = { world: new Map(), icon: new Map() };
export function itemMat(key, ctx = 'world') {
  const set = sets[ctx]; let m = set.get(key); if (m) return m;
  if (key === 'glow') {
    // runes, gem cores, embers: unlit, bright enough to bloom (vertex colours may exceed 1)
    m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true });
    m.userData.noShadow = true;
  } else if (key === 'liquid') {
    m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
    m.userData.noShadow = true;
  } else {
    const s = SPEC[key] || SPEC.paint;
    // icons: a touch less mirror-like, so big flat faces (axe bits, hammer heads) don't reflect a dark studio wall
    const icon = ctx === 'icon' && (s.metalness || 0) > 0.5;
    const o = { vertexColors: true, roughness: icon ? s.roughness + 0.12 : s.roughness, metalness: icon ? 0.72 : s.metalness || 0 };
    if (s.tex) { const t = itemTex(s.tex); o.map = t.map; o.normalMap = t.normalMap; if (t.rough) o.roughnessMap = t.rough; o.normalScale = new THREE.Vector2(0.8, 0.8); }
    if (s.side) o.side = s.side;
    if (ctx === 'icon' && !s.transparent) o.side = THREE.DoubleSide; // open shells (hoods, cuffs, pauldrons) seen from any side
    if (s.transparent) { o.transparent = true; o.opacity = s.opacity; o.depthWrite = s.depthWrite; }
    m = new THREE.MeshStandardMaterial(o);
    if (s.emissive) { m.emissive = new THREE.Color(1, 1, 1); m.emissiveIntensity = s.emissive; m.onBeforeCompile = gemEmissive; m.customProgramCacheKey = () => 'gemEmissive'; }
    m.envMapIntensity = s.env;
    if (ctx === 'world') { const env = getWorldEnv(); if (env) m.envMap = env; }
    if (s.transparent) m.userData.noShadow = true;
  }
  m.name = 'item-' + key;
  set.set(key, m);
  return m;
}
// gems glow in their own colour: emissive multiplied by the vertex colour
function gemEmissive(sh) {
  sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif');
}

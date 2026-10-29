// Kingdom Rising 3D — real 3D models (assets/models/*.glb: CC0 scans and models from Poly Haven, optimised with
// glTF-Transform). Each is loaded once and handed out as clones; a model can be asked for before it has arrived, and
// whatever asked gets it as soon as it is there.
import { THREE, K3 } from './core.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = new URL('../assets/models/', import.meta.url).href;
const loader = new GLTFLoader();
const cache = new Map(); // name -> Promise<THREE.Object3D>
// how each model is turned and placed so that, like the game's own ships, its bow points to +z and the waterline
// (or the ground) is at y = 0
const FIT = {
  // the ships are scaled to the harbour's berths (still long, tall ships: 17 to 21 m from stern to bowsprit)
  dutch_ship_medium: { ry: -Math.PI / 2, s: 0.72 }, dutch_ship_large_01: { ry: -Math.PI / 2, s: 0.62 }, ship_pinnace: { ry: 0, s: 0.52 },
};
// ropes are thinner than a pixel a little way off and break up into dots: they swell with distance so that each one
// always covers about a pixel and reads as a whole line, as rigging does to the eye
function ropeWidth(m) {
  if (m.color) m.color.multiplyScalar(0.42); // tarred hemp: dark against the sky, as standing rigging is
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    { vec4 kwp = modelMatrix * vec4(transformed, 1.); float kd = length(kwp.xyz - cameraPosition); float ks = length(modelMatrix[0].xyz);
      transformed += normalize(objectNormal) * kd * .0019 / ks; }`); };
  m.customProgramCacheKey = () => 'krrope'; m.needsUpdate = true;
}
export function loadModel(name) {
  if (!cache.has(name)) cache.set(name, new Promise((ok, no) => loader.load(BASE + name + '.glb', (g) => {
    const root = g.scene; const f = FIT[name] || {};
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material.envMapIntensity = 1; if (o.material.map) o.material.map.anisotropy = Math.min(8, K3.maxAniso || 4); } } });
    root.traverse((o) => { if (o.isMesh && /rigging|rope/i.test(o.name)) ropeWidth(o.material); });
    const holder = new THREE.Group(); holder.name = name; if (f.ry) root.rotation.y = f.ry; if (f.s) root.scale.setScalar(f.s); holder.add(root);
    holder.updateMatrixWorld(true); ok(holder);
  }, undefined, (e) => { console.warn('model', name, e); no(e); })));
  return cache.get(name).then((m) => m.clone(true));
}
// a model put into a group as soon as it is loaded (the group can be placed and shown at once)
export function modelInto(group, name, after) { loadModel(name).then((m) => { group.add(m); if (after) after(m); }).catch(() => {}); return group; }
// the height of the topmost surface of an object under a point (local x, z), found by casting a ray straight down
const rc = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3(0, -1, 0);
export function surfaceY(obj, x, z, from = 40) {
  obj.updateMatrixWorld(true); _o.set(x, from, z).applyMatrix4(obj.matrixWorld); rc.set(_o, _d); rc.far = from * 2;
  const hit = rc.intersectObject(obj, true).find((h) => h.object.isMesh && !/rig|rope|sail|flag/i.test(h.object.name));
  return hit ? obj.worldToLocal(hit.point.clone()).y : null;
}
K3.loadModel = loadModel;
// which real ship a kingdom sails (the elves' is the sleeker pinnace), and the merchantmen moored in every harbour
export const SHIP_MODEL = (f) => (f === 'sylvan' ? 'ship_pinnace' : 'dutch_ship_medium');

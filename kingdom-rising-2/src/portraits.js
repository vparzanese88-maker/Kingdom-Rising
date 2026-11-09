// Class portraits for the Kingdom Arena pickers: each class's arena look, rendered once to a picture (head and
// shoulders, three-quarter view, warm key light, cool rim, a soft backdrop) and kept for the rest of the session.
import * as THREE from 'three';
import { buildHumanoid, equipWeapon, animateHumanoid, bake } from './character.js';
import { CLASSES } from './data.js';
import { arenaSpec, arenaBody, arenaDecor, arenaWeaponDecor, addOutline } from './arenalooks.js';
import { hasHeroModel, tickHeroModel } from './heromodels.js';

const CACHE = {}; let R = null, scene = null, cam = null;
const W = 220, H = 280;
export const RACE = { warrior: 'human', berserker: 'orc', ranger: 'woodelf', wizard: 'human', musketeer: 'woodelf', shaman: 'orc', cleric: 'dwarf', paladin: 'human', darkknight: 'human', druid: 'woodelf', monk: 'human', bard: 'highelf', rogue: 'human', necromancer: 'human', elementalist: 'highelf', enchanter: 'highelf', beastmaster: 'orc', blunderbuss: 'dwarf', priest: 'human', bombardier: 'halfling' };
function setup() {
  R = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true }); R.setSize(W, H, false); R.setPixelRatio(1); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  scene = new THREE.Scene();
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#3a2c1a'); gr.addColorStop(0.6, '#1e160e'); gr.addColorStop(1, '#0c0906'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const bg = new THREE.CanvasTexture(c); bg.colorSpace = THREE.SRGBColorSpace; scene.background = bg;
  const key = new THREE.DirectionalLight('#ffe4c0', 2.6); key.position.set(1.5, 2.5, 2.5); scene.add(key);
  const rim = new THREE.DirectionalLight('#8ab8ff', 2.2); rim.position.set(-2, 1.5, -2.5); scene.add(rim);
  scene.add(new THREE.HemisphereLight('#d8c8b0', '#2a2018', 0.9));
  cam = new THREE.PerspectiveCamera(26, W / H, 0.1, 30);
}
// pre-rendered pictures (models/portraits/<class>.jpg): the menus show these at once instead of building every class in 3D
const STATIC = new Set(['bard','beastmaster','berserker','blunderbuss','bombardier','cleric','darkknight','druid','elementalist','enchanter','monk','musketeer','necromancer','paladin','priest','ranger','rogue','shaman','warrior','wizard']);
export function classPortrait(cls) {
  if (STATIC.has(cls)) return 'models/portraits/' + cls + '.jpg';
  if (CACHE[cls]) return CACHE[cls];
  try {
    if (!R) setup();
    const ch = buildHumanoid({ race: RACE[cls] || 'human', sex: 'm', cls, outfit: cls, spec: arenaSpec(cls), body: arenaBody(cls), skin: cls === 'musketeer' ? '#7a9a3a' : cls === 'blunderbuss' ? '#4f6a2a' : cls === 'bombardier' ? '#8aa23a' : '#d8a888', hair: '#3a2a1a' }); arenaDecor(ch, cls);
    try { equipWeapon(ch, CLASSES[cls].weapons[0], 3, 0); arenaWeaponDecor(ch, cls); } catch (e) { /* no weapon model */ }
    animateHumanoid(ch, 0.016, { speed: 0, armed: true, ready: true }); bake(ch.root); addOutline(ch.root);
    ch.root.rotation.y = 0.45; scene.add(ch.root); ch.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(ch.root), top = box.max.y, h = top - box.min.y;
    const look = new THREE.Vector3(0, top - h * 0.3, 0); cam.position.set(0.15 * h, look.y + 0.035 * h, 1.26 * h); cam.lookAt(look); /* (framed by the hero's own height: giants and goblins both fit) */
    R.render(scene, cam); CACHE[cls] = R.domElement.toDataURL('image/jpeg', 0.86);
    scene.remove(ch.root);
    if (hasHeroModel(cls)) { { const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const g2 = c2.getContext('2d'); g2.drawImage(R.domElement, 0, 0); g2.fillStyle = 'rgba(242,223,176,0.55)'; g2.font = '600 15px Georgia, serif'; g2.textAlign = 'center'; g2.fillText('loading ' + (CLASSES[cls].name || cls) + '…', W / 2, H * 0.55); CACHE[cls] = c2.toDataURL('image/jpeg', 0.86); } /* (a placeholder unique to this class until the model has loaded) */ // a class with a real 3D model: once it has loaded, picture the model and swap every copy of the picture already on screen
      const t0 = performance.now(), wait = () => { const H = ch.heroModel; if (H === 'loading' || H === undefined) { if (performance.now() - t0 < 30000) setTimeout(wait, 200); return; } if (!H) return;
        scene.add(ch.root); for (let i = 0; i < 4; i++) tickHeroModel(ch, 0.05); ch.root.updateMatrixWorld(true); const bx = new THREE.Box3().setFromObject(H.m), tp = bx.max.y, hh = tp - bx.min.y, lk = new THREE.Vector3(0, tp - hh * 0.3, 0); cam.position.set(0.15 * hh, lk.y + 0.035 * hh, 1.26 * hh); cam.lookAt(lk); /* (framed by the model's own height) */
        R.render(scene, cam); const old = CACHE[cls], url = R.domElement.toDataURL('image/jpeg', 0.86); CACHE[cls] = url; scene.remove(ch.root);
        document.querySelectorAll('img').forEach(im => { if (im.src === old) im.src = url; }); };
      wait(); }
  } catch (e) { console.warn('portrait', cls, e); CACHE[cls] = ''; }
  return CACHE[cls];
}

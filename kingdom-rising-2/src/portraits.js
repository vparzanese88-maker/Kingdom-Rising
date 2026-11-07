// Class portraits for the Kingdom Arena pickers: each class's arena look, rendered once to a picture (head and
// shoulders, three-quarter view, warm key light, cool rim, a soft backdrop) and kept for the rest of the session.
import * as THREE from 'three';
import { buildHumanoid, equipWeapon, animateHumanoid, bake } from './character.js';
import { CLASSES } from './data.js';
import { arenaSpec, arenaBody, arenaDecor, arenaWeaponDecor, addOutline } from './arenalooks.js';

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
export function classPortrait(cls) {
  if (CACHE[cls]) return CACHE[cls];
  try {
    if (!R) setup();
    const ch = buildHumanoid({ race: RACE[cls] || 'human', sex: 'm', cls, outfit: cls, spec: arenaSpec(cls), body: arenaBody(cls), skin: cls === 'musketeer' ? '#7a9a3a' : cls === 'blunderbuss' ? '#4f6a2a' : cls === 'bombardier' ? '#8aa23a' : '#d8a888', hair: '#3a2a1a' }); arenaDecor(ch, cls);
    try { equipWeapon(ch, CLASSES[cls].weapons[0], 3, 0); arenaWeaponDecor(ch, cls); } catch (e) { /* no weapon model */ }
    animateHumanoid(ch, 0.016, { speed: 0, armed: true, ready: true }); bake(ch.root); addOutline(ch.root);
    ch.root.rotation.y = 0.45; scene.add(ch.root); ch.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(ch.root), top = box.max.y, h = top - box.min.y;
    const look = new THREE.Vector3(0, top - h * 0.3, 0); cam.position.set(0.35, look.y + 0.08, 2.9); cam.lookAt(look);
    R.render(scene, cam); CACHE[cls] = R.domElement.toDataURL('image/jpeg', 0.86);
    scene.remove(ch.root);
  } catch (e) { console.warn('portrait', cls, e); CACHE[cls] = ''; }
  return CACHE[cls];
}

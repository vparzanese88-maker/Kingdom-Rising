// Kingdom Rising 3D — your hero as a real 3D model in the inventory: lit like a studio portrait, breathing,
// turning slowly; drag to spin. It wears exactly what is equipped and rebuilds the moment gear changes.
import { THREE, K3 } from './core.js';
import { makeHumanoid, animateHumanoid } from './chars.js';
import { studioEnv } from './items3d.js';

const KR = window.KR, G = KR.G, D = KR.D, UI = KR.UI;
let renderer = null, scene, cam, rig = null, sig = '', yaw = 0.35, drag = null, raf = 0, holder;

function setup(cv) {
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene(); scene.environment = studioEnv(renderer); scene.environmentIntensity = 0.8;
  cam = new THREE.PerspectiveCamera(26, 220 / 300, 0.1, 30);
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x3a2a1c, 1.1));
  const key = new THREE.DirectionalLight(0xffe2b8, 2.6); key.position.set(1.6, 3.2, 2.4); key.castShadow = true; key.shadow.mapSize.set(512, 512);
  Object.assign(key.shadow.camera, { left: -1.2, right: 1.2, top: 2.4, bottom: -0.2, near: 0.5, far: 8 }); key.shadow.bias = -0.0005; scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ab8ff, 1.6); rim.position.set(-2.2, 2.4, -2.6); scene.add(rim);
  const fill = new THREE.PointLight(0xffb070, 0.9, 6); fill.position.set(-1.2, 1.0, 1.6); scene.add(fill);
  // a round stone floor with a warm pool of light
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.76, 48), new THREE.MeshBasicMaterial({ color: 0xc8a050 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002; scene.add(ring);
  holder = new THREE.Group(); scene.add(holder);
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: yaw }; cv.setPointerCapture(e.pointerId); e.stopPropagation(); });
  cv.addEventListener('pointermove', (e) => { if (drag) yaw = drag.y + (e.clientX - drag.x) * 0.012; });
  cv.addEventListener('pointerup', () => { drag = null; });
}
function lookSig(l) { return JSON.stringify(l); }
function rebuild(look) {
  if (rig) { holder.remove(rig.mesh); rig = null; }
  rig = makeHumanoid(look, 'player');
  rig.mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  if (rig.setLod) rig.setLod(0);
  holder.add(rig.mesh);
  const sc = (D.RACES[look.race] && D.RACES[look.race].scale) || 1; const h = 1.85 * sc;
  holder.scale.setScalar(1);
  cam.position.set(0, h * 0.56, h * 2.25); cam.lookAt(0, h * 0.5, 0);
}
let last = 0;
function frame(t) {
  raf = 0;
  const cv = UI._invCv; const w = UI.wins.inv;
  if (!cv || !cv.isConnected || !w || w.el.hidden || !G.player) return;
  const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
  const look = G.player.look || G.lookFor(G.player.c);
  const s = lookSig(look); if (s !== sig) { sig = s; rebuild(look); }
  if (!drag) yaw += dt * 0.25;
  if (UI._invYaw) { yaw += UI._invYaw; UI._invYaw = 0; }
  holder.rotation.y = yaw;
  if (rig) animateHumanoid(rig, { move: 0, dist: 0, atk: 0, combat: false, sit: false }, dt);
  renderer.render(scene, cam);
  raf = requestAnimationFrame(frame);
}
UI.heroPortrait3D = function (cv) {
  if (!renderer) setup(cv);
  if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
};

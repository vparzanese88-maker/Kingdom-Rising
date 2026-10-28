// Kingdom Rising 3D — a hero on a little stage, drawn into any canvas with a see-through background, so the
// 3D world shows behind it: used by the main menu and character creation. Drag to turn; the camera can
// frame the whole body or come in close on the face while you shape it.
import { THREE, K3 } from './core.js';
import { makeHumanoid, animateHumanoid } from './chars.js';
import { studioEnv } from './items3d.js';

const KR = window.KR, D = KR.D;
const sigOf = (l) => JSON.stringify(l, (k, v) => (k === 'wItem' || k === 'oItem' ? (v && v.uid) : v));

// one WebGL renderer shared by every hero view (browsers allow only a handful of WebGL contexts): each view
// renders its own little scene with it, then copies the picture into its own canvas
let shared = null;
function sharedRenderer() {
  if (shared) return shared;
  const c = document.createElement('canvas'); c.width = 4; c.height = 4;
  shared = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, powerPreference: 'high-performance' });
  shared.setClearColor(0x000000, 0); shared.outputColorSpace = THREE.SRGBColorSpace; shared.toneMapping = THREE.ACESFilmicToneMapping; shared.toneMappingExposure = 1.1;
  shared.shadowMap.enabled = true; shared.shadowMap.type = THREE.PCFSoftShadowMap;
  shared.env = studioEnv(shared);
  return shared;
}
export function createHeroView(cv, opt = {}) {
  const renderer = sharedRenderer(); const g2 = cv.getContext('2d');
  const scene = new THREE.Scene(); scene.environment = renderer.env; scene.environmentIntensity = 0.75;
  const cam = new THREE.PerspectiveCamera(24, 1, 0.05, 40);
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x3a2a1c, 1.0));
  const key = new THREE.DirectionalLight(0xffe2b8, 2.8); key.position.set(1.8, 3.4, 2.6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1.4, right: 1.4, top: 2.6, bottom: -0.2, near: 0.5, far: 9 }); key.shadow.bias = -0.0004; scene.add(key);
  const rim = new THREE.DirectionalLight(opt.rim || 0x9ab8ff, 2.2); rim.position.set(-2.4, 2.6, -2.8); scene.add(rim);
  const fill = new THREE.PointLight(opt.fill || 0xffa060, 1.2, 7); fill.position.set(-1.4, 1.1, 1.8); scene.add(fill);
  // a stone dais with a glowing rim
  const dais = new THREE.Group(); scene.add(dais);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.12, 48), new THREE.MeshStandardMaterial({ color: 0x5a4c3e, roughness: 0.85 })); top.position.y = -0.06; top.receiveShadow = true; dais.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.012, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(opt.ring || '#e0b050').multiplyScalar(2), toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.002; dais.add(ring);
  const holder = new THREE.Group(); scene.add(holder);
  const v = { cv, yaw: opt.yaw != null ? opt.yaw : 0.4, spin: opt.spin != null ? opt.spin : 0.18, look: null, sig: '', rig: null, mode: 'full', camK: 0, alive: true, h: 1.8, pose: opt.pose || 'idle' };
  let drag = null;
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: v.yaw }; try { cv.setPointerCapture(e.pointerId); } catch (er) {} e.stopPropagation(); });
  cv.addEventListener('pointermove', (e) => { if (drag) v.yaw = drag.y + (e.clientX - drag.x) * 0.012; });
  cv.addEventListener('pointerup', () => { drag = null; });
  v.set = (look) => { v.look = look; };
  v.focus = (mode) => { v.mode = mode; };
  v.dispose = () => { v.alive = false; scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); };
  let last = 0;
  const frame = (t) => {
    if (!v.alive) return;
    if (!cv.isConnected) { v.dispose(); return; }
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    const pr = Math.min(2, devicePixelRatio || 1);
    const W = Math.round((cv.clientWidth || cv.width) * pr), H = Math.round((cv.clientHeight || cv.height) * pr); if (!W || !H) return;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    if (v.look) { const s = sigOf(v.look); if (s !== v.sig) { v.sig = s; if (v.rig) holder.remove(v.rig.mesh); v.rig = makeHumanoid(v.look, 'player'); v.rig.mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } }); if (v.rig.setLod) v.rig.setLod(0); holder.add(v.rig.mesh); v.h = 1.85 * ((D.RACES[v.look.race] || {}).scale || 1) * (1 + (v.look.tall || 0) * 0.06); } }
    if (!drag) v.yaw += dt * v.spin * (v.mode === 'face' ? 0.3 : 1);
    holder.rotation.y = v.yaw;
    if (v.rig) animateHumanoid(v.rig, { move: 0, dist: 0, atk: 0, combat: v.pose === 'ready', sit: false }, dt);
    // camera: whole body, or close on the face
    cam.aspect = W / H; cam.updateProjectionMatrix();
    v.camK += ((v.mode === 'face' ? 1 : 0) - v.camK) * Math.min(1, dt * 4);
    const k = K3.smooth(0, 1, v.camK), h = v.h;
    const fy = THREE.MathUtils.lerp(h * 0.52, h * 0.9, k), fd = THREE.MathUtils.lerp(h * 2.85, h * 0.62, k) / Math.min(1, cam.aspect * 1.4);
    cam.position.set(0, fy + THREE.MathUtils.lerp(h * 0.05, 0.02, k), fd); cam.lookAt(0, fy, 0);
    renderer.setSize(W, H, false);
    renderer.render(scene, cam);
    g2.clearRect(0, 0, W, H); g2.drawImage(renderer.domElement, 0, 0);
  };
  requestAnimationFrame(frame);
  return v;
}
// a still picture of a hero (for small cards): renders once into an image
let snapR = null, snapScene, snapCam, snapHolder;
export function heroSnap(look, w = 120, h = 150, yaw = 0.35, zoom = 1) {
  if (!snapR) {
    snapR = sharedRenderer();
    snapScene = new THREE.Scene(); snapScene.environment = snapR.env; snapScene.environmentIntensity = 0.8;
    snapScene.add(new THREE.HemisphereLight(0xfff0dc, 0x3a2a1c, 1.2)); const k = new THREE.DirectionalLight(0xffe2b8, 2.6); k.position.set(1.8, 3.4, 2.6); snapScene.add(k); const r = new THREE.DirectionalLight(0x9ab8ff, 1.8); r.position.set(-2.4, 2.6, -2.8); snapScene.add(r);
    snapCam = new THREE.PerspectiveCamera(22, 240 / 300, 0.05, 40); snapHolder = new THREE.Group(); snapScene.add(snapHolder);
  }
  snapR.setSize(w * 2, h * 2, false); snapCam.aspect = w / h; snapCam.updateProjectionMatrix();
  snapHolder.clear(); const rig = makeHumanoid(look, 'player'); if (rig.setLod) rig.setLod(0); rig.mesh.traverse((o) => { if (o.isMesh) o.frustumCulled = false; }); snapHolder.add(rig.mesh); snapHolder.rotation.y = yaw;
  animateHumanoid(rig, { move: 0, dist: 0, atk: 0, combat: true }, 0.016);
  const H = 1.85 * ((D.RACES[look.race] || {}).scale || 1);
  snapCam.position.set(0, H * (zoom > 1 ? 0.88 : 0.55), H * 2.5 / Math.min(1, snapCam.aspect * 1.4) / zoom); snapCam.lookAt(0, H * (zoom > 1 ? 0.86 : 0.5), 0); // zoom > 1: a close-up of the head and shoulders
  snapR.render(snapScene, snapCam);
  return snapR.domElement.toDataURL('image/png');
}
K3.createHeroView = createHeroView; K3.heroSnap = heroSnap;
KR.heroView3D = createHeroView; KR.heroSnap = heroSnap;

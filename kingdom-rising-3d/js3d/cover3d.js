// Kingdom Rising — the cover: the two real kings of the game (the same models you meet in their halls:
// crowns, armour, capes and beards) face each other over the painted burning city, both straining at one
// golden crown. Lit from behind by the fire, the crown wrenched back and forth between their hands.
import { THREE, K3 } from './core.js';
import { makeHumanoid, animateHumanoid } from './chars.js';
import { studioEnv } from './items3d.js';

const KR = window.KR, D = KR.D, G = KR.G;

// the kings as the world has them, or as their faction dresses them if the world is not built yet
function kingLook(f) {
  const k = G.ents && G.ents.find((e) => e.type === 'king' && e.faction === f && !e.dead);
  let L = k && (k.look || (KR.Sys.npcLook && KR.Sys.npcLook(k)));
  if (!L) { const sy = f === 'sylvan'; const hc = sy ? '#a83a22' : '#3a2a1c'; L = { race: sy ? 'highelf' : 'human', gender: 'm', skin: sy ? '#e8c8a8' : '#d8a888', hair: hc, hairStyle: sy ? 2 : 1, beard: hc, armor: { kind: 'plate', col: sy ? '#2e5a3a' : '#28457a', trim: '#e0b84a' }, crown: true, cape: sy ? '#1e4a2c' : '#7a1e1e' }; }
  return Object.assign({}, L, { weapon: null, offhand: null, ranged: null, back: null, crown: true });
}
function crownMesh() {
  const g = new THREE.Group(); const gold = new THREE.MeshStandardMaterial({ color: 0xf0c048, metalness: 1, roughness: 0.22, emissive: 0x3a1c00, emissiveIntensity: 0.6 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.098, 0.065, 40, 1, true), gold); band.material.side = THREE.DoubleSide; g.add(band);
  for (const y of [-0.03, 0.03]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.103, 0.007, 8, 40), gold); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
  const gems = [0xff2a3a, 0x2a6aff, 0x2aff7a];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.085, 8), gold); sp.position.set(Math.cos(a) * 0.1, 0.07, Math.sin(a) * 0.1); g.add(sp);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), gold); ball.position.set(Math.cos(a) * 0.1, 0.118, Math.sin(a) * 0.1); g.add(ball);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), new THREE.MeshStandardMaterial({ color: gems[k % 3], emissive: gems[k % 3], emissiveIntensity: 1.6, roughness: 0.1 })); gem.position.set(Math.cos(a + 0.39) * 0.104, 0, Math.sin(a + 0.39) * 0.104); gem.scale.set(1, 1.2, 0.6); gem.lookAt(0, 0, 0); g.add(gem);
  }
  return g;
}

export function coverKings(cv) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene(); scene.environment = studioEnv(renderer); scene.environmentIntensity = 0.28;
  const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
  // the fire behind them: hot rim lights; a dim cold fill from the front, and the crown's own glow
  scene.add(new THREE.HemisphereLight(0x5a3a5a, 0x2a0a04, 0.55));
  const rimL = new THREE.DirectionalLight(0xff7a2a, 5.5); rimL.position.set(-2.5, 1.8, -3.5); scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0xff9a3a, 5.0); rimR.position.set(2.5, 1.6, -3.5); scene.add(rimR);
  const under = new THREE.PointLight(0xff5a1a, 6, 6, 1.6); under.position.set(0, 0.4, -1.2); scene.add(under);
  const front = new THREE.DirectionalLight(0x8a9ac8, 1.1); front.position.set(0.6, 1.6, 4); scene.add(front);
  const glow = new THREE.PointLight(0xffc860, 2.2, 2.2, 2); scene.add(glow);
  const kings = [];
  for (const [f, side] of [['crown', -1], ['sylvan', 1]]) {
    const rig = makeHumanoid(kingLook(f), 'npc'); if (rig.setLod) rig.setLod(0);
    rig.mesh.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    const holder = new THREE.Group(); holder.add(rig.mesh); holder.rotation.y = -side * (Math.PI / 2 - 0.38); // each faces the other, turned a little toward us
    scene.add(holder); kings.push({ rig, holder, side });
  }
  const crown = crownMesh(); crown.scale.setScalar(1.7); scene.add(crown);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
  let alive = true, last = 0, t = 0, gap = 0.5;
  const frame = (now) => {
    if (!alive) return;
    if (!cv.isConnected) { stop(); return; }
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; t += dt;
    const pr = Math.min(1.5, devicePixelRatio || 1);
    const W = Math.round(innerWidth * pr), H = Math.round(innerHeight * pr);
    if (cv.width !== W || cv.height !== H) renderer.setSize(W, H, false);
    // the struggle: the crown is wrenched one way, then the other
    const tug = Math.sin(t * 1.25) * 0.045 + Math.sin(t * 3.1) * 0.01;
    for (const k of kings) {
      animateHumanoid(k.rig, { move: 0, dist: 0, atk: 0, combat: false }, dt);
      const B = k.rig.bones, pull = -k.side * tug; // >0: this king is winning, leaning back
      for (const s of ['L', 'R']) { const inw = s === 'L' ? -1 : 1; B['arm' + s].rotation.x = -1.32 + pull * 1.5; B['arm' + s].rotation.z = inw * (0.32 + pull); B['fore' + s].rotation.x = -0.35 - pull * 2; }
      B.chest.rotation.x = 0.12 - pull * 1.5; B.head.rotation.x = -0.05 + pull * 0.8; B.spine.rotation.x = 0.06;
      B.thighL.rotation.x = -0.25; B.shinL.rotation.x = 0.2; B.thighR.rotation.x = 0.3; // braced, one foot forward
      k.holder.position.set(k.side * gap + tug * 0.5, 0, 0);
    }
    // keep the hands of the two kings close: find their reach, set the gap once, then put the crown between all four hands
    scene.updateMatrixWorld(true);
    const hands = kings.map((k) => { k.rig.bones.handL.getWorldPosition(_a); k.rig.bones.handR.getWorldPosition(_b); return _a.clone().add(_b).multiplyScalar(0.5); });
    const span = hands[1].x - hands[0].x; if (Math.abs(span - 0.32) > 0.01) gap = Math.max(0.2, gap - (span - 0.32) * 0.5);
    _c.copy(hands[0]).add(hands[1]).multiplyScalar(0.5); _c.y += 0.02;
    crown.position.copy(_c); crown.rotation.set(Math.sin(t * 1.25) * 0.18, t * 0.15, Math.sin(t * 2.3) * 0.08);
    glow.position.copy(_c).add(new THREE.Vector3(0, 0.1, 0.25)); glow.intensity = 2 + Math.sin(t * 6) * 0.3;
    // firelight flickers
    const fl = 1 + Math.sin(t * 9.1) * 0.08 + Math.sin(t * 13.7) * 0.06 + (Math.random() - 0.5) * 0.06;
    rimL.intensity = 5.5 * fl; rimR.intensity = 5.0 * (2 - fl); under.intensity = 6 * fl;
    // framing: the kings fill the lower part of the screen, the title sits above their crowns
    cam.aspect = W / H; const narrow = Math.min(1, cam.aspect / 1.5);
    cam.fov = 26 / Math.max(0.55, narrow); cam.updateProjectionMatrix();
    cam.position.set(0, 0.95, 6.4); cam.lookAt(0, 1.72, 0);
    renderer.render(scene, cam);
  };
  requestAnimationFrame(frame);
  const stop = () => { if (!alive) return; alive = false; renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {} };
  return { stop };
}
KR.coverKings = coverKings;

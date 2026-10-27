// Kingdom Rising 3D — the light you carry: whatever sits in your Light slot hangs at your hip as a little
// model (candle, candelabrum, lantern, glowing jar, censer, phial, sunstone) and lights the world around
// you at night. Blow it out (L) and the dark closes in.
import { THREE, K3 } from './core.js';
import { MB } from './mb.js';

const KR = window.KR, G = KR.G;
// one light that is always in the scene (switching lights on and off would make every material recompile)
const light = new THREE.PointLight(0xffb060, 0, 10, 2); light.castShadow = false; K3.scene.add(light);
let model = null, modelFor = '', boundRig = null, flame = null;
const glowMat = (hex, k = 3) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false });

function build(id) {
  const mb = new MB(); const g = new THREE.Group(); let f = null;
  const flameAt = (x, y, z, s = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.012 * s, 8, 6), glowMat('#ffb050', 4)); m.scale.set(1, 2.2, 1); m.position.set(x, y, z); g.add(m); f = f || []; f.push(m); };
  switch (id) {
    case 'tallow': case 'beeswax': { const wax = id === 'tallow' ? '#e8dcb8' : '#f0d070';
      mb.cylB('metalv', 0, 0, 0, 0.05, 0.012, '#5a4a3a', 12); mb.cylB('plaster', 0, 0.012, 0, 0.018, 0.11, wax, 10); flameAt(0, 0.14, 0); break; }
    case 'candelabrum':
      mb.cylB('metalv', 0, 0, 0, 0.05, 0.015, '#3a3a40', 12); mb.cylB('metalv', 0, 0.015, 0, 0.009, 0.1, '#3a3a40', 8); mb.box('metalv', 0, 0.115, 0, 0.16, 0.012, 0.012, '#3a3a40');
      for (const x of [-0.075, 0, 0.075]) { mb.cylB('metalv', x, 0.12, 0, 0.016, 0.01, '#3a3a40', 8); mb.cylB('plaster', x, 0.13, 0, 0.012, x ? 0.07 : 0.09, '#efe6cc', 8); flameAt(x, x ? 0.215 : 0.235, 0, 0.9); } break;
    case 'hooded': case 'brass': case 'great': { const s = id === 'great' ? 1.4 : id === 'brass' ? 1.1 : 1; const met = id === 'brass' ? '#c8a050' : '#3a3a40';
      mb.box('metalv', 0, 0, 0, 0.09 * s, 0.015 * s, 0.09 * s, met); mb.box('metalv', 0, 0.14 * s, 0, 0.1 * s, 0.02 * s, 0.1 * s, met); mb.cone('metalv', 0, 0.15 * s, 0, 0.06 * s, 0.05 * s, met, 8);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mb.cylB('metalv', x * 0.04 * s, 0.015 * s, z * 0.04 * s, 0.005 * s, 0.125 * s, met, 6);
      if (id === 'hooded') { mb.box('metalv', 0, 0.075 * s, -0.04 * s, 0.085 * s, 0.12 * s, 0.006, met); mb.box('metalv', -0.04 * s, 0.075 * s, 0, 0.006, 0.12 * s, 0.085 * s, met); }
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.075 * s, 0.12 * s, 0.075 * s), new THREE.MeshStandardMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.25, roughness: 0.1, emissive: 0xffa040, emissiveIntensity: 0.6 })); glass.position.y = 0.075 * s; g.add(glass);
      mb.torus && mb.torus('metalv', 0, 0.2 * s, 0, 0.025 * s, 0.004, met);
      flameAt(0, 0.07 * s, 0, s); break; }
    case 'glowcap': {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 14), new THREE.MeshStandardMaterial({ color: 0xc8ffd0, transparent: true, opacity: 0.35, roughness: 0.05 })); jar.position.y = 0.06; g.add(jar);
      mb.cylB('timber', 0, 0.12, 0, 0.035, 0.025, '#6a4a2a', 10);
      for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), glowMat('#6aff8a', 2.5)); m.position.set(Math.cos(k * 1.6) * 0.022, 0.02 + k * 0.022, Math.sin(k * 1.6) * 0.022); g.add(m); } break; }
    case 'censer':
      mb.box('metalv', 0, 0.2, 0, 0.004, 0.16, 0.004, '#8a6a3a');
      { const c = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.9, roughness: 0.35 })); c.position.y = 0.08; g.add(c); }
      flameAt(0, 0.12, 0, 1.6); f[0].material = glowMat('#ff6a2a', 3.5); break;
    case 'phial': { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), glowMat('#cfe4ff', 3)); m.scale.set(0.8, 1.6, 0.8); m.position.y = 0.08; g.add(m); f = [m]; mb.cylB('gold', 0, 0.0, 0, 0.02, 0.02, '#e0c060', 8); break; }
    case 'sunstone': { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 1), glowMat('#ffd860', 3.5)); m.position.y = 0.09; g.add(m); f = [m]; mb.cylB('gold', 0, 0.0, 0, 0.04, 0.03, '#e0c060', 10); for (let k = 0; k < 4; k++) mb.box('gold', Math.cos(k * 1.57) * 0.04, 0.07, Math.sin(k * 1.57) * 0.04, 0.008, 0.08, 0.008, '#e0c060'); break; }
  }
  const body = mb.build(); if (body) g.add(body);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return { g, f: f || [] };
}

K3.lightModel = (id) => { const m = build(id); return m.g; };
let flick = 0;
K3.updaters.push((dt, t) => {
  const p = G.player; const rig = K3.playerRig;
  const it = p && KR.Gear ? KR.Gear.lightOf(p.c) : null;
  const id = it ? it.light : '';
  // the model, hanging from the left hip
  if (id !== modelFor || rig !== boundRig) {
    if (model && model.g.parent) model.g.parent.remove(model.g);
    model = null; modelFor = id; boundRig = rig;
    if (id && rig && rig.bones.hips) { model = build(id); const r = rig.rest; model.g.position.set(r.hips[0] + 0.19, -0.16, (r.hips[2] || 0) + 0.04); model.g.rotation.y = -0.4; rig.bones.hips.add(model.g); }
  }
  const lit = !!(it && it.lit !== false && !p.dead);
  if (model) for (const m of model.f) m.visible = lit;
  if (!it || !p) { light.intensity += (0 - light.intensity) * Math.min(1, dt * 8); return; }
  const L = KR.Gear.LIGHTS[id];
  const dark = K3.sky && Number.isFinite(K3.sky.darkness) ? K3.sky.darkness : 0.5;
  const steady = id === 'phial' || id === 'sunstone' || id === 'glowcap';
  flick += dt; const fl = steady ? 1 + Math.sin(t * 1.3) * 0.04 : 1 + Math.sin(t * 13) * 0.07 + Math.sin(t * 29.3) * 0.05 + (Math.random() - 0.5) * 0.05;
  const want = lit ? L.lum * (1.4 + 13 * dark) * fl : 0;
  light.intensity += (want - light.intensity) * Math.min(1, dt * (lit ? 6 : 14));
  light.color.set(L.col); light.distance = L.r * 1.6;
  // where the light sits: at the model if we can see it, else at the hip in front of the eyes
  if (model && model.g.parent) { model.g.getWorldPosition(light.position); light.position.y += 0.12; }
  else { const P = 0.05; light.position.set(p.x * P, K3.camera.position.y - 0.6, p.y * P); }
});

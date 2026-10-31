// The hero stage: where you choose and create characters. A torch-lit stone dais in a dark hall, high
// above the island and hidden from it by fog, so the hero stands alone in warm firelight.
import * as THREE from 'three';

export const STAGE = { x: 0, y: 240, z: 0 };
let S = null;
export function buildStage(scene) {
  if (S) return S;
  const g = new THREE.Group(); g.position.set(STAGE.x, STAGE.y, STAGE.z);
  const stone = new THREE.MeshStandardMaterial({ color: 0x5a544c, roughness: 0.85 }), dark = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.95 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.35, metalness: 0.8 });
  // floor and the round dais
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), dark); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.5, 40), stone); dais.position.y = 0.25; dais.receiveShadow = true; dais.castShadow = true; g.add(dais);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.06, 8, 64), gold); ring.rotation.x = Math.PI / 2; ring.position.y = 0.5; g.add(ring);
  // a half circle of pillars and banners behind the hero
  const banner = [0x7a1414, 0x1a2e6a];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6 - 0.5) * Math.PI * 0.95, r = 9;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 11, 12), stone); p.position.set(x, 5.5, z); p.castShadow = true; g.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), stone); cap.position.set(x, 11.2, z); g.add(cap);
    if (i % 2 === 1) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4.6), new THREE.MeshStandardMaterial({ color: banner[(i >> 1) % 2], roughness: 0.9, side: THREE.DoubleSide }));
      b.position.set(x * 0.94, 7.4, z * 0.94); b.lookAt(0, 7.4, 0); g.add(b);
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.12), gold); t.position.set(x * 0.94, 9.75, z * 0.94); t.lookAt(0, 9.75, 0); g.add(t);
    }
  }
  // two braziers with fire and warm light
  const flames = [];
  for (const sx of [-1, 1]) {
    const bx = sx * 4.6, bz = 1.4;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 1.6, 10), dark); stand.position.set(bx, 0.8, bz); g.add(stand);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.35, 0.45, 14), gold); bowl.position.set(bx, 1.75, bz); g.add(bowl);
    const fm = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.42 - k * 0.1, 1.1 + k * 0.25, 10, 1, true), fm); f.position.set(bx, 2.4 + k * 0.12, bz); g.add(f); flames.push(f); }
    const l = new THREE.PointLight(0xff9a40, 40, 18, 1.6); l.position.set(bx, 2.8, bz); g.add(l);
  }
  // a soft key light from the front and a cool rim light from behind
  const key = new THREE.SpotLight(0xfff0d8, 220, 30, 0.5, 0.6, 1.4); key.position.set(-3, 9, 9); key.target.position.set(0, 2, 0); g.add(key, key.target);
  const rim = new THREE.PointLight(0x7aa0ff, 30, 16, 1.6); rim.position.set(2, 5, -4); g.add(rim);
  g.visible = false;
  scene.add(g);
  S = { g, flames };
  return S;
}
export function showStage(on, t = 0) {
  if (!S) return;
  S.g.visible = on;
  if (on) for (const [i, f] of S.flames.entries()) f.scale.set(1 + Math.sin(t * 13 + i) * 0.12, 1 + Math.sin(t * 9 + i * 2) * 0.22, 1 + Math.cos(t * 11 + i) * 0.12);
}

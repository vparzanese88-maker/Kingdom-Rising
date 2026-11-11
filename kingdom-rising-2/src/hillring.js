// Kingdom Arena, King of the Hill: the boundary of the hill, a short ring of light in the colour of the side holding it
// (a growing inner line shows the capture; contested, it flickers orange).
// Nothing here is solid: it is all light on open ground (no colliders added).
import * as THREE from 'three';
import { G } from './state.js';

const Y = 3;
let H = null;
// (the owner: the hill's edge is a short ring, visible but never overpowering, and cheap to draw: a thin line on the ground, a
// knee-high glow fading upward, and a second thin line that grows out from the middle as a side takes the hill)
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const WALL_FS = 'uniform float k; uniform vec3 col; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 2.0) * k; gl_FragColor = vec4(col * a, 1.0); }';
const _c1 = new THREE.Color(), _c2 = new THREE.Color('#ff8a30'), _idle = new THREE.Color('#e8e0d0');

export function buildHillRing(scene, R = 7) {
  if (H) { scene.add(H.root); return H; } const root = new THREE.Group(); root.name = 'hillring'; scene.add(root);
  const lineM = new THREE.MeshBasicMaterial({ color: '#e8e0d0', transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const rim = new THREE.Mesh(new THREE.RingGeometry(R - 0.14, R, 96), lineM); rim.rotation.x = -Math.PI / 2; rim.position.y = Y + 0.06; rim.renderOrder = 2; root.add(rim);
  const fillM = lineM.clone(); fillM.opacity = 0.5; const fillR = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96), fillM); fillR.rotation.x = -Math.PI / 2; fillR.position.y = Y + 0.065; fillR.renderOrder = 2; fillR.visible = false; root.add(fillR);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.45, 96, 1, true), new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: WALL_FS, uniforms: { k: { value: 0.3 }, col: { value: new THREE.Color('#e8e0d0') } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  wall.position.y = Y + 0.225; wall.renderOrder = 3; root.add(wall);
  H = { root, rim, fillR, wall, R, fill: 0, holder: null, col: new THREE.Color('#e8e0d0') }; return H;
}
// every frame: owner is a team colour (string), 'contested', or null
export function paintHillRing(dt, owner, colOf) {
  if (!H) return; const t = G.time || 0, cont = owner === 'contested', held = owner != null && !cont;
  if (held && H.holder !== owner) { H.fill = Math.max(0, H.fill - dt * 1.6); if (H.fill <= 0) H.holder = owner; }
  else if (held) H.fill = Math.min(1, H.fill + dt * 0.7);
  else if (!cont) H.fill = Math.max(0, H.fill - dt * 0.35);
  if (H.holder != null && H.fill > 0) _c1.set(colOf(H.holder)); else _c1.copy(_idle); H.col.lerp(_c1, Math.min(1, dt * 5 + 0.02));
  const c = cont && Math.sin(t * 10) > 0 ? _c2 : H.col;
  H.rim.material.color.copy(c); H.rim.material.opacity = held || cont ? 0.7 : 0.5;
  H.wall.material.uniforms.col.value.copy(c); H.wall.material.uniforms.k.value = cont ? 0.42 : held ? 0.34 : 0.22;
  H.fillR.visible = H.fill > 0.02 && H.fill < 0.995; H.fillR.scale.setScalar(Math.max(0.01, H.fill * H.R)); H.fillR.material.color.copy(H.col);
}
export function hideHillRing() { if (H && H.root.parent) H.root.parent.remove(H.root); }

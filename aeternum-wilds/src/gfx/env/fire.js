// Aeternum Wilds — flames, embers and pools of firelight. Every flame in the world (torches, lanterns, the
// campfire, the forge, braziers) is one instanced, camera-facing, flickering card in a single draw call; each
// light source also lays a soft additive pool of warm light on the ground that fades in at dusk; a small pool of
// real point lights follows the fires nearest the camera.
import * as THREE from 'three';
import { ENV, U } from './shared.js';
import { cardTex } from './tex.js';

const flames = []; // { x, y, z, s, col: Color, ph, k }
let flameMesh = null;
const pools = []; // { x, y, z, r, col }
let poolMesh = null; const poolU = { uK: { value: 0 } };
const lightSrc = []; // { x, y, z, col, base, r }
const lightPool = [];

export function addFlame(x, y, z, size = 0.5, color = 0xffa040, kind = 0) {
  const f = { x, y, z, s: size, col: new THREE.Color(color), ph: Math.random() * 10, kind };
  flames.push(f); return f;
}
export function addLightPool(x, y, z, r, color = 0xffa050) { pools.push({ x, y, z, r, col: new THREE.Color(color) }); }
// a flickering point light candidate (only the nearest few are real lights)
export function addFireLight(x, y, z, color = 0xffa050, base = 14, r = 14, day = 0.15) { const s = { x, y, z, col: new THREE.Color(color), base, r, ph: Math.random() * 10, day }; lightSrc.push(s); return s; }

function flameMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { tMap: { value: cardTex('flame') }, uTime: { value: 0 } },
    vertexShader: `attribute vec4 iPos; attribute vec4 iCol; uniform float uTime; varying vec2 vUv; varying vec3 vCol; varying float vA;
      void main(){ vUv = uv; float ph = iCol.a;
        float fl = 1. + sin(uTime * 13. + ph) * .12 + sin(uTime * 7.3 + ph * 2.) * .1;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(0., 1., 0.);
        vec2 q = position.xy; q.x += sin(uTime * 5. + ph + q.y * 3.) * .08 * q.y;
        vec3 wp = iPos.xyz + right * q.x * iPos.w * (1. + sin(uTime * 9. + ph) * .1) + up * (q.y + .45) * iPos.w * 1.6 * fl;
        vCol = iCol.rgb; vA = .9 + sin(uTime * 17. + ph * 3.) * .1;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.); gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: `uniform sampler2D tMap; varying vec2 vUv; varying vec3 vCol; varying float vA;
      void main(){ vec4 t = texture2D(tMap, vUv); gl_FragColor = vec4(t.rgb * vCol * 2.6 * vA, t.a);
      }`,
  });
}
export function buildFires() {
  if (flames.length) {
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    // two crossed layers per flame: a tall core and a wider, dimmer body
    const n = flames.length * 2; const ip = new Float32Array(n * 4), ic = new Float32Array(n * 4);
    flames.forEach((f, i) => {
      ip.set([f.x, f.y, f.z, f.s], i * 8); ic.set([f.col.r, f.col.g, f.col.b, f.ph], i * 8);
      ip.set([f.x, f.y - f.s * 0.1, f.z, f.s * 1.35], i * 8 + 4); ic.set([f.col.r * 0.55, f.col.g * 0.4, f.col.b * 0.3, f.ph + 2.1], i * 8 + 4);
    });
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(ip, 4)); g.setAttribute('iCol', new THREE.InstancedBufferAttribute(ic, 4)); g.instanceCount = n;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    flameMesh = new THREE.Mesh(g, flameMaterial()); flameMesh.frustumCulled = false; flameMesh.renderOrder = 6; flameMesh.name = 'flames';
    flameMesh.material.uniforms.uTime = U.uTime;
    ENV.scene.add(flameMesh);
  }
  if (pools.length) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g2 = c.getContext('2d');
    const gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const geom = new THREE.PlaneGeometry(1, 1); geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    mat.onBeforeCompile = (sh) => { sh.uniforms.uK = poolU.uK; sh.fragmentShader = 'uniform float uK;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= uK;'); };
    const m = new THREE.InstancedMesh(geom, mat, pools.length); const M = new THREE.Matrix4();
    pools.forEach((p, i) => { M.makeScale(p.r * 2, 1, p.r * 2); M.setPosition(p.x, p.y + 0.06, p.z); m.setMatrixAt(i, M); m.setColorAt(i, p.col); });
    m.frustumCulled = false; m.renderOrder = 3; m.name = 'lightpools';
    ENV.scene.add(m); poolMesh = m;
  }
  const n = ENV.Q.lights || 3;
  for (let i = 0; i < n; i++) { const l = new THREE.PointLight(0xffa050, 0, 14, 2); ENV.scene.add(l); lightPool.push({ l, s: null }); }
}
let tick = 0, chosen = [];
// darkness: 0 bright day .. 1 night
export function updateFires(dt, t, camPos, darkness) {
  poolU.uK.value += (0.55 * Math.max(0, Math.min(1, (darkness - 0.25) / 0.5)) - poolU.uK.value) * Math.min(1, dt * 2);
  if (poolMesh) poolMesh.visible = poolU.uK.value > 0.01;
  tick -= dt;
  if (tick <= 0) {
    tick = 0.3;
    const sc = [];
    for (const s of lightSrc) { const d = Math.hypot(s.x - camPos.x, s.z - camPos.z); if (d < 60) sc.push([d * (lightPool.some((p) => p.s === s) ? 0.8 : 1), s]); }
    sc.sort((a, b) => a[0] - b[0]);
    const want = sc.slice(0, lightPool.length).map((x) => x[1]);
    const keep = new Set(); chosen = lightPool.map((p) => (p.s && want.includes(p.s) ? (keep.add(p.s), p.s) : null));
    let k = 0; for (let i = 0; i < lightPool.length; i++) if (!chosen[i]) { while (k < want.length && keep.has(want[k])) k++; chosen[i] = want[k++] || null; }
  }
  for (let i = 0; i < lightPool.length; i++) {
    const p = lightPool[i], s = chosen[i];
    if (!s || p.s !== s) { p.l.intensity = Math.max(0, p.l.intensity - dt * 30); if (!s) { if (p.l.intensity <= 0) p.s = null; continue; } if (p.l.intensity > 0.05) continue; p.s = s; p.l.position.set(s.x, s.y, s.z); p.l.color.copy(s.col); p.l.distance = s.r; }
    const fl = 1 + Math.sin(t * 11 + s.ph) * 0.06 + Math.sin(t * 6.3 + s.ph * 2) * 0.05;
    const fade = 1 - Math.max(0, Math.min(1, (Math.hypot(s.x - camPos.x, s.z - camPos.z) - 38) / 20));
    const want = s.base * (s.day + (1 - s.day) * darkness) * fl * fade;
    p.l.intensity += (want - p.l.intensity) * Math.min(1, dt * 4);
  }
}
export function fireStats() { return { flames: flames.length, pools: pools.length, lights: lightSrc.length }; }

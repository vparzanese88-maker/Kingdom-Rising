// Kingdom Arena, King of the Hill: the boundary of the hill. A low curtain of shimmering light stands on the ring's edge, a
// circle of rune crystals floats over little inlaid plinths just outside it, and a great glyph on the ground fills from the
// middle with the colour of the side holding it (drains and refills when the hill changes hands). Contested, it all flickers
// between the two colours and orange. A faint beam of light rises from the centre so the hill can be found from anywhere.
// Nothing here is solid: it is all light on open ground (no colliders added).
import * as THREE from 'three';
import { G } from './state.js';
import { runeTex } from './payload.js';

const Y = 3;
let H = null;
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
// the curtain: brightest at its foot, fading upward, with fine vertical shimmer and slow rising bands
const CURTAIN_FS = `uniform float time, k, flick; uniform vec3 col, col2; varying vec2 vUv;
void main(){ float v = vUv.y, u = vUv.x * 6.2831853; float fade = pow(1.0 - v, 1.7) * smoothstep(0.0, 0.03, v);
  float sh = 0.55 + 0.45 * sin(u * 46.0 + time * 1.4) * sin(u * 17.0 - time * 0.8 + v * 3.0);
  float bands = 0.65 + 0.35 * sin(v * 12.0 - time * 2.2 + sin(u * 5.0) * 1.5);
  float foot = (1.0 - smoothstep(0.0, 0.07, v)) * 0.9;
  float fl = step(0.5, fract(time * 5.0 + sin(u * 3.0) * 0.3)); vec3 c = mix(col, col2, flick * fl);
  float al = (fade * (0.22 + 0.42 * sh * bands) + foot) * k; gl_FragColor = vec4(c * al, 1.0); }`;
// the ground glyph: rim, an inner ring, twelve spokes, a band of turning runes, and the fill (radius 'fill' of 0..1) in the holder's colour
const GLYPH_FS = `uniform float time, k, fill, flick; uniform vec3 col, col2, base; uniform sampler2D runes; varying vec2 vUv;
void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard; float a = atan(p.y, p.x);
  float rim = smoothstep(0.93, 0.975, r) * (1.0 - smoothstep(0.985, 1.0, r));
  float rim2 = smoothstep(0.80, 0.81, r) * (1.0 - smoothstep(0.815, 0.825, r)) + smoothstep(0.40, 0.41, r) * (1.0 - smoothstep(0.415, 0.425, r));
  float band = smoothstep(0.83, 0.84, r) * (1.0 - smoothstep(0.91, 0.92, r));
  float rn = texture2D(runes, vec2(a / 6.2831853 * 4.0 - time * 0.015, (r - 0.835) / 0.08)).r * band;
  float sp = (1.0 - smoothstep(0.0, 0.012, abs(sin(a * 6.0)) * r)) * step(0.43, r) * step(r, 0.79) * 0.55;
  float star = (1.0 - smoothstep(0.0, 0.02, abs(abs(p.x) + abs(p.y) - 0.3))) * 0.6;
  float filled = 1.0 - smoothstep(fill - 0.02, fill + 0.01, r);
  float edge = (1.0 - smoothstep(0.0, 0.025, abs(r - fill))) * step(0.02, fill) * step(fill, 0.995);
  float fl = step(0.5, fract(time * 6.0 + r * 2.0)); vec3 hc = mix(col, col2, flick * fl);
  float lines = rim * 0.9 + rim2 * 0.55 + rn * 0.7 + sp + star;
  vec3 c = mix(base, hc, filled) * lines + hc * (filled * (0.10 + 0.05 * sin(r * 24.0 - time * 3.0)) + edge * 0.9);
  gl_FragColor = vec4(c * k, 1.0); }`;
// the beam: a tall faint column, fading upward
const BEAM_FS = `uniform float time, k; uniform vec3 col; varying vec2 vUv;
void main(){ float v = vUv.y; float al = pow(1.0 - v, 2.2) * (0.6 + 0.4 * sin(vUv.x * 6.2831853 * 6.0 + time * 1.2 - v * 8.0)) * k; gl_FragColor = vec4(col * al, 1.0); }`;
const mat = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: Object.assign({ time: { value: 0 }, k: { value: 1 }, flick: { value: 0 }, col: { value: new THREE.Color('#ffffff') }, col2: { value: new THREE.Color('#ff8a30') } }, u || {}), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

export function buildHillRing(scene, R = 7) {
  if (H) { scene.add(H.root); return H; } const root = new THREE.Group(); root.name = 'hillring'; scene.add(root);
  const curtain = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.9, 160, 1, true), mat(CURTAIN_FS)); curtain.position.y = Y + 0.95; curtain.renderOrder = 3; root.add(curtain);
  const glyph = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R * 2), mat(GLYPH_FS, { fill: { value: 0 }, base: { value: new THREE.Color('#d8c8a0') }, runes: { value: runeTex(31) } })); glyph.material.side = THREE.FrontSide; glyph.material.polygonOffset = true; glyph.material.polygonOffsetFactor = -4; glyph.material.polygonOffsetUnits = -4;
  glyph.rotation.x = -Math.PI / 2; glyph.position.y = Y + 0.07; glyph.renderOrder = 2; root.add(glyph);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.4, 34, 24, 1, true), mat(BEAM_FS)); beam.position.y = Y + 17; beam.material.uniforms.k.value = 0.22; root.add(beam);
  // the rune crystals over their plinths, just outside the edge
  const [c, g] = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; return [c, c.getContext('2d')]; })(); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const glowT = new THREE.CanvasTexture(c);
  const stone = new THREE.MeshStandardMaterial({ color: '#c8bca4', roughness: 0.9 }), crysM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2, metalness: 0.1, emissive: '#ffffff', emissiveIntensity: 1.6 }), glowM = new THREE.SpriteMaterial({ map: glowT, color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 });
  const crys = [], N = 12, cg = new THREE.OctahedronGeometry(0.2, 0); cg.scale(0.75, 2.0, 0.75);
  for (let k = 0; k < N; k++) { const a = (k + 0.5) / N * Math.PI * 2, x = Math.cos(a) * (R + 0.35), z = Math.sin(a) * (R + 0.35);
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.08, 8), stone); pl.position.set(x, Y + 0.04, z); pl.receiveShadow = true; root.add(pl);
    const cr = new THREE.Mesh(cg, crysM); cr.position.set(x, Y + 1.3, z); root.add(cr); const sp = new THREE.Sprite(glowM); sp.scale.set(1.5, 1.5, 1); sp.position.copy(cr.position); root.add(sp); crys.push({ cr, sp, a }); }
  H = { root, curtain, glyph, beam, crys, crysM, glowM, fill: 0, holder: null, col: new THREE.Color('#e8e0d0') }; return H;
}
// every frame: owner is a team colour (string), 'contested', or null
export function paintHillRing(dt, owner, colOf) {
  if (!H) return; const t = G.time || 0, cont = owner === 'contested', held = owner != null && !cont;
  // the fill drains when the hill changes hands, then grows in the new holder's colour
  if (held && H.holder !== owner) { H.fill = Math.max(0, H.fill - dt * 1.6); if (H.fill <= 0) H.holder = owner; }
  else if (held) H.fill = Math.min(1, H.fill + dt * 0.7);
  else if (!cont) H.fill = Math.max(0, H.fill - dt * 0.35);
  const want = H.holder != null && H.fill > 0 ? new THREE.Color(colOf(H.holder)) : new THREE.Color('#e8e0d0'); H.col.lerp(want, Math.min(1, dt * 5 + 0.02));
  const flickCol = cont ? new THREE.Color('#ff8a30') : H.col, k = cont ? 1.1 : held ? 1 : 0.6 + Math.sin(t * 1.5) * 0.08;
  for (const m of [H.curtain, H.glyph, H.beam]) { const U = m.material.uniforms; U.time.value = t; U.col.value.copy(H.col); U.col2.value.copy(flickCol); U.flick.value = cont ? 1 : 0; }
  H.curtain.material.uniforms.k.value = k; H.glyph.material.uniforms.k.value = 0.75 + (held ? 0.2 : 0); H.glyph.material.uniforms.fill.value = H.fill; H.beam.material.uniforms.k.value = (held ? 0.26 : cont ? 0.3 : 0.14);
  H.crysM.emissive.copy(cont && Math.sin(t * 18) > 0 ? new THREE.Color('#ff8a30') : H.col); H.glowM.color.copy(H.crysM.emissive);
  for (const c of H.crys) { c.cr.position.y = Y + 1.3 + Math.sin(t * 1.4 + c.a * 3) * 0.12; c.cr.rotation.y = t * 0.9 + c.a; c.sp.position.y = c.cr.position.y; }
}
export function hideHillRing() { if (H && H.root.parent) H.root.parent.remove(H.root); }

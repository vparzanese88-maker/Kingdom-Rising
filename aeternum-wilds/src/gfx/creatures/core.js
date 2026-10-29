// Aeternum Wilds creatures: shared helpers and materials (adapted from Kingdom Rising 3D's chars.js /
// creatures.js, without the window.KR / K3 globals).
import * as THREE from 'three';
import { G } from '../../state.js';

export { THREE };
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const decay = (t, k) => Math.exp(-t * k);
export const lerp = (a, b, t) => a + (b - a) * t;
export const Q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
export function col(hex, out) {
  const c = out || new THREE.Color();
  if (hex && hex.isColor) return c.copy(hex);
  if (typeof hex === 'number') return c.setHex(hex);
  if (!hex) return c.setRGB(0.5, 0.5, 0.5);
  return c.set(hex);
}
const _w = new THREE.Color(1, 1, 1);
// lighter (amt > 0) or darker (amt < 0)
export function shade(hex, amt) { const c = col(hex == null ? 0x777777 : hex, new THREE.Color()); if (amt >= 0) c.lerp(_w, amt); else c.multiplyScalar(1 + amt); return c; }
export const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// graphics level: 'low' | 'medium' | 'high' | 'ultra'
export const quality = () => G.quality || (G.settings && G.settings.quality) || 'medium';
// one clock for every shader that moves on its own (flames, water, ghosts)
export const uTime = { value: 0 };

// ---------- the body material: vertex colours plus per-vertex metal/roughness and procedural detail ----------
// aMat.x metalness, aMat.y roughness, aMat.z pattern (0 plain 1 cloth 2 leather 3 metal 4 fur 5 skin 6 hair 7 chain 8 bone 9 glow 10 scales)
// Each creature gets its own instance (so hit flashes stay its own); they all share one shader program.
function patchBody(sh) {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aMat; varying vec3 vMat; varying vec3 vOP;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat; vOP = position;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
    varying vec3 vMat; varying vec3 vOP;
    float ch(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float cn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(mix(ch(i), ch(i + vec3(1,0,0)), f.x), mix(ch(i + vec3(0,1,0)), ch(i + vec3(1,1,0)), f.x), f.y), mix(mix(ch(i + vec3(0,0,1)), ch(i + vec3(1,0,1)), f.x), mix(ch(i + vec3(0,1,1)), ch(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float gPat; float gEm;
  `).replace('#include <map_fragment>', `#include <map_fragment>
    float pat = floor(vMat.z + .5); vec3 q = vOP; gPat = .5; gEm = 0.;
    float px = length(fwidth(q));
    float aaF = 1. - smoothstep(.0015, .006, px), aaM = 1. - smoothstep(.006, .02, px);
    if (pat == 1.) { float w = sin(q.x * 520.) * sin(q.y * 520.) * .5 + .5; gPat = mix(.5, w, aaF); diffuseColor.rgb *= .95 + .08 * gPat; }
    else if (pat == 2.) { float n = mix(.5, cn(q * 60.), aaM); gPat = n; diffuseColor.rgb *= .9 + .2 * n; }
    else if (pat == 4.) { float n = mix(.5, cn(vec3(q.x * 160., q.y * 30., q.z * 160.)), aaF); gPat = n; diffuseColor.rgb *= .88 + .2 * n; }
    else if (pat == 6.) { float n = mix(.5, cn(vec3(q.x * 220., q.y * 14., q.z * 220.)), aaF); gPat = n; diffuseColor.rgb *= .88 + .2 * n; }
    else if (pat == 8.) { float n = mix(.5, cn(q * 40.) * .7 + cn(q * 110.) * .3, aaM); gPat = n; diffuseColor.rgb *= .86 + .22 * n; }
    else if (pat == 11.) { float n = cn(q * 9.) * .6 + cn(q * 23.) * .4; float r = smoothstep(.47, .5, n) * (1. - smoothstep(.5, .53, n)); gPat = n; diffuseColor.rgb *= .8 + .3 * n; gEm = r * 1.6; }
    else if (pat == 9.) { gEm = 1.; }
    else if (pat == 10.) { vec3 sq = q * 55.; vec3 si = floor(sq); vec3 sf = fract(sq) - .5; float cell = cn(si * 1.7); float bump = 1. - smoothstep(.15, .5, length(sf.xy + sf.z * .3)); gPat = mix(.5, bump * (.7 + .3 * cell), aaM); diffuseColor.rgb *= .94 + .1 * gPat + .06 * (cell - .5); }
    else if (pat == 12.) { float n = mix(.5, cn(q * 14.) * .6 + cn(q * 40.) * .4, aaM); gPat = n; diffuseColor.rgb *= .78 + .4 * n; }
  `).replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vMat.x;')
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vMat.y;')
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    if (pat == 10. || pat == 12. || pat == 8.) { vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition); float dhx = dFdx(gPat), dhy = dFdy(gPat);
      vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx); float det = dot(dpdx, r1); vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
      normal = normalize(abs(det) * normal - grad * (pat == 12. ? .06 : .03)); }`)
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * gEm * 2.5;');
}
export function bodyMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
  m.onBeforeCompile = patchBody;
  m.customProgramCacheKey = () => 'awbody';
  return m;
}
// material patterns used when building bodies: [metalness, roughness, pattern]
export const MATS = { gem: [0.2, 0.1, 0], plain: [0, 0.8, 0], cloth: [0, 0.95, 1], leather: [0, 0.62, 2], fur: [0, 1, 4], skin: [0, 0.6, 5], hair: [0, 0.55, 6], scales: [0.1, 0.45, 10], bone: [0, 0.65, 8], snake: [0.04, 0.38, 5], glow: [0, 1, 9], shell: [0.2, 0.3, 3], rock: [0, 0.95, 12], wood: [0, 0.9, 2], leaf: [0, 0.9, 1], metal: [0.85, 0.32, 3], ember: [0, 0.9, 11], feather: [0, 0.7, 6], horn: [0, 0.5, 8], wet: [0, 0.25, 5] };

// ---------- fur: the body drawn again a few times, each layer pushed out a little, cut into strands ----------
function patchFur(len) {
  return (sh) => {
    sh.uniforms.uLen = { value: len };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aShell; attribute vec3 aMat; uniform float uLen; varying float vShell; varying vec3 vFR; varying float vFur;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShell = aShell; vFur = step(3.5, aMat.z) * step(aMat.z, 4.5); vFR = position; transformed += normal * uLen * aShell * vFur; transformed.y -= uLen * aShell * aShell * .35 * vFur;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying float vShell; varying vec3 vFR; varying float vFur;
      float fh(vec3 p){ p = fract(p * .1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        { if (vFur < .5) discard; vec3 q = floor(vFR * ${(1 / Math.max(0.004, len * 0.3)).toFixed(1)}); float h = fh(q); if (h < vShell * 1.05 + .08) discard;
          diffuseColor.rgb *= .8 + .28 * vShell + .06 * (h - .5); diffuseColor.a = 1.; }`);
  };
}
export function furMaterial(len) {
  const key = len.toFixed(3);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, alphaTest: 0.5 });
  m.onBeforeCompile = patchFur(len);
  m.customProgramCacheKey = () => 'awfur' + key;
  return m;
}
export const furLayers = () => { const q = quality(); return q === 'ultra' ? 9 : q === 'high' ? 7 : q === 'medium' ? 5 : 0; };

// ---------- glowing, see-through bodies (ghosts, elementals); they sway on their own ----------
export function glowMaterial(c, opacity = 0.75, additive = false, sway = 0.08) {
  const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2, transparent: true, opacity, depthWrite: false, roughness: 0.3, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide });
  m.userData.baseEmissive = new THREE.Color(c);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime; sh.uniforms.uSway = { value: sway };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uSway;').replace('#include <begin_vertex>', `#include <begin_vertex>
      float w = smoothstep(.6, -.9, position.y); transformed.x += sin(uTime * 3. + position.y * 6. + position.z * 3.) * uSway * w; transformed.z += cos(uTime * 2.6 + position.y * 5. + position.x * 4.) * uSway * w; transformed.y += sin(uTime * 4. + position.x * 9.) * uSway * .4 * w;`);
  };
  m.customProgramCacheKey = () => 'awglow';
  return m;
}
// flames: additive tongues that flicker and lick upward (shared by fire elementals, burning skeletons, imps)
let flameMat = null, flameGeo = null;
export function flameAssets() {
  if (!flameMat) {
    flameMat = new THREE.ShaderMaterial({
      uniforms: { uTime },
      vertexShader: `uniform float uTime; attribute float aSeed; varying float vY; varying float vSeed;
        void main(){ vY = position.y; vSeed = aSeed; vec3 p = position;
          float k = clamp(p.y, 0., 1.); p.x += sin(uTime * 9. + aSeed * 7. + p.y * 5.) * .12 * k; p.z += cos(uTime * 7. + aSeed * 3. + p.y * 4.) * .1 * k;
          p.y *= .85 + .3 * sin(uTime * 11. + aSeed * 13.);
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.); }`,
      fragmentShader: `varying float vY; varying float vSeed;
        void main(){ float k = clamp(vY, 0., 1.); vec3 c = mix(vec3(1., .95, .55), vec3(1., .35, .05), smoothstep(.0, .55, k)); c = mix(c, vec3(.6, .08, .02), smoothstep(.6, 1., k));
          gl_FragColor = vec4(c * 2.2, (1. - k) * .9); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    flameGeo = new THREE.ConeGeometry(0.5, 1, 7, 4, true); flameGeo.translate(0, 0.5, 0);
  }
  return { flameMat, flameGeo };
}
// a cluster of n flame tongues as one instanced mesh; spots [[x,y,z,size], ...] in the parent's space
export function makeFlames(spots) {
  const { flameMat: m, flameGeo: g } = flameAssets();
  const geo = g.clone(); const seeds = new Float32Array(geo.attributes.position.count).fill(0);
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(spots.map((_, i) => i * 0.37 + Math.random())), 1));
  geo.deleteAttribute('uv'); void seeds;
  const im = new THREE.InstancedMesh(geo, m, spots.length);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion();
  spots.forEach(([x, y, z, s, w], i) => { mm.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s * (w || 0.55), s, s * (w || 0.55))); im.setMatrixAt(i, mm); });
  im.frustumCulled = false; im.castShadow = false; im.renderOrder = 3;
  return im;
}

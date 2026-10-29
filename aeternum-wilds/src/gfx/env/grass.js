// Aeternum Wilds — a field of grass and wildflowers around the camera, placed entirely on the GPU (after Kingdom
// Rising 3D's grass.js): a fixed grid of clumps follows the camera; each clump reads the ground height and the
// splat layers from the terrain's textures, so meadows are lush, forest floors patchy, beaches, roads and plazas
// bare. Blades lean and ripple with rolling gusts of wind and part around the player's feet.
import * as THREE from 'three';
import { ENV, U, keepCoverage } from './shared.js';
import { cardTex, canvasTex } from './tex.js';
import { TER } from './terrain.js';

let mesh = null, mat = null;
export const GRASS = { uPlayer: { value: new THREE.Vector3(0, -100, 0) } };

function atlas() {
  const g = cardTex('grass').userData.canvas, f = cardTex('flowers').userData.canvas, d = cardTex('drygrass').userData.canvas;
  return canvasTex(768, 256, (c) => { c.drawImage(g, 0, 0, 256, 256); c.drawImage(f, 256, 0, 256, 256); c.drawImage(d, 512, 0, 256, 256); }, true, true);
}
function makeMaterial() {
  const m = new THREE.MeshStandardMaterial({ map: atlas(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.92, metalness: 0 });
  m.alphaToCoverage = !!ENV.Q.msaa;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute vec2 iOff; uniform vec2 uCamCell; uniform float uSpacing; uniform float uRadius; uniform sampler2D tH; uniform sampler2D tS0; uniform sampler2D tS1; uniform sampler2D tMac; uniform vec3 uMap; uniform float uTime; uniform float uWind; uniform vec3 uPlayer;
      varying vec3 vTint; varying float vH;
      float gh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float gn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(gh(i), gh(i + vec2(1, 0)), u.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), u.x), u.y); }
    `)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0., 1., 0.);')
      .replace('#include <begin_vertex>', `
      vec2 cell = uCamCell + iOff;
      vec2 jit = vec2(gh(cell), gh(cell + 17.3));
      vec2 wxz = (cell + jit) * uSpacing;
      float d = distance(wxz, cameraPosition.xz);
      vec2 muv = ((wxz + uMap.x) / uMap.y + .5) / uMap.z;
      vec4 s0 = textureLod(tS0, muv, 0.), s1 = textureLod(tS1, muv, 0.);
      float ground = textureLod(tH, muv, 0.).r;
      vec3 mac = textureLod(tMac, muv, 0.).rgb * 2.;
      // grass, thorn grass, forest litter, dirt, cobbles, sand, mud, ash
      float dens = s0.r * 1. + s0.g * .95 + s0.b * .4 + s0.a * .06 + s1.b * .3 + s1.a * .14 + s1.r * .0;
      vec3 tint = (vec3(1.) * s0.r + vec3(.62, .74, .52) * s0.g + vec3(.72, .78, .55) * s0.b + vec3(.85, .8, .55) * (s0.a + s1.g) + vec3(.8, .8, .5) * s1.b + vec3(.62, .6, .55) * s1.a) / max(.001, s0.r + s0.g + s0.b + s0.a + s1.g + s1.b + s1.a);
      tint *= mac;
      dens *= smoothstep(.25, .75, ground);
      float hl = textureLod(tH, muv + vec2(1. / uMap.z, 0.), 0.).r, hu = textureLod(tH, muv + vec2(0., 1. / uMap.z), 0.).r;
      dens *= 1. - smoothstep(.35, .7, abs(hl - ground) + abs(hu - ground));
      if (muv.x < 0. || muv.y < 0. || muv.x > 1. || muv.y > 1.) dens = 0.;
      // patches: a meadow is never evenly mown
      float patchN = gn(wxz * .12) * .65 + gn(wxz * .5) * .35;
      dens *= .55 + .75 * patchN;
      float keep = step(gh(cell + 7.7), dens);
      float fade = 1. - smoothstep(uRadius * .72, uRadius, d);
      // wildflowers in drifts on the open grass; dry tussocks here and there
      float fl = step(.62, gn(wxz * .09 + 3.)) * step(gh(cell + 2.2), s0.r * .5) ;
      float dry = (1. - fl) * step(.8, gh(cell + 4.4)) * step(.5, s0.r + s0.a + s1.g);
      vMapUv.x = vMapUv.x / 3. + fl / 3. + dry * 2. / 3.;
      float sc = (.75 + gh(cell + 3.1) * .6) * keep * fade * (1. + fl * .1);
      float ang = gh(cell + 11.) * 6.2831;
      vec3 transformed = position * sc; transformed.y *= (.8 + gh(cell + 5.) * .55) * (.8 + patchN * .45);
      float ca = cos(ang), sa = sin(ang); transformed.xz = mat2(ca, -sa, sa, ca) * transformed.xz;
      // wind: gusts that roll across the field, and a quick flutter
      float gust = sin(wxz.x * .11 + wxz.y * .07 + uTime * 1.1) * .5 + .5;
      float sway = (sin(uTime * 2.4 + wxz.x * .9 + wxz.y * .7) * .35 + gust * gust * 1.1) * uWind * position.y;
      transformed.x += sway * .22; transformed.z += sway * .14;
      // part around the player's feet
      vec2 pd = wxz - uPlayer.xz; float pl = length(pd);
      float push = (1. - smoothstep(.2, 1.2, pl)) * step(abs(uPlayer.y - ground), 1.5);
      transformed.xz += pd / max(pl, .01) * push * position.y * .9; transformed.y *= 1. - push * .45;
      transformed.xz += wxz; transformed.y += ground - .02;
      vTint = tint * (.82 + gh(cell + 9.) * .3) * mix(vec3(1.), vec3(1.06, 1.04, .9), gust * .35);
      vH = position.y;
    `);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTint; varying float vH;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= vTint * mix(.6, 1.02, smoothstep(0., .45, vH));');
    keepCoverage(sh, 768);
  };
  m.customProgramCacheKey = () => 'awgrass';
  m.userData.u = { uCamCell: { value: new THREE.Vector2() }, uSpacing: { value: 0.5 }, uRadius: { value: 30 }, tH: { value: TER.hTex }, tS0: { value: TER.s0 }, tS1: { value: TER.s1 }, tMac: { value: TER.mTex }, uMap: { value: new THREE.Vector3(TER.half, TER.cell, TER.n) }, uTime: U.uTime, uWind: U.uWind, uPlayer: GRASS.uPlayer };
  return m;
}
function makeGeometry(spacing, radius) {
  const base = new THREE.BufferGeometry(); const pos = [], uv = [], idx = [];
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI; const cx = Math.cos(a) * 0.26, cz = Math.sin(a) * 0.26; const o = pos.length / 3;
    pos.push(-cx, 0, -cz, cx, 0, cz, cx, 0.46, cz, -cx, 0.46, -cz); uv.push(0, 0, 1, 0, 1, 1, 0, 1); idx.push(o, o + 1, o + 2, o, o + 2, o + 3); }
  base.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); base.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); base.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); base.setIndex(idx);
  const g = new THREE.InstancedBufferGeometry(); g.index = base.index; for (const k of ['position', 'uv', 'normal']) g.setAttribute(k, base.attributes[k]);
  const n = Math.ceil(radius / spacing); const off = [];
  for (let y = -n; y <= n; y++) for (let x = -n; x <= n; x++) if (x * x + y * y <= n * n) off.push(x, y);
  g.setAttribute('iOff', new THREE.InstancedBufferAttribute(new Float32Array(off), 2)); g.instanceCount = off.length / 2;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return g;
}
export function buildGrass() {
  const q = ENV.Q.grass; if (!q) return;
  const spacing = q >= 1.4 ? 0.34 : q >= 1 ? 0.4 : q >= 0.6 ? 0.48 : 0.6, radius = q >= 1.4 ? 46 : q >= 1 ? 36 : q >= 0.6 ? 28 : 22;
  mat = makeMaterial();
  mat.userData.u.uSpacing.value = spacing; mat.userData.u.uRadius.value = radius;
  mesh = new THREE.Mesh(makeGeometry(spacing, radius), mat); mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'grass';
  ENV.scene.add(mesh);
  GRASS.mesh = mesh; GRASS.count = mesh.geometry.instanceCount;
}
export function updateGrass(cam, player) {
  if (!mesh) return; const u = mat.userData.u; const s = u.uSpacing.value;
  u.uCamCell.value.set(Math.floor(cam.x / s), Math.floor(cam.z / s));
  if (player) GRASS.uPlayer.value.set(player.x, player.y, player.z);
}

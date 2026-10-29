// Aeternum Wilds — the sea and the bog. The sea is a grid that follows the camera, rolling with a few gentle
// swells, coloured by its real depth over the terrain (turquoise shallows over pale sand, deep blue further out),
// reflecting the sky with a Fresnel term, glinting in the sun, and breaking in bands of foam along the shore.
// The mire's pools are a still, murky green-brown with drifting duckweed and soft reflections.
import * as THREE from 'three';
import { ENV, U } from './shared.js';
import { propTex } from './tex.js';
import { TER } from './terrain.js';

export const WATER = { sea: null, far: null, bog: null, level: -0.15 };

const COMMON_PARS = `
  uniform sampler2D tH; uniform vec3 uMap; uniform float uTime; uniform sampler2D tN;
  uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uHorCol; uniform float uNight;
  float groundH(vec2 p){ vec2 muv = ((p + uMap.x) / uMap.y + .5) / uMap.z; if (muv.x < 0. || muv.y < 0. || muv.x > 1. || muv.y > 1.) return -12.; return texture(tH, muv).r; }
  float wh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float wn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(wh(i), wh(i + vec2(1, 0)), u.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), u.x), u.y); }
`;
function uniforms(extra) {
  return THREE.UniformsUtils.merge([THREE.UniformsLib.fog, Object.assign({ tH: { value: null }, uMap: { value: new THREE.Vector3() }, tN: { value: null } }, extra || {})]);
}
function link(m) {
  const u = m.uniforms;
  u.tH.value = TER.hTex; u.uMap.value.set(TER.half, TER.cell, TER.n); u.tN.value = propTex('water', 512).normalMap;
  u.uTime = U.uTime; u.uSunDir = U.uSunDir; u.uSunCol = U.uSunCol; u.uSkyCol = U.uSkyCol; u.uHorCol = U.uHorCol; u.uNight = U.uNight;
}

function seaMaterial() {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: uniforms({ uLevel: { value: WATER.level }, uWaveFade: { value: 170 } }),
    vertexShader: `#include <common>
      #include <fog_pars_vertex>
      ${COMMON_PARS}
      uniform float uLevel, uWaveFade;
      varying vec3 vW; varying vec3 vWN; varying float vCrest;
      // three slow swells (Gerstner-like) with height and slope
      vec3 swell(vec2 p, vec2 dir, float k, float a, float sp, inout vec3 n){ float ph = dot(p, dir) * k - uTime * sp; float s = sin(ph), c = cos(ph);
        n.xz -= dir * k * a * c; return vec3(dir * (-a * .6 * s), a * c); }
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.);
        float fade = 1. - smoothstep(uWaveFade * .55, uWaveFade, distance(wp.xz, cameraPosition.xz));
        vec3 n = vec3(0., 1., 0.); vec3 o = vec3(0.);
        o += swell(wp.xz, normalize(vec2(.8, .6)), .21, .16, 1.15, n);
        o += swell(wp.xz, normalize(vec2(-.3, .95)), .33, .08, 1.6, n);
        o += swell(wp.xz, normalize(vec2(.95, -.2)), .55, .04, 2.1, n);
        // swells shrink in the shallows and die on the beach
        float d = uLevel - groundH(wp.xz); float sh = smoothstep(.1, 2.5, d);
        wp.xz += o.xy * fade * sh; wp.y = uLevel + o.z * fade * sh;
        vCrest = o.z * fade * sh;
        vWN = normalize(mix(vec3(0., 1., 0.), n, fade * sh));
        vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <fog_pars_fragment>
      ${COMMON_PARS}
      uniform float uLevel;
      varying vec3 vW; varying vec3 vWN; varying float vCrest;
      void main(){
        vec2 uv1 = vW.xz / 11. + vec2(uTime * .016, uTime * .010), uv2 = vW.xz / 4.7 - vec2(uTime * .012, -uTime * .019), uv3 = vW.xz / 37. + vec2(-uTime * .006, uTime * .004);
        vec3 n1 = texture2D(tN, uv1).xyz * 2. - 1., n2 = texture2D(tN, uv2).xyz * 2. - 1., n3 = texture2D(tN, uv3).xyz * 2. - 1.;
        float dist = length(cameraPosition - vW);
        float nk = mix(1., .35, smoothstep(40., 260., dist));
        vec3 N = normalize(vWN * 3.4 + vec3(n1.x + n2.x * .8 + n3.x * 1.2, 0., n1.y + n2.y * .8 + n3.y * 1.2) * nk);
        vec3 V = normalize(cameraPosition - vW);
        float fres = .02 + .98 * pow(1. - max(dot(N, V), 0.), 5.);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 sky = mix(uHorCol, uSkyCol, pow(clamp(R.y * 1.3, 0., 1.), .6)) * 1.05;
        vec3 L = normalize(uSunDir);
        float sunUp = smoothstep(-.05, .1, L.y);
        float rs = max(dot(R, L), 0.);
        float spec = (pow(rs, 900.) * 40. + pow(rs, 90.) * 2.2 + pow(rs, 12.) * .12) * sunUp;
        // sparkles: tiny bright glints dancing on the surface
        float sp = wn(vW.xz * 2.7 + vec2(uTime * .9, -uTime * .6)) * wn(vW.xz * 3.9 - vec2(uTime * .7, uTime * .8));
        spec += smoothstep(.62, .85, sp) * pow(rs, 6.) * 7. * sunUp * (1. - smoothstep(30., 140., dist));
        float d = uLevel - groundH(vW.xz);
        float depth = max(d, 0.);
        // body colour: bright turquoise over sand, teal, then deep blue
        vec3 shallow = vec3(.12, .72, .72), mid = vec3(.03, .38, .52), deep = vec3(.012, .1, .24);
        vec3 body = mix(shallow, mid, smoothstep(.2, 2.8, depth)); body = mix(body, deep, smoothstep(2.5, 9., depth));
        float lightK = (.22 + .78 * max(L.y, 0.)) * (1. - uNight * .7) + uNight * .06;
        body *= lightK * (uSunCol * .8 + vec3(.25, .3, .35));
        // light through the crest of a swell
        body += vec3(.05, .35, .3) * smoothstep(.04, .2, vCrest) * max(dot(-V, L) * .5 + .5, 0.) * lightK * .6;
        vec3 col = mix(body, sky, fres * .9) + uSunCol * spec;
        // surf: bands rolling in toward the beach, broken up by noise
        float shore = 1. - smoothstep(0., 1.6, depth);
        float band = sin(depth * 5.5 - uTime * 1.6 + wn(vW.xz * .25) * 4.) * .5 + .5;
        float fn = wn(vW.xz * 1.7 + uTime * .2) * .6 + wn(vW.xz * 5.1 - uTime * .3) * .4;
        float foam = shore * smoothstep(.55, .95, band * .75 + fn * .5) + smoothstep(.35, .0, depth) * smoothstep(.3, .7, fn);
        foam += smoothstep(.13, .2, vCrest) * smoothstep(.55, .8, fn) * .5;
        foam = clamp(foam, 0., 1.);
        vec3 foamCol = vec3(.95, .98, 1.) * (lightK * 1.1 + .05);
        col = mix(col, foamCol, foam * .85);
        float a = clamp(.38 + smoothstep(0., 2.2, depth) * .56 + fres * .3 + foam * .5, 0., .985);
        a *= smoothstep(-.02, .06, d);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  link(m);
  return m;
}

function bogMaterial() {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: uniforms({ uLevel: { value: 0.12 } }),
    vertexShader: `#include <common>
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <fog_pars_fragment>
      ${COMMON_PARS}
      uniform float uLevel;
      varying vec3 vW;
      void main(){
        float d = uLevel - groundH(vW.xz);
        if (d < -.02) discard;
        vec3 n1 = texture2D(tN, vW.xz / 7. + vec2(uTime * .004, uTime * .003)).xyz * 2. - 1.;
        vec3 N = normalize(vec3(n1.x * .25, 1., n1.y * .25));
        vec3 V = normalize(cameraPosition - vW);
        float fres = .02 + .98 * pow(1. - max(dot(N, V), 0.), 5.);
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uHorCol, uSkyCol, clamp(R.y * 1.3, 0., 1.)) * vec3(.85, .95, .8);
        vec3 L = normalize(uSunDir); float sunUp = smoothstep(-.05, .1, L.y);
        float spec = pow(max(dot(R, L), 0.), 300.) * 8. * sunUp;
        float lightK = (.25 + .75 * max(L.y, 0.)) * (1. - uNight * .7) + uNight * .05;
        vec3 body = mix(vec3(.16, .2, .08), vec3(.06, .09, .04), smoothstep(0., 1., d)) * lightK * (uSunCol + vec3(.25));
        // duckweed and scum drifting in patches
        float weed = smoothstep(.55, .7, wn(vW.xz * .35 + uTime * .01) * .6 + wn(vW.xz * 2.1) * .4);
        vec3 weedC = vec3(.32, .45, .12) * lightK * (uSunCol + vec3(.3));
        vec3 col = mix(body, sky, fres * .7 * (1. - weed)) + uSunCol * spec * (1. - weed);
        col = mix(col, weedC, weed * .85);
        float a = clamp(.55 + smoothstep(0., .5, d) * .4 + weed * .3, 0., .97) * smoothstep(-.02, .06, d);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  link(m);
  return m;
}

// sea: a fine grid around the camera, and a flat far plane out to the horizon; bogArea: {r0, r1, a0, a1} sector
export function buildWater(bog) {
  const Q = ENV.Q;
  const segs = Q.waterSeg || 128, size = 360;
  const g = new THREE.PlaneGeometry(size, size, segs, segs); g.rotateX(-Math.PI / 2);
  const mat = seaMaterial();
  const sea = new THREE.Mesh(g, mat); sea.frustumCulled = false; sea.renderOrder = 2; sea.name = 'sea';
  sea.userData.step = size / segs;
  ENV.scene.add(sea); WATER.sea = sea;
  // far plane: a ring that starts under the near grid's edge
  const fg = new THREE.RingGeometry(size * 0.46, 4000, 64, 1); fg.rotateX(-Math.PI / 2);
  const fm = seaMaterial(); fm.uniforms.uWaveFade.value = 0;
  const far = new THREE.Mesh(fg, fm); far.frustumCulled = false; far.renderOrder = 1; far.name = 'seafar';
  ENV.scene.add(far); WATER.far = far;
  if (bog) {
    const bg = new THREE.RingGeometry(bog.r0, bog.r1, 64, 6, bog.a0, bog.a1 - bog.a0); bg.rotateX(-Math.PI / 2);
    // RingGeometry runs counter-clockwise in its own xy plane; after the rotation, its +y becomes -z
    const bm = new THREE.Mesh(bg, bogMaterial()); bm.position.y = bog.level; bm.material.uniforms.uLevel.value = bog.level; bm.renderOrder = 2; bm.name = 'bog';
    ENV.scene.add(bm); WATER.bog = bm;
  }
}
export function updateWater(cam) {
  const s = WATER.sea; if (!s) return;
  const st = s.userData.step * 2;
  s.position.set(Math.round(cam.x / st) * st, 0, Math.round(cam.z / st) * st);
  WATER.far.position.set(s.position.x, 0, s.position.z);
}

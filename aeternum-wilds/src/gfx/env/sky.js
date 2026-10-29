// Aeternum Wilds — sky dome (a bright saturated day sky, warm sunsets, starry moonlit nights, soft lit clouds with
// silver linings and shaded bellies), the sun and moon lights with a shadow box fitted around the player, skylight,
// zone haze (exponential fog, tinted per zone and blended smoothly across borders) and a captured environment map
// so stone, metal and water pick up the sky. After Kingdom Rising 3D's sky.js.
import * as THREE from 'three';
import { ENV, U, smooth, clamp, lerp } from './shared.js';

export const SKY = { sun: null, hemi: null, dome: null, dayK: 1, duskK: 0, nightK: 0, sunDir: new THREE.Vector3(), lightDir: new THREE.Vector3() };

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGnd: { value: new THREE.Color() },
    uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uCloud: { value: 0.42 }, uCloudCol: { value: new THREE.Color() }, uCloudShade: { value: new THREE.Color() }, uTime: { value: 0 }, uFog: { value: new THREE.Color() }, uFogK: { value: 0 }, uDay: { value: 1 },
  },
  vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }',
  fragmentShader: `
    uniform vec3 uSunDir, uMoonDir, uZen, uHor, uGnd, uSunCol, uCloudCol, uCloudShade, uFog; uniform float uNight, uCloud, uTime, uFogK, uDay;
    varying vec3 vD;
    float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float h2(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y); }
    float fb(vec2 p){ float s = 0., a = .5; for (int i = 0; i < CLOUD_OCT; i++) { s += a * n2(p); p = p * 2.03 + 1.7; a *= .5; } return s; }
    float dens(vec2 p){ float c = fb(p) * .68 + fb(p * 3.1 + 4.3) * .32; return smoothstep(1. - uCloud * .9, 1.18 - uCloud * .6, c + uCloud * .22); }
    void main(){
      vec3 d = normalize(vD); float y = d.y;
      // sky: deep blue overhead, pale near the horizon, a warm glow around the sun
      float yy = max(y, 0.);
      vec3 col = mix(uHor, uZen, pow(clamp(yy * 1.15, 0., 1.), .55));
      float sd = max(dot(d, normalize(uSunDir)), 0.);
      float sunUp = smoothstep(-.12, .04, uSunDir.y);
      col += uSunCol * (pow(sd, 6.) * .22 + pow(sd, 40.) * .35) * sunUp * (1. - yy * .5);
      col = mix(col, uGnd, smoothstep(0., -.18, y));
      // stars, the milky band and the moon
      if (uNight > .01 && y > -.05) {
        vec3 sp = d * 380.; vec3 ci = floor(sp); float s = h3(ci); float tw = .6 + .4 * sin(uTime * 3. + s * 60.);
        float star = step(.9972, s) * smoothstep(.55, .0, length(fract(sp) - .5)) * tw;
        float band = exp(-pow(dot(d, normalize(vec3(.4, .35, -.84))) * 3.2, 2.)) * fb(d.xz * 9. + d.y * 3.) * .5;
        col += (vec3(star) * 2.4 + vec3(.45, .5, .75) * band * .3) * uNight * smoothstep(-.05, .2, y);
        float md = dot(d, normalize(uMoonDir));
        float disk = smoothstep(.99935, .9995, md);
        col = mix(col, vec3(1., .97, .9) * (1.3 - fb(d.xy * 260.) * .35), disk * uNight);
        col += vec3(.45, .55, .8) * pow(max(md, 0.), 90.) * .3 * uNight;
      }
      // clouds on a curved sky plane, lit from the sun: bright tops and silver edges, soft grey bellies
      if (y > 0.) {
        vec2 cu = d.xz / (y + .1) * .55 + vec2(uTime * .004, uTime * .0024);
        float c = dens(cu);
        if (c > .002) {
          vec2 toSun = normalize(uSunDir.xz + 1e-4) * .09;
          float c2 = dens(cu + toSun), c3 = dens(cu + toSun * 2.2);
          float shadow = clamp((c2 * .6 + c3 * .4) * 1.15, 0., 1.);
          float edge = 1. - smoothstep(.0, .55, c);
          vec3 lit = mix(uCloudCol, uCloudShade, shadow * .85);
          lit += uSunCol * (edge * .55 + pow(sd, 8.) * .9 * (1. - shadow * .5)) * sunUp;
          float a = c * smoothstep(0., .14, y) * .96;
          col = mix(col, lit, a);
        }
      }
      // the sun disc (behind thin cloud it still shines through a little)
      col += uSunCol * pow(sd, 2400.) * 70. * sunUp * step(0., y + .01);
      // the haze of the land the player stands in, at the horizon
      col = mix(col, uFog, uFogK * exp(-max(y, 0.) * 7.));
      gl_FragColor = vec4(col, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});

let envScene = null, pmrem = null, envRT = null, envT = 0, envKeyLast = '';
const C = (r, g, b) => new THREE.Color(r, g, b);
const PAL = {
  day: { zen: C(0.075, 0.24, 0.72), hor: C(0.5, 0.68, 0.88), gnd: C(0.2, 0.3, 0.36), sun: C(1.0, 0.94, 0.82) },
  dusk: { zen: C(0.12, 0.16, 0.42), hor: C(1.0, 0.52, 0.26), gnd: C(0.18, 0.13, 0.12), sun: C(1.0, 0.56, 0.26) },
  night: { zen: C(0.008, 0.016, 0.045), hor: C(0.05, 0.07, 0.12), gnd: C(0.012, 0.016, 0.025), sun: C(0.45, 0.55, 0.85) },
};
// haze colour (lit by day) and density per zone
const FOGZ = {
  meadow: { col: C(0.62, 0.76, 0.9), d: 0.0019 }, town: { col: C(0.62, 0.76, 0.9), d: 0.0019 },
  coast: { col: C(0.66, 0.8, 0.92), d: 0.0017 },
  thorn: { col: C(0.5, 0.64, 0.6), d: 0.0042 },
  mire: { col: C(0.5, 0.6, 0.46), d: 0.0105 },
  ruins: { col: C(0.58, 0.42, 0.36), d: 0.0055 },
};

export function initSky() {
  const scene = ENV.scene, Q = ENV.Q;
  skyMat.defines = { CLOUD_OCT: Q.cloudOct || 5 };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2000, 48, 24), skyMat);
  dome.frustumCulled = false; dome.renderOrder = -10; dome.name = 'sky';
  scene.add(dome); SKY.dome = dome;
  const sun = new THREE.DirectionalLight(0xfff2dd, 3);
  sun.castShadow = !!Q.shadows;
  sun.shadow.mapSize.set(Q.shadows || 1024, Q.shadows || 1024);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.045;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 420;
  const sb = Q.shadowBox || 40; Object.assign(sun.shadow.camera, { left: -sb, right: sb, top: sb, bottom: -sb }); sun.shadow.camera.updateProjectionMatrix();
  if (Q.shadowRadius) sun.shadow.radius = Q.shadowRadius;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbcd4f0, 0x5a4a38, 1.0);
  scene.add(hemi);
  SKY.sun = sun; SKY.hemi = hemi;
  scene.fog = new THREE.FogExp2(0xa8c4dc, 0.002);
  // image-based lighting: the sky captured into an environment map now and then
  if (Q.env !== false) { pmrem = new THREE.PMREMGenerator(ENV.renderer); envScene = new THREE.Scene(); const ed = new THREE.Mesh(dome.geometry, skyMat); ed.frustumCulled = false; envScene.add(ed); }
}
function refreshEnv() { const old = envRT; envRT = pmrem.fromScene(envScene, 0.02, 1, 4000); ENV.scene.environment = envRT.texture; if (old) old.dispose(); }

const tmp = new THREE.Color(), tmp2 = new THREE.Color(), tmpF = new THREE.Color(), _ld = new THREE.Vector3(), _rx = new THREE.Vector3(), _uy = new THREE.Vector3(), _fp = new THREE.Vector3(), _lastLd = new THREE.Vector3();
let frame = 0;
// dayT: 0.25 sunrise, 0.5 noon, 0.75 sunset; camPos: camera; focus: what the shadows centre on;
// zw: sector weights at the camera {meadow, coast, thorn, mire, ruins}
export function updateSky(dt, dayT, camPos, focus, zw, inTown) {
  const t = U.uTime.value; frame++;
  const a = (dayT - 0.25) * Math.PI * 2;
  const sd = SKY.sunDir.set(Math.cos(a) * 0.92, Math.sin(a) * 0.86, 0.42).normalize();
  const md = new THREE.Vector3(-sd.x * 0.8, Math.max(0.35, -sd.y) * 0.9 + 0.25, -0.35).normalize();
  const elev = sd.y;
  const dayK = smooth(-0.1, 0.2, elev), duskK = Math.max(0, 1 - Math.abs(elev - 0.05) / 0.24) * smooth(-0.22, 0.0, elev), nightK = 1 - smooth(-0.22, 0.02, elev);
  SKY.dayK = dayK; SKY.duskK = duskK; SKY.nightK = nightK;
  // zone mood
  let fogD = 0, fogA = 0; const fz = tmpF.setRGB(0, 0, 0); let wsum = 0;
  for (const k of ['meadow', 'coast', 'thorn', 'mire', 'ruins']) { const w = zw[k] || 0; if (w <= 0) continue; fz.r += FOGZ[k].col.r * w; fz.g += FOGZ[k].col.g * w; fz.b += FOGZ[k].col.b * w; fogD += FOGZ[k].d * w; wsum += w; }
  if (wsum > 0) { fz.multiplyScalar(1 / wsum); fogD /= wsum; } else { fz.copy(FOGZ.meadow.col); fogD = FOGZ.meadow.d; }
  const gloom = (zw.mire || 0) * 0.5 + (zw.ruins || 0) * 0.65;
  // sky colours
  const zen = tmp.copy(PAL.night.zen).lerp(PAL.day.zen, dayK).lerp(PAL.dusk.zen, duskK * 0.55);
  const hor = tmp2.copy(PAL.night.hor).lerp(PAL.day.hor, dayK).lerp(PAL.dusk.hor, duskK);
  if (zw.ruins > 0.05) { zen.lerp(C(0.2, 0.12, 0.14).multiplyScalar(0.3 + 0.7 * dayK), zw.ruins * 0.45); hor.lerp(C(0.75, 0.42, 0.3).multiplyScalar(0.25 + 0.75 * dayK), zw.ruins * 0.55); }
  if (zw.mire > 0.05) { hor.lerp(C(0.55, 0.66, 0.5).multiplyScalar(0.25 + 0.75 * dayK), zw.mire * 0.5); }
  const u = skyMat.uniforms;
  u.uSunDir.value.copy(sd); u.uMoonDir.value.copy(md); u.uZen.value.copy(zen); u.uHor.value.copy(hor);
  u.uGnd.value.copy(hor).multiplyScalar(0.4).lerp(C(0.05, 0.16, 0.22), 0.5 * dayK);
  u.uSunCol.value.copy(PAL.day.sun).lerp(PAL.dusk.sun, duskK);
  u.uNight.value = nightK; u.uTime.value = t; u.uDay.value = dayK;
  u.uCloud.value = 0.44 + gloom * 0.25;
  u.uCloudCol.value.setRGB(1.0, 0.99, 0.97).multiplyScalar(0.06 + 1.0 * dayK).lerp(C(1.0, 0.62, 0.42), duskK * 0.6);
  u.uCloudShade.value.copy(hor).lerp(zen, 0.35).multiplyScalar(0.85).lerp(C(0.55, 0.58, 0.66).multiplyScalar(0.08 + 0.92 * dayK), 0.5);
  if (zw.ruins > 0.05) u.uCloudShade.value.lerp(C(0.3, 0.16, 0.14).multiplyScalar(0.3 + 0.7 * dayK), zw.ruins * 0.5);
  SKY.dome.position.copy(camPos);
  // lights
  const sunUp = elev > -0.03;
  const ld = SKY.lightDir.copy(sunUp ? sd : md);
  const sun = SKY.sun, hemi = SKY.hemi;
  const sunI = sunUp ? (0.35 + 3.0 * smooth(-0.02, 0.4, elev)) * (1 - gloom * 0.3) : 0.75 * nightK;
  sun.intensity = sunI;
  sun.color.copy(sunUp ? u.uSunCol.value : C(0.55, 0.66, 1.0));
  hemi.intensity = (0.55 + 0.6 * dayK) * (1 - gloom * 0.15);
  hemi.color.copy(zen).lerp(C(0.8, 0.88, 1.0), 0.55).multiplyScalar(1.15).lerp(C(0.35, 0.45, 0.75), nightK * 0.7);
  hemi.groundColor.setRGB(0.42, 0.36, 0.25).multiplyScalar(0.35 + 0.65 * dayK);
  if (zw.mire > 0.1) hemi.groundColor.lerp(C(0.25, 0.3, 0.18), zw.mire * 0.5);
  // the shadow box: centred on the player, snapped to whole shadow texels so edges don't crawl as you walk
  const sb = ENV.Q.shadowBox || 40, every = ENV.Q.shadowEvery || 1, r = ENV.renderer;
  const tex = (sb * 2) / sun.shadow.mapSize.x;
  const rx = _rx.set(0, 1, 0).cross(ld); if (rx.lengthSq() < 1e-6) rx.set(1, 0, 0); rx.normalize(); const uy = _uy.copy(ld).cross(rx).normalize();
  let due = frame % every === 0;
  if (Math.abs(_lastLd.dot(ld) - 1) > 2e-4) { _lastLd.copy(ld); due = true; }
  if (!sun._placed || due) {
    const sa = Math.round(focus.dot(rx) / tex) * tex, b2 = Math.round(focus.dot(uy) / tex) * tex, c2 = focus.dot(ld);
    const fp = _fp.copy(rx).multiplyScalar(sa).addScaledVector(uy, b2).addScaledVector(ld, c2);
    sun.target.position.copy(fp); sun.position.copy(fp).addScaledVector(ld, 200);
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld(); sun._placed = true;
    r.shadowMap.needsUpdate = true;
  }
  sun.castShadow = !!ENV.Q.shadows && sun.intensity > 0.05;
  // haze: the zone's colour lit by the time of day, melting into the horizon
  const fog = ENV.scene.fog;
  const fc = new THREE.Color().copy(hor).lerp(zen, 0.12).lerp(fz.clone().multiplyScalar(0.12 + 0.88 * dayK).lerp(PAL.dusk.hor, duskK * 0.35), 0.6);
  if (nightK > 0.01) fc.lerp(C(0.035, 0.05, 0.085), nightK * 0.8);
  fog.color.lerp(fc, Math.min(1, dt * 1.5 + (frame < 3 ? 1 : 0)));
  const dens = fogD * (ENV.Q.fogMul || 1) * (1 + nightK * 0.35);
  fog.density += (dens - fog.density) * Math.min(1, dt * 1.2 + (frame < 3 ? 1 : 0));
  u.uFog.value.copy(fog.color); u.uFogK.value = clamp(0.25 + (fogD - 0.0018) * 70, 0.25, 0.95);
  // shared uniforms
  U.uSunDir.value.copy(ld); U.uSunCol.value.copy(sun.color).multiplyScalar(Math.min(1.25, sun.intensity / 2.6 + 0.06));
  U.uSkyCol.value.copy(zen); U.uHorCol.value.copy(hor); U.uNight.value = nightK;
  // re-capture the sky for reflections when its colours have visibly changed (at most every 6 s)
  if (pmrem) {
    envT -= dt;
    const key = [zen.r, zen.g, zen.b, hor.r, hor.g, hor.b].map((v) => Math.round(v * 24)).join(',');
    if (!envRT || (envT <= 0 && key !== envKeyLast)) { envT = 6; envKeyLast = key; try { refreshEnv(); } catch (e) { console.warn(e); pmrem = null; } }
    ENV.scene.environmentIntensity = 0.35 + 0.45 * dayK;
  }
  return { dayK, duskK, nightK, gloom };
}

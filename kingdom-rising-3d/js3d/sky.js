// Kingdom Rising 3D — sky dome (day, sunset, night, stars, moon, aurora, clouds), sun and moon light,
// ambient light, fog, rain, snow, embers and lightning, all driven by the game clock and weather
import { THREE, K3, TS, PX } from './core.js';
import { geo } from './geo.js';

const KR = window.KR, D = KR.D, W = KR.W, G = KR.G;
const scene = K3.scene;

export const sky = {};
K3.sky = sky;

// ---------- lights ----------
const sun = new THREE.DirectionalLight(0xfff2dd, 3);
sun.castShadow = true;
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.06;
const _ld = new THREE.Vector3(), _rx = new THREE.Vector3(), _uy = new THREE.Vector3(), _fp = new THREE.Vector3(), _lastLd = new THREE.Vector3();
sun.shadow.camera.near = 1; sun.shadow.camera.far = 600;
scene.add(sun); scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbcd4f0, 0x5a4a38, 0.9);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.0);
scene.add(ambient);
sky.sun = sun; sky.hemi = hemi;
function applyShadowQuality() {
  const q = K3.quality;
  sun.castShadow = !!q.shadows;
  const s = q.shadowSize; if (sun.shadow.mapSize.x !== s) { sun.shadow.mapSize.set(s, s); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
}
applyShadowQuality();
K3.onQuality.push(applyShadowQuality);

// ---------- sky dome ----------
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGnd: { value: new THREE.Color() },
    uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uCloud: { value: 0.3 }, uCloudCol: { value: new THREE.Color() }, uTime: { value: 0 }, uAurora: { value: 0 }, uFlash: { value: 0 }, uHaze: { value: 0 },
  },
  vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }',
  fragmentShader: `
    uniform vec3 uSunDir, uMoonDir, uZen, uHor, uGnd, uSunCol, uCloudCol; uniform float uNight, uCloud, uTime, uAurora, uFlash, uHaze;
    varying vec3 vD;
    float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float h2(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y); }
    float fb(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 1.7; a *= .5; } return s; }
    void main(){
      vec3 d = normalize(vD); float y = d.y;
      vec3 col = mix(uHor, uZen, pow(clamp(y, 0., 1.), .5));
      col = mix(col, uHor * (1. + uHaze), exp(-max(y, 0.) * 9.) * .5);
      col = mix(col, uGnd, smoothstep(0., -.2, y));
      float sd = max(dot(d, normalize(uSunDir)), 0.);
      float sunUp = smoothstep(-.12, .05, uSunDir.y);
      col += uSunCol * (pow(sd, 1600.) * 60. * step(.0, y + .02) + pow(sd, 14.) * .32 + pow(sd, 3.) * .12) * sunUp * (1. - uCloud * .6);
      // stars and the milky band
      if (uNight > .01 && y > -.05) {
        vec3 sp = d * 380.; vec3 ci = floor(sp); float s = h3(ci); float tw = .6 + .4 * sin(uTime * 3. + s * 60.);
        float star = step(.9975, s) * smoothstep(.55, .0, length(fract(sp) - .5)) * tw;
        float band = exp(-pow(dot(d, normalize(vec3(.4, .35, -.84))) * 3.2, 2.)) * fb(d.xz * 9. + d.y * 3.) * .5;
        col += (vec3(star) * 2.2 + vec3(.45, .5, .7) * band * .25) * uNight * (1. - uCloud * .9);
        // the moon
        float md = dot(d, normalize(uMoonDir));
        float disk = smoothstep(.99935, .9995, md);
        float crater = fb(d.xy * 260.) * .35;
        col = mix(col, vec3(1., .97, .9) * (1.2 - crater), disk * uNight * (1. - uCloud * .7));
        col += vec3(.5, .6, .8) * pow(max(md, 0.), 120.) * .25 * uNight;
        // aurora over the frozen north
        if (uAurora > .01 && y > 0.) {
          float a = 0.; vec2 q = d.xz / (y + .25);
          for (int i = 0; i < 3; i++) { float fi = float(i); float w = sin(q.x * (1.2 + fi * .4) + uTime * .07 + fb(q * .6 + fi) * 4.) * .5 + .5; a += pow(w, 9.) * smoothstep(.05, .35, y) * smoothstep(.9, .3, y) * (.8 - fi * .2); }
          col += mix(vec3(.1, 1., .5), vec3(.5, .2, 1.), smoothstep(.2, .7, y)) * a * uAurora * uNight * .9;
        }
      }
      // clouds on a sky plane
      if (y > 0.) {
        vec2 cu = d.xz / (y + .12) * .9 + vec2(uTime * .006, uTime * .0035);
        float c = fb(cu * 1.3) * .65 + fb(cu * 4. + 3.) * .35;
        float cov = smoothstep(1. - uCloud * .95, 1.25 - uCloud * .7, c + uCloud * .25) * smoothstep(0., .18, y);
        float lit = clamp(dot(normalize(vec3(d.x, .2, d.z)), normalize(uSunDir)) * .5 + .5, 0., 1.);
        vec3 cc = uCloudCol * (.65 + .55 * lit) + uSunCol * pow(sd, 6.) * .6 * sunUp;
        col = mix(col, cc, cov * .92);
      }
      col += vec3(.75, .8, 1.) * uFlash;
      gl_FragColor = vec4(col, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const dome = new THREE.Mesh(new THREE.SphereGeometry(2000, 48, 24), skyMat);
dome.frustumCulled = false; dome.renderOrder = -10; dome.name = 'sky';
scene.add(dome);
scene.background = null;

// image-based lighting: the sky is captured into an environment map now and then, so metal, water
// and wet stone reflect the real sky colour
const pmrem = new THREE.PMREMGenerator(K3.renderer);
const envScene = new THREE.Scene();
const envDome = new THREE.Mesh(dome.geometry, skyMat); envDome.frustumCulled = false; envScene.add(envDome);
let envRT = null, envT = 0;
function refreshEnv() {
  const old = envRT; envRT = pmrem.fromScene(envScene, 0.02, 1, 4000);
  K3.scene.environment = envRT.texture; if (old) old.dispose();
}

// a sea of clouds below the summit
const cloudSea = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, fog: false,
  uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(1, 1, 1) } },
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `uniform float uTime; uniform vec3 uCol; varying vec3 vW;
    float h2(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y); }
    float fb(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 6; i++) { s += a * n2(p); p = p * 2.03 + 1.7; a *= .5; } return s; }
    void main(){ vec2 p = vW.xz * .006 + uTime * .004; float c = fb(p) * .7 + fb(p * 3.1 - uTime * .01) * .3; float d = length(vW.xz - cameraPosition.xz);
      gl_FragColor = vec4(uCol * (.75 + .45 * c), smoothstep(.25, .6, c) * .95 * smoothstep(3200., 1200., d));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
cloudSea.geometry.rotateX(-Math.PI / 2); cloudSea.visible = false; cloudSea.renderOrder = -5; cloudSea.name = 'cloudsea';
scene.add(cloudSea);

// ---------- weather particles ----------
const RAIN_N = 5000, SNOW_N = 3500;
function particleBox(n, lines) {
  const g = new THREE.BufferGeometry(); const p = new Float32Array(n * (lines ? 2 : 1) * 4);
  const r = K3.rng(lines ? 7 : 9);
  for (let i = 0; i < n; i++) { const x = r(), y = r(), z = r(), s = r(); if (lines) { p.set([x, y, z, 0], i * 8); p.set([x, y, z, 1], i * 8 + 4); } else p.set([x, y, z, s], i * 4); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 4)); g.setAttribute('aP', g.attributes.position);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  return g;
}
const rainMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uCol: { value: new THREE.Color(0.7, 0.75, 0.85) }, uWind: { value: new THREE.Vector2(2, 1) } },
  vertexShader: `attribute vec4 aP; uniform float uTime, uAmt; uniform vec3 uCam; uniform vec2 uWind; varying float vA;
    void main(){ vec3 box = vec3(40., 26., 40.); vec3 p = aP.xyz;
      vec3 w = vec3(p.x * box.x, 0., p.z * box.z); float fall = mod(p.y * box.y - uTime * 14.5, box.y);
      w.y = fall - box.y * .5; w.xz += uWind * (fall / box.y) * .5;
      w = uCam + vec3(mod(w.x - uCam.x, box.x) - box.x * .5, w.y, mod(w.z - uCam.z, box.z) - box.z * .5);
      if (aP.w > .5) { w.y += .55; w.xz -= uWind * .04; }
      vA = step(p.x, uAmt) * .45;
      gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.); }`,
  fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ if (vA < .01) discard; gl_FragColor = vec4(uCol, vA); }',
});
const rain = new THREE.LineSegments(particleBox(RAIN_N, true), rainMat); rain.frustumCulled = false; rain.visible = false; rain.renderOrder = 5;
scene.add(rain);
const snowMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uCol: { value: new THREE.Color(1, 1, 1) }, uRise: { value: 0 }, uSize: { value: 1 } },
  vertexShader: `attribute vec4 aP; uniform float uTime, uAmt, uRise, uSize; uniform vec3 uCam; varying float vA;
    void main(){ vec3 box = vec3(36., 22., 36.); vec3 p = aP.xyz; float spd = mix(1.1, 1.9, aP.w) * (uRise > .5 ? -.6 : 1.);
      float fall = mod(p.y * box.y - uTime * spd, box.y);
      vec3 w = vec3(p.x * box.x + sin(uTime * .7 + p.z * 20.) * .8, fall - box.y * .5, p.z * box.z + cos(uTime * .5 + p.x * 17.) * .8);
      w = uCam + vec3(mod(w.x - uCam.x, box.x) - box.x * .5, w.y, mod(w.z - uCam.z, box.z) - box.z * .5);
      vA = step(p.x, uAmt);
      vec4 mv = viewMatrix * vec4(w, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * (uRise > .5 ? 60. : 90.) / -mv.z; }`,
  fragmentShader: 'uniform vec3 uCol; uniform float uRise; varying float vA; void main(){ if (vA < .01) discard; vec2 c = gl_PointCoord - .5; float a = smoothstep(.5, .1, length(c)); gl_FragColor = vec4(uCol, a * (uRise > .5 ? .9 : .8)); }',
});
const snow = new THREE.Points(particleBox(SNOW_N, false), snowMat); snow.frustumCulled = false; snow.visible = false; snow.renderOrder = 5;
scene.add(snow);

// ---------- state ----------
const tmp = new THREE.Color(), tmp2 = new THREE.Color();
const C = (r, g, b) => new THREE.Color(r, g, b);
const PAL = {
  day: { zen: C(0.16, 0.34, 0.72), hor: C(0.58, 0.7, 0.84), gnd: C(0.32, 0.31, 0.3), sun: C(1.0, 0.93, 0.82) },
  dusk: { zen: C(0.2, 0.24, 0.45), hor: C(0.98, 0.5, 0.26), gnd: C(0.2, 0.15, 0.12), sun: C(1.0, 0.55, 0.25) },
  night: { zen: C(0.006, 0.01, 0.028), hor: C(0.03, 0.04, 0.07), gnd: C(0.01, 0.01, 0.015), sun: C(0.4, 0.5, 0.8) },
};
let flash = 0, nextBolt = 8, regDark = 0, regFog = 0, aurora = 0, insideK = 0, rainAmt = 0, snowAmt = 0, emberAmt = 0, cloudK = 0.3, fogK = 0;
sky.lightLevel = 1; sky.night = 0; sky.darkness = 0.3;

export function updateSky(dt, camPos, ctx) {
  const t = K3.time;
  const h = ((G.clock || 600) / 60) % 24;
  // sun path: rises in the east (+x), noon in the south (+z), sets in the west
  const a = ((h - 6) / 14) * Math.PI; // 0 at 6:00, PI at 20:00
  const sd = new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.92 + 0.02, Math.sin(a) * 0.45 + 0.12).normalize();
  if (h < 5 || h > 21) sd.set(Math.cos(a), Math.sin(a), 0.3).normalize();
  const md = new THREE.Vector3(-sd.x * 0.8, Math.max(0.25, -sd.y) * 0.9 + 0.2, -0.4).normalize();
  const elev = sd.y;
  const dayK = K3.smooth(-0.08, 0.18, elev); // 0 night .. 1 day
  const duskK = Math.max(0, 1 - Math.abs(elev - 0.04) / 0.22) * K3.smooth(-0.2, 0.0, elev); // near the horizon
  const nightK = 1 - K3.smooth(-0.2, 0.02, elev);
  sky.night = nightK;
  const rp = G.player || { x: camPos.x / PX, y: camPos.z / PX }; // no hero yet: the menus fly over the world
  const reg = D.REGIONS[W.regionAtPx(rp.x, rp.y)] || {};
  const dungeon = geo.dungeon;
  regDark += ((reg.dark || 0) - regDark) * Math.min(1, dt * 0.8);
  const wt = G.weather ? G.weather.type : 'clear';
  const snowy = reg.biome === 'snow' || reg.biome === 'summit' && wt !== 'clear';
  const tCloud = wt === 'rain' ? 0.95 : wt === 'cloudy' ? 0.7 : wt === 'fog' ? 0.75 : 0.28;
  cloudK += (tCloud - cloudK) * Math.min(1, dt * 0.3);
  const tFog = wt === 'fog' ? 1 : wt === 'rain' ? 0.45 : wt === 'cloudy' ? 0.15 : 0;
  fogK += (tFog - fogK) * Math.min(1, dt * 0.3);
  const fogRegion = reg.biome === 'swamp' ? 0.6 : reg.biome === 'gloom' ? 0.7 : reg.biome === 'ash' ? 0.35 : reg.biome === 'scar' ? 0.35 : 0;
  regFog += (fogRegion - regFog) * Math.min(1, dt * 0.6);
  insideK += ((ctx.inside ? 1 : 0) - insideK) * Math.min(1, dt * 3);
  // sky colours
  const zen = tmp.copy(PAL.night.zen).lerp(PAL.day.zen, dayK).lerp(PAL.dusk.zen, duskK * 0.6);
  const hor = tmp2.copy(PAL.night.hor).lerp(PAL.day.hor, dayK).lerp(PAL.dusk.hor, duskK);
  // overcast: grey it out
  const grey = 0.55 * (0.15 + 0.85 * dayK);
  zen.lerp(C(grey * 0.8, grey * 0.84, grey * 0.9), cloudK * 0.75); hor.lerp(C(grey, grey * 1.02, grey * 1.05), cloudK * 0.6);
  // gloomy regions tint the whole sky
  if (regDark > 0.3) { const dk = (regDark - 0.3) * 1.2; zen.lerp(C(0.05, 0.04, 0.08), dk * 0.7); hor.lerp(reg.biome === 'scar' || reg.biome === 'volcanic' ? C(0.25, 0.08, 0.04) : C(0.12, 0.1, 0.16), dk * 0.7); }
  const u = skyMat.uniforms;
  u.uSunDir.value.copy(sd); u.uMoonDir.value.copy(md); u.uZen.value.copy(zen); u.uHor.value.copy(hor);
  u.uGnd.value.copy(hor).multiplyScalar(0.45);
  u.uSunCol.value.copy(PAL.day.sun).lerp(PAL.dusk.sun, duskK);
  u.uNight.value = nightK; u.uCloud.value = cloudK; u.uTime.value = t;
  u.uCloudCol.value.setRGB(0.9, 0.9, 0.93).multiplyScalar(0.12 + 0.88 * dayK).lerp(C(0.9, 0.55, 0.4), duskK * 0.5).multiplyScalar(1 - cloudK * 0.45);
  aurora += (((reg.biome === 'snow' || reg.id === 'ironspine' || W.realm === 'summit') && wt !== 'rain' ? 1 : 0) - aurora) * Math.min(1, dt * 0.2);
  u.uAurora.value = aurora; u.uHaze.value = fogK * 0.3;
  dome.position.copy(camPos);
  // lights
  const sunUp = elev > -0.02;
  const lightDir = sunUp ? sd : md;
  const overcast = 1 - cloudK * 0.55;
  const darkMul = 1 - regDark * 0.62;
  let sunI = sunUp ? (0.25 + 2.9 * K3.smooth(-0.02, 0.35, elev)) * overcast * darkMul : 0.32 * nightK * (1 - cloudK * 0.6) * darkMul;
  let hemiI = (0.18 + 0.85 * dayK) * (0.85 + cloudK * 0.25) * darkMul;
  if (dungeon) { sunI = 0; hemiI = geo.dtype === 'cave' ? 0.11 : 0.13; }
  hemiI *= 1 - insideK * 0.62;
  sun.intensity = sunI * (1 - insideK * 0.15);
  sun.color.copy(sunUp ? u.uSunCol.value : C(0.55, 0.65, 0.95));
  hemi.intensity = hemiI + flash * 3;
  hemi.color.copy(zen).lerp(C(0.8, 0.85, 0.95), 0.35).multiplyScalar(1.4);
  hemi.groundColor.setRGB(0.36, 0.3, 0.24).multiplyScalar(0.4 + 0.6 * dayK);
  if (dungeon) { hemi.color.setRGB(0.5, 0.55, 0.7); hemi.groundColor.setRGB(0.25, 0.2, 0.16); if (geo.dgnId === 'frostfang') hemi.color.setRGB(0.5, 0.7, 0.95); if (geo.dgnId === 'abyss') hemi.color.setRGB(0.8, 0.35, 0.3); }
  // shadow box follows the camera
  const sh = K3.quality.shadowBox || 55;
  const sc = sun.shadow.camera;
  if (sc.right !== sh) { sc.left = -sh; sc.right = sh; sc.top = sh; sc.bottom = -sh; sc.updateProjectionMatrix(); }
  const tgt = ctx.focus || camPos;
  // snap the shadow area to whole shadow texels, measured across the light, so shadow edges on roofs and
  // walls stay put as you move instead of crawling and flickering
  const texel = (sh * 2) / sun.shadow.mapSize.x;
  const ld = _ld.copy(lightDir).normalize(); const rx = _rx.set(0, 1, 0).cross(ld); if (rx.lengthSq() < 1e-6) rx.set(1, 0, 0); rx.normalize(); const uy = _uy.copy(ld).cross(rx).normalize();
  if (Math.abs(_lastLd.dot(ld) - 1) > 1e-5) { _lastLd.copy(ld); K3.shadowNow(); }
  if (!K3.shadowDue || K3.shadowDue() || !sun._placed) {
    const sa = Math.round(tgt.dot(rx) / texel) * texel, b2 = Math.round(tgt.dot(uy) / texel) * texel, c2 = tgt.dot(ld);
    const fp = _fp.copy(rx).multiplyScalar(sa).addScaledVector(uy, b2).addScaledVector(ld, c2);
    sun.target.position.copy(fp);
    sun.position.copy(fp).addScaledVector(ld, 200);
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld(); sun._placed = true;
  }
  sun.castShadow = !!K3.quality.shadows && !dungeon && sun.intensity > 0.05;
  // fog
  const fog = K3.scene.fog;
  let dens = 0.0016 + fogK * 0.011 + regFog * 0.006 + cloudK * 0.0006;
  if (dungeon) dens = 0.03;
  if (W.realm === 'summit') dens *= 0.6;
  dens = dens + insideK * 0.004;
  fog.density += (dens - fog.density) * Math.min(1, dt * 1.5);
  const fc = tmp.copy(hor).lerp(zen, 0.15);
  if (regFog > 0.1) fc.lerp(reg.biome === 'swamp' ? C(0.3, 0.34, 0.26).multiplyScalar(0.2 + 0.8 * dayK) : C(0.22, 0.2, 0.26).multiplyScalar(0.3 + 0.7 * dayK), regFog * 0.7);
  if (dungeon) fc.setRGB(0.012, 0.012, 0.016);
  fog.color.copy(fc);
  // shared uniforms for water and the like
  const sh2 = K3.shared;
  sh2.uSunDir.value.copy(lightDir); sh2.uSunCol.value.copy(sun.color).multiplyScalar(Math.min(1.2, sun.intensity / 2.4 + 0.08));
  sh2.uSkyCol.value.copy(zen); sh2.uHorCol.value.copy(hor);
  if (dungeon) { sh2.uSkyCol.value.setRGB(0.02, 0.025, 0.03); sh2.uHorCol.value.setRGB(0.03, 0.03, 0.035); sh2.uSunCol.value.setRGB(0.35, 0.3, 0.25); }
  // weather particles
  const wantRain = !dungeon && !ctx.inside && wt === 'rain' && !snowy && reg.biome !== 'desert' ? 1 : 0;
  const wantSnow = !dungeon && !ctx.inside && snowy && wt !== 'clear' ? 1 : (geo.dgnId === 'frostfang' ? 0.25 : 0);
  const wantEmber = !ctx.inside && (reg.biome === 'volcanic' || reg.biome === 'scar' || reg.biome === 'ash' || geo.dgnId === 'abyss') ? (reg.biome === 'ash' ? 0.4 : 0.6) : 0;
  rainAmt += (wantRain - rainAmt) * Math.min(1, dt * 0.5); snowAmt += (Math.max(wantSnow, wantEmber) - snowAmt) * Math.min(1, dt * 0.5);
  rain.visible = rainAmt > 0.01; rainMat.uniforms.uAmt.value = rainAmt; rainMat.uniforms.uTime.value = t; rainMat.uniforms.uCam.value.copy(camPos);
  rainMat.uniforms.uCol.value.setRGB(0.55, 0.6, 0.7).multiplyScalar(0.25 + 0.75 * dayK);
  snow.visible = snowAmt > 0.01; snowMat.uniforms.uAmt.value = snowAmt; snowMat.uniforms.uTime.value = t; snowMat.uniforms.uCam.value.copy(camPos);
  const ember = wantEmber > wantSnow; snowMat.uniforms.uRise.value = ember ? 1 : 0;
  if (ember) snowMat.uniforms.uCol.value.setRGB(reg.biome === 'ash' ? 0.75 : 3.5, reg.biome === 'ash' ? 0.72 : 1.2, reg.biome === 'ash' ? 0.7 : 0.3); else snowMat.uniforms.uCol.value.setRGB(1, 1, 1).multiplyScalar(0.3 + 0.7 * dayK);
  // lightning in storms
  flash = Math.max(0, flash - dt * 4);
  if (wantRain && rainAmt > 0.6) { nextBolt -= dt; if (nextBolt <= 0) { nextBolt = 7 + Math.random() * 18; flash = 1; setTimeout(() => { flash = 0.7; }, 120); setTimeout(() => { try { KR.A.sfx('rumble', 0.5); } catch (e) {} }, 900 + Math.random() * 1600); } }
  u.uFlash.value = flash * 0.6;
  // clouds under the summit
  cloudSea.visible = W.realm === 'summit';
  if (cloudSea.visible) { cloudSea.position.set(camPos.x, -16, camPos.z); cloudSea.material.uniforms.uTime.value = t; cloudSea.material.uniforms.uCol.value.setRGB(1, 1, 1).multiplyScalar(0.15 + 0.85 * dayK).lerp(C(1, 0.6, 0.45), duskK * 0.6); }
  dome.visible = !dungeon;
  // re-capture the sky for reflections every few seconds
  envT -= dt; if (envT <= 0 || !envRT) { envT = 6; try { refreshEnv(); } catch (e) { console.warn(e); envT = 1e9; } }
  const envI = (dungeon ? 0.12 : 0.25 + 0.75 * dayK) * (1 - insideK * 0.7) * (1 - regDark * 0.5);
  K3.scene.environmentIntensity = envI;
  // how dark it is for the torches (0 bright day .. 1 black)
  sky.lightLevel = dungeon ? 0 : K3.clamp(dayK * (1 - regDark * 0.6) * (1 - cloudK * 0.25), 0, 1);
  sky.darkness = dungeon ? 1 : K3.clamp(Math.max(1 - sky.lightLevel, insideK * 0.8), 0, 1);
  // a touch more bloom at night when the fires glow
  if (K3.bloom) { K3.bloom.strength = 0.22 + sky.darkness * 0.22; K3.bloom.threshold = 0.9 - sky.darkness * 0.12; }
  if (K3.renderer) K3.renderer.toneMappingExposure = (1.0 + sky.darkness * 0.35 + (dungeon ? 0.4 : 0)) * (K3.settings.exposure || 1); // Settings → Brightness
}

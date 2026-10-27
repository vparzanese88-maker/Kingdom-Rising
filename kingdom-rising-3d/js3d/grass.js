// Kingdom Rising 3D — a field of grass around the camera, placed entirely on the GPU: a fixed grid of
// clumps follows the camera, each clump reads the ground height and the tile type from textures,
// so meadows, dry plains and forest floors get the right grass and roads, floors and water get none
import { THREE, K3, TILE } from './core.js';
import { geo } from './geo.js';
import { cardTex, TERRAIN_LAYERS } from './texgen.js';

const L = Object.fromEntries(TERRAIN_LAYERS.map((n, i) => [n, i]));
let mesh = null, mat = null, hTex = null, built = 0;
function settings() { const q = K3.quality.grass; if (!q) return null; return { spacing: q >= 1.5 ? 0.34 : q >= 1 ? 0.42 : 0.6, radius: q >= 1.5 ? 46 : q >= 1 ? 34 : 24 }; }

function makeMaterial() {
  const m = new THREE.MeshStandardMaterial({ map: cardTex('grass'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95, metalness: 0 });
  m.alphaToCoverage = !!K3.quality.msaa;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute vec2 iOff; uniform vec2 uCamCell; uniform float uSpacing; uniform float uRadius; uniform sampler2D tHeight; uniform sampler2D tTile; uniform vec2 uTileN; uniform float uTileM; uniform float uTime; uniform float uWind;
      varying vec3 vTint; varying float vFade;
      float gh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float hAt(vec2 t){ vec2 g = clamp(t, vec2(0.), uTileN - .001); ivec2 i = ivec2(floor(g)); vec2 f = fract(g);
        float a = texelFetch(tHeight, i, 0).r, b = texelFetch(tHeight, i + ivec2(1, 0), 0).r, c = texelFetch(tHeight, i + ivec2(0, 1), 0).r, d = texelFetch(tHeight, i + ivec2(1, 1), 0).r;
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
    `).replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0., 1., 0.);')
      .replace('#include <begin_vertex>', `
      vec2 cell = uCamCell + iOff;
      vec2 jit = vec2(gh(cell), gh(cell + 17.3));
      vec2 wxz = (cell + jit) * uSpacing;
      float d = distance(wxz, cameraPosition.xz);
      vec2 tc = wxz / uTileM;
      ivec2 ti = ivec2(floor(tc));
      float layer = floor(texelFetch(tTile, clamp(ti, ivec2(0), ivec2(uTileN) - 1), 0).r * 255. + .5);
      float dens = 0.; vec3 tint = vec3(1.);
      if (layer == ${L.grass}.) { dens = 1.; tint = vec3(1.); }
      else if (layer == ${L.darkgrass}.) { dens = .9; tint = vec3(.7, .78, .62); }
      else if (layer == ${L.plains}.) { dens = .95; tint = vec3(1.35, 1.18, .6); }
      else if (layer == ${L.forest}.) { dens = .3; tint = vec3(.75, .85, .62); }
      else if (layer == ${L.gloom}.) { dens = .35; tint = vec3(.55, .55, .68); }
      else if (layer == ${L.mud}.) { dens = .2; tint = vec3(.8, .8, .5); }
      else if (layer == ${L.ash}.) { dens = .12; tint = vec3(.65, .64, .6); }
      if (tc.x < 0. || tc.y < 0. || tc.x > uTileN.x || tc.y > uTileN.y) dens = 0.;
      float ground = hAt(tc);
      float slope = abs(hAt(tc + vec2(.5, 0.)) - ground) + abs(hAt(tc + vec2(0., .5)) - ground);
      dens *= 1. - smoothstep(.35, .7, slope);
      float keep = step(gh(cell + 7.7), dens);
      float fade = 1. - smoothstep(uRadius * .7, uRadius, d); vFade = fade;
      float sc = (.7 + gh(cell + 3.1) * .6) * keep * fade;
      float ang = gh(cell + 11.) * 6.2831;
      vec3 transformed = position * sc; transformed.y *= .85 + gh(cell + 5.) * .5;
      float ca = cos(ang), sa = sin(ang); transformed.xz = mat2(ca, -sa, sa, ca) * transformed.xz;
      // wind: blades lean and ripple with gusts that roll across the field
      float gust = sin(wxz.x * .15 + wxz.y * .1 + uTime * 1.3) * .5 + .5;
      float sway = (sin(uTime * 2.2 + wxz.x * .9 + wxz.y * .7) * .5 + gust * .8) * uWind * position.y;
      transformed.x += sway * .22; transformed.z += sway * .12;
      transformed.xz += wxz; transformed.y += ground;
      vTint = tint * (.85 + gh(cell + 9.) * .3);
    `);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTint; varying float vFade;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= vTint;');
  };
  m.customProgramCacheKey = () => 'krgrass';
  m.userData.u = { uCamCell: { value: new THREE.Vector2() }, uSpacing: { value: 0.5 }, uRadius: { value: 40 }, tHeight: { value: null }, tTile: { value: null }, uTileN: { value: new THREE.Vector2(1, 1) }, uTileM: { value: TILE }, uTime: K3.shared.uTime, uWind: K3.shared.uWind };
  return m;
}
function makeGeometry(spacing, radius) {
  // one clump: three crossed blades
  const base = new THREE.BufferGeometry(); const pos = [], uv = [], idx = [];
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI; const cx = Math.cos(a) * 0.24, cz = Math.sin(a) * 0.24; const o = pos.length / 3;
    pos.push(-cx, 0, -cz, cx, 0, cz, cx, 0.42, cz, -cx, 0.42, -cz); uv.push(0, 0, 1, 0, 1, 1, 0, 1); idx.push(o, o + 1, o + 2, o, o + 2, o + 3); }
  base.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); base.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); base.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); base.setIndex(idx);
  const g = new THREE.InstancedBufferGeometry(); g.index = base.index; for (const k of ['position', 'uv', 'normal']) g.setAttribute(k, base.attributes[k]);
  const n = Math.ceil(radius / spacing); const off = [];
  for (let y = -n; y <= n; y++) for (let x = -n; x <= n; x++) if (x * x + y * y <= n * n) off.push(x, y);
  g.setAttribute('iOff', new THREE.InstancedBufferAttribute(new Float32Array(off), 2)); g.instanceCount = off.length / 2;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return g;
}
export const grass = {
  rebuild(tileTex) {
    const st = settings();
    if (mesh) { K3.scene.remove(mesh); mesh.geometry.dispose(); mesh = null; }
    if (!st || geo.dungeon) return;
    if (!mat) mat = makeMaterial();
    // heights as a float texture
    if (hTex) hTex.dispose();
    hTex = new THREE.DataTexture(geo.HV, geo.VW, geo.VH, THREE.RedFormat, THREE.FloatType); hTex.minFilter = hTex.magFilter = THREE.NearestFilter; hTex.needsUpdate = true;
    const u = mat.userData.u; u.tHeight.value = hTex; u.tTile.value = tileTex; u.uTileN.value.set(geo.W, geo.H); u.uSpacing.value = st.spacing; u.uRadius.value = st.radius;
    mesh = new THREE.Mesh(makeGeometry(st.spacing, st.radius), mat); mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'grass';
    K3.scene.add(mesh); built = geo.version;
  },
  refreshHeights() { if (hTex) { hTex.image.data = geo.HV; hTex.needsUpdate = true; } },
  update(cam) {
    if (!mesh) return; const u = mat.userData.u; const s = u.uSpacing.value;
    u.uCamCell.value.set(Math.floor(cam.x / s), Math.floor(cam.z / s));
  },
};
K3.onQuality.push(() => { if (K3.terrain && K3.terrain.tileTex) grass.rebuild(K3.terrain.tileTex); });

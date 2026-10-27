// Kingdom Rising 3D — terrain chunks with height-blended texture splatting, cliffs, snow caps,
// water (lakes, rivers, sea, sewers), lava, cave ceilings and the far horizon beyond the map edge
import { THREE, K3, TS, TILE } from './core.js';
import { geo, T, fbm } from './geo.js';
import { makeTerrainArrays, propTex, TERRAIN_LAYERS, NOISE_GLSL } from './texgen.js';

const KR = window.KR, D = KR.D, W = KR.W;
const CH = 32; // tiles per chunk side
const L = Object.fromEntries(TERRAIN_LAYERS.map((n, i) => [n, i]));

function layerOf(t, biome) {
  switch (t) {
    case T.GRASS: return biome === 'island' || biome === 'cityforest' ? L.grass : biome === 'desert' ? L.plains : L.grass;
    case T.DGRASS: return L.darkgrass;
    case T.FOREST: return L.forest;
    case T.ROAD: return L.road;
    case T.COBBLE: return L.cobble;
    case T.WATER: case T.DEEP: case T.BRIDGE: return biome === 'swamp' ? L.mud : biome === 'sewer' ? L.flagstone : biome === 'icecave' ? L.ice : biome === 'cave' || biome === 'crypt' ? L.cave : L.riverbed;
    case T.SAND: return L.sand;
    case T.ROCK: return biome === 'volcanic' ? L.volcanic : biome === 'scar' ? L.scar : biome === 'icecave' ? L.ice : L.rock;
    case T.SNOW: return L.snow;
    case T.MUD: return L.mud;
    case T.ASH: return L.ash;
    case T.WOOD: return L.dirt;
    case T.WALL: case T.DOOR: case T.CWALL: return L.gravel;
    case T.FARM: return L.farm;
    case T.STONE: case T.CARPET: return L.flagstone;
    case T.GRAVEL: return L.gravel;
    case T.LAVA: return L.lava;
    case T.GLOOM: return L.gloom;
    case T.PLAINS: return L.plains;
    case T.VOLC: return L.volcanic;
    case T.CAVE: return L.cave;
    case T.ICE: return L.ice;
    case T.SCAR: return L.scar;
  }
  return L.grass;
}

export const terrain = { group: new THREE.Group(), chunks: [], water: null };
K3.terrain = terrain;
terrain.group.name = 'terrain';
K3.scene.add(terrain.group);

let arrays = null, tileTex = null, terrainMat = null, ceilMat = null, waterMat = null, lavaMat = null;
const shared = K3.shared;

// ---------- terrain material ----------
function makeTerrainMaterial(ceiling) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: ceiling ? THREE.BackSide : THREE.FrontSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tAlb = { value: arrays.albedo }; sh.uniforms.tNrm = { value: arrays.normal }; sh.uniforms.tTile = { value: tileTex };
    sh.uniforms.uTileN = { value: new THREE.Vector2(geo.W, geo.H) }; sh.uniforms.uTileM = { value: TILE }; sh.uniforms.uTime = shared.uTime;
    sh.uniforms.uSnowLine = { value: geo.realm === 'summit' ? 20 : 36 };
    m.userData.shader = sh;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSnow; varying vec3 vWPos; varying vec3 vWNrm; varying float vSnow;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNrm = normalize(mat3(modelMatrix) * objectNormal); vSnow = aSnow;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      precision highp sampler2DArray;
      uniform sampler2DArray tAlb; uniform sampler2DArray tNrm; uniform sampler2D tTile; uniform vec2 uTileN; uniform float uTileM; uniform float uTime; uniform float uSnowLine;
      varying vec3 vWPos; varying vec3 vWNrm; varying float vSnow;
      float th(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float tn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(th(i), th(i + vec2(1, 0)), u.x), mix(th(i + vec2(0, 1)), th(i + vec2(1, 1)), u.x), u.y); }
      vec4 tdat(ivec2 c){ c = clamp(c, ivec2(0), ivec2(uTileN) - 1); return texelFetch(tTile, c, 0); }
      vec3 gN; float gRough; vec3 gEmis;
    `).replace('#include <map_fragment>', `
      vec3 N0 = normalize(vWNrm);
      vec2 tc = vWPos.xz / uTileM;
      vec2 jit = (vec2(tn(vWPos.xz * 1.3), tn(vWPos.zx * 1.3 + 7.1)) - .5) * .7 + (vec2(tn(vWPos.xz * 4.1 + 3.), tn(vWPos.zx * 4.1 - 2.)) - .5) * .2;
      vec2 pp = tc - .5 + jit; ivec2 i0 = ivec2(floor(pp)); vec2 f = fract(pp);
      vec4 d00 = tdat(i0), d10 = tdat(i0 + ivec2(1, 0)), d01 = tdat(i0 + ivec2(0, 1)), d11 = tdat(i0 + ivec2(1, 1));
      float l00 = floor(d00.r * 255. + .5), l10 = floor(d10.r * 255. + .5), l01 = floor(d01.r * 255. + .5), l11 = floor(d11.r * 255. + .5);
      vec2 uv = vWPos.xz / 3.2;
      vec4 alb; vec4 nrm;
      if (l00 == l10 && l00 == l01 && l00 == l11) { alb = texture(tAlb, vec3(uv, l00)); nrm = texture(tNrm, vec3(uv, l00)); }
      else {
        vec4 a0 = texture(tAlb, vec3(uv, l00)), a1 = texture(tAlb, vec3(uv, l10)), a2 = texture(tAlb, vec3(uv, l01)), a3 = texture(tAlb, vec3(uv, l11));
        vec4 w = vec4((1. - f.x) * (1. - f.y), f.x * (1. - f.y), (1. - f.x) * f.y, f.x * f.y);
        vec4 hw = w + vec4(a0.a, a1.a, a2.a, a3.a) * .45; float ma = max(max(hw.x, hw.y), max(hw.z, hw.w)) - .18; vec4 bw = max(hw - ma, 0.); bw /= dot(bw, vec4(1.)) + 1e-4;
        alb = a0 * bw.x + a1 * bw.y + a2 * bw.z + a3 * bw.w;
        nrm = texture(tNrm, vec3(uv, l00)) * bw.x + texture(tNrm, vec3(uv, l10)) * bw.y + texture(tNrm, vec3(uv, l01)) * bw.z + texture(tNrm, vec3(uv, l11)) * bw.w;
        if (l00 == ${L.lava}.) gEmis += a0.rgb * bw.x * (1. - a0.a) * 5.; if (l10 == ${L.lava}.) gEmis += a1.rgb * bw.y * (1. - a1.a) * 5.; if (l01 == ${L.lava}.) gEmis += a2.rgb * bw.z * (1. - a2.a) * 5.; if (l11 == ${L.lava}.) gEmis += a3.rgb * bw.w * (1. - a3.a) * 5.;
      }
      if (l00 == l10 && l00 == l01 && l00 == l11 && l00 == ${L.lava}.) gEmis += alb.rgb * (1. - alb.a) * 5.;
      // break up the tiling with broad light and dark patches and the per-tile variation
      float macro = tn(vWPos.xz * .045) * .6 + tn(vWPos.xz * .17) * .4;
      alb.rgb *= .8 + .4 * macro; alb.rgb *= .94 + .12 * d00.g;
      vec3 tN = nrm.xyz * 2. - 1.; float rough = nrm.a;
      vec3 Tt = normalize(vec3(1., 0., 0.) - N0 * N0.x), Bt = normalize(vec3(0., 0., 1.) - N0 * N0.z);
      vec3 nW = normalize(Tt * tN.x * 1.3 + Bt * tN.y * 1.3 + N0 * tN.z);
      // cliffs: triplanar rock where the ground is steep (and on cave ceilings)
      float cliff = smoothstep(.8, .56, N0.y);
      if (cliff > .001) {
        vec3 bwt = pow(abs(N0), vec3(4.)); bwt /= bwt.x + bwt.y + bwt.z;
        float rl = ${L.rock}.;
        vec4 cx = texture(tAlb, vec3(vWPos.zy / 5.5, rl)), cy = texture(tAlb, vec3(vWPos.xz / 5.5, rl)), cz = texture(tAlb, vec3(vWPos.xy / 5.5, rl));
        vec4 nx = texture(tNrm, vec3(vWPos.zy / 5.5, rl)), ny = texture(tNrm, vec3(vWPos.xz / 5.5, rl)), nz = texture(tNrm, vec3(vWPos.xy / 5.5, rl));
        vec4 ca = cx * bwt.x + cy * bwt.y + cz * bwt.z;
        float strata = tn(vec2(vWPos.y * .9, tn(vWPos.xz * .05) * 4.)); ca.rgb *= .82 + .3 * strata;
        vec3 pn = normalize(N0 + (vec3(0., nx.y * 2. - 1., nx.x * 2. - 1.) * bwt.x + vec3(ny.x * 2. - 1., 0., ny.y * 2. - 1.) * bwt.y + vec3(nz.x * 2. - 1., nz.y * 2. - 1., 0.) * bwt.z) * 1.4);
        alb.rgb = mix(alb.rgb, ca.rgb, cliff); nW = normalize(mix(nW, pn, cliff)); rough = mix(rough, .85, cliff);
      }
      // snow on high ground and in snowy lands, settling on the flatter faces
      float snow = clamp(vSnow * 1.5 - .35 + (vWPos.y - uSnowLine) / 9. + (tn(vWPos.xz * .3) - .5) * .5, 0., 1.) * smoothstep(.42, .72, nW.y);
      if (snow > .001) { vec4 sa = texture(tAlb, vec3(uv, ${L.snow}.)); vec4 sn = texture(tNrm, vec3(uv, ${L.snow}.)); alb.rgb = mix(alb.rgb, sa.rgb, snow); nW = normalize(mix(nW, normalize(N0 + (sn.xyz * 2. - 1.) * vec3(.6, .0, .6)), snow)); rough = mix(rough, .7, snow); }
      gN = nW; gRough = rough;
      diffuseColor.rgb *= alb.rgb;
    `).replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
      .replace('#include <normal_fragment_maps>', `normal = normalize((viewMatrix * vec4(gN, 0.)).xyz); ${ceiling ? 'normal = -normal;' : ''}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += gEmis;')
      .replace('void main() {', 'void main() { gEmis = vec3(0.);');
  };
  m.customProgramCacheKey = () => 'krterrain' + (ceiling ? 'c' : '');
  return m;
}

function buildTileTex() {
  const Wd = geo.W, Hd = geo.H; const data = new Uint8Array(Wd * Hd * 4);
  for (let i = 0; i < Wd * Hd; i++) { const b = (D.REGIONS[W.region[i]] || {}).biome; data[i * 4] = layerOf(W.tiles[i], b); data[i * 4 + 1] = W.vari ? W.vari[i] : 128; }
  if (tileTex && tileTex.image.width === Wd && tileTex.image.height === Hd) { tileTex.image.data.set(data); tileTex.needsUpdate = true; terrain.tileTex = tileTex; return; }
  if (tileTex) tileTex.dispose();
  tileTex = new THREE.DataTexture(data, Wd, Hd, THREE.RGBAFormat, THREE.UnsignedByteType);
  tileTex.minFilter = tileTex.magFilter = THREE.NearestFilter; tileTex.generateMipmaps = false; tileTex.needsUpdate = true;
  terrain.tileTex = tileTex;
}

// ---------- chunk geometry ----------
let sharedIndex = null;
function chunkIndex() {
  if (sharedIndex) return sharedIndex;
  const idx = []; const n = CH + 1;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) { const a = y * n + x, b = a + 1, c = a + n, d = c + 1; if ((x + y) & 1) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b); }
  return (sharedIndex = new THREE.BufferAttribute(new Uint16Array(idx), 1));
}
function heightGeom(field, cx, cy, flip) {
  const n = CH + 1, VW = geo.VW; const pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), snow = new Float32Array(n * n);
  const hAt = (x, y) => field[K3.clamp(y, 0, geo.VH - 1) * VW + K3.clamp(x, 0, geo.VW - 1)];
  let minY = 1e9, maxY = -1e9;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const vx = cx * CH + i, vy = cy * CH + j; const k = j * n + i;
    const x = Math.min(vx, geo.W), y = Math.min(vy, geo.H);
    const h = hAt(x, y);
    pos[k * 3] = x * TILE; pos[k * 3 + 1] = h; pos[k * 3 + 2] = y * TILE;
    const dx = (hAt(x + 1, y) - hAt(x - 1, y)) / (2 * TILE), dz = (hAt(x, y + 1) - hAt(x, y - 1)) / (2 * TILE);
    const l = Math.hypot(dx, 1, dz); nor[k * 3] = -dx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = -dz / l;
    if (flip) { nor[k * 3] *= -1; nor[k * 3 + 1] *= -1; nor[k * 3 + 2] *= -1; }
    snow[k] = geo.SNOW ? geo.SNOW[Math.min(geo.VH - 1, y) * VW + Math.min(geo.VW - 1, x)] : 0;
    minY = Math.min(minY, h); maxY = Math.max(maxY, h);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('aSnow', new THREE.BufferAttribute(snow, 1));
  g.setIndex(chunkIndex());
  g.boundingBox = new THREE.Box3(new THREE.Vector3(cx * CH * TILE, minY, cy * CH * TILE), new THREE.Vector3((cx + 1) * CH * TILE, maxY, (cy + 1) * CH * TILE));
  g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
  return g;
}

// ---------- water ----------
function makeWaterMaterial() {
  const wn = propTex('water', 512).normalMap;
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { tN: { value: null }, uOcean: { value: 0 } }]),
    vertexShader: `#include <common>
      #include <fog_pars_vertex>
      attribute float aDepth; attribute vec3 aTint; uniform float uTime;
      varying vec3 vW; varying float vDepth; varying vec3 vTint;
      void main(){ vec3 p = position; float big = smoothstep(2., 8., aDepth);
        p.y += (sin(p.x * .21 + uTime * 1.1) * .5 + sin(p.z * .17 - uTime * .9) * .5) * .12 * big;
        vW = p; vDepth = aDepth; vTint = aTint; vec4 mvPosition = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <fog_pars_fragment>
      uniform sampler2D tN; uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uHorCol;
      varying vec3 vW; varying float vDepth; varying vec3 vTint;
      void main(){
        vec2 uv1 = vW.xz / 9. + vec2(uTime * .018, uTime * .011), uv2 = vW.xz / 4.3 - vec2(uTime * .013, -uTime * .02);
        vec3 n1 = texture2D(tN, uv1).xyz * 2. - 1., n2 = texture2D(tN, uv2).xyz * 2. - 1.;
        vec3 N = normalize(vec3(n1.x + n2.x, 3.2, n1.y + n2.y));
        vec3 V = normalize(cameraPosition - vW);
        float fres = .03 + .97 * pow(1. - max(dot(N, V), 0.), 5.);
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uHorCol, uSkyCol, clamp(R.y * 1.6, 0., 1.));
        float spec = pow(max(dot(R, normalize(uSunDir)), 0.), 220.) * 6. + pow(max(dot(R, normalize(uSunDir)), 0.), 24.) * .25;
        float d = clamp(vDepth, 0., 6.);
        vec3 shallow = vTint * 1.6, deep = vTint * .35;
        vec3 body = mix(shallow, deep, smoothstep(0., 3.5, d)) * (.25 + .75 * max(uSunDir.y, .08)) * uSunCol;
        vec3 col = mix(body, sky, fres * .85) + uSunCol * spec * step(0., uSunDir.y);
        float foam = smoothstep(.28, .0, d) * (.55 + .45 * sin(uTime * 2. + vW.x * 2.1 + vW.z * 1.7 + n1.x * 3.));
        col = mix(col, vec3(.85, .9, .9) * (.3 + .7 * max(uSunDir.y, .1)), foam * .55);
        float a = clamp(.45 + smoothstep(0., 1.6, d) * .45 + fres * .3 + foam * .3, 0., .97);
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`,
  });
}
function finalizeWaterUniforms(m) { m.uniforms.tN.value = propTex('water', 512).normalMap; m.uniforms.uTime = shared.uTime; m.uniforms.uSunDir = shared.uSunDir; m.uniforms.uSunCol = shared.uSunCol; m.uniforms.uSkyCol = shared.uSkyCol; m.uniforms.uHorCol = shared.uHorCol; }

const TINTS = { swamp: [0.12, 0.15, 0.07], sewer: [0.13, 0.15, 0.08], ocean: [0.04, 0.13, 0.18], island: [0.04, 0.2, 0.22], icecave: [0.12, 0.2, 0.28], crypt: [0.06, 0.12, 0.14], cave: [0.07, 0.1, 0.1], abyss: [0.12, 0.04, 0.04], gloom: [0.06, 0.07, 0.1], ash: [0.08, 0.09, 0.09], default: [0.06, 0.14, 0.16] };
function waterGeom(cx, cy) {
  const VW = geo.VW, Wd = geo.W; const pos = [], dep = [], tint = [], idx = [];
  const WL = geo.WL, H = geo.HV;
  const wlAt = (x, y) => { x = K3.clamp(x, 0, geo.W); y = K3.clamp(y, 0, geo.H); let v = WL[y * VW + x]; if (!isNaN(v)) return v; let s = 0, n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx > geo.W || yy > geo.H) continue; const w = WL[yy * VW + xx]; if (!isNaN(w)) { s += w; n++; } } return n ? s / n : NaN; };
  const vmap = new Map();
  const vert = (x, y) => { const k = y * VW + x; let i = vmap.get(k); if (i != null) return i; const wl = wlAt(x, y); i = pos.length / 3; pos.push(x * TILE, wl, y * TILE); dep.push(wl - H[Math.min(geo.VH - 1, y) * VW + Math.min(geo.VW - 1, x)]);
    const ti = Math.min(geo.H - 1, y) * Wd + Math.min(geo.W - 1, x); const b = (D.REGIONS[W.region[ti]] || {}).biome; const tc = TINTS[b] || TINTS.default; tint.push(tc[0], tc[1], tc[2]); vmap.set(k, i); return i; };
  for (let y = cy * CH; y < Math.min(geo.H, (cy + 1) * CH); y++) for (let x = cx * CH; x < Math.min(geo.W, (cx + 1) * CH); x++) {
    // any tile that touches water gets a quad (the land hides the edges)
    let wet = false; for (let dy = -1; dy <= 1 && !wet; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= Wd || yy >= geo.H) continue; const c = geo.cls[yy * Wd + xx]; if (c === 2 || c === 3 || c === 6 || (c === 7 && (geo.cls[yy * Wd + xx] === 7))) { wet = c !== 7 || !isNaN(WL[yy * VW + xx]); if (wet) break; } }
    if (!wet) continue;
    if (isNaN(wlAt(x, y)) || isNaN(wlAt(x + 1, y)) || isNaN(wlAt(x, y + 1)) || isNaN(wlAt(x + 1, y + 1))) continue;
    const a = vert(x, y), b = vert(x + 1, y), c = vert(x, y + 1), d = vert(x + 1, y + 1);
    idx.push(a, c, b, b, c, d);
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1)); g.setAttribute('aTint', new THREE.Float32BufferAttribute(tint, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}

// ---------- lava ----------
function makeLavaMaterial() {
  return new THREE.ShaderMaterial({
    fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    vertexShader: `#include <common>
      #include <fog_pars_vertex>
      varying vec3 vW; void main(){ vW = position; vec4 mvPosition = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <fog_pars_fragment>
      uniform float uTime; varying vec3 vW;
      ${NOISE_GLSL}
      void main(){ vec2 p = vW.xz * .35 + vec2(uTime * .05, uTime * .03);
        vec4 v = vorP(p, 1000., 1.); float crack = smoothstep(.25, .0, v.y - v.x);
        float fl = gfbm(p * .5 + uTime * .04, 1000., 3);
        vec3 crust = vec3(.12, .05, .03) * (.6 + .8 * fl);
        vec3 hot = mix(vec3(1., .35, .05), vec3(1., .85, .4), fl) * (2.2 + sin(uTime * 2. + vW.x) * .4);
        gl_FragColor = vec4(mix(crust, hot, max(crack, smoothstep(.62, .8, fl))), 1.);
        #include <fog_fragment>
      }`,
  });
}
function lavaGeom(cx, cy) {
  const VW = geo.VW, Wd = geo.W; const pos = [], idx = []; const vm = new Map();
  const lvl = (x, y) => { let n = 0, s = 0; for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= Wd || yy >= geo.H) continue; n++; if (geo.cls[yy * Wd + xx] === 4) s++; } const h = geo.HV[y * VW + x]; return s === n ? h + 0.75 : h + 0.15; };
  const vert = (x, y) => { const k = y * VW + x; let i = vm.get(k); if (i != null) return i; i = pos.length / 3; pos.push(x * TILE, lvl(x, y), y * TILE); vm.set(k, i); return i; };
  for (let y = cy * CH; y < Math.min(geo.H, (cy + 1) * CH); y++) for (let x = cx * CH; x < Math.min(geo.W, (cx + 1) * CH); x++) {
    if (geo.cls[y * Wd + x] !== 4) continue; const a = vert(x, y), b = vert(x + 1, y), c = vert(x, y + 1), d = vert(x + 1, y + 1); idx.push(a, c, b, b, c, d);
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeBoundingSphere(); return g;
}

// ---------- the horizon beyond the edge of the map ----------
function horizonGeom() {
  const S = 22, ext = 70; // cells of 22 tiles... spacing in tiles, cells beyond the edge
  const Wd = geo.W, Hd = geo.H; const pos = [], nor = [], idx = []; const cells = Math.ceil(Wd / 8);
  const step = 8; const n0 = -ext, n1 = Math.ceil(Wd / step) + ext, m1 = Math.ceil(Hd / step) + ext;
  const NX = n1 - n0 + 1, NY = m1 - n0 + 1;
  const hAt = (gx, gy) => {
    const tx = gx * step, ty = gy * step;
    const cxT = K3.clamp(tx, 0, Wd), cyT = K3.clamp(ty, 0, Hd);
    const out = Math.max(cxT - tx, tx - cxT, cyT - ty, ty - cyT, 0);
    const base = geo.HV[Math.round(cyT) * geo.VW + Math.round(cxT)];
    if (out <= 0) return base - 3; // hidden under the real terrain
    const ti = Math.min(Hd - 1, Math.round(cyT)) * Wd + Math.min(Wd - 1, Math.round(cxT));
    const b = (D.REGIONS[W.region[ti]] || {}).biome;
    if (b === 'ocean' || geo.realm === 'tidesong') return -6;
    if (geo.realm === 'summit') return -40 - out * 0.5;
    const rn = fbm(tx * 0.012, ty * 0.012, 4), rr = fbm(tx * 0.04 + 9, ty * 0.04, 3);
    return base + Math.min(1, out / 40) * (30 + rn * 110 + rr * 30) * (0.6 + 0.4 * Math.min(1, out / 120));
  };
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const gx = n0 + i, gy = n0 + j; pos.push(gx * step * TILE, hAt(gx, gy), gy * step * TILE); }
  for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) { const gx = n0 + i, gy = n0 + j; if (gx >= 0 && gy >= 0 && (gx + 1) * step <= Wd && (gy + 1) * step <= Hd) continue; const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const snow = new Float32Array(pos.length / 3); for (let i = 0; i < snow.length; i++) snow[i] = geo.realm === 'summit' ? 0.4 : 0.25; g.setAttribute('aSnow', new THREE.BufferAttribute(snow, 1));
  return g;
}

// ---------- build / rebuild ----------
export function buildTerrain() {
  const t0 = performance.now();
  if (!arrays) arrays = makeTerrainArrays(K3.quality.texSize);
  buildTileTex();
  // a new material per realm so uniforms like the map size are right
  for (const m of [terrainMat, ceilMat]) if (m) m.dispose();
  terrainMat = makeTerrainMaterial(false);
  ceilMat = geo.dungeon && geo.dtype === 'cave' ? makeTerrainMaterial(true) : null;
  if (!waterMat) { waterMat = makeWaterMaterial(); finalizeWaterUniforms(waterMat); }
  if (!lavaMat) { lavaMat = makeLavaMaterial(); lavaMat.uniforms.uTime = shared.uTime; }
  clearGroup();
  const ncx = Math.ceil(geo.W / CH), ncy = Math.ceil(geo.H / CH);
  terrain.ncx = ncx; terrain.ncy = ncy; terrain.chunks = [];
  for (let cy = 0; cy < ncy; cy++) for (let cx = 0; cx < ncx; cx++) {
    const c = { cx, cy, meshes: [] };
    const g = heightGeom(geo.HV, cx, cy, false);
    const m = new THREE.Mesh(g, terrainMat); m.receiveShadow = true; m.castShadow = true; m.matrixAutoUpdate = false; m.name = 'ground';
    terrain.group.add(m); c.ground = m; c.meshes.push(m);
    if (geo.CEIL && ceilMat) { const gc = heightGeom(geo.CEIL, cx, cy, true); const mc = new THREE.Mesh(gc, ceilMat); mc.matrixAutoUpdate = false; mc.receiveShadow = true; terrain.group.add(mc); c.meshes.push(mc); }
    const wg = waterGeom(cx, cy); if (wg) { const wm = new THREE.Mesh(wg, waterMat); wm.matrixAutoUpdate = false; wm.renderOrder = 2; wm.name = 'water'; terrain.group.add(wm); c.meshes.push(wm); }
    const lg = lavaGeom(cx, cy); if (lg) { const lm = new THREE.Mesh(lg, lavaMat); lm.matrixAutoUpdate = false; terrain.group.add(lm); c.meshes.push(lm); }
    terrain.chunks.push(c);
  }
  if (geo.dungeon && geo.dtype !== 'cave') {
    // masonry halls: a flat stone ceiling
    const tx = propTex('darkstone'); const mat = new THREE.MeshStandardMaterial({ map: tx.map, normalMap: tx.normalMap, roughness: 0.9, side: THREE.BackSide, color: 0x8a8580 });
    tx.map.repeat.set(geo.W * TILE / 4, geo.H * TILE / 4); tx.normalMap.repeat.copy(tx.map.repeat);
    const pg = new THREE.PlaneGeometry(geo.W * TILE, geo.H * TILE); pg.rotateX(-Math.PI / 2); pg.translate(geo.W * TILE / 2, geo.ceilH, geo.H * TILE / 2);
    const pm = new THREE.Mesh(pg, mat); pm.name = 'ceiling'; terrain.group.add(pm);
  }
  if (!geo.dungeon) {
    const hm = new THREE.Mesh(horizonGeom(), terrainMat); hm.receiveShadow = false; hm.name = 'horizon'; terrain.group.add(hm);
    // the open sea around the edges
    const sea = new THREE.PlaneGeometry(9000, 9000, 1, 1); sea.rotateX(-Math.PI / 2); sea.translate(geo.W * TILE / 2, -0.05, geo.H * TILE / 2);
    const dep = new Float32Array(4).fill(8), tint = new Float32Array(12); for (let i = 0; i < 4; i++) tint.set(TINTS.ocean, i * 3);
    sea.setAttribute('aDepth', new THREE.BufferAttribute(dep, 1)); sea.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
    const sm = new THREE.Mesh(sea, waterMat); sm.renderOrder = 1; sm.name = 'sea';
    if (geo.realm === 'tidesong' || hasOcean()) terrain.group.add(sm);
  }
  terrain.ms = Math.round(performance.now() - t0);
}
function hasOcean() { const ri = D.REGION_BY_ID.ocean; for (let i = 0; i < W.region.length; i += 97) if (W.region[i] === ri) return true; return false; }
function clearGroup() {
  for (const o of [...terrain.group.children]) { terrain.group.remove(o); if (o.geometry) o.geometry.dispose(); }
}
// update a rectangle of tiles after the city is rebuilt
export function refreshTerrainArea(x0, y0, w, h) {
  buildTileTex();
  for (const c of terrain.chunks) {
    if ((c.cx + 1) * CH < x0 - 6 || c.cx * CH > x0 + w + 6 || (c.cy + 1) * CH < y0 - 6 || c.cy * CH > y0 + h + 6) continue;
    const old = c.ground.geometry; c.ground.geometry = heightGeom(geo.HV, c.cx, c.cy, false); old.dispose();
  }
}

// distance culling of chunks (frustum culling does the rest)
export function updateTerrain(camPos) {
  shared.uTime.value = K3.time;
  const view = K3.quality.view + 60;
  for (const c of terrain.chunks) {
    const cxm = (c.cx + 0.5) * CH * TILE, czm = (c.cy + 0.5) * CH * TILE;
    const d = Math.hypot(cxm - camPos.x, czm - camPos.z) - CH * TILE * 0.71;
    const vis = d < view;
    for (const m of c.meshes) m.visible = vis;
    c.ground.castShadow = d < 60;
  }
}

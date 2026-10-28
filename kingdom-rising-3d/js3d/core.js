// Kingdom Rising 3D — renderer, scene, camera, post-processing, quality settings and shared helpers
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
// ambient occlusion (Super Ultra only) is loaded on demand: no cost for anyone else
let GTAOPass = null, gtaoLoading = false;
function loadGTAO() { if (GTAOPass || gtaoLoading) return; gtaoLoading = true; import('three/addons/postprocessing/GTAOPass.js').then((m) => { GTAOPass = m.GTAOPass; if (K3.quality && K3.quality.ao) buildComposer(); }).catch((e) => { console.warn('GTAO', e); }); }

export { THREE };
const KR = window.KR;

// the 2D game measures everything in pixels (32 px per tile). One pixel is 5 cm here, so a tile is 1.6 m.
export const PX = 0.05;
export const TS = 32;
export const TILE = TS * PX;

export const K3 = {
  THREE, PX, TS, TILE,
  time: 0, dt: 0, frame: 0,
  quality: null,
  updaters: [], // functions called every frame (dt, t)
};
// uniforms shared by many materials (water, flags, foliage, flames...)
K3.shared = { uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) }, uSkyCol: { value: new THREE.Color(0.5, 0.65, 0.85) }, uHorCol: { value: new THREE.Color(0.75, 0.8, 0.85) }, uWind: { value: 1 } };
window.K3 = K3;

// ---------- settings ----------
const QUALITY = {
  // treeNear: full-detail trees; shadowDist: how far trees throw shadows; shadowBox: half size of the sun's shadow area;
  // shadowEvery: redraw the shadows every n frames; lights: real-time point lights (every lit pixel pays for each
  // one, so they stay few: flames still glow on their own); softShadows: the softer, dearer shadow filter;
  // bloomDiv: the glow is worked out at 1/n resolution
  low: { name: 'Low', detailFar: 90, propsFar: 70, pr: 0.75, shadows: 0, shadowSize: 1024, msaa: 0, bloom: false, grass: 0, view: 230, treeFar: 170, texSize: 256, lights: 2, grade: false, treeNear: 32, shadowDist: 0, shadowBox: 35, shadowEvery: 3, softShadows: false, bloomDiv: 4 },
  medium: { name: 'Medium', detailFar: 130, propsFar: 110, pr: 1, shadows: 1, shadowSize: 1024, msaa: 0, bloom: true, grass: 0.45, view: 330, treeFar: 240, texSize: 512, lights: 3, grade: true, treeNear: 42, shadowDist: 20, shadowBox: 34, shadowEvery: 3, softShadows: false, bloomDiv: 4 },
  high: { name: 'High', detailFar: 190, propsFar: 160, pr: 1, shadows: 1, shadowSize: 2048, msaa: 0, bloom: true, grass: 1, view: 460, treeFar: 330, texSize: 512, lights: 4, grade: true, treeNear: 55, shadowDist: 34, shadowBox: 48, shadowEvery: 2, softShadows: true, bloomDiv: 3 },
  // ultra: native resolution with 4x MSAA (drawing 1.25x the pixels on high-DPI screens cost far more than it showed)
  // super ultra: for strong graphics cards: the screen's full sharpness, 4096 soft shadows redrawn every frame, ambient
  // occlusion (GTAO), more real lights, the longest view, the densest grass and the sharpest textures
  superultra: { name: 'Super Ultra (strong graphics cards)', detailFar: 360, propsFar: 300, pr: 2, shadows: 1, shadowSize: 4096, msaa: 4, bloom: true, grass: 1.4, view: 800, treeFar: 600, texSize: 1024, lights: 10, grade: true, treeNear: 95, shadowDist: 64, shadowBox: 64, shadowEvery: 1, softShadows: true, bloomDiv: 2, ao: true, aniso: 16 },
  ultra: { name: 'Ultra', detailFar: 270, propsFar: 230, pr: 1, shadows: 1, shadowSize: 2048, msaa: 4, bloom: true, grass: 1.15, view: 600, treeFar: 460, texSize: 1024, lights: 6, grade: true, treeNear: 70, shadowDist: 46, shadowBox: 52, shadowEvery: 2, softShadows: true, bloomDiv: 3 },
};
K3.QUALITY = QUALITY;
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
K3.lsGet = lsGet; K3.lsSet = lsSet;
// the graphics chip's name, if the browser tells us (laptops with built-in graphics start on a lighter preset)
function gpuName() {
  try { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return ''; const ext = gl.getExtension('WEBGL_debug_renderer_info'); const n = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); return String(n || ''); } catch (e) { return ''; }
}
K3.gpu = gpuName();
// built-in (integrated) graphics: Intel, AMD's APU graphics, Apple's, phone chips and software renderers
K3.weakGpu = /Intel|UHD|Iris|HD Graphics|Mesa|llvmpipe|SwiftShader|Radeon\(TM\) Graphics|Radeon Graphics|Vega \d|Apple GPU|Apple M\d|Adreno|Mali|PowerVR|Microsoft Basic/i.test(K3.gpu) && !/RTX|GTX|Radeon RX|Arc A\d/i.test(K3.gpu);
// built-in graphics: Ultra keeps everything but draws 2x instead of 4x multisampling (the samples are what such a chip
// pays for most, in memory bandwidth, while 2x already smooths the edges)
if (K3.weakGpu) QUALITY.ultra.msaa = 2;
function autoQuality() {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  if (mobile) return 'low';
  if (K3.weakGpu || cores <= 4) return 'medium';
  return 'high';
}
K3.settings = Object.assign({ quality: autoQuality(), fov: 72, sens: 1, sensY: 1, invertY: false, fpArms: true, headBob: true, shake: true,
  turnSpeed: 1.9, moveSpeed: 'brisk', walkMode: false, renderScale: 1, dynRes: true, targetFps: 60, fpsCap: 0, showFps: false, exposure: 1, gfx: {} }, lsGet('kr3d_settings', {}));
K3.saveSettings = () => lsSet('kr3d_settings', K3.settings);
// settings version 2: a quicker run by default (the old 'realistic' jog felt sluggish)
if ((K3.settings.v || 1) < 2) { K3.settings.v = 2; if (K3.settings.moveSpeed === 'realistic') K3.settings.moveSpeed = 'brisk'; K3.saveSettings(); }
// a preset plus whatever the player changed by hand (Settings → Graphics)
function composeQuality() {
  const q = Object.assign({}, QUALITY[K3.settings.quality] || QUALITY.high, K3.settings.gfx || {});
  if (q.aa === 'msaa') q.msaa = K3.weakGpu ? 2 : 4; else if (q.aa === 'fxaa' || q.aa === 'off') q.msaa = 0;
  q.treeFar = Math.round(q.view * 0.72);
  K3.quality = q;
}
composeQuality();

// ---------- renderer ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = K3.settings.exposure || 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;
renderer.info.autoReset = true;
K3.renderer = renderer;
K3.shaderErrors = [];
renderer.debug.onShaderError = function (gl, program, vs, fs) {
  const log = (sh) => { const l = gl.getShaderInfoLog(sh) || ''; if (!l.trim()) return ''; const src = gl.getShaderSource(sh).split('\n'); const m = /ERROR: 0:(\d+)/.exec(l); const ln = m ? +m[1] : 0; return l + '\n' + src.slice(Math.max(0, ln - 4), ln + 2).map((x, i) => (ln - 3 + i) + ': ' + x).join('\n'); };
  const msg = 'Shader error: ' + log(vs) + log(fs) + (gl.getProgramInfoLog(program) || '');
  K3.shaderErrors.push(msg); console.error(msg.slice(0, 3000));
};
K3.maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8aa4c0);
scene.fog = new THREE.FogExp2(0x9fb2c6, 0.0035);
K3.scene = scene;

const camera = new THREE.PerspectiveCamera(K3.settings.fov, innerWidth / innerHeight, 0.06, 2400);
camera.position.set(0, 10, 0);
camera.rotation.order = 'YXZ';
K3.camera = camera;
scene.add(camera);

// ---------- post-processing ----------
let composer = null, bloom = null, fxaa = null, grade = null, renderPass = null;
const GradeShader = {
  // a livelier grade: a touch more colour and contrast, cool shadows and warm highlights, a lighter vignette
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.18 }, uSat: { value: 1.1 }, uCon: { value: 1.06 }, uTint: { value: new THREE.Vector3(1.025, 1.0, 0.965) }, uHurt: { value: 0 }, uTime: { value: 0 }, uFade: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uSat, uCon, uHurt, uTime, uFade; uniform vec3 uTint; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      // lift the shadows a little (dark corners stay readable) before the colour work
      col = col + (1.0 - col) * 0.035 + col * (1.0 - smoothstep(0.0, 0.35, dot(col, vec3(0.299,0.587,0.114)))) * 0.22;
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(vec3(l), col, uSat);
      col = mix(col, col * vec3(0.96, 0.99, 1.05), (1.0 - smoothstep(0.0, 0.45, l)) * 0.55);
      col = mix(col, col * vec3(1.04, 1.01, 0.95), smoothstep(0.55, 1.0, l) * 0.55);
      col = (col - 0.5) * uCon + 0.5;
      col = max(col, 0.0);
      col *= uTint;
      vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.2, length(d * vec2(1.0, 0.9)));
      col *= mix(1.0 - uVig, 1.0, v);
      // damage pulse at the screen edges
      col = mix(col, vec3(0.55, 0.02, 0.0), uHurt * (1.0 - v) * 0.7);
      col += (h(vUv * 917.0 + uTime) - 0.5) * 0.012;
      col *= 1.0 - uFade;
      gl_FragColor = vec4(col, c.a);
    }`,
};
// the grade as a function of a colour, appended to FXAA's shader for the combined pass
const GradeFxaaShader = (() => {
  const body = GradeShader.fragmentShader;
  const fn = body.slice(body.indexOf('float h(vec2 p)'), body.indexOf('void main(){'))
    + 'vec4 krGrade(vec4 c){ vec3 col = c.rgb;' + body.slice(body.indexOf('float l = dot(col'), body.indexOf('gl_FragColor')) + 'return vec4(col, c.a); }\n';
  const uni = 'uniform float uVig, uSat, uCon, uHurt, uTime, uFade; uniform vec3 uTint;\n';
  let fs = FXAAShader.fragmentShader; const at = fs.lastIndexOf('void main()');
  fs = fs.slice(0, at) + uni + fn + fs.slice(at);
  fs = fs.replace('gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );', 'gl_FragColor = krGrade( ApplyFXAA( tDiffuse, resolution.xy, vUv ) );');
  const uniforms = Object.assign({}, THREE.UniformsUtils.clone(FXAAShader.uniforms), THREE.UniformsUtils.clone(GradeShader.uniforms));
  return { name: 'GradeFxaaShader', uniforms, vertexShader: FXAAShader.vertexShader, fragmentShader: fs };
})();
function buildComposer() {
  const q = K3.quality;
  if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.msaa || 0 });
  composer = new EffectComposer(renderer, rt);
  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  bloom = null; fxaa = null; grade = null;
  // ambient occlusion: soft contact shadows where walls meet floors, in corners and under eaves
  if (q.ao) { if (GTAOPass) { try { const ao = new GTAOPass(scene, camera, size.x, size.y); ao.output = GTAOPass.OUTPUT.Default; ao.blendIntensity = 0.85; ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 }); ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 }); composer.addPass(ao); K3.ao = ao; } catch (e) { console.warn('GTAO', e); K3.ao = null; } } else loadGTAO(); } else K3.ao = null;
  // the softer shadow filter costs several extra lookups per pixel: only High and Ultra use it
  const st = q.softShadows === false ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap; if (renderer.shadowMap.type !== st) renderer.shadowMap.type = st;
  const bd = q.bloomDiv || 2; if (q.bloom) { bloom = new UnrealBloomPass(new THREE.Vector2(Math.ceil(size.x / bd), Math.ceil(size.y / bd)), 0.32, 0.55, 0.86); composer.addPass(bloom); } // glow worked out at half resolution: same look, a quarter of the cost
  composer.addPass(new OutputPass());
  const wantFxaa = !q.msaa && q.aa !== 'off';
  // grade and FXAA together are one full-screen pass (smooth the edges, then grade), not two
  if (q.grade && wantFxaa) { grade = fxaa = new ShaderPass(GradeFxaaShader); fxaa.material.uniforms.resolution.value.set(1 / size.x, 1 / size.y); composer.addPass(grade); }
  else {
    if (q.grade) { grade = new ShaderPass(GradeShader); composer.addPass(grade); }
    if (wantFxaa) { fxaa = new ShaderPass(FXAAShader); fxaa.material.uniforms.resolution.value.set(1 / size.x, 1 / size.y); composer.addPass(fxaa); }
  }
  K3.composer = composer; K3.bloom = bloom; K3.grade = grade;
}
K3.post = { get bloom() { return bloom; }, get grade() { return grade; } };

function resize() {
  const q = K3.quality;
  // render resolution: the preset's cap, the player's render scale, and the automatic scale that keeps the frame rate up
  const pr = Math.max(0.35, Math.min(window.devicePixelRatio || 1, q.pr) * (K3.settings.renderScale || 1) * K3.dynScale);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  buildComposer();
  const hud = document.getElementById('hud3d');
  if (hud) { const d = Math.min(2, window.devicePixelRatio || 1); hud.width = Math.floor(innerWidth * d); hud.height = Math.floor(innerHeight * d); hud.style.width = innerWidth + 'px'; hud.style.height = innerHeight + 'px'; K3.hudDpr = d; }
  for (const f of K3.onResize) try { f(); } catch (e) { console.error(e); }
}
K3.onResize = [];
// a resolution change from the automatic scaler: resize the existing buffers rather than building the whole
// post-processing chain again (that rebuild compiled shaders and stalled a frame every time)
function rescale() {
  const q = K3.quality;
  const pr = Math.max(0.35, Math.min(window.devicePixelRatio || 1, q.pr) * (K3.settings.renderScale || 1) * K3.dynScale);
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
  if (!composer) return buildComposer();
  composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  if (fxaa) fxaa.material.uniforms.resolution.value.set(1 / size.x, 1 / size.y);
  if (bloom) { const bd = K3.quality.bloomDiv || 2; bloom.setSize(Math.ceil(size.x / bd), Math.ceil(size.y / bd)); }
}
addEventListener('resize', resize);
K3.resize = resize;
K3.dynScale = 1;
K3.setQuality = function (id) {
  if (!QUALITY[id]) return;
  K3.settings.quality = id; K3.settings.gfx = {}; K3.saveSettings(); composeQuality(); K3.dynScale = 1;
  resize();
  for (const f of K3.onQuality) try { f(); } catch (e) { console.error(e); }
};
// change one graphics option by hand
K3.setGfx = function (key, val) {
  K3.settings.gfx = Object.assign({}, K3.settings.gfx, { [key]: val }); K3.saveSettings(); composeQuality();
  resize();
  for (const f of K3.onQuality) try { f(); } catch (e) { console.error(e); }
};
K3.onQuality = [];

// ---------- frame rate: counter and automatic resolution ----------
// Every two seconds, if the game runs below the target, draw fewer pixels (down to 55%); when it has
// kept up for a while, try a little more. A failed try waits longer before the next one.
const perf = { n: 0, t: 0, fps: 0, good: 0, bad: 0, slow: 0, wait: 0, tried: false, el: null };
K3.perf = perf;
// the three slowest parts of a frame over the last window, from main3d.js's per-section timer (K3.prof), as
// average milliseconds per frame: "· actors 9.1 · render 7.4 · game 5.2 ms". Read as differences, so the timer
// itself is never reset (tests read it too).
let profLast = null, profLastN = 0;
const SECTIONS = ['input', 'game', 'worldTick', 'sync', 'camera', 'world', 'actors', 'sky', 'terrain', 'grass', 'viewmodel', 'updaters', 'render', 'hud', 'ui', 'net'];
function slowest() {
  const P = K3.prof; if (!P || !P.acc) return '';
  const frames = P.n - profLastN; const prev = profLast || {}; profLast = Object.assign({}, P.acc); profLastN = P.n;
  if (frames <= 0) return '';
  // only the frame's own sections (main3d.js): sub-timers and counters such as nAv, the number of people drawn, are
  // not milliseconds and must not be listed as if they were
  const rows = []; for (const k of SECTIONS) if (P.acc[k] != null) rows.push([k, (P.acc[k] - (prev[k] || 0)) / frames]);
  rows.sort((a, b) => b[1] - a[1]);
  const nAv = P.acc.nAv != null ? Math.round((P.acc.nAv - (prev.nAv || 0)) / frames) : null;
  const fi = K3.frameInfo;
  return (rows.length ? ' · ' + rows.slice(0, 3).map(([k, v]) => k + ' ' + v.toFixed(1)).join(' · ') + ' ms' : '') + (nAv != null ? ' · ' + nAv + ' people' : '') + (fi && fi.calls ? ' · ' + fi.calls + ' draws' : '');
}
K3.frameTick = function (dt) {
  perf.n++; perf.t += dt; perf.wait -= dt;
  if (perf.t < 2) return;
  perf.fps = perf.n / perf.t; perf.n = 0; perf.t = 0;
  if (K3.settings.showFps) { if (!perf.el) { perf.el = document.createElement('div'); perf.el.className = 'k3-fps'; document.body.appendChild(perf.el); } perf.el.hidden = false; perf.el.textContent = Math.round(perf.fps) + ' fps' + (K3.dynScale < 1 ? ' · ' + Math.round(K3.dynScale * 100) + '% res' : '') + slowest(); }
  else if (perf.el) perf.el.hidden = true;
  if (!K3.settings.dynRes) { if (K3.dynScale !== 1) { K3.dynScale = 1; rescale(); } return; }
  const target = Math.min(K3.settings.targetFps || 60, K3.settings.fpsCap || 999);
  // every change rebuilds the render buffers (a hitch), so change only when it is clearly needed: two slow
  // readings in a row to go down, a longer good run to go back up
  // High and Ultra are chosen for their sharpness: the scaler only takes them down to 75% and only below ~40 fps
  // (at 60 target), never just because the game runs at 45-55
  const floor = K3.settings.quality === 'superultra' || K3.settings.quality === 'ultra' || K3.settings.quality === 'high' ? 0.75 : 0.55;
  const low = floor > 0.6 ? 0.68 : 0.86;
  if (perf.fps < target * low && K3.dynScale > floor) {
    perf.good = 0;
    if (++perf.bad >= 2 || perf.fps < target * 0.5) { perf.bad = 0; K3.dynScale = Math.max(floor, K3.dynScale - (perf.fps < target * 0.5 ? 0.12 : 0.06)); if (perf.tried) { perf.wait = 40; perf.tried = false; } rescale(); }
  } else if (perf.fps >= target * 0.95 && K3.dynScale < 1 && perf.wait <= 0) {
    perf.bad = 0;
    if (++perf.good >= 4) { K3.dynScale = Math.min(1, K3.dynScale + 0.05); perf.good = 0; perf.tried = true; perf.wait = 10; rescale(); }
  } else { perf.good = 0; perf.bad = 0; }
  // still well below the target at the lowest automatic resolution for ~10 seconds while playing: the pixels are
  // not the problem, so step down one graphics preset (once per step, never back up by itself) and say so
  const ORDER = ['low', 'medium', 'high', 'ultra', 'superultra'];
  if (K3.dynScale <= floor + 0.01 && perf.fps < Math.min(target * 0.6, 30) && KR.Main && KR.Main.isRunning && KR.Main.isRunning()) {
    if (++perf.slow >= 5) { perf.slow = 0; const i = ORDER.indexOf(K3.settings.quality);
      if (i > 0) { const to = ORDER[i - 1]; K3.setQuality(to); K3.dynScale = 0.8; rescale(); if (KR.UI && KR.UI.toast) KR.UI.toast('Graphics lowered to ' + QUALITY[to].name, 'For a smoother game. You can change it in Settings (Esc) → Graphics.'); } }
  } else perf.slow = 0;
};

// the first-person arms are drawn in their own scene on top of the world
K3.vmScene = new THREE.Scene();
K3.vmCamera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 10);
K3.onResize.push(() => { K3.vmCamera.aspect = innerWidth / innerHeight; K3.vmCamera.updateProjectionMatrix(); });

// shadows are redrawn every few frames (or at once when asked, e.g. after a teleport)
renderer.shadowMap.autoUpdate = false;
K3.shadowNow = () => { renderer.shadowMap.needsUpdate = true; };
// is the shadow map redrawn this frame? The sun's shadow area only moves on those frames: moving it between
// redraws projected an old map from a new place, and shadows jittered as you walked
K3.shadowDue = () => renderer.shadowMap.needsUpdate || K3.frame % (K3.quality.shadowEvery || 1) === 0;
// whole-frame totals (every pass and the shadow map), for the FPS readout and tests: K3.frameInfo
renderer.info.autoReset = false; K3.frameInfo = { calls: 0, tris: 0, shadow: 0 };
K3.render = function () {
  if (grade) { grade.uniforms.uTime.value = K3.time % 100; }
  if (K3.frame % (K3.quality.shadowEvery || 1) === 0) renderer.shadowMap.needsUpdate = true;
  const sh = renderer.shadowMap.needsUpdate; renderer.info.reset();
  composer.render();
  const fi = K3.frameInfo; fi.calls = renderer.info.render.calls; fi.tris = renderer.info.render.triangles; fi.shadow = sh ? 1 : 0;
  if (K3.vmVisible) {
    renderer.autoClear = false; renderer.clearDepth();
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.render(K3.vmScene, K3.vmCamera);
    renderer.autoClear = true;
  }
};

// ---------- helpers ----------
const _c = new THREE.Color();
K3.col = function (hex, out) { const c = out || new THREE.Color(); if (hex && hex.isColor) return c.copy(hex); if (typeof hex === 'number') return c.setHex(hex); if (!hex) return c.setRGB(0.5, 0.5, 0.5); if (hex.startsWith('rgb')) { const m = hex.match(/[\d.]+/g); return c.setRGB(m[0] / 255, m[1] / 255, m[2] / 255, THREE.SRGBColorSpace); } return c.set(hex); };
K3.shade = function (hex, amt) { const c = K3.col(hex, new THREE.Color()); if (amt >= 0) c.lerp(_c.setRGB(1, 1, 1), amt); else c.multiplyScalar(1 + amt); return c; };
K3.toX = (px) => px * PX;
K3.toZ = (py) => py * PX;
K3.hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
K3.rng = function (seed) { let a = seed | 0; return function () { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
K3.smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
K3.lerp = (a, b, t) => a + (b - a) * t;
K3.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
K3.dampAngle = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

resize();

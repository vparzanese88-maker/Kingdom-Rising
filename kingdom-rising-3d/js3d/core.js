// Kingdom Rising 3D — renderer, scene, camera, post-processing, quality settings and shared helpers
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

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
  low: { name: 'Low', pr: 0.75, shadows: 0, shadowSize: 1024, msaa: 0, bloom: false, grass: 0, view: 230, treeFar: 170, texSize: 256, lights: 4, grade: false },
  medium: { name: 'Medium', pr: 1, shadows: 1, shadowSize: 1024, msaa: 0, bloom: true, grass: 0.45, view: 330, treeFar: 240, texSize: 512, lights: 6, grade: true },
  high: { name: 'High', pr: 1.5, shadows: 1, shadowSize: 2048, msaa: 4, bloom: true, grass: 1, view: 460, treeFar: 330, texSize: 512, lights: 8, grade: true },
  ultra: { name: 'Ultra', pr: 2, shadows: 1, shadowSize: 4096, msaa: 4, bloom: true, grass: 1.6, view: 640, treeFar: 460, texSize: 1024, lights: 10, grade: true },
};
K3.QUALITY = QUALITY;
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
K3.lsGet = lsGet; K3.lsSet = lsSet;
function autoQuality() {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  if (mobile) return 'low';
  if (cores <= 4) return 'medium';
  return 'high';
}
K3.settings = Object.assign({ quality: autoQuality(), fov: 72, sens: 1, sensY: 1, invertY: false, fpArms: true, headBob: true, shake: true,
  turnSpeed: 1.9, moveSpeed: 'realistic', walkMode: false, renderScale: 1, dynRes: true, targetFps: 60, fpsCap: 0, showFps: false, exposure: 1, gfx: {} }, lsGet('kr3d_settings', {}));
K3.saveSettings = () => lsSet('kr3d_settings', K3.settings);
// a preset plus whatever the player changed by hand (Settings → Graphics)
function composeQuality() {
  const q = Object.assign({}, QUALITY[K3.settings.quality] || QUALITY.high, K3.settings.gfx || {});
  if (q.aa === 'msaa') q.msaa = 4; else if (q.aa === 'fxaa' || q.aa === 'off') q.msaa = 0;
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
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 }, uSat: { value: 0.9 }, uCon: { value: 1.06 }, uTint: { value: new THREE.Vector3(1.0, 0.99, 0.97) }, uHurt: { value: 0 }, uTime: { value: 0 }, uFade: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uSat, uCon, uHurt, uTime, uFade; uniform vec3 uTint; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uCon + 0.5;
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
function buildComposer() {
  const q = K3.quality;
  if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.msaa || 0 });
  composer = new EffectComposer(renderer, rt);
  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  bloom = null; fxaa = null; grade = null;
  if (q.bloom) { bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.55, 0.86); composer.addPass(bloom); }
  composer.addPass(new OutputPass());
  if (q.grade) { grade = new ShaderPass(GradeShader); composer.addPass(grade); }
  if (!q.msaa && q.aa !== 'off') { fxaa = new ShaderPass(FXAAShader); fxaa.material.uniforms.resolution.value.set(1 / size.x, 1 / size.y); composer.addPass(fxaa); }
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
const perf = { n: 0, t: 0, fps: 0, good: 0, wait: 0, tried: false, el: null };
K3.perf = perf;
K3.frameTick = function (dt) {
  perf.n++; perf.t += dt; perf.wait -= dt;
  if (perf.t < 2) return;
  perf.fps = perf.n / perf.t; perf.n = 0; perf.t = 0;
  if (K3.settings.showFps) { if (!perf.el) { perf.el = document.createElement('div'); perf.el.className = 'k3-fps'; document.body.appendChild(perf.el); } perf.el.hidden = false; perf.el.textContent = Math.round(perf.fps) + ' fps' + (K3.dynScale < 1 ? ' · ' + Math.round(K3.dynScale * 100) + '% res' : ''); }
  else if (perf.el) perf.el.hidden = true;
  if (!K3.settings.dynRes) { if (K3.dynScale !== 1) { K3.dynScale = 1; resize(); } return; }
  const target = Math.min(K3.settings.targetFps || 60, K3.settings.fpsCap || 999);
  if (perf.fps < target * 0.86 && K3.dynScale > 0.55) {
    K3.dynScale = Math.max(0.55, K3.dynScale - (perf.fps < target * 0.6 ? 0.15 : 0.08)); perf.good = 0;
    if (perf.tried) { perf.wait = 30; perf.tried = false; }
    resize();
  } else if (perf.fps >= target * 0.95 && K3.dynScale < 1 && perf.wait <= 0) {
    if (++perf.good >= 3) { K3.dynScale = Math.min(1, K3.dynScale + 0.05); perf.good = 0; perf.tried = true; perf.wait = 6; resize(); }
  } else perf.good = 0;
};

// the first-person arms are drawn in their own scene on top of the world
K3.vmScene = new THREE.Scene();
K3.vmCamera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 10);
K3.onResize.push(() => { K3.vmCamera.aspect = innerWidth / innerHeight; K3.vmCamera.updateProjectionMatrix(); });

K3.render = function () {
  if (grade) { grade.uniforms.uTime.value = K3.time % 100; }
  composer.render();
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

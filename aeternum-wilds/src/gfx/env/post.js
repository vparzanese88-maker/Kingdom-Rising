// Aeternum Wilds — post-processing: a half-float scene buffer (multisampled on Ultra), optional ground-contact
// ambient occlusion (GTAO, Ultra), a soft bloom worked out at reduced resolution, filmic tone mapping (OutputPass),
// then one pass that smooths edges (FXAA) and grades the colour: a touch more saturation and contrast, cool shadows,
// warm highlights and a light vignette. After Kingdom Rising 3D's core.js.
import * as THREE from 'three';
import { EffectComposer } from '../../../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../../../vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../../vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../../vendor/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from '../../../vendor/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from './vendor/FXAAShader.js';
import { ENV } from './shared.js';

export const POST = { composer: null, bloom: null, grade: null, ao: null };

const GRADE = `uniform float uVig, uSat, uCon, uHurt, uTime, uWarm; uniform vec3 uTint;
float gh(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
vec4 awGrade(vec4 c, vec2 uv){ vec3 col = c.rgb;
  float l = dot(col, vec3(0.299,0.587,0.114));
  col = col + (1.0 - col) * 0.02 + col * (1.0 - smoothstep(0.0, 0.3, l)) * 0.12; l = dot(col, vec3(0.299,0.587,0.114));
  col = mix(vec3(l), col, uSat);
  col = mix(col, col * vec3(0.96, 0.99, 1.05), (1.0 - smoothstep(0.0, 0.45, l)) * 0.5);
  col = mix(col, col * vec3(1.0 + uWarm, 1.0 + uWarm * 0.35, 1.0 - uWarm), smoothstep(0.5, 1.0, l) * 0.6);
  col = (col - 0.5) * uCon + 0.5;
  col = max(col, 0.0) * uTint;
  vec2 d = uv - 0.5; float v = smoothstep(0.85, 0.2, length(d * vec2(1.0, 0.9)));
  col *= mix(1.0 - uVig, 1.0, v);
  col = mix(col, vec3(0.55, 0.02, 0.0), uHurt * (1.0 - v) * 0.7);
  col += (gh(uv * 917.0 + uTime) - 0.5) * 0.008;
  return vec4(col, c.a); }
`;
const GRADE_UNIFORMS = () => ({ uVig: { value: 0.16 }, uSat: { value: 1.12 }, uCon: { value: 1.05 }, uWarm: { value: 0.035 }, uTint: { value: new THREE.Vector3(1.0, 1.0, 1.0) }, uHurt: { value: 0 }, uTime: { value: 0 } });
const GradeShader = {
  uniforms: Object.assign({ tDiffuse: { value: null } }, GRADE_UNIFORMS()),
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;\n${GRADE}\nvoid main(){ gl_FragColor = awGrade(texture2D(tDiffuse, vUv), vUv); }`,
};
// FXAA and the grade in one full-screen pass
const GradeFxaaShader = (() => {
  let fs = FXAAShader.fragmentShader; const at = fs.lastIndexOf('void main()');
  fs = fs.slice(0, at) + GRADE + fs.slice(at);
  fs = fs.replace('gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );', 'gl_FragColor = awGrade( ApplyFXAA( tDiffuse, resolution.xy, vUv ), vUv );');
  return { name: 'GradeFxaaShader', uniforms: Object.assign(THREE.UniformsUtils.clone(FXAAShader.uniforms), GRADE_UNIFORMS()), vertexShader: FXAAShader.vertexShader, fragmentShader: fs };
})();

let GTAOPass = null, gtaoLoading = false;
function loadGTAO() {
  if (GTAOPass || gtaoLoading) return; gtaoLoading = true;
  import('./vendor/GTAOPass.js').then((m) => { GTAOPass = m.GTAOPass; buildComposer(); }).catch((e) => console.warn('GTAO unavailable', e));
}

export function buildComposer() {
  const Q = ENV.Q, renderer = ENV.renderer;
  if (POST.composer) { POST.composer.renderTarget1.dispose(); POST.composer.renderTarget2.dispose(); }
  POST.composer = POST.bloom = POST.grade = POST.ao = null;
  if (Q.post === false) return null;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: Q.msaa || 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(ENV.scene, ENV.camera));
  if (Q.ao) {
    if (GTAOPass) {
      try {
        const ao = new GTAOPass(ENV.scene, ENV.camera, size.x, size.y); ao.output = GTAOPass.OUTPUT.Default; ao.blendIntensity = 0.75;
        ao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
        ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
        composer.addPass(ao); POST.ao = ao;
      } catch (e) { console.warn('GTAO', e); }
    } else loadGTAO();
  }
  if (Q.bloom) {
    const bd = Q.bloomDiv || 3;
    const b = new UnrealBloomPass(new THREE.Vector2(Math.ceil(size.x / bd), Math.ceil(size.y / bd)), 0.22, 0.5, 0.92);
    composer.addPass(b); POST.bloom = b;
  }
  composer.addPass(new OutputPass());
  const fxaa = !Q.msaa;
  const g = new ShaderPass(fxaa ? GradeFxaaShader : GradeShader);
  if (fxaa) g.material.uniforms.resolution.value.set(1 / size.x, 1 / size.y);
  composer.addPass(g); POST.grade = g; POST.fxaa = fxaa;
  POST.composer = composer;
  return composer;
}
export function resizeComposer() {
  if (!POST.composer) return;
  const size = ENV.renderer.getDrawingBufferSize(new THREE.Vector2());
  POST.composer.setPixelRatio(ENV.renderer.getPixelRatio()); POST.composer.setSize(innerWidth, innerHeight);
  if (POST.fxaa) POST.grade.material.uniforms.resolution.value.set(1 / size.x, 1 / size.y);
  if (POST.bloom) { const bd = ENV.Q.bloomDiv || 3; POST.bloom.setSize(Math.ceil(size.x / bd), Math.ceil(size.y / bd)); }
  if (POST.ao) POST.ao.setSize(size.x, size.y);
}
// night: a little more glow round the fires; zone grading
export function updatePost(t, darkness, zone) {
  if (POST.grade) { const u = POST.grade.material.uniforms; u.uTime.value = t % 100; u.uSat.value = 1.12 - darkness * 0.12 - (zone.mire || 0) * 0.05; u.uWarm.value = 0.035 + (zone.ruins || 0) * 0.04 - darkness * 0.03; }
  if (POST.bloom) { POST.bloom.strength = 0.18 + darkness * 0.14; POST.bloom.threshold = 0.92 - darkness * 0.12; }
}
export function renderFrame() {
  if (POST.composer) POST.composer.render(); else ENV.renderer.render(ENV.scene, ENV.camera);
}

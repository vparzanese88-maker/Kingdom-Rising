// Kingdom Rising 3D — every texture in the game is painted on the GPU at load time from noise.
// Terrain layers go into one array texture (albedo+height, normal+roughness); props get plain textures.
import { THREE, K3 } from './core.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// ---------- shared GLSL: periodic noise so every texture tiles seamlessly ----------
export const NOISE_GLSL = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoiseP(vec2 p, float P){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  float a = hash12(mod(i, P)), b = hash12(mod(i + vec2(1., 0.), P)), c = hash12(mod(i + vec2(0., 1.), P)), d = hash12(mod(i + vec2(1., 1.), P));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }
vec2 gradP(vec2 i, float P){ float h = hash12(mod(i, P)) * 6.2831853; return vec2(cos(h), sin(h)); }
float gnoiseP(vec2 p, float P){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  float a = dot(gradP(i, P), f), b = dot(gradP(i + vec2(1., 0.), P), f - vec2(1., 0.)), c = dot(gradP(i + vec2(0., 1.), P), f - vec2(0., 1.)), d = dot(gradP(i + vec2(1., 1.), P), f - vec2(1., 1.));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.4; }
float fbm(vec2 uv, float P, int oct){ float s = 0., a = .5, n = 0.; float per = P; vec2 p = uv * P;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * vnoiseP(p, per); n += a; p *= 2.; per *= 2.; a *= .5; } return s / n; }
float gfbm(vec2 uv, float P, int oct){ float s = 0., a = .5, n = 0.; float per = P; vec2 p = uv * P;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * gnoiseP(p, per); n += a; p *= 2.; per *= 2.; a *= .5; } return s / n * .5 + .5; }
float ridged(vec2 uv, float P, int oct){ float s = 0., a = .5, n = 0.; float per = P; vec2 p = uv * P;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * (1. - abs(gnoiseP(p, per))); n += a; p *= 2.; per *= 2.; a *= .5; } return s / n; }
// cellular noise: x = F1, y = F2, z = cell id, w = unused
vec4 vorP(vec2 p, float P, float jit){ vec2 i = floor(p), f = fract(p); float F1 = 8., F2 = 8., id = 0.; vec2 cc = vec2(0.);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 c = mod(i + g, P); vec2 o = .5 + (hash22(c) - .5) * jit; vec2 r = g + o - f; float d = dot(r, r);
    if (d < F1) { F2 = F1; F1 = d; id = hash12(c + 3.7); cc = r; } else if (d < F2) { F2 = d; } }
  return vec4(sqrt(F1), sqrt(F2), id, 0.); }
// distance to the nearest cell border (better than F2-F1 for mortar lines)
vec3 vorEdge(vec2 p, float P, float jit){ vec2 i = floor(p), f = fract(p); vec2 mr = vec2(0.), mg = vec2(0.); float md = 8., id = 0.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 c = mod(i + g, P); vec2 o = .5 + (hash22(c) - .5) * jit; vec2 r = g + o - f; float d = dot(r, r); if (d < md) { md = d; mr = r; mg = g; id = hash12(c + 3.7); } }
  md = 8.;
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) { vec2 g = mg + vec2(float(x), float(y)); vec2 c = mod(i + g, P); vec2 o = .5 + (hash22(c) - .5) * jit; vec2 r = g + o - f; if (dot(mr - r, mr - r) > .00001) md = min(md, dot(.5 * (mr + r), normalize(r - mr))); }
  return vec3(md, id, length(mr)); }
float sat(float x){ return clamp(x, 0., 1.); }
vec3 lin(vec3 c){ return pow(max(c, vec3(0.)), vec3(2.2)); }
`;

// ---------- material library ----------
// each material: void name(vec2 uv, out vec3 col, out float h, out float r)  (col in sRGB-ish, converted later)
const MATS_GLSL = `
void m_grass(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 3., 5), n2 = fbm(uv + .37, 9., 4), sp = vnoiseP(uv * 160., 160.), sp2 = vnoiseP(uv * 70. + 3., 70.);
  vec3 a = vec3(.25, .36, .12), b = vec3(.37, .47, .17), dry = vec3(.52, .5, .26), soil = vec3(.28, .22, .14);
  c = mix(a, b, n); c = mix(c, dry, smoothstep(.62, .8, n2) * .55);
  c *= .78 + .44 * sp; c = mix(c, c * vec3(1.1, 1.15, .8), sp2 * .3);
  float hole = smoothstep(.7, .84, fbm(uv + 5.1, 14., 3)); c = mix(c, soil, hole * .6);
  h = sp * .6 + n * .25 - hole * .3 + .2; r = .92; }
void m_darkgrass(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 3., 5), sp = vnoiseP(uv * 150., 150.), moss = fbm(uv + 2., 12., 4);
  c = mix(vec3(.16, .25, .1), vec3(.25, .33, .13), n); c = mix(c, vec3(.2, .3, .09), smoothstep(.5, .75, moss));
  c *= .75 + .5 * sp; h = sp * .5 + n * .3 + .1; r = .93; }
void m_forest(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 4., 5); vec4 lv = vorP(uv * 22., 22., .9); vec4 lv2 = vorP(uv * 34. + .5, 34., .9);
  vec3 soil = mix(vec3(.17, .12, .08), vec3(.24, .17, .1), n);
  vec3 moss = vec3(.2, .29, .1) * (.8 + .4 * vnoiseP(uv * 90., 90.));
  float mm = smoothstep(.45, .7, fbm(uv + 1.3, 6., 4)); c = mix(soil, moss, mm);
  float leaf = smoothstep(.42, .25, lv.x) * step(.45, lv.z); vec3 lc = mix(vec3(.45, .25, .08), vec3(.55, .4, .12), lv.z); c = mix(c, lc * (.7 + .3 * lv.x), leaf * (1. - mm * .6));
  float leaf2 = smoothstep(.38, .2, lv2.x) * step(.6, lv2.z); c = mix(c, vec3(.3, .18, .07), leaf2 * .8);
  float twig = smoothstep(.04, 0., abs(gnoiseP(uv * 18., 18.))) * step(.6, vnoiseP(uv * 9., 9.)); c = mix(c, vec3(.2, .13, .07), twig * .7);
  h = .3 + leaf * .35 + leaf2 * .25 + mm * .2 + twig * .2; r = .9; }
void m_road(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 4., 5), n2 = fbm(uv + .7, 16., 4); vec4 pb = vorP(uv * 26., 26., 1.);
  c = mix(vec3(.4, .31, .21), vec3(.5, .4, .28), n); c *= .85 + .3 * n2;
  float peb = smoothstep(.3, .18, pb.x) * step(.55, pb.z); c = mix(c, mix(vec3(.45, .43, .4), vec3(.6, .57, .52), pb.z), peb);
  float rut = smoothstep(.55, .75, fbm(uv + 3.3, 5., 3)); c *= 1. - rut * .15;
  h = .35 + n2 * .25 + peb * .4 - rut * .2; r = .95; }
void m_cobble(vec2 uv, out vec3 c, out float h, out float r){
  vec3 e = vorEdge(uv * 9., 9., .85); float n = fbm(uv, 8., 4), fn = vnoiseP(uv * 120., 120.);
  vec3 st = mix(vec3(.42, .41, .38), vec3(.6, .57, .52), e.y); st = mix(st, st * vec3(1.05, .95, .85), step(.7, fract(e.y * 7.3)) * .5);
  st *= .85 + .2 * fn; float mort = smoothstep(.06, .015, e.x); vec3 mc = mix(vec3(.2, .17, .13), vec3(.25, .28, .14), n);
  c = mix(st, mc, mort); h = sat(smoothstep(0., .22, e.x) * .85 + fn * .1 - (1. - smoothstep(0., .3, e.x)) * .2) ; r = mix(.78, .95, mort); }
void m_riverbed(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 4., 5); vec4 pb = vorP(uv * 14., 14., 1.);
  c = mix(vec3(.42, .38, .28), vec3(.3, .32, .24), n); float peb = smoothstep(.42, .3, pb.x); c = mix(c, mix(vec3(.38, .37, .34), vec3(.5, .48, .42), pb.z), peb);
  c = mix(c, vec3(.2, .3, .15), smoothstep(.6, .8, fbm(uv + 2., 8., 3)) * .5); h = .3 + peb * .5 * (1. - pb.x); r = .6; }
void m_sand(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 4., 5), g = vnoiseP(uv * 200., 200.); float rip = sin(6.2831853 * (uv.y * 10. + fbm(uv, 3., 3) * 1.5 + uv.x * 2.)) * .5 + .5;
  c = mix(vec3(.78, .68, .48), vec3(.88, .79, .58), n); c *= .92 + .14 * g; c *= .94 + .08 * rip;
  h = rip * .5 + g * .15 + n * .2; r = .96; }
void m_rock(vec2 uv, out vec3 c, out float h, out float r){
  float rd = ridged(uv, 4., 6), n = fbm(uv, 6., 5); vec3 e = vorEdge(uv * 9., 9., 1.);
  float strata = sin(6.2831853 * (uv.y * 6. + n * .8)) * .5 + .5;
  c = mix(vec3(.36, .35, .33), vec3(.54, .52, .48), rd); c = mix(c, c * vec3(1.08, .98, .86), strata * .35);
  float crack = smoothstep(.035, 0., e.x) * step(.45, vnoiseP(uv * 7., 7.)); c *= 1. - crack * .35; c *= .85 + .3 * vnoiseP(uv * 64., 64.);
  float lich = smoothstep(.72, .8, fbm(uv + 4.4, 10., 4)); c = mix(c, vec3(.5, .52, .32), lich * .6);
  h = rd * .7 + n * .2 - crack * .35 + .1; r = .85; }
void m_snow(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 3., 5), n2 = fbm(uv + 1.7, 12., 4), g = vnoiseP(uv * 180., 180.);
  c = mix(vec3(.8, .85, .93), vec3(.97, .98, 1.), n); c = mix(c, vec3(.75, .8, .9), (1. - n2) * .3); c += (g - .5) * .03;
  h = n * .6 + n2 * .3; r = .75; }
void m_mud(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 4., 5), n2 = fbm(uv + .3, 14., 4); float pud = smoothstep(.62, .7, fbm(uv + 7., 5., 4));
  c = mix(vec3(.2, .16, .11), vec3(.3, .24, .16), n) * (.85 + .3 * n2); c = mix(c, vec3(.14, .12, .09), pud);
  h = .5 + n2 * .3 - pud * .4; r = mix(.85, .2, pud); }
void m_ash(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 4., 5), n2 = vnoiseP(uv * 110., 110.); vec4 ch = vorP(uv * 30., 30., 1.);
  c = mix(vec3(.3, .29, .28), vec3(.44, .43, .41), n) * (.85 + .25 * n2); float bit = smoothstep(.25, .1, ch.x) * step(.7, ch.z); c = mix(c, vec3(.08, .07, .07), bit);
  h = n * .5 + n2 * .2 + bit * .3; r = .97; }
void m_dirt(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 4., 5), n2 = fbm(uv + .5, 18., 4); c = mix(vec3(.33, .24, .16), vec3(.43, .32, .21), n) * (.85 + .3 * n2); h = n * .4 + n2 * .4; r = .95; }
void m_gravel(vec2 uv, out vec3 c, out float h, out float r){
  vec3 e = vorEdge(uv * 28., 28., 1.); float n = fbm(uv, 6., 4);
  vec3 st = mix(vec3(.4, .38, .35), vec3(.62, .6, .56), e.y) * (.9 + .2 * n); float gap = smoothstep(.08, .02, e.x);
  c = mix(st, vec3(.22, .19, .16), gap); h = smoothstep(0., .3, e.x) * .8 + .1; r = .9; }
void m_farm(vec2 uv, out vec3 c, out float h, out float r){
  float fur = sin(6.2831853 * uv.x * 6. + fbm(uv, 4., 3) * .6) * .5 + .5; float n = fbm(uv, 6., 5), cl = vnoiseP(uv * 60., 60.);
  c = mix(vec3(.26, .18, .11), vec3(.4, .29, .18), fur) * (.85 + .3 * n);
  float sprout = smoothstep(.75, .9, fur) * smoothstep(.55, .75, vnoiseP(uv * vec2(6., 40.), 40.)); c = mix(c, vec3(.3, .45, .15), sprout);
  h = fur * .7 + cl * .15; r = .95; }
void m_flagstone(vec2 uv, out vec3 c, out float h, out float r){
  vec2 p = uv * vec2(3., 4.); float row = floor(p.y); p.x += hash12(vec2(row, 1.)) * .9 + row * .37; vec2 cell = floor(p); vec2 f = fract(p);
  float id = hash12(mod(cell, vec2(3., 4.)) + 5.); float ed = min(min(f.x, 1. - f.x) * 1.33, min(f.y, 1. - f.y));
  float n = fbm(uv, 8., 5), fn = vnoiseP(uv * 140., 140.);
  vec3 st = mix(vec3(.46, .44, .4), vec3(.62, .59, .54), id) * (.85 + .25 * n); st *= .9 + .15 * fn;
  vec3 e = vorEdge(uv * 6., 6., 1.); st *= 1. - smoothstep(.02, 0., e.x) * .35 * step(.5, id);
  float mort = smoothstep(.035, .01, ed); c = mix(st, vec3(.22, .2, .17), mort);
  h = smoothstep(0., .08, ed) * .8 + n * .15 + fn * .05; r = mix(.75, .95, mort); }
void m_lava(vec2 uv, out vec3 c, out float h, out float r){
  vec3 e = vorEdge(uv * 6., 6., 1.); float n = fbm(uv, 8., 5);
  float crack = smoothstep(.12, 0., e.x + (n - .5) * .08);
  c = mix(vec3(.09, .06, .05) * (.8 + .4 * n), mix(vec3(1., .42, .06), vec3(1., .8, .3), crack), crack);
  h = 1. - crack; r = mix(.9, .4, crack); }
void m_gloom(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 4., 5), n2 = vnoiseP(uv * 120., 120.), moss = smoothstep(.62, .78, fbm(uv + 2.2, 10., 4));
  c = mix(vec3(.17, .15, .2), vec3(.26, .23, .29), n) * (.85 + .3 * n2); c = mix(c, vec3(.18, .26, .3), moss * .7);
  h = n * .5 + n2 * .2 + moss * .2; r = .93; }
void m_plains(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 3., 5), n2 = fbm(uv + .9, 10., 4), sp = vnoiseP(uv * 170., 170.);
  c = mix(vec3(.5, .47, .22), vec3(.62, .57, .3), n); c = mix(c, vec3(.4, .45, .2), smoothstep(.55, .8, n2) * .6); c *= .8 + .4 * sp;
  h = sp * .6 + n * .2 + .1; r = .94; }
void m_volcanic(vec2 uv, out vec3 c, out float h, out float r){
  float rd = ridged(uv, 5., 5), n = fbm(uv, 6., 4); vec3 e = vorEdge(uv * 7., 7., 1.);
  c = mix(vec3(.08, .075, .07), vec3(.2, .17, .15), rd); c = mix(c, vec3(.32, .15, .09), smoothstep(.6, .8, n) * .5);
  c *= 1. - smoothstep(.04, 0., e.x) * .5; h = rd * .8 + n * .2; r = .8; }
void m_cave(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 4., 5), rd = ridged(uv + .3, 6., 4); vec4 pb = vorP(uv * 16., 16., 1.);
  c = mix(vec3(.25, .21, .17), vec3(.37, .32, .26), n) * (.85 + .3 * rd); float peb = smoothstep(.35, .22, pb.x) * step(.5, pb.z); c = mix(c, vec3(.42, .4, .36), peb);
  h = rd * .5 + peb * .4 + n * .1; r = .9; }
void m_ice(vec2 uv, out vec3 c, out float h, out float r){
  vec3 e = vorEdge(uv * 4., 4., 1.); float n = fbm(uv, 5., 5); float cr = smoothstep(.03, 0., e.x);
  c = mix(vec3(.62, .78, .88), vec3(.82, .91, .97), n); c = mix(c, vec3(.95, .98, 1.), cr * .8); h = .5 + n * .3 - cr * .2; r = .12 + cr * .4; }
void m_scar(vec2 uv, out vec3 c, out float h, out float r){
  vec3 e = vorEdge(uv * 7., 7., .9); float n = fbm(uv, 6., 5); float cr = smoothstep(.06, .0, e.x);
  c = mix(vec3(.22, .12, .1), vec3(.34, .19, .14), n * (.6 + .4 * e.y)); c = mix(c, vec3(.06, .03, .03), cr); h = smoothstep(0., .15, e.x) * .8 + n * .2; r = .9; }
// ----- props -----
void m_stonebrick(vec2 uv, out vec3 c, out float h, out float r){
  vec2 p = uv * vec2(4., 8.); float row = floor(p.y); p.x += mod(row, 2.) * .5 + hash12(vec2(row, 7.)) * .2; vec2 cell = floor(p); vec2 f = fract(p);
  float id = hash12(mod(cell, vec2(4., 8.)) + 11.); float ed = min(min(f.x, 1. - f.x) * 2., min(f.y, 1. - f.y));
  float n = fbm(uv, 8., 5), fn = vnoiseP(uv * 160., 160.);
  vec3 st = mix(vec3(.47, .45, .41), vec3(.66, .63, .57), id); st = mix(st, st * vec3(1.05, .97, .86), step(.75, fract(id * 9.1)) * .6);
  st *= .82 + .3 * n; st *= .92 + .12 * fn; st *= .85 + .15 * smoothstep(0., .5, f.y);
  float mort = smoothstep(.07, .02, ed); vec3 mc = mix(vec3(.3, .28, .25), vec3(.25, .32, .17), smoothstep(.65, .8, fbm(uv + 3., 6., 3)));
  c = mix(st, mc, mort); h = smoothstep(0., .14, ed) * .75 + n * .2 + fn * .05; r = mix(.82, .95, mort); }
void m_darkstone(vec2 uv, out vec3 c, out float h, out float r){ m_stonebrick(uv, c, h, r); c = c * vec3(.55, .52, .52); }
void m_plaster(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 5., 6), n2 = fbm(uv + 1.1, 2., 3), fn = vnoiseP(uv * 150., 150.); vec3 e = vorEdge(uv * 3., 3., 1.);
  c = mix(vec3(.78, .73, .62), vec3(.9, .86, .76), n) * (.93 + .1 * fn); c = mix(c, vec3(.62, .56, .46), smoothstep(.6, .85, n2) * .5);
  float crk = smoothstep(.012, 0., e.x) * step(.6, fbm(uv + 9., 4., 2)); c *= 1. - crk * .4; h = n * .5 + fn * .1 - crk * .3 + .3; r = .93; }
void m_timber(vec2 uv, out vec3 c, out float h, out float r){
  float w = fbm(vec2(uv.x * 1., uv.y * .05), 16., 4); float gr = sin(6.2831853 * (uv.x * 18. + w * 4.)) * .5 + .5; float n = fbm(uv, 8., 4);
  c = mix(vec3(.2, .13, .08), vec3(.33, .22, .13), gr * .6 + n * .4); float knot = smoothstep(.15, .05, vorP(uv * vec2(4., 2.), 4., 1.).x) * .5; c *= 1. - knot * .5;
  h = gr * .4 + n * .3 + .2; r = .85; }
void m_planks(vec2 uv, out vec3 c, out float h, out float r){
  vec2 p = uv * vec2(1., 6.); float row = floor(p.y); float off = hash12(vec2(row, 2.)); vec2 f = fract(p);
  float seg = floor(uv.x * 2. + off * 2.); float id = hash12(vec2(row, seg) + 1.3);
  float gr = sin(6.2831853 * (f.y * 3. + fbm(vec2(uv.x * 2., uv.y * 6.), 8., 3) * 2. + id * 5.)) * .5 + .5; float n = fbm(uv + id, 8., 4);
  c = mix(vec3(.36, .24, .14), vec3(.5, .35, .21), id * .6 + gr * .4) * (.85 + .25 * n);
  float gap = smoothstep(.06, .02, min(f.y, 1. - f.y)); float jx = fract(uv.x * 2. + off * 2.); gap = max(gap, smoothstep(.012, .004, min(jx, 1. - jx)));
  c = mix(c, vec3(.1, .07, .04), gap); float nail = smoothstep(.012, .006, length(vec2((jx - .03) * 1., (f.y - .5) / 6.))); c = mix(c, vec3(.15, .15, .16), nail);
  h = (1. - gap) * (.6 + gr * .2 + n * .2); r = .82; }
void m_rooftile(vec2 uv, out vec3 c, out float h, out float r){
  vec2 p = uv * vec2(8., 8.); float row = floor(p.y); p.x += mod(row, 2.) * .5; vec2 f = fract(p); vec2 cell = floor(p);
  float id = hash12(mod(cell, 8.) + 4.); float curve = sin(f.x * 3.14159); float edge = 1. - f.y + (1. - curve) * .35;
  float n = fbm(uv, 8., 4); vec3 base = mix(vec3(.5, .2, .13), vec3(.65, .3, .18), id) * (.8 + .3 * n);
  base = mix(base, vec3(.3, .32, .2), smoothstep(.7, .85, fbm(uv + 2., 4., 3)) * .5);
  float shadow = smoothstep(.0, .25, f.y); c = base * (.55 + .45 * shadow) * (.85 + .15 * curve);
  h = sat(f.y * .8 + curve * .25); r = .7; }
void m_slate(vec2 uv, out vec3 c, out float h, out float r){
  vec2 p = uv * vec2(6., 10.); float row = floor(p.y); p.x += mod(row, 2.) * .5 + hash12(vec2(row, 3.)) * .3; vec2 f = fract(p); vec2 cell = floor(p);
  float id = hash12(mod(cell, vec2(6., 10.)) + 8.); float n = fbm(uv, 8., 4);
  vec3 base = mix(vec3(.24, .26, .29), vec3(.36, .38, .42), id) * (.85 + .3 * n); float gap = smoothstep(.05, .015, min(f.x, 1. - f.x) * .6);
  c = base * (.6 + .4 * smoothstep(0., .2, f.y)); c = mix(c, vec3(.1, .1, .11), gap); h = f.y * .7 + n * .2; r = .6; }
void m_shingle(vec2 uv, out vec3 c, out float h, out float r){
  vec2 p = uv * vec2(10., 10.); float row = floor(p.y); p.x += mod(row, 2.) * .5; vec2 f = fract(p); vec2 cell = floor(p);
  float id = hash12(mod(cell, 10.) + 6.); float n = fbm(uv, 8., 4); float tip = 1. - smoothstep(.25, .5, abs(f.x - .5)) * smoothstep(.7, 1., 1. - f.y);
  vec3 base = mix(vec3(.2, .38, .25), vec3(.3, .5, .32), id) * (.8 + .35 * n); base = mix(base, vec3(.35, .45, .2), smoothstep(.7, .85, fbm(uv + 1.5, 5., 3)) * .5);
  c = base * (.55 + .45 * smoothstep(0., .3, f.y)); float gap = smoothstep(.06, .02, min(f.x, 1. - f.x)); c *= 1. - gap * .5; h = f.y * .7 + n * .2; r = .75; }
void m_bark(vec2 uv, out vec3 c, out float h, out float r){
  float rd = ridged(vec2(uv.x, uv.y * .25), 8., 5); float n = fbm(uv, 8., 4);
  c = mix(vec3(.16, .11, .07), vec3(.36, .28, .2), rd) * (.85 + .3 * n); c = mix(c, vec3(.27, .32, .16), smoothstep(.65, .8, fbm(uv + 3., 4., 3)) * .5);
  h = rd; r = .92; }
void m_birch(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 6., 5); float mark = smoothstep(.66, .74, vnoiseP(vec2(uv.x * 24., uv.y * 90.), 90.)) * step(.55, vnoiseP(uv * vec2(20., 12.), 12.)) * .8 + smoothstep(.8, .9, fbm(uv + 3., 6., 3)) * .5;
  c = mix(vec3(.78, .76, .7), vec3(.9, .88, .83), n); c = mix(c, vec3(.16, .14, .12), mark); h = .6 - mark * .4 + n * .2; r = .8; }
void m_pinebark(vec2 uv, out vec3 c, out float h, out float r){
  vec3 e = vorEdge(uv * vec2(6., 3.), 6., 1.); float n = fbm(uv, 8., 4);
  c = mix(vec3(.3, .16, .09), vec3(.48, .28, .16), e.y) * (.8 + .3 * n); float gap = smoothstep(.08, .02, e.x); c = mix(c, vec3(.1, .06, .04), gap); h = (1. - gap) * .8; r = .9; }
void m_metal(vec2 uv, out vec3 c, out float h, out float r){
  float br = vnoiseP(vec2(uv.x * 400., uv.y * 4.), 4.); float n = fbm(uv, 6., 4); float sc = smoothstep(.97, 1., vnoiseP(uv * 90., 90.));
  c = vec3(.62, .63, .65) * (.9 + .15 * br) * (.9 + .15 * n); c *= 1. - sc * .3; h = .5 + br * .05; r = .35 + n * .2; }
void m_cloth(vec2 uv, out vec3 c, out float h, out float r){
  float wx = sin(uv.x * 6.2831853 * 120.) * .5 + .5, wy = sin(uv.y * 6.2831853 * 120.) * .5 + .5; float n = fbm(uv, 8., 4);
  float weave = mix(wx, wy, step(.5, fract(uv.x * 60.) + fract(uv.y * 60.) - .5)); c = vec3(.85) * (.85 + .15 * weave) * (.9 + .15 * n); h = weave * .5 + .25; r = .97; }
void m_leather(vec2 uv, out vec3 c, out float h, out float r){
  vec3 e = vorEdge(uv * 40., 40., 1.); float n = fbm(uv, 6., 5); c = vec3(.8) * (.85 + .25 * n) * (.9 + .1 * smoothstep(0., .3, e.x)); h = smoothstep(0., .25, e.x) * .5 + n * .3; r = .7; }
void m_marble(vec2 uv, out vec3 c, out float h, out float r){
  float v = abs(sin(6.2831853 * (uv.x * 2. + uv.y + gfbm(uv, 4., 6) * 2.5))); c = mix(vec3(.75, .73, .7), vec3(.93, .92, .9), smoothstep(0., .4, v)); c *= .95 + .08 * fbm(uv, 16., 3); h = .5; r = .3; }
void m_water(vec2 uv, out vec3 c, out float h, out float r){ h = gfbm(uv, 6., 5) * .7 + gfbm(uv + .5, 14., 3) * .3; c = vec3(.5); r = .05; }
void m_fur(vec2 uv, out vec3 c, out float h, out float r){
  float s = vnoiseP(vec2(uv.x * 160., uv.y * 12.), 12.); float n = fbm(uv, 6., 4); c = vec3(.85) * (.7 + .4 * s) * (.85 + .25 * n); h = s; r = .95; }
`;

// material ids, in order of the switch below
export const TERRAIN_LAYERS = ['grass', 'darkgrass', 'forest', 'road', 'cobble', 'riverbed', 'sand', 'rock', 'snow', 'mud', 'ash', 'dirt', 'gravel', 'farm', 'flagstone', 'lava', 'gloom', 'plains', 'volcanic', 'cave', 'ice', 'scar'];
export const PROP_MATS = ['stonebrick', 'darkstone', 'plaster', 'timber', 'planks', 'rooftile', 'slate', 'shingle', 'bark', 'birch', 'pinebark', 'metal', 'cloth', 'leather', 'marble', 'fur', 'water'];
const ALL = [...TERRAIN_LAYERS, ...PROP_MATS];

const GEN_FRAG = `
precision highp float;
uniform int uMode; uniform float uTexel;
varying vec2 vUv;
${NOISE_GLSL}
${MATS_GLSL}
void evalMat(vec2 uv, out vec3 c, out float h, out float r){ c = vec3(1., 0., 1.); h = .5; r = .9; uv = fract(uv); MAT_FN(uv, c, h, r); }
void main(){
  vec3 c; float h; float r;
  evalMat(vUv, c, h, r);
  if (uMode == 0) { gl_FragColor = vec4(lin(c), sat(h)); return; }
  // normal from the height field (finite differences) + roughness
  vec3 c2; float hx, hy, r2;
  evalMat(vUv + vec2(uTexel, 0.), c2, hx, r2);
  evalMat(vUv + vec2(0., uTexel), c2, hy, r2);
  float s = 2.2;
  vec3 n = normalize(vec3((h - hx) * s, (h - hy) * s, uTexel * 90.));
  gl_FragColor = vec4(n * .5 + .5, r);
}`;
const GEN_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';

const genMats = {}; let quad = null;
function gen(name) {
  if (!genMats[name]) genMats[name] = new THREE.ShaderMaterial({ vertexShader: GEN_VERT, fragmentShader: GEN_FRAG, defines: { MAT_FN: 'm_' + name }, uniforms: { uMode: { value: 0 }, uTexel: { value: 1 / 512 } }, depthTest: false, depthWrite: false });
  if (!quad) quad = new FullScreenQuad(genMats[name]);
  quad.material = genMats[name];
  return genMats[name];
}
function texParams(t, aniso) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = aniso; }

// terrain: two array textures, one layer per terrain material
export function makeTerrainArrays(size) {
  const r = K3.renderer; const n = TERRAIN_LAYERS.length;
  const mk = (srgb) => { const rt = new THREE.WebGLArrayRenderTarget(size, size, n, { depthBuffer: false }); texParams(rt.texture, Math.min(8, K3.maxAniso)); if (srgb) rt.texture.colorSpace = THREE.SRGBColorSpace; return rt; };
  const alb = mk(true), nrm = mk(false);
  const prev = r.getRenderTarget();
  for (let i = 0; i < n; i++) {
    const m = gen(TERRAIN_LAYERS[i]); m.uniforms.uTexel.value = 1 / size;
    m.uniforms.uMode.value = 0; r.setRenderTarget(alb, i); quad.render(r);
    m.uniforms.uMode.value = 1; r.setRenderTarget(nrm, i); quad.render(r);
  }
  r.setRenderTarget(prev);
  return { albedo: alb.texture, normal: nrm.texture, layers: TERRAIN_LAYERS };
}

// props: a plain texture pair per material, cached
const propCache = {};
export function propTex(name, size) {
  size = size || K3.quality.texSize;
  const key = name + size; if (propCache[key]) return propCache[key];
  const i = ALL.indexOf(name); if (i < 0) throw new Error('unknown material ' + name);
  const r = K3.renderer; const m = gen(name);
  const mk = (srgb) => { const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false }); texParams(rt.texture, Math.min(8, K3.maxAniso)); if (srgb) rt.texture.colorSpace = THREE.SRGBColorSpace; return rt; };
  const a = mk(true), b = mk(false);
  m.uniforms.uTexel.value = 1 / size;
  const prev = r.getRenderTarget();
  m.uniforms.uMode.value = 0; r.setRenderTarget(a); quad.render(r);
  m.uniforms.uMode.value = 1; r.setRenderTarget(b); quad.render(r);
  r.setRenderTarget(prev);
  return (propCache[key] = { map: a.texture, normalMap: b.texture });
}

// ---------- canvas-painted cards with alpha: leaves, needles, grass, flames ----------
const cardCache = {};
function canvasTex(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, K3.maxAniso); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
K3.canvasTex = canvasTex;
const rnd = (s) => K3.rng(s);
export function cardTex(kind) {
  if (cardCache[kind]) return cardCache[kind];
  let t;
  const S = 256;
  const leafPal = { oak: ['#2f5a2a', '#3e7334', '#5a9446', '#46803a'], elmwood: ['#2f6a3a', '#43914a', '#86c46a', '#5aa850'], darkoak: ['#1f3524', '#2a4630', '#3a5a3a', '#25402a'], birch: ['#5f8f2f', '#7aaa3a', '#a8cc5a', '#8ab846'], willow: ['#3a5a2a', '#4a6a34', '#6a8a44', '#58783a'], palm: ['#2f7a3a', '#3a8a40', '#4f9a48', '#2a6a30'], bramble: ['#3a4a22', '#4a5a2a', '#5e6e34', '#40502a'] };
  if (leafPal[kind]) {
    const pal = leafPal[kind]; const R = rnd(kind.length * 977);
    t = canvasTex(S, S, (g) => {
      g.clearRect(0, 0, S, S);
      const n = kind === 'willow' ? 160 : kind === 'birch' ? 220 : 190;
      for (let i = 0; i < n; i++) {
        const a = R() * 6.283, rr = Math.sqrt(R()) * S * 0.44; const x = S / 2 + Math.cos(a) * rr, y = S / 2 + Math.sin(a) * rr * (kind === 'willow' ? 1.1 : 0.9);
        const L = kind === 'willow' ? 26 + R() * 18 : kind === 'birch' ? 10 + R() * 6 : 14 + R() * 10; const W2 = kind === 'willow' ? 3 + R() * 2 : L * 0.42;
        g.save(); g.translate(x, y); g.rotate(kind === 'willow' ? Math.PI / 2 + (R() - 0.5) * 0.5 : R() * 6.283);
        const c = pal[Math.floor(R() * pal.length)]; const dk = 0.75 + R() * 0.35;
        g.fillStyle = c; g.globalAlpha = 1; g.filter = `brightness(${dk})`;
        g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, -W2, L / 2, 0); g.quadraticCurveTo(0, W2, -L / 2, 0); g.fill();
        g.filter = 'none'; g.strokeStyle = 'rgba(20,30,10,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke();
        g.restore();
      }
      if (kind === 'elmwood') for (let i = 0; i < 18; i++) { g.fillStyle = '#f6f0a0'; g.beginPath(); g.arc(S / 2 + (R() - 0.5) * S * 0.7, S / 2 + (R() - 0.5) * S * 0.7, 3, 0, 6.283); g.fill(); }
      if (kind === 'bramble') for (let i = 0; i < 20; i++) { g.fillStyle = '#8a2a3a'; g.beginPath(); g.arc(S / 2 + (R() - 0.5) * S * 0.7, S / 2 + (R() - 0.5) * S * 0.7, 3.5, 0, 6.283); g.fill(); }
    });
  } else if (kind === 'pine' || kind === 'snowpine') {
    const R = rnd(kind === 'pine' ? 51 : 52);
    t = canvasTex(S, S, (g) => {
      g.clearRect(0, 0, S, S);
      // a fan of needle twigs seen from above: drawn as a drooping branch card
      for (let b = 0; b < 16; b++) {
        const x0 = S / 2 + (R() - 0.5) * 30, y0 = 10 + b * 13; const len = S * (0.18 + (b / 16) * 0.3);
        for (const s of [-1, 1]) {
          g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + s * len, y0 + len * 0.35); g.stroke();
          for (let k = 0; k < 30; k++) {
            const u = k / 30; const px = x0 + s * len * u, py = y0 + len * 0.35 * u;
            g.strokeStyle = ['#1e3d26', '#24482c', '#2f5e38', '#2a5232'][Math.floor(R() * 4)]; g.lineWidth = 1.6;
            for (const d of [-1, 1]) { g.beginPath(); g.moveTo(px, py); g.lineTo(px + s * 5 + d * 2, py + d * 9 + 4); g.stroke(); }
          }
        }
      }
      if (kind === 'snowpine') { g.globalCompositeOperation = 'source-atop'; for (let i = 0; i < 140; i++) { g.fillStyle = 'rgba(240,246,250,0.9)'; g.beginPath(); g.ellipse(R() * S, R() * S, 6 + R() * 8, 3 + R() * 3, 0, 0, 6.283); g.fill(); } g.globalCompositeOperation = 'source-over'; }
    });
  } else if (kind === 'grass' || kind === 'drygrass' || kind === 'darkgrass' || kind === 'flowers' || kind === 'reeds' || kind === 'fern' || kind === 'snowgrass' || kind === 'ashgrass' || kind === 'crop') {
    const R = rnd(kind.length * 31 + 7);
    const pal = { grass: ['#3e6a24', '#4f7f2c', '#5e8f34', '#6f9a3a'], drygrass: ['#8a8238', '#9a9046', '#7a7a34', '#a89a4e'], darkgrass: ['#2a4220', '#355228', '#3e5e2c', '#2e4a24'], flowers: ['#3e6a24', '#4f7f2c', '#5e8f34', '#6f9a3a'], reeds: ['#5a6a2a', '#6a7a3a', '#7a8a44', '#4a5a24'], fern: ['#2f6a2a', '#3f7a34', '#4f8a3a', '#356e2e'], snowgrass: ['#7a8a6a', '#8a9a7a', '#a8b4a0', '#c8d0c8'], ashgrass: ['#4a4840', '#5a5850', '#3a3832', '#6a665a'], crop: ['#6a8a2a', '#7a9a34', '#c8a848', '#d8b850'] }[kind];
    t = canvasTex(S, S, (g) => {
      g.clearRect(0, 0, S, S);
      if (kind === 'fern') {
        for (let f = 0; f < 7; f++) {
          const a = -Math.PI / 2 + (f - 3) * 0.32; const L = S * (0.6 + R() * 0.3);
          const ex = S / 2 + Math.cos(a) * L * 0.8, ey = S + Math.sin(a) * L;
          g.strokeStyle = pal[0]; g.lineWidth = 3; g.beginPath(); g.moveTo(S / 2, S); g.quadraticCurveTo(S / 2 + Math.cos(a) * L * 0.5, S + Math.sin(a) * L * 0.75, ex, ey); g.stroke();
          for (let k = 1; k < 18; k++) { const u = k / 18; const px = S / 2 + (ex - S / 2) * u, py = S + (ey - S) * u - Math.sin(u * 3.14) * 10; const w = (1 - u) * 22 + 4; g.fillStyle = pal[1 + (k % 3)]; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(px + s * w * 0.5, py, w * 0.5, 3, s * 0.4, 0, 6.283); g.fill(); } }
        }
      } else {
        const n = kind === 'reeds' ? 26 : kind === 'crop' ? 30 : kind === 'grass' ? 110 : 60;
        for (let i = 0; i < n; i++) {
          const x = S * (0.08 + R() * 0.84), hgt = S * (kind === 'reeds' ? 0.75 + R() * 0.25 : 0.45 + R() * 0.55); const bend = (R() - 0.5) * S * 0.25; const w = kind === 'reeds' ? 4 : kind === 'grass' ? 1.2 + R() * 1.6 : 2.5 + R() * 2.5;
          const grd = g.createLinearGradient(0, S, 0, S - hgt); const c = pal[Math.floor(R() * pal.length)];
          grd.addColorStop(0, kind === 'grass' ? '#2a3a18' : '#1a2a10'); grd.addColorStop(0.35, c); grd.addColorStop(1, kind === 'snowgrass' ? '#e8eef0' : c);
          g.fillStyle = grd; g.beginPath(); g.moveTo(x - w, S); g.quadraticCurveTo(x - w * 0.3 + bend * 0.5, S - hgt * 0.6, x + bend, S - hgt); g.quadraticCurveTo(x + w * 0.3 + bend * 0.5, S - hgt * 0.6, x + w, S); g.fill();
          if (kind === 'reeds' && R() < 0.5) { g.fillStyle = '#5a3a20'; g.beginPath(); g.ellipse(x + bend, S - hgt + 10, 4, 12, 0, 0, 6.283); g.fill(); }
          if (kind === 'crop' && R() < 0.6) { g.fillStyle = pal[2 + Math.floor(R() * 2)]; g.beginPath(); g.ellipse(x + bend, S - hgt + 8, 5, 13, bend * 0.004, 0, 6.283); g.fill(); }
        }
        if (kind === 'flowers') for (let i = 0; i < 14; i++) { const fc = ['#f2d34a', '#e86a8a', '#ffffff', '#9a7ae0', '#f0904a'][Math.floor(R() * 5)]; const x = S * (0.1 + R() * 0.8), y = S * (0.25 + R() * 0.45); g.fillStyle = fc; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + Math.cos(k * 1.256) * 5, y + Math.sin(k * 1.256) * 5, 4, 2.6, k * 1.256, 0, 6.283); g.fill(); } g.fillStyle = '#f8e060'; g.beginPath(); g.arc(x, y, 2.5, 0, 6.283); g.fill(); }
      }
    });
  } else if (kind === 'flame') {
    t = canvasTex(64, 128, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h * 0.72, 2, w / 2, h * 0.6, h * 0.55);
      grd.addColorStop(0, 'rgba(255,250,220,1)'); grd.addColorStop(0.25, 'rgba(255,200,80,0.95)'); grd.addColorStop(0.55, 'rgba(255,110,20,0.6)'); grd.addColorStop(1, 'rgba(120,20,0,0)');
      g.fillStyle = grd; g.beginPath(); g.moveTo(w / 2, 2); g.bezierCurveTo(w * 0.95, h * 0.45, w * 0.95, h * 0.95, w / 2, h - 2); g.bezierCurveTo(w * 0.05, h * 0.95, w * 0.05, h * 0.45, w / 2, 2); g.fill();
    });
  } else if (kind === 'glow' || kind === 'smoke' || kind === 'spark') {
    t = canvasTex(64, 64, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      if (kind === 'smoke') { grd.addColorStop(0, 'rgba(255,255,255,0.55)'); grd.addColorStop(0.6, 'rgba(255,255,255,0.22)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); }
      else if (kind === 'spark') { grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,255,255,0.8)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); }
      else { grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); }
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    });
  } else if (kind === 'ring') {
    t = canvasTex(128, 128, (g, w) => { g.strokeStyle = '#fff'; g.lineWidth = 7; g.shadowColor = '#fff'; g.shadowBlur = 10; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 12, 0, 6.283); g.stroke(); });
  } else if (kind === 'runes') {
    t = canvasTex(256, 256, (g, w) => {
      g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 6;
      g.lineWidth = 4; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 10, 0, 6.283); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 34, 0, 6.283); g.stroke();
      g.font = 'bold 22px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; const gl = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ';
      for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; g.save(); g.translate(w / 2 + Math.cos(a) * (w / 2 - 22), w / 2 + Math.sin(a) * (w / 2 - 22)); g.rotate(a + Math.PI / 2); g.fillText(gl[k], 0, 0); g.restore(); }
      g.beginPath(); for (let k = 0; k <= 6; k++) { const a = (k * 2 * 6.283) / 6 * 1; const x = w / 2 + Math.cos(a) * (w / 2 - 36), y = w / 2 + Math.sin(a) * (w / 2 - 36); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    });
  } else if (kind === 'clouds') {
    t = null;
  }
  return (cardCache[kind] = t);
}

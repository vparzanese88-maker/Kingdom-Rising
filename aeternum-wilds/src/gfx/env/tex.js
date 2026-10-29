// Aeternum Wilds — every environment texture is painted on the GPU at load time from noise (ported from
// Kingdom Rising 3D's texgen.js). Terrain layers go into array textures (albedo+height, normal+roughness);
// props get plain texture pairs; leaves, grass and flames are painted on canvases with alpha.
import * as THREE from 'three';
import { FullScreenQuad } from '../../../vendor/jsm/postprocessing/Pass.js';
import { ENV, rng } from './shared.js';

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
vec4 vorP(vec2 p, float P, float jit){ vec2 i = floor(p), f = fract(p); float F1 = 8., F2 = 8., id = 0.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 c = mod(i + g, P); vec2 o = .5 + (hash22(c) - .5) * jit; vec2 r = g + o - f; float d = dot(r, r);
    if (d < F1) { F2 = F1; F1 = d; id = hash12(c + 3.7); } else if (d < F2) { F2 = d; } }
  return vec4(sqrt(F1), sqrt(F2), id, 0.); }
vec3 vorEdge(vec2 p, float P, float jit){ vec2 i = floor(p), f = fract(p); vec2 mr = vec2(0.), mg = vec2(0.); float md = 8., id = 0.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 c = mod(i + g, P); vec2 o = .5 + (hash22(c) - .5) * jit; vec2 r = g + o - f; float d = dot(r, r); if (d < md) { md = d; mr = r; mg = g; id = hash12(c + 3.7); } }
  md = 8.;
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) { vec2 g = mg + vec2(float(x), float(y)); vec2 c = mod(i + g, P); vec2 o = .5 + (hash22(c) - .5) * jit; vec2 r = g + o - f; if (dot(mr - r, mr - r) > .00001) md = min(md, dot(.5 * (mr + r), normalize(r - mr))); }
  return vec3(md, id, length(mr)); }
float sat(float x){ return clamp(x, 0., 1.); }
vec3 lin(vec3 c){ return pow(max(c, vec3(0.)), vec3(2.2)); }
`;

// ---------- material library: void m_name(vec2 uv, out vec3 col, out float h, out float r) ----------
const MATS_GLSL = `
void m_grass(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 3., 5), n2 = fbm(uv + .37, 9., 4), sp = vnoiseP(uv * 160., 160.), sp2 = vnoiseP(uv * 70. + 3., 70.);
  vec3 a = vec3(.33, .5, .14), b = vec3(.47, .62, .2), dry = vec3(.66, .64, .3), soil = vec3(.32, .26, .16);
  c = mix(a, b, n); c = mix(c, dry, smoothstep(.62, .8, n2) * .4);
  c *= .8 + .4 * sp; c = mix(c, c * vec3(1.08, 1.12, .8), sp2 * .3);
  float hole = smoothstep(.74, .86, fbm(uv + 5.1, 14., 3)); c = mix(c, soil, hole * .5);
  float clover = smoothstep(.3, .15, vorP(uv * 40., 40., .9).x) * step(.72, vnoiseP(uv * 8., 8.)); c = mix(c, vec3(.3, .52, .16), clover * .6);
  h = sp * .6 + n * .25 - hole * .3 + clover * .2 + .2; r = .9; }
void m_darkgrass(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 3., 5), sp = vnoiseP(uv * 150., 150.), moss = fbm(uv + 2., 12., 4);
  c = mix(vec3(.2, .32, .12), vec3(.3, .42, .15), n); c = mix(c, vec3(.24, .38, .1), smoothstep(.5, .75, moss));
  vec4 lv = vorP(uv * 20., 20., .9); float leaf = smoothstep(.36, .2, lv.x) * step(.62, lv.z); c = mix(c, mix(vec3(.42, .3, .12), vec3(.5, .4, .16), lv.z), leaf * .7);
  c *= .78 + .44 * sp; h = sp * .5 + n * .3 + leaf * .25 + .1; r = .93; }
void m_forest(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 4., 5); vec4 lv = vorP(uv * 22., 22., .9); vec4 lv2 = vorP(uv * 34. + .5, 34., .9);
  vec3 soil = mix(vec3(.19, .13, .08), vec3(.27, .19, .11), n);
  vec3 moss = vec3(.24, .36, .11) * (.8 + .4 * vnoiseP(uv * 90., 90.));
  float mm = smoothstep(.45, .7, fbm(uv + 1.3, 6., 4)); c = mix(soil, moss, mm);
  float leaf = smoothstep(.42, .25, lv.x) * step(.45, lv.z); vec3 lc = mix(vec3(.5, .28, .09), vec3(.6, .45, .14), lv.z); c = mix(c, lc * (.7 + .3 * lv.x), leaf * (1. - mm * .6));
  float leaf2 = smoothstep(.38, .2, lv2.x) * step(.6, lv2.z); c = mix(c, vec3(.34, .2, .08), leaf2 * .8);
  float twig = smoothstep(.04, 0., abs(gnoiseP(uv * 18., 18.))) * step(.6, vnoiseP(uv * 9., 9.)); c = mix(c, vec3(.22, .14, .08), twig * .7);
  h = .3 + leaf * .35 + leaf2 * .25 + mm * .2 + twig * .2; r = .9; }
void m_dirt(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 4., 5), n2 = fbm(uv + .7, 16., 4); vec4 pb = vorP(uv * 26., 26., 1.);
  c = mix(vec3(.45, .35, .23), vec3(.56, .45, .31), n); c *= .86 + .28 * n2;
  float peb = smoothstep(.3, .18, pb.x) * step(.55, pb.z); c = mix(c, mix(vec3(.5, .47, .43), vec3(.66, .62, .56), pb.z), peb);
  float rut = smoothstep(.55, .75, fbm(uv + 3.3, 5., 3)); c *= 1. - rut * .12;
  h = .35 + n2 * .25 + peb * .4 - rut * .2; r = .95; }
void m_cobble(vec2 uv, out vec3 c, out float h, out float r){
  vec3 e = vorEdge(uv * 9., 9., .85); float n = fbm(uv, 8., 4), fn = vnoiseP(uv * 120., 120.);
  vec3 st = mix(vec3(.46, .44, .4), vec3(.66, .62, .55), e.y); st = mix(st, st * vec3(1.06, .95, .84), step(.7, fract(e.y * 7.3)) * .5);
  st *= .85 + .2 * fn; float mort = smoothstep(.07, .02, e.x); vec3 mc = mix(vec3(.26, .22, .16), vec3(.28, .34, .15), n);
  c = mix(st, mc, mort); h = sat(smoothstep(0., .22, e.x) * .85 + fn * .1 - (1. - smoothstep(0., .3, e.x)) * .2); r = mix(.75, .95, mort); }
void m_sand(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 4., 5), g = vnoiseP(uv * 200., 200.); float rip = sin(6.2831853 * (uv.y * 10. + fbm(uv, 3., 3) * 1.5 + uv.x * 2.)) * .5 + .5;
  c = mix(vec3(.84, .75, .55), vec3(.93, .86, .66), n); c *= .92 + .14 * g; c *= .95 + .07 * rip;
  vec4 sh = vorP(uv * 18., 18., 1.); float shell = smoothstep(.16, .08, sh.x) * step(.88, sh.z); c = mix(c, vec3(.96, .92, .86), shell);
  h = rip * .5 + g * .15 + n * .2 + shell * .3; r = .96; }
void m_mud(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 4., 5), n2 = fbm(uv + .3, 14., 4); float pud = smoothstep(.62, .7, fbm(uv + 7., 5., 4));
  c = mix(vec3(.24, .2, .13), vec3(.34, .29, .19), n) * (.85 + .3 * n2); c = mix(c, vec3(.16, .14, .1), pud);
  float moss = smoothstep(.55, .75, fbm(uv + 2.3, 8., 4)); c = mix(c, vec3(.25, .3, .12), moss * (1. - pud) * .6);
  h = .5 + n2 * .3 - pud * .4; r = mix(.85, .15, pud); }
void m_ash(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 4., 5), n2 = vnoiseP(uv * 110., 110.); vec4 ch = vorP(uv * 30., 30., 1.); vec3 e = vorEdge(uv * 7., 7., .9);
  c = mix(vec3(.3, .27, .25), vec3(.44, .4, .37), n) * (.85 + .25 * n2); float bit = smoothstep(.25, .1, ch.x) * step(.7, ch.z); c = mix(c, vec3(.08, .07, .07), bit);
  float cr = smoothstep(.05, .0, e.x) * step(.4, e.y); c = mix(c, vec3(.18, .09, .06), cr * .8);
  h = n * .5 + n2 * .2 + bit * .3 - cr * .3; r = .97; }
void m_rock(vec2 uv, out vec3 c, out float h, out float r){
  float rd = ridged(uv, 4., 6), n = fbm(uv, 6., 5); vec3 e = vorEdge(uv * 9., 9., 1.);
  float strata = sin(6.2831853 * (uv.y * 6. + n * .8)) * .5 + .5;
  c = mix(vec3(.4, .39, .36), vec3(.6, .58, .53), rd); c = mix(c, c * vec3(1.08, .98, .86), strata * .35);
  float crack = smoothstep(.035, 0., e.x) * step(.45, vnoiseP(uv * 7., 7.)); c *= 1. - crack * .35; c *= .85 + .3 * vnoiseP(uv * 64., 64.);
  float lich = smoothstep(.72, .8, fbm(uv + 4.4, 10., 4)); c = mix(c, vec3(.52, .56, .32), lich * .6);
  h = rd * .7 + n * .2 - crack * .35 + .1; r = .85; }
void m_seabed(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 4., 5); vec4 pb = vorP(uv * 14., 14., 1.);
  c = mix(vec3(.62, .58, .44), vec3(.48, .5, .38), n); float peb = smoothstep(.42, .3, pb.x); c = mix(c, mix(vec3(.45, .44, .4), vec3(.58, .56, .5), pb.z), peb);
  c = mix(c, vec3(.25, .38, .2), smoothstep(.6, .8, fbm(uv + 2., 8., 3)) * .5); h = .3 + peb * .5 * (1. - pb.x); r = .6; }
// ----- props -----
void m_stonebrick(vec2 uv, out vec3 c, out float h, out float r){
  vec2 p = uv * vec2(4., 8.); float row = floor(p.y); p.x += mod(row, 2.) * .5 + hash12(vec2(row, 7.)) * .2; vec2 cell = floor(p); vec2 f = fract(p);
  float id = hash12(mod(cell, vec2(4., 8.)) + 11.); float ed = min(min(f.x, 1. - f.x) * 2., min(f.y, 1. - f.y));
  float n = fbm(uv, 8., 5), fn = vnoiseP(uv * 160., 160.);
  vec3 st = mix(vec3(.5, .48, .44), vec3(.7, .67, .6), id); st = mix(st, st * vec3(1.05, .97, .86), step(.75, fract(id * 9.1)) * .6);
  st *= .82 + .3 * n; st *= .92 + .12 * fn; st *= .85 + .15 * smoothstep(0., .5, f.y);
  float mort = smoothstep(.07, .02, ed); vec3 mc = mix(vec3(.32, .3, .27), vec3(.27, .34, .18), smoothstep(.65, .8, fbm(uv + 3., 6., 3)));
  c = mix(st, mc, mort); h = smoothstep(0., .14, ed) * .75 + n * .2 + fn * .05; r = mix(.82, .95, mort); }
void m_fieldstone(vec2 uv, out vec3 c, out float h, out float r){
  vec3 e = vorEdge(uv * 5., 5., .95); float n = fbm(uv, 8., 5), fn = vnoiseP(uv * 140., 140.);
  vec3 st = mix(vec3(.46, .44, .4), vec3(.68, .64, .58), e.y) * (.82 + .3 * n) * (.92 + .12 * fn);
  st = mix(st, vec3(.42, .48, .3), smoothstep(.7, .85, fbm(uv + 1.7, 6., 3)) * .45);
  float mort = smoothstep(.08, .02, e.x); c = mix(st, vec3(.3, .27, .23), mort); h = smoothstep(0., .2, e.x) * .8 + n * .2; r = mix(.85, .95, mort); }
void m_plaster(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 5., 6), n2 = fbm(uv + 1.1, 2., 3), fn = vnoiseP(uv * 150., 150.); vec3 e = vorEdge(uv * 3., 3., 1.);
  c = mix(vec3(.82, .78, .68), vec3(.93, .9, .82), n) * (.94 + .08 * fn); c = mix(c, vec3(.68, .62, .52), smoothstep(.62, .88, n2) * .4);
  float crk = smoothstep(.012, 0., e.x) * step(.6, fbm(uv + 9., 4., 2)); c *= 1. - crk * .35; h = n * .5 + fn * .1 - crk * .3 + .3; r = .93; }
void m_timber(vec2 uv, out vec3 c, out float h, out float r){
  float w = fbm(vec2(uv.x * 1., uv.y * .05), 16., 4); float gr = sin(6.2831853 * (uv.x * 18. + w * 4.)) * .5 + .5; float n = fbm(uv, 8., 4);
  c = mix(vec3(.22, .14, .08), vec3(.36, .24, .14), gr * .6 + n * .4); float knot = smoothstep(.15, .05, vorP(uv * vec2(4., 2.), 4., 1.).x) * .5; c *= 1. - knot * .5;
  h = gr * .4 + n * .3 + .2; r = .85; }
void m_planks(vec2 uv, out vec3 c, out float h, out float r){
  vec2 p = uv * vec2(1., 6.); float row = floor(p.y); float off = hash12(vec2(row, 2.)); vec2 f = fract(p);
  float seg = floor(uv.x * 2. + off * 2.); float id = hash12(vec2(row, seg) + 1.3);
  float gr = sin(6.2831853 * (f.y * 3. + fbm(vec2(uv.x * 2., uv.y * 6.), 8., 3) * 2. + id * 5.)) * .5 + .5; float n = fbm(uv + id, 8., 4);
  c = mix(vec3(.4, .27, .16), vec3(.55, .39, .23), id * .6 + gr * .4) * (.85 + .25 * n);
  float gap = smoothstep(.06, .02, min(f.y, 1. - f.y)); float jx = fract(uv.x * 2. + off * 2.); gap = max(gap, smoothstep(.012, .004, min(jx, 1. - jx)));
  c = mix(c, vec3(.1, .07, .04), gap); float nail = smoothstep(.012, .006, length(vec2((jx - .03) * 1., (f.y - .5) / 6.))); c = mix(c, vec3(.15, .15, .16), nail);
  h = (1. - gap) * (.6 + gr * .2 + n * .2); r = .82; }
void m_rooftile(vec2 uv, out vec3 c, out float h, out float r){
  vec2 p = uv * vec2(8., 8.); float row = floor(p.y); p.x += mod(row, 2.) * .5; vec2 f = fract(p); vec2 cell = floor(p);
  float id = hash12(mod(cell, 8.) + 4.); float curve = sin(f.x * 3.14159);
  float n = fbm(uv, 8., 4); vec3 base = mix(vec3(.62, .26, .16), vec3(.78, .38, .22), id) * (.82 + .3 * n);
  base = mix(base, vec3(.36, .4, .22), smoothstep(.72, .86, fbm(uv + 2., 4., 3)) * .45);
  float shadow = smoothstep(.0, .25, f.y); c = base * (.55 + .45 * shadow) * (.85 + .15 * curve);
  h = sat(f.y * .8 + curve * .25); r = .7; }
void m_slate(vec2 uv, out vec3 c, out float h, out float r){
  vec2 p = uv * vec2(6., 10.); float row = floor(p.y); p.x += mod(row, 2.) * .5 + hash12(vec2(row, 3.)) * .3; vec2 f = fract(p); vec2 cell = floor(p);
  float id = hash12(mod(cell, vec2(6., 10.)) + 8.); float n = fbm(uv, 8., 4);
  vec3 base = mix(vec3(.26, .29, .33), vec3(.4, .43, .48), id) * (.85 + .3 * n); float gap = smoothstep(.05, .015, min(f.x, 1. - f.x) * .6);
  c = base * (.6 + .4 * smoothstep(0., .2, f.y)); c = mix(c, vec3(.1, .1, .11), gap); h = f.y * .7 + n * .2; r = .6; }
void m_shingle(vec2 uv, out vec3 c, out float h, out float r){
  vec2 p = uv * vec2(10., 10.); float row = floor(p.y); p.x += mod(row, 2.) * .5; vec2 f = fract(p); vec2 cell = floor(p);
  float id = hash12(mod(cell, 10.) + 6.); float n = fbm(uv, 8., 4);
  vec3 base = mix(vec3(.36, .26, .18), vec3(.5, .37, .25), id) * (.8 + .35 * n); base = mix(base, vec3(.35, .45, .2), smoothstep(.7, .85, fbm(uv + 1.5, 5., 3)) * .45);
  c = base * (.55 + .45 * smoothstep(0., .3, f.y)); float gap = smoothstep(.06, .02, min(f.x, 1. - f.x)); c *= 1. - gap * .5; h = f.y * .7 + n * .2; r = .8; }
void m_thatch(vec2 uv, out vec3 c, out float h, out float r){
  vec2 p = uv * vec2(1., 7.); float row = floor(p.y); vec2 f = fract(p);
  float st = vnoiseP(vec2(uv.x * 220. + row * 7.1, uv.y * 7.), 7.); float st2 = vnoiseP(vec2(uv.x * 90. + row * 3.3, uv.y * 4.), 4.); float n = fbm(uv, 6., 4);
  c = mix(vec3(.55, .44, .24), vec3(.76, .64, .38), st * .6 + st2 * .4) * (.8 + .3 * n);
  c = mix(c, vec3(.36, .4, .2), smoothstep(.68, .85, fbm(uv + 3.1, 5., 3)) * .5);
  float lip = smoothstep(.0, .3, f.y); c *= .6 + .4 * lip; h = lip * .6 + st * .4; r = .97; }
void m_bark(vec2 uv, out vec3 c, out float h, out float r){
  float rd = ridged(vec2(uv.x, uv.y * .25), 8., 5); float n = fbm(uv, 8., 4);
  c = mix(vec3(.17, .12, .08), vec3(.4, .31, .22), rd) * (.85 + .3 * n); c = mix(c, vec3(.3, .38, .16), smoothstep(.65, .8, fbm(uv + 3., 4., 3)) * .5);
  h = rd; r = .92; }
void m_birch(vec2 uv, out vec3 c, out float h, out float r){
  float n = fbm(uv, 6., 5); float mark = smoothstep(.66, .74, vnoiseP(vec2(uv.x * 24., uv.y * 90.), 90.)) * step(.55, vnoiseP(uv * vec2(20., 12.), 12.)) * .8 + smoothstep(.8, .9, fbm(uv + 3., 6., 3)) * .5;
  c = mix(vec3(.8, .78, .72), vec3(.93, .91, .86), n); c = mix(c, vec3(.16, .14, .12), mark); h = .6 - mark * .4 + n * .2; r = .8; }
void m_pinebark(vec2 uv, out vec3 c, out float h, out float r){
  vec3 e = vorEdge(uv * vec2(6., 3.), 6., 1.); float n = fbm(uv, 8., 4);
  c = mix(vec3(.34, .18, .1), vec3(.52, .31, .18), e.y) * (.8 + .3 * n); float gap = smoothstep(.08, .02, e.x); c = mix(c, vec3(.1, .06, .04), gap); h = (1. - gap) * .8; r = .9; }
void m_metal(vec2 uv, out vec3 c, out float h, out float r){
  float br = vnoiseP(vec2(uv.x * 400., uv.y * 4.), 4.); float n = fbm(uv, 6., 4); float sc = smoothstep(.97, 1., vnoiseP(uv * 90., 90.));
  c = vec3(.62, .63, .65) * (.9 + .15 * br) * (.9 + .15 * n); c *= 1. - sc * .3; h = .5 + br * .05; r = .35 + n * .2; }
void m_cloth(vec2 uv, out vec3 c, out float h, out float r){
  float wx = sin(uv.x * 6.2831853 * 120.) * .5 + .5, wy = sin(uv.y * 6.2831853 * 120.) * .5 + .5; float n = fbm(uv, 8., 4);
  float weave = mix(wx, wy, step(.5, fract(uv.x * 60.) + fract(uv.y * 60.) - .5)); c = vec3(.88) * (.85 + .15 * weave) * (.9 + .15 * n); h = weave * .5 + .25; r = .97; }
void m_water(vec2 uv, out vec3 c, out float h, out float r){ h = gfbm(uv, 6., 5) * .7 + gfbm(uv + .5, 14., 3) * .3; c = vec3(.5); r = .05; }
`;

// terrain layers (array texture order)
export const TERRAIN_LAYERS = ['grass', 'darkgrass', 'forest', 'dirt', 'cobble', 'sand', 'mud', 'ash', 'rock', 'seabed'];
export const PROP_MATS = ['stonebrick', 'fieldstone', 'plaster', 'timber', 'planks', 'rooftile', 'slate', 'shingle', 'thatch', 'bark', 'birch', 'pinebark', 'metal', 'cloth', 'water', 'rock'];

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
function aniso() { return Math.min(ENV.Q.aniso || 8, ENV.maxAniso); }
function texParams(t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = aniso(); }

let terrainArrays = null;
export function makeTerrainArrays(size) {
  if (terrainArrays) return terrainArrays;
  const r = ENV.renderer; const n = TERRAIN_LAYERS.length;
  // mipmaps are made by hand below (three r160 binds array render targets to the wrong target for that)
  const mk = (srgb) => { const rt = new THREE.WebGLArrayRenderTarget(size, size, n, { depthBuffer: false }); texParams(rt.texture); rt.texture.generateMipmaps = false; if (srgb) rt.texture.colorSpace = THREE.SRGBColorSpace; return rt; };
  const alb = mk(true), nrm = mk(false);
  const prev = r.getRenderTarget();
  for (let i = 0; i < n; i++) {
    const m = gen(TERRAIN_LAYERS[i]); m.uniforms.uTexel.value = 1 / size;
    m.uniforms.uMode.value = 0; r.setRenderTarget(alb, i); quad.render(r);
    m.uniforms.uMode.value = 1; r.setRenderTarget(nrm, i); quad.render(r);
  }
  r.setRenderTarget(prev);
  const gl = r.getContext();
  for (const rt of [alb, nrm]) { const wt = r.properties.get(rt.texture).__webglTexture; r.state.bindTexture(gl.TEXTURE_2D_ARRAY, wt); gl.generateMipmap(gl.TEXTURE_2D_ARRAY); r.state.unbindTexture(); }
  return (terrainArrays = { albedo: alb.texture, normal: nrm.texture, layers: TERRAIN_LAYERS });
}

const propCache = {};
export function propTex(name, size) {
  size = size || ENV.Q.texSize || 512;
  const key = name + size; if (propCache[key]) return propCache[key];
  const r = ENV.renderer; const m = gen(name);
  const mk = (srgb) => { const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false }); texParams(rt.texture); if (srgb) rt.texture.colorSpace = THREE.SRGBColorSpace; return rt; };
  const a = mk(true), b = mk(false);
  m.uniforms.uTexel.value = 1 / size;
  const prev = r.getRenderTarget();
  m.uniforms.uMode.value = 0; r.setRenderTarget(a); quad.render(r);
  m.uniforms.uMode.value = 1; r.setRenderTarget(b); quad.render(r);
  r.setRenderTarget(prev);
  return (propCache[key] = { map: a.texture, normalMap: b.texture });
}

// ---------- canvas-painted cards with alpha ----------
const cardCache = {};
// bleed: alpha-tested cards (leaves, grass) get the colour of their leaves spread into the transparent texels, so the
// small mip levels don't fade the edges to black (distant trees went dark and spiky without it)
export function canvasTex(w, h, draw, srgb = true, bleed = false) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); draw(g, w, h);
  let t;
  if (bleed) {
    const d = g.getImageData(0, 0, w, h).data; const out = new Uint8Array(d.length);
    let ar = 0, ag = 0, ab = 0, an = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { ar += d[i]; ag += d[i + 1]; ab += d[i + 2]; an++; }
    an = Math.max(1, an); ar /= an; ag /= an; ab /= an;
    let has = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) { out[i * 4 + 3] = d[i * 4 + 3]; if (d[i * 4 + 3] > 20) { out[i * 4] = d[i * 4]; out[i * 4 + 1] = d[i * 4 + 1]; out[i * 4 + 2] = d[i * 4 + 2]; has[i] = 1; } }
    for (let pass = 0; pass < 4; pass++) {
      const nh = has.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (has[i]) continue; let r = 0, gg = 0, b = 0, n = 0;
        if (x > 0 && has[i - 1]) { r += out[i * 4 - 4]; gg += out[i * 4 - 3]; b += out[i * 4 - 2]; n++; }
        if (x < w - 1 && has[i + 1]) { r += out[i * 4 + 4]; gg += out[i * 4 + 5]; b += out[i * 4 + 6]; n++; }
        if (y > 0 && has[i - w]) { const j = (i - w) * 4; r += out[j]; gg += out[j + 1]; b += out[j + 2]; n++; }
        if (y < h - 1 && has[i + w]) { const j = (i + w) * 4; r += out[j]; gg += out[j + 1]; b += out[j + 2]; n++; }
        if (n) { out[i * 4] = r / n; out[i * 4 + 1] = gg / n; out[i * 4 + 2] = b / n; nh[i] = 1; }
      }
      has = nh;
    }
    for (let i = 0; i < w * h; i++) if (!has[i]) { out[i * 4] = ar; out[i * 4 + 1] = ag; out[i * 4 + 2] = ab; }
    // canvas rows run top-down: flip them so v = 1 is the top, as with a canvas texture
    const flip = new Uint8Array(out.length); for (let y = 0; y < h; y++) flip.set(out.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    t = new THREE.DataTexture(flip, w, h, THREE.RGBAFormat, THREE.UnsignedByteType); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  } else t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, ENV.maxAniso); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.userData.canvas = cv;
  return t;
}
const LEAF_PAL = {
  oak: ['#3a6a2a', '#4e8434', '#6aa446', '#5a943c', '#7ab24e'],
  aged: ['#2c4c26', '#38602e', '#4a7438', '#3e6630', '#567e3c'],
  birch: ['#6a9a30', '#86b63c', '#a8cc58', '#94c046', '#bcd86a'],
  willow: ['#4a6a2c', '#5a7a36', '#7a9a48', '#68883e', '#8aa850'],
  palm: ['#2f7a3a', '#3a8a40', '#4f9a48', '#2a6a30'],
  bush: ['#3a6a28', '#4a7c30', '#5e8e38', '#46782e', '#6e9e40'],
  thornbush: ['#2e4a22', '#3a5a28', '#4a6a30', '#34522a'],
  wyrd: ['#8a3a8a', '#a84aa0', '#c86ac0', '#e08ad8', '#7a2a7a'],
  mirebush: ['#4a5a2a', '#5a6a32', '#6e7a3a', '#525e2c'],
};
export function cardTex(kind) {
  if (cardCache[kind]) return cardCache[kind];
  let t;
  const S = 256;
  if (LEAF_PAL[kind]) {
    const pal = LEAF_PAL[kind]; const R = rng(kind.length * 977 + kind.charCodeAt(0));
    t = canvasTex(S, S, (g) => {
      g.clearRect(0, 0, S, S);
      const n = kind === 'willow' ? 170 : kind === 'birch' ? 230 : 200;
      for (let i = 0; i < n; i++) {
        const a = R() * 6.283, rr = Math.sqrt(R()) * S * 0.44; const x = S / 2 + Math.cos(a) * rr, y = S / 2 + Math.sin(a) * rr * (kind === 'willow' ? 1.1 : 0.9);
        const L = kind === 'willow' ? 26 + R() * 18 : kind === 'birch' ? 10 + R() * 6 : kind === 'wyrd' ? 12 + R() * 8 : 14 + R() * 10; const W2 = kind === 'willow' ? 3 + R() * 2 : L * 0.42;
        g.save(); g.translate(x, y); g.rotate(kind === 'willow' ? Math.PI / 2 + (R() - 0.5) * 0.5 : R() * 6.283);
        // leaves facing the light are paler: a light gradient across the card gives the crown volume
        const lit = 0.78 + (1 - y / S) * 0.35 + R() * 0.15;
        g.fillStyle = pal[Math.floor(R() * pal.length)]; g.filter = `brightness(${lit.toFixed(2)})`;
        g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, -W2, L / 2, 0); g.quadraticCurveTo(0, W2, -L / 2, 0); g.fill();
        g.filter = 'none'; g.strokeStyle = 'rgba(20,30,10,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke();
        g.restore();
      }
      if (kind === 'bush') for (let i = 0; i < 16; i++) { g.fillStyle = ['#f2f0e8', '#f6d0e0', '#f8e070'][i % 3]; g.beginPath(); g.arc(S / 2 + (R() - 0.5) * S * 0.7, S / 2 + (R() - 0.5) * S * 0.7, 3, 0, 6.283); g.fill(); }
      if (kind === 'thornbush') for (let i = 0; i < 22; i++) { g.fillStyle = '#8a2a3a'; g.beginPath(); g.arc(S / 2 + (R() - 0.5) * S * 0.7, S / 2 + (R() - 0.5) * S * 0.7, 3.5, 0, 6.283); g.fill(); }
      if (kind === 'wyrd') for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(255,220,250,0.95)'; g.beginPath(); g.arc(S / 2 + (R() - 0.5) * S * 0.75, S / 2 + (R() - 0.5) * S * 0.75, 2 + R() * 2, 0, 6.283); g.fill(); }
    }, true, true);
  } else if (kind === 'pine') {
    const R = rng(51);
    t = canvasTex(S, S, (g) => {
      g.clearRect(0, 0, S, S);
      for (let b = 0; b < 16; b++) {
        const x0 = S / 2 + (R() - 0.5) * 30, y0 = 10 + b * 13; const len = S * (0.18 + (b / 16) * 0.3);
        for (const s of [-1, 1]) {
          g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + s * len, y0 + len * 0.35); g.stroke();
          for (let k = 0; k < 30; k++) {
            const u = k / 30; const px = x0 + s * len * u, py = y0 + len * 0.35 * u;
            g.strokeStyle = ['#22462a', '#2a5232', '#386a3e', '#2f5e36', '#44784a'][Math.floor(R() * 5)]; g.lineWidth = 1.7;
            for (const d of [-1, 1]) { g.beginPath(); g.moveTo(px, py); g.lineTo(px + s * 5 + d * 2, py + d * 9 + 4); g.stroke(); }
          }
        }
      }
    }, true, true);
  } else if (['grass', 'drygrass', 'darkgrass', 'flowers', 'reeds', 'fern', 'ashgrass', 'swampgrass', 'hemp', 'silkweed'].includes(kind)) {
    const R = rng(kind.length * 31 + 7);
    const pal = { grass: ['#4a7c26', '#5e9030', '#72a238', '#86b040'], drygrass: ['#9a9040', '#aa9e4e', '#8a8a3c', '#b8aa56'], darkgrass: ['#2e4c22', '#3a5c2a', '#466a30', '#34542a'], flowers: ['#4a7c26', '#5e9030', '#72a238', '#86b040'], reeds: ['#6a7a32', '#7a8a40', '#8a9a4a', '#5a6a2a'], fern: ['#2f6e2a', '#3f8034', '#4f923c', '#3a7430'], ashgrass: ['#4a4840', '#5a5850', '#3a3832', '#6a665a'], swampgrass: ['#5a6a30', '#6a7a38', '#4e5e2a', '#7a8a44'], hemp: ['#4e8a34', '#5e9a3c', '#6eaa44', '#448030'], silkweed: ['#6a8a7a', '#7a9a8a', '#8aaa9a', '#5a7a6a'] }[kind] || ['#4a7c26', '#5e9030', '#72a238', '#86b040'];
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
        const n = kind === 'reeds' ? 26 : kind === 'hemp' || kind === 'silkweed' ? 34 : kind === 'grass' ? 120 : 64;
        for (let i = 0; i < n; i++) {
          const x = S * (0.08 + R() * 0.84), hgt = S * (kind === 'reeds' ? 0.75 + R() * 0.25 : kind === 'hemp' || kind === 'silkweed' ? 0.6 + R() * 0.4 : 0.45 + R() * 0.55); const bend = (R() - 0.5) * S * 0.25; const w = kind === 'reeds' ? 4 : kind === 'grass' ? 1.3 + R() * 1.6 : 2.5 + R() * 2.5;
          const grd = g.createLinearGradient(0, S, 0, S - hgt); const c = pal[Math.floor(R() * pal.length)];
          grd.addColorStop(0, kind === 'grass' ? '#2e4418' : '#1a2a10'); grd.addColorStop(0.35, c); grd.addColorStop(1, c);
          g.fillStyle = grd; g.beginPath(); g.moveTo(x - w, S); g.quadraticCurveTo(x - w * 0.3 + bend * 0.5, S - hgt * 0.6, x + bend, S - hgt); g.quadraticCurveTo(x + w * 0.3 + bend * 0.5, S - hgt * 0.6, x + w, S); g.fill();
          if (kind === 'reeds' && R() < 0.5) { g.fillStyle = '#5a3a20'; g.beginPath(); g.ellipse(x + bend, S - hgt + 10, 4, 12, 0, 0, 6.283); g.fill(); }
          if (kind === 'hemp' && R() < 0.5) { g.fillStyle = ['#8aba4a', '#a8c858'][Math.floor(R() * 2)]; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + bend * (k / 5), S - hgt * (0.5 + k * 0.1), 9, 3, (k % 2 ? 0.6 : -0.6), 0, 6.283); g.fill(); } }
          if (kind === 'silkweed' && R() < 0.6) { g.fillStyle = 'rgba(246,248,255,0.95)'; g.beginPath(); g.arc(x + bend, S - hgt + 4, 6 + R() * 4, 0, 6.283); g.fill(); }
        }
        if (kind === 'flowers') for (let i = 0; i < 16; i++) { const fc = ['#f2d34a', '#e86a8a', '#ffffff', '#9a7ae0', '#f0904a', '#5aa8f0'][Math.floor(R() * 6)]; const x = S * (0.1 + R() * 0.8), y = S * (0.2 + R() * 0.45); g.fillStyle = fc; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + Math.cos(k * 1.256) * 5, y + Math.sin(k * 1.256) * 5, 4.5, 2.8, k * 1.256, 0, 6.283); g.fill(); } g.fillStyle = '#f8e060'; g.beginPath(); g.arc(x, y, 2.5, 0, 6.283); g.fill(); }
      }
    }, true, true);
  } else if (kind === 'flame') {
    t = canvasTex(64, 128, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h * 0.72, 2, w / 2, h * 0.6, h * 0.55);
      grd.addColorStop(0, 'rgba(255,250,220,1)'); grd.addColorStop(0.25, 'rgba(255,200,80,0.95)'); grd.addColorStop(0.55, 'rgba(255,110,20,0.6)'); grd.addColorStop(1, 'rgba(120,20,0,0)');
      g.fillStyle = grd; g.beginPath(); g.moveTo(w / 2, 2); g.bezierCurveTo(w * 0.95, h * 0.45, w * 0.95, h * 0.95, w / 2, h - 2); g.bezierCurveTo(w * 0.05, h * 0.95, w * 0.05, h * 0.45, w / 2, 2); g.fill();
    });
  } else if (kind === 'glow' || kind === 'smoke' || kind === 'spark') {
    t = canvasTex(64, 64, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      if (kind === 'smoke') { grd.addColorStop(0, 'rgba(255,255,255,0.6)'); grd.addColorStop(0.55, 'rgba(255,255,255,0.25)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); }
      else if (kind === 'spark') { grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,255,255,0.8)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); }
      else { grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); }
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      if (kind === 'smoke') { const R = rng(9); g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${0.08 + R() * 0.1})`; g.beginPath(); g.arc(R() * w, R() * h, 3 + R() * 7, 0, 6.283); g.fill(); } }
    });
  }
  return (cardCache[kind] = t);
}

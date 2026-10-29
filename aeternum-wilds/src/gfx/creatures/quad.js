// Aeternum Wilds creatures: four-legged animals (wolves, dire wolves, mire hounds, boars, bears, deer, rabbits).
// Anatomy and gaits ported from Kingdom Rising 3D's creatures.js and extended: deer with branching antlers,
// rabbits that bound, mire hounds with bare ribs and glowing sores, dire wolves with raised hackles.
import { THREE, Q, shade, clamp, ease, decay } from './core.js';
import { Rig, instance, addFur } from './rig.js';

export const QUAD = {
  wolf: { L: 1.4, H: 0.86, br: 0.22, hr: 0.15, sn: 0.25, ear: 'point', tail: 0.62, tailR: 0.075, leg: 0.058, eye: '#e8c040', ruff: true, hx: 0.25, neck: 0.3, fur: 0.026, style: 'leap' },
  direwolf: { L: 1.5, H: 0.92, br: 0.25, hr: 0.165, sn: 0.26, ear: 'point', tail: 0.66, tailR: 0.085, leg: 0.066, eye: '#ffb030', ruff: true, hackles: true, hx: 0.25, neck: 0.3, fur: 0.034, style: 'leap', dog: true },
  mirehound: { L: 1.45, H: 0.84, br: 0.2, hr: 0.15, sn: 0.27, ear: 'point', tail: 0.55, tailR: 0.05, leg: 0.054, eye: '#c0ff4a', glowEye: true, ruff: false, ribs: true, sores: true, spines: true, hx: 0.25, neck: 0.3, fur: 0.016, style: 'leap', dog: true },
  spiritwolf: { L: 1.4, H: 0.86, br: 0.22, hr: 0.15, sn: 0.25, ear: 'point', tail: 0.62, tailR: 0.075, leg: 0.058, eye: '#ffffff', glowy: true, ruff: true, hx: 0.25, neck: 0.3, fur: 0, style: 'leap', dog: true },
  bear: { L: 2.0, H: 1.15, br: 0.45, hr: 0.25, sn: 0.26, ear: 'round', tail: 0.08, tailR: 0.06, leg: 0.135, hump: true, eye: '#2a1a10', hdrop: 0.12, hx: 0.3, fur: 0.05, style: 'rear' },
  boar: { L: 1.35, H: 0.8, br: 0.3, hr: 0.21, sn: 0.3, ear: 'point', tail: 0.2, tailR: 0.018, leg: 0.04, tusk: true, hoof: true, disc: true, hdrop: 0.16, hx: 0.3, fur: 0.016, style: 'gore' },
  deer: { L: 1.5, H: 1.25, br: 0.25, hr: 0.12, sn: 0.19, ear: 'deer', tail: 0.12, tailR: 0.05, leg: 0.036, neck: 0.5, hoof: true, eye: '#1a120c', hx: 0.3, antlers: true, long: true, fur: 0.008, style: 'rear' },
  rabbit: { L: 0.4, H: 0.2, br: 0.1, hr: 0.062, sn: 0.03, ear: 'long', tail: 0.05, tailR: 0.04, leg: 0.016, eye: '#120c08', hx: 0.25, neck: 0.05, fur: 0.012, bound: true, style: 'bite' },
};
QUAD.wolf.dog = true;
export const QUAD_KINDS = new Set(Object.keys(QUAD));

function quadRig(sp) {
  const L = sp.L, H = sp.H; const hx = sp.hx != null ? L * sp.hx : L * 0.32; const legH = H * 0.62;
  const nk = sp.neck || 0.15;
  const headP = [0, legH + sp.br * 0.5 + nk * 0.8 - (sp.hdrop || 0), hx + sp.br * 0.6 + nk * 0.6 + sp.hr * 0.4];
  const defs = [
    ['root', null, [0, legH, 0]], ['pelvis', 'root', [0, legH, -hx]], ['chest', 'root', [0, legH + sp.br * 0.1, hx]],
    ['neck', 'chest', [0, legH + sp.br * 0.5, hx + sp.br * 0.6]], ['head', 'neck', headP], ['jaw', 'head', [0, headP[1] - sp.hr * 0.4, headP[2] + sp.hr * 0.1]],
    ['tail1', 'pelvis', [0, legH + sp.br * 0.25, -hx - sp.br * 0.8]], ['tail2', 'tail1', [0, legH + sp.br * 0.1 - sp.tail * 0.2, -hx - sp.br * 0.8 - sp.tail * 0.45]], ['tail3', 'tail2', [0, legH - sp.tail * 0.3, -hx - sp.br * 0.8 - sp.tail * 0.85]],
  ];
  if (sp.ear === 'long' || sp.ear === 'deer') for (const s of [1, -1]) defs.push([s > 0 ? 'earL' : 'earR', 'head', [s * sp.hr * 0.35, headP[1] + sp.hr * 0.6, headP[2] - sp.hr * 0.2]]);
  const sx = sp.br * 0.7;
  for (const [n, z, par] of [['FL', hx, 'chest'], ['FR', hx, 'chest'], ['BL', -hx, 'pelvis'], ['BR', -hx, 'pelvis']]) {
    const x = n[1] === 'L' ? sx : -sx;
    defs.push([n + '1', par, [x, legH, z]], [n + '2', n + '1', [x, legH * 0.48, z + (n[0] === 'B' ? -0.04 * L : 0.015 * L)]], [n + '3', n + '2', [x, 0.04 * Math.min(1, L), z + 0.015 * L]]);
  }
  return defs;
}

// a believable runner: ribcage, shoulder blades, a tucked waist, haunches, a tapering neck, a skull with muzzle
// and jaw, muscular upper legs over slim lower legs and paws; all melted into one body
function quadAnatomy(R, sp, kind, c, mat, belly, dark) {
  if (kind === 'bear') return bearAnatomy(R, sp, c, mat, belly, dark);
  if (kind === 'boar') return boarAnatomy(R, sp, c, mat, belly, dark);
  if (kind === 'rabbit') return rabbitAnatomy(R, sp, c, mat, belly, dark);
  const r = R.rest, br = sp.br, hr = sp.hr, sn = sp.sn, lg = sp.leg; const dog = !!sp.dog; const deer = kind === 'deer';
  const ch = r.chest, pv = r.pelvis, rt = r.root; const span = Math.abs(ch[2] - pv[2]);
  const cw = deer ? 0.72 : sp.ribs ? 0.58 : 0.66;
  // the keel of ribs reaching down to the elbows, a belly line that sweeps up into a tucked waist, then the croup
  R.ell('chest', [0, ch[1] - br * 0.05, ch[2] - br * 0.05], [br * cw, br * (deer ? 1.15 : 1.22), br * 1.12], c, mat, Q(-0.12, 0, 0), 'root', 0.2);
  R.ell('chest', [0, ch[1] - br * 0.62, ch[2] + br * 0.35], [br * 0.42, br * 0.5, br * 0.62], belly, mat, Q(0.3, 0, 0), 'root', 0.1); // the brisket
  R.ell('chest', [0, ch[1] + br * 0.62, ch[2] - br * 0.15], [br * cw * 0.85, br * 0.42, br * 0.85], c, mat); // withers
  for (const sx of [1, -1]) R.ell(sx > 0 ? 'FL1' : 'FR1', [sx * br * cw * 0.72, ch[1] + br * 0.2, ch[2] + br * 0.12], [br * 0.3, br * 0.72, br * 0.5], c, mat, Q(0.45, 0, 0), 'chest', 0.6); // shoulder blades
  R.seg('root', [0, ch[1] + br * 0.15, ch[2] - br * 0.6], [0, pv[1] + br * 0.32, pv[2] + br * 0.45], br * cw * 0.95, br * (sp.ribs ? 0.38 : 0.46), c, mat); // the loin narrows
  R.ell('root', [0, rt[1] + br * 0.12, rt[2] - span * 0.08], [br * (deer ? 0.55 : 0.46), br * (deer ? 0.62 : 0.5), span * 0.32], belly, mat); // the tucked belly
  R.ell('pelvis', [0, pv[1] + br * 0.28, pv[2] + br * 0.05], [br * cw * 0.92, br * 0.66, br * 0.8], c, mat, Q(0.22, 0, 0), 'root', 0.2); // the croup slopes down to the tail
  for (const sx of [1, -1]) R.ell(sx > 0 ? 'BL1' : 'BR1', [sx * br * cw * 0.7, pv[1] - br * 0.02, pv[2] - br * 0.02], [br * 0.36, br * 0.82, br * 0.66], c, mat, Q(-0.15, 0, 0), 'pelvis', 0.5); // thighs
  // neck and head
  const hd = r.head; const nk0 = [0, ch[1] + br * 0.38, ch[2] + br * 0.6], nk1 = [0, hd[1] - hr * 0.1, hd[2] - hr * 0.45];
  R.seg('neck', nk0, nk1, br * (deer ? 0.5 : 0.6), hr * (deer ? 0.8 : 0.72), c, mat, 'chest', 0.3);
  R.seg('neck', [0, ch[1] - br * 0.15, ch[2] + br * 0.75], [0, hd[1] - hr * 0.5, hd[2] - hr * 0.2], br * 0.42, hr * 0.5, belly, mat, 'chest', 0.4); // the throat
  R.ell('head', [0, hd[1] + hr * 0.08, hd[2] - hr * 0.05], dog ? [hr * 0.64, hr * 0.72, hr * 0.88] : [hr * 0.7, hr * 0.74, hr * 0.92], c, mat);
  R.ell('head', [0, hd[1] + hr * 0.32, hd[2] + hr * 0.42], [hr * 0.5, hr * 0.22, hr * 0.3], c, mat); // brow
  for (const sx of [1, -1]) R.ell('head', [sx * hr * 0.4, hd[1] - hr * 0.18, hd[2] + hr * 0.38], [hr * 0.3, hr * 0.32, hr * 0.38], c, mat); // cheeks
  const tipZ = hd[2] + hr * 0.5 + sn * 1.05, tipY = hd[1] - hr * 0.18;
  const mz = dog ? 0.74 : 0.8; // a dog's muzzle tapers to a narrow nose, below a clear stop under the brow
  R.seg('head', [0, hd[1] - hr * (dog ? 0.14 : 0.05), hd[2] + hr * (dog ? 0.5 : 0.4)], [0, tipY + hr * 0.1, tipZ], hr * 0.5 * mz, hr * (deer ? 0.3 : 0.24) * mz, shade(c, deer ? 0.05 : -0.03), mat);
  R.seg('jaw', [0, r.jaw[1] + hr * 0.02, r.jaw[2] - hr * 0.3], [0, r.jaw[1] + hr * 0.05, tipZ - hr * 0.14], hr * 0.4 * mz, hr * 0.18 * mz, belly, mat);
  R.ell('head', [0, tipY + hr * 0.1, tipZ + hr * 0.02], [hr * 0.2, hr * 0.15, hr * 0.12], '#1a1414', 'skin'); // nose
  // ears
  for (const sx of [1, -1]) {
    if (sp.ear === 'point') R.ell('head', [sx * hr * 0.44, hd[1] + hr * 0.95, hd[2] - hr * 0.12], [hr * 0.24, hr * 0.55, hr * 0.08], dark, mat, Q(-0.1, 0, -sx * 0.22));
    else if (sp.ear === 'deer') { const e = sx > 0 ? 'earL' : 'earR'; R.ell(e, [sx * hr * 0.75, hd[1] + hr * 0.75, hd[2] - hr * 0.25], [hr * 0.5, hr * 0.26, hr * 0.1], c, mat, Q(0.2, sx * 0.3, sx * 0.35)); R.hard(() => R.ell(e, [sx * hr * 0.76, hd[1] + hr * 0.77, hd[2] - hr * 0.2], [hr * 0.38, hr * 0.17, hr * 0.03], '#e8d8c8', 'skin', Q(0.2, sx * 0.3, sx * 0.35))); }
  }
  // a ruff of longer fur round the neck and cheeks; a dire wolf's hackles stand up along the neck
  if (sp.ruff) { R.ell('neck', [0, ch[1] + br * 0.42, ch[2] + br * 0.62], [br * 0.66, br * 0.7, br * 0.55], shade(c, 0.08), mat, null, 'chest', 0.4); for (const sx of [1, -1]) R.ell('head', [sx * hr * 0.55, hd[1] - hr * 0.3, hd[2] + hr * 0.05], [hr * 0.32, hr * 0.42, hr * 0.42], shade(c, 0.12), mat); }
  if (sp.hackles) R.ell('neck', [0, ch[1] + br * 0.85, ch[2] + br * 0.35], [br * 0.42, br * 0.42, br * 0.7], shade(c, -0.2), mat, Q(-0.3, 0, 0), 'chest', 0.5);
  if (deer) R.ell('pelvis', [0, pv[1] + br * 0.2, pv[2] - br * 0.55], [br * 0.5, br * 0.5, br * 0.3], '#efe6d8', mat); // the white rump
  // legs: a muscular upper leg, a slim lower leg and a paw or hoof
  for (const n of ['FL', 'FR', 'BL', 'BR']) {
    const a = r[n + '1'], b = r[n + '2'], f = r[n + '3']; const back = n[0] === 'B'; const L = lg * (back ? 1.1 : 1);
    R.seg(n + '1', [a[0], a[1] + br * 0.15, a[2]], [b[0], b[1] + (a[1] - b[1]) * 0.1, b[2] + (back ? -0.02 : 0)], L * (back ? 1.95 : 1.6) * (deer ? 1.3 : 1), L * 0.95, c, mat, back ? 'pelvis' : 'chest', 0);
    R.seg(n + '2', b, [f[0], f[1] + L * 1.2, f[2] + (back ? -0.01 : 0.01)], L * 0.92, L * 0.62, deer ? shade(c, -0.05) : c, mat);
    if (back) R.ell(n + '2', [b[0], b[1] + L * 0.2, b[2] - L * 0.6], [L * 0.62, L * 0.9, L * 0.7], c, mat); // the hock
    if (sp.hoof) R.seg(n + '3', [f[0], f[1] + L * 1.6, f[2]], [f[0], f[1] - L * 0.1, f[2] + L * 0.2], L * 0.75, L * 0.95, '#2a2420', 'skin');
    else { R.ell(n + '3', [f[0], f[1] + L * 0.38, f[2] + L * 0.45], [L * 0.85, L * 0.62, L * 1.15], shade(c, -0.08), mat); for (let k = -1; k <= 1; k++) R.ell(n + '3', [f[0] + k * L * 0.42, f[1] + L * 0.22, f[2] + L * 1.12], [L * 0.32, L * 0.3, L * 0.36], shade(c, -0.12), mat); }
  }
  // tail
  if (deer) R.ell('tail1', [0, pv[1] + br * 0.3, pv[2] - br * 0.85], [br * 0.18, br * 0.32, br * 0.12], '#efe6d8', mat, Q(0.4, 0, 0), 'pelvis', 0.2);
  else if (sp.tail > 0.1) {
    const bushy = sp.ribs ? 1.1 : 1.9; const tr = sp.tailR;
    R.seg('tail1', [0, pv[1] + br * 0.35, pv[2] - br * 0.75], r.tail2, tr * 0.7, tr * bushy * 1.08, c, mat, 'pelvis', 0.3);
    R.seg('tail2', r.tail2, r.tail3, tr * bushy, tr * bushy * 0.8, c, mat);
    R.seg('tail3', r.tail3, [0, r.tail3[1] - sp.tail * 0.15, r.tail3[2] - sp.tail * 0.28], tr * bushy * 0.8, tr * 0.12, shade(c, -0.28), mat);
  }
  // crisp bits: eyes, teeth, claws, antlers, bare ribs and bone spines
  R.hard(() => {
    for (const sx of [-1, 1]) {
      const ex = sx * hr * (deer ? 0.48 : 0.4), ey = hd[1] + hr * 0.2; const ez = hd[2] - hr * 0.05 + hr * 0.92 * Math.sqrt(Math.max(0.05, 1 - (ex / (hr * 0.82)) ** 2 - ((ey - hd[1] - hr * 0.08) / (hr * 0.78)) ** 2)) - hr * (deer ? 0.12 : 0.04);
      const es = deer ? 1.25 : 1;
      R.ell('head', [ex, ey, ez], [hr * 0.13 * es, hr * 0.12 * es, hr * 0.1 * es], '#120c08', 'gem', Q(0, sx * 0.5, 0));
      R.ell('head', [ex + sx * hr * 0.015, ey, ez + hr * 0.04], [hr * 0.085 * es, hr * 0.085 * es, hr * 0.06 * es], sp.eye || '#3a2a1a', sp.glowy || sp.glowEye || (sp.eye && sp.eye !== '#1a120c' && sp.eye !== '#2a1a10') ? 'glow' : 'gem', Q(0, sx * 0.5, 0));
    }
    if (!deer) for (const sx of [-1, 1]) { R.cone('jaw', [sx * hr * 0.16, r.jaw[1] + hr * 0.09, tipZ - hr * 0.22], hr * 0.035, hr * 0.18, null, '#f0ead8', 'bone'); R.cone('head', [sx * hr * 0.17, tipY - hr * 0.1, tipZ - hr * 0.28], hr * 0.035, hr * 0.2, Q(Math.PI, 0, 0), '#f0ead8', 'bone'); }
    if (!sp.hoof) for (const n of ['FL', 'FR', 'BL', 'BR']) { const f = r[n + '3']; const L = lg; for (let k = -1; k <= 1; k++) R.cone(n + '3', [f[0] + k * L * 0.45, f[1] + L * 0.05, f[2] + L * 1.9], L * 0.12, L * 0.45, Q(Math.PI / 2 + 0.4, 0, 0), '#2a241e', 'bone'); }
    if (sp.antlers) for (const sx of [-1, 1]) {
      // a stag's rack: a beam sweeping up, out and back, with tines rising forward from it
      const base = [sx * hr * 0.32, hd[1] + hr * 0.7, hd[2] - hr * 0.15];
      R.ell('head', base, [hr * 0.12, hr * 0.08, hr * 0.12], '#5a4632', 'horn');
      let p = base, d = new THREE.Vector3(sx * 0.6, 1, -0.35).normalize();
      const AC = '#d8c8a8';
      for (let k = 0; k < 6; k++) {
        const len = k < 2 ? 0.13 : 0.11; const q2 = [p[0] + d.x * len, p[1] + d.y * len, p[2] + d.z * len]; const rr = 0.02 - k * 0.0022;
        R.seg('head', p, q2, rr, rr * 0.85, k < 2 ? shade(AC, -0.25) : AC, 'horn');
        if (k >= 1 && k <= 4) { const tl = 0.15 - (k - 1) * 0.015; const td = new THREE.Vector3(sx * 0.1, 0.9, 0.55 - k * 0.12).normalize(); R.seg('head', q2, [q2[0] + td.x * tl, q2[1] + td.y * tl, q2[2] + td.z * tl], rr * 0.8, rr * 0.25, AC, 'horn'); }
        p = q2; d.add(new THREE.Vector3(sx * 0.04, -0.16, -0.06)).normalize();
      }
    }
    if (sp.ribs) for (let k = 0; k < 6; k++) for (const sx of [-1, 1]) { // bare ribs showing through the mange
      const z = ch[2] + br * 0.35 - k * br * 0.28; const y0 = ch[1] + br * 0.55 - k * br * 0.05; const w = br * cw * (0.92 - k * 0.04);
      R.seg('chest', [sx * w * 0.55, y0, z], [sx * w * 1.02, y0 - br * 0.5, z + br * 0.04], br * 0.045, br * 0.04, '#d8d0b0', 'bone');
      R.seg('chest', [sx * w * 1.02, y0 - br * 0.5, z + br * 0.04], [sx * w * 0.8, y0 - br * 1.0, z + br * 0.1], br * 0.04, br * 0.03, '#c8c0a0', 'bone');
    }
    if (sp.spines) for (let k = 0; k < 9; k++) { const u = k / 8; const z = ch[2] + br * 0.2 - (ch[2] - pv[2] + br * 0.2) * u; R.cone(u < 0.45 ? 'chest' : 'pelvis', [0, rt[1] + br * (1.0 - u * 0.35), z], br * 0.07, br * (0.45 - Math.abs(u - 0.4) * 0.4), Q(-0.5, 0, 0), '#d8d0b0', 'bone'); }
    if (sp.sores) for (let k = 0; k < 9; k++) { const a = k * 2.4, z = ch[2] - span * 0.9 * (k / 8); R.ell(k < 4 ? 'chest' : k < 7 ? 'root' : 'pelvis', [Math.cos(a) * br * 0.55, rt[1] + Math.sin(a) * br * 0.45 + br * 0.15, z], [br * 0.08, br * 0.08, br * 0.08], '#b8ff40', 'glow'); }
    if (sp.hackles) for (let k = 0; k < 10; k++) { const u = k / 9; R.cone(u < 0.5 ? 'neck' : 'chest', [0, ch[1] + br * (1.25 - u * 0.15), ch[2] + br * (0.75 - u * 0.9)], br * 0.06, br * 0.38, Q(-0.6, 0, 0), shade(c, -0.35), 'shell'); }
  });
}
// two eyes set into the side of the skull, looking forward and out
function quadEyes(R, hd, hr, sp, ex, ey, ez, size = 1) {
  for (const sx of [-1, 1]) { const p = [sx * ex, hd[1] + ey, hd[2] + ez]; R.ell('head', p, [hr * 0.11 * size, hr * 0.1 * size, hr * 0.08 * size], '#120c08', 'gem', Q(0, sx * 0.6, 0)); R.ell('head', [p[0] + sx * hr * 0.012, p[1], p[2] + hr * 0.03], [hr * 0.07 * size, hr * 0.07 * size, hr * 0.05 * size], sp.eye || '#2a1a10', sp.glowEye ? 'glow' : 'gem', Q(0, sx * 0.6, 0)); }
}
// a bear: a great hump of shoulder muscle, a long, low skull with a dished face, small round ears, thick
// forearms ending in long claws, and flat-footed hind feet
function bearAnatomy(R, sp, c, mat, belly, dark) {
  const r = R.rest, br = sp.br, hr = sp.hr, ch = r.chest, pv = r.pelvis, rt = r.root, hd = r.head, span = Math.abs(ch[2] - pv[2]); const L = sp.leg * 1.2;
  R.ell('chest', [0, ch[1] + br * 0.05, ch[2]], [br * 0.92, br * 1.05, br * 1.05], c, mat, null, 'root', 0.25);
  R.ell('chest', [0, ch[1] + br * 0.82, ch[2] - br * 0.25], [br * 0.68, br * 0.5, br * 0.78], shade(c, -0.05), mat, Q(-0.15, 0, 0)); // the hump
  R.ell('root', [0, rt[1] - br * 0.08, rt[2]], [br * 0.9, br * 0.88, span * 0.58], c, mat);
  R.ell('root', [0, rt[1] - br * 0.62, rt[2] + br * 0.1], [br * 0.6, br * 0.35, span * 0.45], shade(c, -0.08), mat); // shaggy belly fringe
  R.ell('pelvis', [0, pv[1] + br * 0.02, pv[2] - br * 0.05], [br * 0.88, br * 0.9, br * 0.9], c, mat, null, 'root', 0.25);
  for (const sx of [1, -1]) { R.ell(sx > 0 ? 'FL1' : 'FR1', [sx * br * 0.55, ch[1] + br * 0.2, ch[2] + br * 0.1], [br * 0.36, br * 0.7, br * 0.55], c, mat, Q(0.3, 0, 0), 'chest', 0.6); R.ell(sx > 0 ? 'BL1' : 'BR1', [sx * br * 0.5, pv[1] - br * 0.05, pv[2]], [br * 0.42, br * 0.8, br * 0.62], c, mat, null, 'pelvis', 0.5); }
  R.seg('neck', [0, ch[1] + br * 0.35, ch[2] + br * 0.5], [0, hd[1] - hr * 0.05, hd[2] - hr * 0.5], br * 0.72, hr * 0.85, c, mat, 'chest', 0.35);
  R.ell('head', [0, hd[1] + hr * 0.05, hd[2] - hr * 0.1], [hr * 0.88, hr * 0.78, hr * 0.95], c, mat); // the broad skull
  R.ell('head', [0, hd[1] + hr * 0.42, hd[2] + hr * 0.12], [hr * 0.6, hr * 0.32, hr * 0.5], c, mat); // the domed forehead
  for (const sx of [1, -1]) R.ell('head', [sx * hr * 0.62, hd[1] - hr * 0.12, hd[2] - hr * 0.15], [hr * 0.4, hr * 0.52, hr * 0.55], shade(c, 0.04), mat); // heavy cheeks
  const tipZ = hd[2] + hr * 0.75 + sp.sn, tipY = hd[1] - hr * 0.22;
  R.seg('head', [0, hd[1] - hr * 0.05, hd[2] + hr * 0.5], [0, tipY + hr * 0.05, tipZ], hr * 0.5, hr * 0.33, shade(c, 0.12), mat); // the muzzle
  R.seg('jaw', [0, r.jaw[1] + hr * 0.05, hd[2] + hr * 0.2], [0, tipY - hr * 0.2, tipZ - hr * 0.18], hr * 0.4, hr * 0.22, shade(c, 0.15), mat);
  R.ell('head', [0, tipY + hr * 0.1, tipZ + hr * 0.04], [hr * 0.24, hr * 0.17, hr * 0.13], '#1a1414', 'skin'); // nose
  for (const sx of [1, -1]) R.ell('head', [sx * hr * 0.62, hd[1] + hr * 0.68, hd[2] - hr * 0.3], [hr * 0.2, hr * 0.19, hr * 0.1], dark, mat, Q(0, sx * 0.3, 0)); // small round ears
  for (const n of ['FL', 'FR', 'BL', 'BR']) {
    const a = r[n + '1'], b = r[n + '2'], f = r[n + '3']; const back = n[0] === 'B';
    if (back) { const heel = [f[0], f[1] + L * 0.7, f[2] - L * 0.7]; R.seg(n + '1', [a[0], a[1] + br * 0.2, a[2]], b, L * 2.1, L * 1.25, c, mat, 'pelvis', 0); R.seg(n + '2', b, heel, L * 1.2, L * 0.9, c, mat); R.ell(n + '3', [f[0], f[1] + L * 0.35, f[2] + L * 0.35], [L * 0.95, L * 0.48, L * 1.7], shade(c, -0.1), mat); }
    else { R.seg(n + '1', [a[0], a[1] + br * 0.25, a[2]], b, L * 1.9, L * 1.4, c, mat, 'chest', 0); R.seg(n + '2', b, [f[0], f[1] + L * 0.8, f[2]], L * 1.35, L * 1.15, c, mat); R.ell(n + '3', [f[0], f[1] + L * 0.42, f[2] + L * 0.55], [L * 1.15, L * 0.55, L * 1.25], shade(c, -0.1), mat); }
  }
  R.ell('pelvis', [0, pv[1] + br * 0.45, pv[2] - br * 0.95], [br * 0.17, br * 0.15, br * 0.15], c, mat); // a stub of a tail
  R.hard(() => {
    quadEyes(R, hd, hr, sp, hr * 0.42, hr * 0.22, hr * 0.62, 0.9);
    for (const sx of [-1, 1]) R.cone('jaw', [sx * hr * 0.18, tipY - hr * 0.08, tipZ - hr * 0.3], hr * 0.05, hr * 0.2, null, '#f0ead8', 'bone');
    for (const n of ['FL', 'FR', 'BL', 'BR']) { const f = r[n + '3']; const back = n[0] === 'B'; const cl = back ? 0.55 : 1.0;
      for (let k = -2; k <= 2; k++) { const x = f[0] + k * L * 0.36, z = f[2] + L * (back ? 2.0 : 1.7) - Math.abs(k) * L * 0.15;
        R.cone(n + '3', [x, f[1] + L * 0.32, z], L * 0.13, L * cl, Q(Math.PI / 2 + 0.35, 0, 0), '#e8dcc8', 'bone'); R.cone(n + '3', [x, f[1] + L * 0.1, z + L * cl * 0.45], L * 0.08, L * cl * 0.45, Q(Math.PI / 2 + 1.1, 0, 0), '#d8ccb8', 'bone'); } }
  });
}
// a boar: a wedge, deep at the shoulders, narrow over the hips; a long head carried low ending in a flat disc,
// tusks curling up out of the lips, a crest of bristles down the spine, thin legs on cloven hooves
function boarAnatomy(R, sp, c, mat, belly, dark) {
  const r = R.rest, br = sp.br, hr = sp.hr, ch = r.chest, pv = r.pelvis, rt = r.root, hd = r.head, span = Math.abs(ch[2] - pv[2]); const L = sp.leg;
  R.ell('chest', [0, ch[1] + br * 0.08, ch[2]], [br * 0.82, br * 1.12, br * 1.0], c, mat, null, 'root', 0.25);
  R.ell('chest', [0, ch[1] + br * 0.72, ch[2] - br * 0.1], [br * 0.55, br * 0.55, br * 0.9], dark, mat); // high withers
  R.seg('root', [0, ch[1] + br * 0.1, ch[2] - br * 0.4], [0, pv[1] + br * 0.05, pv[2] + br * 0.3], br * 0.85, br * 0.62, c, mat);
  R.ell('pelvis', [0, pv[1] + br * 0.0, pv[2] - br * 0.05], [br * 0.6, br * 0.72, br * 0.75], c, mat, Q(0.2, 0, 0), 'root', 0.25);
  R.ell('root', [0, rt[1] - br * 0.42, rt[2] + br * 0.2], [br * 0.55, br * 0.4, span * 0.5], belly, mat);
  for (const sx of [1, -1]) { R.ell(sx > 0 ? 'FL1' : 'FR1', [sx * br * 0.5, ch[1] + br * 0.05, ch[2] + br * 0.15], [br * 0.3, br * 0.62, br * 0.5], c, mat, Q(0.3, 0, 0), 'chest', 0.6); R.ell(sx > 0 ? 'BL1' : 'BR1', [sx * br * 0.38, pv[1] - br * 0.1, pv[2] - br * 0.05], [br * 0.28, br * 0.6, br * 0.48], c, mat, null, 'pelvis', 0.5); }
  R.seg('neck', [0, ch[1] + br * 0.25, ch[2] + br * 0.55], [0, hd[1] + hr * 0.1, hd[2] - hr * 0.5], br * 0.82, hr * 0.95, c, mat, 'chest', 0.4);
  R.ell('head', [0, hd[1] + hr * 0.1, hd[2] - hr * 0.1], [hr * 0.78, hr * 0.85, hr * 1.0], c, mat);
  for (const sx of [1, -1]) R.ell('head', [sx * hr * 0.55, hd[1] - hr * 0.25, hd[2] + hr * 0.1], [hr * 0.35, hr * 0.42, hr * 0.6], shade(c, -0.05), mat); // jowls
  const tipZ = hd[2] + hr * 0.5 + sp.sn * 0.95, tipY = hd[1] - hr * 0.3;
  R.seg('head', [0, hd[1] + hr * 0.15, hd[2] + hr * 0.4], [0, tipY + hr * 0.08, tipZ - hr * 0.05], hr * 0.55, hr * 0.3, shade(c, -0.04), mat); // the long, sloping snout
  R.seg('jaw', [0, r.jaw[1] - hr * 0.1, hd[2] + hr * 0.25], [0, tipY - hr * 0.12, tipZ - hr * 0.3], hr * 0.38, hr * 0.2, belly, mat);
  R.ell('head', [0, tipY + hr * 0.06, tipZ + hr * 0.01], [hr * 0.31, hr * 0.27, hr * 0.08], '#7a4a42', 'skin'); // the disc
  for (const sx of [1, -1]) R.ell('head', [sx * hr * 0.42, hd[1] + hr * 0.82, hd[2] - hr * 0.4], [hr * 0.17, hr * 0.32, hr * 0.07], dark, mat, Q(-0.35, 0, -sx * 0.35)); // pricked ears
  for (const n of ['FL', 'FR', 'BL', 'BR']) { const a = r[n + '1'], b = r[n + '2'], f = r[n + '3']; const back = n[0] === 'B';
    R.seg(n + '1', [a[0], a[1] + br * 0.15, a[2]], b, L * (back ? 2.6 : 2.4), L * 1.25, c, mat, back ? 'pelvis' : 'chest', 0);
    R.seg(n + '2', b, [f[0], f[1] + L * 1.4, f[2] + L * 0.2], L * 1.1, L * 0.8, shade(c, -0.1), mat); }
  R.seg('tail1', [0, pv[1] + br * 0.4, pv[2] - br * 0.7], r.tail2, sp.tailR * 1.4, sp.tailR, c, mat, 'pelvis', 0.3);
  R.ell('tail2', [0, r.tail2[1] - sp.tail * 0.08, r.tail2[2] - sp.tail * 0.12], [sp.tailR * 1.8, sp.tailR * 3.2, sp.tailR * 1.8], dark, mat, Q(0.5, 0, 0)); // the tuft
  R.hard(() => {
    quadEyes(R, hd, hr, sp, hr * 0.5, hr * 0.32, hr * 0.42, 0.75);
    for (const sx of [-1, 1]) { let p = [sx * hr * 0.28, tipY - hr * 0.08, tipZ - hr * 0.4]; let d = [sx * 0.6, 0.2, 0.75]; let rr = hr * 0.1;
      for (let k = 0; k < 4; k++) { const ln = Math.hypot(...d); const q = [p[0] + d[0] / ln * hr * 0.22, p[1] + d[1] / ln * hr * 0.22, p[2] + d[2] / ln * hr * 0.22]; R.seg('jaw', p, q, rr, rr * 0.72, '#f0e6d0', 'bone'); p = q; rr *= 0.72; d = [d[0] * 0.8, d[1] + 0.55, d[2] - 0.35]; } }
    for (let k = 0; k < 22; k++) { const u = k / 21; const z = hd[2] - hr * 0.5 + (pv[2] - (hd[2] - hr * 0.5)) * u; const bone = u < 0.12 ? 'neck' : u < 0.55 ? 'chest' : 'pelvis';
      const y = u < 0.25 ? hd[1] + hr * 0.85 + (ch[1] + br * 1.2 - hd[1] - hr * 0.85) * (u / 0.25) : ch[1] + br * 1.22 - (ch[1] + br * 1.22 - pv[1] - br * 0.7) * ((u - 0.25) / 0.75);
      for (const sx of [-1, 1]) R.cone(bone, [sx * br * 0.05, y, z + sx * 0.012], br * 0.035, br * (0.38 - u * 0.22), Q(-0.45, 0, -sx * 0.2), shade(dark, -0.2), 'bone'); }
    for (const n of ['FL', 'FR', 'BL', 'BR']) { const f = r[n + '3']; for (const sx of [-1, 1]) { R.cone(n + '3', [f[0] + sx * L * 0.42, f[1] + L * 0.65, f[2] + L * 0.35], L * 0.5, L * 1.4, Q(0.35, 0, 0), '#221c18', 'bone'); R.ell(n + '3', [f[0] + sx * L * 0.55, f[1] + L * 1.4, f[2] - L * 0.45], [L * 0.22, L * 0.3, L * 0.22], '#221c18', 'bone'); } }
  });
}
// a rabbit: a round body over big folded haunches, short forelegs, a round head with long ears and a cotton tail
function rabbitAnatomy(R, sp, c, mat, belly, dark) {
  const r = R.rest, br = sp.br, hr = sp.hr, ch = r.chest, pv = r.pelvis, hd = r.head; const L = sp.leg;
  R.ell('chest', [0, ch[1] - br * 0.1, ch[2] - br * 0.1], [br * 0.75, br * 0.85, br * 0.9], c, mat, null, 'root', 0.3);
  R.ell('root', [0, r.root[1] - br * 0.05, -br * 0.3], [br * 0.9, br * 0.95, br * 1.1], c, mat);
  R.ell('pelvis', [0, pv[1] + br * 0.0, pv[2] - br * 0.3], [br * 0.95, br * 1.0, br * 0.95], c, mat, null, 'root', 0.3);
  R.ell('root', [0, r.root[1] - br * 0.55, -br * 0.1], [br * 0.6, br * 0.4, br * 1.0], belly, mat);
  for (const sx of [1, -1]) R.ell(sx > 0 ? 'BL1' : 'BR1', [sx * br * 0.62, pv[1] - br * 0.35, pv[2] - br * 0.1], [br * 0.38, br * 0.62, br * 0.75], c, mat, Q(-0.3, 0, 0), 'pelvis', 0.3); // haunches
  R.seg('neck', [0, ch[1] + br * 0.2, ch[2] + br * 0.3], [0, hd[1] - hr * 0.2, hd[2] - hr * 0.3], br * 0.55, hr * 0.8, c, mat, 'chest', 0.3);
  R.ell('head', [0, hd[1], hd[2]], [hr * 0.85, hr * 0.9, hr * 1.05], c, mat);
  for (const sx of [1, -1]) R.ell('head', [sx * hr * 0.32, hd[1] - hr * 0.35, hd[2] + hr * 0.62], [hr * 0.32, hr * 0.3, hr * 0.32], belly, mat); // whisker pads
  R.ell('jaw', [0, hd[1] - hr * 0.55, hd[2] + hr * 0.45], [hr * 0.3, hr * 0.2, hr * 0.3], belly, mat);
  R.ell('head', [0, hd[1] - hr * 0.12, hd[2] + hr * 0.98], [hr * 0.15, hr * 0.11, hr * 0.08], '#c08080', 'skin'); // nose
  for (const sx of [1, -1]) { const e = sx > 0 ? 'earL' : 'earR'; const e0 = r[e]; R.ell(e, [e0[0], e0[1] + hr * 1.0, e0[2] - hr * 0.2], [hr * 0.3, hr * 1.05, hr * 0.14], c, mat, Q(-0.25, 0, -sx * 0.12)); R.hard(() => R.ell(e, [e0[0], e0[1] + hr * 1.0, e0[2] - hr * 0.08], [hr * 0.18, hr * 0.85, hr * 0.06], '#e0b0a8', 'skin', Q(-0.25, 0, -sx * 0.12))); }
  for (const n of ['FL', 'FR', 'BL', 'BR']) { const a = r[n + '1'], b = r[n + '2'], f = r[n + '3']; const back = n[0] === 'B';
    if (back) R.ell(n + '3', [f[0], f[1] + L * 0.8, f[2] + L * 2.5], [L * 1.6, L * 1.0, L * 5.5], shade(c, 0.1), mat); // long hind feet
    else { R.seg(n + '1', [a[0], a[1] - br * 0.2, a[2]], b, L * 1.6, L * 1.3, c, mat, 'chest', 0); R.seg(n + '2', b, [f[0], f[1] + L, f[2] + L], L * 1.3, L * 1.1, belly, mat); R.ell(n + '3', [f[0], f[1] + L * 0.6, f[2] + L * 1.2], [L * 1.3, L * 0.8, L * 1.8], belly, mat); } }
  R.ell('tail1', [0, pv[1] + br * 0.35, pv[2] - br * 1.15], [br * 0.42, br * 0.42, br * 0.38], '#f4f0ea', mat, null, 'pelvis', 0.3); // the cotton tail
  R.hard(() => quadEyes(R, hd, hr, sp, hr * 0.62, hr * 0.15, hr * 0.48, 1.5));
}

// the coat: darker along the back, a pale belly and throat, darker feet, broad tonal waves (no speckle)
function paintCoat(R, sp, kind) {
  const r = R.rest;
  return (g) => {
    const P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color;
    const hz = r.head[2], ch = r.chest[2], pv = r.pelvis[2]; const legH = r.FL1[1];
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ny = N.getY(i); let k = 1 + ny * 0.1;
      const onBody = z < ch + sp.br * 0.8 && z > pv - sp.br * 1.2;
      if (onBody && ny > 0.35) k *= 1 - (kind === 'deer' ? 0.12 : 0.32) * clamp((ny - 0.35) * 2, 0, 1); // the saddle
      if (ny < -0.3 && y > legH * 0.6) k *= 1 + (kind === 'deer' ? 0.6 : 0.35) * clamp(-ny - 0.3, 0, 1); // pale belly and throat
      if (z > hz + sp.hr * 0.45 && y < r.head[1]) k *= sp.disc ? 0.85 : 1.25; // muzzle
      if (y < legH * 0.45 && kind !== 'rabbit') k *= 0.62 + 0.38 * clamp(y / (legH * 0.45), 0, 1); // darker socks and feet
      k *= 1 + 0.07 * Math.sin(x * 4.1 + z * 2.3 + 1.3) * Math.sin(y * 3.7 - z * 1.9) + 0.05 * Math.sin(z * 5.3 + y * 2.9);
      let cr = C.getX(i) * k, cg = C.getY(i) * k, cb = C.getZ(i) * k;
      if (kind === 'mirehound') { // mangy patches of grey-green skin and dark rot
        const m = Math.sin(x * 23 + z * 7) * Math.sin(y * 19 - z * 11) + Math.sin(z * 31 + x * 5) * 0.4;
        if (m > 0.55) { cr = cr * 0.6 + 0.12; cg = cg * 0.7 + 0.13; cb = cb * 0.6 + 0.08; }
        if (m < -0.75) { cr *= 0.45; cg *= 0.5; cb *= 0.4; }
      }
      if (kind === 'deer' && onBody && ny > -0.2 && Math.abs(x) > sp.br * 0.25) { // a fawn's faint dapples along the flanks
        const s = Math.sin(z * 38) * Math.sin(y * 38 + Math.abs(x) * 8); if (s > 0.86 && y > legH + sp.br * 0.3) { cr += (0.9 - cr) * 0.35; cg += (0.84 - cg) * 0.35; cb += (0.72 - cb) * 0.35; }
      }
      C.setXYZ(i, cr, cg, cb);
    }
  };
}

export function buildQuad(kind, color) {
  const sp = QUAD[kind] || QUAD.wolf; const R = new Rig(quadRig(sp));
  R.organic = true; R.k = sp.br * 0.095; R.cell = clamp(sp.L / 62, 0.006, 0.07);
  if (sp.glowy) R.organic = true;
  R.paint = sp.glowy ? null : paintCoat(R, sp, kind);
  const mat = sp.glowy ? 'skin' : 'fur'; const c = color;
  const belly = shade(c, kind === 'deer' ? 0.45 : 0.18), dark = shade(c, -0.3);
  quadAnatomy(R, sp, kind, c, mat, belly, dark);
  const geom = R.geometry();
  return { R, geom, body: R.body, furLen: mat === 'fur' ? sp.fur : 0, sp };
}
export function quadInstance(tpl) {
  const inst = instance(tpl.R, tpl.geom);
  if (tpl.furLen) addFur(inst, tpl.body, tpl.furLen);
  return Object.assign(inst, { type: 'quad', sp: tpl.sp, t: Math.random() * 10, phase: Math.random() });
}

// gait tables (leg phase offsets FL, FR, BL, BR and how long each foot stays down): a lateral-sequence walk,
// a diagonal trot and a rotary gallop, blended by speed so the gaits melt into each other; rabbits bound
const GAITS = { walk: { off: [0.25, 0.75, 0, 0.5], duty: 0.65, stride: 0.85 }, trot: { off: [0, 0.5, 0.5, 0], duty: 0.45, stride: 1.25 }, gallop: { off: [0.1, 0.2, 0.6, 0.7], duty: 0.3, stride: 2.1 }, bound: { off: [0.5, 0.55, 0, 0.05], duty: 0.35, stride: 1.6 } };

// st: { dist, wind 0..1, atk 0..1, hurt {t, fx, fz, mag}, stun, dead, deadT, side, charge, look }
export function animQuad(rig, st, dt) {
  const B = rig.bones, sp = rig.sp, R0 = rig.rest;
  const t = (rig.t += dt);
  // speed in body lengths per second picks the gait; the cycle advances by distance so feet don't slide
  const v = dt > 0 ? (st.dist || 0) / dt : 0; rig.vS = (rig.vS || 0) + (v - (rig.vS || 0)) * Math.min(1, dt * 6);
  const rel = rig.vS / sp.L; const heavy = sp.hump || rig.kind === 'boar';
  const bound = !!sp.bound;
  const gt = bound ? 1 : clamp((rel - 1.0) / 0.8, 0, 1), gg = bound ? 1 : clamp((rel - 2.6) / 1.2, 0, 1) * (heavy ? 0.6 : 1);
  const G2 = bound ? { walk: GAITS.bound, trot: GAITS.bound, gallop: GAITS.bound } : GAITS;
  const mix = (k) => G2.walk[k] * (1 - gt) + G2.trot[k] * gt * (1 - gg) + G2.gallop[k] * gt * gg;
  const stride = sp.L * mix('stride') * (bound ? 1 : 1), duty = mix('duty');
  rig.phase = ((rig.phase || 0) + (st.dist || 0) / stride) % 1; const ph = rig.phase;
  rig.mv = (rig.mv || 0) + (((st.dist || 0) > 0.0005 ? 1 : 0) - (rig.mv || 0)) * Math.min(1, dt * 7); const m = rig.mv;
  for (const k in B) B[k].rotation.set(0, 0, 0);
  B.root.position.set(R0.root[0], R0.root[1], R0.root[2]);
  const reach = (0.32 + 0.22 * gt + 0.18 * gg) * m;
  const offs = ['FL', 'FR', 'BL', 'BR'];
  offs.forEach((n, i) => {
    const off = G2.walk.off[i] * (1 - gt) + G2.trot.off[i] * gt * (1 - gg) + G2.gallop.off[i] * gt * gg;
    const u = (ph + off) % 1; let sw, lift = 0;
    if (u < duty) sw = 1 - 2 * (u / duty);
    else { const s1 = (u - duty) / (1 - duty); sw = -1 + 2 * ease(s1); lift = Math.sin(s1 * Math.PI); }
    const front = n[0] === 'F';
    B[n + '1'].rotation.x = -sw * reach;
    B[n + '2'].rotation.x = (front ? -1 : 1) * (lift * (0.75 + 0.4 * gg) + 0.08) * m;
    B[n + '3'].rotation.x = (front ? 1 : -1) * lift * 0.5 * m - B[n + '1'].rotation.x * 0.3;
  });
  // the body: a bob twice a stride (once at the gallop), a flexing spine at speed, a rolling heavy gait
  const bob = bound ? Math.max(0, Math.sin(ph * Math.PI * 2 + 0.6)) * 0.5 : gg > 0.3 ? Math.sin(ph * Math.PI * 2) * 0.06 : Math.abs(Math.sin(ph * Math.PI * 2)) * 0.03;
  B.root.position.y += bob * m * sp.H * (heavy ? 0.7 : 1);
  const flex = Math.sin(ph * Math.PI * 2) * (heavy ? 0.05 : bound ? 0.3 : 0.17) * gg * m;
  B.chest.rotation.x = flex + Math.sin(ph * Math.PI * 4) * 0.02 * m; B.pelvis.rotation.x = -flex;
  if (heavy) { B.chest.rotation.z = Math.sin(ph * Math.PI * 2) * 0.1 * m; B.pelvis.rotation.z = -Math.sin(ph * Math.PI * 2) * 0.06 * m; }
  if (bound) B.root.rotation.x = -Math.cos(ph * Math.PI * 2 + 0.6) * 0.25 * m;
  // breathing (faster after running), and the head held steady against the body's motion
  rig.puff = Math.max(0, (rig.puff || 0) + (m > 0.5 && gg > 0.2 ? dt * 0.4 : -dt * 0.08)); const pant = Math.min(1, rig.puff);
  const breathe = Math.sin(t * (1.6 + pant * 5) + (rig.seed || 0)) * (0.015 + pant * 0.012);
  B.chest.rotation.x += breathe; B.root.position.y += breathe * sp.br * 0.3;
  B.neck.rotation.x = -B.chest.rotation.x * 0.8 + (sp.dog ? 0.12 * gt : 0);
  if (heavy) B.neck.rotation.z = -B.chest.rotation.z * 1.2;
  if (B.jaw && sp.dog) B.jaw.rotation.x = pant * (0.18 + Math.sin(t * 7) * 0.06) * (1 - m * 0.5);
  // idles: look around, sniff the ground, flick the ears, wag
  const idle = 1 - m; const sd = rig.seed || 0;
  const sniff = idle * clamp(Math.sin(t * 0.21 + sd) * 3 - 2, 0, 1) * (st.alert ? 0 : 1);
  B.head.rotation.y = Math.sin(t * 0.55 + sd) * 0.35 * idle * (1 - sniff) * (st.alert ? 0.3 : 1);
  B.neck.rotation.x += sniff * 0.55; B.head.rotation.x = sniff * (0.25 + Math.sin(t * 9) * 0.06);
  if (rig.kind === 'deer') { B.neck.rotation.x += sniff * 0.6; } // grazing
  if (rig.kind === 'rabbit') { B.head.rotation.x += Math.sin(t * 23) * 0.02 * idle; const up = idle * clamp(Math.sin(t * 0.3 + sd) * 4 - 3, 0, 1); B.root.rotation.x -= up * 0.6; B.root.position.y += up * sp.H * 0.4; B.FL1.rotation.x += up * 0.6; B.FR1.rotation.x += up * 0.6; } // sitting up to look
  if (B.earL) { const fl = Math.sin(t * 0.9 + sd * 2) > 0.95 ? Math.sin(t * 30) * 0.3 : 0; B.earL.rotation.z = -0.1 + fl; B.earR.rotation.z = 0.1 - fl * 0.5; B.earL.rotation.x = B.earR.rotation.x = -0.3 * m; }
  if (sp.tail > 0.1 && rig.kind !== 'deer') {
    const wag = sp.dog ? 1.5 : 1.0;
    B.tail1.rotation.x = 0.3 - m * 0.25 - gg * 0.2 + (st.wind ? -0.3 : 0); const w = t * wag * Math.PI * 2 + ph * 6;
    B.tail1.rotation.y = Math.sin(w) * (0.22 + 0.1 * idle); B.tail2.rotation.y = Math.sin(w - 0.8) * 0.3; B.tail3.rotation.y = Math.sin(w - 1.6) * 0.38;
  } else if (rig.kind === 'deer') B.tail1.rotation.x = st.alert || m > 0.5 ? -0.9 : 0; // the white flag goes up when it bolts
  // attacks: a clear wind-up the player can read (st.wind), the lunge as the blow lands (st.atk), a recovery
  const style = sp.style || 'bite'; const w = ease(st.wind || 0); const a = st.atk || 0;
  const hit = a > 0 && a < 1 ? (a < 0.15 ? ease(a / 0.15) : 1 - ease((a - 0.15) / 0.85) * 1.08 + Math.sin(clamp((a - 0.15) / 0.85, 0, 1) * Math.PI) * 0.08) : 0;
  const L = sp.L, H = sp.H; const jaw = (o) => { if (B.jaw) B.jaw.rotation.x = Math.max(B.jaw.rotation.x, o); };
  if (st.charge) { // a full-tilt charge: head down, ears back, jaws open
    B.neck.rotation.x += style === 'gore' ? 0.5 : 0.25; B.head.rotation.x += 0.15; jaw(style === 'gore' ? 0 : 0.6); if (B.earL) { B.earL.rotation.x = B.earR.rotation.x = -0.8; }
  } else if (w > 0 || hit > 0) {
    if (style === 'leap' || style === 'bite') { // crouch, front low, snarling; then spring forward and bite, shaking the head
      const tr = Math.sin(t * 40) * 0.015 * w; // the tremble of a coiled spring
      B.root.position.y -= w * H * 0.12 * (1 - hit); B.root.position.z -= w * L * 0.06 * (1 - hit); B.chest.rotation.x += w * 0.16 * (1 - hit) + tr; B.FL2.rotation.x -= w * 0.45; B.FR2.rotation.x -= w * 0.45; B.BL2.rotation.x += w * 0.4; B.BR2.rotation.x += w * 0.4; B.BL1.rotation.x -= w * 0.25; B.BR1.rotation.x -= w * 0.25; B.neck.rotation.x -= w * 0.2;
      B.head.rotation.x -= w * 0.15; jaw(Math.max(w * 0.55, hit * 0.8));
      B.root.position.z += hit * L * (style === 'leap' ? 0.35 : 0.18); B.root.position.y += hit * H * (style === 'leap' ? 0.18 : 0.05);
      B.FL1.rotation.x -= hit * 0.6; B.FR1.rotation.x -= hit * 0.5; B.BL1.rotation.x += hit * 0.4; B.BR1.rotation.x += hit * 0.4; B.chest.rotation.x -= hit * 0.14; B.neck.rotation.x += hit * 0.15;
      if (a > 0.15 && a < 0.6) B.head.rotation.z = Math.sin((a - 0.15) * 40) * 0.25 * (1 - (a - 0.15) / 0.45);
    } else if (style === 'rear') { // rear onto the hind legs, then slam down with the forepaws
      const up = Math.max(w, hit * (1 - clamp((a - 0.1) / 0.35, 0, 1)));
      B.root.rotation.x -= up * 0.75; B.root.position.y += up * H * 0.35; B.root.position.z -= up * L * 0.1;
      B.FL1.rotation.x -= up * 1.4 + Math.sin(t * 6) * 0.1 * w; B.FR1.rotation.x -= up * 1.1; B.FL2.rotation.x -= up * 0.8; B.FR2.rotation.x -= up * 0.7;
      B.BL1.rotation.x += up * 0.7; B.BR1.rotation.x += up * 0.7; B.neck.rotation.x -= up * 0.35; jaw(up * 0.7);
      if (a > 0 && a < 0.35) { B.FL1.rotation.x += 0.6 * Math.sin(a / 0.35 * Math.PI); B.root.position.z += Math.sin(a / 0.35 * Math.PI) * L * 0.12; }
    } else if (style === 'gore') { // head down, pawing the ground, then a toss of the tusks
      B.neck.rotation.x += w * 0.45; B.head.rotation.x += w * 0.25; B.root.position.z -= w * L * 0.06; B.BL1.rotation.x -= w * 0.3; B.BR1.rotation.x -= w * 0.3;
      B.FR1.rotation.x += w * Math.max(0, Math.sin(t * 9)) * 0.6; B.FR2.rotation.x -= w * Math.max(0, Math.sin(t * 9)) * 0.6; // pawing
      B.root.position.z += hit * L * 0.3; B.neck.rotation.x += 0.45 * (1 - hit) * w - hit * 0.7 * Math.sin(clamp(a / 0.4, 0, 1) * Math.PI); B.head.rotation.x -= hit * 0.4;
    }
  }
  // a blow taken: the body flinches away from it and settles back (stronger for bigger hits)
  if (st.hurt && !st.dead) {
    const h = st.hurt; const k = Math.sin(Math.min(1, h.t / 0.06) * Math.PI * 0.5) * decay(Math.max(0, h.t - 0.06), 7) * Math.min(1.6, 0.45 + h.mag * 6);
    B.root.position.x += h.fx * L * 0.08 * k; B.root.position.z += h.fz * L * 0.08 * k; B.root.rotation.z -= h.fx * 0.16 * k; B.root.rotation.x += h.fz * 0.1 * k;
    B.neck.rotation.x -= 0.35 * k; B.head.rotation.y += h.fx * 0.4 * k; B.head.rotation.x -= 0.2 * k; jaw(0.5 * k);
    B.FL1.rotation.x += h.fz * 0.3 * k; B.FR1.rotation.x += h.fz * 0.3 * k; B.root.position.y -= H * 0.05 * k;
    if (B.earL) { B.earL.rotation.x -= 0.6 * k; B.earR.rotation.x -= 0.6 * k; }
  }
  if (st.stun) { B.head.rotation.z = Math.sin(t * 3) * 0.25; B.neck.rotation.x += 0.25; B.root.position.y -= H * 0.05; B.root.rotation.z += Math.sin(t * 1.5) * 0.06; }
  // dying: thrown onto its side in the direction of the blow, legs go limp, a last kick, then still
  if (st.dead) {
    const dT = st.deadT || 0; const d0 = clamp(dT / 0.55, 0, 1);
    const d = d0 < 1 ? ease(d0) * (1 + Math.sin(d0 * Math.PI) * 0.12) : 1; // tips past and settles: a little bounce
    const side = st.side || 1; const kick = dT > 0.6 && dT < 1.4 ? Math.sin((dT - 0.6) / 0.8 * Math.PI * 2) * 0.35 * (1 - (dT - 0.6) / 0.8) : 0;
    const legH = R0.root[1];
    B.root.rotation.z = -side * (Math.PI / 2) * 0.92 * d; B.root.rotation.x = 0;
    B.root.position.y = legH + (sp.br * 0.95 - legH) * d + Math.sin(d0 * Math.PI) * sp.H * 0.12;
    B.root.position.x = side * legH * 0.25 * d;
    offs.forEach((n, i) => { B[n + '1'].rotation.x = (n[0] === 'F' ? -0.45 : 0.4) * d + (i >= 2 ? kick * (i === 2 ? 1 : -0.6) : 0); B[n + '2'].rotation.x = (n[0] === 'F' ? -0.6 : 0.6) * d; B[n + '1'].rotation.z = side * 0.25 * d * (i % 2 ? 1 : -1); });
    B.neck.rotation.x = 0.1 * d; B.neck.rotation.z = side * 0.3 * d; B.head.rotation.x = -0.1 * d; if (B.jaw) B.jaw.rotation.x = 0.4 * d;
    B.tail1.rotation.set(0.2 * d, 0, 0); B.tail2.rotation.set(0, 0, 0); B.tail3.rotation.set(0, 0, 0);
    B.chest.rotation.x = Math.sin(t * 1.2) * 0.0;
  }
}

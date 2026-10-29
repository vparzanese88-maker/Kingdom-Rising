// Aeternum Wilds: real people from the MakeHuman body (mh.js), behind the game's makeHumanoid contract:
// { root, body, mats: [skin, shirt, pants, boot, trim, ...], parts: { hips, upper, head, hair, armR, armL, handR, handL,
// legR, legL, ... }, size, hunched }. parts.handR / handL are grip points inside the fists (a weapon built with its
// grip at the origin and the blade along +y, turned by rotation.x = PI/2, points forward out of the fist).
import * as THREE from 'three';
import { loadHuman, humanAsset, humanBody, makeRig, outfitOf, firstPersonArm, ROLE } from './mh.js';

let ready = false, failed = false;
export const humansReady = () => ready;
export async function initHumans(onProgress) {
  if (ready || failed) return ready;
  try { await loadHuman(new URL('../../../../kingdom-rising-3d/assets/human/', import.meta.url).href, onProgress); ready = true; }
  catch (e) { failed = true; console.warn('Human body asset unavailable, using simple figures', e); }
  return ready;
}

const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
// creator slider (min..1..max) to MakeHuman's 0..1 with 0.5 average
const slide = (v, lo, hi, mid = 0.5) => { v = v ?? 1; return v >= 1 ? mid + (1 - mid) * Math.min(1, (v - 1) / (hi - 1)) : mid - mid * Math.min(1, (1 - v) / (1 - lo)); };
const FH = [0, 1, 6, 5, 3, 4]; // Aeternum facial hair (none, stubble, mustache, goatee, full, long) -> beard styles
function hashOpts(o) { const s = JSON.stringify([o.skin, o.shirt, o.pants, o.hair, o.hairStyle, o.eyes, o.size, o.hunched, o.sex, o.facialHair, o.helm, o.hat, o.horns, o.seed]); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

// makeHumanoid's options to the body's look
export function lookOf(o) {
  const fem = o.sex === 'f';
  const F = o.face || null;
  const undead = o.eyes != null;
  return {
    gender: fem ? 'f' : 'm',
    skin: o.skin ?? 0xe0b48a,
    hair: o.hair ?? (undead ? 0x1a1612 : 0x2a1e16),
    hairStyle: o.hair === undefined ? (o.hat || o.helm ? 0 : 3) : o.hairStyle ?? 0,
    beardStyle: fem ? 0 : FH[o.facialHair ?? (o.beard ? 4 : 0)] ?? 0,
    seed: o.seed ?? (F ? 'hero' : hashOpts(o)),
    vary: F ? 0.3 : 1,
    muscle: slide(o.muscle, 0.8, 1.35, (fem ? 0.42 : 0.58) + (o.size > 1.4 ? 0.3 : 0)),
    weight: slide(o.build, 0.82, 1.35, 0.45 + (o.size > 1.4 ? 0.2 : 0)),
    height: slide(o.height, 0.86, 1.14, 0.5),
    face: F ? { faceWidth: F.faceWidth, jaw: F.jaw, chin: F.chin, nose: F.nose, eyeSize: F.eyeSize, brow: F.brow, ears: F.ears, mouth: F.mouth, headSize: F.headSize } : null,
    hunch: o.hunched ? 1 : 0,
    gaunt: o.hunched && undead ? 1 : 0,
    brute: (o.size || 1) >= 1.5 && undead ? 1 : 0,
    iris: o.eyeColor ?? undefined,
    glow: o.eyes ?? undefined,
    paint: o.paint ?? null,
    scar: !!o.scar,
    grime: o.hunched ? 0.7 : undead ? 0.35 : 0,
    hairDensity: F ? 0.9 : 0.6,
  };
}

// what they wear, unless the caller says (o.armor / o.legs / o.feet / o.gloves)
function kindsOf(o) {
  const fem = o.sex === 'f';
  return { chest: o.armor || (o.helm != null ? 'leather' : fem ? 'dress' : 'tunic'), legs: o.legs || (o.armor === 'plate' ? 'plate' : o.armor === 'leather' ? 'leather' : 'cloth'), feet: o.feet || (o.armor === 'plate' ? 'plate' : 'boots'), hands: o.gloves || 'none', tier: o.tier || 1 };
}

// accessories that are not clothes: a captain's hat, horns
function accessories(h, o, B) {
  const head = h.rig.bones.head; const f = B.headFrame; const hr = B.rest.head;
  const at = (x, y, z) => new THREE.Vector3(x - hr[0], y - hr[1], z - hr[2]);
  if (o.hat) {
    const m = new THREE.MeshStandardMaterial({ color: 0x1c1a20, roughness: 0.85 });
    const g = new THREE.Group(); g.position.copy(at(f.c.x, f.c.y + f.rad.y * 0.45, f.c.z));
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(f.rad.x * 2.1, f.rad.x * 2.2, 0.018, 24), m); g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(f.rad.x * 0.95, f.rad.x * 1.12, f.rad.y * 1.15, 20), m); crown.position.y = f.rad.y * 0.55; g.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(f.rad.x * 1.13, f.rad.x * 1.13, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0x8a2a1a, roughness: 0.7 })); band.position.y = 0.03; g.add(band);
    // the brim turned up at the sides like a tricorne
    brim.scale.set(1, 1, 0.82); g.rotation.x = -0.08;
    for (const x of g.children) { x.castShadow = true; }
    head.add(g); h.parts.hat = g;
    h.mats.push(m);
  }
  if (o.horns) {
    const m = new THREE.MeshStandardMaterial({ color: 0x1a0e0a, roughness: 0.55, metalness: 0.1 });
    for (const sd of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(sd * (t * 0.11 + Math.sin(t * 2.2) * 0.03), t * 0.16 + Math.sin(t * 3) * 0.02, -t * 0.05 + t * t * 0.08)); }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 12, 0.026, 8, false);
      const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { /* taper */ }
      const mesh = new THREE.Mesh(geo, m); mesh.position.copy(at(sd * f.rad.x * 0.62, f.c.y + f.rad.y * 0.62, f.c.z + f.rad.z * 0.1)); mesh.castShadow = true;
      // taper the tube toward the tip
      const tg = mesh.geometry; const ps = tg.attributes.position; const segs = 13, radial = 9;
      for (let i = 0; i < segs; i++) { const c = curve.getPointAt(i / (segs - 1)); const k = 1 - (i / (segs - 1)) * 0.85; for (let j = 0; j < radial; j++) { const vi = i * radial + j; if (vi >= ps.count) continue; ps.setXYZ(vi, c.x + (ps.getX(vi) - c.x) * k, c.y + (ps.getY(vi) - c.y) * k, c.z + (ps.getZ(vi) - c.z) * k); } }
      tg.computeVertexNormals();
      head.add(mesh);
    }
    h.mats.push(m);
  }
}

// a person, built on the human body; null when the asset is not loaded (models.js then builds a simple figure)
export function buildHuman(o = {}) {
  if (!ready) return null;
  const L = lookOf(o);
  const B = humanBody(L);
  const K = kindsOf(o);
  const rig = makeRig(B, K);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const s = o.size || 1;
  body.scale.setScalar(s);
  body.add(rig.mesh);
  const [shirtM, pantsM, bootM, trimM, fixedM] = rig.roleM;
  shirtM.color.setHex(o.shirt ?? 0x6a5236); pantsM.color.setHex(o.pants ?? 0x40362a); bootM.color.setHex(o.boots ?? 0x3a2a1c); trimM.color.setHex(shade(o.shirt ?? 0x6a5236, 0.62));
  const bn = rig.bones;
  // grip points in the fists, and mounts on the forearms (shields) and the back
  const grip = (S) => { const g = new THREE.Group(); g.name = 'grip' + S; g.position.set(...B.hands[S].grip); bn['hand' + S].add(g); return g; };
  const handR = grip('R'), handL = grip('L');
  const mount = (bone, name) => { const g = new THREE.Group(); g.name = name; bn[bone].add(g); return g; };
  const foreL = mount('foreL', 'mountForeL'), foreR = mount('foreR', 'mountForeR'), back = mount('chest', 'mountBack');
  const hairG = rig.hair || new THREE.Group();
  const h = {
    root, body, rig,
    mats: [rig.skinM, shirtM, pantsM, bootM, trimM, fixedM, rig.helmMat],
    parts: { hips: bn.hips, upper: back, chest: bn.chest, spine: bn.spine, neck: bn.neck, head: bn.head, hair: hairG, beard: rig.beard, armR: bn.armR, armL: bn.armL, foreR, foreL, handR, handL, legR: bn.thighR, legL: bn.thighL },
    size: s * (B.spec.height / 1.84), hunched: !!o.hunched, human: true, look: L, opts: o,
    seed: (B.spec.seed % 1000) / 1000,
  };
  accessories(h, o, B);
  if (o.helm != null) { rig.setHelm('nasal', 1); rig.helmMat.color.setHex(o.helm); if (rig.hair) rig.hair.visible = false; }
  if (o.hat && rig.hair) rig.hair.visible = (L.hairStyle === 1 || L.hairStyle === 4 || L.hairStyle === 5);
  B.refs = (B.refs || 0) + 1;
  return h;
}

// recolour (and reshape, when the kinds of gear change) the clothes; look: { chest, legs, feet, trim, helm, helmTier,
// kinds?: { chest, legs, feet, hands, tier }, helmStyle? }
const HELM_BY_TIER = ['cap', 'cap', 'nasal', 'sallet', 'great'];
export function dressHuman(h, look) {
  const rig = h.rig; if (!rig) return;
  const [, shirt, pants, boot, trim] = h.mats;
  if (look.chest != null) shirt.color.setHex(look.chest);
  if (look.trim != null) trim.color.setHex(look.trim); else if (look.chest != null) trim.color.setHex(shade(look.chest, 0.62));
  if (look.legs != null) pants.color.setHex(look.legs);
  if (look.feet != null) boot.color.setHex(look.feet);
  if (look.kinds) { const k = look.kinds, c = rig.kinds; if (k.chest !== c.chest || k.legs !== c.legs || k.feet !== c.feet || k.hands !== c.hands || (k.tier || 1) !== (c.tier || 1)) rig.setOutfit(k); }
  const style = look.helm == null ? null : look.helmStyle || HELM_BY_TIER[Math.max(0, Math.min(4, look.helmTier ?? 2))];
  if (style !== (rig.helmStyle || null)) rig.setHelm(style, look.helmTier >= 3 ? 4 : look.helmTier >= 2 ? 3 : 1);
  if (look.helm != null) rig.helmMat.color.setHex(look.helm);
  const closed = style === 'great' || style === 'barbute';
  if (rig.hair) rig.hair.visible = look.helm == null;
  if (rig.beard) rig.beard.visible = !closed;
}

// your own arms in first person: the same skin, sleeves and gloves as your body
export function fpArms(h) {
  const rig = h.rig; if (!rig) return null;
  const L = firstPersonArm(rig.B, rig.kinds, 'L'), R = firstPersonArm(rig.B, rig.kinds, 'R');
  return { L, R, key: rig.B.key + '|' + JSON.stringify(rig.kinds) };
}

// a person no longer shown (the character creator's previews): their body may be dropped from the cache
export function releaseHuman(h) { if (h && h.rig) { const B = h.rig.B; B.refs = Math.max(0, (B.refs || 1) - 1); } }

// build the bodies of people who will appear later (enemy types), so the first sight of them does not stall a frame
export function prewarmHuman(o) { if (!ready) return; const L = lookOf(o); const B = humanBody(L); B.keep = true; outfitOf(B, kindsOf(o)); }
export { ROLE, humanAsset };

// Hero models: real 3D characters (made in Meshy, rigged and animated) that replace the shape-built body for a class.
// The built body keeps running underneath, invisible, so weapons, hit boxes and effects work as before; the model is
// placed on the same spot, plays idle / walk / run by speed, and the class's hand items move onto its real hands.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Meshy painted bare skin a strong salmon; under the arena's warm sun it read as red. Pull those skin pixels toward a
// natural tan (only warm, fairly saturated pixels are touched, so leather, metal and cloth stay as they are)
function calmSkin(tex, amt) {
  const run = () => { const im = tex.image; if (!im || !im.width) return; const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const r = p[i], gg = p[i + 1], b = p[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); if (mx !== r || mx < 90) continue; const sat = (mx - mn) / mx; if (sat < 0.28 || gg < b) continue; const hue = (gg - b) / Math.max(1, mx - mn); if (hue > 0.45) continue; /* (red-salmon skin tones only: orange robes stay orange) */
      const k = amt * Math.min(1, (sat - 0.28) / 0.25), L = 0.3 * r + 0.59 * gg + 0.11 * b, tr = L * 1.12, tg = L * 0.96, tb = L * 0.82; /* (a neutral tan of the same brightness) */
      p[i] = r + (tr - r) * k; p[i + 1] = gg + (tg - gg) * k; p[i + 2] = b + (tb - b) * k; }
    g.putImageData(d, 0, 0); tex.image = cv; tex.needsUpdate = true; };
  const im = tex.image; if (im && im.width && (im.complete === undefined || im.complete)) run(); else if (im && im.addEventListener) im.addEventListener('load', run, { once: true }); else setTimeout(run, 500);
}
export const HERO_SIZE = 1.9 / 2.34; /* (the monk stands exactly as tall as the yard's human figures, 1.9; every class sized from her) */
const MODELS = {
  necromancer: { fpFore: 0.55, fpDrop: 0.15, bright: 1.35, base: 'models/necro_rig.fbx', clips: { walk: 'models/anim/necro_walk.json', run: 'models/anim/necro_run.json' }, height: 2.2, walkSpeed: 1.6, runSpeed: 5.5, runRate: 0.85 },
  musketeer: { oneHandGun: true, fpHand: 0.45, fpFore: 0.7, base: 'models/musk_rig.fbx', clips: { walk: 'models/anim/musk_walk.json', run: 'models/anim/musk_run.json' }, height: 1.12, walkSpeed: 1.5, runSpeed: 5.0 },
  blunderbuss: { fpHand: 0.72, base: 'models/bb_rig.fbx', clips: { walk: 'models/anim/bb_walk.json', run: 'models/anim/bb_run.json' }, height: 2.6, walkSpeed: 1.5, runSpeed: 5.0, runRate: 1.7 }, // (only a walk was made: running plays it faster)
  warrior: { fpHand: 0.72, fill: 0.38, fpDrop: 0.15, base: 'models/warr2_rig.fbx', clips: { walk: 'models/anim/warr2_walk.json', run: 'models/anim/warr2_run.json', slash: 'models/anim/warr2_slash.json', dead: 'models/anim/warr2_dead.json', double: 'models/anim/warr2_double.json', triple: 'models/anim/warr2_triple.json', roll: 'models/anim/warr2_roll.json', push: 'models/anim/warr2_push.json', jump2: 'models/anim/warr2_jump2.json', fcharge: 'models/anim/warr2_fcharge.json', rcharge: 'models/anim/warr2_rcharge.json', rslash: 'models/anim/warr2_rslash.json', rollL: 'models/anim/warr2_rollL.json', rollR: 'models/anim/warr2_rollR.json', backj: 'models/anim/warr2_backj.json' }, heightClips: ['dead', 'roll', 'rollL', 'rollR', 'backj'], /* (the owner's dodges: Roll Dodge 2 to the left, Rightward Spin to the right, Back Jump backwards) */ rootMove: ['tA', 'tB', 'tC'], rootClip: 'triple', steadyEdge: true, jogK: 0.78, mwIn: 11, flatClips: ['jump2', 'fcharge', 'rcharge'], moves: { rs: ['rslash', 0.05, 1.3, 0.55], rsA: ['rslash', 0.05, 0.75, 0.42], rsB: ['rslash', 0.75, 1.3, 0.88], /* (the owner's slash cut in two: the sweep across, then the sweep back to guard; each ends where the other starts, so held attacks loop without a jump) */ roll: ['roll', 0.05, 1.5, 0, true], rollL: ['rollL', 0.3, 1.9, 0, true], rollR: ['rollR', 0.2, 1.5, 0, true], rollB: ['backj', 0.0, 0.92, 0, true], jump: ['jump2', 0.45, 1.2, 0], charge: ['rcharge', 0, 0.5, 0, false, 0, true], push: ['push', 0.55, 2.0, 1.12], slash: ['slash', 0.55, 1.75, 1.33], tA: ['triple', 0.05, 0.95, 0.6], tB: ['triple', 0.95, 1.85, 1.5], tC: ['triple', 1.85, 3.0, 2.38], dead: ['dead', 0, 2.95, 0, true] }, combo: ['rsA', 'rsB'], moveFor: { swing1: 'rsA', swing2: 'rsB', swing3: 'rsA', shieldbash: 'push' }, /* (one standard slash, the owner's Right Hand Sword Slash) */ /* (the owner's Triple Combo Attack, cut in three: each blow plays its own part of the recording) */ /* (only the side slash plays the recording; the overhand and the stab follow the built body) */ /* (the owner's recorded Left Slash: the sword swings round in front of him, never through his own body) */ height: 2.75, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  bard: { fpDrop: 0.18, base: 'models/bard_rig.fbx', clips: { walk: 'models/anim/bard_walk.json', run: 'models/anim/bard_run.json' }, height: 1.9, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  beastmaster: { fpClaw: 0.13, fill: 0.42, skinFix: 0.75, base: 'models/beast_rig.fbx', clips: { walk: 'models/anim/beast_walk.json', run: 'models/anim/beast_run.json' }, height: 2.5, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  cleric: { base: 'models/cleric_rig.fbx', clips: { walk: 'models/anim/cleric_walk.json', run: 'models/anim/cleric_run.json' }, height: 2.6, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  druid: { base: 'models/druid_rig.fbx', clips: { walk: 'models/anim/druid_walk.json', run: 'models/anim/druid_run.json' }, height: 2.08, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  elementalist: { fpDrop: 0.18, base: 'models/ele_rig.fbx', clips: { walk: 'models/anim/ele_walk.json', run: 'models/anim/ele_run.json' }, height: 2.14, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  enchanter: { base: 'models/ench_rig.fbx', clips: { walk: 'models/anim/ench_walk.json', run: 'models/anim/ench_run.json' }, height: 1.84, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  bombardier: { base: 'models/bomb_rig.fbx', clips: { walk: 'models/anim/bomb_walk.json', run: 'models/anim/bomb_run.json' }, height: 1.0, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  paladin: { fpDrop: 0.15, fpFore: 0.72, base: 'models/pal_rig.fbx', clips: { walk: 'models/anim/pal_walk.json', run: 'models/anim/pal_run.json' }, height: 3.2, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  darkknight: { fill: 0.38, fpDrop: 0.15, fpFore: 0.68, base: 'models/dk_rig.fbx', clips: { walk: 'models/anim/dk_walk.json', run: 'models/anim/dk_run.json' }, height: 3.0, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  ranger: { fill: 0.32, base: 'models/rang_rig.fbx', clips: { walk: 'models/anim/rang_walk.json', run: 'models/anim/rang_run.json' }, height: 2.02, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  rogue: { fill: 0.34, bright: 1.35, base: 'models/rogue_rig.fbx', clips: { walk: 'models/anim/rogue_walk.json', run: 'models/anim/rogue_run.json' }, height: 1.76, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  wizard: { base: 'models/wiz_rig.fbx', clips: { walk: 'models/anim/wiz_walk.json', run: 'models/anim/wiz_run.json' }, height: 2.26, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  priest: { base: 'models/priest_rig.fbx', clips: { walk: 'models/anim/priest_walk.json', run: 'models/anim/priest_run.json' }, height: 1.96, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  shaman: { base: 'models/shaman_rig.fbx', clips: { walk: 'models/anim/shaman_walk.json', run: 'models/anim/shaman_run.json' }, height: 2.42, walkSpeed: 1.6, runSpeed: 5.5 }, // (the owner's shaman, with his own walk and run)
  berserker: { keepLegs: true, base: 'models/sham_rig.fbx', clips: { walk: 'models/anim/sham_walk.json', run: 'models/anim/sham_run.json', cslash: 'models/anim/bers_cslash.json' }, moves: { cutA: ['cslash', 0.1, 1.0, 0.5], cutB: ['cslash', 1.0, 1.9, 1.2] }, combo: ['cutA', 'cutB'], moveFor: { swing1: 'cutA', swing2: 'cutB' }, /* (the owner's Charged Slash, cut in two: a wide sweep from his right across to his left, then straight back; the axe in front of him the whole way) */ height: 3.6, walkSpeed: 1.6, runSpeed: 5.5 }, // (the owner's latest berserker; the older one is retired. The shaman has no model of its own yet)
  monk: { skinFix: 0.75, fpCurl: [0.5, 0.08, 3.3], base: 'models/monk2_rig.fbx', clips: Object.assign(Object.fromEntries(['walk', 'run', 'back', 'risekick', 'spinkick'].map(k => [k, 'models/anim/monk_' + k + '.json'])), Object.fromEntries(['punchA', 'punchB', 'attack', 'double', 'charged', 'counter', 'thrust', 'jump', 'dodge', 'stance', 'dead', 'cheer'].map(k => [k, 'models/anim/monk2_' + k + '.json'])), /[?&]kickgal/.test(location.search) ? Object.fromEntries(['kick', 'roundhouse', 'spinkick', 'risekick', 'doublekick', 'lungeround', 'sweep', 'flystrike'].map(k => ['g_' + k, 'models/anim/monk_' + k + '.json']).concat(['cast1', 'cast2', 'taunt'].map(k => ['g_' + k, 'models/anim/monk2_' + k + '.json']))) : {}), height: 2.34, walkSpeed: 1.6, runSpeed: 5.5,
    // slices of the recorded moves: [clip, start s, end s, the moment the blow lands, whole-body move, fixed play time, loops]
    moves: { jab: ['punchB', 0.3, 0.85, 0.6], cross: ['punchB', 0.85, 1.25, 1.0], hook: ['punchA', 0.5, 1.15, 0.9], upper: ['punchA', 1.15, 1.8, 1.4], spin: ['spinkick', 0.1, 1.6, 1.25], /* (the combo's spinning blow is now a real flying spin kick) */ slam: ['attack', 0.3, 1.6, 1.1],
      charged: ['charged', 0.15, 1.7, 0.85], counter: ['counter', 4.8, 6.35, 5.8],
      fury: ['punchB', 0.45, 1.5, 0, 0, 0, true], kick: ['risekick', 0.05, 1.45, 0.5], /* (a leaping side kick, the leg driven out flat: much cleaner than the old flailing one) */ flykick: ['jump', 1.4, 3.5, 0, true, 1.1], superman: ['thrust', 0.15, 1.4, 0, true, 0.75], flip: ['dodge', 0.1, 1.25, 0, true],
      dead: ['dead', 0, 2.95, 0, true], cheer: ['cheer', 0.2, 6.0, 0, true] },
    combo: ['jab', 'cross', 'hook', 'upper', 'spin', 'jab', 'slam'], finisher: ['charged', 'counter'], idleClip: 'stance', idleHold: 0.4, noGrip: true, fpHand: 1.0 }, // (the owner's new monk moves: punch combos, spinning strike, ground slam; charged palm and counterstrike finish a combo; fighting stance at rest, a real death fall, a cheer when the arena is won)
};
export const heroHeight = (cls) => (MODELS[cls] ? MODELS[cls].height * HERO_SIZE : 2.6); /* (how tall a class stands in the world) */
export const hasHeroModel = (cls) => !!MODELS[cls] && !/[?&]nomodels/.test(location.search);

const cache = {}; const loader = new FBXLoader();
// Meshy meshes can carry zero-length normals; in the shader those become invalid pixels that the glow pass smears into a black screen
export function fixNormals(geo) { const n = geo && geo.attributes.normal; if (!n) return; const a = n.array; for (let i = 0; i < a.length; i += 3) { const l = a[i] * a[i] + a[i + 1] * a[i + 1] + a[i + 2] * a[i + 2]; if (!(l > 1e-8)) { a[i] = 0; a[i + 1] = 1; a[i + 2] = 0; } } n.needsUpdate = true; }
const loadFbx = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));
// one load per class: the rigged character and its animation clips (root motion stripped so it runs on the spot)
function loadClass(cls) {
  if (cache[cls]) return cache[cls]; const D = MODELS[cls];
  cache[cls] = (async () => {
    const base = await loadFbx(D.base); const clips = {};
    await Promise.all(Object.entries(Object.assign({ kd: 'models/anim/hit_kd.json', up: 'models/anim/hit_up.json' }, D.clips)).map(async ([k, url]) => /* (every hero shares the owner's Knock Down) */ { const J = url.endsWith('.json') ? await (await fetch(url)).json() : null, c = J ? THREE.AnimationClip.parse(J) : (await loadFbx(url)).animations[0]; if (!c) return; if (J && J.rest) retarget(c, J, base); // (moves are stored as small motion-only files, not whole characters)
      { const hp = c.tracks.find(t => /^Hips\.position$/.test(t.name)); if (hp) c.userData = { root: { t: Float32Array.from(hp.times), v: Float32Array.from(hp.values) } }; } /* (the hips' own travel, kept before it is flattened: a move that steps forward carries the hero with it) */ c.tracks = c.tracks.filter(t => !/\.position$/.test(t.name) || (/^Hips\.position$/.test(t.name) && ((D.rootClip === k || (HEIGHT_KEYS.includes(k) || (D.heightClips && D.heightClips.includes(k)) ? keepHipHeight(t, base) : D.flatClips && D.flatClips.includes(k) ? flatHip(t) : keepHipY(t))), true))); /* (bones keep this model's own lengths: only the hips' bob comes from the clip; a root-motion clip keeps its whole hip path, and the step is taken off again as the hero moves) */ clips[k] = c; }));
    base.traverse(o => { if (o.isMesh) { fixNormals(o.geometry); o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; const m = o.material; if (m && m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.anisotropy = 4; } if (m && m.map && D.skinFix) calmSkin(m.map, D.skinFix); if (m) { m.color && m.color.set('#ffffff'); m.shininess = 6; if (m.specular) m.specular.setScalar(0.08); /* (Phong rigs like the dark knight had a white sheen) */ m.side = THREE.DoubleSide; } /* (both sides drawn: no seeing through thin cloth and sleeves) */ } });
    return { base, clips };
  })();
  return cache[cls];
}
// a move recorded on an older version of the model: turn each bone's keys from that model's rest pose to this one's
function retarget(clip, J, base) {
  // world-space retarget: each bone keeps the same turn away from its rest pose, measured in the world, so parents and children agree
  const T = {}, order = []; base.traverse(o => { if (o.isBone) { T[o.name] = o; order.push(o); } });
  const qt = {}; let N = 0; for (const tr of clip.tracks) { const [bn, prop] = tr.name.split('.'); if (prop === 'quaternion' && T[bn]) { qt[bn] = tr; N = Math.max(N, tr.times.length); } }
  for (const bn in qt) if (qt[bn].times.length !== N) return; // (keys out of step: leave the clip alone rather than guess)
  const par = (b) => (b.parent && b.parent.isBone ? b.parent.name : null), Q = () => new THREE.Quaternion();
  const sRestW = {}, tRestW = {}; for (const b of order) { const p = par(b), sl = J.rest[b.name] ? Q().fromArray(J.rest[b.name]) : b.quaternion.clone(); sRestW[b.name] = p ? sRestW[p].clone().multiply(sl) : sl; tRestW[b.name] = p ? tRestW[p].clone().multiply(b.quaternion) : b.quaternion.clone(); }
  const out = {}; for (const bn in qt) out[bn] = new Float32Array(qt[bn].values.length);
  const sW = {}, tW = {}, tmp = Q();
  for (let f = 0; f < N; f++) {
    for (const b of order) { const n = b.name, p = par(n && T[n]), tr = qt[n]; const sl = tr ? Q().fromArray(tr.values, f * 4) : (J.rest[n] ? Q().fromArray(J.rest[n]) : b.quaternion.clone());
      sW[n] = p ? sW[p].clone().multiply(sl) : sl;
      tW[n] = sW[n].clone().multiply(tmp.copy(sRestW[n]).invert()).multiply(tRestW[n]);
      if (tr) { const loc = p ? tmp.copy(tW[p]).invert().multiply(tW[n]) : tW[n].clone(); loc.toArray(out[n], f * 4); } } }
  for (const bn in qt) qt[bn].values = out[bn];
  for (const tr of clip.tracks) { const [bn, prop] = tr.name.split('.'); const tb = T[bn]; if (prop === 'position' && bn === 'Hips' && tb && J.restPos && J.restPos.Hips) { const v = tr.values, s0 = J.restPos.Hips, k = tb.position.y / (s0[1] || 1); for (let i = 0; i < v.length; i += 3) { v[i] = tb.position.x; v[i + 1] *= k; v[i + 2] = tb.position.z; } } }
}
// keep the hips bobbing up and down but not travelling forward or sideways
function flatHip(track) { const v = track.values; if (!v || v.length < 3) return; for (let i = 3; i < v.length; i++) v[i] = v[i % 3]; } /* (the hips stay where they start: the game's own jump or charge moves the hero) */
// falls and rolls need the hips' real height (lying on the ground, tucked low): these Meshy rigs stand Z-up, so the
// height is the third value, scaled to this hero's own hip height; the travel is taken off (the game moves the hero)
const HEIGHT_KEYS = ['kd', 'up'];
function keepHipHeight(track, base) { const v = track.values; if (!v || v.length < 3) return; const hb = base && base.getObjectByName('Hips'); if (!hb) return keepHipY(track);
  const up = new THREE.Vector3(0, 0, 1).applyQuaternion(hb.parent ? hb.parent.quaternion : new THREE.Quaternion()), zUp = Math.abs(up.y) > 0.7; if (!zUp) return keepHipY(track);
  const rx = hb.position.x, ry = hb.position.y, rz = hb.position.z, k = rz / (Math.max(v[2], v[v.length - 1]) || rz || 1); /* (scaled from the end of the clip where he is standing: the get-up starts lying down) */ for (let i = 0; i < v.length; i += 3) { v[i] = rx; v[i + 1] = ry; v[i + 2] = v[i + 2] * k; } }
function keepHipY(track) { const v = track.values; if (!v || v.length < 3) return; const x0 = v[0], z0 = v[2]; for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; } }

// swap the built body for the class's model. ch: the humanoid from buildHumanoid. Safe to call before it has loaded.
export function attachHeroModel(ch, cls) {
  if (!ch || !hasHeroModel(cls) || ch.heroModel) return; ch.heroModel = 'loading'; const hidden = []; if (ch.body) ch.body.traverse(o => { if ((o.isMesh || o.isLine) && o.visible) { o.visible = false; o.userData.hmHide = true; hidden.push(o); } }); /* (the old built body stays hidden while the model loads, so it never flashes up) */ const D = MODELS[cls];
  loadClass(cls).then(({ base, clips }) => {
    if (!ch.root) return;
    const m = SkeletonUtils.clone(base); m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()); const k = (D.height * HERO_SIZE) / Math.max(0.01, size.y); /* (size set per class, not by race) */
    const wrap = new THREE.Group(); wrap.add(m); m.scale.multiplyScalar(k); m.position.y = -box.min.y * k; ch.root.add(wrap);
    // hide the built body's skin and clothes; its weapons and hand items move onto the model's hands
    const keep = new Set(); const hands = {}; m.traverse(o => { if (o.isBone && /^LeftHand$/.test(o.name)) hands.L = o; if (o.isBone && /^RightHand$/.test(o.name)) hands.R = o; });
    for (const sd of ['L', 'R']) { const g = ch.arms && ch.arms[sd] && ch.arms[sd].grip; if (!g || !hands[sd] || D.noGrip) continue; /* (the monk's model has its own wraps and fists: the old built ones are not carried over) */ const socket = new THREE.Group(); socket.scale.setScalar(1 / k); hands[sd].add(socket); socket.userData.codeHand = ch.arms[sd].hand; socket.userData.gripQ = g.quaternion.clone(); socket.userData.gripP = g.position.clone(); socket.userData.fist = fistFrame(hands[sd], (D.fist && D.fist[sd]) || null); socket.userData.side = sd; (ch.hmSockets = ch.hmSockets || []).push(socket); for (const c of [...g.children]) { socket.add(c); keep.add(c); } ch.arms[sd].grip = socket; }
    for (const c of keep) if (c.userData && c.userData.flame) { c.position.set(0, 0.09, 0.03); c.rotation.set(0, 0, 0); } // (the necromancer's green flame sits in his open right palm)
    ch.body.traverse(o => { if ((o.isMesh || o.isLine) && !isUnder(o, keep)) { o.visible = false; o.userData.hmHide = true; } }); for (const o of hidden) if (isUnder(o, keep)) { o.visible = true; o.userData.hmHide = false; } /* (the hand items carried over to the model show again) */
    if (D.bright) m.traverse(o => { if (!o.isMesh || !o.material) return; const lift = (x) => { if (!x) return x; const c = x.clone(); if (c.color && c.color.setScalar) c.color.setScalar(D.bright); if (D.emis && c.emissive && c.emissive.setScalar && c.map) { c.emissive.setScalar(D.emis); c.emissiveMap = c.map; } return c; }; o.material = Array.isArray(o.material) ? o.material.map(lift) : lift(o.material); }); /* (lifted so the bone and armour detail reads; his own texture glows a little; any material without a colour is left alone) */
    { const fill = D.fill != null ? D.fill : 0.22; if (fill > 0 && !D.emis) m.traverse(o => { if (!o.isMesh || !o.material) return; for (const mt of Array.isArray(o.material) ? o.material : [o.material]) if (mt.emissive && !mt.userData.heroFill && !mt.vertexColors) { /* (a baked vertex-coloured part, e.g. a held gun: its white base colour would glow grey over the real colours) */ mt.userData.heroFill = true; if (mt.map) { mt.emissiveMap = mt.map; mt.emissive.setScalar(fill); } else if (mt.color) mt.emissive.copy(mt.color).multiplyScalar(fill); mt.needsUpdate = true; } }); } /* (a soft fill: every hero keeps a little of its own texture lit even with the sun behind it, so a backlit hero reads as armour and fur, not a black cut-out; subtle, not a glow) */
    if (D.eyes) addEyes(m, D.eyes, k);
    const mixer = new THREE.AnimationMixer(m), act = {}; for (const kk in clips) { act[kk] = mixer.clipAction(clips[kk]); act[kk].play(); act[kk].setEffectiveWeight(0); if (kk !== 'walk' && kk !== 'run' && kk !== 'back') act[kk].paused = true; } // (attack clips don't run on their own: the move code sets their time)
    const bones = {}, bind = {}; m.traverse(o => { if (o.isBone) { bones[o.name] = o; bind[o.name] = [o.quaternion.clone(), o.position.clone()]; } });
    ch.heroModel = { m, wrap, mixer, act, D, bones, bind, idle: idlePose(m, bones), w: { idle: 1, walk: 0, run: 0 }, lp: ch.root.position.clone(), v: 0, t: 0 };
  }).catch(e => { console.warn('hero model', cls, e); ch.heroModel = null; for (const o of hidden) { o.visible = true; o.userData.hmHide = false; } });
}
// the closed fist in the model's hand-bone frame (Meshy rigs have no finger bones): the fingers F run from the wrist toward the middle of
// the skin the hand bone moves, the thumb T toward his front in the rest pose (arms out, palms down). Returned: p, the point a grip goes
// through (part way up the hand, toward the fingers), and q, which lays the built grip's frame (y out of the thumb side of the fist, z along
// the fingers, x = y cross z) into the hand bone, so whatever the built hand held sits the same way in the model's fist.
// o (MODELS fist.L / .R): [how far up the hand 0-1, toward the palm (+) or the back (-) as a share of the hand's length, a turn about the fingers]
function fistFrame(hb, o) { let sk = null; for (let r = hb, n = 0; r && !sk && n < 40; r = r.parent, n++) { if (r.isBone) continue; r.traverse(c => { if (!sk && c.isSkinnedMesh && c.skeleton && c.skeleton.bones.includes(hb)) sk = c; }); }
  if (!sk) return null; const bi = sk.skeleton.bones.indexOf(hb), P = sk.geometry.attributes.position, SI = sk.geometry.attributes.skinIndex, SW = sk.geometry.attributes.skinWeight; if (!P || !SI || !SW) return null;
  const inv = sk.skeleton.boneInverses[bi], mt = new THREE.Matrix4().multiplyMatrices(inv, sk.bindMatrix), v = new THREE.Vector3(), c = new THREE.Vector3(), pts = []; let n = 0;
  for (let i = 0; i < P.count; i++) { let best = -1, bw = 0; for (let j = 0; j < 4; j++) { const w = SW.getComponent(i, j); if (w > bw) { bw = w; best = SI.getComponent(i, j); } } if (best !== bi || bw < 0.5) continue; v.fromBufferAttribute(P, i).applyMatrix4(mt); c.add(v); pts.push(v.clone()); n++; }
  if (n < 8) return null; c.multiplyScalar(1 / n); const F = c.clone().normalize(); let len = 0; for (const q of pts) len = Math.max(len, q.dot(F));
  const iq = new THREE.Quaternion(); inv.decompose(new THREE.Vector3(), iq, new THREE.Vector3()); const T = new THREE.Vector3(0, 0, 1).applyQuaternion(iq); T.addScaledVector(F, -T.dot(F)).normalize(); /* (his front, in the hand's rest frame) */
  const O = o || [0.55, 0, 0]; if (O[2]) T.applyAxisAngle(F, O[2]); const X = new THREE.Vector3().crossVectors(T, F);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, T, F)), side = hb.name.startsWith('Right') ? 1 : -1; /* (x is the palm side of a right fist, the back of a left one) */
  return { q, p: F.clone().multiplyScalar(len * O[0]).addScaledVector(X, side * len * (O[1] || 0)), len }; }
// every frame: each model arm reaches (two-bone IK) to where the built body's hand is, measured from the shoulder and scaled to the model's
// arm, with the elbow bent the same way, and the model's hand turns to the built hand's exact angle. The weapon is fixed in the model's
// fist, so it is one with the hand through every carry, stride, swing, cast, roll and jump. A support hand that the built body has on the
// weapon (two-handers, the gun's fore-end, the bow's string) is put on the model's weapon itself, where the built hand is on the built one.
const _pq = new THREE.Quaternion(), _pq2 = new THREE.Quaternion(), _pm = new THREE.Matrix4(), _pm2 = new THREE.Matrix4(), _pm3 = new THREE.Matrix4(), _pv = new THREE.Vector3(), _pv2 = new THREE.Vector3(), _pv3 = new THREE.Vector3(), _pv4 = new THREE.Vector3(), _ps = new THREE.Vector3(1, 1, 1);
function builtGrip(so, out) { const chd = so.userData.codeHand; chd.updateWorldMatrix(true, false); return out.multiplyMatrices(chd.matrixWorld, _pm3.compose(so.userData.gripP, so.userData.gripQ, _ps)); }
const SUPPORT = { musket: [0, 0.42, 0, 0, Math.PI, 0], blunderbuss: [0, 0.26, 0, 0, Math.PI, 0] }; /* (where the left fist holds a gun, in the gun's own frame: under the fore-stock) */
const REST_TILT = { sword: 0.6, dagger: 0.35, mace: 0.6, greatsword: 0.75, bow: 'up', spear: 'upF' }; /* ('up': the bow stands upright out of the fist at rest, however the arm swings) */ /* (radians, tip down, while he is not attacking) */
// ---------- third person melee swings v2: the hand follows a clean arc around the outside of the model's own body ----------
// The old way copied a hidden built body whose proportions differ, so blades cut through the hero. Each blow is now an arc
// around the model's own right shoulder: wound back, swept through, followed through, with the blade pointing out along
// the arc and its edge leading the cut, while the chest twists with it (the support hand still takes a two-hander's haft)
const _sa = new THREE.Vector3(), _sb = new THREE.Vector3();
function arcDir(kind, a, R, U, F) { // a: 0 at the wind-up, 1 at the end of the follow-through; returns a unit direction from the shoulder
  const dir = (yaw, el) => { const ce = Math.cos(el); return F.clone().multiplyScalar(Math.cos(yaw) * ce).addScaledVector(R, Math.sin(yaw) * ce).addScaledVector(U, Math.sin(el)).normalize(); };
  const L = (x, y) => x + (y - x) * a, D = Math.PI / 180;
  switch (kind) {
    case 'over': { const ph = L(132, -40) * D, yw = 12 * D; return F.clone().multiplyScalar(Math.cos(ph) * Math.cos(yw)).addScaledVector(R, Math.sin(yw) * Math.cos(ph) + 0.26).addScaledVector(U, Math.sin(ph)).normalize(); } /* (from behind the head, over and down the front) */
    case 'back': return dir(L(-75, 105) * D, L(8, -4) * D); /* (backhand: from the left, across to the right) */
    case 'low': return dir(L(100, -70) * D, L(-12, -30) * D); /* (a low cut at the legs) */
    case 'stab': return dir(L(45, -4) * D, L(-35, -6) * D);
    case 'wideS': return dir(L(72, -82) * D, L(4, -8) * D); /* (a two-hander's wide sweep, right to left, all in front of the chest) */
    case 'wideB': return dir(L(-72, 82) * D, L(4, -8) * D); /* (and back, left to right) */
    case 'spear': return dir(L(78, 4) * D, L(14, 6) * D); /* (the spear drawn back high past the right shoulder, then driven straight out in front) */
    default: return dir(L(105, -75) * D, L(22, -6) * D); /* (a side cut: wound back past the right shoulder, swept across the front to the left) */
  }
}
function meleeArc(ch, H, B, act, mvK) {
  ch._arc = null; if (/[?&]noarc/.test(location.search)) return; const st = ch._st || {}, nm = ch._act || '', kT = st.actionT, W = ch.weapons || {}, main = W.main;
  if (!act || mvK || kT == null || !main || !/^weapon_/.test(main.name || '') || /bow|staff|musket|blunderbuss|wand|orb|book|lute|censer|scepter|doll|detonator|grenade|fists/.test(main.name)) return;
  let kind = /^(swing3|smash|heavy|chop|slam|cleave)/.test(nm) ? 'over' : /^(stab|thrust|lunge|bash)/.test(nm) ? 'stab' : /^(swing2|reap|off)/.test(nm) ? 'back' : /^lowcut/.test(nm) ? 'low' : /^(swing|slash|sweep|strike)/.test(nm) ? 'side' : null; if (!kind) return; const spear = kind === 'stab' && /spear/.test(main.name); if (spear) kind = 'spear';
  const sh = B.RightArm, fo = B.RightForeArm, hd = B.RightHand; if (!sh || !fo || !hd) return;
  const big = /greataxe|greatsword|warhammer/.test(main.name) && (kind === 'side' || kind === 'back') && B.LeftArm; if (big) kind = kind === 'side' ? 'wideS' : 'wideB'; /* (big two-handers sweep wide around the chest, both hands in front, never through the body) */
  const k = Math.max(0, Math.min(1, kT)), sm = (x) => x * x * (3 - 2 * x);
  const w = k < 0.28 ? sm(k / 0.28) : k < 0.8 ? 1 : 1 - sm((k - 0.8) / 0.2); /* (blended in during the wind-up, out during the recovery) */
  const a = k < 0.3 ? 0 : k < 0.64 ? sm((k - 0.3) / 0.34) * 0.86 : 0.86 + 0.14 * sm(Math.min(1, (k - 0.64) / 0.16)); /* (held at the wind-up, swept fast, then the follow-through eases out) */
  const wq = H.wrap.getWorldQuaternion(new THREE.Quaternion()), U = new THREE.Vector3(0, 1, 0), F = new THREE.Vector3(0, 0, 1).applyQuaternion(wq).setY(0).normalize(), R = new THREE.Vector3().crossVectors(F, U).normalize(); /* (R: the hero's right) */
  H.m.updateMatrixWorld(true); const S0 = sh.getWorldPosition(new THREE.Vector3()), len = S0.distanceTo(fo.getWorldPosition(_sa)) + _sa.distanceTo(hd.getWorldPosition(_sb)); const S = big ? S0.clone().lerp(B.LeftArm.getWorldPosition(new THREE.Vector3()), 0.5).addScaledVector(U, -0.22 * len).addScaledVector(F, 0.12 * len) : S0; /* (a big sweep turns about the middle of the chest, a little below the shoulders) */
  const reach = kind === 'spear' ? len * (0.32 + 0.66 * a) : kind === 'stab' ? len * (0.55 + 0.42 * a) : len * (big ? 1.0 : 0.9); const d0 = arcDir(kind, a, R, U, F), p = S.clone().addScaledVector(d0, reach);
  const tan = arcDir(kind, Math.min(1, a + 0.02), R, U, F).sub(arcDir(kind, Math.max(0, a - 0.02), R, U, F)); /* (which way the hand is travelling) */
  let blade = kind === 'spear' ? F.clone().addScaledVector(U, 1 - 0.62 * a).normalize() : kind === 'stab' ? F.clone().addScaledVector(U, -0.05).normalize() : d0.clone().addScaledVector(U, kind === 'over' ? 0 : 0.18).normalize(); /* (the blade carries on out from the arm; a stab points straight ahead) */
  let edge = kind === 'spear' ? R.clone() : kind === 'stab' ? U.clone().negate() : tan.lengthSq() > 1e-8 ? tan.normalize() : F.clone(); edge.addScaledVector(blade, -edge.dot(blade)); if (edge.lengthSq() < 1e-6) { edge.copy(R).addScaledVector(blade, -R.dot(blade)); if (edge.lengthSq() < 1e-6) edge.copy(F).addScaledVector(blade, -F.dot(blade)); } edge.normalize(); /* (the sharp edge faces where the blade is going) */
  const X = edge, Y = blade, Z = new THREE.Vector3().crossVectors(X, Y).normalize(); X.crossVectors(Y, Z);
  const qW = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); /* (the weapon's own frame: y along the blade, x the edge) */
  const qS = qW.multiply((main.userData.baseQ || main.quaternion).clone().normalize().invert()).normalize(); /* (the socket's angle that lays the weapon so) */ if (![qS.x, qS.y, qS.z, qS.w, p.x, p.y, p.z].every(Number.isFinite)) return;
  const wT = /[?&]arcw0/.test(location.search) ? 0 : w; ch._arc = { p, q: qS, w: wT, pole: big ? S0.clone().addScaledVector(U, -1.0 * len).addScaledVector(R, 0.35 * len).addScaledVector(F, 0.15 * len) : S.clone().addScaledVector(R, 0.6 * len).addScaledVector(U, -0.5 * len).addScaledVector(F, -0.3 * len) }; /* (two hands on a haft: the elbows hang down, never flung up behind) */
}
function bowDraw(ch, H, B, act) { ch._bowD = null; const W = ch.weapons || {}, main = W.main; if (!act || ch._act !== 'shoot' || !main || main.name !== 'weapon_bow') return; const shL = B.LeftArm, shR = B.RightArm, hd = B.Head; if (!shL || !shR || !hd || !B.LeftForeArm || !B.LeftHand) return;
  H.m.updateMatrixWorld(true); const wq = H.wrap.getWorldQuaternion(new THREE.Quaternion()), U = new THREE.Vector3(0, 1, 0), F = new THREE.Vector3(0, 0, 1).applyQuaternion(wq).setY(0).normalize(), R = new THREE.Vector3().crossVectors(F, U).normalize();
  const SL = shL.getWorldPosition(new THREE.Vector3()), SR = shR.getWorldPosition(new THREE.Vector3()), Hp = hd.getWorldPosition(new THREE.Vector3()), len = SL.distanceTo(B.LeftForeArm.getWorldPosition(new THREE.Vector3())) + B.LeftForeArm.getWorldPosition(new THREE.Vector3()).distanceTo(B.LeftHand.getWorldPosition(new THREE.Vector3()));
  const k = Math.max(0, Math.min(1, (ch._st && ch._st.actionT) || 0)), w = Math.min(1, k / 0.12); /* (snapped up into the draw) */
  const L = SL.clone().addScaledVector(F, 0.93 * len).addScaledVector(R, 0.22 * len).addScaledVector(U, 0.04 * len); /* (bow arm straight out toward the target, in front of the eyes' line) */
  const Rr = Hp.clone().addScaledVector(F, 0.14 * len).addScaledVector(U, 0.06 * len).addScaledVector(R, 0.12 * len); /* (the anchor: the string hand at the corner of the jaw) */
  ch._bowD = { L, R: Rr, poleR: SR.clone().addScaledVector(R, 0.9 * len).addScaledVector(U, 0.05 * len).addScaledVector(F, -0.6 * len), w }; }
// the bow's string pulled back to the drawing fingers while he draws, with an arrow laid from the string to the bow; straight again after the loose
function bowString(ch, B) { const W = ch.weapons || {}, bw = W.main; if (!bw || bw.name !== 'weapon_bow' || !bw.userData.string) return; const sg = bw.userData.string, pa = sg.geometry.attributes.position; if (!sg.userData.mid) sg.userData.mid = new THREE.Vector3(pa.getX(1), pa.getY(1), pa.getZ(1));
  const D = ch._bowD, hd = B.RightHand; let ar = bw.userData.arrow3;
  if (!D || !hd || D.w < 0.05) { pa.setXYZ(1, sg.userData.mid.x, sg.userData.mid.y, sg.userData.mid.z); pa.needsUpdate = true; if (ar) ar.visible = false; return; }
  hd.updateWorldMatrix(true, false); const hp = hd.getWorldPosition(new THREE.Vector3()); bw.updateWorldMatrix(true, false); sg.updateWorldMatrix(true, false);
  const lp = sg.worldToLocal(hp.clone()), m = sg.userData.mid; pa.setXYZ(1, m.x + (lp.x - m.x) * D.w, m.y + (lp.y - m.y) * D.w, m.z + (lp.z - m.z) * D.w); pa.needsUpdate = true; /* (the nocking point on the fingers) */
  if (!ar) { ar = new THREE.Group(); const wood = new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.7 }), st = new THREE.MeshStandardMaterial({ color: '#b8bcc0', roughness: 0.3, metalness: 0.9 }), fe = new THREE.MeshStandardMaterial({ color: '#d8d0c0', roughness: 0.9, side: THREE.DoubleSide });
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 6), wood); sh.position.y = 0.5; ar.add(sh); const h2 = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.06, 4), st); h2.position.y = 1.02; ar.add(h2);
    for (let i = 0; i < 3; i++) { const v = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.11), fe); v.position.set(0, 0.08, 0); v.rotation.y = i * Math.PI * 2 / 3; v.translateX(0.015); ar.add(v); }
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })); fl.position.y = 1.0; fl.scale.set(1, 1.6, 1); ar.add(fl);
    ar.traverse(o => { if (o.isMesh) o.castShadow = false; }); ch.root.add(ar); /* (on the hero's root: hidden with him, e.g. in your own first person) */ bw.userData.arrow3 = ar; }
  const rest = bw.localToWorld(new THREE.Vector3(0, 0.03, 0)), dir = rest.clone().sub(hp), L = dir.length(); if (L < 1e-3) return; dir.divideScalar(L);
  ch.root.updateWorldMatrix(true, false); const rq = ch.root.getWorldQuaternion(new THREE.Quaternion()), rs = ch.root.getWorldScale(new THREE.Vector3()).x || 1; ar.visible = true; ar.position.copy(ch.root.worldToLocal(hp.clone())); ar.quaternion.copy(rq.invert().multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir))); ar.scale.setScalar(Math.max(0.5, L + 0.12) / rs); /* (nock on the string, shaft over the rest, the head just past the bow) */ }
// a recorded attack (made without a weapon): the weapon runs straight on from the forearm and its edge leads the way the hand is moving
function moveWeapon(ch, H, B, mvK, dt) { const main = ch.weapons && ch.weapons.main; if (!main || !main.parent || !/^weapon_(sword|greatsword|greataxe|axe|mace|warhammer|handaxe)/.test(main.name) || !B.RightHand || !B.RightForeArm) return;
  const ud = main.userData; const on = !!(mvK && PUNCH.test(ch._act || '') && H.D.moves && H.D.moves[mvK] && !/^(dead|cheer|roll|flip)$/.test(mvK)); H.mwK = (H.mwK || 0) + ((on ? 1 : 0) - (H.mwK || 0)) * Math.min(1, dt * 14);
  if (H.mwK < 0.01) { if (ud.mwBase) { main.quaternion.copy(ud.mwBase); main.position.copy(ud.mwBaseP); ud.mwBase = null; } H.mwPrev = null; return; } if (!ud.mwBase) { ud.mwBase = main.quaternion.clone(); ud.mwBaseP = main.position.clone(); }
  B.RightHand.updateWorldMatrix(true, false); const hp = B.RightHand.getWorldPosition(new THREE.Vector3()), fp = B.RightForeArm.getWorldPosition(new THREE.Vector3()), d = hp.clone().sub(fp).normalize();
  const v = H.mwPrev ? hp.clone().sub(H.mwPrev) : new THREE.Vector3(); H.mwPrev = hp.clone(); v.addScaledVector(d, -v.dot(d));
  if (H.D.steadyEdge) { const sw = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d); v.copy(sw.lengthSq() > 0.04 ? sw : (H.mwEdge || sw)); } /* (the warrior: no spinning in the hand: the edge faces the way a flat right-to-left sweep cuts, steady through wind-up and follow-through) */
  let edge = v.lengthSq() > 1e-8 ? v.normalize() : (H.mwEdge ? H.mwEdge.clone() : new THREE.Vector3(0, 1, 0)); edge.addScaledVector(d, -edge.dot(d)); if (edge.lengthSq() < 1e-6) return; edge.normalize(); H.mwEdge = H.mwEdge ? H.mwEdge.lerp(edge, 0.35).normalize() : edge.clone(); edge = H.mwEdge.clone(); edge.addScaledVector(d, -edge.dot(d)).normalize();
  const Z = new THREE.Vector3().crossVectors(edge, d).normalize(), qW = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(edge, d, Z)); /* (y along the blade or haft, x the edge) */
  main.parent.updateWorldMatrix(true, false); const lq = main.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qW); if (![lq.x, lq.y, lq.z, lq.w].every(Number.isFinite)) return;
  main.quaternion.copy(ud.mwBase).slerp(lq, H.mwK); main.position.copy(ud.mwBaseP).applyQuaternion(main.quaternion.clone().multiply(ud.mwBase.clone().invert())); } /* (turned about the fist: the haft stays in his hands) */
function puppetArms(ch, H, B) { ch.root.updateMatrixWorld(true); H.m.updateMatrixWorld(true); const W = ch.weapons || {}, main = W.main, so = {};
  for (const s of ch.hmSockets) if (s.userData.side && s.userData.fist) so[s.userData.side] = s;
  const lead = main && so.L && main.parent === so.L && !(so.R && main.parent === so.R) ? 'L' : 'R'; /* (the bow is held in the left fist) */
  for (const sd of [lead, lead === 'R' ? 'L' : 'R']) { if (sd !== lead && (H.shMount || H.D.oneHandGun)) continue; /* (the musketeer holds his gun in one hand: the other never reaches for it) */ /* (a shield on the other arm: that hand never reaches over for the sword) */ const s = so[sd], A = ch.arms[sd], nm = sd === 'R' ? 'Right' : 'Left', up = B[nm + 'Arm'], fore = B[nm + 'ForeArm'], hand = B[nm + 'Hand']; if (!s || !A || !A.sh || !up || !fore || !hand) continue; const keep = [up.quaternion.clone(), fore.quaternion.clone(), hand.quaternion.clone()], free = Math.min(1, H.ikA || 0); /* (the owner: at rest, walking, running, strafing and jumping the model's own clips swing its arms and the weapons ride its hands; the arms only follow the built body while he attacks or casts, blended in and out. A two-hander's second hand takes the haft only then) */ hand.updateWorldMatrix(true, false); const cf = hand.getWorldQuaternion(new THREE.Quaternion()).multiply(s.userData.fist.q); /* (the fist as the clip holds it) */
    const gb = builtGrip(s, _pm), sb = A.sh.getWorldPosition(_pv), eb = A.el.getWorldPosition(_pv2), hb = A.hand.getWorldPosition(_pv3), sm = up.getWorldPosition(new THREE.Vector3());
    const r = (fore.getWorldPosition(_pv4).distanceTo(sm) + hand.getWorldPosition(new THREE.Vector3()).distanceTo(_pv4)) / Math.max(1e-4, eb.distanceTo(sb) + hb.distanceTo(eb));
    const tgt = new THREE.Vector3().setFromMatrixPosition(gb).sub(sb).multiplyScalar(r).add(sm), qf = new THREE.Quaternion().setFromRotationMatrix(_pm2.extractRotation(gb)); /* (where the fist goes, and its angle) */
    const pole = eb.clone().sub(sb).multiplyScalar(r).add(sm).multiplyScalar(2).sub(tgt.clone().add(sm).multiplyScalar(0.5)); /* (the elbow bends the built elbow's way) */
    if (sd === lead && sd === 'R' && ch._arc) { const A2 = ch._arc; if (!/[?&]arcq/.test(location.search)) { tgt.lerp(A2.p, A2.w); pole.lerp(A2.pole, A2.w); } if (!/[?&]arcp/.test(location.search)) qf.slerp(A2.q, A2.w); } /* (melee: the arc around the model's own body, not the built body's swing) */
    if (free < 0.999) qf.slerp(cf, 1 - free); /* (at rest the fist keeps the clip's angle, then the rest carry below turns the wrist) */
    { const it = s.children.find(c => c.name && /^weapon_/.test(c.name)), tl = it && (it.userData.restTilt != null ? it.userData.restTilt : REST_TILT[it.name.slice(7)]); /* (userData.restTilt: one class's own rest angle, e.g. 'upF' for a staff carried upright, fingers forward) */ if (tl === 'up' || tl === 'upF') { const rest = 1 - Math.min(1, H.ikA || 0); if (rest > 0.01) { const cy = _pv4.set(0, 1, 0).applyQuaternion(qf), q2 = _pq.setFromUnitVectors(cy, new THREE.Vector3(0, 1, 0)); const up = q2.clone().multiply(qf), cz = new THREE.Vector3(0, 0, 1).applyQuaternion(up).setY(0), tz = (tl === 'upF' ? new THREE.Vector3(sd === 'L' ? -0.3 : 0.3, 0, 1) : new THREE.Vector3(sd === 'L' ? -1 : 1, 0, 0.35)).applyQuaternion(ch.root.getWorldQuaternion(_pq2)).setY(0); if (cz.lengthSq() > 1e-4 && tz.lengthSq() > 1e-4) q2.premultiply(new THREE.Quaternion().setFromUnitVectors(cz.normalize(), tz.normalize())); qf.premultiply(_pq2.identity().slerp(q2, rest)); /* (and turned broadside, the string toward his body, so it reads from the front and behind) */ } } else if (tl) { const rest = 1 - Math.min(1, H.ikA || 0), T2 = Array.isArray(tl) ? tl : [tl, 0]; if (rest > 0.01) { const rq = ch.root.getWorldQuaternion(_pq2); qf.premultiply(_pq.setFromAxisAngle(_pv4.set(1, 0, 0).applyQuaternion(rq), T2[0] * rest)); if (T2[1]) qf.premultiply(_pq.setFromAxisAngle(_pv4.set(0, 0, 1).applyQuaternion(rq), T2[1] * rest)); } } } /* ([tip down, tip out]: out to his side (-) keeps a sword clear of his own shield) */ /* (at rest a blade's tip drops toward the ground; the fist turns with it) */
    const qfr = qf.clone(); const o = sd === lead ? null : so[lead], sup = o && main && main.parent === o && SUPPORT[main.name.slice(7)];
    if (o && ch.hmSupport) { const sm2 = ch.hmSupport; sm2.updateWorldMatrix(true, false); tgt.setFromMatrixPosition(sm2.matrixWorld); qf.setFromRotationMatrix(_pm2.extractRotation(sm2.matrixWorld)); } /* (a marker on the weapon in the lead fist (y along the shaft, z along the fingers): the necromancer's left hand low on his scythe) */
    else if (sup) { main.updateWorldMatrix(true, false); const tm = new THREE.Matrix4().multiplyMatrices(main.matrixWorld, new THREE.Matrix4().compose(new THREE.Vector3(sup[0], sup[1], sup[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(sup[3], sup[4], sup[5])), _ps.set(1, 1, 1))); tgt.setFromMatrixPosition(tm); qf.setFromRotationMatrix(_pm2.extractRotation(tm)); } /* (a fixed place for the support hand on the weapon itself: the gun's fore-stock) */
    else if (o && main && main.parent === o) { /* a support hand near the main grip goes on to the model's weapon, where the built one holds the built weapon */
      const gm = builtGrip(o, _pm3.clone()), d = new THREE.Vector3().setFromMatrixPosition(gb).distanceTo(_pv4.setFromMatrixPosition(gm)) / Math.max(1e-4, (ch.scale || 1)), w2 = /musket|blunderbuss/.test(main.name) ? 1 : Math.max(0, Math.min(1, (0.75 - d) / 0.25)); /* (a gun is always held in both hands: the left on the fore-stock) */
      const big = /greatsword|greataxe|warhammer/.test(main.name), ws = big ? 1 : w2 * Math.min(1, H.ikA || 0);
      if (ws > 0 && !/musket|blunderbuss/.test(main.name)) { /* (two hands on a haft or grip: stacked one under the other on the same side, the lead hand nearer the head, the support hand a fist-width further down, closed the same way: never criss-crossed) */
        o.updateWorldMatrix(true, false); const lq = o.getWorldQuaternion(new THREE.Quaternion()), ax = new THREE.Vector3(0, 1, 0).applyQuaternion(main.getWorldQuaternion(_pq2)), hs2 = hand.getWorldScale(new THREE.Vector3()).x, dn = s.userData.fist.len * hs2 * (/greataxe|bers_axe/.test(main.name) ? 2.1 : 0.95); /* (the great axe: hands clearly apart on the haft, not bunched together) */
        tgt.lerp(o.getWorldPosition(new THREE.Vector3()).addScaledVector(ax, -dn), ws); qf.slerp(lq, ws); }
      else if (w2 > 0) { o.updateWorldMatrix(true, false); const rel = gm.invert().multiply(gb), mw = new THREE.Matrix4().compose(o.getWorldPosition(new THREE.Vector3()), o.getWorldQuaternion(new THREE.Quaternion()), _ps.set(1, 1, 1)), sc = o.getWorldScale(new THREE.Vector3()).x / Math.max(1e-6, new THREE.Vector3().setFromMatrixScale(builtGrip(o, new THREE.Matrix4())).x);
        rel.elements[12] *= sc; rel.elements[13] *= sc; rel.elements[14] *= sc; const tm = mw.multiply(rel); tgt.lerp(_pv4.setFromMatrixPosition(tm), w2); qf.slerp(_pq2.setFromRotationMatrix(_pm2.extractRotation(tm)), w2); } }
    if (o && free < 0.999) qf.copy(qfr.slerp(qf, free)); /* (the support hand only turns onto the weapon as he attacks) */
    if (ch._bowD) { const D2 = ch._bowD; if (sd === 'L') tgt.lerp(D2.L, D2.w); else { tgt.lerp(D2.R, D2.w); pole.lerp(D2.poleR, D2.w); } } /* (a bow drawn: the bow arm straight out at the target at shoulder height, the string hand back at the anchor under the chin, elbow up and out) */
    const F = s.userData.fist; s.position.copy(F.p); s.quaternion.copy(F.q); const qh = qf.clone().multiply(_pq.copy(F.q).invert()); /* (the hand bone's angle that lays the fist so) */ hand.updateWorldMatrix(true, false); const hs = hand.getWorldScale(new THREE.Vector3()).x;
    const wrist = tgt.clone().sub(F.p.clone().multiplyScalar(hs).applyQuaternion(qh));
    ikArm(null, up, fore, hand, wrist, pole); fore.updateWorldMatrix(true, false); if (free < 0.999) { up.quaternion.copy(keep[0].slerp(up.quaternion, free)); fore.quaternion.copy(keep[1].slerp(fore.quaternion, free)); up.updateWorldMatrix(true, true); fore.updateWorldMatrix(true, false); } hand.quaternion.copy(fore.getWorldQuaternion(_pq).invert().multiply(qh)); hand.updateWorldMatrix(true, true); } }
// glowing eyes set into the model's skull, riding on its head bone
function addEyes(m, E, k) { let head = null; m.traverse(o => { if (o.isBone && o.name === 'Head') head = o; }); if (!head) return; m.updateMatrixWorld(true);
  const hp = head.getWorldPosition(new THREE.Vector3()), fw = new THREE.Vector3(0, 0, 1).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion())), sd = new THREE.Vector3(1, 0, 0).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion())), s = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).y / 1.95; /* (offsets are for a 1.95 m model: scaled to this one's size) */
  const core = new THREE.MeshBasicMaterial({ color: E.col }), halo = new THREE.MeshBasicMaterial({ color: E.col, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const sx of [-1, 1]) { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(E.r * s, 10, 8), core)); const h = new THREE.Mesh(new THREE.SphereGeometry(E.r * 2.2 * s, 10, 8), halo); g.add(h);
    g.position.copy(hp).addScaledVector(fw, E.fwd * s).addScaledVector(sd, sx * E.side * s).add(new THREE.Vector3(0, E.up * s, 0)); m.parent ? m.parent.add(g) : m.add(g); head.attach(g); } }
// a relaxed standing pose built from the model's own rest pose: arms brought down to the sides, elbows soft
const _IDQ = new THREE.Quaternion(); const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
function aimBone(bone, child, worldDir) { bone.updateWorldMatrix(true, false); child.updateWorldMatrix(true, false); const a = bone.getWorldPosition(new THREE.Vector3()), b = child.getWorldPosition(new THREE.Vector3()), cur = b.sub(a).normalize();
  const qw = new THREE.Quaternion().setFromUnitVectors(cur, worldDir.clone().normalize()), bw = bone.getWorldQuaternion(new THREE.Quaternion()), pw = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  return pw.invert().multiply(qw.multiply(bw)); }
function idlePose(m, B) { const out = {}; m.updateMatrixWorld(true); const keep = {}; for (const k in B) keep[k] = B[k].quaternion.clone();
  for (const [sd, sx] of [['Left', 1], ['Right', -1]]) { const arm = B[sd + 'Arm'], fore = B[sd + 'ForeArm'], hand = B[sd + 'Hand']; if (!arm || !fore || !hand) continue;
    const side = new THREE.Vector3(arm.getWorldPosition(new THREE.Vector3()).x - m.getWorldPosition(new THREE.Vector3()).x, 0, 0).normalize();
    out[arm.name] = aimBone(arm, fore, new THREE.Vector3(side.x * 0.2, -1, 0.05)); arm.quaternion.copy(out[arm.name]); arm.updateMatrixWorld(true);
    out[fore.name] = aimBone(fore, hand, new THREE.Vector3(side.x * 0.12, -1, 0.3)); fore.quaternion.copy(out[fore.name]); fore.updateMatrixWorld(true); }
  for (const k in keep) B[k].quaternion.copy(keep[k]); return out; }
// turn a leg on its own axis (toes in or out), in world space so it works whatever way the bone was built
function twistLeg(up, low, ang) { if (!up || !low || !ang) return; up.updateWorldMatrix(true, false); low.updateWorldMatrix(true, false); const ax = low.getWorldPosition(_v1).sub(up.getWorldPosition(_v2)).normalize(); _q.setFromAxisAngle(ax, ang); const bw = up.getWorldQuaternion(_q2); const pw = up.parent.getWorldQuaternion(new THREE.Quaternion()); up.quaternion.copy(pw.invert().multiply(_q.multiply(bw))); }
function turnFoot(f, ax, ang) { if (!f) return; f.updateWorldMatrix(true, false); _q.setFromAxisAngle(ax, ang); const bw = f.getWorldQuaternion(_q2); const pw = f.parent.getWorldQuaternion(new THREE.Quaternion()); f.quaternion.copy(pw.invert().multiply(_q.multiply(bw))); }
function spreadLeg(up, fw, ang) { if (!up) return; up.updateWorldMatrix(true, false); _q.setFromAxisAngle(fw, ang); const bw = up.getWorldQuaternion(_q2); const pw = up.parent.getWorldQuaternion(new THREE.Quaternion()); up.quaternion.copy(pw.invert().multiply(_q.multiply(bw))); }
const isUnder = (o, set) => { for (let p = o; p; p = p.parent) if (set.has(p)) return true; return false; };

// which recorded move (if any) the character is doing right now, and how far into it
const LEG_BONES = ['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
const PUNCH = /^(swing|off|heavy|stab|smash|lowcut|sweep|charge|thrust|jab|shieldbash)/, LEFTP = /^(off|stabL|swing2)/;
function pickMove(H, ch, dt) {
  const M = Object.assign({ kd: ['kd', 0.1, 1.25, 0], up: ['up', 1.85, 6.2, 0] }, H.D.moves || {}), u = ch._u || {}, st = ch._st || {}, nm = (u.atk && u.atk.name) || ch._act || '';
  // whole moves (flying kick, superman punch) start once and play to the end on their own clock
  const trig = u.kickT > 0 ? 'flykick' : u.supermanT > 0 ? 'superman' : null;
  if (trig && M[trig] && (!H.latch || H.latch.key !== trig) && H.trigPrev !== trig) H.latch = { key: trig, t: 0 }; H.trigPrev = trig;
  let key = null, k = null;
  if (ch.kdLeft > 0 && !st.dead) { ch.kdLeft -= dt; H.kdT = (H.kdT || 0) + dt; key = 'kd'; k = Math.min(1, H.kdT / 1.15); if (ch.kdLeft < 1.35 && H.kdT > 0.95 && M.up) { key = 'up'; k = 1 - Math.max(0, ch.kdLeft) / 1.35; } } /* (the last stretch: he pushes himself up off his back and stands) */ else H.kdT = 0; /* (knocked down: thrown back off his feet, then he lies there until the stun wears off) */
  if (!key && st.dead && M.dead) { H.latch = null; H.deadT = (H.deadT || 0) + dt; key = 'dead'; k = H.deadT / (M.dead[2] - M.dead[1]); } else H.deadT = 0; /* (a real fall to the ground, then he lies still) */
  if (!key && ch.cheerT > 0 && M.cheer) { ch.cheerT -= dt; key = 'cheer'; k = 1 - ch.cheerT / 6; } /* (the arena is won: arms up for the crowd) */
  if (key) {} else if (H.latch) { const sl = M[H.latch.key]; H.latch.t += dt; k = H.latch.t / (sl[5] || 0.6); if (k >= 1) H.latch = null; else key = H.latch.key; }
  if (!st.airborne) H.airT = 0;
  if (!key) { if (st.rollKind === 'flip' && st.roll != null) { key = 'flip'; k = Math.min(1, Math.max(0, st.roll)); }
    else if (st.roll != null && M.roll) { const ra = Math.atan2(Math.sin(st.rollDir || 0), Math.cos(st.rollDir || 0)); key = Math.abs(ra) > 2.3 && M.rollB ? 'rollB' : ra > 0.8 && M.rollL ? 'rollL' : ra < -0.8 && M.rollR ? 'rollR' : 'roll'; k = Math.min(1, Math.max(0, st.roll)); } /* (the dodge's own direction picks the clip: forward roll, roll left, spin right, leap back) */ /* (a recorded roll for the dodge, e.g. the warrior's) */
    else if (st.charging && M.charge) { key = 'charge'; } /* (a shield charge: the recorded charge loops while he drives forward) */
    else if (st.airborne && M.jump && !st.action) { H.airT = (H.airT || 0) + dt; key = 'jump'; k = Math.min(1, H.airT / 0.85); } /* (a recorded jump while he is in the air) */
    else if (u.strike || /^(fury|area|spin)$/.test(nm)) { key = 'fury'; }
    else if (nm === 'kick') { key = 'kick'; k = st.actionT; }
    else if (H.D.moveFor && st.actionT != null && PUNCH.test(nm)) { key = H.D.moveFor[nm] || null; k = st.actionT; }
    else if (PUNCH.test(nm) && st.actionT != null) { k = st.actionT; const fresh = H.pK == null || k < H.pK - 0.25 || !H.inPunch; if (fresh) { H.combo = H.t - (H.lpT || -9) > 1.3 ? 0 : ((H.combo == null ? -1 : H.combo) + 1) % (H.D.combo || [0]).length; } H.lpT = H.t; H.inPunch = true; key = H.D.combo ? H.D.combo[H.combo] : LEFTP.test(nm) ? 'jab' : 'cross'; if (nm === 'smash' && H.D.finisher) { if (fresh) H.fin = ((H.fin || 0) + 1) % H.D.finisher.length; key = H.D.finisher[H.fin || 0]; } } } // (the combo's last, heavy blow is an uppercut or a lunging roundhouse) // (each new swing plays the next move of the combo: jab, cross, uppercut, spin kick...)
  if (!(PUNCH.test(nm) && st.actionT != null) || H.latch) H.inPunch = false; H.pK = st.actionT;
  if (!key || !M[key]) { H.mvKey = null; return null; }
  const sl = M[key]; if (key !== H.mvKey) { H.mvKey = key; H.mvT = 0; if (k != null && k > 0.5 && !sl[6]) k = 0; } H.mvT += dt; /* (a new blow starts at its own beginning: on its first frame the action clock can still read the last blow's end, which threw the hand a metre for one frame) */
  let t; if (sl[6]) { const span = sl[2] - sl[1]; t = sl[1] + ((H.mvT * 1.6) % span); }
  else { k = Math.min(1, Math.max(0, k || 0)); t = sl[3] ? (k < 0.3 ? sl[1] + (sl[3] - sl[1]) * (k / 0.3) : sl[3] + (sl[2] - sl[3]) * ((k - 0.3) / 0.7)) : sl[1] + (sl[2] - sl[1]) * k; } // (the blow lands 30% of the way into the attack, when the game's hit does)
  H.lastMove = { slice: sl, t, full: !!sl[4] }; return key;
}
// three's mixer only writes a bone when its blended value differs from the last frame's. Every frame starts from the
// rest pose (reset), so a bone whose track happens to hold still between two frames was left at rest: the monk's
// right shoulder snapped to its bind pose for a frame every few frames (the whole arm jumped). Spoiling the "last
// frame" copy before each update makes the mixer write every bone it drives, every time
function forceMix(mixer) { const prev = mixer._accuIndex, bs = mixer._bindings; if (prev == null || !bs) return; for (const pm of bs) { const e = pm.valueSize, o = prev * e + e, b = pm.buffer; for (let i = 0; i < e; i++) b[o + i] = 1e9; } }
// every frame: pick the animation from how fast the character is moving and blend between them
// a shield is worn the way a real one is: the forearm through the strap, the fist on the grip near the rim, the face outward.
// It rides the model's own left forearm (so it swings, rolls and turns with his arm) instead of the hand
const _sv = new THREE.Vector3(), _sv2 = new THREE.Vector3(), _sq = new THREE.Quaternion(), _sm = new THREE.Matrix4();
function wearShield(ch, H) {
  const sh = ch.weapons && ch.weapons.off; if (!sh || !/^weapon_shield/.test(sh.name || '')) return;
  const B = H.bones || {}; const fore = B.LeftForeArm, hand = B.LeftHand; if (!fore || !hand) return;
  if (!H.shMount) { const mt = new THREE.Group(); mt.name = 'shieldMount'; fore.add(mt); H.shMount = mt; }
  const mt = H.shMount;
  if (sh.parent !== mt) { mt.add(sh); sh.position.set(0, 0, 0); sh.quaternion.identity(); sh.scale.setScalar(1); H.shSized = false; }
  if (!H.shBasis) { // worked out once from the bind pose: the forearm's axis and the back of the forearm (the side the shield sits on)
    H.m.updateMatrixWorld(true); const e = fore.getWorldPosition(_sv), w = hand.getWorldPosition(_sv2), axis = w.clone().sub(e), len = axis.length(); axis.normalize();
    const up = new THREE.Vector3(0, 1, 0); const dors = up.clone().sub(axis.clone().multiplyScalar(up.dot(axis))).normalize(); /* (palms-down bind pose: the back of the forearm faces up) */
    const Z = dors, Y = new THREE.Vector3().crossVectors(axis, Z).normalize(), X = new THREE.Vector3().crossVectors(Y, Z).normalize(); /* (the shield lies across the forearm: face out, top toward his front when the arm hangs, point back) */
    const qW = new THREE.Quaternion().setFromRotationMatrix(_sm.makeBasis(X, Y, Z)), qF = fore.getWorldQuaternion(_sq).clone();
    const sF = fore.getWorldScale(new THREE.Vector3()).x; H.shBasis = { q: qF.invert().multiply(qW), len, sF };
    const local = hand.position.clone().multiplyScalar(0.5); mt.position.copy(local); mt.quaternion.copy(H.shBasis.q); mt.scale.setScalar(1 / sF); /* (world-sized mount, half way down the forearm) */ }
  let hasG = !!sh.userData.glb; if (!hasG && !H.shSized) sh.traverse(c => { if (c.userData && c.userData.glb) hasG = true; });
  if (!H.shSized && hasG) { H.m.updateMatrixWorld(true); const bx = new THREE.Box3().setFromObject(sh), hgt = (Math.max(bx.getSize(_sv).x, _sv.y, _sv.z) || 1) / Math.max(1e-6, sh.getWorldScale(_sv2).x) * Math.max(1e-6, mt.getWorldScale(_sv2).x); /* (its height at scale 1 on the mount, measured once the whole arm is up to date) */ const want = heroHeight(ch.app && (ch.app.cls || ch.app.outfit)) * 0.47; /* (a full heater shield: about two fifths of his height) */
    sh.scale.setScalar(1).multiplyScalar(want / Math.max(0.01, hgt)); sh.position.set(0, 0, 0.13 * want); H.shSized = true; } /* (sits just off the back of the forearm, face outward) */
}
// the shield arm: at rest it hangs by his side, the shield facing out to the left; on block the forearm comes up in front of him
// and, being strapped to it, the shield turns with it to face the enemy, point down toward the elbow
function shieldPose(ch, H, B, dt) {
  const mt = H.shMount, arm = B.LeftArm, fore = B.LeftForeArm, hand = B.LeftHand; if (!mt || !H.shBasis || !arm || !fore || !hand || mt.children.length === 0) return;
  const st = ch._st || {}; H.bk = (H.bk || 0) + (((st.block && !st.action) || st.charging ? 1 : 0) - (H.bk || 0)) * Math.min(1, dt * 12); const bk = H.bk;
  const wq = H.wrap.getWorldQuaternion(new THREE.Quaternion());
  if (H.shSide == null) { H.m.updateMatrixWorld(true); const p = arm.getWorldPosition(new THREE.Vector3()), w = H.wrap.getWorldPosition(new THREE.Vector3()); H.shSide = p.sub(w).applyQuaternion(wq.clone().invert()).x >= 0 ? 1 : -1; }
  const sx = H.shSide;
  if (bk > 0.01) { const k0 = arm.quaternion.clone(), k1 = fore.quaternion.clone();
    arm.quaternion.copy(aimBone(arm, fore, new THREE.Vector3(sx * 0.45, -0.4, 0.8).applyQuaternion(wq))); arm.updateMatrixWorld(true); /* (upper arm forward, elbow low) */
    fore.quaternion.copy(aimBone(fore, hand, new THREE.Vector3(-sx * 0.95, 0.06, 0.25).applyQuaternion(wq))); /* (forearm raised upright before him, fist by his chin: the shield stands up in front, point down) */
    if (bk < 0.999) { arm.quaternion.copy(k0.slerp(arm.quaternion.clone(), bk)); fore.quaternion.copy(k1.slerp(fore.quaternion.clone(), bk)); } }
  // lay the shield on the outside of the forearm: across it, face out to his left at rest (point back), straight ahead on block (point down)
  arm.updateMatrixWorld(true); const e = fore.getWorldPosition(new THREE.Vector3()), axis = hand.getWorldPosition(new THREE.Vector3()).sub(e).normalize();
  const Z = new THREE.Vector3(sx, 0, 0).lerp(new THREE.Vector3(0, 0.05, 1), bk).applyQuaternion(wq); Z.addScaledVector(axis, -Z.dot(axis)); if (Z.lengthSq() < 1e-6) return; Z.normalize();
  const yR = new THREE.Vector3(0, 0, 1).applyQuaternion(wq), yB = new THREE.Vector3(0, 1, 0); const Y = yR.lerp(yB, bk); Y.addScaledVector(Z, -Y.dot(Z)); if (Y.lengthSq() < 1e-6) return; Y.normalize(); const X = new THREE.Vector3().crossVectors(Y, Z).normalize(); Y.crossVectors(Z, X); /* (at rest the top points forward, the point back, face out to his left; on block it stands upright facing the enemy) */
  const qW = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); const qL = fore.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qW);
  const atk = !!(st.action && /^(swing|stab|slash|chop|smash|heavy|thrust|bash|lowcut|sweep|charge|off|shoot|cast)/.test(st.action)) && bk < 0.5; H.shA = (H.shA || 0) + ((atk ? 1 : 0) - (H.shA || 0)) * Math.min(1, dt * 10);
  if (!atk && H.shA < 0.05) H.shRest = qL.clone(); /* (the shield's set on the forearm while he stands: kept for the swing) */
  mt.quaternion.copy(H.shRest && H.shA > 0.001 ? qL.slerp(H.shRest, H.shA) : qL); /* (while he attacks the shield rides the forearm itself, turning and twisting with every move of the arm, then settles back) */
}
export function tickHeroModel(ch, dt) {
  const H = ch && ch.heroModel; if (!H || H === 'loading' || dt <= 0) return;
  try { wearShield(ch, H); } catch (e) { /* (keeps the hand-held shield if anything is missing) */ }
  const p = ch.root.position, dx = p.x - H.lp.x, dz = p.z - H.lp.z, sp = Math.hypot(dx, dz) / dt; H.lp.copy(p); H.v += (Math.min(sp, 12) - H.v) * Math.min(1, dt * 8);
  // which way he is moving compared with where he faces: forward 0, right +90°, back 180°
  if (sp > 0.4) { const fw = new THREE.Vector3(0, 0, 1).applyQuaternion(ch.root.getWorldQuaternion(new THREE.Quaternion())), a = Math.atan2(dx * fw.z - dz * fw.x, dx * fw.x + dz * fw.z); H.mvA = a; }
  const A = sp > 0.4 ? (H.mvA || 0) : 0, back = Math.abs(A) > 1.95; H.backK = (H.backK || 0) + ((back && H.v > 0.25 ? 1 : 0) - (H.backK || 0)) * Math.min(1, dt * 10);
  let legT = back ? A - Math.sign(A) * Math.PI : A; legT = Math.max(-1.15, Math.min(1.15, legT)) * (H.v > 0.25 ? 1 : 0); H.legYaw = (H.legYaw || 0) + (legT - (H.legYaw || 0)) * Math.min(1, dt * 9);
  const walkW = H.v < 0.25 ? 0 : (back || H.v < H.D.runSpeed * 0.6) ? 1 : Math.max(0, 1 - (H.v - H.D.runSpeed * 0.6) / (H.D.runSpeed * 0.4)), runW = back || H.v < H.D.runSpeed * 0.6 ? 0 : 1 - walkW, /* (backing up is always a walk, never a run) */ idleW = 1 - Math.min(1, H.v / 0.25);
  const lerpW = (k, t) => { H.w[k] += (t - H.w[k]) * Math.min(1, dt * 10); };
  // heavy heroes run heavy: part of the run is the walk (synced to the same stride), so the feet stay closer to the ground
  // and the legs don't splay into a bounding leap; their hips bob less (below). A light hero keeps the full run
  const heavy = H.D.runRate ? 0 : Math.max(0, Math.min(1, (H.D.height * HERO_SIZE - 4.6) / 1.4)), hv = H.act.walk && H.act.run ? runW * 0.75 * heavy : 0; H.heavy = heavy;
  lerpW('walk', (walkW + hv) * (1 - idleW)); lerpW('run', (runW - hv) * (1 - idleW)); lerpW('idle', idleW);
  const sf = Math.max(0.6, (H.D.height * HERO_SIZE) / 2.6); /* (stride grows with the hero: a giant takes slow, long steps, a goblin quick little ones) */ if (H.act.walk) { H.act.walk.setEffectiveWeight(H.w.walk); H.act.walk.timeScale = Math.max(0.3, H.v / (H.D.walkSpeed * sf)); }
  if (H.act.run) { H.act.run.setEffectiveWeight(H.w.run); H.act.run.timeScale = Math.min(1.6, Math.max(0.35, H.v / (H.D.runSpeed * sf))) * (H.D.runRate || 1) * (H.D.jogK ? H.D.jogK + (1 - H.D.jogK) * Math.max(0, Math.min(1, (H.v - 6.5) / 2.5)) : 1); } /* (jogK: a class whose run looked like a sprint runs a slower stride, and only a real sprint gets the full pace) */
  if (H.act.walk) H.act.walk.timeScale = Math.min(1.4, H.act.walk.timeScale);
  if (H.act.back) { const bw = H.backK * (H.w.walk + H.w.run); H.act.back.paused = false; H.act.back.setEffectiveWeight(bw); H.act.back.timeScale = Math.min(1.6, Math.max(0.3, H.v / (H.D.walkSpeed * sf) * 0.8)); if (H.act.walk) H.act.walk.setEffectiveWeight(H.w.walk * (1 - H.backK)); if (H.act.run) H.act.run.setEffectiveWeight(H.w.run * (1 - H.backK)); }
  else if (H.backK > 0.5 && H.act.walk) { H.act.walk.timeScale = -Math.abs(H.act.walk.timeScale); if (H.act.run) H.act.run.timeScale = -Math.abs(H.act.run.timeScale); } // (no backwards clip: the walk plays in reverse)
  if (H.act.walk && H.act.run && H.w.walk > 0.02 && H.w.run > 0.02) { const wc = H.act.walk.getClip().duration, rc = H.act.run.getClip().duration; H.act.walk.time = (H.act.run.time / rc) * wc; } // (walk and run kept in step while blending, so the legs never fight each other)
  const reset = () => { for (const k in H.bind) { const b = H.bones[k]; b.quaternion.copy(H.bind[k][0]); b.position.copy(H.bind[k][1]); b.scale.set(1, 1, 1); } }; // (start every frame from the rest pose, so nothing builds up frame after frame: no spinning)
  reset(); const mvK = pickMove(H, ch, dt); for (const k in H.act) if (k !== 'walk' && k !== 'run' && k !== 'back') H.act[k].setEffectiveWeight(0);
  const stA = H.D.idleClip && H.act[H.D.idleClip]; if (stA) { if (H.D.idleHold != null) { stA.paused = true; stA.time = H.D.idleHold; } else stA.paused = false; stA.setEffectiveWeight(H.w.idle); } /* (idleHold: stand still in one frame of the stance instead of looping it) */ /* (standing still: his own recorded fighting stance, looping) */
  forceMix(H.mixer); H.mixer.update(dt); H.t += dt; const B = H.bones;
  if (B.Hips && H.heavy > 0) { const hy = B.Hips.position.y; H.hipAvg = H.hipAvg == null ? hy : H.hipAvg + (hy - H.hipAvg) * Math.min(1, dt * 2.5); B.Hips.position.y = H.hipAvg + (hy - H.hipAvg) * (1 - 0.7 * H.heavy * Math.min(1, H.w.run + H.w.walk)); } /* (a heavy hero's hips barely rise and fall: weight, not bounce) */
  H.mw = (H.mw || 0) + ((mvK ? 1 : 0) - (H.mw || 0)) * Math.min(1, dt * (mvK ? (H.D.mwIn || 30) : 9)); /* (mwIn: a class that eases into its recorded swings instead of snapping) */ // (snaps into an attack, eases back out of it)
  if (H.mw > 0.01 && H.lastMove) { const [ck, a, b2] = H.lastMove.slice; const A = H.act[ck];
    if (A) { const legs = {}; const moving = Math.max(Math.min(1, H.v / 1.5), H.D.keepLegs && PUNCH.test(ch._act || '') ? 0.85 : 0) * (H.lastMove.full ? 0 : 1); /* (keepLegs: the recording swings the arms and body; his feet stay planted in his own stance) */ for (const k of LEG_BONES) if (B[k]) legs[k] = B[k].quaternion.clone(); const hipP = B.Hips ? B.Hips.position.clone() : null;
      reset(); for (const k in H.act) H.act[k].setEffectiveWeight(k === ck ? H.mw : k === 'walk' ? H.w.walk * (1 - H.mw) * (1 - (H.act.back ? H.backK : 0)) : k === 'run' ? H.w.run * (1 - H.mw) * (1 - (H.act.back ? H.backK : 0)) : k === 'back' ? (H.w.walk + H.w.run) * H.backK * (1 - H.mw) : k === H.D.idleClip ? H.w.idle * (1 - H.mw) : 0); A.time = H.lastMove.t; forceMix(H.mixer); H.mixer.update(0);
      for (const k of LEG_BONES) if (legs[k] && B[k]) B[k].quaternion.slerp(legs[k], moving); if (hipP && moving > 0) B.Hips.position.lerp(hipP, moving); } }
  if (H.D.rootMove && H.lastMove && H.mvKey && H.D.rootMove.includes(H.mvKey) && H.act[H.lastMove.slice[0]] && B.Hips && B.Hips.parent) { const R0 = H.act[H.lastMove.slice[0]].getClip().userData && H.act[H.lastMove.slice[0]].getClip().userData.root; if (R0) {
      const at = (tt) => { const T = R0.t; let i = 0; while (i < T.length - 2 && T[i + 1] < tt) i++; const f = Math.max(0, Math.min(1, (tt - T[i]) / Math.max(1e-6, T[i + 1] - T[i]))), v = R0.v; return new THREE.Vector3(v[i * 3] + (v[i * 3 + 3] - v[i * 3]) * f, v[i * 3 + 1] + (v[i * 3 + 4] - v[i * 3 + 1]) * f, v[i * 3 + 2] + (v[i * 3 + 5] - v[i * 3 + 2]) * f); };
      const par = B.Hips.parent; par.updateWorldMatrix(true, false); const tt = H.lastMove.t, t0 = H.lastMove.slice[1]; const W = (lp) => lp.clone().applyMatrix4(par.matrixWorld);
      const off = W(at(tt)).sub(W(at(t0))); off.y = 0; /* (how far the recording has carried the hips since this blow began, in the world) */
      if (H.rmKey !== H.mvKey || tt < (H.rmT || 0)) { H.rmKey = H.mvKey; H.rmOff = new THREE.Vector3(); } H.rmT = tt;
      const d = off.clone().sub(H.rmOff); H.rmOff.copy(off); if (d.lengthSq() < 1) (ch._rootDelta || (ch._rootDelta = new THREE.Vector3())).add(d); /* (the hero himself moves on by the step) */
      const hw = B.Hips.getWorldPosition(new THREE.Vector3()).sub(off); B.Hips.position.copy(par.worldToLocal(hw)); } } else H.rmKey = null; /* (and the hips are held over him, so the body never runs ahead of where he stands) */
  // standing still: the rest pose with the arms down at the sides, a slow breath and a little weight shift
  const free = 1 - (H.mw || 0); if (H.w.idle > 0.01 && free > 0.01 && !stA) { for (const k in H.idle) B[k].quaternion.slerp(H.idle[k], H.w.idle * free); const br = Math.sin(H.t * 1.7) * 0.025 * H.w.idle; if (B.Spine01) B.Spine01.rotateX(br); if (B.neck) B.neck.rotateX(-br * 0.6); if (B.Hips) B.Hips.rotateZ(Math.sin(H.t * 0.6) * 0.02 * H.w.idle); }
  // running: toes turned in a touch; smaller feet
  const mv = H.w.run + H.w.walk * 0.5, ti = (H.D.toeIn || 0) * mv; if (ti) { const up = new THREE.Vector3(0, 1, 0); turnFoot(B.LeftFoot, up, -ti); turnFoot(B.RightFoot, up, ti); } // (only the feet turn in, at the ankle: the legs stay apart)
  const spr = (H.D.legSpread || 0) * mv; if (spr) { const fw = new THREE.Vector3(0, 0, 1).applyQuaternion(H.m.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize(); spreadLeg(B.LeftUpLeg, fw, spr); spreadLeg(B.RightUpLeg, fw, -spr); } // (feet kept apart so the legs never cross)
  // strafing or running at an angle: hips and legs turn toward where he is going, the chest turns back to face the aim
  if (Math.abs(H.legYaw) > 0.01 && B.Hips) { const up = new THREE.Vector3(0, 1, 0); turnFoot(B.Hips, up, H.legYaw); const sp1 = B.Spine01 || B.Spine; if (sp1) turnFoot(sp1, up, -H.legYaw * 0.6); const sp2 = B.Spine02; if (sp2) turnFoot(sp2, up, -H.legYaw * 0.4); }
  if (H.D.footScale) for (const k of ['LeftFoot', 'RightFoot']) if (B[k]) B[k].scale.setScalar(H.D.footScale);
  // the hidden built body still performs every attack, kick, flip and roll: the model's hands and feet follow it there
  H.wrap.position.copy(ch.body.position); { const want = H.lastMove && H.lastMove.full ? Math.min(1, H.mw * 1.4) : 0; H.fullK = (H.fullK || 0) + (want - (H.fullK || 0)) * Math.min(1, dt * 14); const fk = H.fullK; H.wrap.quaternion.copy(ch.body.quaternion).slerp(_IDQ, fk); H.wrap.position.y += (0 - H.wrap.position.y) * fk; } /* (a recorded roll or flip moves the body itself: the built body's own tumble fades out smoothly instead of snapping) */ H.wrap.updateMatrixWorld(true); // (a recorded flip or jump kick moves the whole body itself: the built body's own flip is not added on top)
  const gunHold = !!(ch.wt && /musket|blunderbuss/.test(ch.wt)) && !H.D.oneHandGun, act = !!((ch._act && /^(swing|stab|slash|chop|smash|heavy|cast|shoot|thrust|reap|jab|off|charge|bash|shieldbash|throw|lunge|sweep|spin|strike|cleave|slam|uppercut|hook|punch|kick|lowcut)/.test(ch._act)) || ch._strike || gunHold), /* (only a real attack or cast hands the arms to the built body: running, sprinting and standing never do) */ /* (a gun is always held in both hands: the model's hands stay on the stock and fore-end) */ /* (holding a staff out to aim is not an attack: the model's arms stay natural) */ kicking = !!(ch._u && ch._u.kickT > 0) || ch._act === 'kick', kickL = kicking && ch.legs && (ch.legs.L.thigh.rotation.x < -0.75), kickR = kicking && ch.legs && (ch.legs.R.thigh.rotation.x < -0.75); /* (only a real kick moves the model's legs: a long running stride must not) */
  H.ikA = (H.ikA || 0) + ((act && !mvK ? 1 : 0) - (H.ikA || 0)) * Math.min(1, dt * 14); // (a recorded move drives the arms itself)
  // the body swings with the blow: the chest winds back, then turns (or bends) through the strike, so the arms and the torso move together
  { const st2 = ch._st || {}, nm2 = ch._act || '', kT = st2.actionT; let tw = 0, bend = 0;
    if (act && !mvK && kT != null && /^(swing|slash|chop|smash|heavy|cleave|sweep|lowcut|stab|thrust|reap|charge|bash|lunge|strike|slam|off)/.test(nm2)) {
      const k = Math.max(0, Math.min(1, kT)), sm = (x) => x * x * (3 - 2 * x), wind = k < 0.3 ? sm(k / 0.3) : 1, thru = k < 0.3 ? 0 : k < 0.72 ? sm((k - 0.3) / 0.42) : 1, back = k < 0.72 ? 1 : 1 - sm((k - 0.72) / 0.28);
      const side = /^(swing2|off|backhand)/.test(nm2) ? -1 : 1;
      if (/^(swing3|smash|heavy|chop|slam|cleave)/.test(nm2)) { tw = (-0.32 * wind + 0.5 * thru) * back; bend = (-0.12 * wind + 0.42 * thru) * back; } /* (overhead: coil and lean back, then fold forward into the chop) */
      else if (/^(stab|thrust|lunge|charge|bash)/.test(nm2)) { tw = (-0.35 * wind + 0.7 * thru) * back; bend = 0.16 * thru * back; } /* (a stab: the right shoulder drives forward) */
      else { tw = side * (-0.55 * wind + 1.15 * thru) * back; bend = 0.08 * thru * back; } /* (a side cut: wind the chest back, then turn it right through the swing) */ }
    H.twS = (H.twS || 0) + (tw - (H.twS || 0)) * Math.min(1, dt * 18); H.bdS = (H.bdS || 0) + (bend - (H.bdS || 0)) * Math.min(1, dt * 18);
    if (Math.abs(H.twS) > 0.005 || Math.abs(H.bdS) > 0.005) { const wqq = H.wrap.getWorldQuaternion(new THREE.Quaternion()), upA = new THREE.Vector3(0, 1, 0), rtA = new THREE.Vector3(1, 0, 0).applyQuaternion(wqq);
      for (const [nmB, f] of [['Spine', 0.35], ['Spine01', 0.35], ['Spine02', 0.3]]) { const bb = B[nmB]; if (!bb) continue; turnFoot(bb, upA, H.twS * f); turnFoot(bb, rtA, H.bdS * f); } H.m.updateMatrixWorld(true); } }
  try { meleeArc(ch, H, B, act, mvK); } catch (e) { ch._arc = null; }
  try { bowDraw(ch, H, B, act); } catch (e) { ch._bowD = null; }
  if (ch.hmSockets && ch.arms && (H.ikA || 0) > 0.02) puppetArms(ch, H, B); /* (the owner: no hands pulled to the middle of the body, ever: outside attacks the model's own clips drive the arms and the weapon simply rides the fist) */ /* (holding something: the model's arms and fists follow the built body's all the time, and the weapon is fixed in the fist) */
  else if (H.ikA > 0.02 && ch.arms) for (const [sd, nm, sx] of [['R', 'Right', -1], ['L', 'Left', 1]]) { const hp = ch.arms[sd].hand; if (!hp) continue; const t = hp.getWorldPosition(new THREE.Vector3()), sh = B[nm + 'Arm']; if (!sh) continue; const s0 = sh.getWorldPosition(new THREE.Vector3()), wq = H.m.getWorldQuaternion(new THREE.Quaternion());
    const pole = s0.clone().add(new THREE.Vector3(sx * 0.4, -0.6, -0.35).applyQuaternion(wq)); const keep = [B[nm + 'Arm'].quaternion.clone(), B[nm + 'ForeArm'].quaternion.clone()]; ikArm(null, B[nm + 'Arm'], B[nm + 'ForeArm'], B[nm + 'Hand'], s0.clone().lerp(t, 1), pole);
    if (H.ikA < 0.99) { B[nm + 'Arm'].quaternion.copy(keep[0].slerp(B[nm + 'Arm'].quaternion.clone(), H.ikA)); B[nm + 'ForeArm'].quaternion.copy(keep[1].slerp(B[nm + 'ForeArm'].quaternion.clone(), H.ikA)); } }
  /* (guns too: puppetArms keeps both hands on the stock and fore-end the way the built body holds it) */
  try { bowString(ch, B); } catch (e) { /* (leave the string straight) */ }
  try { moveWeapon(ch, H, B, mvK, dt); } catch (e) { /* (leave the weapon as the fist holds it) */ }
  if (ch.legs && !mvK) for (const [sd, nm, on] of [['R', 'Right', kickR], ['L', 'Left', kickL]]) { if (!on) continue; const t = ch.legs[sd].ankle.getWorldPosition(new THREE.Vector3()), hip = B[nm + 'UpLeg']; if (!hip) continue; const h0 = hip.getWorldPosition(new THREE.Vector3()), wq = H.m.getWorldQuaternion(new THREE.Quaternion());
    ikArm(null, B[nm + 'UpLeg'], B[nm + 'Leg'], B[nm + 'Foot'], t, h0.clone().add(new THREE.Vector3(0, 0.3, 0.8).applyQuaternion(wq))); } // (kicks: the model's leg goes where the built leg kicks)
  { const fwH = new THREE.Vector3(0, 0, 1).applyQuaternion(H.wrap.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize(), UP = new THREE.Vector3(0, 1, 0), rest = 1 - Math.min(1, H.ikA || 0);
    for (const sp of [ch.weapons && ch.weapons.main, ch.weapons && ch.weapons.off]) { if (!sp || !sp.parent) continue;
      const want = sp.name === 'weapon_spear' ? fwH.clone().addScaledVector(UP, 0.35) : sp.name === 'weapon_musket' && H.D.oneHandGun ? fwH.clone().add(UP) : sp.name === 'weapon_dagger' && sp.userData.restTilt != null ? fwH.clone().addScaledVector(UP, 0.3) : sp.name === 'weapon_bow' ? UP.clone() : null; if (!want) continue; want.normalize(); /* (at rest: the shaman's spear points forward, the musketeer's gun stands up at his side, the rogue's blades stand up and forward out of her fists) */
      const ud = sp.userData; if (!ud.baseQ) { ud.baseQ = sp.quaternion.clone(); ud.baseP = sp.position.clone(); } sp.quaternion.copy(ud.baseQ); sp.position.copy(ud.baseP); if (rest < 0.01) continue;
      sp.parent.updateWorldMatrix(true, false); const pq = sp.parent.getWorldQuaternion(new THREE.Quaternion()), wq0 = pq.clone().multiply(ud.baseQ), cy = new THREE.Vector3(0, 1, 0).applyQuaternion(wq0);
      const wq1 = new THREE.Quaternion().setFromUnitVectors(cy, want).multiply(wq0); if (sp.name === 'weapon_bow') { const z1 = new THREE.Vector3(0, 0, 1).applyQuaternion(wq1).setY(0); if (z1.lengthSq() > 1e-4) wq1.premultiply(new THREE.Quaternion().setFromUnitVectors(z1.normalize(), fwH.clone().negate())); } /* (the bow upright, riser in the fist, string toward his body) */ else if (sp.name === 'weapon_musket') { const z1 = new THREE.Vector3(0, 0, 1).applyQuaternion(wq1); z1.addScaledVector(want, -z1.dot(want)); const tz = UP.clone().addScaledVector(want, -UP.dot(want)); if (z1.lengthSq() > 1e-6 && tz.lengthSq() > 1e-6) wq1.premultiply(new THREE.Quaternion().setFromUnitVectors(z1.normalize(), tz.normalize())); } /* (the musket's sights up, trigger down) */ const lq = pq.invert().multiply(wq1); if (![lq.x, lq.y, lq.z, lq.w].every(Number.isFinite)) continue;
      sp.quaternion.slerp(lq, rest); sp.position.copy(ud.baseP).applyQuaternion(sp.quaternion.clone().multiply(ud.baseQ.clone().invert())); } } /* (turned about the fist, so the grip stays in the hand) */
  try { shieldPose(ch, H, B, dt); } catch (e) { /* (leave the arm to its clip) */ }
}

// (shared IK helper is defined below)
// ---------- first person: your own model's arms, reaching to where the view model's hands are ----------
// A second copy of the model sits in the view-model space with its eyes at the camera (head shrunk away so it never
// fills the screen); each frame both arms are bent with two-bone IK so the model's hands land on the view-model hands.
// keep only the triangles skinned to the arms (upper arm, forearm, hand): the first-person copy is a pair of arms with nothing behind them.
// Each arm becomes its own mesh, and each hand gets a "closed" shape (a morph target): the rig has no finger bones, so the fingers
// are bent round a handle-sized cylinder past the knuckles, and the hand closes whenever it holds something
const ARM_SIDES = { Right: ['RightArm', 'RightForeArm', 'RightHand'], Left: ['LeftArm', 'LeftForeArm', 'LeftHand'] };
function armsOnly(F) { const { m, D } = F; F.hm = { Right: [], Left: [] }; F.grip = {}; const metas = [];
  m.traverse(o => { if (o.isSkinnedMesh && o.skeleton) metas.push(o); });
  for (const o of metas) { const g0 = o.geometry, si = g0.attributes.skinIndex, sw = g0.attributes.skinWeight, pos = g0.attributes.position; if (!si || !sw || !pos) continue; const n = si.count, idx = g0.index ? g0.index.array : null, tri = idx ? idx.length : n;
    const per = {}; for (const sd in ARM_SIDES) { const ids = new Set(), hb = o.skeleton.bones.findIndex(b => b.name === sd + 'Hand'); o.skeleton.bones.forEach((b, i) => { if (ARM_SIDES[sd].includes(b.name)) ids.add(i); }); const aw = new Float32Array(n), hw = new Float32Array(n);
      for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { const j = si.getComponent(i, k), w = sw.getComponent(i, k); if (ids.has(j)) aw[i] += w; if (j === hb) hw[i] += w; }
      const keep = []; for (let t = 0; t < tri; t += 3) { const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, c = idx ? idx[t + 2] : t + 2; if (aw[a] > 0.5 && aw[b] > 0.5 && aw[c] > 0.5) keep.push(a, b, c); } per[sd] = { keep, hw, hb }; }
    const total = per.Right.keep.length + per.Left.keep.length; if (total < tri * 0.01) continue; // (no arms found on this mesh: leave it whole)
    const mp = new Float32Array(pos.array.length), mn = g0.attributes.normal ? new Float32Array(g0.attributes.normal.array.length) : null; for (let i = 0; i < n; i++) { mp[i * 3] = pos.getX(i); mp[i * 3 + 1] = pos.getY(i); mp[i * 3 + 2] = pos.getZ(i); if (mn) { const nn = g0.attributes.normal; mn[i * 3] = nn.getX(i); mn[i * 3 + 1] = nn.getY(i); mn[i * 3 + 2] = nn.getZ(i); } }
    for (const sd in per) if (per[sd].hb >= 0) curlHand(F, o, sd, per[sd], pos, g0.attributes.normal, mp, mn);
    const mA = new THREE.BufferAttribute(mp, 3), nA = mn ? new THREE.BufferAttribute(mn, 3) : null; let first = true;
    for (const sd in per) { if (!per[sd].keep.length) continue; const g = new THREE.BufferGeometry(); for (const k in g0.attributes) g.setAttribute(k, g0.attributes[k]); g.setIndex(per[sd].keep); g.morphAttributes.position = [mA]; if (nA) g.morphAttributes.normal = [nA]; g.morphTargetsRelative = false; if (Array.isArray(o.material)) g.addGroup(0, per[sd].keep.length, 0);
      let mesh; if (first) { mesh = o; o.geometry = g; first = false; } else { mesh = new THREE.SkinnedMesh(g, o.material); mesh.castShadow = false; mesh.frustumCulled = false; mesh.position.copy(o.position); mesh.quaternion.copy(o.quaternion); mesh.scale.copy(o.scale); o.parent.add(mesh); mesh.bind(o.skeleton, o.bindMatrix); }
      mesh.updateMorphTargets(); mesh.morphTargetInfluences[0] = 0; F.hm[sd].push(mesh); } }
}
// the closed hand, in the skeleton's bind space: fingers past the knuckles wrap round a cylinder lying across the palm
function curlHand(F, o, sd, P, pos, nrm, mp, mn) {
  const sk = o.skeleton, hand = sk.bones[P.hb], fore = sk.bones.find(b => b.name === sd + 'ForeArm'); if (!fore) return; const inv = (b) => new THREE.Matrix4().copy(sk.boneInverses[sk.bones.indexOf(b)]).invert();
  const H0 = new THREE.Vector3().setFromMatrixPosition(inv(hand)), E0 = new THREE.Vector3().setFromMatrixPosition(inv(fore)), fw = H0.clone().sub(E0).normalize(), dn = new THREE.Vector3(0, -1, 0); dn.addScaledVector(fw, -dn.dot(fw)).normalize(); const ww = new THREE.Vector3().crossVectors(fw, dn);
  const bm = o.bindMatrix, bmi = bm.clone().invert(), /* (computed here: the clone's own inverse is not always filled in yet) */ nm3 = new THREE.Matrix3().getNormalMatrix(bm), nmi = new THREE.Matrix3().getNormalMatrix(bmi), v = new THREE.Vector3(), q = new THREE.Vector3(); const us = [], list = [];
  for (let i = 0; i < pos.count; i++) { if (P.hw[i] < 0.5) continue; v.fromBufferAttribute(pos, i).applyMatrix4(bm).sub(H0); list.push(i); us.push(v.dot(fw)); }
  if (list.length < 30) return; const sorted = us.slice().sort((a, b) => a - b), Lh = sorted[Math.floor(sorted.length * 0.97)]; if (!(Lh > 0)) return;
  const cfg = F.D.fpCurl || [0.5, 0.11, 3.6], k = cfg[0] * Lh, R = cfg[1] * Lh; let vp = -Infinity; // (knuckles at half the hand's length; a handle about a ninth of it in radius)
  for (let j = 0; j < list.length; j++) { if (us[j] < 0.25 * Lh || us[j] > k) continue; v.fromBufferAttribute(pos, list[j]).applyMatrix4(bm).sub(H0); vp = Math.max(vp, v.dot(dn)); } if (!isFinite(vp)) vp = 0.12 * Lh;
  const cv = vp + R; // (the handle's centre: just off the palm's surface)
  for (let j = 0; j < list.length; j++) { const i = list[j], u = us[j]; if (u <= k) continue; v.fromBufferAttribute(pos, i).applyMatrix4(bm).sub(H0); const vv = v.dot(dn), wv = v.dot(ww), r = cv - vv, th = Math.min(cfg[2], (u - k) / R), c = Math.cos(th), s2 = Math.sin(th);
    q.copy(H0).addScaledVector(fw, k + r * s2).addScaledVector(dn, cv - r * c).addScaledVector(ww, wv).applyMatrix4(bmi); mp[i * 3] = q.x; mp[i * 3 + 1] = q.y; mp[i * 3 + 2] = q.z;
    if (mn && nrm) { v.fromBufferAttribute(nrm, i).applyMatrix3(nm3); const nu = v.dot(fw), nv = v.dot(dn), nw = v.dot(ww); q.set(0, 0, 0).addScaledVector(fw, nu * c - nv * s2).addScaledVector(dn, nu * s2 + nv * c).addScaledVector(ww, nw).applyMatrix3(nmi).normalize(); mn[i * 3] = q.x; mn[i * 3 + 1] = q.y; mn[i * 3 + 2] = q.z; } }
  const bi = sk.boneInverses[P.hb], toB = (x) => x.clone().applyMatrix4(bi), C = H0.clone().addScaledVector(fw, k).addScaledVector(dn, cv);
  const th = new THREE.Vector3(0, 0, 1); th.addScaledVector(fw, -th.dot(fw)); const hs = new THREE.Vector3().crossVectors(fw, dn).dot(th) >= 0 ? 1 : -1; /* (the thumb points forward in the rest pose: which side of the palm it is on) */
  const o0 = toB(H0); F.grip[sd] = { hs, C: toB(C), fw: toB(H0.clone().add(fw)).sub(o0).normalize(), dn: toB(H0.clone().add(dn)).sub(o0).normalize() }; // (the handle's centre and the hand's own axes, in the hand bone's space)
}
export function attachFpArms(vm, cls) {
  if (!vm || !hasHeroModel(cls) || vm.fpArms) return; vm.fpArms = 'loading'; const D = MODELS[cls];
  loadClass(cls).then(({ base }) => {
    const m = SkeletonUtils.clone(base); m.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(m), k = (D.fpHeight || 1.95) / Math.max(0.01, box.getSize(new THREE.Vector3()).y); // (first person is always drawn at one human size, whatever size the class stands in the world: the view model never scales with the hero)
    const inner = new THREE.Group(); inner.add(m); m.scale.multiplyScalar(k); m.position.y = -box.min.y * k; inner.rotation.y = Math.PI; const wrap = new THREE.Group(); wrap.add(inner); vm.g.add(wrap);
    const B = {}, bind = {}; m.traverse(o => { if (o.isBone) { B[o.name] = o; bind[o.name] = o.quaternion.clone(); } if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; const mt = o.material; if (mt && mt.map) { mt.map.anisotropy = 16; mt.map.needsUpdate = true; } if (mt) { o.material = mt.clone(); o.material.flatShading = false; o.material.side = THREE.DoubleSide; /* (no seeing through thin sleeves up close) */ if (D.bright && o.material.color) o.material.color.setScalar(D.bright); if (D.emis && o.material.emissive && o.material.map) { o.material.emissive.setScalar(D.emis); o.material.emissiveMap = o.material.map; } } } }); // (sharpest texture filtering and smooth shading: the hands are right in front of you)
    if (B.Head) B.Head.scale.setScalar(0.001); // (no head in your own view)
    wrap.updateMatrixWorld(true); const hp = new THREE.Vector3(); if (B.Head) { B.Head.getWorldPosition(hp); vm.g.worldToLocal(hp); }
    wrap.position.set(-hp.x, -hp.y - 0.1, -hp.z + 0.1); // (the camera sits at his eyes; shoulders just under the view, so arms bend at the guard and straighten on a punch)
    vm.fpArms = { m, wrap, B, bind, D, reach: 1.35 }; if (D.fpArmsOnly !== false && !D.fpFist) armsOnly(vm.fpArms); /* (only the arms are drawn: no body, collar, hair, hood or cloak can ever come into the view) */ // (first-person arms are drawn a little longer than life, like every shooter does, so they can reach the screen)
  }).catch(e => { console.warn('fp arms', cls, e); vm.fpArms = null; });
}
const _S = new THREE.Vector3(), _T = new THREE.Vector3(), _E = new THREE.Vector3(), _P = new THREE.Vector3();
function ikArm(F, up, fore, hand, target, pole) { if (!up || !fore || !hand) return; up.updateWorldMatrix(true, true); up.getWorldPosition(_S); const a = fore.getWorldPosition(new THREE.Vector3()).distanceTo(_S), b = hand.getWorldPosition(new THREE.Vector3()).distanceTo(fore.getWorldPosition(new THREE.Vector3()));
  _T.copy(target); const dv = _T.clone().sub(_S); let d = dv.length(); if (d < 1e-4) return; d = Math.min(d, (a + b) * 0.999); dv.normalize(); const cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))), sinA = Math.sqrt(1 - cosA * cosA);
  _P.copy(pole).sub(_S); const n = _P.sub(dv.clone().multiplyScalar(_P.dot(dv))).normalize(); _E.copy(_S).addScaledVector(dv, a * cosA).addScaledVector(n, a * sinA);
  up.quaternion.copy(aimBone(up, fore, _E.clone().sub(_S))); up.updateWorldMatrix(true, true); const tgt = _S.clone().addScaledVector(dv, d); fore.quaternion.copy(aimBone(fore, hand, tgt.sub(_E))); fore.updateWorldMatrix(true, true); }
// the monk's fist continues straight out of his own forearm: knuckles along the arm, the palm turned in on guard, rolling over palm-down as the punch lands
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _z = new THREE.Vector3(), _x = new THREE.Vector3(), _m = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _hq = new THREE.Quaternion();
function fistOnArm(F, vm, H, fist, fore, hand, side, pk) {
  if (!fore || !hand) return; const S = F.D.fistScale || 1.12; fist.scale.setScalar(S);
  fore.updateWorldMatrix(true, false); hand.updateWorldMatrix(true, false); fore.getWorldPosition(_a); hand.getWorldPosition(_b);
  H.updateWorldMatrix(true, false); H.getWorldQuaternion(_hq).invert();
  _d.copy(_b).sub(_a).normalize().applyQuaternion(_hq); // (the forearm's direction, in the hand's own space)
  const k = Math.min(1, Math.max(0, pk)); vm.g.getWorldQuaternion(_fq);
  _z.set(side * (0.85 - 0.75 * k), 0.45 + 0.6 * k, 0.15).normalize().applyQuaternion(_fq).applyQuaternion(_hq); // (where the back of the hand faces: outward on guard, up at full reach)
  _z.addScaledVector(_d, -_z.dot(_d)).normalize(); _x.crossVectors(_d, _z).normalize();
  _m.makeBasis(_x, _d, _z); fist.quaternion.setFromRotationMatrix(_m);
  const loc = H.worldToLocal(_b.clone()), wl = fist.userData.wrist ? fist.userData.wrist.position.clone().multiplyScalar(S).applyQuaternion(fist.quaternion) : new THREE.Vector3();
  fist.position.copy(loc.sub(wl)).addScaledVector(_d, -0.02 * S);
}
// first-person arms are short next to where the view model holds a weapon: the shoulders slide forward (and a little down,
// always below the view) just far enough that both arms reach their hands without stretching thin. Per class in MODELS:
// fpReach (arm length multiplier, default 1), fpShift (furthest the shoulders may slide, default 0.42), fpDrop (shoulders lowered)
const _fv1 = new THREE.Vector3(), _fv2 = new THREE.Vector3(), _fv3 = new THREE.Vector3(), _fq1 = new THREE.Quaternion(), _fq3 = new THREE.Quaternion(), _fm1 = new THREE.Matrix4(), _fm2 = new THREE.Matrix4();
function chainLen(F, arm) { const B = F.B, a = B[arm + 'Arm'], b = B[arm + 'ForeArm'], c = B[arm + 'Hand']; if (!a || !b || !c) return 0; a.getWorldPosition(_fv1); b.getWorldPosition(_fv2); c.getWorldPosition(_fv3); return _fv1.distanceTo(_fv2) + _fv2.distanceTo(_fv3); }
function fpReachShift(F, vm, tgt) {
  const D = F.D, mx = D.fpShift != null ? D.fpShift : D.fpFist ? 0 : 0.42; let need = 0;
  for (const [H, arm] of [[vm.R, 'Right'], [vm.L, 'Left']]) { if (!H.visible || !F.B[arm + 'Arm']) continue; const L = chainLen(F, arm) * 0.94; F.B[arm + 'Arm'].getWorldPosition(_fv1); vm.g.worldToLocal(_fv1); const t = vm.g.worldToLocal(tgt(H)).sub(_fv1);
    t.y += D.fpDrop || 0; const r2 = L * L - t.x * t.x - t.y * t.y; const dz = -t.z - Math.sqrt(Math.max(0, r2)); if (dz > need) need = dz; } // (how far forward the shoulder must come for the hand to land on its grip)
  need = Math.min(mx, Math.max(0, need)); F.shz = F.shz == null ? need : F.shz + (need - F.shz) * (need > F.shz ? 0.5 : 0.15); // (comes forward at once when a swing reaches out, settles back slowly)
  F.wrap.position.z -= F.shz; F.wrap.position.y -= D.fpDrop || 0; F.wrap.updateMatrixWorld(true);
}
// the colour of the model's own hand, sampled once from its texture (the skin, the glove or the gauntlet), for the view model's fist
function handColor(F, hand) {
  F.tint = F.tint || {}; if (F.tint[hand.name] !== undefined) return F.tint[hand.name]; let col = null;
  try { F.m.traverse(o => { if (col || !o.isSkinnedMesh || !o.material || !o.material.map || !o.material.map.image) return; const bi = o.skeleton.bones.indexOf(hand); if (bi < 0) return; const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, uv = g.attributes.uv; if (!si || !sw || !uv) return;
    const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(o.material.map.image, 0, 0, N, N); const px = cx.getImageData(0, 0, N, N).data; let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < si.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === bi) w += sw.getComponent(i, k); if (w < 0.6) continue; const u = uv.getX(i), v = uv.getY(i), x = Math.min(N - 1, Math.max(0, Math.floor((u - Math.floor(u)) * N))), y = Math.min(N - 1, Math.max(0, Math.floor((1 - (v - Math.floor(v))) * N))), j = (y * N + x) * 4; r += px[j]; gg += px[j + 1]; b += px[j + 2]; n++; }
    if (n > 20) col = new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace).multiplyScalar(F.D.bright || 1); }); } catch (e) { col = null; }
  return (F.tint[hand.name] = col); }
function codeHandTint(F, fist, hand) { if (!hand || fist.userData.tinted) return; fist.userData.tinted = true; const col = handColor(F, hand); if (!col) return;
  fist.traverse(o => { const mt = o.material; if (!o.isMesh || !mt || !mt.color || (mt.emissive && mt.emissive.getHex()) || mt.roughness <= 0.3) return; /* (nails, rings and gems keep their own colours) */ const dark = Math.abs(mt.roughness - 0.6) < 0.01; o.material = mt.clone(); o.material.color.copy(col).multiplyScalar(dark ? 0.82 : 1); o.material.metalness = Math.min(mt.metalness || 0, 0.5); }); }
// does this view-model hand hold anything (a weapon, a book, a bomb)? Only then does the model's hand close round it
const seen = (o) => { if (o.visible === false) return false; if (o.isMesh) return true; for (const c of o.children) if (seen(c)) return true; return false; };
function holding(H) { for (let i = 1; i < H.children.length; i++) { const c = H.children[i]; if (c.isMesh) { c.visible = false; continue; } /* (bare meshes stuck straight on the hand were decorations of the old code hand: gone with it) */ if (seen(c)) return true; } return false; }
// where the wrist must go, and how the hand must turn, so the closed fingers wrap the handle: the view-model hand's local Y is the handle's line.
// The fingers point across the handle, away from the shoulder; the palm faces forward (you see the back of the hand). MODELS fpPalm: -1 turns the palm toward you
function gripPose(F, vm, H, sd, out) {
  const G = F.grip && F.grip[sd], hand = F.B[sd + 'Hand'], sh = F.B[sd + 'Arm']; if (!G || !hand || !sh) return false;
  H.updateWorldMatrix(true, false); const hq = H.getWorldQuaternion(_fq1), Y = new THREE.Vector3(0, 1, 0).applyQuaternion(hq), Pw = H.getWorldPosition(new THREE.Vector3()), og = F.D.fpGripOff; if (og) Pw.add(new THREE.Vector3(og[0], og[1], og[2]).applyQuaternion(hq));
  // the fingers point the way the forearm runs (last frame's), turned round the handle: the wrist stays nearly straight; the thumb toward the weapon's business end (+Y)
  const fw = Pw.clone().sub(sh.getWorldPosition(_fv1)).normalize(); fw.addScaledVector(Y, -fw.dot(Y)); fw.addScaledVector(new THREE.Vector3(sd === 'Right' ? -1 : 1, 0, -0.5).normalize().applyQuaternion(hq), 0.35); fw.addScaledVector(Y, -fw.dot(Y)).normalize(); /* (worked out fresh each frame from where the shoulder is, leaning toward the old fist's fingers, so it never flips when the handle points along the arm) */
  const pn = new THREE.Vector3().crossVectors(Y, fw).multiplyScalar(G.hs * (F.D.fpThumb || 1));
  _fm1.makeBasis(fw, pn, new THREE.Vector3().crossVectors(fw, pn)); _fm2.makeBasis(G.fw, G.dn, new THREE.Vector3().crossVectors(G.fw, G.dn)).transpose(); _fm1.multiply(_fm2); out.q.setFromRotationMatrix(_fm1);
  hand.updateWorldMatrix(true, false); const ws = hand.getWorldScale(_fv2); out.t.copy(Pw).sub(G.C.clone().multiply(ws).applyQuaternion(out.q)); return true;
}
export function tickFpArms(vm) {
  const F = vm && vm.fpArms; if (!F || F === 'loading') return; const B = F.B;
  for (const k in F.bind) B[k].quaternion.copy(F.bind[k]); if (B.Head) B.Head.scale.setScalar(0.001); const ao = F.D.fpArmsOnly !== false && !F.D.fpFist; /* (arms only: the shoulders need no shrinking, so the arm is scaled to a natural size instead) */ for (const nm of ['LeftArm', 'RightArm']) if (B[nm]) B[nm].scale.setScalar((F.reach || 1) * (ao ? 0.6 * (F.D.fpReach || 1.35) : 1)); for (const nm of ['LeftHand', 'RightHand']) if (B[nm]) B[nm].scale.setScalar(F.D.fpFist || F.D.fpClaw ? 0.001 : (F.D.fpHand || (ao ? 1 : 1.15))); if (B.LeftHand && vm.weapons && vm.weapons.off && vm.weapons.off.name === 'weapon_shield') B.LeftHand.scale.setScalar(0.001); /* (a shield strapped on the forearm: the hand is behind it, never a gauntlet hooked round nothing) */ if (F.D.fpFist) { for (const nm of ['LeftForeArm', 'RightForeArm']) if (B[nm]) B[nm].scale.set(1.28, 1, 1.28); } else if (F.D.fpFore) for (const nm of ['LeftForeArm', 'RightForeArm']) if (B[nm]) B[nm].scale.set(F.D.fpFore, 1, F.D.fpFore); /* (fpFore: a bulky sleeve drawn slimmer in first person) */ // (big hands in your view; the monk's become real fists below)
  for (const nm of ['LeftShoulder', 'RightShoulder', 'neck', 'Spine', 'Spine01', 'Spine02']) if (B[nm] && nm.endsWith('Shoulder')) B[nm].scale.setScalar(ao ? 1 : 0.6); // (shoulder pads shrunk so they never cover the view)
  F.wrap.visible = vm.g.visible !== false && !F.hideTest; F.wrap.updateMatrixWorld(true);
  const grips = {}; F.hk = F.hk || {};
  const modelGrip = F.D.fpGrip !== 'code'; F.code = F.code || {}; /* (the owner: always the class model's own hand, never a code-built one) */
  for (const [H, sd] of [[vm.R, 'Right'], [vm.L, 'Left']]) { const hold = ao && H.visible && (holding(H) || !!vm.fists || !!vm.gunHold || (H === vm.L && !!vm.twoHold) || (H === vm.R && !!(vm.weapons && vm.weapons.heldR))); /* (gunHold: both hands close round the gun's grip and fore-end; twoHold: the second hand on a two-hander's haft closes round it too, never an open palm) */ /* (bare fists: the view model's closed fist, never the model's open hand) */ F.code[sd] = hold && !modelGrip;
    F.hk[sd] = (F.hk[sd] || 0) + ((hold && modelGrip ? 1 : 0) - (F.hk[sd] || 0)) * 0.4; if (F.hm) for (const ms of F.hm[sd]) if (ms.morphTargetInfluences) ms.morphTargetInfluences[0] = F.hk[sd]; // (fpGrip 'model': the model's own hand closes round what it holds)
    if (F.code[sd] && B[sd + 'Hand']) B[sd + 'Hand'].scale.setScalar(0.001); // (otherwise a held weapon sits in the view model's own closed fist, made in the colours of the model's hand, on the end of the model's forearm)
    if (hold && modelGrip) { const g = { q: new THREE.Quaternion(), t: new THREE.Vector3() }; if (gripPose(F, vm, H, sd, g)) grips[sd] = g; } }
  const tgt = (H) => { if (F.D.fpClaw && H.children.some(c => c.visible && !c.isMesh)) return H.localToWorld(new THREE.Vector3(0, -F.D.fpClaw, 0)); /* (claw gauntlets: the forearm runs into the fur cuff, the bare hand hidden inside) */ const g = grips[H === vm.R ? 'Right' : 'Left']; if (g) return g.t.clone(); const t = new THREE.Vector3(), wr = H.children[0] && H.children[0].userData.wrist; if (F.D.fpFist) { H.updateWorldMatrix(true, false); t.copy(H.localToWorld(new THREE.Vector3(0, -0.07 * 1.35, 0).applyEuler(new THREE.Euler(0.55, 0, 0)))); } else (wr || H).getWorldPosition(t); return t; }; // (a held handle: the wrist goes where the closed fingers wrap it; otherwise aim at where the wrist belongs in the pose)
  fpReachShift(F, vm, tgt);
  for (const H of [vm.R, vm.L]) {
    const t = tgt(H), side = H === vm.R ? 1 : -1, bowR = H === vm.R && vm.weapons && vm.weapons.bow, dr = bowR ? Math.min(1, vm.bowDraw || 0) : 0, pole = vm.g.localToWorld(bowR ? new THREE.Vector3(0.7 + 0.3 * dr, -0.9 + 0.95 * dr, 0.2 + 0.5 * dr) : new THREE.Vector3(side * 0.7, -0.9, 0.2)); /* (drawing a bow: the elbow comes up and back out to the right, at the shoulder's height, so the forearm runs out of the view instead of up through it) */
    const arm = side > 0 ? 'Right' : 'Left'; if (H.visible) ikArm(F, B[arm + 'Arm'], B[arm + 'ForeArm'], B[arm + 'Hand'], t, pole);
    else if (ao) ikArm(F, B[arm + 'Arm'], B[arm + 'ForeArm'], B[arm + 'Hand'], vm.g.localToWorld(new THREE.Vector3(side * 0.34, -1.1, 0.05)), pole); /* (a hand with nothing to do hangs down at his side, out of the view) */
    else { B[arm + 'Arm'] && B[arm + 'Arm'].rotateX(1.2); }
    const g = grips[arm], hd = B[arm + 'Hand']; if (vm.fists && hd && hd.parent && H.visible && F.grip && F.grip[arm] && B[arm + 'ForeArm']) { const Gq = F.grip[arm]; hd.parent.updateWorldMatrix(true, false); hd.updateWorldMatrix(true, false); const fwW = hd.getWorldPosition(new THREE.Vector3()).sub(B[arm + 'ForeArm'].getWorldPosition(new THREE.Vector3())).normalize(), cq = vm.g.getWorldQuaternion(new THREE.Quaternion()), inw = new THREE.Vector3(-side, -0.35, 0).applyQuaternion(cq); inw.addScaledVector(fwW, -inw.dot(fwW)); if (inw.lengthSq() > 1e-6) { inw.normalize(); const A = new THREE.Matrix4().makeBasis(fwW, inw, new THREE.Vector3().crossVectors(fwW, inw)), Bm = new THREE.Matrix4().makeBasis(Gq.fw, Gq.dn, new THREE.Vector3().crossVectors(Gq.fw, Gq.dn)).transpose(); const qw = new THREE.Quaternion().setFromRotationMatrix(A.multiply(Bm)); hd.quaternion.copy(hd.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qw)); } } /* (a bare fist: knuckles straight on from the forearm, the palm turned in and a little down, so the wrist never bends) */
    else if (g && hd && hd.parent && H.visible && !vm.fists) { /* (bare fists: the closed hand runs straight on from the forearm, never twisted round a handle that isn't there) */ hd.parent.updateWorldMatrix(true, false); hd.quaternion.copy(hd.parent.getWorldQuaternion(_fq3).invert().multiply(g.q)); } // (the hand turned so its fingers wrap the handle)
    if (H.children[0]) { const fist = H.children[0]; fist.visible = !!F.D.fpFist || !!F.code[arm]; if (F.code[arm]) codeHandTint(F, fist, B[arm + 'Hand']); if (F.D.fpFist) fistOnArm(F, vm, H, fist, B[arm + 'ForeArm'], B[arm + 'Hand'], side, side > 0 ? vm.punchR || 0 : vm.punchL || 0); } }
  if (vm.foot && vm.foot.visible) { const t = vm.foot.getWorldPosition(new THREE.Vector3()), hip = B.RightUpLeg; if (hip) { const h0 = hip.getWorldPosition(new THREE.Vector3()); ikArm(F, B.RightUpLeg, B.RightLeg, B.RightFoot, t, h0.clone().add(vm.g.localToWorld(new THREE.Vector3(0, 0.5, -1)).sub(vm.g.getWorldPosition(new THREE.Vector3())))); } vm.foot.traverse(o => { if (o.isMesh) o.visible = false; }); } // (your own leg kicks into view)
  if (vm.arms) for (const a of vm.arms) a.arm.visible = false; // (the old forearms are gone: your model's own arms are drawn instead)
}

// the necromancer's ultimate demon (a Meshy character): one load, then a fresh copy per summon. It plays its scream when
// the demon roars; the rest of the time it holds the scream's first frame and its arms reach for where the old built
// demon's hands are, so the grab, the lift and the bite all line up with the ultimate's own timing
const DEMON = { base: 'models/demon_rig.fbx', scream: 'models/anim/demon_scream.json', bright: 1.0 }; let demonBase = null;
export function loadDemonModel() {
  if (!demonBase) demonBase = (async () => { const [base, J] = await Promise.all([loadFbx(DEMON.base), (await fetch(DEMON.scream)).json()]); const c = THREE.AnimationClip.parse(J);
    c.tracks = c.tracks.filter(t => !/\.position$/.test(t.name) || (/^Hips\.position$/.test(t.name) && (keepHipY(t), true))); /* (only the hips' bob: bones keep their own lengths) */
    base.traverse(o => { if (o.isMesh) { fixNormals(o.geometry); o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = mats.map(m0 => { const m = DEMON.bright !== 1 ? m0.clone() : m0; if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.anisotropy = 4; } if (m.color) { m.color.set('#ffffff'); if (DEMON.bright !== 1) m.color.setScalar(DEMON.bright); } m.side = THREE.DoubleSide; return m; }); if (o.material.length === 1) o.material = o.material[0]; } });
    return { base, clip: c }; })().catch(e => { demonBase = null; throw e; });
  return demonBase.then(({ base, clip }) => { const m = SkeletonUtils.clone(base); m.updateMatrixWorld(true); const bones = {}, bind = {}; m.traverse(o => { if (o.isBone) { bones[o.name] = o; bind[o.name] = [o.quaternion.clone(), o.position.clone()]; } });
    const mixer = new THREE.AnimationMixer(m), scream = mixer.clipAction(clip); scream.play(); scream.setEffectiveWeight(1); scream.paused = true; scream.time = 0; mixer.update(0);
    const H = bones.Head, mouth = new THREE.Vector3(); if (H) { m.updateMatrixWorld(true); const h = H.getWorldPosition(new THREE.Vector3()), f = bones.headfront ? bones.headfront.getWorldPosition(new THREE.Vector3()) : h.clone().add(new THREE.Vector3(0, 0, 25)), top = bones.head_end ? bones.head_end.getWorldPosition(new THREE.Vector3()) : h.clone().add(new THREE.Vector3(0, 30, 0)); H.worldToLocal(mouth.copy(f).addScaledVector(top.sub(h), -0.3)); } /* (the mouth: the front of the face, a little below the eyes, riding on the head bone) */
    return { m, bones, bind, mixer, scream, mouth, size: new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()), on: false }; });
}
// every frame: back to the rest pose, the scream (or its first frame) on top, then each arm reaching for its target point (world space)
export function poseDemonModel(dm, dt, o = {}) {
  if (!dm) return; const B = dm.bones; for (const k in dm.bind) { B[k].quaternion.copy(dm.bind[k][0]); B[k].position.copy(dm.bind[k][1]); }
  const sc = dm.scream; if (o.screaming) { if (!dm.on) { dm.on = true; sc.time = o.screamFrom || 0; } sc.paused = false; sc.setEffectiveWeight(1); dm.mixer.update(dt); } /* (the scream runs from the start each time it roars) */
  else { dm.on = false; sc.paused = true; sc.time = 0; sc.setEffectiveWeight(1); dm.mixer.update(0); } /* (otherwise: the scream's opening stance as its idle) */
  dm.m.updateMatrixWorld(true);
  for (const [sd, sx, tg] of [['Right', -1, o.handR], ['Left', 1, o.handL]]) { if (!tg) continue; const pole = dm.m.localToWorld(new THREE.Vector3(sx * 220, 110, -120)); ikArm(null, B[sd + 'Arm'], B[sd + 'ForeArm'], B[sd + 'Hand'], tg, pole); }
  if ((o.pitch || o.yaw) && B.neck) { B.neck.updateWorldMatrix(true, false); const wq = dm.m.getWorldQuaternion(_q), ax = new THREE.Vector3(1, 0, 0).applyQuaternion(wq); _q2.setFromAxisAngle(ax, o.pitch || 0).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0).applyQuaternion(wq), o.yaw || 0)); /* (the head looks where the built demon's head does: pitch about its side axis, then turn about its up axis) */ const bw = B.neck.getWorldQuaternion(new THREE.Quaternion()), pw = B.neck.parent.getWorldQuaternion(new THREE.Quaternion()); B.neck.quaternion.copy(pw.invert().multiply(_q2.multiply(bw))); }
  dm.m.updateMatrixWorld(true);
}

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
// time maps for recorded blows ([share of the blow 0-1, time in the recording]), worked out from the recording itself: the berserker's Attack
// chops the axe from over his head into the ground in about a tenth of a second (the haft turns 220 degrees). Each stretch of the recording plays
// as fast as it can without the haft turning more than about 650 degrees a second, his fist moving more than 11 m/s or his shoulders and head
// 7 m/s (all a little over at the default axe's pace), and the rate changes smoothly: the wind-up is quickened, the lunge plays as recorded, the
// chop itself about three times slower, so his body still leads the blow and the arms follow it down. The first blow eases out of his guard
const BERS_CHOP_T = [[0.0, 0.0], [0.0156, 0.0187], [0.0312, 0.0377], [0.0469, 0.0571], [0.0625, 0.0771], [0.0781, 0.0978], [0.0938, 0.1195], [0.1094, 0.1431], [0.125, 0.1695], [0.1406, 0.1996], [0.1562, 0.2326], [0.1719, 0.2649], [0.1875, 0.2948], [0.2031, 0.3227], [0.2188, 0.3507], [0.2344, 0.3803], [0.25, 0.4121], [0.2656, 0.4471], [0.2812, 0.4863], [0.2969, 0.5336], [0.3125, 0.5939], [0.3281, 0.6599], [0.3438, 0.7253], [0.3594, 0.7828], [0.375, 0.8215], [0.3906, 0.85], [0.4062, 0.8744], [0.4219, 0.8972], [0.4375, 0.9194], [0.4531, 0.9402], [0.4688, 0.9567], [0.4844, 0.9693], [0.5, 0.9797], [0.5156, 0.9887], [0.5312, 0.9968], [0.5469, 1.0042], [0.5625, 1.011], [0.5781, 1.0175], [0.5938, 1.0235], [0.6094, 1.0294], [0.625, 1.0351], [0.6406, 1.0407], [0.6562, 1.0462], [0.6719, 1.0516], [0.6875, 1.0571], [0.7031, 1.0625], [0.7188, 1.068], [0.7344, 1.0735], [0.75, 1.0791], [0.7656, 1.0847], [0.7812, 1.0903], [0.7969, 1.0961], [0.8125, 1.1021], [0.8281, 1.1083], [0.8438, 1.1148], [0.8594, 1.1217], [0.875, 1.1292], [0.8906, 1.1375], [0.9062, 1.1471], [0.9219, 1.1587], [0.9375, 1.1747], [0.9531, 1.205], [0.9688, 1.2678], [0.9844, 1.3339], [1.0, 1.4]];
const BERS_RIP_T = [[0.0, 1.4], [0.0312, 1.4488], [0.0625, 1.4977], [0.0938, 1.5465], [0.125, 1.5954], [0.1562, 1.6442], [0.1875, 1.6921], [0.2188, 1.7342], [0.25, 1.7699], [0.2812, 1.8023], [0.3125, 1.8331], [0.3438, 1.8635], [0.375, 1.8939], [0.4062, 1.9243], [0.4375, 1.9554], [0.4688, 1.9882], [0.5, 2.025], [0.5312, 2.0683], [0.5625, 2.1162], [0.5938, 2.165], [0.625, 2.2138], [0.6562, 2.2627], [0.6875, 2.3115], [0.7188, 2.3604], [0.75, 2.4092], [0.7812, 2.4581], [0.8125, 2.5069], [0.8438, 2.5558], [0.875, 2.6046], [0.9062, 2.6535], [0.9375, 2.7023], [0.9688, 2.7512], [1.0, 2.8]]; /* (the rip back up across him, then he settles into his guard) */
const MODELS = {
  necromancer: { fpFore: 0.55, fpDrop: 0.15, bright: 1.35, base: 'models/necro_rig.fbx', clips: { walk: 'models/anim/necro_walk.json', run: 'models/anim/necro_run.json' }, height: 2.2, walkSpeed: 1.6, runSpeed: 5.5 },
  musketeer: { oneHandGun: true, fpHand: 0.45, fpFore: 0.7, base: 'models/musk_rig.fbx', clips: { walk: 'models/anim/musk_walk.json', run: 'models/anim/musk_run.json' }, height: 1.12, walkSpeed: 1.5, runSpeed: 5.0 },
  blunderbuss: { fpHand: 0.72, base: 'models/bb_rig.fbx', clips: { walk: 'models/anim/bb_walk.json', run: 'models/anim/monk_run.json' }, height: 2.6, walkSpeed: 1.5, runSpeed: 5.0 }, // (only a walk was made for him (bb_run is the same walk): he runs the monk's run, retargeted, like most classes. Played faster, the walk could never keep his feet planted at 6 m/s)
  warrior: { fpHand: 0.72, fill: 0.38, fpDrop: 0.15, base: 'models/warr2_rig.fbx', clips: { walk: 'models/anim/warr2_walk.json', run: 'models/anim/warr2_run.json', slash: 'models/anim/warr2_slash.json', dead: 'models/anim/warr2_dead.json', double: 'models/anim/warr2_double.json', triple: 'models/anim/warr2_triple.json', roll: 'models/anim/warr2_roll.json', push: 'models/anim/warr2_push.json', jump2: 'models/anim/warr2_jump2.json', fcharge: 'models/anim/warr2_fcharge.json', rcharge: 'models/anim/warr2_rcharge.json', rslash: 'models/anim/warr2_rslash.json', lslash: 'models/anim/warr2_lslash.json', rollL: 'models/anim/warr2_rollL.json', backj: 'models/anim/warr2_backj.json' }, heightClips: ['dead', 'roll', 'rollL', 'backj', 'double', 'rslash'], /* (the owner's dodges: Roll Dodge 2 to the left (mirrored for the right), Back Jump backwards) */ rootMove: ['tA', 'tB', 'tC'], rootClip: 'triple', steadyEdge: true, mwIn: 11, flatClips: ['jump2', 'fcharge', 'rcharge'], moves: { rs: ['rslash', 0.05, 1.3, 0.55], dA: ['double', 0.05, 1.1, 0.55, false, 0, false, 0.42], dB: ['double', 1.1, 2.83, 1.62, false, 0, false, 0.5], /* (8th: how far through the swing the blow lands; the game's hit lands there too) */ rsA: ['rslash', 0.05, 0.75, 0.42], rsB: ['rslash', 0.75, 1.3, 0.86], /* (the owner's slash cut in two: the sweep across, then the sweep back to guard; each ends where the other starts, so held attacks loop without a jump) */ roll: ['roll', 0.05, 1.5, 0, true], rollL: ['rollL', 0.3, 1.9, 0, true], rollR: ['sh_rollR', 0.3, 1.9, 0, true], /* (the owner: the right roll is the left roll seen in a mirror (the Rightward Spin looked like a spin); mirrored bone for bone, so he dives to his right with the sword still in his right hand (flipping the whole model mirrored him front to back: he slid right while diving left)) */ rollB: ['backj', 0.0, 0.92, 0, true], jump: ['jump2', 0.45, 1.2, 0], charge: ['rcharge', 0, 0.5, 0, false, 0, true], push: ['push', 0.55, 2.0, 1.12], slash: ['slash', 0.55, 1.75, 1.33], rsF: ['rslash', 0.0, 1.5, 0.6, false, 0, false, 0.4], lsF: ['lslash', 0.0, 3.17, 1.5, false, 0, false, 0.47], tA: ['triple', 0.05, 0.95, 0.6], tB: ['triple', 0.95, 1.85, 1.5], tC: ['triple', 1.85, 3.0, 2.38], dead: ['dead', 0, 2.95, 0, true] }, combo: ['dA', 'dB'], moveFor: { swing1: 'dA', swing2: 'dB', swing3: 'dA', shieldbash: 'push' }, procSwing: false, rideFist: true, /* (the owner: use my animations: his own Double Combo Attack is his two-swing combo, the sword riding his fist as recorded (filmed against his Triple Combo and his Right Hand plus Left Slash: those carry him back into the camera and spin him round); procSwing: true and moveFor swing1/2 null bring back the built swings) */ /* (the two swings are built (procSwing), not recorded) */ /* (the owner's Double Combo Attack: two real swings, the second ending where the first begins) */ /* (one standard slash, the owner's Right Hand Sword Slash) */ /* (the owner's Triple Combo Attack, cut in three: each blow plays its own part of the recording) */ /* (only the side slash plays the recording; the overhand and the stab follow the built body) */ /* (the owner's recorded Left Slash: the sword swings round in front of him, never through his own body) */ height: 2.75, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  bard: { fpDrop: 0.18, base: 'models/bard_rig.fbx', clips: { walk: 'models/anim/bard_walk.json', run: 'models/anim/bard_run.json' }, height: 1.9, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  beastmaster: { fpClaw: 0.13, fill: 0.42, skinFix: 0.75, base: 'models/beast_rig.fbx', clips: { walk: 'models/anim/beast_walk.json', run: 'models/anim/beast_run.json' }, height: 2.5, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  cleric: { base: 'models/cleric_rig.fbx', clips: { walk: 'models/anim/cleric_walk.json', run: 'models/anim/cleric_run.json' }, height: 2.6, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  druid: { base: 'models/druid_rig.fbx', clips: { walk: 'models/anim/druid_walk.json', run: 'models/anim/druid_run.json' }, height: 2.08, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  elementalist: { fpDrop: 0.18, base: 'models/ele_rig.fbx', clips: { walk: 'models/anim/ele_walk.json', run: 'models/anim/ele_run.json' }, height: 2.14, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  enchanter: { base: 'models/ench_rig.fbx', clips: { walk: 'models/anim/ench_walk.json', run: 'models/anim/ench_run.json' }, height: 1.84, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  bombardier: { base: 'models/bomb_rig.fbx', clips: { walk: 'models/anim/bomb_walk.json', run: 'models/anim/bomb_run.json', runLegs: 'models/anim/musk_run.json' }, height: 1.0, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted; runs on the musketeer's legs, made for a short build like his: the shared run skimmed his landing foot over the ground)
  paladin: { fpDrop: 0.15, fpFore: 0.72, base: 'models/pal_rig.fbx', clips: { walk: 'models/anim/pal_walk.json', run: 'models/anim/pal_run.json', attack: 'models/anim/pal_attack.json' }, travelClips: ['attack'], recLegs: ['pA'], twoHand: true, recGrip: [-0.2787, 0.9501, 0.1238, 0.0661], /* (recGrip: the hammer fixed in his right fist with its haft running through both fists of the recording (fitted to it), the head's face leading the smash; the left fist closes on the haft) */
    moves: { pA: ['attack', 0.0, 1.4, 1.08, false, 0, false, 0.75, BERS_CHOP_T] }, moveFor: { swing3: 'pA' }, /* (his own recorded Attack (made on his model) opens his combo: from his guard he heaves the hammer up over his head in both hands and smashes it down in front of him as he steps in, played on the same time map as the berserker's (the same recording), the hit landing as the head comes down; his sweep and finisher are built) */
    height: 3.2, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  darkknight: { fill: 0.38, fpDrop: 0.15, fpFore: 0.68, base: 'models/dk_rig.fbx', clips: { walk: 'models/anim/dk_walk.json', run: 'models/anim/dk_run.json', cslash: 'models/anim/dk_cslash.json' }, heightClips: ['cslash'], recLegs: ['dkS'], twoHand: true, recGrip: [0.581, 0.4546, 0.6236, 0.2589], /* (the recording swings the sword in one hand: the blade is fixed in his right fist pointing straight out from his chest through it, edge leading the sweep (fitted to the recording), and his left fist is brought onto the grip) */
    moves: { dkS: ['cslash', 0.1, 1.0, 0.55, false, 0, false, 0.54] }, moveFor: { swing1: 'dkS' }, /* (his own recorded Charged Slash (made on his model) is the second blow of his combo: from a side-on guard a wide sweep from his right across to his left, the hit landing as the blade passes in front of him; the backhand before it and the thrust after it are built) */
    height: 3.0, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  ranger: { fill: 0.32, base: 'models/rang_rig.fbx', clips: { walk: 'models/anim/rang_walk.json', run: 'models/anim/rang_run.json', shot: 'models/anim/rang_shot.json' }, reachClip: 'shot', reachT: [0.25, 1.35], /* (his own recorded Archery Shot (made on his model): between shots his drawing arm follows its reach back over the shoulder to the quiver and down with the next arrow) */ height: 2.02, walkSpeed: 1.6, runSpeed: 5.5, // (borrows the monk's walk and run, retargeted)
    strap: { bone: 'Spine', keep: ['Hips', 'Spine02', 'Spine01', 'Spine'], pick: (x, y, z) => (y > 108 && x < -9 && z < -10.5) || (y > 144 && x < -12 && z < -5) }, quiverTop: [-25, 152, -13], /* (the quiver modelled on his back was skinned by the auto-rig to his right shoulder and arm, so every draw dragged it into the arm and it vanished: it is strapped to his chest instead; quiverTop: its mouth, where he reaches for the next arrow, in the model's rest-pose centimetres) */
    bowScale: 1.4, bowWide: 1.35 }, /* (his bow a good deal bigger, so it stands out above his head and past his body from the camera behind him) */
  rogue: { fill: 0.34, bright: 1.35, curl: [0.52, 2.5], fist: { R: [0.58, 0.14, 0, 1.4], L: [0.58, 0.14, 0, 1.4] }, holdFix: true, /* (the owner, many times: her daggers sit in closed fists, the grip through the middle of each fist and the blade running out of the front of the fist along the forearm, so it leads the thrust and extends the arm in the wide slash of her recorded Thrust Slash (measured: only along the forearm does it point at the target at the blow), and hangs down along her thighs at rest; both hands the same, mirrored. Her model was made with open hands: curl closes them) */ base: 'models/rogue_rig.fbx', clips: { walk: 'models/anim/rogue_walk.json', run: 'models/anim/rogue_run.json', dspin: 'models/anim/rogue_dspin.json' }, heightClips: ['dspin'],
    moves: { dspin: ['dspin', 0.35, 1.8, 1.52, true, 0, false, 0.7] }, moveFor: { sweep: 'dspin' }, /* (her own recorded Double Blade Spin (made on her model) finishes her combo: she springs up turning a full circle with both blades raised and slashes them down as she lands in a crouch, the hit landing with the blades) */
    height: 2.34, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  wizard: { base: 'models/wiz_rig.fbx', clips: { walk: 'models/anim/wiz_walk.json', run: 'models/anim/wiz_run.json', runLegs: 'models/anim/musk_run.json' }, height: 2.26, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted; runs on the musketeer's legs: on his build the shared run brought the landing foot down early and skimmed it forward over the ground)
  priest: { base: 'models/priest_rig.fbx', clips: { walk: 'models/anim/priest_walk.json', run: 'models/anim/priest_run.json' }, height: 1.96, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  shaman: { base: 'models/shaman_rig.fbx', clips: { walk: 'models/anim/shaman_walk.json', run: 'models/anim/shaman_run.json' }, height: 2.42, walkSpeed: 1.6, runSpeed: 5.5 }, // (the owner's shaman, with his own walk and run)
  berserker: { keepLegs: true, flipEdge: true, twoHand: true, oneHand: ['wcA', 'wcB', 'wcC'], base: 'models/sham_rig.fbx', clips: { combo2: 'models/anim/bers_combo2.json', walk: 'models/anim/sham_walk.json', run: 'models/anim/bers_fcharge.json', cslash: 'models/anim/bers_cslash.json', attack: 'models/anim/bers_attack.json', slam: 'models/anim/bers_slam.json', spin: 'models/anim/bers_spin.json', shout: 'models/anim/bers_shout.json', athrow: 'models/anim/bers_athrow.json', acatch: 'models/anim/bers_acatch.json' }, heightClips: ['shout', 'athrow', 'acatch', 'combo2'], flatClips: ['slam', 'spin'], uprightClips: { slam: [[0, 8], [0.3, 6], [0.9, 0], [1.35, -14], [1.8, 8], [2.2, 30], [2.7, 10]] }, /* (the recording dives over backwards with a half turn, which left him lying on his back: his hips are held upright instead, leaning back as the axe goes up and forward into the slam; degrees, + forward) */ moves: { cutA: ['cslash', 0.1, 1.0, 0.5], cutB: ['cslash', 1.0, 1.9, 1.2], shoutM: ['shout', 0.0, 1.06, 0, true], athrow: ['athrow', 0.1, 1.65, 0, true], acatch: ['acatch', 0.0, 1.35, 0, true], bA: ['attack', 0.0, 1.4, 1.08, false, 0, false, 0.75, BERS_CHOP_T], bB: ['attack', 1.4, 2.8, 1.84, false, 0, false, 0.32, BERS_RIP_T], /* (9th: a time map; the blow's damage lands at its 8th share, where the axe strikes) */ /* (the owner's barbarian Attack, cut in two: (bA) from his guard he steps in with the right foot, heaves the axe up over his head in both hands and chops it down in front of him to his left; (bB) he wrenches it back up out of the ground, sweeping it across to his right as he steps back into his guard, where bA begins again) */ leap: ['slam', 0.3, 2.2, 1.35, true, 0, false, 0.6], /* (Jump and Slam: up with the axe raised overhead for the first 60% of the leap, then the chop down that lands as he does) */ storm: ['spin', 1.15, 1.15, 0, true] /* (one steady pose, the frame where his arm and axe swing out level; the whole body spins smoothly around it) */, wcA: ['combo2', 0.5, 1.5, 1.13, false, 0, false, 0.63], wcB: ['combo2', 1.5, 2.5, 2.0, false, 0, false, 0.5], wcC: ['combo2', 2.5, 3.7, 3.03, false, 0, false, 0.44] }, combo: ['bA', 'bB'], moveFor: { swing1: 'wcA', swing2: 'wcB', swing3: 'wcC', sweep: 'cutA' }, /* (the owner's Weapon Combo 2: three one-handed cleaves, his own steps carrying them; his barbarian Attack (bA, bB) is kept for the old two-handed chop) */ recLegs: ['bA', 'bB', 'wcA', 'wcB', 'wcC'], travelClips: ['attack'], recGrip: [0.1891, -0.7798, 0.1738, 0.5709], recFix: { plant: true, pin: ['Left'], lift: [['Right', 0.2, 0.72, 0.1], ['Right', 2.07, 2.35, 0.13]], fist: [[2.05, 2.18, 2.26, 2.42, 0.08, 0], [1.06, 1.12, 1.75, 1.98, 0, 0.42]] }, /* (recFix, by time in the recording: his feet set down on the ground (the recording floats them) and his back (left) foot kept where it stands; the right foot, which the recording slides in before its step and drags back after it, lifted into real steps; as he brings the axe back to his guard the recording draws his fists into his belly, so they are held a little further out; and while the axe is down in the ground his fists are held 42 cm higher, so its lower blade bites about 30 cm into the earth (at the recording's own height it sank 48 cm, nearly the whole blade)) */ /* (the combo plays the recording whole: his own legs and the hips' travel (the step in and back), not the planted stance; recGrip: the axe sits in his fist so its haft runs through both hands of the recording (fitted to the Attack: the left fist stays within a few centimetres of the haft), and it never turns in his hand while he swings) */ /* (Skill 01 is his Battle Shout; the throw and catch play for the axe throw) */ /* (Jump and Slam for Leap Strike; Axe Spin for Bladestorm; his dodges, jump, death, flinch and knock-down are the shared basic set) */ /* (the owner's Charged Slash, cut in two: a wide sweep from his right across to his left, then straight back; the axe in front of him the whole way) */ height: 3.6, walkSpeed: 1.6, runSpeed: 5.5 }, // (the owner's latest berserker; the older one is retired (his body file is still called sham_rig; the shaman has his own, shaman_rig). He runs with his own recorded Standard Forward Charge, a driving charge with the axe at his side, not the monk's light jog)
  monk: { skinFix: 0.75, fpCurl: [0.5, 0.08, 3.3], base: 'models/monk2_rig.fbx', clips: Object.assign(Object.fromEntries(['walk', 'run', 'back', 'risekick', 'spinkick'].map(k => [k, 'models/anim/monk_' + k + '.json'])), Object.fromEntries(['punchA', 'punchB', 'attack', 'double', 'charged', 'counter', 'thrust', 'jump', 'dodge', 'stance', 'dead', 'cheer'].map(k => [k, 'models/anim/monk2_' + k + '.json'])), { spinkick2: 'models/anim/monk2_spinkick.json', hkick: 'models/anim/monk2_highkick.json' }, /[?&]kickgal/.test(location.search) ? Object.fromEntries(['kick', 'roundhouse', 'spinkick', 'risekick', 'doublekick', 'lungeround', 'sweep', 'flystrike'].map(k => ['g_' + k, 'models/anim/monk_' + k + '.json']).concat(['cast1', 'cast2', 'taunt'].map(k => ['g_' + k, 'models/anim/monk2_' + k + '.json']))) : {}), height: 2.34, walkSpeed: 1.6, runSpeed: 5.5,
    // slices of the recorded moves: [clip, start s, end s, the moment the blow lands, whole-body move, fixed play time, loops]
    moves: { jab: ['punchB', 0.3, 0.85, 0.6, false, 0, false, 0.4], cross: ['punchB', 0.85, 1.25, 1.0, false, 0, false, 0.4], hook: ['punchA', 0.5, 1.15, 0.9, false, 0, false, 0.4], upper: ['punchA', 1.15, 1.8, 1.4, false, 0, false, 0.4], spin: ['spinkick2', 0.6, 1.55, 1.26, true, 0, false, 0.62], /* (the combo's spinning blow is his own recorded Lunge Spin Kick (made on his model, not the old one's): he spins a full turn and snaps his left foot out head high; the whole body, legs too, even on the run, and the hit lands as the foot does) */ slam: ['attack', 0.3, 1.6, 1.1, false, 0, false, 0.6], /* (8th: the share of the blow where it lands; the game's hit lands there too) */
      hkick: ['hkick', 0.7, 1.45, 1.07, true, 0.45, false, 0.5], /* (his own recorded High Kick (made on his model), for the kicks of Thousand Fists: the right foot driven up head high and back down, 0.45 s whole) */ roll: ['dodge', 0.1, 1.25, 0, true], /* (his own Stand Dodge for every dodge, not the built body's tumble) */
      charged: ['charged', 0.15, 1.7, 0.85], counter: ['counter', 4.8, 6.35, 5.8],
      fury: ['punchB', 0.45, 1.5, 0, 0, 0, true], kick: ['risekick', 0.05, 1.45, 0.5], /* (a leaping side kick, the leg driven out flat: much cleaner than the old flailing one) */ flykick: ['jump', 1.4, 3.5, 0, true, 1.1], superman: ['thrust', 0.15, 1.4, 0, true, 0.75], flip: ['dodge', 0.1, 1.25, 0, true],
      dead: ['dead', 0, 2.95, 0, true], cheer: ['cheer', 0.2, 6.0, 0, true] },
    combo: ['jab', 'cross', 'hook', 'upper', 'spin', 'jab', 'slam'], finisher: ['charged', 'counter'], rawHeight: ['dead'], /* (his own death, recorded on his own rig: the hips keep their recorded height, so he ends lying on the ground, not hanging at the height he started at) */ idleClip: 'stance', noGrip: true, /* (the fighting stance loops: held on one frame it stood dead still) */ heightClips: ['spinkick2', 'hkick'], /* (the kicks keep his hips' rise and fall but not their travel: the game moves him) */ fpHand: 1.0 }, // (the owner's new monk moves: punch combos, spinning strike, ground slam; charged palm and counterstrike finish a combo; fighting stance at rest, a real death fall, a cheer when the arena is won)
};
// ONE shared set of basic moves for every hero but the warrior (who keeps his own): the owner's warrior recordings, made on warr2_rig. Each file
// carries that rig's rest pose, so retarget() fits it to every body. [file, how it is fitted]: the right roll is the left roll mirrored bone for
// bone (Left and Right swapped, every turn reflected across his middle), so the weapon stays in his right hand; the jump keeps his hips level (the
// game's own jump lifts him). A class with its own recording of a move keeps it (the monk's death)
const BASIC_CLIPS = { sh_roll: ['warr2_roll'], sh_rollL: ['warr2_rollL'], sh_rollR: ['warr2_rollL', 'mirror'], sh_backj: ['warr2_backj'], sh_jump: ['warr2_jump2', 'flat'], sh_dead: ['warr2_dead'], sh_hit: ['warr2_hit'], kd: ['hit_kd'], up: ['hit_up'] };
const BASIC_MOVES = { roll: ['sh_roll', 0.05, 1.5, 0, true], rollL: ['sh_rollL', 0.3, 1.9, 0, true], rollR: ['sh_rollR', 0.3, 1.9, 0, true], rollB: ['sh_backj', 0, 0.92, 0, true], jump: ['sh_jump', 0.45, 1.2, 0, true], /* (whole body: in the air his legs tuck and reach for the ground, even running) */ dead: ['sh_dead', 0, 2.95, 0, true],
  hit: ['sh_hit', 0.0, 0.8, 0, false, 0.5], /* (a flinch when a blow lands: the start of the owner's Hit Reaction, played in half a second) */ kd: ['kd', 0.1, 1.75, 0, false, 1.4], up: ['up', 2.2, 6.0, 0] }; /* (Knock Down, which ends on his back with his head behind him, then Stand Up 1, which starts lying just so: he sits up and rises (Stand Up 8, hit_up8, starts face down, so it would flip him over); 6th: the fall's own play time) */
// the owner's recorded casts, strikes, throws and dances, each made on that class's own body: added to its clips and moves. moveFor: the
// basic attack's recording (cast for the casters and the bombardier's throw, reap for the necromancer, the punches and stabs); abMoves: the
// recording an ability plays when it goes off (F, C, Q, right click, the ultimate), on its own clock. Slices: [clip, start s, end s, the blow,
// whole body, play time s, loops, how far through the blow lands]
const A_ = (n) => 'models/anim/' + n + '.json';
const REC = {
  rogue: { clips: { rthrust: A_('rogue_thrust'), rjudg: A_('rogue_judg'), relbow: A_('rogue_elbow'), rlsk: A_('rogue_lsk') }, heightClips: ['rjudg', 'rlsk'],
    moves: { rtA: ['rthrust', 0.17, 1.05, 0.73, false, 0, false, 0.64], rtB: ['rthrust', 1.05, 1.75, 1.37, false, 0, false, 0.46], abLeech: ['rjudg', 0.5, 1.5, 1.0, false, 0.75], abEvisc: ['rlsk', 0.3, 1.63, 1.33, true, 0.9], abKidney: ['relbow', 0.55, 1.7, 1.23, false, 0.7], abAssn: ['rjudg', 0.6, 3.0, 1.0, true, 1.6] },
    moveFor: { stabR: 'rtA' }, abMoves: { ar_leechstab: 'abLeech', eviscerate: 'abEvisc', kidney: 'abKidney', ar_assassinate: 'abAssn' } }, /* (Thrust Slash: the thrust, then the wide slash; Sword Judgment's big right-hand drive for Leeching Stab and, played longer, Assassinate; the Lunge Spin Kick for Eviscerate; the Elbow Strike for Kidney Shot) */
  bombardier: { clips: { bpull: A_('bomb_pullthrow'), bcharge: A_('bomb_chargethrow'), bdraw: A_('bomb_quickdraw') }, heightClips: ['bpull'],
    moves: { bThrow: ['bpull', 2.95, 3.9, 3.5, false, 0, false, 0.58], abStick: ['bcharge', 5.0, 5.75, 5.37, false, 0.45], abRocket: ['bdraw', 1.6, 3.0, 2.27, false, 0.8], abBertha: ['bcharge', 0.2, 6.0, 5.37, true, 2.0] },
    moveFor: { cast: 'bThrow' }, abMoves: { bo_stickies: 'abStick', bo_rocket: 'abRocket', ar_bertha: 'abBertha' } }, /* (Crouch Pull and Throw: the overhand lob of every bomb; Crouch Charge and Throw for the sticky bombs and, whole, Big Bertha; Cowboy Quick Draw for the rocket) */
  wizard: { clips: { wcast: A_('wiz_cast'), wcast8: A_('wiz_cast8'), wcast7: A_('wiz_cast7'), wcharged: A_('wiz_charged') },
    moves: { wCast: ['wcast', 0.15, 1.2, 0.6, false, 0, false, 0.43], abBlink: ['wcast8', 0.0, 1.07, 0, false, 0.5], abBeam: ['wcast7', 0.3, 2.17, 0, false, 1.0], abBolt: ['wcast', 0.15, 1.2, 0.6, false, 0.55], abTrans: ['wcharged', 0.47, 3.67, 1.9, true, 2.0] },
    moveFor: { cast: 'wCast' }, abMoves: { blink: 'abBlink', phaseshift: 'abBlink', disintegrate: 'abBeam', temporalbolt: 'abBolt', ar_transcend: 'abTrans' } },
  druid: { clips: { dcast7: A_('druid_cast7'), dskill: A_('druid_skill1'), dslam: A_('druid_slam'), dcharged: A_('druid_charged') }, heightClips: ['dslam'],
    moves: { dCast: ['dskill', 0.25, 1.07, 0.43, false, 0, false, 0.22], abGrow: ['dcast7', 0.3, 2.17, 0, false, 0.9], abBear: ['dslam', 0.2, 2.6, 1.63, true, 1.3], abTangle: ['dskill', 0.25, 1.07, 0.43, false, 0.6], abOver: ['dcharged', 0.47, 3.67, 1.9, true, 2.0] },
    moveFor: { cast: 'dCast' }, abMoves: { regrowth: 'abGrow', ar_mendD: 'abGrow', callbear: 'abBear', entangle: 'abTangle', ar_overgrowth: 'abOver' } },
  shaman: { clips: { scast: A_('shmn_cast'), scast7: A_('shmn_cast7'), sslam: A_('shmn_slam'), scharged: A_('shmn_charged') }, heightClips: ['sslam'],
    moves: { abWave: ['scast7', 0.3, 2.17, 0, false, 0.9], abWolf: ['sslam', 0.2, 2.6, 1.63, true, 1.3], abHex: ['scast', 0.15, 1.2, 0.6, false, 0.55], abTotem: ['scast', 0.15, 1.2, 0.6, false, 0.55], abSpirit: ['scharged', 0.47, 3.67, 1.9, true, 2.0] },
    abMoves: { sh_wave: 'abWave', sh_wolf: 'abWolf', sh_hex: 'abHex', ar_totem: 'abTotem', ar_spirittotem: 'abSpirit' } }, /* (his spear thrusts stay as they are) */
  necromancer: { clips: { ncast1: A_('necro_cast1'), ncast2: A_('necro_cast2'), nslash: A_('necro_cslash'), nspin: A_('necro_spin') }, heightClips: ['ncast2'],
    moves: { nReap: ['nslash', 0.55, 1.45, 1.17, false, 0, false, 0.69], abDrain: ['ncast1', 0.33, 1.8, 0.63, false, 0.8], abBreath: ['ncast1', 0.33, 1.8, 1.4, false, 0.8], abSkull: ['ncast2', 0.1, 1.5, 1.23, false, 0.7], abDemon: ['nspin', 0.1, 2.03, 0.93, true, 1.3], abBone: ['ncast2', 0.1, 1.5, 1.23, false, 0.6] },
    moveFor: { reap: 'nReap' }, abMoves: { drainlife: 'abDrain', ar_plaguebreath: 'abBreath', ar_skullfear: 'abSkull', ar_demon: 'abDemon', bonearmor: 'abBone' } }, /* (Charged Slash: the scythe's reap) */
  priest: { clips: { pcast1: A_('priest_cast1'), pcast2: A_('priest_cast2') }, heightClips: ['pcast2'],
    moves: { pCast: ['pcast2', 0.5, 1.45, 1.23, false, 0, false, 0.77], abHalo: ['pcast1', 0.33, 1.8, 1.4, false, 0.8], abWord: ['pcast2', 0.1, 1.5, 1.23, false, 0.6], abChains: ['pcast1', 0.33, 1.8, 0.63, false, 0.8], abSalv: ['pcast1', 0.33, 2.67, 1.4, true, 1.6] },
    moveFor: { cast: 'pCast' }, abMoves: { pr_halo: 'abHalo', ar_mendP: 'abHalo', pr_word: 'abWord', pr_chains: 'abChains', ar_salvation: 'abSalv' } },
  elementalist: { clips: { ecast1: A_('ele_cast1'), ecast3: A_('ele_cast3') },
    moves: { eCast: ['ecast3', 0.1, 1.3, 0.9, false, 0, false, 0.67], abLash: ['ecast1', 0.33, 1.6, 0.63, false, 0.7], abFlame: ['ecast3', 0.1, 1.3, 0.9, false, 0.7], abFrost: ['ecast1', 0.33, 1.8, 1.4, false, 0.8], abPure: ['ecast1', 0.33, 2.67, 1.4, true, 1.6] },
    moveFor: { cast: 'eCast' }, abMoves: { lightninglash: 'abLash', callflame: 'abFlame', frostbind: 'abFrost', iceshell: 'abFlame', pureel: 'abPure', ar_meteors: 'abPure' } },
  enchanter: { clips: { ncast: A_('ench_cast'), nskill: A_('ench_skill2') },
    moves: { nCast: ['ncast', 0.15, 1.2, 0.6, false, 0, false, 0.43], abRot: ['nskill', 0.0, 1.3, 0.2, false, 0.6], abLock: ['ncast', 0.15, 1.2, 0.6, false, 0.6], abMez: ['nskill', 0.0, 1.3, 0.2, false, 0.6], abShatter: ['ncast', 0.15, 1.4, 0.6, true, 1.2] },
    moveFor: { cast: 'nCast' }, abMoves: { mindrot: 'abRot', ar_mindlock: 'abLock', mesmerize: 'abMez', runeshield: 'abLock', mindshatter: 'abShatter', ar_charm: 'abShatter' } },
  bard: { clips: { bbow: A_('bard_bow'), bdance: A_('bard_dance') },
    moves: { cheer: ['bbow', 0.37, 6.0, 0, true], abFinale: ['bdance', 0.4, 6.4, 0, true, 6.0] },
    abMoves: { cacophony: 'abFinale', ar_finale: 'abFinale' } }, /* (Cherish Pop Dance for his Grand Finale solo; the Gentleman's Bow when the arena is won) */
  beastmaster: { clips: { bpc: A_('beast_pcombo'), bwc: A_('beast_wcombo1'), bboth: A_('beast_bothpunch'), bjump: A_('beast_jpunch'), bslash: A_('beast_rslash') }, heightClips: ['bjump', 'bwc'],
    moves: { bmL: ['bpc', 0.33, 0.95, 0.63, false, 0, false, 0.48], bmR: ['bpc', 0.95, 1.6, 1.27, false, 0, false, 0.49], abFrenzy: ['bwc', 0.4, 2.7, 0.8, true, 1.2], abBeast: ['bboth', 0.3, 1.6, 0.6, false, 0.8], abRoar: ['bslash', 0.2, 1.13, 0.53, false, 0.6], abDire: ['bjump', 0.13, 2.6, 1.27, true, 1.6] },
    moveFor: { stabL: 'bmL', stabR: 'bmR', swing2: 'bmL', swing1: 'bmR' }, abMoves: { packfrenzy: 'abFrenzy', warbeast: 'abBeast', feralroar: 'abRoar', direbeast: 'abDire', ar_pack: 'abDire' } }, /* (Punch Combo: the left jab and the right cross of his basic attack) */
  /* shared from other classes' recordings (the owner: use them for other classes where they fit; each file carries its body's rest pose, so it is fitted to this one) */
  paladin: { clips: { pslam: A_('shmn_slam'), pcharged: A_('wiz_charged'), pcast1: A_('priest_cast1') }, heightClips: ['pslam'], oneHand: ['abLay'],
    moves: { abHammer: ['pslam', 0.2, 2.6, 1.63, true, 1.2], abLay: ['pcast1', 0.33, 1.8, 1.4, false, 0.8], abWrath: ['pcharged', 0.47, 3.67, 1.9, true, 2.0] },
    abMoves: { hammerstrike: 'abHammer', layonhands: 'abLay', ar_wrath: 'abWrath' } }, /* (the Charged Ground Slam for Hammer Strike, a two-handed cast for Lay on Hands, the Charged Spell Cast for Wrath) */
  darkknight: { clips: { kcast1: A_('necro_cast1'), kcast2: A_('necro_cast2'), kspin: A_('necro_spin') }, heightClips: ['kcast2'], oneHand: ['abTap', 'abWall', 'abGrip'],
    moves: { abTap: ['kcast1', 0.33, 1.8, 0.63, false, 0.8], abWall: ['kcast1', 0.33, 1.8, 1.4, false, 0.8], abGrip: ['kcast2', 0.1, 1.5, 1.23, false, 0.7], abHarb: ['kspin', 0.1, 2.03, 0.93, true, 1.3] },
    abMoves: { lifetap: 'abTap', gravewall: 'abWall', deathgrip: 'abGrip', ar_grasp: 'abGrip', harbinger: 'abHarb' } }, /* (the necromancer's casts and his scythe spin) */
  cleric: { clips: { ccast1: A_('priest_cast1'), ccast2: A_('priest_cast2') }, heightClips: ['ccast2'],
    moves: { abRad: ['ccast1', 0.33, 1.8, 1.4, false, 0.8], abPur: ['ccast1', 0.33, 1.8, 0.63, false, 0.7], abSmite: ['ccast2', 0.1, 1.5, 1.23, false, 0.7], abMend: ['ccast1', 0.33, 1.8, 1.4, false, 0.7], abMir: ['ccast1', 0.33, 2.67, 1.4, true, 1.6] },
    abMoves: { radiantheal: 'abRad', ar_purify: 'abPur', holysmite: 'abSmite', ar_mendC: 'abMend', ar_miracle: 'abMir' } }, /* (the priest's casts) */
};
for (const c in REC) { const D = MODELS[c], R = REC[c]; if (!D) continue; D.clips = Object.assign({}, D.clips, R.clips); D.moves = Object.assign({}, D.moves, R.moves); if (R.moveFor) D.moveFor = Object.assign({}, D.moveFor, R.moveFor); D.abMoves = Object.assign({}, D.abMoves, R.abMoves); if (R.heightClips) D.heightClips = [...(D.heightClips || []), ...R.heightClips]; if (R.oneHand) D.oneHand = [...(D.oneHand || []), ...R.oneHand]; }
const OWN_BASICS = { warrior: { kd: ['kd', 0.1, 1.25, 0], up: ['up', 1.85, 6.2, 0] } }; /* (the warrior's own: his dodges, jump and death in MODELS, and the old knock-down and get-up) */
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
    const own = OWN_BASICS[cls], mv = D.moves || {}, named = new Set(Object.values(mv).map(sl => sl && sl[0])), basic = Object.fromEntries(Object.entries(BASIC_CLIPS).filter(([ck]) => named.has(ck) || (!own && Object.entries(BASIC_MOVES).some(([mk, sl]) => sl[0] === ck && !mv[mk])))); /* (only the basic clips for moves he has no recording of his own for, and any his own moves name (the warrior's right roll)) */
    await Promise.all(Object.entries(Object.assign(own ? { kd: 'models/anim/hit_kd.json', up: 'models/anim/hit_up.json' } : {}, D.clips)).map(([k, url]) => [k, url, null]).concat(Object.entries(basic).map(([k, b]) => [k, 'models/anim/' + b[0] + '.json', b])).map(async ([k, url, bc]) => /* (every hero shares the owner's Knock Down) */ { const J = url.endsWith('.json') ? await (await fetch(url)).json() : null, c = J ? THREE.AnimationClip.parse(J) : (await loadFbx(url)).animations[0]; if (!c) return; c.uuid = THREE.MathUtils.generateUUID(); /* (two keys loading the same file (the blunderbuss's walk and run) used to share one uuid, so the mixer gave them one action and the walk never played) */
      if (bc) { if (J && J.rest) retarget(c, J, base, false, { mirror: bc[1] === 'mirror', hips: bc[1] === 'flat' ? 'flat' : 'height' }); if (GROUNDED.includes(k)) groundClip(c, base); c.tracks = c.tracks.filter(t => !/\.position$/.test(t.name) || t.name === 'Hips.position'); clips[k] = c; return; } /* (a basic move: fitted to his body, his hips at his own height (lying, tucked, standing), their travel taken off: the game moves him) */
      if (J && J.rest && J.rig !== D.base) retarget(c, J, base, GAIT_KEYS.includes(k)); // (moves are stored as small motion-only files, not whole characters; one recorded on this very rig needs no fitting)
      { const hp = c.tracks.find(t => /^Hips\.position$/.test(t.name)); if (hp) c.userData = { root: { t: Float32Array.from(hp.times), v: Float32Array.from(hp.values) } }; } /* (the hips' own travel, kept before it is flattened: a move that steps forward carries the hero with it) */ c.tracks = c.tracks.filter(t => !/\.position$/.test(t.name) || (/^Hips\.position$/.test(t.name) && ((D.rootClip === k || (D.travelClips && D.travelClips.includes(k) ? keepHipPath(t, base) : HEIGHT_KEYS.includes(k) || (D.heightClips && D.heightClips.includes(k)) ? keepHipHeight(t, base) : D.rawHeight && D.rawHeight.includes(k) ? (keepHipRaw(t, base), groundClip(c, base)) : D.flatClips && D.flatClips.includes(k) ? flatHip(t) : GAIT_KEYS.includes(k) ? keepHipBob(t, base) : keepHipY(t))), true))); /* (bones keep this model's own lengths: only the hips' bob comes from the clip; a root-motion clip keeps its whole hip path, and the step is taken off again as the hero moves) */ if (D.uprightClips && D.uprightClips[k]) uprightHip(c, base, D.uprightClips[k]); clips[k] = c; }));
    base.traverse(o => { if (o.isMesh) { fixNormals(o.geometry); o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; const m = o.material; if (m && m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.anisotropy = 4; } if (m && m.map && D.skinFix) calmSkin(m.map, D.skinFix); if (m) { m.color && m.color.set('#ffffff'); m.shininess = 6; if (m.specular) m.specular.setScalar(0.08); /* (Phong rigs like the dark knight had a white sheen) */ m.side = THREE.DoubleSide; } /* (both sides drawn: no seeing through thin cloth and sleeves) */ } });
    if (D.strap) base.traverse(o => { if (o.isSkinnedMesh) strapOn(o, D.strap); });
    if (D.curl) curlFingers(base, D.curl); /* (her fingers closed round the grips: the model was made with open hands) */
    if (clips.runLegs) { if (clips.run) { const LEG = /^(Hips|(Left|Right)(UpLeg|Leg|Foot|ToeBase))\./; clips.run.tracks = clips.run.tracks.filter(t => !LEG.test(t.name)).concat(clips.runLegs.tracks.filter(t => LEG.test(t.name))); } delete clips.runLegs; } /* (runLegs: his own run's arms and body on the legs and hips of a run that fits his build better) */
    return { base, clips };
  })();
  return cache[cls];
}
// a part modelled into the mesh but skinned by the auto-rig to the wrong bones (the ranger's quiver rode on his drawing arm): every triangle
// with a corner that S.pick(x, y, z) chooses (rest pose, the model's own units) keeps only its weights on the S.keep bones and gives the rest to S.bone
function strapOn(o, S) { const g = o.geometry, sk = o.skeleton, P = g && g.attributes.position, SI = g && g.attributes.skinIndex, SW = g && g.attributes.skinWeight; if (!P || !SI || !SW || !sk) return 0;
  const names = sk.bones.map(b => b.name), to = names.indexOf(S.bone); if (to < 0) return 0; const keep = new Set(S.keep.map(n => names.indexOf(n)).filter(i => i >= 0)); keep.add(to);
  const idx = g.index ? g.index.array : null, nT = Math.floor((idx ? idx.length : P.count) / 3), v = new THREE.Vector3(), done = new Uint8Array(P.count); let n = 0;
  for (let t = 0; t < nT; t++) { const c = [0, 1, 2].map(j => idx ? idx[t * 3 + j] : t * 3 + j); if (!c.some(i => { v.fromBufferAttribute(P, i).applyMatrix4(o.bindMatrix); return S.pick(v.x, v.y, v.z); })) continue;
    for (const i of c) { if (done[i]) continue; done[i] = 1; n++; let moved = 0; for (let j = 0; j < 4; j++) { const w = SW.getComponent(i, j); if (w > 0 && !keep.has(SI.getComponent(i, j))) { moved += w; SW.setComponent(i, j, 0); } }
      if (moved > 0) { let slot = -1; for (let j = 0; j < 4; j++) if (SI.getComponent(i, j) === to && SW.getComponent(i, j) > 0) slot = j; if (slot < 0) for (let j = 0; j < 4; j++) if (SW.getComponent(i, j) === 0) { slot = j; break; } SI.setComponent(i, slot, to); SW.setComponent(i, slot, SW.getComponent(i, slot) + moved); } } }
  SI.needsUpdate = true; SW.needsUpdate = true; return n; }
// the quiver's mouth in the world now (it rides the bone it is strapped to), or null
function quiverTop(H) { const P0 = H.D.quiverTop; if (!P0 || !H.D.strap) return null; if (H.qSk === undefined) { H.qSk = null; H.m.traverse(o => { if (o.isSkinnedMesh && !H.qSk) H.qSk = o; }); } const sk = H.qSk; if (!sk) return null;
  const i = sk.skeleton.bones.findIndex(b => b.name === H.D.strap.bone); if (i < 0) return null; const b = sk.skeleton.bones[i]; b.updateWorldMatrix(true, false); return new THREE.Vector3().fromArray(P0).applyMatrix4(sk.bindMatrix).applyMatrix4(sk.skeleton.boneInverses[i]).applyMatrix4(b.matrixWorld); }
// where an arrow lies on the bow's rest in the hero's fist, in the world (the shot leaves from here in third person), or null
export function bowRest(ch) { const H = ch && ch.heroModel, bw = ch && ch.weapons && ch.weapons.main; if (!H || H === 'loading' || !bw || bw.name !== 'weapon_bow' || !bw.parent || !ch.root || !ch.root.visible) return null; bw.updateWorldMatrix(true, false); return bw.localToWorld(new THREE.Vector3(0, 0.03, 0)); }
// a move recorded on an older version of the model: turn each bone's keys from that model's rest pose to this one's
// o.mirror: the move seen in a mirror (each bone takes the turn of its twin on the other side, reflected across his middle; his weapon hand stays
// his weapon hand). o.hips ('height' / 'flat'): the hips keep the recording's height scaled to this hero's own hip height (or stay level), never its travel
function retarget(clip, J, base, gait, o = {}) {
  // world-space retarget: each bone keeps the same turn away from its rest pose, measured in the world, so parents and children agree
  const T = {}, order = []; base.traverse(o => { if (o.isBone) { T[o.name] = o; order.push(o); } });
  const qt = {}; let N = 0; for (const tr of clip.tracks) { const [bn, prop] = tr.name.split('.'); if (prop === 'quaternion' && T[bn]) { qt[bn] = tr; N = Math.max(N, tr.times.length); } }
  for (const bn in qt) if (qt[bn].times.length !== N) return; // (keys out of step: leave the clip alone rather than guess)
  const par = (b) => (b.parent && b.parent.isBone ? b.parent.name : null), Q = () => new THREE.Quaternion();
  const sRestW = {}, tRestW = {}; for (const b of order) { const p = par(b), sl = J.rest[b.name] ? Q().fromArray(J.rest[b.name]) : b.quaternion.clone(); sRestW[b.name] = p ? sRestW[p].clone().multiply(sl) : sl; tRestW[b.name] = p ? tRestW[p].clone().multiply(b.quaternion) : b.quaternion.clone(); }
  const out = {}; for (const bn in qt) out[bn] = new Float32Array(qt[bn].values.length);
  const twin = (n) => { const m = o.mirror ? n.replace(/^(Left|Right)/, (s) => (s === 'Left' ? 'Right' : 'Left')) : n; return T[m] ? m : n; }, ax = o.mirror ? sideAxis(base) : null;
  const sW = {}, tW = {}, tmp = Q();
  for (let f = 0; f < N; f++) {
    for (const b of order) { const n = b.name, p = par(b), tr = qt[n]; const sl = tr ? Q().fromArray(tr.values, f * 4) : (J.rest[n] ? Q().fromArray(J.rest[n]) : b.quaternion.clone()); sW[n] = p ? sW[p].clone().multiply(sl) : sl; }
    for (const b of order) { const n = b.name, p = par(b), m = twin(n), d = sW[m].clone().multiply(tmp.copy(sRestW[m]).invert()); if (ax) reflectQ(d, ax);
      tW[n] = d.multiply(tRestW[n]);
      if (qt[n]) { const loc = p ? tmp.copy(tW[p]).invert().multiply(tW[n]) : tW[n].clone(); loc.toArray(out[n], f * 4); } } }
  for (const bn in qt) qt[bn].values = out[bn];
  if (o.hips) { const hp = clip.tracks.find(t => t.name === 'Hips.position'), hb = T.Hips, s0 = J.restPos && J.restPos.Hips; if (hp && hb && hb.parent && s0) { const u = upAxisOf(hb.parent), b0 = hb.position.toArray(), k = Math.abs(s0[u]) > 1e-3 ? b0[u] / s0[u] : 1, v = hp.values; for (let i = 0; i < v.length; i += 3) for (let a = 0; a < 3; a++) v[i + a] = a === u && o.hips !== 'flat' ? v[i + a] * k : b0[a]; } return; }
  for (const tr of clip.tracks) { const [bn, prop] = tr.name.split('.'); const tb = T[bn]; if (prop === 'position' && bn === 'Hips' && tb && J.restPos && J.restPos.Hips) { const v = tr.values, s0 = J.restPos.Hips;
    if (gait && tb.parent) { const u = upAxisOf(tb.parent), b0 = tb.position.toArray(), k = Math.abs(s0[u]) > 1e-3 ? b0[u] / s0[u] : 1; for (let i = 0; i < v.length; i += 3) for (let a = 0; a < 3; a++) v[i + a] = a === u ? v[i + a] * k : b0[a]; continue; } /* (a walk or run keeps its hips' rise and fall, scaled to this hero's hip height, on the rig's real up axis (the third value on these Z-up rigs): see keepHipBob) */
    const k = tb.position.y / (s0[1] || 1); for (let i = 0; i < v.length; i += 3) { v[i] = tb.position.x; v[i + 1] *= k; v[i + 2] = tb.position.z; } } }
}
// set a rolling or lying move down on the ground for this body: the recording's hip height scaled to his own still leaves a body built
// differently (a goblin, a giant) floating over the ground or sunk into it while he is low. Each key is posed on the rig, his lowest point of
// skin found (a few points of skin carried by each bone), and while he is low (hips under about two thirds of his standing height) the hips
// are moved so that point touches the ground; he is never left below it
const GROUNDED = ['sh_roll', 'sh_rollL', 'sh_rollR', 'sh_dead', 'kd', 'up', 'sh_backj', 'sh_hit']; /* (the back jump and the flinch stay up on their feet: for them only the never-below-the-ground part matters) */
function skinProbe(base) { if (base.userData.probe) return base.userData.probe; const pts = {}; base.updateMatrixWorld(true); const v = new THREE.Vector3();
  base.traverse(o => { if (!o.isSkinnedMesh || !o.skeleton) return; const g = o.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight; if (!P || !SI || !SW) return; const step = Math.max(1, Math.floor(P.count / 4000));
    for (let i = 0; i < P.count; i += step) { let best = -1, bw = 0; for (let j = 0; j < 4; j++) { const w = SW.getComponent(i, j); if (w > bw) { bw = w; best = SI.getComponent(i, j); } } const bone = best >= 0 && o.skeleton.bones[best]; if (!bone) continue;
      v.fromBufferAttribute(P, i).applyMatrix4(o.bindMatrix).applyMatrix4(o.skeleton.boneInverses[best]); (pts[bone.name] = pts[bone.name] || []).push(v.x, v.y, v.z); } });
  return (base.userData.probe = pts); }
function groundClip(clip, base) { const hb = base.getObjectByName('Hips'), hp = clip.tracks.find(t => t.name === 'Hips.position'); if (!hb || !hb.parent || !hp) return; const probe = skinProbe(base), B = {}; base.traverse(o => { if (o.isBone) B[o.name] = o; });
  const qs = clip.tracks.filter(t => /\.quaternion$/.test(t.name) && B[t.name.split('.')[0]]).map(t => [B[t.name.split('.')[0]], t]), N = hp.times.length; if (qs.some(([, t]) => t.times.length !== N)) return;
  const keep = qs.map(([b]) => b.quaternion.clone()), keepP = hb.position.clone(), u = upAxisOf(hb.parent), r0 = hb.position.getComponent(u);
  const low = () => { base.updateMatrixWorld(true); let m = Infinity; for (const bn in probe) { const b = B[bn]; if (!b) continue; const e = b.matrixWorld.elements, P = probe[bn]; for (let i = 0; i < P.length; i += 3) { const y = e[1] * P[i] + e[5] * P[i + 1] + e[9] * P[i + 2] + e[13]; if (y < m) m = y; } } return m; };
  const g0 = low(), col = new THREE.Vector3().setFromMatrixColumn(hb.parent.matrixWorld, u), s = col.length() * Math.sign(col.y || 1); /* (the ground: his lowest point standing in the rest pose; s: world height per unit of hip height) */
  const v = hp.values; for (let f = 0; f < N; f++) { for (const [b, t] of qs) b.quaternion.fromArray(t.values, f * 4); hb.position.fromArray(v, f * 3); const gap = low() - g0, ratio = v[f * 3 + u] / (r0 || 1), x = Math.max(0, Math.min(1, (0.72 - ratio) / 0.17)), w = x * x * (3 - 2 * x);
    const lift = gap < 0 ? -gap : -gap * w; if (Math.abs(s) > 1e-9) v[f * 3 + u] += lift / s; }
  qs.forEach(([b], i) => b.quaternion.copy(keep[i])); hb.position.copy(keepP); base.updateMatrixWorld(true); } /* (the rig is left exactly in its rest pose: every hero is cloned from it) */
// his left-to-right axis in the frame his hips hang in (the nearest of its three axes: these rigs stand square to it)
function sideAxis(base) { const hb = base.getObjectByName('Hips'), L = base.getObjectByName('LeftUpLeg'), R = base.getObjectByName('RightUpLeg'), v = new THREE.Vector3(1, 0, 0); if (!hb || !hb.parent || !L || !R) return v; base.updateMatrixWorld(true);
  const inv = hb.parent.matrixWorld.clone().invert(); v.copy(L.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv)).sub(R.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv)); const a = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)], i = a.indexOf(Math.max(...a)); return new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0); }
// a turn seen in a mirror across the plane square to n: its axis reflected (and the turn reversed, as a mirror does)
function reflectQ(q, n) { const d = q.x * n.x + q.y * n.y + q.z * n.z; return q.set(2 * d * n.x - q.x, 2 * d * n.y - q.y, 2 * d * n.z - q.z, q.w); }
// keep the hips bobbing up and down but not travelling forward or sideways
function flatHip(track) { const v = track.values; if (!v || v.length < 3) return; for (let i = 3; i < v.length; i++) v[i] = v[i % 3]; } /* (the hips stay where they start: the game's own jump or charge moves the hero) */
// falls and rolls need the hips' real height (lying on the ground, tucked low): these Meshy rigs stand Z-up, so the
// height is the third value, scaled to this hero's own hip height; the travel is taken off (the game moves the hero)
const HEIGHT_KEYS = ['kd', 'up'];
function keepHipHeight(track, base) { const v = track.values; if (!v || v.length < 3) return; const hb = base && base.getObjectByName('Hips'); if (!hb) return keepHipY(track);
  const up = new THREE.Vector3(0, 0, 1).applyQuaternion(hb.parent ? hb.parent.quaternion : new THREE.Quaternion()), zUp = Math.abs(up.y) > 0.7; if (!zUp) return keepHipY(track);
  const rx = hb.position.x, ry = hb.position.y, rz = hb.position.z, k = rz / (Math.max(v[2], v[v.length - 1]) || rz || 1); /* (scaled from the end of the clip where he is standing: the get-up starts lying down) */ for (let i = 0; i < v.length; i += 3) { v[i] = rx; v[i + 1] = ry; v[i + 2] = v[i + 2] * k; } }
// a clip whose hips tumble (a dive, a flip) replaced by hips standing upright, only leaning forward or back about his own side axis by the keyed angles
function uprightHip(clip, base, keys) { const tr = clip.tracks.find(t => t.name === 'Hips.quaternion'), hb = base.getObjectByName('Hips'); if (!tr || !hb) return; const ax = new THREE.Vector3(1, 0, 0), q = new THREE.Quaternion();
  const at = (t) => { let i = 0; while (i < keys.length - 2 && keys[i + 1][0] < t) i++; const [t0, a0] = keys[i], [t1, a1] = keys[i + 1], f = Math.max(0, Math.min(1, (t - t0) / Math.max(1e-6, t1 - t0))), s = f * f * (3 - 2 * f); return (a0 + (a1 - a0) * s) * Math.PI / 180; };
  for (let i = 0; i < tr.times.length; i++) { q.setFromAxisAngle(ax, at(tr.times[i])).multiply(hb.quaternion); q.toArray(tr.values, i * 4); } }
const GAIT_KEYS = ['walk', 'run', 'back', 'runLegs'];
// walking and running keep the clip's own rise and fall of the hips and lose only the travel. These rigs stand Z-up, so the height is the
// third value, which keepHipY flattened (it kept a sideways one instead): without the bob the planted foot met the ground at the wrong
// moments and slid. The up axis is read from the model, so a Y-up rig works too
function upAxisOf(o) { const q = o.getWorldQuaternion(new THREE.Quaternion()), up = [0, 1, 2].map(a => Math.abs(new THREE.Vector3(a === 0 ? 1 : 0, a === 1 ? 1 : 0, a === 2 ? 1 : 0).applyQuaternion(q).y)); return up.indexOf(Math.max(...up)); } /* (which of o's own axes points up in the world) */
function keepHipBob(track, base) { const v = track.values; if (!v || v.length < 3) return; const hb = base && base.getObjectByName('Hips'); if (!hb || !hb.parent) return keepHipY(track);
  const u = upAxisOf(hb.parent);
  const h0 = [v[0], v[1], v[2]]; for (let i = 0; i < v.length; i += 3) for (let a = 0; a < 3; a++) if (a !== u) v[i + a] = h0[a]; }
// a move recorded on this very model that steps (in and back again): the hips keep their whole path and their own height, only moved so the first
// frame stands where he stands; his recorded legs then carry the step and the feet stay where the recording puts them
function keepHipPath(track, base) { const v = track.values, hb = base && base.getObjectByName('Hips'); if (!v || v.length < 3 || !hb) return; const up = new THREE.Vector3(0, 0, 1).applyQuaternion(hb.parent ? hb.parent.quaternion : new THREE.Quaternion()), zUp = Math.abs(up.y) > 0.7, h = zUp ? 1 : 2, x0 = v[0], y0 = v[h], rx = hb.position.x, ry = h === 1 ? hb.position.y : hb.position.z; for (let i = 0; i < v.length; i += 3) { v[i] = rx + (v[i] - x0); v[i + h] = ry + (v[i + h] - y0); } }
// a fall recorded on this very rig: the hips keep their recorded height (on his real up axis), only their travel is taken off
function keepHipRaw(track, base) { const hb = base && base.getObjectByName('Hips'), v = track.values; if (!hb || !hb.parent || !v) return; const u = upAxisOf(hb.parent), b0 = hb.position.toArray(); for (let i = 0; i < v.length; i += 3) for (let a = 0; a < 3; a++) if (a !== u) v[i + a] = b0[a]; }
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
    ch.heroModel = { m, wrap, mixer, act, D, bones, bind, idle: idlePose(m, bones), w: { idle: 1, walk: 0, run: 0 }, lp: ch.root.position.clone(), v: 0, t: 0, M: Object.assign({}, OWN_BASICS[cls] || Object.fromEntries(Object.entries(BASIC_MOVES).filter(([, sl]) => clips[sl[0]])), D.moves || {}) }; /* (M: every move he can play, the basic set under his own) */
    if (D.recFix) { wrap.updateMatrixWorld(true); const toe = bones.LeftToeBase || bones.LeftFoot; if (toe) ch.heroModel.toeG = toe.getWorldPosition(new THREE.Vector3()).y - wrap.getWorldPosition(new THREE.Vector3()).y; } /* (how high the toe bone stands off the ground when his feet are flat on it) */
  }).catch(e => { console.warn('hero model', cls, e); ch.heroModel = null; for (const o of hidden) { o.visible = true; o.userData.hmHide = false; } });
}
// a fist for a model made with open hands (Meshy rigs have no finger bones): in each hand's rest frame the skin past the knuckles turns in
// toward the palm about the knuckle line, more the further out it is (a spiral, like three finger joints closing), so the fingers wrap the
// grip instead of splaying across it. The thumb (well out to the thumb side) is left alone. o: [knuckle line 0-1 up the hand, curl at the
// fingertips in radians]
function curlFingers(base, o) { const K0 = (o && o[0]) || 0.52, A = (o && o[1]) || 2.5; base.updateMatrixWorld(true); const hands = []; base.traverse(b => { if (b.isBone && /^(Left|Right)Hand$/.test(b.name)) hands.push(b); });
  base.traverse(sk => { if (!sk.isSkinnedMesh || !sk.skeleton) return; const G = sk.geometry, P = G.attributes.position, N = G.attributes.normal, SI = G.attributes.skinIndex, SW = G.attributes.skinWeight; if (!P || !SI || !SW) return;
    for (const hb of hands) { const bi = sk.skeleton.bones.indexOf(hb); if (bi < 0) continue; const mt = new THREE.Matrix4().multiplyMatrices(sk.skeleton.boneInverses[bi], sk.bindMatrix), mi = mt.clone().invert(), nm = new THREE.Matrix3().setFromMatrix4(mt), ni = nm.clone().invert();
      const ids = [], v = new THREE.Vector3(), c = new THREE.Vector3(); for (let i = 0; i < P.count; i++) { let best = -1, bw = 0; for (let j = 0; j < 4; j++) { const w = SW.getComponent(i, j); if (w > bw) { bw = w; best = SI.getComponent(i, j); } } if (best === bi && bw >= 0.5) { ids.push(i); c.add(v.fromBufferAttribute(P, i).applyMatrix4(mt)); } }
      if (ids.length < 8) continue; c.multiplyScalar(1 / ids.length); const F = c.clone().normalize(); let len = 0; for (const i of ids) len = Math.max(len, v.fromBufferAttribute(P, i).applyMatrix4(mt).dot(F));
      const iq = new THREE.Quaternion(); sk.skeleton.boneInverses[bi].decompose(new THREE.Vector3(), iq, new THREE.Vector3()); const T = new THREE.Vector3(0, 0, 1).applyQuaternion(iq); T.addScaledVector(F, -T.dot(F)).normalize(); const X = new THREE.Vector3().crossVectors(T, F), side = hb.name.startsWith('Right') ? 1 : -1;
      let tm = 0; for (const i of ids) tm += v.fromBufferAttribute(P, i).applyMatrix4(mt).dot(T); tm /= ids.length; /* (the hand's middle, across) */
      const s0 = len * K0, piv = F.clone().multiplyScalar(s0), q = new THREE.Quaternion(), w = new THREE.Vector3(), n = new THREE.Vector3();
      for (const i of ids) { v.fromBufferAttribute(P, i).applyMatrix4(mt); const sA = v.dot(F); if (sA <= s0) continue; const lat = v.dot(T) - tm; if (lat > len * 0.3 && sA < len * 0.9) continue; /* (the thumb) */
        const u = Math.min(1, (sA - s0) / Math.max(1e-6, len - s0)); q.setFromAxisAngle(T, side * A * Math.pow(u, 0.85)); w.copy(v).sub(piv).applyQuaternion(q).add(piv).applyMatrix4(mi); P.setXYZ(i, w.x, w.y, w.z);
        if (N) { n.fromBufferAttribute(N, i).applyMatrix3(nm).applyQuaternion(q).applyMatrix3(ni).normalize(); N.setXYZ(i, n.x, n.y, n.z); } }
      P.needsUpdate = true; if (N) N.needsUpdate = true; }
    G.computeBoundingBox(); G.computeBoundingSphere(); }); }
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
  const O = o || [0.55, 0, 0]; if (O[2]) T.applyAxisAngle(F, O[2]); const X = new THREE.Vector3().crossVectors(T, F), side = hb.name.startsWith('Right') ? 1 : -1; /* (x is the palm side of a right fist, the back of a left one) */
  const p = F.clone().multiplyScalar(len * O[0]).addScaledVector(X, side * len * (O[1] || 0)); let Tq = T, Fq = F; if (O[3]) { Tq = T.clone().applyAxisAngle(X, O[3]); Fq = F.clone().applyAxisAngle(X, O[3]); } /* (4th: the grip tilted from the thumb side toward the fingers, so a blade held out of the thumb side runs forward along the forearm, the way a dagger is held to stab) */
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Tq, Fq));
  return { q, p, len }; }
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
// which arc a built blow follows (null: none): the action's name, a spear's thrust, a big two-hander's wide sweeps
function arcKind(nm, main, B) { let kind = /^(swing3|smash|heavy|chop|slam|cleave)/.test(nm) ? 'over' : /^(stab|thrust|lunge|bash)/.test(nm) ? 'stab' : /^(swing2|reap|off)/.test(nm) ? 'back' : /^lowcut/.test(nm) ? 'low' : /^(swing|slash|sweep|strike)/.test(nm) ? 'side' : null; if (!kind || !main) return kind;
  if (kind === 'stab' && /spear/.test(main.name)) kind = 'spear'; if (/greataxe|greatsword|warhammer/.test(main.name) && (kind === 'side' || kind === 'back') && B.LeftArm) kind = kind === 'side' ? 'wideS' : 'wideB'; return kind; }
// how far along its arc (a, as arcDir takes it) each kind of blow points straight at the target: the overhead level in front of him, a sweep
// straight ahead, a stab at full stretch
const ARC_STRIKE = { over: 132 / 172, back: 75 / 180, low: 100 / 170, wideS: 72 / 154, wideB: 72 / 154, side: 105 / 180, stab: 0.86, spear: 0.86 };
const smInv = (y) => 0.5 - Math.sin(Math.asin(Math.max(-1, Math.min(1, 1 - 2 * y))) / 3); /* (the inverse of smoothstep) */
// when the game lands the blow, as a share of the action: the player's own attack (its hitK, or the share player.js uses for that name), or a
// computer fighter's pending hit (its action clock then plus the time still to wait); null when it is not known
function blowAt(ch, H, nm, kT) { const u = ch._u; if (!u) return null; const a = u.atk;
  if (a && a.name === nm && a.noQueue && a.hitK == null) return null; /* (an ability's swing (its damage comes from the ability itself): left on its own clock) */
  if (a && a.name === nm) return a.hitK != null ? a.hitK : nm === 'smash' ? 0.62 : nm === 'spin' ? 0.5 : nm === 'swing3' || nm === 'thrust3' ? 0.5 : nm === 'heavy' ? 0.3 : nm === 'area' ? 0.25 : 0.4;
  if (u.act === nm && u.pending && u.pending.t > 0 && kT != null) H.arcHk = { nm, hk: Math.max(0.05, Math.min(0.95, kT + u.pending.t * (u.actSp || 1.6))) };
  return H.arcHk && H.arcHk.nm === nm ? H.arcHk.hk : null; }
// a built blow's clock (0..1), bent so that the weapon points at the target at the very moment the game lands the blow: before, it was still
// 39-44 degrees short then (the overhead still well above level, a great sweep still off to his right). Wind-up, sweep and follow-through
// keep their shape; only the stretch before the blow and the stretch after it are each played faster or slower
function arcClock(ch, H, nm, kT, kind) { const k = Math.max(0, Math.min(1, kT)), hk = blowAt(ch, H, nm, kT), aS = ARC_STRIKE[kind]; if (hk == null || aS == null || hk <= 0.02 || hk >= 0.98) return k;
  const kS = aS <= 0.86 ? 0.3 + 0.34 * smInv(aS / 0.86) : 0.64 + 0.16 * smInv((aS - 0.86) / 0.14); /* (where the unbent clock reaches it) */
  return k <= hk ? k * kS / hk : kS + (k - hk) * (1 - kS) / (1 - hk); }
function meleeArc(ch, H, B, act, mvK) {
  ch._arc = null; if (/[?&]noarc/.test(location.search)) return; const st = ch._st || {}, nm = ch._act || '', kT = st.actionT, W = ch.weapons || {}, main = W.main;
  if (!act || mvK || kT == null || !main || !/^weapon_/.test(main.name || '') || /bow|staff|musket|blunderbuss|wand|orb|book|lute|censer|scepter|doll|detonator|grenade|fists/.test(main.name)) return;
  const kind = arcKind(nm, main, B); if (!kind) return; const spear = kind === 'spear';
  const sh = B.RightArm, fo = B.RightForeArm, hd = B.RightHand; if (!sh || !fo || !hd) return;
  const big = kind === 'wideS' || kind === 'wideB'; /* (big two-handers sweep wide around the chest, both hands in front, never through the body) */
  const k = arcClock(ch, H, nm, kT, kind), sm = (x) => x * x * (3 - 2 * x); /* (the swing's own clock, bent so the weapon reaches the target when the blow lands) */
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
// one shot of the bow, again and again while attack is held. ch._st.actionT runs 0..1 over the shot; bowRel (if given) is when the arrow
// leaves (else just past halfway, as the computer archers loose). The bow comes up into the aim and stays up while he keeps shooting; the
// string hand starts on the string, draws it back to the anchor under the jaw, holds a beat and looses; then it flicks back, reaches over his
// right shoulder to the quiver and brings the next arrow to the string. The bow is held upright, string toward him, its top canted out, a
// little outside his eye line, so from the camera behind him it stands clear of his head
const BOW = { cant: 0.3, out: 0.28, up: 0.1, turn: 0.35 }; /* (turn: the bow's face turned a little toward the camera over his right shoulder, so its curve shows, not only its edge) */
function bowDraw(ch, H, B, act, dt) { const W = ch.weapons || {}, main = W.main, on = !!(act && ch._act === 'shoot' && main && main.name === 'weapon_bow');
  H.bowUp = (H.bowUp || 0) + ((on ? 1 : 0) - (H.bowUp || 0)) * Math.min(1, (dt || 0.033) * (on ? 16 : 8)); ch._bowD = null; if (!on) return;
  const shL = B.LeftArm, shR = B.RightArm, hd = B.Head, sock = (ch.hmSockets || []).find(s => s.userData.side === 'L'); if (!shL || !shR || !hd || !B.LeftForeArm || !B.LeftHand || !sock || main.parent !== sock) return;
  H.m.updateMatrixWorld(true); const wq = H.wrap.getWorldQuaternion(new THREE.Quaternion()), U = new THREE.Vector3(0, 1, 0), F = new THREE.Vector3(0, 0, 1).applyQuaternion(wq).setY(0).normalize(), R = new THREE.Vector3().crossVectors(F, U).normalize();
  const SL = shL.getWorldPosition(new THREE.Vector3()), SR = shR.getWorldPosition(new THREE.Vector3()), Hp = hd.getWorldPosition(new THREE.Vector3()), EL = B.LeftForeArm.getWorldPosition(new THREE.Vector3()), len = SL.distanceTo(EL) + EL.distanceTo(B.LeftHand.getWorldPosition(new THREE.Vector3()));
  const st = ch._st || {}, k = Math.max(0, Math.min(1, st.actionT || 0)), rel = st.bowRel != null ? st.bowRel : 0.56, sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }, w = sm(H.bowUp);
  const L = SL.clone().addScaledVector(F, 0.93 * len).addScaledVector(R, (0.22 - BOW.out) * len).addScaledVector(U, BOW.up * len); /* (bow arm straight out toward the target) */
  const anchor = Hp.clone().addScaledVector(F, 0.14 * len).addScaledVector(U, 0.06 * len).addScaledVector(R, 0.12 * len); /* (the anchor: the string hand at the corner of the jaw) */
  // the bow's place and angle once the fist is there: upright, the string toward him, the top canted out to his left
  const yB = U.clone().multiplyScalar(Math.cos(BOW.cant)).addScaledVector(R, -Math.sin(BOW.cant)), zB = F.clone().negate().applyAxisAngle(U, BOW.turn); zB.addScaledVector(yB, -zB.dot(yB)).normalize(); const xB = new THREE.Vector3().crossVectors(yB, zB);
  const bq = main.userData.baseQ || main.quaternion, bp = main.userData.baseP || main.position, qL = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xB, yB, zB)).multiply(bq.clone().invert());
  const Mb = new THREE.Matrix4().compose(L, qL, sock.getWorldScale(new THREE.Vector3())).multiply(new THREE.Matrix4().compose(bp, bq, main.scale));
  const nockP = new THREE.Vector3(0, 0, main.userData.stringZ || 0.25).applyMatrix4(Mb), restP = new THREE.Vector3(0, 0.03, 0).applyMatrix4(Mb);
  let Rt, poleR = SR.clone().addScaledVector(R, 0.9 * len).addScaledVector(U, 0.05 * len).addScaledVector(F, -0.6 * len), str = 0, arrow = true, post = null;
  if (k < rel) { Rt = nockP.clone().lerp(anchor, sm((k - 0.05) / Math.max(0.05, rel - 0.13))); str = 1; } /* (nocked, drawn back to the anchor, held a beat) */
  else { const a = (k - rel) / Math.max(0.05, 1 - rel), flick = anchor.clone().addScaledVector(F, -0.16 * len).addScaledVector(R, 0.1 * len), quiv = quiverTop(H) || SR.clone().addScaledVector(U, 0.45 * len).addScaledVector(F, -0.2 * len).addScaledVector(R, 0.15 * len);
    Rt = a < 0.2 ? anchor.clone().lerp(flick, sm(a / 0.2)) : a < 0.55 ? flick.clone().lerp(quiv, sm((a - 0.2) / 0.35)) : quiv.clone().lerp(nockP, sm((a - 0.55) / 0.45)); /* (loosed: the hand flicks back past the jaw, goes to the quiver, and brings the next arrow to the string) */
    poleR.lerp(SR.clone().addScaledVector(R, 0.6 * len).addScaledVector(U, 0.9 * len).addScaledVector(F, 0.15 * len), Math.sin(sm((a - 0.15) / 0.75) * Math.PI)); /* (reaching back over the shoulder: the elbow comes up) */
    arrow = a > 0.55; post = a; }
  ch._bowD = { L, R: Rt, poleR, w, qL, str, arrow, post, arLen: anchor.distanceTo(restP) + 0.12 * len }; }
// between shots the drawing arm follows the archer's own recording (D.reachClip, the stretch D.reachT of it, made on his model): from the loose
// it reaches back over his shoulder to the quiver and comes down with the next arrow, blended in after the flick and out again onto the string
const REACH_BONES = ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'];
function reachBack(ch, H, B) { const D = ch._bowD, a = D.post, sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }, w = sm((a - 0.12) / 0.16) * (1 - sm((a - 0.6) / 0.3)) * D.w; if (w < 0.01) return;
  const A = H.act[H.D.reachClip]; if (!A) return; const T = H.D.reachT, t = T[0] + (T[1] - T[0]) * Math.max(0, Math.min(1, (a - 0.12) / 0.78));
  if (!H.rchI) { const clip = A.getClip(); H.rchI = Object.fromEntries(REACH_BONES.map(n => { const tr = clip.tracks.find(x => x.name === n + '.quaternion'); return [n, tr ? tr.createInterpolant(new Float32Array(4)) : null]; })); }
  const q = new THREE.Quaternion(); for (const n of REACH_BONES) { const b = B[n], ip = H.rchI[n]; if (!b || !ip) continue; const v = ip.evaluate(t); q.set(v[0], v[1], v[2], v[3]).normalize(); b.quaternion.slerp(q, w); }
  H.m.updateMatrixWorld(true); }
// the bow's string on the drawing fingers while he draws, with the arrow laid from the string over the rest; straight again once loosed
function bowString(ch, B) { const W = ch.weapons || {}, bw = W.main; if (!bw || bw.name !== 'weapon_bow' || !bw.userData.string) return; const sg = bw.userData.string, pa = sg.geometry.attributes.position; if (!sg.userData.mid) sg.userData.mid = new THREE.Vector3(pa.getX(1), pa.getY(1), pa.getZ(1));
  const D = ch._bowD, hd = (ch.hmSockets || []).find(s => s.userData.side === 'R') || B.RightHand; let ar = bw.userData.arrow3; /* (the fist, not the wrist: the string sits in the fingers) */
  if (!D || !hd || D.w < 0.05) { pa.setXYZ(1, sg.userData.mid.x, sg.userData.mid.y, sg.userData.mid.z); pa.needsUpdate = true; if (ar) ar.visible = false; return; }
  hd.updateWorldMatrix(true, false); const hp = hd.getWorldPosition(new THREE.Vector3()); bw.updateWorldMatrix(true, false); sg.updateWorldMatrix(true, false);
  const lp = sg.worldToLocal(hp.clone()), m = sg.userData.mid, sw = D.w * (D.str != null ? D.str : 1); pa.setXYZ(1, m.x + (lp.x - m.x) * sw, m.y + (lp.y - m.y) * sw, m.z + (lp.z - m.z) * sw); pa.needsUpdate = true; /* (the nocking point on the fingers) */
  if (!ar) { ar = new THREE.Group(); const wood = new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.7 }), st = new THREE.MeshStandardMaterial({ color: '#b8bcc0', roughness: 0.3, metalness: 0.9 }), fe = new THREE.MeshStandardMaterial({ color: '#d8d0c0', roughness: 0.9, side: THREE.DoubleSide });
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), wood); sh.position.y = 0.5; ar.add(sh); const h2 = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.065, 4), st); h2.position.y = 1.02; ar.add(h2); const fe2 = new THREE.MeshStandardMaterial({ color: '#c8321e', roughness: 0.9, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) { const v = new THREE.Mesh(new THREE.PlaneGeometry(0.034, 0.12), i ? fe : fe2); v.position.set(0, 0.08, 0); v.rotation.y = i * Math.PI * 2 / 3; v.translateX(0.017); ar.add(v); }
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })); fl.position.y = 1.0; fl.scale.set(1, 1.6, 1); ar.add(fl);
    ar.traverse(o => { if (o.isMesh) o.castShadow = false; }); ch.root.add(ar); /* (on the hero's root: hidden with him, e.g. in your own first person) */ bw.userData.arrow3 = ar; }
  if (D.arrow === false) { ar.visible = false; return; } /* (loosed: nothing on the string until the next arrow comes from the quiver) */
  const rest = bw.localToWorld(new THREE.Vector3(0, 0.03, 0)), dir = rest.clone().sub(hp), L = dir.length(); if (L < 1e-3) return; dir.divideScalar(L);
  ch.root.updateWorldMatrix(true, false); const rq = ch.root.getWorldQuaternion(new THREE.Quaternion()), rs = ch.root.getWorldScale(new THREE.Vector3()).x || 1; ar.visible = true; ar.position.copy(ch.root.worldToLocal(hp.clone())); ar.quaternion.copy(rq.invert().multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir))); ar.scale.setScalar((D.arLen || Math.max(0.5, L + 0.12)) / rs); /* (nock on the string, shaft over the rest; always an arrow's own length, so it slides back over the bow as he draws) */ }
// a recorded attack (made without a weapon): the weapon runs straight on from the forearm and its edge leads the way the hand is moving
function moveWeapon(ch, H, B, mvK, dt) { const main = ch.weapons && ch.weapons.main; if (!main || !main.parent || !/^weapon_(sword|greatsword|greataxe|axe|mace|warhammer|handaxe)/.test(main.name) || !B.RightHand || !B.RightForeArm) return;
  const ud = main.userData; if (H.D.axeSwing && H.psOn) { if (ud.mwBase) { main.quaternion.copy(ud.mwBase); main.position.copy(ud.mwBaseP); ud.mwBase = null; } H.mwK = 0; H.mwPrev = null; return; } /* (the berserker's built swing lays the axe by turning his fists) */
  if (H.psOn) { H.mwK = 0; H.mwPrev = null; return; } /* (the warrior's built swing holds the sword itself) */
  if (H.D.rideFist) { if (ud.mwBase) { main.quaternion.copy(ud.mwBase); main.position.copy(ud.mwBaseP); ud.mwBase = null; } H.mwK = 0; H.mwPrev = null; return; } /* (the warrior's recorded swings: the sword simply rides his fist the way the owner's animation holds it, nothing re-aims it) */
  if (H.D.recGrip) { const rg = !!(mvK && H.D.recLegs && H.D.recLegs.includes(mvK) && !(H.D.oneHand && H.D.oneHand.includes(mvK)) && PUNCH.test(ch._act || '')); H.rgL = Math.max(0, Math.min(1, (H.rgL || 0) + (rg ? dt : -dt) / 0.2)); /* (the berserker's recorded combo: the axe turns once, smoothly, to its grip as he goes into it, then stays fixed in his fist through every blow) */
    if (H.rgL > 0) { if (!ud.mwBase) { ud.mwBase = main.quaternion.clone(); ud.mwBaseP = main.position.clone(); } const s = H.rgL * H.rgL * (3 - 2 * H.rgL), qR = (H.rgQ || (H.rgQ = new THREE.Quaternion().fromArray(H.D.recGrip).normalize())).clone().multiply(ud.mwBase.clone().invert()), qk = new THREE.Quaternion().slerp(qR, s);
      main.quaternion.copy(qk).multiply(ud.mwBase); main.position.copy(ud.mwBaseP).applyQuaternion(qk); H.mwK = 0; H.mwPrev = null; return; } } /* (turned about the fist: the haft stays in his hand) */
  const on = !!(mvK && PUNCH.test(ch._act || '') && H.D.moves && H.D.moves[mvK] && !/^(dead|cheer|roll|flip)$/.test(mvK)); H.mwK = (H.mwK || 0) + ((on ? 1 : 0) - (H.mwK || 0)) * Math.min(1, dt * 14);
  if (H.mwK < 0.01) { if (ud.mwBase) { main.quaternion.copy(ud.mwBase); main.position.copy(ud.mwBaseP); ud.mwBase = null; } H.mwPrev = null; return; } if (!ud.mwBase) { ud.mwBase = main.quaternion.clone(); ud.mwBaseP = main.position.clone(); }
  B.RightHand.updateWorldMatrix(true, false); const hp = B.RightHand.getWorldPosition(new THREE.Vector3()), fp = B.RightForeArm.getWorldPosition(new THREE.Vector3()), d = hp.clone().sub(fp).normalize();
  const v = H.mwPrev ? hp.clone().sub(H.mwPrev) : new THREE.Vector3(); H.mwPrev = hp.clone(); v.addScaledVector(d, -v.dot(d));
  if (H.D.flipEdge) { const base = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d); if (base.lengthSq() > 0.04) { base.normalize(); const vv = H.mwPrevV || 0; if (v.lengthSq() > 0.0009) { const sg = Math.sign(v.dot(base)) || 1; H.edgeSign = H.edgeSign || sg; if (sg !== H.edgeSign && v.length() > 0.05) H.edgeSign = sg; } v.copy(base).multiplyScalar(H.edgeSign || 1); } else if (H.mwEdge) v.copy(H.mwEdge); } /* (the berserker: the axe head leads each cut but never twirls: it may only turn over when the swing truly reverses) */
  if (H.D.steadyEdge) { const sw = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d); v.copy(sw.lengthSq() > 0.04 ? sw : (H.mwEdge || sw)); } /* (the warrior: no spinning in the hand: the edge faces the way a flat right-to-left sweep cuts, steady through wind-up and follow-through) */
  let edge = v.lengthSq() > 1e-8 ? v.normalize() : (H.mwEdge ? H.mwEdge.clone() : new THREE.Vector3(0, 1, 0)); edge.addScaledVector(d, -edge.dot(d)); if (edge.lengthSq() < 1e-6) return; edge.normalize(); H.mwEdge = H.mwEdge ? H.mwEdge.lerp(edge, 0.35).normalize() : edge.clone(); edge = H.mwEdge.clone(); edge.addScaledVector(d, -edge.dot(d)).normalize();
  const Z = new THREE.Vector3().crossVectors(edge, d).normalize(), qW = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(edge, d, Z)); /* (y along the blade or haft, x the edge) */
  main.parent.updateWorldMatrix(true, false); const lq = main.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qW); if (![lq.x, lq.y, lq.z, lq.w].every(Number.isFinite)) return;
  main.quaternion.copy(ud.mwBase).slerp(lq, H.mwK); main.position.copy(ud.mwBaseP).applyQuaternion(main.quaternion.clone().multiply(ud.mwBase.clone().invert())); } /* (turned about the fist: the haft stays in his hands) */
function puppetArms(ch, H, B) { ch.root.updateMatrixWorld(true); H.m.updateMatrixWorld(true); const W = ch.weapons || {}, main = W.main, so = {};
  for (const s of ch.hmSockets) if (s.userData.side && s.userData.fist) so[s.userData.side] = s;
  const lead = main && so.L && main.parent === so.L && !(so.R && main.parent === so.R) ? 'L' : 'R'; /* (the bow is held in the left fist) */
  for (const sd of [lead, lead === 'R' ? 'L' : 'R']) { if (sd !== lead && (H.shMount || H.D.oneHandGun)) continue; if (sd === 'R' && H.D.procSwing && (PS[(ch._st || {}).action] != null || (H.psOn && !(ch._st || {}).action))) continue; /* (the warrior's built swing moves his sword arm itself, from the arm's own pose, and hands it straight back to that pose when he stops) */ /* (the musketeer holds his gun in one hand: the other never reaches for it) */ /* (a shield on the other arm: that hand never reaches over for the sword) */ const s = so[sd], A = ch.arms[sd], nm = sd === 'R' ? 'Right' : 'Left', up = B[nm + 'Arm'], fore = B[nm + 'ForeArm'], hand = B[nm + 'Hand']; if (!s || !A || !A.sh || !up || !fore || !hand) continue; const keep = [up.quaternion.clone(), fore.quaternion.clone(), hand.quaternion.clone()], free = Math.min(1, H.ikA || 0); /* (the owner: at rest, walking, running, strafing and jumping the model's own clips swing its arms and the weapons ride its hands; the arms only follow the built body while he attacks or casts, blended in and out. A two-hander's second hand takes the haft only then) */ hand.updateWorldMatrix(true, false); const cf = hand.getWorldQuaternion(new THREE.Quaternion()).multiply(s.userData.fist.q); /* (the fist as the clip holds it) */
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
    if (ch._bowD) { const D2 = ch._bowD; if (sd === 'L') { tgt.lerp(D2.L, D2.w); if (D2.qL) qf.slerp(D2.qL, D2.w); } else { tgt.lerp(D2.R, D2.w); pole.lerp(D2.poleR, D2.w); } } /* (a bow drawn: the bow arm straight out at the target at shoulder height, the string hand back at the anchor under the chin, elbow up and out) */
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
  const M = H.M, u = ch._u || {}, st = ch._st || {}, nm = (u.atk && u.atk.name) || ch._act || '';
  // whole moves (flying kick, superman punch) start once and play to the end on their own clock
  const trig = u.kickT > 0 ? 'flykick' : u.supermanT > 0 ? 'superman' : null;
  if (trig && M[trig] && (!H.latch || H.latch.key !== trig) && H.trigPrev !== trig) H.latch = { key: trig, t: 0 }; H.trigPrev = trig;
  if (u.strike !== H.stkPrev) { H.stkPrev = u.strike; if (u.strike && M.hkick && /^(kick|round|axe)/.test(u.strike.n || '') && !(H.latch && H.latch.key === 'hkick')) H.latch = { key: 'hkick', t: 0 }; } /* (Thousand Fists: each kick among his blows is his own recorded High Kick, played whole on its own clock) */
  let key = null, k = null;
  { const ft = u._abFireT; if (H.abFT === undefined) H.abFT = ft ?? null; else if (ft != null && ft !== H.abFT) { H.abFT = ft; const mk = H.D.abMoves && H.D.abMoves[u._abFireId]; if (mk && M[mk] && !st.dead) H.latch = { key: mk, t: 0 }; } } /* (an ability goes off: the owner's recording made for it plays through on its own clock, if this class has one) */
  { const hv = u.arenaBot ? (u.hitT || 0) : (u.hurtT || 0); if (hv > (H.hvPrev || 0) + 0.02 && M.hit && !st.dead) H.hitL = M.hit[5] || 0.5; H.hvPrev = hv; if (H.hitL > 0) H.hitL -= dt; if (st.action || u.atk || st.block) H.hitL = 0; } /* (a blow lands on him: the player's hurt clock and a computer fighter's hit clock both jump up as it lands. Never while he attacks, casts or blocks) */
  if (ch.kdLeft > 0 && !st.dead) { ch.kdLeft -= dt; H.kdT = (H.kdT || 0) + dt; key = 'kd'; k = Math.min(1, H.kdT / ((M.kd && M.kd[5]) || 1.15)); if (ch.kdLeft < 1.35 && H.kdT > 0.95 && M.up) { key = 'up'; k = 1 - Math.max(0, ch.kdLeft) / 1.35; } } /* (the last stretch: he pushes himself up off his back and stands) */ else H.kdT = 0; /* (knocked down: thrown back off his feet, then he lies there until the stun wears off) */
  if (!key && st.dead && M.dead) { H.latch = null; H.deadT = (H.deadT || 0) + dt; key = 'dead'; k = H.deadT / (M.dead[2] - M.dead[1]); } else H.deadT = 0; /* (a real fall to the ground, then he lies still) */
  if (!key && ch.cheerT > 0 && M.cheer) { ch.cheerT -= dt; key = 'cheer'; k = 1 - ch.cheerT / 6; } /* (the arena is won: arms up for the crowd) */
  if (key) {} else if (H.latch) { const sl = M[H.latch.key]; H.latch.t += dt; k = H.latch.t / (sl[5] || 0.6); if (k >= 1) H.latch = null; else key = H.latch.key; }
  if (!st.airborne) H.airT = 0;
  if (!key) { if (st.rollKind === 'flip' && st.roll != null) { key = 'flip'; k = Math.min(1, Math.max(0, st.roll)); }
    else if (st.roll != null && M.roll) { const ra = Math.atan2(Math.sin(st.rollDir || 0), Math.cos(st.rollDir || 0)); key = Math.abs(ra) > 2.3 && M.rollB ? 'rollB' : ra > 0.8 && M.rollL ? 'rollL' : ra < -0.8 && M.rollR ? 'rollR' : 'roll'; k = Math.min(1, Math.max(0, st.roll)); } /* (the dodge's own direction picks the clip: forward roll, roll left, spin right, leap back) */ /* (a recorded roll for the dodge, e.g. the warrior's) */
    else if (u.axeThrow && M.athrow) { key = 'athrow'; k = Math.min(1, u.axeThrow.t / u.axeThrow.dur); } /* (the axe throw: wind up and hurl) */
    else if (u.axeCatch && M.acatch) { key = 'acatch'; k = Math.min(1, u.axeCatch.t / u.axeCatch.dur); } /* (it spins back: a hop and a catch) */
    else if (u.shoutT > 0 && M.shoutM) { key = 'shoutM'; k = 1 - u.shoutT / 1.0; } /* (Battle Shout) */
    else if (u.stormT > 0 && M.storm) { key = 'storm'; } /* (Bladestorm: the recorded spin, looping) */
    else if (u.leap && M.leap) { key = 'leap'; k = Math.min(1, Math.max(0, u.leap.t / (u.leap.dur || 0.75))); H.leapHold = 0.3; } else if (H.leapHold > 0 && M.leap && !st.dead) { H.leapHold -= dt; key = 'leap'; k = 1; } /* (he stays down in the slam a moment after landing, then rises) */ /* (Leap Strike: up, over and crashing down as the leap lands) */
    else if (st.charging && M.charge) { key = 'charge'; } /* (a shield charge: the recorded charge loops while he drives forward) */
    else if (st.airborne && M.jump && !st.action) { H.airT = (H.airT || 0) + dt; key = 'jump'; k = Math.min(1, H.airT / 0.85); } /* (a recorded jump while he is in the air) */
    else if (u.strike || /^(fury|area|spin)$/.test(nm)) { key = 'fury'; }
    else if (nm === 'kick') { key = 'kick'; k = st.actionT; }
    else if (H.D.moveFor && st.actionT != null && (PUNCH.test(nm) || H.D.moveFor[nm])) { key = (u.atk && u.atk.name === nm && u.atk.mv && M[u.atk.mv]) ? u.atk.mv : (H.D.moveFor[nm] || null); /* (any attack this class maps, the casters' cast and the necromancer's reap too; a combo step can name its own recorded blow) */ k = H.D.recGrip && u.atk && u.atk.name === nm && u.atk.t != null ? Math.min(1, u.atk.t) : st.actionT; } /* (recGrip: the blow's own clock, read live: the action clock the built body last set is a frame old, which showed the first frame of every blow twice, a hitch at each join of the held combo) */
    else if (PUNCH.test(nm) && st.actionT != null) { k = st.actionT; const fresh = H.pK == null || k < H.pK - 0.25 || !H.inPunch; if (fresh) { H.combo = H.t - (H.lpT || -9) > 1.3 ? 0 : ((H.combo == null ? -1 : H.combo) + 1) % (H.D.combo || [0]).length; } H.lpT = H.t; H.inPunch = true; key = u.atk && u.atk.name === nm && u.atk.mv && M[u.atk.mv] ? u.atk.mv : H.D.combo ? H.D.combo[H.combo] : LEFTP.test(nm) ? 'jab' : 'cross'; /* (atk.mv: the game names the blow, so its length and the moment its hit lands are the recording's own) */ if (nm === 'smash' && H.D.finisher) { if (fresh) H.fin = ((H.fin || 0) + 1) % H.D.finisher.length; key = H.D.finisher[H.fin || 0]; } } } // (the combo's last, heavy blow is an uppercut or a lunging roundhouse) // (each new swing plays the next move of the combo: jab, cross, uppercut, spin kick...)
  if (!key && H.hitL > 0 && M.hit && !st.airborne) { key = 'hit'; k = 1 - H.hitL / (M.hit[5] || 0.5); } else if (key) H.hitL = 0; /* (the flinch: anything else he does cuts it short) */
  if (!(PUNCH.test(nm) && st.actionT != null) || H.latch) H.inPunch = false; H.pK = st.actionT;
  if (!key || !M[key]) { H.mvKey = null; return null; }
  const sl = M[key]; if (key !== H.mvKey) { H.xf = H.mvKey && H.lastMove && H.lastMove.basic && BASIC_MOVES[key] === sl && H.lastMove.slice[0] !== sl[0] ? { ck: H.lastMove.slice[0], t: H.lastMove.t, k: 0 } : null; /* (one basic move straight into another (the fall into the get-up, a flinch into a roll): the last pose fades into the new move instead of jumping) */ H.mvKey = key; H.mvT = 0; if (k != null && k > 0.5 && !sl[6]) k = 0; } H.mvT += dt; /* (a new blow starts at its own beginning: on its first frame the action clock can still read the last blow's end, which threw the hand a metre for one frame) */
  let t; if (sl[6]) { const span = sl[2] - sl[1]; t = sl[1] + ((H.mvT * 1.6) % span); }
  else if (sl[8]) { k = Math.min(1, Math.max(0, k || 0)); const M2 = sl[8]; let i = 0; while (i < M2.length - 2 && M2[i + 1][0] <= k) i++; const a = M2[i], b = M2[i + 1]; t = a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, (k - a[0]) / Math.max(1e-6, b[0] - a[0]))); } /* (a time map: the recording played faster or slower part by part) */
  else { k = Math.min(1, Math.max(0, k || 0)); const hk = sl[7] || 0.3; t = sl[3] ? (k < hk ? sl[1] + (sl[3] - sl[1]) * (k / hk) : sl[3] + (sl[2] - sl[3]) * ((k - hk) / (1 - hk))) : sl[1] + (sl[2] - sl[1]) * k; } // (the blow lands 30% of the way into the attack, when the game's hit does)
  H.lastMove = { slice: sl, t, full: !!sl[4], basic: BASIC_MOVES[key] === sl }; return key;
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
// How a hero's own walk, run and back clips step, measured on his skeleton the first time he moves (kept on the clip: once per class).
//  u: how fast the ground has to pass under him, in his own heights a second at clip rate 1, for his planted foot to stay put: the speed
//     that leaves the planted foot (the lower foot, weighted by how near the ground it is) the least slide over the whole loop.
//     The clip then plays at rate = speed / (u * height), so a big hero, whose stride is long, steps slowly and a small one quickly.
//  cw: how firmly a foot is down at each of the N moments of the loop (1 down, 0 both feet clearly off the ground; spread a moment either way)
//  wk: with a foot down, the rate that holds that foot still at that moment, as a share of the steady rate (a clip's foot does not pass
//      under him at one even speed); air: the part of the loop with both feet off the ground; steps: steps in one loop
function gaitOf(H, ck) {
  const A = H.act[ck]; if (!A) return null; const clip = A.getClip(), ud = clip.userData || (clip.userData = {}); if (ud.gait !== undefined) return ud.gait; ud.gait = null;
  try { ud.gait = measureGait(H, A, ck === 'back' ? -1 : 1); } catch (e) { ud.gait = null; }
  return ud.gait;
}
function measureGait(H, A, sgn) {
  const B = H.bones, F = [['LeftFoot', 'LeftToeBase'], ['RightFoot', 'RightToeBase']].map(f => f.filter(n => B[n])); if (!F[0].length || !F[1].length || !H.m.parent) return null;
  const N = 48, dur = A.getClip().duration, hh = H.D.height * HERO_SIZE, par = H.m.parent, v = new THREE.Vector3(), fw = new THREE.Vector3(0, 0, 1).applyQuaternion(H.m.quaternion).setY(0).normalize(), sd = new THREE.Vector3(fw.z, 0, -fw.x);
  const keep = {}, bind = () => { for (const k in H.bind) { const b = B[k]; b.quaternion.copy(H.bind[k][0]); b.position.copy(H.bind[k][1]); } }; for (const k in H.act) keep[k] = [H.act[k].time, H.act[k].getEffectiveWeight()];
  const P = []; /* (P[sample][foot][point] = [forward, up, side] in metres, standing still) */
  for (let i = 0; i < N; i++) { bind(); for (const k in H.act) H.act[k].setEffectiveWeight(H.act[k] === A ? 1 : 0); A.time = dur * i / N; forceMix(H.mixer); H.mixer.update(0); H.m.updateMatrixWorld(true);
    P.push(F.map(f => f.map(n => { par.worldToLocal(B[n].getWorldPosition(v)); return [v.dot(fw), v.y, v.dot(sd)]; }))); }
  for (const k in H.act) { H.act[k].time = keep[k][0]; H.act[k].setEffectiveWeight(keep[k][1]); } bind();
  const Hc = 0.02 * hh, c0 = F.map((f, a) => f.map((_, b) => Math.min(...P.map(p => p[a][b][1])))); /* (each point's contact level: the lowest it gets; near the ground = within 2% of his height) */
  const low = (i, a) => Math.min(...F[a].map((_, b) => P[i][a][b][1] - c0[a][b])), S = [], W = new Array(N).fill(0); let air = 0;
  for (let i = 0; i < N; i++) { const l0 = low(i, 0), l1 = low(i, 1), a = l0 <= l1 ? 0 : 1, lo = Math.min(l0, l1), w = Math.max(0, Math.min(1, 2 - Math.pow(2, lo / Hc))); if (lo > Hc) air++; W[i] = w;
    if (w > 0) { const j = (i + 1) % N, d = dur / N; S.push([w, F[a].map((_, b) => [(P[j][a][b][2] - P[i][a][b][2]) / d, (P[j][a][b][0] - P[i][a][b][0]) / d]), i]); } }
  /* (slide at ground speed u, as a share of his speed: the slower of the planted foot's ankle and ball, the point the foot rolls over) */
  const slide = (u) => { let s = 0, ws = 0; for (const [w, d] of S) { let m = Infinity; for (const [x, y] of d) m = Math.min(m, Math.hypot(x / u, 1 + y / u)); s += w * m; ws += w; } return ws ? s / ws : 1; };
  let u = 0, best = Infinity; for (let k = 4; k <= 160; k++) { const t = sgn * k * 0.04 * hh, s = slide(t); if (s < best) { best = s; u = t; } }
  const u0 = u; for (let k = -10; k <= 10; k++) { const t = u0 + sgn * k * 0.004 * hh, s = slide(t); if (s < best) { best = s; u = t; } }
  let steps = 0, last = -1; for (let i = 0; i < 2 * N; i++) { const j = i % N, l0 = low(j, 0), l1 = low(j, 1); if (Math.abs(l0 - l1) < 0.01 * hh) continue; const a = l0 < l1 ? 0 : 1; if (i >= N && last >= 0 && a !== last) steps++; last = a; } /* (a step: the other foot clearly lower; both feet down together is no step) */
  const kr = new Array(N).fill(1); for (const [, d, i] of S) { let bs = Infinity; for (let m = 0.6; m < 1.7001; m += 0.05) { let s = Infinity; for (const [x, y] of d) s = Math.min(s, Math.hypot(x / (u * m), 1 + y / (u * m))); if (s < bs) { bs = s; kr[i] = 1 / m; } } } /* (the ground passing m times as fast: the rate 1 / m times) */
  const wk = kr.map((_, i) => { let s = 0.05, ws = 0.05; for (let j = -2; j <= 2; j++) { const q = (i + j + N) % N; s += W[q] * kr[q]; ws += W[q]; } return s / ws; }), cw = W.map((w, i) => Math.max(W[(i + N - 1) % N], w, W[(i + 1) % N])); /* (smoothed, so the clip never lurches) */
  return { u: Math.abs(u) / hh, air: air / N, steps: Math.max(2, steps), slide: best, cw, wk };
}
// how many steps a second a runner of height hh takes at speed v: a 1.8 m runner 2.6 at 3 m/s, 3.0 at 6 and 3.6 at 9 (long, easy game strides,
// not a frantic real sprint: the owner found 5 a second far too fast). A hero of another size runs the same way at the same Froude number
// (v^2 / g h), so his speed and his step rate both scale with the square root of his height
const natSteps = (v, hh) => { const s = Math.sqrt(1.8 / hh), vh = v * s; return Math.max(2.4, vh < 6 ? 2.6 + 0.133 * (vh - 3) : 3.0 + 0.2 * (vh - 6)) * s; };
export function tickHeroModel(ch, dt) {
  const H = ch && ch.heroModel; if (!H || H === 'loading' || dt <= 0) return;
  try { wearShield(ch, H); } catch (e) { /* (keeps the hand-held shield if anything is missing) */ }
  if (H.D.bowScale) { const bw = ch.weapons && ch.weapons.main, wd = H.D.bowWide || 1; if (bw && bw.name === 'weapon_bow' && bw.userData.hmScale !== H.D.bowScale) { bw.scale.multiplyScalar(H.D.bowScale / (bw.userData.hmScale || 1)); bw.scale.x *= wd / (bw.userData.hmWide || 1); bw.userData.hmScale = H.D.bowScale; bw.userData.hmWide = wd; } } /* (a class's own bow size on the model, about the grip in its fist; bowWide: broader limbs, so it reads as a bow from behind, not a stick) */
  const p = ch.root.position, dx = p.x - H.lp.x, dz = p.z - H.lp.z, sp = Math.hypot(dx, dz) / dt; H.lp.copy(p); H.v += (Math.min(sp, 12) - H.v) * Math.min(1, dt * 8);
  // which way he is moving compared with where he faces: forward 0, right +90°, back 180°
  if (sp > 0.4) { const fw = new THREE.Vector3(0, 0, 1).applyQuaternion(ch.root.getWorldQuaternion(new THREE.Quaternion())), a = Math.atan2(dx * fw.z - dz * fw.x, dx * fw.x + dz * fw.z); H.mvA = a; }
  const A = sp > 0.4 ? (H.mvA || 0) : 0, back = Math.abs(A) > 1.95; H.backK = (H.backK || 0) + ((back && H.v > 0.25 ? 1 : 0) - (H.backK || 0)) * Math.min(1, dt * 10);
  let legT = back ? A - Math.sign(A) * Math.PI : A; legT = Math.max(-1.15, Math.min(1.15, legT)) * (H.v > 0.25 ? 1 : 0); H.legYaw = (H.legYaw || 0) + (legT - (H.legYaw || 0)) * Math.min(1, dt * 9);
  const hh = H.D.height * HERO_SIZE, vWR = Math.sqrt(0.25 * 9.8 * hh); /* (he breaks from a walk into a run where people do, at Froude number 0.25 by height (about 2.1 m/s for a 1.8 m man): a giant walks faster before he runs, a goblin runs sooner) */
  const walkW = H.v < 0.25 ? 0 : (back || H.v < vWR * 0.8) ? 1 : Math.max(0, 1 - (H.v - vWR * 0.8) / (vWR * 0.45)), runW = back || H.v < vWR * 0.8 ? 0 : 1 - walkW, /* (backing up is always a walk, never a run) */ idleW = 1 - Math.min(1, H.v / 0.25);
  const lerpW = (k, t) => { H.w[k] += (t - H.w[k]) * Math.min(1, dt * 10); };
  // heavy heroes run heavy: part of the run is the walk (synced to the same stride), so the feet stay closer to the ground
  // and the legs don't splay into a bounding leap; their hips bob less (below). A light hero keeps the full run
  const heavy = H.D.runRate ? 0 : Math.max(0, Math.min(1, (H.D.height * HERO_SIZE - 4.6) / 1.4)), hv = H.act.walk && H.act.run ? runW * 0.75 * heavy : 0; H.heavy = heavy;
  lerpW('walk', (walkW + hv) * (1 - idleW)); lerpW('run', (runW - hv) * (1 - idleW)); lerpW('idle', idleW);
  // clip rates: his planted foot stays put. Each clip plays at the rate that holds the planted foot still on the ground, from its own stride
  // measured on his skeleton (gaitOf): speed / (u * height). The walk and run blend into one stride while he changes gait, kept in step
  const gw = gaitOf(H, 'walk'), gr = gaitOf(H, 'run'), wc = H.act.walk ? H.act.walk.getClip().duration : 1, rc = H.act.run ? H.act.run.getClip().duration : 1;
  const Sw = (gw ? gw.u : 0.75) * hh * wc, Sr = (gr ? gr.u : 2.5) * hh * rc, wr = !H.act.run ? 0 : !H.act.walk ? 1 : H.w.run / Math.max(1e-3, H.w.run + H.w.walk), lps = H.v / (Sw + (Sr - Sw) * wr); /* (metres of ground in one loop of each clip; loops a second) */
  if (H.act.walk) { H.act.walk.setEffectiveWeight(H.w.walk); H.act.walk.timeScale = Math.max(0.3, lps * wc); }
  if (H.act.run) { H.act.run.setEffectiveWeight(H.w.run); let ts = Math.max(0.3, lps * rc);
    // running, his stride lengthens the way a real runner's does: with a foot on the ground the clip plays at the rate that holds that foot
    // still (following it through the step: wk), and the time in the air between steps stretches, so he takes his steps at the rate a runner
    // his size takes them at that speed (natSteps), never more than 4 loops (8 steps) a second: a big hero long, slow strides, a goblin quick ones
    const C = gr && gr.cw, K = gr && gr.wk, wr2 = wr * wr;
    if (C && K && !back && wr2 > 1e-3) { const N = C.length, R = ts / (Math.min(4, natSteps(H.v, hh) / gr.steps) * rc); /* (how many times longer than at the steady foot-held rate one loop should take) */
      const per = (x) => { let q = 0; for (let i = 0; i < N; i++) q += 1 / (x + (K[i] - x) * C[i]); return q / N; }; /* (one loop's time, in loops at the steady rate, with the clip at x times that rate while both feet are off the ground) */
      let x = 1; if (per(1) < R) { let a = 0.1, b = 1; if (per(a) <= R) x = a; else { for (let it = 0; it < 16; it++) { const m = (a + b) / 2; if (per(m) > R) a = m; else b = m; } x = b; } } /* (in the air the clip slows to as little as a tenth of the foot-held rate; with a foot down it keeps that rate, so the foot stays put) */
      let tau = H.act.run.time; const n = Math.min(16, Math.ceil(dt * ts * 32 / rc)), h = dt / n;
      for (let i = 0; i < n; i++) { const f = ((tau / rc) % 1 + 1) % 1 * N, i0 = Math.floor(f) % N, i1 = (i0 + 1) % N, e = f - Math.floor(f), c = C[i0] + (C[i1] - C[i0]) * e, k = K[i0] + (K[i1] - K[i0]) * e; tau += h * ts * (1 + (x + (k - x) * c - 1) * wr2); }
      ts = (tau - H.act.run.time) / dt; } /* (the rate followed through the frame in small steps, so a quick little hero's fast loop is not jumbled; while the walk blends in, the run plays steadily) */
    H.act.run.timeScale = ts; }
  // backing up: the same foot-held rate, but never more steps a second than a hero his size can take backwards (3.4 for a 1.8 m man; past that his feet slide)
  const backMax = (g, c) => 3.4 * Math.sqrt(1.8 / hh) / (g ? g.steps : 2) * c;
  if (H.act.back) { const gb = gaitOf(H, 'back'), bc = H.act.back.getClip().duration, bw = H.backK * (H.w.walk + H.w.run); H.act.back.paused = false; H.act.back.setEffectiveWeight(bw); H.act.back.timeScale = Math.min(backMax(gb, bc), Math.max(0.3, H.v / ((gb ? gb.u : 0.75) * hh))); if (H.act.walk) H.act.walk.setEffectiveWeight(H.w.walk * (1 - H.backK)); if (H.act.run) H.act.run.setEffectiveWeight(H.w.run * (1 - H.backK)); }
  else if (H.backK > 0.5 && H.act.walk) { H.act.walk.timeScale = -Math.min(backMax(gw, wc), Math.abs(H.act.walk.timeScale)); if (H.act.run) H.act.run.timeScale = -Math.abs(H.act.run.timeScale); } // (no backwards clip: the walk plays in reverse)
  if (H.act.walk && H.act.run && H.w.walk > 0.02 && H.w.run > 0.02) { const wc = H.act.walk.getClip().duration, rc = H.act.run.getClip().duration; H.act.walk.time = (H.act.run.time / rc) * wc; } // (walk and run kept in step while blending, so the legs never fight each other)
  const reset = () => { for (const k in H.bind) { const b = H.bones[k]; b.quaternion.copy(H.bind[k][0]); b.position.copy(H.bind[k][1]); b.scale.set(1, 1, 1); } }; // (start every frame from the rest pose, so nothing builds up frame after frame: no spinning)
  reset(); const mvK = pickMove(H, ch, dt); { const mir = mvK === 'rollR' && !!(H.D.moves && H.D.moves.rollR && H.D.moves.rollR[0] === 'rollL'); if (mir !== !!H.mirrored) { H.mirrored = mir; H.wrap.scale.x = (mir ? -1 : 1) * Math.abs(H.wrap.scale.x || 1); } } /* (a mirrored clip: the whole model flips left to right while it plays) */ for (const k in H.act) if (k !== 'walk' && k !== 'run' && k !== 'back') H.act[k].setEffectiveWeight(0);
  const stA = H.D.idleClip && H.act[H.D.idleClip]; if (stA) { if (H.D.idleHold != null) { stA.paused = true; stA.time = H.D.idleHold; } else stA.paused = false; stA.setEffectiveWeight(H.w.idle); } /* (idleHold: stand still in one frame of the stance instead of looping it) */ /* (standing still: his own recorded fighting stance, looping) */
  forceMix(H.mixer); H.mixer.update(dt); H.t += dt; const B = H.bones;
  if (B.Hips && H.heavy > 0) { const hy = B.Hips.position.y; H.hipAvg = H.hipAvg == null ? hy : H.hipAvg + (hy - H.hipAvg) * Math.min(1, dt * 2.5); B.Hips.position.y = H.hipAvg + (hy - H.hipAvg) * (1 - 0.7 * H.heavy * Math.min(1, H.w.run + H.w.walk)); } /* (a heavy hero's hips barely rise and fall: weight, not bounce) */
  const recMv = !!(mvK && H.D.recLegs && H.D.recLegs.includes(mvK)); H.mw = (H.mw || 0) + ((mvK ? 1 : 0) - (H.mw || 0)) * Math.min(1, dt * (mvK ? (recMv ? 20 : H.D.mwIn || 30) : 9)); /* (the berserker's combo eases in from his stance over a few frames) */ /* (mwIn: a class that eases into its recorded swings instead of snapping) */ // (snaps into an attack, eases back out of it)
  if (H.mw > 0.01 && H.lastMove) { const [ck, a, b2] = H.lastMove.slice; const A = H.act[ck];
    if (A) { const legs = {}; const moving = Math.max(Math.min(1, H.v / 1.5), H.D.keepLegs && !recMv && PUNCH.test(ch._act || '') ? 0.85 : 0) * (H.lastMove.full ? 0 : 1); /* (recLegs: standing, the combo's own legs carry his step; walking, the walk takes them back) */ /* (keepLegs: the recording swings the arms and body; his feet stay planted in his own stance) */ for (const k of LEG_BONES) if (B[k]) legs[k] = B[k].quaternion.clone(); const hipP = B.Hips ? B.Hips.position.clone() : null;
      const xf = H.xf, X = xf && H.act[xf.ck], xk = X ? xf.k * xf.k * (3 - 2 * xf.k) : 1; if (xf) { H.xf.k += dt / 0.25; if (H.xf.k >= 1) H.xf = null; }
      reset(); for (const k in H.act) H.act[k].setEffectiveWeight(k === ck ? H.mw * xk : X && k === xf.ck ? H.mw * (1 - xk) : k === 'walk' ? H.w.walk * (1 - H.mw) * (1 - (H.act.back ? H.backK : 0)) : k === 'run' ? H.w.run * (1 - H.mw) * (1 - (H.act.back ? H.backK : 0)) : k === 'back' ? (H.w.walk + H.w.run) * H.backK * (1 - H.mw) : k === H.D.idleClip ? H.w.idle * (1 - H.mw) : 0); A.time = H.lastMove.t; if (X) X.time = xf.t; forceMix(H.mixer); H.mixer.update(0);
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
  H.wrap.position.copy(ch.body.position); { const want = H.lastMove && H.lastMove.full ? Math.min(1, H.mw * 1.4) : 0; H.fullK = (H.fullK || 0) + (want - (H.fullK || 0)) * Math.min(1, dt * 14); const fk = H.fullK; H.wrap.quaternion.copy(ch.body.quaternion).slerp(_IDQ, fk); H.wrap.position.y += (0 - H.wrap.position.y) * fk; if (H.lastMove && H.lastMove.basic) { H.wrap.position.x *= 1 - fk; H.wrap.position.z *= 1 - fk; } } /* (a basic move: the built roll's swing about its pivot fades out too, so he rolls where he stands) */ /* (a recorded roll or flip moves the body itself: the built body's own tumble fades out smoothly instead of snapping) */ H.wrap.updateMatrixWorld(true); // (a recorded flip or jump kick moves the whole body itself: the built body's own flip is not added on top)
  const gunHold = !!(ch.wt && /musket|blunderbuss/.test(ch.wt)) && !H.D.oneHandGun, act = !!((ch._act && /^(swing|stab|slash|chop|smash|heavy|cast|shoot|thrust|reap|jab|off|charge|bash|shieldbash|throw|lunge|sweep|spin|strike|cleave|slam|uppercut|hook|punch|kick|lowcut)/.test(ch._act)) || ch._strike || gunHold), /* (only a real attack or cast hands the arms to the built body: running, sprinting and standing never do) */ /* (a gun is always held in both hands: the model's hands stay on the stock and fore-end) */ /* (holding a staff out to aim is not an attack: the model's arms stay natural) */ kicking = !!(ch._u && ch._u.kickT > 0) || ch._act === 'kick', kickL = kicking && ch.legs && (ch.legs.L.thigh.rotation.x < -0.75), kickR = kicking && ch.legs && (ch.legs.R.thigh.rotation.x < -0.75); /* (only a real kick moves the model's legs: a long running stride must not) */
  H.ikA = (H.ikA || 0) + ((act && !mvK ? 1 : 0) - (H.ikA || 0)) * Math.min(1, dt * 14); // (a recorded move drives the arms itself)
  // the body swings with the blow: the chest winds back, then turns (or bends) through the strike, so the arms and the torso move together
  { const st2 = ch._st || {}, nm2 = ch._act || '', kT = st2.actionT; let tw = 0, bend = 0;
    if (act && !mvK && !H.D.axeSwing && kT != null && /^(swing|slash|chop|smash|heavy|cleave|sweep|lowcut|stab|thrust|reap|charge|bash|lunge|strike|slam|off)/.test(nm2) && !(H.D.procSwing && PS[nm2] != null)) { /* (the warrior's built swing turns his chest itself) */
      const kd2 = arcKind(nm2, ch.weapons && ch.weapons.main, B), k = kd2 ? arcClock(ch, H, nm2, kT, kd2) : Math.max(0, Math.min(1, kT)), sm = (x) => x * x * (3 - 2 * x), wind = k < 0.3 ? sm(k / 0.3) : 1, /* (on the swing's bent clock, so the chest turns through the blow with the arms) */ thru = k < 0.3 ? 0 : k < 0.72 ? sm((k - 0.3) / 0.42) : 1, back = k < 0.72 ? 1 : 1 - sm((k - 0.72) / 0.28);
      const side = /^(swing2|off|backhand)/.test(nm2) ? -1 : 1;
      if (/^(swing3|smash|heavy|chop|slam|cleave)/.test(nm2)) { tw = (-0.32 * wind + 0.5 * thru) * back; bend = (-0.12 * wind + 0.42 * thru) * back; } /* (overhead: coil and lean back, then fold forward into the chop) */
      else if (/^(stab|thrust|lunge|charge|bash)/.test(nm2)) { tw = (-0.35 * wind + 0.7 * thru) * back; bend = 0.16 * thru * back; } /* (a stab: the right shoulder drives forward) */
      else { tw = side * (-0.55 * wind + 1.15 * thru) * back; bend = 0.08 * thru * back; } /* (a side cut: wind the chest back, then turn it right through the swing) */ }
    H.twS = (H.twS || 0) + (tw - (H.twS || 0)) * Math.min(1, dt * 18); H.bdS = (H.bdS || 0) + (bend - (H.bdS || 0)) * Math.min(1, dt * 18);
    if (Math.abs(H.twS) > 0.005 || Math.abs(H.bdS) > 0.005) { const wqq = H.wrap.getWorldQuaternion(new THREE.Quaternion()), upA = new THREE.Vector3(0, 1, 0), rtA = new THREE.Vector3(1, 0, 0).applyQuaternion(wqq);
      for (const [nmB, f] of [['Spine', 0.35], ['Spine01', 0.35], ['Spine02', 0.3]]) { const bb = B[nmB]; if (!bb) continue; turnFoot(bb, upA, H.twS * f); turnFoot(bb, rtA, H.bdS * f); } H.m.updateMatrixWorld(true); } }
  try { meleeArc(ch, H, B, act, mvK); } catch (e) { ch._arc = null; }
  try { bowDraw(ch, H, B, act, dt); } catch (e) { ch._bowD = null; }
  if (ch.hmSockets && ch.arms && (H.ikA || 0) > 0.02) puppetArms(ch, H, B); /* (the owner: no hands pulled to the middle of the body, ever: outside attacks the model's own clips drive the arms and the weapon simply rides the fist) */ /* (holding something: the model's arms and fists follow the built body's all the time, and the weapon is fixed in the fist) */
  else if (H.ikA > 0.02 && ch.arms) for (const [sd, nm, sx] of [['R', 'Right', -1], ['L', 'Left', 1]]) { const hp = ch.arms[sd].hand; if (!hp) continue; const t = hp.getWorldPosition(new THREE.Vector3()), sh = B[nm + 'Arm']; if (!sh) continue; const s0 = sh.getWorldPosition(new THREE.Vector3()), wq = H.m.getWorldQuaternion(new THREE.Quaternion());
    const pole = s0.clone().add(new THREE.Vector3(sx * 0.4, -0.6, -0.35).applyQuaternion(wq)); const keep = [B[nm + 'Arm'].quaternion.clone(), B[nm + 'ForeArm'].quaternion.clone()]; ikArm(null, B[nm + 'Arm'], B[nm + 'ForeArm'], B[nm + 'Hand'], s0.clone().lerp(t, 1), pole);
    if (H.ikA < 0.99) { B[nm + 'Arm'].quaternion.copy(keep[0].slerp(B[nm + 'Arm'].quaternion.clone(), H.ikA)); B[nm + 'ForeArm'].quaternion.copy(keep[1].slerp(B[nm + 'ForeArm'].quaternion.clone(), H.ikA)); } }
  /* (guns too: puppetArms keeps both hands on the stock and fore-end the way the built body holds it) */
  if (H.D.reachClip && ch._bowD && ch._bowD.post != null) try { reachBack(ch, H, B); } catch (e) { /* (leave the drawing arm on its built path) */ }
  try { bowString(ch, B); } catch (e) { /* (leave the string straight) */ }
  if (H.D.procSwing) try { procSwing(ch, H, B, dt, mvK); } catch (e) { H.psOn = false; const m0 = ch.weapons && ch.weapons.main; if (m0) m0.userData.psHold = false; }
  if (H.D.axeSwing) try { axeSwing(ch, H, B, dt); } catch (e) { H.psOn = false; }
  if (H.D.recFix) try { recFix(ch, H, B, mvK); } catch (e) { /* (leave the recording as it is) */ }
  try { moveWeapon(ch, H, B, mvK, dt); } catch (e) { /* (leave the weapon as the fist holds it) */ }
  if (H.D.twoHand) try { twoHandGrip(ch, H, B, mvK, dt); } catch (e) { /* (keep one hand) */ }
  if (ch.legs && !mvK) for (const [sd, nm, on] of [['R', 'Right', kickR], ['L', 'Left', kickL]]) { if (!on) continue; const t = ch.legs[sd].ankle.getWorldPosition(new THREE.Vector3()), hip = B[nm + 'UpLeg']; if (!hip) continue; const h0 = hip.getWorldPosition(new THREE.Vector3()), wq = H.m.getWorldQuaternion(new THREE.Quaternion());
    ikArm(null, B[nm + 'UpLeg'], B[nm + 'Leg'], B[nm + 'Foot'], t, h0.clone().add(new THREE.Vector3(0, 0.3, 0.8).applyQuaternion(wq))); } // (kicks: the model's leg goes where the built leg kicks)
  { const fwH = new THREE.Vector3(0, 0, 1).applyQuaternion(H.wrap.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize(), UP = new THREE.Vector3(0, 1, 0), rest = 1 - Math.min(1, H.ikA || 0);
    for (const sp of [ch.weapons && ch.weapons.main, ch.weapons && ch.weapons.off]) { if (!sp || !sp.parent) continue;
      const want = sp.name === 'weapon_spear' ? fwH.clone().addScaledVector(UP, 0.35) : sp.name === 'weapon_musket' && H.D.oneHandGun ? fwH.clone().add(UP) : sp.name === 'weapon_dagger' && sp.userData.restTilt != null ? fwH.clone().addScaledVector(UP, 0.3) : sp.name === 'weapon_bow' ? UP.clone() : null; if (!want) continue; want.normalize(); /* (at rest: the shaman's spear points forward, the musketeer's gun stands up at his side, the rogue's blades stand up and forward out of her fists) */
      const ud = sp.userData; if (!ud.baseQ) { ud.baseQ = sp.quaternion.clone(); ud.baseP = sp.position.clone(); } sp.quaternion.copy(ud.baseQ); sp.position.copy(ud.baseP); if (rest < 0.01) continue;
      sp.parent.updateWorldMatrix(true, false); const pq = sp.parent.getWorldQuaternion(new THREE.Quaternion()), wq0 = pq.clone().multiply(ud.baseQ), cy = new THREE.Vector3(0, 1, 0).applyQuaternion(wq0);
      const wq1 = new THREE.Quaternion().setFromUnitVectors(cy, want).multiply(wq0); if (sp.name === 'weapon_bow') { const z1 = new THREE.Vector3(0, 0, 1).applyQuaternion(wq1).setY(0), out = new THREE.Vector3().crossVectors(UP, fwH).multiplyScalar(sp.parent.userData.side === 'R' ? -1 : 1).addScaledVector(fwH, -0.25).normalize(); if (z1.lengthSq() > 1e-4) wq1.premultiply(new THREE.Quaternion().setFromUnitVectors(z1.normalize(), out)); } /* (the bow upright, riser in the fist, its string out to his side (a touch behind): from the camera behind him the whole bow shows beside his leg, not just its edge) */ else if (sp.name === 'weapon_musket') { const z1 = new THREE.Vector3(0, 0, 1).applyQuaternion(wq1); z1.addScaledVector(want, -z1.dot(want)); const tz = UP.clone().addScaledVector(want, -UP.dot(want)); if (z1.lengthSq() > 1e-6 && tz.lengthSq() > 1e-6) wq1.premultiply(new THREE.Quaternion().setFromUnitVectors(z1.normalize(), tz.normalize())); } /* (the musket's sights up, trigger down) */ const lq = pq.invert().multiply(wq1); if (![lq.x, lq.y, lq.z, lq.w].every(Number.isFinite)) continue;
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
// the warrior's two-swing combo, built rather than recorded, sword first. The sword's path is one closed loop through
// both swings, so held attacks flow from one into the other with no seam: swing 1 lifts on his right and cuts across his
// front down to his left; swing 2 lifts on his left and cuts back across his front down to his right. The sword is laid
// along the path with one steady flat (it is double-edged: one edge leads each way, so it never rolls over). He holds it
// in a sword grip (the hilt angled across his fist, not straight across it like a hammer) that never changes while he
// swings; his forearm follows the sword, the wrist bent no further than a wrist goes and the elbow swung round to keep it
// easy, the arm reaches the hilt (two-bone IK) and the chest turns into each cut. Keys: [time in the loop (swing 1 is 0..1, swing 2 is 1..2), where the hilt would like to be
// [forward, right, up] in metres from his hips (for a 0.61 m arm, scaled to his own; the arm takes it as near as it
// reaches), blade [bearing (+ to his right), rise] in degrees, chest turn (radians, + to his left), pace through the key
// (below 1 slows there, above 1 quickens)]
export const WSW = { keys: [
  [0.00, [0.46, 0.45, 0.22], [60, -15], -0.2, 0.8], /* (low on his right: where swing 2 ends and swing 1 begins) */
  [0.30, [0.36, 0.55, 0.55], [50, 35], -0.3, 0.4], /* (swing 1 raised on his right) */
  [0.62, [0.68, 0.05, 0.42], [0, 5], 0.35, 1.2], /* (across his front: the blow lands) */
  [1.00, [0.60, -0.15, 0.38], [-55, -15], 0.55, 0.8], /* (low on his left: swing 1 ends, swing 2 begins) */
  [1.30, [0.60, -0.12, 0.56], [-50, 30], 0.5, 0.4], /* (swing 2 raised on his left) */
  [1.62, [0.68, 0.10, 0.42], [0, 5], 0.3, 1.2] ], /* (back across his front) */
  arm: 0.61, grip: 45, wrist: 30, spine: [['Spine02', 0.3], ['Spine01', 0.35], ['Spine', 0.35]], ease: 0.2, blendIn: 0.24, blendOut: 0.3 };
const PS = { swing1: 0, swing2: 1 };
// a point on the loop: [hilt forward, right, up, bearing, rise, chest turn], a smooth curve through the keys (Hermite)
function wsAt(phi, out) { const K = WSW.keys, n = K.length; phi = ((phi % 2) + 2) % 2; let i = n - 1; for (let j = 0; j < n; j++) if (K[j][0] <= phi) i = j;
  const at = (j) => { const jj = ((j % n) + n) % n; return [K[jj][0] + Math.floor(j / n) * 2, K[jj]]; }, val = (k) => [k[1][0], k[1][1], k[1][2], k[2][0], k[2][1], k[3]];
  const [ta, A] = at(i - 1), [tb, Bk] = at(i), [tc, C] = at(i + 1), [td, D] = at(i + 2), va = val(A), vb = val(Bk), vc = val(C), vd = val(D), dt = tc - tb, s = (phi - tb) / dt, s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  for (let q = 0; q < 6; q++) { const mb = (vc[q] - va[q]) / (tc - ta) * Bk[4], mc = (vd[q] - vb[q]) / (td - tb) * C[4]; out[q] = h00 * vb[q] + h10 * dt * mb + h01 * vc[q] + h11 * dt * mc; } return out; }
const _wUp = new THREE.Vector3(0, 1, 0), _wX = new THREE.Vector3(), _wY = new THREE.Vector3(), _wZ = new THREE.Vector3(), _wM = new THREE.Matrix4(), _wS = [0, 0, 0, 0, 0, 0], _wGz = new THREE.Vector3(0, 0, 1);
function procSwing(ch, H, B, dt, mvK) { const st = ch._st || {}, off = PS[st.action], live = off != null && st.actionT != null && !st.dead && st.roll == null && !mvK;
  const main = ch.weapons && ch.weapons.main, sock = main && main.parent, RA = B.RightArm, RF = B.RightForeArm, RH = B.RightHand;
  if (!main || !sock || sock.parent !== RH || !RA || !RF || !RH || !B.Hips || !H.bind.RightHand) { H.psOn = false; return; }
  if (live !== !!H.psIn) { const k0 = H.psK || 0; H.psL = live ? 1 - Math.sqrt(Math.max(0, 1 - k0)) : 0.5 - Math.sin(Math.asin(Math.max(-1, Math.min(1, 1 - 2 * k0))) / 3); H.psIn = live; } /* (turning round mid-way carries on from the same blend) */
  H.psL = Math.max(0, Math.min(1, (H.psL || 0) + (live ? dt / WSW.blendIn : -dt / (mvK ? 0.15 : WSW.blendOut)))); const k = H.psK = live ? 1 - (1 - H.psL) * (1 - H.psL) : H.psL * H.psL * (3 - 2 * H.psL), ud = main.userData; /* (in: the sword comes up out of his stance at once, then settles onto its path; out: eased; another move taking over lets go at once) */
  H.psOn = k > 0.001 && !!(live || H.psLast); if (!H.psOn) { if (ud.psHold) { main.quaternion.copy(ud.psBase); main.position.copy(ud.psBaseP); ud.psHold = false; ud.psEase = 0.3; } H.psLast = H.psX = null; H.psL = 0; H.psK = 0; H.psIn = false; return; }
  if (!ud.psHold) { if (ud.mwBase) { main.quaternion.copy(ud.mwBase); main.position.copy(ud.mwBaseP); ud.mwBase = null; } ud.psHold = true; ud.psBase = main.quaternion.clone(); ud.psBaseP = main.position.clone(); }
  main.quaternion.copy(ud.psBase).multiply(new THREE.Quaternion().setFromAxisAngle(_wGz, WSW.grip * Math.PI / 180 * k)); main.position.copy(ud.psBaseP); /* (the sword grip: the blade angled up the line of his forearm, turned about the fist; it stays so all through the combo) */
  // where on the loop he is (a jump, e.g. a swing begun again, is eased over rather than snapped)
  const L0 = H.psLast; let s = _wS;
  if (live) { const phi = off + Math.max(0, Math.min(1, st.actionT)); wsAt(phi, s); if (L0) { const d = ((phi - L0.phi) % 2 + 3) % 2 - 1; if (d < -0.02 || d > 0.12) H.psX = { v: L0.v.slice(), t: 0 }; } H.psLast = { phi, v: s.slice() }; }
  else s = L0.v.slice(); /* (letting go: the sword holds its last place while the arm eases back to its own pose) */
  if (H.psX) { H.psX.t += dt; const e = Math.min(1, H.psX.t / WSW.ease), w = e * e * (3 - 2 * e), X0 = H.psX.v; s = s.map((x, q) => X0[q] + (x - X0[q]) * w); if (e >= 1) H.psX = null; if (live) H.psLast.v = s.slice(); }
  H.m.updateMatrixWorld(true);
  const f = new THREE.Vector3(0, 0, 1).applyQuaternion(H.wrap.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize(), right = new THREE.Vector3().crossVectors(f, _wUp);
  const S = RA.getWorldPosition(new THREE.Vector3()), E = RF.getWorldPosition(new THREE.Vector3()), W = RH.getWorldPosition(new THREE.Vector3()), Lu = S.distanceTo(E), Lf = E.distanceTo(W), sc = (Lu + Lf) / WSW.arm;
  for (const [bn, fr] of WSW.spine) if (B[bn]) turnFoot(B[bn], _wUp, s[5] * fr * k); /* (the chest turns into the cut) */
  H.m.updateMatrixWorld(true); RA.getWorldPosition(S); RH.getWorldPosition(W); /* (after the chest has turned) */
  // the sword along the path, its flat steady: edges level, one leading each way
  const az = s[3] * Math.PI / 180, el = s[4] * Math.PI / 180; _wY.copy(f).multiplyScalar(Math.cos(el) * Math.cos(az)).addScaledVector(right, Math.cos(el) * Math.sin(az)).addScaledVector(_wUp, Math.sin(el)).normalize();
  _wX.crossVectors(_wY, _wUp).normalize(); _wZ.crossVectors(_wX, _wY); const qs = new THREE.Quaternion().setFromRotationMatrix(_wM.makeBasis(_wX, _wY, _wZ));
  const want = B.Hips.getWorldPosition(new THREE.Vector3()).addScaledVector(f, s[0] * sc).addScaledVector(right, s[1] * sc).addScaledVector(_wUp, s[2] * sc);
  // the fist that holds it so, the forearm that fist sits on (the wrist at its own easy angle), and the arm that reaches it
  RH.updateWorldMatrix(true, false); const qh0 = RH.getWorldQuaternion(new THREE.Quaternion()), qh = qs.clone().multiply(sock.quaternion.clone().multiply(main.quaternion).invert());
  const offW = sock.getWorldPosition(new THREE.Vector3()).sub(W).applyQuaternion(qh0.clone().invert()).applyQuaternion(qh); /* (wrist to hilt, turned with the fist) */
  const aN = H.bind.RightHand[1].clone().normalize().applyQuaternion(H.bind.RightHand[0].clone().invert()).applyQuaternion(qh).normalize(); /* (the forearm's line for a straight wrist) */
  let wrist = want.clone().sub(offW); { const dv = wrist.clone().sub(S), d0 = dv.length(), dMax = (Lu + Lf) * 0.995, dMin = Math.abs(Lu - Lf) + 0.05; if (d0 > dMax || d0 < dMin) wrist.copy(S).addScaledVector(d0 > 1e-6 ? dv.divideScalar(d0) : f, d0 > dMax ? dMax : dMin); } /* (within his reach) */
  const n = wrist.clone().sub(S), d = n.length(); n.divideScalar(d); const x0 = (Lu * Lu - Lf * Lf + d * d) / (2 * d), rho = Math.sqrt(Math.max(0, Lu * Lu - x0 * x0)), ev = aN.clone().negate(); ev.addScaledVector(n, -ev.dot(n)); if (ev.lengthSq() < 1e-8) ev.copy(_wUp).negate(); ev.normalize();
  let elbow = S.clone().addScaledVector(n, x0).addScaledVector(ev, rho); const fa = wrist.clone().sub(elbow).normalize(), lim = WSW.wrist * Math.PI / 180; /* (the elbow swung round to where the wrist bends least) */
  if (fa.angleTo(aN) > lim) { const ax = new THREE.Vector3().crossVectors(aN, fa); if (ax.lengthSq() < 1e-10) ax.copy(_wUp); ax.normalize(); const fc = aN.clone().applyAxisAngle(ax, lim), Q = S.clone().addScaledVector(fc, Lf), u2 = wrist.clone().sub(Q); if (u2.lengthSq() < 1e-8) u2.copy(f); u2.normalize(); elbow = S.clone().addScaledVector(u2, Lu); wrist = elbow.clone().addScaledVector(fc, Lf); } /* (no further than a wrist bends: the hilt goes as near its place as that allows) */
  const keep = [RA.quaternion.clone(), RF.quaternion.clone()]; ikArm(null, RA, RF, RH, wrist, elbow.clone().addScaledVector(elbow.clone().sub(S.clone().lerp(wrist, 0.5)), 1));
  if (k < 0.999) { RA.quaternion.copy(keep[0].slerp(RA.quaternion, k)); RF.quaternion.copy(keep[1].slerp(RF.quaternion, k)); }
  const qsB = qh0.clone().multiply(sock.quaternion.clone().multiply(ud.psBase)).slerp(qs, k); /* (blending in or out, the sword itself turns from where his own pose holds it to its place on the path, so it never flips over on the way) */
  RH.parent.updateWorldMatrix(true, false); RH.quaternion.copy(RH.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qsB.multiply(sock.quaternion.clone().multiply(main.quaternion).invert()))); RH.updateWorldMatrix(true, true); }

// the berserker's three-blow combo with his great axe, built rather than recorded (the recording swung it one-handed at arm's
// length and flipped it overhead): both hands stay on the haft, the right hand up near the head and the left hand low near
// the butt; the axe's blades stay flat in the plane of the cut and its head leads the whole way, so it never turns in his hands.
// His hips and chest coil away before each blow and drive round into it, the hips carrying part of the turn while the feet stay put.
// Keys: [moment 0-1, grip point (right, up, forward) in arm lengths from the middle of his shoulders, the way the axe head points
// from the grip (right, up, forward), body turn in degrees (+ to his right), lean in degrees (+ forward)]. Each blow starts from
// wherever the last one left the axe, so the three run on from each other without a jump.
const AXE = {
  swing1: [[0.3, [0.42, 0.42, -0.05], [0.35, 0.75, -0.55], 40, -6], [0.39, [0.3, 0.32, 0.32], [0.15, 0.9, 0.4], 20, 2], [0.45, [0.05, 0.02, 0.76], [-0.2, 0.15, 1], -5, 10], [0.55, [-0.3, -0.2, 0.62], [-0.75, -0.3, 0.6], -30, 15], [0.66, [-0.42, -0.3, 0.5], [-0.9, -0.35, 0.05], -42, 14], [1, [-0.3, -0.2, 0.6], [-0.75, 0.35, 0.45], -30, 6]], /* (a diagonal cut: cocked over the right shoulder, over the top and down across the front to his left) */
  swing2: [[0.22, [-0.48, 0.12, 0.1], [-0.6, 0.35, -0.7], -55, 0], [0.34, [-0.3, 0.05, 0.45], [-1, 0.25, 0.05], -30, 4], [0.45, [0.0, 0.0, 0.76], [0.2, 0.08, 1], 0, 8], [0.58, [0.3, -0.05, 0.72], [0.8, 0.05, 0.55], 30, 7], [0.72, [0.45, -0.1, 0.36], [0.95, 0.05, -0.15], 45, 6], [1, [0.32, -0.1, 0.58], [0.65, 0.5, 0.35], 30, 2]], /* (the backhand: wound round to his left, swept flat back across to his right) */
  swing3: [[0.12, [0.25, 0.35, 0.45], [0.3, 0.95, 0.0], 15, -6], [0.24, [0.08, 0.62, -0.05], [0.05, 0.35, -1], 12, -14], [0.31, [0.04, 0.5, 0.6], [0.02, 1, 0.25], 4, 6], [0.36, [0.02, -0.12, 0.76], [0, -0.3, 1], -4, 22], [0.42, [0.0, -0.3, 0.72], [0, -0.85, 0.5], -4, 30], [0.68, [0.0, -0.3, 0.7], [0, -0.85, 0.5], -4, 28], [0.8, [0.3, -0.3, 0.68], [0.85, -0.3, 0.4], 8, 14], [0.9, [0.22, -0.25, 0.64], [0.5, 0.78, 0.3], 4, 5], [1, [0.12, -0.15, 0.52], [0.12, 0.92, 0.25], 0, 0]], /* (the overhead chop: raised behind his head, over the top and straight down into the ground in front, held, then back to guard) */
};
const AXE_REST = [[0.12, -0.15, 0.52], [0.12, 0.92, 0.25], 0, 0]; /* (his guard: hands low in front of him, the axe standing up before his face) */
const _axN = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
function axeSwing(ch, H, B, dt) { const st = ch._st || {}, nm = st.action, main = ch.weapons && ch.weapons.main, live = !!(AXE[nm] && st.actionT != null && !st.dead && st.roll == null && main && main.visible && main.parent);
  H.psK = (H.psK || 0) + ((live ? 1 : 0) - (H.psK || 0)) * Math.min(1, dt * (live ? 10 : 7)); H.psOn = H.psK > 0.02; if (!H.psOn) { H.psNm = null; H.axCur = null; H.axE = null; if (main && main.userData.axBaseP) { main.position.copy(main.userData.axBaseP); main.userData.axBaseP = null; } return; }
  const RA = B.RightArm, RF = B.RightForeArm, RH = B.RightHand, LA = B.LeftArm, LF = B.LeftForeArm, LH = B.LeftHand, so = {}; for (const sk of ch.hmSockets || []) if (sk.userData.side && sk.userData.fist) so[sk.userData.side] = sk;
  if (!RA || !RF || !RH || !LA || !LF || !LH || !so.R || main.parent !== so.R) { H.psOn = false; return; }
  H.m.updateMatrixWorld(true); const wq = H.wrap.getWorldQuaternion(new THREE.Quaternion()), up = new THREE.Vector3(0, 1, 0), f = new THREE.Vector3(0, 0, 1).applyQuaternion(wq).setY(0).normalize(), left = new THREE.Vector3().crossVectors(up, f), right = left.clone().negate();
  const L = RA.getWorldPosition(new THREE.Vector3()).distanceTo(RF.getWorldPosition(new THREE.Vector3())) + RF.getWorldPosition(new THREE.Vector3()).distanceTo(RH.getWorldPosition(new THREE.Vector3()));
  const k = live ? Math.max(0, Math.min(1, st.actionT)) : 1;
  if (live && (H.psNm !== nm || k < (H.psLastK ?? 1) - 0.3)) { H.psNm = nm; H.axFrom = H.axCur ? [H.axCur[0].slice(), H.axCur[1].slice(), H.axCur[2], H.axCur[3]] : AXE_REST.map(x => Array.isArray(x) ? x.slice() : x); /* (a new blow starts from wherever the axe is) */
  }
  H.psLastK = k; const ks = [[0, ...(H.axFrom || AXE_REST)], ...(AXE[H.psNm] || AXE.swing1)];
  let i = 0; while (i < ks.length - 2 && ks[i + 1][0] <= k) i++; const a = ks[i], b = ks[i + 1], a0 = ks[Math.max(0, i - 1)], b1 = ks[Math.min(ks.length - 1, i + 2)];
  let u = Math.max(0, Math.min(1, (k - a[0]) / Math.max(1e-6, b[0] - a[0]))); if (i === 0) u = u * u * (3 - 2 * u); else if (i === ks.length - 2) u = 1 - (1 - u) * (1 - u); /* (eased out of the start and into the end; full speed through the cut) */
  const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }; /* (a smooth curve through the keys) */
  const g = [0, 1, 2].map(j => cr(a0[1][j], a[1][j], b[1][j], b1[1][j], u)), dA = _axN([0, 1, 2].map(j => cr(_axN(a0[2])[j], _axN(a[2])[j], _axN(b[2])[j], _axN(b1[2])[j], u)));
  const tw = cr(a0[3], a[3], b[3], b1[3], u), ln = cr(a0[4], a[4], b[4], b1[4], u); H.axCur = [g, dA, tw, ln];
  const K = H.psK, twR = -tw * 1.35 * Math.PI / 180 * K, lnR = ln * Math.PI / 180 * K; /* (the turn a touch bigger than keyed: he really throws his weight round) */
  // the body: the hips take a third of the turn (the thighs turned back so the feet stay planted), the spine the rest, and the lean
  if (B.Hips) { turnFoot(B.Hips, up, twR * 0.4); for (const lg of ['LeftUpLeg', 'RightUpLeg']) turnFoot(B[lg], up, -twR * 0.4); }
  for (const [bn, fr] of [['Spine', 0.3], ['Spine01', 0.35], ['Spine02', 0.35]]) { const bb = B[bn]; if (!bb) continue; turnFoot(bb, up, twR * 0.6 * fr); turnFoot(bb, left, lnR * fr); }
  H.m.updateMatrixWorld(true);
  const V = (o) => new THREE.Vector3().addScaledVector(right, o[0]).addScaledVector(up, o[1]).addScaledVector(f, o[2]), S = RA.getWorldPosition(new THREE.Vector3()).lerp(LA.getWorldPosition(new THREE.Vector3()), 0.5);
  const G = S.clone().add(V(g).multiplyScalar(L)), A = V(dA).normalize();
  // the blades lie flat in the plane of the cut, the head leading. A double-bitted axe has an edge both ways, so it never has to turn over:
  // the edge is carried along with the haft without any turn about it, and only eased gently round into the plane the head is travelling in
  const kN = Math.min(1, k + 0.02), jN = (() => { let j = 0; while (j < ks.length - 2 && ks[j + 1][0] <= kN) j++; return j; })(), uN = Math.max(0, Math.min(1, (kN - ks[jN][0]) / Math.max(1e-6, ks[jN + 1][0] - ks[jN][0])));
  const dN = _axN([0, 1, 2].map(j => cr(_axN(ks[Math.max(0, jN - 1)][2])[j], _axN(ks[jN][2])[j], _axN(ks[jN + 1][2])[j], _axN(ks[Math.min(ks.length - 1, jN + 2)][2])[j], uN))), T = V(dN).sub(A); T.addScaledVector(A, -T.dot(A)); /* (the way the head is about to travel) */
  const E = H.axE ? H.axE.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(H.axA || A, A)) : (T.lengthSq() > 1e-6 ? T.clone() : f.clone()); E.addScaledVector(A, -E.dot(A)); if (E.lengthSq() < 1e-8) E.copy(right).addScaledVector(A, -right.dot(A)); E.normalize();
  if (T.lengthSq() > 1e-6) { T.normalize(); if (T.dot(E) < 0) T.negate(); E.lerp(T, Math.min(1, dt * 3)).normalize(); } H.axE = E.clone(); H.axA = A.clone();
  const Qw = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(E, A, new THREE.Vector3().crossVectors(E, A))); /* (the axe's own frame: y along the haft to the head, x the edge) */
  const mq = (main.userData.mwBase || main.quaternion).clone(), qf = Qw.clone().multiply(mq.invert()); /* (the fist's angle that lays the axe so) */
  const hand = (sd, UA, UF, UH, fistAt, pole) => { const sk = so[sd]; if (!sk) return; const F = sk.userData.fist; sk.position.copy(F.p); sk.quaternion.copy(F.q); UH.updateWorldMatrix(true, false); const cur = UH.getWorldQuaternion(new THREE.Quaternion()), hs = UH.getWorldScale(new THREE.Vector3()).x;
    const qh = qf.clone().multiply(F.q.clone().invert()), qhk = cur.clone().slerp(qh, K), wrist = fistAt.clone().sub(F.p.clone().multiplyScalar(hs).applyQuaternion(qhk));
    const keep = [UA.quaternion.clone(), UF.quaternion.clone()]; ikArm(null, UA, UF, UH, wrist, pole); if (K < 0.999) { UA.quaternion.copy(keep[0].slerp(UA.quaternion, K)); UF.quaternion.copy(keep[1].slerp(UF.quaternion, K)); UA.updateWorldMatrix(true, true); }
    UF.updateWorldMatrix(true, false); UH.quaternion.copy(UF.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qhk)); UH.updateWorldMatrix(true, true); };
  const SR = RA.getWorldPosition(new THREE.Vector3()), SL = LA.getWorldPosition(new THREE.Vector3());
  hand('R', RA, RF, RH, G, SR.clone().addScaledVector(right, 0.6 * L).addScaledVector(up, -0.8 * L).addScaledVector(f, -0.1 * L)); /* (elbows out and down, never flung up behind) */
  so.R.updateWorldMatrix(true, false); main.updateWorldMatrix(true, true); const fr = so.R.getWorldPosition(new THREE.Vector3());
  if (main.userData.axButt == null) { const inv = main.matrixWorld.clone().invert(), p = new THREE.Vector3(); let lo = 0; main.traverse(o => { if (o.isMesh && o.geometry) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) { p.set(x, y, z).applyMatrix4(o.matrixWorld).applyMatrix4(inv); lo = Math.min(lo, p.y); } } }); main.userData.axButt = lo; } /* (how far the haft runs below the axe's own origin) */
  // a long two-handed grip: the haft slides through his fists until his hands are near its end, so the butt never pokes back into him
  { const ud = main.userData; if (!ud.axBaseP) ud.axBaseP = main.position.clone(); main.position.copy(ud.axBaseP); main.updateWorldMatrix(true, true); const b0 = main.localToWorld(new THREE.Vector3(0, ud.axButt, 0)), sh = (fr.clone().sub(b0).dot(A) - 0.44 * L) * K;
    main.position.addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(main.quaternion), sh / (main.parent.getWorldScale(new THREE.Vector3()).x || 1)); main.updateWorldMatrix(true, true); }
  const butt = main.localToWorld(new THREE.Vector3(0, main.userData.axButt, 0)), dn = Math.max(0.05 * L, Math.min(0.34 * L, fr.clone().sub(butt).dot(A) - 0.07 * L)); /* (a hand's width or two below the right, never off the end of the haft) */
  hand('L', LA, LF, LH, fr.clone().addScaledVector(A, -dn), SL.clone().addScaledVector(left, 0.6 * L).addScaledVector(up, -0.8 * L).addScaledVector(f, -0.1 * L)); /* (the left hand a little further down the same haft, closed the same way) */
  H.m.updateMatrixWorld(true); }

// a great weapon swung in two hands: during a recorded swing the left hand reaches onto the haft just below the right,
// as far along it as his own forearm is long, the elbow out and down
function twoHandGrip(ch, H, B, mvK, dt) { if (mvK && H.D.oneHand && H.D.oneHand.includes(mvK)) { H.thK = 0; return; } /* (a one-handed recording (the berserker's Weapon Combo 2): his left hand stays free, as recorded) */ const main = ch.weapons && ch.weapons.main; if (H.ep && !(H.D.recGrip && mvK && H.D.recLegs && H.D.recLegs.includes(mvK))) H.ep = null; /* (the elbows' remembered bend starts afresh with each combo) */ const on = !!(mvK && H.D.moves && H.D.moves[mvK] && PUNCH.test(ch._act || '') && main && main.visible); H.thK = (H.thK || 0) + ((on ? 1 : 0) - (H.thK || 0)) * Math.min(1, dt * 12); if (H.thK < 0.02 || !B.LeftArm || !B.LeftForeArm || !B.LeftHand || !B.RightHand || !B.RightForeArm) return;
  if (H.D.recGrip && mvK && H.D.recLegs && H.D.recLegs.includes(mvK)) { recSupport(ch, H, B); return; }
  H.m.updateMatrixWorld(true); main.updateWorldMatrix(true, false); const hr = B.RightHand.getWorldPosition(new THREE.Vector3()), fr = B.RightForeArm.getWorldPosition(new THREE.Vector3()), span = hr.distanceTo(fr) * 0.95;
  const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(main.getWorldQuaternion(new THREE.Quaternion())).normalize(), tgt = hr.clone().addScaledVector(ax, -span);
  const wq = H.wrap.getWorldQuaternion(new THREE.Quaternion()), s0 = B.LeftArm.getWorldPosition(new THREE.Vector3()), pole = s0.clone().add(new THREE.Vector3(0.5, -0.7, -0.2).multiplyScalar(span * 2).applyQuaternion(wq));
  const keep = [B.LeftArm.quaternion.clone(), B.LeftForeArm.quaternion.clone()]; ikArm(null, B.LeftArm, B.LeftForeArm, B.LeftHand, tgt, pole);
  if (H.thK < 0.999) { B.LeftArm.quaternion.copy(keep[0].slerp(B.LeftArm.quaternion, H.thK)); B.LeftForeArm.quaternion.copy(keep[1].slerp(B.LeftForeArm.quaternion, H.thK)); } }
// small corrections to a recorded combo, by time in the recording (each eased in and out): the right fist held out from his body by up to
// nudge[2] metres (the left follows it onto the haft later), and a foot the recording drags along the ground lifted clear of it in an arc
const _bump = (t, a, b) => { if (!(t > a && t < b)) return 0; const s = Math.sin(Math.PI * (t - a) / (b - a)); return s * s; };
function recFix(ch, H, B, mvK) { const X = H.D.recFix; if (!mvK || !H.D.recLegs || !H.D.recLegs.includes(mvK) || !H.lastMove) return; const t = H.lastMove.t, w = Math.min(1, H.mw || 0) * (1 - Math.min(1, H.v / 1.5));
  if (w < 0.01) return; H.m.updateMatrixWorld(true); const f = new THREE.Vector3(0, 0, 1).applyQuaternion(H.wrap.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize(), V3 = THREE.Vector3;
  const reach = (up, mid, end, tgt) => { const keepQ = end.getWorldQuaternion(new THREE.Quaternion()), s0 = up.getWorldPosition(new V3()), e0 = mid.getWorldPosition(new V3()), w0 = end.getWorldPosition(new V3()), pole = e0.clone().addScaledVector(e0.clone().sub(s0.clone().lerp(w0, 0.5)), 1);
    ikArm(null, up, mid, end, tgt, pole); mid.updateWorldMatrix(true, false); end.quaternion.copy(mid.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(keepQ)); end.updateWorldMatrix(true, true); }; /* (the hand or foot keeps the recording's own angle in the world: only its place moves) */
  // feet on the ground: the recording floats them a few centimetres (more in the lunge). The hips come down until the lower foot stands on the
  // ground, and a foot still only a little above it is set down too; a foot lifted well clear (a step) is left in the air
  const TL = B.LeftToeBase || B.LeftFoot, TR = B.RightToeBase || B.RightFoot;
  if (X.plant && TL && TR && H.toeG != null && B.Hips && B.Hips.parent) { const gy = H.wrap.getWorldPosition(new V3()).y + H.toeG, hl = TL.getWorldPosition(new V3()).y - gy, hr = TR.getWorldPosition(new V3()).y - gy, drop = Math.min(hl, hr) * w;
    if (Math.abs(drop) > 0.001) { const hp = B.Hips.getWorldPosition(new V3()); hp.y -= drop; B.Hips.parent.updateWorldMatrix(true, false); B.Hips.position.copy(B.Hips.parent.worldToLocal(hp)); H.m.updateMatrixWorld(true); }
    for (const [sd, toe] of [['Left', TL], ['Right', TR]]) { const ex = toe.getWorldPosition(new V3()).y - gy, UL = B[sd + 'UpLeg'], LL = B[sd + 'Leg'], FT = B[sd + 'Foot']; if (ex < 0.003 || !UL || !LL || !FT) continue; const u = Math.max(0, Math.min(1, (ex - 0.05) / 0.09)), wP = (1 - u * u * (3 - 2 * u)) * w; if (wP > 0.01) reach(UL, LL, FT, FT.getWorldPosition(new V3()).add(new V3(0, -ex * wP, 0))); } }
  // a foot that never leaves the ground in the recording but slides a little as he lunges: held where it stands in his guard (in his own frame)
  for (const sd of X.pin || []) { const toe = sd === 'Left' ? TL : TR, UL = B[sd + 'UpLeg'], LL = B[sd + 'Leg'], FT = B[sd + 'Foot']; if (!toe || !UL || !LL || !FT) continue; H.pin = H.pin || {};
    if (!H.pin[sd] && mvK === H.D.recLegs[0] && t < 0.3 && w > 0.97) H.pin[sd] = ch.root.worldToLocal(toe.getWorldPosition(new V3())); const P0 = H.pin[sd]; if (!P0) continue; const d = ch.root.localToWorld(P0.clone()).sub(toe.getWorldPosition(new V3())); /* (taken once, where the recording's guard puts the foot, and kept: taken afresh at every first blow it was caught mid-blend from his stance the first time, so the foot jumped 22 cm at the next join) */ d.y = 0; if (d.lengthSq() > 1e-6) reach(UL, LL, FT, FT.getWorldPosition(new V3()).addScaledVector(d, w)); }
  for (const [sd, a, b, h] of X.lift || []) { const UL = B[sd + 'UpLeg'], LL = B[sd + 'Leg'], FT = B[sd + 'Foot'], l = _bump(t, a, b) * h * w; if (l > 0.001 && UL && LL && FT) reach(UL, LL, FT, FT.getWorldPosition(new V3()).add(new V3(0, l, 0))); }
  // the right fist held off his body (forward, up), eased in and out: [start, full, still full, end, forward m, up m]; the left fist follows it onto the haft
  if (B.RightArm && B.RightForeArm && B.RightHand) { const off = new V3(); for (const [a, b, c, d, fw, up] of X.fist || []) { const e = t <= a || t >= d ? 0 : t < b ? (1 - Math.cos(Math.PI * (t - a) / (b - a))) / 2 : t <= c ? 1 : (1 + Math.cos(Math.PI * (t - c) / (d - c))) / 2; off.addScaledVector(f, fw * e * w); off.y += up * e * w; }
    if (off.lengthSq() > 1e-6) reach(B.RightArm, B.RightForeArm, B.RightHand, B.RightHand.getWorldPosition(new V3()).add(off)); }
  H.m.updateMatrixWorld(true); }
// the recorded combo's left hand: the recording already holds both fists on one haft; the left fist is put exactly on the axe's haft, at the
// place along it nearest where the recording has it (a fist's width below the right, never past the butt), the elbow bent the recording's way.
// Where his left arm cannot reach that far (the top of the swing and the start of the chop, where the recording's left fist is up to 9 cm off
// this longer haft), the right fist, and the axe with it, comes toward his left shoulder by what the arm lacks: the axe is moved, never turned
function recSupport(ch, H, B) { const main = ch.weapons.main, so = {}; for (const sk of ch.hmSockets || []) if (sk.userData.side && sk.userData.fist) so[sk.userData.side] = sk; const LA = B.LeftArm, LF = B.LeftForeArm, LH = B.LeftHand, RA = B.RightArm, RF = B.RightForeArm, RH = B.RightHand; if (!so.L || !so.R || main.parent !== so.R) return;
  H.m.updateMatrixWorld(true); main.updateWorldMatrix(true, true); const ud = main.userData, V3 = THREE.Vector3;
  if (ud.rgButt == null) { const inv = main.matrixWorld.clone().invert(), p = new V3(); let lo = 0; main.traverse(o => { if (o.isMesh && o.geometry) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) { p.set(x, y, z).applyMatrix4(o.matrixWorld).applyMatrix4(inv); lo = Math.min(lo, p.y); } } }); ud.rgButt = lo; } /* (the end of the haft, in the axe's own frame) */
  const wq = H.wrap.getWorldQuaternion(new THREE.Quaternion()), poleL = elbowPole(H, 'L', LA, LF, LH, wq), keep = [LA.quaternion.clone(), LF.quaternion.clone()];
  const goal = () => { main.updateWorldMatrix(true, true); so.L.updateWorldMatrix(true, false); const ax = new V3(0, 1, 0).applyQuaternion(main.getWorldQuaternion(new THREE.Quaternion())).normalize(), rf = so.R.getWorldPosition(new V3()), butt = main.localToWorld(new V3(0, ud.rgButt, 0)).sub(rf).dot(ax), fw = RH.getWorldScale(new V3()).x * (so.R.userData.fist.len || 0); /* (a fist's width: the hand's own length) */
    const along = Math.max(butt + fw * 0.8, Math.min(-fw, so.L.getWorldPosition(new V3()).sub(rf).dot(ax))); return rf.addScaledVector(ax, along); }; /* (the place on the haft where the left fist closes) */
  if (RA && RF && RH) { let poleR = null; for (let pass = 0; pass < 2; pass++) { const T = goal(), sh = LA.getWorldPosition(new V3()), el = LF.getWorldPosition(new V3()), lack = T.distanceTo(sh) - (el.distanceTo(sh) + so.L.getWorldPosition(new V3()).distanceTo(el)) * 0.96; if (lack <= 0.002) break;
    poleR = poleR || elbowPole(H, 'R', RA, RF, RH, wq); const keepQ = RH.getWorldQuaternion(new THREE.Quaternion()); ikArm(null, RA, RF, RH, RH.getWorldPosition(new V3()).addScaledVector(sh.clone().sub(T).normalize(), lack * Math.min(1, H.thK)), poleR(RA, RF));
    RF.updateWorldMatrix(true, false); RH.quaternion.copy(RF.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(keepQ)); RH.updateWorldMatrix(true, true); } } /* (the right hand keeps its angle in the world, so the axe only moves; a second pass takes up what the first could not) */
  ikPoint(LA, LF, so.L, goal(), poleL(LA, LF)); /* (the fist itself goes onto the haft: it sits a hand's length past the wrist and turns with the forearm, so aiming the wrist and correcting never settled, it rocked 3-6 cm either side) */
  if (H.thK < 0.999) { LA.quaternion.copy(keep[0].slerp(LA.quaternion, H.thK)); LF.quaternion.copy(keep[1].slerp(LF.quaternion, H.thK)); LA.updateWorldMatrix(true, true); } }
// which way an elbow bends: the way the recording bends it. While the recording's arm is nearly straight (the bend's direction there is noise,
// and following it flipped the elbow over in one frame) the last bend is carried round with the arm as it swings, so it always stays square
// to the arm (kept in his frame instead, it could end up along the arm, and the arm then locked straight past the haft); it never turns more
// than 25 degrees a frame. Returns the pole for ikArm: a point off the shoulder on the side the elbow goes
function elbowPole(H, key, up, mid, end, wq) { const V3 = THREE.Vector3, sh = up.getWorldPosition(new V3()), el = mid.getWorldPosition(new V3()), ln = end.getWorldPosition(new V3()).sub(sh).normalize(), off = el.clone().sub(sh), s0 = off.length();
  off.addScaledVector(ln, -off.dot(ln)); const s = off.length() / Math.max(1e-6, s0); H.ep = H.ep || {}; let e = H.ep[key];
  if (!e) { let p = s > 0.02 ? off.clone().normalize() : new V3(0, -1, 0).addScaledVector(ln, ln.y); if (p.lengthSq() < 1e-6) p = new V3(1, 0, 0).applyQuaternion(wq).addScaledVector(ln, -new V3(1, 0, 0).applyQuaternion(wq).dot(ln)); e = H.ep[key] = { p: p.normalize(), l: ln.clone() }; }
  else { e.p.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(e.l, ln)); e.l.copy(ln); e.p.addScaledVector(ln, -e.p.dot(ln)); if (e.p.lengthSq() < 1e-8) e.p.copy(off.lengthSq() > 1e-10 ? off : new V3(0, -1, 0)); e.p.normalize(); /* (carried round with the arm) */
    if (s > 0.06) { const d = off.clone().normalize(), ang = e.p.angleTo(d), mx = THREE.MathUtils.degToRad(25) * Math.min(1, (s - 0.06) / 0.14); if (ang > 1e-4) { if (ang > 3.1) e.p.applyAxisAngle(ln, mx); else e.p.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new V3().crossVectors(e.p, d).normalize(), Math.min(ang, mx))); e.p.normalize(); } } }
  const dW = e.p.clone(); return (u) => u.getWorldPosition(new V3()).add(dW); }
// two-bone IK that puts a point carried by the forearm (eff: anything under the forearm, e.g. the fist) exactly on target: the elbow from the
// two lengths and the pole, then the forearm turned (the least turn) until that point lands on the target
function ikPoint(up, fore, eff, target, pole) { const V3 = THREE.Vector3; up.updateWorldMatrix(true, true); eff.updateWorldMatrix(true, false); const S = up.getWorldPosition(new V3()), E = fore.getWorldPosition(new V3()), a = E.distanceTo(S), b = eff.getWorldPosition(new V3()).distanceTo(E);
  const dv = target.clone().sub(S); let d = dv.length(); if (d < 1e-4 || a < 1e-4 || b < 1e-4) return; d = Math.max(Math.abs(a - b) * 1.001 + 1e-4, Math.min(d, (a + b) * 0.999)); dv.normalize();
  const cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))), n = pole.clone().sub(S); n.addScaledVector(dv, -n.dot(dv)); if (n.lengthSq() < 1e-10) n.set(0, -1, 0).addScaledVector(dv, dv.y); n.normalize();
  up.quaternion.copy(aimBone(up, fore, dv.clone().multiplyScalar(cosA).addScaledVector(n, Math.sqrt(1 - cosA * cosA)))); up.updateWorldMatrix(true, true); eff.updateWorldMatrix(true, false);
  const E2 = fore.getWorldPosition(new V3()), cur = eff.getWorldPosition(new V3()).sub(E2).normalize(), want = S.clone().addScaledVector(dv, d).sub(E2).normalize(), dq = new THREE.Quaternion().setFromUnitVectors(cur, want);
  fore.quaternion.copy(fore.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(dq.multiply(fore.getWorldQuaternion(new THREE.Quaternion())))); fore.updateWorldMatrix(true, true); }
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

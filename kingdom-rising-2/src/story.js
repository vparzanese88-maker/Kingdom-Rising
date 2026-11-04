// The main story: cinematic scenes (letterbox, the camera on the speaker, typed lines) and the quest chain
// that drives them. Main quests accept and complete on their own as the scenes play.
import * as THREE from 'three';
import { G } from './state.js';
import { S } from './audio.js';
import { QUESTS, NPCS } from './data.js';
import * as Game from './game.js';

let scene = null;
const PORTRAIT = { maren: '👵', bram: '🪓', pip: '🧒', corwin: '⚓', you: '🙂' };
// play a scene: lines are [speakerId, text]; speakerId 'you' for your own words
export function playScene(lines, done, focus) {
  if (scene) return;
  let box = document.getElementById('scene');
  if (!box) { box = document.createElement('div'); box.id = 'scene'; box.innerHTML = '<div class="bar top"></div><div class="bar bot"></div><div class="sbox"><div class="sp"></div><div class="who"></div><div class="txt"></div><div class="nx">Space or click to continue</div></div>'; document.body.appendChild(box); }
  box.hidden = false; requestAnimationFrame(() => box.classList.add('on'));
  if (document.pointerLockElement) document.exitPointerLock();
  G.uiOpen = true; G.inScene = true; const hud = document.getElementById('hud'); if (hud) hud.classList.add('scenehide');
  scene = { lines, i: -1, done, focus, typed: 0, full: '', t: 0 };
  next();
}
function next() {
  const sc = scene; sc.i++;
  if (sc.i >= sc.lines.length) return end();
  const [who, text] = sc.lines[sc.i], box = document.getElementById('scene');
  const nm = who === 'you' ? (G.save && G.save.name) || 'You' : (NPCS[who] && NPCS[who].name) || who;
  box.querySelector('.sp').textContent = PORTRAIT[who] || '🗣'; box.querySelector('.who').textContent = nm;
  sc.full = text; sc.typed = 0; box.querySelector('.txt').textContent = ''; S.click();
  sc.speaker = who;
}
function end() {
  const box = document.getElementById('scene'); box.classList.remove('on'); setTimeout(() => { box.hidden = true; }, 400);
  const hud = document.getElementById('hud'); if (hud) hud.classList.remove('scenehide');
  const d = scene.done; scene = null; G.inScene = false; G.uiOpen = false;
  if (d) d(); G.hooks.relock && G.hooks.relock();
}
export function sceneKey(code) { if (!scene) return false; if (code === 'Space' || code === 'Enter' || code === 'KeyE' || code === 'Escape') advance(); return true; }
export function advance() { if (!scene) return; if (scene.typed < scene.full.length) { scene.typed = scene.full.length; return; } next(); }
export const inScene = () => !!scene;
// every frame: type the line out, turn the camera to whoever is speaking
export function updateScene(dt) {
  if (!scene) return;
  const box = document.getElementById('scene'), sc = scene;
  if (sc.typed < sc.full.length) { sc.typed = Math.min(sc.full.length, sc.typed + dt * 55); box.querySelector('.txt').textContent = sc.full.slice(0, Math.floor(sc.typed)); }
  const P = G.player, who = sc.speaker !== 'you' ? G.npcs.find(n => n.id === sc.speaker) : null, tgt = who || sc.focus;
  if (P && tgt) { const want = Math.atan2(tgt.pos.x - P.pos.x, tgt.pos.z - P.pos.z); let d = want - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); P.yaw += d * Math.min(1, dt * 4); P.pitch += (-0.08 - P.pitch) * Math.min(1, dt * 4); }
}

// ---------- the main story, chapter by chapter ----------
const MAREN_ASK = [
  ['maren', 'Before anything else, newcomer: where did you sail from, in a boat like that?'],
  ['you', 'Far enough that it doesn\'t matter.'],
  ['maren', 'Hm. Everyone on this island is running from something. Keep your secrets.'],
  ['maren', 'Your boat? I know someone who can help. But I must ask something of you first.'],
  ['maren', 'Please, help our people in need, and help our village grow strong enough to defend ourselves from the goblin attacks.'],
  ['maren', 'Do that, and I will lead you to someone who knows where to find repairs and supplies for your boat.'],
  ['you', 'Then tell me where to start.'],
  ['maren', 'With walls. Bram oversees what little defence we have. Bring him timber and stone and he will raise a palisade around Seabreak.'],
];
// (Your past stays your own on Kelda: you came from a place that needed you, helped them rebuild and put down
// some very dangerous enemies, then had to take this boat and leave in a hurry. That is a story for another time.)
// Master Corwin's first look at your boat, for when you reach Saltmere:
export const CORWIN_BOAT = [
  ['corwin', 'So. Pip tells me you have a boat that needs work. What is she, then? Build, tonnage, who laid her keel?'],
  ['you', 'Small. Single mast. She was... built well, once.'],
  ['corwin', 'Built well, once. Ha. That is not your ship, is it? You do not even know her name.'],
  ['corwin', 'You in some kind of trouble, mate?'],
  ['you', '...'],
  ['corwin', 'Right. Not my business. Let us get her fixed.'],
];
export const SCENES = {
  mq_boat: { done: MAREN_ASK },
  mq_walls: {
    done: [['bram', 'That\'s all of it. Right, lads, get those stakes in the ground!'], ['bram', 'There. A proper wall, with a gate on every road. First time in years I\'ll sleep at night.'], ['bram', 'But a wall is only half of it. Without towers, they\'ll just climb over in the dark. Bring me the same again and I\'ll put up two watchtowers at the north gate.']],
  },
  mq_towers: {
    done: [['bram', 'Look at that. Watchtowers, a proper wall. Seabreak looks like a real town now.'], ['bram', 'Go and tell the Elder. She\'ll want to thank you herself.']],
  },
  mq_elder: {
    done: [['maren', 'You have done more for Seabreak in a few days than anyone has in years. And now I will keep my word.'], ['maren', 'The man you need is Pip, the apprentice of Master Corwin Hale, the best shipwright on Kelda. Corwin works in Saltmere, far to the north.'],
      ['maren', 'But Pip is not in Saltmere. He went into the goblin cave west of here to see what they were up to. He never came out. We think they caught him.'],
      ['you', 'Then I will bring him back.'], ['maren', 'Be careful. That cave goes deep. Some of it is no place for you yet: find Pip, and get out.']],
  },
};
// the chain, in order: each main quest starts when the one before it is handed in
export const CHAIN = ['mq_boat', 'mq_walls', 'mq_towers', 'mq_elder', 'mq_pip'];
// talking to someone: if a main quest wants them, play its scene instead of the dialog window
export function storyTalk(h, npc) {
  for (const id of Object.keys(h.quests.active)) {
    const q = QUESTS.find(x => x.id === id); if (!q || !q.main) continue;
    const talkObj = q.obj.findIndex(o => o.t === 'talk' && o.npc === npc.id);
    const sc = SCENES[q.id];
    if (talkObj >= 0 || (q.turnin === npc.id && Game.questComplete(h, q))) {
      if (talkObj >= 0) Game.talkTo(h, npc.id);
      if (!Game.questComplete(h, q)) continue;
      playScene(sc && sc.done ? sc.done : [[npc.id, q.done || 'Well done.']], () => finish(h, q), npc);
      return true;
    }
  }
  return false;
}
function finish(h, q) {
  Game.turnIn(h, q);
  G.hooks.storyStep && G.hooks.storyStep(q.id);
  const k = CHAIN.indexOf(q.id), nx = k >= 0 && CHAIN[k + 1] && QUESTS.find(x => x.id === CHAIN[k + 1]);
  if (nx && !h.quests.active[nx.id] && !h.quests.done.includes(nx.id)) { Game.acceptQuest(h, nx); G.hooks.toast && G.hooks.toast(`Main quest: ${nx.title}`, '📜', 'gold'); }
}

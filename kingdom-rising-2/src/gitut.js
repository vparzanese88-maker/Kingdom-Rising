// Goblos: the first steps in Snagglefoot (the owner: the basics, stupid simple; mostly tips, a few small quests;
// skippable, and all the tips go away when skipped). While they run you can't leave the village.
import { G } from './state.js';
import { QUESTS } from './data.js';
const STEPS = [
  ['look', 'Look around', 'move the mouse'],
  ['move', 'Walk', '<b>W A S D</b>'],
  ['sprint', 'Sprint and jump', 'hold <b>Shift</b> · <b>Space</b>'],
  ['talk', 'Talk to Templeton', 'walk up to him, press <b>E</b>'],
  ['abil', 'See your abilities', 'press <b>K</b>'],
  ['bags', 'Open your bags', 'press <b>I</b>'],
  ['map', 'Open the map', 'press <b>M</b>'],
  ['dummy', 'Hit the training dummy', '<b>left click</b>, 5 hits'],
  ['ability', 'Use your first ability', 'press <b>F</b>'],
  ['cook', 'Cook a meal at Mags\' pot', 'press <b>E</b> at the pot, then Craft'],
];
let panel = null, h = null;
const done = () => (h.tutDone = h.tutDone || {});
function mark(id) { if (!h || h.tut !== 'on' || done()[id]) return; done()[id] = true; render(); if (STEPS.every(s => done()[s[0]])) finish(); }
function render() {
  if (!panel) return;
  const left = STEPS.filter(s2 => !done()[s2[0]]).slice(0, 4); // (only the next few steps, so the panel stays small)
  panel.querySelector('.hd b').textContent = `First Steps ${STEPS.length - STEPS.filter(s2 => !done()[s2[0]]).length}/${STEPS.length}`;
  panel.querySelector('ul').innerHTML = left.map(([id, t, k]) => `<li class="${done()[id] ? 'ok' : ''}"><i>${done()[id] ? '✔' : '○'}</i><span>${t}<small>${k}</small></span></li>`).join('');
  const n = STEPS.filter(s => done()[s[0]]).length; panel.querySelector('.bar u').style.width = (n / STEPS.length * 100) + '%';
}
function finish() { h.tut = 'done'; if (panel) { panel.classList.add('fin'); panel.querySelector('ul').innerHTML = '<li class="ok"><i>✔</i><span>You\'re ready!<small>Templeton has more to tell you</small></span></li>'; setTimeout(() => { panel && panel.remove(); panel = null; }, 4000); } G.hooks.toast && G.hooks.toast('First steps done: you can leave the village now', '✔', 'gold'); }
export function skipTutorial() {
  if (!h) return; h.tut = 'skip'; const I = h.isle || (h.isle = {}); I.tut_dummy = true; I.tut_cook = true;
  for (const id of ['gi_arrive', 'gi_first']) { delete h.quests.active[id]; if (!h.quests.done.includes(id)) h.quests.done.push(id); }
  if (panel) { panel.remove(); panel = null; } G.hooks.questsChanged && G.hooks.questsChanged();
  G.hooks.toast && G.hooks.toast('Tutorial skipped. Talk to Templeton when you\'re ready.', '⏭', 'gold');
}
export function startTutorial(hero) {
  h = hero; if (h.tut !== 'on') return; if (panel) panel.remove();
  panel = document.createElement('div'); panel.id = 'tutpanel';
  panel.innerHTML = '<div class="hd"><b>First Steps</b><button>Skip tutorial</button></div><div class="bar"><u></u></div><ul></ul>';
  panel.querySelector('button').onclick = (e) => { e.stopPropagation(); skipTutorial(); };
  document.body.appendChild(panel); render();
}
export function tutTick() {
  if (!h || h.tut !== 'on' || !h.quests) return; const I = h.isle || {};
  if (h.quests.done.includes('gi_first')) { finish(); return; } // (the First Steps quest handed in: the village opens up, whatever tips are left)
  if (h.quests.done.includes('gi_arrive')) mark('talk'); if (I.tut_dummy) mark('dummy'); if (I.tut_cook) mark('cook');
}
addEventListener('keydown', (e) => { if (!h || h.tut !== 'on' || !G.player) return; const c = e.code;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(c)) mark('move'); else if (c === 'ShiftLeft' || c === 'ShiftRight' || c === 'Space') mark('sprint');
  else if (c === 'KeyK') mark('abil'); else if (c === 'KeyI') mark('bags'); else if (c === 'KeyM') mark('map'); else if (c === 'KeyF') mark('ability'); }, true);
addEventListener('mousemove', (e) => { if (h && h.tut === 'on' && document.pointerLockElement && Math.abs(e.movementX) + Math.abs(e.movementY) > 4) { tutTick.look = (tutTick.look || 0) + 1; if (tutTick.look > 30) mark('look'); } });
export const tutOn = () => !!(h && h.tut === 'on');

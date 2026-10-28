// Kingdom Rising 3D — key bindings: every action can be put on up to two keys (Settings → Key Bindings).
// Keys are stored by their physical position (KeyboardEvent.code), so they work on any keyboard layout.
import { K3 } from './core.js';

export const ACTIONS = [
  { group: 'Movement', id: 'forward', name: 'Move forward', def: ['KeyW', 'ArrowUp'] },
  { group: 'Movement', id: 'back', name: 'Move backward', def: ['KeyS', 'ArrowDown'] },
  { group: 'Movement', id: 'turnLeft', name: 'Turn left (strafe while holding right mouse)', def: ['KeyA', 'ArrowLeft'] },
  { group: 'Movement', id: 'turnRight', name: 'Turn right (strafe while holding right mouse)', def: ['KeyD', 'ArrowRight'] },
  { group: 'Movement', id: 'strafeLeft', name: 'Strafe left', def: [] },
  { group: 'Movement', id: 'strafeRight', name: 'Strafe right', def: [] },
  { group: 'Movement', id: 'jump', name: 'Jump', def: ['Space'] },
  { group: 'Movement', id: 'autorun', name: 'Auto run', def: ['NumLock', 'KeyT'] },
  { group: 'Movement', id: 'walk', name: 'Walk / run toggle', def: ['KeyH'] },
  { group: 'Movement', id: 'sit', name: 'Sit / stand', def: ['KeyX'] },
  { group: 'Movement', id: 'light', name: 'Light / blow out your candle or lantern', def: ['KeyL'] },
  { group: 'Combat', id: 'target', name: 'Target nearest enemy', def: ['Tab'] },
  { group: 'Combat', id: 'autoAttack', name: 'Auto attack', def: ['KeyQ', 'Backquote'] },
  { group: 'Combat', id: 'range', name: 'Melee / ranged mode', def: ['KeyR'] },
  { group: 'Combat', id: 'interact', name: 'Talk, loot, use', def: ['KeyE'] },
  ...Array.from({ length: 10 }, (_, i) => ({ group: 'Hotbar', id: 'hot' + (i + 1), name: 'Hotbar slot ' + (i + 1), def: ['Digit' + ((i + 1) % 10)] })),
  { group: 'Camera', id: 'view', name: 'First / third person', def: ['KeyV'] },
  { group: 'Camera', id: 'zoomIn', name: 'Zoom in', def: ['Equal', 'NumpadAdd'] },
  { group: 'Camera', id: 'zoomOut', name: 'Zoom out', def: ['Minus', 'NumpadSubtract'] },
  { group: 'Camera', id: 'lookBack', name: 'Look behind (hold)', def: [] },
  { group: 'Windows', id: 'inv', name: 'Inventory and character', def: ['KeyI', 'KeyB'] },
  { group: 'Windows', id: 'spells', name: 'Spell book', def: ['KeyP'] },
  { group: 'Windows', id: 'abil', name: 'Abilities', def: ['KeyK'] },
  { group: 'Windows', id: 'journal', name: 'Quest journal', def: ['KeyJ'] },
  { group: 'Windows', id: 'map', name: 'World map', def: ['KeyM'] },
  { group: 'Windows', id: 'minimap', name: 'Minimap on / off', def: ['KeyZ'] },
  { group: 'Windows', id: 'kingdom', name: 'Kingdom', def: ['KeyN'] },
  { group: 'Windows', id: 'macros', name: 'Macros', def: ['KeyU'] },
  { group: 'Windows', id: 'mercs', name: 'Mercenaries', def: ['KeyY'] },
  { group: 'Windows', id: 'group', name: 'Group', def: ['KeyG'] },
  { group: 'Windows', id: 'settings', name: 'Settings', def: ['KeyO'] },
  { group: 'Windows', id: 'help', name: 'Help', def: ['F1'] },
  { group: 'Windows', id: 'fullscreen', name: 'Full screen', def: ['KeyF'] },
];
const BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

K3.settings.keys = K3.settings.keys || {};
let map = new Map(); // code -> action id
export function bindingsOf(id) { const o = K3.settings.keys[id]; return (o || BY_ID[id].def).slice(0, 2); }
function rebuild() { map = new Map(); for (const a of ACTIONS) for (const c of bindingsOf(a.id)) if (c && !map.has(c)) map.set(c, a.id); }
rebuild();
export function actionOf(code) { return map.get(code) || null; }
// put a key on an action (slot 0 or 1); the key is taken off any other action. code null clears the slot.
export function bind(id, slot, code) {
  const taken = [];
  if (code) for (const a of ACTIONS) { const b = bindingsOf(a.id); const i = b.indexOf(code); if (i >= 0 && !(a.id === id && i === slot)) { b[i] = null; K3.settings.keys[a.id] = b; taken.push(a.name); } }
  const b = bindingsOf(id); while (b.length < 2) b.push(null); b[slot] = code; K3.settings.keys[id] = b;
  K3.saveSettings(); rebuild(); return taken;
}
export function resetKeys() { K3.settings.keys = {}; K3.saveSettings(); rebuild(); }

// which physical keys are down right now
export const pressed = new Set();
export function held(id) { for (const c of bindingsOf(id)) if (c && pressed.has(c)) return true; return false; }

const NAMES = { Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Left Alt', AltRight: 'Right Alt', CapsLock: 'Caps Lock', NumLock: 'Num Lock', PageUp: 'Page Up', PageDown: 'Page Down', NumpadAdd: 'Num +', NumpadSubtract: 'Num -', NumpadMultiply: 'Num *', NumpadDivide: 'Num /', NumpadEnter: 'Num Enter', NumpadDecimal: 'Num .' };
export function keyName(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
  m = /^Digit(\d)$/.exec(code); if (m) return m[1];
  m = /^Numpad(\d)$/.exec(code); if (m) return 'Num ' + m[1];
  if (code === 'Mouse3') return 'Middle mouse'; if (code === 'Mouse4') return 'Mouse 4'; if (code === 'Mouse5') return 'Mouse 5';
  return code;
}
K3.keys = { ACTIONS, bindingsOf, actionOf, bind, resetKeys, held, pressed, keyName };

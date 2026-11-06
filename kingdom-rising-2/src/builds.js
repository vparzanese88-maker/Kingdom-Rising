// Saved ability builds: the skill-tree picks and hotbar for each class, kept in this browser.
// Kingdom Arena and the Training Yard each keep their own (the yard has unlimited points).
import { CLASS_TREE } from './data.js';
import * as Game from './game.js';
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } };
const sig = (h) => JSON.stringify([h.ctree || {}, (h.hotbar || []).map(s => s && s.id)]);
const last = {};
// put a saved build on a hero; returns true if there was one
export function loadBuild(key, h, maxPts = Infinity) {
  const b = read(key)[h.cls]; if (!b || !b.ctree) return false;
  const ids = new Set((CLASS_TREE[h.cls] || []).filter(n => n.t !== 'ult').map(n => n.id)), ct = {};
  for (const id of Object.keys(b.ctree)) if (ids.has(id)) ct[id] = 1;
  if (Object.keys(ct).length > maxPts) return false; // (a yard build with more points than this mode allows)
  h.ctree = ct; h.hotbar = b.hotbar || null; Game.autoFillHotbar(h); last[key + h.cls] = sig(h); return true;
}
// save it whenever it changes (call this now and then)
export function saveBuild(key, h) {
  if (!h || !h.cls) return; const s = sig(h); if (last[key + h.cls] === s) return; last[key + h.cls] = s;
  const all = read(key); if (!Object.keys(h.ctree || {}).length) delete all[h.cls]; else all[h.cls] = { ctree: h.ctree, hotbar: h.hotbar, t: Date.now() };
  try { localStorage.setItem(key, JSON.stringify(all)); } catch (e) { /* storage full or blocked */ }
}

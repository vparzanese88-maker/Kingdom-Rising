// Campaign save slots (up to 5) and settings, kept in localStorage.
const KEY = 'kr2_saves_v1';
const SKEY = 'kr2_settings_v1';
export const MAX_SAVES = 5;

function read(k, d) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : d; } catch (e) { return d; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

function migrate(s) { if (s.race === 'human') s.race = 'highelf'; else if (s.race === 'elf') s.race = 'woodelf'; return s; }
export function listSaves() { return read(KEY, []).map(migrate).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0)); }
export function getSave(id) { const s = read(KEY, []).find(s => s.id === id); return s ? migrate(s) : null; }
export function putSave(save) {
  const all = read(KEY, []);
  const i = all.findIndex(s => s.id === save.id);
  save.lastPlayed = Date.now();
  if (i >= 0) all[i] = save; else all.push(save);
  return write(KEY, all);
}
export function deleteSave(id) { write(KEY, read(KEY, []).filter(s => s.id !== id)); }
export function canCreate() { return read(KEY, []).length < MAX_SAVES; }

export const DEFAULT_SETTINGS = {
  master: 0.8, music: 0.55, sfx: 0.85, ambient: 0.7,
  sens: 1.0, invertY: false, fov: 75,
  quality: 'medium', shadows: true, bloom: true, grass: true, viewDist: 1, dmgNumbers: true, headBob: true,
};
export const settings = Object.assign({}, DEFAULT_SETTINGS, read(SKEY, {}));
export function saveSettings() { write(SKEY, settings); }

export function fmtTime(sec) {
  sec = Math.floor(sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  if (m > 0) return m + 'm';
  return sec + 's';
}
export function fmtDate(t) {
  if (!t) return '';
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

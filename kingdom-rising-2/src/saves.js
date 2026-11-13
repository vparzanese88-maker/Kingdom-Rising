// Campaign save slots (up to 5) and settings, kept in localStorage.
const KEY = 'kr2_saves_v1';
const SKEY = 'kr2_settings_v1';
export const MAX_SAVES = 5;

function read(k, d) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : d; } catch (e) { return d; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

function migrate(s) { if (s.race === 'human' && !s.raceV2) s.race = 'highelf'; else if (s.race === 'elf') s.race = 'woodelf'; return s; }
// the owner: the campaign was remade (class-only heroes, Goblin Island): the old campaign heroes are cleared once
const RESET = 'kr2_gi_reset';
try { if (!localStorage.getItem(RESET)) { localStorage.removeItem(KEY); localStorage.setItem(RESET, '1'); } } catch (e) { /* no storage */ }
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
export const MAX_CHARS = 5;
// a campaign holds up to 5 characters; old single-hero saves are their own campaign
export function campaignOf(s) { return s.campaign || s.id; }
export function listCampaigns() {
  const map = new Map();
  for (const s of listSaves()) { const k = campaignOf(s); if (!map.has(k)) map.set(k, { id: k, name: s.campaignName || `${s.name}'s Campaign`, chars: [] }); map.get(k).chars.push(s); }
  return [...map.values()];
}
export function canCreate() { return listCampaigns().length < MAX_SAVES; }

export const DEFAULT_SETTINGS = {
  master: 0.8, music: 0.4, sfx: 0.85, ambient: 0.7,
  sens: 1.0, invertY: false, fov: 75,
  quality: 'medium', shadows: true, bloom: true, grass: true, viewDist: 1, dmgNumbers: true, headBob: true, autoEquip: true, autoLoot: true,
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

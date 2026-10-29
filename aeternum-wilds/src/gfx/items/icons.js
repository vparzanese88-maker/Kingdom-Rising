// Aeternum Wilds — inventory icons: pictures of the real 3D item models (weapons by type / tier / rarity, armour by
// slot / weight class / tier / rarity, materials and food by id), rendered with a studio light rig by iconbake.js
// and baked to src/gfx/items/icons/<key>.webp (tools/bake-icons.html). The browser loads each file the first time it
// is shown and caches it, so the game never renders or reads back pixels at run time. If a picture is missing or
// fails to load, the <img> replaces itself with the item's emoji.
const BASE = new URL('./icons/', import.meta.url).href;

// gear: { kind: 'weapon', wtype, tier, rarity } or { kind: 'armor', slot, wclass, tier, rarity }
export function gearIconKey(it) {
  const r = Math.max(0, Math.min(4, it.rarity | 0)), t = Math.max(1, Math.min(3, it.tier | 0 || 1));
  return it.kind === 'weapon' ? `w-${it.wtype}-${t}-${r}` : `a-${it.slot}-${it.slot === 'amulet' ? 'x' : it.wclass || 'medium'}-${t}-${r}`;
}
export const matIconKey = (id) => 'm-' + id;
export const iconURL = (key) => BASE + key + '.webp';

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function html(key, emoji, cls) {
  return `<img class="i3d${cls ? ' ' + cls : ''}" src="${iconURL(key)}" alt="" draggable="false" data-e="${escAttr(emoji)}" onerror="this.replaceWith(this.dataset.e)">`;
}
export function gearIconHTML(it, emoji = '', cls = '') { return html(gearIconKey(it), emoji, cls); }
export function matIconHTML(id, emoji = '', cls = '') { return html(matIconKey(id), emoji, cls); }

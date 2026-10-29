import { G } from './state.js';
import { STORY, ENEMIES, ZONES, MATS, xpForLevel, WEAPONS, CLASSES } from './data.js';
import { gainXp } from './stats.js';
import { addItem, addMat, randomDrop, makeGear, lootGs } from './items.js';
import { toast, lootToast, refreshTracker, showVictory } from './ui.js';
import { sfx } from './audio.js';
import { pick, randi } from './util.js';

export function currentStory() { const s = G.p.story; return s.step < STORY.length ? STORY[s.step] : null; }

function objMatchesKill(obj, d) {
  if (obj.kind === 'boss') return d.type === obj.enemy;
  if (obj.kind !== 'kill') return false;
  if (obj.zone && d.zone !== obj.zone) return false;
  return obj.family ? d.family === obj.family : d.type === obj.enemy;
}

export function objProgress(obj, prog) {
  switch (obj.kind) {
    case 'talk': return { done: false, text: 'Speak with Captain Thorne' };
    case 'kill': { const n = prog.n || 0; return { done: n >= obj.n, text: `Slay ${obj.label || plural(ENEMIES[obj.enemy].name)}: ${Math.min(n, obj.n)}/${obj.n}` }; }
    case 'boss': return { done: !!prog.n, text: `Defeat ${ENEMIES[obj.enemy].name}` };
    case 'gather': {
      let done = true; const parts = [];
      for (const id in obj.items) { const n = Math.min(prog[id] || 0, obj.items[id]); if (n < obj.items[id]) done = false; parts.push(`${MATS[id].name} ${n}/${obj.items[id]}`); }
      return { done, text: 'Gather ' + parts.join(', ') };
    }
    case 'craft': { const n = prog.n || 0; return { done: n >= obj.n, text: `Craft gear at the Forge: ${Math.min(n, obj.n)}/${obj.n}` }; }
  }
  return { done: false, text: '' };
}

export function questEvent(kind, d) {
  const s = G.p.story, q = currentStory();
  let changed = false;
  const bump = (obj, prog) => {
    if (kind === 'kill' && objMatchesKill(obj, d)) { prog.n = (prog.n || 0) + 1; return true; }
    if (kind === 'gather' && obj.kind === 'gather' && obj.items[d.id]) { prog[d.id] = (prog[d.id] || 0) + d.n; return true; }
    if (kind === 'craft' && obj.kind === 'craft') { prog.n = (prog.n || 0) + 1; return true; }
    return false;
  };
  if (q && s.state === 'active' && bump(q.obj, s.prog)) {
    changed = true;
    if (objProgress(q.obj, s.prog).done) { s.state = 'complete'; toast(`Quest complete: ${q.title}. Return to Captain Thorne.`, 'gold'); sfx('quest'); }
  }
  for (const b of G.p.bounties) {
    if (b.state !== 'active') continue;
    if (bump(b.obj, b.prog)) {
      changed = true;
      if (objProgress(b.obj, b.prog).done) { b.state = 'complete'; toast(`Bounty complete: turn it in at the Bounty Board.`, 'gold'); sfx('quest'); }
    }
  }
  if (changed) refreshTracker();
}

function giveReward(r) {
  const p = G.p;
  if (r.xp) gainXp(r.xp);
  if (r.coins) { p.coins += r.coins; toast(`+${r.coins} coins`, 'loot'); sfx('coins'); }
  if (r.potions) { addMat('potion', r.potions); toast(`+${r.potions} 🧪 Health Potions`, 'loot'); }
  if (r.secondWeapon) {
    const wt = CLASSES[p.cls]?.second || (p.startWeapon === 'bow' ? 'sword' : 'bow');
    const it = makeGear({ kind: 'weapon', wtype: wt, gs: 100, rarity: 1 });
    if (!p.equip.w2) { p.equip.w2 = it; toast(`Equipped ${it.name} in weapon slot 2. Press 1 and 2 to swap.`, 'gold'); }
    else addItem(it);
  }
  if (r.item) {
    const it = randomDrop(p.level, 0, r.item.rarity);
    it.gs = Math.min(600, it.gs + 15);
    if (addItem(it)) lootToast(it); else toast('Bag full: reward lost!', 'warn');
  }
}

// Talking to Thorne: returns dialog content
export function thorneDialog() {
  const s = G.p.story, q = currentStory();
  if (!q) return { title: 'Captain Thorne', text: '"Aeternum is free of the Corruption, thanks to you. The wilds are still dangerous; keep hunting, crafting and taking bounties as long as you like."', buttons: [] };
  if (q.obj.kind === 'talk' || s.state === 'complete') {
    return {
      title: q.title, text: q.done, buttons: [{
        label: 'Complete quest', fn: () => {
          giveReward(q.reward);
          sfx('quest');
          s.step++; s.state = 'active'; s.prog = {};
          refreshTracker();
          if (q.final) { G.p.won = true; showVictory(); return null; }
          const n = currentStory();
          return n ? { title: n.title, text: n.text, buttons: [] } : null;
        },
      }],
    };
  }
  return { title: q.title, text: q.text + `<p class="obj">${objProgress(q.obj, s.prog).text}</p>`, buttons: [] };
}

// ---------- Bounties ----------
const ZONE_ORDER = ['meadow', 'coast', 'thorn', 'mire', 'ruins'];
function zoneForLevel(lv) {
  let best = 'meadow';
  for (const z of ZONE_ORDER) if (ZONES[z].lv[0] <= lv + 1) best = z;
  return best;
}
export const plural = n => n.endsWith('f') ? n.slice(0, -1) + 'ves' : n + 's';
export function makeBounty() {
  const p = G.p, lv = p.level;
  let obj, title;
  if (Math.random() < 0.6) {
    const z = zoneForLevel(lv);
    const type = pick(ZONES[z].enemies);
    const n = randi(5, 9);
    obj = { kind: 'kill', enemy: type, n, label: plural(ENEMIES[type].name) };
    title = `Hunt: ${plural(ENEMIES[type].name)}`;
    obj.where = ZONES[z].name;
  } else {
    const pool = ['green_wood', 'iron_ore', 'fibers', 'rawhide'];
    if (p.trade.logging.lv >= 8) pool.push('aged_wood');
    if (p.trade.mining.lv >= 8) pool.push('starmetal_ore');
    if (p.trade.harvesting.lv >= 8) pool.push('silkweed');
    if (p.trade.mining.lv >= 18) pool.push('orichalcum_ore');
    const id = pick(pool);
    const n = MATS[id].tier === 1 ? randi(12, 20) : randi(8, 14);
    obj = { kind: 'gather', items: { [id]: n } };
    title = `Supply: ${MATS[id].name}`;
  }
  return { title, obj, prog: {}, state: 'active', reward: { xp: Math.round(xpForLevel(lv) * 0.22), coins: 10 + lv * 4, gear: Math.random() < 0.35 } };
}
export function fillBounties() {
  let tries = 0;
  while (G.p.bounties.length < 3 && tries++ < 50) { const b = makeBounty(); if (!G.p.bounties.some(o => o.title === b.title)) G.p.bounties.push(b); }
}
export function turnInBounty(i) {
  const b = G.p.bounties[i];
  if (!b || b.state !== 'complete') return;
  gainXp(b.reward.xp);
  G.p.coins += b.reward.coins;
  toast(`+${b.reward.coins} coins`, 'loot'); sfx('coins');
  if (b.reward.gear) { const it = randomDrop(G.p.level, 0.5, 1); if (addItem(it)) lootToast(it); }
  G.p.bounties.splice(i, 1);
  fillBounties();
  refreshTracker();
}
export function abandonBounty(i) { G.p.bounties.splice(i, 1); fillBounties(); refreshTracker(); }

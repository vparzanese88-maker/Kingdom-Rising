// The campaign world (the owner's plan): every hero starts as a Warrior, Wizard or Rogue and lands on Goblin Island.
// Each island is ruled by three evil class champions and a leader; beat all four and the island is freed, its three
// classes unlock for new heroes in that campaign, and you can sail on to any other port.
export const CORE_CLASSES = ['warrior', 'wizard', 'rogue'];
export const ISLANDS = [
  { id: 'goblin', name: 'Goblin Island', full: 'Grimtusk Isle', tip: 'Goblin Island: free it to unlock the Musketeer, Bombardier and Blunderbuss', classes: ['musketeer', 'bombardier', 'blunderbuss'], built: true,
    blurb: 'Overrun by goblins and trolls driven mad by a cursed idol. Tribes roam the jungle, and their High Chief rules from the goblin city at its heart.' },
  { id: 'holy', name: 'Holy Kingdom', full: 'Kingdom of Aurelmont', tip: 'Holy Kingdom: free it to unlock the Paladin, Cleric and Priest', classes: ['paladin', 'cleric', 'priest'],
    blurb: 'A shining kingdom with a beautiful white castle, turned cruel by its king.' },
  { id: 'wild', name: 'Wildwood', full: 'The Wildwood', tip: 'Wildwood: free it to unlock the Druid, Ranger and Beastmaster', classes: ['druid', 'ranger', 'beastmaster'],
    blurb: 'An ancient forest whose keepers have turned on every outsider.' },
  { id: 'crypt', name: 'Crypt Isle', full: 'Isle of Graves', tip: 'Crypt Isle: free it to unlock the Necromancer and Shadow Knight', classes: ['necromancer', 'darkknight'],
    blurb: 'A fog-bound isle of tombs where the dead do not stay down.' },
  { id: 'north', name: 'Frozen North', full: 'The Frozen North', tip: 'Frozen North: free it to unlock the Berserker and Shaman', classes: ['berserker', 'shaman'],
    blurb: 'Ice fields and longhalls where war-chiefs rule by the axe.' },
  { id: 'mage', name: 'Mage Towers', full: 'The Spire Isles', tip: 'Mage Towers: free them to unlock the Elementalist, Enchanter and Bard', classes: ['elementalist', 'enchanter', 'bard'],
    blurb: 'Floating towers of mages drunk on forbidden power.' },
];
export const LATER = ['monk']; // (waiting for a later island)
export const islandOfClass = (cls) => ISLANDS.find(i => i.classes.includes(cls)) || null;
// the islands a campaign has freed: any of its heroes freeing one counts for all of them
export function freedIn(chars) { const s = new Set(); for (const c of chars || []) for (const id of c.freed || []) s.add(id); return s; }
export function classOpen(cls, freed) { if (CORE_CLASSES.includes(cls)) return true; const i = islandOfClass(cls); return !!(i && freed && freed.has(i.id)); }
export function lockReason(cls, freed) { if (classOpen(cls, freed)) return null; const i = islandOfClass(cls); return i ? `Free ${i.name} to unlock` : 'Comes with a later island'; }

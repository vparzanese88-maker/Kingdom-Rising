// Shared game state. Every module imports G.
export const G = {
  scene: null, camera: null, renderer: null,
  time: 0, dt: 0, paused: true, started: false,
  player: null,   // runtime player (mesh, hp, etc.)
  p: null,        // persistent profile (saved)
  enemies: [], pets: [], totems: [], traps: [], projectiles: [], nodes: [], corpses: [], npcs: [], stations: [],
  colliders: null,
  input: { keys: {}, lmb: false, rmb: false, mx: 0, my: 0, aimX: 0, aimZ: 0 },
  zone: 'town',
  boss: null,
  ui: { open: null },
};

// each title-screen tab keeps its own hero: Campaign, Kingdom Wars and Multiplayer never share a character
export const SAVE_KEYS = { campaign: 'aeternum-wilds-save-v1', wars: 'kingdom-rising-wars-save-v1', mp: 'kingdom-rising-mp-save-v1' };
// each mode keeps up to 10 heroes: slot 0 uses the original key so older saves stay where they were
export const MAX_CHARS = 10;
export const saveKeyAt = i => (SAVE_KEYS[G.slot] || SAVE_KEYS.campaign) + (i ? `#${i}` : '');
export const saveKey = () => saveKeyAt(G.charIdx || 0);

export function newProfile(weapon, race = 'human', cls = 'knight', look = {}, name = 'Castaway') {
  return {
    v: 1, level: 1, xp: 0, race, cls, look, name,
    attrs: { str: 5, dex: 5, int: 5, con: 5 }, attrPts: 0,
    coins: 30,
    mastery: Object.fromEntries(['sword', 'greataxe', 'hammer', 'bow', 'staff', 'spear', 'club', 'fists', 'rapier', 'hatchets', 'dagger', 'crossbow', 'musket', 'blunderbuss'].map(w => [w, { lv: 1, xp: 0, nodes: [], slots: [null, null, null] }])),
    trade: Object.fromEntries(['logging', 'mining', 'harvesting', 'skinning', 'smithing', 'cooking'].map(t => [t, { lv: 1, xp: 0 }])),
    bag: [], mats: { potion: 3, cooked_meat: 2 },
    equip: { w1: null, w2: null, head: null, chest: null, hands: null, legs: null, feet: null, amulet: null },
    activeW: 0,
    startWeapon: weapon,
    story: { step: 0, state: 'active', prog: {}, base: {} },
    bounties: [],
    food: null,
    stats: { kills: 0, deaths: 0, bosses: 0, crafted: 0, gathered: 0, playTime: 0 },
    pos: null,
    won: false,
    nextId: 1,
  };
}

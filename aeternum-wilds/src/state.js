// Shared game state. Every module imports G.
export const G = {
  scene: null, camera: null, renderer: null,
  time: 0, dt: 0, paused: true, started: false,
  player: null,   // runtime player (mesh, hp, etc.)
  p: null,        // persistent profile (saved)
  enemies: [], pets: [], projectiles: [], nodes: [], corpses: [], npcs: [], stations: [],
  colliders: null,
  input: { keys: {}, lmb: false, rmb: false, mx: 0, my: 0, aimX: 0, aimZ: 0 },
  zone: 'town',
  boss: null,
  ui: { open: null },
};

export const SAVE_KEY = 'aeternum-wilds-save-v1';

export function newProfile(weapon, race = 'human', cls = 'knight', look = {}, name = 'Castaway') {
  return {
    v: 1, level: 1, xp: 0, race, cls, look, name,
    attrs: { str: 5, dex: 5, int: 5, con: 5 }, attrPts: 0,
    coins: 30,
    mastery: Object.fromEntries(['sword', 'greataxe', 'hammer', 'bow', 'staff'].map(w => [w, { lv: 1, xp: 0, nodes: [], slots: [null, null, null] }])),
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

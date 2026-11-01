// Shared runtime state, filled in by main.js
export const G = {
  scene: null, camera: null, renderer: null, player: null, mobs: [], npcs: [], projectiles: [], corpses: [],
  save: null, paused: true, uiOpen: false, time: 0, dt: 0, tod: 0.32, zone: 'coast', inCombat: 0,
  hooks: {}, timers: [], keys: {}, // callbacks: onKill(mob), onLoot, onDamagePlayer...
};

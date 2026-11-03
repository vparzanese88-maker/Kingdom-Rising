// Kingdom Battles town jobs: two quest givers in your town hand out kill and loot jobs.
// Every job finished makes the town stronger for the rest of the match (faster gathering, building, training,
// more gold, harder-hitting towers, tougher walls), which is how a commander out-builds the enemy.
import { G } from './state.js';
import { S } from './audio.js';
import { V } from './vfx.js';

export const GIVERS = {
  hunt: { title: 'Huntmaster', role: 'Hunting jobs', outfit: 'ranger' },
  quarter: { title: 'Quartermaster', role: 'Supply jobs', outfit: 'smith' },
};
// kind kill: kill n of types. kind loot: types drop the item (chance each), bring n.
export const JOBS = [
  { id: 'wolves', giver: 'hunt', name: 'Wolves at the Woodline', kind: 'kill', types: ['wolf', 'frostwolf'], n: 6, where: 'the wolf packs near town',
    text: 'Wolves keep dragging off our woodcutters. Thin out the packs and the crews will work without looking over their shoulders.', mod: { gather: 0.2 }, reward: 'Peasants gather 20% faster', gold: 50 },
  { id: 'powder', giver: 'quarter', name: 'Powder for the Towers', kind: 'loot', item: 'Gunpowder', icon: '💥', types: ['goblin', 'goblin_brute', 'goblin_slinger'], chance: 0.6, n: 6, where: 'goblin camps (look for their campfires and powder kegs)',
    text: 'The goblins hoard black powder in kegs around their campfires. Bring it to me and our towers will shoot with real fire.', mod: { tower: 0.3 }, reward: 'Towers hit 30% harder', gold: 70 },
  { id: 'meat', giver: 'hunt', name: 'Meat for the Barracks', kind: 'kill', types: ['boar', 'bear', 'tiger', 'snowtiger'], n: 7, where: 'boars, bears and big cats in the wilds',
    text: 'A fed army trains faster. Hunt boars, bears and the big cats and the barracks will turn out soldiers twice as quick as the cooks can feed them.', mod: { train: 0.25 }, reward: 'Soldiers train 25% faster', gold: 60 },
  { id: 'scrap', giver: 'quarter', name: 'Scrap Iron', kind: 'loot', item: 'Recycled Metal', icon: '⚙', types: ['bandit', 'bandit_boss'], chance: 0.65, n: 8, where: 'bandit camps (look for scrap piles by their fires)',
    text: 'Bandits strip every wagon they rob and pile the scrap at their camps. Our builders could melt that down for nails, hinges and bands.', mod: { build: 0.3 }, reward: 'Builders work 30% faster · +120 stone', bank: { stone: 120 }, gold: 60 },
  { id: 'trolls', giver: 'hunt', name: 'Troll Bounty', kind: 'kill', types: ['troll', 'troll_king', 'goblin_brute'], n: 4, where: 'trolls and goblin brutes in the far wilds',
    text: 'Brutes and trolls are the only things our walls fear. Bring down four and the masons will learn how to stand against them.', mod: { hall: 0.25 }, reward: 'Town hall and towers take 25% less damage', gold: 120 },
  { id: 'ledger', giver: 'quarter', name: "The Cutthroat's Ledger", kind: 'loot', item: "Bandit Ledger", icon: '📜', types: ['bandit_boss'], chance: 1, n: 1, where: 'Garrick the Cutthroat, a bandit boss (red beacon on the map)',
    text: 'Garrick the Cutthroat keeps a ledger of every stash and every bribed toll-man in these lands. Take it from him and our purse fills itself.', mod: { income: 0.35 }, reward: '+35% gold income · +200 gold', gold: 200 },
  { id: 'cores', giver: 'quarter', name: 'Forge Fire', kind: 'loot', item: 'Ember Core', icon: '🔥', types: ['golem', 'imp', 'ashhound'], chance: 0.5, n: 3, where: 'fire imps, ash hounds and the Magma Golem',
    text: 'An ember core never cools. Three of them in the smithy and our forges will never go out: faster tools, faster hands.', mod: { gather: 0.15, build: 0.2 }, reward: 'Peasants +15% · builders +20% faster', gold: 100 },
  { id: 'kingslayer', giver: 'hunt', name: 'Head of the Troll King', kind: 'kill', types: ['troll_king'], n: 1, where: 'Grumbak the Troll King (red beacon on the map)',
    text: 'Grumbak rules every troll in these hills. Bring me his head and every soldier we have will fight like ten.', mod: { army: 0.15 }, reward: 'All our soldiers deal 15% more damage · +300 gold', gold: 300 },
];
const J = Object.fromEntries(JOBS.map(j => [j.id, j]));
const NOOP = { say() {}, toast() {}, banner() {}, changed() {}, reward() {} };
export const Q = { active: {}, done: [], hooks: NOOP };
export function initQuests(hooks) { Q.hooks = Object.assign({}, NOOP, hooks); Q.active = {}; Q.done = []; }
export function job(id) { return J[id]; }
export function nextFor(giver) { if (Q.active[giver]) return J[Q.active[giver].id]; return JOBS.find(j => j.giver === giver && !Q.done.includes(j.id)) || null; }
export function accept(giver) {
  const j = nextFor(giver); if (!j || Q.active[giver]) return false;
  Q.active[giver] = { id: j.id, have: 0 }; S.click(); S.loot && S.loot();
  Q.hooks.say(giver, `good. ${j.kind === 'kill' ? `Kill ${j.n}: ${j.where}.` : `Bring ${j.n} ${j.item}: ${j.where}.`} Reward: ${j.reward}.`, 'quest');
  Q.hooks.changed && Q.hooks.changed(); return true;
}
export function abandon(giver) { delete Q.active[giver]; Q.hooks.changed && Q.hooks.changed(); }
// a mob died to the local player: count kills and roll loot drops
export function questKill(mob) {
  if (!mob || !mob.type) return;
  for (const giver in Q.active) {
    const a = Q.active[giver], j = J[a.id]; if (!j.types.includes(mob.type)) continue;
    if (j.kind === 'loot') { if (Math.random() > j.chance) continue; a.have++; if (mob.pos) V.number(mob.pos.clone().setY(mob.pos.y + (mob.height || 2) + 1), `+1 ${j.item}`, 'gold'); S.coins(); Q.hooks.toast(`${j.icon} ${j.item} ${Math.min(a.have, j.n)}/${j.n}`); }
    else { a.have++; if (a.have <= j.n) Q.hooks.toast(`☠ ${j.name}: ${Math.min(a.have, j.n)}/${j.n}`); }
    if (a.have >= j.n) finish(giver);
  }
  Q.hooks.changed && Q.hooks.changed();
}
function finish(giver) {
  const a = Q.active[giver], j = J[a.id]; delete Q.active[giver]; Q.done.push(j.id);
  S.levelUp && S.levelUp(); V.addShake(0.15);
  Q.hooks.reward(j);
  Q.hooks.say(giver, `job done, Commander: <b>${j.name}</b>. ${j.reward}!${nextFor(giver) ? ' Come and see me, I have more work.' : ''}`, 'good');
  Q.hooks.banner && Q.hooks.banner(`Job done: ${j.name}`, j.reward);
}
export const activeList = () => Object.entries(Q.active).map(([g, a]) => ({ giver: g, have: a.have, ...J[a.id] }));

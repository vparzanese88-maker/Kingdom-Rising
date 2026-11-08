# Kingdom Arena: class roster design (Paladins / Smite style)

This is a design document only. Nothing here has been built yet. It records what every arena class has today (read
from `src/arena.js`, `src/data.js`, `src/classes2.js`, `src/player.js`, `src/mp.js`, `src/game.js`), what is missing or
doubled up across the roster, and what each class should become so every hero has one clear job, the roster covers
every kind of crowd control, and every ultimate can turn a fight.

## How to read the numbers

- **Ability damage** is written the way the code writes it: a multiple of the class's own weapon hit. `1.0` means one
  basic hit with that class's top-tier weapon. On top of that, every arena hit is scaled by `PVP_K 0.15 x PACE 0.75`
  and the class's `ARENA_TUNE` damage factor. Proposed numbers use the same scale, so they can be typed straight in.
- **Ultimate damage and healing** is written as a share of the target's maximum health (`ultHurt` / `ultHeal`), as the
  current ultimates do.
- **HP** is the class's `hp` from `CLASSES`, times 1.4 for the five classes in `TANK_CLS`, times its `ARENA_TUNE`
  health factor. Tanks also take 15% less damage (`arenaTakenK`).
- **Cooldowns** are the ones the arena really uses after `kitRules()` rewrites them: F heals and HoTs are clamped
  to 15-20 s, drains to at least 8 s, pets (C summons) to 60 s, Q to at least 12 s, right-click defensives to 20-30 s.
- **Crowd control on players**: chained stuns, freezes and slows halve each time within 10 s (`pvpIncoming`,
  and the same rule for bots). Today a **root on a player is turned into a slow** (`hitPlayer`: `root x 1.3` seconds
  of slow), and **mesmerize is just a stun** that does not break on damage.
- **Ultimate charge** rises 1% a second plus 1% per 40 damage dealt or healed, so most ultimates come up every 60 to
  90 s.

---

## Table 1. The roster today

Roles are the current `ROLE` table: Tank, Healer, everything else Damage. RMB = right click. "Block" means the class
holds a shield, so right click blocks and its listed defensive ability cannot be cast at all.

| Class | Role now | HP | LMB | RMB | F | C | Q | Ultimate (R) |
|---|---|---|---|---|---|---|---|---|
| Warrior | Tank | 197 | sword and shield combo | Block (Shield Wall unreachable) | Charge: dash, 1.3, stun 1.2 s, 10 s | Execute: 2.6, x3 below 35%, 10 s | Shield Bash: 1.5, stun 1.5 s, 12 s | War Banner of Defense: 6 m knock + stun 1 s, 12%; 10 m dome 8 s: allies -40% damage taken, +20% damage, regen |
| Berserker | Tank | 189 | great axe cleave + bleed | Undying Rage: cannot drop below 1 HP 6 s, 30 s | Gasp of Rage: heal 15% over 10 s, 20 s | Leap Strike: 14 m leap, 2.6, 7 m stun, 7 s | Intimidating Shout: 9 m AoE stun 2.5 s, 18 s | Bladestorm: 5 s steerable whirl, pull + slow, up to 60%, ends in knock |
| Paladin | Tank | 154 | greatsword + shield | Block (Shield of Light unreachable) | Lay on Hands: self 30%, allies in 8 m 35%, 20 s | Radiant Sweep: cone 5 m, 2.0, knock 8, 8 s | Hammer Strike: 1.9, stun 1.2 s, 12 s | Avenging Wrath: 12 m glyph, 35% slow, core 3 m killed, rest 45% + thrown, allies heal 30% |
| Shadow Knight | Tank | 214 | sword and shield | Block (Bone Guard unreachable) | Shadow Tap: bolt 1.8, drink 80%, 8 s | Raise Skeleton: pet, 60 s | Death Grip: 25 m pull + stun 0.6 s, 0.6, 12 s | Death's Grasp: 6 m pool, chains freeze 1.6 s, drag to you, drain 25% |
| Blunderbuss | Tank | 154 | scattergun | Aim (pointless on a shotgun) | Powder Charge: dash, 1.4, 12 s | Buckshot Blast: cone 10 m, 2.0, knock 6, 7 s | Butt Stroke: 1.6, stun 0.6 s, knock 8, 12 s | Powder Keg Barrage: 5 kegs, 15% each in 4 m, 0.6 s stun, knock |
| Cleric | Healer | 110 | mace and shield | Divine Light: 32% single heal through walls, 6 s | Radiant Heal: self 16%, allies 10 m 25%, 15 s | Prayer of Healing: 45% all in 16 m, 30 s | Holy Smite: bolt 1.7, stun 0.4 s, 12 s | Miracle: one ally full heal + 3 s untouchable, others near heal 50% |
| Druid | Healer | 95 | staff | Living Vine: 20% + HoT 4 s, 5 s | Regrowth: self 35% over 8 s, allies 20%, 15 s | Call of the Bear: pet 40 s, 60 s | Entangle: 7 m AoE stun 1.8 s + slow 4 s, 14 s | Overgrowth: forest across the arena, allies 33% + HoT 15%, enemies tangled + 50% slow |
| Shaman | Healer | 105 | spear | Healing Totem: 36% over 6 s in 6 m, 8 s | Healing Wave: self 20%, allies 12 m 28%, 15 s | Spirit Wolf: pet, 60 s | Hex: frog 4 s (stun), 20 s | Spirit of the Storm: 7 s totem 12 m, allies 10% per pulse, lightning 6% on foes |
| Bard | Healer | 105 | lute (sword) | Mending Chord: 18% + splash, 6 s | Song of Mending: self 30% over 6 s, allies 10 m 25%, 15 s | Crescendo: 7 m nova 2.2, knock 10, 12 s | Mesmerize: single 7 s stun, 18 s | Grand Finale: 6 s, 10 m mez 2.5 s, allies 15 m heal 40% + 30% speed |
| Priest | Healer | 95 | dawn bolt (heals nearby ally 4.5% per hit) | Flash of Dawn: 20% + 4 s shield, 6 s | Halo of Dawn: allies 14 m 25%, self 15%, 15 s | Word of Shielding: team shield 22% 6 s in 12 m, 18 s | Chains of Light: root 2.2 s, 0.6, 13 s | Salvation: 14 m dome 6 s, allies heal 60% and cannot die 3 s, foes slowed + scorched |
| Monk | Damage | 110 | fists combo (stun on 4th) | Tighten the Wraps: break CC, regen 30% 5 s, +30% speed, 24 s | Flying Kick: dash, 1.4, 8 s | Hundred Fists: 12 blows x 0.3, 12 s | Superman Punch: 7.5 m dash, 2.4, stun 1.6 s, knock, 12 s | Thousand Fists: pulls all in 9 m, combo, 50% each |
| Rogue | Damage | 100 | twin daggers | Shadow Step: 7 m behind target + stealth 3 s, 20 s | Envenom: 12 s poison on hits, 16 s | Backstab: 2.8 + bleed, x2 from behind, 6 s | Kidney Shot: 1.1, stun 2 s, 14 s | Assassinate: aim within 30 m, step behind, instant kill |
| Ranger | Damage | 110 (x0.8 dmg) | bow, hold to draw | Aim down the bow | Hunter's Focus: +35% attack speed, +10% crit 8 s, 20 s | Spectral Arrow: pierce 2.6, 4 s | Entangling Vines: root 4 s, 5 m splash, 14 s | Rain of Arrows: 7 m circle, 3 s, about 50% if you stay |
| Musketeer | Damage | 105 | musket, slow reload | Aim down the barrel (+15%) | Quick Reload: half reload, +30% dmg 8 s, 18 s | Grapeshot: cone 10 m, 2.0, knock 10, 8 s | Bolas: root 4 s, 0.3, 14 s | Arcane Barrage: 10 s no-reload rapid fire |
| Wizard | Damage | 95 | staff bolt (arcane bolts home in) | Phase Shift: attacks pass through 2.5 s, 20 s | Blink: 14 m teleport, 8 s | Disintegrate: piercing beam 3.0, 10 s | Temporal Bolt: 1.7, slow 2.5 s, 12 s | Transcendence: 10 s, cooldowns x3 faster, +50% damage |
| Elementalist | Damage | 85 | fire/frost/arcane staff | Ice Shell: -40% damage 10 s, 24 s | Lightning Lash: 1.2, stun 0.3 s, 8 s | Fire Elemental: pet, 60 s | Ice Prison: freeze 3 s, 4 m splash, 16 s | Meteor Storm: 5 meteors, 18% each in 4 m + burn |
| Necromancer | Damage | 85 | poison ball (DoT, splash) | Bone Armour: shield 30% 12 s, 20 s | Soul Rend: drain 1.4, heal 60%, slow 2.5 s, 8 s | Plague Breath: cone poison + Blight, 12 s | Skull of Terror: fear 3 s, 0.5, 14 s | Maw of the Abyss: 10.35 m ring, freeze 1.5 s, slow to 15.6%, demon kills the one nearest the centre |
| Enchanter | Damage | 85 | staff | Rune Shield: shield 35% 12 s, 20 s | Mind Rot: DoT 0.35 x 8 s, weaken, 5 m splash, 12 s | Phantasm: pet copy 25 s, 60 s | Mesmerize: single 5 s stun, 12 s | Mass Charm: 8 m, helpless 3 s, then 20% |
| Beastmaster | Damage | 115 | hand axes | Nature's Embrace: -30% dmg, regen 3%/s 15 s, 30 s | Pack Frenzy: you + allies 12 m attack faster 8 s, 24 s | War Beast (tiger): pet, 60 s | Feral Roar: 7 m AoE stun 1.5 s, 16 s | Call of the Wild: 3 spirit wolves, about 4%/s each for 5 s |
| Bombardier | Damage | 115 (x1.6 dmg) | lobbed bomb, 3 m splash | Smoke Bomb: 6 m scurry + hidden 2.5 s, 20 s | Rocket Boots: dash, 0.8, 9 s | Cluster Bomb: 6 m, 4 ticks of 0.9, 10 s | Sticky Bomb: root 1.8 s, 3 m splash, 12 s | Big Bertha: 3 s fuse, 70% in 3 m, 30% in 9 m, thrown |

---

## Table 2. Role matrix today

`X` = the class has it in its arena kit. `(X)` = it exists but is weak, unreachable, or only on the ultimate.
Ult impact is my rating of how much the ultimate can swing a team fight (1 = barely, 5 = wins the fight).

| Class | Stun | Slow | Root | Knock / pull | Silence / fear / mez | Burst | Ranged | DoT | Team heal | Self-heal | Shield / DR | Mobility | Headshot | Ult impact |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Warrior | X X | | | (X) ult | | X | | | (X) ult regen | | (X) unreachable | X | | 4 |
| Berserker | X X (AoE) | (X) ult | | (X) ult | | X | | (X) axe bleed | | X | X Undying | X | | 4 |
| Paladin | X | (X) ult | | X | | | | | X | X | (X) unreachable | | | 5 |
| Shadow Knight | X | | | X pull | | | X bolt | | | X drain | (X) unreachable | | | 4 |
| Blunderbuss | X | | | X X | | X | X short | | | | | X | | 3 |
| Cleric | X short | | | | | | X bolt | | X X X | X | (X) ult | | | 4 |
| Druid | X AoE | X | (X) | | | | X | | X X | X | | | | 5 |
| Shaman | X hex | | | | | | | | X X | X | | | | 3 |
| Bard | (X) ult | | | X | X mez 7 s | | | | X X | X | | | | 4 |
| Priest | | (X) ult | X | | | | X | | X X | X | X X | | | 5 |
| Monk | X | | | X | | X | | | | X | | X X | | 5 |
| Rogue | X | | | | | X X | | X X | | | | X | | 5 (no counterplay) |
| Ranger | | | X (4 s) | | | X | X | (X) | | | | | none in arena | 3 |
| Musketeer | | | X (4 s) | X | | X | X | | | | | | none in arena | 3 |
| Wizard | | X | | | | X | X | | | | X phase | X | none | 3 |
| Elementalist | X X (AoE 3 s) | | | | | | X | (X) perk | | | X | | none | 3 |
| Necromancer | (X) ult | X | | | X fear | | X | X X | | X | X | | | 5 |
| Enchanter | (X) ult | | | | X mez 5 s | | X | X | | | X | | | 4 |
| Beastmaster | X AoE | | | | | | | (X) perk | | X | X | | | 2 |
| Bombardier | (X) ult | | X | (X) ult | | X | X | X | | | | X X | | 4 |
| **Count with a real tool** | **16** | **4** | **5** (none work on players) | **7** | **3** (fear 1, mez 2, silence 0) | **9** | **13** | **6** | **6** | **11** | **6** reachable | **9** | **0** | |

### Gaps

1. **No headshots in the arena.** The headshot code (`combat.js`, x2) only runs in Kingdom Battles (`G.battleFx`),
   and only against monsters. Ranger, musketeer and the wizard's bolts have no precision reward at all.
2. **Roots do not root players.** `hitPlayer` turns every root into a slow. Five classes' Q (ranger, musketeer, priest,
   bombardier and druid's Overgrowth) do far less against a human than against a bot.
3. **No silence and no team cleanse anywhere.** Smite and Paladins both rely on them. The only cleanse is the monk's
   own Tighten the Wraps.
4. **Slows are rare** (wizard, necromancer, druid). No tank or flank can slow a runner.
5. **Self-sustain missing** in the kit for: Warrior, Ranger, Musketeer, Rogue (Leeching Stab is built but not in the
   kit), Blunderbuss, Bombardier (smoke only), Elementalist and Enchanter (shields only, which is fine), Wizard (Phase
   Shift only, which is fine).
6. **The shield classes lose their defensive.** Warrior (Shield Wall), Paladin (Shield of Light) and Shadow Knight
   (Bone Guard) hold a shield, so right click blocks and their defensive ability is never on a key.
7. **Healers have little mobility.** Cleric, druid, shaman, bard and priest have no movement tool, so divers (monk,
   rogue, berserker) delete them with nothing to answer.
8. **No Flank role.** Monk, rogue, beastmaster and berserker are all divers but are listed as Damage or Tank, so the
   computer fighters play them like front-liners or back-liners.

### Duplicates and excesses

1. **Too many hard stuns, and too many in an area.** 16 of 20 classes stun. Three are big area stuns on short
   cooldowns: Berserker Intimidating Shout (9 m, 2.5 s), Beastmaster Feral Roar (7 m, 1.5 s), Druid Entangle (7 m,
   1.8 s), plus Elementalist Ice Prison (3 s with splash). The warrior has two stuns on F and Q.
2. **Mesmerize lasts far too long and never breaks**: Bard 7 s, Enchanter 5 s, both plain stuns.
3. **Cleric has four heals** (RMB, F, C, ultimate) and one weak attack. Its C (Prayer, 45% team heal) is the same
   button as its F (Radiant Heal), just bigger.
4. **Shaman's Healing Totem** heals 36% to everyone in 6 m every 8 s: almost permanent team healing on a right click.
5. **Pets on C** for five classes (shadow knight, druid, shaman, elementalist, enchanter, beastmaster): a 60 s pet in
   a three-button kit is a whole button that does nothing for a minute. Keep it only where the pet is the identity
   (beastmaster).
6. **Wizard and elementalist are the same class twice** (fragile staff caster, bolt, stun/slow, big area spell).

### Weak and over-strong ultimates

- **Weak (impact 2-3):** Beastmaster Call of the Wild (about 20% per target over 5 s), Musketeer Arcane Barrage (a
  self-buff that depends on aim), Wizard Transcendence (a self-buff with no immediate effect), Ranger Rain of Arrows
  (easy to walk out of), Blunderbuss Powder Keg Barrage (five small scattered blasts), Elementalist Meteor Storm.
- **Over-strong / no counterplay:** Rogue Assassinate is a guaranteed kill on anyone within 30 m, even a full-health
  tank. Every other killing ultimate (paladin core, necromancer demon) can be escaped by moving.

---

## Table 3. Target roster (proposed)

Four roles, as in Paladins: **Tank** (front line: holds space, protects), **Flank** (dives the back line, high
mobility, duels), **Damage** (sustained or burst damage from range), **Support** (heals, shields, cleanse, utility).
Changes from today are in **bold**. Everything not in bold stays as it is.

| Class | Role | Identity in one line | CC it owns | Self-sustain | Ultimate (target) |
|---|---|---|---|---|---|
| Warrior | Tank | The initiator: charges in and holds the line with banner and shield | Stun (charge), **knock-up** | **Shield Wall on block, Second Wind on Execute** | War Banner (+ **cleanse on plant**) |
| Paladin | Tank | The healing wall | Stun (hammer), knockback | Lay on Hands, **Shield of Light on block** | Avenging Wrath (keep) |
| Shadow Knight | Tank | The puller: drags one enemy out of position and drinks them | **Pull** (only one in the roster) | Shadow Tap drain, **Bone Guard on C** | Death's Grasp (keep, + **2 s silence**) |
| Blunderbuss | Tank | The point-blank brawler: shoves everyone away from his team | Knockback (owner) | **Iron Hide on RMB** | **Powder Keg Barrage, stronger** |
| Berserker | **Flank** | The bruiser diver: leaps on the back line and refuses to die | **Slow + weaken** (shout) | Gasp of Rage, Undying | Bladestorm (keep) |
| Monk | **Flank** | The duelist: never where you strike | Stun (Superman), knockback | Tighten the Wraps | Thousand Fists (keep) |
| Rogue | **Flank** | The assassin: kills one back-liner and vanishes | Stun (kidney) | **Leeching Stab on F** | **Assassinate with counterplay** |
| Beastmaster | **Flank** | The hunter with a pet: marks a target and runs it down | **Bleed, short AoE stun** | Nature's Embrace | **Call of the Wild, reworked** |
| Ranger | Damage | The sharpshooter archer, rewarded for headshots | Root (short) | **Headshot heal** | **Rain of Arrows + slow** |
| Musketeer | Damage | The long-range sniper | Root (short), knockback | **Field Bandage** | **Arcane Deadeye** |
| Wizard | Damage | The burst mage: blink in, delete, phase out | Slow (temporal) | Phase Shift | **Transcendence + arrival nova** |
| Elementalist | Damage | The zone mage: burns ground, freezes what stands in it | Freeze (short), **burn DoT** | Ice Shell | **Meteor Storm, stronger** |
| Necromancer | Damage | Damage over time and terror (finished template) | Fear, slow | Soul Rend, Bone Armour | Maw of the Abyss (keep) |
| Bombardier | Damage | Artillery: area burst and traps | Root (sticky) | Smoke Bomb | Big Bertha (keep, **2.5 s fuse**) |
| Enchanter | Damage (control) | The control mage: silences and mesmerizes | **Silence (only one)**, mez | Rune Shield | **Mass Charm: they fight for you** |
| Cleric | Support | The life saver: big single heals and the only team cleanse | Short stun (smite) | Divine Light on self | Miracle (+ **cleanse all nearby**) |
| Priest | Support | The shield support: shields and atonement | Root | Flash of Dawn | Salvation (keep) |
| Druid | Support | Healing over time and roots | **Root** (not stun) + slow | Regrowth | Overgrowth (keep) |
| Shaman | Support | Totems: heal and deny an area | Hex, **slow (Earthbind Totem)** | Healing Wave | Spirit of the Storm (+ **knock and 1 s stun on landing**) |
| Bard | Support | Tempo: speed boosts, knockback peel, short mez | Knockback, **mez 3 s** | Song of Mending | Grand Finale (keep) |

Role counts: 4 Tank, 4 Flank, 7 Damage, 5 Support. For bot logic the tags would be `ROLE = { Tank, Flank, Damage,
Support }`; Enchanter is Damage that plays like a control mage.

## Table 4. Target role matrix

`●` = this class is the main owner of that tool. `X` = has it. Only ●/X cells are real abilities in the kit (not
perks, not ultimates).

| Class | Stun | Slow | Root | Knock / pull | Silence / fear / mez | Cleanse | Burst | Ranged | DoT | Team heal | Self-heal | Shield / DR | Mobility | Headshot | Ult impact |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Warrior | ● | | | X knock-up | | (ult) | X | | | | X | ● | X | | 5 |
| Paladin | X | | | X | | | | | | X | X | X | | | 5 |
| Shadow Knight | X | | | ● pull | (ult silence) | | | X | | | ● drain | X | | | 4 |
| Blunderbuss | X | | | ● knock | | | X | X | | | | X | X | | 4 |
| Berserker | | ● | | | | | X | | X bleed | | X | X | X | | 4 |
| Monk | X | | | X | | self | X | | | | X | | ● | | 5 |
| Rogue | X | | | | | | ● | | X | | X | | X | | 5 |
| Beastmaster | X | | | | | | X | | ● bleed | X buff | X | X | X | | 4 |
| Ranger | | X | X | | | | X | ● | | | X | | X | ● 2x | 4 |
| Musketeer | | | X | X | | | ● | ● | | | X | | X | ● 2x | 5 |
| Wizard | | ● | | | | | ● | X | | | | X | ● | X 1.5x | 4 |
| Elementalist | X freeze | X | | | | | | X | ● burn | | | X | | X 1.5x | 4 |
| Necromancer | | X | | | ● fear | | | X | ● poison | | X | X | | | 5 |
| Bombardier | | | ● | X | | | ● | X | X | | | | X | | 4 |
| Enchanter | | | | | ● silence, mez | | | X | X | | | X | | | 5 |
| Cleric | X short | | | | | ● team | | X | | ● single | X | | | | 5 |
| Priest | | | X | | | | | X | | X | X | ● team | | | 5 |
| Druid | | X | ● | | | | | X | | ● HoT | X | | | | 5 |
| Shaman | X hex | ● | | | | | | | | X | X | | | | 4 |
| Bard | | | | X | X mez | | | | | X | X | | X team speed | | 4 |

What the new matrix fixes: every column has an owner, every class has one self-sustain tool, every precise ranged
weapon has a headshot, no ultimate is below 4, and no ultimate is a guaranteed kill with no way out.

---

## Roster-wide rules (do these first; every class depends on them)

1. **Roots root players.** In `hitPlayer` (`src/arena.js`) pass `o2.root` through as a real root (no moving, no
   dodging; can still aim, shoot and cast) instead of `slow = root x 1.3`. Roots are 1.5-2.0 s in the new kit, so
   they can be this strong. Roots follow the same "halves within 10 s" rule as stuns.
2. **Mesmerize breaks on damage.** After a 0.75 s grace period, any damage ends a mez. Mez lasts 3 s at most.
   Charm (Mass Charm) also breaks on damage after 1.5 s.
3. **Silence** is a new status: cannot use F, C, Q or R; can still move, attack with LMB and dodge. Show "SILENCED"
   over the head and grey out the hotbar. Halves within 10 s like other CC.
4. **Cleanse**: removes stun, root, slow, fear, silence, mez, poison, bleed and burn; gives 1.0 s of CC immunity.
5. **Hard-CC budget**: no single ability stuns more than 1.6 s; no area stun (radius over 4 m) lasts more than 1.0 s;
   ultimates may go to 2.5 s.
6. **Headshots in the arena.** Turn on the `headHit` check for arena shots at bots and online players:
   - Ranger arrows: **2.0x** for a drawn shot (charge above 0.7), **1.5x** for a quick shot, Spectral Arrow **1.75x**.
   - Musketeer ball: **2.0x** (any shot), **2.25x** when sighted (RMB).
   - Wizard: arena arcane bolts stop homing; **1.5x** on LMB bolts, Temporal Bolt and Disintegrate.
   - Elementalist: Lightning Lash and frost bolts **1.5x**.
   - Not for spread or arcing shots (blunderbuss pellets, bombardier bombs, necromancer poison balls, priest
     homing dawn bolts, healers' bolts).
   - Show the existing "Headshot!" number, a short hitstop and a distinct sound.
7. **Shield classes get their defensive on block.** Hold RMB to block as now; **tap F while blocking** is clumsy, so
   instead: the first 0.4 s of a block is a **perfect block** (staggers a melee attacker 0.6 s), and a block held for
   1 s triggers the class's defensive automatically (Shield Wall / Shield of Light / Bone Guard), then goes on its
   cooldown. Simpler alternative: move the defensive onto C for the Shadow Knight (below) and onto the block for the
   other two.
8. **Healing out-put cap**: no support heals more than 35% to one target from a single non-ultimate button; team-wide
   heals cap at 25% per press.
9. **Healers do not out-damage damage classes**: support LMB stays at 0.75-0.85 of a weapon hit (as the priest's
   is), and no support ability deals more than 1.5.

---

## Per-class sections

Each section: what it has now (the numbers are in Table 1), the target, and the Meshy animations to order. "Exists"
means a file is already in `kingdom-rising-2/models/anim/`. Every class already has **walk** and **run** (most are the
monk's walk and run retargeted; the musketeer and necromancer have their own; the blunderbuss's run is its walk played
fast). The monk has a full set. The demon has a scream.

**Every class also needs the same base set** (none exist except the monk's): combat idle, hit reaction (front), hit
reaction (heavy / knocked down and get up), stunned / dizzy loop, death, dodge roll or step, victory pose, and
a backwards walk. These are listed once here and not repeated below.

### Warrior (Tank): the initiator

- **Now:** two stuns (Charge 1.2 s, Shield Bash 1.5 s), one big hit (Execute), no self-heal, and Shield Wall can never
  be cast because right click blocks.
- **Target:**
  - LMB: sword and shield combo, unchanged.
  - RMB: block; held 1 s triggers **Shield Wall** (60% less damage for 4 s, 20 s cooldown).
  - F **Charge**: 12 m dash, 1.3, stun **0.8 s**, 10 s.
  - C **Execute**: 2.6, x3 below 35%, 10 s. **Second Wind**: a hit heals you 8% of your health, a kill 25%.
  - Q **Shield Bash**: 1.5, **knock-up 1.0 s** (lifted off the ground, counts as a stun), 12 s. Two different CC
    shapes now: a charge stun and a knock-up.
  - R **War Banner of Defense**: keep it, and **cleanse every ally in the dome when it lands**. Impact 5: the only
    ultimate that protects the whole team for 8 s.
- **Animations to order:** sword-and-shield 3-hit combo (slash, backhand, overhead), shield block loop + block impact,
  shoulder charge (run-up loop and impact), shield bash upward, overhead execute (wind-up, slam), banner plant
  (lift a pole overhead and drive it into the ground), war cry / roar.

### Paladin (Tank): the healing wall

- **Now:** strong and readable. Lay on Hands (team heal), Radiant Sweep knockback, Hammer stun, Avenging Wrath.
  Shield of Light is unreachable.
- **Target:** keep everything. RMB block; held 1 s triggers **Shield of Light** (absorbs 18% of your health 6 s,
  20 s). Hammer Strike stun **1.0 s**. Ultimate unchanged (impact 5).
- **Animations to order:** greatsword 3-hit combo, shield block, two-handed upward cast with a glow (Lay on Hands),
  wide horizontal sweep (Radiant Sweep), overhead hammer smash, ultimate: arms spread / wings-open pose, then sword
  raised to the sky and pointing down.

### Shadow Knight (Tank): the puller

- **Now:** Death Grip (pull + 0.6 s stun) is unique and good. Shadow Tap drinks 80% of 1.8. The C pet (one skeleton)
  is a weak button in a three-button kit; Bone Guard is unreachable.
- **Target:**
  - F **Shadow Tap**: unchanged (8 s).
  - C **Bone Guard** (replaces Raise Skeleton): absorbs 25% of your health for 6 s, and enemies who hit you in melee
    are slowed 25% for 1 s. 18 s.
  - Q **Death Grip**: pull from 25 m, stun 0.6 s, 0.6, 12 s.
  - R **Death's Grasp**: keep, and the chained enemies are **silenced 2 s** after they are dropped. Impact 4.
- **Animations to order:** heavy one-handed combo with shield, reaching-claw cast (Death Grip: arm thrust out, then
  yanked back), dark bolt throw from the palm (Shadow Tap), bone armour self-cast (arms crossed over chest, then
  flung out), ultimate: both fists slammed to the ground, then a dragging pull with both hands.

### Blunderbuss (Tank): the point-blank brawler

- **Now:** good knockback tools and a dash, but RMB "aim" is useless on a shotgun and he has no self-sustain. His
  ultimate is five small scattered blasts.
- **Target:**
  - RMB **Iron Hide** (replaces aim): absorbs 25% of your health for 5 s and you cannot be knocked back. 20 s.
  - F **Powder Charge**: unchanged (dash, 1.4, 12 s), and it knocks aside anyone it passes through.
  - C **Buckshot Blast**: unchanged (cone 10 m, 2.0, knock 6, 7 s).
  - Q **Butt Stroke**: 1.6, stun 0.6 s, knock 8, 12 s.
  - R **Powder Keg Barrage** (stronger): five kegs land in a tight cross 3 m apart over 1.2 s; each blast **20%** in
    4 m, knocks back and stuns 0.8 s; standing in the overlap takes two or three. Impact 4: splits a grouped team.
- **Animations to order:** shotgun hip-fire with heavy recoil (two variants), pump / reload, rifle-butt smash forward,
  bracing crouch (Iron Hide), blast-propelled forward lunge, overhead two-hand keg throw (ultimate), a real run
  (today it plays the walk faster).

### Berserker (Flank): the bruiser diver

- **Now:** listed as a Tank. Leap Strike (stun) and Intimidating Shout (9 m, 2.5 s area stun) together are the
  biggest stun package in the game.
- **Target:**
  - Role becomes **Flank** (keeps the 1.4 health bonus at 1.2 instead, since he dives).
  - RMB **Undying Rage**: unchanged.
  - F **Gasp of Rage**: unchanged.
  - C **Leap Strike**: 14 m leap, 2.6, landing **staggers 0.5 s** in 5 m (not a full stun). 9 s.
  - Q **Intimidating Shout** (reworked): enemies within 8 m are **slowed 35% and deal 25% less damage for 4 s**.
    16 s. He becomes the roster's main slow.
  - R **Bladestorm**: unchanged (impact 4).
- **Animations to order:** great-axe 2-hit combo (heavy horizontal, overhead chop), dual-axe combo, jump attack
  (leap, airborne, ground slam), roar with chest out (shout), spinning two-axe whirlwind loop (ultimate), heavy
  breath / catch-breath (Gasp of Rage), rage power-up flex (Undying).

### Monk (Flank): the duelist

- **Now:** the most complete class: two dashes, a stun, a flurry, a CC-break self-heal, a pull ultimate. Listed as
  Damage.
- **Target:** keep the kit. Role **Flank**. Superman Punch stun **1.2 s** (from 1.6). Nothing else changes.
- **Animations (exist):** monk2_punchA, punchB, attack, double, charged, counter, thrust, jump, dodge, stance, dead,
  cheer (all in use); monk2_cast1, monk2_cast2, monk2_taunt and the older monk_doublekick, flykick, flystrike,
  jumppunch, kick, lungeround, punch1, punch2, risekick, roundhouse, spinkick, sweep exist but are **not used yet**.
- **Use what exists:** monk2_cast2 for Tighten the Wraps, monk2_taunt for the round-start / victory, monk_spinkick and
  monk_roundhouse inside the Thousand Fists ultimate, monk_flykick for Flying Kick (if it reads better than the jump
  slice).
- **To order:** hit reaction and get-up only.

### Rogue (Flank): the assassin

- **Now:** big burst (Backstab 2.8, x2 from behind), stun, Shadow Step, but no self-heal in the kit (Leeching Stab is
  built in `ARENA_NEW` and unused), and an ultimate that is a guaranteed kill.
- **Target:**
  - RMB **Shadow Step**: unchanged.
  - F **Leeching Stab** (replaces Envenom): 1.3, regenerate 30% over 6 s, 10 s. **Envenom becomes a passive**: every
    third dagger hit poisons (0.15 a second for 4 s).
  - C **Backstab**: unchanged.
  - Q **Kidney Shot**: stun **1.5 s**, 14 s.
  - R **Assassinate** (with counterplay): a 0.5 s shadow mark appears over the victim first (they hear a whisper and
    can dodge or blink to break it). Then the rogue steps behind them: a target **below 50% health dies**; anyone
    else takes **45% of their health and is silenced 2 s**. The rogue is invisible for 2 s after. Impact 5.
- **Animations to order:** twin-dagger 4-hit combo, stab from behind (two-hand downward thrust), crouched sneak walk
  (stealth), quick low jab (Kidney Shot), shadow-step burst (crouch and vanish), ultimate: grab from behind and
  stab.

### Beastmaster (Flank): the hunter with a pet

- **Now:** a team attack-speed buff, a 60 s pet, an area stun, a strong self-heal, and the weakest ultimate in the
  game (about 20% per target over 5 s). No mobility.
- **Target:**
  - RMB **Nature's Embrace**: 30% less damage and 3% regen a second for **8 s** (from 15), 30 s.
  - F **Pounce** (replaces Pack Frenzy, which becomes a passive aura: allies within 9 m attack 10% faster): leap
    12 m onto an enemy, 1.5, and **mark** them: they bleed 0.2 a second for 5 s and your pet goes for them. 10 s.
  - C **War Beast**: unchanged (tiger, 60 s). The pet is this class's identity, so it stays.
  - Q **Feral Roar**: 6 m, stun **1.0 s**, 16 s.
  - R **Call of the Wild** (reworked): three spirit wolves burst out and each **pounces on a different enemy within
    20 m, knocks them down (stun 1.0 s)** and mauls them for **6% of their health a second for 5 s**; while the
    wolves live the beastmaster heals 30% of the damage they deal. Kill the beastmaster to end it. Impact 4.
- **Animations to order:** dual hand-axe combo, leap attack onto a target (Pounce), beast roar (Feral Roar),
  whistle / command point (sending the pet), howl to the sky (ultimate), kneel and breathe green light (Nature's
  Embrace).

### Ranger (Damage): the sharpshooter

- **Now:** bow with draw, Hunter's Focus (a stat buff), Spectral Arrow, a 4 s area root. No headshots in the arena, no
  mobility, no self-heal. Damage is tuned down to 0.8.
- **Target:**
  - LMB: bow; **headshot 2.0x drawn, 1.5x quick**. **A headshot heals you 5% of your health** (self-sustain that
    rewards skill).
  - RMB: aim (unchanged).
  - F **Disengage** (replaces Hunter's Focus, which becomes the perk tree's attack-speed passive): backflip 9 m
    away from where you face, and leave a snare where you stood that slows the first enemy across it 40% for 2 s.
    10 s.
  - C **Spectral Arrow**: pierce 2.6, headshot 1.75x, **6 s** (from 4).
  - Q **Entangling Vines**: root **1.8 s** (from 4), 4 m splash, 13 s.
  - R **Rain of Arrows**: as now, plus everyone under the shadow is **slowed 40%** for as long as they stand there,
    and the circle grows to 8 m. Impact 4: it now holds a choke point.
- **Animations to order:** bow draw-and-hold loop, release (quick and full), bow fire while walking (upper body),
  backflip (Disengage), arrow nocked and fired straight up (ultimate), crouched aim idle, quiver reach.

### Musketeer (Damage): the long-range sniper

- **Now:** hard-hitting slow musket, a damage buff, a knockback cone and a 4 s root. No headshots, no self-heal, no
  mobility, and an ultimate that is a self-buff.
- **Target:**
  - LMB: musket; **headshot 2.0x, 2.25x when sighted**.
  - RMB: aim (unchanged).
  - F **Field Bandage** (replaces Quick Reload): heal 22% over 3 s and the musket is reloaded at once. 15 s.
  - C **Grapeshot**: unchanged (cone 10 m, 2.0, knock 10), and the recoil **hurls you 6 m backwards** (her
    mobility). 9 s.
  - Q **Bolas**: root **1.5 s** (from 4), 14 s.
  - R **Arcane Deadeye** (replaces Arcane Barrage; keeps its glowing arcane ball): for 1.5 s she raises the musket and
    every enemy in front of her within 60 m and in her line of sight gets a shrinking arcane target; then one shot
    fires at each, **45% of their health** (70% if they are below half). Breaking line of sight before it fires
    saves you. Impact 5.
- **Animations to order:** musket shoulder-fire with recoil, sighted aim loop and fire, ramrod reload, hip-fire
  recoil hop backwards (Grapeshot), bolas twirl and throw, wrap a bandage on the arm (Field Bandage), ultimate:
  long steady aim, then a slow pan across targets.

### Wizard (Damage): the burst mage

- **Now:** good kit (Blink, Disintegrate, Temporal Bolt slow, Phase Shift). Arcane bolts home in, so no skill shot;
  the ultimate is a self-buff with no immediate effect.
- **Target:**
  - LMB: staff bolts **stop homing in the arena** and gain **headshot 1.5x**.
  - RMB **Phase Shift**: unchanged (his defensive).
  - F **Blink**: unchanged.
  - C **Disintegrate**: 3.0 piercing beam, headshot 1.5x, 10 s.
  - Q **Temporal Bolt**: 1.7, slow **40% for 2.5 s**, headshot 1.5x, 12 s.
  - R **Transcendence**: as now (10 s, x3 cooldowns, +50% damage), and on cast he **rises in an arcane nova: every
    enemy within 8 m takes 20% and is lifted for 1.2 s**. Impact 4: it opens the fight as well as winning the next
    10 s.
- **Animations to order:** one-hand staff cast (bolt), two-hand beam channel loop (Disintegrate), quick snap cast
  (Temporal Bolt), blink (crouch and vanish / appear), phase pose, ultimate: levitate with arms open (loop).

### Elementalist (Damage): the zone mage

- **Now:** a second wizard: fast bolt with a micro-stun, a 60 s fire pet, a 3 s area freeze, Ice Shell. Meteor Storm
  is five medium hits.
- **Target:**
  - LMB: staff element; frost bolts and Lightning Lash **headshot 1.5x**.
  - RMB **Ice Shell**: unchanged.
  - F **Lightning Lash**: 1.2, stun 0.3 s, 8 s.
  - C **Firestorm** (replaces the fire elemental): a 6 m circle of burning ground where you aim for 5 s, **0.35 a
    second** and burning 3 s after you leave. 12 s. He owns burn damage over time and area denial.
  - Q **Ice Prison**: freeze **1.5 s** (from 3), 3 m splash, 16 s. Freezing someone standing in your Firestorm makes
    them take the burn while they cannot leave: his combo.
  - R **Meteor Storm** (stronger): five meteors over 3 s, **22%** each in 4 m, the first one at the centre **stuns
    1.0 s**, every impact leaves burning ground. Impact 4.
- **Animations to order:** two-hand fire throw, whip-crack lightning cast, frost bolt push, ground-target cast
  (palm slammed down), ice-shell self-cast, ultimate: both arms raised calling the sky, then pulled down.

### Necromancer (Damage): damage over time and terror

- **Now:** finished; the template for every other class (see `docs/ULTIMATES.md`). Poison balls, Soul Rend drain +
  slow, Plague Breath + Blight, fear skull, Bone Armour, Maw of the Abyss.
- **Target:** keep. Nothing changes.
- **Animations to order:** poison-ball throw from the right hand, raise the shrunken head and drink (Soul Rend), the
  head held out in front spraying (Plague Breath), skull throw (overhand), bone-armour self-cast, ultimate: both
  hands slowly raised (loop). Exists: necro_walk, necro_run, demon_scream (for the demon).

### Bombardier (Damage): artillery

- **Now:** good identity (lobbed bombs, Rocket Boots, Cluster Bomb, Sticky Bomb root, Smoke Bomb, Big Bertha).
- **Target:** keep. Sticky Bomb root 1.8 s (it now really roots players). Big Bertha fuse **2.5 s** (from 3) so a
  slow class caught at the centre cannot always walk out. Impact 4.
- **Animations to order:** underarm bomb lob, overhand throw, rocket-boot dash (leaning forward), smoke bomb drop and
  scurry, two-hand heave of a huge bomb (ultimate), goblin cackle (victory).

### Enchanter (Damage, control): the control mage

- **Now:** Mind Rot DoT, a 60 s phantasm pet, a 5 s mesmerize that does not break, Rune Shield, Mass Charm.
- **Target:**
  - RMB **Rune Shield**: absorbs 35% of your health 8 s; **can be cast on an ally under your crosshair**.
  - F **Mind Rot**: unchanged (DoT 0.35 for 8 s, weaken, 5 m splash).
  - C **Mind Lock** (replaces Phantasm): a bolt that **silences** the enemy and anyone within 3 m for **2 s**, 0.8.
    14 s. The only silence in the roster.
  - Q **Mesmerize**: **3 s**, breaks on damage after 0.75 s, 12 s.
  - R **Mass Charm** (stronger): 8 m spiral; every enemy inside is charmed for 3 s and **walks toward and attacks
    their own nearest ally** (bots: switch team for 3 s; players: forced to walk to and auto-attack their nearest
    ally); then minds shatter for 20%. Damage after 1.5 s breaks it. Impact 5.
- **Animations to order:** hypnotic two-hand weave cast (loop), one-hand flick bolt (Mind Lock), finger-to-temple
  cast (Mind Rot), rune draw in the air (Rune Shield), ultimate: both arms spiralling overhead.

### Cleric (Support): the life saver

- **Now:** four heals (RMB 32%, F 25% team, C 45% team, ultimate), one weak bolt.
- **Target:**
  - RMB **Divine Light**: 30% single heal through walls, 6 s (the strongest single heal stays his).
  - F **Radiant Heal**: allies in 10 m 22%, you 16%, 15 s.
  - C **Purifying Light** (replaces Prayer of Healing): **cleanse** every ally within 12 m and give them 1 s of CC
    immunity; heals 10%. 22 s.
  - Q **Holy Smite**: 1.4, stun 0.4 s (an interrupt), 12 s.
  - R **Miracle**: as now, and **everyone within 8 m of the target is cleansed** too. Impact 5.
- **Animations to order:** mace-and-shield combo, one-hand beam cast toward an ally (loop), two-hand raise to the sky
  (Radiant Heal), palm pushed forward (Holy Smite), praying kneel then rising arms (Purifying Light), ultimate:
  arms spread looking up.

### Priest (Support): the shield support

- **Now:** a clear identity: atonement bolt, Flash of Dawn (heal + shield), Halo (team heal), Word of Shielding (team
  shield), Chains of Light root, Salvation.
- **Target:** keep. Chains of Light root 2.0 s (it now really roots players). Impact 5.
- **Animations to order:** staff bolt cast, one-hand flash toward an ally, staff planted with a ring burst (Halo),
  spoken-word gesture with an open palm (Word of Shielding), staff pointed down at a target (Chains), ultimate:
  levitate with wings and arms open.

### Druid (Support): healing over time and roots

- **Now:** Living Vine, Regrowth, a 60 s bear, Entangle (7 m area stun 1.8 s + slow), Overgrowth.
- **Target:**
  - RMB **Living Vine**: unchanged.
  - F **Regrowth**: unchanged.
  - C **Call of the Bear**: keep the bear (40 s, 60 s), or swap for **Thorn Wall** (a 6 m wall of thorns that blocks
    movement for 4 s, 18 s) if pets in the arena are cut. Thorn Wall is the stronger design.
  - Q **Entangle**: 6 m, **root 1.5 s** (not a stun) then slow 30% for 2 s, 14 s.
  - R **Overgrowth**: unchanged (impact 5).
- **Animations to order:** staff swing (2 hits), stream-of-leaves channel toward an ally, staff spun overhead (Regrowth),
  staff driven into the ground (Entangle, Overgrowth), call-the-beast gesture (bear).

### Shaman (Support): totems

- **Now:** Healing Totem on RMB every 8 s (36% to everyone in 6 m: too strong), Healing Wave, Spirit Wolf pet, Hex.
- **Target:**
  - RMB **Healing Totem**: 30% over 6 s in 6 m, **14 s** cooldown.
  - F **Healing Wave**: allies in 12 m 22%, you 20%, 15 s.
  - C **Earthbind Totem** (replaces Spirit Wolf; `sh_earthbind` is already in the shaman's tree): a totem where you aim
    that **slows every enemy within 8 m by 40%** for 6 s. 18 s. One of the roster's main slows.
  - Q **Hex**: frog 2.5 s (from 4), 18 s.
  - R **Spirit of the Storm**: as now, and the totem's landing **throws enemies within 4 m back and stuns them 1 s**.
    Impact 4.
- **Animations to order:** spear 3-hit combo, totem throw (overarm), wave push with both hands, hex point (curse
  gesture), ultimate: spear raised, lightning called down.

### Bard (Support): tempo

- **Now:** Mending Chord, Song of Mending, Crescendo knockback, a 7 s mesmerize, Grand Finale.
- **Target:**
  - RMB **Mending Chord**: unchanged.
  - F **Song of Mending**: as now, and allies healed also **move 20% faster for 3 s**.
  - C **Crescendo**: 7 m, **1.4** (from 2.2, a support should not out-damage), knock 10, 12 s.
  - Q **Mesmerize**: **3 s**, breaks on damage after 0.75 s, 16 s.
  - R **Grand Finale**: unchanged (impact 4).
- **Animations to order:** lute strum loop (standing and walking), lute swing as a melee hit, big final-chord strum
  with a jump (Crescendo), playing to one target (Mesmerize), ultimate: soaring solo with the lute raised high.

---

## Table 5. Animation orders at a glance

| Class | Already have | Order (most important first) |
|---|---|---|
| All 19 non-monk classes | walk, run (retargeted monk) | combat idle, hit react, knocked down + get up, stunned loop, death, dodge, victory |
| Warrior | warr_walk, warr_run | sword-and-shield combo, block, shoulder charge, shield bash up, overhead execute, banner plant, war cry |
| Paladin | pal_walk, pal_run | greatsword combo, block, two-hand glow cast, wide sweep, hammer smash, wings-open ultimate pose |
| Shadow Knight | dk_walk, dk_run | one-hand combo + shield, grip-and-yank, palm bolt, self-armour cast, ground slam + drag |
| Blunderbuss | bb_walk (run is the walk sped up) | **real run**, shotgun recoil fire, reload, butt smash, brace, blast lunge, keg throw |
| Berserker | bers_walk, bers_run | great-axe combo, dual-axe combo, jump attack, roar, whirlwind loop, catch-breath |
| Monk | full set (see section); cast1, cast2, taunt and 12 older kicks unused | hit react + get-up only; wire up cast2, taunt, spinkick, roundhouse |
| Rogue | rogue_walk, rogue_run | dagger 4-hit combo, backstab, sneak walk, low jab, vanish, grab-and-stab |
| Beastmaster | beast_walk, beast_run | hand-axe combo, pounce leap, roar, command point, howl, kneel heal |
| Ranger | rang_walk, rang_run | draw-hold loop, release, fire while walking, backflip, sky shot, aim idle |
| Musketeer | musk_walk, musk_run (own) | shoulder fire, sighted aim + fire, ramrod reload, recoil hop, bolas throw, bandage |
| Wizard | wiz_walk, wiz_run | one-hand cast, beam channel, snap cast, blink, phase pose, levitate loop |
| Elementalist | ele_walk, ele_run | fire throw, lightning whip, frost push, palm-down ground cast, sky-call |
| Necromancer | necro_walk, necro_run (own); demon_scream | poison throw, head-drink, head-spray, skull throw, armour cast, hands-raise loop |
| Bombardier | bomb_walk, bomb_run | underarm lob, overhand throw, rocket dash, smoke drop, big heave, cackle |
| Enchanter | ench_walk, ench_run | weave loop, flick bolt, temple cast, air rune, spiral overhead |
| Cleric | cleric_walk, cleric_run | mace combo, ally beam, sky raise, palm push, kneel-and-rise, arms-spread ultimate |
| Priest | priest_walk, priest_run | staff cast, ally flash, staff plant, open-palm word, point-down, levitate |
| Druid | druid_walk, druid_run | staff combo, leaf channel, staff spin, staff into ground, beast call |
| Shaman | sham_walk, sham_run | spear combo, totem throw, wave push, hex point, lightning call |
| Bard | bard_walk, bard_run | strum loop (stand + walk), lute melee, jump chord, single-target play, solo raised |

When ordering from Meshy: ask for the animations on each class's own rig (the `*_rig.fbx` in `models/`), in place
(no root motion) except dashes, leaps, dodges and the backflip, which should keep their root motion so the code can
slice them the way the monk's moves are sliced in `src/heromodels.js`.

---

## The ten most important changes, ranked

1. **Roots really root players, mesmerize breaks on damage, and the hard-CC budget** (rules 1, 2 and 5). Without
   this, five Q abilities are slows and two mesmerizes are 5-7 s stuns.
2. **Headshots in the arena** for ranger (2x / 1.5x), musketeer (2x, 2.25x sighted), wizard and elementalist bolts
   (1.5x), with the wizard's bolts no longer homing.
3. **Cut the area-stun pile-up**: Berserker Shout becomes a slow and weaken, Bard mesmerize 7 s to 3 s, Enchanter 5 s
   to 3 s, Elementalist Ice Prison 3 s to 1.5 s, Druid Entangle becomes a root, Beastmaster Roar 1.5 s to 1.0 s.
4. **Self-sustain for everyone**: Warrior Second Wind on Execute, Rogue Leeching Stab on F, Ranger headshot heal,
   Musketeer Field Bandage, Blunderbuss Iron Hide.
5. **The shield classes get their defensive back** (Shield Wall, Shield of Light on block; Bone Guard on the Shadow
   Knight's C).
6. **Add the missing tools**: team cleanse (Cleric Purifying Light, replacing the duplicate Prayer) and silence
   (Enchanter Mind Lock, replacing Phantasm).
7. **Rework the weak ultimates**: Beastmaster Call of the Wild, Musketeer Arcane Deadeye, Wizard Transcendence nova,
   Ranger Rain slow, Blunderbuss kegs, Elementalist meteors.
8. **Give Assassinate counterplay**: a 0.5 s mark first; kills only below 50%, otherwise 45% and a 2 s silence.
9. **Four roles (Tank, Flank, Damage, Support)**: Berserker, Monk, Rogue and Beastmaster become Flank; update `ROLE`,
   `TANK_CLS` and the bots' targeting so flankers dive the back line and supports peel.
10. **Mobility and heal tuning**: Ranger Disengage, Musketeer Grapeshot recoil hop, Beastmaster Pounce; Shaman totem
    cooldown 8 s to 14 s, Cleric single-button heal caps, Bard Crescendo 2.2 to 1.4.

# Kingdom Arena: ultimates, abilities and how we tune them

This is the record of how each class's kit is designed, built and tested. The necromancer is finished and is
the template; every other class goes through the same steps.

## The process (one class at a time)

1. **Design the kit.** LMB (hold = auto-fire), RMB (defensive or aim), F, C, Q, and the ultimate on R.
   Write down what each does, what it looks like, and what the caster and the victim see.
2. **Build the visuals.** The caster's look (body, weapon or held item, first-person hands), each ability's
   effect, and the ultimate's full sequence. An ultimate lasts several seconds and is dramatic:
   - the caster plays a cast pose and cannot be hurt while the ultimate plays;
   - the caster's camera can fly out to watch the ultimate (the necromancer's does), then flies back;
   - anyone caught gets a cinematic third-person view (letterbox bars, HUD hidden) and the death screen waits
     until it ends.
3. **Add it to the Training Yard theatre.** U in the yard opens "Get hit by an ultimate"; every class must have its
   real ultimate there (the necromancer's is the real one; the others are staged sequences in `src/yardults.js`
   until each class is redone).
4. **Escape test.** Decide who should be able to get away, then run `tools/ulttest.cjs` and tune numbers (freeze,
   slow, radius, timing) until the results match. Report who made it and who didn't.
5. **Ship.** `python3 kingdom-rising-2/tools/stamp.py`, commit, push the branch and `main`.

## Ground rules (agreed)

- **Escape abilities count.** Some classes have an ability that can get them out (the wizard's Blink, say). That is fine:
  they have to use it, and it has to be off cooldown. Tests run with and without it (`--use KeyF`, `--use RMB`).
- **Test player:** tuned for a human reacting in 0.2 s (`--lag 0.2`); frame-perfect results are noted where they differ.
- **Counterplay:** each ultimate gets its own way to survive it (get out of the ring, get off the glyph, break line of
  sight...). Area ultimates are tuned so that from dead centre only the leap dodge, or an escape ability, gets you out.
- **Camera:** every ultimate's caster gets a fly-out camera and cannot be hurt while it plays; whoever is hit gets the
  victim cinematic.

## Shared building blocks (src/arena.js)

`ultFoes`, `ultFriends`, `ultHurt` (a fraction of max health), `ultHeal`, `ultKill`, `ultSlow`, `ultGround`,
`ultFlyCam` (caster camera), `ultVictimCine` (victim camera). Ability visuals for players and bots live in
`src/abilityfx.js`, one entry per ability id.

## Dodges (the yardstick for every escape test)

From `src/player.js` (`DODGES`, `DODGE_OF`). In the arena a dodge costs a third of your endurance (three in a
row from full), and endurance comes back twice as fast as in the campaign.

| Dodge | Classes | Length | Speed |
|---|---|---|---|
| step | warrior, paladin, shadow knight, cleric | 0.34 s | 11 |
| roll | berserker, musketeer, blunderbuss, wizard, elementalist, enchanter, necromancer, shaman, druid, bard | 0.62 s | 10.5 |
| leap | monk, rogue, ranger, beastmaster | 0.75 s | 12.5 |

## Necromancer (done)

- **Look:** no staff. A shrunken head held by its braided ponytail in the left fist (swings as he moves; three-quarter
  face in first person), a green flame in the empty right hand, burning green eyes, a ring of skulls round the waist.
- **LMB:** poison bolts from the right hand. Hold to keep firing. No auto-aim.
- **F, Soul Rend:** raises the shrunken head; green soul-water flows from the enemy you aim at into its mouth;
  heals you and slows them.
- **C, Plague Breath:** the head's mouth sprays poison in a cone; damage over time and Blight (poisoned enemies take
  more poison damage).
- **Q, Fear skull:** a skull three times the normal size.
- **R, Maw of the Abyss (ultimate),** code in `summonDemon()` in `src/arena.js`, demon model in `makeDemon()` and the
  fire ring in `makeHellRing()` in `src/arenalooks.js`:
  - cast on the ground where you aim (no target needed);
  - a full ring of green hellfire, radius **10.35 m** (`RR`), bursts up with a cracked glowing floor;
  - everyone inside when it bursts up is **frozen for 1.5 s** (`FRZ`) and cannot be hurt during the freeze
    (players: no moving, jumping, attacking, dodging or abilities);
  - while the demon rises, everyone inside is slowed to **15.6% speed** (only this ring; other slows are 55%);
  - a skeletal demon (horned skull, green fire in its sockets and throat, ribcage round a burning heart, ooze-covered
    clawed hands) claws its way out from 1.0 s to 2.9 s and roars;
  - at **3.0 s** (`GRAB`) it seizes whoever is still inside the ring and closest to the centre: turns to face them,
    leans right over, snatches them, flips them upside down by the ankle, dangles them over its upturned jaws (head
    thrown far back) and lowers them in head first at **5.8 s** (`BITE`), then sinks away as the fire dies;
  - if everyone got out, it makes a full slow turn hunting and grabs anyone who wanders back into the ring;
  - the caster raises both hands slowly with green ooze dripping, is immune, and the camera flies out to watch;
  - the victim sees it in a third-person cinematic.

### Necromancer escape test (freeze 1.5 s)

Run with `node kingdom-rising-2/tools/ulttest.cjs` (see the top of that file for options).
"Frame-perfect" dodges the instant it is allowed; "0.2 s reaction" waits 0.2 s after the freeze and after each dodge.

| Start | Reaction | Step (warrior) | Roll (berserker) | Leap (monk) |
|---|---|---|---|---|
| dead centre | frame-perfect | caught, 7.2 m | escaped 2.71 s | escaped 2.31 s |
| dead centre | 0.2 s | caught, 8.0 m | escaped 3.00 s (just) | escaped 2.38 s |
| 25% off (2.59 m) | frame-perfect | caught, 9.8 m | escaped 2.34 s | escaped 1.98 s |
| 25% off (2.59 m) | 0.2 s | escaped 2.90 s | escaped 2.34 s | escaped 2.11 s |

Earlier freeze lengths (older test with a coarse ~0.07 s reaction):

- 1.0 s, dead centre: step caught; roll and leap escaped.
- 1.25 s, dead centre: only leap escaped.
- 1.65 s, 25% off centre: only leap escaped; from dead centre nobody did.

### Escape abilities against the necro ring (1.5 s freeze, 0.2 s reaction, dead centre)

| Class and ability | Result |
|---|---|
| Wizard, F Blink | escaped 2.05 s |
| Monk, F Flying Kick | escaped 2.84 s |
| Rogue, right-click Shadow Step | escaped 2.18 s |
| Wizard, right-click Phase Shift | caught |
| Berserker, right-click Undying | caught |
| Warrior, right-click Shield Wall | caught |

## Paladin (ultimate and ability visuals done)

- **R, Avenging Wrath:** `paladinWrath()` in `src/arena.js` (numbers in `WRATH`), sword, glyph and wings in
  `src/arenalooks.js`.
  - Golden wings bloom; he raises his sword, cannot be hurt, and his camera flies out.
  - A 12 m glyph of runes burns in where he aims with a pillar of light; enemies on it move at 35% speed.
  - A giant sword of light forms 40 m up, turns, and falls faster and faster; it lands at 2.3 s: burning cross of
    light, shockwave, stone and gold.
  - Within 3 m of the centre: impaled (pinned for 0.9 s, then killed). Rest of the glyph: 45% of max health and
    thrown up. Allies on the glyph heal 30%.
  - The sword stays in the ground glowing, then dissolves upward.
- **F, Lay on Hands:** a shaft of light pours down, the hands blaze gold, a ring of light spreads out.
- **C, Radiant Sweep:** a crescent of holy light across the front of the swing.
- **Q, Hammer Strike:** a spectral golden hammer slams down on the target.
- **Shield of Light:** a golden dome that holds while the shield lasts and shatters. Note: on the paladin, right
  click blocks with the shield, so Shield of Light is not on a key yet.

### Paladin escape test (0.2 s reaction)

| Start | Step (warrior...) | Roll (berserker...) | Leap (monk...) |
|---|---|---|---|
| dead centre | hit (9.0 m) | hit (10.9 m) | clear (13.1 m) |
| 25% off (3 m) | hit (12.0 m, just) | clear | clear |

Nobody is impaled from either start with a 0.2 s reaction.

## Every class's ultimate (current)

| Class | Ultimate | Aim | What it does | Counterplay |
|---|---|---|---|---|
| Warrior | War Banner of Defense | self | Dome: allies take 40% less, deal 20% more, regen 2%/s; stun shockwave | Fight outside the dome, wait it out |
| Paladin | Avenging Wrath | ground | 12 m glyph slows, sword of light impales the core, hurts the rest | Leap off the glyph before impact |
| Shadow Knight | Grasp of the Grave | ground | Chains drag enemies in and drain 25% | Leave the pool before the chains land |
| Berserker | Bladestorm | self | Steerable whirlwind, pulls and cuts (up to 60% if you stay) | Dodge out; it is slowed by distance |
| Monk | Thousand Fists | self | Pulls everyone in 9 m, combo of strikes, 50% each | Be outside 9 m when it starts |
| Rogue | Assassinate | foe | Shadow step behind and a killing blow | Escape abilities, stay near allies |
| Ranger | Rain of Arrows | ground | 7 m shadow then 3 s of arrows (about half health if you stay) | Get out from under the shadow |
| Musketeer | Arcane Barrage | self | 10 s of no-reload arcane fire | Break line of sight |
| Blunderbuss | Powder Keg Barrage | ground | Five kegs, 15% each within 4 m | Read the bounces, move |
| Wizard | Transcendence | self | 10 s: 3x cooldowns, +50% damage | Kite him until it ends |
| Necromancer | Maw of the Abyss | ground | Ring slows, demon grabs the closest to centre | Leap or blink out of the ring |
| Elementalist | Meteor Storm | ground | Five meteors, 18% each within 4 m | Watch the red marks |
| Enchanter | Mass Charm | ground | 8 m charm for 3 s, then 20% | Do not stand in groups |
| Beastmaster | Call of the Wild | self | Three spirit wolves maul for 5 s | Group up, kill the beastmaster |
| Shaman | Spirit of the Storm | ground | Totem heals allies 10%/pulse, lightning on foes | Break the fight away from the totem |
| Druid | Overgrowth | self | Forest heals allies and tangles enemies across the arena | Burst before it lands, cleanse |
| Cleric | Miracle | ally | Full heal + 3 s untouchable on one ally, half heal nearby | Swap targets |
| Bard | Grand Finale | self | Mesmerise in 10 m, allies heal 40% and speed up | Stay out of 10 m |
| Priest (new) | Salvation | self | 14 m dome, 6 s: allies heal 60% and cannot die for 3 s; enemies slowed and scorched | Pull the fight out of the dome, or wait 3 s |
| Goblin Bombardier (new) | Big Bertha | ground | 3 s fuse, then 70% within 3 m and 30% within 9 m, thrown away | Run as soon as it lands |


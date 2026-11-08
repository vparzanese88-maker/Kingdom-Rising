# Kingdom Rising II: the world

This is the shared background for every mode. The campaign is set on the island of Kelda. The Kingdom Arena is set
in the Ruins of Aldermere, on the mainland. Class text in game lives in `src/classlore.js`: `CLASS_STORY` for
the campaign, plus each class's `arena` entry, `WORLD`, `FACTIONS` and `ROLES` for the arena.

## The Vale and the Concord

The Vale is the green heart of the mainland, the realm of Valdren. The free peoples share it: humans in the
river towns, high elves in the white spires, wood elves in the deep groves, dwarves under the hills and the orc
clans of the cold Frostmark to the north. Kelda is an island off the west coast, a few days' sail from the Vale.

At the centre of the Vale stood **Aldermere**, the crown city, built around the **Heartwood**: a giant alder
older than any kingdom, whose sap glows with a warm golden light (**emberlight**). For three hundred years the
city was ruled by the **Concord of Nine Banners**, a council where every free people had a seat. It was the one
place in Valdren where an orc chieftain and an elf queen could sit at the same table.

## The Night of Ash (thirty years ago)

**Archmagister Velloran Corvane** of Aldermere's college of magic grew tired of the Concord's endless arguing. He
believed that the Heartwood's light, forged into a crown, would let one wise ruler end every quarrel at once. He
chose himself.

The rite failed. The emberlight burst out of the tree, and in a single night fire swept the whole city to its
stones. Ten thousand people died. The garrison held the Old Gate long enough for the survivors to reach the road,
and died there. Corvane was never found.

The Concord broke. Without Aldermere's garrison the roads grew dangerous, and goblin warbands wandered freely for
the first time in centuries. One of them, led by a brute called Gorgrak, took ship to Kelda ten years later. That
is where the campaign begins.

## The Heartwood's Echo

The Heartwood survived. It still stands in the ruined plaza, glowing. In its light, **the dead do not stay
dead**: whoever falls in the ruins wakes again at the edge of the city, whole, remembering the pain. Most people
call this the Echo. The Lantern Order calls it a curse. The Dusk Covenant calls it a gift.

(In game: this is why heroes respawn in the Kingdom Arena, why the arena is fought only in Aldermere, and why the
glowing tree sits in the middle of the map.)

## The Ashen Trials (the Kingdom Arena)

Every faction wants the ruins, and the Echo makes war pointless there: an army that cannot die cannot be beaten.
So twenty years ago the factions signed the **Accord of Ash**. Disputes over Aldermere are settled by small teams
of champions who fight through the ruins. Whoever holds the ruins when a Trial ends holds the claim until the
next one. Captured banners (capture the flag) are old Concord banners dug out of the rubble.

The map: two team bases at the north and south ends, and three ways to the centre plaza:

- **The rampart** (left): the old city wall and its watchtower, the Greenwatch's favourite perch.
- **The high street** (middle): tall burned-out houses with balconies and a timber bridge.
- **The cathedral garden** (right): the broken chapel of the Cathedral of the Dawn, with a gallery upstairs.

## The factions

| Faction | Sigil | Creed | Classes |
| --- | --- | --- | --- |
| The Lantern Order | ✦ | Lay the dead of Aldermere to rest. | Paladin, Cleric, Priest |
| The Greenward Circle | ❦ | The tree was here first. | Ranger, Druid, Shaman, Beastmaster |
| The Ashen College | ✷ | Understand the light, or it will happen again. | Wizard, Elementalist, Enchanter |
| The Dusk Covenant | ☾ | Death is a door. Aldermere left it open. | Shadow Knight, Necromancer, Rogue |
| The Free Banners | ⚔ | Steel for hire. Oaths for free. | Warrior, Berserker, Monk, Bard |
| The Scrapjaw Crews | ✹ | Finders keepers. | Musketeer, Blunderbuss, Goblin Bombardier |

- **The Lantern Order**: the faith of the Light, born in Aldermere's cathedral. Its paladins were at prayer when
  Corvane began his rite, and have never forgiven themselves. The Order wants to bless the Heartwood into silence
  so the dead can rest. (On Kelda, the lighthouse keepers' faith is the same Light.)
- **The Greenward Circle**: druids, rangers, shamans and beast-callers who tended the Heartwood before there was a
  city. They want the ruins torn down and the tree left alone. They believe every Trial hurts it.
- **The Ashen College**: what is left of Corvane's college, blamed for everything. Some members fight to atone.
  Some have read his notes and think he was close.
- **The Dusk Covenant**: necromancers, shadow knights and the knives who work for them. A place where death does
  not stick is the greatest prize in the world to them.
- **The Free Banners**: sellsword companies, orc clans of the Frostmark, the monks of the Still Bell and the
  Minstrels' Guild. Many are descended from the garrison that died at the Old Gate.
- **The Scrapjaw Crews**: goblin salvage crews who found the city's powder vaults after the fire. Nobody invited
  them to sign the Accord. They came anyway. (Gorgrak's goblins on Kelda hoard powder for the same reason.)

## The champions

Each class has an arena title, a role, a difficulty and a quote. Roles on the hero select are Tank, Damage, Flank
and Support (the game's own roles are Tank, Healer and Damage; Flank heroes count as Damage, Support as Healer).

| Class | Title | Role | Faction | Quote |
| --- | --- | --- | --- | --- |
| Warrior | the Ash-Sworn | Tank | Free Banners | They burned the city. They will not burn the line. |
| Berserker | the Red Tide | Tank | Free Banners | Let it hurt. It only makes me louder. |
| Paladin | the Dawnshield | Tank | Lantern Order | The Light does not flinch. Neither do I. |
| Shadow Knight | the Unburied | Tank | Dusk Covenant | I died here once. I liked it. |
| Blunderbuss | the Gatebreaker | Tank | Scrapjaw Crews | Knock knock. |
| Ranger | the Greenwatch | Damage | Greenward Circle | I have been watching you since you crossed the rampart. |
| Musketeer | the Long Ear | Damage | Scrapjaw Crews | Hold still. This won't hurt. Much. |
| Wizard | the Last Lantern | Damage | Ashen College | Corvane was a genius. That is what frightens me. |
| Necromancer | the Gravecaller | Damage | Dusk Covenant | Ten thousand died here. Not one of them has left. |
| Elementalist | the Stormbound | Damage | Ashen College | Fire remembers this city. I only have to remind it. |
| Enchanter | the Veilweaver | Damage | Ashen College | You are not losing. You only think you are. Wait. No. You are. |
| Goblin Bombardier | the Skyburner | Damage | Scrapjaw Crews | Duck! No, the other way! |
| Rogue | the Ninth Knife | Flank | Dusk Covenant | Look behind you. No, really. |
| Monk | the Still Bell | Flank | Free Banners | The bell is silent. My fists are not. |
| Beastmaster | the Pack-Heart | Flank | Greenward Circle | They smell your fear. So do I. |
| Cleric | the Hearthkeeper | Support | Lantern Order | Get up. I am not finished with you. |
| Druid | the Rootmother | Support | Greenward Circle | Everything here grew from one seed. Even you. |
| Shaman | the Stormspeaker | Support | Greenward Circle | The spirits of this place are angry. Let me translate. |
| Bard | the Last Verse | Support | Free Banners | Every Trial needs a song. I like to be in it. |
| Priest | the Dawncaller | Support | Lantern Order | The night is long. The dawn is longer. |

The full backstories are in `src/classlore.js`.

## Writing guide

- Plain, strong sentences. Short words. Dry humour is welcome, especially for goblins.
- Tie every new hero to a faction and to something that happened in Aldermere.
- Fixed facts: the Night of Ash was thirty years ago; the Accord of Ash twenty years ago; Gorgrak came to Kelda
  twenty years ago; Corvane was never found; the Heartwood still glows; the dead wake again in its light.
- Open threads for later: is Corvane dead? Is the Heartwood dying? How many verses of the Lay of Aldermere are
  left? What is the Concord's secret tenth seat?

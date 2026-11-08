# Meshy wishlist: assets that would make the Ruins of Aldermere beautiful

The arena map (src/ruinsmap.js, src/ruinsart.js) is built from code: boxes, cylinders and procedural textures.
It now has a strong layout, light and colour, but hand-made models would lift it to the level of a premium
hero shooter. These are the models to generate in Meshy, in order of how much they would add.

**Style for every prompt** (paste after the prompt): `stylized fantasy, hand-painted texture, game-ready,
low-to-mid poly, clean silhouette, warm sandstone and weathered marble palette, PBR, single mesh, centered,
no ground plane`

Tips:
- Export as FBX (like the yard trees and rocks) with the texture embedded. Put files in
  `kingdom-rising-2/models/props/` with the file name given below.
- Keep each prop under about 15,000 triangles (the hero tree and the big landmarks can go to 30,000). Most props
  are drawn many times as instances, so smaller is better.
- Ask for a 1024 or 2048 texture. One material per model is best.
- Say "ruined" or "broken" in every architecture prompt: the city burned thirty years ago.

## Top 10 (biggest win first)

| # | File | Where it goes | Meshy prompt |
| --- | --- | --- | --- |
| 1 | `ruin_heartwood.fbx` | the centre of the plaza (replaces the procedural Heartwood) | A colossal ancient alder tree with a thick gnarled twisting trunk and huge roots splitting through marble paving, wide spreading crown of glowing golden-amber leaves, one side of the trunk charred black and bare, small glowing seed pods hanging from branches, magical and melancholy |
| 2 | `ruin_arch.fbx` | both ends of the high street (the triumphal arch), plus smaller copies on the side routes | A ruined triumphal stone archway of weathered cream marble, carved reliefs and columns on both sides, the keystone missing and a crack through the top, ivy hanging from the broken edge, rubble at the base |
| 3 | `ruin_house.fbx` | the high street houses (3 storeys, timber-framed) as façade dressing | A burned-out three-storey medieval fantasy town house, timber frame and cream plaster walls, stone ground floor, broken terracotta roof with exposed rafters, empty windows, a wooden balcony on the first floor, soot marks |
| 4 | `ruin_brazier.fbx` | every brazier (about 14): the plaza, the statues, the watchtower | A tall wrought-iron fantasy brazier on a stone base, a wide fire bowl with ornate claw supports, glowing coals, old Concord heraldry engraved on the bowl |
| 5 | `ruin_chapel.fbx` | the right route: the Cathedral of the Dawn's chapel (dressing round the walkable box) | A small ruined gothic chapel of pale stone, pointed arched windows with broken stained glass, a collapsed slate roof, a little bell gable, ivy and moss, golden sun emblem over the door |
| 6 | `ruin_column.fbx` and `ruin_column_broken.fbx` | the ring of 16 columns round the Heartwood, the plaza and the base courtyards | A weathered fluted marble column with a carved capital, chipped and cracked (and a second one: the same column snapped off at half height with a jagged top and a fallen drum beside it) |
| 7 | `ruin_statue.fbx` | the hero statues by the grand stairs and on the plaza platforms | A weathered bronze statue of a heroic knight raising a sword, cape flowing, green patina, standing on a carved stone plinth with an old inscription |
| 8 | `ruin_banner.fbx` | spawn gates, keeps, the street bridge (tinted per team in code; make it white or pale grey) | A tall medieval heraldic banner hanging from an iron pole with a crossbar, swallowtail end, frayed torn edges, gold trim, plain pale cloth |
| 9 | `ruin_stall.fbx` | market stalls along the high street and in the plaza | A ruined medieval market stall with a torn striped canvas awning, wooden counter with crates, baskets of fruit and pottery, slightly tilted, abandoned |
| 10 | `ruin_watchtower.fbx` | the left rampart's watchtower top | A ruined stone watchtower top on a city wall, crenellated parapet, timber-framed lookout with a pointed shingle roof, a brazier burning on the platform, ivy |

## More, when the top 10 are in

| File | Where it goes | Meshy prompt |
| --- | --- | --- |
| `ruin_fountain.fbx` | the garden pond or the plaza | A broken ornate stone fountain, two-tier basin, a cracked statue of a maiden holding an urn in the middle, moss and water stains |
| `ruin_gate.fbx` | each spawn room's gate (the portcullis stays code-driven) | A heavy fortified stone gatehouse arch with a raised iron portcullis, two squat towers, arrow slits, team banner hooks |
| `ruin_wall_ivy.fbx` | long walls between the routes (tiled along them) | A section of ruined medieval stone wall, 4 metres wide, with crumbling top, thick ivy and moss climbing up, a few loose stones |
| `ruin_tower_collapsed.fbx` | the ruined tower by the plaza (left side) and the skyline beyond the walls | A collapsed round stone tower, half of it fallen away showing broken floors and stairs inside, rubble pile at its foot |
| `ruin_bell_tower.fbx` | the bell tower by the plaza (right side) | A tall square stone bell tower with an open belfry, a cracked bronze bell, pyramid slate roof, weathered |
| `ruin_bridge.fbx` | the timber bridge across the high street and the rooftop bridges | A rustic wooden plank bridge with rope and timber railings, slightly sagging, 15 metres long |
| `ruin_crates.fbx` | cover in every lane (the walkable boxes stay, the model dresses them) | A stack of old wooden crates and barrels with iron bands, a tarp half covering them, a rope coil |
| `ruin_cart.fbx` | the outer path and the courtyards | A broken wooden hay cart with one wheel off, spilled hay, medieval |
| `ruin_well.fbx` | the two wells | A medieval stone well with a wooden roof and a bucket on a rope, mossy stones |
| `ruin_rubble.fbx` | scattered everywhere | A pile of broken masonry blocks, roof tiles and charred beams, game prop |
| `ruin_lantern.fbx` | the street lamp posts and the bridge | A wrought-iron medieval street lantern on a curved bracket, warm glowing glass |
| `ruin_stairs.fbx` | dressing for the grand stairs | A wide ruined stone staircase with broken balustrades and urns on the newel posts |
| `ruin_gazebo.fbx` | the garden terrace | A small ruined garden gazebo with slender marble columns and a green copper dome, vines |
| `ruin_hedge.fbx` | the garden hedges | An overgrown boxwood hedge block with small white flowers, 3 metres long |
| `ruin_flowers.fbx` | ground clutter in the garden and the plaza cracks | A clump of wild flowers and tall grass, yellow and white blossoms, stylized |
| `ruin_ground_tiles.png` (texture, not a model) | the ground | Seamless tileable texture of worn medieval cobblestones with moss in the gaps, hand-painted (also: cracked marble flagstones; overgrown garden grass; packed earth path) |
| `ruin_skybox` (texture) | the sky | A seamless panoramic fantasy sky at golden hour, warm peach horizon, soft clouds, a distant ruined city and blue mountains on the horizon (equirectangular, 4096 x 2048) |

## How a new model gets in

The arena already loads `models/props/yard_tree.fbx` and `yard_rock.fbx` (see `plantMeshy` in src/ruinsart.js):
each one is scaled to a height, stood on the ground and drawn as instances, and the procedural stand-ins hide
once it loads. A new prop is the same pattern: add a file name and a list of `[x, y, z, height, turn]` spots.

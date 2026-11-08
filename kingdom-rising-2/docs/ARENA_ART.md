# Kingdom Arena: art direction for the Ruins of Aldermere

The arena is fought in the ruins of the crown city, thirty years after the Night of Ash. The look should read in
one glance, like a premium hero-shooter map (Paladins, Overwatch): bold shapes, a clear focal point, warm and cool
light pulling against each other, and every route with its own colour and character.

## The one-line pitch

A golden-hour ghost town. The low sun pours warm amber light down the high street and across the plaza, the
shadows are cool blue-violet, and in the middle of it all the Heartwood still burns softly with emberlight,
the only living thing in a city of stone that remembers fire.

## Mood

- Melancholy but inviting: a beautiful place where something terrible happened.
- Warm light, cool shade. Sunlight is honey and amber; shadows and sky bounce are lavender and slate blue.
- Fire is the town's heartbeat: braziers and torches (the Trials keep them lit) throw warm pools on the stone.
- The Echo: faint teal-blue crystal light where the dead wake (spawn rooms, crystals), the cold opposite of the
  Heartwood's gold.
- Soot and scorch: the Night of Ash still shows. Wall bases and roof edges are darkened, the Heartwood has a
  charred side, ash-grey rubble lies in the streets.

## Palette

| Use | Colour | Notes |
| --- | --- | --- |
| Sunlight | `#ffc27a` | low golden-hour sun, strong |
| Sky top | `#2f4f8f` | deep dusk blue |
| Sky horizon | `#ffb27a` | peach haze at the horizon |
| Fog / haze | `#d9a88a` | warm aerial haze, starts ~70 m out |
| Shadow / sky bounce | `#7f8fc8` | cool lavender-blue fill |
| Sandstone masonry | `#cdb898` | the town's main stone, warm cream |
| Dark masonry | `#7c6f62` | keeps, outer walls, plinths |
| Weathered marble | `#ece4d4` | columns, statues, the triumphal arch |
| Plaster | `#e9dcc0` | house walls, with timber framing |
| Timber | `#5b3a22` | beams, stairs, balconies |
| Terracotta roof | `#a4482c` | roofs, the one saturated warm accent |
| Copper verdigris | `#5fa58e` | the gazebo dome, bells |
| Ivy / moss | `#5a7a34` / `#7a8a40` | climbing every wall, warm yellow-green |
| Emberlight gold | `#ffcf6a` | the Heartwood, braziers, lanterns |
| Echo teal | `#5ad0ff` | spawn crystals, the dead waking |

Team colours stay pure and saturated on banners so the two halves are easy to tell apart.

## Lighting

- One low directional sun from the west-south-west, about 22 degrees up, so the streets get long shadows that
  cross the routes (good for reading depth) while the plaza stays sunlit.
- Hemisphere light: cool blue sky, warm brown-red ground bounce.
- A cool fill light from the opposite side so heroes are never black silhouettes.
- Baked light: fire glow and sooty ambient occlusion are baked into the vertex colours and the ground texture at
  load time. Nothing is computed per frame except the four shared fire lights the game already pools.
- Bloom stays subtle: flames, lanterns, crystals and the Heartwood canopy glow; stone never does.

## Landmarks (each route has its own)

1. **The Heartwood** (centre): a huge gnarled alder rising out of a cracked marble ring, roots splitting the
   paving, a crown of glowing gold leaves above the whole plaza, one side charred black. Visible from both bases.
   It is the compass of the map.
2. **The triumphal arch** (middle, both ends of the high street): a broken marble arch, keystone fallen.
3. **The watchtower** (left rampart): the old city wall with its timber-roofed tower and a brazier on top.
4. **The bell tower and the chapel of the Cathedral of the Dawn** (right garden): stone chapel, copper dome
   gazebo, a pond and overgrown garden.
5. **The keeps and spawn gates** (each base): heavy dark masonry, portcullis, banners in the team colour.

## Route identities

- **Left, the rampart**: grey stone, wind, height. Ivy pours down the wall faces, the outer path below is dirt
  and hay, stables and carts.
- **Middle, the high street**: warm plaster and timber, cobbles, market awnings, lanterns, the bridge across.
- **Right, the garden**: green and soft. Grass, hedges, flowers, trees, water, the chapel's pale stone.

## Materials

- World-space mapped procedural textures (cut-stone blocks, plaster, planks, roof tiles, cobbles), so a 100 m
  wall and a 1 m block show the same stone size. Generated once on canvases at load, shared by every mesh.
- One merged mesh per material: the whole map is a few dozen draw calls.
- Vertex colours give every block its own slight tint, a dark sooty base (fake ambient occlusion) and baked
  firelight near braziers and torches.
- The ground is one big painted map: cobbles in the streets, flagstones in the plaza and bases, grass and earth
  in the garden and along the walls, worn paths along the routes, scorch marks, warm light pools.

## Beyond the walls

Distant hazy mountains and broken towers of the rest of Aldermere, all in fog colour, so the arena feels like
part of a city rather than a box.

## Performance rules

- Static geometry merged per material; instanced meshes for repeated props (grass, trees, rocks).
- No per-frame JavaScript work for the map, apart from the existing portcullis and the shared fire lights.
- Animated things (embers, leaves drifting from the Heartwood) are animated in the shader from a time uniform.

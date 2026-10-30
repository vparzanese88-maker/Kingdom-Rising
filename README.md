# Game Arcade

This repo holds several browser games. The two biggest: **Kingdom Rising** (`aeternum-wilds/`, formerly Aeternum Wilds), an online co-op action RPG whose title screen has Campaign, Kingdom Wars and Multiplayer tabs, and **Kingdom3D** (`kingdom-rising-3d/`, formerly Kingdom Rising).

## Kingdom3D

An EverQuest-style browser MMORPG. Two brothers split their poisoned father's kingdom. Pick a side, level up a hero, gather timber and stone, raise your kingdom, and send war parties to kill the other king.

## Play it
It's plain HTML and JavaScript. There's no build step and nothing to install.

- **Online:** turn on GitHub Pages for this repo (Settings → Pages → Deploy from branch → `main` / root). The game will be at `https://<your-username>.github.io/<repo-name>/`.
- **On your own computer:** browsers block some features when you double-click the file, so serve the folder instead:
  - `python3 -m http.server 8000`, then open http://localhost:8000
  - or `npx serve .`

## Kingdom3D in 3D
`kingdom-rising-3d/` is the same game in 3D, played in first person (scroll the mouse wheel out for third person). It runs the very same game files: at startup it reads `index.html` for the stylesheet and the script list and loads everything from `js/` except `main.js`, so classes, stats, quests, menus, bosses, castles and saved heroes are all shared with the 2D version. Only the drawing and the controls are new.

- Controls (EverQuest style): W and S move, A and D turn (they sidestep while the right mouse button is held), hold the right mouse button to look around (or left drag), both buttons walk forward, mouse wheel zooms between first and third person, V switches view, H walks or runs, T or Num Lock auto runs, X sits cross-legged. Clicking the ground does not move you. O opens Settings: graphics (presets, render resolution, automatic resolution to hold a frame rate, frame rate limit and counter, shadows, view distance, grass, anti-aliasing, bloom, brightness), controls (mouse speed, vertical speed, invert, turn speed, movement speed), key bindings for every action (two keys each, mouse side buttons too), camera and sound.
- People move at real speeds in 3D (a 3.2 m/s jog, 1.4 m/s walk; everyone slows by the same amount through `G.moveScale`), and `js3d/gait.js` plants each foot on the ground with two-bone IK: steps roll heel to toe, follow slopes, and never slide.
- `kingdom-rising-3d/js3d/` holds the 3D code (three.js r170 is vendored in `kingdom-rising-3d/vendor/three/`, MIT licence). Everything is built in code: textures are painted on the GPU from noise at load time, and the terrain, buildings, castle walls, trees, props, people and monsters come from the same tile map and `look` data the 2D renderer uses.
  - `core.js` renderer and post effects, `texgen.js` procedural textures, `geo.js` heights from the tile map, `terrain.js` ground, water and lava, `sky.js` sky, weather and lights, `structures.js` buildings and city walls, `props.js` decorations, `veg.js` trees and rocks, `grass.js`, `world3d.js` builds it all per area, `chars.js` and `creatures.js` rigged people and beasts, `actors.js` entities, projectiles and effects, `hud3d.js` name plates, `gait.js` legs and sitting, `keys3d.js` key bindings, `settings3d.js` the settings window, `camera.js`, `viewmodel.js` first-person arms, `main3d.js` boot, loop and input.
- Like the 2D game it must be served over http (for example `python3 -m http.server`), not opened as a file.

## More games in this repo
Each one is a single self-contained HTML page:
- `arcade.html`: a menu page linking to every game.
- `kingdom-rising-3d/`: Kingdom3D (see above).
- `aeternum-wilds/`: Kingdom Rising (formerly Aeternum Wilds), an over-the-shoulder action RPG with online co-op; Campaign, Kingdom Wars and Multiplayer tabs on the title screen, each with its own saved hero. Kingdom Wars (`src/wars.js`, `?mode=wars`) is two identical walled towns at either end of a straight road: waves of soldiers march between them and you win by killing the Red King.
- `omaha/`: Omaha 1944, a Day of Defeat-style WWII shooter on Omaha Beach (see below).
- `line-of-battle/`: Line of Battle, a 3D Civil War infantry shooter.
- `hold-aim-fire/`: Hold, Aim, Fire, a Civil War volley-timing game.
- `dead-end-boulevard/`: Dead End Boulevard, a zombie street survival game.
- `castle-wars/`: Castle Wars, a first-person medieval castle siege: blue castle against red, nine hero classes with war shouts, troops to command and raider waves. Unlike the others it is several files (three.js r160 and PeerJS are vendored in `castle-wars/vendor/`), so serve it over http. Online play connects two browsers directly (WebRTC via PeerJS).

With GitHub Pages on, they live at `https://<your-username>.github.io/<repo-name>/line-of-battle/` and so on.

## Project layout
- `index.html`: the page, all the CSS, and the script tags. The load order of the scripts matters.
- `js/` (in load order):
  - `data.js`: classes, races, items, monsters, regions and quests data.
  - `audio.js`: procedural music and sound effects (Web Audio).
  - `world.js`: world, city, dungeon and sewer generation.
  - `sprites.js`: all character and scenery drawing.
  - `game.js`: combat, movement, abilities and monster AI.
  - `systems.js`: cities, NPCs, quests, saving and multiplayer.
  - `mercs.js` and `mercui.js`: mercenaries and their windows.
  - `render.js`: the renderer.
  - `ui.js`: the HUD and windows.
  - `travel.js`: realms, ferries and zones.
  - `war.js`: siege engines, barracks, raids, the CPU rival, victory and Vinny.
  - `kingdom.js`: lore, gathering, the king's building works, town games and the cover page.
  - `tips.js`: tips for new players, the healer respawn, and the hotbar blink.
  - `story.js`: the cinematic story for a new hero.
  - `affinity.js`: monster weaknesses and resistances.
  - `group.js`: grouping.
  - `online.js`: single player and hosted multiplayer (hosting, joining, passwords, shared saves, host hand-off).
  - `relay.js`: the multiplayer connection when the game is hosted outside claude.ai (public MQTT brokers).
  - `menus.js`: the main menu and hero creation.
  - `main.js`: boot and input.
- When you change a file, bump `?v=` on every script tag and `window.KR_VERSION` in `index.html` so browsers fetch the new copy.

### Characters in 3D
- People are built from the MakeHuman base human (released as CC0, public domain, by Data Collection AB, Joel Palmius and Jonas Hauquier, www.makehumancommunity.org). `kingdom-rising-3d/tools/makehuman/build.mjs` converts it once into `kingdom-rising-3d/assets/human/`; the game then shapes every race, gender, build and face from morph targets, re-poses and rigs it with real fingers, and paints skin, lips, brows and stubble in the shader. Eyes, lashes, brows, hair and beards are separate meshes; clothes and armour are shells cut from the body.

## Single player and multiplayer
- **Single Player** plays offline in your own world. Your kingdoms are saved to your account (claude.ai) or your browser (elsewhere).
- **Multiplayer** (main menu, or the Multiplayer button under your hero):
  - **Quick start:** press **Host a game**. An invite link is copied for you (type `/invite` in chat to see it again). Friends open the link, pick or make a hero and press **Join**.
  - **Host a game:** give it a name and, if you like, a password. You get a game code to share. Your page runs the game: it owns both kingdoms, the clock and the war, and saves the hosted world as you play.
  - **Join a game:** pick one from the open games list or type its code, plus the password if it has one.
  - **Saved games:** a hosted world is saved separately from your single-player world, so anyone with its code and password can host it again later and carry on.
  - **Host hand-off:** if the host leaves while others are still playing, one of them takes over as host automatically and the game goes on.
- **Groups:** invite another player with `/invite <name>` or from the Group window (G). Group mates glow cyan in the world, show as cyan dots on the minimap and world map, have an arrow over their heads that shows through walls (within 500 ft), and an arrow on screen points to any mate who is out of view, with the distance.
- **Group loot:** kills are looted automatically. Coins are split evenly between the members nearby, ordinary drops are handed out in turn, and weapons, ingredients and rare items are rolled for: everyone nearby gets a dice window (Need, Greed or Pass), the highest Need roll wins, then the highest Greed roll.
- The password protects the game: the game room and the saved world are both derived from the code and password, and the save is encrypted with the password.
- Multiplayer works wherever the game is hosted: GitHub Pages, your own site, or claude.ai. Friends open the same link, press **Multiplayer** and join with your code. The 2D page and the 3D page (`kingdom-rising-3d/`) can play together in the same game.
- Outside claude.ai, `js/relay.js` connects players through free public MQTT brokers over secure websockets (broker.emqx.io and broker.hivemq.com, both at once, so one being down does not matter). The hosted world is saved, encrypted with the password, on those brokers and in the host's browser.
- To use your own broker, add `?relay=wss://your.broker:port/mqtt` to the page address (several can be given, separated by commas). Everyone in a game must use the same brokers.
- Players on claude.ai and players on other hosts are on different networks and cannot see each other.
- Cloud saves of your heroes only work on claude.ai; elsewhere heroes are saved in your browser.

## Publishing to claude.ai
The artifact needs these capabilities: `db`, `user`, and `room` with the topics `chat`, `grp`, `hello`, `world` and `op` opened to the `interact` level (so players other than the owner can send them).

## Omaha 1944
A first-person WWII flag-capture shooter in the style of Day of Defeat, set on Omaha Beach, Dog sector. Open `omaha/` the same way as the other games.

- **Flags:** Seawall, West Bunker, East Bunker, Crossroads and Church Square. The Allies win by holding all five. The Axis win by holding all five or by running out the 15-minute clock.
- **Classes:** the Day of Defeat 1.3 roster. Allies: Rifleman (M1 Garand), Staff Sergeant (M1 Carbine), Master Sergeant (Thompson), Sergeant (M3 Grease Gun), Sniper (Springfield), Support (BAR), Machine Gunner (.30 cal). Axis: Grenadier (K98k), Stosstruppe (Gewehr 43), Unteroffizier (MP40), Sturmtruppe (StG 44), Scharfschütze (scoped K98k), MG34 and MG42 gunners. Snipers and machine guns have slot limits.
- **Realism:** stamina and sprinting, being slowed when hit, duck (hold Ctrl or C) and prone (Z on and off), machine guns that have to be deployed prone or on cover, artillery barrages with screen shake and ear ringing, and wave respawns.
- **Ballistics:** bullets are projectiles with real muzzle velocities, gravity drop and travel time. Sights are zeroed at 100 m.
- **Wounds and gore:** hits make you bleed until you bandage (H). Bodies are ragdolls that get thrown by blasts, tumble down slopes and float in the surf. Headshots knock helmets off, close blasts tear limbs off, and there are blood sprays, spatter, trails, pools and blood on the lens. Gore can be turned down in Esc > Gore.
- **Tips:** gameplay tips pop up now and then. Close one with the ×, or turn them off for good from the tip or in Esc > Show tips.
- **Graphics:** Gerstner-wave sea with reflections, sun glitter and breaking foam; 4096 sun shadows and bloom; leaf-card trees and hedgerows; dense grass, weeds, ferns and wildflowers in gusting wind; soldiers with helmet nets, chinstraps, leather Y-straps, ammo pouches, canteens, gas-mask kit and life belts.
- **AI:** 12 to 20 soldiers a side, picked on the menu. Bots attack and defend flags, man MG nests and sniper perches, suppress each other, throw and throw back grenades, and call out in English or German.
- **Online with friends:** type your name and press **Host online game**. Friends open the game, press **Find online games** and click your battle in the list. They can also use your 4-letter room code, or the invite link from the Esc menu. Each friend takes a bot's place on the side they pick, and bots fill every other slot. The host's browser runs the battle, so the host should have the best computer and connection, and the game ends for everyone when the host quits. All traffic goes through free public MQTT relays (EMQX and HiveMQ) over secure websockets, so it works behind home routers. Up to 12 players.
- Each round starts with 10 seconds frozen in place so everyone can pick a class (press M), then the Higgins boats go in.
- **Esc** opens the menu with volume sliders for master, effects, music and voices, plus mouse speed and graphics. When the game isn't running, an AI-only battle plays behind the menu.
- Everything is built in code: models, textures, sound effects and music. Nothing is copied from Day of Defeat.

Code lives in `omaha/js/`, loaded in this order: `core.js` (renderer, post-processing, textures), `shapes.js`, `audio.js`, `terrain.js` (heightfield, sea, sky), `world.js` (map structures, collision, ray casts, navigation), `fx.js`, `weapons.js`, `guns.js`, `soldier.js`, `ai.js`, `player.js`, `game.js` (rounds, HUD, menus, main loop), `relay.js` (MQTT relay client) and `net.js` (online play). `shapes.js` and `guns.js` build the smooth weapon models, `vegetation.js` the trees and plants, and `ragdoll.js` the ragdolls and gore.

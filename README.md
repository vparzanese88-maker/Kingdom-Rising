# Kingdom Rising

An EverQuest-style browser MMORPG. Two brothers split their poisoned father's kingdom. Pick a side, level up a hero, gather timber and stone, raise your kingdom, and send war parties to kill the other king.

## Play it
It's plain HTML and JavaScript. There's no build step and nothing to install.

- **Online:** turn on GitHub Pages for this repo (Settings → Pages → Deploy from branch → `main` / root). The game will be at `https://<your-username>.github.io/<repo-name>/`.
- **On your own computer:** browsers block some features when you double-click the file, so serve the folder instead:
  - `python3 -m http.server 8000`, then open http://localhost:8000
  - or `npx serve .`

## Kingdom Rising 3D
`kingdom-rising-3d/` is the same game in 3D, played in first person (scroll the mouse wheel out for third person). It runs the very same game files: at startup it reads `index.html` for the stylesheet and the script list and loads everything from `js/` except `main.js`, so classes, stats, quests, menus, bosses, castles and saved heroes are all shared with the 2D version. Only the drawing and the controls are new.

- Controls: WASD to move, hold the right mouse button to look around (or left drag), mouse wheel to zoom between first and third person, V to switch view, O for 3D settings (graphics quality, field of view, mouse sensitivity). Every other key works as in the 2D game.
- `kingdom-rising-3d/js3d/` holds the 3D code (three.js r170 is vendored in `kingdom-rising-3d/vendor/three/`, MIT licence). Everything is built in code: textures are painted on the GPU from noise at load time, and the terrain, buildings, castle walls, trees, props, people and monsters come from the same tile map and `look` data the 2D renderer uses.
  - `core.js` renderer and post effects, `texgen.js` procedural textures, `geo.js` heights from the tile map, `terrain.js` ground, water and lava, `sky.js` sky, weather and lights, `structures.js` buildings and city walls, `props.js` decorations, `veg.js` trees and rocks, `grass.js`, `world3d.js` builds it all per area, `chars.js` and `creatures.js` rigged people and beasts, `actors.js` entities, projectiles and effects, `hud3d.js` name plates, `camera.js`, `viewmodel.js` first-person arms, `main3d.js` boot, loop and input.
- Like the 2D game it must be served over http (for example `python3 -m http.server`), not opened as a file.

## More games in this repo
Each one is a single self-contained HTML page:
- `arcade.html`: a menu page linking to every game.
- `kingdom-rising-3d/`: Kingdom Rising in 3D (see above).
- `line-of-battle/`: Line of Battle, a 3D Civil War infantry shooter.
- `hold-aim-fire/`: Hold, Aim, Fire, a Civil War volley-timing game.
- `dead-end-boulevard/`: Dead End Boulevard, a zombie street survival game.

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

## Single player and multiplayer
- **Single Player** plays offline in your own world. Your kingdoms are saved to your account (claude.ai) or your browser (elsewhere).
- **Multiplayer** (main menu, or the Multiplayer button under your hero):
  - **Host a game:** give it a name and, if you like, a password. You get a game code to share. Your page runs the game: it owns both kingdoms, the clock and the war, and saves the hosted world as you play.
  - **Join a game:** pick one from the open games list or type its code, plus the password if it has one.
  - **Saved games:** a hosted world is saved separately from your single-player world, so anyone with its code and password can host it again later and carry on.
  - **Host hand-off:** if the host leaves while others are still playing, one of them takes over as host automatically and the game goes on.
- The password protects the game: the game room and the saved world are both derived from the code and password, and the save is encrypted with the password.
- Multiplayer works wherever the game is hosted: GitHub Pages, your own site, or claude.ai. Friends open the same link, press **Multiplayer** and join with your code. The 2D page and the 3D page (`kingdom-rising-3d/`) can play together in the same game.
- Outside claude.ai, `js/relay.js` connects players through free public MQTT brokers over secure websockets (broker.emqx.io and broker.hivemq.com, both at once, so one being down does not matter). The hosted world is saved, encrypted with the password, on those brokers and in the host's browser.
- To use your own broker, add `?relay=wss://your.broker:port/mqtt` to the page address (several can be given, separated by commas). Everyone in a game must use the same brokers.
- Players on claude.ai and players on other hosts are on different networks and cannot see each other.
- Cloud saves of your heroes only work on claude.ai; elsewhere heroes are saved in your browser.

## Publishing to claude.ai
The artifact needs these capabilities: `db`, `user`, and `room` with the topics `chat`, `grp`, `hello`, `world` and `op` opened to the `interact` level (so players other than the owner can send them).

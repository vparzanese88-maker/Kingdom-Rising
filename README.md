# Kingdom Rising

An EverQuest-style browser MMORPG. Two brothers split their poisoned father's kingdom. Pick a side, level up a hero, gather timber and stone, raise your kingdom, and send war parties to kill the other king.

## Play it
It's plain HTML and JavaScript. There's no build step and nothing to install.

- **Online:** turn on GitHub Pages for this repo (Settings → Pages → Deploy from branch → `main` / root). The game will be at `https://<your-username>.github.io/<repo-name>/`.
- **On your own computer:** browsers block some features when you double-click the file, so serve the folder instead:
  - `python3 -m http.server 8000`, then open http://localhost:8000
  - or `npx serve .`

## More games in this repo
Each one is a single self-contained HTML page:
- `arcade.html`: a menu page linking to every game.
- `omaha/`: Omaha 1944, a Day of Defeat-style WWII shooter on Omaha Beach (see below).
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
- Multiplayer and cloud saves use claude.ai's artifact services, so they only work in the claude.ai version. On GitHub Pages you can play Single Player, saved in your browser.

## Publishing to claude.ai
The artifact needs these capabilities: `db`, `user`, and `room` with the topics `chat`, `grp`, `hello`, `world` and `op` opened to the `interact` level (so players other than the owner can send them).

## Omaha 1944
A first-person WWII flag-capture shooter in the style of Day of Defeat, set on Omaha Beach, Dog sector. Open `omaha/` the same way as the other games.

- **Flags:** Seawall, West Bunker, East Bunker, Crossroads and Church Square. The Allies win by holding all five. The Axis win by holding all five or by running out the 15-minute clock.
- **Classes:** the Day of Defeat 1.3 roster. Allies: Rifleman (M1 Garand), Staff Sergeant (M1 Carbine), Master Sergeant (Thompson), Sergeant (M3 Grease Gun), Sniper (Springfield), Support (BAR), Machine Gunner (.30 cal). Axis: Grenadier (K98k), Stosstruppe (Gewehr 43), Unteroffizier (MP40), Sturmtruppe (StG 44), Scharfschütze (scoped K98k), MG34 and MG42 gunners. Snipers and machine guns have slot limits.
- **Realism:** stamina and sprinting, being slowed when hit, prone and crouch, machine guns that have to be deployed prone or on cover, artillery barrages with screen shake and ear ringing, and wave respawns.
- **AI:** 12 to 20 soldiers a side, picked on the menu. Bots attack and defend flags, man MG nests and sniper perches, suppress each other, throw and throw back grenades, and call out in English or German.
- **Online with friends:** on the menu, type your name and press **Host game**. You get a 4-letter room code; press Esc in game to copy an invite link. Friends open the link (or type the code) and press **Join**. Each friend takes a bot's place on the side they picked, and bots fill every empty slot. The host's browser runs the battle, so the host should have the best computer and connection, and the game ends for everyone when the host quits. It connects browsers directly with WebRTC through PeerJS's free public matchmaking server. Up to 12 players.
- Each round opens with a Higgins boat landing. When the game isn't running, an AI-only battle plays behind the menu.
- Everything is built in code: models, textures, sound effects and music. Nothing is copied from Day of Defeat.

Code lives in `omaha/js/`, loaded in this order: `core.js` (renderer, post-processing, textures), `audio.js`, `terrain.js` (heightfield, sea, sky), `world.js` (map structures, collision, ray casts, navigation), `fx.js`, `weapons.js`, `soldier.js`, `ai.js`, `player.js`, `game.js` (rounds, HUD, menus, main loop) and `net.js` (online play). `js/vendor/peerjs.min.js` is PeerJS 1.5.4 (MIT).

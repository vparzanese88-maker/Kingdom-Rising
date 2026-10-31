# Working on this repo

## Always ship to main
The owner has given standing permission, and wants this done every time:
- After any change to any game (new game or alteration), merge the work into `main` and push `main` to GitHub. Don't wait to be asked and don't stop at a feature branch or pull request.
- GitHub Pages serves `main`, so this is what makes the change playable.

## Kingdom Rising (aeternum-wilds/): stamp before committing
Run `python3 aeternum-wilds/tools/stamp.py` before committing changes in `aeternum-wilds/`, so players' browsers load the new code instead of a cached copy.

## Omaha 1944: stamp before committing
Run `python3 omaha/tools/stamp.py` before committing Omaha 1944 changes, so players' browsers never mix a new page with old cached scripts (that shows up as a black screen).

## Always give the play link
End every reply that creates or changes a game with its GitHub Pages link, so it can be sent to friends:
- Arcade (all games): https://vparzanese88-maker.github.io/Kingdom-Rising/arcade.html
- Kingdom3D (was called Kingdom Rising): https://vparzanese88-maker.github.io/Kingdom-Rising/kingdom-rising-3d/ (the old address https://vparzanese88-maker.github.io/Kingdom-Rising/ opens it too; only the 3D version is worked on)
- Omaha 1944 (online: one player presses Host online game, friends press Find online games): https://vparzanese88-maker.github.io/Kingdom-Rising/omaha/
- Line of Battle: https://vparzanese88-maker.github.io/Kingdom-Rising/line-of-battle/
- Hold, Aim, Fire: https://vparzanese88-maker.github.io/Kingdom-Rising/hold-aim-fire/
- Dead End Boulevard: https://vparzanese88-maker.github.io/Kingdom-Rising/dead-end-boulevard/
- Kingdom Rising (was called Aeternum Wilds; lives in `aeternum-wilds/`; title screen has big Campaign, Kingdom Wars, Host Game and Join Game buttons, each mode with its own saved hero; Kingdom Wars runs on its own map at `?mode=wars`; online co-op: one player presses Host Game, friends press Join Game and type the code): https://vparzanese88-maker.github.io/Kingdom-Rising/aeternum-wilds/
- Castle Wars (online: one player presses Multiplayer → Host Online Game and sends the invite link): https://vparzanese88-maker.github.io/Kingdom-Rising/castle-wars/

When a new game is added, add its link to this list and to `arcade.html`.

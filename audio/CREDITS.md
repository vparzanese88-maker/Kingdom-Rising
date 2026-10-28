# Kingdom Rising: sound and music credits

Most music and sound effects in Kingdom Rising are generated in code at runtime with the Web Audio API (`js/audio.js`
and `js/warbutton.js`). A few recorded sounds and one music track, all CC0 (public domain), are in `audio/rec/` and
listed below; until one has loaded, or if it can't be, the synthesized version plays instead.

No sound has been taken from films, TV, other games or any copyrighted recording. If recorded samples are added
later, they must be CC0 / public domain or carry a licence that allows redistribution in a public web game, and each
file must be listed here with its source URL, author and licence.

| Sound | How it's made | Licence |
|---|---|---|
| Cannon and bombard fire | Synthesized: a noise crack, a filtered blast, a pitch-dropping saturated sine for the body, a low-passed brown-noise rumble, debris crackle and early reflections | Original work, part of this game |
| Musket and arquebus shots | Synthesized: a crack, a powder whump, a low thump, and the hiss of the priming pan | Original work |
| Ballista | Synthesized: a Karplus-Strong bow-string twang, a wooden band-pass thunk and a swept whoosh | Original work |
| Sword on sword | Modal synthesis of a ringing steel bar: inharmonic partials doubled a hair apart so they beat, over a contact transient and a scrape | Original work |
| Blade on armour, shield block, arrow thud, troll smash | Modal and band-pass synthesis | Original work |
| Battle cry | Twelve synthesized voices (sawtooth sources through vowel formant filters), staggered | Original work |
| War horn | An additive brass tone with an opening filter, vibrato, breath noise and a hall | Original work |
| Battle din | A looping crowd roar (band-passed brown noise), with distant clashes scattered across it | Original work |
| Battle music ("battle") and every other track | Procedural orchestra: taiko and timpani, string ostinato, brass, horns and choir voices built from oscillators and noise | Original work |

## Recorded sounds (audio/rec/)

All are CC0 1.0 (public domain dedication): free to use, change and redistribute, no credit required. Credited anyway.
Converted to mono or stereo MP3 and trimmed of silence.

| File(s) | Used for | Source | Author | Licence |
|---|---|---|---|---|
| `clash1-10.mp3` | Sword on sword | https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes | StarNinjas | CC0 |
| `swing1-10.mp3` | Sword swings and slashes | https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes | StarNinjas | CC0 |
| `cannon1.mp3` | Cannon and bombard fire | https://opengameart.org/content/cannon-fire | Thimras | CC0 |
| `battlecrowd.mp3` | The roar of a battle (looped) | https://opengameart.org/content/crowd-shoutingspeaking-ambience | StarNinjas | CC0 |
| `battle-music.mp3` | Battle music ("Battle Theme A") | https://opengameart.org/content/battle-theme-a | cynicmusic | CC0 |

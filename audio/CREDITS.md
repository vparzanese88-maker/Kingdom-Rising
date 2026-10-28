# Kingdom Rising: sound and music credits

All music and sound effects in Kingdom Rising are generated in code at runtime with the Web Audio API. They live in
`js/audio.js` and `js/warbutton.js`, and no recorded audio files are used or shipped.

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

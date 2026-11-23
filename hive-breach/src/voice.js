// Recorded voice lines. The owner records them on record.html (one file per line) and drops the downloaded files, with lines.json,
// into assets/voice/. When the game shows a radio message or caption that matches a line, it plays that recording through a radio filter.
// Lines are generic (no player names) so one recording fits every game.
export const VOICE = [
  // the drop
  { k: 'hale_drop', who: 'General Hale', text: 'Drop teams, this is Olympus. The swarm holds the planet. Go down there and take it back.', re: /Drop teams, this is Olympus/ },
  { k: 'vance_strap', who: 'Commander Vance', text: 'Strap in, marines. We drop in thirty.', re: /Strap in, marines/ },
  { k: 'vance_listen', who: 'Commander Vance', text: 'Listen up! Thirty seconds to drop. Hands off the straps until we\'re down.', re: /Listen up! Thirty seconds/ },
  { k: 'vance_herewego', who: 'Commander Vance', text: 'Here we go. Hold on to something!', re: /Here we go\. Hold on/ },
  { k: 'vance_eject', who: 'Commander Vance', text: 'Eject! Eject! Eject!', re: /EJECT! EJECT/ },
  { k: 'vance_cleandrop', who: 'Commander Vance', text: 'Clean drop. Planet dead ahead. Brace for the burn!', re: /Clean drop/ },
  { k: 'vance_bucket', who: 'Commander Vance', text: 'Hold together, you old bucket!', re: /old bucket/ },
  { k: 'vance_retros', who: 'Commander Vance', text: 'Retros firing. Landing zone in sight. Brace, brace, brace!', re: /Retros firing/ },
  { k: 'vance_mikep', who: 'Commander Vance', text: 'Heads up, marines! Be aware of the gay alien named Mike P!', re: /gay alien named Mike P/ },
  { k: 'vance_moveout', who: 'Commander Vance', text: 'Marines, move out! Get to that hive! I\'ll run things from the hub.', re: /Marines, move out/ },
  { k: 'vance_briefing', who: 'Commander Vance', text: 'The alien bastards know we\'re coming. Get inside the hive and kill the queen! We will extract you as soon as your mission is complete.', re: /alien bastards know/ },
  // the battle
  { k: 'hale_cleared', who: 'General Hale', text: 'Station Olympus to ground force. The queen\'s hive is confirmed in the mountain. You are cleared to engage.', re: /cleared to engage/ },
  { k: 'vance_hold', who: 'Commander Vance', text: 'Copy, Olympus. Marines, hold the hub, keep the turrets fed and push for that cave. I\'ll keep troops and supplies coming.', re: /hold the hub, keep the turrets fed/ },
  { k: 'hale_swarm', who: 'General Hale', text: 'Olympus scans show the swarm thickening. More of them are coming out of that mountain.', re: /swarm thickening|Hive activity rising|More of them/ },
  { k: 'hale_boss', who: 'General Hale', text: 'Olympus here: something big just came out of the hive. Focus everything on it!', re: /just came out of the hive/ },
  { k: 'vance_hublow', who: 'Commander Vance', text: 'The hub is taking hits. They are getting through, marines!', re: /Hub at \d+ percent/ },
  { k: 'vance_hubfall', who: 'Commander Vance', text: 'The hub is about to fall! Everyone back to the hub, now!', re: /about to fall/ },
  { k: 'vance_troops', who: 'Commander Vance', text: 'Fresh troops on the ground. Move up with them, marines.', re: /Dropship touching down|Fresh troops|Reinforcements/ },
  { k: 'vance_beacon', who: 'Commander Vance', text: 'Extra dropship inbound on the rally beacon.', re: /rally beacon/ },
  // the commander's drops
  { k: 'vance_ammo', who: 'Commander Vance', text: 'Ammo crate inbound on your position. Grab it. Keep those guns fed.', re: /ammo crate inbound|Resupply dropping|ammo drop/ },
  { k: 'vance_med', who: 'Commander Vance', text: 'Med supplies inbound: fresh field dressings. Patch up and keep moving.', re: /Med supplies|dressings coming down/ },
  { k: 'vance_special', who: 'Commander Vance', text: 'Olympus authorised a special for you. Crate\'s coming down on your position. Use it well.', re: /authorised a|Special delivery|dropping beside you\. Use it/ },
  { k: 'vance_gear', who: 'Commander Vance', text: 'Got some new gear dropping on you, marine. Strap it on.', re: /new gear dropping/ },
  // reinforcement upgrades
  { k: 'vance_kills', who: 'Commander Vance', text: 'Your kills just bought us more troops, marines. Keep killing, it\'s paying off!', re: /kills just bought|body count|it's paying off/ },
  { k: 'hale_more', who: 'General Hale', text: 'Olympus here. I\'m releasing more of my people to you, Commander.', re: /releasing more of my people|authorises more troops|what you need down there/ },
  { k: 'vance_copy', who: 'Commander Vance', text: 'Copy, Olympus. Marines: more troops are on the way.', re: /^Copy, Olympus\. Marines:/ },
  // the end
  { k: 'vance_victory', who: 'Commander Vance', text: 'The queen is dead! Outstanding work, marines. Extraction is inbound.', re: /queen is dead|Brood Queen is dying/ },
];
// play recordings that exist: assets/voice/lines.json maps each line's key to its file
export class Voice {
  constructor(audio) { this.a = audio; this.files = {}; this.buf = {}; fetch('./assets/voice/lines.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).then(j => { this.files = j || {}; }).catch(() => { }); }
  find(text) { return VOICE.find(v => v.re.test(text)); }
  async load(k) {
    if (this.buf[k] !== undefined) return this.buf[k]; const f = this.files[k]; if (!f || !this.a.ctx) return null; this.buf[k] = null;
    try { const ab = await (await fetch('./assets/voice/' + f)).arrayBuffer(); this.buf[k] = await this.a.ctx.decodeAudioData(ab); } catch (e) { this.buf[k] = null; } return this.buf[k];
  }
  // through a radio: band-limited, a little crunch, loud enough to sit over the battle
  async say(text) {
    const v = this.find(text); if (!v || !this.files[v.k]) return 0; const b = await this.load(v.k), c = this.a.ctx; if (!b || !c) return 0;
    const now = c.currentTime; if (this.end && now < this.end - 0.05) return 0;   // one voice at a time
    const s = c.createBufferSource(); s.buffer = b; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 280; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600;
    const sh = c.createWaveShaper(), cv = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cv[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); } sh.curve = cv;
    const g = c.createGain(); g.gain.value = 1.4; s.connect(hp); hp.connect(lp); lp.connect(sh); sh.connect(g); g.connect(this.a.bus || c.destination); s.start(); this.end = now + b.duration; return b.duration;
  }
}

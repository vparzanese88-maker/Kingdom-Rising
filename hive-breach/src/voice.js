// Recorded voice lines. The owner records them on record.html (one file per line) and drops the downloaded files, with lines.json,
// into assets/voice/. When the game shows a radio message or caption that matches a line, it plays that recording through a radio filter.
// Lines are generic (no player names) so one recording fits every game.
export const VOICE = [
  // the drop
  { k: 'hale_drop', who: 'General Hale', text: 'Drop teams, this is Olympus. The swarm holds the planet. Go down there and take it back.', re: /Drop teams, this is Olympus/ },
  { k: 'vance_strap', who: 'Commander Vance', text: 'Strap in, marines. We drop in ten.', re: /Strap in, marines/ },
  { k: 'vance_listen', who: 'Commander Vance', text: 'Listen up! Five seconds to drop. Hands off the straps until we\'re down.', re: /Listen up! (Five|Thirty) seconds/ },
  { k: 'vance_herewego', who: 'Commander Vance', text: 'Here we go. Hold on to something!', re: /Here we go\. Hold on/ },
  { k: 'vance_eject', who: 'Commander Vance', text: 'Eject! Eject! Eject!', re: /EJECT! EJECT/ },
  { k: 'vance_cleandrop', who: 'Commander Vance', text: 'Clean drop. Planet dead ahead. Brace for the burn!', re: /Clean drop/ },
  { k: 'vance_bucket', who: 'Commander Vance', text: 'Hold together, you old bucket!', re: /old bucket/ },
  { k: 'vance_retros', who: 'Commander Vance', text: 'Retros firing. Landing zone in sight. Brace, brace, brace!', re: /Retros firing/ },
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
  // a little noise buffer for the comms squelch and the static under the voice
  noise() { if (this.nb) return this.nb; const c = this.a.ctx, n = c.sampleRate, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return this.nb = b; }
  click(t, dur = 0.05, amp = 0.35, dest) { const c = this.a.ctx, s = c.createBufferSource(); s.buffer = this.noise(); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.8; const g = c.createGain(); g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(bp); bp.connect(g); g.connect(dest || this.a.bus || c.destination); s.start(t, Math.random() * 0.5, dur + 0.02); }
  // through the speaker inside your helmet: a small band-limited speaker with a resonant bump, the short echoes of the helmet shell right round your head,
  // a squelch click on and off, a faint static bed while it talks, and the music and battle ducking a little so you can hear it
  async say(text) {
    const v = this.find(text); if (!v || !this.files[v.k]) return 0; const b = await this.load(v.k), c = this.a.ctx; if (!b || !c) return 0;
    const now = c.currentTime; if (this.end && now < this.end - 0.05) return 0;   // one voice at a time
    const t0 = now + 0.08, s = c.createBufferSource(); s.buffer = b;
    // everything goes through one fader (the Voice volume setting), well under the music and the battle
    const out = c.createGain(); out.gain.value = 0.7 * (this.vol ?? 0.6); out.connect(this.a.bus || c.destination);
    // the helmet's tiny speaker: no bass, no air, a boxy hollow middle and a hard little resonance, driven a touch into crackle
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 520; hp.Q.value = 1.1;
    const hp2 = c.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = 420; hp2.Q.value = 0.7;
    const box = c.createBiquadFilter(); box.type = 'peaking'; box.frequency.value = 950; box.Q.value = 1.6; box.gain.value = 6;
    const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2200; pk.Q.value = 2.2; pk.gain.value = 5;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2900; lp.Q.value = 1.2;
    const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 3400; lp2.Q.value = 0.7;
    const pre = c.createGain(); pre.gain.value = 0.7;
    const sh = c.createWaveShaper(), cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1, y = Math.tanh(x * 1.8) / Math.tanh(1.8); cv[i] = Math.round(y * 48) / 48; } sh.curve = cv;   /* soft clip plus a little bit-crush: a cheap radio speaker */
    s.connect(hp); hp.connect(hp2); hp2.connect(box); box.connect(pk); pk.connect(pre); pre.connect(sh); sh.connect(lp); lp.connect(lp2); lp2.connect(out);
    // the helmet shell: very short echoes right round your head (a few centimetres of hard visor and padding)
    for (const [ms, fb, wv] of [[2.3, 0.35, 0.3], [4.1, 0.28, 0.22], [7.6, 0.18, 0.14]]) { const d = c.createDelay(0.05); d.delayTime.value = ms / 1000; const f = c.createGain(); f.gain.value = fb; const dl = c.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400; const w = c.createGain(); w.gain.value = wv; lp2.connect(d); d.connect(dl); dl.connect(f); f.connect(d); dl.connect(w); w.connect(out); }
    // the static bed under the voice
    const st = c.createBufferSource(); st.buffer = this.noise(); st.loop = true; const sb = c.createBiquadFilter(); sb.type = 'bandpass'; sb.frequency.value = 1800; sb.Q.value = 0.7; const sg = c.createGain(); sg.gain.setValueAtTime(0, t0); sg.gain.linearRampToValueAtTime(0.05, t0 + 0.03); sg.gain.setValueAtTime(0.05, t0 + b.duration); sg.gain.linearRampToValueAtTime(0, t0 + b.duration + 0.1); st.connect(sb); sb.connect(sg); sg.connect(out); st.start(t0); st.stop(t0 + b.duration + 0.15);
    this.click(now + 0.02, 0.05, 0.35, out); this.click(t0 + b.duration + 0.04, 0.07, 0.28, out);   // squelch on, and off
    s.start(t0); this.end = t0 + b.duration + 0.1; if (this.onTalk) this.onTalk(b.duration + 0.25); return b.duration;
  }


}

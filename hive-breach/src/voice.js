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
  { k: 'vance_moveout', who: 'Commander Vance', text: 'Marines, move out! Get to that hive! I\'ll run things from the hub.', re: /Marines, move out/ },
  { k: 'vance_briefing', who: 'Commander Vance', text: 'The alien bastards know we\'re coming. Get inside the hive and kill the queen! We will extract you as soon as your mission is complete.', re: /alien bastards know/ },
  // the battle
  { k: 'hale_cleared', who: 'General Hale', text: 'Station Olympus to ground force. The queen\'s hive is confirmed in the mountain. You are cleared to engage.', re: /cleared to engage/ },
  { k: 'vance_hold', who: 'Commander Vance', text: 'Copy, Olympus. Marines, hold the hub, keep the turrets fed and push for that cave. I\'ll keep troops and supplies coming.', re: /hold the hub, keep the turrets fed/ },
  { k: 'hale_swarm', who: 'General Hale', text: 'Olympus scans show the swarm thickening. More of them are coming out of that mountain.', re: /swarm thickening|Hive activity rising|More of them/ },
  { k: 'hale_boss', who: 'General Hale', text: 'Olympus here: something big just came out of the hive. Focus everything on it!', re: /just came out of the hive/ },
  { k: 'vance_hublow', who: 'Commander Vance', text: 'The hub is taking hits. They are getting through, marines!', re: /The hub is taking hits/ },
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
  // harvesters, scrap and vehicles
  { k: 'vance_harvest_intro', who: 'Commander Vance', text: 'See those blue harvester sites? Weld them up. They pull material out of the ground, and that unlocks our vehicles.', re: /^See\ those\ blue\ harvester\ sit/ },
  { k: 'vance_harvest_up', who: 'Commander Vance', text: 'Harvester online. Every one you build gets us vehicles sooner.', re: /^Harvester\ online\.\ Every\ one\ / },
  { k: 'vance_harvest_attack', who: 'Commander Vance', text: 'A harvester is under attack! Defend it!', re: /^A\ harvester\ is\ under\ attack!/ },
  { k: 'vance_harvest_lost', who: 'Commander Vance', text: 'We lost a harvester! Get a welder on it and rebuild it!', re: /^We\ lost\ a\ harvester!\ Get\ a\ w/ },
  { k: 'vance_harvest_raid', who: 'Commander Vance', text: 'Movement under one of the harvesters! They\'re digging up to wreck it. Get over there!', re: /^Movement\ under\ one\ of\ the\ ha/ },
  { k: 'vance_scrap_intro', who: 'Commander Vance', text: 'Weld wrecks and junk for scrap and bring it back to the hub. Scrap builds the vehicles.', re: /^Weld\ wrecks\ and\ junk\ for\ scr/ },
  { k: 'vance_quad_unl', who: 'Commander Vance', text: 'The quad bike is unlocked. Bring me fifty scrap and it\'s yours.', re: /^The\ quad\ bike\ is\ unlocked\.\ B/ },
  { k: 'vance_truck_unl', who: 'Commander Vance', text: 'The gun truck is unlocked. Bring me a hundred and thirty scrap and I\'ll build it.', re: /^The\ gun\ truck\ is\ unlocked\.\ B/ },
  { k: 'vance_vtol_unl', who: 'Commander Vance', text: 'The VTOL is unlocked. Two hundred and forty scrap and you can fly.', re: /^The\ VTOL\ is\ unlocked\.\ Two\ hu/ },
  { k: 'vance_veh_parts', who: 'Commander Vance', text: 'We have the scrap for a vehicle. Order it at the comms console.', re: /^We\ have\ the\ scrap\ for\ a\ vehi/ },
  { k: 'vance_veh_ready', who: 'Commander Vance', text: 'Your ride is waiting in its bay. Lock a turret on it and go.', re: /^Your\ ride\ is\ waiting\ in\ its\ / },
  { k: 'vance_veh_lost', who: 'Commander Vance', text: 'We lost a vehicle! Bring me scrap and I\'ll build another.', re: /^We\ lost\ a\ vehicle!\ Bring\ me\ / },
  { k: 'hale_batteries', who: 'General Hale', text: 'All batteries, fire for effect on that hive!', re: /^All\ batteries,\ fire\ for\ effe/ },
  // your marine shouting out loud (no radio): played by key from what you do, never from text
  { k: 'marine_reload', who: 'Marine', text: 'Reloading!', re: /(?!)/, bark: 1 },
  { k: 'marine_grenade', who: 'Marine', text: 'Frag out!', re: /(?!)/, bark: 1 },
  { k: 'marine_turret', who: 'Marine', text: 'Turret\'s up!', re: /(?!)/, bark: 1 },
  { k: 'marine_contact', who: 'Marine', text: 'Contact! Here they come!', re: /(?!)/, bark: 1 },
  { k: 'marine_hurt', who: 'Marine', text: 'I\'m hit!', re: /(?!)/, bark: 1 },
  { k: 'marine_ammo', who: 'Marine', text: 'I need ammo!', re: /(?!)/, bark: 1 },
  { k: 'marine_mandown', who: 'Marine', text: 'Man down!', re: /(?!)/, bark: 1 },
  // the opening, added later
  { k: 'hale_godspeed', who: 'General Hale', text: 'Godspeed, marines. Bring that queen down.', re: /^General Hale: Godspeed, marines/ },
  { k: 'vance_seal', who: 'Commander Vance', text: 'Pod sealed. Harnesses locked. Ten seconds.', re: /Pod sealed\. Harnesses locked/ },
  // the end
  { k: 'vance_victory', who: 'Commander Vance', text: 'The queen is dead! Outstanding work, marines. Extraction is inbound.', re: /The queen is dead!/ },
];
// play recordings that exist: assets/voice/lines.json maps each line's key to its file
export class Voice {
  constructor(audio) { this.a = audio; this.files = {}; this.buf = {}; fetch('./assets/voice/lines.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).then(j => { this.files = j || {}; }).catch(() => { });
    this.pre = setInterval(() => { if (!this.a.ctx || !Object.keys(this.files).length) return; clearInterval(this.pre); for (const k in this.files) this.load(k); }, 500); }   // every recording is loaded up front, so each line plays exactly on its cue
  level() { if (!this.an || !(this.end > this.a.ctx.currentTime)) return 0; this.an.getFloatTimeDomainData(this.anBuf); let s = 0; for (const x of this.anBuf) s += x * x; return Math.sqrt(s / this.anBuf.length); }   // how loud the voice is right now (0 when nobody talks)
  has(text) { const v = this.find(text); return !!(v && this.files[v.k]); }
  find(text) { return VOICE.find(v => v.re.test(text)); }
  load(k) {   // one shared load per recording: a line asked for while it's still loading waits for it instead of being skipped
    if (this.buf[k]) return Promise.resolve(this.buf[k]); const f = this.files[k]; if (!f || !this.a.ctx) return Promise.resolve(null); this.pr = this.pr || {};
    return this.pr[k] || (this.pr[k] = (async () => { try { const ab = await (await fetch('./assets/voice/' + f)).arrayBuffer(); this.buf[k] = await this.a.ctx.decodeAudioData(ab); } catch (e) { this.buf[k] = null; this.pr[k] = null; } return this.buf[k]; })());
  }
  // a little noise buffer for the comms squelch and the static under the voice
  noise() { if (this.nb) return this.nb; const c = this.a.ctx, n = c.sampleRate, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return this.nb = b; }
  click(t, dur = 0.05, amp = 0.35, dest) { const c = this.a.ctx, s = c.createBufferSource(); s.buffer = this.noise(); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.8; const g = c.createGain(); g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(bp); bp.connect(g); g.connect(dest || this.a.bus || c.destination); s.start(t, Math.random() * 0.5, dur + 0.02); }
  // through the speaker inside your helmet: a small band-limited speaker with a resonant bump, the short echoes of the helmet shell right round your head,
  // a squelch click on and off, a faint static bed while it talks, and the music and battle ducking a little so you can hear it
  async say(text) {
    const v = this.find(text); if (!v || !this.files[v.k]) return 0; const b = await this.load(v.k), c = this.a.ctx; if (!b || !c) return 0;
    const now = c.currentTime; if (this.end && now < this.end - 0.05) { this.q = this.q || []; if (!this.q.includes(text) && this.q.length < 3) this.q.push(text); clearTimeout(this.qT); this.qT = setTimeout(() => this.next(), (this.end - now) * 1000 + 300); return 0; }   // one voice at a time: a line that arrives while someone is talking waits its turn
    const t0 = now + 0.08, s = c.createBufferSource(); s.buffer = b;
    // everything goes through one fader (the Voice volume setting), well under the music and the battle
    const gen = v.who === 'General Hale';   // Hale talks from orbit: a thinner, more distant channel; Vance is close in your helmet
    const out = c.createGain(); out.gain.value = (gen ? 0.85 : 0.7) * (this.vol ?? 0.6) * (this.gk ? this.gk() : 1);   /* quieter in the fight than in the films */ out.connect(this.a.bus || c.destination); if (!this.an || this.an.context !== c) { this.an = c.createAnalyser(); this.an.fftSize = 512; this.anBuf = new Float32Array(512); } out.connect(this.an);   /* the comm card's signal line listens here */
    // the helmet's tiny speaker: no bass, no air, a boxy hollow middle and a hard little resonance, driven a touch into crackle
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = gen ? 700 : 380; hp.Q.value = 1.1;
    const hp2 = c.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = gen ? 600 : 300; hp2.Q.value = 0.7;
    const box = c.createBiquadFilter(); box.type = 'peaking'; box.frequency.value = gen ? 1400 : 900; box.Q.value = 1.6; box.gain.value = gen ? 7 : 4;
    const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2200; pk.Q.value = 2.2; pk.gain.value = 5;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = gen ? 2500 : 3600; lp.Q.value = 1.2;
    const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = gen ? 2900 : 4200; lp2.Q.value = 0.7;
    const pre = c.createGain(); pre.gain.value = 0.7;
    const sh = c.createWaveShaper(), cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1, y = Math.tanh(x * 1.8) / Math.tanh(1.8); cv[i] = Math.round(y * 48) / 48; } sh.curve = cv;   /* soft clip plus a little bit-crush: a cheap radio speaker */
    s.connect(hp); hp.connect(hp2); hp2.connect(box); box.connect(pk); pk.connect(pre); pre.connect(sh); sh.connect(lp); lp.connect(lp2); lp2.connect(out);
    // the helmet shell: very short echoes right round your head (a few centimetres of hard visor and padding)
    for (const [ms, fb, wv] of [[2.3, 0.35, 0.3], [4.1, 0.28, 0.22], [7.6, 0.18, 0.14]]) { const d = c.createDelay(0.05); d.delayTime.value = ms / 1000; const f = c.createGain(); f.gain.value = fb; const dl = c.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400; const w = c.createGain(); w.gain.value = wv; lp2.connect(d); d.connect(dl); dl.connect(f); f.connect(d); dl.connect(w); w.connect(out); }
    // the static bed under the voice
    const st = c.createBufferSource(); st.buffer = this.noise(); st.loop = true; const sb = c.createBiquadFilter(); sb.type = 'bandpass'; sb.frequency.value = 1800; sb.Q.value = 0.7; const sg = c.createGain(); sg.gain.setValueAtTime(0, t0); sg.gain.linearRampToValueAtTime(0, t0 + 0.03); sg.gain.setValueAtTime(0, t0 + b.duration);   /* no static hiss under the voice */ sg.gain.linearRampToValueAtTime(0, t0 + b.duration + 0.1); st.connect(sb); sb.connect(sg); sg.connect(out); st.start(t0); st.stop(t0 + b.duration + 0.15);
    this.click(now + 0.02, 0.05, 0.35, out); this.click(t0 + b.duration + 0.04, 0.07, 0.28, out);   // squelch on, and off
    s.start(t0); this.end = t0 + b.duration + 0.1; if (this.q && this.q.length) { clearTimeout(this.qT); this.qT = setTimeout(() => this.next(), (b.duration + 0.4) * 1000); } if (this.onTalk) this.onTalk(b.duration + 0.25); if (this.onLine) this.onLine(v, b.duration + 0.25); return b.duration;
  }


  // a marine's shout: in the open air (no helmet speaker, no portrait), each with its own cooldown so they never spam; it never blocks the radio
  async bark(k, cd = 8) { if (!this.files[k] || !this.a.ctx) return; const now = performance.now(); this.bt = this.bt || {}; if (now - (this.bt[k] || -1e9) < cd * 1000 || now - (this.btAny || -1e9) < 1500) return; this.bt[k] = this.btAny = now;
    const b = await this.load(k), c = this.a.ctx; if (!b) return; const s = c.createBufferSource(); s.buffer = b; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 140; const g = c.createGain(); g.gain.value = 0.75 * (this.vol ?? 0.6); s.connect(hp); hp.connect(g); g.connect(this.a.bus || c.destination); s.start(); }
  next() { const t = this.q && this.q.shift(); if (t) this.say(t); }
}

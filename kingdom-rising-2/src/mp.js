// Kingdom Battles online: lobby, then a host-run battle mirrored to every other player.
// The host simulates towns, troops, towers and mobs and sends compact snapshots ~10 times a second.
// Each player moves and fights with their own hero; hits, heals and orders go to the host, damage and rewards come back.
import * as THREE from 'three';
import { Net } from './net.js';
import { G } from './state.js';
import { S } from './audio.js';
import { V } from './vfx.js';
import { heightAt } from './terrain.js';
import { buildHumanoid, animateHumanoid, equipWeapon, bake, backWeapons } from './character.js';
import { RACES, CLASSES, WEAPON_TYPES } from './data.js';
import { SETUP } from './battlemap.js';
import { TEAM_COLORS, TEAM_NAMES, DIFFS, BATTLE_RACES } from './battledata.js';
import { angDiff } from './util.js';

export const MP = { on: false, host: false, client: false, net: null, myId: 0, code: '', players: new Map(), slots: [], remotes: new Map() };
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const RN = { human: 'Human', orc: 'Orc', highelf: 'High Elf', woodelf: 'Wood Elf', dwarf: 'Dwarf' };
export function send(d) { if (MP.net) MP.net.send(d); }

// ---------------- lobby ----------------
// Every player picks their own name, race and colour. Same colour = same side, and players on the same colour share
// one town (its army, gold and upgrades). The host only picks the computer enemies and presses Start.
// After Start every player's progress is shown to everyone: loading the world, making a hero, in the battle.
const NAME_KEY = 'kr2_mpname', RACE_KEY = 'kr2_mprace';
const STATUS = { lobby: ['In the lobby', '🟡'], loading: ['Loading the world…', '⏳'], hero: ['Making their hero…', '🎨'], playing: ['In the battle', '⚔'] };
export function lobby() {
  return new Promise((resolve) => {
    MP.on = true; MP.host = SETUP.mp === 'host'; MP.client = !MP.host;
    let nm = '', rc = ''; try { nm = localStorage.getItem(NAME_KEY) || ''; rc = localStorage.getItem(RACE_KEY) || ''; } catch (e) {}
    const me = { name: nm || (MP.host ? 'Host' : 'Friend'), race: BATTLE_RACES.includes(rc) ? rc : 'human', team: 0, status: 'lobby' };
    MP.enemies = { n: 1, diff: 'normal' };
    const ov = el('div', ''); ov.id = 'mplobby'; document.body.appendChild(ov);
    const net = MP.net = new Net();
    const players = () => [...MP.players.entries()].sort((a, b) => a[0] - b[0]);
    const usedTeams = () => [...new Set(players().map(([, p]) => p.team))];
    const render = () => {
      const isHost = MP.host, focus = document.activeElement && document.activeElement.id === 'mpName';
      let html = `<div class="mpp"><div class="lbnav"><button class="btn" id="mpMain">← Main screen</button><div class="eyebrow">Kingdom Battles · Online</div><button class="btn red" id="mpExit">Exit game</button></div>`;
      const navs = () => { const m = $('mpMain'); if (m) m.onclick = () => { S.click(); location.href = location.pathname; }; const x = $('mpExit'); if (x) x.onclick = () => { S.click(); window.KR2exit && window.KR2exit(); }; };
      if (!MP.code) { html += `<h1>Connecting…</h1><p class="mpsub">${MP.err || 'Reaching the matchmaking service…'}</p>${MP.err ? '<div class="mprow"><button class="btn" id="mpBack">← Back to title</button></div>' : ''}</div>`; ov.innerHTML = html; const bk = $('mpBack'); if (bk) bk.onclick = () => { location.href = location.pathname; }; navs(); return; }
      if (!MP.players.has(MP.myId) || (MP.client && !MP.synced)) { ov.innerHTML = html + '<h1>Joining…</h1><p class="mpsub">Getting the lobby from the host…</p></div>'; navs(); return; }
      const mine = MP.players.get(MP.myId);
      const ut = usedTeams(), maxAi = Math.min(3, 4 - ut.length), nAi = Math.min(MP.enemies.n, maxAi), sides = ut.length + (nAi ? 1 : 0);
      const notReady = players().filter(([id, p]) => id !== 0 && !p.ready).map(([, p]) => p.name);
      const step = isHost ? (MP.players.size < 2 ? 1 : notReady.length ? 2 : 3) : (mine.ready ? 3 : 2);
      // ---- top: the code and where we are ----
      html += `<div class="lbtop"><div class="lbcode"><span>Game code</span><b>${MP.code}</b><button class="btn" id="mpCopy">Copy</button></div>
        <div class="lbsteps">${['Friends join with the code', 'Pick race and colour, then Ready', 'Host starts the game', 'Everyone makes a hero', 'Battle!'].map((t, i) => `<div class="lbst${i + 1 < step ? ' done' : i + 1 === step ? ' now' : ''}"><i>${i + 1 < step ? '✓' : i + 1}</i><span>${t}</span></div>`).join('')}</div></div>`;
      html += '<div class="lbcols">';
      // ---- left: everyone in the game, by side ----
      const byTeam = {}; for (const [id, p] of players()) (byTeam[p.team] = byTeam[p.team] || []).push([id, p]);
      html += `<div class="lbleft"><h3>In this game <small>${MP.players.size} player${MP.players.size === 1 ? '' : 's'}</small></h3>`;
      for (const t of Object.keys(byTeam).map(Number).sort()) {
        const list = byTeam[t];
        html += `<div class="lbside" style="--tc:${TEAM_COLORS[t]}"><div class="lbsh"><i></i><b>${TEAM_NAMES[t]} side</b><span>${RN[list[0][1].race]} town${list.length > 1 ? ' · shared by ' + list.length : ''}</span></div>` +
          list.map(([id, p]) => `<div class="lbp${id === MP.myId ? ' me' : ''}"><div><b>${p.name}${id === MP.myId ? ' <em>(you)</em>' : ''}</b><small>${RN[p.race]}${id === 0 ? ' · host' : ''}</small></div><span class="lbr ${id === 0 ? 'host' : p.ready ? 'ok' : 'no'}">${id === 0 ? '👑 Host' : p.ready ? '✅ Ready' : '⏳ Not ready'}</span></div>`).join('') + '</div>';
      }
      if (nAi) html += `<div class="lbside ai"><div class="lbsh"><i></i><b>Computer</b><span>${nAi} kingdom${nAi > 1 ? 's' : ''} · ${DIFFS[MP.enemies.diff].name}</span></div></div>`;
      if (MP.players.size < 2) html += `<p class="lbhint">Waiting for friends… Send them the code <b>${MP.code}</b>. They choose <b>Kingdom Battles → Multiplayer → Join a game</b>.</p>`;
      html += `<div class="lbplan">${sides < 2 ? '<b class="bad">Nobody to fight yet.</b> Add a computer enemy, or someone picks another colour.' : ut.length > 1 ? `<b>Players vs players</b>${nAi ? ' and the computer' : ''}: ${ut.map(t => TEAM_NAMES[t]).join(' vs ')}${nAi ? ' vs Computer' : ''}` : `<b>Everyone together</b> on ${TEAM_NAMES[ut[0]]} vs the computer`}</div></div>`;
      // ---- right: your choices and the one big button ----
      html += `<div class="lbright"><h3>You</h3>
        <label class="lbf"><span>Name</span><input id="mpName" maxlength="16" value="${String(mine.name).replace(/"/g, '&quot;')}"></label>
        <div class="lbf"><span>Race</span><div class="lbopts">${BATTLE_RACES.map(r => `<button class="seg${mine.race === r ? ' on' : ''}" data-race="${r}">${RN[r]}</button>`).join('')}</div></div>
        <div class="lbf"><span>Side colour</span><div class="lbopts">${[0, 1, 2, 3].map(t => `<button class="seg col${mine.team === t ? ' on' : ''}" data-team="${t}" style="--tc:${TEAM_COLORS[t]}"><i></i>${TEAM_NAMES[t]}</button>`).join('')}</div><small>Same colour as a friend = you share a town. Different colour = you fight each other.</small></div>`;
      if (isHost) {
        html += `<button class="btn gold huge" id="mpStart" ${sides < 2 || notReady.length ? 'disabled' : ''}>${notReady.length ? '🔒 Waiting for everyone to be ready' : '▶ Start the game'}</button>
          <p class="lbmsg ${notReady.length ? 'warn' : ''}">${notReady.length ? `Not ready: <b>${notReady.join(', ')}</b>` : MP.players.size < 2 ? 'You can start alone, or wait for friends.' : 'Everyone is ready!'}</p>
          <h3>Computer enemies</h3><div class="lbf"><span>How many</span><div class="lbopts">${[0, 1, 2, 3].map(n => `<button class="seg${nAi === n ? ' on' : ''}" data-nai="${n}" ${n > maxAi ? 'disabled' : ''}>${n === 0 ? 'None' : n}</button>`).join('')}</div></div>
          <div class="lbf"><span>How hard</span><div class="lbopts">${Object.keys(DIFFS).map(d => `<button class="seg${MP.enemies.diff === d ? ' on' : ''}" data-diff="${d}">${DIFFS[d].name}</button>`).join('')}</div></div>`;
      } else html += `<button class="btn ${mine.ready ? 'ok' : 'gold'} huge" id="mpReady">${mine.ready ? '✅ Ready! (click to cancel)' : '✔ Ready up'}</button><p class="lbmsg">${mine.ready ? 'Waiting for the host to start…' : 'Choose your race and colour, then press Ready up.'}</p>`;
      html += `<details class="mpmore"><summary>How online play works</summary><ol class="mphow">
        <li><b>Colours are sides.</b> Same colour = allies sharing one town, its army, gold and upgrades.</li>
        <li><b>XP is shared</b> by everyone on a side, so you all stay the same level. <b>Loot is your own</b>, random for your class.</li>
        <li><b>After the start</b> everyone makes a hero. The gates stay shut for 60 seconds so everyone can get in.</li>
        <li><b>In the game:</b> Tab shows every player, J shows town jobs, B opens the War Report. Drag items onto a friend's name (I) to give them.</li>
        <li><b>Win</b> by destroying every enemy Town Hall. If the host leaves, the game ends.</li></ol></details></div>`;
      html += '</div></div>';
      ov.innerHTML = html; navs();
      const ni = $('mpName'); if (ni) { ni.onkeydown = (e) => e.stopPropagation(); ni.oninput = () => { setMe({ name: ni.value.trim().slice(0, 16) || 'Player' }, false); }; ni.onchange = () => render(); if (focus) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); } }
      ov.querySelectorAll('[data-race]').forEach(b => b.onclick = () => { S.click(); setMe({ race: b.dataset.race }); });
      ov.querySelectorAll('[data-team]').forEach(b => b.onclick = () => { S.click(); setMe({ team: +b.dataset.team }); });
      ov.querySelectorAll('[data-nai]').forEach(b => b.onclick = () => { S.click(); MP.enemies.n = +b.dataset.nai; pushLobby(); render(); });
      ov.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { S.click(); MP.enemies.diff = b.dataset.diff; pushLobby(); render(); });
      const cp = $('mpCopy'); if (cp) cp.onclick = () => { S.click(); try { navigator.clipboard.writeText(MP.code); cp.textContent = 'Copied!'; } catch (e) {} };
      const rd = $('mpReady'); if (rd) rd.onclick = () => { S.click(); setMe({ ready: !mine.ready }); };
      const st = $('mpStart'); if (st) st.onclick = () => { S.click(); if (players().some(([id, p]) => id !== 0 && !p.ready)) { S.error(); return; } const setup = buildSetup(); if (!setup) { S.error(); return; } send({ t: 'start', setup, players: [...MP.players.entries()] }); begin(setup); };
    };
    // my own choices: stored, and sent to the host (or shared by the host)
    const setMe = (o, rerender = true) => {
      const p = Object.assign(MP.players.get(MP.myId), o); try { localStorage.setItem(NAME_KEY, p.name); localStorage.setItem(RACE_KEY, p.race); } catch (e) {}
      if (MP.host) pushLobby(); else send({ t: 'me-info', info: { name: p.name, race: p.race, team: p.team, ready: !!p.ready } });
      if (rerender) render();
    };
    // the towns: one per colour that has players (they share it), then the computer kingdoms on a colour of their own
    const buildSetup = () => {
      const towns = [], ut = usedTeams().sort();
      for (const t of ut) { const ids = players().filter(([, p]) => p.team === t).map(([id]) => id); towns.push({ race: MP.players.get(ids[0]).race, team: t, ai: false, members: ids, owner: ids[0], diff: 'normal' }); }
      const free = [0, 1, 2, 3].filter(t => !ut.includes(t)), nAi = Math.min(MP.enemies.n, 4 - ut.length);
      const races = BATTLE_RACES.filter(r => !towns.some(x => x.race === r)).concat(BATTLE_RACES);
      for (let k = 0; k < nAi; k++) towns.push({ race: races[k], team: free[0], ai: true, members: [], owner: null, diff: MP.enemies.diff });
      if (new Set(towns.map(x => x.team)).size < 2) return null;
      return { mp: true, seed: Math.floor(Math.random() * 1e6), towns };
    };
    const pushLobby = () => { if (MP.host) send({ t: 'lobby', players: [...MP.players.entries()], enemies: MP.enemies, code: MP.code }); };
    const begin = (setup) => { Object.assign(SETUP, setup); delete SETUP.hero; SETUP.myRace = (MP.players.get(MP.myId) || {}).race; ov.remove(); MP.started = true; setStatus('loading'); resolve(setup); };
    net.on('ready', ({ code, id }) => {
      MP.code = code; MP.myId = id;
      if (MP.host) { me.team = 0; MP.players.set(0, Object.assign({}, me)); }
      else { send({ t: 'me-info', info: { name: me.name, race: me.race, team: null } }); }
      render();
    });
    net.on('error', (msg) => { MP.err = msg; render(); });
    net.on('join', (id) => { /* waits for me-info */ });
    net.on('leave', (id) => { const p = MP.players.get(id); MP.players.delete(id); pushLobby(); if (!MP.started) render(); else { statusPanel(); if (p && G.hooks.toast) G.hooks.toast(`${p.name} left the game`, '👋', 'bad'); } if (G.hooks.netLeave) G.hooks.netLeave(id); });
    net.on('hostleft', () => { MP.err = 'The host left the game.'; if (G.hooks.netLeave) G.hooks.netLeave(0); else render(); });
    net.on('data', (from, d) => {
      if (!d) return;
      if (d.to != null && d.to !== MP.myId) return;
      if (d.t === 'me-info' && MP.host) {
        const old = MP.players.get(from), info = Object.assign({ status: 'lobby' }, old || {}, d.info);
        // a new player joins the host's colour unless they chose one
        if (info.team == null) info.team = MP.players.get(0) ? MP.players.get(0).team : 0;
        MP.players.set(from, info); pushLobby(); render(); return;
      }
      if (d.t === 'lobby' && MP.client) { MP.players = new Map(d.players); MP.enemies = d.enemies || MP.enemies; MP.synced = true; if (!MP.started) render(); return; }
      if (d.t === 'start' && MP.client) { MP.players = new Map(d.players); begin(d.setup); return; }
      if (d.t === 'status') { const p = MP.players.get(from); if (p) { const was = p.status; p.status = d.s; if (MP.started) { statusPanel(); if (d.s === 'playing' && was !== 'playing' && G.hooks.toast) G.hooks.toast(`${p.name} has joined the battle!`, '⚔', 'gold'); } } return; }
      if (d.t === 'hero') { MP.players.set(from, Object.assign(MP.players.get(from) || {}, d.info)); if (G.hooks.netHero) G.hooks.netHero(from); return; }
      if (G.hooks.netData) G.hooks.netData(from, d);
    });
    if (MP.host) net.host(); else net.join(SETUP.code);
    render();
  });
}
// where every player is after the host starts: loading, making a hero, or in the battle
export function setStatus(s) { const p = MP.players.get(MP.myId); if (p) p.status = s; send({ t: 'status', s }); statusPanel(); }
export function statusPanel() {
  if (!MP.on || !MP.started) return;
  let d = $('mpstatus'); const list = [...MP.players.entries()].sort((a, b) => a[0] - b[0]);
  const waiting = list.filter(([, p]) => p.status !== 'playing');
  const me = MP.players.get(MP.myId), inGame = me && me.status === 'playing';
  if (inGame && !waiting.length) { if (d) d.remove(); return; }
  if (!d) { d = el('div', ''); d.id = 'mpstatus'; document.body.appendChild(d); }
  d.innerHTML = `<div class="mpsh">${waiting.length ? `Waiting for ${waiting.length} player${waiting.length > 1 ? 's' : ''}` : 'Everyone is in!'}</div>` + list.map(([id, p]) => `<div class="mpsr ${p.status || 'lobby'}"><i style="background:${TEAM_COLORS[p.team || 0]}"></i><b>${p.name}${id === MP.myId ? ' (you)' : ''}</b><span>${(STATUS[p.status] || STATUS.lobby)[1]} ${(STATUS[p.status] || STATUS.lobby)[0]}</span></div>`).join('') + (inGame && waiting.length ? '<div class="mpsf">The gates stay shut for the first 60 seconds while everyone gets in.</div>' : '');
}

// ---------------- remote heroes (other players' heroes, seen by everyone else) ----------------
let rid = 50000;
export class RemoteHero {
  constructor(netId, info, town) {
    this.remote = true; this.hero = true; this.netId = netId; this.id = rid++; this.info = info; this.town = town; this.team = town.team;
    this.heroName = info.name; this.pos = new THREE.Vector3(town.x, heightAt(town.x, town.z), town.z); this.tgt = this.pos.clone(); this.yaw = town.yaw; this.tyaw = this.yaw;
    this.hp = 100; this.maxHp = 100; this.dead = false; this.lv = 1; this.level = 1; this.radius = 0.45; this.stealth = 0; this.iframes = 0;
    this.status = { frozen: 0, stun: 0, slow: 0, bleed: 0, bleedDps: 0, burn: 0, burnDps: 0, knock: new THREE.Vector3() };
    this.def = { name: info.name, aggro: 1, boss: false, elite: false, skin: false, loot: null, size: 1, shape: 'human' };
    this.hostile = town.team !== G.myTeam; this.provoked = false; this.state = 'idle';
    const ch = buildHumanoid({ race: info.race, sex: info.sex, cls: info.cls, outfit: info.cls, app: info.app, ...(info.app || {}) });
    this.model = ch; this.root = ch.root; this.height = ch.height; this.setWeapon(info.wt || (CLASSES[info.cls] ? CLASSES[info.cls].weapons[0] : 'swordshield'));
    G.scene.add(this.root); G.mobs.push(this); MP.remotes.set(netId, this);
    this.act = ''; this.actT = 0; this.spd = 0;
  }
  get name() { return this.heroName; }
  setWeapon(wt) { if (wt === this.wt) return; this.wt = wt; try { equipWeapon(this.model, wt, 1); } catch (e) { /* unknown weapon on this client */ } }
  dist2(p) { const dx = p.x - this.pos.x, dz = p.z - this.pos.z; return dx * dx + dz * dz; }
  netState(s) { if (s.k != null) { this.kills = s.k; this.deaths = s.de || 0; } this.tgt.set(s.x, s.y, s.z); this.tyaw = s.yaw; this.hp = s.hp; this.maxHp = s.mhp; this.lv = this.level = s.lv; if (s.dead && !this.dead) { this.dead = true; this.deadT = 0; } else if (!s.dead && this.dead) { this.dead = false; this.root.visible = true; this.root.rotation.x = 0; this.pos.copy(this.tgt); } if (s.act && s.act !== this.act) { this.act = s.act; this.actT = 0; const W = WEAPON_TYPES[this.wt]; if (W && W.kind === 'gun' && (s.act === 'shoot' || s.act === 'release')) S.gunshot(this.pos, 0.9); else if (W && W.kind === 'bow' && s.act === 'release') S.bowShot(this.pos); } if (!s.act) this.act = ''; this.spd = s.spd || 0; if (s.wt) this.setWeapon(s.wt); if (s.bk != null && s.bk !== this.bk) { this.bk = s.bk; try { backWeapons(this.model, s.bk.split(',').map(x => { if (!x) return null; const [wt, tier, rarity] = x.split(':'); return { wt, tier: +tier, rarity: +rarity }; })); } catch (e) {} } }
  update(dt) {
    if (this.dead) { this.deadT = (this.deadT || 0) + dt; if (this.deadT < 1) this.root.rotation.x = -Math.min(1, this.deadT / 0.6) * Math.PI / 2; else this.root.visible = false; return; }
    this.pos.lerp(this.tgt, Math.min(1, dt * 12)); this.yaw += angDiff(this.yaw, this.tyaw) * Math.min(1, dt * 14);
    this.root.position.copy(this.pos); this.root.rotation.set(0, this.yaw, 0);
    if (this.act) this.actT = Math.min(1, this.actT + dt * 2.5);
    animateHumanoid(this.model, dt, { speed: this.spd, action: this.act || null, actionT: this.actT, armed: true });
  }
  // hit by the local player
  takeHit(dmg, src, o = {}) { if (this.dead) return 0; dmg *= pvpK(); send({ t: 'pvp', to: this.netId, dmg: Math.round(dmg), o: slim(o) }); return Math.round(dmg); }
  // hit by host-run troops, towers and mobs
  takeDamage(dmg, src, o = {}) { if (this.dead || !MP.host) return; send({ t: 'dmg', to: this.netId, dmg: Math.round(dmg), o: slim(o), sx: src && src.pos ? src.pos.x : null, sz: src && src.pos ? src.pos.z : null, slv: src && src.lv }); }
  debuff(type, t, dps) { if (MP.host) send({ t: 'debuff', to: this.netId, type, dur: t, dps }); }
  knock() {} heal() {} respawn() {} remove() { G.scene.remove(this.root); }
}
// player-vs-player damage scale: heroes hit monsters hard, but a duel between two heroes should last a while
export const PVP_K = 0.15;
// heroes grow much stronger with level, so the scale shrinks as they do: duels last about 6 to 15 seconds at every level
const pvpK = () => Math.max(PVP_K, 0.4 - 0.028 * (((G.save && G.save.level) || 1) - 1));
const slim = (o) => ({ stun: o.stun || 0, slow: o.slow || 0, freeze: o.freeze || 0, bleed: o.bleed || 0, burn: o.burn || 0, big: !!o.big });

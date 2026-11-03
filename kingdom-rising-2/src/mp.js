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
import { RACES, CLASSES } from './data.js';
import { SETUP } from './battlemap.js';
import { TEAM_COLORS, TEAM_NAMES, DIFFS, BATTLE_RACES } from './battledata.js';
import { angDiff } from './util.js';

export const MP = { on: false, host: false, client: false, net: null, myId: 0, code: '', players: new Map(), slots: [], remotes: new Map() };
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const RN = { human: 'Human', orc: 'Orc', highelf: 'High Elf', woodelf: 'Wood Elf', dwarf: 'Dwarf' };
export function send(d) { if (MP.net) MP.net.send(d); }

// ---------------- lobby ----------------
// Host gets a code straight away. Friends join with it and land in the host's town (they can move to another town).
// Towns with nobody in them are run by the computer. When the host starts, everyone makes their hero, then plays.
const NAME_KEY = 'kr2_mpname';
export function lobby() {
  return new Promise((resolve) => {
    MP.on = true; MP.host = SETUP.mp === 'host'; MP.client = !MP.host;
    let myName = ''; try { myName = localStorage.getItem(NAME_KEY) || ''; } catch (e) {}
    const me = { name: myName || (MP.host ? 'Host' : 'Friend') };
    const ov = el('div', ''); ov.id = 'mplobby'; document.body.appendChild(ov);
    const net = MP.net = new Net();
    const nameOf = (id) => { const p = MP.players.get(id); return p ? p.name : 'Player'; };
    const myTownIdx = () => MP.slots.findIndex(s => s.players.includes(MP.myId));
    const moveTo = (id, i) => { for (const s of MP.slots) s.players = s.players.filter(x => x !== id); if (MP.slots[i]) MP.slots[i].players.push(id); };
    const render = () => {
      const isHost = MP.host, focus = document.activeElement && document.activeElement.id === 'mpName';
      let html = `<div class="mpp"><div class="eyebrow">Kingdom Battles · Online</div><h1>${MP.code ? 'Game <span class="mpcode">' + MP.code + '</span>' : 'Connecting…'}</h1>`;
      html += MP.code ? `<p class="mpsub">${isHost ? 'Send this code to your friends. They choose <b>Kingdom Battles → Multiplayer → Join a game</b> and type it in. They join your town unless they pick another.' : 'You are in! The host is setting up the battle. You can stay in the host\'s town or join another one.'}</p>` : `<p class="mpsub">${MP.err || 'Reaching the matchmaking service…'}</p>`;
      if (MP.code) {
        html += `<div class="mpname"><label>Your name <input id="mpName" maxlength="16" value="${String(me.name).replace(/"/g, '&quot;')}"></label><span class="dim">You make your hero after the game starts.</span></div>`;
        const homeI = Math.max(0, MP.slots.findIndex(s => s.players.includes(0))), home = MP.slots[homeI], foes = MP.slots.filter((s, i) => i !== homeI);
        const others = MP.slots.filter((s, i) => i !== homeI && s.players.length);
        // your kingdom: everyone shares the host's town
        html += `<div class="mpk mine"><div class="mpkh"><b>👑 Your kingdom</b><span>${home.players.length} player${home.players.length === 1 ? '' : 's'} · everyone here shares this town, its army and its gold</span></div><div class="mpkp">${home.players.map(id => `<span class="mpchip${id === MP.myId ? ' me' : ''}">${nameOf(id)}${id === MP.myId ? ' (you)' : ''}${id === 0 ? ' 👑' : ''}</span>`).join('') || '<span class="dim">Nobody yet</span>'}</div>`;
        if (isHost) html += `<div class="mpkr"><span>Town race</span>${BATTLE_RACES.map(r => `<button class="seg${home.race === r ? ' on' : ''}" data-hrace="${r}">${RN[r]}</button>`).join('')}</div>`;
        else if (!home.players.includes(MP.myId)) html += `<button class="btn gold" data-join="${homeI}">Join this kingdom</button>`;
        html += '</div>';
        // the enemy
        const aiFoes = foes.filter(s => !s.players.length), diff = (aiFoes[0] || {}).diff || 'normal';
        html += `<div class="mpk"><div class="mpkh"><b>⚔ The enemy</b><span>${foes.length} enemy kingdom${foes.length === 1 ? '' : 's'}${others.length ? ` (${others.length} with players)` : ''}</span></div>`;
        if (isHost) html += `<div class="mpkr"><span>How many</span>${[1, 2, 3].map(n => `<button class="seg${foes.length === n ? ' on' : ''}" data-nfoes="${n}">${n}</button>`).join('')}</div><div class="mpkr"><span>How hard</span>${Object.keys(DIFFS).map(d => `<button class="seg${diff === d ? ' on' : ''}" data-diff="${d}">${DIFFS[d].name}</button>`).join('')}</div>`;
        else html += `<p class="dim">${foes.map(s => RN[s.race]).join(', ')} · ${DIFFS[diff].name}</p>`;
        html += '</div>';
        // more options: teams, races and splitting players across towns
        html += `<details class="mpmore"${MP.more ? ' open' : ''}><summary>More options: teams, races, play against each other</summary><div class="mpslots">`;
        MP.slots.forEach((s, i) => {
          const here = s.players.includes(MP.myId), pl = s.players.map(id => `<span class="mpchip${id === MP.myId ? ' me' : ''}">${nameOf(id)}${id === MP.myId ? ' (you)' : ''}</span>`).join('');
          html += `<div class="mpslot${here ? ' mine' : ''}"><div class="mpdot" style="background:${TEAM_COLORS[s.team]}"></div><div class="mpwho"><b>Town ${i + 1} · ${RN[s.race]}</b><small>${s.players.length ? pl : `Computer · ${DIFFS[s.diff || 'normal'].name}`}</small></div>`;
          if (isHost) {
            html += `<label>Team <select data-i="${i}" data-k="team">${[0, 1, 2, 3].map(t => `<option value="${t}" ${s.team === t ? 'selected' : ''}>${TEAM_NAMES[t]}</option>`).join('')}</select></label>`;
            html += `<label>Race <select data-i="${i}" data-k="race">${BATTLE_RACES.map(r => `<option value="${r}" ${s.race === r ? 'selected' : ''}>${RN[r]}</option>`).join('')}</select></label>`;
          } else html += `<span class="mpteam">${TEAM_NAMES[s.team]} team</span>`;
          if (!here) html += `<button class="btn mpjoin" data-join="${i}">Move here</button>`;
          html += '</div>';
        });
        html += '</div></details>';
        if (isHost) html += `<div class="mprow"><button class="btn gold big" id="mpStart">Start the game</button></div>`;
        else html += '<p class="mpsub dim">Waiting for the host to start…</p>';
      } else if (MP.err) html += '<div class="mprow"><button class="btn" id="mpBack">← Back to title</button></div>';
      html += '</div>';
      ov.innerHTML = html;
      const ni = $('mpName'); if (ni) { ni.onkeydown = (e) => e.stopPropagation(); ni.oninput = () => { me.name = ni.value.trim().slice(0, 16) || 'Player'; try { localStorage.setItem(NAME_KEY, me.name); } catch (e) {} MP.players.set(MP.myId, Object.assign(MP.players.get(MP.myId) || {}, me)); if (MP.host) pushLobby(); else send({ t: 'me-info', info: me }); }; ni.onchange = () => render(); if (focus) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); } }
      ov.querySelectorAll('select').forEach(sel => sel.onchange = () => { const s = MP.slots[+sel.dataset.i]; const k = sel.dataset.k; s[k] = k === 'team' ? +sel.value : sel.value; pushLobby(); render(); });
      ov.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const s = MP.slots[+b.dataset.rm]; const home = MP.slots.find(x => x.players.includes(0)); if (home) home.players.push(...s.players); MP.slots.splice(+b.dataset.rm, 1); pushLobby(); render(); });
      ov.querySelectorAll('[data-join]').forEach(b => b.onclick = () => { S.click(); const i = +b.dataset.join; if (MP.host) { moveTo(MP.myId, i); pushLobby(); render(); } else send({ t: 'pick', slot: i }); });
      ov.querySelectorAll('[data-hrace]').forEach(b => b.onclick = () => { S.click(); const h = MP.slots.find(x => x.players.includes(0)); h.race = b.dataset.hrace; pushLobby(); render(); });
      ov.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { S.click(); for (const x of MP.slots) if (!x.players.length) x.diff = b.dataset.diff; pushLobby(); render(); });
      ov.querySelectorAll('[data-nfoes]').forEach(b => b.onclick = () => { S.click(); const n = +b.dataset.nfoes, homeI = Math.max(0, MP.slots.findIndex(x => x.players.includes(0))); let foes = MP.slots.length - 1;
        const diff = (MP.slots.find((x, i) => i !== homeI && !x.players.length) || {}).diff || 'normal', used = new Set(MP.slots.map(x => x.race));
        while (foes < n) { const race = BATTLE_RACES.find(r => !used.has(r)) || 'orc'; used.add(race); MP.slots.push({ players: [], race, team: 1, diff }); foes++; }
        while (foes > n) { const k = MP.slots.map((x, i) => i).reverse().find(i => i !== homeI && !MP.slots[i].players.length); if (k == null) break; MP.slots.splice(k, 1); foes--; }
        pushLobby(); render(); });
      const more = ov.querySelector('.mpmore'); if (more) more.ontoggle = () => { MP.more = more.open; };
      const add = $('mpAdd'); if (add) add.onclick = () => { MP.slots.push({ players: [], race: BATTLE_RACES[MP.slots.length % 5], team: MP.slots.length, diff: 'normal' }); pushLobby(); render(); };
      const st = $('mpStart'); if (st) st.onclick = () => {
        if (new Set(MP.slots.map(s => s.team)).size < 2) { S.error(); alertTeams(); return; }
        const setup = { mp: true, seed: Math.floor(Math.random() * 1e6), towns: MP.slots.map(s => ({ race: s.race, team: s.team, ai: !s.players.length, members: s.players.slice(), owner: s.players.length ? s.players[0] : null, diff: s.diff || 'normal' })) };
        send({ t: 'start', setup, players: [...MP.players.entries()] }); begin(setup);
      };
      const bk = $('mpBack'); if (bk) bk.onclick = () => { location.href = location.pathname; };
    };
    const alertTeams = () => { const p = ov.querySelector('.mpp .dim:last-child'); if (p) { p.textContent = 'Put at least one town on a different team colour, so there is someone to fight.'; p.style.color = '#ff9a7a'; } };
    const pushLobby = () => { if (MP.host) send({ t: 'lobby', slots: MP.slots, players: [...MP.players.entries()], code: MP.code }); };
    const begin = (setup) => { Object.assign(SETUP, setup); delete SETUP.hero; ov.remove(); resolve(setup); };
    net.on('ready', ({ code, id }) => {
      MP.code = code; MP.myId = id; MP.players.set(id, Object.assign({}, me));
      if (MP.host) MP.slots = [{ players: [0], race: 'human', team: 0, diff: 'normal' }, { players: [], race: 'orc', team: 1, diff: 'normal' }];
      else send({ t: 'me-info', info: me });
      render();
    });
    net.on('error', (msg) => { MP.err = msg; render(); });
    net.on('join', (id) => { /* waits for me-info */ });
    net.on('leave', (id) => { MP.players.delete(id); for (const s of MP.slots) s.players = s.players.filter(x => x !== id); pushLobby(); render(); if (G.hooks.netLeave) G.hooks.netLeave(id); });
    net.on('hostleft', () => { MP.err = 'The host left the game.'; if (G.hooks.netLeave) G.hooks.netLeave(0); else render(); });
    net.on('data', (from, d) => {
      if (!d) return;
      if (d.to != null && d.to !== MP.myId) return;
      if (d.t === 'me-info' && MP.host) { MP.players.set(from, Object.assign(MP.players.get(from) || {}, d.info)); if (!MP.slots.some(s => s.players.includes(from))) { const home = MP.slots.find(s => s.players.includes(0)) || MP.slots[0]; home.players.push(from); } pushLobby(); render(); return; }
      if (d.t === 'pick' && MP.host) { if (MP.slots[d.slot]) { moveTo(from, d.slot); pushLobby(); render(); } return; }
      if (d.t === 'lobby' && MP.client) { MP.slots = d.slots; MP.players = new Map(d.players); render(); return; }
      if (d.t === 'start' && MP.client) { MP.players = new Map(d.players); begin(d.setup); return; }
      if (d.t === 'hero') { MP.players.set(from, Object.assign(MP.players.get(from) || {}, d.info)); if (G.hooks.netHero) G.hooks.netHero(from); return; }
      if (G.hooks.netData) G.hooks.netData(from, d);
    });
    if (MP.host) net.host(); else net.join(SETUP.code);
    render();
  });
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
  netState(s) { if (s.k != null) { this.kills = s.k; this.deaths = s.de || 0; } this.tgt.set(s.x, s.y, s.z); this.tyaw = s.yaw; this.hp = s.hp; this.maxHp = s.mhp; this.lv = this.level = s.lv; if (s.dead && !this.dead) { this.dead = true; this.deadT = 0; } else if (!s.dead && this.dead) { this.dead = false; this.root.visible = true; this.root.rotation.x = 0; this.pos.copy(this.tgt); } if (s.act && s.act !== this.act) { this.act = s.act; this.actT = 0; } if (!s.act) this.act = ''; this.spd = s.spd || 0; if (s.wt) this.setWeapon(s.wt); if (s.bk != null && s.bk !== this.bk) { this.bk = s.bk; try { backWeapons(this.model, s.bk.split(',').map(x => { if (!x) return null; const [wt, tier, rarity] = x.split(':'); return { wt, tier: +tier, rarity: +rarity }; })); } catch (e) {} } }
  update(dt) {
    if (this.dead) { this.deadT = (this.deadT || 0) + dt; if (this.deadT < 1) this.root.rotation.x = -Math.min(1, this.deadT / 0.6) * Math.PI / 2; else this.root.visible = false; return; }
    this.pos.lerp(this.tgt, Math.min(1, dt * 12)); this.yaw += angDiff(this.yaw, this.tyaw) * Math.min(1, dt * 14);
    this.root.position.copy(this.pos); this.root.rotation.set(0, this.yaw, 0);
    if (this.act) this.actT = Math.min(1, this.actT + dt * 2.5);
    animateHumanoid(this.model, dt, { speed: this.spd, action: this.act || null, actionT: this.actT, armed: true });
  }
  // hit by the local player
  takeHit(dmg, src, o = {}) { if (this.dead) return 0; dmg *= PVP_K; send({ t: 'pvp', to: this.netId, dmg: Math.round(dmg), o: slim(o) }); return Math.round(dmg); }
  // hit by host-run troops, towers and mobs
  takeDamage(dmg, src, o = {}) { if (this.dead || !MP.host) return; send({ t: 'dmg', to: this.netId, dmg: Math.round(dmg), o: slim(o), sx: src && src.pos ? src.pos.x : null, sz: src && src.pos ? src.pos.z : null, slv: src && src.lv }); }
  debuff(type, t, dps) { if (MP.host) send({ t: 'debuff', to: this.netId, type, dur: t, dps }); }
  knock() {} heal() {} respawn() {} remove() { G.scene.remove(this.root); }
}
// player-vs-player damage scale: heroes hit monsters hard, but a duel between two heroes should last a while
export const PVP_K = 0.4;
const slim = (o) => ({ stun: o.stun || 0, slow: o.slow || 0, freeze: o.freeze || 0, bleed: o.bleed || 0, burn: o.burn || 0, big: !!o.big });

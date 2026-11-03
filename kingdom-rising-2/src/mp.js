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
export function lobby() {
  return new Promise((resolve) => {
    MP.on = true; MP.host = SETUP.mp === 'host'; MP.client = !MP.host;
    const me = { name: SETUP.hero.name, cls: SETUP.hero.cls, race: SETUP.race || SETUP.hero.race || 'human', sex: SETUP.hero.sex, app: SETUP.hero.app };
    const ov = el('div', ''); ov.id = 'mplobby'; document.body.appendChild(ov);
    const net = MP.net = new Net();
    const render = () => {
      const isHost = MP.host;
      let html = `<div class="mpp"><div class="eyebrow">Kingdom Battles · Online</div><h1>${MP.code ? 'Game <span class="mpcode">' + MP.code + '</span>' : 'Connecting…'}</h1>`;
      html += MP.code ? `<p class="mpsub">${isHost ? 'Send this code to your friends. They choose <b>Kingdom Battles → Multiplayer → Join a game</b>.' : 'You are in! The host is setting up the battle.'}</p>` : `<p class="mpsub">${MP.err || 'Reaching the matchmaking service…'}</p>`;
      if (MP.code) {
        html += '<div class="mpslots">';
        MP.slots.forEach((s, i) => {
          const pl = s.owner != null ? MP.players.get(s.owner) : null;
          html += `<div class="mpslot"><div class="mpdot" style="background:${TEAM_COLORS[s.team]}"></div><div class="mpwho"><b>${pl ? pl.name + (s.owner === MP.myId ? ' (you)' : '') : 'Computer'}</b><small>${pl ? `${RN[pl.race]} ${CLASSES[pl.cls] ? CLASSES[pl.cls].name : ''}` : `${RN[s.race]} · ${DIFFS[s.diff].name}`}</small></div>`;
          if (isHost) {
            html += `<label>Team <select data-i="${i}" data-k="team">${[0, 1, 2, 3].map(t => `<option value="${t}" ${s.team === t ? 'selected' : ''}>${TEAM_NAMES[t]}</option>`).join('')}</select></label>`;
            if (s.owner == null) html += `<label>Race <select data-i="${i}" data-k="race">${BATTLE_RACES.map(r => `<option value="${r}" ${s.race === r ? 'selected' : ''}>${RN[r]}</option>`).join('')}</select></label><label>Difficulty <select data-i="${i}" data-k="diff">${Object.keys(DIFFS).map(d => `<option value="${d}" ${s.diff === d ? 'selected' : ''}>${DIFFS[d].name}</option>`).join('')}</select></label>${i > 0 && MP.slots.length > 2 ? `<button class="btn mprm" data-rm="${i}">✕</button>` : ''}`;
          } else html += `<span class="mpteam">${TEAM_NAMES[s.team]} team</span>`;
          html += '</div>';
        });
        html += '</div>';
        if (isHost) html += `<div class="mprow">${MP.slots.length < 4 ? '<button class="btn" id="mpAdd">+ Add a computer town</button>' : ''}<button class="btn gold big" id="mpStart">Start the battle</button></div><p class="mpsub dim">Players on the same team share a side. Everyone needs a different team from at least one other town.</p>`;
        else html += '<p class="mpsub dim">Waiting for the host to start…</p>';
      } else if (MP.err) html += '<div class="mprow"><button class="btn" id="mpBack">← Back to title</button></div>';
      html += '</div>';
      ov.innerHTML = html;
      ov.querySelectorAll('select').forEach(sel => sel.onchange = () => { const s = MP.slots[+sel.dataset.i]; const k = sel.dataset.k; s[k] = k === 'team' ? +sel.value : sel.value; pushLobby(); render(); });
      ov.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { MP.slots.splice(+b.dataset.rm, 1); pushLobby(); render(); });
      const add = $('mpAdd'); if (add) add.onclick = () => { MP.slots.push({ owner: null, race: BATTLE_RACES[MP.slots.length % 5], team: MP.slots.length, diff: 'normal' }); pushLobby(); render(); };
      const st = $('mpStart'); if (st) st.onclick = () => {
        if (new Set(MP.slots.map(s => s.team)).size < 2) { S.error(); return; }
        const setup = { mp: true, seed: Math.floor(Math.random() * 1e6), towns: MP.slots.map(s => ({ race: s.owner != null ? MP.players.get(s.owner).race : s.race, team: s.team, ai: s.owner == null, owner: s.owner, diff: s.diff || 'normal', name: s.owner != null ? null : null })) };
        send({ t: 'start', setup, players: [...MP.players.entries()] }); begin(setup);
      };
      const bk = $('mpBack'); if (bk) bk.onclick = () => { location.href = location.pathname; };
    };
    const pushLobby = () => { if (MP.host) send({ t: 'lobby', slots: MP.slots, players: [...MP.players.entries()], code: MP.code }); };
    const begin = (setup) => { Object.assign(SETUP, setup); ov.remove(); resolve(setup); };
    net.on('ready', ({ code, id }) => {
      MP.code = code; MP.myId = id; MP.players.set(id, me);
      if (MP.host) { MP.slots = [{ owner: 0, team: 0 }, { owner: null, race: me.race === 'orc' ? 'human' : 'orc', team: 1, diff: 'normal' }]; }
      else send({ t: 'me-info', info: me });
      render();
    });
    net.on('error', (msg) => { MP.err = msg; render(); });
    net.on('join', (id) => { /* waits for me-info */ });
    net.on('leave', (id) => { MP.players.delete(id); const s = MP.slots.find(x => x.owner === id); if (s) { s.owner = null; s.race = s.race || 'orc'; s.diff = 'normal'; } pushLobby(); render(); if (G.hooks.netLeave) G.hooks.netLeave(id); });
    net.on('hostleft', () => { MP.err = 'The host left the game.'; if (G.hooks.netLeave) G.hooks.netLeave(0); else render(); });
    net.on('data', (from, d) => {
      if (!d) return;
      if (d.to != null && d.to !== MP.myId) return;
      if (d.t === 'me-info' && MP.host) { MP.players.set(from, d.info); if (!MP.slots.some(s => s.owner === from)) { const free = MP.slots.find(s => s.owner == null); if (free) { free.owner = from; } else if (MP.slots.length < 4) MP.slots.push({ owner: from, team: MP.slots.length }); } pushLobby(); render(); return; }
      if (d.t === 'lobby' && MP.client) { MP.slots = d.slots; MP.players = new Map(d.players); render(); return; }
      if (d.t === 'start' && MP.client) { MP.players = new Map(d.players); begin(d.setup); return; }
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
  netState(s) { this.tgt.set(s.x, s.y, s.z); this.tyaw = s.yaw; this.hp = s.hp; this.maxHp = s.mhp; this.lv = this.level = s.lv; if (s.dead && !this.dead) { this.dead = true; this.deadT = 0; } else if (!s.dead && this.dead) { this.dead = false; this.root.visible = true; this.root.rotation.x = 0; this.pos.copy(this.tgt); } if (s.act && s.act !== this.act) { this.act = s.act; this.actT = 0; } if (!s.act) this.act = ''; this.spd = s.spd || 0; if (s.wt) this.setWeapon(s.wt); if (s.bk != null && s.bk !== this.bk) { this.bk = s.bk; try { backWeapons(this.model, s.bk.split(',').map(x => { if (!x) return null; const [wt, tier, rarity] = x.split(':'); return { wt, tier: +tier, rarity: +rarity }; })); } catch (e) {} } }
  update(dt) {
    if (this.dead) { this.deadT = (this.deadT || 0) + dt; if (this.deadT < 1) this.root.rotation.x = -Math.min(1, this.deadT / 0.6) * Math.PI / 2; else this.root.visible = false; return; }
    this.pos.lerp(this.tgt, Math.min(1, dt * 12)); this.yaw += angDiff(this.yaw, this.tyaw) * Math.min(1, dt * 14);
    this.root.position.copy(this.pos); this.root.rotation.set(0, this.yaw, 0);
    if (this.act) this.actT = Math.min(1, this.actT + dt * 2.5);
    animateHumanoid(this.model, dt, { speed: this.spd, action: this.act || null, actionT: this.actT, armed: true });
  }
  // hit by the local player
  takeHit(dmg, src, o = {}) { if (this.dead) return 0; send({ t: 'pvp', to: this.netId, dmg: Math.round(dmg), o: slim(o) }); return Math.round(dmg); }
  // hit by host-run troops, towers and mobs
  takeDamage(dmg, src, o = {}) { if (this.dead || !MP.host) return; send({ t: 'dmg', to: this.netId, dmg: Math.round(dmg), o: slim(o), sx: src && src.pos ? src.pos.x : null, sz: src && src.pos ? src.pos.z : null, slv: src && src.lv }); }
  debuff(type, t, dps) { if (MP.host) send({ t: 'debuff', to: this.netId, type, dur: t, dps }); }
  knock() {} heal() {} respawn() {} remove() { G.scene.remove(this.root); }
}
const slim = (o) => ({ stun: o.stun || 0, slow: o.slow || 0, freeze: o.freeze || 0, bleed: o.bleed || 0, burn: o.burn || 0, big: !!o.big });

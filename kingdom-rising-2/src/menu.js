// Title screen (campaign saves) and the hero creator with a 3D preview.
import * as THREE from 'three';
import { RACES, CLASSES, WEAPON_TYPES, STAT_NAMES, CLASS_POOLS, poolsAt, ABILITIES, weaponStat, slotSkills, WSKILLS, FAMILIES, COMBOS } from './data.js';
import { listSaves, deleteSave, canCreate, MAX_SAVES, fmtTime, fmtDate, putSave } from './saves.js';
import { buildHumanoid, equipWeapon, animateHumanoid } from './character.js';
import { newHero } from './game.js';
import { S, A, M } from './audio.js';
import { confirmBox, openSettings, openControls, closeWin } from './ui.js';
import { G } from './state.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CLS_ICON = { warrior: '🛡', ranger: '🏹', wizard: '🔥' };

export const Menu = { onPlay: null, preview: null };

export function showTitle() {
  $('title').hidden = false; $('creator').hidden = true;
  M.play('title');
  renderSaves();
}
function renderSaves() {
  const saves = listSaves(); const box = $('saves'); box.innerHTML = '';
  $('btnNew').disabled = !canCreate();
  $('slotCount').textContent = `${saves.length} / ${MAX_SAVES} campaigns` + (canCreate() ? '' : ' (delete one to start another)');
  for (const s of saves) {
    const d = el('div', 'save', `<div class="crest">${CLS_ICON[s.cls]}</div><div class="info"><b>${esc(s.name)}</b><div class="sub">Level ${s.level} ${RACES[s.race].name} ${CLASSES[s.cls].name}</div><div class="meta"><span>⏱ ${fmtTime(s.timePlayed)} played</span><span>📍 ${esc(s.zone || '')}</span><span>📜 ${s.quests.done.length} quests</span><span style="color:var(--dim)">${fmtDate(s.lastPlayed)}</span></div></div>`);
    const acts = el('div', 'acts');
    const play = el('button', 'btn gold', '▶ Play'); play.onclick = (e) => { e.stopPropagation(); S.click(); goFull(); Menu.onPlay(s); };
    const del = el('button', 'btn red', '🗑'); del.title = 'Delete this campaign';
    del.onclick = (e) => { e.stopPropagation(); S.click(); confirmBox(`Delete <b>${esc(s.name)}</b> (level ${s.level} ${CLASSES[s.cls].name})?<br><span style="color:var(--dim)">This can't be undone.</span>`, () => { deleteSave(s.id); renderSaves(); }, 'Keep', 'Delete'); };
    acts.append(play, del); d.appendChild(acts);
    d.onclick = () => { S.click(); goFull(); Menu.onPlay(s); };
    d.onmouseenter = () => S.hover();
    box.appendChild(d);
  }
}
export function goFull() { const d = document.documentElement; if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(() => {}); }

export function initMenu() {
  $('btnNew').onclick = () => { S.click(); goFull(); if (canCreate()) showCreator(); };
  $('btnSettingsT').onclick = () => { S.click(); openSettings(false); };
  $('btnControlsT').onclick = () => { S.click(); openControls(false); };
  $('btnFull').onclick = () => { S.click(); goFull(); };
  for (const b of document.querySelectorAll('#title .btn')) b.addEventListener('mouseenter', () => S.hover());
  $('cBack').onclick = () => { S.click(); closeCreator(); showTitle(); };
  $('cPrev').onclick = () => { S.click(); if (tab > 0) { tab--; renderCreator(); } };
  $('cNext').onclick = () => { S.click(); if (tab < TABS.length - 1) { tab++; renderCreator(); } else finish(); };
  buildPreview();
}

// ---------- creator ----------
const TABS = ['Race', 'Class', 'Body', 'Look', 'Name'];
const START = { warrior: 'swordshield', ranger: 'bow', wizard: 'firestaff' };
const START_NAME = { warrior: 'Sword (main hand) and Shield (off hand)', ranger: 'Longbow', wizard: 'Fire Staff' };
let tab = 0, C = null;
const NAMES = { highelf: { m: ['Aerendil', 'Thalion', 'Caelith', 'Elrian', 'Ilyon', 'Vaelor'], f: ['Galawen', 'Aerith', 'Isilme', 'Lirael', 'Naeva', 'Sereth'] }, woodelf: { m: ['Faelar', 'Sylvar', 'Rhovan', 'Tamlin', 'Orrin'], f: ['Lyralei', 'Elowen', 'Fenna', 'Sylwen', 'Wren'] }, dwarf: { m: ['Thorin', 'Borin', 'Durgan', 'Grimli', 'Balgrim'], f: ['Helga', 'Dagna', 'Brunhild', 'Kathra', 'Ingrid'] } };
function defaults() { return { race: 'highelf', sex: 'm', cls: 'warrior', weapon: 'swordshield', name: '', app: { skin: RACES.highelf.skins[1], hair: RACES.highelf.hairs[0], beardCol: null, hairStyle: 1, beard: 0, height: 1, build: 0 } }; }
export function showCreator() {
  C = defaults(); tab = 0;
  $('title').hidden = true; $('creator').hidden = false;
  Menu.preview.active = true; rebuildPreview(); renderCreator();
}
function closeCreator() { $('creator').hidden = true; Menu.preview.active = false; }
function renderCreator() {
  const tabs = $('cTabs'); tabs.innerHTML = '';
  TABS.forEach((t, i) => { const b = el('button', 'tab' + (i === tab ? ' on' : ''), `${i + 1}. ${t}`); b.onclick = () => { S.click(); tab = i; renderCreator(); }; tabs.appendChild(b); });
  const body = $('cBody'); body.innerHTML = '';
  $('cPrev').disabled = tab === 0; $('cNext').textContent = tab === TABS.length - 1 ? '⚔ Begin Adventure' : 'Next →';
  const choice = (list, cur, onPick) => { const g = el('div', 'choice'); for (const o of list) { const c = el('button', 'card' + (o.id === cur ? ' on' : ''), `${o.icon ? `<div class="ico">${o.icon}</div>` : ''}<b>${o.name}</b>${o.small ? `<small>${o.small}</small>` : ''}`); c.onclick = () => { S.click(); onPick(o.id); renderCreator(); rebuildPreview(); }; c.onmouseenter = () => S.hover(); g.appendChild(c); } return g; };
  const R = RACES[C.race];
  if (tab === 0) {
    body.appendChild(el('h3', '', 'Choose your race'));
    body.appendChild(choice(Object.keys(RACES).filter(k => RACES[k].playable).map(k => ({ id: k, name: RACES[k].name, icon: k === 'dwarf' ? '🧔' : '🧝', small: k === 'highelf' ? 'Wise & magical' : k === 'woodelf' ? 'Agile & keen-eyed' : 'Strong & tough' })), C.race, (id) => { C.race = id; const r = RACES[id]; C.app.skin = r.skins[1]; C.app.hair = r.hairs[0]; C.app.beard = id === 'dwarf' && C.sex === 'm' ? 3 : 0; C.app.hairStyle = C.sex === 'f' ? (id === 'dwarf' ? 4 : 1) : id === 'dwarf' ? 0 : 1; }));
    body.appendChild(el('div', 'desc', `${R.desc}<div class="statrow">${Object.keys(STAT_NAMES).map(k => `<span>${STAT_NAMES[k]} <b>${R.stats[k]}</b></span>`).join('')}</div><div style="color:var(--dim);font-size:13px;margin-top:6px">Your race sets your starting stats. They only rise further through gear.</div>`));
    body.appendChild(el('h3', '', 'Body type')).style.marginTop = '14px';
    body.appendChild(choice([{ id: 'm', name: 'Male', icon: '♂' }, { id: 'f', name: 'Female', icon: '♀' }], C.sex, (id) => { C.sex = id; C.app.hairStyle = id === 'f' ? (C.race === 'dwarf' ? 4 : 1) : C.race === 'dwarf' ? 0 : 1; C.app.beard = id === 'f' ? 0 : C.race === 'dwarf' ? 3 : 0; }));
  } else if (tab === 1) {
    body.appendChild(el('h3', '', 'Choose your class'));
    body.appendChild(choice(Object.keys(CLASSES).map(k => ({ id: k, name: CLASSES[k].name, icon: CLS_ICON[k], small: k === 'warrior' ? 'Melee & shields' : k === 'ranger' ? 'Bows & blades' : 'Fire, frost & arcane' })), C.cls, (id) => { C.cls = id; C.weapon = START[id]; }));
    const P0 = poolsAt(C.cls, 1), P20 = poolsAt(C.cls, 20);
    body.appendChild(el('div', 'desc', `${CLASSES[C.cls].desc}<div class="statrow"><span>❤ Health ${P0.hp} → ${P20.hp}</span>${P0.mana ? `<span>💧 Mana ${P0.mana} → ${P20.mana}</span>` : ''}<span>⚡ Endurance ${P0.end} → ${P20.end}</span></div><div style="margin-top:10px"><b style="color:var(--gold)">Class abilities</b> (they cost ${CLASS_POOLS[C.cls].uses === 'mana' ? 'mana' : 'endurance'}):${ABILITIES[C.cls].map(a => `<div style="margin-top:4px"><span class="kbd">${a.key}</span> <b>${a.name}</b> <span style="color:var(--dim)">(level ${a.level})</span><br><span style="font-size:14px">${a.desc}</span></div>`).join('')}</div>`));
  } else if (tab === 99) {
    body.appendChild(el('h3', '', 'Choose your starting weapon'));
    body.appendChild(el('p', '', `<span style="color:var(--dim)">A worn starter weapon. Craft or loot better ones later. Every ${CLASSES[C.cls].name} weapon can be equipped, and you can carry two and swap with Q.</span>`));
    const ic = { swordshield: '🛡', maceshield: '🔨', swordmace: '⚔', greatsword: '🗡', greataxe: '🪓', warhammer: '🔨', spear: '🔱', daggers: '🗡', handaxes: '🪓', bow: '🏹', firestaff: '🔥', froststaff: '❄', arcanestaff: '✨' };
    body.appendChild(choice(CLASSES[C.cls].weapons.map(w => ({ id: w, name: WEAPON_TYPES[w].name, icon: ic[w], small: WEAPON_TYPES[w].hands === 'two' ? 'Two-handed' : WEAPON_TYPES[w].hands === 'dual' ? 'Dual wield' : WEAPON_TYPES[w].hands === 'shield' ? 'Best block' : WEAPON_TYPES[w].kind === 'bow' ? 'Ranged' : 'Spells' })), C.weapon, (id) => { C.weapon = id; }));
    const W = WEAPON_TYPES[C.weapon];
    const lmb = W.kind === 'melee' ? (W.hands === 'dual' ? 'Swing both weapons in turn, then a crossing finisher (3-hit combo)' : '3-hit combo: two different swings, then a big finisher') : W.kind === 'bow' ? 'Shoot an arrow. Arrows drop over distance.' : W.element === 'fire' ? 'Fireball. Drops a little over long range.' : W.element === 'frost' ? 'Ice shard that slows.' : 'Fast arcane bolt.';
    const tr = COMBOS[C.weapon];
    body.appendChild(el('div', 'desc', `<b style="color:var(--gold2)">${W.name}</b><div style="margin-top:6px"><span class="kbd">Left click</span> ${lmb}</div>${tr ? `<div style="margin-top:4px"><span class="kbd">Combo</span> ${tr.chain.length} attacks · ${tr.trait}</div>` : ''}<div style="margin-top:4px"><span class="kbd">Right click</span> Block: stops ${Math.round(W.block * 100)}% of damage</div><div style="margin-top:4px;color:var(--dim)">Bigger weapons swing slower but hit harder. Damage scales with ${STAT_NAMES[weaponStat(C.weapon)]}.</div>`));
  } else if (tab === 2) {
    const f = (label, input) => { const d = el('div', 'field'); d.appendChild(el('label', '', label)); d.appendChild(input); body.appendChild(d); };
    const range = (k, min, max, step, lbls) => { const w = el('div'); const i = el('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = C.app[k]; i.oninput = () => { C.app[k] = +i.value; rebuildPreview(); }; w.appendChild(i); w.appendChild(el('div', '', `<div style="display:flex;justify-content:space-between;color:var(--dim);font-size:13px"><span>${lbls[0]}</span><span>${lbls[1]}</span></div>`)); return w; };
    body.appendChild(el('h3', '', 'Shape your body'));
    f('Height', range('height', 0.9, 1.1, 0.01, ['Short', 'Tall']));
    f('Build', range('build', -1, 1, 0.05, ['Skinny', 'Strong']));
    body.appendChild(el('p', '', '<span style="color:var(--dim)">Purely how you look. Your stats come from your race and gear.</span>'));
  } else if (tab === 3) {
    const sw = (label, list, k) => { const d = el('div', 'field'); d.appendChild(el('label', '', label)); const s = el('div', 'swatches'); for (const c of list) { const b = el('button', 'sw' + (C.app[k] === c ? ' on' : '')); b.style.background = c; b.onclick = () => { S.click(); C.app[k] = c; renderCreator(); rebuildPreview(); }; s.appendChild(b); } d.appendChild(s); body.appendChild(d); };
    body.appendChild(el('h3', '', 'Appearance'));
    sw('Skin', R.skins, 'skin'); sw('Hair colour', R.hairs, 'hair');
    const hs = el('div', 'field'); hs.appendChild(el('label', '', 'Hair style'));
    hs.appendChild(choice([{ id: 0, name: 'Short' }, { id: 1, name: 'Long' }, { id: 2, name: 'Ponytail' }, { id: 4, name: 'Braids' }, { id: 3, name: 'Bald' }], C.app.hairStyle, (id) => { C.app.hairStyle = id; })); body.appendChild(hs);
    if (C.sex === 'm') {
      sw('Beard colour', [null, ...R.hairs].filter(Boolean), 'beardCol');
      const bs = el('div', 'field'); bs.appendChild(el('label', '', 'Beard'));
      bs.appendChild(choice([{ id: 0, name: 'None' }, { id: 1, name: 'Stubble' }, { id: 2, name: 'Full' }, { id: 3, name: 'Long' }], C.app.beard, (id) => { C.app.beard = id; })); body.appendChild(bs);
    }
  } else if (tab === 4) {
    body.appendChild(el('h3', '', 'Name your hero'));
    const i = el('input'); i.type = 'text'; i.maxLength = 18; i.placeholder = 'Enter a name'; i.value = C.name; i.oninput = () => { C.name = i.value; }; i.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') finish(); };
    const d = el('div', 'field'); d.appendChild(i); body.appendChild(d);
    const rnd = el('button', 'btn', '🎲 Random name'); rnd.onclick = () => { const l = NAMES[C.race][C.sex]; C.name = l[Math.floor(Math.random() * l.length)]; i.value = C.name; }; body.appendChild(rnd);
    body.appendChild(el('div', 'desc', `<b style="color:var(--gold2)">${RACES[C.race].name} ${CLASSES[C.cls].name}</b> · ${C.sex === 'm' ? 'Male' : 'Female'}<br>Starting weapon: ${START_NAME[C.cls]}<div class="statrow">${Object.keys(STAT_NAMES).map(k => `<span>${STAT_NAMES[k]} <b>${RACES[C.race].stats[k]}</b></span>`).join('')}</div><p style="margin:10px 0 0">You wake on a lonely beach beside the wreck of your raft, with no memory of how you got there...</p>`));
    setTimeout(() => i.focus(), 50);
  }
}
function finish() {
  if (!C.name.trim()) { tab = 4; renderCreator(); S.error(); const i = document.querySelector('#cBody input'); if (i) { i.style.borderColor = '#ff6a5a'; i.focus(); } return; }
  const h = newHero({ name: C.name.trim().slice(0, 18), race: C.race, cls: C.cls, sex: C.sex, weapon: C.weapon, app: Object.assign({}, C.app) });
  putSave(h);
  closeCreator();
  goFull();
  Menu.onPlay(h);
}

// ---------- preview scene ----------
function buildPreview() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d0b10');
  scene.fog = new THREE.Fog('#0d0b10', 8, 20);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight('#c8d8ff', '#3a2a1a', 1.0));
  const key = new THREE.DirectionalLight('#fff0d8', 2.4); key.position.set(3, 5, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key);
  const rim = new THREE.DirectionalLight('#ffb060', 1.6); rim.position.set(-4, 3, -3); scene.add(rim);
  const torch = new THREE.PointLight('#ff9040', 3, 8, 2); torch.position.set(-1.6, 1.8, 1); scene.add(torch);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.25, 40), new THREE.MeshStandardMaterial({ color: '#4a4038', roughness: 0.9 })); floor.position.y = -0.125; floor.receiveShadow = true; scene.add(floor);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.3, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6a1e1a', roughness: 1 })); rug.position.y = 0.005; rug.receiveShadow = true; scene.add(rug);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.03, 6, 48).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d8b04a', metalness: 0.8, roughness: 0.3 })); ring.position.y = 0.01; scene.add(ring);
  const holder = new THREE.Group(); scene.add(holder);
  Menu.preview = { scene, cam, holder, ch: null, active: false, rot: 0.4, torch };
  setTimeout(() => { if (G.envMap) { scene.environment = G.envMap; scene.environmentIntensity = 0.6; } }, 0);
  let drag = null;
  addEventListener('pointerdown', (e) => { if (Menu.preview.active && e.clientX > innerWidth * 0.4) drag = e.clientX; });
  addEventListener('pointermove', (e) => { if (drag != null) { Menu.preview.rot += (e.clientX - drag) * 0.01; drag = e.clientX; } });
  addEventListener('pointerup', () => drag = null);
}
function rebuildPreview() {
  const P = Menu.preview; if (!P) return;
  if (P.ch) P.holder.clear();
  const ch = buildHumanoid(Object.assign({ race: C.race, sex: C.sex, cls: C.cls }, C.app));
  equipWeapon(ch, C.weapon, 0, 0);
  ch.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  P.holder.add(ch.root); P.ch = ch;
}
export function renderPreview(renderer, dt) {
  const P = Menu.preview; if (!P || !P.active || !P.ch) return false;
  const w = innerWidth, h = innerHeight, side = innerWidth > 900 ? Math.min(520, Math.max(360, w * 0.32)) : 0;
  animateHumanoid(P.ch, dt, { speed: 0, armed: true });
  renderStage(renderer, { left: side, top: 0, width: w - side, height: h }, P.ch, P.rot, 2.35);
  return true;
}
// draw a character on the torch-lit stage into a screen rectangle (creator preview, inventory portrait)
export function renderStage(renderer, rect, ch, rot, dist = 2.1) {
  const P = Menu.preview;
  if (P.holder.children[0] !== ch.root) { P.holder.clear(); P.holder.add(ch.root); }
  P.holder.rotation.y = rot;
  const ht = ch.height;
  P.cam.aspect = rect.width / rect.height; P.cam.position.set(0, ht * 0.6, ht * dist + 1.2); P.cam.lookAt(0, ht * 0.5, 0); P.cam.updateProjectionMatrix();
  P.torch.intensity = 2.6 + Math.sin(performance.now() * 0.013) * 0.4 + Math.sin(performance.now() * 0.031) * 0.3;
  const y = innerHeight - rect.top - rect.height;
  renderer.setViewport(rect.left, y, rect.width, rect.height); renderer.setScissor(rect.left, y, rect.width, rect.height); renderer.setScissorTest(true);
  renderer.render(P.scene, P.cam);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
}

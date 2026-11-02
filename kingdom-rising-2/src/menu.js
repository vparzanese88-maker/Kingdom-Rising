// Title screen (campaign saves) and the hero creator with a 3D preview.
import * as THREE from 'three';
import { RACES, CLASSES, WEAPON_TYPES, STAT_NAMES, CLASS_POOLS, poolsAt, ABILITIES, weaponStat, slotSkills, WSKILLS, FAMILIES, COMBOS } from './data.js';
import { listSaves, deleteSave, canCreate, MAX_SAVES, fmtTime, fmtDate, putSave, listCampaigns, MAX_CHARS } from './saves.js';
import { buildHumanoid, equipWeapon, animateHumanoid } from './character.js';
import { newHero } from './game.js';
import { S, A, M } from './audio.js';
import { confirmBox, openSettings, openControls, closeWin } from './ui.js';
import { G } from './state.js';
import * as Icons from './icons.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CLS_ICON = { berserker: '🪓', warrior: '🛡', ranger: '🏹', wizard: '🔥' };

export const Menu = { onPlay: null, preview: null };

export function showTitle() {
  $('title').hidden = false; $('creator').hidden = true;
  M.play('title');
  renderSaves();
}
const CLS_WPN = { berserker: { kind: 'weapon', wt: 'greataxe', tier: 2, rarity: 0 }, warrior: { kind: 'weapon', wt: 'swordshield', tier: 2, rarity: 0 }, ranger: { kind: 'weapon', wt: 'bow', tier: 2, rarity: 0 }, wizard: { kind: 'weapon', wt: 'firestaff', tier: 2, rarity: 0 } };
function renderSaves() {
  const saves = listSaves(), camps = listCampaigns(); const box = $('saves'); box.innerHTML = '';
  $('btnNew').disabled = !canCreate();
  $('btnNew').querySelector('small').textContent = canCreate() ? 'Start a new world with a new hero' : 'All 5 campaign slots are used: delete one first';
  $('slotCount').textContent = `${camps.length} of ${MAX_SAVES} campaigns`;
  const last = saves[0];
  $('btnContinue').hidden = !last;
  if (last) { $('contSub').textContent = `${last.name} · Level ${last.level} ${RACES[last.race].name} ${CLASSES[last.cls].name} · ${last.zone || ''}`; $('btnContinue').onclick = () => { S.click(); goFull(); Menu.onPlay(last); }; }
  if (!saves.length) { box.appendChild(el('div', 'emptysaves', '<b>No campaigns yet</b>Choose <i>New Campaign</i> to create your first hero. You can keep up to five campaigns, each with up to five characters.')); return; }
  for (const c of camps) {
    const g = el('div', 'camp');
    g.appendChild(el('div', 'camph', `<div><div class="eyebrow">Campaign</div><b>${esc(c.name)}</b></div><span class="dim">${c.chars.length} of ${MAX_CHARS} characters</span>`));
    for (const s of c.chars) {
      const d = el('div', 'save', `<div class="crest">${Icons.itemSvg(CLS_WPN[s.cls])}</div><div class="info"><b>${esc(s.name)}</b><div class="sub">Level ${s.level} · ${RACES[s.race].name} ${CLASSES[s.cls].name}</div><div class="meta"><span>${esc(s.zone || 'Driftwood Coast')}</span><span>${fmtTime(s.timePlayed)} played</span><span>${s.quests.done.length} quests</span></div></div>`);
      const acts = el('div', 'acts');
      const play = el('button', 'btn gold', 'Play'); play.onclick = (e) => { e.stopPropagation(); S.click(); goFull(); Menu.onPlay(s); };
      const del = el('button', 'btn ghost', 'Delete'); del.title = 'Delete this character';
      del.onclick = (e) => { e.stopPropagation(); S.click(); confirmBox(`<div class="eyebrow">Delete character</div><h3 style="margin:6px 0">${esc(s.name)}</h3>Level ${s.level} ${RACES[s.race].name} ${CLASSES[s.cls].name}, ${fmtTime(s.timePlayed)} played.<br><span style="color:var(--mut)">This can't be undone.</span>`, () => { deleteSave(s.id); renderSaves(); }, 'Keep', 'Delete'); };
      acts.append(play, del); d.appendChild(acts);
      d.onclick = () => { S.click(); goFull(); Menu.onPlay(s); };
      d.onmouseenter = () => S.hover();
      g.appendChild(d);
    }
    if (c.chars.length < MAX_CHARS) { const nb = el('button', 'btn newchar', '+ New Character in this campaign'); nb.onclick = () => { S.click(); goFull(); showCreator({ id: c.id, name: c.name }); }; g.appendChild(nb); }
    box.appendChild(g);
  }
}
export function goFull() { const d = document.documentElement; if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(() => {}); }

export function initMenu() {
  $('btnNew').onclick = () => { S.click(); goFull(); if (canCreate()) showCreator(null); };
  $('btnSettingsT').onclick = () => { S.click(); openSettings(false); };
  $('btnControlsT').onclick = () => { S.click(); openControls(false); };
  $('btnFull').onclick = () => { S.click(); goFull(); };
  for (const b of document.querySelectorAll('#title .mm, #title .btn')) b.addEventListener('mouseenter', () => S.hover());
  $('cBack').onclick = () => { S.click(); closeCreator(); showTitle(); };
  $('cPrev').onclick = () => { S.click(); if (tab > 0) { tab--; renderCreator(); } };
  $('cNext').onclick = () => { S.click(); if (tab < TABS.length - 1) { tab++; renderCreator(); } else finish(); };
  buildPreview();
}

// ---------- creator ----------
const TABS = ['Race', 'Class', 'Body', 'Look', 'Name'];
const START = { berserker: 'greataxe', warrior: 'swordshield', ranger: 'bow', wizard: 'firestaff' };
const START_NAME = { berserker: 'Great Axe', warrior: 'Sword (main hand) and Shield (off hand)', ranger: 'Longbow', wizard: 'Fire Staff' };
let tab = 0, C = null;
const NAMES = { highelf: { m: ['Aerendil', 'Thalion', 'Caelith', 'Elrian', 'Ilyon', 'Vaelor'], f: ['Galawen', 'Aerith', 'Isilme', 'Lirael', 'Naeva', 'Sereth'] }, woodelf: { m: ['Faelar', 'Sylvar', 'Rhovan', 'Tamlin', 'Orrin'], f: ['Lyralei', 'Elowen', 'Fenna', 'Sylwen', 'Wren'] }, dwarf: { m: ['Thorin', 'Borin', 'Durgan', 'Grimli', 'Balgrim'], f: ['Helga', 'Dagna', 'Brunhild', 'Kathra', 'Ingrid'] } };
function defaults() { return { race: 'highelf', sex: 'm', cls: 'warrior', weapon: 'swordshield', name: '', app: { skin: RACES.highelf.skins[1], hair: RACES.highelf.hairs[0], beardCol: null, hairStyle: 1, beard: 0, height: 1, build: 0 } }; }
export function showCreator(camp) {
  C = defaults(); tab = 0; C.camp = camp || null; $('cEyebrow').textContent = camp ? 'New character · ' + camp.name : 'New Campaign';
  $('title').hidden = true; $('creator').hidden = false;
  Menu.preview.active = true; rebuildPreview(); renderCreator();
}
function closeCreator() { $('creator').hidden = true; Menu.preview.active = false; }
const RACE_INFO = {
  highelf: { tag: 'Wise & magical', icon: '🧝', best: 'Wizard', lore: 'The last of the Silver Courts, tall and proud, with long ears and a memory that stretches back centuries. Magic runs in their blood.', perk: 'Highest Intellect: stronger spells and a bigger mana pool.' },
  woodelf: { tag: 'Swift & keen-eyed', icon: '🧝', best: 'Ranger', lore: 'Sun-browned hunters of the deep forests. They move without a sound and never miss what they aim at.', perk: 'Highest Dexterity: harder hitting bows and blades, more critical hits, faster endurance recovery.' },
  orc: { tag: 'Brutal & mighty', icon: '👹', best: 'Berserker', lore: 'Huge, tusked and green-skinned, orcs are raised for war and fear nothing. What they lack in subtlety they make up for in sheer strength.', perk: 'Highest Strength and great Stamina, plus 15 bonus health. Hits harder than anyone.' },
  dwarf: { tag: 'Stout & unbreakable', icon: '🧔', best: 'Warrior', lore: 'Short, broad and stubborn as the mountains they carve. A dwarf in armour is a wall with a beard.', perk: 'Highest Strength and Stamina, plus 20 bonus health. Hard to kill.' },
};
const CLASS_INFO = {
  berserker: { tag: 'Wild fighter', diff: 1, role: 'Heavy melee damage', res: 'Endurance', start: 'Great Axe', tips: ['Leap Strike into a group, then roar Battle Cry and keep swinging.', 'Intimidating Shout freezes everything around you with fear.', 'You wear light armour: Bloodrage heals you as you deal damage.'] },
  warrior: { tag: 'Shield soldier', diff: 1, role: 'Tank and steady damage', res: 'Endurance', start: 'Sword (main hand) and Shield (off hand)', tips: ['Get close and chain your 3-hit sword combo with left click.', 'Hold F to raise your shield and stop most of the damage; right click for Wheel Strike.', 'Charge in, Shield Bash to stun, and Shield Wall when the fight turns against you.'] },
  ranger: { tag: 'Ranged hunter', diff: 2, role: 'Ranged damage and mobility', res: 'Endurance', start: 'Longbow', tips: ['Keep your distance: arrows drop over long range, so aim a little high.', 'Spectral Arrow pierces a whole line of enemies.', 'Smoke Roll hides you and makes your next hit deal double damage.'] },
  wizard: { tag: 'Spell caster', diff: 3, role: 'Area damage and control', res: 'Mana', start: 'Fire Staff', tips: ['Fireballs arc and explode: hit groups from a safe distance.', 'Frost Nova freezes everything near you; Blink gets you out.', 'Watch your mana; Mana Surge makes everything free for a while.'] },
};
const STAT_MAX = 18;
function statBars(st) { return `<div class="bars">${Object.keys(STAT_NAMES).map(k => `<span>${STAT_NAMES[k]}</span><div class="bt"><i style="width:${st[k] / STAT_MAX * 100}%"></i></div><b>${st[k]}</b>`).join('')}</div>`; }
function renderSummary() {
  const R = RACES[C.race], K = CLASSES[C.cls], P = poolsAt(C.cls, 1);
  $('cSum').innerHTML = `<div class="eyebrow">Your hero</div><h3>${esc(C.name.trim() || 'Unnamed')}</h3><div class="sub">${R.name} ${K.name} · ${C.sex === 'm' ? 'Male' : 'Female'}</div>${statBars(R.stats)}<div class="kv"><span>Health</span><b>${P.hp + R.hp + R.stats.sta * 6}</b></div>${P.mana ? `<div class="kv"><span>Mana</span><b>${P.mana + R.stats.int * 6}</b></div>` : ''}<div class="kv"><span>Endurance</span><b>${P.end + R.stats.dex * 2}</b></div><div class="kv"><span>Starts with</span><b style="text-align:right">${CLASS_INFO[C.cls].start}</b></div>`;
}
function renderCreator() {
  const tabs = $('cTabs'); tabs.innerHTML = '';
  TABS.forEach((t, i) => { const b = el('button', (i === tab ? 'on' : i < tab ? 'done' : ''), `<span class="n">${i < tab ? '✓' : i + 1}</span>${t}`); b.onclick = () => { S.click(); tab = i; renderCreator(); }; tabs.appendChild(b); });
  const body = $('cBody'); body.innerHTML = '';
  $('cPrev').disabled = tab === 0; $('cNext').textContent = tab === TABS.length - 1 ? 'Begin Adventure' : 'Next';
  const opt = (o, on, pick) => { const c = el('button', 'opt' + (on ? ' on' : ''), `<div class="oi">${o.icon || ''}</div><div><b>${o.name}</b>${o.small ? `<small>${o.small}</small>` : ''}</div>${o.tag ? `<span class="tagr">${o.tag}</span>` : ''}`); c.onclick = () => { S.click(); pick(); renderCreator(); rebuildPreview(); }; c.onmouseenter = () => S.hover(); return c; };
  const seg = (list, cur, pick) => { const g = el('div', 'segs'); for (const o of list) g.appendChild(opt(o, o.id === cur, () => pick(o.id))); return g; };
  const R = RACES[C.race];
  const intro = (t) => body.appendChild(el('p', 'cintro', t));
  const sect = (t) => body.appendChild(el('div', 'sect', t));
  if (tab === 0) {
    intro('Your race shapes how you look and sets your starting attributes. Attributes only grow further through the gear you find and craft.');
    sect('Race');
    for (const k of Object.keys(RACES).filter(k => RACES[k].playable)) body.appendChild(opt({ name: RACES[k].name, icon: RACE_INFO[k].icon, small: RACE_INFO[k].tag, tag: 'Best as ' + RACE_INFO[k].best }, C.race === k, () => { C.race = k; const r = RACES[k]; C.app.skin = r.skins[1]; C.app.hair = r.hairs[0]; C.app.beard = k === 'dwarf' && C.sex === 'm' ? 3 : 0; C.app.hairStyle = C.sex === 'f' ? (k === 'dwarf' ? 4 : 1) : k === 'dwarf' ? 0 : 1; }));
    body.appendChild(el('div', 'lore', `${RACE_INFO[C.race].lore}<br><b style="color:var(--g1)">${RACE_INFO[C.race].perk}</b>`));
    body.appendChild(el('div', '', statBars(R.stats) + '<p class="cintro" style="margin-top:10px;font-size:13px;color:var(--mut)">Strength: melee damage. Dexterity: bows, daggers, spears, crits and endurance. Intellect: spells and mana. Stamina: health.</p>'));
    sect('Body type');
    body.appendChild(seg([{ id: 'm', name: 'Male', icon: '♂' }, { id: 'f', name: 'Female', icon: '♀' }], C.sex, (id) => { C.sex = id; C.app.hairStyle = id === 'f' ? (C.race === 'dwarf' ? 4 : 1) : C.race === 'dwarf' ? 0 : 1; C.app.beard = id === 'f' ? 0 : C.race === 'dwarf' ? 3 : 0; }));
  } else if (tab === 1) {
    intro('Your class decides how you fight, which abilities you learn and what weapon you start with. Every class can gather, craft and do every quest.');
    sect('Class');
    for (const k of Object.keys(CLASSES)) body.appendChild(opt({ name: CLASSES[k].name, icon: `<div style="width:38px;height:38px">${Icons.itemSvg(CLS_WPN[k])}</div>`, small: CLASS_INFO[k].role, tag: CLASS_INFO[k].tag }, C.cls === k, () => { C.cls = k; C.weapon = START[k]; }));
    const I = CLASS_INFO[C.cls], P0 = poolsAt(C.cls, 1), P20 = poolsAt(C.cls, 20);
    body.appendChild(el('div', 'lore', `${CLASSES[C.cls].desc}<div class="chips"><span>Difficulty <span class="diff">${[1, 2, 3].map(i => `<i class="${i <= I.diff ? 'on' : ''}"></i>`).join('')}</span></span><span>Uses ${I.res}</span><span>Starts with: ${I.start}</span><span>Health ${P0.hp} → ${P20.hp} at level 20</span></div>`));
    sect('How to play');
    body.appendChild(el('ul', 'tips', I.tips.map(t => `<li>${t}</li>`).join('')));
    sect('Class abilities');
    body.appendChild(el('p', 'cintro', `You learn five abilities as you level up (levels 1, 4, 7, 10 and 14). Each goes on your hotbar when learned; put any three on keys 1, 2 and 3 in Class Talents (N). They cost ${I.res.toLowerCase()}.`));
    for (const a of ABILITIES[C.cls]) body.appendChild(el('div', 'abl', `<div class="ai">${Icons.abilityIcon(a.id)}</div><div><b>${a.name}</b> <span style="color:var(--mut)">level ${a.level}</span><br>${a.desc} <span style="color:var(--mut)">${a.cost ? a.cost + ' ' + I.res.toLowerCase() : 'free'}</span></div>`));
  } else if (tab === 2) {
    intro('Shape your hero. This is purely how you look; your attributes come from your race and gear.');
    const f = (label, input) => { const d = el('div', 'field'); d.appendChild(el('label', '', label)); d.appendChild(input); body.appendChild(d); };
    const range = (k, min, max, step, lbls) => { const w = el('div'); const i = el('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = C.app[k]; i.oninput = () => { C.app[k] = +i.value; rebuildPreview(); }; w.appendChild(i); w.appendChild(el('div', '', `<div style="display:flex;justify-content:space-between;color:var(--mut);font-size:13px"><span>${lbls[0]}</span><span>${lbls[1]}</span></div>`)); return w; };
    sect('Body');
    f('Height', range('height', 0.9, 1.1, 0.01, ['Short', 'Tall']));
    f('Build', range('build', -1, 1, 0.05, ['Slender', 'Muscular']));
  } else if (tab === 3) {
    intro('Choose your colouring and hair. Drag the hero on the right to see every side.');
    const sw = (label, list, k) => { const d = el('div', 'field'); d.appendChild(el('label', '', label)); const s = el('div', 'swatches'); for (const c of list) { const b = el('button', 'sw' + (C.app[k] === c ? ' on' : '')); b.style.background = c; b.onclick = () => { S.click(); C.app[k] = c; renderCreator(); rebuildPreview(); }; s.appendChild(b); } d.appendChild(s); body.appendChild(d); };
    sect('Colours'); sw('Skin', R.skins, 'skin'); sw('Hair', R.hairs, 'hair');
    sect('Hair style');
    const hsg = el('div', 'segs'); hsg.style.flexWrap = 'wrap'; for (const o of [{ id: 0, name: 'Short' }, { id: 1, name: 'Long' }, { id: 2, name: 'Ponytail' }, { id: 4, name: 'Braids' }, { id: 3, name: 'Bald' }]) { const b = opt(o, C.app.hairStyle === o.id, () => { C.app.hairStyle = o.id; }); b.style.flex = '1 0 28%'; b.querySelector('.oi').remove(); hsg.appendChild(b); } body.appendChild(hsg);
    if (C.sex === 'm') {
      sect('Beard'); sw('Beard colour', R.hairs, 'beardCol');
      const bg = el('div', 'segs'); for (const o of [{ id: 0, name: 'None' }, { id: 1, name: 'Stubble' }, { id: 2, name: 'Full' }, { id: 3, name: 'Long' }]) { const b = opt(o, C.app.beard === o.id, () => { C.app.beard = o.id; }); b.querySelector('.oi').remove(); bg.appendChild(b); } body.appendChild(bg);
    }
  } else if (tab === 4) {
    intro('Last step. Give your hero a name, then begin. You will wake on a lonely beach beside the wreck of your raft, with no memory of how you got there.');
    sect('Name');
    const i = el('input'); i.type = 'text'; i.maxLength = 18; i.placeholder = 'Enter a name'; i.value = C.name; i.oninput = () => { C.name = i.value; renderSummary(); }; i.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') finish(); };
    const d = el('div', 'field'); d.appendChild(i); body.appendChild(d);
    const rnd = el('button', 'btn', 'Suggest a name'); rnd.onclick = () => { const l = NAMES[C.race][C.sex]; C.name = l[Math.floor(Math.random() * l.length)]; i.value = C.name; renderSummary(); }; body.appendChild(rnd);
    sect('Your first steps');
    body.appendChild(el('ul', 'tips', ['Head up the beach to Seabreak Village and talk to Elder Maren (gold <b style="color:#ffd84a">!</b> above her head).', 'Villagers teach you to chop trees, mine, gather cotton, skin animals and craft better gear.', 'Wolves, bears, tigers and goblins attack on sight: watch for the red crossed swords above their names.'].map(t => `<li>${t}</li>`).join('')));
    setTimeout(() => i.focus(), 50);
  }
  renderSummary();
}
function finish() {
  if (!C.name.trim()) { tab = 4; renderCreator(); S.error(); const i = document.querySelector('#cBody input'); if (i) { i.style.borderColor = '#ff6a5a'; i.focus(); } return; }
  const h = newHero({ name: C.name.trim().slice(0, 18), race: C.race, cls: C.cls, sex: C.sex, weapon: C.weapon, app: Object.assign({}, C.app) });
  h.campaign = C.camp ? C.camp.id : 'c' + h.id; h.campaignName = C.camp ? C.camp.name : `${h.name}'s Campaign`;
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

// Entry point: renderer, main loop and menu wiring.
import * as THREE from 'three';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { Net } from './net.js';
import { RoomNet } from './roomnet.js';
import { PeerNet } from './peernet.js';
import { setMapSize, WORLD, MAP_SIZES, CLASSES, CLASS_IDS, DEFAULT_CLASS } from './config.js';
import { ClassPicker } from './classpick.js';
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../vendor/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('app').appendChild(renderer.domElement);

// Post-processing: glow on fire, magic and the sun, then a filmic grade (warmth, contrast, vignette).
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.32 }, saturation: { value: 1.12 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float vignette; uniform float saturation; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 col = mix(vec3(l), c.rgb, saturation);
      col *= vec3(1.04, 1.0, 0.95);                       // golden hour
      vec2 d = vUv - 0.5;
      col *= 1.0 - vignette * smoothstep(0.25, 0.85, length(d * vec2(1.25, 1.0)));
      gl_FragColor = vec4(col, c.a);
    }`,
};
let composer = null, renderPass = null, bloomPass = null;
function setupComposer(on) {
  if (!on) { composer = null; return; }
  if (!composer) {
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(null, null);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.5, 0.86);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(new ShaderPass(GradeShader));
    composer.addPass(new OutputPass());
  }
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
}

const ui = new UI();
const audio = new Audio();
const input = new Input(renderer.domElement);

// map size (remembered per browser); the world is rebuilt when it changes
let mapSize = 'medium';
try { mapSize = localStorage.getItem('cw-map') || 'medium'; } catch (e) { /* storage unavailable */ }
if (!MAP_SIZES[mapSize]) mapSize = 'medium';

let game;
function buildGame(size) {
  setMapSize(size);
  game = new Game(renderer, ui, audio, input);
  game.state = 'menu';
  game.mapBuiltFor = size;
  ui.mapBg = null;
  window.__game = game; // handy for debugging from the console
}
try {
  buildGame(mapSize);
} catch (e) {
  console.error(e);
  $('loading').textContent = 'Failed to start: ' + e.message;
  throw e;
}
$('loading').classList.add('hidden');
$('cover').classList.remove('hidden');

// drifting embers behind the cover title
for (let i = 0; i < 46; i++) {
  const e = document.createElement('span');
  e.className = 'ember';
  e.style.left = `${Math.random() * 100}%`;
  e.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
  e.style.animationDuration = `${5 + Math.random() * 7}s`;
  e.style.animationDelay = `${-Math.random() * 10}s`;
  const k = 0.5 + Math.random();
  e.style.width = e.style.height = `${3 * k}px`;
  $('cover').appendChild(e);
}

// Cover screen: one click goes full screen and opens the menu.
function goFullscreen() {
  const el = document.documentElement;
  try {
    const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen && el.webkitRequestFullscreen();
    if (r && r.catch) r.catch(() => {});
  } catch (e) { /* full screen not allowed here: play in the window */ }
}
function leaveCover() {
  if ($('cover').classList.contains('hidden')) return;
  goFullscreen();
  audio.init();
  audio.play('horn');
  $('cover').classList.add('gone');
  setTimeout(() => $('cover').classList.add('hidden'), 600);
  $('menu').classList.remove('hidden');
}
$('cover').addEventListener('click', leaveCover);
addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !$('cover').classList.contains('hidden')) { e.preventDefault(); leaveCover(); } });
function toggleFullscreen(e) {
  e.stopPropagation();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else goFullscreen();
}
$('fsBtn').addEventListener('click', toggleFullscreen);
$('pauseFs').addEventListener('click', toggleFullscreen);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); }
  game.camera.aspect = innerWidth / innerHeight;
  game.camera.updateProjectionMatrix();
  game.fx.setScale(innerHeight * renderer.getPixelRatio());
}
addEventListener('resize', resize);
resize();

// graphics quality (remembered per browser)
let quality = 'medium';
try { quality = localStorage.getItem('cw-quality') || 'medium'; } catch (e) { /* storage unavailable */ }
function setQuality(q) {
  quality = q;
  game.setQuality(q);
  setupComposer(q !== 'low');
  document.querySelectorAll('.quality button').forEach((b) => b.classList.toggle('active', b.dataset.q === q));
  try { localStorage.setItem('cw-quality', q); } catch (e) { /* ignore */ }
}
document.querySelectorAll('.quality button').forEach((b) => b.addEventListener('click', () => setQuality(b.dataset.q)));
setQuality(quality);

let difficulty = 'normal';
document.querySelectorAll('#difficulty button').forEach((b) => {
  b.addEventListener('click', () => {
    difficulty = b.dataset.d;
    document.querySelectorAll('#difficulty button').forEach((o) => o.classList.toggle('active', o === b));
  });
});

function selectMap(size) {
  mapSize = size;
  document.querySelectorAll('#mapsize button').forEach((b) => b.classList.toggle('active', b.dataset.m === size));
  $('mapDesc').textContent = MAP_SIZES[size].desc;
  try { localStorage.setItem('cw-map', size); } catch (e) { /* ignore */ }
}
document.querySelectorAll('#mapsize button').forEach((b) => b.addEventListener('click', () => selectMap(b.dataset.m)));
selectMap(mapSize);

// rebuild the world if the chosen map size differs from the one on screen
function ensureMap(size) {
  if (WORLD.size === size && game.mapBuiltFor === size) return;
  const net0 = game.net;
  renderer.renderLists.dispose();
  buildGame(size);
  game.net = net0;
  game.setQuality(quality);
  resize();
}

function begin(diff, setup = null, map = mapSize) {
  $('fsBtn').classList.add('hidden');
  input.pressed.clear(); // the Enter or number key that picked a class must not also act in the battle
  ensureMap(map);
  if (net) game.net = net;
  audio.init();
  $('menu').classList.add('hidden');
  $('lobby').classList.add('hidden');
  ui.showHud();
  game.start(diff, setup);
  input.lock();
}

// ---------------- class selection ----------------
const PICK_SECONDS = 20;
const picker = new ClassPicker();

$('play').addEventListener('click', () => {
  audio.init();
  $('menu').classList.add('hidden');
  picker.open({
    seconds: PICK_SECONDS,
    note: 'The battle starts when the timer runs out, or press Ready.',
    onReady: (cls) => { picker.close(); begin(difficulty, { mode: 'single', localTeam: 0, players: [{ team: 0, name: 'You', cls }] }); },
    onTimeout: (cls) => { picker.close(); begin(difficulty, { mode: 'single', localTeam: 0, players: [{ team: 0, name: 'You', cls }] }); },
  });
});

// One-per-battle classes held by somebody, as { wizard: 'Name' }, seen from one team.
function takenFor(picks, team) {
  const out = {};
  for (const [t, p] of picks) if (t !== team && CLASSES[p.cls] && CLASSES[p.cls].unique) out[p.cls] = p.name;
  return out;
}

// ---------------- online play ----------------
let net = null;
let lobby = [];      // [{ team, name, netId }]
let coop = false;    // lobby game mode chosen by the host
let myTeam = 1;      // a joining player's castle
const playerName = () => ($('pname').value.trim() || 'Lord').slice(0, 16);
try { $('pname').value = localStorage.getItem('cw-name') || ''; } catch (e) { /* storage unavailable */ }
const rememberName = () => { try { localStorage.setItem('cw-name', playerName()); } catch (e) { /* ignore */ } };

// Online play goes through the Castle Wars server when the page comes from one, otherwise through
// the claude.ai live room when the game is opened as an artifact there.
let liveRoom = null;
let direct = false;
const onlineReady = Net.available().then(async (ok) => {
  if (!ok) liveRoom = await RoomNet.open();
  // served as plain files (GitHub Pages and the like): players connect browser to browser
  if (!ok && !liveRoom) direct = PeerNet.available();
  return ok || !!liveRoom || direct;
});

// Multiplayer panel on the main menu
const showMultiplayer = async () => {
  const can = await onlineReady;
  $('online').classList.toggle('hidden', !can);
  $('offlineNote').classList.toggle('hidden', can);
  $('mpBtn').classList.add('active');
  if (can) ($('pname').value ? $('joinCode').value ? $('joinBtn') : $('hostBtn') : $('pname')).focus();
};
$('mpBtn').addEventListener('click', showMultiplayer);

// opened from an invite link (?join=CODE): open the panel with the code filled in
const invited = (new URLSearchParams(location.search).get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
if (invited.length === 4) {
  $('joinCode').value = invited;
  $('inviteBanner').textContent = `You're invited to game ${invited}. Enter your name and press Join.`;
  $('inviteBanner').classList.remove('hidden');
  showMultiplayer();
}

for (const id of ['pname', 'joinCode']) {
  $(id).addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    $($('joinCode').value.trim().length === 4 ? 'joinBtn' : 'hostBtn').click();
  });
}

$('copyInvite').addEventListener('click', async () => {
  const el = $('inviteLink');
  try { await navigator.clipboard.writeText(el.value); }
  catch (e) { el.select(); try { document.execCommand('copy'); } catch (e2) { /* ignore */ } }
  $('copyInvite').textContent = 'Copied!';
  setTimeout(() => { $('copyInvite').textContent = 'Copy Invite'; }, 1500);
});

async function connect() {
  if (!(await onlineReady)) throw new Error('Online play is not available here.');
  net = liveRoom ? new RoomNet(liveRoom) : direct ? new PeerNet() : new Net();
  game.net = net;
  await net.connect();
  net.on('error', (msg) => { ui.lobbyError(msg); net.close(); $('lobby').classList.add('hidden'); $('menu').classList.remove('hidden'); });
  net.on('closed', () => {
    if (game.state === 'playing' && game.mode === 'client') game.finish(-1, 'Lost connection to the server.');
  });
  net.on('hostleft', () => {
    if (game.state === 'playing') game.finish(-1, 'The host left the game.');
    else { ui.lobbyError('The host closed the game.'); $('lobby').classList.add('hidden'); $('menu').classList.remove('hidden'); }
  });
}

$('hostBtn').addEventListener('click', async () => {
  rememberName();
  ui.lobbyError('');
  try { await connect(); } catch (e) { ui.lobbyError(e.message); return; }
  lobby = [{ team: 0, name: playerName(), netId: null }];
  const broadcast = () => { ui.renderLobby(lobby, 0, coop); net.toAll({ k: 'lobby', players: lobby, coop }); };
  for (const b of document.querySelectorAll('#lobbyModes button')) {
    b.onclick = () => { coop = b.dataset.mode === 'coop'; broadcast(); };
  }
  net.on('created', (m) => { ui.showLobby(m.code, true); broadcast(); });
  net.on('peer', (m) => {
    const used = new Set(lobby.map((p) => p.team));
    const team = [1].find((t) => !used.has(t));
    if (team === undefined) return;
    lobby.push({ team, name: m.name, netId: m.id });
    broadcast();
  });
  net.on('leave', (id) => { lobby = lobby.filter((p) => p.netId !== id); broadcast(); if (picks) { for (const t of [...picks.keys()]) if (!lobby.some((p) => p.team === t)) picks.delete(t); sendPicks(); } });
  net.on('data', ({ from, d }) => {
    if (!d || d.a !== 'pick' || !picks) return;
    const pl = lobby.find((p) => p.netId === from);
    if (pl) hostPick(pl.team, String(d.cls), !!d.ready);
  });
  net.create(playerName());
});

// Host side of class selection: everyone picks at once, the host keeps the list and settles clashes.
let picks = null;            // team -> { cls, name, ready }
let picksClosed = false;
function sendPicks() {
  if (!picks) return;
  const list = [...picks.entries()].map(([team, p]) => [team, p.cls, p.name, p.ready ? 1 : 0]);
  net.toAll({ k: 'picks', picks: list });
  picker.setTaken(takenFor(picks, 0));
  const waiting = lobby.filter((p) => !(picks.get(p.team) || {}).ready).map((p) => p.name);
  picker.setWaiting(waiting.length ? `Waiting for: ${waiting.join(', ')}` : 'Everyone is ready!');
}
function hostPick(team, cls, ready) {
  if (picksClosed || !CLASSES[cls]) return;
  const name = (lobby.find((p) => p.team === team) || {}).name || 'Lord';
  // only one wizard: whoever picked it first keeps it
  if (CLASSES[cls].unique && [...picks.entries()].some(([t, p]) => t !== team && p.cls === cls)) cls = (picks.get(team) || {}).cls || DEFAULT_CLASS;
  if (CLASSES[cls].unique && [...picks.entries()].some(([t, p]) => t !== team && p.cls === cls)) cls = DEFAULT_CLASS;
  picks.set(team, { cls, name, ready: ready || (picks.get(team) || {}).ready });
  sendPicks();
  if (lobby.every((p) => (picks.get(p.team) || {}).ready)) finishPicks();
}
function finishPicks() {
  if (picksClosed) return;
  picksClosed = true;
  picker.close();
  const players = lobby.map((p) => ({ ...p, cls: (picks.get(p.team) || {}).cls || DEFAULT_CLASS }));
  // the AI lord of any empty castle picks now, so every screen agrees; still only one wizard
  const taken = new Set(players.map((p) => p.cls));
  const aiClasses = {};
  for (const team of [0, 1]) {
    if (players.some((p) => p.team === team)) continue;
    const pool = CLASS_IDS.filter((c) => !(CLASSES[c].unique && taken.has(c)));
    aiClasses[team] = pool[Math.floor(Math.random() * pool.length)];
    taken.add(aiClasses[team]);
  }
  net.toAll({ k: 'start', diff: difficulty, players: players.map((p) => ({ team: p.team, name: p.name, netId: p.netId, cls: p.cls })), map: mapSize, coop, aiClasses });
  begin(difficulty, { mode: 'host', localTeam: 0, players, coop, aiClasses });
}

$('startOnline').addEventListener('click', () => {
  picks = new Map();
  picksClosed = false;
  net.toAll({ k: 'pickstart', t: PICK_SECONDS });
  $('lobby').classList.add('hidden');
  picker.open({
    seconds: PICK_SECONDS,
    onPick: (cls) => hostPick(0, cls, false),
    onReady: (cls) => hostPick(0, cls, true),
    onTimeout: () => finishPicks(),
  });
});

$('joinBtn').addEventListener('click', async () => {
  rememberName();
  ui.lobbyError('');
  const code = $('joinCode').value.trim().toUpperCase();
  if (code.length !== 4) { ui.lobbyError('Enter the 4-letter room code from the host.'); return; }
  try { await connect(); } catch (e) { ui.lobbyError(e.message); return; }
  net.on('joined', (m) => { myTeam = m.id; ui.showLobby(m.code, false); });
  net.on('data', ({ d }) => {
    if (d.k === 'lobby') {
      const me = d.players.find((p) => p.netId === net.id);
      if (me) myTeam = me.team;
      ui.renderLobby(d.players, me ? me.team : -1, !!d.coop);
    }
    if (d.k === 'pickstart') {
      $('lobby').classList.add('hidden');
      picker.open({
        seconds: Number(d.t) || PICK_SECONDS,
        onPick: (cls) => net.toHost({ a: 'pick', cls }),
        onReady: (cls) => { net.toHost({ a: 'pick', cls, ready: true }); picker.setWaiting('Ready! Waiting for the other player…'); },
        onTimeout: (cls) => { net.toHost({ a: 'pick', cls, ready: true }); picker.setWaiting('Starting…'); },
      });
    }
    if (d.k === 'picks') {
      const list = new Map(d.picks.map(([team, cls, name, ready]) => [team, { cls, name, ready }]));
      picker.setTaken(takenFor(list, myTeam));
    }
    if (d.k === 'start') {
      const me = d.players.find((p) => p.netId === net.id);
      if (!me) return;
      picker.close();
      begin(d.diff, { mode: 'client', localTeam: me.team, players: d.players.map((p) => ({ team: p.team, name: p.name, cls: p.cls })), coop: !!d.coop, aiClasses: d.aiClasses || {} }, d.map || 'medium');
    }
  });
  net.join(code, playerName());
});

$('leaveLobby').addEventListener('click', () => location.reload());

// clicking anywhere on the pause screen resumes
$('pause').addEventListener('click', (e) => {
  if (e.target.closest('input, label, .quality')) return;
  $('pauseHint').textContent = '';
  input.lock();
});
input.onLockFail = () => {
  if (game.state !== 'playing' || ui.shopOpen) return;
  game.paused = true;
  ui.showPause(true);
  $('pauseHint').textContent = 'The browser needs one more click to capture the mouse. Click anywhere to continue.';
};
$('shopClose').addEventListener('click', () => ui.toggleShop(false));
$('again').addEventListener('click', () => location.reload());
$('sens').addEventListener('input', (e) => { game.player.sensitivity = 0.0008 + (e.target.value / 100) * 0.004; });
$('vol').addEventListener('input', (e) => { audio.volume = e.target.value / 100; if (audio.master) audio.master.gain.value = audio.volume; });

input.onLockChange = (locked) => {
  if (game.state !== 'playing') return;
  if (game.mode !== 'single' && !locked && !ui.shopOpen) { game.paused = true; ui.showPause(true); return; }
  if (locked) {
    game.paused = false;
    ui.showPause(false);
  } else if (!ui.shopOpen) {
    game.paused = true;
    ui.showPause(true);
  }
};

// Clicking the game view while playing re-captures the mouse.
renderer.domElement.addEventListener('click', () => {
  if (game.state === 'playing' && !input.locked && !ui.shopOpen) input.lock();
});

// While the shop is open, B / Escape closes it.
addEventListener('keydown', (e) => {
  if (ui.shopOpen && (e.code === 'KeyB' || e.code === 'Escape' || e.code === 'KeyO')) {
    e.preventDefault();
    input.pressed.delete(e.code); // don't let the game loop re-open it this frame
    ui.toggleShop(false);
  }
});

const clock = new THREE.Clock();
let frameErrors = 0;
let fpsT = 0, frames = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  // one bad frame must never freeze the game: report it once and keep going
  try {
    game.update(dt);
    ui.update(dt);
  } catch (e) {
    if (!frameErrors++) console.error('Frame error (the game keeps running):', e);
  }
  input.endFrame();
  if (composer) {
    renderPass.scene = game.scene;
    renderPass.camera = game.camera;
    composer.render(dt);
  } else renderer.render(game.scene, game.camera);
  frames++;
  fpsT += dt;
  if (fpsT > 1) { $('fps').textContent = `${frames} fps`; frames = 0; fpsT = 0; }
}
frame();

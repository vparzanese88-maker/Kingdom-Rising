// Kingdom Rising 3D — conversations filmed like a cutscene: letterbox bars, subtitles, and a camera that
// cuts between an over-the-shoulder shot, a close-up of the speaker, a two-shot from the side and a low
// heroic angle, drifting slowly through each. The 'death' style circles low around a fallen king, with
// embers rising and the light going red. Click, Space or Enter goes to the next line; Esc skips it all.
// A line may carry options: { by: who speaks it (the camera moves to them), g: a gesture ('raise', 'thrust'
// to point, 'hop', 'slam'...), gby: who makes it (default the speaker), shot: a fixed shot ('wide', 'close'...) }.
import { THREE, K3, PX } from './core.js';
import { view, eyeHeight } from './camera.js';

const KR = window.KR, G = KR.G;
const cam = K3.camera;
let sc = null;

const headOf = (e) => { const p = new THREE.Vector3(); if (K3.actors && K3.actors.headPos(e, p)) { p.y -= 0.25; return p; } return new THREE.Vector3(e.x * PX, (K3.actorY ? K3.actorY(e) : 0) + 1.6, e.y * PX); };
const footOf = (e) => new THREE.Vector3(e.x * PX, K3.actorY ? K3.actorY(e) : 0, e.y * PX);

export function playScene(o) {
  if (sc) finish(true);
  const p = G.player; const speaker = o.speaker || p;
  const ov = document.createElement('div'); ov.className = 'k3-cine k3-scene' + (o.style === 'death' ? ' death' : '');
  ov.innerHTML = `<div class="k3c-bar top"></div><div class="k3c-bar bot"></div><div class="k3i-sub"><b></b><span></span></div><div class="k3s-next">Click or press Space to continue</div><button class="btn small ghost k3c-skip">Skip ›</button>`;
  document.body.appendChild(ov);
  const lines = o.lines.map((l) => [l[0], l[1], l[2] || Math.max(4, Math.min(11, 1.8 + l[1].length * 0.055)), l[3] || {}]);
  sc = { o, p, speaker, speaker0: speaker, lines, i: -1, t: 0, lt: 0, ov, done: o.done, style: o.style || 'talk', camS: null, update, look: false, pause: true, gest: null, talkers: new Set([speaker]) };
  p.harvest = null; p.autoAttack = false; p.moveTo = null; p.chase = null; p.moving = false; // the scene holds you still: nothing carries on behind it
  const ui = document.getElementById('ui'), hud = document.getElementById('hud3d'); sc.uiWas = ui ? ui.hidden : true; if (ui) ui.hidden = true; if (hud) hud.style.visibility = 'hidden';
  sc.view = { want: view.want, dist: view.dist, yaw: view.yaw, pitch: view.pitch };
  view.want = view.dist = 3; // the hero is seen in every shot
  speaker._talkTo = p; p._talkTo = speaker !== p ? speaker : null;
  sc.key = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); finish(true); } else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); next(); } };
  addEventListener('keydown', sc.key, true);
  ov.querySelector('.k3c-skip').onclick = (e) => { e.stopPropagation(); finish(true); };
  ov.onclick = () => next();
  ov.style.pointerEvents = 'auto';
  if (sc.style === 'death') { try { KR.Main.setMusicOverride('boss'); } catch (e) {} G.shake = 1.5; }
  K3.cine = sc;
  next();
}
function next() {
  const s = sc; if (!s) return; s.i++; s.lt = 0;
  if (s.i >= s.lines.length) { finish(false); return; }
  const [who, text, , op] = s.lines[s.i]; const box = s.ov.querySelector('.k3i-sub');
  // another speaker takes the line: the camera goes to them
  if (op.by && op.by !== s.speaker && !op.by.removed) { s.speaker = op.by; s.talkers.add(op.by); }
  for (const e of s.talkers) e._talkTo = e === s.p ? (s.speaker !== s.p ? s.speaker : null) : s.p;
  endGest(s); if (op.g) s.gest = { e: op.gby === 'hero' ? s.p : op.gby || s.speaker, k: op.g, t: 0, dur: op.gd || 1.3 };
  box.classList.remove('in'); void box.offsetWidth; box.querySelector('b').textContent = who; box.querySelector('span').textContent = text; box.classList.add('in');
  // a new shot for each line
  s.shot = s.style === 'death' ? 'orbit' : op.shot || ['shoulder', 'close', 'side', 'close', 'low', 'shoulder'][s.i % 6];
  s.camS = null;
}
// a gesture plays on real time (the world clock stands still during a scene)
function endGest(s) { const g = s.gest; if (g && g.e.animK === g.k) { g.e.animK = null; g.e.animT = 0; } s.gest = null; }
function finish(skipped) {
  const s = sc; if (!s) return; sc = null; K3.cine = null;
  removeEventListener('keydown', s.key, true);
  endGest(s); for (const e of s.talkers) e._talkTo = null; if (s.p) s.p._talkTo = null;
  Object.assign(view, s.view);
  const ui = document.getElementById('ui'), hud = document.getElementById('hud3d'); if (ui && !s.uiWas) ui.hidden = false; if (hud) hud.style.visibility = '';
  if (s.style === 'death') { try { KR.Main.setMusicOverride(null); } catch (e) {} }
  s.ov.classList.add('out'); setTimeout(() => s.ov.remove(), 700);
  if (s.done) s.done();
}
function update(dt) {
  const s = sc; if (!s) return; s.t += dt; s.lt += dt;
  if (s.lt > s.lines[s.i][2]) next(); if (!sc) return;
  if (s.gest) { const g = s.gest; g.t += dt; if (g.t >= g.dur) endGest(s); else { g.e.animK = g.k; g.e.animDur = g.dur * 1000; g.e.animT = G.now + (g.dur - g.t) * 1000; } }
  const sp = s.speaker, p = s.p;
  const H = headOf(sp), PH = headOf(p), PF = footOf(p), SF = footOf(sp);
  const d = new THREE.Vector3().subVectors(H, PH); d.y = 0; const L = d.length() || 1; d.divideScalar(L); const side = new THREE.Vector3(-d.z, 0, d.x);
  const k = Math.min(1, s.lt / s.lines[s.i][2]); const drift = k * 0.5;
  let pos, look;
  switch (s.shot) {
    case 'shoulder': pos = PH.clone().addScaledVector(d, -1.4 + drift * 0.6).addScaledVector(side, 0.55).add(new THREE.Vector3(0, 0.25, 0)); look = H.clone(); break;
    case 'close': pos = H.clone().addScaledVector(d, -1.25 + drift * 0.2).addScaledVector(side, -0.45).add(new THREE.Vector3(0, -0.05, 0)); look = H.clone().add(new THREE.Vector3(0, -0.05, 0)); break;
    case 'side': { const mid = PH.clone().lerp(H, 0.5); const b2 = KR.W.buildingAt(sp.x, sp.y); let sgn = 1;
      if (b2) { const cxm = (b2.x + b2.w / 2) * 1.6, czm = (b2.y + b2.h / 2) * 1.6; sgn = (side.x * (cxm - mid.x) + side.z * (czm - mid.z)) >= 0 ? 1 : -1; }
      pos = mid.clone().addScaledVector(side, sgn * (Math.max(3.2, L * 0.9) - drift)).add(new THREE.Vector3(0, 0.3, 0)); look = mid; break; }
    case 'wide': { const mid = PH.clone().lerp(H, 0.5); pos = mid.clone().addScaledVector(side, 4.2 - drift).addScaledVector(d, -2.5).add(new THREE.Vector3(0, 1.6 + drift * 0.6, 0)); look = mid.clone().add(new THREE.Vector3(0, -0.2, 0)); break; }
    case 'low': pos = SF.clone().addScaledVector(d, -2.2).addScaledVector(side, 0.9 + drift).add(new THREE.Vector3(0, 0.45, 0)); look = H.clone().add(new THREE.Vector3(0, 0.15, 0)); break;
    case 'orbit': { const c = SF.clone(); const b3 = KR.W.buildingAt(sp.x, sp.y);
      const base = b3 ? Math.atan2((b3.y + b3.h / 2) * 1.6 - c.z, (b3.x + b3.w / 2) * 1.6 - c.x) : s.t * 0.22; const a = base + Math.sin(s.t * 0.25) * 0.9;
      pos = c.clone().add(new THREE.Vector3(Math.cos(a) * 2.2, 0.75 + Math.sin(s.t * 0.3) * 0.2, Math.sin(a) * 2.2)); look = c.clone().add(new THREE.Vector3(0, 0.35, 0));
      // sparks and embers rising around him
      if (Math.random() < dt * 3) G.fxAdd({ k: 'sparks', x: sp.x + (Math.random() - 0.5) * 40, y: sp.y + (Math.random() - 0.5) * 30, life: 0.9 }); break; }
  }
  // indoors, keep the camera inside the room (not in the walls or above the ceiling)
  const W = KR.W; const b = W.buildingAt(sp.x, sp.y);
  if (b) { const T1 = 1.6, m = 0.45; pos.x = Math.min(Math.max(pos.x, (b.x + 1) * T1 + m), (b.x + b.w - 1) * T1 - m); pos.z = Math.min(Math.max(pos.z, (b.y + 1) * T1 + m), (b.y + b.h - 1) * T1 - m); if (b._ceil3 != null) pos.y = Math.min(pos.y, b._ceil3 - 0.35); }
  if (!s.camS) s.camS = { p: pos.clone(), l: look.clone() };
  s.camS.p.lerp(pos, Math.min(1, dt * 2.2)); s.camS.l.lerp(look, Math.min(1, dt * 3));
  cam.position.copy(s.camS.p); cam.lookAt(s.camS.l);
  K3.vmVisible = false;
  // the hero faces the speaker
  view.turning = true; view.yaw = Math.atan2(-(H.x - PH.x), -(H.z - PH.z));
}
K3.playScene = playScene;

// Kingdom Rising 3D — conversations filmed like a cutscene: letterbox bars, subtitles, and a camera that
// cuts between an over-the-shoulder shot, a close-up of the speaker, a two-shot from the side and a low
// heroic angle, drifting slowly through each. The 'death' style circles low around a fallen king, with
// embers rising and the light going red. Space, Enter or a click moves to the next line; Esc or the Skip button ends
// the scene (its outcome still happens). The camera stays close on the faces (a soft key light on the speaker, the jaw moving, the eyes blinking).
// A line may carry options: { by: who speaks it (the camera moves to them), g: a gesture ('raise', 'thrust'
// to point, 'hop', 'slam'...), gby: who makes it (default the speaker), shot: a fixed shot ('wide', 'close'...) }.
import { THREE, K3, PX } from './core.js';
import { view, eyeHeight } from './camera.js';

const KR = window.KR, G = KR.G;
const cam = K3.camera;
let sc = null;

const headOf = (e) => { const p = new THREE.Vector3(); if (K3.actors && K3.actors.headPos(e, p)) { p.y -= 0.25; return p; } return new THREE.Vector3(e.x * PX, (K3.actorY ? K3.actorY(e) : 0) + 1.6, e.y * PX); };
const footOf = (e) => new THREE.Vector3(e.x * PX, K3.actorY ? K3.actorY(e) : 0, e.y * PX);

// where someone's eyes are, from the head bone of their body (a little above the neck joint)
const _v = new THREE.Vector3(), _s = new THREE.Vector3();
const eyesOf = (e) => { const rig = K3.actors && K3.actors.rigOf ? K3.actors.rigOf(e) : null; const hb = rig && rig.bones && rig.bones.head;
  if (hb) { hb.getWorldPosition(_v); hb.getWorldScale(_s); return new THREE.Vector3(_v.x, _v.y + 0.095 * _s.y, _v.z); }
  const h = headOf(e); h.y += 0.13; return h; };
// the jaw and the eyelids, through the skin shader of their body (human.js: uTalk, uBlink)
function faceSet(e, talk, blink) { const rig = K3.actors && K3.actors.rigOf ? K3.actors.rigOf(e) : null; const u = rig && rig.mesh && rig.mesh.material && rig.mesh.material.userData.u; if (!u || !u.uTalk) return; u.uTalk.value = talk; u.uBlink.value = blink; if (rig.setLod) rig.setLod(0); }
export function playScene(o) {
  if (sc) finish(true);
  const p = G.player; const speaker = o.speaker || p;
  const ov = document.createElement('div'); ov.className = 'k3-cine k3-scene' + (o.style === 'death' ? ' death' : '');
  ov.innerHTML = `<div class="k3c-bar top"></div><div class="k3c-bar bot"></div><div class="k3i-sub"><b></b><span></span></div><button class="btn small ghost k3c-skip">Skip ›</button>`;
  document.body.appendChild(ov);
  const lines = o.lines.map((l) => [l[0], l[1], Math.max(l[2] || 0, 2.5, Math.min(7, 1.6 + l[1].length * 0.05)), l[3] || {}]); // long enough to read, no longer
  sc = { o, p, speaker, speaker0: speaker, lines, i: -1, t: 0, lt: 0, ov, done: o.done, style: o.style || 'talk', camS: null, update, look: false, pause: true, gest: null, talkers: new Set([speaker]) };
  p.harvest = null; p.autoAttack = false; p.moveTo = null; p.chase = null; p.moving = false; // the scene holds you still: nothing carries on behind it
  const ui = document.getElementById('ui'), hud = document.getElementById('hud3d'); sc.uiWas = ui ? ui.hidden : true; if (ui) ui.hidden = true; if (hud) hud.style.visibility = 'hidden';
  sc.view = { want: view.want, dist: view.dist, yaw: view.yaw, pitch: view.pitch };
  view.want = view.dist = 3; // the hero is seen in every shot
  speaker._talkTo = p; p._talkTo = speaker !== p ? speaker : null;
  // Esc skips the scene; Space, Enter or a click moves on a line. Every other key is swallowed: nobody walks off mid-scene
  sc.key = (e) => { e.preventDefault(); e.stopImmediatePropagation(); if (e.repeat || sc !== me) return;
    if (e.key === 'Escape') finish(true); else if (e.key === ' ' || e.key === 'Enter') next(); };
  const me = sc;
  addEventListener('keydown', sc.key, true);
  ov.onclick = (e) => { e.stopPropagation(); if (sc !== me) return; if (e.target.closest && e.target.closest('.k3c-skip')) finish(true); else next(); };
  ov.style.pointerEvents = 'auto';
  sc.fov0 = cam.fov; sc.blink = { [0]: 2 + Math.random() * 2 };
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
  s.shot = s.style === 'death' ? 'orbit' : op.shot || (s.speaker === s.p ? ['reverse', 'close'][s.i % 2] : ['close', 'shoulder', 'face', 'reverse', 'close', 'side', 'shoulder', 'low'][s.i % 8]);
  s.camS = null;
}
// a gesture plays on real time (the world clock stands still during a scene)
function endGest(s) { const g = s.gest; if (g && g.e.animK === g.k) { g.e.animK = null; g.e.animT = 0; } s.gest = null; }
function finish(skipped) {
  const s = sc; if (!s) return; sc = null; K3.cine = null;
  removeEventListener('keydown', s.key, true);
  K3.sceneKey = null; cam.fov = K3.settings.fov; cam.updateProjectionMatrix();
  for (const e of s.talkers) faceSet(e, 0, 0);
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
  const E = eyesOf(sp), PE = eyesOf(p);
  // the speaker's jaw works while the line is being said (about 14 letters a second), with pauses at commas;
  // everyone in the scene blinks now and then
  { const [, txt] = s.lines[s.i]; const said = s.lt * 14; let talk = 0;
    if (sp !== p || s.lines[s.i][0] === (p.c && p.c.name)) { if (said < txt.length) { const ch = txt[Math.floor(said)] || ' '; talk = /[,.;:!?—-]/.test(ch) ? 0 : 0.35 + 0.65 * Math.abs(Math.sin(s.lt * 11.3) * Math.sin(s.lt * 4.1 + 1)); } }
    for (const e of s.talkers) { const bl = s.blink[e.id || 0] = (s.blink[e.id || 0] == null ? 1 + Math.random() * 3 : s.blink[e.id || 0]) - dt; let b = 0;
      if (bl < 0.14) { b = Math.sin(Math.max(0, bl) / 0.14 * Math.PI); if (bl < 0) s.blink[e.id || 0] = 2.5 + Math.random() * 3.5; }
      faceSet(e, e === sp ? talk : 0, b); } }
  const d = new THREE.Vector3().subVectors(H, PH); d.y = 0; const L = d.length() || 1; d.divideScalar(L); const side = new THREE.Vector3(-d.z, 0, d.x);
  const k = Math.min(1, s.lt / s.lines[s.i][2]); const drift = k * 0.5;
  let pos, look, fov = 50;
  switch (s.shot) {
    // over the hero's shoulder onto the speaker's face, at eye height
    case 'shoulder': pos = PE.clone().addScaledVector(d, -0.62 + drift * 0.12).addScaledVector(side, 0.34).add(new THREE.Vector3(0, 0.05, 0)); look = E.clone().add(new THREE.Vector3(0, -0.08, 0)); fov = 40; break;
    // a close-up of the speaker: head and shoulders, from just off the line between them
    case 'close': pos = E.clone().addScaledVector(d, -0.95 + drift * 0.15).addScaledVector(side, -0.22).add(new THREE.Vector3(0, -0.02, 0)); look = E.clone().add(new THREE.Vector3(0, -0.11, 0)); fov = 36; break; // aimed below the eyes, so the face sits above the subtitle
    // the face alone
    case 'face': pos = E.clone().addScaledVector(d, -0.78 + drift * 0.08).addScaledVector(side, 0.12).add(new THREE.Vector3(0, -0.01, 0)); look = E.clone().add(new THREE.Vector3(0, -0.085, 0)); fov = 34; break;
    // the reverse: over the speaker's shoulder onto the hero's face as they listen
    case 'reverse': pos = E.clone().addScaledVector(d, 0.6 - drift * 0.1).addScaledVector(side, -0.34).add(new THREE.Vector3(0, 0.04, 0)); look = PE.clone().add(new THREE.Vector3(0, -0.08, 0)); fov = 40; break;
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
  s.fov = s.fov == null ? fov : s.fov + (fov - s.fov) * Math.min(1, dt * 2.5); if (Math.abs(cam.fov - s.fov) > 0.01) { cam.fov = s.fov; cam.updateProjectionMatrix(); }
  // a soft key light from the camera's side, a little above, on whoever is in the shot
  { const tgt = s.shot === 'reverse' ? PE : E; const kp = s.camS.p.clone().lerp(tgt, 0.35).addScaledVector(side, s.shot === 'reverse' ? -0.35 : 0.35); kp.y = tgt.y + 0.35;
    const dark = K3.sky && K3.sky.darkness != null ? K3.sky.darkness : 0.3; K3.sceneKey = { pos: kp, i: /close|face|shoulder|reverse/.test(s.shot) ? 1.6 + 2.6 * dark : 0.6 }; }
  K3.vmVisible = false;
  // the hero faces the speaker
  view.turning = true; view.yaw = Math.atan2(-(H.x - PH.x), -(H.z - PH.z));
}
K3.playScene = playScene;

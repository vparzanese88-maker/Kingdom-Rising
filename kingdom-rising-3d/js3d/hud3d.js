// Kingdom Rising 3D — name plates, health bars, quest markers (! and ?), speech bubbles and damage numbers
// drawn over the 3D view exactly like the 2D game draws them; plus a crosshair and a "press E" hint
import { THREE, K3, PX, TS } from './core.js';
import { geo } from './geo.js';
import { view } from './camera.js';

const KR = window.KR, D = KR.D, W = KR.W, G = KR.G;
const cv = document.getElementById('hud3d');
const g = cv.getContext('2d');
let shown = false;
const _v = new THREE.Vector3();
const occl = new Map(); // entity -> { t, clear }

function project(v) { _v.copy(v).project(K3.camera); if (_v.z > 1 || _v.z < -1) return null; return [(_v.x * 0.5 + 0.5) * innerWidth, (-_v.y * 0.5 + 0.5) * innerHeight, _v.z]; }
function visible(e) {
  let o = occl.get(e); const now = K3.time;
  if (!o || now - o.t > 0.3) { const c = K3.camera.position; const clear = W.lineClear(c.x / PX, c.z / PX, e.x, e.y); o = { t: now, clear }; occl.set(e, o); }
  return o.clear;
}
function bubble(x, y, text) {
  g.font = '12px "Alegreya Sans", system-ui, sans-serif';
  const words = String(text).split(' '); const lines = []; let cur = '';
  for (const w of words) { if (g.measureText(cur + ' ' + w).width > 190 && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) lines.push(cur);
  const w = Math.max(...lines.map((l) => g.measureText(l).width)) + 16, h = lines.length * 15 + 9;
  const bx = x - w / 2, by = y - h;
  g.fillStyle = 'rgba(250,244,228,0.95)'; g.beginPath(); g.roundRect ? g.roundRect(bx, by, w, h, 7) : g.rect(bx, by, w, h); g.fill(); g.strokeStyle = 'rgba(80,60,30,0.6)'; g.lineWidth = 1; g.stroke();
  g.beginPath(); g.moveTo(x - 6, by + h); g.lineTo(x, by + h + 7); g.lineTo(x + 6, by + h); g.fillStyle = 'rgba(250,244,228,0.95)'; g.fill();
  g.fillStyle = '#3a2a18'; g.textAlign = 'center'; lines.forEach((l, i) => g.fillText(l, x, by + 16 + i * 15));
}
function label(e, sx, sy, dist, p, peer) {
  const near = dist < 34 || e === p.target || peer;
  if (e.bubble) bubble(sx, sy - 22, e.bubble.text);
  if (e.dead && e.type !== 'mob') return;
  if (e.noLabel) return;
  if (!near) return;
  const a = K3.clamp(1.25 - dist / 40, 0.35, 1);
  g.globalAlpha = e === p.target ? 1 : a;
  if (e.raider && e !== p.target) { if (e.hp < e.hpMax * 0.25) { g.font = '18px serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText('☠', sx, sy); g.fillStyle = '#ff3a2a'; g.fillText('☠', sx, sy); } g.globalAlpha = 1; return; }
  let col = '#ffffff';
  if (e.type === 'mob') col = D.CON_COLORS[D.conOf(p.level, e.level)];
  else if (e.type === 'npc') col = '#a8e0ff';
  else if (e.type === 'guard' || e.type === 'king') col = e.faction === p.c.faction ? '#a8e0ff' : '#ff6a5a';
  else if (e.type === 'pet') col = '#c8ffc8';
  else if (e.type === 'merc') col = '#9affb8';
  else if (peer) col = e.f === p.c.faction ? '#9affb8' : '#ffb08a';
  const big = e.boss || e.type === 'king';
  g.font = `600 ${big ? 15 : 13}px "Alegreya Sans", system-ui, sans-serif`; g.textAlign = 'center';
  let name = peer ? `${String(e.n).slice(0, 24)} (${e.l || 1})` : e.name; if (e.dead) name += "'s corpse";
  g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.78)'; g.strokeText(name, sx, sy); g.fillStyle = e.dead ? '#bbb' : col; g.fillText(name, sx, sy);
  if (e.title && !e.dead) { g.font = 'italic 11px "Alegreya Sans", system-ui, sans-serif'; g.strokeText(`<${e.title}>`, sx, sy + 13); g.fillStyle = '#e8d8a8'; g.fillText(`<${e.title}>`, sx, sy + 13); }
  if ((e.type === 'npc' || e.type === 'king') && KR.Sys.npcMarker) { const m = KR.Sys.npcMarker(e); if (m) { const bob = Math.sin(G.now / 250) * 3; g.font = '800 26px "IM Fell English SC", serif'; g.lineWidth = 4; g.strokeStyle = '#2a1a00'; g.strokeText(m, sx, sy - 18 + bob); g.fillStyle = m === '?' ? '#ffe23a' : '#ffcf2a'; g.fillText(m, sx, sy - 18 + bob); } }
  if (!e.dead && !peer && (e.type === 'mob' || e.type === 'pet' || e.type === 'merc' || (e.type !== 'npc' && e.hp < e.hpMax) || e.siege)) {
    const w = e.boss || e.siege ? 70 : 42; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(sx - w / 2 - 1, sy + 4, w + 2, 6);
    g.fillStyle = e.type === 'pet' ? '#5ad86a' : '#d8443a'; g.fillRect(sx - w / 2, sy + 5, w * Math.max(0, e.hp / e.hpMax), 4);
  }
  if (e.cast && e !== p) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(sx - 21, sy + 12, 42, 4); g.fillStyle = '#c8a8ff'; g.fillRect(sx - 21, sy + 12, 42 * Math.min(1, e.cast.t / e.cast.dur), 4); }
  g.globalAlpha = 1;
}

export const hud3d = {
  show(on) { shown = on; cv.style.display = on ? 'block' : 'none'; if (!on) g.clearRect(0, 0, cv.width, cv.height); },
  draw(dt) {
    if (!shown) return;
    const d = K3.hudDpr || 1; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, innerWidth, innerHeight);
    const p = G.player; if (!p) return; const cam = K3.camera.position;
    // name plates, nearest last so they draw on top
    const list = [];
    for (const [e, av] of K3.actors.avatars) {
      if (e === p && !(e.bubble)) continue; if (!av.obj.visible) continue;
      const dist = Math.hypot(av.obj.position.x - cam.x, av.obj.position.y - cam.y, av.obj.position.z - cam.z);
      if (dist > 60 && e !== p.target) continue;
      if (e !== p.target && e !== p && !visible(e)) continue;
      if (!K3.actors.headPos(e, _v)) continue; const s = project(_v); if (!s) continue;
      list.push([dist, e, s, av.peer]);
    }
    list.sort((a, b) => b[0] - a[0]);
    for (const [dist, e, s, peer] of list) { if (e === p) { if (e.bubble && !view.firstPerson()) bubble(s[0], s[1] - 6, e.bubble.text); continue; } label(e, s[0], s[1], dist, p, peer); }
    // floating combat text: rises from where it appeared
    for (const f of G.floaters) {
      if (f._y3 == null) { f._x3 = f.x; f._z3 = f.y + 46; f._y3 = geo.floorAt(f.x, f.y + 46) + 2.1; }
      const wy = f._y3 + f.t * 1.1; _v.set(f._x3 * PX, wy, f._z3 * PX); const s = project(_v); if (!s) continue;
      const a = 1 - Math.max(0, f.t - 0.7) / 0.6; g.globalAlpha = Math.max(0, a);
      g.font = `700 ${f.big ? 20 : 15}px "Alegreya Sans", system-ui, sans-serif`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(f.text, s[0], s[1]); g.fillStyle = f.col; g.fillText(f.text, s[0], s[1]);
    }
    g.globalAlpha = 1;
    // crosshair and an interaction hint in first person
    if (view.firstPerson() && !p.dead) {
      const cx = innerWidth / 2, cy = innerHeight / 2;
      const aim = K3.actors.pickScreen(cx, cy);
      const hostile = aim && !aim.dead && G.isHostile(p, aim);
      g.fillStyle = hostile ? 'rgba(255,110,90,0.95)' : 'rgba(255,255,255,0.85)'; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(cx, cy, hostile ? 3.2 : 2.4, 0, 6.283); g.fill(); g.stroke();
      if (aim && !hostile && Math.hypot(aim.x - p.x, aim.y - p.y) < 110) {
        const verb = aim.dead && aim.loot ? 'Search' : aim.type === 'merc' ? 'Command' : 'Talk to';
        const txt = `E  ${verb} ${aim.name}`; g.font = '600 15px "Alegreya Sans", system-ui, sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(txt, cx, cy + 40); g.fillStyle = '#f4e6c0'; g.fillText(txt, cx, cy + 40);
      }
    }
    // the screen edges redden when you are badly hurt
    if (K3.grade) { const hurt = p.dead ? 0.6 : K3.clamp(1 - (p.hp / p.hpMax) / 0.35, 0, 1); K3.grade.uniforms.uHurt.value += (hurt * (0.6 + 0.4 * Math.sin(K3.time * 4)) - K3.grade.uniforms.uHurt.value) * Math.min(1, dt * 4); }
  },
};

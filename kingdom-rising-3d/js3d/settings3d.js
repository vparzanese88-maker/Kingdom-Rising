// Kingdom Rising 3D — the settings window (press O, or the ⚙ button): graphics, controls, key bindings,
// camera and sound. Everything is saved in this browser and applies straight away.
import { K3 } from './core.js';
import { view } from './camera.js';
import { ACTIONS, bindingsOf, bind, resetKeys, keyName } from './keys3d.js';

const KR = window.KR;
let el = null, btn = null, tab = 'graphics', waiting = null; // waiting: { id, slot } while a key is being chosen
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = () => K3.settings;
const save = () => K3.saveSettings();

// small builders: each returns html, wired up afterwards by id
const sel = (id, label, opts, val, note) => `<label class="k3s-row">${label}<select id="${id}">${opts.map(([v, n]) => `<option value="${v}"${String(v) === String(val) ? ' selected' : ''}>${n}</option>`).join('')}</select>${note ? `<small class="k3s-note">${note}</small>` : ''}</label>`;
const rng = (id, label, min, max, step, val, fmt) => `<label class="k3s-row">${label} <span id="${id}-v">${fmt(val)}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
const chk = (id, label, on) => `<label class="k3s-chk"><input type="checkbox" id="${id}"${on ? ' checked' : ''}> ${label}</label>`;

function q() { return K3.quality; }
const pages = {
  graphics() {
    const g = q();
    const shadow = !g.shadows ? 'off' : g.shadowSize >= 4096 ? 'high' : g.shadowSize >= 2048 ? 'medium' : 'low';
    const aa = g.aa || (g.msaa ? 'msaa' : 'fxaa');
    return `<div class="k3s-grid"><div>
      ${sel('g-q', 'Quality preset', Object.entries(K3.QUALITY).map(([k, v]) => [k, v.name]), S().quality, 'Picking a preset resets the options below.')}
      ${rng('g-scale', 'Render resolution', 0.5, 1.5, 0.05, S().renderScale || 1, (v) => Math.round(v * 100) + '%')}
      ${chk('g-dyn', 'Automatic resolution: lowers the resolution when the game slows down so it never lags', S().dynRes)}
      ${sel('g-target', 'Frame rate to hold', [[30, '30 fps'], [45, '45 fps'], [60, '60 fps'], [90, '90 fps'], [120, '120 fps'], [144, '144 fps']], S().targetFps || 60)}
      ${sel('g-cap', 'Frame rate limit', [[0, 'Unlimited (screen refresh)'], [30, '30 fps'], [60, '60 fps'], [90, '90 fps'], [120, '120 fps']], S().fpsCap || 0)}
      ${chk('g-fps', 'Show frame rate', S().showFps)}
    </div><div>
      ${sel('g-shadow', 'Shadows', [['off', 'Off'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], shadow)}
      ${rng('g-view', 'View distance', 150, 700, 10, g.view, (v) => v + ' m')}
      ${rng('g-grass', 'Grass density', 0, 1.6, 0.05, g.grass, (v) => (v <= 0 ? 'Off' : Math.round(v * 100) + '%'))}
      ${sel('g-aa', 'Anti-aliasing (smooth edges)', [['off', 'Off'], ['fxaa', 'FXAA (fast)'], ['msaa', 'MSAA 4x (best)']], aa)}
      ${chk('g-bloom', 'Glow around bright lights (bloom)', g.bloom)}
      ${chk('g-grade', 'Film look (colour grading and vignette)', g.grade)}
      ${rng('g-exp', 'Brightness', 0.6, 1.6, 0.05, S().exposure || 1, (v) => Math.round(v * 100) + '%')}
    </div></div>
    <p class="k3s-note">If the game stutters on a laptop, pick the Medium preset and a shorter View distance first: those cut the work for the processor and graphics chip the most. Keep Automatic resolution on: if the game still cannot keep up it lowers the preset one step by itself.${K3.gpu ? ` Graphics chip: ${String(K3.gpu).replace(/[<>&]/g, '').slice(0, 80)}.` : ''}${K3.perf && K3.perf.fps ? ` Now running at <b>${Math.round(K3.perf.fps)} fps</b>${K3.dynScale < 1 ? ` at ${Math.round(K3.dynScale * 100)}% resolution` : ''}.` : ''}</p>`;
  },
  controls() {
    return `<div class="k3s-grid"><div>
      <h4>Mouse</h4>
      ${rng('c-sens', 'Mouse look speed', 0.1, 3, 0.05, S().sens || 1, (v) => (+v).toFixed(2))}
      ${rng('c-sensy', 'Up and down speed (compared with left and right)', 0.3, 2, 0.05, S().sensY || 1, (v) => Math.round(v * 100) + '%')}
      ${chk('c-inv', 'Invert mouse look (up and down)', S().invertY)}
      <p class="k3s-note">Like EverQuest: hold the right mouse button to look and steer (your hero turns with the mouse), the left button only clicks (dragging it does nothing). Hold both to run forward. Click someone to target them; right-click an enemy to attack, or a tree or rock to gather.</p>
    </div><div>
      <h4>Keyboard and movement</h4>
      ${rng('c-turn', 'Turn speed (A and D)', 0.8, 4, 0.1, S().turnSpeed || 1.9, (v) => Math.round((v * 180) / Math.PI) + '° / s')}
      ${sel('c-speed', 'Movement speed', [['realistic', 'Realistic (jog 3.2 m/s)'], ['brisk', 'Brisk run (5 m/s, default)'], ['fast', 'Fast (5.8 m/s)'], ['classic', 'Classic (fast, like the 2D game)']], S().moveSpeed || 'brisk', 'Monsters and townsfolk slow down by the same amount, so fights stay fair.')}
      ${chk('c-walk', 'Walk instead of run (or press the Walk / run key)', S().walkMode)}
      <p class="k3s-note">A and D turn you, like EverQuest. Hold the right mouse button and they sidestep instead. Change any key in the Key Bindings tab.</p>
    </div></div>`;
  },
  keys() {
    let h = '<p class="k3s-note">Click a key, then press the new key (or a mouse side button). Esc cancels, Backspace clears. A key can only do one thing, so using it here takes it off anything else.</p><table class="k3-keys">';
    let grp = '';
    for (const a of ACTIONS) {
      if (a.group !== grp) { grp = a.group; h += `<tr><th colspan="3">${esc(grp)}</th></tr>`; }
      const b = bindingsOf(a.id);
      h += `<tr><td>${esc(a.name)}</td>${[0, 1].map((i) => { const w = waiting && waiting.id === a.id && waiting.slot === i; const c = b[i]; return `<td><button data-id="${a.id}" data-slot="${i}" class="${w ? 'wait' : c ? '' : 'none'}">${w ? 'Press a key…' : esc(keyName(c))}</button></td>`; }).join('')}</tr>`;
    }
    return h + '</table>';
  },
  camera() {
    return `<div class="k3s-grid"><div>
      ${rng('v-fov', 'Field of view', 55, 110, 1, S().fov, (v) => v + '°')}
      ${chk('v-bob', 'Head bob in step with your feet (first person)', S().headBob)}
      ${chk('v-shake', 'Camera shake on big hits', S().shake !== false)}
      ${chk('v-arms', 'Show your arms and weapon in first person', S().fpArms)}
    </div><div>
      <div class="k3s-row k3s-btns"><button class="btn small" id="v-fp">First person</button><button class="btn small" id="v-tp">Third person</button></div>
      <p class="k3s-note">Scroll the mouse wheel to zoom between first and third person. V switches. Hold the Look behind key (set it in Key Bindings) to glance back.</p>
    </div></div>`;
  },
  sound() {
    const st = (KR.G.account && KR.G.account.settings) || { music: 0.5, sfx: 0.7 };
    return `${rng('s-mus', 'Music', 0, 1, 0.05, st.music, (v) => Math.round(v * 100) + '%')}
      ${rng('s-sfx', 'Sound effects', 0, 1, 0.05, st.sfx, (v) => Math.round(v * 100) + '%')}`;
  },
};
const TABS = [['graphics', 'Graphics'], ['controls', 'Controls'], ['keys', 'Key Bindings'], ['camera', 'Camera'], ['sound', 'Sound']];

function render() {
  const body = el.querySelector('.k3s-body'); const top = body.scrollTop;
  el.querySelectorAll('.k3s-tab').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
  body.innerHTML = pages[tab]();
  body.scrollTop = top;
  wire(body);
}
function wire(b) {
  const $ = (id) => b.querySelector('#' + id);
  const onRange = (id, fmt, fn) => { const r = $(id); if (!r) return; const v = $(id + '-v'); r.oninput = () => { if (v) v.textContent = fmt(+r.value); fn(+r.value, false); }; r.onchange = () => fn(+r.value, true); };
  const onChk = (id, fn) => { const c = $(id); if (c) c.onchange = () => fn(c.checked); };
  const onSel = (id, fn) => { const s = $(id); if (s) s.onchange = () => fn(s.value); };
  const set = (k) => (v) => { S()[k] = v; save(); };
  // graphics
  onSel('g-q', (v) => { K3.setQuality(v); render(); });
  onRange('g-scale', (v) => Math.round(v * 100) + '%', (v, done) => { S().renderScale = v; save(); if (done) K3.resize(); });
  onChk('g-dyn', (v) => { S().dynRes = v; save(); if (!v) { K3.dynScale = 1; K3.resize(); } });
  onSel('g-target', (v) => { S().targetFps = +v; save(); });
  onSel('g-cap', (v) => { S().fpsCap = +v; save(); });
  onChk('g-fps', set('showFps'));
  onSel('g-shadow', (v) => { K3.setGfx('shadows', v === 'off' ? 0 : 1); if (v !== 'off') K3.setGfx('shadowSize', v === 'high' ? 4096 : v === 'medium' ? 2048 : 1024); });
  onRange('g-view', (v) => v + ' m', (v, done) => { if (done) K3.setGfx('view', v); });
  onRange('g-grass', (v) => (v <= 0 ? 'Off' : Math.round(v * 100) + '%'), (v, done) => { if (done) K3.setGfx('grass', v); });
  onSel('g-aa', (v) => K3.setGfx('aa', v));
  onChk('g-bloom', (v) => K3.setGfx('bloom', v));
  onChk('g-grade', (v) => K3.setGfx('grade', v));
  onRange('g-exp', (v) => Math.round(v * 100) + '%', (v) => { S().exposure = v; K3.renderer.toneMappingExposure = v; save(); });
  // controls
  onRange('c-sens', (v) => v.toFixed(2), set('sens'));
  onRange('c-sensy', (v) => Math.round(v * 100) + '%', set('sensY'));
  onChk('c-inv', set('invertY'));
  onRange('c-turn', (v) => Math.round((v * 180) / Math.PI) + '° / s', set('turnSpeed'));
  onSel('c-speed', set('moveSpeed'));
  onChk('c-walk', (v) => { if (!!S().walkMode !== v && KR.Main.toggleWalk) KR.Main.toggleWalk(); });
  // camera
  onRange('v-fov', (v) => v + '°', set('fov'));
  onChk('v-bob', set('headBob')); onChk('v-shake', set('shake')); onChk('v-arms', set('fpArms'));
  const fp = $('v-fp'), tp = $('v-tp');
  if (fp) fp.onclick = () => { view.want = 0; K3.lsSet('kr3d_dist', 0); };
  if (tp) tp.onclick = () => { view.want = 4.5; K3.lsSet('kr3d_dist', 4.5); };
  // sound
  const vol = () => { const st = KR.G.account.settings; st.music = +$('s-mus').value; st.sfx = +$('s-sfx').value; KR.A.setVolumes(st.music, st.sfx); };
  onRange('s-mus', (v) => Math.round(v * 100) + '%', (v, done) => { vol(); if (done && KR.Sys.saveAccount) KR.Sys.saveAccount(); });
  onRange('s-sfx', (v) => Math.round(v * 100) + '%', (v, done) => { vol(); if (done) { KR.A.sfx('click'); if (KR.Sys.saveAccount) KR.Sys.saveAccount(); } });
  // key bindings
  b.querySelectorAll('.k3-keys button').forEach((x) => (x.onclick = () => { waiting = { id: x.dataset.id, slot: +x.dataset.slot }; render(); }));
}
function take(code) {
  const w = waiting; waiting = null;
  const taken = bind(w.id, w.slot, code);
  if (taken.length && KR.G.log) KR.G.log(`${keyName(code)} was taken off: ${taken.join(', ')}.`, 'sys', '#e8d48a');
  render();
}
function make() {
  el = document.createElement('div'); el.className = 'k3-settings wide'; el.hidden = true;
  el.innerHTML = `<div class="k3s-head"><b>Settings</b><button class="mini k3s-x" title="Close (Esc)">✕</button></div>
    <div class="k3s-tabs">${TABS.map(([k, n]) => `<button class="k3s-tab" data-t="${k}">${n}</button>`).join('')}</div>
    <div class="k3s-body"></div>
    <div class="k3s-foot"><button class="btn small" id="k3-reset">Reset this tab</button></div>`;
  document.body.appendChild(el);
  el.querySelector('.k3s-x').onclick = () => settings3d.toggle(false);
  el.querySelectorAll('.k3s-tab').forEach((b) => (b.onclick = () => { tab = b.dataset.t; waiting = null; el.querySelector('.k3s-body').scrollTop = 0; render(); }));
  el.querySelector('#k3-reset').onclick = () => {
    const s = S();
    if (tab === 'graphics') { s.renderScale = 1; s.dynRes = true; s.targetFps = 60; s.fpsCap = 0; s.showFps = false; s.exposure = 1; K3.renderer.toneMappingExposure = 1; K3.setQuality(s.quality); }
    else if (tab === 'controls') { s.sens = 1; s.sensY = 1; s.invertY = false; s.turnSpeed = 1.9; s.moveSpeed = 'brisk'; if (s.walkMode && KR.Main.toggleWalk) KR.Main.toggleWalk(); }
    else if (tab === 'keys') resetKeys();
    else if (tab === 'camera') { s.fov = 72; s.headBob = true; s.shake = true; s.fpArms = true; }
    else if (tab === 'sound') { const st = KR.G.account.settings; st.music = 0.5; st.sfx = 0.7; KR.A.setVolumes(0.5, 0.7); }
    save(); render();
  };
  // choosing a key: catch it before the game does
  addEventListener('keydown', (e) => {
    if (!waiting || el.hidden) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.key === 'Escape') { waiting = null; render(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { take(null); return; }
    take(e.code || e.key);
  }, true);
  el.addEventListener('mousedown', (e) => { if (waiting && e.button >= 1 && e.button !== 2) { e.preventDefault(); take('Mouse' + (e.button + 2)); } });
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('keydown', (e) => { if (!waiting) e.stopPropagation(); });
  el.addEventListener('wheel', (e) => e.stopPropagation());
}
function makeButton() {
  btn = document.createElement('button'); btn.className = 'k3-gear'; btn.title = 'Settings (O)'; btn.textContent = '⚙ Settings';
  btn.onclick = () => settings3d.toggle(); document.body.appendChild(btn);
}
export const settings3d = {
  toggle(on) { if (!el) make(); const show = on == null ? el.hidden : on; el.hidden = !show; waiting = null; if (show) { render(); if (K3.endLook) K3.endLook(); } },
  isOpen() { return el && !el.hidden; },
  capturing() { return !!waiting && el && !el.hidden; },
  showButton(on) { if (!btn) makeButton(); btn.hidden = !on; },
  open(t) { tab = t || tab; settings3d.toggle(true); },
};
K3.settings3d = settings3d;

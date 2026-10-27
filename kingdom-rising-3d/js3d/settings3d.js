// Kingdom Rising 3D — the 3D view settings window (press O, or the ⚙3D button): graphics quality,
// field of view, mouse sensitivity, invert look, head bob, first-person arms, camera distance
import { K3 } from './core.js';
import { view } from './camera.js';

const KR = window.KR;
let el = null, btn = null;
function make() {
  el = document.createElement('div'); el.className = 'k3-settings'; el.hidden = true;
  el.innerHTML = `
    <div class="k3s-head"><b>3D View</b><button class="mini k3s-x" title="Close">✕</button></div>
    <label class="k3s-row">Graphics quality
      <select id="k3-q">${Object.entries(K3.QUALITY).map(([k, q]) => `<option value="${k}">${q.name}</option>`).join('')}</select></label>
    <p class="k3s-note">Lower this if the game runs slowly. Ultra needs a strong graphics card.</p>
    <label class="k3s-row">Field of view <span id="k3-fov-v"></span><input type="range" id="k3-fov" min="55" max="100" step="1"></label>
    <label class="k3s-row">Mouse sensitivity <span id="k3-sens-v"></span><input type="range" id="k3-sens" min="0.2" max="3" step="0.05"></label>
    <label class="k3s-chk"><input type="checkbox" id="k3-inv"> Invert mouse look</label>
    <label class="k3s-chk"><input type="checkbox" id="k3-bob"> Head bob when walking</label>
    <label class="k3s-chk"><input type="checkbox" id="k3-arms"> Show your arms and weapon in first person</label>
    <div class="k3s-row k3s-btns"><button class="btn small" id="k3-fp">First person</button><button class="btn small" id="k3-tp">Third person</button></div>
    <p class="k3s-note"><b>Controls:</b> WASD move · hold right mouse to look · left drag to look around · mouse wheel zooms out to third person and back in to first person · V switches view · both buttons walk forward · arrow keys turn. Everything else is the same as the 2D game.</p>
    <p class="k3s-note"><a href="../" class="k3s-link">Play the original 2D version</a> (same heroes and kingdoms)</p>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s);
  $('.k3s-x').onclick = () => settings3d.toggle(false);
  $('#k3-q').value = K3.settings.quality; $('#k3-q').onchange = (e) => { K3.setQuality(e.target.value); };
  const fov = $('#k3-fov'), fv = $('#k3-fov-v'); fov.value = K3.settings.fov; fv.textContent = K3.settings.fov + '°'; fov.oninput = () => { K3.settings.fov = +fov.value; fv.textContent = fov.value + '°'; K3.saveSettings(); };
  const sens = $('#k3-sens'), sv = $('#k3-sens-v'); sens.value = K3.settings.sens; sv.textContent = (+K3.settings.sens).toFixed(2); sens.oninput = () => { K3.settings.sens = +sens.value; sv.textContent = (+sens.value).toFixed(2); K3.saveSettings(); };
  const chk = (id, key) => { const c = $(id); c.checked = !!K3.settings[key]; c.onchange = () => { K3.settings[key] = c.checked; K3.saveSettings(); }; };
  chk('#k3-inv', 'invertY'); chk('#k3-bob', 'headBob'); chk('#k3-arms', 'fpArms');
  $('#k3-fp').onclick = () => { view.want = 0; K3.lsSet('kr3d_dist', 0); };
  $('#k3-tp').onclick = () => { view.want = 4.5; K3.lsSet('kr3d_dist', 4.5); };
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('keydown', (e) => e.stopPropagation());
}
function makeButton() {
  btn = document.createElement('button'); btn.className = 'k3-gear'; btn.title = '3D view settings (O)'; btn.textContent = '3D';
  btn.onclick = () => settings3d.toggle(); document.body.appendChild(btn);
}
export const settings3d = {
  toggle(on) { if (!el) make(); const show = on == null ? el.hidden : on; el.hidden = !show; if (show && K3.endLook) K3.endLook(); },
  isOpen() { return el && !el.hidden; },
  showButton(on) { if (!btn) makeButton(); btn.hidden = !on; },
};
K3.settings3d = settings3d;

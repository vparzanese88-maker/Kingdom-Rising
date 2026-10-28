// Kingdom Rising 3D — gathering you can watch: the camera pulls out to third person, your weapon goes away
// and the axe, pick or skinning knife from your gathering slots comes into your hands; afterwards the
// camera comes back to where it was.
import { THREE, K3 } from './core.js';
import { weaponMesh } from './weapons.js';
import { view } from './camera.js';

const KR = window.KR, G = KR.G;
let active = null; // { rig, mesh, hidden, wantBefore }
const MESH = { axe: 'axe', pick: 'pick', knife: '1HP' };
const TINT = (tier) => ['#c87a4a', '#9aa0a8', '#d0d6de', '#9ad8ff', '#a8ffb8'][Math.max(0, tier - 1)] || '#9aa0a8';

function start(p, rig) {
  const H = p.harvest; const tier = KR.Gear ? KR.Gear.toolTier(p.c, H.tool) : 1;
  const mesh = weaponMesh(MESH[H.tool], { steel: TINT(tier) });
  const a = { rig, mesh, hidden: [], wantBefore: null, tool: H.tool };
  for (const k of ['R', 'L']) { const h = rig.held[k]; if (h && h.visible) { h.visible = false; a.hidden.push(h); } }
  if (mesh) {
    rig.bones.handR.add(mesh);
    if (rig.hands) mesh.position.set(...rig.hands.R.grip); else mesh.position.set(0, -0.07, 0.01);
    mesh.rotation.set(Math.PI / 2, 0, 0);
    if (H.tool !== 'knife') mesh.position.y -= 0.12; // hold the haft lower down for a full swing
  }
  // watch yourself work
  if (view.firstPerson()) { a.wantBefore = view.want; view.want = 3.4; }
  // swing the camera round to a three-quarter view of the work
  const tg = H.corpse || (H.d ? { x: H.d.x, y: H.d.y - 8 } : null);
  if (tg) { const face = Math.atan2(tg.x - p.x, tg.y - p.y); a.oyawBefore = view.oyaw; view.oyaw = K3.dampAngle(0, face + Math.PI + 0.95 - view.yaw, 1); view.pitch = Math.min(view.pitch, -0.12); }
  active = a;
}
function stop() {
  const a = active; active = null; if (!a) return;
  if (a.mesh && a.mesh.parent) a.mesh.parent.remove(a.mesh);
  for (const h of a.hidden) h.visible = true;
  if (a.wantBefore != null && Math.abs(view.want - 3.4) < 0.01) { view.want = a.wantBefore; if (a.oyawBefore != null) view.oyaw = a.oyawBefore; }
}
K3.updaters.push(() => {
  const p = G.player; const rig = K3.playerRig;
  const on = !!(p && p.harvest && rig);
  if (on && (!active || active.rig !== rig || active.tool !== p.harvest.tool)) { stop(); start(p, rig); }
  else if (!on && active) stop();
});

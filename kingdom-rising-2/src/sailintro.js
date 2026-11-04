// Campaign opening: you sail in towards Driftwood Coast on a battered little boat, in first person.
// The same boat is then tied up at the end of the pier for the rest of the game (press E: it needs repairs).
import * as THREE from 'three';
import { world, addSurface } from './world.js';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, o));
const M = {
  hull: mat('#6a4a2c'), hullDark: mat('#4a3220'), plank: mat('#8a6a44'), rail: mat('#5a3e24'), rope: mat('#c8b48a'),
  sail: mat('#d9ccae', { side: THREE.DoubleSide }), patch: mat('#a89070', { side: THREE.DoubleSide }), iron: mat('#3a3a3a', { metalness: 0.5, roughness: 0.5 }),
  sack: mat('#a08860'), white: mat('#f4f4f0', { emissive: '#30302c' }), grey: new THREE.MeshLambertMaterial({ color: '#c4cad2', emissive: '#3a3e44', side: THREE.DoubleSide }), beak: mat('#e8a030'), eye: mat('#111'),
};
function box(w, h, d, m, x, y, z, g, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; }
function cyl(r0, r1, h, m, x, y, z, g, seg = 8) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; }

// a small single-masted sailing boat, worn and patched. Bow points along +z.
export function buildBoat() {
  const g = new THREE.Group();
  // hull: a stretched half shell, open on top
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.hull);
  hull.material = M.hull.clone(); hull.material.side = THREE.DoubleSide; hull.scale.set(1.15, 0.75, 2.7); hull.position.y = 0.75; hull.castShadow = true; g.add(hull);
  // strakes (dark bands along the hull) and a keel
  for (const y of [0.45, 0.62]) { const s = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 4, 32), M.hullDark); s.rotation.x = Math.PI / 2; s.scale.set(1.15 * Math.sqrt(1 - ((0.75 - y) / 0.75) ** 2), 2.7 * Math.sqrt(1 - ((0.75 - y) / 0.75) ** 2), 1); s.position.y = y; g.add(s); }
  box(0.08, 0.14, 5.3, M.hullDark, 0, 0.02, 0, g);
  // gunwale rail around the top
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 40), M.rail); rail.rotation.x = Math.PI / 2; rail.scale.set(1.15, 2.7, 1); rail.position.y = 0.76; g.add(rail);
  // a solid bottom (keeps the sea out of sight) under the floor boards, thwarts (seats)
  { const fl = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.03, 28), M.hullDark); fl.scale.set(0.7, 1, 1.66); fl.position.y = 0.17; g.add(fl); } // the bottom, shaped to the hull
  for (let i = -4; i <= 4; i++) box(1.3, 0.04, 0.2, M.plank, 0, 0.18, i * 0.42, g);
  box(1.9, 0.06, 0.32, M.plank, 0, 0.52, -1.25, g); box(2.05, 0.06, 0.3, M.plank, 0, 0.55, 0.35, g); box(1.2, 0.06, 0.28, M.plank, 0, 0.6, 1.7, g);
  // mast, boom and a torn, patched sail
  cyl(0.06, 0.075, 4.6, M.rail, 0, 2.5, 0.55, g);
  const boom = cyl(0.04, 0.04, 2.6, M.rail, 0, 1.25, -0.6, g); boom.rotation.x = Math.PI / 2;
  const sg = new THREE.PlaneGeometry(2.4, 3.3, 8, 10); const sp = sg.attributes.position;
  for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i); sp.setZ(i, Math.sin((y + 1.65) / 3.3 * Math.PI) * 0.28 * (1 - Math.abs(x) / 1.4)); if (y < -1.5 && Math.abs(x - 0.6) < 0.4) sp.setY(i, y + 0.25); } // a ripped lower corner
  sg.computeVertexNormals();
  const sail = new THREE.Mesh(sg, M.sail); sail.rotation.y = Math.PI / 2; sail.position.set(0.02, 2.95, -0.6); sail.castShadow = true; g.add(sail); g.userData.sail = sail;
  for (const [y, z, w] of [[3.6, -0.2, 0.5], [2.3, -1.1, 0.4], [3.0, -0.9, 0.3]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.8), M.patch); p.rotation.y = Math.PI / 2; p.position.set(0.06, y, z); g.add(p); }
  // rigging lines
  const line = (a, b) => { const d = new THREE.Vector3().subVectors(b, a), l = d.length(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, l, 4), M.rope); c.position.copy(a).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(c); };
  line(new THREE.Vector3(0, 4.75, 0.55), new THREE.Vector3(0, 0.8, 2.65)); line(new THREE.Vector3(0, 4.6, 0.55), new THREE.Vector3(1.05, 0.78, 0.2)); line(new THREE.Vector3(0, 4.6, 0.55), new THREE.Vector3(-1.05, 0.78, 0.2));
  // tiller, a coil of rope, a sack, a bailing bucket, a lantern hook
  const til = box(0.08, 0.08, 1.0, M.rail, 0, 0.85, -2.55, g, -0.25); til.position.z = -2.4;
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 6, 16), M.rope); coil.rotation.x = Math.PI / 2; coil.position.set(0.5, 0.24, 1.2); g.add(coil);
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.sack); sack.scale.set(1, 0.75, 0.8); sack.position.set(-0.55, 0.38, -0.5); g.add(sack);
  cyl(0.16, 0.12, 0.3, M.hullDark, 0.55, 0.35, -0.6, g);
  // a hole in the hull side with a rough patch board: the "needs major repairs" part
  box(0.05, 0.3, 0.6, M.hullDark, 1.07, 0.5, -1.4, g, 0, 0, 0.3); box(0.04, 0.22, 0.75, M.plank, 1.1, 0.52, -1.35, g, 0.15, 0, 0.32);
  g.userData.bow = new THREE.Vector3(0, 0.86, 2.55); // where a gull can perch
  g.userData.seat = new THREE.Vector3(0.45, 1.0, -1.7); // the sailor's eye, standing at the stern (in boat units; the boat is built at 3x)
  g.scale.set(BOAT_SCALE, BOAT_SCALE * 2 / 3, BOAT_SCALE); // three times longer and wider, twice as deep
  return g;
}
export const BOAT_SCALE = 3, BOAT_Y = 0;

// a gull with flapping wings and folding legs
export function buildGull() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M.white); body.scale.set(1, 0.9, 1.9); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), M.white); head.position.set(0, 0.1, 0.3); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 6), M.beak); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.08, 0.44); g.add(beak);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), M.eye); e.position.set(s * 0.065, 0.13, 0.36); g.add(e); }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 4), M.grey); tail.rotation.x = -Math.PI / 2; tail.position.set(0, 0.02, -0.36); tail.scale.set(1.4, 1, 0.4); g.add(tail);
  const wingG = new THREE.BufferGeometry(); wingG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.14, 0, 0, 0.16, 0.42, 0, 0.08, 0.42, 0, 0.08, 0, 0, -0.14, 0.85, 0, -0.08], 3)); wingG.computeVertexNormals();
  const wl = new THREE.Group(), wr = new THREE.Group(); wl.add(new THREE.Mesh(wingG, M.grey)); const mr = new THREE.Mesh(wingG, M.grey); mr.scale.x = -1; wr.add(mr);
  wl.position.set(0.1, 0.06, 0.02); wr.position.set(-0.1, 0.06, 0.02); g.add(wl, wr);
  const legs = new THREE.Group(); for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 4), M.beak); l.position.set(s * 0.05, -0.2, 0); legs.add(l); } g.add(legs);
  g.userData = { wl, wr, legs };
  return g;
}
export function flap(gull, t, k = 1, folded = false) {
  const { wl, wr, legs } = gull.userData;
  if (folded) { wl.rotation.set(0, 0, -0.2); wr.rotation.set(0, 0, 0.2); wl.scale.set(0.32, 1, 1.3); wr.scale.set(0.32, 1, 1.3); legs.visible = true; return; }
  wl.scale.set(1, 1, 1); wr.scale.set(1, 1, 1);
  wl.rotation.set(0, 0, Math.sin(t) * 0.7 * k); wr.rotation.set(0, 0, -Math.sin(t) * 0.7 * k); legs.visible = false;
}

// the player's boat, built once: moored at the end of the pier
export function placeHomeBoat(scene) {
  if (world.myBoat || !world.pier) return world.myBoat;
  const P = world.pier, b = buildBoat();
  const x = P.x - P.w - 1.15 * BOAT_SCALE - 0.4, z = P.z1 - 2.7 * BOAT_SCALE - 1;
  b.position.set(x, BOAT_Y, z); b.rotation.y = 0.04; scene.add(b);
  world.myBoat = b; world.myBoatHome = { x, z, yaw: 0.04 };
  // a rope from the bow to a pier post
  // the deck is walkable: jump down from the pier, walk about, step back up or jump off into the sea
  addSurface(x, z, 0.62 * BOAT_SCALE, 1.75 * BOAT_SCALE, 0.04, BOAT_Y + 0.2 * BOAT_SCALE * 2 / 3);
  return b;
}

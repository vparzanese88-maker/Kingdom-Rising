// Procedural animation for the box-built characters.
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
// smooth keyframes: keys [[time, value], ...] with eased blends between them
function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) { const [t0, v0] = keys[i - 1]; const k = (t - t0) / (t1 - t0 || 1); return v0 + (v1 - v0) * (k * k * (3 - 2 * k)); }
  }
  return keys[keys.length - 1][1];
}

// st: { move 0..1, phase, pose, t (0..1), twoHand, block, draw }
export function animHumanoid(h, st) {
  const P = h.parts;
  const mv = st.move || 0;
  const sw = Math.sin(st.phase || 0);
  P.legL.rotation.x = sw * 0.75 * mv;
  P.legR.rotation.x = -sw * 0.75 * mv;
  P.armL.rotation.set(-sw * 0.5 * mv, 0, 0);
  P.armR.rotation.set(sw * 0.5 * mv, 0, 0);
  P.upper.rotation.set(h.hunched ? 0.35 : 0, 0, 0);
  P.head.rotation.set(0, 0, 0);
  h.body.rotation.set(0, 0, 0);
  h.body.position.z = 0;
  h.body.position.y = Math.abs(Math.cos(st.phase || 0)) * 0.06 * mv;
  const t = st.t || 0;
  switch (st.pose) {
    case 'slash': case 'slash2': {
      // wind up to one side, whip across the body as the blow lands (hit ~0.45-0.5), follow through, recover
      const d = st.pose === 'slash' ? 1 : -1;
      const two = st.twoHand;
      P.upper.rotation.y = kf(t, [[0, 0], [0.32, 1.05 * d], [0.5, -0.55 * d], [0.72, -1.05 * d], [1, 0]]);
      P.upper.rotation.x += kf(t, [[0, 0], [0.32, -0.14], [0.52, 0.22], [1, 0]]);
      P.upper.rotation.z = kf(t, [[0, 0], [0.32, 0.12 * d], [0.55, -0.1 * d], [1, 0]]);
      P.armR.rotation.x = kf(t, [[0, -0.55], [0.32, two ? -1.95 : -2.1], [0.5, -1.35], [0.75, -1.05], [1, -0.55]]);
      P.armR.rotation.z = kf(t, [[0, 0], [0.32, d > 0 ? -0.75 : 0.6], [0.5, d > 0 ? 0.25 : -0.3], [0.75, d > 0 ? 0.75 : -0.7], [1, 0]]);
      if (two) { P.armL.rotation.x = P.armR.rotation.x + 0.12; P.armL.rotation.z = P.armR.rotation.z - 0.5; }
      else { P.armL.rotation.x = -0.85; P.armL.rotation.z = -0.35; } // shield kept up
      P.head.rotation.y = -P.upper.rotation.y * 0.6;
      h.body.position.z = kf(t, [[0, 0], [0.48, 0.22], [1, 0]]);
      h.body.position.y += kf(t, [[0, 0], [0.5, -0.06], [1, 0]]);
      break;
    }
    case 'thrust': {
      // draw the weapon back at the hip, drive it straight forward with a lunge
      P.armR.rotation.x = kf(t, [[0, -0.7], [0.35, -0.85], [0.55, -1.6], [0.78, -1.5], [1, -0.7]]);
      P.armR.rotation.z = kf(t, [[0, 0], [0.35, -0.55], [0.55, 0.08], [1, 0]]);
      P.upper.rotation.y = kf(t, [[0, 0], [0.35, 0.65], [0.55, -0.45], [1, 0]]);
      P.upper.rotation.x += kf(t, [[0, 0], [0.55, 0.2], [1, 0]]);
      if (st.twoHand) { P.armL.rotation.x = P.armR.rotation.x + 0.1; P.armL.rotation.z = P.armR.rotation.z - 0.5; }
      else { P.armL.rotation.x = -1.0; P.armL.rotation.z = -0.4; }
      P.head.rotation.y = -P.upper.rotation.y * 0.6;
      h.body.position.z = kf(t, [[0, 0], [0.35, -0.08], [0.58, 0.42], [1, 0]]);
      break;
    }
    case 'overhead': case 'slam': {
      // weapon high behind the head, crash down with the whole body, recover
      const x = kf(t, [[0, -0.5], [0.42, -3.05], [0.52, -3.1], [0.66, -0.85], [0.82, -0.65], [1, -0.5]]);
      P.armR.rotation.x = x; P.armR.rotation.z = st.twoHand ? 0.18 : 0.1;
      if (st.twoHand) { P.armL.rotation.x = x + 0.08; P.armL.rotation.z = -0.3; } else P.armL.rotation.x = -0.6;
      P.upper.rotation.x += kf(t, [[0, 0], [0.42, -0.3], [0.66, 0.5], [0.85, 0.3], [1, 0]]);
      P.head.rotation.x = kf(t, [[0, 0], [0.42, -0.2], [0.66, 0.25], [1, 0]]);
      h.body.position.y += kf(t, [[0, 0], [0.42, 0.05], [0.66, -0.16], [1, 0]]);
      h.body.position.z = kf(t, [[0, 0], [0.66, 0.25], [1, 0]]);
      break;
    }
    case 'spin': {
      // coil, then a full turn with the weapon held out at arm's length
      h.body.rotation.y = kf(t, [[0, 0], [0.22, 0.6], [0.8, -Math.PI * 2 + 0.2], [1, -Math.PI * 2]]);
      P.armR.rotation.x = kf(t, [[0, -0.6], [0.22, -1.2], [0.35, -1.5], [0.85, -1.45], [1, -0.6]]);
      P.armR.rotation.z = kf(t, [[0, 0], [0.22, -0.7], [0.4, -0.35], [1, 0]]);
      P.armL.rotation.x = P.armR.rotation.x + 0.1; P.armL.rotation.z = P.armR.rotation.z - 0.55;
      P.upper.rotation.x += kf(t, [[0, 0], [0.3, 0.15], [0.85, 0.1], [1, 0]]);
      h.body.position.y += kf(t, [[0, 0], [0.22, -0.1], [0.5, 0], [1, 0]]);
      break;
    }
    case 'draw': {
      // side-on stance, bow arm out straight, string hand pulled back to the cheek
      const d = ease(st.draw || 0);
      P.upper.rotation.y = 0.55 + d * 0.25;
      P.head.rotation.y = -(0.55 + d * 0.25);
      P.armL.rotation.x = -1.55; P.armL.rotation.z = -0.25 - d * 0.15;
      P.armR.rotation.x = -1.45 - d * 0.1; P.armR.rotation.z = 0.35 + d * 0.75;
      P.upper.rotation.x += -0.05 * d;
      break;
    }
    case 'shoot': {
      // release: the string hand snaps back past the ear, bow arm recoils slightly
      P.upper.rotation.y = 0.8 * (1 - ease(t)); P.head.rotation.y = -P.upper.rotation.y;
      P.armL.rotation.x = -1.55 + t * 0.3; P.armL.rotation.z = -0.4;
      P.armR.rotation.x = kf(t, [[0, -1.55], [0.25, -1.75], [1, -0.7]]); P.armR.rotation.z = kf(t, [[0, 1.1], [0.25, 1.45], [1, 0.2]]);
      break;
    }
    case 'block': {
      P.armL.rotation.x = -1.35; P.armL.rotation.z = -0.5;
      P.armR.rotation.x = -0.7;
      break;
    }
    case 'dodge': {
      const a = ease(t) * Math.PI * 2;
      h.body.rotation.x = a;
      h.body.position.y = (1 - Math.cos(a)) * 0.9 * h.size * 0.55;
      break;
    }
    case 'hop': {
      h.body.position.y = Math.sin(t * Math.PI) * 0.22;
      P.upper.rotation.x += Math.sin(t * Math.PI) * 0.35;
      P.legL.rotation.x = -0.6 * Math.sin(t * Math.PI); P.legR.rotation.x = 0.4 * Math.sin(t * Math.PI);
      break;
    }
    case 'jump': {
      // t: 0 launching upward, 0.5 at the top, 1 falling. Knees tuck on the way up, legs reach for the ground coming down
      const up = Math.max(0, 1 - t * 2), down = Math.max(0, t * 2 - 1), top = 1 - Math.abs(t * 2 - 1);
      P.legL.rotation.x = -1.1 * top - 0.5 * up + 0.15 * down; P.legR.rotation.x = -0.6 * top - 0.2 * up - 0.25 * down;
      P.armL.rotation.x = -0.9 * up - 0.5 * top; P.armR.rotation.x = -0.9 * up - 0.5 * top;
      P.armL.rotation.z = 0.5 * top + 0.35 * down; P.armR.rotation.z = -0.5 * top - 0.35 * down;
      P.upper.rotation.x += 0.18 * top - 0.12 * up;
      break;
    }
    case 'swap': {
      const k = Math.sin(t * Math.PI);
      P.armR.rotation.x = -2.8 * k; P.armR.rotation.z = 0.4 * k;
      P.upper.rotation.y = -0.3 * k;
      break;
    }
    case 'gather': {
      const k = (Math.sin(t * Math.PI * 2 * 1.5) + 1) / 2;
      P.armR.rotation.x = lerp(-0.3, -2.4, k); P.armL.rotation.x = lerp(-0.3, -2.4, k);
      P.upper.rotation.x += 0.2;
      break;
    }
    case 'harvest': {
      P.upper.rotation.x += 0.7; P.armR.rotation.x = -0.9 + Math.sin(t * 20) * 0.3; P.armL.rotation.x = -0.9;
      break;
    }
    case 'cast': {
      P.armR.rotation.x = -2.6; P.armL.rotation.x = -2.6;
      P.armR.rotation.z = 0.4; P.armL.rotation.z = -0.4;
      break;
    }
    case 'windup': {
      // charging a heavy attack: coil back, weapon raised, weight dropped
      const k = ease(Math.min(1, t * 1.6));
      P.armR.rotation.x = lerp(-0.5, -2.5, k); P.armR.rotation.z = -0.35 * k;
      if (st.twoHand) { P.armL.rotation.x = P.armR.rotation.x + 0.1; P.armL.rotation.z = P.armR.rotation.z - 0.5; } else { P.armL.rotation.x = -0.9; P.armL.rotation.z = -0.35; }
      P.upper.rotation.y = 0.7 * k; P.upper.rotation.x += -0.15 * k; P.head.rotation.y = -0.45 * k;
      h.body.position.y -= 0.07 * k;
      break;
    }
    case 'rifle': {
      // gun shouldered: both arms forward, cheek down to the stock
      const d = ease(st.draw || 0);
      P.upper.rotation.y = 0.25 * d; P.head.rotation.y = -0.25 * d; P.head.rotation.x = 0.1 * d;
      P.armR.rotation.x = -0.6 - 0.95 * d; P.armR.rotation.z = 0.12 * d;
      P.armL.rotation.x = -0.6 - 0.85 * d; P.armL.rotation.z = -0.45 * d;
      break;
    }
    case 'recoil': {
      // the kick: muzzle climbs and the shoulder rocks back, then settles
      const k = kf(t, [[0, 0], [0.12, 1], [1, 0]]);
      P.upper.rotation.y = 0.25 * (1 - t); P.head.rotation.y = -P.upper.rotation.y;
      P.upper.rotation.x -= 0.18 * k;
      P.armR.rotation.x = -1.55 - 0.4 * k; P.armR.rotation.z = 0.12;
      P.armL.rotation.x = -1.45 - 0.35 * k; P.armL.rotation.z = -0.45;
      break;
    }
    case 'reload': {
      // gun held across the body, ramrod hand working up and down
      P.armR.rotation.x = -0.5; P.armR.rotation.z = 0.2;
      P.armL.rotation.x = -1.1 + Math.sin(t * Math.PI * 6) * 0.35; P.armL.rotation.z = -0.5;
      P.head.rotation.x = 0.25;
      break;
    }
    case 'aim': {
      P.armL.rotation.x = -1.55; P.armR.rotation.x = -1.55; P.armR.rotation.z = 0.4 + t * 0.6; P.upper.rotation.y = 0.35;
      break;
    }
    case 'stun': {
      P.head.rotation.z = Math.sin((st.phase || 0) * 3) * 0.3;
      P.armR.rotation.x = 0.2; P.armL.rotation.x = 0.2;
      break;
    }
    case 'dead': {
      h.body.rotation.x = -Math.PI / 2 * Math.min(1, t * 2); h.body.position.y = 0.2;
      break;
    }
  }
  // a rigged model (the hero) turns these part rotations into bone rotations on top of its clips
  if (h.rig) h.rig.apply(st);
}

export function animBeast(b, st) {
  const P = b.parts;
  const mv = st.move || 0, ph = st.phase || 0;
  P.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.8 * mv; });
  P.torso.rotation.set(0, 0, 0);
  P.torso.position.z = 0;
  P.head.rotation.set(0, 0, 0);
  P.tail.rotation.y = Math.sin(ph * 0.7) * 0.4;
  b.body.rotation.set(0, 0, 0);
  const t = st.t || 0;
  if (st.pose === 'windup') { P.torso.rotation.x = 0.15 * Math.min(1, t * 2); P.torso.position.z = -0.2 * Math.min(1, t * 2); P.head.rotation.x = -0.3; }
  else if (st.pose === 'strike') { P.torso.position.z = Math.sin(t * Math.PI) * 0.6; P.head.rotation.x = Math.sin(t * Math.PI) * 0.5; }
  else if (st.pose === 'stun') { P.head.rotation.z = Math.sin(ph * 3) * 0.3; }
  else if (st.pose === 'dead') { b.body.rotation.z = Math.PI / 2 * Math.min(1, t * 2); }
}

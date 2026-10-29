// Procedural animation for the box-built characters.
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerp = (a, b, t) => a + (b - a) * t;

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
  h.body.position.y = Math.abs(Math.cos(st.phase || 0)) * 0.06 * mv;
  const t = st.t || 0;
  switch (st.pose) {
    case 'slash': case 'slash2': {
      const dir = st.pose === 'slash' ? 1 : -1;
      const k = t < 0.35 ? t / 0.35 * 0.2 : 0.2 + ease((t - 0.35) / 0.65) * 0.8;
      P.upper.rotation.y = lerp(1.0, -1.2, k) * dir;
      P.armR.rotation.x = -1.5; P.armR.rotation.z = lerp(-0.4, 0.3, k) * dir;
      if (st.twoHand) { P.armL.rotation.x = -1.4; P.armL.rotation.z = -0.6; }
      else P.armL.rotation.x = -0.6;
      break;
    }
    case 'thrust': {
      const k = t < 0.4 ? -t / 0.4 : -1 + ease(Math.min(1, (t - 0.4) / 0.3)) * 2;
      P.armR.rotation.x = -1.5 + k * 0.1; P.upper.rotation.y = -k * 0.4;
      P.armL.rotation.x = -1.2;
      h.body.position.z = Math.max(0, k) * 0.3;
      break;
    }
    case 'overhead': case 'slam': {
      const k = t < 0.5 ? ease(t / 0.5) : 1 - ease(Math.min(1, (t - 0.5) / 0.2));
      const x = t < 0.5 ? lerp(-0.4, -2.9, k) : lerp(-0.4, -2.9, k);
      P.armR.rotation.x = x; P.armL.rotation.x = st.twoHand ? x : -0.5;
      if (st.twoHand) { P.armR.rotation.z = 0.2; P.armL.rotation.z = -0.2; }
      P.upper.rotation.x += t < 0.5 ? -0.2 * k : 0.35 * (1 - k);
      break;
    }
    case 'spin': {
      h.body.rotation.y = ease(t) * Math.PI * 2;
      P.armR.rotation.x = -1.5; P.armL.rotation.x = -1.5;
      P.armR.rotation.z = -0.3; P.armL.rotation.z = 0.3;
      break;
    }
    case 'draw': {
      const d = st.draw || 0;
      P.armL.rotation.x = -1.55; P.armL.rotation.z = -0.15;
      P.armR.rotation.x = -1.55 + d * 0.15; P.armR.rotation.z = 0.5 + d * 0.5;
      P.upper.rotation.y = 0.35;
      break;
    }
    case 'shoot': {
      P.armL.rotation.x = -1.55; P.armR.rotation.x = -1.3; P.armR.rotation.z = 0.4 * (1 - t);
      P.upper.rotation.y = 0.35 * (1 - t);
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
      P.armR.rotation.x = lerp(-0.5, -2.6, Math.min(1, t * 1.5)); P.armL.rotation.x = st.twoHand ? P.armR.rotation.x : -0.6;
      P.upper.rotation.y = 0.5 * Math.min(1, t * 2);
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
}

import { animCreature } from './gfx/creatures/index.js';
// Beasts are posed by gfx/creatures (gaits by speed, idles, telegraphed attacks, flinches, deaths).
// st: { move, phase, pose: 'windup'|'strike'|'stun'|'dead'|'hit'|null, t, hurt?: {t, dx, dz, mag}, charge?, alert? }
export function animBeast(b, st) {
  animCreature(b, st);
}

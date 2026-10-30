// Painted ability icons: a glowing glyph for the ability's kind over an element-coloured background,
// with a small per-ability variation so no two look the same. Rendered once to a data URL and cached.
const EL = {
  fire: ['#ffb347', '#e0401a', '#3a0d04'], frost: ['#d8f4ff', '#3aa0e0', '#06223a'], shadow: ['#d6a8ff', '#6a2ad0', '#140428'],
  holy: ['#fff6c8', '#e8b830', '#3a2804'], nature: ['#d8ffb0', '#4ab030', '#0a2a06'], lightning: ['#f4f8ff', '#6a9cff', '#081838'],
  blood: ['#ffb0b0', '#c01828', '#2a0206'], arcane: ['#f0c8ff', '#b050f0', '#1e0632'], physical: ['#f4ead8', '#a08a64', '#241c12'],
  poison: ['#eaffa8', '#7ac020', '#162404'], spirit: ['#c8fff4', '#28c8b0', '#022622'], sound: ['#ffd8f0', '#e060b0', '#2a0820'],
};
const WEAPON_EL = { whirl: 'physical', shieldRush: 'physical', defiant: 'holy', leap: 'physical', charge: 'physical', gravity: 'shadow', reap: 'blood', berserk: 'blood',
  shockwave: 'physical', destiny: 'lightning', wrecking: 'physical', clearMind: 'spirit', rain: 'nature', evade: 'nature', poison: 'poison', pierce: 'holy',
  fireball: 'fire', pillar: 'fire', incinerate: 'fire', burnout: 'fire',
  skewer: 'physical', vault: 'physical', sweep: 'physical', phalanx: 'holy', bonk: 'physical', shieldBash: 'physical', quake: 'nature', thorns: 'nature',
  palmStrike: 'spirit', flyingKick: 'physical', hundredFists: 'physical', innerCalm: 'spirit',
  rend: 'blood', pounce: 'nature', whirlingAxes: 'physical', feralCry: 'nature',
  flurry: 'physical', riposte: 'spirit', fleche: 'physical', bladeDance: 'blood', backstab: 'shadow', hemorrhage: 'blood', fanKnives: 'physical', shadowVeil: 'shadow',
  powderShot: 'fire', rollReload: 'physical', stopShot: 'lightning', steady: 'spirit', scatter: 'fire', grapeshot: 'fire', blastBack: 'fire', smoke: 'shadow' };
const cache = new Map();

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const G = {
  bolt(c) { c.beginPath(); c.moveTo(-26, 26); c.quadraticCurveTo(-6, 4, 12, -12); c.lineWidth = 9; c.stroke(); c.beginPath(); c.arc(14, -14, 12, 0, 7); c.fill(); },
  volley(c) { for (const a of [-0.45, 0, 0.45]) { c.save(); c.rotate(a); c.beginPath(); c.moveTo(0, 28); c.lineTo(0, -16); c.lineWidth = 4; c.stroke(); c.beginPath(); c.moveTo(0, -28); c.lineTo(-7, -14); c.lineTo(7, -14); c.closePath(); c.fill(); c.restore(); } },
  chain(c) { c.beginPath(); c.moveTo(-6, -30); c.lineTo(-14, -2); c.lineTo(2, -4); c.lineTo(-8, 30); c.lineTo(18, -10); c.lineTo(2, -8); c.lineTo(10, -30); c.closePath(); c.fill(); },
  nova(c) { for (let i = 0; i < 12; i++) { c.save(); c.rotate(i / 12 * 6.283); c.beginPath(); c.moveTo(0, -12); c.lineTo(4, -20); c.lineTo(0, -32); c.lineTo(-4, -20); c.closePath(); c.fill(); c.restore(); } c.beginPath(); c.arc(0, 0, 9, 0, 7); c.fill(); },
  rain(c) { for (let i = 0; i < 6; i++) { const x = -22 + i * 9, y = -24 + (i % 2) * 8; c.beginPath(); c.moveTo(x + 6, y - 6); c.lineTo(x - 4, y + 22); c.lineWidth = 3.5; c.stroke(); } c.fillRect(-28, 24, 56, 4); },
  meteor(c) { c.beginPath(); c.moveTo(30, -30); c.lineTo(-2, 0); c.lineTo(8, 6); c.closePath(); c.globalAlpha = 0.6; c.fill(); c.globalAlpha = 1; c.beginPath(); c.arc(-6, 8, 14, 0, 7); c.fill(); c.fillRect(-30, 26, 60, 3); },
  drain(c) { c.beginPath(); for (let a = 0; a < 14; a += 0.1) { const r = 2 + a * 2.1; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.lineWidth = 4; c.stroke(); },
  dot(c) { c.beginPath(); c.moveTo(0, -28); c.bezierCurveTo(18, -4, 20, 14, 0, 24); c.bezierCurveTo(-20, 14, -18, -4, 0, -28); c.fill(); for (const [x, y, r] of [[18, -18, 4], [-20, -10, 3], [22, 6, 2.5]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } },
  heal(c) { c.fillRect(-8, -26, 16, 52); c.fillRect(-26, -8, 52, 16); },
  hot(c) { c.fillRect(-5, -18, 10, 36); c.fillRect(-18, -5, 36, 10); c.beginPath(); c.arc(0, 0, 27, -0.4, 4.4); c.lineWidth = 4; c.stroke(); },
  buff(c) { for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-20, 18 - i * 16); c.lineTo(0, 2 - i * 16); c.lineTo(20, 18 - i * 16); c.lineWidth = 7; c.stroke(); } },
  shield(c) { c.beginPath(); c.moveTo(0, -28); c.lineTo(22, -20); c.lineTo(20, 4); c.quadraticCurveTo(14, 20, 0, 28); c.quadraticCurveTo(-14, 20, -20, 4); c.lineTo(-22, -20); c.closePath(); c.fill(); c.globalCompositeOperation = 'destination-out'; c.fillRect(-2, -20, 4, 40); c.fillRect(-14, -6, 28, 4); c.globalCompositeOperation = 'source-over'; },
  pet(c) { c.beginPath(); c.arc(0, 0, 27, 0, 7); c.lineWidth = 3; c.stroke(); c.beginPath(); for (let i = 0; i < 5; i++) { const a = -1.571 + i * 2.513; c.lineTo(Math.cos(a) * 27, Math.sin(a) * 27); } c.closePath(); c.lineWidth = 1.5; c.stroke(); c.beginPath(); c.arc(0, -6, 8, 0, 7); c.fill(); c.beginPath(); c.moveTo(-14, 16); c.quadraticCurveTo(0, 0, 14, 16); c.closePath(); c.fill(); },
  stun(c) { G.nova(c); c.beginPath(); for (let a = 0; a < 9; a += 0.15) { const r = 1 + a * 1.4; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.lineWidth = 3; c.globalCompositeOperation = 'destination-out'; c.stroke(); c.globalCompositeOperation = 'source-over'; },
  mez(c) { c.beginPath(); for (let a = 0; a < 18; a += 0.1) { const r = a * 1.6; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.lineWidth = 3.5; c.stroke(); },
  root(c) { for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 6, 28); c.bezierCurveTo(s * 24, 8, s * -10, -6, s * 14, -26); c.lineWidth = 5; c.stroke(); } c.fillRect(-28, 26, 56, 4); },
  taunt(c) { c.beginPath(); c.arc(-8, 0, 10, 0, 7); c.fill(); for (let i = 1; i <= 3; i++) { c.beginPath(); c.arc(-8, 0, 10 + i * 7, -0.8, 0.8); c.lineWidth = 3; c.stroke(); } },
  dash(c) { c.beginPath(); c.moveTo(28, 0); c.lineTo(8, -16); c.lineTo(8, -6); c.lineTo(-10, -6); c.lineTo(-10, 6); c.lineTo(8, 6); c.lineTo(8, 16); c.closePath(); c.fill(); for (const y of [-14, 0, 14]) c.fillRect(-30, y - 1.5, 14, 3); },
  leap(c) { c.beginPath(); c.moveTo(-26, 22); c.quadraticCurveTo(0, -40, 22, 14); c.lineWidth = 5; c.stroke(); for (const a of [-0.6, 0, 0.6]) { c.save(); c.translate(22, 20); c.rotate(a); c.fillRect(-1.5, 0, 3, 10); c.restore(); } },
  blink(c) { for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; c.beginPath(); c.arc(Math.cos(a) * 22, Math.sin(a) * 22, 3, 0, 7); c.fill(); } c.beginPath(); c.moveTo(-12, 12); c.lineTo(10, -10); c.lineWidth = 5; c.stroke(); c.beginPath(); c.moveTo(14, -14); c.lineTo(2, -12); c.lineTo(12, -2); c.closePath(); c.fill(); },
  whirlwind(c) { for (let i = 0; i < 4; i++) { c.save(); c.rotate(i * 1.571); c.beginPath(); c.moveTo(4, -4); c.quadraticCurveTo(28, -14, 18, -28); c.quadraticCurveTo(14, -12, 4, -4); c.fill(); c.restore(); } c.beginPath(); c.arc(0, 0, 6, 0, 7); c.fill(); },
  fear(c) { c.beginPath(); c.moveTo(-28, 0); c.quadraticCurveTo(0, -22, 28, 0); c.quadraticCurveTo(0, 22, -28, 0); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(0, 0, 8, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over'; c.beginPath(); c.arc(0, 0, 3, 0, 7); c.fill(); },
  trap(c) { for (const s of [-1, 1]) { c.beginPath(); c.moveTo(-26, s * 4); for (let i = 0; i <= 8; i++) c.lineTo(-26 + i * 6.5, s * (i % 2 ? 18 : 4)); c.lineTo(26, s * 4); c.closePath(); c.fill(); } },
  totem(c) { for (let i = 0; i < 3; i++) c.fillRect(-10, 6 - i * 14, 20, 11); c.fillRect(-3, 20, 6, 10); c.beginPath(); c.arc(0, -30, 6, 0, 7); c.fill(); for (const s of [-1, 1]) c.fillRect(s * 10 + (s < 0 ? -8 : 0), -16, 8, 4); },
  strike(c) { for (const s of [-1, 1]) { c.save(); c.rotate(s * 0.7); c.beginPath(); c.moveTo(0, -32); c.lineTo(5, 0); c.lineTo(0, 30); c.lineTo(-5, 0); c.closePath(); c.fill(); c.restore(); } },
  cleanse(c) { G.dot(c); c.globalCompositeOperation = 'destination-out'; c.fillRect(-3, -6, 6, 20); c.fillRect(-10, 1, 20, 6); c.globalCompositeOperation = 'source-over'; },
  cone(c) { c.beginPath(); c.moveTo(-20, 24); c.arc(-20, 24, 50, -1.25, -0.32); c.closePath(); c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1; },
  line(c) { c.beginPath(); c.moveTo(-28, 26); c.lineTo(-10, 8); c.lineTo(-14, 2); c.lineTo(6, -12); c.lineTo(2, -16); c.lineTo(28, -30); c.lineWidth = 5; c.stroke(); },
  evade(c) { G.dash(c); },
  proj(c) { G.bolt(c); },
  aoe(c) { G.nova(c); },
  cast(c) { G.nova(c); },
};

// def: { id, kind, element?, color? }  (class nodes have element/color; weapon abilities use WEAPON_EL)
export function abilityIcon(def) {
  if (!def) return '';
  const key = def.id + '|' + (def.kind || '');
  if (cache.has(key)) return cache.get(key);
  const el = def.element || WEAPON_EL[def.id] || 'arcane';
  const [hi, mid, lo] = EL[el] || EL.arcane;
  const S = 96, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const h = hash(def.id || 'x');
  // background: deep element tones with a bright core and soft swirls
  const bg = c.createRadialGradient(S * (0.4 + (h % 7) / 40), S * 0.38, 4, S / 2, S / 2, S * 0.72);
  bg.addColorStop(0, mid); bg.addColorStop(0.55, lo); bg.addColorStop(1, '#000');
  c.fillStyle = bg; c.fillRect(0, 0, S, S);
  c.globalAlpha = 0.18; c.strokeStyle = hi; c.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(S / 2, S / 2, 14 + i * 8 + ((h >> i) & 3), ((h >> (i * 2)) & 7) / 1.3, ((h >> (i * 2)) & 7) / 1.3 + 2.4); c.stroke(); }
  c.globalAlpha = 1;
  // glyph with a glow
  c.save();
  c.translate(S / 2, S / 2);
  c.rotate((((h >> 8) & 15) - 7) * 0.025);
  c.scale(1.05, 1.05);
  c.fillStyle = c.strokeStyle = hi; c.lineCap = c.lineJoin = 'round';
  c.shadowColor = mid; c.shadowBlur = 14;
  (G[def.kind] || G.nova)(c);
  c.shadowBlur = 0; c.globalAlpha = 0.55; c.fillStyle = c.strokeStyle = '#ffffff';
  c.scale(0.92, 0.92); (G[def.kind] || G.nova)(c);
  c.restore();
  // bevel and inner rim
  const rim = c.createLinearGradient(0, 0, S, S); rim.addColorStop(0, 'rgba(255,240,200,.55)'); rim.addColorStop(1, 'rgba(0,0,0,.6)');
  c.strokeStyle = rim; c.lineWidth = 4; c.strokeRect(2, 2, S - 4, S - 4);
  const url = cv.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
export const iconImg = (def, cls = '') => def ? `<img class="aicon ${cls}" src="${abilityIcon(def)}" alt="">` : '';

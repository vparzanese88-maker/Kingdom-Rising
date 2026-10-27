// Kingdom Rising — gear beyond arms and armour: light sources (candles to sunstones) and gathering tools
// (woodcutting axes, mining picks, skinning knives), each in its own slot on the paper doll.
(function () {
  const KR = window.KR; const { D, G, U } = KR; const Sys = KR.Sys;
  const GEAR = (KR.Gear = {});

  // ---------- slots ----------
  for (const s of ['light', 'axe', 'pick', 'knife']) if (!D.EQUIP_SLOTS.includes(s)) D.EQUIP_SLOTS.push(s);
  Object.assign(D.SLOT_NAMES, { light: 'Light', axe: 'Woodcutting', pick: 'Mining', knife: 'Skinning' });

  // ---------- light sources ----------
  // r: how far the light reaches in metres (3D) · lum: brightness · col: flame colour · aggro: how much further
  // monsters notice you at night while it burns · stats: small bonuses that grow with the quality of the light
  GEAR.LIGHTS = {
    tallow: { name: 'Tallow Candle', icon: '🕯', r: 5, lum: 0.7, col: '#ffb060', aggro: 0.18, stats: {}, value: 8, lore: 'Cheap, smoky, and better than the dark.' },
    beeswax: { name: 'Beeswax Candle', icon: '🕯', r: 6, lum: 0.85, col: '#ffc070', aggro: 0.2, stats: { WIS: 1 }, value: 30, lore: 'Burns clean and smells of summer.' },
    candelabrum: { name: 'Iron Candelabrum', icon: '🕎', r: 8, lum: 1.1, col: '#ffb868', aggro: 0.28, stats: { WIS: 2, INT: 2 }, value: 160, lore: 'Three candles on a wrought iron stand. Priests carry them in procession.' },
    hooded: { name: 'Hooded Lantern', icon: '🏮', r: 9, lum: 1.0, col: '#ffaa55', aggro: 0.12, stats: { AGI: 2, DEX: 1 }, value: 260, lore: 'A shutter on three sides throws the light only where you want it. A thief\'s favourite.' },
    glowcap: { name: 'Glowcap Jar', icon: '🍄', r: 8, lum: 0.9, col: '#8aff9a', aggro: 0.06, stats: { INT: 3 }, value: 420, lore: 'Cave mushrooms in a stoppered jar. Cold light that beasts do not trust or follow.' },
    brass: { name: 'Brass Lantern', icon: '🏮', r: 12, lum: 1.35, col: '#ffbb66', aggro: 0.32, stats: { STA: 3, WIS: 2 }, value: 900, lore: 'Polished brass and thick glass. A traveller\'s companion.' },
    censer: { name: 'Ember Censer', icon: '🔥', r: 11, lum: 1.3, col: '#ff7a3a', aggro: 0.3, stats: { STR: 2, CHA: 3 }, value: 1400, lore: 'Swung on a chain, it trails sweet smoke and red light.' },
    great: { name: 'Great Iron Lantern', icon: '🏮', r: 16, lum: 1.7, col: '#ffc070', aggro: 0.45, stats: { STA: 4, STR: 3 }, value: 3200, lore: 'Made for city watchmen. Every creature for a mile sees you coming.' },
    phial: { name: 'Phial of Starlight', icon: '✨', r: 14, lum: 1.5, col: '#cfe4ff', aggro: 0.15, stats: { WIS: 5, INT: 5 }, value: 9000, lore: 'Light of a fallen star, sealed in crystal by the elves of old.' },
    sunstone: { name: 'Sunstone Lamp', icon: '☀', r: 20, lum: 2.0, col: '#ffe08a', aggro: 0.35, stats: { STR: 3, STA: 3, AGI: 3, DEX: 3, WIS: 3, INT: 3, CHA: 3 }, value: 25000, lore: 'Holds a sliver of noon. Night is a rumour where it shines.' },
  };
  GEAR.LIGHT_ORDER = ['tallow', 'beeswax', 'candelabrum', 'hooded', 'glowcap', 'brass', 'censer', 'great', 'phial', 'sunstone'];
  G.makeLight = function (id) {
    const L = GEAR.LIGHTS[id]; if (!L) return null;
    const tier = GEAR.LIGHT_ORDER.indexOf(id);
    return { uid: U.uid(), kind: 'gear', slot: 'light', light: id, name: L.name, icon: L.icon, tier: Math.min(5, Math.floor(tier / 2)), stats: Object.assign({}, L.stats), lit: true, value: L.value, lore: L.lore, req: 1 };
  };

  // ---------- gathering tools ----------
  GEAR.TOOL_KINDS = { axe: { name: 'Woodcutting Axe', skill: 'woodcutting', icon: '🪓', verb: 'chop' }, pick: { name: 'Mining Pick', skill: 'mining', icon: '⛏', verb: 'mine' }, knife: { name: 'Skinning Knife', skill: 'skinning', icon: '🔪', verb: 'skin' } };
  // tier 1 is sold everywhere; 2 to 5 are earned from the crafters (smith for axes and picks, tanner for knives)
  GEAR.TOOL_TIERS = [null,
    { adj: 'Copper', lv: 1, speed: 1.0, value: 25, col: '#c87a4a' },
    { adj: 'Iron', lv: 8, speed: 1.25, value: 300, col: '#9aa0a8' },
    { adj: 'Steel', lv: 16, speed: 1.5, value: 2000, col: '#c8ced8' },
    { adj: 'Mithril', lv: 26, speed: 1.85, value: 9000, col: '#9ad8ff' },
    { adj: 'Adamant', lv: 36, speed: 2.25, value: 30000, col: '#a8ffb8' },
  ];
  const TOOL_NAMES = { axe: ['Hatchet', 'Felling Axe', 'Woodsman\'s Axe', 'Timberbane', 'Heartwood Cleaver'], pick: ['Pick', 'Miner\'s Pick', 'Prospector\'s Pick', 'Deepdelver', 'Mountainbreaker'], knife: ['Skinning Knife', 'Flaying Knife', 'Hunter\'s Skinner', 'Silkcut', 'Beastbane Skinner'] };
  G.makeTool = function (kind, tier) {
    const T = GEAR.TOOL_TIERS[tier], K = GEAR.TOOL_KINDS[kind]; if (!T || !K) return null;
    const stats = tier >= 3 ? (kind === 'knife' ? { DEX: tier - 2 } : { STR: tier - 2 }) : {};
    return { uid: U.uid(), kind: 'gear', slot: kind, tool: kind, ttier: tier, tier: tier - 1, name: `${T.adj} ${TOOL_NAMES[kind][tier - 1]}`, icon: K.icon, stats, value: T.value, req: T.lv, lore: tier === 1 ? 'Every gatherer starts somewhere.' : null };
  };
  // the tool tier a hero has in hand for a kind of gathering (0 = none)
  GEAR.toolTier = (c, kind) => { const t = c.equip && c.equip[kind]; return t && t.tool === kind ? t.ttier : 0; };

  // ---------- equipping ----------
  const canUse0 = G.canUse;
  G.canUse = function (c, it) {
    if (it && it.kind === 'gear') { if ((it.req || 1) > c.level) return { ok: false, why: `Requires level ${it.req}.` }; return { ok: true }; }
    return canUse0.apply(this, arguments);
  };
  const use0 = Sys.useItem;
  Sys.useItem = function (it) { if (it && it.kind === 'gear') return Sys.equip(it); return use0.apply(this, arguments); };
  // older heroes had tool levels instead of tools: give them the real thing once
  GEAR.migrate = function (c) {
    if (!c || c._gearV) return; c._gearV = 1;
    if (c.tools) { for (const k of ['axe', 'pick']) if (c.tools[k] && !c.equip[k]) c.equip[k] = G.makeTool(k, Math.max(1, Math.min(5, c.tools[k]))); }
  };

  const start0 = Sys.startPlayer;
  Sys.startPlayer = function (c) { try { GEAR.migrate(c); } catch (e) { console.warn(e); } return start0.apply(this, arguments); };

  // ---------- lights: lit or blown out ----------
  GEAR.lightOf = (c) => { const it = c && c.equip && c.equip.light; return it && it.light ? it : null; };
  GEAR.isLit = (c) => { const it = GEAR.lightOf(c); return !!(it && it.lit !== false); };
  GEAR.toggleLight = function () {
    const p = G.player; if (!p) return; const it = GEAR.lightOf(p.c);
    if (!it) { G.log('You have no light source in your Light slot. Candles and lanterns are sold by general goods merchants.', 'sys', '#aaa'); return; }
    it.lit = it.lit === false;
    const L = GEAR.LIGHTS[it.light]; const flame = /Candle|Candelabrum/.test(it.name) ? 'candle' : 'lantern';
    G.log(it.lit ? `You light your ${it.name}.` : `You ${flame === 'candle' ? 'blow out' : 'shutter'} your ${it.name}. The dark wraps around you.`, 'sys', it.lit ? L.col : '#9aa0b8');
    KR.A.sfx(it.lit ? 'cast' : 'click', 0.35);
    KR.UI && KR.UI.refresh && KR.UI.refresh();
  };
  // how dark it is (0 day .. 1 deep night or underground)
  GEAR.darkness = function () {
    if (KR.W && KR.W.realm && KR.W.REALMS && KR.W.REALMS[KR.W.realm] && KR.W.REALMS[KR.W.realm].dungeon) return 1;
    if (window.K3 && window.K3.sky && window.K3.sky.darkness != null) return window.K3.sky.darkness;
    const h = (G.clock || 0) / 60; return h < 5 || h > 21 ? 1 : h < 7 ? (7 - h) / 2 : h > 19 ? (h - 19) / 2 : 0;
  };
  // monsters see a lit hero from further away at night, and an unlit one from closer: a rogue's best friend
  GEAR.aggroScale = function (p) {
    const dk = GEAR.darkness(); if (dk <= 0.05 || !p || !p.c) return 1;
    const it = GEAR.lightOf(p.c);
    if (it && it.lit !== false) return 1 + GEAR.LIGHTS[it.light].aggro * 2.2 * dk;
    const sneaky = ['rogue', 'ranger', 'bard'].includes(p.c.cls) ? 0.42 : 0.3;
    return 1 - sneaky * dk;
  };

  // ---------- for sale ----------
  const stock0 = Sys.vendorStock;
  Sys.vendorStock = function (kind, npc) {
    const out = stock0.apply(this, arguments);
    const L = npc && npc.city ? Sys.cityLevel(npc.city) : 1;
    if (kind === 'general' || kind === 'outfitter') {
      out.push(G.makeTool('axe', 1), G.makeTool('pick', 1), G.makeTool('knife', 1));
      out.push(G.makeLight('tallow'), G.makeLight('beeswax'));
      if (L >= 2) out.push(G.makeLight('candelabrum'), G.makeLight('hooded'));
      if (L >= 3) out.push(G.makeLight('brass'));
      if (L >= 4) out.push(G.makeLight('censer'), G.makeLight('great'));
    }
    if (kind === 'scribe' && L >= 3) out.push(G.makeLight('glowcap'));
    if (kind === 'gems' && L >= 5) out.push(G.makeLight('phial'));
    return out;
  };
})();

// The hero: first-person movement, class weapons and shouts, potions, the warhorse and the view-model.
import * as THREE from 'three';
import { PLAYER, WORLD, TEAM_COLORS, PLAYER_TEAM, SPELLS, MANA, CLASSES, DEFAULT_CLASS } from './config.js';
import { STEP } from './physics.js';
import { clamp } from './noise.js';
import { buildHorse, poseHorse, buildSoldier, poseSoldier, SADDLE_Y } from './models.js';
import { avoidCastles } from './nav.js';
import { DIRS, DIR_IDX } from './combat.js';
import { allied } from './teams.js';
import { buffSum, useShout, healPulse, traceAim } from './classes.js';

export const HORSE = { hp: 320, walk: 7, gallop: 13.5, back: 2.5, accel: 5, brake: 10, turn: 2.2, eye: 2.85 };

// weapon modes a hero can hold; sent over the network by index
export const WEAPON_MODES = ['melee', 'bow', 'crossbow', 'magic', 'hex'];

// Hit shape of each swing: slashes sweep a wide arc, thrusts reach further along a narrow line.
const SLASHES = { heavy: ['right', 'left', 'over'], light: ['right', 'left'] };

export class Player {
  constructor(game, camera, opts = {}) {
    this.game = game;
    this.camera = camera;
    this.remote = !!opts.remote;   // another person's hero (driven by network updates)
    this.netId = opts.netId ?? null;
    this.isPlayer = true;
    this.isHero = true;
    this.kind = 'hero';
    this.type = 'hero';
    this.team = opts.team ?? PLAYER_TEAM;
    this.name = opts.name || 'You';
    this.cls = CLASSES[opts.cls] ? opts.cls : DEFAULT_CLASS;
    this.spawnSeq = 0;
    this.netPose = null;
    this.walkPhase = 0;
    this.radius = 0.4;
    this.height = 1.8;
    this.eye = 1.68;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = true;
    this.alive = true;
    this.lv = { vitality: 0, strength: 0, armor: 0, magic: 0, mana: 0, regen: 0 };
    this.mana = MANA.base;
    this.spell = 'fireball';
    this.castT = 0;         // how long the cast button has been held (fireball charge)
    this.lastCast = -99;
    this.spellCd = 0;
    this.castFlash = 0;
    this.maxHp = this.C.hp;
    this.hp = this.maxHp;
    this.stamina = 100;
    this.arrows = this.C.ranged ? this.C.ranged.ammo : 0;
    this.potions = 1;
    this.weapon = this.primaryWeapon;
    this.swingT = -1;          // animation clock other people see on this hero's body
    this.blocking = false;
    this.atk = null;           // { dir, t, struck }
    this.combo = 0;
    this.attackDir = 'right';
    this.blockStart = -99;
    this.blockDir = 'right';
    this.staggerT = 0;
    this.shake = 0;
    this.drawT = 0;            // bow draw time
    this.reloadT = 0;          // crossbow: seconds until loaded
    this.shoutReady = 0;
    this.healReady = 0;
    this.lastHurt = -99;
    this.kills = 0;
    this.deaths = 0;
    this.sensitivity = 0.0022;
    this.bob = 0;
    this.hurtFlash = 0;
    // warhorse
    this.hasHorse = false;
    this.mounted = false;
    this.horse = null;        // model
    this.horseHp = 0;
    this.horsePos = new THREE.Vector3();
    this.horseYaw = 0;
    this.horseComing = false;
    this.heading = 0;
    this.rideSpeed = 0;
    this.trampled = new Map();
    if (this.camera) this.buildViewModel();
    if (this.remote) this.buildBody();
  }

  // ---------- class ----------
  get C() { return CLASSES[this.cls]; }
  get primaryWeapon() {
    const c = CLASSES[this.cls];
    return c.ranged ? c.ranged.kind : c.spells ? 'magic' : c.hex ? 'hex' : 'melee';
  }
  get usesMana() { return !!this.C.mana; }

  setClass(cls) {
    if (!CLASSES[cls]) cls = DEFAULT_CLASS;
    this.cls = cls;
    const c = this.C;
    this.maxHp = c.hp + this.lv.vitality * 30;
    this.hp = this.maxHp;
    this.arrows = c.ranged ? c.ranged.ammo : 0;
    this.spell = c.spells ? c.spells[0] : c.hex ? 'hex' : null;
    this.weapon = this.primaryWeapon;
    this.mana = this.manaMax;
    this.atk = null;
    if (this.camera) this.buildViewModel();
    if (this.remote) { this.removeBody(); this.buildBody(); }
  }

  // ---------- third-person body for other people's heroes ----------
  buildBody() {
    this.body = buildSoldier('hero_' + this.cls, this.team, 2);
    this.game.scene.add(this.body.root);
    const c = document.createElement('canvas');
    c.width = 256; c.height = 48;
    const ctx = c.getContext('2d');
    ctx.font = 'bold 28px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(this.name, 128, 34);
    ctx.fillStyle = '#' + TEAM_COLORS[this.team].toString(16).padStart(6, '0');
    ctx.fillText(this.name, 128, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    this.tag.scale.set(2.4, 0.45, 1);
    this.tag.renderOrder = 10;
    this.game.scene.add(this.tag);
  }

  removeBody() {
    if (this.body) this.game.scene.remove(this.body.root);
    if (this.tag) this.game.scene.remove(this.tag);
    if (this.horse) this.game.scene.remove(this.horse.root);
  }

  updateBody(dt) {
    if (!this.body) return;
    const b = this.body;
    b.root.visible = this.alive;
    this.tag.visible = this.alive;
    if (!this.alive) return;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.walkPhase += dt * sp * 2.1;
    b.root.position.set(this.pos.x, this.pos.y + (this.mounted ? SADDLE_Y : 0), this.pos.z);
    b.root.rotation.y = this.mounted ? this.heading : this.yaw;
    poseSoldier(b, { phase: this.mounted && this.horse ? this.horse.phase : this.walkPhase, speed: sp, moving: sp > 0.3, swingT: this.swingT, attackDir: this.attackDir, stagger: this.staggerT > 0 ? 1 : 0, mounted: this.mounted, blocking: this.blocking });
    this.tag.position.set(this.pos.x, this.pos.y + (this.mounted ? 3.6 : 2.4), this.pos.z);
  }

  // apply the latest pose received over the network (smoothed)
  remoteUpdate(dt) {
    const n = this.netPose;
    const s = INTERP_SAMPLE;
    const interpolated = n && this.interp && this.interp.sample(s);
    if (interpolated) {
      // network client: interpolated between the host's updates
      this.pos.set(s.x, s.y, s.z);
      this.yaw = n.m ? s.extra : s.yaw;
    } else if (n) {
      const d = Math.hypot(n.x - this.pos.x, n.z - this.pos.z);
      const k = d > 8 ? 1 : Math.min(1, dt * 14);
      this.pos.x += (n.x - this.pos.x) * k;
      this.pos.y += (n.y - this.pos.y) * k;
      this.pos.z += (n.z - this.pos.z) * k;
      let dy = n.yaw - this.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * Math.min(1, dt * 14);
    }
    if (n) {
      this.pitch = n.pitch;
      this.vel.set(n.vx, 0, n.vz);
      if (n.b && !this.blocking) this.blockStart = this.game.time - (n.ba || 0);
      this.blocking = !!n.b;
      this.weapon = WEAPON_MODES[n.w] || this.primaryWeapon;
      this.mounted = !!n.m && this.hasHorse;
      this.radius = this.mounted ? 0.8 : 0.4;
      this.heading = interpolated && n.m ? s.yaw : n.h;
      this.rideSpeed = n.rs;
      if (!this.mounted && n.hx !== undefined) { this.horsePos.set(n.hx, n.hy, n.hz); this.horseYaw = n.hyaw; }
    }
    if (this.swingT >= 0) { this.swingT += dt; if (this.swingT > 0.62) this.swingT = -1; }
    if (this.staggerT > 0) this.staggerT -= dt;
    if (this.game.mode !== 'client' && this.alive) {
      if (this.game.time - this.lastHurt > 8 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + dt * 4);
      if (this.usesMana && this.game.time - this.lastCast > MANA.delay) this.mana = Math.min(this.manaMax, this.mana + this.manaRegen * dt);
      if (this.mounted) this.trample(dt);
    }
    this.updateBody(dt);
  }

  // pose sent from a client to the host
  poseMsg() {
    const m = { x: r2(this.pos.x), y: r2(this.pos.y), z: r2(this.pos.z), yaw: r2(this.yaw), pitch: r2(this.pitch),
      vx: r2(this.vel.x), vz: r2(this.vel.z), b: this.blocking ? 1 : 0, w: WEAPON_MODES.indexOf(this.weapon),
      ba: r2(Math.max(0, this.game.time - this.blockStart)),
      m: this.mounted ? 1 : 0, h: r2(this.heading), rs: r2(this.rideSpeed) };
    if (this.hasHorse && !this.mounted) { m.hx = r2(this.horsePos.x); m.hy = r2(this.horsePos.y); m.hz = r2(this.horsePos.z); m.hyaw = r2(this.horseYaw); }
    return m;
  }

  notify(text, important = false) { this.game.deliver(this, { k: 'toast', text, team: this.team, imp: important }); }
  sound(name) { this.game.deliver(this, { k: 'snd', n: name }); }
  get isLocal() { return this === this.game.player; }
  get netClient() { return this.isLocal && this.game.mode === 'client'; }

  get armor() { return this.C.armor + this.lv.armor * 3 + buffSum(this, 'armor'); }
  get dmgMult() { return 1 + this.lv.strength * 0.12; }
  get speedMult() { return 1 + buffSum(this, 'haste'); }
  get manaMax() { return this.usesMana ? MANA.base + MANA.perLevel * (this.lv.mana || 0) : 0; }
  get manaRegen() { return MANA.regen * 1.4 * (1 + MANA.regenPerLevel * (this.lv.regen || 0)); }
  get spellMult() { return (1 + 0.25 * (this.lv.magic || 0)) * this.dmgMult; }
  get spells() { return this.C.spells || []; }
  get maxArrows() { return this.C.ranged ? this.C.ranged.ammo : 0; }
  get shoutLeft() { return Math.max(0, (this.shoutReady || 0) - this.game.time); }

  chest(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.25, this.pos.z); }

  recalc() {
    const old = this.maxHp;
    this.maxHp = this.C.hp + this.lv.vitality * 30;
    this.hp += this.maxHp - old;
  }

  spawn(at, yaw) {
    this.pos.copy(at);
    this.pos.y = this.game.physics.groundHeight(at.x, at.z, at.y + 3);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.yaw = yaw;
    this.pitch = 0;
    this.hp = this.maxHp;
    this.stamina = 100;
    this.alive = true;
    this.swingT = -1;
    this.atk = null;
    this.mana = this.manaMax;
    this.arrows = Math.max(this.arrows, Math.round(this.maxArrows / 2));
    this.spawnSeq++;
    if (this.viewModel) this.viewModel.visible = true;
    this.mounted = false;
    this.rideSpeed = 0;
    this.radius = 0.4;
    if (this.hasHorse) {
      this.horsePos.set(at.x + 2.5, 0, at.z);
      this.horsePos.y = this.game.physics.groundHeight(this.horsePos.x, this.horsePos.z, at.y + 3);
      this.horseComing = false;
    }
  }

  // ---------- warhorse ----------
  ensureHorseModel() {
    if (!this.horse) {
      this.horse = buildHorse(this.team, 1, true);
      this.game.scene.add(this.horse.root);
    }
  }

  giveHorse() {
    this.hasHorse = true;
    this.horseHp = HORSE.hp;
    this.horseDeadT = undefined;
    this.ensureHorseModel();
    this.horse.root.visible = true;
    this.horse.root.rotation.set(0, 0, 0);
    this.horsePos.copy(this.pos).add(new THREE.Vector3(Math.cos(this.yaw) * 2.5, 0, -Math.sin(this.yaw) * 2.5));
    this.horsePos.y = this.game.physics.groundHeight(this.horsePos.x, this.horsePos.z, this.pos.y + 2);
    this.horseYaw = this.yaw;
  }

  toggleMount() {
    const g = this.game;
    if (!this.hasHorse) { this.notify('You have no horse. Buy a Warhorse in the shop (B → Items).'); return; }
    if (this.mounted) {
      this.mounted = false;
      this.radius = 0.4;
      this.horsePos.copy(this.pos);
      this.horseYaw = this.heading;
      // step off to the left of the horse
      const sx = Math.cos(this.heading), sz = -Math.sin(this.heading);
      this.pos.x -= sx * 1.3; this.pos.z -= sz * 1.3;
      g.physics.resolve(this.pos, this.radius, this.pos.y, this.height, this.team);
      this.vel.set(0, 0, 0);
      this.rideSpeed = 0;
      return;
    }
    const d = Math.hypot(this.horsePos.x - this.pos.x, this.horsePos.z - this.pos.z);
    if (d < 3.5) {
      this.mounted = true;
      this.horseComing = false;
      this.radius = 0.8;
      this.pos.x = this.horsePos.x; this.pos.z = this.horsePos.z;
      this.heading = this.horseYaw;
      this.swingT = -1;
      this.drawT = 0;
    } else {
      this.horseComing = true;
      this.notify('You whistle for your horse.');
      this.sound('order');
    }
  }

  loseHorse(silent = false) {
    const g = this.game;
    const wasMounted = this.mounted;
    if (wasMounted) {
      this.horsePos.copy(this.pos);
      this.horseYaw = this.heading;
      this.mounted = false;
      this.radius = 0.4;
      this.rideSpeed = 0;
    }
    this.hasHorse = false;
    this.horseDeadT = 0;
    g.fx.blood(this.horsePos.clone().setY(this.horsePos.y + 1.4), 20);
    g.audio.play('death', this.horsePos);
    if (!silent) this.notify('Your horse has been killed!', true);
  }

  // riderless horse: idle, or trot over when whistled; dead horse: topple and fade
  updateHorse(dt) {
    if (!this.horse) return;
    const h = this.horse;
    const g = this.game;
    if (!this.hasHorse) {
      if (this.horseDeadT === undefined) { h.root.visible = false; return; }
      this.horseDeadT += dt;
      h.root.rotation.z = Math.min(Math.PI / 2 * 0.95, this.horseDeadT * 3);
      if (this.horseDeadT > 10) { h.root.visible = false; this.horseDeadT = undefined; }
      return;
    }
    h.root.visible = true;
    if (this.mounted) {
      h.root.position.copy(this.pos);
      h.root.rotation.set(0, this.heading, 0);
      poseHorse(h, Math.abs(this.rideSpeed), dt);
      return;
    }
    let sp = 0;
    if (this.horseComing && this.alive) {
      const d = Math.hypot(this.pos.x - this.horsePos.x, this.pos.z - this.horsePos.z);
      if (d < 2.6) this.horseComing = false;
      else {
        const wp = avoidCastles(g, this.horsePos, this.pos);
        const dx = wp.x - this.horsePos.x, dz = wp.z - this.horsePos.z;
        const dl = Math.hypot(dx, dz) || 1;
        sp = d > 12 ? 11 : 5;
        this.horsePos.x += (dx / dl) * sp * dt;
        this.horsePos.z += (dz / dl) * sp * dt;
        g.physics.resolve(this.horsePos, 0.8, this.horsePos.y, 2.6, this.team, true);
        let dy = Math.atan2(dx, dz) - this.horseYaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        this.horseYaw += dy * Math.min(1, dt * 4);
      }
    }
    this.horsePos.y = g.physics.groundHeight(this.horsePos.x, this.horsePos.z, this.horsePos.y + 0.5);
    h.root.position.copy(this.horsePos);
    h.root.rotation.set(0, this.horseYaw, 0);
    poseHorse(h, sp, dt);
  }

  // ---------- view model ----------
  buildViewModel() {
    if (this.viewModel) this.camera.remove(this.viewModel);
    const vm = new THREE.Group();
    this.viewModel = vm;
    this.camera.add(vm);
    this.vmMelee = new THREE.Group();
    this.vmShield = new THREE.Group();
    this.vmBow = new THREE.Group();
    this.vmXbow = new THREE.Group();
    this.vmMagic = new THREE.Group();
    vm.add(this.vmMelee, this.vmShield, this.vmBow, this.vmXbow, this.vmMagic);
    const M = {
      steel: new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 0.95, roughness: 0.22 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.8 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xc9a040, metalness: 0.9, roughness: 0.3 }),
      team: new THREE.MeshStandardMaterial({ color: TEAM_COLORS[this.team], roughness: 0.75 }),
      trim: new THREE.MeshStandardMaterial({ color: 0xe8d9a8, roughness: 0.7 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.8 }),
      glove: new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.9 }),
    };
    const c = this.C;
    if (c.melee) this.buildMeleeVm(c.melee.weapon, M);
    if (c.block >= 0.7) this.buildShieldVm(c.look.shield, M);
    if (c.ranged && c.ranged.kind === 'bow') this.buildBowVm(M);
    if (c.ranged && c.ranged.kind === 'crossbow') this.buildXbowVm(M);
    if (c.spells || c.hex || c.heal) this.buildMagicVm(M);
  }

  buildMeleeVm(kind, M) {
    const G = this.vmMelee;
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); G.add(m); return m;
    };
    add(new THREE.BoxGeometry(0.09, 0.12, 0.1), M.glove, 0, 0, 0);
    if (kind === 'sword' || kind === 'dagger' || kind === 'greatsword') {
      const len = kind === 'dagger' ? 0.36 : kind === 'greatsword' ? 1.2 : 0.95;
      const w = kind === 'greatsword' ? 0.075 : kind === 'dagger' ? 0.04 : 0.05;
      add(new THREE.BoxGeometry(w, len, 0.012), M.steel, 0, 0.12 + len / 2, 0);
      const tip = add(new THREE.ConeGeometry(w * 0.7, 0.12, 4), M.steel, 0, 0.12 + len + 0.06, 0);
      tip.scale.z = 0.3;
      add(new THREE.BoxGeometry(kind === 'greatsword' ? 0.4 : kind === 'dagger' ? 0.14 : 0.26, 0.035, 0.05), kind === 'greatsword' ? M.gold : M.dark, 0, 0.11, 0);
      const grip = kind === 'greatsword' ? 0.36 : 0.2;
      add(new THREE.CylinderGeometry(0.022, 0.022, grip, 8), M.dark, 0, 0.1 - grip / 2, 0);
      add(new THREE.SphereGeometry(0.035, 8, 6), kind === 'greatsword' ? M.gold : M.steel, 0, 0.08 - grip, 0);
      if (kind === 'greatsword') add(new THREE.BoxGeometry(0.09, 0.12, 0.1), M.glove, 0, -0.18, 0); // second hand
    } else if (kind === 'mace') {
      add(new THREE.CylinderGeometry(0.02, 0.022, 0.52, 8), M.wood, 0, 0.18, 0);
      add(new THREE.SphereGeometry(0.06, 10, 8), M.steel, 0, 0.47, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(new THREE.BoxGeometry(0.012, 0.12, 0.05), M.steel, Math.cos(a) * 0.05, 0.47, Math.sin(a) * 0.05, 0, -a, 0);
      }
    } else if (kind === 'spear' || kind === 'pike') {
      const len = kind === 'pike' ? 4.6 : 2.4;
      const back = kind === 'pike' ? 1.2 : 0.6;
      add(new THREE.CylinderGeometry(kind === 'pike' ? 0.014 : 0.018, kind === 'pike' ? 0.016 : 0.02, len, 8), M.wood, 0, len / 2 - back, 0);
      add(new THREE.ConeGeometry(0.045, 0.3, 6), M.steel, 0, len - back + 0.15, 0).scale.z = 0.4;
      add(new THREE.CylinderGeometry(0.028, 0.028, 0.08, 8), M.dark, 0, len - back - 0.02, 0);
      if (kind === 'pike') add(new THREE.BoxGeometry(0.09, 0.12, 0.1), M.glove, 0, -0.55, 0);
    }
    const thrust = kind === 'spear' || kind === 'pike';
    this.vmMeleeBase = thrust
      ? { pos: new THREE.Vector3(0.3, -0.36, -0.25), rot: new THREE.Euler(-1.46, 0.08, 0) }
      : kind === 'greatsword'
        ? { pos: new THREE.Vector3(0.36, -0.46, -0.72), rot: new THREE.Euler(-0.6, 0.18, -0.32) }
        : { pos: new THREE.Vector3(0.32, -0.32, -0.55), rot: new THREE.Euler(-0.5, 0.15, -0.35) };
  }

  buildShieldVm(kind, M) {
    let sh;
    if (kind !== 'kite') {
      sh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 20), M.team);
      sh.rotation.x = Math.PI / 2;
      const boss = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.steel);
      boss.rotation.x = -Math.PI / 2;
      boss.position.z = -0.02;
      sh.add(boss);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 6, 24), M.steel);
      rim.rotation.x = Math.PI / 2;
      sh.add(rim);
    } else {
      sh = new THREE.Group();
      const shape = new THREE.Shape();
      shape.moveTo(-0.3, 0.35); shape.lineTo(0.3, 0.35); shape.quadraticCurveTo(0.32, -0.2, 0, -0.62); shape.quadraticCurveTo(-0.32, -0.2, -0.3, 0.35);
      const face = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }), M.team);
      face.rotation.y = Math.PI;
      sh.add(face);
      const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.01), M.trim);
      cross1.position.set(0, -0.08, -0.05);
      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.01), M.trim);
      cross2.position.set(0, 0.14, -0.05);
      sh.add(cross1, cross2);
    }
    this.vmShield.add(sh);
    this.vmShield.scale.setScalar(0.8);
    this.vmShieldBase = { pos: new THREE.Vector3(-0.66, -0.5, -0.72), rot: new THREE.Euler(0.15, 0.85, 0.15) };
    this._shInit = false;
  }

  buildBowVm(M) {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(0, 0, -0.3), new THREE.Vector3(0, -0.62, 0));
    const limb = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.02, 6, false), M.dark);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1.24, 4), M.trim);
    this.vmString = string;
    const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.8, 4), M.wood);
    arrow.rotation.x = Math.PI / 2;
    arrow.position.z = -0.25;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.08, 4), M.steel);
    head.rotation.x = -Math.PI / 2;
    head.position.z = -0.68;
    const arrowGrp = new THREE.Group();
    arrowGrp.add(arrow, head);
    this.vmArrow = arrowGrp;
    this.vmBow.add(limb, string, arrowGrp);
    this.vmBowBase = { pos: new THREE.Vector3(-0.08, -0.12, -0.6), rot: new THREE.Euler(0, 0, 0.25) };
  }

  buildXbowVm(M) {
    const X = this.vmXbow;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.75), M.wood);
    stock.position.z = -0.1;
    const prod = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.035, 0.05), M.steel);
    prod.position.set(0, 0.02, -0.42);
    const string = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.008, 0.008), M.trim);
    string.position.set(0, 0.04, -0.3);
    this.vmXString = string;
    const bolt = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 4), M.wood);
    shaft.rotation.x = Math.PI / 2;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 4), M.steel);
    head.rotation.x = -Math.PI / 2;
    head.position.z = -0.22;
    bolt.add(shaft, head);
    bolt.position.set(0, 0.06, -0.38);
    this.vmBolt = bolt;
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.1), M.glove);
    hand.position.set(0, -0.08, 0.12);
    X.add(stock, prod, string, bolt, hand);
    X.scale.setScalar(0.85);
    this.vmXbowBase = { pos: new THREE.Vector3(0.2, -0.17, -0.36), rot: new THREE.Euler(0.06, 0.08, 0.04) };
  }

  // spell hand: an open glove with a glowing orb above the palm (wizard, witch, priest)
  buildMagicVm(M) {
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.12), M.glove);
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.22, 8), M.glove);
    wrist.rotation.x = Math.PI / 2; wrist.position.z = 0.15;
    const fingers = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.08), M.glove);
      f.position.set(-0.035 + i * 0.023, 0.025, -0.08);
      f.rotation.x = 0.6;
      fingers.add(f);
    }
    this.vmOrbMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.vmOrb = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), this.vmOrbMat);
    this.vmOrb.position.set(0, 0.09, -0.04);
    this.vmMagic.add(palm, wrist, fingers, this.vmOrb);
    // the priest keeps the healing hand on the left, the mace in the right
    this.vmMagicBase = this.C.heal ? new THREE.Vector3(-0.26, -0.25, -0.5) : new THREE.Vector3(0.24, -0.3, -0.48);
    this.vmMagic.position.copy(this.vmMagicBase);
    this.vmMagic.rotation.set(0.2, this.C.heal ? 0.2 : -0.15, 0);
  }

  updateViewModel(dt, moving, sprint) {
    const vm = this.viewModel;
    const w = this.weapon;
    const c = this.C;
    this.bob += dt * (moving ? (sprint ? 13 : 9) : 2);
    const bobAmt = moving ? (sprint ? 0.03 : 0.018) : 0.004;
    vm.position.set(Math.sin(this.bob * 0.5) * bobAmt, -Math.abs(Math.sin(this.bob)) * bobAmt, 0);

    // spell hand: wizard's spells, witch's hex, priest's healing
    const handShown = w === 'magic' || w === 'hex' || (c.heal && w === 'melee');
    this.vmMagic.visible = handShown;
    if (handShown) {
      let color = 0x7dffa0, ready = this.mana >= (c.heal ? c.heal.mana : 0) && this.game.time >= this.healReady, charge = 0;
      if (w === 'magic') {
        const s = SPELLS[this.spell];
        color = s.color; ready = this.mana >= s.cost;
        charge = this.spell === 'fireball' ? Math.min(1, Math.max(0, (this.castT - 0.15) / SPELLS.fireball.charge)) : 0;
      } else if (w === 'hex') { color = SPELLS.hex.color; ready = this.mana >= SPELLS.hex.cost; }
      this.vmOrbMat.color.setHex(color);
      const pulse = 1 + Math.sin(this.game.time * 14) * 0.06;
      this.vmOrb.scale.setScalar((ready ? 0.032 + charge * 0.03 : 0.018) * pulse);
      this.vmOrbMat.opacity = ready ? 0.9 : 0.35;
      const b = this.vmMagicBase;
      this.vmMagic.position.set(b.x - charge * 0.05, b.y + charge * 0.04, b.z + this.castFlash * 0.12);
      if (ready && Math.random() < dt * 30) {
        const wp = this.vmOrb.getWorldPosition(new THREE.Vector3());
        this.game.fx.orb(wp, new THREE.Color(color), 0.04 + charge * 0.06);
      }
      this.castFlash = Math.max(0, (this.castFlash || 0) - dt * 5);
    }

    const meleeMode = w === 'melee';
    this.vmMelee.visible = meleeMode;
    this.vmShield.visible = meleeMode && !!this.vmShieldBase;
    this.vmBow.visible = w === 'bow';
    this.vmXbow.visible = w === 'crossbow';

    if (meleeMode && this.vmMeleeBase) {
      const b = this.vmMeleeBase;
      const S = this.vmMelee;
      S.position.copy(b.pos);
      S.rotation.copy(b.rot);
      const atk = this.atk;
      if (atk) {
        const T = c.melee.time;
        const k = atk.t / T;
        if (atk.dir === 'thrust') {
          // pull back, lunge, recover
          const z = k < 0.35 ? 0.14 * easeOut(k / 0.35) : k < 0.55 ? 0.14 - 0.7 * easeOut((k - 0.35) / 0.2) : -0.56 + 0.56 * easeInOut((k - 0.55) / 0.45);
          S.position.z += z;
          S.position.y += k < 0.55 ? 0.03 : 0;
        } else {
          const W = VM_WIND[atk.dir], E = VM_END[atk.dir];
          if (k < 0.35) applyVm(S, VM_ZERO, W, easeOut(k / 0.35));
          else if (k < 0.55) applyVm(S, W, E, easeOut((k - 0.35) / 0.2));
          else applyVm(S, E, VM_ZERO, easeInOut(Math.min(1, (k - 0.55) / 0.45)));
        }
      } else if (this.blocking) {
        // raise the weapon across the body to parry
        if (this.vmShieldBase) { S.position.x += 0.1; S.position.y -= 0.08; S.rotation.z -= 0.3; }
        else { S.position.x -= 0.18; S.position.y += 0.1; S.rotation.z += 1.1; }
      }
      if (this.staggerT > 0) { S.position.y -= 0.12 * Math.min(1, this.staggerT * 3); S.rotation.x -= 0.4 * Math.min(1, this.staggerT * 3); }
      if (this.vmShieldBase) {
        const sb = this.vmShieldBase;
        const target = this.blocking ? { x: -0.14, y: -0.15, z: -0.55, ry: 0.05 } : { x: sb.pos.x, y: sb.pos.y, z: sb.pos.z, ry: sb.rot.y };
        const kk = Math.min(1, dt * 14);
        const sh = this.vmShield;
        if (!this._shInit) { sh.position.copy(sb.pos); sh.rotation.copy(sb.rot); this._shInit = true; }
        sh.position.x += (target.x - sh.position.x) * kk;
        sh.position.y += (target.y - sh.position.y) * kk;
        sh.position.z += (target.z - sh.position.z) * kk;
        sh.rotation.y += (target.ry - sh.rotation.y) * kk;
      }
    } else if (w === 'bow' && this.vmBowBase) {
      const b = this.vmBowBase;
      this.vmBow.position.copy(b.pos);
      this.vmBow.rotation.copy(b.rot);
      const draw = Math.min(1, this.drawT / c.ranged.draw);
      this.vmArrow.visible = this.arrows > 0;
      this.vmArrow.position.z = 0.22 * draw;
      this.vmString.position.z = 0.22 * draw;
      this.vmString.scale.y = 1 - draw * 0.08;
      this.vmBow.position.x += 0.04 * draw;
      this.vmBow.position.y += 0.03 * draw;
      if (draw >= 1) this.vmBow.position.x += (Math.random() - 0.5) * 0.002;
    } else if (w === 'crossbow' && this.vmXbowBase) {
      const b = this.vmXbowBase;
      const X = this.vmXbow;
      X.position.copy(b.pos);
      X.rotation.copy(b.rot);
      const loaded = this.reloadT <= 0 && this.arrows > 0;
      this.vmBolt.visible = loaded;
      // reloading: tip the crossbow down and crank the string back
      const r = this.reloadT > 0 ? Math.sin(Math.min(1, this.reloadT / c.ranged.reload) * Math.PI) : 0;
      X.rotation.x -= r * 0.7;
      X.position.y -= r * 0.12;
      this.vmXString.position.z = loaded ? -0.3 : -0.42 + 0.12 * (1 - Math.min(1, this.reloadT / c.ranged.reload));
      X.position.z += this.castFlash * 0.1;
      this.castFlash = Math.max(0, (this.castFlash || 0) - dt * 6);
      if (this.zoomed) { X.position.x = 0; X.position.y += 0.08; }
    }
  }

  // ---------- per-frame ----------
  update(dt, input) {
    const g = this.game;
    if (!this.alive) return;
    const m = input.mouse;
    const c = this.C;

    // look
    this.yaw -= m.dx * this.sensitivity * (this.zoomed ? 0.5 : 1);
    this.pitch = clamp(this.pitch - m.dy * this.sensitivity * (this.zoomed ? 0.5 : 1), -1.45, 1.45);

    // weapons: 1 primary, 2 dagger for archers; the wizard picks spells with 1 / 2 / 3 or the wheel
    if (c.spells) {
      ['Digit1', 'Digit2', 'Digit3'].forEach((k, i) => { if (input.hit(k)) this.selectSpell(c.spells[i]); });
      if (m.wheel) this.selectSpell(c.spells[(c.spells.indexOf(this.spell) + (m.wheel > 0 ? 1 : c.spells.length - 1)) % c.spells.length]);
    } else {
      if (input.hit('Digit1')) this.setWeapon(this.primaryWeapon);
      if (input.hit('Digit2') && c.ranged) this.setWeapon('melee');
      if (m.wheel && c.ranged) this.setWeapon(this.weapon === 'melee' ? this.primaryWeapon : 'melee');
    }
    if (input.hit('KeyR')) this.shout();
    if (this.usesMana && g.time - this.lastCast > MANA.delay) this.mana = Math.min(this.manaMax, this.mana + this.manaRegen * dt);
    this.spellCd = Math.max(0, this.spellCd - dt);
    if (this.reloadT > 0) {
      const before = this.reloadT;
      this.reloadT = Math.max(0, this.reloadT - dt);
      if (before > 0 && this.reloadT === 0 && this.weapon === 'crossbow') g.audio.play('block');
    }
    if (input.hit('KeyQ')) this.drinkPotion();

    if (input.hit('KeyE')) {
      if (g.leverNear(this)) g.localToggleGate();
      else this.toggleMount();
    }

    // movement
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let moving, sprint = false;
    if (this.mounted) {
      // the horse has momentum and turns toward where you look
      let target = 0;
      sprint = input.down('ShiftLeft') && this.stamina > 5;
      if (input.down('KeyW')) target = sprint ? HORSE.gallop : HORSE.walk;
      if (input.down('KeyS')) target = -HORSE.back;
      const dv = target - this.rideSpeed;
      this.rideSpeed += clamp(dv, -HORSE.brake * dt, HORSE.accel * dt);
      if (sprint && this.rideSpeed > HORSE.walk) this.stamina = Math.max(0, this.stamina - dt * 9);
      else this.stamina = Math.min(100, this.stamina + dt * 14);
      let turn = 0;
      if (input.down('KeyA')) turn += 1;
      if (input.down('KeyD')) turn -= 1;
      let dy = this.yaw - this.heading;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      const rate = HORSE.turn * dt * (Math.abs(this.rideSpeed) > 0.5 ? 1 : 0.6);
      this.heading += turn ? turn * rate : clamp(dy, -rate, rate);
      if (turn) this.yaw += turn * rate;
      this.vel.x = Math.sin(this.heading) * this.rideSpeed;
      this.vel.z = Math.cos(this.heading) * this.rideSpeed;
      moving = Math.abs(this.rideSpeed) > 0.3;
      this.trample(dt);
    } else {
      let mx = 0, mz = 0;
      if (input.down('KeyW')) { mx += fx; mz += fz; }
      if (input.down('KeyS')) { mx -= fx; mz -= fz; }
      if (input.down('KeyA')) { mx += fz; mz -= fx; }
      if (input.down('KeyD')) { mx -= fz; mz += fx; }
      const ml = Math.hypot(mx, mz);
      moving = ml > 0.01;
      sprint = input.down('ShiftLeft') && moving && this.stamina > 5 && !this.blocking && this.drawT === 0;
      let speed = c.speed * this.speedMult * (sprint ? 1.6 : 1);
      if (this.blocking) speed *= 0.55;
      if (this.drawT > 0 || this.zoomed) speed *= 0.6;
      if (sprint) this.stamina = Math.max(0, this.stamina - dt * 18);
      else this.stamina = Math.min(100, this.stamina + dt * (this.blocking ? 6 : 16));
      const tx = moving ? (mx / ml) * speed : 0, tz = moving ? (mz / ml) * speed : 0;
      const acc = this.onGround ? 12 : 2.5;
      this.vel.x += (tx - this.vel.x) * Math.min(1, dt * acc);
      this.vel.z += (tz - this.vel.z) * Math.min(1, dt * acc);
    }

    if (input.hit('Space') && this.onGround && this.stamina > 8 && !this.mounted) {
      this.vy = PLAYER.jump;
      this.onGround = false;
      this.stamina -= 8;
    }

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    const L = WORLD.playHalf;
    this.pos.x = clamp(this.pos.x, -L, L);
    this.pos.z = clamp(this.pos.z, -L, L);
    if (g.physics.resolve(this.pos, this.radius, this.pos.y, this.mounted ? 2.8 : this.height, this.team) && this.mounted) {
      this.rideSpeed *= 0.6; // ran into a wall
    }

    // vertical
    this.vy -= WORLD.gravity * dt;
    let ny = this.pos.y + this.vy * dt;
    const ground = g.physics.groundHeight(this.pos.x, this.pos.z, Math.max(this.pos.y, ny));
    if (ny <= ground) {
      ny = ground; this.vy = 0; this.onGround = true;
    } else if (this.onGround && this.vy <= 0 && this.pos.y - ground < STEP) {
      ny = ground; this.vy = 0; // follow ramps / slopes downward
    } else {
      this.onGround = false;
    }
    this.pos.y = ny;

    // combat
    this.zoomed = false;
    if (this.staggerT > 0) {
      this.staggerT -= dt;
      this.atk = null;
      this.blocking = false;
      this.drawT = 0;
    } else if (this.weapon === 'melee') {
      this.meleeInput(dt, m);
    } else if (this.weapon === 'magic') {
      this.blocking = false;
      this.magicInput(dt, m);
    } else if (this.weapon === 'hex') {
      this.blocking = false;
      if ((m.left || m.leftPressed) && this.spellCd <= 0) this.castHex();
    } else if (this.weapon === 'crossbow') {
      this.blocking = false;
      this.zoomed = m.right;
      if (m.leftPressed) this.fireCrossbow();
    } else {
      this.blocking = false;
      if (m.left && this.arrows > 0) this.drawT += dt;
      if (m.leftReleased && this.drawT > 0) {
        if (this.drawT > 0.15 && this.arrows > 0) this.shoot();
        this.drawT = 0;
      }
      if (!m.left && !m.leftReleased) this.drawT = 0;
      this.zoomed = m.right;
    }
    this.shake = Math.max(0, this.shake - dt);

    // regen when out of combat (the host decides this in online games)
    if (g.mode !== 'client' && g.time - this.lastHurt > 8 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + dt * 4);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);

    // camera
    this.camera.position.set(this.pos.x, this.pos.y + (this.mounted ? HORSE.eye : this.eye), this.pos.z);
    const sk = this.shake * 0.06;
    this.camera.rotation.set(this.pitch + (Math.random() - 0.5) * sk, this.yaw + Math.PI + (Math.random() - 0.5) * sk, (Math.random() - 0.5) * sk, 'YXZ');
    const fov = this.zoomed ? 42 : 75;
    if (Math.abs(this.camera.fov - fov) > 0.1) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 10);
      this.camera.updateProjectionMatrix();
    }
    this.updateViewModel(dt, moving && this.onGround, sprint);
  }

  // Melee: hold left click to keep swinging. Small weapons swing fast for small damage,
  // big weapons slowly for big damage. Right click guards (the priest heals instead).
  meleeInput(dt, m) {
    const g = this.game;
    const c = this.C;
    const M = c.melee;
    let atk = this.atk;
    if (c.heal) {
      this.blocking = false;
      if (m.right && g.time >= this.healReady) this.castHeal();
    } else if (m.right && (!atk || atk.t > M.time * 0.6) && c.block > 0) {
      if (!this.blocking) this.blockStart = g.time; // raising the guard opens a parry window
      this.blocking = true;
      this.atk = atk = null;
    } else this.blocking = false;
    if (this.blocking) return;

    if (!atk && m.left && this.stamina > M.stamina * 0.5) {
      const dirs = M.thrust ? ['thrust'] : M.heavy ? SLASHES.heavy : SLASHES.light;
      const dir = dirs[this.combo++ % dirs.length];
      this.atk = atk = { dir, t: 0, struck: false };
      this.attackDir = dir;
      this.stamina = Math.max(0, this.stamina - M.stamina);
      this.swingT = 0;
      g.audio.play('swing');
      if (this.netClient) g.net.toHost({ a: 'swing', d: DIR_IDX[dir] });
    }
    if (!atk) { if (!m.left) this.combo = 0; return; }
    atk.t += dt;
    const k = atk.t / M.time;
    // body animation for other people: wind-up, strike, recover
    this.swingT = k < 0.35 ? 0.25 * (k / 0.35) : k < 0.55 ? 0.25 + 0.15 * ((k - 0.35) / 0.2) : Math.min(0.62, 0.4 + 0.22 * ((k - 0.55) / 0.45));
    if (!atk.struck && k >= 0.42) { atk.struck = true; this.meleeStrike(atk.dir); }
    if (k >= 1) { this.atk = null; this.swingT = -1; }
  }

  // knocked off balance (e.g. your blow was parried)
  stagger(sec) {
    if (buffSum(this, 'steady')) return;
    this.staggerT = Math.max(this.staggerT, sec);
    this.atk = null;
    this.swingT = -1;
    this.blocking = false;
    if (this.isLocal) this.shake = Math.max(this.shake, 0.35);
    else if (this.game.mode === 'host') this.game.deliver(this, { k: 'stagger', t: sec });
  }

  // feedback when your blow lands
  onHitLanded(heavy) {
    this.shake = Math.max(this.shake, heavy ? 0.22 : 0.1);
    if (this.game.mode === 'single') this.game.hitStop = heavy ? 0.08 : 0.04;
  }

  // ---------- shouts and class powers ----------
  shout() {
    const g = this.game;
    const s = this.C.shout;
    const left = this.shoutLeft;
    if (left > 0) { g.audio.play('deny'); this.notify(`${s.name} is ready in ${Math.ceil(left)}s`); return; }
    const aim = traceAim(g, this.camera.position, this.lookDir(), this.team, 90).point;
    if (this.netClient) {
      g.net.toHost({ a: 'shout', p: [aim.x, aim.y, aim.z].map(r2) });
      this.shoutReady = g.time + s.cd;
      return;
    }
    useShout(g, this, aim);
  }

  castHeal() {
    const g = this.game;
    const h = this.C.heal;
    if (this.mana < h.mana) { g.audio.play('deny'); this.healReady = g.time + 0.4; return; }
    this.mana -= h.mana;
    this.lastCast = g.time;
    this.healReady = g.time + h.cd;
    this.castFlash = 1;
    if (this.netClient) { g.net.toHost({ a: 'heal' }); return; }
    healPulse(g, this);
  }

  // where spells and bolts leave from: just in front of the camera
  muzzle(dir, side = -0.18, drop = 0.15) {
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const from = this.camera.position.clone().addScaledVector(dir, 0.8).addScaledVector(right, side);
    from.y -= drop;
    // aim from the hand at the point under the crosshair so the shot lands where you look
    const aimPt = this.camera.position.clone().addScaledVector(dir, 40);
    return { from, d: aimPt.sub(from).normalize() };
  }

  castHex() {
    const g = this.game;
    const s = SPELLS.hex;
    if (this.mana < s.cost) { g.audio.play('deny'); this.spellCd = 0.4; return; }
    this.mana -= s.cost;
    this.lastCast = g.time;
    this.spellCd = this.C.hex.time;
    this.castFlash = 1;
    this.attackDir = 'thrust';
    this.swingT = 0.25;
    const { from, d } = this.muzzle(this.lookDir());
    g.audio.play('hex');
    if (this.netClient) {
      g.net.toHost({ a: 'hex', f: [from.x, from.y, from.z].map(r2), d: [d.x, d.y, d.z].map((x) => Math.round(x * 1e4) / 1e4) });
      return;
    }
    this.fireHex(from, d);
  }

  fireHex(from, d) {
    this.game.projectiles.fireSpell('hex', from, d.clone().multiplyScalar(SPELLS.hex.speed), this.team, this.C.hex.dmg * this.dmgMult, this);
  }

  // Fireball: hold to charge, release to cast. Ice and lightning cast on click.
  magicInput(dt, m) {
    const s = SPELLS[this.spell];
    if (!s) return;
    if (this.spell === 'fireball') {
      if (m.left) this.castT += dt;
      if (m.leftReleased && this.castT > 0) {
        if (this.castT >= 0.15) this.castSpell(Math.min(1, (this.castT - 0.15) / s.charge));
        this.castT = 0;
      }
      if (!m.left && !m.leftReleased) this.castT = 0;
    } else if (m.leftPressed) this.castSpell(0);
  }

  castSpell(charge) {
    const g = this.game;
    const s = SPELLS[this.spell];
    if (this.mana < s.cost || this.spellCd > 0) { g.audio.play('deny'); return; }
    this.mana -= s.cost;
    this.lastCast = g.time;
    this.spellCd = s.cd || 0.35;
    this.castFlash = 1;
    const { from, d } = this.muzzle(this.lookDir());
    this.attackDir = 'thrust';
    this.swingT = 0.25;
    if (this.netClient) {
      g.net.toHost({ a: 'cast', s: this.spell, f: [from.x, from.y, from.z].map(r2), d: [d.x, d.y, d.z].map((x) => Math.round(x * 1e4) / 1e4), ch: r2(charge) });
      return;
    }
    g.magic.cast(this, this.spell, from, d, charge, this.spellMult);
  }

  selectSpell(id) {
    if (!id || !this.spells.includes(id)) return;
    this.weapon = 'magic';
    if (this.spell === id) return;
    this.spell = id;
    this.castT = 0;
    this.notify(`Spell: ${SPELLS[id].name}`);
  }

  setWeapon(w) {
    this.castT = 0;
    if (this.weapon === w) return;
    this.weapon = w;
    this.swingT = -1;
    this.atk = null;
    this.drawT = 0;
  }

  drinkPotion() {
    if (this.netClient) { this.game.net.toHost({ a: 'potion' }); return; }
    if (this.potions <= 0 || this.hp >= this.maxHp) { this.sound('deny'); return; }
    this.potions--;
    this.hp = Math.min(this.maxHp, this.hp + 130);
    this.notify('You drink a healing draught (+130 HP)');
    this.sound('buy');
  }

  lookDir(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
  }

  meleeStrike(dir = this.attackDir) {
    const g = this.game;
    if (this.netClient) { g.net.toHost({ a: 'strike', ...this.poseMsg(), d: DIR_IDX[dir] }); return; }
    const M = this.C.melee;
    if (!M) return;
    this.attackDir = dir;
    const reach = M.reach + (this.mounted ? 0.6 : 0) + 0.4;
    const charge = this.mounted ? 1 + Math.max(0, Math.abs(this.rideSpeed) - 3) / 8 : 1;
    const dmg = M.dmg * this.dmgMult * charge * (dir === 'over' ? 1.15 : 1) * (0.9 + Math.random() * 0.2);
    const info = { melee: true, attackDir: dir, charge: M.heavy ? 1 : 0, dir: new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)) };
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const hits = [];
    g.grid.query(this.pos.x, this.pos.z, reach + 1, (u) => {
      if (!u.alive || allied(u.team, this.team) || u === this) return;
      const dx = u.pos.x - this.pos.x, dz = u.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d - u.radius > reach) return;
      if (Math.abs(u.pos.y - this.pos.y) > (this.mounted ? 2.8 : 2.2)) return;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < M.cone) return;
      hits.push({ u, d });
    });
    hits.sort((a, b) => a.d - b.d);
    let hitSomething = false;
    for (const h of hits.slice(0, M.targets)) {
      g.damage(h.u, h === hits[0] ? dmg : dmg * 0.7, this, info);
      hitSomething = true;
    }
    if (!hitSomething) {
      // structures and siege engines in front of us
      const p = new THREE.Vector3(this.pos.x + fx * 1.6, this.pos.y + 1.2, this.pos.z + fz * 1.6);
      const s = g.siegeAt(p, this.team, 1.5);
      if (s) { g.damage(s, dmg, this, { melee: true }); hitSomething = true; }
      else {
        for (const c of g.castles) {
          if (allied(c.team, this.team) || c.fallen) continue;
          for (const st of [c.gate, c.keep]) {
            if (!st.alive) continue;
            const d = Math.hypot(st.pos.x - p.x, st.pos.z - p.z) - st.radius;
            if (d < 1.4) { g.damage(st, dmg * 0.8, this, { melee: true }); hitSomething = true; break; }
          }
        }
      }
    }
    if (!hitSomething) {
      const c = g.physics.pointHit(this.pos.x + fx * 1.4, this.pos.y + 1.2, this.pos.z + fz * 1.4);
      if (c) { g.fx.sparks(new THREE.Vector3(this.pos.x + fx * 1.2, this.pos.y + 1.3, this.pos.z + fz * 1.2), 6); g.audio.play('clang'); }
    }
  }

  shoot() {
    const draw = Math.min(1, this.drawT / this.C.ranged.draw);
    const dir = this.lookDir();
    const from = this.camera.position.clone().addScaledVector(dir, 0.6);
    from.y -= 0.08;
    const wobble = (1 - draw) * 0.04 + (this.zoomed ? 0 : 0.006);
    dir.x += (Math.random() - 0.5) * wobble; dir.y += (Math.random() - 0.5) * wobble; dir.z += (Math.random() - 0.5) * wobble;
    dir.normalize();
    this.game.audio.play('bow');
    if (this.netClient) {
      this.game.net.toHost({ a: 'shoot', f: [from.x, from.y, from.z].map(r2), d: [dir.x, dir.y, dir.z].map((x) => Math.round(x * 1e4) / 1e4), draw: r2(draw) });
      this.arrows--;
      return;
    }
    this.fireFrom(from, dir, draw);
  }

  // Crossbow: click to loose a bolt when loaded; it then reloads on its own.
  fireCrossbow() {
    const g = this.game;
    if (this.arrows <= 0) { g.audio.play('deny'); this.notify('Out of bolts. Buy more in the shop (B → Items).'); return; }
    if (this.reloadT > 0) return;
    const dir = this.lookDir();
    const from = this.camera.position.clone().addScaledVector(dir, 0.6);
    from.y -= 0.06;
    const wobble = this.zoomed ? 0 : 0.004;
    dir.x += (Math.random() - 0.5) * wobble; dir.y += (Math.random() - 0.5) * wobble; dir.z += (Math.random() - 0.5) * wobble;
    dir.normalize();
    this.reloadT = this.C.ranged.reload;
    this.castFlash = 1;
    this.shake = Math.max(this.shake, 0.08);
    g.audio.play('crossbow');
    if (this.netClient) {
      g.net.toHost({ a: 'shoot', f: [from.x, from.y, from.z].map(r2), d: [dir.x, dir.y, dir.z].map((x) => Math.round(x * 1e4) / 1e4), draw: 1 });
      this.arrows--;
      return;
    }
    this.fireFrom(from, dir, 1);
  }

  // spawn the arrow or bolt (host / single player)
  fireFrom(from, dir, draw) {
    const R = this.C.ranged;
    if (this.arrows <= 0 || !R) return;
    const bolt = R.kind === 'crossbow';
    const speed = bolt ? 78 : 30 + 32 * draw;
    this.game.projectiles.fireArrow(from, dir.clone().multiplyScalar(speed), this.team, R.dmg * this.dmgMult * (bolt ? 1 : 0.4 + 0.6 * draw), this);
    this.arrows--;
  }

  // galloping into enemies knocks them down
  trample(dt) {
    const g = this.game;
    const sp = Math.abs(this.rideSpeed);
    for (const [u, t] of this.trampled) { if (t - dt <= 0) this.trampled.delete(u); else this.trampled.set(u, t - dt); }
    if (sp < 6) return;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    g.grid.query(this.pos.x + fx, this.pos.z + fz, 2, (u) => {
      if (!u.alive || allied(u.team, this.team) || u.isPlayer || u.mounted || this.trampled.has(u)) return;
      const dx = u.pos.x - this.pos.x, dz = u.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 1.6 || (dx * fx + dz * fz) / (d || 1) < 0.3) return;
      this.trampled.set(u, 0.8);
      g.damage(u, 6 + sp * 1.6, this, { melee: true });
      u.vel.x += fx * 6; u.vel.z += fz * 6;
      this.rideSpeed *= 0.85;
    });
  }

  takeDamage(amount, attacker, info = {}) {
    if (!this.alive) return;
    if (info.melee && amount > this.maxHp * 0.15) this.stagger(0.25);
    if (this.mounted) {
      // the horse takes half the blows
      this.horseHp -= amount * 0.5;
      amount *= 0.5;
      if (this.horseHp <= 0) this.loseHorse();
    }
    this.hp -= amount;
    this.lastHurt = this.game.time;
    if (this.isLocal) {
      this.hurtFlash = Math.min(1, this.hurtFlash + 0.5 + amount / 60);
      this.game.audio.play('hurt');
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.deaths++;
      this.buffs = null;
      if (this.viewModel) this.viewModel.visible = false;
      if (this.mounted) { this.mounted = false; this.horsePos.copy(this.pos); this.horseYaw = this.heading; this.rideSpeed = 0; this.radius = 0.4; }
      this.game.onPlayerKilled(attacker, this);
    }
  }
}

const r2 = (x) => Math.round(x * 100) / 100;
const INTERP_SAMPLE = { x: 0, y: 0, z: 0, yaw: 0, extra: 0 };

// first-person weapon key poses per slash direction (offsets from the resting pose)
const VM_ZERO = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
const VM_WIND = {
  right: { x: 0.18, y: 0.12, z: 0.05, rx: 0.2, ry: 0, rz: -1.3 },
  left: { x: -0.42, y: 0.12, z: 0, rx: 0.2, ry: 0.3, rz: 1.2 },
  over: { x: -0.05, y: 0.3, z: 0.1, rx: 0.9, ry: 0, rz: 0.25 },
};
const VM_END = {
  right: { x: -0.6, y: -0.12, z: -0.1, rx: -0.4, ry: 0, rz: 1.3 },
  left: { x: 0.3, y: -0.1, z: -0.1, rx: -0.4, ry: -0.3, rz: -1.2 },
  over: { x: -0.1, y: -0.35, z: -0.15, rx: -1.4, ry: 0, rz: 0.2 },
};
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeInOut = (k) => k * k * (3 - 2 * k);
function applyVm(obj, a, b, k) {
  obj.position.x += a.x + (b.x - a.x) * k;
  obj.position.y += a.y + (b.y - a.y) * k;
  obj.position.z += a.z + (b.z - a.z) * k;
  obj.rotation.x += a.rx + (b.rx - a.rx) * k;
  obj.rotation.y += a.ry + (b.ry - a.ry) * k;
  obj.rotation.z += a.rz + (b.rz - a.rz) * k;
}

export { DIRS };

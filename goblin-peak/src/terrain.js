// The mountain. A trail spirals up it; everything else (cliffs, benches, river gorge, lake) is
// worked out from the trail's height and width, so a fall always lands you on the loop below.
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, vnoise, angDiff } from './util.js';

export class Spiral {
  constructor(o) {
    this.R0 = o.R0 || 170; this.P = o.P || 46; this.k = this.P / TAU; this.D = 0.002;
    this.Y = []; this.G = []; this.W = []; this.PHI = 0; this.Ytop = 0;
    this.river = o.river || null; this.openFrom = 1e9;      // { th, loops, rw }
    this.rim = this.R0 + 85; this.S = this.R0 + 118; if (o.realm) { this.S = this.R0 + 150; this.noRim = true; this.clipR = this.R0 + 86; }
    if (this.river) { this.river.rw = this.river.rw || 4.5; this.river.rSrc = this.R(this.river.th + TAU * (this.river.loops - 1)) - 9; this.river.lakeR = this.R0 + 48; }
    this.info = { kind: 0, phi: 0, lat: 0 };
  }
  R(p) { return this.R0 - this.k * p; }
  _s(a, p) { const f = p / this.D, n = a.length - 1; if (f <= 0) return a[0]; if (f >= n) return a[n]; const i = f | 0; return a[i] + (a[i + 1] - a[i]) * (f - i); }
  trailY(p) { return p <= 0 ? 0 : p >= this.PHI ? this.Ytop : this._s(this.Y, p); }
  groundY(p) { return p <= 0 ? 0 : p >= this.PHI ? this.Ytop : this._s(this.G, p); }
  width(p) {
    if (p < 0) return this.W[0] + Math.min(1, -p / 0.35) * 20;
    if (p > this.PHI) return this.W[this.W.length - 1] + Math.min(1, (p - this.PHI) / 0.35) * 8;
    return this._s(this.W, p);
  }
  // Lay one section of trail: arc length len, climbing `rise`. yFn/pitFn/wFn take arc metres from the section start.
  lay(len, rise, yFn, pitFn, wFn) {
    const p0 = this.PHI, p1 = p0 + len / this.R(p0), y0 = this.Ytop;
    for (let i = this.Y.length; i * this.D < p1; i++) {
      const u = clamp((i * this.D - p0) / (p1 - p0), 0, 1), a = u * len;
      const y = y0 + (yFn ? yFn(a) : rise * u);
      this.Y.push(y); this.G.push(y - (pitFn ? pitFn(a) : 0)); this.W.push(wFn ? wFn(a) : 5);
    }
    this.PHI = p1; this.Ytop = y0 + rise;
    return { p0, p1, y0, y1: this.Ytop, len };
  }
  frame(phi, lat = 0, up = 0) {
    const c = Math.cos(phi), s = Math.sin(phi), r = this.R(phi) + lat;
    return { x: r * c, y: this.trailY(phi) + up, z: r * s, th: phi, nx: c, nz: s, tx: -s, tz: c, yaw: -phi };
  }
  // World point -> nearest loop of the trail.
  toRoute(x, z, out) {
    const r = Math.hypot(x, z); let th = Math.atan2(z, x); if (th < 0) th += TAU;
    const loop = Math.round(((this.R0 - r) / this.k - th) / TAU);
    out.phi = th + TAU * loop; out.lat = r - this.R(out.phi); out.on = out.phi >= 0 && out.phi <= this.PHI;
    return out;
  }
  h(x, z) {
    const r = Math.hypot(x, z); let th = Math.atan2(z, x); if (th < 0) th += TAU;
    const nf = ((this.R0 - r) / this.k - th) / TAU, i = Math.ceil(nf - 1e-9);
    const pI = th + TAU * i, pO = pI - TAU, d = r - this.R(pI), P = this.P, inf = this.info;
    const Yi = this.groundY(pI), Yo = this.groundY(pO);
    let Wi = Math.min(this.width(pI), 30), Wo = Math.min(this.width(pO), 30);
    if (Wi + Wo > P - 6) { if (Wi > Wo) Wi = P - 6 - Wo; else Wo = P - 6 - Wi; }
    let y, ridge = 0;
    if (d <= Wi) { y = Yi; inf.kind = (pI >= 0 && pI <= this.PHI && d < Wi - 0.8) ? 1 : 0; inf.phi = pI; inf.lat = d; }
    else if (d >= P - Wo) { y = Yo; inf.kind = (pO >= 0 && pO <= this.PHI && P - d < Wo - 0.8) ? 1 : 0; inf.phi = pO; inf.lat = d - P; }
    else {
      const dY = Yi - Yo, avail = P - Wi - Wo, cw = clamp(Math.abs(dY) / 1.6, 1.5, avail), t = (d - Wi) / cw;
      const nz = vnoise(x * 0.13, z * 0.13);
      if (t >= 1) {
        const f = smooth(Math.min(1, (P - Wo - d) / 4)) * smooth(Math.min(1, (d - Wi - cw) / 3));
        y = Yo + (nz - 0.35) * 1.6 * f; inf.kind = 0;
      } else { y = lerp(Yi, Yo, smooth(t)) + Math.sin(Math.PI * t) * (nz - 0.5) * Math.min(4, Math.abs(dY) * 0.15); inf.kind = 2; }
      inf.phi = pO; inf.lat = d - P;
      // where two levels of the trail are close in height, a rock ridge stands between them so neither can be reached from the other
      const tI = this.trailY(pI), tO = this.trailY(pO); if (Math.abs(tI - tO) < 27 && pI >= 0 && !(pO >= this.openFrom)) { const u = (d - Wi) / avail, bump = smooth(Math.min(u, 1 - u) / 0.22), want = Math.max(tI, tO) + 16; if (want > y) { ridge = (want - y) * bump * (pO < 0 ? smooth((pI - 0.16) / 0.1) : 1); y += ridge; if (bump > 0.15) inf.kind = 2; } }
    }
    if (!this.noRim && r > this.rim) { const q = (r - this.rim) / 30; y += q * q * 22; inf.kind = 2; }
    const rv = this.river;
    if (rv) {
      if (r > rv.rSrc) {
        const aa = Math.abs(angDiff(th, rv.th) * r);
        if (ridge && aa < rv.rw + 8) y -= ridge * smooth((rv.rw + 8 - aa) / 3);
        if (aa < rv.rw + 5) { const pr = smooth((rv.rw + 5 - aa) / 5) * smooth((r - rv.rSrc) / 5); y -= 2.4 * pr; if (pr > 0.5) inf.kind = 3; }
      }
      const lx = x - Math.cos(rv.th) * rv.lakeR, lz = z - Math.sin(rv.th) * rv.lakeR, ld = Math.hypot(lx, lz);
      if (ld < 30) { y -= 3.6 * smooth(1 - ld / 30); if (ld < 24) inf.kind = 3; }
    }
    return y;
  }
  bake() {
    const st = this.step = 1.5, n = this.n = Math.ceil(2 * this.S / st), g = this.grid = new Float32Array((n + 1) * (n + 1)), kd = this.kinds = new Uint8Array((n + 1) * (n + 1));
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { g[j * (n + 1) + i] = this.h(-this.S + i * st, -this.S + j * st); kd[j * (n + 1) + i] = this.info.kind; }
  }
  hAt(x, z) {
    const n = this.n, fx = clamp((x + this.S) / this.step, 0, n - 0.001), fz = clamp((z + this.S) / this.step, 0, n - 0.001);
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, g = this.grid, o = j * (n + 1) + i;
    return lerp(lerp(g[o], g[o + 1], u), lerp(g[o + n + 1], g[o + n + 2], u), v);
  }
  normalAt(x, z, out) {
    const e = 0.7, dx = this.hAt(x + e, z) - this.hAt(x - e, z), dz = this.hAt(x, z + e) - this.hAt(x, z - e);
    const l = Math.hypot(dx, 2 * e, dz); out.x = -dx / l; out.y = 2 * e / l; out.z = -dz / l; return out;
  }
  // Water surface height at a point, or -1e9 when dry.
  waterY(x, z) {
    const rv = this.river; if (!rv) return -1e9;
    const lx = x - Math.cos(rv.th) * rv.lakeR, lz = z - Math.sin(rv.th) * rv.lakeR;
    let w = -1e9; if (lx * lx + lz * lz < 29 * 29) w = -1.4;
    const r = Math.hypot(x, z);
    if (r > rv.rSrc + 3 && r < rv.lakeR) {
      const a = angDiff(Math.atan2(z, x), rv.th) * r;
      if (Math.abs(a) < rv.rw + 0.6) w = Math.max(w, this.hAt(Math.cos(rv.th) * r, Math.sin(rv.th) * r) + 1.5);
    }
    return w;
  }
  // The river drags you straight down the mountain; faster where it falls over a cliff.
  current(x, z, out) {
    const rv = this.river, r = Math.hypot(x, z); out.x = 0; out.z = 0;
    if (!rv || r >= rv.lakeR - 12) return out;
    const c = Math.cos(rv.th), s = Math.sin(rv.th), drop = this.hAt(c * r, s * r) - this.hAt(c * (r + 2), s * (r + 2));
    const sp = 6.4 + clamp(drop * 4, 0, 11); out.x = c * sp; out.z = s * sp; return out;
  }
  mesh(theme) {
    const n = this.n, st = this.step, g = this.grid, cnt = (n + 1) * (n + 1);
    const pos = new Float32Array(cnt * 3), col = new Float32Array(cnt * 3), idx = new Uint32Array(n * n * 6), c = new THREE.Color(), nrm = { x: 0, y: 1, z: 0 };
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const o = j * (n + 1) + i, x = -this.S + i * st, z = -this.S + j * st, y = g[o];
      pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z;
      this.normalAt(x, z, nrm); const kind = this.kinds[o], nz = vnoise(x * 0.35, z * 0.35), nz2 = vnoise(x * 0.05 + 9, z * 0.05);
      if (kind === 3) c.setRGB(...theme.bed);
      else if (nrm.y < 0.8) { c.setRGB(...theme.rock); c.multiplyScalar(0.8 + nz * 0.35 + (Math.floor(y / 3) % 2) * 0.06); }
      else if (kind === 1) { c.setRGB(...theme.trail); c.multiplyScalar(0.9 + nz * 0.18); }
      else { c.setRGB(...theme.ground); c.lerp(new THREE.Color(...theme.ground2), nz2); c.multiplyScalar(0.86 + nz * 0.24); }
      col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b;
    }
    let q = 0; const cr = this.clipR || 1e9;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { if (Math.hypot(-this.S + (i + 0.5) * st, -this.S + (j + 0.5) * st) > cr) continue; const a = j * (n + 1) + i, b = a + 1, d = a + n + 1, e = d + 1; idx[q++] = a; idx[q++] = d; idx[q++] = b; idx[q++] = b; idx[q++] = d; idx[q++] = e; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(new THREE.BufferAttribute(idx.subarray(0, q), 1)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); m.receiveShadow = true; return m;
  }
  waterMeshes(mat) {
    const rv = this.river, out = []; if (!rv) return out;
    const c = Math.cos(rv.th), s = Math.sin(rv.th), pts = [], uv = [], idx = []; let k = 0, v = 0;
    for (let r = rv.rSrc + 3; r <= rv.lakeR - 14; r += 1.5, k++) {
      const y = Math.max(this.hAt(c * r, s * r) + 1.5, -1.38), w = rv.rw + 0.9; v += 0.12;
      pts.push(c * r + s * w, y, s * r - c * w, c * r - s * w, y, s * r + c * w); uv.push(0, v, 1, v);
      if (k) { const a = (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    out.push(new THREE.Mesh(geo, mat));
    const lake = new THREE.Mesh(new THREE.CircleGeometry(29, 40), mat); lake.rotation.x = -Math.PI / 2; lake.position.set(c * rv.lakeR, -1.4, s * rv.lakeR); out.push(lake);
    return out;
  }
}

// The village green at the foot of the mountain: gentle ground ringed by hills.
export class Meadow {
  constructor(realm, holes) { this.realm = realm; this.holes = holes || []; this.S = realm ? 420 : 130; this.step = realm ? 2.5 : 2; this.spiral = null; this.bake(); }
  // 0 near a mountain's foot (so the two maps meet dead level), 1 out in open country
  open(x, z) { let f = 1; for (const h of this.holes) f = Math.min(f, smooth((Math.hypot(x - h.x, z - h.z) - h.r - 142) / 45)); return f; }
  h(x, z) {
    const r = Math.hypot(x, z); let y = (vnoise(x * 0.04, z * 0.04) - 0.5) * 1.6 * smooth((r - 30) / 30) * (this.realm ? smooth((96 - r) / 22) : 1);
    if (this.realm) { const f = this.open(x, z) * smooth((r - 85) / 50); y += f * ((vnoise(x * 0.011 + 5, z * 0.011) - 0.42) * 15 + (vnoise(x * 0.045, z * 0.045 + 9) - 0.5) * 2.2); const e = r - (this.S - 46); if (e > 0) y += e * e * 0.03; }
    if (!this.realm && r > 82) { const q = (r - 82) / 30; y += q * q * 9 * (0.6 + vnoise(x * 0.03, z * 0.03)); }
    const px = x + 34, pz = z - 30, pd = Math.hypot(px, pz); if (pd < 16) y -= 2.6 * smooth(1 - pd / 16);
    return y;
  }
  bake() { const st = this.step, n = this.n = Math.ceil(2 * this.S / st), g = this.grid = new Float32Array((n + 1) * (n + 1)); for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) g[j * (n + 1) + i] = this.h(-this.S + i * st, -this.S + j * st); }
  waterY(x, z) { return Math.hypot(x + 34, z - 30) < 15 ? -1.1 : -1e9; }
  current(x, z, out) { out.x = 0; out.z = 0; return out; }
  mesh(theme) {
    const n = this.n, st = this.step, cnt = (n + 1) * (n + 1), pos = new Float32Array(cnt * 3), col = new Float32Array(cnt * 3), idx = new Uint32Array(n * n * 6), c = new THREE.Color();
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const o = j * (n + 1) + i, x = -this.S + i * st, z = -this.S + j * st, y = this.grid[o], r = Math.hypot(x, z), nz = vnoise(x * 0.3, z * 0.3);
      pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z;
      const road = Math.abs(x) < 2.6 && z > -62 && z < 8 || Math.abs(z + 30) < 2.4 && Math.abs(x) < 46 || r < 9;
      if (y < -1) c.setRGB(...theme.bed); else if (road) c.setRGB(...theme.trail); else { c.setRGB(...theme.ground); c.lerp(new THREE.Color(...theme.ground2), vnoise(x * 0.05, z * 0.05)); }
      c.multiplyScalar(0.86 + nz * 0.24); col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b;
    }
    let q = 0; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const cx = -this.S + (i + 0.5) * st, cz = -this.S + (j + 0.5) * st; if (this.holes.some(h => Math.hypot(cx - h.x, cz - h.z) < h.r + 84)) continue; const a = j * (n + 1) + i, b = a + 1, d = a + n + 1, e = d + 1; idx[q++] = a; idx[q++] = d; idx[q++] = b; idx[q++] = b; idx[q++] = d; idx[q++] = e; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(new THREE.BufferAttribute(idx.subarray(0, q), 1)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); m.receiveShadow = true; return m;
  }
  waterMeshes(mat) { const m = new THREE.Mesh(new THREE.CircleGeometry(15, 32), mat); m.rotation.x = -Math.PI / 2; m.position.set(-34, -1.1, 30); return [m]; }
}
Meadow.prototype.hAt = Spiral.prototype.hAt;
Meadow.prototype.normalAt = Spiral.prototype.normalAt;

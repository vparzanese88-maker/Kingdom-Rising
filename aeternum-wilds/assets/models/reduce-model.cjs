// Reduce the uploaded Meshy great axe and paint it by region; writes a compact .bin for the game.
const fs = require('fs');
const { MeshoptSimplifier } = require('meshoptimizer');
const [src, out, target] = [process.argv[2], process.argv[3], +(process.argv[4] || 30000)];
const b = fs.readFileSync(src); const jl = b.readUInt32LE(12); const j = JSON.parse(b.slice(20, 20 + jl).toString());
const binOff = 20 + jl + 8;
const acc = i => { const a = j.accessors[i], v = j.bufferViews[a.bufferView]; const n = a.count * (a.type === 'VEC3' ? 3 : 1); const off = binOff + (v.byteOffset || 0) + (a.byteOffset || 0); const ab = b.buffer.slice(b.byteOffset + off, b.byteOffset + off + n * 4); return a.componentType === 5126 ? new Float32Array(ab) : new Uint32Array(ab); };
const P = acc(0), N = acc(1), I = acc(2);
(async () => {
  await MeshoptSimplifier.ready;
  // weld positions so the simplifier can collapse across duplicated vertices
  const [rem, uniq] = MeshoptSimplifier.generateVertexRemap ? [null] : [null];
  const [idx, err] = MeshoptSimplifier.simplify(I, P, 3, target, 0.01);
  console.log('tris', I.length / 3, '->', idx.length / 3, 'err', err);
  // compact
  const map = new Int32Array(P.length / 3).fill(-1); const pos = [], nor = [], ind = new Uint32Array(idx.length);
  let n = 0;
  for (let k = 0; k < idx.length; k++) { const v = idx[k]; if (map[v] < 0) { map[v] = n++; pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); nor.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); } ind[k] = map[v]; }
  // paint by region (model space: blades along x, haft along y, thin in z)
  const col = new Uint8Array(n * 4);
  const rs = []; for (let i = 0; i < n; i++) { const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; if (y > -0.7 && y < 0.55 && Math.abs(x) < 0.09) rs.push(Math.hypot(x, z)); }
  rs.sort((a, c) => a - c); const rWrap = rs[Math.floor(rs.length * 0.55)];
  const C = { steel: [196, 202, 210], edge: [228, 232, 238], iron: [70, 70, 78], rivet: [150, 128, 80], wood: [104, 70, 42], leather: [70, 44, 28], band: [170, 136, 70] };
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], ax = Math.abs(x), r = Math.hypot(x, z);
    let c;
    if (ax > 0.118 && y > 0.18) c = ax > 0.36 ? C.edge : C.steel;
    else if (y > 0.56) c = y > 0.86 ? [52, 52, 58] : C.iron;
    else if (y < -0.74) c = C.iron;
    else if (y > -0.12 && y < 0.07) c = C.band;
    else c = r > rWrap ? C.leather : C.wood;
    col.set([c[0], c[1], c[2], 255], i * 4);
  }
  // file: magic, nv, ni, then pos f32, normal i8x4, color u8x4, indices u16/u32
  const big = n > 65535;
  const head = Buffer.alloc(16); head.write('AXE1', 0); head.writeUInt32LE(n, 4); head.writeUInt32LE(ind.length, 8); head.writeUInt32LE(big ? 4 : 2, 12);
  const pb = Buffer.from(new Float32Array(pos).buffer);
  const nb = Buffer.alloc(n * 4); for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) nb.writeInt8(Math.max(-127, Math.min(127, Math.round(nor[i * 3 + k] * 127))), i * 4 + k);
  const ib = Buffer.from((big ? ind : Uint16Array.from(ind)).buffer);
  fs.writeFileSync(out, Buffer.concat([head, pb, nb, Buffer.from(col.buffer), ib]));
  console.log('verts', n, 'bytes', fs.statSync(out).size, 'rWrap', rWrap.toFixed(4));
})();

# Converts a Meshy A-pose character GLB into a compact skinned model for Aeternum Wilds:
# hero.bin (geometry + auto-computed skin weights), hero.jpg (colour), hero-mr.jpg (roughness/metal).
# Usage: python3 rig-hero.py input.glb outdir
import json, struct, io, sys
import numpy as np
from PIL import Image

src, outdir = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read()
jl = struct.unpack('<I', b[12:16])[0]
j = json.loads(b[20:20 + jl])
off = 20 + jl + 8
def acc(i):
    a = j['accessors'][i]; v = j['bufferViews'][a['bufferView']]
    n = a['count'] * {'VEC3': 3, 'VEC2': 2, 'SCALAR': 1}[a['type']]
    st = off + v.get('byteOffset', 0) + a.get('byteOffset', 0)
    dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]
    return np.frombuffer(b, dtype=dt, count=n, offset=st).copy()
p = j['meshes'][0]['primitives'][0]
P = acc(p['attributes']['POSITION']).reshape(-1, 3)
N = acc(p['attributes']['NORMAL']).reshape(-1, 3)
UV = acc(p['attributes']['TEXCOORD_0']).reshape(-1, 2)
I = acc(p['indices']).astype(np.uint32)
P = P.copy(); P[:, 1] += 0.95  # feet on the ground

# joints (root space, metres; the model faces +z, its right side is -x)
J = {
  'hips': (0, 0.92, 0), 'upper': (0, 1.15, 0), 'head': (0, 1.6, -0.02),
  'armR': (-0.2, 1.5, -0.02), 'foreR': (-0.36, 1.22, -0.03), 'handR': (-0.49, 0.98, 0.0), 'tipR': (-0.56, 0.84, 0.02),
  'armL': (0.2, 1.5, -0.02), 'foreL': (0.36, 1.22, -0.03), 'handL': (0.49, 0.98, 0.0), 'tipL': (0.56, 0.84, 0.02),
  'legR': (-0.11, 0.86, 0), 'shinR': (-0.15, 0.48, 0), 'footR': (-0.16, 0.12, 0), 'toeR': (-0.16, 0.03, 0.18),
  'legL': (0.11, 0.86, 0), 'shinL': (0.15, 0.48, 0), 'footL': (0.16, 0.12, 0), 'toeL': (0.16, 0.03, 0.18),
  'top': (0, 1.92, 0),
}
BONES = ['hips', 'upper', 'head', 'armR', 'foreR', 'handR', 'armL', 'foreL', 'handL', 'legR', 'shinR', 'footR', 'legL', 'shinL', 'footL']
# segment per bone: (start, end, radius, side)  side: -1 right, 1 left, 0 centre
SEG = {
  'hips': ('hips', 'upper', 0.2, 0), 'upper': ('upper', 'head', 0.22, 0), 'head': ('head', 'top', 0.13, 0),
  'armR': ('armR', 'foreR', 0.075, -1), 'foreR': ('foreR', 'handR', 0.065, -1), 'handR': ('handR', 'tipR', 0.05, -1),
  'armL': ('armL', 'foreL', 0.075, 1), 'foreL': ('foreL', 'handL', 0.065, 1), 'handL': ('handL', 'tipL', 0.05, 1),
  'legR': ('legR', 'shinR', 0.1, -1), 'shinR': ('shinR', 'footR', 0.085, -1), 'footR': ('footR', 'toeR', 0.07, -1),
  'legL': ('legL', 'shinL', 0.1, 1), 'shinL': ('shinL', 'footL', 0.085, 1), 'footL': ('footL', 'toeL', 0.07, 1),
}
def segdist(P, a, c):
    a = np.array(a); c = np.array(c); d = c - a
    t = np.clip(((P - a) @ d) / (d @ d), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * d), axis=1)
D = np.zeros((len(P), len(BONES)))
for k, bn in enumerate(BONES):
    s, e, r, side = SEG[bn]
    d = segdist(P, J[s], J[e]) / r
    x = P[:, 0]
    if side:  # limbs only on their own side of the body
        d[side * x < 0.02] = 1e6
    if bn.startswith('arm') or bn.startswith('fore') or bn.startswith('hand'):
        d[np.abs(x) < 0.15] = 1e6
    if bn.startswith('leg') or bn.startswith('shin') or bn.startswith('foot'):
        d[P[:, 1] > 1.0] = 1e6
    D[:, k] = d
W = 1.0 / (np.maximum(D, 0.25) ** 5)
order = np.argsort(-W, axis=1)[:, :4]
ws = np.take_along_axis(W, order, axis=1)
ws[:, 2:] *= 0.0  # two influences keep joints crisp
ws /= ws.sum(axis=1, keepdims=True)
print('verts', len(P), 'tris', len(I) // 3)
for k, bn in enumerate(BONES): print(bn, int((order[:, 0] == k).sum()))

# write: magic, json length, json, then aligned binary blocks
nv = len(P)
blocks = [
  ('position', P.astype(np.float32)), ('normal', np.clip(np.round(N * 127), -127, 127).astype(np.int8)),
  ('uv', UV.astype(np.float32)), ('skinIndex', order.astype(np.uint8)), ('skinWeight', np.round(ws * 255).astype(np.uint8)),
  ('index', I.astype(np.uint16 if nv < 65536 else np.uint32)),
]
meta = {'joints': J, 'bones': BONES, 'parents': {'hips': None, 'upper': 'hips', 'head': 'upper', 'armR': 'upper', 'foreR': 'armR', 'handR': 'foreR', 'armL': 'upper', 'foreL': 'armL', 'handL': 'foreL', 'legR': 'hips', 'shinR': 'legR', 'footR': 'shinR', 'legL': 'hips', 'shinL': 'legL', 'footL': 'shinL'}, 'blocks': []}
body = b''; o = 0
for name, arr in blocks:
    raw = arr.tobytes(); pad = (-len(raw)) % 4
    meta['blocks'].append({'name': name, 'offset': o, 'bytes': len(raw), 'dtype': str(arr.dtype), 'shape': list(arr.shape)})
    body += raw + b'\0' * pad; o += len(raw) + pad
mj = json.dumps(meta).encode(); mj += b' ' * ((-len(mj)) % 4)
open(f'{outdir}/hero.bin', 'wb').write(b'HRO1' + struct.pack('<I', len(mj)) + mj + body)

# textures
for img, name, size, q in [(0, 'hero.jpg', 2048, 86), (1, 'hero-mr.jpg', 1024, 85)]:
    v = j['bufferViews'][j['images'][img]['bufferView']]
    data = b[off + v.get('byteOffset', 0): off + v.get('byteOffset', 0) + v['byteLength']]
    Image.open(io.BytesIO(data)).convert('RGB').resize((size, size), Image.LANCZOS).save(f'{outdir}/{name}', quality=q)

# Shrinks every texture inside a .glb (re-encoded as JPEG at the given size); geometry and animations untouched.
# Usage: python3 shrink-glb.py in.glb out.glb [size=1024]
import json, struct, io, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
size = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
b = open(src, 'rb').read()
jl = struct.unpack('<I', b[12:16])[0]
j = json.loads(b[20:20 + jl])
bin_start = 20 + jl
bl = struct.unpack('<I', b[bin_start:bin_start + 4])[0]
binc = b[bin_start + 8: bin_start + 8 + bl]
views = j['bufferViews']
img_views = {}
for img in j.get('images', []):
    v = views[img['bufferView']]
    data = binc[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
    im = Image.open(io.BytesIO(data)).convert('RGB')
    k = min(1, size / max(im.size))
    im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
    out = io.BytesIO(); im.save(out, 'JPEG', quality=87)
    img_views[img['bufferView']] = out.getvalue(); img['mimeType'] = 'image/jpeg'
parts, off = [], 0
for i, v in enumerate(views):
    data = img_views.get(i, binc[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']])
    pad = (-off) % 4
    if pad: parts.append(b'\0' * pad); off += pad
    v['byteOffset'] = off; v['byteLength'] = len(data); parts.append(data); off += len(data)
pad = (-off) % 4
if pad: parts.append(b'\0' * pad); off += pad
j['buffers'][0]['byteLength'] = off
jb = json.dumps(j).encode(); jb += b' ' * ((-len(jb)) % 4)
body = b''.join(parts)
total = 12 + 8 + len(jb) + 8 + len(body)
open(dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(jb), 0x4E4F534A) + jb + struct.pack('<II', len(body), 0x004E4942) + body)
print(dst, total)

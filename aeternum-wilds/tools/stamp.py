# Stamp every game module with a fresh version so browsers load the new code after each update
# (GitHub Pages lets browsers cache files for 10 minutes). Run before committing: python3 tools/stamp.py
import json, os, re, time
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
v = str(int(time.time()))
imports = {"three": "./vendor/three/build/three.module.min.js", "three/addons/": "./vendor/three/examples/jsm/"}
for d, _, files in os.walk(os.path.join(root, 'src')):
    for f in sorted(files):
        if f.endswith('.js'):
            rel = './' + os.path.relpath(os.path.join(d, f), root).replace(os.sep, '/')
            imports[rel] = rel + '?v=' + v
p = os.path.join(root, 'index.html')
s = open(p).read()
s = re.sub(r'<script type="importmap">.*?</script>', '<script type="importmap">\n' + json.dumps({"imports": imports}, indent=0) + '\n</script>', s, flags=re.S)
s = re.sub(r'<script type="module" src="\./src/main\.js[^"]*"></script>', '<script type="module" src="./src/main.js?v=' + v + '"></script>', s)
open(p, 'w').write(s)
print('stamped', v, len(imports) - 2, 'modules')

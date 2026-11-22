# Stamp every game module with a fresh version so browsers load the new code after each update
# (GitHub Pages lets browsers cache files for 10 minutes). Run before committing: python3 hive-breach/tools/stamp.py
import json, os, re, time
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
v = str(int(time.time()))
imports = {"three": "./vendor/three.module.min.js"}
for f in sorted(os.listdir(os.path.join(root, 'src'))):
    if f.endswith('.js'):
        imports['./src/' + f] = './src/' + f + '?v=' + v
p = os.path.join(root, 'index.html')
s = open(p).read()
s = re.sub(r'<script type="importmap">.*?</script>', lambda m: '<script type="importmap">\n' + json.dumps({"imports": imports}, indent=0) + '\n</script>', s, flags=re.S)
s = re.sub(r'<script type="module" src="\./src/main\.js[^"]*"></script>', '<script type="module" src="./src/main.js?v=' + v + '"></script>', s)
open(p, 'w').write(s)
print('stamped', v, len(imports) - 1, 'modules')

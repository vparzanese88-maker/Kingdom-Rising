# Stamp every script with a fresh version so browsers load the new code after each update
# instead of mixing a new page with old cached scripts (GitHub Pages lets browsers cache files
# for 10 minutes). Run before committing: python3 omaha/tools/stamp.py
import os, re, time
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
v = str(int(time.time()))
p = os.path.join(root, 'index.html')
s = open(p).read()
s, n = re.subn(r'<script src="(js/[\w-]+\.js)(\?v=\d+)?"></script>', lambda m: '<script src="' + m.group(1) + '?v=' + v + '"></script>', s)
open(p, 'w').write(s)
print('stamped', v, n, 'scripts')

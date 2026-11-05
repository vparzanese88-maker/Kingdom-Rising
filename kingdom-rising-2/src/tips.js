// Hover boxes: anything with a title (or data-tip) shows a styled box near the cursor instead of the browser's plain one.
let box = null, cur = null;
function show(el, x, y) {
  if (!box) { box = document.createElement('div'); box.id = 'htip'; document.body.appendChild(box); }
  const t = el.getAttribute('data-tip'); if (!t) return hide();
  box.innerHTML = t.split(' · ').map((s, i) => i ? `<small>${s}</small>` : `<b>${s}</b>`).join(''); box.hidden = false; cur = el; move(x, y);
}
function move(x, y) { if (!box || box.hidden) return; const r = box.getBoundingClientRect(); let nx = x + 16, ny = y + 18; if (nx + r.width > innerWidth - 8) nx = x - r.width - 12; if (ny + r.height > innerHeight - 8) ny = y - r.height - 12; box.style.left = Math.max(6, nx) + 'px'; box.style.top = Math.max(6, ny) + 'px'; }
function hide() { if (box) box.hidden = true; cur = null; }
export function initTips() {
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest && e.target.closest('[title],[data-tip]'); if (!el) { hide(); return; }
    if (el.hasAttribute('title')) { const t = el.getAttribute('title'); el.removeAttribute('title'); if (t) el.setAttribute('data-tip', t); }
    if (el !== cur) show(el, e.clientX, e.clientY);
  }, true);
  document.addEventListener('mousemove', (e) => { if (cur && !cur.isConnected) hide(); else move(e.clientX, e.clientY); }, true);
  document.addEventListener('mousedown', hide, true);
}

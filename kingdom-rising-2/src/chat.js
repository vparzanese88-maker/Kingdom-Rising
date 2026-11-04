// Chat window (bottom left): what you say, and how your skills grow. Tabs: All, Chat, Skills.
// Press Enter to type, Enter again to send (Escape to cancel).
import { G } from './state.js';

const log = []; let tab = 'all', box = null, list = null, input = null, onDone = null;
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function initChat(done) {
  onDone = done;
  if (box) return;
  box = document.createElement('div'); box.id = 'chat';
  box.innerHTML = `<div class="ctabs"><button data-t="all" class="on">All</button><button data-t="chat">Chat</button><button data-t="skill">Skills</button><small>Enter to chat</small></div><div class="clist"></div><input class="cin" maxlength="160" placeholder="Press Enter to chat">`;
  (document.getElementById('hud') || document.body).appendChild(box);
  list = box.querySelector('.clist'); input = box.querySelector('.cin');
  box.querySelectorAll('.ctabs button').forEach(b => { b.onclick = () => { tab = b.dataset.t; box.querySelectorAll('.ctabs button').forEach(x => x.classList.toggle('on', x === b)); render(true); }; });
  input.addEventListener('focus', () => { if (!G.chatting) openChat(); });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.code === 'Enter') { const t = input.value.trim(); input.value = ''; if (t) say(t); close(); }
    else if (e.code === 'Escape') { input.value = ''; close(); }
  });
}
function close() { input.placeholder = 'Press Enter to chat'; input.blur(); box.classList.remove('typing'); G.chatting = false; render(); onDone && onDone(); }
export function openChat() { if (!box) return; input.placeholder = 'Say something, Enter to send'; box.classList.add('typing'); G.chatting = true; render(true); setTimeout(() => input.focus(), 0); }
export function say(text) { add(`<b class="me">${esc((G.save && G.save.name) || 'You')}:</b> ${esc(text)}`, 'chat'); G.hooks.chatSent && G.hooks.chatSent(text); }
// kind: 'chat' or 'skill' (skill lines also show under All)
export function add(html, kind = 'chat') { log.push({ html, kind, t: performance.now() }); if (log.length > 120) log.shift(); render(true); }
export function render(wake) {
  if (!list) return;
  const rows = log.filter(l => tab === 'all' || l.kind === tab).slice(-60);
  list.innerHTML = rows.map(l => `<div class="cl ${l.kind}">${l.html}</div>`).join('');
  list.scrollTop = list.scrollHeight;
  if (wake) { box.classList.add('awake'); clearTimeout(render.t); render.t = setTimeout(() => { if (!G.chatting) box.classList.remove('awake'); }, 14000); }
}

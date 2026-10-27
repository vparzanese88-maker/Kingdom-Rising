// The class picker: nine classes, a 20 second countdown, and only one wizard per battle.
import { CLASSES, CLASS_IDS, DEFAULT_CLASS, SPELLS } from './config.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 64x64 line-art icons, drawn in currentColor
const ICONS = {
  knight: '<path d="M32 4 L36 10 L36 40 L28 40 L28 10 Z" /><path d="M18 40 H46 V45 H18 Z" /><path d="M29.5 45 H34.5 V56 H29.5 Z" /><circle cx="32" cy="59" r="3" />',
  manatarms: '<path d="M16 14 H40 C40 34 34 46 28 52 C22 46 16 34 16 14 Z" /><path d="M28 18 V44 M20 26 H36" /><path d="M52 6 L55 9 L38 34 L35 31 Z" /><path d="M33 29 L40 36" />',
  pikeman: '<path d="M10 58 L50 12" /><path d="M48 8 L58 6 L56 16 L50 16 L48 14 Z" /><path d="M44 18 L50 24" />',
  spearman: '<path d="M14 56 L50 14" /><path d="M48 9 L57 7 L55 16 Z" /><circle cx="24" cy="40" r="13" /><circle cx="24" cy="40" r="3" />',
  bowman: '<path d="M18 6 C44 18 44 46 18 58" /><path d="M18 6 V58" /><path d="M10 32 H52" /><path d="M46 27 L54 32 L46 37" /><path d="M10 28 L14 32 L10 36" />',
  crossbowman: '<path d="M8 22 C22 12 42 12 56 22" /><path d="M8 22 L32 30 L56 22" /><path d="M29 18 H35 V58 H29 Z" /><path d="M32 6 V18" /><path d="M28 10 L32 4 L36 10" />',
  priest: '<path d="M27 8 H37 V22 H51 V32 H37 V58 H27 V32 H13 V22 H27 Z" /><path d="M6 8 L12 14 M58 8 L52 14 M6 50 L12 46 M58 50 L52 46" />',
  witch: '<path d="M6 46 C20 40 44 40 58 46 C44 52 20 52 6 46 Z" /><path d="M20 44 L30 10 C34 4 44 6 46 12 C40 10 36 12 36 18 L44 43" /><path d="M23 38 C30 35 38 35 42 37" /><path d="M50 22 l2 4 l4 1 l-4 1 l-2 4 l-2 -4 l-4 -1 l4 -1 Z" />',
  wizard: '<path d="M8 50 H56" /><path d="M14 50 L30 6 L48 50" /><path d="M30 22 l2 4 l4 1 l-4 1 l-2 4 l-2 -4 l-4 -1 l4 -1 Z" /><circle cx="38" cy="38" r="2.5" /><circle cx="24" cy="40" r="1.8" /><path d="M26 50 C26 58 38 58 38 50" />',
};

const STAT_NAMES = { hp: 'Health', dmg: 'Damage', speed: 'Speed', range: 'Range' };
const TAG = { knight: 'Heavy', manatarms: 'Fast melee', pikeman: 'Reach', spearman: 'Quick reach', bowman: 'Ranged', crossbowman: 'Ranged', priest: 'Support', witch: 'Debuff', wizard: 'Area damage' };

export class ClassPicker {
  constructor() {
    this.el = $('classSelect');
    this.grid = $('csGrid');
    this.cards = new Map();
    this.selected = DEFAULT_CLASS;
    try { const c = localStorage.getItem('cw-class'); if (CLASSES[c]) this.selected = c; } catch (e) { /* storage unavailable */ }
    this.takenBy = {};     // unique class -> name of whoever holds it
    this.timer = null;
    for (const id of CLASS_IDS) {
      const c = CLASSES[id];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'cs-card';
      card.dataset.cls = id;
      const bars = Object.entries(c.stats).map(([k, v]) => `<div class="cs-stat"><span>${STAT_NAMES[k]}</span><i><b style="width:${v * 20}%"></b></i></div>`).join('');
      const spellNote = c.spells ? `<div class="cs-extra">Spells: ${c.spells.map((s) => SPELLS[s].name).join(', ')}</div>` : '';
      card.innerHTML = `
        <div class="cs-top"><svg viewBox="0 0 64 64" aria-hidden="true">${ICONS[id]}</svg>
          <div><h3>${esc(c.name)}</h3><span class="cs-tag">${esc(TAG[id])}</span>${c.unique ? '<span class="cs-tag unique">Only one</span>' : ''}</div></div>
        <p class="cs-role">${esc(c.role)}</p>
        <div class="cs-stats">${bars}</div>${spellNote}
        <div class="cs-shout" style="--shout:#${c.shout.color.toString(16).padStart(6, '0')}"><kbd>R</kbd><b>${esc(c.shout.name)}</b><span>${esc(c.shout.desc)}</span></div>
        <div class="cs-taken"></div>`;
      card.addEventListener('click', () => this.pick(id));
      card.addEventListener('dblclick', () => { this.pick(id); this.ready(); });
      this.grid.appendChild(card);
      this.cards.set(id, card);
    }
    $('csReady').addEventListener('click', () => this.ready());
    addEventListener('keydown', (e) => {
      if (this.el.classList.contains('hidden')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= CLASS_IDS.length) this.pick(CLASS_IDS[n - 1]);
      if (e.key === 'Enter') this.ready();
    });
  }

  // opts: { seconds, onPick(cls), onReady(cls), onTimeout(cls), note }
  open(opts) {
    this.opts = opts;
    this.done = false;
    this.isReady = false;
    this.takenBy = {};
    $('csWait').textContent = opts.note || '';
    $('csReady').disabled = false;
    $('csReady').textContent = 'Ready!';
    this.el.classList.remove('hidden');
    if (this.blocked(this.selected)) this.selected = DEFAULT_CLASS;
    this.refresh();
    this.end = performance.now() + opts.seconds * 1000;
    this.total = opts.seconds;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 100);
    this.tick();
    if (opts.onPick) opts.onPick(this.selected);
  }

  close() {
    clearInterval(this.timer);
    this.el.classList.add('hidden');
  }

  blocked(id) { return !!(CLASSES[id].unique && this.takenBy[id]); }

  pick(id) {
    if (this.done || this.isReady || this.blocked(id)) return;
    this.selected = id;
    try { localStorage.setItem('cw-class', id); } catch (e) { /* ignore */ }
    this.refresh();
    if (this.opts && this.opts.onPick) this.opts.onPick(id);
  }

  ready() {
    if (this.done || this.isReady) return;
    this.isReady = true;
    $('csReady').disabled = true;
    $('csReady').textContent = 'Ready ✓';
    if (this.opts.onReady) this.opts.onReady(this.selected);
  }

  // Someone else holds a one-per-battle class (the wizard): takenBy = { wizard: 'Name' }
  setTaken(takenBy) {
    this.takenBy = takenBy || {};
    if (this.blocked(this.selected)) {
      this.selected = DEFAULT_CLASS;
      if (this.opts && this.opts.onPick) this.opts.onPick(this.selected);
    }
    this.refresh();
  }

  setWaiting(text) { $('csWait').textContent = text; }

  refresh() {
    for (const [id, card] of this.cards) {
      card.classList.toggle('selected', id === this.selected);
      const taken = this.blocked(id);
      card.classList.toggle('taken', taken);
      card.querySelector('.cs-taken').textContent = taken ? `Taken by ${this.takenBy[id]}` : '';
    }
    const c = CLASSES[this.selected];
    $('csChosen').innerHTML = `<b>${esc(c.name)}</b> · ${esc(c.shout.name)} on <kbd>R</kbd>`;
  }

  tick() {
    const left = Math.max(0, (this.end - performance.now()) / 1000);
    $('csTimer').textContent = Math.ceil(left);
    $('csRing').style.setProperty('--p', left / this.total);
    $('csTimerWrap').classList.toggle('urgent', left <= 5);
    if (left <= 0 && !this.done) {
      this.done = true;
      clearInterval(this.timer);
      if (this.opts.onTimeout) this.opts.onTimeout(this.selected);
    }
  }
}

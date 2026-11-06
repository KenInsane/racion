// Белковая неделя на двоих — сайт для GitHub Pages.
// Данные (продукты, рецепты, меню по умолчанию) — из data.js (window.DATA).
// Меню, галочки, траты и имена — общие через Firebase Firestore (если настроен firebase-config.js),
// иначе — только в localStorage этого устройства.
import { firebaseConfig } from './firebase-config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const D = window.DATA || {};
const PRODUCTS = D.products || {};
const RECIPES = D.recipes || [];
const R = {}; RECIPES.forEach(r => { R[r.id] = r; });
const MINE = RECIPES.filter(r => r.source === 'mine');
const IDEAS = RECIPES.filter(r => r.source !== 'mine');
const DEFAULT_MENU = D.default_menu || [];
const DAY_NAMES = DEFAULT_MENU.map(d => d.day);
const DAY_TRIP = DEFAULT_MENU.map(d => Number(d.trip) || 1);
const TRIPS_INFO = D.trips_info || [{ name: 'Закупка 1', when: '', covers: '' }, { name: 'Закупка 2', when: '', covers: '' }];
const L = D.local || null;
const SECTIONS = ['Мясо и рыба', 'Молочное и яйца', 'Овощи и зелень', 'Фрукты и ягоды', 'Хлеб, крупы, макароны', 'Заморозка', 'Соусы, специи и прочее'];
const SLOTS = ['Завтрак', 'Обед', 'Перекус', 'Ужин', 'Сладкое'];
const KIND_SLOT = { 'завтрак': 'Завтрак', 'обед': 'Обед', 'перекус': 'Перекус', 'ужин': 'Ужин', 'сладкое': 'Сладкое' };
const SHORT = { 'понедельник': 'Пн', 'вторник': 'Вт', 'среда': 'Ср', 'четверг': 'Чт', 'пятница': 'Пт', 'суббота': 'Сб', 'воскресенье': 'Вс' };
const MONTHS = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n0 = v => (v == null || isNaN(v)) ? '—' : Math.round(Number(v));
const short = d => { const k = String(d || '').trim().toLowerCase(); return SHORT[k] || String(d || '').slice(0, 2); };
const eur = v => (v == null || isNaN(v)) ? '' : ('≈ ' + Number(v).toFixed(2).replace('.', ',') + ' €');
const money = v => (Number(v) || 0).toFixed(2).replace('.', ',') + ' €';
const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many; };
const isSweetSlot = s => /слад/i.test(s || '');
const kindClass = k => /слад/i.test(k || '') ? 'kind-sweet' : '';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const weekStart = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const niceDate = s => { const d = parseYmd(s); return WD[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
const sum = arr => arr.reduce((a, e) => a + (Number(e.amount) || 0), 0);
const dec = (v, k = 1) => String(Math.round(v * Math.pow(10, k)) / Math.pow(10, k)).replace('.', ',');
const todayIdx = () => (new Date().getDay() + 6) % 7;

// ---------- storage ----------
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage off */ } },
};
const K = { checks: 'racion.checks.v2', exp: 'racion.expenses.v1', hh: 'racion.household.v1', me: 'racion.me.v1', names: 'racion.names.v1', menu: 'racion.menu.v2' };
const KEY_RE = /^[A-Za-z0-9]{16,40}$/;
const urlK = (() => { try { const k = new URLSearchParams(location.search).get('k'); return k && KEY_RE.test(k) ? k : null; } catch (e) { return null; } })();
if (urlK) LS.set(K.hh, urlK);

const defaultMenu = () => DEFAULT_MENU.map(d => (d.meals || []).map(x => ({ slot: x.slot, r: x.r, note: x.note || '' })));
const validMenu = m => (Array.isArray(m) && m.length === DEFAULT_MENU.length && m.every(Array.isArray)) ? m : null;

const S = {
  checks: LS.get(K.checks, {}) || {},
  expenses: LS.get(K.exp, []) || [],
  names: LS.get(K.names, ['Человек 1', 'Человек 2']) || ['Человек 1', 'Человек 2'],
  me: Number(LS.get(K.me, 0)) || 0,
  menu: validMenu(LS.get(K.menu, null)) || defaultMenu(),
  hh: firebaseConfig ? LS.get(K.hh, null) : null,
  status: 'local', err: '', sdk: null, refs: null, uid: null,
  pending: false, fromCache: false, period: 'month', histAll: false,
};

// ---------- small UI helpers ----------
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2400); }
function copyText(txt, okMsg) {
  const fail = () => {
    const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); let good = false; try { good = document.execCommand('copy'); } catch (e) { /* no */ }
    ta.remove(); toast(good ? okMsg : 'Не получилось скопировать — выделите текст вручную');
  };
  try { navigator.clipboard.writeText(txt).then(() => toast(okMsg), fail); } catch (e) { fail(); }
}
function onWriteErr(err) { S.status = 'error'; S.err = (err && (err.code || err.message)) || 'write'; paintStatus(); toast('Не сохранилось: ' + S.err); }
function openDialog(d) { if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', ''); }

// ---------- menu model ----------
const slotOrder = s => { const i = SLOTS.indexOf(s); return i < 0 ? 99 : i; };
function dayMeals(i) { return (S.menu[i] || []).map((x, idx) => ({ x, idx })).sort((a, b) => slotOrder(a.x.slot) - slotOrder(b.x.slot) || a.idx - b.idx); }
function dayMacros(i) {
  let p = 0, k = 0, f = 0;
  (S.menu[i] || []).forEach(x => { const r = R[x.r]; if (r) { p += r.protein_per_person || 0; k += r.kcal_per_person || 0; f += r.fiber_per_person || 0; } });
  return { p, k, f };
}
function usedMap() {
  const u = {};
  S.menu.forEach((d, i) => d.forEach(x => { (u[x.r] = u[x.r] || []).push(short(DAY_NAMES[i]) + ' · ' + String(x.slot || '').toLowerCase()); }));
  return u;
}
function saveMenu(msg) {
  LS.set(K.menu, S.menu);
  if (S.refs) {
    const { f } = S.sdk; const doc = { v: 2 };
    S.menu.forEach((d, i) => { doc['d' + i] = d.map(x => ({ s: x.slot, r: x.r, n: x.note || '' })); });
    f.setDoc(S.refs.mRef, doc).catch(onWriteErr);
  }
  renderMenuDependent();
  if (msg) toast(msg);
}
function renderMenuDependent() {
  [renderHeader, renderWeek, renderMine, renderIdeas, renderSweets, renderShop, updateMoney].forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
}
function setMeal(day, idx, rid, slot) {
  const d = S.menu[day]; if (!d) return;
  if (idx == null || idx < 0 || !d[idx]) d.push({ slot: slot || KIND_SLOT[(R[rid] || {}).kind] || 'Перекус', r: rid, note: '' });
  else d[idx] = { slot: slot || d[idx].slot, r: rid, note: '' };
  saveMenu('Поставлено: ' + ((R[rid] || {}).name || ''));
}
function removeMeal(day, idx) {
  const d = S.menu[day]; if (!d || !d[idx]) return;
  const name = (R[d[idx].r] || {}).name || 'блюдо';
  d.splice(idx, 1); saveMenu('Убрано: ' + name);
}

// ---------- header ----------
function renderHeader() {
  $('intro').textContent = D.intro || '';
  const ps = DAY_NAMES.map((_, i) => dayMacros(i).p);
  const minP = ps.length ? Math.min(...ps) : 0;
  const shop = computeShop();
  const week = shop[0].total + shop[1].total;
  const facts = [
    ['от ' + n0(minP) + ' г', 'белка в день каждому'],
    [String(MINE.length), plural(MINE.length, 'твоё блюдо', 'твоих блюда', 'твоих блюд')],
    [String(IDEAS.length), plural(IDEAS.length, 'идея', 'идеи', 'идей') + ' из рилсов'],
  ];
  if (week > 0) facts.push(['≈ ' + Math.round(week) + ' €', 'закупки на неделю']);
  $('facts').innerHTML = facts.map(f => '<span class="fact"><b class="num">' + esc(f[0]) + '</b>' + esc(f[1]) + '</span>').join('');
}

// ---------- week ----------
function renderWeek() {
  let h = '<div class="sec-head"><h2>Меню недели</h2><p>Меню общее на двоих: любое блюдо можно заменить, убрать или добавить, а закупки и белок пересчитаются сами. Зелёная полоска — закупка 1, жёлтая — закупка 2. Жёлтая черта на шкале — 100 г белка.</p>' + syncLine() +
    '<div class="actions"><button class="btn" id="menu-reset">Вернуть меню по умолчанию</button></div></div>';
  h += '<div class="strip" role="list">' + DAY_NAMES.map((dn, i) => {
    const m = dayMacros(i);
    return '<button class="dchip trip-' + DAY_TRIP[i] + (m.p < 100 ? ' low' : '') + '" role="listitem" data-day="' + i + '" aria-label="' + esc(dn) + ', ' + n0(m.p) + ' г белка"><span class="d">' + esc(short(dn)) + '</span><span class="p num">' + n0(m.p) + ' г</span><span class="t"></span></button>';
  }).join('') + '</div>';
  h += '<div class="days">' + DAY_NAMES.map((dn, i) => {
    const m = dayMacros(i), max = 150;
    const meals = dayMeals(i).map(({ x, idx }) => {
      const r = R[x.r];
      return '<li class="meal' + (isSweetSlot(x.slot) ? ' s-sweet' : '') + (r && r.source !== 'mine' ? ' s-idea' : '') + '"><span class="slot">' + esc(x.slot) + (r && r.source !== 'mine' ? ' · идея' : '') + '</span>' +
        (r ? '<button class="dish" data-open="' + esc(x.r) + '">' + esc(r.name) + '</button><span class="mp num">' + n0(r.protein_per_person) + ' г белка · ' + n0(r.kcal_per_person) + ' ккал</span>'
          : '<span class="dish">Блюдо больше не в списке рецептов</span>') +
        (x.note ? '<small>' + esc(x.note) + '</small>' : '') +
        '<span class="mact"><button class="mini" data-swap="' + i + ':' + idx + '">Заменить</button><button class="mini" data-rm="' + i + ':' + idx + '">Убрать</button></span></li>';
    }).join('') + '<li class="meal add"><button class="addmeal" data-add="' + i + '">+ Добавить блюдо</button></li>';
    const next = S.menu[(i + 1) % S.menu.length] || [];
    const prep = [...new Set(next.map(x => (R[x.r] || {}).prep_ahead).filter(Boolean))];
    return '<article class="day" id="day-' + i + '"><div class="day-side">' +
      '<div class="day-name"><span class="dn">' + esc(short(dn)) + '</span><span class="df">' + esc(dn) + '</span></div>' +
      '<div class="badges"><span class="badge trip-' + DAY_TRIP[i] + '">Закупка ' + DAY_TRIP[i] + '</span>' + (m.p < 100 ? '<span class="badge warn">меньше 100 г белка</span>' : '') + '</div>' +
      '<div class="meter" role="img" aria-label="Белок ' + n0(m.p) + ' г при цели 100 г"><div class="fill" style="width:' + Math.min(100, m.p / max * 100).toFixed(1) + '%"></div><div class="mark" style="left:' + (100 / max * 100).toFixed(1) + '%"></div></div>' +
      '<div class="meter-txt"><b class="num">' + n0(m.p) + ' г</b> белка · <span class="num">' + n0(m.k) + ' ккал</span> · <span class="fib num">' + n0(m.f) + ' г клетчатки</span> <span>на человека</span></div>' +
      '</div><div class="day-main"><ol class="meals">' + meals + '</ol>' +
      (prep.length ? '<p class="prep"><span class="hand">на вечер</span><span>' + esc(prep.join(' ')) + '</span></p>' : '') +
      '</div></article>';
  }).join('') + '</div>';
  const v = $('v-week'); v.innerHTML = h;
  v.querySelectorAll('.dchip').forEach(b => b.addEventListener('click', () => {
    const el = $('day-' + b.getAttribute('data-day'));
    if (el) el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  }));
  const rs = $('menu-reset');
  rs.addEventListener('click', () => {
    if (!rs.classList.contains('sure')) { rs.classList.add('sure'); rs.textContent = 'Точно вернуть? Твои замены пропадут'; setTimeout(() => { if (rs.isConnected) { rs.classList.remove('sure'); rs.textContent = 'Вернуть меню по умолчанию'; } }, 4000); return; }
    S.menu = defaultMenu(); saveMenu('Меню вернулось к исходному');
  });
  paintStatus();
}
$('v-week').addEventListener('click', e => {
  const sw = e.target.closest('[data-swap]'), rm = e.target.closest('[data-rm]'), ad = e.target.closest('[data-add]');
  if (sw) { const [d, idx] = sw.getAttribute('data-swap').split(':').map(Number); const x = S.menu[d][idx]; openPicker({ mode: 'replace', day: d, idx, slot: x.slot }); }
  else if (rm) {
    if (!rm.classList.contains('sure')) { rm.classList.add('sure'); rm.textContent = 'Точно?'; setTimeout(() => { if (rm.isConnected) { rm.classList.remove('sure'); rm.textContent = 'Убрать'; } }, 3000); return; }
    const [d, idx] = rm.getAttribute('data-rm').split(':').map(Number); removeMeal(d, idx);
  } else if (ad) openPicker({ mode: 'add', day: Number(ad.getAttribute('data-add')), idx: -1, slot: 'Перекус' });
});

// ---------- recipe cards ----------
const KINDS = ['все', 'завтрак', 'обед', 'ужин', 'перекус', 'сладкое'];
function rcard(r, used) {
  const sub = r.source === 'mine' ? (r.boost ? '<span class="trend">' + esc(r.boost) + '</span>' : '') : (r.trend ? '<span class="trend">' + esc(r.trend) + '</span>' : '');
  return '<div class="rcard ' + kindClass(r.kind) + '"><button class="ropen" data-open="' + esc(r.id) + '"><span class="k">' + esc(r.kind) + '</span><h3>' + esc(r.name) + '</h3>' + sub +
    '<span class="chips"><span class="chip p num">' + n0(r.protein_per_person) + ' г белка</span><span class="chip num">' + n0(r.kcal_per_person) + ' ккал</span>' + (r.fiber_per_person ? '<span class="chip num">' + n0(r.fiber_per_person) + ' г клетч.</span>' : '') + '<span class="chip num">' + n0(r.time_min) + ' мин</span></span>' +
    (used[r.id] ? '<span class="used">В меню: ' + esc(used[r.id].join(', ')) + '</span>' : '') + '</button>' +
    '<button class="plus" data-place="' + esc(r.id) + '" aria-label="Добавить «' + esc(r.name) + '» в меню" title="Добавить в меню">+</button></div>';
}
function renderMine() {
  const used = usedMap();
  let h = '<div class="sec-head"><h2>Мои рецепты</h2><p>Твои привычные блюда — из них собрана неделя по умолчанию. Где добавлен белок (творог, скир), это помечено в рецепте, и его можно не класть. Количества — на двоих, белок и калории — на одного.</p></div>';
  h += '<div class="grid">' + MINE.map(r => rcard(r, used)).join('') + '</div>';
  $('v-mine').innerHTML = h;
}
let ideaKind = 'все';
function renderIdeas() {
  const used = usedMap();
  const list = IDEAS.filter(r => ideaKind === 'все' || String(r.kind || '').toLowerCase() === ideaKind);
  let h = '<div class="sec-head"><h2>Идеи из рилсов</h2><p>Вирусные рецепты из TikTok и Reels с высоким белком. Нажми «+», чтобы поставить блюдо в меню на нужный день: закупки пересчитаются сами.</p></div>';
  h += '<div class="filters" role="group" aria-label="Фильтр по приёму пищи">' + KINDS.map(k => {
    const c = k === 'все' ? IDEAS.length : IDEAS.filter(r => String(r.kind || '').toLowerCase() === k).length;
    return c ? '<button class="fbtn" data-k="' + k + '" aria-pressed="' + (k === ideaKind) + '">' + k.charAt(0).toUpperCase() + k.slice(1) + ' <span class="num">' + c + '</span></button>' : '';
  }).join('') + '</div>';
  h += '<div class="grid">' + list.map(r => rcard(r, used)).join('') + '</div>';
  const v = $('v-ideas'); v.innerHTML = h;
  v.querySelectorAll('.fbtn').forEach(b => b.addEventListener('click', () => { ideaKind = b.getAttribute('data-k'); renderIdeas(); }));
}

// ---------- recipe dialog ----------
const dlg = $('dlg');
function ingLine(x) {
  const p = PRODUCTS[x.product];
  return '<li><span>' + esc(x.item || (p && p.name) || '') + '</span><span class="num">' + esc(x.qty || '') + '</span></li>';
}
function openRecipe(id) {
  const r = R[id]; if (!r) return;
  const used = usedMap();
  $('dlg-body').innerHTML =
    '<div class="dlg-top"><div style="display:grid;gap:6px;min-width:0"><span class="label">' + esc(r.kind) + (r.source === 'mine' ? ' · мой рецепт' : ' · идея из рилсов') + '</span><h2 id="dlg-title">' + esc(r.name) + '</h2></div><button class="x" id="dlg-x" aria-label="Закрыть">×</button></div>' +
    (r.source !== 'mine' && r.trend ? '<p class="trend">' + esc(r.trend) + '</p>' : '') +
    '<div class="chips"><span class="chip p num">' + n0(r.protein_per_person) + ' г белка на человека</span><span class="chip num">' + n0(r.kcal_per_person) + ' ккал</span>' + (r.fiber_per_person ? '<span class="chip num">' + n0(r.fiber_per_person) + ' г клетчатки</span>' : '') + '<span class="chip num">' + n0(r.time_min) + ' мин</span>' +
    (r.equipment || []).map(e => '<span class="chip">' + esc(e) + '</span>').join('') + '</div>' +
    (r.boost ? '<p class="plate"><b>Белок.</b> ' + esc(r.boost) + '</p>' : '') +
    '<div class="cols"><div style="display:grid;gap:8px;align-content:start"><h3>Продукты на двоих</h3><ul class="ing">' + (r.ingredients || []).map(ingLine).join('') + '</ul></div>' +
    '<div style="display:grid;gap:8px;align-content:start"><h3>Как готовить</h3><ol class="steps">' + (r.steps || []).map(s => '<li>' + esc(s) + '</li>').join('') + '</ol></div></div>' +
    (r.plating ? '<p class="plate"><b>Подача.</b> ' + esc(r.plating) + '</p>' : '') +
    (r.tips ? '<p class="plate"><b>Совет.</b> ' + esc(r.tips) + '</p>' : '') +
    (r.prep_ahead ? '<p class="prep"><span class="hand">заранее</span><span>' + esc(r.prep_ahead) + '</span></p>' : '') +
    '<div class="actions"><button class="btn pri" id="dlg-place">+ Добавить в меню</button>' + (used[r.id] ? '<span class="label" style="text-transform:none;letter-spacing:0;font-weight:500;align-self:center">В меню: ' + esc(used[r.id].join(', ')) + '</span>' : '') + '</div>';
  $('dlg-x').addEventListener('click', () => dlg.close());
  $('dlg-place').addEventListener('click', () => { dlg.close(); openPlace(r.id); });
  openDialog(dlg);
}
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
document.addEventListener('click', e => {
  const o = e.target.closest && e.target.closest('[data-open]');
  if (o && o.tagName === 'BUTTON') { openRecipe(o.getAttribute('data-open')); return; }
  const pl = e.target.closest && e.target.closest('[data-place]');
  if (pl && pl.tagName === 'BUTTON') openPlace(pl.getAttribute('data-place'));
});

// ---------- picker: choose a dish for a slot ----------
const pick = $('pick');
pick.addEventListener('click', e => { if (e.target === pick) pick.close(); });
let PK = null;
function openPicker(ctx) {
  const slotKind = Object.keys(KIND_SLOT).find(k => KIND_SLOT[k] === ctx.slot) || 'все';
  PK = Object.assign({ src: 'mine', kind: ctx.mode === 'add' ? 'все' : slotKind, q: '' }, ctx);
  const head = ctx.mode === 'replace' ? 'Заменить: ' + short(DAY_NAMES[ctx.day]) + ' · ' + ctx.slot.toLowerCase() : 'Добавить в ' + short(DAY_NAMES[ctx.day]);
  $('pick-body').innerHTML =
    '<div class="dlg-top"><div style="display:grid;gap:6px;min-width:0"><span class="label">' + esc(head) + '</span><h2 id="pick-title">Выбери блюдо</h2></div><button class="x" id="pick-x" aria-label="Закрыть">×</button></div>' +
    (ctx.mode === 'add' ? '<div class="field"><label for="pk-slot">Приём пищи</label><select id="pk-slot">' + SLOTS.map(s => '<option' + (s === ctx.slot ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div>' : '') +
    '<div class="seg" role="group" aria-label="Источник"><button class="fbtn" data-src="mine">Мои рецепты <span class="num">' + MINE.length + '</span></button><button class="fbtn" data-src="ideas">Идеи из рилсов <span class="num">' + IDEAS.length + '</span></button></div>' +
    '<div class="filters" id="pk-kinds" role="group" aria-label="Приём пищи"></div>' +
    '<div class="field"><label for="pk-q">Поиск</label><input id="pk-q" autocomplete="off" placeholder="Например, курица или творог"></div>' +
    '<div class="plist" id="pk-list"></div>';
  $('pick-x').addEventListener('click', () => pick.close());
  $('pick-body').querySelectorAll('[data-src]').forEach(b => b.addEventListener('click', () => { PK.src = b.getAttribute('data-src'); paintPicker(); }));
  $('pk-q').addEventListener('input', () => { PK.q = $('pk-q').value.trim().toLowerCase(); paintPicker(); });
  const ps = $('pk-slot'); if (ps) ps.addEventListener('change', () => { PK.slot = ps.value; });
  paintPicker(); openDialog(pick);
}
function paintPicker() {
  const pool = PK.src === 'mine' ? MINE : IDEAS;
  $('pick-body').querySelectorAll('[data-src]').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-src') === PK.src)));
  $('pk-kinds').innerHTML = KINDS.map(k => {
    const c = k === 'все' ? pool.length : pool.filter(r => r.kind === k).length;
    return c ? '<button class="fbtn" data-pk="' + k + '" aria-pressed="' + (k === PK.kind) + '">' + k.charAt(0).toUpperCase() + k.slice(1) + ' <span class="num">' + c + '</span></button>' : '';
  }).join('');
  $('pk-kinds').querySelectorAll('[data-pk]').forEach(b => b.addEventListener('click', () => { PK.kind = b.getAttribute('data-pk'); paintPicker(); }));
  let list = pool.filter(r => (PK.kind === 'все' || r.kind === PK.kind) && (!PK.q || r.name.toLowerCase().includes(PK.q)));
  if (!list.length && PK.kind !== 'все') list = pool.filter(r => !PK.q || r.name.toLowerCase().includes(PK.q));
  $('pk-list').innerHTML = list.length ? list.map(r => '<button class="prow" data-pick="' + esc(r.id) + '"><b>' + esc(r.name) + '</b><span class="num">' + esc(r.kind) + ' · ' + n0(r.protein_per_person) + ' г белка · ' + n0(r.kcal_per_person) + ' ккал · ' + n0(r.time_min) + ' мин</span></button>').join('')
    : '<p class="empty">Ничего не нашлось. Попробуй другое слово или «Все».</p>';
  $('pk-list').querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
    const rid = b.getAttribute('data-pick');
    setMeal(PK.day, PK.mode === 'replace' ? PK.idx : -1, rid, PK.mode === 'replace' ? PK.slot : (PK.slot || KIND_SLOT[(R[rid] || {}).kind]));
    pick.close();
  }));
}

// ---------- place: put a recipe into the menu ----------
function openPlace(rid) {
  const r = R[rid]; if (!r) return;
  const st = { day: todayIdx(), slot: KIND_SLOT[r.kind] || 'Перекус', mode: 'replace' };
  const paint = () => {
    const cur = (S.menu[st.day] || []).map((x, idx) => ({ x, idx })).filter(o => o.x.slot === st.slot);
    const curNames = cur.map(o => (R[o.x.r] || {}).name).filter(Boolean);
    $('pick-body').innerHTML =
      '<div class="dlg-top"><div style="display:grid;gap:6px;min-width:0"><span class="label">Добавить в меню</span><h2 id="pick-title">' + esc(r.name) + '</h2></div><button class="x" id="pick-x" aria-label="Закрыть">×</button></div>' +
      '<div class="field"><label>День</label><div class="daypick" role="group" aria-label="День">' + DAY_NAMES.map((dn, i) => '<button class="fbtn" data-pd="' + i + '" aria-pressed="' + (i === st.day) + '">' + esc(short(dn)) + '</button>').join('') + '</div></div>' +
      '<div class="field"><label for="pl-slot">Приём пищи</label><select id="pl-slot">' + SLOTS.map(s => '<option' + (s === st.slot ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
      (cur.length ? '<div class="radios" role="radiogroup" aria-label="Что сделать"><label><input type="radio" name="pl-mode" value="replace"' + (st.mode === 'replace' ? ' checked' : '') + '> Заменить «' + esc(curNames.join('», «')) + '»</label><label><input type="radio" name="pl-mode" value="add"' + (st.mode === 'add' ? ' checked' : '') + '> Добавить ещё одно блюдо</label></div>'
        : '<p class="s">В этот приём пищи пока ничего не стоит — блюдо добавится.</p>') +
      '<div class="actions"><button class="btn pri" id="pl-go">Поставить в ' + esc(short(DAY_NAMES[st.day])) + '</button></div>';
    $('pick-x').addEventListener('click', () => pick.close());
    $('pick-body').querySelectorAll('[data-pd]').forEach(b => b.addEventListener('click', () => { st.day = Number(b.getAttribute('data-pd')); paint(); }));
    $('pl-slot').addEventListener('change', () => { st.slot = $('pl-slot').value; paint(); });
    $('pick-body').querySelectorAll('[name="pl-mode"]').forEach(x => x.addEventListener('change', () => { st.mode = x.value; }));
    $('pl-go').addEventListener('click', () => {
      setMeal(st.day, cur.length && st.mode === 'replace' ? cur[0].idx : -1, rid, st.slot);
      pick.close();
    });
  };
  paint(); openDialog(pick);
}

// ---------- sweets ----------
function renderSweets() {
  const Sw = D.sweets || {};
  const li = a => (a || []).map(x => '<li>' + esc(x) + '</li>').join('');
  const lcol = (cls, title, arr) => '<div class="lcol ' + cls + '"><div class="lhead"><span class="dot"></span>' + title + '</div><ul>' +
    (arr || []).map(x => '<li><b>' + esc(x.item) + '</b>' + (x.note ? '<span>' + esc(x.note) + '</span>' : '') + '</li>').join('') + '</ul></div>';
  let h = '<div class="sec-head"><h2>Сладкое без чувства вины</h2><p>' + esc(Sw.intro) + '</p></div>';
  if (Sw.daily_budget) h += '<div class="budget"><span class="label">Бюджет сладкого</span><span class="hand">' + esc(Sw.daily_budget) + '</span></div>';
  h += '<div class="two"><div class="panel"><h3>Когда можно</h3><ul>' + li(Sw.when_ok) + '</ul></div><div class="panel"><h3>Когда лучше не надо</h3><ul>' + li(Sw.when_not) + '</ul></div></div>';
  h += '<div class="sec-head"><h2>Светофор сладкого</h2></div><div class="light">' + lcol('g', 'Зелёный — спокойно', Sw.green) + lcol('y', 'Жёлтый — порционно', Sw.yellow) + lcol('r', 'Красный — редко', Sw.red) + '</div>';
  if ((Sw.rules || []).length) h += '<div class="panel"><h3>Правила</h3><ul>' + li(Sw.rules) + '</ul></div>';
  if ((Sw.swaps || []).length) h += '<div class="sec-head"><h2>Замены</h2></div><div class="swaps">' + Sw.swaps.map(s => '<div class="swap"><span class="from">' + esc(s.instead) + '</span><span class="arr" aria-label="лучше">→</span><span class="to">' + esc(s.better) + '</span></div>').join('') + '</div>';
  const sw = IDEAS.filter(r => /слад/i.test(r.kind || ''));
  if (sw.length) { const used = usedMap(); h += '<div class="sec-head"><h2>ПП-десерты</h2><p>Нажми «+», чтобы поставить десерт в меню.</p></div><div class="grid">' + sw.map(r => rcard(r, used)).join('') + '</div>'; }
  $('v-sweets').innerHTML = h;
}

// ---------- fiber ----------
function renderFiber() {
  const F = D.fiber || {};
  let h = '<div class="sec-head"><h2>Клетчатка без радикализма</h2><p>' + esc(F.intro) + '</p></div>';
  if (F.target) h += '<div class="fgoal"><span class="label">Цель на человека в день</span><span class="hand">' + esc(F.target) + '</span></div>';
  if ((F.course_examples || []).length) h += '<div class="sec-head"><h3>Наборы из курса</h3></div><div class="sets">' + F.course_examples.map(x =>
    '<div class="set"><div class="big num">' + n0(x.fiber_g) + '<small>г клетчатки</small></div><b>' + esc(x.set) + '</b>' + (x.note ? '<span>' + esc(x.note) + '</span>' : '') + '</div>').join('') + '</div>';
  const src = (F.sources || []).slice().sort((a, b) => (b.fiber_g || 0) - (a.fiber_g || 0));
  const mx = src.length ? Math.max(...src.map(x => Number(x.fiber_g) || 0)) : 1;
  if (src.length) h += '<div class="sec-head"><h3>Где больше всего клетчатки</h3><p>На обычную порцию.</p></div><div class="fsrc">' + src.map(x =>
    '<div class="fs"><span>' + esc(x.item) + '</span><span class="por">' + esc(x.portion) + '</span><span class="g num">' + esc(String(x.fiber_g).replace('.', ',')) + ' г</span><span class="bar"><i style="width:' + ((Number(x.fiber_g) || 0) / mx * 100).toFixed(1) + '%"></i></span></div>').join('') + '</div>';
  if ((F.tips || []).length) h += '<div class="panel"><h3>Как добирать мягко</h3><ul>' + F.tips.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
  $('v-fiber').innerHTML = h;
}

// ---------- sync status line ----------
function statusInfo() {
  if (!firebaseConfig) return ['', 'Меню, отметки и траты хранятся только на этом устройстве'];
  if (!S.hh) return ['', 'Общий список не подключён: это делается внизу вкладки «Траты»'];
  if (S.status === 'error') return ['err', 'Ошибка синхронизации (' + S.err + '). Данные сохранены на телефоне'];
  if (S.status === 'connecting') return ['', 'Подключаюсь к общему списку…'];
  if (!navigator.onLine || S.status === 'offline') return ['off', 'Нет сети: всё сохраняется на телефоне и отправится само'];
  if (S.pending) return ['off', 'Отправляю изменения…'];
  // fromCache without pending writes: nothing is lost; another tab of this browser may hold the server stream
  if (S.fromCache) return ['on', 'Общий список подключён'];
  return ['on', 'Общий список: всё сохранено'];
}
function paintStatus() {
  const [cls, txt] = statusInfo();
  document.querySelectorAll('.sync').forEach(el => { el.className = 'sync' + (cls ? ' ' + cls : ''); el.innerHTML = '<i></i>' + esc(txt); });
}
const syncLine = () => '<p class="sync"><i></i></p>';

// ---------- shopping: computed from the menu ----------
function fmtQty(p, a) {
  if (p.unit === 'шт') return Math.ceil(a - 1e-9) + ' шт.';
  const u = p.unit === 'ml' ? ['мл', 'л'] : ['г', 'кг'];
  return a >= 1000 ? dec(a / 1000, 2) + ' ' + u[1] : Math.round(a) + ' ' + u[0];
}
function pieces(p, a) {
  if (!(p.piece_g > 0) || p.unit === 'шт') return '';
  const n = Math.max(0.5, Math.ceil(a / p.piece_g * 2) / 2);
  return '≈ ' + dec(n, 1) + ' шт.';
}
function computeShop() {
  const T = [1, 2].map(t => ({ t, need: {}, uses: {} }));
  const pantryNeed = {}, pantryUses = {};
  S.menu.forEach((d, i) => {
    const tr = T[(DAY_TRIP[i] || 1) - 1];
    d.forEach(x => {
      const r = R[x.r]; if (!r) return;
      (r.ingredients || []).forEach(ing => {
        const p = PRODUCTS[ing.product]; if (!p || !(ing.amount > 0)) return;
        if (p.pantry) { pantryNeed[ing.product] = (pantryNeed[ing.product] || 0) + ing.amount; (pantryUses[ing.product] = pantryUses[ing.product] || new Set()).add(r.name); return; }
        tr.need[ing.product] = (tr.need[ing.product] || 0) + ing.amount;
        (tr.uses[ing.product] = tr.uses[ing.product] || new Set()).add(r.name);
      });
    });
  });
  const carry = {};
  const lists = T.map((tr, ti) => {
    const items = Object.keys(tr.need).map(pid => {
      const p = PRODUCTS[pid]; const total = tr.need[pid];
      let need = total, have = 0;
      if (ti === 1 && carry[pid] > 0) { have = Math.min(carry[pid], need); need -= have; }
      let packs = 0, price = 0, buyLabel = '';
      if (need > 0.0001) {
        if (p.loose) { price = need / 1000 * p.price_eur; buyLabel = fmtQty(p, need) + (pieces(p, need) ? ' (' + pieces(p, need) + ')' : ''); }
        else { packs = Math.ceil(need / p.pack - 1e-9); price = packs * p.price_eur; buyLabel = packs + ' × ' + (p.pack_label || fmtQty(p, p.pack)); }
      }
      if (ti === 0 && !p.loose && packs) {
        // an opened pack of dairy/meat spoils in 2–3 days: only whole unopened packs carry over;
        // eggs and dry goods (grains, pasta, oats, nuts) keep after opening, so any remainder carries
        const left = packs * p.pack - need, shelf = p.shelf_days || 0;
        if (p.unit === 'шт' || shelf >= 60) carry[pid] = left;
        else if (shelf >= 14) carry[pid] = Math.floor(left / p.pack + 1e-9) * p.pack;
      }
      return { pid, p, total, need, have, packs, price, buyLabel, uses: [...tr.uses[pid]] };
    }).sort((a, b) => SECTIONS.indexOf(a.p.section) - SECTIONS.indexOf(b.p.section) || a.p.name.localeCompare(b.p.name, 'ru'));
    return { t: tr.t, key: 't' + tr.t, info: TRIPS_INFO[ti] || {}, items, total: items.reduce((a, x) => a + x.price, 0) };
  });
  const pantry = Object.keys(pantryNeed).map(pid => ({ pid, p: PRODUCTS[pid], total: pantryNeed[pid], uses: [...pantryUses[pid]] }))
    .sort((a, b) => a.p.name.localeCompare(b.p.name, 'ru'));
  lists.push({ t: 'p', key: 'p', info: { name: 'Кладовка', when: 'Один раз и потом по мере надобности', covers: 'Специи, соль, масла, соусы, мёд — на несколько недель. Отметь, что уже есть дома.' }, pantry, total: pantry.reduce((a, x) => a + (x.p.price_eur || 0), 0) });
  return lists;
}
let curTrip = 0;
function setCheck(id, on) {
  if (on) S.checks[id] = true; else delete S.checks[id];
  if (S.refs) { const { f } = S.sdk; f.setDoc(S.refs.cRef, { c: { [id]: on ? true : f.deleteField() } }, { merge: true }).catch(onWriteErr); }
  else LS.set(K.checks, S.checks);
}
function resetList(ids) {
  ids.forEach(id => { delete S.checks[id]; });
  if (S.refs) { const { f } = S.sdk; const c = {}; ids.forEach(id => { c[id] = f.deleteField(); }); f.setDoc(S.refs.cRef, { c }, { merge: true }).catch(onWriteErr); }
  else LS.set(K.checks, S.checks);
  refreshChecks();
}
function refreshChecks() {
  const v = $('v-shop'); if (!v) return;
  let all = 0, done = 0;
  v.querySelectorAll('input[data-c]').forEach(c => {
    const on = !!S.checks[c.getAttribute('data-c')]; all++; if (on) done++;
    c.checked = on; c.closest('.it').classList.toggle('done', on);
  });
  const cnt = $('cnt'), bar = $('progbar');
  if (cnt) cnt.textContent = 'Отмечено ' + done + ' из ' + all;
  if (bar) bar.style.width = (all ? done / all * 100 : 0).toFixed(1) + '%';
}
function itemRow(id, name, amountHtml, price, subs, done) {
  return '<label class="it' + (done ? ' done' : '') + '" for="chk-' + id + '"><input type="checkbox" id="chk-' + id + '" data-c="' + id + '"' + (done ? ' checked' : '') + '>' +
    '<span class="nm">' + esc(name) + ' <span class="am">' + amountHtml + '</span></span><span class="pr num">' + esc(price) + '</span>' +
    (subs.length ? '<span class="sub">' + subs.join('') + '</span>' : '') + '</label>';
}
function renderShop() {
  const lists = computeShop();
  if (curTrip >= lists.length) curTrip = 0;
  const t = lists[curTrip];
  let h = '<div class="sec-head"><h2>Закупки</h2><p>Списки считаются из меню недели: поменяешь блюдо — поменяется и список. Отмечайте купленное прямо в магазине. Курсивом — как продукт называется на ценнике.</p>' + syncLine() + '</div>';
  h += '<div class="seg" role="group" aria-label="Список">' + lists.map((x, i) => '<button class="fbtn" data-t="' + i + '" aria-pressed="' + (i === curTrip) + '">' + esc(x.info.name) + '</button>').join('') + '</div>';
  h += '<div class="trip-head"><div class="meta"><h3>' + esc(t.info.name) + '</h3><p>' + esc(t.info.when || '') + '</p><p>' + esc(t.info.covers || '') + '</p></div>' +
    '<div class="trip-sum">' + (t.total ? '<span class="tot num">' + esc(eur(t.total)) + '</span>' : '') +
    '<span class="label num" id="cnt"></span><span class="prog"><i id="progbar"></i></span>' +
    '<span class="actions">' + (t.key !== 'p' ? '<button class="btn pri" id="rec-sum">Записать сумму чека</button>' : '') + '<button class="btn" id="copy">Скопировать список</button><button class="btn" id="reset">Снять отметки</button></span></div></div>';
  const ids = [];
  if (t.key === 'p') {
    h += '<div class="shop-secs"><div class="ssec"><h3>Проверь, что есть дома</h3>' + t.pantry.map(x => {
      const id = 'p_' + x.pid; ids.push(id);
      const subs = []; if (x.p.local_name) subs.push('<span class="sk">' + esc(x.p.local_name) + '</span>'); subs.push('<span>' + esc(x.uses.slice(0, 4).join(', ') + (x.uses.length > 4 ? '…' : '')) + '</span>');
      return itemRow(id, x.p.name, esc(x.p.pack_label || ''), eur(x.p.price_eur), subs, !!S.checks[id]);
    }).join('') + '</div></div>';
  } else {
    const bySec = {};
    t.items.forEach(x => { (bySec[x.p.section] = bySec[x.p.section] || []).push(x); });
    h += '<div class="shop-secs">' + SECTIONS.filter(s => bySec[s]).map(s => '<div class="ssec"><h3>' + esc(s) + '</h3>' + bySec[s].map(x => {
      const id = t.key + '_' + x.pid; ids.push(id);
      const subs = [];
      subs.push('<span>нужно ' + esc(fmtQty(x.p, x.total)) + (pieces(x.p, x.total) ? ' ' + esc(pieces(x.p, x.total)) : '') + '</span>');
      if (x.have > 0) subs.push('<span>' + (x.need > 0.0001 ? 'часть уже есть с закупки 1' : 'хватит остатка с закупки 1 — не покупать') + '</span>');
      if (x.p.local_name) subs.push('<span class="sk">' + esc(x.p.local_name) + '</span>');
      if (x.p.storage) subs.push('<span>' + esc(x.p.storage) + '</span>');
      subs.push('<span>' + esc(x.uses.slice(0, 3).join(', ') + (x.uses.length > 3 ? '…' : '')) + '</span>');
      return itemRow(id, x.p.name, x.need > 0.0001 ? esc(x.buyLabel) : 'есть', x.price ? eur(x.price) : '', subs, !!S.checks[id]);
    }).join('') + '</div>').join('') + '</div>';
  }
  if (L) {
    h += '<div class="sec-head"><h2>Где покупать в Банской Быстрице</h2>' + (L.intro ? '<p>' + esc(L.intro) + '</p>' : '') + '</div>';
    if ((L.stores || []).length) h += '<div class="tablewrap"><table><thead><tr><th>Магазин</th><th>Адрес</th><th>От ŠD 3</th><th>Воскресенье</th><th>Брать здесь</th></tr></thead><tbody>' +
      L.stores.map(s => '<tr><td><b>' + esc(s.name) + '</b></td><td>' + esc(s.address) + '</td><td>' + esc(s.near) + '</td><td class="n">' + esc(s.sunday) + '</td><td>' + esc(s.best_for) + '</td></tr>').join('') + '</tbody></table></div>';
    if ((L.specialty || []).length) h += '<div class="subswap">' + L.specialty.map(s => '<div class="ss"><b>' + esc(s.item) + '</b><span>' + esc(s.where) + '</span></div>').join('') + '</div>';
    if (L.market || (L.tips || []).length) h += '<div class="panel"><h3>Полезно знать</h3><ul>' + (L.market ? '<li>' + esc(L.market) + '</li>' : '') + (L.tips || []).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  }
  const v = $('v-shop'); v.innerHTML = h;
  v.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { curTrip = Number(b.getAttribute('data-t')); renderShop(); }));
  v.querySelectorAll('input[data-c]').forEach(c => c.addEventListener('change', () => { setCheck(c.getAttribute('data-c'), c.checked); refreshChecks(); }));
  $('reset').addEventListener('click', () => { resetList(ids); toast('Отметки сняты'); });
  const rec = $('rec-sum'); if (rec) rec.addEventListener('click', () => { show('money'); prefillMoney({ trip: t.info.name }); });
  $('copy').addEventListener('click', () => {
    let txt = t.info.name + (t.info.when ? ' — ' + t.info.when : '') + '\n';
    if (t.key === 'p') txt += t.pantry.map(x => (S.checks['p_' + x.pid] ? '☑ ' : '☐ ') + x.p.name).join('\n');
    else txt += t.items.filter(x => x.need > 0.0001).map(x => (S.checks[t.key + '_' + x.pid] ? '☑ ' : '☐ ') + x.p.name + ' — ' + x.buyLabel + (x.p.local_name ? ' (' + x.p.local_name + ')' : '')).join('\n');
    copyText(txt, 'Список скопирован');
  });
  refreshChecks(); paintStatus();
}

// ---------- money ----------
const planWeek = () => { const l = computeShop(); return l[0].total + l[1].total; };
const TRIP_OPTIONS = TRIPS_INFO.map(t => t.name).concat(['Кладовка', 'Другое']);
const STORE_OPTIONS = (() => {
  const out = [];
  ((L && L.stores) || []).forEach(s => { const n = s.name + (s.address ? ' (' + String(s.address).split(',')[0] + ')' : ''); if (!out.includes(n)) out.push(n); });
  ['Онлайн-заказ', 'Рынок', 'Другой магазин'].forEach(n => out.push(n));
  return out;
})();
function renderMoney() {
  const today = ymd(new Date());
  let h = '<div class="sec-head"><h2>Траты</h2><p>Записывайте сумму каждого чека — статистика посчитается сама. План недели считается по текущему меню.</p>' + syncLine() + '</div>';
  h += '<div id="m-tiles" class="tiles"></div>';
  h += '<form class="form" id="m-form" novalidate><h3>Новый чек</h3><div class="frow">' +
    '<div class="field amount"><label for="m-amount">Сумма, €</label><input id="m-amount" inputmode="decimal" autocomplete="off" placeholder="0,00" required></div>' +
    '<div class="field"><label for="m-date">Дата</label><input id="m-date" type="date" value="' + today + '" required></div>' +
    '<div class="field"><label for="m-store">Магазин</label><select id="m-store">' + STORE_OPTIONS.map(s => '<option>' + esc(s) + '</option>').join('') + '</select></div>' +
    '<div class="field"><label for="m-trip">Список</label><select id="m-trip">' + TRIP_OPTIONS.map(s => '<option>' + esc(s) + '</option>').join('') + '</select></div>' +
    '<div class="field"><label for="m-who">Кто платил</label><select id="m-who"></select></div>' +
    '<div class="field"><label for="m-note">Заметка</label><input id="m-note" maxlength="80" autocomplete="off" placeholder="необязательно"></div>' +
    '</div><p class="err" id="m-err" hidden></p><div class="actions"><button class="btn pri" type="submit">Записать</button></div></form>';
  h += '<div class="chart" id="m-chart"></div>';
  h += '<div class="filters" role="group" aria-label="Период"><button class="fbtn" data-p="month">Этот месяц</button><button class="fbtn" data-p="all">Всё время</button></div>';
  h += '<div class="two"><div class="panel"><h3>По магазинам</h3><div id="m-stores"></div></div><div class="panel"><h3>Кто сколько заплатил</h3><div id="m-who-sum" class="who"></div></div></div>';
  h += '<div class="sec-head"><h3>История</h3></div><div class="hist" id="m-hist"></div>';
  h += '<div class="actions"><button class="btn" id="m-csv">Скачать CSV</button></div>';
  h += '<div class="panel share" id="m-share"></div>';
  const v = $('v-money'); v.innerHTML = h;
  updateNames();
  $('m-who').value = String(S.me);
  $('m-form').addEventListener('submit', e => {
    e.preventDefault();
    const raw = $('m-amount').value.replace(/\s/g, '').replace(',', '.');
    const amount = Math.round(parseFloat(raw) * 100) / 100;
    const err = $('m-err');
    if (!(amount > 0) || amount > 5000) { err.textContent = 'Введите сумму чека в евро, например 23,40.'; err.hidden = false; $('m-amount').focus(); return; }
    const date = $('m-date').value || today;
    err.hidden = true;
    addExpense({ amount, date, store: $('m-store').value, trip: $('m-trip').value, who: Number($('m-who').value) || 0, note: $('m-note').value.trim() });
    $('m-amount').value = ''; $('m-note').value = '';
    toast('Записано: ' + money(amount));
  });
  v.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { S.period = b.getAttribute('data-p'); updateMoney(); }));
  $('m-csv').addEventListener('click', exportCsv);
  renderShare(); updateMoney(); paintStatus();
}
function prefillMoney(o) {
  if (!$('m-form')) renderMoney();
  if (o.trip && TRIP_OPTIONS.includes(o.trip)) $('m-trip').value = o.trip;
  $('m-date').value = ymd(new Date());
  setTimeout(() => { $('m-form').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); $('m-amount').focus(); }, 60);
}
function updateNames() {
  const sel = $('m-who');
  if (sel) { const cur = sel.value; sel.innerHTML = S.names.map((n, i) => '<option value="' + i + '">' + esc(n || ('Человек ' + (i + 1))) + '</option>').join(''); sel.value = cur || String(S.me); }
  [0, 1].forEach(i => { const inp = $('nm-' + i); if (inp && document.activeElement !== inp) inp.value = S.names[i] || ''; });
  const me = $('nm-me'); if (me) { me.innerHTML = S.names.map((n, i) => '<option value="' + i + '">' + esc(n || ('Человек ' + (i + 1))) + '</option>').join(''); me.value = String(S.me); }
}
function updateMoney() {
  if (!$('m-tiles')) return;
  const PLAN_WEEK = planWeek();
  const ex = S.expenses.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0));
  const now = new Date(), ws = weekStart(now), wsY = ymd(ws), weY = ymd(addDays(ws, 7));
  const monthY = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  const wk = sum(ex.filter(e => e.date >= wsY && e.date < weY));
  const moList = ex.filter(e => e.date >= monthY);
  const mo = sum(moList);
  const firstDate = ex.length ? ex[ex.length - 1].date : null;
  let avg = null, nW = 0;
  if (firstDate) { const fw = weekStart(parseYmd(firstDate)); nW = Math.round((ws - fw) / (7 * 864e5)); if (nW > 0) avg = sum(ex.filter(e => e.date < wsY)) / nW; }
  const pct = PLAN_WEEK ? wk / PLAN_WEEK : 0;
  const over = PLAN_WEEK && wk > PLAN_WEEK;
  $('m-tiles').innerHTML =
    '<div class="tile' + (over ? ' over' : ' under') + '"><span class="label">Эта неделя</span><span class="v num">' + money(wk) + '</span><span class="prog"><i style="width:' + Math.min(100, pct * 100).toFixed(1) + '%"></i></span><span class="s">из ≈ ' + Math.round(PLAN_WEEK) + ' € по плану</span>' +
      (wk > 0 ? '<span class="st">' + (over ? 'Больше плана на ' + money(wk - PLAN_WEEK) : 'Осталось ' + money(PLAN_WEEK - wk)) + '</span>' : '') + '</div>' +
    '<div class="tile"><span class="label">' + esc(['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'][now.getMonth()]) + '</span><span class="v num">' + money(mo) + '</span><span class="s">' + moList.length + ' ' + plural(moList.length, 'чек', 'чека', 'чеков') + ' за месяц</span></div>' +
    '<div class="tile"><span class="label">Средняя неделя</span><span class="v num">' + (avg != null ? money(avg) : '—') + '</span><span class="s">' + (avg != null ? 'по ' + nW + ' ' + plural(nW, 'прошлой неделе', 'прошлым неделям', 'прошлым неделям') : 'появится после первой полной недели') + '</span></div>';

  const weeks = [];
  for (let i = 7; i >= 0; i--) { const s = addDays(ws, -7 * i); weeks.push({ s, sY: ymd(s), eY: ymd(addDays(s, 7)), total: 0, n: 0 }); }
  ex.forEach(x => { const w = weeks.find(w => x.date >= w.sY && x.date < w.eY); if (w) { w.total += Number(x.amount) || 0; w.n++; } });
  const peak = Math.max(...weeks.map(w => w.total));
  const max = Math.max(PLAN_WEEK * 1.15, peak * 1.05) || 1;
  const bars = weeks.map((w, i) => {
    const hp = w.total / max * 100, e = addDays(w.s, 6);
    const lab = w.s.getDate() + ' ' + MONTHS[w.s.getMonth()] + ' – ' + e.getDate() + ' ' + MONTHS[e.getMonth()];
    const showVal = w.total > 0 && (i === 7 || w.total === peak);
    return '<div class="wbar' + (i === 7 ? ' cur' : '') + '" tabindex="0" data-tip="' + esc(lab + ': ' + money(w.total) + (w.n ? ' · ' + w.n + ' ' + plural(w.n, 'чек', 'чека', 'чеков') : '')) + '" aria-label="' + esc(lab + ': ' + money(w.total)) + '">' +
      '<span style="height:' + hp.toFixed(1) + '%"></span>' + (showVal ? '<b style="bottom:calc(' + hp.toFixed(1) + '% + 4px)">' + Math.round(w.total) + ' €</b>' : '') + '</div>';
  }).join('');
  const xl = weeks.map((w, i) => '<span>' + (i === 7 ? 'эта' : w.s.getDate() + '.' + pad(w.s.getMonth() + 1)) + '</span>').join('');
  $('m-chart').innerHTML = '<h3>Траты по неделям</h3><p class="cap">Последние 8 недель, неделя с понедельника. Пунктир — план по текущему меню.</p>' +
    '<div class="plot" id="m-plot">' + bars + (PLAN_WEEK ? '<div class="planline" style="bottom:' + (PLAN_WEEK / max * 100).toFixed(1) + '%"><em>план ≈ ' + Math.round(PLAN_WEEK) + ' €</em></div>' : '') + '<div class="tip" id="m-tip" hidden></div></div><div class="xl">' + xl + '</div>';
  const plot = $('m-plot'), tip = $('m-tip');
  const showTip = b => { tip.textContent = b.getAttribute('data-tip'); tip.hidden = false; const pr = plot.getBoundingClientRect(), br = b.getBoundingClientRect(); let x = br.left + br.width / 2 - pr.left; const w = tip.offsetWidth; x = Math.max(w / 2, Math.min(pr.width - w / 2, x)); tip.style.left = x + 'px'; };
  plot.querySelectorAll('.wbar').forEach(b => {
    b.addEventListener('pointerenter', () => showTip(b)); b.addEventListener('focus', () => showTip(b));
    b.addEventListener('pointerleave', () => { tip.hidden = true; }); b.addEventListener('blur', () => { tip.hidden = true; });
  });

  document.querySelectorAll('#v-money [data-p]').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-p') === S.period)));
  const pe = S.period === 'month' ? moList : ex;
  const byStore = {}; pe.forEach(e => { byStore[e.store || 'Без магазина'] = (byStore[e.store || 'Без магазина'] || 0) + (Number(e.amount) || 0); });
  const st = Object.entries(byStore).sort((a, b) => b[1] - a[1]);
  const smx = st.length ? st[0][1] : 1;
  $('m-stores').innerHTML = st.length ? '<div class="fsrc" style="border:0;padding:0">' + st.map(([n, v]) =>
    '<div class="fs"><span>' + esc(n) + '</span><span class="por">' + Math.round(v / (sum(pe) || 1) * 100) + '%</span><span class="g num">' + Math.round(v) + ' €</span><span class="bar"><i style="width:' + (v / smx * 100).toFixed(1) + '%"></i></span></div>').join('') + '</div>' : '<p class="empty">Пока нет чеков за этот период.</p>';
  const byWho = [0, 0]; pe.forEach(e => { const i = Number(e.who) === 1 ? 1 : 0; byWho[i] += Number(e.amount) || 0; });
  const nm = i => S.names[i] || ('Человек ' + (i + 1));
  let wh = byWho.map((v, i) => '<div class="row"><span>' + esc(nm(i)) + '</span><b class="num">' + money(v) + '</b></div>').join('');
  const diff = Math.abs(byWho[0] - byWho[1]) / 2;
  if (diff >= 0.5) { const payer = byWho[0] > byWho[1] ? 0 : 1; wh += '<p class="settle">Чтобы было поровну: перевод ' + esc(nm(1 - payer)) + ' → ' + esc(nm(payer)) + ', <b class="num">' + money(diff) + '</b></p>'; }
  else if (sum(pe) > 0) wh += '<p class="settle">Пока поровну.</p>';
  $('m-who-sum').innerHTML = wh;

  const list = S.histAll ? ex : ex.slice(0, 25);
  $('m-hist').innerHTML = list.length ? list.map(e => '<div class="hrow"><span class="t">' + esc(e.store || 'Без магазина') + '</span><span class="a num">' + money(e.amount) + '</span>' +
    '<span class="m">' + esc(niceDate(e.date)) + ' · ' + esc(e.trip || '') + ' · платил(а) ' + esc(nm(Number(e.who) === 1 ? 1 : 0)) + (e.note ? ' · ' + esc(e.note) : '') + '</span><button class="del" data-del="' + esc(e.id) + '">Удалить</button></div>').join('') +
    (ex.length > list.length ? '<div class="hrow"><button class="btn" id="m-more">Показать все ' + ex.length + '</button></div>' : '')
    : '<p class="empty">Здесь появятся ваши чеки. Нажмите «Записать сумму чека» в закупках или заполните форму выше.</p>';
  $('m-hist').querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'Точно удалить?'; setTimeout(() => { if (b.isConnected) { b.classList.remove('sure'); b.textContent = 'Удалить'; } }, 4000); return; }
    deleteExpense(b.getAttribute('data-del'));
  }));
  const more = $('m-more'); if (more) more.addEventListener('click', () => { S.histAll = true; updateMoney(); });
}
function addExpense(e) {
  if (S.refs) {
    const { f } = S.sdk;
    f.addDoc(S.refs.eCol, Object.assign({}, e, { by: S.uid, createdAt: f.serverTimestamp() })).catch(onWriteErr);
  } else {
    e.id = 'l' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    S.expenses.unshift(e); LS.set(K.exp, S.expenses); updateMoney();
  }
}
function deleteExpense(id) {
  if (S.refs) { const { f } = S.sdk; f.deleteDoc(f.doc(S.refs.eCol, id)).catch(onWriteErr); }
  else { S.expenses = S.expenses.filter(e => e.id !== id); LS.set(K.exp, S.expenses); updateMoney(); }
  toast('Чек удалён');
}
function exportCsv() {
  const ex = S.expenses.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const rows = [['Дата', 'Сумма, €', 'Магазин', 'Список', 'Кто платил', 'Заметка']].concat(ex.map(e => [e.date, String(e.amount).replace('.', ','), e.store || '', e.trip || '', S.names[Number(e.who) === 1 ? 1 : 0] || '', e.note || '']));
  const csv = '﻿' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'traty-racion-' + ymd(new Date()) + '.csv';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
function setNames(names) {
  S.names = names; LS.set(K.names, names); updateNames(); updateMoney();
  if (S.refs) { const { f } = S.sdk; f.setDoc(S.refs.hRef, { names }, { merge: true }).catch(onWriteErr); }
}

// ---------- sharing ----------
const inviteLink = () => location.origin + location.pathname + '?k=' + S.hh;
function newKey() {
  const A = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint8Array(22); crypto.getRandomValues(a);
  return Array.from(a, b => A[b % A.length]).join('');
}
function renderShare() {
  const el = $('m-share'); if (!el) return;
  let h = '<h3>Общий доступ</h3>';
  if (!firebaseConfig) h += '<p class="s">Синхронизация между телефонами ещё не настроена, поэтому сейчас всё хранится только на этом устройстве.</p>';
  else if (!S.hh) h += '<p>Создайте общий список и отправьте ссылку второму человеку: у вас будут общие меню, галочки и траты. То, что уже записано на этом телефоне, перенесётся туда.</p>' +
    '<div class="actions"><button class="btn pri" id="sh-create">Создать общий список</button></div>' +
    '<div class="field"><label for="sh-join">Уже есть ссылка-приглашение?</label><div class="joinrow"><input id="sh-join" placeholder="Вставьте ссылку или код" autocomplete="off"><button class="btn" id="sh-join-btn">Подключиться</button></div></div>';
  else h += '<p>Отправьте эту ссылку второму человеку. Кто её откроет, увидит то же меню, галочки и траты. Не выкладывайте её в открытый доступ.</p><p class="code">' + esc(inviteLink()) + '</p>' +
    '<div class="actions">' + (navigator.share ? '<button class="btn pri" id="sh-share">Отправить ссылку</button>' : '') + '<button class="btn' + (navigator.share ? '' : ' pri') + '" id="sh-copy">Скопировать ссылку</button><button class="btn" id="sh-leave">Отключить на этом телефоне</button></div>';
  h += '<p class="s">Впишите ваши имена — они нужны для «Кто платил». На каждом телефоне выберите, чей он.</p><div class="frow"><div class="field"><label for="nm-0">Имя 1</label><input id="nm-0" maxlength="20" autocomplete="off"></div><div class="field"><label for="nm-1">Имя 2</label><input id="nm-1" maxlength="20" autocomplete="off"></div>' +
    '<div class="field"><label for="nm-me">Этот телефон</label><select id="nm-me"></select></div></div>';
  h += '<p class="s">Совет: добавьте сайт на главный экран телефона (Safari: «Поделиться» → «На экран Домой»; Chrome: меню → «Добавить на главный экран»). Он откроется как приложение и будет работать без интернета.</p>';
  el.innerHTML = h; updateNames();
  [0, 1].forEach(i => $('nm-' + i).addEventListener('change', () => { const n = S.names.slice(); n[i] = $('nm-' + i).value.trim() || ('Человек ' + (i + 1)); setNames(n); }));
  $('nm-me').addEventListener('change', () => { S.me = Number($('nm-me').value) || 0; LS.set(K.me, S.me); const w = $('m-who'); if (w) w.value = String(S.me); });
  const c = $('sh-create'); if (c) c.addEventListener('click', createHousehold);
  const jb = $('sh-join-btn'); if (jb) jb.addEventListener('click', () => joinHousehold($('sh-join').value));
  const sh = $('sh-share'); if (sh) sh.addEventListener('click', () => { navigator.share({ title: 'Белковая неделя на двоих', text: 'Наш общий рацион и список закупок', url: inviteLink() }).catch(() => {}); });
  const cp = $('sh-copy'); if (cp) cp.addEventListener('click', () => copyText(inviteLink(), 'Ссылка скопирована'));
  const lv = $('sh-leave'); if (lv) lv.addEventListener('click', () => {
    if (!lv.classList.contains('sure')) { lv.classList.add('sure'); lv.textContent = 'Точно отключить? Данные останутся в общем списке'; return; }
    LS.set(K.hh, null); location.href = location.pathname + location.hash;
  });
}

// ---------- Firebase ----------
async function connect() {
  if (!firebaseConfig || !S.hh) return;
  S.status = 'connecting'; paintStatus();
  try {
    if (!S.sdk) {
      const [a, au, f] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
      const app = a.initializeApp(firebaseConfig);
      let db;
      try { db = f.initializeFirestore(app, { localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }) }); }
      catch (e) { db = f.getFirestore(app); }
      const auth = au.getAuth(app);
      S.sdk = { f, au, db, auth };
    }
    const { au, auth } = S.sdk;
    await new Promise(res => { const un = au.onAuthStateChanged(auth, () => { un(); res(); }); });
    if (!auth.currentUser) await au.signInAnonymously(auth);
    S.uid = auth.currentUser.uid;
    attach();
  } catch (err) {
    S.status = navigator.onLine ? 'error' : 'offline';
    S.err = (err && (err.code || err.message)) || 'connect';
    paintStatus();
  }
}
function attach() {
  if (S.refs) return;
  const { f, db } = S.sdk;
  const hRef = f.doc(db, 'households', S.hh), cRef = f.doc(db, 'households', S.hh, 'state', 'checks'),
    mRef = f.doc(db, 'households', S.hh, 'state', 'menu'), eCol = f.collection(db, 'households', S.hh, 'expenses');
  S.refs = { hRef, cRef, mRef, eCol };
  const meta = { includeMetadataChanges: true };
  const onErr = err => { S.status = 'error'; S.err = (err && (err.code || err.message)) || 'listen'; paintStatus(); };
  let pc = false, pe = false, pm = false, fc = true, fe = true;
  const upd = () => { S.pending = pc || pe || pm; S.fromCache = fc || fe; if (S.status !== 'error') S.status = 'live'; paintStatus(); };
  f.onSnapshot(hRef, snap => {
    const d = snap.data();
    if (d && Array.isArray(d.names) && d.names.length) { S.names = d.names.slice(0, 2); LS.set(K.names, S.names); updateNames(); updateMoney(); }
  }, onErr);
  f.onSnapshot(cRef, meta, snap => { S.checks = Object.assign({}, (snap.data() || {}).c || {}); pc = snap.metadata.hasPendingWrites; fc = snap.metadata.fromCache; refreshChecks(); upd(); }, onErr);
  let menuSeen = '';
  f.onSnapshot(mRef, meta, snap => {
    pm = snap.metadata.hasPendingWrites;
    const d = snap.data();
    if (d && d.v === 2) {
      const m = DEFAULT_MENU.map((_, i) => (d['d' + i] || []).map(x => ({ slot: x.s, r: x.r, note: x.n || '' })));
      const sig = JSON.stringify(m);
      if (sig !== menuSeen) { menuSeen = sig; if (sig !== JSON.stringify(S.menu)) { S.menu = m; LS.set(K.menu, S.menu); renderMenuDependent(); } }
    }
    upd();
  }, onErr);
  f.onSnapshot(eCol, meta, snap => { S.expenses = snap.docs.map(d => Object.assign({ id: d.id }, d.data())); pe = snap.metadata.hasPendingWrites; fe = snap.metadata.fromCache; updateMoney(); upd(); }, onErr);
}
async function createHousehold() {
  const btn = $('sh-create'); if (btn) { btn.disabled = true; btn.textContent = 'Создаю…'; }
  const localChecks = Object.assign({}, S.checks), localExp = S.expenses.slice(), localMenu = JSON.parse(JSON.stringify(S.menu));
  S.hh = newKey(); LS.set(K.hh, S.hh);
  await connect();
  if (!S.refs) { toast('Не получилось подключиться. Проверьте интернет и попробуйте ещё раз'); LS.set(K.hh, null); S.hh = null; renderShare(); return; }
  const { f } = S.sdk;
  f.setDoc(S.refs.hRef, { names: S.names, created: f.serverTimestamp() }, { merge: true }).catch(onWriteErr);
  if (Object.keys(localChecks).length) f.setDoc(S.refs.cRef, { c: localChecks }, { merge: true }).catch(onWriteErr);
  if (JSON.stringify(localMenu) !== JSON.stringify(defaultMenu())) { S.menu = localMenu; saveMenu(); }
  localExp.forEach(e => { const x = Object.assign({}, e); delete x.id; f.addDoc(S.refs.eCol, Object.assign(x, { by: S.uid, createdAt: f.serverTimestamp() })).catch(onWriteErr); });
  LS.set(K.exp, []); LS.set(K.checks, {});
  try { history.replaceState(null, '', location.pathname + '?k=' + S.hh + location.hash); } catch (e) { /* ok */ }
  renderShare(); toast('Общий список создан: отправьте ссылку второму человеку');
}
async function joinHousehold(input) {
  let k = String(input || '').trim();
  try { const u = new URL(k); k = u.searchParams.get('k') || ''; } catch (e) { /* not a URL: treat as code */ }
  if (!KEY_RE.test(k)) { toast('Не похоже на ссылку-приглашение. Скопируйте её целиком'); return; }
  S.hh = k; LS.set(K.hh, k);
  try { history.replaceState(null, '', location.pathname + '?k=' + k + location.hash); } catch (e) { /* ok */ }
  await connect();
  renderShare();
  if (S.refs) S.sdk.f.getDoc(S.refs.hRef).then(s => { toast(s.exists() ? 'Подключено к общему списку' : 'Такой список не найден — проверьте ссылку'); }).catch(() => {});
}
window.addEventListener('online', () => { if (S.hh && !S.refs) connect(); paintStatus(); });
window.addEventListener('offline', paintStatus);

// ---------- prep / storage ----------
function renderPrep() {
  let h = '<div class="sec-head"><h2>Подготовка и хранение</h2><p>Немного работы заранее — и в будни на обед и ужин уходит 15–20 минут.</p></div>';
  if ((D.prep_tips || []).length) h += '<div class="timeline">' + D.prep_tips.map(x => '<div class="tl"><div class="w">' + esc(x.when) + '</div><ul>' + (x.tasks || []).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>').join('') + '</div>';
  if ((D.storage_tips || []).length) h += '<div class="panel"><h3>Как хранить в маленьком холодильнике</h3><ul>' + D.storage_tips.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
  if ((D.swaps || []).length) h += '<div class="sec-head"><h2>Если чего-то нет в магазине</h2></div><div class="subswap">' + D.swaps.map(s => '<div class="ss"><span>Нет: ' + esc(s.if_no) + '</span><b>Берите: ' + esc(s.use) + '</b></div>').join('') + '</div>';
  const prods = Object.keys(PRODUCTS).map(id => PRODUCTS[id]).filter(p => !p.pantry).sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.name.localeCompare(b.name, 'ru'));
  if (prods.length) h += '<div class="sec-head"><h2>Продукты: белок, калории, упаковки</h2><p>По этим цифрам считаются белок в днях и списки закупок. Сырой или сухой вес, на 100 г.</p></div><div class="tablewrap"><table><thead><tr><th>Продукт</th><th>На ценнике</th><th>Белок</th><th>Ккал</th><th>Клетч.</th><th>Упаковка</th><th>Цена</th></tr></thead><tbody>' +
    prods.map(p => '<tr><td>' + esc(p.name) + '</td><td><i>' + esc(p.local_name) + '</i></td><td class="n">' + dec(p.p100) + ' г</td><td class="n">' + n0(p.k100) + '</td><td class="n">' + dec(p.f100) + ' г</td><td>' + esc(p.pack_label) + '</td><td class="n">' + esc(eur(p.price_eur)) + (p.loose ? '/кг' : '') + '</td></tr>').join('') + '</tbody></table></div>';
  if ((D.assumptions || []).length) h += '<div class="panel"><h3>Из чего исходили</h3><ul>' + D.assumptions.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
  $('v-prep').innerHTML = h;
}

// ---------- routing ----------
const VIEWS = ['week', 'mine', 'ideas', 'shop', 'money', 'sweets', 'fiber', 'prep'];
function show(v) {
  if (VIEWS.indexOf(v) < 0) v = 'week';
  document.querySelectorAll('[data-view]').forEach(s => { s.hidden = s.getAttribute('data-view') !== v; });
  document.querySelectorAll('#tabs .tab').forEach(a => { if (a.getAttribute('data-v') === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  try { if (location.hash !== '#' + v) history.replaceState(null, '', location.pathname + location.search + '#' + v); } catch (e) { /* ok */ }
}
document.querySelectorAll('#tabs .tab').forEach(a => a.addEventListener('click', e => { e.preventDefault(); show(a.getAttribute('data-v')); window.scrollTo(0, 0); }));
window.addEventListener('hashchange', () => { show(location.hash.replace('#', '')); window.scrollTo(0, 0); });

[renderHeader, renderWeek, renderMine, renderIdeas, renderSweets, renderFiber, renderShop, renderMoney, renderPrep].forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
show(location.hash.replace('#', ''));
paintStatus();
connect();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

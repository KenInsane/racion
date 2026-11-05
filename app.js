// Белковая неделя на двоих — сайт для GitHub Pages.
// Меню и рецепты берутся из data.js (window.PLAN, window.LOCAL).
// Галочки, траты и имена хранятся в Firebase Firestore (если настроен firebase-config.js),
// иначе — только в localStorage этого устройства.
import { firebaseConfig } from './firebase-config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const RAW = window.PLAN || {};
const P = RAW.plan || RAW;
const L = window.LOCAL || null;
const recipes = P.recipes || [];
const R = {}; recipes.forEach(r => { R[r.id] = r; });
const days = P.days || [];
const trips = (P.shopping && P.shopping.trips) || [];
const PLAN_WEEK = trips.reduce((a, t) => a + (Number(t.est_total_eur) || 0), 0);
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
const hash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const weekStart = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const niceDate = s => { const d = parseYmd(s); return WD[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
const sum = arr => arr.reduce((a, e) => a + (Number(e.amount) || 0), 0);

// ---------- storage ----------
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage off */ } },
};
const K = { checks: 'racion.checks.v1', exp: 'racion.expenses.v1', hh: 'racion.household.v1', me: 'racion.me.v1', names: 'racion.names.v1' };
const KEY_RE = /^[A-Za-z0-9]{16,40}$/;
const urlK = (() => { try { const k = new URLSearchParams(location.search).get('k'); return k && KEY_RE.test(k) ? k : null; } catch (e) { return null; } })();
if (urlK) LS.set(K.hh, urlK);

const S = {
  checks: LS.get(K.checks, {}) || {},
  expenses: LS.get(K.exp, []) || [],
  names: LS.get(K.names, ['Человек 1', 'Человек 2']) || ['Человек 1', 'Человек 2'],
  me: Number(LS.get(K.me, 0)) || 0,
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

// ---------- usage of recipes ----------
const used = {};
days.forEach(d => (d.meals || []).forEach(m => { (used[m.recipe_id] = used[m.recipe_id] || []).push(short(d.day) + ' · ' + String(m.slot || '').toLowerCase()); }));

// ---------- header ----------
function renderHeader() {
  $('intro').textContent = P.intro || '';
  const minP = days.length ? Math.min(...days.map(d => Number(d.protein_per_person) || 0)) : 0;
  const panEur = Number(P.shopping && P.shopping.pantry_est_eur) || 0;
  const nSweet = recipes.filter(r => /слад/i.test(r.kind || '')).length, nMain = recipes.length - nSweet;
  const facts = [
    ['от ' + n0(minP) + ' г', 'белка в день каждому'],
    [String(nMain), plural(nMain, 'блюдо', 'блюда', 'блюд') + ' по мотивам рилсов'],
    [String(nSweet), plural(nSweet, 'ПП-десерт', 'ПП-десерта', 'ПП-десертов')],
  ];
  if (PLAN_WEEK > 0) facts.push(['≈ ' + Math.round(PLAN_WEEK) + ' €', 'две закупки на неделю']);
  if (panEur > 0) facts.push(['+ ' + Math.round(panEur) + ' €', 'кладовка, один раз']);
  $('facts').innerHTML = facts.map(f => '<span class="fact"><b class="num">' + esc(f[0]) + '</b>' + esc(f[1]) + '</span>').join('');
}

// ---------- week ----------
function renderWeek() {
  let h = '<div class="sec-head"><h2>Меню недели</h2><p>Нажмите на блюдо, чтобы открыть рецепт. Зелёная полоска под днём — закупка 1, жёлтая — закупка 2. Жёлтая черта на шкале белка — отметка 100 г.</p></div>';
  h += '<div class="strip" role="list">' + days.map((d, i) => '<button class="dchip trip-' + esc(d.trip) + '" role="listitem" data-day="' + i + '" aria-label="' + esc(d.day) + ', ' + n0(d.protein_per_person) + ' г белка"><span class="d">' + esc(short(d.day)) + '</span><span class="p num">' + n0(d.protein_per_person) + ' г</span><span class="t"></span></button>').join('') + '</div>';
  h += '<div class="days">' + days.map((d, i) => {
    const p = Number(d.protein_per_person) || 0, max = 150;
    const meals = (d.meals || []).map(m => {
      const r = R[m.recipe_id];
      return '<li class="meal' + (isSweetSlot(m.slot) ? ' s-sweet' : '') + '"><span class="slot">' + esc(m.slot) + '</span>' +
        (r ? '<button class="dish" data-r="' + esc(m.recipe_id) + '">' + esc(r.name) + '</button>' : '<span class="dish">' + esc(m.recipe_id) + '</span>') +
        (r ? '<span class="mp num">' + n0(r.protein_per_person) + ' г белка · ' + n0(r.kcal_per_person) + ' ккал</span>' : '') +
        (m.note ? '<small>' + esc(m.note) + '</small>' : '') + '</li>';
    }).join('');
    return '<article class="day" id="day-' + i + '"><div class="day-side">' +
      '<div class="day-name"><span class="dn">' + esc(short(d.day)) + '</span><span class="df">' + esc(d.day) + '</span></div>' +
      '<div class="day-theme">' + esc(d.theme) + '</div>' +
      '<div class="badges"><span class="badge trip-' + esc(d.trip) + '">Закупка ' + esc(d.trip) + '</span></div>' +
      '<div class="meter" role="img" aria-label="Белок ' + n0(p) + ' г при цели 100 г"><div class="fill" style="width:' + Math.min(100, p / max * 100).toFixed(1) + '%"></div><div class="mark" style="left:' + (100 / max * 100).toFixed(1) + '%"></div></div>' +
      '<div class="meter-txt"><b class="num">' + n0(p) + ' г</b> белка · <span class="num">' + n0(d.kcal_per_person) + ' ккал</span>' + (d.fiber_per_person != null ? ' · <span class="fib num">' + n0(d.fiber_per_person) + ' г клетчатки</span>' : '') + ' <span>на человека</span></div>' +
      (d.fiber_sources ? '<p class="day-tpl">Клетчатка: ' + esc(d.fiber_sources) + '</p>' : '') +
      (d.template ? '<p class="day-tpl">' + esc(d.template) + '</p>' : '') +
      '</div><div class="day-main"><ol class="meals">' + meals + '</ol>' +
      (d.protein_math ? '<p class="math num">' + esc(d.protein_math) + '</p>' : '') +
      (d.evening_prep ? '<p class="prep"><span class="hand">на вечер</span><span>' + esc(d.evening_prep) + '</span></p>' : '') +
      '</div></article>';
  }).join('') + '</div>';
  const v = $('v-week'); v.innerHTML = h;
  v.querySelectorAll('.dchip').forEach(b => b.addEventListener('click', () => {
    const el = $('day-' + b.getAttribute('data-day'));
    if (el) el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  }));
}

// ---------- recipes ----------
const KINDS = ['все', 'завтрак', 'обед', 'ужин', 'перекус', 'сладкое'];
let curKind = 'все';
function rcard(r) {
  return '<button class="rcard ' + kindClass(r.kind) + '" data-r="' + esc(r.id) + '"><span class="k">' + esc(r.kind) + '</span><h3>' + esc(r.name) + '</h3>' +
    (r.trend ? '<span class="trend">' + esc(r.trend) + '</span>' : '') +
    '<span class="chips"><span class="chip p num">' + n0(r.protein_per_person) + ' г белка</span><span class="chip num">' + n0(r.kcal_per_person) + ' ккал</span>' + (r.fiber_per_person ? '<span class="chip num">' + n0(r.fiber_per_person) + ' г клетч.</span>' : '') + '<span class="chip num">' + n0(r.time_min) + ' мин</span></span>' +
    (used[r.id] ? '<span class="used">В меню: ' + esc(used[r.id].join(', ')) + '</span>' : '') + '</button>';
}
function renderRecipes() {
  const list = recipes.filter(r => curKind === 'все' || String(r.kind || '').toLowerCase() === curKind);
  let h = '<div class="sec-head"><h2>Рецепты</h2><p>Все количества — на двоих, белок и калории — на одного. Готовится на двух конфорках и в микроволновке.</p></div>';
  h += '<div class="filters" role="group" aria-label="Фильтр по приёму пищи">' + KINDS.map(k => {
    const c = k === 'все' ? recipes.length : recipes.filter(r => String(r.kind || '').toLowerCase() === k).length;
    return c ? '<button class="fbtn" data-k="' + k + '" aria-pressed="' + (k === curKind) + '">' + k.charAt(0).toUpperCase() + k.slice(1) + ' <span class="num">' + c + '</span></button>' : '';
  }).join('') + '</div>';
  h += '<div class="grid">' + list.map(rcard).join('') + '</div>';
  const v = $('v-recipes'); v.innerHTML = h;
  v.querySelectorAll('.fbtn').forEach(b => b.addEventListener('click', () => { curKind = b.getAttribute('data-k'); renderRecipes(); }));
}

// ---------- recipe dialog ----------
const dlg = $('dlg');
function openRecipe(id) {
  const r = R[id]; if (!r) return;
  const ing = (r.ingredients || []).map(x => '<li><span>' + esc(x.item) + '</span><span class="num">' + esc(x.qty) + '</span></li>').join('');
  const st = (r.steps || []).map(s => '<li>' + esc(s) + '</li>').join('');
  $('dlg-body').innerHTML =
    '<div class="dlg-top"><div style="display:grid;gap:6px;min-width:0"><span class="label">' + esc(r.kind) + '</span><h2 id="dlg-title">' + esc(r.name) + '</h2></div><button class="x" id="dlg-x" aria-label="Закрыть">×</button></div>' +
    (r.trend ? '<p class="trend">' + esc(r.trend) + '</p>' : '') +
    '<div class="chips"><span class="chip p num">' + n0(r.protein_per_person) + ' г белка на человека</span><span class="chip num">' + n0(r.kcal_per_person) + ' ккал</span>' + (r.fiber_per_person ? '<span class="chip num">' + n0(r.fiber_per_person) + ' г клетчатки</span>' : '') + '<span class="chip num">' + n0(r.time_min) + ' мин</span>' +
    (r.equipment || []).map(e => '<span class="chip">' + esc(e) + '</span>').join('') + '</div>' +
    '<div class="cols"><div style="display:grid;gap:8px;align-content:start"><h3>Продукты на двоих</h3><ul class="ing">' + ing + '</ul></div>' +
    '<div style="display:grid;gap:8px;align-content:start"><h3>Как готовить</h3><ol class="steps">' + st + '</ol></div></div>' +
    (r.plating ? '<p class="plate"><b>Подача как в рилсе.</b> ' + esc(r.plating) + '</p>' : '') +
    (used[r.id] ? '<p class="label" style="text-transform:none;letter-spacing:0;font-weight:500">В меню: ' + esc(used[r.id].join(', ')) + '</p>' : '');
  $('dlg-x').addEventListener('click', () => dlg.close());
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-r]');
  if (t && t.tagName === 'BUTTON') openRecipe(t.getAttribute('data-r'));
});

// ---------- sweets ----------
function renderSweets() {
  const Sw = P.sweets || {};
  const li = a => (a || []).map(x => '<li>' + esc(x) + '</li>').join('');
  const lcol = (cls, title, arr) => '<div class="lcol ' + cls + '"><div class="lhead"><span class="dot"></span>' + title + '</div><ul>' +
    (arr || []).map(x => '<li><b>' + esc(x.item) + '</b>' + (x.note ? '<span>' + esc(x.note) + '</span>' : '') + '</li>').join('') + '</ul></div>';
  let h = '<div class="sec-head"><h2>Сладкое без чувства вины</h2><p>' + esc(Sw.intro) + '</p></div>';
  if (Sw.daily_budget) h += '<div class="budget"><span class="label">Бюджет сладкого</span><span class="hand">' + esc(Sw.daily_budget) + '</span></div>';
  h += '<div class="two"><div class="panel"><h3>Когда можно</h3><ul>' + li(Sw.when_ok) + '</ul></div><div class="panel"><h3>Когда лучше не надо</h3><ul>' + li(Sw.when_not) + '</ul></div></div>';
  h += '<div class="sec-head"><h2>Светофор сладкого</h2></div><div class="light">' + lcol('g', 'Зелёный — спокойно', Sw.green) + lcol('y', 'Жёлтый — порционно', Sw.yellow) + lcol('r', 'Красный — редко', Sw.red) + '</div>';
  if ((Sw.rules || []).length) h += '<div class="panel"><h3>Правила</h3><ul>' + li(Sw.rules) + '</ul></div>';
  if ((Sw.swaps || []).length) h += '<div class="sec-head"><h2>Замены</h2></div><div class="swaps">' + Sw.swaps.map(s => '<div class="swap"><span class="from">' + esc(s.instead) + '</span><span class="arr" aria-label="лучше">→</span><span class="to">' + esc(s.better) + '</span></div>').join('') + '</div>';
  const sw = recipes.filter(r => /слад/i.test(r.kind || ''));
  if (sw.length) h += '<div class="sec-head"><h2>ПП-десерты недели</h2></div><div class="grid">' + sw.map(rcard).join('') + '</div>';
  $('v-sweets').innerHTML = h;
}

// ---------- fiber ----------
function renderFiber() {
  const F = P.fiber || {};
  let h = '<div class="sec-head"><h2>Клетчатка без радикализма</h2><p>' + esc(F.intro) + '</p></div>';
  if (F.target) h += '<div class="fgoal"><span class="label">Цель на человека в день</span><span class="hand">' + esc(F.target) + '</span></div>';
  if ((F.course_examples || []).length) h += '<div class="sec-head"><h3>Наборы из курса</h3></div><div class="sets">' + F.course_examples.map(x =>
    '<div class="set"><div class="big num">' + n0(x.fiber_g) + '<small>г клетчатки</small></div><b>' + esc(x.set) + '</b>' + (x.note ? '<span>' + esc(x.note) + '</span>' : '') + '</div>').join('') + '</div>';
  const src = (F.sources || []).slice().sort((a, b) => (b.fiber_g || 0) - (a.fiber_g || 0));
  const mx = src.length ? Math.max(...src.map(x => Number(x.fiber_g) || 0)) : 1;
  if (src.length) h += '<div class="sec-head"><h3>Где больше всего клетчатки</h3><p>На обычную порцию, которая встречается в меню.</p></div><div class="fsrc">' + src.map(x =>
    '<div class="fs"><span>' + esc(x.item) + '</span><span class="por">' + esc(x.portion) + '</span><span class="g num">' + esc(String(x.fiber_g).replace('.', ',')) + ' г</span><span class="bar"><i style="width:' + ((Number(x.fiber_g) || 0) / mx * 100).toFixed(1) + '%"></i></span></div>').join('') + '</div>';
  if ((F.tips || []).length) h += '<div class="panel"><h3>Как добирать мягко</h3><ul>' + F.tips.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
  $('v-fiber').innerHTML = h;
}

// ---------- sync status line ----------
function statusInfo() {
  if (!firebaseConfig) return ['', 'Отметки и траты хранятся только на этом устройстве'];
  if (!S.hh) return ['', 'Общий список не подключён: это делается внизу вкладки «Траты»'];
  if (S.status === 'error') return ['err', 'Ошибка синхронизации (' + S.err + '). Данные сохранены на телефоне'];
  if (S.status === 'connecting') return ['', 'Подключаюсь к общему списку…'];
  if (!navigator.onLine || S.status === 'offline') return ['off', 'Нет сети: всё сохраняется на телефоне и отправится само'];
  if (S.pending) return ['off', 'Отправляю изменения…'];
  if (S.fromCache) return ['off', 'Жду ответа сервера…'];
  return ['on', 'Общий список: всё сохранено'];
}
function paintStatus() {
  const [cls, txt] = statusInfo();
  document.querySelectorAll('.sync').forEach(el => { el.className = 'sync' + (cls ? ' ' + cls : ''); el.innerHTML = '<i></i>' + esc(txt); });
}
const syncLine = () => '<p class="sync"><i></i></p>';

// ---------- shop ----------
let curTrip = 0;
function tripList() {
  const t = trips.map(x => ({ name: x.name, when: x.when, covers: x.covers, sections: x.sections || [], total: x.est_total_eur, carry: x.carry_over, key: 't' + hash(x.name || '') }));
  const pan = (P.shopping && P.shopping.pantry) || [];
  if (pan.length) t.push({ name: 'Кладовка', when: 'Один раз, в первую закупку', covers: 'Крупы, специи, соусы и масло на всю неделю и дольше', sections: [{ section: 'Купить один раз', items: pan }], total: P.shopping.pantry_est_eur, carry: '', key: 'p' });
  t.forEach(x => {
    const seen = {};
    x.ids = x.sections.map(s => (s.items || []).map(it => { let id = x.key + '_' + hash((s.section || '') + '|' + (it.item || '')); while (seen[id]) id += 'x'; seen[id] = 1; return id; }));
  });
  return t;
}
const TRIPS = tripList();
function setCheck(id, on) {
  if (on) S.checks[id] = true; else delete S.checks[id];
  if (S.refs) {
    const { f } = S.sdk;
    f.setDoc(S.refs.cRef, { c: { [id]: on ? true : f.deleteField() } }, { merge: true }).catch(onWriteErr);
  } else LS.set(K.checks, S.checks);
}
function resetTrip(t) {
  const ids = t.ids.flat();
  ids.forEach(id => { delete S.checks[id]; });
  if (S.refs) {
    const { f } = S.sdk; const c = {}; ids.forEach(id => { c[id] = f.deleteField(); });
    f.setDoc(S.refs.cRef, { c }, { merge: true }).catch(onWriteErr);
  } else LS.set(K.checks, S.checks);
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
  if (cnt) cnt.textContent = 'Куплено ' + done + ' из ' + all;
  if (bar) bar.style.width = (all ? done / all * 100 : 0).toFixed(1) + '%';
}
function renderShop() {
  if (!TRIPS.length) return;
  if (curTrip >= TRIPS.length) curTrip = 0;
  const t = TRIPS[curTrip];
  let h = '<div class="sec-head"><h2>Закупки</h2><p>Отмечайте купленное прямо в магазине. Курсивом — как продукт называется на ценнике.</p>' + syncLine() + '</div>';
  h += '<div class="seg" role="group" aria-label="Список">' + TRIPS.map((x, i) => '<button class="fbtn" data-t="' + i + '" aria-pressed="' + (i === curTrip) + '">' + esc(x.name) + '</button>').join('') + '</div>';
  h += '<div class="trip-head"><div class="meta"><h3>' + esc(t.name) + '</h3><p>' + esc(t.when) + '</p><p>' + esc(t.covers) + '</p></div>' +
    '<div class="trip-sum">' + (t.total ? '<span class="tot num">' + esc(eur(t.total)) + '</span>' : '') +
    '<span class="label num" id="cnt"></span><span class="prog"><i id="progbar"></i></span>' +
    '<span class="actions"><button class="btn pri" id="rec-sum">Записать сумму чека</button><button class="btn" id="copy">Скопировать список</button><button class="btn" id="reset">Снять отметки</button></span></div></div>';
  h += '<div class="shop-secs">' + t.sections.map((s, si) => '<div class="ssec"><h3>' + esc(s.section) + '</h3>' + (s.items || []).map((it, ii) => {
    const id = t.ids[si][ii];
    const sub = [];
    if (it.local_name) sub.push('<span class="sk">' + esc(it.local_name) + '</span>');
    if (it.storage) sub.push('<span>' + esc(it.storage) + '</span>');
    if (it.for_what) sub.push('<span>' + esc(it.for_what) + '</span>');
    return '<label class="it" for="chk-' + id + '"><input type="checkbox" id="chk-' + id + '" data-c="' + id + '">' +
      '<span class="nm">' + esc(it.item) + ' <span class="am">' + esc(it.amount) + '</span></span><span class="pr num">' + esc(eur(it.price_eur)) + '</span>' +
      (sub.length ? '<span class="sub">' + sub.join('') + '</span>' : '') + '</label>';
  }).join('') + '</div>').join('') + '</div>';
  if (t.carry) h += '<p class="carry"><b>Переходит дальше:</b> ' + esc(t.carry) + '</p>';
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
  $('reset').addEventListener('click', () => { resetTrip(t); toast('Отметки сняты'); });
  $('rec-sum').addEventListener('click', () => { show('money'); prefillMoney({ trip: t.name }); });
  $('copy').addEventListener('click', () => {
    const txt = t.name + ' — ' + t.when + '\n' + t.sections.map((s, si) => '\n' + String(s.section).toUpperCase() + '\n' + (s.items || []).map((it, ii) => (S.checks[t.ids[si][ii]] ? '☑ ' : '☐ ') + it.item + ' — ' + it.amount + (it.local_name ? ' (' + it.local_name + ')' : '')).join('\n')).join('\n');
    copyText(txt, 'Список скопирован');
  });
  refreshChecks(); paintStatus();
}

// ---------- money ----------
const TRIP_OPTIONS = TRIPS.map(t => t.name).concat(['Другое']);
const STORE_OPTIONS = (() => {
  const out = [];
  ((L && L.stores) || []).forEach(s => { const n = s.name + (s.address ? ' (' + String(s.address).split(',')[0] + ')' : ''); if (!out.includes(n)) out.push(n); });
  ['Онлайн-заказ', 'Рынок', 'Другой магазин'].forEach(n => out.push(n));
  return out;
})();
function renderMoney() {
  const today = ymd(new Date());
  let h = '<div class="sec-head"><h2>Траты</h2><p>Записывайте сумму каждого чека — статистика посчитается сама. План недели по меню ≈ ' + Math.round(PLAN_WEEK) + ' € на двоих.</p>' + syncLine() + '</div>';
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
  const ex = S.expenses.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0));
  const now = new Date(), ws = weekStart(now), wsY = ymd(ws), weY = ymd(addDays(ws, 7));
  const monthY = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  const wk = sum(ex.filter(e => e.date >= wsY && e.date < weY));
  const mo = sum(ex.filter(e => e.date >= monthY));
  const firstDate = ex.length ? ex[ex.length - 1].date : null;
  let avg = null, nW = 0;
  if (firstDate) { const fw = weekStart(parseYmd(firstDate)); nW = Math.round((ws - fw) / (7 * 864e5)); if (nW > 0) avg = sum(ex.filter(e => e.date < wsY)) / nW; }
  const pct = PLAN_WEEK ? wk / PLAN_WEEK : 0;
  const over = PLAN_WEEK && wk > PLAN_WEEK;
  $('m-tiles').innerHTML =
    '<div class="tile' + (over ? ' over' : ' under') + '"><span class="label">Эта неделя</span><span class="v num">' + money(wk) + '</span><span class="prog"><i style="width:' + Math.min(100, pct * 100).toFixed(1) + '%"></i></span><span class="s">из ≈ ' + Math.round(PLAN_WEEK) + ' € по плану</span>' +
      (wk > 0 ? '<span class="st">' + (over ? 'Больше плана на ' + money(wk - PLAN_WEEK) : 'Осталось ' + money(PLAN_WEEK - wk)) + '</span>' : '') + '</div>' +
    '<div class="tile"><span class="label">' + esc(['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'][now.getMonth()]) + '</span><span class="v num">' + money(mo) + '</span><span class="s">' + ex.filter(e => e.date >= monthY).length + ' ' + plural(ex.filter(e => e.date >= monthY).length, 'чек', 'чека', 'чеков') + ' за месяц</span></div>' +
    '<div class="tile"><span class="label">Средняя неделя</span><span class="v num">' + (avg != null ? money(avg) : '—') + '</span><span class="s">' + (avg != null ? 'по ' + nW + ' ' + plural(nW, 'прошлой неделе', 'прошлым неделям', 'прошлым неделям') : 'появится после первой полной недели') + '</span></div>';

  // weekly bars: 8 weeks
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
  $('m-chart').innerHTML = '<h3>Траты по неделям</h3><p class="cap">Последние 8 недель, неделя с понедельника. Пунктир — план по меню.</p>' +
    '<div class="plot" id="m-plot">' + bars + (PLAN_WEEK ? '<div class="planline" style="bottom:' + (PLAN_WEEK / max * 100).toFixed(1) + '%"><em>план ≈ ' + Math.round(PLAN_WEEK) + ' €</em></div>' : '') + '<div class="tip" id="m-tip" hidden></div></div><div class="xl">' + xl + '</div>';
  const plot = $('m-plot'), tip = $('m-tip');
  const showTip = b => { tip.textContent = b.getAttribute('data-tip'); tip.hidden = false; const pr = plot.getBoundingClientRect(), br = b.getBoundingClientRect(); let x = br.left + br.width / 2 - pr.left; const w = tip.offsetWidth; x = Math.max(w / 2, Math.min(pr.width - w / 2, x)); tip.style.left = x + 'px'; };
  plot.querySelectorAll('.wbar').forEach(b => {
    b.addEventListener('pointerenter', () => showTip(b)); b.addEventListener('focus', () => showTip(b));
    b.addEventListener('pointerleave', () => { tip.hidden = true; }); b.addEventListener('blur', () => { tip.hidden = true; });
  });

  // period breakdowns
  document.querySelectorAll('#v-money [data-p]').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-p') === S.period)));
  const pe = S.period === 'month' ? ex.filter(e => e.date >= monthY) : ex;
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

  // history
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
  else if (!S.hh) h += '<p>Создайте общий список и отправьте ссылку второму человеку: у вас будут общие галочки и траты. Чеки, записанные на этом телефоне, перенесутся туда.</p>' +
    '<div class="actions"><button class="btn pri" id="sh-create">Создать общий список</button></div>' +
    '<div class="field"><label for="sh-join">Уже есть ссылка-приглашение?</label><div class="joinrow"><input id="sh-join" placeholder="Вставьте ссылку или код" autocomplete="off"><button class="btn" id="sh-join-btn">Подключиться</button></div></div>';
  else h += '<p>Отправьте эту ссылку второму человеку. Кто её откроет, увидит те же галочки и траты. Не выкладывайте её в открытый доступ.</p><p class="code">' + esc(inviteLink()) + '</p>' +
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
  const hRef = f.doc(db, 'households', S.hh), cRef = f.doc(db, 'households', S.hh, 'state', 'checks'), eCol = f.collection(db, 'households', S.hh, 'expenses');
  S.refs = { hRef, cRef, eCol };
  const meta = { includeMetadataChanges: true };
  const onErr = err => { S.status = 'error'; S.err = (err && (err.code || err.message)) || 'listen'; paintStatus(); };
  let pc = false, pe = false, fc = true, fe = true;
  const upd = () => { S.pending = pc || pe; S.fromCache = fc || fe; if (S.status !== 'error') S.status = 'live'; paintStatus(); };
  f.onSnapshot(hRef, snap => {
    const d = snap.data();
    if (d && Array.isArray(d.names) && d.names.length) { S.names = d.names.slice(0, 2); LS.set(K.names, S.names); updateNames(); updateMoney(); }
  }, onErr);
  f.onSnapshot(cRef, meta, snap => { S.checks = Object.assign({}, (snap.data() || {}).c || {}); pc = snap.metadata.hasPendingWrites; fc = snap.metadata.fromCache; refreshChecks(); upd(); }, onErr);
  f.onSnapshot(eCol, meta, snap => { S.expenses = snap.docs.map(d => Object.assign({ id: d.id }, d.data())); pe = snap.metadata.hasPendingWrites; fe = snap.metadata.fromCache; updateMoney(); upd(); }, onErr);
}
async function createHousehold() {
  const btn = $('sh-create'); if (btn) { btn.disabled = true; btn.textContent = 'Создаю…'; }
  const localChecks = Object.assign({}, S.checks), localExp = S.expenses.slice();
  S.hh = newKey(); LS.set(K.hh, S.hh);
  await connect();
  if (!S.refs) { toast('Не получилось подключиться. Проверьте интернет и попробуйте ещё раз'); LS.set(K.hh, null); S.hh = null; renderShare(); return; }
  const { f } = S.sdk;
  f.setDoc(S.refs.hRef, { names: S.names, created: f.serverTimestamp() }, { merge: true }).catch(onWriteErr);
  if (Object.keys(localChecks).length) f.setDoc(S.refs.cRef, { c: localChecks }, { merge: true }).catch(onWriteErr);
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

// ---------- prep ----------
function renderPrep() {
  let h = '<div class="sec-head"><h2>Подготовка</h2><p>Немного работы заранее — и в будни на ужин уходит 15–20 минут.</p></div>';
  h += '<div class="timeline">' + (P.prep_plan || []).map(x => '<div class="tl"><div class="w">' + esc(x.when) + '</div><ul>' + (x.tasks || []).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>').join('') + '</div>';
  if ((P.storage_tips || []).length) h += '<div class="panel"><h3>Как хранить в маленьком холодильнике</h3><ul>' + P.storage_tips.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
  if ((P.swaps || []).length) h += '<div class="sec-head"><h2>Если чего-то нет в магазине</h2></div><div class="subswap">' + P.swaps.map(s => '<div class="ss"><span>Нет: ' + esc(s.if_no) + '</span><b>Берите: ' + esc(s.use) + '</b></div>').join('') + '</div>';
  if ((P.nutrition_table || []).length) h += '<div class="sec-head"><h2>Белок в продуктах</h2><p>По этим цифрам считались все дни. Сырой вес, на 100 г.</p></div><div class="tablewrap"><table><thead><tr><th>Продукт</th><th>На ценнике</th><th>Белок</th><th>Ккал</th><th>Клетч.</th><th>Заметка</th></tr></thead><tbody>' +
    P.nutrition_table.map(x => '<tr><td>' + esc(x.product) + '</td><td><i>' + esc(x.local_name) + '</i></td><td class="n">' + esc(x.protein_100g) + ' г</td><td class="n">' + esc(x.kcal_100g) + '</td><td class="n">' + (x.fiber_100g != null ? esc(x.fiber_100g) + ' г' : '—') + '</td><td>' + esc(x.note) + '</td></tr>').join('') + '</tbody></table></div>';
  if ((P.assumptions || []).length) h += '<div class="panel"><h3>Из чего исходили</h3><ul>' + P.assumptions.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
  $('v-prep').innerHTML = h;
}

// ---------- routing ----------
const VIEWS = ['week', 'recipes', 'sweets', 'fiber', 'shop', 'money', 'prep'];
function show(v) {
  if (VIEWS.indexOf(v) < 0) v = 'week';
  document.querySelectorAll('[data-view]').forEach(s => { s.hidden = s.getAttribute('data-view') !== v; });
  document.querySelectorAll('#tabs .tab').forEach(a => { if (a.getAttribute('data-v') === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  try { if (location.hash !== '#' + v) history.replaceState(null, '', location.pathname + location.search + '#' + v); } catch (e) { /* ok */ }
}
document.querySelectorAll('#tabs .tab').forEach(a => a.addEventListener('click', e => { e.preventDefault(); show(a.getAttribute('data-v')); window.scrollTo(0, 0); }));
window.addEventListener('hashchange', () => { show(location.hash.replace('#', '')); window.scrollTo(0, 0); });

[renderHeader, renderWeek, renderRecipes, renderSweets, renderFiber, renderShop, renderMoney, renderPrep].forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
show(location.hash.replace('#', ''));
paintStatus();
connect();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

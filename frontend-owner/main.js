import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || '';
const USE_MOCK = !API_URL;

const els = {
  revenue:    document.getElementById('m-revenue'),
  clients:    document.getElementById('m-clients'),
  clientsSub: document.getElementById('m-clients-sub'),
  avg:        document.getElementById('m-avg'),
  masters:    document.getElementById('m-masters'),
  mastersSub: document.getElementById('m-masters-sub'),
  low:        document.getElementById('m-low'),
  deltaVal:   document.getElementById('m-delta-val'),
  stockList:  document.getElementById('stock-list'),
  feedList:   document.getElementById('feed-list'),
  feedHint:   document.getElementById('feed-hint'),
  date:       document.getElementById('today-date'),
  uptime:     document.getElementById('uptime'),
  refresh:    document.getElementById('refresh-btn'),
  autoplay:   document.getElementById('autoplay-btn'),
  status:     document.getElementById('conn-status'),
  statusText: document.querySelector('#conn-status .status-text'),
  srcLabel:   document.getElementById('src-label'),
  spark:      document.getElementById('spark'),
  toastStack: document.getElementById('toast-stack'),
};

const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n ?? 0));
const fmtShort = (n) => {
  const v = Math.round(n ?? 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return Math.round(v / 100) / 10 + 'k';
  return String(v);
};
const fmtDate = (d) =>
  d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });

// ── Mock: имя мастеров/услуг из seed бэкенда, чтобы фид выглядел «настоящим»
const MOCK_MASTERS = ['Aziz', 'Sardor'];
const MOCK_SERVICES = [
  { name: 'Soch olish',    price: 30000 },
  { name: 'Soqol olish',   price: 20000 },
  { name: 'Soch + soqol',  price: 45000 },
  { name: "Bo'yash",       price: 60000 },
];
const MOCK_CLIENT_NAMES = ['Bekzod', 'Otabek', 'Jasur', 'Sanjar', 'Alisher', 'Rustam', 'Doniyor', 'Farrux', 'Ilyos', 'Anvar'];

const MOCK_STATE = {
  clientsServed: 3,
  revenue: 95_000,
  lowStock: [
    { _id: 'm1', name: "Bo'yoq",     qty: 1, unit: 'tuba',   lowThreshold: 2 },
    { _id: 'm2', name: 'Soqol moyi', qty: 1, unit: 'flakon', lowThreshold: 2 },
  ],
  activeMasters: 2,
};

let prev = { clientsServed: null, revenue: null, low: null, avg: null };
let sparkData = seedSpark();
const feedItems = []; // { id, master, service, amount, ts }
const START_TIME = Date.now();
let autoplayTimer = null;

// ── Count-up анимация цифр ──────────────
function countUp(el, from, to, duration = 900) {
  if (from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const dur = duration;
  function step(now) {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = from + (to - from) * eased;
    el.textContent = fmt(val);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = fmt(to);
  }
  requestAnimationFrame(step);
}

function pulse(el) {
  el.classList.remove('is-pulse');
  void el.offsetWidth;
  el.classList.add('is-pulse');
}

// ── Sparkline ──────────────────────────
function seedSpark() {
  // Симулирует нарастающую выручку по часам (10..18)
  const hours = 9;
  const now = new Date().getHours();
  const points = [];
  let acc = 0;
  for (let i = 0; i < hours; i++) {
    const h = 9 + i;
    const active = h <= now;
    const inc = active ? Math.round(15000 + Math.random() * 45000) : 0;
    acc += inc;
    points.push(acc);
  }
  return points;
}

function renderSpark() {
  const svg = els.spark;
  const W = 320, H = 90;
  const pad = 4;
  const n = sparkData.length;
  const max = Math.max(1, ...sparkData);
  const stepX = (W - pad * 2) / Math.max(1, n - 1);

  const pts = sparkData.map((v, i) => {
    const x = pad + stepX * i;
    const y = pad + (H - pad * 2) * (1 - v / max);
    return [x, y];
  });

  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`;
  const last = pts[pts.length - 1];

  svg.innerHTML = `
    <defs>
      <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stop-color="#C9A45C" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#C9A45C" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="spark-stroke" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"  stop-color="#B8924A"/>
        <stop offset="100%" stop-color="#E0C285"/>
      </linearGradient>
    </defs>
    <path class="spark-area" d="${area}"/>
    <path class="spark-line" d="${line}"/>
    <circle class="spark-dot" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5"/>
  `;
}

function bumpSpark(amount) {
  sparkData[sparkData.length - 1] += amount;
  renderSpark();
}

// ── Connection indicator ───────────────
function setConn(state) {
  els.status.classList.remove('is-live', 'is-error');
  if (state === 'live')  { els.status.classList.add('is-live');  els.statusText.textContent = 'в реальном времени'; }
  else if (state === 'error') { els.status.classList.add('is-error'); els.statusText.textContent = 'нет связи'; }
  else                    { els.statusText.textContent = 'офлайн'; }
}

// ── Toasts ─────────────────────────────
function toast(html) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-dot"></span><div>${html}</div>`;
  els.toastStack.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// ── Feed ───────────────────────────────
function pushFeed({ master, service, amount }) {
  const item = {
    id: Math.random().toString(36).slice(2),
    master, service, amount,
    ts: Date.now(),
  };
  feedItems.unshift(item);
  if (feedItems.length > 20) feedItems.pop();
  renderFeed();
  els.feedHint.textContent = `${feedItems.length} за сегодня`;
}

function timeAgo(ts) {
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec} сек назад`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  return `${h} ч назад`;
}

function renderFeed() {
  if (feedItems.length === 0) {
    els.feedList.innerHTML = `<li class="feed-empty">Пока пусто — как только мастер закроет запись, событие появится здесь</li>`;
    return;
  }
  els.feedList.innerHTML = feedItems
    .map(
      (it) => `
        <li class="feed-item">
          <div class="feed-avatar">${escapeHtml(it.master[0])}</div>
          <div class="feed-text">
            <div><strong>${escapeHtml(it.master)}</strong> завершил <span class="feed-svc">${escapeHtml(it.service)}</span></div>
            <div class="feed-time">${timeAgo(it.ts)}</div>
          </div>
          <div class="feed-amount">+${fmt(it.amount)}</div>
        </li>`,
    )
    .join('');
}

// ── Render main state ──────────────────
function render(data) {
  const clients = data.clientsServed ?? 0;
  const revenue = data.revenue ?? 0;
  const low = data.lowStock ?? [];
  const avg = clients > 0 ? Math.round(revenue / clients) : 0;
  const masters = data.activeMasters ?? MOCK_STATE.activeMasters;

  // Count-up для основных цифр
  if (prev.revenue !== null) {
    if (prev.revenue !== revenue) countUp(els.revenue, prev.revenue, revenue, 900);
    else els.revenue.textContent = fmt(revenue);
  } else els.revenue.textContent = fmt(revenue);

  if (prev.clientsServed !== null) {
    if (prev.clientsServed !== clients) { countUp(els.clients, prev.clientsServed, clients, 500); pulse(els.clients); }
    else els.clients.textContent = fmt(clients);
  } else els.clients.textContent = fmt(clients);

  if (prev.avg !== null && prev.avg !== avg) countUp(els.avg, prev.avg, avg, 700);
  else els.avg.textContent = fmt(avg);

  els.masters.textContent = fmt(masters);
  els.mastersSub.textContent = masters === 0
    ? 'смена не начата'
    : masters === 1 ? 'один мастер в смене' : `${masters} мастеров в смене`;

  if (prev.low !== null && prev.low !== low.length) pulse(els.low);
  els.low.textContent = fmt(low.length);

  els.clientsSub.textContent = clients === 0
    ? 'ждём первого клиента'
    : `завершено · среднее ~${fmtShort(avg)} сум`;

  // Delta (мок vs «вчера»)
  const YESTERDAY = 82_000;
  const deltaPct = YESTERDAY > 0 ? Math.round(((revenue - YESTERDAY) / YESTERDAY) * 100) : 0;
  const deltaEl = document.querySelector('.delta');
  deltaEl.classList.toggle('delta--up', deltaPct >= 0);
  deltaEl.classList.toggle('delta--down', deltaPct < 0);
  els.deltaVal.textContent = (deltaPct >= 0 ? '+' : '') + deltaPct + '% vs вчера';

  // Stock list с прогресс-барами
  if (low.length === 0) {
    els.stockList.innerHTML = `<li class="stock-empty is-ok">Всё в наличии — склад в порядке</li>`;
  } else {
    els.stockList.innerHTML = low
      .map((s) => {
        const pct = Math.max(4, Math.min(100, (s.qty / Math.max(1, s.lowThreshold)) * 100));
        return `
          <li class="stock-item is-danger">
            <span class="stock-name">${escapeHtml(s.name)}</span>
            <span class="stock-badge">заканчивается</span>
            <span class="stock-qty">осталось ${s.qty} ${escapeHtml(s.unit || '')} · порог ${s.lowThreshold}</span>
            <div class="stock-progress"><div class="stock-progress-fill" style="width:${pct}%"></div></div>
          </li>`;
      })
      .join('');
  }

  prev = { clientsServed: clients, revenue, low: low.length, avg };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ── Fetch / Socket ─────────────────────
async function fetchToday() {
  if (USE_MOCK) {
    render(MOCK_STATE);
    els.srcLabel.textContent = 'источник: демо-режим (без бэкенда)';
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/owner/today`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    render(data);
    els.srcLabel.textContent = `источник: ${API_URL}/api/owner/today`;
    setConn('live');
  } catch (err) {
    console.error('fetchToday failed', err);
    setConn('error');
    if (prev.revenue === null) render(MOCK_STATE);
  }
}

function connectSocket() {
  if (USE_MOCK) return;
  const socket = io(API_URL, { transports: ['websocket', 'polling'], reconnection: true });
  socket.on('connect',    () => setConn('live'));
  socket.on('disconnect', () => setConn('offline'));
  socket.on('connect_error', () => setConn('error'));
  socket.on('queue:update', () => fetchToday());
}

// ── Autoplay (demo mode) ───────────────
function simulateDoneEvent() {
  const master = MOCK_MASTERS[Math.floor(Math.random() * MOCK_MASTERS.length)];
  const svc = MOCK_SERVICES[Math.floor(Math.random() * MOCK_SERVICES.length)];

  MOCK_STATE.clientsServed += 1;
  MOCK_STATE.revenue += svc.price;

  // 30% chance списать со склада
  if (MOCK_STATE.lowStock.length && Math.random() < 0.3) {
    const s = MOCK_STATE.lowStock[Math.floor(Math.random() * MOCK_STATE.lowStock.length)];
    s.qty = Math.max(0, s.qty - 1);
  }

  bumpSpark(svc.price);
  render(MOCK_STATE);
  pushFeed({ master, service: svc.name, amount: svc.price });
  toast(`<strong>${escapeHtml(master)}</strong> завершил ${escapeHtml(svc.name)} · +${fmt(svc.price)} сум`);
}

function toggleAutoplay() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
    els.autoplay.classList.remove('is-active');
    els.autoplay.querySelector('span').textContent = 'Демо';
    return;
  }
  els.autoplay.classList.add('is-active');
  els.autoplay.querySelector('span').textContent = 'Стоп';
  simulateDoneEvent();
  autoplayTimer = setInterval(simulateDoneEvent, 3500);
}

// ── Uptime ─────────────────────────────
function tickUptime() {
  const ms = Date.now() - START_TIME;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  els.uptime.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Feed time refresh ──────────────────
setInterval(() => { if (feedItems.length) renderFeed(); }, 15000);

// ── Init ───────────────────────────────
els.date.textContent = fmtDate(new Date());
tickUptime(); setInterval(tickUptime, 1000);
renderSpark();
fetchToday();
connectSocket();

els.refresh.addEventListener('click', () => {
  fetchToday();
  const svg = els.refresh.querySelector('svg');
  svg.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 600, easing: 'ease-out' });
});
els.autoplay.addEventListener('click', toggleAutoplay);

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') toggleAutoplay();
  if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') els.refresh.click();
});

// В мок-режиме сразу подсказка судьям + один событий-семпл через 2 сек
if (USE_MOCK) {
  els.feedHint.textContent = 'нажми «Демо» или D — пойдут события';
  setTimeout(() => {
    if (!autoplayTimer && feedItems.length === 0) {
      // Один разовый sample-event чтобы фид не пустовал
      pushFeed({ master: 'Aziz', service: 'Soch olish', amount: 30000 });
    }
  }, 1800);
}

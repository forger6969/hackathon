import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || '';
const USE_MOCK = !API_URL;

// ── DOM refs ─────────────────────────────
const $ = (id) => document.getElementById(id);
const els = {
  revenue: $('m-revenue'),
  clients: $('m-clients'),
  clientsSub: $('m-clients-sub'),
  avg: $('m-avg'),
  low: $('m-low'),
  lowChip: $('low-chip'),
  deltaVal: $('delta-val'),
  deltaBadge: $('delta-badge'),

  psShift: $('ps-shift'),
  psClients: $('ps-clients'),
  psRevenue: $('ps-revenue'),
  psAvg: $('ps-avg'),

  stockList: $('stock-list'),
  alertTitle: $('alert-title'),
  feedList: $('feed-list'),
  feedHint: $('feed-hint'),
  date: $('today-date'),
  uptime: $('uptime'),
  activeMastersNote: $('active-masters-note'),

  refresh: $('refresh-btn'),
  autoplay: $('autoplay-btn'),
  fab: $('fab'),
  liveBadge: $('live-badge'),
  srcLabel: $('src-label'),
  toastStack: $('toast-stack'),

  sparkRevenue: $('spark-revenue'),
  sparkClients: $('spark-clients'),
  sparkAvg: $('spark-avg'),
  sparkLow: $('spark-low'),

  chart: $('chart'),
  chartTip: $('chart-tip'),
  chartLegend: $('chart-legend'),

  mastersTbody: $('masters-tbody'),
};

// ── Constants ────────────────────────────
const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n ?? 0));
const fmtShort = (n) => {
  const v = Math.round(n ?? 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return Math.round(v / 100) / 10 + 'k';
  return String(v);
};
const fmtDate = (d) =>
  d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });

// Услуги в seed бэкенда — используем их же для цветов chart / mock feed
const SERVICES = [
  { name: 'Soch olish',    price: 30000, color: '#C9A45C' }, // gold
  { name: 'Soqol olish',   price: 20000, color: '#7A9A6D' }, // sage
  { name: 'Soch + soqol',  price: 45000, color: '#E0C285' }, // bright gold
  { name: "Bo'yash",       price: 60000, color: '#6D8FA9' }, // slate blue
];
const MASTERS = [
  { id: 'aziz',   name: 'Aziz',   avgMin: 20 },
  { id: 'sardor', name: 'Sardor', avgMin: 25 },
];
const CLIENT_NAMES = ['Bekzod','Otabek','Jasur','Sanjar','Alisher','Rustam','Doniyor','Farrux','Ilyos','Anvar','Shohruh','Diyor'];

// Часы работы 9..21 (13 часов)
const START_HOUR = 9;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

// ── Mock state ───────────────────────────
const MOCK = {
  clientsServed: 3,
  revenue: 95_000,
  lowStock: [
    { _id: 'm1', name: "Bo'yoq",     qty: 1, unit: 'tuba',   lowThreshold: 2 },
    { _id: 'm2', name: 'Soqol moyi', qty: 1, unit: 'flakon', lowThreshold: 2 },
  ],
  activeMasters: 2,
  masters: MASTERS.map((m) => ({
    ...m,
    clients: Math.floor(Math.random() * 2) + 1,
    revenue: 0,
    queueLen: Math.floor(Math.random() * 3),
    status: Math.random() < 0.6 ? 'busy' : 'free',
  })),
  // Массив на 13 часов, для каждого часа объект { [service]: сумма }
  hourly: HOURS.map(() => Object.fromEntries(SERVICES.map((s) => [s.name, 0]))),
};

// Раскидаем 95k выручки по прошедшим часам для реалистичности
(function seedHourly() {
  const now = new Date().getHours();
  const active = HOURS.filter((h) => h <= now);
  const perHour = MOCK.revenue / Math.max(1, active.length);
  active.forEach((h, idx) => {
    const bucket = MOCK.hourly[HOURS.indexOf(h)];
    const svc = SERVICES[idx % SERVICES.length];
    bucket[svc.name] = Math.round(perHour * (0.6 + Math.random() * 0.6));
  });
})();

let prev = { revenue: null, clients: null, avg: null, low: null };
const feedItems = [];
const START_TIME = Date.now();
let autoplayTimer = null;

// ── Utils ────────────────────────────────
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pulse(el) {
  el.classList.remove('is-pulse');
  void el.offsetWidth;
  el.classList.add('is-pulse');
}

function countUp(el, from, to, duration = 700) {
  if (from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  function step(now) {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = fmt(to);
  }
  requestAnimationFrame(step);
}

// ── Sparklines (small SVG in each KPI) ───
function drawSpark(svg, data, color) {
  const W = 100, H = 30, pad = 2;
  const n = data.length;
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const range = Math.max(1, max - min);
  const stepX = (W - pad * 2) / Math.max(1, n - 1);
  const pts = data.map((v, i) => {
    const x = pad + stepX * i;
    const y = pad + (H - pad * 2) * (1 - (v - min) / range);
    return [x, y];
  });
  // Smooth cubic path
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const cpX = (p0[0] + p1[0]) / 2;
    d += ` C ${cpX.toFixed(1)} ${p0[1].toFixed(1)}, ${cpX.toFixed(1)} ${p1[1].toFixed(1)}, ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
  }
  const area = d + ` L ${W} ${H} L 0 ${H} Z`;
  const gid = svg.id + '-g';
  svg.innerHTML = `
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stop-color="${color}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  `;
}

function seedSparkData(peak, points = 12) {
  const arr = [];
  for (let i = 0; i < points; i++) {
    const wave = 0.5 + 0.35 * Math.sin(i * 0.9 + peak * 0.01);
    const trend = (i / (points - 1)) * 0.4;
    arr.push(Math.max(0.05, wave + trend) * peak);
  }
  return arr;
}

// ── Big chart: stacked area by hour × service ──
const CHART_W = 800;
const CHART_H = 260;
const CHART_PAD = { top: 16, right: 16, bottom: 30, left: 44 };
const CHART_IW = CHART_W - CHART_PAD.left - CHART_PAD.right;
const CHART_IH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;

function drawChart() {
  const svg = els.chart;
  const N = MOCK.hourly.length;
  // Stack по услугам
  const stacks = SERVICES.map((s) => MOCK.hourly.map((h) => h[s.name] || 0));
  const totals = MOCK.hourly.map((h) => SERVICES.reduce((sum, s) => sum + (h[s.name] || 0), 0));
  const yMax = Math.max(60_000, ...totals) * 1.15;

  const xAt = (i) => CHART_PAD.left + (CHART_IW / Math.max(1, N - 1)) * i;
  const yAt = (v) => CHART_PAD.top + CHART_IH * (1 - v / yMax);

  // Y-axis labels (4)
  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((yMax * i) / yTicks));

  // Cumulative for stack
  const cumul = MOCK.hourly.map(() => 0);
  const areas = [];
  SERVICES.forEach((svc, si) => {
    const topPts = [];
    const botPts = [];
    for (let i = 0; i < N; i++) {
      const bot = cumul[i];
      const top = bot + stacks[si][i];
      botPts.push([xAt(i), yAt(bot)]);
      topPts.push([xAt(i), yAt(top)]);
      cumul[i] = top;
    }
    // Path: top forward then bottom backward
    let d = `M ${topPts[0][0].toFixed(1)} ${topPts[0][1].toFixed(1)}`;
    for (let i = 1; i < N; i++) {
      const p0 = topPts[i - 1], p1 = topPts[i];
      const cpX = (p0[0] + p1[0]) / 2;
      d += ` C ${cpX.toFixed(1)} ${p0[1].toFixed(1)}, ${cpX.toFixed(1)} ${p1[1].toFixed(1)}, ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
    }
    for (let i = N - 1; i >= 0; i--) d += ` L ${botPts[i][0].toFixed(1)} ${botPts[i][1].toFixed(1)}`;
    d += ' Z';
    areas.push({ svc, d, si });
  });

  const defs = SERVICES.map((s, i) => `
    <linearGradient id="cg-${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="${s.color}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${s.color}" stop-opacity="0.35"/>
    </linearGradient>`).join('');

  const grid = yLabels.map((v, i) => {
    const y = yAt(v);
    return `<line x1="${CHART_PAD.left}" y1="${y}" x2="${CHART_W - CHART_PAD.right}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="2 6"/>`;
  }).join('');

  const yLabelsSvg = yLabels.map((v) => {
    const y = yAt(v);
    return `<text x="${CHART_PAD.left - 8}" y="${y + 3}" text-anchor="end" fill="#6E6E6E" font-size="10" font-family="JetBrains Mono">${fmtShort(v)}</text>`;
  }).join('');

  const xLabels = HOURS.map((h, i) => {
    const x = xAt(i);
    return `<text x="${x}" y="${CHART_H - 10}" text-anchor="middle" fill="#6E6E6E" font-size="10" font-family="JetBrains Mono">${h}:00</text>`;
  }).join('');

  const areasSvg = areas.map((a) => `
    <path d="${a.d}" fill="url(#cg-${a.si})" stroke="${a.svc.color}" stroke-width="1" opacity="0.95"/>`).join('');

  // Vertical guide (cursor)
  const nowIdx = Math.min(N - 1, Math.max(0, new Date().getHours() - START_HOUR));
  const nowX = xAt(nowIdx);
  const nowY = yAt(totals[nowIdx]);
  const nowMarker = `
    <line x1="${nowX}" y1="${CHART_PAD.top}" x2="${nowX}" y2="${CHART_H - CHART_PAD.bottom}" stroke="rgba(224,194,133,0.35)" stroke-dasharray="3 4"/>
    <circle cx="${nowX}" cy="${nowY}" r="5" fill="#E0C285" stroke="#0F0F0F" stroke-width="2"/>
  `;

  // Invisible hover targets for tooltip
  const hoverBands = HOURS.map((h, i) => {
    const x = xAt(i);
    const w = CHART_IW / Math.max(1, N - 1);
    return `<rect x="${x - w / 2}" y="${CHART_PAD.top}" width="${w}" height="${CHART_IH}" fill="transparent" data-idx="${i}" style="cursor:crosshair"/>`;
  }).join('');

  svg.innerHTML = `
    <defs>${defs}</defs>
    ${grid}
    ${areasSvg}
    ${nowMarker}
    ${yLabelsSvg}
    ${xLabels}
    ${hoverBands}
  `;

  // Legend
  els.chartLegend.innerHTML = SERVICES.map((s) => `
    <span class="legend-item">
      <span class="legend-swatch" style="background:${s.color}"></span>
      ${escapeHtml(s.name)}
    </span>
  `).join('');

  // Hover tooltip
  svg.querySelectorAll('rect[data-idx]').forEach((rect) => {
    rect.addEventListener('mouseenter', (e) => showChartTip(+rect.dataset.idx));
    rect.addEventListener('mousemove', (e) => positionTip(e));
    rect.addEventListener('mouseleave', () => hideChartTip());
  });
}

function showChartTip(idx) {
  const bucket = MOCK.hourly[idx];
  const total = SERVICES.reduce((s, svc) => s + (bucket[svc.name] || 0), 0);
  const rows = SERVICES.map((s) => {
    const v = bucket[s.name] || 0;
    const pct = total > 0 ? Math.round((v / total) * 100) : 0;
    return `
      <div class="chart-tt-row">
        <span class="chart-tt-swatch" style="background:${s.color}"></span>
        <span class="chart-tt-name">${escapeHtml(s.name)}</span>
        <span class="chart-tt-val">${fmt(v)}</span>
        <span class="chart-tt-val" style="width:32px;text-align:right;color:var(--text-dim)">${pct}%</span>
      </div>`;
  }).join('');
  els.chartTip.innerHTML = `
    <div class="chart-tt-label">${HOURS[idx]}:00 — ${HOURS[idx] + 1}:00</div>
    <div class="chart-tt-rows">${rows}</div>
    <div class="chart-tt-total"><span>Итого</span><span>${fmt(total)} сум</span></div>
  `;
  els.chartTip.classList.add('is-visible');
}
function hideChartTip() { els.chartTip.classList.remove('is-visible'); }
function positionTip(e) {
  const wrap = els.chart.parentElement;
  const rect = wrap.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  els.chartTip.style.left = x + 'px';
  els.chartTip.style.top = y + 'px';
}

// ── Connection ───────────────────────────
function setConn(state) {
  els.liveBadge.classList.remove('is-offline', 'is-error');
  const span = els.liveBadge.querySelector('span:last-child');
  if (state === 'live')  { span.textContent = 'ONLINE'; }
  else if (state === 'error') { els.liveBadge.classList.add('is-error'); span.textContent = 'OFFLINE'; }
  else { els.liveBadge.classList.add('is-offline'); span.textContent = 'DEMO'; }
}

// ── Toasts ───────────────────────────────
function toast(html) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-dot"></span><div>${html}</div>`;
  els.toastStack.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// ── Feed ─────────────────────────────────
function pushFeed({ master, service, amount }) {
  feedItems.unshift({ id: Math.random().toString(36).slice(2), master, service, amount, ts: Date.now() });
  if (feedItems.length > 20) feedItems.pop();
  renderFeed();
  els.feedHint.textContent = `${feedItems.length} за смену`;
}

function timeAgo(ts) {
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec} сек назад`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} мин назад`;
  return `${Math.round(min / 60)} ч назад`;
}

function renderFeed() {
  if (feedItems.length === 0) {
    els.feedList.innerHTML = `<li class="feed-empty">Пока пусто — как только мастер закроет запись, событие появится здесь</li>`;
    return;
  }
  els.feedList.innerHTML = feedItems.map((it) => `
    <li class="feed-item">
      <div class="feed-avatar">${escapeHtml(it.master[0])}</div>
      <div class="feed-text">
        <div><strong>${escapeHtml(it.master)}</strong> завершил <span class="feed-svc">${escapeHtml(it.service)}</span></div>
        <div class="feed-time">${timeAgo(it.ts)}</div>
      </div>
      <div class="feed-amount">+${fmt(it.amount)}</div>
    </li>`).join('');
}

// ── Masters table ────────────────────────
function renderMasters() {
  els.mastersTbody.innerHTML = MOCK.masters.map((m) => {
    const status = m.status === 'busy' ? 'busy' : m.status === 'off' ? 'off' : 'free';
    const statusText = status === 'busy' ? 'В работе' : status === 'off' ? 'Не в смене' : 'Свободен';
    return `
      <tr>
        <td>
          <div class="master-cell">
            <div class="master-avatar">${escapeHtml(m.name[0])}</div>
            <div>
              <div class="master-name">${escapeHtml(m.name)}</div>
              <div class="master-role">Мастер · ~${m.avgMin} мин</div>
            </div>
          </div>
        </td>
        <td class="col-r">${m.clients}</td>
        <td class="col-r">${fmt(m.revenue)}</td>
        <td class="col-r">${m.avgMin} мин</td>
        <td class="col-r">${m.queueLen}</td>
        <td class="col-r"><span class="status-tag status-tag--${status}"><span class="d"></span>${statusText}</span></td>
      </tr>`;
  }).join('');
}

// ── Main render ──────────────────────────
function render(data) {
  const clients = data.clientsServed ?? 0;
  const revenue = data.revenue ?? 0;
  const low = data.lowStock ?? [];
  const avg = clients > 0 ? Math.round(revenue / clients) : 0;

  // KPIs
  if (prev.revenue !== null && prev.revenue !== revenue) { countUp(els.revenue, prev.revenue, revenue); pulse(els.revenue); }
  else if (prev.revenue === null) els.revenue.textContent = fmt(revenue);

  if (prev.clients !== null && prev.clients !== clients) { countUp(els.clients, prev.clients, clients, 400); pulse(els.clients); }
  else if (prev.clients === null) els.clients.textContent = fmt(clients);

  if (prev.avg !== null && prev.avg !== avg) countUp(els.avg, prev.avg, avg, 500);
  else if (prev.avg === null) els.avg.textContent = fmt(avg);

  if (prev.low !== null && prev.low !== low.length) pulse(els.low);
  els.low.textContent = fmt(low.length);
  els.lowChip.textContent = low.length === 0 ? 'всё в порядке' : `${low.length} ниже порога`;

  els.clientsSub.textContent = clients === 0 ? 'ждём первого' : `среднее ~${fmtShort(avg)} сум`;

  // Delta vs mock yesterday
  const YESTERDAY = 82_000;
  const deltaPct = YESTERDAY > 0 ? Math.round(((revenue - YESTERDAY) / YESTERDAY) * 100) : 0;
  els.deltaBadge.classList.toggle('chip--up', deltaPct >= 0);
  els.deltaBadge.classList.toggle('chip--down', deltaPct < 0);
  els.deltaVal.textContent = (deltaPct >= 0 ? '+' : '') + deltaPct + '% vs вчера';

  // Sparklines
  drawSpark(els.sparkRevenue, seedSparkData(revenue || 60_000), '#E0C285');
  drawSpark(els.sparkClients, seedSparkData(Math.max(clients, 4)), '#7A9A6D');
  drawSpark(els.sparkAvg, seedSparkData(Math.max(avg, 25_000)), '#C9A45C');
  drawSpark(els.sparkLow, seedSparkData(low.length + 1).reverse(), '#B0524A');

  // Stock
  if (low.length === 0) {
    els.alertTitle.textContent = 'Склад в порядке';
    els.stockList.innerHTML = `<li class="stock-empty is-ok">Всё в наличии, ничего не заканчивается</li>`;
  } else {
    els.alertTitle.textContent = 'Что заканчивается';
    els.stockList.innerHTML = low.map((s) => {
      const pct = Math.max(4, Math.min(100, (s.qty / Math.max(1, s.lowThreshold)) * 100));
      return `
        <li class="stock-item is-danger">
          <span class="stock-name">${escapeHtml(s.name)}</span>
          <span class="stock-badge">заканчивается</span>
          <span class="stock-qty">осталось ${s.qty} ${escapeHtml(s.unit || '')} · порог ${s.lowThreshold}</span>
          <div class="stock-progress"><div class="stock-progress-fill" style="width:${pct}%"></div></div>
        </li>`;
    }).join('');
  }

  // Panel dark bottom
  els.psShift.textContent = HOURS[0] + ':00–' + HOURS[HOURS.length - 1] + ':00';
  els.psClients.textContent = fmt(clients);
  els.psRevenue.textContent = fmt(revenue);
  els.psAvg.textContent = fmt(avg);

  // Masters note
  els.activeMastersNote.textContent = `${MOCK.activeMasters} мастера в смене`;

  // Masters table + chart
  renderMasters();
  drawChart();

  prev = { revenue, clients, avg, low: low.length };
}

// ── Fetch / Socket ───────────────────────
async function fetchToday() {
  if (USE_MOCK) {
    render(MOCK);
    els.srcLabel.textContent = 'демо-режим';
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/owner/today`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Обогащаем реальные данные mock-ами для полей, которых нет в API
    render({ ...MOCK, ...data });
    els.srcLabel.textContent = API_URL.replace(/^https?:\/\//, '');
    setConn('live');
  } catch (err) {
    console.error('fetchToday failed', err);
    setConn('error');
    if (prev.revenue === null) render(MOCK);
  }
}

function connectSocket() {
  if (USE_MOCK) return;
  const socket = io(API_URL, { transports: ['websocket', 'polling'], reconnection: true });
  socket.on('connect',       () => setConn('live'));
  socket.on('disconnect',    () => setConn('offline'));
  socket.on('connect_error', () => setConn('error'));
  socket.on('queue:update',  () => fetchToday());
}

// ── Autoplay demo ────────────────────────
function simulateDone() {
  const master = MOCK.masters[Math.floor(Math.random() * MOCK.masters.length)];
  const svc = SERVICES[Math.floor(Math.random() * SERVICES.length)];

  MOCK.clientsServed += 1;
  MOCK.revenue += svc.price;
  master.clients += 1;
  master.revenue += svc.price;
  master.status = 'busy';
  master.queueLen = Math.max(0, master.queueLen - (Math.random() < 0.5 ? 1 : 0));

  // Update current-hour bucket in chart
  const nowIdx = Math.min(HOURS.length - 1, Math.max(0, new Date().getHours() - START_HOUR));
  MOCK.hourly[nowIdx][svc.name] = (MOCK.hourly[nowIdx][svc.name] || 0) + svc.price;

  // 30% списание со склада
  if (MOCK.lowStock.length && Math.random() < 0.3) {
    const s = MOCK.lowStock[Math.floor(Math.random() * MOCK.lowStock.length)];
    s.qty = Math.max(0, s.qty - 1);
  }

  render(MOCK);
  pushFeed({ master: master.name, service: svc.name, amount: svc.price });
  toast(`<strong>${escapeHtml(master.name)}</strong> завершил ${escapeHtml(svc.name)} · +${fmt(svc.price)} сум`);
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
  simulateDone();
  autoplayTimer = setInterval(simulateDone, 3200);
}

// ── Uptime ───────────────────────────────
function tickUptime() {
  const ms = Date.now() - START_TIME;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  els.uptime.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Feed relative time refresh
setInterval(() => { if (feedItems.length) renderFeed(); }, 15000);

// ── Init ─────────────────────────────────
els.date.textContent = fmtDate(new Date());
tickUptime(); setInterval(tickUptime, 1000);
setConn(USE_MOCK ? 'offline' : 'live');
fetchToday();
connectSocket();

els.refresh.addEventListener('click', () => {
  fetchToday();
  const svg = els.refresh.querySelector('svg');
  svg.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 600, easing: 'ease-out' });
});
els.autoplay.addEventListener('click', toggleAutoplay);
els.fab.addEventListener('click', simulateDone);

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const k = e.key.toLowerCase();
  if (k === 'd' || k === 'в') toggleAutoplay();
  if (k === 'r' || k === 'к') els.refresh.click();
  if (k === '+' || k === '=') simulateDone();
});

if (USE_MOCK) {
  els.feedHint.textContent = 'нажми Демо / D / + — пойдут события';
  // Sample event через 1.5с
  setTimeout(() => {
    if (!autoplayTimer && feedItems.length === 0) {
      pushFeed({ master: 'Aziz', service: 'Soch olish', amount: 30000 });
    }
  }, 1500);
}

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

  moClients: $('mo-clients'),
  moRevenue: $('mo-revenue'),
  moGrowth: $('mo-growth'),
  moEmps: $('mo-emps'),

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
  addEmp: $('add-emp-btn'),
  addEmp2: $('add-emp-btn-2'),
  payAll: $('pay-all-btn'),
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

  topSvcList: $('top-svc-list'),
  empsTbody: $('emps-tbody'),

  payrollList: $('payroll-list'),
  payrollHint: $('payroll-hint'),
  payrollTotalWrap: $('payroll-total-wrap'),
  payrollTotal: $('payroll-total'),

  modalAdd: $('modal-add'),
  addForm: $('add-form'),
  modalConfirm: $('modal-confirm'),
  modalConfirmTitle: $('modal-confirm-title'),
  modalConfirmEyebrow: $('modal-confirm-eyebrow'),
  modalConfirmMsg: $('modal-confirm-msg'),
  modalConfirmOk: $('modal-confirm-ok'),
};

// ── Formatters ───────────────────────────
const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n ?? 0));
const fmtShort = (n) => {
  const v = Math.round(n ?? 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return Math.round(v / 100) / 10 + 'k';
  return String(v);
};
const fmtDate = (d) =>
  d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });

// ── Constants ────────────────────────────
const SERVICES = [
  { name: 'Soch olish',    price: 30000, color: '#C9A24E' },
  { name: 'Soqol olish',   price: 20000, color: '#3B9975' },
  { name: 'Soch + soqol',  price: 45000, color: '#EFCE85' },
  { name: "Bo'yash",       price: 60000, color: '#4EA8B8' },
];
const START_HOUR = 9;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

// ── LocalStorage ──────────────────────────
const LS_KEYS = {
  employees: 'navbat.employees.v1',
  payroll:   'navbat.payroll.v1',
};
function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// Default employees (seed на 2х мастеров из backend)
const DEFAULT_EMPLOYEES = [
  { id: 'aziz',   name: 'Aziz',   role: 'Мастер', salary: 4_000_000, avgMin: 20, hiredAt: Date.now() - 45*86400_000, active: true },
  { id: 'sardor', name: 'Sardor', role: 'Мастер', salary: 3_500_000, avgMin: 25, hiredAt: Date.now() - 20*86400_000, active: true },
];

const state = {
  employees: lsGet(LS_KEYS.employees, DEFAULT_EMPLOYEES),
  payroll: lsGet(LS_KEYS.payroll, []),
  // Runtime today's stats per employee (live from mock/API)
  today: {}, // {empId: {clients, revenue, queueLen, status}}
  hourly: HOURS.map(() => Object.fromEntries(SERVICES.map((s) => [s.name, 0]))),
  totals: { clientsServed: 3, revenue: 95_000, lowStock: [
    { _id: 'm1', name: "Bo'yoq",     qty: 1, unit: 'tuba',   lowThreshold: 2 },
    { _id: 'm2', name: 'Soqol moyi', qty: 1, unit: 'flakon', lowThreshold: 2 },
  ], activeMasters: 2 },
};

// Init per-employee today counters
state.employees.forEach((e) => {
  state.today[e.id] = state.today[e.id] || { clients: 0, revenue: 0, queueLen: 0, status: 'free' };
});

// Seed hourly retroactively так, чтобы сумма == state.totals.revenue
(function seedHourly() {
  const now = new Date().getHours();
  const active = HOURS.filter((h) => h <= now);
  if (active.length === 0) return;
  const perHour = state.totals.revenue / active.length;
  active.forEach((h, idx) => {
    const bucket = state.hourly[HOURS.indexOf(h)];
    const svc = SERVICES[idx % SERVICES.length];
    bucket[svc.name] = Math.round(perHour * (0.6 + Math.random() * 0.6));
  });
  // Give initial clients to employees
  const emps = state.employees.filter((e) => e.active);
  emps.forEach((e) => {
    const c = Math.floor(Math.random() * 2) + 1;
    state.today[e.id].clients = c;
    state.today[e.id].revenue = c * 25000;
    state.today[e.id].queueLen = Math.floor(Math.random() * 3);
    state.today[e.id].status = Math.random() < 0.5 ? 'busy' : 'free';
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
  if (!el) return;
  el.classList.remove('is-pulse');
  void el.offsetWidth;
  el.classList.add('is-pulse');
}
function countUp(el, from, to, duration = 700) {
  if (!el) return;
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
function persistEmployees() { lsSet(LS_KEYS.employees, state.employees); }
function persistPayroll()  { lsSet(LS_KEYS.payroll, state.payroll); }
function activeEmps() { return state.employees.filter((e) => e.active); }

// ── Sparklines ───────────────────────────
function drawSpark(svg, data, color) {
  if (!svg) return;
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
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
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

// ── Big chart: stacked area by hour × service ─
const CHART_W = 800;
const CHART_H = 260;
const CHART_PAD = { top: 16, right: 16, bottom: 30, left: 44 };
const CHART_IW = CHART_W - CHART_PAD.left - CHART_PAD.right;
const CHART_IH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;

function drawChart() {
  const svg = els.chart;
  const N = state.hourly.length;
  const stacks = SERVICES.map((s) => state.hourly.map((h) => h[s.name] || 0));
  const totals = state.hourly.map((h) => SERVICES.reduce((sum, s) => sum + (h[s.name] || 0), 0));
  const yMax = Math.max(60_000, ...totals) * 1.15;

  const xAt = (i) => CHART_PAD.left + (CHART_IW / Math.max(1, N - 1)) * i;
  const yAt = (v) => CHART_PAD.top + CHART_IH * (1 - v / yMax);

  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((yMax * i) / yTicks));

  const cumul = state.hourly.map(() => 0);
  const areas = [];
  SERVICES.forEach((svc, si) => {
    const topPts = [], botPts = [];
    for (let i = 0; i < N; i++) {
      const bot = cumul[i];
      const top = bot + stacks[si][i];
      botPts.push([xAt(i), yAt(bot)]);
      topPts.push([xAt(i), yAt(top)]);
      cumul[i] = top;
    }
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
  const grid = yLabels.map((v) => {
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
  const areasSvg = areas.map((a) => `<path d="${a.d}" fill="url(#cg-${a.si})" stroke="${a.svc.color}" stroke-width="1" opacity="0.95"/>`).join('');

  const nowIdx = Math.min(N - 1, Math.max(0, new Date().getHours() - START_HOUR));
  const nowX = xAt(nowIdx);
  const nowY = yAt(totals[nowIdx]);
  const nowMarker = `
    <line x1="${nowX}" y1="${CHART_PAD.top}" x2="${nowX}" y2="${CHART_H - CHART_PAD.bottom}" stroke="rgba(224,194,133,0.35)" stroke-dasharray="3 4"/>
    <circle cx="${nowX}" cy="${nowY}" r="5" fill="#E0C285" stroke="#0F0F0F" stroke-width="2"/>
  `;
  const hoverBands = HOURS.map((h, i) => {
    const x = xAt(i);
    const w = CHART_IW / Math.max(1, N - 1);
    return `<rect x="${x - w / 2}" y="${CHART_PAD.top}" width="${w}" height="${CHART_IH}" fill="transparent" data-idx="${i}" style="cursor:crosshair"/>`;
  }).join('');

  svg.innerHTML = `<defs>${defs}</defs>${grid}${areasSvg}${nowMarker}${yLabelsSvg}${xLabels}${hoverBands}`;

  els.chartLegend.innerHTML = SERVICES.map((s) => `
    <span class="legend-item">
      <span class="legend-swatch" style="background:${s.color}"></span>
      ${escapeHtml(s.name)}
    </span>`).join('');

  svg.querySelectorAll('rect[data-idx]').forEach((rect) => {
    rect.addEventListener('mouseenter', () => showChartTip(+rect.dataset.idx));
    rect.addEventListener('mousemove', (e) => positionTip(e));
    rect.addEventListener('mouseleave', () => hideChartTip());
  });
}
function showChartTip(idx) {
  const bucket = state.hourly[idx];
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
  els.chartTip.style.left = (e.clientX - rect.left) + 'px';
  els.chartTip.style.top  = (e.clientY - rect.top) + 'px';
}

// ── Top services (bar list) ──────────────
function drawTopServices() {
  // Aggregate today's revenue per service from hourly data
  const totals = SERVICES.map((svc) => {
    const total = state.hourly.reduce((sum, b) => sum + (b[svc.name] || 0), 0);
    const count = Math.round(total / svc.price);
    return { ...svc, total, count };
  });
  const max = Math.max(1, ...totals.map((t) => t.total));
  const sorted = totals.slice().sort((a, b) => b.total - a.total);

  if (sorted.every((t) => t.total === 0)) {
    els.topSvcList.innerHTML = `<li class="top-svc-empty">Ждём первую услугу за сегодня</li>`;
    return;
  }

  els.topSvcList.innerHTML = sorted.map((t) => {
    const pct = Math.round((t.total / max) * 100);
    return `
      <li class="top-svc-item">
        <span class="top-svc-name">${escapeHtml(t.name)}</span>
        <span class="top-svc-val">${fmt(t.total)} · ${t.count}×</span>
        <div class="top-svc-bar">
          <div class="top-svc-bar-fill" style="width:${pct}%; background: linear-gradient(90deg, ${t.color}, ${t.color}CC);"></div>
        </div>
      </li>`;
  }).join('');
}

// ── Employees table ──────────────────────
function renderEmployees() {
  const emps = state.employees;
  if (emps.length === 0) {
    els.empsTbody.innerHTML = `<tr><td colspan="7" class="table-empty">Нанимайте сотрудников — кнопка «Сотрудник» сверху</td></tr>`;
    return;
  }
  els.empsTbody.innerHTML = emps.map((e) => {
    const today = state.today[e.id] || { clients: 0, revenue: 0, status: 'off' };
    const status = e.active ? (today.status || 'free') : 'off';
    const statusText = status === 'busy' ? 'В работе' : status === 'off' ? 'Не в смене' : 'Свободен';
    return `
      <tr data-emp-id="${escapeHtml(e.id)}">
        <td>
          <div class="master-cell">
            <div class="master-avatar">${escapeHtml(e.name[0])}</div>
            <div>
              <div class="master-name">${escapeHtml(e.name)}</div>
              <div class="master-role">${escapeHtml(e.role)} · ~${e.avgMin} мин</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(e.role)}</td>
        <td class="col-r">${today.clients}</td>
        <td class="col-r">${fmt(today.revenue)}</td>
        <td class="col-r">${fmt(e.salary)}</td>
        <td class="col-r"><span class="status-tag status-tag--${status}"><span class="d"></span>${statusText}</span></td>
        <td class="col-r">
          <div class="action-cell">
            <button class="btn-pay" data-action="pay" data-id="${escapeHtml(e.id)}" title="Выдать зарплату">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
              Оплата
            </button>
            <button class="btn-danger" data-action="fire" data-id="${escapeHtml(e.id)}" title="Уволнить">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  // Bind action buttons
  els.empsTbody.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'pay')  paySalary(id);
      if (action === 'fire') fireEmployee(id);
    });
  });
}

// ── Payroll rendering ────────────────────
function renderPayroll() {
  const monthAgo = Date.now() - 30 * 86400_000;
  const monthPay = state.payroll.filter((p) => p.paidAt >= monthAgo);
  const total = monthPay.reduce((s, p) => s + p.amount, 0);

  if (monthPay.length === 0) {
    els.payrollList.innerHTML = `<li class="feed-empty">Ещё никому не выдавали в этом месяце — нажми «Зарплата» сверху</li>`;
    els.payrollTotalWrap.hidden = true;
    els.payrollHint.textContent = 'за этот месяц';
    return;
  }

  els.payrollList.innerHTML = monthPay
    .slice().reverse()
    .map((p) => {
      const emp = state.employees.find((e) => e.id === p.employeeId);
      const name = emp?.name ?? p.employeeName ?? 'Уволен';
      const dateStr = new Date(p.paidAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
      const timeStr = new Date(p.paidAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return `
        <li class="payroll-item">
          <div class="payroll-avatar">${escapeHtml(name[0])}</div>
          <div>
            <div class="payroll-name">${escapeHtml(name)}</div>
            <div class="payroll-meta">${dateStr} · ${timeStr}${emp ? '' : ' · уволен'}</div>
          </div>
          <div class="payroll-amount">${fmt(p.amount)} сум</div>
        </li>`;
    }).join('');
  els.payrollTotal.textContent = fmt(total);
  els.payrollTotalWrap.hidden = false;
  els.payrollHint.textContent = `${monthPay.length} выплат · ${new Date().toLocaleDateString('ru-RU', { month: 'long' })}`;
}

// ── Month strip stats ────────────────────
function renderMonthStrip() {
  // Extrapolate from today's numbers
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayClients = state.totals.clientsServed || 0;
  const todayRevenue = state.totals.revenue || 0;

  // Extrapolate: assume today so far represents ~50% of daily potential if before evening, else full
  const hoursOfWork = END_HOUR - START_HOUR;
  const hoursPassed = Math.max(1, Math.min(hoursOfWork, now.getHours() - START_HOUR + 1));
  const projFullDay = todayRevenue / hoursPassed * hoursOfWork;
  const monthRevenue = Math.round(projFullDay * dayOfMonth * 0.85); // avg dampen
  const monthClients = Math.round(todayClients * dayOfMonth * 0.9);
  const lastMonthRevenue = Math.round(projFullDay * daysInMonth * 0.75);
  const growth = lastMonthRevenue > 0 ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : 0;
  const empsCount = activeEmps().length;

  els.moClients.textContent = fmt(monthClients);
  els.moRevenue.textContent = fmt(monthRevenue);
  const g = (growth >= 0 ? '+' : '') + growth + '%';
  els.moGrowth.textContent = g;
  els.moGrowth.classList.toggle('num-emerald', growth >= 0);
  els.moGrowth.style.color = growth >= 0 ? '' : 'var(--garnet-bright)';
  els.moEmps.textContent = fmt(empsCount);
}

// ── Connection ───────────────────────────
function setConn(state) {
  els.liveBadge.classList.remove('is-offline', 'is-error');
  const span = els.liveBadge.querySelector('span:last-child');
  if (state === 'live')       { span.textContent = 'ONLINE'; }
  else if (state === 'error') { els.liveBadge.classList.add('is-error');   span.textContent = 'OFFLINE'; }
  else                        { els.liveBadge.classList.add('is-offline'); span.textContent = 'DEMO'; }
}

// ── Toasts ───────────────────────────────
function toast(html, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' toast--' + kind : '');
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
    els.feedList.innerHTML = `<li class="feed-empty">Пока пусто — как только сотрудник закроет запись, событие появится здесь</li>`;
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

// ── Main render ──────────────────────────
function render() {
  const clients = state.totals.clientsServed || 0;
  const revenue = state.totals.revenue || 0;
  const low = state.totals.lowStock || [];
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

  // Delta
  const YESTERDAY = 82_000;
  const deltaPct = YESTERDAY > 0 ? Math.round(((revenue - YESTERDAY) / YESTERDAY) * 100) : 0;
  els.deltaBadge.classList.toggle('chip--up', deltaPct >= 0);
  els.deltaBadge.classList.toggle('chip--down', deltaPct < 0);
  els.deltaVal.textContent = (deltaPct >= 0 ? '+' : '') + deltaPct + '% vs вчера';

  // Sparklines
  drawSpark(els.sparkRevenue, seedSparkData(revenue || 60_000), '#EFCE85');
  drawSpark(els.sparkClients, seedSparkData(Math.max(clients, 4)), '#3B9975');
  drawSpark(els.sparkAvg,     seedSparkData(Math.max(avg, 25_000)), '#C9A24E');
  drawSpark(els.sparkLow,     seedSparkData(low.length + 1).reverse(), '#C9564A');

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

  // Panel dark
  els.psShift.textContent = HOURS[0] + ':00–' + HOURS[HOURS.length - 1] + ':00';
  els.psClients.textContent = fmt(clients);
  els.psRevenue.textContent = fmt(revenue);
  els.psAvg.textContent = fmt(avg);
  els.activeMastersNote.textContent = `${activeEmps().length} сотрудников в смене`;

  renderEmployees();
  renderPayroll();
  renderMonthStrip();
  drawChart();
  drawTopServices();

  prev = { revenue, clients, avg, low: low.length };
}

// ── Fetch / Socket ───────────────────────
async function fetchToday() {
  if (USE_MOCK) {
    els.srcLabel.textContent = 'демо-режим';
    render();
    return;
  }
  try {
    const [todayRes, mastersRes] = await Promise.allSettled([
      fetch(`${API_URL}/api/owner/today`).then((r) => { if (!r.ok) throw new Error('HTTP '+r.status); return r.json(); }),
      fetch(`${API_URL}/api/masters`).then((r) => r.ok ? r.json() : []),
    ]);

    if (todayRes.status === 'fulfilled') {
      const d = todayRes.value;
      state.totals.clientsServed = d.clientsServed ?? state.totals.clientsServed;
      state.totals.revenue       = d.revenue ?? state.totals.revenue;
      state.totals.lowStock      = d.lowStock ?? state.totals.lowStock;
      state.totals.activeMasters = d.activeMasters ?? state.totals.activeMasters;
    }
    if (mastersRes.status === 'fulfilled' && Array.isArray(mastersRes.value) && mastersRes.value.length > 0) {
      // Merge real masters into local employees (только новые, локальных не удаляем)
      const known = new Set(state.employees.map((e) => e.name.toLowerCase()));
      mastersRes.value.forEach((m) => {
        if (!known.has((m.name || '').toLowerCase())) {
          state.employees.push({
            id: m._id || 'srv-' + Math.random().toString(36).slice(2),
            name: m.name,
            role: 'Мастер',
            salary: 3_500_000,
            avgMin: Math.round((m.avgServiceTimeMs || 1_500_000) / 60000),
            hiredAt: Date.now(),
            active: m.active !== false,
          });
          state.today[m._id] = { clients: 0, revenue: 0, queueLen: 0, status: 'free' };
          known.add(m.name.toLowerCase());
        }
      });
      persistEmployees();
    }

    els.srcLabel.textContent = API_URL.replace(/^https?:\/\//, '');
    setConn('live');
    render();
  } catch (err) {
    console.error('fetchToday failed', err);
    setConn('error');
    render();
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

// ── Actions: Modals ──────────────────────
function openModal(el) { el.hidden = false; document.body.style.overflow = 'hidden'; }
function closeModal(el) { el.hidden = true; document.body.style.overflow = ''; }

document.querySelectorAll('.modal-overlay').forEach((overlay) => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) closeModal(overlay);
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach((m) => { if (!m.hidden) closeModal(m); });
  }
});

// Add Employee
function openAddEmployee() {
  els.addForm.reset();
  els.addForm.querySelector('#f-salary').value = '3000000';
  els.addForm.querySelector('#f-avg').value = '20';
  openModal(els.modalAdd);
  setTimeout(() => els.addForm.querySelector('#f-name').focus(), 50);
}
els.addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(els.addForm);
  const name = String(fd.get('name') || '').trim();
  if (!name) return;
  const newEmp = {
    id: 'emp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    name,
    role: String(fd.get('role') || 'Мастер'),
    salary: Math.max(0, Number(fd.get('salary') || 0)),
    avgMin: Math.max(1, Number(fd.get('avgMin') || 20)),
    hiredAt: Date.now(),
    active: true,
  };
  state.employees.push(newEmp);
  state.today[newEmp.id] = { clients: 0, revenue: 0, queueLen: 0, status: 'free' };
  persistEmployees();
  closeModal(els.modalAdd);
  render();
  toast(`Нанят <strong>${escapeHtml(name)}</strong> · ${escapeHtml(newEmp.role)} · оклад ${fmt(newEmp.salary)} сум`);
});

// Universal confirm modal
function openConfirm({ eyebrow, title, message, okText = 'Подтвердить', okKind = 'primary', onOk }) {
  els.modalConfirmEyebrow.textContent = eyebrow || 'действие';
  els.modalConfirmTitle.textContent = title || 'Подтвердите';
  els.modalConfirmMsg.innerHTML = message || '';
  els.modalConfirmOk.textContent = okText;
  els.modalConfirmOk.className = okKind === 'danger' ? 'btn-ghost' : 'btn-primary';
  if (okKind === 'danger') {
    els.modalConfirmOk.style.background = 'rgba(201, 86, 74, 0.14)';
    els.modalConfirmOk.style.borderColor = 'rgba(201, 86, 74, 0.35)';
    els.modalConfirmOk.style.color = 'var(--garnet-bright)';
  } else {
    els.modalConfirmOk.style.background = '';
    els.modalConfirmOk.style.borderColor = '';
    els.modalConfirmOk.style.color = '';
  }
  const handler = () => {
    closeModal(els.modalConfirm);
    els.modalConfirmOk.removeEventListener('click', handler);
    onOk?.();
  };
  els.modalConfirmOk.addEventListener('click', handler);
  openModal(els.modalConfirm);
}

// Fire employee
function fireEmployee(id) {
  const emp = state.employees.find((e) => e.id === id);
  if (!emp) return;
  openConfirm({
    eyebrow: 'команда',
    title: 'Уволнить сотрудника',
    message: `Уволнить <strong>${escapeHtml(emp.name)}</strong> (${escapeHtml(emp.role)})? История зарплат сохранится.`,
    okText: 'Уволнить',
    okKind: 'danger',
    onOk: () => {
      emp.active = false;
      // Remove from list entirely — user wants "уволнить"
      state.employees = state.employees.filter((e) => e.id !== id);
      persistEmployees();
      render();
      toast(`Уволен <strong>${escapeHtml(emp.name)}</strong>`);
    },
  });
}

// Pay salary (single)
function paySalary(id) {
  const emp = state.employees.find((e) => e.id === id);
  if (!emp) return;
  openConfirm({
    eyebrow: 'финансы',
    title: 'Выдать зарплату',
    message: `Выдать <strong>${escapeHtml(emp.name)}</strong> ежемесячный оклад <strong>${fmt(emp.salary)} сум</strong>?`,
    okText: 'Выдать',
    onOk: () => {
      state.payroll.push({
        id: 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        employeeId: emp.id,
        employeeName: emp.name,
        amount: emp.salary,
        paidAt: Date.now(),
      });
      persistPayroll();
      render();
      toast(`Выдано <strong>${escapeHtml(emp.name)}</strong> · ${fmt(emp.salary)} сум`);
    },
  });
}

// Pay everyone at once
function payAllSalaries() {
  const emps = activeEmps();
  if (emps.length === 0) {
    toast('Нет активных сотрудников для выплаты');
    return;
  }
  const total = emps.reduce((s, e) => s + e.salary, 0);
  openConfirm({
    eyebrow: 'финансы',
    title: 'Массовая выплата',
    message: `Выдать зарплату всем <strong>${emps.length}</strong> сотрудникам? Итого <strong>${fmt(total)} сум</strong>.`,
    okText: 'Выдать всем',
    onOk: () => {
      const now = Date.now();
      emps.forEach((emp, i) => {
        state.payroll.push({
          id: 'p-' + now + '-' + i,
          employeeId: emp.id,
          employeeName: emp.name,
          amount: emp.salary,
          paidAt: now + i, // микро-разница чтоб порядок сохранился
        });
      });
      persistPayroll();
      render();
      toast(`Выдано <strong>${emps.length}</strong> сотрудникам · итого ${fmt(total)} сум`);
    },
  });
}

// ── Autoplay demo ────────────────────────
function simulateDone() {
  const emps = activeEmps();
  if (emps.length === 0) return;
  const emp = emps[Math.floor(Math.random() * emps.length)];
  const svc = SERVICES[Math.floor(Math.random() * SERVICES.length)];

  state.totals.clientsServed += 1;
  state.totals.revenue += svc.price;
  const t = state.today[emp.id] = state.today[emp.id] || { clients: 0, revenue: 0, queueLen: 0, status: 'busy' };
  t.clients += 1;
  t.revenue += svc.price;
  t.status = 'busy';
  t.queueLen = Math.max(0, (t.queueLen || 0) - (Math.random() < 0.5 ? 1 : 0));

  const nowIdx = Math.min(HOURS.length - 1, Math.max(0, new Date().getHours() - START_HOUR));
  state.hourly[nowIdx][svc.name] = (state.hourly[nowIdx][svc.name] || 0) + svc.price;

  if (state.totals.lowStock.length && Math.random() < 0.3) {
    const s = state.totals.lowStock[Math.floor(Math.random() * state.totals.lowStock.length)];
    s.qty = Math.max(0, s.qty - 1);
  }

  render();
  pushFeed({ master: emp.name, service: svc.name, amount: svc.price });
  toast(`<strong>${escapeHtml(emp.name)}</strong> завершил ${escapeHtml(svc.name)} · +${fmt(svc.price)} сум`);
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
setInterval(() => { if (feedItems.length) renderFeed(); }, 15000);

// ── Init ─────────────────────────────────
els.date.textContent = fmtDate(new Date());
tickUptime(); setInterval(tickUptime, 1000);
setConn(USE_MOCK ? 'offline' : 'live');
fetchToday();
connectSocket();

// Buttons
els.refresh.addEventListener('click', () => {
  fetchToday();
  const svg = els.refresh.querySelector('svg');
  svg.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 600, easing: 'ease-out' });
});
els.autoplay.addEventListener('click', toggleAutoplay);
els.addEmp.addEventListener('click', openAddEmployee);
els.addEmp2.addEventListener('click', openAddEmployee);
els.payAll.addEventListener('click', payAllSalaries);
els.fab.addEventListener('click', simulateDone);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (k === 'd' || k === 'в') toggleAutoplay();
  if (k === 'r' || k === 'к') els.refresh.click();
  if (k === 'n' || k === 'т') openAddEmployee();
  if (k === 'p' || k === 'з') payAllSalaries();
  if (k === '+' || k === '=') simulateDone();
});

// Mock mode: sample event через 1.5с
if (USE_MOCK) {
  els.feedHint.textContent = 'нажми Демо / D / + — пойдут события';
  setTimeout(() => {
    if (!autoplayTimer && feedItems.length === 0 && activeEmps().length > 0) {
      const emp = activeEmps()[0];
      pushFeed({ master: emp.name, service: 'Soch olish', amount: 30000 });
    }
  }, 1500);
}

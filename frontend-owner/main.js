import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || '';
const USE_MOCK = !API_URL;

const els = {
  clients:   document.getElementById('m-clients'),
  revenue:   document.getElementById('m-revenue'),
  low:       document.getElementById('m-low'),
  stockList: document.getElementById('stock-list'),
  stockHint: document.getElementById('stock-hint'),
  date:      document.getElementById('today-date'),
  refresh:   document.getElementById('refresh-btn'),
  status:    document.getElementById('conn-status'),
  statusText: document.querySelector('#conn-status .status-text'),
  srcLabel:  document.getElementById('src-label'),
};

const fmtSum = (n) => new Intl.NumberFormat('ru-RU').format(n ?? 0);
const fmtDate = (d) =>
  d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });

const MOCK_STATE = {
  clientsServed: 3,
  revenue: 95000,
  lowStock: [
    { _id: 'm1', name: "Bo'yoq",  qty: 1, unit: 'tuba',   lowThreshold: 2 },
    { _id: 'm2', name: 'Soqol moyi', qty: 1, unit: 'flakon', lowThreshold: 2 },
  ],
};

function setConnection(state) {
  els.status.classList.remove('is-live', 'is-error');
  if (state === 'live')  { els.status.classList.add('is-live');  els.statusText.textContent = 'live'; }
  else if (state === 'error') { els.status.classList.add('is-error'); els.statusText.textContent = 'нет связи'; }
  else                    { els.statusText.textContent = 'офлайн'; }
}

function pulse(el) {
  el.classList.remove('is-pulse');
  void el.offsetWidth;
  el.classList.add('is-pulse');
}

let prev = { clientsServed: null, revenue: null, low: null };

function render(data) {
  const clients = data.clientsServed ?? 0;
  const revenue = data.revenue ?? 0;
  const low = data.lowStock ?? [];

  if (prev.clientsServed !== null && prev.clientsServed !== clients) pulse(els.clients);
  if (prev.revenue !== null && prev.revenue !== revenue) pulse(els.revenue.parentElement);
  if (prev.low !== null && prev.low !== low.length) pulse(els.low);

  els.clients.textContent = clients;
  els.revenue.textContent = fmtSum(revenue);
  els.low.textContent = low.length;

  if (low.length === 0) {
    els.stockList.innerHTML = `<li class="stock-empty is-ok">Всё в наличии</li>`;
  } else {
    els.stockList.innerHTML = low
      .map(
        (s) => `
          <li class="stock-item">
            <span class="stock-name">${escapeHtml(s.name)}</span>
            <span class="stock-qty">${s.qty} ${escapeHtml(s.unit || '')} · порог ${s.lowThreshold}</span>
            <span class="stock-badge">заканчивается</span>
          </li>`
      )
      .join('');
  }

  prev = { clientsServed: clients, revenue, low: low.length };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function fetchToday() {
  if (USE_MOCK) {
    render(MOCK_STATE);
    els.srcLabel.textContent = 'источник: мок (нет VITE_API_URL)';
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/owner/today`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    render(data);
    els.srcLabel.textContent = `источник: ${API_URL}`;
    setConnection('live');
  } catch (err) {
    console.error('fetchToday failed', err);
    setConnection('error');
    if (prev.clientsServed === null) render(MOCK_STATE);
  }
}

function connectSocket() {
  if (USE_MOCK) return;
  const socket = io(API_URL, { transports: ['websocket', 'polling'], reconnection: true });
  socket.on('connect',    () => setConnection('live'));
  socket.on('disconnect', () => setConnection('offline'));
  socket.on('connect_error', () => setConnection('error'));
  socket.on('queue:update', () => fetchToday());
}

function bindMockDemo() {
  // Клик по метрике «клиенты» в мок-режиме — имитирует событие «done» от мастера,
  // чтобы показать live-анимацию судьям.
  if (!USE_MOCK) return;
  els.clients.parentElement.addEventListener('click', () => {
    MOCK_STATE.clientsServed += 1;
    MOCK_STATE.revenue += 30000;
    if (MOCK_STATE.lowStock.length && Math.random() < 0.4) {
      MOCK_STATE.lowStock[0].qty = Math.max(0, MOCK_STATE.lowStock[0].qty - 1);
    }
    render(MOCK_STATE);
  });
  els.stockHint.textContent = 'демо-режим: тапни «Клиенты обслужено» — имитирует Готово';
}

els.date.textContent = fmtDate(new Date());
els.refresh.addEventListener('click', fetchToday);
fetchToday();
connectSocket();
bindMockDemo();

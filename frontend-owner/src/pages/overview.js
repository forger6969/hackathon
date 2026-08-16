import { el, on, pulse, countUp } from '../core/dom.js';
import { fmt, fmtSum, fmtShort, fmtTime, timeAgo, initials, escapeHtml } from '../core/format.js';
import { app } from '../core/store.js';
import { onEvent } from '../core/socket.js';
import * as api from '../core/api.js';
import { go } from '../router.js';
import { KpiCard } from '../ui/KpiCard.js';
import { StackedAreaChart } from '../ui/StackedAreaChart.js';
import { icons } from '../ui/icons.js';
import { emptyState } from '../ui/Skeleton.js';

const HOURS = Array.from({ length: 13 }, (_, i) => `${9 + i}:00`);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

const STATUS_MAP = {
  waiting:     { ru: 'В очереди',   cls: 'badge--waiting' },
  called:      { ru: 'Вызван',      cls: 'badge--called' },
  in_progress: { ru: 'В работе',    cls: 'badge--in-progress' },
  scheduled:   { ru: 'Запись',      cls: 'badge--scheduled' },
  done:        { ru: 'Готово',      cls: 'badge--done' },
  skipped:     { ru: 'Не пришёл',   cls: 'badge--skipped' },
  cancelled:   { ru: 'Отменён',     cls: 'badge--cancelled' },
};

// Синтетическая волна для sparkline
function seedWave(peak, points = 12) {
  const arr = [];
  for (let i = 0; i < points; i++) {
    const wave = 0.5 + 0.35 * Math.sin(i * 0.9 + peak * 0.01);
    const trend = (i / (points - 1)) * 0.4;
    arr.push(Math.max(0.05, wave + trend) * peak);
  }
  return arr;
}

/** Топ услуг: считаем services через реальный список services + queue */
function topServices(queueItems, services) {
  const byId = Object.fromEntries((services || []).map((s) => [s._id, s]));
  const counts = {};
  queueItems.forEach((it) => {
    if (it.status !== 'done') return;
    // API возвращает serviceId, но не serviceName в /api/queue
    const svc = byId[it.serviceId];
    const name = svc?.name || 'Другое';
    if (!counts[name]) counts[name] = { name, cnt: 0, revenue: 0, color: null };
    counts[name].cnt += 1;
    counts[name].revenue += svc?.price || 0;
  });
  const list = Object.values(counts).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  const max = Math.max(1, ...list.map((x) => x.revenue));
  const palette = ['#3C50E0', '#219653', '#FFA70B', '#259AE6', '#D34053', '#8B5CF6'];
  list.forEach((it, i) => { it.color = palette[i % palette.length]; it.pct = Math.round((it.revenue / max) * 100); });
  return list;
}

/** Агрегация по часам для чарта */
function aggregateByHour(queueItems, services) {
  const byId = Object.fromEntries((services || []).map((s) => [s._id, s]));
  const known = topServices(queueItems, services).map((x) => x.name);
  const SERIES = known.length
    ? known.map((n, i) => ({ name: n, color: ['#3C50E0', '#219653', '#FFA70B', '#259AE6', '#D34053', '#8B5CF6'][i % 6] }))
    : [{ name: 'Услуги', color: '#3C50E0' }];

  const buckets = HOURS.map((label) => ({ label, buckets: Object.fromEntries(SERIES.map((s) => [s.name, 0])) }));
  queueItems.forEach((item) => {
    if (item.status !== 'done') return;
    const svc = byId[item.serviceId];
    const name = svc?.name || 'Услуги';
    const d = new Date(item.doneAt || item.updatedAt || item.createdAt || Date.now());
    const idx = Math.max(0, Math.min(12, d.getHours() - 9));
    if (buckets[idx].buckets[name] !== undefined) buckets[idx].buckets[name] += svc?.price || 0;
  });
  return { data: buckets, series: SERIES };
}

/** Live payments feed: только paid и done */
function paymentsList(queueItems, services) {
  const byId = Object.fromEntries((services || []).map((s) => [s._id, s]));
  return queueItems
    .filter((it) => it.paid || it.status === 'done')
    .map((it) => {
      const svc = byId[it.serviceId];
      const ts = it.doneAt ? new Date(it.doneAt).getTime() : (it.updatedAt ? new Date(it.updatedAt).getTime() : Date.now());
      return {
        clientName: it.clientName,
        masterName: it.masterName || '—',
        serviceName: svc?.name || 'Услуга',
        amount: svc?.price || 0,
        method: it.paymentMethod || null,
        paid: it.paid,
        ts,
      };
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 12);
}

export default function Overview() {
  const s = app.get();
  const today = s.today || {};

  const revenue     = today.revenue || 0;
  const cashRevenue = today.cashRevenue || 0;
  const cardRevenue = today.cardRevenue || 0;
  const clients     = today.clientsServed || 0;
  const avg         = clients ? Math.round(revenue / clients) : 0;
  const onDuty      = today.onDutyMasters || 0;
  const total       = today.totalMasters  || 0;
  const lowCount    = (today.lowStock || []).length;

  // ── Header ─────────────────────────────
  const dateStr = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const header = el('div.page-header', {}, [
    el('div', {}, [
      el('h1.page-title', { text: `${greeting()}, Владелец` }),
      el('p.page-sub', { text: `${dateStr} · ${onDuty} из ${total} мастеров на линии` }),
    ]),
  ]);

  // ── KPI Row ────────────────────────────
  const kpiRevenue = KpiCard({ label: 'Выручка сегодня', value: revenue, unit: 'сум', icon: icons.finance, tone: 'gold',    sparkData: seedWave(revenue || 60_000), sparkColor: '#3C50E0', delay: 0 });
  const kpiClients = KpiCard({ label: 'Клиентов',        value: clients, icon: icons.clients, tone: 'neutral',              sparkData: seedWave(Math.max(clients, 4)), sparkColor: '#219653', delay: 100 });
  const kpiAvg     = KpiCard({ label: 'Средний чек',     value: avg,     unit: 'сум', icon: icons.today,   tone: 'neutral', sparkData: seedWave(avg || 25_000), sparkColor: '#FFA70B', delay: 200 });
  const kpiDuty    = KpiCard({ label: 'На линии',        value: onDuty,  unit: `/ ${total}`, icon: icons.masters, tone: 'neutral', sparkData: seedWave(Math.max(onDuty, 1)), sparkColor: '#259AE6', delay: 300 });
  const kpiLow     = KpiCard({ label: 'Заканчивается',   value: lowCount, icon: icons.warn, tone: 'warn',       sparkData: seedWave(lowCount + 1), sparkColor: '#D34053', delay: 400 });
  const kpiRow = el('section.section-grid.section-grid--kpi', {}, [kpiRevenue, kpiClients, kpiAvg, kpiDuty, kpiLow]);

  // ── Cash/Card split chip row (под KPI) ─
  const cashCardRow = el('div', { style: { display: 'flex', gap: '8px', marginTop: '-8px' } }, [
    el('span.pay-chip.pay-chip--cash', { html: `💵 Наличные · <strong>${fmt(cashRevenue)}</strong> сум` }),
    el('span.pay-chip.pay-chip--card', { html: `💳 Карта · <strong>${fmt(cardRevenue)}</strong> сум` }),
  ]);

  // ── Big Chart + Top services ───────────
  const { data: chartData, series } = aggregateByHour(s.queue || [], s.services);
  const nowHour = new Date().getHours();
  const nowIdx = Math.max(0, Math.min(12, nowHour - 9));
  const chart = StackedAreaChart({ data: chartData, series, nowIdx, W: 720, H: 240 });

  const legend = el('div.legend', {}, series.map((sv) => el('span.legend-item', {}, [
    el('span.legend-swatch', { style: { background: sv.color } }),
    el('span', { text: sv.name }),
  ])));

  const chartCard = el('div.card.chart-rise', { style: { '--d': '540ms' } }, [
    el('header.chart-head', {}, [
      el('div', {}, [
        el('div.eyebrow-sm', { text: 'выручка · по часам' }),
        el('h2.chart-title', { text: 'Смена дня' }),
      ]),
      legend,
    ]),
    el('div.chart-wrap', {}, [chart]),
  ]);

  const topList = el('ul.top-svc-list');
  function renderTopSvc() {
    const top = topServices(app.get().queue || [], app.get().services || []);
    topList.innerHTML = '';
    if (top.length === 0) { topList.append(el('li.top-svc-empty', { text: 'Нет завершённых услуг за сегодня' })); return; }
    top.forEach((it) => {
      topList.append(el('li.top-svc-item', {}, [
        el('span.top-svc-name', { text: it.name }),
        el('span.top-svc-val', { text: `${fmt(it.revenue)} · ${it.cnt}×` }),
        el('div.top-svc-bar', {}, [
          el('div.top-svc-bar-fill', { style: { width: it.pct + '%', background: it.color } }),
        ]),
      ]));
    });
  }
  renderTopSvc();
  const topCard = el('div.card.chart-rise', { style: { '--d': '640ms' } }, [
    el('header.chart-head', {}, [
      el('div', {}, [
        el('div.eyebrow-sm', { text: 'спрос сегодня' }),
        el('h2.chart-title', { text: 'Топ услуг' }),
      ]),
    ]),
    topList,
  ]);

  const chartRow = el('section.chart-row', {}, [chartCard, topCard]);

  // ── Live Queue Preview ─────────────────
  function queuePreview() {
    const items = (app.get().queue || []).filter((q) => ['waiting', 'called', 'in_progress'].includes(q.status)).slice(0, 6);
    if (items.length === 0) {
      return emptyState({ icon: icons.queue({ size: 24 }), title: 'Очередь пуста', description: 'Как только клиент запишется — он появится здесь' });
    }
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
    items.forEach((q, idx) => {
      const st = STATUS_MAP[q.status] || { ru: q.status, cls: 'badge--muted' };
      wrap.append(el('div', {
        style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-2)', border: '1px solid var(--border)' },
      }, [
        el('div.q-pos', { text: String(idx + 1) }),
        el('div', { style: { flex: 1, minWidth: 0 } }, [
          el('div', { text: q.clientName || '—', style: { fontSize: '13px', fontWeight: 600, color: 'var(--text-strong)' } }),
          el('div', { text: `${q.masterName || '—'} · ${q.phone || 'без телефона'}`, style: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: "var(--font-mono)", marginTop: '2px' } }),
        ]),
        el('span', { class: `badge ${st.cls}`, text: st.ru }),
      ]));
    });
    return wrap;
  }

  const queueWrap = el('div');
  queueWrap.append(queuePreview());
  const queueCard = el('div.card.chart-rise', { style: { '--d': '740ms' } }, [
    el('header.chart-head', {}, [
      el('div', {}, [
        el('div.eyebrow-sm', { text: 'реалтайм' }),
        el('h2.chart-title', { text: 'Очередь сейчас' }),
      ]),
      el('button.btn-ghost', {
        style: { height: '32px', padding: '0 12px', fontSize: '12px' },
        on: { click: () => go('/queue') },
        text: 'Открыть →',
      }),
    ]),
    queueWrap,
  ]);

  // ── Active Masters Preview ─────────────
  function mastersPreview() {
    const active = (app.get().masters || []).filter((m) => m.onDuty).slice(0, 5);
    if (active.length === 0) {
      return emptyState({ icon: icons.masters({ size: 24 }), title: 'Никого на линии', description: 'Мастера ещё не вышли на смену' });
    }
    return el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' } }, active.map((m) => (
      el('div', {
        style: { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer' },
        on: { click: () => go('/masters') },
      }, [
        el('div.master-avatar', { text: initials(m.name), style: { width: '40px', height: '40px', fontSize: '14px' } }),
        el('div', { text: m.name, style: { fontSize: '13px', fontWeight: 700, color: 'var(--text-strong)' } }),
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '5px' } }, [
          el('div.dot-online'),
          el('span', { text: 'На линии', style: { fontSize: '10px', color: 'var(--success)', fontWeight: 600 } }),
        ]),
      ])
    )));
  }
  const mastersWrap = el('div');
  mastersWrap.append(mastersPreview());
  const mastersCard = el('div.card.chart-rise', { style: { '--d': '820ms' } }, [
    el('header.chart-head', {}, [
      el('div', {}, [
        el('div.eyebrow-sm', { text: 'команда' }),
        el('h2.chart-title', { text: 'Активные мастера' }),
      ]),
      el('button.btn-ghost', {
        style: { height: '32px', padding: '0 12px', fontSize: '12px' },
        on: { click: () => go('/masters') },
        text: 'Все →',
      }),
    ]),
    mastersWrap,
  ]);

  const liveRow = el('section.section-grid.section-grid--2', {}, [queueCard, mastersCard]);

  // ── Low Stock Banner ───────────────────
  let lowSection = null;
  if (lowCount > 0) {
    const chips = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } }, (today.lowStock || []).map((it) => (
      el('div', { style: { padding: '6px 12px', borderRadius: '8px', background: 'rgba(211,64,83,0.10)', border: '1px solid rgba(211,64,83,0.25)', fontSize: '12px', color: 'var(--danger)', fontWeight: 600 } }, [
        el('span', { text: it.name }),
        el('span', { text: ` · ${it.qty} ${it.unit || ''}`, style: { color: 'var(--text-muted)', fontWeight: 500 } }),
      ])
    )));
    lowSection = el('div.card.alert-card.chart-rise', { style: { '--d': '900ms' } }, [
      el('div.alert-strip'),
      el('div.alert-body', {}, [
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } }, [
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
            el('div.alert-icon', { html: icons.warn({ size: 18 }) }),
            el('div', {}, [
              el('div.eyebrow-sm.eyebrow-sm--warn', { text: 'внимание' }),
              el('div.alert-title', { text: `${lowCount} позиций заканчиваются` }),
            ]),
          ]),
          el('button.btn-ghost', { style: { height: '32px', padding: '0 12px', fontSize: '12px' }, on: { click: () => go('/inventory') }, text: 'Склад →' }),
        ]),
        chips,
      ]),
    ]);
  }

  // ── Payments Feed ──────────────────────
  const paymentsCard = el('div.card.feed-card.chart-rise', { style: { '--d': '980ms' } }, [
    el('header.chart-head', {}, [
      el('div', {}, [
        el('div.eyebrow-sm', { text: 'финансы live' }),
        el('h2.chart-title', { text: 'Оплаты и завершения' }),
      ]),
      el('button.btn-ghost', { style: { height: '32px', padding: '0 12px', fontSize: '12px' }, on: { click: () => go('/finance') }, text: 'Финансы →' }),
    ]),
    el('ul.feed-list', { id: 'payments-feed' }),
  ]);

  function renderPayments() {
    const feed = paymentsCard.querySelector('#payments-feed');
    const items = paymentsList(app.get().queue || [], app.get().services || []);
    feed.innerHTML = '';
    if (items.length === 0) {
      feed.append(el('li.feed-empty', { text: 'Пока никто не оплатил и не завершил услугу — ждём событий' }));
      return;
    }
    items.forEach((it) => {
      const methodChip = it.paid
        ? (it.method === 'card'
          ? '<span class="pay-chip pay-chip--card">💳 карта</span>'
          : '<span class="pay-chip pay-chip--cash">💵 нал</span>')
        : '<span class="pay-chip">завершено · не оплачено</span>';
      feed.append(el('li.feed-item', {}, [
        el('div.feed-avatar', { text: initials(it.masterName) }),
        el('div.feed-text', {}, [
          el('div', { html: `<strong>${escapeHtml(it.clientName)}</strong> · <span class="feed-svc">${escapeHtml(it.serviceName)}</span> · мастер ${escapeHtml(it.masterName)}` }),
          el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' } }, [
            el('span.feed-time', { text: `${fmtTime(it.ts)} · ${timeAgo(it.ts)}` }),
            el('span', { html: methodChip, style: { marginLeft: '4px' } }),
          ]),
        ]),
        el('div.feed-amount', { text: '+' + fmt(it.amount) + ' сум' }),
      ]));
    });
  }
  renderPayments();

  // ── Live events banner (raw feed) ──────
  const eventsCard = el('div.card.feed-card.chart-rise', { style: { '--d': '1060ms' } }, [
    el('header.chart-head', {}, [
      el('div', {}, [
        el('div.eyebrow-sm', { text: 'события' }),
        el('h2.chart-title', { text: 'Что происходит в салоне' }),
      ]),
    ]),
    el('ul.feed-list', { id: 'events-feed' }, [
      el('li.feed-empty', { text: 'Как только произойдёт событие — оно появится здесь' }),
    ]),
  ]);
  const eventItems = [];
  function addEvent(html) {
    const feed = eventsCard.querySelector('#events-feed');
    eventItems.unshift({ html, ts: Date.now() });
    if (eventItems.length > 20) eventItems.pop();
    feed.innerHTML = '';
    eventItems.forEach((it) => {
      feed.append(el('li.feed-item', {}, [
        el('div.feed-dot'),
        el('div.feed-text', {}, [
          el('div', { html: it.html }),
          el('div.feed-time', { text: timeAgo(it.ts) }),
        ]),
      ]));
    });
  }

  // ── Refresh function for socket events ─
  function refreshAll() {
    // KPI card updates
    const s2 = app.get();
    const t2 = s2.today || {};
    kpiRevenue.update({ value: t2.revenue || 0 });
    kpiClients.update({ value: t2.clientsServed || 0 });
    const avg2 = t2.clientsServed ? Math.round(t2.revenue / t2.clientsServed) : 0;
    kpiAvg.update({ value: avg2 });
    kpiDuty.update({ value: t2.onDutyMasters || 0 });
    kpiLow.update({ value: (t2.lowStock || []).length });

    // Cash/Card chips
    cashCardRow.children[0].innerHTML = `💵 Наличные · <strong>${fmt(t2.cashRevenue || 0)}</strong> сум`;
    cashCardRow.children[1].innerHTML = `💳 Карта · <strong>${fmt(t2.cardRevenue || 0)}</strong> сум`;

    // Chart
    const { data, series: s3 } = aggregateByHour(s2.queue || [], s2.services);
    chart.update({ data, series: s3 });

    // Sub-blocks
    renderTopSvc();
    queueWrap.innerHTML = ''; queueWrap.append(queuePreview());
    mastersWrap.innerHTML = ''; mastersWrap.append(mastersPreview());
    renderPayments();
  }

  // Live socket
  const off = onEvent('queue:update', async ({ masterId, queue: q }) => {
    const master = (app.get().masters || []).find((m) => String(m._id) === String(masterId));
    const top = q && q[0];
    if (top && master) {
      const stTag = STATUS_MAP[top.status];
      const paidBit = top.paid
        ? (top.paymentMethod === 'card' ? ' · <span class="pay-chip pay-chip--card">💳 карта</span>' : ' · <span class="pay-chip pay-chip--cash">💵 нал</span>')
        : '';
      addEvent(`<strong>${escapeHtml(master.name)}</strong> · клиент «${escapeHtml(top.clientName)}» → ${stTag ? stTag.ru.toLowerCase() : top.status}${paidBit}`);
    }
    // Полное обновление данных
    try {
      const [t, q2] = await Promise.all([api.owner.today(), api.queue.all()]);
      app.set({ today: t, queue: q2 });
      refreshAll();
    } catch (err) { console.warn('refresh failed', err); }
  });
  window.addEventListener('route:changed', () => off?.(), { once: true });

  // ── Subscribe to store for immediate updates on external refresh ─
  const unsub = app.subscribe(() => refreshAll());
  window.addEventListener('route:changed', () => unsub?.(), { once: true });

  // ── Compose ────────────────────────────
  return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '24px' } }, [
    header,
    kpiRow,
    cashCardRow,
    chartRow,
    liveRow,
    ...(lowSection ? [lowSection] : []),
    paymentsCard,
    eventsCard,
  ]);
}

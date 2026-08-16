import { el } from '../core/dom.js';
import { fmt, fmtSum, fmtShort, fmtTime, timeAgo, initials } from '../core/format.js';
import { app } from '../core/store.js';
import { onEvent } from '../core/socket.js';
import { go } from '../router.js';
import { KpiCard } from '../ui/KpiCard.js';
import { StackedAreaChart } from '../ui/StackedAreaChart.js';
import { icons } from '../ui/icons.js';
import { emptyState, skeleton } from '../ui/Skeleton.js';

const HOURS = Array.from({ length: 13 }, (_, i) => `${9 + i}:00`);
const SERIES = [
  { name: 'Стрижка',  color: '#C9A24E' },
  { name: 'Борода',   color: '#3B9975' },
  { name: 'Укладка',  color: '#EFCE85' },
  { name: 'Другое',   color: '#4EA8B8' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function aggregateByHour(queueItems) {
  const buckets = HOURS.map((label) => ({ label, buckets: Object.fromEntries(SERIES.map((s) => [s.name, 0])) }));
  queueItems.forEach((item) => {
    if (item.status !== 'done') return;
    const d = new Date(item.updatedAt || item.createdAt);
    const h = d.getHours();
    const idx = Math.max(0, Math.min(12, h - 9));
    const svc = SERIES.find((s) => item.serviceName?.includes(s.name)) || SERIES[SERIES.length - 1];
    buckets[idx].buckets[svc.name] += item.servicePrice || 0;
  });
  return buckets;
}

function topServices(queueItems, services) {
  const counts = {};
  queueItems.forEach((item) => {
    if (item.status !== 'done') return;
    const key = item.serviceName || 'Другое';
    counts[key] = (counts[key] || 0) + 1;
  });
  const max = Math.max(1, ...Object.values(counts));
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, cnt]) => ({ name, cnt, pct: Math.round((cnt / max) * 100) }));
}

export default function Overview() {
  const s = app.get();
  const today = s.today || {};

  const revenue   = today.revenue || 0;
  const clients   = today.clientsServed || 0;
  const avg       = clients ? Math.round(revenue / clients) : 0;
  const onDuty    = today.onDutyMasters || 0;
  const total     = today.totalMasters  || 0;
  const lowCount  = (today.lowStock || []).length;

  // KPI cards
  const kpiRevenue  = KpiCard({ label: 'Выручка сегодня', value: revenue, unit: 'сум', icon: icons.finance, tone: 'gold', delay: 0 });
  const kpiClients  = KpiCard({ label: 'Клиентов', value: clients, icon: icons.clients, tone: 'neutral', delay: 120 });
  const kpiAvg      = KpiCard({ label: 'Средний чек', value: avg, unit: 'сум', icon: icons.today, tone: 'neutral', delay: 240 });
  const kpiDuty     = KpiCard({ label: 'Мастеров на линии', value: onDuty, unit: `/ ${total}`, icon: icons.masters, tone: 'neutral', delay: 360 });
  const kpiLow      = KpiCard({ label: 'Заканчивается', value: lowCount, icon: icons.warn, tone: 'warn', delay: 480 });

  const kpiRow = el('div.section-grid.section-grid--kpi', {}, [kpiRevenue, kpiClients, kpiAvg, kpiDuty, kpiLow]);

  // Chart
  const chartData = aggregateByHour(s.queue);
  const nowHour   = new Date().getHours();
  const nowIdx    = Math.max(0, Math.min(12, nowHour - 9));
  const chart     = StackedAreaChart({ data: chartData, series: SERIES, nowIdx, W: 700, H: 220 });

  const legendEl = el('div', { class: 'legend' });
  SERIES.forEach((sv) => {
    legendEl.append(el('span', { style: { display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:'var(--text-muted)' } }, [
      el('span', { style: { width:'8px', height:'8px', borderRadius:'2px', background: sv.color, display:'inline-block' } }),
      sv.name,
    ]));
  });
  legendEl.style.display = 'flex';
  legendEl.style.gap = '12px';
  legendEl.style.flexWrap = 'wrap';

  const chartCard = el('div.card.chart-rise', { style: { '--d': '540ms', flex: '1', minWidth: '0' } }, [
    el('div', { style: { padding: '20px 20px 12px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' } }, [
      el('div', {}, [
        el('div.eyebrow-sm', { text: 'выручка · по часам · разбивка по услугам' }),
        el('h2', { text: 'Смена дня', style: { fontFamily: "'Fraunces',serif", fontSize:'18px', color:'var(--text-strong)', margin:'4px 0 0' } }),
      ]),
      legendEl,
    ]),
    el('div', { style: { padding:'0 20px 20px' } }, [chart]),
  ]);

  // Top services bar list
  const topList = el('ul', { style: { listStyle:'none', padding:'0', margin:'0', display:'flex', flexDirection:'column', gap:'2px' } });
  function renderTopSvc() {
    topList.innerHTML = '';
    const top = topServices(app.get().queue, app.get().services);
    if (!top.length) { topList.append(el('li.feed-empty', { text: 'Нет данных' })); return; }
    top.forEach((item) => {
      topList.append(el('li.bar-row', {}, [
        el('span.bar-label', { text: item.name, style:{ minWidth:'80px', fontSize:'12px' } }),
        el('div.bar-track', {}, [ el('div.bar-fill', { style: { width: item.pct + '%' } }) ]),
        el('span.bar-val', { text: String(item.cnt) + ' раз' }),
      ]));
    });
  }
  renderTopSvc();

  const topCard = el('div.card.chart-rise', { style: { '--d': '660ms', width: '220px', flexShrink: '0', padding: '20px' } }, [
    el('div.section-eyebrow', { text: 'спрос сегодня' }),
    el('div.section-title', { text: 'Топ услуг', style: { marginBottom:'14px' } }),
    topList,
  ]);

  const chartRow = el('div', { style: { display:'flex', gap:'16px', alignItems:'stretch' } }, [chartCard, topCard]);

  // Live queue preview
  function renderQueuePreview() {
    const items = (app.get().queue || []).slice(0, 5);
    if (!items.length) return emptyState({ icon: icons.queue({ size: 24 }), title: 'Очередь пуста', description: 'Клиентов пока нет' });
    const rows = items.map((q) => {
      const statusMap = { waiting:'В ожидании', called:'Вызван', in_progress:'В процессе', scheduled:'Запись', done:'Готово', skipped:'Пропустил', cancelled:'Отменено' };
      const cls = { waiting:'waiting', called:'called', in_progress:'in-progress', scheduled:'scheduled', done:'done', skipped:'skipped', cancelled:'cancelled' }[q.status] || 'waiting';
      return el('div', { style: { display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', borderRadius:'8px', background:'var(--surface-2)', marginBottom:'4px' } }, [
        el('div', { style: { width:'32px', height:'32px', borderRadius:'50%', background:'linear-gradient(135deg,var(--gold-deep),var(--gold-shadow))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700', color:'var(--gold-bright)', flexShrink:'0' } }, [initials(q.clientName || '?')]),
        el('div', { style: { flex:'1', minWidth:'0' } }, [
          el('div', { text: q.clientName || '—', style: { fontSize:'13px', fontWeight:'600', color:'var(--text)' } }),
          el('div', { text: q.masterName || '—', style: { fontSize:'11px', color:'var(--text-dim)', fontFamily:"'JetBrains Mono',monospace" } }),
        ]),
        el('span.badge.badge--' + cls, { text: statusMap[q.status] || q.status }),
      ]);
    });
    return el('div', {}, rows);
  }

  const queueWrap = el('div');
  queueWrap.append(renderQueuePreview());

  const queueCard = el('div.card.chart-rise', { style: { '--d': '720ms', flex: '1' } }, [
    el('div', { style: { padding:'20px 20px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' } }, [
      el('div', {}, [ el('div.section-eyebrow', { text: 'реалтайм' }), el('div.section-title', { text: 'Очередь сейчас' }) ]),
      el('button.btn-ghost', { on: { click: () => go('/queue') }, text: 'Всё →', style:{ fontSize:'12px' } }),
    ]),
    el('div', { style: { padding: '0 12px 12px' } }, [queueWrap]),
  ]);

  // Active masters preview
  function renderMastersPreview() {
    const active = (app.get().masters || []).filter((m) => m.onDuty).slice(0, 4);
    if (!active.length) return emptyState({ icon: icons.masters({ size: 24 }), title: 'Никого на линии', description: 'Мастера ещё не вышли' });
    return el('div', { style: { display:'flex', gap:'10px', flexWrap:'wrap' } }, active.map((m) => {
      return el('div', { style: { background:'var(--surface-2)', borderRadius:'10px', padding:'12px', display:'flex', flexDirection:'column', gap:'6px', minWidth:'110px', flex:'1' } }, [
        el('div.master-avatar', { text: initials(m.name), style:{ width:'36px', height:'36px', fontSize:'13px' } }),
        el('div', { text: m.name, style:{ fontSize:'12px', fontWeight:'600', color:'var(--text)' } }),
        el('div', { style:{ display:'flex', alignItems:'center', gap:'4px' } }, [
          el('div.dot-online'),
          el('span', { text: 'На линии', style:{ fontSize:'10px', color:'var(--emerald-bright)', fontFamily:"'JetBrains Mono',monospace" } }),
        ]),
      ]);
    }));
  }

  const mastersWrap = el('div');
  mastersWrap.append(renderMastersPreview());

  const mastersCard = el('div.card.chart-rise', { style: { '--d': '780ms', flex: '1' } }, [
    el('div', { style: { padding:'20px 20px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' } }, [
      el('div', {}, [ el('div.section-eyebrow', { text: 'команда' }), el('div.section-title', { text: 'Активные мастера' }) ]),
      el('button.btn-ghost', { on: { click: () => go('/masters') }, text: 'Все →', style:{ fontSize:'12px' } }),
    ]),
    el('div', { style: { padding: '0 12px 12px' } }, [mastersWrap]),
  ]);

  const liveRow = el('div', { style: { display:'flex', gap:'16px' } }, [queueCard, mastersCard]);

  // Low stock alert
  const lowItems = today.lowStock || [];
  let lowSection = null;
  if (lowItems.length) {
    const list = el('div', { style: { display:'flex', flexWrap:'wrap', gap:'8px' } }, lowItems.map((item) => {
      return el('div', { style: { padding:'6px 12px', borderRadius:'8px', background:'rgba(110,32,24,0.2)', border:'1px solid rgba(201,86,74,0.2)', fontSize:'12px', color:'var(--garnet-bright)' } }, [
        el('span', { text: item.name, style:{ fontWeight:'600' } }),
        el('span', { text: ` — ${item.qty} ${item.unit}`, style:{ color:'var(--text-muted)' } }),
      ]);
    }));
    lowSection = el('div.alert-banner.card.chart-rise', { style:{ '--d':'840ms', display:'flex', flexDirection:'column', gap:'10px', padding:'16px 20px' } }, [
      el('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center' } }, [
        el('div', { style:{ display:'flex', alignItems:'center', gap:'8px' } }, [
          el('span', { html: icons.warn({ size: 16 }), style:{ color:'var(--garnet-bright)' } }),
          el('span', { text: `${lowItems.length} позиций заканчивается`, style:{ fontSize:'13px', fontWeight:'600' } }),
        ]),
        el('button.btn-ghost', { on: { click: () => go('/inventory') }, text: 'Склад →', style:{ fontSize:'12px' } }),
      ]),
      list,
    ]);
  }

  // Live feed
  const feedItems = [];
  const feedList = el('ul.feed-list', {}, [ el('li.feed-empty', { text: 'Ждём событий из очереди…' }) ]);

  function addFeedItem(text) {
    feedItems.unshift({ text, time: Date.now() });
    if (feedItems.length > 20) feedItems.pop();
    feedList.innerHTML = '';
    feedItems.forEach((item) => {
      feedList.append(el('li.feed-item', {}, [
        el('div.feed-dot'),
        el('div', {}, [
          el('div.feed-text', { text: item.text }),
          el('div.feed-time', { text: timeAgo(item.time) }),
        ]),
      ]));
    });
  }

  const feedCard = el('div.card.chart-rise', { style: { '--d': '900ms' } }, [
    el('div', { style: { padding:'20px 20px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' } }, [
      el('div', {}, [ el('div.section-eyebrow', { text: 'события' }), el('div.section-title', { text: 'Живая лента' }) ]),
    ]),
    el('div', { style: { padding:'0 12px 12px' } }, [feedList]),
  ]);

  // Subscribe to queue updates
  const offQueue = onEvent('queue:update', ({ masterId, queue: q }) => {
    const master = (app.get().masters || []).find((m) => m._id === masterId);
    if (q && q[0]) addFeedItem(`${master?.name || 'Мастер'}: клиент «${q[0].clientName}» — ${q[0].status}`);
    // Refresh queue preview
    queueWrap.innerHTML = '';
    queueWrap.append(renderQueuePreview());
    // Refresh chart
    const data = aggregateByHour(app.get().queue);
    chart.update({ data });
    renderTopSvc();
    mastersWrap.innerHTML = '';
    mastersWrap.append(renderMastersPreview());
  });

  // Unsubscribe when navigating away
  window.addEventListener('route:changed', () => offQueue(), { once: true });

  const headerEl = el('div', { style: { marginBottom: '4px' } }, [
    el('div', { text: greeting() + ', Владелец', style: { fontFamily:"'Fraunces',serif", fontSize:'28px', fontWeight:'500', color:'var(--text-strong)' } }),
    el('div', { text: new Date().toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long' }), style: { fontSize:'14px', color:'var(--text-muted)', marginTop:'4px' } }),
  ]);

  return el('div', { style: { display:'flex', flexDirection:'column', gap:'20px' } }, [
    headerEl,
    kpiRow,
    chartRow,
    liveRow,
    ...(lowSection ? [lowSection] : []),
    feedCard,
  ]);
}

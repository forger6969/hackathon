import { el } from '../core/dom.js';
import { fmt, escapeHtml } from '../core/format.js';
import { app } from '../core/store.js';
import { PageHeader } from '../ui/PageHeader.js';
import { emptyState } from '../ui/Skeleton.js';
import { icons } from '../ui/icons.js';

// Client-side aggregation из app.queue done-items
export default function analyticsPage() {
  const root = el('div');
  root.append(PageHeader({
    eyebrow: 'бизнес',
    title: 'Аналитика',
    subtitle: 'Пиковые часы, топ услуг, retention',
  }));

  const grid = el('div.section-grid.section-grid--2');
  root.append(grid);

  const doneItems = (app.get().queue || []).filter((i) => i.status === 'done' || i.paid);

  // Peak hours
  const peakCard = el('section.card', { style: { padding: '24px' } });
  peakCard.append(peakHours(doneItems));
  grid.append(peakCard);

  // Revenue by service
  const svcCard = el('section.card', { style: { padding: '24px' } });
  svcCard.append(revenueBy(doneItems, 'serviceName', 'Услуги'));
  grid.append(svcCard);

  // Revenue by master
  const masterCard = el('section.card', { style: { padding: '24px' } });
  masterCard.append(revenueBy(doneItems, 'masterName', 'Мастера'));
  grid.append(masterCard);

  // Retention
  const retentionCard = el('section.card', { style: { padding: '24px' } });
  retentionCard.append(retention(doneItems));
  grid.append(retentionCard);

  return root;
}

function peakHours(items) {
  const wrap = el('div');
  wrap.append(el('div.eyebrow-sm', { text: 'пиковые часы' }), el('h2.chart-title', { text: 'Когда больше клиентов' }));
  if (items.length === 0) { wrap.append(emptyState({ icon: icons.analytics({ size: 24 }), title: 'Нет данных', description: 'Аналитика появится после первых завершённых услуг' })); return wrap; }
  const hours = Array.from({ length: 13 }, () => 0);
  items.forEach((it) => {
    const d = new Date(it.updatedAt || it.createdAt);
    const idx = Math.max(0, Math.min(12, d.getHours() - 9));
    hours[idx]++;
  });
  const max = Math.max(1, ...hours);
  const bars = el('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${hours.length}, 1fr)`, gap: '4px', alignItems: 'end', height: '160px', marginTop: '20px' } });
  hours.forEach((v, i) => {
    const h = Math.max(2, (v / max) * 100);
    const bar = el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' } }, [
      el('div', { style: { height: `${h}%`, width: '100%', maxWidth: '20px', background: 'linear-gradient(180deg,var(--gold-bright),var(--gold))', borderRadius: '4px 4px 0 0', transition: 'height .8s' } }),
      el('div', { style: { color: 'var(--text-dim)', fontSize: '10px', fontFamily: 'var(--font-mono)' }, text: `${9 + i}` }),
    ]);
    bars.append(bar);
  });
  wrap.append(bars);
  return wrap;
}

function revenueBy(items, key, title) {
  const wrap = el('div');
  wrap.append(el('div.eyebrow-sm', { text: 'выручка' }), el('h2.chart-title', { text: title }));
  if (items.length === 0) { wrap.append(emptyState({ icon: icons.analytics({ size: 24 }), title: 'Нет данных' })); return wrap; }
  const agg = {};
  items.forEach((it) => {
    const k = it[key] || '—';
    agg[k] = (agg[k] || 0) + (it.servicePrice || 0);
  });
  const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = Math.max(1, ...sorted.map((e) => e[1]));
  const list = el('ul.top-svc-list', { style: { marginTop: '16px' } });
  sorted.forEach(([name, val]) => {
    const pct = Math.round((val / max) * 100);
    list.append(el('li.top-svc-item', {}, [
      el('span.top-svc-name', { text: name }),
      el('span.top-svc-val', { text: fmt(val) + ' сум' }),
      el('div.top-svc-bar', {}, [
        el('div.top-svc-bar-fill', { style: { width: pct + '%', background: 'linear-gradient(90deg,var(--gold),var(--gold-bright))' } }),
      ]),
    ]));
  });
  wrap.append(list);
  return wrap;
}

function retention(items) {
  const wrap = el('div');
  wrap.append(el('div.eyebrow-sm', { text: 'клиенты' }), el('h2.chart-title', { text: 'Возвращаемость' }));
  const visits = {};
  items.forEach((it) => { const k = it.phone || it.clientName; visits[k] = (visits[k] || 0) + 1; });
  const total = Object.keys(visits).length;
  const repeat = Object.values(visits).filter((v) => v > 1).length;
  const pct = total > 0 ? Math.round((repeat / total) * 100) : 0;

  if (total === 0) { wrap.append(emptyState({ icon: icons.clients({ size: 24 }), title: 'Нет клиентов' })); return wrap; }

  wrap.append(el('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '20px' } }, [
    el('div', { style: { color: 'var(--gold-bright)', fontFamily: 'var(--font-num)', fontSize: '56px', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }, text: pct + '%' }),
    el('div', { style: { color: 'var(--text-muted)', fontSize: '13px' } }, [`${repeat} из ${total} клиентов вернулись`]),
  ]));
  return wrap;
}

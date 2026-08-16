import { el, on, pulse, countUp } from '../core/dom.js';
import { fmt, fmtSum, fmtShort, fmtTime, timeAgo, initials, escapeHtml } from '../core/format.js';
import { app } from '../core/store.js';
import { onEvent } from '../core/socket.js';
import * as api from '../core/api.js';
import { go } from '../router.js';
import { icons } from '../ui/icons.js';
import { emptyState } from '../ui/Skeleton.js';

// ═════════════════════════════════════════════
// TozaMap-стиль владельческого дашборда:
// Navbar → KPI Row (5) → Pipeline Kanban → Alerts/Scheduled → Workload+Recent
// ═════════════════════════════════════════════

const STATUS = {
  scheduled:   { ru: 'Записан',       cls: 'badge--teal' },
  waiting:     { ru: 'Ждёт',          cls: 'badge--waiting' },
  called:      { ru: 'Вызван',        cls: 'badge--called' },
  in_progress: { ru: 'В работе',      cls: 'badge--in-progress' },
  done:        { ru: 'Готово',        cls: 'badge--done' },
  skipped:     { ru: 'Не пришёл',     cls: 'badge--skipped' },
  cancelled:   { ru: 'Отменён',       cls: 'badge--cancelled' },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function svcOf(id, services) {
  return services.find((s) => s._id === id);
}

export default function Overview() {
  const state = app.get();
  const today = state.today || {};
  const services = state.services || [];
  const masters = state.masters || [];
  const queue = state.queue || [];

  const revenue     = today.revenue || 0;
  const cashRevenue = today.cashRevenue || 0;
  const cardRevenue = today.cardRevenue || 0;
  const clients     = today.clientsServed || 0;
  const onDuty      = today.onDutyMasters || 0;
  const total       = today.totalMasters  || 0;
  const lowCount    = (today.lowStock || []).length;
  const activeQueue = queue.filter((q) => ['waiting', 'called', 'in_progress', 'scheduled'].includes(q.status)).length;

  // ── Navbar (page-header) ───────────────
  const dateStr = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const header = el('header.dash-navbar', {}, [
    el('div', {}, [
      el('h1.dash-navbar-title', { text: `${greeting()}, Владелец` }),
      el('p.dash-navbar-sub', { text: `${dateStr} · живое состояние салона` }),
    ]),
    el('div', { style: { display: 'flex', gap: '10px' } }, [
      api.isDemo() ? el('span.demo-badge', {}, ['DEMO · Atlas не подключен']) : null,
      el('button.btn-primary', { on: { click: () => go('/queue') } }, [icons.queue({ size: 14 }), el('span', { text: 'Открыть очередь' })]),
    ]),
  ]);

  // ── KPI Row (TozaMap 5-column) ─────────
  const kpiRow = el('section.kpi5', {}, [
    statCard({ icon: icons.clients, label: 'Клиентов сегодня', value: fmt(clients), hint: 'за смену',      accent: 'accent-blue' }),
    statCard({ icon: icons.finance, label: 'Выручка сегодня',  value: fmt(revenue) + ' сум', hint: `💵 ${fmt(cashRevenue)} · 💳 ${fmt(cardRevenue)}`, accent: 'accent-emerald', positive: true }),
    statCard({ icon: icons.masters, label: 'Мастеров на линии', value: `${onDuty}`, hint: `из ${total} всего`, accent: 'accent-teal' }),
    statCard({ icon: icons.queue,   label: 'В очереди сейчас', value: fmt(activeQueue), hint: `waiting + scheduled`, accent: 'accent-amber' }),
    statCard({ icon: icons.warn,    label: 'Заканчивается склад', value: fmt(lowCount), hint: lowCount > 0 ? 'нужно докупить' : 'всё в порядке', accent: lowCount > 0 ? 'accent-danger' : 'accent-muted', alert: lowCount > 0 }),
  ]);

  // ── Pipeline (Kanban 4 columns) ────────
  const pipeCols = [
    { key: 'scheduled',   label: 'Записаны',   sublabel: 'ждут своего времени',       icon: icons.appointments, accent: 'accent-teal' },
    { key: 'waiting',     label: 'В очереди',  sublabel: 'пришли, ждут мастера',      icon: icons.queue,        accent: 'accent-blue' },
    { key: 'in_progress', label: 'В работе',   sublabel: 'мастер стрижёт прямо сейчас', icon: icons.masters,    accent: 'accent-emerald' },
    { key: 'done',        label: 'Готово',     sublabel: 'обслужены сегодня',          icon: icons.check,       accent: 'accent-muted' },
  ];
  const totalPipeline = queue.filter((q) => ['scheduled', 'waiting', 'called', 'in_progress'].includes(q.status)).length;

  const pipelineSection = el('section.dash-section', {}, [
    el('header.dash-section-head', {}, [
      el('div', {}, [
        el('h2.dash-section-title', { text: 'Pipeline салона' }),
        el('p.dash-section-sub', { text: `${totalPipeline} активных клиентов в обработке · ${clients} завершено` }),
      ]),
      el('button.btn-ghost', { on: { click: () => go('/queue') } }, ['Все →']),
    ]),
    el('div.kanban', {}, pipeCols.map((col) => {
      // Для in_progress включаем called
      const filter = col.key === 'in_progress'
        ? (q) => q.status === 'in_progress' || q.status === 'called'
        : (q) => q.status === col.key;
      const items = queue.filter(filter).slice(0, 5);
      const count = queue.filter(filter).length;
      return kanbanCol(col, items, count, services, masters);
    })),
  ]);

  // ── Alerts row: low stock + scheduled today ─
  const scheduledToday = queue
    .filter((q) => q.status === 'scheduled' && q.scheduledFor)
    .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
    .slice(0, 5);

  const alertsRow = el('section.section-grid.section-grid--2', {}, [
    // Low stock
    el('div.dash-card', {}, [
      el('header.dash-card-head', { class: ['dash-card-head--warn'] }, [
        el('div.dash-card-icon', { class: ['dash-card-icon--warn'], html: icons.warn({ size: 18 }) }),
        el('div', { style: { flex: 1 } }, [
          el('h3', { text: 'Заканчивается на складе', style: { margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-strong)' } }),
          el('p', { text: 'Позвонить поставщику и заказать', style: { margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' } }),
        ]),
        el('span.dash-count-badge', { class: ['dash-count-badge--warn'], text: String(lowCount) }),
      ]),
      lowCount === 0
        ? el('div', { style: { padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' } }, ['Всё в наличии 👍'])
        : el('ul.dash-list', {}, (today.lowStock || []).map((s) => el('li.dash-list-item', {}, [
            el('div', { style: { flex: 1 } }, [
              el('div', { text: s.name, style: { fontSize: '13px', fontWeight: 600, color: 'var(--text-strong)' } }),
              el('div', { text: `порог ${s.lowThreshold} ${s.unit || ''}`, style: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' } }),
            ]),
            el('div', { style: { textAlign: 'right' } }, [
              el('div', { text: `${s.qty}`, style: { fontSize: '15px', fontWeight: 700, color: 'var(--danger)', fontVariantNumeric: 'tabular-nums' } }),
              el('div', { text: 'осталось', style: { fontSize: '10px', color: 'var(--text-muted)' } }),
            ]),
          ]))),
    ]),

    // Scheduled today
    el('div.dash-card', {}, [
      el('header.dash-card-head', {}, [
        el('div.dash-card-icon', { class: ['dash-card-icon--teal'], html: icons.appointments({ size: 18 }) }),
        el('div', { style: { flex: 1 } }, [
          el('h3', { text: 'Записи на сегодня', style: { margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-strong)' } }),
          el('p', { text: 'клиенты придут в определённое время', style: { margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' } }),
        ]),
        el('span.dash-count-badge', { text: String(scheduledToday.length) }),
      ]),
      scheduledToday.length === 0
        ? el('div', { style: { padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' } }, ['Записей нет'])
        : el('ul.dash-list', {}, scheduledToday.map((q) => el('li.dash-list-item', {}, [
            el('div.dash-time-chip', {}, [
              el('div', { text: fmtTime(q.scheduledFor), style: { fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' } }),
            ]),
            el('div', { style: { flex: 1, minWidth: 0 } }, [
              el('div', { text: q.clientName, style: { fontSize: '13px', fontWeight: 600, color: 'var(--text-strong)' } }),
              el('div', { text: `${q.masterName || '—'} · ${svcOf(q.serviceId, services)?.name || '—'}`, style: { fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' } }),
            ]),
          ]))),
    ]),
  ]);

  // ── Workload (по мастерам, чтоб видеть кто загружен) + Recent orders ─
  const perMaster = {};
  masters.forEach((m) => { perMaster[m._id] = { master: m, done: 0, revenue: 0, waiting: 0 }; });
  queue.forEach((q) => {
    const rec = perMaster[q.masterId];
    if (!rec) return;
    if (q.status === 'done') { rec.done++; rec.revenue += svcOf(q.serviceId, services)?.price || 0; }
    if (['waiting', 'called', 'in_progress'].includes(q.status)) rec.waiting++;
  });
  const workloadList = Object.values(perMaster).sort((a, b) => b.done - a.done);
  const maxDone = Math.max(1, ...workloadList.map((w) => w.done));

  const workloadRecent = el('section.section-grid', { style: { gridTemplateColumns: '1fr 1.5fr' } }, [
    // Workload
    el('div.dash-card', {}, [
      el('header.dash-card-head-simple', {}, [
        el('h3', { text: 'Нагрузка мастеров', style: { margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-strong)' } }),
        el('p', { text: 'клиентов сегодня · выручка', style: { margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' } }),
      ]),
      workloadList.length === 0
        ? el('div', { style: { padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' } }, ['Пока никто не отработал'])
        : el('ul.dash-list', {}, workloadList.slice(0, 8).map((w) => {
            const pct = Math.round((w.done / maxDone) * 100);
            return el('li.dash-workload-row', {
              on: { click: () => go('/masters') },
              style: { cursor: 'pointer' },
            }, [
              el('div.dash-workload-avatar', { text: initials(w.master.name) }),
              el('div', { style: { flex: 1, minWidth: 0 } }, [
                el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' } }, [
                  el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
                    el('span', { text: w.master.name, style: { fontSize: '13px', fontWeight: 600, color: 'var(--text-strong)' } }),
                    w.master.onDuty ? el('span.dot-online') : null,
                  ]),
                  el('span', { text: `${w.done} · ${fmtShort(w.revenue)}`, style: { fontSize: '12px', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' } }),
                ]),
                el('div.dash-progress', {}, [
                  el('div.dash-progress-fill', { style: { width: pct + '%' } }),
                ]),
              ]),
            ]);
          })),
    ]),

    // Recent orders
    el('div.dash-card', {}, [
      el('header.dash-card-head-simple', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
        el('div', {}, [
          el('h3', { text: 'Последние транзакции', style: { margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-strong)' } }),
          el('p', { text: 'клиенты, оплаты, статусы', style: { margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' } }),
        ]),
        el('button.dash-link', { on: { click: () => go('/finance') } }, ['Финансы →']),
      ]),
      (() => {
        const recent = queue
          .filter((q) => q.status === 'done' || q.paid)
          .sort((a, b) => new Date(b.doneAt || b.updatedAt || 0) - new Date(a.doneAt || a.updatedAt || 0))
          .slice(0, 8);
        if (recent.length === 0) return el('div', { style: { padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' } }, ['Пока нет транзакций']);
        return el('table.dash-table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { text: 'Клиент' }),
            el('th', { text: 'Услуга · Мастер' }),
            el('th', { class: 'col-r', text: 'Сумма' }),
            el('th', { class: 'col-r', text: 'Оплата' }),
            el('th', { class: 'col-r', text: 'Время' }),
          ])]),
          el('tbody', {}, recent.map((q) => {
            const svc = svcOf(q.serviceId, services);
            const ts = q.doneAt || q.updatedAt || q.createdAt;
            return el('tr', { on: { click: () => go('/queue') }, style: { cursor: 'pointer' } }, [
              el('td', { html: `<div style="display:flex;align-items:center;gap:8px"><div class="dash-tiny-avatar">${escapeHtml(initials(q.clientName))}</div><span style="font-weight:600;color:var(--text-strong)">${escapeHtml(q.clientName)}</span></div>` }),
              el('td', { html: `<div style="font-size:12.5px">${escapeHtml(svc?.name || '—')}</div><div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px">${escapeHtml(q.masterName || '—')}</div>` }),
              el('td', { class: 'col-r col-mono', html: `<strong style="color:var(--text-strong)">${fmt(svc?.price || 0)}</strong>` }),
              el('td', { class: 'col-r', html: q.paid
                ? (q.paymentMethod === 'card' ? '<span class="pay-chip pay-chip--card">💳 карта</span>' : '<span class="pay-chip pay-chip--cash">💵 нал</span>')
                : '<span class="pay-chip">не оплачено</span>' }),
              el('td', { class: 'col-r col-mono', style: { color: 'var(--text-muted)' }, text: ts ? fmtTime(ts) : '—' }),
            ]);
          })),
        ]);
      })(),
    ]),
  ]);

  // ── Live socket rewrite ─
  const off = onEvent('queue:update', async () => {
    try {
      const [t, q2] = await Promise.all([api.owner.today(), api.queue.all()]);
      app.set({ today: t, queue: q2 });
    } catch (err) {}
  });
  window.addEventListener('route:changed', () => off?.(), { once: true });

  return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '24px' } }, [
    header,
    kpiRow,
    pipelineSection,
    alertsRow,
    workloadRecent,
  ]);
}

// ── Helpers ────────────────────────────────────
function statCard({ icon, label, value, hint, accent, positive, alert }) {
  return el('div.dash-stat-card', { class: [alert ? 'is-alert' : ''] }, [
    el('div.dash-stat-head', {}, [
      el('div.dash-stat-text', {}, [
        el('p.dash-stat-label', { text: label }),
        el('p.dash-stat-value', { text: value }),
      ]),
      el('div', { class: `dash-stat-icon ${accent}`, html: icon({ size: 16 }) }),
    ]),
    el('p', { class: `dash-stat-hint${positive ? ' is-positive' : ''}${alert ? ' is-alert' : ''}`, text: hint }),
  ]);
}

function kanbanCol(col, items, count, services, masters) {
  const svcById = Object.fromEntries(services.map((s) => [s._id, s]));
  return el('div.kanban-col', {}, [
    el('header', { class: `kanban-col-head ${col.accent}` }, [
      el('div.kanban-col-icon', { html: col.icon({ size: 18 }) }),
      el('div', { style: { flex: 1 } }, [
        el('div.kanban-col-title', {}, [
          el('span', { text: col.label }),
          el('span.kanban-col-count', { text: String(count) }),
        ]),
        el('div.kanban-col-sub', { text: col.sublabel }),
      ]),
    ]),
    el('ul.kanban-list', {}, items.length === 0
      ? [el('li.kanban-empty', { text: 'Пусто' })]
      : items.map((q) => {
          const svc = svcById[q.serviceId];
          return el('li.kanban-item', {}, [
            el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' } }, [
              el('div', { style: { flex: 1, minWidth: 0 } }, [
                el('div', { text: q.clientName, style: { fontSize: '13px', fontWeight: 600, color: 'var(--text-strong)' } }),
                el('div', { text: `${q.masterName || '—'} · ${svc?.name || '—'}`, style: { fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' } }),
              ]),
              el('div', { style: { textAlign: 'right', flexShrink: 0 } }, [
                el('div', { text: fmt(svc?.price || 0), style: { fontSize: '13px', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' } }),
                q.scheduledFor ? el('div', { text: fmtTime(q.scheduledFor), style: { fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' } }) : null,
                q.paid ? el('div', { html: q.paymentMethod === 'card' ? '💳' : '💵', style: { fontSize: '10px', marginTop: '2px' } }) : null,
              ]),
            ]),
          ]);
        })),
  ]);
}

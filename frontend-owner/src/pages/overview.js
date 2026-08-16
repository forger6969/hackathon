import { el, on } from '../core/dom.js';
import { fmt, fmtSum, fmtShort, fmtTime, timeAgo, initials, escapeHtml } from '../core/format.js';
import { app } from '../core/store.js';
import { onEvent } from '../core/socket.js';
import * as api from '../core/api.js';
import { go } from '../router.js';
import { icons } from '../ui/icons.js';

/* ═════════════════════════════════════════════════════════════════════
   Overview для владельца парикмахерской.
   Убрал Kanban — вместо него карточки мастеров (у каждого своя очередь),
   Hero-выручка, живая касса, ближайшие записи, топ услуг, склад.
   ═════════════════════════════════════════════════════════════════════ */

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}
const svcOf = (id, services) => services.find((s) => s._id === id);

export default function Overview() {
  const S = app.get();
  const today = S.today || {};
  const services = S.services || [];
  const masters = S.masters || [];
  const queue = S.queue || [];

  const revenue     = today.revenue || 0;
  const cashRevenue = today.cashRevenue || 0;
  const cardRevenue = today.cardRevenue || 0;
  const clients     = today.clientsServed || 0;
  const avg         = clients > 0 ? Math.round(revenue / clients) : 0;
  const onDuty      = today.onDutyMasters || 0;
  const total       = today.totalMasters  || 0;
  const lowCount    = (today.lowStock || []).length;

  // ── Navbar ─────────────────────────────
  const dateStr = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const header = el('header.dash-navbar', {}, [
    el('div', {}, [
      el('h1.dash-navbar-title', { text: `${greeting()}, Владелец` }),
      el('p.dash-navbar-sub', { text: `${dateStr} · Salon ${(S.salons?.[0]?.name) || '—'}` }),
    ]),
    el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, [
      api.isDemo() ? el('span.demo-badge', {}, ['DEMO']) : null,
      el('button.btn-ghost', { on: { click: () => go('/analytics') } }, [el('span', { html: icons.analytics({ size: 14 }) }), el('span', { text: 'Отчёт' })]),
      el('button.btn-primary', { on: { click: () => go('/queue') } }, [el('span', { html: icons.queue({ size: 14 }) }), el('span', { text: 'Живая очередь' })]),
    ]),
  ]);

  // ── HERO: большая касса + мини-KPI ──
  const hero = el('section.hero-revenue', {}, [
    el('div.hero-revenue-main', {}, [
      el('div.hero-revenue-eyebrow', { text: 'Касса за сегодня' }),
      el('div.hero-revenue-value', {}, [
        el('span.hero-revenue-num', { text: fmt(revenue) }),
        el('span.hero-revenue-unit', { text: 'сум' }),
      ]),
      el('div.hero-revenue-split', {}, [
        el('div.hero-split-chip', {}, [
          el('span.hero-split-icon.hero-split-icon--cash', { text: '💵' }),
          el('div', {}, [
            el('div.hero-split-label', { text: 'Наличные' }),
            el('div.hero-split-val', { text: fmt(cashRevenue) + ' сум' }),
          ]),
        ]),
        el('div.hero-split-chip', {}, [
          el('span.hero-split-icon.hero-split-icon--card', { text: '💳' }),
          el('div', {}, [
            el('div.hero-split-label', { text: 'Картой' }),
            el('div.hero-split-val', { text: fmt(cardRevenue) + ' сум' }),
          ]),
        ]),
      ]),
    ]),
    el('div.hero-revenue-side', {}, [
      miniKpi({ label: 'Клиентов сегодня',   value: fmt(clients),   sub: `средний чек ${fmtShort(avg)} сум` }),
      miniKpi({ label: 'Мастеров на линии',   value: `${onDuty}/${total}`, sub: `${total - onDuty} свободны` }),
      miniKpi({ label: 'Заканчивается склад', value: fmt(lowCount),  sub: lowCount ? 'нужно докупить' : 'всё есть', tone: lowCount ? 'danger' : 'ok' }),
    ]),
  ]);

  // ── Мастера сейчас (главная фича парикмахерской) ─
  const mastersSection = el('section.dash-section', {}, [
    el('header.dash-section-head', {}, [
      el('div', {}, [
        el('h2.dash-section-title', { text: 'Мастера прямо сейчас' }),
        el('p.dash-section-sub', { text: `Кто занят, кто свободен, у кого сколько клиентов ждут` }),
      ]),
      el('button.dash-link', { on: { click: () => go('/masters') } }, ['Все мастера →']),
    ]),
    el('div.masters-live-grid', {}, masters.map((m) => masterLiveCard(m, queue, services))),
  ]);

  // ── Ближайшие записи + Топ услуг ──
  const scheduledSoon = queue
    .filter((q) => q.status === 'scheduled' && q.scheduledFor)
    .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
    .slice(0, 6);

  const svcCounts = {};
  queue.forEach((q) => {
    if (q.status !== 'done') return;
    const svc = svcOf(q.serviceId, services);
    if (!svc) return;
    if (!svcCounts[svc._id]) svcCounts[svc._id] = { name: svc.name, price: svc.price, cnt: 0, revenue: 0 };
    svcCounts[svc._id].cnt += 1;
    svcCounts[svc._id].revenue += svc.price;
  });
  const topSvc = Object.values(svcCounts).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  const maxSvcRev = Math.max(1, ...topSvc.map((x) => x.revenue));

  const twoCol = el('section.section-grid', { style: { gridTemplateColumns: '1.35fr 1fr', gap: '20px' } }, [
    // Ближайшие записи
    el('div.dash-card-clean', {}, [
      el('header.dash-clean-head', {}, [
        el('div', {}, [
          el('div.dash-clean-eyebrow', { text: 'на потом' }),
          el('h3.dash-clean-title', { text: 'Ближайшие записи' }),
        ]),
        el('span.dash-clean-badge', { text: `${scheduledSoon.length}` }),
      ]),
      scheduledSoon.length === 0
        ? el('div.dash-empty', { text: 'Пока никто не записался вперёд' })
        : el('ul.dash-clean-list', {}, scheduledSoon.map((q) => {
            const svc = svcOf(q.serviceId, services);
            return el('li.dash-clean-item', {}, [
              el('div.time-chip', {}, [el('span', { text: fmtTime(q.scheduledFor) })]),
              el('div', { style: { flex: 1, minWidth: 0 } }, [
                el('div', { text: q.clientName, style: { fontSize: '13px', fontWeight: 700, color: 'var(--text-strong)' } }),
                el('div', { text: `${q.masterName} · ${svc?.name || '—'}`, style: { fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' } }),
              ]),
              el('div', { style: { textAlign: 'right' } }, [
                el('div', { text: fmt(svc?.price || 0), style: { fontSize: '13px', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' } }),
                el('div', { text: 'сум', style: { fontSize: '10px', color: 'var(--text-muted)' } }),
              ]),
            ]);
          })),
    ]),

    // Топ услуг
    el('div.dash-card-clean', {}, [
      el('header.dash-clean-head', {}, [
        el('div', {}, [
          el('div.dash-clean-eyebrow', { text: 'спрос' }),
          el('h3.dash-clean-title', { text: 'Топ услуг сегодня' }),
        ]),
      ]),
      topSvc.length === 0
        ? el('div.dash-empty', { text: 'Ещё нет завершённых услуг' })
        : el('div.top-svc-fine', {}, topSvc.map((s, i) => el('div.top-svc-fine-row', {}, [
            el('div.top-svc-fine-rank', { text: String(i + 1) }),
            el('div', { style: { flex: 1, minWidth: 0 } }, [
              el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' } }, [
                el('span', { text: s.name, style: { fontSize: '13px', fontWeight: 600, color: 'var(--text-strong)' } }),
                el('span', { html: `<span style="color:var(--text-strong);font-weight:700">${fmt(s.revenue)}</span> · <span style="color:var(--text-muted)">${s.cnt}×</span>`, style: { fontSize: '12px', fontVariantNumeric: 'tabular-nums' } }),
              ]),
              el('div.dash-progress', {}, [el('div.dash-progress-fill', { style: { width: Math.round((s.revenue / maxSvcRev) * 100) + '%' } })]),
            ]),
          ]))),
    ]),
  ]);

  // ── Живая касса (payments feed) + Склад ─
  const payments = queue
    .filter((q) => q.status === 'done' || q.paid)
    .sort((a, b) => new Date(b.doneAt || b.updatedAt || 0) - new Date(a.doneAt || a.updatedAt || 0))
    .slice(0, 10);

  const paymentsAndStock = el('section.section-grid', { style: { gridTemplateColumns: '1.35fr 1fr', gap: '20px' } }, [
    // Live payments
    el('div.dash-card-clean', {}, [
      el('header.dash-clean-head', {}, [
        el('div', {}, [
          el('div.dash-clean-eyebrow.dash-clean-eyebrow--live', {}, [el('span.live-pulse'), el('span', { text: 'live' })]),
          el('h3.dash-clean-title', { text: 'Живая касса' }),
        ]),
        el('button.dash-link', { on: { click: () => go('/finance') } }, ['Финансы →']),
      ]),
      payments.length === 0
        ? el('div.dash-empty', { text: 'Пока никто не оплатил — ждём завершений услуг' })
        : el('ul.payments-feed', {}, payments.map((q) => {
            const svc = svcOf(q.serviceId, services);
            const ts = q.doneAt || q.updatedAt || q.createdAt;
            return el('li.payment-row', {}, [
              el('div.payment-avatar', { text: initials(q.masterName) }),
              el('div', { style: { flex: 1, minWidth: 0 } }, [
                el('div', { html: `<strong style="color:var(--text-strong)">${escapeHtml(q.clientName)}</strong> · <span style="color:var(--text-secondary)">${escapeHtml(svc?.name || '—')}</span>`, style: { fontSize: '13px' } }),
                el('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' } }, [
                  el('span', { text: `${q.masterName || '—'}`, style: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' } }),
                  el('span', { text: '·', style: { color: 'var(--text-muted)' } }),
                  el('span', { text: `${fmtTime(ts)} · ${timeAgo(new Date(ts).getTime())}`, style: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' } }),
                  q.paid
                    ? el('span', { class: q.paymentMethod === 'card' ? 'pay-chip pay-chip--card' : 'pay-chip pay-chip--cash', text: q.paymentMethod === 'card' ? '💳 карта' : '💵 нал' })
                    : el('span.pay-chip', { text: 'не оплачено' }),
                ]),
              ]),
              el('div.payment-amount', { text: '+' + fmt(svc?.price || 0) }),
            ]);
          })),
    ]),

    // Склад
    el('div.dash-card-clean', {}, [
      el('header.dash-clean-head', {}, [
        el('div', {}, [
          el('div.dash-clean-eyebrow', { class: [lowCount > 0 ? 'dash-clean-eyebrow--warn' : ''], text: lowCount > 0 ? 'внимание' : 'склад' }),
          el('h3.dash-clean-title', { text: lowCount > 0 ? 'Заканчивается' : 'Всё в порядке' }),
        ]),
        el('button.dash-link', { on: { click: () => go('/inventory') } }, ['Склад →']),
      ]),
      lowCount === 0
        ? el('div.dash-empty', { style: { color: 'var(--success)' } }, ['Все позиции в норме 👍'])
        : el('ul.dash-clean-list', {}, (today.lowStock || []).map((s) => {
            const pct = Math.max(4, Math.min(100, (s.qty / Math.max(1, s.lowThreshold)) * 100));
            return el('li.stock-row', {}, [
              el('div', { style: { flex: 1, minWidth: 0 } }, [
                el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' } }, [
                  el('span', { text: s.name, style: { fontSize: '13px', fontWeight: 700, color: 'var(--text-strong)' } }),
                  el('span', { html: `<span style="color:var(--danger);font-weight:700">${s.qty}</span> <span style="color:var(--text-muted)">/ ${s.lowThreshold} ${escapeHtml(s.unit || '')}</span>`, style: { fontSize: '12px', fontVariantNumeric: 'tabular-nums' } }),
                ]),
                el('div.stock-progress-thin', {}, [el('div.stock-progress-thin-fill', { style: { width: pct + '%' } })]),
              ]),
            ]);
          })),
    ]),
  ]);

  // ── Socket live update ─
  const off = onEvent('queue:update', async () => {
    try {
      const [t, q] = await Promise.all([api.owner.today(), api.queue.all()]);
      app.set({ today: t, queue: q });
    } catch {}
  });
  window.addEventListener('route:changed', () => off?.(), { once: true });

  const wrap = el('div.overview-page', { style: { display: 'flex', flexDirection: 'column', gap: '32px' } }, [
    header,
    hero,
    mastersSection,
    twoCol,
    paymentsAndStock,
  ]);
  // Staggered fade-in animation
  wrap.querySelectorAll('.hero-revenue, .dash-section, .section-grid').forEach((node, i) => {
    node.style.opacity = '0';
    node.style.transform = 'translateY(10px)';
    node.style.transition = 'opacity .5s ease, transform .5s cubic-bezier(.2,.7,.2,1)';
    setTimeout(() => { node.style.opacity = '1'; node.style.transform = 'translateY(0)'; }, 60 * i);
  });
  return wrap;
}

// ── Master live card (главный компонент страницы) ──
function masterLiveCard(m, queue, services) {
  const myQueue = queue.filter((q) => q.masterId === m._id);
  const active = myQueue.find((q) => q.status === 'in_progress' || q.status === 'called');
  const waiting = myQueue.filter((q) => q.status === 'waiting');
  const scheduled = myQueue.filter((q) => q.status === 'scheduled').length;
  const doneToday = myQueue.filter((q) => q.status === 'done');
  const svcById = Object.fromEntries(services.map((s) => [s._id, s]));
  const revenue = doneToday.reduce((s, q) => s + (svcById[q.serviceId]?.price || 0), 0);
  const activeSvc = active ? svcById[active.serviceId] : null;

  // Статус
  let statusTxt, statusCls;
  if (!m.onDuty)   { statusTxt = 'Не на смене'; statusCls = 'off'; }
  else if (active) { statusTxt = 'В работе';    statusCls = 'busy'; }
  else             { statusTxt = 'Свободен';    statusCls = 'free'; }

  return el(`article.master-live-card master-live-card--${statusCls}`, {
    on: { click: () => window.location.hash = '#/masters' },
  }, [
    el('header.mlc-head', {}, [
      el('div.mlc-avatar', { text: initials(m.name) }),
      el('div', { style: { flex: 1, minWidth: 0 } }, [
        el('div.mlc-name', { text: m.name }),
        el('div.mlc-status', { class: [`mlc-status--${statusCls}`] }, [el('span.d'), el('span', { text: statusTxt })]),
      ]),
      el('div.mlc-revenue', {}, [
        el('div.mlc-revenue-val', { text: fmtShort(revenue) }),
        el('div.mlc-revenue-lbl', { text: `${doneToday.length} клиентов` }),
      ]),
    ]),

    active
      ? el('div.mlc-active', {}, [
          el('div.mlc-active-label', { text: '↓ ОБСЛУЖИВАЕТ СЕЙЧАС' }),
          el('div.mlc-active-body', {}, [
            el('div', { style: { flex: 1, minWidth: 0 } }, [
              el('div', { text: active.clientName, style: { fontSize: '14px', fontWeight: 700, color: 'var(--text-strong)' } }),
              el('div', { text: activeSvc?.name || 'услуга', style: { fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' } }),
            ]),
            el('div', { text: fmt(activeSvc?.price || 0) + ' сум', style: { fontSize: '13px', fontWeight: 700, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' } }),
          ]),
        ])
      : m.onDuty
        ? el('div.mlc-idle', { text: 'Свободен · можно направить клиента' })
        : el('div.mlc-off', { text: 'Не на смене' }),

    // Waiting list preview
    waiting.length > 0
      ? el('div.mlc-waiting', {}, [
          el('div.mlc-waiting-label', {}, [
            el('span', { text: `В очереди: ${waiting.length}` }),
            scheduled > 0 ? el('span', { text: `· записей ${scheduled}`, style: { color: 'var(--text-muted)', fontWeight: 500 } }) : null,
          ]),
          el('div.mlc-waiting-avatars', {}, waiting.slice(0, 5).map((q) =>
            el('div.mlc-mini-avatar', { title: q.clientName, text: initials(q.clientName) }),
          )),
        ])
      : scheduled > 0
        ? el('div.mlc-waiting', {}, [el('div.mlc-waiting-label', { text: `${scheduled} записей на потом` })])
        : null,
  ]);
}

function miniKpi({ label, value, sub, tone = '' }) {
  return el(`div.mini-kpi mini-kpi--${tone}`, {}, [
    el('div.mini-kpi-label', { text: label }),
    el('div.mini-kpi-value', { text: value }),
    el('div.mini-kpi-sub', { text: sub }),
  ]);
}

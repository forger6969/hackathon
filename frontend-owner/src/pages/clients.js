import { el } from '../core/dom.js';
import { fmt, escapeHtml, initials, fmtDateShort } from '../core/format.js';
import { app } from '../core/store.js';
import * as api from '../core/api.js';
import { PageHeader } from '../ui/PageHeader.js';
import { emptyState, errorState, skeleton } from '../ui/Skeleton.js';
import { openDrawer } from '../ui/Drawer.js';
import { icons } from '../ui/icons.js';

export default function clientsPage() {
  const root = el('div');
  root.append(PageHeader({
    eyebrow: 'база',
    title: 'Клиенты',
    subtitle: 'Уникальные клиенты, история визитов и любимые услуги',
  }));

  const tableCard = el('section.card', { style: { padding: 0, overflow: 'hidden' } });
  root.append(tableCard);

  async function load() {
    tableCard.innerHTML = '';
    tableCard.append(el('div', { style: { padding: '24px' } }, [skeleton({ w: '100%', h: 200 })]));
    try {
      const q = await api.queue.all();
      // Собираем все visits (включая scheduled, done, etc)
      // Backend не даёт полную историю — только активные + сегодня; для расширенной истории нужен /api/clients endpoint
      const dedupe = new Map();
      q.forEach((it) => {
        const key = it.phone || it.clientName;
        if (!dedupe.has(key)) dedupe.set(key, { name: it.clientName, phone: it.phone, visits: [], totalSpent: 0 });
        const c = dedupe.get(key);
        c.visits.push(it);
        if (it.paid) c.totalSpent += it.servicePrice || 0;
      });
      const clients = Array.from(dedupe.values()).sort((a, b) => b.visits.length - a.visits.length);
      render(clients);
    } catch (err) {
      tableCard.innerHTML = '';
      tableCard.append(errorState({ title: 'Не удалось загрузить клиентов', description: err.message, retry: load }));
    }
  }

  function render(clients) {
    tableCard.innerHTML = '';
    tableCard.append(el('header.chart-head', { style: { padding: '20px 24px 12px', marginBottom: 0 } }, [
      el('div', {}, [
        el('div.eyebrow-sm', { text: 'клиентская база' }),
        el('h2.chart-title', { text: `${clients.length} уникальных клиентов` }),
      ]),
      el('span.head-hint', { text: 'постоянные — 2+ визитов' }),
    ]));

    if (clients.length === 0) {
      tableCard.append(emptyState({
        icon: icons.clients({ size: 24 }),
        title: 'Клиентская база пуста',
        description: 'Клиенты появятся здесь после первой записи через reception или клиентский экран',
      }));
      return;
    }

    const table = el('table.data-table');
    table.innerHTML = `<thead><tr>
      <th style="padding-left:24px">Клиент</th>
      <th>Телефон</th>
      <th class="col-r">Визитов</th>
      <th class="col-r">Потрачено</th>
      <th class="col-r">Средний чек</th>
      <th class="col-r" style="padding-right:24px">Статус</th>
    </tr></thead>`;
    const tbody = el('tbody');
    clients.slice(0, 100).forEach((c) => {
      const avg = c.visits.length > 0 ? Math.round(c.totalSpent / c.visits.length) : 0;
      const loyal = c.visits.length >= 2;
      const tr = el('tr', {
        style: { cursor: 'pointer' },
        on: { click: () => openClientDrawer(c) },
      });
      tr.innerHTML = `
        <td style="padding-left:24px">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="feed-avatar" style="background:rgba(201,162,78,0.14);color:var(--gold-bright);box-shadow:none">${escapeHtml(initials(c.name))}</div>
            <div style="color:var(--text-strong);font-weight:600">${escapeHtml(c.name)}</div>
          </div>
        </td>
        <td style="color:var(--text-muted);font-family:var(--font-mono);font-size:12px">${escapeHtml(c.phone || '—')}</td>
        <td class="col-r col-mono">${c.visits.length}</td>
        <td class="col-r col-mono">${fmt(c.totalSpent)}</td>
        <td class="col-r col-mono" style="color:var(--text-muted)">${fmt(avg)}</td>
        <td class="col-r" style="padding-right:24px">${loyal ? '<span class="badge badge--gold">Постоянный</span>' : '<span class="badge badge--muted">Новый</span>'}</td>`;
      tbody.append(tr);
    });
    table.append(tbody);
    tableCard.append(table);
  }

  function openClientDrawer(c) {
    const totalSpent = c.totalSpent;
    const avg = c.visits.length > 0 ? Math.round(totalSpent / c.visits.length) : 0;
    const content = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, [
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } }, [
        el('div.master-card-avatar', { text: initials(c.name), style: { width: '56px', height: '56px', fontSize: '22px' } }),
        el('div', {}, [
          el('div', { style: { color: 'var(--text-strong)', fontFamily: 'var(--font-num)', fontSize: '20px', fontWeight: 600 }, text: c.name }),
          el('div', { style: { color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)', marginTop: '4px' }, text: c.phone || 'без телефона' }),
        ]),
      ]),
      el('div.data-grid', {}, [
        dataCell('Визитов всего', fmt(c.visits.length), false),
        dataCell('Потрачено', fmt(totalSpent) + ' сум', true),
        dataCell('Средний чек', fmt(avg) + ' сум', false),
        dataCell('Активных сейчас', fmt(c.visits.filter((v) => ['waiting', 'called', 'scheduled', 'in_progress'].includes(v.status)).length), false),
      ]),
      el('section', {}, [
        el('h4', { style: { margin: '0 0 12px', color: 'var(--text-strong)', fontSize: '14px', fontWeight: 600 }, text: 'История записей' }),
        el('ul.feed-list', {}, c.visits.slice(0, 20).map((v) => el('li.feed-item', {}, [
          el('div.feed-avatar', { text: initials(v.masterName || '?') }),
          el('div.feed-text', {}, [
            el('div', { html: `<strong>${escapeHtml(v.masterName || '—')}</strong> · <span class="feed-svc">${escapeHtml(v.serviceName || v.status)}</span>` }),
            el('div.feed-time', { text: v.status + (v.paid ? ' · оплачено' : '') }),
          ]),
        ]))),
      ]),
    ]);
    openDrawer({ eyebrow: 'клиент', title: c.name, content });
  }

  load();
  return root;
}

function dataCell(label, value, gold) {
  return el('div.data-cell', {}, [
    el('div.data-label', { text: label }),
    el('div', { class: gold ? 'data-value data-value--gold' : 'data-value', text: value }),
  ]);
}

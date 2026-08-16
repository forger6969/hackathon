import { el } from '../core/dom.js';
import { fmt, escapeHtml, initials, fmtTime, fmtDateShort } from '../core/format.js';
import { app } from '../core/store.js';
import * as api from '../core/api.js';
import { PageHeader } from '../ui/PageHeader.js';
import { emptyState, errorState, skeleton } from '../ui/Skeleton.js';
import { icons } from '../ui/icons.js';

const STATUS = {
  scheduled: { label: 'Запись',       cls: 'badge--teal' },
  waiting:   { label: 'Ждёт',         cls: 'badge--muted' },
  called:    { label: 'Вызван',       cls: 'badge--gold' },
  done:      { label: 'Готово',       cls: 'badge--emerald' },
  skipped:   { label: 'Не пришёл',    cls: 'badge--garnet' },
  cancelled: { label: 'Отменён',      cls: 'badge--garnet' },
};

export default function appointmentsPage() {
  const root = el('div');
  root.append(PageHeader({
    eyebrow: 'календарь',
    title: 'Записи',
    subtitle: 'Все записи на конкретное время + сегодняшние завершённые',
  }));

  const filters = el('div.filter-bar');
  const tableCard = el('section.card', { style: { padding: 0, overflow: 'hidden' } });
  root.append(filters, tableCard);

  let range = 'today';
  let items = [];

  async function load() {
    tableCard.innerHTML = '';
    tableCard.append(el('div', { style: { padding: '24px' } }, [skeleton({ w: '100%', h: 200 })]));
    try {
      items = await api.queue.all();
      renderFilters();
      renderTable();
    } catch (err) {
      tableCard.innerHTML = '';
      tableCard.append(errorState({ title: 'Не удалось загрузить записи', description: err.message, retry: load }));
    }
  }

  function renderFilters() {
    filters.innerHTML = '';
    ['today', 'tomorrow', 'week', 'all'].forEach((val) => {
      const labels = { today: 'Сегодня', tomorrow: 'Завтра', week: 'Неделя', all: 'Все' };
      filters.append(el('button.chip-btn', {
        class: [range === val ? 'is-active' : ''],
        on: { click: () => { range = val; renderFilters(); renderTable(); } },
        text: labels[val],
      }));
    });
  }

  function inRange(item) {
    if (range === 'all') return true;
    const d = item.scheduledFor ? new Date(item.scheduledFor) : new Date(item.createdAt);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400_000);
    const weekEnd = new Date(today.getTime() + 7 * 86400_000);
    if (range === 'today')    return d >= today && d < tomorrow;
    if (range === 'tomorrow') return d >= tomorrow && d < new Date(tomorrow.getTime() + 86400_000);
    if (range === 'week')     return d >= today && d < weekEnd;
    return true;
  }

  function renderTable() {
    tableCard.innerHTML = '';
    tableCard.append(el('header.chart-head', { style: { padding: '20px 24px 12px', marginBottom: 0 } }, [
      el('div', {}, [
        el('div.eyebrow-sm', { text: 'календарь' }),
        el('h2.chart-title', { text: 'Записи и запись на время' }),
      ]),
    ]));

    const filtered = items.filter(inRange);
    if (filtered.length === 0) {
      tableCard.append(emptyState({ icon: icons.appointments({ size: 24 }), title: 'Нет записей', description: 'В выбранном периоде записей не найдено' }));
      return;
    }

    const table = el('table.data-table');
    table.innerHTML = `<thead><tr>
      <th style="padding-left:24px">Время</th>
      <th>Клиент</th>
      <th>Мастер</th>
      <th>Услуга</th>
      <th class="col-r" style="padding-right:24px">Статус</th>
    </tr></thead>`;
    const tbody = el('tbody');
    filtered
      .slice()
      .sort((a, b) => new Date(a.scheduledFor || a.createdAt) - new Date(b.scheduledFor || b.createdAt))
      .forEach((it) => {
        const st = STATUS[it.status] || { label: it.status, cls: 'badge--muted' };
        const t = it.scheduledFor || it.createdAt;
        const tr = el('tr');
        tr.innerHTML = `
          <td style="padding-left:24px" class="col-mono" style="color:var(--gold-bright);font-weight:600">${fmtTime(t)} <span style="color:var(--text-dim);font-size:11px">${fmtDateShort(t)}</span></td>
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <div class="feed-avatar" style="background:rgba(201,162,78,0.14);color:var(--gold-bright);box-shadow:none">${escapeHtml(initials(it.clientName))}</div>
              <div>
                <div style="color:var(--text-strong);font-weight:600">${escapeHtml(it.clientName)}</div>
                <div style="color:var(--text-dim);font-size:11px;font-family:var(--font-mono)">${escapeHtml(it.phone || '')}</div>
              </div>
            </div>
          </td>
          <td style="color:var(--text-muted)">${escapeHtml(it.masterName || '—')}</td>
          <td>${escapeHtml(it.serviceName || '—')}</td>
          <td class="col-r" style="padding-right:24px"><span class="badge ${st.cls}"><span class="d"></span>${st.label}</span></td>`;
        tbody.append(tr);
      });
    table.append(tbody);
    tableCard.append(table);
  }

  load();
  return root;
}

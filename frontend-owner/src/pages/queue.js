import { el, on } from '../core/dom.js';
import { fmt, fmtTime, escapeHtml, initials } from '../core/format.js';
import { app } from '../core/store.js';
import * as api from '../core/api.js';
import { onEvent } from '../core/socket.js';
import { PageHeader } from '../ui/PageHeader.js';
import { emptyState, errorState } from '../ui/Skeleton.js';
import { openDrawer } from '../ui/Drawer.js';
import { openConfirm } from '../ui/Modal.js';
import { toast } from '../ui/Toast.js';
import { icons } from '../ui/icons.js';

const STATUS = {
  waiting:      { label: 'Ждёт',        cls: 'badge--muted' },
  called:       { label: 'Вызван',      cls: 'badge--gold' },
  in_progress:  { label: 'В работе',    cls: 'badge--emerald' },
  scheduled:    { label: 'На время',    cls: 'badge--teal' },
  done:         { label: 'Готово',      cls: 'badge--emerald' },
  skipped:      { label: 'Не пришёл',   cls: 'badge--garnet' },
  cancelled:    { label: 'Отменён',     cls: 'badge--garnet' },
};

export default function queuePage() {
  const root = el('div', {}, [
    PageHeader({
      eyebrow: 'операции',
      title: 'Живая очередь',
      subtitle: 'Все активные записи всех мастеров в реальном времени',
      actions: [refreshBtn()],
    }),
  ]);

  const filters = el('div.filter-bar');
  const tableWrap = el('div.card', { style: { padding: 0, overflow: 'hidden' } });
  root.append(filters, tableWrap);

  let masterFilter = 'all';
  let statusFilter = 'all';
  let items = [];
  let masters = app.get().masters;
  let servicesById = Object.fromEntries((app.get().services || []).map((s) => [s._id, s]));

  async function load() {
    tableWrap.innerHTML = '<div style="padding:24px"><span class="skeleton" style="width:100%;height:100px"></span></div>';
    // api.queue.all() всегда возвращает данные (real или demo fallback), catch не нужен
    items = await api.queue.all();
    app.set({ queue: items });
    renderFilters();
    renderTable();
  }

  function renderFilters() {
    filters.innerHTML = '';
    // Master filter
    const masterSel = el('select.field-input', {
      style: { maxWidth: '200px', height: '34px' },
      on: { change: (e) => { masterFilter = e.target.value; renderTable(); } },
    });
    masterSel.append(el('option', { value: 'all', text: 'Все мастера' }));
    masters.forEach((m) => masterSel.append(el('option', { value: m._id, text: m.name })));

    const statusChips = el('div.status-chips');
    const statuses = [['all', 'Все'], ['waiting', 'Ждут'], ['called', 'Вызваны'], ['scheduled', 'Записи'], ['done', 'Готово']];
    statuses.forEach(([val, label]) => {
      const chip = el('button.chip-btn', {
        class: [statusFilter === val ? 'is-active' : ''],
        on: { click: () => { statusFilter = val; renderFilters(); renderTable(); } },
        text: label,
      });
      statusChips.append(chip);
    });

    filters.append(masterSel, statusChips);
  }

  function renderTable() {
    const filtered = items.filter((it) => {
      if (masterFilter !== 'all' && it.masterId !== masterFilter) return false;
      if (statusFilter !== 'all' && it.status !== statusFilter) return false;
      return true;
    });

    tableWrap.innerHTML = '';
    if (filtered.length === 0) {
      tableWrap.append(emptyState({
        icon: icons.queue({ size: 24 }),
        title: 'Очередь пуста',
        description: masterFilter !== 'all' || statusFilter !== 'all' ? 'Попробуйте изменить фильтры' : 'Как только клиент запишется, он появится здесь',
      }));
      return;
    }

    const table = el('table.data-table');
    table.innerHTML = `
      <thead><tr>
        <th style="width:40px"></th>
        <th>Клиент</th>
        <th>Услуга</th>
        <th>Мастер</th>
        <th>Статус</th>
        <th class="col-r">Время</th>
        <th class="col-r">Оплата</th>
      </tr></thead>`;
    const tbody = el('tbody');
    filtered.forEach((it, idx) => {
      const st = STATUS[it.status] || { label: it.status, cls: 'badge--muted' };
      const tr = el('tr', {
        style: { cursor: 'pointer' },
        on: { click: () => openQueueItemDrawer(it) },
      });
      tr.innerHTML = `
        <td><div class="q-pos">${it.status === 'scheduled' ? '—' : idx + 1}</div></td>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="feed-avatar" style="background:rgba(201,162,78,0.14);color:var(--gold-bright);box-shadow:none">${escapeHtml(initials(it.clientName))}</div>
            <div>
              <div style="color:var(--text-strong);font-weight:600;font-size:13px">${escapeHtml(it.clientName)}</div>
              <div style="color:var(--text-dim);font-size:11px;font-family:var(--font-mono)">${escapeHtml(it.phone || '—')}</div>
            </div>
          </div>
        </td>
        <td style="color:var(--text)">${escapeHtml(servicesById[it.serviceId]?.name || '—')}</td>
        <td style="color:var(--text-muted)">${escapeHtml(it.masterName || '—')}</td>
        <td><span class="badge ${st.cls}"><span class="d"></span>${st.label}</span></td>
        <td class="col-r col-mono">${it.scheduledFor ? fmtTime(it.scheduledFor) : it.createdAt ? fmtTime(it.createdAt) : '—'}</td>
        <td class="col-r">${payChip(it)}</td>
      `;
      tbody.append(tr);
    });
    table.append(tbody);
    tableWrap.append(table);
  }

  function payChip(it) {
    if (!it.paid) return `<span class="pay-chip">не оплачено</span>`;
    if (it.paymentMethod === 'card') return `<span class="pay-chip pay-chip--card">💳 карта</span>`;
    return `<span class="pay-chip pay-chip--cash">💵 нал</span>`;
  }

  function openQueueItemDrawer(it) {
    const content = el('div.drawer-body-content');
    content.append(
      el('div.data-grid', {}, [
        cell('Клиент', it.clientName),
        cell('Телефон', it.phone || '—'),
        cell('Услуга', it.serviceName || '—'),
        cell('Мастер', it.masterName || '—'),
      ]),
      el('div.data-cell', {}, [
        el('div.data-label', { text: 'Статус' }),
        el('div', { style: { marginTop: '8px' } }, [
          el('span', { class: `badge ${(STATUS[it.status] || {}).cls || 'badge--muted'}`, html: `<span class="d"></span>${(STATUS[it.status] || {}).label || it.status}` }),
        ]),
      ]),
    );

    if (!it.paid) {
      const actions = el('div', { style: { display: 'flex', gap: 8, marginTop: 8 } }, [
        el('button.btn-primary', { on: { click: () => markPaid(it, 'cash') } }, ['💵 Оплатить наличными']),
        el('button.btn-ghost',   { on: { click: () => markPaid(it, 'card') } }, ['💳 Оплатить картой']),
      ]);
      content.append(actions);
    }

    if (it.status === 'scheduled') {
      const btn = el('button.btn-primary', {
        style: { width: '100%', justifyContent: 'center', marginTop: '8px' },
        on: { click: async () => { await api.queue.checkin(it._id); toast('Клиент отмечен как пришедший'); load(); dw.close(); } },
      }, ['Клиент пришёл — в живую очередь']);
      content.append(btn);
    }

    const dw = openDrawer({ eyebrow: 'запись', title: it.clientName, content });
  }

  async function markPaid(it, method) {
    try {
      await api.queue.pay(it._id, method);
      toast(`Оплата (${method === 'cash' ? 'нал' : 'карта'}) отмечена`);
      load();
    } catch (err) {
      toast('Не удалось отметить оплату: ' + err.message);
    }
  }

  const off = onEvent('queue:update', () => load());
  root.addEventListener('unmount', () => off?.());
  load();

  // React to store master list updates
  app.subscribe((s) => { masters = s.masters; renderFilters(); });

  return root;
}

function cell(label, value) {
  return el('div.data-cell', {}, [
    el('div.data-label', { text: label }),
    el('div.data-value.data-value--sm', { text: value }),
  ]);
}

function refreshBtn() {
  return el('button.btn-ghost', {
    on: { click: () => window.dispatchEvent(new CustomEvent('data:refresh')) },
    html: icons.refresh({ size: 12 }) + '<span>Обновить</span>',
  });
}

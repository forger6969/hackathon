import { el } from '../core/dom.js';
import { fmt, escapeHtml } from '../core/format.js';
import { app } from '../core/store.js';
import * as api from '../core/api.js';
import { PageHeader } from '../ui/PageHeader.js';
import { emptyState, errorState, skeleton } from '../ui/Skeleton.js';
import { icons } from '../ui/icons.js';
import { toast } from '../ui/Toast.js';

export default function servicesPage() {
  const root = el('div');
  root.append(PageHeader({
    eyebrow: 'каталог',
    title: 'Услуги',
    subtitle: 'Прайс-лист и связь со складом',
    actions: [el('button.btn-primary', {
      on: { click: () => toast('Функция в разработке — endpoint POST /api/services появится позже') },
      html: icons.plus({ size: 12 }) + '<span>Добавить услугу</span>',
    })],
  }));

  const tableCard = el('section.card', { style: { padding: 0, overflow: 'hidden' } });
  root.append(tableCard);

  async function load() {
    tableCard.innerHTML = '';
    tableCard.append(el('div', { style: { padding: '24px' } }, [skeleton({ w: '100%', h: 200 })]));
    try {
      const [services, stock] = await Promise.all([api.services.list(), api.stock.list()]);
      render(services, stock);
    } catch (err) {
      tableCard.innerHTML = '';
      tableCard.append(errorState({ title: 'Не удалось загрузить услуги', description: err.message, retry: load }));
    }
  }

  function render(services, stock) {
    const stockById = Object.fromEntries(stock.map((s) => [s._id, s]));
    // Демандм счёт из app.queue done items
    const demand = {};
    (app.get().queue || []).forEach((q) => {
      if (q.status !== 'done') return;
      const key = q.serviceId || q.serviceName;
      demand[key] = (demand[key] || 0) + 1;
    });
    const maxDemand = Math.max(1, ...Object.values(demand));

    tableCard.innerHTML = '';
    tableCard.append(el('header.chart-head', { style: { padding: '20px 24px 12px', marginBottom: 0 } }, [
      el('div', {}, [
        el('div.eyebrow-sm', { text: 'прайс' }),
        el('h2.chart-title', { text: `${services.length} услуг` }),
      ]),
      el('span.head-hint', { text: 'популярность считается по done-транзакциям' }),
    ]));

    if (services.length === 0) {
      tableCard.append(emptyState({ icon: icons.services({ size: 24 }), title: 'Нет услуг', description: 'Добавьте первую услугу через seed или API' }));
      return;
    }

    const table = el('table.data-table');
    table.innerHTML = `<thead><tr>
      <th style="padding-left:24px">Услуга</th>
      <th class="col-r">Цена</th>
      <th>Списание со склада</th>
      <th class="col-r">Заказов</th>
      <th style="min-width:140px">Спрос</th>
      <th class="col-r" style="padding-right:24px"></th>
    </tr></thead>`;
    const tbody = el('tbody');
    services.forEach((s) => {
      const d = demand[s._id] || demand[s.name] || 0;
      const pct = Math.round((d / maxDemand) * 100);
      const stockChips = (s.stockUse || []).map((u) => {
        const item = stockById[u.stockId];
        return item ? `<span class="pay-chip">${escapeHtml(item.name)} ×${u.qty}</span>` : '';
      }).join(' ');
      const tr = el('tr');
      tr.innerHTML = `
        <td style="padding-left:24px">
          <div style="color:var(--text-strong);font-weight:600">${escapeHtml(s.name)}</div>
        </td>
        <td class="col-r"><span style="color:var(--gold-bright);font-family:var(--font-num);font-weight:700;font-size:15px">${fmt(s.price)}</span> <span style="color:var(--text-dim);font-size:11px">сум</span></td>
        <td>${stockChips || '<span style="color:var(--text-disabled);font-size:11px">не списывает</span>'}</td>
        <td class="col-r col-mono">${d}</td>
        <td>
          <div style="height:6px;background:rgba(255,255,255,0.05);border-radius:999px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--gold),var(--gold-bright));transition:width .5s"></div>
          </div>
        </td>
        <td class="col-r" style="padding-right:24px"></td>`;
      const editBtn = el('button.icon-btn', { style: { width: '28px', height: '28px' }, on: { click: () => toast('Редактирование появится в v2') }, html: icons.moreVertical({ size: 12 }) });
      tr.lastElementChild.append(editBtn);
      tbody.append(tr);
    });
    table.append(tbody);
    tableCard.append(table);
  }

  load();
  return root;
}

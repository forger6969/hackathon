import { el } from '../core/dom.js';
import { fmt, escapeHtml } from '../core/format.js';
import * as api from '../core/api.js';
import { PageHeader } from '../ui/PageHeader.js';
import { emptyState, errorState, skeleton } from '../ui/Skeleton.js';
import { KpiCard } from '../ui/KpiCard.js';
import { icons } from '../ui/icons.js';

export default function inventoryPage() {
  const root = el('div');
  const header = PageHeader({
    eyebrow: 'склад',
    title: 'Инвентарь',
    subtitle: 'Остатки и списания',
  });
  const kpiRow = el('section.kpi-grid');
  const alertCard = el('section');
  const tableCard = el('section.card', { style: { padding: 0, overflow: 'hidden' } });
  root.append(header, kpiRow, alertCard, tableCard);

  async function load() {
    kpiRow.innerHTML = '';
    for (let i = 0; i < 4; i++) kpiRow.append(el('div.card', { style: { height: '140px' } }, [skeleton({ w: '100%', h: 20 })]));
    tableCard.innerHTML = '';
    tableCard.append(el('div', { style: { padding: '24px' } }, [skeleton({ w: '100%', h: 200 })]));

    try {
      const list = await api.stock.list();
      render(list);
    } catch (err) {
      tableCard.innerHTML = '';
      tableCard.append(errorState({ title: 'Не удалось загрузить склад', description: err.message, retry: load }));
    }
  }

  function statusOf(s) {
    if (s.qty <= 0) return { key: 'out',      label: 'Кончился', cls: 'badge--garnet' };
    if (s.qty <= s.lowThreshold * 0.4) return { key: 'critical', label: 'Критично', cls: 'badge--garnet' };
    if (s.qty < s.lowThreshold) return { key: 'low',      label: 'Заканчивается', cls: 'badge--gold' };
    return { key: 'ok', label: 'В наличии', cls: 'badge--emerald' };
  }

  function render(list) {
    const counts = { ok: 0, low: 0, critical: 0, out: 0 };
    list.forEach((s) => { counts[statusOf(s).key]++; });

    kpiRow.innerHTML = '';
    kpiRow.append(
      KpiCard({ label: 'Всего позиций', value: list.length, icon: icons.inventory, tone: 'neutral', delay: 0 }),
      KpiCard({ label: 'В наличии', value: counts.ok, icon: icons.check, tone: 'neutral', delay: 100 }),
      KpiCard({ label: 'Заканчивается', value: counts.low, icon: icons.warn, tone: 'gold', delay: 200 }),
      KpiCard({ label: 'Критично / нет', value: counts.critical + counts.out, icon: icons.warn, tone: 'warn', delay: 300 }),
    );

    alertCard.innerHTML = '';
    const low = list.filter((s) => statusOf(s).key !== 'ok');
    if (low.length > 0) {
      const card = el('div.card.alert-card', {}, [
        el('div.alert-strip'),
        el('div.alert-body', {}, [
          el('header.alert-head', {}, [
            el('div.alert-icon', { html: icons.warn({ size: 18 }) }),
            el('div', {}, [
              el('div.eyebrow-sm.eyebrow-sm--warn', { text: 'внимание' }),
              el('div.alert-title', { text: `Нужно купить: ${low.length} позиций` }),
            ]),
          ]),
          el('ul.stock-list', {}, low.map((s) => {
            const st = statusOf(s);
            const pct = Math.max(4, Math.min(100, (s.qty / Math.max(1, s.lowThreshold)) * 100));
            const li = el('li.stock-item.is-danger');
            li.innerHTML = `
              <span class="stock-name">${escapeHtml(s.name)}</span>
              <span class="badge ${st.cls}">${st.label}</span>
              <span class="stock-qty">осталось ${s.qty} ${escapeHtml(s.unit || '')} · порог ${s.lowThreshold}</span>
              <div class="stock-progress"><div class="stock-progress-fill" style="width:${pct}%"></div></div>`;
            return li;
          })),
        ]),
      ]);
      alertCard.append(card);
    }

    tableCard.innerHTML = '';
    tableCard.append(el('header.chart-head', { style: { padding: '20px 24px 12px', marginBottom: 0 } }, [
      el('div', {}, [
        el('div.eyebrow-sm', { text: 'полный список' }),
        el('h2.chart-title', { text: 'Все позиции' }),
      ]),
    ]));

    if (list.length === 0) {
      tableCard.append(emptyState({ icon: icons.inventory({ size: 24 }), title: 'На складе пусто', description: 'Добавьте первую позицию через seed или админ' }));
      return;
    }
    const table = el('table.data-table');
    table.innerHTML = `<thead><tr>
      <th style="padding-left:24px">Позиция</th>
      <th class="col-r">Остаток</th>
      <th class="col-r">Порог</th>
      <th class="col-r">Уровень</th>
      <th class="col-r" style="padding-right:24px">Статус</th>
    </tr></thead>`;
    const tbody = el('tbody');
    list.forEach((s) => {
      const st = statusOf(s);
      const pct = Math.max(4, Math.min(100, (s.qty / Math.max(1, s.lowThreshold)) * 100));
      const barColor = st.key === 'ok' ? 'var(--emerald-bright)' : st.key === 'low' ? 'var(--gold-bright)' : 'var(--garnet-bright)';
      const tr = el('tr');
      tr.innerHTML = `
        <td style="padding-left:24px;color:var(--text-strong);font-weight:600">${escapeHtml(s.name)}</td>
        <td class="col-r col-mono">${s.qty} <span style="color:var(--text-dim)">${escapeHtml(s.unit || '')}</span></td>
        <td class="col-r col-mono" style="color:var(--text-dim)">${s.lowThreshold}</td>
        <td class="col-r" style="min-width:120px">
          <div style="height:6px;background:rgba(255,255,255,0.05);border-radius:999px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${barColor};transition:width .5s"></div>
          </div>
        </td>
        <td class="col-r" style="padding-right:24px"><span class="badge ${st.cls}"><span class="d"></span>${st.label}</span></td>`;
      tbody.append(tr);
    });
    table.append(tbody);
    tableCard.append(table);
  }

  load();
  return root;
}

import { el } from '../core/dom.js';
import { fmt, fmtSum, escapeHtml, initials, fmtDateShort, fmtTime } from '../core/format.js';
import { app } from '../core/store.js';
import * as api from '../core/api.js';
import { PageHeader } from '../ui/PageHeader.js';
import { emptyState, errorState, skeleton } from '../ui/Skeleton.js';
import { openConfirm } from '../ui/Modal.js';
import { toast } from '../ui/Toast.js';
import { icons } from '../ui/icons.js';
import { KpiCard } from '../ui/KpiCard.js';

export default function financePage() {
  const root = el('div');

  const now = new Date();
  const dayOfMonth = now.getDate();

  const header = PageHeader({
    eyebrow: 'финансы',
    title: 'Финансы',
    subtitle: 'Выручка, зарплаты, транзакции',
    actions: [
      el('button.btn-primary', {
        on: { click: () => payAll() },
        html: icons.finance({ size: 12 }) + '<span>Выдать всем</span>',
      }),
    ],
  });

  const kpiRow = el('section.kpi-grid');
  const payrollCard = el('section.card', { style: { padding: 0, overflow: 'hidden' } });
  const historyCard = el('section.card');
  const txCard = el('section.card', { style: { padding: 0, overflow: 'hidden' } });

  root.append(header, kpiRow, payrollCard, el('div.section-grid.section-grid--2', {}, [txCard, historyCard]));

  let masters = [];
  let todayPer = []; // per-master today stats
  let today = null;

  async function load() {
    kpiRow.innerHTML = '';
    for (let i = 0; i < 4; i++) kpiRow.append(el('div.card', { style: { height: '140px' } }, [skeleton({ w: '100%', h: 20 })]));
    payrollCard.innerHTML = '';
    payrollCard.append(el('div', { style: { padding: '24px' } }, [skeleton({ w: '100%', h: 240 })]));

    try {
      const salonId = app.get().currentSalonId;
      [masters, today] = await Promise.all([
        api.masters.list(salonId ? { salonId } : {}),
        api.owner.today(),
      ]);
      todayPer = await Promise.all(masters.map((m) => api.masters.today(m._id).catch(() => ({ clientsServed: 0, revenue: 0, earned: 0 }))));

      renderKpi();
      renderPayroll();
      renderHistory();
      renderTransactions();
    } catch (err) {
      kpiRow.innerHTML = '';
      payrollCard.innerHTML = '';
      payrollCard.append(errorState({ title: 'Не удалось загрузить финансы', description: err.message, retry: load }));
    }
  }

  function renderKpi() {
    const payrollList = api.payroll.list();
    const monthAgo = Date.now() - 30 * 86400_000;
    const paidMonth = payrollList.filter((p) => p.paidAt >= monthAgo).reduce((s, p) => s + p.amount, 0);

    // Оценка pending payroll: сумма earned (percent-based) для percent/hybrid + salaryFixed для fixed/hybrid
    const pendingTotal = masters.reduce((s, m, i) => {
      const revenueMonth = (todayPer[i]?.revenue || 0) * dayOfMonth * 0.9;
      const payout = api.calcPayout(m, revenueMonth);
      return s + payout.total;
    }, 0);

    kpiRow.innerHTML = '';
    kpiRow.append(
      KpiCard({ label: 'Выручка сегодня', value: today.revenue || 0, unit: 'сум', icon: icons.finance, tone: 'gold', delta: { text: 'live', direction: 'up' }, delay: 0 }),
      KpiCard({ label: 'К выплате в этом месяце', value: pendingTotal, unit: 'сум', icon: icons.finance, tone: 'neutral', delay: 100 }),
      KpiCard({ label: 'Уже выплачено', value: paidMonth, unit: 'сум', icon: icons.finance, tone: 'neutral', delay: 200 }),
      KpiCard({ label: 'Чистая прибыль', value: Math.max(0, (today.revenue || 0) * dayOfMonth * 0.9 - paidMonth), unit: 'сум', icon: icons.finance, tone: 'gold', delay: 300 }),
    );
  }

  function renderPayroll() {
    if (masters.length === 0) {
      payrollCard.innerHTML = '';
      payrollCard.append(emptyState({ icon: icons.masters({ size: 24 }), title: 'Нет мастеров для расчёта зарплаты' }));
      return;
    }
    const table = el('table.data-table');
    table.innerHTML = `
      <thead><tr>
        <th style="padding-left:24px">Мастер</th>
        <th>Модель</th>
        <th class="col-r">Фикс</th>
        <th class="col-r">%</th>
        <th class="col-r">Выручка мес</th>
        <th class="col-r">К выплате</th>
        <th class="col-r" style="padding-right:24px"></th>
      </tr></thead>`;
    const tbody = el('tbody');
    masters.forEach((m, i) => {
      const revenueMonth = (todayPer[i]?.revenue || 0) * dayOfMonth * 0.9;
      const payout = api.calcPayout(m, revenueMonth);
      const tr = el('tr');
      tr.innerHTML = `
        <td style="padding-left:24px">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="feed-avatar">${escapeHtml(initials(m.name))}</div>
            <div>
              <div style="color:var(--text-strong);font-weight:600;font-size:13px">${escapeHtml(m.name)}</div>
              <div style="color:var(--text-dim);font-size:11px;font-family:var(--font-mono)">${m.onDuty ? 'на линии' : 'не на линии'}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge--muted">${api.salaryLabel(m.salaryType)}</span></td>
        <td class="col-r col-mono">${m.salaryType !== 'percent' ? fmt(m.salaryFixed || 0) : '—'}</td>
        <td class="col-r col-mono">${m.salaryType !== 'fixed' ? (m.salaryPercent || 0) + '%' : '—'}</td>
        <td class="col-r col-mono">${fmt(revenueMonth)}</td>
        <td class="col-r"><span style="color:var(--gold-bright);font-family:var(--font-num);font-weight:700;font-size:15px">${fmt(payout.total)}</span></td>
        <td class="col-r" style="padding-right:24px"></td>`;
      const payBtn = el('button.btn-primary.btn-sm', {
        on: { click: (e) => { e.stopPropagation(); paySalary(m, payout.total); } },
        html: '<span>Выдать</span>',
      });
      tr.lastElementChild.append(payBtn);
      tbody.append(tr);
    });
    table.append(tbody);
    payrollCard.innerHTML = '';
    payrollCard.append(el('header.chart-head', { style: { padding: '20px 24px 12px', marginBottom: 0 } }, [
      el('div', {}, [
        el('div.eyebrow-sm', { text: 'зарплаты' }),
        el('h2.chart-title', { text: 'К выплате в этом месяце' }),
      ]),
      el('span.head-hint', { text: 'считается по формуле бэка' }),
    ]));
    payrollCard.append(table);
  }

  function renderHistory() {
    historyCard.innerHTML = '';
    const list = api.payroll.list().slice().reverse().slice(0, 20);
    historyCard.append(el('header.chart-head', {}, [
      el('div', {}, [
        el('div.eyebrow-sm', { text: 'история' }),
        el('h2.chart-title', { text: 'Выплаты за месяц' }),
      ]),
      el('span.head-hint', { text: `${list.length} записей` }),
    ]));

    if (list.length === 0) {
      historyCard.append(emptyState({ icon: icons.finance({ size: 24 }), title: 'Пока пусто', description: 'Выплаты появятся здесь после первого «Выдать»' }));
      return;
    }

    const ul = el('ul.feed-list');
    list.forEach((p) => {
      ul.append(el('li.feed-item', {}, [
        el('div.feed-avatar', { text: initials(p.employeeName || '?') }),
        el('div.feed-text', {}, [
          el('div', { html: `<strong>${escapeHtml(p.employeeName || '?')}</strong> · <span class="feed-svc">${api.salaryLabel(p.salaryType || 'fixed')}</span>` }),
          el('div.feed-time', { text: `${fmtDateShort(p.paidAt)} · ${fmtTime(p.paidAt)}` }),
        ]),
        el('div.feed-amount', { text: '+' + fmt(p.amount) }),
      ]));
    });
    historyCard.append(ul);
  }

  function renderTransactions() {
    txCard.innerHTML = '';
    txCard.append(el('header.chart-head', { style: { padding: '20px 24px 12px', marginBottom: 0 } }, [
      el('div', {}, [
        el('div.eyebrow-sm', { text: 'сегодня' }),
        el('h2.chart-title', { text: 'Транзакции' }),
      ]),
    ]));

    const q = (app.get().queue || []).filter((it) => it.status === 'done' || it.paid);
    if (q.length === 0) {
      txCard.append(emptyState({ icon: icons.finance({ size: 24 }), title: 'Пока нет завершённых транзакций', description: 'Как только мастер закроет клиента — они появятся здесь' }));
      return;
    }
    const table = el('table.data-table');
    table.innerHTML = `<thead><tr>
      <th style="padding-left:24px">Клиент</th>
      <th>Мастер</th>
      <th>Услуга</th>
      <th class="col-r">Оплата</th>
      <th class="col-r" style="padding-right:24px">Сумма</th>
    </tr></thead>`;
    const tbody = el('tbody');
    q.slice(0, 20).forEach((it) => {
      const tr = el('tr');
      tr.innerHTML = `
        <td style="padding-left:24px;color:var(--text-strong);font-weight:600">${escapeHtml(it.clientName)}</td>
        <td style="color:var(--text-muted)">${escapeHtml(it.masterName || '—')}</td>
        <td>${escapeHtml(it.serviceName || '—')}</td>
        <td class="col-r">${it.paid ? (it.paymentMethod === 'card' ? '<span class="pay-chip pay-chip--card">💳 карта</span>' : '<span class="pay-chip pay-chip--cash">💵 нал</span>') : '<span class="pay-chip">не оплачено</span>'}</td>
        <td class="col-r col-mono" style="padding-right:24px;color:var(--gold-bright);font-weight:700">${fmt(it.servicePrice || 0)}</td>`;
      tbody.append(tr);
    });
    table.append(tbody);
    txCard.append(table);
  }

  function paySalary(m, amount) {
    openConfirm({
      eyebrow: 'финансы',
      title: 'Выдать зарплату',
      message: `Выдать <strong>${escapeHtml(m.name)}</strong> <strong>${fmt(amount)} сум</strong>?`,
      okText: 'Выдать',
      onOk: () => {
        api.payroll.add({ employeeId: m._id, employeeName: m.name, salaryType: m.salaryType, amount });
        toast(`Выдано <strong>${escapeHtml(m.name)}</strong> · ${fmt(amount)} сум`);
        renderHistory();
        renderKpi();
      },
    });
  }

  function payAll() {
    if (masters.length === 0) { toast('Нет мастеров для выплаты'); return; }
    const total = masters.reduce((s, m, i) => {
      const revenueMonth = (todayPer[i]?.revenue || 0) * dayOfMonth * 0.9;
      return s + api.calcPayout(m, revenueMonth).total;
    }, 0);
    openConfirm({
      eyebrow: 'финансы',
      title: 'Массовая выплата',
      message: `Выдать зарплату всем <strong>${masters.length}</strong> сотрудникам? Итого <strong>${fmt(total)} сум</strong>.`,
      okText: 'Выдать всем',
      onOk: () => {
        const t0 = Date.now();
        masters.forEach((m, i) => {
          const revenueMonth = (todayPer[i]?.revenue || 0) * dayOfMonth * 0.9;
          const p = api.calcPayout(m, revenueMonth);
          api.payroll.add({ employeeId: m._id, employeeName: m.name, salaryType: m.salaryType, amount: p.total, paidAt: t0 + i });
        });
        toast(`Выдано <strong>${masters.length}</strong> сотрудникам · итого ${fmt(total)} сум`);
        renderHistory();
        renderKpi();
      },
    });
  }

  load();
  return root;
}

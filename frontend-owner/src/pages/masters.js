import { el } from '../core/dom.js';
import { fmt, fmtSum, escapeHtml, initials } from '../core/format.js';
import { app } from '../core/store.js';
import * as api from '../core/api.js';
import { PageHeader } from '../ui/PageHeader.js';
import { emptyState, errorState, skeleton } from '../ui/Skeleton.js';
import { openDrawer } from '../ui/Drawer.js';
import { openModal, openConfirm } from '../ui/Modal.js';
import { toast } from '../ui/Toast.js';
import { icons } from '../ui/icons.js';

export default function mastersPage() {
  const root = el('div');
  const header = PageHeader({
    eyebrow: 'команда',
    title: 'Мастера',
    subtitle: 'Управление сотрудниками и их графиком',
    actions: [
      el('button.btn-primary', {
        on: { click: openHireModal },
        html: icons.plus({ size: 12 }) + '<span>Нанять</span>',
      }),
    ],
  });
  const grid = el('div.section-grid.section-grid--3', { style: { gap: '16px' } });
  root.append(header, grid);

  async function load() {
    grid.innerHTML = '';
    for (let i = 0; i < 6; i++) grid.append(el('div.card', { style: { height: '210px' } }, [skeleton({ w: '100%', h: 20 })]));
    try {
      const salonId = app.get().currentSalonId;
      const list = await api.masters.list(salonId ? { salonId } : {});
      app.set({ masters: list });
      // Параллельно грузим today-стату каждого
      const todayPerMaster = await Promise.allSettled(list.map((m) => api.masters.today(m._id)));
      renderGrid(list, todayPerMaster);
    } catch (err) {
      grid.innerHTML = '';
      grid.append(errorState({ title: 'Не удалось загрузить мастеров', description: err.message, retry: load }));
    }
  }

  function renderGrid(list, todayResults) {
    grid.innerHTML = '';
    if (list.length === 0) {
      grid.append(emptyState({
        icon: icons.masters({ size: 24 }),
        title: 'Пока нет мастеров',
        description: 'Нанимайте первого сотрудника',
        action: el('button.btn-primary', { on: { click: openHireModal }, html: icons.plus({ size: 12 }) + '<span>Нанять</span>' }),
      }));
      return;
    }
    list.forEach((m, idx) => {
      const today = todayResults[idx]?.status === 'fulfilled' ? todayResults[idx].value : { clientsServed: 0, revenue: 0, earned: 0, hoursWorked: 0 };
      grid.append(masterCard(m, today));
    });
  }

  function masterCard(m, today) {
    const dutyBtn = el('button.duty-toggle', {
      class: [m.onDuty ? 'is-on' : ''],
      on: { click: async (e) => {
        e.stopPropagation();
        try {
          await api.masters.setDuty(m._id, !m.onDuty);
          m.onDuty = !m.onDuty;
          e.currentTarget.classList.toggle('is-on', m.onDuty);
          e.currentTarget.querySelector('.duty-label').textContent = m.onDuty ? 'На линии' : 'Не на линии';
          toast(`${escapeHtml(m.name)}: ${m.onDuty ? 'на линии' : 'снят с линии'}`);
        } catch (err) { toast('Ошибка: ' + err.message); }
      } },
    }, [
      el('span.d'),
      el('span.duty-label', { text: m.onDuty ? 'На линии' : 'Не на линии' }),
    ]);

    return el('article.card.master-card', {
      on: { click: () => openMasterDrawer(m, today) },
    }, [
      el('div.master-card-head', {}, [
        el('div.master-card-avatar', { text: initials(m.name) }),
        el('div', { style: { flex: 1, minWidth: 0 } }, [
          el('div.master-card-name', { text: m.name }),
          el('div.master-card-role', {}, [
            salaryTypeBadge(m.salaryType),
            el('span', { text: `~${Math.round((m.avgServiceTimeMs || 1200000) / 60000)} мин` }),
          ]),
        ]),
        dutyBtn,
      ]),
      el('div.master-card-stats', {}, [
        stat('Клиентов', fmt(today.clientsServed)),
        stat('Выручка', fmtSum(today.revenue)),
        stat('Начислено', fmtSum(today.earned)),
        stat('На смене', today.hoursWorked ? `${today.hoursWorked} ч` : '—'),
      ]),
    ]);
  }

  function stat(label, value) {
    return el('div.master-card-stat', {}, [
      el('div.master-card-stat-label', { text: label }),
      el('div.master-card-stat-value', { text: value }),
    ]);
  }

  function openMasterDrawer(m, today) {
    const content = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, [
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } }, [
        el('div.master-card-avatar', { text: initials(m.name), style: { width: '56px', height: '56px', fontSize: '22px' } }),
        el('div', {}, [
          el('div', { style: { color: 'var(--text-strong)', fontFamily: 'var(--font-num)', fontSize: '20px', fontWeight: 600 }, text: m.name }),
          el('div', { style: { color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' } }, [
            salaryTypeBadge(m.salaryType),
          ]),
        ]),
      ]),

      el('div.data-grid', {}, [
        dataCell('Клиентов сегодня', fmt(today.clientsServed), false),
        dataCell('Выручка сегодня', fmtSum(today.revenue), false),
        dataCell('Начислено', fmtSum(today.earned), true),
        dataCell('На смене', today.hoursWorked ? `${today.hoursWorked} ч` : '—', false),
      ]),

      el('section', {}, [
        el('h4', { style: { margin: '0 0 12px', color: 'var(--text-strong)', fontSize: '14px', fontWeight: 600 }, text: 'Компенсация' }),
        el('div.kv-list', {}, [
          kvRow('Тип оклада', api.salaryLabel(m.salaryType)),
          m.salaryType !== 'percent' ? kvRow('Фиксированный', fmtSum(m.salaryFixed || 0)) : null,
          m.salaryType !== 'fixed'   ? kvRow('Процент', `${m.salaryPercent || 0}%`) : null,
          kvRow('Стаж', m.createdAt ? Math.floor((Date.now() - new Date(m.createdAt).getTime()) / 86400_000) + ' дн' : '—'),
        ].filter(Boolean)),
      ]),

      el('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } }, [
        el('button.btn-danger-large', {
          style: { flex: 1, justifyContent: 'center' },
          on: { click: () => confirmFire(m, dw) },
        }, ['Уволнить']),
      ]),
    ]);
    const dw = openDrawer({ eyebrow: 'сотрудник', title: 'Карточка мастера', content });
  }

  function confirmFire(m, drawer) {
    openConfirm({
      eyebrow: 'команда',
      title: 'Уволить сотрудника',
      message: `Уволить <strong>${escapeHtml(m.name)}</strong>? Действие только помечает его в UI — данные в БД сохраняются, отменить можно только через админа.`,
      okText: 'Уволить',
      okKind: 'danger',
      onOk: async () => {
        try {
          // Backend не поддерживает удаление, только флаг active. Пока UI-only.
          toast(`Функция в разработке — endpoint DELETE /api/masters/:id появится позже. Пока помечаем локально.`);
          drawer.close();
        } catch (err) { toast('Ошибка: ' + err.message); }
      },
    });
  }

  function openHireModal() {
    const form = el('form', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });
    form.innerHTML = `
      <div class="field">
        <label class="field-label">Имя</label>
        <input class="field-input" name="name" required placeholder="Например, Aziz" />
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field-label">Тип оклада</label>
          <select class="field-input" name="salaryType">
            <option value="fixed">Фиксированный</option>
            <option value="percent">Процент</option>
            <option value="hybrid">Фикс + процент</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">Салон</label>
          <select class="field-input" name="salonId"></select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field-label">Оклад (сум/мес)</label>
          <input class="field-input" name="salaryFixed" type="number" min="0" step="100000" value="3000000" />
        </div>
        <div class="field">
          <label class="field-label">Процент (%)</label>
          <input class="field-input" name="salaryPercent" type="number" min="0" max="100" value="30" />
        </div>
      </div>
    `;
    const salonSel = form.querySelector('[name="salonId"]');
    app.get().salons.forEach((s) => salonSel.append(el('option', { value: s._id, text: s.name })));

    openModal({
      eyebrow: 'команда',
      title: 'Нанять сотрудника',
      content: form,
      actions: [
        { label: 'Отмена', kind: 'ghost', onClick: (close) => close() },
        { label: 'Нанять', kind: 'primary', onClick: (close) => {
          toast('Функция в разработке — endpoint POST /api/masters появится позже.');
          close();
        } },
      ],
    });
  }

  load();
  return root;
}

function salaryTypeBadge(t) {
  const map = { fixed: 'Фикс', percent: 'Процент', hybrid: 'Фикс+%' };
  return el('span.pay-chip', { text: map[t] || 'Фикс' });
}

function dataCell(label, value, gold) {
  return el('div.data-cell', {}, [
    el('div.data-label', { text: label }),
    el('div', { class: gold ? 'data-value data-value--gold' : 'data-value', text: value }),
  ]);
}

function kvRow(label, value) {
  return el('div.kv-row', {}, [
    el('span.kv-label', { text: label }),
    el('span.kv-value', { text: value }),
  ]);
}

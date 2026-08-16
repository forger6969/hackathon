import { el } from '../core/dom.js';
import { PageHeader } from '../ui/PageHeader.js';
import { icons } from '../ui/icons.js';
import { toast } from '../ui/Toast.js';
import * as persist from '../core/persist.js';
import { API_URL, HAS_BACKEND } from '../core/api.js';

export default function settingsPage() {
  const root = el('div');
  root.append(PageHeader({
    eyebrow: 'админ',
    title: 'Настройки',
    subtitle: 'Общие настройки, интеграции, безопасность',
  }));

  const grid = el('div.section-grid.section-grid--2');
  root.append(grid);

  // General
  grid.append(section('Общие', [
    kv('Тема', 'Тёмная (единственная сейчас)'),
    kv('Язык', 'Русский · доступен UZ, EN в v2'),
    kv('Часовой пояс', new Intl.DateTimeFormat().resolvedOptions().timeZone),
  ]));

  // Notifications
  grid.append(section('Уведомления', [
    kvToggle('Заканчивается склад', 'notify.stock', true),
    kvToggle('Новые записи', 'notify.appointments', true),
    kvToggle('Изменения очереди', 'notify.queue', false),
  ]));

  // Integrations
  grid.append(section('Интеграции', [
    kv('Backend API', HAS_BACKEND ? API_URL : 'не подключен (mock-режим)'),
    kv('Socket.io', HAS_BACKEND ? 'подключен' : '—'),
    kv('MongoDB Atlas', HAS_BACKEND ? 'через backend' : '—'),
    kv('Cloudinary (фото мастеров)', 'настроено на бэке'),
  ]));

  // Danger
  const dangerCard = el('section.card', {}, [
    el('div.eyebrow-sm.eyebrow-sm--warn', { text: 'опасно' }),
    el('h2.chart-title', { text: 'Данные' }),
    el('div', { style: { marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' } }, [
      el('button.btn-danger-large', {
        on: { click: () => {
          persist.del(persist.KEYS.payroll);
          toast('История выплат очищена');
        } },
      }, ['Очистить историю зарплат']),
      el('button.btn-danger-large', {
        on: { click: () => {
          Object.values(persist.KEYS).forEach((k) => persist.del(k));
          toast('Все локальные настройки сброшены. Перезагрузите страницу.');
        } },
      }, ['Сбросить локальные данные']),
    ]),
  ]);
  grid.append(dangerCard);

  return root;
}

function section(title, children) {
  return el('section.card', {}, [
    el('div.eyebrow-sm', { text: title.toLowerCase() }),
    el('h2.chart-title', { text: title }),
    el('div.kv-list', { style: { marginTop: '16px' } }, children),
  ]);
}

function kv(label, value) {
  return el('div.kv-row', {}, [
    el('span.kv-label', { text: label }),
    el('span.kv-value', { text: value }),
  ]);
}

function kvToggle(label, key, defaultOn) {
  const stored = persist.get('ui', {});
  const state = { on: stored[key] ?? defaultOn };
  const btn = el('button.duty-toggle', { class: [state.on ? 'is-on' : ''] }, [
    el('span.d'),
    el('span', { text: state.on ? 'Вкл' : 'Выкл' }),
  ]);
  btn.addEventListener('click', () => {
    state.on = !state.on;
    btn.classList.toggle('is-on', state.on);
    btn.querySelector('span:last-child').textContent = state.on ? 'Вкл' : 'Выкл';
    const s = persist.get('ui', {});
    s[key] = state.on;
    persist.set('ui', s);
  });
  return el('div.kv-row', {}, [
    el('span.kv-label', { text: label }),
    btn,
  ]);
}

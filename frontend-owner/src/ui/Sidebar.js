import { el, on } from '../core/dom.js';
import { icons } from './icons.js';
import { go, currentPath } from '../router.js';
import * as persist from '../core/persist.js';

const NAV = [
  { path: '/overview',     label: 'Обзор',        icon: icons.home },
  { path: '/today',        label: 'Сегодня',      icon: icons.today },
  { path: '/queue',        label: 'Очередь',      icon: icons.queue },
  { path: '/appointments', label: 'Записи',       icon: icons.appointments },
  { path: '/masters',      label: 'Мастера',      icon: icons.masters },
  { path: '/clients',      label: 'Клиенты',      icon: icons.clients },
  { path: '/services',     label: 'Услуги',       icon: icons.services },
  { path: '/finance',      label: 'Финансы',      icon: icons.finance },
  { path: '/inventory',    label: 'Склад',        icon: icons.inventory },
  { path: '/analytics',    label: 'Аналитика',    icon: icons.analytics },
  { path: '/salons',       label: 'Салоны',       icon: icons.salons },
];

const BOTTOM = [
  { path: '/settings', label: 'Настройки', icon: icons.settings },
];

export function Sidebar() {
  const ui = persist.get(persist.KEYS.ui, {});
  let collapsed = ui.sidebarCollapsed || false;

  const root = el('aside.sidebar', { class: [collapsed ? 'is-collapsed' : ''] });

  const brand = el('div.sidebar-brand', {}, [
    el('div.sidebar-mark', { html: `
      <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
        <path d="M4 20 L12 4 L20 20 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="url(#sg)"/>
        <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
          <stop stop-color="#EFCE85"/><stop offset="1" stop-color="#8A6A2E" stop-opacity=".6"/>
        </linearGradient></defs>
      </svg>` }),
    el('div.sidebar-brand-text', {}, [
      el('div.sidebar-brand-name', { text: 'Навбат' }),
      el('div.sidebar-brand-sub',  { text: 'salon OS' }),
    ]),
  ]);

  const toggle = el('button.sidebar-toggle', {
    title: 'Свернуть панель',
    on: { click: () => {
      collapsed = !collapsed;
      root.classList.toggle('is-collapsed', collapsed);
      persist.set(persist.KEYS.ui, { ...persist.get(persist.KEYS.ui, {}), sidebarCollapsed: collapsed });
      renderItems();
    } },
    html: '<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  });

  const brandRow = el('div.sidebar-top', {}, [brand, toggle]);
  const nav = el('nav.sidebar-nav');
  const bottom = el('div.sidebar-bottom');

  function makeItem(item, active) {
    const btn = el('a.sidebar-item', {
      href: '#' + item.path,
      class: [active ? 'is-active' : ''],
      on: { click: (e) => { e.preventDefault(); go(item.path); } },
      title: item.label,
    }, [
      el('span.sidebar-item-icon', { html: item.icon({ size: 18 }) }),
      el('span.sidebar-item-label', { text: item.label }),
    ]);
    return btn;
  }

  function renderItems() {
    nav.innerHTML = '';
    bottom.innerHTML = '';
    const path = currentPath();
    NAV.forEach((item) => nav.append(makeItem(item, path === item.path)));
    bottom.append(el('div.sidebar-divider'));
    BOTTOM.forEach((item) => bottom.append(makeItem(item, path === item.path)));
    // Owner user chip
    bottom.append(el('div.sidebar-user', {}, [
      el('div.sidebar-user-avatar', { text: 'O' }),
      el('div.sidebar-user-text', {}, [
        el('div.sidebar-user-name', { text: 'Владелец' }),
        el('div.sidebar-user-role', { text: 'Owner · salon1' }),
      ]),
    ]));
  }

  on(window, 'route:changed', renderItems);
  renderItems();

  root.append(brandRow, nav, bottom);
  return root;
}

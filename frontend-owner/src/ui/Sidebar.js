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

/**
 * Sidebar с двумя режимами:
 * - PIN: постоянно раскрыт (когда пользователь пиннит через кнопку)
 * - HOVER: mini-режим по умолчанию, раскрывается при hover
 */
export function Sidebar() {
  const ui = persist.get(persist.KEYS.ui, {});
  let pinned = !!ui.sidebarPinned;   // true = развернут постоянно, false = hover-expand

  const root = el('aside.sidebar', {
    class: [pinned ? 'is-pinned' : 'is-hover'],
  });

  const brandMark = el('div.sidebar-mark', {
    html: `<img src="/barber_logo.svg" alt="Навбат" width="30" height="30" style="object-fit:contain;filter:brightness(1.1)" />`,
  });
  const brand = el('div.sidebar-brand', {}, [
    brandMark,
    el('div.sidebar-brand-text', {}, [
      el('div.sidebar-brand-name', { text: 'Навбат' }),
      el('div.sidebar-brand-sub',  { text: 'SALON OS' }),
    ]),
  ]);

  const toggle = el('button.sidebar-toggle', {
    title: pinned ? 'Открепить' : 'Закрепить',
    on: { click: () => {
      pinned = !pinned;
      root.classList.toggle('is-pinned', pinned);
      root.classList.toggle('is-hover', !pinned);
      toggle.title = pinned ? 'Открепить' : 'Закрепить';
      persist.set(persist.KEYS.ui, { ...persist.get(persist.KEYS.ui, {}), sidebarPinned: pinned });
      // Обновить body-класс для сдвига main
      document.querySelector('.app-shell')?.classList.toggle('sidebar-pinned', pinned);
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
    BOTTOM.forEach((item) => bottom.append(makeItem(item, path === item.path)));
    bottom.append(el('div.sidebar-user', {}, [
      el('div.sidebar-user-avatar', { text: 'O' }),
      el('div.sidebar-user-text', {}, [
        el('div.sidebar-user-name', { text: 'Владелец' }),
        el('div.sidebar-user-role', { text: 'Owner · Head office' }),
      ]),
    ]));
  }

  on(window, 'route:changed', renderItems);
  renderItems();

  root.append(brandRow, nav, bottom);

  // Инициализация shell класса
  requestAnimationFrame(() => {
    document.querySelector('.app-shell')?.classList.toggle('sidebar-pinned', pinned);
  });

  return root;
}

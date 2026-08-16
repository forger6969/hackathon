import { el, on, debounce } from '../core/dom.js';
import { icons } from './icons.js';
import { onState } from '../core/socket.js';
import { app } from '../core/store.js';
import { go } from '../router.js';

function connBadge() {
  const badge = el('div.live-badge', {}, [
    el('span.dot'),
    el('span', { text: 'ONLINE' }),
  ]);
  onState((state) => {
    badge.classList.remove('is-offline', 'is-error');
    const span = badge.querySelector('span:last-child');
    if (state === 'live')  { span.textContent = 'ONLINE';  }
    else if (state === 'error') { badge.classList.add('is-error');   span.textContent = 'OFFLINE'; }
    else if (state === 'connecting') { badge.classList.add('is-offline'); span.textContent = 'CONNECTING…'; }
    else { badge.classList.add('is-offline'); span.textContent = 'DEMO'; }
  });
  return badge;
}

function salonSelect() {
  const wrap = el('div.salon-select');
  const btn = el('button.salon-select-btn', {}, [
    el('span.salon-select-icon', { html: icons.salons({ size: 14 }) }),
    el('span.salon-select-label', { text: 'Все салоны' }),
    el('span.salon-select-chev', { html: icons.chevronDown({ size: 12 }) }),
  ]);
  const dropdown = el('div.salon-select-drop', { hidden: true });

  function renderList() {
    const s = app.get();
    dropdown.innerHTML = '';
    const items = [{ _id: null, name: 'Все салоны', address: `${s.masters?.length ?? 0} мастеров` }, ...(s.salons || [])];
    items.forEach((it) => {
      const active = s.currentSalonId === it._id;
      const item = el('button.salon-select-item', {
        class: [active ? 'is-active' : ''],
        on: { click: () => {
          app.set({ currentSalonId: it._id });
          btn.querySelector('.salon-select-label').textContent = it.name;
          dropdown.hidden = true;
          renderList();
        } },
      }, [
        el('span.salon-select-item-mark', { text: it.name[0] }),
        el('div', {}, [
          el('div.salon-select-item-name', { text: it.name }),
          el('div.salon-select-item-sub',  { text: it.address || '' }),
        ]),
        active ? el('span.salon-select-item-check', { html: icons.check({ size: 12 }) }) : null,
      ]);
      dropdown.append(item);
    });
  }

  on(btn, 'click', (e) => { e.stopPropagation(); dropdown.hidden = !dropdown.hidden; renderList(); });
  on(document, 'click', (e) => { if (!wrap.contains(e.target)) dropdown.hidden = true; });
  app.subscribe(() => {
    const s = app.get();
    const cur = s.salons.find((x) => x._id === s.currentSalonId);
    btn.querySelector('.salon-select-label').textContent = cur ? cur.name : 'Все салоны';
  });

  wrap.append(btn, dropdown);
  return wrap;
}

function globalSearch() {
  const wrap = el('div.top-search');
  const input = el('input.top-search-input', {
    type: 'search',
    placeholder: 'Поиск клиента, мастера, услуги…',
    autocomplete: 'off',
  });
  wrap.append(el('span.top-search-icon', { html: icons.search({ size: 14 }) }), input);

  const results = el('div.top-search-results', { hidden: true });
  wrap.append(results);

  const runSearch = debounce(() => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.hidden = true; return; }
    const s = app.get();
    const matches = [];
    (s.masters || []).forEach((m) => { if (m.name.toLowerCase().includes(q)) matches.push({ type: 'Мастер', name: m.name, sub: m.active ? 'активен' : 'неактивен', path: '/masters?m=' + m._id }); });
    (s.services || []).forEach((sv) => { if (sv.name.toLowerCase().includes(q)) matches.push({ type: 'Услуга', name: sv.name, sub: `${sv.price} сум`, path: '/services' }); });
    (s.queue || []).forEach((q) => { if (q.clientName?.toLowerCase().includes(q) || q.phone?.includes(q)) matches.push({ type: 'Клиент', name: q.clientName, sub: q.phone || q.status, path: '/queue' }); });
    results.innerHTML = '';
    if (matches.length === 0) {
      results.append(el('div.top-search-empty', { text: 'Ничего не найдено' }));
    } else {
      matches.slice(0, 8).forEach((m) => {
        results.append(el('button.top-search-item', {
          on: { click: () => { input.value = ''; results.hidden = true; go(m.path); } },
        }, [
          el('span.top-search-item-type', { text: m.type }),
          el('div', {}, [
            el('div.top-search-item-name', { text: m.name }),
            el('div.top-search-item-sub',  { text: m.sub }),
          ]),
        ]));
      });
    }
    results.hidden = false;
  }, 180);

  on(input, 'input', runSearch);
  on(input, 'focus', runSearch);
  on(document, 'click', (e) => { if (!wrap.contains(e.target)) results.hidden = true; });

  return wrap;
}

export function Topbar() {
  const root = el('header.topbar-wrap');

  const left = el('div.topbar-left', {}, [salonSelect()]);
  const center = el('div.topbar-center', {}, [globalSearch()]);
  const right = el('div.topbar-right', {}, [
    connBadge(),
    el('button.icon-btn', { title: 'Уведомления', 'aria-label': 'Уведомления', html: icons.bell({ size: 16 }) }),
    el('button.icon-btn', { title: 'Обновить (R)', id: 'topbar-refresh', html: icons.refresh({ size: 16 }) }),
    el('div.topbar-avatar', { text: 'O', title: 'Владелец' }),
  ]);

  root.append(left, center, right);
  return root;
}

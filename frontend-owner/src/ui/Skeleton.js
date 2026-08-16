import { el } from '../core/dom.js';

/** Skeleton box */
export function skeleton({ w = '100%', h = 14, r = 6 } = {}) {
  return el('span.skeleton', { style: { width: typeof w === 'number' ? w + 'px' : w, height: h + 'px', borderRadius: r + 'px' } });
}

/** Empty state */
export function emptyState({ icon, title, description, action }) {
  return el('div.empty-state', {}, [
    icon ? el('div.empty-state-icon', { html: icon }) : null,
    el('div.empty-state-title', { text: title }),
    description ? el('div.empty-state-desc', { text: description }) : null,
    action ? el('div.empty-state-action', {}, [action]) : null,
  ]);
}

export function errorState({ title = 'Не удалось загрузить', description, retry }) {
  return el('div.empty-state.empty-state--error', {}, [
    el('div.empty-state-title', { text: title }),
    description ? el('div.empty-state-desc', { text: description }) : null,
    retry ? el('button.btn-ghost', { on: { click: retry } }, ['Попробовать снова']) : null,
  ]);
}

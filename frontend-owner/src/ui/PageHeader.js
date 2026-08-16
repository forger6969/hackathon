import { el } from '../core/dom.js';

/** Единый заголовок для страниц: eyebrow + title + subtitle + actions */
export function PageHeader({ eyebrow, title, subtitle, actions = [] } = {}) {
  return el('header.page-header', {}, [
    el('div.page-header-text', {}, [
      eyebrow ? el('div.eyebrow-sm', { text: eyebrow }) : null,
      el('h1.page-title', { text: title }),
      subtitle ? el('p.page-sub', { text: subtitle }) : null,
    ]),
    actions.length ? el('div.page-header-actions', {}, actions) : null,
  ]);
}

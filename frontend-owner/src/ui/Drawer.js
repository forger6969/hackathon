import { el, on } from '../core/dom.js';
import { icons } from './icons.js';

let openStack = [];

/** openDrawer({title, eyebrow, content, footer}) → { close } */
export function openDrawer({ title = '', eyebrow = null, content, footer = null } = {}) {
  const overlay = el('div.drawer-overlay');
  const drawer = el('aside.drawer.card', { role: 'dialog' }, [
    el('header.drawer-head', {}, [
      el('div', {}, [
        eyebrow ? el('div.eyebrow-sm', { text: eyebrow }) : null,
        el('h3.drawer-title', { text: title }),
      ]),
      el('button.modal-close', { type: 'button', 'aria-label': 'Закрыть', 'data-close': '', html: icons.close({ size: 14 }) }),
    ]),
    el('div.drawer-body', {}, [content].filter(Boolean)),
    footer ? el('footer.drawer-foot', {}, [footer]) : null,
  ]);

  overlay.append(drawer);
  document.body.append(overlay);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => overlay.classList.add('is-open'));
  openStack.push(close);

  function close() {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 250);
    openStack = openStack.filter((f) => f !== close);
    if (openStack.length === 0) document.body.style.overflow = '';
  }

  on(overlay, 'click', (e) => { if (e.target === overlay || e.target.closest('[data-close]')) close(); });
  on(document, 'keydown', escHandler);
  function escHandler(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } }

  return { close };
}

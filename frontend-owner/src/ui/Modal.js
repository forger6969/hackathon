import { el, on } from '../core/dom.js';
import { icons } from './icons.js';

let openStack = [];

function trapClose(overlay, onClose) {
  const handler = (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) { onClose(); }
  };
  on(overlay, 'click', handler);
}

/** openModal({ title, eyebrow, content: Node, actions: [{label, kind, onClick}] }) → { close } */
export function openModal({ title = 'Действие', eyebrow = null, content, actions = [], size = 'md' } = {}) {
  const overlay = el('div.modal-overlay');
  const body = el('div.modal-body');
  if (content) body.append(content);

  const actionsRow = el('div.modal-actions');
  actions.forEach((a) => {
    const cls = a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-danger-large' : 'btn-ghost';
    const btn = el(`button.${cls}`, { type: 'button', on: { click: () => a.onClick?.(close) } }, [a.label]);
    actionsRow.append(btn);
  });
  if (actions.length) body.append(actionsRow);

  const modal = el(`div.modal.card.modal--${size}`, { role: 'dialog' }, [
    el('header.modal-head', {}, [
      el('div', {}, [
        eyebrow ? el('div.eyebrow-sm', { text: eyebrow }) : null,
        el('h3.modal-title', { text: title }),
      ]),
      el('button.modal-close', { type: 'button', 'aria-label': 'Закрыть', 'data-close': '', html: icons.close({ size: 14 }) }),
    ]),
    body,
  ]);

  overlay.append(modal);
  document.body.append(overlay);
  document.body.style.overflow = 'hidden';
  openStack.push(close);

  function close() {
    overlay.remove();
    openStack = openStack.filter((f) => f !== close);
    if (openStack.length === 0) document.body.style.overflow = '';
  }

  trapClose(overlay, close);
  on(document, 'keydown', escHandler);
  function escHandler(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } }

  return { close };
}

/** Простой confirm: openConfirm({title, message, okText, okKind, onOk}) */
export function openConfirm({ title = 'Подтвердите', eyebrow = 'действие', message = '', okText = 'Подтвердить', okKind = 'primary', onOk } = {}) {
  const msg = el('p.modal-msg', { html: message });
  return openModal({
    title, eyebrow,
    content: msg,
    size: 'sm',
    actions: [
      { label: 'Отмена', kind: 'ghost', onClick: (close) => close() },
      { label: okText, kind: okKind, onClick: (close) => { onOk?.(); close(); } },
    ],
  });
}

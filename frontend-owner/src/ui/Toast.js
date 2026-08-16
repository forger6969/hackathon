import { el } from '../core/dom.js';

let stack;
function ensureStack() {
  if (stack) return stack;
  stack = el('div.toast-stack', { 'aria-live': 'polite' });
  document.body.append(stack);
  return stack;
}

export function toast(html, opts = {}) {
  const kind = opts.kind || '';
  const t = el(`div.toast${kind ? ' toast--' + kind : ''}`);
  t.innerHTML = `<span class="toast-dot"></span><div>${html}</div>`;
  ensureStack().append(t);
  setTimeout(() => t.remove(), opts.duration || 4200);
  return t;
}

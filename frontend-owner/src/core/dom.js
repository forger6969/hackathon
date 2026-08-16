// DOM helpers
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * Создать элемент. tag поддерживает CSS-like шорткаты: 'div.card', 'button#save.btn.btn-primary'.
 * attrs могут содержать: html, text, on: {click, ...}, dataset: {...}, style: {...}, любые атрибуты
 */
export function el(tag, attrs = {}, children = []) {
  const m = tag.match(/^([a-z0-9-]+)?(#[^.#]+)?(.*)$/i);
  const tagName = (m && m[1]) || 'div';
  const id = m && m[2] ? m[2].slice(1) : null;
  const classes = (m && m[3] ? m[3].split('.').filter(Boolean) : []);
  const node = document.createElement(tagName);
  if (id) node.id = id;
  if (classes.length) node.className = classes.join(' ');

  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'html')      node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'on')   for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'class' && Array.isArray(v)) node.className = [...classes, ...v].filter(Boolean).join(' ');
    else if (k in node && typeof node[k] !== 'function') { try { node[k] = v; } catch { node.setAttribute(k, v); } }
    else node.setAttribute(k, v);
  }

  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(c));
  }
  return node;
}

/** Bind event with automatic cleanup — returns off() */
export function on(target, event, handler, options) {
  target.addEventListener(event, handler, options);
  return () => target.removeEventListener(event, handler, options);
}

/** Trigger a CSS restart-animation via class toggle */
export function pulse(node, className = 'is-pulse') {
  if (!node) return;
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

/** Count-up animation for numeric text nodes */
export function countUp(node, from, to, duration = 700, formatter = (v) => Math.round(v)) {
  if (!node) return;
  if (from === to) { node.textContent = formatter(to); return; }
  const t0 = performance.now();
  function step(now) {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = formatter(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(step);
    else node.textContent = formatter(to);
  }
  requestAnimationFrame(step);
}

/** Debounce */
export function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Simple `hidden` toggle wrapper */
export const show = (node) => { if (node) node.hidden = false; };
export const hide = (node) => { if (node) node.hidden = true; };

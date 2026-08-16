// Hash-based router. Не тащим history API чтобы не воевать с dev-server rewriting.
const routes = new Map();
let mount = null;
let notFound = null;

export function register(path, handler) { routes.set(path, handler); }
export function setNotFound(handler) { notFound = handler; }
export function attach(container) { mount = container; }

export function go(path) {
  const clean = path.startsWith('#') ? path : '#' + path;
  if (location.hash === clean) render();
  else location.hash = clean;
}

export function currentPath() {
  const raw = location.hash.replace(/^#/, '') || '/overview';
  return raw.split('?')[0];
}

export function currentQuery() {
  const raw = location.hash.split('?')[1] || '';
  return Object.fromEntries(new URLSearchParams(raw));
}

async function render() {
  if (!mount) return;
  const path = currentPath();
  const handler = routes.get(path) || notFound;
  if (!handler) return;
  mount.innerHTML = '';
  try {
    const result = await handler({ path, query: currentQuery(), mount });
    if (result instanceof Node) mount.append(result);
  } catch (err) {
    console.error('Route error', err);
    mount.append(document.createTextNode('Ошибка загрузки страницы: ' + err.message));
  }
  // Notify sidebar / anything else that route changed
  window.dispatchEvent(new CustomEvent('route:changed', { detail: { path } }));
  // Scroll to top on nav
  mount.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);

export { render };

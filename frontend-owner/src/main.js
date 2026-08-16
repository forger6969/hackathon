// Entry point — Owner Dashboard v3
// Модульная архитектура: sidebar + topbar + hash-router + real backend + Socket.io
import '../style.css';
import '../extension.css';
import './styles/layout.css';

import { el } from './core/dom.js';
import { app } from './core/store.js';
import * as api from './core/api.js';
import { connect as socketConnect, onEvent as onSocket, onState as onSocketState } from './core/socket.js';
import * as router from './router.js';
import { Sidebar } from './ui/Sidebar.js';
import { Topbar } from './ui/Topbar.js';
import { toast } from './ui/Toast.js';

// ─── Register routes ─────────────────────
import overview from './pages/overview.js';
import today from './pages/today.js';
import queue from './pages/queue.js';
import appointments from './pages/appointments.js';
import masters from './pages/masters.js';
import clients from './pages/clients.js';
import services from './pages/services.js';
import finance from './pages/finance.js';
import inventory from './pages/inventory.js';
import analytics from './pages/analytics.js';
import salons from './pages/salons.js';
import settings from './pages/settings.js';

router.register('/overview',     overview);
router.register('/today',        today);
router.register('/queue',        queue);
router.register('/appointments', appointments);
router.register('/masters',      masters);
router.register('/clients',      clients);
router.register('/services',     services);
router.register('/finance',      finance);
router.register('/inventory',    inventory);
router.register('/analytics',    analytics);
router.register('/salons',       salons);
router.register('/settings',     settings);
router.setNotFound(() => {
  return el('div', { style: { padding: '60px 24px', textAlign: 'center' } }, [
    el('div', { style: { color: 'var(--gold-bright)', fontSize: '72px', fontFamily: 'var(--font-num)', fontWeight: 500, opacity: 0.5 }, text: '404' }),
    el('div', { style: { color: 'var(--text-strong)', fontSize: '18px', fontWeight: 600, marginTop: '12px' }, text: 'Страница не найдена' }),
    el('button.btn-primary', { style: { marginTop: '20px' }, on: { click: () => router.go('/overview') } }, ['На главную']),
  ]);
});

// Redirect root
if (!location.hash || location.hash === '#/' || location.hash === '#') {
  location.hash = '#/overview';
}

// ─── Build app shell ─────────────────────
const shell = el('div.app-shell', {}, [Sidebar()]);
const mainArea = el('div.main-area', {}, [Topbar(), el('main.page-container', { id: 'app-content' })]);
shell.append(mainArea);
document.body.append(shell);

router.attach(document.getElementById('app-content'));

// ─── Initial data load ───────────────────
async function bootstrap() {
  if (!api.HAS_BACKEND) {
    toast('Работаю без бэкенда — VITE_API_URL не задан. Данные только из моков.');
    app.set({ ready: true });
    return;
  }

  const [salonsR, mastersR, servicesR, stockR, todayR, queueR] = await Promise.allSettled([
    api.salons.list(),
    api.masters.list(),
    api.services.list(),
    api.stock.list(),
    api.owner.today(),
    api.queue.all(),
  ]);

  app.set({
    salons:   salonsR.status === 'fulfilled'   ? salonsR.value   : [],
    masters:  mastersR.status === 'fulfilled'  ? mastersR.value  : [],
    services: servicesR.status === 'fulfilled' ? servicesR.value : [],
    stock:    stockR.status === 'fulfilled'    ? stockR.value    : [],
    today:    todayR.status === 'fulfilled'    ? todayR.value    : null,
    queue:    queueR.status === 'fulfilled'    ? queueR.value    : [],
    ready: true,
  });

  const failed = [salonsR, mastersR, servicesR, stockR, todayR, queueR].filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.warn(`${failed.length} endpoints failed`, failed);
  }
}

// ─── Socket.io ───────────────────────────
socketConnect();
onSocketState((state) => app.set({ connState: state }));

let refetchDebounce;
onSocket('queue:update', () => {
  clearTimeout(refetchDebounce);
  refetchDebounce = setTimeout(async () => {
    try {
      const [todayR, queueR] = await Promise.all([api.owner.today(), api.queue.all()]);
      app.set({ today: todayR, queue: queueR });
      window.dispatchEvent(new CustomEvent('data:refresh'));
    } catch (err) { console.error('refetch failed', err); }
  }, 250);
});

// ─── Global refresh button in topbar ────
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('topbar-refresh');
  btn?.addEventListener('click', async () => {
    await bootstrap();
    window.dispatchEvent(new CustomEvent('data:refresh'));
    toast('Данные обновлены');
  });
});

// ─── Keyboard shortcuts ──────────────────
let gPressed = false, gTimeout;
document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  // Cmd/Ctrl+K — focus search
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.querySelector('.top-search-input')?.focus();
    return;
  }

  // g+X vim-like navigation
  if (gPressed) {
    const map = { o: '/overview', q: '/queue', m: '/masters', f: '/finance', i: '/inventory', a: '/analytics', c: '/clients', s: '/salons', t: '/today' };
    const path = map[e.key.toLowerCase()];
    if (path) router.go(path);
    gPressed = false;
    return;
  }
  if (e.key === 'g') {
    gPressed = true;
    clearTimeout(gTimeout);
    gTimeout = setTimeout(() => { gPressed = false; }, 1200);
  }
});

// ─── Boot ────────────────────────────────
bootstrap();

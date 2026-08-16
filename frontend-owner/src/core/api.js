// Единая точка входа для всех HTTP-вызовов к backend
export const API_URL = import.meta.env.VITE_API_URL || '';
export const HAS_BACKEND = !!API_URL;

async function request(path, init = {}) {
  if (!HAS_BACKEND) throw new Error('backend-not-configured');
  const res = await fetch(`${API_URL}${path}`, {
    headers: init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json', ...(init.headers || {}) } : (init.headers || {}),
    ...init,
    body: init.body && typeof init.body === 'object' && !(init.body instanceof FormData)
      ? JSON.stringify(init.body)
      : init.body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}

// ─── Catalog ───────────────────────────────────
export const salons = { list: () => request('/api/salons') };

export const masters = {
  /** ?salonId= фильтр по салону; ?onDuty=true — только на линии */
  list: (opts = {}) => {
    const p = new URLSearchParams();
    if (opts.salonId) p.set('salonId', opts.salonId);
    if (opts.onDuty)  p.set('onDuty', 'true');
    const q = p.toString();
    return request(`/api/masters${q ? '?' + q : ''}`);
  },
  /** Статистика конкретного мастера за сегодня */
  today: (id) => request(`/api/masters/${id}/today`),
  /** Переключить статус "на линии" */
  setDuty: (id, onDuty) => request(`/api/masters/${id}/duty`, { method: 'POST', body: { onDuty } }),
  /** Логин мастера (для master-фронта, не owner) */
  login: (name, password) => request('/api/masters/login', { method: 'POST', body: { name, password } }),
};

export const services = { list: () => request('/api/services') };
export const stock    = { list: () => request('/api/stock') };

// ─── Queue ─────────────────────────────────────
export const queue = {
  /** Все активные записи всех мастеров (reception view) */
  all: () => request('/api/queue'),
  /** Живая очередь одного мастера с ETA */
  byMaster: (masterId) => request(`/api/queue/${masterId}`),
  /** Создать запись; scheduledFor опционально */
  create: (payload) => request('/api/queue', { method: 'POST', body: payload }),
  /** Изменить статус (waiting|called|in_progress|done|skipped|cancelled) */
  setStatus: (id, status) => request(`/api/queue/${id}/status`, { method: 'POST', body: { status } }),
  /** Активировать scheduled запись */
  checkin: (id) => request(`/api/queue/${id}/checkin`, { method: 'POST' }),
  /** Отметить оплачено (method: 'cash'|'card') */
  pay: (id, method) => request(`/api/queue/${id}/pay`, { method: 'POST', body: { method } }),
};

// ─── Owner ─────────────────────────────────────
export const owner = {
  /** { clientsServed, revenue, cashRevenue, cardRevenue, lowStock[], activeMasters, totalMasters, onDutyMasters } */
  today: () => request('/api/owner/today'),
};

// ─── Health ────────────────────────────────────
export const health = () => request('/health');

// ─── Payroll history (UI-only, backend endpoint пока нет) ─
import { get, set, KEYS } from './persist.js';
export const payroll = {
  list: () => get(KEYS.payroll, []),
  add: (entry) => {
    const list = get(KEYS.payroll, []);
    const created = { id: 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), method: 'cash', paidAt: Date.now(), ...entry };
    list.push(created);
    set(KEYS.payroll, list);
    return created;
  },
  clear: () => set(KEYS.payroll, []),
};

/**
 * Расчёт payout на клиенте. Использует реальные поля Master (salaryType/salaryFixed/salaryPercent).
 * revenueMonth — сумма выручки, сгенерированной мастером за отчётный период.
 * Возвращает { base, commission, bonus, total }.
 *
 * Соответствует формуле бэка (`routes/catalog.js /masters/:id/today`):
 *   fixed   → salaryFixed
 *   percent → revenue * (salaryPercent/100)
 *   hybrid  → salaryFixed + revenue * (salaryPercent/100)
 */
export function calcPayout(master, revenueMonth = 0) {
  if (!master) return { base: 0, commission: 0, bonus: 0, total: 0 };
  const type = master.salaryType || 'fixed';
  const fixed = Number(master.salaryFixed || 0);
  const percent = Number(master.salaryPercent || 0);
  let base = 0, commission = 0;
  if (type === 'fixed')   base = fixed;
  else if (type === 'percent') commission = Math.round(revenueMonth * percent / 100);
  else /* hybrid */ { base = fixed; commission = Math.round(revenueMonth * percent / 100); }
  const bonus = 0; // на бэке пока нет
  return { base, commission, bonus, total: base + commission + bonus };
}

/** Название для salaryType */
export const salaryLabel = (t) => ({ fixed: 'Фиксированный', percent: 'Процент', hybrid: 'Фикс + процент' }[t] || 'Фиксированный');

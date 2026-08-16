// Единая точка входа для всех HTTP-вызовов к backend
// Каждый метод имеет demo-fallback: если backend недоступен, возвращает
// реалистичные демо-данные (см. demo.js), UI остаётся полностью рабочим.
import { demoData, demoMasterToday, IS_DEMO } from './demo.js';

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

/** Обёртка: пытается real, при ошибке ставит IS_DEMO=true и возвращает fallback */
async function withDemo(realFn, fallback) {
  try {
    const data = await realFn();
    IS_DEMO.value = false;
    return data;
  } catch (err) {
    IS_DEMO.value = true;
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

// ─── Catalog ───────────────────────────────────
export const salons = {
  list: () => withDemo(() => request('/api/salons'), demoData.salons),
};

export const masters = {
  list: (opts = {}) => withDemo(() => {
    const p = new URLSearchParams();
    if (opts.salonId) p.set('salonId', opts.salonId);
    if (opts.onDuty)  p.set('onDuty', 'true');
    const q = p.toString();
    return request(`/api/masters${q ? '?' + q : ''}`);
  }, () => {
    let list = demoData.masters;
    if (opts.salonId) list = list.filter((m) => m.salonId === opts.salonId);
    if (opts.onDuty)  list = list.filter((m) => m.onDuty);
    return list;
  }),

  today: (id) => withDemo(() => request(`/api/masters/${id}/today`), () => demoMasterToday(id)),

  setDuty: (id, onDuty) => withDemo(() => request(`/api/masters/${id}/duty`, { method: 'POST', body: { onDuty } }), () => {
    const m = demoData.masters.find((x) => x._id === id);
    if (m) { m.onDuty = onDuty; if (onDuty) m.dutyStartedAt = new Date(); else m.dutyStartedAt = null; }
    return m;
  }),

  login: (name, password) => request('/api/masters/login', { method: 'POST', body: { name, password } }),
};

export const services = { list: () => withDemo(() => request('/api/services'), demoData.services) };
export const stock    = { list: () => withDemo(() => request('/api/stock'), demoData.stock) };

// ─── Queue ─────────────────────────────────────
export const queue = {
  all: () => withDemo(() => request('/api/queue'), demoData.queue.filter((q) => ['waiting', 'called', 'in_progress', 'scheduled'].includes(q.status))),

  byMaster: (masterId) => withDemo(() => request(`/api/queue/${masterId}`), () =>
    demoData.queue.filter((q) => q.masterId === masterId && ['waiting', 'called', 'in_progress', 'scheduled'].includes(q.status)),
  ),

  create: (payload) => withDemo(() => request('/api/queue', { method: 'POST', body: payload }), () => {
    const item = { _id: 'd-q-' + Date.now(), status: 'waiting', createdAt: new Date(), paid: false, ...payload };
    demoData.queue.push(item);
    return item;
  }),

  setStatus: (id, status) => withDemo(() => request(`/api/queue/${id}/status`, { method: 'POST', body: { status } }), () => {
    const it = demoData.queue.find((q) => q._id === id);
    if (it) { it.status = status; if (status === 'done') it.doneAt = new Date(); if (status === 'called') it.calledAt = new Date(); }
    return it;
  }),

  checkin: (id) => withDemo(() => request(`/api/queue/${id}/checkin`, { method: 'POST' }), () => {
    const it = demoData.queue.find((q) => q._id === id);
    if (it && it.status === 'scheduled') { it.status = 'waiting'; it.createdAt = new Date(); }
    return it;
  }),

  pay: (id, method) => withDemo(() => request(`/api/queue/${id}/pay`, { method: 'POST', body: { method } }), () => {
    const it = demoData.queue.find((q) => q._id === id);
    if (it) { it.paid = true; it.paymentMethod = method; }
    return it;
  }),
};

// ─── Owner ─────────────────────────────────────
export const owner = {
  today: () => withDemo(() => request('/api/owner/today'), () => {
    // Пересчитываем актуально из demoData.queue (может меняться при действиях)
    const svcById = Object.fromEntries(demoData.services.map((s) => [s._id, s]));
    const done = demoData.queue.filter((q) => q.status === 'done');
    const revenue = done.reduce((s, q) => s + (svcById[q.serviceId]?.price || 0), 0);
    const cash = done.filter((q) => q.paid && q.paymentMethod === 'cash').reduce((s, q) => s + (svcById[q.serviceId]?.price || 0), 0);
    const card = done.filter((q) => q.paid && q.paymentMethod === 'card').reduce((s, q) => s + (svcById[q.serviceId]?.price || 0), 0);
    return {
      clientsServed: done.length,
      revenue,
      cashRevenue: cash,
      cardRevenue: card,
      lowStock: demoData.stock.filter((s) => s.qty < s.lowThreshold),
      activeMasters: new Set(demoData.queue.map((q) => q.masterId)).size,
      totalMasters: demoData.masters.length,
      onDutyMasters: demoData.masters.filter((m) => m.onDuty).length,
    };
  }),
};

export const health = () => request('/health');

/** Флаг для UI: сейчас работаем на демо-данных */
export const isDemo = () => IS_DEMO.value;

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

/** Расчёт payout по формуле бэка. */
export function calcPayout(master, revenueMonth = 0) {
  if (!master) return { base: 0, commission: 0, bonus: 0, total: 0 };
  const type = master.salaryType || 'fixed';
  const fixed = Number(master.salaryFixed || 0);
  const percent = Number(master.salaryPercent || 0);
  let base = 0, commission = 0;
  if (type === 'fixed')   base = fixed;
  else if (type === 'percent') commission = Math.round(revenueMonth * percent / 100);
  else /* hybrid */ { base = fixed; commission = Math.round(revenueMonth * percent / 100); }
  const bonus = 0;
  return { base, commission, bonus, total: base + commission + bonus };
}

export const salaryLabel = (t) => ({ fixed: 'Фиксированный', percent: 'Процент', hybrid: 'Фикс + процент' }[t] || 'Фиксированный');

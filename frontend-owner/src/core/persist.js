// LocalStorage abstraction with namespaced keys and JSON serialization
const NS = 'navbat';

const key = (k) => `${NS}.${k}`;

export function get(k, fallback = null) {
  try {
    const raw = localStorage.getItem(key(k));
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function set(k, value) {
  try { localStorage.setItem(key(k), JSON.stringify(value)); return true; }
  catch { return false; }
}

export function del(k) {
  try { localStorage.removeItem(key(k)); return true; }
  catch { return false; }
}

// Известные ключи в одном месте
export const KEYS = {
  employees: 'employees.v1',      // {[masterId]: {salary, salaryType, commission, hiredAt}}
  payroll:   'payroll.v1',        // [{id, employeeId, employeeName, amount, method, paidAt}]
  ui:        'ui.v1',             // {sidebarCollapsed, currentSalon, ...}
  demoState: 'demo.v1',           // моковые статы для демо-режима
};

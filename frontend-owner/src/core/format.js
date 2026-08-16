// Formatters — единая точка для чисел, дат, валюты
const NF_RU = new Intl.NumberFormat('ru-RU');

export const fmt = (n) => NF_RU.format(Math.round(n ?? 0));

export const fmtShort = (n) => {
  const v = Math.round(n ?? 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)     return Math.round(v / 100) / 10 + 'k';
  return String(v);
};

export const fmtSum = (n) => fmt(n) + ' сум';

export const fmtDateLong = (d) =>
  new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });

export const fmtDateShort = (d) =>
  new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });

export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export const fmtDuration = (ms) => {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem ? `${h}ч ${rem}м` : `${h}ч`;
};

export const timeAgo = (ts) => {
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec} сек назад`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.round(h / 24)} дн назад`;
};

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

export const initials = (name) => {
  const n = String(name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/);
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
};

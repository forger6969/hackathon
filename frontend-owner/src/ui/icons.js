// Централизованный SVG-icon-set. Все размеры контролируются CSS через currentColor.
const svg = (path, opts = {}) => `<svg viewBox="0 0 24 24" fill="none" width="${opts.size || 18}" height="${opts.size || 18}">${path}</svg>`;

export const icons = {
  home: (o) => svg(`<path d="M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`, o),
  today: (o) => svg(`<rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`, o),
  queue: (o) => svg(`<path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`, o),
  appointments: (o) => svg(`<rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M8 3v4M16 3v4M3 11h18M8 15h.01M12 15h.01M16 15h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`, o),
  masters: (o) => svg(`<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`, o),
  clients: (o) => svg(`<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`, o),
  services: (o) => svg(`<path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`, o),
  finance: (o) => svg(`<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`, o),
  inventory: (o) => svg(`<path d="M21 8V6a2 2 0 00-2-2H5a2 2 0 00-2 2v2M3 8v10a2 2 0 002 2h14a2 2 0 002-2V8M3 8h18M9 12h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`, o),
  analytics: (o) => svg(`<path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`, o),
  salons: (o) => svg(`<path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="1.6"/>`, o),
  settings: (o) => svg(`<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9L4.2 6.7A2 2 0 117 3.9l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" stroke="currentColor" stroke-width="1.5"/>`, o),

  chevronRight: (o) => svg(`<path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`, o),
  chevronDown: (o) => svg(`<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`, o),
  plus: (o) => svg(`<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`, o),
  close: (o) => svg(`<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`, o),
  bell: (o) => svg(`<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`, o),
  search: (o) => svg(`<circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`, o),
  play: (o) => svg(`<path d="M6 4l14 8-14 8V4z" fill="currentColor"/>`, o),
  refresh: (o) => svg(`<path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`, o),
  check: (o) => svg(`<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`, o),
  arrowUp: (o) => svg(`<path d="M6 2 L10 8 L2 8 Z" fill="currentColor" transform="scale(1.4) translate(1 2)"/>`, o),
  warn: (o) => svg(`<path d="M12 3l10 18H2L12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 10v5M12 18h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`, o),
  logout: (o) => svg(`<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`, o),
  menu: (o) => svg(`<path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`, o),
  moreVertical: (o) => svg(`<circle cx="12" cy="6" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/>`, o),
};

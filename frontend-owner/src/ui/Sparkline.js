import { el } from '../core/dom.js';

/** Sparkline SVG. data — number[], color — стоп-цвет. */
export function Sparkline({ data = [], color = '#EFCE85', w = 100, h = 30 } = {}) {
  const svg = el('svg.sparkline', {
    viewBox: `0 0 ${w} ${h}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
  });
  update({ data, color });

  function update({ data: nextData, color: nextColor }) {
    const arr = (nextData || []).length ? nextData : [0, 0];
    const c = nextColor || color;
    const pad = 2;
    const max = Math.max(1, ...arr);
    const min = Math.min(...arr);
    const range = Math.max(1, max - min);
    const stepX = (w - pad * 2) / Math.max(1, arr.length - 1);
    const pts = arr.map((v, i) => [pad + stepX * i, pad + (h - pad * 2) * (1 - (v - min) / range)]);
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1], p1 = pts[i];
      const cpX = (p0[0] + p1[0]) / 2;
      d += ` C ${cpX.toFixed(1)} ${p0[1].toFixed(1)}, ${cpX.toFixed(1)} ${p1[1].toFixed(1)}, ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
    }
    const area = d + ` L ${w} ${h} L 0 ${h} Z`;
    const gid = 'sp-g-' + Math.random().toString(36).slice(2, 8);
    svg.innerHTML = `
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stop-color="${c}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${gid})"/>
      <path d="${d}" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  svg.update = update;
  return svg;
}

/** Синтетическая волна для превью (пока нет истории) */
export function seedWave(peak, points = 12) {
  const arr = [];
  for (let i = 0; i < points; i++) {
    const wave = 0.5 + 0.35 * Math.sin(i * 0.9 + peak * 0.01);
    const trend = (i / (points - 1)) * 0.4;
    arr.push(Math.max(0.05, wave + trend) * peak);
  }
  return arr;
}

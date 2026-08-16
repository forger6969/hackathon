import { el, on } from '../core/dom.js';
import { fmt, fmtShort, escapeHtml } from '../core/format.js';

/**
 * StackedAreaChart для почасовой выручки × сервисов.
 * data — [{ label, buckets: {[seriesName]: number} }]
 * series — [{ name, color }]
 * Возвращает Node с .update(data).
 */
export function StackedAreaChart({ data = [], series = [], nowIdx = null, W = 800, H = 260, pad = { top: 16, right: 16, bottom: 30, left: 44 } } = {}) {
  const svg = el('svg.chart-svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' });
  const tooltip = el('div.chart-tooltip', { role: 'tooltip' });
  const wrap = el('div.chart-wrap', {}, [svg, tooltip]);

  const IW = W - pad.left - pad.right;
  const IH = H - pad.top - pad.bottom;

  let current = { data, series, nowIdx };

  function render() {
    const { data, series, nowIdx } = current;
    const N = data.length;
    if (N === 0 || series.length === 0) { svg.innerHTML = ''; return; }

    const stacks = series.map((s) => data.map((d) => d.buckets[s.name] || 0));
    const totals = data.map((d) => series.reduce((sum, s) => sum + (d.buckets[s.name] || 0), 0));
    const yMax = Math.max(60_000, ...totals) * 1.15;

    const xAt = (i) => pad.left + (IW / Math.max(1, N - 1)) * i;
    const yAt = (v) => pad.top + IH * (1 - v / yMax);

    const yTicks = 4;
    const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((yMax * i) / yTicks));

    const cumul = data.map(() => 0);
    const areas = [];
    series.forEach((svc, si) => {
      const topPts = [], botPts = [];
      for (let i = 0; i < N; i++) {
        const bot = cumul[i], top = bot + stacks[si][i];
        botPts.push([xAt(i), yAt(bot)]);
        topPts.push([xAt(i), yAt(top)]);
        cumul[i] = top;
      }
      let d = `M ${topPts[0][0].toFixed(1)} ${topPts[0][1].toFixed(1)}`;
      for (let i = 1; i < N; i++) {
        const p0 = topPts[i - 1], p1 = topPts[i];
        const cpX = (p0[0] + p1[0]) / 2;
        d += ` C ${cpX.toFixed(1)} ${p0[1].toFixed(1)}, ${cpX.toFixed(1)} ${p1[1].toFixed(1)}, ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
      }
      for (let i = N - 1; i >= 0; i--) d += ` L ${botPts[i][0].toFixed(1)} ${botPts[i][1].toFixed(1)}`;
      d += ' Z';
      areas.push({ svc, d, si });
    });

    const defs = series.map((s, i) => `
      <linearGradient id="cg-${i}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stop-color="${s.color}" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="${s.color}" stop-opacity="0.35"/>
      </linearGradient>`).join('');
    const grid = yLabels.map((v) => {
      const y = yAt(v);
      return `<line x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="2 6"/>`;
    }).join('');
    const yLabelsSvg = yLabels.map((v) => {
      const y = yAt(v);
      return `<text x="${pad.left - 8}" y="${y + 3}" text-anchor="end" fill="#6E6659" font-size="10" font-family="JetBrains Mono">${fmtShort(v)}</text>`;
    }).join('');
    const xLabels = data.map((d, i) => {
      const x = xAt(i);
      return `<text x="${x}" y="${H - 10}" text-anchor="middle" fill="#6E6659" font-size="10" font-family="JetBrains Mono">${escapeHtml(d.label)}</text>`;
    }).join('');
    const areasSvg = areas.map((a) => `<path d="${a.d}" fill="url(#cg-${a.si})" stroke="${a.svc.color}" stroke-width="1" opacity="0.95"/>`).join('');

    let nowMarker = '';
    if (nowIdx != null && nowIdx >= 0 && nowIdx < N) {
      const x = xAt(nowIdx);
      const y = yAt(totals[nowIdx]);
      nowMarker = `
        <line x1="${x}" y1="${pad.top}" x2="${x}" y2="${H - pad.bottom}" stroke="rgba(239,206,133,0.35)" stroke-dasharray="3 4"/>
        <circle cx="${x}" cy="${y}" r="5" fill="#EFCE85" stroke="#0B0B0E" stroke-width="2"/>`;
    }

    const hoverBands = data.map((d, i) => {
      const x = xAt(i);
      const bandW = IW / Math.max(1, N - 1);
      return `<rect x="${x - bandW / 2}" y="${pad.top}" width="${bandW}" height="${IH}" fill="transparent" data-idx="${i}" style="cursor:crosshair"/>`;
    }).join('');

    svg.innerHTML = `<defs>${defs}</defs>${grid}${areasSvg}${nowMarker}${yLabelsSvg}${xLabels}${hoverBands}`;

    svg.querySelectorAll('rect[data-idx]').forEach((rect) => {
      on(rect, 'mouseenter', () => showTip(+rect.dataset.idx));
      on(rect, 'mousemove', positionTip);
      on(rect, 'mouseleave', () => tooltip.classList.remove('is-visible'));
    });
  }

  function showTip(idx) {
    const { data, series } = current;
    const bucket = data[idx].buckets;
    const total = series.reduce((s, sv) => s + (bucket[sv.name] || 0), 0);
    const rows = series.map((sv) => {
      const v = bucket[sv.name] || 0;
      const pct = total > 0 ? Math.round((v / total) * 100) : 0;
      return `
        <div class="chart-tt-row">
          <span class="chart-tt-swatch" style="background:${sv.color}"></span>
          <span class="chart-tt-name">${escapeHtml(sv.name)}</span>
          <span class="chart-tt-val">${fmt(v)}</span>
          <span class="chart-tt-val" style="width:32px;text-align:right;color:var(--text-dim)">${pct}%</span>
        </div>`;
    }).join('');
    tooltip.innerHTML = `
      <div class="chart-tt-label">${escapeHtml(data[idx].label)}</div>
      <div class="chart-tt-rows">${rows}</div>
      <div class="chart-tt-total"><span>Итого</span><span>${fmt(total)} сум</span></div>`;
    tooltip.classList.add('is-visible');
  }
  function positionTip(e) {
    const rect = wrap.getBoundingClientRect();
    tooltip.style.left = (e.clientX - rect.left) + 'px';
    tooltip.style.top  = (e.clientY - rect.top) + 'px';
  }

  wrap.update = (next) => { current = { ...current, ...next }; render(); };
  render();
  return wrap;
}

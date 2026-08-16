import { el, countUp, pulse } from '../core/dom.js';
import { fmt } from '../core/format.js';
import { Sparkline } from './Sparkline.js';
import { icons } from './icons.js';

/**
 * KpiCard({ label, value, unit, icon, tone: 'gold'|'warn'|'neutral', delta: {value, direction}, sparkData, sparkColor, delay })
 * → возвращает Node с методом .update({value, delta, sparkData})
 */
export function KpiCard({ label, value = 0, unit = '', icon, tone = 'neutral', delta, sparkData, sparkColor, delay = 0 } = {}) {
  const numNode = el('span.num', { text: fmt(value) });
  let prevValue = value;

  const spark = Sparkline({ data: sparkData || [], color: sparkColor || '#C9A24E' });

  const deltaChipVal = el('span', { text: delta?.text || '' });
  const deltaChip = el('span.chip', {
    class: [delta ? (delta.direction === 'down' ? 'chip--down' : 'chip--up') : 'chip--muted'],
  }, [
    delta ? el('span', { html: icons.arrowUp({ size: 8 }) }) : null,
    deltaChipVal,
  ]);

  const iconClass = tone === 'gold' ? 'kpi-icon kpi-icon--gold' : tone === 'warn' ? 'kpi-icon kpi-icon--warn' : 'kpi-icon';
  const blobClass = tone === 'gold' ? 'kpi-blob kpi-blob--gold' : tone === 'warn' ? 'kpi-blob kpi-blob--warn' : 'kpi-blob';
  const rootClass = tone === 'warn' ? 'kpi card kpi--warn chart-rise' : 'kpi card chart-rise';

  const root = el(rootClass, { style: { '--d': delay + 'ms' } }, [
    el('div', { class: blobClass }),
    el('header.kpi-head', {}, [
      el('span.kpi-label', { text: label }),
      el('div', { class: iconClass, html: (icon || icons.finance)({ size: 16 }) }),
    ]),
    el('div.kpi-value', {}, [numNode, unit ? el('span.kpi-unit', { text: unit }) : null]),
    el('div.kpi-foot', {}, [deltaChip, spark]),
  ]);

  root.update = ({ value: v, delta: d, sparkData: sd, sparkColor: sc } = {}) => {
    if (v != null && v !== prevValue) { countUp(numNode, prevValue, v, 500, fmt); pulse(numNode); prevValue = v; }
    if (d) {
      deltaChip.classList.remove('chip--up', 'chip--down', 'chip--muted');
      deltaChip.classList.add(d.direction === 'down' ? 'chip--down' : d.direction === 'up' ? 'chip--up' : 'chip--muted');
      deltaChipVal.textContent = d.text;
    }
    if (sd) spark.update({ data: sd, color: sc });
  };

  return root;
}

import { el } from '../core/dom.js';
import { fmt, escapeHtml } from '../core/format.js';
import { app } from '../core/store.js';
import * as api from '../core/api.js';
import { PageHeader } from '../ui/PageHeader.js';
import { emptyState, errorState, skeleton } from '../ui/Skeleton.js';
import { icons } from '../ui/icons.js';
import { toast } from '../ui/Toast.js';

export default function salonsPage() {
  const root = el('div');
  const header = PageHeader({
    eyebrow: 'сеть',
    title: 'Салоны',
    subtitle: 'Все точки в сети — производительность и мастера',
  });
  const grid = el('div.section-grid.section-grid--3');
  root.append(header, grid);

  async function load() {
    grid.innerHTML = '';
    for (let i = 0; i < 3; i++) grid.append(el('div.card', { style: { height: '200px' } }, [skeleton({ w: '100%', h: 20 })]));
    try {
      const [salons, allMasters] = await Promise.all([api.salons.list(), api.masters.list()]);
      app.set({ salons });
      grid.innerHTML = '';
      if (salons.length === 0) {
        grid.append(emptyState({ icon: icons.salons({ size: 24 }), title: 'Пока нет салонов', description: 'Добавьте через админ или seed' }));
        return;
      }
      salons.forEach((s) => grid.append(salonCard(s, allMasters)));
    } catch (err) {
      grid.innerHTML = '';
      grid.append(errorState({ title: 'Не удалось загрузить салоны', description: err.message, retry: load }));
    }
  }

  function salonCard(s, allMasters) {
    const salonMasters = allMasters.filter((m) => String(m.salonId) === String(s._id));
    const onDuty = salonMasters.filter((m) => m.onDuty).length;
    const card = el('article.card', { style: { padding: '22px', cursor: 'pointer', transition: 'border-color .15s' } });
    card.addEventListener('click', () => {
      app.set({ currentSalonId: s._id });
      toast(`Показываю: <strong>${escapeHtml(s.name)}</strong>`);
    });
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(201,162,78,0.14);color:var(--gold-bright);display:grid;place-items:center">
            ${icons.salons({ size: 20 })}
          </div>
          <div>
            <div style="color:var(--text-strong);font-family:var(--font-num);font-size:18px;font-weight:600">${escapeHtml(s.name)}</div>
            <div style="color:var(--text-dim);font-size:11px;font-family:var(--font-mono);margin-top:2px">${escapeHtml(s.address || '—')}</div>
          </div>
        </div>
      </div>
      <div class="master-card-stats">
        <div class="master-card-stat">
          <div class="master-card-stat-label">Всего мастеров</div>
          <div class="master-card-stat-value">${salonMasters.length}</div>
        </div>
        <div class="master-card-stat">
          <div class="master-card-stat-label">На линии</div>
          <div class="master-card-stat-value" style="color:${onDuty > 0 ? 'var(--emerald-bright)' : 'var(--text-dim)'}">${onDuty}</div>
        </div>
      </div>
      ${s.location ? `<div style="margin-top:12px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:rgba(15,13,12,0.5);color:var(--text-dim);font-size:11px;font-family:var(--font-mono)">📍 ${s.location.lat?.toFixed(4)}, ${s.location.lng?.toFixed(4)}</div>` : ''}
    `;
    return card;
  }

  load();
  return root;
}

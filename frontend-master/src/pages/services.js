import { state, apiFetch } from "../state.js";
import { escapeHtml, formatSum } from "../format.js";
import { mockServiceDurationMin } from "../mock.js";

export function renderServices(root) {
  const master = state.currentMaster;

  async function load() {
    let services = [];
    try {
      services = await apiFetch("/api/services");
    } catch (err) {
      // offline banner handles connectivity feedback
    }
    paint(services);
  }

  function paint(services) {
    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Mening xizmatlarim</h1>
          <p class="page-subtitle">Salon katalogidagi xizmatlar (narxlar owner tomonidan belgilanadi)</p>
        </div>
      </div>

      <p class="mock-note">Davomiylik hozircha usta o'rtacha vaqti bilan taxmin qilinadi — real "duration" maydoni backend'da yo'q</p>

      <div class="service-grid">
        ${services.length ? services.map(serviceCardHtml).join("") : `<div class="empty-state"><span class="empty-icon">✂️</span><span>Xizmatlar topilmadi</span></div>`}
      </div>
    `;
  }

  function serviceCardHtml(s) {
    return `
      <div class="service-card">
        <span class="status-badge status-paid">Faol</span>
        <h3 class="service-card-name">${escapeHtml(s.name)}</h3>
        <div class="service-card-meta">
          <span>${mockServiceDurationMin(s, master)} daq</span>
          <span class="service-card-price">${formatSum(s.price)} so'm</span>
        </div>
      </div>
    `;
  }

  load();
  return null;
}

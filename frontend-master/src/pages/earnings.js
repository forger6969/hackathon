import { state, apiFetch } from "../state.js";
import { formatSum } from "../format.js";

const SALARY_TYPE_LABELS = { fixed: "Fiksirlangan", percent: "Foizli", hybrid: "Aralash" };
const PERIODS = [
  { id: "today", label: "Bugun" },
  { id: "week", label: "7 kun" },
  { id: "month", label: "Bu oy" },
];

export function renderEarnings(root) {
  const master = state.currentMaster;
  let period = "today";
  let data = { clientsServed: 0, revenue: 0, earned: 0 };

  async function load() {
    try {
      data = await apiFetch(`/api/masters/${master._id}/earnings?period=${period}`);
    } catch (err) {
      // offline banner handles connectivity feedback
    }
    paint();
  }

  function salaryLineHtml() {
    if (master.salaryType === "fixed") {
      return `<div class="earnings-breakdown-row"><span>Fiksirlangan oylik</span><span>${formatSum(master.salaryFixed)} so'm</span></div>`;
    }
    if (master.salaryType === "percent") {
      return `
        <div class="earnings-breakdown-row"><span>Davr tushumi</span><span>${formatSum(data.revenue)} so'm</span></div>
        <div class="earnings-breakdown-row"><span>Foiz</span><span>${master.salaryPercent}%</span></div>
      `;
    }
    return `
      <div class="earnings-breakdown-row"><span>Fiksirlangan qism</span><span>${formatSum(master.salaryFixed)} so'm</span></div>
      <div class="earnings-breakdown-row"><span>Davr tushumi</span><span>${formatSum(data.revenue)} so'm</span></div>
      <div class="earnings-breakdown-row"><span>Foiz qism</span><span>${master.salaryPercent}%</span></div>
    `;
  }

  function paint() {
    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Mening hisoblarim</h1>
          <p class="page-subtitle">To'lov turi: ${SALARY_TYPE_LABELS[master.salaryType] || master.salaryType}</p>
        </div>
      </div>

      <div class="tab-row">
        ${PERIODS.map((p) => `<button class="tab-btn ${p.id === period ? "is-active" : ""}" data-period="${p.id}" type="button">${p.label}</button>`).join("")}
      </div>

      <div class="active-card earnings-today-card">
        <span class="active-card-label">💰 Hisoblangan</span>
        <h2 class="active-card-name earnings-today-value">${formatSum(data.earned)} so'm</h2>
        <p class="confirm-line">${data.clientsServed} mijoz xizmat qildingiz</p>
        <div class="earnings-breakdown">
          ${salaryLineHtml()}
        </div>
      </div>

      <p class="mock-note">Oylar bo'yicha to'liq to'lov tarixi (avgust-dan oldingi) hozircha backend'da yo'q — faqat joriy davr ko'rsatiladi</p>
    `;

    root.querySelectorAll("[data-period]").forEach((btn) =>
      btn.addEventListener("click", () => {
        period = btn.dataset.period;
        load();
      })
    );
  }

  load();
  return null;
}

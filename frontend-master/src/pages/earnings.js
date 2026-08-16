import { state, apiFetch } from "../state.js";
import { formatSum } from "../format.js";
import { mockMonthlyEarnings } from "../mock.js";

const SALARY_TYPE_LABELS = { fixed: "Fiksirlangan", percent: "Foizli", hybrid: "Aralash" };

export function renderEarnings(root) {
  const master = state.currentMaster;
  let today = { revenue: 0, earned: 0 };
  const months = mockMonthlyEarnings(master);

  async function load() {
    try {
      today = await apiFetch(`/api/masters/${master._id}/today`);
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
        <div class="earnings-breakdown-row"><span>Bugungi tushum</span><span>${formatSum(today.revenue)} so'm</span></div>
        <div class="earnings-breakdown-row"><span>Foiz</span><span>${master.salaryPercent}%</span></div>
      `;
    }
    return `
      <div class="earnings-breakdown-row"><span>Fiksirlangan qism</span><span>${formatSum(master.salaryFixed)} so'm</span></div>
      <div class="earnings-breakdown-row"><span>Bugungi tushum</span><span>${formatSum(today.revenue)} so'm</span></div>
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

      <div class="active-card earnings-today-card">
        <span class="active-card-label">💰 Bugun hisoblangan</span>
        <h2 class="active-card-name earnings-today-value">${formatSum(today.earned)} so'm</h2>
        <div class="earnings-breakdown">
          ${salaryLineHtml()}
        </div>
      </div>

      <h2 class="section-title">Oylik tarix</h2>
      <p class="mock-note">Namuna ma'lumot — backend'da oylik hisob-kitob tarixi hali yo'q</p>
      <div class="earnings-history">
        ${months
          .map(
            (m) => `
              <div class="earnings-history-row">
                <div class="earnings-history-month">
                  <span class="earnings-history-label">${m.label}</span>
                  <span class="status-badge ${m.status === "To'landi" ? "status-paid" : "status-scheduled"}">${m.status}</span>
                </div>
                <div class="earnings-history-numbers">
                  <span>Tushum: ${formatSum(m.revenue)} so'm</span>
                  <span class="earnings-history-earned">Hisoblangan: ${formatSum(m.earned)} so'm</span>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  load();
  return null;
}

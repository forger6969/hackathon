import { state, apiFetch } from "../state.js";
import { formatSum, formatHours } from "../format.js";
import { mockWeeklyStats } from "../mock.js";

const PERIODS = [
  { id: "today", label: "Bugun" },
  { id: "7d", label: "7 kun" },
  { id: "30d", label: "30 kun" },
  { id: "month", label: "Bu oy" },
];

export function renderStats(root) {
  const master = state.currentMaster;
  let period = "today";
  let today = { clientsServed: 0, revenue: 0, hoursWorked: 0, earned: 0 };
  const weekly = mockWeeklyStats(master._id);

  async function load() {
    try {
      today = await apiFetch(`/api/masters/${master._id}/today`);
    } catch (err) {
      // offline banner handles connectivity feedback
    }
    paint();
  }

  function extendedNumbers() {
    // Only "today" is real; other periods extrapolate from the seeded weekly
    // mock so the charts stay internally consistent instead of resetting.
    const totalClients = weekly.reduce((s, d) => s + d.clients, 0);
    const totalRevenue = weekly.reduce((s, d) => s + d.revenue, 0);
    const avgClients = (totalClients / weekly.length).toFixed(1);
    const avgCheck = Math.round(totalRevenue / totalClients);
    return { totalClients, totalRevenue, avgClients, avgCheck };
  }

  function paint() {
    const isToday = period === "today";
    const ext = extendedNumbers();
    const maxRevenue = Math.max(...weekly.map((d) => d.revenue));

    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Mening statistikam</h1>
          <p class="page-subtitle">Ishlash ko'rsatkichlari</p>
        </div>
      </div>

      <div class="tab-row">
        ${PERIODS.map((p) => `<button class="tab-btn ${p.id === period ? "is-active" : ""}" data-period="${p.id}" type="button">${p.label}</button>`).join("")}
      </div>

      ${!isToday ? '<p class="mock-note">Bu davr uchun namuna ma\'lumot — backend hozircha faqat "bugun"ni beradi</p>' : ""}

      <div class="kpi-grid">
        ${
          isToday
            ? `
              ${kpiCard("👤", today.clientsServed, "Mijozlar")}
              ${kpiCard("✅", today.clientsServed, "Yakunlangan xizmatlar")}
              ${kpiCard("💵", formatSum(today.revenue) + " so'm", "Tushum")}
              ${kpiCard("⏱", formatHours(today.hoursWorked), "Ish vaqti")}
            `
            : `
              ${kpiCard("👤", ext.totalClients, "Mijozlar")}
              ${kpiCard("💵", formatSum(ext.totalRevenue) + " so'm", "Tushum")}
              ${kpiCard("📈", ext.avgClients, "O'rtacha mijoz/kun")}
              ${kpiCard("🧾", formatSum(ext.avgCheck) + " so'm", "O'rtacha chek")}
            `
        }
      </div>

      <h2 class="section-title">Tushum kunlar bo'yicha</h2>
      <div class="bar-chart">
        ${weekly
          .map(
            (d) => `
              <div class="bar-chart-col">
                <div class="bar-chart-bar" style="height:${Math.max(8, (d.revenue / maxRevenue) * 100)}%"></div>
                <span class="bar-chart-label">${d.label}</span>
              </div>
            `
          )
          .join("")}
      </div>

      <h2 class="section-title">Mijozlar kunlar bo'yicha</h2>
      <div class="bar-list">
        ${weekly
          .map(
            (d) => `
              <div class="bar-list-row">
                <span class="bar-list-label">${d.label}</span>
                <div class="bar-list-track"><div class="bar-list-fill" style="width:${(d.clients / Math.max(...weekly.map((x) => x.clients))) * 100}%"></div></div>
                <span class="bar-list-value">${d.clients}</span>
              </div>
            `
          )
          .join("")}
      </div>
    `;

    root.querySelectorAll("[data-period]").forEach((btn) =>
      btn.addEventListener("click", () => {
        period = btn.dataset.period;
        paint();
      })
    );
  }

  function kpiCard(icon, value, label) {
    return `
      <div class="kpi-card">
        <span class="kpi-icon">${icon}</span>
        <span class="kpi-value">${value}</span>
        <span class="kpi-label">${label}</span>
      </div>
    `;
  }

  load();
  return null;
}

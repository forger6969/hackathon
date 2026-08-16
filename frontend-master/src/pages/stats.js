import { state, apiFetch } from "../state.js";
import { formatSum, formatHours } from "../format.js";

const PERIODS = [
  { id: "today", label: "Bugun" },
  { id: "week", label: "7 kun" },
  { id: "month", label: "Bu oy" },
];

const DAY_LABELS = ["Yak", "Du", "Se", "Chor", "Pay", "Ju", "Sha"];

export function renderStats(root) {
  const master = state.currentMaster;
  let period = "today";
  let today = { clientsServed: 0, revenue: 0, hoursWorked: 0, earned: 0 };
  let extended = { clientsServed: 0, revenue: 0, earned: 0 };
  let dailyBars = [];

  async function load() {
    try {
      const [t, history] = await Promise.all([
        apiFetch(`/api/masters/${master._id}/today`),
        apiFetch(`/api/queue/${master._id}/history?status=done`),
      ]);
      today = t;
      dailyBars = buildDailyBars(history);
      await loadExtended();
    } catch (err) {
      // offline banner handles connectivity feedback
    }
    paint();
  }

  async function loadExtended() {
    if (period === "today") return;
    try {
      extended = await apiFetch(`/api/masters/${master._id}/earnings?period=${period}`);
    } catch (err) {
      // keep previous values
    }
  }

  function buildDailyBars(history) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return { date: d, label: DAY_LABELS[d.getDay()], clients: 0, revenue: 0 };
    });
    for (const h of history) {
      const doneAt = new Date(h.doneAt);
      const bucket = days.find((d) => {
        const next = new Date(d.date);
        next.setDate(next.getDate() + 1);
        return doneAt >= d.date && doneAt < next;
      });
      if (bucket) {
        bucket.clients += 1;
        bucket.revenue += h.serviceId?.price || 0;
      }
    }
    return days;
  }

  function paint() {
    const isToday = period === "today";
    const maxRevenue = Math.max(1, ...dailyBars.map((d) => d.revenue));
    const maxClients = Math.max(1, ...dailyBars.map((d) => d.clients));
    const avgClients = (dailyBars.reduce((s, d) => s + d.clients, 0) / 7).toFixed(1);
    const totalClients = dailyBars.reduce((s, d) => s + d.clients, 0);
    const totalRevenue = dailyBars.reduce((s, d) => s + d.revenue, 0);
    const avgCheck = totalClients ? Math.round(totalRevenue / totalClients) : 0;

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
              ${kpiCard("👤", extended.clientsServed, "Mijozlar")}
              ${kpiCard("💵", formatSum(extended.revenue) + " so'm", "Tushum")}
              ${kpiCard("💰", formatSum(extended.earned) + " so'm", "Hisoblangan")}
              ${kpiCard("🧾", formatSum(avgCheck) + " so'm", "O'rtacha chek")}
            `
        }
      </div>

      <h2 class="section-title">Tushum — so'nggi 7 kun</h2>
      <div class="bar-chart">
        ${dailyBars
          .map(
            (d) => `
              <div class="bar-chart-col">
                <div class="bar-chart-bar" style="height:${Math.max(6, (d.revenue / maxRevenue) * 100)}%"></div>
                <span class="bar-chart-label">${d.label}</span>
              </div>
            `
          )
          .join("")}
      </div>

      <h2 class="section-title">Mijozlar — so'nggi 7 kun (o'rtacha ${avgClients}/kun)</h2>
      <div class="bar-list">
        ${dailyBars
          .map(
            (d) => `
              <div class="bar-list-row">
                <span class="bar-list-label">${d.label}</span>
                <div class="bar-list-track"><div class="bar-list-fill" style="width:${(d.clients / maxClients) * 100}%"></div></div>
                <span class="bar-list-value">${d.clients}</span>
              </div>
            `
          )
          .join("")}
      </div>
    `;

    root.querySelectorAll("[data-period]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        period = btn.dataset.period;
        await loadExtended();
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

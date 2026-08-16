import { state, apiFetch } from "../state.js";
import { escapeHtml, statusBadgeHtml, paymentBadgeHtml } from "../format.js";
import { mockBookings } from "../mock.js";

const WEEKDAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

export function renderCalendar(root) {
  const master = state.currentMaster;
  let view = "day";
  let queue = [];

  async function load() {
    try {
      queue = await apiFetch(`/api/queue/${master._id}`);
    } catch (err) {
      // offline banner handles connectivity feedback
    }
    paint();
  }

  function durationMin() {
    return Math.round((master.avgServiceTimeMs || 20 * 60000) / 60000);
  }

  function dayBlocks() {
    const now = Date.now();
    const scheduled = queue
      .filter((q) => q.status === "scheduled")
      .map((q) => ({
        clientName: q.clientName,
        time: new Date(q.scheduledFor).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
        sortKey: new Date(q.scheduledFor).getTime(),
        status: q.status,
        paid: q.paid,
        paymentMethod: q.paymentMethod,
      }));

    const live = queue
      .filter((q) => q.status !== "scheduled")
      .map((q) => ({
        clientName: q.clientName,
        time: new Date(now + (q.eta || 0)).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
        sortKey: now + (q.eta || 0),
        status: q.status,
        paid: q.paid,
        paymentMethod: q.paymentMethod,
      }));

    return [...live, ...scheduled].sort((a, b) => a.sortKey - b.sortKey);
  }

  function paint() {
    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Kalendar</h1>
          <p class="page-subtitle">O'z jadvalingiz, xizmat davomiyligi ~${durationMin()} daq</p>
        </div>
      </div>

      <div class="tab-row">
        <button class="tab-btn ${view === "day" ? "is-active" : ""}" data-view="day" type="button">Kun</button>
        <button class="tab-btn ${view === "week" ? "is-active" : ""}" data-view="week" type="button">Hafta</button>
      </div>

      ${view === "day" ? dayViewHtml() : weekViewHtml()}
    `;

    root.querySelectorAll("[data-view]").forEach((btn) =>
      btn.addEventListener("click", () => {
        view = btn.dataset.view;
        paint();
      })
    );
  }

  function dayViewHtml() {
    const blocks = dayBlocks();
    if (!blocks.length) {
      return `<div class="empty-state"><span class="empty-icon">📅</span><span>Bugun uchun rejalashtirilgan yozuv yo'q</span></div>`;
    }
    return `
      <div class="timeline">
        ${blocks
          .map(
            (b) => `
              <div class="timeline-row">
                <span class="timeline-time">${b.time}</span>
                <div class="timeline-block">
                  <span class="timeline-client">${escapeHtml(b.clientName)}</span>
                  <div class="active-card-badges">
                    ${statusBadgeHtml(b.status)}
                    ${paymentBadgeHtml(b)}
                  </div>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  function weekViewHtml() {
    return `
      <p class="mock-note">Hafta ko'rinishi hozircha namuna ma'lumot bilan (backend haftalik jadval bermaydi)</p>
      <div class="week-grid">
        ${WEEKDAYS.map((day, i) => {
          const items = mockBookings(master._id, "week" + i, 2 + (i % 3));
          return `
            <div class="week-day-card">
              <span class="week-day-title">${day}</span>
              ${items
                .map(
                  (it) => `
                    <div class="week-day-item">
                      <span class="week-day-time">${it.time}</span>
                      <span class="week-day-name">${escapeHtml(it.clientName)}</span>
                    </div>
                  `
                )
                .join("")}
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  load();
  return null;
}

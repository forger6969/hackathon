import { state, apiFetch } from "../state.js";
import { escapeHtml, statusBadgeHtml, paymentBadgeHtml } from "../format.js";

const WEEKDAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export function renderCalendar(root) {
  const master = state.currentMaster;
  let view = "day";
  let queue = [];
  let history = [];

  async function load() {
    try {
      const [q, h] = await Promise.all([
        apiFetch(`/api/queue/${master._id}`),
        apiFetch(`/api/queue/${master._id}/history`),
      ]);
      queue = q;
      history = h;
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

  function weekBuckets() {
    const start = startOfWeek();
    const buckets = WEEKDAYS.map((label, i) => {
      const dayStart = new Date(start);
      dayStart.setDate(start.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);
      return { label, dayStart, dayEnd, items: [] };
    });

    const put = (date, entry) => {
      const bucket = buckets.find((b) => date >= b.dayStart && date < b.dayEnd);
      if (bucket) bucket.items.push(entry);
    };

    for (const h of history) {
      const date = new Date(h.doneAt || h.createdAt);
      put(date, {
        time: date.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
        clientName: h.clientName,
        sortKey: date.getTime(),
      });
    }
    for (const q of queue.filter((q) => q.status === "scheduled")) {
      const date = new Date(q.scheduledFor);
      put(date, {
        time: date.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
        clientName: q.clientName,
        sortKey: date.getTime(),
      });
    }

    buckets.forEach((b) => b.items.sort((a, b2) => a.sortKey - b2.sortKey));
    return buckets;
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
    const buckets = weekBuckets();
    return `
      <div class="week-grid">
        ${buckets
          .map(
            (b) => `
              <div class="week-day-card">
                <span class="week-day-title">${b.label}</span>
                ${
                  b.items.length
                    ? b.items
                        .map(
                          (it) => `
                            <div class="week-day-item">
                              <span class="week-day-time">${it.time}</span>
                              <span class="week-day-name">${escapeHtml(it.clientName)}</span>
                            </div>
                          `
                        )
                        .join("")
                    : '<span class="week-day-empty">—</span>'
                }
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

import { state, apiFetch, onQueueUpdate } from "../state.js";
import { escapeHtml, initials, formatSum, formatEta, formatScheduledFor, statusBadgeHtml, paymentBadgeHtml } from "../format.js";
import { mockBookings } from "../mock.js";

const DATE_TABS = [
  { id: "today", label: "Bugun" },
  { id: "tomorrow", label: "Ertaga" },
  { id: "week", label: "Bu hafta" },
];

const STATUS_TABS = [
  { id: "all", label: "Barchasi" },
  { id: "upcoming", label: "Kutilmoqda" },
  { id: "paid", label: "To'langan" },
  { id: "in_service", label: "Xizmatda" },
  { id: "done", label: "Yakunlangan" },
  { id: "skipped", label: "Kelmadi" },
  { id: "cancelled", label: "Bekor qilindi" },
];

export function renderBookings(root) {
  const master = state.currentMaster;
  let dateTab = "today";
  let statusTab = "all";
  let queue = [];

  async function load() {
    try {
      queue = await apiFetch(`/api/queue/${master._id}`);
    } catch (err) {
      // offline banner handles connectivity feedback
    }
    paint();
  }

  function realRows() {
    return queue.map((item) => ({
      _id: item._id,
      clientName: item.clientName,
      status: item.status,
      paid: item.paid,
      paymentMethod: item.paymentMethod,
      eta: item.eta,
      scheduledFor: item.scheduledFor,
      isMock: false,
    }));
  }

  function mockRows() {
    return mockBookings(master._id, dateTab).map((b) => ({ ...b, isMock: true }));
  }

  function filterByStatus(rows) {
    if (statusTab === "all") return rows;
    if (statusTab === "upcoming") return rows.filter((r) => r.status === "waiting" || r.status === "scheduled");
    if (statusTab === "paid") return rows.filter((r) => r.paid);
    if (statusTab === "in_service") return rows.filter((r) => r.status === "called" || r.status === "in_progress");
    return rows.filter((r) => r.status === statusTab);
  }

  function paint() {
    const rows = filterByStatus(dateTab === "today" ? realRows() : mockRows());

    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Mening yozuvlarim</h1>
          <p class="page-subtitle">${master.name}ga tegishli barcha bandlar</p>
        </div>
      </div>

      <div class="tab-row">
        ${DATE_TABS.map((t) => tabBtn(t, dateTab, "data-date-tab")).join("")}
      </div>
      <div class="tab-row tab-row-secondary">
        ${STATUS_TABS.map((t) => tabBtn(t, statusTab, "data-status-tab")).join("")}
      </div>

      ${dateTab !== "today" ? '<p class="mock-note">Bu sana uchun ma\'lumot backend\'dan hali kelmaydi — namuna ko\'rinish</p>' : ""}

      <div class="booking-list">
        ${rows.length ? rows.map(bookingRowHtml).join("") : emptyHtml()}
      </div>
    `;

    root.querySelectorAll("[data-date-tab]").forEach((btn) =>
      btn.addEventListener("click", () => {
        dateTab = btn.dataset.dateTab;
        paint();
      })
    );
    root.querySelectorAll("[data-status-tab]").forEach((btn) =>
      btn.addEventListener("click", () => {
        statusTab = btn.dataset.statusTab;
        paint();
      })
    );
  }

  function tabBtn(t, activeId, attr) {
    const key = attr === "data-date-tab" ? "dateTab" : "statusTab";
    return `<button class="tab-btn ${t.id === activeId ? "is-active" : ""}" ${attr}="${t.id}" type="button">${t.label}</button>`;
  }

  function bookingRowHtml(item) {
    const timeLabel = item.isMock
      ? item.time
      : item.status === "scheduled"
        ? formatScheduledFor(item.scheduledFor)
        : formatEta(item.eta);
    const serviceLine = item.isMock
      ? `${escapeHtml(item.serviceName)} · ${formatSum(item.price)} so'm`
      : "";
    return `
      <div class="booking-row">
        <span class="avatar">${initials(item.clientName)}</span>
        <div class="booking-row-main">
          <span class="booking-row-name">${escapeHtml(item.clientName)}</span>
          ${serviceLine ? `<span class="booking-row-service">${serviceLine}</span>` : ""}
        </div>
        <div class="booking-row-meta">
          ${timeLabel ? `<span class="booking-row-time">${timeLabel}</span>` : ""}
          <div class="active-card-badges">
            ${statusBadgeHtml(item.status)}
            ${paymentBadgeHtml(item)}
          </div>
        </div>
      </div>
    `;
  }

  function emptyHtml() {
    return `<div class="empty-state"><span class="empty-icon">📋</span><span>Bu bo'lim uchun yozuvlar yo'q</span></div>`;
  }

  load();
  const unsubscribe = onQueueUpdate((newQueue) => {
    queue = newQueue;
    if (dateTab === "today") paint();
  });

  return unsubscribe;
}

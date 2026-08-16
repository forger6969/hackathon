import { state, apiFetch, onQueueUpdate } from "../state.js";
import { escapeHtml, initials, formatSum, formatEta, formatScheduledFor, formatTime, statusBadgeHtml, paymentBadgeHtml } from "../format.js";

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

function startOfDay(offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

export function renderBookings(root) {
  const master = state.currentMaster;
  let dateTab = "today";
  let statusTab = "all";
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

  function normalizedRows() {
    const live = queue
      .filter((q) => q.status !== "scheduled")
      .map((q) => ({
        _id: q._id,
        clientName: q.clientName,
        status: q.status,
        paid: q.paid,
        paymentMethod: q.paymentMethod,
        eta: q.eta,
        relevantDate: new Date(), // live items are inherently "now/today"
      }));

    const scheduled = queue
      .filter((q) => q.status === "scheduled")
      .map((q) => ({
        _id: q._id,
        clientName: q.clientName,
        status: q.status,
        paid: q.paid,
        paymentMethod: q.paymentMethod,
        scheduledFor: q.scheduledFor,
        relevantDate: new Date(q.scheduledFor),
      }));

    const past = history.map((h) => ({
      _id: h._id,
      clientName: h.clientName,
      status: h.status,
      paid: h.paid,
      paymentMethod: h.paymentMethod,
      serviceName: h.serviceId?.name,
      servicePrice: h.serviceId?.price,
      doneAt: h.doneAt,
      relevantDate: new Date(h.doneAt || h.createdAt),
    }));

    return [...live, ...scheduled, ...past];
  }

  function filterByDate(rows) {
    if (dateTab === "today") {
      const start = startOfDay(0);
      const end = startOfDay(1);
      return rows.filter((r) => r.relevantDate >= start && r.relevantDate < end);
    }
    if (dateTab === "tomorrow") {
      const start = startOfDay(1);
      const end = startOfDay(2);
      return rows.filter((r) => r.relevantDate >= start && r.relevantDate < end);
    }
    const start = startOfDay(0);
    const end = startOfDay(7);
    return rows.filter((r) => r.relevantDate >= start && r.relevantDate < end);
  }

  function filterByStatus(rows) {
    if (statusTab === "all") return rows;
    if (statusTab === "upcoming") return rows.filter((r) => r.status === "waiting" || r.status === "scheduled");
    if (statusTab === "paid") return rows.filter((r) => r.paid);
    if (statusTab === "in_service") return rows.filter((r) => r.status === "called" || r.status === "in_progress");
    return rows.filter((r) => r.status === statusTab);
  }

  function paint() {
    const rows = filterByStatus(filterByDate(normalizedRows())).sort((a, b) => a.relevantDate - b.relevantDate);

    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Mening yozuvlarim</h1>
          <p class="page-subtitle">${escapeHtml(master.name)}ga tegishli barcha bandlar</p>
        </div>
      </div>

      <div class="tab-row">
        ${DATE_TABS.map((t) => `<button class="tab-btn ${t.id === dateTab ? "is-active" : ""}" data-date-tab="${t.id}" type="button">${t.label}</button>`).join("")}
      </div>
      <div class="tab-row tab-row-secondary">
        ${STATUS_TABS.map((t) => `<button class="tab-btn ${t.id === statusTab ? "is-active" : ""}" data-status-tab="${t.id}" type="button">${t.label}</button>`).join("")}
      </div>

      <div class="booking-list">
        ${rows.length ? rows.map(bookingRowHtml).join("") : `<div class="empty-state"><span class="empty-icon">📋</span><span>Bu bo'lim uchun yozuvlar yo'q</span></div>`}
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

  function bookingRowHtml(item) {
    const timeLabel = item.doneAt
      ? formatTime(item.doneAt)
      : item.scheduledFor
        ? formatScheduledFor(item.scheduledFor)
        : formatEta(item.eta);
    const serviceLine = item.serviceName ? `${escapeHtml(item.serviceName)} · ${formatSum(item.servicePrice)} so'm` : "";
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

  load();
  const unsubscribe = onQueueUpdate((newQueue) => {
    queue = newQueue;
    paint();
  });

  return unsubscribe;
}

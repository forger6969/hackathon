export const STATUS_LABELS = {
  waiting: "Navbatda",
  called: "Xizmatda",
  in_progress: "Xizmatda",
  scheduled: "Vaqtga yozilgan",
  done: "Yakunlandi",
  skipped: "Kelmadi",
  cancelled: "Bekor qilindi",
};

export function escapeHtml(str = "") {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export function initials(name = "") {
  return (name.trim()[0] || "?").toUpperCase();
}

export function formatSum(n) {
  return new Intl.NumberFormat("uz-UZ").format(n || 0);
}

// Backend sends `eta` as milliseconds-until-turn (idx * avgServiceTimeMs),
// not a timestamp — render it as a relative wait, not a clock time.
export function formatEta(etaMs) {
  if (!Number.isFinite(etaMs)) return "";
  const totalMin = Math.round(etaMs / 60000);
  if (totalMin < 1) return "Endi";
  return `~${totalMin} daq`;
}

export function formatScheduledFor(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function formatTime(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "long" });
}

// hoursWorked comes from the backend as decimal hours (e.g. 1.75) — render
// as "H soat M daq" per tasks.md's "Ч ч М мин" spec, not a raw decimal.
export function formatHours(hoursWorked) {
  const totalMin = Math.round((hoursWorked || 0) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 1) return `${m} daq`;
  return `${h} soat ${m} daq`;
}

export function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function paymentMethodLabel(method) {
  return method === "card" ? "karta" : "naqd";
}

// `paid` comes from the reception's "mark as paid" flow (POST /api/queue/:id/pay)
// — advisory only, no enforcement — the master just needs to see it at a glance.
export function paymentBadgeHtml(item) {
  const label = item.paid
    ? `To'landi${item.paymentMethod ? ` (${paymentMethodLabel(item.paymentMethod)})` : ""}`
    : "To'lanmagan";
  return `<span class="status-badge ${item.paid ? "status-paid" : "status-unpaid"}">${label}</span>`;
}

export function statusBadgeHtml(status) {
  return `<span class="status-badge status-${status}">${STATUS_LABELS[status] || status}</span>`;
}

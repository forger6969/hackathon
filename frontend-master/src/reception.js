import { io } from "socket.io-client";
import "./style.css";

const API_URL = import.meta.env.VITE_API_URL;

const els = {
  form: document.getElementById("add-client-form"),
  name: document.getElementById("f-name"),
  phone: document.getElementById("f-phone"),
  salon: document.getElementById("f-salon"),
  master: document.getElementById("f-master"),
  service: document.getElementById("f-service"),
  time: document.getElementById("f-time"),
  whenRadios: document.querySelectorAll('input[name="when"]'),
  list: document.getElementById("reception-list"),
  offline: document.getElementById("offline-banner"),
  mastersStatus: document.getElementById("masters-status-list"),
};

let masters = [];
let salonsById = {};
let items = [];

const STATUS_LABELS = {
  scheduled: "Belgilangan",
  waiting: "Navbatda",
  called: "Chaqirildi",
  in_progress: "Xizmatda",
};

function setOffline(isOffline) {
  els.offline.classList.toggle("hidden", !isOffline);
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API xato: ${res.status}`);
  return res.json();
}

function escapeHtml(str = "") {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ── Форма: салон -> мастера этого салона, только те, кто "на линии" ──
function renderMasterOptions(salonId) {
  const filtered = masters.filter((m) => m.salonId === salonId && m.onDuty);
  els.master.innerHTML = filtered.length
    ? filtered.map((m) => `<option value="${m._id}">${escapeHtml(m.name)}</option>`).join("")
    : `<option value="" disabled selected>Bu salonda hech kim on line emas</option>`;
}

function renderMastersStatus() {
  if (!masters.length) {
    els.mastersStatus.innerHTML = `<p class="empty-state">Ustalar topilmadi</p>`;
    return;
  }
  els.mastersStatus.innerHTML = masters
    .map((m) => {
      const salonName = salonsById[m.salonId] ? escapeHtml(salonsById[m.salonId]) : "";
      return `
        <div class="master-status-row ${m.onDuty ? "is-on" : "is-off"}">
          <span class="master-status-dot"></span>
          <span class="master-status-name">${escapeHtml(m.name)}</span>
          <span class="master-status-salon">${salonName}</span>
          <span class="master-status-label">${m.onDuty ? "on line" : "off line"}</span>
        </div>
      `;
    })
    .join("");
}

async function loadCatalog() {
  const [salons, allMasters, services] = await Promise.all([
    apiFetch("/api/salons"),
    apiFetch("/api/masters"),
    apiFetch("/api/services"),
  ]);
  masters = allMasters;
  salonsById = Object.fromEntries(salons.map((s) => [s._id, s.name]));

  els.salon.innerHTML = salons
    .map((s) => `<option value="${s._id}">${escapeHtml(s.name)}</option>`)
    .join("");
  els.service.innerHTML = services
    .map((s) => `<option value="${s._id}">${escapeHtml(s.name)} — ${s.price} so'm</option>`)
    .join("");

  if (salons[0]) renderMasterOptions(salons[0]._id);
  renderMastersStatus();
}

els.salon.addEventListener("change", (e) => renderMasterOptions(e.target.value));

els.whenRadios.forEach((r) =>
  r.addEventListener("change", () => {
    const isLater = document.querySelector('input[name="when"]:checked').value === "later";
    els.time.classList.toggle("hidden", !isLater);
    els.time.required = isLater;
  })
);

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const isLater = document.querySelector('input[name="when"]:checked').value === "later";

  const body = {
    clientName: els.name.value.trim(),
    phone: els.phone.value.trim(),
    serviceId: els.service.value,
    masterId: els.master.value,
    reception: true,
  };
  if (isLater && els.time.value) {
    body.scheduledFor = new Date(els.time.value).toISOString();
  }

  const submitBtn = els.form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    await apiFetch("/api/queue", { method: "POST", body: JSON.stringify(body) });
    els.form.reset();
    els.time.classList.add("hidden");
    setOffline(false);
    await loadQueue();
  } catch (err) {
    setOffline(true);
  } finally {
    submitBtn.disabled = false;
  }
});

// ── Общий список по всем мастерам ──────────────────
async function loadQueue() {
  try {
    items = await apiFetch("/api/queue");
    setOffline(false);
    render();
  } catch (err) {
    setOffline(true);
  }
}

// Duty toggles don't emit a socket event (they're not a queue change), so
// poll them on a light interval — good enough freshness for a reception
// screen, no need for a dedicated socket event just for this.
async function refreshMastersStatus() {
  try {
    masters = await apiFetch("/api/masters");
    renderMastersStatus();
  } catch (err) {
    setOffline(true);
  }
}
setInterval(refreshMastersStatus, 15000);

async function checkin(id) {
  try {
    await apiFetch(`/api/queue/${id}/checkin`, { method: "POST" });
    await loadQueue();
  } catch (err) {
    setOffline(true);
  }
}

async function markPaid(id, method) {
  try {
    await apiFetch(`/api/queue/${id}/pay`, {
      method: "POST",
      body: JSON.stringify({ method }),
    });
    await loadQueue();
  } catch (err) {
    setOffline(true);
  }
}

function formatScheduled(iso) {
  const d = new Date(iso);
  return d.toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function render() {
  if (!items.length) {
    els.list.innerHTML = "<p class=\"empty-state\">Navbat bo'sh</p>";
    return;
  }

  els.list.innerHTML = items
    .map((item) => {
      const badge = STATUS_LABELS[item.status] || item.status;
      const scheduledTag =
        item.status === "scheduled" && item.scheduledFor
          ? `<span class="queue-eta">${formatScheduled(item.scheduledFor)}</span>`
          : "";
      const checkinBtn =
        item.status === "scheduled"
          ? `<button class="btn btn-primary" data-checkin="${item._id}">Keldi</button>`
          : "";
      const payButtons = !item.paid
        ? `<button class="btn btn-success" data-pay="${item._id}" data-method="cash">💵 Naqd</button>
           <button class="btn btn-success" data-pay="${item._id}" data-method="card">💳 Karta</button>`
        : "";
      const paidBadge = item.paid
        ? `<span class="status-badge status-paid">To'langan${item.paymentMethod ? ` · ${item.paymentMethod === "card" ? "💳" : "💵"}` : ""}</span>`
        : `<span class="status-badge status-unpaid">To'lanmagan</span>`;

      return `
        <div class="queue-card" data-id="${item._id}">
          <div class="queue-card-head">
            <h2 class="queue-client-name">${escapeHtml(item.clientName)}</h2>
            ${scheduledTag}
          </div>
          <div class="reception-badges">
            <span class="status-badge status-${item.status}">${badge}</span>
            ${paidBadge}
          </div>
          <div class="reception-master">${escapeHtml(item.masterName || "")}</div>
          ${checkinBtn || payButtons ? `<div class="queue-actions">${checkinBtn}${payButtons}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

els.list.addEventListener("click", (e) => {
  const checkinBtn = e.target.closest("button[data-checkin]");
  if (checkinBtn) {
    checkinBtn.disabled = true;
    checkin(checkinBtn.dataset.checkin);
    return;
  }
  const payBtn = e.target.closest("button[data-pay]");
  if (payBtn) {
    payBtn.disabled = true;
    markPaid(payBtn.dataset.pay, payBtn.dataset.method);
  }
});

function connectSocket() {
  const socket = io(API_URL, { reconnection: true });
  socket.on("connect", () => setOffline(false));
  socket.on("connect_error", () => setOffline(true));
  socket.on("disconnect", () => setOffline(true));
  // Reception cares about every master at once, so any update just
  // triggers a refetch of the flat cross-master list.
  socket.on("queue:update", () => loadQueue());
}

async function init() {
  try {
    await loadCatalog();
    await loadQueue();
  } catch (err) {
    setOffline(true);
    els.list.innerHTML = "<p class=\"empty-state\">Backend bilan aloqa yo'q</p>";
  }
  connectSocket();
}

init();

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
};

let masters = [];
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

// ── Форма: салон -> мастера этого салона ──────────────────
function renderMasterOptions(salonId) {
  const filtered = masters.filter((m) => m.salonId === salonId);
  els.master.innerHTML = filtered
    .map((m) => `<option value="${m._id}">${escapeHtml(m.name)}</option>`)
    .join("");
}

async function loadCatalog() {
  const [salons, allMasters, services] = await Promise.all([
    apiFetch("/api/salons"),
    apiFetch("/api/masters"),
    apiFetch("/api/services"),
  ]);
  masters = allMasters;

  els.salon.innerHTML = salons
    .map((s) => `<option value="${s._id}">${escapeHtml(s.name)}</option>`)
    .join("");
  els.service.innerHTML = services
    .map((s) => `<option value="${s._id}">${escapeHtml(s.name)} — ${s.price} so'm</option>`)
    .join("");

  if (salons[0]) renderMasterOptions(salons[0]._id);
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

async function checkin(id) {
  try {
    await apiFetch(`/api/queue/${id}/checkin`, { method: "POST" });
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

      return `
        <div class="queue-card" data-id="${item._id}">
          <div class="queue-card-head">
            <h2 class="queue-client-name">${escapeHtml(item.clientName)}</h2>
            ${scheduledTag}
          </div>
          <span class="status-badge status-${item.status}">${badge}</span>
          <div class="reception-master">${escapeHtml(item.masterName || "")}</div>
          ${checkinBtn ? `<div class="queue-actions">${checkinBtn}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

els.list.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-checkin]");
  if (!btn) return;
  btn.disabled = true;
  checkin(btn.dataset.checkin);
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

import { io } from "socket.io-client";
import "./style.css";

const API_URL = import.meta.env.VITE_API_URL;

const els = {
  select: document.getElementById("master-select"),
  list: document.getElementById("queue-list"),
  offline: document.getElementById("offline-banner"),
  dutyToggle: document.getElementById("duty-toggle"),
};

let currentMasterId = null;
let queue = [];
let mastersById = {};

const STATUS_LABELS = {
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

async function loadMasters() {
  const masters = await apiFetch("/api/masters");
  mastersById = Object.fromEntries(masters.map((m) => [m._id, m]));
  els.select.innerHTML = masters
    .map((m) => `<option value="${m._id}">${escapeHtml(m.name)}</option>`)
    .join("");

  const params = new URLSearchParams(location.search);
  const fromUrl = params.get("masterId");
  const initial = masters.some((m) => m._id === fromUrl) ? fromUrl : masters[0]?._id;

  if (initial) {
    els.select.value = initial;
    switchMaster(initial);
  } else {
    els.list.innerHTML = '<p class="empty-state">Ustalar topilmadi</p>';
  }
}

function switchMaster(masterId) {
  currentMasterId = masterId;
  const params = new URLSearchParams(location.search);
  params.set("masterId", masterId);
  history.replaceState(null, "", `?${params}`);
  renderDutyToggle();
  loadQueue();
}

function renderDutyToggle() {
  const master = mastersById[currentMasterId];
  const onDuty = !!(master && master.onDuty);
  els.dutyToggle.textContent = onDuty ? "Liniyani tugatish" : "Chiqish liniyaga";
  els.dutyToggle.classList.toggle("duty-on", onDuty);
  els.dutyToggle.classList.toggle("duty-off", !onDuty);
}

async function toggleDuty() {
  const master = mastersById[currentMasterId];
  if (!master) return;
  const nextOnDuty = !master.onDuty;
  els.dutyToggle.disabled = true;
  try {
    const updated = await apiFetch(`/api/masters/${currentMasterId}/duty`, {
      method: "POST",
      body: JSON.stringify({ onDuty: nextOnDuty }),
    });
    mastersById[currentMasterId] = updated;
    setOffline(false);
  } catch (err) {
    setOffline(true);
  } finally {
    els.dutyToggle.disabled = false;
    renderDutyToggle();
  }
}

els.dutyToggle.addEventListener("click", toggleDuty);

async function loadQueue() {
  if (!currentMasterId) return;
  try {
    queue = await apiFetch(`/api/queue/${currentMasterId}`);
    setOffline(false);
    render();
  } catch (err) {
    setOffline(true);
  }
}

async function setStatus(id, status) {
  const item = queue.find((q) => q._id === id);

  // optimistic UI: apply immediately, roll back on failure
  const snapshot = queue.map((q) => ({ ...q }));
  if (item) {
    if (status === "done" || status === "skipped" || status === "cancelled") {
      queue = queue.filter((q) => q._id !== id);
    } else {
      item.status = status;
    }
    render();
  }

  const attempt = () =>
    apiFetch(`/api/queue/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });

  try {
    await attempt();
    setOffline(false);
  } catch (err) {
    setOffline(true);
    // one retry after a short delay; if it still fails, roll back optimistic change
    setTimeout(async () => {
      try {
        await attempt();
        setOffline(false);
        loadQueue();
      } catch (e) {
        setOffline(true);
        queue = snapshot;
        render();
      }
    }, 3000);
  }
}

function actionsFor(item) {
  // "waiting" -> "called" sets calledAt on the backend, which feeds the
  // avgServiceTimeMs recalculation on "done" (actualMs = doneAt - calledAt).
  // Skipping straight to in_progress/done would silently break ETA learning.
  if (item.status === "waiting") {
    return [{ label: "Qabul qildim", to: "called", variant: "btn-primary" }];
  }
  return [
    { label: "Tayyor", to: "done", variant: "btn-success" },
    { label: "Kelmadi", to: "skipped", variant: "btn-danger" },
  ];
}

function render() {
  if (!queue.length) {
    els.list.innerHTML = "<p class=\"empty-state\">Navbat bo'sh 🎉</p>";
    return;
  }

  els.list.innerHTML = queue
    .map((item, i) => {
      const isActive = i === 0;
      const actions = isActive ? actionsFor(item) : [];
      return `
        <div class="queue-card ${isActive ? "is-active" : "is-pending"}" data-id="${item._id}">
          <div class="queue-card-head">
            <span class="queue-position">#${i + 1}</span>
            <h2 class="queue-client-name">${escapeHtml(item.clientName)}</h2>
            ${item.eta != null ? `<span class="queue-eta">${formatEta(item.eta)}</span>` : ""}
          </div>
          <span class="status-badge status-${item.status}">${STATUS_LABELS[item.status] || item.status}</span>
          <span class="status-badge ${item.paid ? "status-paid" : "status-unpaid"}">${item.paid ? "To'langan" : "To'lanmagan"}</span>
          ${
            actions.length
              ? `<div class="queue-actions">
                  ${actions
                    .map(
                      (a) =>
                        `<button class="btn ${a.variant}" data-action="${a.to}" data-id="${item._id}">${a.label}</button>`
                    )
                    .join("")}
                </div>`
              : ""
          }
        </div>
      `;
    })
    .join("");
}

// Backend sends `eta` as milliseconds-until-turn (idx * avgServiceTimeMs),
// not a timestamp — render it as a relative wait, not a clock time.
function formatEta(etaMs) {
  if (!Number.isFinite(etaMs)) return "";
  const totalMin = Math.round(etaMs / 60000);
  if (totalMin < 1) return "Endi";
  return `~${totalMin} daq`;
}

function escapeHtml(str = "") {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

els.list.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  btn.disabled = true;
  setStatus(btn.dataset.id, btn.dataset.action);
});

els.select.addEventListener("change", (e) => switchMaster(e.target.value));

function connectSocket() {
  const socket = io(API_URL, { reconnection: true });
  socket.on("connect", () => setOffline(false));
  socket.on("connect_error", () => setOffline(true));
  socket.on("disconnect", () => setOffline(true));
  socket.on("queue:update", (data) => {
    if (data.masterId !== currentMasterId) return;
    queue = data.queue;
    render();
  });
}

async function init() {
  try {
    await loadMasters();
  } catch (err) {
    setOffline(true);
    els.list.innerHTML = "<p class=\"empty-state\">Backend bilan aloqa yo'q</p>";
  }
  connectSocket();
}

init();

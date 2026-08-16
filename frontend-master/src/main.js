import { io } from "socket.io-client";
import "./style.css";

const API_URL = import.meta.env.VITE_API_URL;

const els = {
  list: document.getElementById("queue-list"),
  offline: document.getElementById("offline-banner"),
  stats: document.getElementById("queue-stats"),
  todayStats: document.getElementById("today-stats"),
  indicator: document.getElementById("master-indicator"),
  indicatorName: document.getElementById("master-indicator-name"),
  switchBtn: document.getElementById("switch-master-btn"),
  dutyToggle: document.getElementById("duty-toggle"),
};

const STORAGE_KEY = "navbat_master_id";

let currentMasterId = null;
let currentMaster = null;
let mastersList = [];
let queue = [];

const STATUS_LABELS = {
  waiting: "Navbatda",
  called: "Chaqirildi",
  in_progress: "Xizmatda",
  scheduled: "Vaqtga yozilgan",
};

function setOffline(isOffline) {
  els.offline.classList.toggle("hidden", !isOffline);
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = new Error(`API xato: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function loadMasters() {
  mastersList = await apiFetch("/api/masters");

  if (!mastersList.length) {
    els.list.innerHTML = '<p class="empty-state">Ustalar topilmadi</p>';
    return;
  }

  const remembered = mastersList.find((m) => m._id === localStorage.getItem(STORAGE_KEY));
  if (remembered) {
    selectMaster(remembered);
  } else {
    showLoginScreen();
  }
}

// Login: master picks their name, enters their password. Backend checks it
// against Master.passwordHash (POST /api/masters/login) — every other
// endpoint (queue, status, reception) stays open per CLAUDE.md, this only
// gates "who is this master" on the device.
function showLoginScreen(errorMsg = "") {
  currentMasterId = null;
  els.stats.classList.add("hidden");
  els.indicator.classList.add("hidden");
  els.list.innerHTML = `
    <div class="login-screen">
      <p class="login-screen-title">Kim sifatida kirasiz?</p>
      <form id="login-form" class="login-form">
        <select id="login-master-select" class="login-select">
          <option value="reception">Reception</option>
          ${mastersList.map((m) => `<option value="${m._id}">${escapeHtml(m.name)}</option>`).join("")}
        </select>
        <input id="login-password" class="login-password" type="password" placeholder="Parol" autocomplete="current-password" required />
        ${errorMsg ? `<p class="login-error">${escapeHtml(errorMsg)}</p>` : ""}
        <button type="submit" class="btn btn-primary login-submit">Kirish</button>
      </form>
    </div>
  `;
  document.getElementById("login-form").addEventListener("submit", handleLoginSubmit);
}

// Reception has no backend account (see CLAUDE.md — no real auth exists yet
// anywhere in this app), so this is a client-side-only password gate, same
// trust level as everything else here. Good enough to keep it off passersby
// at the hackathon booth, not a real security boundary.
const RECEPTION_PASSWORD = "reception2026";

async function handleLoginSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector(".login-submit");
  const masterId = document.getElementById("login-master-select").value;
  const password = document.getElementById("login-password").value;

  if (masterId === "reception") {
    if (password === RECEPTION_PASSWORD) {
      window.location.href = "/reception.html";
    } else {
      showLoginScreen("Parol noto'g'ri");
    }
    return;
  }

  const master = mastersList.find((m) => m._id === masterId);
  if (!master) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Tekshirilmoqda…";
  try {
    await apiFetch("/api/masters/login", {
      method: "POST",
      body: JSON.stringify({ name: master.name, password }),
    });
    selectMaster(master);
  } catch (err) {
    showLoginScreen(err.status === 401 ? "Parol noto'g'ri" : "Serverga ulanib bo'lmadi");
  }
}

function selectMaster(master) {
  currentMasterId = master._id;
  currentMaster = master;
  localStorage.setItem(STORAGE_KEY, master._id);

  const params = new URLSearchParams(location.search);
  params.set("masterId", master._id);
  history.replaceState(null, "", `?${params}`);

  els.indicatorName.textContent = master.name;
  els.indicator.classList.remove("hidden");
  renderDutyToggle();

  loadQueue();
  loadTodayStats();
}

function logoutMaster() {
  localStorage.removeItem(STORAGE_KEY);
  currentMaster = null;
  els.todayStats.classList.add("hidden");
  const params = new URLSearchParams(location.search);
  params.delete("masterId");
  history.replaceState(null, "", location.pathname + (params.toString() ? `?${params}` : ""));
  showLoginScreen();
}

function renderDutyToggle() {
  if (!currentMaster) return;
  const onDuty = !!currentMaster.onDuty;
  els.dutyToggle.textContent = onDuty ? "Liniyani tugatish" : "Chiqish liniyaga";
  els.dutyToggle.classList.toggle("duty-on", onDuty);
  els.dutyToggle.classList.toggle("duty-off", !onDuty);
}

async function toggleDuty() {
  if (!currentMaster) return;
  const nextOnDuty = !currentMaster.onDuty;
  els.dutyToggle.disabled = true;
  try {
    currentMaster = await apiFetch(`/api/masters/${currentMasterId}/duty`, {
      method: "POST",
      body: JSON.stringify({ onDuty: nextOnDuty }),
    });
    setOffline(false);
    loadTodayStats();
  } catch (err) {
    setOffline(true);
  } finally {
    els.dutyToggle.disabled = false;
    renderDutyToggle();
  }
}

async function loadTodayStats() {
  if (!currentMasterId) return;
  try {
    const stats = await apiFetch(`/api/masters/${currentMasterId}/today`);
    renderTodayStats(stats);
  } catch (err) {
    // non-critical — leave whatever was last shown, queue polling already
    // surfaces the offline banner for real connectivity problems
  }
}

function renderTodayStats(stats) {
  els.todayStats.classList.remove("hidden");
  els.todayStats.innerHTML = `
    <div class="stat-pill">
      <span class="stat-value">${stats.clientsServed}</span>
      <span class="stat-label">Bugun mijoz</span>
    </div>
    <div class="stat-pill stat-earned">
      <span class="stat-value">${formatSum(stats.earned)}</span>
      <span class="stat-label">Hisoblangan</span>
    </div>
    <div class="stat-pill">
      <span class="stat-value">${formatHours(stats.hoursWorked)}</span>
      <span class="stat-label">Ishlagan</span>
    </div>
  `;
}

// hoursWorked comes from the backend as decimal hours (e.g. 1.75) — render
// as "H soat M daq" per tasks.md's "Ч ч М мин" spec, not a raw decimal.
function formatHours(hoursWorked) {
  const totalMin = Math.round((hoursWorked || 0) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 1) return `${m} daq`;
  return `${h} soat ${m} daq`;
}

function formatSum(n) {
  return new Intl.NumberFormat("uz-UZ").format(n || 0);
}

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
    return [{ label: "Qabul qildim", icon: "✓", to: "called", variant: "btn-primary" }];
  }
  return [
    { label: "Tayyor", icon: "✔", to: "done", variant: "btn-success" },
    { label: "Kelmadi", icon: "✕", to: "skipped", variant: "btn-danger" },
  ];
}

function initials(name = "") {
  return (name.trim()[0] || "?").toUpperCase();
}

function render() {
  if (!queue.length) {
    els.stats.classList.add("hidden");
    els.list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🎉</span>
        <span>Navbat bo'sh</span>
        <span class="empty-hint">Yangi mijoz kelganda shu yerda ko'rinadi</span>
      </div>
    `;
    return;
  }

  // "scheduled" items keep their original createdAt (booking time), so they
  // sort into the array wherever they were booked, not where they actually
  // belong. They aren't part of the live line yet (backend excludes them from
  // eta/position math, promotes them to "waiting" on their own once due) —
  // render them as a separate, non-actionable section instead of mixing them
  // into live queue positions.
  const liveItems = queue.filter((item) => item.status !== "scheduled");
  const scheduledItems = queue.filter((item) => item.status === "scheduled");
  const [current, ...rest] = liveItems;

  renderStats(liveItems.length, scheduledItems.length);

  let html = "";
  if (current) {
    html += activeCardHtml(current);
  }
  if (rest.length) {
    html += `<div class="queue-rows">${rest.map((item, i) => queueRowHtml(item, i + 2)).join("")}</div>`;
  }
  if (scheduledItems.length) {
    html += `<h2 class="section-title">Vaqtga yozilganlar</h2><div class="queue-rows">${scheduledItems
      .map(scheduledRowHtml)
      .join("")}</div>`;
  }
  if (!current && !rest.length && !scheduledItems.length) {
    html = `
      <div class="empty-state">
        <span class="empty-icon">🎉</span>
        <span>Navbat bo'sh</span>
      </div>
    `;
  }

  els.list.innerHTML = html;
}

function renderStats(liveCount, scheduledCount) {
  els.stats.classList.remove("hidden");
  els.stats.innerHTML = `
    <div class="stat-pill">
      <span class="stat-value">${liveCount}</span>
      <span class="stat-label">Navbatda</span>
    </div>
    <div class="stat-pill">
      <span class="stat-value">${scheduledCount}</span>
      <span class="stat-label">Vaqtga yozilgan</span>
    </div>
  `;
}

function activeCardHtml(item) {
  const actions = actionsFor(item);
  return `
    <div class="active-card" data-id="${item._id}">
      <span class="active-card-label">👤 Hozirgi mijoz</span>
      <div class="active-card-body">
        <span class="avatar">${initials(item.clientName)}</span>
        <div class="active-card-info">
          <h2 class="active-card-name">${escapeHtml(item.clientName)}</h2>
          <div class="active-card-badges">
            <span class="status-badge status-${item.status}">${STATUS_LABELS[item.status] || item.status}</span>
            ${paymentBadgeHtml(item)}
          </div>
        </div>
      </div>
      ${actionsHtml(actions, item._id)}
    </div>
  `;
}

function queueRowHtml(item, position) {
  return `
    <div class="queue-row" data-id="${item._id}">
      <span class="queue-row-position">#${position}</span>
      <span class="avatar">${initials(item.clientName)}</span>
      <span class="queue-row-name">${escapeHtml(item.clientName)}</span>
      <div class="queue-row-meta">
        <span class="status-badge status-${item.status}">${STATUS_LABELS[item.status] || item.status}</span>
        ${item.eta != null ? `<span class="queue-row-eta">${formatEta(item.eta)}</span>` : ""}
      </div>
    </div>
  `;
}

function scheduledRowHtml(item) {
  return `
    <div class="queue-row is-scheduled" data-id="${item._id}">
      <span class="queue-row-position">🕒</span>
      <span class="avatar">${initials(item.clientName)}</span>
      <span class="queue-row-name">${escapeHtml(item.clientName)}</span>
      <div class="queue-row-meta">
        <span class="status-badge status-scheduled">${STATUS_LABELS.scheduled}</span>
        <span class="queue-row-eta">${formatScheduledFor(item.scheduledFor)}</span>
      </div>
    </div>
  `;
}

// `paid` comes from the reception's "mark as paid" flow (POST /api/queue/:id/pay)
// — advisory only, no enforcement — the master just needs to see it at a glance.
function paymentBadgeHtml(item) {
  const label = item.paid ? `To'landi${item.paymentMethod ? ` (${paymentMethodLabel(item.paymentMethod)})` : ""}` : "To'lanmagan";
  return `<span class="status-badge ${item.paid ? "status-paid" : "status-unpaid"}">${label}</span>`;
}

function paymentMethodLabel(method) {
  return { cash: "naqd", card: "karta", other: "boshqa", split: "aralash" }[method] || method;
}

function actionsHtml(actions, id) {
  return `<div class="queue-actions">${actions
    .map(
      (a) =>
        `<button class="btn ${a.variant}" data-action="${a.to}" data-id="${id}"><span aria-hidden="true">${a.icon}</span> ${a.label}</button>`
    )
    .join("")}</div>`;
}

// Backend sends `eta` as milliseconds-until-turn (idx * avgServiceTimeMs),
// not a timestamp — render it as a relative wait, not a clock time.
function formatEta(etaMs) {
  if (!Number.isFinite(etaMs)) return "";
  const totalMin = Math.round(etaMs / 60000);
  if (totalMin < 1) return "Endi";
  return `~${totalMin} daq`;
}

function formatScheduledFor(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str = "") {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

els.list.addEventListener("click", (e) => {
  const actionBtn = e.target.closest("button[data-action]");
  if (actionBtn) {
    actionBtn.disabled = true;
    setStatus(actionBtn.dataset.id, actionBtn.dataset.action);
  }
});

els.switchBtn.addEventListener("click", logoutMaster);
els.dutyToggle.addEventListener("click", toggleDuty);

function connectSocket() {
  const socket = io(API_URL, { reconnection: true });
  socket.on("connect", () => setOffline(false));
  socket.on("connect_error", () => setOffline(true));
  socket.on("disconnect", () => setOffline(true));
  socket.on("queue:update", (data) => {
    if (data.masterId !== currentMasterId) return;
    queue = data.queue;
    render();
    loadTodayStats();
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

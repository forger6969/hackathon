import "./style.css";
import { io } from "socket.io-client";
import { api, API_URL } from "./api.js";
import {
  mockSalons,
  mockMasters,
  mockServices,
  mockCreateQueueItem,
  mockCheckin,
} from "./mock.js";

const app = document.getElementById("app");
const STORAGE_KEY = "navbat_queue_item";

let usingMock = false;
let socket = null;

const state = {
  step: "salon",
  salons: [],
  masters: [],
  services: [],
  salon: null,
  master: null,
  service: null,
  mode: null, // "now" | "scheduled"
  scheduledFor: null,
  clientName: "",
  phone: "",
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function initials(name) {
  return (name ?? "?").trim().slice(0, 1).toUpperCase();
}

async function safeCall(realFn, mockValue) {
  try {
    return await realFn();
  } catch (e) {
    usingMock = true;
    return mockValue;
  }
}

function progressDots(current, total) {
  return `<div class="progress-dots">${Array.from({ length: total })
    .map((_, i) => `<span class="${i < current ? "active" : ""}"></span>`)
    .join("")}</div>`;
}

function backButton(onClick) {
  const btn = document.createElement("button");
  btn.className = "wizard-back";
  btn.textContent = "← Orqaga";
  btn.addEventListener("click", onClick);
  return btn;
}

// ---------- Step 1: salon ----------

async function renderSalonStep() {
  state.step = "salon";
  if (state.salons.length === 0) {
    state.salons = await safeCall(() => api.getSalons(), mockSalons);
  }

  app.innerHTML = `
    <div class="wizard">
      <div class="hero">
        <div class="hero-badge">NAVBAT</div>
        <div class="hero-title">Navbatsiz sartaroshxona</div>
        <div class="hero-sub">Salonni tanlang, joyingizni band qiling — kutishga hojat yo'q</div>
      </div>
      ${progressDots(1, 5)}
      <div class="step-title">Salonni tanlang</div>
      <div class="step-sub">Sizga qulay filialni tanlang</div>
      <div class="option-list" id="salon-list"></div>
    </div>
  `;

  const list = document.getElementById("salon-list");
  state.salons.forEach((salon) => {
    const el = document.createElement("button");
    el.className = "option-card";
    el.innerHTML = `
      <div class="avatar">${initials(salon.name)}</div>
      <div>
        <div class="option-title">${escapeHtml(salon.name)}</div>
        <div class="option-sub">${escapeHtml(salon.address || "")}</div>
      </div>
    `;
    el.addEventListener("click", () => {
      state.salon = salon;
      state.master = null;
      state.masters = [];
      renderMasterStep();
    });
    list.appendChild(el);
  });
}

// ---------- Step 2: master ----------

async function renderMasterStep() {
  state.step = "master";
  state.masters = await safeCall(() => api.getMasters(state.salon._id), mockMasters);

  app.innerHTML = `<div class="wizard">${progressDots(2, 5)}<div class="step-title">Ustani tanlang</div><div class="step-sub">${escapeHtml(state.salon.name)}</div><div class="option-list" id="master-list"></div></div>`;
  document.querySelector(".wizard").prepend(backButton(renderSalonStep));

  const list = document.getElementById("master-list");
  state.masters.forEach((master) => {
    const el = document.createElement("button");
    el.className = "option-card";
    const avatar = master.photoUrl
      ? `<img class="avatar" src="${escapeHtml(master.photoUrl)}" alt="${escapeHtml(master.name)}" />`
      : `<div class="avatar">${initials(master.name)}</div>`;
    el.innerHTML = `${avatar}<div><div class="option-title">${escapeHtml(master.name)}</div><div class="option-sub">Usta</div></div>`;
    el.addEventListener("click", () => {
      state.master = master;
      state.service = null;
      renderServiceStep();
    });
    list.appendChild(el);
  });
}

// ---------- Step 3: service ----------

async function renderServiceStep() {
  state.step = "service";
  if (state.services.length === 0) {
    state.services = await safeCall(() => api.getServices(), mockServices);
  }

  app.innerHTML = `<div class="wizard">${progressDots(3, 5)}<div class="step-title">Xizmatni tanlang</div><div class="step-sub">${escapeHtml(state.master.name)} bilan</div><div class="option-list" id="service-list"></div></div>`;
  document.querySelector(".wizard").prepend(backButton(renderMasterStep));

  const list = document.getElementById("service-list");
  state.services.forEach((service) => {
    const el = document.createElement("button");
    el.className = "option-card";
    el.innerHTML = `<div class="avatar">${initials(service.name)}</div><div><div class="option-title">${escapeHtml(service.name)}</div><div class="option-sub">${service.price.toLocaleString()} so'm</div></div>`;
    el.addEventListener("click", () => {
      state.service = service;
      renderModeStep();
    });
    list.appendChild(el);
  });
}

// ---------- Step 4: now vs scheduled ----------

function renderModeStep() {
  state.step = "mode";
  app.innerHTML = `
    <div class="wizard">
      ${progressDots(4, 5)}
      <div class="step-title">Qachon kelasiz?</div>
      <div class="step-sub">${escapeHtml(state.service.name)} — ${escapeHtml(state.master.name)}</div>
      <div class="mode-choice">
        <button class="mode-btn" id="mode-now">
          <div class="mode-title">Hozir navbatga turaman</div>
          <div class="mode-sub">Darhol joningizni oling, ETA ko'rasiz</div>
        </button>
        <button class="mode-btn" id="mode-scheduled">
          <div class="mode-title">Vaqtga yozilaman</div>
          <div class="mode-sub">Kelasi vaqtni tanlab qo'ying</div>
        </button>
      </div>
    </div>
  `;
  document.querySelector(".wizard").prepend(backButton(renderServiceStep));

  document.getElementById("mode-now").addEventListener("click", () => {
    state.mode = "now";
    state.scheduledFor = null;
    renderInfoStep();
  });
  document.getElementById("mode-scheduled").addEventListener("click", () => {
    state.mode = "scheduled";
    renderTimeStep();
  });
}

// ---------- Step 4b: pick time (only for scheduled) ----------

function renderTimeStep() {
  state.step = "time";
  const min = new Date(Date.now() + 5 * 60 * 1000);
  const minLocal = new Date(min.getTime() - min.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  app.innerHTML = `
    <div class="wizard">
      ${progressDots(4, 5)}
      <div class="step-title">Qaysi vaqtga?</div>
      <div class="step-sub">Kelmoqchi bo'lgan vaqtingizni tanlang</div>
      <div class="form">
        <input type="datetime-local" id="scheduled-input" min="${minLocal}" />
        <p class="error-text" id="time-error"></p>
        <button id="time-continue">Davom etish</button>
      </div>
    </div>
  `;
  document.querySelector(".wizard").prepend(backButton(renderModeStep));

  document.getElementById("time-continue").addEventListener("click", () => {
    const val = document.getElementById("scheduled-input").value;
    const errorEl = document.getElementById("time-error");
    if (!val) {
      errorEl.textContent = "Vaqtni tanlang";
      return;
    }
    const chosen = new Date(val);
    if (chosen <= new Date()) {
      errorEl.textContent = "Kelajakdagi vaqtni tanlang";
      return;
    }
    state.scheduledFor = chosen.toISOString();
    renderInfoStep();
  });
}

// ---------- Step 5: client info ----------

function renderInfoStep() {
  state.step = "info";
  app.innerHTML = `
    <div class="wizard">
      ${progressDots(5, 5)}
      <div class="step-title">Ma'lumotlaringiz</div>
      <div class="step-sub">Navbatni tasdiqlash uchun</div>
      <form class="form" id="info-form">
        <div>
          <label for="clientName">Ismingiz</label>
          <input id="clientName" required placeholder="Ism" value="${escapeHtml(state.clientName)}" />
        </div>
        <div>
          <label for="phone">Telefon raqam</label>
          <input id="phone" required placeholder="+998 90 123 45 67" value="${escapeHtml(state.phone)}" />
        </div>
        <p class="error-text" id="info-error"></p>
        <button type="submit">Tasdiqlash</button>
      </form>
    </div>
  `;
  document.querySelector(".wizard").prepend(backButton(state.mode === "scheduled" ? renderTimeStep : renderModeStep));

  document.getElementById("info-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("info-error");
    errorEl.textContent = "";
    state.clientName = document.getElementById("clientName").value.trim();
    state.phone = document.getElementById("phone").value.trim();

    const body = {
      clientName: state.clientName,
      phone: state.phone,
      serviceId: state.service._id,
      masterId: state.master._id,
    };
    if (state.mode === "scheduled") body.scheduledFor = state.scheduledFor;

    try {
      let item = usingMock ? mockCreateQueueItem(body) : await api.createQueueItem(body);
      if (!usingMock && item.status === "waiting") {
        item = await enrichWithQueuePosition(item);
      }
      item.masterName = state.master.name;
      item.serviceName = state.service.name;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(item));
      renderResult(item);
    } catch (err) {
      errorEl.textContent = "Xatolik: navbatga yozib bo'lmadi. Qayta urinib ko'ring.";
    }
  });
}

// ---------- Result: scheduled confirmation ----------

function renderScheduledResult(item) {
  const time = new Date(item.scheduledFor);
  const label = time.toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  app.innerHTML = `
    <div class="card scheduled-card">
      <div class="salon-name">Navbat</div>
      <div class="eta">Siz yozildingiz</div>
      <div class="scheduled-time">${label}</div>
      <div class="eta-sub" style="margin-bottom:24px;">${escapeHtml(item.masterName ?? "")} — ${escapeHtml(item.serviceName ?? "")}</div>
      <button id="checkin-btn">Men keldim</button>
    </div>
  `;

  document.getElementById("checkin-btn").addEventListener("click", async () => {
    try {
      const updated = usingMock ? mockCheckin(item) : { ...item, ...(await api.checkin(item._id)) };
      const enriched = usingMock ? updated : await enrichWithQueuePosition(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enriched));
      renderResult(enriched);
    } catch {
      /* stay on scheduled screen; user can retry */
    }
  });
}

// ---------- Result: live queue status ----------

function computePosition(queueList, item) {
  const mine = queueList.find((q) => q._id === item._id);
  if (!mine) return { ...item };
  const position = queueList.filter((q) => q.status === "waiting").indexOf(mine) + 1;
  return { ...item, ...mine, position: position || item.position };
}

async function enrichWithQueuePosition(item) {
  try {
    const queueList = await api.getMasterQueue(item.masterId);
    return computePosition(queueList, item);
  } catch {
    return item;
  }
}

function formatEta(etaDurationMs) {
  if (etaDurationMs === undefined || etaDurationMs === null) return "hisoblanmoqda...";
  const minutes = Math.round(etaDurationMs / 60000);
  if (minutes <= 0) return "hozir";
  return `~${minutes} daqiqa`;
}

function statusLabel(status) {
  switch (status) {
    case "waiting":
      return "Navbatda";
    case "called":
      return "Sizni chaqirishdi!";
    case "in_progress":
      return "Xizmat ko'rsatilmoqda";
    case "done":
      return "Tugallandi";
    case "skipped":
      return "O'tkazib yuborildi";
    case "cancelled":
      return "Bekor qilindi";
    case "scheduled":
      return "Yozilgan";
    default:
      return status;
  }
}

function renderResult(item) {
  if (item.status === "scheduled") {
    renderScheduledResult(item);
    return;
  }

  const away = localStorage.getItem("navbat_away") === "1";

  app.innerHTML = `
    <div class="card">
      <div class="salon-name">Navbat</div>
      <div class="status-banner" id="offline-banner">Aloqa yo'q — ma'lumot yangilanmayapti</div>
      <div class="queue-number-label">Sizning navbatingiz</div>
      <div class="queue-number">${item.position ?? "—"}</div>
      <div class="eta">${formatEta(item.eta)}</div>
      <div class="eta-sub">taxminiy kutish vaqti</div>
      <div class="status-pill ${item.status}">${statusLabel(item.status)}</div>
      <div class="details">
        <div class="detail-row"><span>Ism</span><span>${escapeHtml(item.clientName ?? "—")}</span></div>
        <div class="detail-row"><span>Telefon</span><span>${escapeHtml(item.phone ?? "—")}</span></div>
      </div>
      <button class="away ${away ? "active" : ""}" id="away-btn">
        ${away ? "Qaytdim" : "15 daqiqaga chiqib kelaman"}
      </button>
    </div>
  `;

  document.getElementById("away-btn").addEventListener("click", () => {
    const nowAway = localStorage.getItem("navbat_away") === "1";
    localStorage.setItem("navbat_away", nowAway ? "0" : "1");
    renderResult(item);
  });

  if (!usingMock) {
    connectSocket(item);
  }
}

function connectSocket(item) {
  if (socket) socket.disconnect();
  socket = io(API_URL, { reconnectionAttempts: 5 });
  const banner = () => document.getElementById("offline-banner");

  socket.on("connect", () => banner()?.classList.remove("visible"));
  socket.on("disconnect", () => banner()?.classList.add("visible"));
  socket.on("connect_error", () => banner()?.classList.add("visible"));

  socket.on("queue:update", (payload) => {
    if (!payload?.queue || payload.masterId !== item.masterId) return;
    const updated = computePosition(payload.queue, item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    renderResult(updated);
  });
}

// ---------- Init ----------

async function init() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const item = JSON.parse(stored);
    if (["waiting", "called", "in_progress", "scheduled"].includes(item.status)) {
      renderResult(item);
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
  }
  renderSalonStep();
}

init();

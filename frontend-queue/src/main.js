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
const STEP_LABELS = ["Usta", "Xizmat", "Vaqt", "Tasdiqlash"];

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
    return mockValue;
  }
}

function stepper(currentIndex) {
  return `<div class="stepper">${STEP_LABELS.map((label, i) => {
    const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "";
    return `<div class="step-item ${state}"><span class="step-num">${i + 1}</span><span class="step-label">${label}</span></div>`;
  }).join('<span class="step-line"></span>')}</div>`;
}

function backButton(onClick) {
  const btn = document.createElement("button");
  btn.className = "wizard-back";
  btn.textContent = "← Orqaga";
  btn.addEventListener("click", onClick);
  return btn;
}

// ---------- Locations: salon + map (static landing section) ----------

function setSalonMap(salon) {
  const frame = document.getElementById("salon-map");
  if (!frame || !salon?.location) return;
  const { lat, lng } = salon.location;
  const d = 0.012;
  frame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
}

async function renderSalonSection() {
  const list = document.getElementById("salon-list");
  if (!list) return;
  state.salons = await safeCall(() => api.getSalons(), mockSalons);

  list.innerHTML = "";
  state.salons.forEach((salon, i) => {
    const el = document.createElement("button");
    el.className = "option-card salon-card";
    el.innerHTML = `
      <div class="avatar">${initials(salon.name)}</div>
      <div>
        <div class="option-title">${escapeHtml(salon.name)}</div>
        <div class="option-sub">${escapeHtml(salon.address || "")}</div>
      </div>
    `;
    el.addEventListener("click", () => {
      document.querySelectorAll(".salon-card").forEach((c) => c.classList.remove("selected"));
      el.classList.add("selected");
      state.salon = salon;
      state.master = null;
      state.masters = [];
      setSalonMap(salon);
      renderMasterStep();
      document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    list.appendChild(el);
    if (i === 0) {
      setSalonMap(salon);
    }
  });
}

// ---------- Landing preview: services & masters (read-only teasers) ----------

async function renderServicesPreview() {
  const grid = document.getElementById("services-preview");
  if (!grid) return;
  const services = await safeCall(() => api.getServices(), mockServices);
  grid.innerHTML = services
    .map(
      (s) => `
      <div class="preview-card reveal">
        <div class="preview-card-icon">${initials(s.name)}</div>
        <div class="preview-card-title">${escapeHtml(s.name)}</div>
        <div class="preview-card-price">${s.price.toLocaleString()} so'm</div>
      </div>
    `
    )
    .join("");
  observeReveal();
}

async function renderMastersPreview() {
  const grid = document.getElementById("masters-preview");
  if (!grid) return;
  const masters = await safeCall(() => api.getMasters(), mockMasters);
  grid.innerHTML = masters
    .map((m) => {
      const avatar = m.photoUrl
        ? `<img class="preview-avatar" src="${escapeHtml(m.photoUrl)}" alt="${escapeHtml(m.name)}" />`
        : `<div class="preview-avatar preview-avatar-fallback">${initials(m.name)}</div>`;
      return `
        <div class="preview-card reveal">
          ${avatar}
          <div class="preview-card-title">${escapeHtml(m.name)}</div>
          <div class="preview-card-sub">Usta</div>
        </div>
      `;
    })
    .join("");
  observeReveal();
}

// ---------- Step 2: master ----------

function scrollToLocations() {
  document.getElementById("locations")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderEmptyBookState() {
  app.innerHTML = `
    <div class="wizard">
      <div class="empty-book">
        <div class="empty-book-title">Avval salonni tanlang</div>
        <div class="empty-book-sub">Navbatga yozilish uchun yuqoridagi filiallardan birini tanlashingiz kerak</div>
        <button id="goto-locations">Salonlarni ko'rish</button>
      </div>
    </div>
  `;
  document.getElementById("goto-locations").addEventListener("click", scrollToLocations);
}

async function renderMasterStep() {
  if (!state.salon) {
    renderEmptyBookState();
    return;
  }
  state.step = "master";
  state.masters = await safeCall(
    () => api.getMasters(state.salon._id, true),
    mockMasters.filter((m) => m.onDuty !== false)
  );

  app.innerHTML = `<div class="wizard">${stepper(0)}<div class="step-title">Ustani tanlang</div><div class="step-sub">${escapeHtml(state.salon.name)}</div><div class="option-list" id="master-list"></div></div>`;
  document.querySelector(".wizard").prepend(backButton(scrollToLocations));

  const list = document.getElementById("master-list");

  if (state.masters.length === 0) {
    list.innerHTML = `<div class="empty-book"><div class="empty-book-title">Hozircha usta smenada yo'q</div><div class="empty-book-sub">Iltimos, birozdan so'ng qayta urinib ko'ring yoki boshqa salonni tanlang</div></div>`;
    return;
  }

  state.masters.forEach((master) => {
    const el = document.createElement("button");
    el.className = "option-card";
    const avatar = master.photoUrl
      ? `<img class="avatar" src="${escapeHtml(master.photoUrl)}" alt="${escapeHtml(master.name)}" />`
      : `<div class="avatar">${initials(master.name)}</div>`;
    el.innerHTML = `${avatar}<div><div class="option-title">${escapeHtml(master.name)}</div><div class="option-sub">Smenada</div></div>`;
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

  app.innerHTML = `<div class="wizard">${stepper(1)}<div class="step-title">Xizmatni tanlang</div><div class="step-sub">${escapeHtml(state.master.name)} bilan</div><div class="option-list" id="service-list"></div></div>`;
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
      ${stepper(2)}
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
      ${stepper(2)}
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
      ${stepper(3)}
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

    let item;
    let isMock = false;
    try {
      item = await api.createQueueItem(body);
    } catch (err) {
      item = mockCreateQueueItem(body);
      isMock = true;
    }

    if (!isMock && item.status === "waiting") {
      item = await enrichWithQueuePosition(item);
    }
    item.__mock = isMock;
    item.masterName = state.master.name;
    item.serviceName = state.service.name;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(item));
    localStorage.removeItem("navbat_away");
    renderResult(item);
  });
}

// ---------- Result: scheduled confirmation ----------

function bookingCode(id) {
  return (id ?? "").toString().slice(-6).toUpperCase();
}

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
      <div class="eta-sub" style="margin-bottom:16px;">${escapeHtml(item.masterName ?? "")} — ${escapeHtml(item.serviceName ?? "")}</div>
      <div class="booking-code-label">Bron kodi — ressepshnga ko'rsating</div>
      <div class="booking-code">${bookingCode(item._id)}</div>
      <p class="error-text" id="checkin-error"></p>
      <button id="checkin-btn">Men keldim</button>
    </div>
  `;

  document.getElementById("checkin-btn").addEventListener("click", async () => {
    const errorEl = document.getElementById("checkin-error");
    errorEl.textContent = "";
    let updated;
    const isMock = item.__mock;
    if (item.__mock) {
      updated = mockCheckin(item);
    } else {
      try {
        updated = { ...item, ...(await api.checkin(item._id)) };
      } catch {
        errorEl.textContent = "Xatolik: qayta urinib ko'ring.";
        return;
      }
    }
    const enriched = isMock ? updated : await enrichWithQueuePosition(updated);
    enriched.__mock = isMock;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enriched));
    localStorage.removeItem("navbat_away");
    renderResult(enriched);
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
      ${item.paid ? `<div class="paid-badge">✅ To'lov tasdiqlandi${item.paymentMethod ? ` (${item.paymentMethod === "card" ? "karta" : "naqd"})` : ""}</div>` : ""}
      <div class="booking-code-label">Bron kodi — ressepshnga ko'rsating</div>
      <div class="booking-code booking-code-sm">${bookingCode(item._id)}</div>
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

  if (!item.__mock) {
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

// ---------- Landing chrome: reveal-on-scroll, sticky navbar shadow ----------

let revealObserver = null;

function observeReveal() {
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
  }
  document.querySelectorAll(".reveal:not(.in-view)").forEach((el) => revealObserver.observe(el));
}

function initNavbarShadow() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;
  window.addEventListener(
    "scroll",
    () => {
      navbar.classList.toggle("scrolled", window.scrollY > 12);
    },
    { passive: true }
  );
}

// ---------- Init ----------

async function init() {
  initNavbarShadow();
  observeReveal();
  renderServicesPreview();
  renderMastersPreview();
  await renderSalonSection();

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const item = JSON.parse(stored);
    if (["waiting", "called", "in_progress", "scheduled"].includes(item.status)) {
      renderResult(item);
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
  }
  renderMasterStep();
}

init();

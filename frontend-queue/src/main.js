import "./style.css";
import { io } from "socket.io-client";
import { api, API_URL } from "./api.js";
import { mockMasters, mockServices, mockCreateQueueItem, mockQueueList } from "./mock.js";

const app = document.getElementById("app");

const STORAGE_KEY = "navbat_queue_item";
let usingMock = false;
let socket = null;

async function loadCatalog() {
  try {
    const [masters, services] = await Promise.all([api.getMasters(), api.getServices()]);
    return { masters, services };
  } catch (e) {
    usingMock = true;
    return { masters: mockMasters, services: mockServices };
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
    default:
      return status;
  }
}

function renderForm(catalog) {
  app.innerHTML = `
    <div class="card">
      <div class="salon-name">Navbat</div>
      <div class="eta" style="margin-bottom:20px;">Navbatga yozilish</div>
      <form class="form" id="queue-form">
        <div>
          <label for="clientName">Ismingiz</label>
          <input id="clientName" name="clientName" required placeholder="Ism" />
        </div>
        <div>
          <label for="phone">Telefon raqam</label>
          <input id="phone" name="phone" required placeholder="+998 90 123 45 67" />
        </div>
        <div>
          <label for="serviceId">Xizmat</label>
          <select id="serviceId" name="serviceId" required>
            ${catalog.services.map((s) => `<option value="${s._id}">${s.name} — ${s.price.toLocaleString()} so'm</option>`).join("")}
          </select>
        </div>
        <div>
          <label for="masterId">Usta</label>
          <select id="masterId" name="masterId" required>
            ${catalog.masters.map((m) => `<option value="${m._id}">${m.name}</option>`).join("")}
          </select>
        </div>
        <p class="error-text" id="form-error"></p>
        <button type="submit">Navbatga yozilish</button>
      </form>
    </div>
  `;

  document.getElementById("queue-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("form-error");
    errorEl.textContent = "";
    const formData = new FormData(e.target);
    const body = {
      clientName: formData.get("clientName").trim(),
      phone: formData.get("phone").trim(),
      serviceId: formData.get("serviceId"),
      masterId: formData.get("masterId"),
    };

    try {
      let item = usingMock ? mockCreateQueueItem(body) : await api.createQueueItem(body);
      if (!usingMock) {
        item = await enrichWithQueuePosition(item);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(item));
      renderQueueStatus(item);
    } catch (err) {
      errorEl.textContent = "Xatolik: navbatga yozib bo'lmadi. Qayta urinib ko'ring.";
    }
  });
}

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

function renderQueueStatus(item) {
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
        <div class="detail-row"><span>Ism</span><span>${item.clientName ?? "—"}</span></div>
        <div class="detail-row"><span>Telefon</span><span>${item.phone ?? "—"}</span></div>
      </div>
      <button class="away ${away ? "active" : ""}" id="away-btn">
        ${away ? "Qaytdim" : "15 daqiqaga chiqib kelaman"}
      </button>
    </div>
  `;

  document.getElementById("away-btn").addEventListener("click", () => {
    const nowAway = localStorage.getItem("navbat_away") === "1";
    localStorage.setItem("navbat_away", nowAway ? "0" : "1");
    renderQueueStatus(item);
  });

  if (!usingMock) {
    connectSocket(item);
  } else {
    simulateMockUpdates(item);
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
    renderQueueStatus(updated);
  });
}

function simulateMockUpdates(item) {
  const list = mockQueueList(item.masterId, item._id);
  const mine = list.find((q) => q._id === item._id) ?? item;
  document.getElementById("offline-banner")?.classList.remove("visible");
}

async function init() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const item = JSON.parse(stored);
    if (["waiting", "called", "in_progress"].includes(item.status)) {
      renderQueueStatus(item);
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
  }
  const catalog = await loadCatalog();
  renderForm(catalog);
}

init();

import "./style.css";
import {
  state,
  apiFetch,
  loadMastersList,
  getRememberedMasterId,
  rememberMaster,
  forgetMaster,
  connectSocket,
  onQueueUpdate,
  onOfflineChange,
} from "./state.js";
import { escapeHtml } from "./format.js";
import { registerPage, startRouter } from "./router.js";
import { initNotifications, pushNotification } from "./notifications.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderBookings } from "./pages/bookings.js";
import { renderCalendar } from "./pages/calendar.js";
import { renderClients } from "./pages/clients.js";
import { renderServices } from "./pages/services.js";
import { renderStats } from "./pages/stats.js";
import { renderEarnings } from "./pages/earnings.js";
import { renderProfile } from "./pages/profile.js";
import { renderSettings } from "./pages/settings.js";

const els = {
  loginRoot: document.getElementById("login-root"),
  appShell: document.getElementById("app-shell"),
  offline: document.getElementById("offline-banner"),
};

registerPage("dashboard", renderDashboard);
registerPage("bookings", renderBookings);
registerPage("calendar", renderCalendar);
registerPage("clients", renderClients);
registerPage("services", renderServices);
registerPage("stats", renderStats);
registerPage("earnings", renderEarnings);
registerPage("profile", renderProfile);
registerPage("settings", renderSettings);

onOfflineChange((isOffline) => els.offline.classList.toggle("hidden", !isOffline));

// Login: master picks their name, enters their password. Backend checks it
// against Master.passwordHash (POST /api/masters/login) — every other
// endpoint (queue, status, reception) stays open per CLAUDE.md, this only
// gates "who is this master" on the device.
function showLoginScreen(errorMsg = "") {
  els.appShell.classList.add("hidden");
  els.loginRoot.classList.remove("hidden");
  els.loginRoot.innerHTML = `
    <div class="login-page">
      <div class="login-screen">
        <div class="login-brand">
          <span class="brand-mark brand-mark-lg"><img src="/logo-icon.png" alt="" /></span>
          <span class="login-brand-name">NAVBAT</span>
          <span class="login-brand-sub">Usta paneli</span>
        </div>
        <p class="login-screen-title">Kim sifatida kirasiz?</p>
        <form id="login-form" class="login-form">
          <select id="login-master-select" class="login-select">
            ${state.mastersList.map((m) => `<option value="${m._id}">${escapeHtml(m.name)}</option>`).join("")}
          </select>
          <input id="login-password" class="login-password" type="password" placeholder="Parol" autocomplete="current-password" required />
          ${errorMsg ? `<p class="login-error">${escapeHtml(errorMsg)}</p>` : ""}
          <button type="submit" class="btn btn-primary login-submit">Kirish</button>
        </form>
      </div>
    </div>
  `;
  document.getElementById("login-form").addEventListener("submit", handleLoginSubmit);
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector(".login-submit");
  const masterId = document.getElementById("login-master-select").value;
  const password = document.getElementById("login-password").value;
  const master = state.mastersList.find((m) => m._id === masterId);
  if (!master) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Tekshirilmoqda…";
  try {
    const loggedIn = await apiFetch("/api/masters/login", {
      method: "POST",
      body: JSON.stringify({ name: master.name, password }),
    });
    enterApp(loggedIn);
  } catch (err) {
    showLoginScreen(err.status === 401 ? "Parol noto'g'ri" : "Serverga ulanib bo'lmadi");
  }
}

function enterApp(master) {
  rememberMaster(master);
  els.loginRoot.classList.add("hidden");
  els.loginRoot.innerHTML = "";
  els.appShell.classList.remove("hidden");

  connectSocket();
  initNotifications();
  watchForNewClients();
  startRouter();

  window.addEventListener("navbat:logout", () => {
    forgetMaster();
    showLoginScreen();
  });
}

// Global (not per-page) listener so a bell notification fires no matter
// which page the master is currently looking at.
function watchForNewClients() {
  let knownIds = new Set();
  let knownPaid = new Map();
  onQueueUpdate((queue) => {
    const nextIds = new Set(queue.map((q) => q._id));
    for (const item of queue) {
      if (!knownIds.has(item._id) && knownIds.size > 0) {
        pushNotification("🔔", "Yangi mijoz navbatga qo'shildi", item.clientName);
      }
      if (knownPaid.get(item._id) === false && item.paid) {
        pushNotification("💳", "To'lov tasdiqlandi", item.clientName);
      }
      knownPaid.set(item._id, !!item.paid);
    }
    knownIds = nextIds;
  });
}

async function init() {
  try {
    await loadMastersList();
    if (!state.mastersList.length) {
      els.loginRoot.innerHTML = '<div class="login-page"><p class="empty-state">Ustalar topilmadi</p></div>';
      return;
    }
    const remembered = state.mastersList.find((m) => m._id === getRememberedMasterId());
    if (remembered) {
      enterApp(remembered);
    } else {
      showLoginScreen();
    }
  } catch (err) {
    els.loginRoot.innerHTML = "<div class=\"login-page\"><p class=\"empty-state\">Backend bilan aloqa yo'q</p></div>";
  }
}

init();

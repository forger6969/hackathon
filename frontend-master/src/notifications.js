import { state } from "./state.js";
import { escapeHtml } from "./format.js";
import { mockNotifications } from "./mock.js";

// Lightweight bell — per spec, not a full notification center. Seeded mock
// items plus anything pushed in via pushNotification() from real socket
// events (new client, payment confirmed) while the app is open.
const liveNotifications = [];

export function pushNotification(icon, title, body) {
  liveNotifications.unshift({ icon, title, body, minutesAgo: 0 });
  render();
}

function allNotifications() {
  const mocked = mockNotifications(state.currentMaster._id);
  return [...liveNotifications, ...mocked].slice(0, 8);
}

function render() {
  const badge = document.getElementById("notif-badge");
  const dropdown = document.getElementById("notif-dropdown");
  if (!badge || !dropdown) return;

  const items = allNotifications();
  if (items.length) {
    badge.textContent = String(items.length);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

  dropdown.innerHTML = items.length
    ? items
        .map(
          (n) => `
            <div class="notif-item">
              <span class="notif-item-icon">${n.icon}</span>
              <div class="notif-item-body">
                <span class="notif-item-title">${escapeHtml(n.title)}</span>
                <span class="notif-item-desc">${escapeHtml(n.body)}</span>
                <span class="notif-item-time">${n.minutesAgo} daq oldin</span>
              </div>
            </div>
          `
        )
        .join("")
    : '<div class="notif-empty">Bildirishnoma yo\'q</div>';
}

export function initNotifications() {
  const btn = document.getElementById("notif-bell-btn");
  const dropdown = document.getElementById("notif-dropdown");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) dropdown.classList.add("hidden");
  });
  render();
}

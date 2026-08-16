import { state, toggleDuty } from "./state.js";
import { escapeHtml, initials } from "./format.js";

const NAV_GROUPS = [
  { title: "ASOSIY", items: [{ id: "dashboard", label: "Asosiy", icon: "🏠" }] },
  {
    title: "MENING ISHIM",
    items: [
      { id: "bookings", label: "Mening yozuvlarim", icon: "📋" },
      { id: "calendar", label: "Kalendar", icon: "📅" },
      { id: "clients", label: "Mening mijozlarim", icon: "👥" },
    ],
  },
  { title: "XIZMATLAR", items: [{ id: "services", label: "Mening xizmatlarim", icon: "✂️" }] },
  {
    title: "STATISTIKA",
    items: [
      { id: "stats", label: "Mening statistikam", icon: "📊" },
      { id: "earnings", label: "Mening hisoblarim", icon: "💰" },
    ],
  },
  {
    title: "PROFIL",
    items: [
      { id: "profile", label: "Profil", icon: "🙍" },
      { id: "settings", label: "Sozlamalar", icon: "⚙️" },
    ],
  },
];

const BOTTOM_NAV_IDS = ["dashboard", "bookings", "clients", "stats", "profile"];
const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const els = {
  sidebarNav: document.getElementById("sidebar-nav"),
  sidebarFooter: document.getElementById("sidebar-footer"),
  bottomNav: document.getElementById("bottom-nav"),
  pageContent: document.getElementById("page-content"),
};

const pages = new Map();
let currentPageId = null;
let currentCleanup = null;

export function registerPage(id, renderFn) {
  pages.set(id, renderFn);
}

function navHref(id) {
  return `#/${id}`;
}

function currentRouteId() {
  const hash = location.hash.replace(/^#\/?/, "");
  return ALL_ITEMS.some((item) => item.id === hash) ? hash : "dashboard";
}

function renderSidebar(activeId) {
  els.sidebarNav.innerHTML = NAV_GROUPS.map(
    (group) => `
      <div class="sidebar-group">
        <div class="sidebar-group-title">${group.title}</div>
        ${group.items
          .map(
            (item) => `
              <a class="sidebar-link ${item.id === activeId ? "is-active" : ""}" href="${navHref(item.id)}">
                <span class="sidebar-link-icon">${item.icon}</span>
                <span>${item.label}</span>
              </a>
            `
          )
          .join("")}
      </div>
    `
  ).join("");

  renderSidebarFooter();
}

function renderSidebarFooter() {
  const master = state.currentMaster;
  if (!master) return;
  const onDuty = !!master.onDuty;
  els.sidebarFooter.innerHTML = `
    <div class="sidebar-master">
      <span class="avatar">${initials(master.name)}</span>
      <div class="sidebar-master-info">
        <span class="sidebar-master-name">${escapeHtml(master.name)}</span>
        <span class="sidebar-master-role">Barber</span>
      </div>
    </div>
    <div class="sidebar-duty-row">
      <span class="duty-dot ${onDuty ? "duty-dot-on" : "duty-dot-off"}"></span>
      <span class="sidebar-duty-label">${onDuty ? "Liniyada" : "Liniyada emas"}</span>
    </div>
    <button id="sidebar-duty-toggle" class="btn ${onDuty ? "btn-danger" : "btn-success"} sidebar-duty-btn" type="button">
      ${onDuty ? "Smenani tugatish" : "Liniyaga chiqish"}
    </button>
    <button id="sidebar-logout" class="switch-link sidebar-logout" type="button">Chiqish</button>
  `;

  document.getElementById("sidebar-duty-toggle").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await toggleDuty();
    } catch (err) {
      // offline banner already reflects connectivity state globally
    } finally {
      btn.disabled = false;
      renderSidebarFooter();
      window.dispatchEvent(new CustomEvent("navbat:duty-changed"));
    }
  });

  document.getElementById("sidebar-logout").addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("navbat:logout"));
  });
}

function renderBottomNav(activeId) {
  els.bottomNav.innerHTML = BOTTOM_NAV_IDS.map((id) => {
    const item = ALL_ITEMS.find((i) => i.id === id);
    return `
      <a class="bottom-nav-link ${id === activeId ? "is-active" : ""}" href="${navHref(id)}">
        <span class="bottom-nav-icon">${item.icon}</span>
        <span class="bottom-nav-label">${item.label.replace("Mening ", "")}</span>
      </a>
    `;
  }).join("");
}

async function renderPage(id) {
  const renderFn = pages.get(id);
  if (!renderFn) return;

  if (typeof currentCleanup === "function") {
    currentCleanup();
    currentCleanup = null;
  }

  els.pageContent.innerHTML = '<div class="page-loading"><div class="skeleton-card"></div></div>';
  currentCleanup = (await renderFn(els.pageContent)) || null;
}

export function navigateTo(id) {
  location.hash = navHref(id);
}

export async function startRouter() {
  const render = async () => {
    const id = currentRouteId();
    currentPageId = id;
    renderSidebar(id);
    renderBottomNav(id);
    await renderPage(id);
    window.scrollTo(0, 0);
  };

  window.addEventListener("hashchange", render);
  await render();
}

export function refreshChrome() {
  renderSidebarFooter();
}

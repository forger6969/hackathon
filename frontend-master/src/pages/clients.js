import { state, apiFetch } from "../state.js";
import { escapeHtml, initials, formatSum, formatDate } from "../format.js";

export function renderClients(root) {
  const master = state.currentMaster;
  let clients = [];
  let query = "";
  let openPhone = null;
  let historyByPhone = null; // lazy-loaded from /history on first drill-down

  async function load() {
    try {
      clients = await apiFetch(`/api/masters/${master._id}/clients`);
    } catch (err) {
      // offline banner handles connectivity feedback
    }
    paint();
  }

  async function loadHistoryFor(phone) {
    if (historyByPhone) return historyByPhone[phone] || [];
    try {
      const history = await apiFetch(`/api/queue/${master._id}/history?status=done`);
      historyByPhone = {};
      for (const item of history) {
        const key = item.phone || item.clientName;
        (historyByPhone[key] ||= []).push(item);
      }
    } catch (err) {
      historyByPhone = {};
    }
    return historyByPhone[phone] || [];
  }

  function paint() {
    const filtered = clients.filter(
      (c) => c.clientName.toLowerCase().includes(query.toLowerCase()) || (c.phone || "").includes(query)
    );
    const open = filtered.find((c) => c.phone === openPhone);

    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Mening mijozlarim</h1>
          <p class="page-subtitle">Sizga tegishli mijozlar ro'yxati</p>
        </div>
      </div>

      <input id="client-search" class="text-input" type="text" placeholder="Ism yoki telefon bo'yicha qidirish" value="${escapeHtml(query)}" />

      <div id="client-detail-slot"></div>

      <div class="client-list">
        ${filtered.length ? filtered.map(clientRowHtml).join("") : `<div class="empty-state"><span class="empty-icon">👥</span><span>Mijoz topilmadi</span></div>`}
      </div>
    `;

    const search = root.querySelector("#client-search");
    search.addEventListener("input", (e) => {
      query = e.target.value;
      openPhone = null;
      paint();
    });
    search.focus();
    search.setSelectionRange(query.length, query.length);

    if (open) renderDetail(open);

    root.querySelectorAll("[data-open-client]").forEach((el) =>
      el.addEventListener("click", () => {
        openPhone = openPhone === el.dataset.openClient ? null : el.dataset.openClient;
        paint();
      })
    );
  }

  async function renderDetail(c) {
    const slot = root.querySelector("#client-detail-slot");
    if (!slot) return;
    slot.innerHTML = clientDetailHtml(c, null);
    const history = await loadHistoryFor(c.phone);
    slot.innerHTML = clientDetailHtml(c, history);
  }

  function clientRowHtml(c) {
    const daysAgo = c.lastVisit ? Math.floor((Date.now() - new Date(c.lastVisit).getTime()) / 86400000) : null;
    return `
      <div class="client-row" data-open-client="${escapeHtml(c.phone || c.clientName)}">
        <span class="avatar">${initials(c.clientName)}</span>
        <div class="client-row-main">
          <span class="client-row-name">${escapeHtml(c.clientName)}</span>
          <span class="client-row-phone">${escapeHtml(c.phone || "—")}</span>
        </div>
        <div class="client-row-meta">
          <span class="client-row-visits">${c.visits} tashrif</span>
          <span class="client-row-last">${daysAgo === null ? "" : daysAgo === 0 ? "Bugun" : `${daysAgo} kun oldin`}</span>
        </div>
      </div>
    `;
  }

  function clientDetailHtml(c, history) {
    return `
      <div class="client-detail-card">
        <div class="client-detail-head">
          <span class="avatar">${initials(c.clientName)}</span>
          <div>
            <h2 class="active-card-name">${escapeHtml(c.clientName)}</h2>
            <span class="client-row-phone">${escapeHtml(c.phone || "—")} · Jami: ${formatSum(c.totalSpent)} so'm</span>
          </div>
        </div>
        <h3 class="section-title">Tashrif tarixi</h3>
        <div class="client-history">
          ${
            history === null
              ? '<div class="skeleton-row"></div>'
              : history.length
                ? history
                    .map(
                      (h) => `
                        <div class="client-history-row">
                          <span>${formatDate(h.doneAt)}</span>
                          <span>${escapeHtml(h.serviceId?.name || "—")}</span>
                          <span>${formatSum(h.serviceId?.price || 0)} so'm</span>
                        </div>
                      `
                    )
                    .join("")
                : '<div class="empty-state"><span class="empty-icon">🗂️</span><span>Tarix topilmadi</span></div>'
          }
        </div>
      </div>
    `;
  }

  load();
  return null;
}

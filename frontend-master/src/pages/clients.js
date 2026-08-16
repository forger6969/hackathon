import { state } from "../state.js";
import { escapeHtml, initials, formatSum } from "../format.js";
import { mockClients } from "../mock.js";

export function renderClients(root) {
  const master = state.currentMaster;
  const clients = mockClients(master._id);
  let query = "";
  let openId = null;

  function paint() {
    const filtered = clients.filter(
      (c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query)
    );
    const open = filtered.find((c) => c._id === openId);

    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Mening mijozlarim</h1>
          <p class="page-subtitle">Sizga tegishli mijozlar ro'yxati</p>
        </div>
      </div>

      <p class="mock-note">Namuna ma'lumot — backend mijoz agregatsiyasi hali yo'q (Saidazim'dan so'ralgan)</p>

      <input id="client-search" class="text-input" type="text" placeholder="Ism yoki telefon bo'yicha qidirish" value="${escapeHtml(query)}" />

      ${open ? clientDetailHtml(open) : ""}

      <div class="client-list">
        ${filtered.length ? filtered.map(clientRowHtml).join("") : `<div class="empty-state"><span class="empty-icon">👥</span><span>Mijoz topilmadi</span></div>`}
      </div>
    `;

    const search = root.querySelector("#client-search");
    search.addEventListener("input", (e) => {
      query = e.target.value;
      openId = null;
      paint();
    });
    search.focus();
    search.setSelectionRange(query.length, query.length);

    root.querySelectorAll("[data-open-client]").forEach((el) =>
      el.addEventListener("click", () => {
        openId = openId === el.dataset.openClient ? null : el.dataset.openClient;
        paint();
      })
    );
  }

  function clientRowHtml(c) {
    return `
      <div class="client-row" data-open-client="${c._id}">
        <span class="avatar">${initials(c.name)}</span>
        <div class="client-row-main">
          <span class="client-row-name">${escapeHtml(c.name)}</span>
          <span class="client-row-phone">${escapeHtml(c.phone)}</span>
        </div>
        <div class="client-row-meta">
          <span class="client-row-visits">${c.visits} tashrif</span>
          <span class="client-row-last">${c.lastVisitDaysAgo === 0 ? "Bugun" : `${c.lastVisitDaysAgo} kun oldin`}</span>
        </div>
      </div>
    `;
  }

  function clientDetailHtml(c) {
    return `
      <div class="client-detail-card">
        <div class="client-detail-head">
          <span class="avatar">${initials(c.name)}</span>
          <div>
            <h2 class="active-card-name">${escapeHtml(c.name)}</h2>
            <span class="client-row-phone">${escapeHtml(c.phone)}</span>
          </div>
        </div>
        <h3 class="section-title">Tashrif tarixi</h3>
        <div class="client-history">
          ${c.history
            .map(
              (h) => `
                <div class="client-history-row">
                  <span>${h.date.toLocaleDateString("uz-UZ", { day: "2-digit", month: "long" })}</span>
                  <span>${escapeHtml(h.serviceName)}</span>
                  <span>${formatSum(h.price)} so'm</span>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  paint();
  return null;
}

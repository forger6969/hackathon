import { io } from "socket.io-client";
import "./style.css";

const API_URL = import.meta.env.VITE_API_URL;

const els = {
  form: document.getElementById("add-client-form"),
  name: document.getElementById("f-name"),
  phone: document.getElementById("f-phone"),
  salon: document.getElementById("f-salon"),
  master: document.getElementById("f-master"),
  service: document.getElementById("f-service"),
  time: document.getElementById("f-time"),
  whenRadios: document.querySelectorAll('input[name="when"]'),
  list: document.getElementById("reception-list"),
  offline: document.getElementById("offline-banner"),
  mastersStatus: document.getElementById("masters-status-list"),
  statTotal: document.getElementById("stat-total"),
  statWaiting: document.getElementById("stat-waiting"),
  statScheduled: document.getElementById("stat-scheduled"),
  statOnDuty: document.getElementById("stat-onduty"),
  cashBalance: document.getElementById("cash-balance"),
  cashRevenue: document.getElementById("cash-revenue"),
  cashCash: document.getElementById("cash-cash"),
  cashCard: document.getElementById("cash-card"),
  cashRefunds: document.getElementById("cash-refunds"),
  cashDeposits: document.getElementById("cash-deposits"),
  cashWithdrawals: document.getElementById("cash-withdrawals"),
  depositBtn: document.getElementById("cash-deposit-btn"),
  withdrawBtn: document.getElementById("cash-withdraw-btn"),
  cmModal: document.getElementById("cash-movement-modal"),
  cmTitle: document.getElementById("cash-movement-title"),
  cmForm: document.getElementById("cash-movement-form"),
  cmAmount: document.getElementById("cm-amount"),
  cmMethod: document.getElementById("cm-method"),
  cmNote: document.getElementById("cm-note"),
  cmCancel: document.getElementById("cash-movement-cancel"),
  payModal: document.getElementById("payment-modal"),
  payTitle: document.getElementById("payment-modal-title"),
  payDue: document.getElementById("pay-due"),
  payAlready: document.getElementById("pay-already"),
  payRemaining: document.getElementById("pay-remaining"),
  payLines: document.getElementById("pay-lines"),
  payForm: document.getElementById("payment-form"),
  payMethod: document.getElementById("pay-method"),
  payAmount: document.getElementById("pay-amount"),
  payChange: document.getElementById("pay-change"),
  payChangeValue: document.getElementById("pay-change-value"),
  paySubmit: document.getElementById("pay-submit"),
  payCancel: document.getElementById("payment-cancel"),
  codeForm: document.getElementById("code-search-form"),
  codeInput: document.getElementById("code-search-input"),
  codeError: document.getElementById("code-search-error"),
};

let masters = [];
let salonsById = {};
let servicesById = {};
let items = [];
let cmType = "deposit";
let payItemId = null;

const STATUS_LABELS = {
  scheduled: "Belgilangan",
  waiting: "Navbatda",
  called: "Chaqirildi",
  in_progress: "Xizmatda",
};

function fmt(n) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n || 0));
}

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

function escapeHtml(str = "") {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ── Форма: салон -> мастера этого салона, только те, кто "на линии" ──
function renderMasterOptions(salonId) {
  const filtered = masters.filter((m) => m.salonId === salonId && m.onDuty);
  els.master.innerHTML = filtered.length
    ? filtered.map((m) => `<option value="${m._id}">${escapeHtml(m.name)}</option>`).join("")
    : `<option value="" disabled selected>Bu salonda hech kim on line emas</option>`;
}

function renderMastersStatus() {
  if (!masters.length) {
    els.mastersStatus.innerHTML = `<p class="empty-state">Ustalar topilmadi</p>`;
    return;
  }
  els.mastersStatus.innerHTML = masters
    .map((m) => {
      const salonName = salonsById[m.salonId] ? escapeHtml(salonsById[m.salonId]) : "";
      return `
        <div class="master-status-row ${m.onDuty ? "is-on" : "is-off"}">
          <span class="master-status-dot"></span>
          <span class="master-status-name">${escapeHtml(m.name)}</span>
          <span class="master-status-salon">${salonName}</span>
          <span class="master-status-label">${m.onDuty ? "on line" : "off line"}</span>
        </div>
      `;
    })
    .join("");

  els.statOnDuty.textContent = masters.filter((m) => m.onDuty).length;
}

async function loadCatalog() {
  const [salons, allMasters, services] = await Promise.all([
    apiFetch("/api/salons"),
    apiFetch("/api/masters"),
    apiFetch("/api/services"),
  ]);
  masters = allMasters;
  salonsById = Object.fromEntries(salons.map((s) => [s._id, s.name]));
  servicesById = Object.fromEntries(services.map((s) => [s._id, s]));

  els.salon.innerHTML = salons
    .map((s) => `<option value="${s._id}">${escapeHtml(s.name)}</option>`)
    .join("");
  els.service.innerHTML = services
    .map((s) => `<option value="${s._id}">${escapeHtml(s.name)} — ${s.price} so'm</option>`)
    .join("");

  if (salons[0]) renderMasterOptions(salons[0]._id);
  renderMastersStatus();
}

els.salon.addEventListener("change", (e) => renderMasterOptions(e.target.value));

els.whenRadios.forEach((r) =>
  r.addEventListener("change", () => {
    const isLater = document.querySelector('input[name="when"]:checked').value === "later";
    els.time.classList.toggle("hidden", !isLater);
    els.time.required = isLater;
  })
);

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const isLater = document.querySelector('input[name="when"]:checked').value === "later";

  const body = {
    clientName: els.name.value.trim(),
    phone: els.phone.value.trim(),
    serviceId: els.service.value,
    masterId: els.master.value,
    reception: true,
  };
  if (isLater && els.time.value) {
    body.scheduledFor = new Date(els.time.value).toISOString();
  }

  const submitBtn = els.form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    await apiFetch("/api/queue", { method: "POST", body: JSON.stringify(body) });
    els.form.reset();
    els.time.classList.add("hidden");
    setOffline(false);
    await loadQueue();
  } catch (err) {
    setOffline(true);
  } finally {
    submitBtn.disabled = false;
  }
});

// ── Общий список по всем мастерам ──────────────────
async function loadQueue() {
  try {
    items = await apiFetch("/api/queue");
    setOffline(false);
    render();
  } catch (err) {
    setOffline(true);
  }
}

// Duty toggles don't emit a socket event (they're not a queue change), so
// poll them on a light interval — good enough freshness for a reception
// screen, no need for a dedicated socket event just for this.
async function refreshMastersStatus() {
  try {
    masters = await apiFetch("/api/masters");
    renderMastersStatus();
  } catch (err) {
    setOffline(true);
  }
}
setInterval(refreshMastersStatus, 15000);

async function loadCashToday() {
  try {
    const cash = await apiFetch("/api/cash/today");
    els.cashBalance.textContent = `${fmt(cash.balance)} so'm`;
    els.cashRevenue.textContent = fmt(cash.revenue);
    els.cashCash.textContent = fmt(cash.cash);
    els.cashCard.textContent = fmt(cash.card);
    els.cashRefunds.textContent = fmt(cash.refunds);
    els.cashDeposits.textContent = fmt(cash.deposits);
    els.cashWithdrawals.textContent = fmt(cash.withdrawals);
  } catch (err) {
    setOffline(true);
  }
}
setInterval(loadCashToday, 15000);

async function checkin(id) {
  try {
    await apiFetch(`/api/queue/${id}/checkin`, { method: "POST" });
    await loadQueue();
  } catch (err) {
    setOffline(true);
  }
}

function formatScheduled(iso) {
  const d = new Date(iso);
  return d.toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function renderStats() {
  els.statTotal.textContent = items.length;
  els.statWaiting.textContent = items.filter((i) => i.status === "waiting" || i.status === "called" || i.status === "in_progress").length;
  els.statScheduled.textContent = items.filter((i) => i.status === "scheduled").length;
}

function render() {
  renderStats();

  if (!items.length) {
    els.list.innerHTML = "<p class=\"empty-state\">Navbat bo'sh</p>";
    return;
  }

  els.list.innerHTML = items
    .map((item) => {
      const initial = (item.clientName || "?").trim()[0]?.toUpperCase() || "?";
      const badge = STATUS_LABELS[item.status] || item.status;
      const scheduledTag =
        item.status === "scheduled" && item.scheduledFor
          ? `<span class="queue-eta">${formatScheduled(item.scheduledFor)}</span>`
          : "";
      const checkinBtn =
        item.status === "scheduled"
          ? `<button class="btn btn-primary" data-checkin="${item._id}">Keldi</button>`
          : "";
      const payBtn = !item.paid
        ? `<button class="btn btn-success" data-open-pay="${item._id}">💳 To'lov</button>`
        : "";
      const paidBadge = item.paid
        ? `<span class="status-badge status-paid">To'langan${item.paymentMethod ? ` · ${item.paymentMethod === "card" ? "💳" : item.paymentMethod === "split" ? "🔀" : "💵"}` : ""}</span>`
        : `<span class="status-badge status-unpaid">To'lanmagan</span>`;

      return `
        <div class="queue-card" data-id="${item._id}">
          <div class="queue-card-head">
            <h2 class="queue-client-name" data-initial="${escapeHtml(initial)}">${escapeHtml(item.clientName)}</h2>
            ${scheduledTag}
          </div>
          <div class="reception-badges">
            <span class="status-badge status-${item.status}">${badge}</span>
            ${paidBadge}
          </div>
          <div class="reception-master">${escapeHtml(item.masterName || "")}</div>
          ${checkinBtn || payBtn ? `<div class="queue-actions">${checkinBtn}${payBtn}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

els.list.addEventListener("click", (e) => {
  const checkinBtn = e.target.closest("button[data-checkin]");
  if (checkinBtn) {
    checkinBtn.disabled = true;
    checkin(checkinBtn.dataset.checkin);
    return;
  }
  const openPayBtn = e.target.closest("button[data-open-pay]");
  if (openPayBtn) {
    openPaymentModal(openPayBtn.dataset.openPay);
  }
});

// ── Payment modal: due/remaining, split payment lines, change calc ──

function openPaymentModal(itemId) {
  payItemId = itemId;
  const item = items.find((i) => i._id === itemId);
  if (!item) return;

  const service = servicesById[item.serviceId];
  els.payTitle.textContent = `To'lov — ${item.clientName}`;
  els.payAmount.value = "";
  els.payMethod.value = "cash";
  els.payChange.classList.add("hidden");
  renderPaymentSummary(item, service);

  els.payModal.classList.remove("hidden");
}

function renderPaymentSummary(item, service) {
  const due = service ? service.price : 0;
  const already = (item.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, due - already);

  els.payDue.textContent = `${fmt(due)} so'm`;
  els.payAlready.textContent = `${fmt(already)} so'm`;
  els.payRemaining.textContent = `${fmt(remaining)} so'm`;
  els.payAmount.value = remaining || "";

  els.payLines.innerHTML = (item.payments || [])
    .map((p) => `<div class="r-pay-line"><span>${p.method === "card" ? "💳 Karta" : "💵 Naqd"}</span><span>${fmt(p.amount)} so'm</span></div>`)
    .join("");
}

function updateChangePreview() {
  const item = items.find((i) => i._id === payItemId);
  if (!item) return;
  const service = servicesById[item.serviceId];
  const due = service ? service.price : 0;
  const already = (item.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, due - already);
  const entered = Number(els.payAmount.value) || 0;

  if (entered > remaining) {
    els.payChange.classList.remove("hidden");
    els.payChangeValue.textContent = `${fmt(entered - remaining)} so'm`;
  } else {
    els.payChange.classList.add("hidden");
  }
}
els.payAmount.addEventListener("input", updateChangePreview);

els.payForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const method = els.payMethod.value;
  const amount = Number(els.payAmount.value);
  if (!amount || amount <= 0) return;

  els.paySubmit.disabled = true;
  try {
    await apiFetch(`/api/queue/${payItemId}/pay`, {
      method: "POST",
      body: JSON.stringify({ method, amount }),
    });
    await loadQueue();
    await loadCashToday();
    const updated = items.find((i) => i._id === payItemId);
    if (updated && updated.paid) {
      els.payModal.classList.add("hidden");
    } else if (updated) {
      renderPaymentSummary(updated, servicesById[updated.serviceId]);
      els.payChange.classList.add("hidden");
    }
  } catch (err) {
    setOffline(true);
  } finally {
    els.paySubmit.disabled = false;
  }
});

els.payCancel.addEventListener("click", () => els.payModal.classList.add("hidden"));

// ── Booking-code search (client shows this instead of a scanned QR — see
// frontend-queue's bookingCode(): last 6 chars of the _id, uppercased) ──

function bookingCode(id) {
  return (id || "").toString().slice(-6).toUpperCase();
}

els.codeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const code = els.codeInput.value.trim().toUpperCase();
  if (!code) return;

  const match = items.find((i) => bookingCode(i._id) === code);
  els.codeError.classList.toggle("hidden", !!match);
  if (!match) return;

  els.codeInput.value = "";
  const card = els.list.querySelector(`[data-id="${match._id}"]`);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("is-highlighted");
    setTimeout(() => card.classList.remove("is-highlighted"), 2000);
  }
  if (!match.paid) {
    openPaymentModal(match._id);
  }
});

// ── Cash movement modal (manual deposit/withdrawal) ──

function openCashMovement(type) {
  cmType = type;
  els.cmTitle.textContent = type === "deposit" ? "Kassaga kirim" : "Kassadan chiqim";
  els.cmAmount.value = "";
  els.cmNote.value = "";
  els.cmModal.classList.remove("hidden");
}

els.depositBtn.addEventListener("click", () => openCashMovement("deposit"));
els.withdrawBtn.addEventListener("click", () => openCashMovement("withdrawal"));
els.cmCancel.addEventListener("click", () => els.cmModal.classList.add("hidden"));

els.cmForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const amount = Number(els.cmAmount.value);
  if (!amount || amount <= 0) return;

  try {
    await apiFetch("/api/cash/movement", {
      method: "POST",
      body: JSON.stringify({
        type: cmType,
        method: els.cmMethod.value,
        amount,
        note: els.cmNote.value.trim(),
        performedBy: "Reception",
      }),
    });
    els.cmModal.classList.add("hidden");
    await loadCashToday();
  } catch (err) {
    setOffline(true);
  }
});

function connectSocket() {
  const socket = io(API_URL, { reconnection: true });
  socket.on("connect", () => setOffline(false));
  socket.on("connect_error", () => setOffline(true));
  socket.on("disconnect", () => setOffline(true));
  // Reception cares about every master at once, so any update just
  // triggers a refetch of the flat cross-master list.
  socket.on("queue:update", () => {
    loadQueue();
    loadCashToday();
  });
}

async function init() {
  try {
    await loadCatalog();
    await loadQueue();
    await loadCashToday();
  } catch (err) {
    setOffline(true);
    els.list.innerHTML = "<p class=\"empty-state\">Backend bilan aloqa yo'q</p>";
  }
  connectSocket();
}

init();

import { state, apiFetch, onQueueUpdate, toggleDuty } from "../state.js";
import {
  escapeHtml,
  initials,
  formatSum,
  formatHours,
  formatElapsed,
  paymentBadgeHtml,
  statusBadgeHtml,
} from "../format.js";
import { refreshChrome } from "../router.js";

let elapsedTimer = null;

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Xayrli tun";
  if (h < 11) return "Xayrli tong";
  if (h < 17) return "Xayrli kun";
  return "Xayrli kech";
}

function todayLabel() {
  return new Date().toLocaleDateString("uz-UZ", { day: "2-digit", month: "long" });
}

export function renderDashboard(root) {
  const master = state.currentMaster;
  let queue = [];
  let todayStats = { clientsServed: 0, revenue: 0, hoursWorked: 0, earned: 0 };
  let servicesById = {};
  let confirmingId = null;

  async function load() {
    try {
      const [q, s, services] = await Promise.all([
        apiFetch(`/api/queue/${master._id}`),
        apiFetch(`/api/masters/${master._id}/today`),
        Object.keys(servicesById).length ? Promise.resolve(null) : apiFetch("/api/services"),
      ]);
      queue = q;
      todayStats = s;
      if (services) servicesById = Object.fromEntries(services.map((sv) => [sv._id, sv]));
    } catch (err) {
      // offline banner already reflects this globally
    }
    paint();
  }

  function paint() {
    const live = queue.filter((q) => q.status !== "scheduled");
    const scheduled = queue.filter((q) => q.status === "scheduled");
    const inProgress = live.filter((q) => q.status === "called" || q.status === "in_progress");
    const waiting = live.filter((q) => q.status === "waiting");
    const next = live[0] || null;

    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${greeting()}, ${escapeHtml(master.name)} 👋</h1>
          <p class="page-subtitle">Bugun: ${todayLabel()}</p>
        </div>
        ${dutyCardHtml(master)}
      </div>

      <div class="kpi-grid">
        ${kpiCard("👤", live.length + scheduled.length, "Mijozlar bugun")}
        ${kpiCard("✅", todayStats.clientsServed, "Yakunlangan")}
        ${kpiCard("🔵", inProgress.length, "Xizmatda")}
        ${kpiCard("⏳", waiting.length + scheduled.length, "Kutilmoqda")}
        ${kpiCard("💵", formatSum(todayStats.revenue) + " so'm", "Tushum")}
        ${kpiCard("💰", formatSum(todayStats.earned) + " so'm", "Hisoblangan")}
      </div>

      <section class="next-client-section">
        <h2 class="section-title">Keyingi mijoz</h2>
        ${next ? nextClientCardHtml(next) : emptyHtml("У вас пока нет следующих записей".length ? "Hozircha navbatda mijoz yo'q" : "")}
      </section>

      <section class="shift-time-section">
        <div class="shift-time-card">
          <span class="shift-time-label">Bugun ishlagan vaqt</span>
          <span class="shift-time-value">${formatHours(todayStats.hoursWorked)}</span>
        </div>
      </section>
    `;

    root.querySelectorAll("[data-duty-toggle]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await toggleDuty();
        } finally {
          btn.disabled = false;
          refreshChrome();
          paint();
        }
      })
    );

    const startBtn = root.querySelector("[data-start-service]");
    if (startBtn) {
      startBtn.addEventListener("click", async () => {
        startBtn.disabled = true;
        const id = startBtn.dataset.id;
        try {
          await apiFetch(`/api/queue/${id}/status`, {
            method: "POST",
            body: JSON.stringify({ status: "called" }),
          });
          await load();
        } catch (err) {
          startBtn.disabled = false;
        }
      });
    }

    const noShowBtn = root.querySelector("[data-no-show]");
    if (noShowBtn) {
      noShowBtn.addEventListener("click", async () => {
        noShowBtn.disabled = true;
        try {
          await apiFetch(`/api/queue/${noShowBtn.dataset.id}/status`, {
            method: "POST",
            body: JSON.stringify({ status: "skipped" }),
          });
          await load();
        } catch (err) {
          noShowBtn.disabled = false;
        }
      });
    }

    const finishBtn = root.querySelector("[data-finish-service]");
    if (finishBtn) {
      finishBtn.addEventListener("click", () => {
        confirmingId = finishBtn.dataset.id;
        paint();
      });
    }

    const confirmBtn = root.querySelector("[data-confirm-finish]");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        confirmBtn.disabled = true;
        try {
          await apiFetch(`/api/queue/${confirmBtn.dataset.id}/status`, {
            method: "POST",
            body: JSON.stringify({ status: "done" }),
          });
          confirmingId = null;
          await load();
        } catch (err) {
          confirmBtn.disabled = false;
        }
      });
    }

    const cancelConfirmBtn = root.querySelector("[data-cancel-confirm]");
    if (cancelConfirmBtn) {
      cancelConfirmBtn.addEventListener("click", () => {
        confirmingId = null;
        paint();
      });
    }
  }

  function dutyCardHtml(m) {
    const onDuty = !!m.onDuty;
    const since = onDuty && m.dutyStartedAt ? new Date(m.dutyStartedAt) : null;
    return `
      <div class="duty-card ${onDuty ? "duty-card-on" : "duty-card-off"}">
        <span class="duty-card-status">${onDuty ? "🟢 LINIYADA" : "⚫ LINIYADA EMAS"}</span>
        ${
          onDuty && since
            ? `<span class="duty-card-since">Liniyada: ${since.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })} dan</span>`
            : ""
        }
        <button class="btn ${onDuty ? "btn-danger" : "btn-success"} duty-card-btn" data-duty-toggle type="button">
          ${onDuty ? "Smenani tugatish" : "Liniyaga chiqish"}
        </button>
      </div>
    `;
  }

  function serviceLineHtml(item) {
    const s = servicesById[item.serviceId];
    if (!s) return "";
    return `<p class="service-line">${escapeHtml(s.name)} · ${formatSum(s.price)} so'm · ${s.durationMin || Math.round(master.avgServiceTimeMs / 60000)} daq</p>`;
  }

  function nextClientCardHtml(item) {
    const isActive = item.status === "called" || item.status === "in_progress";
    const startedAt = item.calledAt ? new Date(item.calledAt).getTime() : null;

    if (isActive) {
      if (confirmingId === item._id) {
        return `
          <div class="active-card confirm-card">
            <span class="active-card-label">✅ Xizmatni yakunlash</span>
            <h2 class="active-card-name">${escapeHtml(item.clientName)}</h2>
            ${serviceLineHtml(item)}
            <p class="confirm-line">Boshlangan: ${startedAt ? new Date(startedAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
            <p class="confirm-line">To'lov: ${item.paid ? "✅ To'langan" : "⚠️ To'lanmagan"}</p>
            <div class="queue-actions">
              <button class="btn btn-success" data-confirm-finish data-id="${item._id}" type="button">Tasdiqlash</button>
              <button class="btn btn-danger" data-cancel-confirm type="button">Bekor qilish</button>
            </div>
          </div>
        `;
      }
      return `
        <div class="active-card in-service-card">
          <span class="active-card-label">🔵 Hozir xizmatda</span>
          <div class="active-card-body">
            <span class="avatar">${initials(item.clientName)}</span>
            <div class="active-card-info">
              <h2 class="active-card-name">${escapeHtml(item.clientName)}</h2>
              ${serviceLineHtml(item)}
              <span class="elapsed-timer" data-elapsed data-started="${startedAt || ""}">
                ${startedAt ? formatElapsed(Date.now() - startedAt) : "00:00"}
              </span>
            </div>
          </div>
          <div class="queue-actions">
            <button class="btn btn-success" data-finish-service data-id="${item._id}" type="button">✔ Xizmatni yakunlash</button>
          </div>
        </div>
      `;
    }

    if (!item.paid) {
      return `
        <div class="active-card unpaid-card">
          <span class="active-card-label">⏳ Keyingi mijoz</span>
          <div class="active-card-body">
            <span class="avatar">${initials(item.clientName)}</span>
            <div class="active-card-info">
              <h2 class="active-card-name">${escapeHtml(item.clientName)}</h2>
              ${serviceLineHtml(item)}
              <div class="active-card-badges">
                ${statusBadgeHtml(item.status)}
                ${paymentBadgeHtml(item)}
              </div>
            </div>
          </div>
          <p class="payment-wait-note">💳 To'lov ресепшнда kutilmoqda</p>
        </div>
      `;
    }

    return `
      <div class="active-card">
        <span class="active-card-label">👤 Keyingi mijoz</span>
        <div class="active-card-body">
          <span class="avatar">${initials(item.clientName)}</span>
          <div class="active-card-info">
            <h2 class="active-card-name">${escapeHtml(item.clientName)}</h2>
            ${serviceLineHtml(item)}
            <div class="active-card-badges">
              ${statusBadgeHtml(item.status)}
              ${paymentBadgeHtml(item)}
            </div>
          </div>
        </div>
        <div class="queue-actions">
          <button class="btn btn-primary" data-start-service data-id="${item._id}" type="button">✓ Xizmatni boshlash</button>
          <button class="btn btn-danger" data-no-show data-id="${item._id}" type="button">✕ Kelmadi</button>
        </div>
      </div>
    `;
  }

  function kpiCard(icon, value, label) {
    return `
      <div class="kpi-card">
        <span class="kpi-icon">${icon}</span>
        <span class="kpi-value">${value}</span>
        <span class="kpi-label">${label}</span>
      </div>
    `;
  }

  function emptyHtml(text) {
    return `<div class="empty-state"><span class="empty-icon">🎉</span><span>${text || "Hozircha navbatda mijoz yo'q"}</span></div>`;
  }

  load();
  const unsubscribe = onQueueUpdate((newQueue) => {
    queue = newQueue;
    apiFetch(`/api/masters/${master._id}/today`)
      .then((s) => {
        todayStats = s;
        paint();
      })
      .catch(() => paint());
  });

  elapsedTimer = setInterval(() => {
    root.querySelectorAll("[data-elapsed]").forEach((el) => {
      const started = Number(el.dataset.started);
      if (started) el.textContent = formatElapsed(Date.now() - started);
    });
  }, 1000);

  return () => {
    unsubscribe();
    if (elapsedTimer) clearInterval(elapsedTimer);
  };
}

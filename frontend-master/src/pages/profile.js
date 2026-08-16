import { state, apiFetch } from "../state.js";
import { escapeHtml, initials } from "../format.js";

export function renderProfile(root) {
  const master = state.currentMaster;

  async function load() {
    let salonName = "—";
    try {
      const salons = await apiFetch("/api/salons");
      const salon = salons.find((s) => s._id === master.salonId);
      if (salon) salonName = salon.name;
    } catch (err) {
      // offline banner handles connectivity feedback
    }
    paint(salonName);
  }

  function paint(salonName) {
    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Profil</h1>
          <p class="page-subtitle">Shaxsiy ma'lumotlar</p>
        </div>
      </div>

      <div class="profile-card">
        <span class="avatar profile-avatar">${initials(master.name)}</span>
        <h2 class="active-card-name">${escapeHtml(master.name)}</h2>
        <span class="status-badge ${master.onDuty ? "status-paid" : "status-waiting"}">${master.onDuty ? "Ishda" : "Ishda emas"}</span>
      </div>

      <div class="profile-fields">
        ${profileField("Telefon", "+998 90 123 45 67")}
        ${profileField("Mutaxassislik", "Erkaklar sartaroshi")}
        ${profileField("Salon", salonName)}
        ${profileField("Ish boshlagan sana", "2025-yil, mart")}
        ${profileField("To'lov turi", { fixed: "Fiksirlangan", percent: "Foizli", hybrid: "Aralash" }[master.salaryType] || master.salaryType)}
        ${profileField("Hisob holati", master.active ? "Faol" : "Nofaol")}
      </div>

      <p class="mock-note">Telefon/mutaxassislik/sana — namuna qiymatlar, backend'da profil maydonlari hali yo'q</p>
    `;
  }

  function profileField(label, value) {
    return `
      <div class="profile-field-row">
        <span class="profile-field-label">${escapeHtml(label)}</span>
        <span class="profile-field-value">${escapeHtml(String(value))}</span>
      </div>
    `;
  }

  load();
  return null;
}

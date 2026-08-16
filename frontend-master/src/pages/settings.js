const PREFS_KEY = "navbat_master_prefs";

function loadPrefs() {
  try {
    return { notifications: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch (err) {
    return { notifications: true };
  }
}

function savePrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function renderSettings(root) {
  const prefs = loadPrefs();

  function paint() {
    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Sozlamalar</h1>
          <p class="page-subtitle">Shaxsiy afzalliklar</p>
        </div>
      </div>

      <div class="settings-list">
        <label class="settings-row">
          <span>Bildirishnomalar</span>
          <input id="pref-notifications" type="checkbox" ${prefs.notifications ? "checked" : ""} />
        </label>
        <div class="settings-row">
          <span>Til</span>
          <span class="settings-static">O'zbekcha</span>
        </div>
        <div class="settings-row">
          <span>Mavzu</span>
          <span class="settings-static">Yorug' (TailAdmin)</span>
        </div>
      </div>

      <h2 class="section-title">Parolni o'zgartirish</h2>
      <form id="password-form" class="login-form settings-password-form">
        <input class="login-password" type="password" placeholder="Joriy parol" autocomplete="current-password" />
        <input class="login-password" type="password" placeholder="Yangi parol" autocomplete="new-password" />
        <button class="btn btn-primary" type="submit">Yangilash</button>
        <p id="password-note" class="mock-note password-note hidden">Bu funksiya hali backend'ga ulanmagan</p>
      </form>
    `;

    root.querySelector("#pref-notifications").addEventListener("change", (e) => {
      prefs.notifications = e.target.checked;
      savePrefs(prefs);
    });

    root.querySelector("#password-form").addEventListener("submit", (e) => {
      e.preventDefault();
      root.querySelector("#password-note").classList.remove("hidden");
    });
  }

  paint();
  return null;
}

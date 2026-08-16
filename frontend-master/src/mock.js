// Placeholder data for pages the current backend can't answer yet (client
// visit history, week/month stats, monthly earnings ledger, service duration,
// notifications). Requested from backend in the group chat — swap these out
// for real fetches once those endpoints exist. Seeded off the master's own id
// so numbers stay stable across reloads instead of jumping every render.

function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return function next() {
    h = (h * 1103515245 + 12345) >>> 0;
    return (h % 1000) / 1000;
  };
}

const CLIENT_NAMES = [
  "Saidolim", "Dilshod", "Jasur", "Aziz", "Sardor", "Bekzod", "Farrux",
  "Otabek", "Shoxrux", "Anvar", "Rustam", "Sherzod",
];

const SERVICE_NAMES = ["Erkaklar soch turmagi", "Soqol olish", "Soch + soqol", "Bo'yash"];

export function mockClients(masterId) {
  const rnd = seededRandom(masterId + "clients");
  const count = 5 + Math.floor(rnd() * 4);
  return Array.from({ length: count }, (_, i) => {
    const visits = 1 + Math.floor(rnd() * 14);
    const daysAgo = Math.floor(rnd() * 20);
    return {
      _id: `mock-client-${masterId}-${i}`,
      name: CLIENT_NAMES[i % CLIENT_NAMES.length],
      phone: `+998 9${Math.floor(rnd() * 9)} ${100 + Math.floor(rnd() * 899)} ${10 + Math.floor(rnd() * 89)} ${10 + Math.floor(rnd() * 89)}`,
      visits,
      lastServiceName: SERVICE_NAMES[i % SERVICE_NAMES.length],
      lastVisitDaysAgo: daysAgo,
      history: Array.from({ length: Math.min(visits, 4) }, (_, j) => ({
        date: new Date(Date.now() - (daysAgo + j * 6) * 86400000),
        serviceName: SERVICE_NAMES[(i + j) % SERVICE_NAMES.length],
        price: 20000 + Math.floor(rnd() * 5) * 10000,
      })),
    };
  });
}

export function mockWeeklyStats(masterId) {
  const rnd = seededRandom(masterId + "week");
  const days = ["Du", "Se", "Chor", "Pay", "Ju", "Sha", "Yak"];
  return days.map((label) => ({
    label,
    clients: 4 + Math.floor(rnd() * 8),
    revenue: 300000 + Math.floor(rnd() * 5) * 100000,
  }));
}

export function mockMonthlyEarnings(master) {
  const rnd = seededRandom(master._id + "earnings");
  const months = ["Iyun", "Iyul", "Avgust"];
  return months.map((label, i) => {
    const revenue = 5000000 + Math.floor(rnd() * 6) * 500000;
    let earned = 0;
    if (master.salaryType === "fixed") earned = master.salaryFixed;
    else if (master.salaryType === "percent") earned = Math.round(revenue * (master.salaryPercent / 100));
    else earned = master.salaryFixed + Math.round(revenue * (master.salaryPercent / 100));
    return {
      label,
      revenue,
      earned,
      status: i === months.length - 1 ? "Kutilmoqda" : "To'landi",
    };
  });
}

export function mockServiceDurationMin(service, master) {
  // Backend has no per-service duration field yet — fall back to the
  // master's own avgServiceTimeMs, which is at least real measured data.
  if (master && master.avgServiceTimeMs) return Math.round(master.avgServiceTimeMs / 60000);
  const rnd = seededRandom(service._id + "dur");
  return 20 + Math.floor(rnd() * 5) * 5;
}

const BOOKING_STATUSES = ["done", "done", "done", "skipped", "cancelled", "scheduled"];

// Historical/other-day bookings — real GET /api/queue/:masterId only returns
// today's active+scheduled items, nothing for other dates or terminal
// statuses (requested a /history endpoint from backend). Until then, this
// fills those tabs with plausible, stable rows instead of an empty screen.
export function mockBookings(masterId, seedSuffix, count = 6) {
  const rnd = seededRandom(masterId + seedSuffix);
  return Array.from({ length: count }, (_, i) => {
    const hour = 9 + Math.floor(rnd() * 9);
    const min = Math.floor(rnd() * 4) * 15;
    return {
      _id: `mock-booking-${masterId}-${seedSuffix}-${i}`,
      clientName: CLIENT_NAMES[(i * 3) % CLIENT_NAMES.length],
      serviceName: SERVICE_NAMES[i % SERVICE_NAMES.length],
      price: 20000 + Math.floor(rnd() * 5) * 10000,
      time: `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
      status: BOOKING_STATUSES[i % BOOKING_STATUSES.length],
      paid: rnd() > 0.25,
    };
  });
}

export function mockNotifications(masterId) {
  const rnd = seededRandom(masterId + "notif");
  const templates = [
    { icon: "🔔", title: "Yangi mijoz yozildi", body: "Saidolim — 15:00, Erkaklar soch turmagi" },
    { icon: "💳", title: "To'lov tasdiqlandi", body: "50 000 so'm — reception orqali" },
    { icon: "⏰", title: "Mijoz tez orada keladi", body: "Yozuvgacha 15 daqiqa qoldi" },
  ];
  return templates.map((t, i) => ({
    ...t,
    minutesAgo: 5 + Math.floor(rnd() * 50) + i * 20,
  }));
}

// Only the notifications bell still needs placeholder data — everything else
// (clients, calendar, bookings history, stats, earnings, service duration)
// is wired to real endpoints Saidazim added (calledAt, /history,
// /masters/:id/clients, Service.durationMin, /masters/:id/earnings).
// No backend endpoint exists for notifications yet (not requested — spec
// explicitly said not to build a big notification center), so this stays
// seeded/deterministic rather than empty.

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

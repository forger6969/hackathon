// Демо-данные — используются как fallback когда backend недоступен (Atlas whitelist etc)
// Полностью соответствуют форме реальных API-ответов (см. tasks.md и routes/*.js).
// Флаг `IS_DEMO` вылезает в UI как «Демо» badge — чтобы владелец знал.

const SALONS = [
  { _id: 'd-s1', name: 'Salon Yunusabad',   address: 'Amir Temur 12',  location: { lat: 41.3775, lng: 69.2822 } },
  { _id: 'd-s2', name: 'Salon Chilanzar',   address: 'Bunyodkor 45',   location: { lat: 41.2870, lng: 69.2065 } },
  { _id: 'd-s3', name: 'Salon Mirzo-Ulugbek', address: 'Sayram 18',    location: { lat: 41.3273, lng: 69.3453 } },
];

const MASTERS = [
  { _id: 'd-m1', name: 'Aziz',       salonId: 'd-s1', photoUrl: '', avgServiceTimeMs: 1_200_000, active: true, onDuty: true,  salaryType: 'percent',  salaryFixed: 0,         salaryPercent: 35, dutyStartedAt: new Date(Date.now() - 3.2 * 3_600_000) },
  { _id: 'd-m2', name: 'Sardor',     salonId: 'd-s1', photoUrl: '', avgServiceTimeMs: 1_500_000, active: true, onDuty: true,  salaryType: 'hybrid',   salaryFixed: 2_500_000, salaryPercent: 20, dutyStartedAt: new Date(Date.now() - 2.5 * 3_600_000) },
  { _id: 'd-m3', name: 'Bobur',      salonId: 'd-s2', photoUrl: '', avgServiceTimeMs: 1_800_000, active: true, onDuty: true,  salaryType: 'fixed',    salaryFixed: 4_500_000, salaryPercent: 0,  dutyStartedAt: new Date(Date.now() - 4.1 * 3_600_000) },
  { _id: 'd-m4', name: 'Doniyor',    salonId: 'd-s2', photoUrl: '', avgServiceTimeMs: 1_100_000, active: true, onDuty: false, salaryType: 'percent',  salaryFixed: 0,         salaryPercent: 40 },
  { _id: 'd-m5', name: 'Rustam',     salonId: 'd-s3', photoUrl: '', avgServiceTimeMs: 1_400_000, active: true, onDuty: true,  salaryType: 'hybrid',   salaryFixed: 2_000_000, salaryPercent: 25, dutyStartedAt: new Date(Date.now() - 1.8 * 3_600_000) },
  { _id: 'd-m6', name: 'Ilyos',      salonId: 'd-s3', photoUrl: '', avgServiceTimeMs: 1_600_000, active: true, onDuty: false, salaryType: 'fixed',    salaryFixed: 3_800_000, salaryPercent: 0 },
];

const SERVICES = [
  { _id: 'd-sv1', name: 'Стрижка мужская',      price: 80_000,  stockUse: [{ stockId: 'd-st3', qty: 1 }] },
  { _id: 'd-sv2', name: 'Борода / коррекция',   price: 50_000,  stockUse: [{ stockId: 'd-st2', qty: 1 }] },
  { _id: 'd-sv3', name: 'Стрижка + борода',     price: 120_000, stockUse: [{ stockId: 'd-st3', qty: 1 }, { stockId: 'd-st2', qty: 1 }] },
  { _id: 'd-sv4', name: 'Окрашивание',          price: 250_000, stockUse: [{ stockId: 'd-st4', qty: 1 }] },
  { _id: 'd-sv5', name: 'Укладка',              price: 60_000,  stockUse: [{ stockId: 'd-st1', qty: 1 }] },
  { _id: 'd-sv6', name: 'Комплексный уход',     price: 180_000, stockUse: [{ stockId: 'd-st1', qty: 1 }, { stockId: 'd-st2', qty: 1 }] },
];

const STOCK = [
  { _id: 'd-st1', name: 'Шампунь премиум',    qty: 14, unit: 'флакон', lowThreshold: 5 },
  { _id: 'd-st2', name: 'Масло для бороды',   qty: 2,  unit: 'флакон', lowThreshold: 3 },
  { _id: 'd-st3', name: 'Лезвия одноразовые', qty: 42, unit: 'шт',     lowThreshold: 15 },
  { _id: 'd-st4', name: 'Краска для волос',   qty: 1,  unit: 'тюбик',  lowThreshold: 3 },
  { _id: 'd-st5', name: 'Полотенце одноразовое', qty: 78, unit: 'шт',  lowThreshold: 20 },
];

// ── Генерация реалистичной очереди «за сегодня» ─
const CLIENT_POOL = ['Бекзод', 'Отабек', 'Жасур', 'Санжар', 'Алишер', 'Рустам', 'Дониёр', 'Фаррух', 'Илёс', 'Анвар', 'Шохрух', 'Диёр', 'Хайрулло', 'Азиз', 'Умид', 'Абдулла', 'Тимур', 'Малик'];
const PHONE = () => '+998 9' + Math.floor(Math.random() * 10) + ' ' + String(Math.floor(Math.random() * 900) + 100) + ' ' + String(Math.floor(Math.random() * 90) + 10) + ' ' + String(Math.floor(Math.random() * 90) + 10);

function makeQueue() {
  const items = [];
  const now = Date.now();
  const startOfDay = new Date(); startOfDay.setHours(9, 0, 0, 0);
  const currentHour = new Date().getHours();

  // Done items — распределены по прошедшим часам
  const doneCount = 24;
  for (let i = 0; i < doneCount; i++) {
    const hoursAgo = Math.random() * Math.max(1, currentHour - 9);
    const doneAt = new Date(now - hoursAgo * 3_600_000);
    const master = MASTERS[Math.floor(Math.random() * MASTERS.length)];
    const svc = SERVICES[Math.floor(Math.random() * SERVICES.length)];
    const paid = Math.random() > 0.15;
    items.push({
      _id: 'd-q-done-' + i,
      clientName: CLIENT_POOL[Math.floor(Math.random() * CLIENT_POOL.length)],
      phone: PHONE(),
      status: 'done',
      serviceId: svc._id,
      masterId: master._id,
      masterName: master.name,
      paid,
      paymentMethod: paid ? (Math.random() > 0.5 ? 'card' : 'cash') : null,
      doneAt,
      calledAt: new Date(doneAt.getTime() - master.avgServiceTimeMs),
      createdAt: new Date(doneAt.getTime() - master.avgServiceTimeMs - 5 * 60_000),
    });
  }

  // Active — waiting / called / in_progress прямо сейчас
  const activeMasters = MASTERS.filter((m) => m.onDuty);
  activeMasters.forEach((master, mi) => {
    // in_progress (первый в очереди мастера)
    const svc0 = SERVICES[mi % SERVICES.length];
    items.push({
      _id: 'd-q-inprog-' + mi,
      clientName: CLIENT_POOL[Math.floor(Math.random() * CLIENT_POOL.length)],
      phone: PHONE(),
      status: mi === 0 ? 'in_progress' : 'called',
      serviceId: svc0._id,
      masterId: master._id,
      masterName: master.name,
      paid: false,
      paymentMethod: null,
      calledAt: new Date(now - 8 * 60_000),
      createdAt: new Date(now - 30 * 60_000),
    });
    // waiting — 1-3 клиента у каждого
    const waitCount = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < waitCount; j++) {
      const svc = SERVICES[Math.floor(Math.random() * SERVICES.length)];
      items.push({
        _id: `d-q-wait-${mi}-${j}`,
        clientName: CLIENT_POOL[Math.floor(Math.random() * CLIENT_POOL.length)],
        phone: PHONE(),
        status: 'waiting',
        serviceId: svc._id,
        masterId: master._id,
        masterName: master.name,
        paid: false,
        paymentMethod: null,
        createdAt: new Date(now - (10 - j * 2) * 60_000),
      });
    }
  });

  // Scheduled — записи на будущее (следующие 4 часа)
  for (let i = 0; i < 4; i++) {
    const master = MASTERS[Math.floor(Math.random() * MASTERS.length)];
    const svc = SERVICES[Math.floor(Math.random() * SERVICES.length)];
    const scheduledFor = new Date(now + (i + 1) * 45 * 60_000);
    items.push({
      _id: 'd-q-sched-' + i,
      clientName: CLIENT_POOL[Math.floor(Math.random() * CLIENT_POOL.length)],
      phone: PHONE(),
      status: 'scheduled',
      serviceId: svc._id,
      masterId: master._id,
      masterName: master.name,
      scheduledFor,
      paid: false,
      paymentMethod: null,
      createdAt: new Date(now - 3 * 3_600_000),
    });
  }

  return items;
}

const QUEUE = makeQueue();

// Считаем today из QUEUE (чтобы цифры сходились)
function makeToday() {
  const svcById = Object.fromEntries(SERVICES.map((s) => [s._id, s]));
  const done = QUEUE.filter((q) => q.status === 'done');
  const revenue = done.reduce((s, q) => s + (svcById[q.serviceId]?.price || 0), 0);
  const cash = done.filter((q) => q.paid && q.paymentMethod === 'cash').reduce((s, q) => s + (svcById[q.serviceId]?.price || 0), 0);
  const card = done.filter((q) => q.paid && q.paymentMethod === 'card').reduce((s, q) => s + (svcById[q.serviceId]?.price || 0), 0);
  const activeMasters = new Set(QUEUE.map((q) => q.masterId)).size;
  const onDuty = MASTERS.filter((m) => m.onDuty).length;
  const total = MASTERS.length;
  const lowStock = STOCK.filter((s) => s.qty < s.lowThreshold);
  return {
    clientsServed: done.length,
    revenue,
    cashRevenue: cash,
    cardRevenue: card,
    lowStock,
    activeMasters,
    totalMasters: total,
    onDutyMasters: onDuty,
  };
}

export const demoData = {
  salons: SALONS,
  masters: MASTERS,
  services: SERVICES,
  stock: STOCK,
  queue: QUEUE,
  today: makeToday(),
};

/** master today stat — считаем из QUEUE */
export function demoMasterToday(masterId) {
  const svcById = Object.fromEntries(SERVICES.map((s) => [s._id, s]));
  const master = MASTERS.find((m) => m._id === masterId);
  const done = QUEUE.filter((q) => q.masterId === masterId && q.status === 'done');
  const revenue = done.reduce((s, q) => s + (svcById[q.serviceId]?.price || 0), 0);
  const hoursWorked = master?.dutyStartedAt ? Math.round((Date.now() - master.dutyStartedAt.getTime()) / 3_600_000 * 10) / 10 : 0;
  let earned = 0;
  if (master) {
    if (master.salaryType === 'fixed') earned = master.salaryFixed / 30;
    else if (master.salaryType === 'percent') earned = revenue * (master.salaryPercent / 100);
    else earned = master.salaryFixed / 30 + revenue * (master.salaryPercent / 100);
  }
  return {
    clientsServed: done.length,
    revenue,
    hoursWorked,
    earned: Math.round(earned),
  };
}

/** Признак что данные — демо (для UI баннера) */
export const IS_DEMO = { value: false };

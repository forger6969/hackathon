require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const Salon = require('./models/Salon');
const Master = require('./models/Master');
const Service = require('./models/Service');
const Stock = require('./models/Stock');
const QueueItem = require('./models/QueueItem');

async function seed() {
  await connectDB();

  await Promise.all([
    Salon.deleteMany({}),
    Master.deleteMany({}),
    Service.deleteMany({}),
    Stock.deleteMany({}),
    QueueItem.deleteMany({}),
  ]);

  const salons = await Salon.insertMany([
    { name: 'Navbat — Chilonzor', address: 'Chilonzor tumani, 19-kvartal', location: { lat: 41.2775, lng: 69.2032 } },
    { name: 'Navbat — Yunusobod', address: 'Yunusobod tumani, 4-mavze', location: { lat: 41.3487, lng: 69.2887 } },
  ]);

  const stock = await Stock.insertMany([
    { name: 'Shampun', qty: 12, unit: 'flakon', lowThreshold: 3 },
    { name: 'Soqol moyi', qty: 8, unit: 'flakon', lowThreshold: 2 },
    { name: 'Lezvie', qty: 40, unit: 'dona', lowThreshold: 10 },
    { name: 'Bo\'yoq', qty: 6, unit: 'tuba', lowThreshold: 2 },
  ]);

  const services = await Service.insertMany([
    { name: 'Soch olish', price: 30000, durationMin: 30, stockUse: [{ stockId: stock[2]._id, qty: 1 }] },
    { name: 'Soqol olish', price: 20000, durationMin: 20, stockUse: [{ stockId: stock[1]._id, qty: 1 }] },
    { name: 'Soch + soqol', price: 45000, durationMin: 45, stockUse: [{ stockId: stock[2]._id, qty: 1 }, { stockId: stock[1]._id, qty: 1 }] },
    { name: 'Bo\'yash', price: 60000, durationMin: 60, stockUse: [{ stockId: stock[3]._id, qty: 1 }] },
  ]);

  const DEMO_PASSWORD = 'usta1234';
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const masters = await Master.insertMany([
    {
      name: 'Aziz', salonId: salons[0]._id, avgServiceTimeMs: 20 * 60 * 1000, onDuty: true,
      passwordHash, salaryType: 'percent', salaryPercent: 40,
    },
    {
      name: 'Sardor', salonId: salons[0]._id, avgServiceTimeMs: 25 * 60 * 1000, onDuty: false,
      passwordHash, salaryType: 'fixed', salaryFixed: 4_000_000,
    },
    {
      name: 'Jasur', salonId: salons[1]._id, avgServiceTimeMs: 22 * 60 * 1000, onDuty: true,
      passwordHash, salaryType: 'hybrid', salaryFixed: 2_000_000, salaryPercent: 20,
    },
  ]);

  console.log('Seeded:', {
    salons: salons.length,
    stock: stock.length,
    services: services.length,
    masters: masters.length,
    demoPassword: DEMO_PASSWORD,
  });
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

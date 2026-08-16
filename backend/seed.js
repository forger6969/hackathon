require('dotenv').config();
const connectDB = require('./config/db');
const Master = require('./models/Master');
const Service = require('./models/Service');
const Stock = require('./models/Stock');
const QueueItem = require('./models/QueueItem');

async function seed() {
  await connectDB();

  await Promise.all([
    Master.deleteMany({}),
    Service.deleteMany({}),
    Stock.deleteMany({}),
    QueueItem.deleteMany({}),
  ]);

  const stock = await Stock.insertMany([
    { name: 'Shampun', qty: 12, unit: 'flakon', lowThreshold: 3 },
    { name: 'Soqol moyi', qty: 8, unit: 'flakon', lowThreshold: 2 },
    { name: 'Lezvie', qty: 40, unit: 'dona', lowThreshold: 10 },
    { name: 'Bo\'yoq', qty: 6, unit: 'tuba', lowThreshold: 2 },
  ]);

  const services = await Service.insertMany([
    { name: 'Soch olish', price: 30000, stockUse: [{ stockId: stock[2]._id, qty: 1 }] },
    { name: 'Soqol olish', price: 20000, stockUse: [{ stockId: stock[1]._id, qty: 1 }] },
    { name: 'Soch + soqol', price: 45000, stockUse: [{ stockId: stock[2]._id, qty: 1 }, { stockId: stock[1]._id, qty: 1 }] },
    { name: 'Bo\'yash', price: 60000, stockUse: [{ stockId: stock[3]._id, qty: 1 }] },
  ]);

  const masters = await Master.insertMany([
    { name: 'Aziz', avgServiceTimeMs: 20 * 60 * 1000 },
    { name: 'Sardor', avgServiceTimeMs: 25 * 60 * 1000 },
  ]);

  console.log('Seeded:', { stock: stock.length, services: services.length, masters: masters.length });
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

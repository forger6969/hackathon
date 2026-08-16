const express = require('express');
const bcrypt = require('bcryptjs');
const Master = require('../models/Master');
const Service = require('../models/Service');
const Stock = require('../models/Stock');
const Salon = require('../models/Salon');
const QueueItem = require('../models/QueueItem');

const router = express.Router();

router.get('/salons', async (req, res) => {
  res.json(await Salon.find());
});

router.get('/masters', async (req, res) => {
  const filter = { active: true };
  if (req.query.salonId) filter.salonId = req.query.salonId;
  if (req.query.onDuty === 'true') filter.onDuty = true;
  res.json(await Master.find(filter));
});

router.post('/masters/:id/duty', async (req, res) => {
  const { onDuty } = req.body;
  const update = { onDuty: !!onDuty };
  update.dutyStartedAt = onDuty ? new Date() : null;
  const master = await Master.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!master) return res.status(404).json({ error: 'not found' });
  res.json(master);
});

// Login gate for the frontend-master "who am I" screen. Deliberately narrow:
// every other endpoint (queue, status, reception) stays open per CLAUDE.md,
// this only confirms which master is sitting at the device.
router.post('/masters/login', async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ error: 'name, password required' });
  }

  const master = await Master.findOne({ name, active: true }).select('+passwordHash');
  if (!master || !master.passwordHash) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const ok = await bcrypt.compare(password, master.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const safe = master.toObject();
  delete safe.passwordHash;
  res.json(safe);
});

// Master's own "today" stats — clients served, revenue they generated, hours
// on duty this shift, and what they're owed given their salary model.
router.get('/masters/:id/today', async (req, res) => {
  const master = await Master.findById(req.params.id);
  if (!master) return res.status(404).json({ error: 'not found' });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const doneToday = await QueueItem.find({
    masterId: master._id,
    status: 'done',
    doneAt: { $gte: startOfDay },
  }).populate('serviceId');

  const revenue = doneToday.reduce((sum, item) => sum + (item.serviceId ? item.serviceId.price : 0), 0);

  const hoursWorked = master.onDuty && master.dutyStartedAt
    ? (Date.now() - master.dutyStartedAt.getTime()) / 3_600_000
    : 0;

  let earned = 0;
  if (master.salaryType === 'fixed') earned = master.salaryFixed / 30;
  else if (master.salaryType === 'percent') earned = revenue * (master.salaryPercent / 100);
  else earned = master.salaryFixed / 30 + revenue * (master.salaryPercent / 100);

  res.json({
    clientsServed: doneToday.length,
    revenue,
    hoursWorked: Math.round(hoursWorked * 10) / 10,
    earned: Math.round(earned),
  });
});

function computeEarned(master, revenue) {
  if (master.salaryType === 'fixed') return master.salaryFixed / 30;
  if (master.salaryType === 'percent') return revenue * (master.salaryPercent / 100);
  return master.salaryFixed / 30 + revenue * (master.salaryPercent / 100);
}

// Same shape as /today but over an arbitrary window — ?period=today|week|month
// or explicit ?from=&to= (ISO dates). Period boundaries use local midnight,
// same convention as the rest of the app (no real shift/payroll-cycle model).
router.get('/masters/:id/earnings', async (req, res) => {
  const master = await Master.findById(req.params.id);
  if (!master) return res.status(404).json({ error: 'not found' });

  let from = req.query.from ? new Date(req.query.from) : null;
  let to = req.query.to ? new Date(req.query.to) : new Date();

  if (!from) {
    from = new Date();
    const period = req.query.period || 'today';
    if (period === 'week') from.setDate(from.getDate() - 7);
    else if (period === 'month') from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
  }

  const done = await QueueItem.find({
    masterId: master._id,
    status: 'done',
    doneAt: { $gte: from, $lte: to },
  }).populate('serviceId');

  const revenue = done.reduce((sum, item) => sum + (item.serviceId ? item.serviceId.price : 0), 0);
  const earned = computeEarned(master, revenue);

  res.json({
    from,
    to,
    clientsServed: done.length,
    revenue,
    earned: Math.round(earned),
    salaryType: master.salaryType,
  });
});

// Clients this master has actually served — grouped by phone (falls back to
// name if phone wasn't given), with visit count and last service. No
// separate Client model, this is derived straight from QueueItem history.
router.get('/masters/:id/clients', async (req, res) => {
  const master = await Master.findById(req.params.id);
  if (!master) return res.status(404).json({ error: 'not found' });

  const items = await QueueItem.find({
    masterId: master._id,
    status: 'done',
  }).sort({ doneAt: -1 }).populate('serviceId', 'name price');

  const byKey = new Map();
  for (const item of items) {
    const key = item.phone || item.clientName;
    if (!byKey.has(key)) {
      byKey.set(key, {
        clientName: item.clientName,
        phone: item.phone,
        visits: 0,
        lastVisit: item.doneAt,
        lastService: item.serviceId ? item.serviceId.name : null,
        totalSpent: 0,
      });
    }
    const entry = byKey.get(key);
    entry.visits += 1;
    entry.totalSpent += item.serviceId ? item.serviceId.price : 0;
  }

  res.json(Array.from(byKey.values()));
});

router.get('/services', async (req, res) => {
  res.json(await Service.find());
});

router.get('/stock', async (req, res) => {
  res.json(await Stock.find());
});

module.exports = router;

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

router.get('/services', async (req, res) => {
  res.json(await Service.find());
});

router.get('/stock', async (req, res) => {
  res.json(await Stock.find());
});

module.exports = router;

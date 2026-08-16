const express = require('express');
const Master = require('../models/Master');
const Service = require('../models/Service');
const Stock = require('../models/Stock');
const Salon = require('../models/Salon');

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
  const master = await Master.findByIdAndUpdate(
    req.params.id,
    { onDuty: !!onDuty },
    { new: true }
  );
  if (!master) return res.status(404).json({ error: 'not found' });
  res.json(master);
});

router.get('/services', async (req, res) => {
  res.json(await Service.find());
});

router.get('/stock', async (req, res) => {
  res.json(await Stock.find());
});

module.exports = router;

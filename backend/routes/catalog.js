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
  res.json(await Master.find(filter));
});

router.get('/services', async (req, res) => {
  res.json(await Service.find());
});

router.get('/stock', async (req, res) => {
  res.json(await Stock.find());
});

module.exports = router;

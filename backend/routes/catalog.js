const express = require('express');
const Master = require('../models/Master');
const Service = require('../models/Service');
const Stock = require('../models/Stock');

const router = express.Router();

router.get('/masters', async (req, res) => {
  res.json(await Master.find({ active: true }));
});

router.get('/services', async (req, res) => {
  res.json(await Service.find());
});

router.get('/stock', async (req, res) => {
  res.json(await Stock.find());
});

module.exports = router;

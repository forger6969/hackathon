const express = require('express');
const QueueItem = require('../models/QueueItem');
const Service = require('../models/Service');
const Stock = require('../models/Stock');

const router = express.Router();

router.get('/today', async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const doneToday = await QueueItem.find({
    status: 'done',
    doneAt: { $gte: startOfDay },
  }).populate('serviceId');

  const revenue = doneToday.reduce((sum, item) => sum + (item.serviceId ? item.serviceId.price : 0), 0);

  const lowStock = await Stock.find({ $expr: { $lt: ['$qty', '$lowThreshold'] } });

  res.json({
    clientsServed: doneToday.length,
    revenue,
    lowStock,
  });
});

module.exports = router;

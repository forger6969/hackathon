const express = require('express');
const QueueItem = require('../models/QueueItem');
const Service = require('../models/Service');
const Stock = require('../models/Stock');
const Master = require('../models/Master');

const router = express.Router();

router.get('/today', async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const doneToday = await QueueItem.find({
    status: 'done',
    doneAt: { $gte: startOfDay },
  }).populate('serviceId');

  const revenue = doneToday.reduce((sum, item) => sum + (item.serviceId ? item.serviceId.price : 0), 0);
  const cashRevenue = doneToday
    .filter((item) => item.paymentMethod === 'cash')
    .reduce((sum, item) => sum + (item.serviceId ? item.serviceId.price : 0), 0);
  const cardRevenue = doneToday
    .filter((item) => item.paymentMethod === 'card')
    .reduce((sum, item) => sum + (item.serviceId ? item.serviceId.price : 0), 0);

  const lowStock = await Stock.find({ $expr: { $lt: ['$qty', '$lowThreshold'] } });

  const activeMasterIds = await QueueItem.distinct('masterId', {
    createdAt: { $gte: startOfDay },
    status: { $in: ['waiting', 'called', 'in_progress', 'done'] },
  });

  const totalMasters = await Master.countDocuments({ active: true });
  const onDutyMasters = await Master.countDocuments({ active: true, onDuty: true });

  res.json({
    clientsServed: doneToday.length,
    revenue,
    cashRevenue,
    cardRevenue,
    lowStock,
    activeMasters: activeMasterIds.length,
    totalMasters,
    onDutyMasters,
  });
});

module.exports = router;

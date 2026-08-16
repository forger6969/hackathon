const express = require('express');
const QueueItem = require('../models/QueueItem');
const Master = require('../models/Master');
const Service = require('../models/Service');
const Stock = require('../models/Stock');

module.exports = function createQueueRouter(io) {
  const router = express.Router();

  async function broadcastQueue(masterId) {
    const items = await QueueItem.find({
      masterId,
      status: { $in: ['waiting', 'called', 'in_progress'] },
    }).sort({ createdAt: 1 });

    const master = await Master.findById(masterId);
    const withEta = items.map((item, idx) => ({
      _id: item._id,
      clientName: item.clientName,
      status: item.status,
      eta: idx * (master ? master.avgServiceTimeMs : 20 * 60 * 1000),
    }));

    io.emit('queue:update', { masterId: String(masterId), queue: withEta });
    return withEta;
  }

  router.post('/', async (req, res) => {
    const { clientName, phone, serviceId, masterId } = req.body;
    if (!clientName || !serviceId || !masterId) {
      return res.status(400).json({ error: 'clientName, serviceId, masterId required' });
    }
    const item = await QueueItem.create({ clientName, phone, serviceId, masterId });
    await broadcastQueue(masterId);
    res.status(201).json(item);
  });

  router.get('/:masterId', async (req, res) => {
    const withEta = await broadcastQueue(req.params.masterId);
    res.json(withEta);
  });

  router.post('/:id/status', async (req, res) => {
    const { status } = req.body;
    const valid = ['waiting', 'called', 'in_progress', 'done', 'skipped', 'cancelled'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }

    const item = await QueueItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'not found' });

    item.status = status;
    if (status === 'called') item.calledAt = new Date();
    if (status === 'skipped') item.skipCount += 1;

    if (status === 'done') {
      item.doneAt = new Date();
      const service = await Service.findById(item.serviceId);
      if (service) {
        for (const use of service.stockUse) {
          await Stock.findByIdAndUpdate(use.stockId, { $inc: { qty: -use.qty } });
        }
        if (item.calledAt) {
          const actualMs = item.doneAt - item.calledAt;
          const master = await Master.findById(item.masterId);
          if (master) {
            master.avgServiceTimeMs = Math.round(master.avgServiceTimeMs * 0.7 + actualMs * 0.3);
            await master.save();
          }
        }
      }
    }

    await item.save();
    await broadcastQueue(item.masterId);
    res.json(item);
  });

  return router;
};

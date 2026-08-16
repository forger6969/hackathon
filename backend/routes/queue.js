const express = require('express');
const QueueItem = require('../models/QueueItem');
const Master = require('../models/Master');
const Service = require('../models/Service');
const Stock = require('../models/Stock');

module.exports = function createQueueRouter(io) {
  const router = express.Router();

  async function promoteDueScheduled(filter) {
    const now = new Date();
    await QueueItem.updateMany(
      { ...filter, status: 'scheduled', scheduledFor: { $lte: now } },
      { $set: { status: 'waiting', createdAt: now } }
    );
  }

  async function broadcastQueue(masterId) {
    await promoteDueScheduled({ masterId });

    const items = await QueueItem.find({
      masterId,
      status: { $in: ['waiting', 'called', 'in_progress', 'scheduled'] },
    }).sort({ createdAt: 1 });

    const master = await Master.findById(masterId);
    const avgMs = master ? master.avgServiceTimeMs : 20 * 60 * 1000;

    let liveIdx = 0;
    const withEta = items.map((item) => {
      if (item.status === 'scheduled') {
        return {
          _id: item._id,
          clientName: item.clientName,
          status: item.status,
          scheduledFor: item.scheduledFor,
          paid: item.paid,
          paymentMethod: item.paymentMethod,
          eta: null,
        };
      }
      const eta = liveIdx * avgMs;
      liveIdx += 1;
      return { _id: item._id, clientName: item.clientName, status: item.status, paid: item.paid, paymentMethod: item.paymentMethod, eta };
    });

    io.emit('queue:update', { masterId: String(masterId), queue: withEta });
    return withEta;
  }

  // Reception view: every active/upcoming item across all masters at once.
  router.get('/', async (req, res) => {
    await promoteDueScheduled({});

    const items = await QueueItem.find({
      status: { $in: ['waiting', 'called', 'in_progress', 'scheduled'] },
    })
      .sort({ createdAt: 1 })
      .populate('masterId', 'name');

    res.json(
      items.map((item) => ({
        _id: item._id,
        clientName: item.clientName,
        phone: item.phone,
        status: item.status,
        scheduledFor: item.scheduledFor,
        paid: item.paid,
        paymentMethod: item.paymentMethod,
        masterId: item.masterId ? item.masterId._id : null,
        masterName: item.masterId ? item.masterId.name : null,
      }))
    );
  });

  router.post('/', async (req, res) => {
    const { clientName, phone, serviceId, masterId, scheduledFor, reception } = req.body;
    if (!clientName || !serviceId || !masterId) {
      return res.status(400).json({ error: 'clientName, serviceId, masterId required' });
    }

    const data = { clientName, phone, serviceId, masterId, createdByReception: !!reception };
    if (scheduledFor) {
      const target = new Date(scheduledFor);
      if (target > new Date()) {
        data.status = 'scheduled';
        data.scheduledFor = target;
      }
    }

    const item = await QueueItem.create(data);
    await broadcastQueue(masterId);
    res.status(201).json(item);
  });

  router.get('/:masterId', async (req, res) => {
    const withEta = await broadcastQueue(req.params.masterId);
    res.json(withEta);
  });

  // Client or reception confirms the scheduled client has actually arrived —
  // joins the back of the live queue at that moment, regardless of scheduledFor.
  router.post('/:id/checkin', async (req, res) => {
    const item = await QueueItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'not found' });
    if (item.status !== 'scheduled') {
      return res.status(400).json({ error: 'not a scheduled item' });
    }

    item.status = 'waiting';
    item.createdAt = new Date();
    await item.save();
    await broadcastQueue(item.masterId);
    res.json(item);
  });

  // Reception marks the client as paid — advisory flag only (no real auth
  // exists yet to hard-enforce it), the master screen shows it as a badge.
  // No split/multi-method payments — one method per booking, good enough
  // for the demo without a payment-transaction ledger.
  router.post('/:id/pay', async (req, res) => {
    const { method } = req.body;
    const paymentMethod = ['cash', 'card'].includes(method) ? method : 'cash';
    const item = await QueueItem.findByIdAndUpdate(
      req.params.id,
      { paid: true, paymentMethod },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'not found' });
    await broadcastQueue(item.masterId);
    res.json(item);
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

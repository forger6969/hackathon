const express = require('express');
const CashMovement = require('../models/CashMovement');

const router = express.Router();

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Register balance = payments - refunds + manual deposits - manual
// withdrawals, boundary is "today" (same convention as the rest of the app,
// no separate shift-open/close reconciliation — that's a bigger feature we
// deliberately didn't build under the time we have).
router.get('/today', async (req, res) => {
  const movements = await CashMovement.find({ createdAt: { $gte: startOfToday() } });

  const sum = (type, method) =>
    movements
      .filter((m) => m.type === type && (!method || m.method === method))
      .reduce((s, m) => s + m.amount, 0);

  const revenue = sum('payment');
  const refunds = sum('refund');
  const deposits = sum('deposit');
  const withdrawals = sum('withdrawal');
  const balance = revenue - refunds + deposits - withdrawals;

  const byMethod = (method) =>
    sum('payment', method) - sum('refund', method) + sum('deposit', method) - sum('withdrawal', method);

  res.json({
    balance,
    revenue,
    refunds,
    deposits,
    withdrawals,
    cash: byMethod('cash'),
    card: byMethod('card'),
  });
});

router.get('/movements', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const movements = await CashMovement.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('queueItemId', 'clientName');
  res.json(movements);
});

// Manual owner/reception cash-drawer adjustment — putting money in or
// taking it out, not tied to a client payment.
router.post('/movement', async (req, res) => {
  const { type, method, amount, note, performedBy } = req.body;
  if (!['deposit', 'withdrawal'].includes(type)) {
    return res.status(400).json({ error: 'type must be deposit or withdrawal' });
  }
  if (!['cash', 'card'].includes(method) || !(amount > 0)) {
    return res.status(400).json({ error: 'method and positive amount required' });
  }

  const movement = await CashMovement.create({
    type,
    method,
    amount,
    note: note || '',
    performedBy: performedBy || '',
  });
  res.status(201).json(movement);
});

module.exports = router;

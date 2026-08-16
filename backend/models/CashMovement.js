const mongoose = require('mongoose');

// Every cash-drawer-affecting event: a queue payment (positive), a refund
// (negative), or a manual owner deposit/withdrawal. This is also the audit
// trail for money — who moved how much, when, and why.
const cashMovementSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['payment', 'refund', 'deposit', 'withdrawal'],
    required: true,
  },
  method: { type: String, enum: ['cash', 'card'], required: true },
  amount: { type: Number, required: true }, // always positive; sign is implied by `type`
  note: { type: String, default: '' },
  performedBy: { type: String, default: '' }, // free-text name, no real auth to link a user id
  queueItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'QueueItem', default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CashMovement', cashMovementSchema);

const mongoose = require('mongoose');

const queueItemSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  phone: { type: String, default: '' },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  masterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Master', required: true },
  status: {
    type: String,
    enum: ['scheduled', 'waiting', 'called', 'in_progress', 'done', 'skipped', 'cancelled'],
    default: 'waiting',
  },
  scheduledFor: { type: Date, default: null },
  createdByReception: { type: Boolean, default: false },
  paid: { type: Boolean, default: false },
  // 'split' when more than one distinct method was used — kept for simple
  // display; `payments` below is the authoritative record for the ledger.
  paymentMethod: { type: String, enum: ['cash', 'card', 'split', null], default: null },
  payments: [
    {
      method: { type: String, enum: ['cash', 'card'], required: true },
      amount: { type: Number, required: true },
      at: { type: Date, default: Date.now },
    },
  ],
  changeGiven: { type: Number, default: 0 },
  skipCount: { type: Number, default: 0 },
  calledAt: { type: Date, default: null },
  doneAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

queueItemSchema.index({ masterId: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('QueueItem', queueItemSchema);

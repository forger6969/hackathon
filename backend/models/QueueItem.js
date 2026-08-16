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
  paymentMethod: { type: String, enum: ['cash', 'card', null], default: null },
  skipCount: { type: Number, default: 0 },
  calledAt: { type: Date, default: null },
  doneAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

queueItemSchema.index({ masterId: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('QueueItem', queueItemSchema);

const mongoose = require('mongoose');

const masterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  photoUrl: { type: String, default: '' },
  salonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salon', required: true },
  avgServiceTimeMs: { type: Number, default: 20 * 60 * 1000 },
  active: { type: Boolean, default: true },
  onDuty: { type: Boolean, default: false },
});

module.exports = mongoose.model('Master', masterSchema);

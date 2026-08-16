const mongoose = require('mongoose');

const masterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  photoUrl: { type: String, default: '' },
  salonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salon', required: true },
  avgServiceTimeMs: { type: Number, default: 20 * 60 * 1000 },
  active: { type: Boolean, default: true },
  onDuty: { type: Boolean, default: false },
  dutyStartedAt: { type: Date, default: null },
  // Hackathon-scope auth: gates only "who is this master" on the frontend-master
  // login screen. Every other endpoint stays open — this is not a general auth layer.
  passwordHash: { type: String, default: null, select: false },
  salaryType: { type: String, enum: ['fixed', 'percent', 'hybrid'], default: 'percent' },
  salaryFixed: { type: Number, default: 0 },
  salaryPercent: { type: Number, default: 40 },
});

module.exports = mongoose.model('Master', masterSchema);

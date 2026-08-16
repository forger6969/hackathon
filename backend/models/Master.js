const mongoose = require('mongoose');

const masterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  photoUrl: { type: String, default: '' },
  avgServiceTimeMs: { type: Number, default: 20 * 60 * 1000 },
  active: { type: Boolean, default: true },
});

module.exports = mongoose.model('Master', masterSchema);

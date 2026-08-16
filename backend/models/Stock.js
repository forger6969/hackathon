const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  name: { type: String, required: true },
  qty: { type: Number, required: true, default: 0 },
  unit: { type: String, default: 'pcs' },
  lowThreshold: { type: Number, default: 5 },
});

module.exports = mongoose.model('Stock', stockSchema);

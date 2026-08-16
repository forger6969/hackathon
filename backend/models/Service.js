const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  stockUse: [
    {
      stockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stock' },
      qty: { type: Number, default: 1 },
    },
  ],
});

module.exports = mongoose.model('Service', serviceSchema);

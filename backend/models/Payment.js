const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  method: {
    type: String,
    enum: ['naqd', 'karta', 'bank transfer', 'barter', 'cash', 'card', 'transfer'],
    required: true,
  },
  notes: {
    type: String,
  },
  receivedBy: {
    type: String, // Insan tomonidan o'qiladigan ism (eski qoldiq — mos kelish uchun saqlanadi)
  },
  /**
   * receivedById — kassirning ObjectId si.
   * Smena yopilishida String o'rniga ObjectId bilan query qilinadi —
   * ism o'zgarganda ham to'lovlar to'g'ri hisoblanadi.
   */
  receivedById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: false,
  }
}, { timestamps: true });

// Performance & Scaling Indexes
paymentSchema.index({ customer: 1, createdAt: -1 });
paymentSchema.index({ order: 1 });
paymentSchema.index({ createdAt: -1 });
// ✅ Smena yopilishida tezkor query uchun
paymentSchema.index({ receivedById: 1, createdAt: -1, method: 1 });

module.exports = mongoose.model('Payment', paymentSchema);

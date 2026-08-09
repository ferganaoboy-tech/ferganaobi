const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  unit: {
    type: String,
    enum: ['rulon', 'metr', 'quti', 'dona', 'kv.m'],
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  quantityInRolls: {
    type: Number,
    required: true,
  },
  unitPrice: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  refundAmount: {
    type: Number,
    required: true,
  },
  unitCost: {
    type: Number,
    default: 0
  },
  unitCostUsd: {
    type: Number,
    default: 0
  },
});

const returnSchema = new mongoose.Schema({
  returnNumber: {
    type: String,
    unique: true,
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true,
  },
  items: [returnItemSchema],
  totalRefundAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  totalRefundCost: {
    type: Number,
    default: 0,
    min: 0,
  },
  reason: {
    type: String,
  },
  status: {
    type: String,
    enum: ['completed', 'cancelled'],
    default: 'completed',
  },
  processedBy: {
    type: String, // Kassir ismi
  },
  processedById: {
    type: mongoose.Schema.Types.ObjectId, // Kassir ObjectId
    ref: 'User',
  }
}, { timestamps: true });

// Pre-save hook for auto-generating return number
// ✅ FIX: session-aware — tranzaksiya ichida Counter ham atomic ishlaydi.
// Agar tranzaksiya rollback bo'lsa, counter ham rollback bo'ladi (WiredTiger).
returnSchema.pre('save', async function() {
  if (this.isNew && !this.returnNumber) {
    const currentYear = new Date().getFullYear();
    const Counter = require('./Counter');

    // Session'ni mongoose tomonidan otilgan $session() orqali olamiz
    const session = this.$session() || null;

    const MAX_ATTEMPTS = 10;
    let assigned = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Atomic counter oshirish (session bilan — tranzaksiya ichida)
      const counter = await Counter.findByIdAndUpdate(
        { _id: `return_${currentYear}` },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, ...(session ? { session } : {}) }
      );

      const candidate = `RET-${currentYear}-${counter.seq.toString().padStart(3, '0')}`;

      // Unique index DB tomonidan himoyalaydi; findOne faqat ziddiyatni aniqlash uchun
      const existing = await mongoose.models.Return.exists(
        { returnNumber: candidate },
        session ? { session } : {}
      );

      if (!existing) {
        this.returnNumber = candidate;
        assigned = true;
        break;
      }
      // Ziddiyat bo'lsa — keyingi raqamga o'tadi
    }

    if (!assigned) {
      throw new Error('returnNumber generatsiyasida xatolik: maksimal urinishlar tugadi');
    }
  }
});

// Performance Indexes
returnSchema.index({ createdAt: -1 });
returnSchema.index({ order: 1 });
returnSchema.index({ warehouse: 1 });
returnSchema.index({ processedById: 1, createdAt: -1 }); // Yopiq smenalar hisobi uchun

module.exports = mongoose.model('Return', returnSchema);

const mongoose = require('mongoose');
require('./Counter'); // Ensure Counter model is registered

const orderItemSchema = new mongoose.Schema({
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
    validate: {
      validator: function(v) {
        if (this.unit === 'rulon' || this.unit === 'quti' || this.unit === 'dona') {
          return Number.isInteger(v);
        }
        return true;
      },
      message: props => `${props.value} butun son bo'lishi kerak ('rulon', 'quti', 'dona' uchun)`
    }
  },
  quantityInRolls: {
    type: Number,
  },
  returnedQuantity: {
    type: Number,
    default: 0,
  },
  unitPrice: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  subtotal: {
    type: Number,
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

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true,
  },
  items: [orderItemSchema],
  type: {
    type: String,
    enum: ['retail', 'wholesale'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'delivered', 'cancelled'],
    default: 'confirmed',
  },
  paymentType: {
    type: String,
    enum: ['naqd', 'nasiya', 'qisman'],
    required: true,
  },
  totalAmount: {
    type: Number,
    min: 0,
  },
  totalCost: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalProfit: {
    type: Number,
    default: 0,
  },
  overrideTotalAmount: {
    type: Number,
    min: 0,
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  cashbackEarned: {
    type: Number,
    default: 0,
    min: 0,
  },
  cashbackUsed: {
    type: Number,
    default: 0,
    min: 0,
  },
  debtAmount: {
    type: Number,
    min: 0,
  },
  deliveryAddress: {
    type: String,
  },
  deliveryDate: {
    type: Date,
  },
  notes: {
    type: String,
  },
  confirmedAt: {
    type: Date,
  },
  deliveredAt: {
    type: Date,
  },
}, { timestamps: true });

// ✅ FIX: orderNumber generatsiya — race condition-ga chidamli + session-aware
// Yondashuv: Counter atomic $inc → orderNumber belgilash → unique index xatosi bo'lsa retry
// Session bilan ishlaydi — tranzaksiya rollback bo'lsa counter ham rollback bo'ladi
orderSchema.pre('save', async function() {
  if (this.isNew && !this.orderNumber) {
    const currentYear = new Date().getFullYear();
    const Counter = require('./Counter');

    // Session'ni mongoose tomonidan otilgan $session() orqali olamiz
    const session = this.$session() || null;

    const MAX_ATTEMPTS = 10;
    let assigned = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Atomic counter oshirish (session bilan — tranzaksiya ichida)
      const counter = await Counter.findByIdAndUpdate(
        { _id: `order_${currentYear}` },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, ...(session ? { session } : {}) }
      );

      const candidate = `ORD-${currentYear}-${counter.seq.toString().padStart(3, '0')}`;

      // Unique index bor — DB o'zi tekshiradi
      const exists = await mongoose.models.Order.exists(
        { orderNumber: candidate },
        session ? { session } : {}
      );
      if (!exists) {
        this.orderNumber = candidate;
        assigned = true;
        break;
      }
      // Agar mavjud bo'lsa, loop davom etadi — counter yana oshiriladi
    }

    if (!assigned) {
      throw new Error('orderNumber generatsiyasida xatolik: maksimal urinishlar tugadi');
    }
  }

  // Calculate subtotals, totalAmount, and debtAmount
  let calculatedTotal = 0;
  let calculatedCost = 0;
  this.items.forEach(item => {
    // Calculate subtotal
    const activeQuantity = Math.max(0, item.quantity - (item.returnedQuantity || 0));
    const itemSubtotal = (item.unitPrice * activeQuantity) * (1 - (item.discount || 0) / 100);
    item.subtotal = itemSubtotal;
    calculatedTotal += itemSubtotal;

    // Calculate cost
    const itemCost = (item.unitCost || 0) * activeQuantity;
    calculatedCost += itemCost;
  });

  this.totalAmount = this.overrideTotalAmount !== undefined && this.overrideTotalAmount !== null
    ? this.overrideTotalAmount
    : calculatedTotal;

  this.totalCost = calculatedCost;
  this.totalProfit = this.totalAmount - this.totalCost;

  // Safety check for debtAmount
  const totalPaidAndCashback = this.paidAmount + this.cashbackUsed;
  if (totalPaidAndCashback > this.totalAmount) {
    if (this.cashbackUsed <= this.totalAmount) {
      this.paidAmount = this.totalAmount - this.cashbackUsed;
    } else {
      this.cashbackUsed = this.totalAmount;
      this.paidAmount = 0;
    }
  }
  this.debtAmount = Math.max(0, this.totalAmount - this.paidAmount - this.cashbackUsed);
});

// Performance & Scaling Indexes
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ warehouse: 1, createdAt: -1 }); // Compound index for Dashboard and Order lists
orderSchema.index({ warehouse: 1, status: 1, createdAt: -1 }); // Compound index for filtered queries
orderSchema.index({ warehouse: 1 });
orderSchema.index({ paymentType: 1 });
orderSchema.index({ createdAt: -1 });
// FIFO Debt Query Index
orderSchema.index({ customer: 1, status: 1, debtAmount: 1, createdAt: 1 });

module.exports = mongoose.model('Order', orderSchema);

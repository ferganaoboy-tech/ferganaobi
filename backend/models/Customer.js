const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 100,
  },
  type: {
    type: String,
    enum: ['retail', 'wholesale'],
    default: 'retail',
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    match: [/^\+998\d{9}$/, 'Telefon raqami +998 bilan boshlanishi va 9 ta raqamdan iborat bo\'lishi kerak'],
  },
  phone2: {
    type: String,
    match: [/^\+998\d{9}$/, 'Telefon raqami +998 bilan boshlanishi va 9 ta raqamdan iborat bo\'lishi kerak'],
  },
  address: {
    type: String,
  },
  region: {
    type: String,
  },
  inn: {
    type: String, // Company tax ID
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 50,
  },
  totalDebt: {
    type: Number,
    default: 0,
  },
  totalPurchased: {
    type: Number,
    default: 0,
  },
  cashbackBalance: {
    type: Number,
    default: 0,
  },
  cashbackPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  notes: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Text index for search
customerSchema.index({ name: 'text', phone: 'text' });

// Performance & Scaling Indexes
customerSchema.index({ type: 1, isActive: 1 });
customerSchema.index({ totalDebt: -1 });
customerSchema.index({ isActive: 1 });

module.exports = mongoose.model('Customer', customerSchema);

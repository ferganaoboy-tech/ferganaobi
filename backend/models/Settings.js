const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  usdExchangeRate: {
    type: Number,
    required: true,
    default: 12500
  },
  cartFields: {
    showCustomer: { type: Boolean, default: true },
    showAddress:  { type: Boolean, default: true },
    showDate:     { type: Boolean, default: true },
    showNotes:    { type: Boolean, default: true }
  },
  // ─── Funksiya sozlamalari (feature flags) ─────────────────────────────────
  features: {
    // Smena boshqaruvi (Kassir ish boshlash/yopish tizimi)
    // false = o'chirilgan (hozir default), true = yoqilgan
    shiftEnabled: { type: Boolean, default: false }
  },
  lastDailyReportDate: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);

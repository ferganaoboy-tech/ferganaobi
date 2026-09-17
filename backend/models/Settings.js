const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  usdExchangeRate: {
    type: Number,
    required: true,
    default: 12500
  },
  // ─── Valyuta Rejimi ────────────────────────────────────────────────────────
  // 'uzs'    = Faqat so'mda savdo (default)
  // 'usd'    = Faqat dollarda savdo (UI da dollar, DB da so'm saqlanadi)
  // 'hybrid' = Gibrid (so'm + dollar parallel, hozirgi tizim kabi)
  currencyMode: {
    type: String,
    enum: ['uzs', 'usd', 'hybrid'],
    default: 'uzs'
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

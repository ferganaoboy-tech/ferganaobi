const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  location: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  capacity: {
    type: Number,
    default: 5000,
  },
  color: {
    type: String,
    default: '#6366f1',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  /**
   * telegramChatId — Bu sklad uchun maxsus Telegram guruh yoki kanal ID si.
   * null bo'lsa, bu sklad uchun xabarlar faqat global obunachilarga yuboriladi.
   * Misol: '-1001234567890' (guruh uchun manfiy raqam)
   */
  telegramChatId: {
    type: String,
    default: null,
    trim: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Warehouse', warehouseSchema);

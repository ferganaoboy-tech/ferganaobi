const mongoose = require('mongoose');

const telegramSubscriberSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    default: ''
  },
  username: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  /**
   * isApproved — xavfsizlik qatlami.
   * true  → bildirishnomalar yetkaziladi.
   * false → obunachi pending holatda, admin /approve buyrug'i bilan tasdiqlaydi.
   *
   * MUHIM: broadcastToSubscribers faqat isActive:true && isApproved:true
   *        obunachilarga xabar yuboradi.
   */
  isApproved: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Admin panel uchun: tasdiqlanmagan obunachilarga tezkor query
telegramSubscriberSchema.index({ isApproved: 1, isActive: 1 });

module.exports = mongoose.model('TelegramSubscriber', telegramSubscriberSchema);

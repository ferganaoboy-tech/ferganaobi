const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional for system events
  },
  userName: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SYSTEM', 'PAYMENT', 'RETURN', 'START_SHIFT', 'CLOSE_SHIFT']
  },
  entity: {
    type: String, // 'Product', 'Order', 'Customer', 'Settings', 'Shift' etc.
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  details: {
    type: String, // Human readable details
    required: true
  },
  ip: {
    type: String
  }
}, { timestamps: true });

// Performance indexes
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });

// TTL index: 90 kundan eski loglar avtomatik o'chiriladi (DB o'sishini cheklash)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

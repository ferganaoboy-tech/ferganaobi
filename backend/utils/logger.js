const AuditLog = require('../models/AuditLog');

/**
 * Log an action into the Audit Trail
 * @param {Object} req - Express request object (to extract user and IP)
 * @param {String} action - Action type (CREATE, UPDATE, DELETE, etc.)
 * @param {String} entity - The entity being affected (Product, Order, etc.)
 * @param {String} entityId - MongoDB ID of the entity (optional)
 * @param {String} details - Human readable string of what happened
 */
const logAction = async (req, action, entity, entityId, details) => {
  try {
    const logData = {
      user: req?.user?._id || null,
      userName: req?.user?.name || 'Tizim',
      action,
      entity,
      entityId: entityId || null,
      details,
      ip: req?.ip || req?.connection?.remoteAddress
    };

    await AuditLog.create(logData);
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
};

module.exports = { logAction };

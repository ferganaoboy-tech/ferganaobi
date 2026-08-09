const AuditLog = require('../models/AuditLog');

// @desc    Get all audit logs
// @route   GET /api/audit-logs
// @access  Private (Superadmin)
exports.getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, entity, user } = req.query;
    
    const query = {};
    if (action) query.action = action;
    if (entity) query.entity = entity;
    if (user) query.user = user;

    const startIndex = (Number(page) - 1) * Number(limit);
    const total = await AuditLog.countDocuments(query);

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

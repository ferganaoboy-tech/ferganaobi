const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditLogController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Only allow superadmin and admin to view logs
router.get('/', protect, authorize('superadmin', 'admin'), getAuditLogs);

module.exports = router;

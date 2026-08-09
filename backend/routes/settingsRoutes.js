const express = require('express');
const router = express.Router();
const { getSettings, updateSettings, getDbStats, clearDomain } = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, getSettings);
router.put('/', protect, authorize('superadmin'), updateSettings);
router.get('/db-stats', protect, authorize('superadmin'), getDbStats);
router.post('/clear-domain', protect, authorize('superadmin'), clearDomain);

module.exports = router;

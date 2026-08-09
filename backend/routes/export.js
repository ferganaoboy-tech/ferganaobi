const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

// Export AI Analytics report to Excel
router.post('/excel', exportController.exportAiAnalyticsExcel);

// Export Full Database to Multi-sheet Excel
router.get('/full-backup', exportController.exportFullDatabaseExcel);

// Export Full Database to JSON
router.get('/full-backup-json', exportController.exportFullDatabaseJson);

module.exports = router;

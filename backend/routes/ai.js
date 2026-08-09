const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Define routes for AI analytics
router.get('/analytics', aiController.getAiAnalytics);
router.get('/history', aiController.getAiHistory);
router.get('/history/:id', aiController.getAiReportById);

module.exports = router;

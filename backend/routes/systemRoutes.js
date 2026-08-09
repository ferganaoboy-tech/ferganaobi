const express = require('express');
const router = express.Router();
const { getSystemHealth, getSystemAiDiagnostics } = require('../controllers/systemController');

router.get('/health', getSystemHealth);
router.get('/ai-diagnostics', getSystemAiDiagnostics);

module.exports = router;

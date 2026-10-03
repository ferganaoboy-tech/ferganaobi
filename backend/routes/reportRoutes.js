const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authorize } = require('../middleware/authMiddleware');

router.post('/send-daily', authorize('superadmin'), reportController.sendManualReport);
router.get('/sales', authorize('superadmin', 'admin'), reportController.getSalesReport);
router.get('/export-excel', authorize('superadmin', 'admin'), reportController.exportSalesExcel);

// ── Tikilgan kapital hisoboti ────────────────────────────────────────────────
router.get('/capital', authorize('superadmin', 'admin'), reportController.getCapitalReport);
router.get('/capital/export-excel', authorize('superadmin', 'admin'), reportController.exportCapitalExcel);

module.exports = router;

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authorize } = require('../middleware/authMiddleware');

router.post('/send-daily', authorize('superadmin'), reportController.sendManualReport);
router.get('/sales', authorize('superadmin', 'admin'), reportController.getSalesReport);
router.get('/export-excel', authorize('superadmin', 'admin'), reportController.exportSalesExcel);

module.exports = router;

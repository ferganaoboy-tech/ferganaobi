const express = require('express');
const router = express.Router();
const { createReturn, getReturns, quickReturn, defectiveReturn } = require('../controllers/returnController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createReturn);
router.post('/quick', protect, quickReturn);
router.post('/defective', protect, defectiveReturn);
router.get('/', protect, getReturns);

module.exports = router;

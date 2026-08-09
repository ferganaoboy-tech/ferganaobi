const express = require('express');
const router = express.Router();
const { getCurrentShift, startShift, closeShift } = require('../controllers/shiftController');
const { protect } = require('../middleware/authMiddleware');

router.get('/current', protect, getCurrentShift);
router.post('/start', protect, startShift);
router.post('/close', protect, closeShift);

module.exports = router;

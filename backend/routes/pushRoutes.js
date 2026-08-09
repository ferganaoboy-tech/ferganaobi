const express = require('express');
const router = express.Router();
const { subscribe, unsubscribe, getPublicKey } = require('../controllers/pushController');
const { protect } = require('../middleware/authMiddleware');

router.get('/vapid-public-key', getPublicKey);
router.post('/subscribe', protect, subscribe);
router.post('/unsubscribe', protect, unsubscribe);

module.exports = router;

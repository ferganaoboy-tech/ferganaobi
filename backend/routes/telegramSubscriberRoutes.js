const express = require('express');
const router = express.Router();
const { getSubscribers, approveSubscriber, rejectSubscriber } = require('../controllers/telegramSubscriberController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('superadmin', 'admin'));

router.route('/')
  .get(getSubscribers);

router.route('/:id/approve')
  .put(approveSubscriber);

router.route('/:id/reject')
  .delete(rejectSubscriber);

module.exports = router;

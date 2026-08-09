const express = require('express');
const {
  createTransfer,
  getTransfers,
  getTransferById,
  acceptTransfer,
  rejectTransfer,
  cancelTransfer,
  createTransferRequest,
  approveTransferRequest,
  rejectTransferRequest
} = require('../controllers/transferController');
const { authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Allow all users with warehouse access to see and create transfers
// but maybe restrict cancel/reject to specific roles or sender/receiver
router.route('/')
  .post(createTransfer)
  .get(getTransfers);

router.route('/pending-count')
  .get(require('../controllers/transferController').getPendingCount);

router.route('/:id')
  .get(getTransferById);

router.route('/:id/accept')
  .put(acceptTransfer);

router.route('/:id/reject')
  .put(rejectTransfer);

router.route('/:id/cancel')
  .put(cancelTransfer);

// --- Request Endpoints ---
router.route('/request')
  .post(createTransferRequest);

router.route('/:id/approve-request')
  .put(approveTransferRequest);

router.route('/:id/reject-request')
  .put(rejectTransferRequest);

module.exports = router;

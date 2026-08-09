const express = require('express');
const router = express.Router();
const {
  getOrders,
  getOrder,
  createOrder,
  confirmOrder,
  cancelOrder,
  updateOrderStatus,
  getOrderStats,
  sendReceiptImage
} = require('../controllers/orderController');

router.get('/stats', getOrderStats);

router.route('/')
  .get(getOrders)
  .post(createOrder);

router.route('/:id')
  .get(getOrder);

router.put('/:id/confirm', confirmOrder);
router.put('/:id/cancel', cancelOrder);
router.put('/:id/deliver', updateOrderStatus);
router.post('/:id/send-receipt', sendReceiptImage);

module.exports = router;

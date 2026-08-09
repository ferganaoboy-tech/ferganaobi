const express = require('express');
const router = express.Router();
const {
  getPayments,
  createPayment,
  getCustomerPayments
} = require('../controllers/paymentController');

router.route('/')
  .get(getPayments)
  .post(createPayment);

router.get('/customer/:customerId', getCustomerPayments);

module.exports = router;

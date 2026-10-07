const express = require('express');
const router = express.Router();
const {
  getPayments,
  createPayment,
} = require('../controllers/paymentController');

// GET  /api/payments          — barcha to'lovlar (filter: customer, order, method, dateFrom, dateTo)
// POST /api/payments          — yangi to'lov yaratish
// NOTE: Mijoz to'lovlari GET /api/payments?customer=<id> orqali olinadi (alohida route kerak emas)
router.route('/')
  .get(getPayments)
  .post(createPayment);

module.exports = router;


const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getDebtors,
  recalculateAllDebts
} = require('../controllers/customerController');

router.get('/debtors', getDebtors);
router.post('/recalculate-debts', recalculateAllDebts);

router.route('/')
  .get(getCustomers)
  .post(createCustomer);

router.route('/:id')
  .get(getCustomer)
  .put(updateCustomer)
  .delete(deleteCustomer);

module.exports = router;

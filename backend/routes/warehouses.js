const express = require('express');
const router = express.Router();
const {
  getAllWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse
} = require('../controllers/warehouseController');

router.route('/')
  .get(getAllWarehouses)
  .post(createWarehouse);

router.route('/:id')
  .put(updateWarehouse)
  .delete(deleteWarehouse);

module.exports = router;
